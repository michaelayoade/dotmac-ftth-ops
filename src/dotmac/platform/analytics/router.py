"""
Analytics API router.

Provides REST endpoints for analytics operations.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.api_keys_metrics_router import _get_api_key_metrics_cached
from dotmac.platform.auth.dependencies import (
    CurrentUser,
    get_current_user,
)
from dotmac.platform.auth.metrics_router import _get_auth_metrics_cached
from dotmac.platform.auth.rbac_dependencies import require_any_permission
from dotmac.platform.billing.metrics_router import (
    _get_billing_metrics_cached,
    _get_customer_metrics_cached,
)
from dotmac.platform.communications.metrics_router import _get_communication_stats_cached
from dotmac.platform.db import get_session_dependency
from dotmac.platform.file_storage.metrics_router import _get_file_stats_cached
from dotmac.platform.file_storage.service import get_storage_service
from dotmac.platform.monitoring.metrics_router import _get_monitoring_metrics_cached
from dotmac.platform.secrets.metrics_router import _get_secrets_metrics_cached

from .models import (
    AnalyticsQueryRequest,
    EventTrackRequest,
    EventTrackResponse,
    MetricDataPoint,
    MetricRecordRequest,
    MetricRecordResponse,
    MetricSeries,
    MetricsQueryResponse,
    ReportResponse,
    ReportSection,
    format_datetime,
)

logger = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from dotmac.platform.analytics.service import AnalyticsService


def _ensure_utc(value: Any | None) -> datetime:
    """Normalize incoming datetime-like values to UTC-aware datetimes."""

    if value is None:
        return datetime.now(UTC)

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(cleaned)
        except ValueError:
            return datetime.now(UTC)
        return _ensure_utc(parsed)

    return datetime.now(UTC)


def _isoformat(value: Any | None) -> str:
    """Return a UTC ISO 8601 representation with trailing Z."""

    return format_datetime(_ensure_utc(value))


def _parse_time_range_to_days(time_range: str | None) -> int:
    """Convert a timeRange string like '30d' or '24h' into whole days."""
    if not time_range:
        return 30

    cleaned = time_range.strip().lower()
    try:
        if cleaned.endswith("d"):
            days = int(cleaned[:-1] or 0)
        elif cleaned.endswith("h"):
            hours = int(cleaned[:-1] or 0)
            days = max(1, hours // 24 or 1)
        else:
            days = int(cleaned)
    except Exception:
        days = 30

    return max(days, 1)


def _build_infrastructure_metrics() -> dict[str, Any]:
    """Synthetic infrastructure metrics compatible with frontend expectations."""
    uptime = 99.9
    return {
        "health": {
            "status": "healthy",
            "uptime": uptime,
            "services": [
                {"name": "api", "status": "healthy", "latency": 12.5, "uptime": uptime},
                {"name": "db", "status": "healthy", "latency": 18.2, "uptime": uptime},
                {"name": "redis", "status": "healthy", "latency": 6.4, "uptime": uptime},
            ],
        },
        "performance": {
            "avgLatency": 12.5,
            "p99Latency": 48.1,
            "throughput": 1240,
            "errorRate": 0.05,
            "requestsPerSecond": 320,
        },
        "logs": {
            "totalLogs": 12500,
            "errors": 18,
            "warnings": 94,
        },
        "uptime": uptime,
        "services": {
            "total": 5,
            "healthy": 5,
            "degraded": 0,
            "critical": 0,
        },
        "resources": {
            "cpu": 62.5,
            "memory": 71.2,
            "disk": 55.3,
            "network": 38.7,
        },
    }


# Create router
analytics_router = APIRouter(
    prefix="/analytics",
)


def _resolve_tenant_id(request: Request, current_user: CurrentUser) -> str:
    """Resolve tenant ID, supporting platform admin impersonation."""
    tenant_id: str | None = current_user.tenant_id

    if getattr(current_user, "is_platform_admin", False):
        try:
            from dotmac.platform.auth.platform_admin import get_target_tenant_id

            impersonated = get_target_tenant_id(request, current_user)
        except Exception:  # pragma: no cover - defensive
            impersonated = None

        if impersonated:
            tenant_id = impersonated

    if tenant_id is None:
        tenant_id = "default"

    return str(tenant_id)


def get_analytics_service(request: Request, current_user: CurrentUser) -> "AnalyticsService":
    """Get tenant-scoped analytics service instance."""
    from dotmac.platform.analytics.service import get_analytics_service as get_service

    resolved_tenant = _resolve_tenant_id(request, current_user)
    return get_service(
        tenant_id=resolved_tenant,
        service_name="platform",
    )


# ========================================
# Endpoints
# ========================================


@analytics_router.get(
    "/security/metrics",
    summary="Get security metrics",
    description="Security metrics aggregated from auth/API key/secret usage.",
)
async def get_security_metrics(
    request: Request,
    timeRange: str = Query("30d", description="Time range (e.g. 30d, 7d)"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: CurrentUser = Depends(
        require_any_permission(
            "security.read",
            "admin",
            "analytics.read",
            "analytics.metrics.read",
            "platform:analytics.read",
        )
    ),
) -> dict[str, Any]:
    """Return security metrics using existing auth/API key/secret analytics."""
    period_days = _parse_time_range_to_days(timeRange)
    tenant_id = _resolve_tenant_id(request, current_user)

    auth_data, api_key_data, secrets_data = await asyncio.gather(
        _get_auth_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        ),
        _get_api_key_metrics_cached(period_days=period_days, tenant_id=tenant_id),
        _get_secrets_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        ),
    )

    return {
        "auth": {
            "activeSessions": auth_data.get("active_users", 0),
            "failedAttempts": auth_data.get("failed_logins", 0),
            "mfaEnabled": auth_data.get("mfa_enabled_users", 0),
            "passwordResets": auth_data.get("password_reset_requests", 0),
        },
        "apiKeys": {
            "total": api_key_data.get("total_keys", 0),
            "active": api_key_data.get("active_keys", 0),
            "expiring": api_key_data.get("keys_expiring_soon", 0),
        },
        "secrets": {
            "total": secrets_data.get("total_secrets_created", 0),
            "active": secrets_data.get("unique_secrets_accessed", 0),
            "expired": secrets_data.get("secrets_deleted_last_7d", 0),
            "rotated": secrets_data.get("secrets_created_last_7d", 0),
        },
        "compliance": {
            "score": max(0.0, min(100.0, 100.0 - secrets_data.get("failed_access_attempts", 0))),
            "issues": secrets_data.get("failed_access_attempts", 0),
        },
    }


@analytics_router.get(
    "/operations/metrics",
    summary="Get operations metrics",
    description="Aggregated operations metrics for dashboards",
)
async def get_operations_metrics(
    request: Request,
    timeRange: str = Query("30d", description="Time range (e.g. 30d, 7d)"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: CurrentUser = Depends(
        require_any_permission(
            "analytics.read",
            "analytics.metrics.read",
            "platform:analytics.read",
            "admin",
        )
    ),
) -> dict[str, Any]:
    """Return operations metrics using customer/comms/file/monitoring data."""
    period_days = _parse_time_range_to_days(timeRange)
    tenant_id = _resolve_tenant_id(request, current_user)

    storage_service = get_storage_service()

    customer_data, comms_data, file_data, monitoring_data = await asyncio.gather(
        _get_customer_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        ),
        _get_communication_stats_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        ),
        _get_file_stats_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            storage_service=storage_service,
        ),
        _get_monitoring_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        ),
        return_exceptions=True,
    )

    def _safe(data: Any) -> dict[str, Any]:
        return data if isinstance(data, dict) else {}

    customers = _safe(customer_data)
    comms = _safe(comms_data)
    files = _safe(file_data)
    monitoring = _safe(monitoring_data)

    total_customers = customers.get("total_customers", 0)
    churn_risk = customers.get("at_risk_customers", 0)
    churn_risk_pct = (churn_risk / total_customers * 100) if total_customers else 0.0

    total_requests = monitoring.get("total_requests", 0) or 0

    response: dict[str, Any] = {
        "customers": {
            "total": total_customers,
            "newThisMonth": customers.get("new_customers_this_month", 0),
            "growthRate": customers.get("customer_growth_rate", 0.0),
            "churnRisk": churn_risk_pct,
        },
        "communications": {
            "totalSent": comms.get("total_sent", 0),
            "sentToday": comms.get("total_sent", 0),
            "deliveryRate": comms.get("delivery_rate", 0.0),
        },
        "files": {
            "totalFiles": files.get("total_files", 0),
            "totalSize": files.get("total_size_mb", 0.0),
            "uploadsToday": 0,
            "downloadsToday": 0,
        },
        "activity": {
            "eventsPerHour": total_requests / 24 if total_requests else 0,
            "activeUsers": monitoring.get("user_activities", 0),
        },
    }
    # Provide flattened aliases for legacy callers/UI fallbacks
    response.update(
        totalCustomers=response["customers"]["total"],
        newCustomersThisMonth=response["customers"]["newThisMonth"],
        customerGrowthRate=response["customers"]["growthRate"],
        customersAtRisk=response["customers"]["churnRisk"],
        totalCommunications=response["communications"]["totalSent"],
        communicationsSentToday=response["communications"]["sentToday"],
        communicationDeliveryRate=response["communications"]["deliveryRate"],
        totalFiles=response["files"]["totalFiles"],
        totalFileSize=response["files"]["totalSize"],
        filesUploadedToday=response["files"]["uploadsToday"],
        fileDownloadsToday=response["files"]["downloadsToday"],
        eventsPerHour=response["activity"]["eventsPerHour"],
        activeUsers=response["activity"]["activeUsers"],
    )

    return response


@analytics_router.get(
    "/infrastructure/health",
    summary="Get infrastructure health metrics",
    description="Stub endpoint to provide infrastructure health/performance for dashboards",
)
async def get_infrastructure_health(
    current_user: CurrentUser = Depends(
        require_any_permission(
            "monitoring.read",
            "analytics.read",
            "analytics.metrics.read",
            "platform:analytics.read",
            "admin",
        )
    ),
) -> dict[str, Any]:
    """Return synthetic infrastructure health metrics."""
    return _build_infrastructure_metrics()


@analytics_router.get(
    "/billing/metrics",
    summary="Get billing metrics (analytics compatibility endpoint)",
    description="Compatibility wrapper around billing metrics for analytics dashboards",
)
async def get_billing_metrics_analytics(
    request: Request,
    timeRange: str = Query("30d", description="Time range (e.g. 30d, 24h)"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: CurrentUser = Depends(
        require_any_permission(
            "billing.read",
            "billing:metrics:read",
            "analytics.read",
            "analytics.metrics.read",
            "platform:analytics.read",
            "admin",
        )
    ),
) -> dict[str, Any]:
    """Expose billing metrics under the analytics namespace expected by the UI."""
    period_days = _parse_time_range_to_days(timeRange)
    tenant_id = _resolve_tenant_id(request, current_user)

    try:
        metrics_data = await _get_billing_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        )
    except Exception:
        metrics_data = {}

    mrr = float(metrics_data.get("mrr", 0.0) or 0.0)
    arr = float(metrics_data.get("arr", mrr * 12) or 0.0)
    active_subscriptions = int(metrics_data.get("active_subscriptions", 0) or 0)
    total_invoices = int(metrics_data.get("total_invoices", 0) or 0)
    paid_invoices = int(metrics_data.get("paid_invoices", 0) or 0)
    overdue_invoices = int(metrics_data.get("overdue_invoices", 0) or 0)
    total_payments_count = int(metrics_data.get("total_payments", 0) or 0)
    successful_payments = int(metrics_data.get("successful_payments", 0) or 0)
    failed_payments = int(metrics_data.get("failed_payments", 0) or 0)
    total_payment_amount = float(metrics_data.get("total_payment_amount", 0.0) or 0.0)

    # Compute derived values with safe fallbacks
    payments_count = total_payments_count or successful_payments + failed_payments
    payment_success_rate = (successful_payments / payments_count) * 100 if payments_count else 0.0
    revenue_total = total_payment_amount or mrr
    outstanding_balance = float(overdue_invoices) * (mrr / max(total_invoices or 1, 1))

    response = {
        "revenue": {
            "total": revenue_total,
            "mrr": mrr,
            "revenueGrowth": 0.0,
        },
        "subscriptions": {
            "total": max(active_subscriptions, active_subscriptions),
            "active": active_subscriptions,
            "pending": 0,
            "cancelled": 0,
            "trial": 0,
            "churnRate": 0.0,
        },
        "invoices": {
            "total": total_invoices,
            "paid": paid_invoices,
            "overdue": overdue_invoices,
            "outstanding": outstanding_balance,
            "pending": max(total_invoices - paid_invoices - overdue_invoices, 0),
            "overdueAmount": outstanding_balance,
        },
        "payments": {
            "total": payments_count,
            "successful": successful_payments,
            "failed": failed_payments,
            "successRate": payment_success_rate,
        },
        # Flattened fields for legacy callers
        "mrr": mrr,
        "arr": arr,
        "totalRevenue": revenue_total,
        "monthlyRecurringRevenue": mrr,
        "averageRevenuePerUser": 0.0,
        "activeSubscriptions": active_subscriptions,
        "churnRate": 0.0,
        "outstandingBalance": outstanding_balance,
        "totalInvoices": total_invoices,
        "paidInvoices": paid_invoices,
        "overdueInvoices": overdue_invoices,
        "pendingInvoices": max(total_invoices - paid_invoices - overdue_invoices, 0),
        "totalCustomers": 0,
        "revenueTimeSeries": [
            {"label": "current", "value": revenue_total},
            {"label": "mrr", "value": mrr},
        ],
        "subscriptionsTimeSeries": [
            {"label": "active", "value": active_subscriptions},
            {"label": "invoices", "value": total_invoices},
        ],
    }

    return response


@analytics_router.post("/events", response_model=EventTrackResponse)
async def track_event(
    event_request: EventTrackRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> EventTrackResponse:
    """
    Track an analytics event.

    Requires authentication.
    """
    try:
        # Add user context
        if not event_request.user_id:
            event_request.user_id = current_user.user_id

        # Track event
        service = get_analytics_service(request, current_user)
        event_timestamp = _ensure_utc(event_request.timestamp)

        event_id = await service.track_event(
            event_name=event_request.event_name,
            event_type=event_request.event_type.value,
            properties=event_request.properties,
            user_id=event_request.user_id,
            session_id=event_request.session_id,
            timestamp=event_timestamp,
        )

        return EventTrackResponse(
            event_id=event_id,
            event_name=event_request.event_name,
            timestamp=event_timestamp,
            status="tracked",
            message="Event tracked successfully",
        )
    except Exception as e:
        logger.error(f"Error tracking event {event_request.event_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to track event"
        )


@analytics_router.post("/metrics", response_model=MetricRecordResponse)
async def record_metric(
    metric_request: MetricRecordRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> MetricRecordResponse:
    """
    Record a metric value.

    Requires authentication.
    """
    try:
        # Add user context to tags
        metric_request.tags["user_id"] = current_user.user_id

        # Record metric
        service = get_analytics_service(request, current_user)
        await service.record_metric(
            metric_name=metric_request.metric_name,
            value=metric_request.value,
            unit=metric_request.unit.value,
            tags=metric_request.tags,
        )

        metric_timestamp = _ensure_utc(metric_request.timestamp)

        return MetricRecordResponse(
            metric_id=str(uuid4()),
            metric_name=metric_request.metric_name,
            value=metric_request.value,
            unit=metric_request.unit.value,
            timestamp=metric_timestamp,
            status="recorded",
        )
    except Exception as e:
        logger.error(f"Error recording metric {metric_request.metric_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to record metric"
        )


@analytics_router.get("/events", response_model=dict)
async def get_events(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    start_date: datetime | None = Query(None, description="Start date"),
    end_date: datetime | None = Query(None, description="End date"),
    event_type: str | None = Query(None, description="Event type filter"),
    user_id: str | None = Query(None, description="User ID filter"),
    limit: int = Query(100, ge=1, le=1000, description="Result limit"),
) -> dict[str, Any]:
    """
    Query analytics events.

    Requires authentication.
    """
    try:
        # Default time range if not specified
        if not end_date:
            end_date = datetime.now(UTC)
        if not start_date:
            start_date = end_date - timedelta(days=7)

        end_date = _ensure_utc(end_date)
        start_date = _ensure_utc(start_date)

        # Query events
        service = get_analytics_service(request, current_user)
        events = await service.query_events(
            start_date=start_date,
            end_date=end_date,
            event_type=event_type,
            user_id=user_id,
            limit=limit,
        )

        return {
            "events": events,
            "total": len(events),
            "period": {"start": _isoformat(start_date), "end": _isoformat(end_date)},
        }
    except Exception as e:
        logger.error(f"Error querying events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to query events"
        )


def _extract_metrics_from_dict(
    metrics_summary: dict[str, Any], metric_name: str | None
) -> list[dict[str, Any]]:
    """Extract metrics from summary dictionary."""
    metrics_list = []
    # Lowercase metric_name for case-insensitive comparison
    metric_name_lower = metric_name.lower() if metric_name else None

    for metric_type in ["counters", "gauges", "histograms"]:
        if metric_type in metrics_summary:
            for name, value in metrics_summary[metric_type].items():
                # Case-insensitive comparison to match service filtering
                if metric_name_lower is None or metric_name_lower in name.lower():
                    metrics_list.append(
                        {
                            "name": name,
                            "type": metric_type[:-1],  # Remove 's' from plural
                            "value": value,
                            "timestamp": _ensure_utc(metrics_summary.get("timestamp")),
                        }
                    )
    return metrics_list


def _convert_to_metrics_list(
    metrics_summary: dict[str, Any] | list[Any], metric_name: str | None
) -> list[dict[str, Any]]:
    """Convert metrics summary to list format."""
    if isinstance(metrics_summary, dict):
        return _extract_metrics_from_dict(metrics_summary, metric_name)
    else:
        return metrics_summary if isinstance(metrics_summary, list) else []


def _group_metrics_by_name(metrics_list: list[dict[str, Any]]) -> dict[str, Any]:
    """Group metrics by name for series creation."""
    from collections import defaultdict

    grouped = defaultdict(list)
    for metric in metrics_list:
        grouped[metric["name"]].append(
            {
                "timestamp": _ensure_utc(metric.get("timestamp")),
                "value": metric["value"],
            }
        )
    return grouped


def _create_metric_series(grouped_metrics: dict[str, Any], aggregation: str) -> list[MetricSeries]:
    """Create MetricSeries objects from grouped metrics."""

    def _extract_numeric_value(value: Any) -> float:
        """Extract numeric value from various metric formats."""
        if isinstance(value, (int, float)):
            return float(value)
        elif isinstance(value, dict):
            # Handle gauge format: {"value": float, "labels": dict}
            if "value" in value:
                return float(value["value"])
            # Handle histogram format: {"count": int, "sum": float, "avg": float, ...}
            # Use avg if available, otherwise sum, otherwise count
            elif "avg" in value:
                return float(value["avg"])
            elif "sum" in value:
                return float(value["sum"])
            elif "count" in value:
                return float(value["count"])
        # Fallback to 0.0 if we can't extract a value
        return 0.0

    metrics = []
    for name, data_points in grouped_metrics.items():
        metrics.append(
            MetricSeries(
                metric_name=name,
                unit="count",  # Default unit
                data_points=[
                    MetricDataPoint(
                        timestamp=dp.get("timestamp", datetime.now(UTC)),
                        value=_extract_numeric_value(dp["value"]),
                        tags=None,  # Optional field
                    )
                    for dp in data_points
                ],
                aggregation=aggregation,
            )
        )
    return metrics


@analytics_router.get("/metrics", response_model=MetricsQueryResponse)
async def get_metrics(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    metric_name: str | None = Query(None, description="Metric name filter"),
    start_date: datetime | None = Query(None, description="Start date"),
    end_date: datetime | None = Query(None, description="End date"),
    aggregation: str = Query("avg", description="Aggregation type (avg, sum, min, max)"),
    interval: str = Query("hour", description="Time interval (minute, hour, day, week)"),
) -> MetricsQueryResponse:
    """
    Query metrics data.

    Requires authentication.
    """
    try:
        # Default time range
        if not end_date:
            end_date = datetime.now(UTC)
        if not start_date:
            start_date = end_date - timedelta(hours=24)

        end_date = _ensure_utc(end_date)
        start_date = _ensure_utc(start_date)

        # Query metrics
        service = get_analytics_service(request, current_user)
        metrics_summary = await service.query_metrics(
            metric_name=metric_name,
            start_date=start_date,
            end_date=end_date,
            aggregation=aggregation,
            interval=interval,
        )

        # Convert metrics summary to list format
        metrics_list = _convert_to_metrics_list(metrics_summary, metric_name)

        # Convert to MetricSeries format
        metrics = []
        if metrics_list:
            grouped = _group_metrics_by_name(metrics_list)
            metrics = _create_metric_series(grouped, aggregation)

        return MetricsQueryResponse(
            metrics=metrics,
            period={
                "start": start_date,
                "end": end_date,
            },
            total_series=len(metrics),
            query_time_ms=0.0,  # Would be measured in real implementation
        )
    except Exception as e:
        logger.error(f"Error querying metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to query metrics"
        )


@analytics_router.post("/query", response_model=dict)
async def custom_query(
    query_request: AnalyticsQueryRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Execute a custom analytics query.

    Requires authentication.
    """
    try:
        service = get_analytics_service(request, current_user)

        # Execute query based on type
        if query_request.query_type == "events":
            result = await service.query_events(**query_request.filters)
        elif query_request.query_type == "metrics":
            result = await service.query_metrics(**query_request.filters)
        elif query_request.query_type == "aggregations":
            result = await service.aggregate_data(
                filters=query_request.filters,
                group_by=query_request.group_by,
                order_by=query_request.order_by,
                limit=query_request.limit,
            )
        else:
            raise ValueError(f"Unknown query type: {query_request.query_type}")

        return {
            "query_type": query_request.query_type,
            "result": result,
            "total": len(result) if isinstance(result, list) else 1,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error executing custom query: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to execute query"
        )


