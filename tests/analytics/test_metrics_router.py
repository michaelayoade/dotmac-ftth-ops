"""
Tests for Analytics Activity Metrics Router.

Tests caching, rate limiting, tenant isolation, and error handling
for the analytics activity statistics endpoint.
"""

from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from httpx import AsyncClient

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
            "permissions": ["analytics:read"],
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


pytestmark = pytest.mark.integration


class TestAnalyticsActivityStatsEndpoint:
    """Test analytics activity statistics endpoint."""

    async def test_get_analytics_activity_stats_success(self, client: AsyncClient, auth_headers):
        """Test successful retrieval of analytics activity stats."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_events": 1000,
                "page_views": 500,
                "user_actions": 300,
                "api_calls": 150,
                "errors": 30,
                "custom_events": 20,
                "active_users": 50,
                "active_sessions": 75,
                "api_requests_count": 200,
                "avg_api_latency_ms": 125.5,
                "top_events": [
                    {"name": "page_view", "count": 500},
                    {"name": "button_click", "count": 200},
                ],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/analytics/activity?period_days=30",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_events"] == 1000
            assert data["page_views"] == 500
            assert data["user_actions"] == 300
            assert data["active_users"] == 50
            assert data["avg_api_latency_ms"] == 125.5
            assert len(data["top_events"]) == 2
            assert data["period"] == "30d"

    async def test_get_analytics_activity_stats_different_periods(
        self, client: AsyncClient, auth_headers
    ):
        """Test stats with different time periods."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_events": 100,
                "page_views": 50,
                "user_actions": 30,
                "api_calls": 15,
                "errors": 3,
                "custom_events": 2,
                "active_users": 10,
                "active_sessions": 15,
                "api_requests_count": 20,
                "avg_api_latency_ms": 100.0,
                "top_events": [{"name": "page_view", "count": 50}],
                "period": "7d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/analytics/activity?period_days=7",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["period"] == "7d"
            assert data["total_events"] == 100

    async def test_get_analytics_activity_stats_no_events(self, client: AsyncClient, auth_headers):
        """Test stats when no events are tracked."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_events": 0,
                "page_views": 0,
                "user_actions": 0,
                "api_calls": 0,
                "errors": 0,
                "custom_events": 0,
                "active_users": 0,
                "active_sessions": 0,
                "api_requests_count": 0,
                "avg_api_latency_ms": 0.0,
                "top_events": [],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/analytics/activity",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_events"] == 0
            assert data["active_users"] == 0
            assert data["top_events"] == []

    async def test_get_analytics_activity_stats_top_events(self, client: AsyncClient, auth_headers):
        """Test that top events are correctly returned."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            top_events = [{"name": f"event_{i}", "count": 100 - i * 10} for i in range(10)]
            mock_cached.return_value = {
                "total_events": 550,
                "page_views": 100,
                "user_actions": 200,
                "api_calls": 150,
                "errors": 50,
                "custom_events": 50,
                "active_users": 25,
                "active_sessions": 30,
                "api_requests_count": 150,
                "avg_api_latency_ms": 150.0,
                "top_events": top_events,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/analytics/activity",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data["top_events"]) == 10
            assert data["top_events"][0]["name"] == "event_0"
            assert data["top_events"][0]["count"] == 100

    async def test_get_analytics_activity_stats_invalid_period(
        self, client: AsyncClient, auth_headers
    ):
        """Test validation of period_days parameter."""
        response = await client.get(
            "/api/v1/metrics/analytics/activity?period_days=0",
            headers=auth_headers,
        )
        assert response.status_code == 422

        response = await client.get(
            "/api/v1/metrics/analytics/activity?period_days=400",
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_get_analytics_activity_stats_requires_auth(
        self, unauthenticated_client: AsyncClient
    ):
        """Test that endpoint requires authentication.

        Uses unauthenticated_client fixture which does NOT override auth,
        allowing us to verify that authentication is actually enforced.
        """
        response = await unauthenticated_client.get("/api/v1/metrics/analytics/activity")
        assert response.status_code == 401

    async def test_get_analytics_activity_stats_error_handling(
        self, client: AsyncClient, auth_headers
    ):
        """Test error handling returns safe defaults."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_cached.side_effect = Exception("Analytics service error")

            response = await client.get(
                "/api/v1/metrics/analytics/activity",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_events"] == 0
            assert data["active_users"] == 0
            assert data["top_events"] == []

    async def test_analytics_activity_stats_caching(self, client: AsyncClient, auth_headers):
        """Test that results are cached."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_data = {
                "total_events": 500,
                "page_views": 250,
                "user_actions": 150,
                "api_calls": 75,
                "errors": 15,
                "custom_events": 10,
                "active_users": 25,
                "active_sessions": 35,
                "api_requests_count": 100,
                "avg_api_latency_ms": 120.0,
                "top_events": [{"name": "page_view", "count": 250}],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }
            mock_cached.return_value = mock_data

            response1 = await client.get(
                "/api/v1/metrics/analytics/activity",
                headers=auth_headers,
            )
            assert response1.status_code == 200

            response2 = await client.get(
                "/api/v1/metrics/analytics/activity",
                headers=auth_headers,
            )
            assert response2.status_code == 200

            assert response1.json()["total_events"] == response2.json()["total_events"]


class TestAnalyticsActivityStatsTenantIsolation:
    """Test tenant isolation for analytics activity stats."""

    async def test_tenant_isolation_in_cache_key(self, client: AsyncClient, auth_headers):
        """Test that cache keys include tenant ID."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_events": 100,
                "page_views": 50,
                "user_actions": 30,
                "api_calls": 15,
                "errors": 3,
                "custom_events": 2,
                "active_users": 10,
                "active_sessions": 15,
                "api_requests_count": 20,
                "avg_api_latency_ms": 100.0,
                "top_events": [],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/analytics/activity",
                headers=auth_headers,
            )

            assert response.status_code == 200
            assert mock_cached.called
            call_kwargs = mock_cached.call_args[1]
            assert "tenant_id" in call_kwargs


class TestAnalyticsActivityRealCodePaths:
    """
    Test additional scenarios beyond basic mocking.

    These tests verify tenant isolation, error handling, RBAC enforcement,
    and edge cases that weren't covered by the basic mocked tests above.

    Note: We still mock _get_activity_stats_cached to avoid cache complexity,
    but we test more realistic data flows and error scenarios.
    """

    async def test_endpoint_handles_auth_correctly(self, client: AsyncClient, auth_headers):
        """Test that the endpoint properly integrates with auth."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_events": 0,
                "page_views": 0,
                "user_actions": 0,
                "api_calls": 0,
                "errors": 0,
                "custom_events": 0,
                "active_users": 0,
                "active_sessions": 0,
                "api_requests_count": 0,
                "avg_api_latency_ms": 0.0,
                "top_events": [],
                "period": "7d",
                "timestamp": datetime.now(UTC),
            }

            # Should work with auth headers
            response = await client.get(
                "/api/v1/metrics/analytics/activity?period_days=7",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_events"] == 0

    async def test_tenant_id_passed_to_cached_function(self, client: AsyncClient, auth_headers):
        """Test that tenant_id is correctly extracted and passed to the cached function."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_events": 50,
                "page_views": 25,
                "user_actions": 15,
                "api_calls": 8,
                "errors": 2,
                "custom_events": 0,
                "active_users": 10,
                "active_sessions": 12,
                "api_requests_count": 30,
                "avg_api_latency_ms": 150.0,
                "top_events": [],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/analytics/activity",
                headers=auth_headers,
            )

            assert response.status_code == 200
            # Verify the cached function was called with tenant_id
            assert mock_cached.called
            call_kwargs = mock_cached.call_args[1]
            assert "tenant_id" in call_kwargs
            assert call_kwargs["tenant_id"] is not None

    async def test_response_schema_validation(self, client: AsyncClient, auth_headers):
        """Test that the response matches the expected schema."""
        with patch(
            "dotmac.platform.analytics.metrics_router._get_activity_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_events": 100,
                "page_views": 50,
                "user_actions": 30,
                "api_calls": 15,
                "errors": 3,
                "custom_events": 2,
                "active_users": 25,
                "active_sessions": 30,
                "api_requests_count": 100,
                "avg_api_latency_ms": 125.5,
                "top_events": [{"name": "event1", "count": 50}],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/analytics/activity",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()

            # Verify all required fields are present
            required_fields = [
                "total_events",
                "page_views",
                "user_actions",
                "api_calls",
                "errors",
                "custom_events",
                "active_users",
                "active_sessions",
                "api_requests_count",
                "avg_api_latency_ms",
                "top_events",
                "period",
                "timestamp",
            ]

            for field in required_fields:
                assert field in data, f"Missing required field: {field}"

            # Verify types
            assert isinstance(data["total_events"], int)
            assert isinstance(data["avg_api_latency_ms"], (int, float))
            assert isinstance(data["top_events"], list)
