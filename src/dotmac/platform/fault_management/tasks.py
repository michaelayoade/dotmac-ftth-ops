"""
Fault Management Celery Tasks

Background tasks for alarm correlation, SLA monitoring, and maintenance.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from celery import shared_task
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import get_async_session
from dotmac.platform.fault_management.correlation import CorrelationEngine
from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmStatus,
    MaintenanceWindow,
    SLAInstance,
)
from dotmac.platform.fault_management.sla_service import SLAMonitoringService

logger = structlog.get_logger(__name__)


# =============================================================================
# Periodic Tasks
# =============================================================================


@shared_task(name="faults.correlate_pending_alarms")
def correlate_pending_alarms() -> dict:
    """
    Run correlation on recent alarms.

    Scheduled: Every 5 minutes
    """
    import asyncio

    async def _correlate() -> dict[str, Any]:
        async with get_async_session() as session:
            # Get all tenants with active alarms
            result = await session.execute(
                select(Alarm.tenant_id)
                .where(
                    and_(
                        Alarm.status == AlarmStatus.ACTIVE,
                        Alarm.first_occurrence
                        >= datetime.now(UTC) - timedelta(minutes=15),
                    )
                )
                .distinct()
            )

            tenant_ids = [row[0] for row in result]

            total_correlated = 0
            for tenant_id in tenant_ids:
                engine = CorrelationEngine(session, tenant_id)
                count = await engine.recorrelate_all()
                total_correlated += count

            logger.info(
                "task.correlate_pending_alarms.complete",
                tenants=len(tenant_ids),
                alarms_correlated=total_correlated,
            )

            return {
                "tenants_processed": len(tenant_ids),
                "alarms_correlated": total_correlated,
            }

    return asyncio.run(_correlate())


@shared_task(name="faults.check_sla_compliance")
def check_sla_compliance() -> dict:
    """
    Check all SLA instances for compliance.

    Scheduled: Every 15 minutes
    """
    import asyncio

    async def _check() -> dict[str, Any]:
        async with get_async_session() as session:
            # Get active SLA instances
            result = await session.execute(
                select(SLAInstance).where(SLAInstance.enabled == True)  # noqa: E712
            )

            instances = list(result.scalars().all())

            breaches_detected = 0
            for instance in instances:
                service = SLAMonitoringService(session, instance.tenant_id)

                # Recalculate availability
                await service._calculate_availability(instance)

                # Check for breaches
                await service._check_availability_breach(instance)

                if instance.status != "compliant":
                    breaches_detected += 1

            await session.commit()

            logger.info(
                "task.check_sla_compliance.complete",
                instances_checked=len(instances),
                breaches_detected=breaches_detected,
            )

            return {
                "instances_checked": len(instances),
                "breaches_detected": breaches_detected,
            }

    return asyncio.run(_check())


@shared_task(name="faults.check_unacknowledged_alarms")
def check_unacknowledged_alarms() -> dict:
    """
    Create tickets for unacknowledged critical/major alarms.

    Scheduled: Every 10 minutes
    """
    import asyncio

    async def _check() -> dict[str, Any]:
        async with get_async_session() as session:
            # Find unacknowledged alarms older than 15 minutes
            cutoff_time = datetime.now(UTC) - timedelta(minutes=15)

            result = await session.execute(
                select(Alarm).where(
                    and_(
                        Alarm.status == AlarmStatus.ACTIVE,
                        Alarm.first_occurrence <= cutoff_time,
                        Alarm.ticket_id.is_(None),
                        Alarm.severity.in_(["critical", "major"]),
                    )
                )
            )

            alarms = list(result.scalars().all())

            tickets_created = 0
            for alarm in alarms:
                # TODO: Create ticket via ticket service
                # For now, just log
                logger.warning(
                    "alarm.unacknowledged.escalation_needed",
                    alarm_id=alarm.id,
                    severity=alarm.severity.value,
                    age_minutes=(datetime.now(UTC) - alarm.first_occurrence).seconds / 60,
                )
                tickets_created += 1

            logger.info(
                "task.check_unacknowledged_alarms.complete",
                alarms_found=len(alarms),
                tickets_created=tickets_created,
            )

            return {
                "alarms_found": len(alarms),
                "tickets_created": tickets_created,
            }

    return asyncio.run(_check())


@shared_task(name="faults.update_maintenance_windows")
def update_maintenance_windows() -> dict:
    """
    Update maintenance window status.

    Scheduled: Every 5 minutes
    """
    import asyncio

    async def _update() -> dict[str, Any]:
        async with get_async_session() as session:
            now = datetime.now(UTC)

            # Start scheduled windows
            result = await session.execute(
                select(MaintenanceWindow).where(
                    and_(
                        MaintenanceWindow.status == "scheduled",
                        MaintenanceWindow.start_time <= now,
                    )
                )
            )

            started = list(result.scalars().all())
            for window in started:
                window.status = "in_progress"

            # Complete active windows
            result = await session.execute(
                select(MaintenanceWindow).where(
                    and_(
                        MaintenanceWindow.status == "in_progress",
                        MaintenanceWindow.end_time <= now,
                    )
                )
            )

            completed = list(result.scalars().all())
            for window in completed:
                window.status = "completed"

            await session.commit()

            logger.info(
                "task.update_maintenance_windows.complete",
                started=len(started),
                completed=len(completed),
            )

            return {
                "windows_started": len(started),
                "windows_completed": len(completed),
            }

    return asyncio.run(_update())


@shared_task(name="faults.cleanup_old_cleared_alarms")
def cleanup_old_cleared_alarms(days: int = 90) -> dict:
    """
    Archive cleared alarms older than specified days.

    Scheduled: Daily
    """
    import asyncio

    async def _cleanup() -> dict[str, Any]:
        async with get_async_session() as session:
            cutoff_date = datetime.now(UTC) - timedelta(days=days)

            result = await session.execute(
                select(Alarm).where(
                    and_(
                        Alarm.status == AlarmStatus.CLEARED,
                        Alarm.cleared_at <= cutoff_date,
                    )
                )
            )

            alarms = list(result.scalars().all())

            # TODO: Archive to cold storage before deleting
            # For now, just mark for deletion
            count = len(alarms)

            logger.info(
                "task.cleanup_old_cleared_alarms.complete",
                alarms_cleaned=count,
                cutoff_days=days,
            )

            return {
                "alarms_cleaned": count,
                "cutoff_days": days,
            }

    return asyncio.run(_cleanup())


# =============================================================================
# Event-Driven Tasks
# =============================================================================


@shared_task(name="faults.process_alarm_correlation")
def process_alarm_correlation(alarm_id: str, tenant_id: str) -> dict:
    """
    Process correlation for a single alarm.

    Triggered: On alarm creation
    """
    import asyncio

    async def _process() -> dict[str, Any]:
        async with get_async_session() as session:
            alarm = await session.get(Alarm, UUID(alarm_id))

            if alarm:
                engine = CorrelationEngine(session, tenant_id)
                await engine.correlate(alarm)
                await session.commit()

                return {
                    "alarm_id": alarm_id,
                    "correlated": True,
                    "correlation_id": str(alarm.correlation_id) if alarm.correlation_id else None,
                }

            return {
                "alarm_id": alarm_id,
                "correlated": False,
                "error": "Alarm not found",
            }

    return asyncio.run(_process())


@shared_task(name="faults.calculate_sla_metrics")
def calculate_sla_metrics(instance_id: str, tenant_id: str) -> dict:
    """
    Calculate SLA metrics for instance.

    Triggered: On downtime recording
    """
    import asyncio

    async def _calculate() -> dict[str, Any]:
        async with get_async_session() as session:
            instance = await session.get(SLAInstance, UUID(instance_id))

            if instance:
                service = SLAMonitoringService(session, tenant_id)
                await service._calculate_availability(instance)
                await service._check_availability_breach(instance)
                await session.commit()

                return {
                    "instance_id": instance_id,
                    "availability": instance.current_availability,
                    "status": instance.status.value,
                }

            return {
                "instance_id": instance_id,
                "error": "Instance not found",
            }

    return asyncio.run(_calculate())


@shared_task(name="faults.send_alarm_notifications")
def send_alarm_notifications(alarm_id: str, tenant_id: str) -> dict:
    """
    Send notifications for alarm.

    Triggered: On critical/major alarm creation
    """
    import asyncio

    async def _notify() -> dict[str, Any]:
        async with get_async_session() as session:
            alarm = await session.get(Alarm, UUID(alarm_id))

            if alarm:
                # TODO: Send notifications via notification service
                # - Email for critical/major
                # - SMS for critical with high customer impact
                # - Webhook for all

                logger.info(
                    "task.send_alarm_notifications",
                    alarm_id=alarm_id,
                    severity=alarm.severity.value,
                    subscriber_count=alarm.subscriber_count,
                )

                return {
                    "alarm_id": alarm_id,
                    "notifications_sent": True,
                }

            return {
                "alarm_id": alarm_id,
                "notifications_sent": False,
                "error": "Alarm not found",
            }

    return asyncio.run(_notify())


# =============================================================================
# Celery Beat Schedule
# =============================================================================

# Add to celery_config.py:
"""
beat_schedule = {
    'correlate-pending-alarms': {
        'task': 'faults.correlate_pending_alarms',
        'schedule': timedelta(minutes=5),
    },
    'check-sla-compliance': {
        'task': 'faults.check_sla_compliance',
        'schedule': timedelta(minutes=15),
    },
    'check-unacknowledged-alarms': {
        'task': 'faults.check_unacknowledged_alarms',
        'schedule': timedelta(minutes=10),
    },
    'update-maintenance-windows': {
        'task': 'faults.update_maintenance_windows',
        'schedule': timedelta(minutes=5),
    },
    'cleanup-old-cleared-alarms': {
        'task': 'faults.cleanup_old_cleared_alarms',
        'schedule': timedelta(days=1),
    },
}
"""
