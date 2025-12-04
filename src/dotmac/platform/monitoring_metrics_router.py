"""
Monitoring and Metrics Router.

Provides endpoints for system observability, error monitoring, and performance metrics.
"""

from datetime import UTC, datetime, timedelta

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency

logger = structlog.get_logger(__name__)

# Create separate routers for logs and metrics
# Note: prefix is set during router registration in routers.py
logs_router = APIRouter(prefix="/logs", tags=["Logs"])
metrics_router = APIRouter(prefix="/metrics", tags=["Metrics"])


# ========================================
# Logs Endpoints
# ========================================


class ErrorRateResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Error rate monitoring response."""

    model_config = ConfigDict()

    rate: float
    total_requests: int
    error_count: int
    time_window: str
    timestamp: str


@logs_router.get("/error-rate", response_model=ErrorRateResponse)
async def get_error_rate(
    window_minutes: int = Query(default=60, description="Time window in minutes"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> ErrorRateResponse:
    """
    Get current error rate from application logs.

    Calculates error rate as percentage of failed requests.
    """
    try:
        from dotmac.platform.audit.models import AuditActivity

        # Calculate time window
        now = datetime.now(UTC)
        window_start = now - timedelta(minutes=window_minutes)

        # Query audit logs for errors
        error_query = select(func.count(AuditActivity.id)).where(
            and_(
                AuditActivity.created_at >= window_start,
                AuditActivity.severity.in_(["ERROR", "CRITICAL"]),
            )
        )

        total_query = select(func.count(AuditActivity.id)).where(
            AuditActivity.created_at >= window_start
        )

        error_result = await session.execute(error_query)
        total_result = await session.execute(total_query)

        error_count = error_result.scalar() or 0
        total_requests = total_result.scalar() or 0

        # Calculate error rate
        if total_requests > 0:
            rate = (error_count / total_requests) * 100
        else:
            rate = 0.0

        return ErrorRateResponse(
            rate=round(rate, 2),
            total_requests=total_requests,
            error_count=error_count,
            time_window=f"{window_minutes}m",
            timestamp=now.isoformat(),
        )

    except Exception as e:
        logger.error("Failed to fetch error rate", error=str(e), exc_info=True)
        # Return safe default values
        return ErrorRateResponse(
            rate=0.0,
            total_requests=0,
            error_count=0,
            time_window=f"{window_minutes}m",
            timestamp=datetime.now(UTC).isoformat(),
        )


# ========================================
# Metrics Endpoints
# ========================================


class LatencyMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """API latency metrics response."""

    model_config = ConfigDict()

    p50: float
    p95: float
    p99: float
    average: float
    max: float
    min: float
    time_window: str
    timestamp: str


@metrics_router.get("/latency", response_model=LatencyMetrics)
async def get_latency_metrics(
    window_minutes: int = Query(default=60, description="Time window in minutes"),
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> LatencyMetrics:
    """
    Get API latency metrics including percentiles.

    Returns P50, P95, P99 latency measurements from audit activities.
    Note: Returns zeros if no latency data is available in metadata.
    """
    try:
        from dotmac.platform.audit.models import AuditActivity

        # Calculate time window
        now = datetime.now(UTC)
        window_start = now - timedelta(minutes=window_minutes)

        # Query audit activities with duration in details
        query = select(AuditActivity.details).where(
            and_(
                AuditActivity.created_at >= window_start,
                AuditActivity.details.isnot(None),
            )
        )

        result = await session.execute(query)
        details_list = result.scalars().all()

        # Extract duration values
        durations = []
        for details in details_list:
            if details and isinstance(details, dict) and "duration" in details:
                durations.append(float(details["duration"]))

        if durations:
            durations.sort()
            count = len(durations)

            p50 = durations[int(count * 0.50)]
            p95 = durations[int(count * 0.95)]
            p99 = durations[int(count * 0.99)] if count > 1 else durations[-1]
            average = sum(durations) / count
            max_latency = max(durations)
            min_latency = min(durations)
        else:
            # No latency data available
            p50 = p95 = p99 = average = max_latency = min_latency = 0.0

        return LatencyMetrics(
            p50=round(p50, 2),
            p95=round(p95, 2),
            p99=round(p99, 2),
            average=round(average, 2),
            max=round(max_latency, 2),
            min=round(min_latency, 2),
            time_window=f"{window_minutes}m",
            timestamp=now.isoformat(),
        )

    except Exception as e:
        logger.error("Failed to fetch latency metrics", error=str(e), exc_info=True)
        return LatencyMetrics(
            p50=0.0,
            p95=0.0,
            p99=0.0,
            average=0.0,
            max=0.0,
            min=0.0,
            time_window=f"{window_minutes}m",
            timestamp=datetime.now(UTC).isoformat(),
        )


class ResourceMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """System resource metrics response."""

    model_config = ConfigDict()

    cpu: float
    memory: float
    disk: float
    network_in: float
    network_out: float
    timestamp: str


@metrics_router.get("/resources", response_model=ResourceMetrics)
async def get_resource_metrics(
    current_user: UserInfo = Depends(get_current_user),
) -> ResourceMetrics:
    """
    Get system resource utilization metrics using psutil.

    Returns real-time CPU, memory, disk, and network usage.
    """
    try:
        import psutil

        # Get CPU usage (1 second interval for accuracy)
        cpu_percent = psutil.cpu_percent(interval=1)

        # Get memory usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent

        # Get disk usage for root partition
        disk = psutil.disk_usage("/")
        disk_percent = disk.percent

        # Get network I/O counters
        net_io = psutil.net_io_counters()
        # Convert bytes to MB/s (approximate since we don't track time delta)
        network_in_mb = net_io.bytes_recv / (1024 * 1024)
        network_out_mb = net_io.bytes_sent / (1024 * 1024)

        return ResourceMetrics(
            cpu=round(cpu_percent, 2),
            memory=round(memory_percent, 2),
            disk=round(disk_percent, 2),
            network_in=round(network_in_mb, 2),
            network_out=round(network_out_mb, 2),
            timestamp=datetime.now(UTC).isoformat(),
        )

    except Exception as e:
        logger.error("Failed to fetch resource metrics", error=str(e), exc_info=True)
        return ResourceMetrics(
            cpu=0.0,
            memory=0.0,
            disk=0.0,
            network_in=0.0,
            network_out=0.0,
            timestamp=datetime.now(UTC).isoformat(),
        )


__all__ = ["logs_router", "metrics_router"]
