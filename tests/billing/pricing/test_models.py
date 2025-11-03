"""
Tests for billing pricing models.

Covers Pydantic model validation, enums, and pricing logic.
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
    PricingRuleResponse,
    PricingRuleUpdateRequest,
)


@pytest.mark.unit
class TestDiscountType:
    """Test DiscountType enum."""

    def test_discount_type_values(self):
        """Test DiscountType enum values."""
        assert DiscountType.PERCENTAGE == "percentage"
        assert DiscountType.FIXED_AMOUNT == "fixed_amount"
        assert DiscountType.FIXED_PRICE == "fixed_price"

    def test_discount_type_enum_members(self):
        """Test DiscountType enum has all expected members."""
        expected_types = {"PERCENTAGE", "FIXED_AMOUNT", "FIXED_PRICE"}
        actual_types = set(DiscountType.__members__.keys())
        assert actual_types == expected_types


@pytest.mark.unit
class TestPricingRule:
    """Test PricingRule model."""

    def test_valid_pricing_rule_creation(self, sample_pricing_rule):
        """Test creating a valid pricing rule."""
        rule = sample_pricing_rule
        assert rule.rule_id == "rule_123"
        assert rule.name == "Volume Discount"
        assert rule.discount_type == DiscountType.PERCENTAGE
        assert rule.discount_value == Decimal("10")
        assert rule.min_quantity == 2
        assert rule.customer_segments == ["premium"]
        assert rule.applies_to_product_ids == ["prod_123"]

    def test_pricing_rule_validation_negative_discount(self):
        """Test pricing rule validation fails with negative discount."""
        with pytest.raises(ValidationError) as exc_info:
            PricingRule(
                rule_id="rule_123",
                tenant_id="test-tenant",
                name="Test Rule",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("-10"),  # Negative discount
                is_active=True,
                created_at=datetime.now(UTC),
            )

        errors = exc_info.value.errors()
        assert any("discount_value" in str(error) for error in errors)

    def test_pricing_rule_validation_invalid_min_quantity(self):
        """Test pricing rule validation with invalid min_quantity."""
        with pytest.raises(ValidationError):
            PricingRule(
                rule_id="rule_123",
                tenant_id="test-tenant",
                name="Test Rule",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                min_quantity=0,  # Invalid - must be positive
                is_active=True,
                created_at=datetime.now(UTC),
            )

    def test_pricing_rule_validation_invalid_max_uses(self):
        """Test pricing rule validation with invalid max_uses."""
        with pytest.raises(ValidationError):
            PricingRule(
                rule_id="rule_123",
                tenant_id="test-tenant",
                name="Test Rule",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                max_uses=0,  # Invalid - must be positive
                is_active=True,
                created_at=datetime.now(UTC),
            )

    def test_pricing_rule_business_methods(self, sample_pricing_rule):
        """Test pricing rule business logic methods."""
        rule = sample_pricing_rule

        # Test is_currently_active
        assert rule.is_currently_active() is True

        # Test has_usage_remaining
        assert rule.has_usage_remaining() is True

        # Test can_be_applied
        assert rule.can_be_applied(quantity=3) is True  # Meets min_quantity
        assert rule.can_be_applied(quantity=1) is False  # Below min_quantity

        # Test with time constraints
        now = datetime.now(UTC)
        future_rule = PricingRule(
            rule_id="rule_future",
            tenant_id="test-tenant",
            name="Future Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            starts_at=now + timedelta(days=1),  # Starts tomorrow
            is_active=True,
            created_at=now,
        )
        assert future_rule.is_currently_active() is False

        # Test with expired rule
        expired_rule = PricingRule(
            rule_id="rule_expired",
            tenant_id="test-tenant",
            name="Expired Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            starts_at=now - timedelta(days=2),
            ends_at=now - timedelta(days=1),  # Ended yesterday
            is_active=True,
            created_at=now,
        )
        assert expired_rule.is_currently_active() is False

    def test_pricing_rule_usage_limits(self):
        """Test pricing rule usage limit logic."""
        now = datetime.now(UTC)

        # Rule with usage limit
        limited_rule = PricingRule(
            rule_id="rule_limited",
            tenant_id="test-tenant",
            name="Limited Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            max_uses=5,
            current_uses=4,  # 1 use remaining
            is_active=True,
            created_at=now,
        )
        assert limited_rule.has_usage_remaining() is True
        assert limited_rule.can_be_applied() is True

        # Rule at usage limit
        exhausted_rule = PricingRule(
            rule_id="rule_exhausted",
            tenant_id="test-tenant",
            name="Exhausted Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            max_uses=5,
            current_uses=5,  # At limit
            is_active=True,
            created_at=now,
        )
        assert exhausted_rule.has_usage_remaining() is False
        assert exhausted_rule.can_be_applied() is False

    def test_pricing_rule_defaults(self):
        """Test pricing rule model defaults."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="Test Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            created_at=datetime.now(UTC),
        )

        assert rule.description is None
        assert rule.applies_to_product_ids == []
        assert rule.applies_to_categories == []
        assert rule.applies_to_all is False
        assert rule.min_quantity is None
        assert rule.customer_segments == []
        assert rule.starts_at is None
        assert rule.ends_at is None
        assert rule.max_uses is None
        assert rule.current_uses == 0
        assert rule.priority == 0
        assert rule.is_active is True
        assert rule.metadata == {}


