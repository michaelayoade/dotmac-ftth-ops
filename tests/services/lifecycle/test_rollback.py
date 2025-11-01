
"""
Tests for provisioning workflow rollback mechanisms.

Tests the ability to rollback failed provisioning workflows and
clean up allocated resources.
"""

from uuid import uuid4

import pytest
import pytest_asyncio

from dotmac.platform.services.lifecycle.models import (



    ProvisioningStatus,
    ProvisioningWorkflow,
    ServiceInstance,
    ServiceStatus,
    ServiceType,
)
from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService




pytestmark = pytest.mark.integration


def _unique_code(prefix: str) -> str:
    """Generate a short unique code for test entities."""
    return f"{prefix}-{uuid4().hex[:6].upper()}"


@pytest.fixture
def lifecycle_tenant_id() -> str:
    """Provide a unique tenant ID per test."""
    return f"tenant-rollback-{uuid4().hex[:8]}"

@pytest_asyncio.fixture
async def failed_service_with_workflow(
    async_session,
    lifecycle_tenant_id: str,
) -> tuple[ServiceInstance, ProvisioningWorkflow]:
    """Create a failed service instance with a failed provisioning workflow."""
    service = ServiceInstance(
        id=uuid4(),
        tenant_id=lifecycle_tenant_id,
        service_identifier=_unique_code("SVC-FAILED"),
        service_name="Failed Test Service",
        service_type=ServiceType.FIBER_INTERNET,
        customer_id=uuid4(),
        status=ServiceStatus.PROVISIONING_FAILED,
        provisioning_status=ProvisioningStatus.FAILED,
        service_config={},
        service_metadata={},
        # Simulate allocated resources that need rollback
        ip_address="10.0.1.100",
        vlan_id=100,
        equipment_assigned=["ONT-12345", "ROUTER-67890"],
        external_service_id="EXT-ABC123",
    )

    async_session.add(service)
    await async_session.flush()

    workflow = ProvisioningWorkflow(
        id=uuid4(),
        tenant_id=lifecycle_tenant_id,
        workflow_id=_unique_code("WF-FAILED"),
        workflow_type="provision",
        service_instance_id=service.id,
        status=ProvisioningStatus.FAILED,
        total_steps=5,
        current_step=3,
        completed_steps=["validation", "allocation"],
        failed_steps=["configuration"],
        rollback_required=False,
        rollback_completed=False,
        workflow_config={},
        step_results={},
        last_error="Equipment configuration failed",
    )

    async_session.add(workflow)
    await async_session.commit()
    await async_session.refresh(service)
    await async_session.refresh(workflow)

    return service, workflow


@pytest.mark.asyncio
async def test_rollback_provisioning_workflow_success(
    async_session, failed_service_with_workflow: tuple[ServiceInstance, ProvisioningWorkflow]
):
    """Test successful rollback of a failed provisioning workflow."""
    service_obj = LifecycleOrchestrationService(async_session)
    service_instance, workflow = failed_service_with_workflow

    # Verify initial state
    assert service_instance.ip_address == "10.0.1.100"
    assert service_instance.vlan_id == 100
    assert len(service_instance.equipment_assigned) == 2
    assert service_instance.external_service_id == "EXT-ABC123"

    # Execute rollback
    tenant_id = service_instance.tenant_id
    result = await service_obj.rollback_provisioning_workflow(
        service_instance_id=service_instance.id,
        tenant_id=tenant_id,
        rollback_reason="Test rollback - equipment configuration failed",
        user_id=uuid4(),
    )

    # Verify rollback result
    assert result["success"] is True
    assert result["service_instance_id"] == str(service_instance.id)
    assert result["workflow_id"] == workflow.workflow_id
    assert "ip_address_released" in result["rollback_steps"]
    assert "vlan_released" in result["rollback_steps"]
    assert "equipment_cleared" in result["rollback_steps"]
    assert "external_service_removed" in result["rollback_steps"]

    # Verify service instance was cleaned up
    await async_session.refresh(service_instance)
    assert service_instance.ip_address is None
    assert service_instance.vlan_id is None
    assert len(service_instance.equipment_assigned) == 0
    assert service_instance.external_service_id is None
    assert service_instance.status == ServiceStatus.FAILED
    assert service_instance.provisioning_status == ProvisioningStatus.ROLLED_BACK

    # Verify metadata was updated
    assert "rollback_reason" in service_instance.service_metadata
    assert "rollback_timestamp" in service_instance.service_metadata
    assert "rollback_steps" in service_instance.service_metadata

    # Verify workflow was marked as rolled back
    await async_session.refresh(workflow)
    assert workflow.status == ProvisioningStatus.ROLLED_BACK
    assert workflow.rollback_completed is True


