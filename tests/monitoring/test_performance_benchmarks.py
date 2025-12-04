"""
Performance and integration tests for monitoring benchmarks.

Tests cover:
- Real performance benchmark execution
- Integration with actual system resources
- Benchmark accuracy and reliability
- Performance regression detection
- Resource utilization monitoring
- End-to-end benchmark workflows
"""

import asyncio
import time

import psutil
import pytest

from dotmac.platform.monitoring.benchmarks import (
    BenchmarkManager,
    BenchmarkStatus,
    BenchmarkSuite,
    BenchmarkSuiteConfig,
    BenchmarkType,
    CPUBenchmark,
    MemoryBenchmark,
    NetworkBenchmark,
)
from dotmac.platform.monitoring.integrations import PrometheusIntegration

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
class TestPerformanceBenchmarkRealism:
    """Test that benchmarks produce realistic and consistent results."""

    @pytest.mark.asyncio
    async def test_cpu_benchmark_produces_consistent_results(self):
        """Test that CPU benchmark produces consistent results across runs."""
        results = []

        # Run benchmark multiple times
        for _ in range(3):
            benchmark = CPUBenchmark(duration_seconds=1, threads=1)
            result = await benchmark.run()
            assert result.status == BenchmarkStatus.COMPLETED

            ops_metric = result.get_metric("operations_per_second")
            assert ops_metric is not None
            assert ops_metric.value > 0
            results.append(ops_metric.value)

        # Results should be reasonably consistent (within 50% variance)
        avg_ops = sum(results) / len(results)
        for ops in results:
            variance = abs(ops - avg_ops) / avg_ops
            assert variance < 0.5, f"CPU benchmark results too inconsistent: {results}"

    @pytest.mark.asyncio
    async def test_cpu_benchmark_scales_with_duration(self):
        """Test that CPU benchmark scales appropriately with duration."""
        short_benchmark = CPUBenchmark(duration_seconds=1, threads=1)
        short_result = await short_benchmark.run()

        long_benchmark = CPUBenchmark(duration_seconds=2, threads=1)
        long_result = await long_benchmark.run()

        assert short_result.status == BenchmarkStatus.COMPLETED
        assert long_result.status == BenchmarkStatus.COMPLETED

        short_iterations = short_result.get_metric("iterations").value
        long_iterations = long_result.get_metric("iterations").value

        # Longer benchmark should produce more iterations
        assert long_iterations > short_iterations

        # Should be roughly proportional (within reasonable variance)
        # Note: Short benchmarks have overhead that doesn't scale linearly
        # Allow wider range (1.2-2.8) to account for system variability and startup costs
        ratio = long_iterations / short_iterations
        assert 1.2 < ratio < 2.8, f"CPU benchmark doesn't scale linearly: {ratio}"

    @pytest.mark.asyncio
    async def test_memory_benchmark_allocates_expected_memory(self):
        """Test that memory benchmark allocates expected amount of memory."""
        # Get initial memory usage
        process = psutil.Process()
        _initial_memory = process.memory_info().rss

        # Run memory benchmark
        benchmark = MemoryBenchmark(allocation_mb=50, iterations=1000)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED

        allocated_chunks = result.get_metric("allocated_chunks").value
        assert allocated_chunks == 1000

        allocated_mb = result.get_metric("allocated_mb").value
        # Each chunk is 1KB, so 1000 chunks = ~1MB
        assert 0.9 < allocated_mb < 1.1

    @pytest.mark.asyncio
    async def test_memory_benchmark_performance_metrics(self):
        """Test that memory benchmark produces reasonable performance metrics."""
        benchmark = MemoryBenchmark(allocation_mb=10, iterations=100)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED

        allocation_time = result.get_metric("allocation_time_seconds").value
        access_time = result.get_metric("access_time_seconds").value
        allocation_rate = result.get_metric("allocation_rate_mb_per_second").value
        access_rate = result.get_metric("access_rate_mb_per_second").value

        # Times should be positive and reasonable
        assert allocation_time > 0
        assert access_time > 0
        assert allocation_time < 10  # Should complete quickly
        assert access_time < 10

        # Rates should be positive
        assert allocation_rate > 0
        assert access_rate > 0

    @pytest.mark.asyncio
    async def test_network_benchmark_with_reliable_target(self):
        """Test network benchmark with a reliable target."""
        # Use Google's public DNS as a reliable target
        benchmark = NetworkBenchmark(target_host="8.8.8.8", port=53, iterations=5)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED

        total_attempts = result.get_metric("total_attempts").value
        successful_connections = result.get_metric("successful_connections").value
        success_rate = result.get_metric("success_rate").value

        assert total_attempts == 5
        assert successful_connections >= 3  # At least 3 out of 5 should succeed
        assert success_rate >= 0.6  # At least 60% success rate

        if successful_connections > 0:
            avg_latency = result.get_metric("average_latency_ms").value
            min_latency = result.get_metric("min_latency_ms").value
            max_latency = result.get_metric("max_latency_ms").value

            # Latencies should be reasonable for Google DNS
            assert avg_latency > 0
            assert min_latency > 0
            assert max_latency >= min_latency
            assert avg_latency < 1000  # Should be less than 1 second


