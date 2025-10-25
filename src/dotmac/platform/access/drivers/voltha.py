"""
VOLTHA-backed OLT driver.

This driver wraps :class:`dotmac.platform.voltha.service.VOLTHAService` to
conform to the generic access-network interface, allowing VOLTHA-managed OLTs
and CLI/SNMP-managed OLTs to share the same API surface.
"""

from __future__ import annotations

from typing import Any

from dotmac.platform.access.drivers.base import (
    BaseOLTDriver,
    DeviceDiscovery,
    DriverCapabilities,
    DriverConfig,
    DriverContext,
    OLTAlarm,
    OltMetrics,
    ONUProvisionRequest,
    ONUProvisionResult,
)
from dotmac.platform.voltha.schemas import (
    ONUProvisionRequest as VolthaProvisionRequest,
)
from dotmac.platform.voltha.service import VOLTHAService


class VolthaDriverConfig(DriverConfig):
    """Configuration for VOLTHA driver."""

    olt_device_id: str | None = None  # Optional; filters discovery to a single OLT


class VolthaDriver(BaseOLTDriver):
    """Adapter that proxies calls to VOLTHA service layer."""

    CONFIG_MODEL = VolthaDriverConfig

    def __init__(self, config: DriverConfig, context: DriverContext | None = None) -> None:
        if not isinstance(config, VolthaDriverConfig):
            config = VolthaDriverConfig(**config.model_dump())
        super().__init__(config, context)
        self.service = VOLTHAService(tenant_id=context.tenant_id if context else None)
        self.olt_device_id = config.olt_device_id or config.extra.get("olt_device_id")

    async def discover_onus(self) -> list[DeviceDiscovery]:
        devices = await self.service.list_devices()
        discovery: list[DeviceDiscovery] = []
        for device in devices.devices:
            if device.root:
                continue
            if self.olt_device_id and device.parent_id != self.olt_device_id:
                continue
            discovery.append(
                DeviceDiscovery(
                    onu_id=device.id,
                    serial_number=device.serial_number or "",
                    state=device.oper_status or device.connect_status or "UNKNOWN",
                    metadata={
                        "olt_device_id": device.parent_id,
                        "pon_port": device.parent_port_no,
                        "adapter": device.adapter,
                    },
                )
            )
        return discovery

    async def get_capabilities(self) -> DriverCapabilities:
        return DriverCapabilities(
            supports_onu_provisioning=True,
            supports_vlan_change=True,
            supports_backup_restore=False,
            supports_realtime_alarms=True,
            supported_operations=["enable", "disable", "reboot", "delete"],
        )

    async def discover_onus(self) -> list[DeviceDiscovery]:
        response = await self.service.discover_onus(olt_device_id=self.olt_device_id, auto_provision=False)
        devices = []
        for onu in response.discovered:
            metadata = onu.metadata or {}
            metadata.setdefault("olt_id", onu.olt_device_id)
            metadata.setdefault("pon_port", onu.pon_port)
            metadata.setdefault("vendor_id", onu.vendor_id or "")
            devices.append(
                DeviceDiscovery(
                    onu_id=onu.onu_id or onu.serial_number,
                    serial_number=onu.serial_number,
                    state=onu.status,
                    metadata=metadata,
                )
            )
        return devices

    async def provision_onu(self, request: ONUProvisionRequest) -> ONUProvisionResult:
        olt_device_id = request.metadata.get("olt_device_id") or self.olt_device_id
        pon_port = request.metadata.get("pon_port")
        if not olt_device_id or pon_port is None:
            return ONUProvisionResult(
                success=False,
                message="OLT device ID and PON port are required for VOLTHA provisioning",
            )

        provision_request = VolthaProvisionRequest(
            serial_number=request.serial_number,
            olt_device_id=olt_device_id,
            pon_port=int(pon_port),
            subscriber_id=request.metadata.get("subscriber_id"),
            vlan=request.vlan or request.metadata.get("vlan"),
            bandwidth_profile=request.metadata.get("bandwidth_profile"),
        )
        response = await self.service.provision_onu(provision_request)
        return ONUProvisionResult(
            success=response.success,
            message=response.message,
            applied_config=response.model_dump(),
        )

    async def remove_onu(self, onu_id: str) -> bool:
        return await self.service.delete_device(onu_id)

    async def apply_service_profile(
        self, onu_id: str, service_profile: dict[str, Any]
    ) -> ONUProvisionResult:
        vlan = service_profile.get("vlan")
        bandwidth_profile = service_profile.get("bandwidth_profile")
        parent_id = (
            service_profile.get("olt_device_id")
            or service_profile.get("parent_id")
            or self.olt_device_id
        )
        if not parent_id:
            return ONUProvisionResult(
                success=False,
                message="OLT device ID required to apply service profile",
            )

        try:
            await self.service._configure_onu_service(  # pylint: disable=protected-access
                device_id=onu_id,
                parent_id=parent_id,
                vlan=vlan,
                bandwidth_profile=bandwidth_profile,
            )
            return ONUProvisionResult(
                success=True,
                message="Service profile applied",
                applied_config=service_profile,
            )
        except Exception as exc:
            return ONUProvisionResult(success=False, message=str(exc))

    async def collect_metrics(self) -> OltMetrics:
        stats = await self.service.get_pon_statistics()
        return OltMetrics(
            olt_id=self.config.olt_id,
            pon_ports_up=0,
            pon_ports_total=0,
            onu_online=stats.online_onus,
            onu_total=stats.total_onus,
            raw=stats.model_dump(),
        )

    async def fetch_alarms(self) -> list[OLTAlarm]:
        response = await self.service.get_alarms(device_id=self.olt_device_id)
        alarms: list[OLTAlarm] = []
        for alarm in response.alarms:
            alarms.append(
                OLTAlarm(
                    alarm_id=getattr(alarm, "id", alarm.alarm_id if hasattr(alarm, "alarm_id") else ""),
                    severity=alarm.severity or "UNKNOWN",
                    message=alarm.description or alarm.resource,
                    raised_at=getattr(alarm, "raised_ts", 0.0),
                    resource_id=alarm.device_id,
                )
            )
        return alarms

    async def backup_configuration(self) -> bytes:
        raise NotImplementedError("VOLTHA driver does not support configuration backup")

    async def restore_configuration(self, payload: bytes) -> None:
        raise NotImplementedError("VOLTHA driver does not support configuration restore")

    async def list_logical_devices(self) -> list[dict[str, Any]]:
        response = await self.service.list_logical_devices()
        return [device.model_dump() for device in response.devices]

    async def list_devices(self) -> list[dict[str, Any]]:
        response = await self.service.list_devices()
        devices = []
        for device in response.devices:
            data = device.model_dump()
            metadata = data.setdefault("metadata", {})
            metadata["olt_id"] = data.get("parent_id")
            devices.append(data)
        return devices

    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        detail = await self.service.get_device(device_id)
        if not detail:
            return None
        data = detail.device.model_dump()
        metadata = data.setdefault("metadata", {})
        metadata["olt_id"] = data.get("parent_id")
        data["ports"] = [port.model_dump() for port in detail.ports]
        return data

    async def operate_device(self, device_id: str, operation: str) -> bool:
        if operation == "enable":
            result = await self.service.enable_device(device_id)
            return result.success
        if operation == "disable":
            result = await self.service.disable_device(device_id)
            return result.success
        if operation == "reboot":
            result = await self.service.reboot_device(device_id)
            return result.success
        if operation == "delete":
            return await self.service.delete_device(device_id)
        raise ValueError(f"Unsupported operation '{operation}'")

    async def get_health(self) -> dict[str, Any]:
        response = await self.service.health_check()
        return response.model_dump()
