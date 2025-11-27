"""Background task service using Celery with testable async helpers."""

import asyncio
from collections.abc import Callable, Coroutine
from concurrent.futures import Future
from datetime import UTC, datetime
from smtplib import SMTPException
from typing import Any, Protocol, TypeVar
from uuid import uuid4

import structlog
from celery.exceptions import CeleryError
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select

from dotmac.platform.celery_app import celery_app
from dotmac.platform.communications.models import BulkJobMetadata, CommunicationType
from dotmac.platform.db import get_async_session_context

from .email_service import EmailMessage, EmailResponse, get_email_service

logger = structlog.get_logger(__name__)

T = TypeVar("T")


class EmailServiceProtocol(Protocol):
    """Protocol describing the subset of EmailService used by tasks."""

    async def send_email(self, message: EmailMessage) -> EmailResponse:
        """Send an email message."""


class BulkEmailJob(BaseModel):  # BaseModel resolves to Any in isolation
    """Bulk email job model."""

    id: str = Field(default_factory=lambda: f"bulk_{uuid4().hex[:8]}")
    name: str = Field(..., description="Job name")
    messages: list[EmailMessage] = Field(..., description="Email messages to send")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Job metadata")
    tenant_id: str | None = Field(None, description="Tenant scope")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    status: str = Field(default="queued", description="Job status")

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")


class BulkEmailResult(BaseModel):  # BaseModel resolves to Any in isolation
    """Bulk email job result."""

    model_config = ConfigDict()

    job_id: str = Field(..., description="Job ID")
    status: str = Field(..., description="Overall status")
    total_emails: int = Field(..., description="Total emails to send")
    sent_count: int = Field(default=0, description="Successfully sent emails")
    failed_count: int = Field(default=0, description="Failed emails")
    responses: list[EmailResponse] = Field(default_factory=list, description="Individual responses")
    completed_at: datetime | None = Field(None, description="Completion timestamp")
    error_message: str | None = Field(None, description="Error message if failed")


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


def _run_async[T](coro: Coroutine[Any, Any, T]) -> T:
    """Execute an async coroutine from a synchronous Celery task."""

    try:
        return asyncio.run(coro)
    except RuntimeError:
        # Fallback for contexts where an event loop is already running (tests).
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:  # pragma: no cover - defensive
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:  # pragma: no cover - defensive clean-up
                loop.close()

        if loop.is_running():
            future: Future[T] = asyncio.run_coroutine_threadsafe(coro, loop)
            return future.result()
        return loop.run_until_complete(coro)


async def _send_email_async(
    email_service: EmailServiceProtocol, message: EmailMessage
) -> EmailResponse:
    """Send a single email message using the provided service."""

    try:
        response = await email_service.send_email(message)
        if response.status not in {"sent", "failed"}:
            response.status = "sent" if response.status == "success" else "failed"
        return response
    except (
        SMTPException,
        OSError,
        RuntimeError,
        ValueError,
    ) as exc:  # pragma: no cover - defensive log
        logger.error("Email send failed", error=str(exc), subject=message.subject)
        return EmailResponse(
            id=f"error_{uuid4().hex[:8]}",
            status="failed",
            message=f"Task error: {exc}",
            recipients_count=len(message.to),
        )


ProgressCallback = Callable[[int, int, int, int], None] | None


async def _process_bulk_email_job(
    job: BulkEmailJob,
    email_service: EmailServiceProtocol,
    progress_callback: ProgressCallback | None = None,
) -> BulkEmailResult:
    """Send all messages for the supplied bulk job."""

    total = len(job.messages)
    responses: list[EmailResponse] = []
    sent_count = 0
    failed_count = 0

    if progress_callback:
        progress_callback(0, total, sent_count, failed_count)

    for index, message in enumerate(job.messages, start=1):
        # Log to database if available, capturing job_id
        try:
            async with get_async_session_context() as db:
                from dotmac.platform.communications.metrics_service import get_metrics_service

                metrics_service = get_metrics_service(db)
                await metrics_service.log_communication(
                    type=CommunicationType.EMAIL,
                    recipient=",".join([str(a) for a in message.to]),
                    subject=message.subject,
                    sender=message.from_email,
                    text_body=message.text_body,
                    html_body=message.html_body,
                    template_id=job.metadata.get("template_id") if job.metadata else None,
                    user_id=None,
                    job_id=job.id,
                    tenant_id=job.tenant_id,
                    metadata=job.metadata or {},
                )
        except Exception as exc:  # pragma: no cover - best effort logging
            logger.warning("Bulk email log failed", error=str(exc), job_id=job.id)

        response = await _send_email_async(email_service, message)
        responses.append(response)

        if response.status == "sent":
            sent_count += 1
        else:
            failed_count += 1

        if progress_callback:
            progress_callback(index, total, sent_count, failed_count)

    status = "completed" if sent_count else "failed"

    return BulkEmailResult(
        job_id=job.id,
        status=status,
        total_emails=total,
        sent_count=sent_count,
        failed_count=failed_count,
        responses=responses,
        completed_at=datetime.now(UTC),
        error_message=None,
    )


