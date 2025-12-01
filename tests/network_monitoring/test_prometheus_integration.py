"""Prometheus integration helpers for network monitoring service."""

from __future__ import annotations

import pytest

from dotmac.platform.network_monitoring.schemas import DeviceType, TrafficStatsResponse
from dotmac.platform.network_monitoring.service import NetworkMonitoringService
from dotmac.platform.tenant.oss_config import ServiceConfig

pytestmark = pytest.mark.unit


class StubPromClient:
    def __init__(self) -> None:
        self.queries: list[str] = []

    async def query(self, q: str):
        self.queries.append(q)
        # Return a minimal Prometheus-like payload
        return {"data": {"result": [{"value": [0, "123.4"]}]}}


@pytest.mark.asyncio
async def test_collect_device_traffic_uses_prometheus_queries(monkeypatch):
    client = StubPromClient()
    service = NetworkMonitoringService("tenant-123", session=None)
    service._prometheus_client = client  # type: ignore[attr-defined]
    service._prometheus_config = ServiceConfig(
        url="http://prometheus.local",
        extras={"device_placeholder": "<<device_id>>"},
    )

    async def fake_client():
        return client

    monkeypatch.setattr(service, "_get_prometheus_client", fake_client)

    async def fake_resolve(device_id, device_type, tenant_id):
        return DeviceType.OLT

    monkeypatch.setattr(service, "_resolve_device_type", fake_resolve)

    stats = await service.get_traffic_stats("olt-1", device_type=None, tenant_id="tenant-123")
    assert isinstance(stats, TrafficStatsResponse)
    # Ensure queries were rendered with device id
    assert any("olt-1" in q for q in client.queries)
    # Returned value should reflect the stubbed response
    assert stats.current_rate_in_bps == pytest.approx(123.4)


def test_extract_prometheus_value_handles_empty():
    service = NetworkMonitoringService("tenant-123", session=None)
    assert service._extract_prometheus_value({}) == 0.0
    assert service._extract_prometheus_value({"data": {"result": []}}) == 0.0
    assert service._extract_prometheus_value({"data": {"result": [{"value": [0, "nan"]}]}}) == 0.0
