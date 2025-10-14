"""
Job Schemas

Pydantic models for job API requests and responses.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from dotmac.platform.jobs.models import JobStatus, JobType


# =============================================================================
# Job Request Schemas
# =============================================================================


class JobCreate(BaseModel):
    """Schema for creating a new job."""

    job_type: str = Field(..., description="Type of job (e.g., bulk_import, firmware_upgrade)")
    title: str = Field(..., min_length=1, max_length=255, description="Job title")
    description: str | None = Field(None, description="Detailed job description")
    items_total: int | None = Field(None, ge=0, description="Total number of items to process")
    parameters: dict | None = Field(None, description="Job-specific parameters")


class JobUpdate(BaseModel):
    """Schema for updating job progress."""

    status: str | None = None
    progress_percent: int | None = Field(None, ge=0, le=100)
    items_processed: int | None = Field(None, ge=0)
    items_succeeded: int | None = Field(None, ge=0)
    items_failed: int | None = Field(None, ge=0)
    current_item: str | None = None
    error_message: str | None = None
    error_details: dict | None = None
    result: dict | None = None


# =============================================================================
# Job Response Schemas
# =============================================================================


class JobResponse(BaseModel):
    """Complete job response with all fields."""

    id: str
    tenant_id: str
    job_type: str
    status: str
    title: str
    description: str | None
    progress_percent: int
    items_total: int | None
    items_processed: int
    items_succeeded: int
    items_failed: int
    current_item: str | None
    error_message: str | None
    error_details: dict | None
    failed_items: list | None
    parameters: dict | None
    result: dict | None
    created_by: str
    cancelled_by: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None

    # Computed fields
    is_terminal: bool = Field(..., description="True if job is completed, failed, or cancelled")
    is_active: bool = Field(..., description="True if job is pending or running")
    success_rate: float = Field(..., description="Success rate percentage")
    failure_rate: float = Field(..., description="Failure rate percentage")
    duration_seconds: int | None = Field(..., description="Job duration in seconds")

    model_config = {"from_attributes": True}


class JobSummary(BaseModel):
    """Summary job response for list views."""

    id: str
    job_type: str
    status: str
    title: str
    progress_percent: int
    items_total: int | None
    items_processed: int
    items_succeeded: int
    items_failed: int
    created_by: str
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: int | None

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    """Paginated list of jobs."""

    jobs: list[JobSummary]
    total: int
    page: int
    page_size: int
    has_more: bool


# =============================================================================
# Job Action Responses
# =============================================================================


class JobCancelResponse(BaseModel):
    """Response after cancelling a job."""

    id: str
    status: str
    cancelled_at: datetime
    cancelled_by: str
    message: str


class JobRetryResponse(BaseModel):
    """Response after retrying failed items."""

    original_job_id: str
    new_job_id: str
    failed_items_count: int
    message: str


# =============================================================================
# Job Statistics
# =============================================================================


class JobStatistics(BaseModel):
    """Job statistics for a tenant."""

    total_jobs: int
    pending_jobs: int
    running_jobs: int
    completed_jobs: int
    failed_jobs: int
    cancelled_jobs: int
    avg_duration_seconds: float | None
    total_items_processed: int
    total_items_succeeded: int
    total_items_failed: int
    overall_success_rate: float
