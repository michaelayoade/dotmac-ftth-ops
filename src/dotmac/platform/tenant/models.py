"""
Tenant database models for multi-tenant SaaS functionality.

Provides comprehensive tenant management with:
- Tenant organizations
- Subscription plans
- Usage tracking
- Feature flags
- Tenant settings
"""

from datetime import UTC, datetime
from enum import Enum as PyEnum
from types import ModuleType
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from ..db import AuditMixin, SoftDeleteMixin, TimestampMixin
from ..db import Base as BaseRuntime

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base
else:
    Base = BaseRuntime


# Ensure optional RADIUS models are registered with SQLAlchemy when available.
_radius_models: ModuleType | None
try:  # pragma: no cover - optional dependency
    import dotmac.platform.radius.models as _radius_models
except ImportError:
    _radius_models = None

if _radius_models is not None:
    Base.registry._class_registry.setdefault("RadCheck", _radius_models.RadCheck)
    Base.registry._class_registry.setdefault("NAS", _radius_models.NAS)


class TenantStatus(str, PyEnum):
    """Tenant account status."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    INACTIVE = "inactive"
    PENDING = "pending"
    CANCELLED = "cancelled"
    PROVISIONING = "provisioning"
    PROVISIONED = "provisioned"
    FAILED_PROVISIONING = "failed_provisioning"


class TenantPlanType(str, PyEnum):
    """Tenant subscription plan types."""

    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    CUSTOM = "custom"


class TenantDeploymentMode(str, PyEnum):
    """Deployment target for a tenant environment."""

    DOTMAC_HOSTED = "dotmac_hosted"
    CUSTOMER_HOSTED = "customer_hosted"


class TenantProvisioningStatus(str, PyEnum):
    """Lifecycle for tenant provisioning jobs."""

    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"


class BillingCycle(str, PyEnum):
    """Billing cycle options."""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class Tenant(Base, TimestampMixin, SoftDeleteMixin, AuditMixin):
    """
    Tenant/Organization model for multi-tenant SaaS.

    Represents a customer organization using the platform.
    """

    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    domain: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    # Status and subscription
    status: Mapped[TenantStatus] = mapped_column(
        Enum(TenantStatus, values_callable=lambda x: [e.value for e in x]),
        default=TenantStatus.TRIAL,
        nullable=False,
        index=True,
    )
    plan_type: Mapped[TenantPlanType] = mapped_column(
        Enum(TenantPlanType, values_callable=lambda x: [e.value for e in x]),
        default=TenantPlanType.FREE,
        nullable=False,
    )

    # Contact information
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Billing information
    billing_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        Enum(BillingCycle, values_callable=lambda x: [e.value for e in x]),
        default=BillingCycle.MONTHLY,
        nullable=False,
    )

    # Subscription dates
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    subscription_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Tenant limits and quotas
    max_users: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    max_api_calls_per_month: Mapped[int] = mapped_column(Integer, default=10000, nullable=False)
    max_storage_gb: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    # Current usage (updated periodically)
    current_users: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_api_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_storage_gb: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    # Feature flags and settings (JSON)
    features: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    settings: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    custom_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Company information
    company_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)

    # Custom branding
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relationships
    settings_records: Mapped[list["TenantSetting"]] = relationship(
        "TenantSetting", back_populates="tenant", cascade="all, delete-orphan"
    )
    usage_records: Mapped[list["TenantUsage"]] = relationship(
        "TenantUsage", back_populates="tenant", cascade="all, delete-orphan"
    )
    invitations: Mapped[list["TenantInvitation"]] = relationship(
        "TenantInvitation", back_populates="tenant", cascade="all, delete-orphan"
    )
    provisioning_jobs: Mapped[list["TenantProvisioningJob"]] = relationship(
        "TenantProvisioningJob", back_populates="tenant", cascade="all, delete-orphan"
    )

    # RADIUS relationships (configured lazily to avoid optional import cycles)
    @declared_attr.directive
    def radius_checks(cls) -> Any:  # pragma: no cover - optional radius integration
        return property(lambda self: [])

    @declared_attr.directive
    def nas_devices(cls) -> Any:  # pragma: no cover - optional radius integration
        return property(lambda self: [])

    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, name={self.name}, slug={self.slug}, status={self.status})>"

    @property
    def is_trial(self) -> bool:
        """Check if tenant is in trial period."""
        return self.status == TenantStatus.TRIAL

    @property
    def status_is_active(self) -> bool:
        """Check if tenant's status is ACTIVE without overriding the is_active column."""
        return self.status in {TenantStatus.ACTIVE, TenantStatus.PROVISIONED}

    @property
    def trial_expired(self) -> bool:
        """Check if trial has expired."""
        if not self.trial_ends_at:
            return False
        # Handle both timezone-aware and naive datetimes (SQLite returns naive)
        trial_ends_at = (
            self.trial_ends_at.replace(tzinfo=UTC)
            if self.trial_ends_at.tzinfo is None
            else self.trial_ends_at
        )
        return datetime.now(UTC) > trial_ends_at

    @property
    def has_exceeded_user_limit(self) -> bool:
        """Check if tenant has exceeded user limit."""
        return self.current_users >= self.max_users

    @property
    def has_exceeded_api_limit(self) -> bool:
        """Check if tenant has exceeded API call limit."""
        return self.current_api_calls >= self.max_api_calls_per_month

    @property
    def has_exceeded_storage_limit(self) -> bool:
        """Check if tenant has exceeded storage limit."""
        return float(self.current_storage_gb) >= self.max_storage_gb


