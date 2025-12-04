"""
Tests for Wireless Schemas with IPv6 Support

Test dual-stack support in wireless device and client schemas.
"""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from dotmac.platform.wireless.models import DeviceStatus, DeviceType, Frequency
from dotmac.platform.wireless.schemas import (
    WirelessClientResponse,
    WirelessDeviceCreate,
    WirelessDeviceResponse,
    WirelessDeviceUpdate,
)

pytestmark = pytest.mark.unit


class TestWirelessDeviceCreateIPv6:
    """Test wireless device creation with dual-stack IP support."""

    def test_create_device_with_ipv4_only(self):
        """Test creating wireless device with IPv4 management address only."""
        device = WirelessDeviceCreate(
            name="AP-01",
            device_type=DeviceType.ACCESS_POINT,
            management_ipv4="192.168.1.10",
            latitude=40.7128,
            longitude=-74.0060,
        )
        assert device.management_ipv4 == "192.168.1.10"
        assert device.management_ipv6 is None

    def test_create_device_with_ipv6_only(self):
        """Test creating wireless device with IPv6 management address only."""
        device = WirelessDeviceCreate(
            name="AP-02",
            device_type=DeviceType.ACCESS_POINT,
            management_ipv6="2001:db8::10",
            latitude=40.7128,
            longitude=-74.0060,
        )
        assert device.management_ipv4 is None
        assert device.management_ipv6 == "2001:db8::10"

    def test_create_device_with_dual_stack(self):
        """Test creating wireless device with both IPv4 and IPv6."""
        device = WirelessDeviceCreate(
            name="AP-03",
            device_type=DeviceType.ACCESS_POINT,
            management_ipv4="10.1.1.10",
            management_ipv6="2001:db8:cafe::10",
            ssid="FTTH-Public",
            latitude=40.7128,
            longitude=-74.0060,
        )
        assert device.management_ipv4 == "10.1.1.10"
        assert device.management_ipv6 == "2001:db8:cafe::10"

    def test_create_device_backward_compatibility(self):
        """Test backward compatibility with old ip_address field."""
        device = WirelessDeviceCreate(
            name="AP-04",
            device_type=DeviceType.ACCESS_POINT,
            ip_address="172.16.1.20",  # Old field
        )
        # Should map to management_ipv4
        assert device.management_ipv4 == "172.16.1.20"

    def test_invalid_ipv4_rejected(self):
        """Test invalid IPv4 address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WirelessDeviceCreate(
                name="AP-05",
                device_type=DeviceType.ACCESS_POINT,
                management_ipv4="256.1.1.1",  # Invalid
            )
        assert "Invalid IPv4" in str(exc_info.value)

    def test_invalid_ipv6_rejected(self):
        """Test invalid IPv6 address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WirelessDeviceCreate(
                name="AP-06",
                device_type=DeviceType.ACCESS_POINT,
                management_ipv6="gggg::1",  # Invalid
            )
        assert "Invalid IPv6" in str(exc_info.value)

    def test_ipv6_normalization(self):
        """Test IPv6 addresses are normalized."""
        device = WirelessDeviceCreate(
            name="AP-07",
            device_type=DeviceType.ACCESS_POINT,
            management_ipv6="2001:0db8:0000:0000:0000:0000:0000:0001",
        )
        # Should be normalized to compressed form
        assert device.management_ipv6 == "2001:db8::1"

    def test_complete_device_configuration(self):
        """Test creating device with complete configuration."""
        device = WirelessDeviceCreate(
            name="AP-Tower-North",
            device_type=DeviceType.BACKHAUL,
            status=DeviceStatus.ONLINE,
            manufacturer="Ubiquiti",
            model="AirFiber 60",
            serial_number="AF60-12345",
            mac_address="A4:2B:B0:E6:87:9A",
            firmware_version="v2.1.3",
            management_ipv4="192.168.100.5",
            management_ipv6="2001:db8:100::5",
            management_url="https://192.168.100.5",
            ssid="FTTH-Backhaul",
            latitude=40.7489,
            longitude=-73.9680,
            altitude_meters=150.5,
            tower_height_meters=50.0,
            mounting_height_meters=45.0,
            azimuth_degrees=45.0,
            tilt_degrees=-5.0,
            notes="North sector backhaul link",
        )
        assert device.management_ipv4 == "192.168.100.5"
        assert device.management_ipv6 == "2001:db8:100::5"
        assert device.manufacturer == "Ubiquiti"


