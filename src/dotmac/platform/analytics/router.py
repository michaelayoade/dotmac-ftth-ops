"""
Analytics API router.

Provides REST endpoints for analytics operations.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status

from dotmac.platform.auth.dependencies import CurrentUser, get_current_user

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


# Create router
analytics_router = APIRouter(prefix="/api/v1/analytics", )

# Analytics service instance (lazy initialization)
_analytics_service = None


def get_analytics_service() -> Any:
    """Get or create analytics service instance."""
    global _analytics_service
    if _analytics_service is None:
        # Initialize with proper service
        from dotmac.platform.analytics.service import AnalyticsService

        _analytics_service = AnalyticsService()

    return _analytics_service


# ========================================
# Endpoints
# ========================================


@analytics_router.post("/events", response_model=EventTrackResponse)
async def track_event(
    request: EventTrackRequest, current_user: CurrentUser = Depends(get_current_user)
) -> EventTrackResponse:
    """
    Track an analytics event.

    Requires authentication.
    """
    try:
        # Add user context
        if not request.user_id:
            request.user_id = current_user.user_id

        # Track event
        service = get_analytics_service()
        event_id = await service.track_event(
            event_name=request.event_name,
            event_type=request.event_type.value,
            properties=request.properties,
            user_id=request.user_id,
            session_id=request.session_id,
        )

        event_timestamp = _ensure_utc(request.timestamp)

        return EventTrackResponse(
            event_id=event_id,
            event_name=request.event_name,
            timestamp=event_timestamp,
            status="tracked",
            message="Event tracked successfully",
        )
    except Exception as e:
        logger.error(f"Error tracking event {request.event_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to track event"
        )


@analytics_router.post("/metrics", response_model=MetricRecordResponse)
async def record_metric(
    request: MetricRecordRequest, current_user: CurrentUser = Depends(get_current_user)
) -> MetricRecordResponse:
    """
    Record a metric value.

    Requires authentication.
    """
    try:
        # Add user context to tags
        request.tags["user_id"] = current_user.user_id

        # Record metric
        service = get_analytics_service()
        metric_id = await service.record_metric(
            metric_name=request.metric_name,
            value=request.value,
            unit=request.unit.value,
            tags=request.tags,
        )

        metric_timestamp = _ensure_utc(request.timestamp)

        return MetricRecordResponse(
            metric_id=str(metric_id) if metric_id else str(uuid4()),
            metric_name=request.metric_name,
            value=request.value,
            unit=request.unit.value,
            timestamp=metric_timestamp,
            status="recorded",
        )
    except Exception as e:
        logger.error(f"Error recording metric {request.metric_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to record metric"
        )


@analytics_router.get("/events", response_model=dict)
async def get_events(
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
        service = get_analytics_service()
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
    for metric_type in ["counters", "gauges", "histograms"]:
        if metric_type in metrics_summary:
            for name, value in metrics_summary[metric_type].items():
                if metric_name is None or metric_name in name:
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
    metrics = []
    for name, data_points in grouped_metrics.items():
        metrics.append(
            MetricSeries(
                metric_name=name,
                unit="count",  # Default unit
                data_points=[
                    MetricDataPoint(
                        timestamp=dp.get("timestamp", datetime.now(UTC)),
                        value=dp["value"],
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
        service = get_analytics_service()
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
    request: AnalyticsQueryRequest, current_user: CurrentUser = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Execute a custom analytics query.

    Requires authentication.
    """
    try:
        service = get_analytics_service()

        # Execute query based on type
        if request.query_type == "events":
            result = await service.query_events(**request.filters)
        elif request.query_type == "metrics":
            result = await service.query_metrics(**request.filters)
        elif request.query_type == "aggregations":
            result = await service.aggregate_data(
                filters=request.filters,
                group_by=request.group_by,
                order_by=request.order_by,
                limit=request.limit,
            )
        else:
            raise ValueError(f"Unknown query type: {request.query_type}")

        return {
            "query_type": request.query_type,
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
        service = get_analytics_service()
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
        service = get_analytics_service()
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
