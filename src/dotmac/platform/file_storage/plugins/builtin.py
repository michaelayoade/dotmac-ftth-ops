"""Builtin file storage backend plugins."""

from __future__ import annotations

from . import StorageBackendPlugin, register_plugin


class LocalStoragePlugin(StorageBackendPlugin):
    plugin_id = "local"
    aliases = ("filesystem",)

    def create_backend(self):
        from ..service import LocalFileStorage

        return LocalFileStorage()


class MemoryStoragePlugin(StorageBackendPlugin):
    plugin_id = "memory"

    def create_backend(self):
        from ..service import MemoryFileStorage

        return MemoryFileStorage()


class MinIOStoragePlugin(StorageBackendPlugin):
    plugin_id = "minio"
    aliases = ("s3",)

    def create_backend(self):
        from ..service import MinIOFileStorage

        return MinIOFileStorage()


register_plugin(LocalStoragePlugin())
register_plugin(MemoryStoragePlugin())
register_plugin(MinIOStoragePlugin())


__all__ = ["LocalStoragePlugin", "MemoryStoragePlugin", "MinIOStoragePlugin"]
