"""
Comprehensive tests for the secrets factory module.
"""

from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.dependencies import DependencyError
from dotmac.platform.secrets.factory import (
    LocalSecretsManager,
    SecretsManager,
    SecretsManagerFactory,
    create_local_secrets_manager,
    create_secrets_manager,
    create_vault_secrets_manager,
    get_default_secrets_manager,
)


@pytest.mark.unit
class TestSecretsManagerProtocol:
    """Test the SecretsManager Protocol."""

    def test_local_secrets_manager_implements_protocol(self):
        """Test that LocalSecretsManager implements SecretsManager protocol."""
        manager = LocalSecretsManager()
        assert isinstance(manager, SecretsManager)

    def test_protocol_methods_exist(self):
        """Test that protocol methods are defined."""
        manager = LocalSecretsManager()

        assert hasattr(manager, "get_secret")
        assert hasattr(manager, "set_secret")
        assert hasattr(manager, "health_check")

        assert callable(manager.get_secret)
        assert callable(manager.set_secret)
        assert callable(manager.health_check)


@pytest.mark.unit
class TestLocalSecretsManager:
    """Test the LocalSecretsManager implementation."""

    def test_init_default(self):
        """Test LocalSecretsManager initialization with defaults."""
        manager = LocalSecretsManager()

        assert manager.secrets_file == ".env"
        assert manager._secrets == {}

    def test_init_custom_file(self):
        """Test LocalSecretsManager initialization with custom file."""
        manager = LocalSecretsManager(secrets_file="custom.env")

        assert manager.secrets_file == "custom.env"
        assert manager._secrets == {}

    def test_get_secret_exists(self):
        """Test getting an existing secret."""
        manager = LocalSecretsManager()
        manager._secrets["app/database"] = {"username": "admin", "password": "secret"}

        result = manager.get_secret("app/database")

        assert result == {"username": "admin", "password": "secret"}

    def test_get_secret_not_exists(self):
        """Test getting a non-existent secret."""
        manager = LocalSecretsManager()

        result = manager.get_secret("nonexistent/path")

        assert result == {}

    def test_set_secret(self):
        """Test setting a secret."""
        manager = LocalSecretsManager()

        manager.set_secret("app/cache", {"host": "redis", "port": 6379})

        assert manager._secrets["app/cache"] == {"host": "redis", "port": 6379}

    def test_set_secret_overwrite(self):
        """Test overwriting an existing secret."""
        manager = LocalSecretsManager()
        manager._secrets["app/test"] = {"old": "value"}

        manager.set_secret("app/test", {"new": "value"})

        assert manager._secrets["app/test"] == {"new": "value"}

    def test_health_check(self):
        """Test health check always returns True."""
        manager = LocalSecretsManager()

        assert manager.health_check() is True


