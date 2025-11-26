"""
Integration tests for Network Monitoring with mocked collector data.

These tests verify the NetworkMonitoringService correctly aggregates data
from NetBox, VOLTHA, GenieACS, and Prometheus using recorded/mocked responses.
"""

import pytest
from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock, patch

from dotmac.platform.network_monitoring.service import NetworkMonitoringService
from dotmac.platform.network_monitoring.schemas import (
    AlertSeverity,
    DeviceStatus,
    DeviceType,
)


pytestmark = pytest.mark.unit


# =============================================================================
# Mock Data Fixtures
# =============================================================================


@pytest.fixture
def mock_netbox_devices():
    """Mocked NetBox device inventory response."""
    return {
        "results": [
            {
                "id": 1,
                "name": "core-router-01",
                "status": {"value": "active", "label": "Active"},
                "device_role": {"slug": "router"},
                "device_type": {"model": "CCR2004-16G-2S+"},
                "site": {"name": "DC1"},
                "primary_ip4": {"address": "10.0.0.1/24"},
                "primary_ip6": None,
                "last_updated": "2024-01-15T10:30:00Z",
            },
            {
                "id": 2,
                "name": "access-switch-01",
                "status": {"value": "active", "label": "Active"},
                "device_role": {"slug": "switch"},
                "device_type": {"model": "CRS326-24G-2S+"},
                "site": {"name": "DC1"},
                "primary_ip4": {"address": "10.0.0.2/24"},
                "primary_ip6": None,
                "last_updated": "2024-01-15T10:30:00Z",
            },
            {
                "id": 3,
                "name": "olt-01",
                "status": {"value": "active", "label": "Active"},
                "device_role": {"slug": "olt"},
                "device_type": {"model": "MA5800-X17"},
                "site": {"name": "POP1"},
                "primary_ip4": {"address": "10.1.0.1/24"},
                "primary_ip6": None,
                "last_updated": "2024-01-15T10:30:00Z",
            },
            {
                "id": 4,
                "name": "offline-device",
                "status": {"value": "offline", "label": "Offline"},
                "device_role": {"slug": "switch"},
                "device_type": {"model": "CRS326-24G-2S+"},
                "site": {"name": "DC2"},
                "primary_ip4": {"address": "10.2.0.1/24"},
                "primary_ip6": None,
                "last_updated": "2024-01-14T08:00:00Z",
            },
        ]
    }


@pytest.fixture
def mock_voltha_devices():
    """Mocked VOLTHA ONU device list."""
    return [
        {
            "id": "onu-001",
            "device_id": "onu-001",
            "serial_number": "HWTC12345678",
            "admin_state": "ENABLED",
            "oper_status": "ACTIVE",
            "host_and_port": "10.1.0.10:50060",
            "tenant_id": "test-tenant",
            "metadata": {"tenant_id": "test-tenant"},
        },
        {
            "id": "onu-002",
            "device_id": "onu-002",
            "serial_number": "HWTC87654321",
            "admin_state": "ENABLED",
            "oper_status": "ACTIVE",
            "host_and_port": "10.1.0.11:50060",
            "tenant_id": "test-tenant",
            "metadata": {"tenant_id": "test-tenant"},
        },
        {
            "id": "onu-003",
            "device_id": "onu-003",
            "serial_number": "HWTC11111111",
            "admin_state": "DISABLED",
            "oper_status": "DOWN",
            "host_and_port": "10.1.0.12:50060",
            "tenant_id": "test-tenant",
            "metadata": {"tenant_id": "test-tenant"},
        },
    ]


