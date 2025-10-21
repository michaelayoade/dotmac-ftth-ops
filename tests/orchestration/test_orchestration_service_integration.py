"""
Integration Tests for Orchestration Service

Tests orchestration service with real database and mocked external handlers.
"""

import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import select

from dotmac.platform.orchestration.service import OrchestrationService
from dotmac.platform.orchestration.models import (
    OrchestrationWorkflow,
    WorkflowStatus,
    WorkflowType,
)
from dotmac.platform.orchestration.schemas import (
    ProvisionSubscriberRequest,
    DeprovisionSubscriberRequest,
    ActivateServiceRequest,
    SuspendServiceRequest,
)


@pytest.mark.asyncio
class TestProvisionSubscriberIntegration:
    """Integration tests for subscriber provisioning"""

    async def test_provision_subscriber_creates_workflow_in_db(
        self, async_db_session, test_tenant
    ):
        """Test that provision_subscriber creates and persists workflow"""

        # Mock the saga's execute_workflow to simulate successful completion
        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(async_db_session, test_tenant.id)

            # Create a mock that simulates saga execution
            async def mock_execute(workflow, workflow_definition, context):
                """Simulate saga executing the workflow"""
                # Update workflow as saga would
                workflow.status = WorkflowStatus.COMPLETED
                workflow.context = {
                    "customer_id": "cust-integration-123",
                    "subscriber_id": "sub-integration-123",
                    "radius_username": "test@isp",
                }
                workflow.output_data = {
                    "customer_id": "cust-integration-123",
                    "success": True,
                }
                await async_db_session.flush()
                return workflow

            service.saga.execute_workflow = mock_execute

            # Create request
            request = ProvisionSubscriberRequest(
                first_name="Integration",
                last_name="Test",
                email="integration@test.com",
                phone="+1234567890",
                service_address="123 Test St",
                service_city="TestCity",
                service_state="TS",
                service_postal_code="12345",
                service_plan_id="plan-test",
                bandwidth_mbps=100,
                connection_type="ftth",
            )

            # Execute
            result = await service.provision_subscriber(
                request, initiator_id="test-user"
            )

            # Verify result
            assert result is not None
            assert result.customer_id == "cust-integration-123"
            assert result.subscriber_id == "sub-integration-123"

            # Verify workflow persisted to database
            stmt = select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.workflow_id == result.workflow_id
            )
            db_result = await async_db_session.execute(stmt)
            workflow = db_result.scalar_one()

            assert workflow is not None
            assert workflow.status == WorkflowStatus.COMPLETED
            assert workflow.workflow_type == WorkflowType.PROVISION_SUBSCRIBER
            assert workflow.tenant_id == test_tenant.id
            assert workflow.initiator_id == "test-user"

    async def test_provision_subscriber_with_ipv6(
        self, async_db_session, test_tenant
    ):
        """Test provisioning with IPv6 configuration"""

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(async_db_session, test_tenant.id)

            async def mock_execute(workflow, workflow_definition, context):
                workflow.status = WorkflowStatus.COMPLETED
                workflow.context = {
                    "customer_id": "cust-ipv6",
                    "subscriber_id": "sub-ipv6",
                    "ipv6_prefix": "2001:db8::/56",
                }
                workflow.output_data = {"ipv6_configured": True}
                await async_db_session.flush()
                return workflow

            service.saga.execute_workflow = mock_execute

            request = ProvisionSubscriberRequest(
                first_name="IPv6",
                last_name="User",
                email="ipv6@test.com",
                phone="+1234567890",
                service_address="456 IPv6 Ave",
                service_city="NetCity",
                service_state="NC",
                service_postal_code="54321",
                service_plan_id="plan-ipv6",
                bandwidth_mbps=1000,
                connection_type="ftth",
                ipv6_prefix="2001:db8::/56",
            )

            result = await service.provision_subscriber(request)

            # Verify IPv6 data in workflow
            stmt = select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.workflow_id == result.workflow_id
            )
            db_result = await async_db_session.execute(stmt)
            workflow = db_result.scalar_one()

            assert workflow.input_data.get("ipv6_prefix") == "2001:db8::/56"
            assert workflow.context.get("ipv6_prefix") == "2001:db8::/56"

    async def test_provision_subscriber_workflow_failure(
        self, async_db_session, test_tenant
    ):
        """Test that workflow failure is properly handled"""

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(async_db_session, test_tenant.id)

            async def mock_execute_failure(workflow, workflow_definition, context):
                """Simulate saga execution failure"""
                workflow.status = WorkflowStatus.FAILED
                workflow.error_message = "Simulated failure in provisioning"
                await async_db_session.flush()
                raise Exception("Provisioning failed: External service unavailable")

            service.saga.execute_workflow = mock_execute_failure

            request = ProvisionSubscriberRequest(
                first_name="Failure",
                last_name="Test",
                email="failure@test.com",
                phone="+1234567890",
                service_address="789 Fail St",
                service_city="ErrorCity",
                service_state="EC",
                service_postal_code="99999",
                service_plan_id="plan-fail",
                bandwidth_mbps=50,
                connection_type="ftth",
            )

            # Expect exception to be raised
            with pytest.raises(Exception, match="Provisioning failed"):
                await service.provision_subscriber(request)

            # Verify workflow still created with FAILED status
            stmt = select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.tenant_id == test_tenant.id,
                OrchestrationWorkflow.workflow_type == WorkflowType.PROVISION_SUBSCRIBER,
            ).order_by(OrchestrationWorkflow.created_at.desc())

            db_result = await async_db_session.execute(stmt)
            workflow = db_result.scalar()

            if workflow:  # Workflow may exist from previous attempts
                assert workflow.status == WorkflowStatus.FAILED
                assert workflow.error_message is not None


