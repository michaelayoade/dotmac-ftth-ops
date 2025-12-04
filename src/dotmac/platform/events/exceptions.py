"""Event-related exceptions."""


class EventError(Exception):
    """Base exception for event-related errors."""


class EventValidationError(EventError):
    """Raised when event data validation fails."""


class EventHandlerError(EventError):
    """Raised when an event handler encounters an error."""


class EventPublishError(EventError):
    """Raised when event publishing fails."""


class EventNotFoundError(EventError):
    """Raised when an event is not found in storage."""
