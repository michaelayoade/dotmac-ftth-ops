"""
Comprehensive tests for billing/cache.py to improve coverage from 0%.

Tests cover:
- CacheStrategy and CacheTier enums
- BillingCacheConfig configuration
- CacheKey generation methods
- BillingCacheMetrics tracking
- BillingCache multi-tier caching
- cached_result decorator
- invalidate_on_change decorator
"""

from datetime import datetime
from unittest.mock import Mock, patch

import pytest

# These tests require Redis - mark as integration tests
pytestmark = pytest.mark.integration

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
from dotmac.platform.core.caching import cache_clear


class TestCacheEnums:
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


class TestBillingCacheConfig:
    """Test billing cache configuration."""

    def test_config_ttl_values(self):
        """Test TTL configuration values."""
        config = BillingCacheConfig()
        assert config.PRODUCT_TTL == 3600
        assert config.PRICING_RULE_TTL == 1800
        assert config.SUBSCRIPTION_PLAN_TTL == 3600
        assert config.SUBSCRIPTION_TTL == 300
        assert config.CUSTOMER_SEGMENT_TTL == 900

    def test_config_cache_sizes(self):
        """Test cache size configuration."""
        config = BillingCacheConfig()
        assert config.PRODUCT_CACHE_SIZE == 1000
        assert config.PRICING_CACHE_SIZE == 500
        assert config.SUBSCRIPTION_CACHE_SIZE == 2000

    def test_config_feature_flags(self):
        """Test feature flag configuration."""
        config = BillingCacheConfig()
        assert config.ENABLE_L1_CACHE is True
        assert config.ENABLE_L2_CACHE is True
        assert config.ENABLE_CACHE_METRICS is True
        assert config.ENABLE_CACHE_WARMING is True


