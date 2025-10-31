"""
Usage-Based Billing Integration for Internet Service Plans.

Periodic Celery task that processes overage charges for subscribers who exceed
their data caps. Integrates TimescaleDB usage data with the billing system.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.celery_app import celery_app
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.subscribers.models import Subscriber
from dotmac.platform.database import async_session_maker
from dotmac.platform.services.internet_plans.models import (
    InternetServicePlan,
    PlanSubscription,
)
from dotmac.platform.settings import settings

# Optional TimescaleDB imports
try:
    from dotmac.platform.timeseries import TimeSeriesSessionLocal
    from dotmac.platform.timeseries.repository import RadiusTimeSeriesRepository

    TIMESCALEDB_AVAILABLE = True
except ImportError:
    TIMESCALEDB_AVAILABLE = False

logger = structlog.get_logger(__name__)


async def get_billing_period_for_subscription(
    subscription: PlanSubscription,
) -> tuple[datetime, datetime]:
    """
    Calculate billing period dates for a subscription.

    Args:
        subscription: Plan subscription

    Returns:
        Tuple of (period_start, period_end)
    """
    now = datetime.utcnow()

    # Use last_usage_reset if available, otherwise start_date
    if subscription.last_usage_reset:
        period_start = subscription.last_usage_reset
    else:
        period_start = subscription.start_date

    # Calculate period end based on billing cycle (default 30 days)
    # TODO: In future, use plan's billing_cycle to determine period length
    period_end = period_start + timedelta(days=30)

    # Roll forward to current period if needed
    while period_end < now:
        period_start = period_end
        period_end = period_start + timedelta(days=30)

    return period_start, period_end


async def query_usage_from_timescaledb(
    tenant_id: str,
    subscriber_id: str,
    period_start: datetime,
    period_end: datetime,
) -> Decimal:
    """
    Query bandwidth usage from TimescaleDB for a subscriber.

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
            "usage_billing.timescaledb_unavailable",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
        )
        return Decimal("0.00")

    try:
        async with TimeSeriesSessionLocal() as ts_session:
            repo = RadiusTimeSeriesRepository()

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
                "usage_billing.usage_queried",
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                total_gb=float(total_gb),
            )

            return total_gb

    except Exception as e:
        logger.error(
            "usage_billing.query_failed",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            error=str(e),
        )
        return Decimal("0.00")


