"""Workflow Models

Data models for workflow orchestration and execution tracking.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base as BaseRuntime
from ..db import TimestampMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base
else:
    Base = BaseRuntime


class WorkflowStatus(str, enum.Enum):
    """Workflow execution status"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(str, enum.Enum):
    """Workflow step execution status"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class Workflow(Base, TimestampMixin):
    """
    Workflow Template Definition

    Defines reusable workflow templates with step-by-step execution logic.
    """

    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    definition: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    tags: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)

    # Relationships
    executions: Mapped[list[WorkflowExecution]] = relationship(
        "WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Workflow {self.name} v{self.version}>"


class WorkflowExecution(Base, TimestampMixin):
    """
    Workflow Execution Instance

    Tracks the execution of a workflow with its context and results.
    """

    __tablename__ = "workflow_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workflows.id"), nullable=False, index=True
    )
    status: Mapped[WorkflowStatus] = mapped_column(
        Enum(WorkflowStatus), default=WorkflowStatus.PENDING, nullable=False, index=True
    )
    context: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    result: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Trigger information
    trigger_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "manual", "event", "scheduled", "api"
    trigger_source: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # Event name, user ID, or API endpoint
    tenant_id: Mapped[str | None] = mapped_column(String(255), ForeignKey("tenants.id"), index=True)

    # Relationships
    workflow: Mapped[Workflow] = relationship("Workflow", back_populates="executions")
    steps: Mapped[list[WorkflowStep]] = relationship(
        "WorkflowStep", back_populates="execution", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<WorkflowExecution {self.id} status={self.status.value}>"


class WorkflowStep(Base, TimestampMixin):
    """
    Workflow Step Execution

    Tracks the execution of individual steps within a workflow.
    """

    __tablename__ = "workflow_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    execution_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workflow_executions.id"), nullable=False, index=True
    )
    step_name: Mapped[str] = mapped_column(String(255), nullable=False)
    step_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "service_call", "condition", "transform", "wait"
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[StepStatus] = mapped_column(
        Enum(StepStatus), default=StepStatus.PENDING, nullable=False, index=True
    )
    input_data: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    output_data: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_details: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    execution: Mapped[WorkflowExecution] = relationship("WorkflowExecution", back_populates="steps")

    def __repr__(self) -> str:
        return f"<WorkflowStep {self.step_name} status={self.status.value}>"
