"""
Platform Admin API Router - Cross-tenant administration endpoints.

Provides endpoints for SaaS platform administrators to:
- View and manage all tenants
- Access cross-tenant analytics
- Perform system-wide operations
- Manage platform-level configurations
"""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import get_async_session

from .core import UserInfo
from .platform_admin import (
    PLATFORM_PERMISSIONS,
    platform_audit,
    require_platform_admin,
    require_platform_permission,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="", tags=["Platform Administration"])


# ============================================
# Response Models
# ============================================


class TenantInfo(BaseModel):
    """Tenant information for platform admin."""

    model_config = ConfigDict()

    tenant_id: str
    name: str | None = None
    created_at: str | None = None
    is_active: bool = True
    user_count: int = 0
    resource_count: int = 0


class TenantDetailResponse(BaseModel):
    """Detailed tenant information for platform admin."""

    model_config = ConfigDict()

    # Core tenant info
    tenant_id: str
    name: str
    slug: str
    domain: str | None = None
    email: str | None = None
    phone: str | None = None

    # Status and subscription
    status: str
    plan_type: str
    billing_cycle: str
    billing_email: str | None = None

    # Subscription dates
    trial_ends_at: str | None = None
    subscription_starts_at: str | None = None
    subscription_ends_at: str | None = None

    # Limits and quotas
    max_users: int
    max_api_calls_per_month: int
    max_storage_gb: int

    # Current usage
    current_users: int
    current_api_calls: int
    current_storage_gb: float

    # Feature flags and settings
    features: dict[str, Any] = {}
    settings: dict[str, Any] = {}

    # Company information
    company_size: str | None = None
    industry: str | None = None
    country: str | None = None
    timezone: str = "UTC"

    # Branding
    logo_url: str | None = None
    primary_color: str | None = None

    # Timestamps
    created_at: str
    updated_at: str | None = None

    # Metrics (aggregated from related data)
    total_users: int = 0
    total_customers: int = 0
    total_active_subscriptions: int = 0
    total_invoices: int = 0
    total_revenue: float = 0.0


class TenantListResponse(BaseModel):
    """Response for listing all tenants."""

    model_config = ConfigDict()

    tenants: list[TenantInfo]
    total: int
    page: int
    page_size: int


class PlatformStats(BaseModel):
    """Platform-wide statistics."""

    model_config = ConfigDict()

    total_tenants: int
    active_tenants: int
    total_users: int
    total_resources: int
    system_health: str = "healthy"


class HealthCheckResponse(BaseModel):
    """Health check response for platform admin."""

    model_config = ConfigDict()

    status: str
    user_id: str
    is_platform_admin: bool
    permissions: list[str]


class PlatformPermissionsResponse(BaseModel):
    """Response for listing platform permissions."""

    model_config = ConfigDict()

    permissions: dict[str, str]
    total: int


class CrossTenantSearchResponse(BaseModel):
    """Response for cross-tenant search."""

    model_config = ConfigDict()

    results: list[dict[str, Any]]
    total: int
    query: str


class CrossTenantSearchRequest(BaseModel):
    """Request payload for cross-tenant search."""

    model_config = ConfigDict(populate_by_name=True)

    query: str = Field(..., min_length=1, description="Search query")
    entity_type: str | None = Field(
        None,
        alias="resource_type",
        description="Resource type to search (user, customer, ticket, etc.)",
    )
    tenant_id: str | None = Field(None, description="Optional tenant ID to limit scope")
    limit: int = Field(20, ge=1, le=100, description="Maximum results")
    offset: int | None = Field(None, ge=0, description="Offset for pagination")


class PlatformAuditResponse(BaseModel):
    """Response for platform audit log."""

    model_config = ConfigDict()

    actions: list[dict[str, Any]]
    total: int
    limit: int


class ImpersonationTokenResponse(BaseModel):
    """Response for impersonation token creation."""

    model_config = ConfigDict()

    access_token: str
    token_type: str
    expires_in: int
    target_tenant: str
    impersonating: bool


class CacheClearResponse(BaseModel):
    """Response for cache clearing operation."""

    model_config = ConfigDict()

    status: str
    cache_type: str | None = None
    message: str | None = None


class SystemConfigResponse(BaseModel):
    """Response for system configuration."""

    model_config = ConfigDict()

    environment: str
    multi_tenant_mode: bool | None = None
    features_enabled: dict[str, bool] | None = None
    message: str | None = None