def _send_email_sync(email_service: EmailServiceProtocol, message: EmailMessage) -> EmailResponse:
    """Legacy compatible synchronous shim that reuses the async helper."""

    return _run_async(_send_email_async(email_service, message))


# ---------------------------------------------------------------------------
# Celery task entry points
# ---------------------------------------------------------------------------


@celery_app.task(bind=True, name="send_bulk_email")  # type: ignore[misc]
def send_bulk_email_task(self: Any, job_data: dict[str, Any]) -> dict[str, Any]:
    """Celery task that delegates to the async bulk email processor."""

    try:
        job = BulkEmailJob.model_validate(job_data)

        logger.info(
            "Starting bulk email task",
            job_id=job.id,
            job_name=job.name,
            email_count=len(job.messages),
        )

        def progress(completed: int, total: int, sent: int, failed: int) -> None:
            percent = int((completed / total) * 100) if total else 100
            if completed and (completed % 10 == 0 or completed == total):
                logger.info(
                    "Bulk email progress",
                    job_id=job.id,
                    progress=f"{completed}/{total}",
                    sent=sent,
                    failed=failed,
                )
            self.update_state(
                state="PROGRESS" if completed < total else "SUCCESS",
                meta={
                    "job_id": job.id,
                    "status": "processing" if completed < total else "completed",
                    "progress": percent,
                    "total": total,
                    "sent": sent,
                    "failed": failed,
                },
            )

        email_service = get_email_service()
        result = _run_async(_process_bulk_email_job(job, email_service, progress))

        logger.info(
            "Bulk email task completed",
            job_id=job.id,
            total=result.total_emails,
            sent=result.sent_count,
            failed=result.failed_count,
        )

        return result.model_dump()

    except ValidationError as exc:  # pragma: no cover - defensive fallback
        logger.error("Bulk email task validation failed", error=str(exc))
        return BulkEmailResult(
            job_id=job_data.get("id", "unknown"),
            status="failed",
            total_emails=len(job_data.get("messages", [])),
            error_message=str(exc),
            completed_at=datetime.now(UTC),
        ).model_dump()
    except (SMTPException, OSError, RuntimeError) as exc:  # pragma: no cover - defensive fallback
        logger.error(
            "Bulk email task failed",
            job_id=job_data.get("id", "unknown"),
            error=str(exc),
        )
        return BulkEmailResult(
            job_id=job_data.get("id", "unknown"),
            status="failed",
            total_emails=len(job_data.get("messages", [])),
            error_message=str(exc),
            completed_at=datetime.now(UTC),
        ).model_dump()


@celery_app.task(name="send_single_email")  # type: ignore[misc]
def send_single_email_task(message_data: dict[str, Any]) -> dict[str, Any]:
    """Celery task for a single email."""

    try:
        message = EmailMessage.model_validate(message_data)
        email_service = get_email_service()

        logger.info(
            "Sending single email task",
            subject=message.subject,
            recipients=len(message.to),
        )

        response = _send_email_sync(email_service, message)

        logger.info(
            "Single email task completed",
            message_id=response.id,
            status=response.status,
        )

        return response.model_dump()

    except ValidationError as exc:  # pragma: no cover - defensive fallback
        logger.error("Single email task validation failed", error=str(exc))
        return EmailResponse(
            id=f"error_{uuid4().hex[:8]}",
            status="failed",
            message=f"Task validation failed: {exc}",
            recipients_count=1,
        ).model_dump()
    except (SMTPException, OSError, RuntimeError) as exc:  # pragma: no cover - defensive fallback
        logger.error("Single email task failed", error=str(exc))
        return EmailResponse(
            id=f"error_{uuid4().hex[:8]}",
            status="failed",
            message=f"Task failed: {exc}",
            recipients_count=1,
        ).model_dump()


