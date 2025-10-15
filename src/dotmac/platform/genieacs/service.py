"""
GenieACS Service Layer

Business logic for CPE management via GenieACS TR-069/CWMP.
"""

from datetime import datetime, timedelta
from typing import Any

import structlog

from dotmac.platform.genieacs.client import GenieACSClient
from dotmac.platform.genieacs.schemas import (
    CPEConfigRequest,
    DeviceInfo,
    DeviceListResponse,
    DeviceQuery,
    DeviceResponse,
    DeviceStatsResponse,
    DeviceStatusResponse,
    FactoryResetRequest,
    FaultResponse,
    FileResponse,
    FirmwareDownloadRequest,
    FirmwareUpgradeResult,
    FirmwareUpgradeSchedule,
    FirmwareUpgradeScheduleCreate,
    FirmwareUpgradeScheduleList,
    FirmwareUpgradeScheduleResponse,
    GenieACSHealthResponse,
    GetParameterRequest,
    LANConfig,
    MassConfigJob,
    MassConfigJobList,
    MassConfigRequest,
    MassConfigResponse,
    MassConfigResult,
    PresetCreate,
    PresetResponse,
    PresetUpdate,
    ProvisionResponse,
    RebootRequest,
    RefreshRequest,
    SetParameterRequest,
    TaskResponse,
    WANConfig,
    WiFiConfig,
)

logger = structlog.get_logger(__name__)


