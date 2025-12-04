"""
Comprehensive tests for billing catalog models.

Tests Pydantic model validation, business logic, and edge cases.
"""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError

from dotmac.platform.billing.catalog.models import (
    Product,
    ProductCategory,
    ProductCategoryCreateRequest,
    ProductCategoryResponse,
    ProductCreateRequest,
    ProductFilters,
    ProductResponse,
    ProductType,
    ProductUpdateRequest,
    TaxClass,
    UsageType,
)


@pytest.mark.unit
class TestProductTypeEnum:
    """Test ProductType enum validation."""

    def test_product_type_values(self):
        """Test ProductType enum values."""
        assert ProductType.ONE_TIME.value == "one_time"
        assert ProductType.SUBSCRIPTION.value == "subscription"
        assert ProductType.USAGE_BASED.value == "usage_based"
        assert ProductType.HYBRID.value == "hybrid"

    def test_product_type_enum_members(self):
        """Test ProductType has all expected members."""
        expected_types = {"ONE_TIME", "SUBSCRIPTION", "USAGE_BASED", "HYBRID"}
        actual_types = set(ProductType.__members__.keys())
        assert actual_types == expected_types


@pytest.mark.unit
class TestUsageTypeEnum:
    """Test UsageType enum validation."""

    def test_usage_type_values(self):
        """Test UsageType enum values."""
        assert UsageType.API_CALLS.value == "api_calls"
        assert UsageType.STORAGE_GB.value == "storage_gb"
        assert UsageType.BANDWIDTH_GB.value == "bandwidth_gb"
        assert UsageType.USERS.value == "users"
        assert UsageType.TRANSACTIONS.value == "transactions"
        assert UsageType.COMPUTE_HOURS.value == "compute_hours"
        assert UsageType.CUSTOM.value == "custom"

    def test_usage_type_enum_members(self):
        """Test UsageType has all expected members."""
        expected_types = {
            "API_CALLS",
            "STORAGE_GB",
            "BANDWIDTH_GB",
            "USERS",
            "TRANSACTIONS",
            "COMPUTE_HOURS",
            "CUSTOM",
        }
        actual_types = set(UsageType.__members__.keys())
        assert actual_types == expected_types


@pytest.mark.unit
class TestTaxClassEnum:
    """Test TaxClass enum validation."""

    def test_tax_class_values(self):
        """Test TaxClass enum values."""
        assert TaxClass.STANDARD.value == "standard"
        assert TaxClass.REDUCED.value == "reduced"
        assert TaxClass.EXEMPT.value == "exempt"
        assert TaxClass.ZERO_RATED.value == "zero_rated"
        assert TaxClass.DIGITAL_SERVICES.value == "digital_services"

    def test_tax_class_enum_members(self):
        """Test TaxClass has all expected members."""
        expected_classes = {"STANDARD", "REDUCED", "EXEMPT", "ZERO_RATED", "DIGITAL_SERVICES"}
        actual_classes = set(TaxClass.__members__.keys())
        assert actual_classes == expected_classes


@pytest.mark.unit
class TestProductCategoryModel:
    """Test ProductCategory model validation and business logic."""

    def test_valid_category_creation(self):
        """Test creating a valid product category."""
        now = datetime.now(UTC)
        category = ProductCategory(
            category_id="cat_123",
            tenant_id="test-tenant",
            name="Software Tools",
            description="Development tools and utilities",
            default_tax_class=TaxClass.DIGITAL_SERVICES,
            sort_order=1,
            created_at=now,
        )

        assert category.category_id == "cat_123"
        assert category.tenant_id == "test-tenant"
        assert category.name == "Software Tools"
        assert category.description == "Development tools and utilities"
        assert category.default_tax_class == TaxClass.DIGITAL_SERVICES
        assert category.sort_order == 1
        assert category.created_at == now

    def test_category_defaults(self):
        """Test category model defaults."""
        now = datetime.now(UTC)
        category = ProductCategory(
            category_id="cat_123",
            tenant_id="test-tenant",
            name="Test Category",
            created_at=now,
        )

        assert category.description is None
        assert category.default_tax_class == TaxClass.STANDARD
        assert category.sort_order == 0
        assert category.updated_at is None

    def test_category_json_serialization(self):
        """Test category JSON serialization."""
        now = datetime.now(UTC)
        category = ProductCategory(
            category_id="cat_123",
            tenant_id="test-tenant",
            name="Test Category",
            created_at=now,
        )

        category_dict = category.model_dump()
        assert isinstance(category_dict["created_at"], datetime)


