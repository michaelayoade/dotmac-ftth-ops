"""
Tenant onboarding automation API router.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.database import get_async_session
from dotmac.platform.user_management.service import UserService

from .dependencies import get_tenant_service
from .models import TenantStatus
from .onboarding_schemas import (
    TenantOnboardingRequest,
    TenantOnboardingResponse,
    TenantOnboardingStatusResponse,
)
from .onboarding_service import TenantOnboardingService
from .schemas import TenantInvitationResponse, TenantResponse
from .service import TenantAlreadyExistsError, TenantNotFoundError, TenantService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/tenants", tags=["Tenant Onboarding"])


async def get_user_service_dependency(
    session: AsyncSession = Depends(get_async_session),
) -> UserService:
    """Provide user service dependency for onboarding automation."""
    return UserService(session)


async def get_onboarding_service(
    tenant_service: TenantService = Depends(get_tenant_service),
    user_service: UserService = Depends(get_user_service_dependency),
) -> TenantOnboardingService:
    """Build onboarding service with required dependencies."""
    return TenantOnboardingService(tenant_service=tenant_service, user_service=user_service)


def _to_tenant_response(tenant: object) -> TenantResponse:
    """Convert tenant model to API response with computed flags."""
    response = TenantResponse.model_validate(tenant)

    response.is_trial = bool(getattr(tenant, "is_trial", False))
    response.is_active = bool(
        getattr(tenant, "status_is_active", getattr(tenant, "is_active", False))
    )
    response.trial_expired = bool(getattr(tenant, "trial_expired", False))
    response.has_exceeded_user_limit = bool(getattr(tenant, "has_exceeded_user_limit", False))
    response.has_exceeded_api_limit = bool(getattr(tenant, "has_exceeded_api_limit", False))
    response.has_exceeded_storage_limit = bool(getattr(tenant, "has_exceeded_storage_limit", False))

    return response


@router.post(
    "/onboarding",
    response_model=TenantOnboardingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def automate_tenant_onboarding(
    payload: TenantOnboardingRequest,
    current_user: UserInfo = Depends(get_current_user),
    onboarding_service: TenantOnboardingService = Depends(get_onboarding_service),
) -> TenantOnboardingResponse:
    """
    Automate onboarding for new or existing tenants.

    Creates tenant records, default settings, metadata, optional admin users,
    and invitations in a single workflow.
    """
    try:
        result = await onboarding_service.run_onboarding(payload, initiated_by=current_user.user_id)
    except TenantAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except TenantNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        logger.exception("tenant.onboarding.runtime_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete tenant onboarding automation.",
        ) from exc

    tenant = result["tenant"]
    tenant_response = _to_tenant_response(tenant)

    invitation_responses: list[TenantInvitationResponse] = []
    for invitation in result["invitations"]:
        invitation_response = TenantInvitationResponse.model_validate(invitation)
        invitation_response.is_expired = bool(getattr(invitation, "is_expired", False))
        invitation_response.is_pending = bool(getattr(invitation, "is_pending", False))
        invitation_responses.append(invitation_response)

    # Maintain metadata structure from tenant after updates
    metadata = result.get("metadata") or getattr(tenant, "custom_metadata", {}) or {}

    # Append current tenant status to log if activation requested
    if payload.options.activate_tenant and tenant_response.status != TenantStatus.ACTIVE:
        logger.warning(
            "tenant.onboarding.activation_mismatch",
            tenant_id=tenant_response.id,
            current_status=tenant_response.status,
        )

    return TenantOnboardingResponse(
        tenant=tenant_response,
        created=bool(result.get("created")),
        onboarding_status=result.get("onboarding_status", "completed"),
        admin_user_id=result.get("admin_user_id"),
        admin_user_password=result.get("admin_user_password"),
        invitations=invitation_responses,
        applied_settings=list(result.get("applied_settings", [])),
        metadata=metadata,
        feature_flags_updated=bool(result.get("feature_flags_updated")),
        warnings=list(result.get("warnings", [])),
        logs=list(result.get("logs", [])),
    )


@router.get(
    "/{tenant_id}/onboarding/status",
    response_model=TenantOnboardingStatusResponse,
)
async def get_tenant_onboarding_status(
    tenant_id: str,
    current_user: UserInfo = Depends(get_current_user),
    onboarding_service: TenantOnboardingService = Depends(get_onboarding_service),
) -> TenantOnboardingStatusResponse:
    """
    Retrieve onboarding status metadata for a tenant.
    """
    try:
        status_data = await onboarding_service.get_onboarding_status(tenant_id)
    except TenantNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return TenantOnboardingStatusResponse(
        tenant_id=status_data["tenant_id"],
        status=status_data["status"],
        completed=bool(status_data["completed"]),
        metadata=status_data.get("metadata", {}),
        updated_at=status_data.get("updated_at"),
    )
