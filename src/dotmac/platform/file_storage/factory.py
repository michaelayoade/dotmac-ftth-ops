"""
Storage backend factory.

Provides a single helper for selecting the appropriate storage backend based
on environment configuration. In tests we default to the local in-memory
implementation so we do not require a running MinIO service.
"""

from __future__ import annotations

import os
from typing import Protocol

from .plugins import get_plugin, register_builtin_plugins


class StorageBackend(Protocol):
    """Protocol describing the required backend interface."""

    async def store(
        self,
        file_data: bytes,
        file_name: str,
        content_type: str,
        path: str | None = None,
        metadata: dict[str, object] | None = None,
        tenant_id: str | None = None,
    ) -> str: ...

    async def retrieve(
        self, file_id: str, tenant_id: str | None = None
    ) -> tuple[bytes | None, dict[str, object] | None]: ...

    async def delete(self, file_id: str, tenant_id: str | None = None) -> bool: ...

    async def list_files(
        self,
        path: str | None = None,
        limit: int = 100,
        offset: int = 0,
        tenant_id: str | None = None,
    ) -> list[object]: ...

    async def move(
        self,
        file_id: str,
        destination: str,
        tenant_id: str | None = None,
    ) -> bool: ...

    async def copy(
        self,
        file_id: str,
        destination: str,
        tenant_id: str | None = None,
    ) -> str | None: ...


def _resolve_provider(preferred: str | None) -> str:
    """Determine which provider should be used."""
    if preferred:
        return preferred.lower()

    # Honour explicit STORAGE__PROVIDER if set
    provider = os.getenv("STORAGE__PROVIDER")
    if provider:
        return provider.lower()

    # When running tests, fall back to local storage automatically
    environment = os.getenv("ENVIRONMENT", "").lower()
    if environment == "test":
        return "local"

    return "minio"


def get_storage_backend(preferred: str | None = None) -> tuple[StorageBackend, str]:
    """
    Return a storage backend instance.

    Args:
        preferred: Optional preferred provider name.

    Returns:
        Storage backend instance implementing StorageBackendProtocol.
    """
    register_builtin_plugins()

    provider = _resolve_provider(preferred)

    plugin = get_plugin(provider)
    if not plugin:
        # Fall back to local storage if requested provider unavailable
        plugin = get_plugin("local")
        provider = "local"
        if not plugin:
            raise RuntimeError("Local storage plugin is not registered")

    backend = plugin.create_backend()
    return backend, plugin.plugin_id
