"""
Refactored NetBox Client Tests

Tests the NetBox API client with proper mocking and without circuit breaker interference.
"""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from dotmac.platform.netbox.client import NetBoxClient

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
class TestNetBoxClientRefactored:
    """Refactored test suite for NetBox client operations"""

    def test_client_initialization(self):
        """Test client initialization"""
        client = NetBoxClient(
            base_url="http://netbox.local:8080",
            api_token="test-token-123",
        )

        assert client.base_url == "http://netbox.local:8080/"
        # api_token is not stored as attribute, only used for Authorization header
        assert client.headers["Authorization"] == "Token test-token-123"
        assert client.api_base == "http://netbox.local:8080/api/"

    def test_client_initialization_with_env(self):
        """Test client initialization from environment variables"""
        with patch.dict(
            "os.environ", {"NETBOX_URL": "http://netbox:8080", "NETBOX_API_TOKEN": "env-token"}
        ):
            client = NetBoxClient()
            assert client.base_url == "http://netbox:8080/"
            assert client.headers["Authorization"] == "Token env-token"

    async def test_netbox_request_method(self):
        """Test _netbox_request method constructs correct endpoint"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        # Mock the base request method
        with patch.object(client, "request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"results": []}

            result = await client._netbox_request("GET", "ipam/ip-addresses/")

            # Verify request was called with correct endpoint
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args.kwargs["method"] == "GET"
            assert "api/ipam/ip-addresses/" in call_args.kwargs["endpoint"]
            assert result == {"results": []}

    async def test_get_ip_addresses(self):
        """Test getting IP addresses"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {
            "results": [
                {"id": 1, "address": "10.0.0.1/24"},
                {"id": 2, "address": "10.0.0.2/24"},
            ]
        }

        # Mock the _netbox_request method instead of the base HTTP client
        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            result = await client.get_ip_addresses(tenant="tenant1", limit=10)

            assert len(result["results"]) == 2
            mock_request.assert_called_once_with(
                "GET",
                "ipam/ip-addresses/",
                params={"limit": 10, "offset": 0, "tenant": "tenant1"},
            )

    async def test_create_ip_address(self):
        """Test creating IP address"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {
            "id": 1,
            "address": "10.0.0.1/24",
            "status": {"value": "active"},
        }

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            data = {"address": "10.0.0.1/24", "status": "active"}
            result = await client.create_ip_address(data)

            assert result["id"] == 1
            assert result["address"] == "10.0.0.1/24"
            mock_request.assert_called_once_with("POST", "ipam/ip-addresses/", json=data)

    async def test_get_ip_address(self):
        """Test getting single IP address by ID"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {"id": 1, "address": "10.0.0.1/24"}

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            result = await client.get_ip_address(1)

            assert result["id"] == 1
            mock_request.assert_called_once_with("GET", "ipam/ip-addresses/1/")

    async def test_delete_ip_address(self):
        """Test deleting IP address"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = None

            await client.delete_ip_address(1)

            mock_request.assert_called_once_with("DELETE", "ipam/ip-addresses/1/")

    async def test_health_check_success(self):
        """Test successful health check"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"status": "ok"}

            result = await client.health_check()

            assert result is True
            mock_request.assert_called_once_with("GET", "status/")

    async def test_health_check_failure(self):
        """Test failed health check"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = httpx.HTTPError("Connection failed")

            result = await client.health_check()

            assert result is False

    async def test_get_prefixes(self):
        """Test getting IP prefixes"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {
            "results": [
                {"id": 1, "prefix": "10.0.0.0/24"},
                {"id": 2, "prefix": "10.0.1.0/24"},
            ]
        }

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            result = await client.get_prefixes()

            assert len(result["results"]) == 2
            mock_request.assert_called_once()

    async def test_get_available_ips(self):
        """Test getting available IPs in prefix"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = [
            {"address": "10.0.0.1/24"},
            {"address": "10.0.0.2/24"},
        ]

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            result = await client.get_available_ips(prefix_id=1, limit=10)

            assert len(result) == 2
            mock_request.assert_called_once_with(
                "GET", "ipam/prefixes/1/available-ips/", params={"limit": 10}
            )

    async def test_create_prefix(self):
        """Test creating IP prefix"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {"id": 1, "prefix": "10.0.0.0/24"}

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            data = {"prefix": "10.0.0.0/24"}
            result = await client.create_prefix(data)

            assert result["id"] == 1
            mock_request.assert_called_once_with("POST", "ipam/prefixes/", json=data)

    async def test_get_devices(self):
        """Test getting devices"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {
            "results": [
                {"id": 1, "name": "router01"},
                {"id": 2, "name": "router02"},
            ]
        }

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            result = await client.get_devices(site="site1")

            assert len(result["results"]) == 2
            mock_request.assert_called_once_with(
                "GET",
                "dcim/devices/",
                params={"limit": 100, "offset": 0, "site": "site1"},
            )

    async def test_get_tenant_by_name(self):
        """Test getting tenant by name"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {
            "results": [
                {"id": 1, "name": "TestTenant", "slug": "test-tenant"},
            ]
        }

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            result = await client.get_tenant_by_name("TestTenant")

            assert result is not None
            assert result["name"] == "TestTenant"
            mock_request.assert_called_once_with(
                "GET", "tenancy/tenants/", params={"name": "TestTenant"}
            )

    async def test_get_tenant_by_name_not_found(self):
        """Test getting tenant by name when not found"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {"results": []}

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            result = await client.get_tenant_by_name("NonExistent")

            assert result is None

    async def test_create_vrf(self):
        """Test creating VRF"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {"id": 1, "name": "test-vrf"}

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            data = {"name": "test-vrf"}
            result = await client.create_vrf(data)

            assert result["id"] == 1
            mock_request.assert_called_once_with("POST", "ipam/vrfs/", json=data)

    async def test_get_sites(self):
        """Test getting sites"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {
            "results": [
                {"id": 1, "name": "Site 1"},
            ]
        }

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            result = await client.get_sites()

            assert len(result["results"]) == 1
            mock_request.assert_called_once()

    async def test_create_site(self):
        """Test creating site"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {"id": 1, "name": "New Site", "slug": "new-site"}

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            data = {"name": "New Site", "slug": "new-site"}
            result = await client.create_site(data)

            assert result["id"] == 1
            mock_request.assert_called_once_with("POST", "dcim/sites/", json=data)

    async def test_allocate_ip(self):
        """Test allocating next available IP from prefix"""
        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")

        expected_response = {"id": 1, "address": "10.0.0.1/24"}

        with patch.object(client, "_netbox_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = expected_response

            data = {"description": "Test allocation"}
            result = await client.allocate_ip(prefix_id=1, data=data)

            assert result["address"] == "10.0.0.1/24"
            mock_request.assert_called_once_with(
                "POST", "ipam/prefixes/1/available-ips/", json=data
            )
