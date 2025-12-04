"""Comprehensive tests for billing configuration - Phase 2."""

import os
from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.billing.config import (
    BillingConfig,
    CurrencyConfig,
    InvoiceConfig,
    PaymentConfig,
    PayPalConfig,
    StripeConfig,
    TaxConfig,
    WebhookConfig,
    get_billing_config,
    set_billing_config,
)


@pytest.mark.unit
class TestStripeConfig:
    """Test StripeConfig model."""

    def test_stripe_config_basic(self):
        """Test basic StripeConfig creation."""
        config = StripeConfig(api_key="sk_test_123")

        assert config.api_key == "sk_test_123"
        assert config.webhook_secret is None
        assert config.publishable_key is None

    def test_stripe_config_with_all_fields(self):
        """Test StripeConfig with all fields."""
        config = StripeConfig(
            api_key="sk_test_123",
            webhook_secret="whsec_123",
            publishable_key="pk_test_123",
        )

        assert config.api_key == "sk_test_123"
        assert config.webhook_secret == "whsec_123"
        assert config.publishable_key == "pk_test_123"


@pytest.mark.unit
class TestPayPalConfig:
    """Test PayPalConfig model."""

    def test_paypal_config_basic(self):
        """Test basic PayPalConfig creation."""
        config = PayPalConfig(client_id="client_123", client_secret="secret_456")

        assert config.client_id == "client_123"
        assert config.client_secret == "secret_456"
        assert config.webhook_id is None
        assert config.environment == "sandbox"

    def test_paypal_config_with_webhook_id(self):
        """Test PayPalConfig with webhook_id."""
        config = PayPalConfig(
            client_id="client_123", client_secret="secret_456", webhook_id="wh_789"
        )

        assert config.webhook_id == "wh_789"

    def test_paypal_config_live_environment(self):
        """Test PayPalConfig with live environment."""
        config = PayPalConfig(
            client_id="client_123", client_secret="secret_456", environment="live"
        )

        assert config.environment == "live"


@pytest.mark.unit
class TestTaxConfig:
    """Test TaxConfig model."""

    def test_tax_config_defaults(self):
        """Test TaxConfig with default values."""
        config = TaxConfig()

        assert config.provider is None
        assert config.avalara_api_key is None
        assert config.avalara_company_code is None
        assert config.taxjar_api_token is None
        assert config.default_tax_rate == 0.0

    def test_tax_config_with_avalara(self):
        """Test TaxConfig with Avalara settings."""
        config = TaxConfig(
            provider="avalara",
            avalara_api_key="avalara_key",
            avalara_company_code="COMPANY01",
        )

        assert config.provider == "avalara"
        assert config.avalara_api_key == "avalara_key"
        assert config.avalara_company_code == "COMPANY01"

    def test_tax_config_with_taxjar(self):
        """Test TaxConfig with TaxJar settings."""
        config = TaxConfig(provider="taxjar", taxjar_api_token="taxjar_token")

        assert config.provider == "taxjar"
        assert config.taxjar_api_token == "taxjar_token"

    def test_tax_config_with_default_rate(self):
        """Test TaxConfig with custom default tax rate."""
        config = TaxConfig(default_tax_rate=8.5)

        assert config.default_tax_rate == 8.5


@pytest.mark.unit
class TestCurrencyConfig:
    """Test CurrencyConfig model."""

    def test_currency_config_defaults(self):
        """Test CurrencyConfig with default values."""
        config = CurrencyConfig()

        assert config.default_currency == "USD"
        assert config.currency_symbol == "$"
        assert config.currency_decimal_places == 2
        assert config.currency_format == "{symbol}{amount}"
        assert config.use_minor_units is True

    def test_currency_config_custom_currency(self):
        """Test CurrencyConfig with custom currency."""
        config = CurrencyConfig(
            default_currency="EUR", currency_symbol="€", currency_decimal_places=2
        )

        assert config.default_currency == "EUR"
        assert config.currency_symbol == "€"

    def test_currency_config_no_minor_units(self):
        """Test CurrencyConfig without minor units."""
        config = CurrencyConfig(use_minor_units=False)

        assert config.use_minor_units is False

    def test_currency_config_custom_format(self):
        """Test CurrencyConfig with custom format."""
        config = CurrencyConfig(currency_format="{amount} {symbol}")

        assert config.currency_format == "{amount} {symbol}"


