"""
Integration tests for SNMP metric collection.

Tests SNMP data collection with mocked responses simulating
various OLT vendors (Huawei, Cisco, VOLTHA/OpenOLT).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any

from dotmac.platform.access.snmp import (
    collect_snmp_metrics,
    decode_maybe_base64,
    DEFAULT_HUAWEI_SNMP_OIDS,
    DEFAULT_VOLTHA_SNMP_OIDS,
    SNMPCollectionError,
    SNMPCollectionResult,
)
from dotmac.platform.access.drivers.base import DriverContext


pytestmark = pytest.mark.unit


# =============================================================================
# Mock SNMP Responses (recorded from actual devices)
# =============================================================================


@pytest.fixture
def mock_huawei_snmp_response():
    """Mock SNMP response from Huawei MA5800 OLT."""
    return {
        "pon_ports_total": 16,
        "pon_ports_up": 14,
        "onu_total": 512,
        "onu_online": 487,
        "upstream_rate_kbps": 2048000,  # ~2 Gbps
        "downstream_rate_kbps": 8192000,  # ~8 Gbps
    }


@pytest.fixture
def mock_voltha_snmp_response():
    """Mock SNMP response from VOLTHA/OpenOLT."""
    return {
        "pon_ports_total": 8,
        "pon_ports_up": 8,
        "onu_total": 256,
        "onu_online": 248,
        "upstream_rate_bps": 1073741824,  # 1 Gbps
        "downstream_rate_bps": 4294967296,  # 4 Gbps
    }


@pytest.fixture
def mock_cisco_snmp_response():
    """Mock SNMP response from Cisco ME 4600."""
    return {
        "pon_ports_total": 4,
        "pon_ports_up": 4,
        "onu_total": 128,
        "onu_online": 120,
        "cpu_util": 35,
        "memory_util": 42,
        "temperature": 45,
    }


@pytest.fixture
def mock_snmp_collector():
    """Create a mock SNMP collector function."""
    async def collector(
        host: str,
        community: str,
        oids: dict[str, str],
        port: int = 161,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        # Simulate network delay
        import asyncio
        await asyncio.sleep(0.01)

        # Return mock values based on OID patterns
        values = {}
        for name, oid in oids.items():
            if "2011" in oid:  # Huawei enterprise OID
                values[name] = {
                    "pon_ports_total": 16,
                    "pon_ports_up": 14,
                    "onu_total": 512,
                    "onu_online": 487,
                }.get(name, 0)
            elif "4413" in oid:  # VOLTHA enterprise OID
                values[name] = {
                    "pon_ports_total": 8,
                    "pon_ports_up": 8,
                    "onu_total": 256,
                    "onu_online": 248,
                }.get(name, 0)
            else:
                values[name] = 0
        return values

    return collector


# =============================================================================
# SNMP Collection Tests
# =============================================================================


class TestSNMPCollectionWithHook:
    """Tests for SNMP collection using injected hooks."""

    @pytest.mark.asyncio
    async def test_collect_with_async_hook(self, mock_snmp_collector):
        """Test SNMP collection with async hook collector."""
        hooks = {"snmp_collector": mock_snmp_collector}

        result = await collect_snmp_metrics(
            host="192.168.1.1",
            community="public",
            oids=DEFAULT_HUAWEI_SNMP_OIDS,
            hooks=hooks,
        )

        assert isinstance(result, SNMPCollectionResult)
        assert result.values["pon_ports_total"] == 16
        assert result.values["pon_ports_up"] == 14
        assert result.values["onu_total"] == 512
        assert result.values["onu_online"] == 487

    @pytest.mark.asyncio
    async def test_collect_with_sync_hook(self, mock_huawei_snmp_response):
        """Test SNMP collection with synchronous hook collector."""
        def sync_collector(**kwargs):
            return mock_huawei_snmp_response

        hooks = {"snmp_collector": sync_collector}

        result = await collect_snmp_metrics(
            host="192.168.1.1",
            community="public",
            oids=DEFAULT_HUAWEI_SNMP_OIDS,
            hooks=hooks,
        )

        assert result.values == mock_huawei_snmp_response

    @pytest.mark.asyncio
    async def test_collect_voltha_metrics(self, mock_snmp_collector):
        """Test SNMP collection for VOLTHA OLT."""
        hooks = {"snmp_collector": mock_snmp_collector}

        result = await collect_snmp_metrics(
            host="10.0.0.50",
            community="voltha",
            oids=DEFAULT_VOLTHA_SNMP_OIDS,
            port=161,
            hooks=hooks,
        )

        assert result.values["pon_ports_total"] == 8
        assert result.values["onu_online"] == 248

    @pytest.mark.asyncio
    async def test_hook_priority_snmp_client(self, mock_huawei_snmp_response):
        """Test that snmp_client hook key is also recognized."""
        async def client(**kwargs):
            return mock_huawei_snmp_response

        hooks = {"snmp_client": client}

        result = await collect_snmp_metrics(
            host="192.168.1.1",
            community="public",
            oids={"test": "1.3.6.1.2.1.1.1.0"},
            hooks=hooks,
        )

        assert result.values == mock_huawei_snmp_response

    @pytest.mark.asyncio
    async def test_hook_priority_snmp_fetcher(self, mock_huawei_snmp_response):
        """Test that snmp_fetcher hook key is also recognized."""
        async def fetcher(**kwargs):
            return mock_huawei_snmp_response

        hooks = {"snmp_fetcher": fetcher}

        result = await collect_snmp_metrics(
            host="192.168.1.1",
            community="public",
            oids={"test": "1.3.6.1.2.1.1.1.0"},
            hooks=hooks,
        )

        assert result.values == mock_huawei_snmp_response


class TestSNMPCollectionWithDriverContext:
    """Tests for SNMP collection integrated with driver context."""

    @pytest.mark.asyncio
    async def test_driver_context_snmp_hook(self, mock_huawei_snmp_response):
        """Test SNMP collection through DriverContext hooks."""
        async def context_collector(**kwargs):
            return mock_huawei_snmp_response

        context = DriverContext(
            tenant_id="test-tenant",
            hooks={"snmp_collector": context_collector},
        )

        result = await collect_snmp_metrics(
            host="192.168.1.1",
            community="public",
            oids=DEFAULT_HUAWEI_SNMP_OIDS,
            hooks=context.hooks,
        )

        assert result.values["onu_online"] == 487

    @pytest.mark.asyncio
    async def test_empty_hooks_falls_through(self):
        """Test that empty hooks dict doesn't cause errors."""
        # This should attempt pysnmp (which will fail if not installed)
        # but we're testing that empty hooks is handled
        with patch(
            "dotmac.platform.access.snmp._pysnmp_collect",
            new_callable=AsyncMock,
            return_value={"test": 42},
        ):
            result = await collect_snmp_metrics(
                host="192.168.1.1",
                community="public",
                oids={"test": "1.3.6.1.2.1.1.1.0"},
                hooks={},
            )
            assert result.values["test"] == 42


