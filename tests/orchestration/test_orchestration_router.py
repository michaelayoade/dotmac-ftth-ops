"""
Tests for Orchestration Router

Tests HTTP endpoints for subscriber provisioning, deprovisioning, service activation/suspension,
workflow management, statistics, and export functionality.

Note: Uses authenticated_client fixture from tests/conftest.py
"""

from io import BytesIO
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, status
from starlette.requests import Request

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.orchestration import router as orchestration_router
from dotmac.platform.orchestration.models import WorkflowStatus, WorkflowType
from dotmac.platform.tenant import set_current_tenant_id



pytestmark = pytest.mark.integration

class TestSubscriberProvisioning:
    """Test subscriber provisioning endpoints."""

    async def test_provision_subscriber_success(
        self, authenticated_client, mock_orchestration_service, sample_provision_request
    ):
        """Test successful subscriber provisioning."""
        # Arrange
        provision_response = {
            "workflow_id": "wf-123456",
            "subscriber_id": "sub-12345",
            "customer_id": "cust-67890",
            "status": "completed",
            "radius_username": "john.doe@isp.com",
            "ipv4_address": "10.0.1.100",
            "vlan_id": 100,
            "onu_id": "onu-abc123",
            "cpe_id": "cpe-def456",
            "service_id": "svc-789",
            "steps_completed": 7,
            "total_steps": 7,
            "error_message": None,
            "created_at": "2025-01-18T10:00:00Z",
            "completed_at": "2025-01-18T10:05:00Z",
        }
        mock_orchestration_service.provision_subscriber.return_value = provision_response

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/provision-subscriber", json=sample_provision_request
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["workflow_id"] == "wf-123456"
        assert data["subscriber_id"] == "sub-12345"
        assert data["status"] == "completed"
        assert data["steps_completed"] == 7

        # Verify service was called
        mock_orchestration_service.provision_subscriber.assert_called_once()

    async def test_provision_subscriber_validation_error(
        self, authenticated_client, mock_current_user
    ):
        """Test provision subscriber with invalid request data."""
        # Act - Missing required fields
        response = await authenticated_client.post(
            "/api/v1/orchestration/provision-subscriber",
            json={
                "first_name": "John"
                # Missing required fields like last_name, email, etc.
            },
        )

        # Assert
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert "detail" in data

    async def test_provision_subscriber_empty_name(
        self, authenticated_client, mock_current_user
    ):
        """Test provision subscriber with empty name.

        Uses create_provision_request factory to create test data with empty name.
        This avoids fixture mutation and makes test data explicit.
        """
        from tests.orchestration.conftest import create_provision_request

        # Arrange
        request_data = create_provision_request(first_name="")

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/provision-subscriber", json=request_data
        )

        # Assert
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_provision_subscriber_invalid_bandwidth(
        self, authenticated_client, mock_current_user
    ):
        """Test provision subscriber with invalid bandwidth.

        Uses create_provision_request factory to create test data with invalid bandwidth.
        This avoids fixture mutation and makes test data explicit.
        """
        from tests.orchestration.conftest import create_provision_request

        # Arrange
        request_data = create_provision_request(bandwidth_mbps=-10)

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/provision-subscriber", json=request_data
        )

        # Assert
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_provision_subscriber_service_error(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_provision_request,
    ):
        """Test provision subscriber when service raises an error."""
        # Arrange
        mock_orchestration_service.provision_subscriber.side_effect = Exception("Service error")

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/provision-subscriber", json=sample_provision_request
        )

        # Assert
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    async def test_provision_subscriber_requires_permission(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_provision_request,
    ):
        """Provisioning should return 403 when user lacks permissions."""

        mock_current_user.permissions = []

        response = await authenticated_client.post(
            "/api/v1/orchestration/provision-subscriber",
            json=sample_provision_request,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        mock_orchestration_service.provision_subscriber.assert_not_called()


class TestSubscriberDeprovisioning:
    """Test subscriber deprovisioning endpoints."""

    async def test_deprovision_subscriber_success(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_deprovision_request,
        sample_workflow,
    ):
        """Test successful subscriber deprovisioning."""
        # Arrange
        sample_workflow.workflow_type = WorkflowType.DEPROVISION_SUBSCRIBER
        mock_orchestration_service.deprovision_subscriber.return_value = sample_workflow

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/deprovision-subscriber", json=sample_deprovision_request
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["workflow_id"] == "wf-123456"
        assert data["workflow_type"] == "deprovision_subscriber"

    async def test_deprovision_subscriber_validation_error(
        self, authenticated_client, mock_current_user
    ):
        """Test deprovision subscriber with missing subscriber_id."""
        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/deprovision-subscriber",
            json={
                "reason": "customer_request"
                # Missing subscriber_id
            },
        )

        # Assert
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_deprovision_subscriber_service_error(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_deprovision_request,
    ):
        """Test deprovision subscriber when service raises an error."""
        # Arrange
        mock_orchestration_service.deprovision_subscriber.side_effect = Exception(
            "Deprovisioning failed"
        )

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/deprovision-subscriber", json=sample_deprovision_request
        )

        # Assert
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


