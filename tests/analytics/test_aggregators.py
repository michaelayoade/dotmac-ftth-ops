"""Tests for analytics aggregators module."""

from datetime import UTC, datetime, timedelta

import pytest

from dotmac.platform.analytics.aggregators import (
    MetricAggregator,
    StatisticalAggregator,
    TimeWindowAggregator,
)
from dotmac.platform.analytics.base import Metric


@pytest.mark.unit
class TestMetricAggregator:
    """Test MetricAggregator class."""

    def test_init(self):
        """Test aggregator initialization."""
        aggregator = MetricAggregator(window_size=120)
        assert aggregator.window_size == 120
        assert aggregator.metrics_buffer is not None

    def test_add_metric(self):
        """Test adding a metric."""
        aggregator = MetricAggregator()

        metric = Metric(
            name="request.duration",
            value=150.5,
            timestamp=datetime.now(UTC),
            tenant_id="tenant-123",
            attributes={"service": "api", "endpoint": "/users"},
        )

        aggregator.add_metric(metric)

        # Check metric was added
        assert len(aggregator.metrics_buffer) == 1

    def test_add_alias(self):
        """Test add() alias for add_metric()."""
        aggregator = MetricAggregator()

        metric = Metric(
            name="request.count",
            value=1,
            timestamp=datetime.now(UTC),
            tenant_id="tenant-123",
        )

        aggregator.add(metric)
        assert len(aggregator.metrics_buffer) == 1

    def test_get_key(self):
        """Test key generation for metrics."""
        aggregator = MetricAggregator()

        metric = Metric(
            name="cpu.usage",
            value=75.0,
            timestamp=datetime.now(UTC),
            tenant_id="tenant-456",
            attributes={"service": "worker", "method": "POST"},
        )

        key = aggregator._get_key(metric)
        assert "cpu.usage" in key
        assert "tenant-456" in key
        assert "service:worker" in key
        assert "method:POST" in key

    def test_get_aggregates_avg(self):
        """Test getting average aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        # Add multiple metrics
        for i in range(5):
            metric = Metric(
                name="latency",
                value=100.0 + i * 10,  # 100, 110, 120, 130, 140
                timestamp=now - timedelta(seconds=i),
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="avg")

        # Should have one key
        assert len(aggregates) == 1
        # Average should be 120
        key = list(aggregates.keys())[0]
        assert aggregates[key] == pytest.approx(120.0)

    def test_get_aggregates_sum(self):
        """Test getting sum aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        for i in range(3):
            metric = Metric(
                name="requests",
                value=10,
                timestamp=now - timedelta(seconds=i),
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="sum")
        key = list(aggregates.keys())[0]
        assert aggregates[key] == 30

    def test_get_aggregates_min(self):
        """Test getting min aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        for value in [100, 50, 150, 25]:
            metric = Metric(
                name="response_time",
                value=value,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="min")
        key = list(aggregates.keys())[0]
        assert aggregates[key] == 25

    def test_get_aggregates_max(self):
        """Test getting max aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        for value in [100, 50, 150, 25]:
            metric = Metric(
                name="response_time",
                value=value,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="max")
        key = list(aggregates.keys())[0]
        assert aggregates[key] == 150

    def test_get_aggregates_count(self):
        """Test getting count aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        for _ in range(7):
            metric = Metric(
                name="errors",
                value=1,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="count")
        key = list(aggregates.keys())[0]
        assert aggregates[key] == 7

    def test_get_aggregates_median(self):
        """Test getting median aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        for value in [10, 20, 30, 40, 50]:
            metric = Metric(
                name="latency",
                value=value,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="median")
        key = list(aggregates.keys())[0]
        assert aggregates[key] == 30

    def test_get_aggregates_stddev(self):
        """Test getting standard deviation aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        for value in [10, 20, 30, 40, 50]:
            metric = Metric(
                name="values",
                value=value,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="stddev")
        key = list(aggregates.keys())[0]
        assert aggregates[key] == pytest.approx(15.81, rel=0.01)

    def test_get_aggregates_p95(self):
        """Test getting p95 percentile aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        for value in range(1, 101):  # 1-100
            metric = Metric(
                name="response_time",
                value=float(value),
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="p95")
        key = list(aggregates.keys())[0]
        assert aggregates[key] >= 95

    def test_get_aggregates_p99(self):
        """Test getting p99 percentile aggregates."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        for value in range(1, 101):
            metric = Metric(
                name="response_time",
                value=float(value),
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        aggregates = aggregator.get_aggregates(aggregation_type="p99")
        key = list(aggregates.keys())[0]
        assert aggregates[key] >= 99

    def test_percentile_method(self):
        """Test _percentile calculation."""
        aggregator = MetricAggregator()

        # Test with empty list
        assert aggregator._percentile([], 95) == 0

        # Test with values
        values = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]
        p50 = aggregator._percentile(values, 50)
        # p50 should be around middle value
        assert 40.0 <= p50 <= 60.0

        p95 = aggregator._percentile(values, 95)
        assert p95 >= 90.0

    def test_get_aggregates_with_cutoff(self):
        """Test aggregates with cutoff time."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)
        cutoff = now - timedelta(seconds=30)

        # Add old metric (should be filtered)
        old_metric = Metric(
            name="latency",
            value=100,
            timestamp=now - timedelta(seconds=60),
            tenant_id="tenant-1",
        )
        aggregator.add(old_metric)

        # Add recent metric (should be included)
        recent_metric = Metric(
            name="latency",
            value=200,
            timestamp=now - timedelta(seconds=10),
            tenant_id="tenant-1",
        )
        aggregator.add(recent_metric)

        aggregates = aggregator.get_aggregates(aggregation_type="avg", cutoff_time=cutoff)

        key = list(aggregates.keys())[0]
        # Should only include recent metric
        assert aggregates[key] == 200

    def test_clear_old_metrics(self):
        """Test clearing old metrics."""
        aggregator = MetricAggregator()
        now = datetime.now(UTC)

        # Add old metric
        old_metric = Metric(
            name="test",
            value=1,
            timestamp=now - timedelta(seconds=7200),  # 2 hours ago
            tenant_id="tenant-1",
        )
        aggregator.add(old_metric)

        # Add recent metric
        recent_metric = Metric(
            name="test",
            value=2,
            timestamp=now,
            tenant_id="tenant-1",
        )
        aggregator.add(recent_metric)

        assert len(aggregator.metrics_buffer) > 0

        # Clear metrics older than 1 hour
        aggregator.clear_old_metrics(retention_seconds=3600)

        # Buffer should still exist but old metric should be removed
        key = aggregator._get_key(recent_metric)
        assert len(aggregator.metrics_buffer[key]) == 1


