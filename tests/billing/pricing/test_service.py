"""
Tests for billing pricing service.

Covers pricing rule management and price calculations.
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.billing.exceptions import PricingError
from dotmac.platform.billing.pricing.models import (
    DiscountType,
    PriceCalculationContext,
    PricingRule,
    PricingRuleUpdateRequest,
)
from dotmac.platform.billing.pricing.service import PricingEngine

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
class TestPricingEngineRules:
    """Test pricing rule management in service."""

    @pytest.fixture
    def service(self):
        """Create service instance for testing."""
        mock_db = AsyncMock()
        return PricingEngine(db_session=mock_db)

    @pytest.mark.asyncio
    async def test_create_rule_success(self, service, pricing_rule_create_request, tenant_id):
        """Test successful rule creation."""
        # Configure the mock db session that was passed to the service
        service.db.add = MagicMock()
        service.db.commit = AsyncMock()

        # Mock refresh to populate database-generated fields
        def mock_refresh_side_effect(obj):
            obj.created_at = datetime.now(UTC)
            obj.updated_at = None
            obj.current_uses = 0
            obj.is_active = True

        service.db.refresh = AsyncMock(side_effect=mock_refresh_side_effect)

        with patch("dotmac.platform.billing.pricing.service.generate_rule_id") as mock_gen_id:
            mock_gen_id.return_value = "rule_test123"

            result = await service.create_pricing_rule(pricing_rule_create_request, tenant_id)

            assert result.name == pricing_rule_create_request.name
            assert result.discount_type == pricing_rule_create_request.discount_type
            assert result.discount_value == pricing_rule_create_request.discount_value
            assert result.tenant_id == tenant_id

            service.db.add.assert_called_once()
            service.db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_rule_success(self, service, tenant_id):
        """Test successful rule retrieval."""
        mock_rule = MagicMock()
        mock_rule.rule_id = "rule_123"
        mock_rule.tenant_id = tenant_id
        mock_rule.name = "Test Rule"
        mock_rule.description = "Test description"
        mock_rule.applies_to_product_ids = ["prod_123"]
        mock_rule.applies_to_categories = []
        mock_rule.applies_to_all = False
        mock_rule.min_quantity = 2
        mock_rule.customer_segments = ["premium"]
        mock_rule.discount_type = "percentage"
        mock_rule.discount_value = Decimal("10")
        mock_rule.starts_at = None
        mock_rule.ends_at = None
        mock_rule.max_uses = None
        mock_rule.current_uses = 0
        mock_rule.priority = 100
        mock_rule.is_active = True
        mock_rule.metadata_json = {}
        mock_rule.created_at = datetime.now(UTC)
        mock_rule.updated_at = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_rule)
        service.db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_pricing_rule("rule_123", tenant_id)

        assert result is not None
        assert result.rule_id == "rule_123"
        assert result.name == "Test Rule"

    @pytest.mark.asyncio
    async def test_get_rule_not_found(self, service, tenant_id):
        """Test rule retrieval when rule doesn't exist."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        service.db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(PricingError) as exc_info:
            await service.get_pricing_rule("nonexistent", tenant_id)
        assert "not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_rules(self, service, tenant_id):
        """Test listing rules with filters."""
        mock_rules = [
            MagicMock(
                rule_id="rule_1",
                tenant_id=tenant_id,
                name="Rule 1",
                applies_to_product_ids=["prod_123"],
                applies_to_categories=[],
                applies_to_all=False,
                min_quantity=1,
                customer_segments=[],
                discount_type="percentage",
                discount_value=Decimal("10"),
                starts_at=None,
                ends_at=None,
                max_uses=None,
                current_uses=0,
                priority=100,
                is_active=True,
                metadata_json={},
                created_at=datetime.now(UTC),
                updated_at=None,
            ),
        ]

        mock_result = MagicMock()
        mock_result.scalars = MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=mock_rules))
        )
        service.db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_pricing_rules(tenant_id)
        assert len(result) == 1
        assert result[0].rule_id == "rule_1"

    @pytest.mark.asyncio
    async def test_update_rule_success(self, service, tenant_id):
        """Test successful rule update."""
        mock_rule = MagicMock()
        mock_rule.rule_id = "rule_123"
        mock_rule.name = "Old Name"
        mock_rule.tenant_id = tenant_id
        mock_rule.discount_type = "percentage"
        mock_rule.discount_value = Decimal("10")
        mock_rule.applies_to_product_ids = []
        mock_rule.applies_to_categories = []
        mock_rule.applies_to_all = True
        mock_rule.min_quantity = 1
        mock_rule.customer_segments = []
        mock_rule.starts_at = None
        mock_rule.ends_at = None
        mock_rule.max_uses = None
        mock_rule.current_uses = 0
        mock_rule.priority = 100
        mock_rule.is_active = True
        mock_rule.metadata_json = {}
        mock_rule.created_at = datetime.now(UTC)
        mock_rule.updated_at = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_rule)
        service.db.execute = AsyncMock(return_value=mock_result)
        service.db.commit = AsyncMock()
        service.db.refresh = AsyncMock()

        update_request = PricingRuleUpdateRequest(
            name="Updated Rule",
            discount_value=Decimal("20"),
        )

        result = await service.update_pricing_rule("rule_123", update_request, tenant_id)

        assert result is not None
        service.db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_rule_success(self, service, tenant_id):
        """Test successful rule deletion."""
        mock_rule = MagicMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_rule)
        service.db.execute = AsyncMock(return_value=mock_result)
        service.db.delete = AsyncMock()
        service.db.commit = AsyncMock()

        await service.delete_pricing_rule("rule_123", tenant_id)

        service.db.delete.assert_called_once()
        service.db.commit.assert_called_once()


