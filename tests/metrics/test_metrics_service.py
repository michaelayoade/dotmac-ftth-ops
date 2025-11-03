import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from dotmac.platform.billing.core.entities import InvoiceEntity
from dotmac.platform.billing.core.enums import InvoiceStatus
from dotmac.platform.metrics.schemas import (
    DashboardMetrics,
    NetworkMetrics,
    RevenueMetrics,
    SubscriberMetrics,
    SupportMetrics,
)
from dotmac.platform.metrics.service import MetricsService
from dotmac.platform.radius.models import NAS, RadAcct, RadiusBandwidthProfile
from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus
from dotmac.platform.tenant.models import Tenant
from dotmac.platform.ticketing.models import (
    Ticket,
    TicketActorType,
    TicketPriority,
    TicketStatus,
)

pytestmark = pytest.mark.integration


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
        terminated=0,
        quarantined=0,
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
            terminated=0,
            quarantined=0,
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


@pytest.mark.asyncio
async def test_get_subscriber_metrics_and_kpis_real_data(async_db_session):
    tenant_id = "metrics-tenant"
    service = MetricsService(session=async_db_session, redis_client=None)

    tenant = Tenant(id=tenant_id, name="Metrics Tenant", slug="metrics-tenant-subs")
    profile = RadiusBandwidthProfile(
        id="plan-100",
        tenant_id=tenant_id,
        name="Fiber 100",
        download_rate_kbps=100_000,
        upload_rate_kbps=20_000,
    )

    now = datetime.now(UTC)
    subscribers = [
        Subscriber(
            tenant_id=tenant_id,
            username="active-profile",
            password="secret",
            status=SubscriberStatus.ACTIVE,
            activation_date=now - timedelta(days=2),
            onu_serial="ONU-001",
            bandwidth_profile_id=profile.id,
            device_metadata={"optical_signal_level": -25.0},
        ),
        Subscriber(
            tenant_id=tenant_id,
            username="active-speed",
            password="secret",
            status=SubscriberStatus.ACTIVE,
            activation_date=now - timedelta(days=1),
            onu_serial="ONU-002",
            download_speed_kbps=50_000,
            upload_speed_kbps=10_000,
            device_metadata={"optical_signal_level": -30.0},
        ),
        Subscriber(
            tenant_id=tenant_id,
            username="pending",
            password="secret",
            status=SubscriberStatus.PENDING,
        ),
        Subscriber(
            tenant_id=tenant_id,
            username="suspended",
            password="secret",
            status=SubscriberStatus.SUSPENDED,
            activation_date=now - timedelta(days=45),
        ),
        Subscriber(
            tenant_id=tenant_id,
            username="disconnected",
            password="secret",
            status=SubscriberStatus.DISCONNECTED,
        ),
        Subscriber(
            tenant_id=tenant_id,
            username="terminated",
            password="secret",
            status=SubscriberStatus.TERMINATED,
            termination_date=now - timedelta(days=1),
        ),
        Subscriber(
            tenant_id=tenant_id,
            username="quarantined",
            password="secret",
            status=SubscriberStatus.QUARANTINED,
        ),
    ]

    async_db_session.add(tenant)
    await async_db_session.flush()
    async_db_session.add(profile)
    await async_db_session.flush()
    async_db_session.add_all(subscribers)
    await async_db_session.flush()
    await async_db_session.commit()

    metrics = await service._get_subscriber_metrics(tenant_id)

    assert metrics.total == 7
    assert metrics.active == 2
    assert metrics.suspended == 1
    assert metrics.pending == 1
    assert metrics.disconnected == 1
    assert metrics.terminated == 1
    assert metrics.quarantined == 1
    assert metrics.growth_this_month == 1
    assert metrics.churn_rate == pytest.approx(14.29, rel=1e-3)

    kpis = await service.get_subscriber_kpis(tenant_id, period_days=7)
    assert kpis.total_subscribers == 7
    assert kpis.active_subscribers == 2
    assert kpis.new_subscribers_this_period == 2
    assert kpis.churned_subscribers_this_period == 1
    assert kpis.net_growth == 1
    assert kpis.subscriber_by_plan, "subscriber_by_plan should not be empty"
    assert sum(item.count for item in kpis.subscriber_by_plan) == kpis.total_subscribers
    status_lookup = {item.status: item.count for item in kpis.subscriber_by_status}
    assert status_lookup["active"] == 2
    activation_totals = sum(item.count for item in kpis.daily_activations)
    assert activation_totals == 2


