"""
Tests for NetBox Client Dual-Stack IP Allocation

Test dual-stack and bulk IP allocation methods.
"""

from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.netbox.client import NetBoxClient


@pytest.fixture
def netbox_client():
    """Create NetBox client with mocked dependencies"""
    with patch("dotmac.platform.settings.settings") as mock_settings:
        mock_settings.external_services.netbox_url = "http://netbox.test"
        client = NetBoxClient(api_token="test_token")
        # Mock the request method
        client.request = AsyncMock()
        return client


@pytest.mark.unit
class TestNetBoxDualStackAllocation:
    """Test dual-stack IP allocation."""

    @pytest.mark.asyncio
    async def test_allocate_dual_stack_ips_success(self, netbox_client):
        """Test successful dual-stack allocation."""
        # Mock responses
        ipv4_response = {
            "id": 100,
            "address": "192.168.1.50/24",
            "status": {"value": "active"},
            "description": "Subscriber IP",
            "dns_name": "sub123.example.com",
        }

        ipv6_response = {
            "id": 200,
            "address": "2001:db8::50/64",
            "status": {"value": "active"},
            "description": "Subscriber IP",
            "dns_name": "sub123.example.com",
        }

        # Setup mock to return different responses for each call
        netbox_client.request.side_effect = [ipv4_response, ipv6_response]

        # Allocate dual-stack IPs
        result = await netbox_client.allocate_dual_stack_ips(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
            description="Subscriber IP",
            dns_name="sub123.example.com",
            tenant=10,
        )

        # Verify both IPs returned
        ipv4, ipv6 = result
        assert ipv4["id"] == 100
        assert ipv4["address"] == "192.168.1.50/24"
        assert ipv6["id"] == 200
        assert ipv6["address"] == "2001:db8::50/64"

        # Verify both allocations were called
        assert netbox_client.request.call_count == 2

    @pytest.mark.asyncio
    async def test_allocate_dual_stack_ipv4_fails(self, netbox_client):
        """Test dual-stack allocation when IPv4 fails."""
        # Mock IPv4 allocation failure
        netbox_client.request.side_effect = Exception("IPv4 prefix exhausted")

        # Attempt allocation
        with pytest.raises(ValueError) as exc_info:
            await netbox_client.allocate_dual_stack_ips(
                ipv4_prefix_id=1,
                ipv6_prefix_id=2,
            )

        assert "Failed to allocate IPv4 address" in str(exc_info.value)

        # Verify only one call was made (IPv4 failed, IPv6 not attempted)
        assert netbox_client.request.call_count == 1

    @pytest.mark.asyncio
    async def test_allocate_dual_stack_ipv6_fails_rollback(self, netbox_client):
        """Test dual-stack allocation rolls back IPv4 when IPv6 fails."""
        ipv4_response = {
            "id": 100,
            "address": "192.168.1.50/24",
            "status": {"value": "active"},
        }

        # Mock IPv4 success, IPv6 failure
        netbox_client.request.side_effect = [
            ipv4_response,  # IPv4 allocation succeeds
            Exception("IPv6 prefix exhausted"),  # IPv6 allocation fails
            None,  # DELETE request for rollback
        ]

        # Attempt allocation
        with pytest.raises(ValueError) as exc_info:
            await netbox_client.allocate_dual_stack_ips(
                ipv4_prefix_id=1,
                ipv6_prefix_id=2,
            )

        assert "Failed to allocate IPv6 address" in str(exc_info.value)
        assert "IPv4 rolled back" in str(exc_info.value)

        # Verify three calls: IPv4 POST, IPv6 POST (failed), IPv4 DELETE (rollback)
        assert netbox_client.request.call_count == 3

    @pytest.mark.asyncio
    async def test_allocate_dual_stack_minimal_params(self, netbox_client):
        """Test dual-stack allocation with minimal parameters."""
        ipv4_response = {"id": 100, "address": "10.1.1.1/24"}
        ipv6_response = {"id": 200, "address": "2001:db8::1/64"}

        netbox_client.request.side_effect = [ipv4_response, ipv6_response]

        result = await netbox_client.allocate_dual_stack_ips(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
        )

        ipv4, ipv6 = result
        assert ipv4["id"] == 100
        assert ipv6["id"] == 200


