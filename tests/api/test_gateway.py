"""Tests for API Gateway core functionality."""

import asyncio

import pytest
from fastapi import HTTPException

from dotmac.platform.api.gateway import (
    APIGateway,
    CircuitBreaker,
    CircuitBreakerState,
    GatewayResponse,
    ServiceStatus,
)


@pytest.mark.unit
class TestCircuitBreaker:
    """Test circuit breaker pattern implementation."""

    def test_circuit_breaker_initialization(self):
        """Test circuit breaker initializes in CLOSED state."""
        circuit = CircuitBreaker(failure_threshold=5, success_threshold=2, timeout=60)

        assert circuit.state == CircuitBreakerState.CLOSED
        assert circuit.failure_count == 0
        assert circuit.success_count == 0
        assert circuit.last_failure_time is None

    def test_circuit_breaker_allows_attempts_when_closed(self):
        """Test circuit breaker allows requests in CLOSED state."""
        circuit = CircuitBreaker()

        assert circuit.can_attempt() is True

    def test_circuit_breaker_opens_after_threshold(self):
        """Test circuit breaker opens after reaching failure threshold."""
        circuit = CircuitBreaker(failure_threshold=3)

        # Simulate failures
        circuit.record_failure()
        assert circuit.state == CircuitBreakerState.CLOSED
        circuit.record_failure()
        assert circuit.state == CircuitBreakerState.CLOSED
        circuit.record_failure()

        # Circuit should now be open
        assert circuit.state == CircuitBreakerState.OPEN
        assert circuit.can_attempt() is False

    def test_circuit_breaker_half_open_after_timeout(self):
        """Test circuit breaker transitions to HALF_OPEN after timeout."""
        circuit = CircuitBreaker(failure_threshold=2, timeout=1)

        # Open the circuit
        circuit.record_failure()
        circuit.record_failure()
        assert circuit.state == CircuitBreakerState.OPEN

        # Wait for timeout
        import time

        time.sleep(1.1)

        # Circuit should transition to HALF_OPEN
        assert circuit.can_attempt() is True
        assert circuit.state == CircuitBreakerState.HALF_OPEN

    def test_circuit_breaker_closes_after_success_threshold(self):
        """Test circuit breaker closes after successes in HALF_OPEN state."""
        circuit = CircuitBreaker(failure_threshold=2, success_threshold=2, timeout=1)

        # Open the circuit
        circuit.record_failure()
        circuit.record_failure()

        # Wait and transition to HALF_OPEN
        import time

        time.sleep(1.1)
        circuit.can_attempt()  # Triggers HALF_OPEN transition

        # Record successes
        circuit.record_success()
        assert circuit.state == CircuitBreakerState.HALF_OPEN
        circuit.record_success()

        # Circuit should close
        assert circuit.state == CircuitBreakerState.CLOSED
        assert circuit.success_count == 0

    def test_circuit_breaker_success_resets_failure_count(self):
        """Test successful request resets failure count."""
        circuit = CircuitBreaker(failure_threshold=5)

        circuit.record_failure()
        circuit.record_failure()
        assert circuit.failure_count == 2

        circuit.record_success()
        assert circuit.failure_count == 0


