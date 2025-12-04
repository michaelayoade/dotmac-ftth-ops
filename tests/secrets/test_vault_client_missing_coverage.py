"""
Tests for missing coverage in vault_client.py.

Focuses on error paths and edge cases not covered by existing tests.
"""

from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from dotmac.platform.secrets.vault_client import (
    AsyncVaultClient,
    VaultAuthenticationError,
    VaultClient,
    VaultError,
)


@pytest.mark.unit
class TestVaultClientErrorHandling:
    """Test error handling paths in VaultClient."""

    @pytest.fixture
    def mock_httpx_client(self):
        """Create a mock httpx client."""
        return Mock(spec=httpx.Client)

    def test_set_secret_http_error(self, mock_httpx_client):
        """Test set_secret handles HTTPError."""
        mock_httpx_client.post.side_effect = httpx.HTTPError("Connection failed")

        client = VaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_httpx_client

        with pytest.raises(VaultError) as exc_info:
            client.set_secret("test/path", {"key": "value"})

        assert "Failed to store secret" in str(exc_info.value)

    def test_list_secrets_kv_v1(self, mock_httpx_client):
        """Test list_secrets with KV v1."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"keys": ["secret1", "secret2"]}}
        mock_httpx_client.get.return_value = mock_response

        client = VaultClient(url="http://vault:8200", token="test-token", kv_version=1)
        client.client = mock_httpx_client

        keys = client.list_secrets("test/path")

        assert keys == ["secret1", "secret2"]
        # Verify it used the v1 path
        call_args = mock_httpx_client.get.call_args[0][0]
        assert "/metadata/" not in call_args

    def test_list_secrets_http_error(self, mock_httpx_client):
        """Test list_secrets handles HTTPError."""
        mock_httpx_client.get.side_effect = httpx.HTTPError("Connection failed")

        client = VaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_httpx_client

        with pytest.raises(VaultError) as exc_info:
            client.list_secrets("test/path")

        assert "Failed to list secrets" in str(exc_info.value)

    def test_delete_secret_kv_v1(self, mock_httpx_client):
        """Test delete_secret with KV v1."""
        mock_response = Mock()
        mock_response.status_code = 204
        mock_httpx_client.delete.return_value = mock_response

        client = VaultClient(url="http://vault:8200", token="test-token", kv_version=1)
        client.client = mock_httpx_client

        client.delete_secret("test/path")

        # Verify it used the v1 path
        call_args = mock_httpx_client.delete.call_args[0][0]
        assert "/metadata/" not in call_args

    def test_delete_secret_non_standard_status(self, mock_httpx_client):
        """Test delete_secret with non-standard status code."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=Mock(), response=mock_response
        )
        mock_httpx_client.delete.return_value = mock_response

        client = VaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_httpx_client

        with pytest.raises(VaultError) as exc_info:
            client.delete_secret("test/path")

        assert "Failed to delete secret" in str(exc_info.value)

    def test_delete_secret_http_error(self, mock_httpx_client):
        """Test delete_secret handles HTTPError."""
        mock_httpx_client.delete.side_effect = httpx.HTTPError("Connection failed")

        client = VaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_httpx_client

        with pytest.raises(VaultError) as exc_info:
            client.delete_secret("test/path")

        assert "Failed to delete secret" in str(exc_info.value)


