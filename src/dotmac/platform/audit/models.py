"""
Audit and activity tracking models for the DotMac platform.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import JSON, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base as BaseRuntime
from ..db import TenantMixin, TimestampMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base
else:
    Base = BaseRuntime


class ActivityType(str, Enum):
    """Types of activities that can be audited."""

    # Auth activities
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_IMPERSONATION = "user.impersonation"
    PASSWORD_RESET_ADMIN = "user.password_reset_admin"
    AUTH_FAILURE = "auth.failure"
    USER_ROLE_CHANGE = "user.role_change"
    USER_MANAGEMENT = "user.management"
    PERMISSION_CHANGE = "permission.change"

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

    # Customer activities
    CUSTOMER_STATUS_CHANGE = "customer.status_change"

    # API activities
    API_REQUEST = "api.request"
    API_ERROR = "api.error"

    # System activities
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"

    # Frontend activities
    FRONTEND_LOG = "frontend.log"

    # Resource lifecycle activities
    RESOURCE_CREATED = "resource.created"
    RESOURCE_UPDATED = "resource.updated"
    RESOURCE_DELETED = "resource.deleted"

    # Analytics events
    ANALYTICS = "analytics.event"


class ActivitySeverity(str, Enum):
    """Severity levels for activities."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditActivity(Base, TimestampMixin, TenantMixin):
    """Audit activity tracking table."""

    __tablename__ = "audit_activities"

    def __init__(self, **kwargs: Any) -> None:
        tenant_id = kwargs.get("tenant_id")
        action = kwargs.get("action")
        description = kwargs.get("description")

        if not tenant_id:
            raise ValueError("tenant_id is required for audit activities.")
        if not action:
            raise ValueError("action is required for audit activities.")
        if not description:
            raise ValueError("description is required for audit activities.")

        super().__init__(**kwargs)

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True
    )

    # Activity identification
    activity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default=ActivitySeverity.LOW)

    # Who and when
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # tenant_id is inherited from TenantMixin and is NOT NULL
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
    total_pages: int = 0
    has_next: bool
    has_prev: bool


class AuditLog(AuditActivityResponse):  # type: ignore[misc]
    """
    Backward-compatible alias for legacy audit log imports.

    Several routers import `AuditLog` directly from `dotmac.platform.audit.models`.
    We keep that symbol around by reusing the AuditActivityResponse schema.
    """

    activity_type: str = Field(description="Activity type identifier")
    action: str = Field(description="Action performed")


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
    """Single frontend log entry from the client.

    SECURITY: Metadata is validated to prevent DoS attacks via unbounded payloads.
    """

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    level: FrontendLogLevel
    message: str = Field(min_length=1, max_length=1000)
    service: str = Field(default="frontend", max_length=100)
    metadata: dict[str, Any] = Field(default_factory=lambda: {})

    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, value: dict[str, Any]) -> dict[str, Any]:
        """
        Validate metadata to prevent DoS attacks via unbounded payloads.

        SECURITY CONTROLS:
        - Maximum payload size: 10KB (serialized JSON)
        - Maximum nesting depth: 5 levels
        - Maximum string length: 2000 characters per value
        - No key restrictions (allows arbitrary frontend metadata)

        This flexible approach allows frontend hooks to send any metadata keys
        (e.g., visible, filename, lineno, reason from useAuditLogger) without
        breaking ingestion when new fields are added.
        """
        import json

        def check_depth(obj: Any, current_depth: int = 0, max_depth: int = 5) -> None:
            """Check nesting depth to prevent deeply nested structures."""
            if current_depth > max_depth:
                raise ValueError(f"Metadata nesting depth exceeds maximum of {max_depth} levels")

            if isinstance(obj, dict):
                for v in obj.values():
                    check_depth(v, current_depth + 1, max_depth)
            elif isinstance(obj, list):
                for item in obj:
                    check_depth(item, current_depth + 1, max_depth)

        def check_string_lengths(obj: Any, max_length: int = 2000) -> None:
            """Check string lengths to prevent unbounded strings."""
            if isinstance(obj, str):
                if len(obj) > max_length:
                    raise ValueError(
                        f"Metadata string exceeds maximum length of {max_length} characters"
                    )
            elif isinstance(obj, dict):
                for v in obj.values():
                    check_string_lengths(v, max_length)
            elif isinstance(obj, list):
                for item in obj:
                    check_string_lengths(item, max_length)

        # Validate nesting depth
        check_depth(value)

        # Validate string lengths
        check_string_lengths(value)

        # Check serialized size (10KB limit)
        try:
            serialized = json.dumps(value)
            if len(serialized) > 10240:  # 10KB
                raise ValueError(
                    f"Metadata payload size ({len(serialized)} bytes) exceeds maximum of 10KB"
                )
        except (TypeError, ValueError) as e:
            raise ValueError(f"Metadata must be JSON-serializable: {e}") from e

        return value


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


__all__ = [
    "ActivityType",
    "ActivitySeverity",
    "AuditActivity",
    "AuditActivityCreate",
    "AuditActivityResponse",
    "AuditActivityList",
    "AuditFilterParams",
    "AuditLog",
    "FrontendLogLevel",
    "FrontendLogEntry",
    "FrontendLogsRequest",
    "FrontendLogsResponse",
]
