"""
Tests for GenieACS Schemas with IPv6 Support

Test dual-stack support in CPE configuration schemas.
"""

import pytest
from pydantic import ValidationError

from dotmac.platform.genieacs.schemas import (
    LANConfig,
    WANConfig,
    CPEConfigRequest,
    MassLANConfig,
    MassWANConfig,
    MassConfigRequest,
    MassConfigFilter,
)


class TestLANConfigIPv6:
    """Test LAN configuration with dual-stack support."""

    def test_lan_config_ipv4_only(self):
        """Test LAN configuration with IPv4 only."""
        lan = LANConfig(
            ipv4_address="192.168.1.1",
            subnet_mask="255.255.255.0",
            dhcp_enabled=True,
            dhcp_start="192.168.1.100",
            dhcp_end="192.168.1.200",
        )
        assert lan.ipv4_address == "192.168.1.1"
        assert lan.subnet_mask == "255.255.255.0"
        assert lan.ipv6_address is None
        assert lan.dhcp_enabled is True

    def test_lan_config_ipv6_only(self):
        """Test LAN configuration with IPv6 only."""
        lan = LANConfig(
            ipv6_address="fd00::1",
            ipv6_prefix_length=64,
            dhcpv6_enabled=True,
        )
        assert lan.ipv4_address is None
        assert lan.ipv6_address == "fd00::1"
        assert lan.ipv6_prefix_length == 64
        assert lan.dhcpv6_enabled is True

    def test_lan_config_dual_stack(self):
        """Test LAN configuration with both IPv4 and IPv6."""
        lan = LANConfig(
            ipv4_address="192.168.1.1",
            subnet_mask="255.255.255.0",
            ipv6_address="fd00::1",
            ipv6_prefix_length=64,
            dhcp_enabled=True,
            dhcp_start="192.168.1.100",
            dhcp_end="192.168.1.200",
            dhcpv6_enabled=True,
        )
        assert lan.ipv4_address == "192.168.1.1"
        assert lan.ipv6_address == "fd00::1"
        assert lan.dhcp_enabled is True
        assert lan.dhcpv6_enabled is True

    def test_lan_config_backward_compatibility(self):
        """Test backward compatibility with old ip_address field."""
        lan = LANConfig(
            ip_address="192.168.1.1",  # Old field
            subnet_mask="255.255.255.0",
        )
        # Should map to ipv4_address
        assert lan.ipv4_address == "192.168.1.1"

    def test_lan_config_invalid_ipv4_rejected(self):
        """Test invalid IPv4 address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            LANConfig(
                ipv4_address="256.1.1.1",  # Invalid
                subnet_mask="255.255.255.0",
            )
        assert "Invalid IPv4" in str(exc_info.value)

    def test_lan_config_invalid_ipv6_rejected(self):
        """Test invalid IPv6 address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            LANConfig(
                ipv6_address="gggg::1",  # Invalid
                ipv6_prefix_length=64,
            )
        assert "Invalid IPv6" in str(exc_info.value)

    def test_lan_config_invalid_dhcp_pool_rejected(self):
        """Test invalid DHCP pool addresses are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            LANConfig(
                ipv4_address="192.168.1.1",
                subnet_mask="255.255.255.0",
                dhcp_start="999.1.1.1",  # Invalid
                dhcp_end="192.168.1.200",
            )
        assert "Invalid IPv4" in str(exc_info.value)

    def test_lan_config_ipv6_normalization(self):
        """Test IPv6 addresses are normalized."""
        lan = LANConfig(
            ipv6_address="2001:0db8:0000:0000:0000:0000:0000:0001",
            ipv6_prefix_length=64,
        )
        # Should be normalized to compressed form
        assert lan.ipv6_address == "2001:db8::1"


class TestWANConfigIPv6:
    """Test WAN configuration with dual-stack support."""

    def test_wan_config_dhcp_ipv4(self):
        """Test WAN configuration with DHCP IPv4."""
        wan = WANConfig(
            connection_type="DHCP",
            vlan_id=100,
        )
        assert wan.connection_type == "DHCP"
        assert wan.vlan_id == 100

    def test_wan_config_dhcpv6(self):
        """Test WAN configuration with DHCPv6."""
        wan = WANConfig(
            connection_type="DHCPv6",
            vlan_id=100,
            ipv6_pd_enabled=True,
        )
        assert wan.connection_type == "DHCPv6"
        assert wan.ipv6_pd_enabled is True

    def test_wan_config_pppoe_ipv4(self):
        """Test WAN configuration with PPPoE IPv4."""
        wan = WANConfig(
            connection_type="PPPoE",
            username="user@isp.com",
            password="securepass123",
            vlan_id=10,
        )
        assert wan.connection_type == "PPPoE"
        assert wan.username == "user@isp.com"

    def test_wan_config_pppoev6(self):
        """Test WAN configuration with PPPoEv6."""
        wan = WANConfig(
            connection_type="PPPoEv6",
            username="user@isp.com",
            password="securepass123",
            vlan_id=10,
            ipv6_pd_enabled=True,
        )
        assert wan.connection_type == "PPPoEv6"
        assert wan.ipv6_pd_enabled is True

    def test_wan_config_static_ipv4(self):
        """Test WAN configuration with static IPv4."""
        wan = WANConfig(
            connection_type="Static",
            static_ipv4="203.0.113.10",
            static_ipv4_gateway="203.0.113.1",
            static_ipv4_netmask="255.255.255.0",
        )
        assert wan.static_ipv4 == "203.0.113.10"
        assert wan.static_ipv4_gateway == "203.0.113.1"

    def test_wan_config_static_ipv6(self):
        """Test WAN configuration with static IPv6."""
        wan = WANConfig(
            connection_type="Static",
            static_ipv6="2001:db8::10",
            static_ipv6_gateway="2001:db8::1",
            static_ipv6_prefix_length=64,
        )
        assert wan.static_ipv6 == "2001:db8::10"
        assert wan.static_ipv6_gateway == "2001:db8::1"
        assert wan.static_ipv6_prefix_length == 64

    def test_wan_config_dual_stack_static(self):
        """Test WAN configuration with dual-stack static IPs."""
        wan = WANConfig(
            connection_type="Static",
            static_ipv4="203.0.113.10",
            static_ipv4_gateway="203.0.113.1",
            static_ipv4_netmask="255.255.255.0",
            static_ipv6="2001:db8::10",
            static_ipv6_gateway="2001:db8::1",
            static_ipv6_prefix_length=64,
        )
        assert wan.static_ipv4 == "203.0.113.10"
        assert wan.static_ipv6 == "2001:db8::10"

    def test_wan_config_invalid_ipv4_rejected(self):
        """Test invalid static IPv4 address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WANConfig(
                connection_type="Static",
                static_ipv4="999.1.1.1",  # Invalid
                static_ipv4_gateway="203.0.113.1",
            )
        assert "Invalid IPv4" in str(exc_info.value)

    def test_wan_config_invalid_ipv6_rejected(self):
        """Test invalid static IPv6 address is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WANConfig(
                connection_type="Static",
                static_ipv6="zzzz::1",  # Invalid
                static_ipv6_gateway="2001:db8::1",
            )
        assert "Invalid IPv6" in str(exc_info.value)

    def test_wan_config_ipv6_normalization(self):
        """Test IPv6 addresses are normalized."""
        wan = WANConfig(
            connection_type="Static",
            static_ipv6="2001:0db8:0000:0000:0000:0000:0000:0010",
            static_ipv6_gateway="2001:0db8:0000:0000:0000:0000:0000:0001",
            static_ipv6_prefix_length=64,
        )
        # Should be normalized to compressed form
        assert wan.static_ipv6 == "2001:db8::10"
        assert wan.static_ipv6_gateway == "2001:db8::1"


class TestCPEConfigRequestIPv6:
    """Test CPE configuration request with dual-stack support."""

    def test_cpe_config_with_dual_stack_lan(self):
        """Test CPE configuration with dual-stack LAN."""
        from dotmac.platform.genieacs.schemas import WiFiConfig

        config = CPEConfigRequest(
            device_id="CPE-12345",
            wifi=WiFiConfig(
                ssid="MyNetwork",
                password="securepass123",
            ),
            lan=LANConfig(
                ipv4_address="192.168.1.1",
                subnet_mask="255.255.255.0",
                ipv6_address="fd00::1",
                ipv6_prefix_length=64,
                dhcp_enabled=True,
                dhcpv6_enabled=True,
            ),
        )
        assert config.device_id == "CPE-12345"
        assert config.lan.ipv4_address == "192.168.1.1"
        assert config.lan.ipv6_address == "fd00::1"

    def test_cpe_config_with_dual_stack_wan(self):
        """Test CPE configuration with dual-stack WAN."""
        config = CPEConfigRequest(
            device_id="CPE-67890",
            wan=WANConfig(
                connection_type="Static",
                static_ipv4="203.0.113.50",
                static_ipv4_gateway="203.0.113.1",
                static_ipv4_netmask="255.255.255.0",
                static_ipv6="2001:db8::50",
                static_ipv6_gateway="2001:db8::1",
                static_ipv6_prefix_length=64,
            ),
        )
        assert config.wan.static_ipv4 == "203.0.113.50"
        assert config.wan.static_ipv6 == "2001:db8::50"


class TestMassLANConfigIPv6:
    """Test mass LAN configuration with dual-stack support."""

    def test_mass_lan_config_dual_stack(self):
        """Test mass LAN configuration with both IPv4 and IPv6."""
        mass_lan = MassLANConfig(
            ipv4_address="192.168.10.1",
            subnet_mask="255.255.255.0",
            ipv6_address="fd00:10::1",
            ipv6_prefix_length=64,
            dhcp_enabled=True,
            dhcp_start="192.168.10.100",
            dhcp_end="192.168.10.200",
            dhcpv6_enabled=True,
        )
        assert mass_lan.ipv4_address == "192.168.10.1"
        assert mass_lan.ipv6_address == "fd00:10::1"
        assert mass_lan.dhcpv6_enabled is True

    def test_mass_lan_config_invalid_ipv4_rejected(self):
        """Test invalid IPv4 address is rejected in mass config."""
        with pytest.raises(ValidationError) as exc_info:
            MassLANConfig(
                ipv4_address="256.1.1.1",  # Invalid
            )
        assert "Invalid IPv4" in str(exc_info.value)


class TestMassWANConfigIPv6:
    """Test mass WAN configuration with dual-stack support."""

    def test_mass_wan_config_dual_stack_static(self):
        """Test mass WAN configuration with dual-stack static IPs."""
        mass_wan = MassWANConfig(
            connection_type="Static",
            static_ipv4="203.0.113.100",
            static_ipv4_gateway="203.0.113.1",
            static_ipv4_netmask="255.255.255.0",
            static_ipv6="2001:db8:cafe::100",
            static_ipv6_gateway="2001:db8:cafe::1",
            static_ipv6_prefix_length=64,
        )
        assert mass_wan.static_ipv4 == "203.0.113.100"
        assert mass_wan.static_ipv6 == "2001:db8:cafe::100"

    def test_mass_wan_config_dhcpv6_with_pd(self):
        """Test mass WAN configuration with DHCPv6 and prefix delegation."""
        mass_wan = MassWANConfig(
            connection_type="DHCPv6",
            vlan_id=100,
            ipv6_pd_enabled=True,
        )
        assert mass_wan.connection_type == "DHCPv6"
        assert mass_wan.ipv6_pd_enabled is True


class TestMassConfigRequestIPv6:
    """Test mass configuration request with dual-stack support."""

    def test_mass_config_dual_stack_lan_wan(self):
        """Test mass configuration with dual-stack LAN and WAN."""
        from dotmac.platform.genieacs.schemas import MassWiFiConfig

        mass_config = MassConfigRequest(
            name="Deploy Dual-Stack Configuration",
            description="Roll out IPv6 to all CPEs",
            device_filter=MassConfigFilter(
                query={"manufacturer": "Huawei", "model": "HG8245H"},
                expected_count=100,
            ),
            wifi=MassWiFiConfig(
                ssid="FTTH-Network",
                password="newpassword123",
            ),
            lan=MassLANConfig(
                ipv4_address="192.168.1.1",
                ipv6_address="fd00::1",
                ipv6_prefix_length=64,
                dhcpv6_enabled=True,
            ),
            wan=MassWANConfig(
                connection_type="DHCPv6",
                ipv6_pd_enabled=True,
            ),
            max_concurrent=20,
        )
        assert mass_config.name == "Deploy Dual-Stack Configuration"
        assert mass_config.lan.ipv6_address == "fd00::1"
        assert mass_config.wan.ipv6_pd_enabled is True


class TestGenieACSEdgeCases:
    """Test edge cases and special scenarios."""

    def test_lan_config_with_link_local_ipv6(self):
        """Test LAN configuration with IPv6 link-local address."""
        lan = LANConfig(
            ipv6_address="fe80::1",
            ipv6_prefix_length=64,
        )
        assert lan.ipv6_address == "fe80::1"

    def test_wan_config_with_ula_ipv6(self):
        """Test WAN configuration with IPv6 unique local address (ULA)."""
        wan = WANConfig(
            connection_type="Static",
            static_ipv6="fc00::1",
            static_ipv6_gateway="fc00::ffff",
            static_ipv6_prefix_length=64,
        )
        assert wan.static_ipv6 == "fc00::1"

    def test_complete_dual_stack_cpe_config(self):
        """Test complete CPE configuration with dual-stack everything."""
        from dotmac.platform.genieacs.schemas import WiFiConfig

        config = CPEConfigRequest(
            device_id="CPE-COMPLETE",
            wifi=WiFiConfig(
                ssid="DualStackNetwork",
                password="verysecure123",
                security_mode="WPA3-SAE",
                channel=6,
            ),
            lan=LANConfig(
                ipv4_address="192.168.1.1",
                subnet_mask="255.255.255.0",
                ipv6_address="2001:db8:1::1",
                ipv6_prefix_length=64,
                dhcp_enabled=True,
                dhcp_start="192.168.1.100",
                dhcp_end="192.168.1.250",
                dhcpv6_enabled=True,
            ),
            wan=WANConfig(
                connection_type="PPPoE",
                username="subscriber@ftth.net",
                password="pppoepass",
                vlan_id=100,
                ipv6_pd_enabled=True,
            ),
        )
        assert config.lan.ipv4_address == "192.168.1.1"
        assert config.lan.ipv6_address == "2001:db8:1::1"
        assert config.wan.ipv6_pd_enabled is True

    def test_mass_config_ipv6_only_deployment(self):
        """Test mass configuration for IPv6-only deployment."""
        mass_config = MassConfigRequest(
            name="IPv6-Only Deployment",
            device_filter=MassConfigFilter(
                query={"tags": "ipv6-ready"},
                expected_count=50,
            ),
            lan=MassLANConfig(
                ipv6_address="2001:db8:2::1",
                ipv6_prefix_length=64,
                dhcpv6_enabled=True,
            ),
            wan=MassWANConfig(
                connection_type="DHCPv6",
                ipv6_pd_enabled=True,
            ),
        )
        assert mass_config.lan.ipv6_address == "2001:db8:2::1"
        assert mass_config.lan.ipv4_address is None  # IPv6-only
