"""Core event bus implementation with dependency injection."""

import asyncio
import json
from collections import defaultdict
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from fnmatch import fnmatch
from typing import Any, Protocol

import structlog

from dotmac.platform.events.exceptions import (
    EventError,
    EventPublishError,
)
from dotmac.platform.events.models import Event, EventPriority, EventStatus
from dotmac.platform.events.storage import EventStorage

logger = structlog.get_logger(__name__)

# Type alias for event handlers
EventHandler = Callable[[Event], Awaitable[None]]


class RedisClient(Protocol):
    """Protocol for Redis client to avoid direct dependencies."""

    def publish(self, channel: str, message: str) -> Any:
        """Publish message to channel."""
        ...

    def get(self, key: str) -> bytes | None:
        """Get value by key."""
        ...

    def setex(self, key: str, ttl: int, value: str) -> Any:
        """Set value with expiration."""
        ...


class EventBus:
    """
    Asynchronous event bus for pub/sub messaging with dependency injection.

    Features:
    - In-memory handlers for local/development mode
    - Redis pub/sub for distributed production mode (injected)
    - Event persistence for audit trail (injected storage)
    - Dead letter queue for failed events
    - Priority-based processing
    - Tenant isolation

    Design Pattern: Uses dependency injection for better testability
    """

    def __init__(
        self,
        storage: EventStorage | None = None,
        redis_client: RedisClient | None = None,
        enable_persistence: bool = True,
    ):
        """
        Initialize event bus with injected dependencies.

        Args:
            storage: Event storage for persistence (injected)
            redis_client: Redis client for distributed pub/sub (injected)
            enable_persistence: Whether to persist events
        """
        # In-memory handlers registry
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)
        self._pattern_handlers: dict[str, list[EventHandler]] = defaultdict(list)

        # Injected dependencies
        self._storage = storage or EventStorage(use_redis=redis_client is not None)
        self._redis = redis_client
        self._enable_persistence = enable_persistence

        # Background task for processing
        self._processing_task: asyncio.Task[None] | None = None
        self._running = False

        logger.info(
            "EventBus initialized",
            persistence=enable_persistence,
            redis=self._redis is not None,
        )

    async def publish(
        self,
        event_type: str,
        payload: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        priority: EventPriority = EventPriority.NORMAL,
    ) -> Event:
        """
        Publish an event.

        Args:
            event_type: Event type (e.g., 'invoice.created')
            payload: Event data
            metadata: Event metadata
            priority: Event priority

        Returns:
            Published event

        Raises:
            EventPublishError: If publishing fails
        """
        try:
            # Create event
            from dotmac.platform.events.models import EventMetadata

            now = datetime.now(UTC)
            event = Event(
                event_type=event_type,
                payload=payload or {},
                metadata=EventMetadata(**(metadata or {})),
                priority=priority,
                status=EventStatus.PENDING,
                created_at=now,
                published_at=None,
                processed_at=None,
                retry_count=0,
                max_retries=3,
                error_message=None,
                last_error_at=None,
            )

            logger.info(
                "Publishing event",
                event_id=event.event_id,
                event_type=event_type,
                priority=priority,
                tenant_id=event.metadata.tenant_id,
            )

            # Persist event if enabled
            if self._enable_persistence:
                await self._storage.save_event(event)

            # Publish to local handlers
            await self._publish_local(event)

            # Publish to Redis if enabled
            if self._redis:
                await self._publish_redis(event)

            event.published_at = event.created_at
            return event

        except Exception as e:
            logger.error(
                "Failed to publish event",
                event_type=event_type,
                error=str(e),
                exc_info=True,
            )
            raise EventPublishError(f"Failed to publish event: {e}") from e

    async def _publish_local(self, event: Event) -> None:
        """Publish event to local in-memory handlers."""
        handlers: list[EventHandler] = list(self._handlers.get(event.event_type, []))

        if self._pattern_handlers:
            for pattern, pattern_handlers in self._pattern_handlers.items():
                if fnmatch(event.event_type, pattern):
                    handlers.extend(pattern_handlers)

        if not handlers:
            logger.debug("No local handlers for event", event_type=event.event_type)
            return

        logger.debug(
            "Publishing to local handlers",
            event_type=event.event_type,
            handler_count=len(handlers),
        )

        # Execute handlers concurrently
        tasks = [self._execute_handler(handler, event) for handler in handlers]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _publish_redis(self, event: Event) -> None:
        """Publish event to Redis pub/sub."""
        if not self._redis:
            return

        try:
            channel = f"events:{event.event_type}"
            message = json.dumps(event.to_dict())
            self._redis.publish(channel, message)
            logger.debug("Published to Redis", channel=channel, event_id=event.event_id)
        except Exception as e:
            logger.warning("Failed to publish to Redis", error=str(e))
            # Don't fail the whole publish if Redis is unavailable

    async def _execute_handler(self, handler: EventHandler, event: Event) -> None:
        """
        Execute an event handler with error handling.

        Args:
            handler: Event handler function
            event: Event to process
        """
        event.mark_processing()

        try:
            await handler(event)
            event.mark_completed()

            logger.info(
                "Event handler completed",
                event_id=event.event_id,
                handler=handler.__name__,
            )

            # Update storage
            if self._enable_persistence:
                await self._storage.update_event(event)

        except Exception as e:
            error_msg = f"Handler {handler.__name__} failed: {str(e)}"
            event.mark_failed(error_msg)

            logger.error(
                "Event handler failed",
                event_id=event.event_id,
                handler=handler.__name__,
                error=str(e),
                retry_count=event.retry_count,
                exc_info=True,
            )

            # Update storage
            if self._enable_persistence:
                await self._storage.update_event(event)

            # Retry if possible
            if event.is_retryable:
                logger.info("Retrying event", event_id=event.event_id)
                await asyncio.sleep(2**event.retry_count)  # Exponential backoff
                await self._execute_handler(handler, event)

    def subscribe(
        self,
        event_type: str,
        handler: EventHandler,
    ) -> None:
        """
        Subscribe to an event type.

        Args:
            event_type: Event type to subscribe to
            handler: Async handler function
        """
        registry: dict[str, list[EventHandler]]

        if any(char in event_type for char in ("*", "?")):
            registry = self._pattern_handlers
        else:
            registry = self._handlers

        registry[event_type].append(handler)
        logger.info(
            "Handler subscribed",
            event_type=event_type,
            handler=handler.__name__,
            total_handlers=len(registry[event_type]),
        )

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """
        Unsubscribe from an event type.

        Args:
            event_type: Event type to unsubscribe from
            handler: Handler function to remove
        """
        registry = (
            self._pattern_handlers if event_type in self._pattern_handlers else self._handlers
        )

        if event_type in registry:
            handlers = registry[event_type]
            if handler in handlers:
                handlers.remove(handler)
                logger.info(
                    "Handler unsubscribed",
                    event_type=event_type,
                    handler=handler.__name__,
                )

    async def get_event(self, event_id: str) -> Event | None:
        """Get event by ID from storage."""
        if not self._enable_persistence:
            return None
        return await self._storage.get_event(event_id)

    async def get_events(
        self,
        event_type: str | None = None,
        status: EventStatus | None = None,
        tenant_id: str | None = None,
        limit: int = 100,
    ) -> list[Event]:
        """
        Query events from storage.

        Args:
            event_type: Filter by event type
            status: Filter by status
            tenant_id: Filter by tenant
            limit: Maximum number of events to return

        Returns:
            List of matching events
        """
        if not self._enable_persistence:
            return []
        events = await self._storage.query_events(
            event_type=event_type,
            status=status,
            tenant_id=tenant_id,
            limit=limit,
        )
        if not events:
            return []
        return list(events)

    async def replay_event(self, event_id: str) -> None:
        """
        Replay a failed event.

        Args:
            event_id: ID of event to replay
        """
        event = await self.get_event(event_id)
        if not event:
            raise EventError(f"Event {event_id} not found")

        logger.info("Replaying event", event_id=event_id, event_type=event.event_type)

        # Reset status for replay
        event.status = EventStatus.PENDING
        event.retry_count = 0
        event.error_message = None

        await self._publish_local(event)

    async def start(self) -> None:
        """Start background event processing."""
        if self._running:
            return

        self._running = True
        logger.info("EventBus started")

    async def stop(self) -> None:
        """Stop background event processing."""
        if not self._running:
            return

        self._running = False

        if self._processing_task:
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass

        logger.info("EventBus stopped")


# Global event bus instance
_event_bus: EventBus | None = None


def get_event_bus(
    storage: EventStorage | None = None,
    redis_client: RedisClient | None = None,
    enable_persistence: bool = True,
) -> EventBus:
    """
    Get or create global event bus instance.

    Args:
        storage: Event storage instance
        redis_client: Redis client for pub/sub (injected)
        enable_persistence: Whether to enable event persistence

    Returns:
        EventBus instance
    """
    global _event_bus

    if _event_bus is None:
        # If redis_client not provided, get from caching module
        if redis_client is None:
            try:
                from dotmac.platform.core.caching import get_redis

                redis_client = get_redis()
            except Exception:
                # Redis not available, use in-memory mode
                logger.info("Redis not available, using in-memory event bus")
                redis_client = None

        _event_bus = EventBus(
            storage=storage,
            redis_client=redis_client,
            enable_persistence=enable_persistence,
        )

    return _event_bus


def reset_event_bus() -> None:
    """Reset global event bus (useful for testing)."""
    global _event_bus
    _event_bus = None
