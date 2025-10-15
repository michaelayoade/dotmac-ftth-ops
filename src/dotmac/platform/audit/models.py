"""
Audit and activity tracking models for the DotMac platform.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import JSON, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base, StrictTenantMixin, TimestampMixin


class ActivityType(str, Enum):
    """Types of activities that can be audited."""

    # Auth activities
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"

    # RBAC activities
    ROLE_CREATED = "rbac.role.created"
    ROLE_UPDATED = "rbac.role.updated"
    ROLE_DELETED = "rbac.role.deleted"
    ROLE_ASSIGNED = "rbac.role.assigned"
    ROLE_REVOKED = "rbac.role.revoked"
    PERMISSION_GRANTED = "rbac.permission.granted"
    PERMISSION_REVOKED = "rbac.permission.revoked"
    PERMISSION_CREATED = "rbac.permission.created"
    PERMISSION_UPDATED = "rbac.permission.updated"
    PERMISSION_DELETED = "rbac.permission.deleted"

    # Secret activities
    SECRET_CREATED = "secret.created"
    SECRET_ACCESSED = "secret.accessed"
    SECRET_UPDATED = "secret.updated"
    SECRET_DELETED = "secret.deleted"

    # File activities
    FILE_UPLOADED = "file.uploaded"
    FILE_DOWNLOADED = "file.downloaded"
    FILE_DELETED = "file.deleted"

    # API activities
    API_REQUEST = "api.request"
    API_ERROR = "api.error"

    # System activities
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"

    # Frontend activities
    FRONTEND_LOG = "frontend.log"


class ActivitySeverity(str, Enum):
    """Severity levels for activities."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditActivity(Base, TimestampMixin, StrictTenantMixin):
    """Audit activity tracking table."""

    __tablename__ = "audit_activities"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True
    )

    # Activity identification
    activity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), default=ActivitySeverity.LOW, index=True)

    # Who and when
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    # tenant_id is inherited from StrictTenantMixin and is NOT NULL
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )

    # What and where
    resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)

    # Details
    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Context
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Indexes for common queries
    __table_args__ = (
        Index("ix_audit_activities_user_timestamp", "user_id", "timestamp"),
        Index("ix_audit_activities_tenant_timestamp", "tenant_id", "timestamp"),
        Index("ix_audit_activities_type_timestamp", "activity_type", "timestamp"),
        Index("ix_audit_activities_severity_timestamp", "severity", "timestamp"),
    )


# Pydantic models for API


class AuditActivityCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Model for creating audit activities."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")

    activity_type: ActivityType
    severity: ActivitySeverity = ActivitySeverity.LOW
    user_id: str | None = None
    tenant_id: str | None = None  # Will be auto-populated by validator
    resource_type: str | None = None
    resource_id: str | None = None

    @field_validator("tenant_id", mode="before")
    @classmethod
    def validate_tenant_id(cls, v: Any) -> str:
        """Auto-populate tenant_id from context if not provided."""
        tenant_value = v
        if tenant_value is None or tenant_value == "":
            from ..tenant import get_current_tenant_id, get_tenant_config

            tenant_value = get_current_tenant_id()

            # If still no tenant_id, check if we can use default or must fail
            if not tenant_value:
                tenant_config = get_tenant_config()
                # In multi-tenant mode without a default, tenant_id is required
                if not tenant_config.is_single_tenant and not tenant_config.default_tenant_id:
                    raise ValueError(
                        "tenant_id is required for audit logging in multi-tenant mode without default"
                    )
                # Use default tenant if configured
                tenant_value = tenant_config.default_tenant_id or "default"

        if isinstance(tenant_value, str):
            return tenant_value
        return str(tenant_value)

    action: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    request_id: str | None = None


class AuditActivityResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Model for audit activity responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    activity_type: str
    severity: str
    user_id: str | None
    tenant_id: str  # Always present
    timestamp: datetime
    resource_type: str | None
    resource_id: str | None
    action: str
    description: str
    details: dict[str, Any] | None
    ip_address: str | None
    user_agent: str | None
    request_id: str | None


class AuditActivityList(BaseModel):  # BaseModel resolves to Any in isolation
    """Model for paginated audit activity lists."""

    model_config = ConfigDict()

    activities: list[AuditActivityResponse]
    total: int
    page: int = 1
    per_page: int = 50
    has_next: bool
    has_prev: bool


class AuditFilterParams(BaseModel):  # BaseModel resolves to Any in isolation
    """Model for audit activity filtering parameters."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")

    user_id: str | None = None
    tenant_id: str | None = None
    activity_type: ActivityType | None = None
    severity: ActivitySeverity | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=1000)


# Frontend logging models


class FrontendLogLevel(str, Enum):
    """Frontend log levels."""

    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"
    DEBUG = "DEBUG"


class FrontendLogEntry(BaseModel):  # BaseModel resolves to Any in isolation
    """Single frontend log entry from the client."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    level: FrontendLogLevel
    message: str = Field(min_length=1, max_length=1000)
    service: str = Field(default="frontend")
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class FrontendLogsRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Batch of frontend logs from the client."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    logs: list[FrontendLogEntry] = Field(min_length=1, max_length=100)


class FrontendLogsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for frontend log ingestion."""

    model_config = ConfigDict()

    status: str = "success"
    logs_received: int
    logs_stored: int
