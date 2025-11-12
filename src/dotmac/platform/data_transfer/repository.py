"""
Database repository for data transfer jobs.

Provides CRUD operations and queries for persistent job tracking.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .core import TransferStatus
from .db_models import TransferJob
from .models import TransferType

logger = structlog.get_logger(__name__)


class TransferJobRepository:
    """Repository for data transfer job database operations."""

    def __init__(self, db: AsyncSession):
        """Initialize repository with database session."""
        self.db = db

    async def create_job(
        self,
        job_id: UUID,
        name: str,
        job_type: TransferType,
        tenant_id: str,
        config: dict[str, Any],
        metadata: dict[str, Any] | None = None,
        import_source: str | None = None,
        source_path: str | None = None,
        export_target: str | None = None,
        target_path: str | None = None,
    ) -> TransferJob:
        """
        Create a new transfer job record.

        Args:
            job_id: Unique job identifier
            name: Human-readable job name
            job_type: Import or export
            tenant_id: Tenant context
            config: Job configuration (format, batch size, etc.)
            metadata: Additional metadata (user_id, etc.)
            import_source: Source type for imports
            source_path: Source path for imports
            export_target: Target type for exports
            target_path: Target path for exports

        Returns:
            Created TransferJob instance
        """
        job = TransferJob(
            id=job_id,
            name=name,
            job_type=job_type.value,
            status=TransferStatus.PENDING.value,
            tenant_id=tenant_id,
            config=config,
            metadata_=metadata or {},
            import_source=import_source,
            source_path=source_path,
            export_target=export_target,
            target_path=target_path,
            total_records=0,
            processed_records=0,
            failed_records=0,
            progress_percentage=0.0,
        )

        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)

        logger.info(
            "transfer_job.created",
            job_id=str(job_id),
            job_type=job_type.value,
            tenant_id=tenant_id,
        )

        return job

    async def get_job(self, job_id: UUID, tenant_id: str) -> TransferJob | None:
        """
        Get a job by ID.

        Args:
            job_id: Job identifier
            tenant_id: Tenant context (for access control)

        Returns:
            TransferJob instance or None if not found
        """
        result = await self.db.execute(
            select(TransferJob).where(
                TransferJob.id == job_id,
                TransferJob.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_job_status(
        self,
        job_id: UUID,
        status: TransferStatus,
        **kwargs: Any,
    ) -> None:
        """
        Update job status and additional fields.

        Args:
            job_id: Job identifier
            status: New status
            **kwargs: Additional fields to update (progress_percentage, error_message, etc.)
        """
        update_data = {"status": status.value, "updated_at": datetime.now(UTC)}

        # Add optional fields if provided
        if "progress_percentage" in kwargs:
            update_data["progress_percentage"] = kwargs["progress_percentage"]
        if "processed_records" in kwargs:
            update_data["processed_records"] = kwargs["processed_records"]
        if "failed_records" in kwargs:
            update_data["failed_records"] = kwargs["failed_records"]
        if "total_records" in kwargs:
            update_data["total_records"] = kwargs["total_records"]
        if "error_message" in kwargs:
            update_data["error_message"] = kwargs["error_message"]
        if "celery_task_id" in kwargs:
            update_data["celery_task_id"] = kwargs["celery_task_id"]
        if "started_at" in kwargs:
            update_data["started_at"] = kwargs["started_at"]
        if "completed_at" in kwargs:
            update_data["completed_at"] = kwargs["completed_at"]
        if "summary" in kwargs:
            update_data["summary"] = kwargs["summary"]

        await self.db.execute(
            update(TransferJob).where(TransferJob.id == job_id).values(**update_data)
        )
        await self.db.commit()

        logger.debug(
            "transfer_job.status_updated",
            job_id=str(job_id),
            status=status.value,
            fields=list(kwargs.keys()),
        )

    async def list_jobs(
        self,
        tenant_id: str,
        job_type: TransferType | None = None,
        status: TransferStatus | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[TransferJob]:
        """
        List jobs with filtering.

        Args:
            tenant_id: Tenant context
            job_type: Filter by job type (optional)
            status: Filter by status (optional)
            limit: Max results
            offset: Pagination offset

        Returns:
            List of TransferJob instances
        """
        query = select(TransferJob).where(TransferJob.tenant_id == tenant_id)

        if job_type:
            query = query.where(TransferJob.job_type == job_type.value)
        if status:
            query = query.where(TransferJob.status == status.value)

        query = query.order_by(TransferJob.created_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_jobs(
        self,
        tenant_id: str,
        job_type: TransferType | None = None,
        status: TransferStatus | None = None,
    ) -> int:
        """
        Count jobs matching filters.

        Args:
            tenant_id: Tenant context
            job_type: Filter by job type (optional)
            status: Filter by status (optional)

        Returns:
            Count of matching jobs
        """
        from sqlalchemy import func

        query = select(func.count(TransferJob.id)).where(TransferJob.tenant_id == tenant_id)

        if job_type:
            query = query.where(TransferJob.job_type == job_type.value)
        if status:
            query = query.where(TransferJob.status == status.value)

        result = await self.db.execute(query)
        return result.scalar_one()

    async def cancel_job(self, job_id: UUID, tenant_id: str) -> bool:
        """
        Cancel a job if it's still pending or running.

        Args:
            job_id: Job identifier
            tenant_id: Tenant context

        Returns:
            True if job was cancelled, False if not found or already completed
        """
        job = await self.get_job(job_id, tenant_id)

        if not job:
            return False

        # Can only cancel pending or running jobs
        if job.status not in (TransferStatus.PENDING.value, TransferStatus.RUNNING.value):
            logger.warning(
                "transfer_job.cancel_failed",
                job_id=str(job_id),
                status=job.status,
                reason="Job is not in a cancellable state",
            )
            return False

        await self.update_job_status(
            job_id,
            TransferStatus.CANCELLED,
            completed_at=datetime.now(UTC),
            error_message="Job cancelled by user",
        )

        logger.info(
            "transfer_job.cancelled",
            job_id=str(job_id),
            tenant_id=tenant_id,
        )

        return True

    async def get_job_by_celery_task_id(self, celery_task_id: str) -> TransferJob | None:
        """
        Get a job by its Celery task ID.

        Useful for background workers to update job status.

        Args:
            celery_task_id: Celery task identifier

        Returns:
            TransferJob instance or None if not found
        """
        result = await self.db.execute(
            select(TransferJob).where(TransferJob.celery_task_id == celery_task_id)
        )
        return result.scalar_one_or_none()


__all__ = ["TransferJobRepository"]
