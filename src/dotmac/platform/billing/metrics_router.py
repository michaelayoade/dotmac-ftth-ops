"""
Billing and Customer Metrics Router.

Provides comprehensive metrics endpoints for billing overview, payment history,
and customer insights with caching and tenant isolation.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing._typing_helpers import CacheTier, cached_result
from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    PaymentEntity,
)
from dotmac.platform.billing.core.models import PaymentStatus
from dotmac.platform.billing.models import BillingSubscriptionTable
from dotmac.platform.customer_management.models import Customer, CustomerStatus
from dotmac.platform.db import get_session_dependency

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="",
    tags=["Billing Metrics"],
)
customer_metrics_router = APIRouter(
    prefix="",
    tags=["Customer Metrics"],
)


# ============================================================================
# Caching Configuration
# ============================================================================

# Cache TTLs (in seconds)
METRICS_CACHE_TTL = 300  # 5 minutes for metrics
PAYMENTS_CACHE_TTL = 180  # 3 minutes for payment lists
EXPIRING_SUBS_CACHE_TTL = 600  # 10 minutes for expiring subscriptions


# ============================================================================
# Response Models
# ============================================================================


class BillingMetricsResponse(BaseModel):
    """Billing overview metrics response."""

    model_config = ConfigDict(from_attributes=True)

    # Revenue metrics
    mrr: float = Field(description="Monthly Recurring Revenue")
    arr: float = Field(description="Annual Recurring Revenue")

    # Counts
    active_subscriptions: int = Field(description="Number of active subscriptions")
    total_invoices: int = Field(description="Total invoices this period")
    paid_invoices: int = Field(description="Paid invoices this period")
    overdue_invoices: int = Field(description="Overdue invoices")

    # Payment metrics
    total_payments: int = Field(description="Total payments this period")
    successful_payments: int = Field(description="Successful payments")
    failed_payments: int = Field(description="Failed payments")
    total_payment_amount: float = Field(description="Total payment amount in major units")

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


class PaymentListItem(BaseModel):
    """Individual payment item in list."""

    model_config = ConfigDict(from_attributes=True)

    payment_id: str
    amount: float = Field(description="Amount in major currency units")
    currency: str
    status: str
    customer_id: str
    payment_method_type: str
    provider: str
    created_at: datetime
    processed_at: datetime | None = None
    failure_reason: str | None = None


class PaymentListResponse(BaseModel):
    """List of recent payments response."""

    model_config = ConfigDict(from_attributes=True)

    payments: list[PaymentListItem] = Field(description="List of payments")
    total_count: int = Field(description="Total number of payments")
    limit: int = Field(description="Result limit applied")
    timestamp: datetime = Field(description="Response generation timestamp")


class CustomerMetricsResponse(BaseModel):
    """Customer metrics overview response."""

    model_config = ConfigDict(from_attributes=True)

    # Customer counts
    total_customers: int = Field(description="Total customers")
    active_customers: int = Field(description="Active customers")
    new_customers_this_month: int = Field(description="New customers this month")
    churned_customers_this_month: int = Field(description="Churned customers this month")

    # Growth metrics
    customer_growth_rate: float = Field(description="Month-over-month growth rate (%)")
    churn_rate: float = Field(description="Monthly churn rate (%)")

    # Status breakdown
    customers_by_status: dict[str, int] = Field(
        description="Customer count by status", default_factory=dict
    )

    # At-risk customers
    at_risk_customers: int = Field(description="Customers at risk of churning", default=0)

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


# ============================================================================
# Cached Helper Functions
# ============================================================================


@cached_result(  # type: ignore[misc]  # Cache decorator is untyped
    ttl=METRICS_CACHE_TTL,
    key_prefix="billing:metrics",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_billing_metrics_cached(
    period_days: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for billing metrics calculation.

    This function contains the actual business logic and is cached independently.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)

    # Query active subscriptions for MRR calculation
    subscription_query = select(
        func.count(BillingSubscriptionTable.subscription_id).label("count"),
        func.coalesce(func.sum(BillingSubscriptionTable.custom_price), 0).label("total_amount"),
    ).where(BillingSubscriptionTable.status == "active")

    if tenant_id:
        subscription_query = subscription_query.where(
            BillingSubscriptionTable.tenant_id == tenant_id
        )

    subscription_result = await session.execute(subscription_query)
    subscription_row = subscription_result.one()

    subscription_mapping = subscription_row._mapping
    active_subscriptions = int(subscription_mapping.get("count") or 0)
    total_subscription_amount = float(subscription_mapping.get("total_amount") or 0)

    # Calculate MRR and ARR
    mrr = total_subscription_amount / 100
    arr = mrr * 12

    # Query invoice statistics
    from sqlalchemy import case

    from dotmac.platform.billing.core.enums import InvoiceStatus

    invoice_query = select(
        func.count(InvoiceEntity.invoice_id).label("total"),
        func.sum(case((InvoiceEntity.status == InvoiceStatus.PAID, 1), else_=0)).label("paid"),
        func.sum(
            case(
                (
                    and_(
                        InvoiceEntity.status == InvoiceStatus.OPEN,
                        InvoiceEntity.due_date < now,
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("overdue"),
    ).where(InvoiceEntity.created_at >= period_start)

    if tenant_id:
        invoice_query = invoice_query.where(InvoiceEntity.tenant_id == tenant_id)

    invoice_result = await session.execute(invoice_query)
    invoice_row = invoice_result.one()

    # Query payment statistics
    payment_query = select(
        func.count(PaymentEntity.payment_id).label("total"),
        func.sum(case((PaymentEntity.status == PaymentStatus.SUCCEEDED, 1), else_=0)).label(
            "successful"
        ),
        func.sum(case((PaymentEntity.status == PaymentStatus.FAILED, 1), else_=0)).label("failed"),
        func.coalesce(
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.SUCCEEDED, PaymentEntity.amount),
                    else_=0,
                )
            ),
            0,
        ).label("total_amount"),
    ).where(PaymentEntity.created_at >= period_start)

    if tenant_id:
        payment_query = payment_query.where(PaymentEntity.tenant_id == tenant_id)

    payment_result = await session.execute(payment_query)
    payment_row = payment_result.one()

    return {
        "mrr": mrr,
        "arr": arr,
        "active_subscriptions": active_subscriptions,
        "total_invoices": invoice_row.total or 0,
        "paid_invoices": invoice_row.paid or 0,
        "overdue_invoices": invoice_row.overdue or 0,
        "total_payments": payment_row.total or 0,
        "successful_payments": payment_row.successful or 0,
        "failed_payments": payment_row.failed or 0,
        "total_payment_amount": float(payment_row.total_amount or 0) / 100,
        "period": f"{period_days}d",
        "timestamp": now,
    }


@cached_result(  # type: ignore[misc]  # Cache decorator is untyped
    ttl=METRICS_CACHE_TTL,
    key_prefix="customer:metrics",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_customer_metrics_cached(
    period_days: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for customer metrics calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)

    # Query total and active customers
    total_customers_query = select(func.count(Customer.id))
    active_customers_query = select(func.count(Customer.id)).where(
        Customer.status == CustomerStatus.ACTIVE
    )

    if tenant_id:
        total_customers_query = total_customers_query.where(Customer.tenant_id == tenant_id)
        active_customers_query = active_customers_query.where(Customer.tenant_id == tenant_id)

    total_customers_result = await session.execute(total_customers_query)
    active_customers_result = await session.execute(active_customers_query)

    total_customers = total_customers_result.scalar() or 0
    active_customers = active_customers_result.scalar() or 0

    # Query new customers in period
    new_customers_query = select(func.count(Customer.id)).where(Customer.created_at >= period_start)

    if tenant_id:
        new_customers_query = new_customers_query.where(Customer.tenant_id == tenant_id)

    new_customers_result = await session.execute(new_customers_query)
    new_customers_this_period = new_customers_result.scalar() or 0

    # Calculate growth rate
    previous_period_start = period_start - timedelta(days=period_days)
    previous_customers_query = select(func.count(Customer.id)).where(
        and_(
            Customer.created_at >= previous_period_start,
            Customer.created_at < period_start,
        )
    )

    if tenant_id:
        previous_customers_query = previous_customers_query.where(Customer.tenant_id == tenant_id)

    previous_customers_result = await session.execute(previous_customers_query)
    previous_customers = previous_customers_result.scalar() or 0

    if previous_customers > 0:
        growth_rate = ((new_customers_this_period - previous_customers) / previous_customers) * 100
    else:
        growth_rate = 0.0 if new_customers_this_period == 0 else 100.0

    # Query churned customers (customers who became inactive)
    churned_customers_query = select(func.count(Customer.id)).where(
        and_(
            Customer.status.in_([CustomerStatus.INACTIVE, CustomerStatus.CHURNED]),
            Customer.updated_at >= period_start,
        )
    )

    if tenant_id:
        churned_customers_query = churned_customers_query.where(Customer.tenant_id == tenant_id)

    churned_customers_result = await session.execute(churned_customers_query)
    churned_customers_this_period = churned_customers_result.scalar() or 0

    if active_customers > 0:
        churn_rate = (
            churned_customers_this_period / (active_customers + churned_customers_this_period)
        ) * 100
    else:
        churn_rate = 0.0

    # Query customers by status
    status_query = select(
        Customer.status,
        func.count(Customer.id).label("count"),
    ).group_by(Customer.status)

    if tenant_id:
        status_query = status_query.where(Customer.tenant_id == tenant_id)

    status_result = await session.execute(status_query)
    status_rows = status_result.all()

    customers_by_status = {str(row.status): row.count for row in status_rows}

    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "new_customers_this_month": new_customers_this_period,
        "churned_customers_this_month": churned_customers_this_period,
        "customer_growth_rate": round(growth_rate, 2),
        "churn_rate": round(churn_rate, 2),
        "customers_by_status": customers_by_status,
        "at_risk_customers": 0,  # Placeholder - would require more complex analysis
        "period": f"{period_days}d",
        "timestamp": now,
    }


@cached_result(  # type: ignore[misc]  # Cache decorator is untyped
    ttl=EXPIRING_SUBS_CACHE_TTL,
    key_prefix="billing:expiring_subs",
    key_params=["days", "limit", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_expiring_subscriptions_cached(
    days: int,
    limit: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for expiring subscriptions query.
    """
    now = datetime.now(UTC)
    expiry_threshold = now + timedelta(days=days)

    query = (
        select(BillingSubscriptionTable)
        .where(
            and_(
                BillingSubscriptionTable.current_period_end <= expiry_threshold,
                BillingSubscriptionTable.current_period_end >= now,
                BillingSubscriptionTable.status.in_(["active", "trialing"]),
            )
        )
        .order_by(BillingSubscriptionTable.current_period_end.asc())
    )

    if tenant_id:
        query = query.where(BillingSubscriptionTable.tenant_id == tenant_id)

    query = query.limit(limit)

    result = await session.execute(query)
    subscriptions = result.scalars().all()

    subscription_items = []
    for sub in subscriptions:
        days_until_expiry = (sub.current_period_end - now).days
        subscription_items.append(
            {
                "subscription_id": sub.subscription_id,
                "customer_id": sub.customer_id,
                "plan_id": sub.plan_id,
                "current_period_end": sub.current_period_end,
                "days_until_expiry": days_until_expiry,
                "status": sub.status,
                "cancel_at_period_end": sub.cancel_at_period_end,
            }
        )

    return {
        "subscriptions": subscription_items,
        "total_count": len(subscription_items),
        "days_threshold": days,
        "timestamp": now,
    }


