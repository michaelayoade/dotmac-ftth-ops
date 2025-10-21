"""
Workflow Models

Data models for workflow orchestration and execution tracking.
"""

import enum

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..db import Base, TimestampMixin


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

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)
    definition = Column(JSON, nullable=False)  # Workflow steps and configuration
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(String(20), default="1.0.0")
    tags = Column(JSON)

    # Relationships
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Workflow {self.name} v{self.version}>"


class WorkflowExecution(Base, TimestampMixin):
    """
    Workflow Execution Instance

    Tracks the execution of a workflow with its context and results.
    """

    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.PENDING, nullable=False, index=True)
    context = Column(JSON)  # Input data
    result = Column(JSON)  # Output data
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Trigger information
    trigger_type = Column(String(50))  # "manual", "event", "scheduled", "api"
    trigger_source = Column(String(255))  # Event name, user ID, or API endpoint
    tenant_id = Column(String(255), ForeignKey("tenants.id"), index=True)

    # Relationships
    workflow = relationship("Workflow", back_populates="executions")
    steps = relationship("WorkflowStep", back_populates="execution", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<WorkflowExecution {self.id} status={self.status.value}>"


class WorkflowStep(Base, TimestampMixin):
    """
    Workflow Step Execution

    Tracks the execution of individual steps within a workflow.
    """

    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True)
    execution_id = Column(Integer, ForeignKey("workflow_executions.id"), nullable=False, index=True)
    step_name = Column(String(255), nullable=False)
    step_type = Column(String(50), nullable=False)  # "service_call", "condition", "transform", "wait"
    sequence_number = Column(Integer, nullable=False)
    status = Column(Enum(StepStatus), default=StepStatus.PENDING, nullable=False, index=True)
    input_data = Column(JSON)
    output_data = Column(JSON)
    error_message = Column(Text)
    error_details = Column(JSON)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)

    # Relationships
    execution = relationship("WorkflowExecution", back_populates="steps")

    def __repr__(self) -> str:
        return f"<WorkflowStep {self.step_name} status={self.status.value}>"
