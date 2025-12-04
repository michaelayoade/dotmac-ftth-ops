"""
Comprehensive tests for monitoring_metrics_router module.

Tests all endpoints for logs and metrics routers.
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import FastAPI

from dotmac.platform.monitoring_metrics_router import (
    ErrorRateResponse,
    LatencyMetrics,
    ResourceMetrics,
    get_error_rate,
    get_latency_metrics,
    get_resource_metrics,
    logs_router,
    metrics_router,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_session():
    """Create mock database session."""
    session = AsyncMock()
    return session


@pytest.fixture
def mock_user():
    """Create mock user."""
    from dotmac.platform.auth.core import UserInfo

    return UserInfo(user_id="test-user", username="testuser", email="test@example.com")


@pytest.fixture
def app():
    """Create FastAPI app for testing."""
    app = FastAPI()
    app.include_router(logs_router, prefix="/logs")
    app.include_router(metrics_router, prefix="/metrics")
    return app


class TestErrorRateEndpoint:
    """Test error rate endpoint."""

    @pytest.mark.asyncio
    async def test_get_error_rate_with_data(self, mock_session, mock_user):
        """Test error rate calculation with data."""
        # Mock query results
        error_result = Mock()
        error_result.scalar.return_value = 10  # 10 errors
        total_result = Mock()
        total_result.scalar.return_value = 100  # 100 total requests

        mock_session.execute = AsyncMock(side_effect=[error_result, total_result])

        response = await get_error_rate(
            window_minutes=60, session=mock_session, current_user=mock_user
        )

        assert isinstance(response, ErrorRateResponse)
        assert response.rate == 10.0  # 10/100 * 100 = 10%
        assert response.total_requests == 100
        assert response.error_count == 10
        assert response.time_window == "60m"

    @pytest.mark.asyncio
    async def test_get_error_rate_with_zero_requests(self, mock_session, mock_user):
        """Test error rate when no requests exist."""
        # Mock query results with zero requests
        error_result = Mock()
        error_result.scalar.return_value = 0
        total_result = Mock()
        total_result.scalar.return_value = 0

        mock_session.execute = AsyncMock(side_effect=[error_result, total_result])

        response = await get_error_rate(
            window_minutes=30, session=mock_session, current_user=mock_user
        )

        assert response.rate == 0.0
        assert response.total_requests == 0
        assert response.error_count == 0
        assert response.time_window == "30m"

    @pytest.mark.asyncio
    async def test_get_error_rate_exception_handling(self, mock_session, mock_user):
        """Test error rate endpoint handles exceptions gracefully."""
        # Make session.execute raise an exception
        mock_session.execute = AsyncMock(side_effect=Exception("Database error"))

        response = await get_error_rate(
            window_minutes=60, session=mock_session, current_user=mock_user
        )

        # Should return safe defaults
        assert response.rate == 0.0
        assert response.total_requests == 0
        assert response.error_count == 0

    @pytest.mark.asyncio
    async def test_get_error_rate_with_none_scalars(self, mock_session, mock_user):
        """Test error rate when scalars return None."""
        # Mock query results with None
        error_result = Mock()
        error_result.scalar.return_value = None
        total_result = Mock()
        total_result.scalar.return_value = None

        mock_session.execute = AsyncMock(side_effect=[error_result, total_result])

        response = await get_error_rate(
            window_minutes=60, session=mock_session, current_user=mock_user
        )

        assert response.rate == 0.0
        assert response.total_requests == 0
        assert response.error_count == 0


class TestLatencyMetricsEndpoint:
    """Test latency metrics endpoint."""

    @pytest.mark.asyncio
    async def test_get_latency_metrics_with_data(self, mock_session, mock_user):
        """Test latency metrics calculation with duration data."""
        # Mock details with duration values
        details_list = [
            {"duration": 100},
            {"duration": 200},
            {"duration": 300},
            {"duration": 400},
            {"duration": 500},
        ]

        result = Mock()
        result.scalars.return_value.all.return_value = details_list
        mock_session.execute = AsyncMock(return_value=result)

        response = await get_latency_metrics(
            window_minutes=60, current_user=mock_user, session=mock_session
        )

        assert isinstance(response, LatencyMetrics)
        assert response.p50 == 300.0  # Median
        assert response.p95 == 500.0
        assert response.average == 300.0
        assert response.max == 500.0
        assert response.min == 100.0
        assert response.time_window == "60m"

    @pytest.mark.asyncio
    async def test_get_latency_metrics_no_data(self, mock_session, mock_user):
        """Test latency metrics when no data is available."""
        result = Mock()
        result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=result)

        response = await get_latency_metrics(
            window_minutes=60, current_user=mock_user, session=mock_session
        )

        assert response.p50 == 0.0
        assert response.p95 == 0.0
        assert response.p99 == 0.0
        assert response.average == 0.0
        assert response.max == 0.0
        assert response.min == 0.0

    @pytest.mark.asyncio
    async def test_get_latency_metrics_single_data_point(self, mock_session, mock_user):
        """Test latency metrics with single data point."""
        details_list = [{"duration": 250}]

        result = Mock()
        result.scalars.return_value.all.return_value = details_list
        mock_session.execute = AsyncMock(return_value=result)

        response = await get_latency_metrics(
            window_minutes=60, current_user=mock_user, session=mock_session
        )

        assert response.p50 == 250.0
        assert response.p99 == 250.0  # Uses last element when count <= 1
        assert response.average == 250.0
        assert response.max == 250.0
        assert response.min == 250.0

    @pytest.mark.asyncio
    async def test_get_latency_metrics_with_invalid_details(self, mock_session, mock_user):
        """Test latency metrics with invalid details entries."""
        details_list = [
            {"duration": 100},
            None,  # Invalid
            {},  # No duration
            {"other_field": "value"},  # No duration
            {"duration": 200},
        ]

        result = Mock()
        result.scalars.return_value.all.return_value = details_list
        mock_session.execute = AsyncMock(return_value=result)

        response = await get_latency_metrics(
            window_minutes=60, current_user=mock_user, session=mock_session
        )

        # Should only process valid durations (100, 200)
        assert response.average == 150.0
        assert response.min == 100.0
        assert response.max == 200.0

    @pytest.mark.asyncio
    async def test_get_latency_metrics_exception_handling(self, mock_session, mock_user):
        """Test latency metrics handles exceptions gracefully."""
        mock_session.execute = AsyncMock(side_effect=Exception("Database error"))

        response = await get_latency_metrics(
            window_minutes=60, current_user=mock_user, session=mock_session
        )

        # Should return safe defaults
        assert response.p50 == 0.0
        assert response.p95 == 0.0
        assert response.p99 == 0.0
        assert response.average == 0.0


class TestResourceMetricsEndpoint:
    """Test resource metrics endpoint."""

    @pytest.mark.asyncio
    async def test_get_resource_metrics_success(self, mock_user):
        """Test resource metrics with successful psutil calls."""
        # Patch psutil at the module where it's imported (inside the function)
        with patch("psutil.cpu_percent", return_value=45.5):
            with patch("psutil.virtual_memory", return_value=Mock(percent=65.2)):
                with patch("psutil.disk_usage", return_value=Mock(percent=78.9)):
                    with patch(
                        "psutil.net_io_counters",
                        return_value=Mock(
                            bytes_recv=1024 * 1024 * 100,  # 100 MB
                            bytes_sent=1024 * 1024 * 50,  # 50 MB
                        ),
                    ):
                        response = await get_resource_metrics(current_user=mock_user)

                        assert isinstance(response, ResourceMetrics)
                        assert response.cpu == 45.5
                        assert response.memory == 65.2
                        assert response.disk == 78.9
                        assert response.network_in == 100.0
                        assert response.network_out == 50.0

    @pytest.mark.asyncio
    async def test_get_resource_metrics_exception_handling(self, mock_user):
        """Test resource metrics handles exceptions gracefully."""
        # Make psutil import fail
        with patch("psutil.cpu_percent", side_effect=Exception("psutil error")):
            response = await get_resource_metrics(current_user=mock_user)

            # Should return safe defaults
            assert response.cpu == 0.0
            assert response.memory == 0.0
            assert response.disk == 0.0
            assert response.network_in == 0.0
            assert response.network_out == 0.0


class TestRouterIntegration:
    """Test router integration."""

    def test_logs_router_exists(self):
        """Test logs_router is properly configured."""
        from dotmac.platform.monitoring_metrics_router import logs_router

        assert logs_router is not None
        assert len(logs_router.routes) > 0

    def test_metrics_router_exists(self):
        """Test metrics_router is properly configured."""
        from dotmac.platform.monitoring_metrics_router import metrics_router

        assert metrics_router is not None
        assert len(metrics_router.routes) > 0

    def test_routers_have_tags(self):
        """Test routers have appropriate tags."""
        from dotmac.platform.monitoring_metrics_router import logs_router, metrics_router

        assert "Logs" in logs_router.tags
        assert "Metrics" in metrics_router.tags
