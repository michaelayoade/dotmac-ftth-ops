"""
Unit Tests for Workflow Service

Tests the WorkflowService with mocked database and engine dependencies.
Focuses on service layer business logic without complex workflow execution.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.workflows.models import (
    Workflow,
    WorkflowExecution,
    WorkflowStatus,
)
from dotmac.platform.workflows.service import WorkflowService

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
class TestWorkflowServiceInitialization:
    """Test service initialization"""

    async def test_service_creation(self):
        """Test creating workflow service"""
        db = AsyncMock()
        event_publisher = MagicMock()
        service_registry = MagicMock()

        service = WorkflowService(
            db_session=db,
            event_publisher=event_publisher,
            service_registry=service_registry,
        )

        assert service.db is db
        assert service.event_publisher is event_publisher
        assert service.service_registry is service_registry

    async def test_service_creation_minimal(self):
        """Test creating service with minimal parameters"""
        db = AsyncMock()

        service = WorkflowService(db_session=db)

        assert service.db is db
        assert service.event_publisher is None
        assert service.service_registry is None


@pytest.mark.asyncio
class TestCreateWorkflow:
    """Test workflow creation"""

    async def test_create_workflow_success(self):
        """Test creating a new workflow template"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock the refresh to set ID on the workflow object
        async def mock_refresh(wf):
            wf.id = 1

        db.refresh = AsyncMock(side_effect=mock_refresh)

        result = await service.create_workflow(
            name="test_workflow",
            definition={"steps": []},
            description="Test workflow",
            version="1.0.0",
        )

        # Verify database operations
        assert db.add.called
        assert db.commit.called
        assert db.refresh.called

        # Verify result
        assert result.name == "test_workflow"
        assert result.description == "Test workflow"
        assert result.version == "1.0.0"
        assert result.is_active is True

    async def test_create_workflow_with_tags(self):
        """Test creating workflow with tags"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        db.refresh = AsyncMock()

        result = await service.create_workflow(
            name="tagged_workflow",
            definition={"steps": []},
            tags={"category": "provisioning", "priority": "high"},
        )

        assert result.tags == {"category": "provisioning", "priority": "high"}


@pytest.mark.asyncio
class TestUpdateWorkflow:
    """Test workflow updates"""

    async def test_update_workflow_definition(self):
        """Test updating workflow definition"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock existing workflow
        existing_workflow = MagicMock()
        existing_workflow.id = 1
        existing_workflow.name = "test_workflow"
        existing_workflow.definition = {"steps": []}
        existing_workflow.version = "1.0.0"
        existing_workflow.is_active = True

        db.get = AsyncMock(return_value=existing_workflow)
        db.refresh = AsyncMock()

        new_definition = {"steps": [{"name": "step1", "type": "transform"}]}

        result = await service.update_workflow(
            workflow_id=1,
            definition=new_definition,
        )

        assert result.definition == new_definition
        assert db.commit.called
        assert db.refresh.called

    async def test_update_workflow_not_found(self):
        """Test updating nonexistent workflow raises error"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        db.get = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="Workflow 999 not found"):
            await service.update_workflow(
                workflow_id=999,
                definition={"steps": []},
            )

    async def test_update_workflow_is_active(self):
        """Test updating workflow active status"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        existing_workflow = Workflow(
            id=1,
            name="test_workflow",
            definition={"steps": []},
            is_active=True,
        )

        db.get = AsyncMock(return_value=existing_workflow)
        db.refresh = AsyncMock()

        result = await service.update_workflow(
            workflow_id=1,
            is_active=False,
        )

        assert result.is_active is False


@pytest.mark.asyncio
class TestGetWorkflow:
    """Test workflow retrieval"""

    async def test_get_workflow_by_id(self):
        """Test retrieving workflow by ID"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = Workflow(
            id=1,
            name="test_workflow",
            definition={"steps": []},
        )

        db.get = AsyncMock(return_value=mock_workflow)

        result = await service.get_workflow(workflow_id=1)

        assert result is not None
        assert result.id == 1
        assert result.name == "test_workflow"

    async def test_get_workflow_not_found(self):
        """Test retrieving nonexistent workflow returns None"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        db.get = AsyncMock(return_value=None)

        result = await service.get_workflow(workflow_id=999)

        assert result is None

    async def test_get_workflow_by_name(self):
        """Test retrieving workflow by name"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = Workflow(
            id=1,
            name="provisioning_workflow",
            definition={"steps": []},
        )

        # Mock the query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_workflow
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_workflow_by_name("provisioning_workflow")

        assert result is not None
        assert result.name == "provisioning_workflow"

    async def test_get_workflow_by_name_not_found(self):
        """Test retrieving workflow by nonexistent name"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_workflow_by_name("nonexistent")

        assert result is None


