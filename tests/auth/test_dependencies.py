"""Tests for auth dependencies module."""

import pytest
from fastapi import HTTPException, status

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import (
    require_admin,
    require_auth,
    require_roles,
    require_scopes,
    security,
)


@pytest.fixture
def regular_user():
    """Create a regular user for testing."""
    return UserInfo(
        user_id="user-123",
        email="user@example.com",
        username="regularuser",
        roles=["user"],
        permissions=["read"],
        tenant_id="tenant-123",
    )


@pytest.fixture
def admin_user():
    """Create an admin user for testing."""
    return UserInfo(
        user_id="admin-123",
        email="admin@example.com",
        username="adminuser",
        roles=["admin", "user"],
        permissions=["read", "write", "delete"],
        tenant_id="tenant-123",
    )


@pytest.fixture
def multi_role_user():
    """Create a user with multiple roles for testing."""
    return UserInfo(
        user_id="multi-123",
        email="multi@example.com",
        username="multiuser",
        roles=["user", "moderator", "editor"],
        permissions=["read", "write", "moderate", "edit"],
        tenant_id="tenant-123",
    )


@pytest.fixture
def no_scope_user():
    """Create a user with no permissions for testing."""
    return UserInfo(
        user_id="noscope-123",
        email="noscope@example.com",
        username="noscopeuser",
        roles=["user"],
        permissions=[],
        tenant_id="tenant-123",
    )


@pytest.mark.integration
class TestRequireAuth:
    """Test require_auth dependency."""

    @pytest.mark.asyncio
    async def test_require_auth_success(self, regular_user):
        """Test require_auth with valid user."""
        result = await require_auth(regular_user)
        assert result == regular_user
        assert result.user_id == "user-123"

    @pytest.mark.asyncio
    async def test_require_auth_admin_user(self, admin_user):
        """Test require_auth with admin user."""
        result = await require_auth(admin_user)
        assert result == admin_user
        assert result.user_id == "admin-123"

    def test_require_auth_dependency_type(self):
        """Test that require_auth is a dependency function."""
        # This test ensures require_auth can be used as a FastAPI dependency
        assert callable(require_auth)


