"""
Job Decorators.

Decorators for easy background job creation and management.
"""

import asyncio
import functools
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, TypedDict, TypeVar, cast
from uuid import uuid4

import structlog

from dotmac.platform.jobs.models import JobPriority, JobStatus

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = UTC

logger = structlog.get_logger(__name__)

FuncType = TypeVar("FuncType", bound=Callable[..., Any])


class ScheduledJobConfig(TypedDict):
    cron_expression: str | None
    interval_seconds: int | None
    name: str
    description: str
    priority: JobPriority
    max_retries: int
    max_concurrent_runs: int
    job_type: str


def background_job(
    queue: str = "default",
    priority: JobPriority = JobPriority.NORMAL,
    max_retries: int = 3,
    retry_delay_seconds: int = 60,
    timeout_seconds: int | None = None,
    track_progress: bool = True,
) -> Callable[..., Any]:
    """
    Decorator to run a function as a background job.

    Usage:
        @background_job(queue='default', max_retries=3)
        async def process_large_file(file_path: str, tenant_id: str):
            # Long-running task
            return result

    Args:
        queue: Celery queue name
        priority: Job priority level
        max_retries: Maximum number of retries
        retry_delay_seconds: Delay between retries
        timeout_seconds: Job execution timeout
        track_progress: Whether to track job progress in database

    Returns:
        Decorated function
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract tenant_id and user_id from kwargs
            tenant_id = kwargs.get("tenant_id")
            user_id = kwargs.get("created_by") or kwargs.get("user_id")

            # Create job record if tracking enabled
            job_id = str(uuid4())
            if track_progress and tenant_id:
                from dotmac.platform.database import get_async_session
                from dotmac.platform.jobs.models import Job

                async for session in get_async_session():
                    job = Job(
                        id=job_id,
                        tenant_id=tenant_id,
                        job_type=func.__name__,
                        status=JobStatus.PENDING.value,
                        title=f"{func.__name__}",
                        description=func.__doc__ or "",
                        priority=priority.value,
                        max_retries=max_retries,
                        retry_delay_seconds=retry_delay_seconds,
                        timeout_seconds=timeout_seconds,
                        parameters={"args": args, "kwargs": kwargs},
                        created_by=user_id or "system",
                    )
                    session.add(job)
                    await session.commit()
                    logger.info(
                        "background_job.created",
                        job_id=job_id,
                        function=func.__name__,
                        tenant_id=tenant_id,
                    )
                    break

            try:
                # Execute the function
                if track_progress and tenant_id:
                    # Update status to running
                    async for session in get_async_session():
                        from dotmac.platform.jobs.models import Job

                        job_record = cast(Job | None, await session.get(Job, job_id))
                        if job_record:
                            job_record.status = JobStatus.RUNNING.value
                            job_record.started_at = datetime.now(UTC)
                            await session.commit()
                        break

                result = await func(*args, **kwargs)

                # Mark as completed
                if track_progress and tenant_id:
                    async for session in get_async_session():
                        from dotmac.platform.jobs.models import Job

                        job_record = cast(Job | None, await session.get(Job, job_id))
                        if job_record:
                            job_record.status = JobStatus.COMPLETED.value
                            job_record.completed_at = datetime.now(UTC)
                            job_record.result = {"success": True, "data": result}
                            await session.commit()
                        break

                return result

            except Exception as e:
                # Mark as failed
                if track_progress and tenant_id:
                    async for session in get_async_session():
                        import traceback

                        from dotmac.platform.jobs.models import Job

                        job_record = cast(Job | None, await session.get(Job, job_id))
                        if job_record:
                            job_record.status = JobStatus.FAILED.value
                            job_record.error_message = str(e)
                            job_record.error_traceback = traceback.format_exc()
                            job_record.completed_at = datetime.now(UTC)
                            await session.commit()
                        break

                logger.error(
                    "background_job.failed",
                    job_id=job_id,
                    function=func.__name__,
                    error=str(e),
                )
                raise

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            # For sync functions, use asyncio to run the async wrapper
            return asyncio.run(async_wrapper(*args, **kwargs))

        # Return appropriate wrapper
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def scheduled_job(
    cron: str | None = None,
    interval_seconds: int | None = None,
    name: str | None = None,
    description: str | None = None,
    priority: JobPriority = JobPriority.NORMAL,
    max_retries: int = 3,
    max_concurrent_runs: int = 1,
) -> Callable[[FuncType], FuncType]:
    """
    Decorator to define a scheduled recurring job.

    Usage:
        @scheduled_job(cron='0 0 * * *', name='Daily cleanup')
        async def cleanup_old_data(tenant_id: str):
            # Cleanup task
            pass

        @scheduled_job(interval_seconds=3600, name='Hourly sync')
        async def sync_external_data(tenant_id: str):
            # Sync task
            pass

    Args:
        cron: Cron expression (e.g., '0 0 * * *' for daily at midnight)
        interval_seconds: Interval in seconds for recurring execution
        name: Scheduled job name
        description: Job description
        priority: Job priority level
        max_retries: Maximum retries for each execution
        max_concurrent_runs: Maximum concurrent job instances

    Returns:
        Decorated function
    """
    if not cron and not interval_seconds:
        raise ValueError("Either cron or interval_seconds must be provided")

    if cron and interval_seconds:
        raise ValueError("Cannot specify both cron and interval_seconds")

    def decorator(func: FuncType) -> FuncType:
        # Store scheduling metadata on function
        config: ScheduledJobConfig = {
            "cron_expression": cron,
            "interval_seconds": interval_seconds,
            "name": name or func.__name__,
            "description": description or func.__doc__ or "",
            "priority": priority,
            "max_retries": max_retries,
            "max_concurrent_runs": max_concurrent_runs,
            "job_type": func.__name__,
        }
        cast(Any, func)._scheduled_job_config = config

        logger.info(
            "scheduled_job.registered",
            function=func.__name__,
            cron=cron,
            interval=interval_seconds,
        )

        return func

    return decorator


def job_chain(
    name: str,
    description: str | None = None,
    execution_mode: str = "sequential",
    stop_on_failure: bool = True,
    timeout_seconds: int | None = None,
) -> Callable[..., Any]:
    """
    Decorator to define a job chain (sequential or parallel job execution).

    Usage:
        @job_chain(name='Data pipeline', execution_mode='sequential')
        async def run_data_pipeline(tenant_id: str):
            # Return list of job definitions
            return [
                {"job_type": "extract_data", "parameters": {...}},
                {"job_type": "transform_data", "parameters": {...}},
                {"job_type": "load_data", "parameters": {...}},
            ]

    Args:
        name: Chain name
        description: Chain description
        execution_mode: 'sequential' or 'parallel'
        stop_on_failure: Stop execution if a job fails
        timeout_seconds: Total chain execution timeout

    Returns:
        Decorated function that creates and executes a job chain
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            tenant_id = kwargs.get("tenant_id")
            user_id = kwargs.get("created_by") or kwargs.get("user_id")

            # Get chain definition from function
            chain_definition = await func(*args, **kwargs)

            if not isinstance(chain_definition, list):
                raise ValueError("Job chain function must return a list of job definitions")

            # Create job chain record
            from dotmac.platform.database import get_async_session
            from dotmac.platform.jobs.models import JobChain, JobStatus

            chain_id = str(uuid4())
            async for session in get_async_session():
                chain = JobChain(
                    id=chain_id,
                    tenant_id=tenant_id,
                    name=name,
                    description=description or func.__doc__ or "",
                    execution_mode=execution_mode,
                    chain_definition=chain_definition,
                    is_active=True,
                    stop_on_failure=stop_on_failure,
                    timeout_seconds=timeout_seconds,
                    status=JobStatus.PENDING.value,
                    current_step=0,
                    total_steps=len(chain_definition),
                    created_by=user_id or "system",
                )
                session.add(chain)
                await session.commit()

                logger.info(
                    "job_chain.created",
                    chain_id=chain_id,
                    name=name,
                    steps=len(chain_definition),
                    mode=execution_mode,
                )
                break

            return chain_id

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            return asyncio.run(async_wrapper(*args, **kwargs))

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def retry_on_failure(
    max_retries: int = 3,
    retry_delay_seconds: int = 60,
    exponential_backoff: bool = False,
) -> Callable[..., Any]:
    """
    Decorator to automatically retry a function on failure.

    Usage:
        @retry_on_failure(max_retries=3, retry_delay_seconds=60)
        async def unstable_api_call():
            # Call that might fail
            pass

    Args:
        max_retries: Maximum number of retry attempts
        retry_delay_seconds: Initial delay between retries
        exponential_backoff: Use exponential backoff for retry delays

    Returns:
        Decorated function with retry logic
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception = None
            retry_count = 0

            while retry_count <= max_retries:
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    retry_count += 1

                    if retry_count > max_retries:
                        logger.error(
                            "retry.exhausted",
                            function=func.__name__,
                            retries=retry_count,
                            error=str(e),
                        )
                        raise

                    # Calculate delay
                    if exponential_backoff:
                        delay = retry_delay_seconds * (2 ** (retry_count - 1))
                    else:
                        delay = retry_delay_seconds

                    logger.warning(
                        "retry.attempt",
                        function=func.__name__,
                        retry=retry_count,
                        max_retries=max_retries,
                        delay=delay,
                        error=str(e),
                    )

                    await asyncio.sleep(delay)

            # Should never reach here, but just in case
            if last_exception:
                raise last_exception

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            return asyncio.run(async_wrapper(*args, **kwargs))

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator
