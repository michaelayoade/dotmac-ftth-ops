"""
Background tasks for subscription management.

This module contains Celery tasks for:
- Processing scheduled plan changes
- Subscription renewal reminders
- Trial expiration notifications
- Subscription status updates
"""

import structlog

from dotmac.platform.celery_app import app
from dotmac.platform.database import get_async_session_context

from .service import SubscriptionService

logger = structlog.get_logger(__name__)


@app.task(name="subscriptions.process_scheduled_plan_changes")
def process_scheduled_plan_changes_task() -> dict[str, int]:
    """
    Process all scheduled plan changes that are due.

    This task should be scheduled to run periodically (e.g., every hour or every 15 minutes)
    to check for and apply any plan changes that were scheduled for a future date.

    Returns:
        Dictionary with processing statistics:
        - processed: Number of plan changes successfully applied
        - failed: Number of plan changes that failed
        - skipped: Number of changes skipped (invalid state)
    """
    import asyncio

    async def _process():
        async with get_async_session_context() as session:
            service = SubscriptionService(session)
            return await service.process_scheduled_plan_changes()

    try:
        result = asyncio.run(_process())
    except RuntimeError as exc:
        # Fallback for environments that already have a running loop
        if "asyncio.run() cannot be called" not in str(exc):
            raise
        loop = asyncio.new_event_loop()
        policy = asyncio.get_event_loop_policy()
        try:
            previous_loop = policy.get_event_loop()
        except RuntimeError:
            previous_loop = None
        try:
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(_process())
        finally:
            asyncio.set_event_loop(previous_loop)
            loop.close()

    logger.info(
        "Scheduled plan changes task completed",
        processed=result["processed"],
        failed=result["failed"],
        skipped=result["skipped"],
    )

    return result


# Schedule this task to run periodically
# Example: Run every 15 minutes to check for due plan changes
# This can be configured in celerybeat_schedule or via Celery Beat
@app.on_after_finalize.connect
def setup_periodic_tasks(sender, **kwargs):
    """Set up periodic task schedules."""
    # Run scheduled plan changes every 15 minutes
    sender.add_periodic_task(
        900.0,  # 15 minutes in seconds
        process_scheduled_plan_changes_task.s(),
        name="process-scheduled-plan-changes-every-15min",
    )
