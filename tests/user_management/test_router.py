"""Tests for user management API router."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock
from urllib.parse import urlencode

import pytest
from fastapi import HTTPException, status
from starlette.requests import Request

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.router import (
    PasswordChangeRequest,
    UserCreateRequest,
    UserUpdateRequest,
)
from dotmac.platform.user_management.service import UserService

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_user_service():
    """Mock UserService."""
    return AsyncMock(spec=UserService)


@pytest.fixture
def sample_user():
    """Create a sample user for testing."""
    return User(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        password_hash="$2b$12$hashedpassword",
        full_name="Test User",
        roles=["user"],
        is_active=True,
        is_verified=True,
        is_superuser=False,
        mfa_enabled=False,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        tenant_id="tenant-123",
    )


@pytest.fixture
def current_user(sample_user):
    """Mock current user info."""
    return UserInfo(
        user_id=str(sample_user.id),
        email=sample_user.email,
        username=sample_user.username,
        roles=sample_user.roles,
        tenant_id=sample_user.tenant_id,
    )


@pytest.fixture
def admin_user(sample_user):
    """Mock admin user info."""
    return UserInfo(
        user_id=str(sample_user.id),
        email=sample_user.email,
        username=sample_user.username,
        roles=["admin"],
        tenant_id=sample_user.tenant_id,
    )


@pytest.fixture
def request_factory():
    """Factory to build ASGI Request objects for router tests."""

    def _build_request(
        headers: dict[str, str] | None = None, query_params: dict[str, str] | None = None
    ) -> Request:
        asgi_headers = []
        if headers:
            asgi_headers = [
                (key.lower().encode("latin-1"), value.encode("latin-1"))
                for key, value in headers.items()
            ]
        query_string = b""
        if query_params:
            query_string = urlencode(query_params).encode("latin-1")

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "raw_path": b"/",
            "headers": asgi_headers,
            "query_string": query_string,
        }
        return Request(scope)

    return _build_request


class TestUserRouter:
    """Test User Management API Router."""


class TestUserProfileEndpoints:
    """Test user profile endpoints."""

    @pytest.mark.asyncio
    async def test_get_current_user_profile_success(
        self, sample_user, current_user, mock_user_service
    ):
        """Test getting current user profile successfully."""
        # Arrange
        from dotmac.platform.user_management.router import get_current_user_profile

        mock_user_service.get_user_by_id.return_value = sample_user

        # Act
        response = await get_current_user_profile(current_user, mock_user_service)

        # Assert
        assert response.user_id == str(sample_user.id)
        assert response.username == sample_user.username
        assert response.email == sample_user.email
        mock_user_service.get_user_by_id.assert_called_once_with(
            current_user.user_id, tenant_id=current_user.tenant_id
        )

    @pytest.mark.asyncio
    async def test_get_current_user_profile_not_found(self, current_user, mock_user_service):
        """Test getting current user profile when user not found."""
        # Arrange
        from dotmac.platform.user_management.router import get_current_user_profile

        mock_user_service.get_user_by_id.return_value = None

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_profile(current_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "User profile not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_update_current_user_profile_success(
        self, sample_user, current_user, mock_user_service
    ):
        """Test updating current user profile successfully."""
        # Arrange
        from dotmac.platform.user_management.router import update_current_user_profile

        updates = UserUpdateRequest(
            full_name="Updated Name",
            email="updated@example.com",
            is_active=True,
        )

        sample_user.full_name = "Updated Name"
        sample_user.email = "updated@example.com"
        mock_user_service.update_user.return_value = sample_user

        # Act
        response = await update_current_user_profile(updates, current_user, mock_user_service)

        # Assert
        assert response.full_name == "Updated Name"
        assert response.email == "updated@example.com"
        mock_user_service.update_user.assert_called_once()
        call_args = mock_user_service.update_user.call_args
        assert call_args[1]["tenant_id"] == current_user.tenant_id
        # Check that roles are excluded from update
        assert "roles" not in call_args[1]

    @pytest.mark.asyncio
    async def test_update_current_user_profile_not_found(self, current_user, mock_user_service):
        """Test updating current user profile when user not found."""
        # Arrange
        from dotmac.platform.user_management.router import update_current_user_profile

        updates = UserUpdateRequest(full_name="Updated Name")
        mock_user_service.update_user.return_value = None

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await update_current_user_profile(updates, current_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "User not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_change_password_success(self, current_user, mock_user_service):
        """Test changing password successfully."""
        # Arrange
        from dotmac.platform.user_management.router import change_password

        request = PasswordChangeRequest(
            current_password="oldpassword",
            new_password="newpassword123",
            confirm_password="newpassword123",
        )

        mock_user_service.change_password.return_value = True

        # Act
        response = await change_password(request, current_user, mock_user_service)

        # Assert
        assert response["message"] == "Password changed successfully"
        mock_user_service.change_password.assert_called_once_with(
            user_id=current_user.user_id,
            current_password="oldpassword",
            new_password="newpassword123",
            tenant_id=current_user.tenant_id,
        )

    @pytest.mark.asyncio
    async def test_change_password_mismatch(self, current_user, mock_user_service):
        """Test changing password with password mismatch."""
        # Arrange
        from dotmac.platform.user_management.router import change_password

        request = PasswordChangeRequest(
            current_password="oldpassword",
            new_password="newpassword123",
            confirm_password="differentpassword",
        )

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await change_password(request, current_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Passwords do not match" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_change_password_failure(self, current_user, mock_user_service):
        """Test changing password fails (wrong current password)."""
        # Arrange
        from dotmac.platform.user_management.router import change_password

        request = PasswordChangeRequest(
            current_password="wrongpassword",
            new_password="newpassword123",
            confirm_password="newpassword123",
        )

        mock_user_service.change_password.return_value = False

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await change_password(request, current_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Failed to change password" in str(exc_info.value.detail)


class TestUserManagementEndpoints:
    """Test admin user management endpoints."""

    @pytest.mark.asyncio
    async def test_list_users_success(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test listing users successfully."""
        # Arrange
        from dotmac.platform.user_management.router import list_users

        users = [sample_user]
        total = 1
        mock_user_service.list_users.return_value = (users, total)

        # Act
        response = await list_users(
            skip=0,
            limit=100,
            is_active=None,
            role=None,
            search=None,
            request=request_factory(),
            admin_user=admin_user,
            user_service=mock_user_service,
        )

        # Assert
        assert len(response.users) == 1
        assert response.total == 1
        assert response.page == 1
        assert response.per_page == 100
        mock_user_service.list_users.assert_called_once_with(
            skip=0,
            limit=100,
            is_active=None,
            role=None,
            search=None,
            tenant_id=admin_user.tenant_id,
            require_tenant=True,
        )

    @pytest.mark.asyncio
    async def test_list_users_with_filters(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test listing users with filters."""
        # Arrange
        from dotmac.platform.user_management.router import list_users

        users = [sample_user]
        total = 1
        mock_user_service.list_users.return_value = (users, total)

        # Act
        response = await list_users(
            skip=20,
            limit=10,
            is_active=True,
            role="admin",
            search="test",
            request=request_factory(),
            admin_user=admin_user,
            user_service=mock_user_service,
        )

        # Assert
        assert response.page == 3  # (skip // limit) + 1 = (20 // 10) + 1 = 3
        assert response.per_page == 10
        mock_user_service.list_users.assert_called_once_with(
            skip=20,
            limit=10,
            is_active=True,
            role="admin",
            search="test",
            tenant_id=admin_user.tenant_id,
            require_tenant=True,
        )

    @pytest.mark.asyncio
    async def test_create_user_success(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test creating user successfully."""
        # Arrange
        from dotmac.platform.user_management.router import create_user

        user_data = UserCreateRequest(
            username="newuser",
            email="new@example.com",
            password="password123",
            full_name="New User",
            roles=["user"],
            is_active=True,
        )

        mock_user_service.create_user.return_value = sample_user

        # Act
        response = await create_user(user_data, request_factory(), admin_user, mock_user_service)

        # Assert
        assert response.user_id == str(sample_user.id)
        mock_user_service.create_user.assert_called_once_with(
            username="newuser",
            email="new@example.com",
            password="password123",
            full_name="New User",
            roles=["user"],
            is_active=True,
            tenant_id=admin_user.tenant_id,
        )

    @pytest.mark.asyncio
    async def test_create_user_validation_error(
        self, admin_user, mock_user_service, request_factory
    ):
        """Test creating user with validation error."""
        # Arrange
        from dotmac.platform.user_management.router import create_user

        user_data = UserCreateRequest(
            username="newuser",
            email="new@example.com",
            password="password123",
        )

        mock_user_service.create_user.side_effect = ValueError("Username already exists")

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await create_user(user_data, request_factory(), admin_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Username already exists" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_get_user_success(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test getting specific user successfully."""
        # Arrange
        from dotmac.platform.user_management.router import get_user

        mock_user_service.get_user_by_id.return_value = sample_user

        # Act
        response = await get_user(
            str(sample_user.id), request_factory(), admin_user, mock_user_service
        )

        # Assert
        assert response.user_id == str(sample_user.id)
        mock_user_service.get_user_by_id.assert_called_once_with(
            str(sample_user.id), tenant_id=admin_user.tenant_id
        )

    @pytest.mark.asyncio
    async def test_get_user_not_found(self, admin_user, mock_user_service, request_factory):
        """Test getting user that doesn't exist."""
        # Arrange
        from dotmac.platform.user_management.router import get_user

        user_id = str(uuid.uuid4())
        mock_user_service.get_user_by_id.return_value = None

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await get_user(user_id, request_factory(), admin_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert f"User {user_id} not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_update_user_success(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test updating user successfully."""
        # Arrange
        from dotmac.platform.user_management.router import update_user

        updates = UserUpdateRequest(
            full_name="Updated Name",
            roles=["admin", "user"],
        )

        sample_user.full_name = "Updated Name"
        sample_user.roles = ["admin", "user"]
        mock_user_service.update_user.return_value = sample_user

        # Act
        response = await update_user(
            str(sample_user.id), updates, request_factory(), admin_user, mock_user_service
        )

        # Assert
        assert response.full_name == "Updated Name"
        assert response.roles == ["admin", "user"]
        mock_user_service.update_user.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_user_not_found(self, admin_user, mock_user_service, request_factory):
        """Test updating user that doesn't exist."""
        # Arrange
        from dotmac.platform.user_management.router import update_user

        user_id = str(uuid.uuid4())
        updates = UserUpdateRequest(full_name="Updated Name")
        mock_user_service.update_user.return_value = None

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await update_user(user_id, updates, request_factory(), admin_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert f"User {user_id} not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_update_user_validation_error(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test updating user with validation error."""
        # Arrange
        from dotmac.platform.user_management.router import update_user

        updates = UserUpdateRequest(email="existing@example.com")
        mock_user_service.update_user.side_effect = ValueError("Email is already in use")

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await update_user(
                str(sample_user.id), updates, request_factory(), admin_user, mock_user_service
            )

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Email is already in use" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_delete_user_success(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test deleting user successfully."""
        # Arrange
        from dotmac.platform.user_management.router import delete_user

        mock_user_service.delete_user.return_value = True

        # Act
        response = await delete_user(
            str(sample_user.id), request_factory(), admin_user, mock_user_service
        )

        # Assert
        assert response is None  # 204 No Content
        mock_user_service.delete_user.assert_called_once_with(
            str(sample_user.id), tenant_id=admin_user.tenant_id
        )

    @pytest.mark.asyncio
    async def test_delete_user_not_found(self, admin_user, mock_user_service, request_factory):
        """Test deleting user that doesn't exist."""
        # Arrange
        from dotmac.platform.user_management.router import delete_user

        user_id = str(uuid.uuid4())
        mock_user_service.delete_user.return_value = False

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await delete_user(user_id, request_factory(), admin_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert f"User {user_id} not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_disable_user_success(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test disabling user successfully."""
        # Arrange
        from dotmac.platform.user_management.router import disable_user

        sample_user.is_active = False
        mock_user_service.update_user.return_value = sample_user

        # Act
        response = await disable_user(
            str(sample_user.id), request_factory(), admin_user, mock_user_service
        )

        # Assert
        assert "disabled successfully" in response["message"]
        mock_user_service.update_user.assert_called_once_with(
            user_id=str(sample_user.id), tenant_id=admin_user.tenant_id, is_active=False
        )

    @pytest.mark.asyncio
    async def test_disable_user_not_found(self, admin_user, mock_user_service, request_factory):
        """Test disabling user that doesn't exist."""
        # Arrange
        from dotmac.platform.user_management.router import disable_user

        user_id = str(uuid.uuid4())
        mock_user_service.update_user.return_value = None

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await disable_user(user_id, request_factory(), admin_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert f"User {user_id} not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_enable_user_success(
        self, admin_user, mock_user_service, sample_user, request_factory
    ):
        """Test enabling user successfully."""
        # Arrange
        from dotmac.platform.user_management.router import enable_user

        sample_user.is_active = True
        mock_user_service.update_user.return_value = sample_user

        # Act
        response = await enable_user(
            str(sample_user.id), request_factory(), admin_user, mock_user_service
        )

        # Assert
        assert "enabled successfully" in response["message"]
        mock_user_service.update_user.assert_called_once_with(
            user_id=str(sample_user.id), tenant_id=admin_user.tenant_id, is_active=True
        )

    @pytest.mark.asyncio
    async def test_enable_user_not_found(self, admin_user, mock_user_service, request_factory):
        """Test enabling user that doesn't exist."""
        # Arrange
        from dotmac.platform.user_management.router import enable_user

        user_id = str(uuid.uuid4())
        mock_user_service.update_user.return_value = None

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await enable_user(user_id, request_factory(), admin_user, mock_user_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert f"User {user_id} not found" in str(exc_info.value.detail)


class TestUserRequestModels:
    """Test request/response models."""

    def test_user_create_request_valid(self):
        """Test UserCreateRequest with valid data."""
        request = UserCreateRequest(
            username="testuser",
            email="test@example.com",
            password="password123",
            full_name="Test User",
            roles=["user"],
            is_active=True,
        )

        assert request.username == "testuser"
        assert request.email == "test@example.com"
        assert request.password == "password123"
        assert request.full_name == "Test User"
        assert request.roles == ["user"]
        assert request.is_active is True

    def test_user_create_request_defaults(self):
        """Test UserCreateRequest with default values."""
        request = UserCreateRequest(
            username="testuser",
            email="test@example.com",
            password="password123",
        )

        assert request.roles == []
        assert request.is_active is True
        assert request.full_name is None

    def test_user_create_request_validation_username_too_short(self):
        """Test UserCreateRequest validation fails for short username."""
        with pytest.raises(ValueError):
            UserCreateRequest(
                username="ab",  # Too short (min 3)
                email="test@example.com",
                password="password123",
            )

    def test_user_create_request_validation_password_too_short(self):
        """Test UserCreateRequest validation fails for short password."""
        with pytest.raises(ValueError):
            UserCreateRequest(
                username="testuser",
                email="test@example.com",
                password="short",  # Too short (min 8)
            )

    def test_user_update_request_partial(self):
        """Test UserUpdateRequest with partial data."""
        request = UserUpdateRequest(
            full_name="Updated Name",
            is_active=False,
        )

        assert request.full_name == "Updated Name"
        assert request.is_active is False
        assert request.email is None
        assert request.roles is None

    def test_password_change_request_valid(self):
        """Test PasswordChangeRequest with valid data."""
        request = PasswordChangeRequest(
            current_password="oldpassword",
            new_password="newpassword123",
            confirm_password="newpassword123",
        )

        assert request.current_password == "oldpassword"
        assert request.new_password == "newpassword123"
        assert request.confirm_password == "newpassword123"

    def test_password_change_request_validation_new_password_too_short(self):
        """Test PasswordChangeRequest validation fails for short new password."""
        with pytest.raises(ValueError):
            PasswordChangeRequest(
                current_password="oldpassword",
                new_password="short",  # Too short (min 8)
                confirm_password="short",
            )
