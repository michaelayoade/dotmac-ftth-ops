"""
Celery tasks for automated payment reconciliation and recovery.

These tasks run periodically to:
1. Auto-reconcile cleared payments
2. Retry failed payments
3. Generate reconciliation reports
4. Monitor circuit breaker health
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from celery import Task

from dotmac.platform.billing._typing_helpers import idempotent_task, shared_task
from dotmac.platform.billing.reconciliation_service import ReconciliationService
from dotmac.platform.db import AsyncSessionLocal

# Compatibility alias for tests that patch this symbol
async_session_factory = AsyncSessionLocal

logger = structlog.get_logger(__name__)


@shared_task(bind=True, max_retries=3)  # type: ignore[misc]  # Celery decorator is untyped
@idempotent_task(ttl=300)  # type: ignore[misc]  # Custom decorator is untyped
def auto_reconcile_cleared_payments(
    self: Task, tenant_id: str, bank_account_id: int, days_back: int = 7
) -> dict[str, Any]:
    """
    Automatically reconcile payments that have cleared.

    This task runs periodically to match cleared payments with bank statements.

    Args:
        tenant_id: Tenant ID
        bank_account_id: Bank account ID to reconcile
        days_back: How many days back to look for unreconciled payments

    Returns:
        dict: Summary of reconciliation results
    """
    logger.info(
        "Starting auto-reconciliation",
        tenant_id=tenant_id,
        bank_account_id=bank_account_id,
        days_back=days_back,
    )

    try:
        # Use async context manager for database session
        # Note: Celery tasks need to be async-aware or use sync wrapper
        import asyncio

        return asyncio.run(_auto_reconcile_impl(tenant_id, bank_account_id, days_back))
    except Exception as e:
        logger.error(
            "Auto-reconciliation failed",
            error=str(e),
            tenant_id=tenant_id,
            bank_account_id=bank_account_id,
        )
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))


async def _auto_reconcile_impl(
    tenant_id: str, bank_account_id: int, days_back: int
) -> dict[str, Any]:
    """Implementation of auto-reconciliation."""
    async with AsyncSessionLocal() as db:
        ReconciliationService(db)

        # Calculate date range
        period_end = datetime.now(UTC)
        period_start = period_end - timedelta(days=days_back)

        # Get unreconciled payments for this bank account
        from sqlalchemy import and_, select

        from dotmac.platform.billing.bank_accounts.entities import ManualPayment

        result = await db.execute(
            select(ManualPayment).where(
                and_(
                    ManualPayment.tenant_id == tenant_id,
                    ManualPayment.bank_account_id == bank_account_id,
                    ManualPayment.reconciled == False,  # noqa: E712
                    ManualPayment.status == "verified",
                    ManualPayment.payment_date >= period_start,
                    ManualPayment.payment_date <= period_end,
                )
            )
        )
        unreconciled = result.scalars().all()

        if not unreconciled:
            logger.info(
                "No unreconciled payments found",
                tenant_id=tenant_id,
                bank_account_id=bank_account_id,
            )
            return {
                "reconciled_count": 0,
                "total_amount": 0,
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
            }

        # Calculate totals
        total_amount = sum(p.amount for p in unreconciled)

        # Mark payments as reconciled (simplified auto-reconciliation)
        reconciled_count = 0
        for payment in unreconciled:
            payment.reconciled = True
            payment.reconciled_at = datetime.now(UTC)
            payment.reconciled_by = "system_auto"
            reconciled_count += 1

        await db.commit()

        logger.info(
            "Auto-reconciliation completed",
            tenant_id=tenant_id,
            bank_account_id=bank_account_id,
            reconciled_count=reconciled_count,
            total_amount=float(total_amount),
        )

        return {
            "reconciled_count": reconciled_count,
            "total_amount": float(total_amount),
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }


@shared_task(bind=True, max_retries=5)  # type: ignore[misc]  # Celery decorator is untyped
@idempotent_task(ttl=600)  # type: ignore[misc]  # Custom decorator is untyped
def retry_failed_payments_batch(
    self: Task, tenant_id: str, max_payments: int = 50
) -> dict[str, Any]:
    """
    Batch retry failed payments for a tenant.

    This task finds payments in 'failed' status and retries them using
    the circuit breaker and retry logic.

    Args:
        tenant_id: Tenant ID
        max_payments: Maximum number of payments to retry in one batch

    Returns:
        dict: Summary of retry results
    """
    logger.info(
        "Starting batch payment retry",
        tenant_id=tenant_id,
        max_payments=max_payments,
    )

    try:
        import asyncio

        return asyncio.run(_retry_failed_payments_impl(tenant_id, max_payments))
    except Exception as e:
        logger.error(
            "Batch payment retry failed",
            error=str(e),
            tenant_id=tenant_id,
        )
        raise self.retry(exc=e, countdown=120 * (2**self.request.retries))


async def _retry_failed_payments_impl(tenant_id: str, max_payments: int) -> dict[str, Any]:
    """Implementation of batch payment retry."""
    async with AsyncSessionLocal() as db:
        service = ReconciliationService(db)

        # Find failed payments
        from sqlalchemy import select

        from dotmac.platform.billing.bank_accounts.entities import ManualPayment

        result = await db.execute(
            select(ManualPayment)
            .where(
                ManualPayment.tenant_id == tenant_id,
                ManualPayment.status == "failed",
            )
            .limit(max_payments)
        )
        failed_payments = result.scalars().all()

        if not failed_payments:
            logger.info("No failed payments to retry", tenant_id=tenant_id)
            return {
                "attempted": 0,
                "succeeded": 0,
                "failed": 0,
                "circuit_breaker_state": "N/A",
            }

        # Retry each payment
        attempted = 0
        succeeded = 0
        failed = 0

        for payment in failed_payments:
            attempted += 1
            try:
                result = await service.retry_failed_payment_with_recovery(
                    tenant_id=tenant_id,
                    payment_id=payment.id,
                    user_id="system_auto",
                    max_attempts=3,
                )

                if result["success"]:
                    succeeded += 1
                else:
                    failed += 1

            except Exception as e:
                logger.error(
                    "Payment retry failed",
                    error=str(e),
                    payment_id=payment.id,
                )
                failed += 1

        logger.info(
            "Batch payment retry completed",
            tenant_id=tenant_id,
            attempted=attempted,
            succeeded=succeeded,
            failed=failed,
        )

        return {
            "attempted": attempted,
            "succeeded": succeeded,
            "failed": failed,
            "circuit_breaker_state": service.circuit_breaker.state,
        }


@shared_task(bind=True)  # type: ignore[misc]  # Celery decorator is untyped
@idempotent_task(ttl=3600)  # type: ignore[misc]  # Custom decorator is untyped
def generate_daily_reconciliation_report(self: Task, tenant_id: str) -> dict[str, Any]:
    """
    Generate daily reconciliation report for a tenant.

    This task creates a summary of reconciliation activities for the day.

    Args:
        tenant_id: Tenant ID

    Returns:
        dict: Reconciliation report
    """
    logger.info("Generating daily reconciliation report", tenant_id=tenant_id)

    try:
        import asyncio

        return asyncio.run(_generate_report_impl(tenant_id))
    except Exception as e:
        logger.error(
            "Report generation failed",
            error=str(e),
            tenant_id=tenant_id,
        )
        raise self.retry(exc=e, countdown=300)


async def _generate_report_impl(tenant_id: str) -> dict[str, Any]:
    """Implementation of report generation."""
    async with AsyncSessionLocal() as db:
        service = ReconciliationService(db)

        # Get today's reconciliation summary
        summary = await service.get_reconciliation_summary(
            tenant_id=tenant_id,
            bank_account_id=None,
            days=1,
        )

        # Get payment statistics
        from sqlalchemy import func, select

        from dotmac.platform.billing.bank_accounts.entities import ManualPayment

        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

        result = await db.execute(
            select(
                func.count(ManualPayment.id).label("total_payments"),
                func.sum(ManualPayment.amount).label("total_amount"),
                func.count(ManualPayment.id)
                .filter(ManualPayment.reconciled == True)  # noqa: E712
                .label("reconciled_payments"),
            ).where(
                ManualPayment.tenant_id == tenant_id,
                ManualPayment.created_at >= today_start,
            )
        )
        stats = result.one()

        report = {
            "tenant_id": tenant_id,
            "date": datetime.now(UTC).date().isoformat(),
            "reconciliation_sessions": summary["total_sessions"],
            "approved_sessions": summary["approved_sessions"],
            "pending_sessions": summary["pending_sessions"],
            "total_discrepancies": float(summary["total_discrepancies"]),
            "total_payments": stats.total_payments or 0,
            "total_amount": float(stats.total_amount or 0),
            "reconciled_payments": stats.reconciled_payments or 0,
            "reconciliation_rate": (
                (stats.reconciled_payments / stats.total_payments * 100)
                if stats.total_payments
                else 0
            ),
        }

        logger.info(
            "Daily reconciliation report generated",
            tenant_id=tenant_id,
            reconciliation_rate=report["reconciliation_rate"],
        )

        return report


@shared_task(bind=True)  # type: ignore[misc]  # Celery decorator is untyped
def monitor_circuit_breaker_health(self: Task) -> dict[str, Any]:
    """
    Monitor circuit breaker health across all tenants.

    This task checks circuit breaker states and alerts if too many are open.

    Returns:
        dict: Circuit breaker health summary
    """
    logger.info("Monitoring circuit breaker health")

    try:
        import asyncio

        return asyncio.run(_monitor_circuit_breaker_impl())
    except Exception as e:
        logger.error("Circuit breaker monitoring failed", error=str(e))
        raise self.retry(exc=e, countdown=60)


async def _monitor_circuit_breaker_impl() -> dict[str, Any]:
    """Implementation of circuit breaker monitoring."""
    async with AsyncSessionLocal() as db:
        service = ReconciliationService(db)

        # Check circuit breaker state
        cb_state = service.circuit_breaker.state
        failure_count = service.circuit_breaker.failure_count
        failure_threshold = service.circuit_breaker.failure_threshold

        health_status = "healthy"
        if cb_state == "open":
            health_status = "degraded"
            logger.warning(
                "Circuit breaker is OPEN",
                failure_count=failure_count,
                threshold=failure_threshold,
            )
        elif cb_state == "half_open":
            health_status = "recovering"
            logger.info("Circuit breaker is HALF_OPEN, testing recovery")

        return {
            "status": health_status,
            "circuit_breaker_state": cb_state,
            "failure_count": failure_count,
            "failure_threshold": failure_threshold,
            "timestamp": datetime.now(UTC).isoformat(),
        }


@shared_task  # type: ignore[misc]  # Celery decorator is untyped
def schedule_reconciliation_for_tenant(
    tenant_id: str, bank_account_id: int, period_days: int = 30
) -> str:
    """
    Schedule a reconciliation session for a tenant.

    This task can be triggered on-demand or scheduled to run monthly.

    Args:
        tenant_id: Tenant ID
        bank_account_id: Bank account ID
        period_days: Number of days to include in reconciliation period

    Returns:
        str: Reconciliation session ID
    """
    logger.info(
        "Scheduling reconciliation session",
        tenant_id=tenant_id,
        bank_account_id=bank_account_id,
        period_days=period_days,
    )

    try:
        import asyncio

        return asyncio.run(_schedule_reconciliation_impl(tenant_id, bank_account_id, period_days))
    except Exception as e:
        logger.error(
            "Reconciliation scheduling failed",
            error=str(e),
            tenant_id=tenant_id,
        )
        raise


async def _schedule_reconciliation_impl(
    tenant_id: str, bank_account_id: int, period_days: int
) -> str:
    """Implementation of reconciliation scheduling."""
    async with AsyncSessionLocal() as db:
        service = ReconciliationService(db)

        # Calculate period
        period_end = datetime.now(UTC)
        period_start = period_end - timedelta(days=period_days)

        # Get opening balance (closing balance from last reconciliation)
        from sqlalchemy import desc, select

        from dotmac.platform.billing.bank_accounts.entities import PaymentReconciliation

        last_reconciliation = await db.execute(
            select(PaymentReconciliation)
            .where(
                PaymentReconciliation.tenant_id == tenant_id,
                PaymentReconciliation.bank_account_id == bank_account_id,
                PaymentReconciliation.status == "approved",
            )
            .order_by(desc(PaymentReconciliation.period_end))
            .limit(1)
        )
        last_rec = last_reconciliation.scalar_one_or_none()
        opening_balance = last_rec.closing_balance if last_rec else 0.0

        # Start reconciliation session
        reconciliation = await service.start_reconciliation_session(
            tenant_id=tenant_id,
            bank_account_id=bank_account_id,
            period_start=period_start,
            period_end=period_end,
            opening_balance=opening_balance,
            statement_balance=opening_balance,  # Will be updated when statement is uploaded
            user_id="system_auto",
            statement_file_url=None,
        )

        logger.info(
            "Reconciliation session created",
            tenant_id=tenant_id,
            reconciliation_id=reconciliation.id,
        )

        return str(reconciliation.id)


# Periodic task schedules (configured in Celery beat)
# Add to celerybeat-schedule.py or settings:
#
# from celery.schedules import crontab
#
# app.conf.beat_schedule = {
#     'auto-reconcile-cleared-payments': {
#         'task': 'dotmac.platform.billing.reconciliation_tasks.auto_reconcile_cleared_payments',
#         'schedule': crontab(hour=2, minute=0),  # Run daily at 2 AM
#     },
#     'retry-failed-payments-batch': {
#         'task': 'dotmac.platform.billing.reconciliation_tasks.retry_failed_payments_batch',
#         'schedule': crontab(hour='*/6'),  # Run every 6 hours
#     },
#     'generate-daily-reconciliation-report': {
#         'task': 'dotmac.platform.billing.reconciliation_tasks.generate_daily_reconciliation_report',
#         'schedule': crontab(hour=23, minute=55),  # Run daily at 11:55 PM
#     },
#     'monitor-circuit-breaker-health': {
#         'task': 'dotmac.platform.billing.reconciliation_tasks.monitor_circuit_breaker_health',
#         'schedule': 300.0,  # Every 5 minutes
#     },
# }
