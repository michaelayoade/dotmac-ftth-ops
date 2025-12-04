"""
Job Scheduler API Router.

REST endpoints for scheduled jobs and job chains management.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.jobs.models import JobExecutionMode, JobPriority
from dotmac.platform.jobs.scheduler_service import SchedulerService
from dotmac.platform.redis_client import RedisClientType, get_redis_client

router = APIRouter(prefix="/jobs/scheduler", tags=["Job Scheduler"])


def _require_tenant_id(user: UserInfo) -> str:
    """Ensure Scheduler API operations have an explicit tenant context."""
    tenant_id = user.tenant_id
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context is required for scheduler operations.",
        )
    return tenant_id


# =============================================================================
# Schemas
# =============================================================================


class ScheduledJobCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating a scheduled job."""

    model_config = ConfigDict()

    name: str = Field(..., description="Scheduled job name")
    job_type: str = Field(..., description="Type of job to execute")
    cron_expression: str | None = Field(None, description="Cron expression (e.g., '0 0 * * *')")
    interval_seconds: int | None = Field(None, description="Interval in seconds")
    description: str | None = Field(None, description="Job description")
    parameters: dict[str, Any] | None = Field(None, description="Job parameters")
    priority: JobPriority = Field(JobPriority.NORMAL, description="Job priority")
    max_retries: int = Field(3, description="Maximum retries")
    retry_delay_seconds: int = Field(60, description="Retry delay in seconds")
    max_concurrent_runs: int = Field(1, description="Max concurrent executions")
    timeout_seconds: int | None = Field(None, description="Job timeout")


class ScheduledJobUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating a scheduled job."""

    model_config = ConfigDict()

    name: str | None = None
    description: str | None = None
    cron_expression: str | None = None
    interval_seconds: int | None = None
    is_active: bool | None = None
    max_concurrent_runs: int | None = None
    timeout_seconds: int | None = None
    priority: JobPriority | None = None
    max_retries: int | None = None
    retry_delay_seconds: int | None = None
    parameters: dict[str, Any] | None = None


class ScheduledJobResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for scheduled job response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    description: str | None
    job_type: str
    cron_expression: str | None
    interval_seconds: int | None
    is_active: bool
    max_concurrent_runs: int
    timeout_seconds: int | None
    priority: str
    max_retries: int
    retry_delay_seconds: int
    last_run_at: str | None
    next_run_at: str | None
    total_runs: int
    successful_runs: int
    failed_runs: int
    created_by: str
    created_at: str


class JobChainCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating a job chain."""

    model_config = ConfigDict()

    name: str = Field(..., description="Chain name")
    chain_definition: list[dict[str, Any]] = Field(..., description="List of job definitions")
    execution_mode: JobExecutionMode = Field(
        JobExecutionMode.SEQUENTIAL, description="Sequential or parallel"
    )
    description: str | None = Field(None, description="Chain description")
    stop_on_failure: bool = Field(True, description="Stop if a job fails")
    timeout_seconds: int | None = Field(None, description="Total chain timeout")


class JobChainResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for job chain response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    description: str | None
    execution_mode: str
    chain_definition: list[dict[str, Any]]
    is_active: bool
    stop_on_failure: bool
    timeout_seconds: int | None
    status: str
    current_step: int
    total_steps: int
    started_at: str | None
    completed_at: str | None
    results: dict[str, Any] | None
    error_message: str | None
    created_by: str
    created_at: str


# =============================================================================
# Dependencies
# =============================================================================


async def get_scheduler_service(
    session: AsyncSession = Depends(get_session_dependency),
    redis: RedisClientType = Depends(get_redis_client),
) -> SchedulerService:
    """Get scheduler service instance."""
    return SchedulerService(session, redis_client=redis)


# =============================================================================
# Scheduled Job Endpoints
# =============================================================================


