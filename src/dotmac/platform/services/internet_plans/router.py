"""
ISP Internet Service Plan API Router

REST API endpoints for internet service plan management.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant.dependencies import TenantAdminAccess

from .models import PlanStatus, PlanType
from .schemas import (
    InternetServicePlanCreate,
    InternetServicePlanResponse,
    InternetServicePlanUpdate,
    PlanComparison,
    PlanSubscriptionCreate,
    PlanSubscriptionResponse,
    PlanValidationRequest,
    PlanValidationResponse,
    UsageUpdateRequest,
)
from .service import InternetPlanService

router = APIRouter(prefix="/services/internet-plans")


# ============================================================================
# Dependencies
# ============================================================================


def get_plan_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> InternetPlanService:
    """Get internet plan service instance."""
    _, tenant = tenant_access
    tenant_uuid = tenant.id if isinstance(tenant.id, UUID) else UUID(str(tenant.id))
    return InternetPlanService(session, tenant_uuid)


# ============================================================================
# Plan Management Endpoints
# ============================================================================


@router.post(
    "",
    response_model=InternetServicePlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Internet Service Plan",
    description="Create a new internet service plan with speeds, caps, and pricing",
)
async def create_plan(
    data: InternetServicePlanCreate,
    _: UserInfo = Depends(require_permission("isp.plans.write")),
    service: InternetPlanService = Depends(get_plan_service),
) -> InternetServicePlanResponse:
    """Create internet service plan."""
    # Check for duplicate plan code
    existing = await service.get_plan_by_code(data.plan_code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Plan with code '{data.plan_code}' already exists",
        )

    return await service.create_plan(data)


@router.get(
    "",
    response_model=list[InternetServicePlanResponse],
    summary="List Internet Service Plans",
    description="List all internet service plans with optional filters",
)
async def list_plans(
    plan_type: PlanType | None = Query(None, description="Filter by plan type"),
    status_filter: PlanStatus | None = Query(None, alias="status", description="Filter by status"),
    is_public: bool | None = Query(None, description="Filter by public availability"),
    is_promotional: bool | None = Query(None, description="Filter promotional plans"),
    search: str | None = Query(None, description="Search in name, code, description"),
    limit: int = Query(100, ge=1, le=500, description="Number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    _: UserInfo = Depends(require_permission("isp.plans.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> list[InternetServicePlanResponse]:
    """List internet service plans."""
    return await service.list_plans(
        plan_type=plan_type,
        status=status_filter,
        is_public=is_public,
        is_promotional=is_promotional,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{plan_id}",
    response_model=InternetServicePlanResponse,
    summary="Get Internet Service Plan",
    description="Get detailed information about a specific plan",
)
async def get_plan(
    plan_id: UUID,
    _: UserInfo = Depends(require_permission("isp.plans.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> InternetServicePlanResponse:
    """Get plan by ID."""
    plan = await service.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    return plan


@router.get(
    "/code/{plan_code}",
    response_model=InternetServicePlanResponse,
    summary="Get Plan by Code",
    description="Get plan by unique plan code",
)
async def get_plan_by_code(
    plan_code: str,
    _: UserInfo = Depends(require_permission("isp.plans.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> InternetServicePlanResponse:
    """Get plan by code."""
    plan = await service.get_plan_by_code(plan_code)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan with code '{plan_code}' not found",
        )
    return plan


@router.patch(
    "/{plan_id}",
    response_model=InternetServicePlanResponse,
    summary="Update Internet Service Plan",
    description="Update plan configuration",
)
async def update_plan(
    plan_id: UUID,
    data: InternetServicePlanUpdate,
    _: UserInfo = Depends(require_permission("isp.plans.write")),
    service: InternetPlanService = Depends(get_plan_service),
) -> InternetServicePlanResponse:
    """Update plan."""
    plan = await service.update_plan(plan_id, data)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    return plan


@router.delete(
    "/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive Plan",
    description="Archive a plan (soft delete). Cannot delete plans with active subscriptions.",
)
async def delete_plan(
    plan_id: UUID,
    _: UserInfo = Depends(require_permission("isp.plans.delete")),
    service: InternetPlanService = Depends(get_plan_service),
) -> None:
    """Archive plan."""
    success = await service.delete_plan(plan_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete plan with active subscriptions or plan not found",
        )


# ============================================================================
# Plan Validation Endpoints
# ============================================================================


@router.post(
    "/{plan_id}/validate",
    response_model=PlanValidationResponse,
    summary="Validate Plan Configuration",
    description="Run comprehensive validation tests on plan configuration and simulate usage scenarios",
)
async def validate_plan(
    plan_id: UUID,
    request: PlanValidationRequest,
    _: UserInfo = Depends(require_permission("isp.plans.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> PlanValidationResponse:
    """Validate plan configuration and simulate usage."""
    result = await service.validate_plan(plan_id, request)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    return result


@router.post(
    "/compare",
    response_model=PlanComparison,
    summary="Compare Plans",
    description="Compare multiple plans side-by-side with recommendations",
)
async def compare_plans(
    plan_ids: list[UUID],
    _: UserInfo = Depends(require_permission("isp.plans.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> PlanComparison:
    """Compare multiple plans."""
    if len(plan_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 plans required for comparison",
        )

    if len(plan_ids) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot compare more than 10 plans at once",
        )

    return await service.compare_plans(plan_ids)


@router.get(
    "/{plan_id}/statistics",
    summary="Get Plan Statistics",
    description="Get subscription statistics and MRR for a plan",
)
async def get_plan_statistics(
    plan_id: UUID,
    _: UserInfo = Depends(require_permission("isp.plans.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> dict[str, Any]:
    """Get plan statistics."""
    return await service.get_plan_statistics(plan_id)


# ============================================================================
# Subscription Management Endpoints
# ============================================================================


@router.post(
    "/{plan_id}/subscribe",
    response_model=PlanSubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subscribe Customer to Plan",
    description="Create a subscription for a customer to a specific plan",
)
async def subscribe_to_plan(
    plan_id: UUID,
    data: PlanSubscriptionCreate,
    _: UserInfo = Depends(require_permission("isp.subscriptions.write")),
    service: InternetPlanService = Depends(get_plan_service),
) -> PlanSubscriptionResponse:
    """Subscribe customer to plan."""
    # Verify plan exists
    plan = await service.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )

    # Ensure plan_id matches
    if data.plan_id != plan_id:
        data.plan_id = plan_id

    return await service.create_subscription(data)


@router.get(
    "/{plan_id}/subscriptions",
    response_model=list[PlanSubscriptionResponse],
    summary="List Plan Subscriptions",
    description="List all subscriptions for a specific plan",
)
async def list_plan_subscriptions(
    plan_id: UUID,
    is_active: bool | None = Query(None, description="Filter by active status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _: UserInfo = Depends(require_permission("isp.subscriptions.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> list[PlanSubscriptionResponse]:
    """List subscriptions for a plan."""
    return await service.list_subscriptions(
        plan_id=plan_id,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/subscriptions/{subscription_id}",
    response_model=PlanSubscriptionResponse,
    summary="Get Subscription",
    description="Get subscription details by ID",
)
async def get_subscription(
    subscription_id: UUID,
    _: UserInfo = Depends(require_permission("isp.subscriptions.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> PlanSubscriptionResponse:
    """Get subscription by ID."""
    subscription = await service.get_subscription(subscription_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription {subscription_id} not found",
        )
    return subscription


@router.post(
    "/subscriptions/{subscription_id}/usage",
    response_model=PlanSubscriptionResponse,
    summary="Update Subscription Usage",
    description="Record usage for a subscription (download and upload in GB)",
)
async def update_subscription_usage(
    subscription_id: UUID,
    usage_data: UsageUpdateRequest,
    _: UserInfo = Depends(require_permission("isp.subscriptions.write")),
    service: InternetPlanService = Depends(get_plan_service),
) -> PlanSubscriptionResponse:
    """Update subscription usage."""
    subscription = await service.update_usage(subscription_id, usage_data)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription {subscription_id} not found",
        )
    return subscription


@router.post(
    "/subscriptions/{subscription_id}/reset-usage",
    response_model=PlanSubscriptionResponse,
    summary="Reset Subscription Usage",
    description="Reset usage counters for new billing period",
)
async def reset_subscription_usage(
    subscription_id: UUID,
    _: UserInfo = Depends(require_permission("isp.subscriptions.write")),
    service: InternetPlanService = Depends(get_plan_service),
) -> PlanSubscriptionResponse:
    """Reset subscription usage."""
    subscription = await service.reset_usage(subscription_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription {subscription_id} not found",
        )
    return subscription


@router.get(
    "/customers/{customer_id}/subscriptions",
    response_model=list[PlanSubscriptionResponse],
    summary="Get Customer Subscriptions",
    description="List all subscriptions for a specific customer",
)
async def get_customer_subscriptions(
    customer_id: UUID,
    is_active: bool | None = Query(None, description="Filter by active status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _: UserInfo = Depends(require_permission("isp.subscriptions.read")),
    service: InternetPlanService = Depends(get_plan_service),
) -> list[PlanSubscriptionResponse]:
    """Get customer subscriptions."""
    return await service.list_subscriptions(
        customer_id=customer_id,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )
