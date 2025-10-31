"""
Comprehensive tests for secrets/vault_config.py to improve coverage from 23.53%.

Tests cover:
- VaultConnectionConfig model validation
- Configuration from environment variables
- Configuration from settings
- Configuration priority and fallbacks
- VaultConnectionManager sync and async clients
- AppRole authentication
- Kubernetes authentication
- Health check functionality
- Connection management and cleanup
"""

import os
from unittest.mock import Mock, mock_open, patch

import pytest

from dotmac.platform.secrets.vault_config import (
    VaultConnectionConfig,
    VaultConnectionManager,
    check_vault_health,
    get_async_vault_client,
    get_vault_client,
    get_vault_config,
    get_vault_config_from_env,
    get_vault_config_from_settings,
    get_vault_connection_manager,
)


@pytest.mark.unit
class TestVaultConnectionConfig:
    """Test VaultConnectionConfig Pydantic model."""

    def test_vault_connection_config_minimal(self):
        """Test creating config with minimal required fields."""
        config = VaultConnectionConfig(url="http://localhost:8200")

        assert config.url == "http://localhost:8200"
        assert config.token is None
        assert config.namespace is None
        assert config.mount_path == "secret"
        assert config.kv_version == 2
        assert config.timeout == 30.0
        assert config.verify_ssl is True

    def test_vault_connection_config_full(self):
        """Test creating config with all fields."""
        config = VaultConnectionConfig(
            url="https://vault.example.com",
            token="s.test123",
            namespace="my-namespace",
            mount_path="kv",
            kv_version=1,
            timeout=60.0,
            verify_ssl=False,
            role_id="test-role-id",
            secret_id="test-secret-id",
            kubernetes_role="k8s-role",
        )

        assert config.url == "https://vault.example.com"
        assert config.token == "s.test123"
        assert config.namespace == "my-namespace"
        assert config.mount_path == "kv"
        assert config.kv_version == 1
        assert config.timeout == 60.0
        assert config.verify_ssl is False
        assert config.role_id == "test-role-id"
        assert config.secret_id == "test-secret-id"
        assert config.kubernetes_role == "k8s-role"

    def test_vault_connection_config_defaults(self):
        """Test default values are applied correctly."""
        config = VaultConnectionConfig(url="http://test:8200")

        assert config.mount_path == "secret"
        assert config.kv_version == 2
        assert config.timeout == 30.0
        assert config.verify_ssl is True


@pytest.mark.unit
class TestGetVaultConfigFromEnv:
    """Test get_vault_config_from_env function."""

    @patch.dict(
        os.environ,
        {
            "VAULT_ADDR": "http://vault.example.com:8200",
            "VAULT_TOKEN": "s.test-token",
            "VAULT_NAMESPACE": "test-namespace",
            "VAULT_MOUNT_PATH": "custom-kv",
            "VAULT_KV_VERSION": "1",
        },
        clear=True,
    )
    def test_get_vault_config_from_env_all_vars(self):
        """Test loading config from all environment variables."""
        config = get_vault_config_from_env()

        assert config.url == "http://vault.example.com:8200"
        assert config.token == "s.test-token"
        assert config.namespace == "test-namespace"
        assert config.mount_path == "custom-kv"
        assert config.kv_version == 1

    @patch.dict(os.environ, {}, clear=True)
    def test_get_vault_config_from_env_defaults(self):
        """Test default values when env vars not set."""
        config = get_vault_config_from_env()

        assert config.url == "http://localhost:8200"
        assert config.token is None
        assert config.namespace is None
        assert config.mount_path == "secret"
        assert config.kv_version == 2
        assert config.verify_ssl is True

    @patch.dict(
        os.environ,
        {
            "VAULT_ADDR": "https://secure-vault.com",
            "VAULT_SKIP_VERIFY": "1",
        },
        clear=True,
    )
    def test_get_vault_config_from_env_skip_verify(self):
        """Test VAULT_SKIP_VERIFY disables SSL verification."""
        config = get_vault_config_from_env()

        assert config.url == "https://secure-vault.com"
        assert config.verify_ssl is False

    @patch.dict(
        os.environ,
        {
            "VAULT_ADDR": "http://localhost:8200",
            "VAULT_ROLE_ID": "my-role-id",
            "VAULT_SECRET_ID": "my-secret-id",
            "VAULT_KUBERNETES_ROLE": "k8s-auth-role",
        },
        clear=True,
    )
    def test_get_vault_config_from_env_auth_methods(self):
        """Test loading auth method credentials from env."""
        config = get_vault_config_from_env()

        assert config.role_id == "my-role-id"
        assert config.secret_id == "my-secret-id"
        assert config.kubernetes_role == "k8s-auth-role"


