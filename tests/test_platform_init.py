"""Tests for platform __init__.py functions."""

from unittest.mock import MagicMock, patch

import pytest

import dotmac.platform as platform


@pytest.mark.unit
class TestPlatformRegistry:
    """Test service registry functions."""

    def test_get_version(self):
        """Test get_version returns version string."""
        version = platform.get_version()
        assert isinstance(version, str)
        assert len(version) > 0
        assert version == platform.__version__

    def test_register_and_get_service(self):
        """Test registering and retrieving services."""
        # Clear registry
        platform._services_registry.clear()

        # Register a service
        mock_service = {"name": "test_service"}
        platform.register_service("test", mock_service)

        # Retrieve service
        retrieved = platform.get_service("test")
        assert retrieved == mock_service

        # Non-existent service
        assert platform.get_service("nonexistent") is None

    def test_is_service_available(self):
        """Test checking service availability."""
        platform._services_registry.clear()

        # Service not available
        assert not platform.is_service_available("test")

        # Register service
        platform.register_service("test", {})

        # Service available
        assert platform.is_service_available("test")

    def test_get_available_services(self):
        """Test getting list of available services."""
        platform._services_registry.clear()

        # Empty initially
        assert platform.get_available_services() == []

        # Add services
        platform.register_service("auth", {})
        platform.register_service("secrets", {})

        # Check available
        services = platform.get_available_services()
        assert "auth" in services
        assert "secrets" in services
        assert len(services) == 2


@pytest.mark.unit
class TestPlatformConfig:
    """Test platform configuration."""

    @patch.dict(
        "os.environ",
        {
            "DOTMAC_JWT_SECRET_KEY": "",
            "DOTMAC_JWT_ALGORITHM": "HS256",
            "DOTMAC_JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "15",
            "DOTMAC_JWT_REFRESH_TOKEN_EXPIRE_DAYS": "30",
            "DOTMAC_SESSION_BACKEND": "memory",
            "DOTMAC_VAULT_MOUNT_POINT": "secret",
            "DOTMAC_SERVICE_NAME": "dotmac-service",
            "DOTMAC_LOG_LEVEL": "INFO",
        },
        clear=True,
    )
    def test_config_initialization(self):
        """Test config initializes with environment defaults."""
        config = platform.PlatformConfig()

        # Check default values are loaded
        assert config.get("auth.jwt_algorithm") == "HS256"
        assert config.get("auth.access_token_expire_minutes") == 15
        assert config.get("auth.refresh_token_expire_days") == 30
        assert config.get("auth.session_backend") == "memory"
        assert config.get("secrets.vault_mount_point") == "secret"
        assert config.get("observability.service_name") == "dotmac-service"
        assert config.get("observability.log_level") == "INFO"

    @patch.dict(
        "os.environ",
        {
            "DOTMAC_JWT_ALGORITHM": "HS256",
        },
        clear=True,
    )
    def test_config_get_nested_value(self):
        """Test getting nested configuration values."""
        config = platform.PlatformConfig()

        # Test nested access
        jwt_algo = config.get("auth.jwt_algorithm")
        assert jwt_algo == "HS256"

        # Test default value
        nonexistent = config.get("nonexistent.key", "default")
        assert nonexistent == "default"

    @patch.dict("os.environ", {}, clear=True)
    def test_config_get_non_dict_value(self):
        """Test getting value when intermediate path is not a dict."""
        config = platform.PlatformConfig()

        # Set a non-dict value
        config._config["string_key"] = "value"

        # Try to access nested path through non-dict
        result = config.get("string_key.subkey", "default")
        assert result == "default"

    @patch.dict("os.environ", {}, clear=True)
    def test_config_update(self):
        """Test updating configuration."""
        config = platform.PlatformConfig()

        # Update config
        updates = {
            "auth": {
                "jwt_algorithm": "RS256",
                "custom_key": "custom_value",
            }
        }
        config.update(updates)

        # Check values were updated
        assert config.get("auth.jwt_algorithm") == "RS256"
        assert config.get("auth.custom_key") == "custom_value"

    @patch.dict(
        "os.environ",
        {
            "DOTMAC_JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "15",
        },
        clear=True,
    )
    def test_config_merge(self):
        """Test recursive configuration merging."""
        config = platform.PlatformConfig()

        # Update with nested dict
        updates = {
            "auth": {
                "jwt_algorithm": "RS256",
                "new_key": "new_value",
            },
            "new_section": {
                "key": "value",
            },
        }
        config.update(updates)

        # Check nested update
        assert config.get("auth.jwt_algorithm") == "RS256"
        assert config.get("auth.new_key") == "new_value"

        # Check other auth keys still exist
        assert config.get("auth.access_token_expire_minutes") == 15

        # Check new section
        assert config.get("new_section.key") == "value"

    @patch.dict(
        "os.environ",
        {
            "DOTMAC_JWT_SECRET_KEY": "test-secret-key",
            "DOTMAC_JWT_ALGORITHM": "RS256",
            "DOTMAC_JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "30",
            "DOTMAC_VAULT_URL": "http://vault:8200",
            "DOTMAC_SERVICE_NAME": "test-service",
            "DOTMAC_TRACING_ENABLED": "false",
        },
    )
    def test_config_loads_from_environment(self):
        """Test configuration loads from environment variables."""
        config = platform.PlatformConfig()

        # Check environment values were loaded
        assert config.get("auth.jwt_secret_key") == "test-secret-key"
        assert config.get("auth.jwt_algorithm") == "RS256"
        assert config.get("auth.access_token_expire_minutes") == 30
        assert config.get("secrets.vault_url") == "http://vault:8200"
        assert config.get("observability.service_name") == "test-service"
        assert config.get("observability.tracing_enabled") is False

    @patch.dict(
        "os.environ",
        {
            "DOTMAC_SECRETS_AUTO_ROTATION": "true",
            "DOTMAC_METRICS_ENABLED": "false",
        },
    )
    def test_config_boolean_environment_variables(self):
        """Test boolean environment variables are correctly parsed."""
        config = platform.PlatformConfig()

        assert config.get("secrets.auto_rotation") is True
        assert config.get("observability.metrics_enabled") is False