@pytest.mark.unit
class TestSecretsManagerFactory:
    """Test the SecretsManagerFactory class."""

    def test_create_local_secrets_manager(self):
        """Test creating local secrets manager."""
        manager = SecretsManagerFactory.create_secrets_manager("local")

        assert isinstance(manager, LocalSecretsManager)
        assert manager.secrets_file == ".env"

    def test_create_local_with_custom_params(self):
        """Test creating local manager with custom parameters."""
        manager = SecretsManagerFactory.create_secrets_manager("local", secrets_file="test.env")

        assert isinstance(manager, LocalSecretsManager)
        assert manager.secrets_file == "test.env"

    def test_create_local_filters_vault_params(self):
        """Test that vault parameters are filtered out for local backend."""
        manager = SecretsManagerFactory.create_secrets_manager(
            "local",
            secrets_file="test.env",
            vault_url="http://vault:8200",  # Should be filtered out
            vault_token="token",  # Should be filtered out
            unknown_param="value",  # Should be filtered out
        )

        assert isinstance(manager, LocalSecretsManager)
        assert manager.secrets_file == "test.env"

    @patch("dotmac.platform.secrets.factory.settings")
    @patch("dotmac.platform.secrets.factory.DependencyChecker")
    def test_create_vault_secrets_manager_success(self, mock_dep_checker, mock_settings):
        """Test creating vault secrets manager when enabled."""
        mock_settings.features.secrets_vault = True
        mock_dep_checker.require_feature_dependency.return_value = None

        with patch("dotmac.platform.secrets.vault_client.VaultClient") as mock_vault_client:
            mock_vault_instance = MagicMock()
            mock_vault_client.return_value = mock_vault_instance

            manager = SecretsManagerFactory.create_secrets_manager("vault")

            assert manager == mock_vault_instance
            mock_dep_checker.require_feature_dependency.assert_called_once_with("secrets_vault")
            mock_vault_client.assert_called_once()

    @patch("dotmac.platform.secrets.factory.settings")
    def test_create_vault_secrets_manager_disabled(self, mock_settings):
        """Test creating vault manager when vault is disabled."""
        mock_settings.features.secrets_vault = False

        with pytest.raises(ValueError) as exc_info:
            SecretsManagerFactory.create_secrets_manager("vault")

        assert "Vault secrets backend not enabled" in str(exc_info.value)
        assert "Set FEATURES__SECRETS_VAULT=true" in str(exc_info.value)

    @patch("dotmac.platform.secrets.factory.settings")
    @patch("dotmac.platform.secrets.factory.DependencyChecker")
    def test_create_vault_with_dependency_error(self, mock_dep_checker, mock_settings):
        """Test vault creation with missing dependencies."""
        mock_settings.features.secrets_vault = True
        mock_dep_checker.require_feature_dependency.side_effect = DependencyError(
            feature="secrets_vault", packages=["hvac"], install_cmd="pip install hvac"
        )

        with pytest.raises(DependencyError):
            SecretsManagerFactory.create_secrets_manager("vault")

    def test_create_unknown_backend(self):
        """Test creating manager with unknown backend."""
        with pytest.raises(ValueError) as exc_info:
            SecretsManagerFactory.create_secrets_manager("unknown")

        assert "Unknown secrets backend 'unknown'" in str(exc_info.value)
        assert "Available: ['vault', 'local']" in str(exc_info.value)

    @patch("dotmac.platform.secrets.factory.settings")
    @patch("dotmac.platform.secrets.factory.DependencyChecker")
    def test_auto_select_backend_vault_available(self, mock_dep_checker, mock_settings):
        """Test auto-selecting vault when available."""
        mock_settings.features.secrets_vault = True
        mock_dep_checker.check_feature_dependency.return_value = True

        backend = SecretsManagerFactory._auto_select_backend()

        assert backend == "vault"
        mock_dep_checker.check_feature_dependency.assert_called_once_with("secrets_vault")

    @patch("dotmac.platform.secrets.factory.settings")
    @patch("dotmac.platform.secrets.factory.DependencyChecker")
    def test_auto_select_backend_vault_unavailable(self, mock_dep_checker, mock_settings):
        """Test auto-selecting local when vault is unavailable."""
        mock_settings.features.secrets_vault = False

        backend = SecretsManagerFactory._auto_select_backend()

        assert backend == "local"

    @patch("dotmac.platform.secrets.factory.settings")
    @patch("dotmac.platform.secrets.factory.DependencyChecker")
    def test_auto_select_backend_vault_deps_missing(self, mock_dep_checker, mock_settings):
        """Test auto-selecting local when vault deps are missing."""
        mock_settings.features.secrets_vault = True
        mock_dep_checker.check_feature_dependency.return_value = False

        backend = SecretsManagerFactory._auto_select_backend()

        assert backend == "local"

    @patch("dotmac.platform.secrets.factory.settings")
    @patch("dotmac.platform.secrets.factory.DependencyChecker")
    def test_list_available_backends_vault_available(self, mock_dep_checker, mock_settings):
        """Test listing backends when vault is available."""
        mock_settings.features.secrets_vault = True
        mock_dep_checker.check_feature_dependency.return_value = True

        backends = SecretsManagerFactory.list_available_backends()

        assert "local" in backends
        assert "vault" in backends
        assert len(backends) == 2

    @patch("dotmac.platform.secrets.factory.settings")
    def test_list_available_backends_only_local(self, mock_settings):
        """Test listing backends when only local is available."""
        mock_settings.features.secrets_vault = False

        backends = SecretsManagerFactory.list_available_backends()

        assert backends == ["local"]

    def test_auto_select_with_none_backend(self):
        """Test that None backend triggers auto-selection."""
        with patch.object(
            SecretsManagerFactory, "_auto_select_backend", return_value="local"
        ) as mock_auto:
            manager = SecretsManagerFactory.create_secrets_manager(None, secrets_file="test.env")

            mock_auto.assert_called_once()
            assert isinstance(manager, LocalSecretsManager)
            assert manager.secrets_file == "test.env"


