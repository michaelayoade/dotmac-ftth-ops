"""
Models and schemas for admin settings management.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import Field, field_validator
from sqlalchemy import JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.core.pydantic import AppBaseModel
from dotmac.platform.db import Base, TenantMixin, TimestampMixin


class SettingsCategory(str, Enum):
    """Available settings categories."""

    DATABASE = "database"
    JWT = "jwt"
    REDIS = "redis"
    VAULT = "vault"
    STORAGE = "storage"
    EMAIL = "email"
    TENANT = "tenant"
    CORS = "cors"
    RATE_LIMIT = "rate_limit"
    OBSERVABILITY = "observability"
    CELERY = "celery"
    FEATURES = "features"
    BILLING = "billing"

    @classmethod
    def get_display_name(cls, category: "SettingsCategory") -> str:
        """Get human-readable display name for category."""
        display_names = {
            cls.DATABASE: "Database Configuration",
            cls.JWT: "JWT & Authentication",
            cls.REDIS: "Redis Cache",
            cls.VAULT: "Vault/Secrets Management",
            cls.STORAGE: "Object Storage (MinIO/S3)",
            cls.EMAIL: "Email & SMTP",
            cls.TENANT: "Multi-tenancy",
            cls.CORS: "CORS Configuration",
            cls.RATE_LIMIT: "Rate Limiting",
            cls.OBSERVABILITY: "Logging & Monitoring",
            cls.CELERY: "Background Tasks",
            cls.FEATURES: "Feature Flags",
            cls.BILLING: "Billing & Subscriptions",
        }
        return display_names.get(category, category.value)


class SettingField(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Individual setting field metadata."""

    name: str = Field(description="Field name")
    value: Any = Field(description="Current value")
    type: str = Field(description="Field type (str, int, bool, etc.)")
    description: str | None = Field(None, description="Field description")
    default: Any = Field(None, description="Default value")
    required: bool = Field(True, description="Is field required")
    sensitive: bool = Field(False, description="Is this a sensitive field (password, key, etc.)")
    validation_rules: dict[str, Any] | None = Field(None, description="Validation rules")


class SettingsResponse(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Response model for settings retrieval."""

    category: SettingsCategory = Field(description="Settings category")
    display_name: str = Field(description="Category display name")
    fields: list[SettingField] = Field(description="List of settings fields")
    last_updated: datetime | None = Field(None, description="Last update timestamp")
    updated_by: str | None = Field(None, description="Last updated by user")


class SettingsUpdateRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request model for updating settings."""

    updates: dict[str, Any] = Field(description="Field updates as key-value pairs")
    validate_only: bool = Field(False, description="Only validate without applying changes")
    restart_required: bool = Field(
        False, description="Whether these changes require service restart"
    )
    reason: str | None = Field(None, description="Reason for settings update (for audit log)")

    @field_validator("updates")
    @classmethod
    def validate_updates_not_empty(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Ensure updates dict is not empty."""
        if not v:
            raise ValueError("Updates cannot be empty")
        return v


class SettingsValidationResult(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Result of settings validation."""

    valid: bool = Field(description="Whether all settings are valid")
    errors: dict[str, str] = Field(default_factory=dict, description="Validation errors by field")
    warnings: dict[str, str] = Field(
        default_factory=dict, description="Validation warnings by field"
    )
    restart_required: bool = Field(False, description="Whether changes require restart")


class AuditLog(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Audit log entry for settings changes."""

    id: UUID = Field(description="Audit log ID")
    timestamp: datetime = Field(description="Change timestamp")
    user_id: str = Field(description="User who made the change")
    user_email: str = Field(description="User email")
    category: SettingsCategory = Field(description="Settings category")
    action: str = Field(description="Action performed (update, reset, etc.)")
    changes: dict[str, dict[str, Any]] = Field(description="Changes made (field: {old, new})")
    reason: str | None = Field(None, description="Reason for change")
    ip_address: str | None = Field(None, description="Client IP address")
    user_agent: str | None = Field(None, description="Client user agent")


class SettingsBackup(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Settings backup model."""

    id: UUID = Field(description="Backup ID")
    created_at: datetime = Field(description="Backup creation time")
    created_by: str = Field(description="User who created backup")
    name: str = Field(description="Backup name")
    description: str | None = Field(None, description="Backup description")
    categories: list[SettingsCategory] = Field(description="Categories included in backup")
    settings_data: dict[str, Any] = Field(description="Backup data")


class SettingsCategoryInfo(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Information about a settings category."""

    category: SettingsCategory = Field(description="Category identifier")
    display_name: str = Field(description="Display name")
    description: str = Field(description="Category description")
    fields_count: int = Field(description="Number of fields")
    has_sensitive_fields: bool = Field(description="Contains sensitive fields")
    restart_required: bool = Field(description="Changes require restart")
    last_updated: datetime | None = Field(None, description="Last update time")


class BulkSettingsUpdate(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request for updating multiple categories at once."""

    updates: dict[SettingsCategory, dict[str, Any]] = Field(description="Updates by category")
    validate_only: bool = Field(False, description="Only validate without applying")
    reason: str | None = Field(None, description="Reason for bulk update")


class SettingsExportRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request for exporting settings."""

    categories: list[SettingsCategory] | None = Field(
        None, description="Categories to export (all if None)"
    )
    include_sensitive: bool = Field(False, description="Include sensitive fields in export")
    format: str = Field("json", description="Export format (json, yaml, env)")


class SettingsImportRequest(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Request for importing settings."""

    data: dict[str, Any] = Field(description="Settings data to import")
    categories: list[SettingsCategory] | None = Field(
        None, description="Limit import to specific categories"
    )
    validate_only: bool = Field(True, description="Validate before importing")
    overwrite: bool = Field(False, description="Overwrite existing settings")
    reason: str | None = Field(None, description="Reason for import")


class AdminSettingsAuditEntry(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Database model for admin settings audit logs."""

    __tablename__ = "admin_settings_audit_log"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True
    )
    # Override TenantMixin's tenant_id to use UUID type instead of String
    tenant_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    changes: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class AdminSettingsStore(Base, TimestampMixin):  # type: ignore[misc]
    """Persisted settings snapshot by category."""

    __tablename__ = "admin_settings_store"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True
    )
    category: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    settings_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)


class AdminSettingsBackupEntry(Base, TimestampMixin):  # type: ignore[misc]
    """Persistent storage for settings backups."""

    __tablename__ = "admin_settings_backups"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    categories: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    settings_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
