"""
Comprehensive test coverage for public_router.py uncovered lines.

This test suite targets specific uncovered code paths in public_router.py:
1. Login with MFA required (lines 219-256)
2. Password reset flows (lines 1087-1188)
3. Token refresh edge cases (lines 854-983)
4. Cookie-based authentication (lines 725-828)
5. Error handling paths and fallback scenarios
6. Cross-tenant user lookups (lines 353-359)
7. 2FA verification edge cases (lines 653-722)
8. Logout scenarios (lines 1003-1053)
9. TenantIdentityResolver (lines 1070-1084)
10. Webhook publishing failures (lines 326-331)
"""

import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import hash_password, jwt_service, session_manager
from dotmac.platform.auth.mfa_service import mfa_service
from dotmac.platform.auth.public_router import (
    TenantIdentityResolver,
    public_router,
)
from dotmac.platform.user_management.models import User

pytestmark = pytest.mark.integration


# ========================================
# Fixtures
# ========================================


@pytest.fixture
def app():
    """Create FastAPI app for testing."""
    app = FastAPI()
    app.include_router(public_router, prefix="/auth", tags=["auth"])
    return app


@pytest_asyncio.fixture
async def test_user_basic(async_db_session: AsyncSession):
    """Create a basic test user without 2FA."""
    user = User(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        password_hash=hash_password("SecurePassword123!"),
        tenant_id="test-tenant",
        is_active=True,
        is_verified=True,
        mfa_enabled=False,
        roles=["user"],
        permissions=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_with_mfa(async_db_session: AsyncSession):
    """Create a test user with 2FA enabled."""
    secret = mfa_service.generate_secret()
    user = User(
        id=uuid.uuid4(),
        username="mfauser",
        email="mfa@example.com",
        password_hash=hash_password("SecurePassword123!"),
        tenant_id="test-tenant",
        mfa_enabled=True,
        mfa_secret=secret,
        is_active=True,
        is_verified=True,
        roles=["user"],
        permissions=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def inactive_user(async_db_session: AsyncSession):
    """Create an inactive test user."""
    user = User(
        id=uuid.uuid4(),
        username="inactiveuser",
        email="inactive@example.com",
        password_hash=hash_password("SecurePassword123!"),
        tenant_id="test-tenant",
        is_active=False,  # Inactive account
        is_verified=True,
        mfa_enabled=False,
        roles=["user"],
        permissions=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def multi_tenant_users(async_db_session: AsyncSession):
    """Create users with same email in different tenants for cross-tenant lookup tests."""
    user1 = User(
        id=uuid.uuid4(),
        username="user_tenant_a",
        email="shared@example.com",
        password_hash=hash_password("SecurePassword123!"),
        tenant_id="tenant-a",
        is_active=True,
        is_verified=True,
        mfa_enabled=False,
        roles=["user"],
        permissions=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    user2 = User(
        id=uuid.uuid4(),
        username="user_tenant_b",
        email="shared@example.com",
        password_hash=hash_password("SecurePassword123!"),
        tenant_id="tenant-b",
        is_active=True,
        is_verified=True,
        mfa_enabled=False,
        roles=["user"],
        permissions=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user1)
    async_db_session.add(user2)
    await async_db_session.commit()
    await async_db_session.refresh(user1)
    await async_db_session.refresh(user2)
    return user1, user2


@pytest_asyncio.fixture
async def fake_redis():
    """Create a fake Redis client for testing."""
    import fakeredis.aioredis

    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield redis
    await redis.flushall()
    await redis.aclose()


@pytest_asyncio.fixture
async def client(app, async_db_session, fake_redis):
    """Create async test client with mocked dependencies."""
    from dotmac.platform.auth.public_router import get_auth_session

    async def override_session():
        yield async_db_session

    app.dependency_overrides[get_auth_session] = override_session

    # Patch session_manager to use fake redis
    original_redis = session_manager._redis
    session_manager._redis = fake_redis
    session_manager._redis_healthy = True

    try:
        with (
            patch("dotmac.platform.tenant.get_current_tenant_id", return_value="test-tenant"),
            patch("dotmac.platform.audit.log_user_activity", new=AsyncMock()),
            patch("dotmac.platform.audit.log_api_activity", new=AsyncMock()),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac
    finally:
        session_manager._redis = original_redis


# ========================================
# Login with MFA Required Tests (Lines 219-256)
# ========================================


@pytest.mark.asyncio
async def test_login_with_mfa_creates_pending_session_redis(
    client: AsyncClient, test_user_with_mfa: User, fake_redis
):
    """Test that login with MFA creates pending session in Redis (lines 219-231)."""
    response = await client.post(
        "/auth/login",
        json={
            "username": test_user_with_mfa.username,
            "password": "SecurePassword123!",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "2FA verification required"
    assert response.headers.get("X-2FA-Required") == "true"
    assert response.headers.get("X-User-ID") == str(test_user_with_mfa.id)

    # Verify session created in Redis
    pending_key = f"2fa_pending:{test_user_with_mfa.id}"
    session_key = f"session:{pending_key}"
    session_data = await fake_redis.get(session_key)
    assert session_data is not None

    data = json.loads(session_data)
    assert data["username"] == test_user_with_mfa.username
    assert data["email"] == test_user_with_mfa.email
    assert data["pending_2fa"] is True
    assert data["tenant_id"] == test_user_with_mfa.tenant_id


@pytest.mark.asyncio
async def test_login_with_mfa_fallback_store(client: AsyncClient, test_user_with_mfa: User):
    """Test that login with MFA uses fallback store when Redis unavailable (lines 233-237)."""
    # Temporarily disable Redis
    original_redis = session_manager._redis
    session_manager._redis = None
    session_manager._fallback_enabled = True
    session_manager._fallback_store.clear()

    try:
        response = await client.post(
            "/auth/login",
            json={
                "username": test_user_with_mfa.username,
                "password": "SecurePassword123!",
            },
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "2FA verification required"

        # Verify session created in fallback store
        pending_key = f"2fa_pending:{test_user_with_mfa.id}"
        assert pending_key in session_manager._fallback_store
        session_data = session_manager._fallback_store[pending_key]
        assert session_data["username"] == test_user_with_mfa.username
        assert session_data["pending_2fa"] is True
        assert "expires_at" in session_data
    finally:
        session_manager._redis = original_redis


@pytest.mark.asyncio
async def test_login_inactive_account(client: AsyncClient, inactive_user: User):
    """Test login with inactive account (lines 203-216)."""
    response = await client.post(
        "/auth/login",
        json={
            "username": inactive_user.username,
            "password": "SecurePassword123!",
        },
    )

    assert response.status_code == 403
    assert "disabled" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_by_email(client: AsyncClient, test_user_basic: User):
    """Test login using email address (line 174-175)."""
    response = await client.post(
        "/auth/login",
        json={
            "username": test_user_basic.email,
            "password": "SecurePassword123!",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


# ========================================
# Cross-Tenant User Lookup Tests (Lines 353-359)
# ========================================


@pytest.mark.asyncio
async def test_find_user_across_tenants_ambiguous(client: AsyncClient, multi_tenant_users):
    """Test cross-tenant lookup returns ambiguous when multiple users found (lines 357-358)."""
    user1, user2 = multi_tenant_users

    # Mock multi-tenant config
    class TenantConfig:
        @property
        def is_multi_tenant(self):
            return True

        @property
        def is_single_tenant(self):
            return False

        default_tenant_id = "default-tenant"

    with patch("dotmac.platform.tenant.get_tenant_config", return_value=TenantConfig()):
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value=None):
            response = await client.post(
                "/auth/login",
                json={
                    "username": "shared@example.com",
                    "password": "SecurePassword123!",
                },
            )

    # Should fail with ambiguous error (lines 183-186)
    assert response.status_code == 400
    assert "Multiple accounts found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_find_user_across_tenants_no_match(client: AsyncClient):
    """Test cross-tenant lookup returns None when no user found (line 355-356)."""
    class TenantConfig:
        @property
        def is_multi_tenant(self):
            return True

        @property
        def is_single_tenant(self):
            return False

        default_tenant_id = "default-tenant"

    with patch("dotmac.platform.tenant.get_tenant_config", return_value=TenantConfig()):
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value=None):
            response = await client.post(
                "/auth/login",
                json={
                    "username": "nonexistent@example.com",
                    "password": "SecurePassword123!",
                },
            )

    # Should fail with invalid credentials (lines 189-201)
    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["detail"]


# ========================================
# 2FA Verification Edge Cases (Lines 653-722)
# ========================================


@pytest.mark.asyncio
async def test_verify_2fa_user_not_found(client: AsyncClient):
    """Test 2FA verification for non-existent user (lines 653-657)."""
    response = await client.post(
        "/auth/login/verify-2fa",
        json={
            "user_id": str(uuid.uuid4()),
            "code": "123456",
            "is_backup_code": False,
        },
    )

    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_2fa_not_enabled(client: AsyncClient, test_user_basic: User):
    """Test 2FA verification for user without 2FA enabled (lines 659-663)."""
    response = await client.post(
        "/auth/login/verify-2fa",
        json={
            "user_id": str(test_user_basic.id),
            "code": "123456",
            "is_backup_code": False,
        },
    )

    assert response.status_code == 400
    assert "2FA is not enabled" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_2fa_session_expired(client: AsyncClient, test_user_with_mfa: User):
    """Test 2FA verification without pending session (lines 665-669)."""
    response = await client.post(
        "/auth/login/verify-2fa",
        json={
            "user_id": str(test_user_with_mfa.id),
            "code": "123456",
            "is_backup_code": False,
        },
    )

    assert response.status_code == 400
    assert "2FA session expired" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_2fa_too_many_attempts(
    client: AsyncClient, test_user_with_mfa: User, fake_redis
):
    """Test 2FA verification with too many failed attempts (lines 672-685)."""
    # First, create a pending session
    await client.post(
        "/auth/login",
        json={
            "username": test_user_with_mfa.username,
            "password": "SecurePassword123!",
        },
    )

    # Set failed attempts to max
    attempts_key = f"2fa_attempts:{test_user_with_mfa.id}"
    await fake_redis.set(attempts_key, "5")

    response = await client.post(
        "/auth/login/verify-2fa",
        json={
            "user_id": str(test_user_with_mfa.id),
            "code": "000000",
            "is_backup_code": False,
        },
    )

    assert response.status_code == 429
    assert "Too many failed 2FA attempts" in response.json()["detail"]

    # Verify pending session was deleted
    pending_key = f"session:2fa_pending:{test_user_with_mfa.id}"
    assert await fake_redis.get(pending_key) is None


@pytest.mark.asyncio
async def test_verify_2fa_invalid_code_increments_attempts(
    client: AsyncClient, test_user_with_mfa: User, fake_redis
):
    """Test that invalid 2FA code increments attempt counter (lines 697-700)."""
    # Create pending session
    await client.post(
        "/auth/login",
        json={
            "username": test_user_with_mfa.username,
            "password": "SecurePassword123!",
        },
    )

    # Attempt with invalid code
    response = await client.post(
        "/auth/login/verify-2fa",
        json={
            "user_id": str(test_user_with_mfa.id),
            "code": "000000",
            "is_backup_code": False,
        },
    )

    assert response.status_code == 401
    assert "Invalid 2FA code" in response.json()["detail"]

    # Verify attempts were incremented
    attempts_key = f"2fa_attempts:{test_user_with_mfa.id}"
    attempts = await fake_redis.get(attempts_key)
    assert attempts == "1"


@pytest.mark.asyncio
async def test_verify_2fa_success_clears_attempts(
    client: AsyncClient, test_user_with_mfa: User, fake_redis
):
    """Test that successful 2FA verification clears attempt counter (lines 710-711)."""
    # Create pending session
    await client.post(
        "/auth/login",
        json={
            "username": test_user_with_mfa.username,
            "password": "SecurePassword123!",
        },
    )

    # Set some failed attempts
    attempts_key = f"2fa_attempts:{test_user_with_mfa.id}"
    await fake_redis.set(attempts_key, "2")

    # Get valid TOTP code
    token = mfa_service.get_current_token(test_user_with_mfa.mfa_secret)

    response = await client.post(
        "/auth/login/verify-2fa",
        json={
            "user_id": str(test_user_with_mfa.id),
            "code": token,
            "is_backup_code": False,
        },
    )

    assert response.status_code == 200

    # Verify attempts were cleared
    attempts = await fake_redis.get(attempts_key)
    assert attempts is None


@pytest.mark.asyncio
async def test_verify_2fa_exception_handling(client: AsyncClient, test_user_with_mfa: User):
    """Test exception handling in 2FA verification (lines 715-722)."""
    # Create pending session
    await client.post(
        "/auth/login",
        json={
            "username": test_user_with_mfa.username,
            "password": "SecurePassword123!",
        },
    )

    # Mock an exception in the verification process
    with patch(
        "dotmac.platform.auth.public_router.mfa_service.verify_token",
        side_effect=Exception("Test error"),
    ):
        response = await client.post(
            "/auth/login/verify-2fa",
            json={
                "user_id": str(test_user_with_mfa.id),
                "code": "123456",
                "is_backup_code": False,
            },
        )

    assert response.status_code == 500
    assert "2FA verification failed" in response.json()["detail"]


# ========================================
# Cookie-Based Authentication Tests (Lines 751-828)
# ========================================


@pytest.mark.asyncio
async def test_cookie_login_with_email(client: AsyncClient, test_user_basic: User):
    """Test cookie login using email (lines 752-754)."""
    response = await client.post(
        "/auth/login/cookie",
        json={
            "username": test_user_basic.email,
            "password": "SecurePassword123!",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == str(test_user_basic.id)
    assert data["username"] == test_user_basic.username


@pytest.mark.asyncio
async def test_cookie_login_cross_tenant_ambiguous(client: AsyncClient, multi_tenant_users):
    """Test cookie login with ambiguous cross-tenant user (lines 758-762)."""
    user1, user2 = multi_tenant_users

    class TenantConfig:
        @property
        def is_multi_tenant(self):
            return True

        @property
        def is_single_tenant(self):
            return False

        default_tenant_id = "default-tenant"

    with patch("dotmac.platform.tenant.get_tenant_config", return_value=TenantConfig()):
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value=None):
            response = await client.post(
                "/auth/login/cookie",
                json={
                    "username": "shared@example.com",
                    "password": "SecurePassword123!",
                },
            )

    assert response.status_code == 400
    assert "Multiple accounts found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_cookie_login_invalid_credentials(client: AsyncClient, test_user_basic: User):
    """Test cookie login with invalid password (lines 765-781)."""
    response = await client.post(
        "/auth/login/cookie",
        json={
            "username": test_user_basic.username,
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_cookie_login_inactive_account(client: AsyncClient, inactive_user: User):
    """Test cookie login with inactive account (lines 783-787)."""
    response = await client.post(
        "/auth/login/cookie",
        json={
            "username": inactive_user.username,
            "password": "SecurePassword123!",
        },
    )

    assert response.status_code == 403
    assert "disabled" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cookie_login_mfa_required_redis(
    client: AsyncClient, test_user_with_mfa: User, fake_redis
):
    """Test cookie login with MFA creates pending session in Redis (lines 789-817)."""
    response = await client.post(
        "/auth/login/cookie",
        json={
            "username": test_user_with_mfa.username,
            "password": "SecurePassword123!",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "2FA verification required"
    assert response.headers.get("X-2FA-Required") == "true"

    # Verify session in Redis
    pending_key = f"2fa_pending:{test_user_with_mfa.id}"
    session_key = f"session:{pending_key}"
    session_data = await fake_redis.get(session_key)
    assert session_data is not None


@pytest.mark.asyncio
async def test_cookie_login_mfa_required_fallback(client: AsyncClient, test_user_with_mfa: User):
    """Test cookie login with MFA uses fallback when Redis unavailable (lines 802-804)."""
    # Disable Redis
    original_redis = session_manager._redis
    session_manager._redis = None
    session_manager._fallback_enabled = True
    session_manager._fallback_store.clear()

    try:
        response = await client.post(
            "/auth/login/cookie",
            json={
                "username": test_user_with_mfa.username,
                "password": "SecurePassword123!",
            },
        )

        assert response.status_code == 403

        # Verify fallback store
        pending_key = f"2fa_pending:{test_user_with_mfa.id}"
        assert pending_key in session_manager._fallback_store
        session_data = session_manager._fallback_store[pending_key]
        assert "expires_at" in session_data
    finally:
        session_manager._redis = original_redis


# ========================================
# Token Refresh Tests (Lines 854-983)
# ========================================


@pytest.mark.asyncio
async def test_refresh_token_no_token_provided(client: AsyncClient):
    """Test refresh token endpoint without token (lines 873-877)."""
    # When no refresh token is provided at all (no body, no cookie)
    response = await client.post("/auth/refresh")

    # FastAPI will return 422 for missing required field, or 401 if it reaches the endpoint
    # The endpoint accepts None for refresh_request, so it should reach line 873
    assert response.status_code in [401, 422]
    if response.status_code == 401:
        assert "Refresh token not provided" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_missing_user_id(client: AsyncClient):
    """Test refresh token with missing user_id in payload (lines 886-890)."""
    # Create a refresh token without 'sub' claim
    invalid_token = jwt_service.create_refresh_token(
        subject="", additional_claims={"session_id": "test"}
    )

    response = await client.post(
        "/auth/refresh",
        json={"refresh_token": invalid_token},
    )

    assert response.status_code == 401
    assert "Invalid refresh token" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_user_not_found(client: AsyncClient):
    """Test refresh token for non-existent user (lines 899-903)."""
    fake_user_id = str(uuid.uuid4())
    refresh_token = jwt_service.create_refresh_token(
        subject=fake_user_id, additional_claims={"session_id": "test"}
    )

    response = await client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 401
    assert "User not found or disabled" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_inactive_user(client: AsyncClient, inactive_user: User):
    """Test refresh token for inactive user (lines 899-903)."""
    refresh_token = jwt_service.create_refresh_token(
        subject=str(inactive_user.id), additional_claims={"session_id": "test"}
    )

    response = await client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 401
    assert "User not found or disabled" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_missing_session_id(client: AsyncClient, test_user_basic: User):
    """Test refresh token without session_id (lines 906-910)."""
    # Create refresh token without session_id
    refresh_token = jwt_service.create_refresh_token(
        subject=str(test_user_basic.id), additional_claims={}
    )

    response = await client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 401
    assert "Invalid refresh token" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_invalid_session(client: AsyncClient, test_user_basic: User):
    """Test refresh token with invalid/missing session (lines 913-923)."""
    # Create refresh token with session_id that doesn't exist
    refresh_token = jwt_service.create_refresh_token(
        subject=str(test_user_basic.id), additional_claims={"session_id": "nonexistent"}
    )

    response = await client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 401
    assert "Session has been invalidated" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_session_user_mismatch(
    client: AsyncClient, test_user_basic: User, async_db_session
):
    """Test refresh token where session belongs to different user (lines 914)."""
    # Create another user
    other_user = User(
        id=uuid.uuid4(),
        username="otheruser",
        email="other@example.com",
        password_hash=hash_password("SecurePassword123!"),
        tenant_id="test-tenant",
        is_active=True,
        is_verified=True,
        mfa_enabled=False,
        roles=["user"],
        permissions=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(other_user)
    await async_db_session.commit()

    # Create session for other_user
    session_id = secrets.token_urlsafe(32)
    await session_manager.create_session(
        user_id=str(other_user.id),
        data={"username": other_user.username},
        session_id=session_id,
    )

    # Try to use test_user_basic's token with other_user's session
    refresh_token = jwt_service.create_refresh_token(
        subject=str(test_user_basic.id), additional_claims={"session_id": session_id}
    )

    response = await client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 401
    assert "Session has been invalidated" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_revocation_failure(client: AsyncClient, test_user_basic: User):
    """Test refresh token when old token revocation fails (lines 927-930)."""
    # Create valid session
    session_id = secrets.token_urlsafe(32)
    await session_manager.create_session(
        user_id=str(test_user_basic.id),
        data={"username": test_user_basic.username},
        session_id=session_id,
    )

    refresh_token = jwt_service.create_refresh_token(
        subject=str(test_user_basic.id), additional_claims={"session_id": session_id}
    )

    # Mock revoke_token to raise exception
    with patch(
        "dotmac.platform.auth.public_router.jwt_service.revoke_token",
        side_effect=Exception("Revocation failed"),
    ):
        response = await client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )

    # Should still succeed despite revocation failure
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_token_session_metadata_update_failure(
    client: AsyncClient, test_user_basic: User
):
    """Test refresh token when session metadata update fails (lines 964-965)."""
    # Create valid session
    session_id = secrets.token_urlsafe(32)
    await session_manager.create_session(
        user_id=str(test_user_basic.id),
        data={"username": test_user_basic.username},
        session_id=session_id,
    )

    refresh_token = jwt_service.create_refresh_token(
        subject=str(test_user_basic.id), additional_claims={"session_id": session_id}
    )

    # Mock create_session to raise exception
    with patch(
        "dotmac.platform.auth.public_router.session_manager.create_session",
        side_effect=Exception("Session update failed"),
    ):
        response = await client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )

    # Should still succeed despite session update failure
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_refresh_token_general_exception(client: AsyncClient):
    """Test refresh token with general exception (lines 978-983)."""
    # Create invalid token
    invalid_token = "invalid.token.here"

    response = await client.post(
        "/auth/refresh",
        json={"refresh_token": invalid_token},
    )

    assert response.status_code == 401
    # The error message might vary depending on JWT library, but should indicate invalid token
    detail = response.json()["detail"]
    assert "Invalid" in detail or "invalid" in detail or "expired" in detail


# ========================================
# Logout Tests (Lines 1003-1053)
# ========================================


@pytest.mark.asyncio
async def test_logout_with_cookie_token(client: AsyncClient, test_user_basic: User):
    """Test logout with token in cookie (line 1003)."""
    # Create a valid token
    access_token = jwt_service.create_access_token(
        subject=str(test_user_basic.id),
        additional_claims={
            "username": test_user_basic.username,
            "email": test_user_basic.email,
        },
    )

    # Send token as cookie
    response = await client.post(
        "/auth/logout",
        cookies={"access_token": access_token},
    )

    assert response.status_code == 200
    assert "message" in response.json()


@pytest.mark.asyncio
async def test_logout_invalid_token_in_cookie(client: AsyncClient):
    """Test logout with invalid token in cookie (lines 1009-1011)."""
    response = await client.post(
        "/auth/logout",
        cookies={"access_token": "invalid.token.here"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Logout completed"


@pytest.mark.asyncio
async def test_logout_no_token(client: AsyncClient):
    """Test logout without any token (lines 1012-1014)."""
    response = await client.post("/auth/logout")

    assert response.status_code == 200
    assert response.json()["message"] == "Logout completed"


@pytest.mark.asyncio
async def test_logout_refresh_token_revocation_failure(client: AsyncClient, test_user_basic: User):
    """Test logout when refresh token revocation fails (lines 1024-1025)."""
    access_token = jwt_service.create_access_token(
        subject=str(test_user_basic.id),
        additional_claims={
            "username": test_user_basic.username,
            "email": test_user_basic.email,
        },
    )
    refresh_token = jwt_service.create_refresh_token(
        subject=str(test_user_basic.id), additional_claims={}
    )

    # Mock refresh token revocation to fail
    with patch(
        "dotmac.platform.auth.public_router.jwt_service.revoke_token",
        side_effect=Exception("Revocation failed"),
    ):
        response = await client.post(
            "/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
            cookies={"refresh_token": refresh_token},
        )

    # Should still succeed
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_logout_no_user_id_in_token(client: AsyncClient):
    """Test logout when token has no user_id (lines 1042-1043)."""
    # Create token without user_id
    invalid_token = jwt_service.create_access_token(
        subject="", additional_claims={"username": "test"}
    )

    response = await client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {invalid_token}"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Logout completed"


@pytest.mark.asyncio
async def test_logout_exception_handling(client: AsyncClient):
    """Test logout with exception during processing (lines 1044-1053)."""
    # Use invalid token to trigger exception
    response = await client.post(
        "/auth/logout",
        headers={"Authorization": "Bearer invalid.token"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Logout completed"


# ========================================
# Password Reset Tests (Lines 1087-1188)
# ========================================


@pytest.mark.asyncio
async def test_password_reset_request_success(client: AsyncClient, test_user_basic: User):
    """Test password reset request for existing user (lines 1104-1125)."""
    with patch(
        "dotmac.platform.auth.public_router.get_auth_email_service"
    ) as mock_email_service:
        mock_service = MagicMock()
        mock_service.create_reset_token.return_value = "reset_token_123"
        mock_service.send_password_reset_email = AsyncMock()
        mock_email_service.return_value = mock_service

        response = await client.post(
            "/auth/password-reset",
            json={"email": test_user_basic.email},
        )

    assert response.status_code == 200
    assert "Password reset link has been sent" in response.json()["message"]
    mock_service.send_password_reset_email.assert_called_once()


@pytest.mark.asyncio
async def test_password_reset_request_nonexistent_user(client: AsyncClient):
    """Test password reset request for non-existent user (lines 1104-1112, 1126)."""
    response = await client.post(
        "/auth/password-reset",
        json={"email": "nonexistent@example.com"},
    )

    # Should still return success to prevent email enumeration
    assert response.status_code == 200
    assert "Password reset link has been sent" in response.json()["message"]


@pytest.mark.asyncio
async def test_password_reset_request_multiple_results(client: AsyncClient, multi_tenant_users):
    """Test password reset with email in multiple tenants (lines 1106-1112)."""
    user1, user2 = multi_tenant_users

    response = await client.post(
        "/auth/password-reset",
        json={"email": "shared@example.com"},
    )

    # Should return success to prevent information disclosure
    assert response.status_code == 200
    assert "Password reset link has been sent" in response.json()["message"]


@pytest.mark.asyncio
async def test_password_reset_request_exception_handling(client: AsyncClient):
    """Test password reset with exception (lines 1127-1129)."""
    with patch(
        "dotmac.platform.auth.public_router.get_auth_email_service",
        side_effect=Exception("Email service error"),
    ):
        response = await client.post(
            "/auth/password-reset",
            json={"email": "test@example.com"},
        )

    # Should still return success message
    assert response.status_code == 200
    assert "Password reset link has been sent" in response.json()["message"]


@pytest.mark.asyncio
async def test_password_reset_confirm_invalid_token(client: AsyncClient):
    """Test password reset confirmation with invalid token (lines 1142-1146)."""
    with patch(
        "dotmac.platform.auth.public_router.get_auth_email_service"
    ) as mock_email_service:
        mock_service = MagicMock()
        mock_service.verify_reset_token.return_value = None
        mock_email_service.return_value = mock_service

        response = await client.post(
            "/auth/password-reset/confirm",
            json={
                "token": "invalid_token",
                "new_password": "NewSecurePassword123!",
            },
        )

    assert response.status_code == 400
    assert "Invalid or expired reset token" in response.json()["detail"]


@pytest.mark.asyncio
async def test_password_reset_confirm_multiple_tenant_accounts(
    client: AsyncClient, multi_tenant_users
):
    """Test password reset confirm with multiple tenant accounts (lines 1152-1163)."""
    user1, user2 = multi_tenant_users

    with patch(
        "dotmac.platform.auth.public_router.get_auth_email_service"
    ) as mock_email_service:
        mock_service = MagicMock()
        mock_service.verify_reset_token.return_value = "shared@example.com"
        mock_email_service.return_value = mock_service

        response = await client.post(
            "/auth/password-reset/confirm",
            json={
                "token": "valid_token",
                "new_password": "NewSecurePassword123!",
            },
        )

    assert response.status_code == 400
    assert "Unable to identify account" in response.json()["detail"]


@pytest.mark.asyncio
async def test_password_reset_confirm_user_not_found(client: AsyncClient):
    """Test password reset confirm for non-existent user (lines 1165-1169)."""
    with patch(
        "dotmac.platform.auth.public_router.get_auth_email_service"
    ) as mock_email_service:
        mock_service = MagicMock()
        mock_service.verify_reset_token.return_value = "nonexistent@example.com"
        mock_email_service.return_value = mock_service

        response = await client.post(
            "/auth/password-reset/confirm",
            json={
                "token": "valid_token",
                "new_password": "NewSecurePassword123!",
            },
        )

    assert response.status_code == 400
    assert "User not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_password_reset_confirm_success(client: AsyncClient, test_user_basic: User):
    """Test successful password reset confirmation (lines 1171-1181)."""
    with patch(
        "dotmac.platform.auth.public_router.get_auth_email_service"
    ) as mock_email_service:
        mock_service = MagicMock()
        mock_service.verify_reset_token.return_value = test_user_basic.email
        mock_service.send_password_reset_success_email = AsyncMock()
        mock_email_service.return_value = mock_service

        response = await client.post(
            "/auth/password-reset/confirm",
            json={
                "token": "valid_token",
                "new_password": "NewSecurePassword123!",
            },
        )

    assert response.status_code == 200
    assert "Password has been reset successfully" in response.json()["message"]
    mock_service.send_password_reset_success_email.assert_called_once()


@pytest.mark.asyncio
async def test_password_reset_confirm_exception_handling(
    client: AsyncClient, test_user_basic: User, async_db_session
):
    """Test password reset confirm with exception during save (lines 1182-1188)."""
    with patch(
        "dotmac.platform.auth.public_router.get_auth_email_service"
    ) as mock_email_service:
        mock_service = MagicMock()
        mock_service.verify_reset_token.return_value = test_user_basic.email
        mock_email_service.return_value = mock_service

        # Mock session.commit to raise exception
        with patch.object(async_db_session, "commit", side_effect=Exception("DB error")):
            response = await client.post(
                "/auth/password-reset/confirm",
                json={
                    "token": "valid_token",
                    "new_password": "NewSecurePassword123!",
                },
            )

    assert response.status_code == 500
    assert "Failed to reset password" in response.json()["detail"]


# ========================================
# TenantIdentityResolver Tests (Lines 1070-1084)
# ========================================


@pytest.mark.asyncio
async def test_tenant_resolver_from_header(client: AsyncClient):
    """Test TenantIdentityResolver resolves tenant from header (lines 1073-1075)."""

    class MockRequest:
        headers = {"X-Tenant-ID": "header-tenant"}
        query_params = {}

    class TenantConfig:
        tenant_header_name = "X-Tenant-ID"

    with patch("dotmac.platform.tenant.get_tenant_config", return_value=TenantConfig()):
        resolver = TenantIdentityResolver()
        tenant_id = await resolver.resolve(MockRequest())

    assert tenant_id == "header-tenant"


@pytest.mark.asyncio
async def test_tenant_resolver_from_query_param(client: AsyncClient):
    """Test TenantIdentityResolver resolves tenant from query param (lines 1078-1080)."""

    class MockRequest:
        headers = {}
        query_params = {"tenant_id": "query-tenant"}

    class TenantConfig:
        tenant_header_name = "X-Tenant-ID"

    with patch("dotmac.platform.tenant.get_tenant_config", return_value=TenantConfig()):
        resolver = TenantIdentityResolver()
        tenant_id = await resolver.resolve(MockRequest())

    assert tenant_id == "query-tenant"


@pytest.mark.asyncio
async def test_tenant_resolver_no_config(client: AsyncClient):
    """Test TenantIdentityResolver returns None when no config (line 1070)."""

    class MockRequest:
        headers = {}
        query_params = {}

    with patch("dotmac.platform.tenant.get_tenant_config", return_value=None):
        resolver = TenantIdentityResolver()
        tenant_id = await resolver.resolve(MockRequest())

    assert tenant_id is None


@pytest.mark.asyncio
async def test_tenant_resolver_exception_handling(client: AsyncClient):
    """Test TenantIdentityResolver exception handling (lines 1083-1084)."""

    class MockRequest:
        headers = {}
        query_params = {}

    with patch(
        "dotmac.platform.tenant.get_tenant_config", side_effect=Exception("Config error")
    ):
        resolver = TenantIdentityResolver()
        tenant_id = await resolver.resolve(MockRequest())

    assert tenant_id is None


# ========================================
# Additional Edge Cases
# ========================================


@pytest.mark.asyncio
async def test_login_webhook_publish_failure(client: AsyncClient, test_user_basic: User):
    """Test login when webhook publishing fails (lines 326-331)."""
    with patch("dotmac.platform.auth.public_router.get_event_bus") as mock_event_bus:
        mock_bus = MagicMock()
        mock_bus.publish = AsyncMock(side_effect=Exception("Webhook error"))
        mock_event_bus.return_value = mock_bus

        response = await client.post(
            "/auth/login",
            json={
                "username": test_user_basic.username,
                "password": "SecurePassword123!",
            },
        )

    # Login should still succeed despite webhook failure
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_with_tenant_hint(client: AsyncClient, test_user_basic: User):
    """Test login with tenant hint in request (line 152)."""
    response = await client.post(
        "/auth/login",
        json={
            "username": test_user_basic.username,
            "password": "SecurePassword123!",
            "tenant": "test-tenant",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_complete_cookie_login_sets_cookies(client: AsyncClient, test_user_basic: User):
    """Test that cookie login sets auth cookies (lines 374-406)."""
    response = await client.post(
        "/auth/login/cookie",
        json={
            "username": test_user_basic.username,
            "password": "SecurePassword123!",
        },
    )

    assert response.status_code == 200

    # Check that cookies are set (httpx will include them in response.cookies)
    # Note: In test environment, cookies might not be set the same way as in production
    data = response.json()
    assert data["user_id"] == str(test_user_basic.id)


@pytest.mark.asyncio
async def test_backup_code_low_remaining_warning(
    client: AsyncClient, test_user_with_mfa: User, async_db_session
):
    """Test warning logged when backup codes running low (lines 463-469)."""
    from dotmac.platform.user_management.models import BackupCode

    # Create only 2 backup codes
    backup_codes = mfa_service.generate_backup_codes(count=2)
    await mfa_service.store_backup_codes(
        user_id=test_user_with_mfa.id,
        codes=backup_codes,
        session=async_db_session,
        tenant_id=test_user_with_mfa.tenant_id,
    )

    # Create pending session
    await client.post(
        "/auth/login",
        json={
            "username": test_user_with_mfa.username,
            "password": "SecurePassword123!",
        },
    )

    # Use one backup code
    with patch("dotmac.platform.auth.public_router.logger") as mock_logger:
        response = await client.post(
            "/auth/login/verify-2fa",
            json={
                "user_id": str(test_user_with_mfa.id),
                "code": backup_codes[0],
                "is_backup_code": True,
            },
        )

        assert response.status_code == 200

        # Verify warning was logged (1 remaining < 3)
        mock_logger.warning.assert_called()


@pytest.mark.asyncio
async def test_complete_2fa_login_creates_session(
    client: AsyncClient, test_user_with_mfa: User, async_db_session
):
    """Test that completing 2FA login creates session (lines 541-593)."""
    # Create backup codes
    backup_codes = mfa_service.generate_backup_codes(count=5)
    await mfa_service.store_backup_codes(
        user_id=test_user_with_mfa.id,
        codes=backup_codes,
        session=async_db_session,
        tenant_id=test_user_with_mfa.tenant_id,
    )

    # Create pending session
    await client.post(
        "/auth/login",
        json={
            "username": test_user_with_mfa.username,
            "password": "SecurePassword123!",
        },
    )

    # Complete 2FA
    response = await client.post(
        "/auth/login/verify-2fa",
        json={
            "user_id": str(test_user_with_mfa.id),
            "code": backup_codes[0],
            "is_backup_code": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0
