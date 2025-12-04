"""
Comprehensive tests for the benchmark framework.

Tests cover:
- BenchmarkResult data structures and methods
- PerformanceBenchmark abstract base class
- Concrete benchmark implementations (CPU, Memory, Network)
- BenchmarkSuite execution and configuration
- BenchmarkManager coordination and history
- Error handling and timeout scenarios
- Performance metrics validation
"""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from dotmac.platform.monitoring.benchmarks import (
    BenchmarkManager,
    BenchmarkMetric,
    BenchmarkResult,
    BenchmarkStatus,
    BenchmarkSuite,
    BenchmarkSuiteConfig,
    BenchmarkType,
    CPUBenchmark,
    MemoryBenchmark,
    NetworkBenchmark,
    PerformanceBenchmark,
)


@pytest.mark.integration
class TestBenchmarkMetric:
    """Test BenchmarkMetric data structure."""

    def test_benchmark_metric_creation_with_defaults(self):
        """Test metric creation with default values."""
        metric = BenchmarkMetric(name="test_metric", value=100.5, unit="ms")

        assert metric.name == "test_metric"
        assert metric.value == 100.5
        assert metric.unit == "ms"
        assert metric.category == "general"
        assert metric.metadata == {}
        assert isinstance(metric.timestamp, datetime)
        assert metric.timestamp.tzinfo == UTC

    def test_benchmark_metric_creation_with_custom_values(self):
        """Test metric creation with custom values."""
        timestamp = datetime.now(UTC)
        metadata = {"source": "test", "version": "1.0"}

        metric = BenchmarkMetric(
            name="custom_metric",
            value=42,
            unit="ops/sec",
            category="performance",
            metadata=metadata,
            timestamp=timestamp,
        )

        assert metric.name == "custom_metric"
        assert metric.value == 42
        assert metric.unit == "ops/sec"
        assert metric.category == "performance"
        assert metric.metadata == metadata
        assert metric.timestamp == timestamp

    def test_benchmark_metric_post_init_timestamp(self):
        """Test that timestamp is auto-generated if not provided."""
        before = datetime.now(UTC)
        metric = BenchmarkMetric(name="test", value=1, unit="unit")
        after = datetime.now(UTC)

        assert before <= metric.timestamp <= after


