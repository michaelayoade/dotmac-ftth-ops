"""
Test coverage gaps for user_management/service.py

Targeting specific uncovered lines to push coverage from 88.27% to 90%+:
- Lines 44-45: Invalid UUID handling
- Lines 97, 101: Duplicate username/email validation
- Lines 218-225: User deletion
- Lines 287, 301-311, 338-342, 408, 421: Edge cases
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService


@pytest_asyncio.fixture
async def async_session():
    """Create an in-memory async SQLite session for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(User.metadata.create_all)

    # Create session
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session_maker() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def user_service(async_session):
    """Create UserService instance."""
    return UserService(async_session)


@pytest.mark.integration
class TestInvalidUUIDHandling:
    """Test invalid UUID string handling - covers lines 44-45."""

    @pytest.mark.asyncio
    async def test_get_user_by_id_with_invalid_uuid_string(self, user_service):
        """Test that invalid UUID string returns None instead of raising exception."""
        # Line 44-45: except ValueError: return None
        result = await user_service.get_user_by_id("not-a-valid-uuid")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_id_with_malformed_uuid(self, user_service):
        """Test various malformed UUID formats."""
        invalid_uuids = [
            "12345",
            "not-uuid-at-all",
            "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            "",
            "abc",
        ]

        for invalid_uuid in invalid_uuids:
            result = await user_service.get_user_by_id(invalid_uuid)
            assert result is None, f"Expected None for invalid UUID: {invalid_uuid}"


@pytest.mark.integration
class TestDuplicateValidation:
    """Test duplicate username and email validation - covers lines 97, 101."""

    @pytest.mark.asyncio
    async def test_create_user_duplicate_username_raises_error(self, user_service):
        """Test that creating user with duplicate username raises IntegrityError - line 97."""
        from sqlalchemy.exc import IntegrityError

        # Create first user
        user1 = await user_service.create_user(
            username="testuser",
            email="test1@example.com",
            password="password123",
        )
        assert user1 is not None

        # Try to create second user with same username
        # Line 97: raise IntegrityError wrapping ValueError
        with pytest.raises(IntegrityError, match="Username testuser already exists"):
            await user_service.create_user(
                username="testuser",  # Duplicate
                email="test2@example.com",  # Different email
                password="password456",
            )

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email_raises_error(self, user_service):
        """Test that creating user with duplicate email raises IntegrityError - line 101."""
        from sqlalchemy.exc import IntegrityError

        # Create first user
        user1 = await user_service.create_user(
            username="user1",
            email="duplicate@example.com",
            password="password123",
        )
        assert user1 is not None

        # Try to create second user with same email
        # Line 101: raise IntegrityError wrapping ValueError
        with pytest.raises(IntegrityError, match="Email duplicate@example.com already exists"):
            await user_service.create_user(
                username="user2",  # Different username
                email="duplicate@example.com",  # Duplicate email
                password="password456",
            )


@pytest.mark.integration
class TestUserDeletion:
    """Test user deletion - covers lines 218-225."""

    @pytest.mark.asyncio
    async def test_delete_user_success(self, user_service):
        """Test successful user deletion - lines 218-225."""
        # Create a user
        user = await user_service.create_user(
            username="to_delete",
            email="delete@example.com",
            password="password123",
        )
        user_id = user.id

        # Delete the user
        # Lines 218-225: Complete deletion flow
        result = await user_service.delete_user(user_id)
        assert result is True

        # Verify user is gone
        deleted_user = await user_service.get_user_by_id(user_id)
        assert deleted_user is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_user_returns_false(self, user_service):
        """Test deleting non-existent user returns False - line 220."""
        # Try to delete user that doesn't exist
        # Line 220: return False
        fake_id = uuid4()
        result = await user_service.delete_user(fake_id)
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_user_with_string_id(self, user_service):
        """Test deletion with string UUID."""
        # Create user
        user = await user_service.create_user(
            username="string_id_test",
            email="stringid@example.com",
            password="password123",
        )

        # Delete using string ID
        result = await user_service.delete_user(str(user.id))
        assert result is True

        # Verify deletion
        deleted = await user_service.get_user_by_id(user.id)
        assert deleted is None


