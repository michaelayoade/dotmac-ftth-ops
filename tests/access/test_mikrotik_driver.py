"""
Tests for Mikrotik RouterOS driver.

These tests verify the Mikrotik driver implementation for PPPoE subscriber
management, queue-based bandwidth control, and device health monitoring.
"""

from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.access.drivers.base import (
    DriverContext,
    ONUProvisionRequest,
)
from dotmac.platform.access.drivers.mikrotik import (
    MikrotikDriverConfig,
    MikrotikRouterOSDriver,
)

pytestmark = pytest.mark.unit


@pytest.fixture
def mikrotik_config():
    """Create a test Mikrotik driver configuration."""
    return MikrotikDriverConfig(
        olt_id="mikrotik-test-001",
        host="192.168.88.1",
        port=8728,
        username="admin",
        password="test_password",
        api_port=8728,
        use_ssl=False,
        pppoe_profile="default",
        address_pool="dhcp_pool",
    )


@pytest.fixture
def mikrotik_driver(mikrotik_config):
    """Create a Mikrotik driver instance."""
    context = DriverContext(tenant_id="test-tenant")
    return MikrotikRouterOSDriver(mikrotik_config, context)


class TestMikrotikDriverConfig:
    """Tests for MikrotikDriverConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = MikrotikDriverConfig(
            olt_id="test",
            host="192.168.88.1",
            username="admin",
            password="password",
        )
        assert config.api_port == 8728
        assert config.use_ssl is False
        assert config.pppoe_profile is None
        assert config.address_pool is None

    def test_custom_values(self, mikrotik_config):
        """Test custom configuration values."""
        assert mikrotik_config.api_port == 8728
        assert mikrotik_config.pppoe_profile == "default"
        assert mikrotik_config.address_pool == "dhcp_pool"


class TestMikrotikDriverCapabilities:
    """Tests for driver capabilities."""

    @pytest.mark.asyncio
    async def test_get_capabilities(self, mikrotik_driver):
        """Test capability reporting."""
        caps = await mikrotik_driver.get_capabilities()

        assert caps.supports_onu_provisioning is True
        assert caps.supports_vlan_change is False
        assert caps.supports_backup_restore is True
        assert caps.supports_realtime_alarms is False
        assert "pppoe" in caps.supported_operations
        assert "hotspot" in caps.supported_operations
        assert "queue" in caps.supported_operations
        assert "dhcp" in caps.supported_operations


class TestMikrotikDriverDiscovery:
    """Tests for device discovery."""

    @pytest.mark.asyncio
    async def test_discover_onus_pppoe_secrets(self, mikrotik_driver):
        """Test PPPoE secret discovery."""
        mock_secrets = [
            {"name": "user1", "profile": "default", "service": "pppoe"},
            {"name": "user2", "profile": "premium", "service": "any"},
        ]
        mock_actives = [
            {"name": "user1", "address": "10.0.0.2", "uptime": "1h30m"},
        ]

        with patch.object(mikrotik_driver, "_run_api_command") as mock_cmd:
            mock_cmd.side_effect = [mock_secrets, mock_actives, []]  # secrets, actives, hotspot

            devices = await mikrotik_driver.discover_onus()

            assert len(devices) >= 2
            # User1 should be online (in active list)
            user1 = next((d for d in devices if d.serial_number == "user1"), None)
            assert user1 is not None
            assert user1.state == "online"

            # User2 should be configured (not in active list)
            user2 = next((d for d in devices if d.serial_number == "user2"), None)
            assert user2 is not None
            assert user2.state == "configured"


class TestMikrotikDriverProvisioning:
    """Tests for subscriber provisioning."""

    @pytest.mark.asyncio
    async def test_provision_onu_creates_pppoe_secret(self, mikrotik_driver):
        """Test PPPoE secret creation."""
        request = ONUProvisionRequest(
            onu_id="new-subscriber",
            serial_number="new-subscriber",
            service_profile_id="premium",
            metadata={
                "password": "secret123",
                "service": "pppoe",
            },
        )

        with patch.object(mikrotik_driver, "_run_api_add") as mock_add:
            mock_add.return_value = "*1"

            result = await mikrotik_driver.provision_onu(request)

            assert result.success is True
            assert "pppoe-new-subscriber" in (result.onu_id or "")
            mock_add.assert_called_once()

    @pytest.mark.asyncio
    async def test_provision_onu_with_queue(self, mikrotik_driver):
        """Test PPPoE secret creation with bandwidth queue."""
        request = ONUProvisionRequest(
            onu_id="subscriber-with-limit",
            serial_number="subscriber-with-limit",
            vlan=100,  # Used as profile ID for queue creation
            metadata={
                "password": "secret123",
                "download_mbps": 50,
                "upload_mbps": 10,
            },
        )

        with patch.object(mikrotik_driver, "_run_api_add") as mock_add:
            mock_add.return_value = "*1"

            result = await mikrotik_driver.provision_onu(request)

            assert result.success is True
            # Should be called twice: once for secret, once for queue
            assert mock_add.call_count == 2


class TestMikrotikDriverRemoval:
    """Tests for subscriber removal."""

    @pytest.mark.asyncio
    async def test_remove_onu_pppoe_subscriber(self, mikrotik_driver):
        """Test PPPoE subscriber removal."""
        mock_secrets = [
            {"name": "user-to-remove", ".id": "*1"},
        ]
        mock_queues = [
            {"name": "queue-user-to-remove", ".id": "*10"},
        ]

        with patch.object(mikrotik_driver, "_run_api_command") as mock_cmd:
            mock_cmd.side_effect = [mock_secrets, mock_queues]

            with patch.object(mikrotik_driver, "_run_api_remove") as mock_remove:
                mock_remove.return_value = True

                result = await mikrotik_driver.remove_onu("pppoe-user-to-remove")

                assert result is True
                # Should attempt to remove secret
                mock_remove.assert_called()


class TestMikrotikDriverMetrics:
    """Tests for metrics collection."""

    @pytest.mark.asyncio
    async def test_collect_metrics(self, mikrotik_driver):
        """Test system metrics collection."""
        mock_resource = [
            {
                "uptime": "2d3h",
                "cpu-load": 15,
                "free-memory": 100000000,
                "total-memory": 256000000,
                "version": "7.10",
            }
        ]
        mock_interfaces = [
            {"name": "ether1", "running": "true"},
            {"name": "ether2", "running": "false"},
        ]
        mock_actives = [{"name": "user1"}, {"name": "user2"}]
        mock_secrets = [{"name": "user1"}, {"name": "user2"}, {"name": "user3"}]

        with patch.object(mikrotik_driver, "_run_api_command") as mock_cmd:
            mock_cmd.side_effect = [mock_resource, mock_interfaces, mock_actives, mock_secrets]

            metrics = await mikrotik_driver.collect_metrics()

            assert metrics.olt_id == "mikrotik-test-001"
            assert metrics.pon_ports_up == 1  # One running interface
            assert metrics.pon_ports_total == 2
            assert metrics.onu_online == 2  # Two active sessions
            assert metrics.onu_total == 3  # Three secrets


class TestMikrotikDriverHealth:
    """Tests for health monitoring."""

    @pytest.mark.asyncio
    async def test_get_health_success(self, mikrotik_driver):
        """Test health check returns healthy status."""
        mock_resource = [
            {
                "version": "7.10",
                "uptime": "10d",
                "cpu-load": 5,
                "free-memory": 200000000,
            }
        ]
        mock_subscribers = []

        with patch.object(mikrotik_driver, "_run_api_command") as mock_cmd:
            mock_cmd.side_effect = [mock_resource, mock_subscribers, [], []]

            health = await mikrotik_driver.get_health()

            assert health["healthy"] is True
            assert health["state"] == "HEALTHY"
            assert "RouterOS 7.10" in health["message"]

    @pytest.mark.asyncio
    async def test_get_health_connection_failure(self, mikrotik_driver):
        """Test health check handles connection failure."""
        with patch.object(mikrotik_driver, "_run_api_command") as mock_cmd:
            mock_cmd.side_effect = Exception("Connection refused")

            health = await mikrotik_driver.get_health()

            assert health["healthy"] is False
            assert health["state"] == "UNHEALTHY"
            assert "Connection failed" in health["message"]


class TestMikrotikDriverAlarms:
    """Tests for alarm operations."""

    @pytest.mark.asyncio
    async def test_fetch_alarms(self, mikrotik_driver):
        """Test alarm fetching from logs."""
        mock_logs = [
            {".id": "*100", "topics": "warning,system", "message": "Login failure"},
            {".id": "*101", "topics": "info,system", "message": "System started"},
            {".id": "*102", "topics": "error,critical", "message": "Interface down"},
        ]

        with patch.object(mikrotik_driver, "_run_api_command") as mock_cmd:
            mock_cmd.return_value = mock_logs

            alarms = await mikrotik_driver.fetch_alarms()

            # Should only return warning/error/critical
            assert len(alarms) == 2
            severities = [a.severity for a in alarms]
            assert "Warning" in severities
            assert "Critical" in severities

    @pytest.mark.asyncio
    async def test_acknowledge_alarm_not_supported(self, mikrotik_driver):
        """Test alarm acknowledgement raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            await mikrotik_driver.acknowledge_alarm("*100")

    @pytest.mark.asyncio
    async def test_clear_alarm(self, mikrotik_driver):
        """Test alarm clearing via log removal."""
        with patch.object(mikrotik_driver, "_run_api_remove") as mock_remove:
            mock_remove.return_value = True

            result = await mikrotik_driver.clear_alarm("*100")

            assert result is True
            mock_remove.assert_called_once_with("/log", "*100")


