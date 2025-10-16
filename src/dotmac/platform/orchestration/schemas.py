"""
Orchestration Service Schemas

Pydantic schemas for API requests and responses.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from .models import WorkflowStatus, WorkflowStepStatus, WorkflowType


# ============================================================================
# Request Schemas
# ============================================================================


class ProvisionSubscriberRequest(BaseModel):
    """Request schema for subscriber provisioning orchestration."""

    # Customer information
    customer_id: Optional[str] = Field(None, description="Existing customer ID")
    first_name: str = Field(..., min_length=1, description="Customer first name")
    last_name: str = Field(..., min_length=1, description="Customer last name")
    email: str = Field(..., description="Customer email address")
    phone: str = Field(..., description="Primary phone number")
    secondary_phone: Optional[str] = Field(None, description="Secondary phone number")

    # Service address
    service_address: str = Field(..., description="Service installation address")
    service_city: str = Field(..., description="City")
    service_state: str = Field(..., description="State/Province")
    service_postal_code: str = Field(..., description="Postal/ZIP code")
    service_country: str = Field(default="USA", description="Country")

    # Service plan
    service_plan_id: str = Field(..., description="Service plan/package ID")
    bandwidth_mbps: int = Field(..., gt=0, description="Bandwidth allocation in Mbps")
    connection_type: str = Field(..., description="Connection type: ftth, fttb, wireless, hybrid")

    # Network equipment
    onu_serial: Optional[str] = Field(None, description="ONU/ONT serial number")
    onu_mac: Optional[str] = Field(None, description="ONU/ONT MAC address")
    cpe_mac: Optional[str] = Field(None, description="CPE/Router MAC address")

    # Network configuration
    vlan_id: Optional[int] = Field(None, ge=1, le=4094, description="VLAN ID")
    ipv4_address: Optional[str] = Field(None, description="Static IPv4 address")
    ipv6_prefix: Optional[str] = Field(None, description="IPv6 prefix")

    # Installation
    installation_date: Optional[datetime] = Field(None, description="Scheduled installation date")
    installation_notes: Optional[str] = Field(None, description="Installation notes")

    # Options
    auto_activate: bool = Field(default=True, description="Automatically activate service after provisioning")
    send_welcome_email: bool = Field(default=True, description="Send welcome email to customer")
    create_radius_account: bool = Field(default=True, description="Create RADIUS authentication")
    allocate_ip_from_netbox: bool = Field(default=True, description="Allocate IP from NetBox")
    configure_voltha: bool = Field(default=True, description="Configure ONU in VOLTHA")
    configure_genieacs: bool = Field(default=True, description="Configure CPE in GenieACS")

    # Metadata
    notes: Optional[str] = Field(None, description="Additional notes")
    tags: Optional[dict[str, Any]] = Field(default_factory=dict, description="Custom tags")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Validate email format."""
        if "@" not in v:
            raise ValueError("Invalid email address")
        return v.lower()

    @field_validator("connection_type")
    @classmethod
    def validate_connection_type(cls, v: str) -> str:
        """Validate connection type."""
        allowed = ["ftth", "fttb", "wireless", "hybrid"]
        if v.lower() not in allowed:
            raise ValueError(f"Connection type must be one of: {', '.join(allowed)}")
        return v.lower()


class DeprovisionSubscriberRequest(BaseModel):
    """Request schema for subscriber deprovisioning."""

    subscriber_id: str = Field(..., description="Subscriber ID to deprovision")
    reason: str = Field(..., description="Reason for deprovisioning")
    terminate_immediately: bool = Field(default=False, description="Terminate immediately or at end of billing cycle")
    refund_amount: Optional[float] = Field(None, ge=0, description="Refund amount if applicable")
    notes: Optional[str] = Field(None, description="Additional notes")


class ActivateServiceRequest(BaseModel):
    """Request schema for service activation."""

    subscriber_id: str = Field(..., description="Subscriber ID")
    service_id: Optional[str] = Field(None, description="Specific service ID to activate")
    activation_date: Optional[datetime] = Field(None, description="Scheduled activation date")
    send_notification: bool = Field(default=True, description="Send activation notification")


class SuspendServiceRequest(BaseModel):
    """Request schema for service suspension."""

    subscriber_id: str = Field(..., description="Subscriber ID")
    reason: str = Field(..., description="Reason for suspension")
    suspend_until: Optional[datetime] = Field(None, description="Auto-resume date")
    send_notification: bool = Field(default=True, description="Send suspension notification")


# ============================================================================
# Response Schemas
# ============================================================================


class WorkflowStepResponse(BaseModel):
    """Response schema for workflow step."""

    step_id: str
    step_name: str
    step_order: int
    target_system: str
    status: WorkflowStepStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    output_data: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}


class WorkflowResponse(BaseModel):
    """Response schema for workflow."""

    workflow_id: str
    workflow_type: WorkflowType
    status: WorkflowStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    steps: list[WorkflowStepResponse] = []

    model_config = {"from_attributes": True}


class ProvisionSubscriberResponse(BaseModel):
    """Response schema for subscriber provisioning."""

    workflow_id: str = Field(..., description="Orchestration workflow ID")
    subscriber_id: str = Field(..., description="Created subscriber ID")
    customer_id: str = Field(..., description="Associated customer ID")
    status: WorkflowStatus = Field(..., description="Provisioning status")

    # Created resources
    radius_username: Optional[str] = Field(None, description="RADIUS username")
    ipv4_address: Optional[str] = Field(None, description="Assigned IPv4 address")
    vlan_id: Optional[int] = Field(None, description="Assigned VLAN ID")
    onu_id: Optional[str] = Field(None, description="VOLTHA ONU ID")
    cpe_id: Optional[str] = Field(None, description="GenieACS CPE ID")
    service_id: Optional[str] = Field(None, description="Billing service ID")

    # Workflow details
    steps_completed: int = Field(..., description="Number of completed steps")
    total_steps: int = Field(..., description="Total number of steps")
    error_message: Optional[str] = Field(None, description="Error message if failed")

    created_at: datetime = Field(..., description="Workflow creation time")
    completed_at: Optional[datetime] = Field(None, description="Workflow completion time")


class WorkflowListResponse(BaseModel):
    """Response schema for workflow list."""

    workflows: list[WorkflowResponse]
    total: int
    limit: int
    offset: int


class WorkflowStatsResponse(BaseModel):
    """Response schema for workflow statistics."""

    total_workflows: int
    pending_workflows: int
    running_workflows: int
    completed_workflows: int
    failed_workflows: int
    rolled_back_workflows: int

    success_rate: float
    average_duration_seconds: float
    total_compensations: int

    by_type: dict[str, int]
    by_status: dict[str, int]


# ============================================================================
# Internal Schemas
# ============================================================================


class StepDefinition(BaseModel):
    """Definition of a workflow step."""

    step_name: str
    step_type: str
    target_system: str
    handler: str  # Function/method name to execute
    compensation_handler: Optional[str] = None  # Rollback function
    max_retries: int = 3
    timeout_seconds: int = 30
    required: bool = True  # Can the workflow continue if this step fails?


class WorkflowDefinition(BaseModel):
    """Definition of a complete workflow."""

    workflow_type: WorkflowType
    description: str
    steps: list[StepDefinition]
    max_retries: int = 3
    timeout_seconds: int = 300
