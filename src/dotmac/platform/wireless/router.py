"""
Wireless Infrastructure API Router

REST API endpoints for wireless network infrastructure management.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth.core import UserInfo, get_current_user
from ..auth.rbac_dependencies import require_permission
from ..db import get_db
from ..user_management.models import User
from .models import CoverageType, DeviceStatus, DeviceType
from .schemas import (
    CoverageZoneCreate,
    CoverageZoneResponse,
    CoverageZoneUpdate,
    DeviceHealthSummary,
    SignalMeasurementCreate,
    SignalMeasurementResponse,
    WirelessClientResponse,
    WirelessDeviceCreate,
    WirelessDeviceResponse,
    WirelessDeviceUpdate,
    WirelessRadioCreate,
    WirelessRadioResponse,
    WirelessRadioUpdate,
    WirelessStatistics,
)
from .service import WirelessService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/wireless", tags=["Wireless Infrastructure"])


def get_wireless_service(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WirelessService:
    """Dependency to get wireless service"""
    return WirelessService(db=db, tenant_id=current_user.tenant_id)


# ============================================================================
# Wireless Device Endpoints
# ============================================================================


@router.post(
    "/devices",
    response_model=WirelessDeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Wireless Device",
    description="Register a new wireless infrastructure device (AP, Radio, CPE, etc.)",
)
async def create_device(
    data: WirelessDeviceCreate,
    service: WirelessService = Depends(get_wireless_service),
    current_user: User = Depends(get_current_user),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> WirelessDeviceResponse:
    """Create a new wireless device"""
    try:
        device = service.create_device(data)
        return WirelessDeviceResponse.model_validate(device, from_attributes=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("wireless.device.create.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create wireless device",
        )


@router.get(
    "/devices",
    response_model=list[WirelessDeviceResponse],
    summary="List Wireless Devices",
    description="List wireless infrastructure devices with filters",
)
async def list_devices(
    device_type: DeviceType | None = Query(None, description="Filter by device type"),
    status_filter: DeviceStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    site_name: str | None = Query(None, description="Filter by site name"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> list[WirelessDeviceResponse]:
    """List wireless devices"""
    try:
        devices = service.list_devices(
            device_type=device_type,
            status=status_filter,
            site_name=site_name,
            limit=limit,
            offset=offset,
        )
        return [WirelessDeviceResponse.model_validate(d, from_attributes=True) for d in devices]
    except Exception as e:
        logger.exception("wireless.devices.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list wireless devices",
        )


@router.get(
    "/devices/{device_id}",
    response_model=WirelessDeviceResponse,
    summary="Get Wireless Device",
    description="Get detailed information about a wireless device",
)
async def get_device(
    device_id: UUID,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> WirelessDeviceResponse:
    """Get wireless device by ID"""
    device = service.get_device(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wireless device not found: {device_id}",
        )
    return WirelessDeviceResponse.model_validate(device, from_attributes=True)


@router.patch(
    "/devices/{device_id}",
    response_model=WirelessDeviceResponse,
    summary="Update Wireless Device",
    description="Update wireless device configuration and metadata",
)
async def update_device(
    device_id: UUID,
    data: WirelessDeviceUpdate,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> WirelessDeviceResponse:
    """Update wireless device"""
    try:
        device = service.update_device(device_id, data)
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Wireless device not found: {device_id}",
            )
        return WirelessDeviceResponse.model_validate(device, from_attributes=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("wireless.device.update.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update wireless device",
        )


@router.delete(
    "/devices/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Wireless Device",
    description="Delete a wireless device and all associated data",
)
async def delete_device(
    device_id: UUID,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> None:
    """Delete wireless device"""
    success = service.delete_device(device_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wireless device not found: {device_id}",
        )


@router.get(
    "/devices/{device_id}/health",
    response_model=DeviceHealthSummary,
    summary="Get Device Health",
    description="Get comprehensive health summary for a wireless device",
)
async def get_device_health(
    device_id: UUID,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> DeviceHealthSummary:
    """Get device health summary"""
    health = service.get_device_health(device_id)
    if not health:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wireless device not found: {device_id}",
        )
    return health


# ============================================================================
# Wireless Radio Endpoints
# ============================================================================


@router.post(
    "/radios",
    response_model=WirelessRadioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Wireless Radio",
    description="Add a radio interface to a wireless device",
)
async def create_radio(
    data: WirelessRadioCreate,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> WirelessRadioResponse:
    """Create a new wireless radio"""
    try:
        radio = service.create_radio(data)
        return WirelessRadioResponse.model_validate(radio, from_attributes=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("wireless.radio.create.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create wireless radio",
        )


@router.get(
    "/radios",
    response_model=list[WirelessRadioResponse],
    summary="List Wireless Radios",
    description="List wireless radio interfaces with filters",
)
async def list_radios(
    device_id: UUID | None = Query(None, description="Filter by device ID"),
    enabled: bool | None = Query(None, description="Filter by enabled status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> list[WirelessRadioResponse]:
    """List wireless radios"""
    try:
        radios = service.list_radios(
            device_id=device_id,
            enabled=enabled,
            limit=limit,
            offset=offset,
        )
        return [WirelessRadioResponse.model_validate(r, from_attributes=True) for r in radios]
    except Exception as e:
        logger.exception("wireless.radios.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list wireless radios",
        )


@router.get(
    "/radios/{radio_id}",
    response_model=WirelessRadioResponse,
    summary="Get Wireless Radio",
    description="Get detailed information about a wireless radio",
)
async def get_radio(
    radio_id: UUID,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> WirelessRadioResponse:
    """Get wireless radio by ID"""
    radio = service.get_radio(radio_id)
    if not radio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wireless radio not found: {radio_id}",
        )
    return WirelessRadioResponse.model_validate(radio, from_attributes=True)


@router.patch(
    "/radios/{radio_id}",
    response_model=WirelessRadioResponse,
    summary="Update Wireless Radio",
    description="Update wireless radio configuration",
)
async def update_radio(
    radio_id: UUID,
    data: WirelessRadioUpdate,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> WirelessRadioResponse:
    """Update wireless radio"""
    try:
        radio = service.update_radio(radio_id, data)
        if not radio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Wireless radio not found: {radio_id}",
            )
        return WirelessRadioResponse.model_validate(radio, from_attributes=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("wireless.radio.update.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update wireless radio",
        )


@router.delete(
    "/radios/{radio_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Wireless Radio",
    description="Delete a wireless radio",
)
async def delete_radio(
    radio_id: UUID,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> None:
    """Delete wireless radio"""
    success = service.delete_radio(radio_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wireless radio not found: {radio_id}",
        )


# ============================================================================
# Coverage Zone Endpoints
# ============================================================================


@router.post(
    "/coverage-zones",
    response_model=CoverageZoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Coverage Zone",
    description="Define a wireless coverage zone with geographic boundaries",
)
async def create_coverage_zone(
    data: CoverageZoneCreate,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> CoverageZoneResponse:
    """Create a new coverage zone"""
    try:
        zone = service.create_coverage_zone(data)
        return CoverageZoneResponse.model_validate(zone, from_attributes=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("wireless.coverage_zone.create.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create coverage zone",
        )


@router.get(
    "/coverage-zones",
    response_model=list[CoverageZoneResponse],
    summary="List Coverage Zones",
    description="List wireless coverage zones with filters",
)
async def list_coverage_zones(
    device_id: UUID | None = Query(None, description="Filter by device ID"),
    coverage_type: CoverageType | None = Query(None, description="Filter by coverage type"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> list[CoverageZoneResponse]:
    """List coverage zones"""
    try:
        zones = service.list_coverage_zones(
            device_id=device_id,
            coverage_type=coverage_type,
            limit=limit,
            offset=offset,
        )
        return [CoverageZoneResponse.model_validate(z, from_attributes=True) for z in zones]
    except Exception as e:
        logger.exception("wireless.coverage_zones.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list coverage zones",
        )


@router.get(
    "/coverage-zones/{zone_id}",
    response_model=CoverageZoneResponse,
    summary="Get Coverage Zone",
    description="Get detailed information about a coverage zone",
)
async def get_coverage_zone(
    zone_id: UUID,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> CoverageZoneResponse:
    """Get coverage zone by ID"""
    zone = service.get_coverage_zone(zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Coverage zone not found: {zone_id}",
        )
    return CoverageZoneResponse.model_validate(zone, from_attributes=True)


@router.patch(
    "/coverage-zones/{zone_id}",
    response_model=CoverageZoneResponse,
    summary="Update Coverage Zone",
    description="Update coverage zone boundaries and metadata",
)
async def update_coverage_zone(
    zone_id: UUID,
    data: CoverageZoneUpdate,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> CoverageZoneResponse:
    """Update coverage zone"""
    try:
        zone = service.update_coverage_zone(zone_id, data)
        if not zone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Coverage zone not found: {zone_id}",
            )
        return CoverageZoneResponse.model_validate(zone, from_attributes=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("wireless.coverage_zone.update.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update coverage zone",
        )


@router.delete(
    "/coverage-zones/{zone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Coverage Zone",
    description="Delete a coverage zone",
)
async def delete_coverage_zone(
    zone_id: UUID,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> None:
    """Delete coverage zone"""
    success = service.delete_coverage_zone(zone_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Coverage zone not found: {zone_id}",
        )


# ============================================================================
# Signal Measurement Endpoints
# ============================================================================


@router.post(
    "/signal-measurements",
    response_model=SignalMeasurementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Signal Measurement",
    description="Record signal strength and quality measurements",
)
async def create_signal_measurement(
    data: SignalMeasurementCreate,
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.write")),
) -> SignalMeasurementResponse:
    """Create a new signal measurement"""
    try:
        measurement = service.create_signal_measurement(data)
        return SignalMeasurementResponse.model_validate(measurement, from_attributes=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("wireless.signal_measurement.create.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create signal measurement",
        )


@router.get(
    "/signal-measurements",
    response_model=list[SignalMeasurementResponse],
    summary="List Signal Measurements",
    description="List signal measurements with filters",
)
async def list_signal_measurements(
    device_id: UUID | None = Query(None, description="Filter by device ID"),
    hours: int = Query(24, ge=1, le=168, description="Hours of history to retrieve"),
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> list[SignalMeasurementResponse]:
    """List signal measurements"""
    try:
        since = datetime.now(UTC) - timedelta(hours=hours)

        measurements = service.list_signal_measurements(
            device_id=device_id,
            since=since,
            limit=limit,
            offset=offset,
        )
        return [
            SignalMeasurementResponse.model_validate(m, from_attributes=True) for m in measurements
        ]
    except Exception as e:
        logger.exception("wireless.signal_measurements.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list signal measurements",
        )


# ============================================================================
# Wireless Client Endpoints
# ============================================================================


@router.get(
    "/clients",
    response_model=list[WirelessClientResponse],
    summary="List Wireless Clients",
    description="List connected wireless clients",
)
async def list_wireless_clients(
    device_id: UUID | None = Query(None, description="Filter by device ID"),
    connected_only: bool = Query(True, description="Show only currently connected clients"),
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> list[WirelessClientResponse]:
    """List wireless clients"""
    try:
        clients = service.list_connected_clients(
            device_id=device_id,
            connected_only=connected_only,
            limit=limit,
            offset=offset,
        )
        return [WirelessClientResponse.model_validate(c, from_attributes=True) for c in clients]
    except Exception as e:
        logger.exception("wireless.clients.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list wireless clients",
        )


# ============================================================================
# Statistics Endpoints
# ============================================================================


@router.get(
    "/statistics",
    response_model=WirelessStatistics,
    summary="Get Wireless Statistics",
    description="Get aggregated wireless infrastructure statistics",
)
async def get_statistics(
    service: WirelessService = Depends(get_wireless_service),
    _: UserInfo = Depends(require_permission("isp.network.wireless.read")),
) -> WirelessStatistics:
    """Get wireless statistics"""
    try:
        return service.get_statistics()
    except Exception as e:
        logger.exception("wireless.statistics.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get wireless statistics",
        )


__all__ = ["router"]
