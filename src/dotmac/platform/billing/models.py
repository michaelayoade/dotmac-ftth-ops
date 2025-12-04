"""
Base billing models and database tables.

Provides foundation for all billing system components.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from pydantic import Field
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.billing.core.models import (
    Customer,
    Invoice,
    InvoiceItem,
    InvoiceLineItem,
    Payment,
    Price,
    Product,
    Subscription,
)
from dotmac.platform.core.pydantic import AppBaseModel
from dotmac.platform.db import BaseModel as SQLBaseModel


class BillingBaseModel(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Base model for all billing entities with common fields."""

    tenant_id: str = Field(description="Tenant identifier for multi-tenancy")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Creation timestamp"
    )
    updated_at: datetime | None = Field(None, description="Last update timestamp")


class BillingSQLModel(SQLBaseModel):  # type: ignore[misc]  # SQLBaseModel resolves to Any in isolation
    """Base SQLAlchemy model for billing tables."""

    __abstract__ = True

    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )


class BillingProductTable(BillingSQLModel):
    """SQLAlchemy table for billing products."""

    __tablename__ = "billing_products"

    # Primary key
    product_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Product identification
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Categorization
    category: Mapped[str] = mapped_column(String(100), nullable=False)

    # Product type and pricing
    product_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # one_time, subscription, usage_based, hybrid
    base_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Tax classification
    tax_class: Mapped[str] = mapped_column(String(20), nullable=False, default="standard")

    # Usage-based configuration
    usage_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    usage_unit_name: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Indexes for performance
    __table_args__ = (
        Index("ix_billing_products_tenant_sku", "tenant_id", "sku", unique=True),
        Index("ix_billing_products_tenant_category", "tenant_id", "category"),
        Index("ix_billing_products_tenant_type", "tenant_id", "product_type"),
        Index("ix_billing_products_tenant_active", "tenant_id", "is_active"),
        UniqueConstraint("product_id", name="uq_billing_products_product_id"),
        UniqueConstraint("tenant_id", "product_id", name="uq_billing_products_tenant_product"),
        {"extend_existing": True},
    )


class BillingProductCategoryTable(BillingSQLModel):
    """SQLAlchemy table for product categories."""

    __tablename__ = "billing_product_categories"

    # Primary key
    category_id = Column(String(50), primary_key=True)

    # Category details
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Tax defaults
    default_tax_class = Column(String(20), nullable=False, default="standard")

    # Display order
    sort_order = Column(Numeric(10, 0), nullable=False, default=0)

    # Indexes
    __table_args__ = (
        Index("ix_billing_categories_tenant_name", "tenant_id", "name", unique=True),
        Index("ix_billing_categories_sort", "tenant_id", "sort_order"),
        {"extend_existing": True},
    )


class BillingSubscriptionPlanTable(BillingSQLModel):
    """SQLAlchemy table for subscription plans."""

    __tablename__ = "billing_subscription_plans"

    # Primary key
    plan_id = Column(String(50), primary_key=True)

    # Associated product
    product_id = Column(String(50), nullable=False)

    # Plan details
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Billing configuration
    billing_cycle = Column(String(20), nullable=False)  # monthly, quarterly, annual
    price = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    setup_fee = Column(Numeric(15, 2), nullable=True)

    # Trial configuration
    trial_days = Column(Numeric(10, 0), nullable=True)

    # Usage allowances (JSON)
    included_usage = Column(JSON, nullable=False, default=dict)
    overage_rates = Column(JSON, nullable=False, default=dict)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Indexes
    __table_args__ = (
        Index("ix_billing_plans_tenant_product", "tenant_id", "product_id"),
        Index("ix_billing_plans_tenant_active", "tenant_id", "is_active"),
        {"extend_existing": True},
    )


