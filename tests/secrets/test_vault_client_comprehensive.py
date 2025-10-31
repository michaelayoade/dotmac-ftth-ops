"""
Comprehensive tests for secrets/vault_client.py to improve coverage from 31.25%.

Tests cover:
- VaultClient sync operations (get, set, list, delete secrets)
- AsyncVaultClient async operations
- KV v1 and KV v2 support
- Error handling and exceptions
- Authentication errors (403)
- Not found errors (404)
- Health checks
- Context manager usage
- Namespace support
"""

from unittest.mock import AsyncMock, Mock, patch

import httpx
import pytest

from dotmac.platform.secrets.vault_client import (
    AsyncVaultClient,
    VaultAuthenticationError,
    VaultClient,
    VaultError,
)


@pytest.mark.integration
class TestVaultExceptions:
    """Test Vault exception classes."""

    def test_vault_error_inheritance(self):
        """Test VaultError is an Exception."""
        error = VaultError("Test error")
        assert isinstance(error, Exception)
        assert str(error) == "Test error"

    def test_vault_authentication_error_inheritance(self):
        """Test VaultAuthenticationError inherits from VaultError."""
        error = VaultAuthenticationError("Auth failed")
        assert isinstance(error, VaultError)
        assert isinstance(error, Exception)
        assert str(error) == "Auth failed"


@pytest.mark.integration
class TestVaultClientInit:
    """Test VaultClient initialization."""

    def test_vault_client_init_minimal(self):
        """Test creating VaultClient with minimal parameters."""
        client = VaultClient(url="http://localhost:8200", token="test-token")

        assert client.url == "http://localhost:8200"
        assert client.token == "test-token"
        assert client.namespace is None
        assert client.mount_path == "secret"
        assert client.kv_version == 2
        assert client.timeout == 30.0

    def test_vault_client_init_full(self):
        """Test creating VaultClient with all parameters."""
        client = VaultClient(
            url="https://vault.example.com",
            token="s.test123",
            namespace="my-namespace",
            mount_path="kv",
            kv_version=1,
            timeout=60.0,
        )

        assert client.url == "https://vault.example.com"
        assert client.token == "s.test123"
        assert client.namespace == "my-namespace"
        assert client.mount_path == "kv"
        assert client.kv_version == 1
        assert client.timeout == 60.0

    def test_vault_client_init_headers(self):
        """Test VaultClient sets correct headers."""
        client = VaultClient(
            url="http://localhost:8200",
            token="test-token",
            namespace="test-ns",
        )

        assert client.client.headers["X-Vault-Token"] == "test-token"
        assert client.client.headers["X-Vault-Namespace"] == "test-ns"

    def test_vault_client_url_normalization(self):
        """Test URL trailing slash is removed."""
        client = VaultClient(url="http://localhost:8200/", token="token")
        assert client.url == "http://localhost:8200"


@pytest.mark.integration
class TestVaultClientSecretPath:
    """Test secret path building."""

    def test_get_secret_path_kv_v2(self):
        """Test path building for KV v2."""
        client = VaultClient(url="http://localhost:8200", token="token", kv_version=2)
        path = client._get_secret_path("database/credentials")
        assert path == "/v1/secret/data/database/credentials"

    def test_get_secret_path_kv_v1(self):
        """Test path building for KV v1."""
        client = VaultClient(url="http://localhost:8200", token="token", kv_version=1)
        path = client._get_secret_path("database/credentials")
        assert path == "/v1/secret/database/credentials"

    def test_get_secret_path_strips_slashes(self):
        """Test path strips leading/trailing slashes."""
        client = VaultClient(url="http://localhost:8200", token="token")
        path = client._get_secret_path("/database/credentials/")
        assert path == "/v1/secret/data/database/credentials"

    def test_get_secret_path_custom_mount(self):
        """Test path with custom mount path."""
        client = VaultClient(url="http://localhost:8200", token="token", mount_path="custom-kv")
        path = client._get_secret_path("app/config")
        assert path == "/v1/custom-kv/data/app/config"


