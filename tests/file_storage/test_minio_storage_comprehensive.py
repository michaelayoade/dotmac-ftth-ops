"""
Comprehensive tests for file_storage/minio_storage.py to improve coverage from 30.38%.

Tests cover:
- MinIOStorage initialization with settings
- URL prefix handling (http://, https://)
- Bucket creation and existence checks
- File save operations
- File get operations
- File delete operations
- File existence checks
- List files with prefix and tenant filtering
- Upload/download from filesystem
- Tenant-based object naming
- Error handling and S3Error scenarios
- Global storage instance management
"""

# Monkey-patch S3Error to make it non-frozen for Python 3.12+ compatibility
# S3Error is a frozen dataclass which causes FrozenInstanceError when
# Python tries to assign __traceback__ during exception handling
import dataclasses
from datetime import datetime
from io import BytesIO
from unittest.mock import Mock, patch

import pytest
from minio.error import S3Error as OriginalS3Error  # noqa: F401

from dotmac.platform.file_storage.minio_storage import (
    FileInfo,
    MinIOStorage,
    get_storage,
    reset_storage,
)


# Create a new non-frozen version
@dataclasses.dataclass
class _NonFrozenS3Error(BaseException):
    """Non-frozen S3Error for testing."""

    code: str
    message: str
    resource: str
    request_id: str
    host_id: str
    response: object

    def __str__(self):
        return f"S3 operation failed; code: {self.code}, message: {self.message}, resource: {self.resource}, request_id: {self.request_id}, host_id: {self.host_id}, response: {self.response}"


# Replace S3Error in the minio.error module for tests
import minio.error  # noqa: E402

minio.error.S3Error = _NonFrozenS3Error
# Also update the local import
S3Error = _NonFrozenS3Error

# CRITICAL: Patch S3Error in the minio_storage module that was already imported
# This ensures the except S3Error clauses catch our non-frozen version
import dotmac.platform.file_storage.minio_storage as minio_storage_module  # noqa: E402

minio_storage_module.S3Error = _NonFrozenS3Error


@pytest.mark.unit
class TestFileInfo:
    """Test FileInfo dataclass."""

    def test_file_info_creation(self):
        """Test creating FileInfo instance."""
        file_info = FileInfo(
            filename="test.txt",
            path="uploads/test.txt",
            size=1024,
            content_type="text/plain",
            modified_at=datetime.now(),
            tenant_id="tenant-123",
        )

        assert file_info.filename == "test.txt"
        assert file_info.path == "uploads/test.txt"
        assert file_info.size == 1024
        assert file_info.content_type == "text/plain"
        assert file_info.tenant_id == "tenant-123"


@pytest.mark.unit
class TestMinIOStorageInit:
    """Test MinIOStorage initialization."""

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_init_with_defaults(self, mock_minio, mock_settings):
        """Test initialization with default settings."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "minioadmin"
        mock_settings.storage.secret_key = "minioadmin123"
        mock_settings.storage.bucket = "dotmac"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        assert storage.bucket == "dotmac"
        mock_minio.assert_called_once_with(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin123",
            secure=False,
        )

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_init_with_http_prefix(self, mock_minio, mock_settings):
        """Test initialization strips http:// prefix and sets secure=False."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_minio.return_value = mock_client

        MinIOStorage(endpoint="http://minio.example.com:9000")

        mock_minio.assert_called_once()
        call_args = mock_minio.call_args
        assert call_args.kwargs["endpoint"] == "minio.example.com:9000"
        assert call_args.kwargs["secure"] is False

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_init_with_https_prefix(self, mock_minio, mock_settings):
        """Test initialization strips https:// prefix and sets secure=True."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_minio.return_value = mock_client

        MinIOStorage(endpoint="https://minio.example.com")

        call_args = mock_minio.call_args
        assert call_args.kwargs["endpoint"] == "minio.example.com"
        assert call_args.kwargs["secure"] is True

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_init_creates_bucket_if_not_exists(self, mock_minio, mock_settings):
        """Test bucket is created if it doesn't exist."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test-bucket"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = False
        mock_client.make_bucket = Mock()
        mock_minio.return_value = mock_client

        MinIOStorage()

        mock_client.bucket_exists.assert_called_once_with("test-bucket")
        mock_client.make_bucket.assert_called_once_with("test-bucket")

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_init_minio_client_creation_error(self, mock_minio, mock_settings):
        """Test error handling during MinIO client creation."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        # Simulate client creation failure
        mock_minio.side_effect = Exception("Connection failed")

        with pytest.raises(Exception, match="Connection failed"):
            MinIOStorage()

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_init_bucket_creation_error(self, mock_minio, mock_settings):
        """Test error handling during bucket creation."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()

        # Raise S3Error using function to avoid FrozenInstanceError
        def raise_s3_bucket_creation_failed(*args, **kwargs):
            raise S3Error(
                "BucketCreationFailed", "msg", "resource", "request_id", "host_id", Mock()
            )

        mock_client.bucket_exists = Mock(side_effect=raise_s3_bucket_creation_failed)
        mock_minio.return_value = mock_client

        with pytest.raises(S3Error):
            MinIOStorage()


