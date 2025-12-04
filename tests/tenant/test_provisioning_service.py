"""
Tests for tenant provisioning service logic.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from dotmac.platform.tenant.models import (
    Base,
    TenantDeploymentMode,
    TenantPlanType,
    TenantProvisioningStatus,
    TenantStatus,
)
from dotmac.platform.tenant.provisioning_service import (
    TenantProvisioningConflictError,
    TenantProvisioningService,
)
from dotmac.platform.tenant.schemas import TenantCreate, TenantProvisioningJobCreate
from dotmac.platform.tenant.service import TenantService

pytestmark = pytest.mark.unit


@pytest_asyncio.fixture
async def async_db():
    """Create an in-memory database for provisioning tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def tenant_service(async_db: AsyncSession) -> TenantService:
    """Tenant service backed by the in-memory DB."""
    return TenantService(db=async_db)


@pytest_asyncio.fixture
async def provisioning_service(async_db: AsyncSession) -> TenantProvisioningService:
    """Provisioning service under test."""
    return TenantProvisioningService(db=async_db)


async def _create_tenant(tenant_service: TenantService) -> str:
    tenant = await tenant_service.create_tenant(
        TenantCreate(
            name="Provisioning Test Org",
            slug="provisioning-test",
            email="ops@example.com",
            plan_type=TenantPlanType.STARTER,
        ),
        created_by="unit-test",
    )
    return tenant.id


@pytest.mark.asyncio
async def test_create_job_sets_provisioning_state(
    tenant_service: TenantService,
    provisioning_service: TenantProvisioningService,
    async_db: AsyncSession,
):
    """Creating a job should enqueue provisioning and update tenant metadata."""
    tenant_id = await _create_tenant(tenant_service)

    payload = TenantProvisioningJobCreate(
        deployment_mode=TenantDeploymentMode.DOTMAC_HOSTED,
        awx_template_id=101,
        extra_vars={"region": "dc1"},
    )
    job = await provisioning_service.create_job(tenant_id, payload, requested_by="ops-user")

    assert job.status == TenantProvisioningStatus.QUEUED
    assert job.deployment_mode == TenantDeploymentMode.DOTMAC_HOSTED
    assert job.extra_vars["region"] == "dc1"

    tenant = await tenant_service.get_tenant(tenant_id)
    assert tenant.status == TenantStatus.PROVISIONING
    assert tenant.custom_metadata["provisioning"]["last_job_id"] == job.id


@pytest.mark.asyncio
async def test_create_job_conflict_when_active(
    tenant_service: TenantService,
    provisioning_service: TenantProvisioningService,
):
    """A tenant cannot have multiple active provisioning jobs."""
    tenant_id = await _create_tenant(tenant_service)
    payload = TenantProvisioningJobCreate(deployment_mode=TenantDeploymentMode.DOTMAC_HOSTED)
    await provisioning_service.create_job(tenant_id, payload)

    with pytest.raises(TenantProvisioningConflictError):
        await provisioning_service.create_job(tenant_id, payload)


@pytest.mark.asyncio
async def test_update_status_transitions(
    tenant_service: TenantService,
    provisioning_service: TenantProvisioningService,
):
    """Updating status should stamp timestamps and job metadata."""
    tenant_id = await _create_tenant(tenant_service)
    payload = TenantProvisioningJobCreate(deployment_mode=TenantDeploymentMode.CUSTOMER_HOSTED)
    job = await provisioning_service.create_job(tenant_id, payload)

    in_progress = await provisioning_service.update_status(
        job.id,
        TenantProvisioningStatus.IN_PROGRESS,
        awx_job_id=42,
        requested_by="ops",
    )
    assert in_progress.awx_job_id == 42
    assert in_progress.started_at is not None

    completed = await provisioning_service.update_status(job.id, TenantProvisioningStatus.SUCCEEDED)
    assert completed.finished_at is not None
    assert completed.status == TenantProvisioningStatus.SUCCEEDED


@pytest.mark.asyncio
async def test_list_jobs_returns_entries(
    tenant_service: TenantService,
    provisioning_service: TenantProvisioningService,
):
    """Listing jobs should return paginated results."""
    tenant_id = await _create_tenant(tenant_service)
    payload = TenantProvisioningJobCreate(deployment_mode=TenantDeploymentMode.DOTMAC_HOSTED)
    await provisioning_service.create_job(tenant_id, payload)

    jobs, total = await provisioning_service.list_jobs(tenant_id, limit=10, offset=0)
    assert total == 1
    assert len(jobs) == 1
    assert jobs[0].tenant_id == tenant_id


@pytest.mark.asyncio
async def test_record_acknowledgement_updates_timestamp(
    tenant_service: TenantService,
    provisioning_service: TenantProvisioningService,
):
    """Acknowledgement endpoint should persist the acknowledgement timestamp."""
    tenant_id = await _create_tenant(tenant_service)
    payload = TenantProvisioningJobCreate(deployment_mode=TenantDeploymentMode.DOTMAC_HOSTED)
    job = await provisioning_service.create_job(tenant_id, payload)

    await provisioning_service.record_acknowledgement(job.id)
    refreshed = await provisioning_service.get_job(tenant_id, job.id)
    assert refreshed.last_acknowledged_at is not None
    assert refreshed.last_acknowledged_at.tzinfo is not None
