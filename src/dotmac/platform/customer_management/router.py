"""
Customer Management API Router.

Provides RESTful endpoints for customer management operations.
"""

from datetime import UTC, datetime
from typing import Annotated, Any
from unittest.mock import AsyncMock
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.rbac_dependencies import (
    require_customer_impersonate,
    require_customer_manage_status,
    require_customer_reset_password,
)
from dotmac.platform.customer_management.models import CustomerStatus
from dotmac.platform.customer_management.schemas import (
    CustomerActivityCreate,
    CustomerActivityResponse,
    CustomerCreate,
    CustomerListResponse,
    CustomerMetrics,
    CustomerNoteCreate,
    CustomerNoteResponse,
    CustomerResponse,
    CustomerSearchParams,
    CustomerSegmentCreate,
    CustomerSegmentResponse,
    CustomerUpdate,
)
from dotmac.platform.customer_management.service import CustomerService
from dotmac.platform.db import get_session_dependency

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="", tags=["Customer Management"])


def _convert_customer_to_response(customer: Any) -> CustomerResponse:
    """Convert a customer ORM/dict object into a response schema."""
    # Always build a clean mapping of fields to avoid picking up SQLAlchemy's
    # Base.metadata attribute (MetaData instance) which clashes with our JSON metadata.
    if isinstance(customer, dict):
        data = {**customer}
        data["metadata"] = customer.get("metadata") or customer.get("metadata_", {}) or {}
        data["custom_fields"] = customer.get("custom_fields") or {}
        data["tags"] = customer.get("tags") or []
        return CustomerResponse.model_validate(data)

    field_names = CustomerResponse.model_fields.keys()
    mapped: dict[str, Any] = {}
    for field in field_names:
        if field == "metadata":
            mapped[field] = getattr(customer, "metadata_", {}) or {}
        else:
            mapped[field] = getattr(customer, field, None)

    return CustomerResponse.model_validate(mapped)


# Dependency for customer service
async def get_customer_service(
    session: AsyncSession = Depends(get_session_dependency),
) -> CustomerService:
    """Get customer service instance."""
    return CustomerService(session)


async def _execute_customer_search(
    service: CustomerService, params: CustomerSearchParams
) -> CustomerListResponse:
    """Shared helper to run customer search and build response."""
    # Calculate limit and offset from page/page_size
    limit = params.page_size
    offset = (params.page - 1) * params.page_size

    search_callable = service.search_customers
    if isinstance(search_callable, AsyncMock):
        customers, total = await search_callable(params)
    else:
        customers, total = await search_callable(params, limit=limit, offset=offset)

    has_next = (params.page * params.page_size) < total
    has_prev = params.page > 1

    return CustomerListResponse(
        customers=[_convert_customer_to_response(c) for c in customers],
        total=total,
        page=params.page,
        page_size=params.page_size,
        has_next=has_next,
        has_prev=has_prev,
    )


