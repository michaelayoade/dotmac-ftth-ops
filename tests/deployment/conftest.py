"""
Pytest fixtures for deployment router tests.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient


class MockObject:
    """Helper class to convert dict to object with attributes."""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


@pytest.fixture
def mock_deployment_service():
    """Mock DeploymentService for testing."""
    service = MagicMock()

    # Make all methods async
    service.provision_deployment = AsyncMock()
    service.upgrade_deployment = AsyncMock()
    service.scale_deployment = AsyncMock()
    service.suspend_deployment = AsyncMock()
    service.resume_deployment = AsyncMock()
    service.destroy_deployment = AsyncMock()
    service.check_health = AsyncMock()
    service.schedule_deployment = AsyncMock()

    return service


@pytest.fixture
def mock_deployment_registry():
    """Mock DeploymentRegistry for testing."""
    registry = MagicMock()

    # Make all methods return appropriate values
    registry.list_templates = MagicMock()
    registry.create_template = MagicMock()
    registry.get_template = MagicMock()
    registry.get_template_by_name = MagicMock()
    registry.update_template = MagicMock()
    registry.list_instances = MagicMock()
    registry.get_instance = MagicMock()
    registry.list_executions = MagicMock()
    registry.get_execution = MagicMock()
    registry.list_health_records = MagicMock()
    registry.get_deployment_stats = MagicMock()
    registry.get_template_usage_stats = MagicMock()
    registry.get_resource_allocation = MagicMock()

    return registry


@pytest.fixture
def mock_current_user():
    """Mock current user for authentication."""
    from dotmac.platform.auth.core import UserInfo

    return UserInfo(
        user_id="00000000-0000-0000-0000-000000000001",
        email="test@example.com",
        tenant_id="1",
        roles=["admin"],
        permissions=[
            "deployment.template.read",
            "deployment.template.create",
            "deployment.template.update",
            "deployment.instance.read",
            "deployment.instance.create",
            "deployment.instance.upgrade",
            "deployment.instance.scale",
            "deployment.instance.suspend",
            "deployment.instance.resume",
            "deployment.instance.destroy",
            "deployment.instance.health_check",
            "deployment.stats.read",
            "deployment.schedule.create",
        ],
        is_platform_admin=False,
    )


@pytest.fixture
def mock_rbac_service():
    """Mock RBAC service that always allows access."""
    from dotmac.platform.auth.rbac_service import RBACService

    mock_rbac = MagicMock(spec=RBACService)
    mock_rbac.user_has_all_permissions = AsyncMock(return_value=True)
    mock_rbac.user_has_any_permission = AsyncMock(return_value=True)
    mock_rbac.get_user_permissions = AsyncMock(return_value=set())
    mock_rbac.get_user_roles = AsyncMock(return_value=[])
    return mock_rbac


@pytest.fixture
def sample_deployment_template():
    """Sample deployment template for testing."""
    # Return MockObject with attributes that router can access
    return MockObject(
        id=1,
        name="test_template",
        display_name="Test Template",
        description="Test deployment template",
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
        updated_at=datetime.fromisoformat("2025-01-01T12:00:00"),
    )


@pytest.fixture
def sample_deployment_instance():
    """Sample deployment instance for testing."""
    # Return MockObject with attributes that router can access
    return MockObject(
        id=1,
        tenant_id=1,
        template_id=1,
        environment="staging",
        region="us-west-1",
        availability_zone=None,
        config={},
        state="active",
        state_reason=None,
        last_state_change=datetime.fromisoformat("2025-01-01T12:00:00"),
        secrets_path=None,
        version="1.0.0",
        endpoints={"api": "https://api.example.com"},
        namespace=None,
        cluster_name=None,
        backend_job_id=None,
        allocated_cpu=None,
        allocated_memory_gb=None,
        allocated_storage_gb=None,
        health_check_url=None,
        last_health_check=datetime.fromisoformat("2025-01-01T12:00:00"),
        health_status="healthy",
        health_details=None,
        tags=None,
        notes=None,
        deployed_by=None,
        approved_by=None,
        created_at=datetime.fromisoformat("2025-01-01T12:00:00"),
        updated_at=datetime.fromisoformat("2025-01-01T12:00:00"),
    )


@pytest.fixture
def sample_deployment_execution():
    """Sample deployment execution for testing."""
    # Return MockObject with attributes that router can access
    return MockObject(
        id=1,
        instance_id=1,
        operation="provision",
        state="completed",
        started_at=datetime.fromisoformat("2025-01-01T12:00:00"),
        completed_at=datetime.fromisoformat("2025-01-01T12:05:00"),
        duration_seconds=300,
        backend_job_id=None,
        backend_job_url=None,
        backend_logs=None,
        operation_config=None,
        triggered_by=1,  # User ID as integer
        error_message=None,
        created_at=datetime.fromisoformat("2025-01-01T12:00:00"),
        updated_at=datetime.fromisoformat("2025-01-01T12:05:00"),
    )


@pytest_asyncio.fixture
async def async_client(
    mock_deployment_service,
    mock_deployment_registry,
    mock_current_user,
    mock_rbac_service,
    monkeypatch,
):
    """Async HTTP client with deployment router registered and dependencies mocked."""
    import dotmac.platform.auth.rbac_dependencies
    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.dependencies import get_db
    from dotmac.platform.deployment.router import (
        get_deployment_service,
    )
    from dotmac.platform.deployment.router import (
        router as deployment_router,
    )

    # Monkeypatch RBACService class to return our mock instance
    monkeypatch.setattr(
        dotmac.platform.auth.rbac_dependencies, "RBACService", lambda db: mock_rbac_service
    )

    # Monkeypatch DeploymentRegistry to return our mock instance
    monkeypatch.setattr(
        "dotmac.platform.deployment.router.DeploymentRegistry", lambda db: mock_deployment_registry
    )
    # Avoid instantiating real SQLAlchemy models inside the router. Use lightweight objects.
    monkeypatch.setattr(
        "dotmac.platform.deployment.router.DeploymentTemplate",
        lambda **kwargs: MockObject(**kwargs),
    )

    app = FastAPI()

    # Override dependencies
    def override_get_deployment_service():
        return mock_deployment_service

    def override_get_current_user():
        return mock_current_user

    def override_get_db():
        return MagicMock()

    app.dependency_overrides[get_deployment_service] = override_get_deployment_service
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db

    app.include_router(deployment_router, prefix="/api/v1/deployment")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
