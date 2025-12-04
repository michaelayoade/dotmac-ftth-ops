"""FastAPI dependencies for event bus."""

from typing import Annotated, Any

from fastapi import Depends

from dotmac.platform.events.bus import EventBus, get_event_bus
from dotmac.platform.events.storage import EventStorage


def get_event_bus_dependency(
    redis_client: Any | None = None,  # Will be injected from caching module if needed
) -> EventBus:
    """
    Get event bus instance for dependency injection.

    This dependency can be used in FastAPI endpoints:

    Example:
        @app.post("/api/events")
        async def create_event(
            event_bus: Annotated[EventBus, Depends(get_event_bus_dependency)]
        ):
            await event_bus.publish("event.type", payload={})
    """
    if redis_client is None:
        try:
            from dotmac.platform.core.caching import get_redis

            redis_client = get_redis()
        except Exception:
            # Redis not available, continue without it
            redis_client = None

    return get_event_bus(
        storage=EventStorage(use_redis=redis_client is not None),
        redis_client=redis_client,
        enable_persistence=True,
    )


# Type alias for easier use in FastAPI routes
EventBusDep = Annotated[EventBus, Depends(get_event_bus_dependency)]