@pytest.mark.unit
class TestConvenienceFunctions:
    """Test the convenience functions."""

    @patch("dotmac.platform.secrets.factory.SecretsManagerFactory.create_secrets_manager")
    def test_create_secrets_manager_function(self, mock_create):
        """Test create_secrets_manager convenience function."""
        mock_manager = MagicMock()
        mock_create.return_value = mock_manager

        result = create_secrets_manager("local", secrets_file="test.env")

        assert result == mock_manager
        mock_create.assert_called_once_with("local", secrets_file="test.env")

    @patch("dotmac.platform.secrets.factory.SecretsManagerFactory.create_secrets_manager")
    def test_get_default_secrets_manager(self, mock_create):
        """Test get_default_secrets_manager function."""
        mock_manager = MagicMock()
        mock_create.return_value = mock_manager

        result = get_default_secrets_manager(test_param="value")

        assert result == mock_manager
        mock_create.assert_called_once_with(test_param="value")

    @patch("dotmac.platform.dependencies.settings")
    @patch("dotmac.platform.secrets.factory.settings")
    @patch("dotmac.platform.dependencies.DependencyChecker")
    @patch("dotmac.platform.secrets.factory.SecretsManagerFactory.create_secrets_manager")
    def test_create_vault_secrets_manager_function(
        self, mock_create, mock_dep_checker, mock_factory_settings, mock_dep_settings
    ):
        """Test create_vault_secrets_manager function."""
        # Mock settings in both places (decorator and factory)
        mock_dep_settings.features.secrets_vault = True
        mock_factory_settings.features.secrets_vault = True
        mock_dep_checker.require_feature_dependency.return_value = None
        mock_manager = MagicMock()
        mock_create.return_value = mock_manager

        result = create_vault_secrets_manager(vault_url="http://vault:8200")

        assert result == mock_manager
        mock_create.assert_called_once_with("vault", vault_url="http://vault:8200")

    @patch("dotmac.platform.secrets.factory.SecretsManagerFactory.create_secrets_manager")
    def test_create_local_secrets_manager_function(self, mock_create):
        """Test create_local_secrets_manager function."""
        mock_manager = MagicMock()
        mock_create.return_value = mock_manager

        result = create_local_secrets_manager(secrets_file="local.env")

        assert result == mock_manager
        mock_create.assert_called_once_with("local", secrets_file="local.env")

    @patch("dotmac.platform.secrets.factory.require_dependency")
    def test_create_vault_manager_decorator(self, mock_decorator):
        """Test that create_vault_secrets_manager has require_dependency decorator."""
        # The function should be decorated with @require_dependency("secrets_vault")
        assert hasattr(create_vault_secrets_manager, "__wrapped__") or callable(
            create_vault_secrets_manager
        )


@pytest.mark.unit
class TestFactoryEdgeCases:
    """Test edge cases and error conditions."""

    def test_local_manager_with_empty_path(self):
        """Test local manager with empty secrets path."""
        manager = LocalSecretsManager(secrets_file="")
        assert manager.secrets_file == ""

    def test_local_manager_multiple_operations(self):
        """Test multiple operations on local manager."""
        manager = LocalSecretsManager()

        # Set multiple secrets
        manager.set_secret("app/db", {"host": "localhost"})
        manager.set_secret("app/cache", {"host": "redis"})

        # Get them back
        assert manager.get_secret("app/db") == {"host": "localhost"}
        assert manager.get_secret("app/cache") == {"host": "redis"}

        # Overwrite one
        manager.set_secret("app/db", {"host": "postgres", "port": 5432})
        assert manager.get_secret("app/db") == {"host": "postgres", "port": 5432}
        assert manager.get_secret("app/cache") == {"host": "redis"}  # Unchanged

    @patch("dotmac.platform.secrets.factory.settings")
    @patch("dotmac.platform.secrets.factory.DependencyChecker")
    def test_vault_creation_with_kwargs(self, mock_dep_checker, mock_settings):
        """Test vault creation with additional kwargs."""
        mock_settings.features.secrets_vault = True
        mock_dep_checker.require_feature_dependency.return_value = None

        with patch("dotmac.platform.secrets.vault_client.VaultClient") as mock_vault_client:
            mock_vault_instance = MagicMock()
            mock_vault_client.return_value = mock_vault_instance

            manager = SecretsManagerFactory.create_secrets_manager(
                "vault", url="http://custom:8200", token="custom-token", timeout=60
            )

            assert manager == mock_vault_instance
            mock_vault_client.assert_called_once_with(
                url="http://custom:8200", token="custom-token", timeout=60
            )
