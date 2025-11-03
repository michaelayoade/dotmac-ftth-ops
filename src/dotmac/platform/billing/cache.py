"""
Billing module caching layer.

Provides high-performance caching for frequently accessed billing data
with intelligent invalidation and multi-tier caching strategies.
"""

import hashlib
import json
from collections.abc import Awaitable, Callable, MutableMapping
from datetime import UTC, datetime
from enum import Enum
from functools import wraps
from typing import Any, TypeVar

import structlog
from cachetools import TTLCache  # noqa: PGH003

# Core cache primitives reused here for consistency
from dotmac.platform.core.cache_decorators import CacheTier
from dotmac.platform.core.caching import cache_get, cache_set, get_redis

logger = structlog.get_logger(__name__)

T = TypeVar("T")
Loader = Callable[[], Awaitable[Any]]


class CacheStrategy(str, Enum):
    """Cache strategy types."""

    TTL = "ttl"  # Time-based expiration
    LRU = "lru"  # Least recently used
    LFU = "lfu"  # Least frequently used
    WRITE_THROUGH = "write_through"  # Write to cache and database
    WRITE_BACK = "write_back"  # Write to cache, async to database


class BillingCacheConfig:
    """Configuration for billing cache."""

    # Cache TTLs (in seconds)
    PRODUCT_TTL = 3600  # 1 hour for products
    PRICING_RULE_TTL = 1800  # 30 minutes for pricing rules
    SUBSCRIPTION_PLAN_TTL = 3600  # 1 hour for plans
    SUBSCRIPTION_TTL = 300  # 5 minutes for active subscriptions
    CUSTOMER_SEGMENT_TTL = 900  # 15 minutes for customer segments

    # Cache sizes
    PRODUCT_CACHE_SIZE = 1000
    PRICING_CACHE_SIZE = 500
    SUBSCRIPTION_CACHE_SIZE = 2000

    # Feature flags
    ENABLE_L1_CACHE = True
    ENABLE_L2_CACHE = True
    ENABLE_CACHE_METRICS = True
    ENABLE_CACHE_WARMING = True


class CacheKey:
    """Cache key generator for billing entities."""

    @staticmethod
    def product(product_id: str, tenant_id: str) -> str:
        """Generate cache key for product."""
        return f"billing:product:{tenant_id}:{product_id}"

    @staticmethod
    def product_by_sku(sku: str, tenant_id: str) -> str:
        """Generate cache key for product by SKU."""
        return f"billing:product:sku:{tenant_id}:{sku.upper()}"

    @staticmethod
    def product_list(tenant_id: str, filters_hash: str) -> str:
        """Generate cache key for product list."""
        return f"billing:products:{tenant_id}:{filters_hash}"

    @staticmethod
    def pricing_rule(rule_id: str, tenant_id: str) -> str:
        """Generate cache key for pricing rule."""
        return f"billing:pricing:rule:{tenant_id}:{rule_id}"

    @staticmethod
    def pricing_rules(tenant_id: str, product_id: str | None = None) -> str:
        """Generate cache key for pricing rules list."""
        if product_id:
            return f"billing:pricing:rules:{tenant_id}:{product_id}"
        return f"billing:pricing:rules:{tenant_id}:all"

    @staticmethod
    def price_calculation(product_id: str, quantity: int, customer_id: str, tenant_id: str) -> str:
        """Generate cache key for price calculation result."""
        return f"billing:price:{tenant_id}:{product_id}:{quantity}:{customer_id}"

    @staticmethod
    def subscription_plan(plan_id: str, tenant_id: str) -> str:
        """Generate cache key for subscription plan."""
        return f"billing:plan:{tenant_id}:{plan_id}"

    @staticmethod
    def subscription(subscription_id: str, tenant_id: str) -> str:
        """Generate cache key for subscription."""
        return f"billing:subscription:{tenant_id}:{subscription_id}"

    @staticmethod
    def customer_subscriptions(customer_id: str, tenant_id: str) -> str:
        """Generate cache key for customer's subscriptions."""
        return f"billing:subscriptions:customer:{tenant_id}:{customer_id}"

    @staticmethod
    def usage_records(subscription_id: str, period: str) -> str:
        """Generate cache key for usage records."""
        return f"billing:usage:{subscription_id}:{period}"

    @staticmethod
    def generate_hash(data: dict[str, Any]) -> str:
        """Generate hash from dictionary data for cache keys."""
        json_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(json_str.encode(), usedforsecurity=False).hexdigest()  # nosec B324 - MD5 used for cache key generation, not security


