"""
Metrics Service

Computes and caches ISP operational metrics and KPIs.
"""

from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import and_, func, or_, select
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
from dotmac.platform.radius.models import NAS, RadAcct, RadiusBandwidthProfile
from dotmac.platform.redis_client import RedisClientType
from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus
from dotmac.platform.ticketing.models import (
    Ticket,
    TicketStatus,
)

logger = structlog.get_logger(__name__)


def _safe_float(value: object) -> float | None:
    """Best-effort conversion to float."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _safe_int(value: object) -> int:
    """Best-effort conversion to int with graceful fallback."""
    try:
        if value is None:
            return 0
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        return int(str(value))
    except (TypeError, ValueError):
        return 0


class MetricsService:
    """Service for computing and caching ISP metrics."""

    def __init__(self, session: AsyncSession, redis_client: RedisClientType | None = None):
        self.session = session
        self.redis = redis_client
        self.cache_ttl = 300  # 5 minutes

    def _require_session(self) -> AsyncSession:
        """Ensure a database session is available."""
        if self.session is None:
            raise RuntimeError("MetricsService requires an AsyncSession for data access")
        return self.session

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
        session = self._require_session()

        status_counts: dict[SubscriberStatus, int] = dict.fromkeys(SubscriberStatus, 0)
        subscriber_rows = (
            await session.execute(
                select(
                    Subscriber.status,
                    Subscriber.activation_date,
                    Subscriber.termination_date,
                ).where(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.deleted_at.is_(None),
                )
            )
        ).all()

        def _normalize(dt: datetime | None) -> datetime | None:
            if dt is None:
                return None
            if dt.tzinfo is None:
                return dt
            return dt.astimezone(UTC).replace(tzinfo=None)

        rolling_window_start = datetime.now(UTC) - timedelta(days=30)
        month_start = _normalize(rolling_window_start)

        new_this_month = 0
        churned_this_month = 0

        for status_value, activation_date, termination_date in subscriber_rows:
            if status_value is None:
                continue

            status_enum = (
                status_value
                if isinstance(status_value, SubscriberStatus)
                else SubscriberStatus(status_value)
            )
            status_counts[status_enum] += 1

            activation_normalized = _normalize(activation_date)
            if (
                activation_normalized is not None
                and month_start is not None
                and activation_normalized >= month_start
            ):
                new_this_month += 1

            termination_normalized = _normalize(termination_date)
            if (
                termination_normalized is not None
                and month_start is not None
                and termination_normalized >= month_start
            ):
                churned_this_month += 1

        total = sum(status_counts.values())
        active = status_counts[SubscriberStatus.ACTIVE]
        suspended = status_counts[SubscriberStatus.SUSPENDED]
        pending = status_counts[SubscriberStatus.PENDING]
        disconnected = status_counts[SubscriberStatus.DISCONNECTED]
        terminated = status_counts[SubscriberStatus.TERMINATED]
        quarantined = status_counts[SubscriberStatus.QUARANTINED]

        growth = new_this_month - churned_this_month
        churn_rate = round((churned_this_month / total * 100), 2) if total else 0.0

        arpu = await self._calculate_arpu(tenant_id, active)

        return SubscriberMetrics(
            total=total,
            active=active,
            suspended=suspended,
            pending=pending,
            disconnected=disconnected,
            terminated=terminated,
            quarantined=quarantined,
            growth_this_month=growth,
            churn_rate=churn_rate,
            arpu=arpu,
        )

    async def _get_network_metrics(self, tenant_id: str) -> NetworkMetrics:
        """Compute network infrastructure metrics."""
        session = self._require_session()

        # Discover OLT NAS devices for the tenant
        nas_stmt = select(NAS).where(NAS.tenant_id == tenant_id)
        olt_devices = [
            nas
            for nas in (await session.execute(nas_stmt)).scalars().all()
            if (nas.type or "").lower().find("olt") != -1
            or (nas.description or "").lower().find("olt") != -1
        ]

        olt_count = len(olt_devices)
        pon_ports_total = sum(_safe_int(getattr(nas, "ports", 0)) for nas in olt_devices)

        # Determine which OLTs have active sessions in the last 15 minutes
        olts_online = 0
        if olt_devices:
            recent_cutoff = datetime.now(UTC) - timedelta(minutes=15)
            olt_identifiers = {str(nas.nasname) for nas in olt_devices if nas.nasname}
            if olt_identifiers:
                active_stmt = select(func.distinct(RadAcct.nasipaddress)).where(
                    RadAcct.tenant_id == tenant_id,
                    RadAcct.acctstoptime.is_(None),
                    RadAcct.nasipaddress.in_(olt_identifiers),
                    or_(
                        RadAcct.acctupdatetime.is_(None),
                        RadAcct.acctupdatetime >= recent_cutoff,
                    ),
                )
                active_olt_addresses = {
                    str(addr) for addr in (await session.execute(active_stmt)).scalars().all()
                }
                olts_online = sum(
                    1
                    for nas in olt_devices
                    if nas.nasname and str(nas.nasname) in active_olt_addresses
                )

        # Subscriber-based ONU counts
        onu_count = (
            await session.scalar(
                select(func.count(Subscriber.id)).where(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.onu_serial.isnot(None),
                    Subscriber.deleted_at.is_(None),
                )
            )
            or 0
        )

        onus_online = (
            await session.scalar(
                select(func.count(Subscriber.id)).where(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.onu_serial.isnot(None),
                    Subscriber.status == SubscriberStatus.ACTIVE,
                    Subscriber.deleted_at.is_(None),
                )
            )
            or 0
        )
        onus_offline = max(onu_count - onus_online, 0)

        pon_ports_utilized = (
            await session.scalar(
                select(func.count(func.distinct(Subscriber.onu_serial))).where(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.onu_serial.isnot(None),
                    Subscriber.deleted_at.is_(None),
                )
            )
            or 0
        )

        utilization_percent = (
            round(pon_ports_utilized / pon_ports_total * 100, 1) if pon_ports_total else 0.0
        )

        # Extract signal levels from subscriber metadata
        signal_stmt = select(Subscriber.device_metadata).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.onu_serial.isnot(None),
            Subscriber.deleted_at.is_(None),
        )
        signal_values = []
        degraded_onus = 0
        for metadata in (await session.execute(signal_stmt)).scalars().all():
            if not isinstance(metadata, dict):
                continue
            # Common keys used across integrations
            level = (
                metadata.get("optical_signal_level")
                or metadata.get("signal_strength_dbm")
                or metadata.get("signal_dbm")
            )
            signal = _safe_float(level)
            if signal is None:
                continue
            signal_values.append(signal)
            if signal <= -28.0:
                degraded_onus += 1

        avg_signal_dbm = (
            round(sum(signal_values) / len(signal_values), 1) if signal_values else None
        )

        return NetworkMetrics(
            olt_count=olt_count,
            olts_online=olts_online,
            pon_ports_total=pon_ports_total,
            pon_ports_utilized=pon_ports_utilized,
            utilization_percent=utilization_percent,
            onu_count=onu_count,
            onus_online=onus_online,
            onus_offline=onus_offline,
            avg_signal_strength_dbm=avg_signal_dbm,
            degraded_onus=degraded_onus,
        )

    async def _get_support_metrics(self, tenant_id: str) -> SupportMetrics:
        """Compute support and ticketing metrics."""
        session = self._require_session()

        active_statuses = (TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING)
        open_tickets = (
            await session.scalar(
                select(func.count(Ticket.id)).where(
                    Ticket.tenant_id == tenant_id,
                    Ticket.status.in_(active_statuses),
                )
            )
            or 0
        )

        # Response time (minutes)
        response_rows = await session.execute(
            select(Ticket.created_at, Ticket.first_response_at).where(
                Ticket.tenant_id == tenant_id,
                Ticket.first_response_at.isnot(None),
            )
        )
        response_durations: list[float] = []
        for created_at, first_response_at in response_rows.all():
            if not created_at or not first_response_at:
                continue
            delta_minutes = (first_response_at - created_at).total_seconds() / 60
            if delta_minutes >= 0:
                response_durations.append(delta_minutes)
        avg_response_time_minutes = (
            round(sum(response_durations) / len(response_durations), 1)
            if response_durations
            else 0.0
        )

        # Resolution time (hours)
        resolution_minutes = [
            minutes
            for minutes in (
                await session.execute(
                    select(Ticket.resolution_time_minutes).where(
                        Ticket.tenant_id == tenant_id,
                        Ticket.resolution_time_minutes.isnot(None),
                    )
                )
            )
            .scalars()
            .all()
            if minutes is not None and minutes >= 0
        ]
        avg_resolution_time_hours = (
            round((sum(resolution_minutes) / len(resolution_minutes)) / 60, 2)
            if resolution_minutes
            else 0.0
        )

        # SLA compliance
        sla_values = (
            (
                await session.execute(
                    select(Ticket.sla_breached).where(
                        Ticket.tenant_id == tenant_id,
                        Ticket.sla_due_date.isnot(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        if sla_values:
            compliant = sum(1 for breached in sla_values if not breached)
            sla_compliance_percent = round(compliant / len(sla_values) * 100, 1)
        else:
            sla_compliance_percent = 100.0

        now = datetime.now(UTC)
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        tickets_this_week = (
            await session.scalar(
                select(func.count(Ticket.id)).where(
                    Ticket.tenant_id == tenant_id,
                    Ticket.created_at >= week_ago,
                )
            )
            or 0
        )

        tickets_last_week = (
            await session.scalar(
                select(func.count(Ticket.id)).where(
                    Ticket.tenant_id == tenant_id,
                    Ticket.created_at >= two_weeks_ago,
                    Ticket.created_at < week_ago,
                )
            )
            or 0
        )

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
        session = self._require_session()

        active_subscribers = (
            await session.scalar(
                select(func.count(Subscriber.id)).where(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.status == SubscriberStatus.ACTIVE,
                    Subscriber.deleted_at.is_(None),
                )
            )
            or 0
        )

        arpu = await self._calculate_arpu(tenant_id, active_subscribers)
        mrr = active_subscribers * arpu
        arr = mrr * 12

        # Accounts receivable balances
        collectible_statuses = (
            InvoiceStatus.OPEN,
            InvoiceStatus.OVERDUE,
            InvoiceStatus.PARTIALLY_PAID,
        )
        outstanding_ar_minor_units = (
            await session.scalar(
                select(func.sum(InvoiceEntity.remaining_balance)).where(
                    InvoiceEntity.tenant_id == tenant_id,
                    InvoiceEntity.status.in_(collectible_statuses),
                    InvoiceEntity.remaining_balance > 0,
                )
            )
            or 0
        )

        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
        overdue_30_minor_units = (
            await session.scalar(
                select(func.sum(InvoiceEntity.remaining_balance)).where(
                    InvoiceEntity.tenant_id == tenant_id,
                    InvoiceEntity.status.in_(collectible_statuses),
                    InvoiceEntity.remaining_balance > 0,
                    InvoiceEntity.due_date < thirty_days_ago,
                )
            )
            or 0
        )

        return RevenueMetrics(
            mrr=round(mrr, 2),
            arr=round(arr, 2),
            outstanding_ar=round(outstanding_ar_minor_units / 100.0, 2),
            overdue_30_days=round(overdue_30_minor_units / 100.0, 2),
        )

    async def _calculate_arpu(self, tenant_id: str, active_subscribers: int) -> float:
        """
        Calculate Average Revenue Per User (ARPU) from billing data.

        ARPU = Total revenue from paid invoices in last 30 days / Active subscribers

        Returns 0.0 if there are no active subscribers or no revenue data.
        """
        if active_subscribers == 0:
            return 0.0

        session = self._require_session()

        # Get revenue from paid invoices in the last 30 days
        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)

        # Sum total amount from paid invoices in last 30 days
        revenue_stmt = select(func.sum(InvoiceEntity.total_amount)).where(
            InvoiceEntity.tenant_id == tenant_id,
            InvoiceEntity.status == InvoiceStatus.PAID,
            InvoiceEntity.paid_at >= thirty_days_ago,
        )
        total_revenue_minor_units = await session.scalar(revenue_stmt) or 0

        # Convert from minor units (cents) to major units (dollars)
        total_revenue = float(total_revenue_minor_units) / 100.0

        # Calculate ARPU
        arpu = total_revenue / active_subscribers if active_subscribers > 0 else 0.0

        return round(arpu, 2)

    async def get_subscriber_kpis(self, tenant_id: str, period_days: int = 30) -> SubscriberKPIs:
        """Get detailed subscriber KPIs with trends."""
        session = self._require_session()
        period_days = max(1, min(period_days, 365))
        period_start = datetime.now(UTC) - timedelta(days=period_days)

        total_subscribers = (
            await session.scalar(
                select(func.count(Subscriber.id)).where(
                    Subscriber.tenant_id == tenant_id, Subscriber.deleted_at.is_(None)
                )
            )
            or 0
        )

        active_subscribers = (
            await session.scalar(
                select(func.count(Subscriber.id)).where(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.status == SubscriberStatus.ACTIVE,
                    Subscriber.deleted_at.is_(None),
                )
            )
            or 0
        )

        new_subscribers = (
            await session.scalar(
                select(func.count(Subscriber.id)).where(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.activation_date.isnot(None),
                    Subscriber.activation_date >= period_start,
                    Subscriber.deleted_at.is_(None),
                )
            )
            or 0
        )

        churned_subscribers = (
            await session.scalar(
                select(func.count(Subscriber.id)).where(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.termination_date.isnot(None),
                    Subscriber.termination_date >= period_start,
                    Subscriber.deleted_at.is_(None),
                )
            )
            or 0
        )

        net_growth = new_subscribers - churned_subscribers
        churn_rate = (
            round((churned_subscribers / total_subscribers * 100), 2) if total_subscribers else 0.0
        )

        status_counts: dict[SubscriberStatus, int] = dict.fromkeys(SubscriberStatus, 0)
        status_stmt = (
            select(Subscriber.status, func.count(Subscriber.id))
            .where(Subscriber.tenant_id == tenant_id, Subscriber.deleted_at.is_(None))
            .group_by(Subscriber.status)
        )
        for status, count in await session.execute(status_stmt):
            if status is None:
                continue
            status_counts[status] = int(count or 0)

        subscriber_by_status = [
            SubscriberByStatus(
                status=status.value,
                count=status_counts[status],
                percentage=(
                    round(status_counts[status] / total_subscribers * 100, 1)
                    if total_subscribers
                    else 0.0
                ),
            )
            for status in SubscriberStatus
        ]

        plan_rows = await session.execute(
            select(
                Subscriber.bandwidth_profile_id,
                RadiusBandwidthProfile.name,
                Subscriber.service_type,
                Subscriber.download_speed_kbps,
                Subscriber.upload_speed_kbps,
                func.count(Subscriber.id),
            )
            .outerjoin(
                RadiusBandwidthProfile,
                and_(
                    Subscriber.bandwidth_profile_id == RadiusBandwidthProfile.id,
                    RadiusBandwidthProfile.tenant_id == tenant_id,
                ),
            )
            .where(Subscriber.tenant_id == tenant_id, Subscriber.deleted_at.is_(None))
            .group_by(
                Subscriber.bandwidth_profile_id,
                RadiusBandwidthProfile.name,
                Subscriber.service_type,
                Subscriber.download_speed_kbps,
                Subscriber.upload_speed_kbps,
            )
        )

        subscriber_by_plan: list[SubscriberByPlan] = []
        for (
            _profile_id,
            profile_name,
            service_type,
            download_kbps,
            upload_kbps,
            count,
        ) in plan_rows:
            plan_name = profile_name
            if not plan_name and service_type:
                plan_name = service_type.value.replace("_", " ").title()
            if not plan_name and download_kbps:
                download_mbps = round(download_kbps / 1000, 1)
                upload_mbps = round((upload_kbps or 0) / 1000, 1)
                plan_name = (
                    f"{download_mbps:g}/{upload_mbps:g} Mbps"
                    if upload_kbps
                    else f"{download_mbps:g} Mbps"
                )
            plan_name = plan_name or "Unassigned"
            percentage = round(count / total_subscribers * 100, 1) if total_subscribers else 0.0
            subscriber_by_plan.append(
                SubscriberByPlan(plan=plan_name, count=int(count), percentage=percentage)
            )

        subscriber_by_plan.sort(key=lambda item: item.count, reverse=True)

        # Daily activations timeline
        activation_stmt = (
            select(func.date(Subscriber.activation_date), func.count(Subscriber.id))
            .where(
                Subscriber.tenant_id == tenant_id,
                Subscriber.activation_date.isnot(None),
                Subscriber.activation_date >= period_start,
                Subscriber.deleted_at.is_(None),
            )
            .group_by(func.date(Subscriber.activation_date))
        )
        activation_rows = await session.execute(activation_stmt)
        activation_map: dict[str, int] = {}
        for day_value, count in activation_rows:
            if day_value is None:
                continue
            if isinstance(day_value, datetime):
                date_str = day_value.date().isoformat()
            else:
                date_str = str(day_value)
            activation_map[date_str] = int(count)

        start_day = period_start.date()
        end_day = datetime.now(UTC).date()
        total_days = (end_day - start_day).days + 1
        daily_activations = [
            DailyActivation(
                date=(start_day + timedelta(days=offset)).isoformat(),
                count=activation_map.get((start_day + timedelta(days=offset)).isoformat(), 0),
            )
            for offset in range(total_days)
        ]

        return SubscriberKPIs(
            total_subscribers=total_subscribers,
            active_subscribers=active_subscribers,
            new_subscribers_this_period=new_subscribers,
            churned_subscribers_this_period=churned_subscribers,
            net_growth=net_growth,
            churn_rate=churn_rate,
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
