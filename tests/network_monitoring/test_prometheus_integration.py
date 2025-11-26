"""Integration tests for Prometheus-backed network telemetry."""

from __future__ import annotations

import json

import pytest

from dotmac.platform.core.caching import cache_clear
from dotmac.platform.network_monitoring.schemas import DeviceType
from dotmac.platform.network_monitoring.service import NetworkMonitoringService
from dotmac.platform.tenant.models import Tenant, TenantSetting


class FakePrometheusClient:
    """Simple stub that mimics PrometheusClient behaviour for tests."""

    def __init__(self, responses: dict[str, float]) -> None:
        self._responses = responses
        self.calls: list[str] = []

    async def query(self, query: str, timeout: float | None = None):  # noqa: ANN001
        self.calls.append(query)
        value = self._responses.get(query, 0.0)
        return {
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": [
                    {
                        "value": [0, str(value)],
                    }
                ],
            },
        }


@pytest.mark.asyncio
async def test_network_device_traffic_from_prometheus(async_db_session, monkeypatch):
    tenant_id = "tenant-1"

    # Ensure clean cache across test executions
    cache_clear(flush_all=True)

    tenant = Tenant(id=tenant_id, name="Tenant One", slug="tenant-one")
    async_db_session.add(tenant)

    override_payload = {
        "url": "http://prometheus.test",
        "extras": {
            "device_placeholder": "<<device_id>>",
            "traffic_queries": {
                "rx_rate": 'metric_rx_rate{device="<<device_id>>"}',
                "tx_rate": 'metric_tx_rate{device="<<device_id>>"}',
                "rx_bytes": 'metric_rx_bytes{device="<<device_id>>"}',
                "tx_bytes": 'metric_tx_bytes{device="<<device_id>>"}',
                "rx_packets": 'metric_rx_packets{device="<<device_id>>"}',
                "tx_packets": 'metric_tx_packets{device="<<device_id>>"}',
            },
        },
    }

    async_db_session.add(
        TenantSetting(
            tenant_id=tenant_id,
            key="oss.prometheus",
            value=json.dumps(override_payload),
            value_type="json",
        )
    )
    await async_db_session.commit()

    responses = {
        'metric_rx_rate{device="router-1"}': 120.5,
        'metric_tx_rate{device="router-1"}': 340.75,
        'metric_rx_bytes{device="router-1"}': 1024.0,
        'metric_tx_bytes{device="router-1"}': 2048.0,
        'metric_rx_packets{device="router-1"}': 55.0,
        'metric_tx_packets{device="router-1"}': 110.0,
    }

    fake_client = FakePrometheusClient(responses)

    def _client_factory(*args, **kwargs):  # noqa: ANN001
        return fake_client

    monkeypatch.setattr(
        "dotmac.platform.network_monitoring.service.PrometheusClient",
        _client_factory,
    )

    service = NetworkMonitoringService(
        tenant_id=tenant_id,
        session=async_db_session,
        netbox_client=object(),
        voltha_client=object(),
        genieacs_client=object(),
    )

    stats = await service.get_traffic_stats("router-1", DeviceType.ROUTER, tenant_id)

    assert stats.total_bytes_in == 1024
    assert stats.total_bytes_out == 2048
    assert stats.total_packets_in == 55
    assert stats.total_packets_out == 110
    assert stats.current_rate_in_bps == pytest.approx(120.5)
    assert stats.current_rate_out_bps == pytest.approx(340.75)

    initial_call_count = len(fake_client.calls)
    # Second invocation should be served from cache
    stats_cached = await service.get_traffic_stats("router-1", DeviceType.ROUTER, tenant_id)
    assert stats_cached.current_rate_in_bps == stats.current_rate_in_bps
    assert len(fake_client.calls) == initial_call_count


# =============================================================================
# Recorded Response Tests (simulating real Prometheus data)
# =============================================================================


