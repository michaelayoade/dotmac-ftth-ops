"""
Tests for Backup Code functionality.

Tests backup code generation, storage, verification, and regeneration.
"""

import uuid

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import select

from dotmac.platform.auth.core import hash_password, verify_password
from dotmac.platform.auth.dependencies import UserInfo
from dotmac.platform.auth.mfa_service import mfa_service
from dotmac.platform.auth.router import auth_router
from dotmac.platform.user_management.models import BackupCode, User

pytestmark = pytest.mark.integration


@pytest.fixture
def app():
    """Create FastAPI app for testing."""
    app = FastAPI()
    app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
    return app


@pytest_asyncio.fixture
async def test_user(async_db_session):
    """Create a test user with 2FA enabled."""
    secret = mfa_service.generate_secret()

    user = User(
        id=uuid.UUID("550e8400-e29b-41d4-a716-446655440003"),
        username="testuser_backup",
        email="testbackup@example.com",
        password_hash=hash_password("test_password"),
        tenant_id="test-tenant",
        mfa_enabled=True,
        mfa_secret=secret,
        is_active=True,
        is_verified=True,
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
    from httpx import ASGITransport

    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.db import get_session_dependency

    async def override_get_session():
        yield async_db_session

    app.dependency_overrides[get_session_dependency] = override_get_session
    app.dependency_overrides[get_current_user] = lambda: mock_user_info

    transport = ASGITransport(app=app)
    from unittest.mock import AsyncMock, patch

    with patch("dotmac.platform.auth.router.log_user_activity", new=AsyncMock()):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


# ========================================
# Backup Code Generation Tests
# ========================================


def test_generate_backup_codes():
    """Test backup code generation."""
    codes = mfa_service.generate_backup_codes(count=10)

    assert len(codes) == 10
    assert all(len(code) == 9 for code in codes)  # XXXX-XXXX format
    assert all("-" in code for code in codes)
    assert all(code.isupper() for code in codes)

    # Verify uniqueness
    assert len(codes) == len(set(codes))


def test_generate_backup_codes_custom_count():
    """Test backup code generation with custom count."""
    codes = mfa_service.generate_backup_codes(count=5)
    assert len(codes) == 5

    codes = mfa_service.generate_backup_codes(count=20)
    assert len(codes) == 20


# ========================================
# Backup Code Storage Tests
# ========================================


@pytest.mark.asyncio
async def test_store_backup_codes(test_user, async_db_session):
    """Test storing backup codes in database."""
    codes = mfa_service.generate_backup_codes(count=10)

    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Verify codes are stored
    result = await async_db_session.execute(
        select(BackupCode).where(BackupCode.user_id == test_user.id)
    )
    stored_codes = result.scalars().all()

    assert len(stored_codes) == 10
    assert all(code.user_id == test_user.id for code in stored_codes)
    assert all(code.used is False for code in stored_codes)
    assert all(code.tenant_id == test_user.tenant_id for code in stored_codes)


@pytest.mark.asyncio
async def test_backup_codes_stored_hashed(test_user, async_db_session):
    """Test that backup codes are stored hashed, not plaintext."""
    codes = mfa_service.generate_backup_codes(count=10)

    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Verify codes are hashed
    result = await async_db_session.execute(
        select(BackupCode).where(BackupCode.user_id == test_user.id)
    )
    stored_codes = result.scalars().all()

    for stored_code in stored_codes:
        # Hash should not match any plaintext code
        assert stored_code.code_hash not in codes
        # But should verify against at least one code
        assert any(verify_password(code, stored_code.code_hash) for code in codes)


@pytest.mark.asyncio
async def test_store_backup_codes_replaces_existing(test_user, async_db_session):
    """Test that storing new codes replaces existing ones."""
    # Store first set of codes
    codes1 = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes1,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Store second set of codes
    codes2 = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes2,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Verify only second set is stored
    result = await async_db_session.execute(
        select(BackupCode).where(BackupCode.user_id == test_user.id)
    )
    stored_codes = result.scalars().all()

    assert len(stored_codes) == 10

    # None of the old codes should verify
    for code in codes1:
        is_valid = await mfa_service.verify_backup_code(
            user_id=test_user.id,
            code=code,
            session=async_db_session,
        )
        assert is_valid is False


# ========================================
# Backup Code Verification Tests
# ========================================


@pytest.mark.asyncio
async def test_verify_backup_code_success(test_user, async_db_session):
    """Test successful backup code verification."""
    codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Verify a code
    is_valid = await mfa_service.verify_backup_code(
        user_id=test_user.id,
        code=codes[0],
        session=async_db_session,
        ip_address="127.0.0.1",
    )

    assert is_valid is True


@pytest.mark.asyncio
async def test_verify_backup_code_marks_as_used(test_user, async_db_session):
    """Test that verification marks code as used."""
    codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Verify a code
    await mfa_service.verify_backup_code(
        user_id=test_user.id,
        code=codes[0],
        session=async_db_session,
        ip_address="127.0.0.1",
    )

    # Check that it's marked as used
    result = await async_db_session.execute(
        select(BackupCode).where(BackupCode.user_id == test_user.id, BackupCode.used)
    )
    used_codes = result.scalars().all()

    assert len(used_codes) == 1
    assert used_codes[0].used is True
    assert used_codes[0].used_at is not None
    assert used_codes[0].used_ip == "127.0.0.1"


@pytest.mark.asyncio
async def test_verify_backup_code_cannot_reuse(test_user, async_db_session):
    """Test that used codes cannot be reused."""
    codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Use a code
    await mfa_service.verify_backup_code(
        user_id=test_user.id,
        code=codes[0],
        session=async_db_session,
    )

    # Try to use it again
    is_valid = await mfa_service.verify_backup_code(
        user_id=test_user.id,
        code=codes[0],
        session=async_db_session,
    )

    assert is_valid is False


@pytest.mark.asyncio
async def test_verify_backup_code_invalid_code(test_user, async_db_session):
    """Test verification with invalid code."""
    codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Try invalid code
    is_valid = await mfa_service.verify_backup_code(
        user_id=test_user.id,
        code="INVALID-CODE",
        session=async_db_session,
    )

    assert is_valid is False


# ========================================
# Backup Code Count Tests
# ========================================


@pytest.mark.asyncio
async def test_get_remaining_backup_codes_count(test_user, async_db_session):
    """Test getting count of remaining backup codes."""
    codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    count = await mfa_service.get_remaining_backup_codes_count(
        user_id=test_user.id, session=async_db_session
    )

    assert count == 10


@pytest.mark.asyncio
async def test_remaining_count_decreases_after_use(test_user, async_db_session):
    """Test that remaining count decreases after using codes."""
    codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Use 3 codes
    for i in range(3):
        await mfa_service.verify_backup_code(
            user_id=test_user.id,
            code=codes[i],
            session=async_db_session,
        )

    count = await mfa_service.get_remaining_backup_codes_count(
        user_id=test_user.id, session=async_db_session
    )

    assert count == 7


# ========================================
# Backup Code Regeneration Endpoint Tests
# ========================================


@pytest.mark.asyncio
async def test_regenerate_backup_codes_success(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test successful backup code regeneration."""
    # Store initial codes
    initial_codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=initial_codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Regenerate codes
    response = await client.post(
        "/api/v1/auth/2fa/regenerate-backup-codes",
        json={"password": "test_password"},
    )

    assert response.status_code == 200
    data = response.json()

    assert "backup_codes" in data
    assert len(data["backup_codes"]) == 10
    assert "warning" in data
    assert data["message"] == "Backup codes regenerated successfully"


@pytest.mark.asyncio
async def test_regenerate_replaces_old_codes(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test that regeneration replaces old codes."""
    # Store initial codes
    initial_codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=initial_codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Regenerate
    await client.post(
        "/api/v1/auth/2fa/regenerate-backup-codes",
        json={"password": "test_password"},
    )

    # Old codes should not work
    for code in initial_codes:
        is_valid = await mfa_service.verify_backup_code(
            user_id=test_user.id,
            code=code,
            session=async_db_session,
        )
        assert is_valid is False


@pytest.mark.asyncio
async def test_regenerate_backup_codes_incorrect_password(
    client: AsyncClient,
):
    """Test regeneration with incorrect password."""
    response = await client.post(
        "/api/v1/auth/2fa/regenerate-backup-codes",
        json={"password": "wrong_password"},
    )

    assert response.status_code == 400
    assert "Incorrect password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_regenerate_backup_codes_2fa_not_enabled(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test regeneration when 2FA is not enabled."""
    # Disable 2FA
    test_user.mfa_enabled = False
    await async_db_session.commit()

    response = await client.post(
        "/api/v1/auth/2fa/regenerate-backup-codes",
        json={"password": "test_password"},
    )

    assert response.status_code == 400
    assert "2FA is not enabled" in response.json()["detail"]


@pytest.mark.asyncio
async def test_regenerate_preserves_unused_count(
    client: AsyncClient,
    test_user: User,
    async_db_session,
):
    """Test that regeneration maintains code count."""
    # Initial codes
    initial_codes = mfa_service.generate_backup_codes(count=10)
    await mfa_service.store_backup_codes(
        user_id=test_user.id,
        codes=initial_codes,
        session=async_db_session,
        tenant_id=test_user.tenant_id,
    )

    # Use some codes
    for i in range(3):
        await mfa_service.verify_backup_code(
            user_id=test_user.id,
            code=initial_codes[i],
            session=async_db_session,
        )

    # Regenerate
    await client.post(
        "/api/v1/auth/2fa/regenerate-backup-codes",
        json={"password": "test_password"},
    )

    # Should have 10 new unused codes
    count = await mfa_service.get_remaining_backup_codes_count(
        user_id=test_user.id, session=async_db_session
    )
    assert count == 10
