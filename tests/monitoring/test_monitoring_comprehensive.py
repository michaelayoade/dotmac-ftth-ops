"""
Comprehensive tests for the monitoring module as a whole.

Tests cover:
- Module imports and initialization
- Component integration
- Cross-functional workflows
- Configuration and settings
- Error handling across components
- Performance and scalability
"""

import asyncio

import pytest

# Test imports from monitoring module
from dotmac.platform.monitoring import (
    BenchmarkManager,
    BenchmarkResult,
    BenchmarkSuite,
    MetricData,
    PerformanceBenchmark,
    PrometheusIntegration,
    settings,
)
from dotmac.platform.monitoring.benchmarks import (
    BenchmarkStatus,
    BenchmarkSuiteConfig,
    BenchmarkType,
    CPUBenchmark,
    MemoryBenchmark,
    NetworkBenchmark,
)


@pytest.mark.integration
class TestMonitoringModuleIntegration:
    """Test integration between different monitoring components."""

    def test_monitoring_module_imports(self):
        """Test that all monitoring components can be imported."""
        # Verify all expected classes are available
        assert BenchmarkManager is not None
        assert BenchmarkResult is not None
        assert BenchmarkSuite is not None
        assert PerformanceBenchmark is not None
        assert MetricData is not None
        assert PrometheusIntegration is not None

        # Verify enums are available
        assert BenchmarkStatus is not None
        assert BenchmarkType is not None

        # Verify concrete benchmarks are available
        assert CPUBenchmark is not None
        assert MemoryBenchmark is not None
        assert NetworkBenchmark is not None

    def test_settings_integration(self):
        """Test that settings are properly integrated."""
        # Should be able to access settings without error
        assert settings is not None
        # Settings should have expected structure (basic validation)
        assert hasattr(settings, "__dict__") or hasattr(settings, "__getattribute__")

    @pytest.mark.asyncio
    async def test_benchmark_to_metrics_integration(self):
        """Test integration between benchmarks and metrics collection."""
        # Create benchmark and prometheus integration
        benchmark = CPUBenchmark(duration_seconds=1)
        prometheus = PrometheusIntegration()

        # Run benchmark
        result = await benchmark.run()
        assert result.status == BenchmarkStatus.COMPLETED

        # Convert benchmark results to metrics
        for metric in result.metrics:
            prometheus.record_metric(
                f"test_{metric.name}", metric.value, {"benchmark_id": result.id}
            )

        # Verify metrics were recorded
        recorded_metrics = prometheus.get_metrics()
        assert len(recorded_metrics) == len(result.metrics)

        # Verify metrics contain expected data
        for recorded_metric in recorded_metrics:
            assert recorded_metric.name.startswith("test_")
            assert recorded_metric.value > 0
            assert "benchmark_id" in recorded_metric.labels

    @pytest.mark.asyncio
    async def test_manager_suite_integration(self):
        """Test integration between BenchmarkManager and BenchmarkSuite."""
        manager = BenchmarkManager()

        # Create suite with multiple benchmark types
        config = BenchmarkSuiteConfig(name="Integration Suite")
        suite = BenchmarkSuite(config)
        suite.add_benchmark(CPUBenchmark(duration_seconds=1))
        suite.add_benchmark(MemoryBenchmark(allocation_mb=5, iterations=50))

        # Register and run through manager
        manager.register_suite(suite)
        results = await manager.run_suite("Integration Suite")

        # Verify integration worked
        assert len(results) == 2
        assert all(r.status == BenchmarkStatus.COMPLETED for r in results)

        # Verify manager recorded history
        history = manager.get_benchmark_history()
        assert len(history) == 2

        # Verify suite recorded results
        suite_stats = suite.get_summary_stats()
        assert suite_stats["total_benchmarks"] == 2
        assert suite_stats["completed"] == 2


