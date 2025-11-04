"""
Composable Licensing Framework.

Dynamic, flexible licensing system built from reusable building blocks.
Allows creating custom plans without hardcoded tiers.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy import (
    UUID as SQLUUID,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base as BaseRuntime

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base
else:
    Base = BaseRuntime

# ==================== Enums ====================


class ModuleCategory(str, Enum):
    """Feature module categories for grouping."""

    # Infrastructure
    CORE_PLATFORM = "CORE_PLATFORM"
    NETWORK = "NETWORK"
    INFRASTRUCTURE = "INFRASTRUCTURE"

    # Business Operations
    BILLING = "BILLING"
    CUSTOMER_MGMT = "CUSTOMER_MGMT"
    REVENUE = "REVENUE"

    # Technical
    OSS_INTEGRATION = "OSS_INTEGRATION"
    AUTOMATION = "AUTOMATION"
    API = "API"

    # Analytics & Reporting
    ANALYTICS = "ANALYTICS"
    REPORTING = "REPORTING"

    # Communications
    NOTIFICATIONS = "NOTIFICATIONS"
    INTEGRATIONS = "INTEGRATIONS"

    # Advanced
    CUSTOMIZATION = "CUSTOMIZATION"
    COMPLIANCE = "COMPLIANCE"


class PricingModel(str, Enum):
    """Pricing model for features/quotas."""

    FLAT_FEE = "FLAT_FEE"  # Fixed monthly fee
    PER_UNIT = "PER_UNIT"  # Price per unit (e.g., $5 per additional user)
    TIERED = "TIERED"  # Volume tiers (0-100: $X, 101-500: $Y)
    USAGE_BASED = "USAGE_BASED"  # Pay for what you use
    BUNDLED = "BUNDLED"  # Included in base plan
    FREE = "FREE"  # Always free


class BillingCycle(str, Enum):
    """Billing cycle options."""

    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ANNUALLY = "ANNUALLY"
    BIENNIAL = "BIENNIAL"
    TRIENNIAL = "TRIENNIAL"


class SubscriptionStatus(str, Enum):
    """Subscription status."""

    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    SUSPENDED = "SUSPENDED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class EventType(str, Enum):
    """Subscription event types for audit trail."""

    SUBSCRIPTION_CREATED = "SUBSCRIPTION_CREATED"
    TRIAL_STARTED = "TRIAL_STARTED"
    TRIAL_ENDED = "TRIAL_ENDED"
    TRIAL_CONVERTED = "TRIAL_CONVERTED"
    SUBSCRIPTION_RENEWED = "SUBSCRIPTION_RENEWED"
    SUBSCRIPTION_UPGRADED = "SUBSCRIPTION_UPGRADED"
    SUBSCRIPTION_DOWNGRADED = "SUBSCRIPTION_DOWNGRADED"
    SUBSCRIPTION_CANCELED = "SUBSCRIPTION_CANCELED"
    SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED"
    SUBSCRIPTION_SUSPENDED = "SUBSCRIPTION_SUSPENDED"
    SUBSCRIPTION_REACTIVATED = "SUBSCRIPTION_REACTIVATED"
    ADDON_ADDED = "ADDON_ADDED"
    ADDON_REMOVED = "ADDON_REMOVED"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    QUOTA_WARNING = "QUOTA_WARNING"
    PRICE_CHANGED = "PRICE_CHANGED"


# ==================== Building Blocks ====================


class FeatureModule(Base):
    """
    Reusable feature module (building block).

    Examples:
    - "RADIUS AAA" module
    - "Wireless Management" module
    - "Advanced Analytics" module
    - "GenieACS Integration" module
    """

    __tablename__ = "licensing_feature_modules"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Module identification
    module_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    module_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[ModuleCategory] = mapped_column(
        SQLEnum(ModuleCategory), nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Dependencies (e.g., "Wireless Management" requires "Network Monitoring")
    dependencies: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list
    )  # List of module_codes

    # Pricing
    pricing_model: Mapped[PricingModel] = mapped_column(
        SQLEnum(PricingModel), nullable=False, default=PricingModel.BUNDLED
    )
    base_price: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    price_per_unit: Mapped[float | None] = mapped_column(Numeric(15, 4), nullable=True)

    # Configuration schema (JSON Schema for validation)
    config_schema: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Default configuration
    default_config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Extra metadata (renamed from 'metadata' to avoid SQLAlchemy reserved word)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    @property
    def config(self) -> dict[str, Any]:
        """Compatibility alias for quota configuration metadata."""
        return self.extra_metadata

    @config.setter
    def config(self, value: dict[str, Any]) -> None:
        self.extra_metadata = value

    custom_config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    capabilities: Mapped[list["ModuleCapability"]] = relationship(
        "ModuleCapability", back_populates="module", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_feature_modules_category", "category"),
        Index("ix_feature_modules_active", "is_active", "is_public"),
        {"extend_existing": True},
    )


class ModuleCapability(Base):
    """
    Specific capabilities provided by a feature module.

    Example: "RADIUS AAA" module provides:
    - "radius_authentication" capability
    - "radius_accounting" capability
    - "nas_management" capability
    """

    __tablename__ = "licensing_module_capabilities"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Module relationship
    module_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_feature_modules.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Capability details
    capability_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    capability_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # API endpoints this capability unlocks
    api_endpoints: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # UI routes this capability unlocks
    ui_routes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    permissions: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # Configuration
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    module: Mapped["FeatureModule"] = relationship("FeatureModule", back_populates="capabilities")

    __table_args__ = (
        Index(
            "ix_module_capabilities_module_capability", "module_id", "capability_code", unique=True
        ),
        {"extend_existing": True},
    )


class QuotaDefinition(Base):
    """
    Reusable quota definition (building block).

    Examples:
    - "Staff Users" quota (max 50 users)
    - "Subscribers" quota (max 10,000 subscribers)
    - "API Calls" quota (100,000 calls/month)
    - "Storage" quota (500 GB)
    """

    __tablename__ = "licensing_quota_definitions"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Quota identification
    quota_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    quota_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Measurement
    unit_name: Mapped[str] = mapped_column(String(50), nullable=False)  # "users", "GB", "calls"
    unit_plural: Mapped[str] = mapped_column(String(50), nullable=False)  # "users", "GBs", "calls"

    # Pricing for overages
    pricing_model: Mapped[PricingModel] = mapped_column(
        SQLEnum(PricingModel), nullable=False, default=PricingModel.FREE
    )
    overage_rate: Mapped[float | None] = mapped_column(Numeric(15, 4), nullable=True)

    # Tracking
    is_metered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)  # Track usage?
    reset_period: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # MONTHLY, QUARTERLY, ANNUALLY, null=never

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Extra metadata (renamed from 'metadata' to avoid SQLAlchemy reserved word)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    __table_args__ = (Index("ix_quota_definitions_active", "is_active"), {"extend_existing": True})


# ==================== Service Plans (Composable) ====================


class ServicePlan(Base):
    """
    Composable service plan built from feature modules and quotas.

    Can be:
    - Template (reusable, e.g., "Standard ISP Package")
    - Custom (one-off for specific customer)
    - Versioned (v1, v2, v3)
    """

    __tablename__ = "licensing_service_plans"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Plan identification
    plan_name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Plan type
    is_template: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )  # Reusable template?
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )  # Show on pricing page?
    is_custom: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # One-off custom plan?

    # Base pricing
    base_price_monthly: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    base_price_annual: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    setup_fee: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Discounts
    annual_discount_percent: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )  # e.g., 15% off annual

    # Trial
    trial_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    trial_modules: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list
    )  # Module codes available during trial

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Effective dates (for plan versioning/sunset)
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Extra metadata (renamed from 'metadata' to avoid SQLAlchemy reserved word)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    included_modules: Mapped[list["PlanModule"]] = relationship(
        "PlanModule", back_populates="plan", cascade="all, delete-orphan"
    )
    included_quotas: Mapped[list["PlanQuotaAllocation"]] = relationship(
        "PlanQuotaAllocation", back_populates="plan", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_service_plans_code_version", "plan_code", "version", unique=True),
        Index("ix_service_plans_active", "is_active", "is_public"),
        {"extend_existing": True},
    )

    @property
    def modules(self) -> list["PlanModule"]:
        """Compatibility alias for included_modules relationship."""
        return self.included_modules

    @property
    def quotas(self) -> list["PlanQuotaAllocation"]:
        """Compatibility alias for included_quotas relationship."""
        return self.included_quotas


class PlanModule(Base):
    """
    Feature modules included in a service plan.

    Allows per-module configuration and pricing overrides.
    """

    __tablename__ = "licensing_plan_modules"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Relationships
    plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_service_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    module_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_feature_modules.id"), nullable=False, index=True
    )

    # Inclusion details
    included_by_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )  # Always included?
    is_optional_addon: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # Optional add-on?

    # Pricing override (if different from module's base price)
    override_price: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    override_pricing_model: Mapped[PricingModel | None] = mapped_column(
        SQLEnum(PricingModel), nullable=True
    )

    # Configuration override
    config_override: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Trial/promotional
    trial_only: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # Only during trial?
    promotional_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # Free until date?

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    plan: Mapped["ServicePlan"] = relationship("ServicePlan", back_populates="included_modules")
    module: Mapped["FeatureModule"] = relationship("FeatureModule")

    __table_args__ = (
        Index("ix_plan_modules_plan_module", "plan_id", "module_id", unique=True),
        {"extend_existing": True},
    )

    @property
    def config(self) -> dict[str, Any]:
        """Compatibility alias for configuration override."""
        return self.config_override

    @config.setter
    def config(self, value: dict[str, Any]) -> None:
        self.config_override = value


class PlanQuotaAllocation(Base):
    """
    Quota allocations for a service plan.

    Defines limits for quotas (users, subscribers, API calls, storage, etc.)
    """

    __tablename__ = "licensing_plan_quota_allocations"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Relationships
    plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_service_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quota_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_quota_definitions.id"), nullable=False, index=True
    )

    # Allocation
    included_quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # -1 = unlimited
    soft_limit: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # Warning threshold (e.g., 80%)

    # Overages
    allow_overage: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    overage_rate_override: Mapped[float | None] = mapped_column(
        Numeric(15, 4), nullable=True
    )  # Override quota's default rate

    # Tiered pricing (for volume-based)
    pricing_tiers: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    config_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    # Example: [{"from": 0, "to": 1000, "price": 0}, {"from": 1001, "to": 5000, "price": 0.01}]

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    plan: Mapped["ServicePlan"] = relationship("ServicePlan", back_populates="included_quotas")
    quota: Mapped["QuotaDefinition"] = relationship("QuotaDefinition")

    __table_args__ = (
        Index("ix_plan_quotas_plan_quota", "plan_id", "quota_id", unique=True),
        {"extend_existing": True},
    )

    @property
    def config(self) -> dict[str, Any]:
        """Compatibility alias for stored configuration data."""
        return self.config_data

    @config.setter
    def config(self, value: dict[str, Any]) -> None:
        self.config_data = value


# ==================== Tenant Subscriptions ====================


class TenantSubscription(Base):
    """Tenant's active subscription to a service plan."""

    __tablename__ = "licensing_tenant_subscriptions"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Tenant
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    # Plan relationship
    plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_service_plans.id"), nullable=False, index=True
    )

    # Subscription details
    status: Mapped[SubscriptionStatus] = mapped_column(
        SQLEnum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.TRIAL, index=True
    )
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        SQLEnum(BillingCycle), nullable=False, default=BillingCycle.MONTHLY
    )

    # Pricing (snapshot at time of subscription)
    monthly_price: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    annual_price: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Dates
    trial_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Billing
    auto_renew: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    billing_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_method_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Payment provider integration
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    paypal_subscription_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Extra metadata (renamed from 'metadata' to avoid SQLAlchemy reserved word)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    plan: Mapped["ServicePlan"] = relationship("ServicePlan")
    active_modules: Mapped[list["SubscriptionModule"]] = relationship(
        "SubscriptionModule", back_populates="subscription", cascade="all, delete-orphan"
    )
    quota_usage: Mapped[list["SubscriptionQuotaUsage"]] = relationship(
        "SubscriptionQuotaUsage", back_populates="subscription", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_tenant_subscriptions_tenant_status", "tenant_id", "status"),
        Index("ix_tenant_subscriptions_plan_status", "plan_id", "status"),
        {"extend_existing": True},
    )

    @property
    def modules(self) -> list["SubscriptionModule"]:
        """Compatibility alias for active_modules relationship."""
        return self.active_modules

    @property
    def quotas(self) -> list["SubscriptionQuotaUsage"]:
        """Compatibility alias for quota_usage relationship."""
        return self.quota_usage


