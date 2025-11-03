"""
API tests for tenant provisioning endpoints.
"""

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from httpx import AsyncClient

from dotmac.platform.tenant.models import TenantDeploymentMode, TenantProvisioningStatus
from dotmac.platform.tenant.provisioning_service import TenantProvisioningConflictError

pytestmark = pytest.mark.integration


def _job_factory(
    tenant_id: str,
    job_id: str = "job-123",
    status: TenantProvisioningStatus = TenantProvisioningStatus.QUEUED,
) -> SimpleNamespace:
    """Build a simple object with the attributes expected by response models."""
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=job_id,
        tenant_id=tenant_id,
        status=status,
        deployment_mode=TenantDeploymentMode.DOTMAC_HOSTED,
        awx_template_id=99,
        awx_job_id=None,
        requested_by="ops-user",
        started_at=None,
        finished_at=None,
        retry_count=0,
        error_message=None,
        extra_vars={"region": "dc1"},
        connection_profile=None,
        last_acknowledged_at=None,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_schedule_provisioning_job(
    async_client: AsyncClient,
    mock_provisioning_service,
    monkeypatch,
):
    """Ensure scheduling endpoint enqueues job creation and returns payload."""
    tenant_id = "tenant-ops"
    job = _job_factory(tenant_id)
    mock_provisioning_service.create_job.return_value = job

    captured_enqueues: list[str] = []
    monkeypatch.setattr(
        "dotmac.platform.tenant.router.enqueue_tenant_provisioning",
        lambda job_id: captured_enqueues.append(job_id),
    )

    response = await async_client.post(
        f"/api/v1/tenants/{tenant_id}/provisioning/jobs",
        json={"deployment_mode": "dotmac_hosted", "awx_template_id": 99},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == job.id
    assert body["status"] == "queued"
    assert captured_enqueues == [job.id]

    mock_provisioning_service.create_job.assert_awaited_once()
    args, kwargs = mock_provisioning_service.create_job.await_args
    assert args[0] == tenant_id
    assert kwargs["requested_by"] == "test-user-123"


@pytest.mark.asyncio
async def test_schedule_provisioning_job_conflict(
    async_client: AsyncClient, mock_provisioning_service
):
    """Conflict from service should map to HTTP 409."""
    mock_provisioning_service.create_job.side_effect = TenantProvisioningConflictError(
        "active job exists"
    )

    response = await async_client.post(
        "/api/v1/tenants/conflict-tenant/provisioning/jobs",
        json={"deployment_mode": "dotmac_hosted"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "active job exists"


@pytest.mark.asyncio
async def test_list_provisioning_jobs(async_client: AsyncClient, mock_provisioning_service):
    """Listing endpoint should serialize job collection."""
    tenant_id = "tenant-ops"
    job = _job_factory(tenant_id, job_id="job-456", status=TenantProvisioningStatus.SUCCEEDED)
    mock_provisioning_service.list_jobs.return_value = ([job], 1)

    response = await async_client.get(f"/api/v1/tenants/{tenant_id}/provisioning/jobs")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == "job-456"
    assert payload["items"][0]["status"] == "succeeded"


@pytest.mark.asyncio
async def test_get_provisioning_job(async_client: AsyncClient, mock_provisioning_service):
    """Retrieve job details endpoint."""
    tenant_id = "tenant-ops"
    job = _job_factory(tenant_id, job_id="job-789")
    mock_provisioning_service.get_job.return_value = job

    response = await async_client.get(f"/api/v1/tenants/{tenant_id}/provisioning/jobs/{job.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job.id
    assert data["deployment_mode"] == "dotmac_hosted"
    mock_provisioning_service.get_job.assert_awaited_once_with(tenant_id, job.id)
