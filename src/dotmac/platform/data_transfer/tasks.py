"""
Celery tasks for background data export/import processing.

Handles long-running data transfer operations with progress tracking
and webhook notifications.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from celery import Task

from dotmac.platform.core.tasks import app
from dotmac.platform.database import get_async_session as get_db
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

from .core import TransferStatus
from .models import ExportRequest, ImportRequest
from .repository import TransferJobRepository

logger = structlog.get_logger(__name__)


async def _update_job_status(
    job_id: str,
    status: TransferStatus,
    **kwargs: Any,
) -> None:
    """Update job status in database."""
    db = await anext(get_db())
    try:
        repo = TransferJobRepository(db)
        await repo.update_job_status(
            UUID(job_id),
            status,
            **kwargs,
        )
    finally:
        await db.close()


@app.task(bind=True, max_retries=3)  # type: ignore[misc]
def process_export_job(
    self: Task,
    job_id: str,
    export_request: dict[str, Any],
    tenant_id: str | None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Process a data export job in the background.

    This task performs the actual export operation asynchronously,
    allowing the API to return immediately while the work continues.

    Args:
        job_id: Unique job identifier
        export_request: Export request parameters
        tenant_id: Tenant context
        user_id: User who initiated the export

    Returns:
        Export result with statistics
    """
    logger.info(
        "data_transfer.export.started",
        job_id=job_id,
        tenant_id=tenant_id,
        user_id=user_id,
    )

    # Update status to RUNNING
    asyncio.run(
        _update_job_status(
            job_id,
            TransferStatus.RUNNING,
            started_at=datetime.now(UTC),
            celery_task_id=self.request.id,
        )
    )

    try:
        # Parse request
        request = ExportRequest(**export_request)

        # Simulate export processing
        # In production, this would:
        # 1. Query database for records to export
        # 2. Stream records through exporters
        # 3. Upload to target destination
        # 4. Track progress in real-time

        result = asyncio.run(
            _perform_export(
                job_id=job_id,
                request=request,
                tenant_id=tenant_id,
                user_id=user_id,
            )
        )

        # Update status to COMPLETED
        asyncio.run(
            _update_job_status(
                job_id,
                TransferStatus.COMPLETED,
                completed_at=datetime.now(UTC),
                records_processed=result["records_processed"],
            )
        )

        # Publish completion webhook
        asyncio.run(
            _publish_export_webhook(
                job_id=job_id,
                request=request,
                result=result,
                tenant_id=tenant_id,
                user_id=user_id,
                success=True,
            )
        )

        logger.info(
            "data_transfer.export.completed",
            job_id=job_id,
            records=result["records_processed"],
        )

        return result

    except Exception as e:
        logger.error(
            "data_transfer.export.failed",
            job_id=job_id,
            error=str(e),
        )

        # Update status to FAILED
        asyncio.run(
            _update_job_status(
                job_id,
                TransferStatus.FAILED,
                completed_at=datetime.now(UTC),
                error_message=str(e),
            )
        )

        # Publish failure webhook
        asyncio.run(
            _publish_export_webhook(
                job_id=job_id,
                request=ExportRequest(**export_request),
                result={"error": str(e)},
                tenant_id=tenant_id,
                user_id=user_id,
                success=False,
            )
        )

        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))


