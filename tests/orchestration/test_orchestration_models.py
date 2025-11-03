"""
Tests for Orchestration Models

Tests database models for workflow orchestration.
"""

from datetime import datetime

import pytest

from dotmac.platform.orchestration.models import (
    OrchestrationWorkflow,
    OrchestrationWorkflowStep,
    WorkflowStatus,
    WorkflowStepStatus,
    WorkflowType,
)

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
class TestOrchestrationModels:
    """Test orchestration database models"""

    async def test_create_workflow(self, async_db_session, test_tenant):
        """Test creating orchestration workflow"""
        workflow = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-001",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.PENDING,
            input_data={"subscriber_id": "sub-001", "username": "test@isp"},
            initiator_id="user-123",
            initiator_type="user",
        )

        async_db_session.add(workflow)
        await async_db_session.flush()

        assert workflow.id is not None
        assert workflow.workflow_id == "wf-001"
        assert workflow.workflow_type == WorkflowType.PROVISION_SUBSCRIBER
        assert workflow.status == WorkflowStatus.PENDING
        assert workflow.tenant_id == test_tenant.id

    async def test_workflow_status_transitions(self, async_db_session, test_tenant):
        """Test workflow status state machine"""
        workflow = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-002",
            workflow_type=WorkflowType.ACTIVATE_SERVICE,
            status=WorkflowStatus.PENDING,
            input_data={},
        )
        async_db_session.add(workflow)
        await async_db_session.flush()

        # Transition to running
        workflow.status = WorkflowStatus.RUNNING
        workflow.started_at = datetime.utcnow()
        await async_db_session.flush()
        assert workflow.status == WorkflowStatus.RUNNING

        # Transition to completed
        workflow.status = WorkflowStatus.COMPLETED
        workflow.completed_at = datetime.utcnow()
        workflow.output_data = {"result": "success"}
        await async_db_session.flush()
        assert workflow.status == WorkflowStatus.COMPLETED

    async def test_workflow_with_error(self, async_db_session, test_tenant):
        """Test workflow error tracking"""
        workflow = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-003",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.FAILED,
            input_data={},
            error_message="Failed to create RADIUS account",
            error_details={"step": "create_radius", "code": "AUTH_001"},
            retry_count=2,
        )
        async_db_session.add(workflow)
        await async_db_session.flush()

        assert workflow.error_message == "Failed to create RADIUS account"
        assert workflow.error_details["step"] == "create_radius"
        assert workflow.retry_count == 2

    async def test_create_workflow_step(self, async_db_session, test_tenant):
        """Test creating workflow execution step"""
        workflow = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-004",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.RUNNING,
            input_data={},
        )
        async_db_session.add(workflow)
        await async_db_session.flush()

        step = OrchestrationWorkflowStep(
            workflow_id=workflow.id,
            tenant_id=test_tenant.id,
            step_name="create_customer",
            step_type="service_call",
            sequence_number=1,
            status=WorkflowStepStatus.PENDING,
            input_data={"name": "Test Customer"},
        )
        async_db_session.add(step)
        await async_db_session.flush()

        assert step.id is not None
        assert step.workflow_id == workflow.id
        assert step.step_name == "create_customer"
        assert step.status == WorkflowStepStatus.PENDING

    async def test_workflow_step_completion(self, async_db_session, test_tenant):
        """Test step execution and completion"""
        workflow = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-005",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.RUNNING,
            input_data={},
        )
        async_db_session.add(workflow)
        await async_db_session.flush()

        step = OrchestrationWorkflowStep(
            workflow_id=workflow.id,
            tenant_id=test_tenant.id,
            step_name="create_radius",
            step_type="service_call",
            sequence_number=2,
            status=WorkflowStepStatus.RUNNING,
            input_data={"username": "test@isp"},
            started_at=datetime.utcnow(),
        )
        async_db_session.add(step)
        await async_db_session.flush()

        # Complete the step
        step.status = WorkflowStepStatus.COMPLETED
        step.completed_at = datetime.utcnow()
        step.output_data = {"radius_id": "rad-123"}
        await async_db_session.flush()

        assert step.status == WorkflowStepStatus.COMPLETED
        assert step.output_data["radius_id"] == "rad-123"

    async def test_workflow_step_compensation(self, async_db_session, test_tenant):
        """Test step compensation (rollback)"""
        workflow = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-006",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.ROLLING_BACK,
            input_data={},
        )
        async_db_session.add(workflow)
        await async_db_session.flush()

        step = OrchestrationWorkflowStep(
            workflow_id=workflow.id,
            tenant_id=test_tenant.id,
            step_name="create_customer",
            step_type="service_call",
            sequence_number=1,
            status=WorkflowStepStatus.COMPENSATING,
            input_data={},
            output_data={"customer_id": "cust-123"},
        )
        async_db_session.add(step)
        await async_db_session.flush()

        # Complete compensation
        step.status = WorkflowStepStatus.COMPENSATED
        step.compensation_started_at = datetime.utcnow()
        step.compensation_completed_at = datetime.utcnow()
        await async_db_session.flush()

        assert step.status == WorkflowStepStatus.COMPENSATED

    async def test_workflow_tenant_isolation(self, async_db_session, test_tenant, test_tenant_2):
        """Test that workflows are tenant-isolated"""
        from sqlalchemy import select

        # Create workflow for tenant 1
        workflow1 = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-tenant1",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.PENDING,
            input_data={},
        )
        async_db_session.add(workflow1)
        await async_db_session.flush()

        # Try to query from tenant 2's perspective
        result = await async_db_session.execute(
            select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.tenant_id == test_tenant_2.id,
                OrchestrationWorkflow.workflow_id == "wf-tenant1",
            )
        )
        workflow = result.scalar_one_or_none()

        assert workflow is None  # Should not be accessible

    async def test_workflow_with_context(self, async_db_session, test_tenant):
        """Test workflow context storage"""
        workflow = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-007",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.RUNNING,
            input_data={"username": "test@isp"},
            context={
                "customer_id": "cust-123",
                "radius_username": "test@isp",
                "bandwidth_profile": "10mbps",
            },
        )
        async_db_session.add(workflow)
        await async_db_session.flush()

        assert workflow.context["customer_id"] == "cust-123"
        assert workflow.context["bandwidth_profile"] == "10mbps"

    async def test_workflow_retry_tracking(self, async_db_session, test_tenant):
        """Test workflow retry mechanism"""
        workflow = OrchestrationWorkflow(
            tenant_id=test_tenant.id,
            workflow_id="wf-008",
            workflow_type=WorkflowType.ACTIVATE_SERVICE,
            status=WorkflowStatus.FAILED,
            input_data={},
            retry_count=0,
            max_retries=3,
        )
        async_db_session.add(workflow)
        await async_db_session.flush()

        # Simulate retry
        workflow.retry_count += 1
        workflow.status = WorkflowStatus.PENDING
        await async_db_session.flush()

        assert workflow.retry_count == 1
        assert workflow.retry_count < workflow.max_retries
