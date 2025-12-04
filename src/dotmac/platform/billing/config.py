"""
Billing module configuration
"""

import os
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StripeConfig(BaseModel):
    """Stripe configuration"""

    model_config = ConfigDict()

    api_key: str = Field(..., description="Stripe API key")
    webhook_secret: str | None = Field(None, description="Stripe webhook secret")
    publishable_key: str | None = Field(None, description="Stripe publishable key")


class PayPalConfig(BaseModel):
    """PayPal configuration"""

    model_config = ConfigDict()

    client_id: str = Field(..., description="PayPal client ID")
    client_secret: str = Field(..., description="PayPal client secret")
    webhook_id: str | None = Field(None, description="PayPal webhook ID")
    environment: str = Field("sandbox", description="PayPal environment (sandbox/live)")


class TaxConfig(BaseModel):
    """Tax configuration"""

    model_config = ConfigDict()

    provider: str | None = Field(None, description="Tax provider (avalara, taxjar)")
    avalara_api_key: str | None = Field(None, description="Avalara API key")
    avalara_company_code: str | None = Field(None, description="Avalara company code")
    taxjar_api_token: str | None = Field(None, description="TaxJar API token")
    default_tax_rate: float = Field(0.0, description="Default tax rate percentage")


class CurrencyConfig(BaseModel):
    """Currency configuration - Single currency support"""

    model_config = ConfigDict()

    default_currency: str = Field("USD", description="Default currency code")
    currency_symbol: str = Field("$", description="Currency symbol")
    currency_decimal_places: int = Field(2, description="Number of decimal places")
    currency_format: str = Field("{symbol}{amount}", description="Currency display format")
    use_minor_units: bool = Field(True, description="Store amounts in minor units (cents)")


class InvoiceConfig(BaseModel):
    """Invoice configuration"""

    model_config = ConfigDict()

    number_format: str = Field(
        "INV-{tenant_suffix}-{year}-{sequence:06d}",
        description="Invoice number format template",
    )
    due_days_default: int = Field(30, description="Default payment terms in days")
    auto_finalize: bool = Field(False, description="Auto-finalize draft invoices")
    overdue_check_hours: int = Field(24, description="How often to check for overdue invoices")
    send_reminders: bool = Field(True, description="Send payment reminder emails")
    reminder_days: list[int] = Field(
        default=[7, 3, 1],
        description="Days before due date to send reminders",
    )


class PaymentConfig(BaseModel):
    """Payment configuration"""

    model_config = ConfigDict()

    default_provider: str = Field("stripe", description="Default payment provider")
    auto_retry_failed: bool = Field(True, description="Auto-retry failed payments")
    max_retry_attempts: int = Field(3, description="Maximum payment retry attempts")
    retry_backoff_hours: list[int] = Field(
        default=[2, 24, 72],
        description="Hours to wait between retry attempts",
    )
    require_verification: bool = Field(
        True,
        description="Require payment method verification",
    )


class WebhookConfig(BaseModel):
    """Webhook configuration"""

    model_config = ConfigDict()

    endpoint_base_url: str = Field(
        "https://api.example.com",
        description="Base URL for webhook endpoints",
    )
    signing_secret: str = Field(..., description="Secret for webhook signature verification")
    retry_attempts: int = Field(3, description="Webhook delivery retry attempts")
    timeout_seconds: int = Field(30, description="Webhook request timeout")


def _default_tax_config() -> TaxConfig:
    """Create default TaxConfig instance"""
    return TaxConfig(
        provider=None,
        avalara_api_key=None,
        avalara_company_code=None,
        taxjar_api_token=None,
        default_tax_rate=0.0,
    )


def _default_currency_config() -> CurrencyConfig:
    """Create default CurrencyConfig instance"""
    return CurrencyConfig(
        default_currency="USD",
        currency_symbol="$",
        currency_decimal_places=2,
        currency_format="{symbol}{amount}",
        use_minor_units=True,
    )


def _default_invoice_config() -> InvoiceConfig:
    """Create default InvoiceConfig instance"""
    return InvoiceConfig(
        number_format="INV-{tenant_suffix}-{year}-{sequence:06d}",
        due_days_default=30,
        auto_finalize=False,
        overdue_check_hours=24,
        send_reminders=True,
    )


def _default_payment_config() -> PaymentConfig:
    """Create default PaymentConfig instance"""
    return PaymentConfig(
        default_provider="stripe",
        auto_retry_failed=True,
        max_retry_attempts=3,
        require_verification=True,
    )


