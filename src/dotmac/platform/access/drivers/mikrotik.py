"""
Mikrotik RouterOS driver for access network management.

This driver provides integration with Mikrotik RouterOS devices for managing
subscriber access in ISP environments. While Mikrotik doesn't produce traditional
GPON OLT equipment, this driver supports:

- PPPoE subscriber management (discovery, provisioning)
- DHCP lease management
- Queue/bandwidth profile management
- Hotspot user management
- Interface monitoring

The driver uses the Mikrotik RouterOS API (via librouteros) for communication.
"""

from __future__ import annotations

import asyncio
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


class MikrotikDriverConfig(DriverConfig):
    """
    Extended configuration for Mikrotik RouterOS driver.

    Attributes:
        api_port: RouterOS API port (default 8728, SSL: 8729)
        use_ssl: Use SSL for API connection
        pppoe_profile: Default PPPoE profile for new subscribers
        address_pool: IP address pool name for subscribers
    """

    api_port: int = Field(default=8728, description="RouterOS API port")
    use_ssl: bool = Field(default=False, description="Use SSL for API connection")
    pppoe_profile: str | None = Field(default=None, description="Default PPPoE profile")
    address_pool: str | None = Field(default=None, description="IP address pool name")


class MikrotikRouterOSDriver(BaseOLTDriver):
    """
    Mikrotik RouterOS driver using the RouterOS API.

    Supports subscriber management via PPPoE secrets, DHCP leases,
    and simple queues for bandwidth limiting.
    """

    CONFIG_MODEL = MikrotikDriverConfig

    def __init__(self, config: DriverConfig, context: DriverContext | None = None) -> None:
        super().__init__(
            (
                config
                if isinstance(config, MikrotikDriverConfig)
                else MikrotikDriverConfig(**config.model_dump())
            ),
            context,
        )
        self._api_lock = asyncio.Lock()
        self._api = None

    @property
    def mikrotik_config(self) -> MikrotikDriverConfig:
        """Return typed config."""
        return self.config  # type: ignore[return-value]

    # ------------------------------------------------------------------ #
    # API Connection Management
    # ------------------------------------------------------------------ #

    def _get_api(self):
        """Get or create API connection."""
        try:
            import librouteros  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError(
                "librouteros is required for Mikrotik driver. "
                "Install with 'pip install librouteros'."
            ) from exc

        if self._api is None:
            method = librouteros.connect
            self._api = method(
                host=self.config.host or "127.0.0.1",
                username=self.config.username or "admin",
                password=self.config.password or "",
                port=self.mikrotik_config.api_port,
            )
        return self._api

    def _close_api(self) -> None:
        """Close API connection."""
        if self._api is not None:
            try:
                self._api.close()
            except Exception:
                pass
            self._api = None

    async def _run_api_command(self, path: str, **kwargs: Any) -> list[dict[str, Any]]:
        """Run an API command asynchronously."""
        async with self._api_lock:
            return await asyncio.to_thread(self._execute_api_command, path, kwargs)

    def _execute_api_command(self, path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Execute API command synchronously."""
        api = self._get_api()
        cmd = api.path(path)
        if params:
            return list(cmd.select(**params))
        return list(cmd)

    async def _run_api_add(self, path: str, **kwargs: Any) -> str | None:
        """Add an entry via API."""
        async with self._api_lock:
            return await asyncio.to_thread(self._execute_api_add, path, kwargs)

    def _execute_api_add(self, path: str, params: dict[str, Any]) -> str | None:
        """Execute API add command synchronously."""
        api = self._get_api()
        cmd = api.path(path)
        try:
            result = cmd.add(**params)
            return str(result) if result else None
        except Exception:
            return None

    async def _run_api_remove(self, path: str, item_id: str) -> bool:
        """Remove an entry via API."""
        async with self._api_lock:
            return await asyncio.to_thread(self._execute_api_remove, path, item_id)

    def _execute_api_remove(self, path: str, item_id: str) -> bool:
        """Execute API remove command synchronously."""
        api = self._get_api()
        cmd = api.path(path)
        try:
            cmd.remove(item_id)
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------ #
    # Inventory & Discovery
    # ------------------------------------------------------------------ #

    async def discover_onus(self) -> list[DeviceDiscovery]:
        """
        Discover subscribers (PPPoE secrets and active sessions).

        For Mikrotik, "ONUs" are treated as PPPoE subscribers or DHCP clients
        that connect through the RouterOS device.
        """
        devices: list[DeviceDiscovery] = []

        # Get PPPoE secrets (configured subscribers)
        try:
            secrets = await self._run_api_command("/ppp/secret")
            for secret in secrets:
                name = secret.get("name", "")
                if not name:
                    continue
                devices.append(
                    DeviceDiscovery(
                        onu_id=f"pppoe-{name}",
                        serial_number=name,  # Use name as identifier
                        state="configured",
                        metadata={
                            "type": "pppoe",
                            "profile": secret.get("profile"),
                            "service": secret.get("service", "any"),
                            "local_address": secret.get("local-address"),
                            "remote_address": secret.get("remote-address"),
                            "olt_id": self.config.olt_id,
                            "vendor_id": "Mikrotik",
                        },
                    )
                )
        except Exception:
            pass

        # Get active PPPoE sessions
        try:
            actives = await self._run_api_command("/ppp/active")
            active_names = {a.get("name") for a in actives}

            # Update state for active subscribers
            for device in devices:
                if device.serial_number in active_names:
                    device.state = "online"

            # Add any active sessions not in secrets
            for active in actives:
                name = active.get("name", "")
                if not name or any(d.serial_number == name for d in devices):
                    continue
                devices.append(
                    DeviceDiscovery(
                        onu_id=f"pppoe-{name}",
                        serial_number=name,
                        state="online",
                        metadata={
                            "type": "pppoe_active",
                            "address": active.get("address"),
                            "uptime": active.get("uptime"),
                            "caller_id": active.get("caller-id"),
                            "olt_id": self.config.olt_id,
                            "vendor_id": "Mikrotik",
                        },
                    )
                )
        except Exception:
            pass

        # Get Hotspot users (if enabled)
        try:
            hotspot_users = await self._run_api_command("/ip/hotspot/user")
            for user in hotspot_users:
                name = user.get("name", "")
                if not name:
                    continue
                devices.append(
                    DeviceDiscovery(
                        onu_id=f"hotspot-{name}",
                        serial_number=name,
                        state="configured",
                        metadata={
                            "type": "hotspot",
                            "profile": user.get("profile"),
                            "limit_uptime": user.get("limit-uptime"),
                            "limit_bytes_total": user.get("limit-bytes-total"),
                            "olt_id": self.config.olt_id,
                            "vendor_id": "Mikrotik",
                        },
                    )
                )
        except Exception:
            pass

        return devices

    async def get_capabilities(self) -> DriverCapabilities:
        """Return driver capabilities."""
        return DriverCapabilities(
            supports_onu_provisioning=True,
            supports_vlan_change=False,  # Mikrotik uses different VLAN approach
            supports_backup_restore=True,
            supports_realtime_alarms=False,
            supported_operations=["pppoe", "hotspot", "queue", "dhcp"],
        )

    async def list_logical_devices(self) -> list[dict[str, Any]]:
        """Return logical device (router) information."""
        # Get system identity
        try:
            identity = await self._run_api_command("/system/identity")
            device_name = (
                identity[0].get("name", self.config.olt_id) if identity else self.config.olt_id
            )
        except Exception:
            device_name = self.config.olt_id

        # Get system resource info
        try:
            resource = await self._run_api_command("/system/resource")
            info = resource[0] if resource else {}
        except Exception:
            info = {}

        return [
            {
                "id": device_name or "mikrotik-router",
                "datapath_id": device_name or "mikrotik-router",
                "desc": {
                    "mfr_desc": "Mikrotik",
                    "hw_desc": info.get("board-name", "RouterOS"),
                    "sw_desc": f"RouterOS {info.get('version', 'unknown')}",
                },
                "root_device_id": self.config.olt_id or "mikrotik-router",
                "switch_features": {
                    "architecture": info.get("architecture-name"),
                    "cpu": info.get("cpu"),
                    "cpu_count": info.get("cpu-count"),
                    "uptime": info.get("uptime"),
                },
            }
        ]

    async def list_devices(self) -> list[dict[str, Any]]:
        """Return device information (router + subscribers)."""
        devices = []

        # Add the router itself
        logical = await self.list_logical_devices()
        if logical:
            router = logical[0]
            devices.append(
                {
                    "id": router["id"],
                    "type": "ROUTER",
                    "root": True,
                    "parent_id": None,
                    "parent_port_no": None,
                    "vendor": "Mikrotik",
                    "model": router["desc"].get("hw_desc", "Unknown"),
                    "serial_number": self.config.extra.get("serial_number"),
                    "oper_status": "ACTIVE",
                    "connect_status": "REACHABLE",
                    "metadata": {"host": self.config.host},
                }
            )

        # Add discovered subscribers
        for subscriber in await self.discover_onus():
            devices.append(
                {
                    "id": subscriber.onu_id,
                    "type": "SUBSCRIBER",
                    "root": False,
                    "parent_id": self.config.olt_id,
                    "parent_port_no": None,
                    "vendor": "Mikrotik",
                    "model": subscriber.metadata.get("type", "PPPoE"),
                    "serial_number": subscriber.serial_number,
                    "oper_status": subscriber.state.upper(),
                    "connect_status": (
                        "REACHABLE" if subscriber.state.lower() == "online" else "UNREACHABLE"
                    ),
                    "metadata": subscriber.metadata,
                }
            )

        return devices

    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        """Return a specific device by ID."""
        for device in await self.list_devices():
            if device["id"] == device_id:
                return device
        return None

    # ------------------------------------------------------------------ #
    # Provisioning
    # ------------------------------------------------------------------ #

    async def provision_onu(self, request: ONUProvisionRequest) -> ONUProvisionResult:
        """
        Provision a subscriber (create PPPoE secret).

        The `onu_id` is used as the PPPoE username.
        """
        username = request.serial_number or request.onu_id
        password = request.metadata.get("password", username)

        params: dict[str, Any] = {
            "name": username,
            "password": password,
            "service": request.metadata.get("service", "any"),
        }

        # Add profile if specified
        profile = request.service_profile_id or self.mikrotik_config.pppoe_profile
        if profile:
            params["profile"] = profile

        # Add local/remote address if specified
        if request.metadata.get("local_address"):
            params["local-address"] = request.metadata["local_address"]
        if request.metadata.get("remote_address"):
            params["remote-address"] = request.metadata["remote_address"]

        try:
            result = await self._run_api_add("/ppp/secret", **params)
            if result:
                # Create bandwidth queue if VLAN (used as bandwidth profile ID) specified
                if request.vlan is not None:
                    await self._create_queue_for_subscriber(
                        username,
                        request.vlan,
                        request.metadata.get("download_mbps"),
                        request.metadata.get("upload_mbps"),
                    )

                return ONUProvisionResult(
                    success=True,
                    onu_id=f"pppoe-{username}",
                    message=f"PPPoE secret created for {username}",
                    applied_config=params,
                )
            return ONUProvisionResult(
                success=False,
                message="Failed to create PPPoE secret",
            )
        except Exception as e:
            return ONUProvisionResult(
                success=False,
                message=f"Error creating PPPoE secret: {e}",
            )

    async def _create_queue_for_subscriber(
        self,
        username: str,
        profile_id: int,
        download_mbps: float | None = None,
        upload_mbps: float | None = None,
    ) -> bool:
        """Create a simple queue for bandwidth limiting."""
        # Default bandwidth values if not specified
        download = download_mbps or 10.0
        upload = upload_mbps or 5.0

        params = {
            "name": f"queue-{username}",
            "target": f"<pppoe-{username}>",
            "max-limit": f"{int(upload)}M/{int(download)}M",
            "comment": f"Auto-created for profile {profile_id}",
        }

        try:
            await self._run_api_add("/queue/simple", **params)
            return True
        except Exception:
            return False

    async def remove_onu(self, onu_id: str) -> bool:
        """Remove a subscriber (delete PPPoE secret)."""
        # Extract username from onu_id
        if onu_id.startswith("pppoe-"):
            username = onu_id[6:]
        elif onu_id.startswith("hotspot-"):
            username = onu_id[8:]
            # Remove hotspot user
            try:
                users = await self._run_api_command("/ip/hotspot/user")
                for user in users:
                    if user.get("name") == username:
                        item_id = user.get(".id")
                        if item_id:
                            await self._run_api_remove("/ip/hotspot/user", item_id)
                            return True
            except Exception:
                pass
            return False
        else:
            username = onu_id

        # Remove PPPoE secret
        try:
            secrets = await self._run_api_command("/ppp/secret")
            for secret in secrets:
                if secret.get("name") == username:
                    item_id = secret.get(".id")
                    if item_id:
                        await self._run_api_remove("/ppp/secret", item_id)
                        # Also remove associated queue
                        await self._remove_queue_for_subscriber(username)
                        return True
        except Exception:
            pass

        return False

    async def _remove_queue_for_subscriber(self, username: str) -> bool:
        """Remove the queue for a subscriber."""
        try:
            queues = await self._run_api_command("/queue/simple")
            for queue in queues:
                if queue.get("name") == f"queue-{username}":
                    item_id = queue.get(".id")
                    if item_id:
                        await self._run_api_remove("/queue/simple", item_id)
                        return True
        except Exception:
            pass
        return False

    async def apply_service_profile(
        self, onu_id: str, service_profile: dict[str, Any]
    ) -> ONUProvisionResult:
        """
        Apply a service profile to a subscriber (update queue/profile).

        Service profile can include:
        - download_mbps: Download speed limit
        - upload_mbps: Upload speed limit
        - profile: PPPoE profile name
        """
        if onu_id.startswith("pppoe-"):
            username = onu_id[6:]
        else:
            username = onu_id

        download = service_profile.get("download_mbps")
        upload = service_profile.get("upload_mbps")

        if download or upload:
            # Update or create queue
            await self._remove_queue_for_subscriber(username)
            await self._create_queue_for_subscriber(
                username,
                profile_id=0,
                download_mbps=download,
                upload_mbps=upload,
            )

        # Update PPPoE profile if specified
        profile = service_profile.get("profile")
        if profile:
            try:
                secrets = await self._run_api_command("/ppp/secret")
                for secret in secrets:
                    if secret.get("name") == username:
                        item_id = secret.get(".id")
                        if item_id:
                            api = self._get_api()
                            cmd = api.path("/ppp/secret")
                            cmd.update(**{".id": item_id, "profile": profile})
            except Exception as e:
                return ONUProvisionResult(
                    success=False,
                    message=f"Failed to update profile: {e}",
                )

        return ONUProvisionResult(
            success=True,
            message=f"Service profile applied to {onu_id}",
            applied_config=service_profile,
        )

    # ------------------------------------------------------------------ #
    # Telemetry & Maintenance
    # ------------------------------------------------------------------ #

    async def collect_metrics(self) -> OltMetrics:
        """Collect summary metrics from the router."""
        # Get system resource info
        try:
            resource = await self._run_api_command("/system/resource")
            info = resource[0] if resource else {}
        except Exception:
            info = {}

        # Get interface statistics
        try:
            interfaces = await self._run_api_command("/interface")
            running_count = sum(1 for i in interfaces if i.get("running") == "true")
            total_count = len(interfaces)
        except Exception:
            running_count = 0
            total_count = 0

        # Get active PPPoE sessions
        try:
            actives = await self._run_api_command("/ppp/active")
            online_count = len(actives)
        except Exception:
            online_count = 0

        # Get total PPPoE secrets
        try:
            secrets = await self._run_api_command("/ppp/secret")
            total_subscribers = len(secrets)
        except Exception:
            total_subscribers = 0

        return OltMetrics(
            olt_id=self.config.olt_id or "mikrotik-router",
            pon_ports_up=running_count,
            pon_ports_total=total_count,
            onu_online=online_count,
            onu_total=total_subscribers,
            raw={
                "source": "routeros_api",
                "uptime": info.get("uptime"),
                "cpu_load": info.get("cpu-load"),
                "free_memory": info.get("free-memory"),
                "total_memory": info.get("total-memory"),
                "version": info.get("version"),
            },
        )

    async def fetch_alarms(self) -> list[OLTAlarm]:
        """Fetch active alarms (system logs with warnings/errors)."""
        alarms: list[OLTAlarm] = []

        try:
            # Get recent log entries with warnings or errors
            logs = await self._run_api_command("/log")
            for log in logs[-50:]:  # Last 50 entries
                topics = log.get("topics", "")
                if any(t in topics for t in ["warning", "error", "critical"]):
                    alarms.append(
                        OLTAlarm(
                            alarm_id=log.get(".id", "unknown"),
                            severity="Warning" if "warning" in topics else "Critical",
                            message=log.get("message", "Unknown"),
                            raised_at=asyncio.get_event_loop().time(),
                            resource_id=topics,
                        )
                    )
        except Exception:
            pass

        return alarms

    async def backup_configuration(self) -> bytes:
        """Export configuration as RSC script."""
        try:
            # Export configuration
            export_result = await self._run_api_command("/export")
            if export_result:
                config_text = str(export_result)
                return config_text.encode("utf-8")
        except Exception:
            pass

        # Fallback: get system identity at minimum
        return b"# Mikrotik configuration export failed"

    async def restore_configuration(self, payload: bytes) -> None:
        """
        Restore configuration is not directly supported via API.

        Configuration should be restored via /system/reset-configuration
        or by uploading and importing an RSC file.
        """
        raise NotImplementedError(
            "Configuration restore via API not supported. "
            "Use /system/reset-configuration or import RSC file via Files."
        )

    async def operate_device(self, device_id: str, operation: str) -> bool:
        """
        Perform device operation.

        Supported operations:
        - reboot: Reboot the router
        - disable: Disable a PPPoE subscriber
        - enable: Enable a PPPoE subscriber
        """
        operation = operation.lower()

        if operation == "reboot" and device_id == self.config.olt_id:
            try:
                api = self._get_api()
                api.path("/system").call("reboot")
                return True
            except Exception:
                return False

        if operation in ("disable", "enable"):
            # Extract username from device_id
            if device_id.startswith("pppoe-"):
                username = device_id[6:]
            else:
                username = device_id

            try:
                secrets = await self._run_api_command("/ppp/secret")
                for secret in secrets:
                    if secret.get("name") == username:
                        item_id = secret.get(".id")
                        if item_id:
                            api = self._get_api()
                            cmd = api.path("/ppp/secret")
                            cmd.update(
                                **{
                                    ".id": item_id,
                                    "disabled": "true" if operation == "disable" else "false",
                                }
                            )
                            return True
            except Exception:
                pass

        return False

    async def get_health(self) -> dict[str, Any]:
        """Return health information."""
        try:
            resource = await self._run_api_command("/system/resource")
            info = resource[0] if resource else {}

            version = info.get('version', 'unknown')
            uptime = info.get('uptime', 'unknown')
            return {
                "healthy": True,
                "state": "HEALTHY",
                "message": f"RouterOS {version} - {uptime}",
                "total_devices": len(await self.discover_onus()),
                "cpu_load": info.get("cpu-load"),
                "memory_free": info.get("free-memory"),
            }
        except Exception as e:
            return {
                "healthy": False,
                "state": "UNHEALTHY",
                "message": f"Connection failed: {e}",
                "total_devices": 0,
            }

    # ------------------------------------------------------------------ #
    # Alarm Operations (Feature flag controlled)
    # ------------------------------------------------------------------ #

    async def acknowledge_alarm(self, alarm_id: str) -> bool:
        """
        Acknowledge an alarm.

        For Mikrotik, this marks a log entry as acknowledged (custom implementation).
        Requires pon_alarm_actions_enabled feature flag.
        """
        # Mikrotik logs don't support acknowledgement natively
        # This would require a custom tracking mechanism
        raise NotImplementedError(
            "Alarm acknowledgement not natively supported by Mikrotik. "
            "Implement custom tracking via script or external database."
        )

    async def clear_alarm(self, alarm_id: str) -> bool:
        """
        Clear an alarm.

        For Mikrotik, this removes the log entry.
        Requires pon_alarm_actions_enabled feature flag.
        """
        try:
            await self._run_api_remove("/log", alarm_id)
            return True
        except Exception:
            return False
