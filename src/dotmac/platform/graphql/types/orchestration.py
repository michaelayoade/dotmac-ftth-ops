"""
GraphQL types for Orchestration Service.

Provides GraphQL representations of workflows and related types.
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

import strawberry

if TYPE_CHECKING:
    from dotmac.platform.orchestration.schemas import WorkflowResponse, WorkflowStepResponse

# ============================================================================
# Enums
# ============================================================================


@strawberry.enum(description="Workflow execution status")
class WorkflowStatus(str, Enum):
    """Workflow status enum for GraphQL."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"
    COMPENSATED = "compensated"


@strawberry.enum(description="Workflow step status")
class WorkflowStepStatus(str, Enum):
    """Workflow step status enum for GraphQL."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    COMPENSATION_FAILED = "compensation_failed"


@strawberry.enum(description="Workflow type")
class WorkflowType(str, Enum):
    """Workflow type enum for GraphQL."""

    PROVISION_SUBSCRIBER = "provision_subscriber"
    DEPROVISION_SUBSCRIBER = "deprovision_subscriber"
    ACTIVATE_SERVICE = "activate_service"
    SUSPEND_SERVICE = "suspend_service"
    TERMINATE_SERVICE = "terminate_service"
    CHANGE_SERVICE_PLAN = "change_service_plan"
    UPDATE_NETWORK_CONFIG = "update_network_config"
    MIGRATE_SUBSCRIBER = "migrate_subscriber"


# ============================================================================
# Object Types
# ============================================================================


@strawberry.type(description="Workflow step details")
class WorkflowStep:
    """GraphQL type for workflow step."""

    step_id: str
    step_name: str
    step_order: int
    target_system: str | None = None
    status: WorkflowStepStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None
    retry_count: int = 0
    output_data: str | None = None  # JSON as string

    @staticmethod
    def from_model(step: Any) -> "WorkflowStep":
        """Convert database model to GraphQL type."""
        import json

        status_value = getattr(step.status, "value", step.status)
        return WorkflowStep(
            step_id=step.step_id,
            step_name=step.step_name,
            step_order=step.step_order,
            target_system=step.target_system,
            status=WorkflowStepStatus(status_value),
            started_at=step.started_at,
            completed_at=step.completed_at,
            failed_at=step.failed_at,
            error_message=step.error_message,
            retry_count=step.retry_count,
            output_data=json.dumps(step.output_data) if step.output_data else None,
        )

    @staticmethod
    def from_response(step: "WorkflowStepResponse") -> "WorkflowStep":
        """Convert workflow step response to GraphQL type."""
        import json

        status_value = getattr(step.status, "value", step.status)
        step_order = getattr(step, "step_order", getattr(step, "sequence_number", 0))
        output_payload = step.output_data if getattr(step, "output_data", None) else None

        return WorkflowStep(
            step_id=getattr(step, "step_id", None) or step.step_name,
            step_name=step.step_name,
            step_order=step_order,
            target_system=getattr(step, "target_system", None),
            status=WorkflowStepStatus(status_value),
            started_at=getattr(step, "started_at", None),
            completed_at=getattr(step, "completed_at", None),
            failed_at=getattr(step, "failed_at", None),
            error_message=getattr(step, "error_message", None),
            retry_count=getattr(step, "retry_count", 0),
            output_data=json.dumps(output_payload) if output_payload else None,
        )


@strawberry.type(description="Workflow execution details")
class Workflow:
    """GraphQL type for workflow."""

    workflow_id: str
    workflow_type: WorkflowType
    status: WorkflowStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None
    retry_count: int = 0
    steps: list[WorkflowStep] = strawberry.field(default_factory=list)

    # Duration helpers
    @strawberry.field(description="Workflow duration in seconds")
    def duration_seconds(self) -> float | None:
        """Calculate workflow duration."""
        if not self.started_at:
            return None

        end_time = self.completed_at or self.failed_at or datetime.utcnow()
        return (end_time - self.started_at).total_seconds()

    @strawberry.field(description="Is workflow in terminal state")
    def is_terminal(self) -> bool:
        """Check if workflow is in terminal state."""
        return self.status in [
            WorkflowStatus.COMPLETED,
            WorkflowStatus.FAILED,
            WorkflowStatus.ROLLED_BACK,
            WorkflowStatus.COMPENSATED,
        ]

    @strawberry.field(description="Number of completed steps")
    def completed_steps_count(self) -> int:
        """Count completed steps."""
        return sum(1 for step in self.steps if step.status == WorkflowStepStatus.COMPLETED)

    @strawberry.field(description="Total number of steps")
    def total_steps_count(self) -> int:
        """Count total steps."""
        return len(self.steps)

    @staticmethod
    def from_model(workflow: Any) -> "Workflow":
        """Convert database model to GraphQL type."""
        status_value = getattr(workflow.status, "value", workflow.status)
        workflow_type_value = getattr(workflow.workflow_type, "value", workflow.workflow_type)
        return Workflow(
            workflow_id=workflow.workflow_id,
            workflow_type=WorkflowType(workflow_type_value),
            status=WorkflowStatus(status_value),
            started_at=workflow.started_at,
            completed_at=workflow.completed_at,
            failed_at=workflow.failed_at,
            error_message=workflow.error_message,
            retry_count=workflow.retry_count,
            steps=[WorkflowStep.from_model(step) for step in workflow.steps],
        )

    @staticmethod
    def from_response(workflow: "WorkflowResponse") -> "Workflow":
        """Convert workflow response to GraphQL type."""
        status_value = getattr(workflow.status, "value", workflow.status)
        workflow_type_value = getattr(workflow.workflow_type, "value", workflow.workflow_type)
        return Workflow(
            workflow_id=workflow.workflow_id,
            workflow_type=WorkflowType(workflow_type_value),
            status=WorkflowStatus(status_value),
            started_at=workflow.started_at,
            completed_at=workflow.completed_at,
            failed_at=workflow.failed_at,
            error_message=workflow.error_message,
            retry_count=workflow.retry_count or 0,
            steps=[WorkflowStep.from_response(step) for step in getattr(workflow, "steps", [])],
        )


@strawberry.type(description="Subscriber provisioning result")
class ProvisionSubscriberResult:
    """GraphQL type for subscriber provisioning result."""

    workflow_id: str
    subscriber_id: str | None = None
    customer_id: str | None = None
    status: WorkflowStatus

    # Created resources
    radius_username: str | None = None
    ipv4_address: str | None = None
    vlan_id: int | None = None
    onu_id: str | None = None
    cpe_id: str | None = None
    service_id: str | None = None

    # Workflow details
    steps_completed: int | None = None
    total_steps: int | None = None
    error_message: str | None = None

    created_at: datetime | None = None
    completed_at: datetime | None = None

    @strawberry.field(description="Is provisioning successful")
    def is_successful(self) -> bool:
        """Check if provisioning was successful."""
        return self.status == WorkflowStatus.COMPLETED

    @strawberry.field(description="Full workflow details")
    async def workflow(self, info: strawberry.Info) -> Workflow | None:
        """Fetch full workflow details."""
        from dotmac.platform.orchestration.service import OrchestrationService

        context = info.context
        db = context.db
        tenant_id = context.get_active_tenant_id()

        service = OrchestrationService(db=db, tenant_id=tenant_id)
        workflow_response = await service.get_workflow(self.workflow_id)

        if not workflow_response:
            return None

        return Workflow.from_response(workflow_response)


@strawberry.type(description="Workflow list with pagination")
class WorkflowConnection:
    """GraphQL connection type for workflows."""

    workflows: list[Workflow]
    total_count: int
    has_next_page: bool


@strawberry.type(description="Workflow statistics")
class WorkflowStatistics:
    """GraphQL type for workflow statistics."""

    total_workflows: int
    pending_workflows: int
    running_workflows: int
    completed_workflows: int
    failed_workflows: int
    rolled_back_workflows: int

    success_rate: float
    average_duration_seconds: float
    total_compensations: int

    @strawberry.field(description="Workflows by type")
    def by_type(self) -> str:
        """Return workflows by type as JSON string."""
        # This would be populated from the service
        return "{}"

    @strawberry.field(description="Workflows by status")
    def by_status(self) -> str:
        """Return workflows by status as JSON string."""
        # This would be populated from the service
        return "{}"


# ============================================================================
# Input Types
# ============================================================================


@strawberry.input(description="Subscriber provisioning input")
class ProvisionSubscriberInput:
    """GraphQL input for subscriber provisioning."""

    # Customer information
    customer_id: str | None = None
    first_name: str
    last_name: str
    email: str
    phone: str
    secondary_phone: str | None = None

    # Service address
    service_address: str
    service_city: str
    service_state: str
    service_postal_code: str
    service_country: str = "USA"

    # Service plan
    service_plan_id: str
    bandwidth_mbps: int
    connection_type: str

    # Network equipment
    onu_serial: str | None = None
    onu_mac: str | None = None
    cpe_mac: str | None = None

    # Network configuration
    vlan_id: int | None = None
    ipv4_address: str | None = None
    ipv6_prefix: str | None = None

    # Installation
    installation_date: datetime | None = None
    installation_notes: str | None = None

    # Options
    auto_activate: bool = True
    send_welcome_email: bool = True
    create_radius_account: bool = True
    allocate_ip_from_netbox: bool = True
    configure_voltha: bool = True
    configure_genieacs: bool = True

    # Metadata
    notes: str | None = None


@strawberry.input(description="Workflow filter input")
class WorkflowFilterInput:
    """GraphQL input for filtering workflows."""

    workflow_type: WorkflowType | None = None
    status: WorkflowStatus | None = None
    limit: int = 50
    offset: int = 0
