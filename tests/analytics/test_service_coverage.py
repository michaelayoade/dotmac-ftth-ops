"""Tests for analytics service to improve coverage."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.analytics.service import AnalyticsService, get_analytics_service


@pytest.mark.unit
class TestAnalyticsService:
    """Test AnalyticsService class."""

    @pytest.fixture
    def mock_collector(self):
        """Mock analytics collector."""
        collector = AsyncMock()
        collector.record_metric = AsyncMock()
        collector.get_metrics_summary = MagicMock(
            return_value={
                "counters": {"api_request": {"count": 100}},
                "gauges": {"custom_metric": {"avg": 42.5}},
                "histograms": {},
                "timestamp": None,
                "service": None,
                "tenant": None,
            }
        )
        collector.flush = AsyncMock()
        collector.tracer = MagicMock()
        collector.tracer.start_span = MagicMock()
        return collector

    @pytest.fixture
    def analytics_service(self, mock_collector):
        """Create analytics service with mocked collector."""
        return AnalyticsService(collector=mock_collector)

    @pytest.mark.asyncio
    async def test_record_metric(self, analytics_service, mock_collector):
        """Test recording a metric."""
        await analytics_service.record_metric(
            metric_name="api.requests", value=1.0, tags={"endpoint": "/users"}
        )

        mock_collector.record_metric.assert_called_once()
        call_kwargs = mock_collector.record_metric.call_args[1]
        assert call_kwargs["name"] == "api.requests"
        assert call_kwargs["value"] == 1.0

    @pytest.mark.asyncio
    async def test_track_event(self, analytics_service):
        """Test tracking an event."""
        event_id = await analytics_service.track_event(
            event_type="user_login", user_id="user-456", properties={"browser": "chrome"}
        )

        assert event_id is not None
        assert event_id.startswith("event_")
        assert len(analytics_service._events_store) == 1

    @pytest.mark.asyncio
    async def test_query_metrics(self, analytics_service, mock_collector):
        """Test querying metrics."""
        result = await analytics_service.query_metrics(
            metric_name="api",
            start_time=datetime.now(UTC),
            end_time=datetime.now(UTC),
        )

        assert result is not None
        # Result should have expected keys from filtered summary
        assert "counters" in result
        assert "gauges" in result
        assert "histograms" in result
        # Check that filtering worked - "api_request" should be in counters since we filtered by "api"
        assert "api_request" in result["counters"]
        mock_collector.get_metrics_summary.assert_called()

    @pytest.mark.asyncio
    async def test_get_aggregated_metrics(self, analytics_service, mock_collector):
        """Test getting aggregated metrics."""
        result = analytics_service.get_aggregated_metrics(
            aggregation_type="avg", time_window_seconds=3600
        )

        assert result is not None
        # Result has the full structure with counters, gauges, histograms
        assert "counters" in result
        assert "api_request" in result["counters"]
        mock_collector.get_metrics_summary.assert_called_once()

    @pytest.mark.asyncio
    async def test_track_api_request(self, analytics_service, mock_collector):
        """Test tracking API request metrics."""
        await analytics_service.track_api_request(endpoint="/users", method="GET", status_code=200)

        mock_collector.record_metric.assert_called_once()
        call_kwargs = mock_collector.record_metric.call_args[1]
        assert call_kwargs["name"] == "api_request"
        assert call_kwargs["value"] == 1

    @pytest.mark.asyncio
    async def test_track_circuit_breaker(self, analytics_service, mock_collector):
        """Test tracking circuit breaker state."""
        await analytics_service.track_circuit_breaker(service="user-service", state="open")

        mock_collector.record_metric.assert_called_once()
        call_kwargs = mock_collector.record_metric.call_args[1]
        assert call_kwargs["name"] == "circuit_breaker_state"

    @pytest.mark.asyncio
    async def test_track_rate_limit(self, analytics_service, mock_collector):
        """Test tracking rate limit metrics."""
        await analytics_service.track_rate_limit(user_id="user-123", remaining=50, limit=100)

        mock_collector.record_metric.assert_called_once()
        call_kwargs = mock_collector.record_metric.call_args[1]
        assert call_kwargs["name"] == "rate_limit"
        assert call_kwargs["value"] == 50


@pytest.mark.unit
class TestAnalyticsServiceEdgeCases:
    """Test edge cases and additional functionality."""

    @pytest.fixture
    def mock_collector(self):
        """Mock analytics collector."""
        collector = AsyncMock()
        collector.record_metric = AsyncMock()
        collector.get_metrics_summary = MagicMock(
            return_value={
                "counters": {"api_request": {"count": 100}},
                "gauges": {},
                "histograms": {},
                "timestamp": None,
                "service": None,
                "tenant": None,
            }
        )
        collector.flush = AsyncMock()
        return collector

    @pytest.fixture
    def analytics_service(self, mock_collector):
        return AnalyticsService(collector=mock_collector)

    @pytest.mark.asyncio
    async def test_query_events(self, analytics_service):
        """Test querying events."""
        # Add some events
        await analytics_service.track_event(event_type="user_login", user_id="user-1")
        await analytics_service.track_event(event_type="user_logout", user_id="user-2")
        await analytics_service.track_event(event_type="user_login", user_id="user-1")

        # Query all events
        all_events = await analytics_service.query_events(limit=10)
        assert len(all_events) == 3

        # Query by user_id
        user_events = await analytics_service.query_events(user_id="user-1")
        assert len(user_events) == 2
        assert all(e["user_id"] == "user-1" for e in user_events)

        # Query by event_type
        login_events = await analytics_service.query_events(event_type="user_login")
        assert len(login_events) == 2
        assert all(e["event_type"] == "user_login" for e in login_events)

    @pytest.mark.asyncio
    async def test_aggregate_data(self, analytics_service, mock_collector):
        """Test data aggregation."""
        # Add some events
        await analytics_service.track_event(event_type="user_login", user_id="user-1")
        await analytics_service.track_event(event_type="user_logout", user_id="user-2")

        result = await analytics_service.aggregate_data()

        assert "total_events" in result
        assert result["total_events"] == 2
        assert "metrics_summary" in result
        mock_collector.get_metrics_summary.assert_called()

    @pytest.mark.asyncio
    async def test_generate_report(self, analytics_service, mock_collector):
        """Test report generation."""
        # Add events
        await analytics_service.track_event(event_type="user_login", user_id="user-1")

        result = await analytics_service.generate_report(report_type="summary")

        assert result["type"] == "summary"
        assert "data" in result
        assert result["data"]["events_count"] == 1
        assert "metrics" in result["data"]
        mock_collector.get_metrics_summary.assert_called()

    @pytest.mark.asyncio
    async def test_get_dashboard_data(self, analytics_service, mock_collector):
        """Test getting dashboard data."""
        # Add events
        await analytics_service.track_event(event_type="user_login", user_id="user-1")
        await analytics_service.track_event(event_type="user_logout", user_id="user-2")

        result = await analytics_service.get_dashboard_data()

        assert "widgets" in result
        assert len(result["widgets"]) == 2
        assert result["widgets"][0]["type"] == "counter"
        assert result["widgets"][0]["value"] == 2
        mock_collector.get_metrics_summary.assert_called()

    @pytest.mark.asyncio
    async def test_close(self, analytics_service, mock_collector):
        """Test closing the analytics service."""
        await analytics_service.close()

        mock_collector.flush.assert_called_once()

    def test_create_request_span(self, analytics_service, mock_collector):
        """Test creating a request span for tracing."""
        attributes = {"http.method": "GET", "http.url": "/users"}

        analytics_service.create_request_span(
            endpoint="/users", method="GET", attributes=attributes
        )

        mock_collector.tracer.start_span.assert_called_once()
        call_kwargs = mock_collector.tracer.start_span.call_args[1]
        assert call_kwargs["name"] == "GET /users"
        assert call_kwargs["attributes"] == attributes


@pytest.mark.unit
class TestGetAnalyticsService:
    """Test get_analytics_service factory function."""

    @pytest.mark.asyncio
    async def test_get_analytics_service_default(self):
        """Test getting analytics service with default parameters."""
        with patch("dotmac.platform.analytics.service.create_otel_collector") as mock_create:
            mock_collector = AsyncMock()
            mock_create.return_value = mock_collector

            service = get_analytics_service()

            assert service is not None
            assert isinstance(service, AnalyticsService)
            mock_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_analytics_service_with_params(self):
        """Test getting analytics service with custom parameters."""
        with patch("dotmac.platform.analytics.service.create_otel_collector") as mock_create:
            mock_collector = AsyncMock()
            mock_create.return_value = mock_collector

            service = get_analytics_service(
                tenant_id="tenant-123",
                service_name="test-service",
                signoz_endpoint="http://signoz:4317",
            )

            assert service is not None
            mock_create.assert_called_once()
            call_kwargs = mock_create.call_args[1]
            assert call_kwargs["tenant_id"] == "tenant-123"
            assert "test-service-tenant-123" in call_kwargs["service_name"]

    @pytest.mark.asyncio
    async def test_get_analytics_service_caching(self):
        """Test that analytics service instances are cached."""
        with patch("dotmac.platform.analytics.service.create_otel_collector") as mock_create:
            mock_collector = AsyncMock()
            mock_create.return_value = mock_collector

            # First call
            service1 = get_analytics_service(tenant_id="tenant-123", service_name="test")
            # Second call with same params
            service2 = get_analytics_service(tenant_id="tenant-123", service_name="test")

            # Should be the same instance (same collector)
            assert service1.collector == service2.collector
            # create_otel_collector should only be called once due to caching
            assert mock_create.call_count == 1
