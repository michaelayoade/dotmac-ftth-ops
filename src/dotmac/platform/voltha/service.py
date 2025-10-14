"""
VOLTHA Service Layer

Business logic for PON network management via VOLTHA.
"""


import structlog

from dotmac.platform.voltha.client import VOLTHAClient
from dotmac.platform.voltha.schemas import (
    Adapter,
    Device,
    DeviceDetailResponse,
    DeviceListResponse,
    DeviceOperationResponse,
    DeviceType,
    LogicalDevice,
    LogicalDeviceDetailResponse,
    LogicalDeviceListResponse,
    PONStatistics,
    Port,
    VOLTHAHealthResponse,
)

logger = structlog.get_logger(__name__)


class VOLTHAService:
    """Service for VOLTHA PON management"""

    def __init__(
        self,
        client: VOLTHAClient | None = None,
        tenant_id: str | None = None,
    ):
        """
        Initialize VOLTHA service

        Args:
            client: VOLTHA client instance (creates new if not provided)
            tenant_id: Tenant ID for multi-tenancy support
        """
        self.client = client or VOLTHAClient(tenant_id=tenant_id)
        self.tenant_id = tenant_id

    # =========================================================================
    # Health and Status
    # =========================================================================

    async def health_check(self) -> VOLTHAHealthResponse:
        """Check VOLTHA health"""
        try:
            health = await self.client.health_check()
            state = health.get("state", "UNKNOWN")
            is_healthy = state == "HEALTHY"

            devices = await self.client.get_devices()
            total_devices = len(devices)

            return VOLTHAHealthResponse(
                healthy=is_healthy,
                state=state,
                message=f"VOLTHA is {state.lower()}",
                total_devices=total_devices,
            )
        except Exception as e:
            logger.error("voltha.health_check.error", error=str(e))
            return VOLTHAHealthResponse(
                healthy=False,
                state="ERROR",
                message=f"Health check failed: {str(e)}",
            )

    # =========================================================================
    # Physical Device Operations (ONUs)
    # =========================================================================

    async def list_devices(self) -> DeviceListResponse:
        """List all physical devices (ONUs)"""
        devices_raw = await self.client.get_devices()
        devices = [Device(**dev) for dev in devices_raw]

        return DeviceListResponse(
            devices=devices,
            total=len(devices),
        )

    async def get_device(self, device_id: str) -> DeviceDetailResponse | None:
        """Get device details"""
        device_raw = await self.client.get_device(device_id)
        if not device_raw:
            return None

        device = Device(**device_raw)
        ports_raw = await self.client.get_device_ports(device_id)
        ports = [Port(**port) for port in ports_raw]

        return DeviceDetailResponse(
            device=device,
            ports=ports,
        )

    async def enable_device(self, device_id: str) -> DeviceOperationResponse:
        """Enable device"""
        try:
            await self.client.enable_device(device_id)
            return DeviceOperationResponse(
                success=True,
                message=f"Device {device_id} enabled successfully",
                device_id=device_id,
            )
        except Exception as e:
            logger.error("voltha.enable_device.failed", device_id=device_id, error=str(e))
            return DeviceOperationResponse(
                success=False,
                message=f"Failed to enable device: {str(e)}",
                device_id=device_id,
            )

    async def disable_device(self, device_id: str) -> DeviceOperationResponse:
        """Disable device"""
        try:
            await self.client.disable_device(device_id)
            return DeviceOperationResponse(
                success=True,
                message=f"Device {device_id} disabled successfully",
                device_id=device_id,
            )
        except Exception as e:
            logger.error("voltha.disable_device.failed", device_id=device_id, error=str(e))
            return DeviceOperationResponse(
                success=False,
                message=f"Failed to disable device: {str(e)}",
                device_id=device_id,
            )

    async def reboot_device(self, device_id: str) -> DeviceOperationResponse:
        """Reboot device"""
        try:
            await self.client.reboot_device(device_id)
            return DeviceOperationResponse(
                success=True,
                message=f"Device {device_id} reboot initiated",
                device_id=device_id,
            )
        except Exception as e:
            logger.error("voltha.reboot_device.failed", device_id=device_id, error=str(e))
            return DeviceOperationResponse(
                success=False,
                message=f"Failed to reboot device: {str(e)}",
                device_id=device_id,
            )

    async def delete_device(self, device_id: str) -> bool:
        """Delete device"""
        result = await self.client.delete_device(device_id)
        return bool(result)

    # =========================================================================
    # Logical Device Operations (OLTs)
    # =========================================================================

    async def list_logical_devices(self) -> LogicalDeviceListResponse:
        """List all logical devices (OLTs)"""
        devices_raw = await self.client.get_logical_devices()
        devices = [LogicalDevice(**dev) for dev in devices_raw]

        return LogicalDeviceListResponse(
            devices=devices,
            total=len(devices),
        )

    async def get_logical_device(self, device_id: str) -> LogicalDeviceDetailResponse | None:
        """Get logical device details"""
        device_raw = await self.client.get_logical_device(device_id)
        if not device_raw:
            return None

        device = LogicalDevice(**device_raw)
        ports_raw = await self.client.get_logical_device_ports(device_id)
        flows_raw = await self.client.get_logical_device_flows(device_id)

        return LogicalDeviceDetailResponse(
            device=device,
            ports=ports_raw,
            flows=flows_raw,
        )

    # =========================================================================
    # Statistics and Information
    # =========================================================================

    async def get_pon_statistics(self) -> PONStatistics:
        """Get PON network statistics"""
        logical_devices = await self.client.get_logical_devices()
        physical_devices = await self.client.get_devices()

        online_count = sum(
            1
            for d in physical_devices
            if d.get("connect_status") == "REACHABLE" or d.get("oper_status") == "ACTIVE"
        )
        offline_count = len(physical_devices) - online_count

        # Count flows
        total_flows = 0
        for ld in logical_devices:
            flows = await self.client.get_logical_device_flows(ld.get("id", ""))
            total_flows += len(flows)

        # Get adapters
        adapters_raw = await self.client.get_adapters()
        adapter_ids = [a.get("id", "") for a in adapters_raw]

        return PONStatistics(
            total_olts=len(logical_devices),
            total_onus=len(physical_devices),
            online_onus=online_count,
            offline_onus=offline_count,
            total_flows=total_flows,
            adapters=adapter_ids,
        )

    async def get_adapters(self) -> list[Adapter]:
        """Get all adapters"""
        adapters_raw = await self.client.get_adapters()
        return [Adapter(**adapter) for adapter in adapters_raw]

    async def get_device_types(self) -> list[DeviceType]:
        """Get all device types"""
        types_raw = await self.client.get_device_types()
        return [DeviceType(**dt) for dt in types_raw]
