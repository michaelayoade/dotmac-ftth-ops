"""
Comprehensive tests for monitoring routers.

Covers:
- monitoring/logs_router.py
- monitoring/traces_router.py
- monitoring_metrics_router.py
"""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.monitoring.logs_router import (
    LogEntry,
    LogLevel,
    LogMetadata,
    LogsResponse,
    LogsService,
    LogStats,
    get_logs_service,
    logs_router,
)
from dotmac.platform.monitoring.traces_router import (
    MetricsResponse,
    MetricType,
    ObservabilityService,
    PerformanceMetrics,
    PerformanceResponse,
    ServiceDependency,
    ServiceMapResponse,
    SpanData,
    TraceData,
    TracesResponse,
    TraceStatus,
    get_observability_service,
    traces_router,
)
from dotmac.platform.monitoring_metrics_router import (
    ErrorRateResponse,
    LatencyMetrics,
    ResourceMetrics,
    metrics_router,
)
from dotmac.platform.monitoring_metrics_router import logs_router as logs_metrics_router

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_user():
    """Create mock user for authentication."""
    return UserInfo(
        user_id="test_user",
        email="test@example.com",
        roles=["user"],
        permissions=["read"],
        tenant_id="test_tenant",
    )


# ============================================================
# Logs Router Tests
# ============================================================


class TestLogsRouter:
    """Test logs router endpoints."""

    @pytest.fixture
    def app(self, mock_user):
        """Create FastAPI app with logs router."""
        app = FastAPI()

        # Override dependencies
        from dotmac.platform.auth.dependencies import get_current_user

        async def mock_get_user():
            return mock_user

        app.dependency_overrides[get_current_user] = mock_get_user
        app.include_router(logs_router, prefix="/api/v1")

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)

    def test_get_logs_endpoint(self, client):
        """Test GET /logs endpoint."""
        response = client.get("/api/v1/monitoring/logs")
        assert response.status_code == 200

        data = response.json()
        assert "logs" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "has_more" in data

    def test_get_logs_with_filters(self, client):
        """Test GET /logs with various filters."""
        # Filter by log level
        response = client.get("/api/v1/monitoring/logs?level=ERROR")
        assert response.status_code == 200
        data = response.json()
        if data["logs"]:
            assert all(log["level"] == "ERROR" for log in data["logs"])

        # Filter by service
        response = client.get("/api/v1/monitoring/logs?service=api-gateway")
        assert response.status_code == 200
        data = response.json()
        if data["logs"]:
            assert all(log["service"] == "api-gateway" for log in data["logs"])

        # Filter by search term
        response = client.get("/api/v1/monitoring/logs?search=database")
        assert response.status_code == 200
        assert response.json()["total"] >= 0

    def test_get_logs_with_pagination(self, client):
        """Test GET /logs with pagination."""
        # First page
        response = client.get("/api/v1/monitoring/logs?page=1&page_size=10")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert len(data["logs"]) <= 10

        # Second page
        response = client.get("/api/v1/monitoring/logs?page=2&page_size=10")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2

    def test_get_log_stats_endpoint(self, client):
        """Test GET /logs/stats endpoint."""
        response = client.get("/api/v1/monitoring/logs/stats")
        assert response.status_code == 200

        data = response.json()
        assert "total" in data
        assert "by_level" in data
        assert "by_service" in data
        assert "time_range" in data

    def test_get_available_services_endpoint(self, client):
        """Test GET /logs/services endpoint."""
        response = client.get("/api/v1/monitoring/logs/services")
        assert response.status_code == 200

        services = response.json()
        assert isinstance(services, list)
        assert len(services) >= 0  # Can be empty if no audit activities exist
        if len(services) > 0:
            assert all(isinstance(s, str) for s in services)