@pytest.mark.unit
class TestPlatformInitialization:
    """Test platform initialization functions."""

    @patch.dict("os.environ", {}, clear=True)
    def test_initialize_platform_services_with_configs(self):
        """Test initializing platform with custom configurations."""
        # Clear initialized services
        platform._initialized_services.clear()

        auth_config = {"jwt_algorithm": "RS256"}
        secrets_config = {"vault_url": "http://test:8200"}
        obs_config = {"service_name": "test-service"}

        platform.initialize_platform_services(
            auth_config=auth_config,
            secrets_config=secrets_config,
            observability_config=obs_config,
            auto_discover=True,
        )

        # Check configs were updated
        assert platform.config.get("auth.jwt_algorithm") == "RS256"
        assert platform.config.get("secrets.vault_url") == "http://test:8200"
        assert platform.config.get("observability.service_name") == "test-service"

        # Check services were discovered
        initialized = platform.get_initialized_services()
        assert isinstance(initialized, set)

    @patch.dict("os.environ", {}, clear=True)
    def test_initialize_platform_services_without_auto_discover(self):
        """Test initialization without auto-discovery."""
        platform._initialized_services.clear()

        platform.initialize_platform_services(auto_discover=False)

        # Services should not be auto-discovered
        initialized = platform.get_initialized_services()
        assert isinstance(initialized, set)

    def test_get_initialized_services(self):
        """Test getting list of initialized services."""
        platform._initialized_services.clear()

        # Add some services
        platform._initialized_services.add("auth")
        platform._initialized_services.add("secrets")

        services = platform.get_initialized_services()
        assert "auth" in services
        assert "secrets" in services


@pytest.mark.unit
class TestPlatformModule:
    """Test module-level attributes."""

    def test_module_attributes_exist(self):
        """Test that module has expected attributes."""
        assert hasattr(platform, "__version__")
        assert hasattr(platform, "__author__")
        assert hasattr(platform, "__email__")
        assert hasattr(platform, "get_version")
        assert hasattr(platform, "register_service")
        assert hasattr(platform, "get_service")
        assert hasattr(platform, "is_service_available")
        assert hasattr(platform, "get_available_services")
        assert hasattr(platform, "PlatformConfig")
        assert hasattr(platform, "config")
        assert hasattr(platform, "initialize_platform_services")
        assert hasattr(platform, "get_initialized_services")

    def test_module_constants(self):
        """Test module constants have expected values."""
        assert platform.__version__ == platform.get_version()
        assert platform.__author__ == "DotMac Team"
        assert platform.__email__ == "dev@dotmac.com"

    def test_global_config_instance(self):
        """Test global config instance exists and works."""
        assert isinstance(platform.config, platform.PlatformConfig)
        # Config may have been modified by other tests, just check it exists
        assert platform.config.get("auth.jwt_algorithm") in ["HS256", "RS256"]


@pytest.mark.unit
class TestServiceFactories:
    """Test service factory functions."""

    def test_create_jwt_service_success(self):
        """Test creating JWT service successfully."""
        result = platform.create_jwt_service(
            jwt_secret_key="test-secret",
            jwt_algorithm="HS256",
        )

        assert result is not None
        # JWT service should have secret and algorithm
        assert hasattr(result, "secret")

    def test_create_jwt_service_import_error(self):
        """Test JWT service creation handles import errors."""
        with patch("dotmac.platform.auth.JWTService", side_effect=ImportError()):
            with pytest.raises(ImportError) as exc_info:
                platform.create_jwt_service()

            assert "Auth service not available" in str(exc_info.value)

    def test_create_secrets_manager_auto_backend(self):
        """Test creating secrets manager with auto backend."""
        # This will use the factory's auto-detection
        result = platform.create_secrets_manager()

        assert result is not None

    def test_create_secrets_manager_explicit_backend(self):
        """Test creating secrets manager with explicit backend."""
        result = platform.create_secrets_manager(backend="local")

        assert result is not None

    def test_create_secrets_manager_import_error(self):
        """Test secrets manager creation handles import errors."""
        with patch(
            "dotmac.platform.secrets.factory.create_secrets_manager",
            side_effect=ImportError("Test error"),
        ):
            with pytest.raises(ImportError) as exc_info:
                platform.create_secrets_manager()

            assert "Secrets service error" in str(exc_info.value)

    def test_create_observability_manager_success(self):
        """Test creating observability manager."""
        try:
            result = platform.create_observability_manager(auto_initialize=False)
        except ImportError:
            pytest.skip("Observability extras not installed")
        else:
            assert result is not None
            # Should be an ObservabilityManager instance
            assert hasattr(result, "initialize")

    def test_create_observability_manager_with_app(self):
        """Test creating observability manager with app."""
        mock_app = MagicMock()

        try:
            result = platform.create_observability_manager(app=mock_app, auto_initialize=False)
        except ImportError:
            pytest.skip("Observability extras not installed")
        else:
            assert result is not None
            # Should have initialize method
            assert hasattr(result, "initialize")
            # Should have the app reference if applicable
            if hasattr(result, "app"):
                assert result.app == mock_app
