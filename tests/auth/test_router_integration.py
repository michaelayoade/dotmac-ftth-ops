"""
Integration tests for auth router endpoints.

Following strategic testing pattern:
- Use real database (async_db_session)
- Mock external services only (email, audit logs)
- Test full request/response flow
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import hash_password
from dotmac.platform.auth.router import auth_router
from dotmac.platform.user_management.models import User

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def app():
    """Create FastAPI app with auth router and tenant middleware."""
    from dotmac.platform.tenant import TenantConfiguration, TenantMiddleware, TenantMode

    app = FastAPI()

    # Add tenant middleware for multi-tenant support
    tenant_config = TenantConfiguration(
        mode=TenantMode.MULTI,
        require_tenant_header=True,
        tenant_header_name="X-Tenant-ID",
    )
    app.add_middleware(TenantMiddleware, config=tenant_config)

    app.include_router(auth_router)
    return app


@pytest.fixture
def client(app, async_db_session):
    """Create test client with session dependency override."""
    # Auth router uses get_auth_session, not get_session_dependency
    from dotmac.platform.auth.router import get_auth_session

    # Create a generator that yields the session
    async def override_get_auth_session():
        yield async_db_session

    # Override the dependency
    app.dependency_overrides[get_auth_session] = override_get_auth_session

    return TestClient(app)


@pytest_asyncio.fixture
async def active_user(async_db_session: AsyncSession):
    """Create an active test user in the database."""
    user = User(
        id=uuid4(),
        username="activeuser",
        email="active@example.com",
        password_hash=hash_password("SecurePass123!"),
        tenant_id="test-tenant",
        is_active=True,
        is_verified=True,
        roles=["user"],
        permissions=["read:own"],
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def inactive_user(async_db_session: AsyncSession):
    """Create an inactive test user."""
    user = User(
        id=uuid4(),
        username="inactiveuser",
        email="inactive@example.com",
        password_hash=hash_password("SecurePass123!"),
        tenant_id="test-tenant",
        is_active=False,
        is_verified=True,
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)


@pytest.fixture
def tenant_headers():
    """Standard tenant headers for API requests."""
    return {"X-Tenant-ID": "test-tenant"}


# ============================================================================
# Login Endpoint Tests
# ============================================================================


@pytest.mark.integration
class TestLoginEndpoint:
    """Test POST /auth/login endpoint."""

    @pytest.mark.asyncio
    async def test_login_success_with_username(self, client, tenant_headers, active_user):
        """Test successful login using username."""
        # Mock audit logging (external service)
        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
                response = client.post(
                    "/auth/login",
                    json={
                        "username": "activeuser",
                        "password": "SecurePass123!",
                    },
                    headers=tenant_headers,
                )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

        # Verify cookies are set
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

    @pytest.mark.asyncio
    async def test_login_success_with_email(self, client, tenant_headers, active_user):
        """Test successful login using email instead of username."""
        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
                response = client.post(
                    "/auth/login",
                    json={
                        "username": "active@example.com",  # Email in username field
                        "password": "SecurePass123!",
                    },
                    headers=tenant_headers,
                )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    @pytest.mark.asyncio
    async def test_login_invalid_password(self, client, tenant_headers, active_user):
        """Test login with invalid password."""
        with patch(
            "dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock
        ) as mock_log:
            response = client.post(
                "/auth/login",
                json={
                    "username": "activeuser",
                    "password": "WrongPassword",
                },
                headers=tenant_headers,
            )

        assert response.status_code == 401
        assert "Invalid username or password" in response.json()["detail"]

        # Verify failed login was logged
        mock_log.assert_called_once()

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client, tenant_headers):
        """Test login with non-existent user."""
        with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
            response = client.post(
                "/auth/login",
                json={
                    "username": "nonexistent",
                    "password": "AnyPassword123!",
                },
                headers=tenant_headers,
            )

        assert response.status_code == 401
        assert "Invalid username or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_inactive_account(self, client, tenant_headers, inactive_user):
        """Test login with inactive account."""
        with patch(
            "dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock
        ) as mock_log:
            response = client.post(
                "/auth/login",
                json={
                    "username": "inactiveuser",
                    "password": "SecurePass123!",
                },
                headers=tenant_headers,
            )

        assert response.status_code == 403
        assert "Account is disabled" in response.json()["detail"]

        # Verify disabled account login was logged
        mock_log.assert_called_once()

    @pytest.mark.asyncio
    async def test_login_missing_username(self, client, tenant_headers):
        """Test login with missing username."""
        response = client.post(
            "/auth/login",
            json={"password": "SecurePass123!"},
            headers=tenant_headers,
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_login_missing_password(self, client, tenant_headers):
        """Test login with missing password."""
        response = client.post(
            "/auth/login",
            json={"username": "activeuser"},
            headers=tenant_headers,
        )

        assert response.status_code == 422  # Validation error


# ============================================================================
# Token Endpoint Tests (OAuth2 password flow)
# ============================================================================


@pytest.mark.integration
class TestTokenEndpoint:
    """Test POST /auth/token endpoint (OAuth2 password flow)."""

    @pytest.mark.asyncio
    async def test_token_endpoint_success(self, client, tenant_headers, active_user):
        """Test successful token request using OAuth2 form."""

        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
                response = client.post(
                    "/auth/token",
                    data={
                        "username": "activeuser",
                        "password": "SecurePass123!",
                    },
                    headers={**tenant_headers, "Content-Type": "application/x-www-form-urlencoded"},
                )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_token_endpoint_invalid_credentials(self, client, tenant_headers, active_user):
        """Test token endpoint with invalid credentials."""

        with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
            response = client.post(
                "/auth/token",
                data={
                    "username": "activeuser",
                    "password": "WrongPassword",
                },
                headers={**tenant_headers, "Content-Type": "application/x-www-form-urlencoded"},
            )

        assert response.status_code == 401


# ============================================================================
# Register Endpoint Tests
# ============================================================================


@pytest.mark.integration
class TestRegisterEndpoint:
    """Test POST /auth/register endpoint."""

    @pytest.mark.asyncio
    async def test_register_success(self, client, tenant_headers):
        """Test successful user registration."""

        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            response = client.post(
                "/auth/register",
                json={
                    "username": "newuser",
                    "email": "newuser@example.com",
                    "password": "NewSecurePass123!",
                    "full_name": "New User",
                },
                headers=tenant_headers,
            )

        assert response.status_code == 200  # Router returns 200, not 201
        data = response.json()
        assert "access_token" in data
        # User ID is in the token claims, not response body directly

        # Verify response contains user info
        # (We can't easily query the DB after the fact with TestClient)

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client, tenant_headers, active_user):
        """Test registration with duplicate username."""

        response = client.post(
            "/auth/register",
            json={
                "username": "activeuser",  # Already exists
                "email": "different@example.com",
                "password": "NewSecurePass123!",
            },
            headers=tenant_headers,
        )

        assert response.status_code == 400
        # Generic error message to prevent user enumeration (security best practice)
        assert "registration failed" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client, tenant_headers, active_user):
        """Test registration with duplicate email."""

        response = client.post(
            "/auth/register",
            json={
                "username": "differentuser",
                "email": "active@example.com",  # Already exists
                "password": "NewSecurePass123!",
            },
            headers=tenant_headers,
        )

        assert response.status_code == 400
        # Generic error message to prevent user enumeration (security best practice)
        assert "registration failed" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client, tenant_headers):
        """Test registration with invalid email format."""

        response = client.post(
            "/auth/register",
            json={
                "username": "newuser",
                "email": "not-an-email",
                "password": "NewSecurePass123!",
            },
            headers=tenant_headers,
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_register_short_password(self, client, tenant_headers):
        """Test registration with password too short."""

        response = client.post(
            "/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "short",  # Less than 8 characters
            },
            headers=tenant_headers,
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_register_short_username(self, client, tenant_headers):
        """Test registration with username too short."""

        response = client.post(
            "/auth/register",
            json={
                "username": "ab",  # Less than 3 characters
                "email": "newuser@example.com",
                "password": "NewSecurePass123!",
            },
            headers=tenant_headers,
        )

        assert response.status_code == 422  # Validation error


# ============================================================================
# Logout Endpoint Tests
# ============================================================================


@pytest.mark.integration
class TestLogoutEndpoint:
    """Test POST /auth/logout endpoint."""

    @pytest.mark.asyncio
    async def test_logout_success(self, client, tenant_headers, active_user):
        """Test successful logout."""

        # First login to get a token
        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
                login_response = client.post(
                    "/auth/login",
                    json={
                        "username": "activeuser",
                        "password": "SecurePass123!",
                    },
                    headers=tenant_headers,
                )

        assert login_response.status_code == 200
        access_token = login_response.json()["access_token"]

        # Now logout
        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            logout_response = client.post(
                "/auth/logout",
                headers={**tenant_headers, "Authorization": f"Bearer {access_token}"},
            )

        assert logout_response.status_code == 200
        assert logout_response.json()["message"] == "Logged out successfully"

        # Note: TestClient doesn't maintain cookies across requests
        # In production, cookies are cleared via Set-Cookie headers


# ============================================================================
# Refresh Token Endpoint Tests
# ============================================================================


@pytest.mark.integration
class TestRefreshEndpoint:
    """Test POST /auth/refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client, tenant_headers, active_user):
        """Test successful token refresh."""

        # First login to get tokens
        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
                login_response = client.post(
                    "/auth/login",
                    json={
                        "username": "activeuser",
                        "password": "SecurePass123!",
                    },
                    headers=tenant_headers,
                )

        refresh_token = login_response.json()["refresh_token"]

        # Now refresh
        refresh_response = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
            headers=tenant_headers,
        )

        assert refresh_response.status_code == 200
        data = refresh_response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client, tenant_headers):
        """Test refresh with invalid token."""

        response = client.post(
            "/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
            headers=tenant_headers,
        )

        assert response.status_code in [401, 422]  # Could be either