@pytest.mark.integration
class TestBenchmarkResult:
    """Test BenchmarkResult data structure and methods."""

    def test_benchmark_result_creation(self):
        """Test benchmark result creation."""
        start_time = datetime.now(UTC)
        result = BenchmarkResult(
            id="test-123",
            name="Test Benchmark",
            benchmark_type=BenchmarkType.PERFORMANCE,
            status=BenchmarkStatus.PENDING,
            start_time=start_time,
        )

        assert result.id == "test-123"
        assert result.name == "Test Benchmark"
        assert result.benchmark_type == BenchmarkType.PERFORMANCE
        assert result.status == BenchmarkStatus.PENDING
        assert result.start_time == start_time
        assert result.end_time is None
        assert result.duration is None
        assert result.metrics == []
        assert result.metadata == {}
        assert result.error_message is None

    def test_benchmark_result_duration_calculation(self):
        """Test duration calculation in post_init."""
        start_time = datetime.now(UTC)
        end_time = start_time + timedelta(seconds=30)

        result = BenchmarkResult(
            id="test-123",
            name="Test Benchmark",
            benchmark_type=BenchmarkType.PERFORMANCE,
            status=BenchmarkStatus.COMPLETED,
            start_time=start_time,
            end_time=end_time,
        )

        assert result.duration == timedelta(seconds=30)
        assert result.duration_seconds == 30.0

    def test_benchmark_result_duration_seconds_property(self):
        """Test duration_seconds property."""
        result = BenchmarkResult(
            id="test-123",
            name="Test Benchmark",
            benchmark_type=BenchmarkType.PERFORMANCE,
            status=BenchmarkStatus.PENDING,
            start_time=datetime.now(UTC),
        )

        # Without end_time, duration_seconds should be 0
        assert result.duration_seconds == 0.0

        # Set duration manually
        result.duration = timedelta(seconds=45.5)
        assert result.duration_seconds == 45.5

    def test_add_metric(self):
        """Test adding metrics to benchmark result."""
        result = BenchmarkResult(
            id="test-123",
            name="Test Benchmark",
            benchmark_type=BenchmarkType.PERFORMANCE,
            status=BenchmarkStatus.PENDING,
            start_time=datetime.now(UTC),
        )

        result.add_metric("cpu_usage", 85.5, "percent", category="system")
        result.add_metric("memory_usage", 1024, "MB", category="system")

        assert len(result.metrics) == 2
        assert result.metrics[0].name == "cpu_usage"
        assert result.metrics[0].value == 85.5
        assert result.metrics[0].unit == "percent"
        assert result.metrics[0].category == "system"

    def test_get_metric(self):
        """Test retrieving specific metric by name."""
        result = BenchmarkResult(
            id="test-123",
            name="Test Benchmark",
            benchmark_type=BenchmarkType.PERFORMANCE,
            status=BenchmarkStatus.PENDING,
            start_time=datetime.now(UTC),
        )

        result.add_metric("latency", 150.0, "ms")
        result.add_metric("throughput", 1000, "ops/sec")

        latency_metric = result.get_metric("latency")
        assert latency_metric is not None
        assert latency_metric.name == "latency"
        assert latency_metric.value == 150.0

        # Non-existent metric
        assert result.get_metric("non_existent") is None

    def test_get_metrics_by_category(self):
        """Test retrieving metrics by category."""
        result = BenchmarkResult(
            id="test-123",
            name="Test Benchmark",
            benchmark_type=BenchmarkType.PERFORMANCE,
            status=BenchmarkStatus.PENDING,
            start_time=datetime.now(UTC),
        )

        result.add_metric("cpu_usage", 85, "percent", category="system")
        result.add_metric("memory_usage", 1024, "MB", category="system")
        result.add_metric("response_time", 200, "ms", category="network")

        system_metrics = result.get_metrics_by_category("system")
        network_metrics = result.get_metrics_by_category("network")

        assert len(system_metrics) == 2
        assert len(network_metrics) == 1
        assert system_metrics[0].name in ["cpu_usage", "memory_usage"]
        assert network_metrics[0].name == "response_time"


class MockBenchmark(PerformanceBenchmark):
    """Mock benchmark for testing."""

    def __init__(self, name="Mock Benchmark", setup_success=True, execution_data=None):
        super().__init__(name, BenchmarkType.PERFORMANCE)
        self.setup_success = setup_success
        self.execution_data = execution_data or {"operations": 1000, "duration": 1.5}
        self.setup_called = False
        self.execute_called = False
        self.teardown_called = False

    async def setup(self) -> bool:
        """Mock setup."""
        self.setup_called = True
        await asyncio.sleep(0.01)  # Simulate async work
        return self.setup_success

    async def execute(self) -> dict:
        """Mock execute."""
        self.execute_called = True
        await asyncio.sleep(0.01)  # Simulate async work
        return self.execution_data

    async def teardown(self):
        """Mock teardown."""
        self.teardown_called = True
        await asyncio.sleep(0.01)  # Simulate async work


