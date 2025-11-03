"""
Simple tests for Analytics module to improve coverage.

Tests core analytics functionality with actual available classes.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from dotmac.platform.analytics.base import (
    BaseAnalyticsCollector,
    CounterMetric,
    GaugeMetric,
    HistogramMetric,
    Metric,
    MetricRegistry,
    MetricType,
    SpanContext,
)
from dotmac.platform.analytics.service import AnalyticsService


@pytest.mark.unit
class TestAnalyticsBaseClasses:
    """Test base analytics classes and models."""

    def test_metric_type_enum(self):
        """Test MetricType enum values."""
        assert MetricType.COUNTER == "counter"
        assert MetricType.GAUGE == "gauge"
        assert MetricType.HISTOGRAM == "histogram"
        assert MetricType.SUMMARY == "summary"
        assert MetricType.UPDOWN_COUNTER == "updown_counter"
        assert MetricType.EXPONENTIAL_HISTOGRAM == "exponential_histogram"

    def test_span_context_creation(self):
        """Test SpanContext dataclass."""
        context = SpanContext(
            trace_id="trace123",
            span_id="span456",
            parent_span_id="parent789",
            trace_flags=1,
            trace_state={"key": "value"},
        )

        assert context.trace_id == "trace123"
        assert context.span_id == "span456"
        assert context.parent_span_id == "parent789"
        assert context.trace_flags == 1
        assert context.trace_state == {"key": "value"}

    def test_span_context_defaults(self):
        """Test SpanContext with default values."""
        context = SpanContext(trace_id="trace123", span_id="span456")

        assert context.trace_id == "trace123"
        assert context.span_id == "span456"
        assert context.parent_span_id is None
        assert context.trace_flags == 0
        assert context.trace_state is None

    def test_metric_creation(self):
        """Test Metric dataclass."""
        now = datetime.now(UTC)
        metric = Metric(
            tenant_id="tenant123",
            timestamp=now,
            name="api_requests",
            type=MetricType.COUNTER,
            value=42,
            unit="count",
            description="API request counter",
            attributes={"endpoint": "/api/users"},
            resource_attributes={"service": "api"},
        )

        assert metric.tenant_id == "tenant123"
        assert metric.timestamp == now
        assert metric.name == "api_requests"
        assert metric.type == MetricType.COUNTER
        assert metric.value == 42
        assert metric.unit == "count"
        assert metric.description == "API request counter"
        assert metric.attributes == {"endpoint": "/api/users"}
        assert metric.resource_attributes == {"service": "api"}

    def test_metric_defaults(self):
        """Test Metric with default values."""
        metric = Metric()

        assert isinstance(metric.id, type(uuid4()))
        assert metric.tenant_id == ""
        assert isinstance(metric.timestamp, datetime)
        assert metric.name == ""
        assert metric.type == MetricType.GAUGE
        assert metric.value == 0
        assert metric.unit is None
        assert metric.description is None
        assert metric.attributes == {}
        assert metric.resource_attributes == {}
        assert metric.span_context is None

    def test_metric_to_otel_attributes(self):
        """Test metric OpenTelemetry attributes conversion."""
        metric = Metric(
            tenant_id="tenant123",
            attributes={
                "endpoint_name": "/api/users",
                "method": "GET",
                "count": 5,
                "success": True,
            },
        )

        otel_attrs = metric.to_otel_attributes()

        assert otel_attrs["tenant.id"] == "tenant123"
        assert otel_attrs["metric.id"] == str(metric.id)
        assert otel_attrs["endpoint.name"] == "/api/users"
        assert otel_attrs["method"] == "GET"
        assert otel_attrs["count"] == 5
        assert otel_attrs["success"] is True

    def test_counter_metric(self):
        """Test CounterMetric with positive delta."""
        counter = CounterMetric(name="requests", delta=5.0, tenant_id="tenant123")

        assert counter.type == MetricType.COUNTER
        assert counter.delta == 5.0
        assert counter.name == "requests"

    def test_counter_metric_negative_delta(self):
        """Test CounterMetric rejects negative delta."""
        with pytest.raises(ValueError, match="Counter delta must be non-negative"):
            CounterMetric(name="requests", delta=-1.0)

    def test_gauge_metric(self):
        """Test GaugeMetric creation."""
        gauge = GaugeMetric(name="temperature", value=23.5, unit="celsius")

        assert gauge.type == MetricType.GAUGE
        assert gauge.value == 23.5
        assert gauge.unit == "celsius"

    def test_histogram_metric(self):
        """Test HistogramMetric creation."""
        histogram = HistogramMetric(name="request_duration", unit="seconds")

        assert histogram.type == MetricType.HISTOGRAM
        assert len(histogram.bucket_boundaries) > 0
        assert histogram.bucket_boundaries[0] == 0.005

        # Test recording value
        histogram.record_value(0.150)
        assert histogram.value == 0.150

    def test_histogram_metric_custom_boundaries(self):
        """Test HistogramMetric with custom bucket boundaries."""
        boundaries = [0.1, 0.5, 1.0, 5.0]
        histogram = HistogramMetric(name="custom_duration", bucket_boundaries=boundaries)

        assert histogram.bucket_boundaries == boundaries

    def test_base_analytics_collector_abstract(self):
        """Test BaseAnalyticsCollector is abstract."""
        from abc import ABC

        assert issubclass(BaseAnalyticsCollector, ABC)

        # Should not be able to instantiate directly
        with pytest.raises(TypeError):
            BaseAnalyticsCollector("tenant", "service")


@pytest.mark.unit
class TestMetricRegistry:
    """Test MetricRegistry functionality."""

    @pytest.fixture
    def registry(self):
        return MetricRegistry()

    def test_registry_initialization(self, registry):
        """Test registry initializes empty."""
        assert len(registry._metrics) == 0

    def test_register_metric(self, registry):
        """Test registering a metric definition."""
        registry.register(
            name="api_requests",
            type=MetricType.COUNTER,
            unit="count",
            description="Number of API requests",
            attributes=["endpoint", "method"],
        )

        definition = registry.get("api_requests")
        assert definition is not None
        assert definition["type"] == MetricType.COUNTER
        assert definition["unit"] == "count"
        assert definition["description"] == "Number of API requests"
        assert definition["attributes"] == ["endpoint", "method"]

    def test_register_metric_minimal(self, registry):
        """Test registering metric with minimal info."""
        registry.register(name="simple_metric", type=MetricType.GAUGE)

        definition = registry.get("simple_metric")
        assert definition is not None
        assert definition["type"] == MetricType.GAUGE
        assert definition["unit"] is None
        assert definition["description"] is None
        assert definition["attributes"] == []

    def test_get_nonexistent_metric(self, registry):
        """Test getting non-existent metric definition."""
        definition = registry.get("nonexistent")
        assert definition is None

    def test_validate_metric_valid(self, registry):
        """Test validating a valid metric."""
        registry.register(
            name="api_requests", type=MetricType.COUNTER, attributes=["endpoint", "method"]
        )

        metric = CounterMetric(
            name="api_requests",
            attributes={"endpoint": "/api/users", "method": "GET", "extra": "allowed"},
        )

        assert registry.validate(metric) is True

    def test_validate_metric_wrong_type(self, registry):
        """Test validating metric with wrong type."""
        registry.register(name="api_requests", type=MetricType.COUNTER)

        metric = GaugeMetric(name="api_requests")  # Wrong type
        assert registry.validate(metric) is False

    def test_validate_metric_missing_attributes(self, registry):
        """Test validating metric missing required attributes."""
        registry.register(
            name="api_requests", type=MetricType.COUNTER, attributes=["endpoint", "method"]
        )

        metric = CounterMetric(
            name="api_requests",
            attributes={"endpoint": "/api/users"},  # Missing method
        )

        assert registry.validate(metric) is False

    def test_validate_unregistered_metric(self, registry):
        """Test validating unregistered metric (should pass)."""
        metric = Metric(name="unregistered_metric")
        assert registry.validate(metric) is True


@pytest.mark.unit
class TestAnalyticsService:
    """Test AnalyticsService functionality."""

    @pytest.fixture
    def mock_collector(self):
        """Create mock analytics collector."""
        collector = Mock()
        collector.record_metric = AsyncMock()
        collector.get_metrics_summary = Mock(return_value={"total_metrics": 10})
        return collector

    @pytest.fixture
    def analytics_service(self, mock_collector):
        """Create AnalyticsService with mock collector."""
        return AnalyticsService(collector=mock_collector)

    def test_service_initialization_with_collector(self, mock_collector):
        """Test service initialization with provided collector."""
        service = AnalyticsService(collector=mock_collector)
        assert service.collector == mock_collector
        assert service._events_store == []

    def test_service_initialization_default_collector(self):
        """Test service initialization with default collector."""
        with patch("dotmac.platform.analytics.service.create_otel_collector") as mock_create:
            mock_collector = Mock()
            mock_create.return_value = mock_collector

            service = AnalyticsService()

            mock_create.assert_called_once_with(tenant_id="default", service_name="platform")
            assert service.collector == mock_collector

    @pytest.mark.asyncio
    async def test_track_api_request(self, analytics_service, mock_collector):
        """Test tracking API requests."""
        await analytics_service.track_api_request(
            endpoint="/api/users", method="GET", status_code=200
        )

        mock_collector.record_metric.assert_called_once_with(
            name="api_request",
            value=1,
            metric_type="counter",
            labels={"endpoint": "/api/users", "method": "GET", "status_code": 200},
        )

    @pytest.mark.asyncio
    async def test_track_circuit_breaker(self, analytics_service, mock_collector):
        """Test tracking circuit breaker state."""
        await analytics_service.track_circuit_breaker(
            service="user-service", state="open", failure_count=5
        )

        mock_collector.record_metric.assert_called_once_with(
            name="circuit_breaker_state",
            value=1,
            metric_type="gauge",
            labels={"service": "user-service", "state": "open", "failure_count": 5},
        )

    @pytest.mark.asyncio
    async def test_track_rate_limit(self, analytics_service, mock_collector):
        """Test tracking rate limit metrics."""
        await analytics_service.track_rate_limit(client_id="client123", remaining=45, limit=100)

        mock_collector.record_metric.assert_called_once_with(
            name="rate_limit",
            value=45,  # Uses remaining value
            metric_type="gauge",
            labels={"client_id": "client123", "remaining": 45, "limit": 100},
        )

    @pytest.mark.asyncio
    async def test_track_rate_limit_no_remaining(self, analytics_service, mock_collector):
        """Test tracking rate limit without remaining value."""
        await analytics_service.track_rate_limit(client_id="client123", limit=100)

        mock_collector.record_metric.assert_called_once_with(
            name="rate_limit",
            value=0,  # Defaults to 0 when no remaining
            metric_type="gauge",
            labels={"client_id": "client123", "limit": 100},
        )

    def test_get_aggregated_metrics(self, analytics_service, mock_collector):
        """Test getting aggregated metrics."""
        result = analytics_service.get_aggregated_metrics(
            aggregation_type="sum", time_window_seconds=300
        )

        assert result == {"total_metrics": 10}
        mock_collector.get_metrics_summary.assert_called_once()

    @pytest.mark.asyncio
    async def test_track_event(self, analytics_service):
        """Test tracking analytics events."""
        event_data = {
            "event_type": "user_login",
            "user_id": "user123",
            "timestamp": datetime.now(UTC).isoformat(),
        }

        event_id = await analytics_service.track_event(**event_data)

        assert event_id == "event_1"
        assert len(analytics_service._events_store) == 1

        stored_event = analytics_service._events_store[0]
        assert stored_event["event_type"] == "user_login"
        assert stored_event["user_id"] == "user123"
        assert stored_event["event_id"] == event_id

    @pytest.mark.asyncio
    async def test_track_multiple_events(self, analytics_service):
        """Test tracking multiple events."""
        # Track first event
        event_id_1 = await analytics_service.track_event(event_type="user_login", user_id="user123")

        # Track second event
        event_id_2 = await analytics_service.track_event(
            event_type="user_logout", user_id="user123"
        )

        assert event_id_1 == "event_1"
        assert event_id_2 == "event_2"
        assert len(analytics_service._events_store) == 2


@pytest.mark.unit
class TestAnalyticsServiceUtilities:
    """Test analytics service utility functions."""

    def test_service_factory_functions_exist(self):
        """Test that service can be created directly."""
        # Test direct instantiation works
        service1 = AnalyticsService()
        assert isinstance(service1, AnalyticsService)

        service2 = AnalyticsService()
        assert isinstance(service2, AnalyticsService)

        # Should be separate instances
        assert service1 is not service2


@pytest.mark.unit
class TestAnalyticsErrorHandling:
    """Test error handling in analytics components."""

    def test_invalid_counter_delta(self):
        """Test counter with invalid delta."""
        with pytest.raises(ValueError):
            CounterMetric(name="test", delta=-1.0)

    @pytest.mark.asyncio
    async def test_service_with_failing_collector(self):
        """Test service behavior when collector fails."""
        failing_collector = Mock()
        failing_collector.record_metric = AsyncMock(side_effect=Exception("Collector failed"))

        service = AnalyticsService(collector=failing_collector)

        # Service should propagate collector exceptions
        with pytest.raises(Exception, match="Collector failed"):
            await service.track_api_request(endpoint="/test")

    def test_metric_with_complex_attributes(self):
        """Test metric with various attribute types."""
        metric = Metric(
            name="complex_metric",
            attributes={
                "string_attr": "value",
                "int_attr": 42,
                "float_attr": 3.14,
                "bool_attr": True,
                "none_attr": None,
                "list_attr": [1, 2, 3],
                "dict_attr": {"nested": "value"},
            },
        )

        otel_attrs = metric.to_otel_attributes()

        # Simple types should be preserved
        assert otel_attrs["string.attr"] == "value"
        assert otel_attrs["int.attr"] == 42
        assert otel_attrs["float.attr"] == 3.14
        assert otel_attrs["bool.attr"] is True

        # Complex types should be stringified
        assert otel_attrs["none.attr"] == "None"
        assert otel_attrs["list.attr"] == "[1, 2, 3]"
        assert "nested" in otel_attrs["dict.attr"]

    @pytest.mark.asyncio
    async def test_track_event_with_large_payload(self):
        """Test tracking event with large data."""
        service = AnalyticsService(collector=Mock())

        large_data = {
            "event_type": "bulk_operation",
            "data": "x" * 1000,
            "items": list(range(50)),
            "metadata": {"key" + str(i): f"value{i}" for i in range(20)},
        }

        event_id = await service.track_event(**large_data)

        assert event_id == "event_1"
        assert len(service._events_store) == 1

        stored_event = service._events_store[0]
        assert stored_event["data"] == "x" * 1000
        assert len(stored_event["items"]) == 50
        assert len(stored_event["metadata"]) == 20

    def test_histogram_boundaries_validation(self):
        """Test histogram with various boundary configurations."""
        # Empty boundaries should work
        histogram = HistogramMetric(name="test", bucket_boundaries=[])
        assert histogram.bucket_boundaries == []

        # Single boundary
        histogram = HistogramMetric(name="test", bucket_boundaries=[1.0])
        assert histogram.bucket_boundaries == [1.0]

        # Multiple boundaries
        boundaries = [0.1, 0.5, 1.0, 2.0, 5.0]
        histogram = HistogramMetric(name="test", bucket_boundaries=boundaries)
        assert histogram.bucket_boundaries == boundaries

    def test_metric_enrichment_concept(self):
        """Test the concept of metric enrichment (via BaseAnalyticsCollector)."""
        # Since BaseAnalyticsCollector is abstract, test the enrichment logic concept

        # Create a minimal concrete implementation for testing
        @pytest.mark.unit
        class TestCollector(BaseAnalyticsCollector):
            async def collect(self, metric):
                pass

            async def collect_batch(self, metrics):
                pass

            async def record_metric(
                self, name, value, metric_type="gauge", labels=None, unit=None, description=None
            ):
                pass

            def get_metrics_summary(self):
                return {}

            @property
            def tracer(self):
                return None

        collector = TestCollector("test-tenant", "test-service")

        # Test enrichment
        metric = Metric(name="test_metric")
        enriched = collector._enrich_metric(metric)

        assert enriched.tenant_id == "test-tenant"
        assert enriched.resource_attributes["service.name"] == "test-service"
        assert enriched.resource_attributes["tenant.id"] == "test-tenant"

        # Test enrichment preserves existing tenant_id
        metric_with_tenant = Metric(name="test_metric", tenant_id="existing-tenant")
        enriched = collector._enrich_metric(metric_with_tenant)
        assert enriched.tenant_id == "existing-tenant"  # Should preserve existing
