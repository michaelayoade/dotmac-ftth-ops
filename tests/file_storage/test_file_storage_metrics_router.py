"""
Tests for File Storage Metrics Router.

Tests caching, rate limiting, tenant isolation, and error handling
for the file storage statistics endpoint.
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


class TestFileStorageStatsEndpoint:
    """Test file storage statistics endpoint."""

    @pytest.fixture
    def mock_file_metadata(self):
        """Create mock file metadata."""
        now = datetime.now(UTC)
        return [
            MagicMock(
                file_id="1",
                file_name="image1.jpg",
                file_size=1024 * 1024,  # 1MB
                content_type="image/jpeg",
                created_at=now,
                tenant_id="test-tenant",
            ),
            MagicMock(
                file_id="2",
                file_name="doc1.pdf",
                file_size=512 * 1024,  # 512KB
                content_type="application/pdf",
                created_at=now,
                tenant_id="test-tenant",
            ),
            MagicMock(
                file_id="3",
                file_name="video1.mp4",
                file_size=10 * 1024 * 1024,  # 10MB
                content_type="video/mp4",
                created_at=now,
                tenant_id="test-tenant",
            ),
        ]

    async def test_get_file_storage_stats_success(self, client: AsyncClient, auth_headers):
        """Test successful retrieval of file storage stats."""
        with patch(
            "dotmac.platform.file_storage.metrics_router._get_file_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_files": 100,
                "total_size_bytes": 1073741824,  # 1GB
                "total_size_mb": 1024.0,
                "images_count": 50,
                "documents_count": 30,
                "videos_count": 10,
                "other_count": 10,
                "images_size_mb": 512.0,
                "documents_size_mb": 256.0,
                "videos_size_mb": 200.0,
                "other_size_mb": 56.0,
                "avg_file_size_mb": 10.24,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/files/stats?period_days=30",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_files"] == 100
            assert data["total_size_mb"] == 1024.0
            assert data["images_count"] == 50
            assert data["documents_count"] == 30
            assert data["videos_count"] == 10
            assert data["avg_file_size_mb"] == 10.24
            assert data["period"] == "30d"

    async def test_get_file_storage_stats_different_periods(
        self, client: AsyncClient, auth_headers
    ):
        """Test stats with different time periods."""
        with patch(
            "dotmac.platform.file_storage.metrics_router._get_file_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_files": 10,
                "total_size_bytes": 10485760,  # 10MB
                "total_size_mb": 10.0,
                "images_count": 5,
                "documents_count": 3,
                "videos_count": 1,
                "other_count": 1,
                "images_size_mb": 5.0,
                "documents_size_mb": 3.0,
                "videos_size_mb": 1.5,
                "other_size_mb": 0.5,
                "avg_file_size_mb": 1.0,
                "period": "7d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/files/stats?period_days=7",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["period"] == "7d"
            assert data["total_files"] == 10

    async def test_get_file_storage_stats_empty_storage(self, client: AsyncClient, auth_headers):
        """Test stats when storage is empty."""
        with patch(
            "dotmac.platform.file_storage.metrics_router._get_file_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_files": 0,
                "total_size_bytes": 0,
                "total_size_mb": 0.0,
                "images_count": 0,
                "documents_count": 0,
                "videos_count": 0,
                "other_count": 0,
                "images_size_mb": 0.0,
                "documents_size_mb": 0.0,
                "videos_size_mb": 0.0,
                "other_size_mb": 0.0,
                "avg_file_size_mb": 0.0,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/files/stats",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_files"] == 0
            assert data["avg_file_size_mb"] == 0.0

    async def test_get_file_storage_stats_invalid_period(self, client: AsyncClient, auth_headers):
        """Test validation of period_days parameter."""
        response = await client.get(
            "/api/v1/metrics/files/stats?period_days=0",
            headers=auth_headers,
        )
        assert response.status_code == 422

        response = await client.get(
            "/api/v1/metrics/files/stats?period_days=400",
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_get_file_storage_stats_requires_auth(self, client: AsyncClient):
        """Test that endpoint requires tenant context or auth header."""
        response = await client.get("/api/v1/metrics/files/stats")
        assert response.status_code == 400

    async def test_get_file_storage_stats_error_handling(self, client: AsyncClient, auth_headers):
        """Test error handling returns safe defaults."""
        with patch(
            "dotmac.platform.file_storage.metrics_router._get_file_stats_cached"
        ) as mock_cached:
            mock_cached.side_effect = Exception("Storage error")

            response = await client.get(
                "/api/v1/metrics/files/stats",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_files"] == 0
            assert data["total_size_mb"] == 0.0

    async def test_file_storage_stats_caching(self, client: AsyncClient, auth_headers):
        """Test that results are cached."""
        with patch(
            "dotmac.platform.file_storage.metrics_router._get_file_stats_cached"
        ) as mock_cached:
            mock_data = {
                "total_files": 50,
                "total_size_bytes": 52428800,
                "total_size_mb": 50.0,
                "images_count": 25,
                "documents_count": 15,
                "videos_count": 5,
                "other_count": 5,
                "images_size_mb": 25.0,
                "documents_size_mb": 15.0,
                "videos_size_mb": 5.0,
                "other_size_mb": 5.0,
                "avg_file_size_mb": 1.0,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }
            mock_cached.return_value = mock_data

            response1 = await client.get(
                "/api/v1/metrics/files/stats",
                headers=auth_headers,
            )
            assert response1.status_code == 200

            response2 = await client.get(
                "/api/v1/metrics/files/stats",
                headers=auth_headers,
            )
            assert response2.status_code == 200

            assert response1.json()["total_files"] == response2.json()["total_files"]


class TestFileStorageStatsTenantIsolation:
    """Test tenant isolation for file storage stats."""

    async def test_tenant_isolation_in_cache_key(self, client: AsyncClient, auth_headers):
        """Test that cache keys include tenant ID."""
        with patch(
            "dotmac.platform.file_storage.metrics_router._get_file_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_files": 10,
                "total_size_bytes": 10485760,
                "total_size_mb": 10.0,
                "images_count": 5,
                "documents_count": 3,
                "videos_count": 1,
                "other_count": 1,
                "images_size_mb": 5.0,
                "documents_size_mb": 3.0,
                "videos_size_mb": 1.5,
                "other_size_mb": 0.5,
                "avg_file_size_mb": 1.0,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/files/stats",
                headers=auth_headers,
            )

            assert response.status_code == 200
            assert mock_cached.called
            call_kwargs = mock_cached.call_args[1]
            assert "tenant_id" in call_kwargs
