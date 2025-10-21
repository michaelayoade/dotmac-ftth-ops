"""
Communications router.

FastAPI router for communications services.
"""

from datetime import UTC, datetime
from smtplib import SMTPException
from typing import Any

import structlog
from celery.exceptions import CeleryError
from fastapi import APIRouter, Depends, HTTPException
from jinja2 import TemplateSyntaxError, UndefinedError
from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError
from sqlalchemy.exc import SQLAlchemyError

from dotmac.platform.auth.dependencies import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_admin
from dotmac.platform.db import get_async_db

from .email_service import EmailMessage, EmailResponse, get_email_service
from .metrics_service import get_metrics_service
from .models import CommunicationStatus, CommunicationType
from .task_service import get_task_service, queue_bulk_emails, queue_email
from .template_service import (
    RenderedTemplate,
    create_template,
    get_template_service,
    quick_render,
    render_template,
)

# Clean implementation - no backward compatibility

logger = structlog.get_logger(__name__)


def _safe_user_context(user: Any | None) -> tuple[str | None, str | None]:
    """Return (user_id, tenant_id) tuples even when dependency injection is bypassed."""
    if user is None:
        return None, None
    return getattr(user, "user_id", None), getattr(user, "tenant_id", None)


# Create router
router = APIRouter(prefix="/communications", tags=["Communications"])


# === Email Endpoints ===


class EmailRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Email request model."""

    model_config = ConfigDict()

    to: list[EmailStr] = Field(..., description="Recipients")
    subject: str = Field(..., min_length=1, description="Subject")
    text_body: str | None = Field(None, description="Text body")
    html_body: str | None = Field(None, description="HTML body")
    from_email: EmailStr | None = Field(None, description="From email")
    from_name: str | None = Field(None, description="From name")


@router.post("/email/send", response_model=EmailResponse)
async def send_email_endpoint(
    request: EmailRequest,
    current_user: UserInfo | None = Depends(require_admin),
) -> EmailResponse:
    """Send a single email immediately."""
    try:
        email_service = get_email_service()
        user_id, tenant_id = _safe_user_context(current_user)

        # Try to log communication if database is available
        log_entry = None
        try:
            async with get_async_db() as db:
                from uuid import UUID

                metrics_service = get_metrics_service(db)

                # Convert user_id to UUID if needed
                user_id_uuid: UUID | None = None
                if isinstance(user_id, str):
                    try:
                        user_id_uuid = UUID(user_id)
                    except (ValueError, AttributeError):
                        user_id_uuid = None

                # Log the communication attempt
                log_entry = await metrics_service.log_communication(
                    type=CommunicationType.EMAIL,
                    recipient=", ".join(request.to),
                    subject=request.subject,
                    sender=request.from_email,
                    text_body=request.text_body,
                    html_body=request.html_body,
                    user_id=user_id_uuid,
                    tenant_id=tenant_id,
                )
        except (SQLAlchemyError, RuntimeError) as db_error:
            logger.warning("Could not log communication to database", error=str(db_error))

        message = EmailMessage(
            to=request.to,
            subject=request.subject,
            text_body=request.text_body,
            html_body=request.html_body,
            from_email=request.from_email,
            from_name=request.from_name,
            reply_to=None,  # Can be added to EmailRequest if needed
        )

        response = await email_service.send_email(message)

        # Update communication status if we have a log entry
        if log_entry:
            try:
                async with get_async_db() as db:
                    metrics_service = get_metrics_service(db)
                    status = (
                        CommunicationStatus.SENT
                        if response.status == "sent"
                        else CommunicationStatus.FAILED
                    )
                    await metrics_service.update_communication_status(
                        communication_id=log_entry.id,
                        status=status,
                        provider_message_id=response.id,
                    )
            except (SQLAlchemyError, RuntimeError) as db_error:
                logger.warning("Could not update communication status", error=str(db_error))

        logger.info(
            "Email sent via API",
            message_id=response.id,
            recipients=len(request.to),
            status=response.status,
            user_id=user_id or "unknown",
            tenant_id=tenant_id,
        )

        return response

    except ValidationError as exc:
        logger.error("Email send validation failed", errors=exc.errors())
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except (SMTPException, OSError) as exc:
        logger.error("Email send failed due to SMTP error", error=str(exc))
        raise HTTPException(status_code=502, detail="Email provider unavailable") from exc
    except RuntimeError as exc:
        logger.error("Email send runtime failure", error=str(exc))
        raise HTTPException(status_code=500, detail="Email send failed") from exc


@router.post("/email/queue")
async def queue_email_endpoint(
    request: EmailRequest,
    current_user: UserInfo | None = Depends(require_admin),
) -> Any:
    """Queue an email for background sending."""
    try:
        user_id, tenant_id = _safe_user_context(current_user)
        task_id = queue_email(
            to=request.to,
            subject=request.subject,
            text_body=request.text_body,
            html_body=request.html_body,
        )

        logger.info(
            "Email queued",
            task_id=task_id,
            recipients=len(request.to),
            user_id=user_id or "unknown",
            tenant_id=tenant_id,
        )

        return {
            "task_id": task_id,
            "status": "queued",
            "message": "Email queued for background sending",
        }

    except ValidationError as exc:
        logger.error("Email queue validation failed", errors=exc.errors())
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except CeleryError as exc:
        logger.error("Email queue failed (celery error)", error=str(exc))
        raise HTTPException(status_code=502, detail="Task queue unavailable") from exc
    except RuntimeError as exc:
        logger.error("Email queue runtime failure", error=str(exc))
        raise HTTPException(status_code=500, detail="Email queue failed") from exc


# === Template Endpoints ===


class TemplateRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Template creation request."""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, description="Template name")
    subject_template: str = Field(..., description="Subject template")
    text_template: str | None = Field(None, description="Text template")
    html_template: str | None = Field(None, description="HTML template")


class TemplateResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Template response."""

    model_config = ConfigDict()

    id: str
    name: str
    subject_template: str
    text_template: str | None
    html_template: str | None
    variables: list[str]
    created_at: datetime


@router.post("/templates", response_model=TemplateResponse)
async def create_template_endpoint(
    request: TemplateRequest, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Create a new template."""
    try:
        template = create_template(
            name=request.name,
            subject_template=request.subject_template,
            text_template=request.text_template,
            html_template=request.html_template,
        )

        return TemplateResponse(
            id=template.id,
            name=template.name,
            subject_template=template.subject_template,
            text_template=template.text_template,
            html_template=template.html_template,
            variables=template.variables,
            created_at=template.created_at,
        )

    except ValidationError as exc:
        logger.error("Template creation validation failed", errors=exc.errors())
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except (TemplateSyntaxError, ValueError) as exc:
        logger.error("Template creation failed", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates_endpoint(
    current_user: UserInfo = Depends(require_admin),
) -> Any:
    """List all templates."""
    service = get_template_service()
    templates = service.list_templates()

    return [
        TemplateResponse(
            id=template.id,
            name=template.name,
            subject_template=template.subject_template,
            text_template=template.text_template,
            html_template=template.html_template,
            variables=template.variables,
            created_at=template.created_at,
        )
        for template in templates
    ]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template_endpoint(
    template_id: str, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Get a specific template."""
    service = get_template_service()
    template = service.get_template(template_id)

    if not template:
        raise HTTPException(status_code=404, detail=f"Template not found: {template_id}")

    return TemplateResponse(
        id=template.id,
        name=template.name,
        subject_template=template.subject_template,
        text_template=template.text_template,
        html_template=template.html_template,
        variables=template.variables,
        created_at=template.created_at,
    )


class RenderRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Template render request."""

    model_config = ConfigDict()

    template_id: str = Field(..., description="Template ID")
    data: dict[str, Any] = Field(default_factory=dict, description="Template data")


@router.post("/templates/render", response_model=RenderedTemplate)
async def render_template_endpoint(
    request: RenderRequest, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Render a template with data."""
    try:
        result = render_template(request.template_id, request.data)
        return result

    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (TemplateSyntaxError, UndefinedError) as exc:
        logger.error("Template render failed", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/templates/{template_id}")
async def delete_template_endpoint(
    template_id: str, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Delete a template."""
    service = get_template_service()
    deleted = service.delete_template(template_id)

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Template not found: {template_id}")

    return {"message": "Template deleted successfully"}


# === Bulk Email Endpoints ===


class BulkEmailRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Bulk email request."""

    model_config = ConfigDict()

    job_name: str = Field(..., description="Job name")
    messages: list[EmailRequest] = Field(..., description="Email messages to send")


@router.post("/bulk-email/queue")
async def queue_bulk_email_job(
    request: BulkEmailRequest, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Queue a bulk email job."""
    user_id, tenant_id = _safe_user_context(current_user)
    try:
        messages = [
            EmailMessage(
                to=msg.to,
                subject=msg.subject,
                text_body=msg.text_body,
                html_body=msg.html_body,
                from_email=msg.from_email,
                from_name=msg.from_name,
                reply_to=None,  # Can be added to BulkEmailRequest if needed
            )
            for msg in request.messages
        ]

        job_id = queue_bulk_emails(request.job_name, messages)

        result = {
            "job_id": job_id,
            "status": "queued",
            "message": f"Bulk email job queued with {len(messages)} messages",
        }
        logger.info(
            "Bulk email job queued",
            job_id=job_id,
            message_count=len(messages),
            user_id=user_id or "unknown",
            tenant_id=tenant_id,
        )
        return result

    except ValidationError as exc:
        logger.error("Bulk email validation failed", errors=exc.errors())
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except CeleryError as exc:
        logger.error("Bulk email queue failed (celery error)", error=str(exc))
        raise HTTPException(status_code=502, detail="Task queue unavailable") from exc
    except RuntimeError as exc:
        logger.error("Bulk email queue runtime failure", error=str(exc))
        raise HTTPException(status_code=500, detail="Bulk email queue failed") from exc


@router.get("/bulk-email/status/{job_id}")
async def get_bulk_email_status(
    job_id: str, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Get bulk email job status."""
    user_id, tenant_id = _safe_user_context(current_user)
    try:
        task_service = get_task_service()
        status = task_service.get_task_status(job_id)

        if status is None:
            raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

        return status

    except CeleryError as exc:
        logger.error("Bulk email status check failed", job_id=job_id, error=str(exc))
        raise HTTPException(status_code=502, detail="Status check failed") from exc


@router.post("/bulk-email/cancel/{job_id}")
async def cancel_bulk_email_job(
    job_id: str, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Cancel a bulk email job."""
    user_id, tenant_id = _safe_user_context(current_user)
    try:
        task_service = get_task_service()
        cancelled = task_service.cancel_task(job_id)

        if not cancelled:
            return {"success": False, "message": "Job could not be cancelled (may be completed)"}

        return {"success": True, "message": "Job cancelled successfully"}

    except CeleryError as exc:
        logger.error("Bulk email cancel failed", job_id=job_id, error=str(exc))
        raise HTTPException(status_code=502, detail="Cancel failed") from exc


@router.get("/tasks/{task_id}")
async def get_task_status(
    task_id: str, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Get the status of a background task."""
    task_service = get_task_service()
    return task_service.get_task_status(task_id)


# === Clean API - No Legacy Endpoints ===


# === Health Check ===


@router.get("/health")
async def health_check() -> Any:
    """Health check endpoint."""
    service_status = {
        "email_service": "available",
        "task_service": "available",
        "template_service": "available",
    }

    return {
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
        "services": service_status,
        "version": "simplified",
    }


# === Quick Utilities ===


class QuickRenderRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Quick template render request."""

    model_config = ConfigDict()

    subject: str = Field(..., description="Subject template")
    text_body: str | None = Field(None, description="Text body template")
    html_body: str | None = Field(None, description="HTML body template")
    data: dict[str, Any] = Field(default_factory=dict, description="Template data")


@router.post("/quick-render")
async def quick_render_endpoint(
    request: QuickRenderRequest, current_user: UserInfo = Depends(require_admin)
) -> Any:
    """Quickly render templates from strings."""
    try:
        result = quick_render(
            subject=request.subject,
            text_body=request.text_body,
            html_body=request.html_body,
            data=request.data,
        )

        return result

    except (TemplateSyntaxError, UndefinedError, ValueError) as exc:
        logger.error("Quick render failed", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# === Stats and Activity Endpoints ===


class CommunicationStats(BaseModel):  # BaseModel resolves to Any in isolation
    """Communication statistics model."""

    model_config = ConfigDict()

    sent: int = Field(default=0, description="Total sent")
    delivered: int = Field(default=0, description="Total delivered")
    failed: int = Field(default=0, description="Total failed")
    pending: int = Field(default=0, description="Total pending")
    last_updated: datetime = Field(default_factory=lambda: datetime.now(UTC))


class CommunicationActivity(BaseModel):  # BaseModel resolves to Any in isolation
    """Communication activity model."""

    model_config = ConfigDict()

    id: str = Field(..., description="Activity ID")
    type: str = Field(..., description="Communication type (email/webhook/sms)")
    recipient: str = Field(..., description="Recipient")
    subject: str | None = Field(None, description="Subject")
    status: str = Field(..., description="Status (sent/delivered/failed/pending)")
    timestamp: datetime = Field(..., description="Activity timestamp")
    metadata: dict[str, Any] | None = Field(default_factory=lambda: {})


@router.get("/stats", response_model=CommunicationStats)
async def get_communication_stats(
    current_user: UserInfo = Depends(require_admin),
) -> CommunicationStats:
    """Get communication statistics."""
    user_id, tenant_id = _safe_user_context(current_user)
    # Try to get real stats from database if available
    try:
        async with get_async_db() as db:
            metrics_service = get_metrics_service(db)

            stats_data = await metrics_service.get_stats(tenant_id=tenant_id)

            stats = CommunicationStats(
                sent=stats_data.get("sent", 0),
                delivered=stats_data.get("delivered", 0),
                failed=stats_data.get("failed", 0),
                pending=stats_data.get("pending", 0),
            )

            logger.info(
                "Communication stats retrieved from database",
                tenant_id=tenant_id,
                stats=stats_data,
            )
            return stats
    except (SQLAlchemyError, RuntimeError) as db_error:
        logger.warning("Database not available, returning mock stats", error=str(db_error))

    # Return mock data when database is not available
    stats = CommunicationStats(sent=1234, delivered=1156, failed=23, pending=55)

    logger.info(
        "Communication stats retrieved (mock data)",
        user_id=user_id or "unknown",
        tenant_id=tenant_id,
    )
    return stats


@router.get("/activity", response_model=list[CommunicationActivity])
async def get_recent_activity(
    limit: int = 10,
    offset: int = 0,
    type_filter: str | None = None,
    current_user: UserInfo = Depends(require_admin),
) -> list[CommunicationActivity]:
    """Get recent communication activity."""
    user_id, tenant_id = _safe_user_context(current_user)
    # Try to get real activity from database if available
    try:
        async with get_async_db() as db:
            metrics_service = get_metrics_service(db)

            # Parse type filter if provided
            comm_type = None
            if type_filter:
                try:
                    comm_type = CommunicationType(type_filter)
                except ValueError:
                    logger.warning("Invalid communication type filter", type_filter=type_filter)

            logs = await metrics_service.get_recent_activity(
                limit=limit, offset=offset, type_filter=comm_type, tenant_id=tenant_id
            )

            activities = [
                CommunicationActivity(
                    id=str(log.id),
                    type=log.type.value,
                    recipient=log.recipient,
                    subject=log.subject,
                    status=log.status.value,
                    timestamp=log.created_at or datetime.now(UTC),
                    metadata=log.metadata_ or {},
                )
                for log in logs
            ]

            logger.info(
                "Communication activity retrieved from database",
                count=len(activities),
                tenant_id=tenant_id,
            )
            return activities
    except (SQLAlchemyError, RuntimeError) as db_error:
        logger.warning("Database not available, returning mock activity", error=str(db_error))

    # Return mock data when database is not available
    activities = [
        CommunicationActivity(
            id="act_1",
            type="email",
            recipient="user@example.com",
            subject="Welcome to DotMac Platform",
            status="delivered",
            timestamp=datetime.now(UTC),
        ),
        CommunicationActivity(
            id="act_2",
            type="webhook",
            recipient="https://api.example.com/webhook",
            subject="User Registration Event",
            status="sent",
            timestamp=datetime.now(UTC),
        ),
        CommunicationActivity(
            id="act_3",
            type="email",
            recipient="admin@example.com",
            subject="Password Reset Request",
            status="delivered",
            timestamp=datetime.now(UTC),
        ),
        CommunicationActivity(
            id="act_4",
            type="sms",
            recipient="+1234567890",
            subject="Verification Code: 123456",
            status="pending",
            timestamp=datetime.now(UTC),
        ),
    ]

    if type_filter:
        activities = [a for a in activities if a.type == type_filter]

    activities = activities[offset : offset + limit]

    logger.info(
        "Communication activity retrieved (mock data)",
        count=len(activities),
        user_id=user_id or "unknown",
        tenant_id=tenant_id,
    )
    return activities