@pytest.mark.unit
class TestGetObjectName:
    """Test _get_object_name method."""

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_get_object_name_basic(self, mock_minio, mock_settings):
        """Test object name generation."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage._get_object_name("uploads/file.txt", "tenant-123")

        assert result == "tenant-123/uploads/file.txt"

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_get_object_name_strips_leading_slash(self, mock_minio, mock_settings):
        """Test leading slash is stripped from file path."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage._get_object_name("/uploads/file.txt", "tenant-123")

        assert result == "tenant-123/uploads/file.txt"


@pytest.mark.unit
class TestSaveFile:
    """Test save_file method."""

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_save_file_success(self, mock_minio, mock_settings):
        """Test successfully saving a file."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_client.put_object = Mock()
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        content = BytesIO(b"test file content")
        result = storage.save_file("uploads/test.txt", content, "tenant-123", "text/plain")

        assert result == "tenant-123/uploads/test.txt"
        mock_client.put_object.assert_called_once()
        call_args = mock_client.put_object.call_args
        assert call_args[0][0] == "test"
        assert call_args[0][1] == "tenant-123/uploads/test.txt"

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_save_file_s3_error(self, mock_minio, mock_settings):
        """Test error handling when saving file fails."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error using function to avoid FrozenInstanceError
        def raise_s3_put_object_failed(*args, **kwargs):
            raise S3Error("PutObjectFailed", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.put_object = Mock(side_effect=raise_s3_put_object_failed)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        content = BytesIO(b"test")

        with pytest.raises(S3Error):
            storage.save_file("uploads/test.txt", content, "tenant-123")


@pytest.mark.unit
class TestGetFile:
    """Test get_file method."""

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_get_file_success(self, mock_minio, mock_settings):
        """Test successfully getting a file."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        mock_response = Mock()
        mock_response.read.return_value = b"file content"
        mock_response.close = Mock()
        mock_response.release_conn = Mock()
        mock_client.get_object.return_value = mock_response
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.get_file("uploads/test.txt", "tenant-123")

        assert result == b"file content"
        mock_client.get_object.assert_called_once_with("test", "tenant-123/uploads/test.txt")
        mock_response.close.assert_called_once()
        mock_response.release_conn.assert_called_once()

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_get_file_not_found(self, mock_minio, mock_settings):
        """Test getting non-existent file raises FileNotFoundError."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error directly - avoid side_effect to prevent FrozenInstanceError
        def raise_s3_not_found(*args, **kwargs):
            raise S3Error("NoSuchKey", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.get_object = Mock(side_effect=raise_s3_not_found)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        with pytest.raises(FileNotFoundError, match="File not found"):
            storage.get_file("nonexistent.txt", "tenant-123")

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_get_file_general_s3_error(self, mock_minio, mock_settings):
        """Test getting file with general S3 error raises S3Error."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error directly - avoid side_effect to prevent FrozenInstanceError
        def raise_s3_access_denied(*args, **kwargs):
            raise S3Error("AccessDenied", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.get_object = Mock(side_effect=raise_s3_access_denied)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        with pytest.raises(S3Error):
            storage.get_file("test.txt", "tenant-123")


@pytest.mark.unit
class TestDeleteFile:
    """Test delete_file method."""

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_delete_file_success(self, mock_minio, mock_settings):
        """Test successfully deleting a file."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_client.remove_object = Mock()
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.delete_file("uploads/test.txt", "tenant-123")

        assert result is True
        mock_client.remove_object.assert_called_once_with("test", "tenant-123/uploads/test.txt")

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_delete_file_not_found(self, mock_minio, mock_settings):
        """Test deleting non-existent file returns False."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error using function to avoid FrozenInstanceError
        def raise_s3_no_such_key(*args, **kwargs):
            raise S3Error("NoSuchKey", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.remove_object = Mock(side_effect=raise_s3_no_such_key)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.delete_file("nonexistent.txt", "tenant-123")

        assert result is False

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_delete_file_general_s3_error(self, mock_minio, mock_settings):
        """Test deleting file with general S3 error raises S3Error."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error using function to avoid FrozenInstanceError
        def raise_s3_access_denied(*args, **kwargs):
            raise S3Error("AccessDenied", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.remove_object = Mock(side_effect=raise_s3_access_denied)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        with pytest.raises(S3Error):
            storage.delete_file("test.txt", "tenant-123")


@pytest.mark.unit
class TestFileExists:
    """Test file_exists method."""

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_file_exists_true(self, mock_minio, mock_settings):
        """Test file exists returns True."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_client.stat_object = Mock()
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.file_exists("uploads/test.txt", "tenant-123")

        assert result is True

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_file_exists_false(self, mock_minio, mock_settings):
        """Test file exists returns False for non-existent file."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error using function to avoid FrozenInstanceError
        def raise_s3_no_such_key(*args, **kwargs):
            raise S3Error("NoSuchKey", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.stat_object = Mock(side_effect=raise_s3_no_such_key)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.file_exists("nonexistent.txt", "tenant-123")

        assert result is False

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_file_exists_general_s3_error(self, mock_minio, mock_settings):
        """Test file_exists with general S3 error raises S3Error."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error using function to avoid FrozenInstanceError
        def raise_s3_access_denied(*args, **kwargs):
            raise S3Error("AccessDenied", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.stat_object = Mock(side_effect=raise_s3_access_denied)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        with pytest.raises(S3Error):
            storage.file_exists("test.txt", "tenant-123")


@pytest.mark.unit
class TestListFiles:
    """Test list_files method."""

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_list_files_basic(self, mock_minio, mock_settings):
        """Test listing files with tenant ID."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        mock_obj1 = Mock()
        mock_obj1.object_name = "tenant-123/uploads/file1.txt"
        mock_obj1.size = 1024
        mock_obj1.last_modified = datetime.now()
        mock_obj1.content_type = "text/plain"

        mock_obj2 = Mock()
        mock_obj2.object_name = "tenant-123/uploads/file2.txt"
        mock_obj2.size = 2048
        mock_obj2.last_modified = datetime.now()
        mock_obj2.content_type = "text/plain"

        mock_client.list_objects.return_value = [mock_obj1, mock_obj2]
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.list_files(prefix="uploads", tenant_id="tenant-123")

        assert len(result) == 2
        assert result[0].filename == "file1.txt"
        assert result[0].path == "uploads/file1.txt"
        assert result[0].size == 1024
        assert result[1].filename == "file2.txt"

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_list_files_with_limit(self, mock_minio, mock_settings):
        """Test listing files with limit."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        mock_objs = []
        for i in range(10):
            mock_obj = Mock()
            mock_obj.object_name = f"tenant-123/file{i}.txt"
            mock_obj.size = 100
            mock_obj.last_modified = datetime.now()
            mock_obj.content_type = "text/plain"
            mock_objs.append(mock_obj)

        mock_client.list_objects.return_value = mock_objs
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.list_files(tenant_id="tenant-123", limit=5)

        assert len(result) == 5

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_list_files_with_tenant_prefix(self, mock_minio, mock_settings):
        """Test listing files uses tenant prefix for filtering."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Simulate MinIO returning only objects with tenant prefix
        mock_obj1 = Mock()
        mock_obj1.object_name = "tenant-123/file1.txt"
        mock_obj1.size = 100
        mock_obj1.last_modified = datetime.now()
        mock_obj1.content_type = "text/plain"

        mock_obj2 = Mock()
        mock_obj2.object_name = "tenant-123/file2.txt"
        mock_obj2.size = 200
        mock_obj2.last_modified = datetime.now()
        mock_obj2.content_type = "text/plain"

        mock_client.list_objects.return_value = [mock_obj1, mock_obj2]
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.list_files(tenant_id="tenant-123")

        # Verify list_objects was called with tenant prefix
        mock_client.list_objects.assert_called_once()
        call_args = mock_client.list_objects.call_args
        assert call_args[1]["prefix"] == "tenant-123"

        # Verify paths have tenant prefix stripped
        assert len(result) == 2
        assert result[0].filename == "file1.txt"
        assert result[0].path == "file1.txt"  # Tenant prefix should be stripped
        assert result[1].filename == "file2.txt"
        assert result[1].path == "file2.txt"

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_list_files_handles_missing_attributes(self, mock_minio, mock_settings):
        """Test listing files handles objects with missing attributes."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Object with missing content_type
        mock_obj1 = Mock()
        mock_obj1.object_name = "tenant-123/file1.txt"
        mock_obj1.size = 100
        mock_obj1.last_modified = datetime.now()
        mock_obj1.content_type = None

        mock_client.list_objects.return_value = [mock_obj1]
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.list_files(tenant_id="tenant-123")

        assert len(result) == 1
        assert result[0].content_type == "application/octet-stream"  # Default value

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_list_files_skips_objects_missing_required_fields(self, mock_minio, mock_settings):
        """Test listing files skips objects with missing required fields."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Mix of valid and invalid objects
        mock_obj_valid = Mock()
        mock_obj_valid.object_name = "tenant-123/valid.txt"
        mock_obj_valid.size = 100
        mock_obj_valid.last_modified = datetime.now()
        mock_obj_valid.content_type = "text/plain"

        # Object with missing size
        mock_obj_no_size = Mock()
        mock_obj_no_size.object_name = "tenant-123/no_size.txt"
        mock_obj_no_size.size = None  # Missing
        mock_obj_no_size.last_modified = datetime.now()
        mock_obj_no_size.content_type = "text/plain"

        # Object with missing last_modified
        mock_obj_no_date = Mock()
        mock_obj_no_date.object_name = "tenant-123/no_date.txt"
        mock_obj_no_date.size = 100
        mock_obj_no_date.last_modified = None  # Missing
        mock_obj_no_date.content_type = "text/plain"

        mock_client.list_objects.return_value = [
            mock_obj_valid,
            mock_obj_no_size,
            mock_obj_no_date,
        ]
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.list_files(tenant_id="tenant-123")

        # Should only return the valid object
        assert len(result) == 1
        assert result[0].filename == "valid.txt"

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_list_files_s3_error(self, mock_minio, mock_settings):
        """Test listing files with S3 error."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error using function to avoid FrozenInstanceError
        def raise_s3_list_access_denied(*args, **kwargs):
            raise S3Error("AccessDenied", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.list_objects = Mock(side_effect=raise_s3_list_access_denied)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        with pytest.raises(S3Error):
            storage.list_files(tenant_id="tenant-123")


@pytest.mark.unit
class TestFilesystemOperations:
    """Test save_file_from_path and get_file_to_path methods."""

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_save_file_from_path(self, mock_minio, mock_settings):
        """Test uploading file from local filesystem."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_client.fput_object = Mock()
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.save_file_from_path("/tmp/local.txt", "uploads/remote.txt", "tenant-123")

        assert result == "tenant-123/uploads/remote.txt"
        mock_client.fput_object.assert_called_once_with(
            "test", "tenant-123/uploads/remote.txt", "/tmp/local.txt"
        )

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_save_file_from_path_s3_error(self, mock_minio, mock_settings):
        """Test uploading file from filesystem with S3 error."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error using function to avoid FrozenInstanceError
        def raise_s3_fput_access_denied(*args, **kwargs):
            raise S3Error("AccessDenied", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.fput_object = Mock(side_effect=raise_s3_fput_access_denied)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        with pytest.raises(S3Error):
            storage.save_file_from_path("/tmp/local.txt", "uploads/remote.txt", "tenant-123")

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_get_file_to_path(self, mock_minio, mock_settings):
        """Test downloading file to local filesystem."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True
        mock_client.fget_object = Mock()
        mock_minio.return_value = mock_client

        storage = MinIOStorage()
        result = storage.get_file_to_path("uploads/remote.txt", "/tmp/local.txt", "tenant-123")

        assert result == "/tmp/local.txt"
        mock_client.fget_object.assert_called_once_with(
            "test", "tenant-123/uploads/remote.txt", "/tmp/local.txt"
        )

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_get_file_to_path_not_found(self, mock_minio, mock_settings):
        """Test downloading non-existent file raises error."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error directly - avoid side_effect to prevent FrozenInstanceError
        def raise_s3_not_found_fget(*args, **kwargs):
            raise S3Error("NoSuchKey", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.fget_object = Mock(side_effect=raise_s3_not_found_fget)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        with pytest.raises(FileNotFoundError):
            storage.get_file_to_path("nonexistent.txt", "/tmp/out.txt", "tenant-123")

    @patch("dotmac.platform.file_storage.minio_storage.settings")
    @patch("dotmac.platform.file_storage.minio_storage.Minio")
    def test_get_file_to_path_general_s3_error(self, mock_minio, mock_settings):
        """Test downloading file with general S3 error raises S3Error."""
        mock_settings.storage.endpoint = "localhost:9000"
        mock_settings.storage.access_key = "key"
        mock_settings.storage.secret_key = "secret"
        mock_settings.storage.bucket = "test"
        mock_settings.storage.use_ssl = False

        mock_client = Mock()
        mock_client.bucket_exists.return_value = True

        # Raise S3Error directly - avoid side_effect to prevent FrozenInstanceError
        def raise_s3_access_denied_fget(*args, **kwargs):
            raise S3Error("AccessDenied", "msg", "resource", "request_id", "host_id", Mock())

        mock_client.fget_object = Mock(side_effect=raise_s3_access_denied_fget)
        mock_minio.return_value = mock_client

        storage = MinIOStorage()

        with pytest.raises(S3Error):
            storage.get_file_to_path("remote.txt", "/tmp/out.txt", "tenant-123")


@pytest.mark.unit
class TestGlobalStorageInstance:
    """Test global storage instance management."""

    def setup_method(self):
        """Reset global storage before each test."""
        reset_storage()

    def teardown_method(self):
        """Clean up global storage after each test."""
        reset_storage()

    @patch("dotmac.platform.file_storage.minio_storage.MinIOStorage")
    def test_get_storage_singleton(self, mock_storage_class):
        """Test get_storage returns singleton instance."""
        mock_storage = Mock()
        mock_storage_class.return_value = mock_storage

        storage1 = get_storage()
        storage2 = get_storage()

        assert storage1 is storage2
        mock_storage_class.assert_called_once()

    @patch("dotmac.platform.file_storage.minio_storage.MinIOStorage")
    def test_reset_storage(self, mock_storage_class):
        """Test reset_storage clears cached instance."""
        mock_storage1 = Mock()
        mock_storage2 = Mock()
        mock_storage_class.side_effect = [mock_storage1, mock_storage2]

        storage1 = get_storage()
        reset_storage()
        storage2 = get_storage()

        assert storage1 is not storage2
        assert storage1 is mock_storage1
        assert storage2 is mock_storage2
