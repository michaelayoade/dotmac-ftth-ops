import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from dotmac.platform.metrics.schemas import (
    DashboardMetrics,
    NetworkMetrics,
    RevenueMetrics,
    SubscriberMetrics,
    SupportMetrics,
)
from dotmac.platform.metrics.service import MetricsService


class DummyRedis:
    def __init__(self):
        self.store: dict[str, str] = {}
        self.set_calls: list[tuple[str, int, str]] = []

    async def get(self, key: str):
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self.set_calls.append((key, ttl, value))
        self.store[key] = value

    async def delete(self, key: str):
        self.store.pop(key, None)


@pytest.mark.asyncio
async def test_get_dashboard_metrics_sequential_execution(monkeypatch):
    """
    Ensure dashboard metrics computation does not perform concurrent operations
    on the shared session by simulating overlap and failing if multiple calls
    run simultaneously.
    """

    service = MetricsService(session=None, redis_client=DummyRedis())

    # Prepare deterministic metric components returned by mocked helpers
    subscriber_metrics = SubscriberMetrics(
        total=10,
        active=8,
        suspended=1,
        pending=1,
        disconnected=0,
        growth_this_month=2,
        churn_rate=10.0,
        arpu=12.5,
    )
    network_metrics = NetworkMetrics(
        olt_count=2,
        olts_online=2,
        pon_ports_total=64,
        pon_ports_utilized=40,
        utilization_percent=62.5,
        onu_count=38,
        onus_online=36,
        onus_offline=2,
        avg_signal_strength_dbm=-23.4,
        degraded_onus=3,
    )
    support_metrics = SupportMetrics(
        open_tickets=4,
        avg_response_time_minutes=15.0,
        avg_resolution_time_hours=3.5,
        sla_compliance_percent=95.0,
        tickets_this_week=8,
        tickets_last_week=10,
    )
    revenue_metrics = RevenueMetrics(
        mrr=1200.0, arr=14400.0, outstanding_ar=320.0, overdue_30_days=150.0
    )

    running_calls = 0
    call_order: list[str] = []

    async def guarded(name: str, result):
        nonlocal running_calls
        running_calls += 1
        # If more than one helper runs at the same time, we would exceed 1
        assert running_calls == 1, f"Detected concurrent execution while running {name}"
        # Yield control to emulate asynchronous DB access
        await asyncio.sleep(0)
        running_calls -= 1
        call_order.append(name)
        return result

    monkeypatch.setattr(
        service,
        "_get_subscriber_metrics",
        lambda tenant_id: guarded("subscribers", subscriber_metrics),
    )
    monkeypatch.setattr(
        service,
        "_get_network_metrics",
        lambda tenant_id: guarded("network", network_metrics),
    )
    monkeypatch.setattr(
        service,
        "_get_support_metrics",
        lambda tenant_id: guarded("support", support_metrics),
    )
    monkeypatch.setattr(
        service,
        "_get_revenue_metrics",
        lambda tenant_id: guarded("revenue", revenue_metrics),
    )

    result = await service.get_dashboard_metrics("tenant-123")

    assert result.subscriber_metrics == subscriber_metrics
    assert result.network_metrics == network_metrics
    assert result.support_metrics == support_metrics
    assert result.revenue_metrics == revenue_metrics
    assert call_order == ["subscribers", "network", "support", "revenue"]
    # Cache should have been populated
    cache_key = "metrics:dashboard:tenant-123"
    assert service.redis.store[cache_key]
    assert service.redis.set_calls[0][1] == service.cache_ttl


@pytest.mark.asyncio
async def test_get_dashboard_metrics_uses_cache(monkeypatch):
    """When cached data exists, helpers should not be invoked."""

    redis_client = DummyRedis()
    cached_payload = DashboardMetrics(
        subscriber_metrics=SubscriberMetrics(
            total=1,
            active=1,
            suspended=0,
            pending=0,
            disconnected=0,
            growth_this_month=0,
            churn_rate=0.0,
            arpu=9.99,
        ),
        network_metrics=NetworkMetrics(
            olt_count=1,
            olts_online=1,
            pon_ports_total=32,
            pon_ports_utilized=10,
            utilization_percent=31.25,
            onu_count=10,
            onus_online=10,
            onus_offline=0,
            avg_signal_strength_dbm=-24.1,
            degraded_onus=1,
        ),
        support_metrics=SupportMetrics(
            open_tickets=1,
            avg_response_time_minutes=10.0,
            avg_resolution_time_hours=2.0,
            sla_compliance_percent=98.0,
            tickets_this_week=2,
            tickets_last_week=1,
        ),
        revenue_metrics=RevenueMetrics(
            mrr=100.0, arr=1200.0, outstanding_ar=0.0, overdue_30_days=0.0
        ),
        timestamp=datetime.now(UTC),
        cache_ttl_seconds=300,
    )
    cache_key = "metrics:dashboard:tenant-789"
    redis_client.store[cache_key] = cached_payload.model_dump_json()

    service = MetricsService(session=None, redis_client=redis_client)

    async def fail_helper(*args, **kwargs):
        raise AssertionError("Helper should not be invoked when cache is warm")

    monkeypatch.setattr(service, "_get_subscriber_metrics", fail_helper)
    monkeypatch.setattr(service, "_get_network_metrics", fail_helper)
    monkeypatch.setattr(service, "_get_support_metrics", fail_helper)
    monkeypatch.setattr(service, "_get_revenue_metrics", fail_helper)

    result = await service.get_dashboard_metrics("tenant-789")

    assert result == cached_payload
    # No additional cache writes should have occurred
    assert redis_client.set_calls == []


@pytest.mark.asyncio
async def test_calculate_arpu_handles_zero_active():
    """Guard against division by zero when there are no active subscribers."""
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=None)
    service = MetricsService(session=session, redis_client=None)
    value = await service._calculate_arpu(tenant_id="no-subscribers", active_subscribers=0)
    assert value == 0.0
