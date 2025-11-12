"""
Partner Management API Router.

Provides RESTful endpoints for partner management operations.
"""

from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.partner_management import (
    commission_rules_router,
    portal_router,
    revenue_router,
)
from dotmac.platform.partner_management.models import PartnerStatus
from dotmac.platform.partner_management.schemas import (
    PartnerAccountCreate,
    PartnerAccountResponse,
    PartnerCommissionEventCreate,
    PartnerCommissionEventListResponse,
    PartnerCommissionEventResponse,
    PartnerCreate,
    PartnerListResponse,
    PartnerResponse,
    PartnerUpdate,
    PartnerUserCreate,
    PartnerUserResponse,
    ReferralLeadCreate,
    ReferralLeadListResponse,
    ReferralLeadResponse,
    ReferralLeadUpdate,
)
from dotmac.platform.partner_management.service import PartnerService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/partners", tags=["Partner Management"])

# Include partner portal sub-routers
router.include_router(portal_router.router)
router.include_router(revenue_router.router)
router.include_router(commission_rules_router.router)


def _convert_partner_to_response(partner: Any) -> PartnerResponse:
    """Convert Partner model to PartnerResponse, handling metadata_ field."""
    partner_dict: dict[str, Any] = {}
    for key in PartnerResponse.model_fields:
        if key == "metadata":
            partner_dict["metadata"] = partner.metadata_ if hasattr(partner, "metadata_") else {}
        elif hasattr(partner, key):
            partner_dict[key] = getattr(partner, key)
    return PartnerResponse.model_validate(partner_dict)


# Dependency for partner service
async def get_partner_service(
    session: AsyncSession = Depends(get_session_dependency),
) -> PartnerService:
    """Get partner service instance."""
    return PartnerService(session)


# =============================================================================
# Partner Endpoints
# =============================================================================


