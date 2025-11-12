"""
Tenant management API router.

Provides REST endpoints for tenant CRUD operations, settings, usage tracking,
and invitation management.
"""

import math
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.tenant.oss_config import OSSService, update_service_config

from ..auth.core import UserInfo, get_current_user
from ..auth.platform_admin import (
    has_platform_permission,
    is_platform_admin,
    require_platform_permission,
)
from ..database import get_async_session
from .models import Tenant, TenantInvitationStatus, TenantPlanType, TenantStatus
from .provisioning_service import (
    TenantProvisioningConflictError,
    TenantProvisioningJobNotFoundError,
    TenantProvisioningService,
)
from .provisioning_tasks import enqueue_tenant_provisioning
from .schemas import (
    TenantBulkDeleteRequest,
    TenantBulkStatusUpdate,
    TenantCreate,
    TenantFeatureUpdate,
    TenantInvitationAccept,
    TenantInvitationCreate,
    TenantInvitationResponse,
    TenantListResponse,
    TenantMetadataUpdate,
    TenantProvisioningJobCreate,
    TenantProvisioningJobListResponse,
    TenantProvisioningJobResponse,
    TenantResponse,
    TenantSettingCreate,
    TenantSettingResponse,
    TenantStatsResponse,
    TenantUpdate,
    TenantUsageCreate,
    TenantUsageResponse,
)
from .service import (
    TenantAlreadyExistsError,
    TenantNotFoundError,
    TenantService,
)

logger = structlog.get_logger(__name__)

# Explicit prefix to avoid double-registration warnings during FastAPI startup
router = APIRouter(prefix="/tenants", tags=["Tenant Management"])


# Dependency to get tenant service
async def get_tenant_service(db: AsyncSession = Depends(get_async_session)) -> TenantService:
    """Get tenant service instance."""
    return TenantService(db)


async def get_tenant_provisioning_service(
    db: AsyncSession = Depends(get_async_session),
) -> TenantProvisioningService:
    """Get provisioning service instance."""
    return TenantProvisioningService(db)


TENANT_READ_PERMISSION = "platform:tenants:read"
TENANT_WRITE_PERMISSION = "platform:tenants:write"


def _can_view_sensitive_tenant_data(user: UserInfo) -> bool:
    """Determine if the user can see sensitive tenant settings/metadata."""
    if is_platform_admin(user) or has_platform_permission(user, TENANT_READ_PERMISSION):
        return True

    # Accept legacy alias permissions
    user_permissions = set(user.permissions or [])
    if "tenants:read" in user_permissions or "tenants:*" in user_permissions:
        return True

    return False


def _build_tenant_response(
    tenant: TenantResponse | Tenant,
    *,
    include_sensitive: bool,
) -> TenantResponse:
    """Normalize tenant response while optionally removing sensitive blobs."""
    if isinstance(tenant, TenantResponse):
        response = tenant
    else:
        response = TenantResponse.model_validate(tenant)

    response.is_trial = getattr(tenant, "is_trial", response.is_trial)  # type: ignore[misc]
    response.is_active = getattr(tenant, "status_is_active", response.is_active)  # type: ignore[misc]
    response.trial_expired = getattr(tenant, "trial_expired", response.trial_expired)  # type: ignore[misc]
    response.has_exceeded_user_limit = getattr(  # type: ignore[misc]
        tenant, "has_exceeded_user_limit", response.has_exceeded_user_limit
    )
    response.has_exceeded_api_limit = getattr(  # type: ignore[misc]
        tenant, "has_exceeded_api_limit", response.has_exceeded_api_limit
    )
    response.has_exceeded_storage_limit = getattr(  # type: ignore[misc]
        tenant, "has_exceeded_storage_limit", response.has_exceeded_storage_limit
    )

    if not include_sensitive:
        # Strip potentially sensitive blobs (may contain secrets/API keys).
        response.settings = {}  # type: ignore[misc]
        response.custom_metadata = {}  # type: ignore[misc]

    return response


