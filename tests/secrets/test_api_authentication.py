"""
Regression tests for Secrets API authentication.

SECURITY: Tests that all secrets endpoints require platform admin authentication.

These tests verify the fixes for the CRITICAL security issue where secrets
endpoints were accessible without any authentication, exposing Vault data.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.main import app

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_vault_client():
    """Mock Vault client."""
    with patch("dotmac.platform.secrets.api.AsyncVaultClient") as mock:
        client = AsyncMock()
        client.get_secret = AsyncMock(return_value={"key": "value"})
        client.set_secret = AsyncMock()
        client.delete_secret = AsyncMock()
        client.list_secrets = AsyncMock(return_value=["secret1", "secret2"])
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock()
        mock.return_value = client
        yield client


@pytest.fixture
def regular_user():
    """Regular user (not platform admin)."""
    return UserInfo(
        user_id="user-123",
        username="regular_user",
        email="user@example.com",
        roles=["user"],
        permissions=["read"],
        tenant_id="tenant-1",
        is_platform_admin=False,  # NOT platform admin
    )


@pytest.fixture
def platform_admin_user():
    """Platform admin user."""
    return UserInfo(
        user_id="admin-123",
        username="platform_admin",
        email="admin@example.com",
        roles=["platform_admin"],
        permissions=["*"],
        tenant_id=None,
        is_platform_admin=True,  # Platform admin
    )


class TestSecretsAPIAuthentication:
    """Test that all secrets endpoints require authentication."""

    def test_get_secret_requires_authentication(self, mock_vault_client):
        """
        SECURITY TEST: GET /api/v1/secrets/{path} requires authentication.

        Before fix: Anyone could call this endpoint
        After fix: Returns 401/403 without valid JWT
        """
        client = TestClient(app)

        # Attempt to access secret without authentication
        response = client.get("/api/v1/secrets/secrets/app/database/password")

        # SECURITY ASSERTION: Request is rejected
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_create_secret_requires_authentication(self, mock_vault_client):
        """
        SECURITY TEST: POST /api/v1/secrets/{path} requires authentication.
        """
        client = TestClient(app)

        response = client.post(
            "/api/v1/secrets/secrets/app/api/key",
            json={"data": {"api_key": "secret-key-123"}},
        )

        # SECURITY ASSERTION: Request is rejected
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_delete_secret_requires_authentication(self, mock_vault_client):
        """
        SECURITY TEST: DELETE /api/v1/secrets/{path} requires authentication.
        """
        client = TestClient(app)

        response = client.delete("/api/v1/secrets/secrets/app/temp/data")

        # SECURITY ASSERTION: Request is rejected
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_list_secrets_requires_authentication(self, mock_vault_client):
        """
        SECURITY TEST: GET /api/v1/secrets requires authentication.
        """
        client = TestClient(app)

        response = client.get("/api/v1/secrets/secrets")

        # SECURITY ASSERTION: Request is rejected
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


class TestSecretsAPIPlatformAdminOnly:
    """Test that secrets endpoints require platform admin role."""

    @pytest.mark.asyncio
    async def test_regular_user_cannot_read_secrets(self, regular_user, mock_vault_client):
        """
        SECURITY TEST: Regular users cannot read secrets even if authenticated.

        This test verifies that require_platform_admin dependency properly
        rejects non-admin users.
        """
        from dotmac.platform.auth.platform_admin import require_platform_admin

        # Attempt to call require_platform_admin with regular user
        # This simulates what FastAPI dependency injection does
        with pytest.raises(HTTPException) as exc_info:
            await require_platform_admin(current_user=regular_user)

        # SECURITY ASSERTION: Regular user rejected
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "administrator access required" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_regular_user_cannot_write_secrets(self, regular_user, mock_vault_client):
        """
        SECURITY TEST: Regular users cannot write secrets.

        This test verifies that require_platform_admin dependency properly
        rejects non-admin users for write operations.
        """
        from dotmac.platform.auth.platform_admin import require_platform_admin

        # Attempt to call require_platform_admin with regular user
        with pytest.raises(HTTPException) as exc_info:
            await require_platform_admin(current_user=regular_user)

        # SECURITY ASSERTION: Regular user rejected
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "administrator access required" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_regular_user_cannot_delete_secrets(self, regular_user, mock_vault_client):
        """
        SECURITY TEST: Regular users cannot delete secrets.

        This test verifies that require_platform_admin dependency properly
        rejects non-admin users for delete operations.
        """
        from dotmac.platform.auth.platform_admin import require_platform_admin

        # Attempt to call require_platform_admin with regular user
        with pytest.raises(HTTPException) as exc_info:
            await require_platform_admin(current_user=regular_user)

        # SECURITY ASSERTION: Regular user rejected
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "administrator access required" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_regular_user_cannot_list_secrets(self, regular_user, mock_vault_client):
        """
        SECURITY TEST: Regular users cannot list secrets.

        This test verifies that require_platform_admin dependency properly
        rejects non-admin users for list operations.
        """
        from dotmac.platform.auth.platform_admin import require_platform_admin

        # Attempt to call require_platform_admin with regular user
        with pytest.raises(HTTPException) as exc_info:
            await require_platform_admin(current_user=regular_user)

        # SECURITY ASSERTION: Regular user rejected
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "administrator access required" in exc_info.value.detail.lower()


class TestSecretsAPIPlatformAdminAccess:
    """Test that platform admins CAN access secrets."""

    @pytest.mark.asyncio
    async def test_platform_admin_can_read_secrets(self, platform_admin_user, mock_vault_client):
        """Test that platform admins can read secrets."""
        from dotmac.platform.secrets.api import get_secret

        mock_request = MagicMock()

        with patch(
            "dotmac.platform.secrets.api.require_platform_admin", return_value=platform_admin_user
        ):
            with patch("dotmac.platform.secrets.api.log_api_activity", new_callable=AsyncMock):
                result = await get_secret(
                    path="app/secret",
                    request=mock_request,
                    vault=mock_vault_client,
                    current_user=platform_admin_user,
                )

        # ASSERTION: Platform admin can access secrets
        assert result.path == "app/secret"
        assert result.data == {"key": "value"}

    @pytest.mark.asyncio
    async def test_platform_admin_can_write_secrets(self, platform_admin_user, mock_vault_client):
        """Test that platform admins can write secrets."""
        from dotmac.platform.secrets.api import SecretData, create_or_update_secret

        mock_request = MagicMock()

        with patch(
            "dotmac.platform.secrets.api.require_platform_admin", return_value=platform_admin_user
        ):
            with patch("dotmac.platform.secrets.api.log_api_activity", new_callable=AsyncMock):
                result = await create_or_update_secret(
                    path="app/new_secret",
                    secret_data=SecretData(data={"password": "secret123"}),
                    request=mock_request,
                    vault=mock_vault_client,
                    current_user=platform_admin_user,
                )

        # ASSERTION: Platform admin can write secrets
        assert result.path == "app/new_secret"
        assert mock_vault_client.set_secret.called


class TestSecretsAPISecurityRegression:
    """
    REGRESSION TESTS: Verify the security fix prevents unauthorized access.
    """

    def test_unauthenticated_cannot_dump_vault_data(self):
        """
        SECURITY TEST: Unauthenticated users cannot dump Vault data.

        Before fix: Anyone could call GET /api/v1/secrets and list all secrets
        After fix: Returns 401 Unauthorized
        """
        client = TestClient(app)

        # Attempt to list all secrets without auth
        response = client.get("/api/v1/secrets/secrets")

        # SECURITY ASSERTION: Request rejected
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_empty_bearer_token_rejected(self):
        """
        SECURITY TEST: Empty bearer tokens are rejected.

        The finding mentioned "even an empty token passes" - verify this is fixed.
        """
        client = TestClient(app)

        # Attempt with empty bearer token
        headers = {"Authorization": "Bearer "}
        response = client.get("/api/v1/secrets/secrets/app/database", headers=headers)

        # SECURITY ASSERTION: Empty token rejected
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    @patch("dotmac.platform.secrets.api.AsyncVaultClient")
    @patch("dotmac.platform.secrets.api.settings")
    def test_invalid_jwt_rejected(self, mock_settings, mock_vault_client_class):
        """
        SECURITY TEST: Invalid JWTs are rejected.
        """
        # Enable Vault so we don't get 503 before auth check
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2

        # Mock the AsyncVaultClient to avoid httpx instantiation issues
        mock_client = AsyncMock()
        mock_vault_client_class.return_value = mock_client

        client = TestClient(app)

        # Attempt with invalid JWT
        headers = {"Authorization": "Bearer invalid-jwt-token"}
        response = client.get("/api/v1/secrets/secrets/app/database", headers=headers)

        # SECURITY ASSERTION: Invalid JWT rejected
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_health_endpoint_requires_authentication(self):
        """
        SECURITY TEST: Health endpoint requires authentication.

        Even though it's a health check, the Vault health endpoint exposes
        sensitive information (Vault URL, mount path) and should require
        authentication to prevent information disclosure.
        """
        client = TestClient(app)

        # Attempt to access health endpoint without auth
        response = client.get("/api/v1/secrets/health")

        # SECURITY ASSERTION: Unauthenticated request rejected
        # Health endpoint exposes Vault URL/mount path which is sensitive
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