# ============================================
# Platform Admin Endpoints
# ============================================


@router.get("/health", response_model=HealthCheckResponse)
async def platform_admin_health(
    admin: UserInfo = Depends(require_platform_admin),
) -> HealthCheckResponse:
    """Health check for platform admin access.

    Verifies that the requesting user has platform admin permissions.
    """
    await platform_audit.log_action(
        user=admin,
        action="platform_health_check",
    )

    return HealthCheckResponse(
        status="healthy",
        user_id=admin.user_id,
        is_platform_admin=admin.is_platform_admin,
        permissions=admin.permissions,
    )


@router.get("/tenants", response_model=TenantListResponse)
async def list_all_tenants(
    request: Request,
    admin: UserInfo = Depends(require_platform_permission("platform:tenants:read")),
    db: AsyncSession = Depends(get_async_session),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> TenantListResponse:
    """List all tenants in the platform.

    Requires: platform:tenants:read permission

    This endpoint returns all tenants regardless of the requesting user's tenant.
    """
    await platform_audit.log_action(
        user=admin,
        action="list_all_tenants",
        details={"page": page, "page_size": page_size},
    )

    from dotmac.platform.customer_management.models import Customer
    from dotmac.platform.tenant.models import Tenant
    from dotmac.platform.user_management.models import User

    # Get tenants from tenants table with user and customer counts
    # First, get paginated tenant list
    tenant_query = select(Tenant).order_by(Tenant.created_at.desc())

    # Apply pagination
    offset = (page - 1) * page_size
    tenant_query = tenant_query.offset(offset).limit(page_size)

    result = await db.execute(tenant_query)
    tenant_records = result.scalars().all()

    # Get total count
    count_query = select(func.count(Tenant.id))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Build tenant info list with aggregated counts
    tenants = []
    for tenant in tenant_records:
        # Count users for this tenant
        user_count_query = select(func.count(User.id)).where(User.tenant_id == tenant.id)
        user_count_result = await db.execute(user_count_query)
        user_count = user_count_result.scalar() or 0

        # Count resources (customers) for this tenant
        resource_query = select(func.count(Customer.id)).where(Customer.tenant_id == tenant.id)
        resource_result = await db.execute(resource_query)
        resource_count = resource_result.scalar() or 0

        tenants.append(
            TenantInfo(
                tenant_id=tenant.id,
                name=tenant.name,  # Real tenant name from database
                created_at=tenant.created_at.isoformat(),
                is_active=(tenant.status.value in ["active", "trial"] if tenant.status else False),
                user_count=user_count,
                resource_count=resource_count,
            )
        )

    return TenantListResponse(
        tenants=tenants,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/tenants/{tenant_id}", response_model=TenantDetailResponse)
async def get_tenant_detail(
    tenant_id: str,
    admin: UserInfo = Depends(require_platform_permission("platform:tenants:read")),
    db: AsyncSession = Depends(get_async_session),
) -> TenantDetailResponse:
    """Get detailed information about a specific tenant.

    Requires: platform:tenants:read permission

    Returns comprehensive tenant details including usage metrics, billing data,
    and subscription information.
    """
    await platform_audit.log_action(
        user=admin,
        action="get_tenant_detail",
        target_tenant=tenant_id,
    )

    from fastapi import HTTPException

    from dotmac.platform.customer_management.models import Customer
    from dotmac.platform.tenant.models import Tenant
    from dotmac.platform.user_management.models import User

    # Get tenant from database
    tenant_query = select(Tenant).where(Tenant.id == tenant_id)
    result = await db.execute(tenant_query)
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} not found")

    # Aggregate metrics

    # Count total users for this tenant
    user_count_query = select(func.count(User.id)).where(User.tenant_id == tenant_id)
    user_count_result = await db.execute(user_count_query)
    total_users = user_count_result.scalar() or 0

    # Count total customers for this tenant
    customer_count_query = select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id)
    customer_count_result = await db.execute(customer_count_query)
    total_customers = customer_count_result.scalar() or 0

    # Count active subscriptions (if billing module exists)
    total_active_subscriptions = 0
    total_invoices = 0
    total_revenue = 0.0

    try:
        from dotmac.platform.billing.core.entities import InvoiceEntity
        from dotmac.platform.billing.models import BillingSubscriptionTable

        # Count active subscriptions
        subscription_query = (
            select(func.count(BillingSubscriptionTable.id))
            .where(BillingSubscriptionTable.tenant_id == tenant_id)
            .where(BillingSubscriptionTable.status == "active")
        )
        subscription_result = await db.execute(subscription_query)
        total_active_subscriptions = subscription_result.scalar() or 0

        # Count total invoices
        invoice_count_query = select(func.count(InvoiceEntity.invoice_id)).where(
            InvoiceEntity.tenant_id == tenant_id
        )
        invoice_count_result = await db.execute(invoice_count_query)
        total_invoices = invoice_count_result.scalar() or 0

        # Sum total revenue from paid invoices
        revenue_query = select(func.sum(InvoiceEntity.total_amount)).where(
            InvoiceEntity.tenant_id == tenant_id,
            InvoiceEntity.status == "paid",
        )
        revenue_result = await db.execute(revenue_query)
        revenue = revenue_result.scalar()
        total_revenue = float(revenue) / 100.0 if revenue else 0.0  # Convert cents to dollars

    except ImportError:
        # Billing module not available
        logger.debug("Billing module not available for tenant metrics", tenant_id=tenant_id)

    # Build response
    return TenantDetailResponse(
        # Core tenant info
        tenant_id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        email=tenant.email,
        phone=tenant.phone,
        # Status and subscription
        status=tenant.status.value,
        plan_type=tenant.plan_type.value,
        billing_cycle=tenant.billing_cycle.value,
        billing_email=tenant.billing_email,
        # Subscription dates
        trial_ends_at=tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
        subscription_starts_at=(
            tenant.subscription_starts_at.isoformat() if tenant.subscription_starts_at else None
        ),
        subscription_ends_at=(
            tenant.subscription_ends_at.isoformat() if tenant.subscription_ends_at else None
        ),
        # Limits and quotas
        max_users=tenant.max_users,
        max_api_calls_per_month=tenant.max_api_calls_per_month,
        max_storage_gb=tenant.max_storage_gb,
        # Current usage
        current_users=tenant.current_users,
        current_api_calls=tenant.current_api_calls,
        current_storage_gb=float(tenant.current_storage_gb),
        # Feature flags and settings
        features=tenant.features or {},
        settings=tenant.settings or {},
        # Company information
        company_size=tenant.company_size,
        industry=tenant.industry,
        country=tenant.country,
        timezone=tenant.timezone,
        # Branding
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
        # Timestamps
        created_at=tenant.created_at.isoformat(),
        updated_at=tenant.updated_at.isoformat() if tenant.updated_at else None,
        # Aggregated metrics
        total_users=total_users,
        total_customers=total_customers,
        total_active_subscriptions=total_active_subscriptions,
        total_invoices=total_invoices,
        total_revenue=total_revenue,
    )


