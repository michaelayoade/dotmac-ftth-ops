"""
Jobs Router Integration Tests

Tests for BSS Phase 1 async job tracking endpoints.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.jobs.models import Job, JobStatus
from dotmac.platform.tenant.models import Tenant

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestJobEndpoints:
    """Test job tracking endpoints."""

    async def test_create_job_success(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
    ):
        """Test creating a new job."""
        job_data = {
            "job_type": "data_import",
            "title": "Test Data Import",
            "description": "Testing job creation",
            "items_total": 100,
            "parameters": {"file_path": "/tmp/test.csv", "batch_size": 10},
        }

        response = await async_client.post(
            "/api/v1/jobs",
            json=job_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["job_type"] == "data_import"
        assert data["title"] == "Test Data Import"
        assert data["status"] == JobStatus.PENDING.value
        assert data["items_total"] == 100
        assert "id" in data
        assert "created_at" in data

    async def test_create_job_missing_required_fields(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        """Test creating job with missing required fields."""
        job_data = {
            "job_type": "data_import",
            # Missing title and items_total
        }

        response = await async_client.post(
            "/api/v1/jobs",
            json=job_data,
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    async def test_list_jobs(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test listing all jobs."""
        # Create test jobs
        job1 = Job(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            job_type="data_import",
            title="Import Job 1",
            items_total=50,
            status=JobStatus.PENDING.value,
            created_by="test_user",
        )
        job2 = Job(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            job_type="data_export",
            title="Export Job 2",
            items_total=100,
            status=JobStatus.COMPLETED.value,
            created_by="test_user",
        )
        db_session.add_all([job1, job2])
        await db_session.commit()

        response = await async_client.get(
            "/api/v1/jobs",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "jobs" in data
        assert data["total"] >= 2
        job_titles = [job["title"] for job in data["jobs"]]
        assert "Import Job 1" in job_titles or "Export Job 2" in job_titles

    async def test_get_job_by_id(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting a specific job by ID."""
        job = Job(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            job_type="data_import",
            title="Test Job",
            items_total=50,
            status=JobStatus.RUNNING.value,
            progress_percent=45,
            items_processed=22,
            created_by="test_user",
        )
        db_session.add(job)
        await db_session.commit()

        response = await async_client.get(
            f"/api/v1/jobs/{job.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == job.id
        assert data["title"] == "Test Job"
        assert data["status"] == JobStatus.RUNNING.value
        assert data["progress_percent"] == 45

    async def test_update_job_progress(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test updating job progress."""
        job = Job(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            job_type="data_import",
            title="Progress Test Job",
            items_total=100,
            status=JobStatus.RUNNING.value,
            created_by="test_user",
        )
        db_session.add(job)
        await db_session.commit()

        update_data = {
            "status": JobStatus.RUNNING.value,
            "progress_percent": 75,
            "items_processed": 75,
            "items_succeeded": 70,
            "items_failed": 5,
        }

        response = await async_client.patch(
            f"/api/v1/jobs/{job.id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["progress_percent"] == 75
        assert data["items_processed"] == 75
        assert data["items_succeeded"] == 70
        assert data["items_failed"] == 5

    async def test_cancel_job(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test cancelling a running job."""
        job = Job(
            id=str(uuid4()),
            tenant_id=str(test_tenant.id),
            job_type="data_import",
            title="Cancel Test Job",
            items_total=100,
            status=JobStatus.RUNNING.value,
            created_by="test_user",
        )
        db_session.add(job)
        await db_session.commit()

        response = await async_client.post(
            f"/api/v1/jobs/{job.id}/cancel",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == JobStatus.CANCELLED.value
        assert "cancelled_at" in data

    async def test_filter_jobs_by_status(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test filtering jobs by status."""
        # Create jobs with different statuses
        for i, status in enumerate([JobStatus.PENDING, JobStatus.RUNNING, JobStatus.COMPLETED]):
            job = Job(
                id=str(uuid4()),
                tenant_id=str(test_tenant.id),
                job_type="data_import",
                title=f"Job {i}",
                items_total=50,
                status=status.value,
                created_by="test_user",
            )
            db_session.add(job)
        await db_session.commit()

        response = await async_client.get(
            f"/api/v1/jobs?status={JobStatus.RUNNING.value}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "jobs" in data
        assert all(job["status"] == JobStatus.RUNNING.value for job in data["jobs"])

    async def test_filter_jobs_by_type(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test filtering jobs by job type."""
        # Create jobs with different types
        for i, job_type in enumerate(["data_import", "data_export", "bulk_update"]):
            job = Job(
                id=str(uuid4()),
                tenant_id=str(test_tenant.id),
                job_type=job_type,
                title=f"Job {i}",
                items_total=50,
                status=JobStatus.PENDING.value,
                created_by="test_user",
            )
            db_session.add(job)
        await db_session.commit()

        response = await async_client.get(
            "/api/v1/jobs?job_type=data_import",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "jobs" in data
        assert all(job["job_type"] == "data_import" for job in data["jobs"])

    async def test_get_job_statistics(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting job statistics."""
        # Create jobs with different statuses
        statuses = [
            JobStatus.PENDING,
            JobStatus.RUNNING,
            JobStatus.COMPLETED,
            JobStatus.FAILED,
        ]
        for status in statuses:
            job = Job(
                id=str(uuid4()),
                tenant_id=str(test_tenant.id),
                job_type="data_import",
                title=f"Job {status.value}",
                items_total=100,
                items_processed=100 if status == JobStatus.COMPLETED else 0,
                items_succeeded=90 if status == JobStatus.COMPLETED else 0,
                items_failed=10 if status == JobStatus.COMPLETED else 0,
                status=status.value,
                created_by="test_user",
            )
            db_session.add(job)
        await db_session.commit()

        response = await async_client.get(
            "/api/v1/jobs/statistics",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_jobs" in data
        assert "pending_jobs" in data
        assert "running_jobs" in data
        assert "completed_jobs" in data
        assert "failed_jobs" in data
        assert data["total_jobs"] >= 4


@pytest.mark.asyncio
class TestJobTenantIsolation:
    """Test tenant isolation in job endpoints."""

    async def test_jobs_are_tenant_isolated(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that jobs are isolated by tenant."""
        # Create job for a different tenant
        other_tenant_id = str(uuid4())
        other_job = Job(
            id=str(uuid4()),
            tenant_id=other_tenant_id,
            job_type="data_import",
            title="Other Tenant Job",
            items_total=50,
            status=JobStatus.PENDING.value,
            created_by="other_user",
        )
        db_session.add(other_job)
        await db_session.commit()

        # List jobs should not include other tenant's job
        response = await async_client.get(
            "/api/v1/jobs",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        job_titles = [job["title"] for job in data["jobs"]]
        assert "Other Tenant Job" not in job_titles

    async def test_cannot_access_other_tenant_job(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that users cannot access jobs from other tenants."""
        # Create job for a different tenant
        other_tenant_id = str(uuid4())
        other_job = Job(
            id=str(uuid4()),
            tenant_id=other_tenant_id,
            job_type="data_import",
            title="Other Tenant Job",
            items_total=50,
            status=JobStatus.PENDING.value,
            created_by="other_user",
        )
        db_session.add(other_job)
        await db_session.commit()

        # Try to access the other tenant's job
        response = await async_client.get(
            f"/api/v1/jobs/{other_job.id}",
            headers=auth_headers,
        )

        assert response.status_code == 404
