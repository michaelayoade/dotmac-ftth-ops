"""
Job Scheduler Service.

Service for managing scheduled jobs, job chains, and retry logic.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import uuid4

import structlog
from croniter import croniter  # type: ignore[import-untyped]
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.jobs.models import (
    Job,
    JobChain,
    JobExecutionMode,
    JobPriority,
    JobStatus,
    ScheduledJob,
)
from dotmac.platform.redis_client import RedisClientType

logger = structlog.get_logger(__name__)


class SchedulerService:
    """Service for scheduled jobs and job chains."""

    def __init__(self, session: AsyncSession, redis_client: RedisClientType | None = None):
        self.session = session
        self.redis = redis_client

    # ========== Scheduled Job Management ==========

    async def create_scheduled_job(
        self,
        tenant_id: str,
        created_by: str,
        name: str,
        job_type: str,
        cron_expression: str | None = None,
        interval_seconds: int | None = None,
        description: str | None = None,
        parameters: dict[str, Any] | None = None,
        priority: JobPriority = JobPriority.NORMAL,
        max_retries: int = 3,
        retry_delay_seconds: int = 60,
        max_concurrent_runs: int = 1,
        timeout_seconds: int | None = None,
    ) -> ScheduledJob:
        """
        Create a new scheduled job.

        Args:
            tenant_id: Tenant ID
            created_by: User ID who created the schedule
            name: Scheduled job name
            job_type: Type of job to execute
            cron_expression: Cron expression (e.g., '0 0 * * *')
            interval_seconds: Interval in seconds
            description: Job description
            parameters: Parameters to pass to job
            priority: Job priority
            max_retries: Maximum retries per execution
            retry_delay_seconds: Delay between retries
            max_concurrent_runs: Max concurrent executions
            timeout_seconds: Job timeout

        Returns:
            Created scheduled job
        """
        if not cron_expression and not interval_seconds:
            raise ValueError("Either cron_expression or interval_seconds must be provided")

        if cron_expression and interval_seconds:
            raise ValueError("Cannot specify both cron_expression and interval_seconds")

        # Calculate next run time
        next_run_at = self._calculate_next_run(cron_expression, interval_seconds)

        scheduled_job = ScheduledJob(
            id=str(uuid4()),
            tenant_id=tenant_id,
            name=name,
            description=description,
            job_type=job_type,
            cron_expression=cron_expression,
            interval_seconds=interval_seconds,
            is_active=True,
            max_concurrent_runs=max_concurrent_runs,
            timeout_seconds=timeout_seconds,
            priority=priority.value,
            max_retries=max_retries,
            retry_delay_seconds=retry_delay_seconds,
            parameters=parameters,
            next_run_at=next_run_at,
            created_by=created_by,
        )

        self.session.add(scheduled_job)
        await self.session.commit()
        await self.session.refresh(scheduled_job)

        logger.info(
            "scheduled_job.created",
            scheduled_job_id=scheduled_job.id,
            name=name,
            cron=cron_expression,
            interval=interval_seconds,
            next_run=next_run_at,
        )

        return scheduled_job

    async def get_scheduled_job(self, scheduled_job_id: str, tenant_id: str) -> ScheduledJob | None:
        """Get scheduled job by ID."""
        stmt = select(ScheduledJob).where(
            ScheduledJob.id == scheduled_job_id, ScheduledJob.tenant_id == tenant_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_scheduled_jobs(
        self,
        tenant_id: str,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[ScheduledJob], int]:
        """
        List scheduled jobs with filtering.

        Args:
            tenant_id: Tenant ID
            is_active: Filter by active status
            page: Page number
            page_size: Items per page

        Returns:
            Tuple of (scheduled_jobs, total_count)
        """
        stmt = select(ScheduledJob).where(ScheduledJob.tenant_id == tenant_id)

        if is_active is not None:
            stmt = stmt.where(ScheduledJob.is_active == is_active)

        stmt = stmt.order_by(ScheduledJob.next_run_at.asc())

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await self.session.scalar(count_stmt) or 0

        # Apply pagination
        offset = (page - 1) * page_size
        stmt = stmt.limit(page_size).offset(offset)

        result = await self.session.execute(stmt)
        scheduled_jobs = list(result.scalars().all())

        return scheduled_jobs, total

    async def update_scheduled_job(
        self,
        scheduled_job_id: str,
        tenant_id: str,
        **updates: Any,
    ) -> ScheduledJob | None:
        """Update scheduled job configuration."""
        scheduled_job = await self.get_scheduled_job(scheduled_job_id, tenant_id)
        if not scheduled_job:
            return None

        # Update allowed fields
        allowed_fields = {
            "name",
            "description",
            "cron_expression",
            "interval_seconds",
            "is_active",
            "max_concurrent_runs",
            "timeout_seconds",
            "priority",
            "max_retries",
            "retry_delay_seconds",
            "parameters",
        }

        schedule_fields = {"cron_expression", "interval_seconds"}
        cron_specified = "cron_expression" in updates
        interval_specified = "interval_seconds" in updates

        new_cron = scheduled_job.cron_expression
        new_interval = scheduled_job.interval_seconds

        if cron_specified:
            new_cron = updates["cron_expression"]
        if interval_specified:
            new_interval = updates["interval_seconds"]

        # When setting one schedule type, clear the other to avoid conflicts
        if cron_specified and updates.get("cron_expression") is not None:
            if interval_specified and updates.get("interval_seconds"):
                raise ValueError("Cannot set both cron_expression and interval_seconds")
            new_interval = None

        if interval_specified:
            interval_value = updates["interval_seconds"]
            if interval_value is not None and interval_value <= 0:
                raise ValueError("interval_seconds must be a positive integer")
            if interval_value is not None and cron_specified and updates.get("cron_expression"):
                raise ValueError("Cannot set both cron_expression and interval_seconds")
            if interval_value is not None:
                new_cron = None

        if new_cron is None and new_interval is None:
            raise ValueError("Scheduled job must define either cron_expression or interval_seconds")
        if new_cron is not None and new_interval is not None:
            raise ValueError("Scheduled job cannot have both cron_expression and interval_seconds")

        # Apply non-schedule fields
        other_fields = allowed_fields - schedule_fields
        for field in other_fields:
            if field in updates:
                value = updates[field]
                if field == "priority" and value is not None:
                    priority_value = value.value if isinstance(value, JobPriority) else value
                    setattr(scheduled_job, field, priority_value)
                else:
                    setattr(scheduled_job, field, value)

        # Recalculate next run if schedule changed (validate before mutating)
        next_run: datetime | None
        if cron_specified or interval_specified:
            next_run = self._calculate_next_run(new_cron, new_interval)
        else:
            next_run = scheduled_job.next_run_at

        # Apply schedule fields after validation
        scheduled_job.cron_expression = new_cron
        scheduled_job.interval_seconds = new_interval
        scheduled_job.next_run_at = next_run

        scheduled_job.updated_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(scheduled_job)

        logger.info(
            "scheduled_job.updated",
            scheduled_job_id=scheduled_job_id,
            updates=list(updates.keys()),
        )

        return scheduled_job

    async def toggle_scheduled_job(
        self, scheduled_job_id: str, tenant_id: str, is_active: bool
    ) -> ScheduledJob | None:
        """Toggle scheduled job active status."""
        return await self.update_scheduled_job(scheduled_job_id, tenant_id, is_active=is_active)

    async def delete_scheduled_job(self, scheduled_job_id: str, tenant_id: str) -> bool:
        """Delete a scheduled job."""
        scheduled_job = await self.get_scheduled_job(scheduled_job_id, tenant_id)
        if not scheduled_job:
            return False

        await self.session.delete(scheduled_job)
        await self.session.commit()

        logger.info("scheduled_job.deleted", scheduled_job_id=scheduled_job_id)
        return True

    async def get_due_scheduled_jobs(self) -> list[ScheduledJob]:
        """
        Get all scheduled jobs that are due to run.

        Returns:
            List of scheduled jobs due for execution
        """
        now = datetime.now(UTC)

        stmt = select(ScheduledJob).where(
            and_(
                ScheduledJob.is_active,
                ScheduledJob.next_run_at <= now,
            )
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def execute_scheduled_job(self, scheduled_job: ScheduledJob) -> Job:
        """
        Execute a scheduled job by creating a Job instance.

        Args:
            scheduled_job: The scheduled job to execute

        Returns:
            Created Job instance
        """
        # Check concurrent runs
        running_count = await self._count_running_jobs(scheduled_job)
        if running_count >= scheduled_job.max_concurrent_runs:
            logger.warning(
                "scheduled_job.max_concurrent_runs_reached",
                scheduled_job_id=scheduled_job.id,
                running=running_count,
                max=scheduled_job.max_concurrent_runs,
            )
            raise RuntimeError("Maximum concurrent runs reached")

        # Create job instance
        job = Job(
            id=str(uuid4()),
            tenant_id=scheduled_job.tenant_id,
            job_type=scheduled_job.job_type,
            status=JobStatus.PENDING.value,
            title=f"{scheduled_job.name} (Scheduled)",
            description=scheduled_job.description,
            priority=scheduled_job.priority,
            max_retries=scheduled_job.max_retries,
            retry_delay_seconds=scheduled_job.retry_delay_seconds,
            timeout_seconds=scheduled_job.timeout_seconds,
            parameters=scheduled_job.parameters,
            scheduled_job_id=scheduled_job.id,
            created_by=scheduled_job.created_by,
        )

        self.session.add(job)

        # Update scheduled job stats
        scheduled_job.last_run_at = datetime.now(UTC)
        scheduled_job.total_runs += 1
        scheduled_job.next_run_at = self._calculate_next_run(
            scheduled_job.cron_expression, scheduled_job.interval_seconds
        )

        await self.session.commit()
        await self.session.refresh(job)

        logger.info(
            "scheduled_job.executed",
            scheduled_job_id=scheduled_job.id,
            job_id=job.id,
            next_run=scheduled_job.next_run_at,
        )

        return job

    async def update_scheduled_job_stats(self, scheduled_job_id: str, success: bool) -> None:
        """Update scheduled job statistics after execution."""
        stmt = select(ScheduledJob).where(ScheduledJob.id == scheduled_job_id)
        result = await self.session.execute(stmt)
        scheduled_job = result.scalar_one_or_none()

        if scheduled_job:
            if success:
                scheduled_job.successful_runs += 1
            else:
                scheduled_job.failed_runs += 1

            await self.session.commit()

    # ========== Job Chain Management ==========

    async def create_job_chain(
        self,
        tenant_id: str,
        created_by: str,
        name: str,
        chain_definition: list[dict[str, Any]],
        execution_mode: JobExecutionMode = JobExecutionMode.SEQUENTIAL,
        description: str | None = None,
        stop_on_failure: bool = True,
        timeout_seconds: int | None = None,
    ) -> JobChain:
        """
        Create a new job chain.

        Args:
            tenant_id: Tenant ID
            created_by: User ID who created the chain
            name: Chain name
            chain_definition: List of job definitions
            execution_mode: Sequential or parallel execution
            description: Chain description
            stop_on_failure: Stop if a job fails
            timeout_seconds: Total chain timeout

        Returns:
            Created job chain
        """
        if not chain_definition:
            raise ValueError("Chain definition cannot be empty")

        job_chain = JobChain(
            id=str(uuid4()),
            tenant_id=tenant_id,
            name=name,
            description=description,
            execution_mode=execution_mode.value,
            chain_definition=chain_definition,
            is_active=True,
            stop_on_failure=stop_on_failure,
            timeout_seconds=timeout_seconds,
            status=JobStatus.PENDING.value,
            current_step=0,
            total_steps=len(chain_definition),
            created_by=created_by,
        )

        self.session.add(job_chain)
        await self.session.commit()
        await self.session.refresh(job_chain)

        logger.info(
            "job_chain.created",
            chain_id=job_chain.id,
            name=name,
            steps=len(chain_definition),
            mode=execution_mode.value,
        )

        return job_chain

    async def get_job_chain(self, chain_id: str, tenant_id: str) -> JobChain | None:
        """Get job chain by ID."""
        stmt = select(JobChain).where(JobChain.id == chain_id, JobChain.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def execute_job_chain(self, chain_id: str, tenant_id: str) -> JobChain:
        """
        Execute a job chain.

        Args:
            chain_id: Job chain ID
            tenant_id: Tenant ID

        Returns:
            Updated job chain
        """
        chain = await self.get_job_chain(chain_id, tenant_id)
        if not chain:
            raise ValueError(f"Job chain {chain_id} not found")

        if chain.status != JobStatus.PENDING.value:
            raise ValueError(f"Job chain {chain_id} is not in PENDING state")

        chain.status = JobStatus.RUNNING.value
        chain.started_at = datetime.now(UTC)
        await self.session.commit()

        logger.info("job_chain.started", chain_id=chain_id, mode=chain.execution_mode)

        try:
            if chain.execution_mode == JobExecutionMode.SEQUENTIAL.value:
                await self._execute_sequential_chain(chain)
            else:
                await self._execute_parallel_chain(chain)

            chain.status = JobStatus.COMPLETED.value
            chain.completed_at = datetime.now(UTC)

        except Exception as e:
            chain.status = JobStatus.FAILED.value
            chain.error_message = str(e)
            chain.completed_at = datetime.now(UTC)

            logger.error("job_chain.failed", chain_id=chain_id, error=str(e), exc_info=True)

        await self.session.commit()
        await self.session.refresh(chain)

        return chain

    async def _execute_sequential_chain(self, chain: JobChain) -> None:
        """Execute job chain sequentially."""
        results: dict[str, dict[str, Any]] = {}

        for i, job_def in enumerate(chain.chain_definition):
            chain.current_step = i
            await self.session.commit()

            logger.info(
                "job_chain.step_starting",
                chain_id=chain.id,
                step=i + 1,
                total=chain.total_steps,
            )

            try:
                # Create and execute job
                job = await self._create_chain_job(chain, job_def, i)
                result = await self._wait_for_job_completion(job)
                results[f"step_{i}"] = result

                chain.current_step = i + 1
                await self.session.commit()

            except Exception as e:
                logger.error(
                    "job_chain.step_failed",
                    chain_id=chain.id,
                    step=i + 1,
                    error=str(e),
                )

                if chain.stop_on_failure:
                    raise

        chain.results = results

    async def _execute_parallel_chain(self, chain: JobChain) -> None:
        """Execute job chain in parallel."""
        # Create all jobs
        jobs = []
        for i, job_def in enumerate(chain.chain_definition):
            job = await self._create_chain_job(chain, job_def, i)
            jobs.append(job)

        # Wait for all to complete
        tasks = [self._wait_for_job_completion(job) for job in jobs]
        results_list = await asyncio.gather(*tasks, return_exceptions=True)

        # Aggregate results
        results: dict[str, dict[str, Any]] = {}
        for i, result in enumerate(results_list):
            if isinstance(result, Exception):
                results[f"step_{i}"] = {"error": str(result)}
                if chain.stop_on_failure:
                    raise result
            else:
                results[f"step_{i}"] = cast(dict[str, Any], result)

        chain.results = results
        chain.current_step = chain.total_steps

    async def _create_chain_job(
        self, chain: JobChain, job_def: dict[str, Any], step_index: int
    ) -> Job:
        """Create a job for a chain step."""
        job = Job(
            id=str(uuid4()),
            tenant_id=chain.tenant_id,
            job_type=job_def.get("job_type", "unknown"),
            status=JobStatus.PENDING.value,
            title=f"{chain.name} - Step {step_index + 1}",
            description=job_def.get("description"),
            parameters=job_def.get("parameters", {}),
            parent_job_id=None,  # Could link to chain master job
            timeout_seconds=chain.timeout_seconds,
            created_by=chain.created_by,
        )

        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)

        return job

    async def _wait_for_job_completion(
        self, job: Job, timeout_seconds: int = 3600
    ) -> dict[str, Any]:
        """Wait for a job to complete (polling-based for now)."""
        start_time = datetime.now(UTC)
        while True:
            await self.session.refresh(job)

            if job.is_terminal:
                if job.status == JobStatus.COMPLETED.value:
                    return job.result or {}
                else:
                    raise RuntimeError(f"Job {job.id} failed: {job.error_message}")

            # Check timeout
            elapsed = (datetime.now(UTC) - start_time).total_seconds()
            if elapsed > timeout_seconds:
                raise TimeoutError(f"Job {job.id} timed out after {timeout_seconds}s")

            await asyncio.sleep(5)  # Poll every 5 seconds

    # ========== Helper Methods ==========

    def _calculate_next_run(
        self, cron_expression: str | None, interval_seconds: int | None
    ) -> datetime:
        """Calculate next run time for scheduled job."""
        now = datetime.now(UTC)

        if cron_expression:
            cron = croniter(cron_expression, now)
            next_run = cast(datetime, cron.get_next(datetime))
            return next_run
        elif interval_seconds:
            return now + timedelta(seconds=interval_seconds)
        else:
            raise ValueError("Either cron_expression or interval_seconds required")

    async def _count_running_jobs(self, scheduled_job: ScheduledJob) -> int:
        """Count currently running jobs for a scheduled job."""
        stmt = select(func.count()).where(
            and_(
                Job.scheduled_job_id == scheduled_job.id,
                Job.status == JobStatus.RUNNING.value,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0
