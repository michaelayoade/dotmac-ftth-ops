"""
Cache Models.

Models for cache configuration and statistics.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM as SQLEnum
from sqlalchemy.dialects.postgresql import JSON, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base, TenantMixin, TimestampMixin


class CacheStrategy(str, Enum):
    """Cache invalidation strategy."""

    TTL = "ttl"  # Time-to-live expiration
    LRU = "lru"  # Least recently used
    LFU = "lfu"  # Least frequently used
    WRITE_THROUGH = "write_through"  # Update cache on write
    WRITE_BEHIND = "write_behind"  # Async cache update
    REFRESH_AHEAD = "refresh_ahead"  # Proactive refresh before expiry


class CachePattern(str, Enum):
    """Common cache patterns."""

    CACHE_ASIDE = "cache_aside"  # Check cache, fallback to DB
    READ_THROUGH = "read_through"  # Cache loads from DB automatically
    WRITE_THROUGH = "write_through"  # Write to cache and DB synchronously
    WRITE_BEHIND = "write_behind"  # Write to cache, DB asynchronously
    REFRESH_AHEAD = "refresh_ahead"  # Refresh before expiry


class CacheNamespace(str, Enum):
    """Cache namespaces for organization."""

    # Core entities
    USER = "user"
    CUSTOMER = "customer"
    SUBSCRIBER = "subscriber"
    TENANT = "tenant"

    # Billing
    INVOICE = "invoice"
    PAYMENT = "payment"
    SUBSCRIPTION = "subscription"

    # API responses
    API_RESPONSE = "api_response"
    QUERY_RESULT = "query_result"

    # Computed values
    ANALYTICS = "analytics"
    METRICS = "metrics"
    REPORTS = "reports"
    SLA_COMPLIANCE = "sla_compliance"

    # Session data
    SESSION = "session"
    AUTH_TOKEN = "auth_token"

    # Configuration
    SETTINGS = "settings"
    FEATURE_FLAGS = "feature_flags"


class CacheConfig(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Cache configuration for specific namespaces/patterns."""

    __tablename__ = "cache_configs"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False
    )
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Configuration
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    namespace: Mapped[CacheNamespace] = mapped_column(
        SQLEnum(CacheNamespace, name="cachenamespace"), nullable=False, index=True
    )
    pattern: Mapped[CachePattern] = mapped_column(
        SQLEnum(CachePattern, name="cachepattern"), nullable=False
    )
    strategy: Mapped[CacheStrategy] = mapped_column(
        SQLEnum(CacheStrategy, name="cachestrategy"), nullable=False
    )

    # TTL settings
    default_ttl_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3600
    )  # 1 hour
    max_ttl_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=86400)  # 24 hours

    # Size limits
    max_key_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=512)
    max_value_size_bytes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1048576
    )  # 1MB

    # Behavior
    compress_values: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    serialize_format: Mapped[str] = mapped_column(
        String(20), nullable=False, default="json"
    )  # json, pickle, msgpack

    # Status
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Additional settings
    config_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )

    # Timestamps (from TimestampMixin)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    def __repr__(self) -> str:
        """String representation."""
        return f"<CacheConfig(name={self.name}, namespace={self.namespace}, ttl={self.default_ttl_seconds}s)>"


class CacheStatistics(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """Cache performance statistics."""

    __tablename__ = "cache_statistics"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False
    )
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Namespace tracking
    namespace: Mapped[CacheNamespace] = mapped_column(
        SQLEnum(CacheNamespace, name="cachenamespace"), nullable=False, index=True
    )
    cache_key_pattern: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Time period
    period_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, index=True
    )
    period_end: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

    # Hit/Miss stats
    total_requests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_misses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hit_rate: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )  # Percentage (0.0-100.0)

    # Performance metrics
    avg_hit_latency_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_miss_latency_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Storage metrics
    keys_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Operations
    sets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deletes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    evictions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Additional metrics
    stats_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )

    # Timestamps (from TimestampMixin)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    def __repr__(self) -> str:
        """String representation."""
        return f"<CacheStatistics(namespace={self.namespace}, hit_rate={self.hit_rate}%, requests={self.total_requests})>"