async def create_overage_invoice(
    session: AsyncSession,
    subscription: PlanSubscription,
    customer: Customer,
    overage_gb: Decimal,
    overage_charge: Decimal,
    period_start: datetime,
    period_end: datetime,
) -> UUID | None:
    """
    Create an invoice for data overage charges.

    Args:
        session: Database session
        subscription: Plan subscription
        customer: Customer record
        overage_gb: Amount of overage in GB
        overage_charge: Calculated charge amount
        period_start: Billing period start
        period_end: Billing period end

    Returns:
        Invoice ID if created, None otherwise
    """
    try:
        # Import invoice service
        from dotmac.platform.billing.invoicing.service import InvoiceService
        from dotmac.platform.billing.integration import BillingIntegrationService

        # Get billing details
        integration_service = BillingIntegrationService(session)
        billing_email, billing_address = (
            await integration_service._resolve_customer_billing_details(
                customer_id=str(customer.id), tenant_id=subscription.tenant_id
            )
        )

        # Prepare line items for overage charge
        plan = subscription.plan
        currency = plan.currency if plan else "USD"

        # Convert to minor units (cents)
        def to_minor_units(amount: Decimal) -> int:
            return int(amount * 100)

        line_items = [
            {
                "description": f"Data Overage Charges - {overage_gb:.2f} GB excess usage",
                "quantity": 1,
                "unit_price": to_minor_units(overage_charge),
                "total_price": to_minor_units(overage_charge),
                "product_id": str(subscription.plan_id),
                "subscription_id": str(subscription.subscription_id)
                if subscription.subscription_id
                else None,
                "tax_rate": 0.0,
                "tax_amount": 0,
                "discount_percentage": 0.0,
                "discount_amount": 0,
                "extra_data": {
                    "type": "data_overage",
                    "plan_subscription_id": str(subscription.id),
                    "overage_gb": float(overage_gb),
                    "billing_period_start": period_start.isoformat(),
                    "billing_period_end": period_end.isoformat(),
                    "plan_name": plan.name if plan else "Unknown",
                },
            }
        ]

        # Create invoice using InvoiceService
        invoice_service = InvoiceService(session)

        invoice = await invoice_service.create_invoice(
            tenant_id=subscription.tenant_id,
            customer_id=customer.id,
            billing_email=billing_email,
            billing_address=billing_address,
            line_items=line_items,
            currency=currency,
            due_days=30,
            notes=f"Data overage charges for billing period {period_start.date()} to {period_end.date()}",
            internal_notes=f"Auto-generated overage invoice for plan subscription {subscription.id}",
            subscription_id=str(subscription.subscription_id)
            if subscription.subscription_id
            else None,
            created_by="system",
        )

        logger.info(
            "usage_billing.invoice_created",
            tenant_id=subscription.tenant_id,
            customer_id=str(customer.id),
            invoice_id=str(invoice.id),
            overage_gb=float(overage_gb),
            charge=float(overage_charge),
        )

        return invoice.id

    except Exception as e:
        logger.error(
            "usage_billing.invoice_creation_failed",
            tenant_id=subscription.tenant_id,
            customer_id=str(customer.id),
            error=str(e),
        )
        return None


async def process_subscription_overage(
    session: AsyncSession,
    subscription: PlanSubscription,
) -> dict[str, Any]:
    """
    Process overage charges for a single subscription.

    Args:
        session: Database session
        subscription: Plan subscription to process

    Returns:
        Dictionary with processing results
    """
    plan = subscription.plan

    # Skip if plan doesn't have overage charges enabled
    if not plan.has_data_cap or not plan.overage_price_per_unit:
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "no_overage_charges",
        }

    # Get data cap in GB
    cap_gb = plan.get_data_cap_gb()
    if not cap_gb or cap_gb <= 0:
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "unlimited_cap",
        }

    # Get overage price per unit
    overage_price = plan.overage_price_per_unit
    if not overage_price or overage_price <= 0:
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "no_overage_price",
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
            "usage_billing.customer_not_found",
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
            "usage_billing.missing_subscriber_link",
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
            "usage_billing.subscriber_not_found",
            subscription_id=str(subscription.id),
            customer_id=str(customer.id),
        )
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "subscriber_not_found",
        }

    # Get billing period
    period_start, period_end = await get_billing_period_for_subscription(subscription)

    # Check if we're at the end of billing period (last 2 days)
    now = datetime.utcnow()
    days_until_end = (period_end - now).days

    if days_until_end > 2:
        # Not yet time to bill for this period
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "billing_period_not_ended",
            "days_until_end": days_until_end,
        }

    # Query usage from TimescaleDB using actual RADIUS subscriber_id
    usage_gb = await query_usage_from_timescaledb(
        tenant_id=subscription.tenant_id,
        subscriber_id=subscriber.id,  # Use actual subscriber ID from RADIUS
        period_start=period_start,
        period_end=period_end,
    )

    # Calculate overage
    overage_gb = usage_gb - cap_gb

    if overage_gb <= 0:
        # No overage, nothing to bill
        logger.info(
            "usage_billing.no_overage",
            tenant_id=subscription.tenant_id,
            customer_id=str(customer.id),
            usage_gb=float(usage_gb),
            cap_gb=float(cap_gb),
        )
        return {
            "subscription_id": str(subscription.id),
            "skipped": True,
            "reason": "no_overage",
            "usage_gb": float(usage_gb),
            "cap_gb": float(cap_gb),
        }

    # Calculate overage charge based on overage unit
    if plan.overage_unit:
        # Convert overage_gb to plan's overage_unit
        # For simplicity, assuming overage_unit is GB
        # TODO: Handle MB, TB conversions if needed
        overage_quantity = overage_gb
    else:
        overage_quantity = overage_gb

    overage_charge = overage_quantity * overage_price

    logger.info(
        "usage_billing.overage_detected",
        tenant_id=subscription.tenant_id,
        customer_id=str(customer.id),
        usage_gb=float(usage_gb),
        cap_gb=float(cap_gb),
        overage_gb=float(overage_gb),
        charge=float(overage_charge),
    )

    # Create overage invoice
    invoice_id = await create_overage_invoice(
        session=session,
        subscription=subscription,
        customer=customer,
        overage_gb=overage_gb,
        overage_charge=overage_charge,
        period_start=period_start,
        period_end=period_end,
    )

    if invoice_id:
        # Update subscription's usage reset date
        subscription.last_usage_reset = period_end
        await session.commit()

    return {
        "subscription_id": str(subscription.id),
        "customer_id": str(customer.id),
        "usage_gb": float(usage_gb),
        "cap_gb": float(cap_gb),
        "overage_gb": float(overage_gb),
        "charge": float(overage_charge),
        "invoice_id": str(invoice_id) if invoice_id else None,
        "invoice_created": invoice_id is not None,
    }


