"""
Plugin registry and management system.

This module implements the plugin registry that manages plugin lifecycle,
configuration storage, and provides the plugin discovery and loading system.
"""

import importlib
import importlib.util
import json
import logging
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from uuid import UUID, uuid4

# from ..secrets.interfaces import SecretsProvider  # Optional dependency
from ..settings import get_settings
from .interfaces import PROVIDER_TYPE_MAP, PluginProvider
from .schema import (
    FieldType,
    PluginConfig,
    PluginHealthCheck,
    PluginInstance,
    PluginStatus,
    PluginTestResult,
)

logger = logging.getLogger(__name__)


class PluginRegistryError(Exception):
    """Plugin registry related errors."""

    pass


class PluginLoadError(Exception):
    """Plugin loading errors."""

    pass


class PluginConfigurationError(Exception):
    """Plugin configuration errors."""

    pass


class PluginRegistry:
    """
    Central registry for managing plugins.

    Handles plugin discovery, loading, configuration management,
    and health monitoring.
    """

    def __init__(
        self,
        secrets_provider: Any = None,
        *,
        plugin_paths: list[str | Path] | tuple[str | Path, ...] | None = None,
    ) -> None:
        self.secrets_provider = secrets_provider
        self.settings = get_settings()

        # Plugin storage
        self._plugins: dict[str, PluginProvider] = {}  # plugin_name -> provider
        self._instances: dict[UUID, PluginInstance] = {}  # instance_id -> instance
        self._configurations: dict[UUID, dict[str, Any]] = {}  # instance_id -> config

        # Plugin loading paths
        if plugin_paths is not None:
            base_paths = [Path(p) for p in plugin_paths]
        else:
            base_paths = [Path("plugins")]

        base_paths.append(Path(__file__).parent / "builtin")

        self._plugin_paths: list[Path] = []
        for path in base_paths:
            if path not in self._plugin_paths:
                self._plugin_paths.append(path)

        # Add user-specified plugin paths from settings
        if hasattr(self.settings, "plugin_paths"):
            for configured_path in self.settings.plugin_paths:
                path_obj = Path(configured_path)
                if path_obj not in self._plugin_paths:
                    self._plugin_paths.append(path_obj)

    async def initialize(self) -> None:
        """Initialize the plugin registry."""
        logger.info("Initializing plugin registry...")

        # Discover and load plugins
        await self._discover_plugins()

        # Load existing configurations
        await self._load_configurations()

        logger.info(f"Plugin registry initialized with {len(self._plugins)} plugins")

    async def _discover_plugins(self) -> None:
        """Discover plugins from configured paths."""
        for plugin_path in self._plugin_paths:
            if not plugin_path.exists():
                continue

            logger.debug(f"Discovering plugins in: {plugin_path}")

            try:
                await self._load_plugins_from_path(plugin_path)
            except Exception as e:
                logger.warning(f"Failed to load plugins from {plugin_path}: {e}")

    async def _load_plugins_from_path(self, path: Path) -> None:
        """Load plugins from a specific path."""
        # Look for Python modules
        for py_file in path.glob("*.py"):
            if py_file.name.startswith("_"):
                continue

            try:
                await self._load_plugin_module(py_file)
            except Exception as e:
                logger.warning(f"Failed to load plugin {py_file}: {e}")

        # Look for plugin directories with __init__.py
        for plugin_dir in path.iterdir():
            if not plugin_dir.is_dir() or plugin_dir.name.startswith("_"):
                continue

            init_file = plugin_dir / "__init__.py"
            if init_file.exists():
                try:
                    await self._load_plugin_module(init_file)
                except Exception as e:
                    logger.warning(f"Failed to load plugin {plugin_dir}: {e}")

    async def _load_plugin_module(self, module_path: Path) -> None:
        """Load a plugin from a Python module."""
        # Add plugin directory to Python path if needed
        plugin_dir = module_path.parent
        inserted_path = False
        if str(plugin_dir) not in sys.path:
            sys.path.insert(0, str(plugin_dir))
            inserted_path = True

        try:
            # Import the module
            module_name = (
                module_path.stem if module_path.name != "__init__.py" else module_path.parent.name
            )
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            if not spec or not spec.loader:
                raise PluginLoadError(f"Could not load spec for {module_path}")

            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Look for plugin registration
            if hasattr(module, "register"):
                provider = module.register()
                if isinstance(provider, PluginProvider):
                    await self._register_plugin_provider(provider, module_name)
                else:
                    logger.warning(f"Plugin {module_name} register() did not return PluginProvider")
            else:
                logger.debug(f"Plugin module {module_name} has no register() function")

        except Exception as e:
            raise PluginLoadError(f"Failed to load plugin module {module_path}: {e}")
        finally:
            # Clean up Python path only if we inserted it
            if inserted_path and str(plugin_dir) in sys.path:
                sys.path.remove(str(plugin_dir))

    async def _register_plugin_provider(self, provider: PluginProvider, module_name: str) -> None:
        """Register a plugin provider."""
        try:
            # Get plugin configuration schema
            config_schema = provider.get_config_schema()

            # Validate schema
            self._validate_plugin_schema(config_schema, provider)

            # Store the provider
            plugin_name = config_schema.name
            self._plugins[plugin_name] = provider

            logger.info(f"Registered plugin: {plugin_name} v{config_schema.version}")

        except Exception as e:
            raise PluginRegistryError(f"Failed to register plugin {module_name}: {e}")

    def _validate_plugin_schema(
        self, schema: PluginConfig, provider: PluginProvider | None = None
    ) -> None:
        """Validate a plugin configuration schema."""
        # Check for required provider interface
        expected_base = PROVIDER_TYPE_MAP.get(schema.type.value)
        if expected_base:
            provider_obj: object | None = cast(
                object | None, provider or self._plugins.get(schema.name)
            )
            if provider_obj is not None and not isinstance(provider_obj, expected_base):
                logger.warning(f"Plugin {schema.name} should inherit from {expected_base.__name__}")

    async def _load_configurations(self) -> None:
        """Load existing plugin configurations."""
        # In a real implementation, this would load from database
        # For now, we'll use file-based storage
        config_file = Path("plugin_configs.json")
        if config_file.exists():
            try:
                with open(config_file) as f:
                    data = json.load(f)

                for instance_data in data.get("instances", []):
                    instance = PluginInstance(**instance_data)
                    self._instances[instance.id] = instance

                    # Load configuration values
                    config_values = data.get("configurations", {}).get(str(instance.id), {})
                    self._configurations[instance.id] = config_values

                    logger.debug(f"Loaded configuration for plugin instance {instance.id}")

            except Exception as e:
                logger.warning(f"Failed to load plugin configurations: {e}")

    async def _save_configurations(self) -> None:
        """Save plugin configurations to storage."""
        config_file = Path("plugin_configs.json")

        try:
            data = {
                "instances": [instance.model_dump() for instance in self._instances.values()],
                "configurations": {
                    str(instance_id): config for instance_id, config in self._configurations.items()
                },
            }

            with open(config_file, "w") as f:
                json.dump(data, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Failed to save plugin configurations: {e}")

    # Public API methods

    def list_available_plugins(self) -> list[PluginConfig]:
        """List all available (registered) plugins."""
        schemas = []
        for provider in self._plugins.values():
            try:
                schema = provider.get_config_schema()
                schemas.append(schema)
            except Exception as e:
                logger.warning(f"Failed to get schema for plugin: {e}")
        return schemas

    def list_plugin_instances(self) -> list[PluginInstance]:
        """List all configured plugin instances."""
        return list(self._instances.values())

    def get_plugin_schema(self, plugin_name: str) -> PluginConfig | None:
        """Get configuration schema for a plugin."""
        provider = self._plugins.get(plugin_name)
        if provider:
            try:
                return provider.get_config_schema()
            except Exception as e:
                logger.warning(f"Failed to get schema for plugin {plugin_name}: {e}")
        return None

    async def create_plugin_instance(
        self, plugin_name: str, instance_name: str, configuration: dict[str, Any]
    ) -> PluginInstance:
        """Create a new plugin instance with configuration."""
        provider = self._plugins.get(plugin_name)
        if not provider:
            raise PluginRegistryError(f"Plugin {plugin_name} not found")

        schema = provider.get_config_schema()
        instance_id = uuid4()

        # Create instance
        instance = PluginInstance(
            id=instance_id,
            plugin_name=plugin_name,
            instance_name=instance_name,
            config_schema=schema,
            status=PluginStatus.REGISTERED,
            has_configuration=bool(configuration),
            last_health_check=None,
            last_error=None,
            configuration_version=None,
        )

        # Store configuration
        if configuration:
            await self._store_configuration(instance_id, schema, configuration)
            instance.status = PluginStatus.CONFIGURED
            instance.has_configuration = True

        # Store instance
        self._instances[instance_id] = instance

        # Configure the provider
        if configuration:
            try:
                success = await provider.configure(configuration)
                if success:
                    instance.status = PluginStatus.ACTIVE
                else:
                    instance.status = PluginStatus.ERROR
                    instance.last_error = "Configuration failed"
            except Exception as e:
                instance.status = PluginStatus.ERROR
                instance.last_error = str(e)
                logger.error(f"Failed to configure plugin {plugin_name}: {e}")

        # Save to persistence
        await self._save_configurations()

        return instance

    async def _store_configuration(
        self, instance_id: UUID, schema: PluginConfig, configuration: dict[str, Any]
    ) -> None:
        """Store plugin configuration, handling secrets appropriately."""
        stored_config = {}

        # Process each field according to its type
        field_map = {field.key: field for field in schema.fields}

        for key, value in configuration.items():
            field_spec = field_map.get(key)
            if not field_spec:
                logger.warning(f"Unknown configuration field: {key}")
                continue

            if field_spec.is_secret or field_spec.type == FieldType.SECRET:
                # Store secrets in Vault
                if self.secrets_provider and value and hasattr(self.secrets_provider, "set_secret"):
                    secret_path = f"plugins/{instance_id}/{key}"
                    try:
                        await self.secrets_provider.set_secret(secret_path, {"value": value})
                        stored_config[key] = {"__secret__": True, "path": secret_path}
                    except Exception as e:
                        logger.error(f"Failed to store secret {key}: {e}")
                        raise PluginConfigurationError(f"Failed to store secret field {key}")
                else:
                    # Mark as secret but don't store value
                    stored_config[key] = {"__secret__": True}
            else:
                # Store regular values
                stored_config[key] = value

        self._configurations[instance_id] = stored_config

    async def get_plugin_configuration(self, instance_id: UUID) -> dict[str, Any]:
        """Get plugin configuration, masking secrets."""
        if instance_id not in self._instances:
            raise PluginRegistryError(f"Plugin instance {instance_id} not found")

        instance = self._instances[instance_id]
        stored_config = self._configurations.get(instance_id, {})

        # Build response configuration
        config = {}
        field_map = {field.key: field for field in instance.config_schema.fields}

        for key, value in stored_config.items():
            field_spec = field_map.get(key)
            if not field_spec:
                continue

            if isinstance(value, dict) and value.get("__secret__"):
                # Mask secret values
                config[key] = {"masked": True, "has_value": True}
            else:
                config[key] = value

        return config

    async def update_plugin_configuration(
        self, instance_id: UUID, configuration: dict[str, Any]
    ) -> None:
        """Update plugin configuration."""
        if instance_id not in self._instances:
            raise PluginRegistryError(f"Plugin instance {instance_id} not found")

        instance = self._instances[instance_id]
        provider = self._plugins[instance.plugin_name]

        # Store new configuration
        await self._store_configuration(instance_id, instance.config_schema, configuration)

        # Reconfigure the provider
        try:
            # Get full configuration for provider (with secrets resolved)
            full_config = await self._get_full_configuration(instance_id)
            success = await provider.configure(full_config)

            if success:
                instance.status = PluginStatus.ACTIVE
                instance.last_error = None
            else:
                instance.status = PluginStatus.ERROR
                instance.last_error = "Configuration update failed"
        except Exception as e:
            instance.status = PluginStatus.ERROR
            instance.last_error = str(e)
            logger.error(f"Failed to update plugin configuration: {e}")
            raise

        # Save changes
        await self._save_configurations()

    async def _get_full_configuration(self, instance_id: UUID) -> dict[str, Any]:
        """Get full configuration with secrets resolved for provider use."""
        stored_config = self._configurations.get(instance_id, {})
        full_config = {}

        for key, value in stored_config.items():
            if isinstance(value, dict) and value.get("__secret__"):
                # Resolve secret from Vault
                if (
                    self.secrets_provider
                    and "path" in value
                    and hasattr(self.secrets_provider, "get_secret")
                ):
                    try:
                        secret_data = await self.secrets_provider.get_secret(value["path"])
                        full_config[key] = secret_data.get("value")
                    except Exception as e:
                        logger.warning(f"Failed to resolve secret {key}: {e}")
                        full_config[key] = None
                else:
                    full_config[key] = None
            else:
                full_config[key] = value

        return full_config

    async def health_check_plugin(self, instance_id: UUID) -> PluginHealthCheck:
        """Perform health check on a plugin instance."""
        if instance_id not in self._instances:
            raise PluginRegistryError(f"Plugin instance {instance_id} not found")

        instance = self._instances[instance_id]
        provider = self._plugins[instance.plugin_name]

        start_time = time.time()

        try:
            health_check = await provider.health_check()
            health_check.plugin_instance_id = instance_id
            health_check.timestamp = datetime.now(UTC).isoformat()
            health_check.response_time_ms = int((time.time() - start_time) * 1000)

            # Update instance
            instance.last_health_check = health_check.timestamp
            if health_check.status == "healthy":
                instance.last_error = None
            else:
                instance.last_error = health_check.message

            await self._save_configurations()
            return health_check

        except Exception as e:
            health_check = PluginHealthCheck(
                plugin_instance_id=instance_id,
                status="unhealthy",
                message=f"Health check failed: {str(e)}",
                details={"error": str(e)},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=int((time.time() - start_time) * 1000),
            )

            instance.last_error = str(e)
            instance.last_health_check = health_check.timestamp
            await self._save_configurations()

            return health_check

    async def test_plugin_connection(
        self, instance_id: UUID, test_config: dict[str, Any] | None = None
    ) -> PluginTestResult:
        """Test plugin connection with provided or stored configuration."""
        if instance_id not in self._instances:
            raise PluginRegistryError(f"Plugin instance {instance_id} not found")

        instance = self._instances[instance_id]
        provider = self._plugins[instance.plugin_name]

        # Use provided config or get stored config
        if test_config is None:
            test_config = await self._get_full_configuration(instance_id)

        start_time = time.time()

        try:
            result = await provider.test_connection(test_config)
            result.timestamp = datetime.now(UTC).isoformat()
            result.response_time_ms = int((time.time() - start_time) * 1000)
            return result

        except Exception as e:
            return PluginTestResult(
                success=False,
                message=f"Connection test failed: {str(e)}",
                details={"error": str(e)},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=int((time.time() - start_time) * 1000),
            )

    async def get_plugin_provider(self, plugin_name: str) -> PluginProvider | None:
        """Get a plugin provider by name."""
        return self._plugins.get(plugin_name)

    async def get_plugin_instance(self, instance_id: UUID) -> PluginInstance | None:
        """Get a plugin instance by ID."""
        return self._instances.get(instance_id)

    async def delete_plugin_instance(self, instance_id: UUID) -> None:
        """Delete a plugin instance and its configuration."""
        if instance_id not in self._instances:
            raise PluginRegistryError(f"Plugin instance {instance_id} not found")

        # Clean up secrets
        stored_config = self._configurations.get(instance_id, {})
        if self.secrets_provider and hasattr(self.secrets_provider, "delete_secret"):
            for key, value in stored_config.items():
                if isinstance(value, dict) and value.get("__secret__") and "path" in value:
                    try:
                        await self.secrets_provider.delete_secret(value["path"])
                    except Exception as e:
                        logger.warning(f"Failed to delete secret {key}: {e}")

        # Remove from memory
        del self._instances[instance_id]
        self._configurations.pop(instance_id, None)

        # Save changes
        await self._save_configurations()


# Global registry instance
_plugin_registry: PluginRegistry | None = None


def get_plugin_registry() -> PluginRegistry:
    """Get the global plugin registry instance."""
    global _plugin_registry
    if _plugin_registry is None:
        _plugin_registry = PluginRegistry()
    return _plugin_registry
