"""
GenieACS API Router

FastAPI endpoints for GenieACS CPE management operations.
"""

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
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
    FirmwareUpgradeScheduleCreate,
    FirmwareUpgradeScheduleList,
    FirmwareUpgradeScheduleResponse,
    GenieACSHealthResponse,
    GetParametersRequest,
    MassConfigJobList,
    MassConfigRequest,
    MassConfigResponse,
    PresetCreate,
    PresetResponse,
    PresetUpdate,
    ProvisionResponse,
    RebootRequest,
    RefreshRequest,
    SetParameterRequest,
    TaskResponse,
)
from dotmac.platform.genieacs.service_db import GenieACSServiceDB
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.tenant.oss_config import OSSService, get_service_config

router = APIRouter(prefix="/genieacs", tags=["GenieACS"])


# =============================================================================
# Dependency: Get GenieACS Service
# =============================================================================


async def get_genieacs_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> GenieACSServiceDB:
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
    return GenieACSServiceDB(session=session, client=client, tenant_id=tenant.id)


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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> GenieACSHealthResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> DeviceListResponse:
    """List CPE devices"""
    query = DeviceQuery(skip=skip, limit=limit)
    result = await service.list_devices(query, return_response=True)
    return cast(DeviceListResponse, result)


@router.get(
    "/devices/{device_id}",
    response_model=DeviceResponse,
    summary="Get CPE Device",
    description="Get CPE device details by ID",
)
async def get_device(
    device_id: str,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> DeviceResponse:
    """Get CPE device by ID"""
    device = await service.get_device(device_id, return_response=True)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    if isinstance(device, DeviceResponse):
        return device
    try:
        return DeviceResponse.model_validate(device)
    except Exception as exc:  # pragma: no cover - defensive serialization
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse device response: {exc}",
        ) from exc