@router.post("/", response_model=PartnerResponse, status_code=status.HTTP_201_CREATED)
async def create_partner(
    data: PartnerCreate,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerResponse:
    """
    Create a new partner.

    Requires authentication with partner_admin permission.
    """
    try:
        partner = await service.create_partner(
            data=data,
            created_by=current_user.user_id,
        )
        return _convert_partner_to_response(partner)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        logger.error("Failed to create partner", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create partner",
        )


@router.get("/{partner_id}", response_model=PartnerResponse)
async def get_partner(
    partner_id: UUID,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerResponse:
    """
    Get partner by ID.

    Requires authentication.
    """
    partner = await service.get_partner(partner_id=partner_id)
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner {partner_id} not found",
        )
    return _convert_partner_to_response(partner)


@router.get("/by-number/{partner_number}", response_model=PartnerResponse)
async def get_partner_by_number(
    partner_number: str,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerResponse:
    """
    Get partner by partner number.

    Requires authentication.
    """
    partner = await service.get_partner_by_number(partner_number)
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner with number {partner_number} not found",
        )
    return _convert_partner_to_response(partner)


@router.get("/", response_model=PartnerListResponse)
async def list_partners(
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    status_filter: PartnerStatus | None = Query(None, alias="status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> PartnerListResponse:
    """
    List partners with optional filtering.

    Requires authentication.
    """
    offset = (page - 1) * page_size

    partners, total = await service.list_partners(
        status=status_filter,
        offset=offset,
        limit=page_size,
    )

    # Convert to response models
    partner_responses = [_convert_partner_to_response(p) for p in partners]

    return PartnerListResponse(
        partners=partner_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{partner_id}", response_model=PartnerResponse)
async def update_partner(
    partner_id: UUID,
    data: PartnerUpdate,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerResponse:
    """
    Update partner information.

    Requires authentication with partner_admin permission.
    """
    partner = await service.update_partner(
        partner_id=partner_id,
        data=data,
        updated_by=current_user.user_id,
    )
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner {partner_id} not found",
        )
    return _convert_partner_to_response(partner)


@router.delete("/{partner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_partner(
    partner_id: UUID,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> None:
    """
    Delete a partner (soft delete).

    Requires authentication with partner_admin permission.
    """
    success = await service.delete_partner(
        partner_id=partner_id,
        deleted_by=current_user.user_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner {partner_id} not found",
        )


# =============================================================================
# Partner User Endpoints
# =============================================================================


@router.post(
    "/{partner_id}/users", response_model=PartnerUserResponse, status_code=status.HTTP_201_CREATED
)
async def create_partner_user(
    partner_id: UUID,
    data: PartnerUserCreate,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerUserResponse:
    """
    Create a partner user.

    Requires authentication.
    """
    # Validate partner exists
    partner = await service.get_partner(partner_id)
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner {partner_id} not found",
        )

    # Ensure partner_id matches
    data.partner_id = partner_id

    user = await service.create_partner_user(data=data)
    return PartnerUserResponse.model_validate(user, from_attributes=True)


@router.get("/{partner_id}/users", response_model=list[PartnerUserResponse])
async def list_partner_users(
    partner_id: UUID,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    active_only: bool = Query(True, description="Show only active users"),
) -> list[PartnerUserResponse]:
    """
    List users for a partner.

    Requires authentication.
    """
    users = await service.list_partner_users(partner_id=partner_id, active_only=active_only)
    return [PartnerUserResponse.model_validate(u, from_attributes=True) for u in users]


# =============================================================================
# Partner Account Endpoints
# =============================================================================


@router.post(
    "/accounts", response_model=PartnerAccountResponse, status_code=status.HTTP_201_CREATED
)
async def create_partner_account(
    data: PartnerAccountCreate,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerAccountResponse:
    """
    Assign a customer to a partner.

    Requires authentication with partner_admin permission.
    """
    account = await service.create_partner_account(data=data)

    account_dict = {}
    for key in PartnerAccountResponse.model_fields:
        if key == "metadata":
            account_dict["metadata"] = account.metadata_ if hasattr(account, "metadata_") else {}
        elif hasattr(account, key):
            account_dict[key] = getattr(account, key)

    return PartnerAccountResponse.model_validate(account_dict)


@router.get("/{partner_id}/accounts", response_model=list[PartnerAccountResponse])
async def list_partner_accounts(
    partner_id: UUID,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    active_only: bool = Query(True, description="Show only active accounts"),
) -> list[PartnerAccountResponse]:
    """
    List accounts assigned to a partner.

    Requires authentication.
    """
    accounts = await service.list_partner_accounts(partner_id=partner_id, active_only=active_only)

    responses = []
    for account in accounts:
        account_dict = {}
        for key in PartnerAccountResponse.model_fields:
            if key == "metadata":
                account_dict["metadata"] = (
                    account.metadata_ if hasattr(account, "metadata_") else {}
                )
            elif hasattr(account, key):
                account_dict[key] = getattr(account, key)
        responses.append(PartnerAccountResponse.model_validate(account_dict))

    return responses


# =============================================================================
# Commission Event Endpoints
# =============================================================================


@router.post(
    "/commissions",
    response_model=PartnerCommissionEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_commission_event(
    data: PartnerCommissionEventCreate,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerCommissionEventResponse:
    """
    Create a commission event.

    Requires authentication with partner_admin permission.
    """
    event = await service.create_commission_event(data=data)

    event_dict = {}
    for key in PartnerCommissionEventResponse.model_fields:
        if key == "metadata":
            event_dict["metadata"] = event.metadata_ if hasattr(event, "metadata_") else {}
        elif hasattr(event, key):
            event_dict[key] = getattr(event, key)

    return PartnerCommissionEventResponse.model_validate(event_dict)


@router.get("/{partner_id}/commissions", response_model=PartnerCommissionEventListResponse)
async def list_commission_events(
    partner_id: UUID,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> PartnerCommissionEventListResponse:
    """
    List commission events for a partner.

    Requires authentication.
    """
    offset = (page - 1) * page_size

    events = await service.list_commission_events(
        partner_id=partner_id,
        offset=offset,
        limit=page_size,
    )

    responses = []
    for event in events:
        event_dict = {}
        for key in PartnerCommissionEventResponse.model_fields:
            if key == "metadata":
                event_dict["metadata"] = event.metadata_ if hasattr(event, "metadata_") else {}
            elif hasattr(event, key):
                event_dict[key] = getattr(event, key)
        responses.append(PartnerCommissionEventResponse.model_validate(event_dict))

    return PartnerCommissionEventListResponse(
        events=responses,
        total=len(responses),
        page=page,
        page_size=page_size,
    )


# =============================================================================
# Referral Lead Endpoints
# =============================================================================


@router.post("/referrals", response_model=ReferralLeadResponse, status_code=status.HTTP_201_CREATED)
async def create_referral(
    data: ReferralLeadCreate,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> ReferralLeadResponse:
    """
    Create a referral lead.

    Requires authentication.
    """
    referral = await service.create_referral(data=data)

    referral_dict = {}
    for key in ReferralLeadResponse.model_fields:
        if key == "metadata":
            referral_dict["metadata"] = referral.metadata_ if hasattr(referral, "metadata_") else {}
        elif hasattr(referral, key):
            referral_dict[key] = getattr(referral, key)

    return ReferralLeadResponse.model_validate(referral_dict)


@router.get("/{partner_id}/referrals", response_model=ReferralLeadListResponse)
async def list_referrals(
    partner_id: UUID,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> ReferralLeadListResponse:
    """
    List referral leads for a partner.

    Requires authentication.
    """
    offset = (page - 1) * page_size

    referrals = await service.list_referrals(
        partner_id=partner_id,
        offset=offset,
        limit=page_size,
    )

    responses = []
    for referral in referrals:
        referral_dict = {}
        for key in ReferralLeadResponse.model_fields:
            if key == "metadata":
                referral_dict["metadata"] = (
                    referral.metadata_ if hasattr(referral, "metadata_") else {}
                )
            elif hasattr(referral, key):
                referral_dict[key] = getattr(referral, key)
        responses.append(ReferralLeadResponse.model_validate(referral_dict))

    return ReferralLeadListResponse(
        referrals=responses,
        total=len(responses),
        page=page,
        page_size=page_size,
    )


@router.patch("/referrals/{referral_id}", response_model=ReferralLeadResponse)
async def update_referral(
    referral_id: UUID,
    data: ReferralLeadUpdate,
    service: Annotated[PartnerService, Depends(get_partner_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> ReferralLeadResponse:
    """
    Update referral lead.

    Requires authentication.
    """
    referral = await service.update_referral(referral_id=referral_id, data=data)
    if not referral:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral {referral_id} not found",
        )

    referral_dict = {}
    for key in ReferralLeadResponse.model_fields:
        if key == "metadata":
            referral_dict["metadata"] = referral.metadata_ if hasattr(referral, "metadata_") else {}
        elif hasattr(referral, key):
            referral_dict[key] = getattr(referral, key)

    return ReferralLeadResponse.model_validate(referral_dict)
