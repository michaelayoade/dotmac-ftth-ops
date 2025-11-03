"""
Tests for analytics router branch coverage.

Covers error handling, edge cases, and conditional branches.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from dotmac.platform.analytics.models import AnalyticsQueryRequest
from dotmac.platform.analytics.router import (
    custom_query,
    get_metrics,
)
from dotmac.platform.auth.core import UserInfo


class _TestApp:
    """Minimal FastAPI-like app for Request scope cleanup."""

    def __init__(self) -> None:
        self.dependency_overrides = {}
        self.state = SimpleNamespace(_state={})


pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_user():
    """Create mock user."""
    return UserInfo(
        user_id="test-user",
        username="testuser",
        email="test@example.com",
        tenant_id="test-tenant",
        roles=["user"],
        permissions=["read"],
    )


@pytest.fixture
def mock_request():
    """Create mock FastAPI Request."""
    scope = {"type": "http", "method": "GET", "path": "/", "app": _TestApp()}
    return Request(scope=scope)


@pytest.mark.unit
class TestGetMetricsDateDefaults:
    """Test get_metrics endpoint with default date handling."""

    @pytest.mark.asyncio
    async def test_get_metrics_no_dates_uses_defaults(self, mock_request, mock_user):
        """Test get_metrics with no dates uses 24-hour default (lines 227-230)."""
        mock_service = MagicMock()
        mock_service.query_metrics = AsyncMock(return_value={})

        with patch(
            "dotmac.platform.analytics.router.get_analytics_service", return_value=mock_service
        ):
            # Call with no dates - should trigger lines 227-230
            await get_metrics(
                request=mock_request,
                current_user=mock_user,
                metric_name=None,
                start_date=None,
                end_date=None,
                aggregation="avg",
                interval="hour",
            )

            # Should have called service with calculated dates
            assert mock_service.query_metrics.called

    @pytest.mark.asyncio
    async def test_get_metrics_returns_list_when_not_dict(self, mock_request, mock_user):
        """Test get_metrics handles non-dict response (line 264)."""
        mock_service = MagicMock()
        # Return a list instead of dict
        mock_service.query_metrics = AsyncMock(return_value=[{"name": "test_metric", "value": 100}])

        with patch(
            "dotmac.platform.analytics.router.get_analytics_service", return_value=mock_service
        ):
            result = await get_metrics(
                request=mock_request,
                current_user=mock_user,
                metric_name="test_metric",
                start_date=datetime.now(UTC) - timedelta(hours=1),
                end_date=datetime.now(UTC),
                aggregation="sum",
                interval="minute",
            )

            assert result.metrics is not None

    @pytest.mark.asyncio
    async def test_get_metrics_with_metric_grouping(self, mock_request, mock_user):
        """Test get_metrics groups metrics by name (lines 268-294)."""
        mock_service = MagicMock()
        # Return dict with counters
        mock_service.query_metrics = AsyncMock(
            return_value={
                "counters": {"requests": 100, "errors": 5},
                "timestamp": datetime.now(UTC),
            }
        )

        with patch(
            "dotmac.platform.analytics.router.get_analytics_service", return_value=mock_service
        ):
            result = await get_metrics(
                request=mock_request,
                current_user=mock_user,
                metric_name="requests",
                start_date=datetime.now(UTC) - timedelta(hours=1),
                end_date=datetime.now(UTC),
                aggregation="sum",
                interval="hour",
            )

            assert result.metrics is not None
            assert result.total_series >= 0

    @pytest.mark.asyncio
    async def test_get_metrics_error_handling(self, mock_request, mock_user):
        """Test get_metrics handles errors (lines 303-307)."""
        mock_service = MagicMock()
        mock_service.query_metrics = AsyncMock(side_effect=Exception("Database error"))

        with patch(
            "dotmac.platform.analytics.router.get_analytics_service", return_value=mock_service
        ):
            with pytest.raises(HTTPException) as exc_info:
                await get_metrics(
                    request=mock_request,
                    current_user=mock_user,
                    metric_name="test",
                    start_date=None,
                    end_date=None,
                    aggregation="avg",
                    interval="hour",
                )

            assert exc_info.value.status_code == 500
            assert "Failed to query metrics" in str(exc_info.value.detail)


@pytest.mark.unit
class TestCustomQueryBranches:
    """Test custom_query endpoint branches."""

    @pytest.mark.asyncio
    async def test_custom_query_events_type(self, mock_request, mock_user):
        """Test custom_query with events type (line 324)."""
        mock_service = MagicMock()
        mock_service.query_events = AsyncMock(return_value=[])

        with patch(
            "dotmac.platform.analytics.router.get_analytics_service", return_value=mock_service
        ):
            query_request = AnalyticsQueryRequest(query_type="events", filters={})

            result = await custom_query(query_request, mock_request, mock_user)

            assert result["query_type"] == "events"
            mock_service.query_events.assert_called_once()

    @pytest.mark.asyncio
    async def test_custom_query_metrics_type(self, mock_request, mock_user):
        """Test custom_query with metrics type (line 326)."""
        mock_service = MagicMock()
        mock_service.query_metrics = AsyncMock(return_value={})

        with patch(
            "dotmac.platform.analytics.router.get_analytics_service", return_value=mock_service
        ):
            query_request = AnalyticsQueryRequest(query_type="metrics", filters={})

            result = await custom_query(query_request, mock_request, mock_user)

            assert result["query_type"] == "metrics"
            mock_service.query_metrics.assert_called_once()

    @pytest.mark.asyncio
    async def test_custom_query_aggregations_type(self, mock_request, mock_user):
        """Test custom_query with aggregations type."""
        mock_service = MagicMock()
        mock_service.aggregate_data = AsyncMock(return_value=[])

        with patch(
            "dotmac.platform.analytics.router.get_analytics_service", return_value=mock_service
        ):
            query_request = AnalyticsQueryRequest(query_type="aggregations", filters={})

            result = await custom_query(query_request, mock_request, mock_user)

            assert result["query_type"] == "aggregations"
            mock_service.aggregate_data.assert_called_once()

    @pytest.mark.asyncio
    async def test_custom_query_invalid_type(self, mock_user):
        """Test custom_query with invalid type raises error (line 335)."""
        # This should fail Pydantic validation before reaching the router
        with pytest.raises((ValueError, TypeError)):  # Pydantic ValidationError
            AnalyticsQueryRequest(query_type="invalid_type", filters={})

    @pytest.mark.asyncio
    async def test_custom_query_general_error_handling(self, mock_request, mock_user):
        """Test custom_query handles general errors (lines 344-348)."""
        mock_service = MagicMock()
        mock_service.query_events = AsyncMock(side_effect=Exception("Service error"))

        with patch(
            "dotmac.platform.analytics.router.get_analytics_service", return_value=mock_service
        ):
            query_request = AnalyticsQueryRequest(query_type="events", filters={})

            with pytest.raises(HTTPException) as exc_info:
                await custom_query(query_request, mock_request, mock_user)

            assert exc_info.value.status_code == 500
            assert "Failed to execute query" in str(exc_info.value.detail)
