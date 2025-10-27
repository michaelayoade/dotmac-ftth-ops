"""
Tests for Orchestration Service - Unit Tests

Simple unit tests focusing on testable service logic without complex workflows.
"""

from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.orchestration.models import (
    OrchestrationWorkflow,
    WorkflowStatus,
    WorkflowType,
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
            retry_count=0,
            max_retries=3,
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
                retry_count=0,
                max_retries=3,
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
                retry_count=1,
                max_retries=3,
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

        # Mock status count query
        status_query = MagicMock()
        status_query.filter.return_value.group_by.return_value.all.return_value = [
            (WorkflowStatus.COMPLETED, 10),
            (WorkflowStatus.FAILED, 2),
            (WorkflowStatus.RUNNING, 1),
        ]

        # Mock type count query
        type_query = MagicMock()
        type_query.filter.return_value.group_by.return_value.all.return_value = [
            (WorkflowType.PROVISION_SUBSCRIBER, 8),
            (WorkflowType.ACTIVATE_SERVICE, 5),
        ]

        # Mock completed workflows for duration query
        completed_query = MagicMock()
        completed_query.filter.return_value.all.return_value = []

        # Setup query to return different mocks for different calls
        db.query.side_effect = [status_query, type_query, completed_query]

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")
            stats = await service.get_workflow_statistics()

            assert stats.completed_workflows == 10
            assert stats.failed_workflows == 2
            assert stats.running_workflows == 1
            assert stats.total_workflows == 13

    async def test_get_workflow_statistics_empty(self):
        """Test getting workflow statistics when no workflows exist"""
        db = MagicMock()

        # Mock empty results for all queries
        status_query = MagicMock()
        status_query.filter.return_value.group_by.return_value.all.return_value = []

        type_query = MagicMock()
        type_query.filter.return_value.group_by.return_value.all.return_value = []

        completed_query = MagicMock()
        completed_query.filter.return_value.all.return_value = []

        db.query.side_effect = [status_query, type_query, completed_query]

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")
            stats = await service.get_workflow_statistics()

            assert stats.total_workflows == 0
            assert stats.completed_workflows == 0
            assert stats.failed_workflows == 0


@pytest.mark.asyncio
class TestWorkflowTypeMapping:
    """Test workflow type to definition mapping"""

    def test_get_workflow_definition_provision(self):
        """Test getting provision subscriber workflow definition"""
        db = MagicMock()

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_provision_subscriber_workflow"
            ) as mock_workflow:
                mock_workflow.return_value = {"name": "provision_subscriber"}

                service = OrchestrationService(db, "tenant-1")
                definition = service._get_workflow_definition(WorkflowType.PROVISION_SUBSCRIBER)

                assert definition is not None
                assert definition["name"] == "provision_subscriber"
                mock_workflow.assert_called_once()

    def test_get_workflow_definition_deprovision(self):
        """Test getting deprovision subscriber workflow definition"""
        db = MagicMock()

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_deprovision_subscriber_workflow"
            ) as mock_workflow:
                mock_workflow.return_value = {"name": "deprovision_subscriber"}

                service = OrchestrationService(db, "tenant-1")
                definition = service._get_workflow_definition(WorkflowType.DEPROVISION_SUBSCRIBER)

                assert definition is not None
                assert definition["name"] == "deprovision_subscriber"

    def test_get_workflow_definition_activate(self):
        """Test getting activate service workflow definition"""
        db = MagicMock()

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_activate_service_workflow"
            ) as mock_workflow:
                mock_workflow.return_value = {"name": "activate_service"}

                service = OrchestrationService(db, "tenant-1")
                definition = service._get_workflow_definition(WorkflowType.ACTIVATE_SERVICE)

                assert definition is not None

    def test_get_workflow_definition_suspend(self):
        """Test getting suspend service workflow definition"""
        db = MagicMock()

        with patch.object(OrchestrationService, "_register_all_handlers"):
            with patch(
                "dotmac.platform.orchestration.service.get_suspend_service_workflow"
            ) as mock_workflow:
                mock_workflow.return_value = {"name": "suspend_service"}

                service = OrchestrationService(db, "tenant-1")
                definition = service._get_workflow_definition(WorkflowType.SUSPEND_SERVICE)

                assert definition is not None

    def test_get_workflow_definition_unknown(self):
        """Test getting definition for unknown workflow type returns None"""
        db = MagicMock()

        with patch.object(OrchestrationService, "_register_all_handlers"):
            service = OrchestrationService(db, "tenant-1")
            # Use a string that won't match any workflow type
            definition = service._get_workflow_definition("unknown_type")  # type: ignore

            assert definition is None