@pytest.mark.asyncio
async def test_get_network_metrics_real_data(async_db_session):
    tenant_id = "metrics-tenant"
    service = MetricsService(session=async_db_session, redis_client=None)

    tenant = Tenant(id=tenant_id, name="Metrics Tenant", slug="metrics-tenant-net")
    nas = NAS(
        tenant_id=tenant_id,
        nasname="10.0.0.1",
        shortname="olt-1",
        type="olt",
        ports=64,
        secret="shared",
    )

    now = datetime.now(UTC)
    subscribers = [
        Subscriber(
            tenant_id=tenant_id,
            username="active1",
            password="secret",
            status=SubscriberStatus.ACTIVE,
            activation_date=now - timedelta(days=3),
            onu_serial="ONU-NET-1",
            device_metadata={"optical_signal_level": -24.0},
        ),
        Subscriber(
            tenant_id=tenant_id,
            username="inactive1",
            password="secret",
            status=SubscriberStatus.SUSPENDED,
            onu_serial="ONU-NET-2",
            device_metadata={"optical_signal_level": -31.0},
        ),
    ]

    async_db_session.add(tenant)
    await async_db_session.flush()
    async_db_session.add(nas)
    await async_db_session.flush()
    async_db_session.add_all(subscribers)
    await async_db_session.flush()
    session_record = RadAcct(
        radacctid=1,
        tenant_id=tenant_id,
        subscriber_id=subscribers[0].id,
        acctsessionid="sess-1",
        acctuniqueid=uuid4().hex,
        username=subscribers[0].username,
        nasipaddress="10.0.0.1",
        acctstarttime=now - timedelta(minutes=10),
        acctupdatetime=now - timedelta(minutes=2),
        acctstoptime=None,
    )
    async_db_session.add(session_record)
    await async_db_session.flush()
    await async_db_session.commit()

    network = await service._get_network_metrics(tenant_id)
    assert network.olt_count == 1
    assert network.olts_online == 1
    assert network.pon_ports_total == 64
    assert network.pon_ports_utilized == 2
    assert network.utilization_percent == pytest.approx(3.1, rel=1e-2)
    assert network.onu_count == 2
    assert network.onus_online == 1
    assert network.onus_offline == 1
    assert network.avg_signal_strength_dbm == pytest.approx(-27.5, rel=1e-3)
    assert network.degraded_onus == 1


@pytest.mark.asyncio
async def test_get_support_metrics_real_data(async_db_session):
    tenant_id = "metrics-tenant"
    service = MetricsService(session=async_db_session, redis_client=None)

    base_time = datetime.now(UTC)
    tickets = [
        Ticket(
            tenant_id=tenant_id,
            ticket_number="TCK-001",
            subject="Fiber outage",
            status=TicketStatus.OPEN,
            priority=TicketPriority.HIGH,
            origin_type=TicketActorType.CUSTOMER,
            target_type=TicketActorType.TENANT,
            created_at=base_time - timedelta(days=2),
            first_response_at=base_time - timedelta(days=2) + timedelta(minutes=30),
            resolution_time_minutes=120,
            sla_due_date=base_time + timedelta(days=1),
            sla_breached=False,
        ),
        Ticket(
            tenant_id=tenant_id,
            ticket_number="TCK-002",
            subject="Speed issue",
            status=TicketStatus.IN_PROGRESS,
            priority=TicketPriority.NORMAL,
            origin_type=TicketActorType.CUSTOMER,
            target_type=TicketActorType.TENANT,
            created_at=base_time - timedelta(days=1),
            first_response_at=base_time - timedelta(days=1) + timedelta(minutes=60),
            resolution_time_minutes=180,
            sla_due_date=base_time + timedelta(days=2),
            sla_breached=False,
        ),
        Ticket(
            tenant_id=tenant_id,
            ticket_number="TCK-003",
            subject="Router replacement",
            status=TicketStatus.WAITING,
            priority=TicketPriority.NORMAL,
            origin_type=TicketActorType.CUSTOMER,
            target_type=TicketActorType.TENANT,
            created_at=base_time - timedelta(days=3),
            first_response_at=base_time - timedelta(days=3) + timedelta(minutes=45),
            resolution_time_minutes=240,
            sla_due_date=base_time + timedelta(days=3),
            sla_breached=True,
        ),
        Ticket(
            tenant_id=tenant_id,
            ticket_number="TCK-004",
            subject="Resolved billing question",
            status=TicketStatus.RESOLVED,
            priority=TicketPriority.LOW,
            origin_type=TicketActorType.CUSTOMER,
            target_type=TicketActorType.TENANT,
            created_at=base_time - timedelta(days=10),
            first_response_at=base_time - timedelta(days=10) + timedelta(minutes=90),
            resolution_time_minutes=300,
            sla_due_date=base_time - timedelta(days=5),
            sla_breached=False,
        ),
    ]

    async_db_session.add_all(tickets)
    await async_db_session.commit()

    metrics = await service._get_support_metrics(tenant_id)
    assert metrics.open_tickets == 3
    assert metrics.avg_response_time_minutes == pytest.approx(56.2, rel=1e-3)
    assert metrics.avg_resolution_time_hours == pytest.approx(3.5, rel=1e-3)
    assert metrics.sla_compliance_percent == pytest.approx(75.0, rel=1e-3)
    assert metrics.tickets_this_week == 3
    assert metrics.tickets_last_week == 1