@pytest.mark.unit
class TestAsyncVaultClientErrorHandling:
    """Test error handling paths in AsyncVaultClient."""

    @pytest.fixture
    def mock_async_client(self):
        """Create a mock async httpx client."""
        return AsyncMock(spec=httpx.AsyncClient)

    @pytest.mark.asyncio
    async def test_get_secret_permission_denied(self, mock_async_client):
        """Test async get_secret handles 403 permission denied."""
        mock_response = Mock()
        mock_response.status_code = 403
        mock_async_client.get.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        with pytest.raises(VaultAuthenticationError) as exc_info:
            await client.get_secret("test/path")

        assert "Permission denied" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_secret_not_found(self, mock_async_client):
        """Test async get_secret handles 404 not found."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_async_client.get.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        result = await client.get_secret("test/path")

        assert result == {}

    @pytest.mark.asyncio
    async def test_get_secret_kv_v1(self, mock_async_client):
        """Test async get_secret with KV v1."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"username": "admin", "password": "secret"}}
        mock_async_client.get.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token", kv_version=1)
        client.client = mock_async_client

        result = await client.get_secret("test/path")

        assert result == {"username": "admin", "password": "secret"}

    @pytest.mark.asyncio
    async def test_get_secret_http_error(self, mock_async_client):
        """Test async get_secret handles HTTPError."""
        mock_async_client.get.side_effect = httpx.HTTPError("Connection failed")

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        with pytest.raises(VaultError) as exc_info:
            await client.get_secret("test/path")

        assert "Failed to retrieve secret" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_secrets_with_exception(self, mock_async_client):
        """Test async get_secrets handles exceptions for individual paths."""
        # First call succeeds, second fails
        mock_async_client.get.side_effect = [
            Mock(status_code=200, json=lambda: {"data": {"data": {"key": "value1"}}}),
            httpx.HTTPError("Connection failed"),
        ]

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        result = await client.get_secrets(["path1", "path2"])

        assert result["path1"] == {"key": "value1"}
        assert result["path2"] == {}  # Failed path returns empty dict

    @pytest.mark.asyncio
    async def test_set_secret_permission_denied(self, mock_async_client):
        """Test async set_secret handles 403 permission denied."""
        mock_response = Mock()
        mock_response.status_code = 403
        mock_async_client.post.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        with pytest.raises(VaultAuthenticationError) as exc_info:
            await client.set_secret("test/path", {"key": "value"})

        assert "Permission denied" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_set_secret_kv_v1(self, mock_async_client):
        """Test async set_secret with KV v1."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_async_client.post.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token", kv_version=1)
        client.client = mock_async_client

        await client.set_secret("test/path", {"key": "value"})

        # Verify payload was not wrapped for v1
        call_args = mock_async_client.post.call_args
        assert call_args[1]["json"] == {"key": "value"}

    @pytest.mark.asyncio
    async def test_set_secret_http_error(self, mock_async_client):
        """Test async set_secret handles HTTPError."""
        mock_async_client.post.side_effect = httpx.HTTPError("Connection failed")

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        with pytest.raises(VaultError) as exc_info:
            await client.set_secret("test/path", {"key": "value"})

        assert "Failed to store secret" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_close_client(self, mock_async_client):
        """Test closing async client."""
        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        await client.close()

        mock_async_client.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test async context manager usage."""
        async with AsyncVaultClient(url="http://vault:8200", token="test-token") as client:
            assert client is not None
            assert isinstance(client, AsyncVaultClient)

    @pytest.mark.asyncio
    async def test_aenter_aexit(self, mock_async_client):
        """Test __aenter__ and __aexit__ methods."""
        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        # Test __aenter__
        result = await client.__aenter__()
        assert result is client

        # Test __aexit__
        await client.__aexit__(None, None, None)
        mock_async_client.aclose.assert_called_once()


@pytest.mark.unit
class TestVaultClientNamespace:
    """Test namespace handling in VaultClient."""

    def test_client_with_namespace(self):
        """Test client initialization with namespace."""
        client = VaultClient(url="http://vault:8200", token="test-token", namespace="my-namespace")

        assert client.namespace == "my-namespace"
        assert "X-Vault-Namespace" in client.client.headers
        assert client.client.headers["X-Vault-Namespace"] == "my-namespace"

    def test_async_client_with_namespace(self):
        """Test async client initialization with namespace."""
        client = AsyncVaultClient(
            url="http://vault:8200", token="test-token", namespace="my-namespace"
        )

        assert client.namespace == "my-namespace"
        assert "X-Vault-Namespace" in client.client.headers
        assert client.client.headers["X-Vault-Namespace"] == "my-namespace"


@pytest.mark.unit
class TestVaultClientKVVersion:
    """Test KV version handling."""

    @pytest.fixture
    def mock_client(self):
        return Mock(spec=httpx.Client)

    def test_get_secret_path_kv_v1(self):
        """Test _get_secret_path with KV v1."""
        client = VaultClient(url="http://vault:8200", token="test-token", kv_version=1)

        path = client._get_secret_path("test/secret")

        assert path == "/v1/secret/test/secret"
        assert "/data/" not in path

    def test_get_secret_path_kv_v2(self):
        """Test _get_secret_path with KV v2."""
        client = VaultClient(url="http://vault:8200", token="test-token", kv_version=2)

        path = client._get_secret_path("test/secret")

        assert path == "/v1/secret/data/test/secret"
        assert "/data/" in path