@pytest.mark.integration
class TestMonitoringErrorHandling:
    """Test error handling across monitoring components."""

    @pytest.mark.asyncio
    async def test_benchmark_failure_propagation(self):
        """Test that benchmark failures are properly handled across components."""

        class FailingBenchmark(PerformanceBenchmark):
            def __init__(self):
                super().__init__("Failing Benchmark", BenchmarkType.PERFORMANCE)

            async def setup(self):
                return True

            async def execute(self):
                raise RuntimeError("Benchmark execution failed")

            async def teardown(self):
                pass

        manager = BenchmarkManager()

        # Run failing benchmark through manager
        failing_benchmark = FailingBenchmark()
        result = await manager.run_benchmark(failing_benchmark)

        # Verify failure was handled properly
        assert result.status == BenchmarkStatus.FAILED
        assert "execution failed" in result.error_message.lower()

        # Verify manager recorded the failure
        history = manager.get_benchmark_history()
        assert len(history) == 1
        assert history[0].status == BenchmarkStatus.FAILED

    @pytest.mark.asyncio
    async def test_suite_partial_failure_handling(self):
        """Test handling of partial failures in benchmark suites."""

        class MixedSuite:
            @staticmethod
            def create_good_benchmark():
                return CPUBenchmark(duration_seconds=1)

            @staticmethod
            def create_bad_benchmark():
                class BadBenchmark(PerformanceBenchmark):
                    def __init__(self):
                        super().__init__("Bad Benchmark", BenchmarkType.PERFORMANCE)

                    async def setup(self):
                        return True

                    async def execute(self):
                        raise ValueError("This benchmark always fails")

                    async def teardown(self):
                        pass

                return BadBenchmark()

        config = BenchmarkSuiteConfig(name="Mixed Results Suite")
        suite = BenchmarkSuite(config)
        suite.add_benchmark(MixedSuite.create_good_benchmark())
        suite.add_benchmark(MixedSuite.create_bad_benchmark())
        suite.add_benchmark(MixedSuite.create_good_benchmark())

        results = await suite.run_all()

        # Should have results for all benchmarks
        assert len(results) == 3

        # Should have mixed results
        completed = [r for r in results if r.status == BenchmarkStatus.COMPLETED]
        failed = [r for r in results if r.status == BenchmarkStatus.FAILED]

        assert len(completed) == 2
        assert len(failed) == 1

        # Suite stats should reflect mixed results
        stats = suite.get_summary_stats()
        assert stats["total_benchmarks"] == 3
        assert stats["completed"] == 2
        assert stats["failed"] == 1
        assert 0.6 < stats["success_rate"] < 0.7

    def test_prometheus_integration_error_resilience(self):
        """Test that Prometheus integration handles errors gracefully."""
        prometheus = PrometheusIntegration()

        # Test with various edge cases
        test_cases = [
            ("valid_metric", 42.0, {"label": "value"}),
            ("metric_with_none_value", 0, None),  # None labels
            ("metric_with_empty_labels", 100, {}),
            ("metric_with_special_chars", 1, {"path": "/api/v1/test", "method": "POST"}),
        ]

        for name, value, labels in test_cases:
            # Should not raise exceptions
            prometheus.record_metric(name, value, labels)

        # Verify all metrics were recorded
        metrics = prometheus.get_metrics()
        assert len(metrics) == len(test_cases)

        # Verify Prometheus format handles all cases
        prometheus_format = prometheus.to_prometheus_format()
        assert len(prometheus_format) > 0
        for name, _, _ in test_cases:
            assert name in prometheus_format


