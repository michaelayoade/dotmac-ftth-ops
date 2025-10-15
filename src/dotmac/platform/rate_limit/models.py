"""
Rate Limiting Models.

Models for tracking rate limit usage and rules.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM as SQLEnum
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import AuditMixin, Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class RateLimitScope(str, Enum):
    """Rate limit scope."""

    GLOBAL = "global"  # Apply to all requests
    PER_USER = "per_user"  # Per authenticated user
    PER_IP = "per_ip"  # Per IP address
    PER_API_KEY = "per_api_key"  # Per API key
    PER_TENANT = "per_tenant"  # Per tenant
    PER_ENDPOINT = "per_endpoint"  # Per specific endpoint


class RateLimitWindow(str, Enum):
    """Rate limit time window."""

    SECOND = "second"
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"


class RateLimitAction(str, Enum):
    """Action to take when rate limit exceeded."""

    BLOCK = "block"  # Return 429 Too Many Requests
    THROTTLE = "throttle"  # Slow down requests
    LOG_ONLY = "log_only"  # Log but allow
    CAPTCHA = "captcha"  # Require CAPTCHA verification


class RateLimitRule(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """Rate limit rules configuration."""

    __tablename__ = "rate_limit_rules"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False
    )
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Rule identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Scope and targeting
    scope: Mapped[RateLimitScope] = mapped_column(
        SQLEnum(RateLimitScope, name="ratelimitscope"), nullable=False, index=True
    )
    endpoint_pattern: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )  # Regex pattern for endpoints

    # Limits
    max_requests: Mapped[int] = mapped_column(Integer, nullable=False)
    window: Mapped[RateLimitWindow] = mapped_column(
        SQLEnum(RateLimitWindow, name="ratelimitwindow"), nullable=False
    )
    window_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # Computed from window enum

    # Action
    action: Mapped[RateLimitAction] = mapped_column(
        SQLEnum(RateLimitAction, name="ratelimitaction"),
        nullable=False,
        default=RateLimitAction.BLOCK,
    )

    # Priority (higher = evaluated first)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Exemptions
    exempt_user_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    exempt_ip_addresses: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    exempt_api_keys: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # Additional configuration
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps (from TimestampMixin)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    # Soft delete (from SoftDeleteMixin)
    deleted_at: Mapped[datetime | None]

    # Audit (from AuditMixin)
    created_by_id: Mapped[UUID | None]
    updated_by_id: Mapped[UUID | None]

    def __repr__(self) -> str:
        """String representation."""
        return f"<RateLimitRule(id={self.id}, name={self.name}, max_requests={self.max_requests}/{self.window})>"


class RateLimitLog(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Log of rate limit violations for monitoring and analytics."""

    __tablename__ = "rate_limit_logs"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False
    )
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Rule applied
    rule_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("rate_limit_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Request info
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), nullable=True, index=True
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True, index=True)
    api_key_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    endpoint: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(10), nullable=False)

    # Rate limit info
    current_count: Mapped[int] = mapped_column(Integer, nullable=False)
    limit: Mapped[int] = mapped_column(Integer, nullable=False)
    window: Mapped[RateLimitWindow] = mapped_column(
        SQLEnum(RateLimitWindow, name="ratelimitwindow"), nullable=False
    )

    # Action taken
    action: Mapped[RateLimitAction] = mapped_column(
        SQLEnum(RateLimitAction, name="ratelimitaction"), nullable=False
    )
    was_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Additional context
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Timestamps (from TimestampMixin)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    def __repr__(self) -> str:
        """String representation."""
        return f"<RateLimitLog(id={self.id}, rule={self.rule_name}, endpoint={self.endpoint}, blocked={self.was_blocked})>"
