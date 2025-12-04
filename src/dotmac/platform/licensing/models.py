"""
Licensing & Entitlement Models.

SQLAlchemy models for software licensing, activation, compliance, and auditing.
"""

import os
from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, cast
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
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import BaseModel as BaseModelRuntime

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as BaseModel
else:
    BaseModel = BaseModelRuntime


def _licensing_indexes_enabled() -> bool:
    """Determine if licensing indexes should be created for current environment."""
    db_url = os.getenv("DATABASE_URL", "")
    if os.getenv("TESTING") == "1" and db_url.startswith("sqlite"):
        return False
    return True


_CREATE_LICENSING_INDEXES = _licensing_indexes_enabled()


class LicenseType(str, Enum):
    """License type enumeration."""

    PERPETUAL = "PERPETUAL"
    SUBSCRIPTION = "SUBSCRIPTION"
    TRIAL = "TRIAL"
    EVALUATION = "EVALUATION"
    CONCURRENT = "CONCURRENT"
    NAMED_USER = "NAMED_USER"


class LicenseModel(str, Enum):
    """License model enumeration."""

    PER_SEAT = "PER_SEAT"
    PER_DEVICE = "PER_DEVICE"
    PER_CPU = "PER_CPU"
    PER_CORE = "PER_CORE"
    SITE_LICENSE = "SITE_LICENSE"
    ENTERPRISE = "ENTERPRISE"


class LicenseStatus(str, Enum):
    """License status enumeration."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"
    REVOKED = "REVOKED"
    PENDING = "PENDING"


class ActivationStatus(str, Enum):
    """Activation status enumeration."""

    ACTIVE = "ACTIVE"
    DEACTIVATED = "DEACTIVATED"
    SUSPENDED = "SUSPENDED"
    EXPIRED = "EXPIRED"


class ActivationType(str, Enum):
    """Activation type enumeration."""

    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    EMERGENCY = "EMERGENCY"


class OrderStatus(str, Enum):
    """License order status."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, Enum):
    """Payment status enumeration."""

    PENDING = "PENDING"
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class AuditType(str, Enum):
    """Compliance audit type."""

    SCHEDULED = "SCHEDULED"
    RANDOM = "RANDOM"
    COMPLAINT_DRIVEN = "COMPLAINT_DRIVEN"
    RENEWAL = "RENEWAL"


class AuditScope(str, Enum):
    """Audit scope."""

    FULL = "FULL"
    PARTIAL = "PARTIAL"
    SPOT_CHECK = "SPOT_CHECK"


class AuditStatus(str, Enum):
    """Audit status."""

    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ViolationStatus(str, Enum):
    """Violation status."""

    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    DISPUTED = "DISPUTED"


