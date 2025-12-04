"""Comprehensive tests for billing exceptions - Phase 2."""

import pytest

from dotmac.platform.billing.exceptions import (
    BillingConfigurationError,
    BillingError,
    CategoryNotFoundError,
    DuplicateProductError,
    InvalidPricingRuleError,
    InvoiceError,
    InvoiceNotFoundError,
    PaymentError,
    PaymentMethodError,
    PlanNotFoundError,
    PriceCalculationError,
    PricingError,
    ProductError,
    ProductNotFoundError,
    SubscriptionError,
    SubscriptionNotFoundError,
    SubscriptionStateError,
    UsageLimitExceededError,
    UsageTrackingError,
    WebhookError,
)


@pytest.mark.unit
class TestBillingError:
    """Test base BillingError class."""

    def test_billing_error_basic(self):
        """Test basic BillingError creation."""
        error = BillingError("Test error message")

        assert error.message == "Test error message"
        assert error.error_code == "BILLING_ERROR"
        assert error.status_code == 400
        assert error.context == {}
        assert error.recovery_hint is None
        assert str(error) == "Test error message"

    def test_billing_error_with_custom_code(self):
        """Test BillingError with custom error code."""
        error = BillingError("Test error", error_code="CUSTOM_ERROR")

        assert error.error_code == "CUSTOM_ERROR"

    def test_billing_error_with_status_code(self):
        """Test BillingError with custom status code."""
        error = BillingError("Test error", status_code=500)

        assert error.status_code == 500

    def test_billing_error_with_context(self):
        """Test BillingError with context data."""
        context = {"user_id": "123", "action": "payment"}
        error = BillingError("Test error", context=context)

        assert error.context == context

    def test_billing_error_with_recovery_hint(self):
        """Test BillingError with recovery hint."""
        hint = "Please try again later"
        error = BillingError("Test error", recovery_hint=hint)

        assert error.recovery_hint == hint

    def test_billing_error_to_dict(self):
        """Test BillingError to_dict() method."""
        error = BillingError(
            "Test error",
            error_code="TEST_ERROR",
            status_code=403,
            context={"key": "value"},
            recovery_hint="Try again",
        )

        error_dict = error.to_dict()

        assert error_dict["error_code"] == "TEST_ERROR"
        assert error_dict["message"] == "Test error"
        assert error_dict["status_code"] == 403
        assert error_dict["context"] == {"key": "value"}
        assert error_dict["recovery_hint"] == "Try again"


@pytest.mark.unit
class TestProductErrors:
    """Test product-related exception classes."""

    def test_product_error_basic(self):
        """Test basic ProductError."""
        error = ProductError("Product error")

        assert error.message == "Product error"
        assert error.error_code == "PRODUCT_ERROR"
        assert error.status_code == 400

    def test_product_error_with_context(self):
        """Test ProductError with context."""
        error = ProductError("Product error", context={"product_id": "123"})

        assert error.context == {"product_id": "123"}

    def test_product_not_found_with_product_id(self):
        """Test ProductNotFoundError with product_id."""
        error = ProductNotFoundError("Product not found", product_id="prod-123")

        assert error.error_code == "PRODUCT_NOT_FOUND"
        assert error.status_code == 404
        assert error.context["product_id"] == "prod-123"
        assert error.recovery_hint is not None
        assert len(error.recovery_hint) > 0

    def test_product_not_found_with_sku(self):
        """Test ProductNotFoundError with SKU."""
        error = ProductNotFoundError("Product not found", sku="SKU-ABC")

        assert error.context["sku"] == "SKU-ABC"
        assert "sku" in error.recovery_hint.lower()

    def test_product_not_found_with_both(self):
        """Test ProductNotFoundError with both product_id and sku."""
        error = ProductNotFoundError("Product not found", product_id="prod-123", sku="SKU-ABC")

        assert error.context["product_id"] == "prod-123"
        assert error.context["sku"] == "SKU-ABC"

    def test_product_not_found_without_context(self):
        """Test ProductNotFoundError without context."""
        error = ProductNotFoundError("Product not found")

        assert error.context == {}

    def test_category_not_found_with_id(self):
        """Test CategoryNotFoundError with category_id."""
        error = CategoryNotFoundError("Category not found", category_id="cat-123")

        assert error.error_code == "CATEGORY_NOT_FOUND"
        assert error.status_code == 404
        assert error.context["category_id"] == "cat-123"

    def test_category_not_found_with_name(self):
        """Test CategoryNotFoundError with category_name."""
        error = CategoryNotFoundError("Category not found", category_name="Electronics")

        assert error.context["category_name"] == "Electronics"

    def test_category_not_found_without_context(self):
        """Test CategoryNotFoundError without context."""
        error = CategoryNotFoundError("Category not found")

        assert error.context == {}

    def test_duplicate_product_error(self):
        """Test DuplicateProductError."""
        error = DuplicateProductError("Product exists", sku="SKU-123")

        assert error.error_code == "DUPLICATE_PRODUCT"
        assert error.status_code == 409
        assert error.context["sku"] == "SKU-123"
        assert "unique" in error.recovery_hint.lower()