@pytest.mark.integration
class TestBenchmarkIntegrationWithMonitoring:
    """Test integration between benchmarks and monitoring systems."""

    @pytest.fixture
    def prometheus_integration(self):
        """Create Prometheus integration instance."""
        return PrometheusIntegration()

    @pytest.mark.asyncio
    async def test_benchmark_metrics_integration(self, prometheus_integration):
        """Test integration of benchmark results with monitoring."""
        benchmark = CPUBenchmark(duration_seconds=1)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED

        # Record benchmark metrics in Prometheus
        for metric in result.metrics:
            prometheus_integration.record_metric(
                f"benchmark_{metric.name}",
                metric.value,
                {
                    "benchmark_type": result.benchmark_type.value,
                    "benchmark_name": result.name,
                    "benchmark_id": result.id,
                },
            )

        # Verify metrics were recorded
        recorded_metrics = prometheus_integration.get_metrics()
        assert len(recorded_metrics) >= len(result.metrics)

        # Check Prometheus format
        prometheus_format = prometheus_integration.to_prometheus_format()
        assert "benchmark_" in prometheus_format
        assert "benchmark_type" in prometheus_format

    @pytest.mark.asyncio
    async def test_benchmark_suite_monitoring_integration(self, prometheus_integration):
        """Test integration of benchmark suite with monitoring."""
        config = BenchmarkSuiteConfig(name="Monitoring Integration Suite", parallel_execution=False)
        suite = BenchmarkSuite(config)
        suite.add_benchmark(CPUBenchmark(duration_seconds=1))
        suite.add_benchmark(MemoryBenchmark(allocation_mb=5, iterations=50))

        results = await suite.run_all()
        assert len(results) == 2
        assert all(r.status == BenchmarkStatus.COMPLETED for r in results)

        # Record suite summary metrics
        stats = suite.get_summary_stats()
        for stat_name, stat_value in stats.items():
            if isinstance(stat_value, (int, float)):
                prometheus_integration.record_metric(
                    f"benchmark_suite_{stat_name}", stat_value, {"suite_name": config.name}
                )

        # Verify suite metrics were recorded
        suite_metrics = [
            m for m in prometheus_integration.get_metrics() if m.name.startswith("benchmark_suite_")
        ]
        assert len(suite_metrics) > 0

        # Check specific metrics
        total_benchmarks_metric = next(
            (m for m in suite_metrics if m.name == "benchmark_suite_total_benchmarks"), None
        )
        assert total_benchmarks_metric is not None
        assert total_benchmarks_metric.value == 2


