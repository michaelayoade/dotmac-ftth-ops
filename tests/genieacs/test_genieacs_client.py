"""
Tests for GenieACS NBI Client

Updated for RobustHTTPClient architecture with proper mocking strategy.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.genieacs.client import GenieACSClient


@pytest.fixture(autouse=True)
def reset_circuit_breaker():
    """Reset circuit breaker state before each test to prevent pollution."""
    from dotmac.platform.core.http_client import RobustHTTPClient

    RobustHTTPClient._circuit_breakers.clear()
    yield
    RobustHTTPClient._circuit_breakers.clear()


class TestGenieACSClientInitialization:
    """Test client initialization"""

    def test_client_initialization_with_explicit_params(self):
        """Test client initialization with explicit parameters"""
        client = GenieACSClient(
            base_url="http://genieacs.local:7557",
            username="admin",
            password="secret",
        )

        # Test accessible properties only (not internal implementation details)
        assert client.base_url == "http://genieacs.local:7557/"
        assert client.service_name == "genieacs"

    def test_client_initialization_with_env(self):
        """Test client initialization from environment variables"""
        # Mock the settings import to raise ImportError
        with patch.dict("sys.modules", {"dotmac.platform.settings": None}):
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
                assert client.service_name == "genieacs"

    def test_client_initialization_defaults_to_localhost(self):
        """Test client initialization defaults to localhost"""
        # Clear any env vars and mock import error
        with patch.dict("sys.modules", {"dotmac.platform.settings": None}):
            with patch.dict("os.environ", {}, clear=True):
                client = GenieACSClient()
                assert client.base_url == "http://localhost:7557/"


class TestGenieACSDeviceOperations:
    """Test device-related operations"""

    @pytest.mark.asyncio
    async def test_get_devices(self):
        """Test getting devices with query parameters"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        # Mock the internal request method
        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = [
                {"_id": "device1", "_lastInform": 1234567890000},
                {"_id": "device2", "_lastInform": 1234567891000},
            ]

            result = await client.get_devices(limit=10, skip=0)

            assert len(result) == 2
            assert result[0]["_id"] == "device1"
            assert result[1]["_id"] == "device2"
            mock_req.assert_called_once_with("GET", "devices", params={"limit": 10, "skip": 0})

    @pytest.mark.asyncio
    async def test_get_devices_with_query(self):
        """Test getting devices with query filter"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = [
                {"_id": "device1", "InternetGatewayDevice.DeviceInfo.ModelName": "HG8245H"}
            ]

            query = {"InternetGatewayDevice.DeviceInfo.ModelName": "HG8245H"}
            result = await client.get_devices(query=query)

            assert len(result) == 1
            mock_req.assert_called_once()
            call_args = mock_req.call_args
            assert call_args[0][0] == "GET"
            assert call_args[0][1] == "devices"
            assert "query" in call_args[1]["params"]

    @pytest.mark.asyncio
    async def test_get_device(self):
        """Test getting single device by ID"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "_id": "device1",
                "_lastInform": 1234567890000,
                "InternetGatewayDevice.DeviceInfo.SerialNumber": "SN12345",
            }

            result = await client.get_device("device1")

            assert result["_id"] == "device1"
            assert result["InternetGatewayDevice.DeviceInfo.SerialNumber"] == "SN12345"
            # get_device uses URL-encoded device ID in endpoint
            mock_req.assert_called_once_with("GET", "devices/device1")

    @pytest.mark.asyncio
    async def test_get_device_not_found(self):
        """Test getting non-existent device returns None"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            # Simulate 404 by raising HTTPStatusError
            import httpx

            response = MagicMock()
            response.status_code = 404
            mock_req.side_effect = httpx.HTTPStatusError(
                "Not found", request=MagicMock(), response=response
            )

            result = await client.get_device("nonexistent")

            assert result is None
            mock_req.assert_called_once_with("GET", "devices/nonexistent")

    @pytest.mark.asyncio
    async def test_update_device(self):
        """Test updating device metadata"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"_id": "device1", "_tags": ["example"]}

            payload = {"_tags": ["example"]}
            result = await client.update_device("device1", payload)

            assert result["_id"] == "device1"
            mock_req.assert_called_once_with("PATCH", "devices/device1", json=payload)


