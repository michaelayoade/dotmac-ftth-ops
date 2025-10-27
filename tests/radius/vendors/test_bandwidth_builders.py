"""
Unit tests for vendor-specific bandwidth attribute builders.
"""

from dotmac.platform.radius.vendors import (
    CiscoBandwidthBuilder,
    HuaweiBandwidthBuilder,
    JuniperBandwidthBuilder,
    MikrotikBandwidthBuilder,
    NASVendor,
    get_bandwidth_builder,
)


class TestMikrotikBandwidthBuilder:
    """Test Mikrotik bandwidth builder."""

    def test_build_radreply_basic(self):
        """Test basic Mikrotik attribute generation."""
        builder = MikrotikBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
        )

        assert len(attrs) == 1
        assert attrs[0].attribute == "Mikrotik-Rate-Limit"
        assert attrs[0].value == "10000k/5000k"
        assert attrs[0].op == "="

    def test_build_radreply_with_burst(self):
        """Test Mikrotik attributes with burst."""
        builder = MikrotikBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
            download_burst_kbps=15000,
            upload_burst_kbps=7500,
        )

        assert attrs[0].value == "10000k/5000k 15000k/7500k"

    def test_build_radreply_with_profile(self):
        """Test Mikrotik attributes with profile name."""
        builder = MikrotikBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
            profile_name="gold-plan",
        )

        assert len(attrs) == 1
        assert attrs[0].attribute == "Mikrotik-Rate-Limit"
        assert all(attr.attribute != "X-Bandwidth-Profile-ID" for attr in attrs)

    def test_build_coa_attributes(self):
        """Test Mikrotik CoA attribute generation."""
        builder = MikrotikBandwidthBuilder()

        coa_attrs = builder.build_coa_attributes(
            download_rate_kbps=20000,
            upload_rate_kbps=10000,
        )

        assert "Mikrotik-Rate-Limit" in coa_attrs
        assert coa_attrs["Mikrotik-Rate-Limit"] == "20000k/10000k"


class TestCiscoBandwidthBuilder:
    """Test Cisco bandwidth builder."""

    def test_build_radreply_with_profile(self):
        """Test Cisco policy-based attributes."""
        builder = CiscoBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
            profile_name="gold-plan",
        )

        # Should have 2 AVPairs (tracking attribute managed by service layer)
        assert len(attrs) == 2

        avpair_attrs = [a for a in attrs if a.attribute == "Cisco-AVPair"]
        assert len(avpair_attrs) == 2

        # Check for policy names in AVPairs
        avpair_values = [a.value for a in avpair_attrs]
        assert any("sub-qos-policy-in=gold-plan" in v for v in avpair_values)
        assert any("sub-qos-policy-out=gold-plan" in v for v in avpair_values)
        assert all(attr.attribute != "X-Bandwidth-Profile-ID" for attr in attrs)

    def test_build_radreply_rate_based(self):
        """Test Cisco rate-based attributes."""
        builder = CiscoBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
        )

        assert len(attrs) == 1
        assert attrs[0].attribute == "Cisco-AVPair"
        # Cisco uses bps (Kbps * 1000)
        assert "5000000" in attrs[0].value  # upload in bps
        assert "10000000" in attrs[0].value  # download in bps

    def test_build_coa_attributes(self):
        """Test Cisco CoA attribute generation."""
        builder = CiscoBandwidthBuilder()

        coa_attrs = builder.build_coa_attributes(
            download_rate_kbps=20000,
            upload_rate_kbps=10000,
        )

        assert "Cisco-AVPair" in coa_attrs
        assert "10000000" in coa_attrs["Cisco-AVPair"]  # upload
        assert "20000000" in coa_attrs["Cisco-AVPair"]  # download


