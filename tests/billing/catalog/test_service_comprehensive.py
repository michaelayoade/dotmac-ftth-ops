"""
Comprehensive tests for billing catalog service.

Tests product and category management with real database operations.
"""

from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.catalog.models import (
    ProductCategoryCreateRequest,
    ProductCreateRequest,
    ProductFilters,
    ProductType,
    ProductUpdateRequest,
    TaxClass,
    UsageType,
)
from dotmac.platform.billing.catalog.service import (
    ProductService,
    generate_category_id,
    generate_product_id,
)
from dotmac.platform.billing.exceptions import (
    BillingConfigurationError,
    CategoryNotFoundError,
    DuplicateProductError,
    ProductError,
    ProductNotFoundError,
)


@pytest.mark.integration
class TestProductServiceProductCreation:
    """Test product creation operations."""

    @pytest.mark.asyncio
    async def test_create_product_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test successful product creation."""
        service = ProductService(db_session)

        product_data = ProductCreateRequest(
            sku="SKU-TEST-001",
            name="Test Product",
            description="A test product",
            category="Software",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("4999"),  # $49.99 in cents
            currency="USD",
            tax_class=TaxClass.STANDARD,
            metadata={"test": True},
        )

        product = await service.create_product(product_data, tenant_id)

        assert product is not None
        assert product.product_id.startswith("prod_")
        assert product.tenant_id == tenant_id
        assert product.sku == "SKU-TEST-001"
        assert product.name == "Test Product"
        assert product.product_type == ProductType.ONE_TIME
        assert product.base_price == Decimal("4999")
        assert product.is_active is True

    @pytest.mark.asyncio
    async def test_create_product_with_usage_configuration(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test creating usage-based product with proper configuration."""
        service = ProductService(db_session)

        product_data = ProductCreateRequest(
            sku="SKU-API-001",
            name="API Service",
            category="APIs",
            product_type=ProductType.USAGE_BASED,
            base_price=Decimal("0"),
            usage_type=UsageType.API_CALLS,
            usage_unit_name="API Requests",
        )

        product = await service.create_product(product_data, tenant_id)

        assert product.product_type == ProductType.USAGE_BASED
        assert product.usage_type == UsageType.API_CALLS
        assert product.usage_unit_name == "API Requests"
        assert product.requires_usage_tracking() is True

    @pytest.mark.asyncio
    async def test_create_product_duplicate_sku_fails(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product creation fails with duplicate SKU."""
        service = ProductService(db_session)

        product_data = ProductCreateRequest(
            sku="SKU-DUPLICATE",
            name="First Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
        )

        # Create first product
        await service.create_product(product_data, tenant_id)

        # Attempt to create duplicate
        duplicate_data = ProductCreateRequest(
            sku="SKU-DUPLICATE",
            name="Second Product",
            category="Test",
            product_type=ProductType.SUBSCRIPTION,
            base_price=Decimal("2000"),
        )

        with pytest.raises(DuplicateProductError) as exc_info:
            await service.create_product(duplicate_data, tenant_id)

        assert "already exists" in str(exc_info.value)
        assert "SKU-DUPLICATE" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_usage_product_without_usage_type_fails(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test creating usage-based product without usage_type fails."""
        service = ProductService(db_session)

        product_data = ProductCreateRequest(
            sku="SKU-INVALID-USAGE",
            name="Invalid Usage Product",
            category="Test",
            product_type=ProductType.USAGE_BASED,
            base_price=Decimal("0"),
            # Missing usage_type
        )

        with pytest.raises(BillingConfigurationError) as exc_info:
            await service.create_product(product_data, tenant_id)

        assert "usage type is required" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_create_usage_product_without_unit_name_fails(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test creating usage-based product without usage_unit_name fails."""
        service = ProductService(db_session)

        product_data = ProductCreateRequest(
            sku="SKU-NO-UNIT",
            name="No Unit Name Product",
            category="Test",
            product_type=ProductType.HYBRID,
            base_price=Decimal("1000"),
            usage_type=UsageType.API_CALLS,
            # Missing usage_unit_name
        )

        with pytest.raises(BillingConfigurationError) as exc_info:
            await service.create_product(product_data, tenant_id)

        assert "unit name is required" in str(exc_info.value).lower()


@pytest.mark.integration
class TestProductServiceProductRetrieval:
    """Test product retrieval operations."""

    @pytest.mark.asyncio
    async def test_get_product_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test successful product retrieval by ID."""
        service = ProductService(db_session)

        # Create product
        product_data = ProductCreateRequest(
            sku="SKU-GET-001",
            name="Get Test Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("5000"),
        )
        created_product = await service.create_product(product_data, tenant_id)

        # Retrieve product
        retrieved_product = await service.get_product(created_product.product_id, tenant_id)

        assert retrieved_product is not None
        assert retrieved_product.product_id == created_product.product_id
        assert retrieved_product.sku == "SKU-GET-001"
        assert retrieved_product.name == "Get Test Product"

    @pytest.mark.asyncio
    async def test_get_product_not_found(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product retrieval fails when product doesn't exist."""
        service = ProductService(db_session)

        with pytest.raises(ProductNotFoundError) as exc_info:
            await service.get_product("prod_nonexistent", tenant_id)

        assert "not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_product_wrong_tenant(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product retrieval fails with wrong tenant ID."""
        service = ProductService(db_session)

        # Create product for tenant A
        product_data = ProductCreateRequest(
            sku="SKU-TENANT-A",
            name="Tenant A Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
        )
        product = await service.create_product(product_data, tenant_id)

        # Attempt to retrieve with wrong tenant
        with pytest.raises(ProductNotFoundError):
            await service.get_product(product.product_id, "wrong-tenant-id")

    @pytest.mark.asyncio
    async def test_get_product_by_sku_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product retrieval by SKU."""
        service = ProductService(db_session)

        # Create product
        product_data = ProductCreateRequest(
            sku="SKU-UNIQUE-123",
            name="SKU Test Product",
            category="Test",
            product_type=ProductType.SUBSCRIPTION,
            base_price=Decimal("9999"),
        )
        await service.create_product(product_data, tenant_id)

        # Retrieve by SKU
        product = await service.get_product_by_sku("SKU-UNIQUE-123", tenant_id)

        assert product is not None
        assert product.sku == "SKU-UNIQUE-123"
        assert product.name == "SKU Test Product"

    @pytest.mark.asyncio
    async def test_get_product_by_sku_not_found(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product retrieval by SKU returns None when not found."""
        service = ProductService(db_session)

        product = await service.get_product_by_sku("SKU-NOTEXIST", tenant_id)

        assert product is None


@pytest.mark.integration
class TestProductServiceProductListing:
    """Test product listing and filtering operations."""

    @pytest.mark.asyncio
    async def test_list_products_no_filters(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test listing products without filters."""
        service = ProductService(db_session)

        # Create multiple products
        products_data = [
            ProductCreateRequest(
                sku=f"SKU-LIST-{i}",
                name=f"Product {i}",
                category="Test",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal(str(1000 * i)),
            )
            for i in range(1, 4)
        ]

        for product_data in products_data:
            await service.create_product(product_data, tenant_id)

        # List all products
        products = await service.list_products(tenant_id)

        assert len(products) >= 3
        skus = [p.sku for p in products]
        assert "SKU-LIST-1" in skus
        assert "SKU-LIST-2" in skus
        assert "SKU-LIST-3" in skus

    @pytest.mark.asyncio
    async def test_list_products_filter_by_category(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test listing products filtered by category."""
        service = ProductService(db_session)

        # Create products in different categories
        await service.create_product(
            ProductCreateRequest(
                sku="SKU-CAT-A-1",
                name="Category A Product",
                category="Category A",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("1000"),
            ),
            tenant_id,
        )

        await service.create_product(
            ProductCreateRequest(
                sku="SKU-CAT-B-1",
                name="Category B Product",
                category="Category B",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("2000"),
            ),
            tenant_id,
        )

        # Filter by category
        filters = ProductFilters(category="Category A")
        products = await service.list_products(tenant_id, filters=filters)

        assert len(products) >= 1
        assert all(p.category == "Category A" for p in products)

    @pytest.mark.asyncio
    async def test_list_products_filter_by_product_type(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test listing products filtered by product type."""
        service = ProductService(db_session)

        # Create products of different types
        await service.create_product(
            ProductCreateRequest(
                sku="SKU-ONETIME-1",
                name="One-time Product",
                category="Test",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("1000"),
            ),
            tenant_id,
        )

        await service.create_product(
            ProductCreateRequest(
                sku="SKU-SUB-1",
                name="Subscription Product",
                category="Test",
                product_type=ProductType.SUBSCRIPTION,
                base_price=Decimal("2000"),
            ),
            tenant_id,
        )

        # Filter by product type
        filters = ProductFilters(product_type=ProductType.SUBSCRIPTION)
        products = await service.list_products(tenant_id, filters=filters)

        assert len(products) >= 1
        assert all(p.product_type == ProductType.SUBSCRIPTION for p in products)

    @pytest.mark.asyncio
    async def test_list_products_filter_by_usage_type(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test listing products filtered by usage type."""
        service = ProductService(db_session)

        # Create usage-based products
        await service.create_product(
            ProductCreateRequest(
                sku="SKU-API-1",
                name="API Product",
                category="APIs",
                product_type=ProductType.USAGE_BASED,
                base_price=Decimal("0"),
                usage_type=UsageType.API_CALLS,
                usage_unit_name="API Calls",
            ),
            tenant_id,
        )

        await service.create_product(
            ProductCreateRequest(
                sku="SKU-STORAGE-1",
                name="Storage Product",
                category="Storage",
                product_type=ProductType.USAGE_BASED,
                base_price=Decimal("0"),
                usage_type=UsageType.STORAGE_GB,
                usage_unit_name="GB",
            ),
            tenant_id,
        )

        # Filter by usage type
        filters = ProductFilters(usage_type=UsageType.API_CALLS)
        products = await service.list_products(tenant_id, filters=filters)

        assert len(products) >= 1
        assert all(p.usage_type == UsageType.API_CALLS for p in products)

    @pytest.mark.asyncio
    async def test_list_products_filter_by_active_status(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test listing products filtered by active status."""
        service = ProductService(db_session)

        # Create active product
        product_data = ProductCreateRequest(
            sku="SKU-ACTIVE-1",
            name="Active Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
        )
        product = await service.create_product(product_data, tenant_id)

        # Deactivate it
        await service.deactivate_product(product.product_id, tenant_id)

        # List only active products (default)
        filters = ProductFilters(is_active=True)
        active_products = await service.list_products(tenant_id, filters=filters)

        skus = [p.sku for p in active_products]
        assert "SKU-ACTIVE-1" not in skus  # Deactivated product not in list

        # List inactive products
        filters = ProductFilters(is_active=False)
        inactive_products = await service.list_products(tenant_id, filters=filters)

        skus = [p.sku for p in inactive_products]
        assert "SKU-ACTIVE-1" in skus  # Deactivated product in list

    @pytest.mark.asyncio
    async def test_list_products_search_by_name(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test listing products with text search in name."""
        service = ProductService(db_session)

        # Create products with specific names
        await service.create_product(
            ProductCreateRequest(
                sku="SKU-SEARCH-1",
                name="Premium Development Tool",
                category="Tools",
                product_type=ProductType.SUBSCRIPTION,
                base_price=Decimal("9999"),
            ),
            tenant_id,
        )

        await service.create_product(
            ProductCreateRequest(
                sku="SKU-SEARCH-2",
                name="Basic API Service",
                category="APIs",
                product_type=ProductType.USAGE_BASED,
                base_price=Decimal("0"),
                usage_type=UsageType.API_CALLS,
                usage_unit_name="Calls",
            ),
            tenant_id,
        )

        # Search for "development"
        filters = ProductFilters(search="development")
        products = await service.list_products(tenant_id, filters=filters)

        assert len(products) >= 1
        assert any("Development" in p.name for p in products)

    @pytest.mark.asyncio
    async def test_list_products_pagination(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product listing with pagination."""
        service = ProductService(db_session)

        # Create 5 products
        for i in range(1, 6):
            await service.create_product(
                ProductCreateRequest(
                    sku=f"SKU-PAGE-{i}",
                    name=f"Product {i}",
                    category="Test",
                    product_type=ProductType.ONE_TIME,
                    base_price=Decimal(str(1000 * i)),
                ),
                tenant_id,
            )

        # Get first page (2 items)
        page1 = await service.list_products(tenant_id, page=1, limit=2)
        assert len(page1) == 2

        # Get second page (2 items)
        page2 = await service.list_products(tenant_id, page=2, limit=2)
        assert len(page2) == 2

        # Ensure pages are different
        page1_ids = {p.product_id for p in page1}
        page2_ids = {p.product_id for p in page2}
        assert page1_ids != page2_ids


@pytest.mark.integration
class TestProductServiceProductUpdates:
    """Test product update operations."""

    @pytest.mark.asyncio
    async def test_update_product_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test successful product update."""
        service = ProductService(db_session)

        # Create product
        product_data = ProductCreateRequest(
            sku="SKU-UPDATE-1",
            name="Original Name",
            description="Original description",
            category="Original Category",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
        )
        product = await service.create_product(product_data, tenant_id)

        # Update product
        updates = ProductUpdateRequest(
            name="Updated Name",
            description="Updated description",
            base_price=Decimal("2000"),
        )

        updated_product = await service.update_product(product.product_id, updates, tenant_id)

        assert updated_product.name == "Updated Name"
        assert updated_product.description == "Updated description"
        assert updated_product.base_price == Decimal("2000")
        # Unchanged fields
        assert updated_product.sku == "SKU-UPDATE-1"
        assert updated_product.category == "Original Category"

    @pytest.mark.asyncio
    async def test_update_product_partial(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test partial product update."""
        service = ProductService(db_session)

        # Create product
        product_data = ProductCreateRequest(
            sku="SKU-PARTIAL-1",
            name="Original Name",
            description="Original description",
            category="Test",
            product_type=ProductType.SUBSCRIPTION,
            base_price=Decimal("5000"),
        )
        product = await service.create_product(product_data, tenant_id)

        # Update only name
        updates = ProductUpdateRequest(name="New Name Only")

        updated_product = await service.update_product(product.product_id, updates, tenant_id)

        assert updated_product.name == "New Name Only"
        # Other fields unchanged
        assert updated_product.description == "Original description"
        assert updated_product.base_price == Decimal("5000")

    @pytest.mark.asyncio
    async def test_update_product_not_found(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product update fails when product doesn't exist."""
        service = ProductService(db_session)

        updates = ProductUpdateRequest(name="Updated Name")

        with pytest.raises(ProductNotFoundError):
            await service.update_product("prod_nonexistent", updates, tenant_id)

    @pytest.mark.asyncio
    async def test_update_price_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product price update."""
        service = ProductService(db_session)

        # Create product
        product_data = ProductCreateRequest(
            sku="SKU-PRICE-1",
            name="Price Test Product",
            category="Test",
            product_type=ProductType.SUBSCRIPTION,
            base_price=Decimal("9999"),
        )
        product = await service.create_product(product_data, tenant_id)

        # Update price
        new_price = Decimal("14999")
        updated_product = await service.update_price(product.product_id, new_price, tenant_id)

        assert updated_product.base_price == new_price
        # Other fields unchanged
        assert updated_product.name == "Price Test Product"
        assert updated_product.sku == "SKU-PRICE-1"

    @pytest.mark.asyncio
    async def test_deactivate_product_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test product deactivation (soft delete)."""
        service = ProductService(db_session)

        # Create product
        product_data = ProductCreateRequest(
            sku="SKU-DEACTIVATE-1",
            name="Deactivate Test",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
        )
        product = await service.create_product(product_data, tenant_id)

        assert product.is_active is True

        # Deactivate
        deactivated_product = await service.deactivate_product(product.product_id, tenant_id)

        assert deactivated_product.is_active is False
        # Product still exists in database
        retrieved = await service.get_product(product.product_id, tenant_id)
        assert retrieved.is_active is False


@pytest.mark.integration
class TestProductServiceCategories:
    """Test category management operations."""

    @pytest.mark.asyncio
    async def test_create_category_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test successful category creation."""
        service = ProductService(db_session)

        category_data = ProductCategoryCreateRequest(
            name="Software Tools",
            description="Development tools and utilities",
            default_tax_class=TaxClass.DIGITAL_SERVICES,
            sort_order=1,
        )

        category = await service.create_category(category_data, tenant_id)

        assert category is not None
        assert category.category_id.startswith("cat_")
        assert category.tenant_id == tenant_id
        assert category.name == "Software Tools"
        assert category.default_tax_class == TaxClass.DIGITAL_SERVICES
        assert category.sort_order == 1

    @pytest.mark.asyncio
    async def test_create_category_duplicate_name_fails(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test category creation fails with duplicate name."""
        service = ProductService(db_session)

        category_data = ProductCategoryCreateRequest(
            name="Duplicate Category",
            description="First category",
        )

        # Create first category
        await service.create_category(category_data, tenant_id)

        # Attempt to create duplicate
        duplicate_data = ProductCategoryCreateRequest(
            name="Duplicate Category",
            description="Second category",
        )

        with pytest.raises(ProductError) as exc_info:
            await service.create_category(duplicate_data, tenant_id)

        assert "already exists" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_category_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test successful category retrieval."""
        service = ProductService(db_session)

        # Create category
        category_data = ProductCategoryCreateRequest(
            name="Test Category",
            description="A test category",
        )
        created_category = await service.create_category(category_data, tenant_id)

        # Retrieve category
        retrieved_category = await service.get_category(created_category.category_id, tenant_id)

        assert retrieved_category is not None
        assert retrieved_category.category_id == created_category.category_id
        assert retrieved_category.name == "Test Category"

    @pytest.mark.asyncio
    async def test_get_category_not_found(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test category retrieval fails when not found."""
        service = ProductService(db_session)

        with pytest.raises(CategoryNotFoundError):
            await service.get_category("cat_nonexistent", tenant_id)

    @pytest.mark.asyncio
    async def test_list_categories_success(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test listing categories."""
        service = ProductService(db_session)

        # Create multiple categories
        categories_data = [
            ProductCategoryCreateRequest(name="Category A", sort_order=2),
            ProductCategoryCreateRequest(name="Category B", sort_order=1),
            ProductCategoryCreateRequest(name="Category C", sort_order=3),
        ]

        for category_data in categories_data:
            await service.create_category(category_data, tenant_id)

        # List categories
        categories = await service.list_categories(tenant_id)

        assert len(categories) >= 3
        names = [c.name for c in categories]
        assert "Category A" in names
        assert "Category B" in names
        assert "Category C" in names

        # Verify sorting by sort_order
        category_b = next(c for c in categories if c.name == "Category B")
        category_a = next(c for c in categories if c.name == "Category A")
        b_index = categories.index(category_b)
        a_index = categories.index(category_a)
        assert b_index < a_index  # B (sort_order=1) should come before A (sort_order=2)


@pytest.mark.integration
class TestProductServiceUsageProducts:
    """Test usage product specific operations."""

    @pytest.mark.asyncio
    async def test_get_usage_products(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test retrieving usage-based products."""
        service = ProductService(db_session)

        # Create various product types
        await service.create_product(
            ProductCreateRequest(
                sku="SKU-ONETIME",
                name="One-time Product",
                category="Test",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("1000"),
            ),
            tenant_id,
        )

        await service.create_product(
            ProductCreateRequest(
                sku="SKU-USAGE",
                name="Usage Product",
                category="APIs",
                product_type=ProductType.USAGE_BASED,
                base_price=Decimal("0"),
                usage_type=UsageType.API_CALLS,
                usage_unit_name="Calls",
            ),
            tenant_id,
        )

        await service.create_product(
            ProductCreateRequest(
                sku="SKU-HYBRID",
                name="Hybrid Product",
                category="Premium",
                product_type=ProductType.HYBRID,
                base_price=Decimal("5000"),
                usage_type=UsageType.STORAGE_GB,
                usage_unit_name="GB",
            ),
            tenant_id,
        )

        # Get usage products
        usage_products = await service.get_usage_products(tenant_id)

        assert len(usage_products) >= 2
        product_types = [p.product_type for p in usage_products]
        assert ProductType.USAGE_BASED in product_types
        assert ProductType.HYBRID in product_types
        assert ProductType.ONE_TIME not in product_types

    @pytest.mark.asyncio
    async def test_get_products_by_category(
        self,
        db_session: AsyncSession,
        tenant_id: str,
    ):
        """Test retrieving products by category."""
        service = ProductService(db_session)

        # Create products in specific category
        await service.create_product(
            ProductCreateRequest(
                sku="SKU-API-1",
                name="API Product 1",
                category="API Services",
                product_type=ProductType.USAGE_BASED,
                base_price=Decimal("0"),
                usage_type=UsageType.API_CALLS,
                usage_unit_name="Calls",
            ),
            tenant_id,
        )

        await service.create_product(
            ProductCreateRequest(
                sku="SKU-API-2",
                name="API Product 2",
                category="API Services",
                product_type=ProductType.SUBSCRIPTION,
                base_price=Decimal("2000"),
            ),
            tenant_id,
        )

        await service.create_product(
            ProductCreateRequest(
                sku="SKU-OTHER",
                name="Other Product",
                category="Other",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("1000"),
            ),
            tenant_id,
        )

        # Get products in category
        api_products = await service.get_products_by_category(
            "API Services", tenant_id, active_only=True
        )

        assert len(api_products) >= 2
        assert all(p.category == "API Services" for p in api_products)
        assert all(p.is_active is True for p in api_products)


@pytest.mark.integration
class TestProductServiceHelpers:
    """Test helper functions."""

    def test_generate_product_id(self):
        """Test product ID generation."""
        product_id = generate_product_id()

        assert product_id.startswith("prod_")
        assert len(product_id) > 5  # prod_ + some hex chars

    def test_generate_category_id(self):
        """Test category ID generation."""
        category_id = generate_category_id()

        assert category_id.startswith("cat_")
        assert len(category_id) > 4  # cat_ + some hex chars

    def test_generate_unique_ids(self):
        """Test that generated IDs are unique."""
        product_ids = [generate_product_id() for _ in range(10)]
        category_ids = [generate_category_id() for _ in range(10)]

        # All IDs should be unique
        assert len(set(product_ids)) == 10
        assert len(set(category_ids)) == 10