class BillingCacheMetrics:
    """Metrics collector for cache operations."""

    def __init__(self) -> None:
        self.hits = 0
        self.misses = 0
        self.sets = 0
        self.deletes = 0
        self.errors = 0
        self.last_reset = datetime.now(UTC)

    def record_hit(self) -> None:
        """Record cache hit."""
        self.hits += 1

    def record_miss(self) -> None:
        """Record cache miss."""
        self.misses += 1

    def record_set(self) -> None:
        """Record cache set operation."""
        self.sets += 1

    def record_delete(self) -> None:
        """Record cache delete operation."""
        self.deletes += 1

    def record_error(self) -> None:
        """Record cache error."""
        self.errors += 1

    def get_hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        if total == 0:
            return 0.0
        return (self.hits / total) * 100

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "sets": self.sets,
            "deletes": self.deletes,
            "errors": self.errors,
            "hit_rate": self.get_hit_rate(),
            "period_start": self.last_reset.isoformat(),
        }

    def reset(self) -> None:
        """Reset metrics."""
        self.hits = 0
        self.misses = 0
        self.sets = 0
        self.deletes = 0
        self.errors = 0
        self.last_reset = datetime.now(UTC)


class BillingCache:
    """
    Multi-tier caching system for billing data.

    Features:
    - L1 in-memory cache for ultra-fast access
    - L2 Redis cache for distributed caching
    - Intelligent cache warming
    - Automatic invalidation
    - Metrics collection
    """

    def __init__(self) -> None:
        self.config = BillingCacheConfig()
        self.metrics = BillingCacheMetrics()

        # L1 in-memory caches
        self.product_cache: MutableMapping[str, Any]
        self.pricing_cache: MutableMapping[str, Any]
        self.subscription_cache: MutableMapping[str, Any]
        if self.config.ENABLE_L1_CACHE:
            self.product_cache = TTLCache(
                maxsize=self.config.PRODUCT_CACHE_SIZE, ttl=self.config.PRODUCT_TTL
            )
            self.pricing_cache = TTLCache(
                maxsize=self.config.PRICING_CACHE_SIZE, ttl=self.config.PRICING_RULE_TTL
            )
            self.subscription_cache = TTLCache(
                maxsize=self.config.SUBSCRIPTION_CACHE_SIZE,
                ttl=self.config.SUBSCRIPTION_TTL,
            )
        else:
            self.product_cache = {}
            self.pricing_cache = {}
            self.subscription_cache = {}

        # Track cache dependencies for invalidation
        self.dependencies: dict[str, set[str]] = {}

    async def get(
        self,
        key: str,
        loader: Loader | None = None,
        ttl: int | None = None,
        tier: CacheTier = CacheTier.L2_REDIS,
    ) -> Any | None:
        """
        Get value from cache with multi-tier lookup.

        Args:
            key: Cache key
            loader: Function to load data if not in cache
            ttl: Time to live in seconds
            tier: Cache tier to use

        Returns:
            Cached value or loaded value
        """
        try:
            # L1 memory cache check
            if self.config.ENABLE_L1_CACHE:
                value = self._get_from_memory(key)
                if value is not None:
                    self.metrics.record_hit()
                    logger.debug("Cache hit L1", key=key)
                    return value

            # L2 Redis cache check
            if self.config.ENABLE_L2_CACHE and tier != CacheTier.L1_MEMORY:
                value = cache_get(key)
                if value is not None:
                    self.metrics.record_hit()
                    logger.debug("Cache hit L2", key=key)
                    # Promote to L1
                    if self.config.ENABLE_L1_CACHE:
                        self._set_in_memory(key, value)
                    return value

            self.metrics.record_miss()
            logger.debug("Cache miss", key=key)

            # Load data if loader provided
            if loader:
                value = await loader()
                if value is not None:
                    await self.set(key, value, ttl=ttl, tier=tier)
                return value

            return None

        except Exception as e:
            self.metrics.record_error()
            logger.error("Cache get error", key=key, error=str(e))
            # Fall back to loader if available
            if loader:
                return await loader()
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int | None = None,
        tier: CacheTier = CacheTier.L2_REDIS,
        tags: list[str] | None = None,
    ) -> bool:
        """
        Set value in cache with multi-tier storage.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            tier: Cache tier to use
            tags: Tags for cache invalidation

        Returns:
            True if successful
        """
        try:
            # Store in L1 memory cache
            if self.config.ENABLE_L1_CACHE and tier != CacheTier.L2_REDIS:
                self._set_in_memory(key, value)

            # Store in L2 Redis cache
            if self.config.ENABLE_L2_CACHE and tier != CacheTier.L1_MEMORY:
                ttl = ttl or self.config.PRODUCT_TTL
                cache_set(key, value, ttl)

            # Track dependencies for invalidation
            if tags:
                for tag in tags:
                    if tag not in self.dependencies:
                        self.dependencies[tag] = set()
                    self.dependencies[tag].add(key)

            self.metrics.record_set()
            logger.debug("Cache set", key=key, ttl=ttl, tier=tier.value)
            return True

        except Exception as e:
            self.metrics.record_error()
            logger.error("Cache set error", key=key, error=str(e))
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete value from all cache tiers.

        Args:
            key: Cache key

        Returns:
            True if successful
        """
        try:
            # Delete from L1 memory cache
            if self.config.ENABLE_L1_CACHE:
                self._delete_from_memory(key)

            # Delete from L2 Redis cache
            if self.config.ENABLE_L2_CACHE:
                client = get_redis()
                if client:
                    client.delete(key)

            self.metrics.record_delete()
            logger.debug("Cache delete", key=key)
            return True

        except Exception as e:
            self.metrics.record_error()
            logger.error("Cache delete error", key=key, error=str(e))
            return False

    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all cache keys matching pattern.

        Args:
            pattern: Pattern to match (e.g., "billing:product:*")

        Returns:
            Number of keys invalidated
        """
        count = 0
        try:
            # Clear from Redis
            if self.config.ENABLE_L2_CACHE:
                client = get_redis()
                if client:
                    keys = client.keys(pattern)
                    if keys:
                        count = client.delete(*keys)

            # Clear from memory caches
            if self.config.ENABLE_L1_CACHE:
                # Simple pattern matching for memory caches
                for cache in [self.product_cache, self.pricing_cache, self.subscription_cache]:
                    keys_to_delete = [k for k in cache.keys() if self._match_pattern(k, pattern)]
                    for k in keys_to_delete:
                        del cache[k]
                        count += 1

            logger.info("Cache invalidation", pattern=pattern, count=count)
            return count

        except Exception as e:
            logger.error("Cache invalidation error", pattern=pattern, error=str(e))
            return 0

    async def invalidate_by_tags(self, tags: list[str]) -> int:
        """
        Invalidate cache entries by tags.

        Args:
            tags: List of tags to invalidate

        Returns:
            Number of keys invalidated
        """
        count = 0
        for tag in tags:
            if tag in self.dependencies:
                for key in self.dependencies[tag]:
                    if await self.delete(key):
                        count += 1
                del self.dependencies[tag]
        return count

    def _get_from_memory(self, key: str) -> Any | None:
        """Get value from L1 memory cache."""
        # Check appropriate cache based on key prefix
        if "product" in key:
            return self.product_cache.get(key)
        elif "pricing" in key or "price" in key:
            return self.pricing_cache.get(key)
        elif "subscription" in key or "plan" in key:
            return self.subscription_cache.get(key)
        return None

    def _set_in_memory(self, key: str, value: Any) -> None:
        """Set value in L1 memory cache."""
        # Store in appropriate cache based on key prefix
        if "product" in key:
            self.product_cache[key] = value
        elif "pricing" in key or "price" in key:
            self.pricing_cache[key] = value
        elif "subscription" in key or "plan" in key:
            self.subscription_cache[key] = value

    def _delete_from_memory(self, key: str) -> None:
        """Delete value from L1 memory cache."""
        # Delete from appropriate cache based on key prefix
        for cache in [self.product_cache, self.pricing_cache, self.subscription_cache]:
            if key in cache:
                del cache[key]

    @staticmethod
    def _match_pattern(key: str, pattern: str) -> bool:
        """Simple pattern matching for cache keys."""
        import re

        # Convert wildcard pattern to regex
        regex_pattern = pattern.replace("*", ".*").replace("?", ".")
        return bool(re.match(regex_pattern, key))

    async def warm_cache(self, tenant_id: str) -> None:
        """
        Warm cache with frequently accessed data.

        Args:
            tenant_id: Tenant to warm cache for
        """
        if not self.config.ENABLE_CACHE_WARMING:
            return

        logger.info("Cache warming started", tenant_id=tenant_id)

        # This would typically load:
        # - Active products
        # - Current pricing rules
        # - Active subscription plans
        # - Recent subscriptions

        # Implementation would depend on actual service methods
        logger.info("Cache warming completed", tenant_id=tenant_id)

    def get_metrics(self) -> dict[str, Any]:
        """Get cache metrics and statistics."""
        metrics = self.metrics.get_stats()

        # Add cache sizes
        if self.config.ENABLE_L1_CACHE:
            metrics["l1_product_size"] = len(self.product_cache)
            metrics["l1_pricing_size"] = len(self.pricing_cache)
            metrics["l1_subscription_size"] = len(self.subscription_cache)

        # Add Redis info if available
        if self.config.ENABLE_L2_CACHE:
            client = get_redis()
            if client:
                try:
                    info = client.info("memory")
                    metrics["l2_memory_used"] = info.get("used_memory_human", "N/A")
                except Exception as exc:  # pragma: no cover - defensive logging
                    logger.warning("Failed to fetch Redis memory info", error=str(exc))

        return metrics


