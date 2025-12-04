"""Data transfer API router."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_admin
from dotmac.platform.database import get_async_session as get_db

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
from .repository import TransferJobRepository

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
    request: ImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo | None = Depends(require_admin),
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

        # Create database record for job
        job_id = uuid4()
        repo = TransferJobRepository(db)

        await repo.create_job(
            job_id=job_id,
            name=f"Import from {request.source_type.value}",
            job_type=TransferType.IMPORT,
            tenant_id=tenant_id or "unknown",
            config={
                "source_type": request.source_type.value,
                "format": request.format.value,
                "batch_size": request.batch_size,
            },
            metadata={"user_id": user_id or "unknown"},
            import_source=request.source_type.value,
            source_path=request.source_path,
        )

        # Queue background task for actual import processing
        from .tasks import process_import_job

        process_import_job.delay(
            job_id=str(job_id),
            import_request=request.model_dump(),
            tenant_id=tenant_id,
            user_id=user_id,
        )

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
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo | None = Depends(require_admin),
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

        # Create database record for job
        job_id = uuid4()
        repo = TransferJobRepository(db)

        await repo.create_job(
            job_id=job_id,
            name=f"Export to {request.target_type.value}",
            job_type=TransferType.EXPORT,
            tenant_id=tenant_id or "unknown",
            config={
                "target_type": request.target_type.value,
                "format": request.format.value,
                "compression": request.compression.value,
                "batch_size": request.batch_size,
            },
            metadata={"user_id": user_id or "unknown"},
            export_target=request.target_type.value,
            target_path=request.target_path,
        )

        # Queue background task for actual export processing
        from .tasks import process_export_job

        process_export_job.delay(
            job_id=str(job_id),
            export_request=request.model_dump(),
            tenant_id=tenant_id,
            user_id=user_id,
        )

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
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo | None = Depends(require_admin),
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

        # Get job from database
        repo = TransferJobRepository(db)
        job = await repo.get_job(job_uuid, tenant_id or "unknown")

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        # Convert to response model
        return TransferJobResponse(
            job_id=job.id,
            name=job.name,
            type=TransferType(job.job_type),
            status=TransferStatus(job.status),
            progress=job.progress_percentage,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            records_processed=job.processed_records,
            records_failed=job.failed_records,
            records_total=job.total_records if job.total_records > 0 else None,
            error_message=job.error_message,
            metadata=job.config,
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
    db: AsyncSession = Depends(get_db),
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

        # Get jobs from database
        repo = TransferJobRepository(db)
        offset = (page - 1) * page_size

        jobs = await repo.list_jobs(
            tenant_id=tenant_id or "unknown",
            job_type=type,
            status=job_status,
            limit=page_size,
            offset=offset,
        )

        total = await repo.count_jobs(
            tenant_id=tenant_id or "unknown",
            job_type=type,
            status=job_status,
        )

        # Convert to response models
        job_responses = [
            TransferJobResponse(
                job_id=job.id,
                name=job.name,
                type=TransferType(job.job_type),
                status=TransferStatus(job.status),
                progress=job.progress_percentage,
                created_at=job.created_at,
                started_at=job.started_at,
                completed_at=job.completed_at,
                records_processed=job.processed_records,
                records_failed=job.failed_records,
                records_total=job.total_records if job.total_records > 0 else None,
                error_message=job.error_message,
                metadata=job.config,
            )
            for job in jobs
        ]

        return TransferJobListResponse(
            jobs=job_responses,
            total=total,
            page=page,
            page_size=page_size,
            has_more=(offset + page_size) < total,
        )
    except Exception as e:
        logger.exception("Error listing jobs", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list jobs",
        )


@data_transfer_router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo | None = Depends(require_admin),
) -> dict[str, Any]:
    """Cancel a data transfer job."""
    try:
        user_id, tenant_id = _safe_user_context(current_user)
        logger.info(
            "data_transfer.job.cancel.request",
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

        # Cancel job in database
        repo = TransferJobRepository(db)
        success = await repo.cancel_job(job_uuid, tenant_id or "unknown")

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found or cannot be cancelled",
            )

        return {
            "message": f"Job {job_id} cancelled successfully",
            "job_id": job_id,
            "cancelled_at": datetime.now(UTC).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error cancelling job", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel job",
        )


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
