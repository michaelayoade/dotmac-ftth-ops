"""
Unit tests for VOLTHA Client

Tests VOLTHA client functionality with proper mocking for RobustHTTPClient architecture.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from dotmac.platform.voltha.client import VOLTHAClient


@pytest.fixture(autouse=True)
def reset_circuit_breaker():
    """Reset circuit breaker state before each test"""
    from dotmac.platform.core.http_client import RobustHTTPClient

    RobustHTTPClient._circuit_breakers.clear()
    yield
    RobustHTTPClient._circuit_breakers.clear()


@pytest.mark.integration
class TestVOLTHAClientInitialization:
    """Test client initialization"""

    def test_client_initialization_with_explicit_params(self):
        """Test client initialization with explicit parameters"""
        client = VOLTHAClient(
            base_url="http://voltha.local:8881",
            username="admin",
            password="secret",
        )

        assert client.base_url == "http://voltha.local:8881/"
        assert client.service_name == "voltha"
        assert "api/v1/" in client.api_base

    def test_client_initialization_with_token(self):
        """Test client initialization with API token"""
        client = VOLTHAClient(
            base_url="http://voltha.local:8881",
            api_token="test-token-123",
        )

        assert client.base_url == "http://voltha.local:8881/"
        assert client.service_name == "voltha"

    def test_client_initialization_with_env(self):
        """Test client initialization from environment variables"""
        with patch.dict("sys.modules", {"dotmac.platform.settings": None}):
            with patch.dict(
                "os.environ",
                {
                    "VOLTHA_URL": "http://voltha:8881",
                    "VOLTHA_USERNAME": "admin",
                    "VOLTHA_PASSWORD": "pass",
                },
            ):
                client = VOLTHAClient()
                assert client.base_url == "http://voltha:8881/"
                assert client.service_name == "voltha"

    def test_client_initialization_defaults_to_localhost(self):
        """Test client initialization defaults to localhost"""
        with patch.dict("sys.modules", {"dotmac.platform.settings": None}):
            with patch.dict("os.environ", {}, clear=True):
                client = VOLTHAClient()
                assert client.base_url == "http://localhost:8881/"


@pytest.mark.integration
class TestVOLTHALogicalDeviceOperations:
    """Test logical device (OLT) operations"""

    @pytest.mark.asyncio
    async def test_get_logical_devices(self):
        """Test getting all logical devices"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "items": [
                    {"id": "olt-1", "datapath_id": "1"},
                    {"id": "olt-2", "datapath_id": "2"},
                ]
            }

            result = await client.get_logical_devices()

            assert len(result) == 2
            assert result[0]["id"] == "olt-1"
            mock_req.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_logical_device(self):
        """Test getting single logical device by ID"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "id": "olt-1",
                "datapath_id": "1",
                "desc": {"hw_desc": "OpenOLT", "sw_desc": "1.0"},
            }

            result = await client.get_logical_device("olt-1")

            assert result is not None
            assert result["id"] == "olt-1"
            mock_req.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_logical_device_not_found(self):
        """Test getting non-existent logical device returns None"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            response = MagicMock()
            response.status_code = 404
            mock_req.side_effect = httpx.HTTPStatusError(
                "Not found", request=MagicMock(), response=response
            )

            result = await client.get_logical_device("nonexistent")

            assert result is None

    @pytest.mark.asyncio
    async def test_get_logical_device_ports(self):
        """Test getting logical device ports"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "items": [
                    {"port_no": 1, "device_id": "onu-1"},
                    {"port_no": 2, "device_id": "onu-2"},
                ]
            }

            result = await client.get_logical_device_ports("olt-1")

            assert len(result) == 2
            assert result[0]["port_no"] == 1

    @pytest.mark.asyncio
    async def test_get_logical_device_flows(self):
        """Test getting logical device flows"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "items": [
                    {"id": "flow-1", "table_id": 0},
                    {"id": "flow-2", "table_id": 1},
                ]
            }

            result = await client.get_logical_device_flows("olt-1")

            assert len(result) == 2


