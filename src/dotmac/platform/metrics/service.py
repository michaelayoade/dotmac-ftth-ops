"""
Metrics Service

Computes and caches ISP operational metrics and KPIs.
"""

from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import InvoiceEntity
from dotmac.platform.billing.core.enums import InvoiceStatus
from dotmac.platform.metrics.schemas import (
    DailyActivation,
    DashboardMetrics,
    NetworkMetrics,
    RevenueMetrics,
    SubscriberByPlan,
    SubscriberByStatus,
    SubscriberKPIs,
    SubscriberMetrics,
    SupportMetrics,
)
from dotmac.platform.redis_client import RedisClientType
from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus
from dotmac.platform.ticketing.models import (
    Ticket,
    TicketStatus,
)

logger = structlog.get_logger(__name__)


class MetricsService:
    """Service for computing and caching ISP metrics."""

    def __init__(self, session: AsyncSession, redis_client: RedisClientType | None = None):
        self.session = session
        self.redis = redis_client
        self.cache_ttl = 300  # 5 minutes

    async def get_dashboard_metrics(self, tenant_id: str) -> DashboardMetrics:
        """
        Get aggregated dashboard metrics for ISP operations.

        Metrics are cached in Redis with 5-minute TTL.
        """
        # Try cache first
        if self.redis:
            cache_key = f"metrics:dashboard:{tenant_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                logger.info("metrics.dashboard.cache_hit", tenant_id=tenant_id)
                return DashboardMetrics.parse_raw(cached)

        logger.info("metrics.dashboard.computing", tenant_id=tenant_id)

        # Compute metrics sequentially to avoid concurrent session usage
        subscriber_metrics = await self._get_subscriber_metrics(tenant_id)
        network_metrics = await self._get_network_metrics(tenant_id)
        support_metrics = await self._get_support_metrics(tenant_id)
        revenue_metrics = await self._get_revenue_metrics(tenant_id)

        result = DashboardMetrics(
            subscriber_metrics=subscriber_metrics,
            network_metrics=network_metrics,
            support_metrics=support_metrics,
            revenue_metrics=revenue_metrics,
            timestamp=datetime.now(UTC),
            cache_ttl_seconds=self.cache_ttl,
        )

        # Cache result
        if self.redis:
            await self.redis.setex(cache_key, self.cache_ttl, result.model_dump_json())

        return result

    async def _get_subscriber_metrics(self, tenant_id: str) -> SubscriberMetrics:
        """Compute subscriber metrics."""
        # Count subscribers by status
        stmt = (
            select(Subscriber.status, func.count(Subscriber.id))
            .where(Subscriber.tenant_id == tenant_id, Subscriber.deleted_at.is_(None))
            .group_by(Subscriber.status)
        )
        result = await self.session.execute(stmt)
        status_rows = result.all()
        status_counts: dict[SubscriberStatus, int] = {
            status: int(count) for status, count in status_rows
        }

        total = sum(status_counts.values())
        active = status_counts.get(SubscriberStatus.ACTIVE, 0)
        suspended = status_counts.get(SubscriberStatus.SUSPENDED, 0)
        pending = status_counts.get(SubscriberStatus.PENDING, 0)
        disconnected = status_counts.get(SubscriberStatus.DISCONNECTED, 0)

        # Calculate growth this month
        first_day_of_month = datetime.now(UTC).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        new_this_month_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.activation_date >= first_day_of_month,
            Subscriber.deleted_at.is_(None),
        )
        new_this_month = await self.session.scalar(new_this_month_stmt) or 0

        # Calculate churned this month
        churned_this_month_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.termination_date >= first_day_of_month,
            Subscriber.deleted_at.is_(None),
        )
        churned_this_month = await self.session.scalar(churned_this_month_stmt) or 0

        growth = new_this_month - churned_this_month
        churn_rate = (churned_this_month / total * 100) if total > 0 else 0.0

        # Calculate ARPU from billing data
        arpu = await self._calculate_arpu(tenant_id, active)

        return SubscriberMetrics(
            total=total,
            active=active,
            suspended=suspended,
            pending=pending,
            disconnected=disconnected,
            growth_this_month=growth,
            churn_rate=round(churn_rate, 2),
            arpu=arpu,
        )

    async def _get_network_metrics(self, tenant_id: str) -> NetworkMetrics:
        """Compute network infrastructure metrics."""
        # Count ONUs by status (placeholder - would query VOLTHA)
        onu_count_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.onu_serial.isnot(None),
            Subscriber.deleted_at.is_(None),
        )
        onu_count = await self.session.scalar(onu_count_stmt) or 0

        # Estimate ONUs online (active subscribers with ONU)
        onus_online_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.onu_serial.isnot(None),
            Subscriber.status == SubscriberStatus.ACTIVE,
            Subscriber.deleted_at.is_(None),
        )
        onus_online = await self.session.scalar(onus_online_stmt) or 0
        onus_offline = onu_count - onus_online

        # Placeholder values (would integrate with VOLTHA/LibreNMS)
        olt_count = 12
        olts_online = 12
        pon_ports_total = 192
        pon_ports_utilized = min(onu_count, pon_ports_total)
        utilization_percent = (
            (pon_ports_utilized / pon_ports_total * 100) if pon_ports_total > 0 else 0.0
        )
        avg_signal_dbm = -23.5
        degraded_onus = 12  # Signal < -28 dBm

        return NetworkMetrics(
            olt_count=olt_count,
            olts_online=olts_online,
            pon_ports_total=pon_ports_total,
            pon_ports_utilized=pon_ports_utilized,
            utilization_percent=round(utilization_percent, 1),
            onu_count=onu_count,
            onus_online=onus_online,
            onus_offline=onus_offline,
            avg_signal_strength_dbm=avg_signal_dbm,
            degraded_onus=degraded_onus,
        )

    async def _get_support_metrics(self, tenant_id: str) -> SupportMetrics:
        """Compute support and ticketing metrics."""
        # Count open tickets
        open_tickets_stmt = select(func.count(Ticket.id)).where(
            Ticket.tenant_id == tenant_id,
            Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS]),
        )
        open_tickets = await self.session.scalar(open_tickets_stmt) or 0

        # Placeholder values (would calculate from ticket data)
        avg_response_time_minutes = 18.0
        avg_resolution_time_hours = 4.2
        sla_compliance_percent = 94.5

        # Count tickets this week
        week_ago = datetime.now(UTC) - timedelta(days=7)
        tickets_this_week_stmt = select(func.count(Ticket.id)).where(
            Ticket.tenant_id == tenant_id, Ticket.created_at >= week_ago
        )
        tickets_this_week = await self.session.scalar(tickets_this_week_stmt) or 0

        # Count tickets last week
        two_weeks_ago = datetime.now(UTC) - timedelta(days=14)
        tickets_last_week_stmt = select(func.count(Ticket.id)).where(
            Ticket.tenant_id == tenant_id,
            Ticket.created_at >= two_weeks_ago,
            Ticket.created_at < week_ago,
        )
        tickets_last_week = await self.session.scalar(tickets_last_week_stmt) or 0

        return SupportMetrics(
            open_tickets=open_tickets,
            avg_response_time_minutes=avg_response_time_minutes,
            avg_resolution_time_hours=avg_resolution_time_hours,
            sla_compliance_percent=sla_compliance_percent,
            tickets_this_week=tickets_this_week,
            tickets_last_week=tickets_last_week,
        )

    async def _get_revenue_metrics(self, tenant_id: str) -> RevenueMetrics:
        """Compute revenue and financial metrics."""
        # Calculate MRR from active subscriptions (placeholder)
        active_subscribers_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.status == SubscriberStatus.ACTIVE,
            Subscriber.deleted_at.is_(None),
        )
        active_subscribers = await self.session.scalar(active_subscribers_stmt) or 0

        # Calculate ARPU from billing data and derive MRR/ARR
        arpu = await self._calculate_arpu(tenant_id, active_subscribers)
        mrr = active_subscribers * arpu
        arr = mrr * 12

        # Calculate outstanding AR from overdue invoices
        overdue_stmt = select(func.sum(InvoiceEntity.total_amount)).where(
            InvoiceEntity.tenant_id == tenant_id,
            InvoiceEntity.status == InvoiceStatus.OPEN,
            InvoiceEntity.due_date < datetime.now(UTC),
        )
        outstanding_ar_minor_units = await self.session.scalar(overdue_stmt) or 0
        outstanding_ar = float(outstanding_ar_minor_units) / 100.0

        # Calculate overdue >30 days
        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
        overdue_30_stmt = select(func.sum(InvoiceEntity.total_amount)).where(
            InvoiceEntity.tenant_id == tenant_id,
            InvoiceEntity.status == InvoiceStatus.OPEN,
            InvoiceEntity.due_date < thirty_days_ago,
        )
        overdue_30_minor_units = await self.session.scalar(overdue_30_stmt) or 0
        overdue_30_days = float(overdue_30_minor_units) / 100.0

        return RevenueMetrics(
            mrr=round(mrr, 2),
            arr=round(arr, 2),
            outstanding_ar=round(outstanding_ar, 2),
            overdue_30_days=round(overdue_30_days, 2),
        )

    async def _calculate_arpu(self, tenant_id: str, active_subscribers: int) -> float:
        """
        Calculate Average Revenue Per User (ARPU) from billing data.

        ARPU = Total revenue from paid invoices in last 30 days / Active subscribers

        Returns 0.0 if there are no active subscribers or no revenue data.
        """
        if active_subscribers == 0:
            return 0.0

        # Get revenue from paid invoices in the last 30 days
        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)

        # Sum total amount from paid invoices in last 30 days
        revenue_stmt = select(func.sum(InvoiceEntity.total_amount)).where(
            InvoiceEntity.tenant_id == tenant_id,
            InvoiceEntity.status == InvoiceStatus.PAID,
            InvoiceEntity.paid_at >= thirty_days_ago,
        )
        total_revenue_minor_units = await self.session.scalar(revenue_stmt) or 0

        # Convert from minor units (cents) to major units (dollars)
        total_revenue = float(total_revenue_minor_units) / 100.0

        # Calculate ARPU
        arpu = total_revenue / active_subscribers if active_subscribers > 0 else 0.0

        return round(arpu, 2)

    async def get_subscriber_kpis(self, tenant_id: str, period_days: int = 30) -> SubscriberKPIs:
        """Get detailed subscriber KPIs with trends."""
        # Get period start date
        period_start = datetime.now(UTC) - timedelta(days=period_days)

        # Total subscribers
        total_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id, Subscriber.deleted_at.is_(None)
        )
        total_subscribers = await self.session.scalar(total_stmt) or 0

        # Active subscribers
        active_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.status == SubscriberStatus.ACTIVE,
            Subscriber.deleted_at.is_(None),
        )
        active_subscribers = await self.session.scalar(active_stmt) or 0

        # New subscribers in period
        new_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.activation_date >= period_start,
            Subscriber.deleted_at.is_(None),
        )
        new_subscribers = await self.session.scalar(new_stmt) or 0

        # Churned subscribers in period
        churned_stmt = select(func.count(Subscriber.id)).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.termination_date >= period_start,
            Subscriber.deleted_at.is_(None),
        )
        churned_subscribers = await self.session.scalar(churned_stmt) or 0

        net_growth = new_subscribers - churned_subscribers
        churn_rate = (
            (churned_subscribers / total_subscribers * 100) if total_subscribers > 0 else 0.0
        )

        # Subscribers by plan (placeholder)
        subscriber_by_plan = [
            SubscriberByPlan(plan="100Mbps", count=450, percentage=36.0),
            SubscriberByPlan(plan="500Mbps", count=620, percentage=49.6),
            SubscriberByPlan(plan="1Gbps", count=180, percentage=14.4),
        ]

        # Subscribers by status
        status_stmt = (
            select(Subscriber.status, func.count(Subscriber.id))
            .where(Subscriber.tenant_id == tenant_id, Subscriber.deleted_at.is_(None))
            .group_by(Subscriber.status)
        )
        status_result = await self.session.execute(status_stmt)
        status_rows = status_result.all()
        status_counts: dict[SubscriberStatus, int] = {
            status: int(count) for status, count in status_rows
        }

        subscriber_by_status = [
            SubscriberByStatus(
                status=status.value,
                count=count,
                percentage=(
                    round(count / total_subscribers * 100, 1) if total_subscribers > 0 else 0.0
                ),
            )
            for status, count in status_counts.items()
        ]

        # Daily activations (placeholder)
        daily_activations = [
            DailyActivation(
                date=(datetime.now(UTC) - timedelta(days=i)).strftime("%Y-%m-%d"), count=2 + (i % 3)
            )
            for i in range(30)
        ][
            ::-1
        ]  # Reverse to oldest first

        return SubscriberKPIs(
            total_subscribers=total_subscribers,
            active_subscribers=active_subscribers,
            new_subscribers_this_period=new_subscribers,
            churned_subscribers_this_period=churned_subscribers,
            net_growth=net_growth,
            churn_rate=round(churn_rate, 2),
            subscriber_by_plan=subscriber_by_plan,
            subscriber_by_status=subscriber_by_status,
            daily_activations=daily_activations,
        )

    async def invalidate_cache(self, tenant_id: str) -> None:
        """Invalidate all cached metrics for a tenant."""
        if self.redis:
            keys = [
                f"metrics:dashboard:{tenant_id}",
                f"metrics:subscribers:{tenant_id}",
                f"metrics:network:{tenant_id}",
                f"metrics:support:{tenant_id}",
                f"metrics:revenue:{tenant_id}",
            ]
            for key in keys:
                await self.redis.delete(key)
            logger.info("metrics.cache_invalidated", tenant_id=tenant_id)
