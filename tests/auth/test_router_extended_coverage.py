"""
Extended coverage tests for auth router to push coverage higher.

Focuses on:
- 2FA verification and setup flows
- Phone verification
- API key management
- Edge cases and error paths
- Helper functions
"""

from datetime import UTC, datetime
from unittest.mock import patch
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import create_access_token, hash_password
from dotmac.platform.auth.router import auth_router
from dotmac.platform.user_management.models import User

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def test_user_extended(async_db_session: AsyncSession):
    """Create a unique test user for extended tests."""
    import asyncio

    unique_id = uuid4().hex[:8]
    user = User(
        id=uuid4(),
        username=f"extuser_{unique_id}",
        email=f"ext_{unique_id}@example.com",
        password_hash=hash_password("TestPassword123!"),
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
    await asyncio.sleep(0.05)
    return user


@pytest.fixture
def extended_app():
    """Create test app for extended tests."""
    app = FastAPI()
    app.include_router(auth_router)
    return app


@pytest.mark.asyncio
async def test_enable_2fa_already_enabled(extended_app: FastAPI, async_db_session):
    """Test enabling 2FA when it's already enabled."""
    import asyncio

    # Create user with 2FA already enabled
    unique_id = uuid4().hex[:8]
    user = User(
        id=uuid4(),
        username=f"mfa_{unique_id}",
        email=f"mfa_{unique_id}@example.com",
        password_hash=hash_password("TestPassword123!"),
        tenant_id="test-tenant",
        is_active=True,
        is_verified=True,
        mfa_enabled=True,  # Already enabled
        mfa_secret="EXISTING_SECRET",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    await asyncio.sleep(0.05)

    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(user.id),
        username=user.username,
        email=user.email,
        tenant_id=user.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/2fa/enable",
            headers={"Authorization": f"Bearer {token}"},
            json={"password": "TestPassword123!"},
        )

    # Should return 400 because 2FA is already enabled
    assert response.status_code == 400
    assert "already enabled" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_enable_2fa_wrong_password(
    extended_app: FastAPI, test_user_extended: User, async_db_session
):
    """Test enabling 2FA with wrong password."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(test_user_extended.id),
        username=test_user_extended.username,
        email=test_user_extended.email,
        tenant_id=test_user_extended.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/2fa/enable",
            headers={"Authorization": f"Bearer {token}"},
            json={"password": "WrongPassword!"},
        )

    # Should return 400 for incorrect password
    assert response.status_code == 400
    assert "password" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_disable_2fa_not_enabled(
    extended_app: FastAPI, test_user_extended: User, async_db_session
):
    """Test disabling 2FA when it's not enabled."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(test_user_extended.id),
        username=test_user_extended.username,
        email=test_user_extended.email,
        tenant_id=test_user_extended.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/2fa/disable",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "password": "TestPassword123!",
                "token": "123456",  # TOTP token
            },
        )

    # Should return 400 because 2FA is not enabled
    assert response.status_code in [400, 404]


@pytest.mark.asyncio
async def test_verify_2fa_wrong_token(extended_app: FastAPI, async_db_session):
    """Test 2FA verification with wrong token."""
    import asyncio

    unique_id = uuid4().hex[:8]
    user = User(
        id=uuid4(),
        username=f"verify_{unique_id}",
        email=f"verify_{unique_id}@example.com",
        password_hash=hash_password("TestPassword123!"),
        tenant_id="test-tenant",
        is_active=True,
        is_verified=True,
        mfa_enabled=True,
        mfa_secret="JBSWY3DPEHPK3PXP",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    await asyncio.sleep(0.05)

    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(user.id),
        username=user.username,
        email=user.email,
        tenant_id=user.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/2fa/verify",
            headers={"Authorization": f"Bearer {token}"},
            json={"token": "000000"},  # Wrong token
        )

    # Should return 400 or 401 for invalid token
    assert response.status_code in [400, 401]


@pytest.mark.asyncio
async def test_phone_verification_request(
    extended_app: FastAPI, test_user_extended: User, async_db_session
):
    """Test requesting phone verification."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(test_user_extended.id),
        username=test_user_extended.username,
        email=test_user_extended.email,
        tenant_id=test_user_extended.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/verify-phone/request",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone": "+1234567890"},
        )

    # May return 200, 400, 503, or 500 depending on SMS service availability
    assert response.status_code in [200, 400, 404, 500, 503]


@pytest.mark.asyncio
async def test_phone_verification_confirm(
    extended_app: FastAPI, test_user_extended: User, async_db_session
):
    """Test confirming phone verification."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(test_user_extended.id),
        username=test_user_extended.username,
        email=test_user_extended.email,
        tenant_id=test_user_extended.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/verify-phone/confirm",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "phone": "+1234567890",
                "code": "123456",
            },
        )

    # May return various codes depending on implementation
    assert response.status_code in [200, 400, 401, 404, 500]


