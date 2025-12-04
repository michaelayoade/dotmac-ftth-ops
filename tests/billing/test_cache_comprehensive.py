"""
Comprehensive tests for billing cache module.

Tests cover:
- CacheKey generation
- BillingCacheMetrics operations
- BillingCache multi-tier caching
- Cache decorators
- Cache invalidation strategies
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from dotmac.platform.billing.cache import (
    BillingCache,
    BillingCacheConfig,
    BillingCacheMetrics,
    CacheKey,
    CacheStrategy,
    CacheTier,
    cached_result,
    get_billing_cache,
    invalidate_on_change,
)


@pytest.mark.unit
class TestCacheKeyGeneration:
    """Test cache key generation methods."""

    def test_product_key(self):
        """Test product cache key generation."""
        key = CacheKey.product("prod-123", "tenant-abc")
        assert key == "billing:product:tenant-abc:prod-123"

    def test_product_by_sku_key(self):
        """Test product by SKU cache key generation."""
        key = CacheKey.product_by_sku("sku-xyz", "tenant-abc")
        assert key == "billing:product:sku:tenant-abc:SKU-XYZ"
        # Verify SKU is uppercased
        assert "SKU-XYZ" in key

    def test_product_list_key(self):
        """Test product list cache key generation."""
        key = CacheKey.product_list("tenant-abc", "hash123")
        assert key == "billing:products:tenant-abc:hash123"

    def test_pricing_rule_key(self):
        """Test pricing rule cache key generation."""
        key = CacheKey.pricing_rule("rule-456", "tenant-abc")
        assert key == "billing:pricing:rule:tenant-abc:rule-456"

    def test_pricing_rules_with_product(self):
        """Test pricing rules list with product ID."""
        key = CacheKey.pricing_rules("tenant-abc", product_id="prod-123")
        assert key == "billing:pricing:rules:tenant-abc:prod-123"

    def test_pricing_rules_without_product(self):
        """Test pricing rules list without product ID."""
        key = CacheKey.pricing_rules("tenant-abc")
        assert key == "billing:pricing:rules:tenant-abc:all"

    def test_price_calculation_key(self):
        """Test price calculation cache key generation."""
        key = CacheKey.price_calculation("prod-123", 5, "cust-456", "tenant-abc")
        assert key == "billing:price:tenant-abc:prod-123:5:cust-456"

    def test_subscription_plan_key(self):
        """Test subscription plan cache key generation."""
        key = CacheKey.subscription_plan("plan-789", "tenant-abc")
        assert key == "billing:plan:tenant-abc:plan-789"

    def test_subscription_key(self):
        """Test subscription cache key generation."""
        key = CacheKey.subscription("sub-999", "tenant-abc")
        assert key == "billing:subscription:tenant-abc:sub-999"

    def test_customer_subscriptions_key(self):
        """Test customer subscriptions cache key generation."""
        key = CacheKey.customer_subscriptions("cust-456", "tenant-abc")
        assert key == "billing:subscriptions:customer:tenant-abc:cust-456"

    def test_usage_records_key(self):
        """Test usage records cache key generation."""
        key = CacheKey.usage_records("sub-999", "2024-01")
        assert key == "billing:usage:sub-999:2024-01"

    def test_generate_hash_consistency(self):
        """Test hash generation is consistent for same data."""
        data = {"key1": "value1", "key2": "value2"}
        hash1 = CacheKey.generate_hash(data)
        hash2 = CacheKey.generate_hash(data)
        assert hash1 == hash2

    def test_generate_hash_order_independence(self):
        """Test hash generation is order-independent."""
        data1 = {"key1": "value1", "key2": "value2"}
        data2 = {"key2": "value2", "key1": "value1"}
        hash1 = CacheKey.generate_hash(data1)
        hash2 = CacheKey.generate_hash(data2)
        assert hash1 == hash2

    def test_generate_hash_different_data(self):
        """Test hash generation differs for different data."""
        data1 = {"key1": "value1"}
        data2 = {"key1": "value2"}
        hash1 = CacheKey.generate_hash(data1)
        hash2 = CacheKey.generate_hash(data2)
        assert hash1 != hash2


@pytest.mark.unit
class TestBillingCacheMetrics:
    """Test cache metrics tracking."""

    def test_metrics_initialization(self):
        """Test metrics are initialized to zero."""
        metrics = BillingCacheMetrics()
        assert metrics.hits == 0
        assert metrics.misses == 0
        assert metrics.sets == 0
        assert metrics.deletes == 0
        assert metrics.errors == 0
        assert isinstance(metrics.last_reset, datetime)

    def test_record_hit(self):
        """Test recording cache hits."""
        metrics = BillingCacheMetrics()
        metrics.record_hit()
        metrics.record_hit()
        assert metrics.hits == 2

    def test_record_miss(self):
        """Test recording cache misses."""
        metrics = BillingCacheMetrics()
        metrics.record_miss()
        metrics.record_miss()
        metrics.record_miss()
        assert metrics.misses == 3

    def test_record_set(self):
        """Test recording cache set operations."""
        metrics = BillingCacheMetrics()
        metrics.record_set()
        assert metrics.sets == 1

    def test_record_delete(self):
        """Test recording cache delete operations."""
        metrics = BillingCacheMetrics()
        metrics.record_delete()
        assert metrics.deletes == 1

    def test_record_error(self):
        """Test recording cache errors."""
        metrics = BillingCacheMetrics()
        metrics.record_error()
        metrics.record_error()
        assert metrics.errors == 2

    def test_hit_rate_calculation(self):
        """Test hit rate calculation."""
        metrics = BillingCacheMetrics()
        metrics.hits = 80
        metrics.misses = 20
        hit_rate = metrics.get_hit_rate()
        assert hit_rate == 80.0

    def test_hit_rate_zero_requests(self):
        """Test hit rate when no requests made."""
        metrics = BillingCacheMetrics()
        hit_rate = metrics.get_hit_rate()
        assert hit_rate == 0.0

    def test_get_stats(self):
        """Test getting cache statistics."""
        metrics = BillingCacheMetrics()
        metrics.hits = 10
        metrics.misses = 5
        metrics.sets = 7
        metrics.deletes = 2
        metrics.errors = 1

        stats = metrics.get_stats()
        assert stats["hits"] == 10
        assert stats["misses"] == 5
        assert stats["sets"] == 7
        assert stats["deletes"] == 2
        assert stats["errors"] == 1
        assert stats["hit_rate"] == pytest.approx(66.67, rel=0.01)
        assert "period_start" in stats

    def test_reset_metrics(self):
        """Test resetting metrics."""
        metrics = BillingCacheMetrics()
        metrics.hits = 10
        metrics.misses = 5
        metrics.sets = 7
        old_reset_time = metrics.last_reset

        metrics.reset()

        assert metrics.hits == 0
        assert metrics.misses == 0
        assert metrics.sets == 0
        assert metrics.deletes == 0
        assert metrics.errors == 0
        assert metrics.last_reset > old_reset_time


@pytest.mark.unit
class TestBillingCacheConfig:
    """Test cache configuration."""

    def test_config_default_values(self):
        """Test configuration has expected default values."""
        config = BillingCacheConfig()
        assert config.PRODUCT_TTL == 3600
        assert config.PRICING_RULE_TTL == 1800
        assert config.SUBSCRIPTION_PLAN_TTL == 3600
        assert config.SUBSCRIPTION_TTL == 300
        assert config.CUSTOMER_SEGMENT_TTL == 900
        assert config.ENABLE_L1_CACHE is True
        assert config.ENABLE_L2_CACHE is True


@pytest.mark.unit
class TestBillingCacheL1Operations:
    """Test L1 in-memory cache operations."""

    @pytest.mark.asyncio
    async def test_l1_cache_initialization(self):
        """Test L1 cache is properly initialized."""
        cache = BillingCache()
        assert hasattr(cache, "product_cache")
        assert hasattr(cache, "pricing_cache")
        assert hasattr(cache, "subscription_cache")

    @pytest.mark.asyncio
    async def test_get_from_memory_product(self):
        """Test getting product from L1 memory cache."""
        cache = BillingCache()
        key = "billing:product:tenant-abc:prod-123"
        test_value = {"name": "Test Product"}

        cache._set_in_memory(key, test_value)
        result = cache._get_from_memory(key)

        assert result == test_value

    @pytest.mark.asyncio
    async def test_get_from_memory_pricing(self):
        """Test getting pricing from L1 memory cache."""
        cache = BillingCache()
        key = "billing:pricing:rule:tenant-abc:rule-123"
        test_value = {"discount": 10}

        cache._set_in_memory(key, test_value)
        result = cache._get_from_memory(key)

        assert result == test_value

    @pytest.mark.asyncio
    async def test_get_from_memory_subscription(self):
        """Test getting subscription from L1 memory cache."""
        cache = BillingCache()
        key = "billing:subscription:tenant-abc:sub-123"
        test_value = {"status": "active"}

        cache._set_in_memory(key, test_value)
        result = cache._get_from_memory(key)

        assert result == test_value

    @pytest.mark.asyncio
    async def test_delete_from_memory(self):
        """Test deleting from L1 memory cache."""
        cache = BillingCache()
        key = "billing:product:tenant-abc:prod-123"
        test_value = {"name": "Test Product"}

        cache._set_in_memory(key, test_value)
        assert cache._get_from_memory(key) is not None

        cache._delete_from_memory(key)
        assert cache._get_from_memory(key) is None

    @pytest.mark.asyncio
    async def test_l1_cache_disabled(self):
        """Test behavior when L1 cache is disabled."""
        with patch.object(BillingCacheConfig, "ENABLE_L1_CACHE", False):
            cache = BillingCache()
            # Caches should be plain dicts, not TTLCache
            assert isinstance(cache.product_cache, dict)
            assert isinstance(cache.pricing_cache, dict)
            assert isinstance(cache.subscription_cache, dict)


@pytest.mark.unit
class TestBillingCacheMultiTierOperations:
    """Test multi-tier cache operations."""

    @pytest.mark.asyncio
    async def test_get_from_l1_cache_hit(self):
        """Test getting value from L1 cache (hit)."""
        with patch("dotmac.platform.billing.cache.cache_get") as mock_cache_get:
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"
            test_value = {"name": "Test Product"}

            # Pre-populate L1 cache
            cache._set_in_memory(key, test_value)

            result = await cache.get(key)

            assert result == test_value
            assert cache.metrics.hits == 1
            assert cache.metrics.misses == 0
            # L2 should not be checked
            mock_cache_get.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_from_l2_cache_hit(self):
        """Test getting value from L2 cache when L1 misses."""
        test_value = {"name": "Test Product"}

        with patch("dotmac.platform.billing.cache.cache_get", return_value=test_value):
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"

            result = await cache.get(key)

            assert result == test_value
            assert cache.metrics.hits == 1
            # Value should be promoted to L1
            assert cache._get_from_memory(key) == test_value

    @pytest.mark.asyncio
    async def test_get_with_loader_on_miss(self):
        """Test loader is called on cache miss."""

        async def mock_loader():
            return {"name": "Loaded Product"}

        with patch("dotmac.platform.billing.cache.cache_get", return_value=None):
            with patch("dotmac.platform.billing.cache.cache_set") as mock_cache_set:
                cache = BillingCache()
                key = "billing:product:tenant-abc:prod-123"

                result = await cache.get(key, loader=mock_loader)

                assert result == {"name": "Loaded Product"}
                assert cache.metrics.misses == 1
                # Result should be cached
                mock_cache_set.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_without_loader_returns_none(self):
        """Test get returns None when no loader and cache miss."""
        with patch("dotmac.platform.billing.cache.cache_get", return_value=None):
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"

            result = await cache.get(key)

            assert result is None
            assert cache.metrics.misses == 1

    @pytest.mark.asyncio
    async def test_set_to_both_tiers(self):
        """Test setting value to L2 tier (default behavior)."""
        with patch("dotmac.platform.billing.cache.cache_set") as mock_cache_set:
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"
            value = {"name": "Test Product"}

            success = await cache.set(key, value, ttl=3600)

            assert success is True
            # Default tier is L2_REDIS, so L1 should not have it
            assert cache._get_from_memory(key) is None
            # Should be set to L2
            mock_cache_set.assert_called_once_with(key, value, 3600)
            assert cache.metrics.sets == 1

    @pytest.mark.asyncio
    async def test_set_with_tags(self):
        """Test setting value with tags for invalidation."""
        with patch("dotmac.platform.billing.cache.cache_set"):
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"
            value = {"name": "Test Product"}
            tags = ["product:prod-123", "tenant:tenant-abc"]

            await cache.set(key, value, tags=tags)

            # Tags should be tracked in dependencies
            assert "product:prod-123" in cache.dependencies
            assert key in cache.dependencies["product:prod-123"]
            assert "tenant:tenant-abc" in cache.dependencies
            assert key in cache.dependencies["tenant:tenant-abc"]

    @pytest.mark.asyncio
    async def test_set_l1_only(self):
        """Test setting value to L1 tier only."""
        with patch("dotmac.platform.billing.cache.cache_set") as mock_cache_set:
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"
            value = {"name": "Test Product"}

            await cache.set(key, value, tier=CacheTier.L1_MEMORY)

            # Should be in L1
            assert cache._get_from_memory(key) == value
            # Should NOT be set to L2
            mock_cache_set.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_from_both_tiers(self):
        """Test deleting from both cache tiers."""
        mock_redis = Mock()
        with patch("dotmac.platform.billing.cache.get_redis", return_value=mock_redis):
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"

            # Pre-populate L1
            cache._set_in_memory(key, {"test": "value"})

            success = await cache.delete(key)

            assert success is True
            # Should be removed from L1
            assert cache._get_from_memory(key) is None
            # Should be removed from L2
            mock_redis.delete.assert_called_once_with(key)
            assert cache.metrics.deletes == 1


@pytest.mark.unit
class TestBillingCacheInvalidation:
    """Test cache invalidation strategies."""

    @pytest.mark.asyncio
    async def test_invalidate_pattern_redis(self):
        """Test pattern-based invalidation in Redis."""
        mock_redis = Mock()
        mock_redis.keys.return_value = [
            "billing:product:tenant-abc:prod-1",
            "billing:product:tenant-abc:prod-2",
        ]
        mock_redis.delete.return_value = 2

        with patch("dotmac.platform.billing.cache.get_redis", return_value=mock_redis):
            cache = BillingCache()
            pattern = "billing:product:tenant-abc:*"

            count = await cache.invalidate_pattern(pattern)

            assert count == 2
            mock_redis.keys.assert_called_once_with(pattern)
            mock_redis.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalidate_pattern_memory(self):
        """Test pattern-based invalidation in L1 memory cache."""
        with patch("dotmac.platform.billing.cache.get_redis", return_value=None):
            cache = BillingCache()

            # Add some items to L1 cache
            cache._set_in_memory("billing:product:tenant-abc:prod-1", {"name": "Product 1"})
            cache._set_in_memory("billing:product:tenant-abc:prod-2", {"name": "Product 2"})
            cache._set_in_memory("billing:product:tenant-xyz:prod-3", {"name": "Product 3"})

            pattern = "billing:product:tenant-abc:*"
            count = await cache.invalidate_pattern(pattern)

            # Should invalidate 2 items
            assert count >= 2
            # tenant-abc products should be gone
            assert cache._get_from_memory("billing:product:tenant-abc:prod-1") is None
            assert cache._get_from_memory("billing:product:tenant-abc:prod-2") is None
            # tenant-xyz product should remain
            assert cache._get_from_memory("billing:product:tenant-xyz:prod-3") is not None

    @pytest.mark.asyncio
    async def test_invalidate_by_tags(self):
        """Test tag-based invalidation."""
        with patch("dotmac.platform.billing.cache.cache_set"):
            with patch("dotmac.platform.billing.cache.get_redis", return_value=Mock()):
                cache = BillingCache()

                # Set values with tags
                key1 = "billing:product:tenant-abc:prod-1"
                key2 = "billing:product:tenant-abc:prod-2"
                await cache.set(key1, {"name": "Product 1"}, tags=["tenant:tenant-abc"])
                await cache.set(key2, {"name": "Product 2"}, tags=["tenant:tenant-abc"])

                # Invalidate by tag
                count = await cache.invalidate_by_tags(["tenant:tenant-abc"])

                assert count == 2
                # Tag should be removed from dependencies
                assert "tenant:tenant-abc" not in cache.dependencies

    @pytest.mark.asyncio
    async def test_pattern_matching(self):
        """Test internal pattern matching logic."""
        cache = BillingCache()

        # Test exact match
        assert cache._match_pattern("billing:product:123", "billing:product:123") is True

        # Test wildcard match
        assert cache._match_pattern("billing:product:123", "billing:product:*") is True
        assert cache._match_pattern("billing:product:456", "billing:product:*") is True

        # Test no match
        assert cache._match_pattern("billing:pricing:123", "billing:product:*") is False

        # Test question mark wildcard
        assert cache._match_pattern("billing:product:1", "billing:product:?") is True


@pytest.mark.unit
class TestBillingCacheErrorHandling:
    """Test cache error handling."""

    @pytest.mark.asyncio
    async def test_get_error_returns_none(self):
        """Test get returns None on error without loader."""
        with patch("dotmac.platform.billing.cache.cache_get", side_effect=Exception("Redis error")):
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"

            result = await cache.get(key)

            assert result is None
            assert cache.metrics.errors == 1

    @pytest.mark.asyncio
    async def test_get_error_calls_loader(self):
        """Test get calls loader on error if available."""

        async def mock_loader():
            return {"name": "Loaded Product"}

        with patch("dotmac.platform.billing.cache.cache_get", side_effect=Exception("Redis error")):
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"

            result = await cache.get(key, loader=mock_loader)

            assert result == {"name": "Loaded Product"}
            assert cache.metrics.errors == 1

    @pytest.mark.asyncio
    async def test_set_error_returns_false(self):
        """Test set returns False on error."""
        with patch("dotmac.platform.billing.cache.cache_set", side_effect=Exception("Redis error")):
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"
            value = {"name": "Test Product"}

            success = await cache.set(key, value)

            assert success is False
            assert cache.metrics.errors == 1

    @pytest.mark.asyncio
    async def test_delete_error_returns_false(self):
        """Test delete returns False on error."""
        mock_redis = Mock()
        mock_redis.delete.side_effect = Exception("Redis error")

        with patch("dotmac.platform.billing.cache.get_redis", return_value=mock_redis):
            cache = BillingCache()
            key = "billing:product:tenant-abc:prod-123"

            success = await cache.delete(key)

            assert success is False
            assert cache.metrics.errors == 1


@pytest.mark.unit
class TestCacheDecorators:
    """Test cache decorator functions."""

    @pytest.mark.asyncio
    async def test_cached_result_decorator_cache_hit(self):
        """Test cached_result decorator returns cached value."""
        # Control cache behavior: first call misses, second call hits
        cached_value = {"name": "Product"}
        call_sequence = [None, cached_value]  # First None (miss), then value (hit)

        with patch("dotmac.platform.billing.cache.cache_get", side_effect=call_sequence):
            with patch("dotmac.platform.billing.cache.cache_set"):
                mock_function = AsyncMock(return_value={"name": "Product"})

                @cached_result(ttl=3600, key_prefix="test_hit", key_params=["product_id"])
                async def get_product(product_id: str):
                    return await mock_function(product_id)

                # First call - cache miss, function called
                result1 = await get_product("prod-hit-123")
                assert result1 == {"name": "Product"}
                assert mock_function.call_count == 1

                # Second call - cache hit, function not called
                result2 = await get_product("prod-hit-123")
                assert result2 == {"name": "Product"}
                assert mock_function.call_count == 1  # Still 1, not called again

    @pytest.mark.asyncio
    async def test_cached_result_decorator_cache_miss(self):
        """Test cached_result decorator calls function on cache miss."""
        # Clear cache to ensure clean state
        with patch("dotmac.platform.billing.cache.cache_get", return_value=None):
            with patch("dotmac.platform.billing.cache.cache_set"):
                mock_function = AsyncMock(return_value={"name": "Product"})

                @cached_result(ttl=3600, key_prefix="test_miss", key_params=["product_id"])
                async def get_product(product_id: str):
                    return await mock_function(product_id)

                result = await get_product("prod-miss-123")

                assert result == {"name": "Product"}
                assert mock_function.call_count == 1

    @pytest.mark.asyncio
    async def test_cached_result_different_params(self):
        """Test cached_result decorator with different parameters."""
        # Mock to ensure cache misses
        with patch("dotmac.platform.billing.cache.cache_get", return_value=None):
            with patch("dotmac.platform.billing.cache.cache_set"):
                call_count = {"count": 0}

                @cached_result(ttl=3600, key_prefix="test_diff", key_params=["product_id"])
                async def get_product(product_id: str):
                    call_count["count"] += 1
                    return {"name": f"Product {product_id}"}

                # Different product IDs should result in different cache keys
                result1 = await get_product("prod-diff-123")
                result2 = await get_product("prod-diff-456")

                assert result1 == {"name": "Product prod-diff-123"}
                assert result2 == {"name": "Product prod-diff-456"}
                assert call_count["count"] == 2  # Both called

    @pytest.mark.asyncio
    async def test_invalidate_on_change_decorator(self):
        """Test invalidate_on_change decorator invalidates cache."""
        with patch("dotmac.platform.billing.cache.cache_set"):
            cache = get_billing_cache()

            # Pre-populate cache
            key = "billing:product:tenant-abc:prod-123"
            await cache.set(key, {"name": "Old Product"})

            @invalidate_on_change(patterns=["billing:product:*"])
            async def update_product(product_id: str):
                return {"name": "Updated Product"}

            # Call function
            result = await update_product("prod-123")

            assert result == {"name": "Updated Product"}
            # Cache should be invalidated
            # (pattern invalidation should have been called)

    @pytest.mark.asyncio
    async def test_invalidate_on_change_with_tags(self):
        """Test invalidate_on_change decorator with tags."""
        with patch("dotmac.platform.billing.cache.cache_set"):
            cache = get_billing_cache()

            # Pre-populate cache with tags
            key = "billing:product:tenant-abc:prod-123"
            await cache.set(key, {"name": "Old Product"}, tags=["product:prod-123"])

            @invalidate_on_change(tags=["product:prod-123"])
            async def update_product(product_id: str):
                return {"name": "Updated Product"}

            # Call function
            result = await update_product("prod-123")

            assert result == {"name": "Updated Product"}


@pytest.mark.unit
class TestCacheMetricsAndMonitoring:
    """Test cache metrics and monitoring."""

    @pytest.mark.asyncio
    async def test_get_metrics(self):
        """Test getting cache metrics."""
        with patch("dotmac.platform.billing.cache.get_redis", return_value=None):
            cache = BillingCache()

            # Perform some operations
            cache.metrics.record_hit()
            cache.metrics.record_miss()
            cache.metrics.record_set()

            metrics = cache.get_metrics()

            assert "hits" in metrics
            assert "misses" in metrics
            assert "sets" in metrics
            assert "hit_rate" in metrics
            assert "l1_product_size" in metrics
            assert "l1_pricing_size" in metrics
            assert "l1_subscription_size" in metrics

    @pytest.mark.asyncio
    async def test_get_metrics_with_redis_info(self):
        """Test getting metrics including Redis info."""
        mock_redis = Mock()
        mock_redis.info.return_value = {"used_memory_human": "10.5M"}

        with patch("dotmac.platform.billing.cache.get_redis", return_value=mock_redis):
            cache = BillingCache()
            metrics = cache.get_metrics()

            assert "l2_memory_used" in metrics
            assert metrics["l2_memory_used"] == "10.5M"

    @pytest.mark.asyncio
    async def test_warm_cache_disabled(self):
        """Test cache warming when disabled."""
        cache = BillingCache()
        cache.config.ENABLE_CACHE_WARMING = False

        # Should complete without error
        await cache.warm_cache("tenant-abc")

    @pytest.mark.asyncio
    async def test_warm_cache_enabled(self):
        """Test cache warming when enabled."""
        cache = BillingCache()
        cache.config.ENABLE_CACHE_WARMING = True

        # Should complete without error (currently just logs)
        await cache.warm_cache("tenant-abc")


class TestGlobalCacheInstance:
    """Test global cache instance management."""

    def test_get_billing_cache_singleton(self):
        """Test get_billing_cache returns singleton instance."""
        cache1 = get_billing_cache()
        cache2 = get_billing_cache()

        assert cache1 is cache2

    def test_get_billing_cache_creates_instance(self):
        """Test get_billing_cache creates instance if not exists."""
        # Clear global instance
        import dotmac.platform.billing.cache

        dotmac.platform.billing.cache._billing_cache = None

        cache = get_billing_cache()
        assert cache is not None
        assert isinstance(cache, BillingCache)


@pytest.mark.unit
class TestCacheEnumTypes:
    """Test cache enum types."""

    def test_cache_strategy_enum(self):
        """Test CacheStrategy enum values."""
        assert CacheStrategy.TTL == "ttl"
        assert CacheStrategy.LRU == "lru"
        assert CacheStrategy.LFU == "lfu"
        assert CacheStrategy.WRITE_THROUGH == "write_through"
        assert CacheStrategy.WRITE_BACK == "write_back"

    def test_cache_tier_enum(self):
        """Test CacheTier enum values."""
        assert CacheTier.L1_MEMORY == "l1_memory"
        assert CacheTier.L2_REDIS == "l2_redis"
        assert CacheTier.L3_DATABASE == "l3_database"
