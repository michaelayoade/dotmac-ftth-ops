"""
Real tests for File Storage Metrics Router.

Uses the fake implementation pattern:
- Tests actual helper functions (categorize_content_type)
- Tests response model validation
- Tests endpoint with fake FileStorageService
"""

import sys
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

# Patch cached_result BEFORE importing the router


pytestmark = pytest.mark.integration


def mock_cached_result(*args, **kwargs):
    """Pass-through decorator that doesn't cache."""

    def decorator(func):
        return func

    return decorator


# Mock the cache decorator before the module is imported
with patch("dotmac.platform.billing.cache.cached_result", mock_cached_result):
    # Remove module from cache if it was already imported
    if "dotmac.platform.file_storage.metrics_router" in sys.modules:
        del sys.modules["dotmac.platform.file_storage.metrics_router"]

    from dotmac.platform.file_storage.metrics_router import (
        FileStatsResponse,
        _categorize_content_type,
        router,
    )

from dotmac.platform.auth.core import UserInfo  # noqa: E402
from dotmac.platform.auth.dependencies import get_current_user  # noqa: E402
from dotmac.platform.file_storage.service import (  # noqa: E402
    FileMetadata,
    get_storage_service,
)


def mock_current_user():
    """Mock current user for testing."""
    return UserInfo(
        user_id="test-user",
        email="test@example.com",
        tenant_id="test-tenant",
        roles=["admin"],
        permissions=["files:stats:read"],
    )


class FakeFileStorageService:
    """Fake file storage service for testing."""

    def __init__(self):
        self.files: list[FileMetadata] = []

    async def list_files(
        self,
        tenant_id: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> list[FileMetadata]:
        """Return list of files."""
        filtered = self.files
        if tenant_id:
            filtered = [f for f in filtered if f.tenant_id == tenant_id]

        return filtered[offset : offset + limit]

    def add_file(
        self,
        file_id: str,
        file_name: str,
        file_size: int,
        content_type: str,
        created_at: datetime,
        tenant_id: str = "test-tenant",
    ):
        """Add a file to the fake storage."""
        file_meta = FileMetadata(
            file_id=file_id,
            file_name=file_name,
            file_size=file_size,
            content_type=content_type,
            created_at=created_at,
            tenant_id=tenant_id,
        )
        self.files.append(file_meta)


@pytest.fixture
def fake_storage_service():
    """Create fake storage service."""
    return FakeFileStorageService()


@pytest.fixture
def app_with_router(fake_storage_service):
    """Create test app with file storage metrics router."""
    app = FastAPI()
    app.dependency_overrides[get_current_user] = mock_current_user
    app.dependency_overrides[get_storage_service] = lambda: fake_storage_service
    app.include_router(router, prefix="/api/v1")
    return app


@pytest.fixture
def client(app_with_router):
    """Create test client."""
    return TestClient(app_with_router)


class TestCategorizeContentType:
    """Test content type categorization helper function."""

    def test_categorize_image_types(self):
        """Test image content type categorization."""
        image_types = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
        ]
        for content_type in image_types:
            assert _categorize_content_type(content_type) == "image"

    def test_categorize_video_types(self):
        """Test video content type categorization."""
        video_types = [
            "video/mp4",
            "video/mpeg",
            "video/webm",
            "video/quicktime",
        ]
        for content_type in video_types:
            assert _categorize_content_type(content_type) == "video"

    def test_categorize_document_types(self):
        """Test document content type categorization."""
        doc_types = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "text/csv",
        ]
        for content_type in doc_types:
            assert _categorize_content_type(content_type) == "document"

    def test_categorize_other_types(self):
        """Test other content type categorization."""
        other_types = [
            "application/json",
            "application/zip",
            "application/x-tar",
            "audio/mpeg",
            "unknown/type",
        ]
        for content_type in other_types:
            assert _categorize_content_type(content_type) == "other"

    def test_categorize_case_insensitive(self):
        """Test that categorization is case-insensitive."""
        assert _categorize_content_type("IMAGE/JPEG") == "image"
        assert _categorize_content_type("Image/Png") == "image"
        assert _categorize_content_type("VIDEO/MP4") == "video"
        assert _categorize_content_type("Application/PDF") == "document"


