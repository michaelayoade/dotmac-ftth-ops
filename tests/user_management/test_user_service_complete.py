"""
Complete comprehensive tests for User Management Service.

Focuses on filling coverage gaps and testing edge cases not covered by existing tests.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def mock_session():
    """Create mock AsyncSession."""
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    session.rollback = AsyncMock()
    session.scalar = AsyncMock()
    return session


@pytest.fixture
def user_service(mock_session):
    """Create UserService with mock session."""
    return UserService(mock_session)


@pytest.fixture
def sample_user():
    """Create sample user for testing."""
    user = Mock(spec=User)
    user.id = uuid4()
    user.username = "testuser"
    user.email = "test@example.com"
    user.password_hash = "$2b$12$KIXv9P7WqLZLq3fK8qYZReV6P7Q.T0mF6t8tZfZKmH7KH6KH7KH7KH"
    user.full_name = "Test User"
    user.phone_number = "+1234567890"
    user.is_active = True
    user.is_verified = True
    user.is_superuser = False
    user.roles = ["user"]
    user.permissions = ["read"]
    user.mfa_enabled = False
    user.mfa_secret = None
    user.last_login = None
    user.last_login_ip = None
    user.failed_login_attempts = 0
    user.locked_until = None
    user.metadata_ = {}
    user.created_at = datetime.now(UTC)
    user.updated_at = datetime.now(UTC)
    user.tenant_id = "tenant_123"
    return user


# ============================================================================
# Update Last Login Tests
# ============================================================================


@pytest.mark.unit
class TestUpdateLastLogin:
    """Test update_last_login method."""

    @pytest.mark.asyncio
    async def test_update_last_login_success(self, user_service, mock_session, sample_user):
        """Test successful update of last login."""
        # Mock get_user_by_id
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        result = await user_service.update_last_login(sample_user.id, ip_address="192.168.1.1")

        assert result == sample_user
        assert sample_user.last_login is not None
        assert sample_user.last_login_ip == "192.168.1.1"
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_last_login_without_ip(self, user_service, mock_session, sample_user):
        """Test update last login without IP address."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        result = await user_service.update_last_login(sample_user.id)

        assert result == sample_user
        assert sample_user.last_login is not None
        # IP should not be set
        assert sample_user.last_login_ip is None
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_last_login_user_not_found(self, user_service, mock_session):
        """Test update last login for non-existent user."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        result = await user_service.update_last_login(uuid4())

        assert result is None
        mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_last_login_with_string_id(self, user_service, mock_session, sample_user):
        """Test update last login with string user ID."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        result = await user_service.update_last_login(str(sample_user.id), "10.0.0.1")

        assert result == sample_user
        assert sample_user.last_login is not None
        mock_session.commit.assert_called_once()


# ============================================================================
# MFA Tests (Full Coverage)
# ============================================================================


@pytest.mark.unit
class TestMFAOperations:
    """Test MFA enable/disable operations."""

    @pytest.mark.asyncio
    async def test_enable_mfa_success(self, user_service, mock_session, sample_user):
        """Test successfully enabling MFA."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        secret = await user_service.enable_mfa(sample_user.id)

        assert secret is not None
        assert len(secret) == 40  # 20 bytes hex = 40 characters
        assert sample_user.mfa_enabled is True
        assert sample_user.mfa_secret == secret
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_enable_mfa_user_not_found(self, user_service, mock_session):
        """Test enabling MFA for non-existent user."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        with pytest.raises(ValueError, match="User not found"):
            await user_service.enable_mfa(uuid4())

        mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_disable_mfa_success(self, user_service, mock_session, sample_user):
        """Test successfully disabling MFA."""
        # Set up user with MFA enabled
        sample_user.mfa_enabled = True
        sample_user.mfa_secret = "existing_secret"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        result = await user_service.disable_mfa(sample_user.id)

        assert result is True
        assert sample_user.mfa_enabled is False
        assert sample_user.mfa_secret is None
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_disable_mfa_user_not_found(self, user_service, mock_session):
        """Test disabling MFA for non-existent user."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        result = await user_service.disable_mfa(uuid4())

        assert result is False
        mock_session.commit.assert_not_called()


# ============================================================================
# Role Management Edge Cases
# ============================================================================


@pytest.mark.unit
class TestRoleManagementEdgeCases:
    """Test role addition and removal edge cases."""

    @pytest.mark.asyncio
    async def test_add_role_to_user_without_existing_roles(
        self, user_service, mock_session, sample_user
    ):
        """Test adding role when user has no existing roles."""
        sample_user.roles = []

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        user = await user_service.add_role(sample_user.id, "admin")

        assert user == sample_user
        assert "admin" in sample_user.roles
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_role_already_exists(self, user_service, mock_session, sample_user):
        """Test adding role that user already has."""
        sample_user.roles = ["user", "admin"]

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        user = await user_service.add_role(sample_user.id, "admin")

        assert user == sample_user
        # Role should not be duplicated
        assert sample_user.roles.count("admin") <= 1
        # Commit should not be called when role already exists
        mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_remove_role_not_in_list(self, user_service, mock_session, sample_user):
        """Test removing role that user doesn't have."""
        sample_user.roles = ["user"]

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        user = await user_service.remove_role(sample_user.id, "admin")

        assert user == sample_user
        assert "admin" not in sample_user.roles
        # Commit should not be called when role doesn't exist
        mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_remove_last_role(self, user_service, mock_session, sample_user):
        """Test removing the last role from user."""
        sample_user.roles = ["user"]

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        user = await user_service.remove_role(sample_user.id, "user")

        assert user == sample_user
        assert sample_user.roles == []
        mock_session.commit.assert_called_once()


