"""
Data transfer request and response models with proper validation.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import ConfigDict, Field, field_validator

from ..core.models import BaseModel
from .core import CompressionType, DataFormat, TransferStatus


class TransferType(str, Enum):
    """Type of transfer operation."""

    IMPORT = "import"
    EXPORT = "export"
    SYNC = "sync"
    MIGRATE = "migrate"


class ImportSource(str, Enum):
    """Valid import sources."""

    FILE = "file"
    DATABASE = "database"
    API = "api"
    S3 = "s3"
    SFTP = "sftp"
    HTTP = "http"


class ExportTarget(str, Enum):
    """Valid export targets."""

    FILE = "file"
    DATABASE = "database"
    API = "api"
    S3 = "s3"
    SFTP = "sftp"
    EMAIL = "email"


class ValidationLevel(str, Enum):
    """Data validation levels."""

    NONE = "none"
    BASIC = "basic"
    STRICT = "strict"


# ========================================
# Request Models
# ========================================


class ImportRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Import data request with validation."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    source_type: ImportSource = Field(..., description="Type of import source")
    source_path: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Path or URL to source data",
    )
    format: DataFormat = Field(..., description="Data format")
    mapping: dict[str, str] | None = Field(
        None,
        description="Field mapping (source_field: target_field)",
    )
    options: dict[str, Any] | None = Field(
        None,
        description="Format-specific options",
    )
    validation_level: ValidationLevel = Field(
        ValidationLevel.BASIC,
        description="Data validation level",
    )
    batch_size: int = Field(
        1000,
        ge=1,
        le=100000,
        description="Batch size for processing",
    )
    encoding: str = Field(
        "utf-8",
        description="File encoding",
    )
    skip_errors: bool = Field(
        False,
        description="Continue on individual record errors",
    )
    dry_run: bool = Field(
        False,
        description="Validate without importing",
    )

    @field_validator("source_path")
    @classmethod
    def validate_source_path(cls, v: str, info: Any) -> str:
        """Validate source path based on source type."""
        source_type = info.data.get("source_type")

        if source_type == ImportSource.FILE:
            # Basic file path validation
            if not v or v.startswith(".."):
                raise ValueError("Invalid file path")
        elif source_type in [ImportSource.HTTP, ImportSource.API]:
            # Basic URL validation
            if not (v.startswith("http://") or v.startswith("https://")):
                raise ValueError("Source must be a valid HTTP(S) URL")
        elif source_type == ImportSource.S3:
            # S3 path validation
            if not v.startswith("s3://"):
                raise ValueError("S3 paths must start with s3://")

        return v

    @field_validator("mapping")
    @classmethod
    def validate_mapping(cls, v: dict[str, str] | None) -> dict[str, str] | None:
        """Validate field mapping."""
        if v is None:
            return None

        if len(v) > 1000:
            raise ValueError("Maximum 1000 field mappings allowed")

        for source, target in v.items():
            if not isinstance(source, str) or not isinstance(target, str):
                raise ValueError("Mapping keys and values must be strings")
            if len(source) > 100 or len(target) > 100:
                raise ValueError("Field names must not exceed 100 characters")

        return v


class ExportRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Export data request with validation."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    target_type: ExportTarget = Field(..., description="Type of export target")
    target_path: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Path or URL for target",
    )
    format: DataFormat = Field(..., description="Export format")
    filters: dict[str, Any] | None = Field(
        None,
        description="Data filters to apply",
    )
    fields: list[str] | None = Field(
        None,
        max_length=1000,
        description="Fields to export (None = all)",
    )
    options: dict[str, Any] | None = Field(
        None,
        description="Format-specific options",
    )
    compression: CompressionType = Field(
        CompressionType.NONE,
        description="Output compression",
    )
    batch_size: int = Field(
        1000,
        ge=1,
        le=100000,
        description="Batch size for processing",
    )
    encoding: str = Field(
        "utf-8",
        description="Output encoding",
    )
    overwrite: bool = Field(
        False,
        description="Overwrite existing target",
    )

    @field_validator("target_path")
    @classmethod
    def validate_target_path(cls, v: str, info: Any) -> str:
        """Validate target path based on target type."""
        target_type = info.data.get("target_type")

        if target_type == ExportTarget.EMAIL:
            # Basic email validation
            if "@" not in v or len(v) < 5:
                raise ValueError("Invalid email address")
        elif target_type == ExportTarget.FILE:
            # Basic file path validation
            if not v or v.startswith(".."):
                raise ValueError("Invalid file path")
        elif target_type == ExportTarget.S3:
            # S3 path validation
            if not v.startswith("s3://"):
                raise ValueError("S3 paths must start with s3://")

        return v

    @field_validator("fields")
    @classmethod
    def validate_fields(cls, v: list[str] | None) -> list[str] | None:
        """Validate field list."""
        if v is None:
            return None

        # Remove duplicates while preserving order
        seen = set()
        unique_fields = []
        for field in v:
            if field not in seen:
                seen.add(field)
                unique_fields.append(field)

        return unique_fields


class TransferJobRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Transfer job creation request."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Job name",
    )
    description: str | None = Field(
        None,
        max_length=1000,
        description="Job description",
    )
    schedule: str | None = Field(
        None,
        description="Cron schedule for recurring jobs",
    )
    notification_email: str | None = Field(
        None,
        description="Email for job notifications",
    )
    retry_on_failure: bool = Field(
        True,
        description="Retry failed transfers",
    )
    max_retries: int = Field(
        3,
        ge=0,
        le=10,
        description="Maximum retry attempts",
    )


# ========================================
# Response Models
# ========================================


class TransferJobResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Transfer job response."""

    model_config = ConfigDict(from_attributes=True, extra="allow")

    job_id: UUID = Field(default_factory=uuid4, description="Unique job ID")
    name: str = Field(..., description="Job name")
    type: TransferType = Field(..., description="Transfer type")
    status: TransferStatus = Field(..., description="Current job status")
    progress: float = Field(
        0,
        ge=0,
        le=100,
        description="Progress percentage",
    )
    created_at: datetime = Field(..., description="Job creation time")
    started_at: datetime | None = Field(None, description="Job start time")
    completed_at: datetime | None = Field(None, description="Job completion time")
    records_processed: int = Field(0, ge=0, description="Records processed")
    records_failed: int = Field(0, ge=0, description="Records failed")
    records_total: int | None = Field(None, description="Total records to process")
    error_message: str | None = Field(None, description="Error message if failed")
    metadata: dict[str, Any] | None = Field(
        None, description="Additional metadata", validation_alias="metadata_"
    )

    @property
    def duration(self) -> float | None:
        """Calculate job duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        total = self.records_processed + self.records_failed
        if total > 0:
            return (self.records_processed / total) * 100
        return 100.0


class TransferJobListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """List of transfer jobs response."""

    model_config = ConfigDict(from_attributes=True)

    jobs: list[TransferJobResponse] = Field(..., description="Transfer jobs")
    total: int = Field(..., description="Total number of jobs")
    page: int = Field(1, description="Current page")
    page_size: int = Field(20, description="Page size")
    has_more: bool = Field(False, description="More results available")


class TransferValidationResult(BaseModel):  # BaseModel resolves to Any in isolation
    """Validation result for transfer operation."""

    model_config = ConfigDict()

    is_valid: bool = Field(..., description="Whether validation passed")
    errors: list[str] = Field(default_factory=list, description="Validation errors")
    warnings: list[str] = Field(default_factory=list, description="Validation warnings")
    record_count: int | None = Field(None, description="Number of records found")
    sample_data: list[dict[str, Any]] | None = Field(
        None,
        description="Sample of data records",
    )
    json_schema: dict[str, str] | None = Field(
        None,
        description="Detected data schema",
    )


class TransferProgressUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Progress update for transfer job."""

    model_config = ConfigDict(from_attributes=True)

    job_id: UUID = Field(..., description="Job ID")
    status: TransferStatus = Field(..., description="Current status")
    progress: float = Field(..., description="Progress percentage")
    current_batch: int = Field(..., description="Current batch number")
    total_batches: int | None = Field(None, description="Total number of batches")
    records_processed: int = Field(..., description="Records processed so far")
    records_failed: int = Field(..., description="Records failed so far")
    current_file: str | None = Field(None, description="Current file being processed")
    message: str | None = Field(None, description="Status message")
    estimated_completion: datetime | None = Field(
        None,
        description="Estimated completion time",
    )


