"""File storage backend plugin registry."""

from __future__ import annotations

from typing import Protocol


class StorageBackendPlugin(Protocol):
    """Plugin interface for providing storage backend instances."""

    plugin_id: str
    aliases: tuple[str, ...] | list[str] = ()

    def create_backend(self):
        """Return an instantiated storage backend."""


_registry: dict[str, StorageBackendPlugin] = {}
_builtin_registered = False


def register_plugin(plugin: StorageBackendPlugin) -> None:
    """Register a storage backend plugin (including aliases)."""
    keys = [plugin.plugin_id] + list(getattr(plugin, "aliases", []))
    for key in keys:
        _registry[key.lower()] = plugin


def get_plugin(name: str) -> StorageBackendPlugin | None:
    """Retrieve plugin by identifier or alias."""
    return _registry.get(name.lower())


def list_plugins() -> list[str]:
    """List registered plugin identifiers."""
    return sorted({plugin.plugin_id for plugin in _registry.values()})


def register_builtin_plugins() -> None:
    """Import builtin storage plugins once."""
    global _builtin_registered
    if _builtin_registered:
        return

    from . import builtin  # noqa: F401  (registers builtins on import)

    _builtin_registered = True


__all__ = [
    "StorageBackendPlugin",
    "register_plugin",
    "get_plugin",
    "list_plugins",
    "register_builtin_plugins",
]
