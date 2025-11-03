"""
Tests for plugin router functions.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.plugins.router import get_registry
from dotmac.platform.plugins.schema import (
    FieldSpec,
    FieldType,
    PluginConfig,
    PluginInstance,
    PluginStatus,
    PluginType,
)

pytestmark = pytest.mark.integration


class TestPluginRouterFunctions:
    """Test plugin router functions."""

    @pytest.mark.asyncio
    async def test_get_registry_initialization(self):
        """Test registry initialization in get_registry dependency."""
        with patch("dotmac.platform.plugins.router.get_plugin_registry") as mock_get:
            mock_registry = MagicMock()
            mock_registry.initialize = AsyncMock()
            # Ensure _plugins attribute doesn't exist initially
            if hasattr(mock_registry, "_plugins"):
                delattr(mock_registry, "_plugins")
            mock_get.return_value = mock_registry

            # First call - should initialize
            result = await get_registry()
            assert result == mock_registry
            mock_registry.initialize.assert_called_once()

            # Reset for second call - now set _plugins to simulate initialized state
            mock_registry.initialize.reset_mock()
            mock_registry._plugins = {}

            # Second call - should not initialize again
            result2 = await get_registry()
            assert result2 == mock_registry
            mock_registry.initialize.assert_not_called()

    @pytest.mark.asyncio
    async def test_registry_already_initialized(self):
        """Test get_registry when registry is already initialized."""
        with patch("dotmac.platform.plugins.router.get_plugin_registry") as mock_get:
            mock_registry = AsyncMock()
            mock_registry._plugins = {}  # Already initialized
            mock_registry.initialize = AsyncMock()
            mock_get.return_value = mock_registry

            result = await get_registry()
            assert result == mock_registry
            mock_registry.initialize.assert_not_called()  # Should not initialize again


class TestRouterImports:
    """Test that all required imports exist and are accessible."""

    def test_router_imports(self):
        """Test that router module imports correctly."""
        from dotmac.platform.plugins.router import get_registry, router

        assert router is not None
        assert get_registry is not None

    def test_router_configuration(self):
        """Test router configuration."""
        from dotmac.platform.plugins.router import router

        # Router object has no prefix - it's added during registration in routers.py
        assert router.prefix == ""
        assert "Plugin Management" in router.tags

    def test_request_models_exist(self):
        """Test that request models are defined."""
        from dotmac.platform.plugins.router import (
            CreatePluginInstanceRequest,
            TestConnectionRequest,
            UpdatePluginConfigurationRequest,
        )

        assert CreatePluginInstanceRequest is not None
        assert TestConnectionRequest is not None
        assert UpdatePluginConfigurationRequest is not None

    def test_create_request_model(self):
        """Test creating request model."""
        from dotmac.platform.plugins.router import CreatePluginInstanceRequest

        request = CreatePluginInstanceRequest(
            plugin_name="Test Plugin",
            instance_name="Test Instance",
            configuration={"api_key": "test"},
        )
        assert request.plugin_name == "Test Plugin"
        assert request.instance_name == "Test Instance"
        assert request.configuration == {"api_key": "test"}

    def test_test_connection_request_model(self):
        """Test test connection request model."""
        from dotmac.platform.plugins.router import TestConnectionRequest

        request = TestConnectionRequest(configuration={"api_key": "test"})
        assert request.configuration == {"api_key": "test"}

    def test_update_configuration_request_model(self):
        """Test update configuration request model."""
        from dotmac.platform.plugins.router import UpdatePluginConfigurationRequest

        request = UpdatePluginConfigurationRequest(configuration={"new_key": "value"})
        assert request.configuration == {"new_key": "value"}


class TestRouterEndpoints:
    """Test router endpoint existence and basic structure."""

    def test_router_has_endpoints(self):
        """Test that router has expected endpoints."""
        from dotmac.platform.plugins.router import router

        # Check that routes exist
        route_paths = [route.path for route in router.routes]

        # Expected paths (based on actual router)
        expected_paths = [
            "/",  # list plugins
            "/instances",  # list/create instances
            "/{plugin_name}/schema",  # get schema
            "/instances/{instance_id}/configuration",  # get/update config
            "/instances/{instance_id}/health",  # health check
            "/instances/{instance_id}/test",  # test connection
            "/refresh",  # refresh plugins
        ]

        for expected in expected_paths:
            assert any(expected in path for path in route_paths), f"Missing route: {expected}"

    def test_router_methods(self):
        """Test that router has expected HTTP methods."""
        from dotmac.platform.plugins.router import router

        # Collect all methods
        methods = set()
        for route in router.routes:
            methods.update(route.methods)

        # Should have basic CRUD methods
        assert "GET" in methods
        assert "POST" in methods
        assert "PUT" in methods
        assert "DELETE" in methods

    def test_router_dependencies(self):
        """Test that router has auth dependencies."""
        from dotmac.platform.plugins.router import router

        # Router should have dependencies (auth)
        assert len(router.dependencies) > 0


class TestPluginSchemaResponse:
    """Test plugin response models."""

    def test_plugin_config_serialization(self):
        """Test that PluginConfig can be serialized."""
        config = PluginConfig(
            name="Test Plugin",
            type=PluginType.NOTIFICATION,
            version="1.0.0",
            description="Test",
            fields=[
                FieldSpec(
                    key="test_field", label="Test Field", type=FieldType.STRING, required=True
                )
            ],
        )

        # Should be able to convert to dict
        config_dict = config.model_dump()
        assert config_dict["name"] == "Test Plugin"
        assert config_dict["type"] == "notification"
        assert len(config_dict["fields"]) == 1

    def test_plugin_instance_serialization(self):
        """Test that PluginInstance can be serialized."""
        instance = PluginInstance(
            id=uuid4(),
            plugin_name="Test Plugin",
            instance_name="Test Instance",
            config_schema=PluginConfig(
                name="Test Plugin",
                type=PluginType.NOTIFICATION,
                version="1.0.0",
                description="Test",
                fields=[],
            ),
            status=PluginStatus.ACTIVE,
            has_configuration=True,
        )

        # Should be able to convert to dict
        instance_dict = instance.model_dump()
        assert instance_dict["plugin_name"] == "Test Plugin"
        assert instance_dict["status"] == "active"


class TestErrorHandling:
    """Test error handling in router functions."""

    @pytest.mark.asyncio
    async def test_registry_error_in_get_registry(self):
        """Test error handling in get_registry."""
        with patch("dotmac.platform.plugins.router.get_plugin_registry") as mock_get:
            mock_registry = MagicMock()
            mock_registry.initialize = AsyncMock(side_effect=Exception("Init failed"))
            # Ensure _plugins doesn't exist
            if hasattr(mock_registry, "_plugins"):
                delattr(mock_registry, "_plugins")
            mock_get.return_value = mock_registry

            # Should raise the exception from initialize
            with pytest.raises(Exception, match="Init failed"):
                await get_registry()
            mock_registry.initialize.assert_called_once()
