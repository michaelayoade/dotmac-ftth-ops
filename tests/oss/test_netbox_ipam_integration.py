"""
Comprehensive NetBox IPAM Operations Tests.

Tests complete IPAM workflows including:
- IP address allocation and management
- Prefix management and hierarchies
- VLAN assignment and tracking
- Device interface configuration
- Integration with service provisioning
- IP address reclamation
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest


@pytest.mark.asyncio
class TestNetBoxIPAddressManagement:
    """Test IP address allocation and management."""

    async def test_allocate_ip_from_pool(
        self, async_session, test_tenant_id, mock_netbox_client, sample_prefix_allocation
    ):
        """Test allocating IP address from prefix pool."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create prefix pool
        prefix = await service.create_prefix(**sample_prefix_allocation)

        # Allocate IP from pool
        allocation_request = IPAllocationRequest(
            prefix_id=prefix["id"] if isinstance(prefix, dict) else prefix.id,
            tenant=test_tenant_id,
            role="customer",
            description="Customer fiber connection",
        )

        ip_allocation = await service.allocate_ip(allocation_request)

        assert ip_allocation["address"] is not None
        assert ip_allocation["tenant"] == test_tenant_id
        assert ip_allocation["status"] == "active"
        assert ip_allocation["role"] == "customer"

    async def test_allocate_specific_ip(
        self, async_session, test_tenant_id, mock_netbox_client, sample_ip_allocation
    ):
        """Test allocating specific IP address."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Request specific IP
        allocation_request = IPAllocationRequest(
            address="10.0.1.100/32",
            tenant=test_tenant_id,
            role="customer",
            dns_name="cust001.isp.com",
            description="Customer static IP",
        )

        ip_allocation = await service.allocate_ip(allocation_request)

        assert ip_allocation["address"] == "10.0.1.100/32"
        assert ip_allocation["dns_name"] == "cust001.isp.com"

    async def test_update_ip_metadata(
        self, async_session, test_tenant_id, mock_netbox_client, sample_ip_allocation
    ):
        """Test updating IP address metadata."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest, IPUpdateRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Allocate IP
        allocation_request = IPAllocationRequest(
            address="10.0.1.100/32",
            tenant=test_tenant_id,
        )
        ip_allocation = await service.allocate_ip(allocation_request)

        # Update metadata
        update_request = IPUpdateRequest(
            dns_name="updated-cust001.isp.com",
            description="Updated customer description",
            tags=["fiber", "premium"],
        )

        updated_ip = await service.update_ip(
            ip_id=ip_allocation["id"], data=update_request
        )

        assert updated_ip["dns_name"] == "updated-cust001.isp.com"
        assert "premium" in updated_ip.get("tags", [])

    async def test_release_ip_address(
        self, async_session, test_tenant_id, mock_netbox_client
    ):
        """Test releasing IP address back to pool."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Allocate IP
        allocation_request = IPAllocationRequest(
            address="10.0.1.100/32",
            tenant=test_tenant_id,
        )
        ip_allocation = await service.allocate_ip(allocation_request)

        # Release IP
        released = await service.release_ip(ip_id=ip_allocation["id"])

        assert released is True

        # Verify IP is available for reallocation
        # In production, status would be set to "available" or "deprecated"

    async def test_bulk_ip_allocation(
        self, async_session, test_tenant_id, mock_netbox_client, sample_prefix_allocation
    ):
        """Test allocating multiple IPs at once."""
        from dotmac.platform.netbox.schemas import BulkIPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create prefix pool
        prefix = await service.create_prefix(**sample_prefix_allocation)

        # Bulk allocate
        bulk_request = BulkIPAllocationRequest(
            prefix_id=prefix["id"] if isinstance(prefix, dict) else prefix.id,
            count=10,
            tenant=test_tenant_id,
            role="customer",
        )

        allocated_ips = await service.bulk_allocate_ips(bulk_request)

        assert len(allocated_ips) == 10
        assert all(ip["tenant"] == test_tenant_id for ip in allocated_ips)


@pytest.mark.asyncio
class TestNetBoxPrefixManagement:
    """Test prefix allocation and management."""

    async def test_create_prefix_pool(
        self, async_session, test_tenant_id, mock_netbox_client, sample_prefix_allocation
    ):
        """Test creating new prefix pool."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        prefix = await service.create_prefix(**sample_prefix_allocation)

        assert prefix["prefix"] == "10.0.0.0/24"
        assert prefix["tenant"] == test_tenant_id
        assert prefix["is_pool"] is True
        assert prefix["status"] == "active"

    async def test_get_available_prefixes(
        self, async_session, test_tenant_id, mock_netbox_client
    ):
        """Test retrieving available prefixes from parent."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create parent prefix
        parent_prefix = await service.create_prefix(
            prefix="10.0.0.0/16",
            tenant=test_tenant_id,
            is_pool=True,
        )

        # Get available /24 subnets
        available = await service.get_available_prefixes(
            parent_prefix_id=parent_prefix["id"],
            prefix_length=24,
        )

        assert len(available) > 0
        assert all(prefix.endswith("/24") for prefix in available)

    async def test_allocate_prefix_from_parent(
        self, async_session, test_tenant_id, mock_netbox_client
    ):
        """Test allocating child prefix from parent."""
        from dotmac.platform.netbox.schemas import PrefixAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create parent prefix
        parent_prefix = await service.create_prefix(
            prefix="10.0.0.0/16",
            tenant=test_tenant_id,
            is_pool=True,
        )

        # Allocate child prefix
        allocation_request = PrefixAllocationRequest(
            parent_prefix_id=parent_prefix["id"],
            prefix_length=24,
            tenant=test_tenant_id,
            description="Customer subnet",
        )

        child_prefix = await service.allocate_prefix(allocation_request)

        assert "/24" in child_prefix["prefix"]
        assert child_prefix["tenant"] == test_tenant_id

    async def test_prefix_utilization_tracking(
        self, async_session, test_tenant_id, mock_netbox_client, sample_prefix_allocation
    ):
        """Test tracking prefix utilization."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create prefix pool (10.0.0.0/24 = 256 addresses)
        prefix = await service.create_prefix(**sample_prefix_allocation)

        # Allocate some IPs
        for i in range(50):
            allocation_request = IPAllocationRequest(
                prefix_id=prefix["id"] if isinstance(prefix, dict) else prefix.id,
                tenant=test_tenant_id,
            )
            await service.allocate_ip(allocation_request)

        # Check utilization
        utilization = await service.get_prefix_utilization(
            prefix_id=prefix["id"] if isinstance(prefix, dict) else prefix.id
        )

        assert utilization["total_ips"] == 256
        assert utilization["allocated_ips"] >= 50
        assert utilization["available_ips"] <= 206
        assert 0 <= utilization["utilization_percent"] <= 100


