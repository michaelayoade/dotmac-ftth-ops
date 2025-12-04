"""
Partner Revenue Router - Revenue tracking and payout endpoints for partner portal.

Provides endpoints for partners to view revenue metrics, commission events, and payouts.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import get_session_dependency
from dotmac.platform.partner_management.dependencies import get_portal_partner
from dotmac.platform.partner_management.models import (
    CommissionStatus,
    Partner,
    PayoutStatus,
)
from dotmac.platform.partner_management.revenue_service import PartnerRevenueService
from dotmac.platform.partner_management.schemas import (
    PartnerCommissionEventResponse,
    PartnerPayoutResponse,
    PartnerRevenueMetrics,
)

router = APIRouter(prefix="/revenue", tags=["Partner Revenue"])


def get_revenue_service(
    db: AsyncSession = Depends(get_session_dependency),
) -> PartnerRevenueService:
    """Dependency to get PartnerRevenueService instance."""
    return PartnerRevenueService(db)


@router.get("/metrics", response_model=PartnerRevenueMetrics)
async def get_revenue_metrics(
    partner: Annotated[Partner, Depends(get_portal_partner)],
    revenue_service: Annotated[PartnerRevenueService, Depends(get_revenue_service)],
    period_start: datetime | None = Query(
        None, description="Start of period (defaults to start of month)"
    ),
    period_end: datetime | None = Query(None, description="End of period (defaults to now)"),
) -> PartnerRevenueMetrics:
    """
    Get revenue metrics for the current partner over a time period.

    Returns:
        - Total commissions earned
        - Total payouts received
        - Pending commission amount
        - Commission count

    Example:
        GET /api/v1/partners/revenue/metrics?period_start=2025-09-01T00:00:00Z&period_end=2025-09-30T23:59:59Z
    """
    try:
        metrics = await revenue_service.get_partner_revenue_metrics(
            partner_id=partner.id,
            period_start=period_start,
            period_end=period_end,
        )
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve revenue metrics: {str(e)}",
        ) from e


@router.get("/commissions", response_model=list[PartnerCommissionEventResponse])
async def list_commission_events(
    partner: Annotated[Partner, Depends(get_portal_partner)],
    revenue_service: Annotated[PartnerRevenueService, Depends(get_revenue_service)],
    status_filter: CommissionStatus | None = Query(None, description="Filter by commission status"),
    limit: int = Query(100, ge=1, le=500, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> list[PartnerCommissionEventResponse]:
    """
    List commission events for the current partner.

    Supports filtering by status and pagination.

    Query Parameters:
        - status: Filter by commission status (pending, approved, paid, rejected)
        - limit: Maximum number of results (default: 100, max: 500)
        - offset: Pagination offset (default: 0)

    Returns:
        List of commission events ordered by event date (most recent first)

    Example:
        GET /api/v1/partners/revenue/commissions?status=approved&limit=50
    """
    try:
        events: list[PartnerCommissionEventResponse] = await revenue_service.list_commission_events(
            partner_id=partner.id,
            status=status_filter,
            limit=limit,
            offset=offset,
        )
        return events
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve commission events: {str(e)}",
        ) from e


@router.get("/payouts", response_model=list[PartnerPayoutResponse])
async def list_payouts(
    partner: Annotated[Partner, Depends(get_portal_partner)],
    revenue_service: Annotated[PartnerRevenueService, Depends(get_revenue_service)],
    status_filter: PayoutStatus | None = Query(None, description="Filter by payout status"),
    limit: int = Query(100, ge=1, le=500, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> list[PartnerPayoutResponse]:
    """
    List payouts for the current partner.

    Supports filtering by status and pagination.

    Query Parameters:
        - status: Filter by payout status (pending, ready, processing, completed, failed, cancelled)
        - limit: Maximum number of results (default: 100, max: 500)
        - offset: Pagination offset (default: 0)

    Returns:
        List of payouts ordered by payout date (most recent first)

    Example:
        GET /api/v1/partners/revenue/payouts?status=completed&limit=20
    """
    try:
        payouts: list[PartnerPayoutResponse] = await revenue_service.list_payouts(
            partner_id=partner.id,
            status=status_filter,
            limit=limit,
            offset=offset,
        )
        return payouts
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve payouts: {str(e)}",
        ) from e


@router.get("/payouts/{payout_id}", response_model=PartnerPayoutResponse)
async def get_payout_details(
    payout_id: UUID,
    partner: Annotated[Partner, Depends(get_portal_partner)],
    db: Annotated[AsyncSession, Depends(get_session_dependency)],
) -> PartnerPayoutResponse:
    """
    Get detailed information for a specific payout.

    Path Parameters:
        - payout_id: UUID of the payout

    Returns:
        Full payout details including commission count, period, status, and payment information

    Example:
        GET /api/v1/partners/revenue/payouts/123e4567-e89b-12d3-a456-426614174000
    """
    from sqlalchemy import and_, select

    from dotmac.platform.partner_management.models import PartnerPayout

    result = await db.execute(
        select(PartnerPayout).where(
            and_(
                PartnerPayout.id == payout_id,
                PartnerPayout.partner_id == partner.id,
            )
        )
    )
    payout = result.scalar_one_or_none()

    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payout {payout_id} not found or does not belong to current partner",
        )

    return PartnerPayoutResponse.model_validate(payout)


@router.get("/commissions/{commission_id}", response_model=PartnerCommissionEventResponse)
async def get_commission_details(
    commission_id: UUID,
    partner: Annotated[Partner, Depends(get_portal_partner)],
    db: Annotated[AsyncSession, Depends(get_session_dependency)],
) -> PartnerCommissionEventResponse:
    """
    Get detailed information for a specific commission event.

    Path Parameters:
        - commission_id: UUID of the commission event

    Returns:
        Full commission event details including amount, status, invoice reference, and payout information

    Example:
        GET /api/v1/partners/revenue/commissions/123e4567-e89b-12d3-a456-426614174000
    """
    from sqlalchemy import and_, select

    from dotmac.platform.partner_management.models import PartnerCommissionEvent

    result = await db.execute(
        select(PartnerCommissionEvent).where(
            and_(
                PartnerCommissionEvent.id == commission_id,
                PartnerCommissionEvent.partner_id == partner.id,
            )
        )
    )
    commission = result.scalar_one_or_none()

    if not commission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission event {commission_id} not found or does not belong to current partner",
        )

    return PartnerCommissionEventResponse.model_validate(commission)
