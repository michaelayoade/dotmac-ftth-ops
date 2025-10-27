"""
Usage Billing API Router

Provides endpoints for tracking and managing metered service usage,
including data transfer, voice minutes, equipment rentals, and other
pay-as-you-go charges.
"""

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.settings.service import BillingSettingsService
from dotmac.platform.database import get_async_session

from .models import BilledStatus, UsageAggregate, UsageRecord, UsageType
from .schemas import (
    UsageAggregateResponse,
    UsageRecordCreate,
    UsageRecordResponse,
    UsageRecordUpdate,
    UsageStats,
    UsageSummary,
)

# ============================================================================
# Router Definition
# ============================================================================

router = APIRouter(prefix="/usage", tags=["Billing - Usage"])


OVERRIDE_CURRENCY_HEADERS = ("X-Currency", "X-Currency-Code")
OVERRIDE_CURRENCY_QUERY_PARAM = "currency"
OVERRIDE_CURRENCY_STATE_ATTRS = ("currency", "currency_code")


def get_tenant_id_from_request(request: Request) -> str:
    """Extract tenant ID from request."""
    if hasattr(request.state, "tenant_id"):
        tenant_id: str = request.state.tenant_id
        return tenant_id

    tenant_id_header = request.headers.get("X-Tenant-ID")
    if tenant_id_header:
        return tenant_id_header

    tenant_id_query = request.query_params.get("tenant_id")
    if tenant_id_query:
        return tenant_id_query

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tenant ID is required. Provide via X-Tenant-ID header or tenant_id query param.",
    )


def _get_currency_override(request: Request) -> str | None:
    """Return currency override from request state, headers, or query parameters."""
    for attr in OVERRIDE_CURRENCY_STATE_ATTRS:
        override = getattr(request.state, attr, None)
        if isinstance(override, str) and override.strip():
            candidate = override.strip().upper()
            if len(candidate) == 3:
                return candidate

    for header_name in OVERRIDE_CURRENCY_HEADERS:
        header_value = request.headers.get(header_name)
        if header_value:
            candidate = header_value.strip().upper()
            if len(candidate) == 3:
                return candidate

    query_override = request.query_params.get(OVERRIDE_CURRENCY_QUERY_PARAM)
    if query_override:
        candidate = query_override.strip().upper()
        if len(candidate) == 3:
            return candidate

    return None


async def resolve_usage_currency(request: Request, db: AsyncSession, tenant_id: str) -> str:
    """
    Determine currency for usage records.

    Priority order:
    1. Request override (state/header/query)
    2. Tenant billing settings default currency
    3. Fallback to USD
    """
    override = _get_currency_override(request)
    if override:
        return override

    try:
        settings_service = BillingSettingsService(db)
        settings = await settings_service.get_settings(tenant_id)
        default_currency = settings.payment_settings.default_currency
        if default_currency:
            return default_currency.upper()
    except Exception:
        # Fallback to USD when settings retrieval fails
        pass

    return "USD"


def calculate_total_amount(quantity: Decimal, unit_price: Decimal) -> int:
    """Convert quantity * unit_price to cents using round half up."""
    total = (Decimal(quantity) * Decimal(unit_price) * Decimal("100")).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    return int(total)


# ============================================================================
# Request/Response Models
# ============================================================================


class UsageRecordListResponse(BaseModel):
    """Usage record list response model."""

    model_config = ConfigDict()

    usage_records: list[UsageRecordResponse]
    total_count: int
    has_more: bool


class UsageAggregateListResponse(BaseModel):
    """Usage aggregate list response model."""

    model_config = ConfigDict()

    aggregates: list[UsageAggregateResponse]
    total_count: int


class BulkCreateRequest(BaseModel):
    """Bulk create usage records request."""

    model_config = ConfigDict()

    records: list[UsageRecordCreate] = Field(..., min_length=1, max_length=1000)


class BulkCreateResponse(BaseModel):
    """Bulk create usage records response."""

    model_config = ConfigDict()

    created_count: int
    usage_records: list[UsageRecordResponse]


# ============================================================================
# Usage Record Endpoints
# ============================================================================


