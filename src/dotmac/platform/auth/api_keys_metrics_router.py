"""
API Keys Metrics Router.

Provides API key usage statistics endpoints for monitoring
key creation, usage patterns, and security metrics.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.auth.core import UserInfo, api_key_service
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.core.cache_decorators import CacheTier, cached_result

logger = structlog.get_logger(__name__)

# Cache TTL (in seconds)
API_KEYS_STATS_CACHE_TTL = 300  # 5 minutes

router = APIRouter(prefix="", tags=["API Keys Metrics"])


# ============================================================================
# Response Models
# ============================================================================


class APIKeyMetricsResponse(BaseModel):
    """API key metrics statistics response."""

    model_config = ConfigDict(from_attributes=True)

    # Total counts
    total_keys: int = Field(description="Total number of API keys")
    active_keys: int = Field(description="Number of active keys")
    inactive_keys: int = Field(description="Number of inactive keys")
    expired_keys: int = Field(description="Number of expired keys")

    # Recent activity
    keys_created_last_30d: int = Field(description="Keys created in last 30 days")
    keys_used_last_7d: int = Field(description="Keys used in last 7 days")
    keys_expiring_soon: int = Field(description="Keys expiring within 30 days")

    # Usage patterns
    total_api_requests: int = Field(description="Total API requests using keys")
    avg_requests_per_key: float = Field(description="Average requests per key")

    # Security metrics
    never_used_keys: int = Field(description="Number of keys never used")
    keys_without_expiry: int = Field(description="Keys without expiration date")

    # Scopes distribution
    top_scopes: list[dict[str, Any]] = Field(description="Top 10 scopes by usage")

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


# ============================================================================
# Cached Helper Function
# ============================================================================


@cached_result(
    ttl=API_KEYS_STATS_CACHE_TTL,
    key_prefix="api_keys:metrics",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _fetch_all_api_keys_metadata(client: Any) -> list[dict[str, Any]]:
    """Fetch all API key metadata from Redis or memory."""
    all_keys_meta = []

    if client:
        # Scan for all API key metadata from Redis
        async for key in client.scan_iter(match="api_key_meta:*"):
            data_str = await client.get(key)
            if data_str:
                data = api_key_service._deserialize(data_str)
                all_keys_meta.append(data)
    else:
        # Fallback to memory
        memory_meta = getattr(api_key_service, "_memory_meta", {})
        all_keys_meta = list(memory_meta.values())

    return all_keys_meta


def _parse_api_key_dates(
    key_data: dict[str, Any],
) -> tuple[datetime | None, datetime | None, datetime | None]:
    """Parse created_at, expires_at, and last_used_at dates."""
    created_at_str = key_data.get("created_at")
    expires_at_str = key_data.get("expires_at")
    last_used_at_str = key_data.get("last_used_at")

    created_at = (
        datetime.fromisoformat(created_at_str.replace("Z", "+00:00")) if created_at_str else None
    )
    expires_at = (
        datetime.fromisoformat(expires_at_str.replace("Z", "+00:00")) if expires_at_str else None
    )
    last_used_at = (
        datetime.fromisoformat(last_used_at_str.replace("Z", "+00:00"))
        if last_used_at_str
        else None
    )

    return created_at, expires_at, last_used_at


def _calculate_key_status_metrics(
    key_data: dict[str, Any],
    now: datetime,
    expires_at: datetime | None,
) -> tuple[int, int, int]:
    """Calculate active/inactive/expired status for a key."""
    is_active = key_data.get("is_active", True)
    is_expired = expires_at and expires_at < now if expires_at else False

    expired = 1 if is_expired else 0
    active = 1 if (not is_expired and is_active) else 0
    inactive = 1 if (not is_expired and not is_active) else 0

    return active, inactive, expired


def _calculate_time_based_metrics(
    created_at: datetime | None,
    last_used_at: datetime | None,
    expires_at: datetime | None,
    period_start: datetime,
    now: datetime,
    thirty_days_from_now: datetime,
) -> tuple[int, int, int, int, int]:
    """Calculate time-based metrics for a key."""
    # Recent creation
    created_recently = 1 if created_at and created_at >= period_start else 0

    # Recent usage
    seven_days_ago = now - timedelta(days=7)
    used_recently = 1 if last_used_at and last_used_at >= seven_days_ago else 0

    # Expiring soon
    expiring_soon = 1 if expires_at and now < expires_at < thirty_days_from_now else 0

    # Never used
    never_used = 1 if not last_used_at else 0

    # Without expiry
    no_expiry = 1 if not expires_at else 0

    return created_recently, used_recently, expiring_soon, never_used, no_expiry


def _build_metrics_response(
    total_keys: int,
    active_keys: int,
    inactive_keys: int,
    expired_keys: int,
    keys_created_last_30d: int,
    keys_used_last_7d: int,
    keys_expiring_soon: int,
    total_api_requests: int,
    never_used_keys: int,
    keys_without_expiry: int,
    scope_counts: dict[str, int],
    period_days: int,
    now: datetime,
) -> dict[str, Any]:
    """Build the final metrics response."""
    avg_requests_per_key = total_api_requests / total_keys if total_keys > 0 else 0.0

    # Sort scopes by count
    sorted_scopes = sorted(scope_counts.items(), key=lambda x: x[1], reverse=True)
    top_scopes = [{"scope": scope, "count": count} for scope, count in sorted_scopes[:10]]

    return {
        "total_keys": total_keys,
        "active_keys": active_keys,
        "inactive_keys": inactive_keys,
        "expired_keys": expired_keys,
        "keys_created_last_30d": keys_created_last_30d,
        "keys_used_last_7d": keys_used_last_7d,
        "keys_expiring_soon": keys_expiring_soon,
        "total_api_requests": total_api_requests,
        "avg_requests_per_key": round(avg_requests_per_key, 2),
        "never_used_keys": never_used_keys,
        "keys_without_expiry": keys_without_expiry,
        "top_scopes": top_scopes,
        "period": f"{period_days}d",
        "timestamp": now,
    }


async def _get_api_key_metrics_cached(
    period_days: int,
    tenant_id: str | None,
) -> dict[str, Any]:
    """
    Cached helper function for API key metrics calculation.

    SECURITY: Filters keys by tenant_id to prevent cross-tenant data leaks.
    If tenant_id is None, returns zero metrics (no tenant = no data).
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)
    thirty_days_from_now = now + timedelta(days=30)

    # Fetch all API key metadata
    client = await api_key_service._get_redis()
    all_keys_meta = await _fetch_all_api_keys_metadata(client)

    # CRITICAL FIX: Filter by tenant_id to prevent cross-tenant data leak
    # Only include keys that belong to the requesting tenant
    if tenant_id:
        tenant_keys_meta = [
            key_data for key_data in all_keys_meta if key_data.get("tenant_id") == tenant_id
        ]
    else:
        # No tenant_id = no data (return empty metrics)
        # This prevents platform-wide aggregation for unauthenticated/invalid requests
        tenant_keys_meta = []
        logger.warning("API key metrics requested without tenant_id, returning empty metrics")

    # Initialize counters
    total_keys = len(tenant_keys_meta)
    active_keys = inactive_keys = expired_keys = 0
    keys_created_last_30d = keys_used_last_7d = keys_expiring_soon = 0
    never_used_keys = keys_without_expiry = total_api_requests = 0
    scope_counts: dict[str, int] = {}

    # Process each key (now scoped to tenant)
    for key_data in tenant_keys_meta:
        # Parse dates
        created_at, expires_at, last_used_at = _parse_api_key_dates(key_data)

        # Calculate status metrics
        active, inactive, expired = _calculate_key_status_metrics(key_data, now, expires_at)
        active_keys += active
        inactive_keys += inactive
        expired_keys += expired

        # Calculate time-based metrics
        created, used, expiring, never_used, no_expiry = _calculate_time_based_metrics(
            created_at, last_used_at, expires_at, period_start, now, thirty_days_from_now
        )
        keys_created_last_30d += created
        keys_used_last_7d += used
        keys_expiring_soon += expiring
        never_used_keys += never_used
        keys_without_expiry += no_expiry

        # Count scopes
        scopes = key_data.get("scopes", [])
        for scope in scopes:
            scope_counts[scope] = scope_counts.get(scope, 0) + 1

        # Usage count
        total_api_requests += key_data.get("usage_count", 0)

    # Build and return response
    return _build_metrics_response(
        total_keys,
        active_keys,
        inactive_keys,
        expired_keys,
        keys_created_last_30d,
        keys_used_last_7d,
        keys_expiring_soon,
        total_api_requests,
        never_used_keys,
        keys_without_expiry,
        scope_counts,
        period_days,
        now,
    )


# ============================================================================
# API Keys Metrics Endpoint
# ============================================================================


@router.get("/metrics", response_model=APIKeyMetricsResponse)
async def get_api_key_metrics(
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    current_user: UserInfo = Depends(require_permission("api-keys:metrics:read")),
) -> APIKeyMetricsResponse:
    """
    Get API key usage metrics with Redis caching.

    Returns API key statistics including creation patterns, usage metrics,
    and security indicators with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Rate Limit**: 100 requests per hour per IP.
    **Required Permission**: api-keys:metrics:read (enforced by require_permission)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        # Use cached helper function
        stats_data = await _get_api_key_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
        )

        return APIKeyMetricsResponse(**stats_data)

    except Exception as e:
        logger.error("Failed to fetch API key metrics", error=str(e), exc_info=True)
        # Return safe defaults on error
        return APIKeyMetricsResponse(
            total_keys=0,
            active_keys=0,
            inactive_keys=0,
            expired_keys=0,
            keys_created_last_30d=0,
            keys_used_last_7d=0,
            keys_expiring_soon=0,
            total_api_requests=0,
            avg_requests_per_key=0.0,
            never_used_keys=0,
            keys_without_expiry=0,
            top_scopes=[],
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


__all__ = ["router"]
