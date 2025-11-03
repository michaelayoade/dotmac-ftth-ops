"""
Add-on models for billing system.

Defines add-ons marketplace for tenants to purchase additional features,
resources, or services on top of their base subscription.
"""

from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import Field, field_validator

from dotmac.platform.billing.models import BillingBaseModel
from dotmac.platform.core.pydantic import AppBaseModel


class AddonType(str, Enum):
    """Type of add-on."""

    FEATURE = "feature"  # Unlocks additional features
    RESOURCE = "resource"  # Additional capacity (storage, bandwidth, etc.)
    SERVICE = "service"  # Additional services (support, training, etc.)
    USER_SEATS = "user_seats"  # Additional user licenses
    INTEGRATION = "integration"  # Third-party integrations


class AddonBillingType(str, Enum):
    """How the add-on is billed."""

    ONE_TIME = "one_time"  # Single payment
    RECURRING = "recurring"  # Charged every billing cycle
    METERED = "metered"  # Usage-based billing


class AddonStatus(str, Enum):
    """Add-on status for tenant."""

    ACTIVE = "active"  # Currently active
    CANCELED = "canceled"  # Canceled, may still be active until period end
    ENDED = "ended"  # Fully terminated
    SUSPENDED = "suspended"  # Temporarily suspended


class Addon(BillingBaseModel):  # type: ignore[misc]
    """Add-on catalog item definition."""

    addon_id: str = Field(description="Unique add-on identifier")

    # Basic information
    name: str = Field(description="Add-on name", max_length=255)
    description: str | None = Field(None, description="Detailed description")
    addon_type: AddonType = Field(description="Type of add-on")
    billing_type: AddonBillingType = Field(description="How this add-on is billed")

    # Pricing
    price: Decimal = Field(description="Add-on price (per unit if quantity-based)")
    currency: str = Field(default="USD", description="Price currency", max_length=3)
    setup_fee: Decimal | None = Field(None, description="One-time setup fee")

    # Quantity configuration
    is_quantity_based: bool = Field(
        default=False, description="Whether quantity can be adjusted (e.g., extra users)"
    )
    min_quantity: int = Field(default=1, description="Minimum quantity")
    max_quantity: int | None = Field(None, description="Maximum quantity (None = unlimited)")

    # Metered billing configuration (for usage-based add-ons)
    metered_unit: str | None = Field(
        None, description="Unit of measurement (e.g., 'GB', 'API calls')"
    )
    included_quantity: int | None = Field(None, description="Included quantity per cycle")

    # Availability
    is_active: bool = Field(default=True, description="Add-on is available for purchase")
    is_featured: bool = Field(default=False, description="Featured in marketplace")

    # Plan compatibility
    compatible_with_all_plans: bool = Field(
        default=True, description="Available for all subscription plans"
    )
    compatible_plan_ids: list[str] = Field(
        default_factory=list, description="Specific compatible plan IDs (if not all)"
    )

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Custom metadata")
    icon: str | None = Field(None, description="Icon URL or identifier")
    features: list[str] = Field(
        default_factory=list, description="List of features this add-on provides"
    )

    @field_validator("price", "setup_fee")
    @classmethod
    def validate_prices(cls, v: Decimal | None) -> Decimal | None:
        """Ensure prices are non-negative."""
        if v is not None and v < 0:
            raise ValueError("Prices must be non-negative")
        return v

    @field_validator("min_quantity")
    @classmethod
    def validate_min_quantity(cls, v: int) -> int:
        """Ensure minimum quantity is at least 1."""
        if v < 1:
            raise ValueError("Minimum quantity must be at least 1")
        return v


class TenantAddon(BillingBaseModel):  # type: ignore[misc]
    """Tenant's purchased add-on instance."""

    tenant_addon_id: str = Field(description="Unique tenant add-on identifier")
    tenant_id: str = Field(description="Tenant who owns this add-on")
    addon_id: str = Field(description="Reference to add-on catalog item")

    # Subscription association
    subscription_id: str | None = Field(
        None, description="Associated subscription (None for standalone add-ons)"
    )

    # Current state
    status: AddonStatus = Field(default=AddonStatus.ACTIVE, description="Add-on status")
    quantity: int = Field(default=1, description="Current quantity")

    # Billing dates
    started_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="When add-on was activated"
    )
    current_period_start: datetime | None = Field(None, description="Current billing period start")
    current_period_end: datetime | None = Field(None, description="Current billing period end")
    canceled_at: datetime | None = Field(None, description="When cancellation was requested")
    ended_at: datetime | None = Field(None, description="When add-on fully terminated")

    # Usage tracking (for metered add-ons)
    current_usage: int = Field(default=0, description="Current usage in this period")

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Custom metadata")

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        """Ensure quantity is positive."""
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v


# ============================================================================
# Request/Response Models for API
# ============================================================================


class AddonResponse(AppBaseModel):
    """Response model for add-on catalog item."""

    addon_id: str
    name: str
    description: str | None
    addon_type: AddonType
    billing_type: AddonBillingType
    price: Decimal
    currency: str
    setup_fee: Decimal | None
    is_quantity_based: bool
    min_quantity: int
    max_quantity: int | None
    metered_unit: str | None
    included_quantity: int | None
    is_active: bool
    is_featured: bool
    compatible_with_all_plans: bool
    icon: str | None
    features: list[str]


class TenantAddonResponse(AppBaseModel):
    """Response model for tenant's purchased add-on."""

    tenant_addon_id: str
    tenant_id: str
    addon_id: str
    subscription_id: str | None
    status: AddonStatus
    quantity: int
    started_at: datetime
    current_period_start: datetime | None
    current_period_end: datetime | None
    canceled_at: datetime | None
    ended_at: datetime | None
    current_usage: int
    # Embedded add-on details
    addon: AddonResponse


class PurchaseAddonRequest(AppBaseModel):
    """Request to purchase an add-on."""

    addon_id: str = Field(description="Add-on to purchase")
    quantity: int = Field(default=1, description="Quantity to purchase", ge=1)
    subscription_id: str | None = Field(None, description="Associate with subscription")


class UpdateAddonQuantityRequest(AppBaseModel):
    """Request to adjust add-on quantity."""

    quantity: int = Field(description="New quantity", ge=1)


class CancelAddonRequest(AppBaseModel):
    """Request to cancel an add-on."""

    cancel_immediately: bool = Field(
        default=False, description="Cancel immediately vs. at period end"
    )
    reason: str | None = Field(None, description="Cancellation reason", max_length=1000)
