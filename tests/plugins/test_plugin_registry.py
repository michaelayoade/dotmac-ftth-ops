"""
Tests for plugin registry and management.
"""

import uuid
from uuid import uuid4

import pytest

from dotmac.platform.plugins.interfaces import NotificationProvider, PluginProvider
from dotmac.platform.plugins.registry import (
    PluginRegistry,
    PluginRegistryError,
    get_plugin_registry,
)
from dotmac.platform.plugins.schema import (
    FieldSpec,
    FieldType,
    PluginConfig,
    PluginHealthCheck,
    PluginStatus,
    PluginTestResult,
    PluginType,
)


class MockPlugin(NotificationProvider):
    """Mock plugin for testing."""

    def __init__(self):
        self.configured = False
        self.config = {}

    def get_config_schema(self) -> PluginConfig:
        return PluginConfig(
            name="Mock Plugin",
            type=PluginType.NOTIFICATION,
            version="1.0.0",
            description="Mock plugin for testing",
            fields=[
                FieldSpec(
                    key="api_key",
                    label="API Key",
                    type=FieldType.SECRET,
                    required=True,
                ),
                FieldSpec(
                    key="endpoint",
                    label="Endpoint",
                    type=FieldType.URL,
                    required=True,
                ),
                FieldSpec(
                    key="enabled",
                    label="Enabled",
                    type=FieldType.BOOLEAN,
                    default=True,
                ),
            ],
        )

    async def configure(self, config: dict) -> bool:
        self.config = config
        self.configured = bool(config.get("api_key") and config.get("endpoint"))
        return self.configured

    async def send_notification(
        self, recipient: str, message: str, subject=None, metadata=None
    ) -> bool:
        if not self.configured:
            raise RuntimeError("Plugin not configured")
        return True

    async def health_check(self) -> PluginHealthCheck:
        return PluginHealthCheck(
            plugin_instance_id=uuid4(),
            status="healthy" if self.configured else "unhealthy",
            message="Mock health check",
            details={"configured": self.configured},
            timestamp="2024-01-01T00:00:00Z",
        )

    @pytest.mark.asyncio
    async def test_connection(self, config: dict) -> PluginTestResult:
        has_required = bool(config.get("api_key") and config.get("endpoint"))
        return PluginTestResult(
            success=has_required,
            message="Connection successful" if has_required else "Missing configuration",
            details={"has_api_key": bool(config.get("api_key"))},
            timestamp="2024-01-01T00:00:00Z",
        )