@analytics_router.get("/reports/{report_type}", response_model=ReportResponse)
async def generate_report(
    report_type: str,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    start_date: datetime | None = Query(None, description="Report start date"),
    end_date: datetime | None = Query(None, description="Report end date"),
    format: str = Query("json", description="Report format (json, csv)"),
) -> ReportResponse:
    """
    Generate an analytics report.

    Report types:
    - summary: Overall analytics summary
    - usage: Usage statistics
    - performance: Performance metrics
    - user_activity: User activity report

    Requires authentication.
    """
    try:
        # Default time range
        if not end_date:
            end_date = datetime.now(UTC)
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Generate report
        service = get_analytics_service(request, current_user)
        report_data = await service.generate_report(
            report_type=report_type,
            start_date=start_date,
            end_date=end_date,
            user_id=current_user.user_id,
        )

        # Convert report type string to enum
        try:
            from .models import ReportType as ReportTypeEnum

            report_type_enum = ReportTypeEnum(report_type)
        except ValueError:
            report_type_enum = ReportTypeEnum.SUMMARY  # Default

        return ReportResponse(
            report_id=str(uuid4()),
            report_type=report_type_enum,
            title=f"{report_type.title()} Report",
            sections=[
                ReportSection(
                    title="Overview",
                    data=report_data or {},
                    charts=None,  # Optional field
                )
            ],
            generated_at=datetime.now(UTC),
            period={"start": start_date, "end": end_date},
            metadata=None,  # Optional field
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid report type: {report_type}"
        )
    except Exception as e:
        logger.error(f"Error generating {report_type} report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate report"
        )


@analytics_router.get("/dashboard", response_model=dict)
async def get_dashboard_data(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    period: str = Query("day", description="Dashboard period (hour, day, week, month)"),
) -> dict[str, Any]:
    """
    Get dashboard analytics data.

    Requires authentication.
    """
    try:
        # Calculate period
        end_date = datetime.now(UTC)
        if period == "hour":
            start_date = end_date - timedelta(hours=1)
        elif period == "day":
            start_date = end_date - timedelta(days=1)
        elif period == "week":
            start_date = end_date - timedelta(weeks=1)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        else:
            start_date = end_date - timedelta(days=1)

        start_date = _ensure_utc(start_date)
        end_date = _ensure_utc(end_date)

        # Get dashboard data
        service = get_analytics_service(request, current_user)
        dashboard = await service.get_dashboard_data(
            start_date=start_date, end_date=end_date, user_id=current_user.user_id
        )

        return {
            "period": period,
            "data": dashboard,
            "generated_at": _isoformat(None),
            "window": {"start": _isoformat(start_date), "end": _isoformat(end_date)},
        }
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get dashboard data"
        )


# Export router
__all__ = ["analytics_router"]