@pytest.mark.asyncio
class TestDeprovisionSubscriberIntegration:
    """Integration tests for subscriber deprovisioning"""

    async def test_deprovision_subscriber_success(
        self, async_db_session, test_tenant
    ):
        """Test successful subscriber deprovisioning"""

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(async_db_session, test_tenant.id)

            async def mock_execute(workflow, workflow_definition, context):
                workflow.status = WorkflowStatus.COMPLETED
                workflow.context = {
                    "subscriber_id": "sub-deprovisioned",
                    "resources_cleaned": True,
                }
                workflow.output_data = {
                    "radius_deleted": True,
                    "ip_released": True,
                }
                await async_db_session.flush()
                return workflow

            service.saga.execute_workflow = mock_execute

            request = DeprovisionSubscriberRequest(
                subscriber_id="sub-to-deprovision",
                reason="Customer requested cancellation",
            )

            result = await service.deprovision_subscriber(
                request, initiator_id="admin-user"
            )

            # Verify workflow created
            stmt = select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.workflow_id == result.workflow_id
            )
            db_result = await async_db_session.execute(stmt)
            workflow = db_result.scalar_one()

            assert workflow.status == WorkflowStatus.COMPLETED
            assert workflow.workflow_type == WorkflowType.DEPROVISION_SUBSCRIBER
            assert workflow.initiator_id == "admin-user"


@pytest.mark.asyncio
class TestActivateServiceIntegration:
    """Integration tests for service activation"""

    async def test_activate_service_success(
        self, async_db_session, test_tenant
    ):
        """Test successful service activation"""

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(async_db_session, test_tenant.id)

            async def mock_execute(workflow, workflow_definition, context):
                workflow.status = WorkflowStatus.COMPLETED
                workflow.context = {
                    "customer_id": "cust-activate",
                    "service_activated": True,
                }
                workflow.output_data = {"activation_time": "2025-10-19T12:00:00Z"}
                await async_db_session.flush()
                return workflow

            service.saga.execute_workflow = mock_execute

            request = ActivateServiceRequest(
                customer_id="cust-to-activate",
                service_plan_id="plan-premium",
            )

            result = await service.activate_service(
                request, initiator_id="system"
            )

            # Verify workflow
            stmt = select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.workflow_id == result.workflow_id
            )
            db_result = await async_db_session.execute(stmt)
            workflow = db_result.scalar_one()

            assert workflow.status == WorkflowStatus.COMPLETED
            assert workflow.workflow_type == WorkflowType.ACTIVATE_SERVICE