class SubscriptionModule(Base):
    """
    Modules active in a tenant's subscription.

    Tracks which modules are enabled (from plan + add-ons).
    """

    __tablename__ = "licensing_subscription_modules"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Relationships
    subscription_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("licensing_tenant_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_feature_modules.id"), nullable=False, index=True
    )

    # Status
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Source
    source: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # PLAN, ADDON, TRIAL, PROMOTION, CUSTOM

    # Pricing (if add-on)
    addon_price: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)

    # Trial/promotion
    trial_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Configuration
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps
    activated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    subscription: Mapped["TenantSubscription"] = relationship(
        "TenantSubscription", back_populates="active_modules"
    )
    module: Mapped["FeatureModule"] = relationship("FeatureModule")

    __table_args__ = (
        Index(
            "ix_subscription_modules_subscription_module",
            "subscription_id",
            "module_id",
            unique=True,
        ),
        {"extend_existing": True},
    )


class SubscriptionQuotaUsage(Base):
    """Current quota usage for a tenant's subscription."""

    __tablename__ = "licensing_subscription_quota_usage"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Relationships
    subscription_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("licensing_tenant_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quota_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_quota_definitions.id"), nullable=False, index=True
    )

    # Allocation (from plan)
    allocated_quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # -1 = unlimited

    # Current usage
    current_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Period (for metered quotas)
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Overage tracking
    overage_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overage_charges: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)

    # Timestamps
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    subscription: Mapped["TenantSubscription"] = relationship(
        "TenantSubscription", back_populates="quota_usage"
    )
    quota: Mapped["QuotaDefinition"] = relationship("QuotaDefinition")

    __table_args__ = (
        Index(
            "ix_subscription_quota_usage_subscription_quota",
            "subscription_id",
            "quota_id",
            unique=True,
        ),
        {"extend_existing": True},
    )