class TestHuaweiBandwidthBuilder:
    """Test Huawei bandwidth builder."""

    def test_build_radreply_basic(self):
        """Test Huawei basic attribute generation."""
        builder = HuaweiBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
        )

        # Should have input and output rate limits
        assert len(attrs) >= 2

        attr_map = {a.attribute: a.value for a in attrs}
        assert "Huawei-Input-Rate-Limit" in attr_map
        assert "Huawei-Output-Rate-Limit" in attr_map
        assert attr_map["Huawei-Input-Rate-Limit"] == "5000"  # upload in Kbps
        assert attr_map["Huawei-Output-Rate-Limit"] == "10000"  # download in Kbps

    def test_build_radreply_with_burst(self):
        """Test Huawei attributes with burst."""
        builder = HuaweiBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
            download_burst_kbps=15000,
            upload_burst_kbps=7500,
        )

        attr_map = {a.attribute: a.value for a in attrs}
        assert "Huawei-Output-Peak-Rate" in attr_map
        assert "Huawei-Input-Peak-Rate" in attr_map
        assert attr_map["Huawei-Output-Peak-Rate"] == "15000"
        assert attr_map["Huawei-Input-Peak-Rate"] == "7500"

    def test_build_radreply_with_profile(self):
        """Test Huawei attributes with profile."""
        builder = HuaweiBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
            profile_name="gold-plan",
        )

        attr_map = {a.attribute: a.value for a in attrs}
        assert "Huawei-Qos-Profile-Name" in attr_map
        assert attr_map["Huawei-Qos-Profile-Name"] == "gold-plan"


class TestJuniperBandwidthBuilder:
    """Test Juniper bandwidth builder."""

    def test_build_radreply_with_profile(self):
        """Test Juniper policy-based attributes."""
        builder = JuniperBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
            profile_name="gold-plan",
        )

        attr_map = {a.attribute: a.value for a in attrs}
        assert "ERX-Qos-Profile-Name" in attr_map
        assert "ERX-Ingress-Policy-Name" in attr_map
        assert "ERX-Egress-Policy-Name" in attr_map
        assert attr_map["ERX-Qos-Profile-Name"] == "gold-plan"
        assert attr_map["ERX-Ingress-Policy-Name"] == "gold-plan-qos-in"
        assert attr_map["ERX-Egress-Policy-Name"] == "gold-plan-qos-out"

    def test_build_radreply_rate_based(self):
        """Test Juniper rate-based attributes."""
        builder = JuniperBandwidthBuilder()

        attrs = builder.build_radreply(
            download_rate_kbps=10000,
            upload_rate_kbps=5000,
        )

        attr_map = {a.attribute: a.value for a in attrs}
        assert "Juniper-Rate-Limit-In" in attr_map
        assert "Juniper-Rate-Limit-Out" in attr_map
        # Juniper uses bps
        assert attr_map["Juniper-Rate-Limit-In"] == "5000000"  # upload
        assert attr_map["Juniper-Rate-Limit-Out"] == "10000000"  # download


class TestBandwidthBuilderRegistry:
    """Test bandwidth builder registry and factory."""

    def test_get_mikrotik_builder(self):
        """Test getting Mikrotik builder."""
        builder = get_bandwidth_builder(vendor=NASVendor.MIKROTIK)
        assert isinstance(builder, MikrotikBandwidthBuilder)

    def test_get_cisco_builder(self):
        """Test getting Cisco builder."""
        builder = get_bandwidth_builder(vendor=NASVendor.CISCO)
        assert isinstance(builder, CiscoBandwidthBuilder)

    def test_get_huawei_builder(self):
        """Test getting Huawei builder."""
        builder = get_bandwidth_builder(vendor=NASVendor.HUAWEI)
        assert isinstance(builder, HuaweiBandwidthBuilder)

    def test_get_juniper_builder(self):
        """Test getting Juniper builder."""
        builder = get_bandwidth_builder(vendor=NASVendor.JUNIPER)
        assert isinstance(builder, JuniperBandwidthBuilder)

    def test_get_builder_string_vendor(self):
        """Test getting builder with string vendor."""
        builder = get_bandwidth_builder(vendor="cisco")
        assert isinstance(builder, CiscoBandwidthBuilder)

    def test_get_builder_default(self):
        """Test getting default builder (Mikrotik)."""
        builder = get_bandwidth_builder()
        assert isinstance(builder, MikrotikBandwidthBuilder)

    def test_get_builder_unknown_vendor(self):
        """Test getting builder with unknown vendor falls back to Mikrotik."""
        builder = get_bandwidth_builder(vendor="unknown-vendor")
        assert isinstance(builder, MikrotikBandwidthBuilder)

    def test_vendor_enum_values(self):
        """Test NASVendor enum values."""
        assert NASVendor.MIKROTIK == "mikrotik"
        assert NASVendor.CISCO == "cisco"
        assert NASVendor.HUAWEI == "huawei"
        assert NASVendor.JUNIPER == "juniper"
        assert NASVendor.GENERIC == "generic"
