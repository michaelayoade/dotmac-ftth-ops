"""
Job Models

Generic job tracking for async operations (bulk imports, exports, campaigns, etc.).
Enhanced with scheduling and job chain capabilities.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import Base


class JobStatus(str, Enum):
    """Job execution status."""

    PENDING = "pending"
    ASSIGNED = "assigned"  # For field service jobs assigned to technician
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"
    TIMEOUT = "timeout"


class JobType(str, Enum):
    """Job type categories."""

    BULK_IMPORT = "bulk_import"
    BULK_EXPORT = "bulk_export"
    DATA_MIGRATION = "data_migration"
    FIRMWARE_UPGRADE = "firmware_upgrade"
    BATCH_PROVISIONING = "batch_provisioning"
    BATCH_DEPROVISIONING = "batch_deprovisioning"
    REPORT_GENERATION = "report_generation"
    AUDIT_EXPORT = "audit_export"
    CUSTOM = "custom"


class JobPriority(str, Enum):
    """Job priority levels."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class JobExecutionMode(str, Enum):
    """Job chain execution mode."""

    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"


class Job(Base):  # type: ignore[misc]
    """
    Generic job tracking model for async operations.

    Supports any long-running background task with progress tracking,
    error logging, and retry capabilities.
    """

    __tablename__ = "jobs"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    # Multi-tenancy
    tenant_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    # Job metadata
    job_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=JobStatus.PENDING.value,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Progress tracking
    progress_percent: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    items_total: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    items_processed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    items_succeeded: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    items_failed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    current_item: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    error_details: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    error_traceback: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Full traceback for failed jobs",
    )
    failed_items: Mapped[list[Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="List of failed item IDs or references for retry",
    )

    # Job parameters and results
    parameters: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Input parameters for the job",
    )
    result: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Job execution result data",
    )

    # Retry configuration
    max_retries: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Maximum number of retries allowed",
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Current retry count",
    )
    retry_delay_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Delay in seconds before retry",
    )
    next_retry_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Scheduled time for next retry",
    )

    # Priority
    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=JobPriority.NORMAL.value,
    )

    # Timeout
    timeout_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Job execution timeout in seconds",
    )

    # Field Service / Technician Assignment (added by migration 2025_11_08_1700)
    assigned_technician_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        nullable=True,
        comment="Assigned technician for field service jobs",
    )
    scheduled_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Scheduled start time for field service",
    )
    scheduled_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Scheduled end time for field service",
    )
    actual_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Actual start time",
    )
    actual_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Actual end time",
    )

    # Location Information
    location_lat: Mapped[float | None] = mapped_column(
        nullable=True,
        comment="Job site latitude",
    )
    location_lng: Mapped[float | None] = mapped_column(
        nullable=True,
        comment="Job site longitude",
    )
    service_address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Job site service address",
    )

    # Completion Details
    customer_signature: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Base64 encoded customer signature",
    )
    completion_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Notes added upon job completion",
    )
    photos: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Array of photo URLs from job site",
    )

    # Parent job for job chains
    parent_job_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("jobs.id"),
        nullable=True,
    )

    # Scheduled job reference
    scheduled_job_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("scheduled_jobs.id"),
        nullable=True,
    )

    # User tracking
    created_by: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    cancelled_by: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    parent_job: Mapped["Job | None"] = relationship(
        "Job",
        remote_side="Job.id",
        back_populates="child_jobs",
        foreign_keys=[parent_job_id],
    )
    child_jobs: Mapped[list["Job"]] = relationship(
        "Job",
        back_populates="parent_job",
        foreign_keys=[parent_job_id],
    )
    scheduled_job: Mapped["ScheduledJob | None"] = relationship(
        "ScheduledJob",
        back_populates="jobs",
    )

    def __repr__(self) -> str:
        return f"<Job {self.id} [{self.job_type}] {self.status}>"

    @property
    def is_terminal(self) -> bool:
        """Check if job is in a terminal state (completed, failed, or cancelled)."""
        return self.status in [
            JobStatus.COMPLETED.value,
            JobStatus.FAILED.value,
            JobStatus.CANCELLED.value,
        ]

    @property
    def is_active(self) -> bool:
        """Check if job is currently active (pending or running)."""
        return self.status in [JobStatus.PENDING.value, JobStatus.RUNNING.value]

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        if self.items_processed == 0:
            return 0.0
        return (self.items_succeeded / self.items_processed) * 100

    @property
    def failure_rate(self) -> float:
        """Calculate failure rate percentage."""
        if self.items_processed == 0:
            return 0.0
        return (self.items_failed / self.items_processed) * 100

    @property
    def duration_seconds(self) -> int | None:
        """Calculate job duration in seconds."""
        if not self.started_at:
            return None

        def _as_utc(dt: datetime) -> datetime:
            """Normalize datetimes to UTC with timezone info."""
            if dt.tzinfo is None:
                return dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC)

        start_time = _as_utc(self.started_at)
        end_source = self.completed_at or self.cancelled_at or datetime.now(UTC)
        end_time = _as_utc(end_source)
        return int((end_time - start_time).total_seconds())


