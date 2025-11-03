"""
Metric aggregation utilities for analytics processing.
"""

import statistics
from collections import defaultdict, deque
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from .base import Metric


class MetricAggregator:
    """Base aggregator for metrics."""

    def __init__(self, window_size: int = 60) -> None:
        """
        Initialize aggregator.

        Args:
            window_size: Time window in seconds for aggregation
        """
        self.window_size = window_size
        self.metrics_buffer: dict[str, deque[dict[str, Any]]] = defaultdict(
            lambda: deque(maxlen=1000)
        )

    def add_metric(self, metric: Metric) -> None:
        """Add a metric to the aggregator."""
        key = self._get_key(metric)
        self.metrics_buffer[key].append(
            {
                "timestamp": metric.timestamp,
                "value": metric.value,
                "attributes": metric.attributes,
            }
        )

    def add(self, metric: Metric) -> None:
        """Add a metric to the aggregator (alias for add_metric)."""
        self.add_metric(metric)

    def _get_key(self, metric: Metric) -> str:
        """Generate aggregation key for a metric."""
        # Create key from metric name and important attributes
        key_parts = [metric.name, metric.tenant_id]

        # Add selected attributes to key
        for attr in ["service", "endpoint", "method"]:
            if attr in metric.attributes:
                key_parts.append(f"{attr}:{metric.attributes[attr]}")

        return "|".join(key_parts)

    def _get_cutoff_time(self, cutoff_time: datetime | None) -> datetime:
        """Get the cutoff time for filtering metrics."""
        if cutoff_time is None:
            return datetime.now(UTC) - timedelta(seconds=self.window_size)
        return cutoff_time

    def _filter_values_by_time(self, buffer: deque[Any], cutoff_time: datetime) -> list[float]:
        """Filter buffer values by cutoff time."""
        return [entry["value"] for entry in buffer if entry["timestamp"] >= cutoff_time]

    def _aggregate_basic_stats(self, values: list[float], aggregation_type: str) -> float | None:
        """Calculate basic statistical aggregations."""
        if aggregation_type == "avg":
            return statistics.mean(values)
        elif aggregation_type == "sum":
            return sum(values)
        elif aggregation_type == "min":
            return min(values)
        elif aggregation_type == "max":
            return max(values)
        elif aggregation_type == "count":
            return float(len(values))
        return None

    def _aggregate_advanced_stats(self, values: list[float], aggregation_type: str) -> float | None:
        """Calculate advanced statistical aggregations."""
        if aggregation_type == "median":
            return statistics.median(values)
        elif aggregation_type == "stddev":
            return statistics.stdev(values) if len(values) > 1 else 0.0
        elif aggregation_type == "p95":
            return self._percentile(values, 95)
        elif aggregation_type == "p99":
            return self._percentile(values, 99)
        return None

    def _calculate_aggregate(self, values: list[float], aggregation_type: str) -> float:
        """Calculate aggregate value for given type."""
        # Try basic stats first
        result = self._aggregate_basic_stats(values, aggregation_type)
        if result is not None:
            return result

        # Try advanced stats
        result = self._aggregate_advanced_stats(values, aggregation_type)
        if result is not None:
            return result

        # Unknown aggregation type, default to average
        return statistics.mean(values)

    def get_aggregates(
        self,
        aggregation_type: str = "avg",
        cutoff_time: datetime | None = None,
    ) -> dict[str, float]:
        """
        Get aggregated metrics.

        Args:
            aggregation_type: Type of aggregation (avg, sum, min, max, count)
            cutoff_time: Only consider metrics after this time

        Returns:
            Dictionary of aggregated values by key
        """
        cutoff_time = self._get_cutoff_time(cutoff_time)
        aggregates = {}

        for key, buffer in self.metrics_buffer.items():
            values = self._filter_values_by_time(buffer, cutoff_time)

            if not values:
                continue

            aggregates[key] = self._calculate_aggregate(values, aggregation_type)

        return aggregates

    def _percentile(self, values: list[float], percentile: float) -> float:
        """Calculate percentile value."""
        if not values:
            return 0
        sorted_values = sorted(values)
        index = int(len(sorted_values) * (percentile / 100))
        return sorted_values[min(index, len(sorted_values) - 1)]

    def clear_old_metrics(self, retention_seconds: int = 3600) -> None:
        """Clear metrics older than retention period."""
        cutoff_time = datetime.now(UTC) - timedelta(seconds=retention_seconds)

        for buffer in self.metrics_buffer.values():
            # Remove old entries
            while buffer and buffer[0]["timestamp"] < cutoff_time:
                buffer.popleft()


