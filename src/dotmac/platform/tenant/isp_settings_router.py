"""
ISP Settings API Router.

REST API endpoints for managing ISP-specific configuration settings.
Provides full CRUD operations for settings with proper validation and RBAC.
"""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.rbac_dependencies import require_permissions
from dotmac.platform.database import get_async_session
from dotmac.platform.tenant.isp_settings_models import ISPSettings
from dotmac.platform.tenant.isp_settings_service import ISPSettingsError, ISPSettingsService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/isp-settings", tags=["ISP Settings"])


def _require_tenant_id(current_user: UserInfo) -> str:
    """Ensure current user has an associated tenant ID."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required for ISP settings operations",
        )
    return current_user.tenant_id


# ============================================================================
# Request/Response Schemas
# ============================================================================


class SettingsUpdateRequest(BaseModel):
    """Request to update ISP settings."""

    updates: dict[str, Any] = Field(
        ...,
        description="Partial settings updates (nested dict)",
    )
    validate_only: bool = Field(
        default=False,
        description="If true, only validate without saving",
    )


class SettingsUpdateResponse(BaseModel):
    """Response after updating settings."""

    success: bool
    settings: ISPSettings
    message: str


class SettingsSectionUpdateRequest(BaseModel):
    """Request to update a specific settings section."""

    updates: dict[str, Any] = Field(
        ...,
        description="Section-specific updates",
    )


class SettingsValidationRequest(BaseModel):
    """Request to validate settings schema."""

    settings: dict[str, Any] = Field(
        ...,
        description="Settings dictionary to validate",
    )


class SettingsValidationResponse(BaseModel):
    """Response from settings validation."""

    is_valid: bool
    errors: list[str] = Field(default_factory=list)


class SettingsImportRequest(BaseModel):
    """Request to import settings."""

    settings: dict[str, Any] = Field(
        ...,
        description="Settings dictionary to import",
    )
    validate_only: bool = Field(
        default=False,
        description="If true, only validate without saving",
    )


class SettingsMetadataResponse(BaseModel):
    """Metadata about settings configuration."""

    initial_setup_fields: list[str]
    runtime_changeable_fields: list[str]
    settings_version: int


# ============================================================================
# API Endpoints
# ============================================================================


@router.get(
    "",
    response_model=ISPSettings,
    summary="Get ISP Settings",
    description="Get complete ISP settings configuration for current tenant",
)
async def get_isp_settings(
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> ISPSettings:
    """Get ISP settings for current tenant."""
    service = ISPSettingsService(session)

    try:
        tenant_id = _require_tenant_id(current_user)
        settings = await service.get_settings(tenant_id)
        return settings
    except ISPSettingsError as exc:
        logger.error("Failed to get ISP settings", error=str(exc), tenant_id=current_user.tenant_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.user_message,
        ) from exc


@router.put(
    "",
    response_model=SettingsUpdateResponse,
    summary="Update ISP Settings",
    description="Update ISP settings (partial updates supported)",
    dependencies=[Depends(require_permissions("settings:write"))],
)
async def update_isp_settings(
    request: SettingsUpdateRequest,
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> SettingsUpdateResponse:
    """Update ISP settings for current tenant."""
    service = ISPSettingsService(session)

    try:
        tenant_id = _require_tenant_id(current_user)
        updated = await service.update_settings(
            tenant_id=tenant_id,
            updates=request.updates,
            validate_only=request.validate_only,
        )

        message = (
            "Settings validated successfully"
            if request.validate_only
            else "Settings updated successfully"
        )

        return SettingsUpdateResponse(
            success=True,
            settings=updated,
            message=message,
        )
    except ISPSettingsError as exc:
        logger.error(
            "Failed to update ISP settings", error=str(exc), tenant_id=current_user.tenant_id
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.user_message,
        ) from exc


@router.get(
    "/{section}",
    response_model=dict[str, Any],
    summary="Get Settings Section",
    description="Get a specific settings section (e.g., radius, network, portal)",
)
async def get_settings_section(
    section: str,
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Get specific settings section."""
    service = ISPSettingsService(session)

    try:
        tenant_id = _require_tenant_id(current_user)
        section_data = await service.get_setting_section(
            tenant_id=tenant_id,
            section=section,
        )
        return section_data
    except ISPSettingsError as exc:
        logger.error(
            "Failed to get settings section",
            error=str(exc),
            section=section,
            tenant_id=current_user.tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.user_message,
        ) from exc