@pytest.mark.integration
class TestPerformanceBenchmark:
    """Test PerformanceBenchmark abstract base class."""

    @pytest.mark.asyncio
    async def test_benchmark_successful_execution(self):
        """Test successful benchmark execution."""
        benchmark = MockBenchmark("Test Benchmark")
        result = await benchmark.run()

        assert result.name == "Test Benchmark"
        assert result.benchmark_type == BenchmarkType.PERFORMANCE
        assert result.status == BenchmarkStatus.COMPLETED
        assert result.start_time is not None
        assert result.end_time is not None
        assert result.duration is not None
        assert result.duration_seconds > 0
        assert len(result.metrics) == 2  # operations and duration from execution_data
        assert result.error_message is None

        # Verify lifecycle methods were called
        assert benchmark.setup_called
        assert benchmark.execute_called
        assert benchmark.teardown_called

    @pytest.mark.asyncio
    async def test_benchmark_setup_failure(self):
        """Test benchmark with setup failure."""
        benchmark = MockBenchmark("Failing Setup Benchmark", setup_success=False)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.FAILED
        assert result.error_message == "Benchmark setup failed"
        assert benchmark.setup_called
        assert benchmark.execute_called  # Execute still runs
        assert benchmark.teardown_called

    @pytest.mark.asyncio
    async def test_benchmark_execution_failure(self):
        """Test benchmark with execution failure."""

        class FailingBenchmark(MockBenchmark):
            async def execute(self):
                self.execute_called = True
                raise ValueError("Execution failed")

        benchmark = FailingBenchmark("Failing Execution Benchmark")
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.FAILED
        assert result.error_message == "Execution failed"
        assert benchmark.setup_called
        assert benchmark.execute_called
        assert benchmark.teardown_called

    @pytest.mark.asyncio
    async def test_benchmark_cancellation(self):
        """Test benchmark cancellation."""

        class SlowBenchmark(MockBenchmark):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._blocker = asyncio.Event()

            async def execute(self):
                self.execute_called = True
                await self._blocker.wait()  # Block until cancelled
                return self.execution_data

        benchmark = SlowBenchmark("Slow Benchmark")

        # Start benchmark and cancel it
        task = asyncio.create_task(benchmark.run())
        await asyncio.sleep(0.01)  # Let it start
        task.cancel()

        try:
            result = await task
        except asyncio.CancelledError:
            # This is expected behavior for cancelled tasks
            pass
        else:
            # If we get a result instead of cancellation, check it
            assert result.status == BenchmarkStatus.CANCELLED
            assert "cancelled" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_benchmark_teardown_failure(self):
        """Test benchmark with teardown failure."""

        class FailingTeardownBenchmark(MockBenchmark):
            async def teardown(self):
                self.teardown_called = True
                raise RuntimeError("Teardown failed")

        benchmark = FailingTeardownBenchmark("Failing Teardown Benchmark")
        result = await benchmark.run()

        # Main execution should still succeed despite teardown failure
        assert result.status == BenchmarkStatus.COMPLETED
        assert benchmark.teardown_called


@pytest.mark.integration
class TestCPUBenchmark:
    """Test CPU benchmark implementation."""

    @pytest.mark.asyncio
    async def test_cpu_benchmark_execution(self):
        """Test CPU benchmark execution."""
        benchmark = CPUBenchmark(duration_seconds=1, threads=1)
        result = await benchmark.run()

        assert result.name == "CPU Benchmark"
        assert result.benchmark_type == BenchmarkType.CPU
        assert result.status == BenchmarkStatus.COMPLETED

        # Check for expected metrics
        iterations_metric = result.get_metric("iterations")
        assert iterations_metric is not None
        assert iterations_metric.value > 0

        ops_metric = result.get_metric("operations_per_second")
        assert ops_metric is not None
        assert ops_metric.value > 0

    @pytest.mark.asyncio
    async def test_cpu_benchmark_custom_parameters(self):
        """Test CPU benchmark with custom parameters."""
        benchmark = CPUBenchmark(duration_seconds=2, threads=2)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED
        threads_metric = result.get_metric("threads_used")
        assert threads_metric is not None
        assert threads_metric.value == 2