class TestMikrotikDriverOperations:
    """Tests for device operations."""

    @pytest.mark.asyncio
    async def test_operate_device_reboot(self, mikrotik_driver):
        """Test device reboot operation."""
        mock_api = MagicMock()
        mock_path = MagicMock()
        mock_api.path.return_value = mock_path

        with patch.object(mikrotik_driver, "_get_api", return_value=mock_api):
            result = await mikrotik_driver.operate_device("mikrotik-test-001", "reboot")

            assert result is True
            mock_path.call.assert_called_with("reboot")

    @pytest.mark.asyncio
    async def test_operate_device_disable_subscriber(self, mikrotik_driver):
        """Test subscriber disable operation."""
        mock_secrets = [{"name": "user1", ".id": "*1"}]

        with patch.object(mikrotik_driver, "_run_api_command") as mock_cmd:
            mock_cmd.return_value = mock_secrets

            mock_api = MagicMock()
            mock_path = MagicMock()
            mock_api.path.return_value = mock_path

            with patch.object(mikrotik_driver, "_get_api", return_value=mock_api):
                result = await mikrotik_driver.operate_device("pppoe-user1", "disable")

                assert result is True
                mock_path.update.assert_called_once()


class TestMikrotikDriverServiceProfile:
    """Tests for service profile application."""

    @pytest.mark.asyncio
    async def test_apply_service_profile_bandwidth(self, mikrotik_driver):
        """Test bandwidth profile application."""
        profile = {
            "download_mbps": 100,
            "upload_mbps": 20,
        }

        with patch.object(mikrotik_driver, "_remove_queue_for_subscriber") as mock_remove:
            with patch.object(mikrotik_driver, "_create_queue_for_subscriber") as mock_create:
                mock_remove.return_value = True
                mock_create.return_value = True

                result = await mikrotik_driver.apply_service_profile("pppoe-user1", profile)

                assert result.success is True
                mock_remove.assert_called_once_with("user1")
                mock_create.assert_called_once()