@router.put(
    "/{section}",
    response_model=dict[str, Any],
    summary="Update Settings Section",
    description="Update a specific settings section",
    dependencies=[Depends(require_permissions("settings:write"))],
)
async def update_settings_section(
    section: str,
    request: SettingsSectionUpdateRequest,
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Update specific settings section."""
    service = ISPSettingsService(session)

    try:
        tenant_id = _require_tenant_id(current_user)
        updated_section = await service.update_setting_section(
            tenant_id=tenant_id,
            section=section,
            updates=request.updates,
        )
        return updated_section
    except ISPSettingsError as exc:
        logger.error(
            "Failed to update settings section",
            error=str(exc),
            section=section,
            tenant_id=current_user.tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.user_message,
        ) from exc


@router.post(
    "/validate",
    response_model=SettingsValidationResponse,
    summary="Validate Settings Schema",
    description="Validate settings against schema without saving",
)
async def validate_settings(
    request: SettingsValidationRequest,
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> SettingsValidationResponse:
    """Validate settings schema."""
    service = ISPSettingsService(session)

    is_valid, errors = await service.validate_settings_schema(request.settings)

    return SettingsValidationResponse(
        is_valid=is_valid,
        errors=errors,
    )


@router.post(
    "/reset",
    response_model=ISPSettings,
    summary="Reset Settings to Defaults",
    description="Reset all settings to default values",
    dependencies=[Depends(require_permissions("settings:write", "settings:reset"))],
)
async def reset_settings_to_defaults(
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
    confirm: bool = Query(
        False,
        description="Must be true to confirm reset",
    ),
) -> ISPSettings:
    """Reset settings to defaults."""
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must confirm reset by setting confirm=true query parameter",
        )

    service = ISPSettingsService(session)

    try:
        tenant_id = _require_tenant_id(current_user)
        defaults = await service.reset_to_defaults(tenant_id)
        logger.warning("Settings reset to defaults", tenant_id=tenant_id, user=current_user.email)
        return defaults
    except ISPSettingsError as exc:
        logger.error("Failed to reset settings", error=str(exc), tenant_id=current_user.tenant_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.user_message,
        ) from exc


@router.get(
    "/export",
    response_model=dict[str, Any],
    summary="Export Settings",
    description="Export current settings for backup or migration",
    dependencies=[Depends(require_permissions("settings:read"))],
)
async def export_settings(
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Export settings as dictionary."""
    service = ISPSettingsService(session)

    tenant_id = _require_tenant_id(current_user)
    settings_dict = await service.export_settings(tenant_id)
    logger.info("Settings exported", tenant_id=tenant_id, user=current_user.email)

    return settings_dict


@router.post(
    "/import",
    response_model=SettingsUpdateResponse,
    summary="Import Settings",
    description="Import settings from backup or migration",
    dependencies=[Depends(require_permissions("settings:write", "settings:import"))],
)
async def import_settings(
    request: SettingsImportRequest,
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> SettingsUpdateResponse:
    """Import settings from dictionary."""
    service = ISPSettingsService(session)

    try:
        tenant_id = _require_tenant_id(current_user)
        imported = await service.import_settings(
            tenant_id=tenant_id,
            settings_dict=request.settings,
            validate_only=request.validate_only,
        )

        message = (
            "Settings import validated successfully"
            if request.validate_only
            else "Settings imported successfully"
        )

        logger.info(
            "Settings imported",
            tenant_id=current_user.tenant_id,
            user=current_user.email,
            validate_only=request.validate_only,
        )

        return SettingsUpdateResponse(
            success=True,
            settings=imported,
            message=message,
        )
    except ISPSettingsError as exc:
        logger.error("Failed to import settings", error=str(exc), tenant_id=current_user.tenant_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.user_message,
        ) from exc


@router.get(
    "/metadata",
    response_model=SettingsMetadataResponse,
    summary="Get Settings Metadata",
    description="Get metadata about settings structure and constraints",
)
async def get_settings_metadata() -> SettingsMetadataResponse:
    """Get settings metadata."""
    return SettingsMetadataResponse(
        initial_setup_fields=ISPSettings.get_initial_setup_fields(),
        runtime_changeable_fields=ISPSettings.get_runtime_changeable_fields(),
        settings_version=1,
    )
