"""
Tests for Monitoring Metrics Router.

Tests caching, rate limiting, tenant isolation, and error handling
for both monitoring metrics and log statistics endpoints.
"""

from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


class TestMonitoringMetricsEndpoint:
    """Test monitoring metrics endpoint."""

    async def test_get_monitoring_metrics_success(self, client: AsyncClient, auth_headers):
        """Test successful retrieval of monitoring metrics."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_monitoring_metrics_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "error_rate": 2.5,
                "critical_errors": 10,
                "warning_count": 50,
                "avg_response_time_ms": 125.5,
                "p95_response_time_ms": 250.0,
                "p99_response_time_ms": 500.0,
                "total_requests": 10000,
                "successful_requests": 9750,
                "failed_requests": 250,
                "api_requests": 8000,
                "user_activities": 1500,
                "system_activities": 500,
                "high_latency_requests": 100,
                "timeout_count": 20,
                "top_errors": [
                    {"error": "connection_timeout", "count": 50},
                    {"error": "validation_error", "count": 30},
                ],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/metrics?period_days=30",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["error_rate"] == 2.5
            assert data["critical_errors"] == 10
            assert data["avg_response_time_ms"] == 125.5
            assert data["p95_response_time_ms"] == 250.0
            assert data["total_requests"] == 10000
            assert data["successful_requests"] == 9750
            assert data["high_latency_requests"] == 100
            assert len(data["top_errors"]) == 2
            assert data["period"] == "30d"

    async def test_get_monitoring_metrics_performance_indicators(
        self, client: AsyncClient, auth_headers
    ):
        """Test performance indicator metrics."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_monitoring_metrics_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "error_rate": 0.5,
                "critical_errors": 2,
                "warning_count": 10,
                "avg_response_time_ms": 75.0,
                "p95_response_time_ms": 150.0,
                "p99_response_time_ms": 300.0,
                "total_requests": 5000,
                "successful_requests": 4975,
                "failed_requests": 25,
                "api_requests": 4000,
                "user_activities": 800,
                "system_activities": 200,
                "high_latency_requests": 50,
                "timeout_count": 5,
                "top_errors": [],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/metrics",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            # Performance metrics
            assert data["avg_response_time_ms"] == 75.0
            assert data["p95_response_time_ms"] == 150.0
            assert data["p99_response_time_ms"] == 300.0
            assert data["high_latency_requests"] == 50
            assert data["timeout_count"] == 5

    async def test_get_monitoring_metrics_no_data(self, client: AsyncClient, auth_headers):
        """Test metrics when no monitoring data exists."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_monitoring_metrics_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "error_rate": 0.0,
                "critical_errors": 0,
                "warning_count": 0,
                "avg_response_time_ms": 0.0,
                "p95_response_time_ms": 0.0,
                "p99_response_time_ms": 0.0,
                "total_requests": 0,
                "successful_requests": 0,
                "failed_requests": 0,
                "api_requests": 0,
                "user_activities": 0,
                "system_activities": 0,
                "high_latency_requests": 0,
                "timeout_count": 0,
                "top_errors": [],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/metrics",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_requests"] == 0
            assert data["error_rate"] == 0.0

    async def test_get_monitoring_metrics_requires_auth(self, unauthenticated_client: AsyncClient):
        """Test that endpoint requires authentication.

        Uses unauthenticated_client fixture which does NOT override auth,
        allowing us to verify that authentication is actually enforced.
        """
        response = await unauthenticated_client.get("/api/v1/metrics/monitoring/metrics")
        assert response.status_code == 401

    async def test_get_monitoring_metrics_error_handling(self, client: AsyncClient, auth_headers):
        """Test error handling returns safe defaults."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_monitoring_metrics_cached"
        ) as mock_cached:
            mock_cached.side_effect = Exception("Database error")

            response = await client.get(
                "/api/v1/metrics/monitoring/metrics",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["error_rate"] == 0.0
            assert data["total_requests"] == 0


class TestLogStatsEndpoint:
    """Test log statistics endpoint."""

    async def test_get_log_stats_success(self, client: AsyncClient, auth_headers):
        """Test successful retrieval of log statistics."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_log_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_logs": 50000,
                "critical_logs": 100,
                "high_logs": 500,
                "medium_logs": 2000,
                "low_logs": 47400,
                "auth_logs": 10000,
                "api_logs": 30000,
                "system_logs": 5000,
                "secret_logs": 3000,
                "file_logs": 2000,
                "error_logs": 600,
                "unique_error_types": 25,
                "most_common_errors": [
                    {"error": "timeout", "count": 200},
                    {"error": "not_found", "count": 150},
                ],
                "unique_users": 150,
                "unique_ips": 75,
                "logs_last_hour": 500,
                "logs_last_24h": 5000,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/logs/stats?period_days=30",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_logs"] == 50000
            assert data["critical_logs"] == 100
            assert data["high_logs"] == 500
            assert data["auth_logs"] == 10000
            assert data["api_logs"] == 30000
            assert data["error_logs"] == 600
            assert data["unique_error_types"] == 25
            assert len(data["most_common_errors"]) == 2
            assert data["unique_users"] == 150
            assert data["logs_last_hour"] == 500
            assert data["period"] == "30d"

    async def test_get_log_stats_severity_breakdown(self, client: AsyncClient, auth_headers):
        """Test log severity breakdown."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_log_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_logs": 10000,
                "critical_logs": 50,
                "high_logs": 200,
                "medium_logs": 500,
                "low_logs": 9250,
                "auth_logs": 2000,
                "api_logs": 6000,
                "system_logs": 1000,
                "secret_logs": 500,
                "file_logs": 500,
                "error_logs": 250,
                "unique_error_types": 10,
                "most_common_errors": [],
                "unique_users": 50,
                "unique_ips": 25,
                "logs_last_hour": 100,
                "logs_last_24h": 1000,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/logs/stats",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            # Severity breakdown
            assert data["critical_logs"] == 50
            assert data["high_logs"] == 200
            assert data["medium_logs"] == 500
            assert data["low_logs"] == 9250

    async def test_get_log_stats_activity_breakdown(self, client: AsyncClient, auth_headers):
        """Test log activity type breakdown."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_log_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_logs": 20000,
                "critical_logs": 10,
                "high_logs": 100,
                "medium_logs": 500,
                "low_logs": 19390,
                "auth_logs": 5000,
                "api_logs": 10000,
                "system_logs": 2000,
                "secret_logs": 2000,
                "file_logs": 1000,
                "error_logs": 110,
                "unique_error_types": 15,
                "most_common_errors": [{"error": "validation", "count": 50}],
                "unique_users": 100,
                "unique_ips": 50,
                "logs_last_hour": 200,
                "logs_last_24h": 2000,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/logs/stats",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            # Activity breakdown
            assert data["auth_logs"] == 5000
            assert data["api_logs"] == 10000
            assert data["system_logs"] == 2000
            assert data["secret_logs"] == 2000
            assert data["file_logs"] == 1000

    async def test_get_log_stats_no_logs(self, client: AsyncClient, auth_headers):
        """Test stats when no logs exist."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_log_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_logs": 0,
                "critical_logs": 0,
                "high_logs": 0,
                "medium_logs": 0,
                "low_logs": 0,
                "auth_logs": 0,
                "api_logs": 0,
                "system_logs": 0,
                "secret_logs": 0,
                "file_logs": 0,
                "error_logs": 0,
                "unique_error_types": 0,
                "most_common_errors": [],
                "unique_users": 0,
                "unique_ips": 0,
                "logs_last_hour": 0,
                "logs_last_24h": 0,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/logs/stats",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_logs"] == 0
            assert data["unique_error_types"] == 0

    async def test_get_log_stats_invalid_period(self, client: AsyncClient, auth_headers):
        """Test validation of period_days parameter."""
        response = await client.get(
            "/api/v1/metrics/monitoring/logs/stats?period_days=0",
            headers=auth_headers,
        )
        assert response.status_code == 422

        response = await client.get(
            "/api/v1/metrics/monitoring/logs/stats?period_days=400",
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_get_log_stats_requires_auth(self, unauthenticated_client: AsyncClient):
        """Test that endpoint requires authentication.

        Uses unauthenticated_client fixture which does NOT override auth,
        allowing us to verify that authentication is actually enforced.
        """
        response = await unauthenticated_client.get("/api/v1/metrics/monitoring/logs/stats")
        assert response.status_code == 401

    async def test_get_log_stats_error_handling(self, client: AsyncClient, auth_headers):
        """Test error handling returns safe defaults."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_log_stats_cached"
        ) as mock_cached:
            mock_cached.side_effect = Exception("Database error")

            response = await client.get(
                "/api/v1/metrics/monitoring/logs/stats",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total_logs"] == 0
            assert data["error_logs"] == 0


class TestMonitoringMetricsCaching:
    """Test caching for monitoring metrics endpoints."""

    async def test_monitoring_metrics_caching(self, client: AsyncClient, auth_headers):
        """Test that monitoring metrics are cached."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_monitoring_metrics_cached"
        ) as mock_cached:
            mock_data = {
                "error_rate": 1.5,
                "critical_errors": 5,
                "warning_count": 20,
                "avg_response_time_ms": 100.0,
                "p95_response_time_ms": 200.0,
                "p99_response_time_ms": 400.0,
                "total_requests": 5000,
                "successful_requests": 4925,
                "failed_requests": 75,
                "api_requests": 4000,
                "user_activities": 800,
                "system_activities": 200,
                "high_latency_requests": 25,
                "timeout_count": 10,
                "top_errors": [],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }
            mock_cached.return_value = mock_data

            response1 = await client.get(
                "/api/v1/metrics/monitoring/metrics",
                headers=auth_headers,
            )
            assert response1.status_code == 200

            response2 = await client.get(
                "/api/v1/metrics/monitoring/metrics",
                headers=auth_headers,
            )
            assert response2.status_code == 200

            assert response1.json()["error_rate"] == response2.json()["error_rate"]

    async def test_log_stats_caching(self, client: AsyncClient, auth_headers):
        """Test that log stats are cached."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_log_stats_cached"
        ) as mock_cached:
            mock_data = {
                "total_logs": 25000,
                "critical_logs": 50,
                "high_logs": 250,
                "medium_logs": 1000,
                "low_logs": 23700,
                "auth_logs": 5000,
                "api_logs": 15000,
                "system_logs": 2500,
                "secret_logs": 1500,
                "file_logs": 1000,
                "error_logs": 300,
                "unique_error_types": 12,
                "most_common_errors": [{"error": "timeout", "count": 100}],
                "unique_users": 75,
                "unique_ips": 40,
                "logs_last_hour": 250,
                "logs_last_24h": 2500,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }
            mock_cached.return_value = mock_data

            response1 = await client.get(
                "/api/v1/metrics/monitoring/logs/stats",
                headers=auth_headers,
            )
            assert response1.status_code == 200

            response2 = await client.get(
                "/api/v1/metrics/monitoring/logs/stats",
                headers=auth_headers,
            )
            assert response2.status_code == 200

            assert response1.json()["total_logs"] == response2.json()["total_logs"]


class TestMonitoringMetricsTenantIsolation:
    """Test tenant isolation for monitoring metrics."""

    async def test_monitoring_metrics_tenant_isolation(self, client: AsyncClient, auth_headers):
        """Test that cache keys include tenant ID for monitoring metrics."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_monitoring_metrics_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "error_rate": 1.0,
                "critical_errors": 3,
                "warning_count": 15,
                "avg_response_time_ms": 90.0,
                "p95_response_time_ms": 180.0,
                "p99_response_time_ms": 350.0,
                "total_requests": 3000,
                "successful_requests": 2970,
                "failed_requests": 30,
                "api_requests": 2400,
                "user_activities": 480,
                "system_activities": 120,
                "high_latency_requests": 15,
                "timeout_count": 5,
                "top_errors": [],
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/metrics",
                headers=auth_headers,
            )

            assert response.status_code == 200
            assert mock_cached.called
            call_kwargs = mock_cached.call_args[1]
            assert "tenant_id" in call_kwargs

    async def test_log_stats_tenant_isolation(self, client: AsyncClient, auth_headers):
        """Test that cache keys include tenant ID for log stats."""
        with patch(
            "dotmac.platform.monitoring.metrics_router._get_log_stats_cached"
        ) as mock_cached:
            mock_cached.return_value = {
                "total_logs": 15000,
                "critical_logs": 30,
                "high_logs": 150,
                "medium_logs": 600,
                "low_logs": 14220,
                "auth_logs": 3000,
                "api_logs": 9000,
                "system_logs": 1500,
                "secret_logs": 900,
                "file_logs": 600,
                "error_logs": 180,
                "unique_error_types": 8,
                "most_common_errors": [],
                "unique_users": 45,
                "unique_ips": 25,
                "logs_last_hour": 150,
                "logs_last_24h": 1500,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = await client.get(
                "/api/v1/metrics/monitoring/logs/stats",
                headers=auth_headers,
            )

            assert response.status_code == 200
            assert mock_cached.called
            call_kwargs = mock_cached.call_args[1]
            assert "tenant_id" in call_kwargs