@pytest.mark.asyncio
async def test_get_revenue_metrics_real_data(async_db_session):
    tenant_id = "metrics-tenant"
    service = MetricsService(session=async_db_session, redis_client=None)

    subscriber = Subscriber(
        tenant_id=tenant_id,
        username="billing-active",
        password="secret",
        status=SubscriberStatus.ACTIVE,
        activation_date=datetime.now(UTC) - timedelta(days=20),
    )

    now = datetime.now(UTC)
    invoices = [
        InvoiceEntity(
            tenant_id=tenant_id,
            customer_id="cust-1",
            billing_email="customer@example.com",
            billing_address={"line1": "123 Main"},
            issue_date=now - timedelta(days=20),
            due_date=now - timedelta(days=10),
            currency="USD",
            subtotal=15000,
            tax_amount=0,
            discount_amount=0,
            total_amount=15000,
            remaining_balance=15000,
            status=InvoiceStatus.OPEN,
        ),
        InvoiceEntity(
            tenant_id=tenant_id,
            customer_id="cust-1",
            billing_email="customer@example.com",
            billing_address={"line1": "123 Main"},
            issue_date=now - timedelta(days=50),
            due_date=now - timedelta(days=40),
            currency="USD",
            subtotal=5000,
            tax_amount=0,
            discount_amount=0,
            total_amount=5000,
            remaining_balance=5000,
            status=InvoiceStatus.OVERDUE,
        ),
        InvoiceEntity(
            tenant_id=tenant_id,
            customer_id="cust-1",
            billing_email="customer@example.com",
            billing_address={"line1": "123 Main"},
            issue_date=now - timedelta(days=5),
            due_date=now + timedelta(days=20),
            currency="USD",
            subtotal=2500,
            tax_amount=0,
            discount_amount=0,
            total_amount=2500,
            remaining_balance=2500,
            status=InvoiceStatus.PARTIALLY_PAID,
        ),
        InvoiceEntity(
            tenant_id=tenant_id,
            customer_id="cust-1",
            billing_email="customer@example.com",
            billing_address={"line1": "123 Main"},
            issue_date=now - timedelta(days=8),
            due_date=now - timedelta(days=2),
            currency="USD",
            subtotal=10000,
            tax_amount=0,
            discount_amount=0,
            total_amount=10000,
            remaining_balance=0,
            status=InvoiceStatus.PAID,
            paid_at=now - timedelta(days=5),
        ),
    ]

    async_db_session.add(subscriber)
    async_db_session.add_all(invoices)
    await async_db_session.commit()

    metrics = await service._get_revenue_metrics(tenant_id)
    assert metrics.mrr == pytest.approx(100.0, rel=1e-3)
    assert metrics.arr == pytest.approx(1200.0, rel=1e-3)
    assert metrics.outstanding_ar == pytest.approx(225.0, rel=1e-3)
    assert metrics.overdue_30_days == pytest.approx(50.0, rel=1e-3)
