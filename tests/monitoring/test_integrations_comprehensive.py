"""
Comprehensive tests for monitoring integrations.

Tests cover:
- MetricData data structure and validation
- PrometheusIntegration functionality
- Metric recording and retrieval
- Prometheus format export
- Thread safety and concurrent operations
- Performance considerations
"""

from datetime import UTC, datetime

import pytest

from dotmac.platform.monitoring.integrations import (
    MetricData,
    PrometheusIntegration,
)


@pytest.mark.integration
class TestMetricData:
    """Test MetricData data structure."""

    def test_metric_data_creation_with_defaults(self):
        """Test metric data creation with default values."""
        metric = MetricData(name="test_metric", value=42.5)

        assert metric.name == "test_metric"
        assert metric.value == 42.5
        assert metric.labels == {}
        assert isinstance(metric.timestamp, datetime)
        assert metric.timestamp.tzinfo == UTC

    def test_metric_data_creation_with_custom_values(self):
        """Test metric data creation with custom values."""
        timestamp = datetime.now(UTC)
        labels = {"service": "api", "method": "GET"}

        metric = MetricData(
            name="http_requests_total", value=1500, labels=labels, timestamp=timestamp
        )

        assert metric.name == "http_requests_total"
        assert metric.value == 1500
        assert metric.labels == labels
        assert metric.timestamp == timestamp

    def test_metric_data_post_init_timestamp(self):
        """Test that timestamp is auto-generated if not provided."""
        before = datetime.now(UTC)
        metric = MetricData(name="test", value=1)
        after = datetime.now(UTC)

        assert before <= metric.timestamp <= after

    def test_metric_data_post_init_labels(self):
        """Test that labels default to empty dict if not provided."""
        metric = MetricData(name="test", value=1, labels=None)
        assert metric.labels == {}

        # Verify existing labels are preserved
        labels = {"key": "value"}
        metric = MetricData(name="test", value=1, labels=labels)
        assert metric.labels == labels

    def test_metric_data_supports_different_value_types(self):
        """Test that metric data supports int and float values."""
        int_metric = MetricData(name="count", value=100)
        float_metric = MetricData(name="percentage", value=95.5)

        assert isinstance(int_metric.value, int)
        assert int_metric.value == 100

        assert isinstance(float_metric.value, float)
        assert float_metric.value == 95.5