@pytest.mark.integration
class TestVOLTHADeviceOperations:
    """Test physical device operations"""

    @pytest.mark.asyncio
    async def test_get_devices(self):
        """Test getting all devices"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "items": [
                    {"id": "device-1", "type": "openolt"},
                    {"id": "device-2", "type": "brcm_openomci_onu"},
                ]
            }

            result = await client.get_devices()

            assert len(result) == 2
            assert result[0]["type"] == "openolt"

    @pytest.mark.asyncio
    async def test_get_device(self):
        """Test getting single device by ID"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "id": "device-1",
                "type": "openolt",
                "admin_state": "ENABLED",
                "oper_status": "ACTIVE",
            }

            result = await client.get_device("device-1")

            assert result is not None
            assert result["type"] == "openolt"

    @pytest.mark.asyncio
    async def test_enable_device(self):
        """Test enabling device"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"id": "device-1", "admin_state": "ENABLED"}

            result = await client.enable_device("device-1")

            assert result["admin_state"] == "ENABLED"
            mock_req.assert_called_once()

    @pytest.mark.asyncio
    async def test_disable_device(self):
        """Test disabling device"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"id": "device-1", "admin_state": "DISABLED"}

            result = await client.disable_device("device-1")

            assert result["admin_state"] == "DISABLED"

    @pytest.mark.asyncio
    async def test_delete_device(self):
        """Test deleting device"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {}

            result = await client.delete_device("device-1")

            assert result is True

    @pytest.mark.asyncio
    async def test_reboot_device(self):
        """Test rebooting device"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"id": "device-1", "oper_status": "REBOOTING"}

            result = await client.reboot_device("device-1")

            assert result["oper_status"] == "REBOOTING"

    @pytest.mark.asyncio
    async def test_get_device_ports(self):
        """Test getting device ports"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "items": [
                    {"port_no": 1, "label": "PON 0"},
                    {"port_no": 2, "label": "PON 1"},
                ]
            }

            result = await client.get_device_ports("device-1")

            assert len(result) == 2
            assert result[0]["label"] == "PON 0"


@pytest.mark.integration
class TestVOLTHAAdapterOperations:
    """Test adapter and device type operations"""

    @pytest.mark.asyncio
    async def test_get_adapters(self):
        """Test getting all adapters"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "items": [
                    {"id": "openolt", "vendor": "OpenOLT"},
                    {"id": "brcm_openomci_onu", "vendor": "Broadcom"},
                ]
            }

            result = await client.get_adapters()

            assert len(result) == 2
            assert result[0]["vendor"] == "OpenOLT"

    @pytest.mark.asyncio
    async def test_get_device_types(self):
        """Test getting device types"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "items": [
                    {"id": "openolt", "adapter": "openolt"},
                    {"id": "brcm_openomci_onu", "adapter": "brcm_openomci_onu"},
                ]
            }

            result = await client.get_device_types()

            assert len(result) == 2


@pytest.mark.integration
class TestVOLTHAHealthChecks:
    """Test health check operations"""

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Test successful health check"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"state": "HEALTHY"}

            result = await client.health_check()

            assert result["state"] == "HEALTHY"

    @pytest.mark.asyncio
    async def test_ping_success(self):
        """Test successful ping"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "health_check", new_callable=AsyncMock) as mock_health:
            mock_health.return_value = {"state": "HEALTHY"}

            result = await client.ping()

            assert result is True

    @pytest.mark.asyncio
    async def test_ping_failure(self):
        """Test failed ping"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "health_check", new_callable=AsyncMock) as mock_health:
            mock_health.side_effect = Exception("Connection failed")

            result = await client.ping()

            assert result is False


@pytest.mark.integration
class TestVOLTHAFlowOperations:
    """Test flow management operations"""

    @pytest.mark.asyncio
    async def test_add_flow(self):
        """Test adding flow to logical device"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"id": "flow-1", "table_id": 0}

            flow = {"table_id": 0, "priority": 1000}
            result = await client.add_flow("olt-1", flow)

            assert result["id"] == "flow-1"

    @pytest.mark.asyncio
    async def test_delete_flow(self):
        """Test deleting flow from logical device"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {}

            result = await client.delete_flow("olt-1", "flow-1")

            assert result is True

    @pytest.mark.asyncio
    async def test_update_flow(self):
        """Test updating flow"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"id": "flow-1", "priority": 2000}

            flow = {"priority": 2000}
            result = await client.update_flow("olt-1", "flow-1", flow)

            assert result["priority"] == 2000


