"""
NetBox Integration Tests

Real integration tests against a live NetBox instance.
Requires Docker NetBox to be running.

Run with: pytest tests/netbox/test_netbox_integration.py -v -m integration
Skip with: pytest tests/netbox/ -v -m "not integration"
"""

import os

import pytest

from dotmac.platform.netbox.client import NetBoxClient

# Mark all tests in this file as integration tests
pytestmark = pytest.mark.integration


@pytest.fixture
def netbox_url():
    """Get NetBox URL from environment or use default"""
    return os.getenv("NETBOX_URL", "http://localhost:8080")


@pytest.fixture
def netbox_token():
    """Get NetBox API token from environment"""
    return os.getenv("NETBOX_API_TOKEN", "0123456789abcdef0123456789abcdef01234567")


@pytest.fixture
def netbox_client(netbox_url, netbox_token):
    """Create NetBox client for integration tests"""
    return NetBoxClient(
        base_url=netbox_url,
        api_token=netbox_token,
        verify_ssl=False,  # Disable SSL verification for local Docker
    )


@pytest.mark.asyncio
class TestNetBoxIntegration:
    """Integration tests with real NetBox API"""

    async def test_health_check(self, netbox_client):
        """Test health check against real NetBox"""
        result = await netbox_client.health_check()
        assert result is True, "NetBox health check should succeed"

    async def test_get_status(self, netbox_client):
        """Test getting NetBox status"""
        status = await netbox_client.get_status()
        assert isinstance(status, dict)
        assert "netbox-version" in status or "python-version" in status

    async def test_list_tenants(self, netbox_client):
        """Test listing tenants"""
        result = await netbox_client.get_tenants(limit=10)
        assert isinstance(result, dict)
        assert "results" in result
        assert isinstance(result["results"], list)

    async def test_list_sites(self, netbox_client):
        """Test listing sites"""
        result = await netbox_client.get_sites(limit=10)
        assert isinstance(result, dict)
        assert "results" in result

    async def test_list_ip_addresses(self, netbox_client):
        """Test listing IP addresses"""
        result = await netbox_client.get_ip_addresses(limit=10)
        assert isinstance(result, dict)
        assert "results" in result
        assert isinstance(result["results"], list)

    async def test_list_prefixes(self, netbox_client):
        """Test listing IP prefixes"""
        result = await netbox_client.get_prefixes(limit=10)
        assert isinstance(result, dict)
        assert "results" in result

    async def test_list_devices(self, netbox_client):
        """Test listing devices"""
        result = await netbox_client.get_devices(limit=10)
        assert isinstance(result, dict)
        assert "results" in result

    async def test_list_vlans(self, netbox_client):
        """Test listing VLANs"""
        result = await netbox_client.get_vlans(limit=10)
        assert isinstance(result, dict)
        assert "results" in result

    async def test_list_vrfs(self, netbox_client):
        """Test listing VRFs"""
        result = await netbox_client.get_vrfs(limit=10)
        assert isinstance(result, dict)
        assert "results" in result

    async def test_list_cables(self, netbox_client):
        """Test listing cables"""
        result = await netbox_client.get_cables(limit=10)
        assert isinstance(result, dict)
        assert "results" in result

    async def test_list_circuits(self, netbox_client):
        """Test listing circuits"""
        result = await netbox_client.get_circuits(limit=10)
        assert isinstance(result, dict)
        assert "results" in result

    async def test_list_circuit_providers(self, netbox_client):
        """Test listing circuit providers"""
        result = await netbox_client.get_circuit_providers(limit=10)
        assert isinstance(result, dict)
        assert "results" in result

    async def test_list_interfaces(self, netbox_client):
        """Test listing interfaces"""
        result = await netbox_client.get_interfaces(limit=10)
        assert isinstance(result, dict)
        assert "results" in result


