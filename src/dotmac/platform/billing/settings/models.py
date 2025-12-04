"""
Billing settings data models
"""

from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import ConfigDict, Field, field_validator

from dotmac.platform.billing.core.models import BillingBaseModel
from dotmac.platform.core.pydantic import AppBaseModel


class CompanyInfo(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Company information settings"""

    name: str = Field(..., min_length=1, max_length=200)
    legal_name: str | None = Field(None, max_length=200)
    tax_id: str | None = Field(None, max_length=50)
    registration_number: str | None = Field(None, max_length=50)

    # Address
    address_line1: str = Field(..., min_length=1, max_length=100)
    address_line2: str | None = Field(None, max_length=100)
    city: str = Field(..., min_length=1, max_length=50)
    state: str | None = Field(None, max_length=50)
    postal_code: str = Field(..., min_length=1, max_length=20)
    country: str = Field(..., min_length=2, max_length=2)

    # Contact information
    phone: str | None = Field(None, max_length=20)
    email: str | None = Field(None, max_length=100)
    website: str | None = Field(None, max_length=100)

    # Branding
    logo_url: str | None = Field(None, description="URL to company logo")
    brand_color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Acme Corporation",
                "legal_name": "Acme Corporation Ltd.",
                "tax_id": "12-3456789",
                "address_line1": "123 Business St",
                "city": "San Francisco",
                "state": "CA",
                "postal_code": "94105",
                "country": "US",
                "phone": "+1 (555) 123-4567",
                "email": "billing@acme.com",
                "website": "https://acme.com",
            }
        }
    )


class TaxSettings(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Tax calculation settings"""

    # Default tax behavior
    calculate_tax: bool = Field(True, description="Whether to calculate tax automatically")
    tax_inclusive_pricing: bool = Field(False, description="Whether prices include tax")

    # Tax registration
    tax_registrations: list[dict[str, str]] = Field(
        default_factory=list, description="Tax registrations by jurisdiction"
    )

    # Default rates (fallback when no specific rates configured)
    default_tax_rate: float = Field(0.0, ge=0, le=100)

    # Integration settings
    tax_provider: str | None = Field(None, description="External tax service provider")
    tax_provider_config: dict[str, Any] = Field(default_factory=lambda: {})

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "calculate_tax": True,
                "tax_inclusive_pricing": False,
                "default_tax_rate": 8.25,
                "tax_registrations": [
                    {"jurisdiction": "US-CA", "registration_number": "123-456-789"},
                    {"jurisdiction": "US-NY", "registration_number": "987-654-321"},
                ],
            }
        }
    )


class PaymentSettings(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Payment processing settings"""

    # Supported payment methods
    enabled_payment_methods: list[str] = Field(
        default_factory=lambda: ["card", "bank_account"], description="Enabled payment methods"
    )

    # Default currency
    default_currency: str = Field("USD", min_length=3, max_length=3)
    supported_currencies: list[str] = Field(
        default_factory=lambda: ["USD"], description="List of supported currencies"
    )

    # Payment terms
    default_payment_terms: int = Field(30, ge=0, description="Default payment terms in days")
    late_payment_fee: float | None = Field(None, ge=0, description="Late payment fee percentage")

    # Provider settings
    payment_processors: dict[str, dict[str, Any]] = Field(
        default_factory=dict, description="Payment processor configurations"
    )

    # Retry settings
    retry_failed_payments: bool = Field(True)
    max_retry_attempts: int = Field(3, ge=1, le=10)
    retry_interval_hours: int = Field(24, ge=1, le=168)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "enabled_payment_methods": ["card", "bank_account", "digital_wallet"],
                "default_currency": "USD",
                "supported_currencies": ["USD", "EUR", "GBP"],
                "default_payment_terms": 30,
                "late_payment_fee": 1.5,
            }
        }
    )


class InvoiceSettings(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Invoice generation settings"""

    # Numbering
    invoice_number_prefix: str = Field("INV", max_length=10)
    invoice_number_format: str = Field("{prefix}-{tenant_suffix}-{year}-{sequence:06d}")

    # Default terms
    default_due_days: int = Field(30, ge=0, le=365)

    # Content
    include_payment_instructions: bool = Field(True)
    payment_instructions: str | None = Field(None, max_length=500)

    footer_text: str | None = Field(None, max_length=500)
    terms_and_conditions: str | None = Field(None, max_length=2000)

    # Notifications
    send_invoice_emails: bool = Field(True)
    send_payment_reminders: bool = Field(True)
    reminder_schedule_days: list[int] = Field(default_factory=lambda: [7, 3, 1])

    # PDF customization
    logo_on_invoices: bool = Field(True)
    color_scheme: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "invoice_number_prefix": "INV",
                "default_due_days": 30,
                "payment_instructions": "Please pay within 30 days of invoice date.",
                "send_invoice_emails": True,
                "send_payment_reminders": True,
                "reminder_schedule_days": [7, 3, 1],
            }
        }
    )


