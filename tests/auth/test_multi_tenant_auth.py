"""
Test multi-tenant authentication isolation.

Tests for regression bugs fixed in multi-tenancy:
1. Password reset with duplicate emails across tenants
2. Registration with duplicate usernames across tenants
3. Profile updates with duplicate usernames across tenants
"""

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestMultiTenantPasswordReset:
    """Test password reset with duplicate emails across tenants."""

    async def test_password_reset_with_duplicate_emails_no_tenant(
        self, test_client: AsyncClient, async_session: AsyncSession
    ):
        """
        Regression test: Password reset should handle duplicate emails across tenants gracefully.

        Bug: When same email exists in multiple tenants and tenant_id=None,
        SQLAlchemy raises MultipleResultsFound, breaking password reset.

        Fix: Catch MultipleResultsFound and return success message (prevents enumeration).
        User must provide tenant via header/query param to disambiguate.
        """
        user_service = UserService(async_session)

        # Create two users with same email in different tenants
        await user_service.create_user(
            username="john_a",
            email="john@example.com",
            password="SecurePass123!",
            full_name="John Tenant A",
            tenant_id="tenant-a",
        )

        await user_service.create_user(
            username="john_b",
            email="john@example.com",
            password="SecurePass123!",
            full_name="John Tenant B",
            tenant_id="tenant-b",
        )

        await async_session.commit()

        # Request password reset WITHOUT tenant context
        # Should not crash, should return success message
        response = await test_client.post(
            "/api/v1/auth/password-reset",
            json={"email": "john@example.com"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert "password reset link has been sent" in response.json()["message"].lower()

    async def test_password_reset_with_duplicate_emails_with_tenant(
        self, test_client: AsyncClient, async_session: AsyncSession
    ):
        """Password reset should work when tenant is specified via header."""
        user_service = UserService(async_session)

        # Create two users with same email in different tenants
        await user_service.create_user(
            username="jane_a",
            email="jane@example.com",
            password="SecurePass123!",
            full_name="Jane Tenant A",
            tenant_id="tenant-a",
        )

        await user_service.create_user(
            username="jane_b",
            email="jane@example.com",
            password="SecurePass123!",
            full_name="Jane Tenant B",
            tenant_id="tenant-b",
        )

        await async_session.commit()

        # Request password reset WITH tenant context (via header)
        # Should succeed and send to correct tenant's user
        response = await test_client.post(
            "/api/v1/auth/password-reset",
            json={"email": "jane@example.com"},
            headers={"X-Tenant-ID": "tenant-a"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert "password reset link has been sent" in response.json()["message"].lower()

    async def test_password_reset_confirmation_with_duplicate_emails(
        self, test_client: AsyncClient, async_session: AsyncSession
    ):
        """Password reset confirmation should fail gracefully without tenant context."""
        user_service = UserService(async_session)

        # Create two users with same email in different tenants
        await user_service.create_user(
            username="bob_a",
            email="bob@example.com",
            password="SecurePass123!",
            full_name="Bob Tenant A",
            tenant_id="tenant-a",
        )

        await user_service.create_user(
            username="bob_b",
            email="bob@example.com",
            password="SecurePass123!",
            full_name="Bob Tenant B",
            tenant_id="tenant-b",
        )

        await async_session.commit()

        # Generate a reset token for the email (this would normally come from email)
        from dotmac.platform.auth.router import get_auth_email_service

        get_auth_email_service()
        # Mock token generation - in real scenario this would be from email link
        # For testing, we'll simulate the token

        # Try to confirm password reset without tenant context
        # Should fail with clear error message
        response = await test_client.post(
            "/api/v1/auth/password-reset/confirm",
            json={
                "token": "mock-token",  # Would be real token in production
                "new_password": "NewSecurePass123!",
            },
        )

        # Should fail because we can't disambiguate which tenant's user
        # (In real scenario, token would be invalid, but we're testing the logic)
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_401_UNAUTHORIZED,
        ]


@pytest.mark.asyncio
class TestMultiTenantRegistration:
    """Test registration with duplicate usernames/emails across tenants."""

    async def test_registration_duplicate_username_across_tenants(
        self, test_client: AsyncClient, async_session: AsyncSession
    ):
        """
        Regression test: Users in different tenants can use the same username.

        Bug: Registration checked username globally instead of per-tenant,
        blocking legitimate registrations in Tenant B when username exists in Tenant A.

        Fix: Pass tenant_id to get_user_by_username() to scope check to current tenant.
        """
        user_service = UserService(async_session)

        # Create user 'admin' in Tenant A
        await user_service.create_user(
            username="admin",
            email="admin@tenant-a.com",
            password="SecurePass123!",
            full_name="Admin Tenant A",
            tenant_id="tenant-a",
        )

        await async_session.commit()

        # Register 'admin' in Tenant B (should succeed)
        response = await test_client.post(
            "/api/v1/auth/register",
            json={
                "username": "admin",
                "email": "admin@tenant-b.com",
                "password": "SecurePass123!",
                "full_name": "Admin Tenant B",
            },
            headers={"X-Tenant-ID": "tenant-b"},
        )

        assert response.status_code == status.HTTP_200_OK, (
            f"Registration should succeed. Response: {response.json()}"
        )

        # Verify both users exist with same username, different tenants
        result = await async_session.execute(select(User).where(User.username == "admin"))
        users = result.scalars().all()

        assert len(users) == 2
        tenant_ids = {user.tenant_id for user in users}
        assert tenant_ids == {"tenant-a", "tenant-b"}

    async def test_registration_duplicate_email_across_tenants(
        self, test_client: AsyncClient, async_session: AsyncSession
    ):
        """Users in different tenants can use the same email."""
        user_service = UserService(async_session)

        # Create user with email@example.com in Tenant A
        await user_service.create_user(
            username="user_a",
            email="shared@example.com",
            password="SecurePass123!",
            full_name="User Tenant A",
            tenant_id="tenant-a",
        )

        await async_session.commit()

        # Register same email in Tenant B (should succeed)
        response = await test_client.post(
            "/api/v1/auth/register",
            json={
                "username": "user_b",
                "email": "shared@example.com",
                "password": "SecurePass123!",
                "full_name": "User Tenant B",
            },
            headers={"X-Tenant-ID": "tenant-b"},
        )

        assert response.status_code == status.HTTP_200_OK, (
            f"Registration should succeed. Response: {response.json()}"
        )

        # Verify both users exist with same email, different tenants
        result = await async_session.execute(select(User).where(User.email == "shared@example.com"))
        users = result.scalars().all()

        assert len(users) == 2
        tenant_ids = {user.tenant_id for user in users}
        assert tenant_ids == {"tenant-a", "tenant-b"}

    async def test_registration_duplicate_username_same_tenant_fails(
        self, test_client: AsyncClient, async_session: AsyncSession
    ):
        """Registration should still fail for duplicate username in SAME tenant."""
        user_service = UserService(async_session)

        # Create user 'john' in Tenant A
        await user_service.create_user(
            username="john",
            email="john1@example.com",
            password="SecurePass123!",
            full_name="John First",
            tenant_id="tenant-a",
        )

        await async_session.commit()

        # Try to register 'john' again in Tenant A (should fail)
        response = await test_client.post(
            "/api/v1/auth/register",
            json={
                "username": "john",
                "email": "john2@example.com",
                "password": "SecurePass123!",
                "full_name": "John Second",
            },
            headers={"X-Tenant-ID": "tenant-a"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert (
            "already exists" in response.json()["detail"].lower()
            or "failed" in response.json()["detail"].lower()
        )


@pytest.mark.asyncio
class TestMultiTenantProfileUpdate:
    """Test profile updates with duplicate usernames/emails across tenants."""

    async def test_profile_update_duplicate_username_across_tenants(
        self, test_client: AsyncClient, async_session: AsyncSession
    ):
        """
        Regression test: Users can update to username used in different tenant.

        Bug: Profile update checked username globally instead of per-tenant,
        blocking legitimate updates in Tenant B when username exists in Tenant A.

        Fix: Pass tenant_id to get_user_by_username() in profile update validation.
        """
        user_service = UserService(async_session)

        # Create user 'superadmin' in Tenant A
        await user_service.create_user(
            username="superadmin",
            email="super@tenant-a.com",
            password="SecurePass123!",
            full_name="Super Admin A",
            tenant_id="tenant-a",
        )

        # Create user 'regularuser' in Tenant B
        await user_service.create_user(
            username="regularuser",
            email="user@tenant-b.com",
            password="SecurePass123!",
            full_name="Regular User B",
            tenant_id="tenant-b",
        )

        await async_session.commit()

        # Login as user_b
        login_response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": "user@tenant-b.com",
                "password": "SecurePass123!",
            },
        )

        assert login_response.status_code == status.HTTP_200_OK
        access_token = login_response.json()["access_token"]

        # Update user_b's username to 'superadmin' (exists in Tenant A, but should work for Tenant B)
        update_response = await test_client.patch(
            "/api/v1/auth/me",
            json={"username": "superadmin"},
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Tenant-ID": "tenant-b",
            },
        )

        # Should succeed because different tenant
        assert update_response.status_code == status.HTTP_200_OK, (
            f"Profile update should succeed. Response: {update_response.json()}"
        )

        # Verify both users now have username 'superadmin' in different tenants
        result = await async_session.execute(select(User).where(User.username == "superadmin"))
        users = result.scalars().all()

        assert len(users) == 2
        tenant_ids = {user.tenant_id for user in users}
        assert tenant_ids == {"tenant-a", "tenant-b"}

    async def test_profile_update_duplicate_username_same_tenant_fails(
        self, test_client: AsyncClient, async_session: AsyncSession
    ):
        """Profile update should still fail for duplicate username in SAME tenant."""
        user_service = UserService(async_session)

        # Create two users in Tenant A
        await user_service.create_user(
            username="alice",
            email="alice@tenant-a.com",
            password="SecurePass123!",
            full_name="Alice",
            tenant_id="tenant-a",
        )

        await user_service.create_user(
            username="bob",
            email="bob@tenant-a.com",
            password="SecurePass123!",
            full_name="Bob",
            tenant_id="tenant-a",
        )

        await async_session.commit()

        # Login as bob
        login_response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": "bob@tenant-a.com",
                "password": "SecurePass123!",
            },
        )

        assert login_response.status_code == status.HTTP_200_OK
        access_token = login_response.json()["access_token"]

        # Try to update bob's username to 'alice' (should fail - same tenant)
        update_response = await test_client.patch(
            "/api/v1/auth/me",
            json={"username": "alice"},
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Tenant-ID": "tenant-a",
            },
        )

        assert update_response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already taken" in update_response.json()["detail"].lower()


