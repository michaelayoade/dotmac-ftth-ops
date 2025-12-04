"""
Integration between domain events and the integration event bus.

Domain events (in-process) can be published as integration events
(cross-process) for communication between bounded contexts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import structlog

from dotmac.platform.core.domain_event_dispatcher import get_domain_event_dispatcher
from dotmac.platform.core.events import DomainEvent
from dotmac.platform.events import EventBus, EventPriority, get_event_bus

if TYPE_CHECKING:
    from dotmac.platform.core.aggregate_root import AggregateRoot

logger = structlog.get_logger(__name__)


class DomainEventPublisher:
    """
    Publishes domain events to both the domain dispatcher and integration event bus.

    This bridges domain events (DDD) with integration events (event-driven architecture).

    Usage:
        publisher = DomainEventPublisher()

        # Dispatch domain events from aggregate
        invoice = Invoice(...)
        invoice.pay(...)
        await publisher.publish_from_aggregate(invoice)

        # Or publish single event
        event = InvoiceCreatedEvent(...)
        await publisher.publish_domain_event(event)
    """

    def __init__(
        self,
        event_bus: EventBus | None = None,
        publish_to_integration_bus: bool = True,
    ):
        """
        Initialize publisher.

        Args:
            event_bus: Integration event bus (optional, uses global if not provided)
            publish_to_integration_bus: Whether to publish to integration bus
        """
        self._event_bus = event_bus
        self._dispatcher = get_domain_event_dispatcher()
        self._publish_to_integration = publish_to_integration_bus

    async def publish_from_aggregate(
        self,
        aggregate: AggregateRoot,
        clear_events: bool = True,
    ) -> None:
        """
        Publish all domain events from an aggregate root.

        This method:
        1. Dispatches events to domain event handlers (in-process)
        2. Publishes events to integration event bus (cross-process)
        3. Clears events from aggregate

        Args:
            aggregate: Aggregate root with domain events
            clear_events: Whether to clear events after publishing
        """
        events = list(aggregate.get_domain_events())

        if not events:
            return

        logger.info(
            "Publishing domain events from aggregate",
            aggregate_type=aggregate.__class__.__name__,
            aggregate_id=aggregate.id,
            event_count=len(events),
        )

        # Dispatch to domain handlers first (in-process)
        await self._dispatcher.dispatch_all(events)

        # Publish to integration event bus (cross-process)
        if self._publish_to_integration:
            await self._publish_to_event_bus(events)

        # Clear events from aggregate
        if clear_events:
            aggregate.clear_domain_events()

        # Increment version for optimistic locking
        aggregate.increment_version()

    async def publish_domain_event(
        self,
        event: DomainEvent,
        publish_to_integration: bool | None = None,
    ) -> None:
        """
        Publish a single domain event.

        Args:
            event: Domain event to publish
            publish_to_integration: Override integration bus publishing
        """
        # Dispatch to domain handlers
        await self._dispatcher.dispatch(event)

        # Publish to integration event bus
        should_publish = (
            publish_to_integration
            if publish_to_integration is not None
            else self._publish_to_integration
        )

        if should_publish:
            await self._publish_to_event_bus([event])

    async def _publish_to_event_bus(self, events: list[DomainEvent]) -> None:
        """
        Publish domain events to the integration event bus.

        Maps domain event fields to integration event format.

        Args:
            events: List of domain events to publish
        """
        if not events:
            return

        event_bus = self._event_bus or get_event_bus()

        for domain_event in events:
            # Map domain event to integration event
            await event_bus.publish(
                event_type=self._map_event_type(domain_event),
                payload=self._map_event_payload(domain_event),
                metadata={
                    "tenant_id": domain_event.tenant_id,
                    "correlation_id": domain_event.metadata.get("correlation_id"),
                    "causation_id": domain_event.metadata.get("causation_id"),
                    "source": "domain",
                    "aggregate_id": domain_event.aggregate_id,
                    "aggregate_type": domain_event.aggregate_type,
                },
                priority=self._map_event_priority(domain_event),
            )

            logger.debug(
                "Domain event published to integration bus",
                event_type=domain_event.event_type,
                event_id=domain_event.event_id,
            )

    def _map_event_type(self, event: DomainEvent) -> str:
        """
        Map domain event type to integration event type.

        Example: InvoiceCreatedEvent -> invoice.created

        Args:
            event: Domain event

        Returns:
            Integration event type string
        """
        # Convert from PascalCase to dot.notation
        # InvoiceCreatedEvent -> invoice.created.event
        event_name = event.event_type

        # Remove "Event" suffix if present
        if event_name.endswith("Event"):
            event_name = event_name[:-5]

        # Convert PascalCase to snake_case
        import re

        snake_case = re.sub(r"(?<!^)(?=[A-Z])", "_", event_name).lower()

        # Convert to dot notation
        parts = snake_case.split("_")

        # Group by aggregate type
        if event.aggregate_type:
            aggregate = event.aggregate_type.lower()
            action = "_".join(parts)
            return f"{aggregate}.{action}"

        return ".".join(parts)

    def _map_event_payload(self, event: DomainEvent) -> dict[str, Any]:
        """
        Map domain event to integration event payload.

        Args:
            event: Domain event

        Returns:
            Integration event payload
        """
        # Start with event data
        payload = dict(event.data)

        # Add domain event fields (excluding infrastructure fields)
        event_dict = event.model_dump(
            exclude={
                "event_id",
                "event_type",
                "aggregate_id",
                "aggregate_type",
                "tenant_id",
                "timestamp",
                "sequence",
                "data",
                "metadata",
            }
        )

        payload.update(event_dict)

        # Add key identifiers
        payload["_domain_event_id"] = event.event_id
        payload["_aggregate_id"] = event.aggregate_id
        payload["_aggregate_type"] = event.aggregate_type

        return payload

    def _map_event_priority(self, event: DomainEvent) -> EventPriority:
        """
        Map domain event to integration event priority.

        Args:
            event: Domain event

        Returns:
            Event priority
        """
        # Default priority based on event type
        event_type = event.event_type.lower()

        if "failed" in event_type or "error" in event_type:
            return EventPriority.CRITICAL

        if "payment" in event_type or "refund" in event_type:
            return EventPriority.HIGH

        if "created" in event_type or "updated" in event_type:
            return EventPriority.HIGH

        return EventPriority.NORMAL


# Global publisher instance
_publisher: DomainEventPublisher | None = None


def get_domain_event_publisher(
    event_bus: EventBus | None = None,
    publish_to_integration_bus: bool = True,
) -> DomainEventPublisher:
    """
    Get or create the global domain event publisher.

    Args:
        event_bus: Integration event bus (optional)
        publish_to_integration_bus: Whether to publish to integration bus

    Returns:
        DomainEventPublisher instance
    """
    global _publisher

    if _publisher is None:
        _publisher = DomainEventPublisher(
            event_bus=event_bus,
            publish_to_integration_bus=publish_to_integration_bus,
        )
        logger.info("Domain event publisher initialized")

    return _publisher


def reset_domain_event_publisher() -> None:
    """Reset global publisher (useful for testing)."""
    global _publisher
    _publisher = None
    logger.info("Domain event publisher reset")
