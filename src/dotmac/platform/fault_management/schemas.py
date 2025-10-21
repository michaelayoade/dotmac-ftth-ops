"""
Fault Management Pydantic Schemas

Request and response schemas for fault management API.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from dotmac.platform.fault_management.models import (
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
    CorrelationAction,
    SLAStatus,
)

# =============================================================================
# Alarm Schemas
# =============================================================================


class AlarmCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create alarm request"""

    model_config = ConfigDict()

    alarm_id: str = Field(..., description="External alarm ID (from source system)")
    severity: AlarmSeverity
    source: AlarmSource
    alarm_type: str = Field(..., min_length=1, max_length=255, description="Alarm type")
    title: str = Field(..., min_length=1, max_length=500, description="Alarm title")
    description: str | None = Field(None, description="Detailed description")
    message: str | None = Field(None, description="Alarm message")

    # Affected resource
    resource_type: str | None = Field(None, description="Type of affected resource")
    resource_id: str | None = Field(None, description="ID of affected resource")
    resource_name: str | None = Field(None, description="Name of affected resource")

    # Customer impact
    customer_id: UUID | None = None
    customer_name: str | None = None
    subscriber_count: int = Field(default=0, ge=0)

    # Additional data
    tags: dict[str, Any] = Field(default_factory=lambda: {})
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    probable_cause: str | None = None
    recommended_action: str | None = None


class AlarmUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update alarm request"""

    model_config = ConfigDict()

    severity: AlarmSeverity | None = None
    status: AlarmStatus | None = None
    assigned_to: UUID | None = None
    probable_cause: str | None = None
    recommended_action: str | None = None
    tags: dict[str, Any] | None = None


class AlarmAcknowledge(BaseModel):  # BaseModel resolves to Any in isolation
    """Acknowledge alarm request"""

    model_config = ConfigDict()

    note: str | None = Field(None, description="Acknowledgment note")


class AlarmCreateTicketRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to create a ticket from an alarm"""

    model_config = ConfigDict()

    priority: str | None = Field(
        default="normal",
        description="Ticket priority (low, normal, high, critical)",
    )
    additional_notes: str | None = Field(
        None,
        description="Additional context to include in ticket",
    )
    assign_to_user_id: UUID | None = Field(
        None,
        description="Optionally assign ticket to specific user",
    )


class AlarmResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Alarm response"""

    id: UUID
    tenant_id: str
    alarm_id: str
    severity: AlarmSeverity
    status: AlarmStatus
    source: AlarmSource
    alarm_type: str
    title: str
    description: str | None
    message: str | None

    resource_type: str | None
    resource_id: str | None
    resource_name: str | None

    customer_id: UUID | None
    customer_name: str | None
    subscriber_count: int

    correlation_id: UUID | None
    correlation_action: CorrelationAction
    parent_alarm_id: UUID | None
    is_root_cause: bool

    first_occurrence: datetime
    last_occurrence: datetime
    occurrence_count: int
    acknowledged_at: datetime | None
    acknowledged_by: UUID | None
    cleared_at: datetime | None
    resolved_at: datetime | None

    assigned_to: UUID | None
    ticket_id: UUID | None

    tags: dict[str, Any]
    metadata: dict[str, Any] = Field(alias="alarm_metadata")
    probable_cause: str | None
    recommended_action: str | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AlarmNoteCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create alarm note request"""

    model_config = ConfigDict(populate_by_name=True)

    content: str = Field(..., alias="note", min_length=1, description="Note content")
    note_type: str = Field("note", description="Type of note (acknowledgment, resolution, etc.)")


class AlarmNoteResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Alarm note response"""

    id: UUID
    alarm_id: UUID
    note: str
    note_type: str
    created_by: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AlarmRuleCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create alarm rule request"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    rule_type: str = Field(..., description="correlation, suppression, or escalation")
    enabled: bool = True
    priority: int = Field(default=100, ge=1, le=1000)
    conditions: dict[str, Any] = Field(..., description="Rule matching conditions")
    actions: dict[str, Any] = Field(..., description="Actions to take")
    time_window: int = Field(default=300, ge=0, description="Time window in seconds")

    @field_validator("rule_type")
    @classmethod
    def validate_rule_type(cls, v: str) -> str:
        valid_types = ["correlation", "suppression", "escalation"]
        if v not in valid_types:
            raise ValueError(f"rule_type must be one of: {', '.join(valid_types)}")
        return v


class AlarmRuleUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update alarm rule request"""

    model_config = ConfigDict()

    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    priority: int | None = Field(None, ge=1, le=1000)
    conditions: dict[str, Any] | None = None
    actions: dict[str, Any] | None = None
    time_window: int | None = Field(None, ge=0)


class AlarmRuleResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Alarm rule response"""

    id: UUID
    tenant_id: str
    name: str
    description: str | None
    rule_type: str
    enabled: bool
    priority: int
    conditions: dict[str, Any]
    actions: dict[str, Any]
    time_window: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# SLA Schemas
# =============================================================================


class SLADefinitionCreate(BaseModel):
    """Create SLA definition request"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    service_type: str | None = Field(None, min_length=1, max_length=100)
    service_level: str | None = Field(None, min_length=1, max_length=100)

    availability_target: float = Field(
        ..., ge=0.0, le=100.0, description="Target availability percentage (0-100)"
    )
    measurement_period_days: int = Field(default=30, ge=1, le=365)
    response_time_target: int = Field(default=60, ge=1, description="Minutes")
    resolution_time_target: int = Field(default=240, ge=1, description="Minutes")

    max_latency_ms: float | None = Field(None, ge=0.0)
    max_packet_loss_percent: float | None = Field(None, ge=0.0, le=100.0)
    min_bandwidth_mbps: float | None = Field(None, ge=0.0)

    response_time_critical: int | None = Field(None, ge=1, description="Minutes")
    response_time_major: int | None = Field(None, ge=1, description="Minutes")
    response_time_minor: int | None = Field(None, ge=1, description="Minutes")

    resolution_time_critical: int | None = Field(None, ge=1, description="Minutes")
    resolution_time_major: int | None = Field(None, ge=1, description="Minutes")
    resolution_time_minor: int | None = Field(None, ge=1, description="Minutes")

    business_hours_only: bool = False
    exclude_maintenance: bool = True
    enabled: bool = True


class SLADefinitionUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update SLA definition request"""

    model_config = ConfigDict()

    name: str | None = None
    description: str | None = None
    availability_target: float | None = Field(None, ge=0.0, le=100.0)
    measurement_period_days: int | None = Field(None, ge=1, le=365)
    response_time_target: int | None = Field(None, ge=1)
    resolution_time_target: int | None = Field(None, ge=1)
    max_latency_ms: float | None = Field(None, ge=0.0)
    max_packet_loss_percent: float | None = Field(None, ge=0.0, le=100.0)
    min_bandwidth_mbps: float | None = Field(None, ge=0.0)
    enabled: bool | None = None


class SLADefinitionResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """SLA definition response"""

    id: UUID
    tenant_id: str
    name: str
    description: str | None
    service_type: str
    service_level: str | None
    availability_target: float
    measurement_period_days: int
    response_time_target: int
    resolution_time_target: int
    max_latency_ms: float | None
    max_packet_loss_percent: float | None
    min_bandwidth_mbps: float | None
    business_hours_only: bool
    exclude_maintenance: bool
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SLAInstanceCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create SLA instance request"""

    model_config = ConfigDict(populate_by_name=True)

    sla_definition_id: UUID
    customer_id: UUID | None = None
    customer_name: str | None = None
    service_id: UUID | None = None
    service_name: str | None = None
    subscription_id: str | None = None
    start_date: datetime = Field(
        ..., validation_alias=AliasChoices("start_date", "period_start")
    )
    end_date: datetime | None = Field(
        None, validation_alias=AliasChoices("end_date", "period_end")
    )


class SLAInstanceResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """SLA instance response"""

    id: UUID
    tenant_id: str
    sla_definition_id: UUID
    customer_id: UUID | None
    customer_name: str | None
    service_id: UUID | None
    service_name: str | None
    subscription_id: str | None
    status: SLAStatus
    current_availability: float
    start_date: datetime
    end_date: datetime
    total_downtime: int
    planned_downtime: int
    unplanned_downtime: int
    breach_count: int
    last_breach_at: datetime | None
    credit_amount: float
    penalty_amount: float
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SLABreachResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """SLA breach response"""

    id: UUID
    tenant_id: str
    sla_instance_id: UUID
    breach_type: str
    severity: str
    detected_at: datetime
    breach_end: datetime | None
    duration_minutes: int | None
    target_value: float
    actual_value: float
    deviation_percent: float
    alarm_id: UUID | None
    ticket_id: UUID | None
    resolved: bool
    resolved_at: datetime | None
    resolution_notes: str | None
    credit_amount: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Maintenance Window Schemas
# =============================================================================


class MaintenanceWindowCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create maintenance window request"""

    model_config = ConfigDict()

    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    start_time: datetime
    end_time: datetime
    timezone: str = "UTC"
    resource_type: str | None = None
    resource_id: str | None = None
    affected_services: list[str] = Field(default_factory=lambda: [])
    affected_customers: list[str] = Field(default_factory=lambda: [])
    affected_resources: dict[str, Any] = Field(default_factory=lambda: {})
    suppress_alarms: bool = True
    notify_customers: bool = True

    @field_validator("end_time")
    @classmethod
    def validate_end_time(cls, v: datetime, info: ValidationInfo) -> datetime:
        if "start_time" in info.data and v <= info.data["start_time"]:
            raise ValueError("end_time must be after start_time")
        return v


class MaintenanceWindowUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update maintenance window request"""

    model_config = ConfigDict()

    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str | None = None
    suppress_alarms: bool | None = None


class MaintenanceWindowResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Maintenance window response"""

    id: UUID
    tenant_id: str
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    timezone: str
    affected_services: list[str]
    affected_customers: list[str]
    affected_resources: dict[str, Any]
    status: str
    suppress_alarms: bool
    notify_customers: bool
    notification_sent: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Query and Statistics Schemas
# =============================================================================


class AlarmQueryParams(BaseModel):  # BaseModel resolves to Any in isolation
    """Alarm query parameters"""

    model_config = ConfigDict()

    severity: list[AlarmSeverity] | None = None
    status: list[AlarmStatus] | None = None
    source: list[AlarmSource] | None = None
    alarm_type: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    customer_id: UUID | None = None
    assigned_to: UUID | None = None
    is_root_cause: bool | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


class AlarmStatistics(BaseModel):  # BaseModel resolves to Any in isolation
    """Alarm statistics response"""

    model_config = ConfigDict()

    total_alarms: int
    active_alarms: int
    critical_alarms: int
    major_alarms: int
    minor_alarms: int
    acknowledged_alarms: int
    unacknowledged_alarms: int
    cleared_alarms: int
    with_tickets: int
    without_tickets: int
    avg_resolution_time_minutes: float | None
    alarms_by_severity: dict[str, int]
    alarms_by_source: dict[str, int]
    alarms_by_status: dict[str, int]


class SLAComplianceReport(BaseModel):
    """SLA compliance report"""

    model_config = ConfigDict()

    period_start: datetime
    period_end: datetime
    total_instances: int
    compliant_instances: int
    at_risk_instances: int
    breached_instances: int
    avg_availability: float
    overall_compliance_rate: float
    total_breaches: int
    total_credits: float
    compliance_by_service_type: dict[str, float]
    instances: list[SLAInstanceResponse]
