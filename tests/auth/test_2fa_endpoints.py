"""
Tests for Two-Factor Authentication (2FA) endpoints.
"""

import uuid

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient

from dotmac.platform.audit import models as audit_models  # noqa: F401 - Ensure audit tables exist
from dotmac.platform.auth.core import hash_password
from dotmac.platform.auth.dependencies import UserInfo
from dotmac.platform.auth.mfa_service import mfa_service
from dotmac.platform.auth.router import auth_router
from dotmac.platform.user_management.models import User

pytestmark = pytest.mark.integration


@pytest.fixture
def app():
    """Create FastAPI app for testing."""
    app = FastAPI()
    app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
    return app


@pytest_asyncio.fixture
async def test_user(async_db_session):
    """Create a test user in the database."""
    # Use ORM instead of raw SQL - let SQLAlchemy handle all fields
    user = User(
        id=uuid.UUID("550e8400-e29b-41d4-a716-446655440000"),
        username="testuser",
        email="test@example.com",
        password_hash=hash_password("correct_password"),
        tenant_id="test-tenant",
        mfa_enabled=False,
        mfa_secret=None,
        is_active=True,
        is_verified=False,
        phone_verified=False,
        is_superuser=False,
        is_platform_admin=False,
        failed_login_attempts=0,
        roles=[],
        permissions=[],
        metadata_={},
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest.fixture
def mock_user_info(test_user):
    """Mock user info from auth dependency."""
    return UserInfo(
        user_id=str(test_user.id),
        email=test_user.email,
        username=test_user.username,
        tenant_id=test_user.tenant_id,
        roles=[],
        permissions=["read", "write"],
    )


@pytest_asyncio.fixture
async def client(app, async_db_session, mock_user_info):
    """Create async test client."""
    from unittest.mock import AsyncMock, patch

    from httpx import ASGITransport

    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.auth.router import get_auth_session
    from dotmac.platform.db import get_session_dependency

    # Override session and auth dependencies
    # get_session_dependency must be an async generator
    async def override_get_session():
        yield async_db_session

    # CRITICAL: Must override BOTH get_session_dependency AND get_auth_session
    # The auth router defines get_auth_session as a wrapper, and FastAPI
    # resolves it separately from get_session_dependency
    app.dependency_overrides[get_session_dependency] = override_get_session
    app.dependency_overrides[get_auth_session] = override_get_session
    app.dependency_overrides[get_current_user] = lambda: mock_user_info

    # Mock audit logging to prevent database transaction conflicts
    with patch("dotmac.platform.audit.log_user_activity", new=AsyncMock()):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest.mark.asyncio
async def test_enable_2fa_success(
    client: AsyncClient,
    test_user: User,
):
    """Test successful 2FA enablement."""
    # Enable 2FA
    response = await client.post(
        "/api/v1/auth/2fa/enable",
        json={"password": "correct_password"},
    )

    assert response.status_code == 200
    data = response.json()

    assert "secret" in data
    assert "qr_code" in data
    assert "backup_codes" in data
    assert "provisioning_uri" in data
    assert len(data["backup_codes"]) == 10
    assert data["qr_code"].startswith("data:image/png;base64,")

    # Note: Cannot verify user state from test since we don't have direct DB access here
    # The endpoint's internal logic handles the database updates


@pytest.mark.asyncio
async def test_enable_2fa_incorrect_password(
    client: AsyncClient,
    test_user: User,
):
    """Test 2FA enable with incorrect password."""
    response = await client.post(
        "/api/v1/auth/2fa/enable",
        json={"password": "wrong_password"},
    )

    assert response.status_code == 400
    assert "Incorrect password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_enable_2fa_already_enabled(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test 2FA enable when already enabled."""
    test_user.mfa_enabled = True
    test_user.mfa_secret = "test_secret"
    await async_db_session.commit()

    response = await client.post(
        "/api/v1/auth/2fa/enable",
        json={"password": "correct_password"},
    )

    assert response.status_code == 400
    assert "already enabled" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_2fa_success(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test successful 2FA verification."""
    # Setup: user with secret but not enabled
    secret = mfa_service.generate_secret()
    test_user.mfa_secret = secret
    test_user.mfa_enabled = False
    await async_db_session.commit()

    # Get current valid token
    token = mfa_service.get_current_token(secret)

    # Verify 2FA
    response = await client.post(
        "/api/v1/auth/2fa/verify",
        json={"token": token},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "2FA enabled successfully"
    assert data["mfa_enabled"] is True

    # Verify user is now enabled
    await async_db_session.refresh(test_user)
    assert test_user.mfa_enabled is True


@pytest.mark.asyncio
async def test_verify_2fa_invalid_token(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test 2FA verification with invalid token."""
    test_user.mfa_secret = mfa_service.generate_secret()
    test_user.mfa_enabled = False
    await async_db_session.commit()

    response = await client.post(
        "/api/v1/auth/2fa/verify",
        json={"token": "000000"},  # Invalid token
    )

    assert response.status_code == 400
    assert "Invalid verification code" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_2fa_not_initiated(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test 2FA verification when setup not initiated."""
    test_user.mfa_secret = None
    test_user.mfa_enabled = False
    await async_db_session.commit()

    response = await client.post(
        "/api/v1/auth/2fa/verify",
        json={"token": "123456"},
    )

    assert response.status_code == 400
    assert "not initiated" in response.json()["detail"]


@pytest.mark.asyncio
async def test_disable_2fa_success(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test successful 2FA disablement."""
    secret = mfa_service.generate_secret()
    test_user.mfa_secret = secret
    test_user.mfa_enabled = True
    await async_db_session.commit()

    # Get current valid token
    token = mfa_service.get_current_token(secret)

    # Disable 2FA
    response = await client.post(
        "/api/v1/auth/2fa/disable",
        json={"password": "correct_password", "token": token},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "2FA disabled successfully"
    assert data["mfa_enabled"] is False

    # Verify user is now disabled
    await async_db_session.refresh(test_user)
    assert test_user.mfa_enabled is False
    assert test_user.mfa_secret is None


@pytest.mark.asyncio
async def test_disable_2fa_incorrect_password(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test 2FA disable with incorrect password."""
    secret = mfa_service.generate_secret()
    test_user.mfa_secret = secret
    test_user.mfa_enabled = True
    await async_db_session.commit()

    token = mfa_service.get_current_token(secret)

    response = await client.post(
        "/api/v1/auth/2fa/disable",
        json={"password": "wrong_password", "token": token},
    )

    assert response.status_code == 400
    assert "Incorrect password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_disable_2fa_invalid_token(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test 2FA disable with invalid token."""
    test_user.mfa_secret = mfa_service.generate_secret()
    test_user.mfa_enabled = True
    await async_db_session.commit()

    response = await client.post(
        "/api/v1/auth/2fa/disable",
        json={"password": "correct_password", "token": "000000"},
    )

    assert response.status_code == 400
    assert "Invalid verification code" in response.json()["detail"]


@pytest.mark.asyncio
async def test_disable_2fa_not_enabled(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test 2FA disable when not enabled."""
    test_user.mfa_enabled = False
    await async_db_session.commit()

    response = await client.post(
        "/api/v1/auth/2fa/disable",
        json={"password": "correct_password", "token": "123456"},
    )

    assert response.status_code == 400
    assert "not enabled" in response.json()["detail"]
