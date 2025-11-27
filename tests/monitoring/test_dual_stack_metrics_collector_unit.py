"""Focused tests for DualStackMetricsCollector behaviour."""

from __future__ import annotations

import builtins
from types import SimpleNamespace

import pytest

pytestmark = pytest.mark.unit

from dotmac.platform.monitoring.dual_stack_metrics import (
    DualStackMetrics,
    DualStackMetricsCollector,
    MetricPeriod,
    MetricsAggregator,
)


class _StubResult:
    def __init__(self, value: int | float):
        self._value = value

    def scalar(self):
        return self._value


class _StubSession:
    def __init__(self, values: list[int | float]):
        self.values = values
        self.queries = []

    async def execute(self, query):
        self.queries.append(query)
        value = self.values.pop(0)
        return _StubResult(value)


@pytest.mark.asyncio
async def test_collect_subscriber_metrics_computes_totals():
    # total, dual stack, ipv4 only, ipv6 only
    session = _StubSession([10, 4, 3, 1])
    metrics = DualStackMetrics()

    collector = DualStackMetricsCollector(session, tenant_id="tenant-alpha")
    await collector.collect_subscriber_metrics(metrics)

    assert metrics.total_subscribers == 10
    assert metrics.dual_stack_subscribers == 4
    assert metrics.ipv4_only_subscribers == 3
    assert metrics.ipv6_only_subscribers == 1
    assert metrics.dual_stack_percentage == pytest.approx(40.0)
    # Ensure tenant filter produced queries (only need to know number of calls)
    assert len(session.queries) == 4


@pytest.mark.asyncio
async def test_collect_all_metrics_invokes_all_sections(monkeypatch):
    session = _StubSession([])
    collector = DualStackMetricsCollector(session)
    call_order: list[str] = []

    async def fake_sub(self, metrics):
        call_order.append("sub")

    async def fake_wg(self, metrics):
        call_order.append("wg")

    async def fake_dev(self, metrics):
        call_order.append("dev")

    monkeypatch.setattr(DualStackMetricsCollector, "collect_subscriber_metrics", fake_sub)
    monkeypatch.setattr(DualStackMetricsCollector, "collect_wireguard_metrics", fake_wg)
    monkeypatch.setattr(DualStackMetricsCollector, "collect_device_metrics", fake_dev)

    metrics = await collector.collect_all_metrics()

    assert call_order == ["sub", "wg", "dev"]
    # Returned metrics should be instance of DualStackMetrics
    assert isinstance(metrics, DualStackMetrics)


@pytest.mark.asyncio
async def test_collect_wireguard_metrics_handles_missing_import(monkeypatch):
    collector = DualStackMetricsCollector(_StubSession([]))
    metrics = DualStackMetrics()

    original_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "dotmac.platform.network.wireguard.models":
            raise ImportError("missing wireguard module")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    await collector.collect_wireguard_metrics(metrics)

    # Metrics remain default when import fails
    assert metrics.wireguard_servers == 0
    assert metrics.wireguard_dual_stack_peers == 0


@pytest.mark.asyncio
async def test_metrics_aggregator_trend_placeholder():
    aggregator = MetricsAggregator(SimpleNamespace())
    data = await aggregator.get_trend_data(
        metric_name="ipv4_bandwidth_mbps",
        period=MetricPeriod.LAST_WEEK,
        tenant_id="tenant-123",
    )

    assert len(data) == 1
    assert data[0]["metric"] == "ipv4_bandwidth_mbps"
