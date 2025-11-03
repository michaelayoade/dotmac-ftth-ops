"""
Tests for Deployment Router

Tests HTTP endpoints, request validation, response formatting, and error handling
for the deployment management API.
"""

from datetime import datetime

import pytest
from fastapi import status
from httpx import AsyncClient

pytestmark = pytest.mark.integration


class TestDeploymentTemplates:
    """Test deployment template CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_list_templates_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_template
    ):
        """Test list deployment templates."""
        # Arrange
        mock_deployment_registry.list_templates.return_value = ([sample_deployment_template], 1)

        # Act
        response = await async_client.get("/api/v1/deployment/templates")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == 1
        assert data[0]["name"] == "test_template"

    @pytest.mark.asyncio
    async def test_create_template_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_template
    ):
        """Test create deployment template."""
        # Arrange
        mock_deployment_registry.get_template_by_name.return_value = None
        mock_deployment_registry.create_template.return_value = sample_deployment_template

        # Act
        response = await async_client.post(
            "/api/v1/deployment/templates",
            json={
                "name": "test_template",
                "display_name": "Test Template",
                "description": "Test deployment template",
                "backend": "kubernetes",
                "deployment_type": "cloud_shared",
                "version": "1.0.0",
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["id"] == 1
        assert data["name"] == "test_template"

    @pytest.mark.asyncio
    async def test_create_template_duplicate_name(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_template
    ):
        """Test create template with duplicate name."""
        # Arrange
        mock_deployment_registry.get_template_by_name.return_value = sample_deployment_template

        # Act
        response = await async_client.post(
            "/api/v1/deployment/templates",
            json={
                "name": "test_template",
                "display_name": "Test Template",
                "description": "Test deployment template",
                "backend": "kubernetes",
                "deployment_type": "cloud_shared",
                "version": "1.0.0",
            },
        )

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_template_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_template
    ):
        """Test get deployment template by ID."""
        # Arrange
        mock_deployment_registry.get_template.return_value = sample_deployment_template

        # Act
        response = await async_client.get("/api/v1/deployment/templates/1")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == 1
        assert data["name"] == "test_template"

    @pytest.mark.asyncio
    async def test_get_template_not_found(
        self, async_client: AsyncClient, mock_deployment_registry
    ):
        """Test get non-existent template."""
        # Arrange
        mock_deployment_registry.get_template.return_value = None

        # Act
        response = await async_client.get("/api/v1/deployment/templates/999")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_update_template_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_template
    ):
        """Test update deployment template."""
        # Arrange
        from tests.deployment.conftest import MockObject

        updated_template = MockObject(
            id=1,
            name="test_template",
            display_name="Test Template",
            description="Updated description",  # Changed
            backend="kubernetes",
            deployment_type="cloud_shared",
            version="1.0.0",
            is_active=True,
            requires_approval=False,
            cpu_cores=2,
            memory_gb=4,
            storage_gb=100,
            max_users=None,
            config_schema=None,
            default_config=None,
            required_secrets=None,
            feature_flags=None,
            helm_chart_url=None,
            helm_chart_version=None,
            ansible_playbook_path=None,
            terraform_module_path=None,
            docker_compose_path=None,
            created_at=datetime.fromisoformat("2025-01-01T12:00:00"),
            updated_at=datetime.fromisoformat("2025-01-01T12:05:00"),  # Changed
        )
        mock_deployment_registry.update_template.return_value = updated_template

        # Act
        response = await async_client.patch(
            "/api/v1/deployment/templates/1", json={"description": "Updated description"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["description"] == "Updated description"


class TestDeploymentInstances:
    """Test deployment instance endpoints."""

    @pytest.mark.asyncio
    async def test_list_instances_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_instance
    ):
        """Test list deployment instances."""
        # Arrange
        mock_deployment_registry.list_instances.return_value = ([sample_deployment_instance], 1)

        # Act
        response = await async_client.get("/api/v1/deployment/instances")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert len(data["instances"]) == 1
        assert data["instances"][0]["id"] == 1

    @pytest.mark.asyncio
    async def test_list_instances_filtered(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_instance
    ):
        """Test list instances with filters."""
        # Arrange
        mock_deployment_registry.list_instances.return_value = ([sample_deployment_instance], 1)

        # Act
        response = await async_client.get(
            "/api/v1/deployment/instances?state=active&environment=staging"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_get_instance_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_instance
    ):
        """Test get deployment instance by ID."""
        # Arrange
        mock_deployment_registry.get_instance.return_value = sample_deployment_instance

        # Act
        response = await async_client.get("/api/v1/deployment/instances/1")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == 1
        assert data["state"] == "active"

    @pytest.mark.asyncio
    async def test_get_instance_not_found(
        self, async_client: AsyncClient, mock_deployment_registry
    ):
        """Test get non-existent instance."""
        # Arrange
        mock_deployment_registry.get_instance.return_value = None

        # Act
        response = await async_client.get("/api/v1/deployment/instances/999")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_get_instance_status_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_instance
    ):
        """Test get instance status."""
        # Arrange
        mock_deployment_registry.get_instance.return_value = sample_deployment_instance

        # Act
        response = await async_client.get("/api/v1/deployment/instances/1/status")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["instance_id"] == 1
        assert data["state"] == "active"
        assert data["health_status"] == "healthy"


class TestDeploymentOperations:
    """Test deployment operation endpoints."""

    @pytest.mark.asyncio
    async def test_provision_deployment_success(
        self,
        async_client: AsyncClient,
        mock_deployment_service,
        sample_deployment_instance,
        sample_deployment_execution,
    ):
        """Test provision new deployment."""
        # Arrange
        mock_deployment_service.provision_deployment.return_value = (
            sample_deployment_instance,
            sample_deployment_execution,
        )

        # Act
        response = await async_client.post(
            "/api/v1/deployment/provision",
            json={
                "template_id": 1,
                "environment": "staging",
                "region": "us-west-1",
                "config_overrides": {},
            },
        )

        # Assert
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["success"] is True
        assert data["instance_id"] == 1
        assert data["execution_id"] == 1

    @pytest.mark.asyncio
    async def test_provision_deployment_validation_error(
        self, async_client: AsyncClient, mock_deployment_service
    ):
        """Test provision with invalid data."""
        # Arrange
        mock_deployment_service.provision_deployment.side_effect = ValueError("Invalid template")

        # Act
        response = await async_client.post(
            "/api/v1/deployment/provision",
            json={"template_id": 999, "environment": "staging", "region": "us-west-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.asyncio
    async def test_upgrade_deployment_success(
        self,
        async_client: AsyncClient,
        mock_deployment_service,
        mock_deployment_registry,
        sample_deployment_instance,
        sample_deployment_execution,
    ):
        """Test upgrade deployment."""
        # Arrange
        mock_deployment_service.upgrade_deployment.return_value = sample_deployment_execution
        mock_deployment_registry.get_instance.return_value = sample_deployment_instance

        # Act
        response = await async_client.post(
            "/api/v1/deployment/instances/1/upgrade",
            json={"to_version": "2.0.0", "rollback_on_failure": True},
        )

        # Assert
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["success"] is True
        assert "2.0.0" in data["message"]

    @pytest.mark.asyncio
    async def test_scale_deployment_success(
        self,
        async_client: AsyncClient,
        mock_deployment_service,
        mock_deployment_registry,
        sample_deployment_instance,
        sample_deployment_execution,
    ):
        """Test scale deployment."""
        # Arrange
        mock_deployment_service.scale_deployment.return_value = sample_deployment_execution
        mock_deployment_registry.get_instance.return_value = sample_deployment_instance

        # Act
        response = await async_client.post(
            "/api/v1/deployment/instances/1/scale",
            json={"replicas": 5, "resources": {"cpu": "1000m", "memory": "1Gi"}},
        )

        # Assert
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_suspend_deployment_success(
        self,
        async_client: AsyncClient,
        mock_deployment_service,
        mock_deployment_registry,
        sample_deployment_instance,
        sample_deployment_execution,
    ):
        """Test suspend deployment."""
        # Arrange
        mock_deployment_service.suspend_deployment.return_value = sample_deployment_execution
        mock_deployment_registry.get_instance.return_value = sample_deployment_instance

        # Act
        response = await async_client.post(
            "/api/v1/deployment/instances/1/suspend", json={"reason": "Maintenance"}
        )

        # Assert
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_resume_deployment_success(
        self,
        async_client: AsyncClient,
        mock_deployment_service,
        mock_deployment_registry,
        sample_deployment_instance,
        sample_deployment_execution,
    ):
        """Test resume deployment."""
        # Arrange
        mock_deployment_service.resume_deployment.return_value = sample_deployment_execution
        mock_deployment_registry.get_instance.return_value = sample_deployment_instance

        # Act
        response = await async_client.post(
            "/api/v1/deployment/instances/1/resume", json={"reason": "Maintenance complete"}
        )

        # Assert
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_destroy_deployment_success(
        self,
        async_client: AsyncClient,
        mock_deployment_service,
        mock_deployment_registry,
        sample_deployment_instance,
        sample_deployment_execution,
    ):
        """Test destroy deployment."""
        # Arrange
        mock_deployment_service.destroy_deployment.return_value = sample_deployment_execution
        mock_deployment_registry.get_instance.return_value = sample_deployment_instance

        # Act
        response = await async_client.request(
            "DELETE",
            "/api/v1/deployment/instances/1",
            json={"reason": "No longer needed", "backup_data": True},
        )

        # Assert
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["success"] is True


class TestDeploymentExecutions:
    """Test deployment execution history endpoints."""

    @pytest.mark.asyncio
    async def test_list_executions_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_execution
    ):
        """Test list execution history."""
        # Arrange
        mock_deployment_registry.list_executions.return_value = ([sample_deployment_execution], 1)

        # Act
        response = await async_client.get("/api/v1/deployment/instances/1/executions")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == 1

    @pytest.mark.asyncio
    async def test_get_execution_success(
        self, async_client: AsyncClient, mock_deployment_registry, sample_deployment_execution
    ):
        """Test get execution details."""
        # Arrange
        mock_deployment_registry.get_execution.return_value = sample_deployment_execution

        # Act
        response = await async_client.get("/api/v1/deployment/executions/1")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == 1
        assert data["state"] == "completed"

    @pytest.mark.asyncio
    async def test_get_execution_not_found(
        self, async_client: AsyncClient, mock_deployment_registry
    ):
        """Test get non-existent execution."""
        # Arrange
        mock_deployment_registry.get_execution.return_value = None

        # Act
        response = await async_client.get("/api/v1/deployment/executions/999")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestDeploymentHealth:
    """Test deployment health monitoring endpoints."""

    @pytest.mark.asyncio
    async def test_list_health_records_success(
        self, async_client: AsyncClient, mock_deployment_registry
    ):
        """Test list health check history."""
        # Arrange
        from tests.deployment.conftest import MockObject

        health_record = MockObject(
            id=1,
            instance_id=1,
            check_type="http",
            endpoint="https://api.example.com/health",
            status="healthy",
            response_time_ms=None,
            status_code=None,
            response_body=None,
            error_message=None,
            checked_at=datetime.fromisoformat("2025-01-01T12:00:00"),
            created_at=datetime.fromisoformat("2025-01-01T12:00:00"),
            updated_at=datetime.fromisoformat("2025-01-01T12:00:00"),
        )
        mock_deployment_registry.list_health_records.return_value = ([health_record], 1)

        # Act
        response = await async_client.get("/api/v1/deployment/instances/1/health")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1

    @pytest.mark.asyncio
    async def test_trigger_health_check_success(
        self, async_client: AsyncClient, mock_deployment_service
    ):
        """Test trigger manual health check."""
        # Arrange
        from tests.deployment.conftest import MockObject

        health = MockObject(
            id=1,
            instance_id=1,
            check_type="http",
            endpoint="https://api.example.com/health",
            status="healthy",
            response_time_ms=None,
            status_code=None,
            response_body=None,
            error_message=None,
            checked_at=datetime.fromisoformat("2025-01-01T12:00:00"),
            created_at=datetime.fromisoformat("2025-01-01T12:00:00"),
            updated_at=datetime.fromisoformat("2025-01-01T12:00:00"),
        )
        mock_deployment_service.check_health.return_value = health

        # Act
        response = await async_client.post("/api/v1/deployment/instances/1/health-check")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"


class TestDeploymentStatistics:
    """Test deployment statistics endpoints."""

    @pytest.mark.asyncio
    async def test_get_deployment_stats_success(
        self, async_client: AsyncClient, mock_deployment_registry
    ):
        """Test get deployment statistics."""
        # Arrange
        stats = {
            "total_instances": 10,
            "states": {"active": 7, "provisioning": 2, "failed": 1, "suspended": 0},
            "health": {"healthy": 6, "degraded": 3, "unhealthy": 1},
        }
        mock_deployment_registry.get_deployment_stats.return_value = stats

        # Act
        response = await async_client.get("/api/v1/deployment/stats")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_instances"] == 10
        assert data["states"]["active"] == 7
        assert data["health"]["degraded"] == 3

    @pytest.mark.asyncio
    async def test_get_template_usage_stats_success(
        self, async_client: AsyncClient, mock_deployment_registry
    ):
        """Test get template usage statistics."""
        # Arrange
        stats = {
            "templates": [{"template_name": "default", "display_name": "Default", "instances": 5}],
            "total_templates": 1,
            "total_instances": 5,
        }
        mock_deployment_registry.get_template_usage_stats.return_value = stats

        # Act
        response = await async_client.get("/api/v1/deployment/stats/templates")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_templates"] == 1
        assert data["templates"][0]["instances"] == 5

    @pytest.mark.asyncio
    async def test_get_resource_allocation_success(
        self, async_client: AsyncClient, mock_deployment_registry
    ):
        """Test get resource allocation statistics."""
        # Arrange
        stats = {"total_cpu": 48, "total_memory": 192, "total_storage": 512}
        mock_deployment_registry.get_resource_allocation.return_value = stats

        # Act
        response = await async_client.get("/api/v1/deployment/stats/resources")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_cpu"] == 48


class TestScheduledDeployments:
    """Test scheduled deployment endpoints."""

    @pytest.mark.asyncio
    async def test_schedule_deployment_success(
        self, async_client: AsyncClient, mock_deployment_service
    ):
        """Test schedule a deployment operation."""
        # Arrange
        scheduled = {
            "schedule_id": "schedule-1",  # Must be string per ScheduledDeploymentResponse schema
            "operation": "upgrade",
            "schedule_type": "one_time",
            "scheduled_at": "2099-12-01T02:00:00",
            "cron_expression": None,
            "interval_seconds": None,
            "next_run_at": None,
            "parameters": {"to_version": "2.0.0"},
        }
        mock_deployment_service.schedule_deployment.return_value = scheduled

        # Act
        response = await async_client.post(
            "/api/v1/deployment/schedule",
            json={
                "operation": "upgrade",
                "instance_id": 1,
                "scheduled_at": "2099-12-01T02:00:00",  # Far future, naive datetime
                "upgrade_request": {"to_version": "2.0.0", "rollback_on_failure": True},
            },
        )

        # Assert
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Error response: {response.json()}")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["operation"] == "upgrade"
        assert data["schedule_type"] == "one_time"
        assert data["schedule_id"] == "schedule-1"
        assert "parameters" in data