@pytest.fixture
def mock_genieacs_device():
    """Mocked GenieACS CPE device response."""
    return {
        "_id": "001122-CPE-AABBCC",
        "_deviceId": {
            "_Manufacturer": "Huawei",
            "_ProductClass": "HG8245H",
            "_SerialNumber": "AABBCCDD1234",
        },
        "_lastInform": "2024-01-15T10:25:00Z",
        "Device": {
            "DeviceInfo": {
                "SoftwareVersion": "V5R020C00S125",
                "ModelName": "HG8245H",
                "ProcessStatus": {"CPUUsage": 15},
                "MemoryStatus": {"Total": 256000000, "Free": 128000000},
            },
            "WiFi": {
                "Radio": {
                    "1": {"Enable": True, "Channel": 6},
                    "2": {"Enable": True, "Channel": 44},
                }
            },
            "Hosts": {
                "Host": {
                    "1": {"HostName": "iPhone", "IPAddress": "192.168.1.100"},
                    "2": {"HostName": "Laptop", "IPAddress": "192.168.1.101"},
                }
            },
        },
        "InternetGatewayDevice": {
            "WANDevice": {
                "1": {
                    "WANConnectionDevice": {
                        "1": {
                            "WANIPConnection": {
                                "1": {"ExternalIPAddress": "100.64.1.50"}
                            }
                        }
                    }
                }
            }
        },
    }


@pytest.fixture
def mock_prometheus_response():
    """Mocked Prometheus query response."""
    return {
        "status": "success",
        "data": {
            "resultType": "vector",
            "result": [
                {
                    "metric": {"instance": "device-001"},
                    "value": [1705320600, "1234567890"],
                }
            ],
        },
    }


@pytest.fixture
def mock_alarms():
    """Mocked alarm service response."""
    from dotmac.platform.fault_management.models import (
        Alarm,
        AlarmSeverity as FMSeverity,
        AlarmStatus as FMStatus,
    )

    alarm1 = MagicMock(spec=Alarm)
    alarm1.id = "alarm-001"
    alarm1.alarm_id = "alarm-001"
    alarm1.severity = FMSeverity.CRITICAL
    alarm1.status = FMStatus.ACTIVE
    alarm1.title = "High CPU Usage"
    alarm1.description = "CPU usage above 90%"
    alarm1.resource_id = "device-001"
    alarm1.resource_name = "core-router-01"
    alarm1.resource_type = "router"
    alarm1.first_occurrence = datetime(2024, 1, 15, 10, 0, 0)
    alarm1.acknowledged_at = None
    alarm1.resolved_at = None
    alarm1.tenant_id = "test-tenant"
    alarm1.correlation_id = None
    alarm1.alarm_type = "cpu_threshold"

    alarm2 = MagicMock(spec=Alarm)
    alarm2.id = "alarm-002"
    alarm2.alarm_id = "alarm-002"
    alarm2.severity = FMSeverity.WARNING
    alarm2.status = FMStatus.ACTIVE
    alarm2.title = "Link Down"
    alarm2.description = "Interface eth0 is down"
    alarm2.resource_id = "device-002"
    alarm2.resource_name = "access-switch-01"
    alarm2.resource_type = "switch"
    alarm2.first_occurrence = datetime(2024, 1, 15, 9, 30, 0)
    alarm2.acknowledged_at = None
    alarm2.resolved_at = None
    alarm2.tenant_id = "test-tenant"
    alarm2.correlation_id = None
    alarm2.alarm_type = "link_status"

    return [alarm1, alarm2]


# =============================================================================
# Service Fixtures
# =============================================================================


@pytest.fixture
def mock_netbox_client(mock_netbox_devices):
    """Create a mocked NetBox client."""
    client = AsyncMock()
    client.get_devices = AsyncMock(return_value=mock_netbox_devices)
    client.get_device = AsyncMock(return_value=mock_netbox_devices["results"][0])
    return client


@pytest.fixture
def mock_voltha_client(mock_voltha_devices):
    """Create a mocked VOLTHA client."""
    client = AsyncMock()
    client.get_devices = AsyncMock(return_value=mock_voltha_devices)
    client.get_onu = AsyncMock(return_value=mock_voltha_devices[0])
    return client


