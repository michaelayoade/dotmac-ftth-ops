"""
Pydantic schemas for data import API.

Defines request and response models for import operations.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.data_import.models import ImportJob, ImportJobStatus
from dotmac.platform.data_import.service import ImportResult


class ImportJobResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for import job details."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, use_enum_values=True)

    id: UUID = Field(description="Import job ID")
    job_type: str = Field(description="Type of import")
    status: str = Field(description="Current job status")
    file_name: str = Field(description="Name of imported file")
    file_size: int = Field(description="Size of file in bytes")
    file_format: str = Field(description="File format (csv, json)")

    total_records: int = Field(default=0, description="Total records in file")
    processed_records: int = Field(default=0, description="Records processed")
    successful_records: int = Field(default=0, description="Successfully imported")
    failed_records: int = Field(default=0, description="Failed imports")

    progress_percentage: float = Field(default=0.0, description="Progress percentage")
    success_rate: float = Field(default=0.0, description="Success rate percentage")

    started_at: datetime | None = Field(None, description="When processing started")
    completed_at: datetime | None = Field(None, description="When processing completed")
    duration_seconds: float | None = Field(None, description="Processing duration")

    error_message: str | None = Field(None, description="Error message if failed")
    celery_task_id: str | None = Field(None, description="Background task ID")

    summary: dict[str, Any] = Field(default_factory=dict, description="Import summary")
    config: dict[str, Any] = Field(default_factory=dict, description="Import configuration")

    tenant_id: str = Field(description="Tenant identifier")
    initiated_by: UUID | None = Field(None, description="User who started import")
    created_at: datetime = Field(description="When job was created")
    updated_at: datetime = Field(description="Last update time")

    @classmethod
    def from_model(
        cls,
        job: ImportJob,
        result: ImportResult | None = None,
    ) -> "ImportJobResponse":
        """Create response from database model."""
        data: dict[str, Any] = {
            "id": job.id,
            "job_type": job.job_type.value,
            "status": job.status.value,
            "file_name": job.file_name,
            "file_size": job.file_size,
            "file_format": job.file_format,
            "total_records": job.total_records,
            "processed_records": job.processed_records,
            "successful_records": job.successful_records,
            "failed_records": job.failed_records,
            "progress_percentage": job.progress_percentage,
            "success_rate": job.success_rate,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "duration_seconds": job.duration_seconds,
            "error_message": job.error_message,
            "celery_task_id": job.celery_task_id,
            "summary": job.summary or {},
            "config": job.config or {},
            "tenant_id": job.tenant_id,
            "initiated_by": job.initiated_by,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }

        # Override with result data if provided
        if result:
            data["summary"] = result.to_dict()

        return cls(**data)


class ImportJobListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for list of import jobs."""

    model_config = ConfigDict()

    jobs: list[ImportJobResponse] = Field(description="List of import jobs")
    total: int = Field(description="Total number of jobs")
    limit: int = Field(description="Results per page")
    offset: int = Field(description="Number of results skipped")


class ImportStatusResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for import job status check."""

    model_config = ConfigDict()

    job_id: str = Field(description="Import job ID")
    status: ImportJobStatus = Field(description="Current status")
    progress_percentage: float = Field(description="Progress percentage")

    total_records: int = Field(description="Total records to process")
    processed_records: int = Field(description="Records processed so far")
    successful_records: int = Field(description="Successfully imported")
    failed_records: int = Field(description="Failed to import")

    celery_task_status: str | None = Field(None, description="Background task status")
    error_message: str | None = Field(None, description="Error if failed")


class ImportFailureResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for import failure details."""

    model_config = ConfigDict()

    row_number: int = Field(description="Row number that failed")
    error_type: str = Field(description="Type of error")
    error_message: str = Field(description="Error description")
    row_data: dict[str, Any] = Field(description="Original row data")
    field_errors: dict[str, str] = Field(default_factory=dict, description="Field-level errors")


class ImportRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request model for initiating import."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    batch_size: int = Field(default=100, ge=1, le=5000, description="Records per batch")
    dry_run: bool = Field(default=False, description="Validate without persisting")
    use_async: bool = Field(default=False, description="Process in background")
    config: dict[str, Any] = Field(default_factory=dict, description="Additional configuration")


class BulkImportRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request model for bulk import operations."""

    model_config = ConfigDict()

    imports: list[dict[str, Any]] = Field(description="List of import configurations")
    dry_run: bool = Field(default=False, description="Validate all without persisting")
    use_async: bool = Field(default=True, description="Process all in background")
    parallel: bool = Field(default=False, description="Process imports in parallel")


class ImportTemplateResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for import template download."""

    model_config = ConfigDict()

    entity_type: str = Field(description="Type of entity")
    format: str = Field(description="File format (csv, json)")
    fields: list[dict[str, str]] = Field(description="Field definitions")
    example_data: list[dict[str, Any]] = Field(description="Example records")
    instructions: str = Field(description="Import instructions")