@pytest.mark.integration
class TestRequireAdmin:
    """Test require_admin dependency."""

    def test_require_admin_success(self, admin_user):
        """Test require_admin with admin user."""
        result = require_admin(admin_user)
        assert result == admin_user
        assert "admin" in result.roles

    def test_require_admin_failure_regular_user(self, regular_user):
        """Test require_admin with regular user (should fail)."""
        with pytest.raises(HTTPException) as exc_info:
            require_admin(regular_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin access required" in str(exc_info.value.detail)

    def test_require_admin_failure_no_roles(self, no_scope_user):
        """Test require_admin with user having no admin role."""
        with pytest.raises(HTTPException) as exc_info:
            require_admin(no_scope_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin access required" in str(exc_info.value.detail)

    def test_require_admin_success_multi_role(self, multi_role_user):
        """Test require_admin fails with user having multiple roles but no admin."""
        with pytest.raises(HTTPException) as exc_info:
            require_admin(multi_role_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    def test_require_admin_with_admin_in_multiple_roles(self):
        """Test require_admin succeeds when admin is one of multiple roles."""
        user = UserInfo(
            user_id="admin-multi-123",
            username="adminmulti",
            roles=["user", "admin", "moderator"],
            permissions=["read", "write"],
        )

        result = require_admin(user)
        assert result == user
        assert "admin" in result.roles


@pytest.mark.integration
class TestRequireScopes:
    """Test require_scopes dependency factory."""

    def test_require_scopes_single_scope_success(self, regular_user):
        """Test require_scopes with single scope that user has."""
        check_read = require_scopes("read")
        result = check_read(regular_user)
        assert result == regular_user

    def test_require_scopes_single_scope_failure(self, regular_user):
        """Test require_scopes with single scope that user doesn't have."""
        check_write = require_scopes("write")

        with pytest.raises(HTTPException) as exc_info:
            check_write(regular_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Insufficient permissions" in str(exc_info.value.detail)

    def test_require_scopes_multiple_scopes_success(self, admin_user):
        """Test require_scopes with multiple scopes that user has."""
        check_multiple = require_scopes("read", "write")
        result = check_multiple(admin_user)
        assert result == admin_user

    def test_require_scopes_multiple_scopes_partial_success(self, regular_user):
        """Test require_scopes with multiple scopes where user has at least one."""
        # User has "read" but not "write", but function should succeed if user has ANY of the required scopes
        check_multiple = require_scopes("read", "write")
        result = check_multiple(regular_user)
        assert result == regular_user

    def test_require_scopes_multiple_scopes_failure(self, no_scope_user):
        """Test require_scopes with multiple scopes that user doesn't have any of."""
        check_multiple = require_scopes("write", "delete")

        with pytest.raises(HTTPException) as exc_info:
            check_multiple(no_scope_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Insufficient permissions" in str(exc_info.value.detail)

    def test_require_scopes_no_scopes_required(self, regular_user):
        """Test require_scopes with no scopes required."""
        check_none = require_scopes()

        with pytest.raises(HTTPException) as exc_info:
            check_none(regular_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    def test_require_scopes_empty_user_permissions(self, no_scope_user):
        """Test require_scopes with user having no permissions."""
        check_read = require_scopes("read")

        with pytest.raises(HTTPException) as exc_info:
            check_read(no_scope_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    def test_require_scopes_complex_permissions(self, multi_role_user):
        """Test require_scopes with complex permission requirements."""
        # User has: ["read", "write", "moderate", "edit"]
        check_edit = require_scopes("edit")
        result = check_edit(multi_role_user)
        assert result == multi_role_user

        check_moderate = require_scopes("moderate")
        result = check_moderate(multi_role_user)
        assert result == multi_role_user

        check_admin = require_scopes("admin")
        with pytest.raises(HTTPException):
            check_admin(multi_role_user)

    def test_require_scopes_returns_function(self):
        """Test that require_scopes returns a callable function."""
        check_func = require_scopes("read", "write")
        assert callable(check_func)


@pytest.mark.integration
class TestRequireRoles:
    """Test require_roles dependency factory."""

    def test_require_roles_single_role_success(self, regular_user):
        """Test require_roles with single role that user has."""
        check_user = require_roles("user")
        result = check_user(regular_user)
        assert result == regular_user

    def test_require_roles_single_role_failure(self, regular_user):
        """Test require_roles with single role that user doesn't have."""
        check_admin = require_roles("admin")

        with pytest.raises(HTTPException) as exc_info:
            check_admin(regular_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Insufficient role permissions" in str(exc_info.value.detail)

    def test_require_roles_multiple_roles_success(self, admin_user):
        """Test require_roles with multiple roles that user has."""
        # admin_user has both "admin" and "user" roles
        check_multiple = require_roles("admin", "user")
        result = check_multiple(admin_user)
        assert result == admin_user

    def test_require_roles_multiple_roles_partial_success(self, admin_user):
        """Test require_roles where user has at least one of the required roles."""
        # User has "admin" and "user" but not "moderator", should succeed if ANY role matches
        check_multiple = require_roles("admin", "moderator")
        result = check_multiple(admin_user)
        assert result == admin_user

    def test_require_roles_multiple_roles_failure(self, regular_user):
        """Test require_roles with multiple roles that user doesn't have any of."""
        check_multiple = require_roles("admin", "moderator")

        with pytest.raises(HTTPException) as exc_info:
            check_multiple(regular_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Insufficient role permissions" in str(exc_info.value.detail)

    def test_require_roles_no_roles_required(self, regular_user):
        """Test require_roles with no roles required."""
        check_none = require_roles()

        with pytest.raises(HTTPException) as exc_info:
            check_none(regular_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    def test_require_roles_empty_user_roles(self):
        """Test require_roles with user having no roles."""
        user_no_roles = UserInfo(
            user_id="noroles-123",
            username="norolesuser",
            roles=[],
            permissions=["read"],
        )

        check_user = require_roles("user")

        with pytest.raises(HTTPException) as exc_info:
            check_user(user_no_roles)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    def test_require_roles_complex_roles(self, multi_role_user):
        """Test require_roles with complex role requirements."""
        # multi_role_user has: ["user", "moderator", "editor"]
        check_moderator = require_roles("moderator")
        result = check_moderator(multi_role_user)
        assert result == multi_role_user

        check_editor = require_roles("editor")
        result = check_editor(multi_role_user)
        assert result == multi_role_user

        check_admin = require_roles("admin")
        with pytest.raises(HTTPException):
            check_admin(multi_role_user)

    def test_require_roles_returns_function(self):
        """Test that require_roles returns a callable function."""
        check_func = require_roles("admin", "moderator")
        assert callable(check_func)


@pytest.mark.integration
class TestSecurityScheme:
    """Test security scheme configuration."""

    def test_security_scheme_exists(self):
        """Test that security scheme is properly configured."""
        assert security is not None
        # HTTPBearer should be configured
        from fastapi.security import HTTPBearer

        assert isinstance(security, HTTPBearer)

    def test_security_scheme_auto_error(self):
        """Test security scheme auto_error setting."""
        # Should be configured with auto_error=False based on the implementation
        assert hasattr(security, "auto_error")


@pytest.mark.integration
class TestDependencyIntegration:
    """Test dependency integration scenarios."""

    def test_multiple_dependencies_admin_and_scope(self, admin_user):
        """Test combining admin requirement with scope requirement."""
        # Simulate using both require_admin and require_scopes
        admin_result = require_admin(admin_user)
        assert admin_result == admin_user

        check_write = require_scopes("write")
        scope_result = check_write(admin_user)
        assert scope_result == admin_user

    def test_multiple_dependencies_admin_and_role(self, admin_user):
        """Test combining admin requirement with role requirement."""
        admin_result = require_admin(admin_user)
        assert admin_result == admin_user

        check_admin_role = require_roles("admin")
        role_result = check_admin_role(admin_user)
        assert role_result == admin_user

    @pytest.mark.asyncio
    async def test_dependency_chain_failure(self, regular_user):
        """Test dependency chain where one fails."""
        # Regular user should pass auth but fail admin check
        auth_result = await require_auth(regular_user)
        assert auth_result == regular_user

        with pytest.raises(HTTPException):
            require_admin(regular_user)

    def test_edge_case_none_values(self):
        """Test dependencies with edge case values."""
        # UserInfo requires valid lists for roles and permissions due to Pydantic validation
        user_with_empty = UserInfo(
            user_id="edge-123",
            username="edgeuser",
            roles=[],  # Empty list instead of None
            permissions=[],  # Empty list instead of None
        )

        # Should handle empty values gracefully
        with pytest.raises(HTTPException):
            require_admin(user_with_empty)

        check_scope = require_scopes("read")
        with pytest.raises(HTTPException):
            check_scope(user_with_empty)


@pytest.mark.integration
class TestErrorMessages:
    """Test error messages are appropriate."""

    def test_admin_error_message(self, regular_user):
        """Test admin requirement error message."""
        with pytest.raises(HTTPException) as exc_info:
            require_admin(regular_user)

        assert "Admin access required" in str(exc_info.value.detail)
        assert exc_info.value.status_code == 403

    def test_scope_error_message(self, regular_user):
        """Test scope requirement error message."""
        check_write = require_scopes("write")

        with pytest.raises(HTTPException) as exc_info:
            check_write(regular_user)

        assert "Insufficient permissions" in str(exc_info.value.detail)
        assert exc_info.value.status_code == 403

    def test_role_error_message(self, regular_user):
        """Test role requirement error message."""
        check_admin = require_roles("admin")

        with pytest.raises(HTTPException) as exc_info:
            check_admin(regular_user)

        assert "Insufficient role permissions" in str(exc_info.value.detail)
        assert exc_info.value.status_code == 403


@pytest.mark.integration
class TestDependencyFactoryPattern:
    """Test the factory pattern used in require_scopes and require_roles."""

    def test_scope_factory_creates_unique_functions(self):
        """Test that require_scopes creates unique functions."""
        check_read = require_scopes("read")
        check_write = require_scopes("write")

        assert check_read != check_write
        assert callable(check_read)
        assert callable(check_write)

    def test_role_factory_creates_unique_functions(self):
        """Test that require_roles creates unique functions."""
        check_admin = require_roles("admin")
        check_user = require_roles("user")

        assert check_admin != check_user
        assert callable(check_admin)
        assert callable(check_user)

    def test_scope_factory_with_same_scopes(self):
        """Test require_scopes factory with same scopes."""
        check_read1 = require_scopes("read")
        check_read2 = require_scopes("read")

        # Should create different function instances even with same scopes
        assert check_read1 != check_read2

    def test_role_factory_with_same_roles(self):
        """Test require_roles factory with same roles."""
        check_admin1 = require_roles("admin")
        check_admin2 = require_roles("admin")

        # Should create different function instances even with same roles
        assert check_admin1 != check_admin2

    def test_factory_preserves_arguments(self, admin_user, regular_user):
        """Test that factory functions preserve their arguments correctly."""
        # Create functions with different requirements
        check_admin_or_mod = require_roles("admin", "moderator")
        check_read_or_write = require_scopes("read", "write")

        # Admin user should pass admin role check
        result = check_admin_or_mod(admin_user)
        assert result == admin_user

        # Regular user should fail admin role check
        with pytest.raises(HTTPException):
            check_admin_or_mod(regular_user)

        # Regular user should pass read scope check
        result = check_read_or_write(regular_user)
        assert result == regular_user


@pytest.mark.integration
class TestUserInfoEdgeCases:
    """Test edge cases with UserInfo objects."""

    @pytest.mark.asyncio
    async def test_user_with_empty_strings(self):
        """Test user with empty string values."""
        user = UserInfo(
            user_id="empty-strings-123",
            username="",
            # email="",  # Empty email fails Pydantic validation
            roles=["user"],
            permissions=["read"],
        )

        # Should still work with empty strings
        result = await require_auth(user)
        assert result == user

        check_user = require_roles("user")
        result = check_user(user)
        assert result == user

    def test_user_with_whitespace_roles(self):
        """Test user with whitespace in roles/permissions."""
        user = UserInfo(
            user_id="whitespace-123",
            username="whitespaceuser",
            roles=[" admin ", "user"],  # Roles with whitespace
            permissions=[" read ", " write "],  # Permissions with whitespace
        )

        # The current implementation doesn't strip whitespace, so exact matches needed
        check_admin_space = require_roles(" admin ")
        result = check_admin_space(user)
        assert result == user

        check_read_space = require_scopes(" read ")
        result = check_read_space(user)
        assert result == user

        # Without spaces should fail
        check_admin = require_roles("admin")
        with pytest.raises(HTTPException):
            check_admin(user)