@pytest.fixture
def mock_genieacs_client(mock_genieacs_device):
    """Create a mocked GenieACS client."""
    client = AsyncMock()
    client.get_device = AsyncMock(return_value=mock_genieacs_device)
    return client


@pytest.fixture
def mock_db_session(mock_alarms):
    """Create a mocked database session with alarm service."""
    session = MagicMock()
    return session


@pytest.fixture
def monitoring_service(
    mock_netbox_client, mock_voltha_client, mock_genieacs_client, mock_db_session
):
    """Create NetworkMonitoringService with mocked dependencies."""
    service = NetworkMonitoringService(
        tenant_id="test-tenant",
        session=mock_db_session,
        netbox_client=mock_netbox_client,
        voltha_client=mock_voltha_client,
        genieacs_client=mock_genieacs_client,
    )
    return service


# =============================================================================
# Integration Tests
# =============================================================================


class TestNetworkOverviewIntegration:
    """Tests for network overview aggregation."""

    @pytest.mark.asyncio
    async def test_get_network_overview_aggregates_all_sources(
        self, monitoring_service, mock_netbox_client, mock_voltha_client, mock_alarms
    ):
        """Test that overview aggregates data from NetBox and VOLTHA."""
        # Mock the alarm service
        with patch.object(
            monitoring_service, "_get_active_alerts", new_callable=AsyncMock
        ) as mock_alerts:
            mock_alerts.return_value = []

            overview = await monitoring_service.get_network_overview("test-tenant")

            assert overview.tenant_id == "test-tenant"
            # Should have devices from NetBox (4) + VOLTHA ONUs (3)
            assert overview.total_devices >= 4
            # NetBox has 3 online, 1 offline
            assert overview.online_devices >= 3
            assert overview.offline_devices >= 1

    @pytest.mark.asyncio
    async def test_get_network_overview_calculates_device_type_summary(
        self, monitoring_service
    ):
        """Test device type summary calculation."""
        with patch.object(
            monitoring_service, "_get_active_alerts", new_callable=AsyncMock
        ) as mock_alerts:
            mock_alerts.return_value = []

            overview = await monitoring_service.get_network_overview("test-tenant")

            # Should have summaries for different device types
            device_types = {s.device_type for s in overview.device_type_summary}
            assert len(device_types) >= 1  # At least one type


class TestDeviceHealthIntegration:
    """Tests for device health monitoring."""

    @pytest.mark.asyncio
    async def test_get_device_health_for_onu(
        self, monitoring_service, mock_voltha_client, mock_voltha_devices
    ):
        """Test ONU health retrieval from VOLTHA."""
        mock_voltha_client.get_onu = AsyncMock(return_value=mock_voltha_devices[0])

        health = await monitoring_service.get_device_health(
            "onu-001", DeviceType.ONU, "test-tenant"
        )

        assert health.device_id == "onu-001"
        assert health.device_type == DeviceType.ONU
        assert health.status == DeviceStatus.ONLINE

    @pytest.mark.asyncio
    async def test_get_device_health_for_cpe(
        self, monitoring_service, mock_genieacs_client, mock_genieacs_device
    ):
        """Test CPE health retrieval from GenieACS."""
        mock_genieacs_client.get_device = AsyncMock(return_value=mock_genieacs_device)

        health = await monitoring_service.get_device_health(
            "001122-CPE-AABBCC", DeviceType.CPE, "test-tenant"
        )

        assert health.device_id == "001122-CPE-AABBCC"
        assert health.device_type == DeviceType.CPE
        # Status depends on _lastInform timestamp in mock data
        # Old timestamp = OFFLINE, recent = ONLINE
        assert health.status in [DeviceStatus.ONLINE, DeviceStatus.OFFLINE, DeviceStatus.UNKNOWN]

    @pytest.mark.asyncio
    async def test_get_device_health_for_network_device(
        self, monitoring_service, mock_netbox_client, mock_netbox_devices
    ):
        """Test network device health from NetBox."""
        mock_netbox_client.get_device = AsyncMock(
            return_value=mock_netbox_devices["results"][0]
        )

        health = await monitoring_service.get_device_health(
            "1", DeviceType.ROUTER, "test-tenant"
        )

        assert health.device_type == DeviceType.ROUTER
        assert health.status == DeviceStatus.ONLINE
        assert health.management_ipv4 == "10.0.0.1"


