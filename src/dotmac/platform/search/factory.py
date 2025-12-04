"""
Search backend factory with feature flag integration.

This module provides a factory for creating search backends based on
feature flags and configuration, with clear error messages for missing dependencies.
"""

from typing import TYPE_CHECKING, Any

from ..dependencies import DependencyChecker, require_dependency
from ..settings import settings
from .interfaces import SearchBackend

if TYPE_CHECKING:
    pass


class SearchBackendRegistry:
    """Registry for search backend implementations."""

    def __init__(self) -> None:
        self._backends: dict[str, type[SearchBackend]] = {}
        self._register_core_backends()

    def _register_core_backends(self) -> None:
        """Register core search backends that are always available."""
        # In-memory search is always available
        from .service import InMemorySearchBackend

        self._backends["memory"] = InMemorySearchBackend

    def register_backend(self, name: str, backend_class: type[SearchBackend]) -> None:
        """Register a search backend implementation."""
        self._backends[name] = backend_class

    def get_backend_class(self, name: str) -> type[SearchBackend]:
        """Get backend class by name."""
        if name not in self._backends:
            available = list(self._backends.keys())
            raise ValueError(f"Unknown search backend '{name}'. Available: {available}")
        return self._backends[name]

    def list_available_backends(self) -> list[str]:
        """List all registered search backends."""
        return list(self._backends.keys())

    def list_enabled_backends(self) -> list[str]:
        """List search backends that are enabled via feature flags."""
        enabled = ["memory"]  # Memory is always enabled

        # Check MeiliSearch backend
        if settings.features.search_enabled:
            if DependencyChecker.check_feature_dependency("search_enabled"):
                enabled.append("meilisearch")

        return enabled


# Global registry instance
_registry = SearchBackendRegistry()


# Conditional backend registration based on feature flags and dependencies
def _register_optional_backends() -> None:
    """Register optional search backends if they're enabled and dependencies are available."""

    # MeiliSearch Backend
    if settings.features.search_enabled:
        try:
            DependencyChecker.require_feature_dependency("search_enabled")
            from .service import MeilisearchBackend

            _registry.register_backend("meilisearch", MeilisearchBackend)
        except ImportError:
            # Dependencies not available - will be caught when trying to use
            pass

    # Elasticsearch Backend
    try:
        from .elasticsearch_backend import ElasticsearchBackend

        _registry.register_backend("elasticsearch", ElasticsearchBackend)
    except ImportError:
        # Elasticsearch client not installed
        pass


# Register optional backends on module import
_register_optional_backends()


class SearchBackendFactory:
    """Factory for creating search backend instances."""

    @staticmethod
    def create_backend(backend_type: str | None = None, **kwargs: Any) -> SearchBackend:
        """
        Create a search backend instance.

        Args:
            backend_type: Search backend type. If None, auto-selects based on feature flags
            **kwargs: Additional arguments to pass to backend constructor

        Returns:
            SearchBackend instance

        Raises:
            ValueError: If backend type is unknown or not enabled
            DependencyError: If backend dependencies are missing
        """
        if backend_type is None:
            backend_type = SearchBackendFactory._auto_select_backend()

        # Validate MeiliSearch backend is enabled
        if backend_type == "meilisearch" and not settings.features.search_enabled:
            raise ValueError(
                "MeiliSearch backend selected but not enabled. Set FEATURES__SEARCH_ENABLED=true"
            )

        # Check dependencies before creating
        if backend_type == "meilisearch":
            DependencyChecker.require_feature_dependency("search_enabled")

        # Get backend class and create instance
        backend_class = _registry.get_backend_class(backend_type)
        return backend_class(**kwargs)

    @staticmethod
    def _auto_select_backend() -> str:
        """Auto-select the best available search backend."""
        # Prefer MeiliSearch if enabled and available
        if settings.features.search_enabled and DependencyChecker.check_feature_dependency(
            "search_enabled"
        ):
            return "meilisearch"

        # Default to in-memory backend
        return "memory"

    @staticmethod
    def list_available_backends() -> list[str]:
        """List all available search backends."""
        return _registry.list_available_backends()

    @staticmethod
    def list_enabled_backends() -> list[str]:
        """List search backends that are enabled and have dependencies available."""
        return _registry.list_enabled_backends()

    @staticmethod
    def validate_backend(backend_type: str) -> bool:
        """
        Check if a backend is valid and its dependencies are available.

        Args:
            backend_type: Backend type to validate

        Returns:
            True if backend is valid and dependencies are available
        """
        try:
            SearchBackendFactory.create_backend(backend_type)
            return True
        except (ValueError, ImportError):
            return False


# Convenience functions
def create_search_backend(backend_type: str | None = None, **kwargs: Any) -> SearchBackend:
    """Create a search backend instance. Convenience function."""
    return SearchBackendFactory.create_backend(backend_type, **kwargs)


def get_default_search_backend(**kwargs: Any) -> SearchBackend:
    """Get the default search backend (auto-selected)."""
    return SearchBackendFactory.create_backend(**kwargs)


@require_dependency("search_enabled")
def create_meilisearch_backend(**kwargs: Any) -> SearchBackend:
    """Create a MeiliSearch backend (requires MeiliSearch to be enabled)."""
    return SearchBackendFactory.create_backend("meilisearch", **kwargs)


def create_memory_backend(**kwargs: Any) -> SearchBackend:
    """Create an in-memory search backend (always available)."""
    return SearchBackendFactory.create_backend("memory", **kwargs)


def create_search_backend_from_env(default_backend: str | None = None) -> SearchBackend:
    """
    Create search backend from environment variable.

    Args:
        default_backend: Default backend if SEARCH_BACKEND env var not set

    Returns:
        SearchBackend instance
    """
    import os

    if default_backend is None:
        default_backend = SearchBackendFactory._auto_select_backend()

    backend_type = os.getenv("SEARCH_BACKEND", default_backend).lower()

    if not settings.features.search_enabled:
        if backend_type != "memory":
            raise ValueError(
                "Search functionality is disabled. Enable FEATURES__SEARCH_ENABLED or use memory backend"
            )
        backend_type = "memory"

    return SearchBackendFactory.create_backend(backend_type)
