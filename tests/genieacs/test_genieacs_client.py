"""
Tests for GenieACS Client

Tests the GenieACS NBI API client wrapper.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from dotmac.platform.genieacs.client import GenieACSClient


@pytest.mark.asyncio
class TestGenieACSClient:
    """Test GenieACS client operations"""

    def test_client_initialization(self):
        """Test client initialization"""
        client = GenieACSClient(
            base_url="http://genieacs.local:7557",
            username="admin",
            password="secret",
        )

        assert client.base_url == "http://genieacs.local:7557/"
        assert client.username == "admin"
        assert client.password == "secret"
        assert client.auth == ("admin", "secret")

    def test_client_initialization_with_env(self):
        """Test client initialization from environment variables"""
        with patch.dict(
            "os.environ",
            {
                "GENIEACS_URL": "http://genieacs:7557",
                "GENIEACS_USERNAME": "admin",
                "GENIEACS_PASSWORD": "pass",
            },
        ):
            client = GenieACSClient()
            assert client.base_url == "http://genieacs:7557/"
            assert client.username == "admin"
            assert client.password == "pass"

    @patch("httpx.AsyncClient")
    async def test_get_devices(self, mock_client_class):
        """Test getting devices"""
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {"_id": "device1", "_lastInform": 1234567890000},
            {"_id": "device2", "_lastInform": 1234567891000},
        ]
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"[...]"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.get_devices(limit=10)

        assert len(result) == 2
        mock_client.request.assert_called_once()

    @patch("httpx.AsyncClient")
    async def test_get_device(self, mock_client_class):
        """Test getting single device"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "_id": "device1",
            "_lastInform": 1234567890000,
            "InternetGatewayDevice.DeviceInfo.SerialNumber": {"_value": "SN12345"},
        }
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"{...}"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.get_device("device1")

        assert result["_id"] == "device1"

    @patch("httpx.AsyncClient")
    async def test_get_device_not_found(self, mock_client_class):
        """Test getting device that doesn't exist"""
        mock_response = MagicMock()
        mock_response.status_code = 404
        error = httpx.HTTPStatusError("Not found", request=MagicMock(), response=mock_response)
        mock_response.raise_for_status = MagicMock(side_effect=error)

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.get_device("nonexistent")

        assert result is None

    @patch("httpx.AsyncClient")
    async def test_create_task(self, mock_client_class):
        """Test creating task"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"taskId": "task123"}
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"{...}"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.create_task(
            "device1", "refreshObject", {"objectName": "InternetGatewayDevice"}
        )

        assert result["taskId"] == "task123"

    @patch("httpx.AsyncClient")
    async def test_refresh_device(self, mock_client_class):
        """Test refreshing device parameters"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"taskId": "refresh123"}
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"{...}"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.refresh_device("device1")

        assert result["taskId"] == "refresh123"

    @patch("httpx.AsyncClient")
    async def test_set_parameter_values(self, mock_client_class):
        """Test setting parameter values"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"taskId": "set123"}
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"{...}"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        params = {"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "TestWiFi"}
        result = await client.set_parameter_values("device1", params)

        assert result["taskId"] == "set123"

    @patch("httpx.AsyncClient")
    async def test_reboot_device(self, mock_client_class):
        """Test rebooting device"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"taskId": "reboot123"}
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"{...}"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.reboot_device("device1")

        assert result["taskId"] == "reboot123"

    @patch("httpx.AsyncClient")
    async def test_ping_success(self, mock_client_class):
        """Test successful ping"""
        mock_response = MagicMock()
        mock_response.json.return_value = []
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"[]"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.ping()

        assert result is True

    @patch("httpx.AsyncClient")
    async def test_ping_failure(self, mock_client_class):
        """Test failed ping"""
        mock_client = AsyncMock()
        mock_client.request = AsyncMock(side_effect=httpx.HTTPError("Connection failed"))
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.ping()

        assert result is False

    @patch("httpx.AsyncClient")
    async def test_get_presets(self, mock_client_class):
        """Test getting presets"""
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {"_id": "preset1", "name": "Test Preset"},
        ]
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"[...]"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.get_presets()

        assert len(result) == 1

    @patch("httpx.AsyncClient")
    async def test_get_faults(self, mock_client_class):
        """Test getting faults"""
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {"_id": "fault1", "device": "device1", "code": "ERROR"},
        ]
        mock_response.raise_for_status = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"[...]"

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        client = GenieACSClient(base_url="http://genieacs:7557")
        result = await client.get_faults(device_id="device1")

        assert len(result) == 1
