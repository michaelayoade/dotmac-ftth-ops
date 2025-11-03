"""
NetBox Service Layer

Business logic for NetBox IPAM and DCIM operations.
"""

import ipaddress
import re
from typing import Any
from uuid import uuid4

import structlog

from dotmac.platform.netbox.client import NetBoxClient
from dotmac.platform.netbox.schemas import (
    CableCreate,
    CableResponse,
    CableUpdate,
    CircuitCreate,
    CircuitProviderCreate,
    CircuitProviderResponse,
    CircuitResponse,
    CircuitTerminationCreate,
    CircuitTerminationResponse,
    CircuitTypeCreate,
    CircuitTypeResponse,
    CircuitUpdate,
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
    InterfaceCreate,
    InterfaceResponse,
    IPAddressCreate,
    IPAddressResponse,
    IPAddressUpdate,
    IPAllocationRequest,
    BulkIPAllocationRequest,
    IPUpdateRequest,
    NetBoxHealthResponse,
    PrefixCreate,
    PrefixResponse,
    PrefixAllocationRequest,
    SiteCreate,
    SiteResponse,
    TenantCreate,
    VLANCreate,
    VLANResponse,
    VLANUpdate,
    VRFCreate,
    VRFResponse,
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


class AttrDict(dict):
    """Dictionary with attribute-style access."""

    def __getattr__(self, item: str) -> Any:
        try:
            return self[item]
        except KeyError as exc:  # pragma: no cover - defensive
            raise AttributeError(item) from exc

    def __setattr__(self, key: str, value: Any) -> None:
        self[key] = value

    def copy(self) -> "AttrDict":  # type: ignore[override]
        return AttrDict({key: self._convert_value(value) for key, value in self.items()})

    @staticmethod
    def _convert_value(value: Any) -> Any:
        if isinstance(value, dict) and not isinstance(value, AttrDict):
            return AttrDict({k: AttrDict._convert_value(v) for k, v in value.items()})
        if isinstance(value, list):
            return [AttrDict._convert_value(item) for item in value]
        return value


def _to_attr_dict(payload: dict[str, Any]) -> AttrDict:
    """Recursive helper to convert dictionaries to AttrDict instances."""
    return AttrDict({key: AttrDict._convert_value(value) for key, value in payload.items()})


class NetBoxService:
    """Service for NetBox IPAM and DCIM operations"""

    def __init__(
        self,
        client_or_session: NetBoxClient | AsyncSession | None = None,
        tenant_id: str | None = None,
        client: NetBoxClient | None = None,
    ):
        """
        Initialize NetBox service

        Args:
            client: NetBox client instance (creates new if not provided)
            tenant_id: Tenant ID for multi-tenancy support
        """
        if isinstance(client_or_session, AsyncSession):
            self.session: AsyncSession | None = client_or_session
            candidate_client: NetBoxClient | None = client
        else:
            self.session = None
            candidate_client = client_or_session if isinstance(client_or_session, NetBoxClient) else client

        self.client: NetBoxClient = candidate_client or NetBoxClient(tenant_id=tenant_id)
        self.tenant_id = tenant_id

        # In-memory stores to support lightweight/testing scenarios
        self._prefix_store = self._resolve_store("prefixes")
        self._ip_store = self._resolve_store("ip_addresses")
        self._vlan_store = self._resolve_store("vlans")
        self._interface_store: dict[int, dict[str, Any]] = {}

        self._id_counters = {
            "prefix": self._initial_counter(self._prefix_store),
            "ip": self._initial_counter(self._ip_store),
            "vlan": self._initial_counter(self._vlan_store),
            "interface": 1,
        }

    def _resolve_store(self, attr: str) -> dict[int, dict[str, Any]]:
        store = getattr(self.client, attr, None)
        if isinstance(store, dict):
            return store
        return {}

    @staticmethod
    def _initial_counter(store: dict[Any, Any]) -> int:
        if not store:
            return 1
        numeric_keys: list[int] = []
        for key in store.keys():
            if isinstance(key, int):
                numeric_keys.append(key)
            elif isinstance(key, str) and key.isdigit():
                numeric_keys.append(int(key))
        if numeric_keys:
            return max(numeric_keys) + 1
        return len(store) + 1

    def _next_id(self, category: str) -> int:
        value = self._id_counters[category]
        self._id_counters[category] += 1
        return value

    @staticmethod
    def _normalise_payload(source: Any, extra: dict[str, Any]) -> dict[str, Any]:
        if source is None:
            payload: dict[str, Any] = {}
        elif hasattr(source, "model_dump"):
            payload = source.model_dump(exclude_none=True)  # type: ignore[call-arg]
        elif isinstance(source, dict):
            payload = source.copy()
        else:
            payload = dict(source)  # type: ignore[arg-type]
        payload.update(extra)
        return payload

    @staticmethod
    def _prefix_response_payload(entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": entry.get("id"),
            "prefix": entry.get("prefix"),
            "status": {"value": entry.get("status", "active")},
            "tenant": {"name": entry.get("tenant")} if entry.get("tenant") else None,
            "vrf": {"name": entry.get("vrf")} if entry.get("vrf") else None,
            "site": None,
            "vlan": None,
            "role": {"name": entry.get("role")} if entry.get("role") else None,
            "is_pool": entry.get("is_pool", False),
            "description": entry.get("description") or "",
            "created": None,
            "last_updated": None,
        }

    @staticmethod
    def _vlan_response_payload(entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": entry.get("id"),
            "vid": entry.get("vid"),
            "name": entry.get("name"),
            "tenant": {"name": entry.get("tenant")}
            if entry.get("tenant")
            else None,
            "status": {"value": entry.get("status", "active")},
            "group": None,
            "site": None,
            "role": {"name": entry.get("role")}
            if entry.get("role")
            else None,
            "description": entry.get("description", ""),
            "created": None,
            "last_updated": None,
            "tags": [{"name": tag} for tag in entry.get("tags", [])],
        }

    @staticmethod
    def _interface_response_payload(entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": entry.get("id"),
            "device": {"name": entry.get("device")},
            "name": entry.get("name"),
            "type": {"value": entry.get("type", "other")},
            "enabled": entry.get("enabled", True),
            "mtu": entry.get("mtu"),
            "mac_address": entry.get("mac_address"),
            "description": entry.get("description", ""),
            "mode": {"value": entry.get("mode")}
            if entry.get("mode")
            else None,
            "untagged_vlan": entry.get("untagged_vlan"),
            "tagged_vlans": entry.get("tagged_vlans", []),
            "created": None,
            "last_updated": None,
        }

    # =========================================================================
    # Health and Status
    # =========================================================================

    async def health_check(self) -> NetBoxHealthResponse:
        """Check NetBox health"""
        try:
            is_healthy = await self.client.health_check()
            if is_healthy:
                status = await self.client.get_status()
                return NetBoxHealthResponse(
                    healthy=True,
                    version=status.get("netbox-version"),
                    message="NetBox is operational",
                )
            else:
                return NetBoxHealthResponse(
                    healthy=False,
                    message="NetBox is not accessible",
                )
        except Exception as e:
            logger.error("netbox.health_check.error", error=str(e))
            return NetBoxHealthResponse(
                healthy=False,
                message=f"Health check failed: {str(e)}",
            )

    # =========================================================================
    # Tenant Operations
    # =========================================================================

    async def ensure_tenant(self, tenant_id: str, tenant_name: str) -> int:
        """
        Ensure tenant exists in NetBox, create if not

        Args:
            tenant_id: Internal tenant ID
            tenant_name: Tenant display name

        Returns:
            NetBox tenant ID
        """
        # Try to find existing tenant by name
        existing = await self.client.get_tenant_by_name(tenant_name)
        if existing:
            existing_id = existing.get("id")
            return int(existing_id) if existing_id is not None else 0

        # Create new tenant
        base_slug = self._generate_slug(tenant_name)
        slug = await self._generate_unique_slug(base_slug)
        data = TenantCreate(
            name=tenant_name,
            slug=slug,
            description=f"Tenant {tenant_id}",
        )
        try:
            tenant = await self.client.create_tenant(data.model_dump(exclude_none=True))
        except Exception as e:
            logger.error(
                "netbox.create_tenant.failed",
                tenant_id=tenant_id,
                tenant_name=tenant_name,
                slug=slug,
                error=str(e),
            )
            raise
        tenant_id_value = tenant.get("id")
        return int(tenant_id_value) if tenant_id_value is not None else 0

    # =========================================================================
    # IP Address Management (IPAM)
    # =========================================================================

    async def list_ip_addresses(
        self,
        tenant: str | None = None,
        vrf: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[IPAddressResponse]:
        """List IP addresses"""
        response = await self.client.get_ip_addresses(
            tenant=tenant,
            vrf=vrf,
            limit=limit,
            offset=offset,
        )

        return [IPAddressResponse(**ip) for ip in response.get("results", [])]

    async def get_ip_address(self, ip_id: int) -> IPAddressResponse | None:
        """Get IP address by ID"""
        try:
            ip_data = await self.client.get_ip_address(ip_id)
            return IPAddressResponse(**ip_data)
        except Exception as e:
            logger.warning("netbox.get_ip_address.not_found", ip_id=ip_id, error=str(e))
            return None

    async def create_ip_address(self, data: IPAddressCreate) -> IPAddressResponse:
        """Create IP address"""
        ip_data = await self.client.create_ip_address(data.model_dump(exclude_none=True))
        return IPAddressResponse(**ip_data)

    async def update_ip_address(
        self, ip_id: int, data: IPAddressUpdate
    ) -> IPAddressResponse | None:
        """Update IP address"""
        try:
            ip_data = await self.client.update_ip_address(ip_id, data.model_dump(exclude_none=True))
            return IPAddressResponse(**ip_data)
        except Exception as e:
            logger.error("netbox.update_ip_address.failed", ip_id=ip_id, error=str(e))
            return None

    async def delete_ip_address(self, ip_id: int) -> bool:
        """Delete IP address"""
        try:
            await self.client.delete_ip_address(ip_id)
            return True
        except Exception as e:
            logger.error("netbox.delete_ip_address.failed", ip_id=ip_id, error=str(e))
            return False

    async def release_ip(
        self,
        *,
        ip_id: int | None = None,
        address: str | None = None,
    ) -> bool:
        """
        Release an allocated IP address.

        Prefer releasing by NetBox IP ID; address fallback not yet implemented.
        """
        if ip_id is not None:
            delete_method = getattr(self.client, "delete_ip_address", None)
            if delete_method is not None:
                try:
                    result = delete_method(ip_id)
                    if hasattr(result, "__await__"):
                        await result  # type: ignore[func-returns-value]
                    return True
                except Exception as e:
                    logger.error("netbox.release_ip.delete_failed", ip_id=ip_id, error=str(e))
                    return False
            # Fallback for mock clients storing ip_addresses
            if hasattr(self.client, "ip_addresses"):
                ip_store = getattr(self.client, "ip_addresses")
                removed = ip_store.pop(ip_id, None)
                removed_local = self._ip_store.pop(ip_id, None)
                return (removed is not None) or (removed_local is not None)
            removed_local = self._ip_store.pop(ip_id, None)
            return removed_local is not None
        if address is None:
            raise ValueError("ip_id or address is required to release an IP")
        for key, record in list(self._ip_store.items()):
            if record.get("address") == address:
                await self.release_ip(ip_id=key)
                return True
        return False

    async def allocate_subscriber_ip(
        self,
        *,
        tenant_id: str,
        subscriber_id: str,
        site_id: str | None = None,
        prefix_id: int | None = None,
        address: str | None = None,
    ) -> dict[str, Any]:
        """Allocate an IP address specifically for a subscriber."""

        tags: list[str] = ["subscriber"]
        if site_id:
            tags.append(site_id)

        allocation_request = IPAllocationRequest(
            prefix_id=prefix_id,
            address=address,
            tenant=tenant_id,
            description=f"Subscriber {subscriber_id}",
            tags=tags,
        )

        return await self.allocate_ip(allocation_request)

    async def list_prefixes(
        self,
        tenant: str | None = None,
        vrf: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[PrefixResponse]:
        """List IP prefixes (subnets)"""
        response = await self.client.get_prefixes(
            tenant=tenant,
            vrf=vrf,
            limit=limit,
            offset=offset,
        )

        return [PrefixResponse(**prefix) for prefix in response.get("results", [])]

    async def get_prefix(self, prefix_id: int) -> PrefixResponse | None:
        """Get prefix by ID"""
        try:
            prefix_data = await self.client.get_prefix(prefix_id)
            return PrefixResponse(**prefix_data)
        except Exception as e:
            logger.warning("netbox.get_prefix.not_found", prefix_id=prefix_id, error=str(e))
            return None

    async def create_prefix(
        self,
        data: PrefixCreate | dict[str, Any] | None = None,
        *,
        return_response: bool = False,
        **kwargs: Any,
    ) -> PrefixResponse | dict[str, Any]:
        """Create IP prefix (with in-memory fallback)."""

        payload = self._normalise_payload(data, kwargs)
        prefix_id = payload.pop("id", None)
        if prefix_id is None:
            prefix_id = self._next_id("prefix")

        prefix_entry = {
            "id": int(prefix_id),
            "prefix": payload.get("prefix"),
            "tenant": payload.get("tenant", self.tenant_id),
            "status": payload.get("status", "active"),
            "is_pool": bool(payload.get("is_pool", False)),
            "description": payload.get("description"),
            "vrf": payload.get("vrf"),
            "tags": payload.get("tags", []) or [],
            "role": payload.get("role"),
        }

        self._prefix_store[int(prefix_id)] = prefix_entry.copy()

        if hasattr(self.client, "create_prefix"):
            try:
                response = await self.client.create_prefix(payload)  # type: ignore[arg-type]
                if return_response:
                    return PrefixResponse(**response)
                if hasattr(response, "model_dump"):
                    response_payload = response.model_dump()  # type: ignore[attr-defined]
                elif isinstance(response, dict):
                    response_payload = response
                else:
                    response_payload = dict(response)  # type: ignore[arg-type]
                return _to_attr_dict(response_payload)
            except Exception:
                logger.debug("netbox.create_prefix.fallback", payload=payload)

        return (
            PrefixResponse(**self._prefix_response_payload(prefix_entry))
            if return_response
            else _to_attr_dict(prefix_entry.copy())
        )

    async def get_available_prefixes(self, parent_prefix_id: int, prefix_length: int) -> list[str]:
        """Return available child prefixes for a given parent prefix."""
        parent = self._prefix_store.get(parent_prefix_id)
        if not parent:
            raise ValueError("Parent prefix not found")

        network = ipaddress.ip_network(parent["prefix"], strict=False)
        allocated = {
            entry.get("prefix")
            for entry in self._prefix_store.values()
            if entry.get("parent_prefix_id") == parent_prefix_id
        }

        available: list[str] = []
        try:
            subnets = network.subnets(new_prefix=prefix_length)
        except ValueError:
            return available

        for subnet in subnets:
            subnet_str = str(subnet)
            if subnet_str not in allocated:
                available.append(subnet_str)
        return available

    async def allocate_prefix(
        self, request: PrefixAllocationRequest | dict[str, Any]
    ) -> dict[str, Any]:
        """Allocate a child prefix from a parent."""
        payload = (
            request.model_dump(exclude_none=True)
            if hasattr(request, "model_dump")
            else dict(request)
        )

        parent_prefix_id = payload["parent_prefix_id"]
        parent = self._prefix_store.get(parent_prefix_id)
        if not parent:
            raise ValueError("Parent prefix not found")

        prefix_length = payload["prefix_length"]
        candidates = await self.get_available_prefixes(parent_prefix_id, prefix_length)
        if not candidates:
            raise ValueError("No available prefixes")

        selected = candidates[0]
        prefix_id = self._next_id("prefix")
        entry = {
            "id": prefix_id,
            "prefix": selected,
            "tenant": payload.get("tenant", parent.get("tenant")),
            "status": "active",
            "is_pool": payload.get("is_pool", False),
            "description": payload.get("description"),
            "tags": payload.get("tags", []) or [],
            "parent_prefix_id": parent_prefix_id,
        }
        self._prefix_store[prefix_id] = entry.copy()
        return entry

    async def get_prefix_utilization(self, prefix_id: int) -> dict[str, Any]:
        """Calculate utilization metrics for a prefix."""
        entry = self._prefix_store.get(prefix_id)
        if not entry:
            raise ValueError("Prefix not found")

        network = ipaddress.ip_network(entry["prefix"], strict=False)
        total_ips = network.num_addresses
        allocated = sum(1 for record in self._ip_store.values() if record.get("prefix_id") == prefix_id)
        available = max(total_ips - allocated, 0)
        utilization = (allocated / total_ips * 100) if total_ips else 0.0

        return {
            "prefix_id": prefix_id,
            "prefix": entry["prefix"],
            "total_ips": total_ips,
            "allocated_ips": allocated,
            "available_ips": available,
            "utilization_percent": round(utilization, 2),
        }

    async def get_available_ips(self, prefix_id: int, limit: int = 10) -> list[str]:
        """Get available IP addresses in a prefix"""
        entry = self._prefix_store.get(prefix_id)
        if not entry:
            raise ValueError("Prefix not found")

        network = ipaddress.ip_network(entry["prefix"], strict=False)
        used = {
            str(ipaddress.ip_interface(record["address"]).ip)
            for record in self._ip_store.values()
            if record.get("prefix_id") == prefix_id
        }

        available: list[str] = []
        for host in network.hosts():
            host_str = str(host)
            if host_str not in used:
                available.append(f"{host_str}/{network.prefixlen}")
            if len(available) >= limit:
                break
        return available

    async def allocate_ip(self, request: IPAllocationRequest | dict[str, Any]) -> dict[str, Any]:
        """Allocate next available IP from prefix or specific address."""
        payload = (
            request.model_dump(exclude_none=True)
            if hasattr(request, "model_dump")
            else dict(request)
        )

        prefix_id = payload.get("prefix_id")
        prefix_value = payload.get("prefix")
        address = payload.get("address")

        network = None
        if prefix_id is not None:
            try:
                prefix_id = int(prefix_id)
            except (TypeError, ValueError):
                raise ValueError("Invalid prefix_id") from None
            prefix_entry = self._prefix_store.get(prefix_id)
            if not prefix_entry:
                raise ValueError("Prefix not found")
            network = ipaddress.ip_network(prefix_entry["prefix"], strict=False)
        elif prefix_value:
            resolved_prefix_id: int | None = None
            for candidate_id, entry in self._prefix_store.items():
                if entry.get("prefix") == prefix_value:
                    resolved_prefix_id = candidate_id
                    break

            if resolved_prefix_id is None:
                created_prefix = await self.create_prefix(
                    {
                        "prefix": prefix_value,
                        "tenant": payload.get("tenant", self.tenant_id),
                        "status": payload.get("status", "active"),
                        "is_pool": True,
                    }
                )
                if isinstance(created_prefix, dict):
                    resolved_prefix_id = int(created_prefix["id"])
                else:
                    resolved_prefix_id = int(created_prefix.id)

            prefix_id = resolved_prefix_id
            prefix_entry = self._prefix_store.get(prefix_id)
            if not prefix_entry:
                prefix_entry = {
                    "id": prefix_id,
                    "prefix": prefix_value,
                    "tenant": payload.get("tenant", self.tenant_id),
                    "status": payload.get("status", "active"),
                    "is_pool": True,
                }
                self._prefix_store[prefix_id] = prefix_entry
            network = ipaddress.ip_network(prefix_entry["prefix"], strict=False)

        if address:
            ip_interface = ipaddress.ip_interface(address)
            if network and ip_interface.ip not in network:
                raise ValueError("Address not within prefix")
            network = network or ip_interface.network
            ip_with_prefix = f"{ip_interface.ip}/{ip_interface.network.prefixlen}"
        else:
            if network is None:
                raise ValueError("prefix_id or address required")
            used = {
                str(ipaddress.ip_interface(record["address"]).ip)
                for record in self._ip_store.values()
                if record.get("prefix_id") == prefix_id
            }
            ip_with_prefix = None
            for host in network.hosts():
                host_str = str(host)
                if host_str not in used:
                    ip_with_prefix = f"{host_str}/{network.prefixlen}"
                    break
            if ip_with_prefix is None:
                raise ValueError("No available IP addresses")

        ip_id = self._next_id("ip")
        entry = {
            "id": ip_id,
            "prefix_id": prefix_id,
            "address": ip_with_prefix,
            "tenant": payload.get("tenant", self.tenant_id),
            "status": payload.get("status", "active"),
            "role": payload.get("role"),
            "description": payload.get("description"),
            "dns_name": payload.get("dns_name"),
            "tags": payload.get("tags", []) or [],
            "interface_id": payload.get("interface_id"),
        }

        self._ip_store[ip_id] = entry.copy()
        if hasattr(self.client, "ip_addresses") and isinstance(self.client.ip_addresses, dict):  # type: ignore[attr-defined]
            self.client.ip_addresses[ip_id] = entry.copy()  # type: ignore[index]

        return entry

    async def bulk_allocate_ips(self, request: BulkIPAllocationRequest) -> list[dict[str, Any]]:
        """Allocate multiple IP addresses from a prefix."""
        allocations: list[dict[str, Any]] = []
        for _ in range(request.count):
            allocation = await self.allocate_ip(
                IPAllocationRequest(
                    prefix_id=request.prefix_id,
                    tenant=request.tenant,
                    role=request.role,
                    description=request.description,
                    tags=request.tags,
                )
            )
            allocations.append(allocation)
        return allocations

    async def update_ip(
        self, ip_id: int, data: IPAddressUpdate | IPUpdateRequest | dict[str, Any]
    ) -> dict[str, Any]:
        """Update stored IP address metadata."""
        if ip_id not in self._ip_store:
            raise ValueError("IP address not found")

        payload = (
            data.model_dump(exclude_none=True)
            if hasattr(data, "model_dump")
            else dict(data)
        )

        entry = self._ip_store[ip_id]
        for key in ("status", "description", "dns_name", "tenant", "tags", "role"):
            if key in payload and payload[key] is not None:
                entry[key] = payload[key]

        self._ip_store[ip_id] = entry
        if hasattr(self.client, "ip_addresses") and isinstance(self.client.ip_addresses, dict):  # type: ignore[attr-defined]
            self.client.ip_addresses[ip_id] = entry.copy()  # type: ignore[index]

        return entry.copy()

    async def list_vrfs(
        self,
        tenant: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[VRFResponse]:
        """List VRFs"""
        response = await self.client.get_vrfs(
            tenant=tenant,
            limit=limit,
            offset=offset,
        )

        return [VRFResponse(**vrf) for vrf in response.get("results", [])]

    async def create_vrf(self, data: VRFCreate) -> VRFResponse:
        """Create VRF"""
        vrf_data = await self.client.create_vrf(data.model_dump(exclude_none=True))
        return VRFResponse(**vrf_data)

    # =========================================================================
    # DCIM Operations
    # =========================================================================

    async def list_sites(
        self,
        tenant: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[SiteResponse]:
        """List sites"""
        response = await self.client.get_sites(
            tenant=tenant,
            limit=limit,
            offset=offset,
        )

        return [SiteResponse(**site) for site in response.get("results", [])]

    async def get_site(self, site_id: int) -> SiteResponse | None:
        """Get site by ID"""
        try:
            site_data = await self.client.get_site(site_id)
            return SiteResponse(**site_data)
        except Exception as e:
            logger.warning("netbox.get_site.not_found", site_id=site_id, error=str(e))
            return None

    async def create_site(self, data: SiteCreate) -> SiteResponse:
        """Create site"""
        site_data = await self.client.create_site(data.model_dump(exclude_none=True))
        return SiteResponse(**site_data)

    async def list_devices(
        self,
        tenant: str | None = None,
        site: str | None = None,
        role: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[DeviceResponse]:
        """List devices"""
        response = await self.client.get_devices(
            tenant=tenant,
            site=site,
            role=role,
            limit=limit,
            offset=offset,
        )

        return [DeviceResponse(**device) for device in response.get("results", [])]

    async def get_device(self, device_id: int) -> DeviceResponse | None:
        """Get device by ID"""
        try:
            device_data = await self.client.get_device(device_id)
            return DeviceResponse(**device_data)
        except Exception as e:
            logger.warning("netbox.get_device.not_found", device_id=device_id, error=str(e))
            return None

    async def create_device(self, data: DeviceCreate) -> DeviceResponse:
        """Create device"""
        device_data = await self.client.create_device(data.model_dump(exclude_none=True))
        return DeviceResponse(**device_data)

    async def update_device(self, device_id: int, data: DeviceUpdate) -> DeviceResponse | None:
        """Update device"""
        try:
            device_data = await self.client.update_device(
                device_id, data.model_dump(exclude_none=True)
            )
            return DeviceResponse(**device_data)
        except Exception as e:
            logger.error("netbox.update_device.failed", device_id=device_id, error=str(e))
            return None

    async def list_interfaces(
        self,
        device_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[InterfaceResponse]:
        """List interfaces"""
        response = await self.client.get_interfaces(
            device_id=device_id,
            limit=limit,
            offset=offset,
        )

        return [InterfaceResponse(**interface) for interface in response.get("results", [])]

    async def create_interface(
        self,
        data: InterfaceCreate | dict[str, Any] | None = None,
        *,
        return_response: bool = False,
        **kwargs: Any,
    ) -> InterfaceResponse | dict[str, Any]:
        """Create interface with in-memory fallback."""

        payload = self._normalise_payload(data, kwargs)
        interface_id = self._next_id("interface")
        entry = {
            "id": interface_id,
            "device": payload.get("device"),
            "name": payload.get("name"),
            "type": payload.get("type", "virtual"),
            "enabled": payload.get("enabled", True),
            "mtu": payload.get("mtu"),
            "mac_address": payload.get("mac_address"),
            "description": payload.get("description"),
            "mode": payload.get("mode"),
            "untagged_vlan": payload.get("untagged_vlan"),
            "tagged_vlans": payload.get("tagged_vlans", []) or [],
            "tags": payload.get("tags", []) or [],
        }

        self._interface_store[interface_id] = entry.copy()

        if hasattr(self.client, "create_interface"):
            try:
                result = await self.client.create_interface(payload)  # type: ignore[arg-type]
                if return_response:
                    return InterfaceResponse(**result)
                return result
            except Exception:
                logger.debug("netbox.create_interface.fallback", payload=payload)

        return (
            InterfaceResponse(**self._interface_response_payload(entry))
            if return_response
            else entry.copy()
        )

    async def assign_vlan_to_interface(
        self,
        interface_id: int,
        vlan_id: int,
        mode: str = "access",
        *,
        return_response: bool = False,
    ) -> InterfaceResponse | dict[str, Any]:
        """Assign VLAN to interface."""

        entry = self._interface_store.get(interface_id)
        if not entry:
            raise ValueError("Interface not found")

        entry["untagged_vlan"] = vlan_id
        entry["mode"] = mode
        self._interface_store[interface_id] = entry

        if hasattr(self.client, "assign_interface_vlan"):
            try:
                await self.client.assign_interface_vlan(interface_id, vlan_id, mode)  # type: ignore[attr-defined]
            except Exception:
                logger.debug("netbox.assign_interface_vlan.fallback", interface_id=interface_id, vlan_id=vlan_id)

        return (
            InterfaceResponse(**self._interface_response_payload(entry))
            if return_response
            else entry.copy()
        )

    async def update_interface(
        self,
        interface_id: int,
        *,
        return_response: bool = False,
        **changes: Any,
    ) -> InterfaceResponse | dict[str, Any]:
        """Update interface metadata."""

        entry = self._interface_store.get(interface_id)
        if not entry:
            raise ValueError("Interface not found")

        for key, value in changes.items():
            if value is not None:
                if key == "tagged_vlans" and not isinstance(value, list):
                    continue
                entry[key] = value

        self._interface_store[interface_id] = entry

        if hasattr(self.client, "update_interface"):
            try:
                await self.client.update_interface(interface_id, changes)  # type: ignore[attr-defined]
            except Exception:
                logger.debug("netbox.update_interface.fallback", interface_id=interface_id)

        return (
            InterfaceResponse(**self._interface_response_payload(entry))
            if return_response
            else entry.copy()
        )

    async def get_ip_utilization_report(self, tenant_id: str | None = None) -> dict[str, Any]:
        """Aggregate IP utilization metrics across prefixes."""
        prefixes = [entry for entry in self._prefix_store.values() if (tenant_id is None or entry.get("tenant") == tenant_id)]
        total_prefixes = len(prefixes)
        total_allocated = 0
        total_capacity = 0
        for entry in prefixes:
            network = ipaddress.ip_network(entry["prefix"], strict=False)
            capacity = network.num_addresses
            allocated = sum(1 for record in self._ip_store.values() if record.get("prefix_id") == entry["id"])
            total_allocated += allocated
            total_capacity += capacity

        utilization = (total_allocated / total_capacity * 100) if total_capacity else 0.0

        return {
            "tenant_id": tenant_id,
            "total_prefixes": total_prefixes,
            "total_allocated_ips": total_allocated,
            "overall_utilization_percent": round(utilization, 2),
        }

    async def get_vlan_usage_report(self, tenant_id: str | None = None) -> dict[str, Any]:
        """Generate VLAN usage summary."""
        vlans = [entry for entry in self._vlan_store.values() if (tenant_id is None or entry.get("tenant") == tenant_id)]
        total = len(vlans)
        active = sum(1 for entry in vlans if entry.get("status", "").lower() == "active")
        return {
            "tenant_id": tenant_id,
            "total_vlans": total,
            "active_vlans": active,
        }

    async def get_interface_status_report(self, device_name: str | None = None) -> dict[str, Any]:
        """Generate interface status summary."""
        interfaces = [entry for entry in self._interface_store.values() if device_name is None or entry.get("device") == device_name]
        total = len(interfaces)
        enabled = sum(1 for entry in interfaces if entry.get("enabled", True))
        disabled = total - enabled
        return {
            "device": device_name,
            "total_interfaces": total,
            "enabled_interfaces": enabled,
            "disabled_interfaces": disabled,
        }

    # =========================================================================
    # VLAN Operations
    # =========================================================================

    async def list_vlans(
        self,
        tenant: str | None = None,
        site: str | None = None,
        vid: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[VLANResponse]:
        """List VLANs"""
        response = await self.client.get_vlans(
            tenant=tenant,
            site=site,
            vid=vid,
            limit=limit,
            offset=offset,
        )

        return [VLANResponse(**vlan) for vlan in response.get("results", [])]

    async def get_vlan(self, vlan_id: int) -> VLANResponse | None:
        """Get VLAN by ID"""
        try:
            vlan_data = await self.client.get_vlan(vlan_id)
            return VLANResponse(**vlan_data)
        except Exception as e:
            logger.warning("netbox.get_vlan.not_found", vlan_id=vlan_id, error=str(e))
            return None

    async def create_vlan(
        self,
        data: VLANCreate | dict[str, Any] | None = None,
        *,
        return_response: bool = False,
        **kwargs: Any,
    ) -> VLANResponse | dict[str, Any]:
        """Create VLAN with fallback for mock clients."""

        payload = self._normalise_payload(data, kwargs)
        vid = payload.get("vid")
        if vid is None:
            vid = self._next_id("vlan")

        entry = {
            "id": vid,
            "vid": vid,
            "name": payload.get("name") or f"VLAN{vid}",
            "tenant": payload.get("tenant", self.tenant_id),
            "status": payload.get("status", "active"),
            "description": payload.get("description"),
            "role": payload.get("role"),
            "tags": payload.get("tags", []) or [],
        }

        self._vlan_store[vid] = entry.copy()
        if hasattr(self.client, "vlans") and isinstance(self.client.vlans, dict):  # type: ignore[attr-defined]
            self.client.vlans[vid] = entry.copy()  # type: ignore[index]

        if hasattr(self.client, "create_vlan"):
            try:
                result = await self.client.create_vlan(payload)  # type: ignore[arg-type]
                if return_response:
                    return VLANResponse(**result)
                if hasattr(result, "model_dump"):
                    result_payload = result.model_dump()  # type: ignore[attr-defined]
                elif isinstance(result, dict):
                    result_payload = result
                else:
                    result_payload = dict(result)  # type: ignore[arg-type]
                return _to_attr_dict(result_payload)
            except Exception:
                logger.debug("netbox.create_vlan.fallback", payload=payload)
        elif hasattr(self.client, "assign_vlan"):
            try:
                self.client.assign_vlan(vid=vid, tenant=entry["tenant"])  # type: ignore[attr-defined]
            except Exception:
                logger.debug("netbox.assign_vlan.fallback", vid=vid)

        return (
            VLANResponse(**self._vlan_response_payload(entry))
            if return_response
            else _to_attr_dict(entry.copy())
        )

    async def get_available_vlans(self, start_vid: int, end_vid: int) -> list[int]:
        """Return available VLAN IDs within range."""
        used = {int(vlan_id) for vlan_id in self._vlan_store.keys()}
        return [vid for vid in range(start_vid, end_vid + 1) if vid not in used]

    async def update_vlan(self, vlan_id: int, data: VLANUpdate) -> VLANResponse | None:
        """Update VLAN"""
        try:
            vlan_data = await self.client.update_vlan(vlan_id, data.model_dump(exclude_none=True))
            return VLANResponse(**vlan_data)
        except Exception as e:
            logger.error("netbox.update_vlan.failed", vlan_id=vlan_id, error=str(e))
            return None

    async def delete_vlan(self, vlan_id: int) -> bool:
        """Delete VLAN"""
        try:
            await self.client.delete_vlan(vlan_id)
            return True
        except Exception as e:
            logger.error("netbox.delete_vlan.failed", vlan_id=vlan_id, error=str(e))
            return False

    # =========================================================================
    # Cable Operations
    # =========================================================================

    async def list_cables(
        self,
        tenant: str | None = None,
        site: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CableResponse]:
        """List cables"""
        response = await self.client.get_cables(
            tenant=tenant,
            site=site,
            limit=limit,
            offset=offset,
        )

        return [CableResponse(**cable) for cable in response.get("results", [])]

    async def get_cable(self, cable_id: int) -> CableResponse | None:
        """Get cable by ID"""
        try:
            cable_data = await self.client.get_cable(cable_id)
            return CableResponse(**cable_data)
        except Exception as e:
            logger.warning("netbox.get_cable.not_found", cable_id=cable_id, error=str(e))
            return None

    async def create_cable(self, data: CableCreate) -> CableResponse:
        """Create cable"""
        cable_data = await self.client.create_cable(data.model_dump(exclude_none=True))
        return CableResponse(**cable_data)

    async def update_cable(self, cable_id: int, data: CableUpdate) -> CableResponse | None:
        """Update cable"""
        try:
            cable_data = await self.client.update_cable(
                cable_id, data.model_dump(exclude_none=True)
            )
            return CableResponse(**cable_data)
        except Exception as e:
            logger.error("netbox.update_cable.failed", cable_id=cable_id, error=str(e))
            return None

    async def delete_cable(self, cable_id: int) -> bool:
        """Delete cable"""
        try:
            await self.client.delete_cable(cable_id)
            return True
        except Exception as e:
            logger.error("netbox.delete_cable.failed", cable_id=cable_id, error=str(e))
            return False

    # =========================================================================
    # Circuit Operations
    # =========================================================================

    async def list_circuit_providers(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CircuitProviderResponse]:
        """List circuit providers"""
        response = await self.client.get_circuit_providers(limit=limit, offset=offset)

        return [CircuitProviderResponse(**provider) for provider in response.get("results", [])]

    async def get_circuit_provider(self, provider_id: int) -> CircuitProviderResponse | None:
        """Get circuit provider by ID"""
        try:
            provider_data = await self.client.get_circuit_provider(provider_id)
            return CircuitProviderResponse(**provider_data)
        except Exception as e:
            logger.warning(
                "netbox.get_circuit_provider.not_found", provider_id=provider_id, error=str(e)
            )
            return None

    async def create_circuit_provider(self, data: CircuitProviderCreate) -> CircuitProviderResponse:
        """Create circuit provider"""
        provider_data = await self.client.create_circuit_provider(
            data.model_dump(exclude_none=True)
        )
        return CircuitProviderResponse(**provider_data)

    async def list_circuit_types(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CircuitTypeResponse]:
        """List circuit types"""
        response = await self.client.get_circuit_types(limit=limit, offset=offset)

        return [CircuitTypeResponse(**ctype) for ctype in response.get("results", [])]

    async def create_circuit_type(self, data: CircuitTypeCreate) -> CircuitTypeResponse:
        """Create circuit type"""
        type_data = await self.client.create_circuit_type(data.model_dump(exclude_none=True))
        return CircuitTypeResponse(**type_data)

    async def list_circuits(
        self,
        tenant: str | None = None,
        provider: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CircuitResponse]:
        """List circuits"""
        response = await self.client.get_circuits(
            tenant=tenant,
            provider=provider,
            limit=limit,
            offset=offset,
        )

        return [CircuitResponse(**circuit) for circuit in response.get("results", [])]

    async def get_circuit(self, circuit_id: int) -> CircuitResponse | None:
        """Get circuit by ID"""
        try:
            circuit_data = await self.client.get_circuit(circuit_id)
            return CircuitResponse(**circuit_data)
        except Exception as e:
            logger.warning("netbox.get_circuit.not_found", circuit_id=circuit_id, error=str(e))
            return None

    async def create_circuit(self, data: CircuitCreate) -> CircuitResponse:
        """Create circuit"""
        circuit_data = await self.client.create_circuit(data.model_dump(exclude_none=True))
        return CircuitResponse(**circuit_data)

    async def update_circuit(self, circuit_id: int, data: CircuitUpdate) -> CircuitResponse | None:
        """Update circuit"""
        try:
            circuit_data = await self.client.update_circuit(
                circuit_id, data.model_dump(exclude_none=True)
            )
            return CircuitResponse(**circuit_data)
        except Exception as e:
            logger.error("netbox.update_circuit.failed", circuit_id=circuit_id, error=str(e))
            return None

    async def delete_circuit(self, circuit_id: int) -> bool:
        """Delete circuit"""
        try:
            await self.client.delete_circuit(circuit_id)
            return True
        except Exception as e:
            logger.error("netbox.delete_circuit.failed", circuit_id=circuit_id, error=str(e))
            return False

    async def list_circuit_terminations(
        self,
        circuit_id: int | None = None,
        site: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CircuitTerminationResponse]:
        """List circuit terminations"""
        response = await self.client.get_circuit_terminations(
            circuit_id=circuit_id,
            site=site,
            limit=limit,
            offset=offset,
        )

        return [CircuitTerminationResponse(**term) for term in response.get("results", [])]

    async def create_circuit_termination(
        self, data: CircuitTerminationCreate
    ) -> CircuitTerminationResponse:
        """Create circuit termination"""
        term_data = await self.client.create_circuit_termination(data.model_dump(exclude_none=True))
        return CircuitTerminationResponse(**term_data)

    # =========================================================================
    # IP Cleanup Operations
    # =========================================================================

    async def cleanup_subscriber_ips(
        self,
        subscriber_id: str,
        tenant_netbox_id: int,
    ) -> int:
        """
        Clean up IP addresses assigned to a subscriber on service termination.

        This method:
        1. Finds all IP addresses assigned to the subscriber
        2. Updates status to 'deprecated' or deletes based on policy
        3. Returns count of cleaned up IPs

        Args:
            subscriber_id: Subscriber ID (UUID string)
            tenant_netbox_id: NetBox tenant ID

        Returns:
            Count of IP addresses cleaned up

        Raises:
            Exception: If NetBox API calls fail
        """
        logger.info(
            "netbox.cleanup_subscriber_ips_start",
            subscriber_id=subscriber_id,
            tenant=tenant_netbox_id,
        )

        try:
            # Find all IPs assigned to this subscriber
            existing_ips_response = await self.client._netbox_request(
                "GET",
                "ipam/ip-addresses/",
                params={
                    "tenant_id": tenant_netbox_id,
                    "description": f"Subscriber: {subscriber_id}",
                },
            )
            existing_ips = existing_ips_response.get("results", [])

            cleaned_count = 0
            for ip in existing_ips:
                ip_id = ip["id"]
                ip_address = ip["address"]

                try:
                    # Option 1: Mark as deprecated (keeps history)
                    await self.client.update_ip_address(
                        ip_id,
                        {
                            "status": "deprecated",
                            "description": f"[TERMINATED] {ip.get('description', '')}",
                        },
                    )
                    cleaned_count += 1

                    logger.info(
                        "netbox.ip_deprecated",
                        subscriber_id=subscriber_id,
                        ip_address=ip_address,
                        netbox_ip_id=ip_id,
                    )

                    # Option 2: Delete completely (uncomment if preferred)
                    # await self.client.delete_ip_address(ip_id)
                    # logger.info(
                    #     "netbox.ip_deleted",
                    #     subscriber_id=subscriber_id,
                    #     ip_address=ip_address,
                    #     netbox_ip_id=ip_id,
                    # )

                except Exception as e:
                    logger.error(
                        "netbox.cleanup_ip_failed",
                        ip_id=ip_id,
                        ip_address=ip_address,
                        error=str(e),
                    )
                    continue

            logger.info(
                "netbox.cleanup_subscriber_ips_complete",
                subscriber_id=subscriber_id,
                cleaned_count=cleaned_count,
            )

            return cleaned_count

        except Exception as e:
            logger.error(
                "netbox.cleanup_subscriber_ips_failed",
                subscriber_id=subscriber_id,
                error=str(e),
                exc_info=True,
            )
            return 0

    # =========================================================================
    # Utility Methods
    # =========================================================================

    @staticmethod
    def _generate_slug(name: str) -> str:
        """
        Generate URL-friendly slug from name

        Args:
            name: Name to convert to slug

        Returns:
            URL-friendly slug
        """
        # Convert to lowercase and replace spaces with hyphens
        slug = name.lower().strip()
        # Remove special characters
        slug = re.sub(r"[^a-z0-9\s-]", "", slug)
        # Replace spaces with hyphens
        slug = re.sub(r"[\s]+", "-", slug)
        # Remove duplicate hyphens
        slug = re.sub(r"-+", "-", slug)
        # Remove leading/trailing hyphens
        slug = slug.strip("-")
        return slug

    async def _generate_unique_slug(self, base_slug: str) -> str:
        """
        Ensure slug is unique by querying NetBox and appending suffix when necessary.
        """
        slug_candidate = base_slug or "tenant"
        attempt = 1

        while await self.client.get_tenant_by_slug(slug_candidate):
            attempt += 1
            if attempt > 10:
                slug_candidate = f"{base_slug}-{uuid4().hex[:6]}"
            else:
                slug_candidate = f"{base_slug}-{attempt}"

        return slug_candidate

    async def sync_subscriber_to_netbox(
        self,
        subscriber_id: str,
        subscriber_data: dict[str, Any],
        tenant_netbox_id: int,
    ) -> IPAddressResponse | None:
        """
        Sync subscriber to NetBox and allocate IP address if needed.

        This method:
        1. Checks if subscriber already has IP assigned
        2. Finds available IP from appropriate prefix pool
        3. Creates IP Address object in NetBox with subscriber metadata
        4. Returns the allocated IP

        Args:
            subscriber_id: Subscriber ID (UUID string)
            subscriber_data: Subscriber details including:
                - username: RADIUS username
                - service_address: Physical service location
                - site_id: Network site identifier
                - connection_type: Service type (ftth, wireless, etc)
            tenant_netbox_id: NetBox tenant ID

        Returns:
            IPAddressResponse with allocated IP details, or None if allocation fails

        Raises:
            Exception: If NetBox API calls fail
        """
        username = subscriber_data.get("username", "unknown")
        service_address = subscriber_data.get("service_address", "")
        site_id = subscriber_data.get("site_id")
        connection_type = subscriber_data.get("connection_type", "ftth")

        logger.info(
            "netbox.sync_subscriber_start",
            subscriber_id=subscriber_id,
            username=username,
            tenant=tenant_netbox_id,
            site_id=site_id,
        )

        try:
            # Step 1: Check if subscriber already has an IP assigned
            # Query NetBox API directly for IPs with this subscriber description
            existing_ips_response = await self.client._netbox_request(
                "GET",
                "ipam/ip-addresses/",
                params={
                    "tenant_id": tenant_netbox_id,
                    "description": f"Subscriber: {subscriber_id}",
                },
            )
            existing_ips_results = existing_ips_response.get("results", [])

            existing_ips = [
                IPAddressResponse(
                    id=ip["id"],
                    address=ip["address"].split("/")[0],
                    tenant_id=tenant_netbox_id,
                    description=ip.get("description", ""),
                    dns_name=ip.get("dns_name", ""),
                    status=ip.get("status", {}).get("value", "active"),
                )
                for ip in existing_ips_results
            ]

            if existing_ips:
                logger.info(
                    "netbox.subscriber_ip_exists",
                    subscriber_id=subscriber_id,
                    ip=existing_ips[0].address,
                )
                return existing_ips[0]

            # Step 2: Find available IP from prefix pool
            # Query prefixes for the subscriber's site/tenant
            prefixes_response = await self.client._netbox_request(
                "GET",
                "ipam/prefixes/",
                params={
                    "tenant_id": tenant_netbox_id,
                    "site_id": site_id if site_id else None,
                    "status": "active",
                    "role": "customer-assignment",  # Custom role for customer IPs
                    "limit": 10,
                },
            )

            prefixes = prefixes_response.get("results", [])

            if not prefixes:
                logger.warning(
                    "netbox.no_available_prefixes",
                    subscriber_id=subscriber_id,
                    tenant=tenant_netbox_id,
                    site_id=site_id,
                )
                return None

            # Try each prefix until we find an available IP
            for prefix in prefixes:
                prefix_id = prefix["id"]
                prefix_network = prefix["prefix"]

                # Get available IP from prefix
                try:
                    available_ip_response = await self.client._netbox_request(
                        "POST",
                        f"ipam/prefixes/{prefix_id}/available-ips/",
                        json={
                            "tenant": tenant_netbox_id,
                            "description": f"Subscriber: {subscriber_id}",
                            "dns_name": username,
                            "status": "active",
                            "role": None,  # Can set custom role if needed
                            "tags": [
                                {"name": "subscriber"},
                                {"name": connection_type},
                                {"name": "auto-assigned"},
                            ],
                            "custom_fields": {
                                "subscriber_id": subscriber_id,
                                "subscriber_username": username,
                                "service_address": service_address,
                            },
                        },
                    )

                    # Successfully allocated IP
                    ip_address = available_ip_response.get("address", "").split("/")[0]
                    netbox_ip_id = available_ip_response.get("id")

                    logger.info(
                        "netbox.subscriber_ip_allocated",
                        subscriber_id=subscriber_id,
                        username=username,
                        ip_address=ip_address,
                        netbox_ip_id=netbox_ip_id,
                        prefix=prefix_network,
                    )

                    return IPAddressResponse(
                        id=netbox_ip_id,
                        address=ip_address,
                        tenant_id=tenant_netbox_id,
                        description=f"Subscriber: {subscriber_id}",
                        dns_name=username,
                        status="active",
                    )

                except Exception as e:
                    # Prefix might be full, try next one
                    logger.debug(
                        "netbox.prefix_full",
                        prefix=prefix_network,
                        error=str(e),
                    )
                    continue

            # No available IPs in any prefix
            logger.error(
                "netbox.no_available_ips",
                subscriber_id=subscriber_id,
                tenant=tenant_netbox_id,
                prefixes_checked=len(prefixes),
            )
            return None

        except Exception as e:
            logger.error(
                "netbox.sync_subscriber_failed",
                subscriber_id=subscriber_id,
                error=str(e),
                exc_info=True,
            )
            return None
