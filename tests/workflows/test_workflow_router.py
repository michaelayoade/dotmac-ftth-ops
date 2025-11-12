"""
Tests for Workflow Router

Tests HTTP endpoints, request validation, response formatting, and error handling
for the workflow management API.
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient

pytestmark = pytest.mark.integration


class TestWorkflowCRUD:
    """Test workflow template CRUD endpoints."""

    def test_create_workflow_success(
        self,
        workflow_client: TestClient,
        mock_workflow_service,
        sample_workflow,
        sample_workflow_definition,
    ):
        """Test successful workflow creation."""
        # Arrange
        mock_workflow_service.create_workflow.return_value = sample_workflow

        # Act
        response = workflow_client.post(
            "/api/v1/workflows/",
            json={
                "name": "test_workflow",
                "description": "Test workflow for unit tests",
                "definition": sample_workflow_definition,
                "version": "1.0.0",
                "tags": {"category": "test"},
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["id"] == 1
        assert data["name"] == "test_workflow"
        assert data["description"] == "Test workflow for unit tests"
        assert data["is_active"] is True
        assert data["version"] == "1.0.0"
        assert "definition" in data
        assert "created_at" in data

    def test_create_workflow_validation_error(self, workflow_client: TestClient):
        """Test workflow creation with invalid data."""
        # Act - missing required field 'definition'
        response = workflow_client.post(
            "/api/v1/workflows/",
            json={
                "name": "test_workflow",
                "description": "Test workflow",
                # Missing 'definition'
            },
        )

        # Assert
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert "detail" in data

    def test_get_workflow_success(
        self, workflow_client: TestClient, mock_workflow_service, sample_workflow
    ):
        """Test get workflow by ID."""
        # Arrange
        mock_workflow_service.get_workflow.return_value = sample_workflow

        # Act
        response = workflow_client.get("/api/v1/workflows/1")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == 1
        assert data["name"] == "test_workflow"
        assert data["is_active"] is True

    def test_get_workflow_not_found(self, workflow_client: TestClient, mock_workflow_service):
        """Test get non-existent workflow."""
        # Arrange
        mock_workflow_service.get_workflow.return_value = None

        # Act
        response = workflow_client.get("/api/v1/workflows/999")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_list_workflows_success(
        self, workflow_client: TestClient, mock_workflow_service, sample_workflow
    ):
        """Test list all workflows."""
        # Arrange
        workflow2 = {
            **sample_workflow,
            "id": 2,
            "name": "workflow_2",
            "description": "Second workflow",
        }
        mock_workflow_service.list_workflows.return_value = [sample_workflow, workflow2]

        # Act
        response = workflow_client.get("/api/v1/workflows/")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 2
        assert len(data["workflows"]) == 2
        assert data["workflows"][0]["id"] == 1
        assert data["workflows"][1]["id"] == 2

    def test_delete_workflow_not_found(self, workflow_client: TestClient, mock_workflow_service):
        """Test workflow deletion when service reports missing workflow."""
        # Arrange
        mock_workflow_service.delete_workflow.side_effect = ValueError("Workflow 1 not found")

        # Act
        response = workflow_client.delete("/api/v1/workflows/1")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()
        mock_workflow_service.delete_workflow.assert_called_once_with(1)


class TestWorkflowExecution:
    """Test workflow execution endpoints."""

    def test_execute_workflow_by_name_success(
        self, workflow_client: TestClient, mock_workflow_service, sample_workflow_execution
    ):
        """Test successful workflow execution by name."""
        # Arrange
        mock_workflow_service.execute_workflow.return_value = sample_workflow_execution

        # Act
        response = workflow_client.post(
            "/api/v1/workflows/execute",
            json={
                "workflow_name": "test_workflow",
                "context": {"subscriber_id": "SUB-123", "username": "test@example.com"},
                "trigger_type": "manual",
                "trigger_source": "api",
                "tenant_id": "00000000-0000-0000-0000-0000000000bb",
            },
        )

        # Assert
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["id"] == 1
        assert data["workflow_id"] == 1
        assert data["status"] == "completed"
        assert data["trigger_type"] == "manual"
        assert "context" in data

    def test_get_execution_success(
        self, workflow_client: TestClient, mock_workflow_service, sample_workflow_execution
    ):
        """Test get workflow execution by ID."""
        # Arrange
        mock_workflow_service.get_execution.return_value = sample_workflow_execution

        # Act
        response = workflow_client.get("/api/v1/workflows/executions/1")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == 1
        assert data["status"] == "completed"

    def test_list_executions_success(
        self, workflow_client: TestClient, mock_workflow_service, sample_workflow_execution
    ):
        """Test list workflow executions."""
        # Arrange - service returns list, router wraps in response
        mock_workflow_service.list_executions.return_value = [sample_workflow_execution]

        # Act
        response = workflow_client.get("/api/v1/workflows/executions")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert len(data["executions"]) == 1


class TestWorkflowCRUDExtended:
    """Test additional workflow CRUD operations."""

    def test_update_workflow_success(
        self, workflow_client: TestClient, mock_workflow_service, sample_workflow
    ):
        """Test successful workflow update."""
        # Arrange
        updated_workflow = {**sample_workflow, "description": "Updated description"}
        mock_workflow_service.update_workflow.return_value = updated_workflow

        # Act
        response = workflow_client.patch(
            "/api/v1/workflows/1", json={"description": "Updated description", "is_active": True}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == 1
        assert data["description"] == "Updated description"

    def test_delete_workflow_success(self, workflow_client: TestClient, mock_workflow_service):
        """Test successful workflow deletion."""
        # Arrange
        mock_workflow_service.delete_workflow.return_value = None

        # Act
        response = workflow_client.delete("/api/v1/workflows/1")

        # Assert
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_workflow_service.delete_workflow.assert_called_once_with(1)

    def test_execute_workflow_by_id_success(
        self, workflow_client: TestClient, mock_workflow_service, sample_workflow_execution
    ):
        """Test executing workflow by ID."""
        # Arrange
        mock_workflow_service.execute_workflow_by_id.return_value = sample_workflow_execution

        # Act
        response = workflow_client.post(
            "/api/v1/workflows/1/execute",
            params={
                "trigger_type": "manual",
                "trigger_source": "api",
                "tenant_id": "00000000-0000-0000-0000-0000000000ee",
            },
            json={"subscriber_id": "SUB-123", "username": "test@example.com"},
        )

        # Assert
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["id"] == 1
        assert data["workflow_id"] == 1
        assert data["status"] == "completed"
        mock_workflow_service.execute_workflow_by_id.assert_called_once_with(
            workflow_id=1,
            context={"subscriber_id": "SUB-123", "username": "test@example.com"},
            trigger_type="manual",
            trigger_source="api",
            tenant_id="00000000-0000-0000-0000-0000000000ee",
        )

    def test_cancel_execution_success(self, workflow_client: TestClient, mock_workflow_service):
        """Test successful execution cancellation."""
        # Arrange
        mock_workflow_service.cancel_execution.return_value = None

        # Act
        response = workflow_client.post("/api/v1/workflows/executions/1/cancel")

        # Assert
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_workflow_service.cancel_execution.assert_called_once_with(1)


class TestWorkflowStatistics:
    """Test workflow statistics endpoints."""

    def test_get_workflow_stats_success(self, workflow_client: TestClient, mock_workflow_service):
        """Test get workflow execution statistics."""
        # Arrange
        mock_workflow_service.get_execution_stats.return_value = {
            "total": 100,
            "by_status": {"completed": 80, "failed": 15, "running": 3, "pending": 2},
        }

        # Act
        response = workflow_client.get("/api/v1/workflows/stats")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 100
        assert "by_status" in data
        assert data["by_status"]["completed"] == 80
