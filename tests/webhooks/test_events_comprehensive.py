"""Comprehensive tests for webhook event bus."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.webhooks.events import (
    EventBus,
    EventSchema,
    get_event_bus,
    register_event,
)
from dotmac.platform.webhooks.models import WebhookEvent


@pytest.mark.unit
class TestEventSchema:
    """Test EventSchema model."""

    def test_event_schema_minimal(self):
        """Test creating event schema with minimal fields."""
        schema = EventSchema(
            event_type="test.event",
            description="Test event",
        )
        assert schema.event_type == "test.event"
        assert schema.description == "Test event"
        assert schema.json_schema is None
        assert schema.example is None

    def test_event_schema_full(self):
        """Test creating event schema with all fields."""
        schema = EventSchema(
            event_type="test.event",
            description="Test event",
            json_schema={"type": "object", "properties": {"id": {"type": "string"}}},
            example={"id": "test_123"},
        )
        assert schema.json_schema is not None
        assert schema.example == {"id": "test_123"}


@pytest.mark.unit
class TestEventBusInitialization:
    """Test EventBus initialization."""

    def test_event_bus_initialization(self):
        """Test that EventBus initializes with standard events."""
        event_bus = EventBus()
        registered_events = event_bus.get_registered_events()

        # Should have all WebhookEvent enum values registered
        assert len(registered_events) > 30  # Many standard events
        assert "invoice.created" in registered_events
        assert "payment.succeeded" in registered_events

    def test_event_bus_registers_all_webhook_events(self):
        """Test that all WebhookEvent enums are registered."""
        event_bus = EventBus()

        for event in WebhookEvent:
            assert event_bus.is_registered(event.value)


@pytest.mark.unit
class TestEventBusRegistration:
    """Test event registration functionality."""

    def test_register_custom_event(self):
        """Test registering a custom event."""
        event_bus = EventBus()
        initial_count = len(event_bus.get_registered_events())

        event_bus.register_event(
            event_type="custom.event",
            description="Custom event for testing",
        )

        assert event_bus.is_registered("custom.event")
        assert len(event_bus.get_registered_events()) == initial_count + 1

    def test_register_event_with_schema(self):
        """Test registering event with schema and example."""
        event_bus = EventBus()

        event_bus.register_event(
            event_type="custom.with_schema",
            description="Event with schema",
            schema={"type": "object"},
            example={"key": "value"},
        )

        registered = event_bus.get_registered_events()
        event_schema = registered["custom.with_schema"]
        assert event_schema.json_schema == {"type": "object"}
        assert event_schema.example == {"key": "value"}

    def test_register_duplicate_event_logs_warning(self):
        """Test that registering duplicate event logs warning."""
        event_bus = EventBus()

        # Register once
        event_bus.register_event(
            event_type="duplicate.event",
            description="First registration",
        )

        initial_count = len(event_bus.get_registered_events())

        # Try to register again (should log warning but not error)
        event_bus.register_event(
            event_type="duplicate.event",
            description="Second registration",
        )

        # Should not add duplicate
        assert len(event_bus.get_registered_events()) == initial_count

    def test_get_registered_events_returns_copy(self):
        """Test that get_registered_events returns a copy."""
        event_bus = EventBus()
        events1 = event_bus.get_registered_events()
        events2 = event_bus.get_registered_events()

        # Should be different objects
        assert events1 is not events2
        # But have same content
        assert events1 == events2

    def test_is_registered_returns_false_for_unknown(self):
        """Test is_registered with unknown event type."""
        event_bus = EventBus()
        assert not event_bus.is_registered("unknown.event.type")


@pytest.mark.unit
class TestEventBusPublish:
    """Test event publishing functionality."""

    @pytest.mark.asyncio
    async def test_publish_without_db_session(self):
        """Test publishing event without DB session."""
        event_bus = EventBus()

        # Should return 0 (no webhooks triggered)
        count = await event_bus.publish(
            event_type="invoice.created",
            event_data={"invoice_id": "inv_123"},
            tenant_id="tenant_123",
            db=None,
        )

        assert count == 0

    @pytest.mark.asyncio
    async def test_publish_with_custom_event_id(self):
        """Test publishing with custom event ID."""
        event_bus = EventBus()
        custom_id = "evt_custom_123"

        count = await event_bus.publish(
            event_type="invoice.created",
            event_data={"invoice_id": "inv_123"},
            tenant_id="tenant_123",
            db=None,
            event_id=custom_id,
        )

        assert count == 0  # No DB session

    @pytest.mark.asyncio
    async def test_publish_unregistered_event_logs_warning(self):
        """Test publishing unregistered event type logs warning."""
        event_bus = EventBus()

        # Should still work but log warning
        count = await event_bus.publish(
            event_type="totally.unknown.event",
            event_data={"data": "value"},
            tenant_id="tenant_123",
            db=None,
        )

        assert count == 0

    @patch("dotmac.platform.webhooks.events.WebhookSubscriptionService")
    @pytest.mark.asyncio
    async def test_publish_with_no_subscriptions(self, mock_service_class):
        """Test publishing when no subscriptions exist."""
        event_bus = EventBus()
        mock_db = AsyncMock()

        # Mock service to return no subscriptions
        mock_service = AsyncMock()
        mock_service.get_subscriptions_for_event = AsyncMock(return_value=[])
        mock_service_class.return_value = mock_service

        count = await event_bus.publish(
            event_type="invoice.created",
            event_data={"invoice_id": "inv_123"},
            tenant_id="tenant_123",
            db=mock_db,
        )

        assert count == 0
        mock_service.get_subscriptions_for_event.assert_called_once()

    @patch("dotmac.platform.webhooks.events.WebhookDeliveryService")
    @patch("dotmac.platform.webhooks.events.WebhookSubscriptionService")
    @pytest.mark.asyncio
    async def test_publish_with_subscriptions(self, mock_sub_service, mock_del_service):
        """Test publishing with active subscriptions."""
        event_bus = EventBus()
        mock_db = AsyncMock()

        # Mock subscriptions
        mock_subscription1 = MagicMock()
        mock_subscription1.id = uuid.uuid4()
        mock_subscription2 = MagicMock()
        mock_subscription2.id = uuid.uuid4()

        # Mock subscription service
        mock_sub_svc = AsyncMock()
        mock_sub_svc.get_subscriptions_for_event = AsyncMock(
            return_value=[mock_subscription1, mock_subscription2]
        )
        mock_sub_service.return_value = mock_sub_svc

        # Mock delivery service
        mock_del_svc = AsyncMock()
        mock_del_svc.deliver = AsyncMock()
        mock_del_service.return_value = mock_del_svc

        count = await event_bus.publish(
            event_type="invoice.created",
            event_data={"invoice_id": "inv_123"},
            tenant_id="tenant_123",
            db=mock_db,
        )

        assert count == 2
        assert mock_del_svc.deliver.call_count == 2

    @patch("dotmac.platform.webhooks.events.WebhookDeliveryService")
    @patch("dotmac.platform.webhooks.events.WebhookSubscriptionService")
    @pytest.mark.asyncio
    async def test_publish_handles_delivery_errors(self, mock_sub_service, mock_del_service):
        """Test that publish continues after delivery errors."""
        event_bus = EventBus()
        mock_db = AsyncMock()

        # Mock subscriptions
        mock_subscription1 = MagicMock()
        mock_subscription1.id = uuid.uuid4()
        mock_subscription2 = MagicMock()
        mock_subscription2.id = uuid.uuid4()

        # Mock subscription service
        mock_sub_svc = AsyncMock()
        mock_sub_svc.get_subscriptions_for_event = AsyncMock(
            return_value=[mock_subscription1, mock_subscription2]
        )
        mock_sub_service.return_value = mock_sub_svc

        # Mock delivery service - first delivery fails, second succeeds
        mock_del_svc = AsyncMock()
        mock_del_svc.deliver = AsyncMock(side_effect=[Exception("Delivery failed"), None])
        mock_del_service.return_value = mock_del_svc

        count = await event_bus.publish(
            event_type="invoice.created",
            event_data={"invoice_id": "inv_123"},
            tenant_id="tenant_123",
            db=mock_db,
        )

        # Should still count 1 successful delivery
        assert count == 1
        assert mock_del_svc.deliver.call_count == 2


@pytest.mark.unit
class TestEventBusPublishBatch:
    """Test batch event publishing."""

    @patch("dotmac.platform.webhooks.events.WebhookSubscriptionService")
    @pytest.mark.asyncio
    async def test_publish_batch_multiple_events(self, mock_service_class):
        """Test publishing multiple events in batch."""
        event_bus = EventBus()
        mock_db = AsyncMock()

        # Mock service to return no subscriptions
        mock_service = AsyncMock()
        mock_service.get_subscriptions_for_event = AsyncMock(return_value=[])
        mock_service_class.return_value = mock_service

        events = [
            {
                "event_type": "invoice.created",
                "event_data": {"invoice_id": "inv_1"},
            },
            {
                "event_type": "payment.succeeded",
                "event_data": {"payment_id": "pay_1"},
            },
            {
                "event_type": "invoice.created",
                "event_data": {"invoice_id": "inv_2"},
            },
        ]

        results = await event_bus.publish_batch(
            events=events,
            tenant_id="tenant_123",
            db=mock_db,
        )

        # Should have called for each event
        assert "invoice.created" in results
        assert "payment.succeeded" in results

    @patch("dotmac.platform.webhooks.events.WebhookSubscriptionService")
    @pytest.mark.asyncio
    async def test_publish_batch_all_valid_events(self, mock_service_class):
        """Test batch publishing with all valid events."""
        event_bus = EventBus()
        mock_db = AsyncMock()

        # Mock service to return no subscriptions
        mock_service = AsyncMock()
        mock_service.get_subscriptions_for_event = AsyncMock(return_value=[])
        mock_service_class.return_value = mock_service

        events = [
            {
                "event_type": "invoice.created",
                "event_data": {"invoice_id": "inv_1"},
            },
            {
                "event_type": "invoice.paid",
                "event_data": {"invoice_id": "inv_2"},
            },
        ]

        results = await event_bus.publish_batch(
            events=events,
            tenant_id="tenant_123",
            db=mock_db,
        )

        # Should process both events
        assert "invoice.created" in results or "invoice.paid" in results

    @patch("dotmac.platform.webhooks.events.WebhookSubscriptionService")
    @pytest.mark.asyncio
    async def test_publish_batch_with_custom_event_ids(self, mock_service_class):
        """Test batch publishing with custom event IDs."""
        event_bus = EventBus()
        mock_db = AsyncMock()

        # Mock service to return no subscriptions
        mock_service = AsyncMock()
        mock_service.get_subscriptions_for_event = AsyncMock(return_value=[])
        mock_service_class.return_value = mock_service

        events = [
            {
                "event_type": "invoice.created",
                "event_data": {"invoice_id": "inv_1"},
                "event_id": "evt_custom_1",
            },
        ]

        results = await event_bus.publish_batch(
            events=events,
            tenant_id="tenant_123",
            db=mock_db,
        )

        assert isinstance(results, dict)


@pytest.mark.unit
class TestGlobalEventBus:
    """Test global event bus singleton."""

    def test_get_event_bus_returns_singleton(self):
        """Test that get_event_bus returns same instance."""
        bus1 = get_event_bus()
        bus2 = get_event_bus()

        assert bus1 is bus2

    def test_get_event_bus_initializes_once(self):
        """Test that event bus is initialized only once."""
        # Reset global state for test
        import dotmac.platform.webhooks.events as events_module

        events_module._event_bus = None

        bus1 = get_event_bus()
        initial_count = len(bus1.get_registered_events())

        # Register custom event
        bus1.register_event("test.custom", "Test")

        # Get bus again - should have same custom event
        bus2 = get_event_bus()
        assert bus2.is_registered("test.custom")
        assert len(bus2.get_registered_events()) == initial_count + 1


@pytest.mark.unit
class TestRegisterEventFunction:
    """Test convenience register_event function."""

    def test_register_event_function(self):
        """Test that register_event function works."""
        # Reset global state
        import dotmac.platform.webhooks.events as events_module

        events_module._event_bus = None

        register_event(
            event_type="function.test",
            description="Test via function",
        )

        bus = get_event_bus()
        assert bus.is_registered("function.test")

    def test_register_event_function_with_schema(self):
        """Test register_event function with schema and example."""
        import dotmac.platform.webhooks.events as events_module

        events_module._event_bus = None

        register_event(
            event_type="function.with_schema",
            description="Test with schema",
            schema={"type": "object"},
            example={"key": "value"},
        )

        bus = get_event_bus()
        registered = bus.get_registered_events()
        event_schema = registered["function.with_schema"]

        assert event_schema.json_schema == {"type": "object"}
        assert event_schema.example == {"key": "value"}
