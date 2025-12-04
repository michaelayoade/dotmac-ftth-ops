"""
Event-Driven Architecture for DotMac Platform.

This module provides a robust event bus for decoupling modules through
asynchronous event publishing and subscription.

Key Features:
- Async event publishing and handling
- Type-safe event models
- Event persistence for audit and replay
- Dead letter queue for failed events
- Tenant isolation
- Redis-based pub/sub for distributed systems
"""

from .bus import EventBus, get_event_bus, reset_event_bus
from .decorators import subscribe
from .dependencies import EventBusDep, get_event_bus_dependency
from .exceptions import EventError, EventHandlerError, EventValidationError
from .handlers import register_all_handlers
from .listeners import register_all_listeners
from .models import Event, EventMetadata, EventPriority, EventStatus
from .storage import EventStorage

__all__ = [
    # Core
    "EventBus",
    "get_event_bus",
    "reset_event_bus",
    # Models
    "Event",
    "EventMetadata",
    "EventPriority",
    "EventStatus",
    # Storage
    "EventStorage",
    # Decorators
    "subscribe",
    # Dependencies
    "EventBusDep",
    "get_event_bus_dependency",
    # Handlers & Listeners
    "register_all_handlers",
    "register_all_listeners",
    # Exceptions
    "EventError",
    "EventValidationError",
    "EventHandlerError",
]