@pytest.mark.integration
class TestVaultClientGetSecret:
    """Test VaultClient get_secret method."""

    @patch("httpx.Client")
    def test_get_secret_kv_v2_success(self, mock_client_class):
        """Test getting secret from KV v2."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {"data": {"username": "admin", "password": "secret123"}}
        }
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token", kv_version=2)
        client.client = mock_http_client

        result = client.get_secret("database/creds")

        assert result == {"username": "admin", "password": "secret123"}
        mock_http_client.get.assert_called_once_with("/v1/secret/data/database/creds")

    @patch("httpx.Client")
    def test_get_secret_kv_v1_success(self, mock_client_class):
        """Test getting secret from KV v1."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"key": "value"}}
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token", kv_version=1)
        client.client = mock_http_client

        result = client.get_secret("app/config")

        assert result == {"key": "value"}

    @patch("httpx.Client")
    def test_get_secret_not_found(self, mock_client_class):
        """Test getting non-existent secret returns empty dict."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 404
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = client.get_secret("nonexistent/path")

        assert result == {}

    @patch("httpx.Client")
    def test_get_secret_permission_denied(self, mock_client_class):
        """Test getting secret with permission denied."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 403
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        with pytest.raises(VaultAuthenticationError, match="Permission denied"):
            client.get_secret("forbidden/path")

    @patch("httpx.Client")
    def test_get_secret_http_error(self, mock_client_class):
        """Test getting secret with HTTP error."""
        mock_http_client = Mock()
        mock_http_client.get.side_effect = httpx.HTTPError("Connection failed")
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        with pytest.raises(VaultError, match="Failed to retrieve secret"):
            client.get_secret("database/creds")


@pytest.mark.integration
class TestVaultClientGetSecrets:
    """Test VaultClient get_secrets method."""

    @patch("httpx.Client")
    def test_get_secrets_multiple_paths(self, mock_client_class):
        """Test getting multiple secrets."""
        mock_http_client = Mock()

        def mock_get(path):
            mock_response = Mock()
            mock_response.status_code = 200
            if "db1" in path:
                mock_response.json.return_value = {"data": {"data": {"db": "credentials1"}}}
            elif "db2" in path:
                mock_response.json.return_value = {"data": {"data": {"db": "credentials2"}}}
            return mock_response

        mock_http_client.get.side_effect = mock_get
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = client.get_secrets(["database/db1", "database/db2"])

        assert result["database/db1"] == {"db": "credentials1"}
        assert result["database/db2"] == {"db": "credentials2"}

    @patch("httpx.Client")
    def test_get_secrets_with_errors(self, mock_client_class):
        """Test get_secrets continues on errors."""
        mock_http_client = Mock()

        def mock_get(path):
            mock_response = Mock()
            if "valid" in path:
                mock_response.status_code = 200
                mock_response.json.return_value = {"data": {"data": {"key": "value"}}}
            else:
                mock_response.status_code = 403
            return mock_response

        mock_http_client.get.side_effect = mock_get
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = client.get_secrets(["valid/path", "forbidden/path"])

        assert result["valid/path"] == {"key": "value"}
        assert result["forbidden/path"] == {}


@pytest.mark.integration
class TestVaultClientSetSecret:
    """Test VaultClient set_secret method."""

    @patch("httpx.Client")
    def test_set_secret_kv_v2(self, mock_client_class):
        """Test setting secret in KV v2."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_http_client.post.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token", kv_version=2)
        client.client = mock_http_client

        client.set_secret("app/config", {"key": "value"})

        mock_http_client.post.assert_called_once_with(
            "/v1/secret/data/app/config", json={"data": {"key": "value"}}
        )

    @patch("httpx.Client")
    def test_set_secret_kv_v1(self, mock_client_class):
        """Test setting secret in KV v1."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_http_client.post.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token", kv_version=1)
        client.client = mock_http_client

        client.set_secret("app/config", {"key": "value"})

        mock_http_client.post.assert_called_once_with(
            "/v1/secret/app/config", json={"key": "value"}
        )

    @patch("httpx.Client")
    def test_set_secret_permission_denied(self, mock_client_class):
        """Test setting secret with permission denied."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 403
        mock_http_client.post.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        with pytest.raises(VaultAuthenticationError, match="Permission denied"):
            client.set_secret("forbidden/path", {"key": "value"})


@pytest.mark.integration
class TestVaultClientListSecrets:
    """Test VaultClient list_secrets method."""

    @patch("httpx.Client")
    def test_list_secrets_kv_v2(self, mock_client_class):
        """Test listing secrets in KV v2."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"keys": ["secret1", "secret2/"]}}
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token", kv_version=2)
        client.client = mock_http_client

        result = client.list_secrets("app")

        assert result == ["secret1", "secret2/"]
        mock_http_client.get.assert_called_once_with("/v1/secret/metadata/app?list=true")

    @patch("httpx.Client")
    def test_list_secrets_not_found(self, mock_client_class):
        """Test listing non-existent path returns empty list."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 404
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = client.list_secrets("nonexistent")

        assert result == []


@pytest.mark.integration
class TestVaultClientDeleteSecret:
    """Test VaultClient delete_secret method."""

    @patch("httpx.Client")
    def test_delete_secret_kv_v2(self, mock_client_class):
        """Test deleting secret in KV v2."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 204
        mock_http_client.delete.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token", kv_version=2)
        client.client = mock_http_client

        client.delete_secret("app/old-config")

        mock_http_client.delete.assert_called_once_with("/v1/secret/data/app/old-config")

    @patch("httpx.Client")
    def test_delete_secret_permission_denied(self, mock_client_class):
        """Test deleting secret with permission denied."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 403
        mock_http_client.delete.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        with pytest.raises(VaultAuthenticationError, match="Permission denied"):
            client.delete_secret("forbidden/path")


@pytest.mark.integration
class TestVaultClientHealthCheck:
    """Test VaultClient health_check method."""

    @patch("httpx.Client")
    def test_health_check_healthy(self, mock_client_class):
        """Test health check with healthy Vault."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = client.health_check()

        assert result is True

    @patch("httpx.Client")
    def test_health_check_standby(self, mock_client_class):
        """Test health check with standby node."""
        mock_http_client = Mock()
        mock_response = Mock()
        mock_response.status_code = 429
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = client.health_check()

        assert result is True

    @patch("httpx.Client")
    def test_health_check_error(self, mock_client_class):
        """Test health check with connection error."""
        mock_http_client = Mock()
        mock_http_client.get.side_effect = Exception("Connection failed")
        mock_client_class.return_value = mock_http_client

        client = VaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = client.health_check()

        assert result is False


