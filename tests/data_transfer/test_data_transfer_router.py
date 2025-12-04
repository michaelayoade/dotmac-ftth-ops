"""
Comprehensive tests for data transfer router endpoints.

Tests all FastAPI endpoints including:
- Import data endpoint
- Export data endpoint
- Job status endpoint
- List jobs endpoint
- Cancel job endpoint
- List formats endpoint
- Error handling and authentication
"""

from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from dotmac.platform.data_transfer.router import data_transfer_router

pytestmark = pytest.mark.integration


@pytest.fixture
def client():
    """Create test client with mocked authentication."""
    from uuid import uuid4

    from fastapi import FastAPI

    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.auth.rbac_dependencies import require_admin

    app = FastAPI()

    # Override RBAC dependency to return authenticated user
    def override_require_admin():
        return UserInfo(
            user_id=str(uuid4()),
            email="test@example.com",
            username="testuser",
            tenant_id=str(uuid4()),
            roles=["admin"],
            permissions=["read", "write"],
        )

    app.dependency_overrides[require_admin] = override_require_admin
    app.include_router(data_transfer_router)  # Router already has prefix="/data-transfer"
    return TestClient(app)


@pytest.fixture
def anonymous_client():
    """Create test client for anonymous access."""
    from fastapi import FastAPI

    from dotmac.platform.auth.rbac_dependencies import require_admin

    app = FastAPI()

    # Override RBAC dependency to allow anonymous access
    def override_require_admin():
        return None

    app.dependency_overrides[require_admin] = override_require_admin
    app.include_router(data_transfer_router)  # Router already has prefix="/data-transfer"
    return TestClient(app)


@pytest.fixture
def sample_import_request():
    """Sample import request data."""
    return {
        "source_type": "file",
        "source_path": "/path/to/file.csv",
        "format": "csv",
        "batch_size": 1000,
        "encoding": "utf-8",
        "validation_level": "basic",
    }


@pytest.fixture
def sample_export_request():
    """Sample export request data."""
    return {
        "target_type": "file",
        "target_path": "/path/to/output.csv",
        "format": "csv",
        "compression": "none",
        "batch_size": 1000,
        "encoding": "utf-8",
    }


