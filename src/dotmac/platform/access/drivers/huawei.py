"""
Huawei OLT driver implemented with CLI (Netmiko) and SNMP helpers.

The driver focuses on providing a pragmatic bridge that can be extended with
vendor-specific knowledge incrementally. Expensive operations (CLI sessions,
SNMP polling) are executed in worker threads so that the asyncio event loop is
not blocked.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any

from pydantic import Field

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

CLI_PROMPT = r"<(?P<hostname>.+)>"


class HuaweiDriverConfig(DriverConfig):
    """
    Extended configuration for Huawei OLT driver.

    Attributes:
        snmp: Optional SNMP configuration dictionary with keys ``community`` and
            ``port``.
        tr069_profile: Optional mapping used when pushing TR-069 overrides.
    """

    snmp: dict[str, Any] | None = Field(default=None)
    tr069_profile: dict[str, Any] | None = Field(default=None)


class HuaweiCLIDriver(BaseOLTDriver):
    """Huawei OLT driver using SSH CLI (via Netmiko) and SNMP polling."""

    CONFIG_MODEL = HuaweiDriverConfig

    def __init__(self, config: DriverConfig, context: DriverContext | None = None) -> None:
        super().__init__(config if isinstance(config, HuaweiDriverConfig) else HuaweiDriverConfig(**config.model_dump()), context)
        self._cli_lock = asyncio.Lock()

    # ------------------------------------------------------------------ #
    # Inventory & Discovery
    # ------------------------------------------------------------------ #

    async def discover_onus(self) -> list[DeviceDiscovery]:
        output = await self._run_cli_command("display ont info summary")
        devices: list[DeviceDiscovery] = []
        for line in output.splitlines():
            match = re.search(r"(?P<frame>\d+)/(?P<slot>\d+)/(?P<port>\d+)\s+(?P<onu>\d+)\s+(?P<sn>[A-Z0-9]+)\s+(?P<state>\w+)", line)
            if not match:
                continue
            port = f"{match.group('frame')}/{match.group('slot')}/{match.group('port')}"
            onu_id = f"{port}/{match.group('onu')}"
            devices.append(
                DeviceDiscovery(
                    onu_id=onu_id,
                    serial_number=match.group("sn"),
                    state=match.group("state"),
                    metadata={
                        "port": port,
                        "pon_port": port,
                        "olt_id": self.config.olt_id,
                        "vendor_id": "Huawei",
                    },
                )
            )
        return devices

    async def get_capabilities(self) -> DriverCapabilities:
        return DriverCapabilities(
            supports_onu_provisioning=True,
            supports_vlan_change=True,
            supports_backup_restore=True,
            supports_realtime_alarms=False,
            supported_operations=[],
        )

    async def list_logical_devices(self) -> list[dict[str, Any]]:
        return [
            {
                "id": self.config.olt_id or "huawei-olt",
                "datapath_id": self.config.olt_id or "huawei-olt",
                "desc": {
                    "mfr_desc": "Huawei",
                    "hw_desc": "CLI/SNMP",
                    "sw_desc": "Netmiko",
                },
                "root_device_id": self.config.olt_id or "huawei-olt",
                "switch_features": {},
            }
        ]

    async def list_devices(self) -> list[dict[str, Any]]:
        devices = []
        for onu in await self.discover_onus():
            devices.append(
                {
                    "id": onu.onu_id,
                    "type": "ONU",
                    "root": False,
                    "parent_id": self.config.olt_id,
                    "parent_port_no": onu.metadata.get("port"),
                    "vendor": "Huawei",
                    "model": "Unknown",
                    "serial_number": onu.serial_number,
                    "oper_status": onu.state,
                    "connect_status": "REACHABLE" if onu.state.lower() == "online" else "UNREACHABLE",
                    "metadata": onu.metadata,
                }
            )

        devices.append(
            {
                "id": self.config.olt_id or "huawei-olt",
                "type": "OLT",
                "root": True,
                "parent_id": None,
                "parent_port_no": None,
                "vendor": "Huawei",
                "model": "Unknown",
                "serial_number": self.config.extra.get("serial_number"),
                "oper_status": "ACTIVE",
                "connect_status": "REACHABLE",
                "metadata": {"host": self.config.host},
            }
        )
        return devices

    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        for device in await self.list_devices():
            if device["id"] == device_id:
                return device
        return None

    # ------------------------------------------------------------------ #
    # Provisioning
    # ------------------------------------------------------------------ #

    async def provision_onu(self, request: ONUProvisionRequest) -> ONUProvisionResult:
        """
        Provision a Huawei ONU using CLI commands.

        The flow is intentionally simplified: it creates a basic service port
        and associates the ONU with the provided profiles.
        """

        commands_interface = [
            f"interface gpon {request.metadata.get('port')}",
            f"ont add {request.metadata.get('onu_index', 1)} sn-auth {request.serial_number}",
        ]
        if request.line_profile_id:
            commands_interface[-1] += f" lineprofile-id {request.line_profile_id}"
        if request.service_profile_id:
            commands_interface[-1] += f" serviceprofile-id {request.service_profile_id}"

        commands_interface.append("quit")

        await self._run_config_commands(commands_interface)

        # Optional VLAN mapping
        if request.vlan is not None:
            await self._run_config_commands(
                [
                    f"service-port vlan {request.vlan} gpon {request.metadata.get('port')} "
                    f"ont {request.metadata.get('onu_index', 1)} gem 1 multi-service user-vlan {request.vlan}"
                ]
            )

        # Optional TR-069 push if profile provided
        if self.config.tr069_profile:
            await self._push_tr069_profile(request)

        return ONUProvisionResult(success=True, applied_config=request.model_dump())

    async def apply_service_profile(
        self, onu_id: str, service_profile: dict[str, Any]
    ) -> ONUProvisionResult:
        vlan = service_profile.get("vlan")
        if vlan is None:
            return ONUProvisionResult(
                success=False, message="Service profile missing 'vlan' attribute"
            )

        # Extract port and ONU index from the identifier
        try:
            port, onu_index = onu_id.rsplit("/", 1)
        except ValueError:
            return ONUProvisionResult(success=False, message="Invalid ONU identifier")

        await self._run_config_commands(
            [
                f"undo service-port gpon {port} ont {onu_index}",
                f"service-port vlan {vlan} gpon {port} ont {onu_index} gem 1 multi-service user-vlan {vlan}",
            ]
        )
        return ONUProvisionResult(success=True, applied_config=service_profile)

    async def remove_onu(self, onu_id: str) -> bool:
        try:
            port, onu_index = onu_id.rsplit("/", 1)
        except ValueError:
            return False

        await self._run_config_commands(
            [
                f"interface gpon {port}",
                f"ont delete {onu_index}",
                "quit",
            ]
        )
        await self._run_config_commands(
            [
                f"undo service-port gpon {port} ont {onu_index}",
            ]
        )
        return True

    # ------------------------------------------------------------------ #
    # Telemetry
    # ------------------------------------------------------------------ #

    async def collect_metrics(self) -> OltMetrics:
        # For now fetch simple metrics using CLI summary and fallback to zeros.
        discovery = await self.discover_onus()
        online = sum(1 for onu in discovery if onu.state.upper() == "ONLINE")

        return OltMetrics(
            olt_id=self.config.olt_id,
            pon_ports_up=0,
            pon_ports_total=0,
            onu_online=online,
            onu_total=len(discovery),
            raw={"note": "Detailed SNMP metrics not yet implemented"},
        )

    async def fetch_alarms(self) -> list[OLTAlarm]:
        output = await self._run_exec_command("display alarm active")
        alarms: list[OLTAlarm] = []
        for line in output.splitlines():
            match = re.search(r"(?P<id>[A-Z0-9-]+)\s+(?P<severity>Critical|Major|Minor|Warning)\s+(?P<desc>.+)", line)
            if match:
                alarms.append(
                    OLTAlarm(
                        alarm_id=match.group("id"),
                        severity=match.group("severity"),
                        message=match.group("desc"),
                        raised_at=asyncio.get_event_loop().time(),
                    )
                )
        return alarms

    async def backup_configuration(self) -> bytes:
        output = await self._run_exec_command("display current-configuration")
        return output.encode("utf-8")

    async def restore_configuration(self, payload: bytes) -> None:
        # Restoration requires uploading the configuration file; this is a stub.
        raise NotImplementedError("Huawei configuration restore is not implemented yet")

    async def operate_device(self, device_id: str, operation: str) -> bool:
        # Huawei CLI driver does not currently support device-level operations via API.
        return False

    async def get_health(self) -> dict[str, Any]:
        return {
            "healthy": True,
            "state": "HEALTHY",
            "message": "Huawei CLI connection assumed healthy",
            "total_devices": len(await self.discover_onus()),
        }

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    async def _run_config_commands(self, commands: list[str]) -> str:
        async with self._cli_lock:
            return await asyncio.to_thread(self._execute_config_commands, commands)

    async def _run_exec_command(self, command: str) -> str:
        async with self._cli_lock:
            return await asyncio.to_thread(self._execute_exec_command, command)

    def _connect(self):
        try:
            from netmiko import ConnectHandler  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError(
                "netmiko is required for Huawei CLI driver. Install with 'pip install netmiko'."
            ) from exc

        return ConnectHandler(
            device_type="huawei",
            host=self.config.host,
            port=self.config.port or 22,
            username=self.config.username,
            password=self.config.password,
            session_log=None,
        )

    def _execute_config_commands(self, commands: list[str]) -> str:
        connection = self._connect()
        try:
            return connection.send_config_set(commands, exit_config_mode=True)
        finally:
            connection.disconnect()

    def _execute_exec_command(self, command: str) -> str:
        connection = self._connect()
        try:
            # Accept both normal and configuration prompts
            return connection.send_command(
                command, expect_string=r"[<\[].+>", strip_prompt=False, strip_command=False
            )
        finally:
            connection.disconnect()

    async def _push_tr069_profile(self, request: ONUProvisionRequest) -> None:
        """
        Push TR-069 configuration to the ONU if an ACS client is provided.

        The ACS client should be passed via ``context.hooks['acs_client']``.
        """

        if not self.config.tr069_profile:
            return
        if not self.context.hooks:
            return

        acs_client = self.context.hooks.get("acs_client")
        if acs_client is None:
            return

        apply_coro = getattr(acs_client, "apply_profile", None)
        if apply_coro is None:
            return

        await apply_coro(request.serial_number, self.config.tr069_profile)
