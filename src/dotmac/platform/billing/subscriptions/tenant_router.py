"""
Tenant-facing subscription management API router.

Provides self-service endpoints for tenant admins to manage their subscriptions,
upgrade/downgrade plans, and cancel subscriptions without operator intervention.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user, require_scopes
from dotmac.platform.billing._typing_helpers import rate_limit
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id

from ..exceptions import PlanNotFoundError, SubscriptionNotFoundError
from .models import (
    PlanChangeRequest,
    ProrationPreview,
    SubscriptionCancelRequest,
    SubscriptionPlanResponse,
    SubscriptionResponse,
)
from .service import SubscriptionService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/tenant/subscription", tags=["Tenant - Subscriptions"])


# ============================================================================
# Tenant Subscription Management
# ============================================================================


@router.get("/current", response_model=SubscriptionResponse)
async def get_current_tenant_subscription(
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> SubscriptionResponse:
    """
    Get current tenant's active subscription with full details.

    Returns subscription information including:
    - Current plan details
    - Usage data for current billing period
    - Billing cycle dates
    - Trial status (if applicable)

    **Permissions**: Requires authenticated tenant user
    """
    service = SubscriptionService(db_session)

    try:
        # Get tenant's active subscription
        subscription = await service.get_tenant_subscription(tenant_id)

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active subscription found for tenant",
            )

        logger.info(
            "Tenant subscription retrieved",
            tenant_id=tenant_id,
            subscription_id=subscription.subscription_id,
            user_id=current_user.user_id,
        )

        # FIXED: Convert Subscription to SubscriptionResponse with computed fields
        # Response model requires is_in_trial and days_until_renewal
        return service._subscription_to_response(subscription)

    except SubscriptionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to retrieve tenant subscription",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription",
        )


@router.get("/available-plans", response_model=list[SubscriptionPlanResponse])
async def get_available_plans_for_tenant(
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> list[SubscriptionPlanResponse]:
    """
    Get all subscription plans available for tenant upgrade/downgrade.

    Returns only active plans that are available for the tenant's current tier.
    Plans are filtered based on:
    - Active status
    - Tenant eligibility
    - Plan visibility settings

    **Permissions**: Requires authenticated tenant user
    """
    service = SubscriptionService(db_session)

    try:
        # Get all active plans available for tenant
        plans = await service.get_available_plans(tenant_id)

        logger.info(
            "Available plans retrieved",
            tenant_id=tenant_id,
            plan_count=len(plans),
            user_id=current_user.user_id,
        )

        return [service._plan_to_response(plan) for plan in plans]

    except Exception as e:
        logger.error(
            "Failed to retrieve available plans",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve available plans",
        )


# ============================================================================
# Plan Change Preview (Proration Calculation)
# ============================================================================


@router.post("/preview-change", response_model=ProrationPreview)
@rate_limit("10/minute")  # type: ignore[misc]
async def preview_plan_change(
    request: PlanChangeRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> ProrationPreview:
    """
    Preview cost/credits for changing subscription plan.

    Shows detailed breakdown before committing to plan change:
    - Proration amount (charge or credit)
    - Unused amount from current plan
    - Prorated cost of new plan
    - Estimated next invoice total
    - Effective date of change

    **Use cases**:
    - Upgrading to higher-tier plan
    - Downgrading to lower-tier plan
    - Switching billing cycles (monthly <-> annual)

    **Permissions**: Requires authenticated tenant user
    **Rate Limit**: 10 requests per minute
    """
    service = SubscriptionService(db_session)

    try:
        # Calculate proration preview
        preview = await service.preview_plan_change(
            tenant_id=tenant_id,
            new_plan_id=request.new_plan_id,
            effective_date=request.effective_date,
            proration_behavior=request.proration_behavior,
        )

        logger.info(
            "Plan change previewed",
            tenant_id=tenant_id,
            new_plan_id=request.new_plan_id,
            proration_amount=float(preview.proration.proration_amount),
            user_id=current_user.user_id,
        )

        return preview

    except PlanNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except SubscriptionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to preview plan change",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to preview plan change",
        )


# ============================================================================
# Plan Change Execution (Upgrade/Downgrade)
# ============================================================================


@router.post("/change-plan", response_model=SubscriptionResponse)
@rate_limit("5/minute")  # type: ignore[misc]
async def change_subscription_plan(
    request: PlanChangeRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.subscription.manage")),
) -> SubscriptionResponse:
    """
    Change subscription plan (upgrade or downgrade).

    Executes the plan change with automatic proration handling:
    - **Upgrade**: Charges prorated difference immediately, takes effect now
    - **Downgrade**: Schedules change at end of billing period, issues credit

    **What happens**:
    1. Validates new plan exists and is available
    2. Calculates proration (if mid-cycle)
    3. Creates invoice for prorated charges (upgrades only)
    4. Updates subscription to new plan
    5. Sends confirmation email

    **Important Notes**:
    - Upgrades take effect immediately
    - Downgrades are scheduled at period end (unless immediate downgrade requested)
    - Proration credits are applied to next invoice

    **Permissions**: Requires billing.subscription.manage permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 5 plan changes per minute
    """

    service = SubscriptionService(db_session)

    try:
        # Execute plan change using tenant-aware helper
        # FIXED: Was calling change_plan() with wrong signature, causing TypeError
        updated_subscription = await service.change_tenant_subscription_plan(
            tenant_id=tenant_id,
            new_plan_id=request.new_plan_id,
            effective_date=request.effective_date,
            proration_behavior=request.proration_behavior,
            changed_by_user_id=current_user.user_id,
            change_reason=request.reason,
        )

        logger.info(
            "Subscription plan changed",
            tenant_id=tenant_id,
            subscription_id=updated_subscription.subscription_id,
            new_plan_id=request.new_plan_id,
            user_id=current_user.user_id,
            reason=request.reason,
        )

        # FIXED: Convert Subscription to SubscriptionResponse with computed fields
        # Response model requires is_in_trial and days_until_renewal
        return service._subscription_to_response(updated_subscription)

    except PlanNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except SubscriptionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to change subscription plan",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change subscription plan",
        )


# ============================================================================
# Subscription Cancellation
# ============================================================================


@router.post("/cancel", response_model=SubscriptionResponse)
@rate_limit("3/minute")  # type: ignore[misc]
async def cancel_tenant_subscription(
    request: SubscriptionCancelRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.subscription.cancel")),
) -> SubscriptionResponse:
    """
    Cancel tenant subscription.

    **Cancellation Options**:
    - **At period end** (default): Subscription remains active until current billing period ends
    - **Immediate**: Subscription ends immediately, prorated refund issued

    **What happens**:
    1. Marks subscription for cancellation
    2. Calculates refund (if immediate cancellation)
    3. Schedules offboarding tasks (if immediate)
    4. Sends cancellation confirmation email
    5. Records cancellation reason for analytics

    **Important**:
    - Canceling at period end allows continued access until renewal date
    - Immediate cancellation ends access immediately
    - Data retention policies apply after cancellation

    **Permissions**: Requires billing.subscription.cancel permission (TENANT_ADMIN only)
    **Rate Limit**: 3 cancellation requests per minute
    """

    service = SubscriptionService(db_session)

    try:
        # Cancel subscription using tenant-aware helper
        # FIXED: Was calling cancel_subscription() with wrong signature, causing TypeError
        cancelled_subscription = await service.cancel_tenant_subscription(
            tenant_id=tenant_id,
            cancel_at_period_end=request.cancel_at_period_end,
            cancelled_by_user_id=current_user.user_id,
            cancellation_reason=request.reason,
            feedback=request.feedback,
        )

        logger.info(
            "Subscription cancelled",
            tenant_id=tenant_id,
            subscription_id=cancelled_subscription.subscription_id,
            cancel_at_period_end=request.cancel_at_period_end,
            user_id=current_user.user_id,
            reason=request.reason,
        )

        # FIXED: Convert Subscription to SubscriptionResponse with computed fields
        # Response model requires is_in_trial and days_until_renewal
        return service._subscription_to_response(cancelled_subscription)

    except SubscriptionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to cancel subscription",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription",
        )


@router.post("/reactivate", response_model=SubscriptionResponse)
@rate_limit("5/minute")  # type: ignore[misc]
async def reactivate_tenant_subscription(
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.subscription.manage")),
) -> SubscriptionResponse:
    """
    Reactivate a cancelled subscription before period end.

    **Requirements**:
    - Subscription must be in "canceled" status
    - Current billing period must not have ended yet
    - Cannot reactivate fully ended subscriptions

    **What happens**:
    1. Removes cancellation flag
    2. Subscription continues as normal
    3. Next renewal will proceed automatically
    4. Sends reactivation confirmation email

    **Permissions**: Requires billing.subscription.manage permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 5 requests per minute
    """

    service = SubscriptionService(db_session)

    try:
        # FIXED: Call reactivate_tenant_subscription (tenant-aware helper)
        # Was calling reactivate_subscription which requires subscription_id as first arg
        reactivated_subscription = await service.reactivate_tenant_subscription(
            tenant_id=tenant_id,
            reactivated_by_user_id=current_user.user_id,
        )

        logger.info(
            "Subscription reactivated",
            tenant_id=tenant_id,
            subscription_id=reactivated_subscription.subscription_id,
            user_id=current_user.user_id,
        )

        # FIXED: Convert Subscription to SubscriptionResponse with computed fields
        # Response model requires is_in_trial and days_until_renewal
        return service._subscription_to_response(reactivated_subscription)

    except SubscriptionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to reactivate subscription",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reactivate subscription",
        )
