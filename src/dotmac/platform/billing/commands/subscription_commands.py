"""
Subscription Commands - Write operations for subscriptions
"""

from datetime import UTC, datetime
from typing import Any

from pydantic import Field

from .invoice_commands import BaseCommand


class CreateSubscriptionCommand(BaseCommand):
    """
    Command to create a new subscription.

    Subscriptions generate recurring invoices automatically.
    """

    customer_id: str = Field(..., description="Customer for subscription")
    plan_id: str = Field(..., description="Subscription plan")
    quantity: int = Field(default=1, ge=1, description="Number of licenses/seats")
    billing_cycle_anchor: datetime | None = Field(None, description="Anchor date for billing cycle")
    trial_end: datetime | None = Field(None, description="Trial period end date")
    start_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Subscription start date"
    )

    # Billing settings
    collection_method: str = Field(
        default="charge_automatically", description="How to collect payment"
    )
    days_until_due: int | None = Field(
        None, ge=1, description="Days until invoice due (for send_invoice)"
    )

    # Proration
    proration_behavior: str = Field(
        default="create_prorations", description="How to handle prorations"
    )

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    description: str | None = Field(None, max_length=500, description="Subscription description")

    # Automatic tax
    automatic_tax_enabled: bool = Field(
        default=False, description="Enable automatic tax calculation"
    )


class UpdateSubscriptionCommand(BaseCommand):
    """
    Command to update an existing subscription.

    Can change plan, quantity, billing cycle, etc.
    """

    subscription_id: str = Field(..., description="Subscription to update")
    plan_id: str | None = Field(None, description="New plan")
    quantity: int | None = Field(None, ge=1, description="New quantity")
    billing_cycle_anchor: datetime | None = Field(None, description="New billing cycle anchor")
    trial_end: datetime | None = Field(None, description="New trial end date")

    # Proration control
    proration_behavior: str = Field(default="create_prorations", description="Proration behavior")
    proration_date: datetime | None = Field(None, description="Effective date for proration")

    # Metadata
    metadata: dict[str, Any] | None = Field(None, description="Updated metadata")
    description: str | None = Field(None, description="Updated description")


class CancelSubscriptionCommand(BaseCommand):
    """
    Command to cancel a subscription.

    Can be immediate or at period end.
    """

    subscription_id: str = Field(..., description="Subscription to cancel")
    cancel_at_period_end: bool = Field(default=True, description="Cancel at end of current period")
    cancellation_reason: str | None = Field(None, description="Reason for cancellation")
    feedback: str | None = Field(None, max_length=1000, description="Customer feedback")

    # Immediate cancellation
    invoice_now: bool = Field(default=False, description="Create invoice for current period")
    prorate: bool = Field(default=True, description="Prorate if cancelling mid-period")


class PauseSubscriptionCommand(BaseCommand):
    """
    Command to pause a subscription.

    Paused subscriptions don't generate invoices but remain active.
    """

    subscription_id: str = Field(..., description="Subscription to pause")
    pause_behavior: str = Field(
        default="mark_uncollectible", description="What to do with pending invoices"
    )
    resume_at: datetime | None = Field(None, description="Scheduled resume date")


class ResumeSubscriptionCommand(BaseCommand):
    """
    Command to resume a paused subscription.

    Resumes invoice generation from next billing cycle.
    """

    subscription_id: str = Field(..., description="Subscription to resume")
    proration_behavior: str = Field(default="create_prorations", description="Proration behavior")


class ChangeSubscriptionPlanCommand(BaseCommand):
    """
    Command to change subscription to a different plan.

    Handles upgrades, downgrades, and plan switches.
    """

    subscription_id: str = Field(..., description="Subscription to modify")
    new_plan_id: str = Field(..., description="New plan ID")
    quantity: int | None = Field(None, ge=1, description="Quantity for new plan")
    proration_behavior: str = Field(default="create_prorations", description="Proration behavior")
    change_type: str = Field(..., description="'upgrade', 'downgrade', or 'crossgrade'")


class AddSubscriptionItemCommand(BaseCommand):
    """
    Command to add an item to a subscription.

    For multi-product subscriptions.
    """

    subscription_id: str = Field(..., description="Subscription to add item to")
    plan_id: str = Field(..., description="Plan/product to add")
    quantity: int = Field(default=1, ge=1, description="Quantity")
    proration_behavior: str = Field(default="create_prorations", description="Proration behavior")


class RemoveSubscriptionItemCommand(BaseCommand):
    """
    Command to remove an item from a subscription.
    """

    subscription_id: str = Field(..., description="Subscription to remove item from")
    item_id: str = Field(..., description="Item to remove")
    proration_behavior: str = Field(default="create_prorations", description="Proration behavior")
    clear_usage: bool = Field(default=False, description="Clear usage data")


class RenewSubscriptionCommand(BaseCommand):
    """
    Command to manually renew a subscription.

    Usually subscriptions auto-renew, but this allows manual renewal.
    """

    subscription_id: str = Field(..., description="Subscription to renew")
    invoice_immediately: bool = Field(default=True, description="Create invoice immediately")
