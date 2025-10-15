"""
File storage service with multiple backend support.

Provides a unified interface for file storage operations with support for:
- Local filesystem storage
- MinIO/S3 storage
- In-memory storage for testing
"""

import hashlib
import json
import re
import tempfile
import uuid
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Protocol

import structlog
from pydantic import BaseModel, ConfigDict, Field

from ..settings import settings
from .minio_storage import MinIOStorage, get_storage

logger = structlog.get_logger(__name__)


class StorageBackend:
    """Storage backend types."""

    LOCAL = "local"
    S3 = "s3"
    MINIO = "minio"
    MEMORY = "memory"  # For testing


class FileMetadata(BaseModel):  # BaseModel resolves to Any in isolation
    """File metadata."""

    model_config = ConfigDict()

    file_id: str = Field(..., description="Unique file identifier")
    file_name: str = Field(..., description="Original file name")
    file_size: int = Field(..., description="File size in bytes")
    content_type: str = Field(..., description="MIME type")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime | None = Field(None, description="Last update timestamp")
    path: str | None = Field(None, description="Storage path")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    checksum: str | None = Field(None, description="File checksum")
    tenant_id: str | None = Field(None, description="Tenant identifier")

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "file_id": self.file_id,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "content_type": self.content_type,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "path": self.path,
            "metadata": self.metadata,
            "checksum": self.checksum,
            "tenant_id": self.tenant_id,
        }


