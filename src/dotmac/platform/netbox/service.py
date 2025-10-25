"""
NetBox Service Layer

Business logic for NetBox IPAM and DCIM operations.
"""

import re
from uuid import uuid4
from typing import Any

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
    NetBoxHealthResponse,
    PrefixCreate,
    PrefixResponse,
    SiteCreate,
    SiteResponse,
    TenantCreate,
    VLANCreate,
    VLANResponse,
    VLANUpdate,
    VRFCreate,
    VRFResponse,
)

logger = structlog.get_logger(__name__)


class NetBoxService:
    """Service for NetBox IPAM and DCIM operations"""

    def __init__(
        self,
        client: NetBoxClient | None = None,
        tenant_id: str | None = None,
    ):
        """
        Initialize NetBox service

        Args:
            client: NetBox client instance (creates new if not provided)
            tenant_id: Tenant ID for multi-tenancy support
        """
        self.client = client or NetBoxClient(tenant_id=tenant_id)
        self.tenant_id = tenant_id

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

    async def create_prefix(self, data: PrefixCreate) -> PrefixResponse:
        """Create IP prefix"""
        prefix_data = await self.client.create_prefix(data.model_dump(exclude_none=True))
        return PrefixResponse(**prefix_data)

    async def get_available_ips(self, prefix_id: int, limit: int = 10) -> list[str]:
        """Get available IP addresses in a prefix"""
        ips = await self.client.get_available_ips(prefix_id, limit)
        return [ip.get("address", "") for ip in ips]

    async def allocate_ip(self, request: IPAllocationRequest) -> IPAddressResponse | None:
        """Allocate next available IP from prefix"""
        try:
            data = {
                "description": request.description,
                "dns_name": request.dns_name,
                "tenant": request.tenant,
            }
            # Remove None values
            data = {k: v for k, v in data.items() if v is not None}

            ip_data = await self.client.allocate_ip(request.prefix_id, data)
            return IPAddressResponse(**ip_data)
        except Exception as e:
            logger.error(
                "netbox.allocate_ip.failed",
                prefix_id=request.prefix_id,
                error=str(e),
            )
            return None

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

    async def create_interface(self, data: InterfaceCreate) -> InterfaceResponse:
        """Create interface"""
        interface_data = await self.client.create_interface(data.model_dump(exclude_none=True))
        return InterfaceResponse(**interface_data)

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

    async def create_vlan(self, data: VLANCreate) -> VLANResponse:
        """Create VLAN"""
        vlan_data = await self.client.create_vlan(data.model_dump(exclude_none=True))
        return VLANResponse(**vlan_data)

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
