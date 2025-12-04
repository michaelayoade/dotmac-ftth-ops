"""
Monitoring Metrics Router.

Provides comprehensive monitoring statistics endpoints for system health,
performance metrics, and observability data.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import ActivitySeverity, ActivityType, AuditActivity
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.cache import CacheTier, cached_result
from dotmac.platform.db import get_session_dependency

logger = structlog.get_logger(__name__)

# Cache TTL (in seconds)
MONITORING_STATS_CACHE_TTL = 300  # 5 minutes

router = APIRouter(prefix="/metrics/monitoring", tags=["Monitoring Metrics"])


# ============================================================================
# Response Models
# ============================================================================


class MonitoringMetricsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Monitoring metrics overview response."""

    model_config = ConfigDict(from_attributes=True)

    # System health
    error_rate: float = Field(description="Current error rate (%)")
    critical_errors: int = Field(description="Number of critical errors")
    warning_count: int = Field(description="Number of warnings")

    # Performance metrics
    avg_response_time_ms: float = Field(description="Average response time (ms)")
    p95_response_time_ms: float = Field(description="P95 response time (ms)")
    p99_response_time_ms: float = Field(description="P99 response time (ms)")

    # Request metrics
    total_requests: int = Field(description="Total requests processed")
    successful_requests: int = Field(description="Successful requests")
    failed_requests: int = Field(description="Failed requests")

    # Activity breakdown
    api_requests: int = Field(description="API request count")
    user_activities: int = Field(description="User activity count")
    system_activities: int = Field(description="System activity count")

    # Resource indicators
    high_latency_requests: int = Field(description="Requests with >1s latency")
    timeout_count: int = Field(description="Request timeouts")

    # Top errors
    top_errors: list[dict[str, Any]] = Field(description="Top 10 error types")

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


class LogStatsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Log statistics response."""

    model_config = ConfigDict(from_attributes=True)

    # Log counts by severity
    total_logs: int = Field(description="Total log entries")
    critical_logs: int = Field(description="Critical severity logs")
    high_logs: int = Field(description="High severity logs")
    medium_logs: int = Field(description="Medium severity logs")
    low_logs: int = Field(description="Low severity logs")

    # Activity types
    auth_logs: int = Field(description="Authentication logs")
    api_logs: int = Field(description="API activity logs")
    system_logs: int = Field(description="System logs")
    secret_logs: int = Field(description="Secret access logs")
    file_logs: int = Field(description="File operation logs")

    # Error analysis
    error_logs: int = Field(description="Error-level logs")
    unique_error_types: int = Field(description="Number of unique error types")
    most_common_errors: list[dict[str, Any]] = Field(description="Top 10 common errors")

    # User activity
    unique_users: int = Field(description="Number of unique users in logs")
    unique_ips: int = Field(description="Number of unique IP addresses")

    # Recent trends
    logs_last_hour: int = Field(description="Logs in last hour")
    logs_last_24h: int = Field(description="Logs in last 24 hours")

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


# ============================================================================
# Cached Helper Functions
# ============================================================================


@cached_result(  # type: ignore[misc]  # Cache decorator is untyped
    ttl=MONITORING_STATS_CACHE_TTL,
    key_prefix="monitoring:metrics",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_monitoring_metrics_cached(
    period_days: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for monitoring metrics calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)

    # Build base query
    base_query = select(AuditActivity).where(AuditActivity.created_at >= period_start)

    if tenant_id:
        base_query = base_query.where(AuditActivity.tenant_id == tenant_id)

    # Get all activities
    result = await session.execute(base_query)
    activities = result.scalars().all()

    total_requests = len(activities)

    # Count by severity
    critical_errors = sum(1 for a in activities if a.severity == ActivitySeverity.CRITICAL)
    warnings = sum(1 for a in activities if a.severity == ActivitySeverity.MEDIUM)

    # Count failed requests
    failed_requests = sum(
        1
        for a in activities
        if a.severity in [ActivitySeverity.HIGH, ActivitySeverity.CRITICAL]
        or "error" in a.action.lower()
        or "failed" in a.action.lower()
    )
    successful_requests = total_requests - failed_requests

    # Calculate error rate
    error_rate = (failed_requests / total_requests * 100) if total_requests > 0 else 0.0

    # Extract response times
    response_times = []
    high_latency_requests = 0
    timeout_count = 0

    for activity in activities:
        details = activity.details or {}
        if "duration" in details:
            duration = float(details["duration"])
            response_times.append(duration)

            if duration > 1000:  # >1s
                high_latency_requests += 1

        if "timeout" in str(details).lower():
            timeout_count += 1

    # Calculate percentiles
    if response_times:
        response_times.sort()
        count = len(response_times)
        avg_response_time = sum(response_times) / count
        p95_response_time = response_times[int(count * 0.95)] if count > 1 else response_times[-1]
        p99_response_time = response_times[int(count * 0.99)] if count > 1 else response_times[-1]
    else:
        avg_response_time = p95_response_time = p99_response_time = 0.0

    # Count by activity type
    api_requests = sum(1 for a in activities if a.activity_type == ActivityType.API_REQUEST)
    user_activities = sum(
        1
        for a in activities
        if a.activity_type
        in [
            ActivityType.USER_LOGIN,
            ActivityType.USER_LOGOUT,
            ActivityType.USER_CREATED,
            ActivityType.USER_UPDATED,
        ]
    )
    system_activities = sum(
        1
        for a in activities
        if a.activity_type in [ActivityType.SYSTEM_STARTUP, ActivityType.SYSTEM_SHUTDOWN]
    )

    # Top errors
    error_counts: dict[str, int] = {}
    for activity in activities:
        if activity.severity in [ActivitySeverity.HIGH, ActivitySeverity.CRITICAL]:
            error_type = activity.action
            error_counts[error_type] = error_counts.get(error_type, 0) + 1

    sorted_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)
    top_errors = [{"error": error, "count": count} for error, count in sorted_errors[:10]]

    return {
        "error_rate": round(error_rate, 2),
        "critical_errors": critical_errors,
        "warning_count": warnings,
        "avg_response_time_ms": round(avg_response_time, 2),
        "p95_response_time_ms": round(p95_response_time, 2),
        "p99_response_time_ms": round(p99_response_time, 2),
        "total_requests": total_requests,
        "successful_requests": successful_requests,
        "failed_requests": failed_requests,
        "api_requests": api_requests,
        "user_activities": user_activities,
        "system_activities": system_activities,
        "high_latency_requests": high_latency_requests,
        "timeout_count": timeout_count,
        "top_errors": top_errors,
        "period": f"{period_days}d",
        "timestamp": now,
    }


@cached_result(  # type: ignore[misc]  # Cache decorator is untyped
    ttl=MONITORING_STATS_CACHE_TTL,
    key_prefix="monitoring:logs:stats",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_log_stats_cached(
    period_days: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for log statistics calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)
    one_hour_ago = now - timedelta(hours=1)
    twenty_four_hours_ago = now - timedelta(hours=24)

    # Build base query
    base_query = select(AuditActivity).where(AuditActivity.created_at >= period_start)

    if tenant_id:
        base_query = base_query.where(AuditActivity.tenant_id == tenant_id)

    # Get all logs
    result = await session.execute(base_query)
    logs = result.scalars().all()

    total_logs = len(logs)

    # Count by severity
    critical_logs = sum(1 for log in logs if log.severity == ActivitySeverity.CRITICAL)
    high_logs = sum(1 for log in logs if log.severity == ActivitySeverity.HIGH)
    medium_logs = sum(1 for log in logs if log.severity == ActivitySeverity.MEDIUM)
    low_logs = sum(1 for log in logs if log.severity == ActivitySeverity.LOW)

    # Count by activity type category
    auth_logs = sum(
        1
        for log in logs
        if log.activity_type
        in [
            ActivityType.USER_LOGIN,
            ActivityType.USER_LOGOUT,
            ActivityType.USER_CREATED,
            ActivityType.USER_UPDATED,
        ]
    )
    api_logs = sum(
        1 for log in logs if log.activity_type in [ActivityType.API_REQUEST, ActivityType.API_ERROR]
    )
    system_logs = sum(
        1
        for log in logs
        if log.activity_type in [ActivityType.SYSTEM_STARTUP, ActivityType.SYSTEM_SHUTDOWN]
    )
    secret_logs = sum(
        1
        for log in logs
        if log.activity_type
        in [
            ActivityType.SECRET_ACCESSED,
            ActivityType.SECRET_CREATED,
            ActivityType.SECRET_UPDATED,
            ActivityType.SECRET_DELETED,
        ]
    )
    file_logs = sum(
        1
        for log in logs
        if log.activity_type
        in [ActivityType.FILE_UPLOADED, ActivityType.FILE_DOWNLOADED, ActivityType.FILE_DELETED]
    )

    # Error analysis
    error_logs = sum(
        1 for log in logs if log.severity in [ActivitySeverity.HIGH, ActivitySeverity.CRITICAL]
    )

    # Count unique error types
    unique_errors = set()
    error_type_counts: dict[str, int] = {}
    for log in logs:
        if log.severity in [ActivitySeverity.HIGH, ActivitySeverity.CRITICAL]:
            error_type = log.action
            unique_errors.add(error_type)
            error_type_counts[error_type] = error_type_counts.get(error_type, 0) + 1

    unique_error_types = len(unique_errors)

    # Most common errors
    sorted_errors = sorted(error_type_counts.items(), key=lambda x: x[1], reverse=True)
    most_common_errors = [{"error": error, "count": count} for error, count in sorted_errors[:10]]

    # User activity
    unique_users = len({log.user_id for log in logs if log.user_id})
    unique_ips = len({log.ip_address for log in logs if log.ip_address})

    # Recent trends
    logs_last_hour = sum(1 for log in logs if log.created_at >= one_hour_ago)
    logs_last_24h = sum(1 for log in logs if log.created_at >= twenty_four_hours_ago)

    return {
        "total_logs": total_logs,
        "critical_logs": critical_logs,
        "high_logs": high_logs,
        "medium_logs": medium_logs,
        "low_logs": low_logs,
        "auth_logs": auth_logs,
        "api_logs": api_logs,
        "system_logs": system_logs,
        "secret_logs": secret_logs,
        "file_logs": file_logs,
        "error_logs": error_logs,
        "unique_error_types": unique_error_types,
        "most_common_errors": most_common_errors,
        "unique_users": unique_users,
        "unique_ips": unique_ips,
        "logs_last_hour": logs_last_hour,
        "logs_last_24h": logs_last_24h,
        "period": f"{period_days}d",
        "timestamp": now,
    }


# ============================================================================
# Monitoring Metrics Endpoints
# ============================================================================


@router.get("/metrics", response_model=MonitoringMetricsResponse)
async def get_monitoring_metrics(
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> MonitoringMetricsResponse:
    """
    Get monitoring metrics overview with Redis caching.

    Returns comprehensive system health, performance, and activity metrics
    with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Rate Limit**: 100 requests per hour per IP.
    **Required Permission**: monitoring:metrics:read (enforced by get_current_user)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        stats_data = await _get_monitoring_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        )

        return MonitoringMetricsResponse(**stats_data)

    except Exception as e:
        logger.error("Failed to fetch monitoring metrics", error=str(e), exc_info=True)
        return MonitoringMetricsResponse(
            error_rate=0.0,
            critical_errors=0,
            warning_count=0,
            avg_response_time_ms=0.0,
            p95_response_time_ms=0.0,
            p99_response_time_ms=0.0,
            total_requests=0,
            successful_requests=0,
            failed_requests=0,
            api_requests=0,
            user_activities=0,
            system_activities=0,
            high_latency_requests=0,
            timeout_count=0,
            top_errors=[],
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


@router.get("/logs/stats", response_model=LogStatsResponse)
async def get_log_stats(
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> LogStatsResponse:
    """
    Get log statistics with Redis caching.

    Returns log counts by severity, activity type breakdown, and error analysis
    with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Rate Limit**: 100 requests per hour per IP.
    **Required Permission**: monitoring:logs:read (enforced by get_current_user)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        stats_data = await _get_log_stats_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        )

        return LogStatsResponse(**stats_data)

    except Exception as e:
        logger.error("Failed to fetch log stats", error=str(e), exc_info=True)
        return LogStatsResponse(
            total_logs=0,
            critical_logs=0,
            high_logs=0,
            medium_logs=0,
            low_logs=0,
            auth_logs=0,
            api_logs=0,
            system_logs=0,
            secret_logs=0,
            file_logs=0,
            error_logs=0,
            unique_error_types=0,
            most_common_errors=[],
            unique_users=0,
            unique_ips=0,
            logs_last_hour=0,
            logs_last_24h=0,
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


__all__ = ["router"]
