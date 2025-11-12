"""
Data Cap Monitoring and Alert Tasks.

Periodic Celery tasks to monitor subscriber bandwidth usage against plan data caps
and generate alerts when thresholds are exceeded.
"""

from contextlib import AbstractAsyncContextManager
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, cast

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.celery_app import celery_app
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.db import async_session_maker
from dotmac.platform.fault_management.models import AlarmSeverity, AlarmSource
from dotmac.platform.fault_management.schemas import AlarmCreate
from dotmac.platform.fault_management.service import AlarmService
from dotmac.platform.services.internet_plans.models import (
    InternetServicePlan,
    PlanSubscription,
)
from dotmac.platform.settings import settings
from dotmac.platform.subscribers.models import Subscriber

# Optional TimescaleDB imports
try:
    from dotmac.platform.timeseries import TimeSeriesSessionLocal
    from dotmac.platform.timeseries.repository import RadiusTimeSeriesRepository

    TIMESCALEDB_AVAILABLE = True
except ImportError:
    TIMESCALEDB_AVAILABLE = False


def _session_context() -> AbstractAsyncContextManager[AsyncSession]:
    """Typed helper for acquiring an async session."""
    session_factory = async_session_maker
    return cast(AbstractAsyncContextManager[AsyncSession], session_factory())


logger = structlog.get_logger(__name__)


# Data cap usage thresholds (percentage)
USAGE_THRESHOLDS = {
    80: AlarmSeverity.WARNING,  # 80% = WARNING
    90: AlarmSeverity.MINOR,  # 90% = MINOR
    100: AlarmSeverity.MAJOR,  # 100% = MAJOR (exceeded cap)
}


async def get_current_billing_period(
    subscription: PlanSubscription,
) -> tuple[datetime, datetime]:
    """
    Calculate current billing period start and end dates based on subscription.

    Args:
        subscription: Plan subscription

    Returns:
        Tuple of (period_start, period_end)
    """
    now = datetime.utcnow()

    # If last_usage_reset exists, use it as period start
    if subscription.last_usage_reset:
        period_start = subscription.last_usage_reset
    else:
        # Otherwise use subscription start date
        period_start = subscription.start_date

    # Calculate period end (typically monthly billing cycle)
    # For simplicity, assume 30-day billing cycle
    period_end = period_start + timedelta(days=30)

    # If period has ended, roll forward to current period
    while period_end < now:
        period_start = period_end
        period_end = period_start + timedelta(days=30)

    return period_start, period_end


async def query_subscriber_usage_gb(
    tenant_id: str,
    subscriber_id: str,
    period_start: datetime,
    period_end: datetime,
) -> Decimal:
    """
    Query total bandwidth usage for subscriber in billing period.

    Uses TimescaleDB if available, otherwise returns 0.

    Args:
        tenant_id: Tenant ID
        subscriber_id: Actual RADIUS subscriber ID (from subscribers table)
        period_start: Period start date
        period_end: Period end date

    Returns:
        Total usage in GB
    """
    if not TIMESCALEDB_AVAILABLE or not settings.timescaledb.is_configured:
        logger.warning(
            "usage_monitoring.timescaledb_unavailable",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
        )
        return Decimal("0.00")

    if TimeSeriesSessionLocal is None:
        logger.warning(
            "usage_monitoring.timescaledb_uninitialized",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
        )
        return Decimal("0.00")

    try:
        async with TimeSeriesSessionLocal() as ts_session:
            repo = RadiusTimeSeriesRepository()

            # Query usage for the subscriber
            usage_data = await repo.get_subscriber_usage(
                ts_session,
                tenant_id,
                subscriber_id=subscriber_id,
                start_date=period_start,
                end_date=period_end,
            )

            # Convert bytes to GB
            total_bytes = usage_data["total_bandwidth"]
            total_gb = Decimal(total_bytes) / Decimal(1024**3)

            logger.debug(
                "usage_monitoring.usage_queried",
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                total_gb=float(total_gb),
                period_start=period_start.isoformat(),
                period_end=period_end.isoformat(),
            )

            return total_gb

    except Exception as e:
        logger.error(
            "usage_monitoring.query_failed",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            error=str(e),
        )
        return Decimal("0.00")