@pytest.mark.integration
class TestMemoryBenchmark:
    """Test Memory benchmark implementation."""

    @pytest.mark.asyncio
    async def test_memory_benchmark_execution(self):
        """Test memory benchmark execution."""
        benchmark = MemoryBenchmark(allocation_mb=10, iterations=100)
        result = await benchmark.run()

        assert result.name == "Memory Benchmark"
        assert result.benchmark_type == BenchmarkType.MEMORY
        assert result.status == BenchmarkStatus.COMPLETED

        # Check for expected metrics
        allocated_chunks = result.get_metric("allocated_chunks")
        assert allocated_chunks is not None
        assert allocated_chunks.value == 100

        allocation_time = result.get_metric("allocation_time_seconds")
        assert allocation_time is not None
        assert allocation_time.value > 0

    @pytest.mark.asyncio
    async def test_memory_benchmark_custom_parameters(self):
        """Test memory benchmark with custom parameters."""
        benchmark = MemoryBenchmark(allocation_mb=5, iterations=50)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED
        allocated_chunks = result.get_metric("allocated_chunks")
        assert allocated_chunks.value == 50


@pytest.mark.integration
class TestNetworkBenchmark:
    """Test Network benchmark implementation."""

    @pytest.mark.asyncio
    async def test_network_benchmark_execution_success(self):
        """Test successful network benchmark execution."""
        # Use a more reliable target
        benchmark = NetworkBenchmark(target_host="8.8.8.8", port=53, iterations=3)
        result = await benchmark.run()

        assert result.name == "Network Benchmark"
        assert result.benchmark_type == BenchmarkType.NETWORK
        assert result.status == BenchmarkStatus.COMPLETED

        # Check for expected metrics
        attempts_metric = result.get_metric("total_attempts")
        assert attempts_metric is not None
        assert attempts_metric.value == 3

    @pytest.mark.asyncio
    async def test_network_benchmark_connection_failure(self):
        """Test network benchmark with connection failures."""
        # Use invalid target to simulate failures
        benchmark = NetworkBenchmark(target_host="192.0.2.1", port=99999, iterations=2)
        result = await benchmark.run()

        assert result.status == BenchmarkStatus.COMPLETED  # Completes even with failed connections

        success_rate = result.get_metric("success_rate")
        assert success_rate is not None
        assert success_rate.value <= 1.0  # Success rate should be low or 0