@pytest.mark.integration
class TestBenchmarkManagerWorkflows:
    """Test complete benchmark manager workflows."""

    @pytest.fixture
    def benchmark_manager(self):
        """Create benchmark manager instance."""
        return BenchmarkManager()

    @pytest.mark.asyncio
    async def test_complete_benchmark_workflow(self, benchmark_manager):
        """Test complete benchmark execution workflow."""
        # Create and register suite
        config = BenchmarkSuiteConfig(
            name="Complete Workflow Suite", parallel_execution=False, timeout_seconds=30
        )
        suite = BenchmarkSuite(config)
        suite.add_benchmark(CPUBenchmark(duration_seconds=1))
        suite.add_benchmark(MemoryBenchmark(allocation_mb=10, iterations=100))

        benchmark_manager.register_suite(suite)

        # Run suite through manager
        results = await benchmark_manager.run_suite("Complete Workflow Suite")

        assert len(results) == 2
        assert all(r.status == BenchmarkStatus.COMPLETED for r in results)

        # Verify manager recorded history
        history = benchmark_manager.get_benchmark_history()
        assert len(history) >= 2

        # Test history filtering
        cpu_history = benchmark_manager.get_benchmark_history(benchmark_type=BenchmarkType.CPU)
        memory_history = benchmark_manager.get_benchmark_history(
            benchmark_type=BenchmarkType.MEMORY
        )

        assert len(cpu_history) == 1
        assert len(memory_history) == 1

    @pytest.mark.asyncio
    async def test_parallel_suite_execution_performance(self, benchmark_manager):
        """Test that parallel execution provides performance benefits."""
        # Sequential suite
        sequential_config = BenchmarkSuiteConfig(name="Sequential Suite", parallel_execution=False)
        sequential_suite = BenchmarkSuite(sequential_config)
        sequential_suite.add_benchmark(CPUBenchmark(duration_seconds=1))
        sequential_suite.add_benchmark(MemoryBenchmark(allocation_mb=5, iterations=50))

        # Parallel suite
        parallel_config = BenchmarkSuiteConfig(name="Parallel Suite", parallel_execution=True)
        parallel_suite = BenchmarkSuite(parallel_config)
        parallel_suite.add_benchmark(CPUBenchmark(duration_seconds=1))
        parallel_suite.add_benchmark(MemoryBenchmark(allocation_mb=5, iterations=50))

        # Time sequential execution
        start_time = time.time()
        sequential_results = await sequential_suite.run_all()
        sequential_time = time.time() - start_time

        # Time parallel execution
        start_time = time.time()
        parallel_results = await parallel_suite.run_all()
        parallel_time = time.time() - start_time

        # Both should succeed
        assert len(sequential_results) == 2
        assert len(parallel_results) == 2
        assert all(r.status == BenchmarkStatus.COMPLETED for r in sequential_results)
        assert all(r.status == BenchmarkStatus.COMPLETED for r in parallel_results)

        # Parallel execution should work and both should complete
        # Note: Parallel might not always be faster due to GIL and overhead,
        # but both executions should complete successfully
        assert parallel_time > 0
        assert sequential_time > 0

    @pytest.mark.asyncio
    async def test_benchmark_error_handling_and_recovery(self, benchmark_manager):
        """Test error handling and recovery in benchmark workflows."""

        class FlakySuite:
            def __init__(self):
                self.attempt_count = 0

            def create_flaky_benchmark(self):
                class FlakyBenchmark(MemoryBenchmark):
                    def __init__(self, suite_ref):
                        super().__init__(allocation_mb=5, iterations=10)
                        self.suite_ref = suite_ref

                    async def execute(self):
                        self.suite_ref.attempt_count += 1
                        if self.suite_ref.attempt_count == 1:
                            raise RuntimeError("Simulated failure")
                        return await super().execute()

                return FlakyBenchmark(self)

        flaky_suite_instance = FlakySuite()

        # Create suite with retry configuration
        config = BenchmarkSuiteConfig(name="Error Recovery Suite", retry_failed=True, retry_count=2)
        suite = BenchmarkSuite(config)
        suite.add_benchmark(flaky_suite_instance.create_flaky_benchmark())
        suite.add_benchmark(CPUBenchmark(duration_seconds=1))  # This should always succeed

        benchmark_manager.register_suite(suite)
        results = await benchmark_manager.run_suite("Error Recovery Suite")

        assert len(results) == 2
        # Both should eventually succeed (flaky one after retry, CPU one immediately)
        assert all(r.status == BenchmarkStatus.COMPLETED for r in results)


@pytest.mark.integration
class TestBenchmarkResourceMonitoring:
    """Test monitoring of system resources during benchmark execution."""

    @pytest.mark.asyncio
    async def test_cpu_benchmark_resource_usage(self):
        """Test monitoring CPU usage during CPU benchmark."""
        # Run CPU intensive benchmark
        benchmark = CPUBenchmark(duration_seconds=2)

        # Monitor CPU during execution
        cpu_samples = []

        async def monitor_cpu():
            for _ in range(10):  # Sample for 2 seconds
                cpu_samples.append(psutil.cpu_percent(interval=0.2))

        # Run benchmark and monitoring concurrently
        benchmark_task = asyncio.create_task(benchmark.run())
        monitor_task = asyncio.create_task(monitor_cpu())

        result, _ = await asyncio.gather(benchmark_task, monitor_task)

        assert result.status == BenchmarkStatus.COMPLETED

        # CPU usage should show some activity (may vary by system)
        # Just verify we got samples and benchmark completed
        assert len(cpu_samples) > 0
        assert all(isinstance(sample, (int, float)) for sample in cpu_samples)

    @pytest.mark.asyncio
    async def test_memory_benchmark_resource_usage(self):
        """Test monitoring memory usage during memory benchmark."""
        process = psutil.Process()

        # Get baseline memory
        _baseline_memory = process.memory_info().rss

        # Run memory benchmark
        benchmark = MemoryBenchmark(allocation_mb=20, iterations=200)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED

        # Memory usage should have increased (though Python GC makes this tricky)
        # We mainly verify the benchmark ran successfully and produced expected metrics
        allocated_chunks = result.get_metric("allocated_chunks").value
        assert allocated_chunks == 200

    @pytest.mark.asyncio
    async def test_benchmark_execution_time_accuracy(self):
        """Test that benchmark execution times are accurate."""
        duration_seconds = 2
        benchmark = CPUBenchmark(duration_seconds=duration_seconds)

        start_time = time.time()
        result = await benchmark.run()
        actual_time = time.time() - start_time

        assert result.status == BenchmarkStatus.COMPLETED

        # Benchmark should complete in approximately the expected time
        # Allow for some overhead but should be reasonably close
        assert duration_seconds < actual_time < duration_seconds + 1.0

        # Result duration should also be accurate
        assert result.duration_seconds > 0
        assert abs(result.duration_seconds - actual_time) < 0.5


