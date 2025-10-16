"""
Network Monitoring API Router

REST endpoints for device health, traffic stats, alerts, and dashboard.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.dependencies import require_user
from dotmac.platform.auth.models import User
from dotmac.platform.core.database import get_async_session
from dotmac.platform.network_monitoring.schemas import (
    AcknowledgeAlertRequest,
    AlertSeverity,
    CreateAlertRuleRequest,
    DeviceHealthResponse,
    DeviceMetricsResponse,
    DeviceType,
    NetworkAlertResponse,
    NetworkOverviewResponse,
    TrafficStatsResponse,
)
from dotmac.platform.network_monitoring.service import NetworkMonitoringService

logger = structlog.get_logger(__name__)

router = APIRouter()


# Dependency to get monitoring service
async def get_monitoring_service(
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> NetworkMonitoringService:
    """Get network monitoring service instance."""
    # Initialize service with actual clients
    # For now, passing None - clients would be injected via dependency injection
    return NetworkMonitoringService(
        netbox_client=None,
        voltha_client=None,
        genieacs_client=None,
        radius_client=None,
    )


# ============================================================================
# Dashboard & Overview
# ============================================================================


@router.get(
    "/network/overview",
    response_model=NetworkOverviewResponse,
    summary="Get network overview",
    description="Get comprehensive network monitoring dashboard with device counts, alerts, and bandwidth",
)
async def get_network_overview(
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
) -> NetworkOverviewResponse:
    """Get network overview dashboard."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        overview = await service.get_network_overview(tenant_id)
        return overview

    except Exception as e:
        logger.error("Failed to get network overview", error=str(e), tenant_id=tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get network overview: {str(e)}",
        ) from e


# ============================================================================
# Device Health & Metrics
# ============================================================================


@router.get(
    "/network/devices",
    response_model=list[DeviceHealthResponse],
    summary="List all devices",
    description="Get health status for all network devices in the tenant",
)
async def list_devices(
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
    device_type: DeviceType | None = Query(None, description="Filter by device type"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
) -> list[DeviceHealthResponse]:
    """List all network devices with health status."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        # Get all devices from service
        devices = await service.get_all_devices(tenant_id, device_type)

        # Apply status filter if provided
        if status_filter:
            devices = [d for d in devices if d.status.value == status_filter]

        return devices

    except Exception as e:
        logger.error("Failed to list devices", error=str(e), tenant_id=tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list devices: {str(e)}",
        ) from e


@router.get(
    "/network/devices/{device_id}/health",
    response_model=DeviceHealthResponse,
    summary="Get device health",
    description="Get detailed health status for a specific device",
)
async def get_device_health(
    device_id: str,
    device_type: DeviceType = Query(..., description="Device type"),
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
) -> DeviceHealthResponse:
    """Get device health status."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        health = await service.get_device_health(device_id, device_type, tenant_id)
        if not health:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )

        return health

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get device health",
            error=str(e),
            device_id=device_id,
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device health: {str(e)}",
        ) from e


@router.get(
    "/network/devices/{device_id}/metrics",
    response_model=DeviceMetricsResponse,
    summary="Get device metrics",
    description="Get comprehensive metrics (health + traffic + device-specific) for a device",
)
async def get_device_metrics(
    device_id: str,
    device_type: DeviceType = Query(..., description="Device type"),
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
) -> DeviceMetricsResponse:
    """Get comprehensive device metrics."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        metrics = await service.get_device_metrics(device_id, device_type, tenant_id)
        if not metrics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )

        return metrics

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get device metrics",
            error=str(e),
            device_id=device_id,
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device metrics: {str(e)}",
        ) from e


@router.get(
    "/network/devices/{device_id}/traffic",
    response_model=TrafficStatsResponse,
    summary="Get device traffic",
    description="Get traffic and bandwidth statistics for a device",
)
async def get_device_traffic(
    device_id: str,
    device_type: DeviceType = Query(..., description="Device type"),
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
) -> TrafficStatsResponse:
    """Get device traffic statistics."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        traffic = await service.get_traffic_stats(device_id, device_type, tenant_id)
        if not traffic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )

        return traffic

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get device traffic",
            error=str(e),
            device_id=device_id,
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device traffic: {str(e)}",
        ) from e


# ============================================================================
# Alerts
# ============================================================================


@router.get(
    "/network/alerts",
    response_model=list[NetworkAlertResponse],
    summary="List alerts",
    description="Get network monitoring alerts with filtering",
)
async def list_alerts(
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
    severity: AlertSeverity | None = Query(None, description="Filter by severity"),
    active_only: bool = Query(True, description="Show only active alerts"),
    device_id: str | None = Query(None, description="Filter by device ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of alerts"),
) -> list[NetworkAlertResponse]:
    """List network alerts."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        alerts = await service.get_alerts(
            tenant_id=tenant_id,
            severity=severity,
            active_only=active_only,
            device_id=device_id,
            limit=limit,
        )
        return alerts

    except Exception as e:
        logger.error("Failed to list alerts", error=str(e), tenant_id=tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list alerts: {str(e)}",
        ) from e


@router.post(
    "/network/alerts/{alert_id}/acknowledge",
    response_model=NetworkAlertResponse,
    summary="Acknowledge alert",
    description="Acknowledge an active alert",
)
async def acknowledge_alert(
    alert_id: str,
    request: AcknowledgeAlertRequest,
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
) -> NetworkAlertResponse:
    """Acknowledge an alert."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        alert = await service.acknowledge_alert(
            alert_id=alert_id,
            tenant_id=tenant_id,
            user_id=current_user.user_id,
            note=request.note,
        )

        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert {alert_id} not found",
            )

        return alert

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to acknowledge alert",
            error=str(e),
            alert_id=alert_id,
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge alert: {str(e)}",
        ) from e


@router.post(
    "/network/alerts/rules",
    response_model=dict,
    summary="Create alert rule",
    description="Create a new alert rule for monitoring",
    status_code=status.HTTP_201_CREATED,
)
async def create_alert_rule(
    request: CreateAlertRuleRequest,
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
) -> dict:
    """Create an alert rule."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        rule = await service.create_alert_rule(
            tenant_id=tenant_id,
            name=request.name,
            description=request.description,
            device_type=request.device_type,
            metric_name=request.metric_name,
            condition=request.condition,
            threshold=request.threshold,
            severity=request.severity,
            enabled=request.enabled,
        )

        return rule

    except Exception as e:
        logger.error("Failed to create alert rule", error=str(e), tenant_id=tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create alert rule: {str(e)}",
        ) from e


@router.get(
    "/network/alerts/rules",
    response_model=list[dict],
    summary="List alert rules",
    description="Get all alert rules for the tenant",
)
async def list_alert_rules(
    current_user: Annotated[User, Depends(require_user)],
    service: Annotated[NetworkMonitoringService, Depends(get_monitoring_service)],
) -> list[dict]:
    """List alert rules."""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a tenant",
            )

        rules = await service.get_alert_rules(tenant_id)
        return rules

    except Exception as e:
        logger.error("Failed to list alert rules", error=str(e), tenant_id=tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list alert rules: {str(e)}",
        ) from e
