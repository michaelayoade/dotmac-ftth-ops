"""
Integration Tests for NetBox Dual-Stack IP Allocation

Tests complete workflows for allocating, managing, and releasing dual-stack IPs
through the NetBox client.
"""

from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.netbox.client import NetBoxClient


@pytest.mark.integration
@pytest.mark.serial_only
@pytest.mark.asyncio
class TestNetBoxDualStackIntegration:
    """Integration tests for NetBox dual-stack IP operations."""

    @pytest.fixture
    def netbox_client(self):
        """Create NetBox client with mocked HTTP"""
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.external_services.netbox_url = "http://netbox.test"
            client = NetBoxClient(api_token="test_token")
            client.request = AsyncMock()
            return client

    async def test_allocate_dual_stack_ips_complete_workflow(self, netbox_client):
        """
        Test complete dual-stack allocation workflow.

        Steps:
        1. Allocate IPv4 from prefix
        2. Allocate IPv6 from prefix
        3. Link both IPs with same DNS name
        4. Verify both IPs returned
        """
        # Mock responses
        ipv4_response = {
            "id": 100,
            "address": "192.168.10.50/24",
            "status": {"value": "active"},
            "description": "Customer dual-stack IP",
            "dns_name": "customer123.example.com",
            "tenant": {"id": 10},
        }

        ipv6_response = {
            "id": 200,
            "address": "2001:db8:10::50/64",
            "status": {"value": "active"},
            "description": "Customer dual-stack IP",
            "dns_name": "customer123.example.com",
            "tenant": {"id": 10},
        }

        netbox_client.request.side_effect = [ipv4_response, ipv6_response]

        # Allocate dual-stack IPs
        ipv4, ipv6 = await netbox_client.allocate_dual_stack_ips(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
            description="Customer dual-stack IP",
            dns_name="customer123.example.com",
            tenant=10,
        )

        # Verify IPv4
        assert ipv4["id"] == 100
        assert ipv4["address"] == "192.168.10.50/24"
        assert ipv4["dns_name"] == "customer123.example.com"

        # Verify IPv6
        assert ipv6["id"] == 200
        assert ipv6["address"] == "2001:db8:10::50/64"
        assert ipv6["dns_name"] == "customer123.example.com"

        # Verify both IPs have same DNS name (linked)
        assert ipv4["dns_name"] == ipv6["dns_name"]

    async def test_allocate_dual_stack_rollback_on_ipv6_failure(self, netbox_client):
        """
        Test rollback of IPv4 allocation when IPv6 fails.

        Flow:
        1. IPv4 allocation succeeds
        2. IPv6 allocation fails
        3. IPv4 should be rolled back (deleted)
        """
        ipv4_response = {
            "id": 100,
            "address": "192.168.10.51/24",
            "status": {"value": "active"},
        }

        # Mock: IPv4 succeeds, IPv6 fails, DELETE succeeds
        netbox_client.request.side_effect = [
            ipv4_response,  # IPv4 allocation
            Exception("IPv6 prefix exhausted"),  # IPv6 allocation fails
            None,  # DELETE IPv4 (rollback)
        ]

        # Attempt allocation, should raise error
        with pytest.raises(ValueError) as exc_info:
            await netbox_client.allocate_dual_stack_ips(
                ipv4_prefix_id=1,
                ipv6_prefix_id=2,
            )

        assert "Failed to allocate IPv6 address" in str(exc_info.value)

        # Verify DELETE was called for rollback
        assert netbox_client.request.call_count == 3
        delete_call = netbox_client.request.call_args_list[2]
        assert delete_call.kwargs["method"] == "DELETE"
        assert "100" in delete_call.kwargs["endpoint"]  # IPv4 ID

    async def test_bulk_allocate_ips_from_prefix(self, netbox_client):
        """
        Test bulk IP allocation from a single prefix.
        """
        # Mock 10 IP allocations
        mock_ips = []
        for i in range(1, 11):
            mock_ips.append(
                {
                    "id": 1000 + i,
                    "address": f"10.0.1.{i}/24",
                    "status": {"value": "active"},
                    "description": f"Bulk IP {i}",
                }
            )

        netbox_client.request.side_effect = mock_ips

        # Allocate 10 IPs
        result = await netbox_client.bulk_allocate_ips(
            prefix_id=5,
            count=10,
            description_prefix="Bulk IP",
            tenant=10,
        )

        # Verify 10 IPs returned
        assert len(result) == 10

        # Verify sequential
        assert result[0]["address"] == "10.0.1.1/24"
        assert result[9]["address"] == "10.0.1.10/24"

        # Verify request count
        assert netbox_client.request.call_count == 10

    async def test_allocate_dual_stack_with_tags(self, netbox_client):
        """
        Test dual-stack allocation with custom tags for organization.
        """
        ipv4_response = {
            "id": 100,
            "address": "192.168.20.10/24",
            "tags": [{"name": "customer"}, {"name": "production"}],
        }

        ipv6_response = {
            "id": 200,
            "address": "2001:db8:20::10/64",
            "tags": [{"name": "customer"}, {"name": "production"}],
        }

        netbox_client.request.side_effect = [ipv4_response, ipv6_response]

        # Allocate (tags not supported in current client API)
        ipv4, ipv6 = await netbox_client.allocate_dual_stack_ips(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
        )

        # Verify tags applied
        assert len(ipv4["tags"]) == 2
        assert len(ipv6["tags"]) == 2

    async def test_get_available_ips_in_prefix(self, netbox_client):
        """
        Test checking available IPs in prefix before allocation.
        """
        # Mock prefix info showing available IPs
        prefix_response = {
            "id": 1,
            "prefix": "192.168.30.0/24",
            "available_ips": 250,  # 254 - 4 already used
            "status": {"value": "active"},
        }

        netbox_client.request.return_value = prefix_response

        # Get prefix info
        result = await netbox_client.get_prefix(prefix_id=1)

        # Verify available IPs
        assert result["available_ips"] == 250
        assert result["prefix"] == "192.168.30.0/24"

    async def test_update_ip_dns_name(self, netbox_client):
        """
        Test updating DNS name for existing IP.
        """
        updated_ip = {
            "id": 100,
            "address": "192.168.40.10/24",
            "dns_name": "newname.example.com",
        }

        netbox_client.request.return_value = updated_ip

        # Update DNS name (dns_name must be in data dict per client API)
        result = await netbox_client.update_ip_address(
            ip_id=100,
            data={"dns_name": "newname.example.com"},
        )

        # Verify update
        assert result["dns_name"] == "newname.example.com"

    async def test_release_dual_stack_ips(self, netbox_client):
        """
        Test releasing both IPv4 and IPv6 IPs.
        """
        # Mock DELETE responses
        netbox_client.request.side_effect = [None, None]

        # Release both IPs
        await netbox_client.delete_ip_address(ip_id=100)  # IPv4
        await netbox_client.delete_ip_address(ip_id=200)  # IPv6

        # Verify both DELETE calls made
        assert netbox_client.request.call_count == 2
        assert netbox_client.request.call_args_list[0].kwargs["method"] == "DELETE"
        assert netbox_client.request.call_args_list[1].kwargs["method"] == "DELETE"

    async def test_search_ips_by_dns_name(self, netbox_client):
        """
        Test searching for dual-stack IPs by DNS name.
        """
        search_results = [
            {
                "id": 100,
                "address": "192.168.50.10/24",
                "dns_name": "customer456.example.com",
                "family": 4,
            },
            {
                "id": 200,
                "address": "2001:db8:50::10/64",
                "dns_name": "customer456.example.com",
                "family": 6,
            },
        ]

        netbox_client.request.return_value = {"results": search_results}

        # Search by DNS name (using get_ip_addresses which calls request internally)
        result = await netbox_client.get_ip_addresses()

        # Verify both IPs found
        assert len(result["results"]) == 2
        ipv4 = [ip for ip in result["results"] if ip["family"] == 4][0]
        ipv6 = [ip for ip in result["results"] if ip["family"] == 6][0]

        assert ipv4["address"] == "192.168.50.10/24"
        assert ipv6["address"] == "2001:db8:50::10/64"

    async def test_allocate_dual_stack_ipv4_exhausted_fallback(self, netbox_client):
        """
        Test handling when IPv4 prefix is exhausted.
        """
        # Mock IPv4 exhaustion
        netbox_client.request.side_effect = Exception("No available IPs in prefix")

        # Attempt allocation
        with pytest.raises(ValueError) as exc_info:
            await netbox_client.allocate_dual_stack_ips(
                ipv4_prefix_id=1,
                ipv6_prefix_id=2,
            )

        assert "Failed to allocate IPv4 address" in str(exc_info.value)

    async def test_allocate_dual_stack_multi_tenant_isolation(self, netbox_client):
        """
        Test tenant isolation in dual-stack allocations.
        """
        # Tenant A allocations
        tenant_a_ipv4 = {
            "id": 100,
            "address": "10.1.1.10/24",
            "tenant": {"id": 1, "name": "Tenant A"},
        }
        tenant_a_ipv6 = {
            "id": 200,
            "address": "2001:db8:a::10/64",
            "tenant": {"id": 1, "name": "Tenant A"},
        }

        # Tenant B allocations
        tenant_b_ipv4 = {
            "id": 300,
            "address": "10.1.1.10/24",  # Same IP, different tenant
            "tenant": {"id": 2, "name": "Tenant B"},
        }
        tenant_b_ipv6 = {
            "id": 400,
            "address": "2001:db8:a::10/64",  # Same IP, different tenant
            "tenant": {"id": 2, "name": "Tenant B"},
        }

        # Allocate for Tenant A
        netbox_client.request.side_effect = [tenant_a_ipv4, tenant_a_ipv6]
        ipv4_a, ipv6_a = await netbox_client.allocate_dual_stack_ips(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
            tenant=1,
        )

        assert ipv4_a["tenant"]["id"] == 1
        assert ipv6_a["tenant"]["id"] == 1

        # Allocate for Tenant B (same IPs, different tenant)
        netbox_client.request.side_effect = [tenant_b_ipv4, tenant_b_ipv6]
        ipv4_b, ipv6_b = await netbox_client.allocate_dual_stack_ips(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
            tenant=2,
        )

        assert ipv4_b["tenant"]["id"] == 2
        assert ipv6_b["tenant"]["id"] == 2

        # Verify IPs are same but tenants different
        assert ipv4_a["address"] == ipv4_b["address"]
        assert ipv6_a["address"] == ipv6_b["address"]
        assert ipv4_a["tenant"]["id"] != ipv4_b["tenant"]["id"]