class BillingConfig(BaseModel):
    """Main billing configuration"""

    model_config = ConfigDict()

    # Provider configurations
    stripe: StripeConfig | None = None
    paypal: PayPalConfig | None = None

    # Module configurations
    tax: TaxConfig = Field(default_factory=_default_tax_config)
    currency: CurrencyConfig = Field(default_factory=_default_currency_config)
    invoice: InvoiceConfig = Field(default_factory=_default_invoice_config)
    payment: PaymentConfig = Field(default_factory=_default_payment_config)
    webhook: WebhookConfig | None = None

    # Feature flags
    enable_subscriptions: bool = Field(True, description="Enable subscription billing")
    enable_credit_notes: bool = Field(True, description="Enable credit note management")
    enable_tax_calculation: bool = Field(True, description="Enable automatic tax calculation")
    enable_multi_currency: bool = Field(True, description="Enable multi-currency support")
    enable_webhooks: bool = Field(False, description="Enable webhook notifications")

    # Audit and compliance
    audit_log_enabled: bool = Field(True, description="Enable billing audit logging")
    pci_compliance_mode: bool = Field(False, description="Enable PCI compliance mode")
    data_retention_days: int = Field(2555, description="Data retention period in days (7 years)")

    @classmethod
    def from_env(cls) -> "BillingConfig":
        """Create configuration from settings (loaded from Vault in production)"""

        config_dict: dict[str, Any] = {}

        # Import settings (secrets loaded from Vault in production)
        from dotmac.platform.settings import settings

        # Stripe configuration (Pure Vault mode - settings.billing loaded from Vault)
        # In production: secrets come from Vault only
        # In dev/test: can use env vars as convenience (settings allows override)
        if settings.billing.stripe_api_key:
            config_dict["stripe"] = StripeConfig(
                api_key=settings.billing.stripe_api_key,
                webhook_secret=settings.billing.stripe_webhook_secret or None,
                publishable_key=settings.billing.stripe_publishable_key or None,
            )

        # PayPal configuration (Pure Vault mode)
        if settings.billing.paypal_client_id:
            config_dict["paypal"] = PayPalConfig(
                client_id=settings.billing.paypal_client_id,
                client_secret=settings.billing.paypal_client_secret or "",
                webhook_id=settings.billing.paypal_webhook_id or None,
                environment=os.getenv("PAYPAL_ENVIRONMENT", "sandbox"),  # Non-sensitive config
            )

        # Tax configuration (Pure Vault mode)
        tax_config = TaxConfig(
            provider=os.getenv("TAX_PROVIDER"),  # Non-sensitive config
            avalara_api_key=settings.billing.avalara_api_key or None,
            avalara_company_code=os.getenv("AVALARA_COMPANY_CODE"),  # Non-sensitive config
            taxjar_api_token=settings.billing.taxjar_api_token or None,
            default_tax_rate=float(os.getenv("DEFAULT_TAX_RATE", "0.0")),
        )
        config_dict["tax"] = tax_config

        # Currency configuration
        currency_config = CurrencyConfig(
            default_currency=os.getenv("DEFAULT_CURRENCY", "USD"),
            currency_symbol=os.getenv("CURRENCY_SYMBOL", "$"),
            currency_decimal_places=int(os.getenv("CURRENCY_DECIMAL_PLACES", "2")),
            currency_format=os.getenv("CURRENCY_FORMAT", "{symbol}{amount}"),
            use_minor_units=os.getenv("USE_MINOR_UNITS", "true").lower() == "true",
        )
        config_dict["currency"] = currency_config

        # Invoice configuration
        invoice_config = InvoiceConfig(
            number_format=os.getenv(
                "INVOICE_NUMBER_FORMAT", "INV-{tenant_suffix}-{year}-{sequence:06d}"
            ),
            due_days_default=int(os.getenv("INVOICE_DUE_DAYS", "30")),
            auto_finalize=os.getenv("INVOICE_AUTO_FINALIZE", "false").lower() == "true",
            overdue_check_hours=int(os.getenv("OVERDUE_CHECK_HOURS", "24")),
            send_reminders=os.getenv("SEND_PAYMENT_REMINDERS", "true").lower() == "true",
        )
        config_dict["invoice"] = invoice_config

        # Payment configuration
        payment_config = PaymentConfig(
            default_provider=os.getenv("DEFAULT_PAYMENT_PROVIDER", "stripe"),
            auto_retry_failed=os.getenv("AUTO_RETRY_FAILED_PAYMENTS", "true").lower() == "true",
            max_retry_attempts=int(os.getenv("MAX_PAYMENT_RETRY_ATTEMPTS", "3")),
            require_verification=os.getenv("REQUIRE_PAYMENT_VERIFICATION", "true").lower()
            == "true",
        )
        config_dict["payment"] = payment_config

        # Webhook configuration (Pure Vault mode - signing_secret from Vault)
        if os.getenv("WEBHOOK_ENDPOINT_URL") and settings.webhooks.signing_secret:
            config_dict["webhook"] = WebhookConfig(
                endpoint_base_url=os.getenv("WEBHOOK_ENDPOINT_URL", ""),  # Non-sensitive config
                signing_secret=settings.webhooks.signing_secret,  # From Vault
                retry_attempts=settings.webhooks.retry_attempts,
                timeout_seconds=settings.webhooks.timeout_seconds,
            )

        # Feature flags
        config_dict["enable_subscriptions"] = (
            os.getenv("ENABLE_SUBSCRIPTIONS", "true").lower() == "true"
        )
        config_dict["enable_credit_notes"] = (
            os.getenv("ENABLE_CREDIT_NOTES", "true").lower() == "true"
        )
        config_dict["enable_tax_calculation"] = (
            os.getenv("ENABLE_TAX_CALCULATION", "true").lower() == "true"
        )
        config_dict["enable_multi_currency"] = (
            os.getenv("ENABLE_MULTI_CURRENCY", "true").lower() == "true"
        )
        config_dict["enable_webhooks"] = os.getenv("ENABLE_WEBHOOKS", "false").lower() == "true"

        # Audit and compliance
        config_dict["audit_log_enabled"] = os.getenv("BILLING_AUDIT_LOG", "true").lower() == "true"
        config_dict["pci_compliance_mode"] = (
            os.getenv("PCI_COMPLIANCE_MODE", "false").lower() == "true"
        )
        config_dict["data_retention_days"] = int(os.getenv("BILLING_DATA_RETENTION_DAYS", "2555"))

        return cls(**config_dict)


# Global configuration instance
_billing_config: BillingConfig | None = None


def get_billing_config() -> BillingConfig:
    """Get the global billing configuration instance"""
    global _billing_config
    if _billing_config is None:
        _billing_config = BillingConfig.from_env()
    return _billing_config


def set_billing_config(config: BillingConfig) -> None:
    """Set the global billing configuration instance"""
    global _billing_config
    _billing_config = config
