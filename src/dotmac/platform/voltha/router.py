"""
VOLTHA API Router

FastAPI endpoints for VOLTHA PON management operations.
"""


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.tenant.oss_config import OSSService, get_service_config
from dotmac.platform.voltha.client import VOLTHAClient
from dotmac.platform.voltha.schemas import (
    Adapter,
    DeviceDetailResponse,
    DeviceDisableRequest,
    DeviceEnableRequest,
    DeviceListResponse,
    DeviceOperationResponse,
    DeviceRebootRequest,
    DeviceType,
    LogicalDeviceDetailResponse,
    LogicalDeviceListResponse,
    PONStatistics,
    VOLTHAHealthResponse,
)
from dotmac.platform.voltha.service import VOLTHAService

router = APIRouter(prefix="/api/v1/voltha", tags=["voltha"])


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
):
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
):
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
):
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
):
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
):
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
):
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
):
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
):
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
):
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
):
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
):
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
):
    """List device types"""
    return await service.get_device_types()