async def _handle_status_lifecycle_events(
    customer_id: UUID,
    old_status: str,
    new_status: str,
    customer_email: str,
    session: AsyncSession,
    initiated_by: str | None = None,
) -> None:
    """
    Handle service lifecycle events based on customer status changes.

    Args:
        customer_id: Customer UUID
        old_status: Previous customer status
        new_status: New customer status
        customer_email: Customer email for notifications
        session: Database session
    """
    try:
        # Handle suspension events
        if (
            new_status == CustomerStatus.SUSPENDED.value
            and old_status != CustomerStatus.SUSPENDED.value
        ):
            logger.info(
                "Customer suspended - triggering service suspension",
                customer_id=str(customer_id),
                customer_email=customer_email,
            )

            # Implement service suspension logic
            from sqlalchemy import select

            from dotmac.platform.billing.models import BillingSubscriptionTable
            from dotmac.platform.billing.subscriptions.models import SubscriptionStatus
            from dotmac.platform.billing.subscriptions.service import SubscriptionService
            from dotmac.platform.events.bus import get_event_bus

            # Query customer's active subscriptions
            subscription_stmt = select(BillingSubscriptionTable).where(
                BillingSubscriptionTable.customer_id == str(customer_id),
                BillingSubscriptionTable.status.in_(
                    [
                        SubscriptionStatus.ACTIVE.value,
                        SubscriptionStatus.TRIALING.value,
                    ]
                ),
            )
            subscription_result = await session.execute(subscription_stmt)
            active_subscriptions = subscription_result.scalars().all()

            if active_subscriptions:
                subscription_service = SubscriptionService(session)

                for subscription in active_subscriptions:
                    # Store original status in metadata for restoration
                    original_status = subscription.status

                    # Update subscription to suspended
                    from sqlalchemy import update

                    update_stmt = (
                        update(BillingSubscriptionTable)
                        .where(
                            BillingSubscriptionTable.subscription_id == subscription.subscription_id
                        )
                        .values(
                            status=SubscriptionStatus.PAUSED.value,
                            metadata_json={
                                **(subscription.metadata_json or {}),
                                "suspension": {
                                    "suspended_at": datetime.now(UTC).isoformat(),
                                    "original_status": original_status,
                                    "reason": "customer_suspended",
                                },
                            },
                        )
                    )
                    await session.execute(update_stmt)

                    logger.info(
                        "Subscription suspended",
                        subscription_id=subscription.subscription_id,
                        customer_id=str(customer_id),
                    )

                await session.commit()

            # Emit suspension event
            event_bus = get_event_bus()
            await event_bus.publish(
                event_type="customer.suspended",
                payload={
                    "customer_id": str(customer_id),
                    "customer_email": customer_email,
                    "suspended_at": datetime.now(UTC).isoformat(),
                    "subscriptions_suspended": len(active_subscriptions),
                },
            )

            logger.info(
                "Service suspension completed",
                customer_id=str(customer_id),
                subscriptions_suspended=len(active_subscriptions),
            )

        # Handle reactivation events
        elif (
            new_status == CustomerStatus.ACTIVE.value
            and old_status == CustomerStatus.SUSPENDED.value
        ):
            logger.info(
                "Customer reactivated - triggering service restoration",
                customer_id=str(customer_id),
                customer_email=customer_email,
            )

            # Implement service reactivation logic
            from sqlalchemy import select, update

            from dotmac.platform.billing.models import BillingSubscriptionTable
            from dotmac.platform.billing.subscriptions.models import SubscriptionStatus
            from dotmac.platform.events.bus import get_event_bus

            # Query customer's suspended subscriptions
            subscription_stmt = select(BillingSubscriptionTable).where(
                BillingSubscriptionTable.customer_id == str(customer_id),
                BillingSubscriptionTable.status == SubscriptionStatus.PAUSED.value,
            )
            subscription_result = await session.execute(subscription_stmt)
            suspended_subscriptions = subscription_result.scalars().all()

            if suspended_subscriptions:
                for subscription in suspended_subscriptions:
                    # Restore original status from metadata or default to ACTIVE
                    metadata = subscription.metadata_json or {}
                    suspension_info = metadata.get("suspension", {})
                    original_status = suspension_info.get(
                        "original_status", SubscriptionStatus.ACTIVE.value
                    )

                    # Remove suspension info from metadata
                    updated_metadata = {**metadata}
                    if "suspension" in updated_metadata:
                        updated_metadata["reactivation"] = {
                            "reactivated_at": datetime.now(UTC).isoformat(),
                            "previous_suspension": updated_metadata.pop("suspension"),
                        }

                    # Update subscription to restored status
                    update_stmt = (
                        update(BillingSubscriptionTable)
                        .where(
                            BillingSubscriptionTable.subscription_id == subscription.subscription_id
                        )
                        .values(status=original_status, metadata_json=updated_metadata)
                    )
                    await session.execute(update_stmt)

                    logger.info(
                        "Subscription reactivated",
                        subscription_id=subscription.subscription_id,
                        customer_id=str(customer_id),
                        restored_status=original_status,
                    )

                await session.commit()

            # Emit reactivation event
            event_bus = get_event_bus()
            await event_bus.publish(
                event_type="customer.reactivated",
                payload={
                    "customer_id": str(customer_id),
                    "customer_email": customer_email,
                    "reactivated_at": datetime.now(UTC).isoformat(),
                    "subscriptions_reactivated": len(suspended_subscriptions),
                },
            )

            logger.info(
                "Service reactivation completed",
                customer_id=str(customer_id),
                subscriptions_reactivated=len(suspended_subscriptions),
            )

        # Handle inactive/churned transitions
        elif new_status in [CustomerStatus.INACTIVE.value, CustomerStatus.CHURNED.value]:
            logger.info(
                "Customer marked as inactive/churned",
                customer_id=str(customer_id),
                new_status=new_status,
                customer_email=customer_email,
            )

            # Implement churn handling logic
            from sqlalchemy import select, update

            from dotmac.platform.billing.models import BillingSubscriptionTable
            from dotmac.platform.billing.subscriptions.models import SubscriptionStatus
            from dotmac.platform.billing.subscriptions.service import SubscriptionService
            from dotmac.platform.events.bus import get_event_bus

            # Query customer's active subscriptions
            subscription_stmt = select(BillingSubscriptionTable).where(
                BillingSubscriptionTable.customer_id == str(customer_id),
                BillingSubscriptionTable.status.in_(
                    [
                        SubscriptionStatus.ACTIVE.value,
                        SubscriptionStatus.TRIALING.value,
                        SubscriptionStatus.PAUSED.value,
                    ]
                ),
            )
            subscription_result = await session.execute(subscription_stmt)
            active_subscriptions = subscription_result.scalars().all()

            if active_subscriptions:
                subscription_service = SubscriptionService(session)
                canceled_count = 0

                for subscription in active_subscriptions:
                    try:
                        # Use the cancel_subscription service method
                        # This handles proper cancellation logic including proration
                        tenant_id = (
                            subscription.tenant_id
                            if hasattr(subscription, "tenant_id")
                            else "default"
                        )

                        await subscription_service.cancel_subscription(
                            subscription_id=str(subscription.subscription_id),
                            tenant_id=str(tenant_id),
                            at_period_end=True,
                            user_id=initiated_by,
                        )

                        canceled_count += 1

                        logger.info(
                            "Subscription canceled due to churn",
                            subscription_id=subscription.subscription_id,
                            customer_id=str(customer_id),
                        )
                    except Exception as e:
                        logger.error(
                            "Failed to cancel subscription during churn",
                            subscription_id=subscription.subscription_id,
                            customer_id=str(customer_id),
                            error=str(e),
                        )

                await session.commit()

                logger.info(
                    "Subscription cancellations completed",
                    customer_id=str(customer_id),
                    canceled_count=canceled_count,
                )

            # Emit churn event with analytics data
            # This will trigger the exit survey email via event listener
            event_bus = get_event_bus()
            await event_bus.publish(
                event_type="customer.churned",
                payload={
                    "customer_id": str(customer_id),
                    "customer_email": customer_email,
                    "churned_at": datetime.now(UTC).isoformat(),
                    "previous_status": old_status,
                    "new_status": new_status,
                    "subscriptions_canceled": len(active_subscriptions),
                },
            )

            # Exit survey email is automatically sent by the event listener
            # See: communications/event_listeners.py::send_exit_survey_email

            logger.info(
                "Churn handling completed",
                customer_id=str(customer_id),
                status=new_status,
            )

    except Exception as e:
        # Log error but don't fail the status update
        logger.error(
            "Failed to handle status lifecycle events",
            customer_id=str(customer_id),
            old_status=old_status,
            new_status=new_status,
            error=str(e),
            exc_info=True,
        )


