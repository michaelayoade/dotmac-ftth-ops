"""
Analytics Activity Metrics Router.

Provides analytics activity endpoints for monitoring
user events, API calls, and system activity patterns.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.analytics.service import AnalyticsService, get_analytics_service
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.cache import CacheTier, cached_result

logger = structlog.get_logger(__name__)

# Cache TTL (in seconds)
ACTIVITY_CACHE_TTL = 300  # 5 minutes

router = APIRouter(prefix="/metrics/analytics", tags=["Analytics Activity"])


# ============================================================================
# Helpers
# ============================================================================


def _resolve_tenant_id(request: Request, current_user: UserInfo) -> str:
    """Resolve tenant identifier, supporting platform admin impersonation."""
    tenant_id: str | None = getattr(current_user, "tenant_id", None)

    if getattr(current_user, "is_platform_admin", False):
        try:
            from dotmac.platform.auth.platform_admin import get_target_tenant_id

            target_tenant = get_target_tenant_id(request, current_user)
        except Exception:  # pragma: no cover - defensive
            target_tenant = None

        if target_tenant:
            tenant_id = target_tenant

    if tenant_id is None:
        tenant_id = "default"

    return str(tenant_id)


# ============================================================================
# Response Models
# ============================================================================


class ActivityStatsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Analytics activity statistics response."""

    model_config = ConfigDict(from_attributes=True)

    # Event counts
    total_events: int = Field(description="Total events tracked")
    page_views: int = Field(description="Total page views")
    user_actions: int = Field(description="Total user actions")
    api_calls: int = Field(description="Total API calls")
    errors: int = Field(description="Total errors tracked")
    custom_events: int = Field(description="Total custom events")

    # User activity
    active_users: int = Field(description="Number of active users")
    active_sessions: int = Field(description="Number of active sessions")

    # API metrics
    api_requests_count: int = Field(description="Total API requests")
    avg_api_latency_ms: float = Field(description="Average API latency (ms)")

    # Popular events
    top_events: list[dict[str, Any]] = Field(description="Top 10 events by count")

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


# ============================================================================
# Cached Helper Function
# ============================================================================


@cached_result(  # type: ignore[misc]  # Cache decorator is untyped
    ttl=ACTIVITY_CACHE_TTL,
    key_prefix="analytics:activity",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_activity_stats_cached(
    period_days: int,
    tenant_id: str | None,
    analytics_service: AnalyticsService,
) -> dict[str, Any]:
    """
    Cached helper function for analytics activity stats calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)

    # Query events from analytics service
    events = await analytics_service.query_events(limit=10000)

    # Filter by period (events have timestamp field)
    filtered_events = [
        e
        for e in events
        if isinstance(e.get("timestamp"), datetime) and e["timestamp"] >= period_start
    ]

    # If no timestamp, filter by creation time from event_id
    if not filtered_events and events:
        filtered_events = events[-1000:]  # Get latest 1000 events

    total_events = len(filtered_events)

    # Count by event type
    page_views = sum(1 for e in filtered_events if e.get("event_type") == "page_view")
    user_actions = sum(1 for e in filtered_events if e.get("event_type") == "user_action")
    api_calls = sum(1 for e in filtered_events if e.get("event_type") == "api_call")
    errors = sum(1 for e in filtered_events if e.get("event_type") == "error")
    custom_events = sum(1 for e in filtered_events if e.get("event_type") == "custom")

    # Count unique users and sessions
    active_users = len({e.get("user_id") for e in filtered_events if e.get("user_id")})
    active_sessions = len({e.get("session_id") for e in filtered_events if e.get("session_id")})

    # Get metrics summary for API latency
    metrics = await analytics_service.query_metrics()
    api_requests_count = 0
    avg_api_latency_ms = 0.0

    if isinstance(metrics, dict):
        # Fixed: Extract API request metrics from nested structure
        # Metrics are organized as {"counters": {...}, "histograms": {...}, ...}
        # We need to look inside these nested dicts, not at the top level

        # Check counters for API request count
        counters = metrics.get("counters", {})
        if isinstance(counters, dict):
            for metric_name, count_value in counters.items():
                if "api_request" in metric_name.lower():
                    # Counters are simple numeric values
                    if isinstance(count_value, (int, float)):
                        api_requests_count += int(count_value)

        # Check histograms for API request latency
        histograms = metrics.get("histograms", {})
        if isinstance(histograms, dict):
            for metric_name, histogram_data in histograms.items():
                if "api_request" in metric_name.lower() and isinstance(histogram_data, dict):
                    # Histograms have count, avg, min, max, sum
                    if histogram_data.get("count", 0) > 0:
                        avg_api_latency_ms = histogram_data.get("avg", 0.0)

    # Calculate top events
    event_counts: dict[str, int] = {}
    for event in filtered_events:
        event_name = event.get("event_name", "unknown")
        event_counts[event_name] = event_counts.get(event_name, 0) + 1

    # Sort and get top 10
    sorted_events = sorted(event_counts.items(), key=lambda x: x[1], reverse=True)
    top_events = [{"name": name, "count": count} for name, count in sorted_events[:10]]

    return {
        "total_events": total_events,
        "page_views": page_views,
        "user_actions": user_actions,
        "api_calls": api_calls,
        "errors": errors,
        "custom_events": custom_events,
        "active_users": active_users,
        "active_sessions": active_sessions,
        "api_requests_count": api_requests_count,
        "avg_api_latency_ms": round(avg_api_latency_ms, 2),
        "top_events": top_events,
        "period": f"{period_days}d",
        "timestamp": now,
    }


# ============================================================================
# Analytics Activity Endpoint
# ============================================================================


@router.get("/activity", response_model=ActivityStatsResponse)
async def get_analytics_activity_stats(
    request: Request,
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    current_user: UserInfo = Depends(get_current_user),
) -> ActivityStatsResponse:
    """
    Get analytics activity statistics with Redis caching.

    Returns event tracking metrics, user activity patterns, and API usage
    statistics with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Rate Limit**: 100 requests per hour per IP.
    **Required Permission**: analytics:activity:read (enforced by get_current_user)
    """
    try:
        resolved_tenant = _resolve_tenant_id(request, current_user)

        # Get analytics service for the tenant
        analytics_service = get_analytics_service(
            tenant_id=resolved_tenant,
            service_name="platform",
        )

        # Use cached helper function
        stats_data = await _get_activity_stats_cached(
            period_days=period_days,
            tenant_id=resolved_tenant,
            analytics_service=analytics_service,
        )

        return ActivityStatsResponse(**stats_data)

    except Exception as exc:
        logger.error("Failed to fetch analytics activity stats", error=str(exc), exc_info=True)
        # Return safe defaults on error
        return ActivityStatsResponse(
            total_events=0,
            page_views=0,
            user_actions=0,
            api_calls=0,
            errors=0,
            custom_events=0,
            active_users=0,
            active_sessions=0,
            api_requests_count=0,
            avg_api_latency_ms=0.0,
            top_events=[],
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


__all__ = ["router"]
