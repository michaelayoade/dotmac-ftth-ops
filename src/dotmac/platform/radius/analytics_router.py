"""
RADIUS Analytics API Router.

Provides analytics endpoints for RADIUS session data stored in TimescaleDB.
Requires TimescaleDB to be configured and enabled.
"""

from datetime import datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.radius.analytics_schemas import (
    DailyBandwidthPoint,
    DailyBandwidthResponse,
    HourlyBandwidthPoint,
    HourlyBandwidthResponse,
    SubscriberUsageResponse,
    TenantUsageResponse,
    TopSubscriberEntry,
    TopSubscribersResponse,
)
from dotmac.platform.settings import settings
from dotmac.platform.timeseries import TimeSeriesSessionLocal
from dotmac.platform.timeseries.repository import RadiusTimeSeriesRepository

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/analytics",
    tags=["RADIUS Analytics"],
    responses={
        503: {"description": "TimescaleDB not configured"},
    },
)


# Dependency to check TimescaleDB availability
async def check_timescaledb_available() -> None:
    """Check if TimescaleDB is configured and available."""
    if not settings.timescaledb.is_configured:
        raise HTTPException(
            status_code=503,
            detail="TimescaleDB analytics not available. Enable TIMESCALEDB_ENABLED in configuration.",
        )


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the TimescaleDB session factory or raise if unavailable."""
    session_factory = TimeSeriesSessionLocal
    if session_factory is None:
        raise HTTPException(status_code=503, detail="TimescaleDB session not initialized")
    return session_factory


@router.get(
    "/subscriber/{subscriber_id}/usage",
    response_model=SubscriberUsageResponse,
    summary="Get Subscriber Usage",
    description="Get bandwidth and session usage for a specific subscriber over a date range.",
)
async def get_subscriber_usage(
    subscriber_id: str,
    start_date: Annotated[datetime, Query(description="Start date (ISO 8601)")],
    end_date: Annotated[datetime, Query(description="End date (ISO 8601)")],
    user_info: UserInfo = Depends(get_current_user),
    _check: None = Depends(check_timescaledb_available),
) -> SubscriberUsageResponse:
    """
    Get usage statistics for a specific subscriber.

    Returns total bandwidth, session duration, session count, and other metrics
    for the specified time period.

    **Requires:** TimescaleDB enabled
    """
    logger.info(
        "analytics.subscriber_usage.request",
        tenant_id=user_info.tenant_id,
        subscriber_id=subscriber_id,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
    )

    session_factory = _get_session_factory()

    try:
        async with session_factory() as session:
            repo = RadiusTimeSeriesRepository()

            usage = await repo.get_subscriber_usage(
                session,
                user_info.tenant_id,
                subscriber_id,
                start_date,
                end_date,
            )

            # Convert bytes to GB and seconds to hours
            total_gb = usage["total_bandwidth"] / (1024**3)
            total_hours = usage["total_duration"] / 3600

            return SubscriberUsageResponse(
                subscriber_id=subscriber_id,
                start_date=start_date,
                end_date=end_date,
                total_bandwidth_bytes=usage["total_bandwidth"],
                total_bandwidth_gb=round(total_gb, 2),
                total_duration_seconds=usage["total_duration"],
                total_duration_hours=round(total_hours, 2),
                session_count=usage["session_count"],
                avg_session_duration_seconds=usage["avg_session_duration"],
                peak_bandwidth_bytes=usage["peak_bandwidth"],
            )

    except Exception as e:
        logger.error(
            "analytics.subscriber_usage.error",
            tenant_id=user_info.tenant_id,
            subscriber_id=subscriber_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve subscriber usage: {str(e)}",
        )


@router.get(
    "/tenant/usage",
    response_model=TenantUsageResponse,
    summary="Get Tenant Usage",
    description="Get aggregated bandwidth and session usage for the entire tenant.",
)
async def get_tenant_usage(
    start_date: Annotated[datetime, Query(description="Start date (ISO 8601)")],
    end_date: Annotated[datetime, Query(description="End date (ISO 8601)")],
    user_info: UserInfo = Depends(get_current_user),
    _check: None = Depends(check_timescaledb_available),
) -> TenantUsageResponse:
    """
    Get usage statistics for the entire tenant.

    Returns total bandwidth, session duration, session count, and unique subscriber count
    for the specified time period.

    **Requires:** TimescaleDB enabled
    """
    logger.info(
        "analytics.tenant_usage.request",
        tenant_id=user_info.tenant_id,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
    )

    session_factory = _get_session_factory()

    try:
        async with session_factory() as session:
            repo = RadiusTimeSeriesRepository()

            usage = await repo.get_tenant_usage(
                session,
                user_info.tenant_id,
                start_date,
                end_date,
            )

            # Convert bytes to GB and seconds to hours
            total_gb = usage["total_bandwidth"] / (1024**3)
            total_hours = usage["total_duration"] / 3600

            return TenantUsageResponse(
                tenant_id=user_info.tenant_id,
                start_date=start_date,
                end_date=end_date,
                total_bandwidth_bytes=usage["total_bandwidth"],
                total_bandwidth_gb=round(total_gb, 2),
                total_duration_seconds=usage["total_duration"],
                total_duration_hours=round(total_hours, 2),
                session_count=usage["session_count"],
                unique_subscribers=usage["unique_subscribers"],
            )

    except Exception as e:
        logger.error(
            "analytics.tenant_usage.error",
            tenant_id=user_info.tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve tenant usage: {str(e)}",
        )


@router.get(
    "/subscriber/{subscriber_id}/bandwidth/hourly",
    response_model=HourlyBandwidthResponse,
    summary="Get Hourly Bandwidth",
    description="Get hour-by-hour bandwidth usage for a subscriber (uses pre-computed aggregates).",
)
async def get_hourly_bandwidth(
    subscriber_id: str,
    start_date: Annotated[datetime, Query(description="Start date (ISO 8601)")],
    end_date: Annotated[datetime, Query(description="End date (ISO 8601)")],
    user_info: UserInfo = Depends(get_current_user),
    _check: None = Depends(check_timescaledb_available),
) -> HourlyBandwidthResponse:
    """
    Get hourly bandwidth usage for a subscriber.

    Uses TimescaleDB continuous aggregates for fast queries on large datasets.

    **Requires:** TimescaleDB enabled
    """
    logger.info(
        "analytics.hourly_bandwidth.request",
        tenant_id=user_info.tenant_id,
        subscriber_id=subscriber_id,
    )

    session_factory = _get_session_factory()

    try:
        async with session_factory() as session:
            repo = RadiusTimeSeriesRepository()

            hourly_data = await repo.get_hourly_bandwidth(
                session,
                user_info.tenant_id,
                subscriber_id,
                start_date,
                end_date,
            )

            # Convert to response format
            data_points = [
                HourlyBandwidthPoint(
                    hour=point["hour"],
                    session_count=point["session_count"],
                    total_bandwidth_bytes=point["total_bandwidth"],
                    total_bandwidth_mb=round(point["total_bandwidth"] / (1024**2), 2),
                    total_duration_seconds=point["total_duration"],
                )
                for point in hourly_data
            ]

            return HourlyBandwidthResponse(
                subscriber_id=subscriber_id,
                tenant_id=user_info.tenant_id,
                start_date=start_date,
                end_date=end_date,
                data_points=data_points,
            )

    except Exception as e:
        logger.error(
            "analytics.hourly_bandwidth.error",
            tenant_id=user_info.tenant_id,
            subscriber_id=subscriber_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve hourly bandwidth: {str(e)}",
        )


@router.get(
    "/subscriber/{subscriber_id}/bandwidth/daily",
    response_model=DailyBandwidthResponse,
    summary="Get Daily Bandwidth",
    description="Get day-by-day bandwidth usage for a subscriber (uses pre-computed aggregates).",
)
async def get_daily_bandwidth(
    subscriber_id: str,
    start_date: Annotated[datetime, Query(description="Start date (ISO 8601)")],
    end_date: Annotated[datetime, Query(description="End date (ISO 8601)")],
    user_info: UserInfo = Depends(get_current_user),
    _check: None = Depends(check_timescaledb_available),
) -> DailyBandwidthResponse:
    """
    Get daily bandwidth usage for a subscriber.

    Uses TimescaleDB continuous aggregates for fast queries on large datasets.

    **Requires:** TimescaleDB enabled
    """
    logger.info(
        "analytics.daily_bandwidth.request",
        tenant_id=user_info.tenant_id,
        subscriber_id=subscriber_id,
    )

    session_factory = _get_session_factory()

    try:
        async with session_factory() as session:
            repo = RadiusTimeSeriesRepository()

            daily_data = await repo.get_daily_bandwidth(
                session,
                user_info.tenant_id,
                subscriber_id,
                start_date,
                end_date,
            )

            # Convert to response format
            data_points = [
                DailyBandwidthPoint(
                    day=point["day"],
                    session_count=point["session_count"],
                    total_bandwidth_bytes=point["total_bandwidth"],
                    total_bandwidth_gb=round(point["total_bandwidth"] / (1024**3), 2),
                    total_duration_seconds=point["total_duration"],
                )
                for point in daily_data
            ]

            return DailyBandwidthResponse(
                subscriber_id=subscriber_id,
                tenant_id=user_info.tenant_id,
                start_date=start_date,
                end_date=end_date,
                data_points=data_points,
            )

    except Exception as e:
        logger.error(
            "analytics.daily_bandwidth.error",
            tenant_id=user_info.tenant_id,
            subscriber_id=subscriber_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve daily bandwidth: {str(e)}",
        )


@router.get(
    "/top-subscribers",
    response_model=TopSubscribersResponse,
    summary="Get Top Subscribers",
    description="Get top N subscribers by bandwidth or session duration for capacity planning.",
)
async def get_top_subscribers(
    start_date: Annotated[datetime, Query(description="Start date (ISO 8601)")],
    end_date: Annotated[datetime, Query(description="End date (ISO 8601)")],
    limit: Annotated[
        int, Query(ge=1, le=100, description="Number of top subscribers (1-100)")
    ] = 10,
    metric: Annotated[
        str, Query(description="Sort metric: 'bandwidth' or 'duration'")
    ] = "bandwidth",
    user_info: UserInfo = Depends(get_current_user),
    _check: None = Depends(check_timescaledb_available),
) -> TopSubscribersResponse:
    """
    Get top subscribers by bandwidth or session duration.

    Returns the top N subscribers based on total bandwidth usage or session duration
    for the specified time period. Useful for capacity planning and identifying
    heavy users.

    **Requires:** TimescaleDB enabled
    """
    # Validate metric parameter
    if metric not in ["bandwidth", "duration"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid metric. Must be 'bandwidth' or 'duration'",
        )

    logger.info(
        "analytics.top_subscribers.request",
        tenant_id=user_info.tenant_id,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        limit=limit,
        metric=metric,
    )

    session_factory = TimeSeriesSessionLocal
    if session_factory is None:
        raise HTTPException(status_code=503, detail="TimescaleDB session not initialized")

    try:
        async with session_factory() as session:
            repo = RadiusTimeSeriesRepository()

            top_subs = await repo.get_top_subscribers(
                session,
                user_info.tenant_id,
                start_date,
                end_date,
                limit,
                metric,
            )

            # Convert to response format with unit conversions
            entries = [
                TopSubscriberEntry(
                    subscriber_id=sub["subscriber_id"],
                    username=sub["username"],
                    total_bandwidth_bytes=sub["total_bandwidth"],
                    total_bandwidth_gb=round(sub["total_bandwidth"] / (1024**3), 2),
                    total_duration_seconds=sub["total_duration"],
                    session_count=sub["session_count"],
                )
                for sub in top_subs
            ]

            return TopSubscribersResponse(
                tenant_id=user_info.tenant_id,
                start_date=start_date,
                end_date=end_date,
                metric=metric,
                top_subscribers=entries,
            )

    except Exception as e:
        logger.error(
            "analytics.top_subscribers.error",
            tenant_id=user_info.tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve top subscribers: {str(e)}",
        )


@router.get(
    "/health",
    summary="Analytics Health Check",
    description="Check if TimescaleDB analytics service is available.",
)
async def analytics_health() -> JSONResponse:
    """
    Health check for analytics service.

    Returns the availability status of TimescaleDB analytics.
    """
    if settings.timescaledb.is_configured:
        return JSONResponse(
            status_code=200,
            content={
                "status": "available",
                "timescaledb_enabled": True,
                "message": "RADIUS analytics service is operational",
            },
        )
    else:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "timescaledb_enabled": False,
                "message": "TimescaleDB not configured. Set TIMESCALEDB_ENABLED=true to enable analytics.",
            },
        )