class TestLogsService:
    """Test LogsService class."""

    @pytest.fixture
    def logs_service(self):
        """Create logs service instance."""
        return LogsService()

    @pytest.mark.asyncio
    async def test_get_logs_basic(self, logs_service):
        """Test basic log retrieval."""
        result = await logs_service.get_logs()

        assert isinstance(result, LogsResponse)
        assert isinstance(result.logs, list)
        assert result.total >= 0
        assert result.page == 1
        assert result.page_size == 100

    @pytest.mark.asyncio
    async def test_get_logs_with_level_filter(self, logs_service):
        """Test log retrieval with level filter."""
        result = await logs_service.get_logs(level=LogLevel.ERROR)

        assert isinstance(result, LogsResponse)
        # All returned logs should match the filter
        for log in result.logs:
            assert log.level == LogLevel.ERROR

    @pytest.mark.asyncio
    async def test_get_logs_with_service_filter(self, logs_service):
        """Test log retrieval with service filter."""
        result = await logs_service.get_logs(service="api-gateway")

        assert isinstance(result, LogsResponse)
        for log in result.logs:
            assert log.service == "api-gateway"

    @pytest.mark.asyncio
    async def test_get_logs_with_time_range(self, logs_service):
        """Test log retrieval with time range."""
        now = datetime.now(UTC)
        start_time = now - timedelta(hours=1)
        end_time = now

        result = await logs_service.get_logs(start_time=start_time, end_time=end_time)

        assert isinstance(result, LogsResponse)
        assert result.total >= 0

    @pytest.mark.asyncio
    async def test_get_log_stats(self, logs_service):
        """Test log statistics retrieval."""
        result = await logs_service.get_log_stats()

        assert isinstance(result, LogStats)
        assert result.total > 0
        assert isinstance(result.by_level, dict)
        assert isinstance(result.by_service, dict)
        assert isinstance(result.time_range, dict)

    def test_get_logs_service_singleton(self):
        """Test get_logs_service returns singleton."""
        service1 = get_logs_service()
        service2 = get_logs_service()
        assert service1 is service2


# ============================================================
# Traces Router Tests
# ============================================================


class TestTracesRouter:
    """Test traces router endpoints."""

    @pytest.fixture
    def app(self, mock_user):
        """Create FastAPI app with traces router."""
        app = FastAPI()

        # Override dependencies
        from dotmac.platform.auth.dependencies import get_current_user

        async def mock_get_user():
            return mock_user

        app.dependency_overrides[get_current_user] = mock_get_user
        app.include_router(traces_router, prefix="/api/v1")

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)

    def test_get_traces_endpoint(self, client):
        """Test GET /traces endpoint."""
        response = client.get("/api/v1/observability/traces")
        assert response.status_code == 200

        data = response.json()
        assert "traces" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "has_more" in data

    def test_get_traces_with_filters(self, client):
        """Test GET /traces with filters."""
        # Filter by service
        response = client.get("/api/v1/observability/traces?service=api-gateway")
        assert response.status_code == 200
        data = response.json()
        if data["traces"]:
            assert all(t["service"] == "api-gateway" for t in data["traces"])

        # Filter by status
        response = client.get("/api/v1/observability/traces?status=error")
        assert response.status_code == 200
        data = response.json()
        if data["traces"]:
            assert all(t["status"] == "error" for t in data["traces"])

        # Filter by min duration
        response = client.get("/api/v1/observability/traces?min_duration=500")
        assert response.status_code == 200
        data = response.json()
        if data["traces"]:
            assert all(t["duration"] >= 500 for t in data["traces"])

    def test_get_trace_details_endpoint(self, client):
        """Test GET /traces/{trace_id} endpoint."""
        trace_id = "test_trace_123"
        response = client.get(f"/api/v1/observability/traces/{trace_id}")
        assert response.status_code == 200

        data = response.json()
        assert "trace_id" in data
        assert "service" in data
        assert "operation" in data
        assert "duration" in data
        assert "status" in data
        assert "spans" in data
        assert "span_details" in data

    def test_get_metrics_endpoint(self, client):
        """Test GET /metrics endpoint."""
        response = client.get("/api/v1/observability/metrics")
        assert response.status_code == 200

        data = response.json()
        assert "metrics" in data
        assert "time_range" in data

    def test_get_metrics_with_names(self, client):
        """Test GET /metrics with metric names."""
        response = client.get("/api/v1/observability/metrics?metrics=request_count,error_count")
        assert response.status_code == 200

        data = response.json()
        assert "metrics" in data
        assert len(data["metrics"]) >= 0

    def test_get_service_map_endpoint(self, client):
        """Test GET /service-map endpoint."""
        response = client.get("/api/v1/observability/service-map")
        assert response.status_code == 200

        data = response.json()
        assert "services" in data
        assert "dependencies" in data
        assert "health_scores" in data

    def test_get_performance_metrics_endpoint(self, client):
        """Test GET /performance endpoint."""
        response = client.get("/api/v1/observability/performance")
        assert response.status_code == 200

        data = response.json()
        assert "percentiles" in data
        assert "slowest_endpoints" in data
        assert "most_frequent_errors" in data


