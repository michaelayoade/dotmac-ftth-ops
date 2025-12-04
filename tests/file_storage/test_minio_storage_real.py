"""
Real tests for MinIO storage that actually execute code.

These tests use partial mocking - only mock the external MinIO client,
but test all of our actual MinIOStorage code logic.
"""

from datetime import datetime
from io import BytesIO
from unittest.mock import Mock, patch

import pytest
from minio.error import S3Error

from dotmac.platform.file_storage.minio_storage import MinIOStorage


class FakeMinIOClient:
    """In-memory fake MinIO client that behaves like real MinIO."""

    def __init__(self):
        self.buckets = set()
        self.objects = {}  # key: bucket/object_name, value: bytes
        self.metadata = {}  # key: bucket/object_name, value: dict

    def bucket_exists(self, bucket_name):
        """Check if bucket exists."""
        return bucket_name in self.buckets

    def make_bucket(self, bucket_name):
        """Create a bucket."""
        if bucket_name in self.buckets:
            raise S3Error(
                code="BucketAlreadyExists",
                message=f"Bucket {bucket_name} already exists",
                resource=bucket_name,
                request_id="test",
                host_id="test",
                response="test",
            )
        self.buckets.add(bucket_name)

    def put_object(self, bucket_name, object_name, data, length, content_type=None, metadata=None):
        """Upload an object."""
        if bucket_name not in self.buckets:
            raise S3Error(
                code="NoSuchBucket",
                message=f"Bucket {bucket_name} does not exist",
                resource=bucket_name,
                request_id="test",
                host_id="test",
                response="test",
            )

        key = f"{bucket_name}/{object_name}"
        # Read the data from BinaryIO
        if hasattr(data, "read"):
            self.objects[key] = data.read()
        else:
            self.objects[key] = data

        self.metadata[key] = {
            "content_type": content_type or "application/octet-stream",
            "size": len(self.objects[key]),
            "modified": datetime.utcnow(),
        }
        if metadata:
            self.metadata[key].update(metadata)

    def get_object(self, bucket_name, object_name):
        """Download an object."""
        if bucket_name not in self.buckets:
            raise S3Error(
                code="NoSuchBucket",
                message=f"Bucket {bucket_name} does not exist",
                resource=bucket_name,
                request_id="test",
                host_id="test",
                response="test",
            )

        key = f"{bucket_name}/{object_name}"
        if key not in self.objects:
            raise S3Error(
                code="NoSuchKey",
                message=f"Object {object_name} does not exist",
                resource=object_name,
                request_id="test",
                host_id="test",
                response="test",
            )

        # Return mock response with read(), close(), and release_conn() methods
        response = Mock()
        response.read = Mock(return_value=self.objects[key])
        response.close = Mock()
        response.release_conn = Mock()
        return response

    def remove_object(self, bucket_name, object_name):
        """Delete an object."""
        key = f"{bucket_name}/{object_name}"
        if key in self.objects:
            del self.objects[key]
            if key in self.metadata:
                del self.metadata[key]

    def list_objects(self, bucket_name, prefix=None, recursive=True):
        """List objects in a bucket."""
        if bucket_name not in self.buckets:
            raise S3Error(
                code="NoSuchBucket",
                message=f"Bucket {bucket_name} does not exist",
                resource=bucket_name,
                request_id="test",
                host_id="test",
                response="test",
            )

        objects = []
        for key, data in self.objects.items():
            bucket, object_name = key.split("/", 1)
            if bucket == bucket_name:
                if prefix is None or object_name.startswith(prefix):
                    obj = Mock()
                    obj.object_name = object_name
                    obj.size = len(data)
                    obj.last_modified = self.metadata[key]["modified"]
                    objects.append(obj)

        return objects

    def stat_object(self, bucket_name, object_name):
        """Get object metadata."""
        key = f"{bucket_name}/{object_name}"
        if key not in self.objects:
            raise S3Error(
                code="NoSuchKey",
                message=f"Object {object_name} does not exist",
                resource=object_name,
                request_id="test",
                host_id="test",
                response="test",
            )

        stat = Mock()
        stat.size = self.metadata[key]["size"]
        stat.last_modified = self.metadata[key]["modified"]
        stat.content_type = self.metadata[key]["content_type"]
        return stat

    def fput_object(self, bucket_name, object_name, file_path, content_type=None):
        """Upload a file from filesystem."""
        if bucket_name not in self.buckets:
            raise S3Error(
                code="NoSuchBucket",
                message=f"Bucket {bucket_name} does not exist",
                resource=bucket_name,
                request_id="test",
                host_id="test",
                response="test",
            )

        # Read from file path
        with open(file_path, "rb") as f:
            data = f.read()

        key = f"{bucket_name}/{object_name}"
        self.objects[key] = data
        self.metadata[key] = {
            "content_type": content_type or "application/octet-stream",
            "size": len(data),
            "modified": datetime.utcnow(),
        }

    def fget_object(self, bucket_name, object_name, file_path):
        """Download a file to filesystem."""
        key = f"{bucket_name}/{object_name}"
        if key not in self.objects:
            raise S3Error(
                code="NoSuchKey",
                message=f"Object {object_name} does not exist",
                resource=object_name,
                request_id="test",
                host_id="test",
                response="test",
            )

        # Write to file path
        with open(file_path, "wb") as f:
            f.write(self.objects[key])