class TenantSetting(Base, TimestampMixin):
    """
    Individual tenant settings for customization.

    Stores key-value configuration for each tenant.
    """

    __tablename__ = "tenant_settings"
    __table_args__ = (UniqueConstraint("tenant_id", "key", name="uq_tenant_setting_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    value_type: Mapped[str] = mapped_column(
        String(50), default="string", nullable=False
    )  # string, int, bool, json
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="settings_records")

    def __repr__(self) -> str:
        return f"<TenantSetting(tenant_id={self.tenant_id}, key={self.key})>"


class TenantUsage(Base, TimestampMixin):
    """
    Track tenant usage metrics over time.

    Records usage statistics for billing and analytics.
    """

    __tablename__ = "tenant_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Usage period
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Metrics
    api_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    storage_gb: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    active_users: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bandwidth_gb: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    # Additional metrics
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="usage_records")

    def __repr__(self) -> str:
        return f"<TenantUsage(tenant_id={self.tenant_id}, period_start={self.period_start})>"


class TenantInvitationStatus(str, PyEnum):
    """Tenant invitation status."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    REVOKED = "revoked"


class TenantInvitation(Base, TimestampMixin):
    """
    Tenant user invitations.

    Manages invitations to join a tenant organization.
    """

    __tablename__ = "tenant_invitations"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(100), default="member", nullable=False)
    invited_by: Mapped[str] = mapped_column(String(255), nullable=False)

    status: Mapped[TenantInvitationStatus] = mapped_column(
        Enum(TenantInvitationStatus), default=TenantInvitationStatus.PENDING, nullable=False
    )

    # Token for accepting invitation
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="invitations")

    def __repr__(self) -> str:
        return f"<TenantInvitation(id={self.id}, email={self.email}, status={self.status})>"

    @property
    def is_expired(self) -> bool:
        """Check if invitation has expired."""
        now = datetime.now(UTC)
        # Handle both timezone-aware and naive datetimes (SQLite returns naive)
        expires_at = (
            self.expires_at.replace(tzinfo=UTC)
            if self.expires_at.tzinfo is None
            else self.expires_at
        )
        return now > expires_at

    @property
    def is_pending(self) -> bool:
        """Check if invitation is pending."""
        return self.status == TenantInvitationStatus.PENDING and not self.is_expired


class TenantProvisioningJob(Base, TimestampMixin, AuditMixin):
    """Track dedicated infrastructure provisioning for a tenant."""

    __tablename__ = "tenant_provisioning_jobs"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[TenantProvisioningStatus] = mapped_column(
        Enum(TenantProvisioningStatus),
        default=TenantProvisioningStatus.QUEUED,
        nullable=False,
        index=True,
    )
    deployment_mode: Mapped[TenantDeploymentMode] = mapped_column(
        Enum(TenantDeploymentMode), nullable=False
    )
    awx_template_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    awx_job_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    requested_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_vars: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    connection_profile: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    last_acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="provisioning_jobs")

    def mark_started(self) -> None:
        """Set start timestamp when provisioning begins."""
        self.status = TenantProvisioningStatus.IN_PROGRESS
        self.started_at = datetime.now(UTC)

    def mark_succeeded(self) -> None:
        """Mark job as succeeded."""
        self.status = TenantProvisioningStatus.SUCCEEDED
        self.finished_at = datetime.now(UTC)

    def mark_failed(self, message: str | None = None) -> None:
        """Mark job as failed and capture reason."""
        self.status = TenantProvisioningStatus.FAILED
        self.finished_at = datetime.now(UTC)
        if message:
            self.error_message = message


class VerificationMethod(str, PyEnum):
    """Domain verification methods."""

    DNS_TXT = "dns_txt"
    DNS_CNAME = "dns_cname"
    META_TAG = "meta_tag"
    FILE_UPLOAD = "file_upload"


class VerificationStatus(str, PyEnum):
    """Domain verification status."""

    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"
    EXPIRED = "expired"


class DomainVerificationAttempt(Base, TimestampMixin):
    """
    Domain verification attempt tracking.

    Records domain ownership verification attempts for tenant custom domains.
    """

    __tablename__ = "domain_verification_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    verification_method: Mapped[str] = mapped_column(String(50), nullable=False)
    verification_token: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    initiated_by: Mapped[str] = mapped_column(String(255), nullable=False)
    initiated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    attempt_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<DomainVerificationAttempt(id={self.id}, domain={self.domain}, status={self.status})>"
        )

    @property
    def is_expired(self) -> bool:
        """Check if verification attempt has expired."""
        now = datetime.now(UTC)
        # Handle both timezone-aware and naive datetimes (SQLite returns naive)
        expires_at = (
            self.expires_at.replace(tzinfo=UTC)
            if self.expires_at.tzinfo is None
            else self.expires_at
        )
        return now > expires_at

    @property
    def is_pending(self) -> bool:
        """Check if verification is still pending."""
        return self.status == "pending" and not self.is_expired
