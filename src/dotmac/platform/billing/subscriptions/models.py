"""
Subscription models for billing system.

Simple subscription plans and customer subscriptions with clear lifecycle management.
"""

from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import Field, field_validator

from dotmac.platform.billing.models import BillingBaseModel
from dotmac.platform.core.pydantic import AppBaseModel


class BillingCycle(str, Enum):
    """Subscription billing cycles."""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class SubscriptionStatus(str, Enum):
    """Subscription status values."""

    INCOMPLETE = "incomplete"  # Payment method setup pending
    TRIALING = "trialing"  # In trial period
    ACTIVE = "active"  # Active subscription
    PAST_DUE = "past_due"  # Payment failed, retrying
    CANCELED = "canceled"  # Canceled, still active until period end
    ENDED = "ended"  # Fully terminated
    PAUSED = "paused"  # Temporarily suspended


class SubscriptionEventType(str, Enum):
    """Subscription lifecycle events."""

    CREATED = "subscription.created"
    ACTIVATED = "subscription.activated"
    TRIAL_STARTED = "subscription.trial_started"
    TRIAL_ENDING = "subscription.trial_ending"
    TRIAL_ENDED = "subscription.trial_ended"
    RENEWED = "subscription.renewed"
    PLAN_CHANGED = "subscription.plan_changed"
    CANCELED = "subscription.canceled"
    PAUSED = "subscription.paused"
    RESUMED = "subscription.resumed"
    ENDED = "subscription.ended"
    PAYMENT_FAILED = "subscription.payment_failed"
    PAYMENT_SUCCEEDED = "subscription.payment_succeeded"


class ProrationBehavior(str, Enum):
    """How to handle mid-cycle plan changes."""

    NONE = "none"  # No proration, change at next cycle
    CREATE_PRORATIONS = "prorate"  # Create prorated charges/credits


class SubscriptionPlan(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Subscription plan definition."""

    plan_id: str = Field(description="Plan identifier")
    product_id: str = Field(description="Associated product")

    # Plan details
    name: str = Field(description="Plan name", max_length=255)
    description: str | None = Field(None, description="Plan description")

    # Billing configuration
    billing_cycle: BillingCycle = Field(description="How often to bill")
    price: Decimal = Field(description="Plan price in minor units")
    currency: str = Field(default="USD", description="Price currency", max_length=3)
    setup_fee: Decimal | None = Field(None, description="One-time setup fee")

    # Trial configuration
    trial_days: int | None = Field(None, description="Free trial period days")

    # Usage allowances for hybrid plans
    included_usage: dict[str, int] = Field(
        default_factory=dict, description="Included usage quotas (e.g., {'api_calls': 1000})"
    )
    overage_rates: dict[str, Decimal] = Field(
        default_factory=dict, description="Per-unit overage pricing (e.g., {'api_calls': '0.01'})"
    )

    # Plan status
    is_active: bool = Field(default=True, description="Plan is available for signup")

    # Flexible metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Custom metadata")

    @field_validator("price", "setup_fee")
    @classmethod
    def validate_prices(cls, v: Decimal | None) -> Decimal | None:
        """Ensure prices are non-negative."""
        if v is not None and v < 0:
            raise ValueError("Price cannot be negative")
        return v

    @field_validator("trial_days")
    @classmethod
    def validate_trial_days(cls, v: int | None) -> int | None:
        """Ensure trial days is reasonable."""
        if v is not None and (v < 0 or v > 365):
            raise ValueError("Trial days must be between 0 and 365")
        return v

    def has_trial(self) -> bool:
        """Check if plan includes a trial period."""
        return self.trial_days is not None and self.trial_days > 0

    def has_setup_fee(self) -> bool:
        """Check if plan has a setup fee."""
        return self.setup_fee is not None and self.setup_fee > 0

    def supports_usage_billing(self) -> bool:
        """Check if plan supports usage-based billing."""
        return bool(self.included_usage or self.overage_rates)


class Subscription(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Customer subscription instance."""

    subscription_id: str = Field(description="Subscription identifier")
    customer_id: str = Field(description="Customer who owns subscription")
    plan_id: str = Field(description="Current subscription plan")

    # Current billing period
    current_period_start: datetime = Field(description="Current billing period start")
    current_period_end: datetime = Field(description="Current billing period end")

    # Subscription status and lifecycle
    status: SubscriptionStatus = Field(description="Current subscription status")

    # Trial information
    trial_end: datetime | None = Field(None, description="Trial period end")

    # Cancellation handling
    cancel_at_period_end: bool = Field(default=False, description="Cancel at current period end")
    canceled_at: datetime | None = Field(None, description="When subscription was canceled")
    ended_at: datetime | None = Field(None, description="When subscription fully ended")

    # Pricing overrides
    custom_price: Decimal | None = Field(None, description="Customer-specific pricing override")

    # Usage tracking for hybrid plans
    usage_records: dict[str, int] = Field(
        default_factory=dict, description="Current period usage tracking"
    )

    # Flexible metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Custom metadata")

    def is_active(self) -> bool:
        """Check if subscription is currently active."""
        return self.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]

    def is_in_trial(self) -> bool:
        """Check if subscription is in trial period."""
        if not self.trial_end:
            return False
        return datetime.now(UTC) < self.trial_end

    def days_until_renewal(self) -> int:
        """Get days until next renewal."""
        if not self.is_active():
            return 0
        delta = self.current_period_end - datetime.now(UTC)
        return max(0, delta.days)

    def is_past_due(self) -> bool:
        """Check if subscription is past due."""
        return self.status == SubscriptionStatus.PAST_DUE