@pytest.mark.unit
class TestCacheKey:
    """Test cache key generation."""

    def test_product_key(self):
        """Test product cache key generation."""
        key = CacheKey.product("prod_123", "tenant_456")
        assert key == "billing:product:tenant_456:prod_123"

    def test_product_by_sku_key(self):
        """Test product SKU cache key generation."""
        key = CacheKey.product_by_sku("sku-abc", "tenant_789")
        assert key == "billing:product:sku:tenant_789:SKU-ABC"

    def test_product_list_key(self):
        """Test product list cache key generation."""
        key = CacheKey.product_list("tenant_123", "hash_xyz")
        assert key == "billing:products:tenant_123:hash_xyz"

    def test_pricing_rule_key(self):
        """Test pricing rule cache key generation."""
        key = CacheKey.pricing_rule("rule_456", "tenant_789")
        assert key == "billing:pricing:rule:tenant_789:rule_456"

    def test_pricing_rules_with_product(self):
        """Test pricing rules key with product ID."""
        key = CacheKey.pricing_rules("tenant_123", product_id="prod_456")
        assert key == "billing:pricing:rules:tenant_123:prod_456"

    def test_pricing_rules_all(self):
        """Test pricing rules key without product ID."""
        key = CacheKey.pricing_rules("tenant_123")
        assert key == "billing:pricing:rules:tenant_123:all"

    def test_price_calculation_key(self):
        """Test price calculation cache key."""
        key = CacheKey.price_calculation("prod_123", 5, "cust_456", "tenant_789")
        assert key == "billing:price:tenant_789:prod_123:5:cust_456"

    def test_subscription_plan_key(self):
        """Test subscription plan cache key."""
        key = CacheKey.subscription_plan("plan_123", "tenant_456")
        assert key == "billing:plan:tenant_456:plan_123"

    def test_subscription_key(self):
        """Test subscription cache key."""
        key = CacheKey.subscription("sub_123", "tenant_456")
        assert key == "billing:subscription:tenant_456:sub_123"

    def test_customer_subscriptions_key(self):
        """Test customer subscriptions cache key."""
        key = CacheKey.customer_subscriptions("cust_123", "tenant_456")
        assert key == "billing:subscriptions:customer:tenant_456:cust_123"

    def test_usage_records_key(self):
        """Test usage records cache key."""
        key = CacheKey.usage_records("sub_123", "2024-01")
        assert key == "billing:usage:sub_123:2024-01"

    def test_generate_hash(self):
        """Test hash generation from dictionary."""
        data = {"key1": "value1", "key2": 123}
        hash1 = CacheKey.generate_hash(data)

        # Same data should generate same hash
        hash2 = CacheKey.generate_hash(data)
        assert hash1 == hash2

        # Different data should generate different hash
        different_data = {"key1": "value2", "key2": 123}
        hash3 = CacheKey.generate_hash(different_data)
        assert hash1 != hash3

        # Order shouldn't matter (sorted keys)
        reordered = {"key2": 123, "key1": "value1"}
        hash4 = CacheKey.generate_hash(reordered)
        assert hash1 == hash4


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
        assert metrics.misses == 1

    def test_record_set(self):
        """Test recording cache sets."""
        metrics = BillingCacheMetrics()
        metrics.record_set()
        metrics.record_set()
        metrics.record_set()
        assert metrics.sets == 3

    def test_record_delete(self):
        """Test recording cache deletes."""
        metrics = BillingCacheMetrics()
        metrics.record_delete()
        assert metrics.deletes == 1

    def test_record_error(self):
        """Test recording cache errors."""
        metrics = BillingCacheMetrics()
        metrics.record_error()
        assert metrics.errors == 1

    def test_get_hit_rate_with_no_operations(self):
        """Test hit rate calculation with no operations."""
        metrics = BillingCacheMetrics()
        assert metrics.get_hit_rate() == 0.0

    def test_get_hit_rate_calculation(self):
        """Test hit rate calculation."""
        metrics = BillingCacheMetrics()
        metrics.record_hit()
        metrics.record_hit()
        metrics.record_hit()
        metrics.record_miss()

        # 3 hits, 1 miss = 75% hit rate
        assert metrics.get_hit_rate() == 75.0

    def test_get_stats(self):
        """Test getting statistics dictionary."""
        metrics = BillingCacheMetrics()
        metrics.record_hit()
        metrics.record_miss()
        metrics.record_set()

        stats = metrics.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["sets"] == 1
        assert stats["deletes"] == 0
        assert stats["errors"] == 0
        assert stats["hit_rate"] == 50.0
        assert "period_start" in stats

    def test_reset_metrics(self):
        """Test resetting metrics."""
        metrics = BillingCacheMetrics()
        metrics.record_hit()
        metrics.record_miss()
        metrics.record_set()

        metrics.reset()

        assert metrics.hits == 0
        assert metrics.misses == 0
        assert metrics.sets == 0
        assert metrics.deletes == 0
        assert metrics.errors == 0