class TestObservabilityService:
    """Test ObservabilityService class."""

    @pytest.fixture
    def obs_service(self):
        """Create observability service instance."""
        return ObservabilityService()

    @pytest.mark.asyncio
    async def test_get_traces_basic(self, obs_service):
        """Test basic trace retrieval."""
        result = await obs_service.get_traces()

        assert isinstance(result, TracesResponse)
        assert isinstance(result.traces, list)
        assert result.total >= 0
        assert result.page == 1
        assert result.page_size == 50

    @pytest.mark.asyncio
    async def test_get_traces_with_filters(self, obs_service):
        """Test trace retrieval with filters."""
        result = await obs_service.get_traces(
            service="api-gateway",
            status=TraceStatus.ERROR,
            min_duration=100,
        )

        assert isinstance(result, TracesResponse)
        # Verify filters are applied
        for trace in result.traces:
            assert trace.service == "api-gateway"
            assert trace.status == TraceStatus.ERROR
            assert trace.duration >= 100

    @pytest.mark.asyncio
    async def test_get_trace_details(self, obs_service):
        """Test trace details retrieval."""
        trace_id = "test_trace_xyz"
        result = await obs_service.get_trace_details(trace_id)

        assert isinstance(result, TraceData)
        assert result.trace_id == trace_id
        assert len(result.span_details) > 0
        assert all(isinstance(span, SpanData) for span in result.span_details)

    @pytest.mark.asyncio
    async def test_get_metrics(self, obs_service):
        """Test metrics retrieval."""
        result = await obs_service.get_metrics()

        assert isinstance(result, MetricsResponse)
        assert isinstance(result.metrics, list)
        assert "start" in result.time_range
        assert "end" in result.time_range

    @pytest.mark.asyncio
    async def test_get_metrics_with_names(self, obs_service):
        """Test metrics retrieval with specific names."""
        metric_names = ["request_count", "error_count"]
        result = await obs_service.get_metrics(metric_names=metric_names)

        assert isinstance(result, MetricsResponse)
        assert len(result.metrics) == len(metric_names)
        assert all(m.name in metric_names for m in result.metrics)

    @pytest.mark.asyncio
    async def test_get_service_map(self, obs_service):
        """Test service map retrieval."""
        result = await obs_service.get_service_map()

        assert isinstance(result, ServiceMapResponse)
        assert len(result.services) > 0
        assert len(result.dependencies) > 0
        assert all(isinstance(d, ServiceDependency) for d in result.dependencies)
        assert isinstance(result.health_scores, dict)

    @pytest.mark.asyncio
    async def test_get_performance_metrics(self, obs_service):
        """Test performance metrics retrieval."""
        result = await obs_service.get_performance_metrics()

        assert isinstance(result, PerformanceResponse)
        assert len(result.percentiles) > 0
        assert all(isinstance(p, PerformanceMetrics) for p in result.percentiles)
        assert len(result.slowest_endpoints) > 0
        assert len(result.most_frequent_errors) > 0

    def test_get_observability_service_singleton(self):
        """Test get_observability_service returns singleton."""
        service1 = get_observability_service()
        service2 = get_observability_service()
        assert service1 is service2