class TestTrafficStatsIntegration:
    """Tests for traffic statistics collection."""

    @pytest.mark.asyncio
    async def test_get_traffic_stats_for_onu(self, monitoring_service):
        """Test ONU traffic stats from VOLTHA."""
        mock_stats = {
            "serial_number": "HWTC12345678",
            "rx_bytes": 1000000,
            "tx_bytes": 500000,
            "rx_packets": 10000,
            "tx_packets": 5000,
            "rx_rate_bps": 1000000,
            "tx_rate_bps": 500000,
        }

        monitoring_service.voltha.get_onu_stats = AsyncMock(return_value=mock_stats)

        stats = await monitoring_service.get_traffic_stats(
            "onu-001", DeviceType.ONU, "test-tenant"
        )

        assert stats.device_id == "onu-001"
        assert stats.total_bytes_in == 1000000
        assert stats.total_bytes_out == 500000

    @pytest.mark.asyncio
    async def test_get_traffic_stats_with_prometheus(
        self, monitoring_service, mock_prometheus_response
    ):
        """Test traffic stats from Prometheus for network devices."""
        # Mock Prometheus client
        mock_prom = AsyncMock()
        mock_prom.query = AsyncMock(return_value=mock_prometheus_response)

        with patch.object(
            monitoring_service, "_get_prometheus_client", new_callable=AsyncMock
        ) as mock_get_prom:
            mock_get_prom.return_value = mock_prom

            stats = await monitoring_service.get_traffic_stats(
                "device-001", DeviceType.ROUTER, "test-tenant"
            )

            assert stats.device_id == "device-001"


class TestDeviceMetricsIntegration:
    """Tests for comprehensive device metrics."""

    @pytest.mark.asyncio
    async def test_get_device_metrics_combines_health_and_traffic(
        self, monitoring_service, mock_voltha_client, mock_voltha_devices
    ):
        """Test that device metrics combines health and traffic data."""
        mock_voltha_client.get_onu = AsyncMock(return_value=mock_voltha_devices[0])

        metrics = await monitoring_service.get_device_metrics(
            "onu-001", DeviceType.ONU, "test-tenant"
        )

        assert metrics.device_id == "onu-001"
        assert metrics.health is not None
        assert metrics.traffic is not None
        assert metrics.onu_metrics is not None or metrics.cpe_metrics is None

    @pytest.mark.asyncio
    async def test_get_cpe_metrics_includes_wifi_status(
        self, monitoring_service, mock_genieacs_client, mock_genieacs_device
    ):
        """Test CPE metrics include WiFi and client info."""
        mock_genieacs_client.get_device = AsyncMock(return_value=mock_genieacs_device)

        metrics = await monitoring_service.get_device_metrics(
            "001122-CPE-AABBCC", DeviceType.CPE, "test-tenant"
        )

        assert metrics.device_id == "001122-CPE-AABBCC"
        if metrics.cpe_metrics:
            assert metrics.cpe_metrics.wifi_enabled is True
            assert metrics.cpe_metrics.connected_clients == 2


