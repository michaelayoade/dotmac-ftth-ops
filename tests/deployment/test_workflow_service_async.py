"""Tests for workflow deployment service using AsyncSession."""

from datetime import datetime

import pytest

pytestmark = pytest.mark.integration
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.deployment.adapters.base import DeploymentResult, ExecutionStatus
from dotmac.platform.deployment.models import (
    DeploymentBackend,
    DeploymentInstance,
    DeploymentState,
    DeploymentTemplate,
    DeploymentType,
)
from dotmac.platform.deployment.workflow_service import WorkflowDeploymentService


class _StubAdapter:
    """Simple deployment adapter stub that always succeeds."""

    def __init__(self, config=None):  # noqa: D401, ANN001
        self.config = config or {}

    async def provision(self, context):  # noqa: D401, ANN001
        now = datetime.utcnow()
        return DeploymentResult(
            status=ExecutionStatus.SUCCEEDED,
            message="provisioned",
            endpoints={"ui": "https://tenant-42.example.com"},
            metadata={"namespace": context.namespace},
            started_at=now,
            completed_at=now,
        )


@pytest.mark.asyncio
async def test_workflow_provision_uses_async_session(
    async_db_session: AsyncSession, monkeypatch
) -> None:
    """Provisioning via workflow should work with AsyncSession-backed services."""

    template = DeploymentTemplate(
        name="k8s-basic",
        display_name="K8s Basic",
        description="Test template",
        backend=DeploymentBackend.KUBERNETES,
        deployment_type=DeploymentType.CLOUD_SHARED,
        version="1.0.0",
        cpu_cores=2,
        memory_gb=4,
        storage_gb=20,
        is_active=True,
    )
    async_db_session.add(template)
    await async_db_session.commit()
    await async_db_session.refresh(template)

    monkeypatch.setattr(
        "dotmac.platform.deployment.adapters.factory.AdapterFactory.create_adapter",
        lambda backend, config=None: _StubAdapter(config),
    )

    workflow_service = WorkflowDeploymentService(async_db_session)

    response = await workflow_service.provision_tenant(
        customer_id=123,
        license_key="LIC-123",
        deployment_type="kubernetes",
        tenant_id=42,
        environment="production",
        region="us-east-1",
    )

    assert response["tenant_id"] == 42
    assert response["status"] == DeploymentState.ACTIVE.value
    result = await async_db_session.execute(select(DeploymentInstance))
    instances = result.scalars().all()
    assert len(instances) == 1
    assert str(instances[0].tenant_id) == "42"
