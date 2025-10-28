"""
Comprehensive unit tests for Platform Admin functionality.

Tests platform admin permissions, cross-tenant access, and audit logging.
"""

from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.platform_admin import (
    TARGET_TENANT_HEADER,
    get_effective_tenant_id,
    get_target_tenant_id,
    has_platform_permission,
    is_platform_admin,
    platform_audit,
    require_platform_admin,
    require_platform_permission,
)


@pytest.mark.integration
class TestPlatformAdminChecks:
    """Test platform admin permission checks."""

    def test_is_platform_admin_with_flag(self):
        """Test platform admin check with is_platform_admin flag."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        assert is_platform_admin(user) is True

    def test_is_platform_admin_with_permission(self):
        """Test platform admin check with platform:admin permission."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=["platform:admin"],
            is_platform_admin=False,
        )

        assert is_platform_admin(user) is True

    def test_is_platform_admin_with_wildcard(self):
        """Test platform admin check with wildcard permission."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=["*"],
            is_platform_admin=False,
        )

        assert is_platform_admin(user) is True

    def test_is_not_platform_admin(self):
        """Test regular user is not platform admin."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=["read", "write"],
            is_platform_admin=False,
        )

        assert is_platform_admin(user) is False

    def test_has_platform_permission_admin_has_all(self):
        """Test platform admin has all platform permissions."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        assert has_platform_permission(user, "platform:tenants:read") is True
        assert has_platform_permission(user, "platform:billing:write") is True
        assert has_platform_permission(user, "platform:analytics") is True

    def test_has_platform_permission_specific(self):
        """Test user with specific platform permission."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=["platform:tenants:read"],
            is_platform_admin=False,
        )

        assert has_platform_permission(user, "platform:tenants:read") is True
        assert has_platform_permission(user, "platform:tenants:write") is False

    def test_has_platform_permission_wildcard_pattern(self):
        """Test wildcard platform permissions."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=["platform:tenants:*"],
            is_platform_admin=False,
        )

        assert has_platform_permission(user, "platform:tenants:read") is True
        assert has_platform_permission(user, "platform:tenants:write") is True
        assert has_platform_permission(user, "platform:billing:read") is False

    def test_has_platform_permission_no_permission(self):
        """Test user without platform permission."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=["read", "write"],
            is_platform_admin=False,
        )

        assert has_platform_permission(user, "platform:tenants:read") is False


