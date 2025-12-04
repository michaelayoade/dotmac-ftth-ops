"""
End-to-End tests for Secrets API.

Tests complete workflows through the API router, covering:
- Vault client integration
- Secret CRUD operations
- Audit logging
- Error handling

This E2E test suite covers the following modules:
- src/dotmac/platform/secrets/api.py (router)
- src/dotmac/platform/secrets/vault_client.py (client)
- Integration with audit logging
"""

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

# Pytest marker for E2E tests


pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


@pytest.fixture
def mock_vault_settings():
    """Mock Vault settings for testing."""
    with patch("dotmac.platform.secrets.api.settings") as mock_settings:
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-vault-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        yield mock_settings


@pytest.fixture
def mock_audit_log():
    """Mock audit logging to avoid database dependencies."""
    with patch("dotmac.platform.secrets.api.log_api_activity") as mock_log:
        mock_log.return_value = AsyncMock()
        yield mock_log


@pytest_asyncio.fixture
async def secrets_app(mock_vault_settings, mock_audit_log):
    """Create FastAPI app with secrets router for E2E testing."""
    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.auth.platform_admin import require_platform_admin
    from dotmac.platform.secrets.api import router as secrets_router

    app = FastAPI(title="Secrets E2E Test App")

    # Override auth dependency to bypass authentication in E2E tests
    def override_require_platform_admin():
        return UserInfo(
            user_id="test-admin-user",
            email="admin@example.com",
            tenant_id="test-tenant",
            roles=["platform_admin"],
            permissions=["secrets:read", "secrets:write", "secrets:delete"],
        )

    app.dependency_overrides[require_platform_admin] = override_require_platform_admin

    app.include_router(secrets_router, prefix="/api/v1/secrets", tags=["Secrets"])

    return app


