"""
FastAPI router exposing the access network service.

The router mirrors a subset of the VOLTHA API surface so that front-end
components can interact with both VOLTHA-driven and CLI/SNMP-driven OLTs in a
uniform way.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from dotmac.platform.access.drivers import (
    DeviceDiscovery,
    OLTAlarm,
    OltMetrics,
    ONUProvisionRequest,
    ONUProvisionResult,
)
from dotmac.platform.access.registry import AccessDriverRegistry
from dotmac.platform.access.service import AccessNetworkService, OLTOverview
from dotmac.platform.voltha.schemas import (
    DeviceDetailResponse,
    DeviceListResponse,
    LogicalDeviceDetailResponse,
    LogicalDeviceListResponse,
    PONStatistics,
    VOLTHAAlarmListResponse,
    VOLTHAHealthResponse,
)

router = APIRouter(prefix="/access", tags=["Access Network"])

_service_override: AccessNetworkService | None = None


class ProvisionPayload(BaseModel):
    serial_number: str = Field(..., description="ONU serial number")
    olt_device_id: str = Field(..., description="Parent OLT device ID")
    pon_port: int = Field(..., description="PON port number")
    subscriber_id: str | None = Field(default=None, description="Optional subscriber identifier")
    vlan: int | None = Field(default=None, description="Service VLAN")
    line_profile_id: str | None = Field(default=None, description="Driver-specific line profile")
    service_profile_id: str | None = Field(
        default=None, description="Driver-specific service profile"
    )
    bandwidth_profile: str | None = Field(default=None, description="Bandwidth profile name")


def configure_access_service(service: AccessNetworkService) -> None:
    """Allow tests or bootstrapping code to override the default service."""
    global _service_override
    _service_override = service


def get_access_service() -> AccessNetworkService:
    if _service_override:
        return _service_override

    try:
        return _default_service()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@lru_cache
def _default_service() -> AccessNetworkService:
    config_path = os.getenv("ACCESS_DRIVER_CONFIG")
    if not config_path:
        raise RuntimeError(
            "ACCESS_DRIVER_CONFIG environment variable not set; "
            "configure access driver registry before using /access endpoints."
        )

    registry = AccessDriverRegistry.from_config_file(config_path)
    return AccessNetworkService(registry)


AccessServiceDep = Annotated[AccessNetworkService, Depends(get_access_service)]


@router.get("/health", response_model=VOLTHAHealthResponse)
async def get_health(service: AccessServiceDep) -> VOLTHAHealthResponse:
    return await service.health()


@router.get("/logical-devices", response_model=LogicalDeviceListResponse)
async def list_logical_devices(service: AccessServiceDep) -> LogicalDeviceListResponse:
    return await service.list_logical_devices()


@router.get("/logical-devices/{device_id}", response_model=LogicalDeviceDetailResponse)
async def get_logical_device(
    device_id: str, service: AccessServiceDep
) -> LogicalDeviceDetailResponse:
    detail = await service.get_logical_device(device_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Logical device not found"
        )
    return detail


@router.get("/devices", response_model=DeviceListResponse)
async def list_devices(service: AccessServiceDep) -> DeviceListResponse:
    return await service.list_devices()


@router.get("/devices/{device_id}", response_model=DeviceDetailResponse)
async def get_device(device_id: str, service: AccessServiceDep) -> DeviceDetailResponse:
    detail = await service.get_device(device_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return detail


@router.post("/devices/{device_id}/{operation}")
async def operate_device(
    device_id: str,
    operation: str,
    service: AccessServiceDep,
    olt_id: str | None = None,
) -> dict[str, bool]:
    success = await service.operate_device(device_id, operation, olt_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Operation not supported"
        )
    return {"success": True}


@router.get("/alarms", response_model=VOLTHAAlarmListResponse)
async def get_alarms_v2(service: AccessServiceDep) -> VOLTHAAlarmListResponse:
    return await service.get_alarms_v2()


@router.get("/devices/{device_id}/alarms", response_model=VOLTHAAlarmListResponse)
async def get_device_alarms(device_id: str, service: AccessServiceDep) -> VOLTHAAlarmListResponse:
    alarms = await service.get_alarms_v2()
    filtered = [alarm for alarm in alarms.alarms if alarm.resource_id == device_id]
    active = sum(1 for alarm in filtered if alarm.state != "CLEARED")
    cleared = sum(1 for alarm in filtered if alarm.state == "CLEARED")
    return VOLTHAAlarmListResponse(
        alarms=filtered, total=len(filtered), active=active, cleared=cleared
    )


@router.post("/alarms/{alarm_id}/acknowledge")
async def acknowledge_alarm(alarm_id: str) -> dict[str, str]:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Alarm acknowledgement is not supported by access drivers yet",
    )


@router.post("/alarms/{alarm_id}/clear")
async def clear_alarm(alarm_id: str) -> dict[str, str]:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Alarm clearing is not supported by access drivers yet",
    )


@router.get("/devices/{olt_id}/ports/{port_no}/statistics")
async def get_port_statistics(olt_id: str, port_no: int, service: AccessServiceDep) -> dict:
    return await service.get_port_statistics(olt_id, port_no)


@router.get("/statistics", response_model=PONStatistics)
async def get_pon_statistics(service: AccessServiceDep) -> PONStatistics:
    return await service.get_statistics()


@router.get("/olts/{olt_id}/overview", response_model=OLTOverview)
async def get_olt_overview(olt_id: str, service: AccessServiceDep) -> OLTOverview:
    return await service.get_olt_overview(olt_id)


@router.get("/discover-onus", response_model=list[DeviceDiscovery])
async def discover_all_onus(service: AccessServiceDep) -> list[DeviceDiscovery]:
    return await service.discover_all_onus()


@router.get("/olts/{olt_id}/onus", response_model=list[DeviceDiscovery])
async def list_onus(olt_id: str, service: AccessServiceDep) -> list[DeviceDiscovery]:
    try:
        return await service.list_onus(olt_id)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc) or "Operation not supported",
        ) from exc


@router.get("/olts/{olt_id}/metrics", response_model=OltMetrics)
async def collect_metrics(olt_id: str, service: AccessServiceDep) -> OltMetrics:
    try:
        return await service.collect_metrics(olt_id)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc) or "Operation not supported",
        ) from exc


@router.get("/olts/{olt_id}/alarms", response_model=list[OLTAlarm])
async def fetch_alarms(olt_id: str, service: AccessServiceDep) -> list[OLTAlarm]:
    try:
        return await service.fetch_alarms(olt_id)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc) or "Operation not supported",
        ) from exc


@router.post("/olts/{olt_id}/onus", response_model=ONUProvisionResult)
async def provision_onu(
    olt_id: str,
    payload: ProvisionPayload,
    service: AccessServiceDep,
) -> ONUProvisionResult:
    request = ONUProvisionRequest(
        onu_id=f"{payload.olt_device_id}:{payload.serial_number}",
        serial_number=payload.serial_number,
        vlan=payload.vlan,
        line_profile_id=payload.line_profile_id,
        service_profile_id=payload.service_profile_id,
        metadata={
            "olt_device_id": payload.olt_device_id,
            "pon_port": payload.pon_port,
            "subscriber_id": payload.subscriber_id,
            "bandwidth_profile": payload.bandwidth_profile,
        },
    )
    try:
        return await service.provision_onu(olt_id, request)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc) or "Operation not supported",
        ) from exc


@router.delete("/olts/{olt_id}/onus/{onu_id}", response_model=bool)
async def remove_onu(olt_id: str, onu_id: str, service: AccessServiceDep) -> bool:
    try:
        return await service.remove_onu(olt_id, onu_id)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc) or "Operation not supported",
        ) from exc


@router.post("/olts/{olt_id}/onus/{onu_id}/service-profile", response_model=ONUProvisionResult)
async def apply_service_profile(
    olt_id: str,
    onu_id: str,
    profile: dict,
    service: AccessServiceDep,
) -> ONUProvisionResult:
    try:
        return await service.apply_service_profile(olt_id, onu_id, profile)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc) or "Operation not supported",
        ) from exc