@router.post(
    "/scheduled-jobs",
    response_model=ScheduledJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Scheduled Job",
    description="Create a new scheduled job with cron or interval-based execution",
)
async def create_scheduled_job(
    job_data: ScheduledJobCreate,
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> ScheduledJobResponse:
    """
    Create a new scheduled job.

    **Schedule Types:**
    - **Cron**: Use `cron_expression` (e.g., '0 0 * * *' for daily at midnight)
    - **Interval**: Use `interval_seconds` (e.g., 3600 for hourly)

    Only one of `cron_expression` or `interval_seconds` should be provided.

    **Examples:**
    ```
    # Daily at 2 AM
    {"cron_expression": "0 2 * * *", ...}

    # Every 15 minutes
    {"interval_seconds": 900, ...}
    ```
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        scheduled_job = await service.create_scheduled_job(
            tenant_id=tenant_id,
            created_by=current_user.user_id,
            name=job_data.name,
            job_type=job_data.job_type,
            cron_expression=job_data.cron_expression,
            interval_seconds=job_data.interval_seconds,
            description=job_data.description,
            parameters=job_data.parameters,
            priority=job_data.priority,
            max_retries=job_data.max_retries,
            retry_delay_seconds=job_data.retry_delay_seconds,
            max_concurrent_runs=job_data.max_concurrent_runs,
            timeout_seconds=job_data.timeout_seconds,
        )
        return ScheduledJobResponse.model_validate(scheduled_job)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/scheduled-jobs",
    response_model=list[ScheduledJobResponse],
    summary="List Scheduled Jobs",
    description="List all scheduled jobs with optional filtering",
)
async def list_scheduled_jobs(
    is_active: bool | None = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> list[ScheduledJobResponse]:
    """
    List scheduled jobs for the current tenant.

    **Filters:**
    - `is_active`: Filter by active/inactive status
    - `page`: Page number (1-indexed)
    - `page_size`: Items per page (max 100)
    """
    tenant_id = _require_tenant_id(current_user)
    scheduled_jobs, total = await service.list_scheduled_jobs(
        tenant_id=tenant_id,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )

    return [ScheduledJobResponse.model_validate(job) for job in scheduled_jobs]


@router.get(
    "/scheduled-jobs/{scheduled_job_id}",
    response_model=ScheduledJobResponse,
    summary="Get Scheduled Job",
    description="Get details of a specific scheduled job",
)
async def get_scheduled_job(
    scheduled_job_id: str,
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> ScheduledJobResponse:
    """Get detailed information about a scheduled job."""
    tenant_id = _require_tenant_id(current_user)
    scheduled_job = await service.get_scheduled_job(scheduled_job_id, tenant_id)

    if not scheduled_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduled job {scheduled_job_id} not found",
        )

    return ScheduledJobResponse.model_validate(scheduled_job)


@router.patch(
    "/scheduled-jobs/{scheduled_job_id}",
    response_model=ScheduledJobResponse,
    summary="Update Scheduled Job",
    description="Update scheduled job configuration",
)
async def update_scheduled_job(
    scheduled_job_id: str,
    updates: ScheduledJobUpdate,
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> ScheduledJobResponse:
    """
    Update scheduled job configuration.

    **Note:** Changing `cron_expression` or `interval_seconds` will recalculate `next_run_at`.
    """
    update_dict = updates.model_dump(exclude_unset=True)
    tenant_id = _require_tenant_id(current_user)

    try:
        scheduled_job = await service.update_scheduled_job(
            scheduled_job_id, tenant_id, **update_dict
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not scheduled_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduled job {scheduled_job_id} not found",
        )

    return ScheduledJobResponse.model_validate(scheduled_job)


@router.post(
    "/scheduled-jobs/{scheduled_job_id}/toggle",
    response_model=ScheduledJobResponse,
    summary="Toggle Scheduled Job",
    description="Enable or disable a scheduled job",
)
async def toggle_scheduled_job(
    scheduled_job_id: str,
    is_active: bool = Query(..., description="Active status"),
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> ScheduledJobResponse:
    """Toggle scheduled job active status."""
    tenant_id = _require_tenant_id(current_user)
    scheduled_job = await service.toggle_scheduled_job(scheduled_job_id, tenant_id, is_active)

    if not scheduled_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduled job {scheduled_job_id} not found",
        )

    return ScheduledJobResponse.model_validate(scheduled_job)


@router.delete(
    "/scheduled-jobs/{scheduled_job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Scheduled Job",
    description="Delete a scheduled job",
)
async def delete_scheduled_job(
    scheduled_job_id: str,
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> None:
    """Delete a scheduled job permanently."""
    tenant_id = _require_tenant_id(current_user)
    deleted = await service.delete_scheduled_job(scheduled_job_id, tenant_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduled job {scheduled_job_id} not found",
        )

    return None


# =============================================================================
# Job Chain Endpoints
# =============================================================================


@router.post(
    "/chains",
    response_model=JobChainResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Job Chain",
    description="Create a new job chain for multi-step workflows",
)
async def create_job_chain(
    chain_data: JobChainCreate,
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobChainResponse:
    """
    Create a new job chain.

    **Execution Modes:**
    - `sequential`: Jobs run one after another
    - `parallel`: Jobs run concurrently

    **Chain Definition Format:**
    ```json
    [
      {"job_type": "extract_data", "parameters": {"source": "api"}},
      {"job_type": "transform_data", "parameters": {"format": "json"}},
      {"job_type": "load_data", "parameters": {"destination": "warehouse"}}
    ]
    ```

    **Example - Data Pipeline:**
    ```json
    {
      "name": "ETL Pipeline",
      "execution_mode": "sequential",
      "stop_on_failure": true,
      "chain_definition": [
        {"job_type": "extract", "parameters": {...}},
        {"job_type": "transform", "parameters": {...}},
        {"job_type": "load", "parameters": {...}}
      ]
    }
    ```
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        job_chain = await service.create_job_chain(
            tenant_id=tenant_id,
            created_by=current_user.user_id,
            name=chain_data.name,
            chain_definition=chain_data.chain_definition,
            execution_mode=chain_data.execution_mode,
            description=chain_data.description,
            stop_on_failure=chain_data.stop_on_failure,
            timeout_seconds=chain_data.timeout_seconds,
        )
        return JobChainResponse.model_validate(job_chain)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/chains/{chain_id}",
    response_model=JobChainResponse,
    summary="Get Job Chain",
    description="Get details of a specific job chain",
)
async def get_job_chain(
    chain_id: str,
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobChainResponse:
    """Get detailed information about a job chain including progress and results."""
    tenant_id = _require_tenant_id(current_user)
    job_chain = await service.get_job_chain(chain_id, tenant_id)

    if not job_chain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job chain {chain_id} not found",
        )

    return JobChainResponse.model_validate(job_chain)


@router.post(
    "/chains/{chain_id}/execute",
    response_model=JobChainResponse,
    summary="Execute Job Chain",
    description="Execute a job chain (start the workflow)",
)
async def execute_job_chain(
    chain_id: str,
    service: SchedulerService = Depends(get_scheduler_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobChainResponse:
    """
    Execute a job chain.

    The chain must be in PENDING status to be executed.
    This endpoint will:
    1. Mark the chain as RUNNING
    2. Execute jobs according to execution_mode (sequential/parallel)
    3. Track progress and results
    4. Mark chain as COMPLETED or FAILED

    **Note:** This is an async operation. Use GET /chains/{chain_id} to poll for progress.
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        job_chain = await service.execute_job_chain(chain_id, tenant_id)
        return JobChainResponse.model_validate(job_chain)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
