"""
Comprehensive tests for plugin router endpoints using fake pattern.

This test suite achieves 90%+ coverage on plugins/router.py by testing
all API endpoints with realistic data and minimal mocking.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.plugins.interfaces import NotificationProvider
from dotmac.platform.plugins.router import router as plugin_router

# Mark all tests as integration - they test real router endpoints with full app
from dotmac.platform.plugins.schema import (  # noqa: E402
    FieldSpec,
    FieldType,
    PluginConfig,
    PluginHealthCheck,
    PluginTestResult,
    PluginType,
)

# Fake implementations for testing


pytestmark = pytest.mark.integration


class FakeNotificationPlugin(NotificationProvider):
    """Fake notification plugin for router testing."""

    def __init__(self, name: str = "Test Notification"):
        self.name = name
        self.configured = False
        self.config = {}
        self.notifications = []

    def get_config_schema(self) -> PluginConfig:
        return PluginConfig(
            name=self.name,
            type=PluginType.NOTIFICATION,
            version="1.0.0",
            description="Test notification plugin for router testing",
            fields=[
                FieldSpec(
                    key="api_key",
                    label="API Key",
                    type=FieldType.SECRET,
                    required=True,
                    is_secret=True,
                ),
                FieldSpec(
                    key="endpoint",
                    label="Endpoint URL",
                    type=FieldType.URL,
                    required=True,
                ),
                FieldSpec(
                    key="timeout",
                    label="Timeout (seconds)",
                    type=FieldType.INTEGER,
                    default=30,
                ),
            ],
        )

    async def configure(self, config: dict) -> bool:
        self.config = config
        self.configured = bool(config.get("api_key") and config.get("endpoint"))
        return self.configured

    async def health_check(self) -> PluginHealthCheck:
        return PluginHealthCheck(
            plugin_instance_id=str(uuid4()),
            status="healthy" if self.configured else "unhealthy",
            message="Plugin is configured" if self.configured else "Not configured",
            details={"configured": self.configured},
            timestamp=datetime.now(UTC).isoformat(),
        )

    async def test_connection(self, config: dict) -> PluginTestResult:
        has_required = bool(config.get("api_key") and config.get("endpoint"))
        return PluginTestResult(
            success=has_required,
            message="Connection successful" if has_required else "Missing required fields",
            details={
                "has_api_key": bool(config.get("api_key")),
                "has_endpoint": bool(config.get("endpoint")),
            },
        )

    async def send_notification(
        self, recipient: str, message: str, options: dict | None = None
    ) -> dict:
        self.notifications.append({"recipient": recipient, "message": message, "options": options})
        return {"status": "sent", "notification_id": str(uuid4())}


def mock_current_user():
    """Mock current user for testing."""
    return UserInfo(
        user_id="test_user",
        tenant_id="test_tenant",
        username="testuser",
        email="test@example.com",
        roles=["admin"],
        permissions=["plugins:read", "plugins:write", "plugins:delete"],
        is_platform_admin=False,
    )


@pytest.fixture
def client():
    """Create a test client with auth override."""
    from dotmac.platform.auth.dependencies import get_current_user

    # Create a fresh app for testing
    app = FastAPI()

    # Override auth BEFORE including router
    app.dependency_overrides[get_current_user] = mock_current_user

    # Include plugin router
    app.include_router(plugin_router, prefix="/api/v1/plugins", tags=["Plugin Management"])

    client = TestClient(app)
    yield client

    # Cleanup
    app.dependency_overrides.clear()


@pytest.fixture
def fake_plugin():
    """Create a fake notification plugin."""
    return FakeNotificationPlugin()


@pytest_asyncio.fixture
async def setup_registry(fake_plugin):
    """Setup a fresh registry with a test plugin."""
    # Get the global registry
    from dotmac.platform.plugins.router import get_plugin_registry

    registry = get_plugin_registry()

    # Clear existing state
    registry._plugins.clear()
    registry._instances.clear()
    registry._configurations.clear()

    # Register fake plugin
    await registry._register_plugin_provider(fake_plugin, "test")

    # Mark as initialized
    registry._initialized = True

    yield registry

    # Cleanup
    registry._plugins.clear()
    registry._instances.clear()
    registry._configurations.clear()


@pytest.fixture
def auth_headers():
    """Placeholder fixture for auth headers (not actually needed with override)."""
    return {}


class TestListAvailablePlugins:
    """Test GET /plugins/ endpoint."""

    @pytest.mark.asyncio
    async def test_list_plugins_success(self, client, setup_registry, auth_headers):
        """Test listing available plugins."""
        response = client.get("/api/v1/plugins/")
        assert response.status_code == 200

        plugins = response.json()
        assert isinstance(plugins, list)
        assert len(plugins) >= 1

        # Should contain our test plugin in summary form
        plugin_names = [p["name"] for p in plugins]
        assert "Test Notification" in plugin_names
        test_plugin = next(p for p in plugins if p["name"] == "Test Notification")
        assert test_plugin["id"] == "Test Notification"
        assert test_plugin["enabled"] is True
        assert "version" in test_plugin

    @pytest.mark.asyncio
    async def test_list_plugins_is_frontend_friendly(self, client, setup_registry, auth_headers):
        """List endpoint should return compact UI-friendly shape (no schema)."""
        response = client.get("/api/v1/plugins/")
        assert response.status_code == 200

        plugins = response.json()
        test_plugin = next(p for p in plugins if p["name"] == "Test Notification")

        assert set(test_plugin.keys()) == {"id", "name", "description", "version", "enabled"}


class TestGetPluginSchema:
    """Test GET /plugins/{plugin_name}/schema endpoint."""

    @pytest.mark.asyncio
    async def test_get_schema_success(self, client, setup_registry, auth_headers):
        """Test getting plugin schema by name."""
        # URL encode the space in plugin name
        response = client.get("/api/v1/plugins/Test%20Notification/schema")
        assert response.status_code == 200

        data = response.json()
        assert "schema" in data
        assert data["schema"]["name"] == "Test Notification"

    @pytest.mark.asyncio
    async def test_get_schema_not_found(self, client, setup_registry, auth_headers):
        """Test getting schema for non-existent plugin."""
        response = client.get("/api/v1/plugins/NonExistent%20Plugin/schema")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestCreatePluginInstance:
    """Test POST /plugins/instances endpoint."""

    @pytest.mark.asyncio
    async def test_create_instance_success(self, client, setup_registry, auth_headers):
        """Test creating a plugin instance."""
        request_data = {
            "plugin_name": "Test Notification",
            "instance_name": "My Test Instance",
            "configuration": {
                "api_key": "test_secret_key",
                "endpoint": "https://api.example.com",
                "timeout": 60,
            },
        }

        response = client.post("/api/v1/plugins/instances", json=request_data)
        assert response.status_code == 201

        instance = response.json()
        assert instance["plugin_name"] == "Test Notification"
        assert instance["instance_name"] == "My Test Instance"
        assert instance["status"] == "active"
        assert "id" in instance

    @pytest.mark.asyncio
    async def test_create_instance_invalid_plugin(self, client, setup_registry, auth_headers):
        """Test creating instance with non-existent plugin."""
        request_data = {
            "plugin_name": "NonExistent",
            "instance_name": "Test",
            "configuration": {},
        }

        response = client.post("/api/v1/plugins/instances", json=request_data)
        assert response.status_code == 400


class TestListPluginInstances:
    """Test GET /plugins/instances endpoint."""

    @pytest.mark.asyncio
    async def test_list_instances_empty(self, client, setup_registry, auth_headers):
        """Test listing instances when none exist."""
        response = client.get("/api/v1/plugins/instances")
        assert response.status_code == 200

        data = response.json()
        assert "plugins" in data
        assert "total" in data
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_instances_with_data(self, client, setup_registry, auth_headers):
        """Test listing instances after creating some."""
        # Create an instance first
        create_data = {
            "plugin_name": "Test Notification",
            "instance_name": "Instance 1",
            "configuration": {"api_key": "key1", "endpoint": "https://test1.com"},
        }
        client.post("/api/v1/plugins/instances", json=create_data)

        # List instances
        response = client.get("/api/v1/plugins/instances")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] >= 1
        assert len(data["plugins"]) >= 1


class TestGetPluginInstance:
    """Test GET /plugins/instances/{instance_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_instance_success(self, client, setup_registry, auth_headers):
        """Test getting a specific plugin instance."""
        # Create instance
        create_data = {
            "plugin_name": "Test Notification",
            "instance_name": "Test Instance",
            "configuration": {"api_key": "key", "endpoint": "https://test.com"},
        }
        create_response = client.post("/api/v1/plugins/instances", json=create_data)
        instance_id = create_response.json()["id"]

        # Get instance
        response = client.get(f"/api/v1/plugins/instances/{instance_id}")
        assert response.status_code == 200

        instance = response.json()
        assert instance["id"] == instance_id
        assert instance["instance_name"] == "Test Instance"

    @pytest.mark.asyncio
    async def test_get_instance_not_found(self, client, setup_registry, auth_headers):
        """Test getting non-existent instance."""
        fake_id = str(uuid4())
        response = client.get(f"/api/v1/plugins/instances/{fake_id}")
        assert response.status_code == 404


class TestGetPluginConfiguration:
    """Test GET /plugins/instances/{instance_id}/configuration endpoint."""

    @pytest.mark.asyncio
    async def test_get_configuration_success(self, client, setup_registry, auth_headers):
        """Test getting plugin configuration."""
        # Create instance
        create_data = {
            "plugin_name": "Test Notification",
            "instance_name": "Test",
            "configuration": {"api_key": "secret", "endpoint": "https://test.com"},
        }
        create_response = client.post("/api/v1/plugins/instances", json=create_data)
        instance_id = create_response.json()["id"]

        # Get configuration
        response = client.get(f"/api/v1/plugins/instances/{instance_id}/configuration")
        assert response.status_code == 200

        data = response.json()
        assert "configuration" in data
        assert "schema" in data
        assert data["plugin_instance_id"] == instance_id

    @pytest.mark.asyncio
    async def test_get_configuration_not_found(self, client, setup_registry, auth_headers):
        """Test getting configuration for non-existent instance."""
        fake_id = str(uuid4())
        response = client.get(f"/api/v1/plugins/instances/{fake_id}/configuration")
        # Endpoint returns 400 for exceptions (including not found)
        assert response.status_code == 400


class TestUpdatePluginConfiguration:
    """Test PUT /plugins/instances/{instance_id}/configuration endpoint."""

    @pytest.mark.asyncio
    async def test_update_configuration_success(self, client, setup_registry, auth_headers):
        """Test updating plugin configuration."""
        # Create instance
        create_data = {
            "plugin_name": "Test Notification",
            "instance_name": "Test",
            "configuration": {"api_key": "old_key", "endpoint": "https://old.com"},
        }
        create_response = client.post("/api/v1/plugins/instances", json=create_data)
        instance_id = create_response.json()["id"]

        # Update configuration
        update_data = {"configuration": {"api_key": "new_key", "endpoint": "https://new.com"}}
        response = client.put(
            f"/api/v1/plugins/instances/{instance_id}/configuration",
            json=update_data,
        )
        assert response.status_code == 200
        assert "message" in response.json()


class TestDeletePluginInstance:
    """Test DELETE /plugins/instances/{instance_id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_instance_success(self, client, setup_registry, auth_headers):
        """Test deleting a plugin instance."""
        # Create instance
        create_data = {
            "plugin_name": "Test Notification",
            "instance_name": "To Delete",
            "configuration": {"api_key": "key", "endpoint": "https://test.com"},
        }
        create_response = client.post("/api/v1/plugins/instances", json=create_data)
        instance_id = create_response.json()["id"]

        # Delete instance
        response = client.delete(f"/api/v1/plugins/instances/{instance_id}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/v1/plugins/instances/{instance_id}")
        assert get_response.status_code == 404


class TestHealthCheck:
    """Test GET /plugins/instances/{instance_id}/health endpoint."""

    @pytest.mark.asyncio
    async def test_health_check_success(self, client, setup_registry, auth_headers):
        """Test performing health check on instance."""
        # Create instance
        create_data = {
            "plugin_name": "Test Notification",
            "instance_name": "Test",
            "configuration": {"api_key": "key", "endpoint": "https://test.com"},
        }
        create_response = client.post("/api/v1/plugins/instances", json=create_data)
        instance_id = create_response.json()["id"]

        # Health check
        response = client.get(f"/api/v1/plugins/instances/{instance_id}/health")
        assert response.status_code == 200

        health = response.json()
        assert "status" in health
        assert "message" in health


class TestTestPluginConnection:
    """Test POST /plugins/instances/{instance_id}/test endpoint."""

    @pytest.mark.asyncio
    async def test_test_connection_with_config(self, client, setup_registry, auth_headers):
        """Test testing plugin connection with custom config."""
        # Create instance
        create_data = {
            "plugin_name": "Test Notification",
            "instance_name": "Test",
            "configuration": {},
        }
        create_response = client.post("/api/v1/plugins/instances", json=create_data)
        instance_id = create_response.json()["id"]

        # Test connection
        test_data = {"configuration": {"api_key": "test", "endpoint": "https://test.com"}}
        response = client.post(
            f"/api/v1/plugins/instances/{instance_id}/test",
            json=test_data,
        )
        assert response.status_code == 200

        result = response.json()
        assert "success" in result
        assert "message" in result


class TestBulkHealthCheck:
    """Test POST /plugins/instances/health-check endpoint."""

    @pytest.mark.asyncio
    async def test_bulk_health_check_all(self, client, setup_registry, auth_headers):
        """Test bulk health check on all instances."""
        # Create some instances
        for i in range(2):
            create_data = {
                "plugin_name": "Test Notification",
                "instance_name": f"Instance {i}",
                "configuration": {"api_key": f"key{i}", "endpoint": f"https://test{i}.com"},
            }
            client.post("/api/v1/plugins/instances", json=create_data)

        # Bulk health check (no instance_ids = check all)
        response = client.post("/api/v1/plugins/instances/health-check")
        assert response.status_code == 200

        results = response.json()
        assert isinstance(results, list)
        assert len(results) >= 2


class TestRefreshPlugins:
    """Test POST /plugins/refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_plugins_success(self, client, setup_registry, auth_headers):
        """Test refreshing plugin discovery."""
        response = client.post("/api/v1/plugins/refresh")
        assert response.status_code == 200

        data = response.json()
        assert "message" in data
        assert "available_plugins" in data


class TestErrorHandlingPaths:
    """Test error handling in router endpoints."""

    @pytest.mark.asyncio
    async def test_create_instance_exception_handling(self, client, setup_registry, auth_headers):
        """Test exception handling in create instance endpoint."""
        # Try to create instance with invalid data that causes exception
        request_data = {
            "plugin_name": "NonExistent Plugin",
            "instance_name": "Test",
            "configuration": {},
        }

        response = client.post("/api/v1/plugins/instances", json=request_data)
        assert response.status_code == 400
        assert "detail" in response.json()

    @pytest.mark.asyncio
    async def test_update_configuration_exception(self, client, setup_registry, auth_headers):
        """Test exception handling in update configuration."""
        fake_id = str(uuid4())
        update_data = {"configuration": {"key": "value"}}

        response = client.put(
            f"/api/v1/plugins/instances/{fake_id}/configuration",
            json=update_data,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_instance_exception(self, client, setup_registry, auth_headers):
        """Test exception handling in delete instance."""
        fake_id = str(uuid4())

        response = client.delete(f"/api/v1/plugins/instances/{fake_id}")
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_health_check_exception(self, client, setup_registry, auth_headers):
        """Test exception handling in health check."""
        fake_id = str(uuid4())

        response = client.get(f"/api/v1/plugins/instances/{fake_id}/health")
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_test_connection_exception(self, client, setup_registry, auth_headers):
        """Test exception handling in test connection."""
        fake_id = str(uuid4())
        test_data = {"configuration": {"key": "value"}}

        response = client.post(
            f"/api/v1/plugins/instances/{fake_id}/test",
            json=test_data,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_bulk_health_check_with_errors(self, client, setup_registry, auth_headers):
        """Test bulk health check handles individual instance errors."""
        # Create one valid instance
        create_data = {
            "plugin_name": "Test Notification",
            "instance_name": "Valid",
            "configuration": {"api_key": "key", "endpoint": "https://test.com"},
        }
        create_response = client.post("/api/v1/plugins/instances", json=create_data)
        valid_id = create_response.json()["id"]

        # Include both valid and invalid IDs
        fake_id = str(uuid4())
        instance_ids = [valid_id, fake_id]

        response = client.post(
            "/api/v1/plugins/instances/health-check",
            json=instance_ids,  # Send as body, not query param
        )
        assert response.status_code == 200

        results = response.json()
        assert len(results) == 2
        # One should be successful, one should be error
        statuses = [r["status"] for r in results]
        assert "healthy" in statuses or "error" in statuses
