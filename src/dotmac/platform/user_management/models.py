"""
User management database models.

Production-ready user models using SQLAlchemy 2.0.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base, TenantMixin, TimestampMixin

try:  # Ensure dependent tables are registered for metadata creation in tests
    from dotmac.platform.contacts.models import Contact  # noqa: F401
except Exception:  # pragma: no cover - optional dependency
    Contact = None  # type: ignore
    from sqlalchemy import Column, Table

    if "contacts" not in Base.metadata.tables:
        Table(
            "contacts",
            Base.metadata,
            Column("id", String(36), primary_key=True),
            Column("created_at", String(32), nullable=True),
            Column("updated_at", String(32), nullable=True),
            extend_existing=True,
        )


class User(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """User model for authentication and authorization."""

    __tablename__ = "users"
    __table_args__ = (
        # Per-tenant uniqueness for username and email
        UniqueConstraint("tenant_id", "username", name="uq_users_tenant_username"),
        UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),
    )

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # Core fields - removed unique=True, now using composite constraints above
    username: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)

    # Profile fields
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Extended profile fields
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)  # alias for phone_number
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Status fields
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Security fields
    roles: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    permissions: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)

    # MFA fields
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Tracking fields
    last_login: Mapped[datetime | None] = mapped_column(nullable=True)
    last_login_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(nullable=True)

    # Additional metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username}, email={self.email})>"

    def to_dict(self) -> dict[str, Any]:
        """Convert user to dictionary for API responses."""
        return {
            "user_id": str(self.id),
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "roles": self.roles or [],
            "permissions": self.permissions or [],
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "is_superuser": self.is_superuser,
            "is_platform_admin": self.is_platform_admin,
            "mfa_enabled": self.mfa_enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "tenant_id": self.tenant_id,
        }


class BackupCode(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    MFA Backup codes for account recovery.

    Backup codes are one-time use codes that can be used instead of TOTP
    when the user loses access to their authenticator device.
    """

    __tablename__ = "backup_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # User relationship
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # Hashed backup code (never store plaintext)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Track usage
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(nullable=True)
    used_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    def __repr__(self) -> str:
        return f"<BackupCode(id={self.id}, user_id={self.user_id}, used={self.used})>"


class EmailVerificationToken(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Email verification tokens for confirming email addresses.

    Tokens are single-use and expire after a set time period.
    """

    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # User relationship
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # Token (hashed for security)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    # Email being verified
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Token expiry
    expires_at: Mapped[datetime] = mapped_column(nullable=False)

    # Usage tracking
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(nullable=True)
    used_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    def is_expired(self) -> bool:
        """Check if token has expired."""
        from datetime import datetime

        return datetime.now(UTC) > self.expires_at

    def __repr__(self) -> str:
        return f"<EmailVerificationToken(id={self.id}, user_id={self.user_id}, email={self.email}, used={self.used})>"


class ProfileChangeHistory(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Track changes to user profile fields for audit purposes.

    Maintains a history of all profile updates including who made the change,
    what changed, and when.
    """

    __tablename__ = "profile_change_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # User whose profile was changed
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # Who made the change (could be admin)
    changed_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # What changed
    field_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Change context
    change_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<ProfileChangeHistory(id={self.id}, user_id={self.user_id}, field={self.field_name})>"
        )


class Team(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Team model for organizing users within a tenant.

    Teams are used for:
    - Assigning contacts to teams for management
    - RBAC: team-level permissions
    - Analytics: team performance tracking
    - Ticketing: routing tickets to teams
    """

    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_teams_tenant_name"),
        UniqueConstraint("tenant_id", "slug", name="uq_teams_tenant_slug"),
    )

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # Team details
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Team settings
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Team lead (optional)
    team_lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )

    # Team metadata
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # Hex color for UI
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Icon identifier
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Team(id={self.id}, name={self.name}, tenant_id={self.tenant_id})>"

    def to_dict(self) -> dict[str, Any]:
        """Convert team to dictionary for API responses."""
        return {
            "id": str(self.id),
            "tenant_id": self.tenant_id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "team_lead_id": str(self.team_lead_id) if self.team_lead_id else None,
            "color": self.color,
            "icon": self.icon,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TeamMember(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Many-to-many relationship between users and teams.

    A user can belong to multiple teams, and a team can have multiple users.
    """

    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "team_id", "user_id", name="uq_team_members_tenant_team_user"
        ),
    )

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # Relationships
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # Membership details
    role: Mapped[str] = mapped_column(
        String(50), nullable=False, default="member", index=True
    )  # member, lead, admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Dates
    joined_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC), nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def __repr__(self) -> str:
        return f"<TeamMember(id={self.id}, team_id={self.team_id}, user_id={self.user_id}, role={self.role})>"

    def to_dict(self) -> dict[str, Any]:
        """Convert team member to dictionary for API responses."""
        return {
            "id": str(self.id),
            "tenant_id": self.tenant_id,
            "team_id": str(self.team_id),
            "user_id": str(self.user_id),
            "role": self.role,
            "is_active": self.is_active,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "left_at": self.left_at.isoformat() if self.left_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserDevice(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """User device registration for push notifications."""

    __tablename__ = "user_devices"
    __table_args__ = (
        # Unique device token per user
        UniqueConstraint("user_id", "device_token", name="uq_user_devices_user_token"),
    )

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )

    # User reference
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Device information
    device_token: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    device_type: Mapped[str] = mapped_column(String(20), nullable=False)  # ios, android, web
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    os_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Push notification provider
    push_provider: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # fcm, apns, onesignal, etc.

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Tracking
    last_used_at: Mapped[datetime | None] = mapped_column(nullable=True)
    registered_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    # Metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    def __repr__(self) -> str:
        return f"<UserDevice(id={self.id}, user_id={self.user_id}, device_type={self.device_type})>"

    def to_dict(self) -> dict[str, Any]:
        """Convert device to dictionary for API responses."""
        return {
            "id": str(self.id),
            "tenant_id": self.tenant_id,
            "user_id": str(self.user_id),
            "device_type": self.device_type,
            "device_name": self.device_name,
            "device_model": self.device_model,
            "os_version": self.os_version,
            "app_version": self.app_version,
            "push_provider": self.push_provider,
            "is_active": self.is_active,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
