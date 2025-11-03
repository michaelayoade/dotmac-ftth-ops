"""
ISP/Telecom SaaS Licensing Models.

Subscription-tier and feature-group based licensing for multi-tenant ISP platform.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
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

from ..db import BaseModel as BaseModelRuntime

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as BaseModelType
else:
    BaseModelType = BaseModelRuntime

# ==================== Enums ====================


class SubscriptionTier(str, Enum):
    """Subscription tiers for ISP platform."""

    STARTER = "STARTER"  # Basic features, limited users
    PROFESSIONAL = "PROFESSIONAL"  # Standard features, more users
    BUSINESS = "BUSINESS"  # Advanced features, high user count
    ENTERPRISE = "ENTERPRISE"  # All features, unlimited users
    CUSTOM = "CUSTOM"  # Custom negotiated tier


class BillingCycle(str, Enum):
    """Billing cycle options."""

    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ANNUALLY = "ANNUALLY"
    BIENNIAL = "BIENNIAL"  # 2 years
    TRIENNIAL = "TRIENNIAL"  # 3 years


class SubscriptionStatus(str, Enum):
    """Tenant subscription status."""

    TRIAL = "TRIAL"  # In trial period
    ACTIVE = "ACTIVE"  # Active subscription
    PAST_DUE = "PAST_DUE"  # Payment overdue but still active
    SUSPENDED = "SUSPENDED"  # Suspended due to non-payment
    CANCELLED = "CANCELLED"  # Cancelled by customer
    EXPIRED = "EXPIRED"  # Trial/subscription expired


class FeatureCategory(str, Enum):
    """Feature module categories."""

    # Core Platform
    CORE = "CORE"  # Basic platform features (always included)

    # Billing & Finance
    BILLING_BASIC = "BILLING_BASIC"  # Basic invoicing
    BILLING_ADVANCED = "BILLING_ADVANCED"  # Recurring, usage-based
    PAYMENTS = "PAYMENTS"  # Payment processing
    REVENUE_SHARING = "REVENUE_SHARING"  # Partner revenue management

    # Customer Management
    CRM = "CRM"  # Customer relationship management
    CUSTOMER_PORTAL = "CUSTOMER_PORTAL"  # Self-service portal

    # Network Management
    RADIUS = "RADIUS"  # RADIUS AAA
    NETWORK_MONITORING = "NETWORK_MONITORING"  # Real-time monitoring
    FIBER_MANAGEMENT = "FIBER_MANAGEMENT"  # Fiber infrastructure
    WIRELESS = "WIRELESS"  # Wireless infrastructure

    # OSS Integrations
    NETBOX = "NETBOX"  # NetBox IPAM/DCIM
    GENIEACS = "GENIEACS"  # GenieACS CPE management
    VOLTHA = "VOLTHA"  # VOLTHA OLT management
    WIREGUARD = "WIREGUARD"  # WireGuard VPN

    # Service Management
    ORCHESTRATION = "ORCHESTRATION"  # Service orchestration
    PROVISIONING = "PROVISIONING"  # Auto-provisioning
    SCHEDULER = "SCHEDULER"  # Task scheduling

    # Analytics & Reporting
    ANALYTICS_BASIC = "ANALYTICS_BASIC"  # Basic dashboards
    ANALYTICS_ADVANCED = "ANALYTICS_ADVANCED"  # Advanced analytics
    USAGE_BILLING = "USAGE_BILLING"  # Usage-based billing

    # Communications
    EMAIL = "EMAIL"  # Email notifications
    SMS = "SMS"  # SMS notifications
    WEBHOOKS = "WEBHOOKS"  # Webhook integrations

    # Advanced Features
    AUTOMATION = "AUTOMATION"  # Workflow automation
    API_ACCESS = "API_ACCESS"  # API access
    GRAPHQL = "GRAPHQL"  # GraphQL API
    WHITE_LABEL = "WHITE_LABEL"  # White-label branding
    MULTI_CURRENCY = "MULTI_CURRENCY"  # Multi-currency support


class QuotaType(str, Enum):
    """Quota measurement types."""

    USERS = "USERS"  # Number of staff users
    CUSTOMERS = "CUSTOMERS"  # Number of customers
    API_CALLS = "API_CALLS"  # API calls per month
    STORAGE_GB = "STORAGE_GB"  # Storage in GB
    BANDWIDTH_TB = "BANDWIDTH_TB"  # Bandwidth in TB
    TICKETS = "TICKETS"  # Support tickets per month
    INVOICES = "INVOICES"  # Invoices per month
    SESSIONS = "SESSIONS"  # Concurrent sessions


# ==================== Models ====================


class SubscriptionPlan(BaseModelType):
    """Subscription plan/tier definition."""

    __tablename__ = "subscription_plans"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, insert_default=lambda: uuid4()
    )

    # Plan details
    plan_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    plan_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    tier: Mapped[SubscriptionTier] = mapped_column(
        SQLEnum(SubscriptionTier), nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing
    monthly_price: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    annual_price: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    setup_fee: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Trial
    trial_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Metadata
    custom_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )

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
    plan_features: Mapped[list["PlanFeature"]] = relationship(
        "PlanFeature", back_populates="plan", cascade="all, delete-orphan"
    )
    plan_quotas: Mapped[list["PlanQuota"]] = relationship(
        "PlanQuota", back_populates="plan", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_subscription_plans_tier", "tier"),
        Index("ix_subscription_plans_active", "is_active", "is_public"),
        {"extend_existing": True},
    )


class PlanFeature(BaseModelType):
    """Features included in a subscription plan."""

    __tablename__ = "plan_features"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, insert_default=lambda: uuid4()
    )

    # Plan relationship
    plan_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("subscription_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Feature details
    feature_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    feature_category: Mapped[FeatureCategory] = mapped_column(
        SQLEnum(FeatureCategory), nullable=False, index=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Configuration
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    plan: Mapped["SubscriptionPlan"] = relationship(
        "SubscriptionPlan", back_populates="plan_features"
    )

    __table_args__ = (
        Index("ix_plan_features_plan_feature", "plan_id", "feature_code", unique=True),
        Index("ix_plan_features_category", "feature_category"),
        {"extend_existing": True},
    )


class PlanQuota(BaseModelType):
    """Resource quotas for a subscription plan."""

    __tablename__ = "plan_quotas"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, insert_default=lambda: uuid4()
    )

    # Plan relationship
    plan_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("subscription_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Quota details
    quota_type: Mapped[QuotaType] = mapped_column(SQLEnum(QuotaType), nullable=False, index=True)
    quota_limit: Mapped[int] = mapped_column(Integer, nullable=False)  # -1 = unlimited
    soft_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Warning threshold

    # Billing
    overage_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    overage_rate: Mapped[float | None] = mapped_column(Numeric(15, 4), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    plan: Mapped["SubscriptionPlan"] = relationship(
        "SubscriptionPlan", back_populates="plan_quotas"
    )

    __table_args__ = (
        Index("ix_plan_quotas_plan_type", "plan_id", "quota_type", unique=True),
        {"extend_existing": True},
    )


class TenantSubscription(BaseModelType):
    """Tenant's active subscription."""

    __tablename__ = "tenant_subscriptions"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, insert_default=lambda: uuid4()
    )

    # Tenant
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)

    # Plan relationship
    plan_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False, index=True
    )

    # Subscription details
    status: Mapped[SubscriptionStatus] = mapped_column(
        SQLEnum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.TRIAL, index=True
    )
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        SQLEnum(BillingCycle), nullable=False, default=BillingCycle.MONTHLY
    )

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

    # Billing integration
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    paypal_subscription_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Metadata
    custom_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )

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
    plan: Mapped["SubscriptionPlan"] = relationship("SubscriptionPlan")
    custom_features: Mapped[list["TenantFeatureOverride"]] = relationship(
        "TenantFeatureOverride", back_populates="subscription", cascade="all, delete-orphan"
    )
    quota_usage: Mapped[list["TenantQuotaUsage"]] = relationship(
        "TenantQuotaUsage", back_populates="subscription", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_tenant_subscriptions_tenant_status", "tenant_id", "status"),
        Index("ix_tenant_subscriptions_plan_status", "plan_id", "status"),
        {"extend_existing": True},
    )