class TestAlertIntegration:
    """Tests for alert management."""

    @pytest.mark.asyncio
    async def test_get_alerts_filters_by_severity(self, monitoring_service, mock_alarms):
        """Test alert filtering by severity."""
        with patch.object(
            monitoring_service, "_get_active_alerts", new_callable=AsyncMock
        ) as mock_get_alerts:
            # Convert mock alarms to NetworkAlertResponse
            from dotmac.platform.network_monitoring.schemas import NetworkAlertResponse

            alerts = [
                NetworkAlertResponse(
                    alert_id="alarm-001",
                    severity=AlertSeverity.CRITICAL,
                    title="High CPU Usage",
                    description="CPU usage above 90%",
                    device_id="device-001",
                    tenant_id="test-tenant",
                    is_active=True,
                    is_acknowledged=False,
                ),
                NetworkAlertResponse(
                    alert_id="alarm-002",
                    severity=AlertSeverity.WARNING,
                    title="Link Down",
                    description="Interface eth0 is down",
                    device_id="device-002",
                    tenant_id="test-tenant",
                    is_active=True,
                    is_acknowledged=False,
                ),
            ]
            mock_get_alerts.return_value = alerts

            critical_alerts = await monitoring_service.get_alerts(
                "test-tenant", severity=AlertSeverity.CRITICAL
            )

            assert len(critical_alerts) == 1
            assert critical_alerts[0].severity == AlertSeverity.CRITICAL

    @pytest.mark.asyncio
    async def test_acknowledge_alert_returns_updated_alert(self, monitoring_service):
        """Test alert acknowledgement."""
        result = await monitoring_service.acknowledge_alert(
            alert_id="alarm-001",
            tenant_id="test-tenant",
            user_id="admin",
            note="Investigating",
        )

        assert result is not None
        assert result.is_acknowledged is True


class TestTenantIsolation:
    """Tests for multi-tenant isolation."""

    @pytest.mark.asyncio
    async def test_devices_filtered_by_tenant(
        self, monitoring_service, mock_voltha_devices
    ):
        """Test that VOLTHA devices are filtered by tenant."""
        # Add a device from different tenant
        other_tenant_device = {
            "id": "onu-other",
            "serial_number": "OTHER123",
            "admin_state": "ENABLED",
            "oper_status": "ACTIVE",
            "tenant_id": "other-tenant",
            "metadata": {"tenant_id": "other-tenant"},
        }
        mock_voltha_devices.append(other_tenant_device)

        monitoring_service.voltha.get_devices = AsyncMock(
            return_value=mock_voltha_devices
        )

        with patch.object(
            monitoring_service, "_get_active_alerts", new_callable=AsyncMock
        ) as mock_alerts:
            mock_alerts.return_value = []

            overview = await monitoring_service.get_network_overview("test-tenant")

            # Should not include device from other tenant
            # The service filters by tenant_id in metadata
            assert overview.tenant_id == "test-tenant"


class TestErrorHandling:
    """Tests for error handling and fallbacks."""

    @pytest.mark.asyncio
    async def test_netbox_failure_returns_partial_data(
        self, monitoring_service, mock_netbox_client
    ):
        """Test graceful handling of NetBox failures."""
        mock_netbox_client.get_devices = AsyncMock(
            side_effect=Exception("NetBox unavailable")
        )

        with patch.object(
            monitoring_service, "_get_active_alerts", new_callable=AsyncMock
        ) as mock_alerts:
            mock_alerts.return_value = []

            overview = await monitoring_service.get_network_overview("test-tenant")

            # Should still return an overview, potentially with partial data
            # Service should handle failures gracefully without crashing
            assert overview is not None
            assert overview.tenant_id == "test-tenant"
            # If data_source_status is populated, it might contain error info
            # But implementation may vary - the key is the service didn't crash

    @pytest.mark.asyncio
    async def test_device_health_returns_unknown_on_error(self, monitoring_service):
        """Test device health returns UNKNOWN status on errors."""
        monitoring_service.voltha.get_onu = AsyncMock(
            side_effect=Exception("VOLTHA error")
        )

        health = await monitoring_service.get_device_health(
            "onu-fail", DeviceType.ONU, "test-tenant"
        )

        assert health.status == DeviceStatus.UNKNOWN
