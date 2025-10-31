"""
VOLTHA API Client

Provides interface to VOLTHA REST API for PON network management.
Note: VOLTHA primarily uses gRPC, but also provides REST API for common operations.
"""

import base64
import os
from typing import Any, cast
from urllib.parse import urljoin

import httpx
import structlog

from dotmac.platform.core.http_client import RobustHTTPClient

logger = structlog.get_logger(__name__)


class VOLTHAClient(RobustHTTPClient):  # type: ignore[misc]
    """
    VOLTHA REST API Client

    Manages OLT (Optical Line Terminal) and ONU (Optical Network Unit) devices
    in PON networks.
    """

    # Configurable timeouts for different operations
    TIMEOUTS = {
        "health_check": 5.0,
        "list": 10.0,
        "get": 10.0,
        "enable": 30.0,
        "disable": 30.0,
        "delete": 30.0,
        "reboot": 60.0,
        "provision": 60.0,
        "alarms": 10.0,
        "events": 10.0,
        "backup": 45.0,
        "restore": 60.0,
    }

    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        api_token: str | None = None,
        tenant_id: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
    ):
        """
        Initialize VOLTHA client with robust HTTP capabilities.

        Args:
            base_url: VOLTHA API URL (defaults to settings.external_services.voltha_url)
            username: Basic auth username (defaults to VOLTHA_USERNAME env var)
            password: Basic auth password (defaults to VOLTHA_PASSWORD env var)
            api_token: Bearer token (defaults to VOLTHA_TOKEN env var)
            tenant_id: Tenant ID for multi-tenancy support
            verify_ssl: Verify SSL certificates (default True)
            timeout_seconds: Default timeout in seconds
            max_retries: Maximum retry attempts
        """
        # Load from centralized settings (Phase 2 implementation)
        if base_url is None:
            try:
                from dotmac.platform.settings import settings

                base_url = settings.external_services.voltha_url
            except (ImportError, AttributeError):
                # Fallback to environment variable if settings not available
                base_url = os.getenv("VOLTHA_URL", "http://localhost:8881")

        username = username or os.getenv("VOLTHA_USERNAME")
        password = password or os.getenv("VOLTHA_PASSWORD")
        api_token = api_token or os.getenv("VOLTHA_TOKEN")

        # Initialize robust HTTP client
        super().__init__(
            service_name="voltha",
            base_url=base_url,
            tenant_id=tenant_id,
            api_token=api_token,
            username=username,
            password=password,
            verify_ssl=verify_ssl,
            default_timeout=timeout_seconds,
            max_retries=max_retries,
        )

        # API base path
        self.api_base = urljoin(self.base_url, "api/v1/")

    async def _voltha_request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        """
        Make HTTP request to VOLTHA API using robust base client.

        Args:
            method: HTTP method
            endpoint: API endpoint (relative to api_base)
            params: Query parameters
            json: JSON body
            timeout: Request timeout (overrides default)

        Returns:
            Response JSON data
        """
        # Construct full endpoint with api/v1/ prefix
        full_endpoint = urljoin(self.api_base, endpoint.lstrip("/"))
        # Make endpoint relative to base_url
        relative_endpoint = full_endpoint.replace(self.base_url, "")

        return await self.request(
            method=method,
            endpoint=relative_endpoint,
            params=params,
            json=json,
            timeout=timeout,
        )

    # =========================================================================
    # Logical Device Operations (OLTs)
    # =========================================================================

    async def get_logical_devices(self) -> list[dict[str, Any]]:
        """Get all logical devices (OLTs)"""
        response = await self._voltha_request(
            "GET", "logical_devices", timeout=self.TIMEOUTS["list"]
        )
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def get_logical_device(self, device_id: str) -> dict[str, Any] | None:
        """Get logical device by ID"""
        try:
            response = await self._voltha_request(
                "GET", f"logical_devices/{device_id}", timeout=self.TIMEOUTS["get"]
            )
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_logical_device_ports(self, device_id: str) -> list[dict[str, Any]]:
        """Get ports for logical device"""
        response = await self._voltha_request(
            "GET", f"logical_devices/{device_id}/ports", timeout=self.TIMEOUTS["get"]
        )
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def get_logical_device_flows(self, device_id: str) -> list[dict[str, Any]]:
        """Get flows for logical device"""
        response = await self._voltha_request(
            "GET", f"logical_devices/{device_id}/flows", timeout=self.TIMEOUTS["get"]
        )
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    # =========================================================================
    # Physical Device Operations (ONUs)
    # =========================================================================

    async def get_devices(self) -> list[dict[str, Any]]:
        """Get all physical devices (ONUs)"""
        response = await self._voltha_request("GET", "devices", timeout=self.TIMEOUTS["list"])
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        """Get physical device by ID"""
        try:
            response = await self._voltha_request(
                "GET", f"devices/{device_id}", timeout=self.TIMEOUTS["get"]
            )
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def enable_device(self, device_id: str) -> dict[str, Any]:
        """Enable device"""
        response = await self._voltha_request(
            "POST", f"devices/{device_id}/enable", timeout=self.TIMEOUTS["enable"]
        )
        return cast(dict[str, Any], response)

    async def disable_device(self, device_id: str) -> dict[str, Any]:
        """Disable device"""
        response = await self._voltha_request(
            "POST", f"devices/{device_id}/disable", timeout=self.TIMEOUTS["disable"]
        )
        return cast(dict[str, Any], response)

    async def delete_device(self, device_id: str) -> bool:
        """Delete device"""
        try:
            await self._voltha_request(
                "DELETE", f"devices/{device_id}", timeout=self.TIMEOUTS["delete"]
            )
            return True
        except Exception as e:
            self.logger.error("voltha.delete_device.failed", device_id=device_id, error=str(e))
            return False

    async def reboot_device(self, device_id: str) -> dict[str, Any]:
        """Reboot device"""
        response = await self._voltha_request(
            "POST", f"devices/{device_id}/reboot", timeout=self.TIMEOUTS["reboot"]
        )
        return cast(dict[str, Any], response)

    async def get_device_ports(self, device_id: str) -> list[dict[str, Any]]:
        """Get ports for device"""
        response = await self._voltha_request(
            "GET", f"devices/{device_id}/ports", timeout=self.TIMEOUTS["get"]
        )
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def backup_device_configuration(self, device_id: str) -> Any:
        """Download device configuration snapshot."""
        return await self._voltha_request(
            "GET",
            f"devices/{device_id}/config",
            timeout=self.TIMEOUTS["backup"],
        )

    async def restore_device_configuration(self, device_id: str, payload: bytes) -> Any:
        """Restore device configuration from snapshot bytes."""
        encoded = base64.b64encode(payload).decode("ascii")
        body = {"content": encoded, "encoding": "base64"}
        return await self._voltha_request(
            "POST",
            f"devices/{device_id}/config",
            json=body,
            timeout=self.TIMEOUTS["restore"],
        )

    # =========================================================================
    # Alarm and Event Operations
    # =========================================================================

    async def get_alarms(
        self,
        device_id: str | None = None,
        severity: str | None = None,
        state: str | None = None,
    ) -> dict[str, Any] | list[dict[str, Any]]:
        """Get alarms from VOLTHA"""
        params: dict[str, Any] = {}
        if device_id:
            params["device_id"] = device_id
        if severity:
            params["severity"] = severity
        if state:
            params["state"] = state

        return await self._voltha_request(
            "GET",
            "alarms",
            params=params or None,
            timeout=self.TIMEOUTS["alarms"],
        )

    async def get_alarm(self, alarm_id: str) -> dict[str, Any]:
        """
        Get a specific alarm by ID from VOLTHA.

        Args:
            alarm_id: The alarm ID to retrieve

        Returns:
            Alarm details

        Raises:
            VOLTHAError: If alarm not found or VOLTHA API error
        """
        return await self._voltha_request(
            "GET",
            f"alarms/{alarm_id}",
            timeout=self.TIMEOUTS["alarms"],
        )

    async def acknowledge_alarm(
        self,
        alarm_id: str,
        acknowledged_by: str,
        note: str | None = None,
    ) -> dict[str, Any]:
        """
        Acknowledge an alarm in VOLTHA.

        Note: This requires VOLTHA API support for alarm acknowledgement.
        If not supported, this will raise VOLTHAError with status 404/501.

        Args:
            alarm_id: The alarm ID to acknowledge
            acknowledged_by: User who is acknowledging the alarm
            note: Optional note about the acknowledgement

        Returns:
            Acknowledgement response from VOLTHA

        Raises:
            VOLTHAError: If VOLTHA API doesn't support this operation or other error
        """
        payload = {
            "acknowledged_by": acknowledged_by,
        }
        if note:
            payload["note"] = note

        return await self._voltha_request(
            "POST",
            f"alarms/{alarm_id}/acknowledge",
            json=payload,
            timeout=self.TIMEOUTS["alarms"],
        )

    async def clear_alarm(
        self,
        alarm_id: str,
        cleared_by: str,
        note: str | None = None,
    ) -> dict[str, Any]:
        """
        Clear an alarm in VOLTHA.

        Note: This requires VOLTHA API support for alarm clearing.
        If not supported, this will raise VOLTHAError with status 404/501.

        Args:
            alarm_id: The alarm ID to clear
            cleared_by: User who is clearing the alarm
            note: Optional note about the clearing

        Returns:
            Clear response from VOLTHA

        Raises:
            VOLTHAError: If VOLTHA API doesn't support this operation or other error
        """
        payload = {
            "cleared_by": cleared_by,
        }
        if note:
            payload["note"] = note

        return await self._voltha_request(
            "POST",
            f"alarms/{alarm_id}/clear",
            json=payload,
            timeout=self.TIMEOUTS["alarms"],
        )

    async def get_events(
        self,
        device_id: str | None = None,
        event_type: str | None = None,
        limit: int = 100,
    ) -> dict[str, Any] | list[dict[str, Any]]:
        """Get events from VOLTHA"""
        params: dict[str, Any] = {"limit": limit}
        if device_id:
            params["device_id"] = device_id
        if event_type:
            params["event_type"] = event_type

        return await self._voltha_request(
            "GET",
            "events",
            params=params,
            timeout=self.TIMEOUTS["events"],
        )

    # =========================================================================
    # Adapter Operations
    # =========================================================================

    async def get_adapters(self) -> list[dict[str, Any]]:
        """Get all adapters"""
        response = await self._voltha_request("GET", "adapters", timeout=self.TIMEOUTS["list"])
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def get_device_types(self) -> list[dict[str, Any]]:
        """Get all device types"""
        response = await self._voltha_request("GET", "device_types", timeout=self.TIMEOUTS["list"])
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> dict[str, Any]:
        """Check VOLTHA health"""
        try:
            response = await self._voltha_request(
                "GET", "health", timeout=self.TIMEOUTS["health_check"]
            )
            return response if isinstance(response, dict) else {"state": "HEALTHY"}
        except Exception as e:
            self.logger.error("voltha.health_check.failed", error=str(e))
            return {"state": "UNKNOWN", "error": str(e)}

    async def ping(self) -> bool:
        """Check if VOLTHA is accessible"""
        try:
            health = await self.health_check()
            return health.get("state") == "HEALTHY"
        except Exception as e:
            self.logger.warning("voltha.ping.failed", error=str(e))
            return False

    # =========================================================================
    # Flow Programming (VLAN/Bandwidth Configuration)
    # =========================================================================

    async def add_flow(self, logical_device_id: str, flow: dict[str, Any]) -> dict[str, Any]:
        """
        Add OpenFlow rule to logical device.

        Args:
            logical_device_id: Logical device (OLT) ID
            flow: OpenFlow flow specification

        Returns:
            Flow creation response
        """
        response = await self._voltha_request(
            "POST",
            f"logical_devices/{logical_device_id}/flows",
            json=flow,
            timeout=self.TIMEOUTS["provision"],
        )
        return cast(dict[str, Any], response)

    async def delete_flow(self, logical_device_id: str, flow_id: str) -> bool:
        """
        Delete OpenFlow rule from logical device.

        Args:
            logical_device_id: Logical device (OLT) ID
            flow_id: Flow ID to delete

        Returns:
            True if successful
        """
        try:
            await self._voltha_request(
                "DELETE",
                f"logical_devices/{logical_device_id}/flows/{flow_id}",
                timeout=self.TIMEOUTS["provision"],
            )
            return True
        except Exception as e:
            self.logger.error(
                "voltha.delete_flow.failed",
                logical_device_id=logical_device_id,
                flow_id=flow_id,
                error=str(e),
            )
            return False

    async def update_flow(
        self, logical_device_id: str, flow_id: str, flow: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Update OpenFlow rule on logical device.

        Args:
            logical_device_id: Logical device (OLT) ID
            flow_id: Flow ID to update
            flow: Updated flow specification

        Returns:
            Flow update response
        """
        response = await self._voltha_request(
            "PUT",
            f"logical_devices/{logical_device_id}/flows/{flow_id}",
            json=flow,
            timeout=self.TIMEOUTS["provision"],
        )
        return cast(dict[str, Any], response)

    # =========================================================================
    # Technology Profile Management
    # =========================================================================

    async def get_technology_profiles(self, device_id: str) -> list[dict[str, Any]]:
        """
        Get technology profiles for device.

        Args:
            device_id: Device ID

        Returns:
            List of technology profiles
        """
        response = await self._voltha_request(
            "GET",
            f"devices/{device_id}/technology_profiles",
            timeout=self.TIMEOUTS["get"],
        )
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def set_technology_profile(
        self,
        device_id: str,
        tp_instance_path: str,
        tp_id: int,
    ) -> dict[str, Any]:
        """
        Assign technology profile to device.

        Args:
            device_id: Device ID
            tp_instance_path: Technology profile instance path
            tp_id: Technology profile ID

        Returns:
            Assignment response
        """
        response = await self._voltha_request(
            "POST",
            f"devices/{device_id}/technology_profile",
            json={
                "tp_instance_path": tp_instance_path,
                "tp_id": tp_id,
            },
            timeout=self.TIMEOUTS["provision"],
        )
        return cast(dict[str, Any], response)

    async def delete_technology_profile(
        self,
        device_id: str,
        tp_instance_path: str,
    ) -> bool:
        """
        Remove technology profile from device.

        Args:
            device_id: Device ID
            tp_instance_path: Technology profile instance path

        Returns:
            True if successful
        """
        try:
            await self._voltha_request(
                "DELETE",
                f"devices/{device_id}/technology_profile",
                params={"tp_instance_path": tp_instance_path},
                timeout=self.TIMEOUTS["provision"],
            )
            return True
        except Exception as e:
            self.logger.error(
                "voltha.delete_technology_profile.failed",
                device_id=device_id,
                tp_instance_path=tp_instance_path,
                error=str(e),
            )
            return False

    # =========================================================================
    # Meter Management (Bandwidth Profiles)
    # =========================================================================

    async def get_meters(self, logical_device_id: str) -> list[dict[str, Any]]:
        """
        Get meters (bandwidth profiles) for logical device.

        Args:
            logical_device_id: Logical device (OLT) ID

        Returns:
            List of meters
        """
        response = await self._voltha_request(
            "GET",
            f"logical_devices/{logical_device_id}/meters",
            timeout=self.TIMEOUTS["get"],
        )
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def add_meter(self, logical_device_id: str, meter: dict[str, Any]) -> dict[str, Any]:
        """
        Add meter (bandwidth profile) to logical device.

        Args:
            logical_device_id: Logical device (OLT) ID
            meter: Meter specification

        Returns:
            Meter creation response
        """
        response = await self._voltha_request(
            "POST",
            f"logical_devices/{logical_device_id}/meters",
            json=meter,
            timeout=self.TIMEOUTS["provision"],
        )
        return cast(dict[str, Any], response)

    async def update_meter(
        self, logical_device_id: str, meter_id: int, meter: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Update meter (bandwidth profile) on logical device.

        Args:
            logical_device_id: Logical device (OLT) ID
            meter_id: Meter ID
            meter: Updated meter specification

        Returns:
            Meter update response
        """
        response = await self._voltha_request(
            "PUT",
            f"logical_devices/{logical_device_id}/meters/{meter_id}",
            json=meter,
            timeout=self.TIMEOUTS["provision"],
        )
        return cast(dict[str, Any], response)

    async def delete_meter(self, logical_device_id: str, meter_id: int) -> bool:
        """
        Delete meter (bandwidth profile) from logical device.

        Args:
            logical_device_id: Logical device (OLT) ID
            meter_id: Meter ID to delete

        Returns:
            True if successful
        """
        try:
            await self._voltha_request(
                "DELETE",
                f"logical_devices/{logical_device_id}/meters/{meter_id}",
                timeout=self.TIMEOUTS["provision"],
            )
            return True
        except Exception as e:
            self.logger.error(
                "voltha.delete_meter.failed",
                logical_device_id=logical_device_id,
                meter_id=meter_id,
                error=str(e),
            )
            return False