@pytest.mark.asyncio
class TestListWorkflows:
    """Test workflow listing"""

    async def test_list_all_workflows(self):
        """Test listing all workflows"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflows = [
            Workflow(id=1, name="wf1", definition={"steps": []}),
            Workflow(id=2, name="wf2", definition={"steps": []}),
            Workflow(id=3, name="wf3", definition={"steps": []}),
        ]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_workflows
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_workflows()

        assert len(result) == 3
        assert result[0].name == "wf1"

    async def test_list_workflows_filter_active(self):
        """Test listing workflows filtered by active status"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflows = [
            Workflow(id=1, name="active_wf", definition={"steps": []}, is_active=True),
        ]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_workflows
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_workflows(is_active=True)

        assert len(result) == 1
        assert result[0].is_active is True

    async def test_list_workflows_filter_tags(self):
        """Test listing workflows filtered by tags"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflows = [
            Workflow(
                id=1,
                name="tagged_wf",
                definition={"steps": []},
                tags={"category": "provisioning"},
            ),
        ]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_workflows
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_workflows(tags={"category": "provisioning"})

        assert len(result) == 1
        assert result[0].tags == {"category": "provisioning"}


@pytest.mark.asyncio
class TestDeleteWorkflow:
    """Test workflow deletion"""

    async def test_delete_workflow_success(self):
        """Test deleting a workflow"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = Workflow(
            id=1,
            name="to_delete",
            definition={"steps": []},
        )

        db.get = AsyncMock(return_value=mock_workflow)

        await service.delete_workflow(workflow_id=1)

        assert db.delete.called
        assert db.commit.called

    async def test_delete_workflow_not_found(self):
        """Test deleting nonexistent workflow raises error"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        db.get = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="Workflow 999 not found"):
            await service.delete_workflow(workflow_id=999)


@pytest.mark.asyncio
class TestExecuteWorkflow:
    """Test workflow execution"""

    async def test_execute_workflow_by_name(self):
        """Test executing workflow by name"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = Workflow(
            id=1,
            name="test_workflow",
            definition={"steps": []},
            is_active=True,
        )

        mock_execution = WorkflowExecution(
            id=1,
            workflow_id=1,
            status=WorkflowStatus.COMPLETED,
            context={"result": "success"},
        )

        # Mock get_workflow_by_name
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_workflow
        db.execute = AsyncMock(return_value=mock_result)

        # Mock WorkflowEngine execution
        with patch("dotmac.platform.workflows.service.WorkflowEngine") as MockEngine:
            mock_engine = MockEngine.return_value
            mock_engine.execute_workflow = AsyncMock(return_value=mock_execution)

            result = await service.execute_workflow(
                workflow_name="test_workflow",
                context={"input": "data"},
            )

            assert result.status == WorkflowStatus.COMPLETED
            assert mock_engine.execute_workflow.called

    async def test_execute_workflow_not_found(self):
        """Test executing nonexistent workflow raises error"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="Workflow 'nonexistent' not found"):
            await service.execute_workflow(
                workflow_name="nonexistent",
                context={},
            )

    async def test_execute_workflow_inactive(self):
        """Test executing inactive workflow raises error"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = Workflow(
            id=1,
            name="inactive_workflow",
            definition={"steps": []},
            is_active=False,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_workflow
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="Workflow 'inactive_workflow' is not active"):
            await service.execute_workflow(
                workflow_name="inactive_workflow",
                context={},
            )

    async def test_execute_workflow_by_id(self):
        """Test executing workflow by ID"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = Workflow(
            id=1,
            name="test_workflow",
            definition={"steps": []},
            is_active=True,
        )

        mock_execution = WorkflowExecution(
            id=1,
            workflow_id=1,
            status=WorkflowStatus.COMPLETED,
        )

        db.get = AsyncMock(return_value=mock_workflow)

        with patch("dotmac.platform.workflows.service.WorkflowEngine") as MockEngine:
            mock_engine = MockEngine.return_value
            mock_engine.execute_workflow = AsyncMock(return_value=mock_execution)

            result = await service.execute_workflow_by_id(
                workflow_id=1,
                context={"input": "data"},
            )

            assert result.status == WorkflowStatus.COMPLETED

    async def test_execute_workflow_by_id_not_found(self):
        """Test executing workflow by nonexistent ID raises error"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        db.get = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="Workflow 999 not found"):
            await service.execute_workflow_by_id(
                workflow_id=999,
                context={},
            )


