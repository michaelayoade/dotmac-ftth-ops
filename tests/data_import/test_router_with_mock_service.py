"""Router tests with mocked service layer - focused on coverage."""

import io
import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo, create_access_token
from dotmac.platform.data_import.models import (
    ImportFailure,
    ImportJob,
    ImportJobStatus,
    ImportJobType,
)
from dotmac.platform.data_import.service import ImportResult
from dotmac.platform.main import app

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_user():
    """Mock authenticated user."""

    return UserInfo(
        user_id="test-user-123",
        username="testuser",
        email="test@example.com",
        tenant_id="test-tenant",
        roles=["admin"],
        permissions=["data_import:read", "data_import:write"],
    )


@pytest.fixture
def auth_headers(mock_user):
    """Create authentication headers with JWT token."""
    token = create_access_token(
        user_id=mock_user.user_id,
        username=mock_user.username,
        email=mock_user.email,
        tenant_id=mock_user.tenant_id,
        roles=mock_user.roles,
        permissions=mock_user.permissions,
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": mock_user.tenant_id,
    }


@pytest.fixture
def mock_import_service():
    """Mock DataImportService."""
    return AsyncMock()


@pytest.fixture
def test_client():
    """Test client for making HTTP requests."""
    return TestClient(app)


def create_mock_job(
    job_id: str = None, status: ImportJobStatus = ImportJobStatus.COMPLETED
) -> MagicMock:
    """Create a mock ImportJob."""
    job = MagicMock(spec=ImportJob)
    job.id = job_id or str(uuid4())
    job.tenant_id = "test-tenant"
    job.job_type = ImportJobType.CUSTOMERS
    job.status = status
    job.file_name = "test.csv"
    job.file_size = 1024
    job.file_format = "csv"
    job.total_records = 10
    job.processed_records = 10
    job.successful_records = 10
    job.failed_records = 0
    job.progress_percentage = 100.0
    job.success_rate = 100.0
    job.started_at = datetime.now(UTC)
    job.completed_at = datetime.now(UTC)
    job.duration_seconds = 10.5
    job.error_message = None
    job.celery_task_id = None
    job.summary = {}
    job.config = {}
    job.initiated_by = None
    job.created_at = datetime.now(UTC)
    job.updated_at = datetime.now(UTC)
    return job


