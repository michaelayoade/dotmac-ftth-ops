"""
Usage Billing Models for metered and pay-as-you-go services.

Supports granular usage tracking, aggregation, and billing for ISP services.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import GUID, AuditMixin, Base, TenantMixin, TimestampMixin


class UsageType(str, Enum):
    """Types of usage that can be metered and billed."""

    DATA_TRANSFER = "data_transfer"  # Internet data usage
    VOICE_MINUTES = "voice_minutes"  # VoIP call minutes
    SMS_COUNT = "sms_count"  # SMS messages sent
    BANDWIDTH_GB = "bandwidth_gb"  # Bandwidth consumption
    OVERAGE_GB = "overage_gb"  # Data overage charges
    STATIC_IP = "static_ip"  # Static IP address rental
    EQUIPMENT_RENTAL = "equipment_rental"  # CPE/ONT rental
    INSTALLATION_FEE = "installation_fee"  # One-time installation
    CUSTOM = "custom"  # Custom usage types


class BilledStatus(str, Enum):
    """Status of usage record in billing cycle."""

    PENDING = "pending"  # Not yet billed
    BILLED = "billed"  # Included in invoice
    ERROR = "error"  # Billing failed
    EXCLUDED = "excluded"  # Excluded from billing (free tier, etc)


class UsageRecord(Base, TimestampMixin, TenantMixin, AuditMixin):  # type: ignore[misc]  # Mixin has type Any
    """
    Individual usage record for metered billing.

    Each record represents a specific usage event or aggregated usage
    over a time period (e.g., hourly, daily data usage).
    """

    __tablename__ = "usage_records"

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)

    # Foreign keys
    subscription_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Related subscription",
    )
    customer_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Customer who incurred usage",
    )

    # Usage details
    usage_type: Mapped[UsageType] = mapped_column(
        SQLEnum(UsageType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
        comment="Type of metered usage",
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(20, 6),
        nullable=False,
        comment="Usage quantity (e.g., 15.5 GB, 120 minutes)",
    )
    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Unit of measurement (GB, minutes, count, etc)",
    )

    # Pricing
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 6),
        nullable=False,
        comment="Price per unit in major currency units (e.g., 0.10 USD/GB), not cents",
    )
    total_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Total charge in cents (quantity * unit_price)",
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
        comment="Currency code (ISO 4217)",
    )

    # Billing period
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Start of usage period",
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="End of usage period",
    )

    # Billing status
    billed_status: Mapped[BilledStatus] = mapped_column(
        SQLEnum(BilledStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=BilledStatus.PENDING,
        index=True,
        comment="Billing status",
    )
    invoice_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Invoice this usage was billed on",
    )
    billed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When usage was billed",
    )

    # Source tracking
    source_system: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Source system (radius, api, import, etc)",
    )
    source_record_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="External source record identifier",
    )

    # Additional metadata
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Human-readable description",
    )
    device_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Device/equipment identifier",
    )
    service_location: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Service address if applicable",
    )

    __table_args__ = (
        Index("ix_usage_tenant_subscription", "tenant_id", "subscription_id"),
        Index("ix_usage_tenant_customer", "tenant_id", "customer_id"),
        Index("ix_usage_tenant_period", "tenant_id", "period_start", "period_end"),
        Index("ix_usage_billed_status_period", "billed_status", "period_end"),
        Index("ix_usage_type_period", "usage_type", "period_start"),
    )

    def __repr__(self) -> str:
        return (
            f"<UsageRecord(id={self.id}, type={self.usage_type}, "
            f"qty={self.quantity} {self.unit}, amount=${self.total_amount / 100:.2f})>"
        )


class UsageAggregate(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]  # Mixin has type Any
    """
    Pre-aggregated usage statistics for reporting and dashboards.

    Aggregated daily/monthly to reduce query load for analytics.
    """

    __tablename__ = "usage_aggregates"

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)

    # Aggregation dimensions
    tenant_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    subscription_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Subscription-level aggregate (null = tenant-level)",
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        GUID,
        nullable=True,
        index=True,
        comment="Customer-level aggregate",
    )

    usage_type: Mapped[UsageType] = mapped_column(
        SQLEnum(UsageType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )

    # Time period
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    period_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Aggregation period: hourly, daily, monthly",
    )

    # Aggregated metrics
    total_quantity: Mapped[Decimal] = mapped_column(
        Numeric(20, 6),
        nullable=False,
        comment="Sum of quantity",
    )
    total_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sum of total_amount in cents",
    )
    record_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Number of records aggregated",
    )

    # Min/Max for range queries
    min_quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(20, 6),
        nullable=True,
    )
    max_quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(20, 6),
        nullable=True,
    )

    __table_args__ = (
        Index(
            "ix_usage_agg_unique",
            "tenant_id",
            "subscription_id",
            "usage_type",
            "period_start",
            "period_type",
            unique=True,
        ),
        Index("ix_usage_agg_tenant_period", "tenant_id", "period_start", "period_type"),
    )

    def __repr__(self) -> str:
        return (
            f"<UsageAggregate(type={self.usage_type}, period={self.period_type}, "
            f"qty={self.total_quantity}, amount=${self.total_amount / 100:.2f})>"
        )


__all__ = [
    "UsageRecord",
    "UsageAggregate",
    "UsageType",
    "BilledStatus",
]
