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
