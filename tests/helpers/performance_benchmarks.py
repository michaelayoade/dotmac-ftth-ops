"""
Performance Benchmarking for Tests

Tracks test performance metrics and identifies slow tests.

Usage:
    from tests.helpers.performance_benchmarks import BenchmarkingTestBase



    class TestMyRouter(BenchmarkingTestBase, RouterTestBase):
        performance_threshold_ms = 100  # Warn if test takes >100ms

        def test_endpoint(self, client):
            response = client.get("/api/v1/resource")
            self.assert_success(response)
            # Automatically tracked

Features:
- Automatic timing of all test methods
- Performance threshold warnings
- Historical performance tracking
- Slowest tests report
"""

import json
import sys
import time
from pathlib import Path
from typing import Any

import pytest

pytestmark = pytest.mark.unit


class PerformanceTracker:
    """Tracks test performance metrics."""

    def __init__(self, data_file: str = ".test_performance.json"):
        self.data_file = Path(data_file)
        self.data = self._load_data()

    def _load_data(self) -> dict[str, Any]:
        """Load historical performance data."""
        if self.data_file.exists():
            try:
                with open(self.data_file) as f:
                    return json.load(f)
            except Exception:
                pass
        return {"tests": {}}

    def save_data(self) -> None:
        """Save performance data."""
        try:
            with open(self.data_file, "w") as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save performance data: {e}")

    def record_test(self, test_name: str, duration_ms: float) -> None:
        """Record test execution time."""
        if "tests" not in self.data:
            self.data["tests"] = {}

        if test_name not in self.data["tests"]:
            self.data["tests"][test_name] = {
                "executions": [],
                "avg_ms": 0,
                "min_ms": duration_ms,
                "max_ms": duration_ms,
            }

        test_data = self.data["tests"][test_name]
        test_data["executions"].append({"timestamp": time.time(), "duration_ms": duration_ms})

        # Keep only last 100 executions
        test_data["executions"] = test_data["executions"][-100:]

        # Update statistics
        executions = [e["duration_ms"] for e in test_data["executions"]]
        test_data["avg_ms"] = sum(executions) / len(executions)
        test_data["min_ms"] = min(executions)
        test_data["max_ms"] = max(executions)

    def get_test_stats(self, test_name: str) -> dict[str, float] | None:
        """Get statistics for a test."""
        return self.data.get("tests", {}).get(test_name)

    def get_slowest_tests(self, limit: int = 10) -> list[tuple[str, float]]:
        """Get slowest tests by average execution time."""
        tests = self.data.get("tests", {})
        sorted_tests = sorted(tests.items(), key=lambda x: x[1]["avg_ms"], reverse=True)
        return [(name, stats["avg_ms"]) for name, stats in sorted_tests[:limit]]


# Global tracker instance
_tracker = PerformanceTracker()


class BenchmarkingTestBase:
    """
    Base class for performance-tracked tests.

    Automatically times all test methods and warns if they exceed threshold.
    """

    performance_threshold_ms: float = 1000  # Default 1 second
    track_performance: bool = True

    @pytest.fixture(autouse=True)
    def _track_performance(self, request):
        """Auto-fixture to track test performance."""
        if not self.track_performance:
            yield
            return

        test_name = f"{request.cls.__name__}::{request.node.name}"

        start_time = time.perf_counter()
        yield
        end_time = time.perf_counter()

        duration_ms = (end_time - start_time) * 1000

        # Record metrics
        _tracker.record_test(test_name, duration_ms)

        # Check threshold
        if duration_ms > self.performance_threshold_ms:
            stats = _tracker.get_test_stats(test_name)
            print(
                f"\n⚠️  Slow test: {test_name} took {duration_ms:.2f}ms "
                f"(threshold: {self.performance_threshold_ms}ms)"
            )
            if stats:
                print(
                    f"   Historical avg: {stats['avg_ms']:.2f}ms, "
                    f"min: {stats['min_ms']:.2f}ms, max: {stats['max_ms']:.2f}ms"
                )

    @classmethod
    def teardown_class(cls):
        """Save performance data after class execution."""
        _tracker.save_data()


def pytest_sessionfinish(session, exitstatus):
    """Hook called after entire test session."""
    _tracker.save_data()

    # Print slowest tests report
    slowest = _tracker.get_slowest_tests(10)
    if slowest:
        print("\n" + "=" * 60)
        print("Slowest 10 Tests (by average execution time):")
        print("=" * 60)
        for i, (test_name, avg_ms) in enumerate(slowest, 1):
            print(f"{i:2d}. {test_name:50s} {avg_ms:8.2f}ms")
        print("=" * 60)


# pytest plugin registration
def pytest_configure(config):
    """Register pytest plugin."""
    config.pluginmanager.register(sys.modules[__name__])