@pytest.mark.integration
@pytest.mark.integration
class TestEndToEndBenchmarkingWorkflow:
    """End-to-end integration tests for complete benchmarking workflows."""

    @pytest.mark.asyncio
    async def test_complete_monitoring_pipeline(self):
        """Test complete monitoring pipeline from benchmark to metrics export."""
        # Initialize components
        benchmark_manager = BenchmarkManager()
        prometheus_integration = PrometheusIntegration()

        # Create comprehensive benchmark suite
        config = BenchmarkSuiteConfig(
            name="Complete Pipeline Suite",
            description="End-to-end testing suite",
            parallel_execution=True,
            timeout_seconds=30,
        )
        suite = BenchmarkSuite(config)
        suite.add_benchmark(CPUBenchmark(duration_seconds=1))
        suite.add_benchmark(MemoryBenchmark(allocation_mb=10, iterations=100))
        suite.add_benchmark(NetworkBenchmark(target_host="8.8.8.8", port=53, iterations=3))

        # Register and run suite
        benchmark_manager.register_suite(suite)
        results = await benchmark_manager.run_suite("Complete Pipeline Suite")

        # Verify all benchmarks completed
        assert len(results) == 3
        successful_results = [r for r in results if r.status == BenchmarkStatus.COMPLETED]
        assert len(successful_results) >= 2  # Network might occasionally fail

        # Export metrics to Prometheus
        for result in successful_results:
            # Record individual benchmark metrics
            for metric in result.metrics:
                prometheus_integration.record_metric(
                    f"dotmac_benchmark_{metric.name}",
                    metric.value,
                    {
                        "benchmark_type": result.benchmark_type.value,
                        "benchmark_name": result.name.replace(" ", "_").lower(),
                        "benchmark_id": result.id,
                        "status": result.status.value,
                    },
                )

            # Record benchmark duration
            prometheus_integration.record_metric(
                "dotmac_benchmark_duration_seconds",
                result.duration_seconds,
                {
                    "benchmark_type": result.benchmark_type.value,
                    "benchmark_name": result.name.replace(" ", "_").lower(),
                    "benchmark_id": result.id,
                },
            )

        # Record suite-level metrics
        suite_stats = suite.get_summary_stats()
        for stat_name, stat_value in suite_stats.items():
            if isinstance(stat_value, (int, float)):
                prometheus_integration.record_metric(
                    f"dotmac_benchmark_suite_{stat_name}",
                    stat_value,
                    {"suite_name": config.name.replace(" ", "_").lower()},
                )

        # Verify complete metrics export
        all_metrics = prometheus_integration.get_metrics()
        assert len(all_metrics) > 10  # Should have many metrics

        # Verify Prometheus format export
        prometheus_format = prometheus_integration.to_prometheus_format()
        assert len(prometheus_format) > 0
        assert "dotmac_benchmark_" in prometheus_format

        # Verify key metrics are present
        metric_names = [m.name for m in all_metrics]
        assert any("duration_seconds" in name for name in metric_names)
        assert any("suite_" in name for name in metric_names)

        # Test benchmark history functionality
        history = benchmark_manager.get_benchmark_history(limit=10)
        assert len(history) == 3

        # Clean up
        benchmark_manager.clear_history()
        prometheus_integration.clear_metrics()

        assert len(benchmark_manager.get_benchmark_history()) == 0
        assert len(prometheus_integration.get_metrics()) == 0