# ---------------------------------------------------------------------------
# Public service wrapper
# ---------------------------------------------------------------------------


class TaskService:
    """Task service using Celery."""

    def __init__(self) -> None:
        self.celery = celery_app
        logger.info("Task service initialized")

    def send_email_async(self, message: EmailMessage) -> str:
        task = send_single_email_task.delay(message.model_dump())
        logger.info(
            "Email queued for async sending",
            task_id=task.id,
            subject=message.subject,
        )
        return str(task.id)

    def send_bulk_emails_async(
        self, job: BulkEmailJob, *, metadata: dict[str, Any] | None = None
    ) -> str:
        """Queue bulk emails and persist metadata for status lookups."""
        task = send_bulk_email_task.delay(job.model_dump())
        try:

            async def _persist() -> None:
                async with get_async_session_context() as db:
                    meta = BulkJobMetadata(
                        job_id=job.id,
                        task_id=str(task.id),
                        template_id=(metadata or {}).get("template_id"),
                        recipient_count=len(job.messages),
                        status="queued",
                        metadata_=metadata or {},
                    )
                    db.add(meta)
                    await db.commit()

            # Fire and forget persistence
            try:
                import asyncio

                asyncio.get_event_loop().create_task(_persist())
            except Exception:
                _run_async(_persist())
        except Exception as exc:  # pragma: no cover - best effort
            logger.warning("Failed to persist bulk job metadata", error=str(exc))
        logger.info(
            "Bulk email job queued",
            task_id=task.id,
            job_id=job.id,
            email_count=len(job.messages),
        )
        return str(task.id)

    def get_task_status(self, task_id: str) -> dict[str, Any]:
        result = self.celery.AsyncResult(task_id)
        return {
            "task_id": task_id,
            "status": result.status,
            "result": result.result,
            "info": result.info,
        }

    def get_bulk_metadata(self, job_id: str) -> dict[str, Any] | None:
        try:

            async def _fetch() -> dict[str, Any] | None:
                async with get_async_session_context() as db:
                    stmt = select(BulkJobMetadata).where(BulkJobMetadata.job_id == job_id)
                    result = await db.execute(stmt)
                    obj = result.scalar_one_or_none()
                    if obj:
                        return obj.to_dict()
                    return None

            return _run_async(_fetch())
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to fetch bulk metadata", error=str(exc))
            return None

    def cancel_task(self, task_id: str) -> bool:
        try:
            self.celery.control.revoke(task_id, terminate=True)
            logger.info("Task cancelled", task_id=task_id)
            return True
        except CeleryError as exc:  # pragma: no cover - defensive
            logger.error("Failed to cancel task", task_id=task_id, error=str(exc))
            return False


# Global service instance
_task_service: TaskService | None = None


def get_task_service() -> TaskService:
    global _task_service
    if _task_service is None:
        _task_service = TaskService()
    return _task_service


def queue_email(
    to: list[str],
    subject: str,
    text_body: str | None = None,
    html_body: str | None = None,
    from_email: str | None = None,
    from_name: str | None = None,
    reply_to: str | None = None,
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
) -> str:
    """Queue an email for background sending with full email options support.

    Args:
        to: Recipient email addresses
        subject: Email subject
        text_body: Plain text body (optional)
        html_body: HTML body (optional)
        from_email: Sender email address (optional, falls back to service default)
        from_name: Sender display name (optional)
        reply_to: Reply-to email address (optional)
        cc: CC recipients (optional)
        bcc: BCC recipients (optional)

    Returns:
        Task ID for tracking the queued email
    """
    service = get_task_service()
    # EmailStr is a type annotation, not a constructor - just pass strings
    message = EmailMessage(
        to=to,  # Pydantic will validate as EmailStr
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        from_email=from_email,
        from_name=from_name,
        reply_to=reply_to,
        cc=cc or [],
        bcc=bcc or [],
    )
    return service.send_email_async(message)


def queue_bulk_emails(name: str, messages: list[EmailMessage]) -> tuple[str, str]:
    return queue_bulk_emails_with_meta(name, messages, metadata=None)


def queue_bulk_emails_with_meta(
    name: str, messages: list[EmailMessage], metadata: dict[str, Any] | None
) -> tuple[str, str]:
    service = get_task_service()
    job = BulkEmailJob(
        name=name,
        messages=messages,
        metadata=metadata or {},
        tenant_id=(metadata or {}).get("tenant_id"),
    )
    task_id = service.send_bulk_emails_async(job, metadata=metadata)
    return job.id, task_id
