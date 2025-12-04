"""
Comprehensive tests for the resilience module.

This module tests circuit breakers, service mesh functionality,
load balancing, traffic policies, and other resilience patterns.
"""

import time
from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from tenacity import RetryError

from dotmac.platform.resilience.circuit_breaker import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from dotmac.platform.resilience.service_mesh import (
    CircuitBreakerState,
    EncryptionLevel,
    LoadBalancer,
    RetryPolicy,
    ServiceCall,
    ServiceEndpoint,
    ServiceMarketplace,
    ServiceMesh,
    ServiceMeshFactory,
    ServiceRegistry,
    ServiceStatus,
    TrafficPolicy,
    TrafficRule,
    setup_service_mesh_for_consolidated_services,
)

pytestmark = pytest.mark.unit


class TestCircuitBreakerPatterns:
    """Test circuit breaker functionality using tenacity."""

    @pytest.mark.asyncio
    async def test_retry_decorator_success(self):
        """Test retry decorator with successful operation."""
        call_count = 0

        @retry(stop=stop_after_attempt(3))
        async def succeeding_operation():
            nonlocal call_count
            call_count += 1
            return "success"

        result = await succeeding_operation()
        assert result == "success"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_retry_decorator_failure(self):
        """Test retry decorator with failing operation."""
        call_count = 0

        @retry(stop=stop_after_attempt(3))
        async def failing_operation():
            nonlocal call_count
            call_count += 1
            raise ValueError("Test failure")

        with pytest.raises(RetryError):
            await failing_operation()

        assert call_count == 3

    @pytest.mark.asyncio
    async def test_retry_with_exception_type_filtering(self):
        """Test retry with specific exception type filtering."""
        call_count = 0

        @retry(
            stop=stop_after_attempt(3),
            retry=retry_if_exception_type(ValueError),
        )
        async def selective_retry_operation():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ValueError("Retriable error")
            raise TypeError("Non-retriable error")

        with pytest.raises(TypeError):
            await selective_retry_operation()

        assert call_count == 2

    @pytest.mark.asyncio
    async def test_wait_exponential_backoff(self):
        """Test exponential backoff wait strategy."""
        start_time = time.time()
        call_count = 0

        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.1, min=0.1, max=1),
        )
        async def backoff_operation():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError("Retry needed")
            return "success"

        result = await backoff_operation()
        duration = time.time() - start_time

        assert result == "success"
        assert call_count == 3
        assert duration > 0.2  # Should have some delay from backoff

    def test_tenacity_imports_available(self):
        """Test that tenacity components are properly imported."""
        assert retry is not None
        assert stop_after_attempt is not None
        assert wait_exponential is not None
        assert retry_if_exception_type is not None


class TestServiceEndpoint:
    """Test ServiceEndpoint dataclass."""

    def test_service_endpoint_creation(self):
        """Test basic endpoint creation."""
        endpoint = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)

        assert endpoint.service_name == "test-service"
        assert endpoint.host == "localhost"
        assert endpoint.port == 8080
        assert endpoint.path == "/"
        assert endpoint.protocol == "http"
        assert endpoint.weight == 100
        assert endpoint.status == ServiceStatus.UNKNOWN

    def test_service_endpoint_url_property(self):
        """Test URL property generation."""
        endpoint = ServiceEndpoint(
            service_name="test-service",
            host="api.example.com",
            port=443,
            path="/api/v1",
            protocol="https",
        )

        assert endpoint.url == "https://api.example.com:443/api/v1"

    def test_service_endpoint_health_url_property(self):
        """Test health URL property generation."""
        endpoint = ServiceEndpoint(
            service_name="test-service", host="localhost", port=8080, health_check_path="/health"
        )

        assert endpoint.health_url == "http://localhost:8080/health"

    def test_service_endpoint_https_url(self):
        """Test HTTPS URL generation."""
        endpoint = ServiceEndpoint(
            service_name="secure-service", host="secure.example.com", port=443, protocol="https"
        )

        assert endpoint.url == "https://secure.example.com:443/"

    def test_service_endpoint_equality(self):
        """Test endpoint equality comparison."""
        endpoint1 = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)
        endpoint2 = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)

        # Dataclasses support equality by default
        assert endpoint1 == endpoint2

    def test_service_endpoint_metadata(self):
        """Test endpoint with custom metadata."""
        metadata = {"region": "us-west", "zone": "az1"}
        endpoint = ServiceEndpoint(
            service_name="test-service", host="localhost", port=8080, metadata=metadata
        )

        assert endpoint.metadata == metadata
        assert endpoint.metadata["region"] == "us-west"


