"""
API Gateway middleware.

Provides gateway-specific middleware for request processing.
"""

import time
from collections.abc import Awaitable, Callable
from typing import Any

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = structlog.get_logger(__name__)

CallNext = Callable[[Request], Awaitable[Response]]


class GatewayMiddleware(BaseHTTPMiddleware):
    """
    API Gateway middleware for request/response processing.

    Features:
    - Request timing
    - Service routing headers
    - Gateway-level logging
    - Request transformation
    """

    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        """
        Process request through gateway.

        Args:
            request: FastAPI Request
            call_next: Next middleware in chain

        Returns:
            Response
        """
        # Start timer
        start_time = time.time()

        # Add gateway headers
        request.state.gateway_request_id = (
            request.headers.get("X-Request-ID") or f"gw-{int(time.time() * 1000)}"
        )

        # Log gateway request
        logger.info(
            "gateway.request.start",
            method=request.method,
            path=request.url.path,
            request_id=request.state.gateway_request_id,
            client_host=request.client.host if request.client else None,
        )

        try:
            # Process request
            response = await call_next(request)

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Add gateway headers to response
            response.headers["X-Gateway-Request-ID"] = request.state.gateway_request_id
            response.headers["X-Gateway-Time-Ms"] = f"{duration_ms:.2f}"

            # Log successful response
            logger.info(
                "gateway.request.complete",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
                request_id=request.state.gateway_request_id,
            )

            return response

        except Exception as e:
            # Calculate duration for failed requests
            duration_ms = (time.time() - start_time) * 1000

            # Log error
            logger.error(
                "gateway.request.failed",
                method=request.method,
                path=request.url.path,
                error=str(e),
                duration_ms=round(duration_ms, 2),
                request_id=request.state.gateway_request_id,
            )

            raise


class RequestTransformMiddleware(BaseHTTPMiddleware):
    """
    Middleware for transforming requests.

    Can modify headers, add context, validate requests.
    """

    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        """
        Transform request before processing.

        Args:
            request: FastAPI Request
            call_next: Next middleware

        Returns:
            Response
        """
        # Add gateway context
        request.state.gateway_context = {
            "version": "v1",
            "timestamp": time.time(),
        }

        # Ensure correlation ID is available on state for downstream use
        header_correlation_id = request.headers.get("X-Correlation-ID")
        if header_correlation_id:
            request.state.correlation_id = header_correlation_id
        else:
            request.state.correlation_id = f"corr-{int(time.time() * 1000)}"

        response = await call_next(request)

        # Add correlation ID to response (always reflect request value)
        response.headers["X-Correlation-ID"] = request.state.correlation_id

        return response


class CircuitBreakerMiddleware(BaseHTTPMiddleware):
    """
    Circuit breaker middleware for fault tolerance.

    Integrates with gateway circuit breakers.
    """

    def __init__(self, app: ASGIApp, gateway: Any) -> None:
        """
        Initialize circuit breaker middleware.

        Args:
            app: ASGI application
            gateway: APIGateway instance
        """
        super().__init__(app)
        self.gateway = gateway

    def _extract_service_name(self, path: str) -> str:
        """
        Extract service name from path for circuit breaker scoping.

        Path patterns:
        - /api/platform/v1/{service}/... → extract 'service' (index 4)
        - /api/tenant/v1/{service}/... → extract 'service' (index 4)
        - /api/v1/{service}/... → extract 'service' (index 3)
        - Other paths → return 'unknown'

        Args:
            path: Request path

        Returns:
            Service name for circuit breaker scoping
        """
        path_parts = path.split("/")

        # /api/platform/v1/{service}/... or /api/tenant/v1/{service}/...
        if (
            len(path_parts) > 4
            and path_parts[1] == "api"
            and path_parts[2] in ("platform", "tenant")
        ):
            service = path_parts[4]  # service name after /api/{boundary}/v1/
            return service or "unknown"

        # /api/v1/{service}/...
        if len(path_parts) > 3 and path_parts[1] == "api" and path_parts[2] == "v1":
            service = path_parts[3]  # service name after /api/v1/
            return service or "unknown"

        # Fallback for non-API paths or unknown patterns
        return "unknown"

    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        """
        Check circuit breaker before processing.

        Args:
            request: FastAPI Request
            call_next: Next middleware

        Returns:
            Response
        """
        # Extract service from path using proper parsing
        # Fixed: Now correctly extracts service name from different path structures
        # instead of always using index 3 which gave "v1" for platform/tenant routes
        service = self._extract_service_name(request.url.path)

        # Check circuit breaker
        circuit = self.gateway.get_circuit_breaker(service)

        if not circuit.can_attempt():
            logger.warning(
                "circuit_breaker.request_blocked",
                service=service,
                state=circuit.state,
                path=request.url.path,
            )

            # Return 503 Service Unavailable
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=503,
                content={
                    "error": "Service Temporarily Unavailable",
                    "service": service,
                    "circuit_state": circuit.state,
                    "message": "The service is experiencing issues. Please try again later.",
                },
                headers={"Retry-After": "60"},
            )

        try:
            response = await call_next(request)
            return response

        except Exception:
            # Circuit breaker will be updated by gateway
            raise
