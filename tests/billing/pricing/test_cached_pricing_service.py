"""
Tests for CachedPricingEngine.

Tests caching behavior for pricing rules and calculations.
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.billing.pricing.cached_service import CachedPricingEngine
from dotmac.platform.billing.pricing.models import (
    DiscountType,
    PriceCalculationRequest,
    PriceCalculationResult,
    PricingRule,
)


@pytest.fixture
def mock_cache():
    """Mock billing cache."""
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock()
    cache.delete = AsyncMock()
    cache.invalidate_pattern = AsyncMock()
    return cache


@pytest.fixture
def sample_pricing_rule():
    """Sample pricing rule for testing."""
    return PricingRule(
        rule_id="rule-123",
        tenant_id="tenant-1",
        name="Volume Discount",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("10.0"),
        applies_to_product_ids=["product-1"],
        min_quantity=10,
        is_active=True,
        metadata={
            "thresholds": [
                {"min_quantity": 10, "discount_percentage": 10},
                {"min_quantity": 50, "discount_percentage": 20},
            ]
        },
        valid_from=datetime.now(UTC),
        valid_until=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def cached_pricing_engine(mock_cache):
    """Cached pricing engine with mocked cache."""
    # Create mock database session
    mock_db = AsyncMock()

    with patch(
        "dotmac.platform.billing.pricing.cached_service.get_billing_cache", return_value=mock_cache
    ):
        engine = CachedPricingEngine(db_session=mock_db, cache=mock_cache)
        return engine


@pytest.mark.unit
class TestGetPricingRule:
    """Test cached pricing rule retrieval."""

    @pytest.mark.asyncio
    async def test_get_pricing_rule_cache_hit(
        self, cached_pricing_engine, mock_cache, sample_pricing_rule
    ):
        """Test retrieving pricing rule from cache (cache hit)."""
        # Setup: Cache returns the rule
        mock_cache.get.return_value = sample_pricing_rule.model_dump()

        # Execute
        result = await cached_pricing_engine.get_pricing_rule("rule-123", "tenant-1")

        # Verify
        assert result.rule_id == "rule-123"
        assert result.name == "Volume Discount"
        mock_cache.get.assert_called_once()
        mock_cache.set.assert_not_called()  # Should not write to cache on hit

    @pytest.mark.asyncio
    async def test_get_pricing_rule_cache_miss(
        self, cached_pricing_engine, mock_cache, sample_pricing_rule
    ):
        """Test retrieving pricing rule from database (cache miss)."""
        # Setup: Cache returns None, database returns rule
        mock_cache.get.return_value = None

        with patch.object(
            cached_pricing_engine.__class__.__bases__[0], "get_pricing_rule", new_callable=AsyncMock
        ) as mock_db_get:
            mock_db_get.return_value = sample_pricing_rule

            # Execute
            result = await cached_pricing_engine.get_pricing_rule("rule-123", "tenant-1")

            # Verify
            assert result.rule_id == "rule-123"
            mock_cache.get.assert_called_once()
            mock_cache.set.assert_called_once()  # Should cache the result

            # Verify cache key and tags
            cache_call = mock_cache.set.call_args
            assert cache_call[0][0].startswith("billing:pricing:rule:")
            assert "tenant:tenant-1" in cache_call[1]["tags"]
            assert "pricing_rule:rule-123" in cache_call[1]["tags"]


@pytest.mark.unit
class TestListPricingRules:
    """Test cached pricing rules listing."""

    @pytest.mark.asyncio
    async def test_list_pricing_rules_cache_hit(
        self, cached_pricing_engine, mock_cache, sample_pricing_rule
    ):
        """Test listing pricing rules from cache."""
        # Setup
        cached_rules = [sample_pricing_rule.model_dump()]
        mock_cache.get.return_value = cached_rules

        # Execute
        result = await cached_pricing_engine.list_pricing_rules("tenant-1", product_id="product-1")

        # Verify
        assert len(result) == 1
        assert result[0].rule_id == "rule-123"
        mock_cache.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_pricing_rules_with_filters(self, cached_pricing_engine, mock_cache):
        """Test that cache key includes filters."""
        mock_cache.get.return_value = None

        with patch.object(
            cached_pricing_engine.__class__.__bases__[0],
            "list_pricing_rules",
            new_callable=AsyncMock,
        ) as mock_db_list:
            mock_db_list.return_value = []

            # Execute with filters
            await cached_pricing_engine.list_pricing_rules(
                "tenant-1", active_only=True, product_id="product-1", category="software"
            )

            # Verify cache key includes filters
            cache_key = mock_cache.get.call_args[0][0]
            assert "tenant-1" in cache_key
            assert "product-1" in cache_key
            assert "software" in cache_key
            assert "active" in cache_key


@pytest.mark.unit
class TestCreatePricingRule:
    """Test pricing rule creation with cache invalidation."""

    @pytest.mark.asyncio
    async def test_create_pricing_rule_invalidates_cache(
        self, cached_pricing_engine, mock_cache, sample_pricing_rule
    ):
        """Test that creating a pricing rule invalidates related caches."""
        with patch.object(
            cached_pricing_engine.__class__.__bases__[0],
            "create_pricing_rule",
            new_callable=AsyncMock,
        ) as mock_create:
            mock_create.return_value = sample_pricing_rule

            from dotmac.platform.billing.pricing.models import PricingRuleCreateRequest

            create_request = PricingRuleCreateRequest(
                name="Volume Discount",
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("10.0"),
                applies_to_product_ids=["product-1"],
            )

            # Execute
            await cached_pricing_engine.create_pricing_rule(create_request, "tenant-1")

            # Verify cache invalidation
            assert mock_cache.invalidate_pattern.called
            # Check that at least one of the invalidation calls contains tenant-1 and pricing/price
            all_calls = [call[0][0] for call in mock_cache.invalidate_pattern.call_args_list]
            assert any("tenant-1" in pattern for pattern in all_calls)
            assert any("pric" in pattern.lower() for pattern in all_calls)


@pytest.mark.unit
class TestUpdatePricingRule:
    """Test pricing rule updates with cache invalidation."""

    @pytest.mark.asyncio
    async def test_update_pricing_rule_invalidates_caches(
        self, cached_pricing_engine, mock_cache, sample_pricing_rule
    ):
        """Test that updating a rule invalidates both specific and list caches."""
        with patch.object(
            cached_pricing_engine.__class__.__bases__[0],
            "update_pricing_rule",
            new_callable=AsyncMock,
        ) as mock_update:
            mock_update.return_value = sample_pricing_rule

            # Execute
            await cached_pricing_engine.update_pricing_rule(
                "rule-123", {"name": "Updated Discount"}, "tenant-1"
            )

            # Verify specific rule cache invalidated
            assert mock_cache.delete.called

            # Verify list caches invalidated
            assert mock_cache.invalidate_pattern.called


@pytest.mark.unit
class TestCalculatePrice:
    """Test price calculation with caching."""

    @pytest.mark.asyncio
    async def test_calculate_price_cache_hit(self, cached_pricing_engine, mock_cache):
        """Test price calculation from cache."""
        # Setup cached calculation - must match PriceCalculationResult fields
        cached_result = {
            "product_id": "product-1",
            "quantity": 10,
            "customer_id": "customer-1",
            "base_price": 100.00,
            "subtotal": 1000.00,
            "total_discount_amount": 100.00,
            "final_price": 900.00,
            "applied_adjustments": [],
            "calculation_timestamp": datetime.now(UTC).isoformat(),
        }
        mock_cache.get.return_value = cached_result

        calc_request = PriceCalculationRequest(
            product_id="product-1",
            quantity=10,
            customer_id="customer-1",
        )

        # Execute
        result = await cached_pricing_engine.calculate_price(calc_request, "tenant-1")

        # Verify
        assert result.final_price == Decimal("900.00")
        mock_cache.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_calculate_price_cache_miss(self, cached_pricing_engine, mock_cache):
        """Test price calculation without cache."""
        mock_cache.get.return_value = None

        calc_result = PriceCalculationResult(
            product_id="product-1",
            quantity=10,
            customer_id="customer-1",
            base_price=Decimal("100.00"),
            subtotal=Decimal("1000.00"),
            total_discount_amount=Decimal("100.00"),
            final_price=Decimal("900.00"),
        )

        with patch.object(
            cached_pricing_engine.__class__.__bases__[0], "calculate_price", new_callable=AsyncMock
        ) as mock_calc:
            mock_calc.return_value = calc_result

            calc_request = PriceCalculationRequest(
                product_id="product-1",
                quantity=10,
                customer_id="customer-1",
            )

            # Execute
            result = await cached_pricing_engine.calculate_price(calc_request, "tenant-1")

            # Verify result cached
            assert result.final_price == Decimal("900.00")
            mock_cache.set.assert_called_once()


@pytest.mark.unit
class TestDeletePricingRule:
    """Test pricing rule deletion with cache cleanup."""

    @pytest.mark.asyncio
    async def test_delete_pricing_rule_clears_caches(
        self, cached_pricing_engine, mock_cache, sample_pricing_rule
    ):
        """Test that deleting a rule removes it from all caches."""
        # Setup: Mock getting the rule before deletion
        mock_cache.get.return_value = sample_pricing_rule.model_dump()

        with patch.object(
            cached_pricing_engine.__class__.__bases__[0],
            "delete_pricing_rule",
            new_callable=AsyncMock,
        ) as mock_delete:
            mock_delete.return_value = None

            # Execute
            await cached_pricing_engine.delete_pricing_rule("rule-123", "tenant-1")

            # Verify cache operations
            assert mock_cache.delete.called, "Should delete specific rule cache"
            assert mock_cache.invalidate_pattern.called, "Should invalidate pattern caches"

            # Verify multiple invalidation patterns were called
            invalidate_calls = [call[0][0] for call in mock_cache.invalidate_pattern.call_args_list]
            assert any("pricing:rules" in pattern for pattern in invalidate_calls), (
                "Should invalidate pricing rules list cache"
            )
            assert any("applicable" in pattern for pattern in invalidate_calls), (
                "Should invalidate applicable rules cache"
            )


@pytest.mark.unit
class TestCacheKeyGeneration:
    """Test cache key generation for different operations."""

    def test_cache_key_includes_tenant_id(self, cached_pricing_engine, mock_cache):
        """Test that all cache keys include tenant_id for isolation."""
        # This would be tested indirectly through the cache.get/set calls
        # The actual implementation should use CacheKey.pricing_rule(rule_id, tenant_id)
        from dotmac.platform.billing.cache import CacheKey

        key = CacheKey.pricing_rule("rule-123", "tenant-1")
        assert "tenant-1" in key
        assert "rule-123" in key


@pytest.mark.unit
class TestCacheTTL:
    """Test cache TTL configuration."""

    @pytest.mark.asyncio
    async def test_pricing_rule_uses_configured_ttl(
        self, cached_pricing_engine, mock_cache, sample_pricing_rule
    ):
        """Test that pricing rules use configured TTL."""
        mock_cache.get.return_value = None

        with patch.object(
            cached_pricing_engine.__class__.__bases__[0], "get_pricing_rule", new_callable=AsyncMock
        ) as mock_get:
            mock_get.return_value = sample_pricing_rule

            await cached_pricing_engine.get_pricing_rule("rule-123", "tenant-1")

            # Verify TTL was passed to cache.set
            assert mock_cache.set.called
            ttl_arg = mock_cache.set.call_args[1].get("ttl")
            assert ttl_arg is not None
            assert ttl_arg > 0


@pytest.mark.unit
class TestBatchOperations:
    """Test batch pricing operations with cache optimization."""

    @pytest.mark.asyncio
    async def test_batch_calculate_uses_cache_efficiently(self, cached_pricing_engine, mock_cache):
        """Test that batch calculations leverage cache."""
        # Setup: Some calculations in cache, some not - must match PriceCalculationResult fields
        cache_responses = [
            {  # Hit
                "product_id": "product-0",
                "quantity": 10,
                "customer_id": "customer-1",
                "base_price": 100.00,
                "subtotal": 1000.00,
                "total_discount_amount": 100.00,
                "final_price": 900.00,
                "applied_adjustments": [],
                "calculation_timestamp": datetime.now(UTC).isoformat(),
            },
            None,  # Miss
            {  # Hit
                "product_id": "product-2",
                "quantity": 10,
                "customer_id": "customer-1",
                "base_price": 200.00,
                "subtotal": 2000.00,
                "total_discount_amount": 200.00,
                "final_price": 1800.00,
                "applied_adjustments": [],
                "calculation_timestamp": datetime.now(UTC).isoformat(),
            },
        ]
        mock_cache.get.side_effect = cache_responses

        with patch.object(
            cached_pricing_engine.__class__.__bases__[0], "calculate_price", new_callable=AsyncMock
        ) as mock_calc:
            mock_calc.return_value = PriceCalculationResult(
                product_id="product-1",
                quantity=10,
                customer_id="customer-1",
                base_price=Decimal("150.00"),
                subtotal=Decimal("1500.00"),
                total_discount_amount=Decimal("150.00"),
                final_price=Decimal("1350.00"),
            )

            requests = [
                PriceCalculationRequest(
                    product_id=f"product-{i}",
                    quantity=10,
                    customer_id="customer-1",
                )
                for i in range(3)
            ]

            # Execute batch calculation (if implemented)
            # For now, test individual calculations
            for req in requests:
                await cached_pricing_engine.calculate_price(req, "tenant-1")

            # Verify cache was checked for all
            assert mock_cache.get.call_count == 3

            # Verify only cache misses hit the database
            assert mock_calc.call_count == 1


@pytest.mark.unit
class TestErrorHandling:
    """Test error handling in cached operations."""

    @pytest.mark.asyncio
    async def test_cache_failure_falls_back_to_database(
        self, cached_pricing_engine, mock_cache, sample_pricing_rule
    ):
        """Test that cache failures don't break the operation."""
        # Setup: Cache raises exception
        mock_cache.get.side_effect = Exception("Cache unavailable")

        with patch.object(
            cached_pricing_engine.__class__.__bases__[0], "get_pricing_rule", new_callable=AsyncMock
        ) as mock_get:
            mock_get.return_value = sample_pricing_rule

            # Execute - should fall back to database
            result = await cached_pricing_engine.get_pricing_rule("rule-123", "tenant-1")

            # Verify fallback worked
            assert result.rule_id == "rule-123"
            mock_get.assert_called_once()