class ScheduledJob(Base):  # type: ignore[misc]
    """
    Scheduled job configuration.

    Supports both cron-based and interval-based scheduling for recurring jobs.
    """

    __tablename__ = "scheduled_jobs"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    # Multi-tenancy
    tenant_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    # Job metadata
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    job_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    # Scheduling configuration
    cron_expression: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Cron expression for scheduling (e.g., '0 0 * * *')",
    )
    interval_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Interval in seconds for recurring execution",
    )

    # Execution configuration
    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
        index=True,
    )
    max_concurrent_runs: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Maximum number of concurrent job instances",
    )
    timeout_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=JobPriority.NORMAL.value,
    )

    # Retry configuration
    max_retries: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
    )
    retry_delay_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
    )

    # Job parameters (will be passed to each job execution)
    parameters: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Execution tracking
    last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    next_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    total_runs: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    successful_runs: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    failed_runs: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # User tracking
    created_by: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    jobs: Mapped[list["Job"]] = relationship(
        "Job",
        back_populates="scheduled_job",
    )

    # Table constraints
    __table_args__ = (
        Index("ix_scheduled_jobs_tenant_active", "tenant_id", "is_active"),
        Index("ix_scheduled_jobs_next_run", "is_active", "next_run_at"),
        CheckConstraint(
            "(cron_expression IS NOT NULL AND interval_seconds IS NULL) OR "
            "(cron_expression IS NULL AND interval_seconds IS NOT NULL)",
            name="check_schedule_type",
        ),
    )

    def __repr__(self) -> str:
        """String representation."""
        schedule = self.cron_expression or f"{self.interval_seconds}s"
        return f"<ScheduledJob {self.id} [{self.name}] {schedule} active={self.is_active}>"

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        if self.total_runs == 0:
            return 0.0
        return (self.successful_runs / self.total_runs) * 100


class JobChain(Base):  # type: ignore[misc]
    """
    Job chain configuration.

    Defines sequential or parallel execution of multiple jobs with dependency management.
    """

    __tablename__ = "job_chains"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    # Multi-tenancy
    tenant_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    # Chain metadata
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Chain configuration
    execution_mode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=JobExecutionMode.SEQUENTIAL.value,
        comment="Sequential or parallel execution",
    )

    # Chain definition
    # Format: [{"job_type": "task1", "parameters": {...}}, {...}]
    chain_definition: Mapped[list[Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="List of job definitions to execute",
    )

    # Execution configuration
    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
        index=True,
    )
    stop_on_failure: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
        comment="Stop chain execution if a job fails",
    )
    timeout_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Total chain execution timeout",
    )

    # Execution tracking
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=JobStatus.PENDING.value,
        index=True,
    )
    current_step: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Current step index in chain",
    )
    total_steps: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Total number of steps in chain",
    )

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Results
    results: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Aggregated results from all jobs",
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # User tracking
    created_by: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Table constraints
    __table_args__ = (
        Index("ix_job_chains_tenant_status", "tenant_id", "status"),
        Index("ix_job_chains_tenant_active", "tenant_id", "is_active"),
    )

    def __repr__(self) -> str:
        """String representation."""
        return f"<JobChain {self.id} [{self.name}] {self.execution_mode} {self.status} {self.current_step}/{self.total_steps}>"

    @property
    def progress_percent(self) -> float:
        """Calculate chain progress percentage."""
        if self.total_steps == 0:
            return 0.0
        return (self.current_step / self.total_steps) * 100

    @property
    def duration_seconds(self) -> int | None:
        """Calculate chain duration in seconds."""
        if not self.started_at:
            return None

        # Use UTC time consistently (timezone-aware)
        end_time = self.completed_at or datetime.now(UTC)
        return int((end_time - self.started_at).total_seconds())
