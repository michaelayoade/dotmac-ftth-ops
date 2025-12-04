"""
Targeted tests to boost analytics module coverage to 90%.
Focuses on untested code paths in otel_collector.py, base.py, and service.py.
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest

from dotmac.platform.analytics.base import (
    CounterMetric,
    GaugeMetric,
    HistogramMetric,
    Metric,
    MetricRegistry,
    MetricType,
    SpanContext,
)
from dotmac.platform.analytics.otel_collector import (
    DummySpan,
    DummyTracer,
    OTelConfig,
    SimpleAnalyticsCollector,
)
from dotmac.platform.analytics.service import AnalyticsService, get_analytics_service


@pytest.mark.unit
class TestBaseModule:
    """Tests for base.py missing coverage."""

    def test_counter_metric_negative_delta_raises_error(self):
        """Test CounterMetric rejects negative delta."""
        with pytest.raises(ValueError, match="Counter delta must be non-negative"):
            CounterMetric(name="test", delta=-1.0, tenant_id="tenant1")

    def test_histogram_record_value(self):
        """Test HistogramMetric.record_value."""
        metric = HistogramMetric(name="test", value=10.0, tenant_id="tenant1")
        metric.record_value(42.5)
        assert metric.value == 42.5

    def test_metric_to_otel_attributes_complex_values(self):
        """Test attribute conversion handles complex types."""
        metric = Metric(
            tenant_id="tenant1",
            attributes={
                "string": "value",
                "int": 42,
                "float": 3.14,
                "bool": True,
                "dict": {"nested": "object"},
                "list": [1, 2, 3],
            },
        )
        attrs = metric.to_otel_attributes()

        assert attrs["string"] == "value"
        assert attrs["int"] == 42
        assert attrs["float"] == 3.14
        assert attrs["bool"] is True
        assert isinstance(attrs["dict"], str)  # Converted to string
        assert isinstance(attrs["list"], str)  # Converted to string

    def test_metric_registry_validate_wrong_type(self):
        """Test MetricRegistry.validate rejects wrong metric type."""
        registry = MetricRegistry()
        registry.register("test_metric", MetricType.COUNTER)

        wrong_metric = GaugeMetric(name="test_metric", value=1.0, tenant_id="tenant1")
        assert registry.validate(wrong_metric) is False

    def test_metric_registry_validate_missing_attributes(self):
        """Test MetricRegistry.validate rejects missing required attributes."""
        registry = MetricRegistry()
        registry.register("test", MetricType.COUNTER, attributes=["required_attr"])

        metric = CounterMetric(name="test", delta=1.0, tenant_id="tenant1", attributes={})
        assert registry.validate(metric) is False

    def test_metric_registry_validate_unregistered(self):
        """Test MetricRegistry.validate allows unregistered metrics."""
        registry = MetricRegistry()
        metric = Metric(name="unregistered", tenant_id="tenant1")
        assert registry.validate(metric) is True

    def test_span_context_full_initialization(self):
        """Test SpanContext with all fields."""
        ctx = SpanContext(
            trace_id="trace123",
            span_id="span456",
            parent_span_id="parent789",
            trace_flags=1,
            trace_state={"key": "value"},
        )
        assert ctx.trace_id == "trace123"
        assert ctx.span_id == "span456"
        assert ctx.parent_span_id == "parent789"
        assert ctx.trace_flags == 1
        assert ctx.trace_state == {"key": "value"}


@pytest.mark.unit
class TestOtelCollectorModule:
    """Tests for otel_collector.py missing coverage."""

    def test_otel_config_header_parsing(self):
        """Test OTelConfig parses headers from string."""
        config = OTelConfig(headers="key1=value1,key2=value2,invalid,key3=value3")
        assert isinstance(config.headers, dict)
        assert config.headers["key1"] == "value1"
        assert config.headers["key2"] == "value2"
        assert config.headers["key3"] == "value3"

    def test_otel_config_empty_headers(self):
        """Test OTelConfig with empty headers string."""
        config = OTelConfig(headers="")
        assert config.headers is None

    def test_otel_config_signoz_endpoint_priority(self):
        """Test signoz_endpoint takes precedence."""
        config = OTelConfig(
            signoz_endpoint="signoz.example.com:4317",
            otlp_endpoint="otlp.example.com:4317",
        )
        assert config.endpoint == "signoz.example.com:4317"

    def test_otel_config_otlp_endpoint_fallback(self):
        """Test otlp_endpoint used when signoz_endpoint not set."""
        config = OTelConfig(otlp_endpoint="otlp.example.com:4317")
        assert config.endpoint == "otlp.example.com:4317"

    @pytest.mark.asyncio
    async def test_simple_collector_collect(self):
        """Test SimpleAnalyticsCollector.collect."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")
        metric = CounterMetric(name="test", delta=1.0, tenant_id="tenant1")

        await collector.collect(metric)

        assert len(collector.metrics_store) == 1
        assert collector.metrics_store[0].tenant_id == "tenant1"

    @pytest.mark.asyncio
    async def test_simple_collector_collect_batch(self):
        """Test SimpleAnalyticsCollector.collect_batch."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")
        metrics = [
            CounterMetric(name="m1", delta=1.0, tenant_id="tenant1"),
            GaugeMetric(name="m2", value=10.0, tenant_id="tenant1"),
        ]

        await collector.collect_batch(metrics)

        assert len(collector.metrics_store) == 2

    @pytest.mark.asyncio
    async def test_simple_collector_record_metric_counter(self):
        """Test SimpleAnalyticsCollector.record_metric for counter."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")

        await collector.record_metric(
            name="requests",
            value=5,
            metric_type="counter",
            labels={"endpoint": "/api"},
        )

        assert collector._metrics_summary["counters"]["requests"] == 5

    @pytest.mark.asyncio
    async def test_simple_collector_record_metric_gauge(self):
        """Test SimpleAnalyticsCollector.record_metric for gauge."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")

        await collector.record_metric(
            name="cpu",
            value=75.5,
            metric_type="gauge",
            labels={"host": "server1"},
        )

        assert "cpu" in collector._metrics_summary["gauges"]
        assert collector._metrics_summary["gauges"]["cpu"]["value"] == 75.5

    def test_simple_collector_tracer_returns_dummy(self):
        """Test SimpleAnalyticsCollector.tracer returns DummyTracer."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")
        assert isinstance(collector.tracer, DummyTracer)

    def test_simple_collector_create_span(self):
        """Test SimpleAnalyticsCollector.create_span."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")
        span = collector.create_span("operation", attributes={"key": "value"})

        assert isinstance(span, DummySpan)
        assert span.name == "operation"

    def test_simple_collector_record_exception(self):
        """Test SimpleAnalyticsCollector.record_exception is no-op."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")
        span = Mock()
        # Should not raise
        collector.record_exception(span, ValueError("test"))

    def test_dummy_tracer_start_span(self):
        """Test DummyTracer.start_span."""
        tracer = DummyTracer()
        span = tracer.start_span("test", attributes={"key": "value"})

        assert isinstance(span, DummySpan)
        assert span.name == "test"
        assert span.attributes["key"] == "value"

    def test_dummy_span_context_manager(self):
        """Test DummySpan as context manager."""
        span = DummySpan("operation")
        with span as s:
            assert s is span

    def test_dummy_span_set_attribute(self):
        """Test DummySpan.set_attribute."""
        span = DummySpan("operation")
        span.set_attribute("key", "value")
        assert span.attributes["key"] == "value"

    def test_dummy_span_set_status(self):
        """Test DummySpan.set_status is no-op."""
        span = DummySpan("operation")
        span.set_status(Mock())  # Should not raise

    def test_dummy_span_record_exception(self):
        """Test DummySpan.record_exception is no-op."""
        span = DummySpan("operation")
        span.record_exception(ValueError("test"))  # Should not raise


