"""Orchestration Service Models

Database models for workflow orchestration and saga pattern implementation.
"""

# mypy: disable-error-code="misc"

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base as BaseRuntime
from ..db import TenantMixin, TimestampMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base
else:
    Base = BaseRuntime


class WorkflowStatus(str, Enum):
    """Workflow execution status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIALLY_COMPLETED = "partially_completed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"
    ROLLBACK_FAILED = "rollback_failed"
    TIMEOUT = "timeout"
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


class OrchestrationWorkflow(Base, TimestampMixin, TenantMixin):
    """
    Workflow orchestration model.

    Represents a distributed transaction across multiple systems using the Saga pattern.
    """

    __tablename__ = "orchestration_workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    workflow_type: Mapped[WorkflowType] = mapped_column(
        SQLEnum(WorkflowType), nullable=False, index=True
    )
    status: Mapped[WorkflowStatus] = mapped_column(
        SQLEnum(WorkflowStatus),
        nullable=False,
        default=WorkflowStatus.PENDING,
        index=True,
    )

    # Workflow metadata (tenant_id provided by TenantMixin)
    initiator_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )  # User who started the workflow
    initiator_type: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )  # 'user', 'system', 'api'

    # Input and output
    input_data: Mapped[dict[str, Any] | list[Any]] = mapped_column(JSON, nullable=False)
    output_data: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_details: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Compensation tracking
    compensation_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    compensation_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    compensation_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Context for workflow execution
    context: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(
        JSON, nullable=True
    )  # Stores intermediate data between steps

    # Relationships
    steps: Mapped[list[OrchestrationWorkflowStep]] = relationship(
        "OrchestrationWorkflowStep",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="OrchestrationWorkflowStep.sequence_number",
    )

    def __repr__(self) -> str:
        return (
            f"<OrchestrationWorkflow(id={self.id}, workflow_id={self.workflow_id}, "
            f"type={self.workflow_type}, status={self.status})>"
        )


class OrchestrationWorkflowStep(Base, TimestampMixin, TenantMixin):
    """
    Individual step within a workflow.

    Each step represents an operation in a specific system (RADIUS, VOLTHA, etc.)
    with its own compensation logic for rollback.
    """

    __tablename__ = "orchestration_workflow_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("orchestration_workflows.id"),
        nullable=False,
        index=True,
    )
    step_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Step identification
    step_name: Mapped[str] = mapped_column(String(128), nullable=False)
    step_type: Mapped[str] = mapped_column(
        String(64), nullable=False
    )  # 'database', 'api', 'external'
    target_system: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )  # 'radius', 'voltha', 'netbox', etc.

    # Status
    status: Mapped[WorkflowStepStatus] = mapped_column(
        SQLEnum(WorkflowStepStatus),
        nullable=False,
        default=WorkflowStepStatus.PENDING,
        index=True,
    )

    # Input and output
    input_data: Mapped[dict[str, Any] | list[Any]] = mapped_column(JSON, nullable=False)
    output_data: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)

    # Compensation data
    compensation_data: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(
        JSON, nullable=True
    )  # Data needed for rollback
    compensation_handler: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )  # Handler function name

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    compensation_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    compensation_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_details: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Idempotency
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)

    # Relationships
    workflow: Mapped[OrchestrationWorkflow] = relationship(
        "OrchestrationWorkflow", back_populates="steps"
    )

    @property
    def step_order(self) -> int:
        """Backward-compatible accessor for step ordering."""
        return self.sequence_number

    @step_order.setter
    def step_order(self, value: int) -> None:
        self.sequence_number = value

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
    OrchestrationWorkflowStep.sequence_number,
)

# Backwards compatibility aliases (to be removed in a future major release)
Workflow = OrchestrationWorkflow
WorkflowStep = OrchestrationWorkflowStep
