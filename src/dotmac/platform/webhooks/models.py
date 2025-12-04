"""
Webhook database models and schemas.
"""

import secrets
import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import Url as HttpUrl
from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base, TenantMixin, TimestampMixin


class DeliveryStatus(str, Enum):
    """Webhook delivery status."""

    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"
    DISABLED = "disabled"  # Endpoint returned 410 Gone


class WebhookEvent(str, Enum):
    """Standard webhook events across the platform."""

    # Billing events
    INVOICE_CREATED = "invoice.created"
    INVOICE_FINALIZED = "invoice.finalized"
    INVOICE_PAID = "invoice.paid"
    INVOICE_PAYMENT_FAILED = "invoice.payment_failed"
    INVOICE_VOIDED = "invoice.voided"
    PAYMENT_SUCCEEDED = "payment.succeeded"
    PAYMENT_FAILED = "payment.failed"
    PAYMENT_REFUNDED = "payment.refunded"
    SUBSCRIPTION_CREATED = "subscription.created"
    SUBSCRIPTION_UPDATED = "subscription.updated"
    SUBSCRIPTION_CANCELLED = "subscription.cancelled"
    SUBSCRIPTION_RENEWED = "subscription.renewed"
    SUBSCRIPTION_TRIAL_ENDING = "subscription.trial_ending"

    # Credit note events
    CREDIT_NOTE_CREATED = "credit_note.created"
    CREDIT_NOTE_ISSUED = "credit_note.issued"
    CREDIT_NOTE_VOIDED = "credit_note.voided"
    CREDIT_NOTE_APPLIED = "credit_note.applied"

    # Customer events
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_DELETED = "customer.deleted"

    # User events
    USER_REGISTERED = "user.registered"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_LOGIN = "user.login"

    # Communication events
    EMAIL_SENT = "email.sent"
    EMAIL_DELIVERED = "email.delivered"
    EMAIL_BOUNCED = "email.bounced"
    EMAIL_FAILED = "email.failed"
    BULK_EMAIL_COMPLETED = "bulk_email.completed"
    BULK_EMAIL_FAILED = "bulk_email.failed"

    # File storage events
    FILE_UPLOADED = "file.uploaded"
    FILE_DOWNLOADED = "file.downloaded"
    FILE_DELETED = "file.deleted"
    FILE_SCAN_COMPLETED = "file.scan_completed"
    STORAGE_QUOTA_EXCEEDED = "storage.quota_exceeded"

    # Data transfer events
    IMPORT_COMPLETED = "import.completed"
    IMPORT_FAILED = "import.failed"
    EXPORT_COMPLETED = "export.completed"
    EXPORT_FAILED = "export.failed"

    # Analytics events
    METRIC_THRESHOLD_EXCEEDED = "metric.threshold_exceeded"
    REPORT_GENERATED = "report.generated"

    # Audit events
    SECURITY_ALERT = "security.alert"
    COMPLIANCE_VIOLATION = "compliance.violation"

    # Ticketing events
    TICKET_CREATED = "ticket.created"
    TICKET_UPDATED = "ticket.updated"
    TICKET_CLOSED = "ticket.closed"
    TICKET_SLA_BREACH = "ticket.sla_breach"


class WebhookSubscription(Base, TenantMixin, TimestampMixin):  # type: ignore[misc]
    """Webhook endpoint subscription."""

    __tablename__ = "webhook_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Endpoint configuration
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Event filtering
    events: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list
    )  # List of event types to subscribe to

    # Security
    secret: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # For HMAC signature generation

    # Custom headers (e.g., authorization tokens)
    headers: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=False)

    # Delivery configuration
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    retry_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    # Statistics
    success_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_triggered_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_failure_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Custom metadata (renamed from 'metadata' to avoid SQLAlchemy reserved attribute)
    custom_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    def __repr__(self) -> str:
        return f"<WebhookSubscription(id={self.id}, url={self.url}, events={len(self.events)})>"