@pytest.mark.unit
class TestServiceModule:
    """Tests for service.py missing coverage."""

    @pytest.fixture
    def mock_collector(self):
        """Create mock collector."""
        collector = Mock()
        collector.record_metric = AsyncMock()
        collector.get_metrics_summary = Mock(
            return_value={"counters": {}, "gauges": {}, "histograms": {}}
        )
        collector.flush = AsyncMock()
        collector.tracer = Mock()
        collector.tracer.start_span = Mock(return_value=Mock())
        return collector

    @pytest.mark.asyncio
    async def test_track_api_request(self, mock_collector):
        """Test AnalyticsService.track_api_request."""
        service = AnalyticsService(collector=mock_collector)

        await service.track_api_request(endpoint="/api/users", method="GET", status=200)

        mock_collector.record_metric.assert_called_once()
        call_kwargs = mock_collector.record_metric.call_args[1]
        assert call_kwargs["name"] == "api_request"
        assert call_kwargs["value"] == 1

    @pytest.mark.asyncio
    async def test_track_circuit_breaker(self, mock_collector):
        """Test AnalyticsService.track_circuit_breaker."""
        service = AnalyticsService(collector=mock_collector)

        await service.track_circuit_breaker(service_name="payment", state="open")

        mock_collector.record_metric.assert_called_once()

    @pytest.mark.asyncio
    async def test_track_rate_limit(self, mock_collector):
        """Test AnalyticsService.track_rate_limit."""
        service = AnalyticsService(collector=mock_collector)

        await service.track_rate_limit(user_id="user123", remaining=45)

        call_kwargs = mock_collector.record_metric.call_args[1]
        assert call_kwargs["value"] == 45

    @pytest.mark.asyncio
    async def test_track_rate_limit_no_remaining(self, mock_collector):
        """Test track_rate_limit without remaining count."""
        service = AnalyticsService(collector=mock_collector)

        await service.track_rate_limit(user_id="user123")

        call_kwargs = mock_collector.record_metric.call_args[1]
        assert call_kwargs["value"] == 0

    @pytest.mark.asyncio
    async def test_track_event(self, mock_collector):
        """Test AnalyticsService.track_event."""
        service = AnalyticsService(collector=mock_collector)

        event_id = await service.track_event(event_type="login", user_id="user123")

        assert event_id == "event_1"
        assert len(service._events_store) == 1

    @pytest.mark.asyncio
    async def test_record_metric(self, mock_collector):
        """Test AnalyticsService.record_metric."""
        service = AnalyticsService(collector=mock_collector)

        await service.record_metric(metric_name="custom", value=42.5, tags={"source": "test"})

        mock_collector.record_metric.assert_called_once()

    @pytest.mark.asyncio
    async def test_query_events_with_filters(self, mock_collector):
        """Test AnalyticsService.query_events with filters."""
        service = AnalyticsService(collector=mock_collector)

        await service.track_event(event_type="login", user_id="user1")
        await service.track_event(event_type="logout", user_id="user2")
        await service.track_event(event_type="login", user_id="user1")

        events = await service.query_events(user_id="user1")
        assert len(events) == 2

        events = await service.query_events(event_type="login")
        assert len(events) == 2

    @pytest.mark.asyncio
    async def test_aggregate_data(self, mock_collector):
        """Test AnalyticsService.aggregate_data."""
        service = AnalyticsService(collector=mock_collector)

        await service.track_event(event_type="test")
        result = await service.aggregate_data()

        assert result["total_events"] == 1
        assert "metrics_summary" in result

    @pytest.mark.asyncio
    async def test_generate_report(self, mock_collector):
        """Test AnalyticsService.generate_report."""
        service = AnalyticsService(collector=mock_collector)

        report = await service.generate_report(report_type="summary")

        assert report["type"] == "summary"
        assert "data" in report

    @pytest.mark.asyncio
    async def test_get_dashboard_data(self, mock_collector):
        """Test AnalyticsService.get_dashboard_data."""
        service = AnalyticsService(collector=mock_collector)

        dashboard = await service.get_dashboard_data()

        assert "widgets" in dashboard
        assert len(dashboard["widgets"]) == 2

    @pytest.mark.asyncio
    async def test_close(self, mock_collector):
        """Test AnalyticsService.close."""
        service = AnalyticsService(collector=mock_collector)

        await service.close()

        mock_collector.flush.assert_called_once()

    def test_create_request_span(self, mock_collector):
        """Test AnalyticsService.create_request_span."""
        service = AnalyticsService(collector=mock_collector)

        span = service.create_request_span("/api/users", "GET", {"user_id": "123"})

        assert span is not None
        mock_collector.tracer.start_span.assert_called_once()

    def test_get_analytics_service_default(self):
        """Test get_analytics_service with defaults."""
        from dotmac.platform.analytics import service as service_module

        service_module._analytics_instances.clear()

        try:
            with patch("dotmac.platform.analytics.service.create_otel_collector") as mock_create:
                mock_collector = Mock()
                mock_create.return_value = mock_collector
                svc = get_analytics_service()

                assert isinstance(svc, AnalyticsService)
                mock_create.assert_called_once()
        finally:
            service_module._analytics_instances.clear()

    def test_get_analytics_service_caching(self):
        """Test get_analytics_service caches instances."""
        from dotmac.platform.analytics import service as service_module

        service_module._analytics_instances.clear()

        try:
            with patch("dotmac.platform.analytics.service.create_otel_collector") as mock_create:
                mock_collector = Mock()
                mock_create.return_value = mock_collector

                svc1 = get_analytics_service(tenant_id="tenant1", service_name="test")
                svc2 = get_analytics_service(tenant_id="tenant1", service_name="test")

                assert svc1.collector is svc2.collector
                mock_create.assert_called_once()
        finally:
            service_module._analytics_instances.clear()