@router.delete(
    "/devices/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete CPE Device",
    description="Delete CPE device from GenieACS",
)
async def delete_device(
    device_id: str,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> None:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> DeviceStatusResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> DeviceStatsResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> TaskResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> TaskResponse:
    """Set device parameters"""
    result = await service.set_parameters(request, return_task_response=True)
    if isinstance(result, TaskResponse):
        return result
    if isinstance(result, str):
        return TaskResponse(
            success=True,
            message=f"Set parameters task created for device {request.device_id}",
            task_id=result,
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to create set-parameters task",
    )


@router.post(
    "/tasks/get-parameters",
    response_model=TaskResponse,
    summary="Get Device Parameters",
    description="Get TR-069 parameter values from device",
)
async def get_parameters(
    request: GetParametersRequest,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> TaskResponse:
    """Get device parameters"""
    result = await service.get_parameters(request, return_task_response=True)
    if isinstance(result, TaskResponse):
        return result
    return TaskResponse(
        success=True,
        message=f"Retrieved parameters for device {request.device_id}",
        details=result,
    )


@router.post(
    "/tasks/reboot",
    response_model=TaskResponse,
    summary="Reboot Device",
    description="Send reboot command to CPE device",
)
async def reboot_device(
    request: RebootRequest,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> TaskResponse:
    """Reboot device"""
    result = await service.reboot_device(request, return_task_response=True)
    if isinstance(result, TaskResponse):
        return result
    if isinstance(result, str):
        return TaskResponse(
            success=True,
            message=f"Reboot task created for device {request.device_id}",
            task_id=result,
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to create reboot task",
    )


@router.post(
    "/tasks/factory-reset",
    response_model=TaskResponse,
    summary="Factory Reset Device",
    description="Factory reset CPE device",
)
async def factory_reset(
    request: FactoryResetRequest,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> TaskResponse:
    """Factory reset device"""
    result = await service.factory_reset(request, return_task_response=True)
    if isinstance(result, TaskResponse):
        return result
    if isinstance(result, str):
        return TaskResponse(
            success=True,
            message=f"Factory reset task created for device {request.device_id}",
            task_id=result,
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to create factory reset task",
    )


@router.post(
    "/tasks/download-firmware",
    response_model=TaskResponse,
    summary="Download Firmware",
    description="Initiate firmware download to CPE device",
)
async def download_firmware(
    request: FirmwareDownloadRequest,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> TaskResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> TaskResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> list[PresetResponse]:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> PresetResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> PresetResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> PresetResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> None:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> list[ProvisionResponse]:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> ProvisionResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> list[FileResponse]:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> FileResponse:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> None:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> list[FaultResponse]:
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
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> None:
    """Delete fault"""
    deleted = await service.delete_fault(fault_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fault {fault_id} not found",
        )
    return None


# =============================================================================
# Scheduled Firmware Upgrade Endpoints
# =============================================================================


@router.post(
    "/firmware-upgrades/schedule",
    response_model=FirmwareUpgradeScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule Firmware Upgrade",
    description="Create a scheduled firmware upgrade for multiple devices",
)
async def schedule_firmware_upgrade(
    request: FirmwareUpgradeScheduleCreate,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> FirmwareUpgradeScheduleResponse:
    """
    Schedule firmware upgrade for devices matching the filter.

    Creates a firmware upgrade schedule that can be executed immediately
    or at a specified time. The schedule will upgrade all devices matching
    the device filter query.

    Request body includes:
    - name: Schedule name
    - firmware_file: Firmware file name on GenieACS server
    - device_filter: MongoDB-style query to select devices
    - scheduled_at: Execution time (ISO 8601 format)
    - max_concurrent: Maximum concurrent upgrades

    Returns schedule details including total device count.
    """
    try:
        return await service.create_firmware_upgrade_schedule(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create firmware upgrade schedule: {str(e)}",
        )


@router.get(
    "/firmware-upgrades/schedules",
    response_model=FirmwareUpgradeScheduleList,
    summary="List Firmware Upgrade Schedules",
    description="List all firmware upgrade schedules",
)
async def list_firmware_upgrade_schedules(
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> FirmwareUpgradeScheduleList:
    """List all firmware upgrade schedules with their status."""
    return await service.list_firmware_upgrade_schedules()


@router.get(
    "/firmware-upgrades/schedules/{schedule_id}",
    response_model=FirmwareUpgradeScheduleResponse,
    summary="Get Firmware Upgrade Schedule",
    description="Get firmware upgrade schedule details and progress",
)
async def get_firmware_upgrade_schedule(
    schedule_id: str,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> FirmwareUpgradeScheduleResponse:
    """
    Get firmware upgrade schedule details including progress.

    Returns:
    - Schedule configuration
    - Total devices
    - Completed/failed/pending counts
    - Per-device upgrade results
    """
    try:
        return await service.get_firmware_upgrade_schedule(schedule_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/firmware-upgrades/schedules/{schedule_id}",
    summary="Cancel Firmware Upgrade Schedule",
    description="Cancel a pending firmware upgrade schedule",
)
async def cancel_firmware_upgrade_schedule(
    schedule_id: str,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> dict[str, Any]:
    """Cancel a pending or running firmware upgrade schedule."""
    try:
        result = await service.cancel_firmware_upgrade_schedule(schedule_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/firmware-upgrades/schedules/{schedule_id}/execute",
    response_model=FirmwareUpgradeScheduleResponse,
    summary="Execute Firmware Upgrade Schedule",
    description="Execute firmware upgrade schedule immediately",
)
async def execute_firmware_upgrade_schedule(
    schedule_id: str,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> FirmwareUpgradeScheduleResponse:
    """
    Execute firmware upgrade schedule immediately.

    This triggers the firmware upgrade process for all devices in the schedule.
    The upgrades are performed with concurrency limiting based on the
    schedule's max_concurrent setting.

    Returns updated schedule with execution progress.
    """
    try:
        return await service.execute_firmware_upgrade_schedule(schedule_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# =============================================================================
# Mass CPE Configuration Endpoints
# =============================================================================


@router.post(
    "/mass-config",
    response_model=MassConfigResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Mass Configuration Job",
    description="Create mass configuration job for multiple CPE devices",
)
async def create_mass_config_job(
    request: MassConfigRequest,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> MassConfigResponse:
    """
    Create mass configuration job for bulk CPE changes.

    Allows configuring WiFi, LAN, WAN, and custom TR-069 parameters
    across multiple devices matching a filter query.

    Features:
    - Dry-run mode for previewing affected devices
    - Device count validation
    - Concurrent operation limiting
    - Per-device result tracking

    Request body includes:
    - name: Job name
    - device_filter: MongoDB-style query with optional expected_count
    - wifi/lan/wan: Configuration changes
    - custom_parameters: Custom TR-069 parameters
    - max_concurrent: Maximum concurrent tasks
    - dry_run: Preview mode (no changes applied)

    Returns:
    - Job details
    - Device preview (if dry-run=true)
    - Results (empty for new jobs)
    """
    try:
        return await service.create_mass_config_job(request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create mass config job: {str(e)}",
        )


@router.get(
    "/mass-config/jobs",
    response_model=MassConfigJobList,
    summary="List Mass Configuration Jobs",
    description="List all mass configuration jobs",
)
async def list_mass_config_jobs(
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> MassConfigJobList:
    """List all mass configuration jobs with their status."""
    return await service.list_mass_config_jobs()


@router.get(
    "/mass-config/jobs/{job_id}",
    response_model=MassConfigResponse,
    summary="Get Mass Configuration Job",
    description="Get mass configuration job details and results",
)
async def get_mass_config_job(
    job_id: str,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.read")),
) -> MassConfigResponse:
    """
    Get mass configuration job details including results.

    Returns:
    - Job configuration
    - Device counts
    - Per-device results with parameters changed
    """
    try:
        return await service.get_mass_config_job(job_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/mass-config/jobs/{job_id}",
    summary="Cancel Mass Configuration Job",
    description="Cancel a pending mass configuration job",
)
async def cancel_mass_config_job(
    job_id: str,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> dict[str, Any]:
    """Cancel a pending or running mass configuration job."""
    try:
        result = await service.cancel_mass_config_job(job_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/mass-config/jobs/{job_id}/execute",
    response_model=MassConfigResponse,
    summary="Execute Mass Configuration Job",
    description="Execute mass configuration job immediately",
)
async def execute_mass_config_job(
    job_id: str,
    service: GenieACSServiceDB = Depends(get_genieacs_service),
    _: UserInfo = Depends(require_permission("isp.cpe.write")),
) -> MassConfigResponse:
    """
    Execute mass configuration job immediately.

    Applies configuration changes to all devices in the job.
    Cannot execute dry-run jobs.

    Returns job details with per-device results showing:
    - Status (success/failed)
    - Parameters changed
    - Error messages (if failed)
    - Timestamps
    """
    try:
        return await service.execute_mass_config_job(job_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
