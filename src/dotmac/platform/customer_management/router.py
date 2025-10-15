"""
Customer Management API Router.

Provides RESTful endpoints for customer management operations.
"""

from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
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

router = APIRouter(tags=["Customer Management"])


def _convert_customer_to_response(customer: Any) -> CustomerResponse:
    """Convert Customer model to CustomerResponse, handling metadata_ field."""
    # Create a dict from the customer model
    customer_dict: dict[str, Any] = {}
    for key in CustomerResponse.model_fields:
        if key == "metadata":
            # Map metadata_ to metadata
            customer_dict["metadata"] = customer.metadata_ if hasattr(customer, "metadata_") else {}
        elif hasattr(customer, key):
            customer_dict[key] = getattr(customer, key)
    return CustomerResponse.model_validate(customer_dict)


# Dependency for customer service
async def get_customer_service(
    session: AsyncSession = Depends(get_session_dependency),
) -> CustomerService:
    """Get customer service instance."""
    return CustomerService(session)


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
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> CustomerListResponse:
    """
    Search and filter customers.

    Supports various filters including status, type, tier, location, and more.
    Requires authentication.
    """
    try:
        customers, total = await service.search_customers(params)

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
        logger.error("Failed to add activity", customer_id=str(customer_id), error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add activity",
        ) from exc
    except Exception as exc:
        logger.error(
            "Unexpected error adding activity", customer_id=str(customer_id), error=str(exc)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add activity",
        ) from exc


def _convert_activity_to_response(activity: Any) -> CustomerActivityResponse:
    """Convert CustomerActivity model to CustomerActivityResponse, handling metadata_ field."""
    activity_dict: dict[str, Any] = {}
    for key in CustomerActivityResponse.model_fields:
        if key == "metadata":
            # Map metadata_ to metadata
            activity_dict["metadata"] = activity.metadata_ if hasattr(activity, "metadata_") else {}
        elif hasattr(activity, key):
            activity_dict[key] = getattr(activity, key)
    return CustomerActivityResponse.model_validate(activity_dict)


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
    """Convert CustomerNote model to CustomerNoteResponse."""
    note_dict: dict[str, Any] = {}
    for key in CustomerNoteResponse.model_fields:
        if hasattr(note, key):
            note_dict[key] = getattr(note, key)
    return CustomerNoteResponse.model_validate(note_dict)


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