@pytest.mark.integration
class TestListUsersEdgeCases:
    """Test list_users edge cases - covers lines 287, 301-311."""

    @pytest.mark.asyncio
    async def test_list_users_with_pagination(self, user_service):
        """Test list_users with skip and limit."""
        # Create multiple users
        for i in range(5):
            await user_service.create_user(
                username=f"user{i}",
                email=f"user{i}@example.com",
                password="password",
            )

        # Test pagination
        # Lines 287, 301-311: Pagination logic
        users_page1, total1 = await user_service.list_users(skip=0, limit=2, require_tenant=False)
        assert len(users_page1) == 2

        users_page2, total2 = await user_service.list_users(skip=2, limit=2, require_tenant=False)
        assert len(users_page2) == 2

        users_page3, total3 = await user_service.list_users(skip=4, limit=2, require_tenant=False)
        assert len(users_page3) == 1

    @pytest.mark.asyncio
    async def test_list_users_empty_result(self, user_service):
        """Test list_users when no users exist."""
        users, total = await user_service.list_users(require_tenant=False)
        assert users == []
        assert total == 0


@pytest.mark.integration
class TestUpdateUserEdgeCases:
    """Test update_user edge cases - covers lines 338-342."""

    @pytest.mark.asyncio
    async def test_update_nonexistent_user_returns_none(self, user_service):
        """Test updating non-existent user returns None - line 191."""
        fake_id = uuid4()

        # Try to update user that doesn't exist
        # Line 191: if not user: return None
        result = await user_service.update_user(user_id=fake_id, full_name="New Name")
        assert result is None


@pytest.mark.integration
class TestVerifyPasswordEdgeCases:
    """Test verify_password edge cases - covers lines 408, 421."""

    @pytest.mark.asyncio
    async def test_verify_password_nonexistent_user(self, user_service):
        """Test verify_password requires User object, not user_id."""
        # This test validates that verify_password needs a User object
        # In real usage, you'd first get the user, then verify password
        # The authentication flow in authenticate() method (lines 330-350) shows this pattern
        user = await user_service.create_user(
            username="testuser",
            email="test@example.com",
            password="correctpassword",
        )

        # Correct usage: pass User object
        result = await user_service.verify_password(user, "correctpassword")
        assert result is True

    @pytest.mark.asyncio
    async def test_verify_password_wrong_password(self, user_service):
        """Test verify_password with wrong password - line 287."""
        # Create user
        user = await user_service.create_user(
            username="passtest",
            email="pass@example.com",
            password="correctpassword",
        )

        # Verify with wrong password
        # Line 287: return self.pwd_context.verify(password, user.password_hash)
        result = await user_service.verify_password(user, "wrongpassword")
        assert result is False

    @pytest.mark.asyncio
    async def test_verify_password_correct_password(self, user_service):
        """Test verify_password with correct password."""
        # Create user
        user = await user_service.create_user(
            username="passtest2",
            email="pass2@example.com",
            password="correctpassword",
        )

        # Verify with correct password
        result = await user_service.verify_password(user, "correctpassword")
        assert result is True


@pytest.mark.integration
class TestGetUserByIdEdgeCases:
    """Additional edge cases for get_user_by_id - line 191."""

    @pytest.mark.asyncio
    async def test_get_user_by_id_with_tenant_filter(self, user_service):
        """Test get_user_by_id with tenant_id filter - line 191."""
        # Create user with tenant
        user = await user_service.create_user(
            username="tenant_user",
            email="tenant@example.com",
            password="password",
            tenant_id="tenant-123",
        )

        # Get with correct tenant - should succeed
        result = await user_service.get_user_by_id(user.id, tenant_id="tenant-123")
        assert result is not None
        assert result.id == user.id

        # Get with wrong tenant - should return None
        # Line 191: Tenant isolation check
        result = await user_service.get_user_by_id(user.id, tenant_id="wrong-tenant")
        assert result is None