@pytest.mark.unit
class TestInvoiceConfig:
    """Test InvoiceConfig model."""

    def test_invoice_config_defaults(self):
        """Test InvoiceConfig with default values."""
        config = InvoiceConfig()

        assert config.number_format == "INV-{tenant_suffix}-{year}-{sequence:06d}"
        assert config.due_days_default == 30
        assert config.auto_finalize is False
        assert config.overdue_check_hours == 24
        assert config.send_reminders is True
        assert config.reminder_days == [7, 3, 1]

    def test_invoice_config_custom_number_format(self):
        """Test InvoiceConfig with custom number format."""
        config = InvoiceConfig(number_format="INVOICE-{year}-{sequence:04d}")

        assert config.number_format == "INVOICE-{year}-{sequence:04d}"

    def test_invoice_config_custom_due_days(self):
        """Test InvoiceConfig with custom due days."""
        config = InvoiceConfig(due_days_default=14)

        assert config.due_days_default == 14

    def test_invoice_config_auto_finalize(self):
        """Test InvoiceConfig with auto_finalize enabled."""
        config = InvoiceConfig(auto_finalize=True)

        assert config.auto_finalize is True

    def test_invoice_config_custom_reminders(self):
        """Test InvoiceConfig with custom reminder days."""
        config = InvoiceConfig(reminder_days=[10, 5, 2])

        assert config.reminder_days == [10, 5, 2]

    def test_invoice_config_no_reminders(self):
        """Test InvoiceConfig with reminders disabled."""
        config = InvoiceConfig(send_reminders=False)

        assert config.send_reminders is False


@pytest.mark.unit
class TestPaymentConfig:
    """Test PaymentConfig model."""

    def test_payment_config_defaults(self):
        """Test PaymentConfig with default values."""
        config = PaymentConfig()

        assert config.default_provider == "stripe"
        assert config.auto_retry_failed is True
        assert config.max_retry_attempts == 3
        assert config.retry_backoff_hours == [2, 24, 72]
        assert config.require_verification is True

    def test_payment_config_custom_provider(self):
        """Test PaymentConfig with custom provider."""
        config = PaymentConfig(default_provider="paypal")

        assert config.default_provider == "paypal"

    def test_payment_config_no_auto_retry(self):
        """Test PaymentConfig with auto retry disabled."""
        config = PaymentConfig(auto_retry_failed=False)

        assert config.auto_retry_failed is False

    def test_payment_config_custom_retry_attempts(self):
        """Test PaymentConfig with custom retry attempts."""
        config = PaymentConfig(max_retry_attempts=5)

        assert config.max_retry_attempts == 5

    def test_payment_config_custom_backoff(self):
        """Test PaymentConfig with custom retry backoff."""
        config = PaymentConfig(retry_backoff_hours=[1, 6, 12, 24])

        assert config.retry_backoff_hours == [1, 6, 12, 24]

    def test_payment_config_no_verification(self):
        """Test PaymentConfig without payment verification."""
        config = PaymentConfig(require_verification=False)

        assert config.require_verification is False


@pytest.mark.unit
class TestWebhookConfig:
    """Test WebhookConfig model."""

    def test_webhook_config_basic(self):
        """Test basic WebhookConfig creation."""
        config = WebhookConfig(
            endpoint_base_url="https://api.example.com", signing_secret="secret_123"
        )

        assert config.endpoint_base_url == "https://api.example.com"
        assert config.signing_secret == "secret_123"
        assert config.retry_attempts == 3
        assert config.timeout_seconds == 30

    def test_webhook_config_custom_retry(self):
        """Test WebhookConfig with custom retry attempts."""
        config = WebhookConfig(
            endpoint_base_url="https://api.example.com",
            signing_secret="secret_123",
            retry_attempts=5,
        )

        assert config.retry_attempts == 5

    def test_webhook_config_custom_timeout(self):
        """Test WebhookConfig with custom timeout."""
        config = WebhookConfig(
            endpoint_base_url="https://api.example.com",
            signing_secret="secret_123",
            timeout_seconds=60,
        )

        assert config.timeout_seconds == 60