class RecordedPrometheusClient:
    """Prometheus client using recorded API responses."""

    def __init__(self, recorded_responses: dict[str, dict]) -> None:
        self._recorded = recorded_responses
        self.calls: list[str] = []

    async def query(self, query: str, timeout: float | None = None):
        """Return recorded response for query."""
        self.calls.append(query)

        # Find matching recorded response
        for pattern, response in self._recorded.items():
            if pattern in query:
                return response

        # Default empty response
        return {
            "status": "success",
            "data": {"resultType": "vector", "result": []},
        }

    async def query_range(
        self,
        query: str,
        start: float,
        end: float,
        step: str = "5m",
    ):
        """Return recorded range response."""
        self.calls.append(f"range:{query}")

        for pattern, response in self._recorded.items():
            if pattern in query and "matrix" in str(response):
                return response

        return {
            "status": "success",
            "data": {"resultType": "matrix", "result": []},
        }


@pytest.fixture
def recorded_onu_traffic_data():
    """Recorded traffic data from production ONU."""
    return {
        "interface_rx": {
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": [
                    {
                        "metric": {
                            "__name__": "interface_rx_bytes_total",
                            "device_id": "onu-hwtc-12345",
                            "interface": "eth0",
                        },
                        "value": [1704067200, "10737418240"],  # 10GB
                    }
                ],
            },
        },
        "interface_tx": {
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": [
                    {
                        "metric": {
                            "__name__": "interface_tx_bytes_total",
                            "device_id": "onu-hwtc-12345",
                            "interface": "eth0",
                        },
                        "value": [1704067200, "2147483648"],  # 2GB
                    }
                ],
            },
        },
    }


@pytest.fixture
def recorded_bandwidth_burst():
    """Recorded bandwidth burst event."""
    base_time = 1704067200
    return {
        "rate_history": {
            "status": "success",
            "data": {
                "resultType": "matrix",
                "result": [
                    {
                        "metric": {"device_id": "onu-001"},
                        "values": [
                            [base_time, "50.5"],
                            [base_time + 300, "52.3"],
                            [base_time + 600, "180.5"],  # Burst
                            [base_time + 900, "195.2"],  # Peak
                            [base_time + 1200, "55.1"],  # Normal
                        ],
                    }
                ],
            },
        }
    }


@pytest.fixture
def recorded_olt_aggregate():
    """Recorded OLT aggregate metrics."""
    return {
        "olt_traffic": {
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": [
                    {
                        "metric": {
                            "__name__": "olt_downstream_bytes_total",
                            "olt_id": "olt-ma5800-001",
                            "pon_port": "0/0/0",
                        },
                        "value": [1704067200, "107374182400000"],  # 100TB
                    },
                    {
                        "metric": {
                            "__name__": "olt_upstream_bytes_total",
                            "olt_id": "olt-ma5800-001",
                            "pon_port": "0/0/0",
                        },
                        "value": [1704067200, "10737418240000"],  # 10TB
                    },
                ],
            },
        }
    }


class TestRecordedONUTraffic:
    """Tests using recorded ONU traffic data."""

    @pytest.mark.asyncio
    async def test_parse_recorded_traffic(self, recorded_onu_traffic_data):
        """Test parsing recorded ONU traffic response."""
        client = RecordedPrometheusClient(recorded_onu_traffic_data)

        rx_result = await client.query("interface_rx")
        tx_result = await client.query("interface_tx")

        rx_bytes = int(rx_result["data"]["result"][0]["value"][1])
        tx_bytes = int(tx_result["data"]["result"][0]["value"][1])

        assert rx_bytes == 10737418240  # 10GB
        assert tx_bytes == 2147483648  # 2GB

        # Calculate ratio
        ratio = rx_bytes / tx_bytes
        assert ratio == pytest.approx(5.0, rel=0.01)

    @pytest.mark.asyncio
    async def test_traffic_to_human_readable(self, recorded_onu_traffic_data):
        """Test converting traffic bytes to human readable format."""
        client = RecordedPrometheusClient(recorded_onu_traffic_data)

        rx_result = await client.query("interface_rx")
        rx_bytes = int(rx_result["data"]["result"][0]["value"][1])

        # Convert to GB
        rx_gb = rx_bytes / (1024 ** 3)
        assert rx_gb == pytest.approx(10.0, rel=0.01)