@pytest.mark.asyncio
class TestNetBoxVLANManagement:
    """Test VLAN assignment and management."""

    async def test_create_vlan(
        self, async_session, test_tenant_id, mock_netbox_client, sample_vlan_assignment
    ):
        """Test creating VLAN."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        vlan = await service.create_vlan(**sample_vlan_assignment)

        assert vlan["vid"] == 100
        assert vlan["name"] == "VLAN100-Customers"
        assert vlan["tenant"] == test_tenant_id
        assert vlan["status"] == "active"

    async def test_assign_vlan_to_interface(
        self, async_session, test_tenant_id, mock_netbox_client, sample_vlan_assignment, sample_device_interface
    ):
        """Test assigning VLAN to device interface."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create VLAN
        vlan = await service.create_vlan(**sample_vlan_assignment)

        # Create interface and assign VLAN
        interface = await service.create_interface(**sample_device_interface)

        assigned_interface = await service.assign_vlan_to_interface(
            interface_id=interface["id"],
            vlan_id=vlan["id"],
            mode="access",
        )

        assert assigned_interface["untagged_vlan"] == vlan["id"]
        assert assigned_interface["mode"] == "access"

    async def test_get_available_vlans(
        self, async_session, test_tenant_id, mock_netbox_client
    ):
        """Test getting available VLAN IDs."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create some VLANs
        for vid in [100, 200, 300]:
            await service.create_vlan(
                vid=vid,
                name=f"VLAN{vid}",
                tenant=test_tenant_id,
                status="active",
            )

        # Get available VLANs in range
        available = await service.get_available_vlans(start_vid=1, end_vid=400)

        assert 100 not in available
        assert 200 not in available
        assert 300 not in available
        assert len(available) > 0  # Should have other VLANs available


@pytest.mark.asyncio
class TestNetBoxDeviceInterfaces:
    """Test device interface configuration."""

    async def test_create_device_interface(
        self, async_session, test_tenant_id, mock_netbox_client, sample_device_interface
    ):
        """Test creating device interface."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        interface = await service.create_interface(**sample_device_interface)

        assert interface["device"] == "olt-01"
        assert interface["name"] == "eth1/1/1"
        assert interface["type"] == "1000base-x-sfp"
        assert interface["enabled"] is True

    async def test_assign_ip_to_interface(
        self, async_session, test_tenant_id, mock_netbox_client, sample_device_interface
    ):
        """Test assigning IP address to interface."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create interface
        interface = await service.create_interface(**sample_device_interface)

        # Allocate and assign IP
        allocation_request = IPAllocationRequest(
            address="10.0.1.1/24",
            tenant=test_tenant_id,
            interface_id=interface["id"],
        )

        ip_allocation = await service.allocate_ip(allocation_request)

        assert ip_allocation["interface_id"] == interface["id"]
        assert ip_allocation["address"] == "10.0.1.1/24"

    async def test_configure_interface_for_customer(
        self, async_session, test_tenant_id, mock_netbox_client, sample_device_interface, sample_vlan_assignment
    ):
        """Test complete interface configuration for customer."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create VLAN
        vlan = await service.create_vlan(**sample_vlan_assignment)

        # Create and configure interface
        interface = await service.create_interface(**sample_device_interface)

        # Assign VLAN
        configured_interface = await service.assign_vlan_to_interface(
            interface_id=interface["id"],
            vlan_id=vlan["id"],
            mode="access",
        )

        # Update description
        updated_interface = await service.update_interface(
            interface_id=interface["id"],
            description="Customer 001 - Fiber ONT",
            enabled=True,
        )

        assert updated_interface["description"] == "Customer 001 - Fiber ONT"
        assert updated_interface["untagged_vlan"] == vlan["id"]