# ============================================================================
# Password Reset Endpoint Tests
# ============================================================================


@pytest.mark.integration
class TestPasswordResetEndpoint:
    """Test password reset endpoints."""

    @pytest.mark.asyncio
    async def test_password_reset_request_success(self, client, tenant_headers, active_user):
        """Test successful password reset request."""

        # Mock email service
        with patch("dotmac.platform.auth.router.get_auth_email_service") as mock_email:
            mock_service = MagicMock()
            mock_service.send_password_reset_email = AsyncMock()
            mock_email.return_value = mock_service

            response = client.post(
                "/auth/password-reset",
                json={"email": "active@example.com"},
                headers=tenant_headers,
            )

        assert response.status_code == 200
        assert "reset" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_password_reset_nonexistent_email(self, client, tenant_headers):
        """Test password reset request for non-existent email."""

        with patch("dotmac.platform.auth.router.get_auth_email_service") as mock_email:
            mock_service = MagicMock()
            mock_email.return_value = mock_service

            response = client.post(
                "/auth/password-reset",
                json={"email": "nonexistent@example.com"},
                headers=tenant_headers,
            )

        # Should still return 200 to avoid user enumeration
        assert response.status_code == 200


# ============================================================================
# Verify Token Endpoint Tests
# ============================================================================


