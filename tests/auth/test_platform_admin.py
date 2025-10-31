"""
Tests for Platform Admin functionality.

Tests cross-tenant access, tenant impersonation, and platform-level operations.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, Request

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.platform_admin import (
    PLATFORM_ADMIN_PERMISSION,
    create_platform_admin_token,
    get_target_tenant_id,
    has_platform_permission,
    is_platform_admin,
    require_platform_admin,
)


@pytest.mark.integration
class TestPlatformAdminChecks:
    """Test platform admin permission checks."""

    def test_is_platform_admin_with_flag(self):
        """Test platform admin check with explicit flag."""
        user = UserInfo(
            user_id="admin-1",
            is_platform_admin=True,
            permissions=[],
        )

        assert is_platform_admin(user) is True

    def test_is_platform_admin_with_permission(self):
        """Test platform admin check with permission."""
        user = UserInfo(
            user_id="admin-2",
            is_platform_admin=False,
            permissions=[PLATFORM_ADMIN_PERMISSION],
        )

        assert is_platform_admin(user) is True

    def test_is_platform_admin_with_wildcard(self):
        """Test platform admin check with wildcard permission."""
        user = UserInfo(
            user_id="admin-3",
            is_platform_admin=False,
            permissions=["*"],
        )

        assert is_platform_admin(user) is True

    def test_is_not_platform_admin(self):
        """Test regular user is not platform admin."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            is_platform_admin=False,
            permissions=["user:read", "user:write"],
        )

        assert is_platform_admin(user) is False

    def test_has_platform_permission_as_admin(self):
        """Test platform admins have all permissions."""
        user = UserInfo(
            user_id="admin-1",
            is_platform_admin=True,
            permissions=[],
        )

        assert has_platform_permission(user, "platform:tenants:read") is True
        assert has_platform_permission(user, "platform:billing:write") is True
        assert has_platform_permission(user, "anything:*") is True

    def test_has_platform_permission_specific(self):
        """Test checking specific platform permission."""
        user = UserInfo(
            user_id="user-1",
            is_platform_admin=False,
            permissions=["platform:tenants:read"],
        )

        assert has_platform_permission(user, "platform:tenants:read") is True
        assert has_platform_permission(user, "platform:tenants:write") is False

    def test_has_platform_permission_wildcard(self):
        """Test wildcard platform permissions."""
        user = UserInfo(
            user_id="user-1",
            is_platform_admin=False,
            permissions=["platform:tenants:*"],
        )

        assert has_platform_permission(user, "platform:tenants:read") is True
        assert has_platform_permission(user, "platform:tenants:write") is True
        assert has_platform_permission(user, "platform:billing:read") is False


@pytest.mark.integration
class TestTenantImpersonation:
    """Test tenant impersonation for platform admins."""

    def test_get_target_tenant_regular_user(self):
        """Test regular users always use their assigned tenant."""
        request = MagicMock(spec=Request)
        request.headers.get.return_value = None

        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            is_platform_admin=False,
        )

        tenant_id = get_target_tenant_id(request, user)
        assert tenant_id == "tenant-1"

    def test_get_target_tenant_admin_no_header(self):
        """Test platform admin without target tenant header gets None (cross-tenant mode)."""
        request = MagicMock(spec=Request)
        request.headers.get.return_value = None

        user = UserInfo(
            user_id="admin-1",
            tenant_id=None,
            is_platform_admin=True,
        )

        tenant_id = get_target_tenant_id(request, user)
        assert tenant_id is None

    def test_get_target_tenant_admin_with_header(self):
        """Test platform admin can target specific tenant via header."""
        request = MagicMock(spec=Request)
        request.headers.get.return_value = "tenant-123"

        user = UserInfo(
            user_id="admin-1",
            tenant_id=None,
            is_platform_admin=True,
        )

        tenant_id = get_target_tenant_id(request, user)
        assert tenant_id == "tenant-123"

    def test_regular_user_cannot_impersonate(self):
        """Test regular users cannot override tenant even with header."""
        request = MagicMock(spec=Request)
        request.headers.get.return_value = "tenant-123"  # Trying to impersonate

        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            is_platform_admin=False,
        )

        tenant_id = get_target_tenant_id(request, user)
        # Should ignore header and use assigned tenant
        assert tenant_id == "tenant-1"


