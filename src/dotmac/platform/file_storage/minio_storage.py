"""
Simple MinIO storage client for file management.
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

import structlog
from minio import Minio
from minio.commonconfig import CopySource
from minio.error import S3Error

from ..settings import settings

logger = structlog.get_logger(__name__)


@dataclass
class FileInfo:
    """File metadata."""

    filename: str
    path: str
    size: int
    content_type: str
    modified_at: datetime
    tenant_id: str


class MinIOStorage:
    """Simple MinIO storage client."""

    def __init__(
        self,
        endpoint: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        bucket: str | None = None,
        secure: bool | None = None,
    ):
        """Initialize MinIO client with settings."""
        # Use provided values or fall back to settings
        endpoint = endpoint or settings.storage.endpoint or "localhost:9000"
        access_key = access_key or settings.storage.access_key or "minioadmin"
        secret_key = secret_key or settings.storage.secret_key or "minioadmin123"
        self.bucket = bucket or settings.storage.bucket or "dotmac"

        # Log credentials being used (mask secret)
        logger.info(
            "Initializing MinIO client",
            endpoint=endpoint,
            access_key=access_key,
            secret_masked=secret_key[:4] + "***" if secret_key else None,
            bucket=self.bucket,
        )

        # Remove http:// or https:// prefix for minio client
        if endpoint.startswith("http://"):
            endpoint = endpoint[7:]
            secure = False
        elif endpoint.startswith("https://"):
            endpoint = endpoint[8:]
            secure = True
        else:
            secure = secure if secure is not None else settings.storage.use_ssl

        try:
            self.client = Minio(
                endpoint=endpoint,
                access_key=access_key,
                secret_key=secret_key,
                secure=secure,
            )
            logger.info(f"MinIO client created successfully with endpoint {endpoint}")
        except Exception as e:
            logger.error(f"Failed to create MinIO client: {e}")
            raise

        # Ensure bucket exists
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
        except S3Error as e:
            logger.error(f"Failed to create bucket {self.bucket}: {e}")
            raise

    def _get_object_name(self, file_path: str, tenant_id: str) -> str:
        """Generate object name with tenant prefix."""
        file_path = file_path.lstrip("/")
        return f"{tenant_id}/{file_path}"

    def save_file(
        self,
        file_path: str,
        content: BinaryIO,
        tenant_id: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Save a file to MinIO."""
        object_name = self._get_object_name(file_path, tenant_id)

        try:
            # Get content length
            content.seek(0, 2)  # Seek to end
            content_length = content.tell()
            content.seek(0)  # Reset to beginning

            self.client.put_object(
                self.bucket,
                object_name,
                content,
                content_length,
                content_type=content_type,
            )
            logger.info(f"Saved file: {object_name}")
            return object_name

        except S3Error as e:
            logger.error(f"Failed to save file {object_name}: {e}")
            raise

    def get_file(self, file_path: str, tenant_id: str) -> bytes:
        """Get a file from MinIO."""
        object_name = self._get_object_name(file_path, tenant_id)

        try:
            response = self.client.get_object(self.bucket, object_name)
            data: bytes = response.read()
            response.close()
            response.release_conn()
            return data

        except S3Error as e:
            if "NoSuchKey" in str(e):
                raise FileNotFoundError(f"File not found: {object_name}")
            logger.error(f"Failed to get file {object_name}: {e}")
            raise

    def delete_file(self, file_path: str, tenant_id: str) -> bool:
        """Delete a file from MinIO."""
        object_name = self._get_object_name(file_path, tenant_id)

        try:
            self.client.remove_object(self.bucket, object_name)
            logger.info(f"Deleted file: {object_name}")
            return True

        except S3Error as e:
            if "NoSuchKey" in str(e):
                return False
            logger.error(f"Failed to delete file {object_name}: {e}")
            raise

    def copy_file(
        self,
        source_path: str,
        destination_path: str,
        source_tenant_id: str,
        destination_tenant_id: str | None = None,
    ) -> None:
        """Copy a file within MinIO."""
        dest_tenant = destination_tenant_id or source_tenant_id

        destination_object = self._get_object_name(destination_path, dest_tenant)
        source_object = self._get_object_name(source_path, source_tenant_id)

        try:
            self.client.copy_object(
                bucket_name=self.bucket,
                object_name=destination_object,
                source=CopySource(self.bucket, source_object),
            )
            logger.info(
                "Copied file",
                source=source_object,
                destination=destination_object,
            )
        except S3Error as e:
            logger.error(
                "Failed to copy file in MinIO",
                source=source_object,
                destination=destination_object,
                error=str(e),
            )
            raise

    def file_exists(self, file_path: str, tenant_id: str) -> bool:
        """Check if a file exists in MinIO."""
        object_name = self._get_object_name(file_path, tenant_id)

        try:
            self.client.stat_object(self.bucket, object_name)
            return True
        except S3Error as e:
            if "NoSuchKey" in str(e):
                return False
            raise

    def list_files(
        self,
        prefix: str = "",
        tenant_id: str = "",
        limit: int | None = None,
    ) -> list[FileInfo]:
        """List files in MinIO."""
        if tenant_id:
            prefix = f"{tenant_id}/{prefix}".rstrip("/")

        try:
            objects = self.client.list_objects(
                self.bucket,
                prefix=prefix,
                recursive=True,
            )

            files: list[FileInfo] = []
            for obj in objects:
                if limit and len(files) >= limit:
                    break

                # Extract path without tenant prefix
                path = obj.object_name or ""
                if tenant_id and path.startswith(tenant_id + "/"):
                    path = path[len(tenant_id) + 1 :]

                # Skip if required fields are missing
                if not path or not obj.size or not obj.last_modified:
                    continue

                files.append(
                    FileInfo(
                        filename=Path(path).name,
                        path=path,
                        size=obj.size,
                        content_type=obj.content_type or "application/octet-stream",
                        modified_at=obj.last_modified,
                        tenant_id=tenant_id,
                    )
                )

            return files

        except S3Error as e:
            logger.error(f"Failed to list files: {e}")
            raise

    def save_file_from_path(
        self,
        local_path: str,
        remote_path: str,
        tenant_id: str,
    ) -> str:
        """Upload a file from local filesystem to MinIO."""
        object_name = self._get_object_name(remote_path, tenant_id)

        try:
            self.client.fput_object(self.bucket, object_name, local_path)
            logger.info(f"Uploaded file from {local_path} to {object_name}")
            return object_name

        except S3Error as e:
            logger.error(f"Failed to upload file {local_path}: {e}")
            raise

    def get_file_to_path(
        self,
        remote_path: str,
        local_path: str,
        tenant_id: str,
    ) -> str:
        """Download a file from MinIO to local filesystem."""
        object_name = self._get_object_name(remote_path, tenant_id)

        try:
            self.client.fget_object(self.bucket, object_name, local_path)
            logger.info(f"Downloaded file from {object_name} to {local_path}")
            return local_path

        except S3Error as e:
            if "NoSuchKey" in str(e):
                raise FileNotFoundError(f"File not found: {object_name}")
            logger.error(f"Failed to download file {object_name}: {e}")
            raise


# Global storage instance
_storage: MinIOStorage | None = None


def get_storage() -> MinIOStorage:
    """Get the global MinIO storage instance."""
    global _storage
    if _storage is None:
        _storage = MinIOStorage()
    return _storage


def reset_storage() -> None:
    """Reset the cached MinIO storage instance (useful for testing)."""
    global _storage
    _storage = None