@app.task(bind=True, max_retries=3)  # type: ignore[misc]
def process_import_job(
    self: Task,
    job_id: str,
    import_request: dict[str, Any],
    tenant_id: str | None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Process a data import job in the background.

    This task performs the actual import operation asynchronously,
    allowing the API to return immediately while the work continues.

    Args:
        job_id: Unique job identifier
        import_request: Import request parameters
        tenant_id: Tenant context
        user_id: User who initiated the import

    Returns:
        Import result with statistics
    """
    logger.info(
        "data_transfer.import.started",
        job_id=job_id,
        tenant_id=tenant_id,
        user_id=user_id,
    )

    # Update status to RUNNING
    asyncio.run(
        _update_job_status(
            job_id,
            TransferStatus.RUNNING,
            started_at=datetime.now(UTC),
            celery_task_id=self.request.id,
        )
    )

    try:
        # Parse request
        request = ImportRequest(**import_request)

        # Simulate import processing
        # In production, this would:
        # 1. Download/fetch source data
        # 2. Validate and transform records
        # 3. Insert into database in batches
        # 4. Track progress in real-time

        result = asyncio.run(
            _perform_import(
                job_id=job_id,
                request=request,
                tenant_id=tenant_id,
                user_id=user_id,
            )
        )

        # Update status to COMPLETED
        asyncio.run(
            _update_job_status(
                job_id,
                TransferStatus.COMPLETED,
                completed_at=datetime.now(UTC),
                records_processed=result["records_processed"],
                records_failed=result.get("records_failed", 0),
            )
        )

        # Publish completion webhook
        asyncio.run(
            _publish_import_webhook(
                job_id=job_id,
                request=request,
                result=result,
                tenant_id=tenant_id,
                user_id=user_id,
                success=True,
            )
        )

        logger.info(
            "data_transfer.import.completed",
            job_id=job_id,
            records=result["records_processed"],
        )

        return result

    except Exception as e:
        logger.error(
            "data_transfer.import.failed",
            job_id=job_id,
            error=str(e),
        )

        # Update status to FAILED
        asyncio.run(
            _update_job_status(
                job_id,
                TransferStatus.FAILED,
                completed_at=datetime.now(UTC),
                error_message=str(e),
            )
        )

        # Publish failure webhook
        asyncio.run(
            _publish_import_webhook(
                job_id=job_id,
                request=ImportRequest(**import_request),
                result={"error": str(e)},
                tenant_id=tenant_id,
                user_id=user_id,
                success=False,
            )
        )

        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))


# ========================================
# Helper Functions
# ========================================


async def _perform_export(
    job_id: str,
    request: ExportRequest,
    tenant_id: str | None,
    user_id: str | None,
) -> dict[str, Any]:
    """
    Perform the actual export operation.

    In production, this would use the exporters module to:
    - Query data from database
    - Transform to requested format
    - Write to target destination
    - Track progress
    """
    # Simulate work with progress updates
    import asyncio

    logger.info("Simulating export processing...")

    # Simulate processing in batches
    total_records = 1000  # Mock data
    batch_size = request.batch_size
    records_processed = 0

    for i in range(0, total_records, batch_size):
        # Simulate batch processing delay
        await asyncio.sleep(0.1)

        batch_count = min(batch_size, total_records - i)
        records_processed += batch_count

        # Update progress
        progress = (records_processed / total_records) * 100
        await _update_job_status(
            job_id,
            TransferStatus.RUNNING,
            progress_percentage=progress,
            processed_records=records_processed,
        )

        logger.debug(
            "Export progress",
            job_id=job_id,
            progress=f"{progress:.1f}%",
        )

    return {
        "records_processed": records_processed,
        "format": request.format.value,
        "target_type": request.target_type.value,
        "target_path": request.target_path,
        "file_size_bytes": records_processed * 100,  # Mock size
    }


async def _perform_import(
    job_id: str,
    request: ImportRequest,
    tenant_id: str | None,
    user_id: str | None,
) -> dict[str, Any]:
    """
    Perform the actual import operation.

    In production, this would use the importers module to:
    - Fetch data from source
    - Validate records
    - Insert into database
    - Track progress
    """
    # Simulate work with progress updates
    import asyncio

    logger.info("Simulating import processing...")

    # Simulate processing in batches
    total_records = 500  # Mock data
    batch_size = request.batch_size
    records_processed = 0
    records_failed = 0

    for i in range(0, total_records, batch_size):
        # Simulate batch processing delay
        await asyncio.sleep(0.1)

        batch_count = min(batch_size, total_records - i)

        # Simulate some failures if skip_errors is enabled
        if request.skip_errors and i % 100 == 0:
            records_failed += 1
            batch_count -= 1

        records_processed += batch_count

        # Update progress
        progress = ((records_processed + records_failed) / total_records) * 100
        await _update_job_status(
            job_id,
            TransferStatus.RUNNING,
            progress_percentage=progress,
            processed_records=records_processed,
            failed_records=records_failed,
        )

        logger.debug(
            "Import progress",
            job_id=job_id,
            progress=f"{progress:.1f}%",
        )

    return {
        "records_processed": records_processed,
        "records_failed": records_failed,
        "format": request.format.value,
        "source_type": request.source_type.value,
        "source_path": request.source_path,
    }


async def _publish_export_webhook(
    job_id: str,
    request: ExportRequest,
    result: dict[str, Any],
    tenant_id: str | None,
    user_id: str | None,
    success: bool,
) -> None:
    """Publish export completion/failure webhook."""
    db = await anext(get_db())

    try:
        event_type = WebhookEvent.EXPORT_COMPLETED if success else WebhookEvent.EXPORT_FAILED

        event_data = {
            "job_id": job_id,
            "export_type": request.target_type.value,
            "format": request.format.value,
            "compression": request.compression.value,
            "target_path": request.target_path,
            "initiated_by": user_id or "system",
        }

        if success:
            event_data.update(
                {
                    "records_exported": result.get("records_processed", 0),
                    "file_size_bytes": result.get("file_size_bytes", 0),
                    "completed_at": datetime.now(UTC).isoformat(),
                }
            )
        else:
            event_data.update(
                {
                    "error": result.get("error", "Unknown error"),
                    "failed_at": datetime.now(UTC).isoformat(),
                }
            )

        if tenant_id:
            await get_event_bus().publish(
                event_type=event_type.value,
                event_data=event_data,
                tenant_id=tenant_id,
                db=db,
            )
        else:
            logger.debug("Skipping export webhook publish (no tenant_id)", job_id=job_id)

        logger.info(
            "Published export webhook",
            event_type=event_type.value,
            job_id=job_id,
        )

    except Exception as e:
        logger.warning(
            "Failed to publish export webhook",
            error=str(e),
            job_id=job_id,
        )
    finally:
        await db.close()


async def _publish_import_webhook(
    job_id: str,
    request: ImportRequest,
    result: dict[str, Any],
    tenant_id: str | None,
    user_id: str | None,
    success: bool,
) -> None:
    """Publish import completion/failure webhook."""
    db = await anext(get_db())

    try:
        event_type = WebhookEvent.IMPORT_COMPLETED if success else WebhookEvent.IMPORT_FAILED

        event_data = {
            "job_id": job_id,
            "import_type": request.source_type.value,
            "format": request.format.value,
            "source_path": request.source_path,
            "initiated_by": user_id or "system",
        }

        if success:
            event_data.update(
                {
                    "records_imported": result.get("records_processed", 0),
                    "records_failed": result.get("records_failed", 0),
                    "completed_at": datetime.now(UTC).isoformat(),
                }
            )
        else:
            event_data.update(
                {
                    "error": result.get("error", "Unknown error"),
                    "failed_at": datetime.now(UTC).isoformat(),
                }
            )

        if tenant_id:
            await get_event_bus().publish(
                event_type=event_type.value,
                event_data=event_data,
                tenant_id=tenant_id,
                db=db,
            )
        else:
            logger.debug("Skipping import webhook publish (no tenant_id)", job_id=job_id)

        logger.info(
            "Published import webhook",
            event_type=event_type.value,
            job_id=job_id,
        )

    except Exception as e:
        logger.warning(
            "Failed to publish import webhook",
            error=str(e),
            job_id=job_id,
        )
    finally:
        await db.close()


__all__ = [
    "process_export_job",
    "process_import_job",
]
