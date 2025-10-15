"""
Fault Management Pydantic Schemas

Request and response schemas for fault management API.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, ValidationInfo, field_validator

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


class AlarmCreate(BaseModel):
    """Create alarm request"""

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
    tags: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    probable_cause: str | None = None
    recommended_action: str | None = None


class AlarmUpdate(BaseModel):
    """Update alarm request"""

    severity: AlarmSeverity | None = None
    status: AlarmStatus | None = None
    assigned_to: UUID | None = None
    probable_cause: str | None = None
    recommended_action: str | None = None
    tags: dict[str, Any] | None = None


class AlarmAcknowledge(BaseModel):
    """Acknowledge alarm request"""

    note: str | None = Field(None, description="Acknowledgment note")


class AlarmResponse(BaseModel):
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
    cleared_at: datetime | None
    resolved_at: datetime | None

    assigned_to: UUID | None
    ticket_id: UUID | None

    tags: dict[str, Any]
    metadata: dict[str, Any]
    probable_cause: str | None
    recommended_action: str | None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AlarmNoteCreate(BaseModel):
    """Create alarm note request"""

    note: str = Field(..., min_length=1, description="Note content")


class AlarmNoteResponse(BaseModel):
    """Alarm note response"""

    id: UUID
    alarm_id: UUID
    note: str
    created_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AlarmRuleCreate(BaseModel):
    """Create alarm rule request"""

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


class AlarmRuleUpdate(BaseModel):
    """Update alarm rule request"""

    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    priority: int | None = Field(None, ge=1, le=1000)
    conditions: dict[str, Any] | None = None
    actions: dict[str, Any] | None = None
    time_window: int | None = Field(None, ge=0)


class AlarmRuleResponse(BaseModel):
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

    model_config = {"from_attributes": True}


# =============================================================================
# SLA Schemas
# =============================================================================


class SLADefinitionCreate(BaseModel):
    """Create SLA definition request"""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    service_type: str = Field(..., min_length=1, max_length=100)

    availability_target: float = Field(..., ge=0.0, le=1.0, description="Target availability (0-1)")
    measurement_period_days: int = Field(default=30, ge=1, le=365)

    max_latency_ms: float | None = Field(None, ge=0.0)
    max_packet_loss_percent: float | None = Field(None, ge=0.0, le=100.0)
    min_bandwidth_mbps: float | None = Field(None, ge=0.0)

    response_time_critical: int = Field(default=15, ge=1, description="Minutes")
    response_time_major: int = Field(default=60, ge=1, description="Minutes")
    response_time_minor: int = Field(default=240, ge=1, description="Minutes")

    resolution_time_critical: int = Field(default=240, ge=1, description="Minutes")
    resolution_time_major: int = Field(default=480, ge=1, description="Minutes")
    resolution_time_minor: int = Field(default=1440, ge=1, description="Minutes")

    business_hours_only: bool = False
    exclude_maintenance: bool = True
    enabled: bool = True


class SLADefinitionUpdate(BaseModel):
    """Update SLA definition request"""

    name: str | None = None
    description: str | None = None
    availability_target: float | None = Field(None, ge=0.0, le=1.0)
    max_latency_ms: float | None = Field(None, ge=0.0)
    max_packet_loss_percent: float | None = Field(None, ge=0.0, le=100.0)
    min_bandwidth_mbps: float | None = Field(None, ge=0.0)
    enabled: bool | None = None


class SLADefinitionResponse(BaseModel):
    """SLA definition response"""

    id: UUID
    tenant_id: str
    name: str
    description: str | None
    service_type: str
    availability_target: float
    measurement_period_days: int
    max_latency_ms: float | None
    max_packet_loss_percent: float | None
    min_bandwidth_mbps: float | None
    response_time_critical: int
    response_time_major: int
    response_time_minor: int
    resolution_time_critical: int
    resolution_time_major: int
    resolution_time_minor: int
    business_hours_only: bool
    exclude_maintenance: bool
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SLAInstanceCreate(BaseModel):
    """Create SLA instance request"""

    sla_definition_id: UUID
    customer_id: UUID | None = None
    service_id: UUID | None = None
    subscription_id: str | None = None
    period_start: datetime
    period_end: datetime


class SLAInstanceResponse(BaseModel):
    """SLA instance response"""

    id: UUID
    tenant_id: str
    sla_definition_id: UUID
    customer_id: UUID | None
    service_id: UUID | None
    subscription_id: str | None
    status: SLAStatus
    current_availability: float
    period_start: datetime
    period_end: datetime
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

    model_config = {"from_attributes": True}


class SLABreachResponse(BaseModel):
    """SLA breach response"""

    id: UUID
    tenant_id: str
    sla_instance_id: UUID
    breach_type: str
    severity: AlarmSeverity
    breach_start: datetime
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

    model_config = {"from_attributes": True}


# =============================================================================
# Maintenance Window Schemas
# =============================================================================


class MaintenanceWindowCreate(BaseModel):
    """Create maintenance window request"""

    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    start_time: datetime
    end_time: datetime
    timezone: str = "UTC"
    affected_services: list[str] = Field(default_factory=list)
    affected_customers: list[str] = Field(default_factory=list)
    affected_resources: dict[str, Any] = Field(default_factory=dict)
    suppress_alarms: bool = True
    notify_customers: bool = True

    @field_validator("end_time")
    @classmethod
    def validate_end_time(cls, v: datetime, info: ValidationInfo) -> datetime:
        if "start_time" in info.data and v <= info.data["start_time"]:
            raise ValueError("end_time must be after start_time")
        return v


class MaintenanceWindowUpdate(BaseModel):
    """Update maintenance window request"""

    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str | None = None
    suppress_alarms: bool | None = None


class MaintenanceWindowResponse(BaseModel):
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

    model_config = {"from_attributes": True}


# =============================================================================
# Query and Statistics Schemas
# =============================================================================


class AlarmQueryParams(BaseModel):
    """Alarm query parameters"""

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


class AlarmStatistics(BaseModel):
    """Alarm statistics response"""

    total_alarms: int
    active_alarms: int
    critical_alarms: int
    major_alarms: int
    minor_alarms: int
    acknowledged_alarms: int
    unacknowledged_alarms: int
    with_tickets: int
    without_tickets: int
    avg_resolution_time_minutes: float | None
    alarms_by_severity: dict[str, int]
    alarms_by_source: dict[str, int]
    alarms_by_status: dict[str, int]


class SLAComplianceReport(BaseModel):
    """SLA compliance report"""

    period_start: datetime
    period_end: datetime
    total_instances: int
    compliant_instances: int
    at_risk_instances: int
    breached_instances: int
    avg_availability: float
    total_breaches: int
    total_credits: float
    compliance_by_service_type: dict[str, float]