class TestWirelessDeviceUpdateIPv6:
    """Test wireless device update with dual-stack IP support."""

    def test_update_ipv4_address(self):
        """Test updating IPv4 management address."""
        update = WirelessDeviceUpdate(management_ipv4="10.2.2.20")
        assert update.management_ipv4 == "10.2.2.20"

    def test_update_ipv6_address(self):
        """Test updating IPv6 management address."""
        update = WirelessDeviceUpdate(management_ipv6="2001:db8::200")
        assert update.management_ipv6 == "2001:db8::200"

    def test_update_dual_stack(self):
        """Test updating both IPv4 and IPv6."""
        update = WirelessDeviceUpdate(
            management_ipv4="172.16.1.1",
            management_ipv6="fe80::1",
        )
        assert update.management_ipv4 == "172.16.1.1"
        assert update.management_ipv6 == "fe80::1"

    def test_update_backward_compatibility(self):
        """Test backward compatibility in update."""
        update = WirelessDeviceUpdate(ip_address="10.3.3.3")
        assert update.management_ipv4 == "10.3.3.3"


class TestWirelessDeviceResponseIPv6:
    """Test wireless device response with dual-stack IP."""

    def test_response_dual_stack(self):
        """Test response includes both IPv4 and IPv6."""
        from datetime import datetime

        response = WirelessDeviceResponse(
            id=uuid4(),
            tenant_id="tenant1",
            name="AP-Main",
            device_type=DeviceType.ACCESS_POINT,
            status=DeviceStatus.ONLINE,
            management_ipv4="192.168.1.50",
            management_ipv6="2001:db8::50",
            ssid="FTTH-Wireless",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        assert response.management_ipv4 == "192.168.1.50"
        assert response.management_ipv6 == "2001:db8::50"

    def test_response_backward_compatible_property(self):
        """Test backward compatible ip_address property."""
        from datetime import datetime

        response = WirelessDeviceResponse(
            id=uuid4(),
            tenant_id="tenant1",
            name="AP-Main",
            device_type=DeviceType.ACCESS_POINT,
            status=DeviceStatus.ONLINE,
            management_ipv4="192.168.1.50",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        # Old property should return IPv4 address
        assert response.ip_address == "192.168.1.50"


class TestWirelessClientResponseIPv6:
    """Test wireless client response with dual-stack IP."""

    def test_client_with_ipv4_only(self):
        """Test client response with IPv4 address only."""
        from datetime import datetime

        client = WirelessClientResponse(
            id=uuid4(),
            tenant_id="tenant1",
            device_id=uuid4(),
            mac_address="00:11:22:33:44:55",
            ipv4_address="192.168.10.100",
            hostname="laptop-01",
            ssid="FTTH-Wireless",
            frequency=Frequency.FREQ_5_GHZ,
            connected=True,
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        assert client.ipv4_address == "192.168.10.100"
        assert client.ipv6_address is None

    def test_client_with_ipv6_only(self):
        """Test client response with IPv6 address only."""
        from datetime import datetime

        client = WirelessClientResponse(
            id=uuid4(),
            tenant_id="tenant1",
            device_id=uuid4(),
            mac_address="AA:BB:CC:DD:EE:FF",
            ipv6_address="2001:db8:cafe::100",
            hostname="tablet-01",
            ssid="FTTH-Wireless",
            frequency=Frequency.FREQ_5_GHZ,
            connected=True,
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        assert client.ipv4_address is None
        assert client.ipv6_address == "2001:db8:cafe::100"

    def test_client_with_dual_stack(self):
        """Test client response with both IPv4 and IPv6."""
        from datetime import datetime

        client = WirelessClientResponse(
            id=uuid4(),
            tenant_id="tenant1",
            device_id=uuid4(),
            mac_address="11:22:33:44:55:66",
            ipv4_address="192.168.10.50",
            ipv6_address="2001:db8:cafe::50",
            hostname="phone-01",
            ssid="FTTH-Wireless",
            frequency=Frequency.FREQ_2_4_GHZ,
            channel=6,
            connected=True,
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
            rssi_dbm=-45.5,
            snr_db=35.2,
            tx_rate_mbps=150.0,
            rx_rate_mbps=120.0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        assert client.ipv4_address == "192.168.10.50"
        assert client.ipv6_address == "2001:db8:cafe::50"

    def test_client_backward_compatible_property(self):
        """Test backward compatible ip_address property."""
        from datetime import datetime

        client = WirelessClientResponse(
            id=uuid4(),
            tenant_id="tenant1",
            device_id=uuid4(),
            mac_address="AA:BB:CC:DD:EE:FF",
            ipv4_address="192.168.10.25",
            ipv6_address="2001:db8::25",
            connected=True,
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        # Old property should return IPv4 address
        assert client.ip_address == "192.168.10.25"

    def test_client_invalid_ipv4_rejected(self):
        """Test invalid IPv4 address is rejected."""
        from datetime import datetime

        with pytest.raises(ValidationError) as exc_info:
            WirelessClientResponse(
                id=uuid4(),
                tenant_id="tenant1",
                device_id=uuid4(),
                mac_address="AA:BB:CC:DD:EE:FF",
                ipv4_address="999.1.1.1",  # Invalid
                connected=True,
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        assert "Invalid IPv4" in str(exc_info.value)

    def test_client_invalid_ipv6_rejected(self):
        """Test invalid IPv6 address is rejected."""
        from datetime import datetime

        with pytest.raises(ValidationError) as exc_info:
            WirelessClientResponse(
                id=uuid4(),
                tenant_id="tenant1",
                device_id=uuid4(),
                mac_address="AA:BB:CC:DD:EE:FF",
                ipv6_address="zzzz::1",  # Invalid
                connected=True,
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        assert "Invalid IPv6" in str(exc_info.value)

    def test_client_ipv6_normalization(self):
        """Test IPv6 addresses are normalized."""
        from datetime import datetime

        client = WirelessClientResponse(
            id=uuid4(),
            tenant_id="tenant1",
            device_id=uuid4(),
            mac_address="AA:BB:CC:DD:EE:FF",
            ipv6_address="2001:0db8:0000:0000:0000:0000:0000:0100",
            connected=True,
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        # Should be normalized to compressed form
        assert client.ipv6_address == "2001:db8::100"


class TestWirelessEdgeCases:
    """Test edge cases and special scenarios."""

    def test_base_station_with_backhaul_ips(self):
        """Test base station with dual-stack configuration."""
        device = WirelessDeviceCreate(
            name="BS-Tower-01",
            device_type=DeviceType.BACKHAUL,
            status=DeviceStatus.ONLINE,
            management_ipv4="192.168.200.1",
            management_ipv6="fd00:200::1",
            ssid="FTTH-Backhaul",
            latitude=40.7580,
            longitude=-73.9855,
            tower_height_meters=75.0,
            azimuth_degrees=180.0,
        )
        assert device.device_type == DeviceType.BACKHAUL
        assert device.management_ipv4 == "192.168.200.1"
        assert device.management_ipv6 == "fd00:200::1"

    def test_device_with_link_local_ipv6(self):
        """Test device with IPv6 link-local address."""
        device = WirelessDeviceCreate(
            name="AP-Link-Local",
            device_type=DeviceType.ACCESS_POINT,
            management_ipv6="fe80::1",
        )
        assert device.management_ipv6 == "fe80::1"

    def test_client_with_no_ip_addresses(self):
        """Test client without IP addresses (not yet assigned)."""
        from datetime import datetime

        client = WirelessClientResponse(
            id=uuid4(),
            tenant_id="tenant1",
            device_id=uuid4(),
            mac_address="FF:EE:DD:CC:BB:AA",
            connected=False,
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        assert client.ipv4_address is None
        assert client.ipv6_address is None
        assert client.ip_address is None  # Backward compatible property