def _ensure_can_read_tenant(user: UserInfo, tenant_id: str) -> None:
    """Validate that the current user can view the requested tenant."""
    if tenant_id == user.tenant_id:
        return
    user_permissions = set(user.permissions or [])
    if is_platform_admin(user) or has_platform_permission(user, TENANT_READ_PERMISSION):
        return
    # Allow legacy aliases used in older tests/clients
    if "tenants:read" in user_permissions or "tenants:*" in user_permissions:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions to access this tenant.",
    )


def _ensure_can_write_tenant(user: UserInfo, tenant_id: str) -> None:
    """Validate that the current user can mutate the requested tenant."""
    if tenant_id == user.tenant_id:
        return
    user_permissions = set(user.permissions or [])
    if is_platform_admin(user) or has_platform_permission(user, TENANT_WRITE_PERMISSION):
        return
    # Allow legacy aliases used in older tests/clients
    if "tenants:write" in user_permissions or "tenants:*" in user_permissions:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions to modify this tenant.",
    )


def _has_tenant_admin_role(user: UserInfo) -> bool:
    """Return True if the user has a tenant admin style role."""
    roles = {role.lower() for role in (user.roles or []) if isinstance(role, str)}
    return bool(roles & {"tenant_admin", "admin", "owner"})


def _user_can_view_sensitive_tenant_data(user: UserInfo, tenant_id: str) -> bool:
    """
    Determine whether the requester may view sensitive tenant metadata.

    Platform administrators and holders of the explicit platform permission retain access.
    Within a tenant, only users with an admin-style role may view secrets.
    """
    if is_platform_admin(user) or has_platform_permission(user, TENANT_READ_PERMISSION):
        return True

    permissions = set(user.permissions or [])
    if "tenants:*" in permissions or "tenants:read" in permissions:
        return True

    return user.tenant_id == tenant_id and _has_tenant_admin_role(user)


def require_tenant_permission(permission: str) -> Callable[..., Awaitable[UserInfo]]:
    """Wrapper dependency that honours legacy tenant:* permission aliases."""

    platform_checker = require_platform_permission(permission)

    async def checker(current_user: UserInfo = Depends(get_current_user)) -> UserInfo:
        perms = set(current_user.permissions or [])
        alias = None
        if permission == TENANT_READ_PERMISSION:
            alias = "tenants:read"
        elif permission == TENANT_WRITE_PERMISSION:
            alias = "tenants:write"

        if alias and (alias in perms or "tenants:*" in perms):
            return current_user
        return await platform_checker(current_user)

    return checker


# Tenant CRUD Operations
@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    current_user: UserInfo = Depends(require_tenant_permission(TENANT_WRITE_PERMISSION)),
    service: TenantService = Depends(get_tenant_service),
    session: AsyncSession = Depends(get_async_session),
) -> TenantResponse:
    """
    Create a new tenant organization.

    Creates a new tenant with initial configuration, trial period, and default features.
    """
    try:
        # Extract OSS overrides before persisting tenant
        oss_overrides = tenant_data.oss_config or {}
        tenant_payload = tenant_data.model_dump(exclude={"oss_config"})

        tenant = await service.create_tenant(
            TenantCreate(**tenant_payload), created_by=current_user.user_id
        )

        if oss_overrides:
            for service_name, overrides in oss_overrides.items():
                service_enum = OSSService(service_name)
                await update_service_config(session, tenant.id, service_enum, overrides)

        return _build_tenant_response(tenant, include_sensitive=True)
    except TenantAlreadyExistsError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("", response_model=TenantListResponse)
async def list_tenants(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: TenantStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    plan_type: TenantPlanType | None = Query(None, description="Filter by plan type"),
    search: str | None = Query(None, description="Search in name, slug, email"),
    include_deleted: bool = Query(False, description="Include soft-deleted tenants"),
    current_user: UserInfo = Depends(require_tenant_permission(TENANT_READ_PERMISSION)),
    service: TenantService = Depends(get_tenant_service),
) -> TenantListResponse:
    """
    List all tenants with pagination and filtering.

    Supports filtering by status, plan type, and text search.
    """
    tenants, total = await service.list_tenants(
        page=page,
        page_size=page_size,
        status=status_filter,
        plan_type=plan_type,
        search=search,
        include_deleted=include_deleted,
    )

    # Convert to response models
    tenant_responses = [
        _build_tenant_response(tenant, include_sensitive=True) for tenant in tenants
    ]

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return TenantListResponse(
        items=tenant_responses, total=total, page=page, page_size=page_size, total_pages=total_pages
    )


