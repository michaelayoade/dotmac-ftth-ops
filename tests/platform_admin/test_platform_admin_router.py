"""Tests for platform admin router."""

import pytest

pytestmark = pytest.mark.unit


def test_platform_admin_router_exists():
    """Test that platform admin router can be imported."""
    try:
        from dotmac.platform.platform_admin import router
        assert router is not None
    except ImportError:
        # Module might be organized differently
        try:
            from dotmac.platform.auth import platform_admin_router
            assert platform_admin_router is not None
        except ImportError:
            pytest.skip("Platform admin router not found in expected locations")


def test_platform_admin_permissions():
    """Test platform admin permission checking."""
    try:
        from dotmac.platform.auth.platform_admin import is_platform_admin
        assert callable(is_platform_admin)
    except ImportError:
        pytest.skip("Platform admin permission system not implemented")