@pytest.mark.unit
class TestNetBoxBulkAllocation:
    """Test bulk IP allocation."""

    @pytest.mark.asyncio
    async def test_bulk_allocate_ips_success(self, netbox_client):
        """Test successful bulk IP allocation."""
        # Mock 10 IP responses
        mock_responses = [
            {"id": i, "address": f"192.168.1.{i}/24", "description": f"Server-{i}"}
            for i in range(1, 11)
        ]

        netbox_client.request.side_effect = mock_responses

        # Bulk allocate 10 IPs
        result = await netbox_client.bulk_allocate_ips(
            prefix_id=1,
            count=10,
            description_prefix="Server",
            tenant=5,
        )

        # Verify 10 IPs returned
        assert len(result) == 10
        assert result[0]["id"] == 1
        assert result[9]["id"] == 10

        # Verify 10 allocation calls
        assert netbox_client.request.call_count == 10

    @pytest.mark.asyncio
    async def test_bulk_allocate_ips_exceeds_limit(self, netbox_client):
        """Test bulk allocation rejects count > 100."""
        with pytest.raises(ValueError) as exc_info:
            await netbox_client.bulk_allocate_ips(
                prefix_id=1,
                count=101,
            )

        assert "Cannot allocate more than 100 IPs" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_bulk_allocate_ips_partial_failure(self, netbox_client):
        """Test bulk allocation fails after partial allocation."""
        # Mock 5 successful responses, then failure
        mock_responses = [{"id": i, "address": f"192.168.1.{i}/24"} for i in range(1, 6)]
        mock_responses.append(Exception("Prefix exhausted"))

        netbox_client.request.side_effect = mock_responses

        # Attempt to allocate 10 (should fail after 5)
        with pytest.raises(ValueError) as exc_info:
            await netbox_client.bulk_allocate_ips(
                prefix_id=1,
                count=10,
            )

        assert "Bulk allocation failed after 5 IPs" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_bulk_allocate_ips_minimal_params(self, netbox_client):
        """Test bulk allocation with minimal parameters."""
        mock_responses = [{"id": i, "address": f"10.1.1.{i}/24"} for i in range(1, 4)]

        netbox_client.request.side_effect = mock_responses

        result = await netbox_client.bulk_allocate_ips(
            prefix_id=1,
            count=3,
        )

        assert len(result) == 3
        assert result[0]["id"] == 1
        assert result[2]["id"] == 3


