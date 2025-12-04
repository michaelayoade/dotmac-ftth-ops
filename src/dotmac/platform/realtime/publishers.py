"""
Real-Time Event Publishers

Redis pub/sub publishers for broadcasting real-time events.
"""

from typing import Any, Protocol, cast, runtime_checkable

import structlog

from dotmac.platform.realtime.schemas import (
    AlertEvent,
    EventType,
    JobProgressEvent,
    JobStatus,
    ONUStatus,
    ONUStatusEvent,
    RADIUSSessionEvent,
    SubscriberEvent,
    TicketEvent,
)
from dotmac.platform.redis_client import RedisClientType

logger = structlog.get_logger(__name__)


@runtime_checkable
class SupportsEventPayload(Protocol):
    """Protocol describing the minimal payload interface we publish."""

    event_type: Any
    tenant_id: str


class EventPublisher:
    """Publishes events to Redis pub/sub channels."""

    def __init__(self, redis_client: RedisClientType):
        self.redis = redis_client

    async def publish_event(self, channel: str, event: SupportsEventPayload) -> None:
        """
        Publish event to Redis channel.

        Args:
            channel: Redis channel name
            event: Event payload
        """
        try:
            payload = cast(Any, event).model_dump_json()
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
        # Publish to both general sessions and RADIUS-specific channel
        sessions_channel = f"sessions:{event.tenant_id}"
        radius_channel = f"radius_sessions:{event.tenant_id}"
        await self.publish_event(sessions_channel, event)
        await self.publish_event(radius_channel, event)

    async def publish_job_progress(self, event: JobProgressEvent) -> None:
        """Publish job progress event."""
        # Publish to both tenant-wide and job-specific channels
        tenant_channel = f"jobs:{event.tenant_id}"
        job_channel = f"job:{event.job_id}"
        tenant_scoped_job_channel = f"{event.tenant_id}:job:{event.job_id}"
        await self.publish_event(tenant_channel, event)
        await self.publish_event(job_channel, event)
        await self.publish_event(tenant_scoped_job_channel, event)

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
    redis: RedisClientType,
    tenant_id: str,
    onu_serial: str,
    subscriber_id: str | None = None,
    signal_dbm: float | None = None,
    olt_id: str | None = None,
    pon_port: int | None = None,
) -> None:
    """Convenience function to publish ONU online event."""
    from datetime import datetime

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
    redis: RedisClientType,
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


async def publish_radius_session_start(
    redis: RedisClientType,
    tenant_id: str,
    username: str,
    session_id: str,
    nas_ip: str,
    framed_ip: str | None = None,
    subscriber_id: str | None = None,
    bandwidth_profile: str | None = None,
) -> None:
    """Convenience function to publish RADIUS session start event."""
    from datetime import datetime

    publisher = EventPublisher(redis)
    event = RADIUSSessionEvent(
        event_type=EventType.SESSION_STARTED,
        tenant_id=tenant_id,
        timestamp=datetime.utcnow(),
        username=username,
        session_id=session_id,
        nas_ip_address=nas_ip,
        framed_ip_address=framed_ip,
        subscriber_id=subscriber_id,
        bandwidth_profile=bandwidth_profile,
    )
    await publisher.publish_session(event)


async def publish_radius_session_stop(
    redis: RedisClientType,
    tenant_id: str,
    username: str,
    session_id: str,
    nas_ip: str,
    terminate_cause: str | None = None,
    session_time: int | None = None,
    input_octets: int | None = None,
    output_octets: int | None = None,
) -> None:
    """Convenience function to publish RADIUS session stop event."""
    from datetime import datetime

    publisher = EventPublisher(redis)
    event = RADIUSSessionEvent(
        event_type=EventType.SESSION_STOPPED,
        tenant_id=tenant_id,
        timestamp=datetime.utcnow(),
        username=username,
        session_id=session_id,
        nas_ip_address=nas_ip,
        terminate_cause=terminate_cause,
        session_time=session_time,
        bytes_in=input_octets,
        bytes_out=output_octets,
    )
    await publisher.publish_session(event)


async def publish_radius_session_update(
    redis: RedisClientType,
    tenant_id: str,
    username: str,
    session_id: str,
    nas_ip: str,
    session_time: int | None = None,
    input_octets: int | None = None,
    output_octets: int | None = None,
) -> None:
    """Convenience function to publish RADIUS session interim-update event."""
    from datetime import datetime

    publisher = EventPublisher(redis)
    event = RADIUSSessionEvent(
        event_type=EventType.SESSION_UPDATED,
        tenant_id=tenant_id,
        timestamp=datetime.utcnow(),
        username=username,
        session_id=session_id,
        nas_ip_address=nas_ip,
        session_time=session_time,
        bytes_in=input_octets,
        bytes_out=output_octets,
    )
    await publisher.publish_session(event)
