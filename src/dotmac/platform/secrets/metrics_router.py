"""
Secrets Metrics Router.

Provides secrets management statistics endpoints for monitoring
secret access patterns, creation/deletion rates, and security metrics.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import ActivityType, AuditActivity
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.core.cache_decorators import CacheTier, cached_result
from dotmac.platform.db import get_session_dependency

logger = structlog.get_logger(__name__)

# Cache TTL (in seconds)
SECRETS_STATS_CACHE_TTL = 300  # 5 minutes

router = APIRouter(prefix="", tags=["Secrets Metrics"])


# ============================================================================
# Response Models
# ============================================================================


class SecretsMetricsResponse(BaseModel):
    """Secrets metrics statistics response."""

    model_config = ConfigDict(from_attributes=True)

    # Total counts
    total_secrets_accessed: int = Field(description="Total secret access events")
    total_secrets_created: int = Field(description="Total secrets created")
    total_secrets_updated: int = Field(description="Total secrets updated")
    total_secrets_deleted: int = Field(description="Total secrets deleted")

    # Access patterns
    unique_secrets_accessed: int = Field(description="Number of unique secrets accessed")
    unique_users_accessing: int = Field(description="Number of unique users accessing secrets")
    avg_accesses_per_secret: float = Field(description="Average accesses per secret")

    # Security metrics
    failed_access_attempts: int = Field(description="Number of failed access attempts")
    after_hours_accesses: int = Field(description="Accesses outside business hours")
    high_frequency_users: list[dict[str, Any]] = Field(description="Top 10 users by access count")

    # Activity patterns
    most_accessed_secrets: list[dict[str, Any]] = Field(description="Top 10 most accessed secrets")

    # Recent activity
    secrets_created_last_7d: int = Field(description="Secrets created in last 7 days")
    secrets_deleted_last_7d: int = Field(description="Secrets deleted in last 7 days")

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


# ============================================================================
# Cached Helper Function
# ============================================================================


@cached_result(
    ttl=SECRETS_STATS_CACHE_TTL,
    key_prefix="secrets:metrics",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_secrets_metrics_cached(
    period_days: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for secrets metrics calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)
    seven_days_ago = now - timedelta(days=7)

    # Build base query for secret activities
    base_query = select(AuditActivity).where(AuditActivity.created_at >= period_start)

    if tenant_id:
        base_query = base_query.where(AuditActivity.tenant_id == tenant_id)

    # Query secret access events
    access_query = base_query.where(AuditActivity.activity_type == ActivityType.SECRET_ACCESSED)
    access_result = await session.execute(access_query)
    access_activities = access_result.scalars().all()

    # Query secret creation events
    created_query = base_query.where(AuditActivity.activity_type == ActivityType.SECRET_CREATED)
    created_result = await session.execute(created_query)
    created_activities = created_result.scalars().all()

    # Query secret update events
    updated_query = base_query.where(AuditActivity.activity_type == ActivityType.SECRET_UPDATED)
    updated_result = await session.execute(updated_query)
    updated_activities = updated_result.scalars().all()

    # Query secret deletion events
    deleted_query = base_query.where(AuditActivity.activity_type == ActivityType.SECRET_DELETED)
    deleted_result = await session.execute(deleted_query)
    deleted_activities = deleted_result.scalars().all()

    # Calculate basic counts
    total_secrets_accessed = len(access_activities)
    total_secrets_created = len(created_activities)
    total_secrets_updated = len(updated_activities)
    total_secrets_deleted = len(deleted_activities)

    # Analyze access patterns
    unique_secrets = set()
    unique_users = set()
    secret_access_counts: dict[str, int] = {}
    user_access_counts: dict[str, int] = {}
    failed_access_attempts = 0
    after_hours_accesses = 0

    for activity in access_activities:
        resource_id = activity.resource_id
        user_id = activity.user_id

        if resource_id:
            unique_secrets.add(resource_id)
            secret_access_counts[resource_id] = secret_access_counts.get(resource_id, 0) + 1

        if user_id:
            unique_users.add(user_id)
            user_access_counts[user_id] = user_access_counts.get(user_id, 0) + 1

        # Check for failed attempts (in details)
        details = activity.details or {}
        if details.get("reason") == "secret_not_found" or activity.action == "secret_access_failed":
            failed_access_attempts += 1

        # Check if after hours (outside 9am-5pm UTC)
        hour = activity.timestamp.hour
        if hour < 9 or hour >= 17:
            after_hours_accesses += 1

    unique_secrets_accessed = len(unique_secrets)
    unique_users_accessing = len(unique_users)
    avg_accesses_per_secret = (
        total_secrets_accessed / unique_secrets_accessed if unique_secrets_accessed > 0 else 0.0
    )

    # Get top users by access count
    sorted_users = sorted(user_access_counts.items(), key=lambda x: x[1], reverse=True)
    high_frequency_users = [
        {"user_id": user_id, "access_count": count} for user_id, count in sorted_users[:10]
    ]

    # Get most accessed secrets
    sorted_secrets = sorted(secret_access_counts.items(), key=lambda x: x[1], reverse=True)
    most_accessed_secrets = [
        {"secret_path": secret_id, "access_count": count}
        for secret_id, count in sorted_secrets[:10]
    ]

    # Recent activity (last 7 days)
    secrets_created_last_7d = sum(1 for a in created_activities if a.created_at >= seven_days_ago)
    secrets_deleted_last_7d = sum(1 for a in deleted_activities if a.created_at >= seven_days_ago)

    return {
        "total_secrets_accessed": total_secrets_accessed,
        "total_secrets_created": total_secrets_created,
        "total_secrets_updated": total_secrets_updated,
        "total_secrets_deleted": total_secrets_deleted,
        "unique_secrets_accessed": unique_secrets_accessed,
        "unique_users_accessing": unique_users_accessing,
        "avg_accesses_per_secret": round(avg_accesses_per_secret, 2),
        "failed_access_attempts": failed_access_attempts,
        "after_hours_accesses": after_hours_accesses,
        "high_frequency_users": high_frequency_users,
        "most_accessed_secrets": most_accessed_secrets,
        "secrets_created_last_7d": secrets_created_last_7d,
        "secrets_deleted_last_7d": secrets_deleted_last_7d,
        "period": f"{period_days}d",
        "timestamp": now,
    }


# ============================================================================
# Secrets Metrics Endpoint
# ============================================================================


@router.get("/metrics", response_model=SecretsMetricsResponse)
async def get_secrets_metrics(
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> SecretsMetricsResponse:
    """
    Get secrets management metrics with Redis caching.

    Returns secret access patterns, security metrics, and usage statistics
    with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Rate Limit**: 100 requests per hour per IP.
    **Required Permission**: secrets:metrics:read (enforced by get_current_user)
    """
    try:
        permissions = set(getattr(current_user, "permissions", []) or [])
        is_platform_admin = bool(getattr(current_user, "is_platform_admin", False))

        if "secrets:metrics:read" not in permissions and not is_platform_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing secrets:metrics:read permission",
            )

        tenant_id = getattr(current_user, "tenant_id", None)
        if tenant_id is None and not is_platform_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant context required for metrics access",
            )

        # Use cached helper function
        stats_data = await _get_secrets_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        )

        return SecretsMetricsResponse(**stats_data)

    except Exception as e:
        logger.error("Failed to fetch secrets metrics", error=str(e), exc_info=True)
        # Return safe defaults on error
        return SecretsMetricsResponse(
            total_secrets_accessed=0,
            total_secrets_created=0,
            total_secrets_updated=0,
            total_secrets_deleted=0,
            unique_secrets_accessed=0,
            unique_users_accessing=0,
            avg_accesses_per_secret=0.0,
            failed_access_attempts=0,
            after_hours_accesses=0,
            high_frequency_users=[],
            most_accessed_secrets=[],
            secrets_created_last_7d=0,
            secrets_deleted_last_7d=0,
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


__all__ = ["router"]
