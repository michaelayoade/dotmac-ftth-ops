"""
Payment methods models for billing system.

Defines payment methods for tenants to securely store and manage
cards, bank accounts, and other payment sources.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import Field, field_validator

from dotmac.platform.billing.models import BillingBaseModel
from dotmac.platform.core.pydantic import AppBaseModel


class PaymentMethodType(str, Enum):
    """Type of payment method."""

    CARD = "card"  # Credit/debit card
    BANK_ACCOUNT = "bank_account"  # ACH/bank account
    WALLET = "wallet"  # Digital wallet (Apple Pay, Google Pay, etc.)
    WIRE_TRANSFER = "wire_transfer"  # Wire transfer
    CHECK = "check"  # Check payment


class PaymentMethodStatus(str, Enum):
    """Payment method status."""

    ACTIVE = "active"  # Active and usable
    PENDING_VERIFICATION = "pending_verification"  # Awaiting verification
    VERIFICATION_FAILED = "verification_failed"  # Verification failed
    EXPIRED = "expired"  # Expired (for cards)
    INACTIVE = "inactive"  # Manually deactivated


class CardBrand(str, Enum):
    """Credit card brand."""

    VISA = "visa"
    MASTERCARD = "mastercard"
    AMEX = "amex"
    DISCOVER = "discover"
    DINERS = "diners"
    JCB = "jcb"
    UNIONPAY = "unionpay"
    UNKNOWN = "unknown"


class PaymentMethod(BillingBaseModel):  # type: ignore[misc]
    """Payment method for tenant billing."""

    payment_method_id: str = Field(description="Unique payment method identifier")
    tenant_id: str = Field(description="Tenant who owns this payment method")

    # Basic information
    method_type: PaymentMethodType = Field(description="Type of payment method")
    status: PaymentMethodStatus = Field(
        default=PaymentMethodStatus.ACTIVE, description="Payment method status"
    )

    # Default payment method flag
    is_default: bool = Field(default=False, description="Is this the default payment method")

    # Card-specific fields
    card_brand: CardBrand | None = Field(None, description="Card brand (for card payments)")
    card_last4: str | None = Field(None, description="Last 4 digits of card", max_length=4)
    card_exp_month: int | None = Field(
        None, description="Card expiration month (1-12)", ge=1, le=12
    )
    card_exp_year: int | None = Field(None, description="Card expiration year (e.g., 2025)")
    card_fingerprint: str | None = Field(
        None, description="Card fingerprint for duplicate detection"
    )

    # Bank account-specific fields
    bank_name: str | None = Field(None, description="Bank name", max_length=255)
    bank_account_last4: str | None = Field(
        None, description="Last 4 digits of account number", max_length=4
    )
    bank_routing_number: str | None = Field(None, description="Bank routing number", max_length=20)
    bank_account_type: str | None = Field(
        None, description="Account type (checking/savings)", max_length=50
    )

    # Wallet-specific fields
    wallet_type: str | None = Field(
        None, description="Wallet provider (apple_pay, google_pay, etc.)", max_length=50
    )

    # Billing details
    billing_name: str | None = Field(None, description="Name on payment method", max_length=255)
    billing_email: str | None = Field(None, description="Billing email", max_length=255)
    billing_phone: str | None = Field(None, description="Billing phone", max_length=50)

    # Billing address
    billing_address_line1: str | None = Field(None, description="Address line 1", max_length=255)
    billing_address_line2: str | None = Field(None, description="Address line 2", max_length=255)
    billing_city: str | None = Field(None, description="City", max_length=100)
    billing_state: str | None = Field(None, description="State/province", max_length=100)
    billing_postal_code: str | None = Field(None, description="Postal code", max_length=20)
    billing_country: str | None = Field(
        default="US", description="Country code (ISO 3166-1 alpha-2)", max_length=2
    )

    # Gateway integration
    gateway_customer_id: str | None = Field(
        None, description="Payment gateway customer ID (e.g., Stripe customer ID)"
    )
    gateway_payment_method_id: str | None = Field(
        None, description="Payment gateway payment method ID"
    )
    gateway_provider: str | None = Field(
        None, description="Payment gateway provider (stripe, etc.)", max_length=50
    )

    # Verification
    is_verified: bool = Field(default=False, description="Whether payment method is verified")
    verified_at: datetime | None = Field(None, description="When verification completed")

    # Timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="When payment method was added"
    )
    expires_at: datetime | None = Field(None, description="When payment method expires (for cards)")

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Custom metadata")

    @field_validator("card_last4", "bank_account_last4")
    @classmethod
    def validate_last4(cls, v: str | None) -> str | None:
        """Ensure last4 is exactly 4 digits."""
        if v is not None and len(v) != 4:
            raise ValueError("Last 4 must be exactly 4 characters")
        return v


# ============================================================================
# Request/Response Models for API
# ============================================================================


class PaymentMethodResponse(AppBaseModel):
    """Response model for payment method."""

    payment_method_id: str
    tenant_id: str
    method_type: PaymentMethodType
    status: PaymentMethodStatus
    is_default: bool
    auto_pay_enabled: bool

    # Card details (masked)
    card_brand: CardBrand | None
    card_last4: str | None
    card_exp_month: int | None
    card_exp_year: int | None

    # Bank details (masked)
    bank_name: str | None
    bank_account_last4: str | None
    bank_account_type: str | None

    # Wallet details
    wallet_type: str | None

    # Billing details
    billing_name: str | None
    billing_email: str | None
    billing_country: str | None

    is_verified: bool
    created_at: datetime
    expires_at: datetime | None


class AddPaymentMethodRequest(AppBaseModel):
    """Request to add a new payment method."""

    method_type: PaymentMethodType = Field(description="Type of payment method")

    # Card details (for card type)
    card_token: str | None = Field(
        None, description="Payment gateway card token (e.g., Stripe token)"
    )

    # Bank account details (for bank_account type)
    bank_token: str | None = Field(None, description="Payment gateway bank account token")

    # Wallet details (for wallet type)
    wallet_token: str | None = Field(None, description="Payment gateway wallet token")

    # Billing details
    billing_name: str | None = Field(None, description="Name on payment method", max_length=255)
    billing_email: str | None = Field(None, description="Billing email", max_length=255)
    billing_phone: str | None = Field(None, description="Billing phone", max_length=50)

    # Billing address
    billing_address_line1: str | None = Field(None, description="Address line 1", max_length=255)
    billing_address_line2: str | None = Field(None, description="Address line 2", max_length=255)
    billing_city: str | None = Field(None, description="City", max_length=100)
    billing_state: str | None = Field(None, description="State/province", max_length=100)
    billing_postal_code: str | None = Field(None, description="Postal code", max_length=20)
    billing_country: str = Field(
        default="US", description="Country code (ISO 3166-1 alpha-2)", max_length=2
    )

    # Set as default
    set_as_default: bool = Field(default=False, description="Set as default payment method")


class UpdatePaymentMethodRequest(AppBaseModel):
    """Request to update payment method details."""

    # Billing details
    billing_name: str | None = Field(None, description="Name on payment method", max_length=255)
    billing_email: str | None = Field(None, description="Billing email", max_length=255)
    billing_phone: str | None = Field(None, description="Billing phone", max_length=50)

    # Billing address
    billing_address_line1: str | None = Field(None, description="Address line 1", max_length=255)
    billing_address_line2: str | None = Field(None, description="Address line 2", max_length=255)
    billing_city: str | None = Field(None, description="City", max_length=100)
    billing_state: str | None = Field(None, description="State/province", max_length=100)
    billing_postal_code: str | None = Field(None, description="Postal code", max_length=20)
    billing_country: str | None = Field(
        None, description="Country code (ISO 3166-1 alpha-2)", max_length=2
    )


class VerifyPaymentMethodRequest(AppBaseModel):
    """Request to verify a payment method (for bank accounts)."""

    verification_code1: str = Field(description="First microdeposit amount", max_length=10)
    verification_code2: str = Field(description="Second microdeposit amount", max_length=10)