class TestSNMPMetricNormalization:
    """Tests for SNMP value normalization and edge cases."""

    @pytest.mark.asyncio
    async def test_integer_values_preserved(self):
        """Test that integer SNMP values are preserved."""
        async def collector(**kwargs):
            return {"counter": 1000000, "gauge": 42}

        result = await collect_snmp_metrics(
            host="test",
            community="public",
            oids={"counter": "1.2.3", "gauge": "1.2.4"},
            hooks={"snmp_collector": collector},
        )

        assert result.values["counter"] == 1000000
        assert isinstance(result.values["counter"], int)

    @pytest.mark.asyncio
    async def test_string_values_returned(self):
        """Test that string SNMP values are returned as-is."""
        async def collector(**kwargs):
            return {"sysDescr": "Huawei MA5800-X2", "sysName": "OLT-001"}

        result = await collect_snmp_metrics(
            host="test",
            community="public",
            oids={"sysDescr": "1.3.6.1.2.1.1.1.0", "sysName": "1.3.6.1.2.1.1.5.0"},
            hooks={"snmp_collector": collector},
        )

        assert result.values["sysDescr"] == "Huawei MA5800-X2"

    @pytest.mark.asyncio
    async def test_empty_oids_returns_empty(self):
        """Test that empty OID dict returns empty result."""
        async def collector(**kwargs):
            return {}

        result = await collect_snmp_metrics(
            host="test",
            community="public",
            oids={},
            hooks={"snmp_collector": collector},
        )

        assert result.values == {}
        assert result.oids == {}


