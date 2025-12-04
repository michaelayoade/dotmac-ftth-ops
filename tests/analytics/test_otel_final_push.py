"""
Final push to 90% coverage for analytics module.
Focuses on practical, testable paths in otel_collector.py and remaining base.py lines.
"""

import os
from unittest.mock import Mock, patch

import pytest

from dotmac.platform.analytics.base import BaseAnalyticsCollector, CounterMetric, Metric
from dotmac.platform.analytics.otel_collector import (
    OpenTelemetryCollector,
    OTelConfig,
    SimpleAnalyticsCollector,
    create_otel_collector,
)


@pytest.mark.unit
class TestOtelCollectorAdvanced:
    """Advanced tests for OpenTelemetryCollector to boost coverage."""

    @pytest.mark.asyncio
    async def test_collect_enriches_metric(self):
        """Test that collect() enriches metrics with tenant context."""
        # Use SimpleAnalyticsCollector for easier testing
        collector = SimpleAnalyticsCollector("tenant123", "service-name")

        metric = CounterMetric(name="test", delta=1.0, tenant_id="")  # No tenant

        await collector.collect(metric)

        # Check that metric was enriched
        assert collector.metrics_store[0].tenant_id == "tenant123"

    @pytest.mark.asyncio
    async def test_base_collector_flush_with_batch(self):
        """Test BaseAnalyticsCollector flush() calls collect_batch."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")

        # Add pending metrics
        m1 = CounterMetric(name="m1", delta=1.0, tenant_id="tenant1")
        m2 = CounterMetric(name="m2", delta=2.0, tenant_id="tenant1")
        collector.pending_metrics = [m1, m2]

        await collector.flush()

        # Should have called collect_batch
        assert len(collector.metrics_store) >= 2

    @pytest.mark.asyncio
    async def test_base_collector_close_calls_flush(self):
        """Test BaseAnalyticsCollector close() calls flush()."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")

        # Add pending metric
        metric = CounterMetric(name="test", delta=1.0, tenant_id="tenant1")
        collector.pending_metrics = [metric]

        await collector.close()

        # Flush should have been called, metrics stored
        assert len(collector.metrics_store) >= 1

    def test_simple_collector_get_metrics_summary(self):
        """Test SimpleAnalyticsCollector.get_metrics_summary()."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")

        # Add some metrics to summary
        collector._metrics_summary["counters"]["requests"] = 100
        collector._metrics_summary["gauges"]["cpu"] = {"value": 75.5, "labels": {}}

        summary = collector.get_metrics_summary()

        assert summary["tenant"] == "tenant1"
        assert summary["counters"]["requests"] == 100
        assert summary["gauges"]["cpu"]["value"] == 75.5

    def test_create_otel_collector_with_disabled_otel(self):
        """Test create_otel_collector when OpenTelemetry is disabled."""
        with patch("dotmac.platform.analytics.otel_collector.settings") as mock_settings:
            mock_settings.observability.otel_enabled = False

            collector = create_otel_collector("tenant1", "service1")

            assert isinstance(collector, SimpleAnalyticsCollector)
            assert collector.tenant_id == "tenant1"

    def test_create_otel_collector_with_custom_params(self):
        """Test create_otel_collector with custom endpoint and environment."""
        with (
            patch("dotmac.platform.analytics.otel_collector.settings") as mock_settings,
            patch("dotmac.platform.analytics.otel_collector.trace"),
            patch("dotmac.platform.analytics.otel_collector.metrics"),
            patch("dotmac.platform.analytics.otel_collector.Resource"),
        ):
            mock_settings.observability.otel_enabled = True

            collector = create_otel_collector(
                "tenant1",
                "service1",
                endpoint="otel.example.com:4317",
                environment="production",
            )

            # Should create a collector (type depends on mocking)
            assert collector.tenant_id == "tenant1"
            assert collector.service_name == "service1"

    @pytest.mark.asyncio
    async def test_opentelemetry_collector_without_meter(self):
        """Test OpenTelemetryCollector gracefully handles missing meter."""
        with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "1"}):
            config = OTelConfig(environment="test")
            collector = OpenTelemetryCollector("tenant1", "test-service", config)

            # Create metric
            metric = CounterMetric(name="test", delta=1.0, tenant_id="tenant1")

            # Should not crash even if meter is None
            await collector.collect(metric)

            # Check metrics summary still works
            summary = collector.get_metrics_summary()
            assert summary["tenant"] == "tenant1"

    def test_opentelemetry_collector_tracer_property(self):
        """Test OpenTelemetryCollector tracer property."""
        with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "1"}):
            config = OTelConfig(environment="test")
            collector = OpenTelemetryCollector("tenant1", "test-service", config)

            tracer = collector.tracer

            # Should have a tracer (either real or dummy)
            assert tracer is not None

    def test_opentelemetry_collector_create_span_basic(self):
        """Test OpenTelemetryCollector create_span with basic params."""
        with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "1"}):
            config = OTelConfig(environment="test")
            collector = OpenTelemetryCollector("tenant1", "test-service", config)

            span = collector.create_span("operation_name")

            assert span is not None

    def test_opentelemetry_collector_create_span_with_attributes(self):
        """Test OpenTelemetryCollector create_span with attributes."""
        with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "1"}):
            config = OTelConfig(environment="test")
            collector = OpenTelemetryCollector("tenant1", "test-service", config)

            span = collector.create_span("operation", attributes={"user_id": "123"})

            assert span is not None

    def test_opentelemetry_collector_record_exception(self):
        """Test OpenTelemetryCollector record_exception."""
        with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "1"}):
            config = OTelConfig(environment="test")
            collector = OpenTelemetryCollector("tenant1", "test-service", config)

            span = Mock()
            exception = ValueError("test error")

            # Should not crash
            collector.record_exception(span, exception)

    @pytest.mark.asyncio
    async def test_opentelemetry_collector_close(self):
        """Test OpenTelemetryCollector close."""
        with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "1"}):
            config = OTelConfig(environment="test")
            collector = OpenTelemetryCollector("tenant1", "test-service", config)

            # Should not crash
            await collector.close()

    def test_otel_config_headers_with_empty_key(self):
        """Test OTelConfig handles headers with empty keys."""
        config = OTelConfig(headers=" =value, key=value2")

        # Empty key should be ignored
        assert config.headers is not None
        assert "" not in config.headers
        assert config.headers.get("key") == "value2"

    def test_otel_config_headers_preserves_dict(self):
        """Test OTelConfig preserves dict headers."""
        headers_dict = {"Authorization": "Bearer token", "X-Custom": "value"}
        config = OTelConfig(headers=headers_dict)

        assert config.headers == headers_dict

    @pytest.mark.asyncio
    async def test_simple_collector_metrics_enrichment(self):
        """Test SimpleAnalyticsCollector enriches metrics."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")

        # Create metric without resource attributes
        metric = Metric(name="test", tenant_id="tenant1")
        assert metric.resource_attributes == {}

        await collector.collect(metric)

        # Check that stored metric has resource attributes
        stored = collector.metrics_store[0]
        assert stored.resource_attributes["service.name"] == "service1"
        assert stored.resource_attributes["tenant.id"] == "tenant1"

    @pytest.mark.asyncio
    async def test_record_metric_accumulation_counter(self):
        """Test record_metric accumulates counter values."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")

        await collector.record_metric("requests", 5, metric_type="counter")
        await collector.record_metric("requests", 3, metric_type="counter")

        # Should accumulate
        assert collector._metrics_summary["counters"]["requests"] == 8

    @pytest.mark.asyncio
    async def test_record_metric_overwrites_gauge(self):
        """Test record_metric overwrites gauge values."""
        collector = SimpleAnalyticsCollector("tenant1", "service1")

        await collector.record_metric("cpu", 50.0, metric_type="gauge")
        await collector.record_metric("cpu", 75.5, metric_type="gauge")

        # Should overwrite
        assert collector._metrics_summary["gauges"]["cpu"]["value"] == 75.5


@pytest.mark.unit
class TestBaseModuleFinalGaps:
    """Fill remaining gaps in base.py for 90% coverage."""

    def test_base_collector_flush_empty_pending(self):
        """Test flush with no pending metrics."""

        @pytest.mark.unit
        class TestCollector(BaseAnalyticsCollector):
            async def collect(self, metric):
                pass

            async def collect_batch(self, metrics):
                self.batch_called = True

            async def record_metric(self, **kwargs):
                pass

            def get_metrics_summary(self):
                return {}

            @property
            def tracer(self):
                return Mock()

        collector = TestCollector("tenant1", "service1")

        # No pending metrics
        import asyncio

        asyncio.run(collector.flush())

        # Should not crash
        assert not hasattr(collector, "batch_called")

    def test_base_collector_enrich_preserves_tenant(self):
        """Test _enrich_metric preserves existing tenant_id."""

        @pytest.mark.unit
        class TestCollector(BaseAnalyticsCollector):
            async def collect(self, metric):
                pass

            async def collect_batch(self, metrics):
                pass

            async def record_metric(self, **kwargs):
                pass

            def get_metrics_summary(self):
                return {}

            @property
            def tracer(self):
                return Mock()

        collector = TestCollector("tenant1", "service1")

        metric = Metric(name="test", tenant_id="original_tenant")
        enriched = collector._enrich_metric(metric)

        # Should keep original tenant
        assert enriched.tenant_id == "original_tenant"

    def test_base_collector_enrich_adds_tenant(self):
        """Test _enrich_metric adds tenant_id when missing."""

        @pytest.mark.unit
        class TestCollector(BaseAnalyticsCollector):
            async def collect(self, metric):
                pass

            async def collect_batch(self, metrics):
                pass

            async def record_metric(self, **kwargs):
                pass

            def get_metrics_summary(self):
                return {}

            @property
            def tracer(self):
                return Mock()

        collector = TestCollector("tenant1", "service1")

        metric = Metric(name="test", tenant_id="")
        enriched = collector._enrich_metric(metric)

        # Should add collector's tenant
        assert enriched.tenant_id == "tenant1"