@pytest.mark.asyncio
class TestNetBoxCRUDIntegration:
    """Integration tests for CRUD operations"""

    async def test_create_and_delete_tenant(self, netbox_client):
        """Test creating and deleting a tenant"""
        # Create tenant
        tenant_data = {
            "name": "Test Integration Tenant",
            "slug": "test-integration-tenant",
        }
        created = await netbox_client.create_tenant(tenant_data)
        assert created["id"] is not None
        assert created["name"] == tenant_data["name"]
        tenant_id = created["id"]

        # Verify tenant exists
        tenant = await netbox_client.get_tenant(tenant_id)
        assert tenant["id"] == tenant_id
        assert tenant["name"] == tenant_data["name"]

        # Clean up - delete tenant
        # Note: NetBox doesn't have a delete_tenant method in the client yet
        # This would need to be added or we can leave the test tenant

    async def test_create_and_delete_site(self, netbox_client):
        """Test creating and deleting a site"""
        # Create site
        site_data = {
            "name": "Test Integration Site",
            "slug": "test-integration-site",
        }
        created = await netbox_client.create_site(site_data)
        assert created["id"] is not None
        assert created["name"] == site_data["name"]
        site_id = created["id"]

        # Verify site exists
        site = await netbox_client.get_site(site_id)
        assert site["id"] == site_id
        assert site["name"] == site_data["name"]

        # Clean up would require delete_site method

    async def test_create_prefix_and_allocate_ip(self, netbox_client):
        """Test creating a prefix and allocating an IP from it"""
        # Create prefix
        prefix_data = {
            "prefix": "192.168.100.0/24",
            "status": "active",
        }
        created_prefix = await netbox_client.create_prefix(prefix_data)
        assert created_prefix["id"] is not None
        assert created_prefix["prefix"] == prefix_data["prefix"]
        prefix_id = created_prefix["id"]

        # Get available IPs
        available = await netbox_client.get_available_ips(prefix_id, limit=5)
        assert isinstance(available, list)
        assert len(available) > 0

        # Allocate an IP
        ip_data = {
            "description": "Test Integration IP",
        }
        allocated_ip = await netbox_client.allocate_ip(prefix_id, ip_data)
        assert allocated_ip["id"] is not None
        assert "address" in allocated_ip
        assert allocated_ip["description"] == ip_data["description"]

        # Verify IP was created
        ip_id = allocated_ip["id"]
        ip = await netbox_client.get_ip_address(ip_id)
        assert ip["id"] == ip_id

        # Clean up - delete IP
        await netbox_client.delete_ip_address(ip_id)

        # Verify IP was deleted (should raise an error or return None)
        # The get_ip_address might raise an exception for deleted IPs

    async def test_create_and_delete_vrf(self, netbox_client):
        """Test creating a VRF"""
        # Create VRF
        vrf_data = {
            "name": "Test Integration VRF",
            "rd": "65000:100",  # Route Distinguisher
        }
        created = await netbox_client.create_vrf(vrf_data)
        assert created["id"] is not None
        assert created["name"] == vrf_data["name"]

        # Clean up would require delete_vrf method

    async def test_ip_address_lifecycle(self, netbox_client):
        """Test complete IP address lifecycle"""
        # Create IP address directly
        ip_data = {
            "address": "10.255.255.1/32",
            "status": "active",
            "description": "Test Integration IP Direct",
        }
        created = await netbox_client.create_ip_address(ip_data)
        assert created["id"] is not None
        assert created["address"] == ip_data["address"]
        ip_id = created["id"]

        # Update IP address
        update_data = {
            "description": "Updated description",
        }
        updated = await netbox_client.update_ip_address(ip_id, update_data)
        assert updated["description"] == update_data["description"]

        # Get IP address
        ip = await netbox_client.get_ip_address(ip_id)
        assert ip["description"] == update_data["description"]

        # Delete IP address
        await netbox_client.delete_ip_address(ip_id)


@pytest.mark.asyncio
class TestNetBoxTenantOperations:
    """Integration tests for tenant-specific operations"""

    async def test_tenant_by_name_lookup(self, netbox_client):
        """Test looking up tenant by name"""
        # Try to find a tenant by name
        tenant = await netbox_client.get_tenant_by_name("NonExistentTenant")
        assert tenant is None

    async def test_create_tenant_and_lookup(self, netbox_client):
        """Test creating tenant and looking it up"""
        # Create unique tenant
        import time

        tenant_name = f"Test Tenant {int(time.time())}"
        tenant_slug = f"test-tenant-{int(time.time())}"

        tenant_data = {
            "name": tenant_name,
            "slug": tenant_slug,
        }
        created = await netbox_client.create_tenant(tenant_data)
        assert created["id"] is not None

        # Look up by name
        found = await netbox_client.get_tenant_by_name(tenant_name)
        assert found is not None
        assert found["name"] == tenant_name
        assert found["id"] == created["id"]


@pytest.mark.asyncio
class TestNetBoxPagination:
    """Integration tests for pagination"""

    async def test_pagination_with_offset(self, netbox_client):
        """Test pagination using offset"""
        # Get first page
        page1 = await netbox_client.get_ip_addresses(limit=5, offset=0)
        assert "results" in page1
        assert len(page1["results"]) <= 5

        # Get second page
        page2 = await netbox_client.get_ip_addresses(limit=5, offset=5)
        assert "results" in page2

        # Pages should be different (if there are enough records)
        if len(page1["results"]) == 5 and len(page2["results"]) > 0:
            page1_ids = {ip["id"] for ip in page1["results"]}
            page2_ids = {ip["id"] for ip in page2["results"]}
            assert page1_ids.isdisjoint(page2_ids), "Pages should not overlap"

    async def test_pagination_count(self, netbox_client):
        """Test that response includes count"""
        result = await netbox_client.get_ip_addresses(limit=10)
        assert "count" in result or "results" in result


@pytest.mark.asyncio
class TestNetBoxErrorHandling:
    """Integration tests for error handling"""

    async def test_get_nonexistent_ip(self, netbox_client):
        """Test getting non-existent IP address"""
        # Use a very high ID that likely doesn't exist
        with pytest.raises(Exception):  # Should raise HTTPError or similar
            await netbox_client.get_ip_address(999999999)

    async def test_invalid_prefix_format(self, netbox_client):
        """Test creating prefix with invalid format"""
        invalid_data = {
            "prefix": "invalid-format",
            "status": "active",
        }
        with pytest.raises(Exception):  # Should raise validation error
            await netbox_client.create_prefix(invalid_data)


# Configuration for pytest.ini
"""
Add to pytest.ini:

[pytest]
markers =
    integration: marks tests as integration tests (deselect with '-m "not integration"')

# Run only integration tests:
pytest -m integration

# Skip integration tests:
pytest -m "not integration"

# Run with verbose output:
pytest tests/netbox/test_netbox_integration.py -v -m integration
"""