class TestFileStatsResponse:
    """Test FileStatsResponse model."""

    def test_response_model_validation(self):
        """Test response model with valid data."""
        now = datetime.now(UTC)

        response = FileStatsResponse(
            total_files=100,
            total_size_bytes=1048576000,  # 1000 MB
            total_size_mb=1000.0,
            images_count=50,
            documents_count=30,
            videos_count=10,
            other_count=10,
            images_size_mb=500.0,
            documents_size_mb=300.0,
            videos_size_mb=150.0,
            other_size_mb=50.0,
            avg_file_size_mb=10.0,
            period="30d",
            timestamp=now,
        )

        assert response.total_files == 100
        assert response.total_size_mb == 1000.0
        assert response.images_count == 50
        assert response.avg_file_size_mb == 10.0

    def test_response_model_with_zeros(self):
        """Test response model with zero values."""
        response = FileStatsResponse(
            total_files=0,
            total_size_bytes=0,
            total_size_mb=0.0,
            images_count=0,
            documents_count=0,
            videos_count=0,
            other_count=0,
            images_size_mb=0.0,
            documents_size_mb=0.0,
            videos_size_mb=0.0,
            other_size_mb=0.0,
            avg_file_size_mb=0.0,
            period="7d",
            timestamp=datetime.now(UTC),
        )

        assert response.total_files == 0
        assert response.avg_file_size_mb == 0.0

    def test_response_model_calculations(self):
        """Test that calculations are correct in response."""
        # Total should equal sum of categories
        response = FileStatsResponse(
            total_files=100,  # Should equal images + docs + videos + other
            total_size_bytes=1048576000,
            total_size_mb=1000.0,  # Should equal sum of category sizes
            images_count=40,
            documents_count=30,
            videos_count=20,
            other_count=10,
            images_size_mb=400.0,
            documents_size_mb=300.0,
            videos_size_mb=200.0,
            other_size_mb=100.0,
            avg_file_size_mb=10.0,  # 1000 / 100
            period="30d",
            timestamp=datetime.now(UTC),
        )

        # Verify totals
        assert (
            response.images_count
            + response.documents_count
            + response.videos_count
            + response.other_count
            == response.total_files
        )

        total_category_size = (
            response.images_size_mb
            + response.documents_size_mb
            + response.videos_size_mb
            + response.other_size_mb
        )
        assert total_category_size == response.total_size_mb


