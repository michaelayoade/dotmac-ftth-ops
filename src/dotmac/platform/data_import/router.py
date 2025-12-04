"""
API endpoints for data import operations.

Provides REST API for uploading files and managing import jobs.
"""

import io
import json
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import require_admin
from dotmac.platform.billing.dependencies import get_tenant_id
from dotmac.platform.data_import import (
    DataImportService,
    ImportJobStatus,
    ImportJobType,
)
from dotmac.platform.data_import.schemas import (
    ImportFailureResponse,
    ImportJobListResponse,
    ImportJobResponse,
    ImportStatusResponse,
)
from dotmac.platform.database import get_async_session as get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data-import", tags=["Data Import"])


@router.post("/upload/{entity_type}")
async def upload_import_file(
    entity_type: str,
    file: UploadFile = File(...),
    batch_size: int = Form(default=100),
    dry_run: bool = Form(default=False),
    use_async: bool = Form(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
    tenant_id: str = Depends(get_tenant_id),
) -> ImportJobResponse:
    """
    Upload a file for import.

    Args:
        entity_type: Type of entities to import (customers, invoices, etc.)
        file: CSV or JSON file to import
        batch_size: Number of records to process at once
        dry_run: If true, validate without persisting
        use_async: If true, process in background using Celery

    Returns:
        Import job details and initial statistics
    """
    # Validate entity type
    try:
        job_type = ImportJobType(entity_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid entity type. Must be one of: {[t.value for t in ImportJobType]}",
        )

    # Validate file type
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    file_ext = file.filename.lower().split(".")[-1]
    if file_ext not in ["csv", "json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be CSV or JSON format",
        )

    # Read file content
    content = await file.read()
    file_content = io.BytesIO(content)

    # Create service
    service = DataImportService(db)

    try:
        # Process based on entity type and file format
        if job_type == ImportJobType.CUSTOMERS:
            if file_ext == "csv":
                result = await service.import_customers_csv(
                    file_content=file_content,
                    tenant_id=tenant_id,
                    user_id=str(current_user.user_id),
                    batch_size=batch_size,
                    dry_run=dry_run,
                    use_celery=use_async,
                )
            else:  # JSON
                json_data = json.loads(content.decode("utf-8"))
                result = await service.import_customers_json(
                    json_data=json_data,
                    tenant_id=tenant_id,
                    user_id=str(current_user.user_id),
                    batch_size=batch_size,
                    dry_run=dry_run,
                    use_celery=use_async,
                )

        elif job_type == ImportJobType.INVOICES:
            if file_ext == "csv":
                result = await service.import_invoices_csv(
                    file_content=file_content,
                    tenant_id=tenant_id,
                    user_id=str(current_user.user_id),
                    batch_size=batch_size,
                    dry_run=dry_run,
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invoice JSON import not yet implemented",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Import for {entity_type} not yet implemented",
            )

        # Get the created job
        job = await service.get_import_job(result.job_id, tenant_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve import job",
            )

        response: ImportJobResponse = ImportJobResponse.from_model(job, result)
        return response

    except Exception as exc:
        logger.exception(
            "data_import.upload_failed entity_type=%s tenant_id=%s",
            entity_type,
            tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Import failed. Please try again later.",
        ) from exc


@router.get("/jobs")
async def list_import_jobs(
    status: ImportJobStatus | None = Query(None),
    job_type: ImportJobType | None = Query(None),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
    tenant_id: str = Depends(get_tenant_id),
) -> ImportJobListResponse:
    """
    List import jobs with optional filtering.

    Args:
        status: Filter by job status
        job_type: Filter by job type
        limit: Maximum number of jobs to return
        offset: Number of jobs to skip

    Returns:
        List of import jobs
    """
    service = DataImportService(db)

    jobs = await service.list_import_jobs(
        tenant_id=tenant_id,
        status=status,
        job_type=job_type,
        limit=limit,
        offset=offset,
    )

    return ImportJobListResponse(
        jobs=[ImportJobResponse.from_model(job) for job in jobs],
        total=len(jobs),
        limit=limit,
        offset=offset,
    )


@router.get("/jobs/{job_id}")
async def get_import_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
    tenant_id: str = Depends(get_tenant_id),
) -> ImportJobResponse:
    """
    Get details of a specific import job.

    Args:
        job_id: Import job UUID

    Returns:
        Import job details
    """
    service = DataImportService(db)

    job = await service.get_import_job(str(job_id), tenant_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import job not found",
        )

    response: ImportJobResponse = ImportJobResponse.from_model(job)
    return response


