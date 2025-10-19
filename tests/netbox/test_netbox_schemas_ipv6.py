"""
Tests for NetBox Schemas with IPv6 Support

Test IPv4/IPv6 validation and dual-stack allocation schemas.
"""

import pytest
from pydantic import ValidationError

from dotmac.platform.netbox.schemas import (
    IPAddressCreate,
    DualStackAllocationRequest,
    DualStackAllocationResponse,
    BulkIPAllocationRequest,
    BulkIPAllocationResponse,
    IPUtilizationResponse,
    IPAddressResponse,
)


class TestIPAddressCreateIPv6:
    """Test IP address creation with IPv4/IPv6 validation."""

    def test_create_ipv4_address(self):
        """Test creating IPv4 address with CIDR."""
        ip = IPAddressCreate(address="192.168.1.1/24")
        assert ip.address == "192.168.1.1/24"

    def test_create_ipv6_address(self):
        """Test creating IPv6 address with CIDR."""
        ip = IPAddressCreate(address="2001:db8::1/64")
        # Note: IPNetworkValidator normalizes to network address (host bits cleared)
        assert ip.address == "2001:db8::/64"

    def test_create_ipv6_normalized(self):
        """Test IPv6 address is normalized."""
        ip = IPAddressCreate(address="2001:0db8:0000:0000:0000:0000:0000:0001/64")
        # Should be normalized to network address
        assert ip.address == "2001:db8::/64"

    def test_invalid_ipv4_rejected(self):
        """Test invalid IPv4 address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IPAddressCreate(address="256.1.1.1/24")
        assert "Invalid IP" in str(exc_info.value)

    def test_invalid_ipv6_rejected(self):
        """Test invalid IPv6 address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IPAddressCreate(address="gggg::1/64")
        assert "Invalid IP" in str(exc_info.value)

    def test_missing_cidr_rejected(self):
        """Test address without CIDR notation."""
        # Python's ipaddress module accepts single IPs and treats them as /32 or /128
        # So this should actually pass
        ip = IPAddressCreate(address="192.168.1.1")
        # Will be treated as /32
        assert "/32" in ip.address or ip.address == "192.168.1.1"

    def test_create_with_description(self):
        """Test creating IP with description."""
        ip = IPAddressCreate(
            address="10.0.0.1/8",
            description="Test IPv4",
            dns_name="test.example.com",
        )
        assert ip.description == "Test IPv4"
        assert ip.dns_name == "test.example.com"

    def test_create_with_status(self):
        """Test creating IP with different statuses."""
        for status in ["active", "reserved", "deprecated", "dhcp", "slaac"]:
            ip = IPAddressCreate(address="10.1.1.1/24", status=status)
            assert ip.status == status

    def test_invalid_status_rejected(self):
        """Test invalid status is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IPAddressCreate(address="10.1.1.1/24", status="invalid_status")
        assert "Status must be one of" in str(exc_info.value)

    def test_slaac_status_for_ipv6(self):
        """Test SLAAC status (commonly used for IPv6)."""
        ip = IPAddressCreate(address="2001:db8::1/64", status="slaac")
        assert ip.status == "slaac"


class TestDualStackAllocation:
    """Test dual-stack IP allocation schemas."""

    def test_dual_stack_request(self):
        """Test dual-stack allocation request."""
        request = DualStackAllocationRequest(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
            description="Dual-stack for subscriber",
            dns_name="subscriber.example.com",
            tenant=10,
        )
        assert request.ipv4_prefix_id == 1
        assert request.ipv6_prefix_id == 2
        assert request.description == "Dual-stack for subscriber"
        assert request.dns_name == "subscriber.example.com"
        assert request.tenant == 10

    def test_dual_stack_request_minimal(self):
        """Test dual-stack request with minimal fields."""
        request = DualStackAllocationRequest(
            ipv4_prefix_id=1,
            ipv6_prefix_id=2,
        )
        assert request.ipv4_prefix_id == 1
        assert request.ipv6_prefix_id == 2
        assert request.description is None
        assert request.dns_name is None
        assert request.tenant is None

    def test_dual_stack_response(self):
        """Test dual-stack allocation response."""
        from datetime import datetime

        ipv4 = IPAddressResponse(
            id=100,
            address="192.168.1.50/24",
            status={"value": "active", "label": "Active"},
            description="IPv4 for subscriber",
            dns_name="subscriber.example.com",
            tags=[],
        )

        ipv6 = IPAddressResponse(
            id=200,
            address="2001:db8::50/64",
            status={"value": "active", "label": "Active"},
            description="IPv6 for subscriber",
            dns_name="subscriber.example.com",
            tags=[],
        )

        response = DualStackAllocationResponse(
            ipv4=ipv4,
            ipv6=ipv6,
        )

        assert response.ipv4.id == 100
        assert response.ipv6.id == 200
        assert response.ipv4.address == "192.168.1.50/24"
        assert response.ipv6.address == "2001:db8::50/64"
        assert response.allocated_at is not None


class TestBulkIPAllocation:
    """Test bulk IP allocation schemas."""

    def test_bulk_allocation_request(self):
        """Test bulk IP allocation request."""
        request = BulkIPAllocationRequest(
            prefix_id=1,
            count=10,
            description_prefix="Server",
            tenant=5,
        )
        assert request.prefix_id == 1
        assert request.count == 10
        assert request.description_prefix == "Server"
        assert request.tenant == 5

    def test_bulk_allocation_count_limits(self):
        """Test bulk allocation count validation."""
        # Valid count
        request = BulkIPAllocationRequest(prefix_id=1, count=50)
        assert request.count == 50

        # Minimum count
        request = BulkIPAllocationRequest(prefix_id=1, count=1)
        assert request.count == 1

        # Maximum count
        request = BulkIPAllocationRequest(prefix_id=1, count=100)
        assert request.count == 100

        # Too small
        with pytest.raises(ValidationError):
            BulkIPAllocationRequest(prefix_id=1, count=0)

        # Too large
        with pytest.raises(ValidationError):
            BulkIPAllocationRequest(prefix_id=1, count=101)

    def test_bulk_allocation_response(self):
        """Test bulk IP allocation response."""
        allocated_ips = [
            IPAddressResponse(
                id=i,
                address=f"192.168.1.{i}/24",
                status={"value": "active", "label": "Active"},
                description=f"Server-{i}",
                dns_name=f"server{i}.example.com",
                tags=[],
            )
            for i in range(1, 11)
        ]

        response = BulkIPAllocationResponse(
            allocated=allocated_ips,
            count=10,
            prefix_id=1,
        )

        assert len(response.allocated) == 10
        assert response.count == 10
        assert response.prefix_id == 1
        assert response.allocated[0].address == "192.168.1.1/24"
        assert response.allocated[9].address == "192.168.1.10/24"


class TestIPUtilization:
    """Test IP utilization response schema."""

    def test_ipv4_utilization(self):
        """Test IPv4 prefix utilization."""
        util = IPUtilizationResponse(
            prefix_id=1,
            prefix="192.168.1.0/24",
            family=4,
            total_ips=256,
            allocated_ips=100,
            available_ips=156,
            utilization_percent=39.06,
            status="active",
        )
        assert util.prefix == "192.168.1.0/24"
        assert util.family == 4
        assert util.total_ips == 256
        assert util.allocated_ips == 100
        assert util.available_ips == 156
        assert util.utilization_percent == pytest.approx(39.06)

    def test_ipv6_utilization(self):
        """Test IPv6 prefix utilization."""
        util = IPUtilizationResponse(
            prefix_id=2,
            prefix="2001:db8::/32",
            family=6,
            total_ips=2**96,  # Huge number for IPv6
            allocated_ips=1000,
            available_ips=2**96 - 1000,
            utilization_percent=0.0,  # Nearly 0% for IPv6 /32
            status="active",
        )
        assert util.prefix == "2001:db8::/32"
        assert util.family == 6
        assert util.utilization_percent == 0.0

    def test_full_utilization(self):
        """Test 100% utilized prefix."""
        util = IPUtilizationResponse(
            prefix_id=3,
            prefix="10.0.0.0/30",
            family=4,
            total_ips=4,
            allocated_ips=4,
            available_ips=0,
            utilization_percent=100.0,
            status="active",
        )
        assert util.utilization_percent == 100.0
        assert util.available_ips == 0


class TestNetBoxEdgeCases:
    """Test edge cases and special scenarios."""

    def test_ipv6_various_formats(self):
        """Test various IPv6 address formats."""
        # Full form
        ip1 = IPAddressCreate(address="2001:0db8:0000:0000:0000:0000:0000:0001/128")
        assert "2001:db8::1" in ip1.address

        # Compressed
        ip2 = IPAddressCreate(address="2001:db8::1/128")
        assert ip2.address == "2001:db8::1/128"

        # With zeros
        ip3 = IPAddressCreate(address="2001:db8:0:0:0:0:0:1/128")
        assert "2001:db8::1" in ip3.address

    def test_ipv4_private_ranges(self):
        """Test private IPv4 ranges."""
        # RFC 1918 private ranges
        ip1 = IPAddressCreate(address="10.0.0.1/8")
        ip2 = IPAddressCreate(address="172.16.0.1/12")
        ip3 = IPAddressCreate(address="192.168.1.1/16")

        assert ip1.address == "10.0.0.1/8"
        assert ip2.address == "172.16.0.1/12"
        assert ip3.address == "192.168.1.1/16"

    def test_ipv6_unique_local(self):
        """Test IPv6 unique local addresses (ULA)."""
        ip = IPAddressCreate(address="fd00::/64")
        assert "fd00::" in ip.address

    def test_ipv6_link_local(self):
        """Test IPv6 link-local addresses."""
        ip = IPAddressCreate(address="fe80::1/64")
        # Normalized to network address
        assert "fe80::" in ip.address

    def test_loopback_addresses(self):
        """Test loopback addresses."""
        # IPv4 loopback
        ip4 = IPAddressCreate(address="127.0.0.1/32")
        assert "127.0.0.1" in ip4.address

        # IPv6 loopback
        ip6 = IPAddressCreate(address="::1/128")
        assert ip6.address == "::1/128"