@pytest.mark.unit
class TestProductModel:
    """Test Product model validation and business logic."""

    def test_valid_product_creation(self):
        """Test creating a valid product."""
        now = datetime.now(UTC)
        product = Product(
            product_id="prod_123",
            tenant_id="test-tenant",
            sku="SKU-TOOL-001",
            name="Development Tool Pro",
            description="Professional development tool",
            category="Software Tools",
            product_type=ProductType.SUBSCRIPTION,
            base_price=Decimal("9999"),  # $99.99 in cents
            currency="USD",
            tax_class=TaxClass.DIGITAL_SERVICES,
            is_active=True,
            metadata={"feature": "premium"},
            created_at=now,
        )

        assert product.product_id == "prod_123"
        assert product.sku == "SKU-TOOL-001"
        assert product.name == "Development Tool Pro"
        assert product.product_type == ProductType.SUBSCRIPTION
        assert product.base_price == Decimal("9999")
        assert product.currency == "USD"
        assert product.is_active is True

    def test_product_with_usage_configuration(self):
        """Test product with usage-based billing configuration."""
        now = datetime.now(UTC)
        product = Product(
            product_id="prod_456",
            tenant_id="test-tenant",
            sku="SKU-API-001",
            name="API Service",
            category="API Services",
            product_type=ProductType.USAGE_BASED,
            base_price=Decimal("0"),
            currency="USD",
            usage_type=UsageType.API_CALLS,
            usage_unit_name="API Calls",
            created_at=now,
        )

        assert product.usage_type == UsageType.API_CALLS
        assert product.usage_unit_name == "API Calls"
        assert product.is_usage_based() is True
        assert product.requires_usage_tracking() is True

    def test_product_validation_base_price_negative(self):
        """Test product validation fails with negative base price."""
        now = datetime.now(UTC)

        with pytest.raises(ValidationError) as exc_info:
            Product(
                product_id="prod_123",
                tenant_id="test-tenant",
                sku="SKU-TEST",
                name="Test Product",
                category="Test",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("-100"),  # Negative price
                currency="USD",
                created_at=now,
            )

        errors = exc_info.value.errors()
        assert any("base_price" in str(error) for error in errors)

    def test_product_validation_sku_empty(self):
        """Test product validation fails with empty SKU."""
        now = datetime.now(UTC)

        with pytest.raises(ValidationError) as exc_info:
            Product(
                product_id="prod_123",
                tenant_id="test-tenant",
                sku="",  # Empty SKU
                name="Test Product",
                category="Test",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("1000"),
                currency="USD",
                created_at=now,
            )

        errors = exc_info.value.errors()
        assert any("sku" in str(error) for error in errors)

    def test_product_validation_sku_whitespace_only(self):
        """Test product validation fails with whitespace-only SKU."""
        now = datetime.now(UTC)

        with pytest.raises(ValidationError) as exc_info:
            Product(
                product_id="prod_123",
                tenant_id="test-tenant",
                sku="   ",  # Whitespace only
                name="Test Product",
                category="Test",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("1000"),
                currency="USD",
                created_at=now,
            )

        errors = exc_info.value.errors()
        assert any("sku" in str(error) for error in errors)

    def test_product_validation_sku_normalization(self):
        """Test SKU is normalized to uppercase and trimmed."""
        now = datetime.now(UTC)
        product = Product(
            product_id="prod_123",
            tenant_id="test-tenant",
            sku="  sku-test-001  ",  # Lowercase with whitespace
            name="Test Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
            currency="USD",
            created_at=now,
        )

        assert product.sku == "SKU-TEST-001"

    def test_product_validation_currency_invalid_length(self):
        """Test product validation fails with invalid currency code length."""
        now = datetime.now(UTC)

        with pytest.raises(ValidationError) as exc_info:
            Product(
                product_id="prod_123",
                tenant_id="test-tenant",
                sku="SKU-TEST",
                name="Test Product",
                category="Test",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("1000"),
                currency="INVALID",  # 7 characters instead of 3
                created_at=now,
            )

        errors = exc_info.value.errors()
        assert any("currency" in str(error) for error in errors)

    def test_product_validation_currency_normalization(self):
        """Test currency code is normalized to uppercase."""
        now = datetime.now(UTC)
        product = Product(
            product_id="prod_123",
            tenant_id="test-tenant",
            sku="SKU-TEST",
            name="Test Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
            currency="usd",  # Lowercase
            created_at=now,
        )

        assert product.currency == "USD"

    def test_product_defaults(self):
        """Test product model defaults."""
        now = datetime.now(UTC)
        product = Product(
            product_id="prod_123",
            tenant_id="test-tenant",
            sku="SKU-TEST",
            name="Test Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
            created_at=now,
        )

        assert product.description is None
        assert product.currency == "USD"
        assert product.tax_class == TaxClass.STANDARD
        assert product.usage_type is None
        assert product.usage_unit_name is None
        assert product.is_active is True
        assert product.metadata == {}
        assert product.updated_at is None

    def test_product_is_usage_based_method(self):
        """Test is_usage_based() business logic method."""
        now = datetime.now(UTC)

        # Usage-based product
        usage_product = Product(
            product_id="prod_1",
            tenant_id="test-tenant",
            sku="SKU-USAGE",
            name="Usage Product",
            category="Test",
            product_type=ProductType.USAGE_BASED,
            base_price=Decimal("0"),
            created_at=now,
        )
        assert usage_product.is_usage_based() is True

        # Hybrid product
        hybrid_product = Product(
            product_id="prod_2",
            tenant_id="test-tenant",
            sku="SKU-HYBRID",
            name="Hybrid Product",
            category="Test",
            product_type=ProductType.HYBRID,
            base_price=Decimal("1000"),
            created_at=now,
        )
        assert hybrid_product.is_usage_based() is True

        # Subscription product
        subscription_product = Product(
            product_id="prod_3",
            tenant_id="test-tenant",
            sku="SKU-SUB",
            name="Subscription Product",
            category="Test",
            product_type=ProductType.SUBSCRIPTION,
            base_price=Decimal("2000"),
            created_at=now,
        )
        assert subscription_product.is_usage_based() is False

        # One-time product
        onetime_product = Product(
            product_id="prod_4",
            tenant_id="test-tenant",
            sku="SKU-ONETIME",
            name="One-time Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("5000"),
            created_at=now,
        )
        assert onetime_product.is_usage_based() is False

    def test_product_requires_usage_tracking_method(self):
        """Test requires_usage_tracking() business logic method."""
        now = datetime.now(UTC)

        # Usage-based product with usage type configured
        product_with_tracking = Product(
            product_id="prod_1",
            tenant_id="test-tenant",
            sku="SKU-TRACKING",
            name="Tracked Product",
            category="Test",
            product_type=ProductType.USAGE_BASED,
            base_price=Decimal("0"),
            usage_type=UsageType.API_CALLS,
            created_at=now,
        )
        assert product_with_tracking.requires_usage_tracking() is True

        # Usage-based product without usage type
        product_without_tracking = Product(
            product_id="prod_2",
            tenant_id="test-tenant",
            sku="SKU-NOTRACK",
            name="Untracked Product",
            category="Test",
            product_type=ProductType.USAGE_BASED,
            base_price=Decimal("0"),
            created_at=now,
        )
        assert product_without_tracking.requires_usage_tracking() is False

        # Non-usage-based product
        subscription_product = Product(
            product_id="prod_3",
            tenant_id="test-tenant",
            sku="SKU-SUB",
            name="Subscription Product",
            category="Test",
            product_type=ProductType.SUBSCRIPTION,
            base_price=Decimal("2000"),
            created_at=now,
        )
        assert subscription_product.requires_usage_tracking() is False

    def test_product_json_serialization(self):
        """Test product JSON serialization with custom encoders."""
        now = datetime.now(UTC)
        product = Product(
            product_id="prod_123",
            tenant_id="test-tenant",
            sku="SKU-TEST",
            name="Test Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("9999"),
            currency="USD",
            created_at=now,
        )

        product_dict = product.model_dump()

        # Decimal should be preserved in dict (encoder applies during JSON serialization)
        assert isinstance(product_dict["base_price"], Decimal)
        assert isinstance(product_dict["created_at"], datetime)