class License(BaseModel):
    """Software license model."""

    __tablename__ = "licenses"

    # Primary key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # License key (encrypted)
    license_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    # Product relationship
    product_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("billing_products.product_id"), nullable=False, index=True
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_version: Mapped[str] = mapped_column(String(50), nullable=False)

    # License classification
    license_type: Mapped[LicenseType] = mapped_column(
        SQLEnum(LicenseType), nullable=False, index=True
    )
    license_model: Mapped[LicenseModel] = mapped_column(
        SQLEnum(LicenseModel), nullable=False, index=True
    )

    # Customer/Reseller relationships
    customer_id: Mapped[UUID | None] = mapped_column(
        SQLUUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True
    )
    reseller_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # License ownership
    issued_to: Mapped[str] = mapped_column(String(255), nullable=False)

    # Activation limits
    max_activations: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_activations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Features and restrictions (JSON)
    features: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    restrictions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Dates
    issued_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    activation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    maintenance_expiry: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Status
    status: Mapped[LicenseStatus] = mapped_column(
        SQLEnum(LicenseStatus), nullable=False, default=LicenseStatus.PENDING, index=True
    )

    # Renewal
    auto_renewal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trial_period_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    grace_period_days: Mapped[int | None] = mapped_column(Integer, nullable=True, default=30)

    # Metadata (renamed to extra_data to avoid SQLAlchemy reserved name)
    extra_data: Mapped[dict[str, Any]] = mapped_column(
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
    activations: Mapped[list["Activation"]] = relationship(
        "Activation", back_populates="license", cascade="all, delete-orphan"
    )

    # Indexes
    if _CREATE_LICENSING_INDEXES:
        __table_args__ = cast(
            tuple[Any, ...],
            (
                Index("ix_licenses_tenant_customer", "tenant_id", "customer_id"),
                Index("ix_licenses_tenant_status", "tenant_id", "status"),
                Index("ix_licenses_tenant_expiry", "tenant_id", "expiry_date"),
                Index("ix_licenses_product_status", "product_id", "status"),
                {"extend_existing": True},
            ),
        )
    else:
        __table_args__ = cast(tuple[Any, ...], ({"extend_existing": True},))


class LicenseTemplate(BaseModel):
    """License template model for pre-configured license types."""

    __tablename__ = "license_templates"

    # Primary key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Template identification
    template_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("billing_products.product_id"), nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # License configuration
    license_type: Mapped[LicenseType] = mapped_column(SQLEnum(LicenseType), nullable=False)
    license_model: Mapped[LicenseModel] = mapped_column(SQLEnum(LicenseModel), nullable=False)
    default_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=365)  # days
    max_activations: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Features and restrictions templates (JSON)
    features: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    restrictions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Pricing
    pricing: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Renewal and trial
    auto_renewal_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    trial_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trial_duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    grace_period_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)

    # Status
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

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

    # Indexes
    if _CREATE_LICENSING_INDEXES:
        __table_args__ = cast(
            tuple[Any, ...],
            (
                Index("ix_license_templates_tenant_product", "tenant_id", "product_id"),
                Index("ix_license_templates_tenant_active", "tenant_id", "active"),
                {"extend_existing": True},
            ),
        )
    else:
        __table_args__ = cast(tuple[Any, ...], ({"extend_existing": True},))


class Activation(BaseModel):
    """License activation model."""

    __tablename__ = "license_activations"

    # Primary key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # License relationship
    license_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("licenses.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Activation token (encrypted)
    activation_token: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    # Device fingerprint
    device_fingerprint: Mapped[str] = mapped_column(String(255), nullable=False)
    machine_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hardware_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mac_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    operating_system: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    application_version: Mapped[str] = mapped_column(String(50), nullable=False)

    # Activation type
    activation_type: Mapped[ActivationType] = mapped_column(
        SQLEnum(ActivationType), nullable=False, default=ActivationType.ONLINE
    )

    # Status
    status: Mapped[ActivationStatus] = mapped_column(
        SQLEnum(ActivationStatus), nullable=False, default=ActivationStatus.ACTIVE, index=True
    )

    # Dates
    activated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    last_heartbeat: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deactivation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Location
    location: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Usage metrics
    usage_metrics: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Tenant
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False)

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
    license: Mapped["License"] = relationship("License", back_populates="activations")

    # Indexes
    if _CREATE_LICENSING_INDEXES:
        __table_args__ = cast(
            tuple[Any, ...],
            (
                Index("ix_activations_license_status", "license_id", "status"),
                Index("ix_activations_tenant_status", "tenant_id", "status"),
                Index("ix_activations_device", "device_fingerprint"),
                Index("ix_activations_heartbeat", "last_heartbeat"),
                {"extend_existing": True},
            ),
        )
    else:
        __table_args__ = cast(tuple[Any, ...], ({"extend_existing": True},))