@pytest.mark.asyncio
class TestNetBoxServiceIntegration:
    """Test NetBox integration with service provisioning."""

    async def test_provision_network_resources_for_service(
        self,
        async_session,
        test_tenant_id,
        mock_netbox_client,
        sample_service_provisioning_request,
        sample_prefix_allocation,
        sample_vlan_assignment,
    ):
        """Test provisioning complete network resources for new service."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Step 1: Create/verify prefix pool
        prefix = await service.create_prefix(**sample_prefix_allocation)

        # Step 2: Create/assign VLAN
        vlan = await service.create_vlan(**sample_vlan_assignment)

        # Step 3: Allocate IP address
        ip_request = IPAllocationRequest(
            prefix_id=prefix["id"] if isinstance(prefix, dict) else prefix.id,
            tenant=test_tenant_id,
            role="customer",
            dns_name=f"cust-{sample_service_provisioning_request['subscription_id']}.isp.com",
            description=f"Fiber service - {sample_service_provisioning_request['service_name']}",
            tags=["fiber", "auto-provisioned"],
        )

        ip_allocation = await service.allocate_ip(ip_request)

        # Verify complete network configuration
        assert ip_allocation["address"] is not None
        assert ip_allocation["tenant"] == test_tenant_id
        assert vlan["vid"] == sample_service_provisioning_request["vlan_id"]

        # Return network config for service activation
        network_config = {
            "ip_address": ip_allocation["address"].split("/")[0],
            "subnet_mask": "255.255.255.0",  # From /24
            "gateway": "10.0.0.1",
            "vlan_id": vlan["vid"],
            "dns_servers": ["8.8.8.8", "8.8.4.4"],
        }

        assert network_config["ip_address"] is not None
        assert network_config["vlan_id"] == 100

    async def test_reclaim_network_resources_on_termination(
        self, async_session, test_tenant_id, mock_netbox_client
    ):
        """Test reclaiming network resources when service is terminated."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Allocate resources
        ip_request = IPAllocationRequest(
            address="10.0.1.100/32",
            tenant=test_tenant_id,
            role="customer",
        )
        ip_allocation = await service.allocate_ip(ip_request)

        # Terminate service - reclaim IP
        reclaimed = await service.release_ip(ip_id=ip_allocation["id"])
        assert reclaimed is True

        # Verify IP is available for reuse
        # In production, would mark as "available" or move to reclamation queue

    async def test_track_network_resource_lifecycle(
        self, async_session, test_tenant_id, mock_netbox_client
    ):
        """Test tracking complete lifecycle of network resources."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest, IPUpdateRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Allocate IP
        ip_request = IPAllocationRequest(
            address="10.0.1.100/32",
            tenant=test_tenant_id,
            status="reserved",  # Initially reserved
        )
        ip_allocation = await service.allocate_ip(ip_request)

        # Activate (service provisioning complete)
        update_request = IPUpdateRequest(status="active")
        activated_ip = await service.update_ip(
            ip_id=ip_allocation["id"],
            data=update_request,
        )
        assert activated_ip["status"] == "active"

        # Suspend (service suspended)
        update_request = IPUpdateRequest(status="reserved")
        suspended_ip = await service.update_ip(
            ip_id=ip_allocation["id"],
            data=update_request,
        )
        assert suspended_ip["status"] == "reserved"

        # Release (service terminated)
        released = await service.release_ip(ip_id=ip_allocation["id"])
        assert released is True


@pytest.mark.asyncio
class TestNetBoxReporting:
    """Test NetBox reporting and analytics."""

    async def test_get_ip_utilization_report(
        self, async_session, test_tenant_id, mock_netbox_client, sample_prefix_allocation
    ):
        """Test generating IP utilization report."""
        from dotmac.platform.netbox.schemas import IPAllocationRequest
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create prefix and allocate some IPs
        prefix = await service.create_prefix(**sample_prefix_allocation)

        for i in range(25):
            ip_request = IPAllocationRequest(
                prefix_id=prefix["id"] if isinstance(prefix, dict) else prefix.id,
                tenant=test_tenant_id,
            )
            await service.allocate_ip(ip_request)

        # Get utilization report
        report = await service.get_ip_utilization_report(tenant_id=test_tenant_id)

        assert report["total_prefixes"] >= 1
        assert report["total_allocated_ips"] >= 25
        assert report["overall_utilization_percent"] >= 0

    async def test_get_vlan_usage_report(
        self, async_session, test_tenant_id, mock_netbox_client
    ):
        """Test generating VLAN usage report."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create multiple VLANs
        for vid in range(100, 110):
            await service.create_vlan(
                vid=vid,
                name=f"VLAN{vid}",
                tenant=test_tenant_id,
                status="active",
            )

        # Get VLAN usage report
        report = await service.get_vlan_usage_report(tenant_id=test_tenant_id)

        assert report["total_vlans"] >= 10
        assert report["active_vlans"] >= 10

    async def test_get_interface_status_report(
        self, async_session, test_tenant_id, mock_netbox_client
    ):
        """Test generating device interface status report."""
        from dotmac.platform.netbox.service import NetBoxService

        service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create interfaces
        for i in range(10):
            await service.create_interface(
                device="olt-01",
                name=f"eth1/1/{i+1}",
                type="1000base-x-sfp",
                enabled=i < 7,  # 7 enabled, 3 disabled
            )

        # Get status report
        report = await service.get_interface_status_report(device_name="olt-01")

        assert report["total_interfaces"] >= 10
        assert report["enabled_interfaces"] >= 7
        assert report["disabled_interfaces"] >= 3