@pytest.mark.integration
class TestVerifyEndpoint:
    """Test POST /auth/verify endpoint."""

    @pytest.mark.asyncio
    async def test_verify_valid_token(self, client, tenant_headers, active_user):
        """Test token verification with valid token."""

        # First login to get a token
        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
                login_response = client.post(
                    "/auth/login",
                    json={
                        "username": "activeuser",
                        "password": "SecurePass123!",
                    },
                    headers=tenant_headers,
                )

        access_token = login_response.json()["access_token"]

        # Verify the token
        verify_response = client.get(
            "/auth/verify",
            headers={**tenant_headers, "Authorization": f"Bearer {access_token}"},
        )

        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data["valid"] is True
        assert "user_id" in data

    @pytest.mark.asyncio
    async def test_verify_invalid_token(self, client, tenant_headers):
        """Test token verification with invalid token."""

        response = client.get(
            "/auth/verify",
            headers={**tenant_headers, "Authorization": "Bearer invalid.token.here"},
        )

        assert response.status_code == 401


# ============================================================================
# Me Endpoint Tests
# ============================================================================


@pytest.mark.integration
class TestMeEndpoint:
    """Test GET /auth/me endpoint."""

    @pytest.mark.asyncio
    async def test_me_endpoint_authenticated(self, client, tenant_headers, active_user):
        """Test /me endpoint with authenticated user."""

        # First login to get a token
        with patch("dotmac.platform.auth.router.log_user_activity", new_callable=AsyncMock):
            with patch("dotmac.platform.auth.router.log_api_activity", new_callable=AsyncMock):
                login_response = client.post(
                    "/auth/login",
                    json={
                        "username": "activeuser",
                        "password": "SecurePass123!",
                    },
                    headers=tenant_headers,
                )

        access_token = login_response.json()["access_token"]

        # Get current user info
        me_response = client.get(
            "/auth/me",
            headers={**tenant_headers, "Authorization": f"Bearer {access_token}"},
        )

        assert me_response.status_code == 200
        data = me_response.json()
        assert data["username"] == "activeuser"
        assert data["email"] == "active@example.com"

    @pytest.mark.asyncio
    async def test_me_endpoint_unauthenticated(self, client, tenant_headers):
        """Test /me endpoint without authentication."""

        response = client.get(
            "/auth/me",
            headers=tenant_headers,
        )

        assert response.status_code == 401