# ============================================================================
# Billing Metrics Endpoint
# ============================================================================


@router.get("/metrics", response_model=BillingMetricsResponse)
async def get_billing_metrics(
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> BillingMetricsResponse:
    """
    Get comprehensive billing metrics overview with Redis caching.

    Returns MRR, ARR, subscription counts, invoice statistics, and payment metrics
    for the specified time period with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Required Permission**: billing:metrics:read (enforced by get_current_user)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        # Use cached helper function
        metrics_data = await _get_billing_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        )

        return BillingMetricsResponse(**metrics_data)

    except Exception as e:
        logger.error("Failed to fetch billing metrics", error=str(e), exc_info=True)
        # Return safe defaults on error
        return BillingMetricsResponse(
            mrr=0.0,
            arr=0.0,
            active_subscriptions=0,
            total_invoices=0,
            paid_invoices=0,
            overdue_invoices=0,
            total_payments=0,
            successful_payments=0,
            failed_payments=0,
            total_payment_amount=0.0,
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


# ============================================================================
# Payment List Endpoint
# ============================================================================


@router.get("/payments", response_model=PaymentListResponse)
async def get_recent_payments(
    limit: int = Query(
        default=50, ge=1, le=500, description="Maximum number of payments to return"
    ),
    offset: int = Query(default=0, ge=0, description="Number of payments to skip"),
    status: str | None = Query(default=None, description="Filter by payment status"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> PaymentListResponse:
    """
    Get list of recent payments with optional filtering.

    Returns paginated list of payments ordered by creation date (newest first)
    with tenant isolation.

    **Required Permission**: billing:payments:read (enforced by get_current_user)
    """
    try:
        # Get tenant_id from current_user if available
        tenant_id = getattr(current_user, "tenant_id", None)

        # Build query
        query = select(PaymentEntity).order_by(PaymentEntity.created_at.desc())

        if tenant_id:
            query = query.where(PaymentEntity.tenant_id == tenant_id)

        if status:
            query = query.where(PaymentEntity.status == status)

        # Get total count
        count_query = select(func.count(PaymentEntity.payment_id))
        if tenant_id:
            count_query = count_query.where(PaymentEntity.tenant_id == tenant_id)
        if status:
            count_query = count_query.where(PaymentEntity.status == status)

        count_result = await session.execute(count_query)
        total_count = count_result.scalar() or 0

        # Apply pagination
        query = query.limit(limit).offset(offset)

        # Execute query
        result = await session.execute(query)
        payment_entities = result.scalars().all()

        # Convert to response models
        payments = [
            PaymentListItem(
                payment_id=p.payment_id,
                amount=float(p.amount) / 100,  # Convert to major units
                currency=p.currency,
                status=p.status.value if hasattr(p.status, "value") else str(p.status),
                customer_id=p.customer_id,
                payment_method_type=(
                    p.payment_method_type.value
                    if hasattr(p.payment_method_type, "value")
                    else str(p.payment_method_type)
                ),
                provider=p.provider,
                created_at=p.created_at,
                processed_at=p.processed_at,
                failure_reason=p.failure_reason,
            )
            for p in payment_entities
        ]

        return PaymentListResponse(
            payments=payments,
            total_count=total_count,
            limit=limit,
            timestamp=datetime.now(UTC),
        )

    except Exception as e:
        logger.error("Failed to fetch recent payments", error=str(e), exc_info=True)
        # Return empty list on error
        return PaymentListResponse(
            payments=[],
            total_count=0,
            limit=limit,
            timestamp=datetime.now(UTC),
        )


# ============================================================================
# Customer Metrics Endpoint
# ============================================================================


@customer_metrics_router.get("/overview", response_model=CustomerMetricsResponse)
async def get_customer_metrics_overview(
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> CustomerMetricsResponse:
    """
    Get customer metrics overview with growth and churn analysis and Redis caching.

    Returns customer counts, growth rates, churn rates, and status breakdown
    with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Required Permission**: customers:metrics:read (enforced by get_current_user)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        # Use cached helper function
        metrics_data = await _get_customer_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        )

        return CustomerMetricsResponse(**metrics_data)

    except Exception as e:
        logger.error("Failed to fetch customer metrics", error=str(e), exc_info=True)
        # Return safe defaults on error
        return CustomerMetricsResponse(
            total_customers=0,
            active_customers=0,
            new_customers_this_month=0,
            churned_customers_this_month=0,
            customer_growth_rate=0.0,
            churn_rate=0.0,
            customers_by_status={},
            at_risk_customers=0,
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


# ============================================================================
# Expiring Subscriptions Endpoint
# ============================================================================


class ExpiringSubscriptionItem(BaseModel):
    """Individual subscription expiring soon."""

    model_config = ConfigDict(from_attributes=True)

    subscription_id: str
    customer_id: str
    plan_id: str
    current_period_end: datetime
    days_until_expiry: int
    status: str
    cancel_at_period_end: bool


class ExpiringSubscriptionsResponse(BaseModel):
    """Expiring subscriptions response."""

    model_config = ConfigDict(from_attributes=True)

    subscriptions: list[ExpiringSubscriptionItem] = Field(
        description="List of expiring subscriptions"
    )
    total_count: int = Field(description="Total number of expiring subscriptions")
    days_threshold: int = Field(description="Days threshold used")
    timestamp: datetime = Field(description="Response generation timestamp")


@router.get(
    "/subscriptions/expiring",
    response_model=ExpiringSubscriptionsResponse,
    operation_id="list_expiring_subscriptions",
)
async def get_expiring_subscriptions(
    days: int = Query(
        default=30,
        ge=1,
        le=90,
        description="Number of days to look ahead for expiring subscriptions",
    ),
    limit: int = Query(
        default=50, ge=1, le=500, description="Maximum number of subscriptions to return"
    ),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> ExpiringSubscriptionsResponse:
    """
    Get subscriptions expiring within the specified number of days with Redis caching.

    Returns list of subscriptions that will expire soon, ordered by expiry date
    with tenant isolation.

    **Caching**: Results cached for 10 minutes per tenant/days/limit combination.
    **Required Permission**: billing:subscriptions:read (enforced by get_current_user)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        # Use cached helper function
        data = await _get_expiring_subscriptions_cached(
            days=days,
            limit=limit,
            tenant_id=tenant_id,
            session=session,
        )

        # Convert subscription items to Pydantic models
        subscription_items = [ExpiringSubscriptionItem(**item) for item in data["subscriptions"]]

        return ExpiringSubscriptionsResponse(
            subscriptions=subscription_items,
            total_count=data["total_count"],
            days_threshold=data["days_threshold"],
            timestamp=data["timestamp"],
        )

    except Exception as e:
        logger.error("Failed to fetch expiring subscriptions", error=str(e), exc_info=True)
        # Return empty list on error
        return ExpiringSubscriptionsResponse(
            subscriptions=[],
            total_count=0,
            days_threshold=days,
            timestamp=datetime.now(UTC),
        )


__all__ = ["router", "customer_metrics_router"]
