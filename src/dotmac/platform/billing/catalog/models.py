"""
Product catalog models for billing system.

Simple, flat product structure with categories and usage-based billing support.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import Field, field_validator

from dotmac.platform.billing.models import BillingBaseModel
from dotmac.platform.core.pydantic import AppBaseModel


class ProductType(str, Enum):
    """Product type determines billing behavior."""

    ONE_TIME = "one_time"  # Single purchase
    SUBSCRIPTION = "subscription"  # Recurring billing
    USAGE_BASED = "usage_based"  # Metered usage only
    HYBRID = "hybrid"  # Subscription + usage


class UsageType(str, Enum):
    """Types of usage that can be measured."""

    API_CALLS = "api_calls"
    STORAGE_GB = "storage_gb"
    BANDWIDTH_GB = "bandwidth_gb"
    USERS = "users"
    TRANSACTIONS = "transactions"
    COMPUTE_HOURS = "compute_hours"
    CUSTOM = "custom"


class TaxClass(str, Enum):
    """Tax classification for products."""

    STANDARD = "standard"  # Standard tax rate
    REDUCED = "reduced"  # Reduced tax rate
    EXEMPT = "exempt"  # Tax exempt
    ZERO_RATED = "zero_rated"  # Zero tax rate
    DIGITAL_SERVICES = "digital_services"  # Digital services tax


class ProductCategory(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Simple flat product categories."""

    category_id: str = Field(description="Category identifier")
    name: str = Field(description="Category name", max_length=100)
    description: str | None = Field(None, description="Category description")

    # Tax defaults for category
    default_tax_class: TaxClass = Field(
        default=TaxClass.STANDARD, description="Default tax class for products in this category"
    )

    # Display order
    sort_order: int = Field(default=0, description="Display sort order")


class Product(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Core product model - simple and flexible."""

    product_id: str = Field(description="Unique product identifier")
    sku: str = Field(description="Stock keeping unit", max_length=100)
    name: str = Field(description="Product name", max_length=255)
    description: str | None = Field(None, description="Product description")

    # Categorization - simple flat structure
    category: str = Field(description="Product category name", max_length=100)

    # Product type determines billing behavior
    product_type: ProductType = Field(description="How this product is billed")

    # Pricing - single base price
    base_price: Decimal = Field(description="Base price in currency units (e.g., dollars)")
    currency: str = Field(default="USD", description="Price currency", max_length=3)

    # Tax handling
    tax_class: TaxClass = Field(default=TaxClass.STANDARD, description="Tax classification")

    # Usage-based billing configuration
    usage_type: UsageType | None = Field(
        None, description="Type of usage measured (for usage-based products)"
    )
    usage_unit_name: str | None = Field(
        None,
        description="Display name for usage unit (e.g., 'API Calls', 'GB Storage')",
        max_length=50,
    )

    # Product status
    is_active: bool = Field(default=True, description="Product is available for sale")

    # Flexible metadata for custom attributes
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Custom metadata for product-specific attributes"
    )

    @field_validator("base_price")
    @classmethod
    def validate_base_price(cls, v: Decimal) -> Decimal:
        """Ensure base price is non-negative."""
        if v < 0:
            raise ValueError("Base price cannot be negative")
        return v

    @field_validator("sku")
    @classmethod
    def validate_sku(cls, v: str) -> str:
        """Ensure SKU is not empty and properly formatted."""
        if not v or not v.strip():
            raise ValueError("SKU cannot be empty")
        # Convert to uppercase and remove extra whitespace
        return v.strip().upper()

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Ensure currency is a valid 3-letter code."""
        if len(v) != 3:
            raise ValueError("Currency must be a 3-letter code")
        return v.upper()

    def is_usage_based(self) -> bool:
        """Check if product supports usage-based billing."""
        return self.product_type in [ProductType.USAGE_BASED, ProductType.HYBRID]

    def requires_usage_tracking(self) -> bool:
        """Check if product requires usage tracking."""
        return self.is_usage_based() and self.usage_type is not None


# Request/Response Models


class ProductCategoryCreateRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for creating product categories."""

    name: str = Field(description="Category name", max_length=100)
    description: str | None = Field(None, description="Category description")
    default_tax_class: TaxClass = Field(default=TaxClass.STANDARD)
    sort_order: int = Field(default=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Ensure category name is not empty."""
        if not v or not v.strip():
            raise ValueError("Category name cannot be empty")
        return v.strip()


class ProductCreateRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for creating products."""

    sku: str = Field(description="Stock keeping unit", max_length=100)
    name: str = Field(description="Product name", max_length=255)
    description: str | None = Field(None, description="Product description")
    category: str = Field(description="Product category", max_length=100)
    product_type: ProductType = Field(description="Product type")
    base_price: Decimal = Field(description="Base price in currency units")
    currency: str = Field(default="USD", max_length=3)
    tax_class: TaxClass = Field(default=TaxClass.STANDARD)
    usage_type: UsageType | None = Field(None)
    usage_unit_name: str | None = Field(None, max_length=50)
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    is_active: bool | None = Field(None, description="Whether the product is active")

    @field_validator("sku")
    @classmethod
    def validate_request_sku(cls, v: str) -> str:
        """Ensure SKU is not empty and properly formatted."""
        if not v or not v.strip():
            raise ValueError("SKU cannot be empty")
        return v.strip().upper()

    @field_validator("base_price")
    @classmethod
    def validate_base_price(cls, v: Decimal) -> Decimal:
        """Ensure base price is non-negative."""
        if v < 0:
            raise ValueError("Base price cannot be negative")
        return v


class ProductUpdateRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for updating products."""

    name: str | None = Field(None, max_length=255)
    description: str | None = None
    category: str | None = Field(None, max_length=100)
    base_price: Decimal | None = None
    tax_class: TaxClass | None = None
    usage_unit_name: str | None = Field(None, max_length=50)
    is_active: bool | None = None
    metadata: dict[str, Any] | None = None

    @field_validator("base_price")
    @classmethod
    def validate_base_price(cls, v: Decimal | None) -> Decimal | None:
        """Ensure base price is non-negative if provided."""
        if v is not None and v < 0:
            raise ValueError("Base price cannot be negative")
        return v


class ProductFilters(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Filter options for product listings."""

    category: str | None = Field(None, description="Filter by category")
    product_type: ProductType | None = Field(None, description="Filter by product type")
    is_active: bool = Field(default=True, description="Filter by active status")
    usage_type: UsageType | None = Field(None, description="Filter by usage type")
    search: str | None = Field(None, description="Search in name and description")


class ProductPriceUpdateRequest(AppBaseModel):  # type: ignore[misc]
    """Request model for updating product price."""

    new_price: Decimal = Field(description="New price in currency units", ge=0)


class ProductResponse(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Response model for product data."""

    product_id: str
    tenant_id: str
    sku: str
    name: str
    description: str | None
    category: str
    product_type: ProductType
    base_price: Decimal
    currency: str
    tax_class: TaxClass
    usage_type: UsageType | None
    usage_unit_name: str | None
    is_active: bool
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime | None


class ProductCategoryResponse(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Response model for product category data."""

    category_id: str
    tenant_id: str
    name: str
    description: str | None
    default_tax_class: TaxClass
    sort_order: int
    created_at: datetime
    updated_at: datetime | None