class GenieACSService:
    """Service for GenieACS CPE management"""

    # In-memory storage for schedules and jobs (replace with database in production)
    _firmware_schedules: dict[str, FirmwareUpgradeSchedule] = {}
    _mass_config_jobs: dict[str, MassConfigJob] = {}
    _firmware_results: dict[str, list[FirmwareUpgradeResult]] = {}
    _mass_config_results: dict[str, list[MassConfigResult]] = {}

    def __init__(
        self,
        client: GenieACSClient | None = None,
        tenant_id: str | None = None,
    ):
        """
        Initialize GenieACS service

        Args:
            client: GenieACS client instance (creates new if not provided)
            tenant_id: Tenant ID for multi-tenancy support
        """
        self.client: GenieACSClient = client or GenieACSClient(tenant_id=tenant_id)
        self.tenant_id = tenant_id

    # =========================================================================
    # Health and Status
    # =========================================================================

    async def health_check(self) -> GenieACSHealthResponse:
        """Check GenieACS health"""
        try:
            is_healthy = await self.client.ping()
            if is_healthy:
                device_count = await self.client.get_device_count()
                faults = await self.client.get_faults(limit=1)
                fault_count = len(faults)

                return GenieACSHealthResponse(
                    healthy=True,
                    message="GenieACS is operational",
                    device_count=device_count,
                    fault_count=fault_count,
                )
            else:
                return GenieACSHealthResponse(
                    healthy=False,
                    message="GenieACS is not accessible",
                )
        except Exception as e:
            logger.error("genieacs.health_check.error", error=str(e))
            return GenieACSHealthResponse(
                healthy=False,
                message=f"Health check failed: {str(e)}",
            )

    # =========================================================================
    # Device Operations
    # =========================================================================

    async def list_devices(
        self,
        query_params: DeviceQuery,
    ) -> DeviceListResponse:
        """List devices with filtering and pagination"""
        devices_raw = await self.client.get_devices(
            query=query_params.query,
            projection=query_params.projection,
            skip=query_params.skip,
            limit=query_params.limit,
        )

        devices = []
        for device in devices_raw:
            try:
                # Extract device info from TR-069 parameters
                device_info = self._extract_device_info(device)
                devices.append(device_info)
            except Exception as e:
                logger.warning(
                    "genieacs.parse_device.failed",
                    device_id=device.get("_id"),
                    error=str(e),
                )

        total = await self.client.get_device_count(query=query_params.query)

        return DeviceListResponse(
            devices=devices,
            total=total,
            skip=query_params.skip,
            limit=query_params.limit,
        )

    async def get_device(self, device_id: str) -> DeviceResponse | None:
        """Get device details"""
        device = await self.client.get_device(device_id)
        if not device:
            return None

        device_info = self._extract_device_info(device)
        parameters = self._extract_parameters(device)

        return DeviceResponse(
            device_id=device_id,
            device_info=device_info.model_dump(),
            parameters=parameters,
            tags=device.get("Tags", []),
        )

    async def delete_device(self, device_id: str) -> bool:
        """Delete device from GenieACS"""
        return bool(await self.client.delete_device(device_id))

    async def get_device_status(self, device_id: str) -> DeviceStatusResponse | None:
        """Get device online/offline status"""
        device = await self.client.get_device(device_id)
        if not device:
            return None

        # Check last inform time to determine if online
        last_inform = device.get("_lastInform")
        if last_inform:
            last_inform_dt = datetime.fromtimestamp(last_inform / 1000)
            online = (datetime.utcnow() - last_inform_dt) < timedelta(minutes=5)
        else:
            last_inform_dt = None
            online = False

        # Get uptime if available
        uptime_param = device.get("InternetGatewayDevice.DeviceInfo.UpTime", {})
        uptime = uptime_param.get("_value") if isinstance(uptime_param, dict) else None

        return DeviceStatusResponse(
            device_id=device_id,
            online=online,
            last_inform=last_inform_dt,
            uptime=uptime,
        )

    async def get_device_stats(self) -> DeviceStatsResponse:
        """Get aggregate device statistics"""
        all_devices = await self.client.get_devices(limit=10000)

        total = len(all_devices)
        online_count = 0
        manufacturers: dict[str, int] = {}
        models: dict[str, int] = {}

        for device in all_devices:
            # Check if online
            last_inform = device.get("_lastInform")
            if last_inform:
                last_inform_dt = datetime.fromtimestamp(last_inform / 1000)
                if (datetime.utcnow() - last_inform_dt) < timedelta(minutes=5):
                    online_count += 1

            # Count manufacturers
            mfr = self._get_param_value(device, "InternetGatewayDevice.DeviceInfo.Manufacturer")
            if mfr:
                manufacturers[mfr] = manufacturers.get(mfr, 0) + 1

            # Count models
            model = self._get_param_value(device, "InternetGatewayDevice.DeviceInfo.ModelName")
            if model:
                models[model] = models.get(model, 0) + 1

        return DeviceStatsResponse(
            total_devices=total,
            online_devices=online_count,
            offline_devices=total - online_count,
            manufacturers=manufacturers,
            models=models,
        )

    # =========================================================================
    # Task Operations
    # =========================================================================

    async def refresh_device(self, request: RefreshRequest) -> TaskResponse:
        """Refresh device parameters"""
        try:
            result = await self.client.refresh_device(
                request.device_id,
                request.object_path,
            )
            return TaskResponse(
                success=True,
                message=f"Refresh task created for device {request.device_id}",
                details=result,
            )
        except Exception as e:
            logger.error(
                "genieacs.refresh_device.failed",
                device_id=request.device_id,
                error=str(e),
            )
            return TaskResponse(
                success=False,
                message=f"Failed to refresh device: {str(e)}",
            )

    async def set_parameters(self, request: SetParameterRequest) -> TaskResponse:
        """Set parameter values on device"""
        try:
            result = await self.client.set_parameter_values(
                request.device_id,
                request.parameters,
            )
            return TaskResponse(
                success=True,
                message=f"Set parameters task created for device {request.device_id}",
                details=result,
            )
        except Exception as e:
            logger.error(
                "genieacs.set_parameters.failed",
                device_id=request.device_id,
                error=str(e),
            )
            return TaskResponse(
                success=False,
                message=f"Failed to set parameters: {str(e)}",
            )

    async def get_parameters(self, request: GetParameterRequest) -> TaskResponse:
        """Get parameter values from device"""
        try:
            result = await self.client.get_parameter_values(
                request.device_id,
                request.parameter_names,
            )
            return TaskResponse(
                success=True,
                message=f"Get parameters task created for device {request.device_id}",
                details=result,
            )
        except Exception as e:
            logger.error(
                "genieacs.get_parameters.failed",
                device_id=request.device_id,
                error=str(e),
            )
            return TaskResponse(
                success=False,
                message=f"Failed to get parameters: {str(e)}",
            )

    async def reboot_device(self, request: RebootRequest) -> TaskResponse:
        """Reboot device"""
        try:
            result = await self.client.reboot_device(request.device_id)
            return TaskResponse(
                success=True,
                message=f"Reboot task created for device {request.device_id}",
                details=result,
            )
        except Exception as e:
            logger.error(
                "genieacs.reboot_device.failed",
                device_id=request.device_id,
                error=str(e),
            )
            return TaskResponse(
                success=False,
                message=f"Failed to reboot device: {str(e)}",
            )

    async def factory_reset(self, request: FactoryResetRequest) -> TaskResponse:
        """Factory reset device"""
        try:
            result = await self.client.factory_reset(request.device_id)
            return TaskResponse(
                success=True,
                message=f"Factory reset task created for device {request.device_id}",
                details=result,
            )
        except Exception as e:
            logger.error(
                "genieacs.factory_reset.failed",
                device_id=request.device_id,
                error=str(e),
            )
            return TaskResponse(
                success=False,
                message=f"Failed to factory reset device: {str(e)}",
            )

    async def download_firmware(self, request: FirmwareDownloadRequest) -> TaskResponse:
        """Download firmware to device"""
        try:
            result = await self.client.download_firmware(
                request.device_id,
                request.file_type,
                request.file_name,
                request.target_file_name or request.file_name,
            )
            return TaskResponse(
                success=True,
                message=f"Firmware download task created for device {request.device_id}",
                details=result,
            )
        except Exception as e:
            logger.error(
                "genieacs.download_firmware.failed",
                device_id=request.device_id,
                error=str(e),
            )
            return TaskResponse(
                success=False,
                message=f"Failed to initiate firmware download: {str(e)}",
            )

    # =========================================================================
    # CPE Configuration
    # =========================================================================

    async def configure_cpe(self, request: CPEConfigRequest) -> TaskResponse:
        """Configure CPE (WiFi, LAN, WAN)"""
        try:
            parameters = {}

            # WiFi configuration
            if request.wifi:
                wifi_params = self._build_wifi_params(request.wifi)
                parameters.update(wifi_params)

            # LAN configuration
            if request.lan:
                lan_params = self._build_lan_params(request.lan)
                parameters.update(lan_params)

            # WAN configuration
            if request.wan:
                wan_params = self._build_wan_params(request.wan)
                parameters.update(wan_params)

            if not parameters:
                return TaskResponse(
                    success=False,
                    message="No configuration parameters provided",
                )

            result = await self.client.set_parameter_values(
                request.device_id,
                parameters,
            )

            return TaskResponse(
                success=True,
                message=f"CPE configuration task created for device {request.device_id}",
                details=result,
            )
        except Exception as e:
            logger.error(
                "genieacs.configure_cpe.failed",
                device_id=request.device_id,
                error=str(e),
            )
            return TaskResponse(
                success=False,
                message=f"Failed to configure CPE: {str(e)}",
            )

    # =========================================================================
    # Preset Operations
    # =========================================================================

    async def list_presets(self) -> list[PresetResponse]:
        """List all presets"""
        presets_raw = await self.client.get_presets()
        return [PresetResponse(**preset) for preset in presets_raw]

    async def get_preset(self, preset_id: str) -> PresetResponse | None:
        """Get preset by ID"""
        preset = await self.client.get_preset(preset_id)
        if not preset:
            return None
        return PresetResponse(**preset)

    async def create_preset(self, data: PresetCreate) -> PresetResponse:
        """Create preset"""
        preset = await self.client.create_preset(data.model_dump(exclude_none=True))
        return PresetResponse(**preset)

    async def update_preset(self, preset_id: str, data: PresetUpdate) -> PresetResponse | None:
        """Update preset"""
        try:
            preset = await self.client.update_preset(preset_id, data.model_dump(exclude_none=True))
            return PresetResponse(**preset)
        except Exception as e:
            logger.error("genieacs.update_preset.failed", preset_id=preset_id, error=str(e))
            return None

    async def delete_preset(self, preset_id: str) -> bool:
        """Delete preset"""
        return bool(await self.client.delete_preset(preset_id))

    # =========================================================================
    # Provision Operations
    # =========================================================================

    async def list_provisions(self) -> list[ProvisionResponse]:
        """List all provisions"""
        provisions_raw = await self.client.get_provisions()
        return [ProvisionResponse(**prov) for prov in provisions_raw]

    async def get_provision(self, provision_id: str) -> ProvisionResponse | None:
        """Get provision by ID"""
        provision = await self.client.get_provision(provision_id)
        if not provision:
            return None
        return ProvisionResponse(**provision)

    # =========================================================================
    # File Operations
    # =========================================================================

    async def list_files(self) -> list[FileResponse]:
        """List all files"""
        files_raw = await self.client.get_files()
        return [FileResponse(**file) for file in files_raw]

    async def get_file(self, file_id: str) -> FileResponse | None:
        """Get file by ID"""
        file = await self.client.get_file(file_id)
        if not file:
            return None
        return FileResponse(**file)

    async def delete_file(self, file_id: str) -> bool:
        """Delete file"""
        return bool(await self.client.delete_file(file_id))

    # =========================================================================
    # Fault Operations
    # =========================================================================

    async def list_faults(
        self,
        device_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[FaultResponse]:
        """List faults"""
        faults_raw = await self.client.get_faults(
            device_id=device_id,
            skip=skip,
            limit=limit,
        )
        return [FaultResponse(**fault) for fault in faults_raw]

    async def delete_fault(self, fault_id: str) -> bool:
        """Delete fault"""
        return bool(await self.client.delete_fault(fault_id))

    # =========================================================================
    # Helper Methods
    # =========================================================================

    @staticmethod
    def _extract_device_info(device: dict[str, Any]) -> DeviceInfo:
        """Extract device info from TR-069 parameters"""

        def get_val(path: str) -> str | None:
            param = device.get(path, {})
            if isinstance(param, dict):
                return param.get("_value")
            return None

        return DeviceInfo(
            device_id=device.get("_id", ""),
            manufacturer=get_val("InternetGatewayDevice.DeviceInfo.Manufacturer"),
            model=get_val("InternetGatewayDevice.DeviceInfo.ModelName"),
            product_class=get_val("InternetGatewayDevice.DeviceInfo.ProductClass"),
            oui=get_val("InternetGatewayDevice.DeviceInfo.ManufacturerOUI"),
            serial_number=get_val("InternetGatewayDevice.DeviceInfo.SerialNumber"),
            hardware_version=get_val("InternetGatewayDevice.DeviceInfo.HardwareVersion"),
            software_version=get_val("InternetGatewayDevice.DeviceInfo.SoftwareVersion"),
            connection_request_url=device.get("_deviceId", {}).get("_ConnectionRequestURL"),
            last_inform=(
                datetime.fromtimestamp(device.get("_lastInform", 0) / 1000)
                if device.get("_lastInform")
                else None
            ),
            registered=(
                datetime.fromtimestamp(device.get("_registered", 0) / 1000)
                if device.get("_registered")
                else None
            ),
        )

    @staticmethod
    def _extract_parameters(device: dict[str, Any]) -> dict[str, Any]:
        """Extract all parameters from device"""
        params = {}
        for key, value in device.items():
            if not key.startswith("_") and isinstance(value, dict):
                if "_value" in value:
                    params[key] = value["_value"]
        return params

    @staticmethod
    def _get_param_value(device: dict[str, Any], param_path: str) -> Any | None:
        """Get parameter value from device"""
        param = device.get(param_path, {})
        if isinstance(param, dict):
            return param.get("_value")
        return None

    @staticmethod
    def _build_wifi_params(wifi: WiFiConfig) -> dict[str, Any]:
        """Build WiFi TR-069 parameters"""
        # This is a simplified example - actual parameters vary by device
        return {
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": wifi.ssid,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase": wifi.password,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.BeaconType": wifi.security_mode,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable": wifi.enabled,
        }

    @staticmethod
    def _build_lan_params(lan: LANConfig) -> dict[str, Any]:
        """Build LAN TR-069 parameters"""
        params = {
            "InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress": lan.ip_address,
            "InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceSubnetMask": lan.subnet_mask,
            "InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.DHCPServerEnable": lan.dhcp_enabled,
        }
        if lan.dhcp_start:
            params["InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.MinAddress"] = (
                lan.dhcp_start
            )
        if lan.dhcp_end:
            params["InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.MaxAddress"] = (
                lan.dhcp_end
            )
        return params

    @staticmethod
    def _build_wan_params(wan: WANConfig) -> dict[str, Any]:
        """Build WAN TR-069 parameters"""
        params = {
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ConnectionType": wan.connection_type,
        }
        if wan.username:
            params[
                "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username"
            ] = wan.username
        if wan.password:
            params[
                "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password"
            ] = wan.password
        return params

    # =========================================================================
    # Scheduled Firmware Upgrades
    # =========================================================================

    async def create_firmware_upgrade_schedule(
        self, request: FirmwareUpgradeScheduleCreate
    ) -> FirmwareUpgradeScheduleResponse:
        """
        Create a scheduled firmware upgrade job.

        Args:
            request: Firmware upgrade schedule creation request

        Returns:
            FirmwareUpgradeScheduleResponse with schedule details and device count
        """
        from uuid import uuid4

        # Generate schedule ID
        schedule_id = str(uuid4())

        # Query devices matching filter
        devices = await self.client.get_devices(query=request.device_filter)
        total_devices = len(devices)

        # Create schedule
        schedule = FirmwareUpgradeSchedule(
            schedule_id=schedule_id,
            name=request.name,
            description=request.description,
            firmware_file=request.firmware_file,
            file_type=request.file_type,
            device_filter=request.device_filter,
            scheduled_at=request.scheduled_at,
            timezone=request.timezone,
            max_concurrent=request.max_concurrent,
            status="pending",
            created_at=datetime.now(),
        )

        # Store schedule
        self._firmware_schedules[schedule_id] = schedule
        self._firmware_results[schedule_id] = []

        logger.info(
            "genieacs.firmware_schedule.created",
            schedule_id=schedule_id,
            name=request.name,
            total_devices=total_devices,
        )

        return FirmwareUpgradeScheduleResponse(
            schedule=schedule,
            total_devices=total_devices,
            completed_devices=0,
            failed_devices=0,
            pending_devices=total_devices,
            results=[],
        )

    async def list_firmware_upgrade_schedules(self) -> FirmwareUpgradeScheduleList:
        """List all firmware upgrade schedules."""
        schedules = list(self._firmware_schedules.values())
        return FirmwareUpgradeScheduleList(schedules=schedules, total=len(schedules))

    async def get_firmware_upgrade_schedule(
        self, schedule_id: str
    ) -> FirmwareUpgradeScheduleResponse:
        """
        Get firmware upgrade schedule details.

        Args:
            schedule_id: Schedule ID

        Returns:
            FirmwareUpgradeScheduleResponse with schedule and results

        Raises:
            ValueError: If schedule not found
        """
        schedule = self._firmware_schedules.get(schedule_id)
        if not schedule:
            raise ValueError(f"Firmware upgrade schedule {schedule_id} not found")

        results = self._firmware_results.get(schedule_id, [])

        completed = sum(1 for r in results if r.status == "success")
        failed = sum(1 for r in results if r.status == "failed")
        in_progress = sum(1 for r in results if r.status == "in_progress")
        pending = sum(1 for r in results if r.status == "pending")

        # Query current device count
        devices = await self.client.get_devices(query=schedule.device_filter)
        total_devices = len(devices)

        return FirmwareUpgradeScheduleResponse(
            schedule=schedule,
            total_devices=total_devices,
            completed_devices=completed,
            failed_devices=failed,
            pending_devices=pending + in_progress,
            results=results,
        )

    async def cancel_firmware_upgrade_schedule(self, schedule_id: str) -> dict[str, Any]:
        """
        Cancel a pending firmware upgrade schedule.

        Args:
            schedule_id: Schedule ID

        Returns:
            Success message

        Raises:
            ValueError: If schedule not found or not cancellable
        """
        schedule = self._firmware_schedules.get(schedule_id)
        if not schedule:
            raise ValueError(f"Firmware upgrade schedule {schedule_id} not found")

        if schedule.status not in ("pending", "running"):
            raise ValueError(f"Cannot cancel schedule with status: {schedule.status}")

        schedule.status = "cancelled"
        schedule.completed_at = datetime.now()

        logger.info("genieacs.firmware_schedule.cancelled", schedule_id=schedule_id)

        return {"success": True, "message": f"Schedule {schedule_id} cancelled"}

    async def execute_firmware_upgrade_schedule(
        self, schedule_id: str
    ) -> FirmwareUpgradeScheduleResponse:
        """
        Execute firmware upgrade schedule immediately (background task).

        This method initiates the firmware upgrade process and returns immediately.
        The actual upgrades are performed asynchronously.

        Args:
            schedule_id: Schedule ID

        Returns:
            FirmwareUpgradeScheduleResponse with initial status

        Raises:
            ValueError: If schedule not found
        """
        schedule = self._firmware_schedules.get(schedule_id)
        if not schedule:
            raise ValueError(f"Firmware upgrade schedule {schedule_id} not found")

        # Update schedule status
        schedule.status = "running"
        schedule.started_at = datetime.now()

        # Get devices
        devices = await self.client.get_devices(query=schedule.device_filter)

        # Initialize results
        results: list[FirmwareUpgradeResult] = []
        for device in devices:
            device_id = device.get("_id", "")
            results.append(
                FirmwareUpgradeResult(
                    device_id=device_id,
                    status="pending",
                    started_at=None,
                    completed_at=None,
                )
            )

        self._firmware_results[schedule_id] = results

        # Execute firmware downloads (simplified - in production use Celery)
        # Here we'll process a limited number concurrently
        for _i, result in enumerate(results[: schedule.max_concurrent]):
            try:
                device_id = result.device_id
                result.status = "in_progress"
                result.started_at = datetime.now()

                # Trigger firmware download task
                await self.client.add_task(
                    device_id=device_id,
                    task_name="download",
                    file_name=schedule.firmware_file,
                    file_type=schedule.file_type,
                )

                result.status = "success"
                result.completed_at = datetime.now()

                logger.info(
                    "genieacs.firmware_upgrade.device_started",
                    schedule_id=schedule_id,
                    device_id=device_id,
                )

            except Exception as e:
                result.status = "failed"
                result.error_message = str(e)
                result.completed_at = datetime.now()

                logger.error(
                    "genieacs.firmware_upgrade.device_failed",
                    schedule_id=schedule_id,
                    device_id=result.device_id,
                    error=str(e),
                )

        # Update schedule status
        completed = sum(1 for r in results if r.status == "success")
        failed = sum(1 for r in results if r.status == "failed")
        pending = sum(1 for r in results if r.status == "pending")

        if pending == 0:
            schedule.status = "completed"
            schedule.completed_at = datetime.now()

        logger.info(
            "genieacs.firmware_schedule.executed",
            schedule_id=schedule_id,
            total=len(devices),
            completed=completed,
            failed=failed,
        )

        return FirmwareUpgradeScheduleResponse(
            schedule=schedule,
            total_devices=len(devices),
            completed_devices=completed,
            failed_devices=failed,
            pending_devices=pending,
            results=results,
        )

    # =========================================================================
    # Mass CPE Configuration
    # =========================================================================

    async def create_mass_config_job(self, request: MassConfigRequest) -> MassConfigResponse:
        """
        Create mass configuration job.

        Args:
            request: Mass configuration request

        Returns:
            MassConfigResponse with job details and preview (if dry-run)
        """
        from uuid import uuid4

        # Generate job ID
        job_id = str(uuid4())

        # Query devices matching filter
        devices = await self.client.get_devices(query=request.device_filter.query)
        total_devices = len(devices)

        # Validate expected count if provided
        if request.device_filter.expected_count is not None:
            if total_devices != request.device_filter.expected_count:
                raise ValueError(
                    f"Device count mismatch: expected {request.device_filter.expected_count}, found {total_devices}"
                )

        # Create job
        job = MassConfigJob(
            job_id=job_id,
            name=request.name,
            description=request.description,
            device_filter=request.device_filter.query,
            total_devices=total_devices,
            status="pending",
            dry_run=request.dry_run,
            created_at=datetime.now(),
        )

        # Store job
        self._mass_config_jobs[job_id] = job
        self._mass_config_results[job_id] = []

        # If dry-run, return preview
        preview = None
        if request.dry_run:
            preview = [device.get("_id", "") for device in devices]

        logger.info(
            "genieacs.mass_config.created",
            job_id=job_id,
            name=request.name,
            total_devices=total_devices,
            dry_run=request.dry_run,
        )

        return MassConfigResponse(job=job, preview=preview, results=[])

    async def list_mass_config_jobs(self) -> MassConfigJobList:
        """List all mass configuration jobs."""
        jobs = list(self._mass_config_jobs.values())
        return MassConfigJobList(jobs=jobs, total=len(jobs))

    async def get_mass_config_job(self, job_id: str) -> MassConfigResponse:
        """
        Get mass configuration job details.

        Args:
            job_id: Job ID

        Returns:
            MassConfigResponse with job and results

        Raises:
            ValueError: If job not found
        """
        job = self._mass_config_jobs.get(job_id)
        if not job:
            raise ValueError(f"Mass configuration job {job_id} not found")

        results = self._mass_config_results.get(job_id, [])

        return MassConfigResponse(job=job, preview=None, results=results)

    async def cancel_mass_config_job(self, job_id: str) -> dict[str, Any]:
        """
        Cancel a pending mass configuration job.

        Args:
            job_id: Job ID

        Returns:
            Success message

        Raises:
            ValueError: If job not found or not cancellable
        """
        job = self._mass_config_jobs.get(job_id)
        if not job:
            raise ValueError(f"Mass configuration job {job_id} not found")

        if job.status not in ("pending", "running"):
            raise ValueError(f"Cannot cancel job with status: {job.status}")

        job.status = "cancelled"
        job.completed_at = datetime.now()

        logger.info("genieacs.mass_config.cancelled", job_id=job_id)

        return {"success": True, "message": f"Job {job_id} cancelled"}

    async def execute_mass_config_job(self, job_id: str) -> MassConfigResponse:
        """
        Execute mass configuration job immediately.

        Args:
            job_id: Job ID

        Returns:
            MassConfigResponse with results

        Raises:
            ValueError: If job not found or is dry-run
        """
        job = self._mass_config_jobs.get(job_id)
        if not job:
            raise ValueError(f"Mass configuration job {job_id} not found")

        if job.dry_run:
            raise ValueError("Cannot execute dry-run job")

        # Update job status
        job.status = "running"
        job.started_at = datetime.now()

        # Get devices
        devices = await self.client.get_devices(query=job.device_filter)

        # Get the original request to determine what to configure
        # Note: In production, store the full request with the job
        results: list[MassConfigResult] = []

        for device in devices:
            device_id = device.get("_id", "")
            result = MassConfigResult(
                device_id=device_id,
                status="pending",
                started_at=None,
                completed_at=None,
            )

            try:
                result.status = "in_progress"
                result.started_at = datetime.now()

                # Build parameters to set
                # This is simplified - in production, reconstruct from stored request
                params_to_set: dict[str, Any] = {}

                # Example: Set a refresh task (placeholder)
                await self.client.add_task(
                    device_id=device_id,
                    task_name="refreshObject",
                    object_name="InternetGatewayDevice",
                )

                result.parameters_changed = params_to_set
                result.status = "success"
                result.completed_at = datetime.now()

                job.completed_devices += 1

                logger.info(
                    "genieacs.mass_config.device_completed",
                    job_id=job_id,
                    device_id=device_id,
                )

            except Exception as e:
                result.status = "failed"
                result.error_message = str(e)
                result.completed_at = datetime.now()

                job.failed_devices += 1

                logger.error(
                    "genieacs.mass_config.device_failed",
                    job_id=job_id,
                    device_id=device_id,
                    error=str(e),
                )

            results.append(result)

        # Store results
        self._mass_config_results[job_id] = results

        # Update job status
        job.pending_devices = 0
        job.status = "completed"
        job.completed_at = datetime.now()

        logger.info(
            "genieacs.mass_config.executed",
            job_id=job_id,
            total=job.total_devices,
            completed=job.completed_devices,
            failed=job.failed_devices,
        )

        return MassConfigResponse(job=job, preview=None, results=results)
