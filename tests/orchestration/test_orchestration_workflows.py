
"""
Unit Tests for Orchestration Workflow Execution Methods

Tests the main workflow execution methods with mocked dependencies.
"""

from datetime import datetime
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




pytestmark = pytest.mark.unit

@pytest.mark.asyncio
class TestProvisionSubscriberExecution:
    """Test provision subscriber workflow execution"""

    async def test_provision_creates_workflow_record(self):
        """Test that provision_subscriber creates workflow in database"""
        db = MagicMock()

        request = ProvisionSubscriberRequest(
            first_name="Test",
            last_name="User",
            email="test@example.com",
            phone="+1234567890",
            service_address="123 Test St",
            service_city="TestCity",
            service_state="TS",
            service_postal_code="12345",
            service_plan_id="plan-test",
            bandwidth_mbps=100,
            connection_type="ftth",
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_provision_subscriber_workflow"
            ) as mock_get_wf:
                mock_get_wf.return_value = {"name": "provision_subscriber", "steps": []}

                service = OrchestrationService(db, "tenant-1")

                # Mock saga to return completed workflow
                now = datetime.now()
                completed_wf = OrchestrationWorkflow(
                    id=1,
                    tenant_id="tenant-1",
                    workflow_id="wf-123",
                    workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
                    status=WorkflowStatus.COMPLETED,
                    input_data=request.model_dump(),
                    context={"customer_id": "cust-123", "subscriber_id": "sub-123"},
                    output_data={"success": True},
                    steps=[],
                    retry_count=0,
                    max_retries=3,
                    created_at=now,
                    started_at=now,
                    completed_at=now,
                )
                service.saga.execute_workflow = AsyncMock(return_value=completed_wf)

                # Execute
                result = await service.provision_subscriber(request, initiator_id="user-1")

                # Verify db operations
                assert db.add.called
                assert db.commit.called
                assert db.refresh.called

                # Verify saga was called
                assert service.saga.execute_workflow.called

                # Verify result
                assert result.customer_id == "cust-123"
                assert result.subscriber_id == "sub-123"

    async def test_provision_with_exception_handling(self):
        """Test exception handling in provision_subscriber"""
        db = MagicMock()

        request = ProvisionSubscriberRequest(
            first_name="Fail",
            last_name="Test",
            email="fail@example.com",
            phone="+1234567890",
            service_address="123 Fail St",
            service_city="FailCity",
            service_state="FC",
            service_postal_code="99999",
            service_plan_id="plan-fail",
            bandwidth_mbps=50,
            connection_type="ftth",
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_provision_subscriber_workflow"
            ) as mock_get_wf:
                mock_get_wf.return_value = {"name": "provision_subscriber", "steps": []}

                service = OrchestrationService(db, "tenant-1")

                # Mock saga to raise exception
                service.saga.execute_workflow = AsyncMock(
                    side_effect=Exception("External service unavailable")
                )

                # Execute and expect exception
                with pytest.raises(Exception, match="External service unavailable"):
                    await service.provision_subscriber(request)

                # Verify workflow was still created
                assert db.add.called
                assert db.commit.called


@pytest.mark.asyncio
class TestDeprovisionSubscriberExecution:
    """Test deprovision subscriber workflow execution"""

    async def test_deprovision_creates_workflow(self):
        """Test that deprovision_subscriber creates workflow"""
        db = MagicMock()

        request = DeprovisionSubscriberRequest(
            subscriber_id="sub-to-remove",
            reason="Customer requested cancellation",
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_deprovision_subscriber_workflow"
            ) as mock_get_wf:
                mock_get_wf.return_value = {"name": "deprovision_subscriber", "steps": []}

                service = OrchestrationService(db, "tenant-1")

                # Mock saga
                completed_wf = OrchestrationWorkflow(
                    id=2,
                    tenant_id="tenant-1",
                    workflow_id="wf-deprov-123",
                    workflow_type=WorkflowType.DEPROVISION_SUBSCRIBER,
                    status=WorkflowStatus.COMPLETED,
                    input_data=request.model_dump(),
                    context={"subscriber_id": "sub-to-remove"},
                    output_data={"resources_cleaned": True},
                    steps=[],
                    retry_count=0,
                    max_retries=3,
                )
                service.saga.execute_workflow = AsyncMock(return_value=completed_wf)

                # Execute
                await service.deprovision_subscriber(request, initiator_id="admin-1")

                # Verify
                assert db.add.called
                assert db.commit.called
                assert service.saga.execute_workflow.called