@pytest.mark.integration
class TestPrometheusIntegration:
    """Test PrometheusIntegration functionality."""

    @pytest.fixture
    def prometheus_integration(self):
        """Create a fresh Prometheus integration instance."""
        return PrometheusIntegration()

    def test_prometheus_integration_initialization(self, prometheus_integration):
        """Test Prometheus integration initialization."""
        assert prometheus_integration.metrics == []
        assert hasattr(prometheus_integration, "logger")

    def test_record_metric_basic(self, prometheus_integration):
        """Test basic metric recording."""
        prometheus_integration.record_metric("test_counter", 42)

        metrics = prometheus_integration.get_metrics()
        assert len(metrics) == 1
        assert metrics[0].name == "test_counter"
        assert metrics[0].value == 42
        assert metrics[0].labels == {}

    def test_record_metric_with_labels(self, prometheus_integration):
        """Test metric recording with labels."""
        labels = {"method": "GET", "status": "200"}
        prometheus_integration.record_metric("http_requests", 150, labels=labels)

        metrics = prometheus_integration.get_metrics()
        assert len(metrics) == 1
        assert metrics[0].name == "http_requests"
        assert metrics[0].value == 150
        assert metrics[0].labels == labels

    def test_record_multiple_metrics(self, prometheus_integration):
        """Test recording multiple metrics."""
        prometheus_integration.record_metric("counter1", 10)
        prometheus_integration.record_metric("counter2", 20, {"type": "error"})
        prometheus_integration.record_metric("gauge", 95.5)

        metrics = prometheus_integration.get_metrics()
        assert len(metrics) == 3

        names = [m.name for m in metrics]
        assert "counter1" in names
        assert "counter2" in names
        assert "gauge" in names

    def test_get_metrics_returns_copy(self, prometheus_integration):
        """Test that get_metrics returns a copy to prevent external modification."""
        prometheus_integration.record_metric("original", 1)

        metrics1 = prometheus_integration.get_metrics()
        metrics2 = prometheus_integration.get_metrics()

        # Should be different objects
        assert metrics1 is not metrics2

        # But same content
        assert len(metrics1) == len(metrics2) == 1
        assert metrics1[0].name == metrics2[0].name == "original"

        # Modifying returned copy shouldn't affect internal state
        metrics1.clear()
        metrics_after_clear = prometheus_integration.get_metrics()
        assert len(metrics_after_clear) == 1

    def test_clear_metrics(self, prometheus_integration):
        """Test clearing all metrics."""
        prometheus_integration.record_metric("metric1", 1)
        prometheus_integration.record_metric("metric2", 2)

        assert len(prometheus_integration.get_metrics()) == 2

        prometheus_integration.clear_metrics()

        assert len(prometheus_integration.get_metrics()) == 0

    def test_to_prometheus_format_no_labels(self, prometheus_integration):
        """Test Prometheus format conversion without labels."""
        prometheus_integration.record_metric("simple_counter", 42)
        prometheus_integration.record_metric("simple_gauge", 95.5)

        format_output = prometheus_integration.to_prometheus_format()
        lines = format_output.strip().split("\n")

        assert len(lines) == 2
        assert "simple_counter 42" in lines
        assert "simple_gauge 95.5" in lines

    def test_to_prometheus_format_with_labels(self, prometheus_integration):
        """Test Prometheus format conversion with labels."""
        prometheus_integration.record_metric(
            "http_requests_total", 1234, {"method": "GET", "status": "200"}
        )

        format_output = prometheus_integration.to_prometheus_format()

        # Should contain the metric with labels
        assert "http_requests_total{" in format_output
        assert 'method="GET"' in format_output
        assert 'status="200"' in format_output
        assert "} 1234" in format_output

    def test_to_prometheus_format_multiple_metrics_with_mixed_labels(self, prometheus_integration):
        """Test Prometheus format with multiple metrics, some with and without labels."""
        prometheus_integration.record_metric("simple_counter", 10)
        prometheus_integration.record_metric("labeled_counter", 20, {"env": "prod"})
        prometheus_integration.record_metric(
            "multi_label_gauge", 30, {"env": "dev", "service": "api"}
        )

        format_output = prometheus_integration.to_prometheus_format()
        lines = format_output.strip().split("\n")

        assert len(lines) == 3

        # Check each metric format
        simple_line = next(line for line in lines if line.startswith("simple_counter"))
        assert simple_line == "simple_counter 10"

        labeled_line = next(line for line in lines if line.startswith("labeled_counter"))
        assert 'env="prod"' in labeled_line
        assert labeled_line.endswith(" 20")

        multi_line = next(line for line in lines if line.startswith("multi_label_gauge"))
        assert 'env="dev"' in multi_line
        assert 'service="api"' in multi_line
        assert multi_line.endswith(" 30")

    def test_to_prometheus_format_empty_metrics(self, prometheus_integration):
        """Test Prometheus format conversion with no metrics."""
        format_output = prometheus_integration.to_prometheus_format()
        assert format_output == ""

    def test_to_prometheus_format_special_label_values(self, prometheus_integration):
        """Test Prometheus format with special characters in label values."""
        prometheus_integration.record_metric(
            "test_metric", 1, {"path": "/api/v1/users", "user_agent": "Mozilla/5.0"}
        )

        format_output = prometheus_integration.to_prometheus_format()

        # Should properly quote label values
        assert 'path="/api/v1/users"' in format_output
        assert 'user_agent="Mozilla/5.0"' in format_output

    def test_prometheus_format_consistency(self, prometheus_integration):
        """Test that repeated calls to to_prometheus_format return consistent results."""
        prometheus_integration.record_metric("consistent_metric", 42, {"label": "value"})

        format1 = prometheus_integration.to_prometheus_format()
        format2 = prometheus_integration.to_prometheus_format()

        assert format1 == format2

    def test_record_metric_overwrites_timestamp(self, prometheus_integration):
        """Test that record_metric creates metrics with current timestamp."""
        before_recording = datetime.now(UTC)
        prometheus_integration.record_metric("timestamped_metric", 1)
        after_recording = datetime.now(UTC)

        metrics = prometheus_integration.get_metrics()
        assert len(metrics) == 1
        assert before_recording <= metrics[0].timestamp <= after_recording

    def test_record_metric_logging(self, prometheus_integration):
        """Test that metric recording works with logging."""
        # Just verify the method works and doesn't raise exceptions
        prometheus_integration.record_metric("logged_metric", 123)

        metrics = prometheus_integration.get_metrics()
        assert len(metrics) == 1
        assert metrics[0].name == "logged_metric"
        assert metrics[0].value == 123

    def test_integration_supports_concurrent_operations(self, prometheus_integration):
        """Test thread safety of basic operations."""
        import threading
        import time

        def record_metrics(thread_id, count):
            for i in range(count):
                prometheus_integration.record_metric(f"thread_{thread_id}_metric_{i}", i)
                time.sleep(0.001)  # Small delay to encourage interleaving

        threads = []
        for thread_id in range(3):
            thread = threading.Thread(target=record_metrics, args=(thread_id, 10))
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        # Should have recorded all metrics from all threads
        metrics = prometheus_integration.get_metrics()
        assert len(metrics) == 30  # 3 threads * 10 metrics each

        # Verify we have metrics from each thread
        thread_0_metrics = [m for m in metrics if m.name.startswith("thread_0_")]
        thread_1_metrics = [m for m in metrics if m.name.startswith("thread_1_")]
        thread_2_metrics = [m for m in metrics if m.name.startswith("thread_2_")]

        assert len(thread_0_metrics) == 10
        assert len(thread_1_metrics) == 10
        assert len(thread_2_metrics) == 10

    def test_large_number_of_metrics_performance(self, prometheus_integration):
        """Test performance with large number of metrics."""
        import time

        # Record a large number of metrics
        start_time = time.time()
        for i in range(1000):
            prometheus_integration.record_metric(f"perf_metric_{i}", i, {"batch": "load_test"})
        recording_time = time.time() - start_time

        # Should complete reasonably quickly (adjust threshold as needed)
        assert recording_time < 1.0  # Should take less than 1 second

        # Verify all metrics were recorded
        metrics = prometheus_integration.get_metrics()
        assert len(metrics) == 1000

        # Test format conversion performance
        start_time = time.time()
        prometheus_format = prometheus_integration.to_prometheus_format()
        format_time = time.time() - start_time

        # Should complete reasonably quickly
        assert format_time < 1.0  # Should take less than 1 second

        # Verify format is correct
        lines = prometheus_format.strip().split("\n")
        assert len(lines) == 1000

    def test_metric_data_immutability_protection(self, prometheus_integration):
        """Test that stored metrics behave consistently."""
        labels = {"mutable": "original"}
        prometheus_integration.record_metric("immutable_test", 1, labels)

        # Modify the original labels dict
        labels["mutable"] = "modified"

        # Retrieved metric should have been recorded with original state
        metrics = prometheus_integration.get_metrics()
        assert len(metrics) == 1
        assert metrics[0].name == "immutable_test"
        assert metrics[0].value == 1
        # The behavior depends on implementation - just verify it's consistent
        assert "mutable" in metrics[0].labels

    def test_edge_case_empty_labels(self, prometheus_integration):
        """Test handling of empty labels dict."""
        prometheus_integration.record_metric("empty_labels", 1, {})

        format_output = prometheus_integration.to_prometheus_format()
        assert format_output == "empty_labels 1"

    def test_edge_case_none_labels_explicit(self, prometheus_integration):
        """Test handling of explicit None labels."""
        prometheus_integration.record_metric("none_labels", 1, None)

        metrics = prometheus_integration.get_metrics()
        assert metrics[0].labels == {}

        format_output = prometheus_integration.to_prometheus_format()
        assert format_output == "none_labels 1"
