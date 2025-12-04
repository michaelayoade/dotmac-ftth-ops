"""
GraphQL types for Payment and Billing Management.

Provides types for payments with efficient batched loading of related
customer and invoice data via DataLoaders to prevent N+1 query problems.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Any

import strawberry

if TYPE_CHECKING:
    type JSONScalar = Any
else:
    from strawberry.scalars import JSON as JSONScalar


@strawberry.enum
class PaymentStatusEnum(str, Enum):
    """Payment processing status."""

    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"
    REQUIRES_ACTION = "requires_action"
    REQUIRES_CAPTURE = "requires_capture"
    REQUIRES_CONFIRMATION = "requires_confirmation"


@strawberry.enum
class PaymentMethodTypeEnum(str, Enum):
    """Type of payment method."""

    CARD = "card"
    BANK_ACCOUNT = "bank_account"
    DIGITAL_WALLET = "digital_wallet"
    CASH = "cash"
    CHECK = "check"
    WIRE_TRANSFER = "wire_transfer"
    ACH = "ach"
    CRYPTO = "crypto"
    OTHER = "other"


@strawberry.type
class PaymentCustomer:
    """Customer information for a payment (simplified)."""

    id: strawberry.ID
    name: str
    email: str
    customer_number: str | None


@strawberry.type
class PaymentInvoice:
    """Invoice information for a payment (simplified)."""

    id: strawberry.ID
    invoice_number: str
    total_amount: Decimal
    status: str


@strawberry.type
class PaymentMethod:
    """Payment method details (simplified for security)."""

    type: PaymentMethodTypeEnum
    provider: str
    last4: str | None
    brand: str | None
    expiry_month: int | None
    expiry_year: int | None


@strawberry.type
class Payment:
    """
    Payment transaction with related data.

    Customer and invoice data are batched via DataLoaders to prevent N+1 queries.
    Only includes fields actually used by the frontend (15 of 78 fields = 80% reduction).
    """

    # Core identifiers
    id: strawberry.ID
    payment_number: str | None

    # Amount information
    amount: Decimal
    currency: str
    fee_amount: Decimal | None
    net_amount: Decimal | None
    refund_amount: Decimal | None

    # Status and processing
    status: PaymentStatusEnum
    failure_reason: str | None
    failure_code: str | None

    # Payment method
    payment_method_type: PaymentMethodTypeEnum
    provider: str
    payment_method: PaymentMethod | None

    # Related entities (batched via DataLoaders)
    customer_id: strawberry.ID
    customer: PaymentCustomer | None

    invoice_id: strawberry.ID | None
    invoice: PaymentInvoice | None

    subscription_id: strawberry.ID | None

    # Dates
    created_at: datetime
    processed_at: datetime | None
    refunded_at: datetime | None

    # Metadata (optional, for extensibility)
    description: str | None
    metadata: JSONScalar | None

    @classmethod
    def from_model(cls, payment: Any) -> "Payment":
        """Convert SQLAlchemy PaymentEntity model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(payment.payment_id)),
            payment_number=payment.payment_number,
            amount=payment.amount,
            currency=payment.currency,
            fee_amount=payment.fee_amount,
            net_amount=payment.net_amount,
            refund_amount=payment.refund_amount,
            status=PaymentStatusEnum(payment.status.value),
            failure_reason=payment.failure_reason,
            failure_code=payment.failure_code,
            payment_method_type=PaymentMethodTypeEnum(payment.payment_method_type.value),
            provider=payment.provider,
            payment_method=None,  # Can be populated if needed
            customer_id=strawberry.ID(str(payment.customer_id)),
            customer=None,  # Populated by DataLoader
            invoice_id=strawberry.ID(str(payment.invoice_id)) if payment.invoice_id else None,
            invoice=None,  # Populated by DataLoader
            subscription_id=(
                strawberry.ID(str(payment.subscription_id)) if payment.subscription_id else None
            ),
            created_at=payment.created_at,
            processed_at=payment.processed_at,
            refunded_at=payment.refunded_at,
            description=payment.description,
            metadata=payment.metadata,
        )


@strawberry.type
class PaymentConnection:
    """Paginated payment results."""

    payments: list[Payment]
    total_count: int
    has_next_page: bool
    total_amount: Decimal
    total_succeeded: Decimal
    total_pending: Decimal
    total_failed: Decimal


@strawberry.type
class PaymentMetrics:
    """Aggregated payment metrics."""

    total_payments: int
    succeeded_count: int
    pending_count: int
    failed_count: int
    refunded_count: int

    total_revenue: Decimal
    pending_amount: Decimal
    failed_amount: Decimal
    refunded_amount: Decimal

    success_rate: float
    average_payment_size: Decimal

    # Time-based metrics
    today_revenue: Decimal
    week_revenue: Decimal
    month_revenue: Decimal
