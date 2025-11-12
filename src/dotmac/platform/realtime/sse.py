"""
Server-Sent Events (SSE) Handlers

Real-time one-way event streaming for ONU status, alerts, and tickets.
"""

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import HTTPException
from redis.asyncio.client import PubSub
from redis.exceptions import RedisError
from redis.exceptions import TimeoutError as RedisTimeoutError
from sse_starlette.sse import EventSourceResponse

from dotmac.platform.redis_client import RedisClientType
from dotmac.platform.resilience.circuit_breaker import (
    CircuitBreakerError,
    get_redis_pubsub_breaker,
)

logger = structlog.get_logger(__name__)


def _normalize_tenant(tenant_id: str | None) -> str:
    return tenant_id or "platform"


class SSEStream:
    """Base class for SSE event streams."""

    def __init__(self, redis: RedisClientType, tenant_id: str | None):
        self.redis = redis
        self.tenant_id = _normalize_tenant(tenant_id)
        self.pubsub: PubSub | None = None

    async def subscribe(self, channel: str) -> AsyncGenerator[dict[str, Any]]:
        """
        Subscribe to Redis channel and yield SSE events.

        Args:
            channel: Redis pub/sub channel name

        Yields:
            SSE event dictionaries

        Raises:
            HTTPException: 503 if Redis is unavailable or circuit breaker is open
        """
        circuit_breaker = get_redis_pubsub_breaker()

        # Check circuit breaker state before attempting subscription
        if circuit_breaker.is_open:
            logger.error(
                "sse.circuit_breaker_open",
                tenant_id=self.tenant_id,
                channel=channel,
                circuit_state=circuit_breaker.get_state(),
            )
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Redis pub/sub temporarily unavailable",
                    "message": "Service is experiencing connection issues. Please try again later.",
                    "circuit_breaker_state": circuit_breaker.get_state(),
                },
            )

        async def _subscribe_with_breaker() -> PubSub:
            """Subscribe to channel with circuit breaker protection."""
            pubsub = self.redis.pubsub()
            await pubsub.subscribe(channel)
            return pubsub

        try:
            # Use circuit breaker for subscription
            self.pubsub = await circuit_breaker.call(_subscribe_with_breaker)
            logger.info("sse.subscribed", tenant_id=self.tenant_id, channel=channel)
        except CircuitBreakerError as exc:
            logger.error(
                "sse.circuit_breaker_open",
                tenant_id=self.tenant_id,
                channel=channel,
                error=str(exc),
            )
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Redis pub/sub temporarily unavailable",
                    "message": str(exc),
                },
            )
        except RedisError as exc:
            logger.error(
                "sse.redis_subscribe_failed",
                tenant_id=self.tenant_id,
                channel=channel,
                error=str(exc),
            )
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Redis connection failed",
                    "message": "Unable to establish connection to Redis pub/sub. Please check Redis status.",
                    "detail": str(exc),
                },
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.error(
                "sse.subscribe_failed",
                tenant_id=self.tenant_id,
                channel=channel,
                error=str(exc),
            )
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Stream initialization failed",
                    "message": "Unable to initialize event stream.",
                    "detail": str(exc),
                },
            )

        try:
            # Send initial connection event
            yield {"event": "connected", "data": json.dumps({"channel": channel})}

            while True:
                try:
                    message = await self.pubsub.get_message(
                        ignore_subscribe_messages=False, timeout=1.0
                    )
                except RedisTimeoutError:
                    # Idle timeout - keep connection alive
                    continue

                if not message:
                    continue

                if message["type"] == "message":
                    try:
                        event_data = json.loads(message["data"])
                        event_type = event_data.get("event_type", "unknown")
                        yield {"event": event_type, "data": message["data"]}
                    except json.JSONDecodeError:
                        logger.warning(
                            "sse.invalid_json",
                            tenant_id=self.tenant_id,
                            channel=channel,
                        )
                        continue
                elif message["type"] == "unsubscribe":
                    break

        except asyncio.CancelledError:
            logger.info("sse.cancelled", tenant_id=self.tenant_id, channel=channel)
            raise
        except RedisError as exc:
            logger.error(
                "sse.redis_error",
                tenant_id=self.tenant_id,
                channel=channel,
                error=str(exc),
            )
            yield {
                "event": "error",
                "data": json.dumps({"error": "Redis error", "detail": str(exc)}),
            }
        except Exception as e:  # pragma: no cover - defensive
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
                try:
                    await self.pubsub.unsubscribe(channel)
                    await self.pubsub.close()
                except RedisError as exc:
                    logger.warning(
                        "sse.redis_unsubscribe_failed",
                        tenant_id=self.tenant_id,
                        channel=channel,
                        error=str(exc),
                    )
            logger.info("sse.unsubscribed", tenant_id=self.tenant_id, channel=channel)


class ONUStatusStream(SSEStream):
    """SSE stream for ONU status changes."""

    async def stream(self) -> AsyncGenerator[dict[str, Any]]:
        """Stream ONU status events for tenant."""
        channel = f"onu_status:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


class AlertStream(SSEStream):
    """SSE stream for network and system alerts."""

    async def stream(self) -> AsyncGenerator[dict[str, Any]]:
        """Stream alert events for tenant."""
        channel = f"alerts:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


class TicketStream(SSEStream):
    """SSE stream for ticket updates."""

    async def stream(self) -> AsyncGenerator[dict[str, Any]]:
        """Stream ticket events for tenant."""
        channel = f"tickets:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


class SubscriberStream(SSEStream):
    """SSE stream for subscriber lifecycle events."""

    async def stream(self) -> AsyncGenerator[dict[str, Any]]:
        """Stream subscriber events for tenant."""
        channel = f"subscribers:{self.tenant_id}"
        async for event in self.subscribe(channel):
            yield event


class RADIUSSessionStream(SSEStream):
    """SSE stream for RADIUS session events."""

    async def stream(self) -> AsyncGenerator[dict[str, Any]]:
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


async def create_onu_status_stream(
    redis: RedisClientType, tenant_id: str | None
) -> EventSourceResponse:
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


async def create_alert_stream(redis: RedisClientType, tenant_id: str | None) -> EventSourceResponse:
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


async def create_ticket_stream(
    redis: RedisClientType, tenant_id: str | None
) -> EventSourceResponse:
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


async def create_subscriber_stream(
    redis: RedisClientType, tenant_id: str | None
) -> EventSourceResponse:
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


async def create_radius_session_stream(
    redis: RedisClientType, tenant_id: str | None
) -> EventSourceResponse:
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
