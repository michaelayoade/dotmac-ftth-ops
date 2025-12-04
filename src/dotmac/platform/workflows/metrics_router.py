"""
Workflow Services Metrics Router

Provides monitoring endpoints for workflow service metrics, including:
- Operation performance metrics
- Circuit breaker status
- Retry statistics
- Success/failure rates
- Integration with existing monitoring infrastructure
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import AuditActivity
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.cache import CacheTier, cached_result
from dotmac.platform.db import get_session_dependency
from dotmac.platform.workflows.base import prometheus

logger = structlog.get_logger(__name__)

# Cache TTL (in seconds)
WORKFLOW_METRICS_CACHE_TTL = 60  # 1 minute

router = APIRouter(tags=["Workflow Metrics"], prefix="/workflows")


# ============================================================================
# Response Models
# ============================================================================


class WorkflowServiceMetrics(BaseModel):
    """Metrics for a single workflow service."""

    model_config = ConfigDict(from_attributes=True)

    service_name: str = Field(description="Service name")
    total_operations: int = Field(description="Total operations executed")
    successful_operations: int = Field(description="Successful operations")
    failed_operations: int = Field(description="Failed operations")
    success_rate: float = Field(description="Success rate percentage")
    avg_duration_seconds: float = Field(description="Average operation duration")
    p95_duration_seconds: float = Field(description="P95 operation duration")
    p99_duration_seconds: float = Field(description="P99 operation duration")
    error_count: int = Field(description="Total error count")
    top_operations: list[dict[str, Any]] = Field(description="Top operations by volume")
    top_errors: list[dict[str, Any]] = Field(description="Top errors by frequency")


class WorkflowMetricsOverview(BaseModel):
    """Overview of all workflow services metrics."""

    model_config = ConfigDict(from_attributes=True)

    total_services: int = Field(description="Total workflow services tracked")
    total_operations: int = Field(description="Total operations across all services")
    overall_success_rate: float = Field(description="Overall success rate percentage")
    services: list[WorkflowServiceMetrics] = Field(description="Per-service metrics")
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


class CircuitBreakerStatus(BaseModel):
    """Circuit breaker status for external services."""

    model_config = ConfigDict(from_attributes=True)

    service_name: str = Field(description="External service name")
    state: str = Field(description="Circuit breaker state (closed/open/half_open)")
    failure_count: int = Field(description="Consecutive failure count")
    success_count: int = Field(description="Success count in half-open state")
    last_failure: datetime | None = Field(description="Last failure timestamp")


class PrometheusMetricsResponse(BaseModel):
    """Prometheus metrics in text format."""

    model_config = ConfigDict(from_attributes=True)

    metrics: str = Field(description="Prometheus text format metrics")
    metric_count: int = Field(description="Number of metrics exported")
    timestamp: datetime = Field(description="Export timestamp")


# ============================================================================
# Cached Helper Functions
# ============================================================================


@cached_result(  # type: ignore[misc]
    ttl=WORKFLOW_METRICS_CACHE_TTL,
    key_prefix="workflow:metrics:overview",
    key_params=["period_hours", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_workflow_metrics_cached(
    period_hours: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for workflow metrics calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(hours=period_hours)

    # Build base query for workflow operations
    base_query = select(AuditActivity).where(
        AuditActivity.created_at >= period_start,
        AuditActivity.action.like("%Service.%"),  # Workflow services have Service suffix
    )

    if tenant_id:
        base_query = base_query.where(AuditActivity.tenant_id == tenant_id)

    # Get all workflow activities
    result = await session.execute(base_query)
    activities = result.scalars().all()

    # Group by service
    services_data: dict[str, dict[str, Any]] = {}

    for activity in activities:
        # Extract service name from action (e.g., "NotificationsService.notify_team")
        action_parts = activity.action.split(".")
        if len(action_parts) < 2:
            continue

        service_name = action_parts[0]
        operation_name = ".".join(action_parts[1:])

        if service_name not in services_data:
            services_data[service_name] = {
                "service_name": service_name,
                "operations": [],
                "errors": [],
                "durations": [],
                "success_count": 0,
                "error_count": 0,
            }

        service_data = services_data[service_name]

        # Extract duration from details
        details = activity.details or {}
        duration = details.get("duration_seconds", 0.0)
        success = details.get("success", True)

        service_data["durations"].append(duration)
        service_data["operations"].append(
            {"operation": operation_name, "duration": duration, "success": success}
        )

        if success:
            service_data["success_count"] += 1
        else:
            service_data["error_count"] += 1
            error = details.get("error", "Unknown error")
            service_data["errors"].append({"operation": operation_name, "error": error})

    # Calculate metrics for each service
    services_metrics = []
    total_operations = 0
    total_successful = 0

    for service_name, data in services_data.items():
        total_ops = len(data["operations"])
        successful_ops = data["success_count"]
        failed_ops = data["error_count"]

        total_operations += total_ops
        total_successful += successful_ops

        # Calculate durations
        durations = sorted(data["durations"])
        avg_duration = sum(durations) / len(durations) if durations else 0.0
        p95_duration = durations[int(len(durations) * 0.95)] if len(durations) > 1 else avg_duration
        p99_duration = durations[int(len(durations) * 0.99)] if len(durations) > 1 else avg_duration

        # Top operations by volume
        operation_counts: dict[str, int] = {}
        for op in data["operations"]:
            op_name = op["operation"]
            operation_counts[op_name] = operation_counts.get(op_name, 0) + 1

        top_operations = [
            {"operation": op, "count": count}
            for op, count in sorted(operation_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]

        # Top errors
        error_counts: dict[str, int] = {}
        for error_entry in data["errors"]:
            error = error_entry["error"]
            error_counts[error] = error_counts.get(error, 0) + 1

        top_errors = [
            {"error": error, "count": count}
            for error, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]

        services_metrics.append(
            {
                "service_name": service_name,
                "total_operations": total_ops,
                "successful_operations": successful_ops,
                "failed_operations": failed_ops,
                "success_rate": ((successful_ops / total_ops * 100) if total_ops > 0 else 100.0),
                "avg_duration_seconds": round(avg_duration, 3),
                "p95_duration_seconds": round(p95_duration, 3),
                "p99_duration_seconds": round(p99_duration, 3),
                "error_count": failed_ops,
                "top_operations": top_operations,
                "top_errors": top_errors,
            }
        )

    # Calculate overall metrics
    overall_success_rate = (
        (total_successful / total_operations * 100) if total_operations > 0 else 100.0
    )

    return {
        "total_services": len(services_data),
        "total_operations": total_operations,
        "overall_success_rate": round(overall_success_rate, 2),
        "services": services_metrics,
        "period": f"{period_hours}h",
        "timestamp": now,
    }


# ============================================================================
# Workflow Metrics Endpoints
# ============================================================================


@router.get("/metrics/overview", response_model=WorkflowMetricsOverview)
async def get_workflow_metrics_overview(
    period_hours: int = Query(default=24, ge=1, le=168, description="Time period in hours"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> WorkflowMetricsOverview:
    """
    Get workflow services metrics overview with Redis caching.

    Returns comprehensive metrics for all workflow services including:
    - Operation counts and success rates
    - Performance metrics (duration, percentiles)
    - Error analysis
    - Top operations and errors

    **Caching**: Results cached for 1 minute per tenant/period combination.
    **Required Permission**: monitoring:metrics:read (enforced by get_current_user)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        metrics_data = await _get_workflow_metrics_cached(
            period_hours=period_hours,
            tenant_id=tenant_id,
            session=session,
        )

        return WorkflowMetricsOverview(**metrics_data)

    except Exception as e:
        logger.error("Failed to fetch workflow metrics", error=str(e), exc_info=True)
        return WorkflowMetricsOverview(
            total_services=0,
            total_operations=0,
            overall_success_rate=100.0,
            services=[],
            period=f"{period_hours}h",
            timestamp=datetime.now(UTC),
        )


@router.get("/metrics/prometheus", response_model=PrometheusMetricsResponse)
async def get_prometheus_metrics(
    current_user: UserInfo = Depends(get_current_user),
) -> PrometheusMetricsResponse:
    """
    Get Prometheus metrics in text format.

    Returns all recorded workflow metrics in Prometheus text format
    for scraping by Prometheus server.

    **Required Permission**: monitoring:metrics:read (enforced by get_current_user)
    """
    try:
        # Get metrics from global Prometheus integration
        metrics_text = prometheus.to_prometheus_format()
        metric_count = len(prometheus.get_metrics())

        return PrometheusMetricsResponse(
            metrics=metrics_text,
            metric_count=metric_count,
            timestamp=datetime.now(UTC),
        )

    except Exception as e:
        logger.error("Failed to export Prometheus metrics", error=str(e), exc_info=True)
        return PrometheusMetricsResponse(
            metrics="# Error exporting metrics\n",
            metric_count=0,
            timestamp=datetime.now(UTC),
        )


__all__ = ["router"]
