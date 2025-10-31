"""
File storage module with multiple backend support.
"""

from .minio_storage import FileInfo, MinIOStorage, get_storage, reset_storage
from .plugins import (
    list_plugins as list_storage_plugins,
)
from .plugins import (
    register_plugin as register_storage_plugin,
)
from .router import file_storage_router, storage_router
from .service import (
    FileMetadata,
    FileStorageService,
    LocalFileStorage,
    MemoryFileStorage,
    MinIOFileStorage,
    StorageBackend,
    get_storage_service,
)

__all__ = [
    # MinIO specific
    "MinIOStorage",
    "FileInfo",
    "get_storage",
    "reset_storage",
    # Service and backends
    "StorageBackend",
    "FileMetadata",
    "FileStorageService",
    "LocalFileStorage",
    "MemoryFileStorage",
    "MinIOFileStorage",
    "get_storage_service",
    "register_storage_plugin",
    "list_storage_plugins",
    # Router
    "file_storage_router",
    "storage_router",
]