class TenantFeatureOverride(BaseModelType):
    """Tenant-specific feature overrides (add-ons or custom negotiated features)."""

    __tablename__ = "tenant_feature_overrides"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, insert_default=lambda: uuid4()
    )

    # Subscription relationship
    subscription_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("tenant_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Feature details
    feature_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    feature_category: Mapped[FeatureCategory] = mapped_column(
        SQLEnum(FeatureCategory), nullable=False, index=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Override reason
    override_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # ADD_ON, CUSTOM, TRIAL, PROMOTION

    # Pricing (if add-on)
    monthly_fee: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)

    # Expiry (for trials/promotions)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Configuration
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    subscription: Mapped["TenantSubscription"] = relationship(
        "TenantSubscription", back_populates="custom_features"
    )

    __table_args__ = (
        Index(
            "ix_tenant_features_subscription_feature",
            "subscription_id",
            "feature_code",
            unique=True,
        ),
        {"extend_existing": True},
    )


class TenantQuotaUsage(BaseModelType):
    """Current quota usage for tenant."""

    __tablename__ = "tenant_quota_usage"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, insert_default=lambda: uuid4()
    )

    # Subscription relationship
    subscription_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("tenant_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Quota details
    quota_type: Mapped[QuotaType] = mapped_column(SQLEnum(QuotaType), nullable=False, index=True)
    current_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quota_limit: Mapped[int] = mapped_column(Integer, nullable=False)  # -1 = unlimited

    # Period (for monthly quotas like API calls)
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Overage
    overage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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

    __table_args__ = (
        Index(
            "ix_tenant_quota_usage_subscription_type", "subscription_id", "quota_type", unique=True
        ),
        {"extend_existing": True},
    )


class FeatureUsageLog(BaseModelType):
    """Feature usage tracking for analytics."""

    __tablename__ = "feature_usage_logs"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, insert_default=lambda: uuid4()
    )

    # Tenant
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Feature
    feature_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    feature_category: Mapped[FeatureCategory] = mapped_column(
        SQLEnum(FeatureCategory), nullable=False, index=True
    )

    # User
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    # Usage details
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # VIEW, CREATE, UPDATE, DELETE
    resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Metadata
    custom_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), index=True
    )

    __table_args__ = (
        Index("ix_feature_usage_tenant_feature", "tenant_id", "feature_code"),
        Index("ix_feature_usage_tenant_date", "tenant_id", "created_at"),
        {"extend_existing": True},
    )


class SubscriptionEvent(BaseModelType):
    """Subscription lifecycle events."""

    __tablename__ = "subscription_events"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, insert_default=lambda: uuid4()
    )

    # Subscription
    subscription_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True), ForeignKey("tenant_subscriptions.id"), nullable=False, index=True
    )

    # Event details
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # CREATED, UPGRADED, DOWNGRADED, RENEWED, CANCELLED, SUSPENDED, REACTIVATED, EXPIRED

    # Previous/new values
    previous_plan_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    new_plan_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    previous_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Actor
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Event data
    event_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), index=True
    )

    __table_args__ = (
        Index("ix_subscription_events_subscription_type", "subscription_id", "event_type"),
        Index("ix_subscription_events_created_at", "created_at"),
        {"extend_existing": True},
    )