class TestFileStorageStatsEndpoint:
    """Test file storage stats endpoint with fake service."""

    def test_get_stats_with_no_files(self, client, fake_storage_service):
        """Test stats endpoint with no files."""
        response = client.get(
            "/api/v1/metrics/files/stats?period_days=30",
            headers={"X-Tenant-ID": "test-tenant"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_files"] == 0
        assert data["total_size_mb"] == 0.0
        assert data["avg_file_size_mb"] == 0.0
        assert data["period"] == "30d"

    def test_get_stats_with_image_files(self, client, fake_storage_service):
        """Test stats with image files."""
        now = datetime.now(UTC)

        # Add 3 image files (1MB each)
        for i in range(3):
            fake_storage_service.add_file(
                file_id=f"img-{i}",
                file_name=f"photo{i}.jpg",
                file_size=1048576,  # 1 MB
                content_type="image/jpeg",
                created_at=now - timedelta(days=i),
            )

        response = client.get(
            "/api/v1/metrics/files/stats?period_days=30",
            headers={"X-Tenant-ID": "test-tenant"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_files"] == 3
        assert data["images_count"] == 3
        assert data["documents_count"] == 0
        assert data["videos_count"] == 0
        assert data["images_size_mb"] == 3.0

    def test_get_stats_with_mixed_file_types(self, client, fake_storage_service):
        """Test stats with mixed file types."""
        now = datetime.now(UTC)

        # Add different file types
        fake_storage_service.add_file(
            "img1", "photo.jpg", 1048576, "image/jpeg", now - timedelta(days=1)
        )
        fake_storage_service.add_file(
            "doc1", "report.pdf", 2097152, "application/pdf", now - timedelta(days=2)
        )
        fake_storage_service.add_file(
            "vid1", "video.mp4", 10485760, "video/mp4", now - timedelta(days=3)
        )
        fake_storage_service.add_file(
            "other1", "data.json", 524288, "application/json", now - timedelta(days=4)
        )

        response = client.get(
            "/api/v1/metrics/files/stats?period_days=30",
            headers={"X-Tenant-ID": "test-tenant"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_files"] == 4
        assert data["images_count"] == 1
        assert data["documents_count"] == 1
        assert data["videos_count"] == 1
        assert data["other_count"] == 1
        assert data["total_size_mb"] == 13.5  # 1 + 2 + 10 + 0.5

    def test_get_stats_filters_by_period(self, client, fake_storage_service):
        """Test that stats filters files by time period."""
        now = datetime.now(UTC)

        # Add files at different times
        fake_storage_service.add_file(
            "recent1", "recent.jpg", 1048576, "image/jpeg", now - timedelta(days=5)
        )
        fake_storage_service.add_file(
            "old1", "old.jpg", 1048576, "image/jpeg", now - timedelta(days=40)
        )

        # Request 7-day period - should only get recent file
        response = client.get(
            "/api/v1/metrics/files/stats?period_days=7",
            headers={"X-Tenant-ID": "test-tenant"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_files"] == 1  # Only recent file
        assert data["period"] == "7d"

        # Request 60-day period - should get both files
        response = client.get(
            "/api/v1/metrics/files/stats?period_days=60",
            headers={"X-Tenant-ID": "test-tenant"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_files"] == 2  # Both files
        assert data["period"] == "60d"

    def test_get_stats_calculates_averages(self, client, fake_storage_service):
        """Test average file size calculation."""
        now = datetime.now(UTC)

        # Add 4 files with different sizes (total 10 MB)
        sizes = [1048576, 2097152, 3145728, 4194304]  # 1, 2, 3, 4 MB
        for i, size in enumerate(sizes):
            fake_storage_service.add_file(
                f"file{i}",
                f"file{i}.bin",
                size,
                "application/octet-stream",
                now - timedelta(days=i),
            )

        response = client.get(
            "/api/v1/metrics/files/stats?period_days=30",
            headers={"X-Tenant-ID": "test-tenant"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_files"] == 4
        assert data["total_size_mb"] == 10.0
        assert data["avg_file_size_mb"] == 2.5  # 10 MB / 4 files

    def test_get_stats_with_different_periods(self, client, fake_storage_service):
        """Test stats with different time periods."""
        # Test period validation
        for days in [7, 30, 90, 365]:
            response = client.get(
                f"/api/v1/metrics/files/stats?period_days={days}",
                headers={"X-Tenant-ID": "test-tenant"},
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()["period"] == f"{days}d"

    def test_get_stats_tenant_isolation(self, client, fake_storage_service):
        """Test that stats are isolated per tenant."""
        now = datetime.now(UTC)

        # Add files for different tenants
        fake_storage_service.add_file(
            "file1", "file1.jpg", 1048576, "image/jpeg", now, tenant_id="test-tenant"
        )
        fake_storage_service.add_file(
            "file2", "file2.jpg", 1048576, "image/jpeg", now, tenant_id="other-tenant"
        )

        # Should only see test-tenant files (mocked user has tenant_id="test-tenant")
        response = client.get(
            "/api/v1/metrics/files/stats?period_days=30",
            headers={"X-Tenant-ID": "test-tenant"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_files"] == 1  # Only test-tenant file

    def test_get_stats_size_conversions(self, client, fake_storage_service):
        """Test byte to MB conversions."""
        now = datetime.now(UTC)

        # 1 MB = 1048576 bytes
        fake_storage_service.add_file("file1", "1mb.bin", 1048576, "application/octet-stream", now)

        response = client.get(
            "/api/v1/metrics/files/stats?period_days=30",
            headers={"X-Tenant-ID": "test-tenant"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_size_bytes"] == 1048576
        assert data["total_size_mb"] == 1.0
        assert data["other_size_mb"] == 1.0

    def test_get_stats_endpoint_exists(self, client):
        """Test that stats endpoint is registered."""
        response = client.get(
            "/api/v1/metrics/files/stats",
            headers={"X-Tenant-ID": "test-tenant"},
        )
        # Should return 200 (or possibly error, but not 404)
        assert response.status_code != status.HTTP_404_NOT_FOUND