class TestCircuitBreakerState:
    """Test CircuitBreakerState class."""

    def test_circuit_breaker_initial_state(self):
        """Test circuit breaker initial state."""
        cb = CircuitBreakerState(failure_threshold=3, timeout_seconds=60)

        assert cb.failure_threshold == 3
        assert cb.timeout_seconds == 60
        assert cb.failure_count == 0
        assert cb.state == "CLOSED"
        assert cb.can_execute() is True

    def test_circuit_breaker_record_failure(self):
        """Test recording failures."""
        cb = CircuitBreakerState(failure_threshold=2)

        # First failure
        cb.record_failure()
        assert cb.failure_count == 1
        assert cb.state == "CLOSED"
        assert cb.can_execute() is True

        # Second failure - should open circuit
        cb.record_failure()
        assert cb.failure_count == 2
        assert cb.state == "OPEN"
        assert cb.can_execute() is False

    def test_circuit_breaker_record_success(self):
        """Test recording success resets failure count."""
        cb = CircuitBreakerState(failure_threshold=3)

        # Add some failures
        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 2

        # Record success should reset
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.state == "CLOSED"

    def test_circuit_breaker_timeout_recovery(self):
        """Test circuit breaker timeout-based recovery."""
        cb = CircuitBreakerState(failure_threshold=1, timeout_seconds=1)

        # Trigger circuit breaker
        cb.record_failure()
        assert cb.state == "OPEN"
        assert cb.can_execute() is False

        # Wait for timeout
        time.sleep(1.1)

        # Should transition to HALF_OPEN
        assert cb.can_execute() is True
        assert cb.state == "HALF_OPEN"

    def test_circuit_breaker_half_open_success(self):
        """Test successful call in HALF_OPEN state closes circuit."""
        cb = CircuitBreakerState(failure_threshold=1, timeout_seconds=0.1)

        # Open the circuit
        cb.record_failure()
        assert cb.state == "OPEN"

        # Wait and transition to HALF_OPEN
        time.sleep(0.2)
        assert cb.can_execute() is True
        assert cb.state == "HALF_OPEN"

        # Success should close the circuit
        cb.record_success()
        assert cb.state == "CLOSED"


class TestTrafficRule:
    """Test TrafficRule dataclass."""

    def test_traffic_rule_creation(self):
        """Test basic traffic rule creation."""
        rule = TrafficRule(
            name="test-rule", source_service="service-a", destination_service="service-b"
        )

        assert rule.name == "test-rule"
        assert rule.source_service == "service-a"
        assert rule.destination_service == "service-b"
        assert rule.policy == TrafficPolicy.ROUND_ROBIN
        assert rule.retry_policy == RetryPolicy.EXPONENTIAL_BACKOFF
        assert rule.max_retries == 3
        assert rule.timeout_seconds == 30
        assert rule.circuit_breaker_enabled is True

    def test_traffic_rule_custom_settings(self):
        """Test traffic rule with custom settings."""
        rule = TrafficRule(
            name="custom-rule",
            source_service="service-a",
            destination_service="service-b",
            policy=TrafficPolicy.WEIGHTED,
            retry_policy=RetryPolicy.FIXED_INTERVAL,
            max_retries=5,
            timeout_seconds=60,
            circuit_breaker_enabled=False,
            encryption_level=EncryptionLevel.MTLS,
        )

        assert rule.policy == TrafficPolicy.WEIGHTED
        assert rule.retry_policy == RetryPolicy.FIXED_INTERVAL
        assert rule.max_retries == 5
        assert rule.timeout_seconds == 60
        assert rule.circuit_breaker_enabled is False
        assert rule.encryption_level == EncryptionLevel.MTLS