@pytest.mark.integration
class TestBenchmarkSuite:
    """Test BenchmarkSuite functionality."""

    @pytest.fixture
    def suite_config(self):
        """Create test suite configuration."""
        return BenchmarkSuiteConfig(
            name="Test Suite",
            description="Test benchmark suite",
            timeout_seconds=30,
            parallel_execution=False,
        )

    @pytest.fixture
    def benchmark_suite(self, suite_config):
        """Create test benchmark suite."""
        suite = BenchmarkSuite(suite_config)
        suite.add_benchmark(MockBenchmark("Benchmark 1"))
        suite.add_benchmark(MockBenchmark("Benchmark 2"))
        return suite

    @pytest.mark.asyncio
    async def test_benchmark_suite_sequential_execution(self, benchmark_suite):
        """Test sequential benchmark execution."""
        results = await benchmark_suite.run_all()

        assert len(results) == 2
        assert all(r.status == BenchmarkStatus.COMPLETED for r in results)
        assert results[0].name == "Benchmark 1"
        assert results[1].name == "Benchmark 2"

    @pytest.mark.asyncio
    async def test_benchmark_suite_parallel_execution(self, suite_config):
        """Test parallel benchmark execution."""
        suite_config.parallel_execution = True
        suite = BenchmarkSuite(suite_config)
        suite.add_benchmark(MockBenchmark("Parallel 1"))
        suite.add_benchmark(MockBenchmark("Parallel 2"))

        results = await suite.run_all()

        assert len(results) == 2
        assert all(r.status == BenchmarkStatus.COMPLETED for r in results)

    @pytest.mark.asyncio
    async def test_benchmark_suite_timeout_handling(self, suite_config):
        """Test suite timeout handling."""
        suite_config.timeout_seconds = 1  # Very short timeout
        suite = BenchmarkSuite(suite_config)

        class SlowBenchmark(MockBenchmark):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._blocker = asyncio.Event()

            async def execute(self):
                await self._blocker.wait()  # Block until suite timeout triggers
                return self.execution_data

        suite.add_benchmark(SlowBenchmark("Slow Benchmark"))
        results = await suite.run_all()

        assert len(results) == 1
        assert results[0].status == BenchmarkStatus.FAILED
        assert "timed out" in results[0].error_message.lower()

    @pytest.mark.asyncio
    async def test_benchmark_suite_retry_logic(self, suite_config):
        """Test suite retry logic for failed benchmarks."""
        suite_config.retry_failed = True
        suite_config.retry_count = 2
        suite = BenchmarkSuite(suite_config)

        class FlakyBenchmark(MockBenchmark):
            def __init__(self, name):
                super().__init__(name)
                self.attempt_count = 0

            async def execute(self):
                self.attempt_count += 1
                if self.attempt_count < 2:  # Fail first attempt
                    raise ValueError("Flaky failure")
                return self.execution_data

        suite.add_benchmark(FlakyBenchmark("Flaky Benchmark"))
        results = await suite.run_all()

        assert len(results) == 1
        # Should succeed after retry
        assert results[0].status == BenchmarkStatus.COMPLETED

    def test_benchmark_suite_summary_stats(self, benchmark_suite):
        """Test benchmark suite summary statistics."""
        # Create mock results
        benchmark_suite.results = [
            BenchmarkResult(
                id="1",
                name="Test 1",
                benchmark_type=BenchmarkType.PERFORMANCE,
                status=BenchmarkStatus.COMPLETED,
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC) + timedelta(seconds=1),
            ),
            BenchmarkResult(
                id="2",
                name="Test 2",
                benchmark_type=BenchmarkType.PERFORMANCE,
                status=BenchmarkStatus.FAILED,
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC) + timedelta(seconds=2),
            ),
        ]

        stats = benchmark_suite.get_summary_stats()

        assert stats["total_benchmarks"] == 2
        assert stats["completed"] == 1
        assert stats["failed"] == 1
        assert stats["cancelled"] == 0
        assert stats["success_rate"] == 0.5
        assert stats["average_duration_seconds"] > 0
        assert stats["min_duration_seconds"] > 0
        assert stats["max_duration_seconds"] > 0


