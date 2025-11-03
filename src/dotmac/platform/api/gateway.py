"""
API Gateway - Main entry point for all API requests.

Provides:
- Centralized routing
- Request/response transformation
- Circuit breaking
- Gateway-level caching
- Request aggregation
"""

import asyncio
import time
from datetime import UTC, datetime
from enum import Enum
from typing import Any, cast

import structlog
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

logger = structlog.get_logger(__name__)


class ServiceStatus(str, Enum):
    """Service health status."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    CIRCUIT_OPEN = "circuit_open"


class CircuitBreakerState(str, Enum):
    """Circuit breaker states."""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker pattern implementation.

    Prevents cascading failures by stopping requests to failing services.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 60,
    ):
        """
        Initialize circuit breaker.

        Args:
            failure_threshold: Number of failures before opening circuit
            success_threshold: Number of successes needed to close circuit
            timeout: Seconds to wait before attempting recovery
        """
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout

        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: float | None = None

    def record_success(self) -> None:
        """Record successful request."""
        self.failure_count = 0

        if self.state == CircuitBreakerState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitBreakerState.CLOSED
                self.success_count = 0
                logger.info("circuit_breaker.closed", state=self.state)

    def record_failure(self) -> None:
        """Record failed request."""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN
            logger.warning(
                "circuit_breaker.opened",
                state=self.state,
                failure_count=self.failure_count,
            )

    def can_attempt(self) -> bool:
        """Check if request should be attempted."""
        if self.state == CircuitBreakerState.CLOSED:
            return True

        if self.state == CircuitBreakerState.OPEN:
            # Check if timeout expired
            if self.last_failure_time and time.time() - self.last_failure_time >= self.timeout:
                self.state = CircuitBreakerState.HALF_OPEN
                self.success_count = 0
                logger.info("circuit_breaker.half_open", state=self.state)
                return True
            return False

        # HALF_OPEN state - allow attempts
        return True


class GatewayResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """API Gateway response model."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    data: Any = None
    status_code: int = 200
    headers: dict[str, str] = Field(default_factory=lambda: {})
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class APIGateway:
    """
    API Gateway for routing and managing requests.

    Features:
    - Request routing to backend services
    - Circuit breaking for fault tolerance
    - Request/response transformation
    - Aggregation of multiple service calls
    """

    def __init__(self) -> None:
        """Initialize API Gateway."""
        self.circuit_breakers: dict[str, CircuitBreaker] = {}
        self._cache: dict[str, tuple[Any, float]] = {}
        self._cache_ttl = 300  # 5 minutes

    def get_circuit_breaker(self, service_name: str) -> CircuitBreaker:
        """
        Get or create circuit breaker for service.

        Args:
            service_name: Name of the backend service

        Returns:
            CircuitBreaker instance
        """
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = CircuitBreaker()
        return self.circuit_breakers[service_name]

    async def route_request(
        self,
        service_name: str,
        handler: Any,
        *args: Any,
        **kwargs: Any,
    ) -> GatewayResponse:
        """
        Route request through circuit breaker.

        Args:
            service_name: Name of service
            handler: Async function to call
            *args: Positional arguments for handler
            **kwargs: Keyword arguments for handler

        Returns:
            GatewayResponse with result

        Raises:
            HTTPException: If circuit is open or request fails
        """
        circuit = self.get_circuit_breaker(service_name)

        if not circuit.can_attempt():
            logger.warning(
                "gateway.circuit_open",
                service=service_name,
                state=circuit.state,
            )
            raise HTTPException(
                status_code=503,
                detail=f"Service {service_name} temporarily unavailable (circuit open)",
            )

        try:
            result = await handler(*args, **kwargs)
            circuit.record_success()

            return GatewayResponse(
                data=result,
                status_code=200,
                metadata={
                    "service": service_name,
                    "circuit_state": circuit.state,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
            )

        except Exception as e:
            circuit.record_failure()
            logger.error(
                "gateway.request_failed",
                service=service_name,
                error=str(e),
                circuit_state=circuit.state,
            )
            raise

    async def aggregate_requests(
        self,
        requests: list[tuple[str, Any, tuple[Any, ...], dict[str, Any]]],
    ) -> dict[str, Any]:
        """
        Aggregate multiple service requests in parallel.

        Args:
            requests: List of (service_name, handler, args, kwargs) tuples

        Returns:
            Dictionary mapping service names to results
        """
        tasks = [
            self.route_request(service_name, handler, *args, **kwargs)
            for service_name, handler, args, kwargs in requests
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        aggregated: dict[str, Any] = {}
        for (service_name, _, _, _), result in zip(requests, results, strict=False):
            if isinstance(result, Exception):
                aggregated[service_name] = {
                    "error": str(result),
                    "status": "failed",
                }
            else:
                response = cast(GatewayResponse, result)
                aggregated[service_name] = {
                    "data": response.data,
                    "status": "success",
                }

        return aggregated

    def get_service_health(self, service_name: str) -> ServiceStatus:
        """
        Get health status of a service.

        Args:
            service_name: Name of service

        Returns:
            ServiceStatus enum
        """
        if service_name not in self.circuit_breakers:
            return ServiceStatus.HEALTHY

        circuit = self.circuit_breakers[service_name]

        if circuit.state == CircuitBreakerState.OPEN:
            return ServiceStatus.CIRCUIT_OPEN
        elif circuit.state == CircuitBreakerState.HALF_OPEN:
            return ServiceStatus.DEGRADED
        elif circuit.failure_count > 0:
            return ServiceStatus.DEGRADED
        else:
            return ServiceStatus.HEALTHY

    def get_all_service_health(self) -> dict[str, ServiceStatus]:
        """Get health status of all services."""
        return {
            service: self.get_service_health(service) for service in self.circuit_breakers.keys()
        }


# Global gateway instance
gateway = APIGateway()
