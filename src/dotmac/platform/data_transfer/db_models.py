"""
Database models for data transfer jobs.

Provides persistent storage for import/export job tracking, progress monitoring,
and historical job data.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base, TenantMixin, TimestampMixin

from .core import TransferStatus


class TransferJob(Base, TenantMixin, TimestampMixin):  # type: ignore[misc]
    """
    Persistent storage for data transfer jobs.

    Tracks the lifecycle of import/export operations including progress,
    timing, results, and integration with Celery background workers.
    """

    __tablename__ = "data_transfer_jobs"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Job identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    job_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # TransferType enum value

    # Job status
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=TransferStatus.PENDING.value,
        index=True,
    )  # TransferStatus enum value

    # Progress tracking
    total_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Celery integration
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Import-specific fields
    import_source: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # ImportSource enum value
    source_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Export-specific fields
    export_target: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # ExportTarget enum value
    target_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Configuration and results
    config: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )  # Format, batch size, options, etc.
    summary: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )  # Final results, file sizes, etc.

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )  # User ID, additional context

    # Indexes for common queries
    __table_args__ = (
        # Query jobs by tenant and status
        # CREATE INDEX idx_transfer_jobs_tenant_status ON data_transfer_jobs(tenant_id, status);
        {"schema": None},
    )

    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_records == 0:
            return 0.0
        successful = self.processed_records - self.failed_records
        return (successful / self.total_records) * 100.0

    @property
    def is_complete(self) -> bool:
        """Check if job has completed (successfully or not)."""
        return self.status in (TransferStatus.COMPLETED.value, TransferStatus.FAILED.value)

    @property
    def is_running(self) -> bool:
        """Check if job is currently running."""
        return self.status == TransferStatus.RUNNING.value

    @property
    def duration_seconds(self) -> int | None:
        """Calculate job duration in seconds."""
        if not self.started_at:
            return None
        end_time = self.completed_at or datetime.now(UTC)
        return int((end_time - self.started_at).total_seconds())

    def __repr__(self) -> str:
        return (
            f"<TransferJob(id={self.id}, type={self.job_type}, "
            f"status={self.status}, progress={self.progress_percentage}%)>"
        )

    # Note: Use metadata_ (with underscore) to avoid SQLAlchemy conflicts
    # The column is stored as "metadata" in the database but accessed as metadata_ in Python


__all__ = ["TransferJob"]