class LicenseOrder(BaseModel):
    """License order model for purchase workflows."""

    __tablename__ = "license_orders"

    # Primary key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Order number (auto-generated)
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    # Customer/Reseller
    customer_id: Mapped[UUID | None] = mapped_column(
        SQLUUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True
    )
    reseller_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Template
    template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("license_templates.id"), nullable=False, index=True
    )

    # Order details
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    custom_features: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    custom_restrictions: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    duration_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricing_override: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status
    status: Mapped[OrderStatus] = mapped_column(
        SQLEnum(OrderStatus), nullable=False, default=OrderStatus.PENDING, index=True
    )

    # Financials
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    discount_applied: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING
    )

    # Billing integration
    invoice_id: Mapped[UUID | None] = mapped_column(
        SQLUUID(as_uuid=True), ForeignKey("invoices.invoice_id"), nullable=True, index=True
    )
    subscription_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    # Fulfillment
    fulfillment_method: Mapped[str] = mapped_column(
        String(20), nullable=False, default="AUTO"
    )  # AUTO, MANUAL, BATCH
    generated_licenses: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # Dates
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Indexes
    if _CREATE_LICENSING_INDEXES:
        __table_args__ = cast(
            tuple[Any, ...],
            (
                Index("ix_license_orders_tenant_customer", "tenant_id", "customer_id"),
                Index("ix_license_orders_tenant_status", "tenant_id", "status"),
                Index("ix_license_orders_payment_status", "payment_status"),
                {"extend_existing": True},
            ),
        )
    else:
        __table_args__ = cast(tuple[Any, ...], ({"extend_existing": True},))


class ComplianceAudit(BaseModel):
    """Compliance audit model."""

    __tablename__ = "compliance_audits"

    # Primary key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Audit classification
    audit_type: Mapped[AuditType] = mapped_column(SQLEnum(AuditType), nullable=False, index=True)
    customer_id: Mapped[UUID | None] = mapped_column(
        SQLUUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True
    )
    product_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    audit_scope: Mapped[AuditScope] = mapped_column(SQLEnum(AuditScope), nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Status
    status: Mapped[AuditStatus] = mapped_column(
        SQLEnum(AuditStatus), nullable=False, default=AuditStatus.SCHEDULED, index=True
    )

    # Auditor
    auditor_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # Dates
    audit_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Findings
    findings: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    violations: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)  # IDs
    compliance_score: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    recommendations: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # Follow-up
    follow_up_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    follow_up_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    report_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Indexes
    if _CREATE_LICENSING_INDEXES:
        __table_args__ = cast(
            tuple[Any, ...],
            (
                Index("ix_compliance_audits_tenant_customer", "tenant_id", "customer_id"),
                Index("ix_compliance_audits_tenant_status", "tenant_id", "status"),
                Index("ix_compliance_audits_audit_date", "audit_date"),
                {"extend_existing": True},
            ),
        )
    else:
        __table_args__ = cast(tuple[Any, ...], ({"extend_existing": True},))


class ComplianceViolation(BaseModel):
    """Compliance violation model."""

    __tablename__ = "compliance_violations"

    # Primary key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Violation classification
    violation_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    license_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("licenses.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Details
    description: Mapped[str] = mapped_column(Text, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    evidence: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # Impact
    financial_impact: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)

    # Resolution
    resolution_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    resolution_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[ViolationStatus] = mapped_column(
        SQLEnum(ViolationStatus), nullable=False, default=ViolationStatus.OPEN, index=True
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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

    # Indexes
    if _CREATE_LICENSING_INDEXES:
        __table_args__ = cast(
            tuple[Any, ...],
            (
                Index("ix_violations_tenant_license", "tenant_id", "license_id"),
                Index("ix_violations_tenant_status", "tenant_id", "status"),
                Index("ix_violations_severity", "severity"),
                {"extend_existing": True},
            ),
        )
    else:
        __table_args__ = cast(tuple[Any, ...], ({"extend_existing": True},))


class LicenseEventLog(BaseModel):
    """License event audit log."""

    __tablename__ = "license_event_logs"

    # Primary key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Event classification
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    license_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    activation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Actor
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Event details
    event_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    extra_data: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), index=True
    )

    # Indexes
    if _CREATE_LICENSING_INDEXES:
        __table_args__ = cast(
            tuple[Any, ...],
            (
                Index("ix_license_events_tenant_type", "tenant_id", "event_type"),
                Index("ix_license_events_license", "license_id"),
                Index("ix_license_events_created_at", "created_at"),
                {"extend_existing": True},
            ),
        )
    else:
        __table_args__ = cast(tuple[Any, ...], ({"extend_existing": True},))