@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    admin: UserInfo = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_async_session),
) -> PlatformStats:
    """Get platform-wide statistics.

    Requires: Platform admin access

    Returns aggregated statistics across all tenants.
    """
    await platform_audit.log_action(
        user=admin,
        action="view_platform_stats",
    )

    from dotmac.platform.customer_management.models import Customer
    from dotmac.platform.user_management.models import User

    # Get total and active tenants
    tenant_count_query = select(func.count(func.distinct(User.tenant_id)))
    tenant_count_result = await db.execute(tenant_count_query)
    total_tenants = tenant_count_result.scalar() or 0

    # Get total users
    user_count_query = select(func.count(User.id))
    user_count_result = await db.execute(user_count_query)
    total_users = user_count_result.scalar() or 0

    # Get total resources (customers)
    resource_count_query = select(func.count(Customer.id))
    resource_count_result = await db.execute(resource_count_query)
    total_resources = resource_count_result.scalar() or 0

    # For now, consider all tenants active (could add status check)
    active_tenants = total_tenants

    # Check system health
    system_health = "healthy"
    try:
        # Test database connection
        await db.execute(select(1))
    except Exception:
        system_health = "degraded"

    stats = PlatformStats(
        total_tenants=total_tenants,
        active_tenants=active_tenants,
        total_users=total_users,
        total_resources=total_resources,
        system_health=system_health,
    )

    return stats