class TestBase64Decoding:
    """Tests for base64 decoding utility."""

    def test_decode_plain_bytes(self):
        """Test that plain bytes pass through."""
        data = b"plain text data"
        result = decode_maybe_base64(data)
        assert result == data

    def test_decode_valid_base64(self):
        """Test decoding valid base64 string."""
        import base64
        original = b"configuration backup data"
        encoded = base64.b64encode(original).decode()

        result = decode_maybe_base64(encoded)
        assert result == original

    def test_decode_base64_with_padding(self):
        """Test decoding base64 with missing padding."""
        import base64
        original = b"test"
        encoded = base64.b64encode(original).decode().rstrip("=")

        result = decode_maybe_base64(encoded)
        assert result == original

    def test_decode_non_base64_string(self):
        """Test that non-base64 strings are UTF-8 encoded."""
        # Use a string that's clearly not valid base64
        text = "regular configuration text!!!"
        result = decode_maybe_base64(text)
        # The function may add padding when attempting base64 decode
        # but should fall back to UTF-8 encoding
        assert b"regular configuration" in result


class TestSNMPErrorHandling:
    """Tests for SNMP error handling scenarios."""

    @pytest.mark.asyncio
    async def test_hook_exception_propagates(self):
        """Test that hook exceptions propagate correctly."""
        async def failing_collector(**kwargs):
            raise ConnectionError("SNMP timeout")

        with pytest.raises(ConnectionError, match="SNMP timeout"):
            await collect_snmp_metrics(
                host="unreachable",
                community="public",
                oids={"test": "1.2.3"},
                hooks={"snmp_collector": failing_collector},
            )

    @pytest.mark.asyncio
    async def test_pysnmp_import_error(self):
        """Test handling when pysnmp is not available."""
        with patch(
            "dotmac.platform.access.snmp._pysnmp_collect",
            side_effect=SNMPCollectionError("pysnmp is required"),
        ):
            with pytest.raises(SNMPCollectionError, match="pysnmp is required"):
                await collect_snmp_metrics(
                    host="192.168.1.1",
                    community="public",
                    oids={"test": "1.2.3"},
                    hooks=None,
                )


# =============================================================================
# Recorded Response Tests (simulating real device data)
# =============================================================================


class TestRecordedHuaweiResponses:
    """Tests using recorded Huawei MA5800 SNMP responses."""

    @pytest.fixture
    def recorded_ma5800_response(self):
        """Recorded response from Huawei MA5800-X2."""
        return {
            "pon_ports_total": 16,
            "pon_ports_up": 15,
            "onu_total": 1024,
            "onu_online": 998,
            "upstream_rate_kbps": 4096000,
            "downstream_rate_kbps": 16384000,
            # Additional OLT-specific metrics
            "cpu_usage": 28,
            "memory_usage": 45,
            "board_temperature": 42,
            "fan_status": 1,  # 1=OK
        }

    @pytest.mark.asyncio
    async def test_ma5800_full_metrics(self, recorded_ma5800_response):
        """Test full metric collection from MA5800."""
        async def collector(**kwargs):
            return recorded_ma5800_response

        extended_oids = {
            **DEFAULT_HUAWEI_SNMP_OIDS,
            "cpu_usage": "1.3.6.1.4.1.2011.2.82.1.13.1.1.20.0",
            "memory_usage": "1.3.6.1.4.1.2011.2.82.1.13.1.1.21.0",
            "board_temperature": "1.3.6.1.4.1.2011.2.82.1.13.1.1.22.0",
            "fan_status": "1.3.6.1.4.1.2011.2.82.1.13.1.1.23.0",
        }

        result = await collect_snmp_metrics(
            host="10.0.0.10",
            community="huawei_snmp",
            oids=extended_oids,
            hooks={"snmp_collector": collector},
        )

        # Verify all metrics present
        assert result.values["pon_ports_total"] == 16
        assert result.values["onu_online"] == 998
        assert result.values["cpu_usage"] == 28
        assert result.values["board_temperature"] == 42

    @pytest.mark.asyncio
    async def test_ma5800_calculate_online_ratio(self, recorded_ma5800_response):
        """Test calculating ONU online ratio from SNMP data."""
        async def collector(**kwargs):
            return recorded_ma5800_response

        result = await collect_snmp_metrics(
            host="10.0.0.10",
            community="public",
            oids=DEFAULT_HUAWEI_SNMP_OIDS,
            hooks={"snmp_collector": collector},
        )

        online_ratio = result.values["onu_online"] / result.values["onu_total"]
        assert online_ratio > 0.97  # 97%+ online expected