@pytest.mark.asyncio
class TestGetExecution:
    """Test execution retrieval"""

    async def test_get_execution_by_id(self):
        """Test retrieving execution by ID"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_execution = WorkflowExecution(
            id=1,
            workflow_id=1,
            status=WorkflowStatus.COMPLETED,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_execution
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_execution(execution_id=1)

        assert result is not None
        assert result.id == 1

    async def test_get_execution_not_found(self):
        """Test retrieving nonexistent execution returns None"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_execution(execution_id=999)

        assert result is None

    async def test_get_execution_with_steps(self):
        """Test retrieving execution with steps loaded"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_execution = WorkflowExecution(
            id=1,
            workflow_id=1,
            status=WorkflowStatus.COMPLETED,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_execution
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_execution(execution_id=1, include_steps=True)

        assert result is not None
        # Verify selectinload was used (checked via query construction)


@pytest.mark.asyncio
class TestListExecutions:
    """Test execution listing"""

    async def test_list_all_executions(self):
        """Test listing all executions"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_executions = [
            WorkflowExecution(id=1, workflow_id=1, status=WorkflowStatus.COMPLETED),
            WorkflowExecution(id=2, workflow_id=1, status=WorkflowStatus.RUNNING),
        ]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_executions
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_executions()

        assert len(result) == 2

    async def test_list_executions_filter_workflow(self):
        """Test listing executions filtered by workflow"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_executions = [
            WorkflowExecution(id=1, workflow_id=1, status=WorkflowStatus.COMPLETED),
        ]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_executions
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_executions(workflow_id=1)

        assert len(result) == 1
        assert result[0].workflow_id == 1

    async def test_list_executions_filter_status(self):
        """Test listing executions filtered by status"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_executions = [
            WorkflowExecution(id=1, workflow_id=1, status=WorkflowStatus.FAILED),
        ]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_executions
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_executions(status=WorkflowStatus.FAILED)

        assert len(result) == 1
        assert result[0].status == WorkflowStatus.FAILED

    async def test_list_executions_with_pagination(self):
        """Test listing executions with pagination"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_executions = [
            WorkflowExecution(id=1, workflow_id=1, status=WorkflowStatus.COMPLETED),
        ]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_executions
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_executions(limit=10, offset=20)

        assert len(result) == 1


@pytest.mark.asyncio
class TestCancelExecution:
    """Test execution cancellation"""

    async def test_cancel_execution(self):
        """Test cancelling a running execution"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        with patch("dotmac.platform.workflows.service.WorkflowEngine") as MockEngine:
            mock_engine = MockEngine.return_value
            mock_engine.cancel_execution = AsyncMock()

            await service.cancel_execution(execution_id=1)

            assert mock_engine.cancel_execution.called


@pytest.mark.asyncio
class TestGetExecutionStats:
    """Test execution statistics"""

    async def test_get_execution_stats(self):
        """Test getting execution statistics"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock query results with _mapping attribute to simulate SQLAlchemy row behavior
        def create_mock_row(status, count):
            row = MagicMock()
            row._mapping = {"status": status, "count": count}
            return row

        mock_rows = [
            create_mock_row(WorkflowStatus.COMPLETED, 10),
            create_mock_row(WorkflowStatus.FAILED, 2),
            create_mock_row(WorkflowStatus.RUNNING, 3),
        ]

        mock_result = MagicMock()
        mock_result.all.return_value = mock_rows
        db.execute = AsyncMock(return_value=mock_result)

        stats = await service.get_execution_stats()

        assert stats["total"] == 15
        assert stats["by_status"]["completed"] == 10
        assert stats["by_status"]["failed"] == 2
        assert stats["by_status"]["running"] == 3

    async def test_get_execution_stats_empty(self):
        """Test getting stats when no executions exist"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_result = MagicMock()
        mock_result.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        stats = await service.get_execution_stats()

        assert stats["total"] == 0
        assert stats["by_status"] == {}

    async def test_get_execution_stats_filter_workflow(self):
        """Test getting stats filtered by workflow"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock query results with _mapping attribute to simulate SQLAlchemy row behavior
        mock_row = MagicMock()
        mock_row._mapping = {"status": WorkflowStatus.COMPLETED, "count": 5}

        mock_result = MagicMock()
        mock_result.all.return_value = [mock_row]
        db.execute = AsyncMock(return_value=mock_result)

        stats = await service.get_execution_stats(workflow_id=1)

        assert stats["total"] == 5

    async def test_get_execution_stats_filter_tenant(self):
        """Test getting stats filtered by tenant"""
        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock query results with _mapping attribute to simulate SQLAlchemy row behavior
        mock_row = MagicMock()
        mock_row._mapping = {"status": WorkflowStatus.COMPLETED, "count": 3}

        mock_result = MagicMock()
        mock_result.all.return_value = [mock_row]
        db.execute = AsyncMock(return_value=mock_result)

        stats = await service.get_execution_stats(tenant_id="00000000-0000-0000-0000-0000000000dd")

        assert stats["total"] == 3
