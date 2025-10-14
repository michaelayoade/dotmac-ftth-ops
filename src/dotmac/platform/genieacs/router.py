"""
GenieACS API Router

FastAPI endpoints for GenieACS CPE management operations.
"""


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.tenant.oss_config import OSSService, get_service_config
from dotmac.platform.genieacs.client import GenieACSClient
from dotmac.platform.genieacs.schemas import (
    CPEConfigRequest,
    DeviceListResponse,
    DeviceQuery,
    DeviceResponse,
    DeviceStatsResponse,
    DeviceStatusResponse,
    FactoryResetRequest,
    FaultResponse,
    FileResponse,
    FirmwareDownloadRequest,
    GenieACSHealthResponse,
    GetParameterRequest,
    PresetCreate,
    PresetResponse,
    PresetUpdate,
    ProvisionResponse,
    RebootRequest,
    RefreshRequest,
    SetParameterRequest,
    TaskResponse,
)
from dotmac.platform.genieacs.service import GenieACSService

router = APIRouter(prefix="/api/v1/genieacs", tags=["genieacs"])


# =============================================================================
# Dependency: Get GenieACS Service
# =============================================================================


async def get_genieacs_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> GenieACSService:
    """Get GenieACS service instance for the active tenant."""
    _, tenant = tenant_access
    try:
        config = await get_service_config(session, tenant.id, OSSService.GENIEACS)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    client = GenieACSClient(
        base_url=config.url,
        username=config.username,
        password=config.password,
        verify_ssl=config.verify_ssl,
        timeout_seconds=config.timeout_seconds,
        max_retries=config.max_retries,
    )
    return GenieACSService(client=client)


# =============================================================================
# Health Check
# =============================================================================