@pytest.mark.unit
class TestSubscriptionErrors:
    """Test subscription-related exception classes."""

    def test_subscription_error_basic(self):
        """Test basic SubscriptionError."""
        error = SubscriptionError("Subscription error")

        assert error.error_code == "SUBSCRIPTION_ERROR"
        assert error.status_code == 400

    def test_subscription_not_found_with_subscription_id(self):
        """Test SubscriptionNotFoundError with subscription_id."""
        error = SubscriptionNotFoundError("Not found", subscription_id="sub-123")

        assert error.error_code == "SUBSCRIPTION_NOT_FOUND"
        assert error.status_code == 404
        assert error.context["subscription_id"] == "sub-123"

    def test_subscription_not_found_with_customer_id(self):
        """Test SubscriptionNotFoundError with customer_id."""
        error = SubscriptionNotFoundError("Not found", customer_id="cust-456")

        assert error.context["customer_id"] == "cust-456"

    def test_subscription_not_found_without_context(self):
        """Test SubscriptionNotFoundError without context."""
        error = SubscriptionNotFoundError("Not found")

        assert error.context == {}

    def test_subscription_state_error(self):
        """Test SubscriptionStateError."""
        error = SubscriptionStateError(
            "Invalid state transition", current_state="active", requested_state="trial"
        )

        assert error.error_code == "INVALID_SUBSCRIPTION_STATE"
        assert error.context["current_state"] == "active"
        assert error.context["requested_state"] == "trial"
        assert "active" in error.recovery_hint
        assert "trial" in error.recovery_hint

    def test_plan_not_found_with_plan_id(self):
        """Test PlanNotFoundError with plan_id."""
        error = PlanNotFoundError("Plan not found", plan_id="plan-premium")

        assert error.error_code == "PLAN_NOT_FOUND"
        assert error.status_code == 404
        assert error.context["plan_id"] == "plan-premium"

    def test_plan_not_found_without_context(self):
        """Test PlanNotFoundError without context."""
        error = PlanNotFoundError("Plan not found")

        assert error.context == {}


@pytest.mark.unit
class TestPricingErrors:
    """Test pricing-related exception classes."""

    def test_pricing_error_basic(self):
        """Test basic PricingError."""
        error = PricingError("Pricing error")

        assert error.error_code == "PRICING_ERROR"
        assert error.status_code == 400

    def test_invalid_pricing_rule_with_rule_id(self):
        """Test InvalidPricingRuleError with rule_id."""
        error = InvalidPricingRuleError("Invalid rule", rule_id="rule-123")

        assert error.error_code == "INVALID_PRICING_RULE"
        assert error.context["rule_id"] == "rule-123"

    def test_invalid_pricing_rule_with_validation_errors(self):
        """Test InvalidPricingRuleError with validation errors."""
        validation_errors = {"discount": "Must be between 0 and 100"}
        error = InvalidPricingRuleError("Invalid rule", validation_errors=validation_errors)

        assert error.context["validation_errors"] == validation_errors

    def test_invalid_pricing_rule_without_context(self):
        """Test InvalidPricingRuleError without context."""
        error = InvalidPricingRuleError("Invalid rule")

        assert error.context == {}

    def test_price_calculation_error_with_product_id(self):
        """Test PriceCalculationError with product_id."""
        error = PriceCalculationError("Calculation failed", product_id="prod-123")

        assert error.error_code == "PRICE_CALCULATION_ERROR"
        assert error.context["product_id"] == "prod-123"

    def test_price_calculation_error_with_quantity(self):
        """Test PriceCalculationError with quantity."""
        error = PriceCalculationError("Calculation failed", quantity=5)

        assert error.context["quantity"] == 5

    def test_price_calculation_error_without_context(self):
        """Test PriceCalculationError without context."""
        error = PriceCalculationError("Calculation failed")

        assert error.context == {}