@pytest.mark.integration
class TestVOLTHATechnologyProfiles:
    """Test technology profile operations"""

    @pytest.mark.asyncio
    async def test_get_technology_profiles(self):
        """Test getting technology profiles"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = [
                {"profile_id": 64, "technology": "xgspon"},
                {"profile_id": 65, "technology": "gpon"},
            ]

            result = await client.get_technology_profiles("device-1")

            assert len(result) == 2
            assert result[0]["technology"] == "xgspon"

    @pytest.mark.asyncio
    async def test_set_technology_profile(self):
        """Test setting technology profile"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"profile_id": 64, "technology": "xgspon"}

            profile = {"profile_id": 64, "technology": "xgspon"}
            result = await client.set_technology_profile("device-1", 64, profile)

            assert result["profile_id"] == 64

    @pytest.mark.asyncio
    async def test_delete_technology_profile(self):
        """Test deleting technology profile"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {}

            result = await client.delete_technology_profile("device-1", 64)

            assert result is True


@pytest.mark.integration
class TestVOLTHAMeterOperations:
    """Test meter management operations"""

    @pytest.mark.asyncio
    async def test_get_meters(self):
        """Test getting meters for logical device"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {
                "items": [
                    {"meter_id": 1, "flow_id": "flow-1"},
                    {"meter_id": 2, "flow_id": "flow-2"},
                ]
            }

            result = await client.get_meters("olt-1")

            assert len(result) == 2
            assert result[0]["meter_id"] == 1

    @pytest.mark.asyncio
    async def test_add_meter(self):
        """Test adding meter"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"meter_id": 1, "flow_id": "flow-1"}

            meter = {"meter_id": 1, "flow_id": "flow-1"}
            result = await client.add_meter("olt-1", meter)

            assert result["meter_id"] == 1

    @pytest.mark.asyncio
    async def test_update_meter(self):
        """Test updating meter"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"meter_id": 1, "flow_id": "flow-2"}

            meter = {"flow_id": "flow-2"}
            result = await client.update_meter("olt-1", 1, meter)

            assert result["flow_id"] == "flow-2"

    @pytest.mark.asyncio
    async def test_delete_meter(self):
        """Test deleting meter"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {}

            result = await client.delete_meter("olt-1", 1)

            assert result is True


@pytest.mark.integration
class TestVOLTHAAlarmEventOperations:
    """Test alarm and event helper methods"""

    @pytest.mark.asyncio
    async def test_get_alarms_with_filters(self):
        """Ensure alarm helper forwards parameters"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"items": []}

            await client.get_alarms(
                device_id="device-1",
                severity="CRITICAL",
                state="RAISED",
            )

            mock_req.assert_awaited_once_with(
                "GET",
                "alarms",
                params={
                    "device_id": "device-1",
                    "severity": "CRITICAL",
                    "state": "RAISED",
                },
                timeout=client.TIMEOUTS["alarms"],
            )

    @pytest.mark.asyncio
    async def test_get_alarms_without_filters(self):
        """Ensure alarm helper omits params when not provided"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"items": []}

            await client.get_alarms()

            mock_req.assert_awaited_once_with(
                "GET",
                "alarms",
                params=None,
                timeout=client.TIMEOUTS["alarms"],
            )

    @pytest.mark.asyncio
    async def test_get_events_with_filters(self):
        """Ensure event helper forwards parameters"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"items": []}

            await client.get_events(
                device_id="olt-1",
                event_type="onu_discovered",
                limit=25,
            )

            mock_req.assert_awaited_once_with(
                "GET",
                "events",
                params={
                    "limit": 25,
                    "device_id": "olt-1",
                    "event_type": "onu_discovered",
                },
                timeout=client.TIMEOUTS["events"],
            )

    @pytest.mark.asyncio
    async def test_get_events_with_defaults(self):
        """Ensure event helper applies default limit"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"items": []}

            await client.get_events()

            mock_req.assert_awaited_once_with(
                "GET",
                "events",
                params={"limit": 100},
                timeout=client.TIMEOUTS["events"],
            )


@pytest.mark.integration
class TestVOLTHAErrorHandling:
    """Test error handling"""

    @pytest.mark.asyncio
    async def test_request_with_timeout(self):
        """Test request timeout handling"""
        import asyncio

        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = TimeoutError()

            with pytest.raises(asyncio.TimeoutError):
                await client.get_devices()

    @pytest.mark.asyncio
    async def test_request_with_network_error(self):
        """Test network error handling"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = Exception("Connection refused")

            with pytest.raises(Exception) as exc_info:
                await client.get_devices()

            assert "Connection refused" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_circuit_breaker_protection(self):
        """Test circuit breaker is properly configured"""
        client = VOLTHAClient(base_url="http://voltha:8881")

        # Verify circuit breaker is configured
        assert client.circuit_breaker is not None
        assert client.circuit_breaker.name == "voltha:default"

        # Test that repeated failures are handled gracefully
        with patch.object(client, "_voltha_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = Exception("Service unavailable")

            # Multiple failed requests should be caught
            for _i in range(3):
                try:
                    await client.get_devices()
                except Exception:
                    pass  # Expected to fail

            # Circuit breaker has been exercised
            assert mock_req.call_count == 3