@pytest.mark.unit
class TestBillingConfig:
    """Test BillingConfig model."""

    def test_billing_config_defaults(self):
        """Test BillingConfig with default values."""
        config = BillingConfig()

        assert config.stripe is None
        assert config.paypal is None
        assert isinstance(config.tax, TaxConfig)
        assert isinstance(config.currency, CurrencyConfig)
        assert isinstance(config.invoice, InvoiceConfig)
        assert isinstance(config.payment, PaymentConfig)
        assert config.webhook is None
        assert config.enable_subscriptions is True
        assert config.enable_credit_notes is True
        assert config.enable_tax_calculation is True
        assert config.enable_multi_currency is True
        assert config.enable_webhooks is False
        assert config.audit_log_enabled is True
        assert config.pci_compliance_mode is False
        assert config.data_retention_days == 2555

    def test_billing_config_with_stripe(self):
        """Test BillingConfig with Stripe configuration."""
        stripe_config = StripeConfig(api_key="sk_test_123")
        config = BillingConfig(stripe=stripe_config)

        assert config.stripe is not None
        assert config.stripe.api_key == "sk_test_123"

    def test_billing_config_with_paypal(self):
        """Test BillingConfig with PayPal configuration."""
        paypal_config = PayPalConfig(client_id="client_123", client_secret="secret_456")
        config = BillingConfig(paypal=paypal_config)

        assert config.paypal is not None
        assert config.paypal.client_id == "client_123"

    def test_billing_config_with_webhook(self):
        """Test BillingConfig with webhook configuration."""
        webhook_config = WebhookConfig(
            endpoint_base_url="https://api.example.com", signing_secret="secret_123"
        )
        config = BillingConfig(webhook=webhook_config)

        assert config.webhook is not None
        assert config.webhook.signing_secret == "secret_123"

    def test_billing_config_feature_flags(self):
        """Test BillingConfig with custom feature flags."""
        config = BillingConfig(
            enable_subscriptions=False,
            enable_credit_notes=False,
            enable_webhooks=True,
        )

        assert config.enable_subscriptions is False
        assert config.enable_credit_notes is False
        assert config.enable_webhooks is True

    def test_billing_config_pci_compliance(self):
        """Test BillingConfig with PCI compliance enabled."""
        config = BillingConfig(pci_compliance_mode=True)

        assert config.pci_compliance_mode is True

    def test_billing_config_custom_retention(self):
        """Test BillingConfig with custom data retention."""
        config = BillingConfig(data_retention_days=365)

        assert config.data_retention_days == 365