@celery_app.task(name="services.process_usage_billing", bind=True, max_retries=3)
def process_usage_billing(self, batch_size: int = 100) -> dict:
    """
    Process usage-based billing for ISP plan subscriptions.

    This task:
    1. Queries active subscriptions with data caps and overage charges
    2. Checks if they're at the end of their billing period
    3. Queries TimescaleDB for actual usage during the billing period
    4. Calculates overage charges if usage exceeds the cap
    5. Creates invoices for overage charges
    6. Updates usage reset dates

    Args:
        batch_size: Number of subscriptions to process per batch

    Returns:
        Dictionary with processing statistics
    """
    import asyncio

    logger.info("usage_billing.task_started", batch_size=batch_size)

    async def run_billing():
        results = {
            "total_processed": 0,
            "invoices_created": 0,
            "skipped": 0,
            "errors": 0,
        }

        async with async_session_maker() as session:
            # Query active subscriptions with data caps and overage pricing
            stmt = (
                select(PlanSubscription)
                .join(InternetServicePlan)
                .where(
                    and_(
                        PlanSubscription.is_active == True,
                        PlanSubscription.is_suspended == False,
                        InternetServicePlan.has_data_cap == True,
                        InternetServicePlan.overage_price_per_unit > 0,
                    )
                )
                .limit(batch_size)
            )

            result = await session.execute(stmt)
            subscriptions = result.scalars().all()

            logger.info(
                "usage_billing.subscriptions_found",
                count=len(subscriptions),
            )

            for subscription in subscriptions:
                try:
                    process_result = await process_subscription_overage(
                        session, subscription
                    )

                    results["total_processed"] += 1

                    if process_result.get("skipped"):
                        results["skipped"] += 1
                    elif process_result.get("invoice_created"):
                        results["invoices_created"] += 1

                except Exception as e:
                    results["errors"] += 1
                    logger.error(
                        "usage_billing.subscription_processing_failed",
                        subscription_id=str(subscription.id),
                        error=str(e),
                    )

        return results

    try:
        results = asyncio.run(run_billing())

        logger.info(
            "usage_billing.task_completed",
            total_processed=results["total_processed"],
            invoices_created=results["invoices_created"],
            skipped=results["skipped"],
            errors=results["errors"],
        )

        return results

    except Exception as e:
        logger.error("usage_billing.task_failed", error=str(e))
        raise self.retry(exc=e, countdown=300)  # Retry after 5 minutes