@pytest.mark.unit
class TestGetVaultConfigFromSettings:
    """Test get_vault_config_from_settings function."""

    @patch("dotmac.platform.secrets.vault_config.get_settings")
    def test_get_vault_config_from_settings_success(self, mock_get_settings):
        """Test loading config from settings when Vault is enabled."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://settings-vault:8200"
        mock_settings.vault.token = "s.settings-token"
        mock_settings.vault.namespace = "settings-namespace"
        mock_settings.vault.mount_path = "settings-kv"
        mock_settings.vault.kv_version = 2
        mock_get_settings.return_value = mock_settings

        config = get_vault_config_from_settings()

        assert config.url == "http://settings-vault:8200"
        assert config.token == "s.settings-token"
        assert config.namespace == "settings-namespace"
        assert config.mount_path == "settings-kv"
        assert config.kv_version == 2

    @patch("dotmac.platform.secrets.vault_config.get_settings")
    def test_get_vault_config_from_settings_disabled(self, mock_get_settings):
        """Test error when Vault is not enabled in settings."""
        mock_settings = Mock()
        mock_settings.vault.enabled = False
        mock_get_settings.return_value = mock_settings

        with pytest.raises(ValueError, match="Vault is not enabled in settings"):
            get_vault_config_from_settings()


@pytest.mark.unit
class TestGetVaultConfig:
    """Test get_vault_config function (priority resolution)."""

    @patch.dict(os.environ, {"VAULT_ADDR": "http://env-vault:8200"}, clear=True)
    @patch("dotmac.platform.secrets.vault_config.get_settings")
    def test_get_vault_config_env_priority(self, mock_get_settings):
        """Test environment variables take priority over settings."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://settings-vault:8200"
        mock_get_settings.return_value = mock_settings

        config = get_vault_config()

        # Should use env config
        assert config.url == "http://env-vault:8200"

    @patch.dict(os.environ, {}, clear=True)
    @patch("dotmac.platform.secrets.vault_config.get_settings")
    def test_get_vault_config_settings_priority(self, mock_get_settings):
        """Test settings used when env vars not set."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://settings-vault:8200"
        mock_settings.vault.token = "s.settings-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        mock_get_settings.return_value = mock_settings

        config = get_vault_config()

        assert config.url == "http://settings-vault:8200"
        assert config.token == "s.settings-token"

    @patch.dict(os.environ, {}, clear=True)
    @patch("dotmac.platform.secrets.vault_config.get_settings")
    def test_get_vault_config_defaults(self, mock_get_settings):
        """Test default config when neither env nor settings available."""
        mock_settings = Mock()
        mock_settings.vault.enabled = False
        mock_get_settings.return_value = mock_settings

        config = get_vault_config()

        # Should use development defaults
        assert config.url == "http://localhost:8200"
        assert config.token == "root-token"
        assert config.mount_path == "secret"
        assert config.kv_version == 2


@pytest.mark.unit
class TestVaultConnectionManager:
    """Test VaultConnectionManager class."""

    def test_connection_manager_init_with_config(self):
        """Test initializing connection manager with custom config."""
        config = VaultConnectionConfig(url="http://test:8200", token="test-token")
        manager = VaultConnectionManager(config=config)

        assert manager.config == config
        assert manager._client is None
        assert manager._async_client is None

    def test_connection_manager_init_default_config(self):
        """Test initializing connection manager with default config."""
        with patch("dotmac.platform.secrets.vault_config.get_vault_config") as mock_get:
            mock_get.return_value = VaultConnectionConfig(url="http://default:8200")
            manager = VaultConnectionManager()

            assert manager.config.url == "http://default:8200"

    @patch("dotmac.platform.secrets.vault_client.VaultClient")
    def test_get_sync_client_creates_client(self, mock_vault_client):
        """Test get_sync_client creates and caches client."""
        config = VaultConnectionConfig(
            url="http://test:8200",
            token="test-token",
            namespace="test-ns",
            mount_path="kv",
            kv_version=2,
            timeout=30.0,
        )
        manager = VaultConnectionManager(config=config)

        mock_client = Mock()
        mock_vault_client.return_value = mock_client

        client1 = manager.get_sync_client()
        client2 = manager.get_sync_client()

        # Should create client once and cache
        assert client1 is client2
        mock_vault_client.assert_called_once_with(
            url="http://test:8200",
            token="test-token",
            namespace="test-ns",
            mount_path="kv",
            kv_version=2,
            timeout=30.0,
        )

    @patch("dotmac.platform.secrets.vault_client.AsyncVaultClient")
    def test_get_async_client_creates_client(self, mock_async_vault_client):
        """Test get_async_client creates and caches client."""
        config = VaultConnectionConfig(url="http://test:8200", token="test-token")
        manager = VaultConnectionManager(config=config)

        mock_client = Mock()
        mock_async_vault_client.return_value = mock_client

        client1 = manager.get_async_client()
        client2 = manager.get_async_client()

        # Should create client once and cache
        assert client1 is client2
        mock_async_vault_client.assert_called_once()

    @patch("dotmac.platform.secrets.vault_client.VaultClient")
    def test_authenticate_approle(self, mock_vault_client):
        """Test AppRole authentication."""
        config = VaultConnectionConfig(
            url="http://test:8200",
            role_id="test-role",
            secret_id="test-secret",
        )
        manager = VaultConnectionManager(config=config)

        mock_client = Mock()
        mock_response = Mock()
        mock_response.json.return_value = {"auth": {"client_token": "s.new-token"}}
        mock_response.raise_for_status = Mock()
        mock_client.client.post.return_value = mock_response
        mock_client.client.headers = {}
        mock_vault_client.return_value = mock_client

        manager.get_sync_client()

        # Should have called AppRole login
        mock_client.client.post.assert_called_once_with(
            "/v1/auth/approle/login",
            json={"role_id": "test-role", "secret_id": "test-secret"},
        )

        # Should have updated token
        assert mock_client.token == "s.new-token"
        assert mock_client.client.headers["X-Vault-Token"] == "s.new-token"

    @patch("dotmac.platform.secrets.vault_client.VaultClient")
    @patch("builtins.open", mock_open(read_data="k8s-jwt-token"))
    def test_authenticate_kubernetes(self, mock_vault_client):
        """Test Kubernetes authentication."""
        config = VaultConnectionConfig(url="http://test:8200", kubernetes_role="test-k8s-role")
        manager = VaultConnectionManager(config=config)

        mock_client = Mock()
        mock_response = Mock()
        mock_response.json.return_value = {"auth": {"client_token": "s.k8s-token"}}
        mock_response.raise_for_status = Mock()
        mock_client.client.post.return_value = mock_response
        mock_client.client.headers = {}
        mock_vault_client.return_value = mock_client

        manager.get_sync_client()

        # Should have called Kubernetes login
        mock_client.client.post.assert_called_once_with(
            "/v1/auth/kubernetes/login",
            json={"role": "test-k8s-role", "jwt": "k8s-jwt-token"},
        )

    def test_close_sync_client(self):
        """Test closing sync client."""
        config = VaultConnectionConfig(url="http://test:8200")
        manager = VaultConnectionManager(config=config)

        mock_client = Mock()
        mock_client.close = Mock()
        manager._client = mock_client

        manager.close()

        mock_client.close.assert_called_once()
        assert manager._client is None

    def test_close_async_client(self):
        """Test closing async client."""
        config = VaultConnectionConfig(url="http://test:8200")
        manager = VaultConnectionManager(config=config)

        mock_async_client = Mock()
        mock_async_client.close = Mock()
        manager._async_client = mock_async_client

        manager.close()

        mock_async_client.close.assert_called_once()
        assert manager._async_client is None


@pytest.mark.unit
class TestGlobalFunctions:
    """Test global helper functions."""

    def test_get_vault_connection_manager_singleton(self):
        """Test get_vault_connection_manager returns singleton."""
        # Reset global state
        import dotmac.platform.secrets.vault_config as vault_config_module

        vault_config_module._connection_manager = None

        manager1 = get_vault_connection_manager()
        manager2 = get_vault_connection_manager()

        assert manager1 is manager2

    @patch("dotmac.platform.secrets.vault_config.get_vault_connection_manager")
    def test_get_vault_client_function(self, mock_get_manager):
        """Test get_vault_client convenience function."""
        mock_manager = Mock()
        mock_client = Mock()
        mock_manager.get_sync_client.return_value = mock_client
        mock_get_manager.return_value = mock_manager

        client = get_vault_client()

        assert client == mock_client
        mock_manager.get_sync_client.assert_called_once()

    @patch("dotmac.platform.secrets.vault_config.get_vault_connection_manager")
    def test_get_async_vault_client_function(self, mock_get_manager):
        """Test get_async_vault_client convenience function."""
        mock_manager = Mock()
        mock_async_client = Mock()
        mock_manager.get_async_client.return_value = mock_async_client
        mock_get_manager.return_value = mock_manager

        client = get_async_vault_client()

        assert client == mock_async_client
        mock_manager.get_async_client.assert_called_once()


@pytest.mark.unit
class TestVaultConnectionManagerEdgeCases:
    """Test edge cases and error paths for VaultConnectionManager."""

    def test_authenticate_approle_no_client(self):
        """Test _authenticate_approle when client is None."""
        config = VaultConnectionConfig(
            url="http://test:8200", role_id="test-role", secret_id="test-secret"
        )
        manager = VaultConnectionManager(config=config)

        # Call without creating client first - should return early
        manager._authenticate_approle()  # Should not raise

    @patch("dotmac.platform.secrets.vault_client.VaultClient")
    def test_authenticate_approle_failure(self, mock_vault_client):
        """Test AppRole authentication failure."""
        config = VaultConnectionConfig(
            url="http://test:8200", role_id="test-role", secret_id="test-secret"
        )
        manager = VaultConnectionManager(config=config)

        mock_client = Mock()
        mock_client.client.post.side_effect = Exception("Auth failed")
        mock_vault_client.return_value = mock_client

        with pytest.raises(Exception, match="Auth failed"):
            manager.get_sync_client()

    def test_authenticate_kubernetes_no_client(self):
        """Test _authenticate_kubernetes when client is None."""
        config = VaultConnectionConfig(url="http://test:8200", kubernetes_role="test-k8s-role")
        manager = VaultConnectionManager(config=config)

        # Call without creating client first - should return early
        manager._authenticate_kubernetes()  # Should not raise

    @patch("dotmac.platform.secrets.vault_client.VaultClient")
    def test_authenticate_kubernetes_token_not_found(self, mock_vault_client):
        """Test Kubernetes authentication when service account token is missing."""
        config = VaultConnectionConfig(url="http://test:8200", kubernetes_role="test-k8s-role")
        manager = VaultConnectionManager(config=config)

        mock_client = Mock()
        mock_vault_client.return_value = mock_client

        # Mock file not found
        with patch("builtins.open", side_effect=FileNotFoundError("Token file not found")):
            with pytest.raises(FileNotFoundError):
                manager.get_sync_client()

    @patch("dotmac.platform.secrets.vault_client.VaultClient")
    @patch("builtins.open", mock_open(read_data="k8s-jwt-token"))
    def test_authenticate_kubernetes_auth_failure(self, mock_vault_client):
        """Test Kubernetes authentication failure."""
        config = VaultConnectionConfig(url="http://test:8200", kubernetes_role="test-k8s-role")
        manager = VaultConnectionManager(config=config)

        mock_client = Mock()
        mock_client.client.post.side_effect = Exception("K8s auth failed")
        mock_vault_client.return_value = mock_client

        with pytest.raises(Exception, match="K8s auth failed"):
            manager.get_sync_client()


@pytest.mark.unit
class TestCheckVaultHealth:
    """Test check_vault_health function."""

    @patch("dotmac.platform.secrets.vault_config.get_vault_client")
    def test_check_vault_health_success(self, mock_get_client):
        """Test health check with healthy Vault."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sealed": False,
            "initialized": True,
            "version": "1.12.0",
        }
        mock_client.client.get.return_value = mock_response
        mock_get_client.return_value = mock_client

        result = check_vault_health()

        assert result["healthy"] is True
        assert result["status_code"] == 200
        assert result["sealed"] is False
        assert result["initialized"] is True
        assert result["version"] == "1.12.0"

    @patch("dotmac.platform.secrets.vault_config.get_vault_client")
    def test_check_vault_health_sealed(self, mock_get_client):
        """Test health check with sealed Vault."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 503
        mock_response.json.return_value = {
            "sealed": True,
            "initialized": True,
            "version": "1.12.0",
        }
        mock_client.client.get.return_value = mock_response
        mock_get_client.return_value = mock_client

        result = check_vault_health()

        assert result["healthy"] is False
        assert result["status_code"] == 503
        assert result["sealed"] is True

    @patch("dotmac.platform.secrets.vault_config.get_vault_client")
    def test_check_vault_health_error(self, mock_get_client):
        """Test health check when connection fails."""
        mock_client = Mock()
        mock_client.client.get.side_effect = Exception("Connection refused")
        mock_get_client.return_value = mock_client

        result = check_vault_health()

        assert result["healthy"] is False
        assert "error" in result
        assert "Connection refused" in result["error"]