class DataFormatInfo(BaseModel):  # BaseModel resolves to Any in isolation
    """Information about a data format."""

    model_config = ConfigDict()

    format: DataFormat = Field(..., description="Format identifier")
    name: str = Field(..., description="Format display name")
    file_extensions: list[str] = Field(..., description="Supported file extensions")
    mime_types: list[str] = Field(..., description="MIME types")
    supports_compression: bool = Field(..., description="Compression support")
    supports_streaming: bool = Field(..., description="Streaming support")
    options: dict[str, Any] = Field(
        default_factory=dict,
        description="Available format options",
    )


class FormatsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Supported formats response."""

    model_config = ConfigDict()

    import_formats: list[DataFormatInfo] = Field(..., description="Importable formats")
    export_formats: list[DataFormatInfo] = Field(..., description="Exportable formats")
    compression_types: list[str] = Field(..., description="Supported compression types")


class TransferStatistics(BaseModel):  # BaseModel resolves to Any in isolation
    """Transfer operation statistics."""

    model_config = ConfigDict(from_attributes=True)

    total_jobs: int = Field(..., description="Total number of jobs")
    completed_jobs: int = Field(..., description="Completed jobs")
    failed_jobs: int = Field(..., description="Failed jobs")
    in_progress_jobs: int = Field(..., description="Currently running jobs")
    total_records_processed: int = Field(..., description="Total records processed")
    total_bytes_transferred: int = Field(..., description="Total bytes transferred")
    average_job_duration: float = Field(..., description="Average job duration in seconds")
    success_rate: float = Field(..., description="Overall success rate percentage")
    busiest_hour: int | None = Field(None, description="Hour with most activity (0-23)")
    most_used_format: str | None = Field(None, description="Most frequently used format")


# ========================================
# Error Response Models
# ========================================


class TransferErrorResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Transfer error response."""

    model_config = ConfigDict()

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: dict[str, Any] | None = Field(None, description="Error details")
    job_id: UUID | None = Field(None, description="Related job ID")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Error timestamp"
    )
    suggestions: list[str] | None = Field(None, description="Suggestions for resolution")


__all__ = [
    # Enums
    "TransferType",
    "ImportSource",
    "ExportTarget",
    "ValidationLevel",
    # Request Models
    "ImportRequest",
    "ExportRequest",
    "TransferJobRequest",
    # Response Models
    "TransferJobResponse",
    "TransferJobListResponse",
    "TransferValidationResult",
    "TransferProgressUpdate",
    "DataFormatInfo",
    "FormatsResponse",
    "TransferStatistics",
    "TransferErrorResponse",
]
