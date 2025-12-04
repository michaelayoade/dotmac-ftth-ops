"""
Comprehensive tests for pricing models and validators.

Tests pricing rule models, validation logic, and price calculation models.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from dotmac.platform.billing.pricing.models import (
    DiscountType,
    PriceAdjustment,
    PriceCalculationContext,
    PriceCalculationRequest,
    PriceCalculationResult,
    PricingRule,
    PricingRuleCreateRequest,
)


@pytest.mark.unit
class TestDiscountType:
    """Test discount type enum."""

    def test_discount_types(self):
        """Test all discount type values."""
        assert DiscountType.PERCENTAGE == "percentage"
        assert DiscountType.FIXED_AMOUNT == "fixed_amount"
        assert DiscountType.FIXED_PRICE == "fixed_price"


class TestPricingRuleModel:
    """Test pricing rule model."""

    def test_create_valid_pricing_rule(self):
        """Test creating a valid pricing rule."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="10% off for VIP customers",
            description="VIP discount",
            applies_to_product_ids=["prod_123"],
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            customer_segments=["vip"],
            priority=10,
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.rule_id == "rule_123"
        assert rule.name == "10% off for VIP customers"
        assert rule.discount_type == DiscountType.PERCENTAGE
        assert rule.discount_value == Decimal("10")

    def test_negative_discount_value_fails(self):
        """Test that negative discount values are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            PricingRule(
                rule_id="rule_123",
                tenant_id="tenant_123",
                name="Invalid discount",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("-10"),  # Negative
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

        assert "Discount value cannot be negative" in str(exc_info.value)

    def test_zero_min_quantity_fails(self):
        """Test that zero min_quantity is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            PricingRule(
                rule_id="rule_123",
                tenant_id="tenant_123",
                name="Bulk discount",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                min_quantity=0,  # Invalid
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

        assert "Minimum quantity must be positive" in str(exc_info.value)

    def test_negative_min_quantity_fails(self):
        """Test that negative min_quantity is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            PricingRule(
                rule_id="rule_123",
                tenant_id="tenant_123",
                name="Bulk discount",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                min_quantity=-5,  # Invalid
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

        assert "Minimum quantity must be positive" in str(exc_info.value)

    def test_zero_max_uses_fails(self):
        """Test that zero max_uses is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            PricingRule(
                rule_id="rule_123",
                tenant_id="tenant_123",
                name="Limited use",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                max_uses=0,  # Invalid
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

        assert "Max uses must be positive" in str(exc_info.value)


class TestPricingRuleMethods:
    """Test pricing rule methods."""

    def test_is_currently_active_when_active(self):
        """Test is_currently_active returns True for active rule."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Active rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.is_currently_active() is True

    def test_is_currently_active_when_inactive(self):
        """Test is_currently_active returns False for inactive rule."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Inactive rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=False,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.is_currently_active() is False

    def test_is_currently_active_before_start_date(self):
        """Test rule is not active before start date."""
        future = datetime.now(UTC) + timedelta(days=1)
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Future rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=True,
            starts_at=future,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.is_currently_active() is False

    def test_is_currently_active_after_end_date(self):
        """Test rule is not active after end date."""
        past = datetime.now(UTC) - timedelta(days=1)
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Expired rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=True,
            ends_at=past,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.is_currently_active() is False

    def test_is_currently_active_within_date_range(self):
        """Test rule is active within date range."""
        past = datetime.now(UTC) - timedelta(days=1)
        future = datetime.now(UTC) + timedelta(days=1)
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Current rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=True,
            starts_at=past,
            ends_at=future,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.is_currently_active() is True

    def test_has_usage_remaining_with_no_limit(self):
        """Test has_usage_remaining returns True when no max_uses."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Unlimited rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            max_uses=None,
            current_uses=1000,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.has_usage_remaining() is True

    def test_has_usage_remaining_under_limit(self):
        """Test has_usage_remaining returns True when under limit."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Limited rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            max_uses=100,
            current_uses=50,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.has_usage_remaining() is True

    def test_has_usage_remaining_at_limit(self):
        """Test has_usage_remaining returns False at limit."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Exhausted rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            max_uses=100,
            current_uses=100,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.has_usage_remaining() is False

    def test_can_be_applied_success(self):
        """Test can_be_applied returns True when all conditions met."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Valid rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=True,
            min_quantity=5,
            max_uses=100,
            current_uses=50,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.can_be_applied(quantity=10) is True

    def test_can_be_applied_fails_when_inactive(self):
        """Test can_be_applied returns False when inactive."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Inactive rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=False,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.can_be_applied() is False

    def test_can_be_applied_fails_insufficient_quantity(self):
        """Test can_be_applied returns False when quantity too low."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Bulk discount",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=True,
            min_quantity=10,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.can_be_applied(quantity=5) is False

    def test_can_be_applied_fails_no_usage_remaining(self):
        """Test can_be_applied returns False when usage exhausted."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="tenant_123",
            name="Exhausted rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=True,
            max_uses=10,
            current_uses=10,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        assert rule.can_be_applied() is False


class TestPricingRuleCreateRequest:
    """Test pricing rule create request validation."""

    def test_valid_create_request(self):
        """Test creating valid rule request."""
        request = PricingRuleCreateRequest(
            name="Summer sale",
            description="20% off all summer products",
            applies_to_categories=["summer"],
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("20"),
        )

        assert request.name == "Summer sale"
        assert request.discount_value == Decimal("20")

    def test_negative_discount_value_fails(self):
        """Test negative discount value fails validation."""
        with pytest.raises(ValidationError):
            PricingRuleCreateRequest(
                name="Invalid",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("-10"),
            )

    def test_end_date_before_start_date_fails(self):
        """Test end date before start date fails."""
        now = datetime.now(UTC)
        future = now + timedelta(days=7)

        with pytest.raises(ValidationError) as exc_info:
            PricingRuleCreateRequest(
                name="Invalid dates",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                starts_at=future,
                ends_at=now,  # Before start
            )

        assert "End date must be after start date" in str(exc_info.value)

    def test_valid_date_range(self):
        """Test valid date range passes validation."""
        now = datetime.now(UTC)
        future = now + timedelta(days=7)

        request = PricingRuleCreateRequest(
            name="Valid dates",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            starts_at=now,
            ends_at=future,
        )

        assert request.starts_at < request.ends_at


class TestPriceCalculationContext:
    """Test price calculation context model."""

    def test_valid_calculation_context(self):
        """Test creating valid calculation context."""
        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=5,
            customer_id="cust_123",
            customer_segments=["vip", "premium"],
            base_price=Decimal("99.99"),
            product_category="electronics",
        )

        assert context.product_id == "prod_123"
        assert context.quantity == 5
        assert context.base_price == Decimal("99.99")

    def test_zero_quantity_fails(self):
        """Test zero quantity fails validation."""
        with pytest.raises(ValidationError):
            PriceCalculationContext(
                product_id="prod_123",
                quantity=0,  # Invalid
                customer_id="cust_123",
                base_price=Decimal("99.99"),
            )

    def test_negative_quantity_fails(self):
        """Test negative quantity fails validation."""
        with pytest.raises(ValidationError):
            PriceCalculationContext(
                product_id="prod_123",
                quantity=-5,  # Invalid
                customer_id="cust_123",
                base_price=Decimal("99.99"),
            )


class TestPriceCalculationResult:
    """Test price calculation result model."""

    def test_valid_calculation_result(self):
        """Test creating valid calculation result."""
        result = PriceCalculationResult(
            product_id="prod_123",
            quantity=5,
            customer_id="cust_123",
            base_price=Decimal("99.99"),
            subtotal=Decimal("499.95"),
            total_discount_amount=Decimal("49.995"),
            final_price=Decimal("449.955"),
        )

        assert result.product_id == "prod_123"
        assert result.subtotal == Decimal("499.95")
        assert result.final_price == Decimal("449.955")

    def test_get_savings_percentage(self):
        """Test calculating savings percentage."""
        result = PriceCalculationResult(
            product_id="prod_123",
            quantity=5,
            customer_id="cust_123",
            base_price=Decimal("100.00"),
            subtotal=Decimal("500.00"),
            total_discount_amount=Decimal("50.00"),
            final_price=Decimal("450.00"),
        )

        savings = result.get_savings_percentage()
        assert savings == Decimal("10.00")

    def test_get_savings_percentage_zero_subtotal(self):
        """Test savings percentage with zero subtotal."""
        result = PriceCalculationResult(
            product_id="prod_123",
            quantity=1,
            customer_id="cust_123",
            base_price=Decimal("0.00"),
            subtotal=Decimal("0.00"),
            total_discount_amount=Decimal("0.00"),
            final_price=Decimal("0.00"),
        )

        savings = result.get_savings_percentage()
        assert savings == Decimal("0")


class TestPriceAdjustment:
    """Test price adjustment model."""

    def test_valid_price_adjustment(self):
        """Test creating valid price adjustment."""
        adjustment = PriceAdjustment(
            rule_id="rule_123",
            rule_name="VIP discount",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            original_price=Decimal("100.00"),
            discount_amount=Decimal("10.00"),
            adjusted_price=Decimal("90.00"),
        )

        assert adjustment.rule_id == "rule_123"
        assert adjustment.discount_amount == Decimal("10.00")
        assert adjustment.adjusted_price == Decimal("90.00")


class TestPriceCalculationRequest:
    """Test price calculation request model."""

    def test_valid_calculation_request(self):
        """Test creating valid calculation request."""
        request = PriceCalculationRequest(
            product_id="prod_123",
            quantity=5,
            customer_id="cust_123",
            customer_segments=["vip"],
        )

        assert request.product_id == "prod_123"
        assert request.quantity == 5
        assert request.customer_segments == ["vip"]

    def test_zero_quantity_fails(self):
        """Test zero quantity fails validation."""
        with pytest.raises(ValidationError):
            PriceCalculationRequest(
                product_id="prod_123",
                quantity=0,
                customer_id="cust_123",
            )

    def test_negative_quantity_fails(self):
        """Test negative quantity fails validation."""
        with pytest.raises(ValidationError):
            PriceCalculationRequest(
                product_id="prod_123",
                quantity=-5,
                customer_id="cust_123",
            )
