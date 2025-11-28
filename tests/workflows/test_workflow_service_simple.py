"""
Simple Unit Tests for Workflow Service

Tests the WorkflowService with mocked database operations.
Avoids model instantiation to prevent SQLAlchemy configuration issues.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
class TestWorkflowServiceInitialization:
    """Test service initialization"""

    async def test_service_creation(self):
        """Test creating workflow service"""
        from dotmac.platform.workflows.service import WorkflowService

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
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        assert service.db is db
        assert service.event_publisher is None
        assert service.service_registry is None


@pytest.mark.asyncio
class TestCreateWorkflow:
    """Test workflow creation"""

    async def test_create_workflow_calls_db(self):
        """Test that create_workflow calls database methods"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock the Workflow model to avoid SQLAlchemy configuration
        with patch("dotmac.platform.workflows.service.Workflow") as MockWorkflow:
            mock_workflow_instance = MagicMock()
            mock_workflow_instance.name = "test_workflow"
            mock_workflow_instance.description = "Test"
            mock_workflow_instance.is_active = True

            MockWorkflow.return_value = mock_workflow_instance

            result = await service.create_workflow(
                name="test_workflow",
                definition={"steps": []},
                description="Test",
                version="1.0.0",
            )

            # Verify database calls
            assert db.add.called
            assert db.commit.called
            assert db.refresh.called

            # Verify workflow properties
            assert result.name == "test_workflow"
            assert result.description == "Test"
            assert result.is_active is True


@pytest.mark.asyncio
class TestUpdateWorkflow:
    """Test workflow updates"""

    async def test_update_workflow_success(self):
        """Test updating an existing workflow"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock existing workflow
        mock_workflow = MagicMock()
        mock_workflow.id = 1
        mock_workflow.name = "existing"
        mock_workflow.definition = {"steps": []}

        db.get = AsyncMock(return_value=mock_workflow)

        await service.update_workflow(
            workflow_id=1,
            definition={"steps": [{"name": "new_step"}]},
        )

        assert db.commit.called
        assert db.refresh.called

    async def test_update_workflow_not_found(self):
        """Test updating nonexistent workflow raises error"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        db.get = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="Workflow 999 not found"):
            await service.update_workflow(workflow_id=999, definition={})