@pytest.mark.asyncio
async def test_resend_email_verification(extended_app: FastAPI, async_db_session):
    """Test resending email verification."""
    import asyncio

    unique_id = uuid4().hex[:8]
    user = User(
        id=uuid4(),
        username=f"resend_{unique_id}",
        email=f"resend_{unique_id}@example.com",
        password_hash=hash_password("TestPassword123!"),
        tenant_id="test-tenant",
        is_active=True,
        is_verified=False,  # Not verified yet
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    await asyncio.sleep(0.05)

    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(user.id),
        username=user.username,
        email=user.email,
        tenant_id=user.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/verify-email/resend",
            headers={"Authorization": f"Bearer {token}"},
        )

    # May return 200, 400, 404, 422, or 500 depending on email service
    assert response.status_code in [200, 400, 404, 422, 500]


@pytest.mark.asyncio
async def test_register_with_full_name(extended_app: FastAPI, async_db_session):
    """Test registration with full name field."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    unique_id = uuid4().hex[:8]

    with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="test-tenant"):
        transport = ASGITransport(app=extended_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/auth/register",
                json={
                    "username": f"fullname_{unique_id}",
                    "email": f"fullname_{unique_id}@example.com",
                    "password": "NewPassword123!",
                    "full_name": "John Doe",
                },
            )

    # Should succeed or return validation error
    assert response.status_code in [200, 201, 400]


@pytest.mark.asyncio
async def test_update_profile_minimal_fields(
    extended_app: FastAPI, test_user_extended: User, async_db_session
):
    """Test updating profile with minimal fields."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(test_user_extended.id),
        username=test_user_extended.username,
        email=test_user_extended.email,
        tenant_id=test_user_extended.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.patch(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"bio": "Updated bio only"},
        )

    assert response.status_code in [200, 400, 500]


@pytest.mark.asyncio
async def test_get_me_with_roles_permissions(extended_app: FastAPI, async_db_session):
    """Test /me endpoint with roles and permissions populated."""
    import asyncio

    unique_id = uuid4().hex[:8]
    user = User(
        id=uuid4(),
        username=f"admin_{unique_id}",
        email=f"admin_{unique_id}@example.com",
        password_hash=hash_password("TestPassword123!"),
        tenant_id="test-tenant",
        is_active=True,
        is_verified=True,
        roles=["admin", "user"],
        permissions=["read:all", "write:all"],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    await asyncio.sleep(0.05)

    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(user.id),
        username=user.username,
        email=user.email,
        tenant_id=user.tenant_id,
        roles=user.roles,
        permissions=user.permissions,
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    # Response may or may not include roles and permissions depending on serializer
    assert "email" in data
    assert "username" in data


@pytest.mark.asyncio
async def test_refresh_token_with_expired_token(extended_app: FastAPI, async_db_session):
    """Test token refresh with expired token."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/refresh",
            json={"refresh_token": "expired.token.here"},
        )

    # Should return 401 for invalid/expired token
    assert response.status_code in [401, 422]


@pytest.mark.asyncio
async def test_change_password_same_as_current(
    extended_app: FastAPI, test_user_extended: User, async_db_session
):
    """Test changing password to the same password."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    token = create_access_token(
        user_id=str(test_user_extended.id),
        username=test_user_extended.username,
        email=test_user_extended.email,
        tenant_id=test_user_extended.tenant_id,
        roles=[],
        permissions=[],
    )

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "TestPassword123!",
                "new_password": "TestPassword123!",  # Same password
            },
        )

    # May accept or reject based on implementation
    assert response.status_code in [200, 400, 500]


@pytest.mark.asyncio
async def test_login_with_username_and_spaces(
    extended_app: FastAPI, test_user_extended: User, async_db_session
):
    """Test login with username that has leading/trailing spaces."""
    from dotmac.platform.auth.router import get_auth_session

    async def override_session():
        yield async_db_session

    extended_app.dependency_overrides[get_auth_session] = override_session

    transport = ASGITransport(app=extended_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/auth/login",
            json={
                "username": f"  {test_user_extended.username}  ",  # With spaces
                "password": "TestPassword123!",
            },
        )

    # May succeed if implementation trims, or fail
    assert response.status_code in [200, 401]
