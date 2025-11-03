"""
Pricing engine models.

Simple pricing rules with clear application logic.
"""

from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.billing.models import BillingBaseModel
from dotmac.platform.core.pydantic import AppBaseModel


class DiscountType(str, Enum):
    """Types of discounts that can be applied."""

    PERCENTAGE = "percentage"  # 10% off
    FIXED_AMOUNT = "fixed_amount"  # $10 off
    FIXED_PRICE = "fixed_price"  # Set price to $50


class PricingRule(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Simple pricing rule with clear conditions."""

    rule_id: str = Field(description="Rule identifier")
    name: str = Field(description="Rule name", max_length=255)
    description: str | None = Field(None, description="Rule description")

    # What does this rule apply to?
    applies_to_product_ids: list[str] = Field(
        default_factory=list, description="Specific products this rule applies to"
    )
    applies_to_categories: list[str] = Field(
        default_factory=list, description="Product categories this rule applies to"
    )
    applies_to_all: bool = Field(default=False, description="Apply to all products")

    # Simple conditions
    min_quantity: int | None = Field(None, description="Minimum quantity required")
    customer_segments: list[str] = Field(
        default_factory=list, description="Customer types/segments this applies to"
    )

    # Discount configuration
    discount_type: DiscountType = Field(description="How to apply discount")
    discount_value: Decimal = Field(description="Discount amount or percentage")

    # Time constraints
    starts_at: datetime | None = Field(None, description="Rule starts at this time")
    ends_at: datetime | None = Field(None, description="Rule ends at this time")

    # Usage limits
    max_uses: int | None = Field(None, description="Maximum times rule can be used")
    current_uses: int = Field(default=0, description="Current usage count")

    # Rule priority (higher number = higher priority)
    priority: int = Field(default=0, description="Rule priority for conflict resolution")

    # Status
    is_active: bool = Field(default=True, description="Rule is active")

    # Flexible metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Custom metadata")

    @field_validator("discount_value")
    @classmethod
    def validate_discount_value(cls, v: Decimal, info: Any) -> Decimal:
        """Validate discount value based on discount type."""
        if v < 0:
            raise ValueError("Discount value cannot be negative")

        # Additional validation based on discount type would need the discount_type field
        # For now, just ensure it's non-negative
        return v

    @field_validator("min_quantity")
    @classmethod
    def validate_min_quantity(cls, v: int | None) -> int | None:
        """Ensure minimum quantity is positive."""
        if v is not None and v <= 0:
            raise ValueError("Minimum quantity must be positive")
        return v

    @field_validator("max_uses")
    @classmethod
    def validate_max_uses(cls, v: int | None) -> int | None:
        """Ensure max uses is positive."""
        if v is not None and v <= 0:
            raise ValueError("Max uses must be positive")
        return v

    def is_currently_active(self) -> bool:
        """Check if rule is active and within time constraints."""
        if not self.is_active:
            return False

        now = datetime.now(UTC)

        if self.starts_at and now < self.starts_at:
            return False

        if self.ends_at and now > self.ends_at:
            return False

        return True

    def has_usage_remaining(self) -> bool:
        """Check if rule has usage remaining."""
        if self.max_uses is None:
            return True

        return self.current_uses < self.max_uses

    def can_be_applied(self, quantity: int = 1) -> bool:
        """Check if rule can be applied given quantity and usage constraints."""
        if not self.is_currently_active():
            return False

        if not self.has_usage_remaining():
            return False

        if self.min_quantity and quantity < self.min_quantity:
            return False

        return True


class PriceCalculationContext(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Context for price calculations."""

    product_id: str = Field(description="Product being priced")
    quantity: int = Field(description="Quantity being purchased", ge=1)
    customer_id: str = Field(description="Customer making purchase")
    customer_segments: list[str] = Field(
        default_factory=list, description="Customer segments/types"
    )

    # Product context
    product_category: str | None = Field(None, description="Product category")
    base_price: Decimal = Field(description="Product base price")
    currency: str = Field(default="USD", description="Currency used for calculation")

    # Additional context
    calculation_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When calculation is performed",
    )
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional context data")