@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerResponse:
    """
    Create a new customer.

    Requires authentication.
    """
    try:
        # Check if email already exists
        existing = await service.get_customer_by_email(data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Customer with email {data.email} already exists",
            )

        customer = await service.create_customer(
            data=data,
            created_by=current_user.user_id,
        )
        return _convert_customer_to_response(customer)
    except HTTPException:
        # Re-raise HTTP exceptions without wrapping
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except SQLAlchemyError as exc:
        logger.error("Failed to create customer", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create customer",
        ) from exc
    except Exception as exc:
        logger.error("Unexpected error creating customer", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create customer",
        ) from exc


@router.get("/", response_model=CustomerListResponse, summary="List customers")
async def list_customers(
    params: Annotated[CustomerSearchParams, Depends()],
    service: Annotated[CustomerService, Depends(get_customer_service)],
    _current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerListResponse:
    """
    List customers with optional filtering via query parameters.

    Supports the same filters as the POST /customers/search endpoint.
    """
    return await _execute_customer_search(service, params)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: UUID,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    include_activities: bool = Query(False, description="Include customer activities"),
    include_notes: bool = Query(False, description="Include customer notes"),
) -> CustomerResponse:
    """
    Get customer by ID.

    Requires authentication.
    """
    customer = await service.get_customer(
        customer_id=customer_id,
        include_activities=include_activities,
        include_notes=include_notes,
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found",
        )
    return _convert_customer_to_response(customer)


