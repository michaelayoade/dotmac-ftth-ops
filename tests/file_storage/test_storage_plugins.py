"""Tests for file storage backend plugin system."""

from __future__ import annotations

import pytest

from dotmac.platform.file_storage.factory import get_storage_backend
from dotmac.platform.file_storage.plugins import register_plugin
from dotmac.platform.file_storage.service import FileStorageService

pytestmark = pytest.mark.unit


class _DummyStorageBackend:
    async def store(self, *args, **kwargs):  # pragma: no cover - interface stub
        return "dummy"

    async def retrieve(self, *args, **kwargs):
        return b"", {}

    async def delete(self, *args, **kwargs):
        return True

    async def list_files(self, *args, **kwargs):
        return []

    async def get_metadata(self, *args, **kwargs):
        return {}


class _DummyStoragePlugin:
    plugin_id = "storage.dummy"
    aliases = ()

    def create_backend(self):
        return _DummyStorageBackend()


@pytest.mark.asyncio
async def test_custom_storage_plugin_used():
    register_plugin(_DummyStoragePlugin())
    backend, provider = get_storage_backend("storage.dummy")
    assert isinstance(backend, _DummyStorageBackend)
    assert provider == "storage.dummy"

    service = FileStorageService(backend="storage.dummy")
    assert isinstance(service.backend, _DummyStorageBackend)
