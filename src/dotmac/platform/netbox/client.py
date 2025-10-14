"""
NetBox API Client Wrapper

Provides a clean interface to the NetBox REST API using pynetbox library.
"""

import os
from typing import Any, cast
from urllib.parse import urljoin

import httpx
import structlog

from dotmac.platform.core.http_client import RobustHTTPClient

logger = structlog.get_logger(__name__)


class NetBoxClient(RobustHTTPClient):
    """
    NetBox API Client

    Wraps the NetBox REST API for IPAM and DCIM operations.
    Uses httpx for async HTTP requests.
    """

    # Configurable timeouts for different operations
    TIMEOUTS = {
        "health_check": 5.0,
        "list": 15.0,
        "get": 10.0,
        "create": 30.0,
        "update": 30.0,
        "delete": 30.0,
        "allocate": 30.0,
    }


    def __init__(
        self,
        base_url: str | None = None,
        api_token: str | None = None,
        tenant_id: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
    ):
        """
        Initialize NetBox client with robust HTTP capabilities.

        Args:
            base_url: NetBox instance URL (defaults to NETBOX_URL env var)
            api_token: API token for authentication (defaults to NETBOX_API_TOKEN env var)
            tenant_id: Tenant ID for multi-tenancy support
            verify_ssl: Verify SSL certificates (default True)
            timeout_seconds: Default timeout in seconds
            max_retries: Maximum retry attempts
        """
        base_url = base_url or os.getenv("NETBOX_URL", "http://localhost:8080")
        api_token = api_token or os.getenv("NETBOX_API_TOKEN", "")

        # Initialize robust HTTP client
        # NetBox uses "Token" prefix for auth, not "Bearer"
        super().__init__(
            service_name="netbox",
            base_url=base_url,
            tenant_id=tenant_id,
            verify_ssl=verify_ssl,
            default_timeout=timeout_seconds,
            max_retries=max_retries,
        )

        # Override auth header for NetBox Token format
        if api_token:
            self.headers["Authorization"] = f"Token {api_token}"

        # API base path
        self.api_base = urljoin(self.base_url, "api/")

    async def _netbox_request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        """
        Make HTTP request to NetBox API using robust base client.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            endpoint: API endpoint (relative to api/)
            params: Query parameters
            json: JSON body
            timeout: Request timeout (overrides default)

        Returns:
            Response JSON data
        """
        # Construct full endpoint with api/ prefix
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
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if vrf:
            params["vrf"] = vrf

        response = await self._netbox_request("GET", "ipam/ip-addresses/", params=params)
        return cast(dict[str, Any], response)

    async def get_ip_address(self, ip_id: int) -> dict[str, Any]:
        """Get single IP address by ID"""
        response = await self._netbox_request("GET", f"ipam/ip-addresses/{ip_id}/")
        return cast(dict[str, Any], response)

    async def create_ip_address(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new IP address"""
        response = await self._netbox_request("POST", "ipam/ip-addresses/", json=data)
        return cast(dict[str, Any], response)

    async def update_ip_address(self, ip_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Update IP address"""
        response = await self._netbox_request("PATCH", f"ipam/ip-addresses/{ip_id}/", json=data)
        return cast(dict[str, Any], response)

    async def delete_ip_address(self, ip_id: int) -> None:
        """Delete IP address"""
        await self._netbox_request("DELETE", f"ipam/ip-addresses/{ip_id}/")

    async def get_prefixes(
        self,
        tenant: str | None = None,
        vrf: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get IP prefixes (subnets)"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if vrf:
            params["vrf"] = vrf

        response = await self._netbox_request("GET", "ipam/prefixes/", params=params)
        return cast(dict[str, Any], response)

    async def get_prefix(self, prefix_id: int) -> dict[str, Any]:
        """Get single prefix by ID"""
        response = await self._netbox_request("GET", f"ipam/prefixes/{prefix_id}/")
        return cast(dict[str, Any], response)

    async def create_prefix(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new prefix"""
        response = await self._netbox_request("POST", "ipam/prefixes/", json=data)
        return cast(dict[str, Any], response)

    async def get_available_ips(self, prefix_id: int, limit: int = 10) -> list[dict[str, Any]]:
        """Get available IP addresses in a prefix"""
        response = await self._netbox_request(
            "GET",
            f"ipam/prefixes/{prefix_id}/available-ips/",
            params={"limit": limit},
        )
        return response if isinstance(response, list) else []

    async def allocate_ip(self, prefix_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Allocate next available IP from prefix"""
        response = await self._netbox_request(
            "POST",
            f"ipam/prefixes/{prefix_id}/available-ips/",
            json=data,
        )
        return cast(dict[str, Any], response)

    async def get_vrfs(
        self,
        tenant: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get VRFs (Virtual Routing and Forwarding)"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant

        response = await self._netbox_request("GET", "ipam/vrfs/", params=params)
        return cast(dict[str, Any], response)

    async def create_vrf(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new VRF"""
        response = await self._netbox_request("POST", "ipam/vrfs/", json=data)
        return cast(dict[str, Any], response)

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
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant

        response = await self._netbox_request("GET", "dcim/sites/", params=params)
        return cast(dict[str, Any], response)

    async def get_site(self, site_id: int) -> dict[str, Any]:
        """Get single site by ID"""
        response = await self._netbox_request("GET", f"dcim/sites/{site_id}/")
        return cast(dict[str, Any], response)

    async def create_site(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new site"""
        response = await self._netbox_request("POST", "dcim/sites/", json=data)
        return cast(dict[str, Any], response)

    async def get_devices(
        self,
        tenant: str | None = None,
        site: str | None = None,
        role: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get devices"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if site:
            params["site"] = site
        if role:
            params["role"] = role

        response = await self._netbox_request("GET", "dcim/devices/", params=params)
        return cast(dict[str, Any], response)

    async def get_device(self, device_id: int) -> dict[str, Any]:
        """Get single device by ID"""
        response = await self._netbox_request("GET", f"dcim/devices/{device_id}/")
        return cast(dict[str, Any], response)

    async def create_device(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new device"""
        response = await self._netbox_request("POST", "dcim/devices/", json=data)
        return cast(dict[str, Any], response)

    async def update_device(self, device_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Update device"""
        response = await self._netbox_request("PATCH", f"dcim/devices/{device_id}/", json=data)
        return cast(dict[str, Any], response)

    async def get_interfaces(
        self,
        device_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get network interfaces"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if device_id:
            params["device_id"] = device_id

        response = await self._netbox_request("GET", "dcim/interfaces/", params=params)
        return cast(dict[str, Any], response)

    async def create_interface(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new interface"""
        response = await self._netbox_request("POST", "dcim/interfaces/", json=data)
        return cast(dict[str, Any], response)

    # =========================================================================
    # Tenancy Operations
    # =========================================================================

    async def get_tenants(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get tenants"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        response = await self._netbox_request("GET", "tenancy/tenants/", params=params)
        return cast(dict[str, Any], response)

    async def get_tenant(self, tenant_id: int) -> dict[str, Any]:
        """Get single tenant by ID"""
        response = await self._netbox_request("GET", f"tenancy/tenants/{tenant_id}/")
        return cast(dict[str, Any], response)

    async def create_tenant(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new tenant"""
        response = await self._netbox_request("POST", "tenancy/tenants/", json=data)
        return cast(dict[str, Any], response)

    async def get_tenant_by_name(self, name: str) -> dict[str, Any] | None:
        """Get tenant by name"""
        response = await self._netbox_request("GET", "tenancy/tenants/", params={"name": name})
        response_dict = cast(dict[str, Any], response)
        results = response_dict.get("results", [])
        return results[0] if results else None

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if NetBox is accessible"""
        try:
            await self._netbox_request("GET", "status/")
            return True
        except Exception as e:
            logger.warning("netbox.health_check.failed", error=str(e))
            return False

    async def get_status(self) -> dict[str, Any]:
        """Get NetBox status"""
        response = await self._netbox_request("GET", "status/")
        return cast(dict[str, Any], response)