@pytest.mark.unit
class TestAsyncVaultClientListSecretsAdvanced:
    """Test advanced async list_secrets scenarios."""

    @pytest.fixture
    def mock_async_client(self):
        return AsyncMock(spec=httpx.AsyncClient)

    @pytest.mark.asyncio
    async def test_list_secrets_kv_v1(self, mock_async_client):
        """Test async list_secrets with KV v1."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"keys": ["secret1", "secret2"]}}
        mock_async_client.get.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token", kv_version=1)
        client.client = mock_async_client

        keys = await client.list_secrets("test/path")

        assert keys == ["secret1", "secret2"]
        # Verify it used the v1 path
        call_args = mock_async_client.get.call_args[0][0]
        assert "/metadata/" not in call_args

    @pytest.mark.asyncio
    async def test_list_secrets_not_found(self, mock_async_client):
        """Test async list_secrets handles 404 not found."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_async_client.get.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        keys = await client.list_secrets("test/path")

        assert keys == []

    @pytest.mark.asyncio
    async def test_list_secrets_http_error(self, mock_async_client):
        """Test async list_secrets handles HTTPError."""
        mock_async_client.get.side_effect = httpx.HTTPError("Connection failed")

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        with pytest.raises(VaultError) as exc_info:
            await client.list_secrets("test/path")

        assert "Failed to list secrets" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_secret_metadata_http_error(self, mock_async_client):
        """Test async get_secret_metadata handles HTTPError."""
        mock_async_client.get.side_effect = httpx.HTTPError("Connection failed")

        client = AsyncVaultClient(url="http://vault:8200", token="test-token", kv_version=2)
        client.client = mock_async_client

        with pytest.raises(VaultError) as exc_info:
            await client.get_secret_metadata("test/path")

        assert "Failed to get metadata" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_secrets_with_metadata_error(self, mock_async_client):
        """Test async list_secrets_with_metadata handles metadata fetch errors gracefully."""
        # First call succeeds for list, second call (metadata) fails
        mock_list_response = Mock()
        mock_list_response.status_code = 200
        mock_list_response.json.return_value = {"data": {"keys": ["secret1"]}}

        mock_metadata_response = Mock()
        mock_metadata_response.status_code = 500
        mock_metadata_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=Mock(), response=mock_metadata_response
        )

        mock_async_client.get.side_effect = [
            mock_list_response,
            mock_metadata_response,
        ]

        client = AsyncVaultClient(url="http://vault:8200", token="test-token", kv_version=2)
        client.client = mock_async_client

        # Should not raise - should handle metadata errors gracefully
        result = await client.list_secrets_with_metadata("test/path")

        # Should have one secret with metadata error
        assert len(result) == 1
        assert result[0]["path"] == "test/path/secret1"
        assert "metadata_error" in result[0]["metadata"]  # Error stored in metadata

    @pytest.mark.asyncio
    async def test_delete_secret_kv_v1(self, mock_async_client):
        """Test async delete_secret with KV v1."""
        mock_response = Mock()
        mock_response.status_code = 204
        mock_async_client.delete.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token", kv_version=1)
        client.client = mock_async_client

        await client.delete_secret("test/path")

        # Verify it used the v1 path
        call_args = mock_async_client.delete.call_args[0][0]
        assert "/metadata/" not in call_args

    @pytest.mark.asyncio
    async def test_delete_secret_permission_denied(self, mock_async_client):
        """Test async delete_secret handles 403 permission denied."""
        mock_response = Mock()
        mock_response.status_code = 403
        mock_async_client.delete.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        with pytest.raises(VaultAuthenticationError) as exc_info:
            await client.delete_secret("test/path")

        assert "Permission denied" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_secret_non_standard_status(self, mock_async_client):
        """Test async delete_secret with non-standard status code."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=Mock(), response=mock_response
        )
        mock_async_client.delete.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        with pytest.raises(VaultError) as exc_info:
            await client.delete_secret("test/path")

        assert "Failed to delete secret" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_secret_http_error(self, mock_async_client):
        """Test async delete_secret handles HTTPError."""
        mock_async_client.delete.side_effect = httpx.HTTPError("Connection failed")

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        with pytest.raises(VaultError) as exc_info:
            await client.delete_secret("test/path")

        assert "Failed to delete secret" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_health_check_success(self, mock_async_client):
        """Test async health_check success."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_async_client.get.return_value = mock_response

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        result = await client.health_check()

        assert result is True

    @pytest.mark.asyncio
    async def test_health_check_exception(self, mock_async_client):
        """Test async health_check handles exceptions."""
        mock_async_client.get.side_effect = Exception("Connection failed")

        client = AsyncVaultClient(url="http://vault:8200", token="test-token")
        client.client = mock_async_client

        result = await client.health_check()

        assert result is False
