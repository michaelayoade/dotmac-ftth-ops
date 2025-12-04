"""
Communication tracking database models.

SQLAlchemy models for tracking email, webhook, and SMS communications.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base, TenantMixin, TimestampMixin


class CommunicationType(str, Enum):
    """Types of communications."""

    EMAIL = "email"
    WEBHOOK = "webhook"
    SMS = "sms"
    PUSH = "push"


class CommunicationStatus(str, Enum):
    """Communication delivery status."""

    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BOUNCED = "bounced"
    CANCELLED = "cancelled"


class CommunicationLog(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Communication activity log for tracking all sent communications."""

    __tablename__ = "communication_logs"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # Communication details
    type: Mapped[CommunicationType] = mapped_column(
        SQLEnum(CommunicationType), nullable=False, index=True
    )
    recipient: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    sender: Mapped[str | None] = mapped_column(String(500), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Content
    text_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    html_body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status tracking
    status: Mapped[CommunicationStatus] = mapped_column(
        SQLEnum(CommunicationStatus),
        default=CommunicationStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Delivery tracking
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Provider information
    provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Template tracking
    template_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    template_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Associated entities
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    job_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )
    headers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    def __repr__(self) -> str:
        return f"<CommunicationLog(id={self.id}, type={self.type}, recipient={self.recipient}, status={self.status})>"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "type": self.type.value if self.type else None,
            "recipient": self.recipient,
            "sender": self.sender,
            "subject": self.subject,
            "status": self.status.value if self.status else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "failed_at": self.failed_at.isoformat() if self.failed_at else None,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "provider": self.provider,
            "template_name": self.template_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "metadata": self.metadata_,
        }


class CommunicationTemplate(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Email and SMS templates for communications."""

    __tablename__ = "communication_templates"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # Template identification
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[CommunicationType] = mapped_column(
        SQLEnum(CommunicationType), default=CommunicationType.EMAIL, nullable=False
    )

    # Template content
    subject_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    html_template: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Template variables and validation
    variables: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    required_variables: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Usage tracking
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def __repr__(self) -> str:
        return f"<CommunicationTemplate(id={self.id}, name={self.name}, type={self.type})>"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "type": self.type.value if self.type else None,
            "subject_template": self.subject_template,
            "text_template": self.text_template,
            "html_template": self.html_template,
            "variables": self.variables or [],
            "required_variables": self.required_variables or [],
            "is_active": self.is_active,
            "is_default": self.is_default,
            "usage_count": self.usage_count,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class CommunicationStats(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Aggregated communication statistics."""

    __tablename__ = "communication_stats"

    # Primary key - using date as primary key for daily stats
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # Statistics date
    stats_date: Mapped[datetime] = mapped_column(nullable=False, index=True)

    # Communication type
    type: Mapped[CommunicationType] = mapped_column(
        SQLEnum(CommunicationType), nullable=False, index=True
    )

    # Counters
    total_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_delivered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_bounced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_pending: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Performance metrics
    avg_delivery_time_seconds: Mapped[float | None] = mapped_column(nullable=True)

    # Metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def __repr__(self) -> str:
        return f"<CommunicationStats(id={self.id}, date={self.stats_date}, type={self.type})>"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "stats_date": self.stats_date.isoformat() if self.stats_date else None,
            "type": self.type.value if self.type else None,
            "sent": self.total_sent,
            "delivered": self.total_delivered,
            "failed": self.total_failed,
            "bounced": self.total_bounced,
            "pending": self.total_pending,
            "avg_delivery_time": self.avg_delivery_time_seconds,
            "metadata": self.metadata_,
        }


class BulkJobMetadata(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Stored metadata for bulk communication jobs and task linkage."""

    __tablename__ = "communication_bulk_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )
    job_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    template_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "task_id": self.task_id,
            "template_id": self.template_id,
            "recipient_count": self.recipient_count,
            "status": self.status,
            "metadata": self.metadata_,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "tenant_id": self.tenant_id,
        }


class ExitSurveyResponse(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Exit survey responses from churned customers.

    Tracks customer feedback collected during churn to help improve
    retention and product development.
    """

    __tablename__ = "exit_survey_responses"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # Survey identification
    survey_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    # Customer information
    customer_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    customer_email: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Churn details
    churned_at: Mapped[datetime | None] = mapped_column(nullable=True, index=True)
    previous_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subscriptions_canceled: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Survey responses
    primary_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detailed_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    satisfaction_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-10 scale
    would_recommend: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    would_return: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Product/Service specific feedback
    feature_requests: Mapped[str | None] = mapped_column(Text, nullable=True)
    pricing_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Response tracking
    responded_at: Mapped[datetime | None] = mapped_column(nullable=True, index=True)
    survey_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    response_time_hours: Mapped[float | None] = mapped_column(nullable=True)

    # Email tracking
    communication_log_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Additional structured data
    survey_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ExitSurveyResponse(id={self.id}, customer_id={self.customer_id}, responded={bool(self.responded_at)})>"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "survey_token": self.survey_token,
            "customer_id": self.customer_id,
            "customer_email": self.customer_email,
            "churned_at": self.churned_at.isoformat() if self.churned_at else None,
            "previous_status": self.previous_status,
            "subscriptions_canceled": self.subscriptions_canceled,
            "primary_reason": self.primary_reason,
            "detailed_feedback": self.detailed_feedback,
            "satisfaction_score": self.satisfaction_score,
            "would_recommend": self.would_recommend,
            "would_return": self.would_return,
            "feature_requests": self.feature_requests,
            "pricing_feedback": self.pricing_feedback,
            "support_feedback": self.support_feedback,
            "responded_at": self.responded_at.isoformat() if self.responded_at else None,
            "survey_sent_at": self.survey_sent_at.isoformat() if self.survey_sent_at else None,
            "response_time_hours": self.response_time_hours,
            "survey_data": self.survey_data or {},
            "metadata": self.metadata_,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