@pytest.mark.unit
class TestNetBoxAllocationScenarios:
    """Test real-world allocation scenarios."""

    @pytest.mark.asyncio
    async def test_subscriber_provisioning_dual_stack(self, netbox_client):
        """Test complete subscriber provisioning with dual-stack."""
        ipv4_response = {
            "id": 500,
            "address": "203.0.113.100/24",
            "status": {"value": "active"},
            "description": "Subscriber sub-12345",
            "dns_name": "sub-12345.isp.com",
            "tenant": 10,
        }

        ipv6_response = {
            "id": 600,
            "address": "2001:db8:abcd::100/64",
            "status": {"value": "active"},
            "description": "Subscriber sub-12345",
            "dns_name": "sub-12345.isp.com",
            "tenant": 10,
        }

        netbox_client.request.side_effect = [ipv4_response, ipv6_response]

        result = await netbox_client.allocate_dual_stack_ips(
            ipv4_prefix_id=100,  # Public IPv4 pool
            ipv6_prefix_id=200,  # IPv6 /64 pool
            description="Subscriber sub-12345",
            dns_name="sub-12345.isp.com",
            tenant=10,
        )

        ipv4, ipv6 = result
        assert "203.0.113.100" in ipv4["address"]
        assert "2001:db8:abcd::100" in ipv6["address"]
        assert ipv4["tenant"] == 10
        assert ipv6["tenant"] == 10

    @pytest.mark.asyncio
    async def test_infrastructure_bulk_allocation(self, netbox_client):
        """Test bulk allocation for infrastructure devices."""
        # Allocate 20 IPs for servers
        mock_responses = [
            {
                "id": 1000 + i,
                "address": f"10.0.{i // 256}.{i % 256}/16",
                "description": f"Infrastructure-{i}",
            }
            for i in range(1, 21)
        ]

        netbox_client.request.side_effect = mock_responses

        result = await netbox_client.bulk_allocate_ips(
            prefix_id=50,
            count=20,
            description_prefix="Infrastructure",
            tenant=1,
        )

        assert len(result) == 20
        assert result[0]["description"] == "Infrastructure-1"
        assert result[19]["description"] == "Infrastructure-20"

    @pytest.mark.asyncio
    async def test_ipv6_only_deployment(self, netbox_client):
        """Test IPv6-only deployment scenario."""
        # In IPv6-only scenario, we'd only allocate IPv6
        # This uses the existing allocate_ip method
        ipv6_response = {
            "id": 700,
            "address": "2001:db8:cafe::1/128",
            "status": {"value": "active"},
            "description": "IPv6-only subscriber",
        }

        netbox_client.request.return_value = ipv6_response

        # Use direct allocate_ip for IPv6-only
        result = await netbox_client.allocate_ip(
            prefix_id=300,
            data={"description": "IPv6-only subscriber"},
        )

        assert result["id"] == 700
        assert "2001:db8:cafe::1" in result["address"]


@pytest.mark.unit
class TestNetBoxAllocationEdgeCases:
    """Test edge cases in IP allocation."""

    @pytest.mark.asyncio
    async def test_rollback_also_fails(self, netbox_client):
        """Test when both IPv6 allocation and IPv4 rollback fail."""
        ipv4_response = {"id": 100, "address": "192.168.1.1/24"}

        # IPv4 succeeds, IPv6 fails, rollback also fails
        netbox_client.request.side_effect = [
            ipv4_response,
            Exception("IPv6 exhausted"),
            Exception("Rollback failed - IP already deleted"),
        ]

        with pytest.raises(ValueError) as exc_info:
            await netbox_client.allocate_dual_stack_ips(
                ipv4_prefix_id=1,
                ipv6_prefix_id=2,
            )

        # Should still raise the IPv6 allocation error
        assert "Failed to allocate IPv6 address" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_allocation_with_special_characters_in_dns(self, netbox_client):
        """Test allocation with special characters in DNS name."""
        ipv4_response = {
            "id": 100,
            "address": "192.168.1.1/24",
            "dns_name": "my-server_01.sub-domain.example.com",
        }

        ipv6_response = {
            "id": 200,
            "address": "2001:db8::1/64",
            "dns_name": "my-server_01.sub-domain.example.com",
        }

        netbox_client.request.side_effect = [ipv4_response, ipv6_response]

        result = await netbox_client.allocate_dual_stack_ips(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
            dns_name="my-server_01.sub-domain.example.com",
        )

        ipv4, ipv6 = result
        assert ipv4["dns_name"] == "my-server_01.sub-domain.example.com"
        assert ipv6["dns_name"] == "my-server_01.sub-domain.example.com"

    @pytest.mark.asyncio
    async def test_bulk_allocate_single_ip(self, netbox_client):
        """Test bulk allocation with count=1."""
        mock_response = {"id": 1, "address": "10.0.0.1/24"}

        netbox_client.request.return_value = mock_response

        result = await netbox_client.bulk_allocate_ips(
            prefix_id=1,
            count=1,
        )

        assert len(result) == 1
        assert result[0]["id"] == 1
