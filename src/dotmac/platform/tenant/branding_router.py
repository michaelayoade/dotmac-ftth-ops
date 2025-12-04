"""
Tenant-managed branding router for ISP Operations app.

Allows authenticated tenant administrators to fetch and update their
branding configuration (logos, colors, support details, etc.).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.platform_admin import has_platform_permission
from dotmac.platform.db import get_async_session

from .schemas import TenantBrandingResponse, TenantBrandingUpdate
from .service import TenantService

router = APIRouter(prefix="/branding", tags=["ISP - Branding"])

PLATFORM_TENANT_WRITE = "platform:tenants:write"
PLATFORM_TENANT_READ = "platform:tenants:read"


async def get_tenant_service(
    db: Annotated[AsyncSession, Depends(get_async_session)],
) -> TenantService:
    """Resolve tenant service dependency."""
    return TenantService(db)


def _is_tenant_admin(user: UserInfo) -> bool:
    """Return True if the user has a tenant-admin style role."""
    roles = {role.lower() for role in (user.roles or []) if isinstance(role, str)}
    return bool(roles & {"tenant_admin", "admin", "owner"})


async def require_tenant_member(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> UserInfo:
    """Ensure the current user belongs to a tenant."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Tenant context is required"
        )
    return current_user


async def require_tenant_admin_or_platform(
    current_user: Annotated[UserInfo, Depends(require_tenant_member)],
) -> UserInfo:
    """Allow tenant admins or platform operators."""
    if _is_tenant_admin(current_user):
        return current_user

    if has_platform_permission(current_user, PLATFORM_TENANT_WRITE):
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tenant administrator role is required for branding changes",
    )


@router.get("", response_model=TenantBrandingResponse)
async def get_tenant_branding(
    current_user: Annotated[UserInfo, Depends(require_tenant_member)],
    service: Annotated[TenantService, Depends(get_tenant_service)],
) -> TenantBrandingResponse:
    """Return branding configuration for the current tenant."""
    if has_platform_permission(current_user, PLATFORM_TENANT_READ) and not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant ID is required")

    # tenant_id is guaranteed to be non-None by require_tenant_member dependency
    assert current_user.tenant_id is not None
    return await service.get_tenant_branding(current_user.tenant_id)


@router.put("", response_model=TenantBrandingResponse)
async def update_tenant_branding(
    branding_update: TenantBrandingUpdate,
    current_user: Annotated[UserInfo, Depends(require_tenant_admin_or_platform)],
    service: Annotated[TenantService, Depends(get_tenant_service)],
) -> TenantBrandingResponse:
    """Update branding configuration for the current tenant."""
    # tenant_id is guaranteed to be non-None by require_tenant_admin_or_platform -> require_tenant_member dependency
    assert current_user.tenant_id is not None
    return await service.update_tenant_branding(current_user.tenant_id, branding_update)