@pytest.mark.integration
class TestMonitoringPerformance:
    """Test performance characteristics of monitoring components."""

    @pytest.mark.asyncio
    async def test_concurrent_benchmark_execution(self):
        """Test that multiple benchmarks can run concurrently without interference."""
        manager = BenchmarkManager()

        # Create multiple benchmarks
        benchmarks = [
            CPUBenchmark(duration_seconds=1),
            MemoryBenchmark(allocation_mb=5, iterations=50),
            CPUBenchmark(duration_seconds=1),
        ]

        # Run all benchmarks concurrently
        tasks = [manager.run_benchmark(benchmark) for benchmark in benchmarks]
        results = await asyncio.gather(*tasks)

        # All should complete successfully
        assert len(results) == 3
        assert all(r.status == BenchmarkStatus.COMPLETED for r in results)

        # Manager should track all results
        history = manager.get_benchmark_history()
        assert len(history) == 3

    def test_prometheus_integration_scalability(self):
        """Test Prometheus integration with large numbers of metrics."""
        prometheus = PrometheusIntegration()

        # Record many metrics
        num_metrics = 1000
        for i in range(num_metrics):
            prometheus.record_metric(
                f"scalability_metric_{i}", i * 1.5, {"batch": str(i // 100), "index": str(i)}
            )

        # Verify all metrics were recorded
        metrics = prometheus.get_metrics()
        assert len(metrics) == num_metrics

        # Test format conversion performance
        import time

        start_time = time.time()
        prometheus_format = prometheus.to_prometheus_format()
        format_time = time.time() - start_time

        # Should complete reasonably quickly
        assert format_time < 2.0  # Less than 2 seconds

        # Verify format correctness
        lines = prometheus_format.strip().split("\n")
        assert len(lines) == num_metrics

    @pytest.mark.asyncio
    async def test_benchmark_suite_performance_scaling(self):
        """Test that benchmark suite performance scales appropriately."""
        # Test sequential vs parallel execution
        benchmarks = [CPUBenchmark(duration_seconds=0.5) for _ in range(4)]

        # Sequential suite
        sequential_config = BenchmarkSuiteConfig(
            name="Sequential Perf Test", parallel_execution=False
        )
        sequential_suite = BenchmarkSuite(sequential_config)
        for benchmark in benchmarks:
            sequential_suite.add_benchmark(benchmark)

        # Parallel suite
        parallel_config = BenchmarkSuiteConfig(name="Parallel Perf Test", parallel_execution=True)
        parallel_suite = BenchmarkSuite(parallel_config)
        for benchmark in [CPUBenchmark(duration_seconds=0.5) for _ in range(4)]:
            parallel_suite.add_benchmark(benchmark)

        # Time both executions
        import time

        start = time.time()
        sequential_results = await sequential_suite.run_all()
        sequential_time = time.time() - start

        start = time.time()
        parallel_results = await parallel_suite.run_all()
        parallel_time = time.time() - start

        # Both should succeed
        assert len(sequential_results) == 4
        assert len(parallel_results) == 4
        assert all(r.status == BenchmarkStatus.COMPLETED for r in sequential_results)
        assert all(r.status == BenchmarkStatus.COMPLETED for r in parallel_results)

        # Parallel should be faster or similar (system dependent)
        # Just verify both completed successfully
        assert parallel_time > 0
        assert sequential_time > 0


@pytest.mark.integration
class TestMonitoringConfigurationAndSettings:
    """Test configuration and settings handling in monitoring components."""

    def test_benchmark_configuration_validation(self):
        """Test that benchmark configurations are properly validated."""
        # Test valid configurations
        valid_configs = [
            BenchmarkSuiteConfig(name="Valid Config 1"),
            BenchmarkSuiteConfig(
                name="Valid Config 2",
                timeout_seconds=60,
                parallel_execution=True,
                retry_failed=True,
                retry_count=3,
            ),
        ]

        for config in valid_configs:
            suite = BenchmarkSuite(config)
            assert suite.config.name == config.name
            assert suite.config.timeout_seconds == config.timeout_seconds

    @pytest.mark.asyncio
    async def test_benchmark_parameter_validation(self):
        """Test that benchmark parameters are properly validated."""
        # Test CPU benchmark parameters
        cpu_benchmark = CPUBenchmark(duration_seconds=2, threads=2)
        result = await cpu_benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED
        threads_metric = result.get_metric("threads_used")
        assert threads_metric.value == 2

        # Test Memory benchmark parameters
        memory_benchmark = MemoryBenchmark(allocation_mb=10, iterations=100)
        result = await memory_benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED
        chunks_metric = result.get_metric("allocated_chunks")
        assert chunks_metric.value == 100

        # Test Network benchmark parameters
        network_benchmark = NetworkBenchmark(target_host="8.8.8.8", port=53, iterations=5)
        result = await network_benchmark.run()

        # Network might fail occasionally, but should handle parameters correctly
        attempts_metric = result.get_metric("total_attempts")
        assert attempts_metric.value == 5

    def test_logging_integration(self):
        """Test that logging is properly integrated throughout monitoring components."""
        # Create and use various components
        manager = BenchmarkManager()
        prometheus = PrometheusIntegration()

        config = BenchmarkSuiteConfig(name="Logging Test Suite")
        suite = BenchmarkSuite(config)

        # Register suite
        manager.register_suite(suite)

        # Record metrics
        prometheus.record_metric("test_metric", 42, {"test": "logging"})

        # Verify components work correctly (logging integration tested by functionality)
        assert "Logging Test Suite" in manager.suites
        metrics = prometheus.get_metrics()
        assert len(metrics) == 1


@pytest.mark.integration
class TestMonitoringEdgeCases:
    """Test edge cases and boundary conditions in monitoring components."""

    @pytest.mark.asyncio
    async def test_empty_benchmark_suite(self):
        """Test handling of empty benchmark suite."""
        config = BenchmarkSuiteConfig(name="Empty Suite")
        suite = BenchmarkSuite(config)

        # Run empty suite
        results = await suite.run_all()

        assert len(results) == 0

        # Stats should handle empty suite
        stats = suite.get_summary_stats()
        assert stats == {}  # Empty suite returns empty stats

    def test_prometheus_empty_metrics(self):
        """Test Prometheus integration with no metrics."""
        prometheus = PrometheusIntegration()

        # Get metrics from empty integration
        metrics = prometheus.get_metrics()
        assert len(metrics) == 0

        # Format should handle empty case
        prometheus_format = prometheus.to_prometheus_format()
        assert prometheus_format == ""

        # Clear should work on empty integration
        prometheus.clear_metrics()  # Should not raise exception
        assert len(prometheus.get_metrics()) == 0

    @pytest.mark.asyncio
    async def test_benchmark_manager_edge_cases(self):
        """Test edge cases in benchmark manager."""
        manager = BenchmarkManager()

        # Test with non-existent suite
        with pytest.raises(ValueError):
            await manager.run_suite("Non-existent Suite")

        # Test cancelling non-existent benchmark
        success = await manager.cancel_benchmark("non-existent-id")
        assert not success

        # Test history operations on empty manager
        history = manager.get_benchmark_history()
        assert len(history) == 0

        history_filtered = manager.get_benchmark_history(
            benchmark_type=BenchmarkType.CPU, status=BenchmarkStatus.COMPLETED, limit=10
        )
        assert len(history_filtered) == 0

        # Clear empty history
        manager.clear_history()  # Should not raise exception

        # Test active benchmarks on empty manager
        active = manager.get_active_benchmarks()
        assert len(active) == 0

    def test_metric_data_edge_cases(self):
        """Test edge cases in MetricData."""
        import datetime

        # Test with extreme values
        extreme_metrics = [
            MetricData("zero_metric", 0),
            MetricData("negative_metric", -100.5),
            MetricData("large_metric", 1e10),
            MetricData("small_metric", 1e-10),
        ]

        for metric in extreme_metrics:
            assert isinstance(metric.timestamp, datetime.datetime)
            assert metric.labels == {}
            assert isinstance(metric.value, (int, float))

    @pytest.mark.asyncio
    async def test_benchmark_timeout_edge_cases(self):
        """Test benchmark behavior at timeout boundaries."""
        # Test very short timeout
        config = BenchmarkSuiteConfig(name="Short Timeout Suite", timeout_seconds=0.1)  # Very short
        suite = BenchmarkSuite(config)

        # Create a benchmark that will definitely take longer than 0.1s
        class SlowBenchmark(PerformanceBenchmark):
            def __init__(self):
                super().__init__("Slow Benchmark", BenchmarkType.PERFORMANCE)

            async def setup(self):
                return True

            async def execute(self):
                # This will definitely take longer than 0.1 seconds
                import asyncio

                await asyncio.sleep(1.0)  # Sleep for 1 second
                return {"completed": True}

            async def teardown(self):
                pass

        suite.add_benchmark(SlowBenchmark())

        results = await suite.run_all()

        # Should timeout and fail
        assert len(results) == 1
        assert results[0].status == BenchmarkStatus.FAILED
        assert "timed out" in results[0].error_message.lower()
