"""
Tests for NetBox Client

Tests the NetBox API client wrapper.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from dotmac.platform.netbox.client import NetBoxClient


@pytest.mark.asyncio
class TestNetBoxClient:
    """Test NetBox client operations"""

    def test_client_initialization(self):
        """Test client initialization"""
        client = NetBoxClient(
            base_url="http://netbox.local:8080",
            api_token="test-token-123",
        )

        assert client.base_url == "http://netbox.local:8080/"
        assert client.api_token == "test-token-123"
        assert client.headers["Authorization"] == "Token test-token-123"

    def test_client_initialization_with_env(self):
        """Test client initialization from environment variables"""
        with patch.dict(
            "os.environ", {"NETBOX_URL": "http://netbox:8080", "NETBOX_API_TOKEN": "env-token"}
        ):
            client = NetBoxClient()
            assert client.base_url == "http://netbox:8080/"
            assert client.api_token == "env-token"

    @patch("httpx.AsyncClient")
    async def test_request_get(self, mock_client_class):
        """Test GET request"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": []}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client._request("GET", "ipam/ip-addresses/")

        assert result == {"results": []}
        mock_client.request.assert_called_once()

    @patch("httpx.AsyncClient")
    async def test_get_ip_addresses(self, mock_client_class):
        """Test getting IP addresses"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"id": 1, "address": "10.0.0.1/24"},
                {"id": 2, "address": "10.0.0.2/24"},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client.get_ip_addresses(tenant="tenant1", limit=10)

        assert len(result["results"]) == 2
        mock_client.request.assert_called_once()

    @patch("httpx.AsyncClient")
    async def test_create_ip_address(self, mock_client_class):
        """Test creating IP address"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": 1,
            "address": "10.0.0.1/24",
            "status": {"value": "active"},
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        data = {"address": "10.0.0.1/24", "status": "active"}
        result = await client.create_ip_address(data)

        assert result["id"] == 1
        assert result["address"] == "10.0.0.1/24"

    @patch("httpx.AsyncClient")
    async def test_health_check_success(self, mock_client_class):
        """Test successful health check"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"status": "ok"}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client.health_check()

        assert result is True

    @patch("httpx.AsyncClient")
    async def test_health_check_failure(self, mock_client_class):
        """Test failed health check"""
        mock_client = AsyncMock()
        mock_client.request = AsyncMock(side_effect=httpx.HTTPError("Connection failed"))
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client.health_check()

        assert result is False

    @patch("httpx.AsyncClient")
    async def test_get_prefixes(self, mock_client_class):
        """Test getting IP prefixes"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"id": 1, "prefix": "10.0.0.0/24"},
                {"id": 2, "prefix": "10.0.1.0/24"},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client.get_prefixes()

        assert len(result["results"]) == 2

    @patch("httpx.AsyncClient")
    async def test_get_available_ips(self, mock_client_class):
        """Test getting available IPs in prefix"""
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {"address": "10.0.0.1/24"},
            {"address": "10.0.0.2/24"},
        ]
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client.get_available_ips(prefix_id=1, limit=10)

        assert len(result) == 2

    @patch("httpx.AsyncClient")
    async def test_get_devices(self, mock_client_class):
        """Test getting devices"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"id": 1, "name": "router01"},
                {"id": 2, "name": "router02"},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client.get_devices(site="site1")

        assert len(result["results"]) == 2

    @patch("httpx.AsyncClient")
    async def test_get_tenant_by_name(self, mock_client_class):
        """Test getting tenant by name"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"id": 1, "name": "TestTenant", "slug": "test-tenant"},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client.get_tenant_by_name("TestTenant")

        assert result is not None
        assert result["name"] == "TestTenant"

    @patch("httpx.AsyncClient")
    async def test_get_tenant_by_name_not_found(self, mock_client_class):
        """Test getting tenant by name when not found"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": []}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = NetBoxClient(base_url="http://netbox:8080", api_token="test-token")
        result = await client.get_tenant_by_name("NonExistent")

        assert result is None
