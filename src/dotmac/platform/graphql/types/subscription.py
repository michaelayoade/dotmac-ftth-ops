"""
GraphQL types for Subscription Management.

Provides types for subscriptions with customer, plan, and invoice batching
via DataLoaders to prevent N+1 queries.
"""

from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Any

import strawberry

if TYPE_CHECKING:
    type JSONScalar = Any
else:
    from strawberry.scalars import JSON as JSONScalar

from dotmac.platform.graphql.types.common import BillingCycleEnum


@strawberry.enum
class SubscriptionStatusEnum(str, Enum):
    """Subscription status values."""

    INCOMPLETE = "incomplete"
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    ENDED = "ended"
    PAUSED = "paused"


@strawberry.enum
class ProductTypeEnum(str, Enum):
    """Product type determines billing behavior."""

    ONE_TIME = "one_time"
    SUBSCRIPTION = "subscription"
    USAGE_BASED = "usage_based"
    HYBRID = "hybrid"


@strawberry.type
class SubscriptionPlan:
    """Subscription plan with pricing details."""

    id: strawberry.ID
    plan_id: str
    product_id: str
    name: str
    description: str | None
    billing_cycle: BillingCycleEnum
    price: Decimal
    currency: str
    setup_fee: Decimal | None
    trial_days: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Computed properties
    has_trial: bool
    has_setup_fee: bool

    # Usage allowances (for hybrid plans)
    included_usage: JSONScalar
    overage_rates: JSONScalar

    @classmethod
    def from_model(cls, plan: Any) -> "SubscriptionPlan":
        """Convert SQLAlchemy/Pydantic model to GraphQL type."""
        has_trial = plan.trial_days is not None and plan.trial_days > 0
        has_setup_fee = plan.setup_fee is not None and plan.setup_fee > 0

        return cls(
            id=strawberry.ID(str(getattr(plan, "id", plan.plan_id))),
            plan_id=plan.plan_id,
            product_id=plan.product_id,
            name=plan.name,
            description=plan.description,
            billing_cycle=BillingCycleEnum(plan.billing_cycle.value),
            price=plan.price,
            currency=plan.currency,
            setup_fee=plan.setup_fee,
            trial_days=plan.trial_days,
            is_active=plan.is_active,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
            has_trial=has_trial,
            has_setup_fee=has_setup_fee,
            included_usage=plan.included_usage or {},
            overage_rates=plan.overage_rates or {},
        )


@strawberry.type
class SubscriptionCustomer:
    """Customer information for subscription."""

    id: strawberry.ID
    customer_id: str
    name: str | None
    email: str
    phone: str | None
    created_at: datetime

    @classmethod
    def from_model(cls, customer: Any) -> "SubscriptionCustomer":
        """Convert Customer model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(customer.id)),
            customer_id=str(customer.id),
            name=customer.name,
            email=customer.email,
            phone=customer.phone,
            created_at=customer.created_at,
        )


@strawberry.type
class SubscriptionInvoice:
    """Invoice summary for subscription."""

    id: strawberry.ID
    invoice_id: str
    invoice_number: str
    amount: Decimal
    currency: str
    status: str
    due_date: datetime
    paid_at: datetime | None
    created_at: datetime

    @classmethod
    def from_model(cls, invoice: Any) -> "SubscriptionInvoice":
        """Convert Invoice model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(invoice.invoice_id)),
            invoice_id=invoice.invoice_id,
            invoice_number=invoice.invoice_number,
            amount=invoice.total_amount,
            currency=invoice.currency,
            status=invoice.status,
            due_date=invoice.due_date,
            paid_at=invoice.paid_at if hasattr(invoice, "paid_at") else None,
            created_at=invoice.created_at,
        )


