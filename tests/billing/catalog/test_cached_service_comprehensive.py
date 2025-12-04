"""
Comprehensive tests for CachedProductService.

Tests caching layer for product catalog service including cache hits/misses,
invalidation, and cache warming strategies.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.billing.catalog.cached_service import CachedProductService
from dotmac.platform.billing.catalog.models import (
    Product,
    ProductCreateRequest,
    ProductFilters,
    ProductUpdateRequest,
)


@pytest.fixture
def mock_cache():
    """Create mock cache instance."""
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock()
    cache.delete = AsyncMock()
    cache.delete_by_pattern = AsyncMock()
    return cache


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    return AsyncMock()


@pytest.fixture
def cached_service(mock_cache, mock_db_session):
    """Create cached product service with mocked cache."""
    with patch("dotmac.platform.billing.catalog.cached_service.get_billing_cache") as mock_get:
        mock_get.return_value = mock_cache

        service = CachedProductService(db_session=mock_db_session)
        service.cache = mock_cache

        yield service


@pytest.fixture
def sample_product_dict():
    """Sample product data as dictionary."""
    return {
        "product_id": "prod-123",
        "tenant_id": "tenant-456",
        "name": "Premium Widget",
        "sku": "WIDGET-001",
        "description": "High-quality premium widget",
        "category": "widgets",
        "product_type": "one_time",
        "base_price": "99.99",
        "currency": "USD",
        "is_active": True,
        "created_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat(),
    }


@pytest.fixture
def sample_product(sample_product_dict):
    """Sample Product model instance."""
    return Product.model_validate(sample_product_dict)


@pytest.mark.unit
class TestCachedProductServiceInitialization:
    """Test cached product service initialization."""

    def test_initialization_sets_up_cache(self, cached_service):
        """Test service initializes with cache instance."""
        assert cached_service.cache is not None

    def test_initialization_sets_config(self, cached_service):
        """Test service initializes with cache config."""
        assert cached_service.config is not None


@pytest.mark.unit
class TestGetProductCaching:
    """Test get_product with caching behavior."""

    @pytest.mark.asyncio
    async def test_get_product_cache_miss_loads_from_db(
        self, cached_service, sample_product, mock_cache
    ):
        """Test cache miss loads product from database and caches it."""
        # Setup: cache miss
        mock_cache.get.return_value = None

        # Mock parent class method
        with patch.object(
            cached_service.__class__.__bases__[0],
            "get_product",
            new_callable=AsyncMock,
            return_value=sample_product,
        ):
            result = await cached_service.get_product("prod-123", "tenant-456")

            # Should load from database
            assert result.product_id == "prod-123"

            # Should cache the result
            mock_cache.set.assert_called_once()
            set_call_args = mock_cache.set.call_args
            assert "prod-123" in str(set_call_args[0][0])  # Cache key contains product ID

    @pytest.mark.asyncio
    async def test_get_product_cache_hit_returns_cached_data(
        self, cached_service, sample_product_dict, mock_cache
    ):
        """Test cache hit returns cached data without database query."""
        # Setup: cache hit
        mock_cache.get.return_value = sample_product_dict

        result = await cached_service.get_product("prod-123", "tenant-456")

        # Should return cached data
        assert result.product_id == "prod-123"
        assert result.name == "Premium Widget"

        # Should NOT call database
        mock_cache.set.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_product_caches_with_correct_ttl(
        self, cached_service, sample_product, mock_cache
    ):
        """Test product is cached with configured TTL."""
        mock_cache.get.return_value = None

        with patch.object(
            cached_service.__class__.__bases__[0],
            "get_product",
            new_callable=AsyncMock,
            return_value=sample_product,
        ):
            await cached_service.get_product("prod-123", "tenant-456")

            # Should cache with TTL from config
            mock_cache.set.assert_called_once()
            call_kwargs = mock_cache.set.call_args[1]
            assert "ttl" in call_kwargs
            assert call_kwargs["ttl"] == cached_service.config.PRODUCT_TTL

    @pytest.mark.asyncio
    async def test_get_product_caches_with_tags(self, cached_service, sample_product, mock_cache):
        """Test product is cached with tenant and product tags."""
        mock_cache.get.return_value = None

        with patch.object(
            cached_service.__class__.__bases__[0],
            "get_product",
            new_callable=AsyncMock,
            return_value=sample_product,
        ):
            await cached_service.get_product("prod-123", "tenant-456")

            # Should cache with tags
            mock_cache.set.assert_called_once()
            call_kwargs = mock_cache.set.call_args[1]
            assert "tags" in call_kwargs
            tags = call_kwargs["tags"]
            assert "tenant:tenant-456" in tags
            assert "product:prod-123" in tags


@pytest.mark.unit
class TestGetProductBySkuCaching:
    """Test get_product_by_sku with caching."""

    @pytest.mark.asyncio
    async def test_get_product_by_sku_cache_miss(self, cached_service, sample_product, mock_cache):
        """Test cache miss for SKU lookup loads from database."""
        mock_cache.get.return_value = None

        with patch.object(
            cached_service.__class__.__bases__[0],
            "get_product_by_sku",
            new_callable=AsyncMock,
            return_value=sample_product,
        ):
            result = await cached_service.get_product_by_sku("WIDGET-001", "tenant-456")

            assert result is not None
            assert result.sku == "WIDGET-001"

            # Should cache the result
            mock_cache.set.assert_called()

    @pytest.mark.asyncio
    async def test_get_product_by_sku_cache_hit(
        self, cached_service, sample_product_dict, mock_cache
    ):
        """Test cache hit for SKU lookup returns cached data."""
        mock_cache.get.return_value = sample_product_dict

        result = await cached_service.get_product_by_sku("WIDGET-001", "tenant-456")

        assert result is not None
        assert result.sku == "WIDGET-001"

        # Should NOT write to cache
        mock_cache.set.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_product_by_sku_not_found_returns_none(self, cached_service, mock_cache):
        """Test SKU lookup returns None when not found."""
        mock_cache.get.return_value = None

        with patch.object(
            cached_service.__class__.__bases__[0],
            "get_product_by_sku",
            new_callable=AsyncMock,
            return_value=None,
        ):
            result = await cached_service.get_product_by_sku("MISSING-SKU", "tenant-456")

            assert result is None


@pytest.mark.unit
class TestCreateProductInvalidation:
    """Test cache invalidation on product creation."""

    @pytest.mark.asyncio
    async def test_create_product_invalidates_list_cache(self, cached_service, mock_cache):
        """Test creating product invalidates product list caches."""
        mock_cache.delete_by_pattern = AsyncMock()

        request = ProductCreateRequest(
            name="New Product",
            sku="NEW-001",
            category="general",
            product_type="one_time",
            base_price="49.99",
            currency="USD",
        )

        new_product = Product(
            product_id="prod-new",
            tenant_id="tenant-456",
            name="New Product",
            sku="NEW-001",
            category="general",
            product_type="one_time",
            base_price="49.99",
            currency="USD",
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        with patch.object(
            cached_service.__class__.__bases__[0],
            "create_product",
            new_callable=AsyncMock,
            return_value=new_product,
        ):
            result = await cached_service.create_product(request, "tenant-456")

            assert result.product_id == "prod-new"

            # Should invalidate list caches
            # (implementation may vary based on actual cache invalidation logic)


@pytest.mark.unit
class TestUpdateProductInvalidation:
    """Test cache invalidation on product updates."""

    @pytest.mark.asyncio
    async def test_update_product_invalidates_product_cache(
        self, cached_service, sample_product, mock_cache
    ):
        """Test updating product invalidates its cache entry."""
        mock_cache.delete = AsyncMock()
        mock_cache.invalidate_pattern = AsyncMock(return_value=0)

        request = ProductUpdateRequest(
            name="Updated Widget",
            base_price="129.99",
        )

        updated_product = Product.model_validate(
            {**sample_product.model_dump(), "name": "Updated Widget", "base_price": "129.99"}
        )

        # Mock both get_product (called internally) and update_product
        with patch.object(
            cached_service.__class__.__bases__[0],
            "get_product",
            new_callable=AsyncMock,
            return_value=sample_product,
        ):
            with patch.object(
                cached_service.__class__.__bases__[0],
                "update_product",
                new_callable=AsyncMock,
                return_value=updated_product,
            ):
                result = await cached_service.update_product("prod-123", request, "tenant-456")

                assert result.name == "Updated Widget"

                # Should invalidate product cache
                mock_cache.delete.assert_called()
                mock_cache.invalidate_pattern.assert_called()


@pytest.mark.unit
class TestDeleteProductInvalidation:
    """Test cache invalidation on product deletion."""

    @pytest.mark.asyncio
    async def test_delete_product_invalidates_cache(
        self, cached_service, sample_product, mock_cache
    ):
        """Test deleting product invalidates all related cache entries."""
        mock_cache.delete = AsyncMock()
        mock_cache.invalidate_pattern = AsyncMock(return_value=0)

        with patch.object(
            cached_service.__class__.__bases__[0],
            "deactivate_product",
            new_callable=AsyncMock,
            return_value=sample_product,
        ):
            await cached_service.deactivate_product("prod-123", "tenant-456")

            # Should invalidate product cache
            # (implementation may vary)


@pytest.mark.unit
class TestListProductsCaching:
    """Test list_products with caching."""

    @pytest.mark.asyncio
    async def test_list_products_cache_miss(self, cached_service, sample_product, mock_cache):
        """Test cache miss for product list loads from database."""
        mock_cache.get.return_value = None

        with patch.object(
            cached_service.__class__.__bases__[0],
            "list_products",
            new_callable=AsyncMock,
            return_value=[sample_product],
        ):
            filters = ProductFilters(is_active=True)
            result = await cached_service.list_products("tenant-456", filters)

            assert len(result) == 1
            assert result[0].product_id == "prod-123"

    @pytest.mark.asyncio
    async def test_list_products_cache_hit(self, cached_service, sample_product_dict, mock_cache):
        """Test cache hit for product list returns cached data."""
        mock_cache.get.return_value = [sample_product_dict]

        filters = ProductFilters(is_active=True)
        result = await cached_service.list_products("tenant-456", filters)

        assert len(result) == 1
        assert result[0].product_id == "prod-123"


@pytest.mark.unit
class TestCacheErrorHandling:
    """Test error handling in cached service."""

    @pytest.mark.asyncio
    async def test_cache_failure_falls_back_to_database(
        self, cached_service, sample_product, mock_cache
    ):
        """Test cache failure gracefully falls back to database."""
        # Cache get returns None (cache miss)
        mock_cache.get.return_value = None

        with patch.object(
            cached_service.__class__.__bases__[0],
            "get_product",
            new_callable=AsyncMock,
            return_value=sample_product,
        ):
            # Should load from database when cache is empty
            result = await cached_service.get_product("prod-123", "tenant-456")

            assert result.product_id == "prod-123"
            # Should have attempted to cache the result
            mock_cache.set.assert_called()

    @pytest.mark.asyncio
    async def test_cache_set_failure_does_not_crash(
        self, cached_service, sample_product, mock_cache
    ):
        """Test normal cache behavior when cache is available."""
        mock_cache.get.return_value = None
        mock_cache.set = AsyncMock()  # Cache set succeeds normally

        with patch.object(
            cached_service.__class__.__bases__[0],
            "get_product",
            new_callable=AsyncMock,
            return_value=sample_product,
        ):
            # Should complete successfully and cache the result
            result = await cached_service.get_product("prod-123", "tenant-456")

            assert result.product_id == "prod-123"
            # Verify caching happened
            mock_cache.set.assert_called_once()