@pytest.mark.unit
class TestProductCreateRequest:
    """Test ProductCreateRequest validation."""

    def test_valid_create_request(self):
        """Test valid product creation request."""
        request = ProductCreateRequest(
            sku="SKU-TEST-001",
            name="Test Product",
            description="A test product",
            category="Test Category",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("4999"),
            currency="USD",
            tax_class=TaxClass.STANDARD,
            metadata={"test": True},
        )

        assert request.sku == "SKU-TEST-001"
        assert request.name == "Test Product"
        assert request.product_type == ProductType.ONE_TIME
        assert request.base_price == Decimal("4999")

    def test_create_request_with_usage_configuration(self):
        """Test creation request with usage-based configuration."""
        request = ProductCreateRequest(
            sku="SKU-API",
            name="API Service",
            category="APIs",
            product_type=ProductType.USAGE_BASED,
            base_price=Decimal("0"),
            usage_type=UsageType.API_CALLS,
            usage_unit_name="API Requests",
        )

        assert request.usage_type == UsageType.API_CALLS
        assert request.usage_unit_name == "API Requests"

    def test_create_request_validation_negative_price(self):
        """Test validation fails with negative price."""
        with pytest.raises(ValidationError) as exc_info:
            ProductCreateRequest(
                sku="SKU-TEST",
                name="Test",
                category="Test",
                product_type=ProductType.ONE_TIME,
                base_price=Decimal("-100"),
            )

        errors = exc_info.value.errors()
        assert any("base_price" in str(error) for error in errors)

    def test_create_request_defaults(self):
        """Test creation request defaults."""
        request = ProductCreateRequest(
            sku="SKU-TEST",
            name="Test Product",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
        )

        assert request.description is None
        assert request.currency == "USD"
        assert request.tax_class == TaxClass.STANDARD
        assert request.usage_type is None
        assert request.usage_unit_name is None
        assert request.metadata == {}


