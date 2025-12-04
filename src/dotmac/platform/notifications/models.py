"""
Notification Models.

Database models for user notifications and preferences.
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, String, Text, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base, SoftDeleteMixin, TenantMixin, TimestampMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

    BaseModel = DeclarativeBase
else:
    BaseModel = Base


class NotificationType(str, Enum):
    """Types of notifications."""

    # Service lifecycle
    SUBSCRIBER_PROVISIONED = "subscriber_provisioned"
    SUBSCRIBER_DEPROVISIONED = "subscriber_deprovisioned"
    SUBSCRIBER_SUSPENDED = "subscriber_suspended"
    SUBSCRIBER_REACTIVATED = "subscriber_reactivated"
    SERVICE_ACTIVATED = "service_activated"
    SERVICE_FAILED = "service_failed"

    # Network events
    SERVICE_OUTAGE = "service_outage"
    SERVICE_RESTORED = "service_restored"
    BANDWIDTH_LIMIT_REACHED = "bandwidth_limit_reached"
    CONNECTION_QUALITY_DEGRADED = "connection_quality_degraded"

    # Fault/Alarm events
    ALARM = "alarm"

    # Billing events
    INVOICE_GENERATED = "invoice_generated"
    INVOICE_DUE = "invoice_due"
    INVOICE_OVERDUE = "invoice_overdue"
    PAYMENT_RECEIVED = "payment_received"
    PAYMENT_FAILED = "payment_failed"
    SUBSCRIPTION_RENEWED = "subscription_renewed"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"

    # Dunning events
    DUNNING_REMINDER = "dunning_reminder"
    DUNNING_SUSPENSION_WARNING = "dunning_suspension_warning"
    DUNNING_FINAL_NOTICE = "dunning_final_notice"

    # CRM events
    LEAD_ASSIGNED = "lead_assigned"
    QUOTE_SENT = "quote_sent"
    QUOTE_ACCEPTED = "quote_accepted"
    QUOTE_REJECTED = "quote_rejected"
    SITE_SURVEY_SCHEDULED = "site_survey_scheduled"
    SITE_SURVEY_COMPLETED = "site_survey_completed"

    # Ticketing events
    TICKET_CREATED = "ticket_created"
    TICKET_ASSIGNED = "ticket_assigned"
    TICKET_UPDATED = "ticket_updated"
    TICKET_RESOLVED = "ticket_resolved"
    TICKET_CLOSED = "ticket_closed"
    TICKET_REOPENED = "ticket_reopened"

    # System events
    PASSWORD_RESET = "password_reset"
    ACCOUNT_LOCKED = "account_locked"
    TWO_FACTOR_ENABLED = "two_factor_enabled"
    API_KEY_EXPIRING = "api_key_expiring"
    SYSTEM_ALERT = "system_alert"

    # Custom/Generic
    SYSTEM_ANNOUNCEMENT = "system_announcement"
    CUSTOM = "custom"


class NotificationPriority(str, Enum):
    """Notification priority levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationChannel(str, Enum):
    """Delivery channels for notifications."""

    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WEBHOOK = "webhook"


class Notification(BaseModel, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """User notifications for in-app and multi-channel delivery."""

    __tablename__ = "notifications"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False
    )

    # Recipient
    user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False, index=True)

    # Notification details
    type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType, name="notificationtype"),
        nullable=False,
        index=True,
    )
    priority: Mapped[NotificationPriority] = mapped_column(
        SQLEnum(NotificationPriority, name="notificationpriority"),
        default=NotificationPriority.MEDIUM,
        nullable=False,
        index=True,
    )

    # Content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    action_label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Related entities
    related_entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    related_entity_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Status tracking
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Multi-channel delivery tracking
    channels: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    sms_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sms_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    push_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    push_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Additional metadata (renamed to avoid SQLAlchemy reserved name)
    notification_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, type={self.type}, user_id={self.user_id}, is_read={self.is_read})>"


class NotificationPreference(BaseModel, TimestampMixin, TenantMixin):
    """User preferences for notification delivery."""

    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_notification_pref_tenant_user"),
    )

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False
    )

    # User
    user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False, index=True)

    # Global preferences
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Quiet hours
    quiet_hours_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    quiet_hours_start: Mapped[str | None] = mapped_column(String(5), nullable=True)  # Format: HH:MM
    quiet_hours_end: Mapped[str | None] = mapped_column(String(5), nullable=True)  # Format: HH:MM
    quiet_hours_timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Per-type preferences (JSON structure)
    # Example: {"subscriber_provisioned": {"email": true, "sms": false, "push": true}}
    type_preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Priority filtering
    minimum_priority: Mapped[NotificationPriority] = mapped_column(
        SQLEnum(NotificationPriority, name="notificationpriority"),
        default=NotificationPriority.LOW,
        nullable=False,
    )

    # Digest settings
    email_digest_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_digest_frequency: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # daily, weekly

    def __repr__(self) -> str:
        return f"<NotificationPreference(id={self.id}, user_id={self.user_id}, enabled={self.enabled})>"


class NotificationTemplate(BaseModel, TimestampMixin, TenantMixin):
    """Templates for notification content generation."""

    __tablename__ = "notification_templates"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False
    )

    # Template identification
    type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType, name="notificationtype"),
        nullable=False,
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # In-app notification template
    title_template: Mapped[str] = mapped_column(String(500), nullable=False)
    message_template: Mapped[str] = mapped_column(Text, nullable=False)
    action_url_template: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    action_label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Email template (references communication_templates)
    email_template_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # SMS template
    sms_template: Mapped[str | None] = mapped_column(String(160), nullable=True)

    # Push notification template
    push_title_template: Mapped[str | None] = mapped_column(String(100), nullable=True)
    push_body_template: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Default settings
    default_priority: Mapped[NotificationPriority] = mapped_column(
        SQLEnum(NotificationPriority, name="notificationpriority"),
        default=NotificationPriority.MEDIUM,
        nullable=False,
    )
    default_channels: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Variables
    required_variables: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    def __repr__(self) -> str:
        return f"<NotificationTemplate(id={self.id}, type={self.type}, name={self.name})>"
