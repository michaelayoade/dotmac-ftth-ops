"""
Tenant authorization dependencies.

Provides FastAPI dependencies for tenant access control and validation.
"""

from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.core import UserInfo, get_current_user
from ..database import get_async_session
from .models import Tenant, TenantStatus
from .service import TenantNotFoundError, TenantService


def get_current_tenant_id() -> str | None:
    """Get current tenant ID from request context."""
    from . import _tenant_context, get_tenant_config

    tenant_id = _tenant_context.get()
    if tenant_id:
        return tenant_id

    # Fallback to default tenant in single-tenant mode
    config = get_tenant_config()
    if config.is_single_tenant:
        return config.default_tenant_id

    return None


async def get_tenant_service(db: AsyncSession = Depends(get_async_session)) -> TenantService:
    """Get tenant service instance."""
    return TenantService(db)


async def get_current_tenant(
    tenant_id: str | None = Depends(get_current_tenant_id),
    service: TenantService = Depends(get_tenant_service),
) -> Tenant:
    """
    Get current tenant from context.

    Retrieves the tenant based on the current request context.

    Raises:
        HTTPException: If tenant not found or not accessible
    """
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context not available. Ensure tenant middleware is configured.",
        )

    try:
        tenant = await service.get_tenant(tenant_id)
        return tenant
    except TenantNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant with ID '{tenant_id}' not found",
        )


async def require_active_tenant(
    tenant: Tenant = Depends(get_current_tenant),
) -> Tenant:
    """
    Require tenant to be in active status.

    Validates that the current tenant is active and not suspended.

    Raises:
        HTTPException: If tenant is not active
    """
    if tenant.status != TenantStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant is not active. Current status: {tenant.status.value}",
        )

    return tenant


async def require_trial_or_active_tenant(
    tenant: Tenant = Depends(get_current_tenant),
) -> Tenant:
    """
    Require tenant to be in trial or active status.

    Allows access for tenants in trial or active status.

    Raises:
        HTTPException: If tenant is suspended or inactive
    """
    if tenant.status not in [TenantStatus.ACTIVE, TenantStatus.TRIAL]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant access denied. Current status: {tenant.status.value}",
        )

    # Check if trial has expired
    if tenant.status == TenantStatus.TRIAL and tenant.trial_expired:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Trial period has expired. Please upgrade to continue.",
        )

    return tenant


async def check_tenant_feature(
    feature: str,
    tenant: Tenant = Depends(get_current_tenant),
) -> Tenant:
    """
    Check if tenant has a specific feature enabled.

    Args:
        feature: Feature name to check
        tenant: Current tenant

    Raises:
        HTTPException: If feature is not enabled
    """
    if not tenant.features.get(feature, False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Feature '{feature}' is not enabled for this tenant. Please upgrade your plan.",
        )

    return tenant


async def check_user_limit(
    tenant: Tenant = Depends(get_current_tenant),
) -> Tenant:
    """
    Check if tenant has not exceeded user limit.

    Raises:
        HTTPException: If user limit exceeded
    """
    if tenant.has_exceeded_user_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant has reached maximum user limit ({tenant.max_users}). Please upgrade your plan.",
        )

    return tenant


async def check_api_limit(
    tenant: Tenant = Depends(get_current_tenant),
) -> Tenant:
    """
    Check if tenant has not exceeded API call limit.

    Raises:
        HTTPException: If API limit exceeded
    """
    if tenant.has_exceeded_api_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Tenant has exceeded monthly API limit ({tenant.max_api_calls_per_month}). Please upgrade your plan.",
        )

    return tenant


async def check_storage_limit(
    tenant: Tenant = Depends(get_current_tenant),
) -> Tenant:
    """
    Check if tenant has not exceeded storage limit.

    Raises:
        HTTPException: If storage limit exceeded
    """
    if tenant.has_exceeded_storage_limit:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=f"Tenant has exceeded storage limit ({tenant.max_storage_gb} GB). Please upgrade your plan.",
        )

    return tenant


async def require_tenant_admin(
    current_user: UserInfo = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
) -> tuple[UserInfo, Tenant]:
    """
    Require user to be a tenant administrator.

    Validates that the current user has admin permissions for the tenant.

    Raises:
        HTTPException: If user is not a tenant admin
    """
    # Check if user has admin role for this tenant
    # This assumes roles/permissions are in user claims
    user_roles = current_user.roles if hasattr(current_user, "roles") else []

    if "tenant_admin" not in user_roles and "admin" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. Tenant admin role required.",
        )

    # Optionally verify tenant_id matches
    if hasattr(current_user, "tenant_id") and current_user.tenant_id != tenant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have access to this tenant",
        )

    return current_user, tenant


async def require_tenant_owner(
    current_user: UserInfo = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
) -> tuple[UserInfo, Tenant]:
    """
    Require user to be the tenant owner.

    Validates that the current user is the owner of the tenant.

    Raises:
        HTTPException: If user is not the tenant owner
    """
    # Check if user is the tenant creator/owner
    if tenant.created_by and tenant.created_by != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the tenant owner can perform this action",
        )

    return current_user, tenant


# Typed dependencies for cleaner usage
CurrentTenant = Annotated[Tenant, Depends(get_current_tenant)]
ActiveTenant = Annotated[Tenant, Depends(require_active_tenant)]
TrialOrActiveTenant = Annotated[Tenant, Depends(require_trial_or_active_tenant)]
TenantWithinUserLimit = Annotated[Tenant, Depends(check_user_limit)]
TenantWithinAPILimit = Annotated[Tenant, Depends(check_api_limit)]
TenantWithinStorageLimit = Annotated[Tenant, Depends(check_storage_limit)]
TenantAdminAccess = Annotated[tuple[UserInfo, Tenant], Depends(require_tenant_admin)]
TenantOwnerAccess = Annotated[tuple[UserInfo, Tenant], Depends(require_tenant_owner)]


# Feature-specific dependencies
def require_feature(feature_name: str) -> Any:
    """
    Create a dependency that checks for a specific feature.

    Usage:
        @router.get("/advanced-analytics")
        async def get_analytics(
            tenant: Tenant = Depends(require_feature("advanced_analytics"))
        ):
            ...
    """

    async def dependency(tenant: Tenant = Depends(get_current_tenant)) -> Tenant:
        if not tenant.features.get(feature_name, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_name}' is not enabled for this tenant",
            )
        return tenant

    return dependency


# Plan-specific dependencies
def require_plan(min_plan: str) -> Any:
    """
    Create a dependency that checks for minimum plan level.

    Usage:
        @router.post("/enterprise-feature")
        async def enterprise_feature(
            tenant: Tenant = Depends(require_plan("enterprise"))
        ):
            ...
    """
    from .models import TenantPlanType

    plan_hierarchy = {
        TenantPlanType.FREE: 0,
        TenantPlanType.STARTER: 1,
        TenantPlanType.PROFESSIONAL: 2,
        TenantPlanType.ENTERPRISE: 3,
        TenantPlanType.CUSTOM: 4,
    }

    async def dependency(tenant: Tenant = Depends(get_current_tenant)) -> Tenant:
        min_plan_enum = TenantPlanType(min_plan)
        if plan_hierarchy.get(tenant.plan_type, 0) < plan_hierarchy.get(min_plan_enum, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires at least {min_plan} plan. Current plan: {tenant.plan_type.value}",
            )
        return tenant

    return dependency