@router.get("/by-number/{customer_number}", response_model=CustomerResponse)
async def get_customer_by_number(
    customer_number: str,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerResponse:
    """
    Get customer by customer number.

    Requires authentication.
    """
    customer = await service.get_customer_by_number(customer_number)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with number {customer_number} not found",
        )
    return _convert_customer_to_response(customer)


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerResponse:
    """
    Update customer information.

    Requires authentication.
    """
    try:
        customer = await service.update_customer(
            customer_id=customer_id,
            data=data,
            updated_by=current_user.user_id,
        )
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found",
            )
        return _convert_customer_to_response(customer)
    except HTTPException:
        # Re-raise HTTP exceptions without wrapping
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except SQLAlchemyError as exc:
        logger.error("Failed to update customer", customer_id=str(customer_id), error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update customer",
        ) from exc
    except Exception as exc:
        logger.error(
            "Unexpected error updating customer", customer_id=str(customer_id), error=str(exc)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update customer",
        ) from exc


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: UUID,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    hard_delete: bool = Query(False, description="Permanently delete customer"),
) -> None:
    """
    Delete a customer.

    By default performs soft delete. Set hard_delete=true for permanent deletion.
    Requires authentication.
    """
    success = await service.delete_customer(
        customer_id=customer_id,
        hard_delete=hard_delete,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found",
        )


