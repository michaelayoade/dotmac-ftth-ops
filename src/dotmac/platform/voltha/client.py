"""
VOLTHA API Client

Provides interface to VOLTHA REST API for PON network management.
Note: VOLTHA primarily uses gRPC, but also provides REST API for common operations.
"""

import os
from typing import Any, cast
from urllib.parse import urljoin

import httpx
import structlog

from dotmac.platform.core.http_client import RobustHTTPClient

logger = structlog.get_logger(__name__)


class VOLTHAClient(RobustHTTPClient):
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
            base_url: VOLTHA API URL (defaults to VOLTHA_URL env var)
            username: Basic auth username (defaults to VOLTHA_USERNAME env var)
            password: Basic auth password (defaults to VOLTHA_PASSWORD env var)
            api_token: Bearer token (defaults to VOLTHA_TOKEN env var)
            tenant_id: Tenant ID for multi-tenancy support
            verify_ssl: Verify SSL certificates (default True)
            timeout_seconds: Default timeout in seconds
            max_retries: Maximum retry attempts
        """
        base_url = base_url or os.getenv("VOLTHA_URL", "http://localhost:8881")
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
