"""
Unit tests for analytics router helper functions and utilities.

Tests helper functions, datetime handling, and router configuration.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from dotmac.platform.analytics.router import (
    _ensure_utc,
    _isoformat,
    analytics_router,
    get_analytics_service,
    get_operations_metrics,
    get_security_metrics,
)
from dotmac.platform.auth.core import TokenType, jwt_service


@pytest.fixture(autouse=True)
def _mock_jwt(monkeypatch):
    """Provide deterministic JWT behaviour for analytics tests."""

    def _create_access_token(*args, **kwargs) -> str:
        return "test-access-token"

    def _verify_token(token: str, expected_type: TokenType | None = None):
        token_type = expected_type.value if expected_type else TokenType.ACCESS.value
        return {
            "sub": "analytics-test-user",
            "tenant_id": "test-tenant",
            "type": token_type,
            "roles": ["admin"],
            "permissions": [
                "analytics:read",
                "analytics.metrics.read",
                "security.read",
                "platform:analytics.read",
            ],
        }

    monkeypatch.setattr(jwt_service, "create_access_token", _create_access_token)
    monkeypatch.setattr(jwt_service, "verify_token", _verify_token)
    yield


@pytest.fixture
def auth_headers():
    """Standard auth headers for analytics tests."""
    return {
        "Authorization": "Bearer test-access-token",
        "X-Tenant-ID": "test-tenant",
    }


@pytest.mark.unit
class TestHelperFunctions:
    """Test analytics router helper functions."""

    def test_ensure_utc_with_none(self):
        """Test _ensure_utc with None returns current timezone.utc time."""
        result = _ensure_utc(None)
        assert result.tzinfo == UTC
        # Should be recent (within last second)
        assert (datetime.now(UTC) - result).total_seconds() < 1

    def test_ensure_utc_with_naive_datetime(self):
        """Test _ensure_utc with naive datetime adds timezone.utc timezone."""
        naive_dt = datetime(2024, 1, 1, 12, 0, 0)
        result = _ensure_utc(naive_dt)
        assert result.tzinfo == UTC
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 1

    def test_ensure_utc_with_aware_datetime(self):
        """Test _ensure_utc with aware datetime converts to timezone.utc."""
        aware_dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        result = _ensure_utc(aware_dt)
        assert result.tzinfo == UTC
        assert result == aware_dt

    def test_ensure_utc_with_string_z_suffix(self):
        """Test _ensure_utc with ISO string ending in Z."""
        iso_string = "2024-01-01T12:00:00Z"
        result = _ensure_utc(iso_string)
        assert result.tzinfo == UTC
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 1

    def test_ensure_utc_with_string_no_z(self):
        """Test _ensure_utc with ISO string without Z."""
        iso_string = "2024-01-01T12:00:00"
        result = _ensure_utc(iso_string)
        assert result.tzinfo == UTC
        assert result.year == 2024

    def test_ensure_utc_with_invalid_string(self):
        """Test _ensure_utc with invalid string returns current time."""
        invalid_string = "not a datetime"
        result = _ensure_utc(invalid_string)
        assert result.tzinfo == UTC
        # Should be recent (within last second)
        assert (datetime.now(UTC) - result).total_seconds() < 1

    def test_ensure_utc_with_other_type(self):
        """Test _ensure_utc with non-datetime/string type returns current time."""
        result = _ensure_utc(12345)
        assert result.tzinfo == UTC
        # Should be recent (within last second)
        assert (datetime.now(UTC) - result).total_seconds() < 1

    def test_isoformat_with_datetime(self):
        """Test _isoformat formats datetime correctly."""
        dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        result = _isoformat(dt)
        assert isinstance(result, str)
        assert "2024-01-01" in result
        assert result.endswith("Z")

    def test_isoformat_with_none(self):
        """Test _isoformat with None returns current time formatted."""
        result = _isoformat(None)
        assert isinstance(result, str)
        assert result.endswith("Z")


@pytest.mark.unit
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


@pytest.mark.unit
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


@pytest.mark.integration
class TestSecurityAndOperationsEndpoints:
    """Integration-style checks for analytics security and operations endpoints."""

    async def test_security_metrics_maps_cached_data(self):
        with patch(
            "dotmac.platform.analytics.router._get_auth_metrics_cached", new_callable=AsyncMock
        ) as mock_auth, patch(
            "dotmac.platform.analytics.router._get_api_key_metrics_cached", new_callable=AsyncMock
        ) as mock_keys, patch(
            "dotmac.platform.analytics.router._get_secrets_metrics_cached", new_callable=AsyncMock
        ) as mock_secrets:
            mock_auth.return_value = {
                "active_users": 10,
                "failed_logins": 2,
                "mfa_enabled_users": 6,
                "password_reset_requests": 1,
            }
            mock_keys.return_value = {
                "total_keys": 5,
                "active_keys": 4,
                "keys_expiring_soon": 1,
            }
            mock_secrets.return_value = {
                "total_secrets_created": 8,
                "unique_secrets_accessed": 5,
                "secrets_deleted_last_7d": 1,
                "secrets_created_last_7d": 2,
                "failed_access_attempts": 1,
            }

            request = MagicMock()
            request.headers = {"X-Tenant-ID": "test-tenant"}
            request.query_params = {}

            user = MagicMock()
            user.tenant_id = "test-tenant"

            data = await get_security_metrics(
                request=request,
                timeRange="30d",
                session=AsyncMock(),
                current_user=user,
            )
            assert data["auth"]["activeSessions"] == 10
            assert data["apiKeys"]["expiring"] == 1
            assert data["secrets"]["total"] == 8
            assert data["compliance"]["issues"] == 1

    async def test_operations_metrics_combines_sources(self):
        with patch(
            "dotmac.platform.analytics.router._get_customer_metrics_cached", new_callable=AsyncMock
        ) as mock_customers, patch(
            "dotmac.platform.analytics.router._get_communication_stats_cached",
            new_callable=AsyncMock,
        ) as mock_comms, patch(
            "dotmac.platform.analytics.router._get_file_stats_cached", new_callable=AsyncMock
        ) as mock_files, patch(
            "dotmac.platform.analytics.router._get_monitoring_metrics_cached",
            new_callable=AsyncMock,
        ) as mock_monitoring:
            mock_customers.return_value = {
                "total_customers": 100,
                "new_customers_this_month": 5,
                "customer_growth_rate": 2.5,
                "at_risk_customers": 4,
            }
            mock_comms.return_value = {
                "total_sent": 200,
                "delivery_rate": 98.0,
            }
            mock_files.return_value = {
                "total_files": 50,
                "total_size_mb": 123.4,
            }
            mock_monitoring.return_value = {
                "total_requests": 240,
                "user_activities": 12,
            }

            request = MagicMock()
            request.headers = {"X-Tenant-ID": "test-tenant"}
            request.query_params = {}
            user = MagicMock()
            user.tenant_id = "test-tenant"

            data = await get_operations_metrics(
                request=request,
                timeRange="30d",
                session=AsyncMock(),
                current_user=user,
            )
            assert data["customers"]["total"] == 100
            assert data["customers"]["churnRisk"] == pytest.approx(4.0)
            assert data["communications"]["totalSent"] == 200
            assert data["files"]["totalSize"] == 123.4
            assert data["activity"]["eventsPerHour"] == pytest.approx(10.0)
            # Flattened aliases for legacy callers
            assert data["totalCustomers"] == 100
            assert data["newCustomersThisMonth"] == 5
            assert data["customerGrowthRate"] == 2.5
            assert data["customersAtRisk"] == pytest.approx(4.0)
            assert data["totalCommunications"] == 200
            assert data["totalFiles"] == 50
            assert data["eventsPerHour"] == pytest.approx(10.0)
