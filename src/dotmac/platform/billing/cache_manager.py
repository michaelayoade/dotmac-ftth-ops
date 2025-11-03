"""
Cache management and invalidation strategies for the billing module.

Provides centralized cache management with intelligent invalidation,
monitoring, and maintenance capabilities.
"""

import asyncio
from datetime import UTC, datetime
from enum import Enum
from typing import Any

import structlog

from dotmac.platform.billing.cache import (
    BillingCache,
    BillingCacheConfig,
    get_billing_cache,
)
from dotmac.platform.billing.cache_handlers import (
    BulkImportHandler,
    CachePatternHandler,
    PlanCreatedHandler,
    PlanUpdatedHandler,
    PricingRuleCreatedHandler,
    PricingRuleDeletedHandler,
    PricingRuleUpdatedHandler,
    ProductCreatedHandler,
    ProductDeletedHandler,
    ProductUpdatedHandler,
    SubscriptionCanceledHandler,
    SubscriptionCreatedHandler,
    SubscriptionUpdatedHandler,
)

logger = structlog.get_logger(__name__)


class InvalidationStrategy(str, Enum):
    """Cache invalidation strategies."""

    IMMEDIATE = "immediate"  # Invalidate immediately
    LAZY = "lazy"  # Invalidate on next access
    SCHEDULED = "scheduled"  # Invalidate at scheduled time
    TTL_BASED = "ttl_based"  # Let TTL handle expiration


class CacheEvent(str, Enum):
    """Cache-related events for tracking."""

    PRODUCT_CREATED = "product_created"
    PRODUCT_UPDATED = "product_updated"
    PRODUCT_DELETED = "product_deleted"
    PRICING_RULE_CREATED = "pricing_rule_created"
    PRICING_RULE_UPDATED = "pricing_rule_updated"
    PRICING_RULE_DELETED = "pricing_rule_deleted"
    SUBSCRIPTION_CREATED = "subscription_created"
    SUBSCRIPTION_UPDATED = "subscription_updated"
    SUBSCRIPTION_CANCELED = "subscription_canceled"
    PLAN_CREATED = "plan_created"
    PLAN_UPDATED = "plan_updated"
    BULK_IMPORT = "bulk_import"