class TestUploadEndpoints:
    """Test file upload endpoints."""

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_upload_csv_customers(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test uploading customer CSV file."""
        csv_content = b"name,email\nJohn Doe,john@example.com\n"
        job_id = str(uuid4())

        # Setup mocks
        mock_service_class.return_value = mock_import_service
        mock_result = ImportResult(
            job_id=job_id, total_records=1, successful_records=1, failed_records=0
        )
        mock_import_service.import_customers_csv.return_value = mock_result
        mock_import_service.get_import_job.return_value = create_mock_job(job_id)

        response = test_client.post(
            "/api/v1/data-import/upload/customers",
            files={"file": ("customers.csv", io.BytesIO(csv_content), "text/csv")},
            data={"batch_size": "100", "dry_run": "false", "use_async": "false"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert str(data["id"]) == job_id
        assert data["file_format"] == "csv"

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_upload_json_customers(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test uploading customer JSON file."""
        json_data = [{"name": "John", "email": "john@example.com"}]
        json_content = json.dumps(json_data).encode()
        job_id = str(uuid4())

        mock_service_class.return_value = mock_import_service
        mock_result = ImportResult(job_id=job_id, total_records=1, successful_records=1)
        mock_import_service.import_customers_json.return_value = mock_result
        mock_import_service.get_import_job.return_value = create_mock_job(job_id)

        response = test_client.post(
            "/api/v1/data-import/upload/customers",
            files={"file": ("customers.json", io.BytesIO(json_content), "application/json")},
            data={"batch_size": "50", "dry_run": "false", "use_async": "false"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_upload_csv_invoices(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test uploading invoice CSV file."""
        csv_content = b"invoice_number,amount\nINV-001,100.00\n"
        job_id = str(uuid4())

        mock_service_class.return_value = mock_import_service
        mock_result = ImportResult(job_id=job_id, total_records=1, successful_records=1)
        mock_import_service.import_invoices_csv.return_value = mock_result
        mock_job = create_mock_job(job_id)
        mock_job.job_type = ImportJobType.INVOICES
        mock_import_service.get_import_job.return_value = mock_job

        response = test_client.post(
            "/api/v1/data-import/upload/invoices",
            files={"file": ("invoices.csv", io.BytesIO(csv_content), "text/csv")},
            data={"batch_size": "100", "dry_run": "false", "use_async": "false"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["job_type"] == "invoices"

    def test_upload_invalid_entity_type(self, test_client, auth_headers):
        """Test uploading with invalid entity type."""
        csv_content = b"data\n"

        response = test_client.post(
            "/api/v1/data-import/upload/invalid_type",
            files={"file": ("data.csv", io.BytesIO(csv_content), "text/csv")},
            data={"batch_size": "100"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid entity type" in response.json()["detail"]

    def test_upload_invalid_file_format(self, test_client, auth_headers):
        """Test uploading unsupported file format."""
        xml_content = b"<data></data>"

        response = test_client.post(
            "/api/v1/data-import/upload/customers",
            files={"file": ("data.xml", io.BytesIO(xml_content), "application/xml")},
            data={"batch_size": "100"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "CSV or JSON" in response.json()["detail"]

    def test_upload_no_filename(self, test_client, auth_headers):
        """Test uploading file without filename."""
        csv_content = b"name,email\nTest,test@example.com\n"

        response = test_client.post(
            "/api/v1/data-import/upload/customers",
            files={"file": ("", io.BytesIO(csv_content), "text/csv")},
            data={"batch_size": "100"},
            headers=auth_headers,
        )

        # FastAPI returns 422 for validation errors (no filename is a validation error)
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        ]


class TestJobManagement:
    """Test job retrieval and management endpoints."""

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_get_job_success(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test getting import job."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service
        mock_import_service.get_import_job.return_value = create_mock_job(job_id)

        response = test_client.get(f"/api/v1/data-import/jobs/{job_id}", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert str(data["id"]) == job_id

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_get_job_not_found(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test getting non-existent job."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service
        mock_import_service.get_import_job.return_value = None

        response = test_client.get(f"/api/v1/data-import/jobs/{job_id}", headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_list_jobs(self, mock_service_class, test_client, auth_headers, mock_import_service):
        """Test listing import jobs."""
        mock_service_class.return_value = mock_import_service
        mock_jobs = [create_mock_job(str(uuid4())) for _ in range(3)]
        mock_import_service.list_import_jobs.return_value = mock_jobs

        response = test_client.get("/api/v1/data-import/jobs", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["jobs"]) == 3

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_list_jobs_with_filters(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test listing jobs with status filter."""
        mock_service_class.return_value = mock_import_service
        mock_import_service.list_import_jobs.return_value = []

        response = test_client.get(
            "/api/v1/data-import/jobs",
            params={"status": ImportJobStatus.COMPLETED.value, "limit": 10},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        # Verify service was called with correct parameters
        mock_import_service.list_import_jobs.assert_called_once()

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_get_job_status(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test getting job status."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service
        mock_import_service.get_import_job.return_value = create_mock_job(
            job_id, ImportJobStatus.IN_PROGRESS
        )

        response = test_client.get(
            f"/api/v1/data-import/jobs/{job_id}/status", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["job_id"] == job_id
        assert "progress_percentage" in data

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_get_job_status_not_found(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test getting status of non-existent job."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service
        mock_import_service.get_import_job.return_value = None

        response = test_client.get(
            f"/api/v1/data-import/jobs/{job_id}/status", headers=auth_headers
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("celery.result.AsyncResult")
    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_get_job_status_with_celery_task(
        self, mock_service_class, mock_async_result, test_client, auth_headers, mock_import_service
    ):
        """Test getting job status when Celery task is running."""
        job_id = str(uuid4())
        mock_job = create_mock_job(job_id, ImportJobStatus.IN_PROGRESS)
        mock_job.celery_task_id = "task-123"

        mock_service_class.return_value = mock_import_service
        mock_import_service.get_import_job.return_value = mock_job

        # Mock Celery task state
        mock_task = MagicMock()
        mock_task.state = "PROGRESS"
        mock_async_result.return_value = mock_task

        response = test_client.get(
            f"/api/v1/data-import/jobs/{job_id}/status", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["celery_task_status"] == "processing"


class TestFailureManagement:
    """Test failure retrieval endpoints."""

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_get_failures(self, mock_service_class, test_client, auth_headers, mock_import_service):
        """Test getting import failures."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service

        mock_failure = MagicMock(spec=ImportFailure)
        mock_failure.row_number = 5
        mock_failure.error_type = "ValidationError"
        mock_failure.error_message = "Invalid email"
        mock_failure.row_data = {"email": "invalid"}
        mock_failure.field_errors = {"email": "Must be valid email"}

        mock_import_service.get_import_failures.return_value = [mock_failure]

        response = test_client.get(
            f"/api/v1/data-import/jobs/{job_id}/failures", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["row_number"] == 5

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_export_failures_csv(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test exporting failures as CSV."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service

        mock_failure = MagicMock()
        mock_failure.row_number = 5
        mock_failure.error_message = "Invalid"
        mock_failure.row_data = {"name": "Test"}

        mock_import_service.get_import_failures.return_value = [mock_failure]

        response = test_client.get(
            f"/api/v1/data-import/jobs/{job_id}/export-failures",
            params={"format": "csv"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        assert "text/csv" in response.headers["content-type"]

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_export_failures_json(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test exporting failures as JSON."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service

        mock_failure = MagicMock()
        mock_failure.row_number = 5
        mock_failure.error_message = "Invalid"
        mock_failure.row_data = {"name": "Test"}

        mock_import_service.get_import_failures.return_value = [mock_failure]

        response = test_client.get(
            f"/api/v1/data-import/jobs/{job_id}/export-failures",
            params={"format": "json"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        assert "application/json" in response.headers["content-type"]

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_export_failures_not_found(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test exporting when no failures exist."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service
        mock_import_service.get_import_failures.return_value = []

        response = test_client.get(
            f"/api/v1/data-import/jobs/{job_id}/export-failures",
            params={"format": "csv"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestJobCancellation:
    """Test job cancellation endpoint."""

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_cancel_job_success(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test canceling an import job."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service
        mock_job = create_mock_job(job_id, ImportJobStatus.IN_PROGRESS)
        mock_import_service.get_import_job.return_value = mock_job

        response = test_client.delete(f"/api/v1/data-import/jobs/{job_id}", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "cancelled"

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_cancel_nonexistent_job(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test canceling non-existent job."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service
        mock_import_service.get_import_job.return_value = None

        response = test_client.delete(f"/api/v1/data-import/jobs/{job_id}", headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_cancel_completed_job(
        self, mock_service_class, test_client, auth_headers, mock_import_service
    ):
        """Test canceling already completed job."""
        job_id = str(uuid4())
        mock_service_class.return_value = mock_import_service
        mock_job = create_mock_job(job_id, ImportJobStatus.COMPLETED)
        mock_import_service.get_import_job.return_value = mock_job

        response = test_client.delete(f"/api/v1/data-import/jobs/{job_id}", headers=auth_headers)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Cannot cancel" in response.json()["detail"]

    @patch("celery.result.AsyncResult")
    @patch("dotmac.platform.data_import.router.DataImportService")
    def test_cancel_job_with_celery_task(
        self, mock_service_class, mock_async_result, test_client, auth_headers, mock_import_service
    ):
        """Test canceling job with Celery task."""
        job_id = str(uuid4())
        mock_job = create_mock_job(job_id, ImportJobStatus.IN_PROGRESS)
        mock_job.celery_task_id = "task-123"

        mock_service_class.return_value = mock_import_service
        mock_import_service.get_import_job.return_value = mock_job

        # Mock Celery task
        mock_task = MagicMock()
        mock_async_result.return_value = mock_task

        response = test_client.delete(f"/api/v1/data-import/jobs/{job_id}", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        mock_task.revoke.assert_called_once_with(terminate=True)