@pytest.mark.unit
class TestAPIGateway:
    """Test API Gateway functionality."""

    @pytest.fixture
    def gateway(self):
        """Create API Gateway instance."""
        return APIGateway()

    def test_gateway_initialization(self, gateway):
        """Test gateway initializes correctly."""
        assert isinstance(gateway.circuit_breakers, dict)
        assert len(gateway.circuit_breakers) == 0

    def test_gateway_creates_circuit_breaker_for_service(self, gateway):
        """Test gateway creates circuit breaker for new services."""
        circuit = gateway.get_circuit_breaker("billing")

        assert isinstance(circuit, CircuitBreaker)
        assert "billing" in gateway.circuit_breakers

        # Subsequent calls return same circuit
        circuit2 = gateway.get_circuit_breaker("billing")
        assert circuit is circuit2

    @pytest.mark.asyncio
    async def test_gateway_routes_successful_request(self, gateway):
        """Test gateway routes successful request through circuit breaker."""

        async def mock_handler():
            return {"status": "success", "data": "test"}

        response = await gateway.route_request("test_service", mock_handler)

        assert isinstance(response, GatewayResponse)
        assert response.status_code == 200
        assert response.data == {"status": "success", "data": "test"}
        assert response.metadata["service"] == "test_service"
        assert response.metadata["circuit_state"] == CircuitBreakerState.CLOSED

    @pytest.mark.asyncio
    async def test_gateway_handles_handler_failure(self, gateway):
        """Test gateway handles handler failures correctly."""

        async def failing_handler():
            raise ValueError("Handler failed")

        with pytest.raises(ValueError, match="Handler failed"):
            await gateway.route_request("test_service", failing_handler)

        # Circuit breaker should record failure
        circuit = gateway.get_circuit_breaker("test_service")
        assert circuit.failure_count == 1

    @pytest.mark.asyncio
    async def test_gateway_rejects_request_when_circuit_open(self, gateway):
        """Test gateway rejects requests when circuit is open."""

        async def failing_handler():
            raise ValueError("Handler failed")

        # Fail enough times to open circuit (default threshold is 5)
        for _ in range(5):
            with pytest.raises(ValueError):
                await gateway.route_request("test_service", failing_handler)

        # Next request should be rejected by circuit breaker
        with pytest.raises(HTTPException) as exc_info:
            await gateway.route_request("test_service", failing_handler)

        assert exc_info.value.status_code == 503
        assert "temporarily unavailable" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_gateway_aggregates_multiple_requests(self, gateway):
        """Test gateway aggregates multiple service requests in parallel."""

        async def service1_handler():
            await asyncio.sleep(0.1)
            return {"service": "service1", "data": "test1"}

        async def service2_handler():
            await asyncio.sleep(0.1)
            return {"service": "service2", "data": "test2"}

        async def service3_handler():
            await asyncio.sleep(0.1)
            return {"service": "service3", "data": "test3"}

        requests = [
            ("service1", service1_handler, (), {}),
            ("service2", service2_handler, (), {}),
            ("service3", service3_handler, (), {}),
        ]

        import time

        start = time.time()
        results = await gateway.aggregate_requests(requests)
        duration = time.time() - start

        # Should complete in parallel (~0.1s not ~0.3s)
        assert duration < 0.2

        assert "service1" in results
        assert results["service1"]["status"] == "success"
        # GatewayResponse.data contains the handler result
        assert results["service1"]["data"]["data"] == "test1"
        assert results["service1"]["data"]["service"] == "service1"

        assert "service2" in results
        assert results["service2"]["status"] == "success"

        assert "service3" in results
        assert results["service3"]["status"] == "success"

    @pytest.mark.asyncio
    async def test_gateway_aggregates_handles_partial_failures(self, gateway):
        """Test gateway aggregation handles partial failures."""

        async def success_handler():
            return {"status": "success"}

        async def failing_handler():
            raise ValueError("Service failed")

        requests = [
            ("service1", success_handler, (), {}),
            ("service2", failing_handler, (), {}),
        ]

        results = await gateway.aggregate_requests(requests)

        assert results["service1"]["status"] == "success"
        assert results["service2"]["status"] == "failed"
        assert "Service failed" in results["service2"]["error"]

    def test_gateway_gets_service_health_status(self, gateway):
        """Test gateway reports service health status."""
        # New service - healthy
        status = gateway.get_service_health("new_service")
        assert status == ServiceStatus.HEALTHY

        # Create circuit breaker and record failure
        circuit = gateway.get_circuit_breaker("test_service")
        circuit.record_failure()

        status = gateway.get_service_health("test_service")
        assert status == ServiceStatus.DEGRADED

        # Open circuit
        for _ in range(4):  # Need 5 total failures
            circuit.record_failure()

        status = gateway.get_service_health("test_service")
        assert status == ServiceStatus.CIRCUIT_OPEN

    def test_gateway_gets_all_service_health(self, gateway):
        """Test gateway reports health for all services."""
        # Create circuits for multiple services
        gateway.get_circuit_breaker("service1")
        gateway.get_circuit_breaker("service2")

        circuit3 = gateway.get_circuit_breaker("service3")
        circuit3.record_failure()

        health = gateway.get_all_service_health()

        assert "service1" in health
        assert "service2" in health
        assert "service3" in health
        assert health["service1"] == ServiceStatus.HEALTHY
        assert health["service3"] == ServiceStatus.DEGRADED

    @pytest.mark.asyncio
    async def test_gateway_passes_handler_arguments(self, gateway):
        """Test gateway passes arguments to handler correctly."""

        async def handler_with_args(arg1, arg2, kwarg1=None):
            return {"arg1": arg1, "arg2": arg2, "kwarg1": kwarg1}

        response = await gateway.route_request(
            "test_service",
            handler_with_args,
            "value1",
            "value2",
            kwarg1="kwvalue1",
        )

        assert response.data == {"arg1": "value1", "arg2": "value2", "kwarg1": "kwvalue1"}

    @pytest.mark.asyncio
    async def test_gateway_response_includes_metadata(self, gateway):
        """Test gateway response includes service metadata."""

        async def mock_handler():
            return {"test": "data"}

        response = await gateway.route_request("billing", mock_handler)

        assert "service" in response.metadata
        assert response.metadata["service"] == "billing"
        assert "circuit_state" in response.metadata
        assert "timestamp" in response.metadata


@pytest.mark.unit
class TestGatewayResponse:
    """Test Gateway Response model."""

    def test_gateway_response_initialization(self):
        """Test GatewayResponse model initialization."""
        response = GatewayResponse(
            data={"test": "data"},
            status_code=200,
            headers={"X-Custom": "value"},
            metadata={"service": "test"},
        )

        assert response.data == {"test": "data"}
        assert response.status_code == 200
        assert response.headers["X-Custom"] == "value"
        assert response.metadata["service"] == "test"

    def test_gateway_response_defaults(self):
        """Test GatewayResponse default values."""
        response = GatewayResponse()

        assert response.data is None
        assert response.status_code == 200
        assert response.headers == {}
        assert response.metadata == {}
