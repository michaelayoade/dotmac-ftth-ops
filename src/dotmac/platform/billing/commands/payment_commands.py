"""
Payment Commands - Write operations for payments
"""

from datetime import UTC, datetime
from typing import Any

from pydantic import Field

from .invoice_commands import BaseCommand


class CreatePaymentCommand(BaseCommand):
    """
    Command to create a new payment.

    Payments can be for invoices or standalone (e.g., account credit).
    """

    invoice_id: str | None = Field(None, description="Invoice to pay (optional)")
    customer_id: str = Field(..., description="Customer making payment")
    amount: int = Field(..., gt=0, description="Payment amount in minor units")
    currency: str = Field(default="USD", description="Payment currency")
    payment_method_id: str = Field(..., description="Payment method to use")
    description: str | None = Field(None, max_length=500, description="Payment description")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    # Payment processor fields
    external_payment_id: str | None = Field(None, description="External processor payment ID")
    provider: str = Field(default="stripe", description="Payment provider (stripe, paypal, etc)")

    # Capture control
    capture_immediately: bool = Field(default=True, description="Capture payment immediately")


class CapturePaymentCommand(BaseCommand):
    """
    Command to capture a previously authorized payment.

    Used when payments are authorized but not immediately captured.
    """

    payment_id: str = Field(..., description="Payment to capture")
    amount: int | None = Field(
        None, gt=0, description="Amount to capture (defaults to full amount)"
    )


class RefundPaymentCommand(BaseCommand):
    """
    Command to refund a payment.

    Can be full or partial refund.
    """

    payment_id: str = Field(..., description="Payment to refund")
    amount: int | None = Field(None, gt=0, description="Refund amount (defaults to full amount)")
    reason: str = Field(..., min_length=10, max_length=500, description="Refund reason")
    create_credit_note: bool = Field(default=True, description="Create credit note for refund")
    notify_customer: bool = Field(default=True, description="Send refund notification")


class CancelPaymentCommand(BaseCommand):
    """
    Command to cancel a pending or authorized payment.

    Cannot cancel captured/succeeded payments (use refund instead).
    """

    payment_id: str = Field(..., description="Payment to cancel")
    cancellation_reason: str = Field(
        ..., min_length=10, max_length=500, description="Cancellation reason"
    )


class RecordOfflinePaymentCommand(BaseCommand):
    """
    Command to record an offline payment (cash, check, wire transfer).

    These payments are processed outside the platform.
    """

    invoice_id: str = Field(..., description="Invoice this payment is for")
    customer_id: str = Field(..., description="Customer who made payment")
    amount: int = Field(..., gt=0, description="Payment amount in minor units")
    currency: str = Field(default="USD", description="Payment currency")
    payment_method: str = Field(..., description="Payment method (cash, check, wire)")
    reference_number: str | None = Field(None, description="Check number, wire reference, etc")
    payment_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Date payment received"
    )
    notes: str | None = Field(None, max_length=1000, description="Additional notes")


class RetryFailedPaymentCommand(BaseCommand):
    """
    Command to retry a failed payment.

    Attempts payment again with same or different payment method.
    """

    payment_id: str = Field(..., description="Failed payment to retry")
    payment_method_id: str | None = Field(None, description="Different payment method to use")


class VoidPaymentCommand(BaseCommand):
    """
    Command to void an authorized payment.

    Similar to cancel but specifically for authorized payments before capture.
    """

    payment_id: str = Field(..., description="Payment to void")