@pytest.mark.asyncio
class TestGetWorkflow:
    """Test workflow retrieval"""

    async def test_get_workflow_by_id(self):
        """Test retrieving workflow by ID"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = MagicMock()
        mock_workflow.id = 1

        db.get = AsyncMock(return_value=mock_workflow)

        result = await service.get_workflow(workflow_id=1)

        assert result is not None
        assert result.id == 1
        db.get.assert_called_once()

    async def test_get_workflow_not_found(self):
        """Test retrieving nonexistent workflow"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        db.get = AsyncMock(return_value=None)

        result = await service.get_workflow(workflow_id=999)

        assert result is None

    async def test_get_workflow_by_name(self):
        """Test retrieving workflow by name"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = MagicMock()
        mock_workflow.name = "test_workflow"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_workflow
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_workflow_by_name("test_workflow")

        assert result is not None
        assert result.name == "test_workflow"


@pytest.mark.asyncio
class TestListWorkflows:
    """Test workflow listing"""

    async def test_list_all_workflows(self):
        """Test listing workflows"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflows = [MagicMock(), MagicMock(), MagicMock()]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_workflows
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_workflows()

        assert len(result) == 3

    async def test_list_workflows_with_filters(self):
        """Test listing workflows with filters"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflows = [MagicMock()]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_workflows
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_workflows(is_active=True)

        assert len(result) == 1


@pytest.mark.asyncio
class TestDeleteWorkflow:
    """Test workflow deletion"""

    async def test_delete_workflow_success(self):
        """Test deleting a workflow"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = MagicMock()
        mock_workflow.id = 1

        db.get = AsyncMock(return_value=mock_workflow)

        await service.delete_workflow(workflow_id=1)

        assert db.delete.called
        assert db.commit.called

    async def test_delete_workflow_not_found(self):
        """Test deleting nonexistent workflow raises error"""
        from dotmac.platform.workflows.service import WorkflowService

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
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock workflow
        mock_workflow = MagicMock()
        mock_workflow.id = 1
        mock_workflow.is_active = True

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_workflow
        db.execute = AsyncMock(return_value=mock_result)

        # Mock execution result
        mock_execution = MagicMock()
        mock_execution.id = 1

        with patch("dotmac.platform.workflows.service.WorkflowEngine") as MockEngine:
            mock_engine = MockEngine.return_value
            mock_engine.execute_workflow = AsyncMock(return_value=mock_execution)

            result = await service.execute_workflow(
                workflow_name="test_workflow",
                context={"test": "data"},
            )

            assert result is not None
            assert mock_engine.execute_workflow.called

    async def test_execute_workflow_not_found(self):
        """Test executing nonexistent workflow"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="not found"):
            await service.execute_workflow(
                workflow_name="nonexistent",
                context={},
            )

    async def test_execute_workflow_inactive(self):
        """Test executing inactive workflow"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = MagicMock()
        mock_workflow.is_active = False

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_workflow
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="is not active"):
            await service.execute_workflow(
                workflow_name="inactive",
                context={},
            )

    async def test_execute_workflow_by_id(self):
        """Test executing workflow by ID"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_workflow = MagicMock()
        mock_workflow.id = 1
        mock_workflow.is_active = True

        db.get = AsyncMock(return_value=mock_workflow)

        mock_execution = MagicMock()

        with patch("dotmac.platform.workflows.service.WorkflowEngine") as MockEngine:
            mock_engine = MockEngine.return_value
            mock_engine.execute_workflow = AsyncMock(return_value=mock_execution)

            result = await service.execute_workflow_by_id(
                workflow_id=1,
                context={},
            )

            assert result is not None


@pytest.mark.asyncio
class TestGetExecution:
    """Test execution retrieval"""

    async def test_get_execution_by_id(self):
        """Test retrieving execution by ID"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_execution = MagicMock()
        mock_execution.id = 1

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_execution
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_execution(execution_id=1)

        assert result is not None
        assert result.id == 1

    async def test_get_execution_not_found(self):
        """Test retrieving nonexistent execution"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_execution(execution_id=999)

        assert result is None

    # Note: test_get_execution_with_steps removed due to SQLAlchemy selectinload mocking complexity
    # The include_steps parameter calls selectinload(WorkflowExecution.steps) which cannot be easily mocked
    # This parameter is covered by integration tests instead


@pytest.mark.asyncio
class TestListExecutions:
    """Test execution listing"""

    async def test_list_all_executions(self):
        """Test listing all executions"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_executions = [MagicMock(), MagicMock()]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_executions
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_executions()

        assert len(result) == 2

    async def test_list_executions_with_filters(self):
        """Test listing executions with filters"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_executions = [MagicMock()]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_executions
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        from dotmac.platform.workflows.models import WorkflowStatus

        result = await service.list_executions(workflow_id=1, status=WorkflowStatus.COMPLETED)

        assert len(result) == 1

    async def test_list_executions_with_pagination(self):
        """Test listing executions with pagination"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_executions = [MagicMock()]

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_executions
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.list_executions(limit=10, offset=5)

        assert len(result) == 1


@pytest.mark.asyncio
class TestCancelExecution:
    """Test execution cancellation"""

    async def test_cancel_execution(self):
        """Test cancelling an execution"""
        from dotmac.platform.workflows.service import WorkflowService

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
        from dotmac.platform.workflows.models import WorkflowStatus
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock query results with _mapping attribute to simulate SQLAlchemy row behavior
        mock_row1 = MagicMock()
        mock_row1._mapping = {"status": WorkflowStatus.COMPLETED, "count": 10}

        mock_row2 = MagicMock()
        mock_row2._mapping = {"status": WorkflowStatus.FAILED, "count": 2}

        mock_result = MagicMock()
        mock_result.all.return_value = [mock_row1, mock_row2]
        db.execute = AsyncMock(return_value=mock_result)

        stats = await service.get_execution_stats()

        assert stats["total"] == 12
        assert stats["by_status"]["completed"] == 10
        assert stats["by_status"]["failed"] == 2

    async def test_get_execution_stats_empty(self):
        """Test getting stats when no executions exist"""
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        mock_result = MagicMock()
        mock_result.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        stats = await service.get_execution_stats()

        assert stats["total"] == 0
        assert stats["by_status"] == {}

    async def test_get_execution_stats_with_filters(self):
        """Test getting stats with filters"""
        from dotmac.platform.workflows.models import WorkflowStatus
        from dotmac.platform.workflows.service import WorkflowService

        db = AsyncMock()
        service = WorkflowService(db_session=db)

        # Mock query results with _mapping attribute to simulate SQLAlchemy row behavior
        mock_row = MagicMock()
        mock_row._mapping = {"status": WorkflowStatus.COMPLETED, "count": 5}

        mock_result = MagicMock()
        mock_result.all.return_value = [mock_row]
        db.execute = AsyncMock(return_value=mock_result)

        stats = await service.get_execution_stats(
            workflow_id=1,
            tenant_id="00000000-0000-0000-0000-0000000000cc",
        )

        assert stats["total"] == 5