@pytest.mark.unit
class TestPriceCalculationContext:
    """Test PriceCalculationContext model."""

    def test_valid_context_creation(self):
        """Test creating a valid price calculation context."""
        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=2,
            customer_id="customer-456",
            customer_segments=["premium"],
            product_category="software",
            base_price=Decimal("99.99"),
        )

        assert context.product_id == "prod_123"
        assert context.quantity == 2
        assert context.customer_id == "customer-456"
        assert context.customer_segments == ["premium"]
        assert context.base_price == Decimal("99.99")

    def test_context_validation_invalid_quantity(self):
        """Test context validation with invalid quantity."""
        with pytest.raises(ValidationError):
            PriceCalculationContext(
                product_id="prod_123",
                quantity=0,  # Invalid - must be >= 1
                customer_id="customer-456",
                base_price=Decimal("99.99"),
            )

    def test_context_defaults(self):
        """Test price calculation context defaults."""
        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("99.99"),
        )

        assert context.customer_segments == []
        assert context.product_category is None
        assert isinstance(context.calculation_date, datetime)
        assert context.metadata == {}


@pytest.mark.unit
class TestPriceAdjustment:
    """Test PriceAdjustment model."""

    def test_valid_adjustment_creation(self):
        """Test creating a valid price adjustment."""
        adjustment = PriceAdjustment(
            rule_id="rule_123",
            rule_name="Test Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            original_price=Decimal("100.00"),
            discount_amount=Decimal("10.00"),
            adjusted_price=Decimal("90.00"),
        )

        assert adjustment.rule_id == "rule_123"
        assert adjustment.discount_type == DiscountType.PERCENTAGE
        assert adjustment.original_price == Decimal("100.00")
        assert adjustment.discount_amount == Decimal("10.00")
        assert adjustment.adjusted_price == Decimal("90.00")


@pytest.mark.unit
class TestPriceCalculationResult:
    """Test PriceCalculationResult model."""

    def test_valid_result_creation(self):
        """Test creating a valid price calculation result."""
        adjustment = PriceAdjustment(
            rule_id="rule_123",
            rule_name="Test Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            original_price=Decimal("100.00"),
            discount_amount=Decimal("10.00"),
            adjusted_price=Decimal("90.00"),
        )

        result = PriceCalculationResult(
            product_id="prod_123",
            quantity=2,
            customer_id="customer-456",
            base_price=Decimal("50.00"),
            subtotal=Decimal("100.00"),
            total_discount_amount=Decimal("10.00"),
            final_price=Decimal("90.00"),
            applied_adjustments=[adjustment],
        )

        assert result.product_id == "prod_123"
        assert result.quantity == 2
        assert result.subtotal == Decimal("100.00")
        assert result.total_discount_amount == Decimal("10.00")
        assert result.final_price == Decimal("90.00")
        assert len(result.applied_adjustments) == 1

    def test_result_business_methods(self):
        """Test price calculation result business methods."""
        result = PriceCalculationResult(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("100.00"),
            subtotal=Decimal("100.00"),
            total_discount_amount=Decimal("20.00"),
            final_price=Decimal("80.00"),
            applied_adjustments=[],
        )

        # Test get_savings_percentage
        savings_percentage = result.get_savings_percentage()
        assert savings_percentage == Decimal("20")  # 20% savings

        # Test with zero subtotal
        zero_result = PriceCalculationResult(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("0"),
            subtotal=Decimal("0"),
            total_discount_amount=Decimal("0"),
            final_price=Decimal("0"),
            applied_adjustments=[],
        )
        assert zero_result.get_savings_percentage() == Decimal("0")

    def test_result_defaults(self):
        """Test price calculation result defaults."""
        result = PriceCalculationResult(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("100.00"),
            subtotal=Decimal("100.00"),
            total_discount_amount=Decimal("0"),
            final_price=Decimal("100.00"),
        )

        assert result.applied_adjustments == []
        assert isinstance(result.calculation_timestamp, datetime)


