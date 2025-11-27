"""
Celery tasks for background data import processing.

Handles chunked processing of large import files with progress tracking.
"""

import csv
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import structlog
from celery import Task, current_task
from celery.schedules import crontab
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from dotmac.platform.core.tasks import app, idempotent_task
from dotmac.platform.customer_management.mappers import CustomerImportSchema, CustomerMapper
from dotmac.platform.customer_management.service import CustomerService
from dotmac.platform.data_import.models import ImportJob, ImportJobStatus, ImportJobType
from dotmac.platform.db import get_async_database_url

logger = structlog.get_logger(__name__)

# Chunk sizes for processing
DEFAULT_CHUNK_SIZE = 500
MAX_CHUNK_SIZE = 5000


def get_async_session() -> AsyncSession:
    """Create async database session for Celery tasks."""
    engine = create_async_engine(
        get_async_database_url(),
        echo=False,
    )
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return async_session_maker()


@app.task(bind=True, max_retries=3)  # type: ignore[misc]
def process_import_job(
    self: Task,
    job_id: str,
    file_path: str,
    job_type: str,
    tenant_id: str,
    user_id: str | None = None,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Process a data import job in the background.

    Args:
        job_id: Import job UUID
        file_path: Path to the uploaded file
        job_type: Type of import (customers, invoices, etc.)
        tenant_id: Tenant identifier
        user_id: User who initiated the import
        config: Import configuration options

    Returns:
        Import result with statistics
    """
    import asyncio

    logger.info(f"Starting import job {job_id} for {job_type}")

    # Update task ID in job
    asyncio.run(_update_job_task_id(job_id, self.request.id))

    try:
        # Process based on job type
        if job_type == ImportJobType.CUSTOMERS.value:
            result = asyncio.run(
                _process_customer_import(job_id, file_path, tenant_id, user_id, config)
            )
        elif job_type == ImportJobType.INVOICES.value:
            result = asyncio.run(
                _process_invoice_import(job_id, file_path, tenant_id, user_id, config)
            )
        elif job_type == ImportJobType.SUBSCRIPTIONS.value:
            result = asyncio.run(
                _process_subscription_import(job_id, file_path, tenant_id, user_id, config)
            )
        elif job_type == ImportJobType.PAYMENTS.value:
            result = asyncio.run(
                _process_payment_import(job_id, file_path, tenant_id, user_id, config)
            )
        else:
            raise ValueError(f"Unsupported job type: {job_type}")

        logger.info(f"Import job {job_id} completed successfully")
        return result

    except Exception as e:
        logger.error(f"Import job {job_id} failed: {e}")
        asyncio.run(_mark_job_failed(job_id, str(e)))
        raise self.retry(exc=e, countdown=60)


@app.task(bind=True)  # type: ignore[misc]
def process_import_chunk(
    self: Task,
    job_id: str,
    chunk_data: list[dict[str, Any]],
    chunk_number: int,
    total_chunks: int,
    job_type: str,
    tenant_id: str,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Process a single chunk of import data.

    This task is called by the main import job to process data in parallel.

    Args:
        job_id: Import job UUID
        chunk_data: List of records to process
        chunk_number: Current chunk number
        total_chunks: Total number of chunks
        job_type: Type of import
        tenant_id: Tenant identifier
        config: Import configuration

    Returns:
        Processing statistics for the chunk
    """
    import asyncio

    logger.info(f"Processing chunk {chunk_number}/{total_chunks} for job {job_id}")

    # Update progress
    progress = (chunk_number / total_chunks) * 100
    current_task.update_state(
        state="PROGRESS",
        meta={
            "current": chunk_number,
            "total": total_chunks,
            "progress": progress,
            "status": f"Processing chunk {chunk_number} of {total_chunks}",
        },
    )

    try:
        result = asyncio.run(_process_chunk_data(job_id, chunk_data, job_type, tenant_id, config))

        logger.info(
            f"Chunk {chunk_number} processed: "
            f"{result['successful']} successful, {result['failed']} failed"
        )

        return result

    except Exception as e:
        logger.error(f"Chunk {chunk_number} processing failed: {e}")
        raise


async def _update_job_task_id(job_id: str, task_id: str) -> None:
    """Update the Celery task ID in the import job."""
    async with get_async_session() as session:
        job = await session.get(ImportJob, UUID(job_id))
        if job:
            job.celery_task_id = task_id
            await session.commit()


async def _mark_job_failed(job_id: str, error_message: str) -> None:
    """Mark an import job as failed."""
    async with get_async_session() as session:
        job = await session.get(ImportJob, UUID(job_id))
        if job:
            job.status = ImportJobStatus.FAILED
            job.error_message = error_message
            job.completed_at = datetime.now(UTC)
            await session.commit()


async def _process_customer_import(
    job_id: str,
    file_path: str,
    tenant_id: str,
    user_id: str | None,
    config: dict[str, Any] | None,
) -> dict[str, Any]:
    """Process customer import job."""
    async with get_async_session() as session:
        # Get the job
        job = await session.get(ImportJob, UUID(job_id))
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Update status
        job.status = ImportJobStatus.IN_PROGRESS
        job.started_at = datetime.now(UTC)
        await session.commit()

        # Read file and process
        file_ext = Path(file_path).suffix.lower()
        chunk_size = (config or {}).get("chunk_size", DEFAULT_CHUNK_SIZE)

        try:
            if file_ext == ".csv":
                result = await _process_csv_in_chunks(
                    session, job, file_path, tenant_id, user_id, ImportJobType.CUSTOMERS, chunk_size
                )
            elif file_ext == ".json":
                result = await _process_json_in_chunks(
                    session, job, file_path, tenant_id, user_id, ImportJobType.CUSTOMERS, chunk_size
                )
            else:
                raise ValueError(f"Unsupported file format: {file_ext}")

            # Update job status
            if result["failed_records"] == 0:
                job.status = ImportJobStatus.COMPLETED
            else:
                job.status = ImportJobStatus.PARTIALLY_COMPLETED

            job.completed_at = datetime.now(UTC)
            job.successful_records = result["successful_records"]
            job.failed_records = result["failed_records"]
            job.processed_records = result["total_records"]
            job.summary = result

            await session.commit()
            return result

        except Exception as e:
            job.status = ImportJobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(UTC)
            await session.commit()
            raise


async def _process_csv_in_chunks(
    session: AsyncSession,
    job: ImportJob,
    file_path: str,
    tenant_id: str,
    user_id: str | None,
    job_type: ImportJobType,
    chunk_size: int,
) -> dict[str, Any]:
    """Process CSV file in chunks."""

    total_records = 0
    successful_records = 0
    failed_records = 0
    errors = []

    with open(file_path, encoding="utf-8") as f:
        csv_reader = csv.DictReader(f)

        chunk = []
        chunk_number = 0

        for row_num, row in enumerate(csv_reader, start=1):
            total_records += 1
            chunk.append({"row_number": row_num, "data": row})

            if len(chunk) >= chunk_size:
                chunk_number += 1
                logger.info(f"Processing chunk {chunk_number} with {len(chunk)} records")

                # Process chunk
                result = await _process_data_chunk(session, job, chunk, job_type, tenant_id)

                successful_records += result["successful"]
                failed_records += result["failed"]
                errors.extend(result["errors"])

                # Update job progress
                job.processed_records = total_records
                job.successful_records = successful_records
                job.failed_records = failed_records
                await session.commit()

                # Report progress if in Celery task
                if current_task:
                    current_task.update_state(
                        state="PROGRESS",
                        meta={
                            "total_records": total_records,
                            "processed": total_records,
                            "successful": successful_records,
                            "failed": failed_records,
                            "status": f"Processed {total_records} records",
                        },
                    )

                chunk = []

        # Process remaining records
        if chunk:
            chunk_number += 1
            result = await _process_data_chunk(session, job, chunk, job_type, tenant_id)
            successful_records += result["successful"]
            failed_records += result["failed"]
            errors.extend(result["errors"])

    job.total_records = total_records

    return {
        "job_id": str(job.id),
        "total_records": total_records,
        "successful_records": successful_records,
        "failed_records": failed_records,
        "errors": errors[:100],  # Limit errors
        "success_rate": (successful_records / total_records * 100) if total_records > 0 else 0,
    }


async def _process_json_in_chunks(
    session: AsyncSession,
    job: ImportJob,
    file_path: str,
    tenant_id: str,
    user_id: str | None,
    job_type: ImportJobType,
    chunk_size: int,
) -> dict[str, Any]:
    """Process JSON file in chunks."""
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("JSON file must contain an array of records")

    total_records = len(data)
    successful_records = 0
    failed_records = 0
    errors = []

    job.total_records = total_records
    await session.commit()

    # Process in chunks
    for i in range(0, total_records, chunk_size):
        chunk_data = []
        for row_num, record in enumerate(data[i : i + chunk_size], start=i + 1):
            chunk_data.append({"row_number": row_num, "data": record})

        result = await _process_data_chunk(session, job, chunk_data, job_type, tenant_id)

        successful_records += result["successful"]
        failed_records += result["failed"]
        errors.extend(result["errors"])

        # Update progress
        job.processed_records = min(i + chunk_size, total_records)
        job.successful_records = successful_records
        job.failed_records = failed_records
        await session.commit()

        # Report progress
        if current_task:
            progress = (job.processed_records / total_records) * 100
            current_task.update_state(
                state="PROGRESS",
                meta={
                    "total_records": total_records,
                    "processed": job.processed_records,
                    "successful": successful_records,
                    "failed": failed_records,
                    "progress": progress,
                    "status": f"Processed {job.processed_records}/{total_records} records",
                },
            )

    return {
        "job_id": str(job.id),
        "total_records": total_records,
        "successful_records": successful_records,
        "failed_records": failed_records,
        "errors": errors[:100],
        "success_rate": (successful_records / total_records * 100) if total_records > 0 else 0,
    }


async def _process_data_chunk(
    session: AsyncSession,
    job: ImportJob,
    chunk_data: list[dict[str, Any]],
    job_type: ImportJobType,
    tenant_id: str,
) -> dict[str, Any]:
    """Process a chunk of data records."""

    if job_type == ImportJobType.CUSTOMERS:
        return await _process_customer_chunk(
            session=session,
            job=job,
            chunk_data=chunk_data,
            tenant_id=tenant_id,
        )
    if job_type == ImportJobType.INVOICES:
        return await _process_invoice_chunk(
            session=session,
            job=job,
            chunk_data=chunk_data,
            tenant_id=tenant_id,
        )

    # Add other job types as needed
    raise ValueError(f"Unsupported job type: {job_type}")


async def _process_customer_chunk(
    *,
    session: AsyncSession,
    job: ImportJob,
    chunk_data: list[dict[str, Any]],
    tenant_id: str,
) -> dict[str, Any]:
    """Process customer import records."""

    service = CustomerService(session)
    successful = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    for item in chunk_data:
        row_number = item["row_number"]
        row_data = item["data"]

        try:
            validated_data = CustomerMapper.validate_import_row(row_data, row_number)

            if isinstance(validated_data, CustomerImportSchema):
                model_data = CustomerMapper.from_import_to_model(
                    validated_data, tenant_id, generate_customer_number=True
                )
                await service.create_customer(**model_data)
                successful += 1
            else:
                failed += 1
                errors.append(validated_data)
                await _record_failure(
                    session,
                    job,
                    row_number,
                    "validation",
                    validated_data.get("error", "Validation failed"),
                    row_data,
                    tenant_id,
                )
        except Exception as e:
            failed += 1
            error_msg = str(e)
            errors.append({"row_number": row_number, "error": error_msg, "data": row_data})
            await _record_failure(
                session, job, row_number, "creation", error_msg, row_data, tenant_id
            )

    return {"successful": successful, "failed": failed, "errors": errors}


async def _process_invoice_chunk(
    *,
    session: AsyncSession,
    job: ImportJob,
    chunk_data: list[dict[str, Any]],
    tenant_id: str,
) -> dict[str, Any]:
    """Process invoice import records."""

    from dotmac.platform.billing.invoicing.mappers import InvoiceImportSchema, InvoiceMapper
    from dotmac.platform.billing.invoicing.service import InvoiceService

    service = InvoiceService(session)
    successful = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    for item in chunk_data:
        row_number = item["row_number"]
        row_data = item["data"]

        try:
            validated_data = InvoiceMapper.validate_import_row(row_data, row_number)

            if isinstance(validated_data, InvoiceImportSchema):
                model_data = InvoiceMapper.from_import_to_model(
                    validated_data, tenant_id, generate_invoice_number=True
                )
                await service.create_invoice(**model_data)
                successful += 1
            else:
                failed += 1
                errors.append(validated_data)
                await _record_failure(
                    session,
                    job,
                    row_number,
                    "validation",
                    validated_data.get("error", "Validation failed"),
                    row_data,
                    tenant_id,
                )
        except Exception as e:
            failed += 1
            error_msg = str(e)
            errors.append({"row_number": row_number, "error": error_msg, "data": row_data})
            await _record_failure(
                session, job, row_number, "creation", error_msg, row_data, tenant_id
            )

    return {"successful": successful, "failed": failed, "errors": errors}


async def _record_failure(
    session: AsyncSession,
    job: ImportJob,
    row_number: int,
    error_type: str,
    error_message: str,
    row_data: dict[str, Any],
    tenant_id: str,
) -> None:
    """Record an import failure."""
    from dotmac.platform.data_import.models import ImportFailure

    failure = ImportFailure(
        job_id=job.id,
        row_number=row_number,
        error_type=error_type,
        error_message=error_message,
        row_data=row_data,
        tenant_id=tenant_id,
    )
    session.add(failure)
    await session.commit()


async def _process_invoice_import(
    job_id: str,
    file_path: str,
    tenant_id: str,
    user_id: str | None,
    config: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Process invoice import job.

    Expected CSV/JSON format:
    - customer_id: UUID or customer_number (required)
    - invoice_number: string (optional, auto-generated if missing)
    - amount: decimal (required)
    - currency: 3-letter code (default: USD)
    - status: draft|pending|paid|cancelled|overdue (default: draft)
    - due_date: ISO date string (optional)
    - issue_date: ISO date string (optional)
    - paid_date: ISO date string (optional)
    - description: text (optional)
    - subtotal: decimal (optional)
    - tax_amount: decimal (optional)
    - discount_amount: decimal (optional)
    - purchase_order: string (optional)
    - notes: text (optional)
    """
    from ..db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        # Get job
        job = await session.get(ImportJob, job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Get file format
        file_format = "csv"
        if file_path.endswith(".json"):
            file_format = "json"

        # Get chunk size from config
        chunk_size = (config or {}).get("chunk_size", 100)

        # Process based on file format
        if file_format == "csv":
            result = await _process_csv_in_chunks(
                session, job, file_path, tenant_id, user_id, ImportJobType.INVOICES, chunk_size
            )
        else:
            result = await _process_json_in_chunks(
                session, job, file_path, tenant_id, user_id, ImportJobType.INVOICES, chunk_size
            )

        return result


async def _process_subscription_import(
    job_id: str,
    file_path: str,
    tenant_id: str,
    user_id: str | None,
    config: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Process subscription import job.

    NOT YET IMPLEMENTED - Placeholder for future feature.

    Implementation tracked in GitHub issue #TBD.

    When implementing, follow the customer import pattern:

    1. Create SubscriptionImportSchema in billing/subscriptions/mappers.py
       - Required fields: customer_id, plan_id
       - Optional fields: status, billing_cycle, start_date, end_date, trial_end_date, quantity

    2. Create SubscriptionMapper with methods:
       - validate_import_row(row_data: dict[str, Any], row_number: int) -> SubscriptionImportSchema | dict
       - from_import_to_model(schema: SubscriptionImportSchema, tenant_id: str) -> dict[str, Any]

    3. Update _process_data_chunk() to handle ImportJobType.SUBSCRIPTIONS case:
       ```python
       elif job_type == ImportJobType.SUBSCRIPTIONS:
           from dotmac.platform.billing.subscriptions.mappers import SubscriptionMapper
           from dotmac.platform.billing.subscriptions.service import SubscriptionService
           service = SubscriptionService(session)
           mapper = SubscriptionMapper
       ```

    4. Add tests in tests/billing/subscriptions/test_subscription_import.py

    Expected CSV/JSON format:
        customer_id: UUID or customer_number (required)
        plan_id: UUID or plan code (required)
        status: active|trialing|past_due|cancelled|paused (default: active)
        billing_cycle: monthly|quarterly|yearly|custom (default: monthly)
        start_date: ISO date string (optional, defaults to now)
        end_date: ISO date string (optional)
        trial_end_date: ISO date string (optional)
        quantity: integer (default: 1)
        amount: decimal (optional, uses plan amount if not provided)

    Example CSV:
        customer_id,plan_id,status,billing_cycle,quantity,start_date
        123e4567-e89b-12d3-a456-426614174000,plan_basic_monthly,active,monthly,1,2025-01-01
        987fcdeb-51a2-43d1-b234-567890abcdef,plan_pro_yearly,trialing,yearly,1,2025-01-15
    """
    raise NotImplementedError(
        "Subscription import requires implementing _process_subscription_import(). "
        "Follow the customer import pattern in customer_management/mappers.py"
    )


async def _process_payment_import(
    job_id: str,
    file_path: str,
    tenant_id: str,
    user_id: str | None,
    config: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Process payment import job.

    NOT YET IMPLEMENTED - Placeholder for future feature.

    Implementation tracked in GitHub issue #TBD.

    When implementing, follow the customer import pattern:

    1. Create PaymentImportSchema in billing/payments/mappers.py
       - Required fields: customer_id, amount, currency, payment_method
       - Optional fields: invoice_id, status, payment_date, transaction_id, reference

    2. Create PaymentMapper with methods:
       - validate_import_row(row_data: dict[str, Any], row_number: int) -> PaymentImportSchema | dict
       - from_import_to_model(schema: PaymentImportSchema, tenant_id: str) -> dict[str, Any]

    3. Update _process_data_chunk() to handle ImportJobType.PAYMENTS case:
       ```python
       elif job_type == ImportJobType.PAYMENTS:
           from dotmac.platform.billing.payments.mappers import PaymentMapper
           from dotmac.platform.billing.payments.service import PaymentService
           service = PaymentService(session)
           mapper = PaymentMapper
       ```

    4. Add tests in tests/billing/payments/test_payment_import.py

    Expected CSV/JSON format:
        customer_id: UUID or customer_number (required)
        amount: decimal (required)
        currency: 3-letter code (default: USD)
        payment_method: card|bank_transfer|cash|check (required)
        invoice_id: UUID (optional, links payment to invoice)
        status: pending|completed|failed|refunded (default: completed)
        payment_date: ISO date string (optional, defaults to now)
        transaction_id: string (optional, external payment system ID)
        reference: string (optional, customer reference number)

    Example CSV:
        customer_id,amount,currency,payment_method,status,payment_date,transaction_id
        123e4567-e89b-12d3-a456-426614174000,99.99,USD,card,completed,2025-01-15,txn_abc123
        987fcdeb-51a2-43d1-b234-567890abcdef,249.00,USD,bank_transfer,completed,2025-01-16,txn_xyz789
    """
    raise NotImplementedError(
        "Payment import requires implementing _process_payment_import(). "
        "Follow the customer import pattern in customer_management/mappers.py"
    )


async def _process_chunk_data(
    job_id: str,
    chunk_data: list[dict[str, Any]],
    job_type: str,
    tenant_id: str,
    config: dict[str, Any] | None,
) -> dict[str, Any]:
    """Process a chunk of data for any job type."""
    async with get_async_session() as session:
        job = await session.get(ImportJob, UUID(job_id))
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job_type_enum = ImportJobType(job_type)
        result = await _process_data_chunk(session, job, chunk_data, job_type_enum, tenant_id)

        return result


@app.task  # type: ignore[misc]  # Celery decorator is untyped
@idempotent_task(ttl=300)
def check_import_health() -> dict[str, Any]:
    """
    Periodic health check for import system.

    Returns statistics about running and queued import jobs.
    """
    import asyncio

    async def _check_health() -> Any:
        async with get_async_session() as session:
            from sqlalchemy import func, select

            # Count jobs by status
            result = await session.execute(
                select(ImportJob.status, func.count(ImportJob.id).label("count")).group_by(
                    ImportJob.status
                )
            )

            status_counts = {row.status.value: row.count for row in result}

            # Count recent failures (last hour)
            one_hour_ago = datetime.now(UTC).replace(minute=datetime.now().minute - 60)

            result = await session.execute(
                select(func.count(ImportJob.id))
                .where(ImportJob.status == ImportJobStatus.FAILED)
                .where(ImportJob.completed_at >= one_hour_ago)
            )
            recent_failures = result.scalar() or 0

            return {
                "status_counts": status_counts,
                "recent_failures": recent_failures,
                "timestamp": datetime.now(UTC).isoformat(),
            }

    return asyncio.run(_check_health())


# Register periodic tasks
app.conf.beat_schedule = {
    "check-import-health": {
        "task": "dotmac.platform.data_import.tasks.check_import_health",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
}
