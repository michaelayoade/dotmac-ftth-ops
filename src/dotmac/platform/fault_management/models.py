"""
Fault Management Database Models

Models for alarms, alarm correlation, SLA tracking, and breach detection.
"""

from datetime import datetime, timedelta, timezone

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
from enum import Enum as PyEnum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import BaseModel

# =============================================================================
# Enums
# =============================================================================


class AlarmSeverity(str, PyEnum):
    """Alarm severity levels"""

    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    WARNING = "warning"
    INFO = "info"
    CLEARED = "cleared"


class AlarmStatus(str, PyEnum):
    """Alarm lifecycle status"""

    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    CLEARED = "cleared"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"


class AlarmSource(str, PyEnum):
    """Source system that generated the alarm"""

    NETWORK_DEVICE = "network_device"
    MONITORING = "monitoring"
    CPE = "cpe"
    SERVICE = "service"
    SYSTEM = "system"
    MANUAL = "manual"


class CorrelationAction(str, PyEnum):
    """Action taken by correlation engine"""

    ROOT_CAUSE = "root_cause"
    CHILD_ALARM = "child_alarm"
    DUPLICATE = "duplicate"
    FLAPPING = "flapping"
    NONE = "none"


class SLAStatus(str, PyEnum):
    """SLA compliance status"""

    COMPLIANT = "compliant"
    AT_RISK = "at_risk"
    BREACHED = "breached"
    SUSPENDED = "suspended"


# =============================================================================
# Alarm Models
# =============================================================================


class Alarm(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """
    Network and service alarms with correlation support.

    Tracks faults, events, and conditions that require attention.
    """

    __tablename__ = "alarms"

    # Primary identifiers
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    alarm_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )  # External alarm ID

    # Alarm classification
    severity: Mapped[AlarmSeverity] = mapped_column(Enum(AlarmSeverity), nullable=False, index=True)
    status: Mapped[AlarmStatus] = mapped_column(Enum(AlarmStatus), nullable=False, index=True)
    source: Mapped[AlarmSource] = mapped_column(Enum(AlarmSource), nullable=False)

    # Alarm details
    alarm_type: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=True)

    # Affected resource
    resource_type: Mapped[str] = mapped_column(
        String(100), nullable=True, index=True
    )  # device, service, circuit, etc.
    resource_id: Mapped[str] = mapped_column(
        String(255), nullable=True, index=True
    )  # ID of affected resource
    resource_name: Mapped[str] = mapped_column(String(500), nullable=True)

    # Customer impact
    customer_id: Mapped[UUID] = mapped_column(nullable=True)
    customer_name: Mapped[str] = mapped_column(String(500), nullable=True)
    subscriber_count: Mapped[int] = mapped_column(Integer, default=0)  # Affected subscribers

    # Correlation
    correlation_id: Mapped[UUID] = mapped_column(nullable=True)  # Groups related alarms
    correlation_action: Mapped[CorrelationAction] = mapped_column(
        Enum(CorrelationAction), default=CorrelationAction.NONE
    )
    parent_alarm_id: Mapped[UUID] = mapped_column(
        ForeignKey("alarms.id"), nullable=True, index=True
    )
    is_root_cause: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Timing
    first_occurrence: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    last_occurrence: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by: Mapped[UUID] = mapped_column(nullable=True, index=True)
    cleared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Assignment and handling
    assigned_to: Mapped[UUID] = mapped_column(nullable=True, index=True)
    assigned_by: Mapped[UUID] = mapped_column(nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    ticket_id: Mapped[UUID] = mapped_column(nullable=True, index=True)  # Auto-created ticket

    # Additional data
    tags: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    alarm_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, name="metadata"
    )  # Source-specific data (mapped to 'metadata' column in DB)
    probable_cause: Mapped[str] = mapped_column(Text, nullable=True)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    parent_alarm: Mapped["Alarm"] = relationship(
        "Alarm", remote_side=[id], back_populates="child_alarms"
    )
    child_alarms: Mapped[list["Alarm"]] = relationship("Alarm", back_populates="parent_alarm")
    notes: Mapped[list["AlarmNote"]] = relationship(
        "AlarmNote", back_populates="alarm", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_alarms_tenant_status", "tenant_id", "status"),
        Index("ix_alarms_tenant_severity", "tenant_id", "severity"),
        Index("ix_alarms_resource", "resource_type", "resource_id"),
        Index("ix_alarms_customer", "customer_id", "status"),
        Index("ix_alarms_correlation", "correlation_id", "status"),
    )