@pytest.mark.unit
class TestUsageTrackingErrors:
    """Test usage tracking exception classes."""

    def test_usage_tracking_error_basic(self):
        """Test basic UsageTrackingError."""
        error = UsageTrackingError("Usage error")

        assert error.error_code == "USAGE_TRACKING_ERROR"
        assert error.status_code == 400

    def test_usage_limit_exceeded(self):
        """Test UsageLimitExceededError."""
        error = UsageLimitExceededError(
            "Limit exceeded", current_usage=150, limit=100, metric_name="api_calls"
        )

        assert error.error_code == "USAGE_LIMIT_EXCEEDED"
        assert error.context["current_usage"] == 150
        assert error.context["limit"] == 100
        assert error.context["metric_name"] == "api_calls"
        assert "upgrade" in error.recovery_hint.lower()


@pytest.mark.unit
class TestConfigurationErrors:
    """Test billing configuration exception classes."""

    def test_billing_configuration_error_basic(self):
        """Test basic BillingConfigurationError."""
        error = BillingConfigurationError("Config error")

        assert error.error_code == "BILLING_CONFIG_ERROR"
        assert error.status_code == 500

    def test_billing_configuration_error_with_config_key(self):
        """Test BillingConfigurationError with config_key."""
        error = BillingConfigurationError("Config error", config_key="stripe_api_key")

        assert error.context["config_key"] == "stripe_api_key"

    def test_billing_configuration_error_with_recovery_hint(self):
        """Test BillingConfigurationError with custom recovery hint."""
        hint = "Contact system administrator"
        error = BillingConfigurationError("Config error", recovery_hint=hint)

        assert error.recovery_hint == hint

    def test_billing_configuration_error_default_recovery_hint(self):
        """Test BillingConfigurationError default recovery hint."""
        error = BillingConfigurationError("Config error")

        assert "configuration" in error.recovery_hint.lower()


@pytest.mark.unit
class TestPaymentErrors:
    """Test payment-related exception classes."""

    def test_payment_error_basic(self):
        """Test basic PaymentError."""
        error = PaymentError("Payment failed")

        assert error.error_code == "PAYMENT_ERROR"
        assert error.status_code == 402

    def test_payment_method_error_with_method_id(self):
        """Test PaymentMethodError with payment_method_id."""
        error = PaymentMethodError("Invalid payment method", payment_method_id="pm-123")

        assert error.error_code == "PAYMENT_METHOD_ERROR"
        assert error.context["payment_method_id"] == "pm-123"
        assert "funds" in error.recovery_hint.lower()

    def test_payment_method_error_without_context(self):
        """Test PaymentMethodError without context."""
        error = PaymentMethodError("Invalid payment method")

        assert error.context == {}


@pytest.mark.unit
class TestInvoiceErrors:
    """Test invoice-related exception classes."""

    def test_invoice_error_basic(self):
        """Test basic InvoiceError."""
        error = InvoiceError("Invoice error")

        assert error.error_code == "INVOICE_ERROR"
        assert error.status_code == 400

    def test_invoice_not_found_with_invoice_id(self):
        """Test InvoiceNotFoundError with invoice_id."""
        error = InvoiceNotFoundError("Invoice not found", invoice_id="inv-123")

        assert error.error_code == "INVOICE_NOT_FOUND"
        assert error.status_code == 404
        assert error.context["invoice_id"] == "inv-123"

    def test_invoice_not_found_without_context(self):
        """Test InvoiceNotFoundError without context."""
        error = InvoiceNotFoundError("Invoice not found")

        assert error.context == {}


