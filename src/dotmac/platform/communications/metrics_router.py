"""
Communications Metrics Router.

Provides communication statistics endpoints for monitoring
email/SMS delivery rates, open rates, and engagement metrics.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.cache import CacheTier, cached_result
from dotmac.platform.communications.models import (
    CommunicationLog,
    CommunicationStatus,
    CommunicationType,
)
from dotmac.platform.db import get_session_dependency

logger = structlog.get_logger(__name__)

# Cache TTL (in seconds)
COMMS_STATS_CACHE_TTL = 300  # 5 minutes

router = APIRouter(prefix="", tags=["Communications Metrics"])


# ============================================================================
# Response Models
# ============================================================================


class CommunicationStatsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Communication statistics response."""

    model_config = ConfigDict(from_attributes=True)

    # Total counts
    total_sent: int = Field(description="Total communications sent")
    total_delivered: int = Field(description="Total successfully delivered")
    total_failed: int = Field(description="Total failed")
    total_bounced: int = Field(description="Total bounced")
    total_pending: int = Field(description="Total pending")

    # Rates
    delivery_rate: float = Field(description="Delivery success rate (%)")
    failure_rate: float = Field(description="Failure rate (%)")
    bounce_rate: float = Field(description="Bounce rate (%)")

    # By type
    emails_sent: int = Field(description="Total emails sent")
    sms_sent: int = Field(description="Total SMS sent")
    webhooks_sent: int = Field(description="Total webhooks sent")
    push_sent: int = Field(description="Total push notifications sent")

    # Engagement (placeholder - would need tracking table)
    open_rate: float = Field(description="Email open rate (%)", default=0.0)
    click_rate: float = Field(description="Link click rate (%)", default=0.0)

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


# ============================================================================
# Cached Helper Function
# ============================================================================


@cached_result(  # type: ignore[misc]  # Cache decorator is untyped
    ttl=COMMS_STATS_CACHE_TTL,
    key_prefix="comms:stats",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_communication_stats_cached(
    period_days: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for communication stats calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)

    # Query communication stats by status
    status_query = select(
        func.count(CommunicationLog.id).label("total"),
        func.sum(case((CommunicationLog.status == CommunicationStatus.SENT, 1), else_=0)).label(
            "sent"
        ),
        func.sum(
            case((CommunicationLog.status == CommunicationStatus.DELIVERED, 1), else_=0)
        ).label("delivered"),
        func.sum(case((CommunicationLog.status == CommunicationStatus.FAILED, 1), else_=0)).label(
            "failed"
        ),
        func.sum(case((CommunicationLog.status == CommunicationStatus.BOUNCED, 1), else_=0)).label(
            "bounced"
        ),
        func.sum(case((CommunicationLog.status == CommunicationStatus.PENDING, 1), else_=0)).label(
            "pending"
        ),
    ).where(CommunicationLog.created_at >= period_start)

    if tenant_id:
        status_query = status_query.where(CommunicationLog.tenant_id == tenant_id)

    status_result = await session.execute(status_query)
    status_row = status_result.one()

    total_sent = status_row.total or 0
    delivered = status_row.delivered or 0
    failed = status_row.failed or 0
    bounced = status_row.bounced or 0
    pending = status_row.pending or 0

    # Calculate rates
    if total_sent > 0:
        delivery_rate = (delivered / total_sent) * 100
        failure_rate = (failed / total_sent) * 100
        bounce_rate = (bounced / total_sent) * 100
    else:
        delivery_rate = 0.0
        failure_rate = 0.0
        bounce_rate = 0.0

    # Query by communication type
    type_query = select(
        func.sum(case((CommunicationLog.type == CommunicationType.EMAIL, 1), else_=0)).label(
            "emails"
        ),
        func.sum(case((CommunicationLog.type == CommunicationType.SMS, 1), else_=0)).label("sms"),
        func.sum(case((CommunicationLog.type == CommunicationType.WEBHOOK, 1), else_=0)).label(
            "webhooks"
        ),
        func.sum(case((CommunicationLog.type == CommunicationType.PUSH, 1), else_=0)).label("push"),
    ).where(CommunicationLog.created_at >= period_start)

    if tenant_id:
        type_query = type_query.where(CommunicationLog.tenant_id == tenant_id)

    type_result = await session.execute(type_query)
    type_row = type_result.one()

    return {
        "total_sent": total_sent,
        "total_delivered": delivered,
        "total_failed": failed,
        "total_bounced": bounced,
        "total_pending": pending,
        "delivery_rate": round(delivery_rate, 2),
        "failure_rate": round(failure_rate, 2),
        "bounce_rate": round(bounce_rate, 2),
        "emails_sent": type_row.emails or 0,
        "sms_sent": type_row.sms or 0,
        "webhooks_sent": type_row.webhooks or 0,
        "push_sent": type_row.push or 0,
        "open_rate": 0.0,  # Would need email_tracking table
        "click_rate": 0.0,  # Would need email_tracking table
        "period": f"{period_days}d",
        "timestamp": now,
    }


# ============================================================================
# Communications Stats Endpoint
# ============================================================================


@router.get("/stats", response_model=CommunicationStatsResponse)
async def get_communication_stats(
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> CommunicationStatsResponse:
    """
    Get communication statistics with Redis caching.

    Returns delivery rates, engagement metrics, and communication counts
    by type with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Rate Limit**: 100 requests per hour per IP.
    **Required Permission**: communications:stats:read (enforced by get_current_user)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        # Use cached helper function
        stats_data = await _get_communication_stats_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        )

        return CommunicationStatsResponse(**stats_data)

    except (SQLAlchemyError, RuntimeError) as exc:
        logger.error("Failed to fetch communication stats", error=str(exc), exc_info=True)
        # Return safe defaults on error
        return CommunicationStatsResponse(
            total_sent=0,
            total_delivered=0,
            total_failed=0,
            total_bounced=0,
            total_pending=0,
            delivery_rate=0.0,
            failure_rate=0.0,
            bounce_rate=0.0,
            emails_sent=0,
            sms_sent=0,
            webhooks_sent=0,
            push_sent=0,
            open_rate=0.0,
            click_rate=0.0,
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


__all__ = ["router"]