@pytest.mark.unit
class TestPluginRegistry:
    """Test PluginRegistry class."""

    @pytest.fixture
    def registry(self):
        """Create a test registry."""
        return PluginRegistry(secrets_provider=None)

    @pytest.fixture
    def mock_plugin(self):
        """Create a mock plugin."""
        return MockPlugin()

    @pytest.mark.asyncio
    async def test_registry_initialization(self, registry):
        """Test registry initialization."""
        await registry.initialize()
        assert registry._plugins is not None
        assert registry._instances is not None
        assert registry._configurations is not None

    @pytest.mark.asyncio
    async def test_register_plugin_provider(self, registry, mock_plugin):
        """Test registering a plugin provider."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        assert "Mock Plugin" in registry._plugins
        assert registry._plugins["Mock Plugin"] == mock_plugin

    @pytest.mark.asyncio
    async def test_list_available_plugins(self, registry, mock_plugin):
        """Test listing available plugins."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        plugins = registry.list_available_plugins()
        assert len(plugins) == 1
        assert plugins[0].name == "Mock Plugin"
        assert plugins[0].version == "1.0.0"

    @pytest.mark.asyncio
    async def test_get_plugin_schema(self, registry, mock_plugin):
        """Test getting plugin schema."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        schema = registry.get_plugin_schema("Mock Plugin")
        assert schema is not None
        assert schema.name == "Mock Plugin"
        assert len(schema.fields) == 3

    @pytest.mark.asyncio
    async def test_get_nonexistent_plugin_schema(self, registry):
        """Test getting schema for non-existent plugin."""
        schema = registry.get_plugin_schema("Nonexistent Plugin")
        assert schema is None

    @pytest.mark.asyncio
    async def test_create_plugin_instance(self, registry, mock_plugin):
        """Test creating a plugin instance."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        config = {
            "api_key": "test_key",
            "endpoint": "https://api.example.com",
            "enabled": True,
        }

        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin", instance_name="Test Instance", configuration=config
        )

        assert instance.plugin_name == "Mock Plugin"
        assert instance.instance_name == "Test Instance"
        assert instance.has_configuration is True
        assert instance.status == PluginStatus.ACTIVE
        assert instance.id in registry._instances

    @pytest.mark.asyncio
    async def test_create_instance_nonexistent_plugin(self, registry):
        """Test creating instance for non-existent plugin."""
        with pytest.raises(PluginRegistryError) as exc_info:
            await registry.create_plugin_instance(
                plugin_name="Nonexistent", instance_name="Test", configuration={}
            )
        assert "Plugin Nonexistent not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_store_configuration_with_secrets(self, registry, mock_plugin):
        """Test storing configuration with secret fields."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        schema = mock_plugin.get_config_schema()
        instance_id = uuid.uuid4()

        config = {
            "api_key": "secret_key_123",
            "endpoint": "https://api.example.com",
            "enabled": True,
        }

        await registry._store_configuration(instance_id, schema, config)

        stored = registry._configurations[instance_id]
        assert stored["api_key"] == {"__secret__": True}  # Secret is masked
        assert stored["endpoint"] == "https://api.example.com"  # Non-secret is plain
        assert stored["enabled"] is True

    @pytest.mark.asyncio
    async def test_get_plugin_configuration(self, registry, mock_plugin):
        """Test getting plugin configuration with secrets masked."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin",
            instance_name="Test",
            configuration={
                "api_key": "secret_123",
                "endpoint": "https://api.example.com",
            },
        )

        config = await registry.get_plugin_configuration(instance.id)

        assert config["api_key"] == {"masked": True, "has_value": True}
        assert config["endpoint"] == "https://api.example.com"

    @pytest.mark.asyncio
    async def test_update_plugin_configuration(self, registry, mock_plugin):
        """Test updating plugin configuration."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin",
            instance_name="Test",
            configuration={
                "api_key": "old_key",
                "endpoint": "https://old.example.com",
            },
        )

        new_config = {
            "api_key": "new_key",
            "endpoint": "https://new.example.com",
            "enabled": False,
        }

        await registry.update_plugin_configuration(instance.id, new_config)

        # Check the stored configuration was updated
        stored = registry._configurations[instance.id]
        assert stored["api_key"]["__secret__"] is True  # Secret is masked
        assert stored["endpoint"] == "https://new.example.com"  # Non-secret is plain
        assert stored["enabled"] is False

    @pytest.mark.asyncio
    async def test_health_check_plugin(self, registry, mock_plugin):
        """Test plugin health check."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin",
            instance_name="Test",
            configuration={
                "api_key": "test_key",
                "endpoint": "https://api.example.com",
            },
        )

        health = await registry.health_check_plugin(instance.id)

        assert health.status == "healthy"
        assert health.plugin_instance_id == instance.id
        assert health.details["configured"] is True
        assert health.response_time_ms is not None

    @pytest.mark.asyncio
    async def test_health_check_nonexistent_instance(self, registry):
        """Test health check for non-existent instance."""
        fake_id = uuid.uuid4()
        with pytest.raises(PluginRegistryError) as exc_info:
            await registry.health_check_plugin(fake_id)
        assert f"Plugin instance {fake_id} not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_test_plugin_connection(self, registry, mock_plugin):
        """Test plugin connection testing."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin", instance_name="Test", configuration={}
        )

        # Test with custom config
        test_config = {
            "api_key": "test_key",
            "endpoint": "https://test.example.com",
        }

        result = await registry.test_plugin_connection(instance.id, test_config)

        assert result.success is True
        assert "successful" in result.message.lower()
        assert result.response_time_ms is not None

    @pytest.mark.asyncio
    async def test_test_connection_missing_config(self, registry, mock_plugin):
        """Test connection with missing configuration."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin", instance_name="Test", configuration={}
        )

        # Test with incomplete config
        test_config = {"api_key": "test_key"}  # Missing endpoint

        result = await registry.test_plugin_connection(instance.id, test_config)

        assert result.success is False
        assert result.details["has_api_key"] is True

    @pytest.mark.asyncio
    async def test_delete_plugin_instance(self, registry, mock_plugin):
        """Test deleting a plugin instance."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin",
            instance_name="Test",
            configuration={"api_key": "test", "endpoint": "https://test.com"},
        )

        # Verify instance exists
        assert instance.id in registry._instances

        # Delete instance
        await registry.delete_plugin_instance(instance.id)

        # Verify instance is deleted
        assert instance.id not in registry._instances
        assert instance.id not in registry._configurations

    @pytest.mark.asyncio
    async def test_delete_nonexistent_instance(self, registry):
        """Test deleting non-existent instance."""
        fake_id = uuid.uuid4()
        with pytest.raises(PluginRegistryError) as exc_info:
            await registry.delete_plugin_instance(fake_id)
        assert f"Plugin instance {fake_id} not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_plugin_provider(self, registry, mock_plugin):
        """Test getting a plugin provider."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        provider = await registry.get_plugin_provider("Mock Plugin")
        assert provider == mock_plugin

        none_provider = await registry.get_plugin_provider("Nonexistent")
        assert none_provider is None

    @pytest.mark.asyncio
    async def test_get_plugin_instance(self, registry, mock_plugin):
        """Test getting a plugin instance."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin", instance_name="Test", configuration={}
        )

        retrieved = await registry.get_plugin_instance(instance.id)
        assert retrieved == instance

        none_instance = await registry.get_plugin_instance(uuid.uuid4())
        assert none_instance is None

    @pytest.mark.asyncio
    async def test_list_plugin_instances(self, registry, mock_plugin):
        """Test listing plugin instances."""
        await registry._register_plugin_provider(mock_plugin, "mock_module")

        # Create multiple instances
        instance1 = await registry.create_plugin_instance(
            plugin_name="Mock Plugin", instance_name="Instance 1", configuration={}
        )

        instance2 = await registry.create_plugin_instance(
            plugin_name="Mock Plugin", instance_name="Instance 2", configuration={}
        )

        instances = registry.list_plugin_instances()
        assert len(instances) == 2
        assert instance1 in instances
        assert instance2 in instances

    @pytest.mark.asyncio
    async def test_save_and_load_configurations(self, registry, mock_plugin, tmp_path, monkeypatch):
        """Test saving and loading plugin configurations."""
        # Use temp directory
        monkeypatch.chdir(tmp_path)

        await registry._register_plugin_provider(mock_plugin, "mock_module")

        # Create instance
        instance = await registry.create_plugin_instance(
            plugin_name="Mock Plugin",
            instance_name="Test",
            configuration={"api_key": "test", "endpoint": "https://test.com"},
        )

        # Save configurations
        await registry._save_configurations()

        # Create new registry and load
        new_registry = PluginRegistry()
        await new_registry._load_configurations()

        # Verify loaded instance
        loaded_instance = new_registry._instances.get(instance.id)
        assert loaded_instance is not None
        assert loaded_instance.plugin_name == "Mock Plugin"
        assert loaded_instance.instance_name == "Test"

    def test_get_global_registry(self):
        """Test getting global registry instance."""
        registry1 = get_plugin_registry()
        registry2 = get_plugin_registry()
        assert registry1 is registry2  # Should be singleton


@pytest.mark.unit
class TestPluginValidation:
    """Test plugin validation."""

    @pytest.fixture
    def registry(self):
        return PluginRegistry()

    def test_validate_plugin_schema(self, registry):
        """Test plugin schema validation."""
        schema = PluginConfig(
            name="Test",
            type=PluginType.NOTIFICATION,
            version="1.0.0",
            description="Test",
            fields=[
                FieldSpec(key="field1", label="Field 1", type=FieldType.STRING),
            ],
        )

        # Should not raise
        registry._validate_plugin_schema(schema)

    @pytest.mark.asyncio
    async def test_configuration_error_handling(self, registry):
        """Test configuration error handling."""

        # Create a plugin that fails to configure
        class FailingPlugin(PluginProvider):
            def get_config_schema(self) -> PluginConfig:
                return PluginConfig(
                    name="Failing Plugin",
                    type=PluginType.INTEGRATION,
                    version="1.0.0",
                    description="Always fails",
                    fields=[],
                )

            async def configure(self, config: dict) -> bool:
                raise Exception("Configuration always fails")

        failing = FailingPlugin()
        await registry._register_plugin_provider(failing, "failing")

        instance = await registry.create_plugin_instance(
            plugin_name="Failing Plugin", instance_name="Test", configuration={"some": "config"}
        )

        assert instance.status == PluginStatus.ERROR
        assert instance.last_error == "Configuration always fails"