@pytest.fixture
def fake_minio_client():
    """Create a fake MinIO client."""
    return FakeMinIOClient()


@pytest.fixture
def storage(fake_minio_client):
    """Create MinIOStorage with fake client - tests real MinIOStorage code."""
    with patch("dotmac.platform.file_storage.minio_storage.Minio") as mock_minio:
        # Return our fake client instead of real MinIO
        mock_minio.return_value = fake_minio_client

        # This creates REAL MinIOStorage instance that executes actual code!
        storage = MinIOStorage(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            bucket="test-bucket",
        )

        yield storage


@pytest.mark.integration
class TestMinIOStorageInitialization:
    """Test MinIOStorage initialization logic."""

    def test_init_creates_bucket_if_not_exists(self, fake_minio_client):
        """Test that initialization creates bucket if it doesn't exist."""
        with patch("dotmac.platform.file_storage.minio_storage.Minio") as mock_minio:
            mock_minio.return_value = fake_minio_client

            # Bucket doesn't exist initially
            assert "test-bucket" not in fake_minio_client.buckets

            # Create storage - should create bucket
            MinIOStorage(bucket="test-bucket")

            # Bucket should now exist
            assert "test-bucket" in fake_minio_client.buckets

    def test_init_handles_http_prefix(self, fake_minio_client):
        """Test that http:// prefix is stripped and secure=False is set."""
        with patch("dotmac.platform.file_storage.minio_storage.Minio") as mock_minio:
            mock_minio.return_value = fake_minio_client

            # Create with http:// prefix
            MinIOStorage(endpoint="http://minio.example.com:9000", bucket="test-bucket")

            # Verify Minio was called with stripped endpoint and secure=False
            call_kwargs = mock_minio.call_args.kwargs
            assert call_kwargs["endpoint"] == "minio.example.com:9000"
            assert not call_kwargs["secure"]

    def test_init_handles_https_prefix(self, fake_minio_client):
        """Test that https:// prefix is stripped and secure=True is set."""
        with patch("dotmac.platform.file_storage.minio_storage.Minio") as mock_minio:
            mock_minio.return_value = fake_minio_client

            # Create with https:// prefix
            MinIOStorage(endpoint="https://minio.example.com:9000", bucket="test-bucket")

            # Verify Minio was called with stripped endpoint and secure=True
            call_kwargs = mock_minio.call_args.kwargs
            assert call_kwargs["endpoint"] == "minio.example.com:9000"
            assert call_kwargs["secure"]