@pytest.mark.unit
class TestWebhookErrors:
    """Test webhook-related exception classes."""

    def test_webhook_error_basic(self):
        """Test basic WebhookError."""
        error = WebhookError("Webhook failed")

        assert error.error_code == "WEBHOOK_ERROR"
        assert error.status_code == 400

    def test_webhook_error_with_type(self):
        """Test WebhookError with webhook_type."""
        error = WebhookError("Webhook failed", webhook_type="payment.succeeded")

        assert error.context["webhook_type"] == "payment.succeeded"

    def test_webhook_error_with_provider(self):
        """Test WebhookError with provider."""
        error = WebhookError("Webhook failed", provider="stripe")

        assert error.context["provider"] == "stripe"

    def test_webhook_error_with_both(self):
        """Test WebhookError with both webhook_type and provider."""
        error = WebhookError("Webhook failed", webhook_type="payment.succeeded", provider="stripe")

        assert error.context["webhook_type"] == "payment.succeeded"
        assert error.context["provider"] == "stripe"
        assert "webhook" in error.recovery_hint.lower()


@pytest.mark.unit
class TestExceptionInheritance:
    """Test exception inheritance hierarchy."""

    def test_all_exceptions_inherit_from_billing_error(self):
        """Test all custom exceptions inherit from BillingError."""
        exceptions = [
            ProductError("test"),
            ProductNotFoundError("test"),
            SubscriptionError("test"),
            PricingError("test"),
            PaymentError("test"),
            InvoiceError("test"),
            WebhookError("test"),
        ]

        for exc in exceptions:
            assert isinstance(exc, BillingError)
            assert isinstance(exc, Exception)

    def test_product_exceptions_inherit_from_product_error(self):
        """Test product-specific exceptions inherit from ProductError."""
        exceptions = [
            ProductNotFoundError("test"),
            CategoryNotFoundError("test"),
            DuplicateProductError("test", sku="test"),
        ]

        for exc in exceptions:
            assert isinstance(exc, ProductError)
            assert isinstance(exc, BillingError)

    def test_subscription_exceptions_inherit_from_subscription_error(self):
        """Test subscription-specific exceptions inherit from SubscriptionError."""
        exceptions = [
            SubscriptionNotFoundError("test"),
            SubscriptionStateError("test", "active", "trial"),
            PlanNotFoundError("test"),
        ]

        for exc in exceptions:
            assert isinstance(exc, SubscriptionError)
            assert isinstance(exc, BillingError)

    def test_pricing_exceptions_inherit_from_pricing_error(self):
        """Test pricing-specific exceptions inherit from PricingError."""
        exceptions = [
            InvalidPricingRuleError("test"),
            PriceCalculationError("test"),
        ]

        for exc in exceptions:
            assert isinstance(exc, PricingError)
            assert isinstance(exc, BillingError)

    def test_usage_exceptions_inherit_from_usage_tracking_error(self):
        """Test usage-specific exceptions inherit from UsageTrackingError."""
        error = UsageLimitExceededError("test", 100, 50, "api_calls")

        assert isinstance(error, UsageTrackingError)
        assert isinstance(error, BillingError)

    def test_payment_method_error_inherits_from_payment_error(self):
        """Test PaymentMethodError inherits from PaymentError."""
        error = PaymentMethodError("test")

        assert isinstance(error, PaymentError)
        assert isinstance(error, BillingError)

    def test_invoice_not_found_inherits_from_invoice_error(self):
        """Test InvoiceNotFoundError inherits from InvoiceError."""
        error = InvoiceNotFoundError("test")

        assert isinstance(error, InvoiceError)
        assert isinstance(error, BillingError)


@pytest.mark.unit
class TestExceptionRaising:
    """Test exceptions can be raised and caught properly."""

    def test_raise_billing_error(self):
        """Test raising BillingError."""
        with pytest.raises(BillingError) as exc_info:
            raise BillingError("Test error")

        assert exc_info.value.message == "Test error"

    def test_catch_product_error_as_billing_error(self):
        """Test catching ProductError as BillingError."""
        with pytest.raises(BillingError) as exc_info:
            raise ProductError("Product error")

        assert exc_info.value.error_code == "PRODUCT_ERROR"

    def test_catch_specific_exception(self):
        """Test catching specific exception type."""
        with pytest.raises(ProductNotFoundError) as exc_info:
            raise ProductNotFoundError("Not found", product_id="123")

        assert exc_info.value.context["product_id"] == "123"
