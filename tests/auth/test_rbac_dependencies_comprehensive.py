"""Comprehensive tests for RBAC dependencies."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.exceptions import AuthorizationError
from dotmac.platform.auth.rbac_dependencies import (
    PermissionChecker,
    PermissionMode,
    ResourcePermissionChecker,
    RoleChecker,
    check_any_permission,
    check_permission,
    require_admin,
    require_any_permission,
    require_any_role,
    require_permission,
    require_permissions,
    require_role,
)


@pytest.mark.asyncio
class TestPermissionChecker:
    """Test PermissionChecker class."""

    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return UserInfo(
            user_id=str(uuid4()),
            username="testuser",
            email="test@example.com",
            roles=["user"],
            permissions=["read:users"],
        )

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_permission_checker_all_mode_success(self, mock_user, mock_db):
        """Test permission checker with ALL mode succeeds."""
        checker = PermissionChecker(permissions=["read:users"], mode=PermissionMode.ALL)

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_all_permissions = AsyncMock(return_value=True)
            MockRBACService.return_value = mock_service

            result = await checker(current_user=mock_user, db=mock_db)

            assert result == mock_user
            mock_service.user_has_all_permissions.assert_called_once()

    @pytest.mark.asyncio
    async def test_permission_checker_all_mode_failure(self, mock_user, mock_db):
        """Test permission checker with ALL mode fails."""
        checker = PermissionChecker(permissions=["write:users"], mode=PermissionMode.ALL)

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_all_permissions = AsyncMock(return_value=False)
            MockRBACService.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await checker(current_user=mock_user, db=mock_db)

            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_permission_checker_any_mode_success(self, mock_user, mock_db):
        """Test permission checker with ANY mode succeeds."""
        checker = PermissionChecker(
            permissions=["read:users", "write:users"], mode=PermissionMode.ANY
        )

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_any_permission = AsyncMock(return_value=True)
            MockRBACService.return_value = mock_service

            result = await checker(current_user=mock_user, db=mock_db)

            assert result == mock_user

    @pytest.mark.asyncio
    async def test_permission_checker_no_user(self, mock_db):
        """Test permission checker with no user."""
        checker = PermissionChecker(permissions=["read:users"])

        with pytest.raises(HTTPException) as exc_info:
            await checker(current_user=None, db=mock_db)

        assert exc_info.value.status_code == 401
        assert "Not authenticated" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_permission_checker_custom_error_message(self, mock_user, mock_db):
        """Test permission checker with custom error message."""
        custom_msg = "You need special permissions"
        checker = PermissionChecker(permissions=["admin:users"], error_message=custom_msg)

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_all_permissions = AsyncMock(return_value=False)
            MockRBACService.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await checker(current_user=mock_user, db=mock_db)

            assert custom_msg in exc_info.value.detail


@pytest.mark.asyncio
class TestRoleChecker:
    """Test RoleChecker class."""

    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return UserInfo(
            user_id=str(uuid4()),
            username="testuser",
            email="test@example.com",
            roles=["user", "editor"],
            permissions=[],
        )

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return AsyncMock()

    @pytest.fixture
    def mock_role(self):
        """Create mock role."""
        role = MagicMock()
        role.name = "user"
        return role

    @pytest.mark.asyncio
    async def test_role_checker_any_mode_success(self, mock_user, mock_db, mock_role):
        """Test role checker with ANY mode succeeds."""
        checker = RoleChecker(roles=["user", "admin"], mode=PermissionMode.ANY)

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.get_user_roles = AsyncMock(return_value=[mock_role])
            MockRBACService.return_value = mock_service

            result = await checker(current_user=mock_user, db=mock_db)

            assert result == mock_user

    @pytest.mark.asyncio
    async def test_role_checker_all_mode_success(self, mock_user, mock_db):
        """Test role checker with ALL mode succeeds."""
        checker = RoleChecker(roles=["user", "editor"], mode=PermissionMode.ALL)

        user_role = MagicMock()
        user_role.name = "user"
        editor_role = MagicMock()
        editor_role.name = "editor"

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.get_user_roles = AsyncMock(return_value=[user_role, editor_role])
            MockRBACService.return_value = mock_service

            result = await checker(current_user=mock_user, db=mock_db)

            assert result == mock_user

    @pytest.mark.asyncio
    async def test_role_checker_all_mode_failure(self, mock_user, mock_db, mock_role):
        """Test role checker with ALL mode fails."""
        checker = RoleChecker(roles=["user", "admin"], mode=PermissionMode.ALL)

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.get_user_roles = AsyncMock(return_value=[mock_role])
            MockRBACService.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await checker(current_user=mock_user, db=mock_db)

            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_role_checker_no_user(self, mock_db):
        """Test role checker with no user."""
        checker = RoleChecker(roles=["admin"])

        with pytest.raises(HTTPException) as exc_info:
            await checker(current_user=None, db=mock_db)

        assert exc_info.value.status_code == 401


@pytest.mark.asyncio
class TestResourcePermissionChecker:
    """Test ResourcePermissionChecker class."""

    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return UserInfo(
            user_id=str(uuid4()),
            username="testuser",
            email="test@example.com",
            roles=["user"],
            permissions=[],
        )

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return AsyncMock()

    @pytest.fixture
    def mock_resource(self):
        """Create mock resource."""
        resource = MagicMock()
        resource.id = str(uuid4())
        resource.owner_id = str(uuid4())
        return resource

    @pytest.mark.asyncio
    async def test_resource_permission_with_general_permission(
        self, mock_user, mock_db, mock_resource
    ):
        """Test resource permission with general permission."""

        async def get_resource(db, resource_id):
            return mock_resource

        checker = ResourcePermissionChecker(
            permission="ticket.read.all",
            resource_getter=get_resource,
        )

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_permission = AsyncMock(return_value=True)
            MockRBACService.return_value = mock_service

            user, resource = await checker(
                resource_id="resource-123", current_user=mock_user, db=mock_db
            )

            assert user == mock_user
            assert resource == mock_resource

    @pytest.mark.asyncio
    async def test_resource_permission_with_ownership(self, mock_user, mock_db, mock_resource):
        """Test resource permission with ownership check."""
        mock_resource.owner_id = mock_user.user_id

        async def get_resource(db, resource_id):
            return mock_resource

        async def check_ownership(user, resource):
            return resource.owner_id == user.user_id

        checker = ResourcePermissionChecker(
            permission="ticket.read.all",
            resource_getter=get_resource,
            ownership_checker=check_ownership,
        )

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            # First call returns False (no general permission)
            # Second call returns True (has "own" permission)
            mock_service.user_has_permission = AsyncMock(side_effect=[False, True])
            MockRBACService.return_value = mock_service

            user, resource = await checker(
                resource_id="resource-123", current_user=mock_user, db=mock_db
            )

            assert user == mock_user
            assert resource == mock_resource

    @pytest.mark.asyncio
    async def test_resource_permission_resource_not_found(self, mock_user, mock_db):
        """Test resource permission when resource not found."""

        async def get_resource(db, resource_id):
            return None

        checker = ResourcePermissionChecker(
            permission="ticket.read.all",
            resource_getter=get_resource,
        )

        with pytest.raises(HTTPException) as exc_info:
            await checker(resource_id="nonexistent", current_user=mock_user, db=mock_db)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_resource_permission_denied(self, mock_user, mock_db, mock_resource):
        """Test resource permission denied."""

        async def get_resource(db, resource_id):
            return mock_resource

        checker = ResourcePermissionChecker(
            permission="ticket.delete.all",
            resource_getter=get_resource,
        )

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_permission = AsyncMock(return_value=False)
            MockRBACService.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await checker(resource_id="resource-123", current_user=mock_user, db=mock_db)

            assert exc_info.value.status_code == 403


@pytest.mark.integration
class TestConvenienceFunctions:
    """Test convenience dependency functions."""

    def test_require_permission(self):
        """Test require_permission function."""
        dep = require_permission("read:users")
        assert isinstance(dep, PermissionChecker)
        assert dep.permissions == ["read:users"]
        assert dep.mode == PermissionMode.ALL

    def test_require_permissions(self):
        """Test require_permissions function."""
        dep = require_permissions("read:users", "write:users")
        assert isinstance(dep, PermissionChecker)
        assert set(dep.permissions) == {"read:users", "write:users"}
        assert dep.mode == PermissionMode.ALL

    def test_require_any_permission(self):
        """Test require_any_permission function."""
        dep = require_any_permission("read:users", "write:users")
        assert isinstance(dep, PermissionChecker)
        assert dep.mode == PermissionMode.ANY

    def test_require_role(self):
        """Test require_role function."""
        dep = require_role("admin")
        assert isinstance(dep, RoleChecker)
        assert dep.roles == ["admin"]

    def test_require_any_role(self):
        """Test require_any_role function."""
        dep = require_any_role("admin", "moderator")
        assert isinstance(dep, RoleChecker)
        assert dep.mode == PermissionMode.ANY

    def test_require_admin(self):
        """Test require_admin dependency."""
        assert isinstance(require_admin, RoleChecker)

    def test_caching_same_permissions(self):
        """Test that same permissions return cached instance."""
        dep1 = require_permission("read:users")
        dep2 = require_permission("read:users")
        assert dep1 is dep2  # Should be same cached instance


@pytest.mark.asyncio
@pytest.mark.integration
class TestDecoratorFunctions:
    """Test decorator functions for non-FastAPI use."""

    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return UserInfo(
            user_id=str(uuid4()),
            username="testuser",
            email="test@example.com",
            roles=["user"],
            permissions=[],
        )

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_check_permission_decorator_success(self, mock_user, mock_db):
        """Test check_permission decorator succeeds."""

        @check_permission("read:users")
        async def protected_function(current_user, db):
            return "success"

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_permission = AsyncMock(return_value=True)
            MockRBACService.return_value = mock_service

            result = await protected_function(current_user=mock_user, db=mock_db)

            assert result == "success"

    @pytest.mark.asyncio
    async def test_check_permission_decorator_failure(self, mock_user, mock_db):
        """Test check_permission decorator fails."""

        @check_permission("admin:users")
        async def protected_function(current_user, db):
            return "success"

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_permission = AsyncMock(return_value=False)
            MockRBACService.return_value = mock_service

            with pytest.raises(AuthorizationError, match="Permission required"):
                await protected_function(current_user=mock_user, db=mock_db)

    @pytest.mark.asyncio
    async def test_check_permission_decorator_no_user(self, mock_db):
        """Test check_permission decorator with no user."""

        @check_permission("read:users")
        async def protected_function(current_user, db):
            return "success"

        with pytest.raises(AuthorizationError, match="Unable to verify permissions"):
            await protected_function(current_user=None, db=mock_db)

    @pytest.mark.asyncio
    async def test_check_any_permission_decorator_success(self, mock_user, mock_db):
        """Test check_any_permission decorator succeeds."""

        @check_any_permission("read:users", "write:users")
        async def protected_function(current_user, db):
            return "success"

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_any_permission = AsyncMock(return_value=True)
            MockRBACService.return_value = mock_service

            result = await protected_function(current_user=mock_user, db=mock_db)

            assert result == "success"

    @pytest.mark.asyncio
    async def test_check_any_permission_decorator_failure(self, mock_user, mock_db):
        """Test check_any_permission decorator fails."""

        @check_any_permission("admin:users", "admin:roles")
        async def protected_function(current_user, db):
            return "success"

        with patch("dotmac.platform.auth.rbac_dependencies.RBACService") as MockRBACService:
            mock_service = MagicMock()
            mock_service.user_has_any_permission = AsyncMock(return_value=False)
            MockRBACService.return_value = mock_service

            with pytest.raises(AuthorizationError, match="Permission required: any of"):
                await protected_function(current_user=mock_user, db=mock_db)
