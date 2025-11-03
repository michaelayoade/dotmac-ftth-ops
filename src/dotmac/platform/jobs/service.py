"""
Job Service

Business logic for managing async jobs.
"""

from datetime import UTC, datetime
from uuid import uuid4

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.jobs.models import Job, JobStatus
from dotmac.platform.jobs.schemas import (
    JobCreate,
    JobListResponse,
    JobStatistics,
    JobSummary,
    JobUpdate,
)
from dotmac.platform.realtime import publish_job_update
from dotmac.platform.redis_client import RedisClientType

logger = structlog.get_logger(__name__)


class JobService:
    """Service for managing async jobs."""

    def __init__(self, session: AsyncSession, redis_client: RedisClientType | None = None):
        self.session = session
        self.redis = redis_client

    async def create_job(
        self,
        tenant_id: str,
        created_by: str,
        job_data: JobCreate,
    ) -> Job:
        """
        Create a new job.

        Args:
            tenant_id: Tenant ID
            created_by: User ID who created the job
            job_data: Job creation data

        Returns:
            Created job
        """
        job = Job(
            id=str(uuid4()),
            tenant_id=tenant_id,
            job_type=job_data.job_type,
            status=JobStatus.PENDING.value,
            title=job_data.title,
            description=job_data.description,
            items_total=job_data.items_total,
            parameters=job_data.parameters,
            created_by=created_by,
        )

        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)

        logger.info(
            "job.created",
            job_id=job.id,
            job_type=job.job_type,
            tenant_id=tenant_id,
            created_by=created_by,
        )

        # Publish job created event
        if self.redis:
            await publish_job_update(
                self.redis,
                tenant_id=tenant_id,
                job_id=job.id,
                job_type=job.job_type,
                status=job.status,
                progress_percent=0,
            )

        return job

    async def get_job(self, job_id: str, tenant_id: str) -> Job | None:
        """
        Get job by ID.

        Args:
            job_id: Job ID
            tenant_id: Tenant ID

        Returns:
            Job or None if not found
        """
        stmt = select(Job).where(Job.id == job_id, Job.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_jobs(
        self,
        tenant_id: str,
        job_type: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> JobListResponse:
        """
        List jobs with optional filtering and pagination.

        Args:
            tenant_id: Tenant ID
            job_type: Optional job type filter
            status: Optional status filter
            page: Page number (1-indexed)
            page_size: Items per page

        Returns:
            Paginated list of jobs
        """
        # Build query
        stmt = select(Job).where(Job.tenant_id == tenant_id)

        if job_type:
            stmt = stmt.where(Job.job_type == job_type)
        if status:
            stmt = stmt.where(Job.status == status)

        # Order by created_at descending
        stmt = stmt.order_by(Job.created_at.desc())

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await self.session.scalar(count_stmt) or 0

        # Apply pagination
        offset = (page - 1) * page_size
        stmt = stmt.limit(page_size).offset(offset)

        # Execute query
        result = await self.session.execute(stmt)
        jobs = result.scalars().all()

        return JobListResponse(
            jobs=[JobSummary.model_validate(job) for job in jobs],
            total=total,
            page=page,
            page_size=page_size,
            has_more=offset + len(jobs) < total,
        )

    async def update_progress(
        self,
        job_id: str,
        tenant_id: str,
        update_data: JobUpdate,
    ) -> Job | None:
        """
        Update job progress.

        Args:
            job_id: Job ID
            tenant_id: Tenant ID
            update_data: Progress update data

        Returns:
            Updated job or None if not found
        """
        job = await self.get_job(job_id, tenant_id)
        if not job:
            return None

        # Update fields
        if update_data.status is not None:
            old_status = job.status
            job.status = update_data.status

            # Update timestamps based on status changes
            if update_data.status == JobStatus.RUNNING.value and not job.started_at:
                job.started_at = datetime.now(UTC)
            elif update_data.status in [JobStatus.COMPLETED.value, JobStatus.FAILED.value]:
                job.completed_at = datetime.now(UTC)

            logger.info(
                "job.status_changed",
                job_id=job_id,
                old_status=old_status,
                new_status=job.status,
            )

        if update_data.progress_percent is not None:
            job.progress_percent = update_data.progress_percent
        if update_data.items_processed is not None:
            job.items_processed = update_data.items_processed
        if update_data.items_succeeded is not None:
            job.items_succeeded = update_data.items_succeeded
        if update_data.items_failed is not None:
            job.items_failed = update_data.items_failed
        if update_data.current_item is not None:
            job.current_item = update_data.current_item
        if update_data.error_message is not None:
            job.error_message = update_data.error_message
        if update_data.error_details is not None:
            job.error_details = update_data.error_details
        if update_data.error_traceback is not None:
            job.error_traceback = update_data.error_traceback
        if update_data.result is not None:
            job.result = update_data.result

        await self.session.commit()
        await self.session.refresh(job)

        # Publish progress update
        if self.redis:
            await publish_job_update(
                self.redis,
                tenant_id=tenant_id,
                job_id=job.id,
                job_type=job.job_type,
                status=job.status,
                progress_percent=job.progress_percent,
                items_total=job.items_total,
                items_processed=job.items_processed,
                items_succeeded=job.items_succeeded,
                items_failed=job.items_failed,
                current_item=job.current_item,
                error_message=job.error_message,
            )

        return job

    async def cancel_job(
        self,
        job_id: str,
        tenant_id: str,
        cancelled_by: str,
    ) -> Job | None:
        """
        Cancel a running or pending job.

        Args:
            job_id: Job ID
            tenant_id: Tenant ID
            cancelled_by: User ID who cancelled the job

        Returns:
            Cancelled job or None if not found or already terminal
        """
        job = await self.get_job(job_id, tenant_id)
        if not job:
            return None

        if job.is_terminal:
            logger.warning(
                "job.cancel_failed.already_terminal",
                job_id=job_id,
                status=job.status,
            )
            return None

        job.status = JobStatus.CANCELLED.value
        job.cancelled_by = cancelled_by
        job.cancelled_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(job)

        logger.info(
            "job.cancelled",
            job_id=job_id,
            cancelled_by=cancelled_by,
        )

        # Publish cancellation event
        if self.redis:
            await publish_job_update(
                self.redis,
                tenant_id=tenant_id,
                job_id=job.id,
                job_type=job.job_type,
                status=job.status,
                progress_percent=job.progress_percent,
            )

        return job

    async def retry_failed_items(
        self,
        job_id: str,
        tenant_id: str,
        created_by: str,
    ) -> Job | None:
        """
        Create a new job to retry failed items from a previous job.

        Args:
            job_id: Original job ID
            tenant_id: Tenant ID
            created_by: User ID who requested retry

        Returns:
            New retry job or None if original job not found or has no failed items
        """
        original_job = await self.get_job(job_id, tenant_id)
        if not original_job:
            return None

        if not original_job.is_terminal:
            logger.warning(
                "job.retry_failed.not_terminal",
                job_id=job_id,
                status=original_job.status,
            )
            return None

        if not original_job.failed_items or len(original_job.failed_items) == 0:
            logger.warning(
                "job.retry_failed.no_failed_items",
                job_id=job_id,
            )
            return None

        # Create new job for retry
        base_params = original_job.parameters if original_job.parameters else {}
        retry_job = Job(
            id=str(uuid4()),
            tenant_id=tenant_id,
            job_type=original_job.job_type,
            status=JobStatus.PENDING.value,
            title=f"Retry: {original_job.title}",
            description=f"Retry of job {job_id} - processing {len(original_job.failed_items)} failed items",
            items_total=len(original_job.failed_items),
            parameters={
                **base_params,
                "retry_of": job_id,
                "failed_items": original_job.failed_items,
            },
            created_by=created_by,
        )

        self.session.add(retry_job)
        await self.session.commit()
        await self.session.refresh(retry_job)

        logger.info(
            "job.retry_created",
            original_job_id=job_id,
            retry_job_id=retry_job.id,
            failed_items_count=len(original_job.failed_items),
        )

        return retry_job

    async def get_statistics(self, tenant_id: str) -> JobStatistics:
        """
        Get job statistics for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Job statistics
        """
        # Count by status
        status_counts_stmt = (
            select(Job.status, func.count(Job.id))
            .where(Job.tenant_id == tenant_id)
            .group_by(Job.status)
        )
        result = await self.session.execute(status_counts_stmt)
        status_rows = result.all()
        status_counts: dict[str, int] = {status: int(count) for status, count in status_rows}

        total_jobs = sum(status_counts.values())
        pending = status_counts.get(JobStatus.PENDING.value, 0)
        running = status_counts.get(JobStatus.RUNNING.value, 0)
        completed = status_counts.get(JobStatus.COMPLETED.value, 0)
        failed = status_counts.get(JobStatus.FAILED.value, 0)
        cancelled = status_counts.get(JobStatus.CANCELLED.value, 0)

        # Calculate average duration for completed jobs
        avg_duration_stmt = select(
            func.avg(
                func.extract(
                    "epoch",
                    Job.completed_at - Job.started_at,
                )
            )
        ).where(
            Job.tenant_id == tenant_id,
            Job.status == JobStatus.COMPLETED.value,
            Job.started_at.isnot(None),
            Job.completed_at.isnot(None),
        )
        avg_duration = await self.session.scalar(avg_duration_stmt)

        # Sum items processed
        items_stmt = select(
            func.sum(Job.items_processed),
            func.sum(Job.items_succeeded),
            func.sum(Job.items_failed),
        ).where(Job.tenant_id == tenant_id)
        result = await self.session.execute(items_stmt)
        items_row = result.one()
        total_processed = items_row[0] or 0
        total_succeeded = items_row[1] or 0
        total_failed = items_row[2] or 0

        success_rate = (total_succeeded / total_processed * 100) if total_processed > 0 else 0.0

        return JobStatistics(
            total_jobs=total_jobs,
            pending_jobs=pending,
            running_jobs=running,
            completed_jobs=completed,
            failed_jobs=failed,
            cancelled_jobs=cancelled,
            avg_duration_seconds=float(avg_duration) if avg_duration else None,
            total_items_processed=total_processed,
            total_items_succeeded=total_succeeded,
            total_items_failed=total_failed,
            overall_success_rate=round(success_rate, 2),
        )
