"""
License Models for Control Plane

Defines plans, license tokens, and related types.
"""

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

import jwt
from sqlalchemy import JSON, Boolean, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import Base, TimestampMixin


class OveragePolicy(str, Enum):
    """Policy for handling subscriber cap overages."""
    BLOCK = "block"
    WARN = "warn"
    ALLOW_AND_BILL = "allow_and_bill"


class PlanTier(str, Enum):
    """Plan tier levels."""
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    CUSTOM = "custom"


# SQLAlchemy Models

class TenantPlan(Base, TimestampMixin):
    """
    Plan definition for tenant licenses.

    Each plan defines limits and features available to tenants.
    """
    __tablename__ = "tenant_plans"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    tier: Mapped[PlanTier] = mapped_column(SQLEnum(PlanTier), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Limits
    max_subscribers: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    max_staff_users: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    max_api_calls_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=10000)
    max_storage_gb: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    # Overage handling
    overage_policy: Mapped[OveragePolicy] = mapped_column(
        SQLEnum(OveragePolicy),
        nullable=False,
        default=OveragePolicy.BLOCK
    )
    overage_rate_per_subscriber: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # In cents

    # Features (JSON blob)
    features: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Pricing (in cents)
    monthly_price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    annual_price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    tenant_licenses: Mapped[list["TenantLicense"]] = relationship(
        "TenantLicense", back_populates="plan"
    )

    def get_default_features(self) -> dict[str, bool]:
        """Get default features for this plan."""
        defaults = {
            "radius": True,
            "field_service": self.tier in [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
            "advanced_analytics": self.tier in [PlanTier.ENTERPRISE],
            "multi_site": self.tier == PlanTier.ENTERPRISE,
            "api_access": self.tier != PlanTier.STARTER,
            "white_label": self.tier == PlanTier.ENTERPRISE,
            "webhooks": self.tier != PlanTier.STARTER,
            "custom_domain": self.tier in [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
        }
        # Merge with custom features
        return {**defaults, **self.features}


class TenantLicense(Base, TimestampMixin):
    """
    License record for a tenant.

    Tracks the current license state, version, and usage.
    """
    __tablename__ = "tenant_licenses"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenant_plans.id"),
        nullable=False,
    )

    # License state
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    nonce: Mapped[str] = mapped_column(String(64), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Last signed token (for quick retrieval)
    signed_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Usage tracking (latest snapshot)
    last_reported_subscribers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_usage_report_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Status
    is_over_cap: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    plan: Mapped["TenantPlan"] = relationship("TenantPlan", back_populates="tenant_licenses")

    def is_expired(self) -> bool:
        """Check if license has expired."""
        return datetime.utcnow() > self.expires_at


class UsageSnapshot(Base, TimestampMixin):
    """
    Usage snapshot reported by ISP instance.

    Stores historical usage data for billing and analytics.
    """
    __tablename__ = "usage_snapshots"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )

    # Idempotency
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    # Timestamp from ISP instance
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Metrics
    active_subscribers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_subscribers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    api_calls_24h: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    radius_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Validation
    signature_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


# Dataclass for JWT token (non-ORM)
@dataclass
class LicenseToken:
    """
    Signed license blob sent to ISP instance.

    This is the JWT payload structure.
    """
    tenant_id: str
    max_subscribers: int
    overage_policy: OveragePolicy
    features: dict[str, bool]
    issued_at: datetime
    expires_at: datetime
    nonce: str
    version: int
    warn_threshold_percent: int = 80
    critical_threshold_percent: int = 90
    grace_period_hours: int = 24

    def to_jwt(self, secret_key: str) -> str:
        """Sign license as JWT."""
        payload = {
            "tenant_id": self.tenant_id,
            "max_subscribers": self.max_subscribers,
            "overage_policy": self.overage_policy.value,
            "features": self.features,
            "iat": int(self.issued_at.timestamp()),
            "exp": int(self.expires_at.timestamp()),
            "nonce": self.nonce,
            "version": self.version,
            "warn_threshold": self.warn_threshold_percent,
            "critical_threshold": self.critical_threshold_percent,
            "grace_hours": self.grace_period_hours,
        }
        return jwt.encode(payload, secret_key, algorithm="HS256")

    @classmethod
    def from_plan_and_tenant(
        cls,
        tenant_id: str,
        plan: TenantPlan,
        version: int,
        validity_days: int = 30,
    ) -> "LicenseToken":
        """Create a license token from a plan."""
        now = datetime.utcnow()
        return cls(
            tenant_id=tenant_id,
            max_subscribers=plan.max_subscribers,
            overage_policy=plan.overage_policy,
            features=plan.get_default_features(),
            issued_at=now,
            expires_at=now + timedelta(days=validity_days),
            nonce=secrets.token_urlsafe(16),
            version=version,
        )