class TestGenieACSTaskOperations:
    """Test task-related operations"""

    @pytest.mark.asyncio
    async def test_create_task(self):
        """Test creating task for device"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "_id": "task123",
                "device": "device1",
                "name": "refreshObject",
                "timestamp": 1234567890000,
            }

            result = await client.create_task(
                device_id="device1",
                task_name="refreshObject",
                task_data={"objectName": "InternetGatewayDevice."},
            )

            assert result["_id"] == "task123"
            assert result["device"] == "device1"
            assert result["name"] == "refreshObject"
            mock_req.assert_called_once()
            call_args = mock_req.call_args
            assert call_args[0][0] == "POST"
            # create_task uses devices/{device_id}/tasks endpoint
            assert call_args[0][1] == "devices/device1/tasks"

    @pytest.mark.asyncio
    async def test_refresh_device(self):
        """Test refreshing device parameters"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"_id": "task123", "device": "device1", "name": "refreshObject"}

            result = await client.refresh_device("device1")

            assert result["name"] == "refreshObject"
            mock_req.assert_called_once()
            call_args = mock_req.call_args
            assert call_args[0][0] == "POST"
            assert "refreshObject" in str(call_args[1].get("json", {}))

    @pytest.mark.asyncio
    async def test_set_parameter_values(self):
        """Test setting device parameter values"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "_id": "task123",
                "device": "device1",
                "name": "setParameterValues",
            }

            parameters = {
                "InternetGatewayDevice.ManagementServer.PeriodicInformEnable": True,
                "InternetGatewayDevice.ManagementServer.PeriodicInformInterval": 300,
            }

            result = await client.set_parameter_values("device1", parameters)

            assert result["name"] == "setParameterValues"
            mock_req.assert_called_once()
            call_args = mock_req.call_args
            assert call_args[0][0] == "POST"

    @pytest.mark.asyncio
    async def test_reboot_device(self):
        """Test rebooting device"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"_id": "task123", "device": "device1", "name": "reboot"}

            result = await client.reboot_device("device1")

            assert result["name"] == "reboot"
            mock_req.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_task_delegates_to_create(self):
        """Test add_task convenience wrapper"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "create_task", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = {"_id": "task123", "name": "download"}

            result = await client.add_task(
                device_id="device1",
                task_name="download",
                file_name="fw.bin",
            )

            assert result["_id"] == "task123"
            mock_create.assert_called_once_with(
                device_id="device1",
                task_name="download",
                task_data={"fileName": "fw.bin"},
            )

    @pytest.mark.asyncio
    async def test_add_task_converts_object_name(self):
        """Ensure add_task converts snake_case keys"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "create_task", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = {"_id": "task456", "name": "refreshObject"}

            await client.add_task(
                device_id="device1",
                task_name="refreshObject",
                object_name="InternetGatewayDevice",
            )

            mock_create.assert_called_once_with(
                device_id="device1",
                task_name="refreshObject",
                task_data={"objectName": "InternetGatewayDevice"},
            )


class TestGenieACSHealthChecks:
    """Test health check and connectivity"""

    @pytest.mark.asyncio
    async def test_ping_success(self):
        """Test successful ping to GenieACS"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        # ping() calls get_devices(limit=1), so mock get_devices instead
        with patch.object(client, "get_devices", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = []

            result = await client.ping()

            assert result is True
            mock_get.assert_called_once_with(limit=1)

    @pytest.mark.asyncio
    async def test_ping_failure(self):
        """Test failed ping to GenieACS"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        # ping() calls get_devices, so mock that instead
        with patch.object(client, "get_devices", new_callable=AsyncMock) as mock_get:
            # Simulate connection failure
            mock_get.side_effect = Exception("Connection refused")

            result = await client.ping()

            assert result is False
            mock_get.assert_called_once_with(limit=1)


class TestGenieACSPresetOperations:
    """Test preset-related operations"""

    @pytest.mark.asyncio
    async def test_get_presets(self):
        """Test getting provisioning presets"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = [
                {"_id": "preset1", "name": "Initial Provisioning"},
                {"_id": "preset2", "name": "Firmware Update"},
            ]

            result = await client.get_presets()

            assert len(result) == 2
            assert result[0]["name"] == "Initial Provisioning"
            assert result[1]["name"] == "Firmware Update"
            # get_presets doesn't pass params argument
            mock_req.assert_called_once_with("GET", "presets")


class TestGenieACSFaultOperations:
    """Test fault-related operations"""

    @pytest.mark.asyncio
    async def test_get_faults(self):
        """Test getting device faults"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = [
                {
                    "_id": "fault1",
                    "device": "device1",
                    "faultCode": "9005",
                    "faultString": "Invalid parameter name",
                }
            ]

            result = await client.get_faults(device_id="device1")

            assert len(result) == 1
            assert result[0]["faultCode"] == "9005"
            mock_req.assert_called_once()
            call_args = mock_req.call_args
            assert call_args[0][0] == "GET"
            assert call_args[0][1] == "faults"


class TestGenieACSErrorHandling:
    """Test error handling and resilience"""

    @pytest.mark.asyncio
    async def test_request_with_timeout(self):
        """Test request timeout handling"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            # Simulate timeout
            import asyncio

            mock_req.side_effect = TimeoutError()

            with pytest.raises(asyncio.TimeoutError):
                await client.get_devices()

    @pytest.mark.asyncio
    async def test_request_with_network_error(self):
        """Test network error handling"""
        client = GenieACSClient(base_url="http://genieacs:7557")

        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            # Simulate network error
            mock_req.side_effect = Exception("Connection refused")

            with pytest.raises(Exception) as exc_info:
                await client.get_devices()

            assert "Connection refused" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_circuit_breaker_protection(self):
        """Test circuit breaker is properly configured and protects against failures"""
        # Create client - circuit breaker is configured by RobustHTTPClient parent
        client = GenieACSClient(base_url="http://genieacs:7557")

        # Verify circuit breaker is configured
        assert client.circuit_breaker is not None
        assert client.circuit_breaker.name == "genieacs:default"

        # Test that repeated failures are handled gracefully
        with patch.object(client, "_genieacs_request", new_callable=AsyncMock) as mock_req:
            # Simulate repeated failures
            mock_req.side_effect = Exception("Service unavailable")

            # Multiple failed requests should be caught
            for _i in range(3):
                try:
                    await client.get_devices()
                except Exception:
                    pass  # Expected to fail

            # Circuit breaker has been exercised
            assert mock_req.call_count == 3
