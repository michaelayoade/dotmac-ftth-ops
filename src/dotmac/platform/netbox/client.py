"""
NetBox API Client Wrapper

Provides a clean interface to the NetBox REST API using pynetbox library.
"""

import os
from typing import Any, cast
from urllib.parse import urljoin

import structlog

from dotmac.platform.core.http_client import RobustHTTPClient

logger = structlog.get_logger(__name__)


class NetBoxClient(RobustHTTPClient):  # type: ignore[misc]
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
            base_url: NetBox instance URL (defaults to settings.external_services.netbox_url)
            api_token: API token for authentication (defaults to NETBOX_API_TOKEN env var)
            tenant_id: Tenant ID for multi-tenancy support
            verify_ssl: Verify SSL certificates (default True)
            timeout_seconds: Default timeout in seconds
            max_retries: Maximum retry attempts
        """
        # Load from environment or centralized settings (Phase 2 implementation)
        if base_url is None:
            env_base_url = os.getenv("NETBOX_URL")
            if env_base_url:
                base_url = env_base_url
            else:
                try:
                    from dotmac.platform.settings import settings

                    base_url = settings.external_services.netbox_url
                except (ImportError, AttributeError):
                    base_url = "http://localhost:8080"

        api_token = api_token or os.getenv("NETBOX_API_TOKEN", "")

        # Normalize base URL and ensure we don't double-append /api
        normalized_base_url = base_url.rstrip("/")
        if normalized_base_url.lower().endswith("/api"):
            normalized_base_url = normalized_base_url[: -len("/api")]

        # Initialize robust HTTP client
        # NetBox uses "Token" prefix for auth, not "Bearer"
        super().__init__(
            service_name="netbox",
            base_url=normalized_base_url,
            tenant_id=tenant_id,
            verify_ssl=verify_ssl,
            default_timeout=timeout_seconds,
            max_retries=max_retries,
        )

        # Override auth header for NetBox Token format and apply to underlying HTTP client
        if api_token:
            auth_header = f"Token {api_token}"
            self.headers["Authorization"] = auth_header
            # Ensure the pooled httpx client sees the updated header
            self.client.headers["Authorization"] = auth_header

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

    async def delete_prefix(self, prefix_id: int) -> None:
        """Delete prefix by ID"""
        await self._netbox_request("DELETE", f"ipam/prefixes/{prefix_id}/")

    async def get_available_ips(self, prefix_id: int, limit: int = 10) -> list[dict[str, Any]]:
        """Get available IP addresses in a prefix"""
        response = await self._netbox_request(
            "GET",
            f"ipam/prefixes/{prefix_id}/available-ips/",
            params={"limit": limit},
        )
        if isinstance(response, list):
            return response
        if isinstance(response, dict):
            results = response.get("results")
            if isinstance(results, list):
                return results
        return []

    async def allocate_ip(self, prefix_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Allocate next available IP from prefix"""
        response = await self._netbox_request(
            "POST",
            f"ipam/prefixes/{prefix_id}/available-ips/",
            json=data,
        )
        return cast(dict[str, Any], response)

    async def allocate_dual_stack_ips(
        self,
        ipv4_prefix_id: int,
        ipv6_prefix_id: int,
        description: str | None = None,
        dns_name: str | None = None,
        tenant: int | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """
        Allocate both IPv4 and IPv6 addresses atomically.

        This method allocates IP addresses from both IPv4 and IPv6 prefixes
        in a way that ensures both allocations succeed or both fail.

        Args:
            ipv4_prefix_id: ID of IPv4 prefix to allocate from
            ipv6_prefix_id: ID of IPv6 prefix to allocate from
            description: Description for both IP addresses
            dns_name: DNS name for both IP addresses
            tenant: Tenant ID for both IP addresses

        Returns:
            Tuple of (ipv4_response, ipv6_response)

        Raises:
            Exception: If either allocation fails, both are rolled back
        """
        # Prepare allocation data
        ipv4_data: dict[str, Any] = {}
        ipv6_data: dict[str, Any] = {}

        if description:
            ipv4_data["description"] = description
            ipv6_data["description"] = description

        if dns_name:
            ipv4_data["dns_name"] = dns_name
            ipv6_data["dns_name"] = dns_name

        if tenant:
            ipv4_data["tenant"] = tenant
            ipv6_data["tenant"] = tenant

        # Try to allocate IPv4 first
        try:
            ipv4_response = await self.allocate_ip(ipv4_prefix_id, ipv4_data)
        except Exception as e:
            logger.error(
                "dual_stack_allocation.ipv4_failed",
                ipv4_prefix_id=ipv4_prefix_id,
                error=str(e),
            )
            raise ValueError(f"Failed to allocate IPv4 address: {e}") from e

        # Try to allocate IPv6
        try:
            ipv6_response = await self.allocate_ip(ipv6_prefix_id, ipv6_data)
        except Exception as e:
            # IPv6 allocation failed - rollback IPv4
            logger.error(
                "dual_stack_allocation.ipv6_failed_rolling_back_ipv4",
                ipv4_id=ipv4_response.get("id"),
                ipv6_prefix_id=ipv6_prefix_id,
                error=str(e),
            )
            try:
                await self.delete_ip_address(ipv4_response["id"])
            except Exception as rollback_error:
                logger.error(
                    "dual_stack_allocation.rollback_failed",
                    ipv4_id=ipv4_response.get("id"),
                    rollback_error=str(rollback_error),
                )
            raise ValueError(f"Failed to allocate IPv6 address (IPv4 rolled back): {e}") from e

        logger.info(
            "dual_stack_allocation.success",
            ipv4_id=ipv4_response.get("id"),
            ipv4_address=ipv4_response.get("address"),
            ipv6_id=ipv6_response.get("id"),
            ipv6_address=ipv6_response.get("address"),
        )

        return (ipv4_response, ipv6_response)

    async def bulk_allocate_ips(
        self,
        prefix_id: int,
        count: int,
        description_prefix: str | None = None,
        tenant: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Allocate multiple IP addresses from a prefix in bulk.

        Args:
            prefix_id: ID of prefix to allocate from
            count: Number of IPs to allocate (max 100)
            description_prefix: Prefix for IP descriptions (e.g., "Server")
            tenant: Tenant ID for all IPs

        Returns:
            List of allocated IP address responses

        Raises:
            ValueError: If count > 100 or allocation fails
        """
        if count > 100:
            raise ValueError("Cannot allocate more than 100 IPs at once")

        allocated_ips = []
        for i in range(count):
            data: dict[str, Any] = {}

            if description_prefix:
                data["description"] = f"{description_prefix}-{i + 1}"

            if tenant:
                data["tenant"] = tenant

            try:
                ip_response = await self.allocate_ip(prefix_id, data)
                allocated_ips.append(ip_response)
            except Exception as e:
                logger.error(
                    "bulk_allocation.failed",
                    prefix_id=prefix_id,
                    allocated_count=len(allocated_ips),
                    target_count=count,
                    error=str(e),
                )
                raise ValueError(
                    f"Bulk allocation failed after {len(allocated_ips)} IPs: {e}"
                ) from e

        logger.info(
            "bulk_allocation.success",
            prefix_id=prefix_id,
            count=len(allocated_ips),
        )

        return allocated_ips

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

    async def delete_vrf(self, vrf_id: int) -> None:
        """Delete VRF by ID"""
        await self._netbox_request("DELETE", f"ipam/vrfs/{vrf_id}/")

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

    async def delete_site(self, site_id: int) -> None:
        """Delete site by ID"""
        await self._netbox_request("DELETE", f"dcim/sites/{site_id}/")

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
    # VLAN Operations
    # =========================================================================

    async def get_vlans(
        self,
        tenant: str | None = None,
        site: str | None = None,
        vid: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get VLANs"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if site:
            params["site"] = site
        if vid:
            params["vid"] = vid

        response = await self._netbox_request("GET", "ipam/vlans/", params=params)
        return cast(dict[str, Any], response)

    async def get_vlan(self, vlan_id: int) -> dict[str, Any]:
        """Get single VLAN by ID"""
        response = await self._netbox_request("GET", f"ipam/vlans/{vlan_id}/")
        return cast(dict[str, Any], response)

    async def create_vlan(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new VLAN"""
        response = await self._netbox_request("POST", "ipam/vlans/", json=data)
        return cast(dict[str, Any], response)

    async def update_vlan(self, vlan_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Update VLAN"""
        response = await self._netbox_request("PATCH", f"ipam/vlans/{vlan_id}/", json=data)
        return cast(dict[str, Any], response)

    async def delete_vlan(self, vlan_id: int) -> None:
        """Delete VLAN"""
        await self._netbox_request("DELETE", f"ipam/vlans/{vlan_id}/")

    # =========================================================================
    # Cable Operations
    # =========================================================================

    async def get_cables(
        self,
        tenant: str | None = None,
        site: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get cables"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if site:
            params["site"] = site

        response = await self._netbox_request("GET", "dcim/cables/", params=params)
        return cast(dict[str, Any], response)

    async def get_cable(self, cable_id: int) -> dict[str, Any]:
        """Get single cable by ID"""
        response = await self._netbox_request("GET", f"dcim/cables/{cable_id}/")
        return cast(dict[str, Any], response)

    async def create_cable(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new cable"""
        response = await self._netbox_request("POST", "dcim/cables/", json=data)
        return cast(dict[str, Any], response)

    async def update_cable(self, cable_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Update cable"""
        response = await self._netbox_request("PATCH", f"dcim/cables/{cable_id}/", json=data)
        return cast(dict[str, Any], response)

    async def delete_cable(self, cable_id: int) -> None:
        """Delete cable"""
        await self._netbox_request("DELETE", f"dcim/cables/{cable_id}/")

    # =========================================================================
    # Circuit Operations
    # =========================================================================

    async def get_circuit_providers(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get circuit providers"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        response = await self._netbox_request("GET", "circuits/providers/", params=params)
        return cast(dict[str, Any], response)

    async def get_circuit_provider(self, provider_id: int) -> dict[str, Any]:
        """Get single circuit provider by ID"""
        response = await self._netbox_request("GET", f"circuits/providers/{provider_id}/")
        return cast(dict[str, Any], response)

    async def create_circuit_provider(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new circuit provider"""
        response = await self._netbox_request("POST", "circuits/providers/", json=data)
        return cast(dict[str, Any], response)

    async def get_circuit_types(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get circuit types"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        response = await self._netbox_request("GET", "circuits/circuit-types/", params=params)
        return cast(dict[str, Any], response)

    async def create_circuit_type(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new circuit type"""
        response = await self._netbox_request("POST", "circuits/circuit-types/", json=data)
        return cast(dict[str, Any], response)

    async def get_circuits(
        self,
        tenant: str | None = None,
        provider: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get circuits"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if tenant:
            params["tenant"] = tenant
        if provider:
            params["provider"] = provider

        response = await self._netbox_request("GET", "circuits/circuits/", params=params)
        return cast(dict[str, Any], response)

    async def get_circuit(self, circuit_id: int) -> dict[str, Any]:
        """Get single circuit by ID"""
        response = await self._netbox_request("GET", f"circuits/circuits/{circuit_id}/")
        return cast(dict[str, Any], response)

    async def create_circuit(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new circuit"""
        response = await self._netbox_request("POST", "circuits/circuits/", json=data)
        return cast(dict[str, Any], response)

    async def update_circuit(self, circuit_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Update circuit"""
        response = await self._netbox_request(
            "PATCH", f"circuits/circuits/{circuit_id}/", json=data
        )
        return cast(dict[str, Any], response)

    async def delete_circuit(self, circuit_id: int) -> None:
        """Delete circuit"""
        await self._netbox_request("DELETE", f"circuits/circuits/{circuit_id}/")

    async def get_circuit_terminations(
        self,
        circuit_id: int | None = None,
        site: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get circuit terminations"""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if circuit_id:
            params["circuit_id"] = circuit_id
        if site:
            params["site"] = site

        response = await self._netbox_request(
            "GET", "circuits/circuit-terminations/", params=params
        )
        return cast(dict[str, Any], response)

    async def create_circuit_termination(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create new circuit termination"""
        response = await self._netbox_request("POST", "circuits/circuit-terminations/", json=data)
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

    async def delete_tenant(self, tenant_id: int) -> None:
        """Delete tenant by ID"""
        await self._netbox_request("DELETE", f"tenancy/tenants/{tenant_id}/")

    async def get_tenant_by_name(self, name: str) -> dict[str, Any] | None:
        """Get tenant by name"""
        response = await self._netbox_request("GET", "tenancy/tenants/", params={"name": name})
        response_dict = cast(dict[str, Any], response)
        results = response_dict.get("results", [])
        return results[0] if results else None

    async def get_tenant_by_slug(self, slug: str) -> dict[str, Any] | None:
        """Get tenant by slug"""
        response = await self._netbox_request("GET", "tenancy/tenants/", params={"slug": slug})
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
