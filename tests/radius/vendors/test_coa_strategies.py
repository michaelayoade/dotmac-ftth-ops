"""
Unit tests for vendor-specific CoA strategies.
"""

from dotmac.platform.radius.vendors import (
    CiscoCoAStrategy,
    HuaweiCoAStrategy,
    JuniperCoAStrategy,
    MikrotikCoAStrategy,
    NASVendor,
    get_coa_strategy,
)


class TestMikrotikCoAStrategy:
    """Test Mikrotik CoA strategy."""

    def test_build_bandwidth_change_packet(self):
        """Test Mikrotik bandwidth change packet."""
        strategy = MikrotikCoAStrategy()

        packet = strategy.build_bandwidth_change_packet(
            username="user@example.com",
            download_kbps=10000,
            upload_kbps=5000,
            nas_ip="10.0.1.1",
        )

        assert packet["User-Name"] == "user@example.com"
        assert packet["Mikrotik-Rate-Limit"] == "10000k/5000k"
        assert packet["NAS-IP-Address"] == "10.0.1.1"

    def test_build_bandwidth_change_with_burst(self):
        """Test Mikrotik bandwidth change with burst."""
        strategy = MikrotikCoAStrategy()

        packet = strategy.build_bandwidth_change_packet(
            username="user@example.com",
            download_kbps=10000,
            upload_kbps=5000,
            download_burst_kbps=15000,
            upload_burst_kbps=7500,
        )

        assert packet["Mikrotik-Rate-Limit"] == "10000k/5000k 15000k/7500k"

    def test_build_disconnect_packet(self):
        """Test Mikrotik disconnect packet."""
        strategy = MikrotikCoAStrategy()

        packet = strategy.build_disconnect_packet(
            username="user@example.com",
            nas_ip="10.0.1.1",
            session_id="abc123",
        )

        assert packet["User-Name"] == "user@example.com"
        assert packet["NAS-IP-Address"] == "10.0.1.1"
        assert packet["Acct-Session-Id"] == "abc123"

    def test_validate_response_success(self):
        """Test Mikrotik response validation (success)."""
        strategy = MikrotikCoAStrategy()

        # CoA-ACK (code 44)
        assert strategy.validate_response({"code": 44}) is True

        # Disconnect-ACK (code 41)
        assert strategy.validate_response({"code": 41}) is True

    def test_validate_response_failure(self):
        """Test Mikrotik response validation (failure)."""
        strategy = MikrotikCoAStrategy()

        # CoA-NAK (code 45)
        assert strategy.validate_response({"code": 45}) is False

        # Other code
        assert strategy.validate_response({"code": 99}) is False


class TestCiscoCoAStrategy:
    """Test Cisco CoA strategy."""

    def test_build_bandwidth_change_packet(self):
        """Test Cisco bandwidth change packet."""
        strategy = CiscoCoAStrategy()

        packet = strategy.build_bandwidth_change_packet(
            username="user@example.com",
            download_kbps=10000,
            upload_kbps=5000,
        )

        assert packet["User-Name"] == "user@example.com"
        assert "Cisco-AVPair" in packet
        # Cisco uses bps
        assert "5000000" in packet["Cisco-AVPair"]  # upload
        assert "10000000" in packet["Cisco-AVPair"]  # download

    def test_build_disconnect_packet(self):
        """Test Cisco disconnect packet."""
        strategy = CiscoCoAStrategy()

        packet = strategy.build_disconnect_packet(
            username="user@example.com",
            nas_ip="10.0.1.1",
        )

        assert packet["User-Name"] == "user@example.com"
        assert packet["Acct-Terminate-Cause"] == "Admin-Reset"


class TestHuaweiCoAStrategy:
    """Test Huawei CoA strategy."""

    def test_build_bandwidth_change_packet(self):
        """Test Huawei bandwidth change packet."""
        strategy = HuaweiCoAStrategy()

        packet = strategy.build_bandwidth_change_packet(
            username="user@example.com",
            download_kbps=10000,
            upload_kbps=5000,
        )

        assert packet["User-Name"] == "user@example.com"
        assert packet["Huawei-Input-Rate-Limit"] == "5000"  # upload
        assert packet["Huawei-Output-Rate-Limit"] == "10000"  # download

    def test_build_bandwidth_change_with_burst(self):
        """Test Huawei bandwidth change with burst."""
        strategy = HuaweiCoAStrategy()

        packet = strategy.build_bandwidth_change_packet(
            username="user@example.com",
            download_kbps=10000,
            upload_kbps=5000,
            download_burst_kbps=15000,
            upload_burst_kbps=7500,
        )

        assert packet["Huawei-Output-Peak-Rate"] == "15000"
        assert packet["Huawei-Input-Peak-Rate"] == "7500"


class TestJuniperCoAStrategy:
    """Test Juniper CoA strategy."""

    def test_build_bandwidth_change_packet(self):
        """Test Juniper bandwidth change packet."""
        strategy = JuniperCoAStrategy()

        packet = strategy.build_bandwidth_change_packet(
            username="user@example.com",
            download_kbps=10000,
            upload_kbps=5000,
        )

        assert packet["User-Name"] == "user@example.com"
        # Juniper uses bps
        assert packet["Juniper-Rate-Limit-In"] == "5000000"
        assert packet["Juniper-Rate-Limit-Out"] == "10000000"


class TestCoAStrategyRegistry:
    """Test CoA strategy registry and factory."""

    def test_get_mikrotik_strategy(self):
        """Test getting Mikrotik strategy."""
        strategy = get_coa_strategy(vendor=NASVendor.MIKROTIK)
        assert isinstance(strategy, MikrotikCoAStrategy)

    def test_get_cisco_strategy(self):
        """Test getting Cisco strategy."""
        strategy = get_coa_strategy(vendor=NASVendor.CISCO)
        assert isinstance(strategy, CiscoCoAStrategy)

    def test_get_huawei_strategy(self):
        """Test getting Huawei strategy."""
        strategy = get_coa_strategy(vendor=NASVendor.HUAWEI)
        assert isinstance(strategy, HuaweiCoAStrategy)

    def test_get_juniper_strategy(self):
        """Test getting Juniper strategy."""
        strategy = get_coa_strategy(vendor=NASVendor.JUNIPER)
        assert isinstance(strategy, JuniperCoAStrategy)

    def test_get_strategy_string_vendor(self):
        """Test getting strategy with string vendor."""
        strategy = get_coa_strategy(vendor="cisco")
        assert isinstance(strategy, CiscoCoAStrategy)

    def test_get_strategy_default(self):
        """Test getting default strategy (Mikrotik)."""
        strategy = get_coa_strategy()
        assert isinstance(strategy, MikrotikCoAStrategy)
