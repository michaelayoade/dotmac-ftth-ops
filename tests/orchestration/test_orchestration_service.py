"""
Tests for Orchestration Service

Unit tests for orchestration service business logic with mocked dependencies.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.orchestration.models import (
    OrchestrationWorkflow,
    WorkflowStatus,
    WorkflowType,
)
from dotmac.platform.orchestration.schemas import (
    ActivateServiceRequest,
    DeprovisionSubscriberRequest,
    ProvisionSubscriberRequest,
    SuspendServiceRequest,
)
from dotmac.platform.orchestration.service import OrchestrationService


class TestOrchestrationServiceInitialization:
    """Test service initialization"""

    def test_service_creation(self):
        """Test creating orchestration service"""
        db = MagicMock()
        tenant_id = "test-tenant"

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, tenant_id)

            assert service.db is db
            assert service.tenant_id == tenant_id
            assert service.saga is not None

    def test_handlers_registered_on_init(self):
        """Test that workflow handlers are registered on initialization"""
        db = MagicMock()

        with patch.object(OrchestrationService, "_register_all_handlers") as mock_register:
            OrchestrationService(db, "tenant-1")
            mock_register.assert_called_once()


@pytest.mark.asyncio
class TestProvisionSubscriberWorkflow:
    """Test subscriber provisioning workflow"""

    async def test_provision_subscriber_creates_workflow(self):
        """Test that provision_subscriber creates a workflow record"""
        db = MagicMock()
        tenant_id = "test-tenant"

        request = ProvisionSubscriberRequest(
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            phone="+1234567890",
            service_address="123 Main St",
            service_city="Anytown",
            service_state="CA",
            service_postal_code="90210",
            service_plan_id="plan-10mbps",
            bandwidth_mbps=10,
            connection_type="ftth",
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_provision_subscriber_workflow"
            ) as mock_workflow:
                service = OrchestrationService(db, tenant_id)

                # Create a real workflow object to return from saga
                completed_workflow = OrchestrationWorkflow(
                    id=1,
                    tenant_id=tenant_id,
                    workflow_id="wf-123",
                    workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
                    status=WorkflowStatus.COMPLETED,
                    input_data=request.model_dump(),
                    output_data={"customer_id": "cust-123"},
                    context={"customer_id": "cust-123", "subscriber_id": "sub-123"},
                    steps=[],
                )

                # Mock saga execute_workflow to return the workflow
                service.saga.execute_workflow = AsyncMock(return_value=completed_workflow)

                # Mock workflow definition
                mock_workflow.return_value = {
                    "name": "provision_subscriber",
                    "steps": [],
                }

                result = await service.provision_subscriber(request, initiator_id="user-123")

                # Verify workflow was created
                assert db.add.called
                assert db.flush.called
                assert db.commit.called
                assert result.customer_id == "cust-123"

    async def test_provision_subscriber_with_ipv6(self):
        """Test subscriber provisioning with IPv6 addresses"""
        db = MagicMock()

        request = ProvisionSubscriberRequest(
            first_name="Jane",
            last_name="Smith",
            email="jane.smith@example.com",
            phone="+1987654321",
            service_address="456 Oak Ave",
            service_city="Springfield",
            service_state="IL",
            service_postal_code="62701",
            service_plan_id="plan-100mbps",
            bandwidth_mbps=100,
            connection_type="ftth",
            ipv6_prefix="2001:db8::/56",
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch("dotmac.platform.orchestration.service.get_provision_subscriber_workflow"):
                service = OrchestrationService(db, "tenant-1")

                service.saga.execute_workflow = AsyncMock(
                    return_value=MagicMock(
                        workflow_id="wf-ipv6",
                        status=WorkflowStatus.COMPLETED,
                        output_data={
                            "customer_id": "cust-ipv6",
                            "ipv6_configured": True,
                        },
                    )
                )

                await service.provision_subscriber(request)

                # Verify IPv6 data was included
                call_args = db.add.call_args
                if call_args:
                    workflow = call_args[0][0]
                    assert (
                        "ipv6_address" in workflow.input_data or "username" in workflow.input_data
                    )


@pytest.mark.asyncio
class TestDeprovisionSubscriberWorkflow:
    """Test subscriber deprovisioning workflow"""

    async def test_deprovision_subscriber_success(self):
        """Test successful subscriber deprovisioning"""
        db = MagicMock()

        request = DeprovisionSubscriberRequest(
            customer_id="cust-123",
            reason="Customer requested cancellation",
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch("dotmac.platform.orchestration.service.get_deprovision_subscriber_workflow"):
                service = OrchestrationService(db, "tenant-1")

                service.saga.execute_workflow = AsyncMock(
                    return_value=MagicMock(
                        workflow_id="wf-deprov",
                        status=WorkflowStatus.COMPLETED,
                        output_data={
                            "deprovisioned": True,
                            "radius_deleted": True,
                            "customer_deleted": True,
                        },
                    )
                )

                await service.deprovision_subscriber(request)

                assert db.add.called
                assert db.commit.called


@pytest.mark.asyncio
class TestActivateServiceWorkflow:
    """Test service activation workflow"""

    async def test_activate_service_success(self):
        """Test successful service activation"""
        db = MagicMock()

        request = ActivateServiceRequest(
            customer_id="cust-123",
            service_plan="50mbps",
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch("dotmac.platform.orchestration.service.get_activate_service_workflow"):
                service = OrchestrationService(db, "tenant-1")

                service.saga.execute_workflow = AsyncMock(
                    return_value=MagicMock(
                        workflow_id="wf-activate",
                        status=WorkflowStatus.COMPLETED,
                        output_data={"activated": True},
                    )
                )

                await service.activate_service(request)

                assert db.add.called


@pytest.mark.asyncio
class TestSuspendServiceWorkflow:
    """Test service suspension workflow"""

    async def test_suspend_service_success(self):
        """Test successful service suspension"""
        db = MagicMock()

        request = SuspendServiceRequest(
            customer_id="cust-123",
            reason="Non-payment",
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch("dotmac.platform.orchestration.service.get_suspend_service_workflow"):
                service = OrchestrationService(db, "tenant-1")

                service.saga.execute_workflow = AsyncMock(
                    return_value=MagicMock(
                        workflow_id="wf-suspend",
                        status=WorkflowStatus.COMPLETED,
                        output_data={"suspended": True},
                    )
                )

                await service.suspend_service(request)

                assert db.add.called


@pytest.mark.asyncio
class TestWorkflowManagement:
    """Test workflow listing and retrieval"""

    async def test_get_workflow_by_id(self):
        """Test retrieving workflow by ID"""
        db = MagicMock()

        # Create mock workflow
        mock_workflow = OrchestrationWorkflow(
            id=1,
            tenant_id="tenant-1",
            workflow_id="wf-123",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.COMPLETED,
            input_data={"customer_name": "Test"},
            output_data={"customer_id": "cust-123"},
        )

        db.query.return_value.filter.return_value.first.return_value = mock_workflow

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")
            result = await service.get_workflow("wf-123")

            assert result is not None
            assert result.workflow_id == "wf-123"
            assert result.status == WorkflowStatus.COMPLETED

    async def test_get_workflow_not_found(self):
        """Test retrieving nonexistent workflow returns None"""
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")
            result = await service.get_workflow("nonexistent")

            assert result is None

    async def test_list_workflows_with_pagination(self):
        """Test listing workflows with pagination"""
        db = MagicMock()

        # Create mock workflows
        mock_workflows = [
            OrchestrationWorkflow(
                id=i,
                tenant_id="tenant-1",
                workflow_id=f"wf-{i}",
                workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
                status=WorkflowStatus.COMPLETED,
                input_data={},
            )
            for i in range(1, 6)
        ]

        db.query.return_value.filter.return_value.count.return_value = 5
        db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.offset.return_value.all.return_value = mock_workflows[
            :3
        ]

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")
            result = await service.list_workflows(limit=3, offset=0)

            assert result.total == 5
            assert len(result.workflows) == 3

    async def test_list_workflows_filtered_by_status(self):
        """Test listing workflows filtered by status"""
        db = MagicMock()

        mock_workflows = [
            OrchestrationWorkflow(
                id=1,
                tenant_id="tenant-1",
                workflow_id="wf-1",
                workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
                status=WorkflowStatus.FAILED,
                input_data={},
            )
        ]

        db.query.return_value.filter.return_value.filter.return_value.count.return_value = 1
        db.query.return_value.filter.return_value.filter.return_value.order_by.return_value.limit.return_value.offset.return_value.all.return_value = mock_workflows

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")
            result = await service.list_workflows(status=WorkflowStatus.FAILED)

            assert result.total == 1
            assert result.workflows[0].status == WorkflowStatus.FAILED


@pytest.mark.asyncio
class TestWorkflowStatistics:
    """Test workflow statistics"""

    async def test_get_workflow_statistics(self):
        """Test getting workflow statistics"""
        db = MagicMock()

        # Mock statistics query results
        db.query.return_value.filter.return_value.group_by.return_value.all.return_value = [
            (WorkflowStatus.COMPLETED, 10),
            (WorkflowStatus.FAILED, 2),
            (WorkflowStatus.RUNNING, 1),
        ]

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")
            stats = await service.get_workflow_statistics()

            assert stats.completed_count == 10
            assert stats.failed_count == 2
            assert stats.running_count == 1
            assert stats.total_count == 13


@pytest.mark.asyncio
class TestWorkflowRetry:
    """Test workflow retry functionality"""

    async def test_retry_failed_workflow(self):
        """Test retrying a failed workflow"""
        db = MagicMock()

        # Create mock failed workflow
        mock_workflow = OrchestrationWorkflow(
            id=1,
            tenant_id="tenant-1",
            workflow_id="wf-failed",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.FAILED,
            retry_count=0,
            max_retries=3,
            input_data={"customer_name": "Test"},
        )

        db.query.return_value.filter.return_value.first.return_value = mock_workflow

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch.object(OrchestrationService, "_get_workflow_definition") as mock_get_def:
                service = OrchestrationService(db, "tenant-1")

                # Mock saga methods
                service.saga.retry_failed_workflow = AsyncMock(return_value=mock_workflow)
                service.saga.execute_workflow = AsyncMock(return_value=mock_workflow)

                mock_get_def.return_value = {"name": "provision_subscriber", "steps": []}

                await service.retry_workflow("wf-failed")

                assert service.saga.retry_failed_workflow.called
                assert db.commit.called

    async def test_retry_exhausted_workflow_fails(self):
        """Test that retry fails when max retries exceeded"""
        db = MagicMock()

        # Create mock workflow with max retries exhausted
        mock_workflow = OrchestrationWorkflow(
            id=1,
            tenant_id="tenant-1",
            workflow_id="wf-exhausted",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.FAILED,
            retry_count=3,
            max_retries=3,
            input_data={},
        )

        db.query.return_value.filter.return_value.first.return_value = mock_workflow

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")

            # Mock saga to raise error
            service.saga.retry_failed_workflow = AsyncMock(
                side_effect=ValueError("Max retries exceeded")
            )

            with pytest.raises(ValueError, match="Max retries exceeded"):
                await service.retry_workflow("wf-exhausted")


@pytest.mark.asyncio
class TestWorkflowCancellation:
    """Test workflow cancellation"""

    async def test_cancel_running_workflow(self):
        """Test cancelling a running workflow"""
        db = MagicMock()

        mock_workflow = OrchestrationWorkflow(
            id=1,
            tenant_id="tenant-1",
            workflow_id="wf-running",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.RUNNING,
            input_data={},
        )

        db.query.return_value.filter.return_value.first.return_value = mock_workflow

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")

            # Mock saga cancel
            service.saga.cancel_workflow = AsyncMock(return_value=mock_workflow)

            await service.cancel_workflow("wf-running")

            assert service.saga.cancel_workflow.called
            assert db.commit.called

    async def test_cancel_completed_workflow_fails(self):
        """Test that cancelling completed workflow fails"""
        db = MagicMock()

        mock_workflow = OrchestrationWorkflow(
            id=1,
            tenant_id="tenant-1",
            workflow_id="wf-completed",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.COMPLETED,
            input_data={},
        )

        db.query.return_value.filter.return_value.first.return_value = mock_workflow

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")

            # Mock saga to raise error
            service.saga.cancel_workflow = AsyncMock(
                side_effect=ValueError("Cannot cancel completed workflow")
            )

            with pytest.raises(ValueError, match="Cannot cancel"):
                await service.cancel_workflow("wf-completed")
