"""
Orchestration Service Schemas

Pydantic schemas for API requests and responses.
"""

# mypy: disable-error-code="attr-defined,call-arg,misc"

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, FieldValidationInfo, field_validator, model_validator

from .models import WorkflowStatus, WorkflowStepStatus, WorkflowType

# ============================================================================
# Request Schemas
# ============================================================================


class ProvisionSubscriberRequest(BaseModel):
    """Request schema for subscriber provisioning orchestration."""

    # Core identifiers
    customer_id: str | None = Field(None, description="Existing customer ID")
    plan_id: str | None = Field(None, description="Billing plan identifier")
    service_plan_id: str | None = Field(None, description="Legacy service plan identifier")
    subscriber_id: str | None = Field(None, description="Existing subscriber being updated")

    # Contact / login details
    first_name: str | None = Field(None, description="Customer first name")
    last_name: str | None = Field(None, description="Customer last name")
    email: str | None = Field(None, description="Customer email address")
    phone: str | None = Field(None, description="Primary phone number")
    secondary_phone: str | None = Field(None, description="Secondary phone number")
    username: str | None = Field(None, description="Portal or RADIUS username")
    password: str | None = Field(None, description="Portal or RADIUS password")

    # Service address
    service_address: str = Field(..., description="Service installation address")
    service_city: str | None = Field(None, description="City for installation")
    service_state: str | None = Field(None, description="State/Province for installation")
    service_postal_code: str | None = Field(None, description="Postal/ZIP code")
    service_country: str | None = Field("USA", description="Country")

    # Service plan characteristics
    bandwidth_mbps: int | None = Field(None, gt=0, description="Bandwidth allocation in Mbps")
    connection_type: str | None = Field(
        None, description="Connection type: ftth, fttb, wireless, hybrid"
    )

    # Equipment details
    onu_serial: str | None = Field(None, description="ONU/ONT serial number")
    onu_mac: str | None = Field(None, description="ONU/ONT MAC address")
    cpe_mac: str | None = Field(None, description="CPE/Router MAC address")

    # Network configuration
    vlan_id: int | None = Field(None, ge=1, le=4094, description="VLAN ID")
    ipv4_address: str | None = Field(None, description="Static IPv4 address")
    ipv6_prefix: str | None = Field(None, description="IPv6 prefix")

    # Scheduling
    installation_date: datetime | None = Field(None, description="Scheduled installation date")
    installation_notes: str | None = Field(None, description="Installation notes")

    # Options
    auto_activate: bool = Field(
        True, description="Automatically activate service after provisioning"
    )
    send_welcome_email: bool = Field(True, description="Send welcome email to customer")
    create_radius_account: bool = Field(True, description="Create RADIUS authentication")
    allocate_ip_from_netbox: bool = Field(True, description="Allocate IP from NetBox")
    configure_voltha: bool = Field(True, description="Configure ONU in VOLTHA")
    configure_genieacs: bool = Field(True, description="Configure CPE in GenieACS")

    # Metadata
    notes: str | None = Field(None, description="Additional notes")
    tags: dict[str, Any] = Field(default_factory=dict, description="Custom tags")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        """Validate basic email format when provided."""
        if value is None:
            return value
        if "@" not in value:
            raise ValueError("Invalid email address")
        return value.lower()

    @field_validator("connection_type")
    @classmethod
    def validate_connection_type(cls, value: str | None) -> str | None:
        """Ensure connection type matches supported values when provided."""
        if value is None:
            return value
        allowed = {"ftth", "fttb", "wireless", "hybrid"}
        normalized = value.lower()
        if normalized not in allowed:
            raise ValueError(f"Connection type must be one of: {', '.join(sorted(allowed))}")
        return normalized

    @model_validator(mode="after")
    def ensure_minimum_identifiers(self) -> "ProvisionSubscriberRequest":
        """Ensure the request contains at least one identifier for the subscriber."""
        if not any([self.email, self.username, self.customer_id]):
            raise ValueError(
                "Provisioning request must include at least email, username, or customer_id"
            )
        return self

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_non_empty(cls, value: str | None, info: FieldValidationInfo) -> str | None:
        """Ensure optional name fields are non-empty when provided."""
        if value is None:
            return value
        if not value.strip():
            raise ValueError(f"{info.field_name.replace('_', ' ').title()} cannot be empty")
        return value


class DeprovisionSubscriberRequest(BaseModel):
    """Request schema for subscriber deprovisioning."""

    subscriber_id: str | None = Field(None, description="Subscriber ID to deprovision")
    customer_id: str | None = Field(None, description="Customer ID to deprovision")
    reason: str = Field(..., description="Reason for deprovisioning")
    terminate_immediately: bool = Field(
        False, description="Terminate immediately or at end of billing cycle"
    )
    termination_date: datetime | None = Field(None, description="Requested termination date")
    force: bool = Field(False, description="Force deprovision even if clean-up fails")
    refund_amount: float | None = Field(None, ge=0, description="Refund amount if applicable")
    notes: str | None = Field(None, description="Additional notes")

    @model_validator(mode="after")
    def ensure_identifier(self) -> "DeprovisionSubscriberRequest":
        if not self.subscriber_id and not self.customer_id:
            raise ValueError("Deprovision request requires subscriber_id or customer_id")
        return self