@pytest.mark.integration
class TestTargetTenantResolution:
    """Test target tenant ID resolution for cross-tenant operations."""

    def test_regular_user_uses_assigned_tenant(self):
        """Test regular user always uses their assigned tenant."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=[],
            is_platform_admin=False,
        )

        request = Mock()
        request.headers.get.return_value = "tenant-2"  # Trying to impersonate

        # Regular user should get their own tenant, not the header value
        result = get_target_tenant_id(request, user)
        assert result == "tenant-1"

    def test_platform_admin_with_target_header(self):
        """Test platform admin can specify target tenant via header."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        request = Mock()
        request.headers.get.return_value = "tenant-target"

        result = get_target_tenant_id(request, user)
        assert result == "tenant-target"
        request.headers.get.assert_called_once_with(TARGET_TENANT_HEADER)

    def test_platform_admin_without_target_header(self):
        """Test platform admin without target header gets None (cross-tenant mode)."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        request = Mock()
        request.headers.get.return_value = None

        result = get_target_tenant_id(request, user)
        assert result is None  # Cross-tenant mode


@pytest.mark.integration
class TestFastAPIDependencies:
    """Test FastAPI dependency functions."""

    @pytest.mark.asyncio
    async def test_require_platform_admin_success(self):
        """Test platform admin dependency allows platform admin."""
        admin_user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        result = await require_platform_admin(current_user=admin_user)
        assert result == admin_user

    @pytest.mark.asyncio
    async def test_require_platform_admin_rejects_regular_user(self):
        """Test platform admin dependency rejects regular user."""
        regular_user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=[],
            is_platform_admin=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            await require_platform_admin(current_user=regular_user)

        assert exc_info.value.status_code == 403
        assert "Platform administrator access required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_platform_permission_success(self):
        """Test platform permission dependency with authorized user."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=["platform:tenants:read"],
            is_platform_admin=False,
        )

        dependency = require_platform_permission("platform:tenants:read")
        result = await dependency(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_platform_permission_rejects_unauthorized(self):
        """Test platform permission dependency rejects unauthorized user."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=["read"],
            is_platform_admin=False,
        )

        dependency = require_platform_permission("platform:tenants:read")

        with pytest.raises(HTTPException) as exc_info:
            await dependency(current_user=user)

        assert exc_info.value.status_code == 403
        assert "platform:tenants:read" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_effective_tenant_id_regular_user(self):
        """Test effective tenant ID for regular user."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=[],
            is_platform_admin=False,
        )

        request = Mock()
        request.headers.get.return_value = None

        result = await get_effective_tenant_id(request, current_user=user)
        assert result == "tenant-1"

    @pytest.mark.asyncio
    async def test_get_effective_tenant_id_platform_admin(self):
        """Test effective tenant ID for platform admin with target."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        request = Mock()
        request.headers.get.return_value = "tenant-target"

        result = await get_effective_tenant_id(request, current_user=user)
        assert result == "tenant-target"


@pytest.mark.integration
class TestPlatformAdminAudit:
    """Test platform admin audit logging."""

    @pytest.mark.asyncio
    async def test_audit_log_action(self):
        """Test platform admin action is logged."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        with patch("dotmac.platform.auth.platform_admin.logger") as mock_logger:
            await platform_audit.log_action(
                user=user,
                action="view_all_tenants",
                target_tenant="tenant-123",
                resource_type="tenant",
                resource_id="tenant-123",
                details={"page": 1, "limit": 20},
            )

            # Verify logging was called
            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args

            # Check log message and structured data
            assert call_args[0][0] == "Platform admin action"
            assert call_args[1]["user_id"] == "admin-1"
            assert call_args[1]["user_email"] == "admin@test.com"
            assert call_args[1]["action"] == "view_all_tenants"
            assert call_args[1]["target_tenant"] == "tenant-123"
            assert call_args[1]["is_cross_tenant"] is True
            assert call_args[1]["details"]["page"] == 1

    @pytest.mark.asyncio
    async def test_audit_log_without_target_tenant(self):
        """Test audit log for non-impersonation action."""
        user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        with patch("dotmac.platform.auth.platform_admin.logger") as mock_logger:
            await platform_audit.log_action(
                user=user,
                action="view_platform_stats",
            )

            call_args = mock_logger.warning.call_args
            assert call_args[1]["is_cross_tenant"] is False
            assert call_args[1]["target_tenant"] is None


