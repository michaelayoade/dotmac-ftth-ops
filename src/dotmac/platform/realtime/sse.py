"""
Server-Sent Events (SSE) Handlers

Real-time one-way event streaming for ONU status, alerts, and tickets.
"""

import asyncio
import json
from collections.abc import AsyncGenerator

import structlog
from redis.asyncio import Redis
from redis.asyncio.client import PubSub
from sse_starlette.sse import EventSourceResponse

logger = structlog.get_logger(__name__)


class SSEStream:
    """Base class for SSE event streams."""

    def __init__(self, redis: Redis, tenant_id: str):
        self.redis = redis
        self.tenant_id = tenant_id
        self.pubsub: PubSub | None = None

    async def subscribe(self, channel: str) -> AsyncGenerator[dict, None]:
        """
        Subscribe to Redis channel and yield SSE events.

        Args:
            channel: Redis pub/sub channel name

        Yields:
            SSE event dictionaries
        """
        self.pubsub = self.redis.pubsub()
        await self.pubsub.subscribe(channel)

        logger.info("sse.subscribed", tenant_id=self.tenant_id, channel=channel)

        try:
            # Send initial connection event
            yield {"event": "connected", "data": json.dumps({"channel": channel})}

            # Listen for messages
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    try:
                        # Parse event data
                        event_data = json.loads(message["data"])
                        event_type = event_data.get("event_type", "unknown")

                        # Yield SSE event
                        yield {"event": event_type, "data": message["data"]}

                    except json.JSONDecodeError:
                        logger.warning(
                            "sse.invalid_json",
                            tenant_id=self.tenant_id,
                            channel=channel,
                        )
                        continue

        except asyncio.CancelledError:
            logger.info("sse.cancelled", tenant_id=self.tenant_id, channel=channel)
            raise
        except Exception as e:
            logger.error(
                "sse.error",
                tenant_id=self.tenant_id,
                channel=channel,
                error=str(e),
            )
            yield {
                "event": "error",
                "data": json.dumps({"error": "Stream error occurred"}),
            }
        finally:
            if self.pubsub:
                await self.pubsub.unsubscribe(channel)
                await self.pubsub.close()
            logger.info("sse.unsubscribed", tenant_id=self.tenant_id, channel=channel)


class ONUStatusStream(SSEStream):
    """SSE stream for ONU status changes."""

    async def stream(self) -> AsyncGenerator[dict, None]:
        """Stream ONU status events for tenant."""
        channel = f"onu_status:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


class AlertStream(SSEStream):
    """SSE stream for network and system alerts."""

    async def stream(self) -> AsyncGenerator[dict, None]:
        """Stream alert events for tenant."""
        channel = f"alerts:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


class TicketStream(SSEStream):
    """SSE stream for ticket updates."""

    async def stream(self) -> AsyncGenerator[dict, None]:
        """Stream ticket events for tenant."""
        channel = f"tickets:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


class SubscriberStream(SSEStream):
    """SSE stream for subscriber lifecycle events."""

    async def stream(self) -> AsyncGenerator[dict, None]:
        """Stream subscriber events for tenant."""
        channel = f"subscribers:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


class RADIUSSessionStream(SSEStream):
    """SSE stream for RADIUS session events."""

    async def stream(self) -> AsyncGenerator[dict, None]:
        """
        Stream RADIUS session events for tenant.

        Events include:
        - Session start (authentication)
        - Session stop (disconnection)
        - Session interim-update (accounting updates)
        - Session timeout warnings
        - Bandwidth changes
        """
        channel = f"radius_sessions:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


# =============================================================================
# SSE Stream Factory Functions
# =============================================================================


async def create_onu_status_stream(redis: Redis, tenant_id: str) -> EventSourceResponse:
    """
    Create SSE stream for ONU status updates.

    Args:
        redis: Redis client
        tenant_id: Tenant ID

    Returns:
        EventSourceResponse for SSE streaming
    """
    stream = ONUStatusStream(redis, tenant_id)
    return EventSourceResponse(stream.stream())


async def create_alert_stream(redis: Redis, tenant_id: str) -> EventSourceResponse:
    """
    Create SSE stream for network alerts.

    Args:
        redis: Redis client
        tenant_id: Tenant ID

    Returns:
        EventSourceResponse for SSE streaming
    """
    stream = AlertStream(redis, tenant_id)
    return EventSourceResponse(stream.stream())


async def create_ticket_stream(redis: Redis, tenant_id: str) -> EventSourceResponse:
    """
    Create SSE stream for ticket updates.

    Args:
        redis: Redis client
        tenant_id: Tenant ID

    Returns:
        EventSourceResponse for SSE streaming
    """
    stream = TicketStream(redis, tenant_id)
    return EventSourceResponse(stream.stream())


async def create_subscriber_stream(redis: Redis, tenant_id: str) -> EventSourceResponse:
    """
    Create SSE stream for subscriber events.

    Args:
        redis: Redis client
        tenant_id: Tenant ID

    Returns:
        EventSourceResponse for SSE streaming
    """
    stream = SubscriberStream(redis, tenant_id)
    return EventSourceResponse(stream.stream())


async def create_radius_session_stream(redis: Redis, tenant_id: str) -> EventSourceResponse:
    """
    Create SSE stream for RADIUS session events.

    Args:
        redis: Redis client
        tenant_id: Tenant ID

    Returns:
        EventSourceResponse for SSE streaming
    """
    stream = RADIUSSessionStream(redis, tenant_id)
    return EventSourceResponse(stream.stream())