class ActivateServiceRequest(BaseModel):
    """Request schema for service activation."""

    subscriber_id: str | None = Field(None, description="Subscriber ID")
    customer_id: str | None = Field(None, description="Customer ID")
    service_id: str | None = Field(None, description="Specific service ID to activate")
    service_plan: str | None = Field(None, description="Service plan identifier")
    activation_date: datetime | None = Field(None, description="Scheduled activation date")
    effective_date: datetime | None = Field(None, description="Alias for activation date")
    send_notification: bool = Field(True, description="Send activation notification")

    @model_validator(mode="after")
    def ensure_identifier(self) -> "ActivateServiceRequest":
        if not self.subscriber_id and not self.customer_id:
            raise ValueError("Activation request requires subscriber_id or customer_id")
        if self.effective_date and not self.activation_date:
            self.activation_date = self.effective_date
        return self


class SuspendServiceRequest(BaseModel):
    """Request schema for service suspension."""

    subscriber_id: str | None = Field(None, description="Subscriber ID")
    customer_id: str | None = Field(None, description="Customer ID")
    reason: str = Field(..., description="Reason for suspension")
    suspend_until: datetime | None = Field(None, description="Auto-resume date")
    send_notification: bool = Field(True, description="Send suspension notification")
    disconnect_sessions: bool = Field(
        default=False,
        description="Disconnect active subscriber sessions",
    )

    @model_validator(mode="before")
    @classmethod
    def _apply_disconnect_alias(cls, data: Any) -> Any:
        if isinstance(data, dict) and "disconnect_sessions" not in data:
            if "disconnect_active_sessions" in data:
                updated = dict(data)
                updated["disconnect_sessions"] = updated["disconnect_active_sessions"]
                return updated
        return data

    @model_validator(mode="after")
    def ensure_identifier(self) -> "SuspendServiceRequest":
        if not self.subscriber_id and not self.customer_id:
            raise ValueError("Suspend service request requires subscriber_id or customer_id")
        return self

    model_config = {"populate_by_name": True}


# ============================================================================
# Response Schemas
# ============================================================================


class WorkflowStepResponse(BaseModel):
    """Response schema for workflow step."""

    step_id: str | None = None
    step_name: str
    sequence_number: int
    target_system: str | None = None
    status: WorkflowStepStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None
    retry_count: int = 0
    output_data: dict[str, Any] | None = None

    model_config = {"from_attributes": True}

    @property
    def step_order(self) -> int:
        """Backward-compatible accessor."""
        return self.sequence_number


class WorkflowResponse(BaseModel):
    """Response schema for workflow."""

    workflow_id: str
    workflow_type: WorkflowType
    status: WorkflowStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None
    retry_count: int | None = 0
    steps: list[WorkflowStepResponse] = Field(default_factory=list)
    context: dict[str, Any] | None = None
    output_data: dict[str, Any] | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def _normalize_retry_count(self) -> "WorkflowResponse":
        if self.retry_count is None:
            self.retry_count = 0
        return self


class ProvisionSubscriberResponse(BaseModel):
    """Response schema for subscriber provisioning."""

    workflow_id: str = Field(..., description="Orchestration workflow ID")
    status: WorkflowStatus = Field(..., description="Provisioning status")
    subscriber_id: str | None = Field(None, description="Created subscriber ID")
    customer_id: str | None = Field(None, description="Associated customer ID")

    # Created resources
    radius_username: str | None = Field(None, description="RADIUS username")
    ipv4_address: str | None = Field(None, description="Assigned IPv4 address")
    ipv6_prefix: str | None = Field(None, description="Assigned IPv6 prefix")
    vlan_id: int | None = Field(None, description="Assigned VLAN ID")
    onu_id: str | None = Field(None, description="VOLTHA ONU ID")
    cpe_id: str | None = Field(None, description="GenieACS CPE ID")
    service_id: str | None = Field(None, description="Billing service ID")

    # Workflow details
    steps_completed: int | None = Field(None, description="Number of completed steps")
    total_steps: int | None = Field(None, description="Total number of steps")
    error_message: str | None = Field(None, description="Error message if failed")

    created_at: datetime | None = Field(None, description="Workflow creation time")
    completed_at: datetime | None = Field(None, description="Workflow completion time")


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
    active_workflows: int = Field(
        0, description="Currently active workflows (pending|running|rolling_back)"
    )
    recent_failures: int = Field(
        0, description="Failures observed in the recent lookback window (24h)"
    )

    by_type: dict[str, int]
    by_status: dict[str, int]

    @property
    def total_count(self) -> int:
        return self.total_workflows

    @property
    def pending_count(self) -> int:
        return self.pending_workflows

    @property
    def running_count(self) -> int:
        return self.running_workflows

    @property
    def completed_count(self) -> int:
        return self.completed_workflows

    @property
    def failed_count(self) -> int:
        return self.failed_workflows

    @property
    def rolled_back_count(self) -> int:
        return self.rolled_back_workflows


# ============================================================================
# Internal Schemas
# ============================================================================


class StepDefinition(BaseModel):
    """Definition of a workflow step."""

    step_name: str
    step_type: str
    target_system: str
    handler: str  # Function/method name to execute
    compensation_handler: str | None = None  # Rollback function
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