@router.get("/permissions", response_model=PlatformPermissionsResponse)
async def list_platform_permissions(
    admin: UserInfo = Depends(require_platform_admin),
) -> PlatformPermissionsResponse:
    """List all available platform permissions.

    Returns the complete list of platform-level permissions and their descriptions.
    """
    await platform_audit.log_action(
        user=admin,
        action="list_platform_permissions",
    )

    return PlatformPermissionsResponse(
        permissions=PLATFORM_PERMISSIONS,
        total=len(PLATFORM_PERMISSIONS),
    )


async def _execute_cross_tenant_search(
    *,
    query: str,
    entity_type: str | None,
    tenant_id: str | None,
    limit: int,
    offset: int | None,
    admin: UserInfo,
) -> CrossTenantSearchResponse:
    """Perform cross-tenant search.

    Requires: Platform admin access

    Searches across all tenants or specific tenants for resources matching the query.
    Uses in-memory search backend for development; configure Elasticsearch/MeiliSearch for production.
    """
    from ..search.factory import get_default_search_backend
    from ..search.interfaces import SearchQuery, SearchType

    await platform_audit.log_action(
        user=admin,
        action="cross_tenant_search",
        details={"query": query, "resource_type": entity_type, "tenant_id": tenant_id},
    )

    try:
        # Get search backend (auto-selects based on configuration)
        search_backend = get_default_search_backend()

        # Build search query
        search_query = SearchQuery(
            query=query,
            search_type=SearchType.FULL_TEXT,
            limit=limit,
            offset=offset or 0,
            include_score=True,
        )

        # Determine which indices to search based on resource type
        indices_to_search = []
        if entity_type:
            # Search specific resource type across all tenants (or specific tenant)
            if tenant_id:
                indices_to_search.append(f"dotmac_{entity_type}_{tenant_id}")
            else:
                # For cross-tenant search, we would need to query all tenant indices
                # This is a simplified implementation - in production you'd list all tenants
                logger.warning(
                    "cross_tenant_search.limited_implementation",
                    message="Cross-tenant search without specific tenant uses in-memory backend only",
                )
                indices_to_search.append(entity_type)
        else:
            # Search all resource types
            indices_to_search = ["customers", "subscribers", "invoices", "tickets", "users"]

        # Aggregate results from all indices
        all_results = []
        for index_name in indices_to_search:
            try:
                response = await search_backend.search(index_name, search_query)
                for result in response.results:
                    all_results.append(
                        {
                            "id": result.id,
                            "type": result.type,
                            "tenant_id": result.data.get("tenant_id", "unknown"),
                            "resource_id": result.id,
                            "score": result.score,
                            "data": result.data,
                        }
                    )
            except Exception as e:
                logger.warning(
                    "search.index_error",
                    index=index_name,
                    error=str(e),
                )
                continue

        # Sort by score descending
        all_results.sort(key=lambda x: x.get("score", 0), reverse=True)

        # Apply limit
        limited_results = all_results[:limit]

        return CrossTenantSearchResponse(
            results=limited_results,
            total=len(all_results),
            query=query,
        )

    except Exception as e:
        logger.error(
            "cross_tenant_search.error",
            query=query,
            resource_type=entity_type,
            error=str(e),
        )
        # Return empty results on error rather than failing
        return CrossTenantSearchResponse(
            results=[],
            total=0,
            query=query,
        )