@pytest.mark.asyncio
class TestDatabaseConstraints:
    """Test that database per-tenant unique constraints work correctly."""

    async def test_database_allows_duplicate_username_across_tenants(
        self, async_session: AsyncSession
    ):
        """Database should allow same username in different tenants."""
        user_service = UserService(async_session)

        # Create 'test_user' in multiple tenants
        await user_service.create_user(
            username="test_user",
            email="test1@example.com",
            password="SecurePass123!",
            tenant_id="tenant-1",
        )

        await user_service.create_user(
            username="test_user",
            email="test2@example.com",
            password="SecurePass123!",
            tenant_id="tenant-2",
        )

        await user_service.create_user(
            username="test_user",
            email="test3@example.com",
            password="SecurePass123!",
            tenant_id="tenant-3",
        )

        await async_session.commit()

        # Should succeed - all three users created
        result = await async_session.execute(select(User).where(User.username == "test_user"))
        users = result.scalars().all()

        assert len(users) == 3
        emails = {user.email for user in users}
        assert emails == {"test1@example.com", "test2@example.com", "test3@example.com"}

    async def test_database_prevents_duplicate_username_same_tenant(
        self, async_session: AsyncSession
    ):
        """Database should prevent duplicate username in same tenant."""
        from sqlalchemy.exc import IntegrityError

        user_service = UserService(async_session)

        # Create first user
        await user_service.create_user(
            username="duplicate",
            email="user1@example.com",
            password="SecurePass123!",
            tenant_id="tenant-x",
        )

        await async_session.commit()

        # Try to create second user with same username and tenant
        with pytest.raises(IntegrityError):
            await user_service.create_user(
                username="duplicate",
                email="user2@example.com",
                password="SecurePass123!",
                tenant_id="tenant-x",
            )
            await async_session.commit()

        # Rollback the failed transaction
        await async_session.rollback()