class TestImportEndpoint:
    """Test the /import endpoint."""

    def test_import_data_success_with_user(self, client, sample_import_request):
        """Test successful import with authenticated user."""
        response = client.post("/data-transfer/import", json=sample_import_request)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["type"] == "import"
        assert data["status"] == "pending"
        assert data["progress"] == 0.0
        assert data["records_processed"] == 0
        assert data["records_failed"] == 0
        assert data["records_total"] is None
        assert UUID(data["job_id"]) is not None
        assert "name" in data
        assert "created_at" in data
        assert "metadata" in data

        # Check metadata
        metadata = data["metadata"]
        assert metadata["source_type"] == "file"
        assert metadata["format"] == "csv"
        assert metadata["batch_size"] == 1000

    def test_import_data_success_anonymous(self, anonymous_client, sample_import_request):
        """Test successful import with anonymous user."""
        response = anonymous_client.post("/data-transfer/import", json=sample_import_request)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["type"] == "import"

    def test_import_data_invalid_request(self, client):
        """Test import with invalid request data."""
        invalid_request = {
            "source_type": "invalid_source",
            "source_path": "",
            "format": "invalid_format",
        }

        response = client.post("/data-transfer/import", json=invalid_request)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_import_data_with_all_fields(self, client):
        """Test import with all optional fields."""
        request_data = {
            "source_type": "file",
            "source_path": "/path/to/file.csv",
            "format": "csv",
            "batch_size": 500,
            "encoding": "utf-16",
            "validation_level": "strict",
            "mapping": {"col1": "field1", "col2": "field2"},
            "options": {"delimiter": ";", "header_row": 1},
        }

        response = client.post("/data-transfer/import", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        metadata = data["metadata"]
        assert metadata["batch_size"] == 500

    @patch("dotmac.platform.data_transfer.router.uuid4")
    def test_import_data_exception_handling(self, mock_uuid4, client, sample_import_request):
        """Test exception handling in import endpoint."""
        mock_uuid4.side_effect = Exception("UUID generation failed")

        response = client.post("/data-transfer/import", json=sample_import_request)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to create import job"


class TestExportEndpoint:
    """Test the /export endpoint."""

    def test_export_data_success_with_user(self, client, sample_export_request):
        """Test successful export with authenticated user."""
        response = client.post("/data-transfer/export", json=sample_export_request)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["type"] == "export"
        assert data["status"] == "pending"
        assert data["progress"] == 0.0
        assert UUID(data["job_id"]) is not None

        # Check metadata
        metadata = data["metadata"]
        assert metadata["target_type"] == "file"
        assert metadata["format"] == "csv"
        assert metadata["compression"] == "none"

    def test_export_data_success_anonymous(self, anonymous_client, sample_export_request):
        """Test successful export with anonymous user."""
        response = anonymous_client.post("/data-transfer/export", json=sample_export_request)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["type"] == "export"

    def test_export_data_with_compression(self, client):
        """Test export with compression."""
        request_data = {
            "target_type": "file",
            "target_path": "/path/to/output.csv.gz",
            "format": "csv",
            "compression": "gzip",
            "batch_size": 2000,
            "encoding": "utf-8",
        }

        response = client.post("/data-transfer/export", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        metadata = data["metadata"]
        assert metadata["compression"] == "gzip"

    def test_export_data_invalid_request(self, client):
        """Test export with invalid request data."""
        invalid_request = {
            "target_type": "invalid_target",
            "target_path": "",
            "format": "invalid_format",
        }

        response = client.post("/data-transfer/export", json=invalid_request)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @patch("dotmac.platform.data_transfer.router.uuid4")
    def test_export_data_exception_handling(self, mock_uuid4, client, sample_export_request):
        """Test exception handling in export endpoint."""
        mock_uuid4.side_effect = Exception("UUID generation failed")

        response = client.post("/data-transfer/export", json=sample_export_request)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to create export job"


class TestJobStatusEndpoint:
    """Test the /jobs/{job_id} endpoint."""

    def test_get_job_status_success(self, client):
        """Test getting job status successfully."""
        job_id = str(uuid4())
        response = client.get(f"/data-transfer/jobs/{job_id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
        assert data["progress"] == 100.0
        assert data["records_processed"] == 1000
        assert data["records_failed"] == 0

    def test_get_job_status_anonymous(self, anonymous_client):
        """Test getting job status as anonymous user."""
        job_id = str(uuid4())
        response = anonymous_client.get(f"/data-transfer/jobs/{job_id}")

        assert response.status_code == status.HTTP_200_OK

    def test_get_job_status_invalid_uuid(self, client):
        """Test getting job status with invalid UUID."""
        response = client.get("/data-transfer/jobs/invalid-uuid")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "Invalid job ID format"

    @patch("dotmac.platform.data_transfer.router.datetime")
    def test_get_job_status_exception_handling(self, mock_datetime, client):
        """Test exception handling in job status endpoint."""
        job_id = str(uuid4())
        mock_datetime.now.side_effect = Exception("Datetime error")

        response = client.get(f"/data-transfer/jobs/{job_id}")

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to get job status"


class TestListJobsEndpoint:
    """Test the /jobs endpoint."""

    def test_list_jobs_success(self, client):
        """Test listing jobs successfully."""
        response = client.get("/data-transfer/jobs")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "jobs" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "has_more" in data
        assert data["total"] == 0
        assert data["jobs"] == []

    def test_list_jobs_with_filters(self, client):
        """Test listing jobs with filters."""
        response = client.get(
            "/data-transfer/jobs?type=import&status=completed&page=1&page_size=10"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 10

    def test_list_jobs_anonymous(self, anonymous_client):
        """Test listing jobs as anonymous user."""
        response = anonymous_client.get("/data-transfer/jobs")

        assert response.status_code == status.HTTP_200_OK


class TestCancelJobEndpoint:
    """Test the DELETE /jobs/{job_id} endpoint."""

    def test_cancel_job_success(self, client):
        """Test cancelling a job successfully."""
        job_id = str(uuid4())
        response = client.delete(f"/data-transfer/jobs/{job_id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert f"Job {job_id} cancelled" in data["message"]

    def test_cancel_job_anonymous(self, anonymous_client):
        """Test cancelling a job as anonymous user."""
        job_id = str(uuid4())
        response = anonymous_client.delete(f"/data-transfer/jobs/{job_id}")

        assert response.status_code == status.HTTP_200_OK


class TestFormatsEndpoint:
    """Test the /formats endpoint."""

    def test_list_formats_success(self, client):
        """Test listing supported formats successfully."""
        response = client.get("/data-transfer/formats")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "import_formats" in data
        assert "export_formats" in data
        assert "compression_types" in data

        # Check format details
        import_formats = data["import_formats"]
        assert len(import_formats) == 4  # CSV, JSON, Excel, XML

        csv_format = next(f for f in import_formats if f["format"] == "csv")
        assert csv_format["name"] == "Comma-Separated Values"
        assert csv_format["supports_compression"] is True
        assert csv_format["supports_streaming"] is True

        # Check compression types
        compression_types = data["compression_types"]
        assert "none" in compression_types
        assert "gzip" in compression_types
        assert "zip" in compression_types
        assert "bzip2" in compression_types

    def test_list_formats_anonymous(self, anonymous_client):
        """Test listing formats as anonymous user."""
        response = anonymous_client.get("/data-transfer/formats")

        assert response.status_code == status.HTTP_200_OK


class TestRouterIntegration:
    """Test router integration and configuration."""

    def test_router_is_configured(self):
        """Test that the router is properly configured."""
        assert data_transfer_router.prefix == "/data-transfer"
        assert len(data_transfer_router.routes) > 0

    def test_router_response_models(self):
        """Test that endpoints have correct response models."""
        routes = {
            route.path: route for route in data_transfer_router.routes if hasattr(route, "path")
        }

        # Check import endpoint (path includes prefix)
        import_route = routes.get("/data-transfer/import")
        assert import_route is not None
        assert import_route.methods == {"POST"}

        # Check export endpoint (path includes prefix)
        export_route = routes.get("/data-transfer/export")
        assert export_route is not None
        assert export_route.methods == {"POST"}

    def test_endpoint_http_methods(self):
        """Test that endpoints accept correct HTTP methods."""
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(data_transfer_router)  # Router already has prefix="/data-transfer"

        routes = {
            f"{route.path}:{list(route.methods)[0]}"
            for route in app.routes
            if hasattr(route, "methods") and route.methods
        }

        assert "/data-transfer/import:POST" in routes
        assert "/data-transfer/export:POST" in routes
        assert "/data-transfer/jobs/{job_id}:GET" in routes
        assert "/data-transfer/jobs:GET" in routes
        assert "/data-transfer/jobs/{job_id}:DELETE" in routes
        assert "/data-transfer/formats:GET" in routes
