"""
Orchestration Service Models

Database models for workflow orchestration and saga pattern implementation.
"""

from enum import Enum

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from ..db import Base, TenantMixin, TimestampMixin


class WorkflowStatus(str, Enum):
    """Workflow execution status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"
    COMPENSATED = "compensated"


class WorkflowStepStatus(str, Enum):
    """Individual workflow step status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    COMPENSATION_FAILED = "compensation_failed"


class WorkflowType(str, Enum):
    """Types of orchestrated workflows."""

    PROVISION_SUBSCRIBER = "provision_subscriber"
    DEPROVISION_SUBSCRIBER = "deprovision_subscriber"
    ACTIVATE_SERVICE = "activate_service"
    SUSPEND_SERVICE = "suspend_service"
    TERMINATE_SERVICE = "terminate_service"
    CHANGE_SERVICE_PLAN = "change_service_plan"
    UPDATE_NETWORK_CONFIG = "update_network_config"
    MIGRATE_SUBSCRIBER = "migrate_subscriber"


class OrchestrationWorkflow(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Workflow orchestration model.

    Represents a distributed transaction across multiple systems using the Saga pattern.
    """

    __tablename__ = "orchestration_workflows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(String(64), unique=True, nullable=False, index=True)
    workflow_type = Column(SQLEnum(WorkflowType), nullable=False, index=True)
    status = Column(
        SQLEnum(WorkflowStatus),
        nullable=False,
        default=WorkflowStatus.PENDING,
        index=True,
    )

    # Workflow metadata (tenant_id provided by TenantMixin)
    initiator_id = Column(String(64), nullable=True)  # User who started the workflow
    initiator_type = Column(String(32), nullable=True)  # 'user', 'system', 'api'

    # Input and output
    input_data = Column(JSON, nullable=False)
    output_data = Column(JSON, nullable=True)

    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)

    # Compensation tracking
    compensation_started_at = Column(DateTime, nullable=True)
    compensation_completed_at = Column(DateTime, nullable=True)
    compensation_error = Column(Text, nullable=True)

    # Context for workflow execution
    context = Column(JSON, nullable=True)  # Stores intermediate data between steps

    # Relationships
    steps = relationship(
        "OrchestrationWorkflowStep",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="OrchestrationWorkflowStep.step_order",
    )

    def __repr__(self) -> str:
        return (
            f"<OrchestrationWorkflow(id={self.id}, workflow_id={self.workflow_id}, "
            f"type={self.workflow_type}, status={self.status})>"
        )


class OrchestrationWorkflowStep(Base, TimestampMixin):  # type: ignore[misc]
    """
    Individual step within a workflow.

    Each step represents an operation in a specific system (RADIUS, VOLTHA, etc.)
    with its own compensation logic for rollback.
    """

    __tablename__ = "orchestration_workflow_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(
        Integer,
        ForeignKey("orchestration_workflows.id"),
        nullable=False,
        index=True,
    )
    step_id = Column(String(64), nullable=False, index=True)
    step_order = Column(Integer, nullable=False)

    # Step identification
    step_name = Column(String(128), nullable=False)
    step_type = Column(String(64), nullable=False)  # 'database', 'api', 'external'
    target_system = Column(String(64), nullable=False)  # 'radius', 'voltha', 'netbox', etc.

    # Status
    status = Column(
        SQLEnum(WorkflowStepStatus),
        nullable=False,
        default=WorkflowStepStatus.PENDING,
        index=True,
    )

    # Input and output
    input_data = Column(JSON, nullable=False)
    output_data = Column(JSON, nullable=True)

    # Compensation data
    compensation_data = Column(JSON, nullable=True)  # Data needed for rollback
    compensation_handler = Column(String(128), nullable=True)  # Handler function name

    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    compensation_started_at = Column(DateTime, nullable=True)
    compensation_completed_at = Column(DateTime, nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)

    # Idempotency
    idempotency_key = Column(String(128), nullable=True, unique=True)

    # Relationships
    workflow = relationship("OrchestrationWorkflow", back_populates="steps")

    def __repr__(self) -> str:
        return (
            f"<OrchestrationWorkflowStep(id={self.id}, step_id={self.step_id}, "
            f"name={self.step_name}, status={self.status})>"
        )


# Add index for common queries
Index(
    "idx_orchestration_workflow_tenant_status",
    OrchestrationWorkflow.tenant_id,
    OrchestrationWorkflow.status,
)

Index(
    "idx_orchestration_workflow_type_status",
    OrchestrationWorkflow.workflow_type,
    OrchestrationWorkflow.status,
)

Index(
    "idx_orchestration_workflow_step_order",
    OrchestrationWorkflowStep.workflow_id,
    OrchestrationWorkflowStep.step_order,
)

# Backwards compatibility aliases (to be removed in a future major release)
Workflow = OrchestrationWorkflow
WorkflowStep = OrchestrationWorkflowStep