# ==================== Usage & Events ====================


class FeatureUsageLog(Base):
    """Feature usage tracking for analytics."""

    __tablename__ = "licensing_feature_usage_logs"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Tenant
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Module/Capability
    module_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    capability_code: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    # User
    user_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)

    # Usage details
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Extra metadata (renamed from 'metadata' to avoid SQLAlchemy reserved word)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), index=True
    )

    __table_args__ = (
        Index("ix_feature_usage_tenant_module", "tenant_id", "module_id"),
        Index("ix_feature_usage_tenant_date", "tenant_id", "created_at"),
        {"extend_existing": True},
    )


class SubscriptionEvent(Base):
    """Subscription lifecycle events."""

    __tablename__ = "licensing_subscription_events"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Subscription
    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("licensing_tenant_subscriptions.id"), nullable=False, index=True
    )

    # Event details
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # State changes
    previous_plan_id: Mapped[UUID | None] = mapped_column(nullable=True)
    new_plan_id: Mapped[UUID | None] = mapped_column(nullable=True)
    previous_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Actor
    user_id: Mapped[UUID | None] = mapped_column(nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Event data
    event_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), index=True
    )

    __table_args__ = (
        Index("ix_subscription_events_subscription_type", "subscription_id", "event_type"),
        {"extend_existing": True},
    )