class BillingCacheManager:
    """
    Centralized cache manager for billing module.

    Features:
    - Smart invalidation based on data dependencies
    - Cache health monitoring
    - Automatic maintenance and cleanup
    - Performance metrics tracking
    """

    def __init__(self) -> None:
        self.cache: BillingCache = get_billing_cache()
        self.config = BillingCacheConfig()
        self.invalidation_queue: list[dict[str, Any]] = []
        self.dependency_map: dict[str, set[str]] = {}
        self._init_dependency_map()

        # Register pattern handlers for cache invalidation
        self._pattern_handlers: dict[CacheEvent, CachePatternHandler] = {
            CacheEvent.PRODUCT_CREATED: ProductCreatedHandler(),
            CacheEvent.PRODUCT_UPDATED: ProductUpdatedHandler(),
            CacheEvent.PRODUCT_DELETED: ProductDeletedHandler(),
            CacheEvent.PRICING_RULE_CREATED: PricingRuleCreatedHandler(),
            CacheEvent.PRICING_RULE_UPDATED: PricingRuleUpdatedHandler(),
            CacheEvent.PRICING_RULE_DELETED: PricingRuleDeletedHandler(),
            CacheEvent.SUBSCRIPTION_CREATED: SubscriptionCreatedHandler(),
            CacheEvent.SUBSCRIPTION_UPDATED: SubscriptionUpdatedHandler(),
            CacheEvent.SUBSCRIPTION_CANCELED: SubscriptionCanceledHandler(),
            CacheEvent.PLAN_CREATED: PlanCreatedHandler(),
            CacheEvent.PLAN_UPDATED: PlanUpdatedHandler(),
            CacheEvent.BULK_IMPORT: BulkImportHandler(),
        }

    def _init_dependency_map(self) -> None:
        """Initialize cache dependency mappings."""
        # Define which cache types depend on others
        self.dependency_map = {
            # Product changes affect pricing and subscriptions
            "product": {"pricing", "price_calculation", "subscription"},
            # Pricing rule changes affect price calculations
            "pricing_rule": {"price_calculation"},
            # Plan changes affect subscriptions
            "plan": {"subscription"},
            # Category changes affect products
            "category": {"product", "pricing"},
        }

    async def handle_cache_event(
        self,
        event: CacheEvent,
        tenant_id: str,
        entity_id: str | None = None,
        strategy: InvalidationStrategy = InvalidationStrategy.IMMEDIATE,
        **kwargs: Any,
    ) -> None:
        """
        Handle a cache-affecting event with appropriate invalidation.

        Args:
            event: Type of cache event
            tenant_id: Affected tenant
            entity_id: ID of affected entity
            strategy: Invalidation strategy to use
            **kwargs: Additional event context
        """
        logger.info(
            "Handling cache event",
            cache_event=event.value,
            tenant_id=tenant_id,
            entity_id=entity_id,
            strategy=strategy.value,
        )

        if strategy == InvalidationStrategy.IMMEDIATE:
            await self._immediate_invalidation(event, tenant_id, entity_id, **kwargs)
        elif strategy == InvalidationStrategy.LAZY:
            await self._mark_for_lazy_invalidation(event, tenant_id, entity_id)
        elif strategy == InvalidationStrategy.SCHEDULED:
            await self._schedule_invalidation(event, tenant_id, entity_id, **kwargs)
        # TTL_BASED doesn't require action - let TTL handle it

    async def _immediate_invalidation(
        self, event: CacheEvent, tenant_id: str, entity_id: str | None, **kwargs: Any
    ) -> None:
        """Perform immediate cache invalidation based on event."""
        handler = self._pattern_handlers.get(event)
        if not handler:
            logger.warning("No handler for cache event", cache_event=event.value)
            return

        # Get patterns from handler
        patterns_to_clear = handler.get_patterns(tenant_id, entity_id, **kwargs)

        # Clear cache patterns
        total_cleared = await self._clear_cache_patterns(patterns_to_clear)

        logger.info(
            "Cache invalidation completed",
            cache_event=event.value,
            tenant_id=tenant_id,
            patterns_cleared=len(patterns_to_clear),
            total_keys_cleared=total_cleared,
        )

    async def _clear_cache_patterns(self, patterns: list[str]) -> int:
        """
        Clear all cache entries matching the given patterns.

        Args:
            patterns: List of cache key patterns to invalidate

        Returns:
            Total number of cache entries cleared
        """
        total_cleared = 0
        for pattern in patterns:
            count = await self.cache.invalidate_pattern(pattern)
            total_cleared += count
        return total_cleared

    async def _mark_for_lazy_invalidation(
        self, event: CacheEvent, tenant_id: str, entity_id: str | None
    ) -> None:
        """Mark cache entries for lazy invalidation."""
        # Add to invalidation queue for processing
        self.invalidation_queue.append(
            {
                "event": event,
                "tenant_id": tenant_id,
                "entity_id": entity_id,
                "timestamp": datetime.now(UTC),
            }
        )

        # Process queue if it gets too large
        if len(self.invalidation_queue) > 100:
            await self.process_invalidation_queue()

    async def _schedule_invalidation(
        self, event: CacheEvent, tenant_id: str, entity_id: str | None, delay_seconds: int = 60
    ) -> None:
        """Schedule cache invalidation for later execution."""

        async def delayed_invalidation() -> None:
            await asyncio.sleep(delay_seconds)
            await self._immediate_invalidation(event, tenant_id, entity_id)

        # Create task for delayed invalidation
        asyncio.create_task(delayed_invalidation())

    async def process_invalidation_queue(self) -> None:
        """Process queued invalidation requests."""
        if not self.invalidation_queue:
            return

        logger.info("Processing invalidation queue", queue_size=len(self.invalidation_queue))

        # Process all queued invalidations
        while self.invalidation_queue:
            item = self.invalidation_queue.pop(0)
            await self._immediate_invalidation(
                item["event"], item["tenant_id"], item.get("entity_id")
            )

    async def cascade_invalidation(
        self, cache_type: str, tenant_id: str, entity_id: str | None = None
    ) -> None:
        """
        Cascade cache invalidation based on dependencies.

        When one cache type is invalidated, also invalidate
        dependent cache types.
        """
        # Get dependent cache types
        dependent_types = self.dependency_map.get(cache_type, set())

        patterns_to_clear = []

        # Clear the primary cache type
        if cache_type == "product" and entity_id:
            patterns_to_clear.append(f"billing:product:{tenant_id}:{entity_id}")
        elif cache_type == "pricing_rule" and entity_id:
            patterns_to_clear.append(f"billing:pricing:rule:{tenant_id}:{entity_id}")

        # Clear dependent cache types
        for dep_type in dependent_types:
            if dep_type == "price_calculation":
                patterns_to_clear.append(f"billing:price:{tenant_id}:*")
            elif dep_type == "pricing":
                patterns_to_clear.append(f"billing:pricing:*:{tenant_id}:*")
            elif dep_type == "subscription":
                patterns_to_clear.append(f"billing:subscription:{tenant_id}:*")

        # Perform invalidation
        for pattern in patterns_to_clear:
            await self.cache.invalidate_pattern(pattern)

        logger.info(
            "Cascade invalidation completed",
            cache_type=cache_type,
            tenant_id=tenant_id,
            dependent_types=list(dependent_types),
            patterns_cleared=len(patterns_to_clear),
        )

    async def perform_cache_maintenance(self) -> Any:
        """
        Perform routine cache maintenance tasks.

        Should be called periodically (e.g., every hour) to:
        - Clean up expired entries
        - Collect metrics
        - Optimize cache storage
        """
        logger.info("Starting cache maintenance")

        metrics_before = self.cache.get_metrics()

        # Process any pending invalidations
        await self.process_invalidation_queue()

        # Get metrics after maintenance
        metrics_after = self.cache.get_metrics()

        logger.info(
            "Cache maintenance completed",
            metrics_before=metrics_before,
            metrics_after=metrics_after,
        )

        return {
            "before": metrics_before,
            "after": metrics_after,
            "invalidation_queue_processed": len(self.invalidation_queue) == 0,
        }

    async def warm_cache_for_tenant(self, tenant_id: str) -> Any:
        """
        Warm cache for a specific tenant.

        Preloads frequently accessed data to improve performance.
        """
        logger.info("Starting cache warming", tenant_id=tenant_id)

        results = {}

        # Warm product cache
        try:
            from dotmac.platform.billing.catalog.cached_service import CachedProductService
            from dotmac.platform.db import get_async_session

            async for session in get_async_session():
                product_service = CachedProductService(session)
                product_count = await product_service.warm_product_cache(tenant_id)
                results["products"] = product_count
                break
        except Exception as e:
            logger.error("Failed to warm product cache", error=str(e))
            results["products"] = 0

        # Warm pricing cache
        try:
            from dotmac.platform.billing.pricing.cached_service import CachedPricingEngine
            from dotmac.platform.db import get_async_session

            async for session in get_async_session():
                pricing_engine = CachedPricingEngine(session)
                pricing_count = await pricing_engine.warm_pricing_cache(tenant_id)
                results["pricing_rules"] = pricing_count
                break
        except Exception as e:
            logger.error("Failed to warm pricing cache", error=str(e))
            results["pricing_rules"] = 0

        logger.info("Cache warming completed", tenant_id=tenant_id, results=results)

        return results

    async def clear_tenant_cache(self, tenant_id: str) -> int:
        """
        Clear all cache entries for a specific tenant.

        Useful for:
        - Tenant offboarding
        - Major data updates
        - Troubleshooting
        """
        logger.warning("Clearing all cache for tenant", tenant_id=tenant_id)

        # Clear all billing cache patterns for this tenant
        patterns = [
            f"billing:*:{tenant_id}:*",
            f"billing:*:*:{tenant_id}:*",
        ]

        total_cleared = 0
        for pattern in patterns:
            count = await self.cache.invalidate_pattern(pattern)
            total_cleared += count

        logger.info("Tenant cache cleared", tenant_id=tenant_id, total_cleared=total_cleared)

        return total_cleared

    def get_cache_health(self) -> dict[str, Any]:
        """
        Get cache health metrics for monitoring.

        Returns:
            Dictionary with health metrics
        """
        metrics = self.cache.get_metrics()

        # Calculate health score
        hit_rate = metrics.get("hit_rate", 0)
        error_rate = (
            metrics.get("errors", 0) / max(1, metrics.get("hits", 0) + metrics.get("misses", 0))
        ) * 100

        health_score = 100
        if hit_rate < 50:
            health_score -= 25
        if hit_rate < 25:
            health_score -= 25
        if error_rate > 5:
            health_score -= 25
        if error_rate > 10:
            health_score -= 25

        return {
            "health_score": max(0, health_score),
            "hit_rate": hit_rate,
            "error_rate": error_rate,
            "total_operations": metrics.get("hits", 0) + metrics.get("misses", 0),
            "pending_invalidations": len(self.invalidation_queue),
            "l1_cache_sizes": {
                "products": metrics.get("l1_product_size", 0),
                "pricing": metrics.get("l1_pricing_size", 0),
                "subscriptions": metrics.get("l1_subscription_size", 0),
            },
            "status": (
                "healthy"
                if health_score >= 75
                else "degraded"
                if health_score >= 50
                else "unhealthy"
            ),
        }


# Global cache manager instance
_cache_manager: BillingCacheManager | None = None


def get_cache_manager() -> BillingCacheManager:
    """Get global cache manager instance."""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = BillingCacheManager()
    return _cache_manager


async def setup_cache_maintenance_task() -> None:
    """
    Set up periodic cache maintenance task.

    Should be called during application startup.
    """
    cache_manager = get_cache_manager()

    async def maintenance_loop() -> None:
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                await cache_manager.perform_cache_maintenance()
            except Exception as e:
                logger.error("Cache maintenance failed", error=str(e))

    asyncio.create_task(maintenance_loop())
    logger.info("Cache maintenance task scheduled")