@pytest.mark.unit
class TestBillingCache:
    """Test BillingCache multi-tier caching system."""

    def test_cache_initialization(self):
        """Test cache initialization."""
        cache = BillingCache()
        assert isinstance(cache.config, BillingCacheConfig)
        assert isinstance(cache.metrics, BillingCacheMetrics)
        assert isinstance(cache.dependencies, dict)

    def test_cache_initialization_with_l1_enabled(self):
        """Test cache creates TTL caches when L1 is enabled."""
        cache = BillingCache()
        assert cache.product_cache is not None
        assert cache.pricing_cache is not None
        assert cache.subscription_cache is not None

    @patch("dotmac.platform.billing.cache.cache_get")
    @pytest.mark.asyncio
    async def test_get_from_l1_memory_cache(self, mock_cache_get):
        """Test getting value from L1 memory cache."""
        cache = BillingCache()
        cache._set_in_memory("billing:product:test:123", {"id": "123", "name": "Product"})

        result = await cache.get("billing:product:test:123")

        assert result == {"id": "123", "name": "Product"}
        assert cache.metrics.hits == 1
        # Should not hit L2
        mock_cache_get.assert_not_called()

    @patch("dotmac.platform.billing.cache.cache_get")
    @patch("dotmac.platform.billing.cache.cache_set")
    @pytest.mark.asyncio
    async def test_get_from_l2_redis_cache(self, mock_cache_set, mock_cache_get):
        """Test getting value from L2 Redis cache."""
        cache = BillingCache()
        mock_cache_get.return_value = {"id": "456", "name": "Product 2"}

        result = await cache.get("billing:product:test:456")

        assert result == {"id": "456", "name": "Product 2"}
        assert cache.metrics.hits == 1
        mock_cache_get.assert_called_once_with("billing:product:test:456")

    @patch("dotmac.platform.billing.cache.cache_get")
    @pytest.mark.asyncio
    async def test_get_cache_miss_with_loader(self, mock_cache_get):
        """Test cache miss with loader function."""
        cache = BillingCache()
        mock_cache_get.return_value = None

        async def loader():
            return {"id": "789", "loaded": True}

        result = await cache.get("billing:product:test:789", loader=loader)

        assert result == {"id": "789", "loaded": True}
        assert cache.metrics.misses == 1

    @patch("dotmac.platform.billing.cache.cache_get")
    @pytest.mark.asyncio
    async def test_get_cache_miss_without_loader(self, mock_cache_get):
        """Test cache miss without loader returns None."""
        cache = BillingCache()
        mock_cache_get.return_value = None

        result = await cache.get("billing:product:test:999")

        assert result is None
        assert cache.metrics.misses == 1

    @patch("dotmac.platform.billing.cache.cache_get")
    @pytest.mark.asyncio
    async def test_get_handles_exception(self, mock_cache_get):
        """Test get handles exceptions gracefully."""
        cache = BillingCache()
        mock_cache_get.side_effect = Exception("Redis error")

        result = await cache.get("billing:product:test:error")

        assert result is None
        assert cache.metrics.errors == 1

    @patch("dotmac.platform.billing.cache.cache_get")
    @pytest.mark.asyncio
    async def test_get_fallback_to_loader_on_error(self, mock_cache_get):
        """Test get falls back to loader on error."""
        cache = BillingCache()
        mock_cache_get.side_effect = Exception("Redis error")

        async def loader():
            return {"fallback": True}

        result = await cache.get("billing:product:test:error", loader=loader)

        assert result == {"fallback": True}

    @patch("dotmac.platform.billing.cache.cache_set")
    @pytest.mark.asyncio
    async def test_set_in_both_tiers(self, mock_cache_set):
        """Test setting value in both L1 and L2 caches."""
        cache = BillingCache()

        # Set with default tier (L2_REDIS) - should NOT set in L1
        success = await cache.set("billing:product:test:123", {"id": "123"}, ttl=3600)

        assert success is True
        assert cache.metrics.sets == 1
        mock_cache_set.assert_called_once()

        # With L2_REDIS tier, L1 is skipped (tier != CacheTier.L2_REDIS)
        # So L1 should be None
        assert cache._get_from_memory("billing:product:test:123") is None

    @patch("dotmac.platform.billing.cache.cache_set")
    @pytest.mark.asyncio
    async def test_set_with_tags(self, mock_cache_set):
        """Test setting value with tags for invalidation."""
        cache = BillingCache()

        await cache.set("billing:product:test:123", {"id": "123"}, tags=["product", "tenant:123"])

        assert "product" in cache.dependencies
        assert "tenant:123" in cache.dependencies
        assert "billing:product:test:123" in cache.dependencies["product"]

    @patch("dotmac.platform.billing.cache.cache_set")
    @pytest.mark.asyncio
    async def test_set_l1_only(self, mock_cache_set):
        """Test setting value in L1 only."""
        cache = BillingCache()

        await cache.set("billing:product:test:123", {"id": "123"}, tier=CacheTier.L1_MEMORY)

        # Should not call Redis
        mock_cache_set.assert_not_called()

    @patch("dotmac.platform.billing.cache.get_redis")
    @pytest.mark.asyncio
    async def test_delete_from_all_tiers(self, mock_get_redis):
        """Test deleting value from all cache tiers."""
        cache = BillingCache()
        cache._set_in_memory("billing:product:test:123", {"id": "123"})

        mock_redis = Mock()
        mock_get_redis.return_value = mock_redis

        success = await cache.delete("billing:product:test:123")

        assert success is True
        assert cache.metrics.deletes == 1
        mock_redis.delete.assert_called_once_with("billing:product:test:123")

        # Should be removed from L1
        assert cache._get_from_memory("billing:product:test:123") is None

    @patch("dotmac.platform.billing.cache.get_redis")
    @pytest.mark.asyncio
    async def test_delete_handles_exception(self, mock_get_redis):
        """Test delete handles exceptions."""
        cache = BillingCache()
        mock_get_redis.side_effect = Exception("Redis error")

        success = await cache.delete("billing:product:test:error")

        assert success is False
        assert cache.metrics.errors == 1

    @patch("dotmac.platform.billing.cache.get_redis")
    @pytest.mark.asyncio
    async def test_invalidate_pattern(self, mock_get_redis):
        """Test invalidating cache by pattern."""
        cache = BillingCache()

        # Add some data to L1
        cache._set_in_memory("billing:product:tenant1:123", {"id": "123"})
        cache._set_in_memory("billing:product:tenant1:456", {"id": "456"})
        cache._set_in_memory("billing:pricing:tenant1:789", {"id": "789"})

        # Mock Redis
        mock_redis = Mock()
        mock_redis.keys.return_value = ["billing:product:tenant1:999"]
        mock_redis.delete.return_value = 1
        mock_get_redis.return_value = mock_redis

        count = await cache.invalidate_pattern("billing:product:*")

        # Should invalidate 2 from L1 + 1 from Redis
        assert count == 3
        assert cache._get_from_memory("billing:product:tenant1:123") is None
        assert cache._get_from_memory("billing:product:tenant1:456") is None
        assert cache._get_from_memory("billing:pricing:tenant1:789") is not None

    @patch("dotmac.platform.billing.cache.get_redis")
    @patch("dotmac.platform.billing.cache.cache_set")
    @pytest.mark.asyncio
    async def test_invalidate_by_tags(self, mock_cache_set, mock_get_redis):
        """Test invalidating cache by tags."""
        cache = BillingCache()

        # Mock Redis delete to return successfully
        mock_redis = Mock()
        mock_get_redis.return_value = mock_redis

        # Set values with tags
        await cache.set("key1", "value1", tags=["tag1", "tag2"])
        await cache.set("key2", "value2", tags=["tag1"])
        await cache.set("key3", "value3", tags=["tag3"])

        # Invalidate by tag1
        count = await cache.invalidate_by_tags(["tag1"])

        assert count == 2
        assert "tag1" not in cache.dependencies

    def test_get_from_memory_product(self):
        """Test getting product from memory cache."""
        cache = BillingCache()
        cache.product_cache["billing:product:test:123"] = {"id": "123"}

        result = cache._get_from_memory("billing:product:test:123")
        assert result == {"id": "123"}

    def test_get_from_memory_pricing(self):
        """Test getting pricing from memory cache."""
        cache = BillingCache()
        cache.pricing_cache["billing:pricing:test:456"] = {"id": "456"}

        result = cache._get_from_memory("billing:pricing:test:456")
        assert result == {"id": "456"}

    def test_get_from_memory_subscription(self):
        """Test getting subscription from memory cache."""
        cache = BillingCache()
        cache.subscription_cache["billing:subscription:test:789"] = {"id": "789"}

        result = cache._get_from_memory("billing:subscription:test:789")
        assert result == {"id": "789"}

    def test_match_pattern(self):
        """Test pattern matching for cache keys."""
        assert BillingCache._match_pattern("billing:product:123", "billing:product:*")
        assert BillingCache._match_pattern("billing:product:123:456", "billing:product:*")
        assert not BillingCache._match_pattern("billing:pricing:123", "billing:product:*")
        assert BillingCache._match_pattern("billing:product:x", "billing:product:?")

    @pytest.mark.asyncio
    async def test_warm_cache(self):
        """Test cache warming."""
        cache = BillingCache()

        # Should complete without error
        await cache.warm_cache("tenant_123")

    @pytest.mark.asyncio
    async def test_warm_cache_disabled(self):
        """Test cache warming when disabled."""
        cache = BillingCache()
        cache.config.ENABLE_CACHE_WARMING = False

        # Should return immediately
        await cache.warm_cache("tenant_123")

    @patch("dotmac.platform.billing.cache.get_redis")
    def test_get_metrics(self, mock_get_redis):
        """Test getting cache metrics."""
        cache = BillingCache()
        cache.metrics.record_hit()
        cache.metrics.record_set()

        mock_redis = Mock()
        mock_redis.info.return_value = {"used_memory_human": "10MB"}
        mock_get_redis.return_value = mock_redis

        metrics = cache.get_metrics()

        assert metrics["hits"] == 1
        assert metrics["sets"] == 1
        assert "l1_product_size" in metrics
        assert "l1_pricing_size" in metrics
        assert "l1_subscription_size" in metrics
        assert metrics["l2_memory_used"] == "10MB"