@pytest.mark.integration
class TestMinIOStorageFileOperations:
    """Test file save, get, delete operations."""

    def test_save_file_basic(self, storage):
        """Test basic file save operation."""
        file_data = BytesIO(b"test file content")

        result = storage.save_file(
            file_path="documents/test.txt",
            content=file_data,
            tenant_id="tenant-123",
            content_type="text/plain",
        )

        # save_file returns object_name which includes tenant prefix
        assert result == "tenant-123/documents/test.txt"

        # Verify file was saved with tenant prefix
        key = "test-bucket/tenant-123/documents/test.txt"
        assert key in storage.client.objects
        assert storage.client.objects[key] == b"test file content"

    def test_save_file_with_tenant_prefix(self, storage):
        """Test that tenant ID is properly prefixed to file path."""
        file_data = BytesIO(b"data")

        storage.save_file("file.txt", file_data, "tenant-456")

        # Should be stored as tenant-456/file.txt
        key = "test-bucket/tenant-456/file.txt"
        assert key in storage.client.objects

    def test_save_file_strips_leading_slash(self, storage):
        """Test that leading slashes are stripped from file path."""
        file_data = BytesIO(b"data")

        result = storage.save_file("/path/file.txt", file_data, "tenant-1")

        # Should not have leading slash, but includes tenant prefix
        assert result == "tenant-1/path/file.txt"
        assert "test-bucket/tenant-1/path/file.txt" in storage.client.objects

    def test_get_file_success(self, storage):
        """Test retrieving a file."""
        # First save a file
        file_data = BytesIO(b"test content")
        storage.save_file("test.txt", file_data, "tenant-1")

        # Now retrieve it - get_file returns bytes directly
        retrieved = storage.get_file("test.txt", "tenant-1")

        assert retrieved == b"test content"

    def test_get_file_not_found(self, storage):
        """Test getting non-existent file raises FileNotFoundError."""
        # MinIOStorage wraps S3Error and raises FileNotFoundError
        with pytest.raises(FileNotFoundError):
            storage.get_file("nonexistent.txt", "tenant-1")

    def test_delete_file(self, storage):
        """Test deleting a file."""
        # Save a file
        file_data = BytesIO(b"to be deleted")
        storage.save_file("delete-me.txt", file_data, "tenant-1")

        # Verify it exists
        assert "test-bucket/tenant-1/delete-me.txt" in storage.client.objects

        # Delete it
        storage.delete_file("delete-me.txt", "tenant-1")

        # Verify it's gone
        assert "test-bucket/tenant-1/delete-me.txt" not in storage.client.objects

    def test_file_exists_true(self, storage):
        """Test file_exists returns True for existing file."""
        file_data = BytesIO(b"exists")
        storage.save_file("exists.txt", file_data, "tenant-1")

        assert storage.file_exists("exists.txt", "tenant-1") is True

    def test_file_exists_false(self, storage):
        """Test file_exists returns False for non-existent file."""
        assert storage.file_exists("does-not-exist.txt", "tenant-1") is False


@pytest.mark.integration
class TestMinIOStorageListOperations:
    """Test file listing and filtering."""

    def test_list_files_in_tenant(self, storage):
        """Test listing files for a specific tenant."""
        # Create files for different tenants
        storage.save_file("file1.txt", BytesIO(b"1"), "tenant-1")
        storage.save_file("file2.txt", BytesIO(b"2"), "tenant-1")
        storage.save_file("file3.txt", BytesIO(b"3"), "tenant-2")

        # List files for tenant-1
        files = storage.list_files(tenant_id="tenant-1")

        assert len(files) == 2
        file_names = [f.filename for f in files]
        assert "file1.txt" in file_names
        assert "file2.txt" in file_names
        assert "file3.txt" not in file_names

    def test_list_files_with_prefix(self, storage):
        """Test listing files with prefix filter."""
        storage.save_file("docs/doc1.txt", BytesIO(b"1"), "tenant-1")
        storage.save_file("docs/doc2.txt", BytesIO(b"2"), "tenant-1")
        storage.save_file("images/img1.png", BytesIO(b"3"), "tenant-1")

        # List only docs
        files = storage.list_files(tenant_id="tenant-1", prefix="docs/")

        assert len(files) == 2
        file_names = [f.filename for f in files]
        assert all("doc" in name for name in file_names)

    def test_list_files_empty_tenant(self, storage):
        """Test listing files for tenant with no files."""
        files = storage.list_files(tenant_id="empty-tenant")

        assert files == []