@router.get(
    "/health",
    response_model=GenieACSHealthResponse,
    summary="GenieACS Health Check",
    description="Check GenieACS connectivity and status",
)
async def health_check(
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """Check GenieACS health"""
    return await service.health_check()


# =============================================================================
# Device Management Endpoints
# =============================================================================


@router.get(
    "/devices",
    response_model=DeviceListResponse,
    summary="List CPE Devices",
    description="List all CPE devices managed by GenieACS",
)
async def list_devices(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records"),
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """List CPE devices"""
    query = DeviceQuery(skip=skip, limit=limit)
    return await service.list_devices(query)


@router.get(
    "/devices/{device_id}",
    response_model=DeviceResponse,
    summary="Get CPE Device",
    description="Get CPE device details by ID",
)
async def get_device(
    device_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """Get CPE device by ID"""
    device = await service.get_device(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return device


@router.delete(
    "/devices/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete CPE Device",
    description="Delete CPE device from GenieACS",
)
async def delete_device(
    device_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Delete CPE device"""
    deleted = await service.delete_device(device_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return None


@router.get(
    "/devices/{device_id}/status",
    response_model=DeviceStatusResponse,
    summary="Get Device Status",
    description="Get CPE device online/offline status",
)
async def get_device_status(
    device_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """Get device status"""
    status_info = await service.get_device_status(device_id)
    if not status_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return status_info


@router.get(
    "/devices/stats/summary",
    response_model=DeviceStatsResponse,
    summary="Get Device Statistics",
    description="Get aggregate statistics for all CPE devices",
)
async def get_device_stats(
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """Get device statistics"""
    return await service.get_device_stats()


# =============================================================================
# Device Task Endpoints
# =============================================================================


@router.post(
    "/tasks/refresh",
    response_model=TaskResponse,
    summary="Refresh Device Parameters",
    description="Request device to refresh TR-069 parameters",
)
async def refresh_device(
    request: RefreshRequest,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Refresh device parameters"""
    return await service.refresh_device(request)


@router.post(
    "/tasks/set-parameters",
    response_model=TaskResponse,
    summary="Set Device Parameters",
    description="Set TR-069 parameter values on device",
)
async def set_parameters(
    request: SetParameterRequest,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Set device parameters"""
    return await service.set_parameters(request)


@router.post(
    "/tasks/get-parameters",
    response_model=TaskResponse,
    summary="Get Device Parameters",
    description="Get TR-069 parameter values from device",
)
async def get_parameters(
    request: GetParameterRequest,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Get device parameters"""
    return await service.get_parameters(request)


@router.post(
    "/tasks/reboot",
    response_model=TaskResponse,
    summary="Reboot Device",
    description="Send reboot command to CPE device",
)
async def reboot_device(
    request: RebootRequest,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Reboot device"""
    return await service.reboot_device(request)


@router.post(
    "/tasks/factory-reset",
    response_model=TaskResponse,
    summary="Factory Reset Device",
    description="Factory reset CPE device",
)
async def factory_reset(
    request: FactoryResetRequest,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Factory reset device"""
    return await service.factory_reset(request)


@router.post(
    "/tasks/download-firmware",
    response_model=TaskResponse,
    summary="Download Firmware",
    description="Initiate firmware download to CPE device",
)
async def download_firmware(
    request: FirmwareDownloadRequest,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Download firmware to device"""
    return await service.download_firmware(request)


# =============================================================================
# CPE Configuration Endpoint
# =============================================================================


@router.post(
    "/tasks/configure-cpe",
    response_model=TaskResponse,
    summary="Configure CPE",
    description="Configure CPE WiFi, LAN, and WAN settings",
)
async def configure_cpe(
    request: CPEConfigRequest,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Configure CPE device"""
    return await service.configure_cpe(request)


# =============================================================================
# Preset Endpoints
# =============================================================================


@router.get(
    "/presets",
    response_model=list[PresetResponse],
    summary="List Presets",
    description="List all GenieACS presets",
)
async def list_presets(
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """List presets"""
    return await service.list_presets()


@router.get(
    "/presets/{preset_id}",
    response_model=PresetResponse,
    summary="Get Preset",
    description="Get preset by ID",
)
async def get_preset(
    preset_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """Get preset by ID"""
    preset = await service.get_preset(preset_id)
    if not preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preset {preset_id} not found",
        )
    return preset


@router.post(
    "/presets",
    response_model=PresetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Preset",
    description="Create new GenieACS preset",
)
async def create_preset(
    data: PresetCreate,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Create preset"""
    try:
        return await service.create_preset(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create preset: {str(e)}",
        )


@router.patch(
    "/presets/{preset_id}",
    response_model=PresetResponse,
    summary="Update Preset",
    description="Update GenieACS preset",
)
async def update_preset(
    preset_id: str,
    data: PresetUpdate,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Update preset"""
    preset = await service.update_preset(preset_id, data)
    if not preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preset {preset_id} not found",
        )
    return preset


@router.delete(
    "/presets/{preset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Preset",
    description="Delete GenieACS preset",
)
async def delete_preset(
    preset_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Delete preset"""
    deleted = await service.delete_preset(preset_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preset {preset_id} not found",
        )
    return None


# =============================================================================
# Provision Endpoints
# =============================================================================


@router.get(
    "/provisions",
    response_model=list[ProvisionResponse],
    summary="List Provisions",
    description="List all GenieACS provision scripts",
)
async def list_provisions(
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """List provisions"""
    return await service.list_provisions()


@router.get(
    "/provisions/{provision_id}",
    response_model=ProvisionResponse,
    summary="Get Provision",
    description="Get provision script by ID",
)
async def get_provision(
    provision_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """Get provision by ID"""
    provision = await service.get_provision(provision_id)
    if not provision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provision {provision_id} not found",
        )
    return provision


# =============================================================================
# File Endpoints
# =============================================================================


@router.get(
    "/files",
    response_model=list[FileResponse],
    summary="List Files",
    description="List all files on GenieACS file server",
)
async def list_files(
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """List files"""
    return await service.list_files()


@router.get(
    "/files/{file_id}",
    response_model=FileResponse,
    summary="Get File",
    description="Get file metadata by ID",
)
async def get_file(
    file_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """Get file by ID"""
    file = await service.get_file(file_id)
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {file_id} not found",
        )
    return file


@router.delete(
    "/files/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete File",
    description="Delete file from GenieACS file server",
)
async def delete_file(
    file_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Delete file"""
    deleted = await service.delete_file(file_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {file_id} not found",
        )
    return None


# =============================================================================
# Fault Endpoints
# =============================================================================


@router.get(
    "/faults",
    response_model=list[FaultResponse],
    summary="List Faults",
    description="List GenieACS faults and errors",
)
async def list_faults(
    device_id: str | None = Query(None, description="Filter by device ID"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records"),
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
):
    """List faults"""
    return await service.list_faults(device_id=device_id, skip=skip, limit=limit)


@router.delete(
    "/faults/{fault_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Fault",
    description="Delete fault from GenieACS",
)
async def delete_fault(
    fault_id: str,
    service: GenieACSService = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
):
    """Delete fault"""
    deleted = await service.delete_fault(fault_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fault {fault_id} not found",
        )
    return None