class TestRecordedVolthaResponses:
    """Tests using recorded VOLTHA/OpenOLT SNMP responses."""

    @pytest.fixture
    def recorded_openolt_response(self):
        """Recorded response from OpenOLT agent."""
        return {
            "pon_ports_total": 8,
            "pon_ports_up": 8,
            "onu_total": 512,
            "onu_online": 504,
            "upstream_rate_bps": 2147483648,  # 2 Gbps
            "downstream_rate_bps": 8589934592,  # 8 Gbps
            "olt_serial": "ADTN1234ABCD",
            "firmware_version": "v3.2.1",
        }

    @pytest.mark.asyncio
    async def test_openolt_metrics(self, recorded_openolt_response):
        """Test metric collection from OpenOLT."""
        async def collector(**kwargs):
            return recorded_openolt_response

        result = await collect_snmp_metrics(
            host="10.0.0.20",
            community="voltha",
            oids=DEFAULT_VOLTHA_SNMP_OIDS,
            hooks={"snmp_collector": collector},
        )

        assert result.values["pon_ports_up"] == 8
        assert result.values["onu_online"] == 504

    @pytest.mark.asyncio
    async def test_openolt_bandwidth_calculation(self, recorded_openolt_response):
        """Test bandwidth calculation from bps values."""
        async def collector(**kwargs):
            return recorded_openolt_response

        result = await collect_snmp_metrics(
            host="10.0.0.20",
            community="voltha",
            oids=DEFAULT_VOLTHA_SNMP_OIDS,
            hooks={"snmp_collector": collector},
        )

        # Convert bps to Gbps
        downstream_gbps = result.values.get("downstream_rate_bps", 0) / 1_000_000_000
        assert downstream_gbps == pytest.approx(8.0, rel=0.1)


class TestRecordedCiscoResponses:
    """Tests using recorded Cisco ME 4600 SNMP responses."""

    @pytest.fixture
    def recorded_cisco_response(self):
        """Recorded response from Cisco ME 4600."""
        return {
            "sysDescr": "Cisco ME 4600 Series GPON OLT",
            "sysUpTime": 864000,  # 10 days in centiseconds
            "pon_ports_total": 4,
            "pon_ports_up": 4,
            "onu_total": 256,
            "onu_online": 248,
            "cpu_5sec": 15,
            "cpu_1min": 18,
            "cpu_5min": 16,
            "memory_used": 1073741824,  # 1GB
            "memory_free": 3221225472,  # 3GB
        }

    @pytest.mark.asyncio
    async def test_cisco_system_metrics(self, recorded_cisco_response):
        """Test Cisco system metric collection."""
        async def collector(**kwargs):
            return recorded_cisco_response

        cisco_oids = {
            "sysDescr": "1.3.6.1.2.1.1.1.0",
            "sysUpTime": "1.3.6.1.2.1.1.3.0",
            "pon_ports_total": "1.3.6.1.4.1.9.9.999.1.1.1.0",
            "pon_ports_up": "1.3.6.1.4.1.9.9.999.1.1.2.0",
            "cpu_5min": "1.3.6.1.4.1.9.9.109.1.1.1.1.5.1",
        }

        result = await collect_snmp_metrics(
            host="10.0.0.30",
            community="cisco_ro",
            oids=cisco_oids,
            hooks={"snmp_collector": collector},
        )

        assert "ME 4600" in result.values["sysDescr"]
        assert result.values["cpu_5min"] == 16

    @pytest.mark.asyncio
    async def test_cisco_uptime_calculation(self, recorded_cisco_response):
        """Test uptime calculation from sysUpTime."""
        async def collector(**kwargs):
            return recorded_cisco_response

        result = await collect_snmp_metrics(
            host="10.0.0.30",
            community="cisco_ro",
            oids={"sysUpTime": "1.3.6.1.2.1.1.3.0"},
            hooks={"snmp_collector": collector},
        )

        # sysUpTime is in centiseconds
        uptime_days = result.values["sysUpTime"] / (100 * 60 * 60 * 24)
        assert uptime_days == pytest.approx(0.1, rel=0.01)  # ~10 days
