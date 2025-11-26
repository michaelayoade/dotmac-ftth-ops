"""
Core abstractions for access-network drivers.

Drivers that manage OLT platforms must implement the :class:`BaseOLTDriver`
interface. The interface focuses on the operations needed by higher-level
services (inventory, provisioning, telemetry) rather than the underlying
protocols.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import BaseModel, Field


class OLTAlarm(BaseModel):
    """Normalized alarm structure emitted by OLT drivers."""

    alarm_id: str
    severity: str
    message: str
    raised_at: float = Field(description="Unix timestamp")
    resource_id: str | None = Field(default=None, description="Port or ONU identifier")


class ONUProvisionRequest(BaseModel):
    """Input required to provision an ONU."""

    onu_id: str
    serial_number: str
    line_profile_id: str | None = None
    service_profile_id: str | None = None
    vlan: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ONUProvisionResult(BaseModel):
    """Result of the provisioning workflow."""

    success: bool
    onu_id: str | None = None
    message: str | None = None
    applied_config: dict[str, Any] = Field(default_factory=dict)


class DeviceDiscovery(BaseModel):
    """Information about ONUs discovered on the PON."""

    onu_id: str
    serial_number: str
    state: str
    rssi: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class OltMetrics(BaseModel):
    """Summarised metrics for an OLT."""

    olt_id: str
    pon_ports_up: int
    pon_ports_total: int
    onu_online: int
    onu_total: int
    upstream_rate_mbps: float | None = None
    downstream_rate_mbps: float | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class DriverCapabilities(BaseModel):
    """Advertised capabilities of a driver implementation."""

    supports_onu_provisioning: bool = True
    supports_vlan_change: bool = True
    supports_backup_restore: bool = False
    supports_realtime_alarms: bool = False
    supported_operations: list[str] = Field(default_factory=list)


class DriverConfig(BaseModel):
    """
    Base configuration for drivers.

    Concrete drivers may extend this via ``model_config`` with additional fields
    (e.g. SNMP community strings, TR-069 ACS URLs).
    """

    olt_id: str
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


@dataclass(slots=True)
class DriverContext:
    """
    Context passed to drivers when they are instantiated.

    It provides logger bindings, tenant identification and hook objects (e.g.
    event bus references) without hard-coding them into the driver.
    """

    tenant_id: str | None = None
    logger_name: str = "access.driver"
    hooks: dict[str, Any] | None = None


class BaseOLTDriver(abc.ABC):
    """
    Abstract base class for OLT drivers.

    Drivers should perform any expensive initialisation (auth, session setup)
    lazily inside the coroutine methods to avoid blocking the event loop during
    instantiation.
    """

    def __init__(self, config: DriverConfig, context: DriverContext | None = None) -> None:
        self.config = config
        self.context = context or DriverContext()

    # --------------------------------------------------------------------- #
    # Inventory & Discovery
    # --------------------------------------------------------------------- #

    @abc.abstractmethod
    async def discover_onus(self) -> list[DeviceDiscovery]:
        """Return ONUs discovered on the OLT."""

    @abc.abstractmethod
    async def get_capabilities(self) -> DriverCapabilities:
        """Return driver capability descriptor."""

    @abc.abstractmethod
    async def list_logical_devices(self) -> list[dict[str, Any]]:
        """Return logical device (OLT) information."""

    @abc.abstractmethod
    async def list_devices(self) -> list[dict[str, Any]]:
        """Return physical device/ONU information."""

    @abc.abstractmethod
    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        """Return a specific device."""

    # --------------------------------------------------------------------- #
    # Provisioning
    # --------------------------------------------------------------------- #

    @abc.abstractmethod
    async def provision_onu(self, request: ONUProvisionRequest) -> ONUProvisionResult:
        """Provision a new ONU."""

    @abc.abstractmethod
    async def remove_onu(self, onu_id: str) -> bool:
        """De-provision an ONU. Returns True if it was present."""

    @abc.abstractmethod
    async def apply_service_profile(
        self, onu_id: str, service_profile: dict[str, Any]
    ) -> ONUProvisionResult:
        """Apply a service profile (VLANs, QoS, etc.) to an ONU."""

    # --------------------------------------------------------------------- #
    # Telemetry & Maintenance
    # --------------------------------------------------------------------- #

    @abc.abstractmethod
    async def collect_metrics(self) -> OltMetrics:
        """Collect summary metrics."""

    @abc.abstractmethod
    async def fetch_alarms(self) -> list[OLTAlarm]:
        """Fetch active alarms."""

    @abc.abstractmethod
    async def backup_configuration(self) -> bytes:
        """Return a binary configuration backup."""

    @abc.abstractmethod
    async def restore_configuration(self, payload: bytes) -> None:
        """Restore a configuration backup."""

    @abc.abstractmethod
    async def operate_device(self, device_id: str, operation: str) -> bool:
        """Perform a device operation (enable/disable/reboot)."""

    @abc.abstractmethod
    async def get_health(self) -> dict[str, Any]:
        """Return health information."""

    # Optional alarm operations (not all drivers implement these)
    async def acknowledge_alarm(self, alarm_id: str) -> bool:
        """Acknowledge an alarm if the driver supports it."""
        raise NotImplementedError("Alarm acknowledgement not supported by driver")

    async def clear_alarm(self, alarm_id: str) -> bool:
        """Clear an alarm if the driver supports it."""
        raise NotImplementedError("Alarm clear not supported by driver")


class Tr069ACSClient(Protocol):
    """Minimal protocol describing the TR-069 ACS interactions drivers expect."""

    async def apply_profile(self, serial_number: str, profile: dict[str, Any]) -> None: ...