class TestRecordedBandwidthBurst:
    """Tests using recorded bandwidth burst data."""

    @pytest.mark.asyncio
    async def test_detect_burst_in_recorded_data(self, recorded_bandwidth_burst):
        """Test detecting bandwidth burst from recorded data."""
        client = RecordedPrometheusClient(recorded_bandwidth_burst)

        result = await client.query_range("rate_history", 0, 0)

        values = [float(v[1]) for v in result["data"]["result"][0]["values"]]

        # Calculate statistics
        avg_rate = sum(values) / len(values)
        max_rate = max(values)
        min_rate = min(values)

        # Detect burst (max significantly higher than min baseline)
        burst_ratio = max_rate / min_rate
        burst_detected = burst_ratio > 3  # 195/50 = ~3.9x
        assert burst_detected is True

        # Peak should be ~195 Mbps
        assert max_rate == pytest.approx(195.2, rel=0.01)

    @pytest.mark.asyncio
    async def test_calculate_95th_percentile(self, recorded_bandwidth_burst):
        """Test calculating 95th percentile from recorded data."""
        client = RecordedPrometheusClient(recorded_bandwidth_burst)

        result = await client.query_range("rate_history", 0, 0)

        values = sorted([float(v[1]) for v in result["data"]["result"][0]["values"]])

        # Simple percentile calculation
        idx = int(len(values) * 0.95)
        p95 = values[min(idx, len(values) - 1)]

        assert p95 > 100  # 95th percentile should be high due to burst


class TestRecordedOLTAggregate:
    """Tests using recorded OLT aggregate data."""

    @pytest.mark.asyncio
    async def test_olt_total_traffic(self, recorded_olt_aggregate):
        """Test calculating OLT total traffic."""
        client = RecordedPrometheusClient(recorded_olt_aggregate)

        result = await client.query("olt_traffic")

        total_bytes = sum(
            int(r["value"][1]) for r in result["data"]["result"]
        )

        # Total should be ~110TB
        total_tb = total_bytes / (1024 ** 4)
        assert total_tb == pytest.approx(107.28, rel=0.1)

    @pytest.mark.asyncio
    async def test_downstream_to_upstream_ratio(self, recorded_olt_aggregate):
        """Test calculating downstream/upstream ratio."""
        client = RecordedPrometheusClient(recorded_olt_aggregate)

        result = await client.query("olt_traffic")

        downstream = None
        upstream = None
        for r in result["data"]["result"]:
            if "downstream" in r["metric"]["__name__"]:
                downstream = int(r["value"][1])
            elif "upstream" in r["metric"]["__name__"]:
                upstream = int(r["value"][1])

        ratio = downstream / upstream
        assert ratio == pytest.approx(10.0, rel=0.01)  # 10:1 ratio


class TestPrometheusErrorScenarios:
    """Tests for Prometheus error handling."""

    @pytest.mark.asyncio
    async def test_empty_result_handling(self):
        """Test handling empty Prometheus results."""
        client = RecordedPrometheusClient({})

        result = await client.query("nonexistent_metric")

        assert result["status"] == "success"
        assert len(result["data"]["result"]) == 0

    @pytest.mark.asyncio
    async def test_query_tracking(self, recorded_onu_traffic_data):
        """Test that all queries are tracked."""
        client = RecordedPrometheusClient(recorded_onu_traffic_data)

        await client.query("interface_rx")
        await client.query("interface_tx")
        await client.query("unknown_metric")

        assert len(client.calls) == 3
        assert "interface_rx" in client.calls[0]