@pytest.mark.integration
class TestPermissionPatterns:
    """Test complex permission patterns."""

    @pytest.mark.parametrize(
        "user_permissions,check_permission,expected",
        [
            # Exact match
            (["platform:tenants:read"], "platform:tenants:read", True),
            # No match
            (["platform:tenants:read"], "platform:tenants:write", False),
            # Wildcard at level 2
            (["platform:tenants:*"], "platform:tenants:read", True),
            (["platform:tenants:*"], "platform:tenants:write", True),
            (["platform:tenants:*"], "platform:billing:read", False),
            # Wildcard at level 1
            (["platform:*"], "platform:tenants:read", True),
            (["platform:*"], "platform:billing:write", True),
            # Full wildcard
            (["*"], "platform:anything", True),
            (["*"], "custom:permission", True),
            # Multiple permissions
            (["platform:tenants:read", "platform:users:write"], "platform:tenants:read", True),
            (["platform:tenants:read", "platform:users:write"], "platform:users:write", True),
            (["platform:tenants:read", "platform:users:write"], "platform:billing:read", False),
        ],
    )
    def test_permission_patterns(self, user_permissions, check_permission, expected):
        """Test various permission matching patterns."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=user_permissions,
            is_platform_admin=False,
        )

        result = has_platform_permission(user, check_permission)
        assert result == expected


@pytest.mark.integration
class TestPlatformAdminToken:
    """Test platform admin token creation."""

    def test_create_platform_admin_token(self):
        """Test creating platform admin JWT token."""
        from dotmac.platform.auth.platform_admin import create_platform_admin_token

        # jwt_service is imported inside the function, so patch it there
        with patch("dotmac.platform.auth.core.jwt_service") as mock_jwt:
            mock_jwt.create_access_token.return_value = "mock-token"

            token = create_platform_admin_token(
                user_id="admin-1",
                email="admin@platform.com",
                permissions=["platform:tenants:read"],
            )

            assert token == "mock-token"

            # Verify JWT service was called with correct claims
            mock_jwt.create_access_token.assert_called_once()
            call_args = mock_jwt.create_access_token.call_args

            # First positional arg is user_id
            assert call_args[0][0] == "admin-1"
            # additional_claims is keyword arg
            additional_claims = call_args[1]["additional_claims"]
            assert additional_claims["email"] == "admin@platform.com"
            assert additional_claims["is_platform_admin"] is True
            assert "platform:admin" in additional_claims["permissions"]
            assert "platform:tenants:read" in additional_claims["permissions"]

    def test_create_platform_admin_token_adds_admin_permission(self):
        """Test platform admin permission is always added to token."""
        from dotmac.platform.auth.platform_admin import create_platform_admin_token

        # jwt_service is imported inside the function, so patch it there
        with patch("dotmac.platform.auth.core.jwt_service") as mock_jwt:
            mock_jwt.create_access_token.return_value = "mock-token"

            # Don't include platform:admin in permissions
            create_platform_admin_token(
                user_id="admin-1",
                email="admin@platform.com",
                permissions=["read", "write"],  # No platform:admin here
            )

            call_args = mock_jwt.create_access_token.call_args
            permissions = call_args[1]["additional_claims"]["permissions"]

            # Should be added automatically
            assert "platform:admin" in permissions
            assert "read" in permissions
            assert "write" in permissions


@pytest.mark.integration
class TestCrossTenantOperations:
    """Test cross-tenant operation patterns."""

    def test_cross_tenant_mode_for_platform_admin(self):
        """Test platform admin can operate in cross-tenant mode."""
        admin_user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        request = Mock()
        request.headers.get.return_value = None  # No target tenant header

        # Platform admin without target header = cross-tenant mode (None)
        tenant_id = get_target_tenant_id(request, admin_user)
        assert tenant_id is None

    def test_tenant_isolation_for_regular_users(self):
        """Test regular users cannot escape tenant isolation."""
        regular_user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@test.com",
            permissions=[],
            is_platform_admin=False,
        )

        request = Mock()
        # Even if they send the header, it should be ignored
        request.headers.get.return_value = "tenant-2"

        tenant_id = get_target_tenant_id(request, regular_user)
        assert tenant_id == "tenant-1"  # Their own tenant, not tenant-2

    def test_tenant_impersonation_logged(self):
        """Test tenant impersonation is logged for audit."""
        admin_user = UserInfo(
            user_id="admin-1",
            tenant_id="admin-tenant",
            email="admin@test.com",
            permissions=[],
            is_platform_admin=True,
        )

        request = Mock()
        request.headers.get.return_value = "tenant-target"

        with patch("dotmac.platform.auth.platform_admin.logger") as mock_logger:
            tenant_id = get_target_tenant_id(request, admin_user)

            # Should log the impersonation
            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args

            assert "Platform admin tenant impersonation" in call_args[0]
            assert call_args[1]["user_id"] == "admin-1"
            assert call_args[1]["target_tenant"] == "tenant-target"
            assert call_args[1]["user_tenant"] == "admin-tenant"

            assert tenant_id == "tenant-target"
