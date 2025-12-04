"""
Aggregate Root base class for Domain-Driven Design.

An aggregate is a cluster of domain objects that can be treated as a single unit.
The aggregate root is the only member of the aggregate that outside objects are
allowed to hold references to.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.core.events import DomainEvent

if TYPE_CHECKING:
    from collections.abc import Sequence


class AggregateRoot(BaseModel):  # BaseModel resolves to Any in isolation
    """
    Base class for aggregate roots in DDD.

    Aggregate roots:
    - Have a unique identity
    - Maintain invariants across the aggregate
    - Raise domain events to communicate state changes
    - Control all access to the aggregate

    Usage:
        class Invoice(AggregateRoot):
            invoice_number: str
            customer_id: str
            amount: Decimal
            status: InvoiceStatus

            def pay(self, payment_id: str, amount: Decimal):
                # Validate business rules
                if self.status != InvoiceStatus.PENDING:
                    raise InvalidOperationError("Invoice not pending")

                # Update state
                self.status = InvoiceStatus.PAID

                # Raise domain event
                self.raise_event(InvoicePaymentReceivedEvent(
                    aggregate_id=self.id,
                    invoice_number=self.invoice_number,
                    payment_id=payment_id,
                    amount=amount,
                ))
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
    )

    # Aggregate identity
    id: str = Field(
        ...,
        description="Unique identifier for this aggregate",
    )

    tenant_id: str = Field(
        ...,
        description="Tenant ID for multi-tenant isolation",
    )

    # Version for optimistic concurrency control
    version: int = Field(
        default=1,
        description="Version number for optimistic locking",
    )

    # Domain events raised by this aggregate
    _domain_events: list[DomainEvent] = []

    def raise_event(self, event: DomainEvent) -> None:
        """
        Raise a domain event.

        The event will be stored and can be dispatched later using
        dispatch_events().

        Args:
            event: Domain event to raise
        """
        # Ensure event has correct aggregate info
        if not event.aggregate_id:
            object.__setattr__(event, "aggregate_id", self.id)

        if not event.tenant_id:
            object.__setattr__(event, "tenant_id", self.tenant_id)

        # Set sequence number
        object.__setattr__(event, "sequence", len(self._domain_events) + 1)

        self._domain_events.append(event)

    def get_domain_events(self) -> Sequence[DomainEvent]:
        """
        Get all domain events raised by this aggregate.

        Returns:
            List of domain events
        """
        return tuple(self._domain_events)

    def clear_domain_events(self) -> None:
        """Clear all domain events (typically after dispatching)."""
        self._domain_events.clear()

    def increment_version(self) -> None:
        """Increment the version number (for optimistic locking)."""
        self.version += 1


class Entity(BaseModel):  # BaseModel resolves to Any in isolation
    """
    Base class for entities within an aggregate.

    Entities have identity but are not aggregate roots.
    They are always accessed through their aggregate root.
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    id: str = Field(
        ...,
        description="Unique identifier for this entity",
    )


class ValueObject(BaseModel):  # BaseModel resolves to Any in isolation
    """
    Base class for value objects.

    Value objects:
    - Have no identity
    - Are immutable
    - Are compared by value, not identity
    - Can be freely shared
    """

    model_config = ConfigDict(
        frozen=True,  # Immutable
        str_strip_whitespace=True,
    )


# ============================================================================
# Example Value Objects
# ============================================================================


class Money(ValueObject):
    """Money value object."""

    amount: float = Field(..., description="Amount")
    currency: str = Field(..., description="Currency code (ISO 4217)")

    def add(self, other: Money) -> Money:
        """Add two money values (must be same currency)."""
        if self.currency != other.currency:
            raise ValueError(f"Cannot add {self.currency} and {other.currency}")
        return Money(amount=self.amount + other.amount, currency=self.currency)

    def subtract(self, other: Money) -> Money:
        """Subtract two money values (must be same currency)."""
        if self.currency != other.currency:
            raise ValueError(f"Cannot subtract {self.currency} and {other.currency}")
        return Money(amount=self.amount - other.amount, currency=self.currency)

    def multiply(self, multiplier: float) -> Money:
        """Multiply money by a scalar."""
        return Money(amount=self.amount * multiplier, currency=self.currency)

    def is_zero(self) -> bool:
        """Check if amount is zero."""
        return self.amount == 0.0

    def is_positive(self) -> bool:
        """Check if amount is positive."""
        return self.amount > 0.0

    def is_negative(self) -> bool:
        """Check if amount is negative."""
        return self.amount < 0.0


class EmailAddress(ValueObject):
    """Email address value object with validation."""

    value: str = Field(..., description="Email address")

    @property
    def domain(self) -> str:
        """Get email domain."""
        return self.value.split("@")[1]

    @property
    def local_part(self) -> str:
        """Get local part of email."""
        return self.value.split("@")[0]


class PhoneNumber(ValueObject):
    """Phone number value object."""

    value: str = Field(..., description="Phone number")
    country_code: str | None = Field(None, description="Country code")

    def formatted(self) -> str:
        """Get formatted phone number."""
        if self.country_code:
            return f"+{self.country_code} {self.value}"
        return self.value
