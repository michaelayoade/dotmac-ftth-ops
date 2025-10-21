"""Tenant OSS configuration management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.tenant.oss_config import (
    OSSService,
    get_service_config,
    get_service_override,
    reset_service_config,
    update_service_config,
)
from dotmac.platform.tenant.oss_schemas import (
    OSSServiceConfigResponse,
    OSSServiceConfigUpdate,
)

router = APIRouter(prefix="/api/v1/tenant/oss", tags=["Tenant OSS"])


@router.get(
    "/{service}",
    response_model=OSSServiceConfigResponse,
    summary="Get OSS configuration",
    description="Retrieve the effective OSS configuration for the current tenant.",
)
async def get_oss_configuration(
    service: OSSService,
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
    _: UserInfo = Depends(require_permission("isp.oss.read")),
) -> OSSServiceConfigResponse:
    """Return merged OSS configuration (defaults + tenant overrides)."""
    user, tenant = tenant_access
    try:
        config = await get_service_config(session, tenant.id, service)
        overrides = await get_service_override(session, tenant.id, service)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return OSSServiceConfigResponse(
        service=service,
        config=config,
        overrides=overrides,
    )


@router.patch(
    "/{service}",
    response_model=OSSServiceConfigResponse,
    summary="Update OSS configuration",
    description="Apply tenant-specific overrides for OSS integration settings.",
)
async def update_oss_configuration(
    service: OSSService,
    payload: OSSServiceConfigUpdate,
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
    _: UserInfo = Depends(require_permission("isp.oss.configure")),
) -> OSSServiceConfigResponse:
    """Update tenant override values for an OSS integration."""
    _, tenant = tenant_access
    updates = payload.model_dump(exclude_unset=True)

    try:
        config = await update_service_config(session, tenant.id, service, updates)
        overrides = await get_service_override(session, tenant.id, service)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return OSSServiceConfigResponse(service=service, config=config, overrides=overrides)


@router.delete(
    "/{service}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reset OSS configuration",
    description="Remove tenant-specific overrides and fall back to defaults.",
)
async def reset_oss_configuration(
    service: OSSService,
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
    _: UserInfo = Depends(require_permission("isp.oss.configure")),
) -> None:
    """Delete tenant override values for an OSS integration."""
    _, tenant = tenant_access
    await reset_service_config(session, tenant.id, service)