class WebhookDelivery(Base, TenantMixin, TimestampMixin):  # type: ignore[misc]
    """Webhook delivery attempt log."""

    __tablename__ = "webhook_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("webhook_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Event details
    event_type: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    event_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )  # Idempotency key
    event_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Delivery details
    status: Mapped[DeliveryStatus] = mapped_column(
        String(50), nullable=False, default=DeliveryStatus.PENDING, index=True
    )
    response_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Retry tracking
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Timing
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<WebhookDelivery(id={self.id}, event_type={self.event_type}, "
            f"status={self.status}, attempt={self.attempt_number})>"
        )


# Pydantic schemas for API


class WebhookSubscriptionCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to create webhook subscription."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    url: HttpUrl = Field(..., description="Webhook endpoint URL")
    description: str | None = Field(None, max_length=500, description="Description")
    events: list[str] = Field(..., min_length=1, description="Event types to subscribe to")
    headers: dict[str, str] = Field(default_factory=dict, description="Custom headers for requests")
    retry_enabled: bool = Field(default=True, description="Enable retry on failure")
    max_retries: int = Field(default=3, ge=0, le=10, description="Max retry attempts")
    timeout_seconds: int = Field(default=30, ge=5, le=300, description="Request timeout in seconds")
    custom_metadata: dict[str, Any] = Field(default_factory=dict, description="Custom metadata")

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str]) -> list[str]:
        """Validate event types.

        Frontend may use custom event names (e.g. customer.created); accept any non-empty list.
        """
        if not v:
            raise ValueError("At least one event type is required")
        return [evt.strip() for evt in v if evt]


class WebhookSubscriptionUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to update webhook subscription."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    url: HttpUrl | None = Field(None, description="Webhook endpoint URL")
    description: str | None = Field(None, max_length=500, description="Description")
    events: list[str] | None = Field(None, description="Event types to subscribe to")
    headers: dict[str, str] | None = Field(None, description="Custom headers")
    is_active: bool | None = Field(None, description="Enable/disable subscription")
    retry_enabled: bool | None = Field(None, description="Enable retry on failure")
    max_retries: int | None = Field(None, ge=0, le=10, description="Max retry attempts")
    timeout_seconds: int | None = Field(None, ge=5, le=300, description="Request timeout")
    custom_metadata: dict[str, Any] | None = Field(None, description="Custom metadata")

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str] | None) -> list[str] | None:
        """Validate event types (allow arbitrary names for compatibility)."""
        if v is None:
            return v
        return [evt.strip() for evt in v if evt]


class WebhookSubscriptionResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Webhook subscription response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    url: str
    description: str | None
    events: list[str]
    is_active: bool
    retry_enabled: bool
    max_retries: int
    timeout_seconds: int
    success_count: int
    failure_count: int
    last_triggered_at: datetime | None
    last_success_at: datetime | None
    last_failure_at: datetime | None
    created_at: datetime
    updated_at: datetime | None
    custom_metadata: dict[str, Any]

    @field_validator("id", mode="before")
    @classmethod
    def convert_uuid(cls, v: Any) -> Any:
        """Convert UUID to string."""
        return str(v) if v else None


class WebhookSubscriptionCreateResponse(WebhookSubscriptionResponse):
    """Response returned when creating a webhook subscription."""

    model_config = ConfigDict(from_attributes=True)

    secret: str


class WebhookDeliveryResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Webhook delivery response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    subscription_id: str
    event_type: str
    event_id: str
    status: DeliveryStatus
    response_code: int | None
    error_message: str | None
    attempt_number: int
    duration_ms: int | None
    created_at: datetime
    next_retry_at: datetime | None

    @field_validator("id", "subscription_id", mode="before")
    @classmethod
    def convert_uuid(cls, v: Any) -> Any:
        """Convert UUID to string."""
        return str(v) if v else None


class WebhookEventPayload(BaseModel):  # BaseModel resolves to Any in isolation
    """Standard webhook event payload sent to endpoints."""

    model_config = ConfigDict()

    id: str = Field(..., description="Event ID (idempotency key)")
    type: str = Field(..., description="Event type")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Event timestamp"
    )
    data: dict[str, Any] = Field(..., description="Event data")
    tenant_id: str | None = Field(None, description="Tenant ID")
    custom_metadata: dict[str, Any] = Field(default_factory=dict, description="Event metadata")


def generate_webhook_secret() -> str:
    """Generate a secure random secret for webhook signing."""
    return secrets.token_urlsafe(32)
