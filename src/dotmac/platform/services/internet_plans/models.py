"""
ISP Internet Service Plan Models

Defines internet service plans with bandwidth tiers, data caps, time-based
restrictions, and comprehensive validation for ISP operations.
"""

from datetime import datetime, time
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, Integer, Numeric, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import AuditMixin, Base, TenantMixin, TimestampMixin


class SpeedUnit(str, Enum):
    """Speed measurement units."""

    KBPS = "kbps"
    MBPS = "mbps"
    GBPS = "gbps"


class DataUnit(str, Enum):
    """Data measurement units."""

    MB = "MB"
    GB = "GB"
    TB = "TB"
    UNLIMITED = "unlimited"


class PlanType(str, Enum):
    """Internet plan types."""

    RESIDENTIAL = "residential"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"
    PROMOTIONAL = "promotional"


class BillingCycle(str, Enum):
    """Billing cycle intervals."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class ThrottlePolicy(str, Enum):
    """Data cap throttle policies."""

    NO_THROTTLE = "no_throttle"  # No action after cap
    THROTTLE = "throttle"  # Reduce speed after cap
    BLOCK = "block"  # Block traffic after cap
    OVERAGE_CHARGE = "overage_charge"  # Charge for overage


class PlanStatus(str, Enum):
    """Plan availability status."""

    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class InternetServicePlan(Base, TenantMixin, TimestampMixin, AuditMixin):
    """
    ISP Internet Service Plan with bandwidth, caps, and time-based rules.

    Defines complete internet service offerings including:
    - Upload/download speeds
    - Data caps and throttle policies
    - Time-based restrictions (e.g., night-time unlimited)
    - QoS priorities
    - Fair usage policies
    """

    __tablename__ = "internet_service_plans"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Plan identification
    plan_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    plan_type: Mapped[PlanType] = mapped_column(nullable=False, index=True)
    status: Mapped[PlanStatus] = mapped_column(default=PlanStatus.DRAFT, index=True)

    # Speed configuration
    download_speed: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    upload_speed: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    speed_unit: Mapped[SpeedUnit] = mapped_column(default=SpeedUnit.MBPS)

    # Burst speed (temporary speed boost)
    burst_download_speed: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    burst_upload_speed: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    burst_duration_seconds: Mapped[int | None] = mapped_column(Integer)

    # Data cap configuration
    has_data_cap: Mapped[bool] = mapped_column(default=False)
    data_cap_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    data_cap_unit: Mapped[DataUnit | None] = mapped_column()
    throttle_policy: Mapped[ThrottlePolicy] = mapped_column(default=ThrottlePolicy.NO_THROTTLE)

    # Throttled speeds (after cap)
    throttled_download_speed: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    throttled_upload_speed: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    # Overage charges
    overage_price_per_unit: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    overage_unit: Mapped[DataUnit | None] = mapped_column()

    # Fair Usage Policy (FUP)
    has_fup: Mapped[bool] = mapped_column(default=False)
    fup_threshold: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    fup_threshold_unit: Mapped[DataUnit | None] = mapped_column()
    fup_throttle_speed: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    # Time-based restrictions (e.g., unlimited nights)
    has_time_restrictions: Mapped[bool] = mapped_column(default=False)
    unrestricted_start_time: Mapped[time | None] = mapped_column(Time)
    unrestricted_end_time: Mapped[time | None] = mapped_column(Time)
    unrestricted_data_unlimited: Mapped[bool] = mapped_column(default=False)
    unrestricted_speed_multiplier: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))

    # QoS and priority
    qos_priority: Mapped[int] = mapped_column(Integer, default=50)  # 0-100, higher = better
    traffic_shaping_enabled: Mapped[bool] = mapped_column(default=False)

    # Pricing
    monthly_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    setup_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    billing_cycle: Mapped[BillingCycle] = mapped_column(default=BillingCycle.MONTHLY)

    # Availability
    is_public: Mapped[bool] = mapped_column(default=True)
    is_promotional: Mapped[bool] = mapped_column(default=False)
    promotion_start_date: Mapped[datetime | None] = mapped_column()
    promotion_end_date: Mapped[datetime | None] = mapped_column()

    # Contract terms
    minimum_contract_months: Mapped[int] = mapped_column(Integer, default=0)
    early_termination_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))

    # Technical specifications
    contention_ratio: Mapped[str | None] = mapped_column(String(20))  # e.g., "1:20", "1:50"
    ipv4_included: Mapped[bool] = mapped_column(default=True)
    ipv6_included: Mapped[bool] = mapped_column(default=True)
    static_ip_included: Mapped[bool] = mapped_column(default=False)
    static_ip_count: Mapped[int] = mapped_column(Integer, default=0)

    # Additional services
    router_included: Mapped[bool] = mapped_column(default=False)
    installation_included: Mapped[bool] = mapped_column(default=False)
    technical_support_level: Mapped[str | None] = mapped_column(
        String(50)
    )  # basic, standard, premium

    # Metadata
    tags: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    features: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    restrictions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Validation results
    last_validated_at: Mapped[datetime | None] = mapped_column()
    validation_status: Mapped[str | None] = mapped_column(String(20))  # passed, failed, pending
    validation_errors: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    subscriptions: Mapped[list["PlanSubscription"]] = relationship(
        back_populates="plan", lazy="select"
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("download_speed > 0", name="check_download_speed_positive"),
        CheckConstraint("upload_speed > 0", name="check_upload_speed_positive"),
        CheckConstraint("monthly_price >= 0", name="check_monthly_price_non_negative"),
        CheckConstraint(
            "qos_priority >= 0 AND qos_priority <= 100", name="check_qos_priority_range"
        ),
        Index("idx_plan_tenant_status", "tenant_id", "status"),
        Index("idx_plan_type_status", "plan_type", "status"),
        Index("idx_plan_code", "plan_code"),
    )

    def __repr__(self) -> str:
        return (
            f"<InternetServicePlan(id={self.id}, code={self.plan_code}, "
            f"name={self.name}, speed={self.download_speed}{self.speed_unit})>"
        )

    def get_speed_mbps(self, download: bool = True) -> Decimal:
        """Get speed in Mbps regardless of unit."""
        speed = self.download_speed if download else self.upload_speed

        if self.speed_unit == SpeedUnit.KBPS:
            return speed / 1000
        elif self.speed_unit == SpeedUnit.GBPS:
            return speed * 1000
        return speed

    def get_data_cap_gb(self) -> Decimal | None:
        """Get data cap in GB."""
        if not self.has_data_cap or not self.data_cap_amount:
            return None

        if self.data_cap_unit == DataUnit.MB:
            return self.data_cap_amount / 1024
        elif self.data_cap_unit == DataUnit.TB:
            return self.data_cap_amount * 1024
        elif self.data_cap_unit == DataUnit.UNLIMITED:
            return None
        return self.data_cap_amount

    def is_unlimited(self) -> bool:
        """Check if plan has unlimited data."""
        return not self.has_data_cap or self.data_cap_unit == DataUnit.UNLIMITED

    def is_promotional_active(self) -> bool:
        """Check if promotion is currently active."""
        if not self.is_promotional:
            return False

        now = datetime.utcnow()
        if self.promotion_start_date and now < self.promotion_start_date:
            return False
        if self.promotion_end_date and now > self.promotion_end_date:
            return False

        return True


class PlanSubscription(Base, TenantMixin, TimestampMixin):
    """
    Tracks customer subscriptions to internet service plans.
    """

    __tablename__ = "plan_subscriptions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # References
    plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("internet_service_plans.id"), nullable=False, index=True
    )
    customer_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    subscriber_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("subscribers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Link to RADIUS subscriber for usage tracking",
    )
    subscription_id: Mapped[UUID | None] = mapped_column()  # Link to billing subscription

    # Subscription details
    start_date: Mapped[datetime] = mapped_column(nullable=False)
    end_date: Mapped[datetime | None] = mapped_column()
    is_active: Mapped[bool] = mapped_column(default=True, index=True)

    # Custom overrides (if different from plan defaults)
    custom_download_speed: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    custom_upload_speed: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    custom_data_cap: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    custom_monthly_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    # Usage tracking
    current_period_usage_gb: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0.00")
    )
    last_usage_reset: Mapped[datetime | None] = mapped_column()

    # Status
    is_suspended: Mapped[bool] = mapped_column(default=False)
    suspension_reason: Mapped[str | None] = mapped_column(String(255))

    # Relationships
    plan: Mapped["InternetServicePlan"] = relationship(back_populates="subscriptions")

    __table_args__ = (
        Index("idx_subscription_customer_active", "customer_id", "is_active"),
        Index("idx_subscription_plan_active", "plan_id", "is_active"),
    )