class PriceAdjustment(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Result of applying a pricing rule."""

    rule_id: str = Field(description="Rule that was applied")
    rule_name: str = Field(description="Rule name")
    discount_type: DiscountType = Field(description="Type of discount applied")
    discount_value: Decimal = Field(description="Original discount value from rule")

    # Calculation results
    original_price: Decimal = Field(description="Price before this rule")
    discount_amount: Decimal = Field(description="Actual discount amount")
    adjusted_price: Decimal = Field(description="Price after this rule")


class PriceCalculationResult(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Complete result of price calculation."""

    # Input context
    product_id: str
    quantity: int
    customer_id: str

    # Price breakdown
    base_price: Decimal = Field(description="Base price per unit")
    subtotal: Decimal = Field(description="Base price * quantity")
    total_discount_amount: Decimal = Field(description="Total discount applied")
    final_price: Decimal = Field(description="Final price after all discounts")
    currency: str = Field(default="USD", description="Currency used during pricing")
    normalized_amount: Decimal | None = Field(
        None, description="Final price normalized to default currency"
    )
    normalized_currency: str | None = Field(None, description="Currency code for normalized amount")

    # Applied adjustments (in order)
    applied_adjustments: list[PriceAdjustment] = Field(
        default_factory=list, description="Price adjustments applied"
    )

    # Calculation metadata
    calculation_timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When calculation was performed",
    )

    def get_savings_percentage(self) -> Decimal:
        """Calculate percentage savings."""
        if self.subtotal == 0:
            return Decimal("0")

        return (self.total_discount_amount / self.subtotal) * 100


# Request/Response Models


class PricingRuleCreateRequest(BaseModel):
    """Request model for creating pricing rules."""

    model_config = ConfigDict()

    name: str = Field(description="Rule name", max_length=255)
    description: str | None = Field(None, description="Rule description")

    applies_to_product_ids: list[str] = Field(default_factory=lambda: [])
    applies_to_categories: list[str] = Field(default_factory=lambda: [])
    applies_to_all: bool = Field(default=False)

    min_quantity: int | None = Field(None, ge=1)
    customer_segments: list[str] = Field(default_factory=lambda: [])

    discount_type: DiscountType
    discount_value: Decimal = Field(ge=0)

    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_uses: int | None = Field(None, ge=1)
    priority: int = Field(default=0)

    metadata: dict[str, Any] = Field(default_factory=lambda: {})

    @field_validator("ends_at")
    @classmethod
    def validate_end_date(cls, v: datetime | None, info: Any) -> datetime | None:
        """Ensure end date is after start date."""
        if v and info.data.get("starts_at") and v <= info.data["starts_at"]:
            raise ValueError("End date must be after start date")
        return v


class PricingRuleUpdateRequest(BaseModel):
    """Request model for updating pricing rules."""

    model_config = ConfigDict()

    name: str | None = Field(None, max_length=255)
    description: str | None = None
    discount_value: Decimal | None = Field(None, ge=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_uses: int | None = Field(None, ge=1)
    priority: int | None = None
    is_active: bool | None = None
    metadata: dict[str, Any] | None = None


class PriceCalculationRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for price calculations."""

    product_id: str = Field(description="Product to calculate price for")
    quantity: int = Field(description="Quantity", ge=1)
    customer_id: str = Field(description="Customer ID")
    customer_segments: list[str] = Field(
        default_factory=list, description="Customer segments for rule matching"
    )

    # Optional context
    calculation_date: datetime | None = Field(
        None, description="Date to calculate price for (default: now)"
    )
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    currency: str | None = Field(
        None, description="Currency for the calculation (defaults to product currency)"
    )


class PricingRuleResponse(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Response model for pricing rule data."""

    rule_id: str
    tenant_id: str
    name: str
    description: str | None
    applies_to_product_ids: list[str]
    applies_to_categories: list[str]
    applies_to_all: bool
    min_quantity: int | None
    customer_segments: list[str]
    discount_type: DiscountType
    discount_value: Decimal
    starts_at: datetime | None
    ends_at: datetime | None
    max_uses: int | None
    current_uses: int
    priority: int
    is_active: bool
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime | None
