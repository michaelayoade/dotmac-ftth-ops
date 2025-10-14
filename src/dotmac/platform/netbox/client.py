"""
NetBox API Client Wrapper

Provides a clean interface to the NetBox REST API using pynetbox library.
"""

import asyncio
import os
from typing import Any
from urllib.parse import urljoin

import httpx
import structlog

logger = structlog.get_logger(__name__)


class NetBoxClient:
    """
    NetBox API Client

    Wraps the NetBox REST API for IPAM and DCIM operations.
    Uses httpx for async HTTP requests.
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_token: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
    ):
        """
        Initialize NetBox client

        Args:
            base_url: NetBox instance URL (defaults to NETBOX_URL env var)
            api_token: API token for authentication (defaults to NETBOX_API_TOKEN env var)
            verify_ssl: Verify SSL certificates (default True)
        """
        self.base_url = base_url or os.getenv("NETBOX_URL", "http://localhost:8080")
        self.api_token = api_token or os.getenv("NETBOX_API_TOKEN", "")
        self.verify_ssl = verify_ssl

        # Ensure base_url ends with /
        if not self.base_url.endswith("/"):
            self.base_url += "/"

        self.api_base = urljoin(self.base_url, "api/")

        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        if self.api_token:
            self.headers["Authorization"] = f"Token {self.api_token}"
        self.timeout_seconds = timeout_seconds
        self.max_retries = max(0, max_retries)
        self._limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Make HTTP request to NetBox API

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            endpoint: API endpoint (e.g., 'ipam/ip-addresses/')
            params: Query parameters
            json: JSON body for POST/PUT/PATCH

        Returns:
            Response JSON data

        Raises:
            httpx.HTTPError: On HTTP errors
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
                    )

                response.raise_for_status()

                return response.json()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code >= 500 and attempt < self.max_retries:
                    last_error = exc
                    await asyncio.sleep(min(2 ** attempt * 0.5, 5.0))
                    continue
                raise
            except httpx.RequestError as exc:
                last_error = exc
                if attempt < self.max_retries:
                    await asyncio.sleep(min(2 ** attempt * 0.5, 5.0))
                    continue
                raise

        if last_error:
            raise last_error

        raise RuntimeError("NetBox request failed without raising an exception")

    # =========================================================================
    # IPAM Operations
    # =========================================================================

    async def get_ip_addresses(
        self,
        tenant: str | None = None,
        vrf: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get IP addresses from NetBox"""
        params = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if vrf:
            params["vrf"] = vrf

        return await self._request("GET", "ipam/ip-addresses/", params=params)

    async def get_ip_address(self, ip_id: int) -> dict[str, Any]:
        """Get single IP address by ID"""
        return await self._request("GET", f"ipam/ip-addresses/{ip_id}/")

    async def create_ip_address(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new IP address"""
        return await self._request("POST", "ipam/ip-addresses/", json=data)

    async def update_ip_address(self, ip_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Update IP address"""
        return await self._request("PATCH", f"ipam/ip-addresses/{ip_id}/", json=data)

    async def delete_ip_address(self, ip_id: int) -> None:
        """Delete IP address"""
        await self._request("DELETE", f"ipam/ip-addresses/{ip_id}/")

    async def get_prefixes(
        self,
        tenant: str | None = None,
        vrf: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get IP prefixes (subnets)"""
        params = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if vrf:
            params["vrf"] = vrf

        return await self._request("GET", "ipam/prefixes/", params=params)

    async def get_prefix(self, prefix_id: int) -> dict[str, Any]:
        """Get single prefix by ID"""
        return await self._request("GET", f"ipam/prefixes/{prefix_id}/")

    async def create_prefix(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new prefix"""
        return await self._request("POST", "ipam/prefixes/", json=data)

    async def get_available_ips(self, prefix_id: int, limit: int = 10) -> list[dict[str, Any]]:
        """Get available IP addresses in a prefix"""
        response = await self._request(
            "GET",
            f"ipam/prefixes/{prefix_id}/available-ips/",
            params={"limit": limit},
        )
        return response if isinstance(response, list) else []

    async def allocate_ip(self, prefix_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Allocate next available IP from prefix"""
        return await self._request(
            "POST",
            f"ipam/prefixes/{prefix_id}/available-ips/",
            json=data,
        )

    async def get_vrfs(
        self,
        tenant: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get VRFs (Virtual Routing and Forwarding)"""
        params = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant

        return await self._request("GET", "ipam/vrfs/", params=params)

    async def create_vrf(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new VRF"""
        return await self._request("POST", "ipam/vrfs/", json=data)

    # =========================================================================
    # DCIM Operations (Devices, Sites, Racks)
    # =========================================================================

    async def get_sites(
        self,
        tenant: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get sites"""
        params = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant

        return await self._request("GET", "dcim/sites/", params=params)

    async def get_site(self, site_id: int) -> dict[str, Any]:
        """Get single site by ID"""
        return await self._request("GET", f"dcim/sites/{site_id}/")

    async def create_site(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new site"""
        return await self._request("POST", "dcim/sites/", json=data)

    async def get_devices(
        self,
        tenant: str | None = None,
        site: str | None = None,
        role: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get devices"""
        params = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if site:
            params["site"] = site
        if role:
            params["role"] = role

        return await self._request("GET", "dcim/devices/", params=params)

    async def get_device(self, device_id: int) -> dict[str, Any]:
        """Get single device by ID"""
        return await self._request("GET", f"dcim/devices/{device_id}/")

    async def create_device(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new device"""
        return await self._request("POST", "dcim/devices/", json=data)

    async def update_device(self, device_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Update device"""
        return await self._request("PATCH", f"dcim/devices/{device_id}/", json=data)

    async def get_interfaces(
        self,
        device_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get network interfaces"""
        params = {"limit": limit, "offset": offset}
        if device_id:
            params["device_id"] = device_id

        return await self._request("GET", "dcim/interfaces/", params=params)

    async def create_interface(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new interface"""
        return await self._request("POST", "dcim/interfaces/", json=data)

    # =========================================================================
    # Tenancy Operations
    # =========================================================================

    async def get_tenants(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get tenants"""
        params = {"limit": limit, "offset": offset}
        return await self._request("GET", "tenancy/tenants/", params=params)

    async def get_tenant(self, tenant_id: int) -> dict[str, Any]:
        """Get single tenant by ID"""
        return await self._request("GET", f"tenancy/tenants/{tenant_id}/")

    async def create_tenant(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new tenant"""
        return await self._request("POST", "tenancy/tenants/", json=data)

    async def get_tenant_by_name(self, name: str) -> dict[str, Any] | None:
        """Get tenant by name"""
        response = await self._request("GET", "tenancy/tenants/", params={"name": name})
        results = response.get("results", [])
        return results[0] if results else None

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if NetBox is accessible"""
        try:
            await self._request("GET", "status/")
            return True
        except Exception as e:
            logger.warning("netbox.health_check.failed", error=str(e))
            return False

    async def get_status(self) -> dict[str, Any]:
        """Get NetBox status"""
        return await self._request("GET", "status/")