async def check_and_create_alert(
    session: AsyncSession,
    subscription: PlanSubscription,
    customer: Customer,
    usage_gb: Decimal,
    cap_gb: Decimal,
    usage_percentage: Decimal,
) -> None:
    """
    Check if usage exceeds thresholds and create appropriate alarm.

    Args:
        session: Database session
        subscription: Plan subscription
        customer: Customer record
        usage_gb: Current usage in GB
        cap_gb: Data cap in GB
        usage_percentage: Usage as percentage of cap
    """
    # Determine which threshold was crossed
    threshold_crossed = None
    severity = None

    for threshold_pct, threshold_severity in sorted(USAGE_THRESHOLDS.items(), reverse=True):
        if usage_percentage >= threshold_pct:
            threshold_crossed = threshold_pct
            severity = threshold_severity
            break

    if threshold_crossed is None or severity is None:
        # Usage is below all thresholds, no alert needed
        return

    # Create unique alarm ID for deduplication
    alarm_id = f"DATA_CAP_{subscription.tenant_id}_{customer.id}_{threshold_crossed}"

    # Prepare alarm data
    if threshold_crossed == 100:
        title = f"Data Cap Exceeded: {customer.email}"
        description = (
            f"Customer {customer.first_name} {customer.last_name} has exceeded their "
            f"data cap of {cap_gb} GB. Current usage: {usage_gb} GB ({usage_percentage}%)."
        )
        recommended_action = (
            "Consider upgrading customer to higher plan or applying overage charges."
        )
    else:
        title = f"Data Cap {threshold_crossed}% Threshold: {customer.email}"
        description = (
            f"Customer {customer.first_name} {customer.last_name} has reached "
            f"{usage_percentage}% of their data cap ({usage_gb} GB / {cap_gb} GB)."
        )
        recommended_action = (
            "Monitor usage. Consider notifying customer about approaching data cap limit."
        )

    # Create alarm using fault management service
    alarm_service = AlarmService(session, subscription.tenant_id)

    alarm_create = AlarmCreate(
        alarm_id=alarm_id,
        severity=severity,
        source=AlarmSource.SERVICE,
        alarm_type="DATA_CAP_THRESHOLD",
        title=title,
        description=description,
        resource_type="plan_subscription",
        resource_id=str(subscription.id),
        resource_name=subscription.plan.name if subscription.plan else "Unknown Plan",
        customer_id=customer.id,
        customer_name=f"{customer.first_name} {customer.last_name}",
        tags={
            "threshold": str(threshold_crossed),
            "usage_gb": str(usage_gb),
            "cap_gb": str(cap_gb),
            "usage_percentage": str(usage_percentage),
        },
        metadata={
            "plan_id": str(subscription.plan_id),
            "subscription_id": str(subscription.id),
            "billing_period_start": (
                subscription.last_usage_reset.isoformat() if subscription.last_usage_reset else None
            ),
        },
        recommended_action=recommended_action,
    )

    try:
        await alarm_service.create(alarm_create)

        logger.info(
            "usage_monitoring.alert_created",
            tenant_id=subscription.tenant_id,
            customer_id=str(customer.id),
            threshold=threshold_crossed,
            usage_gb=float(usage_gb),
            cap_gb=float(cap_gb),
            severity=severity.value,
        )

    except Exception as e:
        logger.error(
            "usage_monitoring.alert_creation_failed",
            tenant_id=subscription.tenant_id,
            customer_id=str(customer.id),
            error=str(e),
        )