class TestServiceActivation:
    """Test service activation endpoints."""

    async def test_activate_service_success(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_activate_request,
        sample_workflow,
    ):
        """Test successful service activation."""
        # Arrange
        sample_workflow.workflow_type = WorkflowType.ACTIVATE_SERVICE
        mock_orchestration_service.activate_service.return_value = sample_workflow

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/activate-service", json=sample_activate_request
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["workflow_type"] == "activate_service"
        assert data["status"] == "completed"

    async def test_activate_service_validation_error(self, authenticated_client, mock_current_user):
        """Test activate service with missing subscriber_id."""
        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/activate-service", json={}
        )

        # Assert
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestServiceSuspension:
    """Test service suspension endpoints."""

    async def test_suspend_service_success(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_suspend_request,
        sample_workflow,
    ):
        """Test successful service suspension."""
        # Arrange
        sample_workflow.workflow_type = WorkflowType.SUSPEND_SERVICE
        mock_orchestration_service.suspend_service.return_value = sample_workflow

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/suspend-service", json=sample_suspend_request
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["workflow_type"] == "suspend_service"

    async def test_suspend_service_validation_error(self, authenticated_client, mock_current_user):
        """Test suspend service with missing required fields."""
        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/suspend-service",
            json={"subscriber_id": "sub-123"},  # Missing reason
        )

        # Assert
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestWorkflowManagement:
    """Test workflow management endpoints."""

    async def test_list_workflows_success(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test list workflows."""
        # Arrange
        workflow_dict = {
            "workflow_id": "wf-123456",
            "workflow_type": "provision_subscriber",
            "status": "completed",
            "started_at": "2025-01-18T10:00:00Z",
            "completed_at": "2025-01-18T10:05:00Z",
            "failed_at": None,
            "error_message": None,
            "retry_count": 0,
            "steps": [],
        }
        mock_orchestration_service.list_workflows.return_value = {
            "workflows": [workflow_dict],
            "total": 1,
            "limit": 10,
            "offset": 0,
        }

        # Act
        response = await authenticated_client.get("/api/v1/orchestration/workflows")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "workflows" in data
        assert data["total"] == 1
        assert len(data["workflows"]) == 1
        assert data["workflows"][0]["workflow_id"] == "wf-123456"

    async def test_list_workflows_filtered_by_type(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test list workflows filtered by workflow type."""
        # Arrange
        workflow_dict = {
            "workflow_id": "wf-123456",
            "workflow_type": "provision_subscriber",
            "status": "completed",
            "started_at": "2025-01-18T10:00:00Z",
            "completed_at": "2025-01-18T10:05:00Z",
            "failed_at": None,
            "error_message": None,
            "retry_count": 0,
            "steps": [],
        }
        mock_orchestration_service.list_workflows.return_value = {
            "workflows": [workflow_dict],
            "total": 1,
            "limit": 10,
            "offset": 0,
        }

        # Act
        response = await authenticated_client.get(
            "/api/v1/orchestration/workflows", params={"workflow_type": "provision_subscriber"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["workflows"]) == 1
        assert data["workflows"][0]["workflow_type"] == "provision_subscriber"

    async def test_list_workflows_filtered_by_status(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test list workflows filtered by status."""
        # Arrange
        workflow_dict = {
            "workflow_id": "wf-123456",
            "workflow_type": "provision_subscriber",
            "status": "completed",
            "started_at": "2025-01-18T10:00:00Z",
            "completed_at": "2025-01-18T10:05:00Z",
            "failed_at": None,
            "error_message": None,
            "retry_count": 0,
            "steps": [],
        }
        mock_orchestration_service.list_workflows.return_value = {
            "workflows": [workflow_dict],
            "total": 1,
            "limit": 10,
            "offset": 0,
        }

        # Act
        response = await authenticated_client.get(
            "/api/v1/orchestration/workflows", params={"status": "completed"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["workflows"][0]["status"] == "completed"

    async def test_get_workflow_success(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_workflow_with_steps,
    ):
        """Test get workflow by ID."""
        # Arrange
        mock_orchestration_service.get_workflow.return_value = sample_workflow_with_steps

        # Act
        response = await authenticated_client.get("/api/v1/orchestration/workflows/wf-123456")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["workflow_id"] == "wf-123456"
        assert "steps" in data
        assert len(data["steps"]) == 3

    async def test_get_workflow_not_found(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test get non-existent workflow."""
        # Arrange
        mock_orchestration_service.get_workflow.return_value = None

        # Act
        response = await authenticated_client.get("/api/v1/orchestration/workflows/nonexistent")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_retry_workflow_success(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_failed_workflow,
    ):
        """Test retry failed workflow."""
        # Arrange
        mock_orchestration_service.retry_workflow.return_value = sample_failed_workflow

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/workflows/wf-789012/retry"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["workflow_id"] == "wf-789012"

    async def test_retry_workflow_not_found(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test retry non-existent workflow."""
        # Arrange
        mock_orchestration_service.retry_workflow.side_effect = ValueError("Workflow not found")

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/workflows/nonexistent/retry"
        )

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Workflow not found" in data["detail"]

    async def test_retry_workflow_invalid_state(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test retry workflow in invalid state."""
        # Arrange
        mock_orchestration_service.retry_workflow.side_effect = ValueError(
            "Cannot retry workflow in completed state"
        )

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/workflows/wf-123456/retry"
        )

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    async def test_cancel_workflow_success(
        self, authenticated_client, mock_orchestration_service, mock_current_user, sample_workflow
    ):
        """Test cancel running workflow."""
        # Arrange
        sample_workflow.status = WorkflowStatus.RUNNING
        mock_orchestration_service.cancel_workflow.return_value = sample_workflow

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/workflows/wf-123456/cancel"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["workflow_id"] == "wf-123456"

    async def test_cancel_workflow_not_found(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test cancel non-existent workflow."""
        # Arrange
        mock_orchestration_service.cancel_workflow.side_effect = ValueError("Workflow not found")

        # Act
        response = await authenticated_client.post(
            "/api/v1/orchestration/workflows/nonexistent/cancel"
        )

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Workflow not found" in data["detail"]


class TestWorkflowStatistics:
    """Test workflow statistics endpoints."""

    async def test_get_statistics_success(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_workflow_stats,
    ):
        """Test get workflow statistics."""
        # Arrange
        mock_orchestration_service.get_workflow_statistics.return_value = sample_workflow_stats

        # Act
        response = await authenticated_client.get("/api/v1/orchestration/statistics")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_workflows"] == 150
        assert "by_status" in data
        assert "by_type" in data
        assert data["success_rate"] == 0.88

    async def test_get_statistics_filtered(
        self,
        authenticated_client,
        mock_orchestration_service,
        mock_current_user,
        sample_workflow_stats,
    ):
        """Test get workflow statistics with filters."""
        # Arrange
        mock_orchestration_service.get_workflow_statistics.return_value = sample_workflow_stats

        # Act
        response = await authenticated_client.get(
            "/api/v1/orchestration/statistics", params={"workflow_type": "provision_subscriber"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_workflows" in data


class TestWorkflowExport:
    """Test workflow export endpoints."""

    async def test_export_workflows_csv_success(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test export workflows as CSV."""
        # Arrange
        csv_content = "workflow_id,workflow_type,status\nwf-123456,provision_subscriber,completed\n"
        mock_orchestration_service.export_workflows_csv.return_value = BytesIO(csv_content.encode())

        # Act
        response = await authenticated_client.get("/api/v1/orchestration/export/csv")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment" in response.headers["content-disposition"]
        assert ".csv" in response.headers["content-disposition"]

    async def test_export_workflows_csv_filtered(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test export workflows as CSV with filters."""
        # Arrange
        csv_content = "workflow_id,workflow_type,status\nwf-123456,provision_subscriber,completed\n"
        mock_orchestration_service.export_workflows_csv.return_value = BytesIO(csv_content.encode())

        # Act
        response = await authenticated_client.get(
            "/api/v1/orchestration/export/csv",
            params={
                "workflow_type": "provision_subscriber",
                "status": "completed",
                "date_from": "2025-01-01",
                "date_to": "2025-01-31",
            },
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "text/csv; charset=utf-8"

    async def test_export_workflows_json_success(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test export workflows as JSON."""
        # Arrange
        json_content = '[{"workflow_id": "wf-123456", "workflow_type": "provision_subscriber", "status": "completed"}]'
        mock_orchestration_service.export_workflows_json.return_value = BytesIO(
            json_content.encode()
        )

        # Act
        response = await authenticated_client.get("/api/v1/orchestration/export/json")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/json"
        assert "attachment" in response.headers["content-disposition"]
        assert ".json" in response.headers["content-disposition"]

    async def test_export_workflows_json_filtered(
        self, authenticated_client, mock_orchestration_service, mock_current_user
    ):
        """Test export workflows as JSON with filters."""
        # Arrange
        json_content = '[{"workflow_id": "wf-123456", "workflow_type": "provision_subscriber"}]'
        mock_orchestration_service.export_workflows_json.return_value = BytesIO(
            json_content.encode()
        )

        # Act
        response = await authenticated_client.get(
            "/api/v1/orchestration/export/json", params={"status": "failed", "limit": 100}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/json"
        assert "attachment" in response.headers["content-disposition"]
        assert ".json" in response.headers["content-disposition"]


class TestOrchestrationServiceDependency:
    """Unit tests for orchestration dependency resolution."""

    @staticmethod
    def _make_request():
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
        }

        async def _receive():
            return {"type": "http.request"}

        return Request(scope, _receive)

    def teardown_method(self):
        set_current_tenant_id(None)

    def test_platform_admin_uses_request_state(self, monkeypatch):
        request = self._make_request()
        request.state.tenant_id = "tenant-from-header"

        db = MagicMock()
        user = UserInfo(
            user_id="admin-user",
            tenant_id=None,
            roles=[],
            permissions=["*"],
            is_platform_admin=True,
        )

        captured: dict[str, dict[str, Any]] = {}

        def _fake_service(*, db: Any, tenant_id: str):
            captured["kwargs"] = {"db": db, "tenant_id": tenant_id}
            return "service-instance"

        monkeypatch.setattr(orchestration_router, "OrchestrationService", _fake_service)

        result = orchestration_router.get_orchestration_service(
            request=request,
            db=db,
            current_user=user,
        )

        assert result == "service-instance"
        assert captured["kwargs"]["db"] is db
        assert captured["kwargs"]["tenant_id"] == "tenant-from-header"

    def test_platform_admin_requires_target_tenant(self, monkeypatch):
        request = self._make_request()
        set_current_tenant_id(None)

        db = MagicMock()
        user = UserInfo(
            user_id="admin-user",
            tenant_id=None,
            roles=[],
            permissions=["*"],
            is_platform_admin=True,
        )

        monkeypatch.setattr(orchestration_router, "get_current_tenant_id", lambda: None)
        monkeypatch.setattr(
            orchestration_router,
            "OrchestrationService",
            lambda *_args, **_kwargs: "service-instance",
        )

        with pytest.raises(HTTPException) as exc:
            orchestration_router.get_orchestration_service(
                request=request,
                db=db,
                current_user=user,
            )

        assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "X-Target-Tenant-ID" in exc.value.detail

    def test_falls_back_to_context_for_tenant_user(self, monkeypatch):
        request = self._make_request()
        set_current_tenant_id("context-tenant")

        db = MagicMock()
        user = UserInfo(
            user_id="tenant-user",
            tenant_id=None,
            roles=["tenant-admin"],
            permissions=["subscribers.read"],
            is_platform_admin=False,
        )

        captured: dict[str, dict[str, Any]] = {}

        def _fake_service(*, db: Any, tenant_id: str):
            captured["kwargs"] = {"db": db, "tenant_id": tenant_id}
            return "service-instance"

        monkeypatch.setattr(orchestration_router, "OrchestrationService", _fake_service)

        result = orchestration_router.get_orchestration_service(
            request=request,
            db=db,
            current_user=user,
        )

        assert result == "service-instance"
        assert captured["kwargs"]["db"] is db
        assert captured["kwargs"]["tenant_id"] == "context-tenant"