@router.post("/records", response_model=UsageRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_usage_record(
    record_data: UsageRecordCreate,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> UsageRecordResponse:
    """
    Create a new usage record for metered billing.

    Records usage for services like data transfer, voice minutes,
    equipment rentals, and other pay-as-you-go charges.
    """
    tenant_id = get_tenant_id_from_request(request)

    try:
        currency = await resolve_usage_currency(request, db, tenant_id)
        total_amount = calculate_total_amount(record_data.quantity, record_data.unit_price)

        # Create usage record
        usage_record = UsageRecord(
            tenant_id=tenant_id,
            subscription_id=record_data.subscription_id,
            customer_id=record_data.customer_id,
            usage_type=record_data.usage_type,
            quantity=record_data.quantity,
            unit=record_data.unit,
            unit_price=record_data.unit_price,
            total_amount=total_amount,
            currency=currency,
            period_start=record_data.period_start,
            period_end=record_data.period_end,
            billed_status=BilledStatus.PENDING,
            source_system=record_data.source_system,
            source_record_id=record_data.source_record_id,
            description=record_data.description,
            device_id=record_data.device_id,
            service_location=record_data.service_location,
            created_by=current_user.user_id,
        )

        db.add(usage_record)
        await db.commit()
        await db.refresh(usage_record)

        return UsageRecordResponse.model_validate(usage_record)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create usage record: {str(e)}",
        )


@router.post(
    "/records/bulk", response_model=BulkCreateResponse, status_code=status.HTTP_201_CREATED
)
async def bulk_create_usage_records(
    bulk_data: BulkCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> BulkCreateResponse:
    """
    Bulk create usage records (up to 1000 records).

    Useful for batch imports from RADIUS accounting, CDRs,
    or other usage tracking systems.
    """
    tenant_id = get_tenant_id_from_request(request)

    try:
        usage_records = []
        currency = await resolve_usage_currency(request, db, tenant_id)

        for record_data in bulk_data.records:
            total_amount = calculate_total_amount(record_data.quantity, record_data.unit_price)

            usage_record = UsageRecord(
                tenant_id=tenant_id,
                subscription_id=record_data.subscription_id,
                customer_id=record_data.customer_id,
                usage_type=record_data.usage_type,
                quantity=record_data.quantity,
                unit=record_data.unit,
                unit_price=record_data.unit_price,
                total_amount=total_amount,
                currency=currency,
                period_start=record_data.period_start,
                period_end=record_data.period_end,
                billed_status=BilledStatus.PENDING,
                source_system=record_data.source_system,
                source_record_id=record_data.source_record_id,
                description=record_data.description,
                device_id=record_data.device_id,
                service_location=record_data.service_location,
                created_by=current_user.user_id,
            )
            usage_records.append(usage_record)

        db.add_all(usage_records)
        await db.commit()

        # Refresh all records
        for record in usage_records:
            await db.refresh(record)

        return BulkCreateResponse(
            created_count=len(usage_records),
            usage_records=[UsageRecordResponse.model_validate(r) for r in usage_records],
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk create usage records: {str(e)}",
        )


@router.get("/records", response_model=UsageRecordListResponse)
async def list_usage_records(
    request: Request,
    customer_id: UUID | None = Query(None, description="Filter by customer ID"),
    subscription_id: str | None = Query(None, description="Filter by subscription ID"),
    usage_type: UsageType | None = Query(None, description="Filter by usage type"),
    billed_status: BilledStatus | None = Query(None, description="Filter by billing status"),
    period_start: datetime | None = Query(None, description="Filter by period start date"),
    period_end: datetime | None = Query(None, description="Filter by period end date"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> UsageRecordListResponse:
    """
    List usage records with optional filtering.

    Supports filtering by customer, subscription, usage type, status,
    and time period for flexible reporting and analysis.
    """
    tenant_id = get_tenant_id_from_request(request)

    try:
        # Build query
        query = select(UsageRecord).where(UsageRecord.tenant_id == tenant_id)

        if customer_id:
            query = query.where(UsageRecord.customer_id == customer_id)
        if subscription_id:
            query = query.where(UsageRecord.subscription_id == subscription_id)
        if usage_type:
            query = query.where(UsageRecord.usage_type == usage_type)
        if billed_status:
            query = query.where(UsageRecord.billed_status == billed_status)
        if period_start:
            query = query.where(UsageRecord.period_start >= period_start)
        if period_end:
            query = query.where(UsageRecord.period_end <= period_end)

        # Order by most recent first
        query = query.order_by(UsageRecord.created_at.desc())

        # Apply pagination (fetch one extra to check if there are more)
        query = query.limit(limit + 1).offset(offset)

        result = await db.execute(query)
        records = list(result.scalars().all())

        has_more = len(records) > limit
        if has_more:
            records = records[:limit]

        return UsageRecordListResponse(
            usage_records=[UsageRecordResponse.model_validate(r) for r in records],
            total_count=len(records),
            has_more=has_more,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list usage records: {str(e)}",
        )


@router.get("/records/{record_id}", response_model=UsageRecordResponse)
async def get_usage_record(
    record_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> UsageRecordResponse:
    """Get a specific usage record by ID."""
    tenant_id = get_tenant_id_from_request(request)

    query = select(UsageRecord).where(
        and_(UsageRecord.id == record_id, UsageRecord.tenant_id == tenant_id)
    )
    result = await db.execute(query)
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Usage record {record_id} not found"
        )

    return UsageRecordResponse.model_validate(record)


@router.put("/records/{record_id}", response_model=UsageRecordResponse)
async def update_usage_record(
    record_id: UUID,
    update_data: UsageRecordUpdate,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> UsageRecordResponse:
    """
    Update a usage record.

    Allows updating quantity, unit price, billing status,
    invoice association, and description.
    """
    tenant_id = get_tenant_id_from_request(request)

    try:
        query = select(UsageRecord).where(
            and_(UsageRecord.id == record_id, UsageRecord.tenant_id == tenant_id)
        )
        result = await db.execute(query)
        record = result.scalar_one_or_none()

        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Usage record {record_id} not found"
            )

        # Update fields
        if update_data.quantity is not None:
            record.quantity = update_data.quantity
        if update_data.unit_price is not None:
            record.unit_price = update_data.unit_price
        if update_data.billed_status is not None:
            record.billed_status = update_data.billed_status
            # Set billed_at when marking as billed
            if update_data.billed_status == BilledStatus.BILLED:
                record.billed_at = datetime.utcnow()
        if update_data.invoice_id is not None:
            record.invoice_id = update_data.invoice_id
        if update_data.description is not None:
            record.description = update_data.description

        # Recalculate total amount if quantity or unit_price changed
        if update_data.quantity is not None or update_data.unit_price is not None:
            record.total_amount = calculate_total_amount(
                Decimal(record.quantity), Decimal(record.unit_price)
            )

        record.updated_by = current_user.user_id

        await db.commit()
        await db.refresh(record)

        return UsageRecordResponse.model_validate(record)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update usage record: {str(e)}",
        )


@router.delete("/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_usage_record(
    record_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> None:
    """
    Delete a usage record.

    Only pending or excluded records can be deleted.
    Billed records cannot be deleted to maintain audit trail.
    """
    tenant_id = get_tenant_id_from_request(request)

    try:
        query = select(UsageRecord).where(
            and_(UsageRecord.id == record_id, UsageRecord.tenant_id == tenant_id)
        )
        result = await db.execute(query)
        record = result.scalar_one_or_none()

        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Usage record {record_id} not found"
            )

        # Prevent deletion of billed records
        if record.billed_status == BilledStatus.BILLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete billed usage records. Mark as excluded instead.",
            )

        await db.delete(record)
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete usage record: {str(e)}",
        )


# ============================================================================
# Statistics and Analytics Endpoints
# ============================================================================


@router.get("/statistics", response_model=UsageStats)
async def get_usage_statistics(
    request: Request,
    period_start: datetime | None = Query(None, description="Start of period"),
    period_end: datetime | None = Query(None, description="End of period"),
    customer_id: UUID | None = Query(None, description="Filter by customer"),
    subscription_id: str | None = Query(None, description="Filter by subscription"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> UsageStats:
    """
    Get usage statistics for a time period.

    Returns total records, amounts by status, and breakdown by usage type.
    """
    tenant_id = get_tenant_id_from_request(request)

    try:
        # Build base query
        base_query = select(UsageRecord).where(UsageRecord.tenant_id == tenant_id)

        if period_start:
            base_query = base_query.where(UsageRecord.period_start >= period_start)
        if period_end:
            base_query = base_query.where(UsageRecord.period_end <= period_end)
        if customer_id:
            base_query = base_query.where(UsageRecord.customer_id == customer_id)
        if subscription_id:
            base_query = base_query.where(UsageRecord.subscription_id == subscription_id)

        # Get all records
        result = await db.execute(base_query)
        records = list(result.scalars().all())

        # Calculate statistics
        total_records = len(records)
        total_amount = sum(int(r.total_amount) for r in records)
        pending_amount = sum(
            int(r.total_amount) for r in records if r.billed_status == BilledStatus.PENDING
        )
        billed_amount = sum(
            int(r.total_amount) for r in records if r.billed_status == BilledStatus.BILLED
        )

        # Group by usage type
        by_type: dict[str, UsageSummary] = {}
        for record in records:
            usage_type_str = record.usage_type.value
            record_currency = (record.currency or "USD").upper()

            if usage_type_str not in by_type:
                by_type[usage_type_str] = UsageSummary(
                    usage_type=record.usage_type,
                    total_quantity=Decimal("0"),
                    total_amount=0,
                    currency=record_currency,
                    record_count=0,
                    period_start=(
                        period_start or records[0].period_start if records else datetime.utcnow()
                    ),
                    period_end=(
                        period_end or records[-1].period_end if records else datetime.utcnow()
                    ),
                )

            summary = by_type[usage_type_str]
            summary.total_quantity += Decimal(record.quantity)
            summary.total_amount += int(record.total_amount)
            summary.record_count += 1

        return UsageStats(
            total_records=total_records,
            total_amount=total_amount,
            pending_amount=pending_amount,
            billed_amount=billed_amount,
            by_type=by_type,
            period_start=period_start or datetime.utcnow(),
            period_end=period_end or datetime.utcnow(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get usage statistics: {str(e)}",
        )


# ============================================================================
# Aggregates Endpoints
# ============================================================================


@router.get("/aggregates", response_model=UsageAggregateListResponse)
async def list_usage_aggregates(
    request: Request,
    period_type: str | None = Query(None, description="Aggregation period: hourly, daily, monthly"),
    usage_type: UsageType | None = Query(None, description="Filter by usage type"),
    customer_id: UUID | None = Query(None, description="Filter by customer"),
    subscription_id: str | None = Query(None, description="Filter by subscription"),
    period_start: datetime | None = Query(None, description="Start of period"),
    period_end: datetime | None = Query(None, description="End of period"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> UsageAggregateListResponse:
    """
    Get pre-aggregated usage data for reporting.

    Aggregates are computed hourly/daily/monthly to improve
    query performance for dashboards and reports.
    """
    tenant_id = get_tenant_id_from_request(request)

    try:
        query = select(UsageAggregate).where(UsageAggregate.tenant_id == tenant_id)

        if period_type:
            query = query.where(UsageAggregate.period_type == period_type)
        if usage_type:
            query = query.where(UsageAggregate.usage_type == usage_type)
        if customer_id:
            query = query.where(UsageAggregate.customer_id == customer_id)
        if subscription_id:
            query = query.where(UsageAggregate.subscription_id == subscription_id)
        if period_start:
            query = query.where(UsageAggregate.period_start >= period_start)
        if period_end:
            query = query.where(UsageAggregate.period_end <= period_end)

        query = query.order_by(UsageAggregate.period_start.desc())

        result = await db.execute(query)
        aggregates = list(result.scalars().all())

        return UsageAggregateListResponse(
            aggregates=[UsageAggregateResponse.model_validate(a) for a in aggregates],
            total_count=len(aggregates),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list usage aggregates: {str(e)}",
        )


# Export router
__all__ = ["router"]
