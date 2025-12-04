"""
VOLTHA API Router

FastAPI endpoints for VOLTHA PON management operations.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.settings import Settings, get_settings
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.tenant.oss_config import OSSService, get_service_config
from dotmac.platform.voltha.client import VOLTHAClient
from dotmac.platform.voltha.schemas import (
    Adapter,
    AlarmAcknowledgeRequest,
    AlarmClearRequest,
    AlarmOperationResponse,
    DeviceDetailResponse,
    DeviceDisableRequest,
    DeviceEnableRequest,
    DeviceListResponse,
    DeviceOperationResponse,
    DeviceRebootRequest,
    DeviceType,
    LogicalDeviceDetailResponse,
    LogicalDeviceListResponse,
    ONUDiscoveryResponse,
    ONUProvisionRequest,
    ONUProvisionResponse,
    PONStatistics,
    VOLTHAAlarmListResponse,
    VOLTHAEventStreamResponse,
    VOLTHAHealthResponse,
)
from dotmac.platform.voltha.service import VOLTHAService

router = APIRouter(prefix="/voltha", tags=["VOLTHA"])


# =============================================================================
# Dependency
# =============================================================================


async def get_voltha_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> VOLTHAService:
    """Get VOLTHA service instance for current tenant."""
    _, tenant = tenant_access
    try:
        config = await get_service_config(session, tenant.id, OSSService.VOLTHA)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    client = VOLTHAClient(
        base_url=config.url,
        username=config.username,
        password=config.password,
        api_token=config.api_token,
        verify_ssl=config.verify_ssl,
        timeout_seconds=config.timeout_seconds,
        max_retries=config.max_retries,
    )
    return VOLTHAService(client=client)


# =============================================================================
# Health Check
# =============================================================================


@router.get(
    "/health",
    response_model=VOLTHAHealthResponse,
    summary="VOLTHA Health Check",
    description="Check VOLTHA connectivity and status",
)
async def health_check(
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> VOLTHAHealthResponse:
    """Check VOLTHA health"""
    return await service.health_check()


# =============================================================================
# Physical Device Endpoints (ONUs)
# =============================================================================


@router.get(
    "/devices",
    response_model=DeviceListResponse,
    summary="List ONUs",
    description="List all ONU devices",
)
async def list_devices(
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> DeviceListResponse:
    """List ONU devices"""
    return await service.list_devices()


@router.get(
    "/devices/{device_id}",
    response_model=DeviceDetailResponse,
    summary="Get ONU Device",
    description="Get ONU device details",
)
async def get_device(
    device_id: str,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> DeviceDetailResponse:
    """Get ONU device"""
    device = await service.get_device(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return device


@router.post(
    "/devices/enable",
    response_model=DeviceOperationResponse,
    summary="Enable ONU",
    description="Enable ONU device",
)
async def enable_device(
    request: DeviceEnableRequest,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.write")),
) -> DeviceOperationResponse:
    """Enable ONU device"""
    return await service.enable_device(request.device_id)


@router.post(
    "/devices/disable",
    response_model=DeviceOperationResponse,
    summary="Disable ONU",
    description="Disable ONU device",
)
async def disable_device(
    request: DeviceDisableRequest,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.write")),
) -> DeviceOperationResponse:
    """Disable ONU device"""
    return await service.disable_device(request.device_id)


@router.post(
    "/devices/reboot",
    response_model=DeviceOperationResponse,
    summary="Reboot ONU",
    description="Reboot ONU device",
)
async def reboot_device(
    request: DeviceRebootRequest,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.write")),
) -> DeviceOperationResponse:
    """Reboot ONU device"""
    return await service.reboot_device(request.device_id)


@router.delete(
    "/devices/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete ONU",
    description="Delete ONU device",
)
async def delete_device(
    device_id: str,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.write")),
) -> None:
    """Delete ONU device"""
    deleted = await service.delete_device(device_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return None


# =============================================================================
# Logical Device Endpoints (OLTs)
# =============================================================================


@router.get(
    "/logical-devices",
    response_model=LogicalDeviceListResponse,
    summary="List OLTs",
    description="List all OLT devices",
)
async def list_logical_devices(
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> LogicalDeviceListResponse:
    """List OLT devices"""
    return await service.list_logical_devices()


@router.get(
    "/logical-devices/{device_id}",
    response_model=LogicalDeviceDetailResponse,
    summary="Get OLT Device",
    description="Get OLT device details with ports and flows",
)
async def get_logical_device(
    device_id: str,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> LogicalDeviceDetailResponse:
    """Get OLT device"""
    device = await service.get_logical_device(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Logical device {device_id} not found",
        )
    return device


# =============================================================================
# Statistics and Information
# =============================================================================


@router.get(
    "/statistics",
    response_model=PONStatistics,
    summary="Get PON Statistics",
    description="Get aggregate PON network statistics",
)
async def get_pon_statistics(
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> PONStatistics:
    """Get PON statistics"""
    return await service.get_pon_statistics()


@router.get(
    "/adapters",
    response_model=list[Adapter],
    summary="List Adapters",
    description="List all device adapters",
)
async def get_adapters(
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> list[Adapter]:
    """List adapters"""
    return await service.get_adapters()


@router.get(
    "/device-types",
    response_model=list[DeviceType],
    summary="List Device Types",
    description="List all supported device types",
)
async def get_device_types(
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> list[DeviceType]:
    """List device types"""
    return await service.get_device_types()


# =============================================================================
# ONU Auto-Discovery Endpoints
# =============================================================================


@router.get(
    "/discover-onus",
    response_model=ONUDiscoveryResponse,
    summary="Discover ONUs",
    description="Discover ONUs on PON network that are not yet provisioned",
)
async def discover_onus(
    olt_device_id: str | None = None,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.write")),
) -> ONUDiscoveryResponse:
    """
    Discover ONUs that are connected to PON ports but not yet provisioned.

    This endpoint scans PON ports for discovered ONUs and returns a list of
    devices that are ready to be provisioned. ONUs are identified by their
    serial number and the PON port they are connected to.

    Query Parameters:
    - olt_device_id: Optional OLT device ID to scan. If not provided, scans all OLTs.

    Returns a list of discovered ONUs with:
    - Serial number
    - Vendor ID
    - OLT device ID
    - PON port number
    - Discovery timestamp
    """
    return await service.discover_onus(olt_device_id)


@router.post(
    "/provision-onu",
    response_model=ONUProvisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision ONU",
    description="Provision a discovered ONU with service configuration",
)
async def provision_onu(
    request: ONUProvisionRequest,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.write")),
) -> ONUProvisionResponse:
    """
    Provision a discovered ONU.

    This endpoint activates an ONU and configures it with the specified
    service parameters. The ONU must have been previously discovered via
    the discover-onus endpoint.

    Request Body:
    - serial_number: ONU serial number (from discovery)
    - olt_device_id: Parent OLT device ID
    - pon_port: PON port number
    - subscriber_id: Optional subscriber ID to associate
    - vlan: Optional service VLAN
    - bandwidth_profile: Optional bandwidth profile name

    The provisioning process:
    1. Locates the ONU by serial number
    2. Verifies OLT and PON port match
    3. Enables the ONU device
    4. Configures service parameters (VLAN, bandwidth)
    5. Associates with subscriber (if provided)

    Returns provisioning result with device ID if successful.
    """
    return await service.provision_onu(request)


# =============================================================================
# Alarm and Event Endpoints
# =============================================================================


@router.get(
    "/alarms",
    response_model=VOLTHAAlarmListResponse,
    summary="Get VOLTHA Alarms",
    description="Retrieve alarms from VOLTHA network devices",
)
async def get_alarms(
    device_id: str | None = None,
    severity: str | None = None,
    state: str | None = None,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> VOLTHAAlarmListResponse:
    """
    Get VOLTHA alarms with optional filtering.

    Query Parameters:
    - device_id: Filter alarms for specific device
    - severity: Filter by severity (INDETERMINATE, WARNING, MINOR, MAJOR, CRITICAL)
    - state: Filter by state (RAISED, CLEARED)

    Returns a list of alarms with:
    - Alarm ID and type
    - Severity and category
    - State (raised/cleared)
    - Resource ID (device)
    - Description and context
    - Timestamps

    Also includes summary statistics:
    - Total alarms
    - Active alarms (state=RAISED)
    - Cleared alarms (state=CLEARED)
    """
    return await service.get_alarms(device_id, severity, state)


@router.get(
    "/events",
    response_model=VOLTHAEventStreamResponse,
    summary="Get VOLTHA Events",
    description="Retrieve events from VOLTHA network",
)
async def get_events(
    device_id: str | None = None,
    event_type: str | None = None,
    limit: int = 100,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.read")),
) -> VOLTHAEventStreamResponse:
    """
    Get VOLTHA events with optional filtering.

    Query Parameters:
    - device_id: Filter events for specific device
    - event_type: Filter by event type (onu_discovered, onu_activated, etc.)
    - limit: Maximum number of events to return (default: 100)

    Event types include:
    - onu_discovered: New ONU discovered on PON port
    - onu_activated: ONU successfully activated
    - onu_deactivated: ONU deactivated
    - onu_los: ONU loss of signal
    - olt_port_up: OLT port came online
    - olt_port_down: OLT port went offline
    - device_state_change: Device state changed

    Returns a list of events with:
    - Event ID and type
    - Category
    - Resource ID (device)
    - Description and context
    - Timestamp
    """
    return await service.get_events(device_id, event_type, limit)


@router.post(
    "/alarms/{alarm_id}/acknowledge",
    response_model=AlarmOperationResponse,
    summary="Acknowledge VOLTHA Alarm",
    description="Acknowledge a specific alarm in VOLTHA",
)
async def acknowledge_alarm(
    alarm_id: str,
    request: AlarmAcknowledgeRequest,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.write")),
    settings: Settings = Depends(get_settings),
) -> AlarmOperationResponse:
    """
    Acknowledge a VOLTHA alarm.

    This operation marks the alarm as acknowledged in VOLTHA and tracks
    who acknowledged it and when. Useful for alarm workflow management.

    Path Parameters:
    - alarm_id: The unique identifier of the alarm to acknowledge

    Request Body:
    - acknowledged_by: Username of the person acknowledging the alarm
    - note: Optional note about the acknowledgement

    Returns:
    - success: Boolean indicating if operation succeeded
    - message: Human-readable message about the operation
    - alarm_id: The alarm ID that was acknowledged
    - operation: Always "acknowledge"
    - timestamp: ISO timestamp of when the operation occurred

    Required Permission: isp.network.pon.write
    """
    if not settings.features.pon_alarm_actions_enabled:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Alarm acknowledgement is disabled by feature flag",
        )
    return await service.acknowledge_alarm(alarm_id, request)


@router.post(
    "/alarms/{alarm_id}/clear",
    response_model=AlarmOperationResponse,
    summary="Clear VOLTHA Alarm",
    description="Clear a specific alarm in VOLTHA",
)
async def clear_alarm(
    alarm_id: str,
    request: AlarmClearRequest,
    service: VOLTHAService = Depends(get_voltha_service),
    _: UserInfo = Depends(require_permission("isp.network.pon.write")),
    settings: Settings = Depends(get_settings),
) -> AlarmOperationResponse:
    """
    Clear a VOLTHA alarm.

    This operation marks the alarm as cleared in VOLTHA and tracks
    who cleared it and when. Useful for alarm resolution workflows.

    Path Parameters:
    - alarm_id: The unique identifier of the alarm to clear

    Request Body:
    - cleared_by: Username of the person clearing the alarm
    - note: Optional note about the clearing

    Returns:
    - success: Boolean indicating if operation succeeded
    - message: Human-readable message about the operation
    - alarm_id: The alarm ID that was cleared
    - operation: Always "clear"
    - timestamp: ISO timestamp of when the operation occurred

    Required Permission: isp.network.pon.write
    """
    if not settings.features.pon_alarm_actions_enabled:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Alarm clear is disabled by feature flag",
        )
    return await service.clear_alarm(alarm_id, request)
