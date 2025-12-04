"""
Service Lifecycle Schemas.

Pydantic schemas for service lifecycle operations including provisioning,
activation, suspension, resumption, and termination.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.services.lifecycle.models import (
    LifecycleEventType,
    ProvisioningStatus,
    ServiceStatus,
    ServiceType,
)


class ServiceProvisionRequest(BaseModel):
    """Request to provision a new service instance."""

    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=False)

    customer_id: UUID = Field(description="Customer ID who will own the service")
    service_name: str = Field(
        min_length=3, max_length=255, description="Human-readable service name"
    )
    service_type: ServiceType = Field(description="Type of service to provision")

    # Optional billing relationship
    subscription_id: str | None = Field(
        None, max_length=50, description="Related billing subscription ID"
    )
    plan_id: str | None = Field(None, max_length=50, description="Service plan/product ID")

    # Service configuration
    service_config: dict[str, Any] = Field(
        default_factory=dict,
        description="Service-specific configuration (bandwidth, static_ip, etc.)",
    )

    # Installation details
    installation_address: str | None = Field(
        None, max_length=500, description="Service installation address"
    )
    installation_scheduled_date: datetime | None = Field(
        None, description="Scheduled installation date"
    )
    installation_technician_id: UUID | None = Field(None, description="Assigned technician ID")

    # Network configuration
    equipment_assigned: list[str] = Field(
        default_factory=list, description="Equipment IDs to assign"
    )
    vlan_id: int | None = Field(None, ge=1, le=4094, description="VLAN ID")

    # Integration
    external_service_id: str | None = Field(
        None, max_length=100, description="External system service ID"
    )
    network_element_id: str | None = Field(
        None, max_length=100, description="Network element identifier"
    )

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    notes: str | None = Field(None, description="Internal notes")

    @field_validator("service_config", "metadata")
    @classmethod
    def validate_json_fields(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Ensure JSON fields are dictionaries."""
        if not isinstance(v, dict):
            raise ValueError("Must be a dictionary")
        return v


class ServiceActivationRequest(BaseModel):
    """Request to activate a provisioned service."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_instance_id: UUID = Field(description="Service instance to activate")
    activation_note: str | None = Field(None, description="Activation notes")
    send_notification: bool = Field(True, description="Send activation notification to customer")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ServiceSuspensionRequest(BaseModel):
    """Request to suspend an active service."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_instance_id: UUID | None = Field(
        default=None, description="Service instance to suspend", alias="service_instance_id"
    )
    suspension_reason: str = Field(
        min_length=5,
        max_length=1000,
        description="Reason for suspension",
        alias="reason",
    )
    suspension_type: str | None = Field(
        None, description="Type of suspension (non_payment, customer_request, fraud)"
    )
    auto_resume_at: datetime | None = Field(None, description="Scheduled automatic resumption date")
    send_notification: bool = Field(True, description="Send suspension notification to customer")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    suspension_note: str | None = Field(
        None, description="Suspension note", alias="suspension_note"
    )


class ServiceResumptionRequest(BaseModel):
    """Request to resume a suspended service."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_instance_id: UUID | None = Field(
        default=None, description="Service instance to resume", alias="service_instance_id"
    )
    resumption_note: str | None = Field(None, description="Resumption notes")
    send_notification: bool = Field(True, description="Send resumption notification to customer")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ServiceTerminationRequest(BaseModel):
    """Request to terminate a service."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_instance_id: UUID | None = Field(
        default=None, description="Service instance to terminate", alias="service_instance_id"
    )
    termination_reason: str = Field(
        min_length=5,
        max_length=1000,
        description="Reason for termination",
        alias="reason",
    )
    termination_type: str = Field(
        default="customer_request",
        description="Type of termination (customer_request, non_payment, churn, etc.)",
    )
    termination_date: datetime | None = Field(
        None, description="Scheduled termination date (default: immediate)"
    )
    return_equipment: bool = Field(True, description="Whether equipment needs to be returned")
    send_notification: bool = Field(True, description="Send termination notification to customer")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    termination_note: str | None = Field(
        None, description="Termination note", alias="termination_note"
    )


class ServiceModificationRequest(BaseModel):
    """Request to modify an existing service."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_instance_id: UUID | None = Field(
        default=None, description="Service instance to modify", alias="service_instance_id"
    )

    # Fields that can be modified
    service_name: str | None = Field(None, min_length=3, max_length=255)
    service_config: dict[str, Any] | None = Field(None, description="Updated service configuration")
    installation_address: str | None = Field(None, max_length=500)
    equipment_assigned: list[str] | None = Field(None)
    vlan_id: int | None = Field(None, ge=1, le=4094)
    metadata: dict[str, Any] | None = Field(None)
    notes: str | None = Field(None)

    modification_reason: str = Field(
        min_length=5,
        max_length=1000,
        description="Reason for modification",
        alias="reason",
    )
    send_notification: bool = Field(True, description="Send modification notification")


class ServiceHealthCheckRequest(BaseModel):
    """Request to perform a health check on a service."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_instance_id: UUID = Field(description="Service instance to check")
    check_type: str | None = Field(
        None, description="Type of health check (connectivity, performance, etc.)"
    )


