"""
Integration tests for GenieACS Client

Tests the client against a mock GenieACS NBI server to validate
real HTTP flow, error handling, and circuit breaker behavior.
"""

import asyncio

import pytest
import pytest_asyncio
from aiohttp import web

from dotmac.platform.genieacs.client import GenieACSClient

pytestmark = pytest.mark.unit


@pytest_asyncio.fixture
async def mock_genieacs_server(aiohttp_server):
    """
    Mock GenieACS NBI server for integration testing.

    Implements basic GenieACS API endpoints for testing.
    """
    # Mock data
    mock_devices = [
        {
            "_id": "test-device-1",
            "_lastInform": 1234567890000,
            "InternetGatewayDevice.DeviceInfo.SerialNumber": "SN001",
            "InternetGatewayDevice.DeviceInfo.ModelName": "HG8245H",
        },
        {
            "_id": "test-device-2",
            "_lastInform": 1234567891000,
            "InternetGatewayDevice.DeviceInfo.SerialNumber": "SN002",
            "InternetGatewayDevice.DeviceInfo.ModelName": "HG8245Q",
        },
    ]

    mock_presets = [
        {"_id": "initial-provision", "name": "Initial Provisioning"},
        {"_id": "firmware-update", "name": "Firmware Update"},
    ]

    mock_faults = [
        {
            "_id": "fault-1",
            "device": "test-device-1",
            "faultCode": "9005",
            "faultString": "Invalid parameter name",
        }
    ]

    # Request counters for testing
    request_count = {"devices": 0, "tasks": 0}

    async def get_devices(request):
        """GET /devices - List devices"""
        request_count["devices"] += 1

        # Parse query params
        limit = int(request.query.get("limit", 100))
        skip = int(request.query.get("skip", 0))

        # Apply pagination
        paginated = mock_devices[skip : skip + limit]
        return web.json_response(paginated)

    async def get_device(request):
        """GET /devices/{device_id} - Get single device"""
        device_id = request.match_info["device_id"]

        device = next((d for d in mock_devices if d["_id"] == device_id), None)
        if device is None:
            return web.json_response({"error": "Device not found"}, status=404)

        return web.json_response(device)

    async def create_task(request):
        """POST /devices/{device_id}/tasks - Create task"""
        request_count["tasks"] += 1

        device_id = request.match_info["device_id"]
        task_data = await request.json()

        # Check device exists
        device = next((d for d in mock_devices if d["_id"] == device_id), None)
        if device is None:
            return web.json_response({"error": "Device not found"}, status=404)

        # Return task response
        return web.json_response(
            {
                "_id": f"task-{request_count['tasks']}",
                "device": device_id,
                "name": task_data.get("name"),
                "timestamp": 1234567890000,
            },
            status=200,
        )

    async def get_presets(request):
        """GET /presets - List presets"""
        return web.json_response(mock_presets)

    async def get_faults(request):
        """GET /faults - List faults"""
        device_id = request.query.get("device")
        if device_id:
            filtered = [f for f in mock_faults if f["device"] == device_id]
            return web.json_response(filtered)
        return web.json_response(mock_faults)

    async def slow_endpoint(request):
        """Simulate slow response"""
        await asyncio.sleep(2)
        return web.json_response({"message": "slow response"})

    async def error_endpoint(request):
        """Simulate server error"""
        return web.json_response({"error": "Internal server error"}, status=500)

    # Create app with routes
    app = web.Application()
    app.router.add_get("/devices", get_devices)
    app.router.add_get("/devices/{device_id}", get_device)
    app.router.add_post("/devices/{device_id}/tasks", create_task)
    app.router.add_get("/presets", get_presets)
    app.router.add_get("/faults", get_faults)
    app.router.add_get("/slow", slow_endpoint)
    app.router.add_get("/error", error_endpoint)

    # Store request count on app for test access
    app["request_count"] = request_count

    server = await aiohttp_server(app)
    return server


@pytest.fixture
def reset_circuit_breaker():
    """Reset circuit breaker state before each test"""
    from dotmac.platform.core.http_client import RobustHTTPClient

    RobustHTTPClient._circuit_breakers.clear()
    yield
    RobustHTTPClient._circuit_breakers.clear()