# Global cache instance
_billing_cache: BillingCache | None = None


def get_billing_cache() -> BillingCache:
    """Get global billing cache instance."""
    global _billing_cache
    if _billing_cache is None:
        _billing_cache = BillingCache()
    return _billing_cache


def cached_result(
    ttl: int | None = None,
    key_prefix: str = "",
    key_params: list[str] | None = None,
    tier: CacheTier = CacheTier.L2_REDIS,
) -> Any:
    """
    Decorator for caching function results.

    Args:
        ttl: Time to live in seconds
        key_prefix: Prefix for cache key
        key_params: Parameters to include in cache key
        tier: Cache tier to use

    Example:
        @cached_result(ttl=3600, key_prefix="product", key_params=["product_id", "tenant_id"])
        async def get_product(product_id: str, tenant_id: str):
            # Expensive database query
            return product
    """

    def decorator(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache = get_billing_cache()

            # Generate cache key
            if key_params:
                key_parts = [key_prefix]
                # Extract specified parameters
                import inspect

                sig = inspect.signature(func)
                bound_args = sig.bind(*args, **kwargs)
                bound_args.apply_defaults()

                for param in key_params:
                    if param in bound_args.arguments:
                        key_parts.append(str(bound_args.arguments[param]))
                cache_key = ":".join(key_parts)
            else:
                # Use function name and all args
                cache_key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}"

            # Try to get from cache
            result = await cache.get(cache_key, tier=tier)
            if result is not None:
                return result

            # Execute function
            result = await func(*args, **kwargs)

            # Cache result
            if result is not None:
                await cache.set(cache_key, result, ttl=ttl, tier=tier)

            return result

        # Explicitly set __wrapped__ for test access
        wrapper.__wrapped__ = func  # type: ignore[attr-defined]
        return wrapper

    return decorator


def invalidate_on_change(tags: list[str] | None = None, patterns: list[str] | None = None) -> Any:
    """
    Decorator to invalidate cache on data changes.

    Args:
        tags: Tags to invalidate
        patterns: Patterns to invalidate

    Example:
        @invalidate_on_change(patterns=["billing:product:*"])
        async def update_product(product_id: str, data: dict[str, Any]):
            # Update product
            return updated_product
    """

    def decorator(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Execute function
            result = await func(*args, **kwargs)

            # Invalidate cache
            cache = get_billing_cache()

            if tags:
                await cache.invalidate_by_tags(tags)

            if patterns:
                for pattern in patterns:
                    await cache.invalidate_pattern(pattern)

            return result

        return wrapper

    return decorator
