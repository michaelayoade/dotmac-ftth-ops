"""
Billing module Pydantic models with tenant support
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from pydantic import ConfigDict, Field, field_validator

from dotmac.platform.core.models import BaseModel

from .enums import (
    BankAccountType,
    CreditApplicationType,
    CreditNoteStatus,
    CreditReason,
    CreditType,
    PaymentMethodStatus,
    PaymentMethodType,
    PaymentStatus,
    ServiceStatus,
    ServiceType,
    TransactionType,
)


class BillingBaseModel(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """Base model for all billing entities with tenant support"""

    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        str_strip_whitespace=True,
        extra="forbid",
        use_enum_values=True,
    )

    tenant_id: str = Field(..., description="Tenant identifier for multi-tenant isolation")


# ============================================================================
# Invoice Models
# ============================================================================


class InvoiceLineItem(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """Invoice line item"""

    model_config = ConfigDict()

    line_item_id: str | None = Field(None, description="Line item identifier")
    description: str = Field(default="", min_length=0, max_length=500)
    quantity: int = Field(default=1, ge=0)
    unit_price: int = Field(default=0, description="Unit price in minor currency units")
    total_price: int = Field(default=0, description="Total price (quantity * unit_price)")

    # Optional references
    product_id: str | None = Field(None, description="Reference to product/service")
    subscription_id: str | None = Field(None, description="Reference to subscription")

    # Tax
    tax_rate: float = Field(0.0, ge=0, le=100)
    tax_amount: int = Field(0, ge=0)

    # Discount
    discount_percentage: float = Field(0.0, ge=0, le=100)
    discount_amount: int = Field(0, ge=0)

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})

    @field_validator("tax_amount", "discount_amount", mode="before")
    @classmethod
    def to_minor_units(cls, value: Any) -> Any:
        """Convert Decimal/float monetary values to integer minor units (cents)."""
        from decimal import ROUND_HALF_UP, Decimal

        if isinstance(value, Decimal):
            return int((value * 100).to_integral_value(rounding=ROUND_HALF_UP))
        if isinstance(value, float):
            return int(Decimal(str(value)).scaleb(2).to_integral_value(rounding=ROUND_HALF_UP))
        return int(value)

    @field_validator("total_price")
    @classmethod
    def validate_total_price(cls, v: int, info: Any) -> int:
        if "quantity" in info.data and "unit_price" in info.data:
            expected = info.data["quantity"] * info.data["unit_price"]
            if v != expected:
                raise ValueError(f"Total price must equal quantity * unit_price ({expected})")
        return v


class Invoice(BillingBaseModel):
    """Core invoice model with idempotency support"""

    model_config = ConfigDict()

    invoice_id: str | None = Field(None, description="Invoice identifier")
    invoice_number: str | None = Field(None, description="Human-readable invoice number")

    # Idempotency
    idempotency_key: str | None = None
    created_by: str | None = Field(None, description="User/system that created invoice")

    # Customer
    customer_id: str | None = Field(None, description="Customer identifier")
    billing_email: str | None = Field(None, description="Billing email address")
    billing_address: dict[str, str] = Field(default_factory=dict, description="Billing address")

    # Invoice details
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime | None = Field(None, description="Invoice due date")
    currency: str = Field("USD", min_length=3, max_length=3)

    # Amounts in minor units (cents)
    subtotal: int = Field(default=0, ge=0)
    tax_amount: int = Field(0, ge=0)
    discount_amount: int = Field(0, ge=0)
    total_amount: int = Field(default=0, ge=0)

    # Credits
    total_credits_applied: int | None = Field(None, description="Total credits applied")
    remaining_balance: int = Field(default=0, ge=0)
    credit_applications: list[str] | None = Field(None, description="Credit applications")

    # Status
    status: str = Field("draft", description="Invoice status")
    payment_status: str = Field("pending", description="Payment status")

    # Line items
    line_items: list[InvoiceLineItem] = Field(default_factory=lambda: [])

    # References
    subscription_id: str | None = None
    proforma_invoice_id: str | None = None

    # Metadata
    notes: str | None = Field(None, max_length=2000)
    internal_notes: str | None = Field(None, max_length=2000)
    extra_data: dict[str, Any] = Field(default_factory=lambda: {})

    # Timestamps
    created_at: datetime | None = Field(None, description="Creation timestamp")
    updated_at: datetime | None = Field(None, description="Last update timestamp")
    paid_at: datetime | None = None
    voided_at: datetime | None = None

    @property
    def net_amount_due(self) -> int:
        """Calculate net amount due after payments and credits"""
        credits = self.total_credits_applied if self.total_credits_applied is not None else 0
        return max(0, self.total_amount - credits)


# ============================================================================
# Payment Models
# ============================================================================


class Payment(BillingBaseModel):
    """Payment record with idempotency"""

    model_config = ConfigDict()

    payment_id: str = Field(default_factory=lambda: str(uuid4()))

    # Idempotency
    idempotency_key: str | None = None

    # Payment details
    amount: int = Field(..., description="Amount in minor currency units")
    currency: str = Field("USD", min_length=3, max_length=3)
    customer_id: str

    # Status
    status: PaymentStatus = Field(PaymentStatus.PENDING)

    # Payment method
    payment_method_type: PaymentMethodType
    payment_method_details: dict[str, Any] = Field(default_factory=lambda: {})

    # Provider info
    provider: str = Field(..., description="Payment provider (stripe, paypal, etc.)")
    provider_payment_id: str | None = None
    provider_fee: int | None = Field(None, ge=0)
    provider_payment_data: dict[str, Any] = Field(default_factory=lambda: {})

    # Related entities
    invoice_ids: list[str] = Field(default_factory=lambda: [])

    # Failure handling
    failure_reason: str | None = Field(None, max_length=500)
    retry_count: int = Field(0, ge=0)
    next_retry_at: datetime | None = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: datetime | None = None
    refunded_at: datetime | None = None

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})
    refund_amount: Decimal | None = Field(None)


class PaymentMethod(BillingBaseModel):
    """Customer payment method"""

    model_config = ConfigDict()

    payment_method_id: str = Field(default_factory=lambda: str(uuid4()))
    customer_id: str

    # Payment method details
    type: PaymentMethodType
    status: PaymentMethodStatus = Field(PaymentMethodStatus.ACTIVE)

    # Provider info
    provider: str
    provider_payment_method_id: str

    # Display info (no sensitive data)
    display_name: str = Field(..., max_length=100)
    last_four: str | None = Field(None, min_length=4, max_length=4)
    brand: str | None = Field(None, max_length=50)
    expiry_month: int | None = Field(None, ge=1, le=12)
    expiry_year: int | None = Field(None, ge=2024, le=2099)

    # Bank account specific
    bank_name: str | None = Field(None, max_length=100)
    account_type: BankAccountType | None = None
    routing_number_last_four: str | None = Field(None, min_length=4, max_length=4)

    # Settings
    is_default: bool = Field(False)
    auto_pay_enabled: bool = Field(False)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    verified_at: datetime | None = None

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


# ============================================================================
# Transaction Models
# ============================================================================


class Transaction(BillingBaseModel):
    """Financial transaction ledger entry"""

    model_config = ConfigDict()

    transaction_id: str = Field(default_factory=lambda: str(uuid4()))

    # Transaction details
    amount: int = Field(..., description="Amount in minor currency units")
    currency: str = Field("USD", min_length=3, max_length=3)
    transaction_type: TransactionType
    description: str = Field(..., max_length=500)

    # References
    customer_id: str
    invoice_id: str | None = None
    payment_id: str | None = None
    credit_note_id: str | None = None

    # Timestamp
    transaction_date: datetime = Field(default_factory=datetime.utcnow)

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


# ============================================================================
# Credit Note Models
# ============================================================================


class CreditNoteLineItem(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """Credit note line item"""

    model_config = ConfigDict()

    line_item_id: str = Field(default_factory=lambda: str(uuid4()))
    description: str = Field(..., min_length=1, max_length=500)
    quantity: int = Field(1, ge=1)
    unit_price: int = Field(..., description="Unit price (negative for credit)")
    total_price: int = Field(..., description="Total price (quantity * unit_price)")

    # References to original invoice line item
    original_invoice_line_item_id: str | None = None

    # Tax
    tax_rate: float = Field(0.0, ge=0, le=100)
    tax_amount: int = Field(0)

    # Product reference
    product_id: str | None = None

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


class CreditNote(BillingBaseModel):
    """Credit note for refunds, adjustments, and corrections"""

    model_config = ConfigDict()

    credit_note_id: str = Field(default_factory=lambda: str(uuid4()))
    credit_note_number: str | None = Field(None, description="Human-readable credit note number")

    # Idempotency
    idempotency_key: str | None = None
    created_by: str

    # Customer and reference
    customer_id: str
    invoice_id: str | None = Field(None, description="Original invoice if applicable")

    # Credit note details
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    currency: str = Field("USD", min_length=3, max_length=3)

    # Amounts in minor units (cents)
    subtotal: int
    tax_amount: int = Field(0)
    total_amount: int

    # Credit note type and reason
    credit_type: CreditType
    reason: CreditReason
    reason_description: str | None = Field(None, max_length=500)

    # Status
    status: CreditNoteStatus = Field(CreditNoteStatus.DRAFT)

    # Line items
    line_items: list[CreditNoteLineItem] = Field(min_length=1)

    # Application
    auto_apply_to_invoice: bool = Field(True)
    remaining_credit_amount: int = Field(0, ge=0)

    # Metadata
    notes: str | None = Field(None, max_length=2000)
    internal_notes: str | None = Field(None, max_length=2000)
    extra_data: dict[str, Any] = Field(default_factory=lambda: {})

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    voided_at: datetime | None = None


class CreditApplication(BillingBaseModel):
    """Credit note application to invoices or customer account"""

    model_config = ConfigDict()

    application_id: str = Field(default_factory=lambda: str(uuid4()))
    credit_note_id: str

    # Application target
    applied_to_type: CreditApplicationType
    applied_to_id: str = Field(..., description="Invoice ID or customer account ID")

    # Application details
    applied_amount: int = Field(..., gt=0, description="Amount applied in minor currency units")
    application_date: datetime = Field(default_factory=datetime.utcnow)

    # Reference
    applied_by: str
    notes: str | None = Field(None, max_length=500)

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


class CustomerCredit(BillingBaseModel):
    """Customer account credit balance"""

    model_config = ConfigDict()

    customer_id: str

    # Credit balance
    total_credit_amount: int = Field(0, ge=0, description="Available credit balance")
    currency: str = Field("USD", min_length=3, max_length=3)

    # Credit sources
    credit_notes: list[str] = Field(default_factory=list, description="Credit note IDs")

    # Auto-apply settings
    auto_apply_to_new_invoices: bool = Field(True)

    # Timestamps
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


# ============================================================================
# Customer Models
# ============================================================================


class Customer(BillingBaseModel):
    """Customer billing information"""

    model_config = ConfigDict()

    customer_id: str = Field(description="Unique customer identifier")
    email: str = Field(description="Customer email address")

    # Billing information
    billing_name: str | None = Field(None, description="Billing contact name")
    billing_address: dict[str, Any] = Field(default_factory=dict, description="Billing address")

    # Payment settings
    currency: str = Field(default="USD", min_length=3, max_length=3, description="Default currency")
    payment_terms: int = Field(default=30, description="Payment terms in days")

    # Status
    is_active: bool = Field(default=True, description="Customer account status")

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


# ============================================================================
# Subscription Models
# ============================================================================


class Subscription(BillingBaseModel):
    """Customer subscription"""

    model_config = ConfigDict()

    subscription_id: str = Field(description="Unique subscription identifier")
    customer_id: str = Field(description="Customer identifier")

    # Plan information
    plan_id: str = Field(description="Subscription plan ID")
    status: str = Field(description="Subscription status")

    # Billing cycle
    billing_cycle: str = Field(default="monthly", description="Billing frequency")
    next_billing_date: datetime | None = Field(None, description="Next billing date")

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


# ============================================================================
# Service Models
# ============================================================================


class Service(BillingBaseModel):
    """Service model for tracking subscriber services"""

    model_config = ConfigDict()

    service_id: str = Field(
        default_factory=lambda: str(uuid4()), description="Unique service identifier"
    )

    # References
    customer_id: str = Field(..., description="Customer identifier")
    subscriber_id: str | None = Field(None, description="Subscriber identifier")
    subscription_id: str | None = Field(None, description="Subscription identifier")
    plan_id: str | None = Field(None, description="Service plan identifier")

    # Service details
    service_type: ServiceType = Field(
        default=ServiceType.BROADBAND, description="Service type category"
    )
    service_name: str = Field(..., min_length=1, max_length=255, description="Service name")
    service_description: str | None = Field(None, description="Service description")

    # Status
    status: ServiceStatus = Field(default=ServiceStatus.PENDING, description="Service status")

    # Lifecycle timestamps
    activated_at: datetime | None = Field(None, description="Service activation timestamp")
    suspended_at: datetime | None = Field(None, description="Service suspension timestamp")
    terminated_at: datetime | None = Field(None, description="Service termination timestamp")

    # Suspension details
    suspension_reason: str | None = Field(None, description="Reason for suspension")
    suspend_until: datetime | None = Field(None, description="Auto-resume date for suspension")

    # Termination details
    termination_reason: str | None = Field(None, description="Reason for termination")

    # Service configuration
    bandwidth_mbps: int | None = Field(None, ge=0, description="Bandwidth allocation in Mbps")
    service_metadata: dict[str, Any] = Field(
        default_factory=dict, description="Service-specific metadata"
    )

    # Pricing
    monthly_price: int | None = Field(
        None, ge=0, description="Monthly price in minor currency units"
    )
    currency: str = Field(default="USD", min_length=3, max_length=3, description="Currency code")

    # Notes
    notes: str | None = Field(None, description="Customer-visible notes")
    internal_notes: str | None = Field(None, description="Internal notes")

    # Timestamps (inherited from BillingBaseModel via BaseModel)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Product Models
# ============================================================================


class Product(BillingBaseModel):
    """Product for billing"""

    model_config = ConfigDict()

    product_id: str = Field(description="Unique product identifier")
    name: str = Field(description="Product name")
    description: str | None = Field(None, description="Product description")

    # Pricing
    unit_price: int = Field(description="Price in cents")
    currency: str = Field(default="USD", description="Currency code")

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


class Price(BillingBaseModel):
    """Price information"""

    model_config = ConfigDict()

    price_id: str = Field(description="Unique price identifier")
    product_id: str = Field(description="Associated product ID")

    # Pricing details
    unit_amount: int = Field(description="Amount in cents")
    currency: str = Field(default="USD", description="Currency code")

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


# ============================================================================
# Invoice Item Models
# ============================================================================


class InvoiceItem(BillingBaseModel):
    """Invoice line item"""

    model_config = ConfigDict()

    item_id: str = Field(description="Unique item identifier")
    invoice_id: str = Field(description="Associated invoice ID")

    # Product information
    product_id: str | None = Field(None, description="Product ID if applicable")
    description: str = Field(description="Item description")

    # Pricing
    quantity: int = Field(default=1, description="Quantity")
    unit_price: int = Field(description="Unit price in cents")
    total_amount: int = Field(description="Total amount in cents")
    currency: str = Field(default="USD", description="Currency code")

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})
