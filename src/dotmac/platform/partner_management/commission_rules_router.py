"""
Commission Rules Router - RESTful endpoints for partner commission rules management.

Provides CRUD operations for managing commission calculation rules.
"""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.partner_management.commission_rules_service import (
    CommissionRulesService,
)
from dotmac.platform.partner_management.schemas import (
    PartnerCommissionRuleCreate,
    PartnerCommissionRuleListResponse,
    PartnerCommissionRuleResponse,
    PartnerCommissionRuleUpdate,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/commission-rules", tags=["Commission Rules"])


# Dependency
def get_commission_rules_service(
    session: AsyncSession = Depends(get_session_dependency),
) -> CommissionRulesService:
    """Get commission rules service instance."""
    return CommissionRulesService(session)


# ============================================================================
# Commission Rules CRUD Endpoints
# ============================================================================


@router.post(
    "/",
    response_model=PartnerCommissionRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_commission_rule(
    data: PartnerCommissionRuleCreate,
    service: Annotated[CommissionRulesService, Depends(get_commission_rules_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerCommissionRuleResponse:
    """
    Create a new commission rule.

    Requires authentication with partner_admin permission.

    Args:
        data: Commission rule creation data
        service: Commission rules service
        current_user: Current authenticated user

    Returns:
        Created commission rule

    Raises:
        HTTPException: If partner not found or validation fails
    """
    try:
        rule = await service.create_rule(
            data=data,
            created_by=UUID(current_user.user_id),
        )
        return PartnerCommissionRuleResponse.model_validate(rule, from_attributes=True)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        logger.error("Failed to create commission rule", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create commission rule",
        )


@router.get("/{rule_id}", response_model=PartnerCommissionRuleResponse)
async def get_commission_rule(
    rule_id: UUID,
    service: Annotated[CommissionRulesService, Depends(get_commission_rules_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerCommissionRuleResponse:
    """
    Get commission rule by ID.

    Requires authentication.

    Args:
        rule_id: Rule ID
        service: Commission rules service
        current_user: Current authenticated user

    Returns:
        Commission rule details

    Raises:
        HTTPException: If rule not found
    """
    rule = await service.get_rule(rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission rule {rule_id} not found",
        )

    return PartnerCommissionRuleResponse.model_validate(rule, from_attributes=True)


@router.get("/", response_model=PartnerCommissionRuleListResponse)
async def list_commission_rules(
    service: Annotated[CommissionRulesService, Depends(get_commission_rules_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    partner_id: UUID | None = Query(None, description="Filter by partner ID"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> PartnerCommissionRuleListResponse:
    """
    List commission rules with optional filtering.

    Requires authentication.

    Args:
        service: Commission rules service
        current_user: Current authenticated user
        partner_id: Optional partner ID filter
        is_active: Optional active status filter
        page: Page number
        page_size: Items per page

    Returns:
        Paginated list of commission rules
    """
    offset = (page - 1) * page_size

    rules, total = await service.list_rules(
        partner_id=partner_id,
        is_active=is_active,
        limit=page_size,
        offset=offset,
    )

    # Convert to response models
    rule_responses = [
        PartnerCommissionRuleResponse.model_validate(r, from_attributes=True) for r in rules
    ]

    return PartnerCommissionRuleListResponse(
        rules=rule_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{rule_id}", response_model=PartnerCommissionRuleResponse)
async def update_commission_rule(
    rule_id: UUID,
    data: PartnerCommissionRuleUpdate,
    service: Annotated[CommissionRulesService, Depends(get_commission_rules_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> PartnerCommissionRuleResponse:
    """
    Update commission rule.

    Requires authentication with partner_admin permission.

    Args:
        rule_id: Rule ID
        data: Update data
        service: Commission rules service
        current_user: Current authenticated user

    Returns:
        Updated commission rule

    Raises:
        HTTPException: If rule not found or validation fails
    """
    try:
        rule = await service.update_rule(
            rule_id=rule_id,
            data=data,
            updated_by=UUID(current_user.user_id),
        )
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Commission rule {rule_id} not found",
            )

        return PartnerCommissionRuleResponse.model_validate(rule, from_attributes=True)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to update commission rule", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update commission rule",
        )


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_commission_rule(
    rule_id: UUID,
    service: Annotated[CommissionRulesService, Depends(get_commission_rules_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> None:
    """
    Delete (deactivate) commission rule.

    This is a soft delete - sets is_active to False rather than removing the record.

    Requires authentication with partner_admin permission.

    Args:
        rule_id: Rule ID
        service: Commission rules service
        current_user: Current authenticated user

    Raises:
        HTTPException: If rule not found
    """
    success = await service.delete_rule(
        rule_id=rule_id,
        deleted_by=UUID(current_user.user_id),
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission rule {rule_id} not found",
        )


@router.get(
    "/partners/{partner_id}/applicable",
    response_model=list[PartnerCommissionRuleResponse],
)
async def get_applicable_rules(
    partner_id: UUID,
    service: Annotated[CommissionRulesService, Depends(get_commission_rules_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    product_id: str | None = Query(None, description="Product ID to match"),
    customer_id: str | None = Query(None, description="Customer ID to match"),
) -> list[PartnerCommissionRuleResponse]:
    """
    Get applicable commission rules for a scenario.

    Returns rules in priority order (lower priority number = higher precedence).

    Requires authentication.

    Args:
        partner_id: Partner ID
        service: Commission rules service
        current_user: Current authenticated user
        product_id: Optional product ID to match
        customer_id: Optional customer ID to match

    Returns:
        List of applicable rules in priority order
    """
    rules = await service.get_applicable_rules(
        partner_id=partner_id,
        product_id=product_id,
        customer_id=customer_id,
    )

    return [PartnerCommissionRuleResponse.model_validate(r, from_attributes=True) for r in rules]
