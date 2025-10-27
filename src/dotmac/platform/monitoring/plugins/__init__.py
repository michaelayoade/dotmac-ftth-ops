"""
Alert channel plugin registry.

Plugins allow additional delivery mechanisms (Slack, Teams, custom webhooks, etc.)
to be provided by core modules or external packages.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

import httpx

if TYPE_CHECKING:  # pragma: no cover - type checking only
    from dotmac.platform.monitoring.alert_webhook_router import Alert, AlertChannel


class AlertChannelPlugin(Protocol):
    """Contract for alert channel delivery plugins."""

    plugin_id: str

    def validate(self, channel: AlertChannel) -> None:
        """Validate the supplied channel configuration."""

    async def send(
        self,
        alert: Alert,
        channel: AlertChannel,
        client: httpx.AsyncClient,
    ) -> bool:
        """Deliver the alert using the provided HTTP client."""


_registry: dict[str, AlertChannelPlugin] = {}
_builtin_registered = False


def register_plugin(plugin: AlertChannelPlugin) -> None:
    """Register an alert channel plugin."""
    _registry[plugin.plugin_id] = plugin


def get_plugin(plugin_id: str) -> AlertChannelPlugin | None:
    """Retrieve a plugin by identifier."""
    return _registry.get(plugin_id)


def list_plugins() -> list[str]:
    """Return the list of known plugin identifiers."""
    return sorted(_registry.keys())


def register_builtin_plugins() -> None:
    """Ensure builtin plugins are registered exactly once."""
    global _builtin_registered
    if _builtin_registered:
        return

    from . import builtin  # noqa: F401  (import registers plugins)

    _builtin_registered = True


__all__ = [
    "AlertChannelPlugin",
    "register_plugin",
    "get_plugin",
    "list_plugins",
    "register_builtin_plugins",
]
