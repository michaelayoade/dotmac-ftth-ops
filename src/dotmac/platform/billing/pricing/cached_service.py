"""
Cached pricing engine for high-performance price calculations.

Caches pricing rules and calculation results to minimize database queries
and improve response times for frequent pricing operations.
"""

from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.cache import (
    BillingCache,
    BillingCacheConfig,
    CacheKey,
    CacheTier,
    get_billing_cache,
)
from dotmac.platform.billing.pricing.models import (
    PriceCalculationContext,
    PriceCalculationRequest,
    PriceCalculationResult,
    PricingRule,
    PricingRuleCreateRequest,
    PricingRuleUpdateRequest,
)
from dotmac.platform.billing.pricing.service import PricingEngine

logger = structlog.get_logger(__name__)


class CachedPricingEngine(PricingEngine):  # type: ignore[misc]  # PricingEngine resolves to Any in isolation
    """
    Pricing engine with intelligent caching for improved performance.

    Features:
    - Caches pricing rules per tenant/product
    - Caches price calculation results
    - Smart invalidation on rule changes
    - Batch operations optimization
    """

    def __init__(
        self,
        db_session: AsyncSession,
        cache: BillingCache | None = None,
        config: BillingCacheConfig | None = None,
    ) -> None:
        super().__init__(db_session)
        self.cache = cache or get_billing_cache()
        self.config = config or BillingCacheConfig()

    async def get_pricing_rule(self, rule_id: str, tenant_id: str) -> PricingRule:
        """
        Get pricing rule with caching.

        Cache strategy:
        - TTL: 30 minutes (configurable)
        - Invalidated on rule updates
        """
        cache_key = CacheKey.pricing_rule(rule_id, tenant_id)

        # Try cache first
        try:
            cached_rule = await self.cache.get(cache_key)
            if cached_rule:
                logger.debug(
                    "Pricing rule retrieved from cache", rule_id=rule_id, tenant_id=tenant_id
                )
                return PricingRule.model_validate(cached_rule)
        except Exception as e:
            logger.warning("Cache get failed, falling back to database", error=str(e))

        # Load from database
        rule = await super().get_pricing_rule(rule_id, tenant_id)

        # Cache the result
        try:
            await self.cache.set(
                cache_key,
                rule.model_dump(),
                ttl=self.config.PRICING_RULE_TTL,
                tags=[f"tenant:{tenant_id}", f"pricing_rule:{rule_id}"],
            )
        except Exception as e:
            logger.warning("Cache set failed", error=str(e))

        return rule

    async def list_pricing_rules(
        self,
        tenant_id: str,
        active_only: bool = True,
        product_id: str | None = None,
        category: str | None = None,
    ) -> list[PricingRule]:
        """
        List pricing rules with caching for common queries.

        Cache strategy:
        - Cache by tenant and product combination
        - Shorter TTL for list operations
        """
        # Generate cache key
        cache_key = CacheKey.pricing_rules(tenant_id, product_id)

        # Add filters to cache key
        if category:
            cache_key += f":{category}"
        if active_only:
            cache_key += ":active"

        # Try cache first
        cached_rules = await self.cache.get(cache_key)
        if cached_rules:
            logger.debug(
                "Pricing rules retrieved from cache", tenant_id=tenant_id, product_id=product_id
            )
            return [PricingRule.model_validate(r) for r in cached_rules]

        # Load from database
        rules: list[PricingRule] = await super().list_pricing_rules(
            tenant_id, active_only=active_only, product_id=product_id, category=category
        )

        # Cache the result
        if rules:
            await self.cache.set(
                cache_key,
                [r.model_dump() for r in rules],
                ttl=self.config.PRICING_RULE_TTL,
                tags=[f"tenant:{tenant_id}", "pricing_rules"],
            )

        return rules

    async def calculate_price(
        self, request: PriceCalculationRequest, tenant_id: str, use_cache: bool = True
    ) -> PriceCalculationResult:
        """
        Calculate price with result caching.

        Cache strategy:
        - Cache calculation results for identical requests
        - Very short TTL (5 minutes) as prices may change frequently
        - Can be disabled for real-time pricing needs
        """
        base_key = CacheKey.price_calculation(
            request.product_id, request.quantity, request.customer_id, tenant_id
        )
        calculation_marker = (
            request.calculation_date.isoformat() if request.calculation_date else "now"
        )
        cache_hash = CacheKey.generate_hash(
            {
                "segments": sorted(request.customer_segments),
                "calculation": calculation_marker,
            }
        )
        cache_key = f"{base_key}:{cache_hash}"

        if use_cache:
            cached_result = await self.cache.get(cache_key, tier=CacheTier.L1_MEMORY)
            if cached_result:
                logger.debug(
                    "Price calculation retrieved from cache",
                    product_id=request.product_id,
                    quantity=request.quantity,
                    customer_id=request.customer_id,
                )
                return PriceCalculationResult.model_validate(cached_result)

        result = await super().calculate_price(request, tenant_id)

        if use_cache:
            await self.cache.set(
                cache_key,
                result.model_dump(),
                ttl=300,
                tier=CacheTier.L1_MEMORY,
                tags=[
                    f"tenant:{tenant_id}",
                    f"product:{request.product_id}",
                    f"customer:{request.customer_id}",
                ],
            )

        return result

    async def create_pricing_rule(
        self, rule_data: PricingRuleCreateRequest, tenant_id: str
    ) -> PricingRule:
        """
        Create pricing rule and invalidate relevant caches.
        """
        # Create rule
        rule = await super().create_pricing_rule(rule_data, tenant_id)

        # Invalidate pricing rules caches for this tenant
        await self.cache.invalidate_pattern(f"billing:pricing:rules:{tenant_id}:*")

        # Invalidate price calculations that might be affected
        if rule.applies_to_all:
            # Clear all price calculations for this tenant
            await self.cache.invalidate_pattern(f"billing:price:{tenant_id}:*")
        elif rule.applies_to_product_ids:
            # Clear calculations for specific products
            for product_id in rule.applies_to_product_ids:
                await self.cache.invalidate_pattern(f"billing:price:{tenant_id}:{product_id}:*")

        # Cache the new rule
        cache_key = CacheKey.pricing_rule(rule.rule_id, tenant_id)
        await self.cache.set(
            cache_key,
            rule.model_dump(),
            ttl=self.config.PRICING_RULE_TTL,
            tags=[f"tenant:{tenant_id}", f"pricing_rule:{rule.rule_id}"],
        )

        logger.info(
            "Pricing rule created and cache updated", rule_id=rule.rule_id, tenant_id=tenant_id
        )

        return rule

    async def update_pricing_rule(
        self, rule_id: str, updates: PricingRuleUpdateRequest, tenant_id: str
    ) -> PricingRule:
        """
        Update pricing rule and refresh caches.
        """
        # Update rule
        rule = await super().update_pricing_rule(rule_id, updates, tenant_id)

        # Clear rule cache
        cache_key = CacheKey.pricing_rule(rule_id, tenant_id)
        await self.cache.delete(cache_key)

        # Invalidate rules list caches
        await self.cache.invalidate_pattern(f"billing:pricing:rules:{tenant_id}:*")

        # Invalidate affected price calculations
        if rule.applies_to_all:
            await self.cache.invalidate_pattern(f"billing:price:{tenant_id}:*")
        elif rule.applies_to_product_ids:
            for product_id in rule.applies_to_product_ids:
                await self.cache.invalidate_pattern(f"billing:price:{tenant_id}:{product_id}:*")

        # Cache updated rule
        await self.cache.set(
            cache_key,
            rule.model_dump(),
            ttl=self.config.PRICING_RULE_TTL,
            tags=[f"tenant:{tenant_id}", f"pricing_rule:{rule_id}"],
        )

        logger.info(
            "Pricing rule updated and cache refreshed", rule_id=rule_id, tenant_id=tenant_id
        )

        return rule

    async def delete_pricing_rule(self, rule_id: str, tenant_id: str) -> None:
        """
        Delete pricing rule and clear all related caches.

        This performs a hard delete and invalidates:
        - The specific rule cache
        - All pricing rules list caches for the tenant
        - All affected price calculation caches
        """
        # Get the rule before deleting to know what caches to invalidate
        try:
            rule = await self.get_pricing_rule(rule_id, tenant_id)
        except Exception:
            # Rule doesn't exist, let parent handle the error
            await super().delete_pricing_rule(rule_id, tenant_id)
            return

        # Delete from database
        await super().delete_pricing_rule(rule_id, tenant_id)

        # Clear rule cache
        cache_key = CacheKey.pricing_rule(rule_id, tenant_id)
        await self.cache.delete(cache_key)

        # Invalidate rules list caches
        await self.cache.invalidate_pattern(f"billing:pricing:rules:{tenant_id}:*")

        # Invalidate affected price calculations
        if rule.applies_to_all:
            await self.cache.invalidate_pattern(f"billing:price:{tenant_id}:*")
        elif rule.applies_to_product_ids:
            for product_id in rule.applies_to_product_ids:
                await self.cache.invalidate_pattern(f"billing:price:{tenant_id}:{product_id}:*")

        # Also invalidate applicable rules cache
        await self.cache.invalidate_pattern(f"billing:pricing:applicable:{tenant_id}:*")

        logger.info("Pricing rule deleted and caches cleared", rule_id=rule_id, tenant_id=tenant_id)

    async def _get_applicable_rules(
        self, context: PriceCalculationContext, tenant_id: str
    ) -> list[PricingRule]:
        """Return applicable rules using cached lookups when possible."""

        context_hash = CacheKey.generate_hash(
            {
                "product": context.product_id,
                "quantity": context.quantity,
                "segments": sorted(context.customer_segments),
                "category": context.product_category or "",
                "date": context.calculation_date.isoformat(),
            }
        )
        cache_key = f"billing:pricing:applicable:{tenant_id}:{context_hash}"

        cached_rules = await self.cache.get(cache_key, tier=CacheTier.L1_MEMORY)
        if cached_rules:
            return [PricingRule.model_validate(rule) for rule in cached_rules]

        rules: list[PricingRule] = await super()._get_applicable_rules(context, tenant_id)

        if rules:
            await self.cache.set(
                cache_key,
                [rule.model_dump() for rule in rules],
                ttl=300,
                tier=CacheTier.L1_MEMORY,
                tags=[f"tenant:{tenant_id}", f"product:{context.product_id}"],
            )

        return rules

    async def warm_pricing_cache(self, tenant_id: str) -> Any:
        """
        Pre-load frequently used pricing rules into cache.
        """
        logger.info("Warming pricing cache", tenant_id=tenant_id)

        # Load all active pricing rules
        rules = await super().list_pricing_rules(tenant_id, active_only=True)

        cached_count = 0
        for rule in rules:
            cache_key = CacheKey.pricing_rule(rule.rule_id, tenant_id)
            await self.cache.set(
                cache_key,
                rule.model_dump(),
                ttl=self.config.PRICING_RULE_TTL,
                tags=[f"tenant:{tenant_id}", f"pricing_rule:{rule.rule_id}"],
            )
            cached_count += 1

        logger.info("Pricing cache warmed", tenant_id=tenant_id, cached_count=cached_count)

        return cached_count