@pytest.mark.asyncio
async def test_rollback_service_not_found(async_session, lifecycle_tenant_id: str):
    """Test rollback fails gracefully when service not found."""
    service_obj = LifecycleOrchestrationService(async_session)

    result = await service_obj.rollback_provisioning_workflow(
        service_instance_id=uuid4(),  # Non-existent service
        tenant_id=lifecycle_tenant_id,
        rollback_reason="Test rollback",
    )

    assert result["success"] is False
    assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_rollback_no_failed_workflow(async_session, lifecycle_tenant_id: str):
    """Test rollback fails when there's no failed workflow."""
    service_obj = LifecycleOrchestrationService(async_session)

    # Create a service without a failed workflow
    service = ServiceInstance(
        id=uuid4(),
        tenant_id=lifecycle_tenant_id,
        service_identifier=_unique_code("SVC-OK"),
        service_name="Service Without Failed Workflow",
        service_type=ServiceType.FIBER_INTERNET,
        customer_id=uuid4(),
        status=ServiceStatus.ACTIVE,
        service_config={},
        service_metadata={},
    )

    async_session.add(service)
    await async_session.commit()

    result = await service_obj.rollback_provisioning_workflow(
        service_instance_id=service.id,
        tenant_id=lifecycle_tenant_id,
        rollback_reason="Test rollback",
    )

    assert result["success"] is False
    assert "No failed workflow found" in result["error"]


@pytest.mark.asyncio
async def test_get_failed_workflows_for_rollback(
    async_session, failed_service_with_workflow: tuple[ServiceInstance, ProvisioningWorkflow]
):
    """Test retrieving failed workflows that need rollback."""
    service_obj = LifecycleOrchestrationService(async_session)
    service_instance, workflow = failed_service_with_workflow

    # Get failed workflows
    failed_workflows = await service_obj.get_failed_workflows_for_rollback(
        tenant_id=service_instance.tenant_id, limit=50
    )

    assert len(failed_workflows) == 1
    assert failed_workflows[0].id == workflow.id
    assert failed_workflows[0].status == ProvisioningStatus.FAILED
    assert failed_workflows[0].rollback_completed is False


@pytest.mark.asyncio
async def test_get_failed_workflows_excludes_completed_rollbacks(
    async_session, failed_service_with_workflow: tuple[ServiceInstance, ProvisioningWorkflow]
):
    """Test that completed rollbacks are not returned."""
    service_obj = LifecycleOrchestrationService(async_session)
    service_instance, workflow = failed_service_with_workflow
    tenant_id = service_instance.tenant_id

    # Execute rollback
    await service_obj.rollback_provisioning_workflow(
        service_instance_id=service_instance.id,
        tenant_id=tenant_id,
        rollback_reason="Test rollback",
    )

    # Get failed workflows again
    failed_workflows = await service_obj.get_failed_workflows_for_rollback(
        tenant_id=tenant_id, limit=50
    )

    # Should be empty now
    assert len(failed_workflows) == 0


@pytest.mark.asyncio
async def test_rollback_partial_resources(async_session, lifecycle_tenant_id: str):
    """Test rollback when only some resources are allocated."""
    service_obj = LifecycleOrchestrationService(async_session)

    # Create service with only IP allocated (no VLAN or equipment)
    service = ServiceInstance(
        id=uuid4(),
        tenant_id=lifecycle_tenant_id,
        service_identifier=_unique_code("SVC-PARTIAL"),
        service_name="Partially Provisioned Service",
        service_type=ServiceType.FIBER_INTERNET,
        customer_id=uuid4(),
        status=ServiceStatus.PROVISIONING_FAILED,
        provisioning_status=ProvisioningStatus.FAILED,
        service_config={},
        service_metadata={},
        ip_address="10.0.2.50",
        vlan_id=None,
        equipment_assigned=[],
        external_service_id=None,
    )

    async_session.add(service)
    await async_session.flush()

    workflow = ProvisioningWorkflow(
        id=uuid4(),
        tenant_id=lifecycle_tenant_id,
        workflow_id=_unique_code("WF-PARTIAL"),
        workflow_type="provision",
        service_instance_id=service.id,
        status=ProvisioningStatus.FAILED,
        total_steps=5,
        current_step=2,
        completed_steps=["validation"],
        failed_steps=["allocation"],
        rollback_required=False,
        rollback_completed=False,
        workflow_config={},
        step_results={},
    )

    async_session.add(workflow)
    await async_session.commit()

    # Execute rollback
    result = await service_obj.rollback_provisioning_workflow(
        service_instance_id=service.id,
        tenant_id=lifecycle_tenant_id,
        rollback_reason="Partial allocation failed",
    )

    assert result["success"] is True
    assert "ip_address_released" in result["rollback_steps"]
    # These should not be in rollback steps since they weren't allocated
    assert "vlan_released" not in result["rollback_steps"]
    assert "equipment_cleared" not in result["rollback_steps"]
    assert "external_service_removed" not in result["rollback_steps"]

    # Verify IP was released
    await async_session.refresh(service)
    assert service.ip_address is None