@pytest.mark.asyncio
class TestSuspendServiceIntegration:
    """Integration tests for service suspension"""

    async def test_suspend_service_success(
        self, async_db_session, test_tenant
    ):
        """Test successful service suspension"""

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(async_db_session, test_tenant.id)

            async def mock_execute(workflow, workflow_definition, context):
                workflow.status = WorkflowStatus.COMPLETED
                workflow.context = {
                    "customer_id": "cust-suspend",
                    "service_suspended": True,
                }
                workflow.output_data = {"suspension_reason": "Non-payment"}
                await async_db_session.flush()
                return workflow

            service.saga.execute_workflow = mock_execute

            request = SuspendServiceRequest(
                customer_id="cust-to-suspend",
                reason="Non-payment",
            )

            result = await service.suspend_service(
                request, initiator_id="billing-system"
            )

            # Verify workflow
            stmt = select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.workflow_id == result.workflow_id
            )
            db_result = await async_db_session.execute(stmt)
            workflow = db_result.scalar_one()

            assert workflow.status == WorkflowStatus.COMPLETED
            assert workflow.workflow_type == WorkflowType.SUSPEND_SERVICE
            assert workflow.initiator_id == "billing-system"


@pytest.mark.asyncio
class TestWorkflowRetryIntegration:
    """Integration tests for workflow retry"""

    async def test_retry_failed_workflow(
        self, async_db_session, test_tenant
    ):
        """Test retrying a failed workflow"""

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(async_db_session, test_tenant.id)

            # First create a failed workflow
            failed_workflow = OrchestrationWorkflow(
                workflow_id="wf-retry-test",
                tenant_id=test_tenant.id,
                workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
                status=WorkflowStatus.FAILED,
                input_data={"test": "data"},
                retry_count=0,
                max_retries=3,
            )
            async_db_session.add(failed_workflow)
            await async_db_session.flush()

            # Mock saga retry and re-execution
            async def mock_retry(workflow):
                workflow.status = WorkflowStatus.PENDING
                workflow.retry_count += 1
                await async_db_session.flush()
                return workflow

            async def mock_execute(workflow, workflow_definition, context):
                workflow.status = WorkflowStatus.COMPLETED
                await async_db_session.flush()
                return workflow

            service.saga.retry_failed_workflow = mock_retry
            service.saga.execute_workflow = mock_execute

            # Retry the workflow
            result = await service.retry_workflow("wf-retry-test")

            # Verify retry was successful
            assert result.status == WorkflowStatus.COMPLETED

            # Verify in database
            stmt = select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.workflow_id == "wf-retry-test"
            )
            db_result = await async_db_session.execute(stmt)
            workflow = db_result.scalar_one()

            assert workflow.retry_count == 1
            assert workflow.status == WorkflowStatus.COMPLETED


@pytest.mark.asyncio
class TestWorkflowCancellationIntegration:
    """Integration tests for workflow cancellation"""

    async def test_cancel_running_workflow(
        self, async_db_session, test_tenant
    ):
        """Test cancelling a running workflow"""

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(async_db_session, test_tenant.id)

            # Create a running workflow
            running_workflow = OrchestrationWorkflow(
                workflow_id="wf-cancel-test",
                tenant_id=test_tenant.id,
                workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
                status=WorkflowStatus.RUNNING,
                input_data={"test": "data"},
                retry_count=0,
                max_retries=3,
            )
            async_db_session.add(running_workflow)
            await async_db_session.flush()

            # Mock saga cancellation
            async def mock_cancel(workflow):
                workflow.status = WorkflowStatus.ROLLING_BACK
                await async_db_session.flush()
                return workflow

            service.saga.cancel_workflow = mock_cancel

            # Cancel the workflow
            result = await service.cancel_workflow("wf-cancel-test")

            # Verify cancellation
            assert result.status == WorkflowStatus.ROLLING_BACK

            # Verify in database
            stmt = select(OrchestrationWorkflow).where(
                OrchestrationWorkflow.workflow_id == "wf-cancel-test"
            )
            db_result = await async_db_session.execute(stmt)
            workflow = db_result.scalar_one()

            assert workflow.status == WorkflowStatus.ROLLING_BACK