@strawberry.type
class Subscription:
    """
    Subscription with conditional loading of related data.

    Customer, plan, and invoice data are loaded conditionally via DataLoaders
    to prevent N+1 queries when listing subscriptions.
    """

    # Core identifiers
    id: strawberry.ID
    subscription_id: str
    customer_id: str
    plan_id: str
    tenant_id: str

    # Billing period
    current_period_start: datetime
    current_period_end: datetime

    # Status
    status: SubscriptionStatusEnum

    # Trial information
    trial_end: datetime | None
    is_in_trial: bool

    # Cancellation
    cancel_at_period_end: bool
    canceled_at: datetime | None
    ended_at: datetime | None

    # Pricing
    custom_price: Decimal | None

    # Usage tracking (for hybrid plans)
    usage_records: JSONScalar

    # Timestamps
    created_at: datetime
    updated_at: datetime

    # Computed properties
    is_active: bool
    days_until_renewal: int
    is_past_due: bool

    # Relationships (conditionally loaded via DataLoaders)
    customer: SubscriptionCustomer | None = None
    plan: SubscriptionPlan | None = None
    recent_invoices: list[SubscriptionInvoice] = strawberry.field(default_factory=list)

    @classmethod
    def from_model(cls, subscription: Any) -> "Subscription":
        """Convert Subscription model to GraphQL type."""
        # Compute properties
        is_active_status = subscription.status in ["active", "trialing"]

        is_in_trial = False
        if subscription.trial_end:
            from datetime import datetime

            is_in_trial = datetime.now(UTC) < subscription.trial_end

        days_until_renewal = 0
        if is_active_status:
            from datetime import datetime

            delta = subscription.current_period_end - datetime.now(UTC)
            days_until_renewal = max(0, delta.days)

        is_past_due_status = subscription.status == "past_due"

        return cls(
            id=strawberry.ID(str(getattr(subscription, "id", subscription.subscription_id))),
            subscription_id=subscription.subscription_id,
            customer_id=subscription.customer_id,
            plan_id=subscription.plan_id,
            tenant_id=subscription.tenant_id,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            status=SubscriptionStatusEnum(
                subscription.status.value
                if hasattr(subscription.status, "value")
                else subscription.status
            ),
            trial_end=subscription.trial_end,
            is_in_trial=is_in_trial,
            cancel_at_period_end=subscription.cancel_at_period_end,
            canceled_at=subscription.canceled_at,
            ended_at=subscription.ended_at,
            custom_price=subscription.custom_price,
            usage_records=subscription.usage_records or {},
            created_at=subscription.created_at,
            updated_at=subscription.updated_at,
            is_active=is_active_status,
            days_until_renewal=days_until_renewal,
            is_past_due=is_past_due_status,
            customer=None,
            plan=None,
            recent_invoices=[],
        )


@strawberry.type
class SubscriptionConnection:
    """Paginated subscription results."""

    subscriptions: list[Subscription]
    total_count: int
    has_next_page: bool
    has_prev_page: bool
    page: int
    page_size: int


@strawberry.type
class SubscriptionMetrics:
    """Aggregated subscription metrics."""

    # Counts by status
    total_subscriptions: int
    active_subscriptions: int
    trialing_subscriptions: int
    past_due_subscriptions: int
    canceled_subscriptions: int
    paused_subscriptions: int

    # Revenue metrics
    monthly_recurring_revenue: Decimal
    annual_recurring_revenue: Decimal
    average_revenue_per_user: Decimal

    # Growth metrics
    new_subscriptions_this_month: int
    new_subscriptions_last_month: int
    churn_rate: Decimal
    growth_rate: Decimal

    # Billing cycle distribution
    monthly_subscriptions: int
    quarterly_subscriptions: int
    annual_subscriptions: int

    # Trial metrics
    trial_conversion_rate: Decimal
    active_trials: int


@strawberry.type
class PlanMetrics:
    """Metrics for a specific plan."""

    plan_id: str
    plan_name: str
    active_subscriptions: int
    monthly_recurring_revenue: Decimal
    churn_rate: Decimal
    average_lifetime_value: Decimal


@strawberry.type
class Product:
    """Product definition."""

    id: strawberry.ID
    product_id: str
    sku: str
    name: str
    description: str | None
    category: str
    product_type: ProductTypeEnum
    base_price: Decimal
    currency: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, product: Any) -> "Product":
        """Convert Product model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(getattr(product, "id", product.product_id))),
            product_id=product.product_id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category=product.category,
            product_type=ProductTypeEnum(product.product_type.value),
            base_price=product.base_price,
            currency=product.currency,
            is_active=product.is_active,
            created_at=product.created_at,
            updated_at=product.updated_at,
        )


@strawberry.type
class PlanConnection:
    """Paginated plan results."""

    plans: list[SubscriptionPlan]
    total_count: int
    has_next_page: bool
    has_prev_page: bool
    page: int
    page_size: int


@strawberry.type
class ProductConnection:
    """Paginated product results."""

    products: list[Product]
    total_count: int
    has_next_page: bool
    has_prev_page: bool
    page: int
    page_size: int