@pytest.mark.asyncio
async def test_rollback_multiple_workflows(async_session, lifecycle_tenant_id: str):
    """Test rolling back multiple failed workflows."""
    service_obj = LifecycleOrchestrationService(async_session)

    # Create 3 failed services with workflows
    services_and_workflows = []

    for i in range(3):
        service = ServiceInstance(
            id=uuid4(),
            tenant_id=lifecycle_tenant_id,
            service_identifier=_unique_code("SVC-MULTI"),
            service_name=f"Failed Service {i}",
            service_type=ServiceType.FIBER_INTERNET,
            customer_id=uuid4(),
            status=ServiceStatus.PROVISIONING_FAILED,
            provisioning_status=ProvisioningStatus.FAILED,
            service_config={},
            service_metadata={},
            ip_address=f"10.0.3.{i + 100}",
            vlan_id=100 + i,
        )

        async_session.add(service)
        await async_session.flush()

        workflow = ProvisioningWorkflow(
            id=uuid4(),
            tenant_id=lifecycle_tenant_id,
            workflow_id=_unique_code("WF-MULTI"),
            workflow_type="provision",
            service_instance_id=service.id,
            status=ProvisioningStatus.FAILED,
            total_steps=5,
            rollback_required=False,
            rollback_completed=False,
            workflow_config={},
            step_results={},
        )

        async_session.add(workflow)
        services_and_workflows.append((service, workflow))

    await async_session.commit()

    # Get all failed workflows
    failed_workflows = await service_obj.get_failed_workflows_for_rollback(
        tenant_id=lifecycle_tenant_id, limit=50
    )

    assert len(failed_workflows) == 3

    # Rollback each one
    for workflow in failed_workflows:
        result = await service_obj.rollback_provisioning_workflow(
            service_instance_id=workflow.service_instance_id,
            tenant_id=lifecycle_tenant_id,
            rollback_reason="Batch rollback",
        )
        assert result["success"] is True

    # Verify all workflows are now rolled back
    failed_workflows_after = await service_obj.get_failed_workflows_for_rollback(
        tenant_id=lifecycle_tenant_id, limit=50
    )

    assert len(failed_workflows_after) == 0


@pytest.mark.asyncio
async def test_rollback_tenant_isolation(async_session):
    """Test that rollback respects tenant boundaries."""
    service_obj = LifecycleOrchestrationService(async_session)

    # Create failed services for different tenants
    tenant1_id = f"tenant-{uuid4().hex[:6]}"
    tenant2_id = f"tenant-{uuid4().hex[:6]}"
    tenant1_service = ServiceInstance(
        id=uuid4(),
        tenant_id=tenant1_id,
        service_identifier=_unique_code("SVC-T1-FAIL"),
        service_name="Tenant 1 Failed Service",
        service_type=ServiceType.FIBER_INTERNET,
        customer_id=uuid4(),
        status=ServiceStatus.PROVISIONING_FAILED,
        provisioning_status=ProvisioningStatus.FAILED,
        service_config={},
        service_metadata={},
        ip_address="10.1.0.100",
    )

    tenant2_service = ServiceInstance(
        id=uuid4(),
        tenant_id=tenant2_id,
        service_identifier=_unique_code("SVC-T2-FAIL"),
        service_name="Tenant 2 Failed Service",
        service_type=ServiceType.FIBER_INTERNET,
        customer_id=uuid4(),
        status=ServiceStatus.PROVISIONING_FAILED,
        provisioning_status=ProvisioningStatus.FAILED,
        service_config={},
        service_metadata={},
        ip_address="10.2.0.100",
    )

    async_session.add_all([tenant1_service, tenant2_service])
    await async_session.flush()

    # Create workflows for both
    for service in [tenant1_service, tenant2_service]:
        tenant_prefix = str(service.tenant_id).replace("-", "").upper()[:6]
        workflow = ProvisioningWorkflow(
            id=uuid4(),
            tenant_id=service.tenant_id,
            workflow_id=_unique_code(f"WF-{tenant_prefix}"),
            workflow_type="provision",
            service_instance_id=service.id,
            status=ProvisioningStatus.FAILED,
            total_steps=5,
            rollback_required=False,
            rollback_completed=False,
            workflow_config={},
            step_results={},
        )
        async_session.add(workflow)

    await async_session.commit()

    # Get failed workflows for tenant-1 only
    tenant1_workflows = await service_obj.get_failed_workflows_for_rollback(
        tenant_id=tenant1_id, limit=50
    )

    assert len(tenant1_workflows) == 1
    assert tenant1_workflows[0].tenant_id == tenant1_id

    # Attempt to rollback tenant-2 service with tenant-1 credentials should fail
    # (tenant isolation enforced by get_service_instance)
    result = await service_obj.rollback_provisioning_workflow(
        service_instance_id=tenant2_service.id,
        tenant_id=tenant1_id,  # Wrong tenant
        rollback_reason="Cross-tenant test",
    )

    assert result["success"] is False
