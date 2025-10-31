"""
High-level access network service.

The service uses the driver registry to perform operations on vendor-specific
OLT platforms. It mirrors the operations exposed by the existing VOLTHA
service so that callers can treat both implementations uniformly.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import structlog
from pydantic import BaseModel, Field

from dotmac.platform.access.drivers import (
    BaseOLTDriver,
    DeviceDiscovery,
    DriverCapabilities,
    OLTAlarm,
    OltMetrics,
    ONUProvisionRequest,
    ONUProvisionResult,
)
from dotmac.platform.access.registry import AccessDriverRegistry, DriverDescriptor
from dotmac.platform.voltha.schemas import (
    Device as VolthaDevice,
)
from dotmac.platform.voltha.schemas import (
    DeviceDetailResponse,
    DeviceListResponse,
    LogicalDevice,
    LogicalDeviceDetailResponse,
    LogicalDeviceListResponse,
    PONStatistics,
    Port,
    VOLTHAAlarm,
    VOLTHAAlarmListResponse,
    VOLTHAHealthResponse,
)

logger = structlog.get_logger(__name__)


class PONPortMetrics(BaseModel):
    port_no: int
    label: str | None = None
    admin_state: str | None = None
    oper_status: str | None = None
    onu_count: int = 0
    online_onu_count: int = 0


class OLTOverview(BaseModel):
    device_id: str
    serial_number: str
    model: str
    firmware_version: str
    admin_state: str
    oper_status: str
    connect_status: str
    total_pon_ports: int
    active_pon_ports: int
    total_onus: int
    online_onus: int
    pon_ports: list[PONPortMetrics] = Field(default_factory=list)


class AccessNetworkService:
    """Service that delegates OLT operations to vendor drivers."""

    def __init__(self, registry: AccessDriverRegistry) -> None:
        self.registry = registry

    # ------------------------------------------------------------------ #
    # Helper
    # ------------------------------------------------------------------ #

    def _driver(self, olt_id: str) -> BaseOLTDriver:
        descriptor: DriverDescriptor = self.registry.get(olt_id)
        return self._instantiate(descriptor)

    def _instantiate(self, descriptor: DriverDescriptor) -> BaseOLTDriver:
        return descriptor.driver_cls(descriptor.config, descriptor.context)

    def _descriptors(self) -> Iterable[DriverDescriptor]:
        return self.registry.descriptors()

    # ------------------------------------------------------------------ #
    # Inventory
    # ------------------------------------------------------------------ #

    async def list_onus(self, olt_id: str) -> list[DeviceDiscovery]:
        driver = self._driver(olt_id)
        discovery = await driver.discover_onus()
        for onu in discovery:
            if onu.metadata is None:
                onu.metadata = {}
            onu.metadata.setdefault("olt_id", olt_id)
        logger.info("access.discovery", olt_id=olt_id, onu_count=len(discovery))
        return discovery

    async def capabilities(self, olt_id: str) -> DriverCapabilities:
        driver = self._driver(olt_id)
        caps = await driver.get_capabilities()
        logger.debug("access.capabilities", olt_id=olt_id, capabilities=caps.model_dump())
        return caps

    # ------------------------------------------------------------------ #
    # Provisioning
    # ------------------------------------------------------------------ #

    async def provision_onu(self, olt_id: str, request: ONUProvisionRequest) -> ONUProvisionResult:
        driver = self._driver(olt_id)
        result = await driver.provision_onu(request)
        logger.info(
            "access.onu.provision",
            olt_id=olt_id,
            onu_id=request.onu_id,
            success=result.success,
            message=result.message,
        )
        return result

    async def remove_onu(self, olt_id: str, onu_id: str) -> bool:
        driver = self._driver(olt_id)
        removed = await driver.remove_onu(onu_id)
        logger.info("access.onu.remove", olt_id=olt_id, onu_id=onu_id, removed=removed)
        return removed

    async def apply_service_profile(
        self, olt_id: str, onu_id: str, profile: dict[str, Any]
    ) -> ONUProvisionResult:
        driver = self._driver(olt_id)
        result = await driver.apply_service_profile(onu_id, profile)
        logger.info(
            "access.onu.service_profile",
            olt_id=olt_id,
            onu_id=onu_id,
            success=result.success,
            message=result.message,
        )
        return result

    # ------------------------------------------------------------------ #
    # Telemetry
    # ------------------------------------------------------------------ #

    async def collect_metrics(self, olt_id: str) -> OltMetrics:
        driver = self._driver(olt_id)
        metrics = await driver.collect_metrics()
        logger.debug("access.metrics", olt_id=olt_id, metrics=metrics.model_dump())
        return metrics

    async def fetch_alarms(self, olt_id: str) -> list[OLTAlarm]:
        driver = self._driver(olt_id)
        alarms = await driver.fetch_alarms()
        logger.debug("access.alarms", olt_id=olt_id, alarm_count=len(alarms))
        return alarms

    async def backup_configuration(self, olt_id: str) -> bytes:
        driver = self._driver(olt_id)
        backup = await driver.backup_configuration()
        logger.info("access.backup", olt_id=olt_id, size=len(backup))
        return backup

    async def restore_configuration(self, olt_id: str, payload: bytes) -> None:
        driver = self._driver(olt_id)
        await driver.restore_configuration(payload)
        logger.info("access.restore", olt_id=olt_id, size=len(payload))

    async def discover_all_onus(self) -> list[DeviceDiscovery]:
        aggregated: list[DeviceDiscovery] = []
        for descriptor in self._descriptors():
            driver = self._instantiate(descriptor)
            try:
                onus = await driver.discover_onus()
            except NotImplementedError:
                continue
            for onu in onus:
                if onu.metadata is None:
                    onu.metadata = {}
                onu.metadata.setdefault("olt_id", descriptor.config.olt_id)
                aggregated.append(onu)
        return aggregated

    # ------------------------------------------------------------------ #
    # VOLTHA-compatible helpers
    # ------------------------------------------------------------------ #

    async def health(self) -> VOLTHAHealthResponse:
        results = []
        for descriptor in self._descriptors():
            driver = self._instantiate(descriptor)
            try:
                results.append(await driver.get_health())
            except NotImplementedError:
                continue

        if not results:
            return VOLTHAHealthResponse(
                healthy=False, state="UNKNOWN", message="No drivers registered", total_devices=0
            )

        overall_healthy = all(result.get("healthy", False) for result in results)
        total_devices = sum(result.get("total_devices", 0) for result in results)
        state = "HEALTHY" if overall_healthy else "DEGRADED"
        message = "; ".join(
            result.get("message", "") for result in results if result.get("message")
        )

        return VOLTHAHealthResponse(
            healthy=overall_healthy,
            state=state,
            message=message or state.title(),
            total_devices=total_devices,
        )

    async def list_logical_devices(self) -> LogicalDeviceListResponse:
        logical_devices: list[LogicalDevice] = []
        for descriptor in self._descriptors():
            driver = self._instantiate(descriptor)
            try:
                entries = await driver.list_logical_devices()
            except NotImplementedError:
                entries = []

            if not entries:
                entries = [
                    {
                        "id": descriptor.config.olt_id,
                        "datapath_id": descriptor.config.olt_id,
                        "desc": {"mfr_desc": descriptor.driver_cls.__name__},
                        "root_device_id": descriptor.config.olt_id,
                        "switch_features": {},
                    }
                ]

            for entry in entries:
                entry.setdefault("id", descriptor.config.olt_id or "olt")
                entry.setdefault("datapath_id", entry["id"])
                entry.setdefault("root_device_id", descriptor.config.olt_id)
                entry.setdefault(
                    "desc",
                    {"mfr_desc": descriptor.driver_cls.__name__, "hw_desc": "Access Driver"},
                )
                entry.setdefault("switch_features", {})
                logical_devices.append(LogicalDevice(**entry))

        return LogicalDeviceListResponse(devices=logical_devices, total=len(logical_devices))

    async def get_logical_device(self, device_id: str) -> LogicalDeviceDetailResponse | None:
        for descriptor in self._descriptors():
            driver = self._instantiate(descriptor)
            try:
                entries = await driver.list_logical_devices()
            except NotImplementedError:
                entries = []

            for entry in entries:
                entry_id = entry.get("id") or entry.get("datapath_id")
                if entry_id != device_id and entry.get("datapath_id") != device_id:
                    continue

                logical_device = LogicalDevice(**entry)
                ports = entry.get("ports") or []
                flows = entry.get("flows") or []

                return LogicalDeviceDetailResponse(
                    device=logical_device,
                    ports=ports,
                    flows=flows,
                )
        return None

    async def list_devices(self) -> DeviceListResponse:
        devices: list[VolthaDevice] = []
        for descriptor in self._descriptors():
            driver = self._instantiate(descriptor)
            try:
                capabilities = await driver.get_capabilities()
            except NotImplementedError:
                capabilities = DriverCapabilities()
            try:
                entries = await driver.list_devices()
            except NotImplementedError:
                entries = []

            for entry in entries:
                metadata = entry.setdefault("metadata", {})
                metadata.setdefault("olt_id", entry.get("parent_id") or descriptor.config.olt_id)
                metadata.setdefault("driver_id", descriptor.driver_cls.__name__)
                metadata.setdefault("supported_operations", capabilities.supported_operations)
                metadata.setdefault("driver_capabilities", capabilities.model_dump())
                entry.setdefault("id", entry.get("serial_number") or descriptor.config.olt_id)
                entry.setdefault("root", False)
                entry.setdefault("type", entry.get("type") or "UNKNOWN")
                entry.setdefault("vendor", entry.get("vendor") or descriptor.driver_cls.__name__)
                entry.setdefault("parent_id", entry.get("parent_id") or descriptor.config.olt_id)
                entry.setdefault("oper_status", entry.get("oper_status") or "UNKNOWN")
                entry.setdefault("connect_status", entry.get("connect_status") or "UNKNOWN")
                devices.append(VolthaDevice(**entry))

        return DeviceListResponse(devices=devices, total=len(devices))

    async def get_device(self, device_id: str) -> DeviceDetailResponse | None:
        for descriptor in self._descriptors():
            driver = self._instantiate(descriptor)
            try:
                entry = await driver.get_device(device_id)
            except NotImplementedError:
                continue
            if entry:
                metadata = entry.setdefault("metadata", {})
                metadata.setdefault("olt_id", entry.get("parent_id") or descriptor.config.olt_id)
                metadata.setdefault("driver_id", descriptor.driver_cls.__name__)
                try:
                    capabilities = await driver.get_capabilities()
                except NotImplementedError:
                    capabilities = DriverCapabilities()
                metadata.setdefault("supported_operations", capabilities.supported_operations)
                metadata.setdefault("driver_capabilities", capabilities.model_dump())

                ports = entry.pop("ports", [])
                device = VolthaDevice(**entry)
                port_models = [Port(**port) for port in ports if isinstance(port, dict)]
                return DeviceDetailResponse(device=device, ports=port_models)
        return None

    async def operate_device(
        self, device_id: str, operation: str, olt_id: str | None = None
    ) -> bool:
        if olt_id:
            driver = self._driver(olt_id)
            return await driver.operate_device(device_id, operation)

        for descriptor in self._descriptors():
            driver = self._instantiate(descriptor)
            try:
                if await driver.operate_device(device_id, operation):
                    return True
            except NotImplementedError:
                continue
        return False

    async def get_alarms_v2(self) -> VOLTHAAlarmListResponse:
        alarms: list[VOLTHAAlarm] = []
        for descriptor in self._descriptors():
            driver = self._instantiate(descriptor)
            try:
                driver_alarms = await driver.fetch_alarms()
            except NotImplementedError:
                continue
            for alarm in driver_alarms:
                alarms.append(
                    VOLTHAAlarm(
                        id=alarm.alarm_id,
                        type="ACCESS",
                        category="OLT",
                        severity=alarm.severity,
                        state="RAISED",
                        resource_id=alarm.resource_id or descriptor.config.olt_id,
                        description=alarm.message,
                        context={},
                        raised_ts=str(alarm.raised_at),
                    )
                )

        return VOLTHAAlarmListResponse(alarms=alarms, total=len(alarms))

    async def get_olt_overview(self, olt_id: str) -> OLTOverview:
        driver = self._driver(olt_id)
        try:
            raw_devices = await driver.list_devices()
        except NotImplementedError:
            raw_devices = []

        devices = [VolthaDevice(**entry) for entry in raw_devices]

        root_device = next(
            (
                device
                for device in devices
                if device.id == olt_id or (device.root and device.parent_id is None)
            ),
            None,
        )
        onus = [device for device in devices if not device.root]

        total_onus = len(onus)
        online_onus = sum(
            1
            for onu in onus
            if (onu.oper_status or "").upper() in {"ACTIVE", "ENABLED", "ONLINE"}
            or (onu.connect_status or "").upper() == "REACHABLE"
        )

        return OLTOverview(
            device_id=olt_id,
            serial_number=(root_device.serial_number if root_device else "") or "",
            model=(root_device.model if root_device else "") or "Unknown",
            firmware_version=(root_device.firmware_version if root_device else "") or "",
            admin_state=(root_device.admin_state if root_device else "") or "UNKNOWN",
            oper_status=(root_device.oper_status if root_device else "") or "UNKNOWN",
            connect_status=(root_device.connect_status if root_device else "") or "UNKNOWN",
            total_pon_ports=0,
            active_pon_ports=0,
            total_onus=total_onus,
            online_onus=online_onus,
            pon_ports=[],
        )

    async def get_port_statistics(self, olt_id: str, port_no: int) -> dict[str, Any]:
        try:
            metrics = await self.collect_metrics(olt_id)
        except NotImplementedError:
            metrics = OltMetrics(
                olt_id=olt_id,
                pon_ports_up=0,
                pon_ports_total=0,
                onu_online=0,
                onu_total=0,
                raw={},
            )
        return {
            "device_id": olt_id,
            "port_no": port_no,
            "timestamp": metrics.raw.get("timestamp") if metrics.raw else "",
            "rx_power": metrics.raw.get("rx_power"),
            "tx_power": metrics.raw.get("tx_power"),
            "rx_bytes": metrics.raw.get("rx_bytes"),
            "tx_bytes": metrics.raw.get("tx_bytes"),
        }

    async def get_statistics(self) -> PONStatistics:
        logical_devices = await self.list_logical_devices()
        devices = await self.list_devices()

        total_ports = 0
        active_ports = 0
        total_flows = 0
        active_olts = 0

        onu_devices = [device for device in devices.devices if not device.root]
        root_devices = {device.id: device for device in devices.devices if device.root}

        for logical_device in logical_devices.devices:
            ports = logical_device.ports or []
            total_ports += len(ports)
            active_port_flags = [
                isinstance(port, dict)
                and isinstance(port.get("ofp_port"), dict)
                and port["ofp_port"].get("state", 1) == 0
                for port in ports
            ]
            active_ports += sum(1 for flag in active_port_flags if flag)
            total_flows += len(logical_device.flows or [])

            is_active = any(active_port_flags)
            if not is_active:
                root_id = logical_device.root_device_id or logical_device.id
                root_device = root_devices.get(root_id)
                if root_device and (
                    (root_device.oper_status or "").upper() in {"ACTIVE", "ENABLED", "ONLINE"}
                    or (root_device.connect_status or "").upper() == "REACHABLE"
                ):
                    is_active = True

            if is_active:
                active_olts += 1
        total_onus = len(onu_devices)
        online_onus = sum(
            1
            for onu in onu_devices
            if (onu.oper_status or "").upper() in {"ACTIVE", "ENABLED", "ONLINE"}
            or (onu.connect_status or "").upper() == "REACHABLE"
        )

        adapter_names = {
            descriptor.driver_cls.__name__ for descriptor in self.registry.descriptors()
        }

        return PONStatistics(
            total_olts=logical_devices.total,
            active_olts=active_olts,
            total_onus=total_onus,
            active_onus=online_onus,
            online_onus=online_onus,
            offline_onus=max(total_onus - online_onus, 0),
            total_flows=total_flows,
            total_ports=total_ports,
            active_ports=active_ports,
            adapters=sorted(adapter_names),
        )