@pytest.mark.unit
class TestPricingRuleCreateRequest:
    """Test PricingRuleCreateRequest model."""

    def test_valid_create_request(self, pricing_rule_create_request):
        """Test valid pricing rule creation request."""
        request = pricing_rule_create_request
        assert request.name == "Test Rule"
        assert request.discount_type == DiscountType.PERCENTAGE
        assert request.discount_value == Decimal("15")
        assert request.applies_to_product_ids == ["prod_123"]

    def test_create_request_validation(self):
        """Test pricing rule creation request validation."""
        # Test invalid discount value
        with pytest.raises(ValidationError):
            PricingRuleCreateRequest(
                name="Test Rule",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("-5"),  # Invalid negative discount
            )

        # Test invalid min_quantity
        with pytest.raises(ValidationError):
            PricingRuleCreateRequest(
                name="Test Rule",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                min_quantity=0,  # Invalid - must be >= 1
            )

        # Test invalid max_uses
        with pytest.raises(ValidationError):
            PricingRuleCreateRequest(
                name="Test Rule",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                max_uses=0,  # Invalid - must be >= 1
            )

    def test_create_request_date_validation(self):
        """Test pricing rule creation request date validation."""
        now = datetime.now(UTC)

        # Test end date before start date
        with pytest.raises(ValidationError):
            PricingRuleCreateRequest(
                name="Test Rule",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10"),
                starts_at=now + timedelta(days=2),
                ends_at=now + timedelta(days=1),  # End before start
            )

    def test_create_request_defaults(self):
        """Test pricing rule creation request defaults."""
        request = PricingRuleCreateRequest(
            name="Test Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
        )

        assert request.description is None
        assert request.applies_to_product_ids == []
        assert request.applies_to_categories == []
        assert request.applies_to_all is False
        assert request.min_quantity is None
        assert request.customer_segments == []
        assert request.starts_at is None
        assert request.ends_at is None
        assert request.max_uses is None
        assert request.priority == 0
        assert request.metadata == {}


@pytest.mark.unit
class TestPricingRuleUpdateRequest:
    """Test PricingRuleUpdateRequest model."""

    def test_valid_update_request(self):
        """Test valid pricing rule update request."""
        request = PricingRuleUpdateRequest(
            name="Updated Rule",
            discount_value=Decimal("20"),
            priority=100,
            is_active=False,
        )

        assert request.name == "Updated Rule"
        assert request.discount_value == Decimal("20")
        assert request.priority == 100
        assert request.is_active is False

    def test_update_request_validation(self):
        """Test pricing rule update request validation."""
        # Test invalid discount value
        with pytest.raises(ValidationError):
            PricingRuleUpdateRequest(discount_value=Decimal("-5"))  # Invalid negative discount

        # Test invalid max_uses
        with pytest.raises(ValidationError):
            PricingRuleUpdateRequest(max_uses=0)  # Invalid - must be >= 1

    def test_update_request_partial_updates(self):
        """Test partial updates in update request."""
        # Only update name
        request = PricingRuleUpdateRequest(name="New Name")
        assert request.name == "New Name"
        assert request.discount_value is None

        # Only update priority
        request = PricingRuleUpdateRequest(priority=50)
        assert request.priority == 50
        assert request.name is None

    def test_update_request_defaults(self):
        """Test update request defaults."""
        request = PricingRuleUpdateRequest()

        # All fields should be None by default
        assert request.name is None
        assert request.description is None
        assert request.discount_value is None
        assert request.starts_at is None
        assert request.ends_at is None
        assert request.max_uses is None
        assert request.priority is None
        assert request.is_active is None
        assert request.metadata is None


@pytest.mark.unit
class TestPriceCalculationRequest:
    """Test PriceCalculationRequest model."""

    def test_valid_calculation_request(self, price_calculation_request):
        """Test valid price calculation request."""
        request = price_calculation_request
        assert request.product_id == "prod_123"
        assert request.quantity == 2
        assert request.customer_id == "customer-456"
        assert request.customer_segments == ["premium"]

    def test_calculation_request_validation(self):
        """Test price calculation request validation."""
        # Test invalid quantity
        with pytest.raises(ValidationError):
            PriceCalculationRequest(
                product_id="prod_123",
                quantity=0,  # Invalid - must be >= 1
                customer_id="customer-456",
            )

    def test_calculation_request_defaults(self):
        """Test price calculation request defaults."""
        request = PriceCalculationRequest(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
        )

        assert request.customer_segments == []
        assert request.calculation_date is None
        assert request.metadata == {}


@pytest.mark.unit
class TestPricingRuleResponse:
    """Test PricingRuleResponse model."""

    def test_pricing_rule_response_creation(self):
        """Test pricing rule response model creation."""
        now = datetime.now(UTC)
        response = PricingRuleResponse(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="Test Rule",
            description="Test description",
            applies_to_product_ids=["prod_123"],
            applies_to_categories=["software"],
            applies_to_all=False,
            min_quantity=2,
            customer_segments=["premium"],
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            starts_at=None,
            ends_at=None,
            max_uses=100,
            current_uses=5,
            priority=50,
            is_active=True,
            metadata={"campaign": "q4-2024"},
            created_at=now,
            updated_at=None,
        )

        assert response.rule_id == "rule_123"
        assert response.discount_type == DiscountType.PERCENTAGE
        assert response.current_uses == 5
        assert response.max_uses == 100