# ============================================================================
# Create User Error Handling
# ============================================================================


@pytest.mark.unit
class TestCreateUserErrorHandling:
    """Test create user error scenarios."""

    @pytest.mark.asyncio
    async def test_create_user_integrity_error_rollback(self, user_service, mock_session):
        """Test that IntegrityError triggers rollback."""
        # Mock get_user_by_username and get_user_by_email to return None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        # Mock commit to raise IntegrityError
        mock_session.commit.side_effect = IntegrityError("", "", "")

        with pytest.raises(ValueError, match="User creation failed"):
            await user_service.create_user(
                username="newuser", email="new@example.com", password="password123"
            )

        mock_session.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_user_with_tenant_id(self, user_service, mock_session):
        """Test creating user with tenant_id."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        await user_service.create_user(
            username="newuser",
            email="new@example.com",
            password="password123",
            tenant_id="tenant_456",
        )

        mock_session.add.assert_called_once()
        created_user = mock_session.add.call_args[0][0]
        assert created_user.tenant_id == "tenant_456"
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_user_with_inactive_status(self, user_service, mock_session):
        """Test creating inactive user."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        await user_service.create_user(
            username="inactiveuser",
            email="inactive@example.com",
            password="password123",
            is_active=False,
        )

        created_user = mock_session.add.call_args[0][0]
        assert created_user.is_active is False
        mock_session.commit.assert_called_once()


# ============================================================================
# Update User Error Handling
# ============================================================================


@pytest.mark.unit
class TestUpdateUserErrorHandling:
    """Test update user error scenarios."""

    @pytest.mark.asyncio
    async def test_update_user_integrity_error_rollback(
        self, user_service, mock_session, sample_user
    ):
        """Test that update IntegrityError triggers rollback."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        mock_session.commit.side_effect = IntegrityError("", "", "")

        with pytest.raises(IntegrityError):
            await user_service.update_user(sample_user.id, full_name="New Name")

        mock_session.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_user_email_conflict_different_user(
        self, user_service, mock_session, sample_user
    ):
        """Test updating email to one already used by another user."""
        # First call returns the user we're updating
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = sample_user

        # Second call returns a different user with the same email
        other_user = Mock(spec=User)
        other_user.id = uuid4()  # Different ID
        email_result = MagicMock()
        email_result.scalar_one_or_none.return_value = other_user

        mock_session.execute.side_effect = [user_result, email_result]

        with pytest.raises(ValueError, match="Email .* is already in use"):
            await user_service.update_user(sample_user.id, email="taken@example.com")

        mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_user_all_optional_fields_none(
        self, user_service, mock_session, sample_user
    ):
        """Test update when all optional fields are None."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        # This should effectively be a no-op except for updated_at
        user = await user_service.update_user(sample_user.id)

        assert user == sample_user
        # updated_at should be updated
        assert sample_user.updated_at is not None
        mock_session.commit.assert_called_once()


# ============================================================================
# List Users Advanced Filtering
# ============================================================================


