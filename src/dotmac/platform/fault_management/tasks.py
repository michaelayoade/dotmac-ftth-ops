"""
Fault Management Celery Tasks

Background tasks for alarm correlation, SLA monitoring, and maintenance.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from celery import shared_task
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from dotmac.platform.db import get_async_session
from dotmac.platform import db as db_module
from dotmac.platform.fault_management.correlation import CorrelationEngine
from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmSeverity,
    AlarmStatus,
    MaintenanceWindow,
    SLAInstance,
)
from dotmac.platform.fault_management.archival import AlarmArchivalService
from dotmac.platform.fault_management.sla_service import SLAMonitoringService
from dotmac.platform.notifications.models import (
    NotificationChannel,
    NotificationPriority,
    NotificationType,
)
from dotmac.platform.notifications.service import NotificationService
from dotmac.platform.user_management.models import User

logger = structlog.get_logger(__name__)


# =============================================================================
# Async/Sync Bridge for Celery Tasks
# =============================================================================


def _run_async_task(coro):
    """
    Run an async coroutine in a Celery task context.

    Handles both scenarios:
    - Celery production: No event loop, create one with asyncio.run()
    - Test context: Existing event loop, run in separate thread

    Args:
        coro: Async coroutine to execute

    Returns:
        Result from the coroutine
    """
    import asyncio
    import concurrent.futures

    try:
        # Check if there's already a running event loop (test context)
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No event loop running (Celery production context)
        loop = None

    if loop is None:
        # Celery context - create new event loop
        return asyncio.run(coro)
    else:
        # Test context - run in new thread to avoid nested event loop
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result()


# =============================================================================
# Helper Functions for Alarm Notifications
# =============================================================================


def _determine_alarm_channels(alarm: Alarm) -> list[NotificationChannel]:
    """
    Determine which notification channels to use based on alarm severity and impact.

    Channel routing logic:
    - Critical + high impact (>10 subscribers): Email + SMS + Push + Webhook
    - Critical: Email + Push + Webhook
    - Major: Email + Webhook
    - Minor/Warning: Webhook only

    Args:
        alarm: The alarm to determine channels for

    Returns:
        List of notification channels to use
    """
    channels = []

    # All alarms get webhook notifications (if configured)
    channels.append(NotificationChannel.WEBHOOK)

    if alarm.severity == AlarmSeverity.CRITICAL:
        # Critical alarms get email and push
        channels.append(NotificationChannel.EMAIL)
        channels.append(NotificationChannel.PUSH)

        # High-impact critical alarms also get SMS
        if alarm.subscriber_count and alarm.subscriber_count > 10:
            channels.append(NotificationChannel.SMS)

    elif alarm.severity == AlarmSeverity.MAJOR:
        # Major alarms get email
        channels.append(NotificationChannel.EMAIL)

    # Minor and Warning alarms only get webhook (added above)

    return channels


async def _get_users_to_notify(session: AsyncSession, tenant_id: str, alarm: Alarm) -> list[User]:
    """
    Get list of users who should be notified about this alarm.

    Notification recipients:
    - Users with 'faults.alarms.write' permission (NOC operators)
    - Users with 'admin' role
    - TODO: Add on-call schedule support

    Args:
        session: Database session
        tenant_id: Tenant ID
        alarm: The alarm to notify about

    Returns:
        List of users to notify
    """
    # Get users with alarm write permissions (NOC operators)
    # This includes users with explicit permission or admin role
    result = await session.execute(
        select(User).where(
            and_(
                User.tenant_id == tenant_id,
                User.is_active == True,  # noqa: E712
                or_(
                    User.is_superuser == True,  # noqa: E712
                    # TODO: Add RBAC permission check when user-permission junction is available
                    # For now, notify superusers (admins)
                ),
            )
        )
    )

    users = list(result.scalars().all())

    logger.info(
        "alarm.notification.recipients_determined",
        alarm_id=alarm.alarm_id,
        severity=alarm.severity.value,
        user_count=len(users),
    )

    return users


def _format_alarm_message(alarm: Alarm) -> str:
    """
    Format alarm details into notification message.

    Args:
        alarm: The alarm to format

    Returns:
        Formatted message string
    """
    # Build basic alarm info
    message_parts = [
        f"Type: {alarm.alarm_type}",
        f"Title: {alarm.title}",
    ]

    # Add resource info if present
    if alarm.resource_name:
        message_parts.append(f"Resource: {alarm.resource_name}")
    elif alarm.resource_id:
        message_parts.append(f"Resource ID: {alarm.resource_id}")

    # Add subscriber impact if present
    if alarm.subscriber_count and alarm.subscriber_count > 0:
        message_parts.append(f"Impact: {alarm.subscriber_count} subscribers affected")

    # Add probable cause if present
    if alarm.probable_cause:
        message_parts.append(f"Cause: {alarm.probable_cause}")

    # Add description if present and not too long
    if alarm.description and len(alarm.description) < 200:
        message_parts.append(f"Details: {alarm.description}")

    # Add occurrence info
    occurrence_time = alarm.first_occurrence.strftime("%Y-%m-%d %H:%M:%S UTC")
    message_parts.append(f"First occurred: {occurrence_time}")

    if alarm.occurrence_count > 1:
        message_parts.append(f"Occurrences: {alarm.occurrence_count}")

    return " | ".join(message_parts)


def _map_alarm_severity_to_priority(severity: AlarmSeverity) -> NotificationPriority:
    """
    Map alarm severity to notification priority.

    Args:
        severity: Alarm severity

    Returns:
        Notification priority
    """
    severity_to_priority = {
        AlarmSeverity.CRITICAL: NotificationPriority.URGENT,
        AlarmSeverity.MAJOR: NotificationPriority.HIGH,
        AlarmSeverity.MINOR: NotificationPriority.MEDIUM,
        AlarmSeverity.WARNING: NotificationPriority.LOW,
    }

    return severity_to_priority.get(severity, NotificationPriority.MEDIUM)


# =============================================================================
# Periodic Tasks
# =============================================================================


@shared_task(name="faults.correlate_pending_alarms")  # type: ignore[misc]  # Celery decorator is untyped
def correlate_pending_alarms() -> dict[str, Any]:
    """
    Run correlation on recent alarms.

    Scheduled: Every 5 minutes
    """
    import asyncio

    async def _correlate() -> dict[str, Any]:
        async with db_module.AsyncSessionLocal() as session:
            # Get all tenants with active alarms
            result = await session.execute(
                select(Alarm.tenant_id)
                .where(
                    and_(
                        Alarm.status == AlarmStatus.ACTIVE,
                        Alarm.first_occurrence >= datetime.now(UTC) - timedelta(minutes=15),
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

    return _run_async_task(_correlate())


@shared_task(name="faults.check_sla_compliance")  # type: ignore[misc]  # Celery decorator is untyped
def check_sla_compliance() -> dict[str, Any]:
    """
    Check all SLA instances for compliance.

    Scheduled: Every 15 minutes
    """
    import asyncio

    async def _check() -> dict[str, Any]:
        async with db_module.AsyncSessionLocal() as session:
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

    return _run_async_task(_check())


@shared_task(name="faults.check_unacknowledged_alarms")  # type: ignore[misc]  # Celery decorator is untyped
def check_unacknowledged_alarms() -> dict[str, Any]:
    """
    Monitor unacknowledged critical/major alarms.

    NOTE: Automatic ticket creation has been disabled. Operators must manually
    create tickets from alarms using the POST /api/v1/faults/alarms/{alarm_id}/create-ticket endpoint.

    This task now only logs warnings for unacknowledged alarms requiring attention.

    Scheduled: Every 10 minutes
    """
    import asyncio

    async def _check() -> dict[str, Any]:
        async with db_module.AsyncSessionLocal() as session:
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

            # Log warnings for unacknowledged alarms
            # Operators should manually create tickets using the API
            for alarm in alarms:
                logger.warning(
                    "alarm.unacknowledged.manual_action_required",
                    alarm_id=alarm.id,
                    external_alarm_id=alarm.alarm_id,
                    severity=alarm.severity.value,
                    age_minutes=(datetime.now(UTC) - alarm.first_occurrence).seconds / 60,
                    message=f"Alarm {alarm.alarm_id} requires manual ticket creation",
                )

            logger.info(
                "task.check_unacknowledged_alarms.complete",
                alarms_requiring_attention=len(alarms),
                action_required="Manual ticket creation via API",
            )

            return {
                "alarms_found": len(alarms),
                "tickets_created": 0,  # Automatic creation disabled
                "manual_action_required": True,
            }

    return _run_async_task(_check())


@shared_task(name="faults.update_maintenance_windows")  # type: ignore[misc]  # Celery decorator is untyped
def update_maintenance_windows() -> dict[str, Any]:
    """
    Update maintenance window status.

    Scheduled: Every 5 minutes
    """
    import asyncio

    async def _update() -> dict[str, Any]:
        async with db_module.AsyncSessionLocal() as session:
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

    return _run_async_task(_update())


@shared_task(name="faults.cleanup_old_cleared_alarms")  # type: ignore[misc]  # Celery decorator is untyped
def cleanup_old_cleared_alarms(days: int | None = None) -> dict[str, Any]:
    """
    Archive cleared alarms older than specified days to MinIO cold storage,
    then delete from database.

    Scheduled: Daily (time configured in settings)

    Args:
        days: Number of days to keep cleared alarms before archival.
              If None, uses settings.fault_management.alarm_retention_days (default: 90)

    Returns:
        dict with archival statistics
    """
    import asyncio

    from ..settings import settings

    # Use configured retention days if not specified
    if days is None:
        days = settings.fault_management.alarm_retention_days

    async def _cleanup() -> dict[str, Any]:
        async with db_module.AsyncSessionLocal() as session:
            default_response = {
                "alarms_cleaned": 0,
                "alarms_archived": 0,
                "cutoff_days": days,
            }

            try:
                cutoff_date = datetime.now(UTC) - timedelta(days=days)

                # Fetch alarms to archive
                result = await session.execute(
                    select(Alarm).where(
                        and_(
                            Alarm.status == AlarmStatus.CLEARED,
                            Alarm.cleared_at <= cutoff_date,
                        )
                    )
                )

                alarms = list(result.scalars().all())

                if not alarms:
                    logger.info(
                        "task.cleanup_old_cleared_alarms.no_alarms",
                        cutoff_days=days,
                    )
                    return default_response

                # Group alarms by tenant for archival
                alarms_by_tenant: dict[str, list[Alarm]] = {}
                for alarm in alarms:
                    alarms_by_tenant.setdefault(alarm.tenant_id, []).append(alarm)

                # Archive alarms to MinIO cold storage
                archival_service = AlarmArchivalService()
                total_archived = 0
                archive_manifests = []

                for tenant_id, tenant_alarms in alarms_by_tenant.items():
                    try:
                        manifest = await archival_service.archive_alarms(
                            alarms=tenant_alarms,
                            tenant_id=tenant_id,
                            cutoff_date=cutoff_date,
                            session=session,
                        )
                        archive_manifests.append(manifest)
                        total_archived += manifest.alarm_count

                        logger.info(
                            "task.cleanup_old_cleared_alarms.archived",
                            tenant_id=tenant_id,
                            alarm_count=manifest.alarm_count,
                            archive_path=manifest.archive_path,
                            compression_ratio=manifest.compression_ratio,
                        )
                    except Exception as e:
                        logger.error(
                            "task.cleanup_old_cleared_alarms.archive_failed",
                            tenant_id=tenant_id,
                            alarm_count=len(tenant_alarms),
                            error=str(e),
                            exc_info=True,
                        )
                        continue

                # Delete archived alarms from database
                deleted_count = 0
                for alarm in alarms:
                    try:
                        await session.delete(alarm)
                        deleted_count += 1
                    except Exception as e:
                        logger.error(
                            "task.cleanup_old_cleared_alarms.delete_failed",
                            alarm_id=alarm.alarm_id,
                            error=str(e),
                        )

                await session.commit()

                logger.info(
                    "task.cleanup_old_cleared_alarms.complete",
                    alarms_archived=total_archived,
                    alarms_deleted=deleted_count,
                    cutoff_days=days,
                    tenant_count=len(alarms_by_tenant),
                )

                return {
                    "alarms_cleaned": deleted_count,
                    "alarms_archived": total_archived,
                    "cutoff_days": days,
                    "tenant_count": len(alarms_by_tenant),
                    "archive_manifests": [
                        {
                            "tenant_id": m.tenant_id,
                            "alarm_count": m.alarm_count,
                            "archive_path": m.archive_path,
                            "compression_ratio": m.compression_ratio,
                        }
                        for m in archive_manifests
                    ],
                }
            except SQLAlchemyError as exc:
                await session.rollback()
                logger.warning(
                    "task.cleanup_old_cleared_alarms.database_missing",
                    error=str(exc),
                )
                return default_response

    return _run_async_task(_cleanup())


# =============================================================================
# Event-Driven Tasks
# =============================================================================


@shared_task(name="faults.process_alarm_correlation")  # type: ignore[misc]  # Celery decorator is untyped
def process_alarm_correlation(alarm_id: str, tenant_id: str) -> dict[str, Any]:
    """
    Process correlation for a single alarm.

    Triggered: On alarm creation
    """
    import asyncio

    async def _process() -> dict[str, Any]:
        async with db_module.AsyncSessionLocal() as session:
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

    return _run_async_task(_process())


@shared_task(name="faults.calculate_sla_metrics")  # type: ignore[misc]  # Celery decorator is untyped
def calculate_sla_metrics(instance_id: str, tenant_id: str) -> dict[str, Any]:
    """
    Calculate SLA metrics for instance.

    Triggered: On downtime recording
    """
    import asyncio

    async def _calculate() -> dict[str, Any]:
        async with db_module.AsyncSessionLocal() as session:
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

    return _run_async_task(_calculate())


@shared_task(name="faults.send_alarm_notifications")  # type: ignore[misc]  # Celery decorator is untyped
def send_alarm_notifications(alarm_id: str, tenant_id: str) -> dict[str, Any]:
    """
    Send notifications for alarm via configured channels.

    Channel routing based on severity:
    - Critical + high impact (>10 subscribers): Email + SMS + Push + Webhook
    - Critical: Email + Push + Webhook
    - Major: Email + Webhook
    - Minor/Warning: Webhook only

    Triggered: On critical/major alarm creation
    """
    import asyncio

    async def _notify() -> dict[str, Any]:
        async with db_module.AsyncSessionLocal() as session:
            alarm = await session.get(Alarm, UUID(alarm_id))

            if not alarm:
                logger.error(
                    "task.send_alarm_notifications.alarm_not_found",
                    alarm_id=alarm_id,
                )
                return {
                    "alarm_id": alarm_id,
                    "notifications_sent": False,
                    "error": "Alarm not found",
                }

            # Determine which channels to use based on severity and impact
            channels = _determine_alarm_channels(alarm)

            # Get list of users to notify (NOC operators, admins)
            users_to_notify = await _get_users_to_notify(session, tenant_id, alarm)

            if not users_to_notify:
                logger.warning(
                    "task.send_alarm_notifications.no_recipients",
                    alarm_id=alarm_id,
                    tenant_id=tenant_id,
                )
                return {
                    "alarm_id": alarm_id,
                    "notifications_sent": False,
                    "error": "No users to notify",
                    "users_notified": 0,
                }

            # Format notification content
            notification_title = f"{alarm.severity.value.upper()} Alarm: {alarm.title}"
            notification_message = _format_alarm_message(alarm)
            notification_priority = _map_alarm_severity_to_priority(alarm.severity)

            # Initialize notification service
            notification_service = NotificationService(session)

            # Send notification to each user via appropriate channels
            notifications_created = 0
            notifications_failed = 0

            for user in users_to_notify:
                try:
                    # Create and send notification
                    notification = await notification_service.create_notification(
                        tenant_id=tenant_id,
                        user_id=user.id,
                        notification_type=NotificationType.ALARM,
                        title=notification_title,
                        message=notification_message,
                        priority=notification_priority,
                        channels=channels,
                        action_url=f"/faults/alarms/{alarm.id}",
                        action_label="View Alarm",
                        metadata={
                            "alarm_id": str(alarm.id),
                            "external_alarm_id": alarm.alarm_id,
                            "severity": alarm.severity.value,
                            "alarm_type": alarm.alarm_type,
                            "resource_type": alarm.resource_type,
                            "resource_id": alarm.resource_id,
                            "subscriber_count": alarm.subscriber_count,
                        },
                        auto_send=True,  # Automatically send via configured channels
                    )

                    notifications_created += 1

                    logger.info(
                        "task.send_alarm_notifications.user_notified",
                        alarm_id=alarm.alarm_id,
                        user_id=user.id,
                        notification_id=notification.id,
                        channels=[c.value for c in channels],
                    )

                except Exception as e:
                    notifications_failed += 1
                    logger.error(
                        "task.send_alarm_notifications.user_notification_failed",
                        alarm_id=alarm.alarm_id,
                        user_id=user.id,
                        error=str(e),
                        exc_info=True,
                    )

            logger.info(
                "task.send_alarm_notifications.complete",
                alarm_id=alarm_id,
                severity=alarm.severity.value,
                subscriber_count=alarm.subscriber_count,
                users_notified=notifications_created,
                notifications_failed=notifications_failed,
                channels=[c.value for c in channels],
            )

            return {
                "alarm_id": alarm_id,
                "notifications_sent": True,
                "users_notified": notifications_created,
                "notifications_failed": notifications_failed,
                "channels": [c.value for c in channels],
                "severity": alarm.severity.value,
            }

    return _run_async_task(_notify())


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