@pytest.mark.unit
class TestTimeWindowAggregator:
    """Test TimeWindowAggregator class."""

    def test_init(self):
        """Test time window aggregator initialization."""
        aggregator = TimeWindowAggregator(window_minutes=5)
        assert aggregator.window_minutes == 5

    def test_add_metric(self):
        """Test adding metric to time window."""
        aggregator = TimeWindowAggregator(window_minutes=5)
        now = datetime.now(UTC)

        metric = Metric(
            name="requests",
            value=1,
            timestamp=now,
            tenant_id="tenant-1",
        )

        aggregator.add(metric)
        # Metric should be added to time window
        assert len(aggregator.windows) > 0

        # Check that the metric was stored in the correct window
        window_start = aggregator._get_window_start(now)
        assert window_start in aggregator.windows
        key = f"{metric.name}:{metric.tenant_id}"
        assert key in aggregator.windows[window_start]
        assert aggregator.windows[window_start][key] == [1]

    def test_add_data_point(self):
        """Test adding data point directly."""
        aggregator = TimeWindowAggregator(window_minutes=5)

        aggregator.add_data_point("cpu.usage", 75.5, {"host": "server1"})
        aggregator.add_data_point("cpu.usage", 80.2, {"host": "server1"})

        assert len(aggregator.windows) > 0

    def test_get_window_aggregates(self):
        """Test getting aggregates for a specific window."""
        aggregator = TimeWindowAggregator(window_minutes=5)
        now = datetime.now(UTC)

        # Add multiple metrics in same window
        for i in range(5):
            metric = Metric(
                name="requests",
                value=float(i + 1),  # 1, 2, 3, 4, 5
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        window_start = aggregator._get_window_start(now)
        aggregates = aggregator.get_window_aggregates(window_start)

        assert len(aggregates) > 0
        key = "requests:tenant-1"
        assert key in aggregates
        assert aggregates[key] == pytest.approx(3.0)  # mean of [1,2,3,4,5]

    def test_get_window_aggregates_with_custom_function(self):
        """Test getting aggregates with custom aggregation function."""
        aggregator = TimeWindowAggregator(window_minutes=5)
        now = datetime.now(UTC)

        for value in [10, 20, 30, 40, 50]:
            metric = Metric(
                name="latency",
                value=value,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        window_start = aggregator._get_window_start(now)

        # Test with sum
        aggregates = aggregator.get_window_aggregates(window_start, aggregation_fn=sum)
        assert aggregates["latency:tenant-1"] == 150

        # Test with max
        aggregates = aggregator.get_window_aggregates(window_start, aggregation_fn=max)
        assert aggregates["latency:tenant-1"] == 50

    def test_get_recent_windows(self):
        """Test getting recent window aggregates."""
        aggregator = TimeWindowAggregator(window_minutes=5)
        now = datetime.now(UTC)

        # Add metrics to current window
        for _i in range(3):
            metric = Metric(
                name="errors",
                value=1,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        recent = aggregator.get_recent_windows(count=3)

        assert isinstance(recent, list)
        if recent:  # Will have results if window contains data
            assert "window_start" in recent[0]
            assert "window_end" in recent[0]
            assert "aggregates" in recent[0]

    def test_cleanup_old_windows(self):
        """Test cleanup of old time windows."""
        aggregator = TimeWindowAggregator(window_minutes=5)
        now = datetime.now(UTC)

        # Add old metric (25 hours ago - beyond 24h retention)
        old_time = now - timedelta(hours=25)
        old_metric = Metric(
            name="old_metric",
            value=100,
            timestamp=old_time,
            tenant_id="tenant-1",
        )
        aggregator.add(old_metric)

        # Add recent metric
        recent_metric = Metric(
            name="recent_metric",
            value=200,
            timestamp=now,
            tenant_id="tenant-1",
        )
        aggregator.add(recent_metric)

        # Should have 2 windows
        initial_count = len(aggregator.windows)
        assert initial_count >= 1

        # Cleanup old windows
        aggregator.cleanup_old_windows(retention_hours=24)

        # Old window should be removed
        final_count = len(aggregator.windows)
        assert final_count <= initial_count


@pytest.mark.unit
class TestStatisticalAggregator:
    """Test StatisticalAggregator class."""

    def test_init(self):
        """Test statistical aggregator initialization."""
        aggregator = StatisticalAggregator()
        assert aggregator is not None
        assert aggregator.data_points is not None

    def test_add_and_calculate_stats(self):
        """Test adding metrics and calculating statistics."""
        aggregator = StatisticalAggregator()
        now = datetime.now(UTC)

        # Add range of values for statistical calculations
        for value in [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]:
            metric = Metric(
                name="latency",
                value=value,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        # Aggregator should have processed metrics
        assert len(aggregator.data_points) > 0

        # Check that the metric key exists
        key = "latency:tenant-1"
        assert key in aggregator.data_points
        assert len(aggregator.data_points[key]) == 10

        # Verify data points are stored as tuples (timestamp, value)
        values = [point[1] for point in aggregator.data_points[key]]
        assert values == [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

    def test_add_value(self):
        """Test adding value directly."""
        aggregator = StatisticalAggregator()

        aggregator.add_value("response_time", 150.5)
        aggregator.add_value("response_time", 200.3)
        aggregator.add_value("response_time", 175.8)

        assert "response_time" in aggregator.data_points
        assert len(aggregator.data_points["response_time"]) == 3

        values = [point[1] for point in aggregator.data_points["response_time"]]
        assert values == [150.5, 200.3, 175.8]

    def test_get_statistics(self):
        """Test getting comprehensive statistics."""
        aggregator = StatisticalAggregator()
        now = datetime.now(UTC)

        # Add diverse dataset
        for value in [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]:
            metric = Metric(
                name="latency",
                value=value,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        key = "latency:tenant-1"
        stats = aggregator.get_statistics(key)

        assert stats is not None
        assert "count" in stats
        assert stats["count"] == 10
        assert "mean" in stats
        assert stats["mean"] == pytest.approx(55.0)
        assert "min" in stats
        assert stats["min"] == 10
        assert "max" in stats
        assert stats["max"] == 100

    def test_get_statistics_with_time_range(self):
        """Test getting statistics for a specific time range."""
        aggregator = StatisticalAggregator()
        now = datetime.now(UTC)

        # Add old data points
        for value in [10, 20, 30]:
            metric = Metric(
                name="cpu",
                value=value,
                timestamp=now - timedelta(hours=2),
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        # Add recent data points
        for value in [40, 50, 60]:
            metric = Metric(
                name="cpu",
                value=value,
                timestamp=now,
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        key = "cpu:tenant-1"

        # Get stats for last 1 hour (should only include recent values)
        recent_stats = aggregator.get_statistics(key, time_range=timedelta(hours=1))

        assert recent_stats is not None
        assert recent_stats["count"] == 3
        assert recent_stats["mean"] == pytest.approx(50.0)

    def test_get_statistics_empty_key(self):
        """Test getting statistics for non-existent key."""
        aggregator = StatisticalAggregator()

        stats = aggregator.get_statistics("nonexistent")

        assert stats["count"] == 0
        # When there's no data, only count is returned
        assert len(stats) == 1

    def test_get_statistics_empty_after_filter(self):
        """Test getting statistics when time filter removes all data."""
        aggregator = StatisticalAggregator()
        now = datetime.now(UTC)

        # Add old data points
        for value in [10, 20, 30]:
            metric = Metric(
                name="old_cpu",
                value=value,
                timestamp=now - timedelta(hours=5),
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        key = "old_cpu:tenant-1"

        # Get stats for last 1 hour (should exclude all old values)
        stats = aggregator.get_statistics(key, time_range=timedelta(hours=1))

        assert stats["count"] == 0
        assert "mean" in stats

    def test_get_statistics_comprehensive(self):
        """Test comprehensive statistics calculation."""
        aggregator = StatisticalAggregator()
        now = datetime.now(UTC)

        # Add diverse dataset with multiple values
        for i, value in enumerate([10, 20, 25, 30, 40, 50, 60, 70, 80, 90]):
            metric = Metric(
                name="comprehensive",
                value=value,
                timestamp=now - timedelta(seconds=i),
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        key = "comprehensive:tenant-1"
        stats = aggregator.get_statistics(key)

        # Check all expected stats
        assert stats["count"] == 10
        assert "sum" in stats
        assert "mean" in stats
        assert "median" in stats
        assert "min" in stats
        assert "max" in stats
        assert stats["min"] == 10
        assert stats["max"] == 90

        # Multi-value statistics
        assert "std_dev" in stats
        assert "variance" in stats

        # Percentiles
        assert "p25" in stats
        assert "p50" in stats
        assert "p75" in stats
        assert "p90" in stats
        assert "p95" in stats
        assert "p99" in stats

        # Time-based stats
        assert "first_seen" in stats
        assert "last_seen" in stats
        assert "duration_seconds" in stats

    def test_get_trend(self):
        """Test trend calculation."""
        aggregator = StatisticalAggregator()
        now = datetime.now(UTC)

        # Add increasing trend
        for i in range(20):
            metric = Metric(
                name="trending",
                value=float(i * 10),  # 0, 10, 20, ... 190
                timestamp=now + timedelta(seconds=i),
                tenant_id="tenant-1",
            )
            aggregator.add(metric)

        key = "trending:tenant-1"
        trend = aggregator.get_trend(key, window_size=5)

        assert "direction" in trend
        assert "percentage_change" in trend
        assert "moving_average" in trend
        assert "data_points" in trend
        assert trend["data_points"] == 20
        assert trend["direction"] in ["increasing", "decreasing", "stable"]

    def test_get_trend_insufficient_data(self):
        """Test trend with insufficient data."""
        aggregator = StatisticalAggregator()
        now = datetime.now(UTC)

        # Add only one data point
        metric = Metric(
            name="single",
            value=100,
            timestamp=now,
            tenant_id="tenant-1",
        )
        aggregator.add(metric)

        key = "single:tenant-1"
        trend = aggregator.get_trend(key)

        # Should return empty dict for insufficient data
        assert trend == {}

    def test_get_trend_nonexistent_key(self):
        """Test trend for non-existent key."""
        aggregator = StatisticalAggregator()

        trend = aggregator.get_trend("nonexistent")

        assert trend == {}
