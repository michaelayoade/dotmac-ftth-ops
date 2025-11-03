"""
Metrics API Router

FastAPI endpoints for ISP metrics and KPIs with permission enforcement.
"""

from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.auth.rbac_dependencies import PermissionChecker, require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.metrics.schemas import DashboardMetrics, SubscriberKPIs
from dotmac.platform.metrics.service import MetricsService
from dotmac.platform.redis_client import RedisClientType, get_redis_client

router = APIRouter(prefix="/metrics", tags=["Metrics"])


def _require_tenant_id(user: UserInfo) -> str:
    """Ensure the current user has an associated tenant identifier."""
    tenant_id = user.tenant_id
    if tenant_id is None:
        raise HTTPException(status_code=400, detail="Tenant context required")
    return tenant_id


def _require_metrics_permission(
    permission: str, aliases: tuple[str, ...]
) -> Callable[..., Awaitable[UserInfo]]:
    """Build a dependency that ensures callers have the requested metrics permission."""

    checker: PermissionChecker = require_permission(permission)

    async def dependency(
        current_user: UserInfo = Depends(get_current_user),
        db: AsyncSession = Depends(get_session_dependency),
    ) -> UserInfo:
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        perms = set(current_user.permissions or [])
        roles = set(current_user.roles or [])

        if is_platform_admin(current_user) or "admin" in roles:
            return current_user

        if any(alias in perms for alias in aliases):
            return current_user

        if "metrics:*" in perms or "metrics.*" in perms:
            return current_user

        return await checker(current_user=current_user, db=db)

    return dependency


require_metrics_read = _require_metrics_permission(
    "metrics.read",
    (
        "metrics.read",
        "metrics:read",
        "platform:metrics.read",
        "platform:metrics:read",
    ),
)

require_metrics_manage = _require_metrics_permission(
    "metrics.manage",
    (
        "metrics.manage",
        "metrics:manage",
        "platform:metrics.manage",
        "platform:metrics:manage",
    ),
)


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
    current_user: UserInfo = Depends(require_metrics_read),
) -> DashboardMetrics:
    """
    Get ISP dashboard metrics including:
    - Subscriber counts and growth
    - Network health and capacity
    - Support ticket SLAs
    - Revenue and collections

    Metrics are cached in Redis with 5-minute TTL for performance.
    """
    tenant_id = _require_tenant_id(current_user)
    return await service.get_dashboard_metrics(tenant_id)


@router.get(
    "/subscribers",
    response_model=SubscriberKPIs,
    summary="Get Subscriber KPIs",
    description="Get detailed subscriber metrics and trends",
)
async def get_subscriber_kpis(
    period: int = Query(30, ge=1, le=365, description="Period in days"),
    service: MetricsService = Depends(get_metrics_service),
    current_user: UserInfo = Depends(require_metrics_read),
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
    tenant_id = _require_tenant_id(current_user)
    return await service.get_subscriber_kpis(tenant_id, period_days=period)


@router.post(
    "/cache/invalidate",
    summary="Invalidate Metrics Cache",
    description="Force refresh of cached metrics for the current tenant",
)
async def invalidate_metrics_cache(
    service: MetricsService = Depends(get_metrics_service),
    current_user: UserInfo = Depends(require_metrics_manage),
) -> dict[str, str]:
    """
    Invalidate all cached metrics for the current tenant.

    Use this after bulk operations that would affect metrics
    (e.g., bulk subscriber import, mass suspensions).
    """
    tenant_id = _require_tenant_id(current_user)
    await service.invalidate_cache(tenant_id)
    return {"message": "Metrics cache invalidated successfully"}
