"""
Event bus for webhook event publishing and dispatching.
"""

import uuid
from typing import Any

import structlog
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from .delivery import WebhookDeliveryService
from .models import WebhookEvent
from .service import WebhookSubscriptionService

logger = structlog.get_logger(__name__)


class EventSchema(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for registering event types."""

    model_config = ConfigDict()

    event_type: str
    description: str
    json_schema: dict[str, Any] | None = (
        None  # Renamed from 'schema' to avoid shadowing BaseModel.schema()
    )
    example: dict[str, Any] | None = None


class EventBus:
    """
    Central event bus for publishing webhook events.

    Usage:
        from dotmac.platform.webhooks.events import get_event_bus

        # Publish event
        await get_event_bus().publish(
            event_type="invoice.created",
            event_data={"invoice_id": "inv_123", "amount": 100.00},
            tenant_id="tenant_abc"
        )
    """

    def __init__(self) -> None:
        self._registered_events: dict[str, EventSchema] = {}
        self._initialize_standard_events()

    def _initialize_standard_events(self) -> None:
        """Register standard platform events."""
        # Auto-register all WebhookEvent enum values
        for event in WebhookEvent:
            self._registered_events[event.value] = EventSchema(
                event_type=event.value,
                description=f"Standard platform event: {event.value}",
            )

        logger.info(
            "EventBus initialized",
            registered_events=len(self._registered_events),
        )

    def register_event(
        self,
        event_type: str,
        description: str,
        schema: dict[str, Any] | None = None,
        example: dict[str, Any] | None = None,
    ) -> None:
        """
        Register a custom event type.

        Args:
            event_type: Event type identifier (e.g., "custom.event")
            description: Human-readable description
            schema: Optional JSON schema for validation
            example: Optional example payload
        """
        if event_type in self._registered_events:
            logger.warning("Event already registered", event_type=event_type)
            return

        self._registered_events[event_type] = EventSchema(
            event_type=event_type,
            description=description,
            json_schema=schema,
            example=example,
        )

        logger.info("Event registered", event_type=event_type)

    def get_registered_events(self) -> dict[str, EventSchema]:
        """Get all registered event types."""
        return self._registered_events.copy()

    def is_registered(self, event_type: str) -> bool:
        """Check if event type is registered."""
        return event_type in self._registered_events

    async def publish(
        self,
        event_type: str,
        event_data: dict[str, Any],
        tenant_id: str,
        db: AsyncSession | None = None,
        event_id: str | None = None,
    ) -> int:
        """
        Publish an event to all subscribed webhooks.

        Args:
            event_type: Type of event (e.g., "invoice.created")
            event_data: Event payload data
            tenant_id: Tenant ID for multi-tenant isolation
            db: Optional database session (creates new if not provided)
            event_id: Optional event ID for idempotency

        Returns:
            Number of webhooks triggered
        """
        # Validate event type is registered
        if not self.is_registered(event_type):
            logger.warning(
                "Attempted to publish unregistered event type",
                event_type=event_type,
                tenant_id=tenant_id,
            )
            # Still allow publishing for flexibility, but log warning
            pass

        # Generate event ID if not provided
        if event_id is None:
            event_id = str(uuid.uuid4())

        logger.info(
            "Publishing event",
            event_type=event_type,
            event_id=event_id,
            tenant_id=tenant_id,
        )

        # If no DB session provided, we can't deliver webhooks
        # This allows fire-and-forget event publishing
        if db is None:
            logger.debug(
                "No DB session provided, event logged but webhooks not triggered",
                event_type=event_type,
                event_id=event_id,
            )
            return 0

        # Get subscriptions for this event
        subscription_service = WebhookSubscriptionService(db)
        subscriptions = await subscription_service.get_subscriptions_for_event(
            event_type=event_type,
            tenant_id=tenant_id,
        )

        if not subscriptions:
            logger.debug(
                "No webhook subscriptions for event",
                event_type=event_type,
                tenant_id=tenant_id,
            )
            return 0

        # Deliver to each subscription
        delivery_service = WebhookDeliveryService(db)
        delivered_count = 0

        for subscription in subscriptions:
            try:
                await delivery_service.deliver(
                    subscription=subscription,
                    event_type=event_type,
                    event_data=event_data,
                    event_id=event_id,
                    tenant_id=tenant_id,
                )
                delivered_count += 1

            except Exception as e:
                logger.error(
                    "Failed to deliver webhook",
                    subscription_id=str(subscription.id),
                    event_type=event_type,
                    error=str(e),
                )
                # Continue to next subscription

        logger.info(
            "Event published to webhooks",
            event_type=event_type,
            event_id=event_id,
            subscriptions_triggered=delivered_count,
            total_subscriptions=len(subscriptions),
        )

        return delivered_count

    async def publish_batch(
        self,
        events: list[dict[str, Any]],
        tenant_id: str,
        db: AsyncSession,
    ) -> dict[str, int]:
        """
        Publish multiple events in batch.

        Args:
            events: List of event dicts with 'event_type' and 'event_data' keys
            tenant_id: Tenant ID
            db: Database session

        Returns:
            Dictionary mapping event types to number of deliveries
        """
        results: dict[str, int] = {}

        for event in events:
            event_type = event.get("event_type")
            event_data = event.get("event_data", {})
            event_id = event.get("event_id")

            if not event_type:
                logger.warning("Skipping event without event_type", event_payload=event)
                continue

            count = await self.publish(
                event_type=event_type,
                event_data=event_data,
                tenant_id=tenant_id,
                db=db,
                event_id=event_id,
            )

            results[event_type] = results.get(event_type, 0) + count

        return results


# Global event bus instance
_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    """Get the global event bus instance."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


# Preserve reference to the unpatched getter so helper functions can avoid
# accidentally switching to test doubles that may patch get_event_bus later.
_get_event_bus_unpatched = get_event_bus


def register_event(
    event_type: str,
    description: str,
    schema: dict[str, Any] | None = None,
    example: dict[str, Any] | None = None,
) -> None:
    """
    Convenience function to register an event type.

    Args:
        event_type: Event type identifier
        description: Human-readable description
        schema: Optional JSON schema for validation
        example: Optional example payload
    """
    _get_event_bus_unpatched().register_event(
        event_type=event_type,
        description=description,
        schema=schema,
        example=example,
    )
