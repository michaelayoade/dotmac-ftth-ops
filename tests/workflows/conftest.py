"""
Pytest fixtures for workflow router tests.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.auth.platform_admin import create_platform_admin_token


@pytest.fixture
def mock_workflow_service():
    """Mock WorkflowService for testing."""
    service = MagicMock()

    # Make all methods async
    service.create_workflow = AsyncMock()
    service.get_workflow = AsyncMock()
    service.list_workflows = AsyncMock()
    service.update_workflow = AsyncMock()
    service.delete_workflow = AsyncMock()
    service.execute_workflow = AsyncMock()
    service.execute_workflow_by_id = AsyncMock()
    service.get_execution = AsyncMock()
    service.list_executions = AsyncMock()
    service.cancel_execution = AsyncMock()
    service.get_execution_stats = AsyncMock()

    return service


@pytest.fixture
def sample_workflow():
    """Sample workflow template for testing."""
    return {
        "id": 1,
        "name": "test_workflow",
        "description": "Test workflow for unit tests",
        "definition": {
            "steps": [
                {
                    "name": "step1",
                    "type": "service_call",
                    "service": "test_service",
                    "method": "test_method",
                    "params": {"param1": "value1"},
                    "max_retries": 3,
                },
                {
                    "name": "step2",
                    "type": "transform",
                    "transform_type": "map",
                    "mapping": {"input": "output"},
                },
            ]
        },
        "is_active": True,
        "version": "1.0.0",
        "tags": {"category": "test", "priority": "low"},
        "created_at": "2025-01-01T12:00:00",
        "updated_at": "2025-01-01T12:00:00",
    }


@pytest.fixture
def sample_workflow_execution():
    """Sample workflow execution for testing."""
    return {
        "id": 1,
        "workflow_id": 1,
        "status": "completed",
        "context": {"input_data": "test"},
        "result": {"output_data": "success"},
        "error_message": None,
        "started_at": "2025-01-01T12:05:00",
        "completed_at": "2025-01-01T12:10:00",
        "trigger_type": "manual",
        "trigger_source": "api",
        "tenant_id": "00000000-0000-0000-0000-0000000000aa",
        "created_at": "2025-01-01T12:05:00",
        "updated_at": "2025-01-01T12:10:00",
        "steps": [],
    }


@pytest.fixture
def sample_workflow_definition():
    """Sample workflow definition for creation."""
    return {
        "steps": [
            {
                "name": "allocate_ip",
                "type": "service_call",
                "service": "netbox_service",
                "method": "allocate_dual_stack",
                "params": {
                    "ipv4_prefix_id": 1,
                    "ipv6_prefix_id": 2,
                    "description": "Test allocation",
                },
                "max_retries": 3,
            },
            {
                "name": "create_radius_account",
                "type": "service_call",
                "service": "radius_service",
                "method": "create_subscriber",
                "params": {
                    "subscriber_id": "${context.subscriber_id}",
                    "username": "${context.username}",
                    "framed_ipv4_address": "${step_allocate_ip_result.ipv4}",
                    "framed_ipv6_address": "${step_allocate_ip_result.ipv6}",
                },
                "max_retries": 2,
            },
        ]
    }


@pytest.fixture
def mock_current_user():
    """Mock current user for authentication."""
    from dotmac.platform.auth.core import UserInfo

    return UserInfo(
        user_id="00000000-0000-0000-0000-000000000001",
        email="test@example.com",
        tenant_id="00000000-0000-0000-0000-000000000001",
        roles=["admin"],
        permissions=["workflows:create", "workflows:read", "workflows:update", "workflows:delete"],
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
def workflow_client(mock_workflow_service, mock_current_user, mock_rbac_service, monkeypatch):
    """HTTP client with workflow router registered and dependencies mocked."""
    import dotmac.platform.auth.rbac_dependencies
    from dotmac.platform.auth.core import get_current_user
    from dotmac.platform.db import get_async_session
    from dotmac.platform.workflows.router import (
        get_workflow_service,
    )
    from dotmac.platform.workflows.router import (
        router as workflow_router,
    )

    # Monkeypatch RBACService class to return our mock instance
    monkeypatch.setattr(
        dotmac.platform.auth.rbac_dependencies, "RBACService", lambda db: mock_rbac_service
    )

    app = FastAPI()

    # Override dependencies
    def override_get_workflow_service():
        return mock_workflow_service

    def override_get_current_user():
        return mock_current_user

    async def override_get_async_session():
        yield MagicMock()

    app.dependency_overrides[get_workflow_service] = override_get_workflow_service
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_async_session] = override_get_async_session

    app.include_router(workflow_router, prefix="/api/v1")

    with TestClient(app) as client:
        client.headers["Authorization"] = "Bearer " + create_platform_admin_token(
            user_id="workflow-admin",
            email="workflow-admin@example.com",
            permissions=[
                "workflows:create",
                "workflows:read",
                "workflows:update",
                "workflows:delete",
            ],
        )
        client.headers.setdefault("X-Tenant-ID", mock_current_user.tenant_id or "test-tenant")
        yield client
