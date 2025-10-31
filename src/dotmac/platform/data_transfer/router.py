"""Data transfer API router."""

from datetime import datetime, timedelta, timezone

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
from typing import Any
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_admin

from .core import DataFormat, TransferStatus
from .models import (
    DataFormatInfo,
    ExportRequest,
    FormatsResponse,
    ImportRequest,
    TransferJobListResponse,
    TransferJobResponse,
    TransferType,
)

logger = structlog.get_logger(__name__)
data_transfer_router = APIRouter(
    prefix="/data-transfer",
)


def _safe_user_context(user: Any | None) -> tuple[str | None, str | None]:
    """Return (user_id, tenant_id) tuples for optional user objects."""
    if user is None:
        return None, None
    return getattr(user, "user_id", None), getattr(user, "tenant_id", None)


@data_transfer_router.post("/import", response_model=TransferJobResponse)
async def import_data(
    request: ImportRequest, current_user: UserInfo | None = Depends(require_admin)
) -> TransferJobResponse:
    """Import data from external source."""
    try:
        user_id, tenant_id = _safe_user_context(current_user)
        logger.info(
            "data_transfer.import.request",
            user_id=user_id or "unknown",
            tenant_id=tenant_id,
            source_path=request.source_path,
            source_type=request.source_type.value,
        )

        # Create job response
        job_id = uuid4()
        return TransferJobResponse(
            job_id=job_id,
            name=f"Import from {request.source_type.value}",
            type=TransferType.IMPORT,
            status=TransferStatus.PENDING,
            progress=0.0,
            created_at=datetime.now(UTC),
            started_at=None,
            completed_at=None,
            records_processed=0,
            records_failed=0,
            records_total=None,
            error_message=None,
            metadata={
                "source_type": request.source_type.value,
                "format": request.format.value,
                "batch_size": request.batch_size,
            },
        )
    except Exception as e:
        logger.exception("Error creating import job", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create import job",
        )


@data_transfer_router.post("/export", response_model=TransferJobResponse)
async def export_data(
    request: ExportRequest, current_user: UserInfo | None = Depends(require_admin)
) -> TransferJobResponse:
    """Export data to external target."""
    try:
        user_id, tenant_id = _safe_user_context(current_user)
        logger.info(
            "data_transfer.export.request",
            user_id=user_id or "unknown",
            tenant_id=tenant_id,
            target_path=request.target_path,
            target_type=request.target_type.value,
        )

        # Create job response
        job_id = uuid4()
        return TransferJobResponse(
            job_id=job_id,
            name=f"Export to {request.target_type.value}",
            type=TransferType.EXPORT,
            status=TransferStatus.PENDING,
            progress=0.0,
            created_at=datetime.now(UTC),
            started_at=None,
            completed_at=None,
            records_processed=0,
            records_failed=0,
            records_total=None,
            error_message=None,
            metadata={
                "target_type": request.target_type.value,
                "format": request.format.value,
                "compression": request.compression.value,
                "batch_size": request.batch_size,
            },
        )
    except Exception as e:
        logger.exception("Error creating export job", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create export job",
        )


@data_transfer_router.get("/jobs/{job_id}", response_model=TransferJobResponse)
async def get_job_status(
    job_id: str, current_user: UserInfo | None = Depends(require_admin)
) -> TransferJobResponse:
    """Get data transfer job status."""
    try:
        user_id, tenant_id = _safe_user_context(current_user)
        logger.info(
            "data_transfer.job.status.request",
            user_id=user_id or "unknown",
            tenant_id=tenant_id,
            job_id=job_id,
        )

        # Parse UUID
        try:
            job_uuid = UUID(job_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid job ID format",
            )

        # Return mock completed job
        return TransferJobResponse(
            job_id=job_uuid,
            name="Sample Transfer Job",
            type=TransferType.IMPORT,
            status=TransferStatus.COMPLETED,
            progress=100.0,
            created_at=datetime.now(UTC) - timedelta(hours=1),
            started_at=datetime.now(UTC) - timedelta(minutes=55),
            completed_at=datetime.now(UTC) - timedelta(minutes=5),
            records_processed=1000,
            records_failed=0,
            records_total=1000,
            error_message=None,
            metadata=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting job status", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get job status",
        )


@data_transfer_router.get("/jobs", response_model=TransferJobListResponse)
async def list_jobs(
    type: TransferType | None = Query(None, description="Filter by job type"),
    job_status: TransferStatus | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    current_user: UserInfo | None = Depends(require_admin),
) -> TransferJobListResponse:
    """List data transfer jobs."""
    try:
        user_id, tenant_id = _safe_user_context(current_user)
        logger.info(
            "data_transfer.job.list.request",
            user_id=user_id or "unknown",
            tenant_id=tenant_id,
            job_status=job_status.value if job_status else None,
            transfer_type=type.value if type else None,
        )

        # Return empty list for now
        return TransferJobListResponse(
            jobs=[],
            total=0,
            page=page,
            page_size=page_size,
            has_more=False,
        )
    except Exception as e:
        logger.exception("Error listing jobs", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list jobs",
        )


@data_transfer_router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: str, current_user: UserInfo | None = Depends(require_admin)
) -> dict[str, Any]:
    """Cancel a data transfer job."""
    user_id, tenant_id = _safe_user_context(current_user)
    logger.info(
        "data_transfer.job.cancel.request",
        user_id=user_id or "unknown",
        tenant_id=tenant_id,
        job_id=job_id,
    )
    return {"message": f"Job {job_id} cancelled"}


@data_transfer_router.get("/formats", response_model=FormatsResponse)
async def list_formats(
    current_user: UserInfo | None = Depends(require_admin),
) -> FormatsResponse:
    """List supported data formats."""
    # Define format info
    csv_info = DataFormatInfo(
        format=DataFormat.CSV,
        name="Comma-Separated Values",
        file_extensions=[".csv"],
        mime_types=["text/csv", "application/csv"],
        supports_compression=True,
        supports_streaming=True,
        options={
            "delimiter": "Delimiter character (default: ,)",
            "encoding": "File encoding (default: utf-8)",
            "headers": "Include headers (default: true)",
        },
    )

    json_info = DataFormatInfo(
        format=DataFormat.JSON,
        name="JavaScript Object Notation",
        file_extensions=[".json"],
        mime_types=["application/json"],
        supports_compression=True,
        supports_streaming=False,
        options={
            "indent": "Indentation level",
            "sort_keys": "Sort object keys",
        },
    )

    excel_info = DataFormatInfo(
        format=DataFormat.EXCEL,
        name="Microsoft Excel",
        file_extensions=[".xlsx", ".xls"],
        mime_types=["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        supports_compression=False,
        supports_streaming=False,
        options={
            "sheet_name": "Sheet name to read/write",
        },
    )

    xml_info = DataFormatInfo(
        format=DataFormat.XML,
        name="Extensible Markup Language",
        file_extensions=[".xml"],
        mime_types=["application/xml", "text/xml"],
        supports_compression=True,
        supports_streaming=True,
        options={
            "root_element": "Root element name",
            "record_element": "Record element name",
        },
    )

    return FormatsResponse(
        import_formats=[csv_info, json_info, excel_info, xml_info],
        export_formats=[csv_info, json_info, excel_info, xml_info],
        compression_types=["none", "gzip", "zip", "bzip2"],
    )


__all__ = ["data_transfer_router"]
