"""
Domain Event Dispatcher.

Manages domain event publishing and subscription within a bounded context.
This is separate from the integration event bus - domain events stay
in-process within the domain layer.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any, Protocol, TypeVar, cast, overload

import structlog

from dotmac.platform.core.events import DomainEvent

logger = structlog.get_logger(__name__)


# Type aliases
EventContra = TypeVar("EventContra", bound=DomainEvent, contravariant=True)
T = TypeVar("T", bound=DomainEvent)


class EventHandler(Protocol[EventContra]):
    """Protocol for async domain event handlers."""

    def __call__(self, __event: EventContra) -> Awaitable[None]: ...


DomainEventHandler = EventHandler[DomainEvent]


def _handler_name(handler: EventHandler[Any]) -> str:
    """Best-effort retrieval of a handler's name for logging."""
    name = getattr(handler, "__name__", None)
    if isinstance(name, str):
        return name
    return handler.__class__.__name__


class DomainEventDispatcher:
    """
    Dispatches domain events to registered handlers.

    This dispatcher is in-process and synchronous (or async within the process).
    It's different from the integration event bus which is for cross-service
    communication.

    Usage:
        dispatcher = DomainEventDispatcher()

        # Register handler
        @dispatcher.subscribe(InvoiceCreatedEvent)
        async def handle_invoice_created(event: InvoiceCreatedEvent):
            # Handle the event
            pass

        # Dispatch event
        event = InvoiceCreatedEvent(...)
        await dispatcher.dispatch(event)

        # Or dispatch multiple events
        await dispatcher.dispatch_all([event1, event2, event3])
    """

    def __init__(self) -> None:
        """Initialize dispatcher."""
        self._handlers: dict[str, list[DomainEventHandler]] = defaultdict(list)
        self._global_handlers: list[DomainEventHandler] = []

    @overload
    def subscribe(
        self,
        event_type: type[T],
    ) -> Callable[[EventHandler[T]], EventHandler[T]]: ...

    @overload
    def subscribe(
        self,
        event_type: str,
    ) -> Callable[[DomainEventHandler], DomainEventHandler]: ...

    def subscribe(
        self,
        event_type: type[T] | str,
    ) -> Callable[[EventHandler[Any]], EventHandler[Any]]:
        """
        Decorator to subscribe a handler to an event type.

        Args:
            event_type: Event class or event type string

        Returns:
            Decorator function

        Example:
            @dispatcher.subscribe(InvoiceCreatedEvent)
            async def handle_invoice(event: InvoiceCreatedEvent):
                pass
        """

        if isinstance(event_type, str):

            def decorator_str(handler: DomainEventHandler) -> DomainEventHandler:
                type_name = event_type
                self._handlers[type_name].append(handler)

                logger.info(
                    "Domain event handler registered",
                    event_type=type_name,
                    handler=_handler_name(handler),
                    total_handlers=len(self._handlers[type_name]),
                )

                return handler

            return decorator_str

        def decorator(handler: EventHandler[T]) -> EventHandler[T]:
            type_name = event_type.__name__
            self._handlers[type_name].append(cast(DomainEventHandler, handler))

            logger.info(
                "Domain event handler registered",
                event_type=type_name,
                handler=_handler_name(handler),
                total_handlers=len(self._handlers[type_name]),
            )

            return handler

        return cast(Callable[[EventHandler[Any]], EventHandler[Any]], decorator)

    def subscribe_all(
        self,
        handler: DomainEventHandler,
    ) -> None:
        """
        Subscribe a handler to ALL domain events.

        Useful for cross-cutting concerns like logging, metrics, etc.

        Args:
            handler: Handler function to call for all events
        """
        self._global_handlers.append(handler)
        logger.info(
            "Global domain event handler registered",
            handler=_handler_name(handler),
        )

    def unsubscribe(
        self,
        event_type: type[T] | str,
        handler: DomainEventHandler,
    ) -> None:
        """
        Unsubscribe a handler from an event type.

        Args:
            event_type: Event class or event type string
            handler: Handler function to remove
        """
        if isinstance(event_type, type):
            type_name = event_type.__name__
        else:
            type_name = event_type

        if type_name in self._handlers:
            try:
                self._handlers[type_name].remove(handler)
                logger.info(
                    "Domain event handler unsubscribed",
                    event_type=type_name,
                    handler=_handler_name(handler),
                )
            except ValueError:
                logger.warning(
                    "Handler not found for unsubscribe",
                    event_type=type_name,
                    handler=_handler_name(handler),
                )

    async def dispatch(self, event: DomainEvent) -> None:
        """
        Dispatch a single domain event to all registered handlers.

        Args:
            event: Domain event to dispatch

        Raises:
            Exception: If any handler fails (can be configured to suppress)
        """
        logger.debug(
            "Dispatching domain event",
            event_type=event.event_type,
            event_id=event.event_id,
            aggregate_id=event.aggregate_id,
            aggregate_type=event.aggregate_type,
        )

        # Get handlers for this specific event type
        handlers = self._handlers.get(event.event_type, [])

        # Combine with global handlers
        all_handlers = handlers + self._global_handlers

        if not all_handlers:
            logger.debug(
                "No handlers registered for domain event",
                event_type=event.event_type,
            )
            return

        # Execute all handlers concurrently
        tasks = [self._execute_handler(handler, event) for handler in all_handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Log any failures
        for handler, result in zip(all_handlers, results, strict=False):
            if isinstance(result, Exception):
                logger.error(
                    "Domain event handler failed",
                    event_type=event.event_type,
                    event_id=event.event_id,
                    handler=_handler_name(handler),
                    error=str(result),
                    exc_info=result,
                )

    async def dispatch_all(self, events: list[DomainEvent]) -> None:
        """
        Dispatch multiple domain events in order.

        Events are dispatched sequentially to maintain causality.

        Args:
            events: List of domain events to dispatch
        """
        if not events:
            return

        logger.debug(
            "Dispatching multiple domain events",
            event_count=len(events),
        )

        for event in events:
            await self.dispatch(event)

    async def _execute_handler(
        self,
        handler: DomainEventHandler,
        event: DomainEvent,
    ) -> None:
        """
        Execute a single event handler.

        Args:
            handler: Handler function
            event: Domain event

        Raises:
            Exception: If handler fails
        """
        try:
            await handler(event)

            logger.debug(
                "Domain event handler completed",
                event_type=event.event_type,
                event_id=event.event_id,
                handler=_handler_name(handler),
            )

        except Exception as e:
            logger.error(
                "Domain event handler failed",
                event_type=event.event_type,
                event_id=event.event_id,
                handler=_handler_name(handler),
                error=str(e),
                exc_info=True,
            )
            raise

    def clear(self) -> None:
        """Clear all registered handlers (useful for testing)."""
        self._handlers.clear()
        self._global_handlers.clear()
        logger.info("All domain event handlers cleared")


# Global dispatcher instance
_dispatcher: DomainEventDispatcher | None = None


def get_domain_event_dispatcher() -> DomainEventDispatcher:
    """
    Get or create the global domain event dispatcher.

    Returns:
        DomainEventDispatcher instance
    """
    global _dispatcher

    if _dispatcher is None:
        _dispatcher = DomainEventDispatcher()
        logger.info("Domain event dispatcher initialized")

    return _dispatcher


def reset_domain_event_dispatcher() -> None:
    """Reset global dispatcher (useful for testing)."""
    global _dispatcher
    _dispatcher = None
    logger.info("Domain event dispatcher reset")