class BillingSubscriptionTable(BillingSQLModel):
    """SQLAlchemy table for customer subscriptions."""

    __tablename__ = "billing_subscriptions"

    # Primary key
    subscription_id = Column(String(50), primary_key=True)

    # Customer and plan references
    customer_id = Column(String(50), nullable=False)
    plan_id = Column(String(50), nullable=False)

    # Current billing period
    current_period_start = Column(DateTime(timezone=True), nullable=False)
    current_period_end = Column(DateTime(timezone=True), nullable=False)

    # Status
    status = Column(String(20), nullable=False)  # trial, active, past_due, canceled, ended

    # Trial information
    trial_end = Column(DateTime(timezone=True), nullable=True)

    # Cancellation
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    canceled_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Pricing overrides
    custom_price = Column(Numeric(15, 2), nullable=True)

    # Usage tracking (JSON)
    usage_records = Column(JSON, nullable=False, default=dict)

    # Indexes
    __table_args__ = (
        Index("ix_billing_subscriptions_tenant_customer", "tenant_id", "customer_id"),
        Index("ix_billing_subscriptions_tenant_plan", "tenant_id", "plan_id"),
        Index("ix_billing_subscriptions_tenant_status", "tenant_id", "status"),
        Index("ix_billing_subscriptions_period_end", "current_period_end"),
        {"extend_existing": True},
    )


class BillingSubscriptionEventTable(BillingSQLModel):
    """SQLAlchemy table for subscription events (audit trail)."""

    __tablename__ = "billing_subscription_events"

    # Primary key
    event_id = Column(String(50), primary_key=True)

    # Related subscription
    subscription_id = Column(String(50), nullable=False)

    # Event details
    event_type = Column(String(50), nullable=False)
    event_data = Column(JSON, nullable=False, default=dict)

    # User who triggered event
    user_id = Column(String(50), nullable=True)

    # Indexes
    __table_args__ = (
        Index("ix_billing_events_tenant_subscription", "tenant_id", "subscription_id"),
        Index("ix_billing_events_tenant_type", "tenant_id", "event_type"),
        Index("ix_billing_events_created", "created_at"),
        {"extend_existing": True},
    )


class BillingPricingRuleTable(BillingSQLModel):
    """SQLAlchemy table for pricing rules."""

    __tablename__ = "billing_pricing_rules"

    # Primary key
    rule_id: Mapped[str] = mapped_column(String(50), primary_key=True)

    # Rule details
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Rule targeting (JSON arrays)
    applies_to_product_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    applies_to_categories: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    applies_to_all: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Simple conditions
    min_quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 0), nullable=True)
    customer_segments: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # Discount configuration
    discount_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # percentage, fixed_amount, fixed_price
    discount_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    # Time constraints
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Usage limits
    max_uses: Mapped[Decimal | None] = mapped_column(Numeric(10, 0), nullable=True)
    current_uses: Mapped[Decimal] = mapped_column(Numeric(10, 0), nullable=False, default=0)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Indexes
    __table_args__ = (
        Index("ix_billing_rules_tenant_active", "tenant_id", "is_active"),
        Index("ix_billing_rules_starts_ends", "starts_at", "ends_at"),
        {"extend_existing": True},
    )


class BillingRuleUsageTable(BillingSQLModel):
    """SQLAlchemy table for tracking pricing rule usage."""

    __tablename__ = "billing_rule_usage"

    # Primary key
    usage_id = Column(String(50), primary_key=True)

    # References
    rule_id = Column(String(50), nullable=False)
    customer_id = Column(String(50), nullable=False)
    invoice_id = Column(String(50), nullable=True)  # Links to existing invoice system

    # Usage timestamp
    used_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    # Indexes
    __table_args__ = (
        Index("ix_billing_rule_usage_tenant_rule", "tenant_id", "rule_id"),
        Index("ix_billing_rule_usage_tenant_customer", "tenant_id", "customer_id"),
        Index("ix_billing_rule_usage_used_at", "used_at"),
        {"extend_existing": True},
    )