@pytest_asyncio.fixture
async def client(secrets_app):
    """Async HTTP client for E2E testing."""
    transport = ASGITransport(app=secrets_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
def auth_headers():
    """Provide authorization headers for E2E tests."""
    return {"Authorization": "Bearer test-token"}


# ============================================================================
# Health Check E2E Tests
# ============================================================================


class TestHealthCheckE2E:
    """E2E tests for Vault health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check_healthy(self, client, mock_vault_settings, auth_headers):
        """Test health check endpoint when Vault is healthy."""
        # Mock AsyncVaultClient context manager and health_check method
        mock_vault = AsyncMock()
        mock_vault.health_check = AsyncMock(return_value=True)
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get("/api/v1/secrets/health", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["healthy"] is True
            assert data["vault_url"] == "http://localhost:8200"
            assert data["mount_path"] == "secret"

    @pytest.mark.asyncio
    async def test_health_check_unhealthy(self, client, mock_vault_settings, auth_headers):
        """Test health check endpoint when Vault is unhealthy."""
        # Mock AsyncVaultClient that raises exception
        mock_vault = AsyncMock()
        mock_vault.health_check = AsyncMock(side_effect=Exception("Connection refused"))
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get("/api/v1/secrets/health", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["healthy"] is False

    @pytest.mark.asyncio
    async def test_health_check_vault_disabled(self, client, auth_headers):
        """Test health check when Vault is disabled."""
        with patch("dotmac.platform.secrets.api.settings") as mock_settings:
            mock_settings.vault.enabled = False

            response = await client.get("/api/v1/secrets/health", headers=auth_headers)

            assert response.status_code == 503
            data = response.json()
            assert "Vault/OpenBao is not enabled" in data["detail"]


# ============================================================================
# Create/Update Secret E2E Tests
# ============================================================================


class TestCreateUpdateSecretE2E:
    """E2E tests for creating and updating secrets."""

    @pytest.mark.asyncio
    async def test_create_secret_success(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test successful secret creation."""
        # Mock AsyncVaultClient
        mock_vault = AsyncMock()
        mock_vault.set_secret = AsyncMock(return_value=None)
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.post(
                "/api/v1/secrets/secrets/app/database/credentials",
                json={
                    "data": {
                        "username": "admin",
                        "password": "secret123",
                        "host": "localhost",
                        "port": 5432,
                    },
                    "metadata": {"environment": "production"},
                },
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["path"] == "app/database/credentials"
            assert data["data"]["username"] == "admin"
            assert data["data"]["password"] == "secret123"
            assert data["metadata"]["environment"] == "production"

            # Verify audit logging was called
            assert mock_audit_log.called
            call_kwargs = mock_audit_log.call_args[1]
            assert call_kwargs["action"] == "secret_create_or_update"
            assert "app/database/credentials" in call_kwargs["description"]

            # Verify vault client was called correctly
            mock_vault.set_secret.assert_called_once()
            call_args = mock_vault.set_secret.call_args
            assert call_args[0][0] == "app/database/credentials"
            assert call_args[0][1]["username"] == "admin"

    @pytest.mark.asyncio
    async def test_update_existing_secret(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test updating an existing secret."""
        mock_vault = AsyncMock()
        mock_vault.set_secret = AsyncMock(return_value=None)
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            # Update secret with new data
            response = await client.post(
                "/api/v1/secrets/secrets/app/config",
                json={
                    "data": {"api_key": "new-key-456", "api_url": "https://api.example.com"},
                    "metadata": None,
                },
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["path"] == "app/config"
            assert data["data"]["api_key"] == "new-key-456"

    @pytest.mark.asyncio
    async def test_create_secret_vault_error(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test error handling when Vault fails to store secret."""
        from dotmac.platform.secrets.vault_client import VaultError

        mock_vault = AsyncMock()
        mock_vault.set_secret = AsyncMock(side_effect=VaultError("Permission denied"))
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.post(
                "/api/v1/secrets/secrets/app/restricted",
                json={"data": {"key": "value"}},
                headers=auth_headers,
            )

            assert response.status_code == 500
            data = response.json()
            assert "Failed to store secret" in data["detail"]
            assert "Permission denied" in data["detail"]

            # Verify error was logged to audit
            assert mock_audit_log.called
            error_call = [
                call for call in mock_audit_log.call_args_list if "error" in call[1]["action"]
            ]
            assert len(error_call) > 0


# ============================================================================
# Get Secret E2E Tests
# ============================================================================


class TestGetSecretE2E:
    """E2E tests for retrieving secrets."""

    @pytest.mark.asyncio
    async def test_get_secret_success(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test successful secret retrieval."""
        mock_vault = AsyncMock()
        mock_vault.get_secret = AsyncMock(
            return_value={
                "username": "admin",
                "password": "secret123",
                "host": "localhost",
            }
        )
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get(
                "/api/v1/secrets/secrets/app/database/credentials", headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert data["path"] == "app/database/credentials"
            assert data["data"]["username"] == "admin"
            assert data["data"]["password"] == "secret123"

            # Verify successful access was logged
            assert mock_audit_log.called
            success_call = [
                call for call in mock_audit_log.call_args_list if "success" in call[1]["action"]
            ]
            assert len(success_call) > 0

    @pytest.mark.asyncio
    async def test_get_secret_not_found(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test retrieving non-existent secret."""
        mock_vault = AsyncMock()
        mock_vault.get_secret = AsyncMock(return_value=None)  # Secret not found
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get(
                "/api/v1/secrets/secrets/nonexistent/secret", headers=auth_headers
            )

            assert response.status_code == 404
            data = response.json()
            assert "Secret not found" in data["detail"]
            assert "nonexistent/secret" in data["detail"]

            # Verify failed access was logged
            assert mock_audit_log.called
            failed_call = [
                call for call in mock_audit_log.call_args_list if "failed" in call[1]["action"]
            ]
            assert len(failed_call) > 0

    @pytest.mark.asyncio
    async def test_get_secret_vault_error(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test error handling when Vault fails."""
        from dotmac.platform.secrets.vault_client import VaultError

        mock_vault = AsyncMock()
        mock_vault.get_secret = AsyncMock(side_effect=VaultError("Connection timeout"))
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get("/api/v1/secrets/secrets/app/config", headers=auth_headers)

            assert response.status_code == 500
            data = response.json()
            assert "Failed to retrieve secret" in data["detail"]
            assert "Connection timeout" in data["detail"]

            # Verify error was logged
            error_calls = [
                call for call in mock_audit_log.call_args_list if "error" in call[1]["action"]
            ]
            assert len(error_calls) > 0


# ============================================================================
# List Secrets E2E Tests
# ============================================================================


class TestListSecretsE2E:
    """E2E tests for listing secrets."""

    @pytest.mark.asyncio
    async def test_list_secrets_success(self, client, mock_vault_settings, auth_headers):
        """Test successful secret listing."""
        mock_vault = AsyncMock()
        mock_vault.list_secrets_with_metadata = AsyncMock(
            return_value=[
                {
                    "path": "app/database/credentials",
                    "created_time": "2024-01-01T00:00:00Z",
                    "updated_time": "2024-01-02T00:00:00Z",
                    "version": 3,
                    "metadata": {"environment": "production"},
                },
                {
                    "path": "app/api/keys",
                    "created_time": "2024-01-03T00:00:00Z",
                    "updated_time": "2024-01-04T00:00:00Z",
                    "version": 1,
                    "metadata": {"environment": "staging"},
                },
            ]
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get("/api/v1/secrets/secrets", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert "secrets" in data
            assert len(data["secrets"]) == 2

            # Verify first secret
            secret1 = data["secrets"][0]
            assert secret1["path"] == "app/database/credentials"
            assert secret1["version"] == 3
            assert secret1["metadata"]["environment"] == "production"

            # Verify second secret
            secret2 = data["secrets"][1]
            assert secret2["path"] == "app/api/keys"
            assert secret2["version"] == 1

    @pytest.mark.asyncio
    async def test_list_secrets_with_prefix(self, client, mock_vault_settings, auth_headers):
        """Test listing secrets with prefix filter."""
        mock_vault = AsyncMock()
        mock_vault.list_secrets_with_metadata = AsyncMock(
            return_value=[
                {
                    "path": "app/database/credentials",
                    "created_time": "2024-01-01T00:00:00Z",
                    "updated_time": "2024-01-02T00:00:00Z",
                    "version": 2,
                    "metadata": {},
                },
            ]
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get(
                "/api/v1/secrets/secrets?prefix=app/database", headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data["secrets"]) == 1
            assert "database" in data["secrets"][0]["path"]

            # Verify prefix was passed to vault client
            mock_vault.list_secrets_with_metadata.assert_called_once_with("app/database")

    @pytest.mark.asyncio
    async def test_list_secrets_empty(self, client, mock_vault_settings, auth_headers):
        """Test listing when no secrets exist."""
        mock_vault = AsyncMock()
        mock_vault.list_secrets_with_metadata = AsyncMock(return_value=[])

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get("/api/v1/secrets/secrets", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["secrets"] == []

    @pytest.mark.asyncio
    async def test_list_secrets_vault_error(self, client, mock_vault_settings, auth_headers):
        """Test error handling when listing fails."""
        from dotmac.platform.secrets.vault_client import VaultError

        mock_vault = AsyncMock()
        mock_vault.list_secrets_with_metadata = AsyncMock(
            side_effect=VaultError("List operation failed")
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get("/api/v1/secrets/secrets", headers=auth_headers)

            assert response.status_code == 500
            data = response.json()
            assert "Failed to list secrets" in data["detail"]

    @pytest.mark.asyncio
    async def test_list_secrets_parsing_error(self, client, mock_vault_settings, auth_headers):
        """Test handling of secrets with invalid metadata."""
        mock_vault = AsyncMock()
        mock_vault.list_secrets_with_metadata = AsyncMock(
            return_value=[
                {
                    "path": "valid/secret",
                    "created_time": "2024-01-01T00:00:00Z",
                    "updated_time": "2024-01-02T00:00:00Z",
                    "version": 1,
                    "metadata": {},
                },
                {
                    "path": "invalid/secret",
                    # Missing required fields - will cause parsing error
                },
            ]
        )

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.get("/api/v1/secrets/secrets", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            # Should still return secrets even with parsing errors
            assert len(data["secrets"]) == 2


# ============================================================================
# Delete Secret E2E Tests
# ============================================================================


class TestDeleteSecretE2E:
    """E2E tests for deleting secrets."""

    @pytest.mark.asyncio
    async def test_delete_secret_success(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test successful secret deletion."""
        mock_vault = AsyncMock()
        mock_vault.delete_secret = AsyncMock(return_value=None)
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.delete(
                "/api/v1/secrets/secrets/app/old-config", headers=auth_headers
            )

            assert response.status_code == 204
            assert response.content == b""  # No content for 204

            # Verify vault delete was called
            mock_vault.delete_secret.assert_called_once_with("app/old-config")

            # Verify deletion was logged to audit
            assert mock_audit_log.called
            delete_call = [
                call for call in mock_audit_log.call_args_list if "delete" in call[1]["action"]
            ]
            assert len(delete_call) > 0
            assert delete_call[0][1]["resource_id"] == "app/old-config"

    @pytest.mark.asyncio
    async def test_delete_secret_vault_error(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test error handling when deletion fails."""
        from dotmac.platform.secrets.vault_client import VaultError

        mock_vault = AsyncMock()
        mock_vault.delete_secret = AsyncMock(side_effect=VaultError("Delete failed"))
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            response = await client.delete(
                "/api/v1/secrets/secrets/app/config", headers=auth_headers
            )

            assert response.status_code == 500
            data = response.json()
            assert "Failed to delete secret" in data["detail"]
            assert "Delete failed" in data["detail"]

            # Verify error was logged
            error_calls = [
                call for call in mock_audit_log.call_args_list if "error" in call[1]["action"]
            ]
            assert len(error_calls) > 0


# ============================================================================
# Complete Workflow E2E Tests
# ============================================================================


class TestCompleteWorkflowE2E:
    """E2E tests for complete secret lifecycle workflows."""

    @pytest.mark.asyncio
    async def test_complete_secret_lifecycle(
        self, client, mock_vault_settings, mock_audit_log, auth_headers
    ):
        """Test complete workflow: create → get → update → delete."""
        mock_vault = AsyncMock()

        # Mock all vault operations
        mock_vault.set_secret = AsyncMock(return_value=None)
        mock_vault.get_secret = AsyncMock(
            return_value={"api_key": "key-123", "api_url": "https://api.example.com"}
        )
        mock_vault.delete_secret = AsyncMock(return_value=None)
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            # 1. Create secret
            create_response = await client.post(
                "/api/v1/secrets/secrets/app/api-config",
                json={
                    "data": {"api_key": "key-123", "api_url": "https://api.example.com"},
                    "metadata": {"created_by": "admin"},
                },
                headers=auth_headers,
            )
            assert create_response.status_code == 200

            # 2. Get secret
            get_response = await client.get(
                "/api/v1/secrets/secrets/app/api-config", headers=auth_headers
            )
            assert get_response.status_code == 200
            assert get_response.json()["data"]["api_key"] == "key-123"

            # 3. Update secret
            mock_vault.get_secret = AsyncMock(
                return_value={"api_key": "key-456", "api_url": "https://api.example.com"}
            )

            update_response = await client.post(
                "/api/v1/secrets/secrets/app/api-config",
                json={
                    "data": {"api_key": "key-456", "api_url": "https://api.example.com"},
                },
                headers=auth_headers,
            )
            assert update_response.status_code == 200

            # 4. Delete secret
            delete_response = await client.delete(
                "/api/v1/secrets/secrets/app/api-config", headers=auth_headers
            )
            assert delete_response.status_code == 204

            # Verify all audit events were logged
            assert mock_audit_log.call_count >= 4  # create, get, update, delete

    @pytest.mark.asyncio
    async def test_multi_secret_management(self, client, mock_vault_settings, auth_headers):
        """Test managing multiple secrets in different paths."""
        mock_vault = AsyncMock()
        mock_vault.set_secret = AsyncMock(return_value=None)
        mock_vault.list_secrets_with_metadata = AsyncMock(
            return_value=[
                {"path": "app/database/prod", "version": 1, "metadata": {}},
                {"path": "app/database/staging", "version": 1, "metadata": {}},
                {"path": "app/api/keys", "version": 2, "metadata": {}},
            ]
        )
        mock_vault.__aenter__ = AsyncMock(return_value=mock_vault)
        mock_vault.__aexit__ = AsyncMock(return_value=None)

        with patch("dotmac.platform.secrets.api.AsyncVaultClient", return_value=mock_vault):
            # Create multiple secrets
            await client.post(
                "/api/v1/secrets/secrets/app/database/prod",
                json={"data": {"host": "prod.db.com", "password": "prod-pass"}},
                headers=auth_headers,
            )

            await client.post(
                "/api/v1/secrets/secrets/app/database/staging",
                json={"data": {"host": "staging.db.com", "password": "staging-pass"}},
                headers=auth_headers,
            )

            await client.post(
                "/api/v1/secrets/secrets/app/api/keys",
                json={"data": {"key": "api-key-123"}},
                headers=auth_headers,
            )

            # List all secrets
            list_response = await client.get("/api/v1/secrets/secrets", headers=auth_headers)
            assert list_response.status_code == 200
            data = list_response.json()
            assert len(data["secrets"]) == 3

            # List with prefix filter
            list_db_response = await client.get(
                "/api/v1/secrets/secrets?prefix=app/database", headers=auth_headers
            )
            assert list_db_response.status_code == 200
            # Note: In real scenario, mock would be called with prefix
            # For this test, we're just verifying the endpoint works
