
"""
Tests for Network Monitoring Schemas with IPv6 Support

Test dual-stack support in device health and CPE metrics schemas.
"""

import pytest
from pydantic import ValidationError

from dotmac.platform.network_monitoring.schemas import (



    CPEMetrics,
    DeviceHealthResponse,
    DeviceStatus,
    DeviceType,
)




pytestmark = pytest.mark.unit

class TestDeviceHealthResponseIPv6:
    """Test device health response with dual-stack IP support."""

    def test_device_health_with_ipv4_only(self):
        """Test device health with IPv4 management address only."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="device123",
            device_name="Router-01",
            device_type=DeviceType.ROUTER,
            status=DeviceStatus.ONLINE,
            management_ipv4="192.168.1.1",
            last_seen=datetime.utcnow(),
            uptime_seconds=3600,
        )
        assert health.management_ipv4 == "192.168.1.1"
        assert health.management_ipv6 is None
        assert health.data_plane_ipv4 is None
        assert health.data_plane_ipv6 is None

    def test_device_health_with_ipv6_only(self):
        """Test device health with IPv6 management address only."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="device123",
            device_name="Router-01",
            device_type=DeviceType.ROUTER,
            status=DeviceStatus.ONLINE,
            management_ipv6="2001:db8::1",
            last_seen=datetime.utcnow(),
            uptime_seconds=3600,
        )
        assert health.management_ipv4 is None
        assert health.management_ipv6 == "2001:db8::1"

    def test_device_health_with_dual_stack(self):
        """Test device health with both IPv4 and IPv6 management addresses."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="device123",
            device_name="Router-01",
            device_type=DeviceType.ROUTER,
            status=DeviceStatus.ONLINE,
            management_ipv4="10.1.1.1",
            management_ipv6="2001:db8::1",
            last_seen=datetime.utcnow(),
            uptime_seconds=7200,
        )
        assert health.management_ipv4 == "10.1.1.1"
        assert health.management_ipv6 == "2001:db8::1"

    def test_device_health_with_separate_data_plane(self):
        """Test device with separate management and data plane IPs."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="device123",
            device_name="OLT-01",
            device_type=DeviceType.OLT,
            status=DeviceStatus.ONLINE,
            management_ipv4="192.168.100.1",
            management_ipv6="2001:db8:100::1",
            data_plane_ipv4="10.0.0.1",
            data_plane_ipv6="2001:db8:1::1",
            last_seen=datetime.utcnow(),
            cpu_usage_percent=45.2,
            memory_usage_percent=62.8,
        )
        assert health.management_ipv4 == "192.168.100.1"
        assert health.management_ipv6 == "2001:db8:100::1"
        assert health.data_plane_ipv4 == "10.0.0.1"
        assert health.data_plane_ipv6 == "2001:db8:1::1"

    def test_device_health_backward_compatible_property(self):
        """Test backward compatible ip_address property."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="device123",
            device_name="Router-01",
            device_type=DeviceType.ROUTER,
            status=DeviceStatus.ONLINE,
            management_ipv4="172.16.1.1",
            management_ipv6="2001:db8::1",
            last_seen=datetime.utcnow(),
        )
        # Old property should return IPv4 address
        assert health.ip_address == "172.16.1.1"

    def test_invalid_ipv4_rejected(self):
        """Test invalid IPv4 address is rejected."""
        from datetime import datetime

        with pytest.raises(ValidationError) as exc_info:
            DeviceHealthResponse(
                device_id="device123",
                device_name="Router-01",
                device_type=DeviceType.ROUTER,
                status=DeviceStatus.ONLINE,
                management_ipv4="256.1.1.1",  # Invalid
                last_seen=datetime.utcnow(),
            )
        assert "Invalid IPv4" in str(exc_info.value)

    def test_invalid_ipv6_rejected(self):
        """Test invalid IPv6 address is rejected."""
        from datetime import datetime

        with pytest.raises(ValidationError) as exc_info:
            DeviceHealthResponse(
                device_id="device123",
                device_name="Router-01",
                device_type=DeviceType.ROUTER,
                status=DeviceStatus.ONLINE,
                management_ipv6="gggg::1",  # Invalid
                last_seen=datetime.utcnow(),
            )
        assert "Invalid IPv6" in str(exc_info.value)

    def test_ipv6_normalization(self):
        """Test IPv6 addresses are normalized."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="device123",
            device_name="Router-01",
            device_type=DeviceType.ROUTER,
            status=DeviceStatus.ONLINE,
            management_ipv6="2001:0db8:0000:0000:0000:0000:0000:0001",
            last_seen=datetime.utcnow(),
        )
        # Should be normalized to compressed form
        assert health.management_ipv6 == "2001:db8::1"

    def test_whitespace_trimmed(self):
        """Test IP addresses with whitespace are trimmed."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="device123",
            device_name="Router-01",
            device_type=DeviceType.ROUTER,
            status=DeviceStatus.ONLINE,
            management_ipv4="  10.1.1.1  ",
            management_ipv6="  2001:db8::1  ",
            last_seen=datetime.utcnow(),
        )
        assert health.management_ipv4 == "10.1.1.1"
        assert health.management_ipv6 == "2001:db8::1"


class TestCPEMetricsIPv6:
    """Test CPE metrics with dual-stack WAN IP support."""

    def test_cpe_metrics_with_ipv4_wan(self):
        """Test CPE metrics with IPv4 WAN address."""
        metrics = CPEMetrics(
            mac_address="00:11:22:33:44:55",
            wifi_enabled=True,
            connected_clients=5,
            wan_ipv4="203.0.113.1",
        )
        assert metrics.wan_ipv4 == "203.0.113.1"
        assert metrics.wan_ipv6 is None

    def test_cpe_metrics_with_ipv6_wan(self):
        """Test CPE metrics with IPv6 WAN address."""
        metrics = CPEMetrics(
            mac_address="00:11:22:33:44:55",
            wifi_enabled=True,
            connected_clients=3,
            wan_ipv6="2001:db8:abcd::1",
        )
        assert metrics.wan_ipv4 is None
        assert metrics.wan_ipv6 == "2001:db8:abcd::1"

    def test_cpe_metrics_with_dual_stack_wan(self):
        """Test CPE metrics with dual-stack WAN addresses."""
        metrics = CPEMetrics(
            mac_address="00:11:22:33:44:55",
            wifi_enabled=True,
            connected_clients=8,
            wifi_2ghz_clients=3,
            wifi_5ghz_clients=5,
            wan_ipv4="203.0.113.50",
            wan_ipv6="2001:db8:cafe::50",
        )
        assert metrics.wan_ipv4 == "203.0.113.50"
        assert metrics.wan_ipv6 == "2001:db8:cafe::50"

    def test_cpe_metrics_backward_compatible_property(self):
        """Test backward compatible wan_ip property."""
        metrics = CPEMetrics(
            mac_address="00:11:22:33:44:55",
            wan_ipv4="198.51.100.1",
            wan_ipv6="2001:db8::1",
        )
        # Old property should return IPv4 WAN address
        assert metrics.wan_ip == "198.51.100.1"

    def test_cpe_metrics_invalid_ipv4_wan_rejected(self):
        """Test invalid IPv4 WAN address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CPEMetrics(
                mac_address="00:11:22:33:44:55",
                wan_ipv4="999.999.999.999",  # Invalid
            )
        assert "Invalid IPv4" in str(exc_info.value)

    def test_cpe_metrics_invalid_ipv6_wan_rejected(self):
        """Test invalid IPv6 WAN address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CPEMetrics(
                mac_address="00:11:22:33:44:55",
                wan_ipv6="zzzz::1",  # Invalid
            )
        assert "Invalid IPv6" in str(exc_info.value)

    def test_cpe_metrics_ipv6_normalization(self):
        """Test IPv6 WAN addresses are normalized."""
        metrics = CPEMetrics(
            mac_address="00:11:22:33:44:55",
            wan_ipv6="2001:0db8:0000:0000:0000:0000:0000:0100",
        )
        # Should be normalized to compressed form
        assert metrics.wan_ipv6 == "2001:db8::100"


class TestDeviceMonitoringEdgeCases:
    """Test edge cases and special scenarios."""

    def test_olt_device_with_full_metrics(self):
        """Test OLT device with complete dual-stack configuration."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="olt-001",
            device_name="OLT-Main-01",
            device_type=DeviceType.OLT,
            status=DeviceStatus.ONLINE,
            management_ipv4="192.168.100.1",
            management_ipv6="fd00:100::1",
            data_plane_ipv4="10.0.0.1",
            data_plane_ipv6="2001:db8:1::1",
            last_seen=datetime.utcnow(),
            uptime_seconds=864000,
            cpu_usage_percent=35.5,
            memory_usage_percent=58.2,
            temperature_celsius=42.3,
            ping_latency_ms=1.2,
            packet_loss_percent=0.01,
            firmware_version="v3.2.1",
            model="OLT-4000",
            location="DC-North",
            tenant_id="tenant_123",
        )
        assert health.device_type == DeviceType.OLT
        assert health.management_ipv4 == "192.168.100.1"
        assert health.management_ipv6 == "fd00:100::1"
        assert health.data_plane_ipv4 == "10.0.0.1"
        assert health.data_plane_ipv6 == "2001:db8:1::1"

    def test_cpe_with_no_wan_ip(self):
        """Test CPE without WAN IP (not yet online)."""
        metrics = CPEMetrics(
            mac_address="AA:BB:CC:DD:EE:FF",
            wifi_enabled=False,
            connected_clients=0,
        )
        assert metrics.wan_ipv4 is None
        assert metrics.wan_ipv6 is None
        assert metrics.wan_ip is None  # Backward compatible property

    def test_device_with_link_local_ipv6(self):
        """Test device with IPv6 link-local address."""
        from datetime import datetime

        health = DeviceHealthResponse(
            device_id="device123",
            device_name="Switch-01",
            device_type=DeviceType.SWITCH,
            status=DeviceStatus.ONLINE,
            management_ipv6="fe80::1",
            last_seen=datetime.utcnow(),
        )
        assert health.management_ipv6 == "fe80::1"