@router.get("/jobs/{job_id}/status")
async def get_import_job_status(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
    tenant_id: str = Depends(get_tenant_id),
) -> ImportStatusResponse:
    """
    Get the current status of an import job.

    Args:
        job_id: Import job UUID

    Returns:
        Current status and progress
    """
    service = DataImportService(db)

    job = await service.get_import_job(str(job_id), tenant_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import job not found",
        )

    # Check Celery task status if applicable
    task_status = None
    if job.celery_task_id:
        from celery.result import AsyncResult

        from dotmac.platform.core.tasks import app

        task = AsyncResult(job.celery_task_id, app=app)
        if task.state == "PENDING":
            task_status = "queued"
        elif task.state == "PROGRESS":
            task_status = "processing"
        elif task.state == "SUCCESS":
            task_status = "completed"
        elif task.state == "FAILURE":
            task_status = "failed"

    return ImportStatusResponse(
        job_id=str(job.id),
        status=job.status,
        progress_percentage=job.progress_percentage,
        total_records=job.total_records,
        processed_records=job.processed_records,
        successful_records=job.successful_records,
        failed_records=job.failed_records,
        celery_task_status=task_status,
        error_message=job.error_message,
    )


@router.get("/jobs/{job_id}/failures")
async def get_import_failures(
    job_id: UUID,
    limit: int = Query(default=100, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
    tenant_id: str = Depends(get_tenant_id),
) -> list[ImportFailureResponse]:
    """
    Get failure details for an import job.

    Args:
        job_id: Import job UUID
        limit: Maximum number of failures to return

    Returns:
        List of import failures with details
    """
    service = DataImportService(db)

    failures = await service.get_import_failures(
        job_id=str(job_id),
        tenant_id=tenant_id,
        limit=limit,
    )

    return [
        ImportFailureResponse(
            row_number=f.row_number,
            error_type=f.error_type,
            error_message=f.error_message,
            row_data=f.row_data,
            field_errors=f.field_errors,
        )
        for f in failures
    ]


@router.get("/jobs/{job_id}/export-failures")
async def export_import_failures(
    job_id: UUID,
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
    tenant_id: str = Depends(get_tenant_id),
) -> StreamingResponse:
    """
    Export failed records for reprocessing.

    Args:
        job_id: Import job UUID
        format: Export format (csv or json)

    Returns:
        File download with failed records
    """
    service = DataImportService(db)

    failures = await service.get_import_failures(
        job_id=str(job_id),
        tenant_id=tenant_id,
        limit=10000,  # Reasonable limit for export
    )

    if not failures:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No failures found for this import job",
        )

    if format == "json":
        # Export as JSON
        export_data = [
            {
                "row_number": f.row_number,
                "error": f.error_message,
                **f.row_data,
            }
            for f in failures
        ]

        content = json.dumps(export_data, indent=2).encode("utf-8")
        media_type = "application/json"
        filename = f"import_failures_{job_id}.json"
    else:
        # Export as CSV
        import csv
        from io import StringIO

        output = StringIO()

        if failures:
            # Get all unique field names
            fieldnames_set: set[str] = set()
            for f in failures:
                fieldnames_set.update(f.row_data.keys())
            fieldnames: list[str] = ["row_number", "error"] + sorted(fieldnames_set)

            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()

            for f in failures:
                row = {
                    "row_number": f.row_number,
                    "error": f.error_message,
                    **f.row_data,
                }
                writer.writerow(row)

        content = output.getvalue().encode("utf-8")
        media_type = "text/csv"
        filename = f"import_failures_{job_id}.csv"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.delete("/jobs/{job_id}")
async def cancel_import_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(require_admin),
    tenant_id: str = Depends(get_tenant_id),
) -> dict[str, Any]:
    """
    Cancel a running import job.

    Args:
        job_id: Import job UUID

    Returns:
        Cancellation status
    """
    service = DataImportService(db)

    job = await service.get_import_job(str(job_id), tenant_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import job not found",
        )

    if job.status not in [ImportJobStatus.PENDING, ImportJobStatus.IN_PROGRESS]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job in {job.status.value} state",
        )

    # Cancel Celery task if applicable
    if job.celery_task_id:
        from celery.result import AsyncResult

        from dotmac.platform.core.tasks import app

        task = AsyncResult(job.celery_task_id, app=app)
        task.revoke(terminate=True)

    # Update job status
    job.status = ImportJobStatus.CANCELLED
    await db.commit()

    return {"status": "cancelled", "job_id": str(job_id)}
