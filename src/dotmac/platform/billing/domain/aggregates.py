"""
Billing Domain Aggregates.

Domain aggregates encapsulate business logic and enforce invariants.
They raise domain events for state changes.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from pydantic import Field

from dotmac.platform.core import (
    AggregateRoot,
    CustomerCreatedEvent,
    CustomerDeletedEvent,
    CustomerUpdatedEvent,
    InvoiceCreatedEvent,
    InvoiceOverdueEvent,
    InvoicePaymentReceivedEvent,
    InvoiceVoidedEvent,
    Money,
    PaymentFailedEvent,
    PaymentProcessedEvent,
    PaymentRefundedEvent,
    SubscriptionCancelledEvent,
    SubscriptionCreatedEvent,
    SubscriptionRenewedEvent,
    SubscriptionUpgradedEvent,
)
from dotmac.platform.core.exceptions import BusinessRuleError

# ============================================================================
# Invoice Aggregate
# ============================================================================


class InvoiceLineItem:
    """Invoice line item value object."""

    def __init__(
        self,
        description: str,
        quantity: int,
        unit_price: Money,
        total_price: Money,
        product_id: str | None = None,
    ):
        """Initialize line item."""
        self.description = description
        self.quantity = quantity
        self.unit_price = unit_price
        self.total_price = total_price
        self.product_id = product_id

        # Validate totals
        calculated_total = Money(
            amount=unit_price.amount * quantity,
            currency=unit_price.currency,
        )
        if calculated_total.amount != total_price.amount:
            raise BusinessRuleError(
                f"Line item total {total_price.amount} does not match "
                f"calculated total {calculated_total.amount}"
            )


class Invoice(AggregateRoot):  # type: ignore[misc]  # AggregateRoot resolves to Any in isolation
    """
    Invoice aggregate root.

    Encapsulates all business logic related to invoices including
    creation, payment, voiding, and overdue handling.
    """

    invoice_number: str
    customer_id: str
    billing_email: str
    issue_date: datetime
    due_date: datetime

    # Amounts
    subtotal: Money
    tax_amount: Money = Field(default_factory=lambda: Money(amount=0.0, currency="USD"))
    discount_amount: Money = Field(default_factory=lambda: Money(amount=0.0, currency="USD"))
    total_amount: Money
    remaining_balance: Money  # Track unpaid balance

    # Line items (stored as dict for Pydantic compatibility)
    line_items_data: list[dict[str, Any]] = Field(default_factory=lambda: [])

    # Status
    status: str = "draft"  # draft, finalized, sent, paid, void, overdue
    payment_status: str = "pending"  # pending, partial, paid, overdue

    # References
    subscription_id: str | None = None
    notes: str | None = None

    # Payment tracking
    paid_at: datetime | None = None
    voided_at: datetime | None = None

    @classmethod
    def create(
        cls,
        tenant_id: str,
        customer_id: str,
        billing_email: str,
        line_items: list[InvoiceLineItem],
        due_days: int = 30,
        subscription_id: str | None = None,
        notes: str | None = None,
    ) -> Invoice:
        """
        Create a new invoice.

        Args:
            tenant_id: Tenant ID
            customer_id: Customer ID
            billing_email: Customer billing email
            line_items: List of invoice line items
            due_days: Days until invoice is due
            subscription_id: Optional subscription reference
            notes: Optional notes

        Returns:
            New invoice instance

        Raises:
            BusinessRuleError: If validation fails
        """
        if not line_items:
            raise BusinessRuleError("Invoice must have at least one line item")

        # Calculate totals
        currency = line_items[0].unit_price.currency
        subtotal = Money(amount=0.0, currency=currency)

        for item in line_items:
            if item.total_price.currency != currency:
                raise BusinessRuleError("All line items must use same currency")
            subtotal = subtotal.add(item.total_price)

        now = datetime.now(UTC)
        due_date = now + timedelta(days=due_days)

        invoice = cls(
            id=str(uuid4()),
            tenant_id=tenant_id,
            invoice_number=cls._generate_invoice_number(),
            customer_id=customer_id,
            billing_email=billing_email,
            issue_date=now,
            due_date=due_date,
            subtotal=subtotal,
            total_amount=subtotal,
            remaining_balance=subtotal,  # Initialize with full amount
            line_items_data=[
                {
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price.amount,
                    "total_price": item.total_price.amount,
                    "product_id": item.product_id,
                }
                for item in line_items
            ],
            subscription_id=subscription_id,
            notes=notes,
        )

        invoice.raise_event(
            InvoiceCreatedEvent(
                aggregate_id=invoice.id,
                tenant_id=invoice.tenant_id,
                invoice_number=invoice.invoice_number,
                customer_id=invoice.customer_id,
                amount=invoice.total_amount.amount,
                currency=invoice.total_amount.currency,
                sequence=None,
            )
        )

        return invoice

    def finalize(self) -> None:
        """
        Finalize invoice (transition from draft to finalized).

        Raises:
            BusinessRuleError: If invoice is not in draft status
        """
        if self.status != "draft":
            raise BusinessRuleError(f"Cannot finalize invoice in {self.status} status")

        self.status = "finalized"

    def send(self) -> None:
        """
        Mark invoice as sent to customer.

        Raises:
            BusinessRuleError: If invoice is not finalized
        """
        if self.status not in ("finalized", "sent"):
            raise BusinessRuleError(
                f"Cannot send invoice in {self.status} status. Must be finalized first."
            )

        self.status = "sent"

    def apply_payment(self, payment_id: str, amount: Money, payment_method: str = "card") -> None:
        """
        Apply payment to invoice.

        Args:
            payment_id: Payment ID
            amount: Payment amount
            payment_method: Payment method used

        Raises:
            BusinessRuleError: If payment cannot be applied
        """
        if self.status == "void":
            raise BusinessRuleError("Cannot apply payment to voided invoice")

        if self.status == "paid":
            raise BusinessRuleError("Invoice is already fully paid")

        if amount.currency != self.total_amount.currency:
            raise BusinessRuleError(
                f"Payment currency {amount.currency} does not match "
                f"invoice currency {self.total_amount.currency}"
            )

        if amount.amount <= 0:
            raise BusinessRuleError("Payment amount must be positive")

        if amount.amount > self.remaining_balance.amount:
            raise BusinessRuleError(
                f"Payment amount {amount.amount} exceeds remaining balance {self.remaining_balance.amount}"
            )

        # Reduce remaining balance
        self.remaining_balance = Money(
            amount=self.remaining_balance.amount - amount.amount,
            currency=self.remaining_balance.currency,
        )

        # Update payment status
        if self.remaining_balance.amount == 0:
            self.status = "paid"
            self.payment_status = "paid"
            self.paid_at = datetime.now(UTC)
        else:
            self.payment_status = "partial"

        self.raise_event(
            InvoicePaymentReceivedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                invoice_number=self.invoice_number,
                payment_id=payment_id,
                amount=amount.amount,
                payment_method=payment_method,
                sequence=None,
            )
        )

    def void(self, reason: str | None = None) -> None:
        """
        Void the invoice.

        Args:
            reason: Reason for voiding

        Raises:
            BusinessRuleError: If invoice cannot be voided
        """
        if self.status == "paid":
            raise BusinessRuleError("Cannot void paid invoice. Use refund instead.")

        if self.status == "void":
            raise BusinessRuleError("Invoice is already voided")

        self.status = "void"
        self.voided_at = datetime.now(UTC)

        self.raise_event(
            InvoiceVoidedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                invoice_number=self.invoice_number,
                reason=reason,
                sequence=None,
            )
        )

    def mark_overdue(self) -> None:
        """
        Mark invoice as overdue.

        Raises:
            BusinessRuleError: If invoice cannot be marked overdue
        """
        if self.status in ("paid", "void"):
            raise BusinessRuleError(f"Cannot mark {self.status} invoice as overdue")

        now = datetime.now(UTC)
        if now < self.due_date:
            raise BusinessRuleError("Invoice is not yet due")

        self.status = "overdue"
        self.payment_status = "overdue"

        days_overdue = (now - self.due_date).days

        self.raise_event(
            InvoiceOverdueEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                invoice_number=self.invoice_number,
                days_overdue=days_overdue,
                amount_due=self.total_amount.amount,
                sequence=None,
            )
        )

    @staticmethod
    def _generate_invoice_number() -> str:
        """Generate unique invoice number."""
        return f"INV-{str(uuid4())[:8].upper()}"


# ============================================================================
# Payment Aggregate
# ============================================================================


class Payment(AggregateRoot):  # type: ignore[misc]  # AggregateRoot resolves to Any in isolation
    """
    Payment aggregate root.

    Handles payment processing, failures, and refunds.
    """

    payment_id: str
    customer_id: str
    amount: Money
    payment_method: str
    status: str = "pending"  # pending, processing, succeeded, failed, refunded

    # References
    invoice_id: str | None = None
    subscription_id: str | None = None

    # Processing details
    transaction_id: str | None = None
    error_code: str | None = None
    error_message: str | None = None

    # Timestamps
    processed_at: datetime | None = None
    failed_at: datetime | None = None
    refunded_at: datetime | None = None

    @classmethod
    def create(
        cls,
        tenant_id: str,
        customer_id: str,
        amount: Money,
        payment_method: str,
        invoice_id: str | None = None,
        subscription_id: str | None = None,
    ) -> Payment:
        """Create new payment."""
        if amount.amount <= 0:
            raise BusinessRuleError("Payment amount must be positive")

        return cls(
            id=str(uuid4()),
            tenant_id=tenant_id,
            payment_id=f"PAY-{str(uuid4())[:8].upper()}",
            customer_id=customer_id,
            amount=amount,
            payment_method=payment_method,
            invoice_id=invoice_id,
            subscription_id=subscription_id,
        )

    def process(self, transaction_id: str) -> None:
        """
        Mark payment as successfully processed.

        Args:
            transaction_id: External transaction ID

        Raises:
            BusinessRuleError: If payment cannot be processed
        """
        if self.status == "succeeded":
            raise BusinessRuleError("Payment already succeeded")

        if self.status == "refunded":
            raise BusinessRuleError("Cannot process refunded payment")

        self.status = "succeeded"
        self.transaction_id = transaction_id
        self.processed_at = datetime.now(UTC)

        self.raise_event(
            PaymentProcessedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                payment_id=self.payment_id,
                amount=self.amount.amount,
                currency=self.amount.currency,
                payment_method=self.payment_method,
                customer_id=self.customer_id,
                sequence=None,
            )
        )

    def fail(self, error_code: str, error_message: str) -> None:
        """
        Mark payment as failed.

        Args:
            error_code: Error code from payment processor
            error_message: Human-readable error message

        Raises:
            BusinessRuleError: If payment is already succeeded
        """
        if self.status == "succeeded":
            raise BusinessRuleError("Cannot fail succeeded payment")

        self.status = "failed"
        self.error_code = error_code
        self.error_message = error_message
        self.failed_at = datetime.now(UTC)

        self.raise_event(
            PaymentFailedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                payment_id=self.payment_id,
                amount=self.amount.amount,
                currency=self.amount.currency,
                error_code=error_code,
                error_message=error_message,
                customer_id=self.customer_id,
                sequence=None,
            )
        )

    def refund(self, reason: str | None = None) -> None:
        """
        Refund the payment.

        Args:
            reason: Reason for refund

        Raises:
            BusinessRuleError: If payment cannot be refunded
        """
        if self.status != "succeeded":
            raise BusinessRuleError("Can only refund succeeded payments")

        if self.status == "refunded":
            raise BusinessRuleError("Payment already refunded")

        refund_id = f"REF-{str(uuid4())[:8].upper()}"
        self.status = "refunded"
        self.refunded_at = datetime.now(UTC)

        self.raise_event(
            PaymentRefundedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                payment_id=self.payment_id,
                refund_id=refund_id,
                amount=self.amount.amount,
                reason=reason,
                sequence=None,
            )
        )


# ============================================================================
# Subscription Aggregate
# ============================================================================


class Subscription(AggregateRoot):  # type: ignore[misc]  # AggregateRoot resolves to Any in isolation
    """
    Subscription aggregate root.

    Manages subscription lifecycle, renewals, upgrades, and cancellations.
    """

    subscription_id: str
    customer_id: str
    plan_id: str
    status: str = "active"  # active, cancelled, expired, paused

    # Billing
    billing_cycle: str = "monthly"  # monthly, yearly, quarterly
    amount: Money

    # Dates
    start_date: datetime
    current_period_start: datetime
    current_period_end: datetime
    cancelled_at: datetime | None = None
    cancel_at_period_end: bool = False

    # Trial
    trial_end: datetime | None = None
    is_trial: bool = False

    @classmethod
    def create(
        cls,
        tenant_id: str,
        customer_id: str,
        plan_id: str,
        amount: Money,
        billing_cycle: str = "monthly",
        trial_days: int = 0,
    ) -> Subscription:
        """Create new subscription."""
        now = datetime.now(UTC)

        # Calculate period dates
        if billing_cycle == "monthly":
            period_end = now + timedelta(days=30)
        elif billing_cycle == "yearly":
            period_end = now + timedelta(days=365)
        elif billing_cycle == "quarterly":
            period_end = now + timedelta(days=90)
        else:
            raise BusinessRuleError(f"Invalid billing cycle: {billing_cycle}")

        # Trial setup
        is_trial = trial_days > 0
        trial_end = now + timedelta(days=trial_days) if is_trial else None

        subscription = cls(
            id=str(uuid4()),
            tenant_id=tenant_id,
            subscription_id=f"SUB-{str(uuid4())[:8].upper()}",
            customer_id=customer_id,
            plan_id=plan_id,
            amount=amount,
            billing_cycle=billing_cycle,
            start_date=now,
            current_period_start=now,
            current_period_end=period_end,
            is_trial=is_trial,
            trial_end=trial_end,
        )

        subscription.raise_event(
            SubscriptionCreatedEvent(
                aggregate_id=subscription.id,
                tenant_id=subscription.tenant_id,
                subscription_id=subscription.subscription_id,
                customer_id=subscription.customer_id,
                plan_id=subscription.plan_id,
                start_date=now,
                sequence=None,
            )
        )

        return subscription

    def renew(self) -> None:
        """Renew subscription for next billing period."""
        if self.status != "active":
            raise BusinessRuleError(f"Cannot renew {self.status} subscription")

        now = datetime.now(UTC)
        self.current_period_start = self.current_period_end
        self.current_period_end = self._calculate_next_period_end()
        self.is_trial = False
        self.trial_end = None

        self.raise_event(
            SubscriptionRenewedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                subscription_id=self.subscription_id,
                renewal_date=now,
                next_billing_date=self.current_period_end,
                sequence=None,
            )
        )

    def cancel(
        self,
        immediately: bool = False,
        reason: str | None = None,
    ) -> None:
        """Cancel subscription."""
        if self.status == "cancelled":
            raise BusinessRuleError("Subscription already cancelled")

        now = datetime.now(UTC)

        if immediately:
            self.status = "cancelled"
            self.cancelled_at = now
            end_of_service = now
        else:
            self.cancel_at_period_end = True
            self.cancelled_at = now
            end_of_service = self.current_period_end

        self.raise_event(
            SubscriptionCancelledEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                subscription_id=self.subscription_id,
                cancellation_reason=reason,
                cancelled_at=now,
                end_of_service_date=end_of_service,
                sequence=None,
            )
        )

    def upgrade(self, new_plan_id: str, new_amount: Money) -> None:
        """Upgrade subscription to new plan."""
        if self.status != "active":
            raise BusinessRuleError(f"Cannot upgrade {self.status} subscription")

        old_plan_id = self.plan_id
        self.plan_id = new_plan_id
        self.amount = new_amount

        self.raise_event(
            SubscriptionUpgradedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                subscription_id=self.subscription_id,
                old_plan_id=old_plan_id,
                new_plan_id=new_plan_id,
                effective_date=datetime.now(UTC),
                sequence=None,
            )
        )

    def _calculate_next_period_end(self) -> datetime:
        """Calculate next period end date."""
        if self.billing_cycle == "monthly":
            return self.current_period_end + timedelta(days=30)
        elif self.billing_cycle == "yearly":
            return self.current_period_end + timedelta(days=365)
        elif self.billing_cycle == "quarterly":
            return self.current_period_end + timedelta(days=90)
        else:
            raise BusinessRuleError(f"Invalid billing cycle: {self.billing_cycle}")


# ============================================================================
# Customer Aggregate
# ============================================================================


class Customer(AggregateRoot):  # type: ignore[misc]  # AggregateRoot resolves to Any in isolation
    """
    Customer aggregate root.

    Manages customer information and behavior.
    """

    customer_id: str
    email: str
    name: str
    company: str | None = None
    phone: str | None = None

    # Status
    status: str = "active"  # active, inactive, suspended
    is_deleted: bool = False

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=lambda: {})

    # Timestamps
    deleted_at: datetime | None = None

    @classmethod
    def create(
        cls,
        tenant_id: str,
        email: str,
        name: str,
        company: str | None = None,
        phone: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Customer:
        """Create new customer."""
        customer = cls(
            id=str(uuid4()),
            tenant_id=tenant_id,
            customer_id=f"CUST-{str(uuid4())[:8].upper()}",
            email=email,
            name=name,
            company=company,
            phone=phone,
            metadata=metadata or {},
        )

        customer.raise_event(
            CustomerCreatedEvent(
                aggregate_id=customer.id,
                tenant_id=customer.tenant_id,
                customer_id=customer.customer_id,
                email=customer.email,
                name=customer.name,
                sequence=None,
            )
        )

        return customer

    def update(
        self,
        name: str | None = None,
        email: str | None = None,
        company: str | None = None,
        phone: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Update customer information."""
        updated_fields = []

        if name is not None and name != self.name:
            self.name = name
            updated_fields.append("name")

        if email is not None and email != self.email:
            self.email = email
            updated_fields.append("email")

        if company is not None and company != self.company:
            self.company = company
            updated_fields.append("company")

        if phone is not None and phone != self.phone:
            self.phone = phone
            updated_fields.append("phone")

        if metadata is not None:
            self.metadata.update(metadata)
            updated_fields.append("metadata")

        if updated_fields:
            self.raise_event(
                CustomerUpdatedEvent(
                    aggregate_id=self.id,
                    tenant_id=self.tenant_id,
                    customer_id=self.customer_id,
                    updated_fields=updated_fields,
                    sequence=None,
                )
            )

    def delete(self, reason: str | None = None) -> None:
        """Soft delete customer."""
        if self.is_deleted:
            raise BusinessRuleError("Customer already deleted")

        self.is_deleted = True
        self.status = "inactive"
        self.deleted_at = datetime.now(UTC)

        self.raise_event(
            CustomerDeletedEvent(
                aggregate_id=self.id,
                tenant_id=self.tenant_id,
                customer_id=self.customer_id,
                deletion_reason=reason,
                sequence=None,
            )
        )