class TestServiceCall:
    """Test ServiceCall dataclass."""

    def test_service_call_creation(self):
        """Test basic service call creation."""
        call_id = str(uuid4())
        trace_id = str(uuid4())
        span_id = str(uuid4())
        timestamp = datetime.now(UTC)

        call = ServiceCall(
            call_id=call_id,
            source_service="service-a",
            destination_service="service-b",
            method="GET",
            path="/api/test",
            headers={"Content-Type": "application/json"},
            body=b'{"test": true}',
            timestamp=timestamp,
            trace_id=trace_id,
            span_id=span_id,
        )

        assert call.call_id == call_id
        assert call.source_service == "service-a"
        assert call.destination_service == "service-b"
        assert call.method == "GET"
        assert call.path == "/api/test"
        assert call.headers == {"Content-Type": "application/json"}
        assert call.body == b'{"test": true}'
        assert call.timestamp == timestamp
        assert call.trace_id == trace_id
        assert call.span_id == span_id

    def test_service_call_to_dict(self):
        """Test service call dictionary conversion."""
        call_id = str(uuid4())
        trace_id = str(uuid4())
        span_id = str(uuid4())
        timestamp = datetime.now(UTC)

        call = ServiceCall(
            call_id=call_id,
            source_service="service-a",
            destination_service="service-b",
            method="POST",
            path="/api/create",
            headers={"Authorization": "Bearer token"},
            body=None,
            timestamp=timestamp,
            trace_id=trace_id,
            span_id=span_id,
        )

        call_dict = call.to_dict()

        assert call_dict["call_id"] == call_id
        assert call_dict["source_service"] == "service-a"
        assert call_dict["destination_service"] == "service-b"
        assert call_dict["method"] == "POST"
        assert call_dict["path"] == "/api/create"
        assert call_dict["headers"] == {"Authorization": "Bearer token"}
        assert call_dict["timestamp"] == timestamp.isoformat()
        assert call_dict["trace_id"] == trace_id
        assert call_dict["span_id"] == span_id


class TestServiceRegistry:
    """Test ServiceRegistry class."""

    def test_service_registry_initialization(self):
        """Test service registry initialization."""
        registry = ServiceRegistry()

        assert isinstance(registry.endpoints, dict)
        assert isinstance(registry.traffic_rules, dict)
        assert isinstance(registry.circuit_breakers, dict)
        assert isinstance(registry.connection_counts, dict)
        assert isinstance(registry.health_status, dict)

    def test_register_endpoint(self):
        """Test endpoint registration."""
        registry = ServiceRegistry()
        endpoint = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)

        registry.register_endpoint(endpoint)

        assert "test-service" in registry.endpoints
        assert len(registry.endpoints["test-service"]) == 1
        assert registry.endpoints["test-service"][0] == endpoint

    def test_register_multiple_endpoints(self):
        """Test registering multiple endpoints for same service."""
        registry = ServiceRegistry()
        endpoint1 = ServiceEndpoint(service_name="test-service", host="host1", port=8080)
        endpoint2 = ServiceEndpoint(service_name="test-service", host="host2", port=8080)

        registry.register_endpoint(endpoint1)
        registry.register_endpoint(endpoint2)

        assert len(registry.endpoints["test-service"]) == 2

    def test_unregister_endpoint(self):
        """Test endpoint unregistration."""
        registry = ServiceRegistry()
        endpoint = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)

        registry.register_endpoint(endpoint)
        assert len(registry.endpoints["test-service"]) == 1

        registry.unregister_endpoint("test-service", "localhost", 8080)
        assert len(registry.endpoints["test-service"]) == 0

    def test_get_endpoints(self):
        """Test getting endpoints for a service."""
        registry = ServiceRegistry()
        endpoint = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)

        registry.register_endpoint(endpoint)
        endpoints = registry.get_endpoints("test-service")

        assert len(endpoints) == 1
        assert endpoints[0] == endpoint

    def test_get_endpoints_nonexistent_service(self):
        """Test getting endpoints for non-existent service."""
        registry = ServiceRegistry()
        endpoints = registry.get_endpoints("nonexistent")

        assert endpoints == []

    def test_add_traffic_rule(self):
        """Test adding traffic rule."""
        registry = ServiceRegistry()
        rule = TrafficRule(
            name="test-rule", source_service="service-a", destination_service="service-b"
        )

        registry.add_traffic_rule(rule)

        rule_key = "service-a->service-b"
        assert rule_key in registry.traffic_rules
        assert registry.traffic_rules[rule_key] == rule

    def test_get_traffic_rule(self):
        """Test getting traffic rule."""
        registry = ServiceRegistry()
        rule = TrafficRule(
            name="test-rule", source_service="service-a", destination_service="service-b"
        )

        registry.add_traffic_rule(rule)
        retrieved_rule = registry.get_traffic_rule("service-a", "service-b")

        assert retrieved_rule == rule

    def test_get_traffic_rule_nonexistent(self):
        """Test getting non-existent traffic rule."""
        registry = ServiceRegistry()
        rule = registry.get_traffic_rule("service-a", "service-b")

        assert rule is None

    def test_get_circuit_breaker(self):
        """Test getting circuit breaker."""
        registry = ServiceRegistry()
        cb = registry.get_circuit_breaker("test-service")

        assert isinstance(cb, CircuitBreakerState)
        assert "test-service" in registry.circuit_breakers

        # Should return same instance on subsequent calls
        cb2 = registry.get_circuit_breaker("test-service")
        assert cb is cb2


