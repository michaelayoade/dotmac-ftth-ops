"""
Monitoring compatibility router.

Exposes frontend-friendly monitoring endpoints expected by the UI under
the /monitoring prefix (e.g. /monitoring/metrics and /monitoring/infrastructure/metrics).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.dependencies import CurrentUser, get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.monitoring.metrics_router import _get_monitoring_metrics_cached

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/monitoring", tags=["Monitoring - Compatibility"])


def _period_to_days(period: str | None) -> int:
    """Convert a period like 1h/24h/7d into days for metrics helpers."""
    if not period:
        return 1

    cleaned = period.strip().lower()
    if cleaned.endswith("h"):
        try:
            hours = int(cleaned[:-1] or 0)
            return max(1, hours // 24 or 1)
        except Exception:
            return 1

    if cleaned.endswith("d"):
        try:
            return max(1, int(cleaned[:-1] or 0))
        except Exception:
            return 1

    try:
        return max(1, int(cleaned))
    except Exception:
        return 1


def _build_infrastructure_metrics() -> dict[str, Any]:
    """Return synthetic infrastructure metrics compatible with the frontend interface."""
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
        "timestamp": datetime.now(UTC),
    }


@router.get("/metrics")
async def get_monitoring_metrics(
    period: str = Query("24h", description="Period for metrics aggregation (1h, 24h, 7d)"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Return monitoring metrics with camelCase keys expected by the frontend."""
    tenant_id = getattr(current_user, "tenant_id", None)
    stats_data = await _get_monitoring_metrics_cached(
        period_days=_period_to_days(period),
        tenant_id=tenant_id,
        session=session,
    )

    total_requests = int(stats_data.get("total_requests", 0) or 0)
    failed_requests = int(stats_data.get("failed_requests", 0) or 0)
    uptime_percent = (
        ((total_requests - failed_requests) / total_requests) * 100 if total_requests else 100.0
    )
    error_rate = float(stats_data.get("error_rate", 0.0) or 0.0)

    system_health = "healthy"
    if error_rate >= 5:
        system_health = "critical"
    elif error_rate >= 1:
        system_health = "degraded"

    return {
        "totalRequests": total_requests,
        "errorRate": error_rate,
        "avgResponseTimeMs": float(stats_data.get("avg_response_time_ms", 0.0) or 0.0),
        "p95ResponseTimeMs": float(stats_data.get("p95_response_time_ms", 0.0) or 0.0),
        "activeUsers": int(stats_data.get("user_activities", 0) or 0),
        "systemUptime": uptime_percent,
        "criticalErrors": int(stats_data.get("critical_errors", 0) or 0),
        "warningCount": int(stats_data.get("warning_count", 0) or 0),
        # Optional/legacy fields expected by UI components
        "requestsTimeSeries": [],
        "responseTimeTimeSeries": [],
        "errorRateTimeSeries": [],
        "systemHealth": system_health,
        "uptime": uptime_percent,
        "responseTime": float(stats_data.get("avg_response_time_ms", 0.0) or 0.0),
        "activeConnections": int(stats_data.get("api_requests", 0) or 0),
        "cpuUsage": 0.0,
        "memoryUsage": 0.0,
        "diskUsage": 0.0,
        "recentAlerts": [],
        "timestamp": datetime.now(UTC),
    }


@router.get("/infrastructure/metrics")
async def get_infrastructure_metrics(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Expose infrastructure metrics under /monitoring for frontend dashboards."""
    return _build_infrastructure_metrics()


__all__ = ["router"]