@pytest.mark.unit
class TestListUsersAdvancedFiltering:
    """Test list_users with various filter combinations."""

    @pytest.mark.asyncio
    async def test_list_users_with_role_filter(self, user_service, mock_session, sample_user):
        """Test listing users filtered by role."""
        # Mock count query result
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        # Mock users query result
        users_result = MagicMock()
        users_result.scalars.return_value.all.return_value = [sample_user]

        # First execute returns count, second returns users
        mock_session.execute.side_effect = [count_result, users_result]

        users, total = await user_service.list_users(
            tenant_id="tenant_123", role="admin", require_tenant=True
        )

        assert len(users) == 1
        assert total == 1
        assert mock_session.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_list_users_with_search_query(self, user_service, mock_session, sample_user):
        """Test listing users with search query."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        users_result = MagicMock()
        users_result.scalars.return_value.all.return_value = [sample_user]

        mock_session.execute.side_effect = [count_result, users_result]

        users, total = await user_service.list_users(
            tenant_id="tenant_123", search="test", require_tenant=True
        )

        assert len(users) == 1
        assert total == 1

    @pytest.mark.asyncio
    async def test_list_users_tenant_required_no_tenant(self, user_service):
        """Test that require_tenant=True without tenant raises error."""
        with pytest.raises(ValueError, match="tenant_id is required"):
            await user_service.list_users(require_tenant=True)

    @pytest.mark.asyncio
    async def test_list_users_tenant_required_empty_string(self, user_service):
        """Test that require_tenant=True with empty string raises error."""
        with pytest.raises(ValueError, match="tenant_id is required"):
            await user_service.list_users(tenant_id="", require_tenant=True)

    @pytest.mark.asyncio
    async def test_list_users_tenant_required_whitespace(self, user_service):
        """Test that require_tenant=True with whitespace raises error."""
        with pytest.raises(ValueError, match="tenant_id is required"):
            await user_service.list_users(tenant_id="   ", require_tenant=True)

    @pytest.mark.asyncio
    async def test_list_users_bypass_tenant_requirement(
        self, user_service, mock_session, sample_user
    ):
        """Test listing all users when tenant requirement is bypassed."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        users_result = MagicMock()
        users_result.scalars.return_value.all.return_value = [sample_user]

        mock_session.execute.side_effect = [count_result, users_result]

        users, total = await user_service.list_users(require_tenant=False)

        assert len(users) == 1
        assert total == 1

    @pytest.mark.asyncio
    async def test_list_users_all_filters_combined(self, user_service, mock_session, sample_user):
        """Test listing users with all filters applied."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        users_result = MagicMock()
        users_result.scalars.return_value.all.return_value = [sample_user]

        mock_session.execute.side_effect = [count_result, users_result]

        users, total = await user_service.list_users(
            skip=10,
            limit=20,
            is_active=True,
            role="admin",
            tenant_id="tenant_123",
            search="user",
            require_tenant=True,
        )

        assert len(users) == 1
        assert total == 1


# ============================================================================
# Authentication Advanced Scenarios
# ============================================================================


@pytest.mark.unit
class TestAuthenticationAdvancedScenarios:
    """Test authentication edge cases."""

    @pytest.mark.asyncio
    async def test_authenticate_account_lock_expires(self, user_service, mock_session, sample_user):
        """Test that expired lock allows authentication."""
        # Set lock that has expired
        sample_user.locked_until = datetime.now(UTC) - timedelta(hours=1)
        sample_user.failed_login_attempts = 5

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        with patch.object(user_service, "verify_password", return_value=True):
            user = await user_service.authenticate("testuser", "correct_password")

        assert user == sample_user
        # Failed attempts should be reset
        assert sample_user.failed_login_attempts == 0
        assert sample_user.locked_until is None

    @pytest.mark.asyncio
    async def test_authenticate_increments_failed_attempts(
        self, user_service, mock_session, sample_user
    ):
        """Test that failed login increments counter."""
        sample_user.failed_login_attempts = 2

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        with patch.object(user_service, "verify_password", return_value=False):
            user = await user_service.authenticate("testuser", "wrong_password")

        assert user is None
        assert sample_user.failed_login_attempts == 3
        mock_session.commit.assert_called()

    @pytest.mark.asyncio
    async def test_authenticate_locks_after_5_attempts(
        self, user_service, mock_session, sample_user
    ):
        """Test that 5 failed attempts locks the account."""
        sample_user.failed_login_attempts = 4

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        with patch.object(user_service, "verify_password", return_value=False):
            user = await user_service.authenticate("testuser", "wrong_password")

        assert user is None
        assert sample_user.failed_login_attempts == 5
        assert sample_user.locked_until is not None
        assert sample_user.locked_until > datetime.now(UTC)


# ============================================================================
# Password Hashing
# ============================================================================


@pytest.mark.unit
class TestPasswordHashing:
    """Test password hashing functionality."""

    def test_hash_password_generates_hash(self, user_service):
        """Test that password hashing generates a hash."""
        password = "test_password_123"
        hashed = user_service._hash_password(password)

        assert hashed is not None
        assert hashed != password
        assert len(hashed) > 20  # Bcrypt hashes are much longer

    def test_hash_password_different_for_same_password(self, user_service):
        """Test that same password generates different hashes (salt)."""
        password = "test_password_123"
        hash1 = user_service._hash_password(password)
        hash2 = user_service._hash_password(password)

        # Should be different due to salt
        assert hash1 != hash2

    def test_hash_password_empty_string(self, user_service):
        """Test hashing empty string."""
        hashed = user_service._hash_password("")
        assert hashed is not None
        assert len(hashed) > 0


# ============================================================================
# Additional Coverage Tests
# ============================================================================


@pytest.mark.unit
class TestAdditionalCoverage:
    """Additional tests to reach 90% coverage."""

    @pytest.mark.asyncio
    async def test_update_user_same_email_no_conflict(
        self, user_service, mock_session, sample_user
    ):
        """Test updating user with their own email (no conflict)."""
        # First call returns the user
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = sample_user

        # Second call for email check returns the same user (no conflict)
        email_result = MagicMock()
        email_result.scalar_one_or_none.return_value = sample_user  # Same user

        mock_session.execute.side_effect = [user_result, email_result]

        user = await user_service.update_user(sample_user.id, email=sample_user.email.upper())

        assert user == sample_user
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_user_all_fields_provided(self, user_service, mock_session, sample_user):
        """Test updating user with all possible fields."""
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = sample_user

        # Email check returns same user (no conflict)
        email_result = MagicMock()
        email_result.scalar_one_or_none.return_value = sample_user

        mock_session.execute.side_effect = [user_result, email_result]

        user = await user_service.update_user(
            sample_user.id,
            email="new@example.com",
            full_name="New Name",
            roles=["admin"],
            permissions=["write"],
            is_active=False,
            is_verified=True,
            phone_number="+9876543210",
            metadata={"key": "value"},
        )

        assert user == sample_user
        assert sample_user.email == "new@example.com"
        assert sample_user.full_name == "New Name"
        assert sample_user.roles == ["admin"]
        assert sample_user.permissions == ["write"]
        assert sample_user.is_active is False
        assert sample_user.is_verified is True
        assert sample_user.phone_number == "+9876543210"
        assert sample_user.metadata_ == {"key": "value"}
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_change_password_user_not_found_string_id(self, user_service, mock_session):
        """Test change password with string ID for non-existent user."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        result = await user_service.change_password(str(uuid4()), "old_password", "new_password")

        assert result is False
        mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_authenticate_inactive_user_after_password_check(
        self, user_service, mock_session, sample_user
    ):
        """Test authenticating inactive user (after password verified)."""
        sample_user.is_active = False

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        with patch.object(user_service, "verify_password", return_value=True):
            user = await user_service.authenticate("testuser", "correct_password")

        assert user is None

    @pytest.mark.asyncio
    async def test_authenticate_locked_account_still_locked(
        self, user_service, mock_session, sample_user
    ):
        """Test authenticating account that is still locked."""
        # Set lock that is still active
        sample_user.locked_until = datetime.now(UTC) + timedelta(hours=1)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_user
        mock_session.execute.return_value = mock_result

        user = await user_service.authenticate("testuser", "password")

        assert user is None
        # Should not even try to verify password
        mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_authenticate_by_email_not_found(self, user_service, mock_session):
        """Test authentication with email when user doesn't exist."""
        # Both username and email lookups return None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        user = await user_service.authenticate("notfound@example.com", "password")

        assert user is None
        assert mock_session.execute.call_count == 2  # username and email lookups
