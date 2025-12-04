"""Event handler decorators."""

from collections.abc import Callable

from dotmac.platform.events.bus import EventHandler, get_event_bus


def subscribe(event_type: str) -> Callable[[EventHandler], EventHandler]:
    """
    Decorator to subscribe a function to an event type.

    Usage:
        @subscribe("invoice.created")
        async def handle_invoice_created(event: Event):
            invoice_id = event.payload["invoice_id"]
            # Process the event
            ...

    Args:
        event_type: Event type to subscribe to

    Returns:
        Decorated handler function
    """

    def decorator(handler: EventHandler) -> EventHandler:
        # Register handler with event bus
        event_bus = get_event_bus()
        event_bus.subscribe(event_type, handler)
        return handler

    return decorator
