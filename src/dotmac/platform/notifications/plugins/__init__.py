"""Notification channel plugin registry."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol

from ..models import NotificationChannel

if TYPE_CHECKING:
    from ..channels.base import NotificationChannelProvider


class NotificationChannelPlugin(Protocol):
    """Contract for extending notification delivery channels."""

    plugin_id: str
    channel: NotificationChannel
    provider_class: type[NotificationChannelProvider]

    def build_config(self) -> dict[str, Any]:
        """Return provider configuration derived from settings/environment."""

    def create_provider(self, config: dict[str, Any]) -> NotificationChannelProvider:
        """Instantiate and return a NotificationChannelProvider."""


_registry: dict[NotificationChannel, NotificationChannelPlugin] = {}
_builtin_registered = False


def register_plugin(plugin: NotificationChannelPlugin) -> None:
    """Register a channel plugin."""
    _registry[plugin.channel] = plugin


def get_plugin(channel: NotificationChannel) -> NotificationChannelPlugin | None:
    """Lookup plugin for a specific channel."""
    return _registry.get(channel)


def list_plugins() -> list[str]:
    """List registered plugin identifiers."""
    return sorted(plugin.plugin_id for plugin in _registry.values())


def register_builtin_plugins() -> None:
    """Import builtin plugins once."""
    global _builtin_registered
    if _builtin_registered:
        return

    from . import builtin  # noqa: F401

    _builtin_registered = True


__all__ = [
    "NotificationChannelPlugin",
    "register_plugin",
    "get_plugin",
    "list_plugins",
    "register_builtin_plugins",
]