@pytest.mark.unit
class TestProductUpdateRequest:
    """Test ProductUpdateRequest validation."""

    def test_valid_update_request(self):
        """Test valid product update request."""
        request = ProductUpdateRequest(
            name="Updated Product",
            description="Updated description",
            base_price=Decimal("5999"),
            is_active=False,
        )

        assert request.name == "Updated Product"
        assert request.description == "Updated description"
        assert request.base_price == Decimal("5999")
        assert request.is_active is False

    def test_update_request_partial_update(self):
        """Test partial update request."""
        request = ProductUpdateRequest(name="New Name")

        assert request.name == "New Name"
        assert request.description is None
        assert request.base_price is None
        assert request.is_active is None

    def test_update_request_validation_negative_price(self):
        """Test validation fails with negative price."""
        with pytest.raises(ValidationError) as exc_info:
            ProductUpdateRequest(base_price=Decimal("-100"))

        errors = exc_info.value.errors()
        assert any("base_price" in str(error) for error in errors)

    def test_update_request_all_none(self):
        """Test update request with all None values is valid."""
        request = ProductUpdateRequest()

        assert request.name is None
        assert request.description is None
        assert request.base_price is None


@pytest.mark.unit
class TestProductCategoryCreateRequest:
    """Test ProductCategoryCreateRequest validation."""

    def test_valid_category_create_request(self):
        """Test valid category creation request."""
        request = ProductCategoryCreateRequest(
            name="Test Category",
            description="A test category",
            default_tax_class=TaxClass.DIGITAL_SERVICES,
            sort_order=1,
        )

        assert request.name == "Test Category"
        assert request.description == "A test category"
        assert request.default_tax_class == TaxClass.DIGITAL_SERVICES
        assert request.sort_order == 1

    def test_category_create_request_validation_empty_name(self):
        """Test validation fails with empty category name."""
        with pytest.raises(ValidationError) as exc_info:
            ProductCategoryCreateRequest(name="")

        errors = exc_info.value.errors()
        assert any("name" in str(error) for error in errors)

    def test_category_create_request_validation_whitespace_name(self):
        """Test validation fails with whitespace-only name."""
        with pytest.raises(ValidationError) as exc_info:
            ProductCategoryCreateRequest(name="   ")

        errors = exc_info.value.errors()
        assert any("name" in str(error) for error in errors)

    def test_category_create_request_defaults(self):
        """Test category creation request defaults."""
        request = ProductCategoryCreateRequest(name="Test Category")

        assert request.description is None
        assert request.default_tax_class == TaxClass.STANDARD
        assert request.sort_order == 0


