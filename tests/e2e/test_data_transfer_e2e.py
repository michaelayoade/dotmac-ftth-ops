"""
End-to-End tests for Data Transfer API.

Tests complete workflows through the API router, covering:
- Data import operations
- Data export operations
- Job status tracking
- Job listing and filtering
- Job cancellation
- Format discovery

This E2E test suite covers the following modules:
- src/dotmac/platform/data_transfer/router.py (router)
- src/dotmac/platform/data_transfer/models.py (models)
- src/dotmac/platform/data_transfer/core.py (enums)
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import pytest_asyncio

from dotmac.platform.data_transfer.core import TransferStatus
from dotmac.platform.data_transfer.models import TransferType
from dotmac.platform.data_transfer.repository import TransferJobRepository

# Pytest marker for E2E tests


pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


@pytest_asyncio.fixture
async def db_session(e2e_db_session):
    """Use the per-test E2E database session."""
    yield e2e_db_session


@pytest.fixture(autouse=True)
def stub_data_transfer_tasks(monkeypatch):
    """Avoid hitting real Celery brokers during tests."""
    from dotmac.platform.data_transfer import tasks

    import_delay = MagicMock(name="import_delay")
    export_delay = MagicMock(name="export_delay")
    monkeypatch.setattr(tasks.process_import_job, "delay", import_delay)
    monkeypatch.setattr(tasks.process_export_job, "delay", export_delay)


@pytest.fixture
def client(async_client, auth_headers):
    """Authenticated HTTP client wrapper that injects headers automatically."""

    class AuthenticatedClient:
        def __init__(self, http_client, headers):
            self._client = http_client
            self._headers = headers

        def _merged_headers(self, extra):
            merged = dict(self._headers)
            if extra:
                merged.update(extra)
            return merged

        async def get(self, url: str, **kwargs):
            headers = self._merged_headers(kwargs.pop("headers", None))
            return await self._client.get(url, headers=headers, **kwargs)

        async def post(self, url: str, **kwargs):
            headers = self._merged_headers(kwargs.pop("headers", None))
            return await self._client.post(url, headers=headers, **kwargs)

        async def delete(self, url: str, **kwargs):
            headers = self._merged_headers(kwargs.pop("headers", None))
            return await self._client.delete(url, headers=headers, **kwargs)

    return AuthenticatedClient(async_client, auth_headers)


@pytest.fixture
def create_transfer_job(db_session, tenant_id):
    """Factory for inserting transfer jobs directly via the repository."""
    repo = TransferJobRepository(db_session)

    async def _create(
        *,
        job_type: TransferType = TransferType.IMPORT,
        status: TransferStatus = TransferStatus.PENDING,
        name: str = "Test Job",
        config=None,
        metadata=None,
        import_source=None,
        source_path=None,
        export_target=None,
        target_path=None,
        update_fields=None,
    ):
        job_id = uuid4()

        config = config or {"format": "csv", "batch_size": 1000}
        metadata = metadata or {"user_id": "e2e"}

        if job_type == TransferType.IMPORT:
            import_source = import_source or "file"
            source_path = source_path or "/data/import.csv"
        else:
            export_target = export_target or "file"
            target_path = target_path or "/data/export.csv"

        job = await repo.create_job(
            job_id=job_id,
            name=name,
            job_type=job_type,
            tenant_id=tenant_id,
            config=config,
            metadata=metadata,
            import_source=import_source,
            source_path=source_path,
            export_target=export_target,
            target_path=target_path,
        )

        update_kwargs = update_fields or {}
        if status != TransferStatus.PENDING or update_kwargs:
            await repo.update_job_status(job_id, status, **update_kwargs)
            job = await repo.get_job(job_id, tenant_id)

        return job

    return _create


# ============================================================================
# Import Operations E2E Tests
# ============================================================================


class TestImportDataE2E:
    """E2E tests for data import workflows."""

    @pytest.mark.asyncio
    async def test_import_from_csv_file(self, client):
        """Test importing data from CSV file."""
        import_request = {
            "source_type": "file",
            "source_path": "/data/imports/customers.csv",
            "format": "csv",
            "validation_level": "basic",
            "batch_size": 1000,
            "encoding": "utf-8",
            "skip_errors": False,
            "dry_run": False,
        }

        response = await client.post("/api/v1/data-transfer/import", json=import_request)

        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert data["type"] == "import"
        assert data["status"] == "pending"
        assert data["progress"] == 0.0
        assert data["records_processed"] == 0
        assert data["metadata"]["source_type"] == "file"
        assert data["metadata"]["format"] == "csv"
        assert data["metadata"]["batch_size"] == 1000

    @pytest.mark.asyncio
    async def test_import_from_database(self, client):
        """Test importing data from database source."""
        import_request = {
            "source_type": "database",
            "source_path": "postgresql://localhost:5432/source_db",
            "format": "json",
            "validation_level": "strict",
            "batch_size": 500,
            "mapping": {"old_id": "new_id", "customer_name": "name"},
            "options": {
                "table": "customers",
                "query": "SELECT * FROM customers WHERE active = true",
            },
        }

        response = await client.post("/api/v1/data-transfer/import", json=import_request)

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "import"
        assert "Import from database" in data["name"]
        assert data["metadata"]["format"] == "json"

    @pytest.mark.asyncio
    async def test_import_from_s3(self, client):
        """Test importing data from S3."""
        import_request = {
            "source_type": "s3",
            "source_path": "s3://my-bucket/data/export.json",
            "format": "json",
            "validation_level": "none",
            "batch_size": 2000,
            "options": {"region": "us-east-1", "bucket": "my-bucket"},
        }

        response = await client.post("/api/v1/data-transfer/import", json=import_request)

        assert response.status_code == 200
        data = response.json()
        assert data["metadata"]["source_type"] == "s3"

    @pytest.mark.asyncio
    async def test_import_from_api(self, client):
        """Test importing data from API endpoint."""
        import_request = {
            "source_type": "api",
            "source_path": "https://api.example.com/v1/data",
            "format": "json",
            "validation_level": "basic",
            "batch_size": 100,
            "options": {"method": "GET", "headers": {"Authorization": "Bearer token"}},
        }

        response = await client.post("/api/v1/data-transfer/import", json=import_request)

        assert response.status_code == 200
        data = response.json()
        assert data["metadata"]["source_type"] == "api"

    @pytest.mark.asyncio
    async def test_import_with_field_mapping(self, client):
        """Test import with custom field mapping."""
        import_request = {
            "source_type": "file",
            "source_path": "/data/legacy_data.csv",
            "format": "csv",
            "validation_level": "basic",
            "batch_size": 1000,
            "mapping": {
                "customer_id": "id",
                "customer_name": "name",
                "email_address": "email",
                "phone_number": "phone",
            },
        }

        response = await client.post("/api/v1/data-transfer/import", json=import_request)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_import_dry_run_mode(self, client):
        """Test import in dry-run mode (validation only)."""
        import_request = {
            "source_type": "file",
            "source_path": "/data/test.csv",
            "format": "csv",
            "validation_level": "strict",
            "batch_size": 1000,
            "dry_run": True,
        }

        response = await client.post("/api/v1/data-transfer/import", json=import_request)

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "import"

    @pytest.mark.asyncio
    async def test_import_with_error_skipping(self, client):
        """Test import with skip_errors enabled."""
        import_request = {
            "source_type": "file",
            "source_path": "/data/dirty_data.csv",
            "format": "csv",
            "validation_level": "basic",
            "batch_size": 500,
            "skip_errors": True,
        }

        response = await client.post("/api/v1/data-transfer/import", json=import_request)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"


# ============================================================================
# Export Operations E2E Tests
# ============================================================================


class TestExportDataE2E:
    """E2E tests for data export workflows."""

    @pytest.mark.asyncio
    async def test_export_to_csv_file(self, client):
        """Test exporting data to CSV file."""
        export_request = {
            "target_type": "file",
            "target_path": "/exports/customers_export.csv",
            "format": "csv",
            "compression": "gzip",
            "batch_size": 1000,
        }

        response = await client.post("/api/v1/data-transfer/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert data["type"] == "export"
        assert data["status"] == "pending"
        assert data["progress"] == 0.0
        assert data["metadata"]["target_type"] == "file"
        assert data["metadata"]["format"] == "csv"
        assert data["metadata"]["compression"] == "gzip"

    @pytest.mark.asyncio
    async def test_export_to_json_with_compression(self, client):
        """Test exporting to JSON with different compression."""
        export_request = {
            "target_type": "file",
            "target_path": "/exports/data_export.json.zip",
            "format": "json",
            "compression": "zip",
            "batch_size": 500,
            "options": {"indent": 2, "sort_keys": True},
        }

        response = await client.post("/api/v1/data-transfer/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert data["metadata"]["compression"] == "zip"

    @pytest.mark.asyncio
    async def test_export_to_excel(self, client):
        """Test exporting to Excel format."""
        export_request = {
            "target_type": "file",
            "target_path": "/exports/report.xlsx",
            "format": "excel",
            "compression": "none",
            "batch_size": 10000,
            "options": {"sheet_name": "Customers", "include_index": False},
        }

        response = await client.post("/api/v1/data-transfer/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert data["metadata"]["format"] == "excel"

    @pytest.mark.asyncio
    async def test_export_to_s3(self, client):
        """Test exporting data to S3."""
        export_request = {
            "target_type": "s3",
            "target_path": "s3://backup-bucket/exports/data_2024.csv",
            "format": "csv",
            "compression": "gzip",
            "batch_size": 2000,
            "options": {"region": "us-west-2", "storage_class": "STANDARD_IA"},
        }

        response = await client.post("/api/v1/data-transfer/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert data["metadata"]["target_type"] == "s3"

    @pytest.mark.asyncio
    async def test_export_to_email(self, client):
        """Test exporting data as email attachment."""
        export_request = {
            "target_type": "email",
            "target_path": "reports@example.com",
            "format": "csv",
            "compression": "zip",
            "batch_size": 1000,
            "options": {
                "subject": "Daily Export Report",
                "message": "Please find attached export",
            },
        }

        response = await client.post("/api/v1/data-transfer/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert data["metadata"]["target_type"] == "email"

    @pytest.mark.asyncio
    async def test_export_to_database(self, client):
        """Test exporting data to database."""
        export_request = {
            "target_type": "database",
            "target_path": "postgresql://localhost:5432/target_db",
            "format": "json",
            "compression": "none",
            "batch_size": 500,
            "options": {"table": "exported_data", "mode": "append"},
        }

        response = await client.post("/api/v1/data-transfer/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "export"

    @pytest.mark.asyncio
    async def test_export_with_filters(self, client):
        """Test export with data filters."""
        export_request = {
            "target_type": "file",
            "target_path": "/exports/filtered_data.csv",
            "format": "csv",
            "compression": "none",
            "batch_size": 1000,
            "filters": {"status": "active", "created_after": "2024-01-01"},
        }

        response = await client.post("/api/v1/data-transfer/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"


# ============================================================================
# Job Status Tracking E2E Tests
# ============================================================================


class TestJobStatusE2E:
    """E2E tests for job status tracking."""

    @pytest.mark.asyncio
    async def test_get_job_status_success(self, client, create_transfer_job):
        """Test getting status of existing job."""
        job = await create_transfer_job(
            status=TransferStatus.COMPLETED,
            job_type=TransferType.IMPORT,
            update_fields={
                "progress_percentage": 100.0,
                "processed_records": 1000,
                "failed_records": 0,
                "total_records": 1000,
            },
        )

        response = await client.get(f"/api/v1/data-transfer/jobs/{job.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == str(job.id)
        assert data["status"] == "completed"
        assert data["progress"] == 100.0
        assert data["records_processed"] == 1000
        assert data["records_failed"] == 0
        assert data["records_total"] == 1000

    @pytest.mark.asyncio
    async def test_get_job_status_invalid_uuid(self, client):
        """Test getting status with invalid UUID format."""
        invalid_id = "not-a-uuid"

        response = await client.get(f"/api/v1/data-transfer/jobs/{invalid_id}")

        assert response.status_code == 400
        data = response.json()
        assert "Invalid job ID format" in data["detail"]

    @pytest.mark.asyncio
    async def test_get_job_status_shows_timestamps(self, client, create_transfer_job):
        """Test that job status includes all timestamps."""
        started_at = datetime.now(UTC)
        completed_at = datetime.now(UTC)
        job = await create_transfer_job(
            status=TransferStatus.COMPLETED,
            update_fields={
                "started_at": started_at,
                "completed_at": completed_at,
            },
        )

        response = await client.get(f"/api/v1/data-transfer/jobs/{job.id}")

        assert response.status_code == 200
        data = response.json()
        assert "created_at" in data
        assert data["started_at"] is not None
        assert data["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_get_job_status_shows_progress(self, client, create_transfer_job):
        """Test that job status shows progress information."""
        job = await create_transfer_job(
            status=TransferStatus.RUNNING,
            update_fields={
                "progress_percentage": 42.5,
                "processed_records": 425,
                "failed_records": 5,
                "total_records": 1000,
            },
        )

        response = await client.get(f"/api/v1/data-transfer/jobs/{job.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["progress"] == pytest.approx(42.5)
        assert data["records_processed"] == 425
        assert data["records_failed"] == 5


# ============================================================================
# Job Listing E2E Tests
# ============================================================================


class TestJobListingE2E:
    """E2E tests for listing jobs."""

    @pytest.mark.asyncio
    async def test_list_all_jobs(self, client, create_transfer_job):
        """Test listing all jobs."""
        job1 = await create_transfer_job(name="Import Job A")
        job2 = await create_transfer_job(job_type=TransferType.EXPORT, name="Export Job B")

        response = await client.get("/api/v1/data-transfer/jobs")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2
        returned_ids = {job["job_id"] for job in data["jobs"]}
        assert str(job1.id) in returned_ids
        assert str(job2.id) in returned_ids

    @pytest.mark.asyncio
    async def test_list_jobs_with_pagination(self, client, create_transfer_job):
        """Test listing jobs with pagination."""
        for i in range(3):
            await create_transfer_job(name=f"Job {i}")

        response = await client.get("/api/v1/data-transfer/jobs?page=2&page_size=1")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["page_size"] == 1
        assert len(data["jobs"]) == 1
        assert data["total"] == 3

    @pytest.mark.asyncio
    async def test_list_jobs_filter_by_type(self, client, create_transfer_job):
        """Test filtering jobs by type."""
        await create_transfer_job(job_type=TransferType.IMPORT)
        export_job = await create_transfer_job(job_type=TransferType.EXPORT)

        response = await client.get("/api/v1/data-transfer/jobs?type=export")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert all(job["type"] == "export" for job in data["jobs"])
        assert str(export_job.id) in {job["job_id"] for job in data["jobs"]}

    @pytest.mark.asyncio
    async def test_list_jobs_filter_by_status(self, client, create_transfer_job):
        """Test filtering jobs by status."""
        await create_transfer_job(status=TransferStatus.PENDING)
        completed_job = await create_transfer_job(
            status=TransferStatus.COMPLETED,
            update_fields={"completed_at": datetime.now(UTC)},
        )

        response = await client.get("/api/v1/data-transfer/jobs?job_status=completed")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert all(job["status"] == "completed" for job in data["jobs"])
        assert str(completed_job.id) in {job["job_id"] for job in data["jobs"]}

    @pytest.mark.asyncio
    async def test_list_jobs_combined_filters(self, client, create_transfer_job):
        """Test filtering jobs with multiple criteria."""
        pending_export = await create_transfer_job(
            job_type=TransferType.EXPORT,
            status=TransferStatus.PENDING,
        )
        await create_transfer_job(job_type=TransferType.EXPORT, status=TransferStatus.COMPLETED)
        await create_transfer_job(job_type=TransferType.IMPORT, status=TransferStatus.PENDING)

        response = await client.get(
            "/api/v1/data-transfer/jobs?type=export&job_status=pending&page=1&page_size=20"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["total"] == 1
        assert data["jobs"][0]["job_id"] == str(pending_export.id)

    @pytest.mark.asyncio
    async def test_list_jobs_empty_result(self, client):
        """Test listing when no jobs exist."""
        response = await client.get("/api/v1/data-transfer/jobs")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["jobs"] == []
        assert data["has_more"] is False


# ============================================================================
# Job Cancellation E2E Tests
# ============================================================================


class TestJobCancellationE2E:
    """E2E tests for cancelling jobs."""

    @pytest.mark.asyncio
    async def test_cancel_job_success(self, client, create_transfer_job, db_session, tenant_id):
        """Test successfully cancelling a job."""
        job = await create_transfer_job()
        job_id = job.id

        response = await client.delete(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert str(job_id) in data["message"]
        assert "cancelled" in data["message"]

        db_session.expire_all()
        repo = TransferJobRepository(db_session)
        stored = await repo.get_job(job_id, tenant_id)
        assert stored.status == TransferStatus.CANCELLED.value

    @pytest.mark.asyncio
    async def test_cancel_running_job(self, client, create_transfer_job, db_session, tenant_id):
        """Test cancelling a currently running job."""
        job = await create_transfer_job(status=TransferStatus.RUNNING)
        job_id = job.id

        response = await client.delete(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200
        data = response.json()
        assert "cancelled" in data["message"]
        db_session.expire_all()
        repo = TransferJobRepository(db_session)
        stored = await repo.get_job(job_id, tenant_id)
        assert stored.status == TransferStatus.CANCELLED.value

    @pytest.mark.asyncio
    async def test_cancel_pending_job(self, client, create_transfer_job, db_session, tenant_id):
        """Test cancelling a pending job."""
        job = await create_transfer_job(status=TransferStatus.PENDING)
        job_id = job.id

        response = await client.delete(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200
        db_session.expire_all()
        repo = TransferJobRepository(db_session)
        stored = await repo.get_job(job_id, tenant_id)
        assert stored.status == TransferStatus.CANCELLED.value


# ============================================================================
# Format Discovery E2E Tests
# ============================================================================


class TestFormatDiscoveryE2E:
    """E2E tests for format discovery."""

    @pytest.mark.asyncio
    async def test_list_supported_formats(self, client):
        """Test listing all supported formats."""
        response = await client.get("/api/v1/data-transfer/formats")

        assert response.status_code == 200
        data = response.json()
        assert "import_formats" in data
        assert "export_formats" in data
        assert "compression_types" in data

        # Verify we have common formats
        import_formats = [f["format"] for f in data["import_formats"]]
        assert "csv" in import_formats
        assert "json" in import_formats
        assert "excel" in import_formats
        assert "xml" in import_formats

    @pytest.mark.asyncio
    async def test_format_details_include_metadata(self, client):
        """Test that format details include comprehensive metadata."""
        response = await client.get("/api/v1/data-transfer/formats")

        assert response.status_code == 200
        data = response.json()

        # Check CSV format details
        csv_format = next(f for f in data["import_formats"] if f["format"] == "csv")
        assert csv_format["name"] == "Comma-Separated Values"
        assert ".csv" in csv_format["file_extensions"]
        assert "text/csv" in csv_format["mime_types"]
        assert csv_format["supports_compression"] is True
        assert csv_format["supports_streaming"] is True
        assert "delimiter" in csv_format["options"]

    @pytest.mark.asyncio
    async def test_format_compression_types(self, client):
        """Test that compression types are listed."""
        response = await client.get("/api/v1/data-transfer/formats")

        assert response.status_code == 200
        data = response.json()

        compression_types = data["compression_types"]
        assert "none" in compression_types
        assert "gzip" in compression_types
        assert "zip" in compression_types
        assert "bzip2" in compression_types

    @pytest.mark.asyncio
    async def test_json_format_details(self, client):
        """Test JSON format specific details."""
        response = await client.get("/api/v1/data-transfer/formats")

        assert response.status_code == 200
        data = response.json()

        json_format = next(f for f in data["export_formats"] if f["format"] == "json")
        assert json_format["name"] == "JavaScript Object Notation"
        assert ".json" in json_format["file_extensions"]
        assert json_format["supports_compression"] is True
        assert "indent" in json_format["options"]

    @pytest.mark.asyncio
    async def test_excel_format_details(self, client):
        """Test Excel format specific details."""
        response = await client.get("/api/v1/data-transfer/formats")

        assert response.status_code == 200
        data = response.json()

        excel_format = next(f for f in data["import_formats"] if f["format"] == "excel")
        assert excel_format["name"] == "Microsoft Excel"
        assert ".xlsx" in excel_format["file_extensions"]
        assert excel_format["supports_compression"] is False
        assert "sheet_name" in excel_format["options"]


# ============================================================================
# Complete Workflow E2E Tests
# ============================================================================


class TestCompleteWorkflowE2E:
    """E2E tests for complete data transfer workflows."""

    @pytest.mark.asyncio
    async def test_complete_import_workflow(self, client):
        """Test complete import workflow: create → status → list → cancel."""
        # Step 1: Create import job
        import_request = {
            "source_type": "file",
            "source_path": "/data/customers.csv",
            "format": "csv",
            "validation_level": "basic",
            "batch_size": 1000,
        }

        create_response = await client.post("/api/v1/data-transfer/import", json=import_request)
        assert create_response.status_code == 200
        job_id = create_response.json()["job_id"]

        # Step 2: Check job status
        status_response = await client.get(f"/api/v1/data-transfer/jobs/{job_id}")
        assert status_response.status_code == 200
        assert status_response.json()["job_id"] == job_id

        # Step 3: List jobs (should include our job)
        list_response = await client.get("/api/v1/data-transfer/jobs?type=import")
        assert list_response.status_code == 200

        # Step 4: Cancel job
        cancel_response = await client.delete(f"/api/v1/data-transfer/jobs/{job_id}")
        assert cancel_response.status_code == 200

    @pytest.mark.asyncio
    async def test_complete_export_workflow(self, client):
        """Test complete export workflow: create → status → cancel."""
        # Step 1: Create export job
        export_request = {
            "target_type": "file",
            "target_path": "/exports/data.csv",
            "format": "csv",
            "compression": "gzip",
            "batch_size": 1000,
        }

        create_response = await client.post("/api/v1/data-transfer/export", json=export_request)
        assert create_response.status_code == 200
        job_id = create_response.json()["job_id"]

        # Step 2: Check status
        status_response = await client.get(f"/api/v1/data-transfer/jobs/{job_id}")
        assert status_response.status_code == 200

        # Step 3: Cancel
        cancel_response = await client.delete(f"/api/v1/data-transfer/jobs/{job_id}")
        assert cancel_response.status_code == 200

    @pytest.mark.asyncio
    async def test_format_discovery_before_import(self, client):
        """Test discovering formats before creating import."""
        # Step 1: Discover available formats
        formats_response = await client.get("/api/v1/data-transfer/formats")
        assert formats_response.status_code == 200
        formats = formats_response.json()

        # Step 2: Use discovered format in import
        available_format = formats["import_formats"][0]["format"]
        import_request = {
            "source_type": "file",
            "source_path": "/data/test.csv",
            "format": available_format,
            "validation_level": "basic",
            "batch_size": 1000,
        }

        import_response = await client.post("/api/v1/data-transfer/import", json=import_request)
        assert import_response.status_code == 200

    @pytest.mark.asyncio
    async def test_multiple_concurrent_jobs(self, client):
        """Test creating multiple jobs concurrently."""
        import asyncio

        async def create_import(i):
            return await client.post(
                "/api/v1/data-transfer/import",
                json={
                    "source_type": "file",
                    "source_path": f"/data/import{i}.csv",
                    "format": "csv",
                    "validation_level": "basic",
                    "batch_size": 1000,
                },
            )

        # Create 3 import jobs concurrently
        responses = await asyncio.gather(*[create_import(i) for i in range(3)])

        # All should succeed
        assert all(r.status_code == 200 for r in responses)

        # All should have unique job IDs
        job_ids = [r.json()["job_id"] for r in responses]
        assert len(set(job_ids)) == 3
