"""Tests for event bus functionality."""

import pytest

from dotmac.platform.events import (
    Event,
    EventBus,
    EventPriority,
    EventStatus,
    get_event_bus,
    reset_event_bus,
)
from dotmac.platform.events.storage import EventStorage


class TestEventBus:
    """Test EventBus core functionality."""

    @pytest.fixture
    def event_bus(self):
        """Create event bus for testing."""
        reset_event_bus()
        storage = EventStorage(use_redis=False)
        bus = EventBus(storage=storage, redis_client=None, enable_persistence=True)
        yield bus
        reset_event_bus()

    @pytest.mark.asyncio
    async def test_publish_gracefully_handles_redis_failures(self):
        """Publishing to Redis should not raise if the client fails."""

        class BrokenRedis:
            def publish(self, channel: str, message: str) -> None:  # pragma: no cover - exercised
                raise RuntimeError("redis down")

        storage = EventStorage(use_redis=False)
        bus = EventBus(storage=storage, redis_client=BrokenRedis(), enable_persistence=False)

        event = await bus.publish(event_type="redis.test", payload={"foo": "bar"})

        # Publish should still succeed
        assert event.event_type == "redis.test"
        assert event.payload == {"foo": "bar"}

    @pytest.mark.asyncio
    async def test_storage_falls_back_to_memory_when_redis_set_fails(self):
        """Errors from the Redis client should fall back to in-memory storage."""

        class BrokenRedis:
            def setex(self, *args, **kwargs):  # pragma: no cover - exercised
                raise RuntimeError("cannot set")

            def publish(self, *args, **kwargs):  # pragma: no cover - compatibility
                raise RuntimeError("cannot publish")

        storage = EventStorage(use_redis=True)
        storage._redis = BrokenRedis()  # type: ignore[attr-defined]

        event = Event(event_type="fallback", payload={"value": 1})

        await storage.save_event(event)

        assert event.event_id in storage._memory_store  # type: ignore[attr-defined]
        stored = await storage.get_event(event.event_id)
        assert stored is event

    @pytest.mark.asyncio
    async def test_query_memory_filters(self):
        """Querying without Redis should respect filters."""

        storage = EventStorage(use_redis=False)

        # Populate memory store manually
        event_a = Event(event_type="type.a", payload={}, metadata={"tenant_id": "tenant-1"})
        event_b = Event(event_type="type.b", payload={}, metadata={"tenant_id": "tenant-2"})
        event_c = Event(event_type="type.a", payload={}, metadata={})
        event_c.status = EventStatus.COMPLETED

        storage._memory_store[event_a.event_id] = event_a  # type: ignore[attr-defined]
        storage._memory_store[event_b.event_id] = event_b  # type: ignore[attr-defined]
        storage._memory_store[event_c.event_id] = event_c  # type: ignore[attr-defined]

        by_type = await storage.query_events(event_type="type.a")
        assert {e.event_id for e in by_type} == {event_a.event_id, event_c.event_id}

        by_status = await storage.query_events(status=EventStatus.COMPLETED)
        assert [e.event_id for e in by_status] == [event_c.event_id]

        by_tenant = await storage.query_events(tenant_id="tenant-2")
        assert [e.event_id for e in by_tenant] == [event_b.event_id]

    def test_get_event_bus_falls_back_without_redis(self, monkeypatch):
        """Global event bus should initialise even when Redis is unavailable."""

        reset_event_bus()

        def raise_on_get():  # pragma: no cover - exercised
            raise RuntimeError("redis unavailable")

        monkeypatch.setattr("dotmac.platform.core.caching.get_redis", raise_on_get)

        bus = get_event_bus(storage=EventStorage(use_redis=False), redis_client=None, enable_persistence=False)

        assert isinstance(bus, EventBus)
        assert bus._redis is None  # type: ignore[attr-defined]

    @pytest.mark.asyncio
    async def test_publish_event_basic(self, event_bus):
        """Test basic event publishing."""
        event = await event_bus.publish(
            event_type="test.event",
            payload={"key": "value"},
            metadata={"tenant_id": "test-tenant"},
        )

        assert event.event_id is not None
        assert event.event_type == "test.event"
        assert event.payload == {"key": "value"}
        assert event.metadata.tenant_id == "test-tenant"
        assert event.status == EventStatus.PENDING

    @pytest.mark.asyncio
    async def test_publish_with_priority(self, event_bus):
        """Test publishing event with priority."""
        event = await event_bus.publish(
            event_type="urgent.event",
            payload={"urgent": True},
            priority=EventPriority.CRITICAL,
        )

        assert event.priority == EventPriority.CRITICAL

    @pytest.mark.asyncio
    async def test_subscribe_and_handle(self, event_bus):
        """Test subscribing to and handling events."""
        handler_called = False
        received_event = None

        async def test_handler(event: Event):
            nonlocal handler_called, received_event
            handler_called = True
            received_event = event

        # Subscribe handler
        event_bus.subscribe("test.event", test_handler)

        # Publish event
        event = await event_bus.publish(
            event_type="test.event",
            payload={"test": "data"},
        )

        # Give handler time to execute
        import asyncio

        await asyncio.sleep(0.1)

        assert handler_called
        assert received_event is not None
        assert received_event.event_id == event.event_id
        assert received_event.payload == {"test": "data"}

    @pytest.mark.asyncio
    async def test_multiple_handlers(self, event_bus):
        """Test multiple handlers for same event type."""
        handler1_called = False
        handler2_called = False

        async def handler1(event: Event):
            nonlocal handler1_called
            handler1_called = True

        async def handler2(event: Event):
            nonlocal handler2_called
            handler2_called = True

        event_bus.subscribe("test.event", handler1)
        event_bus.subscribe("test.event", handler2)

        await event_bus.publish(event_type="test.event", payload={})

        import asyncio

        await asyncio.sleep(0.1)

        assert handler1_called
        assert handler2_called

    @pytest.mark.asyncio
    async def test_handler_error_handling(self, event_bus):
        """Test error handling in event handlers."""

        async def failing_handler(event: Event):
            raise ValueError("Handler error")

        event_bus.subscribe("test.event", failing_handler)

        # Should not raise exception, error should be captured
        event = await event_bus.publish(
            event_type="test.event",
            payload={"test": "data"},
        )

        import asyncio

        await asyncio.sleep(0.1)

        # Event should be in dead letter queue after max retries
        stored_event = await event_bus.get_event(event.event_id)
        assert stored_event.status == EventStatus.DEAD_LETTER
        assert "Handler error" in stored_event.error_message
        assert stored_event.retry_count == stored_event.max_retries

    @pytest.mark.asyncio
    async def test_event_persistence(self, event_bus):
        """Test event persistence to storage."""
        event = await event_bus.publish(
            event_type="test.event",
            payload={"data": "value"},
        )

        # Retrieve from storage
        stored_event = await event_bus.get_event(event.event_id)

        assert stored_event is not None
        assert stored_event.event_id == event.event_id
        assert stored_event.event_type == "test.event"
        assert stored_event.payload == {"data": "value"}

    @pytest.mark.asyncio
    async def test_query_events_by_type(self, event_bus):
        """Test querying events by type."""
        await event_bus.publish(event_type="type1.event", payload={})
        await event_bus.publish(event_type="type1.event", payload={})
        await event_bus.publish(event_type="type2.event", payload={})

        events = await event_bus.get_events(event_type="type1.event")

        assert len(events) == 2
        assert all(e.event_type == "type1.event" for e in events)

    @pytest.mark.asyncio
    async def test_query_events_by_status(self, event_bus):
        """Test querying events by status."""

        async def handler(event: Event):
            pass

        event_bus.subscribe("test.event", handler)

        await event_bus.publish(event_type="test.event", payload={})
        await event_bus.publish(event_type="test.event", payload={})

        import asyncio

        await asyncio.sleep(0.1)

        completed_events = await event_bus.get_events(status=EventStatus.COMPLETED)

        assert len(completed_events) == 2

    @pytest.mark.asyncio
    async def test_query_events_by_tenant(self, event_bus):
        """Test querying events by tenant."""
        await event_bus.publish(
            event_type="test.event",
            payload={},
            metadata={"tenant_id": "tenant1"},
        )
        await event_bus.publish(
            event_type="test.event",
            payload={},
            metadata={"tenant_id": "tenant2"},
        )

        tenant1_events = await event_bus.get_events(tenant_id="tenant1")

        assert len(tenant1_events) == 1
        assert tenant1_events[0].metadata.tenant_id == "tenant1"

    @pytest.mark.asyncio
    async def test_event_retry_mechanism(self, event_bus):
        """Test automatic retry of failed events."""
        attempt_count = 0

        async def flaky_handler(event: Event):
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 2:
                raise ValueError("First attempt fails")
            # Second attempt succeeds

        event_bus.subscribe("test.event", flaky_handler)

        event = await event_bus.publish(event_type="test.event", payload={})

        import asyncio

        await asyncio.sleep(0.5)

        # Should have retried and succeeded
        assert attempt_count == 2

        stored_event = await event_bus.get_event(event.event_id)
        assert stored_event.status == EventStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_dead_letter_queue(self, event_bus):
        """Test events moving to dead letter queue after max retries."""

        async def always_failing_handler(event: Event):
            raise ValueError("Always fails")

        event_bus.subscribe("test.event", always_failing_handler)

        event = await event_bus.publish(
            event_type="test.event",
            payload={},
        )

        import asyncio

        await asyncio.sleep(2)

        stored_event = await event_bus.get_event(event.event_id)
        assert stored_event.status == EventStatus.DEAD_LETTER
        assert stored_event.retry_count >= event.max_retries

    @pytest.mark.asyncio
    async def test_replay_event(self, event_bus):
        """Test replaying a failed event."""
        handler_call_count = 0

        async def handler(event: Event):
            nonlocal handler_call_count
            handler_call_count += 1

        event_bus.subscribe("test.event", handler)

        event = await event_bus.publish(event_type="test.event", payload={})

        import asyncio

        await asyncio.sleep(0.1)

        assert handler_call_count == 1

        # Replay the event
        await event_bus.replay_event(event.event_id)
        await asyncio.sleep(0.1)

        assert handler_call_count == 2

    @pytest.mark.asyncio
    async def test_unsubscribe_handler(self, event_bus):
        """Test unsubscribing a handler."""
        handler_called = False

        async def handler(event: Event):
            nonlocal handler_called
            handler_called = True

        event_bus.subscribe("test.event", handler)
        event_bus.unsubscribe("test.event", handler)

        await event_bus.publish(event_type="test.event", payload={})

        import asyncio

        await asyncio.sleep(0.1)

        assert not handler_called

    def test_get_event_bus_singleton(self):
        """Test get_event_bus returns singleton instance."""
        reset_event_bus()

        bus1 = get_event_bus(redis_client=None, enable_persistence=False)
        bus2 = get_event_bus(redis_client=None, enable_persistence=False)

        assert bus1 is bus2

        reset_event_bus()


class TestEventMetadata:
    """Test event metadata functionality."""

    @pytest.mark.asyncio
    async def test_correlation_tracking(self):
        """Test correlation ID tracking through events."""
        reset_event_bus()
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)

        event1 = await event_bus.publish(
            event_type="event1",
            payload={},
            metadata={"correlation_id": "request-123"},
        )

        event2 = await event_bus.publish(
            event_type="event2",
            payload={},
            metadata={
                "correlation_id": "request-123",
                "causation_id": event1.event_id,
            },
        )

        assert event1.metadata.correlation_id == "request-123"
        assert event2.metadata.correlation_id == "request-123"
        assert event2.metadata.causation_id == event1.event_id

        reset_event_bus()

    @pytest.mark.asyncio
    async def test_trace_context_propagation(self):
        """Test distributed tracing context propagation."""
        reset_event_bus()
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)

        event = await event_bus.publish(
            event_type="test.event",
            payload={},
            metadata={
                "trace_id": "trace-456",
                "user_id": "user-789",
                "source": "billing",
            },
        )

        assert event.metadata.trace_id == "trace-456"
        assert event.metadata.user_id == "user-789"
        assert event.metadata.source == "billing"

        reset_event_bus()