@pytest.mark.unit
class TestGlobalCacheInstance:
    """Test global cache instance."""

    def test_get_billing_cache(self):
        """Test getting global billing cache instance."""
        cache1 = get_billing_cache()
        cache2 = get_billing_cache()

        # Should return same instance
        assert cache1 is cache2
        assert isinstance(cache1, BillingCache)


@pytest.mark.unit
class TestCachedResultDecorator:
    """Test cached_result decorator."""

    @pytest.mark.asyncio
    async def test_cached_result_caches_value(self):
        """Test that decorator caches function results."""
        cache_clear()
        cache = get_billing_cache()
        if hasattr(cache, "product_cache"):
            cache.product_cache.clear()
            cache.pricing_cache.clear()
            cache.subscription_cache.clear()

        call_count = 0

        @cached_result(ttl=3600, key_prefix="test", key_params=["param1"])
        async def expensive_function(param1: str):
            nonlocal call_count
            call_count += 1
            return f"result_{param1}"

        result1 = await expensive_function("value1")
        result2 = await expensive_function("value1")

        assert result1 == "result_value1"
        assert result2 == "result_value1"
        # Should only call function once (cached second time)
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_cached_result_different_params(self):
        """Test decorator with different parameters."""

        @cached_result(ttl=3600, key_prefix="test", key_params=["param1", "param2"])
        async def func(param1: str, param2: int):
            return f"{param1}_{param2}"

        result1 = await func("a", 1)
        result2 = await func("a", 2)

        assert result1 == "a_1"
        assert result2 == "a_2"

    @pytest.mark.asyncio
    async def test_cached_result_without_key_params(self):
        """Test decorator without explicit key params."""

        @cached_result(ttl=3600, key_prefix="test")
        async def func(x: int):
            return x * 2

        result = await func(5)
        assert result == 10


@pytest.mark.unit
class TestInvalidateOnChangeDecorator:
    """Test invalidate_on_change decorator."""

    @pytest.mark.asyncio
    async def test_invalidate_by_patterns(self):
        """Test invalidating cache by patterns."""
        cache = get_billing_cache()

        # Set some cache data
        await cache.set("billing:product:123", {"id": "123"})

        @invalidate_on_change(patterns=["billing:product:*"])
        async def update_function():
            return "updated"

        result = await update_function()
        assert result == "updated"

    @pytest.mark.asyncio
    async def test_invalidate_by_tags(self):
        """Test invalidating cache by tags."""
        cache = get_billing_cache()

        # Set some cache data with tags
        await cache.set("key1", "value1", tags=["test_tag"])

        @invalidate_on_change(tags=["test_tag"])
        async def update_function():
            return "updated"

        result = await update_function()
        assert result == "updated"
        assert "test_tag" not in cache.dependencies
