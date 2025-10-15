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