class BulkServiceOperationRequest(BaseModel):
    """Request to perform bulk operations on multiple services."""

    model_config = ConfigDict(str_strip_whitespace=True)

    service_instance_ids: list[UUID] = Field(
        min_length=1, max_length=1000, description="List of service instance IDs"
    )
    operation: str = Field(
        description="Operation to perform (suspend, resume, terminate, health_check)"
    )
    operation_params: dict[str, Any] = Field(
        default_factory=dict, description="Operation-specific parameters"
    )

    @field_validator("operation")
    @classmethod
    def validate_operation(cls, v: str) -> str:
        """Validate operation type."""
        allowed_operations = {"suspend", "resume", "terminate", "health_check"}
        if v not in allowed_operations:
            raise ValueError(f"Operation must be one of: {allowed_operations}")
        return v


class ServiceInstanceResponse(BaseModel):
    """Response model for service instance data."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=False)

    id: UUID
    tenant_id: str
    service_identifier: str
    service_name: str
    service_type: ServiceType
    customer_id: UUID
    subscription_id: str | None
    plan_id: str | None

    # Status
    status: ServiceStatus
    provisioning_status: ProvisioningStatus | None

    # Lifecycle dates
    ordered_at: datetime
    provisioning_started_at: datetime | None
    provisioned_at: datetime | None
    activated_at: datetime | None
    suspended_at: datetime | None
    terminated_at: datetime | None

    # Configuration
    service_config: dict[str, Any]
    installation_address: str | None
    installation_scheduled_date: datetime | None
    installation_completed_date: datetime | None
    installation_technician_id: UUID | None

    # Network
    equipment_assigned: list[str]
    ip_address: str | None
    mac_address: str | None
    vlan_id: int | None

    # Integration
    external_service_id: str | None
    network_element_id: str | None

    # Suspension
    suspension_reason: str | None
    auto_resume_at: datetime | None

    # Termination
    termination_reason: str | None
    termination_type: str | None

    # Health
    last_health_check_at: datetime | None
    health_status: str | None
    uptime_percentage: float | None

    # Workflow
    workflow_id: str | None
    retry_count: int
    notification_sent: bool

    # Metadata
    metadata: dict[str, Any]
    notes: str | None

    # Timestamps
    created_at: datetime
    updated_at: datetime | None
    deleted_at: datetime | None


class ServiceInstanceSummary(BaseModel):
    """Summary view of service instance for listings."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=False)

    id: UUID
    service_identifier: str
    service_name: str
    service_type: ServiceType
    customer_id: UUID
    status: ServiceStatus
    provisioning_status: ProvisioningStatus | None
    activated_at: datetime | None
    health_status: str | None
    created_at: datetime


class LifecycleEventResponse(BaseModel):
    """Response model for lifecycle event data."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=False)

    id: UUID
    tenant_id: str
    service_instance_id: UUID
    event_type: LifecycleEventType
    event_timestamp: datetime
    previous_status: ServiceStatus | None
    new_status: ServiceStatus | None
    description: str | None
    success: bool
    error_message: str | None
    error_code: str | None
    workflow_id: str | None
    task_id: str | None
    duration_seconds: float | None
    triggered_by_user_id: UUID | None
    triggered_by_system: str | None
    event_data: dict[str, Any]
    external_system_response: dict[str, Any] | None
    created_at: datetime


class ProvisioningWorkflowResponse(BaseModel):
    """Response model for provisioning workflow data."""

    model_config = ConfigDict(from_attributes=True, use_enum_values=False)

    id: UUID
    tenant_id: str
    workflow_id: str
    workflow_type: str
    service_instance_id: UUID
    status: ProvisioningStatus
    total_steps: int
    current_step: int
    completed_steps: list[str]
    failed_steps: list[str]
    started_at: datetime | None
    completed_at: datetime | None
    retry_count: int
    last_error: str | None
    rollback_required: bool
    rollback_completed: bool
    workflow_config: dict[str, Any]
    step_results: dict[str, Any]
    created_at: datetime
    updated_at: datetime | None


class ServiceStatistics(BaseModel):
    """Service statistics for a tenant."""

    model_config = ConfigDict()

    total_services: int = Field(description="Total number of services")
    active_services: int = Field(description="Number of active services")
    provisioning_services: int = Field(description="Services being provisioned")
    suspended_services: int = Field(description="Number of suspended services")
    terminated_services: int = Field(description="Number of terminated services")
    failed_services: int = Field(description="Number of failed services")

    # By service type
    services_by_type: dict[str, int] = Field(description="Service count by type")

    # Health metrics
    healthy_services: int = Field(description="Services in healthy state")
    degraded_services: int = Field(description="Services in degraded state")
    average_uptime: float = Field(description="Average uptime percentage")

    # Workflow metrics
    active_workflows: int = Field(description="Number of active workflows")
    failed_workflows: int = Field(description="Number of failed workflows")


class ServiceProvisioningResponse(BaseModel):
    """Response after initiating service provisioning."""

    model_config = ConfigDict(from_attributes=True)

    service_instance_id: UUID
    service_identifier: str
    workflow_id: str
    status: ServiceStatus
    provisioning_status: ProvisioningStatus
    message: str = Field(description="Human-readable status message")
    estimated_completion: datetime | None = Field(None, description="Estimated completion time")


class ServiceOperationResult(BaseModel):
    """Result of a service operation."""

    model_config = ConfigDict()

    success: bool
    service_instance_id: UUID
    operation: str
    message: str
    event_id: UUID | None = None
    workflow_id: str | None = None
    error: str | None = None


class BulkServiceOperationResult(BaseModel):
    """Result of bulk service operations."""

    model_config = ConfigDict()

    total_requested: int
    total_successful: int
    total_failed: int
    results: list[ServiceOperationResult]
    execution_time_seconds: float

    @property
    def successful(self) -> int:
        """Compatibility alias for total_successful."""
        return self.total_successful
