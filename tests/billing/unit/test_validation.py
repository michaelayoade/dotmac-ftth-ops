"""Tests for billing validation utilities."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from dotmac.platform.billing.exceptions import (
    BillingConfigurationError,
    PaymentError,
    PricingError,
    ProductError,
    SubscriptionError,
)
from dotmac.platform.billing.validation import (
    BusinessRulesValidator,
    CurrencyValidator,
    DateRangeValidator,
    PricingRuleValidator,
    SKUValidator,
    ValidationContext,
)


@pytest.mark.unit
class TestCurrencyValidator:
    """Test currency validation."""

    def test_validate_currency_code_success(self):
        """Test valid currency codes."""
        assert CurrencyValidator.validate_currency_code("USD") == "USD"
        assert CurrencyValidator.validate_currency_code("eur") == "EUR"  # Case insensitive
        assert CurrencyValidator.validate_currency_code("GBP") == "GBP"
        assert CurrencyValidator.validate_currency_code("jpy") == "JPY"

    def test_validate_currency_code_empty(self):
        """Test empty currency code raises error."""
        with pytest.raises(BillingConfigurationError) as exc_info:
            CurrencyValidator.validate_currency_code("")

        assert "Currency code cannot be empty" in str(exc_info.value)
        assert exc_info.value.context.get("config_key") == "currency"

    def test_validate_currency_code_invalid(self):
        """Test invalid currency code raises error."""
        with pytest.raises(BillingConfigurationError) as exc_info:
            CurrencyValidator.validate_currency_code("XXX")

        assert "Invalid currency code: XXX" in str(exc_info.value)
        assert "ISO 4217" in exc_info.value.recovery_hint

    def test_validate_amount_success(self):
        """Test valid amount validation."""
        # Integer amount
        result = CurrencyValidator.validate_amount(100, "USD")
        assert result == Decimal("100")

        # Float amount
        result = CurrencyValidator.validate_amount(99.99, "EUR")
        assert result == Decimal("99.99")

        # Decimal amount
        result = CurrencyValidator.validate_amount(Decimal("50.50"), "GBP")
        assert result == Decimal("50.50")

        # String amount
        result = CurrencyValidator.validate_amount("25.75", "CAD")
        assert result == Decimal("25.75")

    def test_validate_amount_zero_decimal_currency(self):
        """Test validation for currencies without decimal places."""
        # Valid whole number for JPY
        result = CurrencyValidator.validate_amount(1000, "JPY")
        assert result == Decimal("1000")

        # Invalid decimal for JPY
        with pytest.raises(PaymentError) as exc_info:
            CurrencyValidator.validate_amount(100.50, "JPY")

        assert "does not support decimal amounts" in str(exc_info.value)

    def test_validate_amount_negative(self):
        """Test negative amounts are rejected."""
        with pytest.raises(PaymentError) as exc_info:
            CurrencyValidator.validate_amount(-50, "USD")

        assert "Amount cannot be negative" in str(exc_info.value)

    def test_validate_amount_with_limits(self):
        """Test amount validation with min/max limits."""
        # Within limits
        result = CurrencyValidator.validate_amount(50, "USD", min_amount=10, max_amount=100)
        assert result == Decimal("50")

        # Below minimum
        with pytest.raises(PaymentError) as exc_info:
            CurrencyValidator.validate_amount(5, "USD", min_amount=10)

        assert "Amount below minimum" in str(exc_info.value)

        # Above maximum
        with pytest.raises(PaymentError) as exc_info:
            CurrencyValidator.validate_amount(150, "USD", max_amount=100)

        assert "Amount exceeds maximum" in str(exc_info.value)

    def test_validate_amount_invalid_format(self):
        """Test invalid amount format."""
        with pytest.raises(PaymentError) as exc_info:
            CurrencyValidator.validate_amount("not_a_number", "USD")

        assert "Invalid amount format" in str(exc_info.value)


@pytest.mark.unit
class TestSKUValidator:
    """Test SKU validation."""

    def test_validate_sku_success(self):
        """Test valid SKUs."""
        assert SKUValidator.validate("ABC123") == "ABC123"
        assert SKUValidator.validate("prod_2024") == "PROD_2024"  # Normalized to uppercase
        assert SKUValidator.validate("ITEM-001") == "ITEM-001"
        assert SKUValidator.validate("XX") == "XX"  # Minimum length

    def test_validate_sku_empty(self):
        """Test empty SKU raises error."""
        with pytest.raises(ProductError) as exc_info:
            SKUValidator.validate("")

        assert "SKU cannot be empty" in str(exc_info.value)

    def test_validate_sku_too_short(self):
        """Test SKU too short."""
        with pytest.raises(ProductError) as exc_info:
            SKUValidator.validate("A")

        assert "SKU must be at least 2 characters" in str(exc_info.value)

    def test_validate_sku_too_long(self):
        """Test SKU too long."""
        long_sku = "A" * 101
        with pytest.raises(ProductError) as exc_info:
            SKUValidator.validate(long_sku)

        assert "SKU exceeds maximum length" in str(exc_info.value)

    def test_validate_sku_invalid_format(self):
        """Test SKU with invalid characters."""
        invalid_skus = [
            "ABC 123",  # Space
            "PROD@2024",  # @ symbol
            "ITEM#001",  # # symbol
            "-LEADING",  # Leading hyphen
            "TRAILING-",  # Trailing hyphen
        ]

        for sku in invalid_skus:
            with pytest.raises(ProductError) as exc_info:
                SKUValidator.validate(sku)

            assert "Invalid SKU format" in str(exc_info.value)


@pytest.mark.unit
class TestDateRangeValidator:
    """Test date range validation."""

    def test_validate_billing_period_success(self):
        """Test valid billing period."""
        start = datetime(2024, 1, 1, tzinfo=UTC)
        end = datetime(2024, 1, 31, tzinfo=UTC)

        validated_start, validated_end = DateRangeValidator.validate_billing_period(start, end)

        assert validated_start == start
        assert validated_end == end

    def test_validate_billing_period_naive_dates(self):
        """Test naive dates are converted to timezone.utc."""
        start = datetime(2024, 1, 1)  # Naive
        end = datetime(2024, 1, 31)  # Naive

        validated_start, validated_end = DateRangeValidator.validate_billing_period(start, end)

        assert validated_start.tzinfo == UTC
        assert validated_end.tzinfo == UTC

    def test_validate_billing_period_invalid_order(self):
        """Test end date before start date."""
        start = datetime(2024, 1, 31, tzinfo=UTC)
        end = datetime(2024, 1, 1, tzinfo=UTC)

        with pytest.raises(SubscriptionError) as exc_info:
            DateRangeValidator.validate_billing_period(start, end)

        assert "End date must be after start date" in str(exc_info.value)

    def test_validate_billing_period_too_long(self):
        """Test period exceeds maximum."""
        start = datetime(2024, 1, 1, tzinfo=UTC)
        end = datetime(2025, 12, 31, tzinfo=UTC)  # ~730 days

        with pytest.raises(SubscriptionError) as exc_info:
            DateRangeValidator.validate_billing_period(start, end, max_period_days=365)

        assert "Billing period exceeds maximum" in str(exc_info.value)

    def test_validate_trial_period_success(self):
        """Test valid trial periods."""
        assert DateRangeValidator.validate_trial_period(0) == 0
        assert DateRangeValidator.validate_trial_period(7) == 7
        assert DateRangeValidator.validate_trial_period(30) == 30
        assert DateRangeValidator.validate_trial_period(90) == 90

    def test_validate_trial_period_negative(self):
        """Test negative trial period."""
        with pytest.raises(SubscriptionError) as exc_info:
            DateRangeValidator.validate_trial_period(-1)

        assert "Trial days cannot be negative" in str(exc_info.value)

    def test_validate_trial_period_too_long(self):
        """Test trial period exceeds maximum."""
        with pytest.raises(SubscriptionError) as exc_info:
            DateRangeValidator.validate_trial_period(120, max_trial_days=90)

        assert "Trial period exceeds maximum" in str(exc_info.value)


@pytest.mark.unit
class TestPricingRuleValidator:
    """Test pricing rule validation."""

    def test_validate_discount_percentage_success(self):
        """Test valid percentage discounts."""
        result = PricingRuleValidator.validate_discount("percentage", 10)
        assert result == Decimal("10")

        result = PricingRuleValidator.validate_discount("percentage", "25.5")
        assert result == Decimal("25.5")

        result = PricingRuleValidator.validate_discount("percentage", 100)
        assert result == Decimal("100")

    def test_validate_discount_fixed_success(self):
        """Test valid fixed discounts."""
        result = PricingRuleValidator.validate_discount("fixed", 50)
        assert result == Decimal("50")

        result = PricingRuleValidator.validate_discount("fixed", "99.99")
        assert result == Decimal("99.99")

    def test_validate_discount_negative(self):
        """Test negative discount value."""
        with pytest.raises(PricingError) as exc_info:
            PricingRuleValidator.validate_discount("percentage", -10)

        assert "Discount value cannot be negative" in str(exc_info.value)

    def test_validate_discount_percentage_exceeds_max(self):
        """Test percentage discount exceeds maximum."""
        with pytest.raises(PricingError) as exc_info:
            PricingRuleValidator.validate_discount("percentage", 150, max_percentage=100)

        assert "Percentage discount exceeds maximum" in str(exc_info.value)

    def test_validate_discount_invalid_value(self):
        """Test invalid discount value."""
        with pytest.raises(PricingError) as exc_info:
            PricingRuleValidator.validate_discount("percentage", "invalid")

        assert "Invalid discount value" in str(exc_info.value)

    def test_validate_quantity_rules_success(self):
        """Test valid quantity rules."""
        # Both limits
        min_qty, max_qty = PricingRuleValidator.validate_quantity_rules(1, 100)
        assert min_qty == 1
        assert max_qty == 100

        # Only minimum
        min_qty, max_qty = PricingRuleValidator.validate_quantity_rules(5, None)
        assert min_qty == 5
        assert max_qty is None

        # Only maximum
        min_qty, max_qty = PricingRuleValidator.validate_quantity_rules(None, 50)
        assert min_qty is None
        assert max_qty == 50

    def test_validate_quantity_rules_invalid_minimum(self):
        """Test invalid minimum quantity."""
        with pytest.raises(PricingError) as exc_info:
            PricingRuleValidator.validate_quantity_rules(0, 10)

        assert "Minimum quantity must be at least 1" in str(exc_info.value)

    def test_validate_quantity_rules_invalid_maximum(self):
        """Test invalid maximum quantity."""
        with pytest.raises(PricingError) as exc_info:
            PricingRuleValidator.validate_quantity_rules(1, 0)

        assert "Maximum quantity must be at least 1" in str(exc_info.value)

    def test_validate_quantity_rules_min_exceeds_max(self):
        """Test minimum exceeds maximum."""
        with pytest.raises(PricingError) as exc_info:
            PricingRuleValidator.validate_quantity_rules(100, 10)

        assert "Minimum quantity cannot exceed maximum" in str(exc_info.value)


@pytest.mark.unit
class TestBusinessRulesValidator:
    """Test business rules validation."""

    def test_validate_subscription_change_success(self):
        """Test valid subscription change."""
        # Active subscription
        BusinessRulesValidator.validate_subscription_change(
            current_plan_id="basic", new_plan_id="premium", current_status="active"
        )

        # Trial subscription
        BusinessRulesValidator.validate_subscription_change(
            current_plan_id="trial", new_plan_id="basic", current_status="trial"
        )

    def test_validate_subscription_change_invalid_status(self):
        """Test subscription change with invalid status."""
        with pytest.raises(SubscriptionError) as exc_info:
            BusinessRulesValidator.validate_subscription_change(
                current_plan_id="basic", new_plan_id="premium", current_status="cancelled"
            )

        assert "Cannot change plan for subscription in cancelled status" in str(exc_info.value)

    def test_validate_subscription_change_same_plan(self):
        """Test changing to same plan."""
        with pytest.raises(SubscriptionError) as exc_info:
            BusinessRulesValidator.validate_subscription_change(
                current_plan_id="basic", new_plan_id="basic", current_status="active"
            )

        assert "New plan is the same as current plan" in str(exc_info.value)

    def test_validate_refund_eligibility_success(self):
        """Test eligible refund."""
        payment_date = datetime.now(UTC) - timedelta(days=10)
        amount = Decimal("100.00")
        refunded = Decimal("0.00")

        BusinessRulesValidator.validate_refund_eligibility(
            payment_date=payment_date,
            amount=amount,
            refunded_amount=refunded,
            refund_window_days=30,
        )

    def test_validate_refund_eligibility_window_expired(self):
        """Test refund window expired."""
        payment_date = datetime.now(UTC) - timedelta(days=35)
        amount = Decimal("100.00")
        refunded = Decimal("0.00")

        with pytest.raises(PaymentError) as exc_info:
            BusinessRulesValidator.validate_refund_eligibility(
                payment_date=payment_date,
                amount=amount,
                refunded_amount=refunded,
                refund_window_days=30,
            )

        assert "Refund window of 30 days has expired" in str(exc_info.value)

    def test_validate_refund_eligibility_fully_refunded(self):
        """Test fully refunded payment."""
        payment_date = datetime.now(UTC) - timedelta(days=5)
        amount = Decimal("100.00")
        refunded = Decimal("100.00")

        with pytest.raises(PaymentError) as exc_info:
            BusinessRulesValidator.validate_refund_eligibility(
                payment_date=payment_date, amount=amount, refunded_amount=refunded
            )

        assert "Payment has already been fully refunded" in str(exc_info.value)

    def test_validate_refund_eligibility_naive_date(self):
        """Test refund with naive date."""
        payment_date = datetime.now() - timedelta(days=10)  # Naive
        amount = Decimal("100.00")
        refunded = Decimal("0.00")

        # Should handle naive dates
        BusinessRulesValidator.validate_refund_eligibility(
            payment_date=payment_date, amount=amount, refunded_amount=refunded
        )


@pytest.mark.unit
class TestValidationContext:
    """Test validation context manager."""

    def test_add_and_check_errors(self):
        """Test adding errors to context."""
        ctx = ValidationContext()

        assert not ctx.has_errors()

        ctx.add_error(
            field="amount", message="Invalid amount", value=-50, recovery_hint="Use positive amount"
        )

        assert ctx.has_errors()
        assert len(ctx.errors) == 1
        assert ctx.errors[0]["field"] == "amount"
        assert ctx.errors[0]["message"] == "Invalid amount"
        assert ctx.errors[0]["value"] == -50
        assert ctx.errors[0]["recovery_hint"] == "Use positive amount"

    def test_add_warnings(self):
        """Test adding warnings to context."""
        ctx = ValidationContext()

        ctx.add_warning(field="currency", message="Uncommon currency", value="XOF")

        assert not ctx.has_errors()
        assert len(ctx.warnings) == 1
        assert ctx.warnings[0]["field"] == "currency"

    def test_raise_if_errors(self):
        """Test raising exception for errors."""
        ctx = ValidationContext()

        # No errors - should not raise
        ctx.raise_if_errors()

        # Add errors
        ctx.add_error("field1", "Error 1")
        ctx.add_error("field2", "Error 2")

        with pytest.raises(BillingConfigurationError) as exc_info:
            ctx.raise_if_errors()

        assert "Validation failed with 2 errors" in str(exc_info.value)

    def test_batch_validation_workflow(self):
        """Test using context for batch validation."""
        ctx = ValidationContext()

        # Validate multiple fields
        fields_to_validate = [
            ("amount", -50),
            ("currency", "INVALID"),
            ("sku", "A"),  # Too short
        ]

        for field, value in fields_to_validate:
            if field == "amount" and value < 0:
                ctx.add_error(field, "Negative amount", value)
            elif field == "currency" and value not in ["USD", "EUR", "GBP"]:
                ctx.add_error(field, "Invalid currency", value)
            elif field == "sku" and len(str(value)) < 2:
                ctx.add_error(field, "SKU too short", value)

        assert ctx.has_errors()
        assert len(ctx.errors) == 3

        with pytest.raises(BillingConfigurationError):
            ctx.raise_if_errors()