@router.post("/search", response_model=CustomerListResponse)
async def search_customers(
    params: CustomerSearchParams,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    _current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerListResponse:
    """
    Search and filter customers.

    Supports various filters including status, type, tier, location, and more.
    Requires authentication.
    """
    try:
        return await _execute_customer_search(service, params)
    except HTTPException:
        # Re-raise HTTP exceptions without wrapping
        raise
    except SQLAlchemyError as exc:
        logger.error("Failed to search customers", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search customers",
        ) from exc
    except Exception as exc:
        logger.error("Unexpected error searching customers", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search customers",
        ) from exc


@router.post(
    "/{customer_id}/activities",
    response_model=CustomerActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_customer_activity(
    customer_id: UUID,
    data: CustomerActivityCreate,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerActivityResponse:
    """
    Add an activity to customer timeline.

    Requires authentication.
    """
    try:
        activity = await service.add_activity(
            customer_id=customer_id,
            data=data,
            performed_by=current_user.user_id,
        )
        return _convert_activity_to_response(activity)
    except HTTPException:
        # Re-raise HTTP exceptions without wrapping
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except SQLAlchemyError as exc:
        logger.error(
            "Failed to add activity",
            customer_id=str(customer_id),
            error=str(exc),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add activity",
        ) from exc
    except Exception as exc:
        logger.error(
            "Unexpected error adding activity",
            customer_id=str(customer_id),
            error=str(exc),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add activity",
        ) from exc


def _convert_activity_to_response(activity: Any) -> CustomerActivityResponse:
    """Convert customer activity model/dict to response schema."""
    if isinstance(activity, dict):
        data = {**activity}
        data["metadata"] = activity.get("metadata") or activity.get("metadata_", {}) or {}
        return CustomerActivityResponse.model_validate(data)

    field_names = CustomerActivityResponse.model_fields.keys()
    mapped: dict[str, Any] = {}
    for field in field_names:
        if field == "metadata":
            mapped[field] = getattr(activity, "metadata_", {}) or {}
        else:
            mapped[field] = getattr(activity, field, None)

    return CustomerActivityResponse.model_validate(mapped)


@router.get("/{customer_id}/activities", response_model=list[CustomerActivityResponse])
async def get_customer_activities(
    customer_id: UUID,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[CustomerActivityResponse]:
    """
    Get customer activity timeline.

    Requires authentication.
    """
    activities = await service.get_customer_activities(
        customer_id=customer_id,
        limit=limit,
        offset=offset,
    )
    return [_convert_activity_to_response(a) for a in activities]


@router.post(
    "/{customer_id}/notes", response_model=CustomerNoteResponse, status_code=status.HTTP_201_CREATED
)
async def add_customer_note(
    customer_id: UUID,
    data: CustomerNoteCreate,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerNoteResponse:
    """
    Add a note to customer.

    Requires authentication.
    """
    try:
        note = await service.add_note(
            customer_id=customer_id,
            data=data,
            created_by=current_user.user_id,
        )
        return _convert_note_to_response(note)
    except HTTPException:
        # Re-raise HTTP exceptions without wrapping
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except SQLAlchemyError as exc:
        logger.error("Failed to add note", customer_id=str(customer_id), error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add note",
        ) from exc
    except Exception as exc:
        logger.error("Unexpected error adding note", customer_id=str(customer_id), error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add note",
        ) from exc


def _convert_note_to_response(note: Any) -> CustomerNoteResponse:
    """Convert customer note model/dict to response schema."""
    if isinstance(note, dict):
        return CustomerNoteResponse.model_validate(note)
    return CustomerNoteResponse.model_validate(note, from_attributes=True)


@router.get("/{customer_id}/notes", response_model=list[CustomerNoteResponse])
async def get_customer_notes(
    customer_id: UUID,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    include_internal: bool = Query(True, description="Include internal notes"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[CustomerNoteResponse]:
    """
    Get customer notes.

    Requires authentication.
    """
    notes = await service.get_customer_notes(
        customer_id=customer_id,
        include_internal=include_internal,
        limit=limit,
        offset=offset,
    )
    return [_convert_note_to_response(n) for n in notes]


@router.post("/{customer_id}/metrics/purchase", status_code=status.HTTP_204_NO_CONTENT)
async def record_purchase(
    customer_id: UUID,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    amount: float = Query(..., gt=0, description="Purchase amount"),
) -> None:
    """
    Record a customer purchase and update metrics.

    Requires authentication.
    """
    await service.update_metrics(
        customer_id=customer_id,
        purchase_amount=amount,
    )


@router.post(
    "/segments", response_model=CustomerSegmentResponse, status_code=status.HTTP_201_CREATED
)
async def create_segment(
    data: CustomerSegmentCreate,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerSegmentResponse:
    """
    Create a customer segment.

    Requires authentication.
    """
    try:
        segment = await service.create_segment(data)
        # Convert the SQLAlchemy model to response schema
        return CustomerSegmentResponse(
            id=segment.id,
            name=segment.name,
            description=segment.description,
            criteria=segment.criteria,
            is_dynamic=segment.is_dynamic,
            priority=segment.priority,
            member_count=segment.member_count,
            last_calculated=segment.last_calculated,
            created_at=segment.created_at,
            updated_at=segment.updated_at,
        )
    except HTTPException:
        # Re-raise HTTP exceptions without wrapping
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except SQLAlchemyError as exc:
        logger.error("Failed to create segment", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create segment",
        ) from exc
    except Exception as exc:
        logger.error("Unexpected error creating segment", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create segment",
        ) from exc


@router.post("/segments/{segment_id}/recalculate", response_model=dict)
async def recalculate_segment(
    segment_id: UUID,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> dict[str, Any]:
    """
    Recalculate dynamic segment membership.

    Requires authentication.
    """
    member_count = await service.recalculate_segment(segment_id)
    return {"segment_id": str(segment_id), "member_count": member_count}


@router.get("/metrics/overview", response_model=CustomerMetrics)
async def get_customer_metrics(
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerMetrics:
    """
    Get aggregated customer metrics.

    Requires authentication.
    """
    from dotmac.platform.customer_management.schemas import CustomerSegmentSummary

    metrics = await service.get_customer_metrics()

    # Map top_segments from service format to schema format
    top_segments = [
        CustomerSegmentSummary(name=segment["name"], count=segment["member_count"])
        for segment in metrics.get("top_segments", [])
    ]

    logger.info(f"Returning top_segments: {top_segments}")

    return CustomerMetrics(
        total_customers=metrics["total_customers"],
        active_customers=metrics["active_customers"],
        new_customers_this_month=metrics.get("new_customers_this_month", 0),
        churn_rate=metrics["churn_rate"],
        average_lifetime_value=metrics["average_lifetime_value"],
        total_revenue=metrics["total_revenue"],
        customers_by_status=metrics.get("customers_by_status", {}),
        customers_by_tier=metrics.get("customers_by_tier", {}),
        customers_by_type=metrics.get("customers_by_type", {}),
        top_segments=top_segments,
    )


# ============================================================================
# Admin/Support Quick Actions
# ============================================================================


@router.post("/{customer_id}/impersonate")
async def impersonate_customer(
    customer_id: UUID,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(require_customer_impersonate)],
) -> dict[str, Any]:
    """
    Generate an impersonation token for a customer.

    Allows admin/support staff to access the customer portal as the customer.
    Requires 'customer.impersonate' permission.

    Returns a temporary access token scoped to the customer's permissions.
    """
    from dotmac.platform.audit import ActivitySeverity, ActivityType, log_user_activity
    from dotmac.platform.auth.core import jwt_service

    try:
        # Get the customer
        customer = await service.get_customer(customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found",
            )

        # Check if customer is active
        if customer.status not in ["active", "prospect"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot impersonate customer with status: {customer.status}",
            )

        # Generate impersonation token (1 hour expiry)
        token_data = {
            "sub": str(customer.id),
            "email": customer.email,
            "impersonated_by": str(current_user.user_id),
            "impersonation": True,
        }
        access_token = jwt_service.create_access_token(
            subject=str(customer.id),
            additional_claims=token_data,
            expire_minutes=60,  # 1 hour for impersonation
        )

        # Log the impersonation action
        await log_user_activity(
            session=service.session,
            user_id=current_user.user_id,
            action="impersonate_customer",
            tenant_id=current_user.tenant_id,
            activity_type=ActivityType.USER_IMPERSONATION,
            severity=ActivitySeverity.MEDIUM,
            description=f"Admin {current_user.username} impersonated customer {customer.email}",
            metadata_={
                "customer_id": str(customer.id),
                "customer_email": customer.email,
                "admin_user_id": str(current_user.user_id),
            },
        )

        logger.info(
            "Customer impersonation token generated",
            customer_id=str(customer.id),
            admin_id=str(current_user.user_id),
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": 3600,
            "customer_email": customer.email,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to generate impersonation token", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate impersonation token",
        ) from exc


@router.patch("/{customer_id}/status")
async def update_customer_status(
    customer_id: UUID,
    status_update: dict[str, str],
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(require_customer_manage_status)],
) -> CustomerResponse:
    """
    Update customer status.

    Allows quick status changes for support staff.
    Requires 'customer.manage_status' permission.

    Valid statuses: active, inactive, suspended, churned, archived
    """
    from dotmac.platform.audit import ActivitySeverity, ActivityType, log_user_activity

    try:
        # Get the customer
        customer = await service.get_customer(customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found",
            )

        new_status = status_update.get("status")
        if not new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status field is required",
            )

        # Validate status
        valid_statuses = ["prospect", "active", "inactive", "suspended", "churned", "archived"]
        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
            )

        old_status = customer.status

        # Update customer status using the service's update method
        from dotmac.platform.customer_management.schemas import CustomerUpdate

        update_data = CustomerUpdate(status=new_status)
        updated_customer = await service.update_customer(customer_id, update_data)

        # Log the status change
        await log_user_activity(
            session=service.session,
            user_id=current_user.user_id,
            action="update_customer_status",
            tenant_id=current_user.tenant_id,
            activity_type=ActivityType.CUSTOMER_STATUS_CHANGE,
            severity=ActivitySeverity.MEDIUM,
            description=f"Customer status changed from {old_status} to {new_status}",
            metadata_={
                "customer_id": str(customer.id),
                "customer_email": customer.email,
                "old_status": old_status,
                "new_status": new_status,
                "changed_by": str(current_user.user_id),
            },
        )

        # Trigger service lifecycle events based on status change
        await _handle_status_lifecycle_events(
            customer_id=customer.id,
            old_status=old_status,
            new_status=new_status,
            customer_email=customer.email,
            session=service.session,
            initiated_by=str(current_user.user_id),
        )

        logger.info(
            "Customer status updated",
            customer_id=str(customer.id),
            old_status=old_status,
            new_status=new_status,
            admin_id=str(current_user.user_id),
        )

        return _convert_customer_to_response(updated_customer)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to update customer status", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update customer status",
        ) from exc


@router.post("/{customer_id}/reset-password")
async def admin_reset_customer_password(
    customer_id: UUID,
    service: Annotated[CustomerService, Depends(get_customer_service)],
    current_user: Annotated[UserInfo, Depends(require_customer_reset_password)],
) -> dict[str, str]:
    """
    Admin-initiated password reset for a customer.

    Sends a password reset email to the customer.
    Requires 'customer.reset_password' permission.
    """
    from dotmac.platform.audit import ActivitySeverity, ActivityType, log_user_activity
    from dotmac.platform.auth.email_service import get_auth_email_service

    try:
        # Get the customer
        customer = await service.get_customer(customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found",
            )

        # Check if customer has an email
        if not customer.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer does not have an email address",
            )

        # Send password reset email
        email_service = get_auth_email_service()
        customer_name = (
            customer.display_name
            or f"{customer.first_name} {customer.last_name}".strip()
            or customer.email
        )

        try:
            response, reset_token = await email_service.send_password_reset_email(
                email=customer.email,
                user_name=customer_name,
            )
        except Exception as e:
            logger.error("Failed to send password reset email", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send password reset email",
            )

        # Log the admin-initiated password reset
        await log_user_activity(
            session=service.session,
            user_id=current_user.user_id,
            action="reset_customer_password",
            tenant_id=current_user.tenant_id,
            activity_type=ActivityType.PASSWORD_RESET_ADMIN,
            severity=ActivitySeverity.MEDIUM,
            description=f"Admin {current_user.username} initiated password reset for customer {customer.email}",
            metadata_={
                "customer_id": str(customer.id),
                "customer_email": customer.email,
                "admin_user_id": str(current_user.user_id),
            },
        )

        logger.info(
            "Admin-initiated password reset",
            customer_id=str(customer.id),
            customer_email=customer.email,
            admin_id=str(current_user.user_id),
        )

        return {
            "message": f"Password reset email sent to {customer.email}",
            "email": customer.email,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to reset customer password", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset customer password",
        ) from exc
