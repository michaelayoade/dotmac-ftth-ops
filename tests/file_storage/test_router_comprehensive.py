"""
Comprehensive tests for file_storage/router.py to improve coverage from 29.71%.

Tests cover:
- File upload endpoint with validation
- File download endpoint
- File deletion endpoint
- List files endpoint with pagination
- Get file metadata endpoint
- Batch operations endpoint
- Error handling for all endpoints
- Authentication and authorization
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock

import pytest

pytestmark = pytest.mark.unit
from fastapi import HTTPException, status
from starlette.requests import Request

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.file_storage.router import (
    FileListResponse,
    FileOperationRequest,
    FileUploadResponse,
)
from dotmac.platform.file_storage.service import FileMetadata

# Mock current user for authentication


@pytest.fixture
def mock_user():
    """Mock authenticated user."""
    return UserInfo(
        user_id="user-123",
        email="test@example.com",
        username="testuser",
        tenant_id="tenant-123",
    )


@pytest.fixture
def mock_request():
    """Mock FastAPI Request object."""
    request = Mock(spec=Request)
    request.client = Mock()
    request.client.host = "127.0.0.1"
    request.url = Mock()
    request.url.path = "/api/v1/files"
    request.method = "POST"
    return request


@pytest.fixture
def mock_storage_service():
    """Mock storage service."""
    service = AsyncMock()
    service.store_file = AsyncMock(return_value="file-123")
    service.retrieve_file = AsyncMock(
        return_value=(b"file content", {"file_name": "test.txt", "content_type": "text/plain"})
    )
    service.delete_file = AsyncMock(return_value=True)
    service.list_files = AsyncMock(return_value=[])
    service.get_file_metadata = AsyncMock(
        return_value={"file_name": "test.txt", "tenant_id": "tenant-123"}
    )
    service.move_file = AsyncMock(return_value=True)
    service.copy_file = AsyncMock(return_value="file-456")
    return service


@pytest.fixture(autouse=True)
def _patch_router_storage_service(mock_storage_service):
    """Ensure router uses the mocked storage service during tests."""
    from dotmac.platform.file_storage import router as router_module

    original_service = router_module.storage_service
    router_module.storage_service = mock_storage_service
    try:
        yield mock_storage_service
    finally:
        router_module.storage_service = original_service


class TestFileUploadEndpoint:
    """Test file upload endpoint."""

    @pytest.mark.asyncio
    async def test_upload_file_success(self, mock_request, mock_user, mock_storage_service):
        """Test successful file upload."""
        from fastapi import UploadFile

        from dotmac.platform.file_storage.router import upload_file

        # Create mock uploaded file
        file_content = b"test file content"
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.txt"
        mock_file.content_type = "text/plain"
        mock_file.read = AsyncMock(return_value=file_content)
        mock_file.seek = AsyncMock()

        result = await upload_file(
            request=mock_request,
            file=mock_file,
            path=None,
            description="Test upload",
            current_user=mock_user,
        )

        assert isinstance(result, FileUploadResponse)
        assert result.file_id == "file-123"
        assert result.file_name == "test.txt"
        assert result.file_size == len(file_content)
        assert result.content_type == "text/plain"

        # Verify service was called
        mock_storage_service.store_file.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_file_with_custom_path(
        self, mock_request, mock_user, mock_storage_service
    ):
        """Test file upload with custom path."""
        from fastapi import UploadFile

        from dotmac.platform.file_storage.router import upload_file

        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.txt"
        mock_file.content_type = "text/plain"
        mock_file.read = AsyncMock(return_value=b"test")
        mock_file.seek = AsyncMock()

        result = await upload_file(
            request=mock_request,
            file=mock_file,
            path="custom/path",
            description="Test",
            current_user=mock_user,
        )

        assert result.file_id == "file-123"
        # Verify custom path was used
        call_args = mock_storage_service.store_file.call_args
        assert call_args.kwargs["path"] == "custom/path"

    @pytest.mark.asyncio
    async def test_upload_file_too_large(self, mock_request, mock_user, mock_storage_service):
        """Test file upload with file too large error."""
        from fastapi import UploadFile

        from dotmac.platform.file_storage.router import upload_file

        # Create file larger than 100MB
        large_content = b"x" * (101 * 1024 * 1024)
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "large.txt"
        mock_file.content_type = "text/plain"
        mock_file.read = AsyncMock(return_value=large_content)

        with pytest.raises(HTTPException) as exc_info:
            await upload_file(
                request=mock_request,
                file=mock_file,
                path=None,
                description=None,
                current_user=mock_user,
            )

        assert exc_info.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        assert "too large" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_upload_file_unnamed(self, mock_request, mock_user, mock_storage_service):
        """Test file upload without filename."""
        from fastapi import UploadFile

        from dotmac.platform.file_storage.router import upload_file

        mock_file = Mock(spec=UploadFile)
        mock_file.filename = None  # No filename
        mock_file.content_type = None  # No content type
        mock_file.read = AsyncMock(return_value=b"test")
        mock_file.seek = AsyncMock()

        result = await upload_file(
            request=mock_request,
            file=mock_file,
            path=None,
            description=None,
            current_user=mock_user,
        )

        assert result.file_name == "unnamed"
        assert result.content_type == "application/octet-stream"

    @pytest.mark.asyncio
    async def test_upload_file_service_error(self, mock_request, mock_user, mock_storage_service):
        """Test file upload with service error."""
        mock_storage_service.store_file = AsyncMock(side_effect=Exception("Storage error"))

        from fastapi import UploadFile

        from dotmac.platform.file_storage.router import upload_file

        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.txt"
        mock_file.content_type = "text/plain"
        mock_file.read = AsyncMock(return_value=b"test")
        mock_file.seek = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await upload_file(
                request=mock_request,
                file=mock_file,
                path=None,
                description=None,
                current_user=mock_user,
            )

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "upload failed" in exc_info.value.detail.lower()


class TestFileDownloadEndpoint:
    """Test file download endpoint."""

    @pytest.mark.asyncio
    async def test_download_file_success(self, mock_request, mock_user, mock_storage_service):
        """Test successful file download."""
        from dotmac.platform.file_storage.router import download_file

        response = await download_file(
            request=mock_request, file_id="file-123", current_user=mock_user
        )

        assert response.body == b"file content"
        assert response.media_type == "text/plain"
        assert "attachment" in response.headers["Content-Disposition"]
        assert "test.txt" in response.headers["Content-Disposition"]

    @pytest.mark.asyncio
    async def test_download_file_not_found(self, mock_request, mock_user, mock_storage_service):
        """Test downloading non-existent file."""
        mock_storage_service.retrieve_file = AsyncMock(return_value=(None, None))

        from dotmac.platform.file_storage.router import download_file

        with pytest.raises(HTTPException) as exc_info:
            await download_file(request=mock_request, file_id="nonexistent", current_user=mock_user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_download_file_without_metadata(
        self, mock_request, mock_user, mock_storage_service
    ):
        """Test downloading file without metadata."""
        mock_storage_service.retrieve_file = AsyncMock(return_value=(b"content", None))

        from dotmac.platform.file_storage.router import download_file

        response = await download_file(
            request=mock_request, file_id="file-123", current_user=mock_user
        )

        assert response.body == b"content"
        assert response.media_type == "application/octet-stream"  # Default
        assert "download" in response.headers["Content-Disposition"]  # Default filename

    @pytest.mark.asyncio
    async def test_download_file_service_error(self, mock_request, mock_user, mock_storage_service):
        """Test file download with service error."""
        mock_storage_service.retrieve_file = AsyncMock(side_effect=Exception("Retrieval error"))

        from dotmac.platform.file_storage.router import download_file

        with pytest.raises(HTTPException) as exc_info:
            await download_file(request=mock_request, file_id="file-123", current_user=mock_user)

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "download failed" in exc_info.value.detail.lower()


class TestFileDeleteEndpoint:
    """Test file deletion endpoint."""

    @pytest.mark.asyncio
    async def test_delete_file_success(self, mock_request, mock_user, mock_storage_service):
        """Test successful file deletion."""
        from dotmac.platform.file_storage.router import delete_file

        result = await delete_file(request=mock_request, file_id="file-123", current_user=mock_user)

        assert "deleted successfully" in result["message"]
        assert "deleted_at" in result
        # Service is called with file_id and bucket name
        assert mock_storage_service.delete_file.call_count == 1

    @pytest.mark.asyncio
    async def test_delete_file_not_found(self, mock_request, mock_user, mock_storage_service):
        """Test deleting non-existent file."""
        mock_storage_service.delete_file = AsyncMock(return_value=False)

        from dotmac.platform.file_storage.router import delete_file

        with pytest.raises(HTTPException) as exc_info:
            await delete_file(request=mock_request, file_id="nonexistent", current_user=mock_user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_delete_file_service_error(self, mock_request, mock_user, mock_storage_service):
        """Test file deletion with service error."""
        mock_storage_service.delete_file = AsyncMock(side_effect=Exception("Deletion error"))

        from dotmac.platform.file_storage.router import delete_file

        with pytest.raises(HTTPException) as exc_info:
            await delete_file(request=mock_request, file_id="file-123", current_user=mock_user)

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "deletion failed" in exc_info.value.detail.lower()


class TestListFilesEndpoint:
    """Test list files endpoint."""

    @pytest.mark.asyncio
    async def test_list_files_success(self, mock_request, mock_user, mock_storage_service):
        """Test successful file listing."""
        mock_files = [
            FileMetadata(
                file_id="file-1",
                file_name="test1.txt",
                file_size=100,
                content_type="text/plain",
                created_at=datetime.now(UTC),
            ),
            FileMetadata(
                file_id="file-2",
                file_name="test2.txt",
                file_size=200,
                content_type="text/plain",
                created_at=datetime.now(UTC),
            ),
        ]
        mock_storage_service.list_files = AsyncMock(return_value=mock_files)

        from dotmac.platform.file_storage.router import list_files

        result = await list_files(
            request=mock_request, path=None, skip=0, limit=100, current_user=mock_user
        )

        assert isinstance(result, FileListResponse)
        assert len(result.files) == 2
        assert result.total == 2
        assert result.page == 1
        assert result.per_page == 100

    @pytest.mark.asyncio
    async def test_list_files_with_path_filter(self, mock_request, mock_user, mock_storage_service):
        """Test file listing with path filter."""
        from dotmac.platform.file_storage.router import list_files

        await list_files(
            request=mock_request, path="documents", skip=0, limit=100, current_user=mock_user
        )

        # Verify path filter was applied
        call_args = mock_storage_service.list_files.call_args
        assert "documents" in call_args.kwargs["path"]
        assert "user-123" in call_args.kwargs["path"]

    @pytest.mark.asyncio
    async def test_list_files_with_pagination(self, mock_request, mock_user, mock_storage_service):
        """Test file listing with pagination."""
        from dotmac.platform.file_storage.router import list_files

        result = await list_files(
            request=mock_request, path=None, skip=50, limit=25, current_user=mock_user
        )

        assert result.page == 3  # skip 50, limit 25 = page 3
        assert result.per_page == 25

        # Verify pagination was passed to service
        call_args = mock_storage_service.list_files.call_args
        assert call_args.kwargs["offset"] == 50
        assert call_args.kwargs["limit"] == 25

    @pytest.mark.asyncio
    async def test_list_files_service_error(self, mock_request, mock_user, mock_storage_service):
        """Test file listing with service error."""
        mock_storage_service.list_files = AsyncMock(side_effect=Exception("List error"))

        from dotmac.platform.file_storage.router import list_files

        with pytest.raises(HTTPException) as exc_info:
            await list_files(
                request=mock_request, path=None, skip=0, limit=100, current_user=mock_user
            )

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "failed to list files" in exc_info.value.detail.lower()


class TestGetFileMetadataEndpoint:
    """Test get file metadata endpoint."""

    @pytest.mark.asyncio
    async def test_get_file_metadata_success(self, mock_request, mock_user, mock_storage_service):
        """Test successful file metadata retrieval."""
        from dotmac.platform.file_storage.router import get_file_metadata

        result = await get_file_metadata(
            request=mock_request, file_id="file-123", current_user=mock_user
        )

        assert result["file_name"] == "test.txt"
        mock_storage_service.get_file_metadata.assert_called_once_with("file-123")

    @pytest.mark.asyncio
    async def test_get_file_metadata_not_found(self, mock_request, mock_user, mock_storage_service):
        """Test getting metadata for non-existent file."""
        mock_storage_service.get_file_metadata = AsyncMock(return_value=None)

        from dotmac.platform.file_storage.router import get_file_metadata

        with pytest.raises(HTTPException) as exc_info:
            await get_file_metadata(
                request=mock_request, file_id="nonexistent", current_user=mock_user
            )

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_get_file_metadata_service_error(
        self, mock_request, mock_user, mock_storage_service
    ):
        """Test getting metadata with service error."""
        mock_storage_service.get_file_metadata = AsyncMock(side_effect=Exception("Metadata error"))

        from dotmac.platform.file_storage.router import get_file_metadata

        with pytest.raises(HTTPException) as exc_info:
            await get_file_metadata(
                request=mock_request, file_id="file-123", current_user=mock_user
            )

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "failed to get file metadata" in exc_info.value.detail.lower()


class TestBatchOperationEndpoint:
    """Test batch operation endpoint."""

    @pytest.mark.asyncio
    async def test_batch_delete_success(self, mock_request, mock_user, mock_storage_service):
        """Test successful batch delete operation."""
        from dotmac.platform.file_storage.router import batch_operation

        operations_request = FileOperationRequest(
            file_ids=["file-1", "file-2"],
            operation="delete",
            destination=None,
        )

        result = await batch_operation(
            request=mock_request, operations=operations_request, current_user=mock_user
        )

        assert result["operation"] == "delete"
        assert len(result["results"]) == 2
        assert all(r["status"] == "deleted" for r in result["results"])
        assert mock_storage_service.delete_file.call_count == 2

    @pytest.mark.asyncio
    async def test_batch_delete_partial_failure(
        self, mock_request, mock_user, mock_storage_service
    ):
        """Test batch delete with partial failures."""
        # First file succeeds, second fails
        mock_storage_service.delete_file = AsyncMock(side_effect=[True, False])

        from dotmac.platform.file_storage.router import batch_operation

        operations_request = FileOperationRequest(
            file_ids=["file-1", "file-2"],
            operation="delete",
            destination=None,
        )

        result = await batch_operation(
            request=mock_request, operations=operations_request, current_user=mock_user
        )

        assert result["results"][0]["status"] == "deleted"
        assert result["results"][1]["status"] == "failed"

    @pytest.mark.asyncio
    async def test_batch_move_operation(self, mock_request, mock_user, mock_storage_service):
        """Test batch move operation."""
        from dotmac.platform.file_storage.router import batch_operation

        operations_request = FileOperationRequest(
            file_ids=["file-1"],
            operation="move",
            destination="new/path",
        )

        result = await batch_operation(
            request=mock_request, operations=operations_request, current_user=mock_user
        )

        assert result["operation"] == "move"
        assert result["results"][0]["status"] == "moved"

    @pytest.mark.asyncio
    async def test_batch_copy_operation(self, mock_request, mock_user, mock_storage_service):
        """Test batch copy operation."""
        from dotmac.platform.file_storage.router import batch_operation

        operations_request = FileOperationRequest(
            file_ids=["file-1"],
            operation="copy",
            destination="copy/path",
        )

        result = await batch_operation(
            request=mock_request, operations=operations_request, current_user=mock_user
        )

        assert result["operation"] == "copy"
        assert result["results"][0]["status"] == "copied"
        assert result["results"][0]["new_file_id"] == "file-456"

    @pytest.mark.asyncio
    async def test_batch_unsupported_operation(self, mock_request, mock_user, mock_storage_service):
        """Test batch operation with unsupported operation type."""
        from dotmac.platform.file_storage.router import batch_operation

        operations_request = FileOperationRequest(
            file_ids=["file-1"],
            operation="unsupported",
            destination=None,
        )

        result = await batch_operation(
            request=mock_request, operations=operations_request, current_user=mock_user
        )

        assert result["results"][0]["status"] == "unsupported_operation"

    @pytest.mark.asyncio
    async def test_batch_operation_service_error(
        self, mock_request, mock_user, mock_storage_service
    ):
        """Test batch operation with service error."""
        mock_storage_service.delete_file = AsyncMock(side_effect=Exception("Delete error"))

        from dotmac.platform.file_storage.router import batch_operation

        operations_request = FileOperationRequest(
            file_ids=["file-1"],
            operation="delete",
            destination=None,
        )

        with pytest.raises(HTTPException) as exc_info:
            await batch_operation(
                request=mock_request, operations=operations_request, current_user=mock_user
            )

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "batch operation failed" in exc_info.value.detail.lower()
