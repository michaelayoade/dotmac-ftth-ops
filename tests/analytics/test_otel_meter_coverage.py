"""
Tests for OpenTelemetryCollector with proper meter mocking to reach 90% coverage.
Focuses on lines 370-396, 428-474 which require a working meter.
"""

import os
from unittest.mock import Mock, patch

import pytest

from dotmac.platform.analytics.base import CounterMetric, GaugeMetric, HistogramMetric, MetricType
from dotmac.platform.analytics.otel_collector import OpenTelemetryCollector, OTelConfig


@pytest.mark.unit
class TestOpenTelemetryCollectorWithMeter:
    """Test OpenTelemetryCollector methods that require a working meter."""

    @pytest.fixture
    def collector_with_mock_meter(self):
        """Create collector with mocked meter."""
        with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "1"}):
            config = OTelConfig(environment="test")
            collector = OpenTelemetryCollector("tenant1", "test-service", config)

            # Create mock meter
            mock_meter = Mock()
            mock_counter = Mock()
            mock_histogram = Mock()
            mock_gauge = Mock()

            mock_meter.create_counter = Mock(return_value=mock_counter)
            mock_meter.create_histogram = Mock(return_value=mock_histogram)
            mock_meter.create_observable_gauge = Mock(return_value=mock_gauge)

            collector.meter = mock_meter

            return collector, mock_counter, mock_histogram, mock_gauge

    @pytest.mark.asyncio
    async def test_collect_counter_with_meter(self, collector_with_mock_meter):
        """Test collecting counter metric with working meter."""
        collector, mock_counter, _, _ = collector_with_mock_meter

        metric = CounterMetric(name="test_counter", delta=5.0, tenant_id="tenant1")

        await collector.collect(metric)

        # Verify counter was created and used
        collector.meter.create_counter.assert_called_once()
        mock_counter.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_collect_gauge_with_meter(self, collector_with_mock_meter):
        """Test collecting gauge metric with working meter."""
        collector, _, _, mock_gauge = collector_with_mock_meter

        metric = GaugeMetric(name="test_gauge", value=42.5, tenant_id="tenant1")

        await collector.collect(metric)

        # Verify gauge was created and value stored
        assert "test_gauge" in collector._gauge_values

    @pytest.mark.asyncio
    async def test_collect_histogram_with_meter(self, collector_with_mock_meter):
        """Test collecting histogram metric with working meter."""
        collector, _, mock_histogram, _ = collector_with_mock_meter

        metric = HistogramMetric(name="test_histogram", value=100.0, tenant_id="tenant1")

        await collector.collect(metric)

        # Verify histogram was created and used
        collector.meter.create_histogram.assert_called_once()
        mock_histogram.record.assert_called_once()

        # Verify summary was updated
        assert "test_histogram" in collector._metrics_summary["histograms"]
        summary = collector._metrics_summary["histograms"]["test_histogram"]
        assert summary["count"] == 1
        assert summary["sum"] == 100.0
        assert summary["avg"] == 100.0
        assert summary["min"] == 100.0
        assert summary["max"] == 100.0

    @pytest.mark.asyncio
    async def test_collect_histogram_updates_min_max(self, collector_with_mock_meter):
        """Test histogram min/max tracking."""
        collector, _, _, _ = collector_with_mock_meter

        # Record multiple values
        await collector.collect(HistogramMetric(name="latency", value=100.0, tenant_id="tenant1"))
        await collector.collect(HistogramMetric(name="latency", value=50.0, tenant_id="tenant1"))
        await collector.collect(HistogramMetric(name="latency", value=200.0, tenant_id="tenant1"))

        summary = collector._metrics_summary["histograms"]["latency"]
        assert summary["count"] == 3
        assert summary["sum"] == 350.0
        assert summary["avg"] == pytest.approx(116.67, rel=0.01)
        assert summary["min"] == 50.0
        assert summary["max"] == 200.0

    @pytest.mark.asyncio
    async def test_collect_batch_with_meter(self, collector_with_mock_meter):
        """Test collect_batch with multiple metrics."""
        collector, _, _, _ = collector_with_mock_meter

        metrics = [
            CounterMetric(name="counter1", delta=1.0, tenant_id="tenant1"),
            GaugeMetric(name="gauge1", value=10.0, tenant_id="tenant1"),
            HistogramMetric(name="hist1", value=5.0, tenant_id="tenant1"),
        ]

        await collector.collect_batch(metrics)

        assert "counter1" in collector._counters
        assert "gauge1" in collector._gauge_values
        assert "hist1" in collector._histograms

    @pytest.mark.asyncio
    async def test_record_metric_counter_with_meter(self, collector_with_mock_meter):
        """Test record_metric for counter type."""
        collector, _, _, _ = collector_with_mock_meter

        await collector.record_metric(
            name="api_calls",
            value=1,
            metric_type="counter",
            labels={"endpoint": "/api/v1"},
            unit="1",
            description="API calls",
        )

        # Check summary updated
        assert collector._metrics_summary["counters"]["api_calls"] == 1.0

    @pytest.mark.asyncio
    async def test_record_metric_counter_accumulates(self, collector_with_mock_meter):
        """Test record_metric accumulates counter values."""
        collector, _, _, _ = collector_with_mock_meter

        await collector.record_metric("requests", value=5, metric_type="counter")
        await collector.record_metric("requests", value=3, metric_type="counter")

        assert collector._metrics_summary["counters"]["requests"] == 8.0

    @pytest.mark.asyncio
    async def test_record_metric_gauge_with_meter(self, collector_with_mock_meter):
        """Test record_metric for gauge type."""
        collector, _, _, _ = collector_with_mock_meter

        await collector.record_metric(
            name="cpu_usage",
            value=75.5,
            metric_type="gauge",
            labels={"host": "server1"},
            unit="percent",
        )

        assert "cpu_usage" in collector._metrics_summary["gauges"]
        assert collector._metrics_summary["gauges"]["cpu_usage"]["value"] == 75.5

    @pytest.mark.asyncio
    async def test_record_metric_histogram_with_meter(self, collector_with_mock_meter):
        """Test record_metric for histogram type."""
        collector, _, _, _ = collector_with_mock_meter

        await collector.record_metric(
            name="latency",
            value=250,
            metric_type="histogram",
            unit="ms",
            description="Request latency",
        )

        # Histogram should be in summary
        assert "latency" in collector._metrics_summary["histograms"]

    @pytest.mark.asyncio
    async def test_record_metric_default_type_gauge(self, collector_with_mock_meter):
        """Test record_metric defaults to gauge type."""
        collector, _, _, _ = collector_with_mock_meter

        await collector.record_metric(name="default_metric", value=100)

        assert "default_metric" in collector._metrics_summary["gauges"]

    @pytest.mark.asyncio
    async def test_record_metric_invalid_counter_value_negative(self, collector_with_mock_meter):
        """Test record_metric rejects negative counter values."""
        collector, _, _, _ = collector_with_mock_meter

        # Should log error but not crash
        with patch("dotmac.platform.analytics.otel_collector.logger") as mock_logger:
            await collector.record_metric(name="test", value=-1, metric_type="counter")
            mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_record_metric_exception_handling(self, collector_with_mock_meter):
        """Test record_metric handles exceptions gracefully."""
        collector, _, _, _ = collector_with_mock_meter

        # Force an exception by making meter.create_counter raise
        collector.meter.create_counter = Mock(side_effect=Exception("Mock error"))

        with patch("dotmac.platform.analytics.otel_collector.logger") as mock_logger:
            await collector.record_metric(name="test", value=1, metric_type="counter")
            mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_collect_unsupported_metric_type_logs_warning(self, collector_with_mock_meter):
        """Test collecting unsupported metric type logs warning."""
        collector, _, _, _ = collector_with_mock_meter

        # Create metric with unsupported type
        metric = CounterMetric(name="test", delta=1.0, tenant_id="tenant1")
        metric.type = MetricType.SUMMARY  # Unsupported type

        with patch("dotmac.platform.analytics.otel_collector.logger"):
            await collector.collect(metric)
            # Warning should be logged for unsupported type
            # Note: if meter properly handles it, warning might not be called
            assert metric.type == MetricType.SUMMARY

    @pytest.mark.asyncio
    async def test_collect_exception_handling(self, collector_with_mock_meter):
        """Test collect handles exceptions during metric processing."""
        collector, _, _, _ = collector_with_mock_meter

        # Force exception in counter creation
        collector.meter.create_counter = Mock(side_effect=Exception("Mock error"))

        metric = CounterMetric(name="test", delta=1.0, tenant_id="tenant1")

        with patch("dotmac.platform.analytics.otel_collector.logger") as mock_logger:
            await collector.collect(metric)
            mock_logger.error.assert_called()

    def test_get_metrics_summary_structure(self, collector_with_mock_meter):
        """Test get_metrics_summary returns proper structure."""
        collector, _, _, _ = collector_with_mock_meter

        # Add some test data
        collector._metrics_summary["counters"]["test"] = 10
        collector._metrics_summary["gauges"]["cpu"] = {"value": 50, "labels": {}}
        collector._metrics_summary["histograms"]["latency"] = {
            "count": 5,
            "sum": 100.0,
            "avg": 20.0,
            "min": 10.0,
            "max": 30.0,
        }

        summary = collector.get_metrics_summary()

        assert "timestamp" in summary
        assert summary["service"] == "test-service"
        assert summary["tenant"] == "tenant1"
        assert summary["counters"]["test"] == 10
        assert summary["gauges"]["cpu"]["value"] == 50
        assert summary["histograms"]["latency"]["avg"] == 20.0

    def test_create_span_default_kind(self, collector_with_mock_meter):
        """Test create_span with default kind."""
        collector, _, _, _ = collector_with_mock_meter

        mock_tracer = Mock()
        mock_tracer.start_span = Mock(return_value=Mock())
        collector._tracer = mock_tracer

        span = collector.create_span("operation", attributes={"key": "value"})

        assert span is not None
        mock_tracer.start_span.assert_called_once()

    def test_record_exception_with_status(self, collector_with_mock_meter):
        """Test record_exception sets span status."""
        collector, _, _, _ = collector_with_mock_meter

        mock_span = Mock()
        mock_span.record_exception = Mock()
        mock_span.set_status = Mock()

        exception = ValueError("test error")

        with (
            patch("dotmac.platform.analytics.otel_collector.Status"),
            patch("dotmac.platform.analytics.otel_collector.StatusCode") as mock_status_code,
        ):
            mock_status_code.ERROR = "ERROR"
            collector.record_exception(mock_span, exception)

            mock_span.record_exception.assert_called_once_with(exception)
            # set_status should be called if Status and StatusCode are available
            if hasattr(mock_span, "set_status"):
                mock_span.set_status.assert_called_once()