@pytest.mark.integration
class TestMinIOStorageTenantIsolation:
    """Test tenant isolation in file operations."""

    def test_tenant_cannot_access_other_tenant_files(self, storage):
        """Test that tenant isolation is enforced."""
        # Tenant 1 saves a file
        storage.save_file("secret.txt", BytesIO(b"secret data"), "tenant-1")

        # Tenant 2 tries to access it - should raise FileNotFoundError
        with pytest.raises(FileNotFoundError):
            storage.get_file("secret.txt", "tenant-2")

    def test_list_files_only_shows_tenant_files(self, storage):
        """Test that listing only shows files from the correct tenant."""
        # Create files for multiple tenants
        storage.save_file("file-a.txt", BytesIO(b"a"), "tenant-1")
        storage.save_file("file-b.txt", BytesIO(b"b"), "tenant-1")
        storage.save_file("file-c.txt", BytesIO(b"c"), "tenant-2")
        storage.save_file("file-d.txt", BytesIO(b"d"), "tenant-3")

        # Each tenant should only see their own files - use tenant_id parameter
        tenant1_files = storage.list_files(tenant_id="tenant-1")
        tenant2_files = storage.list_files(tenant_id="tenant-2")
        tenant3_files = storage.list_files(tenant_id="tenant-3")

        assert len(tenant1_files) == 2
        assert len(tenant2_files) == 1
        assert len(tenant3_files) == 1