class TimeWindowAggregator:
    """Aggregator with fixed time windows."""

    def __init__(self, window_minutes: int = 5) -> None:
        """
        Initialize time window aggregator.

        Args:
            window_minutes: Size of time window in minutes
        """
        self.window_minutes = window_minutes
        self.windows: dict[datetime, dict[str, list[float]]] = defaultdict(
            lambda: defaultdict(list)
        )

    def add(self, metric: Metric) -> None:
        """Add metric to appropriate time window."""
        window_start = self._get_window_start(metric.timestamp)
        key = f"{metric.name}:{metric.tenant_id}"
        self.windows[window_start][key].append(metric.value)

    def add_data_point(
        self, metric_name: str, value: float, attributes: dict[str, Any] | None = None
    ) -> None:
        """Add a data point to the aggregator."""
        current_time = datetime.now(UTC)
        window_start = self._get_window_start(current_time)
        key = metric_name
        self.windows[window_start][key].append(value)

    def _get_window_start(self, timestamp: datetime) -> datetime:
        """Get the start of the time window for a timestamp."""
        minutes = (timestamp.minute // self.window_minutes) * self.window_minutes
        return timestamp.replace(minute=minutes, second=0, microsecond=0)

    def get_window_aggregates(
        self,
        window_start: datetime,
        aggregation_fn: Callable[[list[float]], float] = statistics.mean,
    ) -> dict[str, float]:
        """
        Get aggregates for a specific time window.

        Args:
            window_start: Start of the time window
            aggregation_fn: Function to aggregate values

        Returns:
            Aggregated values for the window
        """
        if window_start not in self.windows:
            return {}

        aggregates = {}
        for key, values in self.windows[window_start].items():
            if values:
                aggregates[key] = aggregation_fn(values)

        return aggregates

    def get_recent_windows(
        self,
        count: int = 12,
        aggregation_fn: Callable[[list[float]], float] = statistics.mean,
    ) -> list[dict[str, Any]]:
        """
        Get aggregates for recent time windows.

        Args:
            count: Number of recent windows to return
            aggregation_fn: Aggregation function

        Returns:
            List of window aggregates with timestamps
        """
        current_time = datetime.now(UTC)
        results = []

        for i in range(count):
            window_start = self._get_window_start(
                current_time - timedelta(minutes=i * self.window_minutes)
            )

            aggregates = self.get_window_aggregates(window_start, aggregation_fn)
            if aggregates:
                results.append(
                    {
                        "window_start": window_start.isoformat(),
                        "window_end": (
                            window_start + timedelta(minutes=self.window_minutes)
                        ).isoformat(),
                        "aggregates": aggregates,
                    }
                )

        return results

    def cleanup_old_windows(self, retention_hours: int = 24) -> None:
        """Remove old time windows beyond retention period."""
        cutoff_time = datetime.now(UTC) - timedelta(hours=retention_hours)

        # Check if window keys are naive or aware and normalize cutoff_time to match
        if self.windows:
            sample_window = next(iter(self.windows.keys()))
            if sample_window.tzinfo is None and cutoff_time.tzinfo is not None:
                cutoff_time = cutoff_time.replace(tzinfo=None)
            elif sample_window.tzinfo is not None and cutoff_time.tzinfo is None:
                cutoff_time = cutoff_time.replace(tzinfo=UTC)

        old_windows = [window for window in self.windows.keys() if window < cutoff_time]
        for window in old_windows:
            del self.windows[window]


class StatisticalAggregator:
    """Advanced statistical aggregation for metrics."""

    def __init__(self) -> None:
        """Initialize statistical aggregator."""
        self.data_points: dict[str, list[tuple[datetime, float]]] = defaultdict(list)

    def add(self, metric: Metric) -> None:
        """Add metric for statistical analysis."""
        key = f"{metric.name}:{metric.tenant_id}"
        self.data_points[key].append((metric.timestamp, metric.value))

    def add_value(self, metric_name: str, value: float) -> None:
        """Add a value for statistical analysis."""
        current_time = datetime.now(UTC)
        self.data_points[metric_name].append((current_time, value))

    def get_statistics(self, key: str, time_range: timedelta | None = None) -> dict[str, Any]:
        """
        Calculate comprehensive statistics for a metric.

        Args:
            key: Metric key
            time_range: Optional time range to consider

        Returns:
            Dictionary of statistical measures
        """
        if key not in self.data_points or len(self.data_points[key]) == 0:
            return {"count": 0}

        # Filter by time range if specified
        values = self.data_points[key]
        if time_range:
            cutoff_time = datetime.now(UTC) - time_range
            values = [(ts, val) for ts, val in values if ts >= cutoff_time]

        if not values:
            return {"count": 0, "mean": 0.0, "median": 0.0, "std_dev": 0.0, "min": 0.0, "max": 0.0}

        # Extract just the numeric values
        nums = [val for _, val in values]

        stats: dict[str, Any] = {
            "count": len(nums),
            "sum": sum(nums),
            "mean": statistics.mean(nums),
            "median": statistics.median(nums),
            "min": min(nums),
            "max": max(nums),
        }

        # Additional statistics for multiple values
        if len(nums) > 1:
            stats.update(
                {
                    "std_dev": statistics.stdev(nums),
                    "variance": statistics.variance(nums),
                }
            )

            # Calculate percentiles
            sorted_nums = sorted(nums)
            for p in [25, 50, 75, 90, 95, 99]:
                index = int(len(sorted_nums) * (p / 100))
                stats[f"p{p}"] = sorted_nums[min(index, len(sorted_nums) - 1)]

        # Time-based statistics
        timestamps = [ts for ts, _ in values]
        if timestamps:
            first_seen = min(timestamps)
            last_seen = max(timestamps)
            stats["first_seen"] = first_seen.isoformat()
            stats["last_seen"] = last_seen.isoformat()
            stats["duration_seconds"] = (last_seen - first_seen).total_seconds()

        return stats

    def get_trend(
        self,
        key: str,
        window_size: int = 10,
    ) -> dict[str, Any]:
        """
        Calculate trend information for a metric.

        Args:
            key: Metric key
            window_size: Number of points for moving average

        Returns:
            Trend information
        """
        if key not in self.data_points or len(self.data_points[key]) < 2:
            return {}

        values = self.data_points[key]
        sorted_values = sorted(values, key=lambda x: x[0])

        # Calculate moving average
        moving_avg: list[float] = []
        for i in range(len(sorted_values)):
            start_idx = max(0, i - window_size + 1)
            window_values = [val for _, val in sorted_values[start_idx : i + 1]]
            moving_avg.append(statistics.mean(window_values))

        # Determine trend direction
        if len(moving_avg) >= 2:
            recent_avg = statistics.mean(moving_avg[-window_size:])
            older_avg = statistics.mean(moving_avg[:window_size])
            trend_direction = "increasing" if recent_avg > older_avg else "decreasing"
            trend_percentage = ((recent_avg - older_avg) / older_avg * 100) if older_avg != 0 else 0
        else:
            trend_direction = "stable"
            trend_percentage = 0

        return {
            "direction": trend_direction,
            "percentage_change": trend_percentage,
            "moving_average": moving_avg[-1] if moving_avg else 0,
            "data_points": len(sorted_values),
        }