@pytest.mark.integration
class TestVaultClientContextManager:
    """Test VaultClient as context manager."""

    @patch("httpx.Client")
    def test_context_manager(self, mock_client_class):
        """Test using VaultClient as context manager."""
        mock_http_client = Mock()
        mock_http_client.close = Mock()
        mock_client_class.return_value = mock_http_client

        with VaultClient(url="http://localhost:8200", token="token") as client:
            assert client is not None

        mock_http_client.close.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.integration
class TestAsyncVaultClient:
    """Test AsyncVaultClient async operations."""

    async def test_async_vault_client_init(self):
        """Test AsyncVaultClient initialization."""
        client = AsyncVaultClient(
            url="http://localhost:8200",
            token="test-token",
            namespace="test-ns",
        )

        assert client.url == "http://localhost:8200"
        assert client.token == "test-token"
        assert client.namespace == "test-ns"

    @patch("httpx.AsyncClient")
    async def test_async_get_secret_kv_v2(self, mock_client_class):
        """Test async getting secret from KV v2."""
        mock_http_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"data": {"key": "value"}}}
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = AsyncVaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = await client.get_secret("app/config")

        assert result == {"key": "value"}

    @patch("httpx.AsyncClient")
    async def test_async_get_secrets_multiple(self, mock_client_class):
        """Test async getting multiple secrets."""
        mock_http_client = AsyncMock()

        async def mock_get(path):
            mock_response = Mock()
            mock_response.status_code = 200
            if "secret1" in path:
                mock_response.json.return_value = {"data": {"data": {"value": "1"}}}
            else:
                mock_response.json.return_value = {"data": {"data": {"value": "2"}}}
            return mock_response

        mock_http_client.get.side_effect = mock_get
        mock_client_class.return_value = mock_http_client

        client = AsyncVaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = await client.get_secrets(["app/secret1", "app/secret2"])

        assert result["app/secret1"] == {"value": "1"}
        assert result["app/secret2"] == {"value": "2"}

    @patch("httpx.AsyncClient")
    async def test_async_set_secret(self, mock_client_class):
        """Test async setting secret."""
        mock_http_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_http_client.post.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = AsyncVaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        await client.set_secret("app/config", {"key": "value"})

        mock_http_client.post.assert_called_once()

    @patch("httpx.AsyncClient")
    async def test_async_list_secrets(self, mock_client_class):
        """Test async listing secrets."""
        mock_http_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"keys": ["key1", "key2"]}}
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = AsyncVaultClient(url="http://localhost:8200", token="token")
        client.client = mock_http_client

        result = await client.list_secrets("app")

        assert result == ["key1", "key2"]

    @patch("httpx.AsyncClient")
    async def test_async_get_secret_metadata(self, mock_client_class):
        """Test async getting secret metadata."""
        mock_http_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "created_time": "2024-01-01T00:00:00Z",
                "current_version": 5,
            }
        }
        mock_http_client.get.return_value = mock_response
        mock_client_class.return_value = mock_http_client

        client = AsyncVaultClient(url="http://localhost:8200", token="token", kv_version=2)
        client.client = mock_http_client

        result = await client.get_secret_metadata("app/config")

        assert result["created_time"] == "2024-01-01T00:00:00Z"
        assert result["current_version"] == 5

    @patch("httpx.AsyncClient")
    async def test_async_context_manager(self, mock_client_class):
        """Test AsyncVaultClient as async context manager."""
        mock_http_client = AsyncMock()
        mock_http_client.aclose = AsyncMock()
        mock_client_class.return_value = mock_http_client

        async with AsyncVaultClient(url="http://localhost:8200", token="token") as client:
            assert client is not None

        mock_http_client.aclose.assert_called_once()