# ============================================================
# Monitoring Metrics Router Tests
# ============================================================


class TestMonitoringMetricsRouter:
    """Test monitoring metrics router endpoints."""

    @pytest.fixture
    def app(self, mock_user, async_db_session):
        """Create FastAPI app with monitoring metrics routers."""
        app = FastAPI()

        # Override dependencies
        from dotmac.platform.auth.dependencies import get_current_user
        from dotmac.platform.db import get_session_dependency

        async def mock_get_user():
            return mock_user

        async def mock_get_session():
            return async_db_session

        app.dependency_overrides[get_current_user] = mock_get_user
        app.dependency_overrides[get_session_dependency] = mock_get_session

        app.include_router(logs_metrics_router, prefix="/api/v1")
        app.include_router(metrics_router, prefix="/api/v1")

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)

    def test_get_error_rate_endpoint(self, client):
        """Test GET /logs/error-rate endpoint."""
        response = client.get("/api/v1/logs/error-rate")
        assert response.status_code == 200

        data = response.json()
        assert "rate" in data
        assert "total_requests" in data
        assert "error_count" in data
        assert "time_window" in data
        assert "timestamp" in data
        assert isinstance(data["rate"], (int, float))
        assert data["rate"] >= 0

    def test_get_error_rate_with_window(self, client):
        """Test GET /logs/error-rate with custom window."""
        response = client.get("/api/v1/logs/error-rate?window_minutes=30")
        assert response.status_code == 200

        data = response.json()
        assert data["time_window"] == "30m"

    def test_get_latency_metrics_endpoint(self, client):
        """Test GET /metrics/latency endpoint."""
        response = client.get("/api/v1/metrics/latency")
        assert response.status_code == 200

        data = response.json()
        assert "p50" in data
        assert "p95" in data
        assert "p99" in data
        assert "average" in data
        assert "max" in data
        assert "min" in data
        assert "time_window" in data
        assert "timestamp" in data

        # Verify all metrics are numeric
        assert isinstance(data["p50"], (int, float))
        assert isinstance(data["p95"], (int, float))
        assert isinstance(data["p99"], (int, float))
        assert isinstance(data["average"], (int, float))
        assert isinstance(data["max"], (int, float))
        assert isinstance(data["min"], (int, float))

    def test_get_resource_metrics_endpoint(self, client):
        """Test GET /metrics/resources endpoint."""
        response = client.get("/api/v1/metrics/resources")
        assert response.status_code == 200

        data = response.json()
        assert "cpu" in data
        assert "memory" in data
        assert "disk" in data
        assert "network_in" in data
        assert "network_out" in data
        assert "timestamp" in data

        # Verify all metrics are numeric and in valid range
        assert 0 <= data["cpu"] <= 100
        assert 0 <= data["memory"] <= 100
        assert 0 <= data["disk"] <= 100
        assert data["network_in"] >= 0
        assert data["network_out"] >= 0


# ============================================================
# Model Tests
# ============================================================