class TestGenieACSIntegration:
    """Integration tests with mock GenieACS server"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_devices_integration(self, mock_genieacs_server, reset_circuit_breaker):
        """Test getting devices through real HTTP"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        devices = await client.get_devices(limit=10)

        assert len(devices) == 2
        assert devices[0]["_id"] == "test-device-1"
        assert devices[1]["_id"] == "test-device-2"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_devices_pagination(self, mock_genieacs_server, reset_circuit_breaker):
        """Test device pagination"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        # Get first page
        page1 = await client.get_devices(limit=1, skip=0)
        assert len(page1) == 1
        assert page1[0]["_id"] == "test-device-1"

        # Get second page
        page2 = await client.get_devices(limit=1, skip=1)
        assert len(page2) == 1
        assert page2[0]["_id"] == "test-device-2"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_device_by_id_integration(self, mock_genieacs_server, reset_circuit_breaker):
        """Test getting single device by ID"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        device = await client.get_device("test-device-1")

        assert device is not None
        assert device["_id"] == "test-device-1"
        assert device["InternetGatewayDevice.DeviceInfo.SerialNumber"] == "SN001"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_device_not_found_integration(
        self, mock_genieacs_server, reset_circuit_breaker
    ):
        """Test getting non-existent device returns None"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        device = await client.get_device("nonexistent-device")

        assert device is None

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_task_integration(self, mock_genieacs_server, reset_circuit_breaker):
        """Test creating task for device"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        task = await client.create_task(
            device_id="test-device-1",
            task_name="refreshObject",
            task_data={"objectName": "InternetGatewayDevice."},
        )

        assert task is not None
        assert task["device"] == "test-device-1"
        assert task["name"] == "refreshObject"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_refresh_device_integration(self, mock_genieacs_server, reset_circuit_breaker):
        """Test refreshing device parameters"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        result = await client.refresh_device("test-device-1")

        assert result is not None
        assert result["device"] == "test-device-1"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_set_parameter_values_integration(
        self, mock_genieacs_server, reset_circuit_breaker
    ):
        """Test setting device parameters"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        result = await client.set_parameter_values(
            "test-device-1", {"InternetGatewayDevice.ManagementServer.PeriodicInformEnable": True}
        )

        assert result is not None
        assert result["device"] == "test-device-1"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reboot_device_integration(self, mock_genieacs_server, reset_circuit_breaker):
        """Test rebooting device"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        result = await client.reboot_device("test-device-1")

        assert result is not None
        assert result["device"] == "test-device-1"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_ping_integration(self, mock_genieacs_server, reset_circuit_breaker):
        """Test ping/health check"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        result = await client.ping()

        assert result is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_presets_integration(self, mock_genieacs_server, reset_circuit_breaker):
        """Test getting presets"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        presets = await client.get_presets()

        assert len(presets) == 2
        assert presets[0]["name"] == "Initial Provisioning"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_faults_integration(self, mock_genieacs_server, reset_circuit_breaker):
        """Test getting device faults"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        faults = await client.get_faults(device_id="test-device-1")

        assert len(faults) >= 1
        assert faults[0]["faultCode"] == "9005"


class TestGenieACSCircuitBreaker:
    """Test circuit breaker behavior with integration tests"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.slow
    async def test_retry_on_network_errors(self, mock_genieacs_server, reset_circuit_breaker):
        """Test that client retries on network errors"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")), max_retries=2)

        # Test with a bad endpoint that doesn't exist
        with pytest.raises(Exception):
            await client._genieacs_request("GET", "nonexistent-endpoint")

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_connection_pooling(self, mock_genieacs_server, reset_circuit_breaker):
        """Test that connection pooling works correctly"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        # Make multiple requests - should reuse connections
        for _ in range(5):
            devices = await client.get_devices(limit=1)
            assert len(devices) >= 0  # Just verify it works

        # Verify requests were made
        request_count = mock_genieacs_server.app["request_count"]
        assert request_count["devices"] == 5

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_concurrent_requests(self, mock_genieacs_server, reset_circuit_breaker):
        """Test handling concurrent requests"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        # Make 10 concurrent requests
        tasks = [client.get_devices(limit=1) for _ in range(10)]
        results = await asyncio.gather(*tasks)

        # All should succeed
        assert len(results) == 10
        assert all(len(devices) >= 0 for devices in results)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_timeout_handling(self, mock_genieacs_server, reset_circuit_breaker):
        """Test timeout handling"""
        import httpx

        client = GenieACSClient(
            base_url=str(mock_genieacs_server.make_url("/")),
            timeout_seconds=1.0,  # Short timeout
        )

        # Test with slow endpoint (2 second delay)
        # httpx raises ReadTimeout (subclass of TimeoutError)
        with pytest.raises((asyncio.TimeoutError, httpx.ReadTimeout)):
            await client._genieacs_request("GET", "slow", timeout=1.0)


class TestGenieACSErrorHandling:
    """Test error handling scenarios"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_handle_404_gracefully(self, mock_genieacs_server, reset_circuit_breaker):
        """Test 404 errors are handled gracefully"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        # get_device returns None on 404
        result = await client.get_device("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_handle_invalid_base_url(self, reset_circuit_breaker):
        """Test handling invalid base URL"""
        client = GenieACSClient(base_url="http://localhost:99999")

        # Should fail with connection error
        result = await client.ping()
        assert result is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_handle_malformed_response(self, mock_genieacs_server, reset_circuit_breaker):
        """Test handling malformed server responses"""
        client = GenieACSClient(base_url=str(mock_genieacs_server.make_url("/")))

        # Error endpoint returns 500
        with pytest.raises(Exception):
            await client._genieacs_request("GET", "error")
