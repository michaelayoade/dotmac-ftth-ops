"""Tests for secrets inventory functionality."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from dotmac.platform.secrets.api import SecretListResponse, list_secrets
from dotmac.platform.secrets.vault_client import AsyncVaultClient, VaultError

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestVaultClientInventory:
    """Test AsyncVaultClient inventory methods."""

    @pytest.fixture
    def vault_client(self):
        """Create async vault client with mocked HTTP client."""
        client = AsyncVaultClient(
            url="http://localhost:8200", token="test-token", mount_path="secret", kv_version=2
        )
        return client

    @pytest.mark.asyncio
    async def test_get_secret_metadata_success(self, vault_client):
        """Test successful metadata retrieval."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "created_time": "2023-01-01T00:00:00Z",
                "updated_time": "2023-01-02T00:00:00Z",
                "current_version": 2,
                "versions": {
                    "1": {"created_time": "2023-01-01T00:00:00Z"},
                    "2": {"created_time": "2023-01-02T00:00:00Z"},
                },
                "cas_required": False,
                "delete_version_after": None,
            }
        }

        with patch.object(vault_client.client, "get", return_value=mock_response):
            metadata = await vault_client.get_secret_metadata("test/secret")

            assert metadata["created_time"] == "2023-01-01T00:00:00Z"
            assert metadata["current_version"] == 2
            assert metadata["cas_required"] is False

    @pytest.mark.asyncio
    async def test_get_secret_metadata_not_found(self, vault_client):
        """Test metadata retrieval for non-existent secret."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch.object(vault_client.client, "get", return_value=mock_response):
            metadata = await vault_client.get_secret_metadata("nonexistent")

            assert metadata["error"] == "Secret not found"

    @pytest.mark.asyncio
    async def test_get_secret_metadata_kv_v1(self, vault_client):
        """Test metadata retrieval with KV v1 (not supported)."""
        vault_client.kv_version = 1

        metadata = await vault_client.get_secret_metadata("test/secret")

        assert metadata["error"] == "Metadata only available in KV v2"

    @pytest.mark.asyncio
    async def test_list_secrets_with_metadata_success(self, vault_client):
        """Test listing secrets with metadata."""
        # Mock list_secrets response
        with patch.object(vault_client, "list_secrets", return_value=["secret1", "secret2"]):
            # Mock metadata responses
            metadata_1 = {
                "created_time": "2023-01-01T00:00:00Z",
                "updated_time": "2023-01-01T12:00:00Z",
                "current_version": 1,
                "cas_required": False,
            }
            metadata_2 = {
                "created_time": "2023-01-02T00:00:00Z",
                "updated_time": "2023-01-02T06:00:00Z",
                "current_version": 3,
                "cas_required": True,
            }

            with patch.object(
                vault_client, "get_secret_metadata", side_effect=[metadata_1, metadata_2]
            ):
                secrets = await vault_client.list_secrets_with_metadata("app/")

                assert len(secrets) == 2

                # Check first secret
                assert secrets[0]["path"] == "app/secret1"
                assert secrets[0]["created_time"] == "2023-01-01T00:00:00Z"
                assert secrets[0]["version"] == 1
                assert secrets[0]["metadata"]["cas_required"] is False

                # Check second secret
                assert secrets[1]["path"] == "app/secret2"
                assert secrets[1]["version"] == 3
                assert secrets[1]["metadata"]["cas_required"] is True

    @pytest.mark.asyncio
    async def test_list_secrets_with_metadata_error_handling(self, vault_client):
        """Test error handling when getting metadata."""
        with patch.object(vault_client, "list_secrets", return_value=["secret1", "secret2"]):
            # First metadata succeeds, second fails
            with patch.object(
                vault_client,
                "get_secret_metadata",
                side_effect=[
                    {"created_time": "2023-01-01T00:00:00Z", "current_version": 1},
                    Exception("Connection timeout"),
                ],
            ):
                secrets = await vault_client.list_secrets_with_metadata("app/")

                assert len(secrets) == 2

                # First secret has metadata
                assert secrets[0]["version"] == 1

                # Second secret has error in metadata
                assert "metadata_error" in secrets[1]["metadata"]
                assert "Connection timeout" in secrets[1]["metadata"]["metadata_error"]

    @pytest.mark.asyncio
    async def test_list_secrets_with_metadata_empty_path(self, vault_client):
        """Test listing secrets from root path."""
        with patch.object(vault_client, "list_secrets", return_value=["root-secret"]):
            with patch.object(
                vault_client, "get_secret_metadata", return_value={"current_version": 1}
            ):
                secrets = await vault_client.list_secrets_with_metadata("")

                assert len(secrets) == 1
                assert secrets[0]["path"] == "root-secret"


@pytest.mark.unit
class TestSecretsInventoryAPI:
    """Test the secrets inventory API endpoint."""

    @pytest.fixture
    def mock_vault_client(self):
        """Mock vault client."""
        mock_client = AsyncMock()
        return mock_client

    @pytest.fixture
    def mock_user(self):
        """Mock platform admin user."""
        from dotmac.platform.auth.core import UserInfo

        return UserInfo(
            user_id="test-user",
            email="test@example.com",
            tenant_id="test-tenant",
            roles=["platform_admin"],
            permissions=["secrets:read", "secrets:write"],
        )

    @pytest.mark.asyncio
    async def test_list_secrets_api_success(self, mock_vault_client, mock_user):
        """Test successful secrets listing via API."""
        mock_vault_client.list_secrets_with_metadata.return_value = [
            {
                "path": "app/database",
                "created_time": "2023-01-01T00:00:00Z",
                "updated_time": "2023-01-01T12:00:00Z",
                "version": 2,
                "metadata": {
                    "source": "vault",
                    "versions": {"1": {}, "2": {}},
                    "cas_required": False,
                },
            },
            {
                "path": "app/api-key",
                "created_time": "2023-01-02T00:00:00Z",
                "updated_time": "2023-01-02T00:00:00Z",
                "version": 1,
                "metadata": {"source": "vault", "versions": {"1": {}}, "cas_required": True},
            },
        ]

        response = await list_secrets(
            vault=mock_vault_client, current_user=mock_user, prefix="app/"
        )

        assert isinstance(response, SecretListResponse)
        assert len(response.secrets) == 2

        # Check first secret
        secret1 = response.secrets[0]
        assert secret1.path == "app/database"
        assert secret1.version == 2
        assert secret1.metadata["cas_required"] is False

        # Check second secret
        secret2 = response.secrets[1]
        assert secret2.path == "app/api-key"
        assert secret2.version == 1
        assert secret2.metadata["cas_required"] is True

        mock_vault_client.list_secrets_with_metadata.assert_called_once_with("app/")

    @pytest.mark.asyncio
    async def test_list_secrets_api_no_vault(self, mock_user):
        """Test API behavior when vault client is not available."""
        response = await list_secrets(vault=None, current_user=mock_user, prefix="app/")

        assert isinstance(response, SecretListResponse)
        assert len(response.secrets) == 0

    @pytest.mark.asyncio
    async def test_list_secrets_api_vault_error(self, mock_vault_client, mock_user):
        """Test API error handling."""
        mock_vault_client.list_secrets_with_metadata.side_effect = VaultError("Connection failed")

        with pytest.raises(HTTPException) as exc_info:
            await list_secrets(vault=mock_vault_client, current_user=mock_user, prefix="app/")

        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_list_secrets_api_parsing_error(self, mock_vault_client, mock_user):
        """Test handling of malformed secret data."""
        mock_vault_client.list_secrets_with_metadata.return_value = [
            {
                "path": "valid/secret",
                "created_time": "2023-01-01T00:00:00Z",
                "version": 1,
                "metadata": {"source": "vault"},
            },
            {
                # Missing required path
                "created_time": "2023-01-01T00:00:00Z",
                "version": 1,
                "metadata": {"source": "vault"},
            },
        ]

        response = await list_secrets(vault=mock_vault_client, current_user=mock_user, prefix="")

        assert len(response.secrets) == 2

        # First secret is valid
        assert response.secrets[0].path == "valid/secret"

        # Second secret has parsing error but is still included
        assert response.secrets[1].path == "unknown"
        assert "parsing_error" in response.secrets[1].metadata

    @pytest.mark.asyncio
    async def test_list_secrets_api_empty_prefix(self, mock_vault_client, mock_user):
        """Test listing secrets with empty prefix."""
        mock_vault_client.list_secrets_with_metadata.return_value = []

        response = await list_secrets(vault=mock_vault_client, current_user=mock_user, prefix="")

        assert len(response.secrets) == 0
        mock_vault_client.list_secrets_with_metadata.assert_called_once_with("")

    @pytest.mark.asyncio
    async def test_list_secrets_api_metadata_types(self, mock_vault_client, mock_user):
        """Test that various metadata types are handled correctly."""
        mock_vault_client.list_secrets_with_metadata.return_value = [
            {
                "path": "test/secret",
                "created_time": "2023-01-01T00:00:00Z",
                "updated_time": None,  # None value
                "version": 1,
                "metadata": {
                    "source": "vault",
                    "custom_field": "custom_value",
                    "numeric_field": 42,
                    "boolean_field": True,
                    "nested": {"key": "value"},
                },
            }
        ]

        response = await list_secrets(
            vault=mock_vault_client, current_user=mock_user, prefix="test/"
        )

        assert len(response.secrets) == 1
        secret = response.secrets[0]

        assert secret.path == "test/secret"
        assert secret.created_time == "2023-01-01T00:00:00Z"
        assert secret.updated_time is None
        assert secret.version == 1
        assert secret.metadata["custom_field"] == "custom_value"
        assert secret.metadata["numeric_field"] == 42
        assert secret.metadata["boolean_field"] is True
        assert secret.metadata["nested"]["key"] == "value"