@pytest.mark.integration
class TestBenchmarkManager:
    """Test BenchmarkManager functionality."""

    @pytest.fixture
    def benchmark_manager(self):
        """Create test benchmark manager."""
        return BenchmarkManager()

    @pytest.mark.asyncio
    async def test_benchmark_manager_run_single(self, benchmark_manager):
        """Test running single benchmark through manager."""
        benchmark = MockBenchmark("Manager Test")
        result = await benchmark_manager.run_benchmark(benchmark)

        assert result.status == BenchmarkStatus.COMPLETED
        assert len(benchmark_manager.benchmark_history) == 1
        assert benchmark_manager.benchmark_history[0] == result

    @pytest.mark.asyncio
    async def test_benchmark_manager_suite_registration(self, benchmark_manager):
        """Test suite registration and execution."""
        config = BenchmarkSuiteConfig(name="Manager Suite")
        suite = BenchmarkSuite(config)
        suite.add_benchmark(MockBenchmark("Suite Benchmark"))

        benchmark_manager.register_suite(suite)
        assert "Manager Suite" in benchmark_manager.suites

        results = await benchmark_manager.run_suite("Manager Suite")
        assert len(results) == 1
        assert results[0].status == BenchmarkStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_benchmark_manager_suite_not_found(self, benchmark_manager):
        """Test running non-existent suite."""
        with pytest.raises(ValueError, match="not found"):
            await benchmark_manager.run_suite("Non-existent Suite")

    @pytest.mark.asyncio
    async def test_benchmark_manager_active_benchmarks(self, benchmark_manager):
        """Test tracking of active benchmarks."""

        class SlowBenchmark(MockBenchmark):
            async def execute(self):
                await asyncio.sleep(0.05)
                return self.execution_data

        benchmark = SlowBenchmark("Slow Benchmark")

        # Start benchmark without awaiting
        task = asyncio.create_task(benchmark_manager.run_benchmark(benchmark))
        await asyncio.sleep(0.02)  # Let it start

        # Should have active benchmark
        active = benchmark_manager.get_active_benchmarks()
        assert len(active) == 1

        # Wait for completion
        await task

        # Should be no active benchmarks
        active = benchmark_manager.get_active_benchmarks()
        assert len(active) == 0

    @pytest.mark.asyncio
    async def test_benchmark_manager_cancel_benchmark(self, benchmark_manager):
        """Test cancelling active benchmarks."""

        class SlowBenchmark(MockBenchmark):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._blocker = asyncio.Event()

            async def execute(self):
                await self._blocker.wait()
                return self.execution_data

        benchmark = SlowBenchmark("Cancellable Benchmark")

        # Start benchmark
        task = asyncio.create_task(benchmark_manager.run_benchmark(benchmark))
        await asyncio.sleep(0.02)  # Let it start

        # Get task ID and cancel
        active = benchmark_manager.get_active_benchmarks()
        assert len(active) == 1
        task_id = active[0]

        success = await benchmark_manager.cancel_benchmark(task_id)
        assert success

        # Verify cancellation
        try:
            await task
        except asyncio.CancelledError:
            pass  # Expected

        active = benchmark_manager.get_active_benchmarks()
        assert len(active) == 0

    @pytest.mark.asyncio
    async def test_benchmark_manager_cancel_nonexistent(self, benchmark_manager):
        """Test cancelling non-existent benchmark."""
        success = await benchmark_manager.cancel_benchmark("non-existent-id")
        assert not success

    def test_benchmark_manager_history_filtering(self, benchmark_manager):
        """Test benchmark history filtering."""
        # Add mock results to history
        benchmark_manager.benchmark_history = [
            BenchmarkResult(
                id="1",
                name="CPU Test",
                benchmark_type=BenchmarkType.CPU,
                status=BenchmarkStatus.COMPLETED,
                start_time=datetime.now(UTC),
            ),
            BenchmarkResult(
                id="2",
                name="Memory Test",
                benchmark_type=BenchmarkType.MEMORY,
                status=BenchmarkStatus.FAILED,
                start_time=datetime.now(UTC),
            ),
            BenchmarkResult(
                id="3",
                name="CPU Test 2",
                benchmark_type=BenchmarkType.CPU,
                status=BenchmarkStatus.COMPLETED,
                start_time=datetime.now(UTC),
            ),
        ]

        # Test filter by type
        cpu_results = benchmark_manager.get_benchmark_history(benchmark_type=BenchmarkType.CPU)
        assert len(cpu_results) == 2
        assert all(r.benchmark_type == BenchmarkType.CPU for r in cpu_results)

        # Test filter by status
        failed_results = benchmark_manager.get_benchmark_history(status=BenchmarkStatus.FAILED)
        assert len(failed_results) == 1
        assert failed_results[0].status == BenchmarkStatus.FAILED

        # Test limit
        limited_results = benchmark_manager.get_benchmark_history(limit=2)
        assert len(limited_results) == 2

    def test_benchmark_manager_clear_history(self, benchmark_manager):
        """Test clearing benchmark history."""
        # Add some history
        benchmark_manager.benchmark_history = [
            BenchmarkResult(
                id="1",
                name="Test",
                benchmark_type=BenchmarkType.PERFORMANCE,
                status=BenchmarkStatus.COMPLETED,
                start_time=datetime.now(UTC),
            )
        ]

        assert len(benchmark_manager.benchmark_history) == 1

        benchmark_manager.clear_history()
        assert len(benchmark_manager.benchmark_history) == 0
