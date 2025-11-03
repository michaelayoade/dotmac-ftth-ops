"""Event models and types."""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class EventPriority(str, Enum):
    """Event priority levels."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class EventStatus(str, Enum):
    """Event processing status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


class EventMetadata(BaseModel):  # BaseModel resolves to Any in isolation
    """Event metadata for tracking and correlation."""

    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        extra="allow",  # Allow additional metadata fields
    )

    correlation_id: str | None = Field(None, description="Correlation ID for request tracking")
    causation_id: str | None = Field(None, description="ID of the event that caused this event")
    user_id: str | None = Field(None, description="User who triggered the event")
    tenant_id: str | None = Field(None, description="Tenant context")
    source: str | None = Field(None, description="Source module/service")
    trace_id: str | None = Field(None, description="Distributed tracing ID")


def _default_event_metadata() -> EventMetadata:
    """Create default EventMetadata instance with all fields set to None."""
    return EventMetadata(
        correlation_id=None,
        causation_id=None,
        user_id=None,
        tenant_id=None,
        source=None,
        trace_id=None,
    )


class Event(BaseModel):  # BaseModel resolves to Any in isolation
    """Base event model."""

    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        str_strip_whitespace=True,
    )

    # Core fields
    event_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique event ID")
    event_type: str = Field(..., description="Event type (e.g., 'invoice.created')")
    payload: dict[str, Any] = Field(default_factory=dict, description="Event data")
    metadata: EventMetadata = Field(
        default_factory=_default_event_metadata, description="Event metadata"
    )

    # Tracking fields
    priority: EventPriority = Field(default=EventPriority.NORMAL, description="Event priority")
    status: EventStatus = Field(default=EventStatus.PENDING, description="Processing status")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Creation timestamp"
    )
    published_at: datetime | None = Field(None, description="Publication timestamp")
    processed_at: datetime | None = Field(None, description="Processing completion timestamp")

    # Retry and error handling
    retry_count: int = Field(default=0, description="Number of retry attempts")
    max_retries: int = Field(default=3, description="Maximum retry attempts")
    error_message: str | None = Field(None, description="Last error message")
    last_error_at: datetime | None = Field(None, description="Last error timestamp")

    @property
    def is_retryable(self) -> bool:
        """Check if event can be retried."""
        return self.retry_count < self.max_retries and self.status == EventStatus.FAILED

    def mark_processing(self) -> None:
        """Mark event as being processed."""
        self.status = EventStatus.PROCESSING

    def mark_completed(self) -> None:
        """Mark event as successfully processed."""
        self.status = EventStatus.COMPLETED
        self.processed_at = datetime.now(UTC)

    def mark_failed(self, error: str) -> None:
        """Mark event as failed."""
        self.status = EventStatus.FAILED
        self.error_message = error
        self.last_error_at = datetime.now(UTC)
        self.retry_count += 1

        if not self.is_retryable:
            self.status = EventStatus.DEAD_LETTER

    def to_dict(self) -> dict[str, Any]:
        """Convert event to dictionary."""
        return self.model_dump(mode="json")

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Event":
        """Create event from dictionary."""
        return cls.model_validate(data)
