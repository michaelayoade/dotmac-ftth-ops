"""
Cache invalidation pattern handlers for billing module.

Each handler defines cache invalidation patterns for specific events,
implementing the Strategy Pattern for cleaner code organization.
"""

from abc import ABC, abstractmethod
from typing import Any


class CachePatternHandler(ABC):
    """Base handler for cache invalidation patterns."""

    @abstractmethod
    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        """
        Return cache patterns to invalidate for this event.

        Args:
            tenant_id: Tenant ID
            entity_id: Entity ID (optional)
            **kwargs: Additional context (customer_id, etc.)

        Returns:
            List of cache key patterns to invalidate
        """
        raise NotImplementedError


class ProductCreatedHandler(CachePatternHandler):
    """Handle cache invalidation when product is created."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        # Clear product lists
        return [f"billing:products:{tenant_id}:*"]


class ProductUpdatedHandler(CachePatternHandler):
    """Handle cache invalidation when product is updated."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        if not entity_id:
            return []

        # Clear specific product, product lists, and related prices
        return [
            f"billing:product:{tenant_id}:{entity_id}",
            f"billing:products:{tenant_id}:*",
            f"billing:price:{tenant_id}:{entity_id}:*",
        ]


class ProductDeletedHandler(CachePatternHandler):
    """Handle cache invalidation when product is deleted."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        if not entity_id:
            return []

        # Clear everything related to this product
        return [
            f"billing:product:{tenant_id}:{entity_id}",
            f"billing:product:sku:{tenant_id}:*",
            f"billing:products:{tenant_id}:*",
            f"billing:price:{tenant_id}:{entity_id}:*",
        ]


class PricingRuleCreatedHandler(CachePatternHandler):
    """Handle cache invalidation when pricing rule is created."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        # Clear pricing rule lists and all price calculations
        return [
            f"billing:pricing:rules:{tenant_id}:*",
            f"billing:price:{tenant_id}:*",
        ]


class PricingRuleUpdatedHandler(CachePatternHandler):
    """Handle cache invalidation when pricing rule is updated."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        if not entity_id:
            return []

        # Clear specific rule, rule lists, and all price calculations
        return [
            f"billing:pricing:rule:{tenant_id}:{entity_id}",
            f"billing:pricing:rules:{tenant_id}:*",
            f"billing:price:{tenant_id}:*",
        ]


class PricingRuleDeletedHandler(CachePatternHandler):
    """Handle cache invalidation when pricing rule is deleted."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        # Same as updated - clear rules and calculations
        return PricingRuleUpdatedHandler().get_patterns(tenant_id, entity_id, **kwargs)


class SubscriptionCreatedHandler(CachePatternHandler):
    """Handle cache invalidation when subscription is created."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        customer_id = kwargs.get("customer_id")
        if not customer_id:
            return []

        # Clear subscription lists for this customer
        return [f"billing:subscriptions:customer:{tenant_id}:{customer_id}"]


class SubscriptionUpdatedHandler(CachePatternHandler):
    """Handle cache invalidation when subscription is updated."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        if not entity_id:
            return []

        # Clear specific subscription and customer subscription lists
        return [
            f"billing:subscription:{tenant_id}:{entity_id}",
            f"billing:subscriptions:customer:{tenant_id}:*",
        ]


class SubscriptionCanceledHandler(CachePatternHandler):
    """Handle cache invalidation when subscription is canceled."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        # Same as updated
        return SubscriptionUpdatedHandler().get_patterns(tenant_id, entity_id, **kwargs)


class PlanCreatedHandler(CachePatternHandler):
    """Handle cache invalidation when plan is created."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        # Clear plan lists
        return [f"billing:plans:{tenant_id}:*"]


class PlanUpdatedHandler(CachePatternHandler):
    """Handle cache invalidation when plan is updated."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        patterns = [f"billing:plans:{tenant_id}:*"]

        if entity_id:
            # Also clear specific plan
            patterns.append(f"billing:plan:{tenant_id}:{entity_id}")

        return patterns


class BulkImportHandler(CachePatternHandler):
    """Handle cache invalidation for bulk import operations."""

    def get_patterns(
        self, tenant_id: str, entity_id: str | None = None, **kwargs: Any
    ) -> list[str]:
        # Clear all caches for this tenant
        return [f"billing:*:{tenant_id}:*"]
