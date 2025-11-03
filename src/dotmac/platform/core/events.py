"""
Domain Events for Domain-Driven Design (DDD).

This module provides domain event infrastructure for implementing
event sourcing and domain-driven design patterns.

Domain events are different from integration events:
- Domain events: Model state changes within aggregates (in-process)
- Integration events: Communicate between bounded contexts (cross-process)

Usage:
    class InvoiceCreatedEvent(DomainEvent):
        invoice_number: str
        amount: Decimal

    class Invoice(AggregateRoot):
        def create(self, number: str, amount: Decimal):
            self.raise_event(InvoiceCreatedEvent(
                aggregate_id=self.id,
                invoice_number=number,
                amount=amount,
            ))
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any, TypeVar

from pydantic import BaseModel, ConfigDict, Field

# Type aliases
DomainEventHandler = Callable[[Any], Awaitable[None]]
T = TypeVar("T", bound="DomainEvent")


class DomainEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """
    Base class for domain events.

    Domain events represent something that happened in the domain that
    domain experts care about. They are facts about the past.

    Attributes:
        event_id: Unique identifier for this event
        event_type: Type of event (automatically set from class name)
        aggregate_id: ID of the aggregate that raised this event
        aggregate_type: Type of aggregate (e.g., "Invoice", "Customer")
        tenant_id: Tenant ID for multi-tenant isolation
        timestamp: When the event occurred (UTC)
        sequence: Sequence number for ordering (optional)
        data: Additional event data
        metadata: Event metadata for tracing/correlation
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        frozen=True,  # Domain events are immutable
        extra="forbid",
    )

    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique event identifier",
    )
    event_type: str = Field(
        default="",
        description="Event type (auto-populated from class name)",
    )
    aggregate_id: str = Field(
        ...,
        description="ID of the aggregate that raised this event",
    )
    aggregate_type: str = Field(
        default="",
        description="Type of aggregate (e.g., Invoice, Customer)",
    )
    tenant_id: str = Field(
        ...,
        description="Tenant ID for multi-tenant isolation",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the event occurred (UTC)",
    )
    sequence: int | None = Field(
        None,
        description="Sequence number for event ordering",
    )
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional event data",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Event metadata (correlation_id, causation_id, etc.)",
    )

    def model_post_init(self, __context: Any) -> None:
        """Set event_type and aggregate_type from class name if not provided."""
        if not self.event_type:
            # Use object.__setattr__ since model is frozen
            object.__setattr__(self, "event_type", self.__class__.__name__)

        if not self.aggregate_type and hasattr(self, "_aggregate_type"):
            object.__setattr__(self, "aggregate_type", self._aggregate_type)

    def to_dict(self) -> dict[str, Any]:
        """Convert event to dictionary."""
        return self.model_dump(mode="json")

    @classmethod
    def from_dict(cls: type[T], data: dict[str, Any]) -> T:
        """Create event from dictionary."""
        return cls.model_validate(data)

    def __str__(self) -> str:
        """String representation."""
        return (
            f"{self.event_type}("
            f"aggregate_id={self.aggregate_id}, "
            f"tenant_id={self.tenant_id}, "
            f"timestamp={self.timestamp.isoformat()})"
        )


class DomainEventMetadata(BaseModel):  # BaseModel resolves to Any in isolation
    """Metadata for domain events (correlation, causation, etc.)."""

    model_config = ConfigDict(extra="allow")

    correlation_id: str | None = Field(
        None,
        description="Correlation ID for tracking related events",
    )
    causation_id: str | None = Field(
        None,
        description="ID of the event that caused this event",
    )
    user_id: str | None = Field(
        None,
        description="User who triggered this event",
    )
    source: str | None = Field(
        None,
        description="Source system/service",
    )
    trace_id: str | None = Field(
        None,
        description="Distributed tracing ID",
    )


# ============================================================================
# Billing Domain Events
# ============================================================================


class InvoiceCreatedEvent(DomainEvent):
    """Raised when an invoice is created."""

    _aggregate_type = "Invoice"

    invoice_number: str
    customer_id: str
    amount: float
    currency: str


class InvoicePaymentReceivedEvent(DomainEvent):
    """Raised when payment is received for an invoice."""

    _aggregate_type = "Invoice"

    invoice_number: str
    payment_id: str
    amount: float
    payment_method: str


class InvoiceVoidedEvent(DomainEvent):
    """Raised when an invoice is voided."""

    _aggregate_type = "Invoice"

    invoice_number: str
    reason: str | None = None


class InvoiceOverdueEvent(DomainEvent):
    """Raised when an invoice becomes overdue."""

    _aggregate_type = "Invoice"

    invoice_number: str
    days_overdue: int
    amount_due: float


# ============================================================================
# Subscription Domain Events
# ============================================================================


class SubscriptionCreatedEvent(DomainEvent):
    """Raised when a subscription is created."""

    _aggregate_type = "Subscription"

    subscription_id: str
    customer_id: str
    plan_id: str
    start_date: datetime


class SubscriptionRenewedEvent(DomainEvent):
    """Raised when a subscription is renewed."""

    _aggregate_type = "Subscription"

    subscription_id: str
    renewal_date: datetime
    next_billing_date: datetime


class SubscriptionCancelledEvent(DomainEvent):
    """Raised when a subscription is cancelled."""

    _aggregate_type = "Subscription"

    subscription_id: str
    cancellation_reason: str | None = None
    cancelled_at: datetime
    end_of_service_date: datetime


class SubscriptionUpgradedEvent(DomainEvent):
    """Raised when a subscription is upgraded."""

    _aggregate_type = "Subscription"

    subscription_id: str
    old_plan_id: str
    new_plan_id: str
    effective_date: datetime


# ============================================================================
# Customer Domain Events
# ============================================================================


class CustomerCreatedEvent(DomainEvent):
    """Raised when a customer is created."""

    _aggregate_type = "Customer"

    customer_id: str
    email: str
    name: str


class CustomerUpdatedEvent(DomainEvent):
    """Raised when customer information is updated."""

    _aggregate_type = "Customer"

    customer_id: str
    updated_fields: list[str]


class CustomerDeletedEvent(DomainEvent):
    """Raised when a customer is deleted."""

    _aggregate_type = "Customer"

    customer_id: str
    deletion_reason: str | None = None


# ============================================================================
# Payment Domain Events
# ============================================================================


class PaymentProcessedEvent(DomainEvent):
    """Raised when a payment is successfully processed."""

    _aggregate_type = "Payment"

    payment_id: str
    amount: float
    currency: str
    payment_method: str
    customer_id: str


class PaymentFailedEvent(DomainEvent):
    """Raised when a payment fails."""

    _aggregate_type = "Payment"

    payment_id: str
    amount: float
    currency: str
    error_code: str
    error_message: str
    customer_id: str


class PaymentRefundedEvent(DomainEvent):
    """Raised when a payment is refunded."""

    _aggregate_type = "Payment"

    payment_id: str
    refund_id: str
    amount: float
    reason: str | None = None
