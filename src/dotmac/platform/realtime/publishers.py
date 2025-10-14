"""
Real-Time Event Publishers

Redis pub/sub publishers for broadcasting real-time events.
"""

import json
from typing import Any

import structlog
from redis.asyncio import Redis

from dotmac.platform.realtime.schemas import (
    AlertEvent,
    BaseEvent,
    JobProgressEvent,
    ONUStatusEvent,
    RADIUSSessionEvent,
    SubscriberEvent,
    TicketEvent,
)

logger = structlog.get_logger(__name__)


class EventPublisher:
    """Publishes events to Redis pub/sub channels."""

    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    async def publish_event(self, channel: str, event: BaseEvent) -> None:
        """
        Publish event to Redis channel.

        Args:
            channel: Redis channel name
            event: Event payload
        """
        try:
            payload = event.model_dump_json()
            await self.redis.publish(channel, payload)
            logger.info(
                "event.published",
                channel=channel,
                event_type=event.event_type,
                tenant_id=event.tenant_id,
            )
        except Exception as e:
            logger.error(
                "event.publish_failed",
                channel=channel,
                event_type=event.event_type,
                error=str(e),
            )

    async def publish_onu_status(self, event: ONUStatusEvent) -> None:
        """Publish ONU status change event."""
        channel = f"onu_status:{event.tenant_id}"
        await self.publish_event(channel, event)

    async def publish_session(self, event: RADIUSSessionEvent) -> None:
        """Publish RADIUS session event."""
        channel = f"sessions:{event.tenant_id}"
        await self.publish_event(channel, event)

    async def publish_job_progress(self, event: JobProgressEvent) -> None:
        """Publish job progress event."""
        # Publish to both tenant-wide and job-specific channels
        tenant_channel = f"jobs:{event.tenant_id}"
        job_channel = f"job:{event.job_id}"
        await self.publish_event(tenant_channel, event)
        await self.publish_event(job_channel, event)

    async def publish_ticket(self, event: TicketEvent) -> None:
        """Publish ticket event."""
        channel = f"tickets:{event.tenant_id}"
        await self.publish_event(channel, event)

    async def publish_alert(self, event: AlertEvent) -> None:
        """Publish alert event."""
        channel = f"alerts:{event.tenant_id}"
        await self.publish_event(channel, event)

    async def publish_subscriber(self, event: SubscriberEvent) -> None:
        """Publish subscriber lifecycle event."""
        channel = f"subscribers:{event.tenant_id}"
        await self.publish_event(channel, event)


# =============================================================================
# Helper Functions for Common Publishing Patterns
# =============================================================================


async def publish_onu_online(
    redis: Redis,
    tenant_id: str,
    onu_serial: str,
    subscriber_id: str | None = None,
    signal_dbm: float | None = None,
    olt_id: str | None = None,
    pon_port: int | None = None,
) -> None:
    """Convenience function to publish ONU online event."""
    from datetime import datetime

    from dotmac.platform.realtime.schemas import EventType, ONUStatus

    publisher = EventPublisher(redis)
    event = ONUStatusEvent(
        event_type=EventType.ONU_ONLINE,
        tenant_id=tenant_id,
        timestamp=datetime.utcnow(),
        onu_serial=onu_serial,
        subscriber_id=subscriber_id,
        status=ONUStatus.ONLINE,
        signal_dbm=signal_dbm,
        olt_id=olt_id,
        pon_port=pon_port,
    )
    await publisher.publish_onu_status(event)


async def publish_job_update(
    redis: Redis,
    tenant_id: str,
    job_id: str,
    job_type: str,
    status: str,
    progress_percent: int | None = None,
    items_total: int | None = None,
    items_processed: int | None = None,
    items_succeeded: int | None = None,
    items_failed: int | None = None,
    current_item: str | None = None,
    error_message: str | None = None,
) -> None:
    """Convenience function to publish job progress update."""
    from datetime import datetime

    from dotmac.platform.realtime.schemas import EventType, JobStatus

    publisher = EventPublisher(redis)

    # Map status string to EventType
    event_type_map = {
        "pending": EventType.JOB_CREATED,
        "running": EventType.JOB_PROGRESS,
        "completed": EventType.JOB_COMPLETED,
        "failed": EventType.JOB_FAILED,
        "cancelled": EventType.JOB_CANCELLED,
    }
    event_type = event_type_map.get(status, EventType.JOB_PROGRESS)

    event = JobProgressEvent(
        event_type=event_type,
        tenant_id=tenant_id,
        timestamp=datetime.utcnow(),
        job_id=job_id,
        job_type=job_type,
        status=JobStatus(status),
        progress_percent=progress_percent,
        items_total=items_total,
        items_processed=items_processed,
        items_succeeded=items_succeeded,
        items_failed=items_failed,
        current_item=current_item,
        error_message=error_message,
    )
    await publisher.publish_job_progress(event)