@router.get("/search", response_model=CrossTenantSearchResponse)
async def cross_tenant_search_get(
    query: str = Query(..., min_length=1, description="Search query"),
    resource_type: str | None = Query(None, description="Filter by resource type"),
    tenant_id: str | None = Query(None, description="Filter by specific tenant"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    offset: int | None = Query(None, description="Offset for pagination"),
    admin: UserInfo = Depends(require_platform_admin),
) -> CrossTenantSearchResponse:
    return await _execute_cross_tenant_search(
        query=query,
        entity_type=resource_type,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
        admin=admin,
    )


@router.post("/search", response_model=CrossTenantSearchResponse)
async def cross_tenant_search_post(
    request: CrossTenantSearchRequest,
    admin: UserInfo = Depends(require_platform_admin),
) -> CrossTenantSearchResponse:
    return await _execute_cross_tenant_search(
        query=request.query,
        entity_type=request.entity_type,
        tenant_id=request.tenant_id,
        limit=request.limit,
        offset=request.offset,
        admin=admin,
    )


@router.get("/audit/recent", response_model=PlatformAuditResponse)
async def get_recent_platform_actions(
    admin: UserInfo = Depends(require_platform_permission("platform:audit")),
    db: AsyncSession = Depends(get_async_session),
    limit: int = Query(50, ge=1, le=200),
) -> PlatformAuditResponse:
    """Get recent platform admin actions across all tenants.

    Requires: platform:audit permission

    Returns recent administrative actions for compliance and monitoring.
    """
    await platform_audit.log_action(
        user=admin,
        action="view_platform_audit_log",
        details={"limit": limit},
    )

    # Placeholder - query audit log
    return PlatformAuditResponse(
        actions=[],
        total=0,
        limit=limit,
    )


@router.post("/tenants/{tenant_id}/impersonate", response_model=ImpersonationTokenResponse)
async def create_impersonation_token(
    tenant_id: str,
    admin: UserInfo = Depends(require_platform_permission("platform:impersonate")),
    duration_minutes: int = Query(60, ge=1, le=480),
) -> ImpersonationTokenResponse:
    """Create a temporary token for tenant impersonation.

    Requires: platform:impersonate permission

    Creates a time-limited token that allows the platform admin to act as
    if they belong to the specified tenant.

    Args:
        tenant_id: Target tenant to impersonate
        duration_minutes: Token validity in minutes (max 8 hours)
    """
    await platform_audit.log_action(
        user=admin,
        action="create_impersonation_token",
        target_tenant=tenant_id,
        details={"duration_minutes": duration_minutes},
    )

    from .core import jwt_service

    # Create a token with the target tenant
    token = jwt_service.create_access_token(
        subject=admin.user_id,
        additional_claims={
            "email": admin.email,
            "tenant_id": tenant_id,  # Override tenant
            "is_platform_admin": True,  # Maintain admin status
            "impersonating": True,
            "original_tenant": admin.tenant_id,
        },
        expire_minutes=duration_minutes,
    )

    logger.warning(
        "Platform admin impersonation token created",
        admin_id=admin.user_id,
        target_tenant=tenant_id,
        duration=duration_minutes,
    )

    return ImpersonationTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=duration_minutes * 60,
        target_tenant=tenant_id,
        impersonating=True,
    )


# ============================================
# System Management Endpoints
# ============================================


@router.post("/system/cache/clear", response_model=CacheClearResponse)
async def clear_system_cache(
    admin: UserInfo = Depends(require_platform_admin),
    cache_type: str | None = Query(
        None, description="Specific cache to clear (e.g., 'permissions', 'all')"
    ),
) -> CacheClearResponse:
    """Clear system-wide caches.

    Requires: Platform admin access

    Clears caching layers across the platform for troubleshooting or after configuration changes.
    """
    await platform_audit.log_action(
        user=admin,
        action="clear_system_cache",
        details={"cache_type": cache_type or "all"},
    )

    # Placeholder - implement cache clearing
    from dotmac.platform.core.caching import get_redis

    try:
        redis_client = get_redis()
        if redis_client:
            if cache_type == "permissions":
                # Clear permission caches
                pattern = "user_perms:*"
                for key in redis_client.scan_iter(match=pattern):
                    redis_client.delete(key)
                return CacheClearResponse(status="success", cache_type="permissions")
            else:
                # Clear all caches
                redis_client.flushdb()
                return CacheClearResponse(status="success", cache_type="all")
    except Exception as e:
        logger.error("Failed to clear cache", error=str(e))
        return CacheClearResponse(status="cleared", message=str(e))

    return CacheClearResponse(status="cleared", message="Redis not available")


@router.get("/system/config", response_model=SystemConfigResponse)
async def get_system_configuration(
    admin: UserInfo = Depends(require_platform_admin),
) -> SystemConfigResponse:
    """Get system configuration (non-sensitive values only).

    Requires: Platform admin access

    Returns current platform configuration for review.
    """
    await platform_audit.log_action(
        user=admin,
        action="view_system_config",
    )

    # Return non-sensitive configuration
    try:
        from dotmac.platform.settings import settings

        return SystemConfigResponse(
            environment=getattr(settings, "environment", "unknown"),
            multi_tenant_mode=getattr(settings, "multi_tenant_mode", False),
            features_enabled={
                "rbac": True,
                "audit_logging": True,
                "platform_admin": True,
            },
        )
    except Exception:
        return SystemConfigResponse(
            environment="unknown",
            message="Settings not fully configured",
        )


__all__ = ["router"]