class LocalFileStorage:
    """Local filesystem storage backend."""

    _SAFE_SEGMENT_RE = re.compile(r"^[A-Za-z0-9_.-]+$")

    def __init__(self, base_path: str | None = None) -> None:
        """Initialize local storage."""
        default_path = Path(tempfile.gettempdir()) / "dotmac-storage"
        base = Path(base_path or settings.storage.local_path or str(default_path))
        base.mkdir(parents=True, exist_ok=True)
        self.base_path = base.resolve()
        self.metadata_path = self.base_path / ".metadata"
        self.metadata_path.mkdir(exist_ok=True)
        logger.info(f"Local storage initialized at {self.base_path}")

    def _sanitize_tenant_id(self, tenant_id: str | None) -> str | None:
        """Ensure tenant identifier is safe for filesystem usage."""
        if tenant_id is None:
            return None
        if not self._SAFE_SEGMENT_RE.match(tenant_id):
            raise ValueError("Invalid tenant identifier.")
        return tenant_id

    @staticmethod
    def _validate_file_id(file_id: str) -> str:
        """Ensure file identifier is a valid UUID string."""
        try:
            uuid.UUID(file_id)
        except ValueError as exc:
            raise ValueError("Invalid file identifier.") from exc
        return file_id

    def _resolve_file_path(self, file_id: str, tenant_id: str | None = None) -> Path:
        """Get full file path within the base directory."""
        tenant_segment = self._sanitize_tenant_id(tenant_id)
        safe_file_id = self._validate_file_id(file_id)
        candidate = self.base_path / safe_file_id
        if tenant_segment:
            candidate = self.base_path / tenant_segment / safe_file_id
        resolved = candidate.resolve(strict=False)
        if resolved == self.base_path or self.base_path not in resolved.parents:
            raise ValueError("Invalid file path.")
        return resolved

    def _resolve_metadata_file_path(self, file_id: str) -> Path:
        """Get metadata file path within metadata directory."""
        safe_file_id = self._validate_file_id(file_id)
        candidate = self.metadata_path / f"{safe_file_id}.json"
        resolved = candidate.resolve(strict=False)
        if resolved == self.metadata_path or self.metadata_path not in resolved.parents:
            raise ValueError("Invalid metadata path.")
        return resolved

    def _get_file_path(self, file_id: str, tenant_id: str | None = None) -> Path:
        """Get full file path."""
        return self._resolve_file_path(file_id, tenant_id)

    def _get_metadata_path(self, file_id: str) -> Path:
        """Get metadata file path."""
        return self._resolve_metadata_file_path(file_id)

    def _save_metadata(self, file_id: str, metadata: FileMetadata) -> None:
        """Save file metadata."""
        metadata_file = self._get_metadata_path(file_id)
        with open(metadata_file, "w") as f:
            json.dump(metadata.to_dict(), f, default=str)

    def _load_metadata(self, file_id: str) -> FileMetadata | None:
        """Load file metadata."""
        metadata_file = self._get_metadata_path(file_id)
        if not metadata_file.exists():
            return None

        try:
            with open(metadata_file) as f:
                data = json.load(f)
                return FileMetadata(
                    file_id=data["file_id"],
                    file_name=data["file_name"],
                    file_size=data["file_size"],
                    content_type=data["content_type"],
                    created_at=datetime.fromisoformat(data["created_at"]),
                    updated_at=(
                        datetime.fromisoformat(data["updated_at"])
                        if data.get("updated_at")
                        else None
                    ),
                    path=data.get("path"),
                    metadata=data.get("metadata", {}),
                    checksum=data.get("checksum"),
                    tenant_id=data.get("tenant_id"),
                )
        except Exception as e:
            logger.error(f"Failed to load metadata for {file_id}: {e}")
            return None

    async def store(
        self,
        file_data: bytes,
        file_name: str,
        content_type: str,
        path: str | None = None,
        metadata: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> str:
        """Store a file."""
        file_id = str(uuid.uuid4())

        # Calculate checksum
        checksum = hashlib.sha256(file_data).hexdigest()

        tenant_id = self._sanitize_tenant_id(tenant_id)

        # Save file
        file_path = self._get_file_path(file_id, tenant_id)
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "wb") as f:
            f.write(file_data)

        # Create and save metadata
        file_metadata = FileMetadata(
            file_id=file_id,
            file_name=file_name,
            file_size=len(file_data),
            content_type=content_type,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            path=path,
            metadata=metadata or {},
            checksum=checksum,
            tenant_id=tenant_id,
        )
        self._save_metadata(file_id, file_metadata)

        logger.info(f"Stored file {file_id} ({file_name}) - {len(file_data)} bytes")
        return file_id

    async def retrieve(
        self, file_id: str, tenant_id: str | None = None
    ) -> tuple[bytes | None, dict[str, Any] | None]:
        """Retrieve a file."""
        tenant_id = self._sanitize_tenant_id(tenant_id)
        file_path = self._get_file_path(file_id, tenant_id)

        if not file_path.exists():
            logger.warning(f"File not found: {file_id}")
            return None, None

        # Load file data
        with open(file_path, "rb") as f:
            file_data = f.read()

        # Load metadata
        metadata = self._load_metadata(file_id)

        if metadata:
            return file_data, metadata.to_dict()
        else:
            # Return basic metadata if metadata file is missing
            return file_data, {
                "file_id": file_id,
                "file_size": len(file_data),
            }

    async def delete(self, file_id: str, tenant_id: str | None = None) -> bool:
        """Delete a file."""
        tenant_id = self._sanitize_tenant_id(tenant_id)
        file_path = self._get_file_path(file_id, tenant_id)
        metadata_path = self._get_metadata_path(file_id)

        deleted = False

        if file_path.exists():
            file_path.unlink()
            deleted = True

        if metadata_path.exists():
            metadata_path.unlink()

        if deleted:
            logger.info(f"Deleted file {file_id}")

        return deleted

    async def list_files(
        self,
        path: str | None = None,
        limit: int = 100,
        offset: int = 0,
        tenant_id: str | None = None,
    ) -> list[FileMetadata]:
        """List files."""
        tenant_id = self._sanitize_tenant_id(tenant_id)
        files = []

        # Get all metadata files
        metadata_files = list(self.metadata_path.glob("*.json"))

        # Sort by modification time (newest first)
        metadata_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)

        # Apply pagination
        start = offset
        end = offset + limit

        for metadata_file in metadata_files[start:end]:
            file_id = metadata_file.stem
            try:
                metadata = self._load_metadata(file_id)
            except ValueError:
                logger.warning("Skipping metadata with invalid identifier", file_id=file_id)
                continue

            if not metadata:
                continue

            if tenant_id and metadata.tenant_id != tenant_id:
                continue

            if path and metadata.path and not metadata.path.startswith(path):
                continue

            files.append(metadata)

        return files

    async def get_metadata(self, file_id: str) -> dict[str, Any] | None:
        """Get file metadata."""
        metadata = self._load_metadata(file_id)
        return metadata.to_dict() if metadata else None