class SubscriptionEvent(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Subscription lifecycle event for audit trail."""

    event_id: str = Field(description="Event identifier")
    subscription_id: str = Field(description="Related subscription")

    event_type: SubscriptionEventType = Field(description="Type of event")
    event_data: dict[str, Any] = Field(default_factory=dict, description="Event-specific data")

    # User who triggered event (optional for system events)
    user_id: str | None = Field(None, description="User who triggered event")


# Request/Response Models


class SubscriptionPlanCreateRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for creating subscription plans."""

    product_id: str = Field(description="Associated product ID")
    name: str = Field(description="Plan name", max_length=255)
    description: str | None = Field(None, description="Plan description")
    billing_cycle: BillingCycle = Field(description="Billing frequency")
    price: Decimal = Field(description="Plan price in minor units")
    currency: str = Field(default="USD", max_length=3)
    setup_fee: Decimal | None = Field(None, description="One-time setup fee")
    trial_days: int | None = Field(None, description="Trial period days")
    included_usage: dict[str, int] = Field(default_factory=lambda: {})
    overage_rates: dict[str, Decimal] = Field(default_factory=lambda: {})
    metadata: dict[str, Any] = Field(default_factory=lambda: {})

    @field_validator("price", "setup_fee")
    @classmethod
    def validate_prices(cls, v: Decimal | None) -> Decimal | None:
        """Ensure prices are non-negative."""
        if v is not None and v < 0:
            raise ValueError("Price cannot be negative")
        return v


class SubscriptionCreateRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for creating subscriptions."""

    customer_id: str = Field(description="Customer ID")
    plan_id: str = Field(description="Subscription plan ID")
    start_date: datetime | None = Field(None, description="Subscription start date")
    custom_price: Decimal | None = Field(None, description="Customer-specific pricing")
    trial_end_override: datetime | None = Field(None, description="Override trial end date")
    metadata: dict[str, Any] = Field(default_factory=lambda: {})

    @field_validator("custom_price")
    @classmethod
    def validate_custom_price(cls, v: Decimal | None) -> Decimal | None:
        """Ensure custom price is non-negative."""
        if v is not None and v < 0:
            raise ValueError("Custom price cannot be negative")
        return v


class SubscriptionUpdateRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for updating subscriptions."""

    status: SubscriptionStatus | None = Field(None, description="Update subscription status")
    custom_price: Decimal | None = Field(None, description="Update custom pricing")
    metadata: dict[str, Any] | None = Field(None, description="Update metadata")

    @field_validator("custom_price")
    @classmethod
    def validate_custom_price(cls, v: Decimal | None) -> Decimal | None:
        """Ensure custom price is non-negative."""
        if v is not None and v < 0:
            raise ValueError("Custom price cannot be negative")
        return v


class SubscriptionPlanChangeRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for changing subscription plans."""

    new_plan_id: str = Field(description="New plan to switch to")
    proration_behavior: ProrationBehavior = Field(
        default=ProrationBehavior.CREATE_PRORATIONS, description="How to handle proration"
    )
    effective_date: datetime | None = Field(
        None, description="When to make the change (default: immediate)"
    )


class UsageRecordRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for recording usage."""

    subscription_id: str = Field(description="Subscription ID")
    usage_type: str = Field(description="Type of usage (api_calls, storage_gb, etc.)")
    quantity: int = Field(description="Usage quantity", ge=0)
    timestamp: datetime | None = Field(None, description="Usage timestamp (default: now)")


class SubscriptionResponse(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Response model for subscription data."""

    subscription_id: str
    tenant_id: str
    customer_id: str
    plan_id: str
    current_period_start: datetime
    current_period_end: datetime
    status: SubscriptionStatus
    trial_end: datetime | None
    cancel_at_period_end: bool
    canceled_at: datetime | None
    ended_at: datetime | None
    custom_price: Decimal | None
    usage_records: dict[str, int]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime | None

    # Computed fields
    is_in_trial: bool
    days_until_renewal: int


class SubscriptionPlanResponse(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Response model for subscription plan data."""

    plan_id: str
    tenant_id: str
    product_id: str
    name: str
    description: str | None
    billing_cycle: BillingCycle
    price: Decimal
    currency: str
    setup_fee: Decimal | None
    trial_days: int | None
    included_usage: dict[str, int]
    overage_rates: dict[str, Decimal]
    is_active: bool
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime | None


class ProrationResult(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Result of proration calculation."""

    proration_amount: Decimal = Field(
        description="Proration amount (positive = charge, negative = credit)"
    )
    proration_description: str = Field(description="Human-readable description")
    old_plan_unused_amount: Decimal = Field(description="Unused amount from old plan")
    new_plan_prorated_amount: Decimal = Field(description="Prorated amount for new plan")
    days_remaining: int = Field(description="Days remaining in current period")


# Renewal Models


class RenewalEligibilityResponse(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Response model for renewal eligibility check."""

    is_eligible: bool = Field(description="Whether subscription is eligible for renewal")
    subscription_id: str = Field(description="Subscription identifier")
    customer_id: str = Field(description="Customer identifier")
    plan_id: str = Field(description="Current plan ID")
    plan_name: str = Field(description="Current plan name")
    current_period_end: datetime = Field(description="Current period end date")
    days_until_renewal: int = Field(description="Days until renewal is due")
    renewal_price: Decimal = Field(description="Renewal price amount")
    currency: str = Field(description="Currency code")
    billing_cycle: BillingCycle = Field(description="Billing cycle")
    reasons: list[str] = Field(default_factory=list, description="Reasons if not eligible")
    trial_active: bool = Field(description="Whether subscription is in trial")


class RenewalPaymentRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for processing renewal payment."""

    subscription_id: str = Field(description="Subscription to renew")
    payment_method_id: str = Field(description="Payment method to use")
    idempotency_key: str | None = Field(None, description="Idempotency key for payment")


class RenewalPaymentResponse(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Response model for renewal payment processing."""

    subscription_id: str
    customer_id: str
    amount: Decimal
    currency: str
    payment_method_id: str
    description: str
    billing_cycle: str
    period_start: datetime
    period_end: datetime
    idempotency_key: str
    metadata: dict[str, Any]


class RenewalQuoteRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for creating renewal quote."""

    customer_id: str = Field(description="Customer ID")
    subscription_id: str = Field(description="Subscription ID to renew")
    discount_percentage: Decimal | None = Field(
        None,
        description="Optional renewal discount percentage (e.g., 10 for 10% off)",
        ge=0,
        le=100,
    )
    valid_days: int = Field(default=30, description="Quote validity in days", ge=1, le=90)
    notes: str | None = Field(None, description="Additional notes")

    @field_validator("discount_percentage")
    @classmethod
    def validate_discount(cls, v: Decimal | None) -> Decimal | None:
        """Ensure discount percentage is reasonable."""
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Discount percentage must be between 0 and 100")
        return v


class ExtendSubscriptionRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for extending subscription."""

    subscription_id: str = Field(description="Subscription to extend")
    payment_id: str | None = Field(None, description="Associated payment ID")


# Tenant Self-Service Models


class PlanChangeRequest(AppBaseModel):  # type: ignore[misc]
    """Request for tenant to change subscription plan."""

    new_plan_id: str = Field(description="Target plan ID")
    effective_date: datetime | None = Field(
        None, description="When to apply change (None = immediate)"
    )
    proration_behavior: ProrationBehavior = Field(
        default=ProrationBehavior.CREATE_PRORATIONS,
        description="How to handle mid-cycle changes",
    )
    reason: str | None = Field(None, description="Reason for plan change", max_length=500)


class ProrationPreview(AppBaseModel):  # type: ignore[misc]
    """Preview of costs/credits for plan change."""

    current_plan: SubscriptionPlanResponse
    new_plan: SubscriptionPlanResponse
    proration: ProrationResult
    estimated_invoice_amount: Decimal = Field(
        description="Estimated next invoice total after change"
    )
    effective_date: datetime = Field(description="When change will take effect")
    next_billing_date: datetime = Field(description="Next billing date after change")


class SubscriptionCancelRequest(AppBaseModel):  # type: ignore[misc]
    """Request to cancel subscription."""

    cancel_at_period_end: bool = Field(
        default=True, description="Cancel at end of period (True) or immediately (False)"
    )
    reason: str | None = Field(None, description="Cancellation reason", max_length=1000)
    feedback: str | None = Field(None, description="Additional feedback", max_length=2000)
