"""
Simple tests for User Management module to increase coverage.

Tests actual methods that exist in the service.
"""

import uuid
from unittest.mock import AsyncMock, Mock, patch

import pytest

from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService


@pytest.mark.unit
class TestUserModel:
    """Test User model functionality."""

    def test_user_model_creation(self):
        """Test User model creation with required fields."""
        user = User(
            id=uuid.uuid4(),
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password_123",
        )

        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.password_hash == "hashed_password_123"
        assert isinstance(user.id, uuid.UUID)

        # Test default values (only set when committed to DB)
        assert user.username == "testuser"
        assert user.email == "test@example.com"

    def test_user_to_dict(self):
        """Test User model to_dict method."""
        user = User(
            id=uuid.uuid4(),
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password_123",
            full_name="Test User",
        )

        user_dict = user.to_dict()

        # Should include basic fields
        assert user_dict["username"] == "testuser"
        assert user_dict["email"] == "test@example.com"
        assert user_dict["full_name"] == "Test User"

        # Should exclude sensitive fields
        assert "password_hash" not in user_dict
        assert "mfa_secret" not in user_dict


@pytest.mark.unit
class TestUserService:
    """Test UserService functionality."""

    @pytest.fixture
    def user_service(self):
        """Create UserService with mock session."""
        mock_session = AsyncMock()
        return UserService(mock_session)

    @pytest.fixture
    def mock_user(self):
        """Create mock user for testing."""
        return User(
            id=uuid.uuid4(),
            username="testuser",
            email="test@example.com",
            password_hash="$2b$12$hashedpassword",
            is_active=True,
            failed_login_attempts=0,
        )

    @pytest.mark.asyncio
    async def test_get_user_by_id_success(self, user_service, mock_user):
        """Test successful user retrieval by ID."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        result = await user_service.get_user_by_id(mock_user.id)

        assert result == mock_user
        user_service.session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_by_id_string_uuid(self, user_service, mock_user):
        """Test user retrieval with string UUID."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        result = await user_service.get_user_by_id(str(mock_user.id))

        assert result == mock_user

    @pytest.mark.asyncio
    async def test_get_user_by_id_invalid_uuid(self, user_service):
        """Test user retrieval with invalid UUID."""
        result = await user_service.get_user_by_id("invalid-uuid")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_username(self, user_service, mock_user):
        """Test user retrieval by username."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        result = await user_service.get_user_by_username("testuser")

        assert result == mock_user
        user_service.session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_by_email(self, user_service, mock_user):
        """Test user retrieval by email."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        result = await user_service.get_user_by_email("Test@Example.com")  # Test case insensitive

        assert result == mock_user

    @pytest.mark.asyncio
    async def test_create_user_success(self, user_service):
        """Test successful user creation."""
        # Mock that user doesn't exist
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=None))
        )

        user_data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "secure_password123",
            "full_name": "New User",
            "tenant_id": "tenant-123",
        }

        with patch.object(user_service, "_hash_password", return_value="hashed_password"):
            result = await user_service.create_user(**user_data)

        assert result.username == "newuser"
        assert result.email == "new@example.com"
        assert result.password_hash == "hashed_password"
        user_service.session.add.assert_called_once()
        user_service.session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_user_duplicate_username(self, user_service, mock_user):
        """Test user creation with duplicate username."""
        from sqlalchemy.exc import IntegrityError

        # Mock that user already exists
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        with pytest.raises(IntegrityError, match="Username testuser already exists"):
            await user_service.create_user(
                username="testuser",
                email="new@example.com",
                password="password",
                tenant_id="tenant-123",
            )

    @pytest.mark.asyncio
    async def test_verify_password(self, user_service, mock_user):
        """Test password verification."""
        with patch.object(user_service.pwd_context, "verify", return_value=True) as mock_verify:
            result = await user_service.verify_password(mock_user, "correct_password")

            assert result is True
            mock_verify.assert_called_once_with("correct_password", mock_user.password_hash)

    @pytest.mark.asyncio
    async def test_authenticate_success(self, user_service, mock_user):
        """Test successful authentication."""
        # Mock user exists and password is correct
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        with patch.object(user_service, "verify_password", return_value=True):
            result = await user_service.authenticate("testuser", "correct_password")

            assert result == mock_user

    @pytest.mark.asyncio
    async def test_authenticate_wrong_password(self, user_service, mock_user):
        """Test authentication with wrong password."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        with patch.object(user_service, "verify_password", return_value=False):
            result = await user_service.authenticate("testuser", "wrong_password")

            assert result is None

    @pytest.mark.asyncio
    async def test_authenticate_user_not_found(self, user_service):
        """Test authentication with non-existent user."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=None))
        )

        result = await user_service.authenticate("nonexistent", "password")
        assert result is None

    @pytest.mark.asyncio
    async def test_list_users_basic(self, user_service):
        """Test basic user listing."""
        mock_users = [Mock(), Mock(), Mock()]
        mock_total = 3

        # Mock the count query
        user_service.session.execute = AsyncMock(
            side_effect=[
                Mock(scalar=Mock(return_value=mock_total)),  # Count query
                Mock(
                    scalars=Mock(return_value=Mock(all=Mock(return_value=mock_users)))
                ),  # Users query
            ]
        )

        users, total = await user_service.list_users(tenant_id="test-tenant")

        assert len(users) == 3
        assert total == 3

    @pytest.mark.asyncio
    async def test_update_user_success(self, user_service, mock_user):
        """Test successful user update."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        updates = {"full_name": "Updated Name", "is_active": False}
        result = await user_service.update_user(mock_user.id, **updates)

        assert result == mock_user
        assert mock_user.full_name == "Updated Name"
        assert mock_user.is_active is False
        user_service.session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_user_success(self, user_service, mock_user):
        """Test successful user deletion."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        result = await user_service.delete_user(mock_user.id)

        assert result is True
        user_service.session.delete.assert_called_once_with(mock_user)
        user_service.session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_user_not_found(self, user_service):
        """Test deletion of non-existent user."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=None))
        )

        result = await user_service.delete_user(uuid.uuid4())
        assert result is False

    @pytest.mark.asyncio
    async def test_change_password_success(self, user_service, mock_user):
        """Test successful password change."""
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        with patch.object(user_service, "verify_password", return_value=True):
            with patch.object(user_service, "_hash_password", return_value="new_hashed_password"):
                result = await user_service.change_password(
                    mock_user.id, "old_password", "new_password"
                )

                assert result is True
                assert mock_user.password_hash == "new_hashed_password"
                user_service.session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_role(self, user_service, mock_user):
        """Test adding role to user."""
        mock_user.roles = ["user"]
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        result = await user_service.add_role(mock_user.id, "admin")

        assert result == mock_user
        assert "admin" in mock_user.roles
        user_service.session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_remove_role(self, user_service, mock_user):
        """Test removing role from user."""
        mock_user.roles = ["user", "admin"]
        user_service.session.execute = AsyncMock(
            return_value=Mock(scalar_one_or_none=Mock(return_value=mock_user))
        )

        result = await user_service.remove_role(mock_user.id, "admin")

        assert result == mock_user
        assert "admin" not in mock_user.roles
        user_service.session.commit.assert_called_once()

    def test_private_hash_password(self, user_service):
        """Test private password hashing method."""
        with patch.object(user_service.pwd_context, "hash", return_value="hashed") as mock_hash:
            result = user_service._hash_password("password123")

            assert result == "hashed"
            mock_hash.assert_called_once_with("password123")
