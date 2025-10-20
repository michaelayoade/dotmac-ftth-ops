"""
Metrics API Router

FastAPI endpoints for ISP metrics and KPIs.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.metrics.schemas import DashboardMetrics, SubscriberKPIs
from dotmac.platform.metrics.service import MetricsService
from dotmac.platform.redis_client import RedisClientType, get_redis_client

router = APIRouter(prefix="/metrics", tags=["Metrics"])


# =============================================================================
# Dependency: Get Metrics Service
# =============================================================================


async def get_metrics_service(
    session: AsyncSession = Depends(get_session_dependency),
    redis: RedisClientType = Depends(get_redis_client),
) -> MetricsService:
    """Get metrics service instance with Redis caching."""
    return MetricsService(session, redis_client=redis)


# =============================================================================
# Metrics Endpoints
# =============================================================================


@router.get(
    "/dashboard",
    response_model=DashboardMetrics,
    summary="Get Dashboard Metrics",
    description="Get aggregated ISP dashboard metrics (cached for 5 minutes)",
)
async def get_dashboard_metrics(
    service: MetricsService = Depends(get_metrics_service),
    current_user: UserInfo = Depends(get_current_user),
) -> DashboardMetrics:
    """
    Get ISP dashboard metrics including:
    - Subscriber counts and growth
    - Network health and capacity
    - Support ticket SLAs
    - Revenue and collections

    Metrics are cached in Redis with 5-minute TTL for performance.
    """
    return await service.get_dashboard_metrics(current_user.tenant_id)


@router.get(
    "/subscribers",
    response_model=SubscriberKPIs,
    summary="Get Subscriber KPIs",
    description="Get detailed subscriber metrics and trends",
)
async def get_subscriber_kpis(
    period: int = Query(30, ge=1, le=365, description="Period in days"),
    service: MetricsService = Depends(get_metrics_service),
    current_user: UserInfo = Depends(get_current_user),
) -> SubscriberKPIs:
    """
    Get detailed subscriber KPIs including:
    - Total, active, new, churned counts
    - Churn rate and net growth
    - Breakdown by plan and status
    - Daily activation trends

    Args:
        period: Number of days to include in metrics (default: 30)
    """
    return await service.get_subscriber_kpis(current_user.tenant_id, period_days=period)


@router.post(
    "/cache/invalidate",
    summary="Invalidate Metrics Cache",
    description="Force refresh of cached metrics for the current tenant",
)
async def invalidate_metrics_cache(
    service: MetricsService = Depends(get_metrics_service),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, str]:
    """
    Invalidate all cached metrics for the current tenant.

    Use this after bulk operations that would affect metrics
    (e.g., bulk subscriber import, mass suspensions).
    """
    await service.invalidate_cache(current_user.tenant_id)
    return {"message": "Metrics cache invalidated successfully"}
