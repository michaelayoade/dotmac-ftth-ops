"""
Subscription management API router.

Provides REST endpoints for managing subscription plans and customer subscriptions.
"""

from datetime import UTC
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.billing._typing_helpers import rate_limit
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id

from ..exceptions import PlanNotFoundError
from .models import (
    ProrationResult,
    SubscriptionCreateRequest,
    SubscriptionPlanChangeRequest,
    SubscriptionPlanCreateRequest,
    SubscriptionPlanResponse,
    SubscriptionResponse,
    SubscriptionStatus,
    SubscriptionUpdateRequest,
    UsageRecordRequest,
)
from .service import SubscriptionService

# Note: This router is included by the parent billing router which already has /billing prefix
# So we only need /subscriptions here to avoid /billing/billing/subscriptions
router = APIRouter(prefix="/subscriptions", tags=["Billing - Subscriptions"])


# Subscription Plans Management


@router.post(
    "/plans",
    response_model=SubscriptionPlanResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
@rate_limit("20/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
async def create_subscription_plan(
    request: Request,
    plan_data: SubscriptionPlanCreateRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Create a new subscription plan. Requires billing:subscriptions:write permission."""
    service = SubscriptionService(db_session)
    try:
        plan = await service.create_plan(plan_data, tenant_id)
        return plan.model_dump(mode="json")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/plans", response_model=list[SubscriptionPlanResponse])
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
async def list_subscription_plans(
    request: Request,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    product_id: str | None = Query(None, description="Filter by product ID"),
    active_only: bool = Query(True, description="Show only active plans"),
) -> list[dict[str, Any]]:
    """List subscription plans."""
    service = SubscriptionService(db_session)
    plans = await service.list_plans(
        tenant_id,
        product_id=product_id,
        active_only=active_only,
    )
    # Return list of dicts and let FastAPI serialize using response_model
    return [plan.model_dump(mode="json") for plan in plans]


@router.get("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
async def get_subscription_plan(
    request: Request,
    plan_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Get a specific subscription plan."""
    service = SubscriptionService(db_session)
    try:
        plan = await service.get_plan(plan_id, tenant_id)
        return plan.model_dump(mode="json")
    except PlanNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Subscription plan {plan_id} not found"
        )


@router.patch(
    "/plans/{plan_id}",
    response_model=SubscriptionPlanResponse,
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
async def update_subscription_plan(
    plan_id: str,
    plan_data: dict[str, str],  # Using dict for flexible updates
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> SubscriptionPlanResponse:
    """Update a subscription plan. Requires billing:subscriptions:write permission."""
    # Note: This endpoint is a placeholder - update_plan method doesn't exist in service
    # Would need to implement plan update logic in service layer
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Plan updates not yet implemented in service layer",
    )


@router.delete(
    "/plans/{plan_id}",
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
async def deactivate_subscription_plan(
    plan_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """Deactivate a subscription plan (soft delete). Requires billing:subscriptions:write permission."""
    # Note: This endpoint is a placeholder - deactivate_plan method doesn't exist in service
    # Would need to implement plan deactivation logic in service layer
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Plan deactivation not yet implemented in service layer",
    )


# Customer Subscriptions Management


@router.post(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
async def create_subscription(
    subscription_data: SubscriptionCreateRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Create a new customer subscription. Requires billing:subscriptions:write permission."""
    service = SubscriptionService(db_session)
    try:
        subscription = await service.create_subscription(subscription_data, tenant_id)
        response_data = subscription.model_dump(mode="json")
        # Add computed fields
        response_data["is_in_trial"] = subscription.is_in_trial()
        response_data["days_until_renewal"] = subscription.days_until_renewal()
        # Return dict and let FastAPI serialize using response_model
        return response_data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    customer_id: str | None = Query(None, description="Filter by customer ID"),
    plan_id: str | None = Query(None, description="Filter by plan ID"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
) -> list[SubscriptionResponse]:
    """List customer subscriptions."""
    service = SubscriptionService(db_session)

    # Convert string status to enum if provided
    status_enum: SubscriptionStatus | None = None
    if status_filter:
        try:
            status_enum = SubscriptionStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status value. Must be one of: {[s.value for s in SubscriptionStatus]}",
            )

    subscriptions = await service.list_subscriptions(
        tenant_id,
        customer_id=customer_id,
        plan_id=plan_id,
        status=status_enum,
    )

    response_list = []
    for sub in subscriptions:
        response_data = sub.model_dump()
        response_data["is_in_trial"] = sub.is_in_trial()
        response_data["days_until_renewal"] = sub.days_until_renewal()
        subscription_response = SubscriptionResponse.model_validate(response_data)
        response_list.append(subscription_response)

    return response_list


@router.get("/expiring")
async def get_expiring_subscriptions(
    days: int = Query(
        default=30, description="Number of days ahead to check for expiring subscriptions"
    ),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, int | str | None]:
    """
    Get subscriptions expiring within the specified number of days.

    Returns count and details of subscriptions approaching expiration.
    """
    try:
        from datetime import datetime, timedelta

        from sqlalchemy import and_, func, select

        from dotmac.platform.billing.models import BillingSubscriptionTable

        # Calculate expiration window
        now = datetime.now(UTC)
        expiration_date = now + timedelta(days=days)

        # Query subscriptions expiring in the next N days
        query = select(
            func.count(BillingSubscriptionTable.subscription_id).label("count"),
            func.min(BillingSubscriptionTable.current_period_end).label("soonest_expiration"),
        ).where(
            and_(
                BillingSubscriptionTable.tenant_id == tenant_id,
                BillingSubscriptionTable.status == SubscriptionStatus.ACTIVE.value,
                BillingSubscriptionTable.current_period_end <= expiration_date,
                BillingSubscriptionTable.current_period_end > now,
            )
        )

        result = await db_session.execute(query)
        row = result.one()

        # Access labeled columns as tuple unpacking
        count_value: int = 0
        soonest_exp_value: str | None = None

        # Get values from row tuple
        if len(row) >= 2:
            count_raw = row[0]
            soonest_raw = row[1]
            count_value = int(count_raw) if count_raw is not None else 0
            soonest_exp_value = soonest_raw.isoformat() if soonest_raw else None

        return {
            "count": count_value,
            "days_ahead": days,
            "soonest_expiration": soonest_exp_value,
            "timestamp": now.isoformat(),
        }

    except Exception as e:
        import structlog

        logger = structlog.get_logger(__name__)
        logger.error("Failed to fetch expiring subscriptions", error=str(e), exc_info=True)
        # Return empty result on error
        return {
            "count": 0,
            "days_ahead": days,
            "soonest_expiration": None,
            "timestamp": datetime.now(UTC).isoformat(),
        }


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> SubscriptionResponse:
    """Get a specific subscription."""
    service = SubscriptionService(db_session)
    subscription = await service.get_subscription(subscription_id, tenant_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    response_data = subscription.model_dump()
    response_data["is_in_trial"] = subscription.is_in_trial()
    response_data["days_until_renewal"] = subscription.days_until_renewal()
    subscription_response: SubscriptionResponse = SubscriptionResponse.model_validate(response_data)
    return subscription_response


@router.patch(
    "/{subscription_id}",
    response_model=SubscriptionResponse,
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
async def update_subscription(
    subscription_id: str,
    update_data: SubscriptionUpdateRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> SubscriptionResponse:
    """Update a subscription. Requires billing:subscriptions:write permission."""
    service = SubscriptionService(db_session)
    try:
        subscription = await service.update_subscription(subscription_id, update_data, tenant_id)
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found"
            )

        response_data = subscription.model_dump()
        response_data["is_in_trial"] = subscription.is_in_trial()
        response_data["days_until_renewal"] = subscription.days_until_renewal()
        subscription_response: SubscriptionResponse = SubscriptionResponse.model_validate(
            response_data
        )
        return subscription_response
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Subscription Lifecycle Operations


@router.post(
    "/{subscription_id}/cancel",
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
async def cancel_subscription(
    subscription_id: str,
    at_period_end: bool = Query(True, description="Cancel at current period end"),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """Cancel a subscription. Requires billing:subscriptions:write permission."""
    service = SubscriptionService(db_session)
    try:
        # cancel_subscription returns Subscription, not bool
        updated_subscription = await service.cancel_subscription(
            subscription_id, tenant_id, at_period_end
        )
        if not updated_subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found"
            )

        message = (
            "Subscription will be canceled at the end of current period"
            if at_period_end
            else "Subscription canceled immediately"
        )
        return JSONResponse(content={"message": message}, status_code=status.HTTP_200_OK)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{subscription_id}/reactivate",
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
async def reactivate_subscription(
    subscription_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """Reactivate a canceled subscription. Requires billing:subscriptions:write permission."""
    service = SubscriptionService(db_session)
    try:
        # reactivate_subscription returns Subscription, not bool
        updated_subscription = await service.reactivate_subscription(subscription_id, tenant_id)
        if not updated_subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found or cannot be reactivated",
            )

        return JSONResponse(
            content={"message": "Subscription reactivated successfully"},
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{subscription_id}/change-plan",
    response_model=dict,
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
async def change_subscription_plan(
    subscription_id: str,
    change_data: SubscriptionPlanChangeRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, str | dict[str, str]]:
    """Change subscription plan with proration calculation. Requires billing:subscriptions:write permission."""
    service = SubscriptionService(db_session)
    try:
        # change_plan returns tuple[Subscription, ProrationResult | None]
        updated_subscription, proration_result = await service.change_plan(
            subscription_id, change_data, tenant_id
        )
        if not updated_subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found"
            )

        response: dict[str, str | dict[str, str]] = {
            "message": "Plan change completed successfully",
        }

        if proration_result:
            response["proration"] = proration_result.model_dump()

        return response
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Usage Tracking for Hybrid Plans


@router.post(
    "/{subscription_id}/usage",
    dependencies=[Depends(require_permission("billing:subscriptions:write"))],
)
async def record_usage(
    subscription_id: str,
    usage_data: UsageRecordRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """Record usage for usage-based or hybrid subscriptions. Requires billing:subscriptions:write permission."""
    service = SubscriptionService(db_session)
    try:
        # record_usage returns dict[str, int] (updated usage records)
        updated_usage = await service.record_usage(usage_data, tenant_id)
        if not updated_usage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found"
            )

        return JSONResponse(
            content={"message": "Usage recorded successfully"}, status_code=status.HTTP_201_CREATED
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{subscription_id}/usage")
async def get_subscription_usage(
    subscription_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, str | dict[str, int]]:
    """Get current usage for a subscription."""
    service = SubscriptionService(db_session)
    usage = await service.get_usage(subscription_id, tenant_id)
    if usage is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    return {"subscription_id": subscription_id, "usage": usage}


# Proration Preview


@router.post("/proration-preview", response_model=ProrationResult)
async def preview_plan_change_proration(
    subscription_id: str,
    new_plan_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> ProrationResult:
    """Preview proration calculation for plan change."""
    service = SubscriptionService(db_session)
    try:
        proration = await service.calculate_proration_preview(
            subscription_id, new_plan_id, tenant_id
        )
        if proration is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Subscription or plan not found"
            )

        proration_result: ProrationResult = proration
        return proration_result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Subscription Renewal Endpoints


@router.get("/subscriptions/{subscription_id}/renewal-eligibility")
@rate_limit("30/minute")  # type: ignore[misc]
async def check_subscription_renewal_eligibility(
    request: Request,
    subscription_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Check if a subscription is eligible for renewal.

    Returns detailed eligibility information including:
    - Whether renewal is allowed
    - Current pricing
    - Days until renewal
    - Any blocking reasons
    """

    service = SubscriptionService(db_session)
    try:
        eligibility = await service.check_renewal_eligibility(subscription_id, tenant_id)
        return eligibility
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/subscriptions/{subscription_id}/extend")
@rate_limit("10/minute")  # type: ignore[misc]
async def extend_subscription(
    request: Request,
    subscription_id: str,
    payment_id: str | None = Query(None, description="Associated payment ID"),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> SubscriptionResponse:
    """
    Extend subscription to the next billing period.

    This endpoint:
    1. Validates the subscription can be extended
    2. Extends the billing period by one cycle
    3. Resets usage counters
    4. Creates a renewal event

    Typically called after successful payment processing.
    """
    service = SubscriptionService(db_session)
    try:
        extended_subscription = await service.extend_subscription(
            subscription_id=subscription_id,
            tenant_id=tenant_id,
            payment_id=payment_id,
            user_id=current_user.user_id,
        )

        # Convert to response model
        response = SubscriptionResponse(
            subscription_id=extended_subscription.subscription_id,
            tenant_id=extended_subscription.tenant_id,
            customer_id=extended_subscription.customer_id,
            plan_id=extended_subscription.plan_id,
            current_period_start=extended_subscription.current_period_start,
            current_period_end=extended_subscription.current_period_end,
            status=extended_subscription.status,
            trial_end=extended_subscription.trial_end,
            cancel_at_period_end=extended_subscription.cancel_at_period_end,
            canceled_at=extended_subscription.canceled_at,
            ended_at=extended_subscription.ended_at,
            custom_price=extended_subscription.custom_price,
            usage_records=extended_subscription.usage_records,
            metadata=extended_subscription.metadata,
            created_at=extended_subscription.created_at,
            updated_at=extended_subscription.updated_at,
            is_in_trial=extended_subscription.is_in_trial(),
            days_until_renewal=extended_subscription.days_until_renewal(),
        )

        return response
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/subscriptions/{subscription_id}/renewal-payment")
@rate_limit("10/minute")  # type: ignore[misc]
async def process_subscription_renewal_payment(
    request: Request,
    subscription_id: str,
    payment_method_id: str = Query(..., description="Payment method to use"),
    idempotency_key: str | None = Query(None, description="Idempotency key"),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Process payment for subscription renewal.

    This endpoint:
    1. Checks renewal eligibility
    2. Calculates renewal amount
    3. Prepares payment details
    4. Returns payment information for processing

    Note: Actual payment provider integration should be handled by the caller.
    After successful payment, call the /extend endpoint to update the subscription.
    """

    service = SubscriptionService(db_session)
    try:
        payment_details = await service.process_renewal_payment(
            subscription_id=subscription_id,
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            idempotency_key=idempotency_key,
        )

        return payment_details
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/subscriptions/{subscription_id}/renewal-quote")
@rate_limit("20/minute")  # type: ignore[misc]
async def create_subscription_renewal_quote(
    request: Request,
    subscription_id: str,
    customer_id: str = Query(..., description="Customer ID"),
    discount_percentage: float | None = Query(None, description="Renewal discount %", ge=0, le=100),
    valid_days: int = Query(30, description="Quote validity days", ge=1, le=90),
    notes: str | None = Query(None, description="Additional notes"),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Create a renewal quote for a subscription.

    This creates a formal quote document that can be sent to the customer
    for review and acceptance before renewal.
    """
    from decimal import Decimal
    from uuid import UUID

    from dotmac.platform.crm.service import QuoteService

    # First get subscription details
    subscription_service = SubscriptionService(db_session)
    try:
        subscription = await subscription_service.get_subscription(subscription_id, tenant_id)
        plan = await subscription_service.get_plan(subscription.plan_id, tenant_id)

        # Prepare subscription data for quote
        subscription_data = {
            "subscription_id": subscription_id,
            "plan_name": plan.name,
            "service_plan_speed": plan.name,
            "bandwidth": plan.name,
            "renewal_price": subscription.custom_price if subscription.custom_price else plan.price,
            "amount": subscription.custom_price if subscription.custom_price else plan.price,
            "billing_cycle": plan.billing_cycle.value,
            "contract_term_months": 12,  # Default, can be customized
        }

        # Create renewal quote via CRM service
        quote_service = QuoteService(db_session)
        quote = await quote_service.create_renewal_quote(
            tenant_id=tenant_id,
            customer_id=UUID(customer_id),
            subscription_data=subscription_data,
            valid_days=valid_days,
            discount_percentage=Decimal(str(discount_percentage)) if discount_percentage else None,
            notes=notes,
            created_by_id=UUID(current_user.user_id) if current_user.user_id else None,
        )

        await db_session.commit()

        return {
            "quote_id": str(quote.id),
            "quote_number": quote.quote_number,
            "status": quote.status.value,
            "subscription_id": subscription_id,
            "customer_id": customer_id,
            "monthly_recurring_charge": float(quote.monthly_recurring_charge),
            "valid_until": quote.valid_until.isoformat(),
            "line_items": quote.line_items,
            "metadata": quote.metadata,
            "notes": quote.notes,
        }
    except Exception as e:
        await db_session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