@pytest.mark.unit
class TestBillingConfigFromEnv:
    """Test BillingConfig.from_env() method."""

    @patch.dict(os.environ, {}, clear=True)
    def test_from_env_minimal(self):
        """Test from_env with no environment variables."""
        config = BillingConfig.from_env()

        assert config.stripe is None
        assert config.paypal is None
        assert config.tax.default_tax_rate == 0.0
        assert config.currency.default_currency == "USD"

    @patch.dict(os.environ, {}, clear=True)
    @patch("dotmac.platform.settings.settings")
    def test_from_env_with_stripe(self, mock_settings):
        """Test from_env with Stripe environment variables."""
        # Mock settings.billing
        mock_billing = MagicMock()
        mock_billing.stripe_api_key = "sk_test_123"
        mock_billing.stripe_webhook_secret = "whsec_456"
        mock_billing.stripe_publishable_key = None
        mock_billing.paypal_client_id = None
        mock_billing.avalara_api_key = None
        mock_billing.taxjar_api_token = None
        mock_settings.billing = mock_billing
        mock_settings.webhooks = MagicMock(signing_secret=None)

        config = BillingConfig.from_env()

        assert config.stripe is not None
        assert config.stripe.api_key == "sk_test_123"
        assert config.stripe.webhook_secret == "whsec_456"

    @patch.dict(os.environ, {"PAYPAL_ENVIRONMENT": "live"}, clear=True)
    @patch("dotmac.platform.settings.settings")
    def test_from_env_with_paypal(self, mock_settings):
        """Test from_env with PayPal environment variables."""
        # Mock settings.billing
        mock_billing = MagicMock()
        mock_billing.stripe_api_key = None
        mock_billing.paypal_client_id = "client_123"
        mock_billing.paypal_client_secret = "secret_456"
        mock_billing.paypal_webhook_id = None
        mock_billing.avalara_api_key = None
        mock_billing.taxjar_api_token = None
        mock_settings.billing = mock_billing
        mock_settings.webhooks = MagicMock(signing_secret=None)

        config = BillingConfig.from_env()

        assert config.paypal is not None
        assert config.paypal.client_id == "client_123"
        assert config.paypal.client_secret == "secret_456"
        assert config.paypal.environment == "live"

    @patch.dict(
        os.environ,
        {
            "TAX_PROVIDER": "avalara",
            "AVALARA_COMPANY_CODE": "COMP01",
            "DEFAULT_TAX_RATE": "8.5",
        },
        clear=True,
    )
    @patch("dotmac.platform.settings.settings")
    def test_from_env_with_tax_config(self, mock_settings):
        """Test from_env with tax configuration."""
        # Mock settings.billing
        mock_billing = MagicMock()
        mock_billing.stripe_api_key = None
        mock_billing.paypal_client_id = None
        mock_billing.avalara_api_key = "avalara_key"
        mock_billing.taxjar_api_token = None
        mock_settings.billing = mock_billing
        mock_settings.webhooks = MagicMock(signing_secret=None)

        config = BillingConfig.from_env()

        assert config.tax.provider == "avalara"
        assert config.tax.avalara_api_key == "avalara_key"
        assert config.tax.avalara_company_code == "COMP01"
        assert config.tax.default_tax_rate == 8.5

    @patch.dict(
        os.environ,
        {
            "DEFAULT_CURRENCY": "EUR",
            "CURRENCY_SYMBOL": "€",
            "CURRENCY_DECIMAL_PLACES": "2",
            "USE_MINOR_UNITS": "false",
        },
        clear=True,
    )
    def test_from_env_with_currency_config(self):
        """Test from_env with currency configuration."""
        config = BillingConfig.from_env()

        assert config.currency.default_currency == "EUR"
        assert config.currency.currency_symbol == "€"
        assert config.currency.use_minor_units is False

    @patch.dict(
        os.environ,
        {
            "INVOICE_NUMBER_FORMAT": "BILL-{year}-{sequence:04d}",
            "INVOICE_DUE_DAYS": "14",
            "INVOICE_AUTO_FINALIZE": "true",
        },
        clear=True,
    )
    def test_from_env_with_invoice_config(self):
        """Test from_env with invoice configuration."""
        config = BillingConfig.from_env()

        assert config.invoice.number_format == "BILL-{year}-{sequence:04d}"
        assert config.invoice.due_days_default == 14
        assert config.invoice.auto_finalize is True

    @patch.dict(
        os.environ,
        {
            "DEFAULT_PAYMENT_PROVIDER": "paypal",
            "AUTO_RETRY_FAILED_PAYMENTS": "false",
            "MAX_PAYMENT_RETRY_ATTEMPTS": "5",
        },
        clear=True,
    )
    def test_from_env_with_payment_config(self):
        """Test from_env with payment configuration."""
        config = BillingConfig.from_env()

        assert config.payment.default_provider == "paypal"
        assert config.payment.auto_retry_failed is False
        assert config.payment.max_retry_attempts == 5

    @patch.dict(
        os.environ,
        {
            "WEBHOOK_ENDPOINT_URL": "https://example.com/webhooks",
        },
        clear=True,
    )
    @patch("dotmac.platform.settings.settings")
    def test_from_env_with_webhook_config(self, mock_settings):
        """Test from_env with webhook configuration."""
        # Mock settings
        mock_billing = MagicMock()
        mock_billing.stripe_api_key = None
        mock_billing.paypal_client_id = None
        mock_billing.avalara_api_key = None
        mock_billing.taxjar_api_token = None
        mock_settings.billing = mock_billing

        # Mock webhook settings
        mock_webhooks = MagicMock()
        mock_webhooks.signing_secret = "secret_789"
        mock_webhooks.retry_attempts = 5
        mock_webhooks.timeout_seconds = 30
        mock_settings.webhooks = mock_webhooks

        config = BillingConfig.from_env()

        assert config.webhook is not None
        assert config.webhook.endpoint_base_url == "https://example.com/webhooks"
        assert config.webhook.signing_secret == "secret_789"
        assert config.webhook.retry_attempts == 5

    @patch.dict(
        os.environ,
        {
            "ENABLE_SUBSCRIPTIONS": "false",
            "ENABLE_CREDIT_NOTES": "false",
            "ENABLE_WEBHOOKS": "true",
        },
        clear=True,
    )
    def test_from_env_with_feature_flags(self):
        """Test from_env with feature flags."""
        config = BillingConfig.from_env()

        assert config.enable_subscriptions is False
        assert config.enable_credit_notes is False
        assert config.enable_webhooks is True

    @patch.dict(
        os.environ,
        {
            "BILLING_AUDIT_LOG": "false",
            "PCI_COMPLIANCE_MODE": "true",
            "BILLING_DATA_RETENTION_DAYS": "365",
        },
        clear=True,
    )
    def test_from_env_with_compliance_settings(self):
        """Test from_env with compliance settings."""
        config = BillingConfig.from_env()

        assert config.audit_log_enabled is False
        assert config.pci_compliance_mode is True
        assert config.data_retention_days == 365