@pytest.mark.integration
class TestPlatformAdminDependency:
    """Test FastAPI dependency for platform admin."""

    @pytest.mark.asyncio
    async def test_require_platform_admin_success(self):
        """Test platform admin dependency allows platform admins."""
        user = UserInfo(
            user_id="admin-1",
            is_platform_admin=True,
        )

        result = await require_platform_admin(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_platform_admin_failure(self):
        """Test platform admin dependency rejects regular users."""
        user = UserInfo(
            user_id="user-1",
            tenant_id="tenant-1",
            is_platform_admin=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            await require_platform_admin(current_user=user)

        assert exc_info.value.status_code == 403
        assert "administrator access required" in exc_info.value.detail.lower()


@pytest.mark.integration
class TestPlatformAdminToken:
    """Test platform admin token creation."""

    def test_create_platform_admin_token(self):
        """Test creating JWT token for platform admin."""
        token = create_platform_admin_token(
            user_id="admin-1",
            email="admin@platform.com",
        )

        assert token is not None
        assert isinstance(token, str)

        # Verify token contains platform admin claim
        from dotmac.platform.auth.core import jwt_service

        claims = jwt_service.verify_token(token)
        assert claims["is_platform_admin"] is True
        assert claims["tenant_id"] is None
        assert PLATFORM_ADMIN_PERMISSION in claims["permissions"]
        assert "platform_admin" in claims["roles"]

    def test_create_platform_admin_token_with_extra_permissions(self):
        """Test creating platform admin token with additional permissions."""
        token = create_platform_admin_token(
            user_id="admin-2",
            email="admin@platform.com",
            permissions=["custom:permission"],
        )

        from dotmac.platform.auth.core import jwt_service

        claims = jwt_service.verify_token(token)
        assert PLATFORM_ADMIN_PERMISSION in claims["permissions"]
        assert "custom:permission" in claims["permissions"]


@pytest.mark.integration
class TestUserInfoModel:
    """Test UserInfo model with platform admin fields."""

    def test_userinfo_default_is_platform_admin(self):
        """Test UserInfo defaults is_platform_admin to False."""
        user = UserInfo(user_id="user-1")

        assert user.is_platform_admin is False

    def test_userinfo_platform_admin_explicit(self):
        """Test creating UserInfo with platform admin flag."""
        user = UserInfo(
            user_id="admin-1",
            is_platform_admin=True,
            tenant_id=None,
        )

        assert user.is_platform_admin is True
        assert user.tenant_id is None

    def test_userinfo_platform_admin_from_dict(self):
        """Test UserInfo can be created from dict with platform admin fields."""
        data = {
            "user_id": "admin-1",
            "email": "admin@platform.com",
            "is_platform_admin": True,
            "permissions": [PLATFORM_ADMIN_PERMISSION],
        }

        user = UserInfo(**data)

        assert user.is_platform_admin is True
        assert user.user_id == "admin-1"


@pytest.mark.integration
class TestCrossTenantScenarios:
    """Test cross-tenant operation scenarios."""

    def test_platform_admin_access_multiple_tenants(self):
        """Test platform admin can conceptually access multiple tenants."""
        admin = UserInfo(
            user_id="admin-1",
            is_platform_admin=True,
            tenant_id=None,
        )

        # Simulate accessing different tenants
        tenant_1_request = MagicMock(spec=Request)
        tenant_1_request.headers.get.return_value = "tenant-1"

        tenant_2_request = MagicMock(spec=Request)
        tenant_2_request.headers.get.return_value = "tenant-2"

        tenant1 = get_target_tenant_id(tenant_1_request, admin)
        tenant2 = get_target_tenant_id(tenant_2_request, admin)

        assert tenant1 == "tenant-1"
        assert tenant2 == "tenant-2"

    def test_cross_tenant_query_mode(self):
        """Test platform admin cross-tenant query mode (no target tenant)."""
        admin = UserInfo(
            user_id="admin-1",
            is_platform_admin=True,
            tenant_id=None,
        )

        request = MagicMock(spec=Request)
        request.headers.get.return_value = None  # No target tenant

        tenant_id = get_target_tenant_id(request, admin)

        # None indicates cross-tenant query
        assert tenant_id is None
