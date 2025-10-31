
"""
Tests for NetBox Service Layer

Tests business logic for NetBox operations.
"""

from unittest.mock import AsyncMock

import pytest

from dotmac.platform.netbox.schemas import (



    IPAddressCreate,
    PrefixCreate,
    SiteCreate,
    VRFCreate,
)
from dotmac.platform.netbox.service import NetBoxService




pytestmark = pytest.mark.unit

@pytest.mark.asyncio
class TestNetBoxService:
    """Test NetBox service operations"""

    async def test_health_check_success(self):
        """Test successful health check"""
        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_status = AsyncMock(return_value={"netbox-version": "3.6.0"})

        service = NetBoxService(client=mock_client)
        result = await service.health_check()

        assert result.healthy is True
        assert result.version == "3.6.0"

    async def test_health_check_failure(self):
        """Test failed health check"""
        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=False)

        service = NetBoxService(client=mock_client)
        result = await service.health_check()

        assert result.healthy is False

    async def test_ensure_tenant_existing(self):
        """Test ensuring tenant when it already exists"""
        mock_client = AsyncMock()
        mock_client.get_tenant_by_name = AsyncMock(return_value={"id": 1, "name": "TestTenant"})

        service = NetBoxService(client=mock_client)
        tenant_id = await service.ensure_tenant("tenant-123", "TestTenant")

        assert tenant_id == 1
        mock_client.create_tenant.assert_not_called()

    async def test_ensure_tenant_create_new(self):
        """Test ensuring tenant when it doesn't exist"""
        mock_client = AsyncMock()
        mock_client.get_tenant_by_name = AsyncMock(return_value=None)
        mock_client.get_tenant_by_slug = AsyncMock(return_value=None)
        mock_client.get_tenant_by_slug = AsyncMock(return_value=None)
        mock_client.create_tenant = AsyncMock(
            return_value={"id": 1, "name": "TestTenant", "slug": "testtenant"}
        )

        service = NetBoxService(client=mock_client)
        tenant_id = await service.ensure_tenant("tenant-123", "TestTenant")

        assert tenant_id == 1
        mock_client.create_tenant.assert_called_once()

    async def test_list_ip_addresses(self):
        """Test listing IP addresses"""
        mock_client = AsyncMock()
        mock_client.get_ip_addresses = AsyncMock(
            return_value={
                "results": [
                    {
                        "id": 1,
                        "address": "10.0.0.1/24",
                        "status": {"value": "active"},
                        "description": "Test IP",
                        "dns_name": "",
                        "tags": [],
                    }
                ]
            }
        )

        service = NetBoxService(client=mock_client)
        ips = await service.list_ip_addresses(tenant="tenant1", limit=10)

        assert len(ips) == 1
        assert ips[0].address == "10.0.0.1/24"

    async def test_create_ip_address(self):
        """Test creating IP address"""
        mock_client = AsyncMock()
        mock_client.create_ip_address = AsyncMock(
            return_value={
                "id": 1,
                "address": "10.0.0.1/24",
                "status": {"value": "active"},
                "description": "New IP",
                "dns_name": "test.example.com",
                "tags": [],
            }
        )

        service = NetBoxService(client=mock_client)
        data = IPAddressCreate(
            address="10.0.0.1/24",
            description="New IP",
            dns_name="test.example.com",
        )
        ip = await service.create_ip_address(data)

        assert ip.id == 1
        assert ip.address == "10.0.0.1/24"

    async def test_get_ip_address_found(self):
        """Test getting IP address when found"""
        mock_client = AsyncMock()
        mock_client.get_ip_address = AsyncMock(
            return_value={
                "id": 1,
                "address": "10.0.0.1/24",
                "status": {"value": "active"},
                "description": "",
                "dns_name": "",
                "tags": [],
            }
        )

        service = NetBoxService(client=mock_client)
        ip = await service.get_ip_address(1)

        assert ip is not None
        assert ip.id == 1

    async def test_get_ip_address_not_found(self):
        """Test getting IP address when not found"""
        mock_client = AsyncMock()
        mock_client.get_ip_address = AsyncMock(side_effect=Exception("Not found"))

        service = NetBoxService(client=mock_client)
        ip = await service.get_ip_address(999)

        assert ip is None

    async def test_list_prefixes(self):
        """Test listing IP prefixes"""
        mock_client = AsyncMock()
        mock_client.get_prefixes = AsyncMock(
            return_value={
                "results": [
                    {
                        "id": 1,
                        "prefix": "10.0.0.0/24",
                        "status": {"value": "active"},
                        "is_pool": True,
                        "description": "Test subnet",
                    }
                ]
            }
        )

        service = NetBoxService(client=mock_client)
        prefixes = await service.list_prefixes(tenant="tenant1")

        assert len(prefixes) == 1
        assert prefixes[0].prefix == "10.0.0.0/24"

    async def test_create_prefix(self):
        """Test creating IP prefix"""
        mock_client = AsyncMock()
        mock_client.create_prefix = AsyncMock(
            return_value={
                "id": 1,
                "prefix": "10.0.0.0/24",
                "status": {"value": "active"},
                "is_pool": True,
                "description": "New subnet",
            }
        )

        service = NetBoxService(client=mock_client)
        data = PrefixCreate(
            prefix="10.0.0.0/24",
            is_pool=True,
            description="New subnet",
        )
        prefix = await service.create_prefix(data)

        assert prefix.id == 1
        assert prefix.prefix == "10.0.0.0/24"

    async def test_get_available_ips(self):
        """Test getting available IPs"""
        mock_client = AsyncMock()
        mock_client.get_available_ips = AsyncMock(
            return_value=[
                {"address": "10.0.0.1/24"},
                {"address": "10.0.0.2/24"},
            ]
        )

        service = NetBoxService(client=mock_client)
        # Create a prefix first so get_available_ips can find it
        service._prefix_store[1] = {
            "id": 1,
            "prefix": "10.0.0.0/24",
            "status": "active",
            "is_pool": True,
        }
        ips = await service.get_available_ips(prefix_id=1, limit=10)

        assert len(ips) >= 2
        assert any("10.0.0" in ip for ip in ips)

    async def test_create_site(self):
        """Test creating site"""
        mock_client = AsyncMock()
        mock_client.create_site = AsyncMock(
            return_value={
                "id": 1,
                "name": "Test Site",
                "slug": "test-site",
                "status": {"value": "active"},
                "facility": "",
                "description": "",
                "physical_address": "",
            }
        )

        service = NetBoxService(client=mock_client)
        data = SiteCreate(name="Test Site", slug="test-site")
        site = await service.create_site(data)

        assert site.id == 1
        assert site.name == "Test Site"

    async def test_create_vrf(self):
        """Test creating VRF"""
        mock_client = AsyncMock()
        mock_client.create_vrf = AsyncMock(
            return_value={
                "id": 1,
                "name": "VRF-A",
                "rd": "65000:1",
                "enforce_unique": True,
                "description": "Test VRF",
            }
        )

        service = NetBoxService(client=mock_client)
        data = VRFCreate(name="VRF-A", rd="65000:1", description="Test VRF")
        vrf = await service.create_vrf(data)

        assert vrf.id == 1
        assert vrf.name == "VRF-A"

    async def test_generate_slug(self):
        """Test slug generation"""
        service = NetBoxService()

        # Test normal name
        assert service._generate_slug("Test Site Name") == "test-site-name"

        # Test with special characters
        assert service._generate_slug("Test@Site#123") == "testsite123"

        # Test with multiple spaces
        assert service._generate_slug("Test   Site") == "test-site"

        # Test with hyphens
        assert service._generate_slug("Test-Site-Name") == "test-site-name"

    async def test_delete_ip_address_success(self):
        """Test deleting IP address successfully"""
        mock_client = AsyncMock()
        mock_client.delete_ip_address = AsyncMock(return_value=None)

        service = NetBoxService(client=mock_client)
        result = await service.delete_ip_address(1)

        assert result is True

    async def test_delete_ip_address_failure(self):
        """Test deleting IP address with error"""
        mock_client = AsyncMock()
        mock_client.delete_ip_address = AsyncMock(side_effect=Exception("Not found"))

        service = NetBoxService(client=mock_client)
        result = await service.delete_ip_address(999)

        assert result is False