class TestLogModels:
    """Test log-related models."""

    def test_log_level_enum(self):
        """Test LogLevel enum values."""
        assert LogLevel.DEBUG == "DEBUG"
        assert LogLevel.INFO == "INFO"
        assert LogLevel.WARNING == "WARNING"
        assert LogLevel.ERROR == "ERROR"
        assert LogLevel.CRITICAL == "CRITICAL"

    def test_log_metadata_model(self):
        """Test LogMetadata model."""
        metadata = LogMetadata(
            request_id="req_123",
            user_id="user_456",
            tenant_id="tenant_789",
            duration=150,
            ip="192.168.1.1",
        )

        assert metadata.request_id == "req_123"
        assert metadata.user_id == "user_456"
        assert metadata.tenant_id == "tenant_789"
        assert metadata.duration == 150
        assert metadata.ip == "192.168.1.1"

    def test_log_entry_model(self):
        """Test LogEntry model."""
        now = datetime.now(UTC)
        log_entry = LogEntry(
            id="log_123",
            timestamp=now,
            level=LogLevel.INFO,
            service="test-service",
            message="Test message",
        )

        assert log_entry.id == "log_123"
        assert log_entry.timestamp == now
        assert log_entry.level == LogLevel.INFO
        assert log_entry.service == "test-service"
        assert log_entry.message == "Test message"


class TestTraceModels:
    """Test trace-related models."""

    def test_trace_status_enum(self):
        """Test TraceStatus enum values."""
        assert TraceStatus.SUCCESS == "success"
        assert TraceStatus.ERROR == "error"
        assert TraceStatus.WARNING == "warning"

    def test_span_data_model(self):
        """Test SpanData model."""
        now = datetime.now(UTC)
        span = SpanData(
            span_id="span_123",
            parent_span_id="span_parent",
            name="test_operation",
            service="test-service",
            duration=100,
            start_time=now,
            attributes={"key": "value"},
        )

        assert span.span_id == "span_123"
        assert span.parent_span_id == "span_parent"
        assert span.name == "test_operation"
        assert span.service == "test-service"
        assert span.duration == 100
        assert span.start_time == now
        assert span.attributes == {"key": "value"}

    def test_trace_data_model(self):
        """Test TraceData model."""
        now = datetime.now(UTC)
        trace = TraceData(
            trace_id="trace_123",
            service="test-service",
            operation="test_op",
            duration=500,
            status=TraceStatus.SUCCESS,
            timestamp=now,
            spans=5,
        )

        assert trace.trace_id == "trace_123"
        assert trace.service == "test-service"
        assert trace.operation == "test_op"
        assert trace.duration == 500
        assert trace.status == TraceStatus.SUCCESS
        assert trace.timestamp == now
        assert trace.spans == 5

    def test_metric_type_enum(self):
        """Test MetricType enum values."""
        assert MetricType.COUNTER == "counter"
        assert MetricType.GAUGE == "gauge"
        assert MetricType.HISTOGRAM == "histogram"


class TestMetricsModels:
    """Test metrics-related models."""

    def test_error_rate_response_model(self):
        """Test ErrorRateResponse model."""
        response = ErrorRateResponse(
            rate=5.2,
            total_requests=1000,
            error_count=52,
            time_window="60m",
            timestamp="2024-01-01T00:00:00Z",
        )

        assert response.rate == 5.2
        assert response.total_requests == 1000
        assert response.error_count == 52
        assert response.time_window == "60m"

    def test_latency_metrics_model(self):
        """Test LatencyMetrics model."""
        metrics = LatencyMetrics(
            p50=50.0,
            p95=200.0,
            p99=500.0,
            average=100.0,
            max=800.0,
            min=10.0,
            time_window="60m",
            timestamp="2024-01-01T00:00:00Z",
        )

        assert metrics.p50 == 50.0
        assert metrics.p95 == 200.0
        assert metrics.p99 == 500.0
        assert metrics.average == 100.0
        assert metrics.max == 800.0
        assert metrics.min == 10.0

    def test_resource_metrics_model(self):
        """Test ResourceMetrics model."""
        metrics = ResourceMetrics(
            cpu=45.5,
            memory=60.2,
            disk=70.0,
            network_in=50.0,
            network_out=40.0,
            timestamp="2024-01-01T00:00:00Z",
        )

        assert metrics.cpu == 45.5
        assert metrics.memory == 60.2
        assert metrics.disk == 70.0
        assert metrics.network_in == 50.0
        assert metrics.network_out == 40.0
