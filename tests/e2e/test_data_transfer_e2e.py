
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

from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

# Pytest marker for E2E tests




pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]

@pytest_asyncio.fixture
async def data_transfer_app():
    """Create FastAPI app with data transfer router for E2E testing."""
    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.data_transfer.router import data_transfer_router

    app = FastAPI(title="Data Transfer E2E Test App")
    app.include_router(data_transfer_router, prefix="/api/v1/data-transfer", tags=["Data Transfer"])

    # Override auth dependency
    async def override_get_current_user():
        return UserInfo(
            user_id="test-user-123",
            username="testuser",
            email="test@example.com",
            permissions=["read", "write", "admin"],
            roles=["user", "admin"],
            tenant_id="test-tenant",
        )

    app.dependency_overrides[get_current_user] = override_get_current_user

    return app


@pytest_asyncio.fixture
async def client(data_transfer_app):
    """Async HTTP client for E2E testing."""
    transport = ASGITransport(app=data_transfer_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


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
    async def test_get_job_status_success(self, client):
        """Test getting status of existing job."""
        job_id = str(uuid4())

        response = await client.get(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
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
    async def test_get_job_status_shows_timestamps(self, client):
        """Test that job status includes all timestamps."""
        job_id = str(uuid4())

        response = await client.get(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200
        data = response.json()
        assert "created_at" in data
        assert "started_at" in data
        assert "completed_at" in data

    @pytest.mark.asyncio
    async def test_get_job_status_shows_progress(self, client):
        """Test that job status shows progress information."""
        job_id = str(uuid4())

        response = await client.get(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200
        data = response.json()
        assert 0.0 <= data["progress"] <= 100.0
        assert data["records_processed"] >= 0
        assert data["records_failed"] >= 0


# ============================================================================
# Job Listing E2E Tests
# ============================================================================


class TestJobListingE2E:
    """E2E tests for listing jobs."""

    @pytest.mark.asyncio
    async def test_list_all_jobs(self, client):
        """Test listing all jobs."""
        response = await client.get("/api/v1/data-transfer/jobs")

        assert response.status_code == 200
        data = response.json()
        assert "jobs" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "has_more" in data
        assert isinstance(data["jobs"], list)

    @pytest.mark.asyncio
    async def test_list_jobs_with_pagination(self, client):
        """Test listing jobs with pagination."""
        response = await client.get("/api/v1/data-transfer/jobs?page=2&page_size=10")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["page_size"] == 10

    @pytest.mark.asyncio
    async def test_list_jobs_filter_by_type(self, client):
        """Test filtering jobs by type."""
        response = await client.get("/api/v1/data-transfer/jobs?type=import")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["jobs"], list)

    @pytest.mark.asyncio
    async def test_list_jobs_filter_by_status(self, client):
        """Test filtering jobs by status."""
        response = await client.get("/api/v1/data-transfer/jobs?status=completed")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["jobs"], list)

    @pytest.mark.asyncio
    async def test_list_jobs_combined_filters(self, client):
        """Test filtering jobs with multiple criteria."""
        response = await client.get(
            "/api/v1/data-transfer/jobs?type=export&status=pending&page=1&page_size=20"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 20

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
    async def test_cancel_job_success(self, client):
        """Test successfully cancelling a job."""
        job_id = str(uuid4())

        response = await client.delete(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert job_id in data["message"]
        assert "cancelled" in data["message"]

    @pytest.mark.asyncio
    async def test_cancel_running_job(self, client):
        """Test cancelling a currently running job."""
        job_id = str(uuid4())

        response = await client.delete(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200
        data = response.json()
        assert "cancelled" in data["message"]

    @pytest.mark.asyncio
    async def test_cancel_pending_job(self, client):
        """Test cancelling a pending job."""
        job_id = str(uuid4())

        response = await client.delete(f"/api/v1/data-transfer/jobs/{job_id}")

        assert response.status_code == 200


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
