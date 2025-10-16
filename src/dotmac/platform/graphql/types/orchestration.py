"""
GraphQL types for Orchestration Service.

Provides GraphQL representations of workflows and related types.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

import strawberry

from dotmac.platform.orchestration.models import (
    WorkflowStatus as DBWorkflowStatus,
    WorkflowStepStatus as DBWorkflowStepStatus,
    WorkflowType as DBWorkflowType,
)


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
    target_system: str
    status: WorkflowStepStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    output_data: Optional[str] = None  # JSON as string

    @staticmethod
    def from_model(step: Any) -> "WorkflowStep":
        """Convert database model to GraphQL type."""
        import json

        return WorkflowStep(
            step_id=step.step_id,
            step_name=step.step_name,
            step_order=step.step_order,
            target_system=step.target_system,
            status=WorkflowStepStatus(step.status.value),
            started_at=step.started_at,
            completed_at=step.completed_at,
            failed_at=step.failed_at,
            error_message=step.error_message,
            retry_count=step.retry_count,
            output_data=json.dumps(step.output_data) if step.output_data else None,
        )


@strawberry.type(description="Workflow execution details")
class Workflow:
    """GraphQL type for workflow."""

    workflow_id: str
    workflow_type: WorkflowType
    status: WorkflowStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    steps: list[WorkflowStep] = strawberry.field(default_factory=list)

    # Duration helpers
    @strawberry.field(description="Workflow duration in seconds")
    def duration_seconds(self) -> Optional[float]:
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
        return Workflow(
            workflow_id=workflow.workflow_id,
            workflow_type=WorkflowType(workflow.workflow_type.value),
            status=WorkflowStatus(workflow.status.value),
            started_at=workflow.started_at,
            completed_at=workflow.completed_at,
            failed_at=workflow.failed_at,
            error_message=workflow.error_message,
            retry_count=workflow.retry_count,
            steps=[WorkflowStep.from_model(step) for step in workflow.steps],
        )


@strawberry.type(description="Subscriber provisioning result")
class ProvisionSubscriberResult:
    """GraphQL type for subscriber provisioning result."""

    workflow_id: str
    subscriber_id: str
    customer_id: str
    status: WorkflowStatus

    # Created resources
    radius_username: Optional[str] = None
    ipv4_address: Optional[str] = None
    vlan_id: Optional[int] = None
    onu_id: Optional[str] = None
    cpe_id: Optional[str] = None
    service_id: Optional[str] = None

    # Workflow details
    steps_completed: int
    total_steps: int
    error_message: Optional[str] = None

    created_at: datetime
    completed_at: Optional[datetime] = None

    @strawberry.field(description="Is provisioning successful")
    def is_successful(self) -> bool:
        """Check if provisioning was successful."""
        return self.status == WorkflowStatus.COMPLETED

    @strawberry.field(description="Full workflow details")
    async def workflow(self, info: strawberry.Info) -> Optional[Workflow]:
        """Fetch full workflow details."""
        from dotmac.platform.orchestration.service import OrchestrationService
        from dotmac.platform.tenant.tenant import get_tenant_id

        db = info.context.db
        tenant_id = get_tenant_id(info.context.request)

        service = OrchestrationService(db=db, tenant_id=tenant_id)
        workflow_response = await service.get_workflow(self.workflow_id)

        if not workflow_response:
            return None

        # Convert to GraphQL type
        from dotmac.platform.orchestration.models import Workflow as WorkflowModel

        workflow_model = (
            db.query(WorkflowModel)
            .filter(WorkflowModel.workflow_id == self.workflow_id)
            .first()
        )

        return Workflow.from_model(workflow_model) if workflow_model else None


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
    customer_id: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: str
    secondary_phone: Optional[str] = None

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
    onu_serial: Optional[str] = None
    onu_mac: Optional[str] = None
    cpe_mac: Optional[str] = None

    # Network configuration
    vlan_id: Optional[int] = None
    ipv4_address: Optional[str] = None
    ipv6_prefix: Optional[str] = None

    # Installation
    installation_date: Optional[datetime] = None
    installation_notes: Optional[str] = None

    # Options
    auto_activate: bool = True
    send_welcome_email: bool = True
    create_radius_account: bool = True
    allocate_ip_from_netbox: bool = True
    configure_voltha: bool = True
    configure_genieacs: bool = True

    # Metadata
    notes: Optional[str] = None


@strawberry.input(description="Workflow filter input")
class WorkflowFilterInput:
    """GraphQL input for filtering workflows."""

    workflow_type: Optional[WorkflowType] = None
    status: Optional[WorkflowStatus] = None
    limit: int = 50
    offset: int = 0
