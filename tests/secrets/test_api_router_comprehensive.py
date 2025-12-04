"""
Comprehensive tests for secrets/api.py router to improve coverage from 57.27%.

Tests cover:
- Health check endpoint
- Get secret endpoint with audit logging
- Create/update secret endpoint
- Delete secret endpoint
- List secrets with metadata endpoint
- Error handling (VaultError, 404, 403, 500)
- Audit activity logging integration
- Vault client dependency injection
- Request/Response model validation
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.secrets.api import router
from dotmac.platform.secrets.vault_client import VaultError

pytestmark = pytest.mark.integration


def mock_current_user():
    """Mock current user for testing."""
    from dotmac.platform.auth.core import UserInfo

    return UserInfo(
        user_id="test-user",
        email="test@example.com",
        tenant_id="test-tenant",
        roles=["admin"],
        permissions=["secrets:read", "secrets:write"],
    )


@pytest.fixture
def app_with_router():
    """Create test app with secrets router."""
    app = FastAPI()
    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.auth.platform_admin import require_platform_admin

    # Override both auth dependencies
    app.dependency_overrides[get_current_user] = mock_current_user
    app.dependency_overrides[require_platform_admin] = mock_current_user
    app.include_router(router, prefix="/api/v1/vault")
    return app


@pytest.fixture
def mock_vault_client():
    """Create mock vault client."""
    client = AsyncMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


@pytest.fixture
def mock_settings():
    """Mock settings with vault enabled."""
    with patch("dotmac.platform.secrets.api.settings") as mock_settings:
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        yield mock_settings


class TestHealthEndpoint:
    """Test health check endpoint."""

    def test_health_check_success(self, app_with_router, mock_settings, mock_vault_client):
        """Test successful health check."""
        mock_vault_client.health_check = AsyncMock(return_value=True)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/health")

            assert response.status_code == 200
            data = response.json()
            assert data["healthy"] is True
            assert data["vault_url"] == "http://localhost:8200"
            assert data["mount_path"] == "secret"

    def test_health_check_failure(self, app_with_router, mock_settings, mock_vault_client):
        """Test health check when vault is unhealthy."""
        mock_vault_client.health_check = AsyncMock(return_value=False)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/health")

            assert response.status_code == 200
            data = response.json()
            assert data["healthy"] is False

    def test_health_check_exception(self, app_with_router, mock_settings, mock_vault_client):
        """Test health check with exception."""
        mock_vault_client.health_check = AsyncMock(side_effect=Exception("Connection failed"))

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/health")

            assert response.status_code == 200
            data = response.json()
            assert data["healthy"] is False

    def test_health_check_vault_disabled(self, app_with_router):
        """Test health check when vault is disabled."""
        with patch("dotmac.platform.secrets.api.settings") as mock_settings:
            mock_settings.vault.enabled = False

            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/health")

            assert response.status_code == 503
            assert "not enabled" in response.json()["detail"]


class TestGetSecretEndpoint:
    """Test get secret endpoint."""

    @patch("dotmac.platform.secrets.api.log_api_activity")
    def test_get_secret_success(
        self, mock_log_activity, app_with_router, mock_settings, mock_vault_client
    ):
        """Test successfully getting a secret."""
        mock_vault_client.get_secret = AsyncMock(
            return_value={"username": "admin", "password": "secret123"}
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets/database/credentials")

            assert response.status_code == 200
            data = response.json()
            assert data["path"] == "database/credentials"
            assert data["data"]["username"] == "admin"
            assert data["data"]["password"] == "secret123"

            # Verify audit logging
            assert mock_log_activity.call_count == 1
            call_args = mock_log_activity.call_args
            assert call_args.kwargs["action"] == "secret_access_success"

    @patch("dotmac.platform.secrets.api.log_api_activity")
    def test_get_secret_not_found(
        self, mock_log_activity, app_with_router, mock_settings, mock_vault_client
    ):
        """Test getting non-existent secret returns 404."""
        mock_vault_client.get_secret = AsyncMock(return_value={})

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets/nonexistent/path")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"]

            # Verify failed access was logged
            assert mock_log_activity.call_count == 1
            call_args = mock_log_activity.call_args
            assert call_args.kwargs["action"] == "secret_access_failed"

    @patch("dotmac.platform.secrets.api.log_api_activity")
    def test_get_secret_vault_error(
        self, mock_log_activity, app_with_router, mock_settings, mock_vault_client
    ):
        """Test getting secret with VaultError."""
        mock_vault_client.get_secret = AsyncMock(side_effect=VaultError("Connection timeout"))

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets/database/creds")

            assert response.status_code == 500
            assert "Failed to retrieve secret" in response.json()["detail"]

            # Verify error was logged
            assert mock_log_activity.call_count == 1
            call_args = mock_log_activity.call_args
            assert call_args.kwargs["action"] == "secret_access_error"
            assert call_args.kwargs["severity"].value == "high"


class TestCreateOrUpdateSecretEndpoint:
    """Test create/update secret endpoint."""

    @patch("dotmac.platform.secrets.api.log_api_activity")
    def test_create_secret_success(
        self, mock_log_activity, app_with_router, mock_settings, mock_vault_client
    ):
        """Test successfully creating a secret."""
        mock_vault_client.set_secret = AsyncMock()

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.post(
                "/api/v1/vault/secrets/app/config",
                json={
                    "data": {"api_key": "sk_test123", "webhook_url": "https://example.com"},
                    "metadata": {"environment": "production"},
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["path"] == "app/config"
            assert data["data"]["api_key"] == "sk_test123"
            assert data["metadata"]["environment"] == "production"

            # Verify set_secret was called
            mock_vault_client.set_secret.assert_called_once_with(
                "app/config", {"api_key": "sk_test123", "webhook_url": "https://example.com"}
            )

            # Verify audit logging
            assert mock_log_activity.call_count == 1
            call_args = mock_log_activity.call_args
            assert call_args.kwargs["action"] == "secret_create_or_update"

    @patch("dotmac.platform.secrets.api.log_api_activity")
    def test_create_secret_vault_error(
        self, mock_log_activity, app_with_router, mock_settings, mock_vault_client
    ):
        """Test creating secret with VaultError."""
        mock_vault_client.set_secret = AsyncMock(side_effect=VaultError("Permission denied"))

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.post(
                "/api/v1/vault/secrets/app/config",
                json={"data": {"key": "value"}},
            )

            assert response.status_code == 500
            assert "Failed to store secret" in response.json()["detail"]

            # Verify error was logged
            assert mock_log_activity.call_count == 1
            call_args = mock_log_activity.call_args
            assert call_args.kwargs["action"] == "secret_create_error"


class TestDeleteSecretEndpoint:
    """Test delete secret endpoint."""

    @patch("dotmac.platform.secrets.api.log_api_activity")
    def test_delete_secret_success(
        self, mock_log_activity, app_with_router, mock_settings, mock_vault_client
    ):
        """Test successfully deleting a secret."""
        mock_vault_client.delete_secret = AsyncMock()

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.delete("/api/v1/vault/secrets/old/config")

            assert response.status_code == 204

            # Verify delete_secret was called
            mock_vault_client.delete_secret.assert_called_once_with("old/config")

            # Verify audit logging
            assert mock_log_activity.call_count == 1
            call_args = mock_log_activity.call_args
            assert call_args.kwargs["action"] == "secret_delete"
            assert call_args.kwargs["severity"].value == "high"

    @patch("dotmac.platform.secrets.api.log_api_activity")
    def test_delete_secret_vault_error(
        self, mock_log_activity, app_with_router, mock_settings, mock_vault_client
    ):
        """Test deleting secret with VaultError."""
        mock_vault_client.delete_secret = AsyncMock(side_effect=VaultError("Delete failed"))

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.delete("/api/v1/vault/secrets/app/config")

            assert response.status_code == 500
            assert "Failed to delete secret" in response.json()["detail"]

            # Verify error was logged
            assert mock_log_activity.call_count == 1
            call_args = mock_log_activity.call_args
            assert call_args.kwargs["action"] == "secret_delete_error"


class TestListSecretsEndpoint:
    """Test list secrets endpoint."""

    def test_list_secrets_success(self, app_with_router, mock_settings, mock_vault_client):
        """Test successfully listing secrets with metadata."""
        mock_vault_client.list_secrets_with_metadata = AsyncMock(
            return_value=[
                {
                    "path": "database/creds",
                    "created_time": "2024-01-01T00:00:00Z",
                    "updated_time": "2024-01-02T00:00:00Z",
                    "version": 3,
                    "metadata": {"source": "vault"},
                },
                {
                    "path": "api/keys",
                    "created_time": "2024-01-03T00:00:00Z",
                    "updated_time": "2024-01-04T00:00:00Z",
                    "version": 1,
                    "metadata": {"source": "vault"},
                },
            ]
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets")

            assert response.status_code == 200
            data = response.json()
            assert len(data["secrets"]) == 2
            assert data["secrets"][0]["path"] == "database/creds"
            assert data["secrets"][0]["version"] == 3
            assert data["secrets"][1]["path"] == "api/keys"

    def test_list_secrets_with_prefix(self, app_with_router, mock_settings, mock_vault_client):
        """Test listing secrets with prefix filter."""
        mock_vault_client.list_secrets_with_metadata = AsyncMock(return_value=[])

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets?prefix=database/")

            assert response.status_code == 200
            mock_vault_client.list_secrets_with_metadata.assert_called_once_with("database/")

    def test_list_secrets_vault_not_available(self, app_with_router, mock_settings):
        """Test listing secrets when vault client is not available."""
        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=None):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets")

            assert response.status_code == 200
            data = response.json()
            assert data["secrets"] == []

    def test_list_secrets_vault_error(self, app_with_router, mock_settings, mock_vault_client):
        """Test listing secrets with VaultError."""
        mock_vault_client.list_secrets_with_metadata = AsyncMock(
            side_effect=VaultError("List failed")
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets")

            assert response.status_code == 500
            assert "Failed to list secrets" in response.json()["detail"]

    def test_list_secrets_unexpected_error(self, app_with_router, mock_settings, mock_vault_client):
        """Test listing secrets with unexpected error."""
        mock_vault_client.list_secrets_with_metadata = AsyncMock(
            side_effect=Exception("Unexpected error")
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets")

            assert response.status_code == 500
            assert "Failed to list secrets" in response.json()["detail"]

    def test_list_secrets_with_parsing_errors(
        self, app_with_router, mock_settings, mock_vault_client
    ):
        """Test listing secrets with metadata parsing errors."""
        mock_vault_client.list_secrets_with_metadata = AsyncMock(
            return_value=[
                {
                    "path": "valid/secret",
                    "created_time": "2024-01-01T00:00:00Z",
                    "updated_time": "2024-01-02T00:00:00Z",
                    "version": 1,
                    "metadata": {"source": "vault"},
                },
                {
                    # Missing path - should trigger parsing error
                    "created_time": "2024-01-01T00:00:00Z",
                },
            ]
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault_client):
            client = TestClient(app_with_router)
            response = client.get("/api/v1/vault/secrets")

            assert response.status_code == 200
            data = response.json()
            # Should still include both secrets, even with parsing error
            assert len(data["secrets"]) == 2
            assert data["secrets"][0]["path"] == "valid/secret"
            # Second secret should have unknown path with error metadata
            assert data["secrets"][1]["path"] == "unknown"
            assert "parsing_error" in data["secrets"][1]["metadata"]


class TestRequestResponseModels:
    """Test Pydantic request/response models."""

    def test_secret_data_model(self):
        """Test SecretData model validation."""
        from dotmac.platform.secrets.api import SecretData

        secret_data = SecretData(
            data={"key": "value", "nested": {"field": "data"}},
            metadata={"owner": "team-a"},
        )

        assert secret_data.data["key"] == "value"
        assert secret_data.metadata["owner"] == "team-a"

    def test_secret_response_model(self):
        """Test SecretResponse model."""
        from dotmac.platform.secrets.api import SecretResponse

        response = SecretResponse(
            path="app/config",
            data={"key": "value"},
            metadata={"version": 1},
        )

        assert response.path == "app/config"
        assert response.data["key"] == "value"

    def test_secret_info_model(self):
        """Test SecretInfo model."""
        from dotmac.platform.secrets.api import SecretInfo

        info = SecretInfo(
            path="database/creds",
            created_time="2024-01-01T00:00:00Z",
            updated_time="2024-01-02T00:00:00Z",
            version=5,
            metadata={"source": "vault"},
        )

        assert info.path == "database/creds"
        assert info.version == 5

    def test_health_response_model(self):
        """Test HealthResponse model."""
        from dotmac.platform.secrets.api import HealthResponse

        health = HealthResponse(
            healthy=True,
            vault_url="http://localhost:8200",
            mount_path="secret",
        )

        assert health.healthy is True
        assert health.vault_url == "http://localhost:8200"


class TestVaultDependency:
    """Test Vault client dependency injection."""

    def test_get_vault_client_dependency(self):
        """Test get_vault_client dependency."""
        import asyncio

        from dotmac.platform.secrets.api import get_vault_client

        with patch("dotmac.platform.secrets.api.settings") as mock_settings:
            mock_settings.vault.enabled = True
            mock_settings.vault.url = "http://localhost:8200"
            mock_settings.vault.token = "test-token"
            mock_settings.vault.namespace = None
            mock_settings.vault.mount_path = "secret"
            mock_settings.vault.kv_version = 2

            client = asyncio.run(get_vault_client())

            assert client is not None
            assert hasattr(client, "get_secret")
            assert hasattr(client, "set_secret")

    def test_get_vault_client_disabled(self):
        """Test get_vault_client when vault is disabled."""
        import asyncio

        from fastapi import HTTPException

        from dotmac.platform.secrets.api import get_vault_client

        with patch("dotmac.platform.secrets.api.settings") as mock_settings:
            mock_settings.vault.enabled = False

            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(get_vault_client())

            assert exc_info.value.status_code == 503
            assert "not enabled" in exc_info.value.detail