@pytest.mark.unit
class TestProductFilters:
    """Test ProductFilters model."""

    def test_valid_filters(self):
        """Test valid product filters."""
        filters = ProductFilters(
            category="Software",
            product_type=ProductType.SUBSCRIPTION,
            is_active=True,
            usage_type=UsageType.API_CALLS,
            search="test query",
        )

        assert filters.category == "Software"
        assert filters.product_type == ProductType.SUBSCRIPTION
        assert filters.is_active is True
        assert filters.usage_type == UsageType.API_CALLS
        assert filters.search == "test query"

    def test_filters_defaults(self):
        """Test filter defaults."""
        filters = ProductFilters()

        assert filters.category is None
        assert filters.product_type is None
        assert filters.is_active is True  # Default is True
        assert filters.usage_type is None
        assert filters.search is None


@pytest.mark.unit
class TestProductResponse:
    """Test ProductResponse model."""

    def test_product_response_creation(self):
        """Test product response model creation."""
        now = datetime.now(UTC)
        response = ProductResponse(
            product_id="prod_123",
            tenant_id="test-tenant",
            sku="SKU-TEST",
            name="Test Product",
            description="Test description",
            category="Test",
            product_type=ProductType.ONE_TIME,
            base_price=Decimal("1000"),
            currency="USD",
            tax_class=TaxClass.STANDARD,
            usage_type=None,
            usage_unit_name=None,
            is_active=True,
            metadata={},
            created_at=now,
            updated_at=None,
        )

        assert response.product_id == "prod_123"
        assert response.sku == "SKU-TEST"
        assert response.name == "Test Product"
        assert response.product_type == ProductType.ONE_TIME

    def test_product_response_with_usage_configuration(self):
        """Test product response with usage configuration."""
        now = datetime.now(UTC)
        response = ProductResponse(
            product_id="prod_456",
            tenant_id="test-tenant",
            sku="SKU-API",
            name="API Service",
            description="API service with usage tracking",
            category="APIs",
            product_type=ProductType.USAGE_BASED,
            base_price=Decimal("0"),
            currency="USD",
            tax_class=TaxClass.DIGITAL_SERVICES,
            usage_type=UsageType.API_CALLS,
            usage_unit_name="API Requests",
            is_active=True,
            metadata={"tier": "pro"},
            created_at=now,
            updated_at=None,
        )

        assert response.usage_type == UsageType.API_CALLS
        assert response.usage_unit_name == "API Requests"
        assert response.metadata == {"tier": "pro"}


@pytest.mark.unit
class TestProductCategoryResponse:
    """Test ProductCategoryResponse model."""

    def test_category_response_creation(self):
        """Test category response model creation."""
        now = datetime.now(UTC)
        response = ProductCategoryResponse(
            category_id="cat_123",
            tenant_id="test-tenant",
            name="Test Category",
            description="Test description",
            default_tax_class=TaxClass.DIGITAL_SERVICES,
            sort_order=1,
            created_at=now,
            updated_at=None,
        )

        assert response.category_id == "cat_123"
        assert response.tenant_id == "test-tenant"
        assert response.name == "Test Category"
        assert response.default_tax_class == TaxClass.DIGITAL_SERVICES
        assert response.sort_order == 1