async def monitor_subscriber_data_cap(
    session: AsyncSession,
    subscription: PlanSubscription,
) -> dict[str, Any]:
    """
    Monitor data cap for a single subscriber.

    Args:
        session: Database session
        subscription: Plan subscription to monitor

    Returns:
        Dictionary with monitoring results
    """
    plan = subscription.plan

    # Skip if plan doesn't have a data cap
    if not plan.has_data_cap:
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "no_data_cap",
        }

    # Get data cap in GB
    cap_gb = plan.get_data_cap_gb()
    if not cap_gb or cap_gb <= 0:
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "unlimited_or_invalid_cap",
        }

    # Get customer
    result = await session.execute(
        select(Customer).where(
            and_(
                Customer.id == subscription.customer_id,
                Customer.tenant_id == subscription.tenant_id,
            )
        )
    )
    customer = result.scalar_one_or_none()

    if not customer:
        logger.warning(
            "usage_monitoring.customer_not_found",
            subscription_id=str(subscription.id),
            customer_id=str(subscription.customer_id),
        )
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "customer_not_found",
        }

    # Get subscriber (RADIUS entity) linked to this subscription
    # Use the subscription.subscriber_id FK for deterministic mapping
    if not subscription.subscriber_id:
        logger.warning(
            "usage_monitoring.missing_subscriber_link",
            subscription_id=str(subscription.id),
            customer_id=str(customer.id),
            hint="PlanSubscription.subscriber_id is NULL - data integrity issue",
        )
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "subscriber_id_not_set",
        }

    subscriber_result = await session.execute(
        select(Subscriber).where(
            and_(
                Subscriber.id == subscription.subscriber_id,
                Subscriber.tenant_id == subscription.tenant_id,
                Subscriber.deleted_at.is_(None),  # Not soft-deleted
            )
        )
    )
    subscriber = subscriber_result.scalar_one_or_none()

    if not subscriber:
        logger.warning(
            "usage_monitoring.subscriber_not_found",
            subscription_id=str(subscription.id),
            customer_id=str(customer.id),
        )
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "subscriber_not_found",
        }

    # Get current billing period
    period_start, period_end = await get_current_billing_period(subscription)

    # Query usage from TimescaleDB using actual RADIUS subscriber_id
    usage_gb = await query_subscriber_usage_gb(
        tenant_id=subscription.tenant_id,
        subscriber_id=subscriber.id,  # Use actual subscriber ID from RADIUS
        period_start=period_start,
        period_end=period_end,
    )

    # Calculate usage percentage
    usage_percentage = (usage_gb / cap_gb) * Decimal("100") if cap_gb > 0 else Decimal("0")

    logger.info(
        "usage_monitoring.checked",
        tenant_id=subscription.tenant_id,
        customer_id=str(customer.id),
        usage_gb=float(usage_gb),
        cap_gb=float(cap_gb),
        usage_percentage=float(usage_percentage),
    )

    # Check thresholds and create alerts if needed
    await check_and_create_alert(
        session=session,
        subscription=subscription,
        customer=customer,
        usage_gb=usage_gb,
        cap_gb=cap_gb,
        usage_percentage=usage_percentage,
    )

    return {
        "subscription_id": str(subscription.id),
        "customer_id": str(customer.id),
        "usage_gb": float(usage_gb),
        "cap_gb": float(cap_gb),
        "usage_percentage": float(usage_percentage),
        "alert_created": usage_percentage >= 80,
    }


@celery_app.task(name="services.monitor_data_cap_usage", bind=True, max_retries=3)
def monitor_data_cap_usage(self: Any, batch_size: int = 100) -> dict[str, Any]:
    """
    Monitor data cap usage for all active subscriptions with data caps.

    This task:
    1. Queries all active plan subscriptions with data caps
    2. Checks current billing period usage from TimescaleDB
    3. Calculates usage percentage against cap
    4. Creates alerts at 80%, 90%, 100% thresholds
    5. Sends notifications through communications module

    Args:
        batch_size: Number of subscriptions to process per batch

    Returns:
        Dictionary with monitoring statistics
    """
    import asyncio

    logger.info("usage_monitoring.task_started", batch_size=batch_size)

    async def run_monitoring():
        results = {
            "total_checked": 0,
            "alerts_created": 0,
            "skipped": 0,
            "errors": 0,
        }

        async with _session_context() as session:
            # Query active subscriptions with data caps
            stmt = (
                select(PlanSubscription)
                .join(InternetServicePlan)
                .where(
                    and_(
                        PlanSubscription.is_active,
                        PlanSubscription.is_suspended.is_(False),
                        InternetServicePlan.has_data_cap,
                    )
                )
                .limit(batch_size)
            )

            result = await session.execute(stmt)
            subscriptions = result.scalars().all()

            logger.info(
                "usage_monitoring.subscriptions_found",
                count=len(subscriptions),
            )

            for subscription in subscriptions:
                try:
                    check_result = await monitor_subscriber_data_cap(session, subscription)

                    results["total_checked"] += 1

                    if check_result.get("skipped"):
                        results["skipped"] += 1
                    elif check_result.get("alert_created"):
                        results["alerts_created"] += 1

                except Exception as e:
                    results["errors"] += 1
                    logger.error(
                        "usage_monitoring.subscription_check_failed",
                        subscription_id=str(subscription.id),
                        error=str(e),
                    )

        return results

    try:
        results = asyncio.run(run_monitoring())

        logger.info(
            "usage_monitoring.task_completed",
            total_checked=results["total_checked"],
            alerts_created=results["alerts_created"],
            skipped=results["skipped"],
            errors=results["errors"],
        )

        return results

    except Exception as e:
        logger.error("usage_monitoring.task_failed", error=str(e))
        raise self.retry(exc=e, countdown=300)  # Retry after 5 minutes
