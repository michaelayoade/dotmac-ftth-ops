"""
Unit tests for feature flags router helper functions.

Tests the internal helper functions used by the feature flags router,
including authentication validation.
"""

import pytest
from fastapi import HTTPException, status

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.feature_flags.router import _require_authenticated_user


class TestRequireAuthenticatedUser:
    """Test _require_authenticated_user helper function."""

    def test_returns_user_when_authenticated(self):
        """Test that authenticated user is returned unchanged."""
        user = UserInfo(
            user_id="test-user-123",
            email="test@example.com",
            username="testuser",
            tenant_id="test-tenant",
            roles=["admin"],
            permissions=["read", "write"],
        )

        result = _require_authenticated_user(user)

        assert result == user
        assert result.user_id == "test-user-123"

    def test_raises_401_when_user_is_none(self):
        """Test that 401 Unauthorized is raised when user is None."""
        with pytest.raises(HTTPException) as exc_info:
            _require_authenticated_user(None)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc_info.value.detail == "Not authenticated"

    def test_includes_www_authenticate_header(self):
        """Test that WWW-Authenticate header is included in 401 response."""
        with pytest.raises(HTTPException) as exc_info:
            _require_authenticated_user(None)

        assert exc_info.value.headers is not None
        assert "WWW-Authenticate" in exc_info.value.headers
        assert exc_info.value.headers["WWW-Authenticate"] == "Bearer"

    def test_preserves_user_attributes(self):
        """Test that all user attributes are preserved through the helper."""
        user = UserInfo(
            user_id="user-456",
            email="admin@example.com",
            username="adminuser",
            tenant_id="tenant-123",
            roles=["admin", "feature_flag_admin"],
            permissions=["*"],
            is_platform_admin=True,
        )

        result = _require_authenticated_user(user)

        assert result.user_id == "user-456"
        assert result.email == "admin@example.com"
        assert result.username == "adminuser"
        assert result.tenant_id == "tenant-123"
        assert result.roles == ["admin", "feature_flag_admin"]
        assert result.permissions == ["*"]
        assert result.is_platform_admin is True

    def test_handles_minimal_user_info(self):
        """Test that minimal UserInfo works correctly."""
        user = UserInfo(
            user_id="minimal-user",
            email="minimal@example.com",
            tenant_id="tenant-999",
        )

        result = _require_authenticated_user(user)

        assert result.user_id == "minimal-user"
        assert result.email == "minimal@example.com"
        assert result.tenant_id == "tenant-999"
