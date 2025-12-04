"""
MinIO storage initialization helper.

Initialize MinIO storage using settings directly.
Integrates with secrets management for secure credential handling.
"""

import structlog

from dotmac.platform.file_storage import MinIOStorage
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


def init_storage() -> MinIOStorage:
    """Initialize MinIO storage from settings.

    Credentials are automatically loaded from Vault/OpenBao via secrets_loader
    if vault.enabled=true. The secrets loader updates settings.storage.access_key
    and settings.storage.secret_key from Vault paths:
    - storage/access_key -> settings.storage.access_key
    - storage/secret_key -> settings.storage.secret_key

    If Vault is disabled, falls back to environment variables or defaults.
    """
    try:
        storage = MinIOStorage(
            endpoint=settings.storage.endpoint,
            access_key=settings.storage.access_key,
            secret_key=settings.storage.secret_key,
            bucket=settings.storage.bucket,
            secure=settings.storage.use_ssl,
        )
        logger.info(
            "MinIO storage initialized",
            endpoint=settings.storage.endpoint or "localhost:9000",
            bucket=settings.storage.bucket or "dotmac",
            using_vault=settings.vault.enabled,
            has_credentials=bool(settings.storage.access_key),
        )
        return storage
    except Exception as e:
        logger.error("Failed to initialize MinIO storage", error=str(e))
        raise


# Global storage instance
_storage: MinIOStorage | None = None


def get_storage() -> MinIOStorage:
    """Get the global MinIO storage instance."""
    global _storage
    if _storage is None:
        _storage = init_storage()
    return _storage


# Usage examples:
#
# # Initialize from settings
# storage = init_storage()
#
# # Use the global instance
# storage = get_storage()
# storage.save_file("test.txt", content_stream, "tenant-123")
#
# # Direct file operations
# storage.save_file_from_path("/local/file.pdf", "documents/file.pdf", "tenant-123")
# storage.get_file_to_path("documents/file.pdf", "/local/download.pdf", "tenant-123")
