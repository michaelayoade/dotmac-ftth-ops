"""
VOLTHA API Client

Provides interface to VOLTHA REST API for PON network management.
Note: VOLTHA primarily uses gRPC, but also provides REST API for common operations.
"""

import asyncio
import os
from typing import Any
from urllib.parse import urljoin

import httpx
import structlog

logger = structlog.get_logger(__name__)


class VOLTHAClient:
    """
    VOLTHA REST API Client

    Manages OLT (Optical Line Terminal) and ONU (Optical Network Unit) devices
    in PON networks.
    """

    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        api_token: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
    ):
        """
        Initialize VOLTHA client

        Args:
            base_url: VOLTHA API URL (defaults to VOLTHA_URL env var)
            verify_ssl: Verify SSL certificates (default True)
        """
        self.base_url = base_url or os.getenv("VOLTHA_URL", "http://localhost:8881")
        self.username = username or os.getenv("VOLTHA_USERNAME")
        self.password = password or os.getenv("VOLTHA_PASSWORD")
        self.api_token = api_token or os.getenv("VOLTHA_TOKEN")
        self.verify_ssl = verify_ssl

        # Ensure base_url ends with /
        if not self.base_url.endswith("/"):
            self.base_url += "/"

        self.api_base = urljoin(self.base_url, "api/v1/")

        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.api_token:
            self.headers["Authorization"] = f"Bearer {self.api_token}"
        self.auth = None
        if not self.api_token and self.username and self.password:
            self.auth = (self.username, self.password)
        self.timeout_seconds = timeout_seconds
        self.max_retries = max(0, max_retries)
        self._limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        """
        Make HTTP request to VOLTHA API

        Args:
            method: HTTP method
            endpoint: API endpoint
            params: Query parameters
            json: JSON body

        Returns:
            Response JSON data
        """
        url = urljoin(self.api_base, endpoint)

        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    verify=self.verify_ssl,
                    timeout=httpx.Timeout(self.timeout_seconds),
                    limits=self._limits,
                ) as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=self.headers,
                        params=params,
                        json=json,
                        auth=self.auth,
                    )

                response.raise_for_status()

                if response.status_code == 204 or not response.content:
                    return {}

                return response.json()
            except httpx.HTTPStatusError as exc:
                # Retry 5xx responses
                if exc.response.status_code >= 500 and attempt < self.max_retries:
                    last_error = exc
                    backoff = min(2 ** attempt * 0.5, 5.0)
                    await asyncio.sleep(backoff)
                    continue
                raise
            except httpx.RequestError as exc:
                last_error = exc
                if attempt < self.max_retries:
                    backoff = min(2 ** attempt * 0.5, 5.0)
                    await asyncio.sleep(backoff)
                    continue
                raise

        if last_error:
            raise last_error

        raise RuntimeError("VOLTHA request failed without raising an exception")

    # =========================================================================
    # Logical Device Operations (OLTs)
    # =========================================================================

    async def get_logical_devices(self) -> list[dict[str, Any]]:
        """Get all logical devices (OLTs)"""
        response = await self._request("GET", "logical_devices")
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def get_logical_device(self, device_id: str) -> dict[str, Any] | None:
        """Get logical device by ID"""
        try:
            return await self._request("GET", f"logical_devices/{device_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_logical_device_ports(self, device_id: str) -> list[dict[str, Any]]:
        """Get ports for logical device"""
        response = await self._request("GET", f"logical_devices/{device_id}/ports")
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def get_logical_device_flows(self, device_id: str) -> list[dict[str, Any]]:
        """Get flows for logical device"""
        response = await self._request("GET", f"logical_devices/{device_id}/flows")
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    # =========================================================================
    # Physical Device Operations (ONUs)
    # =========================================================================

    async def get_devices(self) -> list[dict[str, Any]]:
        """Get all physical devices (ONUs)"""
        response = await self._request("GET", "devices")
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        """Get physical device by ID"""
        try:
            return await self._request("GET", f"devices/{device_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def enable_device(self, device_id: str) -> dict[str, Any]:
        """Enable device"""
        return await self._request("POST", f"devices/{device_id}/enable")

    async def disable_device(self, device_id: str) -> dict[str, Any]:
        """Disable device"""
        return await self._request("POST", f"devices/{device_id}/disable")

    async def delete_device(self, device_id: str) -> bool:
        """Delete device"""
        try:
            await self._request("DELETE", f"devices/{device_id}")
            return True
        except Exception as e:
            logger.error("voltha.delete_device.failed", device_id=device_id, error=str(e))
            return False

    async def reboot_device(self, device_id: str) -> dict[str, Any]:
        """Reboot device"""
        return await self._request("POST", f"devices/{device_id}/reboot")

    async def get_device_ports(self, device_id: str) -> list[dict[str, Any]]:
        """Get ports for device"""
        response = await self._request("GET", f"devices/{device_id}/ports")
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    # =========================================================================
    # Adapter Operations
    # =========================================================================

    async def get_adapters(self) -> list[dict[str, Any]]:
        """Get all adapters"""
        response = await self._request("GET", "adapters")
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    async def get_device_types(self) -> list[dict[str, Any]]:
        """Get all device types"""
        response = await self._request("GET", "device_types")
        items = response.get("items", []) if isinstance(response, dict) else response
        return items if isinstance(items, list) else []

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> dict[str, Any]:
        """Check VOLTHA health"""
        try:
            response = await self._request("GET", "health")
            return response if isinstance(response, dict) else {"state": "HEALTHY"}
        except Exception as e:
            logger.error("voltha.health_check.failed", error=str(e))
            return {"state": "UNKNOWN", "error": str(e)}

    async def ping(self) -> bool:
        """Check if VOLTHA is accessible"""
        try:
            health = await self.health_check()
            return health.get("state") == "HEALTHY"
        except Exception as e:
            logger.warning("voltha.ping.failed", error=str(e))
            return False
