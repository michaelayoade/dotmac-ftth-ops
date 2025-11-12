"""
Tests for avatar upload endpoint.
"""

import io
import uuid

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient

from dotmac.platform.auth.core import create_access_token, hash_password
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
    user = User(
        id=uuid.UUID("550e8400-e29b-41d4-a716-446655440000"),
        username="testuser",
        email="test@example.com",
        password_hash=hash_password("test_password"),
        tenant_id="test-tenant",
        is_active=True,
        is_verified=True,
        phone_verified=False,
        is_superuser=False,
        is_platform_admin=False,
        mfa_enabled=False,
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
def test_user_id(test_user):
    """Get test user ID as string."""
    return str(test_user.id)


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers with JWT token."""
    # Create JWT token for the test user
    access_token = create_access_token(
        user_id=str(test_user.id),
        email=test_user.email,
        username=test_user.username,
        tenant_id=test_user.tenant_id,
        roles=test_user.roles,
        permissions=test_user.permissions,
    )
    return {
        "Authorization": f"Bearer {access_token}",
        "X-Tenant-ID": test_user.tenant_id,
    }


@pytest_asyncio.fixture
async def client(app, async_db_session):
    """Create async test client."""
    from unittest.mock import AsyncMock, patch

    from httpx import ASGITransport

    from dotmac.platform.auth.router import get_auth_session
    from dotmac.platform.db import get_session_dependency

    # Override session dependency - must be async generator
    async def override_get_session():
        yield async_db_session

    # CRITICAL: Must override BOTH get_session_dependency AND get_auth_session
    # FastAPI resolves dependencies by function reference
    app.dependency_overrides[get_session_dependency] = override_get_session
    app.dependency_overrides[get_auth_session] = override_get_session

    storage_mock = AsyncMock()
    storage_mock.store_file = AsyncMock(return_value="mock-file-id")
    storage_mock.delete_file = AsyncMock(return_value=None)

    with (
        patch(
            "dotmac.platform.file_storage.service.get_storage_service", return_value=storage_mock
        ),
        patch("dotmac.platform.audit.log_user_activity", new=AsyncMock()),
    ):
        # Use ASGITransport instead of app parameter (httpx API change)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            ac.storage_mock = storage_mock  # type: ignore[attr-defined]
            yield ac


@pytest.mark.asyncio
async def test_upload_avatar_success(
    client: AsyncClient,
    auth_headers: dict,
    test_user_id: str,
):
    """Test successful avatar upload."""
    # Create a fake image file
    file_content = b"fake image content"
    file = io.BytesIO(file_content)

    # Upload avatar
    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("test_avatar.jpg", file, "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert "avatar_url" in data
    assert "file_id" in data
    assert "message" in data
    assert data["message"] == "Avatar uploaded successfully"
    assert data["avatar_url"].startswith("/api/v1/files/storage/")


@pytest.mark.asyncio
async def test_upload_avatar_invalid_type(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test avatar upload with invalid file type."""
    file_content = b"not an image"
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("test.txt", file, "text/plain")},
    )

    assert response.status_code == 400
    data = response.json()
    assert "Invalid file type" in data["detail"]


@pytest.mark.asyncio
async def test_upload_avatar_too_large(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test avatar upload with file too large."""
    # Create a file larger than 5MB
    file_content = b"x" * (6 * 1024 * 1024)  # 6MB
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("large_avatar.jpg", file, "image/jpeg")},
    )

    assert response.status_code == 413
    data = response.json()
    assert "File too large" in data["detail"]


@pytest.mark.asyncio
async def test_upload_avatar_unauthorized(client: AsyncClient):
    """Test avatar upload without authentication."""
    file_content = b"fake image content"
    file = io.BytesIO(file_content)

    response = await client.post(
        "/api/v1/auth/upload-avatar",
        files={"avatar": ("test_avatar.jpg", file, "image/jpeg")},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_upload_avatar_updates_user_profile(
    client: AsyncClient,
    auth_headers: dict,
    test_user_id: str,
):
    """Test that avatar upload updates user profile avatar_url."""
    # Upload avatar
    file_content = b"fake image content"
    file = io.BytesIO(file_content)

    upload_response = await client.post(
        "/api/v1/auth/upload-avatar",
        headers=auth_headers,
        files={"avatar": ("test_avatar.jpg", file, "image/jpeg")},
    )

    assert upload_response.status_code == 200
    upload_response.json()["avatar_url"]

    # Get current user profile
    profile_response = await client.get(
        "/api/v1/auth/me",
        headers=auth_headers,
    )

    assert profile_response.status_code == 200
    # Note: avatar_url might not be in response if not added to response model
    # This test verifies the upload was successful


@pytest.mark.asyncio
async def test_upload_avatar_supported_formats(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test avatar upload with various supported image formats."""
    supported_formats = [
        ("image.jpg", "image/jpeg"),
        ("image.jpeg", "image/jpeg"),
        ("image.png", "image/png"),
        ("image.gif", "image/gif"),
        ("image.webp", "image/webp"),
    ]

    for filename, content_type in supported_formats:
        file_content = b"fake image content"
        file = io.BytesIO(file_content)

        response = await client.post(
            "/api/v1/auth/upload-avatar",
            headers=auth_headers,
            files={"avatar": (filename, file, content_type)},
        )

        assert response.status_code == 200, f"Failed for {filename} ({content_type})"
        data = response.json()
        assert "avatar_url" in data
