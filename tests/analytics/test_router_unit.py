"""
Unit tests for analytics router helper functions and utilities.

Tests helper functions, datetime handling, and router configuration.
"""

from datetime import timezone, datetime
from unittest.mock import MagicMock, patch

from dotmac.platform.analytics.router import (
    _ensure_utc,
    _isoformat,
    analytics_router,
    get_analytics_service,
)


class TestHelperFunctions:
    """Test analytics router helper functions."""

    def test_ensure_utc_with_none(self):
        """Test _ensure_utc with None returns current timezone.utc time."""
        result = _ensure_utc(None)
        assert result.tzinfo == timezone.utc
        # Should be recent (within last second)
        assert (datetime.now(timezone.utc) - result).total_seconds() < 1

    def test_ensure_utc_with_naive_datetime(self):
        """Test _ensure_utc with naive datetime adds timezone.utc timezone."""
        naive_dt = datetime(2024, 1, 1, 12, 0, 0)
        result = _ensure_utc(naive_dt)
        assert result.tzinfo == timezone.utc
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 1

    def test_ensure_utc_with_aware_datetime(self):
        """Test _ensure_utc with aware datetime converts to timezone.utc."""
        aware_dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = _ensure_utc(aware_dt)
        assert result.tzinfo == timezone.utc
        assert result == aware_dt

    def test_ensure_utc_with_string_z_suffix(self):
        """Test _ensure_utc with ISO string ending in Z."""
        iso_string = "2024-01-01T12:00:00Z"
        result = _ensure_utc(iso_string)
        assert result.tzinfo == timezone.utc
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 1

    def test_ensure_utc_with_string_no_z(self):
        """Test _ensure_utc with ISO string without Z."""
        iso_string = "2024-01-01T12:00:00"
        result = _ensure_utc(iso_string)
        assert result.tzinfo == timezone.utc
        assert result.year == 2024

    def test_ensure_utc_with_invalid_string(self):
        """Test _ensure_utc with invalid string returns current time."""
        invalid_string = "not a datetime"
        result = _ensure_utc(invalid_string)
        assert result.tzinfo == timezone.utc
        # Should be recent (within last second)
        assert (datetime.now(timezone.utc) - result).total_seconds() < 1

    def test_ensure_utc_with_other_type(self):
        """Test _ensure_utc with non-datetime/string type returns current time."""
        result = _ensure_utc(12345)
        assert result.tzinfo == timezone.utc
        # Should be recent (within last second)
        assert (datetime.now(timezone.utc) - result).total_seconds() < 1

    def test_isoformat_with_datetime(self):
        """Test _isoformat formats datetime correctly."""
        dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = _isoformat(dt)
        assert isinstance(result, str)
        assert "2024-01-01" in result
        assert result.endswith("Z")

    def test_isoformat_with_none(self):
        """Test _isoformat with None returns current time formatted."""
        result = _isoformat(None)
        assert isinstance(result, str)
        assert result.endswith("Z")


class TestAnalyticsServiceDependency:
    """Test analytics service dependency injection."""

    def test_get_analytics_service_creates_instance(self):
        """Test get_analytics_service creates service instance with required params."""
        # Create mock request and user
        mock_request = MagicMock()
        mock_user = MagicMock()
        mock_user.tenant_id = "test-tenant"
        mock_user.is_platform_admin = False

        # Patch the service factory function
        with patch("dotmac.platform.analytics.service.get_analytics_service") as mock_get_service:
            mock_service = MagicMock()
            mock_get_service.return_value = mock_service

            service = get_analytics_service(mock_request, mock_user)

            # Verify service factory was called with tenant_id
            mock_get_service.assert_called_once()
            call_kwargs = mock_get_service.call_args[1]
            assert call_kwargs["tenant_id"] == "test-tenant"
            assert service == mock_service

    def test_get_analytics_service_reuses_instance(self):
        """Test get_analytics_service reuses cached instance."""
        # Create mock request and user
        mock_request = MagicMock()
        mock_user = MagicMock()
        mock_user.tenant_id = "test-tenant"
        mock_user.is_platform_admin = False

        # Patch the service factory to return same instance
        with patch("dotmac.platform.analytics.service.get_analytics_service") as mock_get_service:
            mock_service = MagicMock()
            mock_get_service.return_value = mock_service

            # Call twice
            service1 = get_analytics_service(mock_request, mock_user)
            service2 = get_analytics_service(mock_request, mock_user)

            # Both should return the cached instance
            assert service1 == service2
            assert service1 == mock_service


class TestRouterConfiguration:
    """Test router configuration."""

    def test_router_exists(self):
        """Test analytics router is configured."""
        assert analytics_router is not None
        assert analytics_router.prefix == "/analytics"  # Router has /analytics prefix

    def test_router_has_routes(self):
        """Test router has expected routes."""
        routes = [route.path for route in analytics_router.routes]
        assert "/analytics/events" in routes
        assert "/analytics/metrics" in routes
