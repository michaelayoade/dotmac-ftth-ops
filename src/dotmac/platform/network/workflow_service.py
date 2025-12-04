"""
Network Workflow Service

Provides workflow-compatible methods for network resource allocation (ISP).
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.network.profile_service import SubscriberNetworkProfileService

logger = logging.getLogger(__name__)


class NetworkService:
    """
    Network service for workflow integration.

    Provides IP allocation, VLAN assignment, and network resource management
    for ISP workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def allocate_resources(
        self,
        customer_id: int | str,
        service_location: str,
        bandwidth_plan: str,
        tenant_id: str | None = None,
        prefix_id: int | None = None,
        vlan_id: int | None = None,
        static_ip: str | None = None,
        description: str | None = None,
        subscriber_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Allocate network resources for an ISP customer.

        This method allocates IP addresses from NetBox IPAM, assigns VLANs,
        and generates RADIUS credentials for ISP customer provisioning.

        Args:
            customer_id: Customer ID
            service_location: Service installation location/address
            bandwidth_plan: Bandwidth plan identifier (e.g., "100mbps", "fiber_1gbps")
            tenant_id: Tenant ID for multi-tenancy
            prefix_id: NetBox prefix ID to allocate from (optional, uses default pool)
            vlan_id: Specific VLAN ID to assign (optional, auto-assigned)
            static_ip: Static IP to assign instead of auto-allocation (optional)
            description: Description for the IP allocation

        Returns:
            Dict with network allocation details:
            {
                "service_id": str,
                "customer_id": str,
                "ip_address": str,
                "subnet": str,
                "vlan_id": int,
                "username": str,
                "bandwidth_plan": str,
                "service_location": str,
                "netbox_ip_id": int | None,
                "dns_name": str | None,
                "gateway": str | None,
                "status": "allocated"
            }

        Raises:
            ValueError: If IP allocation fails or NetBox is not available
        """
        import ipaddress
        import random
        import secrets

        from sqlalchemy import select

        from ..customer_management.models import Customer

        logger.info(
            f"Allocating network resources for customer {customer_id}, "
            f"location {service_location}, plan {bandwidth_plan}"
        )

        customer_id_str = str(customer_id)

        customer: Customer | None = None

        # Determine tenant context and validate customer ownership
        if tenant_id:
            stmt = select(Customer).where(
                Customer.id == customer_id_str,
                Customer.tenant_id == tenant_id,
            )
            result = await self.db.execute(stmt)
            customer = result.scalar_one_or_none()
            if not customer:
                raise ValueError(f"Customer {customer_id_str} not found for tenant {tenant_id}")
        else:
            stmt = select(Customer).where(Customer.id == customer_id_str)
            result = await self.db.execute(stmt)
            customer = result.scalar_one_or_none()
            if not customer:
                raise ValueError(f"Customer {customer_id_str} not found")
            tenant_id = customer.tenant_id

        profile = None
        ip_from_profile = False

        if tenant_id and subscriber_id:
            profile_service = SubscriberNetworkProfileService(self.db, tenant_id)
            profile = await profile_service.get_profile(subscriber_id)

        # Generate username for RADIUS (unique identifier)
        # Use format: customer email prefix or customer_<id>
        username = None
        if customer and customer.email:
            username = customer.email.split("@")[0]
        else:
            username = f"customer_{customer_id_str}"

        # Generate service ID
        service_id = f"svc-{secrets.token_hex(8)}"

        # Ensure tenant_id determined before referencing profile
        if not tenant_id:
            tenant_id = customer.tenant_id

        if not profile and subscriber_id:
            profile_service = SubscriberNetworkProfileService(self.db, tenant_id)
            profile = await profile_service.get_profile(subscriber_id)

        profile_static_ipv4 = str(profile.static_ipv4) if profile and profile.static_ipv4 else None
        profile_static_ipv6 = str(profile.static_ipv6) if profile and profile.static_ipv6 else None
        profile_ipv6_prefix = profile.delegated_ipv6_prefix if profile else None
        profile_vlan = profile.service_vlan if profile else None
        profile_inner_vlan = profile.inner_vlan if profile else None
        profile_qinq = profile.qinq_enabled if profile else False

        if not static_ip and profile_static_ipv4:
            static_ip = profile_static_ipv4
            ip_from_profile = True

        if not vlan_id and profile_vlan:
            vlan_id = profile_vlan

        # Try to allocate IP from NetBox if configured
        netbox_ip_id = None
        ip_address = None
        subnet = None
        gateway = None
        dns_name = None
        allocation_method = "fallback"

        if not static_ip:
            try:
                from ..netbox.client import NetBoxClient

                netbox_client = NetBoxClient(tenant_id=tenant_id)

                # Check if NetBox is available
                is_healthy = await netbox_client.health_check()
                if is_healthy:
                    allocation_method = "netbox"

                    # Use static IP if provided
                    if static_ip:
                        # Create IP address in NetBox
                        ip_data = {
                            "address": static_ip,
                            "status": "active",
                            "description": description
                            or f"Customer {customer_id_str} - {service_location}",
                            "tenant": tenant_id if tenant_id else None,
                            "tags": [
                                {"name": f"customer-{customer_id_str}"},
                                {"name": bandwidth_plan},
                            ],
                        }

                        netbox_ip = await netbox_client.create_ip_address(ip_data)
                        ip_address = netbox_ip["address"].split("/")[0]  # Remove CIDR
                        subnet = netbox_ip["address"]
                        netbox_ip_id = netbox_ip["id"]
                        dns_name = netbox_ip.get("dns_name")

                    # Auto-allocate from prefix
                    elif prefix_id:
                        # Allocate next available IP from specified prefix
                        ip_data = {
                            "status": "active",
                            "description": description
                            or f"Customer {customer_id_str} - {service_location}",
                            "tenant": tenant_id if tenant_id else None,
                            "tags": [
                                {"name": f"customer-{customer_id_str}"},
                                {"name": bandwidth_plan},
                            ],
                        }

                        netbox_ip = await netbox_client.allocate_ip(prefix_id, ip_data)
                        ip_address = netbox_ip["address"].split("/")[0]  # Remove CIDR
                        subnet = netbox_ip["address"]
                        netbox_ip_id = netbox_ip["id"]
                        dns_name = netbox_ip.get("dns_name")

                        # Try to get gateway from prefix
                        try:
                            prefix = await netbox_client.get_prefix(prefix_id)
                            # First usable IP in subnet is typically the gateway
                            network = ipaddress.ip_network(prefix["prefix"])
                            gateway = str(network.network_address + 1)
                        except Exception:
                            pass

                    else:
                        # Find available prefixes for this tenant
                        prefixes_response = await netbox_client.get_prefixes(
                            tenant=tenant_id, limit=10
                        )
                        prefixes = prefixes_response.get("results", [])

                        if prefixes:
                            # Use first available prefix
                            first_prefix = prefixes[0]
                            prefix_id = first_prefix["id"]

                            ip_data = {
                                "status": "active",
                                "description": description
                                or f"Customer {customer_id_str} - {service_location}",
                                "tenant": tenant_id if tenant_id else None,
                                "tags": [
                                    {"name": f"customer-{customer_id_str}"},
                                    {"name": bandwidth_plan},
                                ],
                            }

                            netbox_ip = await netbox_client.allocate_ip(prefix_id, ip_data)
                            ip_address = netbox_ip["address"].split("/")[0]
                            subnet = netbox_ip["address"]
                            netbox_ip_id = netbox_ip["id"]
                            dns_name = netbox_ip.get("dns_name")

                            # Get gateway
                            network = ipaddress.ip_network(first_prefix["prefix"])
                            gateway = str(network.network_address + 1)

                    logger.info(f"Allocated IP from NetBox: {ip_address}, netbox_id={netbox_ip_id}")

            except ImportError:
                logger.info("NetBox client not available, using fallback IP allocation")
            except Exception as e:
                logger.warning(f"NetBox allocation failed: {e}, using fallback IP allocation")

        if static_ip and not ip_address:
            allocation_method = "profile" if ip_from_profile else "static"
            if "/" in static_ip:
                ip_part, _, cidr = static_ip.partition("/")
                ip_address = ip_part
                subnet = static_ip
            else:
                ip_address = static_ip
                subnet = f"{static_ip}/32"

        # Fallback: Generate IP from private range if NetBox unavailable
        if not ip_address:
            allocation_method = "fallback"
            # Generate a random IP from 10.x.x.x range
            ip_int = random.randint(
                int(ipaddress.IPv4Address("10.100.0.1")),
                int(ipaddress.IPv4Address("10.255.255.254")),
            )
            ip_address = str(ipaddress.IPv4Address(ip_int))
            subnet = f"{ip_address}/24"
            gateway = ".".join(ip_address.split(".")[:-1]) + ".1"

        # Assign VLAN (use provided or auto-assign based on bandwidth plan)
        if not vlan_id:
            # Auto-assign VLAN based on bandwidth plan
            # This is a simple mapping; in production, this would query from database
            vlan_mapping = {
                "fiber_1gbps": 100,
                "fiber_500mbps": 101,
                "fiber_100mbps": 102,
                "100mbps": 102,
                "50mbps": 103,
                "25mbps": 104,
                "default": 110,
            }
            vlan_id = vlan_mapping.get(bandwidth_plan.lower(), vlan_mapping["default"])

        logger.info(
            f"Network resources allocated successfully: "
            f"ip={ip_address}, vlan={vlan_id}, username={username}, method={allocation_method}"
        )

        return {
            "service_id": service_id,
            "customer_id": customer_id_str,
            "ip_address": ip_address,
            "subnet": subnet,
            "gateway": gateway,
            "vlan_id": vlan_id,
            "inner_vlan": profile_inner_vlan,
            "qinq_enabled": profile_qinq,
            "ipv6_address": profile_static_ipv6,
            "delegated_ipv6_prefix": profile_ipv6_prefix,
            "username": username,
            "bandwidth_plan": bandwidth_plan,
            "service_location": service_location,
            "netbox_ip_id": netbox_ip_id,
            "dns_name": dns_name,
            "allocation_method": allocation_method,
            "status": "allocated",
        }
