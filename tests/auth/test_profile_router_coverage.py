"""
Comprehensive tests for profile_router.py to improve coverage.

This test suite focuses on uncovered code paths in profile_router.py:
1. Helper functions (_tenant_scope_kwargs, _validate_username_email_conflicts, etc.)
2. Error handling paths in profile endpoints
3. Edge cases for avatar upload/delete
4. Profile update with conflict validation
5. Session management endpoints with error scenarios
6. Change password endpoint with various edge cases

Target coverage: Lines currently missing (40.86% -> 85%+)
"""

import io
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, create_access_token, hash_password
from dotmac.platform.auth.profile_router import (
    _build_profile_response,
    _collect_profile_changes,
    _log_profile_change_history,
    _prepare_name_fields,
    _tenant_scope_kwargs,
    _validate_username_email_conflicts,
    profile_router,
)
from dotmac.platform.auth.schemas import ChangePasswordRequest, UpdateProfileRequest
from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService

pytestmark = pytest.mark.integration


# ========================================
# Fixtures
# ========================================


@pytest.fixture
def profile_app():
    """Create FastAPI app with profile router."""
    app = FastAPI()
    app.include_router(profile_router, prefix="/api/v1/auth", tags=["profile"])
    return app


@pytest_asyncio.fixture
async def test_user(async_db_session: AsyncSession):
    """Create a test user in the database."""
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()

    user = User(
        id=user_id,
        username="testuser",
        email="test@example.com",
        password_hash=hash_password("OldPassword123!"),
        tenant_id=str(tenant_id),  # Convert to string for SQLite
        is_active=True,
        is_verified=True,
        mfa_enabled=False,
        full_name="Test User",
        first_name="Test",
        last_name="User",
        phone="+1234567890",
        location="Test City",
        timezone="America/New_York",
        language="en",
        bio="Test bio",
        website="https://example.com",
        avatar_url=None,
        roles=["user"],
        permissions=["read:profile"],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def platform_admin_user(async_db_session: AsyncSession):
    """Create a platform admin user."""
    user_id = uuid.uuid4()

    user = User(
        id=user_id,
        username="adminuser",
        email="admin@example.com",
        password_hash=hash_password("AdminPassword123!"),
        tenant_id=None,  # Platform admin has no tenant
        is_active=True,
        is_verified=True,
        is_platform_admin=True,
        mfa_enabled=False,
        roles=["platform_admin"],
        permissions=["*"],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def mfa_enabled_user(async_db_session: AsyncSession):
    """Create a user with MFA enabled."""
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()

    user = User(
        id=user_id,
        username="mfauser",
        email="mfa@example.com",
        password_hash=hash_password("MfaPassword123!"),
        tenant_id=str(tenant_id),  # Convert to string for SQLite
        is_active=True,
        is_verified=True,
        mfa_enabled=True,
        mfa_secret="JBSWY3DPEHPK3PXP",
        roles=["user"],
        permissions=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers with JWT token."""
    access_token = create_access_token(
        user_id=str(test_user.id),
        email=test_user.email,
        username=test_user.username,
        tenant_id=str(test_user.tenant_id),
        roles=test_user.roles or [],
        permissions=test_user.permissions or [],
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def admin_headers(platform_admin_user):
    """Create authentication headers for platform admin."""
    access_token = create_access_token(
        user_id=str(platform_admin_user.id),
        email=platform_admin_user.email,
        username=platform_admin_user.username,
        tenant_id=None,
        roles=platform_admin_user.roles or [],
        permissions=platform_admin_user.permissions or [],
        is_platform_admin=True,
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def client(profile_app, async_db_session):
    """Create async test client with mocked dependencies."""
    from dotmac.platform.db import get_session_dependency

    async def override_get_session():
        yield async_db_session

    profile_app.dependency_overrides[get_session_dependency] = override_get_session

    # Mock storage service
    storage_mock = AsyncMock()
    storage_mock.store_file = AsyncMock(return_value="mock-file-id-12345")
    storage_mock.delete_file = AsyncMock(return_value=None)

    with (
        patch("dotmac.platform.file_storage.service.get_storage_service", return_value=storage_mock),
        patch("dotmac.platform.audit.log_user_activity", new=AsyncMock()),
    ):
        transport = ASGITransport(app=profile_app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            ac.storage_mock = storage_mock  # type: ignore[attr-defined]
            yield ac


# ========================================
# Helper Functions Tests
# ========================================


def test_tenant_scope_kwargs_with_tenant_override():
    """Test _tenant_scope_kwargs with tenant_override parameter."""
    result = _tenant_scope_kwargs(tenant_override="custom-tenant")
    assert result == {"tenant_id": "custom-tenant"}


def test_tenant_scope_kwargs_with_none_user():
    """Test _tenant_scope_kwargs with None user_info."""
    result = _tenant_scope_kwargs(user_info=None)
    assert result == {"tenant_id": None}


def test_tenant_scope_kwargs_with_platform_admin():
    """Test _tenant_scope_kwargs with platform admin user."""
    # Create a mock UserInfo-like object with is_platform_admin=True
    class MockUserInfo:
        def __init__(self):
            self.user_id = uuid.uuid4()
            self.username = "admin"
            self.email = "admin@example.com"
            self.tenant_id = None
            self.roles = ["platform_admin"]
            self.permissions = ["*"]
            self.is_platform_admin = True

    user_info = MockUserInfo()
    result = _tenant_scope_kwargs(user_info=user_info)
    assert result == {"tenant_id": None}


def test_tenant_scope_kwargs_with_regular_user():
    """Test _tenant_scope_kwargs with regular user."""
    # Create a mock UserInfo-like object with is_platform_admin=False
    class MockUserInfo:
        def __init__(self, tenant_id):
            self.user_id = uuid.uuid4()
            self.username = "user"
            self.email = "user@example.com"
            self.tenant_id = tenant_id
            self.roles = ["user"]
            self.permissions = []
            self.is_platform_admin = False

    tenant_id = str(uuid.uuid4())
    user_info = MockUserInfo(tenant_id)
    result = _tenant_scope_kwargs(user_info=user_info)
    assert result == {"tenant_id": tenant_id}


@pytest.mark.asyncio
async def test_validate_username_email_conflicts_username_taken(async_db_session):
    """Test username conflict validation."""
    tenant_id = str(uuid.uuid4())

    # Create existing user
    existing_user = User(
        id=uuid.uuid4(),
        username="existinguser",
        email="existing@example.com",
        password_hash=hash_password("Password123!"),
        tenant_id=tenant_id,
        is_active=True,
    )
    async_db_session.add(existing_user)
    await async_db_session.commit()

    # Create test user trying to update to existing username
    test_user = User(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        password_hash=hash_password("Password123!"),
        tenant_id=tenant_id,
        is_active=True,
    )
    async_db_session.add(test_user)
    await async_db_session.commit()

    user_service = UserService(async_db_session)
    update_data = {"username": "existinguser"}

    with pytest.raises(HTTPException) as exc_info:
        await _validate_username_email_conflicts(
            update_data, test_user, user_service, tenant_id=tenant_id
        )

    assert exc_info.value.status_code == 400
    assert "Username already taken" in exc_info.value.detail


@pytest.mark.asyncio
async def test_validate_username_email_conflicts_email_taken(async_db_session):
    """Test email conflict validation."""
    tenant_id = str(uuid.uuid4())

    # Create existing user
    existing_user = User(
        id=uuid.uuid4(),
        username="existinguser",
        email="existing@example.com",
        password_hash=hash_password("Password123!"),
        tenant_id=tenant_id,
        is_active=True,
    )
    async_db_session.add(existing_user)
    await async_db_session.commit()

    # Create test user trying to update to existing email
    test_user = User(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        password_hash=hash_password("Password123!"),
        tenant_id=tenant_id,
        is_active=True,
    )
    async_db_session.add(test_user)
    await async_db_session.commit()

    user_service = UserService(async_db_session)
    update_data = {"email": "existing@example.com"}

    with pytest.raises(HTTPException) as exc_info:
        await _validate_username_email_conflicts(
            update_data, test_user, user_service, tenant_id=tenant_id
        )

    assert exc_info.value.status_code == 400
    assert "Email already in use" in exc_info.value.detail


def test_prepare_name_fields():
    """Test _prepare_name_fields helper."""
    user = User(
        id=uuid.uuid4(),
        username="test",
        email="test@example.com",
        password_hash="hash",
        first_name="Old",
        last_name="Name",
    )

    update_data = {"first_name": "New", "last_name": "User"}
    _prepare_name_fields(update_data, user)

    assert update_data["full_name"] == "New User"


def test_prepare_name_fields_partial_update():
    """Test _prepare_name_fields with partial update."""
    user = User(
        id=uuid.uuid4(),
        username="test",
        email="test@example.com",
        password_hash="hash",
        first_name="John",
        last_name="Doe",
    )

    # Only update first name
    update_data = {"first_name": "Jane"}
    _prepare_name_fields(update_data, user)

    assert update_data["full_name"] == "Jane Doe"


def test_collect_profile_changes():
    """Test _collect_profile_changes helper."""
    user = User(
        id=uuid.uuid4(),
        username="test",
        email="test@example.com",
        password_hash="hash",
        full_name="Old Name",
        bio="Old bio",
    )

    update_data = {
        "full_name": "New Name",
        "bio": "New bio",
        "location": "New City",  # New field (will also be tracked since user has location attr)
    }

    changes = _collect_profile_changes(update_data, user)

    assert len(changes) == 3  # full_name, bio, and location changed
    assert any(c["field_name"] == "full_name" and c["new_value"] == "New Name" for c in changes)
    assert any(c["field_name"] == "bio" and c["new_value"] == "New bio" for c in changes)
    assert any(c["field_name"] == "location" and c["new_value"] == "New City" for c in changes)


@pytest.mark.asyncio
async def test_log_profile_change_history(async_db_session):
    """Test _log_profile_change_history helper."""
    user_id = uuid.uuid4()
    tenant_id = str(uuid.uuid4())

    user = User(
        id=user_id,
        username="test",
        email="test@example.com",
        password_hash="hash",
        tenant_id=tenant_id,
        is_active=True,
    )
    async_db_session.add(user)
    await async_db_session.commit()

    changes = [
        {"field_name": "email", "old_value": "old@example.com", "new_value": "new@example.com"},
        {"field_name": "bio", "old_value": None, "new_value": "New bio"},
    ]

    # Create mock request
    mock_request = MagicMock()
    mock_request.client = MagicMock()
    mock_request.client.host = "127.0.0.1"
    mock_request.headers = {"user-agent": "TestClient/1.0"}

    await _log_profile_change_history(changes, user, mock_request, async_db_session)
    await async_db_session.commit()

    # Verify history records created
    from dotmac.platform.user_management.models import ProfileChangeHistory

    from sqlalchemy import select

    result = await async_db_session.execute(
        select(ProfileChangeHistory).where(ProfileChangeHistory.user_id == user.id)
    )
    history_records = result.scalars().all()

    assert len(history_records) == 2
    assert any(h.field_name == "email" for h in history_records)
    assert any(h.field_name == "bio" for h in history_records)


@pytest.mark.asyncio
async def test_log_profile_change_history_with_exception(async_db_session):
    """Test _log_profile_change_history handles exceptions gracefully."""
    user_id = uuid.uuid4()
    tenant_id = str(uuid.uuid4())

    user = User(
        id=user_id,
        username="test",
        email="test@example.com",
        password_hash="hash",
        tenant_id=tenant_id,
        is_active=True,
    )

    changes = [
        {"field_name": "invalid_field", "old_value": "old", "new_value": "new"},
    ]

    mock_request = MagicMock()
    mock_request.client = MagicMock()
    mock_request.client.host = "127.0.0.1"
    mock_request.headers = {"user-agent": "TestClient/1.0"}

    # Should not raise exception, just log warning
    await _log_profile_change_history(changes, user, mock_request, async_db_session)


def test_build_profile_response():
    """Test _build_profile_response helper."""
    user = User(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        password_hash="hash",
        tenant_id=uuid.uuid4(),
        is_active=True,
        full_name="Test User",
        first_name="Test",
        last_name="User",
        phone="+1234567890",
        location="Test City",
        timezone="America/New_York",
        language="en",
        bio="Test bio",
        website="https://example.com",
        avatar_url="/avatars/test.jpg",
        roles=["user", "editor"],
        mfa_enabled=True,
    )

    response = _build_profile_response(user)

    assert response["id"] == str(user.id)
    assert response["username"] == "testuser"
    assert response["email"] == "test@example.com"
    assert response["full_name"] == "Test User"
    assert response["phone"] == "+1234567890"
    assert response["roles"] == ["user", "editor"]
    assert response["mfa_enabled"] is True
    assert response["tenant_id"] == str(user.tenant_id)


# ========================================
# GET /me Endpoint Tests
# ========================================


@pytest.mark.asyncio
async def test_get_current_user_success(client, test_user, auth_headers):
    """Test successful retrieval of current user profile."""
    response = await client.get("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == test_user.username
    assert data["email"] == test_user.email
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_get_current_user_with_mfa_enabled(client, mfa_enabled_user, async_db_session):
    """Test GET /me with MFA enabled user."""
    from dotmac.platform.user_management.models import BackupCode

    # Create backup codes
    for i in range(3):
        code = BackupCode(
            id=uuid.uuid4(),
            user_id=mfa_enabled_user.id,
            code_hash=hash_password(f"CODE-{i}"),
            is_used=False,
            tenant_id=mfa_enabled_user.tenant_id,
        )
        async_db_session.add(code)
    await async_db_session.commit()

    access_token = create_access_token(
        user_id=str(mfa_enabled_user.id),
        email=mfa_enabled_user.email,
        username=mfa_enabled_user.username,
        tenant_id=str(mfa_enabled_user.tenant_id),
        roles=mfa_enabled_user.roles or [],
        permissions=mfa_enabled_user.permissions or [],
    )

    with patch("dotmac.platform.auth.mfa_service.mfa_service.get_remaining_backup_codes_count", new=AsyncMock(return_value=3)):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["mfa_enabled"] is True
    assert "mfa_backup_codes_remaining" in data


@pytest.mark.asyncio
async def test_get_current_user_with_active_organization(client, test_user, auth_headers, async_db_session):
    """Test GET /me includes activeOrganization for tenant users."""
    from dotmac.platform.tenant.models import Tenant

    # Create tenant
    tenant = Tenant(
        id=test_user.tenant_id,
        name="Test Organization",
        slug="test-org",
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(tenant)
    await async_db_session.commit()

    response = await client.get("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert "activeOrganization" in data
    if data["activeOrganization"]:
        assert data["activeOrganization"]["name"] == "Test Organization"
        assert data["activeOrganization"]["slug"] == "test-org"


@pytest.mark.asyncio
async def test_get_current_user_tenant_fetch_error(client, test_user, auth_headers):
    """Test GET /me handles tenant fetch errors gracefully."""
    with patch("dotmac.platform.tenant.service.TenantService.get_tenant", side_effect=Exception("DB error")):
        response = await client.get("/api/v1/auth/me", headers=auth_headers)

    # Should still return user info, just without activeOrganization
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_current_user_mfa_backup_codes_error(client, mfa_enabled_user):
    """Test GET /me handles MFA backup code fetch errors."""
    access_token = create_access_token(
        user_id=str(mfa_enabled_user.id),
        email=mfa_enabled_user.email,
        username=mfa_enabled_user.username,
        tenant_id=str(mfa_enabled_user.tenant_id),
        roles=mfa_enabled_user.roles or [],
        permissions=mfa_enabled_user.permissions or [],
    )

    with patch("dotmac.platform.auth.mfa_service.mfa_service.get_remaining_backup_codes_count", side_effect=Exception("MFA error")):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    # Should default to 0 backup codes on error


@pytest.mark.asyncio
async def test_get_current_user_generic_error(client, auth_headers):
    """Test GET /me handles generic errors."""
    with patch("dotmac.platform.user_management.service.UserService.get_user_by_id", side_effect=Exception("Unexpected error")):
        response = await client.get("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 500
    assert "Failed to retrieve user information" in response.json()["detail"]


# ========================================
# PATCH /me Endpoint Tests
# ========================================


@pytest.mark.asyncio
async def test_update_profile_success(client, test_user, auth_headers):
    """Test successful profile update."""
    response = await client.patch(
        "/api/v1/auth/me",
        headers=auth_headers,
        json={
            "first_name": "Updated",
            "last_name": "Name",
            "bio": "Updated bio",
            "location": "New City",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_update_profile_username_conflict(client, test_user, auth_headers, async_db_session):
    """Test profile update with username already taken."""
    # Create another user with different username
    other_user = User(
        id=uuid.uuid4(),
        username="takenuser",
        email="taken@example.com",
        password_hash=hash_password("Password123!"),
        tenant_id=test_user.tenant_id,
        is_active=True,
    )
    async_db_session.add(other_user)
    await async_db_session.commit()

    response = await client.patch(
        "/api/v1/auth/me",
        headers=auth_headers,
        json={"username": "takenuser"},
    )

    assert response.status_code == 400
    assert "Username already taken" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_profile_email_conflict(client, test_user, auth_headers, async_db_session):
    """Test profile update with email already in use."""
    # Create another user with different email
    other_user = User(
        id=uuid.uuid4(),
        username="otheruser",
        email="taken@example.com",
        password_hash=hash_password("Password123!"),
        tenant_id=test_user.tenant_id,
        is_active=True,
    )
    async_db_session.add(other_user)
    await async_db_session.commit()

    response = await client.patch(
        "/api/v1/auth/me",
        headers=auth_headers,
        json={"email": "taken@example.com"},
    )

    assert response.status_code == 400
    assert "Email already in use" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_profile_generic_error(client, auth_headers):
    """Test profile update handles generic errors."""
    with patch("dotmac.platform.user_management.service.UserService.get_user_by_id", side_effect=Exception("DB error")):
        response = await client.patch(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={"bio": "New bio"},
        )

    assert response.status_code == 500
    assert "Failed to update profile" in response.json()["detail"]


# ========================================
# Avatar Upload Tests
# ========================================


@pytest.mark.asyncio
async def test_upload_avatar_invalid_file_type(client, auth_headers):
    """Test avatar upload with invalid file type."""
    file_content = b"not an image"
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("test.txt", file, "text/plain")},
    )

    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_avatar_file_too_large(client, auth_headers):
    """Test avatar upload with file exceeding size limit."""
    # Create a file larger than 5MB
    file_content = b"x" * (6 * 1024 * 1024)  # 6MB
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("large.jpg", file, "image/jpeg")},
    )

    assert response.status_code == 413
    assert "File too large" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_avatar_user_not_found(client, async_db_session):
    """Test avatar upload when user not found."""
    # Create token for non-existent user
    fake_user_id = str(uuid.uuid4())
    access_token = create_access_token(
        user_id=fake_user_id,
        email="fake@example.com",
        username="fakeuser",
        tenant_id=str(uuid.uuid4()),
        roles=[],
        permissions=[],
    )

    file_content = b"fake image"
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers={"Authorization": f"Bearer {access_token}"},
        files={"avatar": ("test.jpg", file, "image/jpeg")},
    )

    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_avatar_replaces_old_avatar(client, test_user, auth_headers, async_db_session):
    """Test that uploading avatar deletes old avatar."""
    # Set existing avatar URL
    test_user.avatar_url = "/api/v1/files/storage/old-file-id/download"
    await async_db_session.commit()

    file_content = b"new image"
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("new.jpg", file, "image/jpeg")},
    )

    assert response.status_code == 200
    # Verify old file deletion was attempted
    assert client.storage_mock.delete_file.called  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_upload_avatar_old_delete_failure(client, test_user, auth_headers, async_db_session):
    """Test avatar upload continues even if old avatar deletion fails."""
    # Set existing avatar URL
    test_user.avatar_url = "/api/v1/files/storage/old-file-id/download"
    await async_db_session.commit()

    # Make delete fail
    client.storage_mock.delete_file.side_effect = Exception("Delete failed")  # type: ignore[attr-defined]

    file_content = b"new image"
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("new.jpg", file, "image/jpeg")},
    )

    # Should still succeed
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_upload_avatar_no_filename(client, auth_headers):
    """Test avatar upload with file without filename."""
    file_content = b"image content"
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": (None, file, "image/jpeg")},  # No filename
    )

    # Should still work, defaulting to .jpg extension
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_upload_avatar_storage_error(client, auth_headers):
    """Test avatar upload handles storage errors."""
    client.storage_mock.store_file.side_effect = Exception("Storage error")  # type: ignore[attr-defined]

    file_content = b"image content"
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("test.jpg", file, "image/jpeg")},
    )

    assert response.status_code == 500
    assert "Failed to upload avatar" in response.json()["detail"]


# ========================================
# Delete Avatar Tests
# ========================================


@pytest.mark.asyncio
async def test_delete_avatar_success(client, test_user, auth_headers, async_db_session):
    """Test successful avatar deletion."""
    # Set avatar URL
    test_user.avatar_url = "/api/v1/files/storage/test-file-id/download"
    await async_db_session.commit()

    response = await client.delete("/api/v1/auth/me/avatar", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Avatar deleted successfully"
    assert data["avatar_url"] is None


@pytest.mark.asyncio
async def test_delete_avatar_user_not_found(client, async_db_session):
    """Test delete avatar when user not found."""
    fake_user_id = str(uuid.uuid4())
    access_token = create_access_token(
        user_id=fake_user_id,
        email="fake@example.com",
        username="fakeuser",
        tenant_id=str(uuid.uuid4()),
        roles=[],
        permissions=[],
    )

    response = await client.delete(
        "/api/v1/auth/me/avatar",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_avatar_no_avatar_to_delete(client, test_user, auth_headers, async_db_session):
    """Test delete avatar when no avatar exists."""
    # Ensure no avatar URL
    test_user.avatar_url = None
    await async_db_session.commit()

    response = await client.delete("/api/v1/auth/me/avatar", headers=auth_headers)

    assert response.status_code == 404
    assert "No avatar to delete" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_avatar_storage_delete_failure(client, test_user, auth_headers, async_db_session):
    """Test avatar deletion continues even if storage deletion fails."""
    test_user.avatar_url = "/api/v1/files/storage/test-file-id/download"
    await async_db_session.commit()

    # Make storage delete fail
    client.storage_mock.delete_file.side_effect = Exception("Storage error")  # type: ignore[attr-defined]

    response = await client.delete("/api/v1/auth/me/avatar", headers=auth_headers)

    # Should still clear avatar_url
    assert response.status_code == 200
    assert response.json()["avatar_url"] is None


@pytest.mark.asyncio
async def test_delete_avatar_generic_error(client, auth_headers):
    """Test delete avatar handles generic errors."""
    with patch("dotmac.platform.user_management.service.UserService.get_user_by_id", side_effect=Exception("DB error")):
        response = await client.delete("/api/v1/auth/me/avatar", headers=auth_headers)

    assert response.status_code == 500
    assert "Failed to delete avatar" in response.json()["detail"]


# ========================================
# Change Password Tests
# ========================================


@pytest.mark.asyncio
async def test_change_password_success(client, test_user, auth_headers):
    """Test successful password change."""
    response = await client.post(
        "/api/v1/auth/change-password",
        headers=auth_headers,
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewPassword456!",
        },
    )

    assert response.status_code == 200
    assert "Password changed successfully" in response.json()["message"]


@pytest.mark.asyncio
async def test_change_password_user_not_found(client):
    """Test change password when user not found."""
    fake_user_id = str(uuid.uuid4())
    access_token = create_access_token(
        user_id=fake_user_id,
        email="fake@example.com",
        username="fakeuser",
        tenant_id=str(uuid.uuid4()),
        roles=[],
        permissions=[],
    )

    response = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewPassword456!",
        },
    )

    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_change_password_incorrect_current_password(client, test_user, auth_headers):
    """Test change password with incorrect current password."""
    response = await client.post(
        "/api/v1/auth/change-password",
        headers=auth_headers,
        json={
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword456!",
        },
    )

    assert response.status_code == 400
    assert "Current password is incorrect" in response.json()["detail"]


@pytest.mark.asyncio
async def test_change_password_generic_error(client, auth_headers):
    """Test change password handles generic errors."""
    with patch("dotmac.platform.user_management.service.UserService.get_user_by_id", side_effect=Exception("DB error")):
        response = await client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={
                "current_password": "OldPassword123!",
                "new_password": "NewPassword456!",
            },
        )

    assert response.status_code == 500
    assert "Failed to change password" in response.json()["detail"]


# ========================================
# Session Management Tests
# ========================================


@pytest.mark.asyncio
async def test_list_sessions_success(client, auth_headers):
    """Test successful session listing."""
    with patch("dotmac.platform.auth.core.session_manager.get_user_sessions", new=AsyncMock(return_value={})):
        response = await client.get("/api/v1/auth/me/sessions", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_list_sessions_with_current_session(client, test_user):
    """Test list sessions identifies current session."""
    session_id = str(uuid.uuid4())
    access_token = create_access_token(
        user_id=str(test_user.id),
        email=test_user.email,
        username=test_user.username,
        tenant_id=str(test_user.tenant_id),
        roles=test_user.roles or [],
        permissions=test_user.permissions or [],
        session_id=session_id,
    )

    mock_sessions = {
        f"session:{session_id}": {
            "session_id": session_id,
            "user_id": str(test_user.id),
            "created_at": datetime.now(UTC).isoformat(),
            "ip_address": "127.0.0.1",
            "user_agent": "TestClient",
        }
    }

    with patch("dotmac.platform.auth.core.session_manager.get_user_sessions", new=AsyncMock(return_value=mock_sessions)):
        response = await client.get(
            "/api/v1/auth/me/sessions",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["sessions"]) == 1
    assert data["sessions"][0]["is_current"] is True


@pytest.mark.asyncio
async def test_list_sessions_error(client, auth_headers):
    """Test list sessions handles errors."""
    with patch("dotmac.platform.auth.core.session_manager.get_user_sessions", side_effect=Exception("Session error")):
        response = await client.get("/api/v1/auth/me/sessions", headers=auth_headers)

    assert response.status_code == 500
    assert "Failed to list sessions" in response.json()["detail"]


@pytest.mark.asyncio
async def test_revoke_session_success(client, test_user):
    """Test successful session revocation."""
    current_session_id = str(uuid.uuid4())
    target_session_id = str(uuid.uuid4())

    access_token = create_access_token(
        user_id=str(test_user.id),
        email=test_user.email,
        username=test_user.username,
        tenant_id=str(test_user.tenant_id),
        roles=test_user.roles or [],
        permissions=test_user.permissions or [],
        session_id=current_session_id,
    )

    mock_session_data = {
        "user_id": str(test_user.id),
        "session_id": target_session_id,
    }

    with (
        patch("dotmac.platform.auth.core.session_manager.get_session", new=AsyncMock(return_value=mock_session_data)),
        patch("dotmac.platform.auth.core.session_manager.delete_session", new=AsyncMock(return_value=True)),
    ):
        response = await client.delete(
            f"/api/v1/auth/me/sessions/{target_session_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    assert "Session revoked successfully" in response.json()["message"]


@pytest.mark.asyncio
async def test_revoke_current_session_forbidden(client, test_user):
    """Test that revoking current session is forbidden."""
    session_id = str(uuid.uuid4())
    access_token = create_access_token(
        user_id=str(test_user.id),
        email=test_user.email,
        username=test_user.username,
        tenant_id=str(test_user.tenant_id),
        roles=test_user.roles or [],
        permissions=test_user.permissions or [],
        session_id=session_id,
    )

    response = await client.delete(
        f"/api/v1/auth/me/sessions/{session_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 400
    assert "Cannot revoke current session" in response.json()["detail"]


@pytest.mark.asyncio
async def test_revoke_session_not_found(client, test_user, auth_headers):
    """Test revoking non-existent session."""
    target_session_id = str(uuid.uuid4())

    with patch("dotmac.platform.auth.core.session_manager.get_session", new=AsyncMock(return_value=None)):
        response = await client.delete(
            f"/api/v1/auth/me/sessions/{target_session_id}",
            headers=auth_headers,
        )

    assert response.status_code == 404
    assert "Session not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_revoke_session_wrong_user(client, test_user, auth_headers):
    """Test revoking session belonging to another user."""
    target_session_id = str(uuid.uuid4())
    other_user_id = str(uuid.uuid4())

    mock_session_data = {
        "user_id": other_user_id,  # Different user
        "session_id": target_session_id,
    }

    with patch("dotmac.platform.auth.core.session_manager.get_session", new=AsyncMock(return_value=mock_session_data)):
        response = await client.delete(
            f"/api/v1/auth/me/sessions/{target_session_id}",
            headers=auth_headers,
        )

    assert response.status_code == 404
    assert "Session not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_revoke_session_error(client, auth_headers):
    """Test revoke session handles errors."""
    target_session_id = str(uuid.uuid4())

    with patch("dotmac.platform.auth.core.session_manager.get_session", side_effect=Exception("Session error")):
        response = await client.delete(
            f"/api/v1/auth/me/sessions/{target_session_id}",
            headers=auth_headers,
        )

    assert response.status_code == 500
    assert "Failed to revoke session" in response.json()["detail"]


@pytest.mark.asyncio
async def test_revoke_all_sessions_success(client, test_user):
    """Test successful revocation of all sessions except current."""
    current_session_id = str(uuid.uuid4())
    access_token = create_access_token(
        user_id=str(test_user.id),
        email=test_user.email,
        username=test_user.username,
        tenant_id=str(test_user.tenant_id),
        roles=test_user.roles or [],
        permissions=test_user.permissions or [],
        session_id=current_session_id,
    )

    mock_sessions = {
        f"session:{current_session_id}": {
            "session_id": current_session_id,
            "user_id": str(test_user.id),
        },
        "session:other-1": {
            "session_id": "other-1",
            "user_id": str(test_user.id),
        },
        "session:other-2": {
            "session_id": "other-2",
            "user_id": str(test_user.id),
        },
    }

    with (
        patch("dotmac.platform.auth.core.session_manager.get_user_sessions", new=AsyncMock(return_value=mock_sessions)),
        patch("dotmac.platform.auth.core.session_manager.delete_session", new=AsyncMock(return_value=True)),
    ):
        response = await client.delete(
            "/api/v1/auth/me/sessions",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["sessions_revoked"] == 2  # Excluding current session


@pytest.mark.asyncio
async def test_revoke_all_sessions_error(client, auth_headers):
    """Test revoke all sessions handles errors."""
    with patch("dotmac.platform.auth.core.session_manager.get_user_sessions", side_effect=Exception("Session error")):
        response = await client.delete("/api/v1/auth/me/sessions", headers=auth_headers)

    assert response.status_code == 500
    assert "Failed to revoke sessions" in response.json()["detail"]