class TestLoadBalancer:
    """Test LoadBalancer class."""

    @pytest.fixture
    def registry_with_endpoints(self):
        """Create registry with test endpoints."""
        registry = ServiceRegistry()

        endpoints = [
            ServiceEndpoint(service_name="test-service", host="host1", port=8080),
            ServiceEndpoint(service_name="test-service", host="host2", port=8080),
            ServiceEndpoint(service_name="test-service", host="host3", port=8080),
        ]

        for endpoint in endpoints:
            registry.register_endpoint(endpoint)

        return registry

    def test_load_balancer_initialization(self, registry_with_endpoints):
        """Test load balancer initialization."""
        lb = LoadBalancer(registry_with_endpoints)

        assert lb.registry == registry_with_endpoints
        assert isinstance(lb.round_robin_counters, dict)

    @pytest.mark.asyncio
    async def test_select_endpoint_round_robin(self, registry_with_endpoints):
        """Test round robin endpoint selection."""
        lb = LoadBalancer(registry_with_endpoints)

        with patch.object(lb, "_is_healthy", return_value=True):
            # Select endpoints multiple times
            selected_hosts = []
            for _ in range(6):  # More than number of endpoints
                endpoint = await lb.select_endpoint("test-service", TrafficPolicy.ROUND_ROBIN)
                assert endpoint is not None
                selected_hosts.append(endpoint.host)

            # Should cycle through endpoints
            assert selected_hosts == ["host1", "host2", "host3", "host1", "host2", "host3"]

    @pytest.mark.asyncio
    async def test_select_endpoint_weighted(self, registry_with_endpoints):
        """Test weighted endpoint selection."""
        lb = LoadBalancer(registry_with_endpoints)

        # Set different weights
        endpoints = registry_with_endpoints.get_endpoints("test-service")
        endpoints[0].weight = 100
        endpoints[1].weight = 200
        endpoints[2].weight = 300

        with patch.object(lb, "_is_healthy", return_value=True):
            endpoint = await lb.select_endpoint("test-service", TrafficPolicy.WEIGHTED)
            assert endpoint is not None
            assert endpoint.host in ["host1", "host2", "host3"]

    @pytest.mark.asyncio
    async def test_select_endpoint_least_connections(self, registry_with_endpoints):
        """Test least connections endpoint selection."""
        lb = LoadBalancer(registry_with_endpoints)

        # Set different connection counts
        registry_with_endpoints.connection_counts["host1:8080"] = 5
        registry_with_endpoints.connection_counts["host2:8080"] = 2
        registry_with_endpoints.connection_counts["host3:8080"] = 8

        with patch.object(lb, "_is_healthy", return_value=True):
            endpoint = await lb.select_endpoint("test-service", TrafficPolicy.LEAST_CONNECTIONS)
            assert endpoint is not None
            assert endpoint.host == "host2"  # Should select host with least connections

    @pytest.mark.asyncio
    async def test_select_endpoint_no_endpoints(self):
        """Test endpoint selection with no available endpoints."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint = await lb.select_endpoint("nonexistent-service", TrafficPolicy.ROUND_ROBIN)
        assert endpoint is None

    @pytest.mark.asyncio
    async def test_select_endpoint_health_filtering(self, registry_with_endpoints):
        """Test endpoint selection filters unhealthy endpoints."""
        lb = LoadBalancer(registry_with_endpoints)

        async def mock_health_check(endpoint):
            # Only host2 is healthy
            return endpoint.host == "host2"

        with patch.object(lb, "_is_healthy", side_effect=mock_health_check):
            endpoint = await lb.select_endpoint("test-service", TrafficPolicy.ROUND_ROBIN)
            assert endpoint is not None
            assert endpoint.host == "host2"


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    return AsyncMock()


@pytest.fixture
def mock_marketplace():
    """Mock service marketplace."""
    marketplace = Mock(spec=ServiceMarketplace)
    marketplace.discover_service = AsyncMock(return_value=[])
    return marketplace


class TestServiceMesh:
    """Test ServiceMesh class."""

    @pytest.mark.asyncio
    async def test_service_mesh_initialization(self, mock_db_session, mock_marketplace):
        """Test service mesh initialization."""
        mesh = ServiceMesh(
            db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
        )

        assert mesh.db_session == mock_db_session
        assert mesh.tenant_id == "tenant-123"
        assert mesh.marketplace == mock_marketplace
        assert isinstance(mesh.registry, ServiceRegistry)
        assert isinstance(mesh.load_balancer, LoadBalancer)
        assert mesh.http_session is None  # Not initialized yet

    @pytest.mark.asyncio
    async def test_service_mesh_initialize_and_shutdown(self, mock_db_session, mock_marketplace):
        """Test service mesh initialization and shutdown."""
        mesh = ServiceMesh(
            db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
        )

        await mesh.initialize()
        assert mesh.http_session is not None
        assert mesh.health_check_task is not None

        await mesh.shutdown()
        assert mesh.health_check_task is None or mesh.health_check_task.cancelled()

    @pytest.mark.asyncio
    async def test_add_traffic_rule(self, mock_db_session, mock_marketplace):
        """Test adding traffic rule to service mesh."""
        mesh = ServiceMesh(
            db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
        )

        rule = TrafficRule(
            name="test-rule", source_service="service-a", destination_service="service-b"
        )

        mesh.add_traffic_rule(rule)
        retrieved_rule = mesh.registry.get_traffic_rule("service-a", "service-b")
        assert retrieved_rule == rule

    @pytest.mark.asyncio
    async def test_register_service_endpoint(self, mock_db_session, mock_marketplace):
        """Test registering service endpoint."""
        mesh = ServiceMesh(
            db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
        )

        endpoint = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)

        mesh.register_service_endpoint(endpoint)
        endpoints = mesh.registry.get_endpoints("test-service")
        assert len(endpoints) == 1
        assert endpoints[0] == endpoint

    def test_get_mesh_metrics(self, mock_db_session, mock_marketplace):
        """Test getting service mesh metrics."""
        mesh = ServiceMesh(
            db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
        )

        metrics = mesh.get_mesh_metrics()

        assert isinstance(metrics, dict)
        assert "tenant_id" in metrics
        assert "total_calls" in metrics
        assert "successful_calls" in metrics
        assert "failed_calls" in metrics
        assert "success_rate_percent" in metrics
        assert "average_latency_ms" in metrics
        assert metrics["tenant_id"] == "tenant-123"

    def test_get_service_topology(self, mock_db_session, mock_marketplace):
        """Test getting service topology."""
        mesh = ServiceMesh(
            db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
        )

        # Add some endpoints
        endpoint = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)
        mesh.register_service_endpoint(endpoint)

        topology = mesh.get_service_topology()

        assert isinstance(topology, dict)
        assert "services" in topology
        assert "connections" in topology
        assert "test-service" in topology["services"]


class TestServiceMeshFactory:
    """Test ServiceMeshFactory class."""

    def test_create_service_mesh(self, mock_db_session, mock_marketplace):
        """Test creating service mesh via factory."""
        mesh = ServiceMeshFactory.create_service_mesh(
            db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
        )

        assert isinstance(mesh, ServiceMesh)
        assert mesh.db_session == mock_db_session
        assert mesh.tenant_id == "tenant-123"
        assert mesh.marketplace == mock_marketplace

    def test_create_traffic_rule(self):
        """Test creating traffic rule via factory."""
        rule = ServiceMeshFactory.create_traffic_rule(
            name="test-rule",
            source_service="service-a",
            destination_service="service-b",
            policy=TrafficPolicy.WEIGHTED,
        )

        assert isinstance(rule, TrafficRule)
        assert rule.name == "test-rule"
        assert rule.source_service == "service-a"
        assert rule.destination_service == "service-b"
        assert rule.policy == TrafficPolicy.WEIGHTED

    def test_create_service_endpoint(self):
        """Test creating service endpoint via factory."""
        endpoint = ServiceMeshFactory.create_service_endpoint(
            service_name="test-service", host="localhost", port=8080, protocol="https"
        )

        assert isinstance(endpoint, ServiceEndpoint)
        assert endpoint.service_name == "test-service"
        assert endpoint.host == "localhost"
        assert endpoint.port == 8080
        assert endpoint.protocol == "https"


class TestSetupFunction:
    """Test setup_service_mesh_for_consolidated_services function."""

    @pytest.mark.asyncio
    async def test_setup_service_mesh_function(self, mock_db_session, mock_marketplace):
        """Test setup function for consolidated services."""
        with patch.object(ServiceMesh, "initialize") as mock_init:
            mesh = await setup_service_mesh_for_consolidated_services(
                db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
            )

            assert isinstance(mesh, ServiceMesh)
            assert mesh.tenant_id == "tenant-123"
            mock_init.assert_called_once()

            # Should have created traffic rules for consolidated services
            consolidated_services = [
                "unified-billing-service",
                "unified-analytics-service",
                "unified-identity-service",
            ]

            # Check that rules were created between services
            for source in consolidated_services:
                for dest in consolidated_services:
                    if source != dest:
                        rule = mesh.registry.get_traffic_rule(source, dest)
                        assert rule is not None
                        assert rule.policy == TrafficPolicy.ROUND_ROBIN
                        assert rule.retry_policy == RetryPolicy.EXPONENTIAL_BACKOFF


class TestIntegration:
    """Integration tests for resilience components."""

    @pytest.mark.asyncio
    async def test_end_to_end_service_mesh_flow(self, mock_db_session, mock_marketplace):
        """Test complete service mesh workflow."""
        # Create mesh
        mesh = ServiceMesh(
            db_session=mock_db_session, tenant_id="tenant-123", marketplace=mock_marketplace
        )

        # Register endpoint
        endpoint = ServiceEndpoint(service_name="test-service", host="localhost", port=8080)
        mesh.register_service_endpoint(endpoint)

        # Add traffic rule
        rule = TrafficRule(
            name="test-rule", source_service="client-service", destination_service="test-service"
        )
        mesh.add_traffic_rule(rule)

        # Verify setup
        assert len(mesh.registry.get_endpoints("test-service")) == 1
        assert mesh.registry.get_traffic_rule("client-service", "test-service") == rule

        # Check metrics
        metrics = mesh.get_mesh_metrics()
        assert metrics["registered_services"] == 1
        assert metrics["total_endpoints"] == 1
        assert metrics["traffic_rules"] == 1

    def test_circuit_breaker_integration(self):
        """Test circuit breaker integration with registry."""
        registry = ServiceRegistry()
        cb1 = registry.get_circuit_breaker("service-1")
        cb2 = registry.get_circuit_breaker("service-1")  # Same service
        cb3 = registry.get_circuit_breaker("service-2")  # Different service

        assert cb1 is cb2  # Same instance for same service
        assert cb1 is not cb3  # Different instances for different services

        # Test circuit breaker functionality
        assert cb1.can_execute() is True
        cb1.record_failure()
        cb1.record_failure()  # Assuming threshold is default (5)
        assert cb1.can_execute() is True  # Still under threshold