@router.get("/current", response_model=TenantResponse | None)
async def get_current_tenant(
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantResponse | None:
    """
    Get the current user's tenant.

    Returns the tenant associated with the authenticated user's tenant_id.
    Returns null if the user is not associated with any tenant.
    """
    if not current_user.tenant_id:
        # Return null instead of 404 to allow frontend to handle gracefully
        return None

    try:
        tenant = await service.get_tenant(current_user.tenant_id)
    except TenantNotFoundError:
        logger.info(
            "tenant.current_not_found",
            tenant_id=current_user.tenant_id,
            user_id=current_user.user_id,
        )
        return None
    except Exception as exc:  # pragma: no cover - defensive guard for unexpected errors
        logger.exception(
            "tenant.current_fetch_error",
            tenant_id=current_user.tenant_id,
            user_id=current_user.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load current tenant",
        ) from exc

    include_sensitive = _user_can_view_sensitive_tenant_data(current_user, tenant.id)
    return _build_tenant_response(tenant, include_sensitive=include_sensitive)


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantResponse:
    """
    Get a specific tenant by ID.

    Returns detailed tenant information including usage, limits, and configuration.
    """
    try:
        _ensure_can_read_tenant(current_user, tenant_id)
        tenant = await service.get_tenant(tenant_id)
        include_sensitive = _user_can_view_sensitive_tenant_data(current_user, tenant.id)
        return _build_tenant_response(tenant, include_sensitive=include_sensitive)
    except TenantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/slug/{slug}", response_model=TenantResponse)
async def get_tenant_by_slug(
    slug: str,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantResponse:
    """
    Get a tenant by slug.

    Retrieve tenant information using the URL-friendly slug identifier.
    """
    try:
        tenant = await service.get_tenant_by_slug(slug)
        _ensure_can_read_tenant(current_user, tenant.id)
        include_sensitive = _user_can_view_sensitive_tenant_data(current_user, tenant.id)
        return _build_tenant_response(tenant, include_sensitive=include_sensitive)
    except TenantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str,
    tenant_data: TenantUpdate,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantResponse:
    """
    Update a tenant's information.

    Allows partial updates to tenant configuration, limits, and settings.
    """
    try:
        _ensure_can_write_tenant(current_user, tenant_id)
        tenant = await service.update_tenant(
            tenant_id, tenant_data, updated_by=current_user.user_id
        )
        include_sensitive = _user_can_view_sensitive_tenant_data(current_user, tenant.id)
        return _build_tenant_response(tenant, include_sensitive=include_sensitive)
    except TenantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: str,
    permanent: bool = Query(False, description="Permanently delete (vs soft delete)"),
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> None:
    """
    Delete a tenant.

    Supports both soft delete (default) and permanent deletion.
    """
    try:
        _ensure_can_write_tenant(current_user, tenant_id)
        await service.delete_tenant(tenant_id, permanent=permanent, deleted_by=current_user.user_id)
    except TenantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{tenant_id}/restore", response_model=TenantResponse)
async def restore_tenant(
    tenant_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantResponse:
    """
    Restore a soft-deleted tenant.

    Recovers a tenant that was previously soft-deleted.
    """
    try:
        _ensure_can_write_tenant(current_user, tenant_id)
        tenant = await service.restore_tenant(tenant_id, restored_by=current_user.user_id)
        include_sensitive = _user_can_view_sensitive_tenant_data(current_user, tenant.id)
        return _build_tenant_response(tenant, include_sensitive=include_sensitive)
    except TenantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Tenant Settings
@router.get("/{tenant_id}/settings", response_model=list[TenantSettingResponse])
async def get_tenant_settings(
    tenant_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> list[TenantSettingResponse]:
    """
    Get all settings for a tenant.

    Returns all configuration settings for the specified tenant.
    """
    _ensure_can_read_tenant(current_user, tenant_id)
    settings = await service.get_tenant_settings(tenant_id)
    return [TenantSettingResponse.model_validate(s) for s in settings]


@router.get("/{tenant_id}/settings/{key}", response_model=TenantSettingResponse)
async def get_tenant_setting(
    tenant_id: str,
    key: str,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantSettingResponse:
    """
    Get a specific tenant setting by key.

    Retrieves a single configuration setting.
    """
    _ensure_can_read_tenant(current_user, tenant_id)
    setting = await service.get_tenant_setting(tenant_id, key)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting with key '{key}' not found for tenant",
        )
    return TenantSettingResponse.model_validate(setting)


@router.post("/{tenant_id}/settings", response_model=TenantSettingResponse)
async def create_or_update_tenant_setting(
    tenant_id: str,
    setting_data: TenantSettingCreate,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantSettingResponse:
    """
    Create or update a tenant setting.

    Sets a configuration value for the tenant. Updates if exists, creates if new.
    """
    _ensure_can_write_tenant(current_user, tenant_id)
    setting = await service.set_tenant_setting(tenant_id, setting_data)
    return TenantSettingResponse.model_validate(setting)


@router.delete("/{tenant_id}/settings/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant_setting(
    tenant_id: str,
    key: str,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> None:
    """
    Delete a tenant setting.

    Removes a configuration setting from the tenant.
    """
    _ensure_can_write_tenant(current_user, tenant_id)
    await service.delete_tenant_setting(tenant_id, key)


# Usage Tracking
@router.post(
    "/{tenant_id}/usage", response_model=TenantUsageResponse, status_code=status.HTTP_201_CREATED
)
async def record_tenant_usage(
    tenant_id: str,
    usage_data: TenantUsageCreate,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantUsageResponse:
    """
    Record usage metrics for a tenant.

    Logs usage statistics for a specific time period.
    """
    _ensure_can_write_tenant(current_user, tenant_id)
    usage = await service.record_usage(tenant_id, usage_data)
    return TenantUsageResponse.model_validate(usage)


@router.get("/{tenant_id}/usage", response_model=list[TenantUsageResponse])
async def get_tenant_usage(
    tenant_id: str,
    start_date: datetime | None = Query(None, description="Filter by start date"),
    end_date: datetime | None = Query(None, description="Filter by end date"),
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> list[TenantUsageResponse]:
    """
    Get usage records for a tenant.

    Retrieves historical usage data, optionally filtered by date range.
    """
    _ensure_can_read_tenant(current_user, tenant_id)
    usage_records = await service.get_tenant_usage(tenant_id, start_date, end_date)
    return [TenantUsageResponse.model_validate(u) for u in usage_records]


@router.get("/{tenant_id}/stats", response_model=TenantStatsResponse)
async def get_tenant_stats(
    tenant_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantStatsResponse:
    """
    Get tenant usage statistics and analytics.

    Returns comprehensive usage metrics, limits, and percentages.
    """
    try:
        _ensure_can_read_tenant(current_user, tenant_id)
        return await service.get_tenant_stats(tenant_id)
    except TenantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Invitations
@router.post(
    "/{tenant_id}/invitations",
    response_model=TenantInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    tenant_id: str,
    invitation_data: TenantInvitationCreate,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantInvitationResponse:
    """
    Create a tenant invitation.

    Invites a user to join the tenant organization.
    """
    _ensure_can_write_tenant(current_user, tenant_id)
    invitation = await service.create_invitation(
        tenant_id, invitation_data, invited_by=current_user.user_id
    )

    response = TenantInvitationResponse.model_validate(invitation)
    response.is_expired = invitation.is_expired
    response.is_pending = invitation.is_pending

    return response


@router.get("/{tenant_id}/invitations", response_model=list[TenantInvitationResponse])
async def list_invitations(
    tenant_id: str,
    status_filter: TenantInvitationStatus | None = Query(None, alias="status"),
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> list[TenantInvitationResponse]:
    """
    List invitations for a tenant.

    Returns all invitations, optionally filtered by status.
    """
    _ensure_can_read_tenant(current_user, tenant_id)
    invitations = await service.list_tenant_invitations(tenant_id, status=status_filter)

    responses = []
    for inv in invitations:
        response = TenantInvitationResponse.model_validate(inv)
        response.is_expired = inv.is_expired
        response.is_pending = inv.is_pending
        responses.append(response)

    return responses


@router.post("/invitations/accept", response_model=TenantInvitationResponse)
async def accept_invitation(
    accept_data: TenantInvitationAccept,
    service: TenantService = Depends(get_tenant_service),
) -> TenantInvitationResponse:
    """
    Accept a tenant invitation.

    Processes an invitation token to join a tenant.
    """
    try:
        invitation = await service.accept_invitation(accept_data.token)

        response = TenantInvitationResponse.model_validate(invitation)
        response.is_expired = invitation.is_expired
        response.is_pending = invitation.is_pending

        return response
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{tenant_id}/invitations/{invitation_id}/revoke", response_model=TenantInvitationResponse
)
async def revoke_invitation(
    tenant_id: str,
    invitation_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantInvitationResponse:
    """
    Revoke a tenant invitation.

    Cancels a pending invitation.
    """
    try:
        _ensure_can_write_tenant(current_user, tenant_id)
        invitation = await service.revoke_invitation(invitation_id)

        response = TenantInvitationResponse.model_validate(invitation)
        response.is_expired = invitation.is_expired
        response.is_pending = invitation.is_pending

        return response
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Feature Management
@router.patch("/{tenant_id}/features", response_model=TenantResponse)
async def update_tenant_features(
    tenant_id: str,
    feature_data: TenantFeatureUpdate,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantResponse:
    """
    Update tenant feature flags.

    Enables or disables features for the tenant.
    """
    try:
        _ensure_can_write_tenant(current_user, tenant_id)
        tenant = await service.update_tenant_features(
            tenant_id, feature_data.features, updated_by=current_user.user_id
        )

        include_sensitive = _can_view_sensitive_tenant_data(current_user)
        return _build_tenant_response(tenant, include_sensitive=include_sensitive)
    except TenantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/{tenant_id}/metadata", response_model=TenantResponse)
async def update_tenant_metadata(
    tenant_id: str,
    metadata_data: TenantMetadataUpdate,
    current_user: UserInfo = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
) -> TenantResponse:
    """
    Update tenant metadata.

    Updates custom metadata fields for the tenant.
    """
    try:
        _ensure_can_write_tenant(current_user, tenant_id)
        tenant = await service.update_tenant_metadata(
            tenant_id, metadata_data.custom_metadata, updated_by=current_user.user_id
        )

        response = TenantResponse.model_validate(tenant)
        response.is_trial = tenant.is_trial
        response.is_active = tenant.status_is_active
        response.trial_expired = tenant.trial_expired
        response.has_exceeded_user_limit = tenant.has_exceeded_user_limit
        response.has_exceeded_api_limit = tenant.has_exceeded_api_limit
        response.has_exceeded_storage_limit = tenant.has_exceeded_storage_limit

        return response
    except TenantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Bulk Operations
@router.post("/bulk/status", response_model=dict[str, Any])
async def bulk_update_status(
    update_data: TenantBulkStatusUpdate,
    current_user: UserInfo = Depends(require_tenant_permission(TENANT_WRITE_PERMISSION)),
    service: TenantService = Depends(get_tenant_service),
) -> dict[str, Any]:
    """
    Bulk update tenant status.

    Updates the status of multiple tenants at once.
    """
    updated_count = await service.bulk_update_status(
        update_data.tenant_ids, update_data.status, updated_by=current_user.user_id
    )

    return {"updated_count": updated_count, "tenant_ids": update_data.tenant_ids}


@router.post("/bulk/delete", response_model=dict[str, Any])
async def bulk_delete_tenants(
    delete_data: TenantBulkDeleteRequest,
    current_user: UserInfo = Depends(require_tenant_permission(TENANT_WRITE_PERMISSION)),
    service: TenantService = Depends(get_tenant_service),
) -> dict[str, Any]:
    """
    Bulk delete tenants.

    Deletes multiple tenants at once (soft or permanent).
    """
    deleted_count = await service.bulk_delete_tenants(
        delete_data.tenant_ids, permanent=delete_data.permanent, deleted_by=current_user.user_id
    )

    return {
        "deleted_count": deleted_count,
        "tenant_ids": delete_data.tenant_ids,
        "permanent": delete_data.permanent,
    }


@router.post(
    "/{tenant_id}/provisioning/jobs",
    response_model=TenantProvisioningJobResponse,
    status_code=status.HTTP_201_CREATED,
)
async def schedule_tenant_provisioning_job(
    tenant_id: str,
    job_request: TenantProvisioningJobCreate,
    current_user: UserInfo = Depends(require_tenant_permission(TENANT_WRITE_PERMISSION)),
    service: TenantProvisioningService = Depends(get_tenant_provisioning_service),
) -> TenantProvisioningJobResponse:
    """
    Queue a dedicated infrastructure provisioning job for a tenant.

    Launches an asynchronous AWX job and transitions the tenant into the provisioning state.
    """
    _ensure_can_write_tenant(current_user, tenant_id)

    try:
        job = await service.create_job(
            tenant_id,
            job_request,
            requested_by=current_user.user_id,
        )
    except TenantProvisioningJobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except TenantProvisioningConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    enqueue_tenant_provisioning(job.id)
    return TenantProvisioningJobResponse.model_validate(job)


@router.get(
    "/{tenant_id}/provisioning/jobs",
    response_model=TenantProvisioningJobListResponse,
)
async def list_tenant_provisioning_jobs(
    tenant_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: UserInfo = Depends(require_tenant_permission(TENANT_READ_PERMISSION)),
    service: TenantProvisioningService = Depends(get_tenant_provisioning_service),
) -> TenantProvisioningJobListResponse:
    """
    List provisioning jobs for a tenant.
    """
    _ensure_can_read_tenant(current_user, tenant_id)
    offset = (page - 1) * page_size
    jobs, total = await service.list_jobs(tenant_id, limit=page_size, offset=offset)
    items = [TenantProvisioningJobResponse.model_validate(job) for job in jobs]
    return TenantProvisioningJobListResponse(items=items, total=total)


@router.get(
    "/{tenant_id}/provisioning/jobs/{job_id}",
    response_model=TenantProvisioningJobResponse,
)
async def get_tenant_provisioning_job(
    tenant_id: str,
    job_id: str,
    current_user: UserInfo = Depends(require_tenant_permission(TENANT_READ_PERMISSION)),
    service: TenantProvisioningService = Depends(get_tenant_provisioning_service),
) -> TenantProvisioningJobResponse:
    """
    Retrieve a specific provisioning job.
    """
    _ensure_can_read_tenant(current_user, tenant_id)
    try:
        job = await service.get_job(tenant_id, job_id)
    except TenantProvisioningJobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TenantProvisioningJobResponse.model_validate(job)


# Legacy route alias (/api/v1/tenant/*) maintained for backwards compatibility.
legacy_router = APIRouter(prefix="/tenant", tags=["Tenant Management (legacy)"])


@legacy_router.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    include_in_schema=False,
)
async def redirect_legacy_tenant_paths(full_path: str, request: Request) -> RedirectResponse:
    """
    Redirect legacy /tenant/* paths to the canonical /tenants/* endpoints.

    Uses HTTP 307 to preserve the original HTTP method.
    """
    new_path = request.url.path.replace("/tenant", "/tenants", 1)
    new_url = request.url.replace(path=new_path)
    return RedirectResponse(url=str(new_url), status_code=status.HTTP_307_TEMPORARY_REDIRECT)