@pytest.mark.unit
class TestGlobalConfigFunctions:
    """Test global configuration functions."""

    def test_get_billing_config_creates_instance(self):
        """Test get_billing_config creates instance on first call."""
        # Reset global config
        import dotmac.platform.billing.config as config_module

        config_module._billing_config = None

        with patch.dict(os.environ, {}, clear=True):
            config = get_billing_config()

            assert config is not None
            assert isinstance(config, BillingConfig)

    def test_get_billing_config_returns_same_instance(self):
        """Test get_billing_config returns same instance."""
        import dotmac.platform.billing.config as config_module

        config_module._billing_config = None

        with patch.dict(os.environ, {}, clear=True):
            config1 = get_billing_config()
            config2 = get_billing_config()

            assert config1 is config2

    def test_set_billing_config(self):
        """Test set_billing_config sets global instance."""
        import dotmac.platform.billing.config as config_module

        config_module._billing_config = None

        custom_config = BillingConfig(enable_subscriptions=False)
        set_billing_config(custom_config)

        retrieved_config = get_billing_config()
        assert retrieved_config is custom_config
        assert retrieved_config.enable_subscriptions is False

    def test_set_billing_config_overrides_existing(self):
        """Test set_billing_config overrides existing config."""
        import dotmac.platform.billing.config as config_module

        config_module._billing_config = None

        # Create initial config
        with patch.dict(os.environ, {}, clear=True):
            initial_config = get_billing_config()
            assert initial_config.enable_subscriptions is True

        # Override with custom config
        custom_config = BillingConfig(enable_subscriptions=False)
        set_billing_config(custom_config)

        retrieved_config = get_billing_config()
        assert retrieved_config is custom_config
        assert retrieved_config.enable_subscriptions is False