@pytest.mark.integration
class TestMinIOStorageErrorHandling:
    """Test error handling in MinIO operations."""

    def test_init_with_invalid_endpoint(self, fake_minio_client):
        """Test initialization error handling."""
        with patch("dotmac.platform.file_storage.minio_storage.Minio") as mock_minio:
            # Simulate Minio client creation failure
            mock_minio.side_effect = Exception("Connection failed")

            with pytest.raises(Exception) as exc_info:
                MinIOStorage(endpoint="invalid:9000", bucket="test-bucket")

            assert "Connection failed" in str(exc_info.value)

    def test_bucket_creation_error(self, fake_minio_client):
        """Test error when bucket creation fails."""
        with patch("dotmac.platform.file_storage.minio_storage.Minio") as mock_minio:
            # Make bucket_exists return False, then make_bucket raise error
            fake_minio_client.buckets.clear()  # Ensure bucket doesn't exist

            def make_bucket_error(bucket_name):
                raise S3Error(
                    code="InternalError",
                    message="Bucket creation failed",
                    resource=bucket_name,
                    request_id="test",
                    host_id="test",
                    response="test",
                )

            fake_minio_client.make_bucket = make_bucket_error
            mock_minio.return_value = fake_minio_client

            with pytest.raises(S3Error) as exc_info:
                MinIOStorage(endpoint="localhost:9000", bucket="error-bucket")

            assert exc_info.value.code == "InternalError"

    def test_save_file_error(self, storage):
        """Test error handling when file save fails."""

        # Make put_object raise an error
        def put_object_error(*args, **kwargs):
            raise S3Error(
                code="InternalError",
                message="Save failed",
                resource="test",
                request_id="test",
                host_id="test",
                response="test",
            )

        storage.client.put_object = put_object_error

        with pytest.raises(S3Error):
            storage.save_file("test.txt", BytesIO(b"data"), "tenant-1")

    def test_get_file_error_non_notfound(self, storage):
        """Test get_file with non-NoSuchKey S3 errors."""

        # Make get_object raise a different S3Error
        def get_object_error(*args, **kwargs):
            raise S3Error(
                code="AccessDenied",
                message="Access denied",
                resource="test",
                request_id="test",
                host_id="test",
                response="test",
            )

        storage.client.get_object = get_object_error

        # Should raise the S3Error, not FileNotFoundError
        with pytest.raises(S3Error) as exc_info:
            storage.get_file("test.txt", "tenant-1")

        assert exc_info.value.code == "AccessDenied"

    def test_delete_file_error_non_notfound(self, storage):
        """Test delete_file with non-NoSuchKey S3 errors."""

        # Make remove_object raise a different S3Error
        def remove_object_error(*args, **kwargs):
            raise S3Error(
                code="AccessDenied",
                message="Access denied",
                resource="test",
                request_id="test",
                host_id="test",
                response="test",
            )

        storage.client.remove_object = remove_object_error

        with pytest.raises(S3Error) as exc_info:
            storage.delete_file("test.txt", "tenant-1")

        assert exc_info.value.code == "AccessDenied"

    def test_file_exists_error(self, storage):
        """Test file_exists with non-NoSuchKey S3 errors."""

        # Make stat_object raise a different S3Error
        def stat_object_error(*args, **kwargs):
            raise S3Error(
                code="InternalError",
                message="Internal error",
                resource="test",
                request_id="test",
                host_id="test",
                response="test",
            )

        storage.client.stat_object = stat_object_error

        with pytest.raises(S3Error) as exc_info:
            storage.file_exists("test.txt", "tenant-1")

        assert exc_info.value.code == "InternalError"

    def test_list_files_error(self, storage):
        """Test list_files error handling."""

        # Make list_objects raise an error
        def list_objects_error(*args, **kwargs):
            raise S3Error(
                code="InternalError",
                message="List failed",
                resource="test",
                request_id="test",
                host_id="test",
                response="test",
            )

        storage.client.list_objects = list_objects_error

        with pytest.raises(S3Error):
            storage.list_files(tenant_id="tenant-1")


@pytest.mark.integration
class TestMinIOStorageFilePathOperations:
    """Test filesystem upload/download operations."""

    def test_save_file_from_path(self, storage, tmp_path):
        """Test uploading a file from local filesystem."""
        # Create a temporary file
        local_file = tmp_path / "test.txt"
        local_file.write_bytes(b"file content from disk")

        # Upload it
        result = storage.save_file_from_path(
            local_path=str(local_file), remote_path="uploaded/test.txt", tenant_id="tenant-1"
        )

        # Should return object name with tenant prefix
        assert result == "tenant-1/uploaded/test.txt"

        # Verify it's in storage
        key = "test-bucket/tenant-1/uploaded/test.txt"
        assert key in storage.client.objects
        assert storage.client.objects[key] == b"file content from disk"

    def test_get_file_to_path(self, storage, tmp_path):
        """Test downloading a file to local filesystem."""
        # First upload a file
        storage.save_file("download/test.txt", BytesIO(b"download me"), "tenant-1")

        # Download it
        local_file = tmp_path / "downloaded.txt"
        result = storage.get_file_to_path(
            remote_path="download/test.txt", local_path=str(local_file), tenant_id="tenant-1"
        )

        # Should return local path
        assert result == str(local_file)

        # Verify file was written
        assert local_file.exists()
        assert local_file.read_bytes() == b"download me"

    def test_get_file_to_path_not_found(self, storage, tmp_path):
        """Test downloading non-existent file raises FileNotFoundError."""
        local_file = tmp_path / "not-found.txt"

        with pytest.raises(FileNotFoundError):
            storage.get_file_to_path(
                remote_path="nonexistent.txt", local_path=str(local_file), tenant_id="tenant-1"
            )
