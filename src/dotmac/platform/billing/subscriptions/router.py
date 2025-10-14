"""
Subscription management API router.

Provides REST endpoints for managing subscription plans and customer subscriptions.
"""

from datetime import UTC
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.core.rate_limiting import rate_limit
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

router = APIRouter(tags=["Billing - Subscriptions"])


# Subscription Plans Management


@router.post(
    "/plans",
    response_model=SubscriptionPlanResponse,
    status_code=status.HTTP_201_CREATED,
)
@rate_limit("20/minute")
async def create_subscription_plan(
    request: Request,
    plan_data: SubscriptionPlanCreateRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Create a new subscription plan."""
    service = SubscriptionService(db_session)
    try:
        plan = await service.create_plan(plan_data, tenant_id)
        # Return dict and let FastAPI serialize using response_model
        return cast(dict[str, Any], plan.model_dump(mode="json"))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/plans", response_model=list[SubscriptionPlanResponse])
@rate_limit("100/minute")
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
    return [cast(dict[str, Any], plan.model_dump(mode="json")) for plan in plans]


@router.get("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
@rate_limit("100/minute")
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
        # Return dict and let FastAPI serialize using response_model
        return cast(dict[str, Any], plan.model_dump(mode="json"))
    except PlanNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Subscription plan {plan_id} not found"
        )


@router.patch("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_subscription_plan(
    plan_id: str,
    plan_data: dict[str, str],  # Using dict for flexible updates
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> SubscriptionPlanResponse:
    """Update a subscription plan."""
    # Note: This endpoint is a placeholder - update_plan method doesn't exist in service
    # Would need to implement plan update logic in service layer
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Plan updates not yet implemented in service layer",
    )


@router.delete("/plans/{plan_id}")
async def deactivate_subscription_plan(
    plan_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """Deactivate a subscription plan (soft delete)."""
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
)
async def create_subscription(
    subscription_data: SubscriptionCreateRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Create a new customer subscription."""
    service = SubscriptionService(db_session)
    try:
        subscription = await service.create_subscription(subscription_data, tenant_id)
        response_data = cast(dict[str, Any], subscription.model_dump(mode="json"))
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


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: str,
    update_data: SubscriptionUpdateRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> SubscriptionResponse:
    """Update a subscription."""
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


@router.post("/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: str,
    at_period_end: bool = Query(True, description="Cancel at current period end"),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """Cancel a subscription."""
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


@router.post("/{subscription_id}/reactivate")
async def reactivate_subscription(
    subscription_id: str,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """Reactivate a canceled subscription."""
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


@router.post("/{subscription_id}/change-plan", response_model=dict)
async def change_subscription_plan(
    subscription_id: str,
    change_data: SubscriptionPlanChangeRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, str | dict[str, str]]:
    """Change subscription plan with proration calculation."""
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


@router.post("/{subscription_id}/usage")
async def record_usage(
    subscription_id: str,
    usage_data: UsageRecordRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """Record usage for usage-based or hybrid subscriptions."""
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
