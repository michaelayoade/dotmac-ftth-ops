"""
Real-Time Event Schemas

Pydantic models for real-time event payloads (SSE/WebSocket).
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# =============================================================================
# Event Types
# =============================================================================


class EventType(str, Enum):
    """Real-time event types."""

    # ONU Events
    ONU_ONLINE = "onu.online"
    ONU_OFFLINE = "onu.offline"
    ONU_SIGNAL_DEGRADED = "onu.signal_degraded"
    ONU_PROVISIONED = "onu.provisioned"
    ONU_DEPROVISIONED = "onu.deprovisioned"

    # RADIUS Session Events
    SESSION_STARTED = "session.started"
    SESSION_UPDATED = "session.updated"
    SESSION_STOPPED = "session.stopped"

    # Job Progress Events
    JOB_CREATED = "job.created"
    JOB_PROGRESS = "job.progress"
    JOB_COMPLETED = "job.completed"
    JOB_FAILED = "job.failed"
    JOB_CANCELLED = "job.cancelled"

    # Ticket Events
    TICKET_CREATED = "ticket.created"
    TICKET_UPDATED = "ticket.updated"
    TICKET_ASSIGNED = "ticket.assigned"
    TICKET_RESOLVED = "ticket.resolved"

    # Alert Events
    ALERT_RAISED = "alert.raised"
    ALERT_CLEARED = "alert.cleared"

    # Subscriber Events
    SUBSCRIBER_CREATED = "subscriber.created"
    SUBSCRIBER_ACTIVATED = "subscriber.activated"
    SUBSCRIBER_SUSPENDED = "subscriber.suspended"
    SUBSCRIBER_TERMINATED = "subscriber.terminated"


# =============================================================================
# Base Event Schema
# =============================================================================


class BaseEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """Base schema for all real-time events."""

    model_config = ConfigDict()

    event_type: EventType
    tenant_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.utcnow())
    data: dict[str, Any]


# =============================================================================
# ONU Status Events
# =============================================================================


class ONUStatus(str, Enum):
    """ONU operational status."""

    ONLINE = "online"
    OFFLINE = "offline"
    REBOOTING = "rebooting"
    DEGRADED = "degraded"


class ONUStatusEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """ONU status change event."""

    model_config = ConfigDict()

    event_type: EventType
    tenant_id: str
    timestamp: datetime
    onu_serial: str
    subscriber_id: str | None = None
    status: ONUStatus
    signal_dbm: float | None = None
    previous_status: ONUStatus | None = None
    olt_id: str | None = None
    pon_port: int | None = None


# =============================================================================
# RADIUS Session Events
# =============================================================================


class RADIUSSessionEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """RADIUS session event."""

    model_config = ConfigDict()

    event_type: EventType
    tenant_id: str
    timestamp: datetime
    username: str
    session_id: str
    nas_ip_address: str
    framed_ip_address: str | None = None
    subscriber_id: str | None = None
    bandwidth_profile: str | None = None
    bytes_in: int | None = None
    bytes_out: int | None = None
    session_time: int | None = None  # seconds
    terminate_cause: str | None = None


# =============================================================================
# Job Progress Events
# =============================================================================


class JobStatus(str, Enum):
    """Job execution status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobProgressEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """Job progress update event."""

    model_config = ConfigDict()

    event_type: EventType
    tenant_id: str
    timestamp: datetime
    job_id: str
    job_type: str  # e.g., "bulk_import", "firmware_upgrade"
    status: JobStatus
    progress_percent: int | None = None
    items_total: int | None = None
    items_processed: int | None = None
    items_succeeded: int | None = None
    items_failed: int | None = None
    current_item: str | None = None
    error_message: str | None = None


# =============================================================================
# Ticket Events
# =============================================================================


class TicketEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """Ticket lifecycle event."""

    model_config = ConfigDict()

    event_type: EventType
    tenant_id: str
    timestamp: datetime
    ticket_id: str
    ticket_number: str
    title: str
    category: str
    priority: str
    status: str
    assigned_to: str | None = None
    subscriber_id: str | None = None


# =============================================================================
# Alert Events
# =============================================================================


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """Network or system alert event."""

    model_config = ConfigDict()

    event_type: EventType
    tenant_id: str
    timestamp: datetime
    alert_id: str
    alert_type: str  # e.g., "signal_degradation", "device_offline"
    severity: AlertSeverity
    source: str  # e.g., "olt-01", "onu-12345"
    message: str
    details: dict[str, Any] | None = None


# =============================================================================
# Subscriber Events
# =============================================================================


class SubscriberEvent(BaseModel):  # BaseModel resolves to Any in isolation
    """Subscriber lifecycle event."""

    model_config = ConfigDict()

    event_type: EventType
    tenant_id: str
    timestamp: datetime
    subscriber_id: str
    account_number: str
    full_name: str
    status: str
    plan: str | None = None
    onu_serial: str | None = None