class BillingAddonTable(BillingSQLModel):
    """SQLAlchemy table for billing add-ons catalog."""

    __tablename__ = "billing_addons"

    # Primary key
    addon_id = Column(String(50), primary_key=True)

    # Basic information
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    addon_type = Column(
        String(20), nullable=False
    )  # feature, resource, service, user_seats, integration
    billing_type = Column(String(20), nullable=False)  # one_time, recurring, metered

    # Pricing
    price = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    setup_fee = Column(Numeric(15, 2), nullable=True)

    # Quantity configuration
    is_quantity_based: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    min_quantity = Column(Numeric(10, 0), nullable=False, default=1)
    max_quantity = Column(Numeric(10, 0), nullable=True)

    # Metered billing configuration
    metered_unit = Column(String(50), nullable=True)
    included_quantity = Column(Numeric(10, 0), nullable=True)

    # Availability
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Plan compatibility
    compatible_with_all_plans: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    compatible_plan_ids = Column(JSON, nullable=False, default=list)

    # Metadata
    icon = Column(String(255), nullable=True)
    features = Column(JSON, nullable=False, default=list)

    # Indexes
    __table_args__ = (
        Index("ix_billing_addons_tenant_active", "tenant_id", "is_active"),
        Index("ix_billing_addons_tenant_type", "tenant_id", "addon_type"),
        Index("ix_billing_addons_tenant_billing_type", "tenant_id", "billing_type"),
        Index("ix_billing_addons_tenant_featured", "tenant_id", "is_featured"),
        {"extend_existing": True},
    )


class BillingTenantAddonTable(BillingSQLModel):
    """SQLAlchemy table for tenant's purchased add-ons."""

    __tablename__ = "billing_tenant_addons"

    # Primary key
    tenant_addon_id = Column(String(50), primary_key=True)
    addon_id = Column(String(50), nullable=False)

    # Subscription association
    subscription_id = Column(String(50), nullable=True)

    # Current state
    status = Column(
        String(20), nullable=False, default="active"
    )  # active, canceled, ended, suspended
    quantity = Column(Numeric(10, 0), nullable=False, default=1)

    # Billing dates
    started_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    canceled_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Usage tracking (for metered add-ons)
    current_usage = Column(Numeric(10, 0), nullable=False, default=0)

    # Indexes
    __table_args__ = (
        Index("ix_billing_tenant_addons_tenant", "tenant_id"),
        Index("ix_billing_tenant_addons_tenant_status", "tenant_id", "status"),
        Index("ix_billing_tenant_addons_addon", "addon_id"),
        Index("ix_billing_tenant_addons_subscription", "subscription_id"),
        Index("ix_billing_tenant_addons_period_end", "current_period_end"),
        {"extend_existing": True},
    )


class BillingSettingsTable(BillingSQLModel):
    """SQLAlchemy table for tenant billing settings."""

    __tablename__ = "billing_settings"

    settings_id: Mapped[str] = mapped_column(
        String(50), primary_key=True, default=lambda: str(uuid4())
    )
    company_info: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    tax_settings: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    payment_settings: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    invoice_settings: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    notification_settings: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    features_enabled: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    custom_settings: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    api_settings: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_billing_settings_tenant"),
        {"extend_existing": True},
    )


__all__ = [
    "BillingBaseModel",
    "BillingSQLModel",
    "BillingProductTable",
    "BillingProductCategoryTable",
    "BillingSubscriptionPlanTable",
    "BillingSubscriptionTable",
    "BillingSubscriptionEventTable",
    "BillingPricingRuleTable",
    "BillingRuleUsageTable",
    "BillingAddonTable",
    "BillingTenantAddonTable",
    "BillingSettingsTable",
    # Core models
    "Invoice",
    "InvoiceLineItem",
    "Payment",
    "Customer",
    "Subscription",
    "Product",
    "Price",
    "InvoiceItem",
]
