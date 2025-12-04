"""
Invoice Commands - Write operations for invoices

Commands encapsulate all data needed to perform a write operation.
They are immutable and represent user intentions.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class BaseCommand(BaseModel):
    """Base command with common fields"""

    model_config = ConfigDict(
        frozen=True,  # Commands are immutable
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    command_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique command ID")
    tenant_id: str = Field(..., description="Tenant identifier")
    user_id: str | None = Field(None, description="User who initiated command")
    idempotency_key: str | None = Field(None, description="Idempotency key for safe retries")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Command timestamp"
    )


class CreateInvoiceCommand(BaseCommand):
    """
    Command to create a new invoice.

    This command encapsulates all data needed to create an invoice,
    including customer info, line items, and billing details.
    """

    customer_id: str = Field(..., description="Customer identifier")
    billing_email: str = Field(..., description="Billing email address")
    billing_address: dict[str, str] = Field(..., description="Billing address")
    line_items: list[dict[str, Any]] = Field(..., min_length=1, description="Invoice line items")
    currency: str = Field(default="USD", description="Invoice currency")
    due_days: int | None = Field(None, ge=1, le=365, description="Days until due")
    due_date: datetime | None = Field(None, description="Explicit due date")
    notes: str | None = Field(None, max_length=1000, description="Customer-facing notes")
    internal_notes: str | None = Field(None, max_length=1000, description="Internal notes")
    subscription_id: str | None = Field(None, description="Associated subscription")
    extra_data: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    auto_finalize: bool = Field(default=False, description="Auto-finalize after creation")


class UpdateInvoiceCommand(BaseCommand):
    """
    Command to update a draft invoice.

    Only draft invoices can be updated. Finalized invoices are immutable.
    """

    invoice_id: str = Field(..., description="Invoice to update")
    billing_email: str | None = Field(None, description="New billing email")
    billing_address: dict[str, str] | None = Field(None, description="New billing address")
    line_items: list[dict[str, Any]] | None = Field(None, description="Updated line items")
    due_date: datetime | None = Field(None, description="New due date")
    notes: str | None = Field(None, description="Updated notes")
    internal_notes: str | None = Field(None, description="Updated internal notes")
    extra_data: dict[str, Any] | None = Field(None, description="Updated metadata")


class VoidInvoiceCommand(BaseCommand):
    """
    Command to void an invoice.

    Voiding an invoice cancels it and prevents any further payments.
    """

    invoice_id: str = Field(..., description="Invoice to void")
    void_reason: str = Field(..., min_length=10, max_length=500, description="Reason for voiding")


class FinalizeInvoiceCommand(BaseCommand):
    """
    Command to finalize a draft invoice.

    Finalizing makes the invoice immutable and ready for payment.
    """

    invoice_id: str = Field(..., description="Invoice to finalize")
    send_email: bool = Field(default=True, description="Send invoice email after finalizing")


class SendInvoiceCommand(BaseCommand):
    """
    Command to send invoice email to customer.

    Can resend invoices or send for the first time.
    """

    invoice_id: str = Field(..., description="Invoice to send")
    recipient_email: str | None = Field(None, description="Override recipient email")
    include_pdf: bool = Field(default=True, description="Include PDF attachment")
    custom_message: str | None = Field(None, max_length=500, description="Custom email message")


class ApplyPaymentToInvoiceCommand(BaseCommand):
    """
    Command to apply a payment to an invoice.

    This updates the invoice balance and status based on payment amount.
    """

    invoice_id: str = Field(..., description="Invoice to apply payment to")
    payment_id: str = Field(..., description="Payment to apply")
    amount: int = Field(..., gt=0, description="Payment amount in minor units (cents)")
    payment_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Payment date"
    )


class AddLineItemCommand(BaseCommand):
    """Command to add line item to draft invoice"""

    invoice_id: str = Field(..., description="Invoice to add line item to")
    description: str = Field(..., min_length=1, max_length=500)
    quantity: int = Field(..., ge=1)
    unit_price: int = Field(..., ge=0, description="Price in minor units")
    tax_rate: float = Field(default=0.0, ge=0, le=100)
    product_id: str | None = None


class RemoveLineItemCommand(BaseCommand):
    """Command to remove line item from draft invoice"""

    invoice_id: str = Field(..., description="Invoice to remove line item from")
    line_item_id: str = Field(..., description="Line item to remove")


class ApplyDiscountCommand(BaseCommand):
    """Command to apply discount to invoice"""

    invoice_id: str = Field(..., description="Invoice to apply discount to")
    discount_type: str = Field(..., description="'percentage' or 'fixed'")
    discount_value: float = Field(..., gt=0, description="Discount percentage or amount")
    reason: str | None = Field(None, description="Reason for discount")


class MarkInvoiceAsPaidCommand(BaseCommand):
    """
    Command to manually mark invoice as paid.

    Used for offline payments or when payment processed externally.
    """

    invoice_id: str = Field(..., description="Invoice to mark as paid")
    payment_method: str = Field(..., description="Payment method used")
    payment_reference: str | None = Field(None, description="External payment reference")
    paid_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Payment date"
    )
    notes: str | None = Field(None, description="Payment notes")