class NotificationSettings(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Notification settings"""

    # Email settings
    send_invoice_notifications: bool = Field(True)
    send_payment_confirmations: bool = Field(True)
    send_overdue_notices: bool = Field(True)
    send_receipt_emails: bool = Field(True)

    # Webhook settings
    webhook_url: str | None = Field(None, description="Webhook endpoint URL")
    webhook_events: list[str] = Field(
        default_factory=list, description="Events to send webhooks for"
    )
    webhook_secret: str | None = Field(None, description="Webhook signature secret")


def _default_tax_settings() -> TaxSettings:
    return TaxSettings(
        calculate_tax=True, tax_inclusive_pricing=False, default_tax_rate=0.0, tax_provider=None
    )


def _default_payment_settings() -> PaymentSettings:
    return PaymentSettings(
        default_currency="USD",
        default_payment_terms=30,
        late_payment_fee=None,
        retry_failed_payments=True,
        max_retry_attempts=3,
        retry_interval_hours=24,
    )


def _default_invoice_settings() -> InvoiceSettings:
    return InvoiceSettings(
        invoice_number_prefix="INV",
        invoice_number_format="{prefix}-{tenant_suffix}-{year}-{sequence:06d}",
        default_due_days=30,
        include_payment_instructions=True,
        payment_instructions=None,
        footer_text=None,
        terms_and_conditions=None,
        send_invoice_emails=True,
        send_payment_reminders=True,
        logo_on_invoices=True,
        color_scheme=None,
    )


def _default_notification_settings() -> NotificationSettings:
    return NotificationSettings(
        send_invoice_notifications=True,
        send_payment_confirmations=True,
        send_overdue_notices=True,
        send_receipt_emails=True,
        webhook_url=None,
        webhook_secret=None,
    )


class BillingSettings(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Complete billing settings for a tenant"""

    settings_id: str = Field(default_factory=lambda: str(uuid4()))

    # Core settings
    company_info: CompanyInfo
    tax_settings: TaxSettings = Field(default_factory=_default_tax_settings)
    payment_settings: PaymentSettings = Field(default_factory=_default_payment_settings)
    invoice_settings: InvoiceSettings = Field(default_factory=_default_invoice_settings)
    notification_settings: NotificationSettings = Field(
        default_factory=_default_notification_settings
    )

    # Feature flags
    features_enabled: dict[str, bool] = Field(
        default_factory=lambda: {
            "invoicing": True,
            "payments": True,
            "credit_notes": True,
            "receipts": True,
            "tax_calculation": True,
            "webhooks": True,
            "reporting": True,
        }
    )

    # Custom settings
    custom_settings: dict[str, Any] = Field(default_factory=lambda: {})

    # API settings
    api_settings: dict[str, Any] = Field(
        default_factory=lambda: {
            "rate_limits": {"requests_per_minute": 1000},
            "api_version": "v1",
        }
    )

    # Metadata
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("company_info", mode="before")
    @classmethod
    def validate_company_info(cls, v: Any) -> Any:
        if isinstance(v, dict):
            return CompanyInfo(**v)
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "company_info": {
                    "name": "Acme Corporation",
                    "address_line1": "123 Business St",
                    "city": "San Francisco",
                    "state": "CA",
                    "postal_code": "94105",
                    "country": "US",
                },
                "payment_settings": {"default_currency": "USD", "default_payment_terms": 30},
                "invoice_settings": {"default_due_days": 30, "send_invoice_emails": True},
            }
        }
    )
