"""
Email transport plugin registry.

Allows communications service to integrate with multiple delivery backends.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:  # pragma: no cover
    from ..email_service import EmailMessage, EmailService


class EmailTransport(Protocol):
    """Protocol describing an email transport implementation."""

    async def send(
        self,
        service: EmailService,
        message: EmailMessage,
        message_id: str,
    ) -> None:
        """Perform the actual delivery for an email message."""


class EmailTransportPlugin(Protocol):
    """Plugin responsible for providing an EmailTransport instance."""

    plugin_id: str

    def create_transport(self, service: EmailService) -> EmailTransport:
        """Create a transport instance bound to a given EmailService."""


_registry: dict[str, EmailTransportPlugin] = {}
_builtin_registered = False


def register_plugin(plugin: EmailTransportPlugin) -> None:
    """Register an email transport plugin."""
    _registry[plugin.plugin_id] = plugin


def get_plugin(plugin_id: str) -> EmailTransportPlugin | None:
    """Retrieve a plugin by identifier."""
    return _registry.get(plugin_id)


def list_plugins() -> list[str]:
    """List the identifiers of registered plugins."""
    return sorted(_registry.keys())


def register_builtin_plugins() -> None:
    """Ensure builtin transports are registered exactly once."""
    global _builtin_registered
    if _builtin_registered:
        return

    from . import smtp  # noqa: F401  (registers builtin SMTP transport)

    _builtin_registered = True


__all__ = [
    "EmailTransport",
    "EmailTransportPlugin",
    "register_plugin",
    "get_plugin",
    "list_plugins",
    "register_builtin_plugins",
]
