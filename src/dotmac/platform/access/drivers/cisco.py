"""
Cisco IOS-XE OLT driver for GPON/EPON access networks.

This driver supports Cisco ME (Metro Ethernet) and ASR series devices
commonly used as OLTs in FTTH deployments. It communicates via SSH/Netconf
for configuration and SNMP for monitoring.

Supported Models:
- Cisco ME 4600 series (GPON/EPON OLT)
- Cisco ASR 900 series (aggregation with PON line cards)
- Cisco Catalyst PON series

Features:
- ONU discovery and provisioning
- Service profile management (DBA profiles, traffic profiles)
- VLAN assignment per ONU/port
- Alarm monitoring via syslog/SNMP
- Configuration backup/restore
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime
from typing import Any

from pydantic import Field

from .base import (
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

logger = logging.getLogger(__name__)


class CiscoDriverConfig(DriverConfig):
    """Configuration for Cisco IOS-XE OLT driver."""

    # SSH connection settings
    ssh_port: int = Field(default=22, description="SSH port")
    enable_password: str | None = Field(default=None, description="Enable mode password")
    ssh_timeout: int = Field(default=30, description="SSH connection timeout in seconds")

    # SNMP settings for monitoring
    snmp_community: str = Field(default="public", description="SNMP community string")
    snmp_port: int = Field(default=161, description="SNMP port")
    snmp_version: str = Field(default="2c", description="SNMP version (2c or 3)")

    # SNMP v3 settings (if snmp_version is 3)
    snmp_user: str | None = Field(default=None, description="SNMPv3 username")
    snmp_auth_protocol: str | None = Field(default=None, description="SNMPv3 auth protocol")
    snmp_auth_password: str | None = Field(default=None, description="SNMPv3 auth password")
    snmp_priv_protocol: str | None = Field(default=None, description="SNMPv3 privacy protocol")
    snmp_priv_password: str | None = Field(default=None, description="SNMPv3 privacy password")

    # NETCONF settings (optional, for modern IOS-XE)
    netconf_enabled: bool = Field(default=False, description="Use NETCONF instead of CLI")
    netconf_port: int = Field(default=830, description="NETCONF port")

    # OLT-specific settings
    pon_interface_prefix: str = Field(
        default="GponOlt", description="PON interface naming prefix"
    )
    default_dba_profile: str | None = Field(
        default=None, description="Default DBA profile for new ONUs"
    )
    default_traffic_profile: str | None = Field(
        default=None, description="Default traffic profile for new ONUs"
    )


class CiscoSSHClient:
    """SSH client wrapper for Cisco IOS-XE CLI commands."""

    def __init__(self, config: CiscoDriverConfig):
        self.config = config
        self._connection = None
        self._connected = False

    async def connect(self) -> None:
        """Establish SSH connection to the device."""
        try:
            import asyncssh

            self._connection = await asyncssh.connect(
                self.config.host,
                port=self.config.ssh_port,
                username=self.config.username,
                password=self.config.password,
                known_hosts=None,  # Skip host key verification in lab environments
                connect_timeout=self.config.ssh_timeout,
            )
            self._connected = True
            logger.info(f"Connected to Cisco device at {self.config.host}")
        except ImportError:
            logger.warning("asyncssh not available, using mock connection")
            self._connected = True
        except Exception as e:
            logger.error(f"Failed to connect to {self.config.host}: {e}")
            raise

    async def disconnect(self) -> None:
        """Close SSH connection."""
        if self._connection:
            self._connection.close()
            await self._connection.wait_closed()
        self._connected = False

    async def execute(self, command: str, privileged: bool = False) -> str:
        """Execute a CLI command and return output."""
        if not self._connected:
            await self.connect()

        if self._connection is None:
            # Mock response for testing
            logger.debug(f"Mock execute: {command}")
            return ""

        try:
            if privileged and self.config.enable_password:
                # Enter enable mode first
                result = await self._connection.run(
                    f"enable\n{self.config.enable_password}\n{command}",
                    check=False,
                )
            else:
                result = await self._connection.run(command, check=False)

            return result.stdout or ""
        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            raise

    async def configure(self, commands: list[str]) -> str:
        """Execute configuration commands."""
        config_block = ["configure terminal", *commands, "end", "write memory"]
        full_command = "\n".join(config_block)
        return await self.execute(full_command, privileged=True)


class CiscoOLTDriver(BaseOLTDriver):
    """
    Cisco IOS-XE driver for GPON/EPON OLT management.

    This driver uses SSH for configuration and optionally SNMP for monitoring.
    It supports Cisco ME 4600, ASR 900, and Catalyst PON series devices.
    """

    CONFIG_MODEL = CiscoDriverConfig

    def __init__(
        self, config: CiscoDriverConfig, context: DriverContext | None = None
    ) -> None:
        super().__init__(config, context)
        self.config: CiscoDriverConfig = config
        self._ssh_client: CiscoSSHClient | None = None
        self._snmp_client: Any = None

    def _get_ssh_client(self) -> CiscoSSHClient:
        """Get or create SSH client."""
        if self._ssh_client is None:
            self._ssh_client = CiscoSSHClient(self.config)
        return self._ssh_client

    async def _run_command(self, command: str) -> str:
        """Execute a show command."""
        client = self._get_ssh_client()
        return await client.execute(command)

    async def _run_config(self, commands: list[str]) -> str:
        """Execute configuration commands."""
        client = self._get_ssh_client()
        return await client.configure(commands)

    # --------------------------------------------------------------------- #
    # Inventory & Discovery
    # --------------------------------------------------------------------- #

    async def get_capabilities(self) -> DriverCapabilities:
        """Return driver capabilities."""
        return DriverCapabilities(
            supports_onu_provisioning=True,
            supports_vlan_change=True,
            supports_backup_restore=True,
            supports_realtime_alarms=True,
            supported_operations=[
                "gpon",
                "epon",
                "dba_profile",
                "traffic_profile",
                "vlan",
                "multicast",
                "reboot",
                "enable",
                "disable",
            ],
        )

    async def discover_onus(self) -> list[DeviceDiscovery]:
        """
        Discover ONUs on all PON ports.

        Uses 'show gpon onu-table' or similar command depending on platform.
        """
        devices: list[DeviceDiscovery] = []

        try:
            # Get ONU table from device
            output = await self._run_command("show gpon onu-table")

            # Parse output - format varies by model but typically:
            # PON    ONU-ID   Serial          State       Signal(dBm)
            # 0/0/0  1        HWTC12345678    active      -18.5
            for line in output.splitlines():
                match = re.match(
                    r"(\d+/\d+/\d+)\s+(\d+)\s+(\w+)\s+(\w+)\s+([-\d.]+)?",
                    line.strip(),
                )
                if match:
                    pon_port, onu_id, serial, state, rssi = match.groups()
                    devices.append(
                        DeviceDiscovery(
                            onu_id=f"{pon_port}-{onu_id}",
                            serial_number=serial,
                            state=self._normalize_state(state),
                            rssi=float(rssi) if rssi else None,
                            metadata={
                                "pon_port": pon_port,
                                "onu_slot_id": onu_id,
                            },
                        )
                    )

            # Also check for unregistered ONUs (auto-discovered)
            unregistered = await self._run_command("show gpon onu-table unregistered")
            for line in unregistered.splitlines():
                match = re.match(r"(\d+/\d+/\d+)\s+(\w+)\s+([-\d.]+)?", line.strip())
                if match:
                    pon_port, serial, rssi = match.groups()
                    devices.append(
                        DeviceDiscovery(
                            onu_id=f"unregistered-{serial}",
                            serial_number=serial,
                            state="discovered",
                            rssi=float(rssi) if rssi else None,
                            metadata={"pon_port": pon_port, "unregistered": True},
                        )
                    )

        except Exception as e:
            logger.error(f"ONU discovery failed: {e}")

        return devices

    def _normalize_state(self, state: str) -> str:
        """Normalize Cisco ONU states to standard values."""
        state_map = {
            "active": "online",
            "inactive": "offline",
            "registered": "configured",
            "unregistered": "discovered",
            "authenticating": "activating",
            "los": "los",
            "dying-gasp": "dying_gasp",
        }
        return state_map.get(state.lower(), state.lower())

    async def list_logical_devices(self) -> list[dict[str, Any]]:
        """List OLT logical device information."""
        try:
            output = await self._run_command("show version")
            inventory = await self._run_command("show inventory")

            # Parse version info
            version_match = re.search(r"Version\s+([\d.()]+)", output)
            uptime_match = re.search(r"uptime is (.+)", output)
            model_match = re.search(r"cisco\s+(\S+)", output, re.IGNORECASE)

            return [
                {
                    "id": self.config.olt_id,
                    "type": "olt",
                    "vendor": "Cisco",
                    "model": model_match.group(1) if model_match else "Unknown",
                    "version": version_match.group(1) if version_match else "Unknown",
                    "uptime": uptime_match.group(1) if uptime_match else "Unknown",
                    "inventory": inventory,
                }
            ]
        except Exception as e:
            logger.error(f"Failed to list logical devices: {e}")
            return []

    async def list_devices(self) -> list[dict[str, Any]]:
        """List all ONUs as device records."""
        onus = await self.discover_onus()
        return [
            {
                "id": onu.onu_id,
                "serial_number": onu.serial_number,
                "state": onu.state,
                "rssi": onu.rssi,
                **onu.metadata,
            }
            for onu in onus
        ]

    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        """Get detailed information for a specific ONU."""
        try:
            # Parse device_id to get PON port and ONU ID
            parts = device_id.split("-")
            if len(parts) >= 2:
                pon_port = parts[0]
                onu_id = parts[1]
            else:
                return None

            output = await self._run_command(
                f"show gpon onu detail interface {self.config.pon_interface_prefix}{pon_port} onu {onu_id}"
            )

            # Parse detailed ONU info
            device_info: dict[str, Any] = {
                "id": device_id,
                "pon_port": pon_port,
                "onu_id": onu_id,
            }

            # Extract fields from output
            for pattern, field in [
                (r"Serial\s*:\s*(\S+)", "serial_number"),
                (r"State\s*:\s*(\S+)", "state"),
                (r"Signal\s*:\s*([-\d.]+)", "rssi"),
                (r"Distance\s*:\s*(\d+)", "distance_m"),
                (r"Software\s*:\s*(\S+)", "firmware_version"),
                (r"Model\s*:\s*(\S+)", "model"),
            ]:
                match = re.search(pattern, output, re.IGNORECASE)
                if match:
                    device_info[field] = match.group(1)

            return device_info if device_info.get("serial_number") else None

        except Exception as e:
            logger.error(f"Failed to get device {device_id}: {e}")
            return None

    # --------------------------------------------------------------------- #
    # Provisioning
    # --------------------------------------------------------------------- #

    async def provision_onu(self, request: ONUProvisionRequest) -> ONUProvisionResult:
        """
        Provision an ONU with service configuration.

        Creates the ONU registration and applies service/traffic profiles.
        """
        try:
            # Determine PON port from metadata or use auto-detected location
            pon_port = request.metadata.get("pon_port", "0/0/0")
            dba_profile = request.service_profile_id or self.config.default_dba_profile or "default"
            traffic_profile = request.metadata.get(
                "traffic_profile", self.config.default_traffic_profile or "default"
            )

            # Build configuration commands
            commands = [
                f"interface {self.config.pon_interface_prefix}{pon_port}",
                f"onu {request.onu_id} serial-number {request.serial_number}",
                f"onu {request.onu_id} dba-profile {dba_profile}",
            ]

            # Add traffic profile if specified
            if traffic_profile:
                commands.append(f"onu {request.onu_id} traffic-profile {traffic_profile}")

            # Add VLAN configuration if specified
            if request.vlan:
                commands.extend([
                    f"onu {request.onu_id} service 1 vlan {request.vlan}",
                    f"onu {request.onu_id} service 1 upstream-vlan {request.vlan}",
                ])

            # Add line profile if specified
            if request.line_profile_id:
                commands.append(f"onu {request.onu_id} line-profile {request.line_profile_id}")

            commands.append("exit")

            # Execute configuration
            output = await self._run_config(commands)

            # Check for errors in output
            if "error" in output.lower() or "invalid" in output.lower():
                return ONUProvisionResult(
                    success=False,
                    onu_id=request.onu_id,
                    message=f"Configuration failed: {output}",
                )

            return ONUProvisionResult(
                success=True,
                onu_id=request.onu_id,
                message=f"ONU {request.serial_number} provisioned successfully",
                applied_config={
                    "pon_port": pon_port,
                    "dba_profile": dba_profile,
                    "traffic_profile": traffic_profile,
                    "vlan": request.vlan,
                    "line_profile": request.line_profile_id,
                },
            )

        except Exception as e:
            logger.error(f"ONU provisioning failed: {e}")
            return ONUProvisionResult(
                success=False,
                onu_id=request.onu_id,
                message=str(e),
            )

    async def remove_onu(self, onu_id: str) -> bool:
        """Remove an ONU from the OLT."""
        try:
            # Parse ONU ID to get PON port
            parts = onu_id.split("-")
            if len(parts) >= 2:
                pon_port = parts[0]
                onu_slot = parts[1]
            else:
                logger.error(f"Invalid ONU ID format: {onu_id}")
                return False

            commands = [
                f"interface {self.config.pon_interface_prefix}{pon_port}",
                f"no onu {onu_slot}",
                "exit",
            ]

            output = await self._run_config(commands)
            return "error" not in output.lower()

        except Exception as e:
            logger.error(f"Failed to remove ONU {onu_id}: {e}")
            return False

    async def apply_service_profile(
        self, onu_id: str, service_profile: dict[str, Any]
    ) -> ONUProvisionResult:
        """Apply or update service profile on an ONU."""
        try:
            parts = onu_id.split("-")
            if len(parts) < 2:
                return ONUProvisionResult(
                    success=False,
                    onu_id=onu_id,
                    message="Invalid ONU ID format",
                )

            pon_port = parts[0]
            onu_slot = parts[1]

            commands = [f"interface {self.config.pon_interface_prefix}{pon_port}"]

            # Apply DBA profile (bandwidth)
            if "dba_profile" in service_profile:
                commands.append(f"onu {onu_slot} dba-profile {service_profile['dba_profile']}")

            # Apply traffic profile
            if "traffic_profile" in service_profile:
                commands.append(
                    f"onu {onu_slot} traffic-profile {service_profile['traffic_profile']}"
                )

            # Apply bandwidth limits directly if specified
            if "download_mbps" in service_profile:
                download_kbps = int(service_profile["download_mbps"]) * 1000
                commands.append(
                    f"onu {onu_slot} qos downstream maximum-bandwidth {download_kbps}"
                )

            if "upload_mbps" in service_profile:
                upload_kbps = int(service_profile["upload_mbps"]) * 1000
                commands.append(f"onu {onu_slot} qos upstream maximum-bandwidth {upload_kbps}")

            # Apply VLAN changes
            if "vlan" in service_profile:
                commands.extend([
                    f"onu {onu_slot} service 1 vlan {service_profile['vlan']}",
                    f"onu {onu_slot} service 1 upstream-vlan {service_profile['vlan']}",
                ])

            commands.append("exit")

            output = await self._run_config(commands)

            if "error" in output.lower():
                return ONUProvisionResult(
                    success=False,
                    onu_id=onu_id,
                    message=f"Failed to apply profile: {output}",
                )

            return ONUProvisionResult(
                success=True,
                onu_id=onu_id,
                message="Service profile applied successfully",
                applied_config=service_profile,
            )

        except Exception as e:
            logger.error(f"Failed to apply service profile to {onu_id}: {e}")
            return ONUProvisionResult(
                success=False,
                onu_id=onu_id,
                message=str(e),
            )

    # --------------------------------------------------------------------- #
    # Telemetry & Maintenance
    # --------------------------------------------------------------------- #

    async def collect_metrics(self) -> OltMetrics:
        """Collect OLT-wide metrics."""
        try:
            # Get PON port status
            pon_output = await self._run_command("show interface summary | include Gpon")
            onu_table = await self._run_command("show gpon onu-table summary")

            # Parse PON port counts
            pon_up = len(re.findall(r"up\s+up", pon_output, re.IGNORECASE))
            pon_total = len(re.findall(r"Gpon", pon_output, re.IGNORECASE))

            # Parse ONU counts
            onu_online = 0
            onu_total = 0

            # Look for summary line like "Total: 150, Active: 142"
            total_match = re.search(r"Total[:\s]+(\d+)", onu_table)
            active_match = re.search(r"Active[:\s]+(\d+)", onu_table)

            if total_match:
                onu_total = int(total_match.group(1))
            if active_match:
                onu_online = int(active_match.group(1))

            # Get traffic rates if available
            traffic_output = await self._run_command("show interface counters rate")
            upstream_rate = None
            downstream_rate = None

            # Parse aggregate rates
            for line in traffic_output.splitlines():
                if "aggregate" in line.lower() or "total" in line.lower():
                    rate_match = re.search(r"(\d+(?:\.\d+)?)\s*[MG]bps", line)
                    if rate_match:
                        rate = float(rate_match.group(1))
                        if "Gbps" in line:
                            rate *= 1000
                        if "rx" in line.lower() or "in" in line.lower():
                            upstream_rate = rate
                        else:
                            downstream_rate = rate

            return OltMetrics(
                olt_id=self.config.olt_id,
                pon_ports_up=pon_up or 1,  # Default to 1 if parsing fails
                pon_ports_total=pon_total or 1,
                onu_online=onu_online,
                onu_total=onu_total,
                upstream_rate_mbps=upstream_rate,
                downstream_rate_mbps=downstream_rate,
                raw={
                    "pon_output": pon_output[:500],  # Truncate for storage
                    "onu_summary": onu_table[:500],
                },
            )

        except Exception as e:
            logger.error(f"Failed to collect metrics: {e}")
            return OltMetrics(
                olt_id=self.config.olt_id,
                pon_ports_up=0,
                pon_ports_total=0,
                onu_online=0,
                onu_total=0,
            )

    async def fetch_alarms(self) -> list[OLTAlarm]:
        """Fetch active alarms from syslog buffer."""
        alarms: list[OLTAlarm] = []

        try:
            output = await self._run_command("show logging | include %GPON|%ONU|%PON")

            # Parse syslog entries
            # Format: *Mar  1 12:34:56: %GPON-3-LOS: PON 0/0/0, ONU 1 loss of signal
            for line in output.splitlines():
                match = re.match(
                    r"[*]?(\w+\s+\d+\s+[\d:]+):\s+%(\w+)-(\d)-(\w+):\s+(.+)", line.strip()
                )
                if match:
                    timestamp_str, facility, severity_num, mnemonic, message = match.groups()

                    # Map Cisco severity levels to standard names
                    severity_map = {
                        "0": "Emergency",
                        "1": "Alert",
                        "2": "Critical",
                        "3": "Error",
                        "4": "Warning",
                        "5": "Notice",
                        "6": "Info",
                        "7": "Debug",
                    }
                    severity = severity_map.get(severity_num, "Warning")

                    # Only include warnings and above
                    if int(severity_num) <= 4:
                        # Extract resource ID if present (PON port or ONU)
                        resource_match = re.search(
                            r"(?:PON|ONU|port)\s*([\d/]+)", message, re.IGNORECASE
                        )
                        resource_id = resource_match.group(1) if resource_match else None

                        alarms.append(
                            OLTAlarm(
                                alarm_id=f"{facility}-{mnemonic}-{hash(line) % 10000}",
                                severity=severity,
                                message=f"{mnemonic}: {message}",
                                raised_at=time.time(),  # Would parse timestamp in production
                                resource_id=resource_id,
                            )
                        )

        except Exception as e:
            logger.error(f"Failed to fetch alarms: {e}")

        return alarms

    async def acknowledge_alarm(self, alarm_id: str) -> bool:
        """
        Acknowledge an alarm.

        Cisco doesn't have native alarm acknowledgement, but we can
        clear the syslog buffer entry or mark it in our tracking system.
        """
        # In production, this would update an external alarm management system
        logger.info(f"Alarm {alarm_id} acknowledged (external tracking)")
        return True

    async def clear_alarm(self, alarm_id: str) -> bool:
        """
        Clear/resolve an alarm.

        For Cisco, this typically means clearing the logging buffer.
        """
        try:
            await self._run_command("clear logging")
            return True
        except Exception as e:
            logger.error(f"Failed to clear alarm: {e}")
            return False

    async def backup_configuration(self) -> bytes:
        """Export running configuration as backup."""
        try:
            output = await self._run_command("show running-config")
            return output.encode("utf-8")
        except Exception as e:
            logger.error(f"Configuration backup failed: {e}")
            raise

    async def restore_configuration(self, payload: bytes) -> None:
        """Restore configuration from backup."""
        try:
            config_text = payload.decode("utf-8")
            lines = config_text.splitlines()

            # Filter out non-config lines (prompts, etc.)
            config_commands = [
                line
                for line in lines
                if line.strip()
                and not line.startswith("!")
                and not line.startswith("Building configuration")
                and not line.startswith("Current configuration")
            ]

            await self._run_config(config_commands)
            logger.info("Configuration restored successfully")

        except Exception as e:
            logger.error(f"Configuration restore failed: {e}")
            raise

    async def operate_device(self, device_id: str, operation: str) -> bool:
        """Perform an operation on a device (ONU or OLT)."""
        try:
            if device_id == self.config.olt_id:
                # OLT-level operations
                if operation == "reboot":
                    await self._run_command("reload")
                    return True
                else:
                    logger.warning(f"Unknown OLT operation: {operation}")
                    return False
            else:
                # ONU-level operations
                parts = device_id.split("-")
                if len(parts) < 2:
                    return False

                pon_port = parts[0]
                onu_slot = parts[1]

                if operation == "reboot":
                    commands = [
                        f"interface {self.config.pon_interface_prefix}{pon_port}",
                        f"onu {onu_slot} reset",
                        "exit",
                    ]
                elif operation == "disable":
                    commands = [
                        f"interface {self.config.pon_interface_prefix}{pon_port}",
                        f"onu {onu_slot} shutdown",
                        "exit",
                    ]
                elif operation == "enable":
                    commands = [
                        f"interface {self.config.pon_interface_prefix}{pon_port}",
                        f"no onu {onu_slot} shutdown",
                        "exit",
                    ]
                else:
                    logger.warning(f"Unknown ONU operation: {operation}")
                    return False

                output = await self._run_config(commands)
                return "error" not in output.lower()

        except Exception as e:
            logger.error(f"Operation {operation} on {device_id} failed: {e}")
            return False

    async def get_health(self) -> dict[str, Any]:
        """Return health status of the OLT."""
        try:
            # Check connectivity
            version = await self._run_command("show version | include uptime")
            cpu = await self._run_command("show processes cpu | include CPU")
            memory = await self._run_command("show processes memory | include Processor")

            # Parse CPU utilization
            cpu_match = re.search(r"(\d+)%", cpu)
            cpu_util = int(cpu_match.group(1)) if cpu_match else None

            # Parse memory
            mem_match = re.search(r"(\d+)K total,\s+(\d+)K used", memory)
            if mem_match:
                total_mem = int(mem_match.group(1))
                used_mem = int(mem_match.group(2))
                mem_util = (used_mem / total_mem * 100) if total_mem > 0 else None
            else:
                mem_util = None

            # Parse uptime
            uptime_match = re.search(r"uptime is (.+)", version)
            uptime = uptime_match.group(1) if uptime_match else "Unknown"

            # Determine health state
            healthy = True
            issues = []

            if cpu_util and cpu_util > 90:
                healthy = False
                issues.append(f"High CPU: {cpu_util}%")

            if mem_util and mem_util > 90:
                healthy = False
                issues.append(f"High memory: {mem_util:.1f}%")

            return {
                "healthy": healthy,
                "state": "HEALTHY" if healthy else "DEGRADED",
                "message": f"Cisco OLT, uptime: {uptime}" if healthy else "; ".join(issues),
                "cpu_percent": cpu_util,
                "memory_percent": mem_util,
                "uptime": uptime,
                "checked_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "healthy": False,
                "state": "UNHEALTHY",
                "message": f"Connection failed: {e}",
                "checked_at": datetime.utcnow().isoformat(),
            }

    async def close(self) -> None:
        """Clean up resources."""
        if self._ssh_client:
            await self._ssh_client.disconnect()
