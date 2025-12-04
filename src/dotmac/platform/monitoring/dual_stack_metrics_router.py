"""
FastAPI Router for Dual-Stack Metrics API.

Provides REST endpoints for querying dual-stack infrastructure metrics.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.db import get_async_session
from dotmac.platform.monitoring.dual_stack_metrics import (
    AlertEvaluator,
    DualStackMetricsCollector,
    MetricPeriod,
    MetricsAggregator,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metrics/dual-stack", tags=["Dual-Stack Metrics"])


class MetricsResponse(BaseModel):
    """Response model for metrics data."""

    subscriber_metrics: dict[str, Any] = Field(..., description="Subscriber allocation metrics")
    ip_allocation_metrics: dict[str, Any] = Field(..., description="IP allocation metrics")
    traffic_metrics: dict[str, Any] = Field(..., description="Traffic metrics")
    connectivity_metrics: dict[str, Any] = Field(..., description="Connectivity metrics")
    performance_metrics: dict[str, Any] = Field(..., description="Performance metrics")
    wireguard_metrics: dict[str, Any] = Field(..., description="WireGuard VPN metrics")
    migration_metrics: dict[str, Any] = Field(..., description="Migration progress metrics")
    meta: dict[str, Any] = Field(..., description="Metadata about collection")


class AlertResponse(BaseModel):
    """Response model for alert evaluation."""

    alerts: list[dict[str, Any]] = Field(..., description="List of active alerts")
    total_alerts: int = Field(..., description="Total number of alerts")
    critical_count: int = Field(..., description="Number of critical alerts")
    warning_count: int = Field(..., description="Number of warning alerts")


class TrendDataResponse(BaseModel):
    """Response model for trend data."""

    metric_name: str = Field(..., description="Name of the metric")
    period: str = Field(..., description="Time period")
    data_points: list[dict[str, Any]] = Field(..., description="Time-series data points")


class SummaryResponse(BaseModel):
    """Response model for metrics summary."""

    total_subscribers: int
    dual_stack_percentage: float
    ipv4_pool_utilization: float
    ipv6_prefix_utilization: float
    ipv4_connectivity_percentage: float
    ipv6_connectivity_percentage: float
    active_alerts: int
    health_status: str


def _resolve_tenant_scope(current_user: UserInfo, requested_tenant: str | None) -> str | None:
    """
    Determine the effective tenant scope for a request.

    Non-admin users are restricted to their own tenant context.
    Platform administrators may inspect arbitrary tenants.
    """
    if is_platform_admin(current_user):
        return requested_tenant

    if not current_user.tenant_id:
        raise HTTPException(
            status_code=403,
            detail="Tenant context is required for dual-stack metrics",
        )

    if requested_tenant and requested_tenant != current_user.tenant_id:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to query another tenant's metrics",
        )

    return current_user.tenant_id


@router.get("/current", response_model=MetricsResponse)
async def get_current_metrics(
    tenant_id: str | None = Query(None, description="Filter by tenant ID"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get current dual-stack metrics.

    Returns real-time metrics for subscribers, IP allocation, connectivity,
    performance, and migration progress.
    """
    try:
        effective_tenant = _resolve_tenant_scope(current_user, tenant_id)
        collector = DualStackMetricsCollector(session=session, tenant_id=effective_tenant)
        metrics = await collector.collect_all_metrics()

        return metrics.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to collect metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to collect metrics: {str(e)}")


@router.get("/summary", response_model=SummaryResponse)
async def get_metrics_summary(
    tenant_id: str | None = Query(None, description="Filter by tenant ID"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get high-level metrics summary.

    Returns a condensed view of key metrics for dashboard overview.
    """
    try:
        effective_tenant = _resolve_tenant_scope(current_user, tenant_id)
        collector = DualStackMetricsCollector(session=session, tenant_id=effective_tenant)
        metrics = await collector.collect_all_metrics()

        # Evaluate alerts
        evaluator = AlertEvaluator()
        alerts = evaluator.evaluate(metrics)

        # Determine health status
        critical_alerts = [a for a in alerts if a["severity"] == "critical"]
        warning_alerts = [a for a in alerts if a["severity"] == "warning"]

        if critical_alerts:
            health_status = "critical"
        elif warning_alerts:
            health_status = "warning"
        else:
            health_status = "healthy"

        return {
            "total_subscribers": metrics.total_subscribers,
            "dual_stack_percentage": round(metrics.dual_stack_percentage, 2),
            "ipv4_pool_utilization": round(metrics.ipv4_pool_utilization, 2),
            "ipv6_prefix_utilization": round(metrics.ipv6_prefix_utilization, 2),
            "ipv4_connectivity_percentage": round(metrics.ipv4_connectivity_percentage, 2),
            "ipv6_connectivity_percentage": round(metrics.ipv6_connectivity_percentage, 2),
            "active_alerts": len(alerts),
            "health_status": health_status,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get metrics summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get metrics summary: {str(e)}")


@router.get("/alerts", response_model=AlertResponse)
async def get_alerts(
    tenant_id: str | None = Query(None, description="Filter by tenant ID"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Evaluate metrics and return active alerts.

    Returns alerts based on predefined thresholds for various metrics.
    """
    try:
        effective_tenant = _resolve_tenant_scope(current_user, tenant_id)
        collector = DualStackMetricsCollector(session=session, tenant_id=effective_tenant)
        metrics = await collector.collect_all_metrics()

        evaluator = AlertEvaluator()
        alerts = evaluator.evaluate(metrics)

        critical_count = sum(1 for a in alerts if a["severity"] == "critical")
        warning_count = sum(1 for a in alerts if a["severity"] == "warning")

        return {
            "alerts": alerts,
            "total_alerts": len(alerts),
            "critical_count": critical_count,
            "warning_count": warning_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to evaluate alerts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to evaluate alerts: {str(e)}")


@router.get("/trend/{metric_name}", response_model=TrendDataResponse)
async def get_metric_trend(
    metric_name: str,
    period: MetricPeriod = Query(MetricPeriod.LAST_DAY, description="Time period"),
    tenant_id: str | None = Query(None, description="Filter by tenant ID"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get trend data for a specific metric over time.

    Useful for visualizing metric changes over different time periods.
    """
    try:
        effective_tenant = _resolve_tenant_scope(current_user, tenant_id)

        aggregator = MetricsAggregator(session=session)
        data_points = await aggregator.get_trend_data(
            metric_name=metric_name, period=period, tenant_id=effective_tenant
        )

        return {
            "metric_name": metric_name,
            "period": period.value,
            "data_points": data_points,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get trend data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get trend data: {str(e)}")


@router.get("/top-utilization/{resource_type}")
async def get_top_utilization(
    resource_type: str,
    limit: int = Query(10, ge=1, le=100, description="Number of results to return"),
    tenant_id: str | None = Query(None, description="Filter by tenant ID"),
    session: AsyncSession = Depends(get_async_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get top resources by utilization.

    Useful for identifying heavily utilized prefixes, subnets, or other resources.
    """
    try:
        aggregator = MetricsAggregator(session=session)
        results = await aggregator.get_top_utilization(
            resource_type=resource_type, limit=limit, tenant_id=tenant_id
        )

        return {
            "resource_type": resource_type,
            "limit": limit,
            "results": results,
        }

    except Exception as e:
        logger.error(f"Failed to get top utilization: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get top utilization: {str(e)}")


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for metrics API."""
    return {"status": "healthy", "service": "dual-stack-metrics"}
