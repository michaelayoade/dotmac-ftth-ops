"""
Test Cleanup Registry

Provides a centralized registry for managing test cleanup handlers.
This ensures proper cleanup order and prevents resource leaks.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from enum import IntEnum
from typing import Any

logger = logging.getLogger(__name__)


class CleanupPriority(IntEnum):
    """Priority levels for cleanup handlers.

    Lower numbers run first (for dependencies that others rely on).
    Higher numbers run last (for things that depend on others).
    """

    # Run first - these are foundational
    DATABASE = 10
    CACHE = 20

    # Run middle - application level
    FASTAPI_APPS = 30
    EVENT_HANDLERS = 40
    BACKGROUND_TASKS = 50

    # Run last - external resources
    HTTP_CLIENTS = 60
    FILE_HANDLES = 70
    NETWORK_CONNECTIONS = 80


class CleanupRegistry:
    """Registry for test cleanup handlers.

    Example usage:
        # In a fixture
        @pytest.fixture
        def my_resource(cleanup_registry):
            resource = create_resource()

            # Register cleanup
            cleanup_registry.register(
                lambda: resource.close(),
                priority=CleanupPriority.FILE_HANDLES,
                name="my_resource"
            )

            return resource

    Or using context manager:
        with cleanup_registry.register_context(resource.close):
            # Test code
            pass
        # Automatically cleaned up
    """

    def __init__(self):
        self._handlers: list[tuple[CleanupPriority, str, Callable[[], None]]] = []
        self._cleaned_up = False

    def register(
        self,
        handler: Callable[[], None],
        priority: CleanupPriority = CleanupPriority.FASTAPI_APPS,
        name: str | None = None,
    ) -> None:
        """Register a cleanup handler.

        Args:
            handler: Callable to execute during cleanup
            priority: When to run (lower = earlier)
            name: Optional name for debugging
        """
        if self._cleaned_up:
            logger.warning(
                "Attempting to register cleanup handler after cleanup has run: %s",
                name or handler.__name__,
            )
            return

        handler_name = name or getattr(handler, "__name__", "unknown")
        self._handlers.append((priority, handler_name, handler))
        logger.debug("Registered cleanup handler: %s (priority=%d)", handler_name, priority)

    def register_fastapi_app(self, app: Any) -> None:
        """Convenience method to register FastAPI app cleanup.

        Args:
            app: FastAPI application instance
        """

        def cleanup():
            if hasattr(app, "dependency_overrides"):
                app.dependency_overrides.clear()
                logger.debug("Cleared dependency overrides for FastAPI app")

        self.register(cleanup, priority=CleanupPriority.FASTAPI_APPS, name=f"fastapi_app_{id(app)}")

    def register_event_bus_cleanup(self, event_bus: Any) -> None:
        """Convenience method to register event bus cleanup.

        Args:
            event_bus: Event bus instance
        """

        def cleanup():
            if hasattr(event_bus, "clear_handlers"):
                event_bus.clear_handlers()
                logger.debug("Cleared event bus handlers")

        self.register(
            cleanup, priority=CleanupPriority.EVENT_HANDLERS, name=f"event_bus_{id(event_bus)}"
        )

    def cleanup_all(self) -> None:
        """Execute all registered cleanup handlers.

        Handlers are executed in priority order (lowest to highest).
        Exceptions in handlers are logged but don't stop other cleanups.
        """
        if self._cleaned_up:
            logger.debug("Cleanup already executed, skipping")
            return

        # Sort by priority (lowest first)
        sorted_handlers = sorted(self._handlers, key=lambda x: x[0])

        logger.debug("Running %d cleanup handlers", len(sorted_handlers))

        for priority, name, handler in sorted_handlers:
            try:
                logger.debug("Running cleanup: %s (priority=%d)", name, priority)
                handler()
            except Exception as e:
                logger.error("Error during cleanup of %s: %s", name, str(e), exc_info=True)

        self._handlers.clear()
        self._cleaned_up = True
        logger.debug("All cleanup handlers executed")

    def reset(self) -> None:
        """Reset the registry (for testing the registry itself)."""
        self._handlers.clear()
        self._cleaned_up = False

    def __len__(self) -> int:
        """Return number of registered handlers."""
        return len(self._handlers)

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - runs cleanup."""
        self.cleanup_all()
        return False  # Don't suppress exceptions


# Global registry instance (will be reset per test)
_registry: CleanupRegistry | None = None


def get_cleanup_registry() -> CleanupRegistry:
    """Get the current test's cleanup registry.

    Returns:
        CleanupRegistry instance for current test
    """
    global _registry
    if _registry is None:
        _registry = CleanupRegistry()
    return _registry


def reset_cleanup_registry() -> None:
    """Reset the global cleanup registry.

    Called automatically by the cleanup_registry fixture.
    """
    global _registry
    if _registry is not None:
        _registry.cleanup_all()
    _registry = CleanupRegistry()