class MemoryFileStorage:
    """In-memory storage backend for testing."""

    def __init__(self) -> None:
        """Initialize memory storage."""
        self.files: dict[str, bytes] = {}
        self.metadata: dict[str, FileMetadata] = {}
        logger.info("Memory storage initialized")

    async def store(
        self,
        file_data: bytes,
        file_name: str,
        content_type: str,
        path: str | None = None,
        metadata: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> str:
        """Store a file in memory."""
        file_id = str(uuid.uuid4())

        # Calculate checksum
        checksum = hashlib.sha256(file_data).hexdigest()

        # Store file data
        self.files[file_id] = file_data

        # Store metadata
        file_metadata = FileMetadata(
            file_id=file_id,
            file_name=file_name,
            file_size=len(file_data),
            content_type=content_type,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            path=path,
            metadata=metadata or {},
            checksum=checksum,
            tenant_id=tenant_id,
        )
        self.metadata[file_id] = file_metadata

        logger.info(f"Stored file {file_id} ({file_name}) in memory - {len(file_data)} bytes")
        return file_id

    async def retrieve(
        self, file_id: str, tenant_id: str | None = None
    ) -> tuple[bytes | None, dict[str, Any] | None]:
        """Retrieve a file from memory."""
        file_data = self.files.get(file_id)
        metadata = self.metadata.get(file_id)

        if file_data and metadata:
            if tenant_id and metadata.tenant_id != tenant_id:
                return None, None
            return file_data, metadata.to_dict()

        return None, None

    async def delete(self, file_id: str, tenant_id: str | None = None) -> bool:
        """Delete a file from memory."""
        metadata = self.metadata.get(file_id)
        if tenant_id and metadata and metadata.tenant_id != tenant_id:
            return False

        deleted = False

        if file_id in self.files:
            del self.files[file_id]
            deleted = True

        if file_id in self.metadata:
            del self.metadata[file_id]

        return deleted

    async def list_files(
        self,
        path: str | None = None,
        limit: int = 100,
        offset: int = 0,
        tenant_id: str | None = None,
    ) -> list[FileMetadata]:
        """List files in memory."""
        files = list(self.metadata.values())

        # Filter by tenant
        if tenant_id:
            files = [f for f in files if f.tenant_id == tenant_id]

        # Filter by path
        if path:
            files = [f for f in files if f.path and f.path.startswith(path)]

        # Sort by creation date (newest first)
        files.sort(key=lambda f: f.created_at, reverse=True)

        # Apply pagination
        return files[offset : offset + limit]

    async def get_metadata(self, file_id: str) -> dict[str, Any] | None:
        """Get file metadata."""
        metadata = self.metadata.get(file_id)
        return metadata.to_dict() if metadata else None


class MinIOFileStorage:
    """MinIO/S3 storage backend wrapper."""

    def __init__(self, minio_client: MinIOStorage | None = None) -> None:
        """Initialize MinIO storage."""
        self.client = minio_client or get_storage()
        self.metadata_store: dict[str, FileMetadata] = {}
        logger.info("MinIO storage initialized")

    async def store(
        self,
        file_data: bytes,
        file_name: str,
        content_type: str,
        path: str | None = None,
        metadata: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> str:
        """Store a file in MinIO."""
        file_id = str(uuid.uuid4())
        tenant_id = tenant_id or "default"

        # Create path
        if path:
            full_path = f"{path}/{file_id}/{file_name}"
        else:
            full_path = f"{file_id}/{file_name}"

        # Store in MinIO
        content = BytesIO(file_data)
        self.client.save_file(
            file_path=full_path,
            content=content,
            tenant_id=tenant_id,
            content_type=content_type,
        )

        # Store metadata (in production, use database)
        checksum = hashlib.sha256(file_data).hexdigest()
        file_metadata = FileMetadata(
            file_id=file_id,
            file_name=file_name,
            file_size=len(file_data),
            content_type=content_type,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            path=path,
            metadata=metadata or {},
            checksum=checksum,
            tenant_id=tenant_id,
        )
        self.metadata_store[file_id] = file_metadata

        logger.info(f"Stored file {file_id} ({file_name}) in MinIO - {len(file_data)} bytes")
        return file_id

    async def retrieve(
        self, file_id: str, tenant_id: str | None = None
    ) -> tuple[bytes | None, dict[str, Any] | None]:
        """Retrieve a file from MinIO."""
        tenant_id = tenant_id or "default"

        # Get metadata
        metadata = self.metadata_store.get(file_id)
        if not metadata or (tenant_id and metadata.tenant_id != tenant_id):
            return None, None

        # Construct path
        if metadata.path:
            full_path = f"{metadata.path}/{file_id}/{metadata.file_name}"
        else:
            full_path = f"{file_id}/{metadata.file_name}"

        try:
            # Retrieve from MinIO
            file_data = self.client.get_file(full_path, tenant_id)
            return file_data, metadata.to_dict()
        except FileNotFoundError:
            logger.warning(f"File not found in MinIO: {file_id}")
            return None, None

    async def delete(self, file_id: str, tenant_id: str | None = None) -> bool:
        """Delete a file from MinIO."""
        tenant_id = tenant_id or "default"

        # Get metadata
        metadata = self.metadata_store.get(file_id)
        if not metadata or (tenant_id and metadata.tenant_id != tenant_id):
            return False

        # Construct path
        if metadata.path:
            full_path = f"{metadata.path}/{file_id}/{metadata.file_name}"
        else:
            full_path = f"{file_id}/{metadata.file_name}"

        # Delete from MinIO
        success = self.client.delete_file(full_path, tenant_id)

        if success:
            del self.metadata_store[file_id]
            logger.info(f"Deleted file {file_id} from MinIO")

        return success

    async def list_files(
        self,
        path: str | None = None,
        limit: int = 100,
        offset: int = 0,
        tenant_id: str | None = None,
    ) -> list[FileMetadata]:
        """List files in MinIO."""
        tenant_id = tenant_id or "default"

        # In production, query from database
        files = list(self.metadata_store.values())

        # Filter by tenant
        if tenant_id:
            files = [f for f in files if f.tenant_id == tenant_id]

        # Filter by path
        if path:
            files = [f for f in files if f.path and f.path.startswith(path)]

        # Sort by creation date (newest first)
        files.sort(key=lambda f: f.created_at, reverse=True)

        # Apply pagination
        return files[offset : offset + limit]

    async def get_metadata(self, file_id: str) -> dict[str, Any] | None:
        """Get file metadata."""
        metadata = self.metadata_store.get(file_id)
        return metadata.to_dict() if metadata else None


class FileStorageService:
    """Unified file storage service with backend selection."""

    def __init__(self, backend: str = StorageBackend.LOCAL) -> None:
        """Initialize storage service with specified backend."""
        self.backend_type = backend
        backend_instance: StorageBackendProtocol

        # Initialize appropriate backend
        if backend == StorageBackend.LOCAL:
            backend_instance = LocalFileStorage()
        elif backend == StorageBackend.MEMORY:
            backend_instance = MemoryFileStorage()
        elif backend == StorageBackend.MINIO or backend == StorageBackend.S3:
            # Try to use MinIO backend
            try:
                # Check if MinIO/S3 dependencies are available
                backend_instance = MinIOFileStorage()
                logger.info("Successfully initialized MinIO/S3 backend")
            except Exception as e:
                logger.error(
                    f"Failed to initialize MinIO backend: {e}",
                    exc_info=True,
                    backend=backend,
                    endpoint=settings.storage.endpoint,
                    bucket=settings.storage.bucket,
                )
                logger.warning("Falling back to local storage due to MinIO initialization failure")
                backend_instance = LocalFileStorage()
                self.backend_type = StorageBackend.LOCAL
        else:
            # Default to local storage
            logger.warning(f"Unknown backend {backend}, using local storage")
            backend_instance = LocalFileStorage()

        self.backend = backend_instance

        logger.info(f"FileStorageService initialized with {self.backend_type} backend")

    @staticmethod
    def _ensure_valid_file_id(file_id: str) -> str:
        """Validate the file identifier."""
        try:
            uuid.UUID(file_id)
        except ValueError as exc:
            raise ValueError("Invalid file identifier.") from exc
        return file_id

    async def store_file(
        self,
        file_data: bytes,
        file_name: str,
        content_type: str,
        path: str | None = None,
        metadata: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> str:
        """Store a file and return its ID."""
        return await self.backend.store(
            file_data=file_data,
            file_name=file_name,
            content_type=content_type,
            path=path,
            metadata=metadata,
            tenant_id=tenant_id,
        )

    async def retrieve_file(
        self, file_id: str, tenant_id: str | None = None
    ) -> tuple[bytes | None, dict[str, Any] | None]:
        """Retrieve a file by ID."""
        safe_file_id = self._ensure_valid_file_id(file_id)
        return await self.backend.retrieve(safe_file_id, tenant_id)

    async def delete_file(self, file_id: str, tenant_id: str | None = None) -> bool:
        """Delete a file by ID."""
        safe_file_id = self._ensure_valid_file_id(file_id)
        return await self.backend.delete(safe_file_id, tenant_id)

    async def list_files(
        self,
        path: str | None = None,
        limit: int = 100,
        offset: int = 0,
        tenant_id: str | None = None,
    ) -> list[FileMetadata]:
        """List files."""
        return await self.backend.list_files(
            path=path,
            limit=limit,
            offset=offset,
            tenant_id=tenant_id,
        )

    async def get_file_metadata(self, file_id: str) -> dict[str, Any] | None:
        """Get file metadata."""
        safe_file_id = self._ensure_valid_file_id(file_id)
        return await self.backend.get_metadata(safe_file_id)

    async def update_file_metadata(
        self,
        file_id: str,
        metadata_updates: dict[str, Any],
        tenant_id: str | None = None,
    ) -> bool:
        """Update file metadata."""
        safe_file_id = self._ensure_valid_file_id(file_id)
        # Get existing metadata
        current_metadata = await self.backend.get_metadata(safe_file_id)
        if not current_metadata:
            return False

        # Update metadata
        if "metadata" in current_metadata:
            current_metadata["metadata"].update(metadata_updates)
        else:
            current_metadata["metadata"] = metadata_updates

        current_metadata["updated_at"] = datetime.now(UTC).isoformat()

        # In production, save to database
        # For now, update in-memory if applicable
        if hasattr(self.backend, "metadata_store"):
            file_meta = self.backend.metadata_store.get(safe_file_id)
            if file_meta:
                file_meta.metadata.update(metadata_updates)
                file_meta.updated_at = datetime.now(UTC)
        elif hasattr(self.backend, "metadata"):
            file_meta = self.backend.metadata.get(safe_file_id)
            if file_meta:
                file_meta.metadata.update(metadata_updates)
                file_meta.updated_at = datetime.now(UTC)

        return True


# Global service instance
_storage_service: FileStorageService | None = None


def get_storage_service() -> FileStorageService:
    """Get the global storage service instance."""
    global _storage_service
    if _storage_service is None:
        # Determine backend from "minio"
        provider = "minio".lower()

        # Map provider to backend
        if provider == "minio":
            backend = StorageBackend.MINIO
        elif provider == "s3":
            backend = StorageBackend.S3
        elif provider == "local":
            backend = StorageBackend.LOCAL
        else:
            # Default to local if unknown provider
            backend = StorageBackend.LOCAL

        logger.info(f"Initializing storage service with {backend} backend (provider: {provider})")
        _storage_service = FileStorageService(backend=backend)
    return _storage_service


class StorageBackendProtocol(Protocol):
    """Protocol describing the required storage backend interface."""

    async def store(
        self,
        file_data: bytes,
        file_name: str,
        content_type: str,
        path: str | None = None,
        metadata: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> str: ...

    async def retrieve(
        self, file_id: str, tenant_id: str | None = None
    ) -> tuple[bytes | None, dict[str, Any] | None]: ...

    async def delete(self, file_id: str, tenant_id: str | None = None) -> bool: ...

    async def list_files(
        self,
        path: str | None = None,
        limit: int = 100,
        offset: int = 0,
        tenant_id: str | None = None,
    ) -> list[FileMetadata]: ...

    async def get_metadata(self, file_id: str) -> dict[str, Any] | None: ...
