"""
Cached product catalog service for improved performance.

Extends the base ProductService with intelligent caching strategies
to minimize database queries and improve response times.
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
from dotmac.platform.billing.catalog.models import (
    Product,
    ProductCreateRequest,
    ProductFilters,
    ProductUpdateRequest,
)
from dotmac.platform.billing.catalog.service import ProductService
from dotmac.platform.billing.exceptions import (
    ProductNotFoundError,
)

logger = structlog.get_logger(__name__)


class CachedProductService(ProductService):  # type: ignore[misc]  # ProductService resolves to Any in isolation
    """
    Product service with integrated caching for improved performance.

    Features:
    - Multi-tier caching (L1 memory, L2 Redis)
    - Automatic cache invalidation on updates
    - Cache warming for frequently accessed data
    - Bulk operations optimization
    """

    def __init__(self, db_session: AsyncSession) -> None:
        super().__init__(db_session)
        self.cache: BillingCache = get_billing_cache()
        self.config = BillingCacheConfig()

    async def get_product(self, product_id: str, tenant_id: str) -> Product:
        """
        Get product by ID with caching.

        Cache strategy:
        - L1 memory cache for ultra-fast access
        - L2 Redis cache for distributed caching
        - Cache TTL: 1 hour (configurable)
        """
        cache_key = CacheKey.product(product_id, tenant_id)

        # Try to get from cache first
        cached_product = await self.cache.get(cache_key, tier=CacheTier.L2_REDIS)

        if cached_product:
            logger.debug("Product retrieved from cache", product_id=product_id, tenant_id=tenant_id)
            return Product.model_validate(cached_product)

        # Load from database
        product = await super().get_product(product_id, tenant_id)

        # Cache the result
        await self.cache.set(
            cache_key,
            product.model_dump(),
            ttl=self.config.PRODUCT_TTL,
            tags=[f"tenant:{tenant_id}", f"product:{product_id}"],
        )

        return product

    async def get_product_by_sku(self, sku: str, tenant_id: str) -> Product | None:
        """
        Get product by SKU with caching.

        SKU lookups are frequent, so we cache them separately.
        """
        normalized_sku = sku.strip().upper()
        cache_key = CacheKey.product_by_sku(normalized_sku, tenant_id)

        # Try cache first
        cached_product = await self.cache.get(cache_key)

        if cached_product:
            logger.debug(
                "Product retrieved from cache by SKU",
                sku=normalized_sku,
                tenant_id=tenant_id,
            )
            return Product.model_validate(cached_product)

        # Load from database
        product = await super().get_product_by_sku(sku, tenant_id)

        if product:
            # Cache by SKU
            await self.cache.set(
                cache_key,
                product.model_dump(),
                ttl=self.config.PRODUCT_TTL,
                tags=[f"tenant:{tenant_id}", f"sku:{normalized_sku}"],
            )

            # Also cache by product ID for consistency
            product_cache_key = CacheKey.product(product.product_id, tenant_id)
            await self.cache.set(
                product_cache_key,
                product.model_dump(),
                ttl=self.config.PRODUCT_TTL,
                tags=[f"tenant:{tenant_id}", f"product:{product.product_id}"],
            )

        return product

    async def list_products(
        self,
        tenant_id: str,
        filters: ProductFilters | None = None,
        page: int = 1,
        limit: int = 50,
        cache_result: bool = True,
    ) -> list[Product]:
        """
        List products with caching for common queries.

        Cache strategy:
        - Cache results for common filter combinations
        - Shorter TTL (30 minutes) for list operations
        - Skip cache for large result sets
        """
        # Generate cache key from filters
        filters_dict = filters.model_dump() if filters else {}
        filters_dict["page"] = page
        filters_dict["limit"] = limit
        filters_hash = CacheKey.generate_hash(filters_dict)
        cache_key = CacheKey.product_list(tenant_id, filters_hash)

        # Check if we should use cache
        if cache_result and limit <= 100:  # Only cache reasonable result sets
            cached_list = await self.cache.get(cache_key)
            if cached_list:
                logger.debug(
                    "Product list retrieved from cache",
                    tenant_id=tenant_id,
                    filters_hash=filters_hash,
                )
                return [Product.model_validate(p) for p in cached_list]

        # Load from database
        products: list[Product] = await super().list_products(tenant_id, filters, page, limit)

        # Cache the result if appropriate
        if cache_result and limit <= 100 and len(products) > 0:
            await self.cache.set(
                cache_key,
                [p.model_dump() for p in products],
                ttl=1800,  # 30 minutes for list operations
                tags=[f"tenant:{tenant_id}", "product_list"],
            )

        return products

    async def create_product(self, product_data: ProductCreateRequest, tenant_id: str) -> Product:
        """
        Create product and invalidate relevant caches.
        """
        # Create product
        product = await super().create_product(product_data, tenant_id)

        # Invalidate list caches for this tenant
        await self.cache.invalidate_pattern(f"billing:products:{tenant_id}:*")

        # Cache the new product
        cache_key = CacheKey.product(product.product_id, tenant_id)
        await self.cache.set(
            cache_key,
            product.model_dump(),
            ttl=self.config.PRODUCT_TTL,
            tags=[f"tenant:{tenant_id}", f"product:{product.product_id}"],
        )

        # Cache by SKU as well
        sku_cache_key = CacheKey.product_by_sku(product.sku, tenant_id)
        await self.cache.set(
            sku_cache_key,
            product.model_dump(),
            ttl=self.config.PRODUCT_TTL,
            tags=[f"tenant:{tenant_id}", f"sku:{product.sku}"],
        )

        logger.info(
            "Product created and cached",
            product_id=product.product_id,
            sku=product.sku,
            tenant_id=tenant_id,
        )

        return product

    async def update_product(
        self, product_id: str, updates: ProductUpdateRequest, tenant_id: str
    ) -> Product:
        """
        Update product and invalidate caches.
        """
        # Get current product for SKU tracking
        current_product = await self.get_product(product_id, tenant_id)

        # Update product
        product = await super().update_product(product_id, updates, tenant_id)

        # Invalidate old caches
        cache_key = CacheKey.product(product_id, tenant_id)
        await self.cache.delete(cache_key)

        # Invalidate old SKU cache if SKU changed
        # Note: sku is not in ProductUpdateRequest, so this code is unreachable
        # Keeping for future compatibility if SKU updates are added
        if hasattr(updates, "sku") and updates.sku and updates.sku != current_product.sku:
            old_sku_key = CacheKey.product_by_sku(current_product.sku, tenant_id)
            await self.cache.delete(old_sku_key)

        # Invalidate list caches
        await self.cache.invalidate_pattern(f"billing:products:{tenant_id}:*")

        # Cache updated product
        await self.cache.set(
            cache_key,
            product.model_dump(),
            ttl=self.config.PRODUCT_TTL,
            tags=[f"tenant:{tenant_id}", f"product:{product_id}"],
        )

        # Cache by new SKU
        sku_cache_key = CacheKey.product_by_sku(product.sku, tenant_id)
        await self.cache.set(
            sku_cache_key,
            product.model_dump(),
            ttl=self.config.PRODUCT_TTL,
            tags=[f"tenant:{tenant_id}", f"sku:{product.sku}"],
        )

        logger.info(
            "Product updated and cache refreshed", product_id=product_id, tenant_id=tenant_id
        )

        return product

    async def deactivate_product(self, product_id: str, tenant_id: str) -> Product:
        """
        Deactivate product and clear caches.
        """
        # Deactivate product
        product = await super().deactivate_product(product_id, tenant_id)

        # Clear all caches for this product
        cache_key = CacheKey.product(product_id, tenant_id)
        await self.cache.delete(cache_key)

        sku_cache_key = CacheKey.product_by_sku(product.sku, tenant_id)
        await self.cache.delete(sku_cache_key)

        # Invalidate list caches
        await self.cache.invalidate_pattern(f"billing:products:{tenant_id}:*")

        logger.info(
            "Product deactivated and cache cleared", product_id=product_id, tenant_id=tenant_id
        )

        return product

    async def bulk_get_products(self, product_ids: list[str], tenant_id: str) -> list[Product]:
        """
        Efficiently get multiple products with caching.

        Optimizations:
        - Check cache for each product first
        - Batch database query for missing products
        - Cache all retrieved products
        """
        products = []
        missing_ids = []

        # Check cache for each product
        for product_id in product_ids:
            cache_key = CacheKey.product(product_id, tenant_id)
            cached_product = await self.cache.get(cache_key)

            if cached_product:
                products.append(Product.model_validate(cached_product))
            else:
                missing_ids.append(product_id)

        # Batch load missing products from database
        if missing_ids:
            logger.debug(
                "Loading products from database", count=len(missing_ids), tenant_id=tenant_id
            )

            # This would need to be implemented in base service
            # For now, load individually
            for product_id in missing_ids:
                try:
                    product = await super().get_product(product_id, tenant_id)
                    products.append(product)

                    # Cache the loaded product
                    cache_key = CacheKey.product(product_id, tenant_id)
                    await self.cache.set(
                        cache_key,
                        product.model_dump(),
                        ttl=self.config.PRODUCT_TTL,
                        tags=[f"tenant:{tenant_id}", f"product:{product_id}"],
                    )
                except ProductNotFoundError:
                    continue

        return products

    async def warm_product_cache(self, tenant_id: str, limit: int = 100) -> Any:
        """
        Pre-load frequently accessed products into cache.

        This should be called during application startup or after
        cache clearing to improve initial response times.
        """
        logger.info("Warming product cache", tenant_id=tenant_id, limit=limit)

        # Get most popular/recent products
        filters = ProductFilters(
            category=None,
            product_type=None,
            is_active=True,
            usage_type=None,
            search=None,
        )
        products: list[Product] = await super().list_products(
            tenant_id, filters=filters, page=1, limit=limit
        )

        # Cache each product
        cached_count = 0
        for product in products:
            # Cache by ID
            cache_key = CacheKey.product(product.product_id, tenant_id)
            await self.cache.set(
                cache_key,
                product.model_dump(),
                ttl=self.config.PRODUCT_TTL,
                tags=[f"tenant:{tenant_id}", f"product:{product.product_id}"],
            )

            # Cache by SKU
            sku_cache_key = CacheKey.product_by_sku(product.sku, tenant_id)
            await self.cache.set(
                sku_cache_key,
                product.model_dump(),
                ttl=self.config.PRODUCT_TTL,
                tags=[f"tenant:{tenant_id}", f"sku:{product.sku}"],
            )

            cached_count += 1

        logger.info("Product cache warmed", tenant_id=tenant_id, cached_count=cached_count)

        return cached_count

    async def get_cache_stats(self) -> dict[str, Any]:
        """Get cache statistics for monitoring."""
        metrics: dict[str, Any] = self.cache.get_metrics()
        return metrics