class AlarmNote(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """
    Notes and comments on alarms.

    Tracks investigation and resolution activities.
    """

    __tablename__ = "alarm_notes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    alarm_id: Mapped[UUID] = mapped_column(ForeignKey("alarms.id"), nullable=False, index=True)

    note: Mapped[str] = mapped_column(Text, nullable=False)
    note_type: Mapped[str] = mapped_column(String(50), default="note", nullable=False)
    created_by: Mapped[UUID] = mapped_column(nullable=False)

    # Relationships
    alarm: Mapped["Alarm"] = relationship("Alarm", back_populates="notes")


class AlarmRule(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """
    Alarm correlation and processing rules.

    Defines how alarms should be correlated, suppressed, or escalated.
    """

    __tablename__ = "alarm_rules"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    rule_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # correlation, suppression, escalation
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)  # Lower = higher priority

    # Rule conditions (JSON with matching criteria)
    conditions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Rule actions (JSON with actions to take)
    actions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Time window for correlation (seconds)
    time_window: Mapped[int] = mapped_column(Integer, default=300)  # 5 minutes

    __table_args__ = (Index("ix_alarm_rules_tenant_enabled", "tenant_id", "enabled"),)


# =============================================================================
# SLA Models
# =============================================================================


class SLADefinition(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """
    Service Level Agreement definitions.

    Defines availability, performance, and response time targets.
    """

    __tablename__ = "sla_definitions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    service_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # fiber, wireless, etc.
    service_level: Mapped[str] = mapped_column(String(100), nullable=True, index=True)

    # Availability targets
    availability_target: Mapped[float] = mapped_column(Float, nullable=False)  # e.g., 99.9% = 0.999
    measurement_period_days: Mapped[int] = mapped_column(Integer, default=30)  # Monthly by default
    response_time_target: Mapped[int] = mapped_column(Integer, default=60)
    resolution_time_target: Mapped[int] = mapped_column(Integer, default=240)

    # Performance targets
    max_latency_ms: Mapped[float] = mapped_column(Float, nullable=True)  # Maximum latency
    max_packet_loss_percent: Mapped[float] = mapped_column(
        Float, nullable=True
    )  # Maximum packet loss
    min_bandwidth_mbps: Mapped[float] = mapped_column(Float, nullable=True)  # Minimum bandwidth

    # Response time targets (minutes)
    response_time_critical: Mapped[int] = mapped_column(Integer, default=15)  # 15 min for critical
    response_time_major: Mapped[int] = mapped_column(Integer, default=60)  # 1 hour for major
    response_time_minor: Mapped[int] = mapped_column(Integer, default=240)  # 4 hours for minor

    # Resolution time targets (minutes)
    resolution_time_critical: Mapped[int] = mapped_column(Integer, default=240)  # 4 hours
    resolution_time_major: Mapped[int] = mapped_column(Integer, default=480)  # 8 hours
    resolution_time_minor: Mapped[int] = mapped_column(Integer, default=1440)  # 24 hours

    # Business rules
    business_hours_only: Mapped[bool] = mapped_column(Boolean, default=False)
    exclude_maintenance: Mapped[bool] = mapped_column(Boolean, default=True)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    # Relationships
    instances: Mapped[list["SLAInstance"]] = relationship(
        "SLAInstance", back_populates="definition"
    )


class SLAInstance(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """
    SLA instance for a specific customer or service.

    Tracks SLA compliance and breaches.
    """

    __tablename__ = "sla_instances"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    sla_definition_id: Mapped[UUID] = mapped_column(
        ForeignKey("sla_definitions.id"), nullable=False, index=True
    )

    # Associated entities
    customer_id: Mapped[UUID] = mapped_column(nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    service_id: Mapped[UUID] = mapped_column(nullable=True, index=True)
    service_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subscription_id: Mapped[str] = mapped_column(String(255), nullable=True, index=True)

    # Current status
    status: Mapped[SLAStatus] = mapped_column(Enum(SLAStatus), nullable=False, index=True)
    current_availability: Mapped[float] = mapped_column(
        Float, default=100.0
    )  # Current measured availability

    # Period tracking
    start_date: Mapped[datetime] = mapped_column(
        "period_start", DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    end_date: Mapped[datetime] = mapped_column(
        "period_end",
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC) + timedelta(days=30),
    )

    # Downtime tracking (minutes)
    total_downtime: Mapped[int] = mapped_column(Integer, default=0)
    planned_downtime: Mapped[int] = mapped_column(Integer, default=0)
    unplanned_downtime: Mapped[int] = mapped_column(Integer, default=0)

    # Breach tracking
    breach_count: Mapped[int] = mapped_column(Integer, default=0)
    last_breach_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Credits/penalties
    credit_amount: Mapped[float] = mapped_column(Float, default=0.0)
    penalty_amount: Mapped[float] = mapped_column(Float, default=0.0)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    # Relationships
    definition: Mapped["SLADefinition"] = relationship("SLADefinition", back_populates="instances")
    breaches: Mapped[list["SLABreach"]] = relationship(
        "SLABreach", back_populates="instance", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_sla_instances_customer", "customer_id", "status"),
        Index("ix_sla_instances_period", "period_start", "period_end"),
    )


class SLABreach(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """
    SLA breach events.

    Records when SLA targets are violated.
    """

    __tablename__ = "sla_breaches"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    sla_instance_id: Mapped[UUID] = mapped_column(
        ForeignKey("sla_instances.id"), nullable=False, index=True
    )

    breach_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # availability, response_time, resolution_time
    severity: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    detected_at: Mapped[datetime] = mapped_column(
        "breach_start", DateTime(timezone=True), nullable=False
    )
    breach_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)

    # Measured values
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    actual_value: Mapped[float] = mapped_column(Float, nullable=False)
    deviation_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Related entities
    alarm_id: Mapped[UUID] = mapped_column(nullable=True, index=True)
    ticket_id: Mapped[UUID] = mapped_column(nullable=True, index=True)

    # Resolution
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str] = mapped_column(Text, nullable=True)

    # Financial impact
    credit_amount: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    instance: Mapped["SLAInstance"] = relationship("SLAInstance", back_populates="breaches")

    __table_args__ = (
        Index("ix_sla_breaches_time", "breach_start", "breach_end"),
        Index("ix_sla_breaches_resolved", "resolved", "breach_start"),
    )


# =============================================================================
# Maintenance Window Models
# =============================================================================


class MaintenanceWindow(BaseModel):  # type: ignore[misc]  # BaseModel resolves to Any in isolation
    """
    Scheduled maintenance windows.

    Used to exclude planned downtime from SLA calculations.
    """

    __tablename__ = "maintenance_windows"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Schedule
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")

    # Affected scope
    affected_services: Mapped[list[str]] = mapped_column(JSON, default=list)
    affected_customers: Mapped[list[str]] = mapped_column(JSON, default=list)
    affected_resources: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    # Status
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="scheduled", index=True
    )  # scheduled, in_progress, completed, cancelled
    suppress_alarms: Mapped[bool] = mapped_column(Boolean, default=True)

    # Notifications
    notify_customers: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (Index("ix_maintenance_windows_time", "start_time", "end_time", "status"),)


# =============================================================================
# On-Call Schedule Models
# =============================================================================


class OnCallScheduleType(str, PyEnum):
    """On-call schedule rotation types"""

    DAILY = "daily"
    WEEKLY = "weekly"
    CUSTOM = "custom"


class OnCallSchedule(BaseModel):  # type: ignore[misc]
    """
    On-call schedule definition.

    Defines rotation schedules for fault management and alarm notifications.
    """

    __tablename__ = "oncall_schedules"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Schedule identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Schedule type and configuration
    schedule_type: Mapped[OnCallScheduleType] = mapped_column(
        Enum(OnCallScheduleType),
        nullable=False,
        default=OnCallScheduleType.WEEKLY,
    )

    # Rotation settings
    rotation_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    rotation_duration_hours: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=168,  # 1 week
    )

    # Schedule scope
    alarm_severities: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )  # List of AlarmSeverity values to trigger for
    team_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")

    # Metadata (using metadata_ to avoid SQLAlchemy reserved name)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_oncall_schedules_tenant_active", "tenant_id", "is_active"),
        Index("ix_oncall_schedules_rotation", "rotation_start", "is_active"),
    )


class OnCallRotation(BaseModel):  # type: ignore[misc]
    """
    On-call rotation assignment.

    Assigns users to specific on-call periods within a schedule.
    """

    __tablename__ = "oncall_rotations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Schedule reference
    schedule_id: Mapped[UUID] = mapped_column(
        ForeignKey("oncall_schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # User assignment
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Rotation period
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    # Override settings
    is_override: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )  # Manual override vs automatic rotation
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )  # User acknowledged the rotation

    # Metadata (using metadata_ to avoid SQLAlchemy reserved name)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_oncall_rotations_time", "start_time", "end_time", "is_active"),
        Index("ix_oncall_rotations_schedule_user", "schedule_id", "user_id"),
        Index("ix_oncall_rotations_current", "tenant_id", "start_time", "end_time", "is_active"),
    )