@pytest.mark.asyncio
class TestActivateServiceExecution:
    """Test activate service workflow execution"""

    async def test_activate_creates_workflow(self):
        """Test that activate_service creates workflow"""
        db = MagicMock()

        request = ActivateServiceRequest(
            subscriber_id="sub-123",
            send_notification=True,
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_activate_service_workflow"
            ) as mock_get_wf:
                mock_get_wf.return_value = {"name": "activate_service", "steps": []}

                service = OrchestrationService(db, "tenant-1")

                # Mock saga
                completed_wf = OrchestrationWorkflow(
                    id=3,
                    tenant_id="tenant-1",
                    workflow_id="wf-activate-123",
                    workflow_type=WorkflowType.ACTIVATE_SERVICE,
                    status=WorkflowStatus.COMPLETED,
                    input_data=request.model_dump(),
                    context={"customer_id": "cust-123"},
                    output_data={"activated": True},
                    steps=[],
                    retry_count=0,
                    max_retries=3,
                )
                service.saga.execute_workflow = AsyncMock(return_value=completed_wf)

                # Execute
                await service.activate_service(request, initiator_id="system")

                # Verify
                assert db.add.called
                assert db.commit.called
                assert service.saga.execute_workflow.called


@pytest.mark.asyncio
class TestSuspendServiceExecution:
    """Test suspend service workflow execution"""

    async def test_suspend_creates_workflow(self):
        """Test that suspend_service creates workflow"""
        db = MagicMock()

        request = SuspendServiceRequest(
            subscriber_id="sub-suspend",
            reason="Non-payment",
            send_notification=True,
        )

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_suspend_service_workflow"
            ) as mock_get_wf:
                mock_get_wf.return_value = {"name": "suspend_service", "steps": []}

                service = OrchestrationService(db, "tenant-1")

                # Mock saga
                completed_wf = OrchestrationWorkflow(
                    id=4,
                    tenant_id="tenant-1",
                    workflow_id="wf-suspend-123",
                    workflow_type=WorkflowType.SUSPEND_SERVICE,
                    status=WorkflowStatus.COMPLETED,
                    input_data=request.model_dump(),
                    context={"customer_id": "cust-suspend"},
                    output_data={"suspended": True},
                    steps=[],
                    retry_count=0,
                    max_retries=3,
                )
                service.saga.execute_workflow = AsyncMock(return_value=completed_wf)

                # Execute
                await service.suspend_service(request, initiator_id="billing")

                # Verify
                assert db.add.called
                assert db.commit.called
                assert service.saga.execute_workflow.called


@pytest.mark.asyncio
class TestBuildProvisionResponse:
    """Test _build_provision_response helper method"""

    def test_build_provision_response_with_context(self):
        """Test building provision response from workflow with context"""
        db = MagicMock()

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")

            workflow = OrchestrationWorkflow(
                id=1,
                tenant_id="tenant-1",
                workflow_id="wf-123",
                workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
                status=WorkflowStatus.COMPLETED,
                input_data={"vlan_id": 100},
                context={
                    "subscriber_id": "sub-123",
                    "customer_id": "cust-123",
                    "radius_username": "test@isp",
                    "ipv4_address": "10.0.1.5",
                    "onu_id": "onu-456",
                    "cpe_id": "cpe-789",
                    "service_id": "svc-999",
                },
                output_data={},
                steps=[],
                retry_count=0,
                max_retries=3,
                created_at=datetime.now(),
                completed_at=datetime.now(),
            )

            response = service._build_provision_response(workflow)

            assert response.workflow_id == "wf-123"
            assert response.subscriber_id == "sub-123"
            assert response.customer_id == "cust-123"
            assert response.radius_username == "test@isp"
            assert response.ipv4_address == "10.0.1.5"
            assert response.vlan_id == 100
            assert response.onu_id == "onu-456"
            assert response.cpe_id == "cpe-789"
            assert response.service_id == "svc-999"
            assert response.status == WorkflowStatus.COMPLETED

    def test_build_provision_response_minimal(self):
        """Test building provision response with minimal data"""
        db = MagicMock()

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")

            workflow = OrchestrationWorkflow(
                id=2,
                tenant_id="tenant-1",
                workflow_id="wf-minimal",
                workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
                status=WorkflowStatus.PENDING,
                input_data={},
                context={"subscriber_id": "sub-min", "customer_id": "cust-min"},
                output_data={},
                steps=[],
                retry_count=0,
                max_retries=3,
                created_at=datetime.now(),
            )

            response = service._build_provision_response(workflow)

            assert response.workflow_id == "wf-minimal"
            assert response.subscriber_id == "sub-min"
            assert response.customer_id == "cust-min"
            assert response.status == WorkflowStatus.PENDING
