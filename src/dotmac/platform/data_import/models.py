"""
Database models for data import tracking.

Stores import job metadata, status, and failure records.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import Base, TenantMixin, TimestampMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as BaseModel
else:
    BaseModel = Base


class ImportJobType(str, Enum):
    """Type of data being imported."""

    CUSTOMERS = "customers"
    INVOICES = "invoices"
    SUBSCRIPTIONS = "subscriptions"
    PAYMENTS = "payments"
    PRODUCTS = "products"
    MIXED = "mixed"  # Multi-type import


class ImportJobStatus(str, Enum):
    """Status of an import job."""

    PENDING = "pending"
    VALIDATING = "validating"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIALLY_COMPLETED = "partially_completed"
    CANCELLED = "cancelled"


class ImportJob(BaseModel, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Track import jobs and their progress."""

    __tablename__ = "data_import_jobs"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Job details
    job_type: Mapped[ImportJobType] = mapped_column(
        SQLEnum(ImportJobType),
        nullable=False,
        index=True,
    )

    status: Mapped[ImportJobStatus] = mapped_column(
        SQLEnum(ImportJobStatus),
        default=ImportJobStatus.PENDING,
        nullable=False,
        index=True,
    )

    # File information
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_format: Mapped[str] = mapped_column(String(20), nullable=False)  # csv, json, xlsx

    # Progress tracking
    total_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    successful_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # User who initiated the import
    initiated_by: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Configuration and options
    config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Import configuration options",
    )

    # Summary and statistics
    summary: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Import summary and statistics",
    )

    # Error details if failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Celery task ID if using background processing
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    failures = relationship("ImportFailure", back_populates="job", lazy="dynamic")

    # Indexes
    __table_args__ = (
        Index("ix_import_jobs_tenant_status", "tenant_id", "status"),
        Index("ix_import_jobs_tenant_type", "tenant_id", "job_type"),
        Index("ix_import_jobs_created", "created_at"),
    )

    @property
    def progress_percentage(self) -> float:
        """Calculate progress percentage."""
        if self.total_records == 0:
            return 0.0
        return (self.processed_records / self.total_records) * 100

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        if self.processed_records == 0:
            return 0.0
        return (self.successful_records / self.processed_records) * 100

    @property
    def duration_seconds(self) -> float | None:
        """Calculate job duration in seconds."""
        if not self.started_at:
            return None
        end_time = self.completed_at or datetime.now(UTC)
        return (end_time - self.started_at).total_seconds()


class ImportFailure(BaseModel, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Track individual import failures for debugging and reprocessing."""

    __tablename__ = "data_import_failures"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Link to import job
    job_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("data_import_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Failure details
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    error_type: Mapped[str] = mapped_column(String(50), nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)

    # Original data that failed
    row_data: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Original row data that failed to import",
    )

    # Field-level errors if available
    field_errors: Mapped[dict[str, str]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Field-specific error messages",
    )

    # Retry information
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    can_retry: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    job = relationship("ImportJob", back_populates="failures")

    # Indexes
    __table_args__ = (
        Index("ix_import_failures_job_resolved", "job_id", "resolved"),
        Index("ix_import_failures_error_type", "error_type"),
    )