@pytest.mark.integration
class TestPricingEngineCalculations:
    """Test price calculation functionality."""

    @pytest.fixture
    def service(self):
        """Create service instance for testing."""
        mock_db = AsyncMock()
        return PricingEngine(db_session=mock_db)

    @pytest.mark.asyncio
    async def test_calculate_price_no_rules(
        self, service, price_calculation_request, tenant_id, sample_product
    ):
        """Test price calculation with no applicable rules."""
        # Mock product_service directly on the service instance
        service.product_service = AsyncMock()
        service.product_service.get_product = AsyncMock(return_value=sample_product)

        with patch.object(service, "_get_applicable_rules") as mock_get_rules:
            mock_get_rules.return_value = []  # No rules

            result = await service.calculate_price(price_calculation_request, tenant_id)

            assert result.product_id == price_calculation_request.product_id
            assert result.quantity == price_calculation_request.quantity
            assert result.base_price == sample_product.base_price
            assert result.final_price == result.subtotal  # No discount
            assert len(result.applied_adjustments) == 0

    @pytest.mark.asyncio
    async def test_calculate_price_with_percentage_rule(
        self, service, price_calculation_request, tenant_id, sample_product, sample_pricing_rule
    ):
        """Test price calculation with percentage discount rule."""
        # Mock product_service directly on the service instance
        service.product_service = AsyncMock()
        service.product_service.get_product = AsyncMock(return_value=sample_product)

        with patch.object(service, "_get_applicable_rules") as mock_get_rules:
            mock_get_rules.return_value = [sample_pricing_rule]

            with patch.object(service, "_rule_applies") as mock_rule_applies:
                mock_rule_applies.return_value = True

                with patch.object(service, "_record_rule_usage") as mock_record_usage:
                    result = await service.calculate_price(price_calculation_request, tenant_id)

                    assert result.product_id == price_calculation_request.product_id
                    assert result.total_discount_amount > Decimal("0")
                    assert result.final_price < result.subtotal
                    assert len(result.applied_adjustments) == 1
                    mock_record_usage.assert_called_once()

    @pytest.mark.asyncio
    async def test_calculate_price_product_not_found(
        self, service, price_calculation_request, tenant_id
    ):
        """Test price calculation when product not found."""
        # Mock product_service directly on the service instance
        service.product_service = AsyncMock()
        service.product_service.get_product = AsyncMock(return_value=None)

        with pytest.raises(PricingError) as exc_info:
            await service.calculate_price(price_calculation_request, tenant_id)

        assert "Product not found" in str(exc_info.value)

    def test_apply_rule_percentage_discount(self, service):
        """Test applying percentage discount rule."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="10% Off",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            is_active=True,
            created_at=datetime.now(UTC),
        )

        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("100.00"),
        )

        adjustment = service._apply_rule(rule, Decimal("100.00"), context)

        assert adjustment.rule_id == "rule_123"
        assert adjustment.discount_type == DiscountType.PERCENTAGE
        assert adjustment.original_price == Decimal("100.00")
        assert adjustment.discount_amount == Decimal("10.00")  # 10% of 100
        assert adjustment.adjusted_price == Decimal("90.00")

    def test_apply_rule_fixed_amount_discount(self, service):
        """Test applying fixed amount discount rule."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="$5 Off",
            discount_type=DiscountType.FIXED_AMOUNT,
            discount_value=Decimal("5.00"),
            is_active=True,
            created_at=datetime.now(UTC),
        )

        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("50.00"),
        )

        adjustment = service._apply_rule(rule, Decimal("50.00"), context)

        assert adjustment.discount_amount == Decimal("5.00")
        assert adjustment.adjusted_price == Decimal("45.00")

    def test_apply_rule_fixed_price_discount(self, service):
        """Test applying fixed price rule."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="Set to $20",
            discount_type=DiscountType.FIXED_PRICE,
            discount_value=Decimal("20.00"),
            is_active=True,
            created_at=datetime.now(UTC),
        )

        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("50.00"),
        )

        adjustment = service._apply_rule(rule, Decimal("50.00"), context)

        assert adjustment.adjusted_price == Decimal("20.00")
        assert adjustment.discount_amount == Decimal("30.00")  # 50 - 20

    def test_apply_rule_prevents_negative_price(self, service):
        """Test that rules cannot create negative prices."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="Big Discount",
            discount_type=DiscountType.FIXED_AMOUNT,
            discount_value=Decimal("100.00"),  # Larger than price
            is_active=True,
            created_at=datetime.now(UTC),
        )

        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("50.00"),
        )

        adjustment = service._apply_rule(rule, Decimal("50.00"), context)

        assert adjustment.adjusted_price == Decimal("0.00")  # Not negative
        assert adjustment.discount_amount == Decimal("50.00")  # Full original price

    @pytest.mark.asyncio
    async def test_rule_applies_quantity_check(self, service):
        """Test rule application with quantity constraints."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="Volume Discount",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            min_quantity=5,  # Requires 5+ items
            is_active=True,
            created_at=datetime.now(UTC),
        )

        context_low_qty = PriceCalculationContext(
            product_id="prod_123",
            quantity=3,  # Below minimum
            customer_id="customer-456",
            base_price=Decimal("100.00"),
        )

        context_high_qty = PriceCalculationContext(
            product_id="prod_123",
            quantity=10,  # Above minimum
            customer_id="customer-456",
            base_price=Decimal("100.00"),
        )

        # Should not apply with low quantity
        applies_low = await service._rule_applies(rule, context_low_qty, "test-tenant")
        assert applies_low is False

        # Should apply with high quantity
        applies_high = await service._rule_applies(rule, context_high_qty, "test-tenant")
        assert applies_high is True

    @pytest.mark.asyncio
    async def test_rule_applies_customer_segments(self, service):
        """Test rule application with customer segment constraints."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="Premium Discount",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            customer_segments=["premium", "vip"],  # Only for these segments
            is_active=True,
            created_at=datetime.now(UTC),
        )

        context_no_segment = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            customer_segments=[],  # No segments
            base_price=Decimal("100.00"),
        )

        context_wrong_segment = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            customer_segments=["basic"],  # Wrong segment
            base_price=Decimal("100.00"),
        )

        context_right_segment = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            customer_segments=["premium"],  # Correct segment
            base_price=Decimal("100.00"),
        )

        # Should not apply without matching segment
        applies_none = await service._rule_applies(rule, context_no_segment, "test-tenant")
        assert applies_none is False

        applies_wrong = await service._rule_applies(rule, context_wrong_segment, "test-tenant")
        assert applies_wrong is False

        # Should apply with matching segment
        applies_right = await service._rule_applies(rule, context_right_segment, "test-tenant")
        assert applies_right is True

    @pytest.mark.asyncio
    async def test_rule_applies_usage_limits(self, service):
        """Test rule application with usage limits."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id="test-tenant",
            name="Limited Discount",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            max_uses=5,
            current_uses=5,  # At limit
            is_active=True,
            created_at=datetime.now(UTC),
        )

        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("100.00"),
        )

        # Should not apply when at usage limit
        applies = await service._rule_applies(rule, context, "test-tenant")
        assert applies is False


@pytest.mark.integration
class TestPricingEngineHelpers:
    """Test helper methods in pricing service."""

    @pytest.fixture
    def service(self):
        """Create service instance for testing."""
        mock_db = AsyncMock()
        return PricingEngine(db_session=mock_db)

    def test_db_to_pydantic_rule(self, service, mock_db_pricing_rule):
        """Test database to Pydantic rule conversion."""
        result = service._db_to_pydantic_rule(mock_db_pricing_rule)

        assert isinstance(result, PricingRule)
        assert result.rule_id == mock_db_pricing_rule.rule_id
        assert result.name == mock_db_pricing_rule.name
        assert result.discount_type == DiscountType.PERCENTAGE

    @pytest.mark.asyncio
    async def test_record_rule_usage(self, service, tenant_id):
        """Test recording rule usage."""
        rule = PricingRule(
            rule_id="rule_123",
            tenant_id=tenant_id,
            name="Test Rule",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=Decimal("10"),
            current_uses=5,
            is_active=True,
            created_at=datetime.now(UTC),
        )

        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("100.00"),
        )

        # Mock rule lookup
        mock_rule = MagicMock()
        mock_rule.current_uses = 5
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_rule)
        service.db.execute = AsyncMock(return_value=mock_result)
        service.db.add = MagicMock()
        service.db.commit = AsyncMock()

        with patch("dotmac.platform.billing.pricing.service.generate_usage_id") as mock_gen_id:
            mock_gen_id.return_value = "usage_123"

            await service._record_rule_usage(rule, context, tenant_id)

            # Verify usage record was added and rule count incremented
            service.db.add.assert_called_once()
            assert mock_rule.current_uses == 6  # Incremented from 5
            service.db.commit.assert_called_once()


@pytest.mark.integration
class TestPricingEngineAdvanced:
    """Test advanced pricing service features."""

    @pytest.fixture
    def service(self):
        """Create service instance for testing."""
        mock_db = AsyncMock()
        return PricingEngine(db_session=mock_db)

    @pytest.mark.asyncio
    async def test_activate_rule(self, service, tenant_id):
        """Test rule activation."""
        mock_rule = MagicMock()
        mock_rule.is_active = False
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_rule)
        service.db.execute = AsyncMock(return_value=mock_result)
        service.db.commit = AsyncMock()

        result = await service.activate_rule("rule_123", tenant_id)

        assert result is True
        assert mock_rule.is_active is True
        service.db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_deactivate_rule(self, service, tenant_id):
        """Test rule deactivation."""
        mock_rule = MagicMock()
        mock_rule.is_active = True
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_rule)
        service.db.execute = AsyncMock(return_value=mock_result)
        service.db.commit = AsyncMock()

        result = await service.deactivate_rule("rule_123", tenant_id)

        assert result is True
        assert mock_rule.is_active is False
        service.db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_reset_rule_usage(self, service, tenant_id):
        """Test resetting rule usage counter."""
        mock_rule = MagicMock()
        mock_rule.current_uses = 10
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_rule)
        service.db.execute = AsyncMock(return_value=mock_result)
        service.db.commit = AsyncMock()

        result = await service.reset_rule_usage("rule_123", tenant_id)

        assert result is True
        assert mock_rule.current_uses == 0
        service.db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_detect_rule_conflicts(self, service, tenant_id):
        """Test detecting rule conflicts."""
        # Mock overlapping rules with same priority
        mock_rules = [
            MagicMock(
                rule_id="rule_1",
                name="Rule 1",
                tenant_id=tenant_id,
                discount_type="percentage",
                discount_value=Decimal("10"),
                priority=100,
                applies_to_all=True,
                applies_to_product_ids=[],
                applies_to_categories=[],
                customer_segments=[],
                starts_at=None,
                ends_at=None,
                max_uses=None,
                current_uses=0,
                min_quantity=1,
                is_active=True,
                metadata_json={},
                created_at=datetime.now(UTC),
                updated_at=None,
            ),
            MagicMock(
                rule_id="rule_2",
                name="Rule 2",
                tenant_id=tenant_id,
                discount_type="percentage",
                discount_value=Decimal("15"),
                priority=100,  # Same priority
                applies_to_all=True,  # Overlapping condition
                applies_to_product_ids=[],
                applies_to_categories=[],
                customer_segments=[],
                starts_at=None,
                ends_at=None,
                max_uses=None,
                current_uses=0,
                min_quantity=1,
                is_active=True,
                metadata_json={},
                created_at=datetime.now(UTC),
                updated_at=None,
            ),
        ]

        mock_result = MagicMock()
        mock_result.scalars = MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=mock_rules))
        )
        service.db.execute = AsyncMock(return_value=mock_result)

        conflicts = await service.detect_rule_conflicts(tenant_id)

        assert len(conflicts) == 1
        assert conflicts[0]["type"] == "priority_overlap"
        assert conflicts[0]["rule1"]["id"] == "rule_1"
        assert conflicts[0]["rule2"]["id"] == "rule_2"

    @pytest.mark.asyncio
    async def test_bulk_activate_rules(self, service, tenant_id):
        """Test bulk rule activation."""
        rule_ids = ["rule_1", "rule_2", "rule_3"]

        with patch.object(service, "activate_rule") as mock_activate:
            # Mock successful activation for first two, failure for third
            mock_activate.side_effect = [True, True, False]

            results = await service.bulk_activate_rules(rule_ids, tenant_id)

            assert results["activated"] == 2
            assert results["failed"] == 1
            assert len(results["errors"]) == 1
            assert mock_activate.call_count == 3

    @pytest.mark.asyncio
    async def test_bulk_deactivate_rules(self, service, tenant_id):
        """Test bulk rule deactivation."""
        rule_ids = ["rule_1", "rule_2"]

        with patch.object(service, "deactivate_rule") as mock_deactivate:
            mock_deactivate.return_value = True

            results = await service.bulk_deactivate_rules(rule_ids, tenant_id)

            assert results["deactivated"] == 2
            assert results["failed"] == 0
            assert len(results["errors"]) == 0
            assert mock_deactivate.call_count == 2


@pytest.mark.integration
class TestPricingEngineErrorHandling:
    """Test error handling in pricing service."""

    @pytest.fixture
    def service(self):
        """Create service instance for testing."""
        mock_db = AsyncMock()
        return PricingEngine(db_session=mock_db)

    @pytest.mark.asyncio
    async def test_database_error_handling(self, service, pricing_rule_create_request, tenant_id):
        """Test handling of database errors."""
        # Simulate database error on commit
        service.db.add = MagicMock()
        service.db.commit = AsyncMock(side_effect=Exception("Database error"))

        # Mock refresh to set required fields before commit fails
        def mock_refresh_side_effect(obj):
            obj.created_at = datetime.now(UTC)
            obj.updated_at = None
            obj.current_uses = 0
            obj.is_active = True

        service.db.refresh = AsyncMock(side_effect=mock_refresh_side_effect)

        with pytest.raises(Exception) as exc_info:
            await service.create_pricing_rule(pricing_rule_create_request, tenant_id)

        assert "Database error" in str(exc_info.value)

    def test_unsupported_discount_type_error(self, service):
        """Test error handling for unsupported discount types."""
        # Create a rule with an invalid discount type (this would normally be caught by Pydantic)
        rule = MagicMock()
        rule.discount_type = "invalid_type"  # Not a valid DiscountType
        rule.discount_value = Decimal("10")

        context = PriceCalculationContext(
            product_id="prod_123",
            quantity=1,
            customer_id="customer-456",
            base_price=Decimal("100.00"),
        )

        with pytest.raises(PricingError) as exc_info:
            service._apply_rule(rule, Decimal("100.00"), context)

        assert "Unsupported discount type" in str(exc_info.value)
