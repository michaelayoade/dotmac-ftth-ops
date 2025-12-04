"""
Job API Router

REST endpoints for job management and monitoring.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as fastapi_status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.jobs.schemas import (
    JobCancelResponse,
    JobCreate,
    JobListResponse,
    JobResponse,
    JobRetryResponse,
    JobStatistics,
    JobUpdate,
)
from dotmac.platform.jobs.service import JobService
from dotmac.platform.redis_client import RedisClientType, get_redis_client

router = APIRouter(prefix="/jobs", tags=["Jobs"])


# =============================================================================
# Dependency: Get Job Service
# =============================================================================


async def get_job_service(
    session: AsyncSession = Depends(get_session_dependency),
    redis: RedisClientType = Depends(get_redis_client),
) -> JobService:
    """Get job service instance."""
    return JobService(session, redis_client=redis)


# =============================================================================
# Job Endpoints
# =============================================================================


@router.post(
    "",
    response_model=JobResponse,
    status_code=fastapi_status.HTTP_201_CREATED,
    summary="Create Job",
    description="Create a new async job",
)
async def create_job(
    job_data: JobCreate,
    service: JobService = Depends(get_job_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobResponse:
    """
    Create a new async job.

    Use this endpoint to initialize a background job. The job will be
    created in PENDING status and can be executed by background workers.

    **Job Types:**
    - `bulk_import` - Import multiple records from CSV/JSON
    - `bulk_export` - Export data to file
    - `firmware_upgrade` - Upgrade device firmware
    - `batch_provisioning` - Provision multiple devices
    - `data_migration` - Migrate data between systems
    - `report_generation` - Generate reports
    - `custom` - Custom job type
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required to create a job",
        )

    job = await service.create_job(
        tenant_id=current_user.tenant_id,
        created_by=current_user.user_id,
        job_data=job_data,
    )
    return JobResponse.model_validate(job)


@router.get(
    "",
    response_model=JobListResponse,
    summary="List Jobs",
    description="List jobs with filtering and pagination",
)
async def list_jobs(
    job_type: str | None = Query(None, description="Filter by job type"),
    job_status: str | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    service: JobService = Depends(get_job_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobListResponse:
    """
    List all jobs for the current tenant with optional filtering.

    **Filters:**
    - `job_type` - Filter by job type
    - `status` - Filter by status (pending, running, completed, failed, cancelled)

    **Pagination:**
    - Results are ordered by creation date (newest first)
    - Use `page` and `page_size` for pagination
    - Response includes `has_more` to indicate if there are more results
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required",
        )

    return await service.list_jobs(
        tenant_id=current_user.tenant_id,
        job_type=job_type,
        status=job_status,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/statistics",
    response_model=JobStatistics,
    summary="Job Statistics",
    description="Get aggregate job statistics for the current tenant",
)
async def get_job_statistics(
    service: JobService = Depends(get_job_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobStatistics:
    """
    Get aggregated job statistics for dashboards.
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required",
        )

    return await service.get_statistics(current_user.tenant_id)


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get Job",
    description="Get job details by ID",
)
async def get_job(
    job_id: str,
    service: JobService = Depends(get_job_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobResponse:
    """
    Get detailed information about a specific job.

    Returns complete job details including progress, errors, and results.
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required",
        )

    job = await service.get_job(job_id, current_user.tenant_id)
    if not job:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    return JobResponse.model_validate(job)


@router.patch(
    "/{job_id}",
    response_model=JobResponse,
    summary="Update Job Progress",
    description="Update job progress and status",
)
async def update_job_progress(
    job_id: str,
    update_data: JobUpdate,
    service: JobService = Depends(get_job_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobResponse:
    """
    Update job progress.

    This endpoint is typically used by background workers to report progress.
    Updates are automatically broadcast to connected WebSocket clients.

    **Fields:**
    - `status` - Update job status
    - `progress_percent` - Update progress (0-100)
    - `items_processed` - Update processed item count
    - `items_succeeded` - Update succeeded item count
    - `items_failed` - Update failed item count
    - `current_item` - Update current item being processed
    - `error_message` - Set error message if job fails
    - `result` - Set final result data
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required",
        )

    job = await service.update_progress(
        job_id=job_id,
        tenant_id=current_user.tenant_id,
        update_data=update_data,
    )
    if not job:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    return JobResponse.model_validate(job)


@router.post(
    "/{job_id}/cancel",
    response_model=JobCancelResponse,
    summary="Cancel Job",
    description="Cancel a running or pending job",
)
async def cancel_job(
    job_id: str,
    service: JobService = Depends(get_job_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobCancelResponse:
    """
    Cancel a job that is pending or running.

    The job will be marked as CANCELLED and background workers should
    stop processing it. Already completed, failed, or cancelled jobs
    cannot be cancelled again.
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required",
        )

    job = await service.cancel_job(
        job_id=job_id,
        tenant_id=current_user.tenant_id,
        cancelled_by=current_user.user_id or "unknown",
    )
    if not job:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found or already in terminal state",
        )
    return JobCancelResponse(
        id=job.id,
        status=job.status,
        cancelled_at=job.cancelled_at,
        cancelled_by=job.cancelled_by or "unknown",
        message=f"Job {job_id} cancelled successfully",
    )


@router.post(
    "/{job_id}/retry",
    response_model=JobRetryResponse,
    summary="Retry Failed Items",
    description="Create a new job to retry failed items",
)
async def retry_failed_items(
    job_id: str,
    service: JobService = Depends(get_job_service),
    current_user: UserInfo = Depends(get_current_user),
) -> JobRetryResponse:
    """
    Retry failed items from a previous job.

    Creates a new job that will re-process only the items that failed
    in the original job. The new job will have the same parameters as
    the original but will only process failed items.

    **Requirements:**
    - Original job must have failed items recorded
    - Original job must be in a terminal state (completed, failed, or cancelled)
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required",
        )

    retry_job = await service.retry_failed_items(
        job_id=job_id,
        tenant_id=current_user.tenant_id,
        created_by=current_user.user_id,
    )
    if not retry_job:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found or has no failed items to retry",
        )

    parameters = retry_job.parameters if isinstance(retry_job.parameters, dict) else {}
    failed_items = parameters.get("failed_items", [])
    failed_items_count = len(failed_items)

    return JobRetryResponse(
        original_job_id=job_id,
        new_job_id=retry_job.id,
        failed_items_count=failed_items_count,
        message=f"Created retry job {retry_job.id} for {failed_items_count} failed items",
    )
