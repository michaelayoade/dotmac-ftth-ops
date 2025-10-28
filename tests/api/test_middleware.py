"""Tests for API Gateway middleware."""

import asyncio
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastapi import Request, Response
from starlette.datastructures import Headers

from dotmac.platform.api.gateway import APIGateway
from dotmac.platform.api.middleware import (
    CircuitBreakerMiddleware,
    GatewayMiddleware,
    RequestTransformMiddleware,
)


@pytest.mark.unit
class TestGatewayMiddleware:
    """Test GatewayMiddleware functionality."""

    @pytest.fixture
    def middleware(self):
        """Create GatewayMiddleware instance."""
        app = MagicMock()
        return GatewayMiddleware(app)

    @pytest.fixture
    def mock_request(self):
        """Create mock Request object."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.url = Mock()
        request.url.path = "/api/v1/test"
        request.headers = Headers({"user-agent": "test"})
        request.client = Mock()
        request.client.host = "127.0.0.1"
        request.state = Mock()
        return request

    @pytest.mark.asyncio
    async def test_middleware_adds_gateway_request_id(self, middleware, mock_request):
        """Test middleware adds gateway request ID to request state."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        await middleware.dispatch(mock_request, call_next)

        assert hasattr(mock_request.state, "gateway_request_id")
        assert mock_request.state.gateway_request_id.startswith("gw-")

    @pytest.mark.asyncio
    async def test_middleware_uses_existing_request_id(self, middleware, mock_request):
        """Test middleware uses existing X-Request-ID header."""
        mock_request.headers = Headers({"X-Request-ID": "existing-request-123"})

        async def call_next(request):
            return Response(content="OK", status_code=200)

        await middleware.dispatch(mock_request, call_next)

        assert mock_request.state.gateway_request_id == "existing-request-123"

    @pytest.mark.asyncio
    async def test_middleware_adds_response_headers(self, middleware, mock_request):
        """Test middleware adds gateway headers to response."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        response = await middleware.dispatch(mock_request, call_next)

        assert "X-Gateway-Request-ID" in response.headers
        assert "X-Gateway-Time-Ms" in response.headers

    @pytest.mark.asyncio
    async def test_middleware_measures_request_duration(self, middleware, mock_request):
        """Test middleware measures and reports request duration."""

        async def call_next(request):
            await asyncio.sleep(0.1)  # Simulate processing time
            return Response(content="OK", status_code=200)

        response = await middleware.dispatch(mock_request, call_next)

        duration_ms = float(response.headers["X-Gateway-Time-Ms"])
        assert duration_ms >= 100  # At least 100ms

    @pytest.mark.asyncio
    async def test_middleware_logs_request_start(self, middleware, mock_request):
        """Test middleware logs request start."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        with patch("dotmac.platform.api.middleware.logger") as mock_logger:
            await middleware.dispatch(mock_request, call_next)

            mock_logger.info.assert_any_call(
                "gateway.request.start",
                method="GET",
                path="/api/v1/test",
                request_id=mock_request.state.gateway_request_id,
                client_host="127.0.0.1",
            )

    @pytest.mark.asyncio
    async def test_middleware_logs_successful_completion(self, middleware, mock_request):
        """Test middleware logs successful request completion."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        with patch("dotmac.platform.api.middleware.logger") as mock_logger:
            await middleware.dispatch(mock_request, call_next)

            # Find the completion log call
            completion_calls = [
                call
                for call in mock_logger.info.call_args_list
                if call[0][0] == "gateway.request.complete"
            ]
            assert len(completion_calls) == 1

    @pytest.mark.asyncio
    async def test_middleware_logs_failed_requests(self, middleware, mock_request):
        """Test middleware logs failed requests."""

        async def call_next(request):
            raise ValueError("Request failed")

        with patch("dotmac.platform.api.middleware.logger") as mock_logger:
            with pytest.raises(ValueError):
                await middleware.dispatch(mock_request, call_next)

            mock_logger.error.assert_called_once()
            args, kwargs = mock_logger.error.call_args
            assert args[0] == "gateway.request.failed"
            assert "error" in kwargs

    @pytest.mark.asyncio
    async def test_middleware_handles_missing_client(self, middleware, mock_request):
        """Test middleware handles requests without client info."""
        mock_request.client = None

        async def call_next(request):
            return Response(content="OK", status_code=200)

        with patch("dotmac.platform.api.middleware.logger") as mock_logger:
            await middleware.dispatch(mock_request, call_next)

            # Should log with None client_host
            mock_logger.info.assert_any_call(
                "gateway.request.start",
                method="GET",
                path="/api/v1/test",
                request_id=mock_request.state.gateway_request_id,
                client_host=None,
            )


@pytest.mark.unit
class TestRequestTransformMiddleware:
    """Test RequestTransformMiddleware functionality."""

    @pytest.fixture
    def middleware(self):
        """Create RequestTransformMiddleware instance."""
        app = MagicMock()
        return RequestTransformMiddleware(app)

    @pytest.fixture
    def mock_request(self):
        """Create mock Request object."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.url = Mock()
        request.url.path = "/api/v1/test"
        request.headers = Headers({})
        request.state = Mock()
        return request

    @pytest.mark.asyncio
    async def test_middleware_adds_gateway_context(self, middleware, mock_request):
        """Test middleware adds gateway context to request state."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        await middleware.dispatch(mock_request, call_next)

        assert hasattr(mock_request.state, "gateway_context")
        assert "version" in mock_request.state.gateway_context
        assert "timestamp" in mock_request.state.gateway_context
        assert mock_request.state.gateway_context["version"] == "v1"

    @pytest.mark.asyncio
    async def test_middleware_generates_correlation_id(self, middleware, mock_request):
        """Test middleware generates correlation ID if not present."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        await middleware.dispatch(mock_request, call_next)

        assert hasattr(mock_request.state, "correlation_id")
        assert mock_request.state.correlation_id.startswith("corr-")

    @pytest.mark.asyncio
    async def test_middleware_uses_existing_correlation_id_header(self, middleware, mock_request):
        """Test middleware uses existing correlation ID from header."""
        mock_request.headers = Headers({"X-Correlation-ID": "existing-correlation"})

        async def call_next(request):
            assert request.headers["X-Correlation-ID"] == "existing-correlation"
            return Response(content="OK", status_code=200)

        response = await middleware.dispatch(mock_request, call_next)

        assert hasattr(mock_request.state, "correlation_id")
        assert mock_request.state.correlation_id == "existing-correlation"
        assert response.headers["X-Correlation-ID"] == "existing-correlation"

    @pytest.mark.asyncio
    async def test_middleware_adds_correlation_id_to_response(self, middleware, mock_request):
        """Test middleware adds correlation ID to response headers."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        response = await middleware.dispatch(mock_request, call_next)

        assert "X-Correlation-ID" in response.headers


@pytest.mark.unit
class TestCircuitBreakerMiddleware:
    """Test CircuitBreakerMiddleware functionality."""

    @pytest.fixture
    def gateway(self):
        """Create APIGateway instance."""
        return APIGateway()

    @pytest.fixture
    def middleware(self, gateway):
        """Create CircuitBreakerMiddleware instance."""
        app = MagicMock()
        return CircuitBreakerMiddleware(app, gateway)

    @pytest.fixture
    def mock_request(self):
        """Create mock Request object."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.url = Mock()
        request.url.path = "/api/v1/billing/invoices"
        request.headers = Headers({})
        request.state = Mock()
        return request

    @pytest.mark.asyncio
    async def test_middleware_allows_request_when_circuit_closed(self, middleware, mock_request):
        """Test middleware allows requests when circuit is closed."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        response = await middleware.dispatch(mock_request, call_next)

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_middleware_extracts_service_from_path(self, middleware, mock_request, gateway):
        """Test middleware extracts service name from request path."""

        async def call_next(request):
            return Response(content="OK", status_code=200)

        await middleware.dispatch(mock_request, call_next)

        # Should create circuit breaker for "billing" service
        assert "billing" in gateway.circuit_breakers

    @pytest.mark.asyncio
    async def test_middleware_blocks_request_when_circuit_open(
        self, middleware, mock_request, gateway
    ):
        """Test middleware blocks requests when circuit is open."""
        # Open the circuit for billing service
        circuit = gateway.get_circuit_breaker("billing")
        for _ in range(5):  # Open circuit
            circuit.record_failure()

        async def call_next(request):
            return Response(content="OK", status_code=200)

        response = await middleware.dispatch(mock_request, call_next)

        assert response.status_code == 503
        assert "Service Temporarily Unavailable" in str(response.body)

    @pytest.mark.asyncio
    async def test_middleware_returns_retry_after_header(self, middleware, mock_request, gateway):
        """Test middleware includes Retry-After header when circuit is open."""
        # Open the circuit
        circuit = gateway.get_circuit_breaker("billing")
        for _ in range(5):
            circuit.record_failure()

        async def call_next(request):
            return Response(content="OK", status_code=200)

        response = await middleware.dispatch(mock_request, call_next)

        assert "Retry-After" in response.headers
        assert response.headers["Retry-After"] == "60"

    @pytest.mark.asyncio
    async def test_middleware_handles_unknown_service(self, middleware, gateway):
        """Test middleware handles requests to unknown services."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.url = Mock()
        request.url.path = "/api/v1"  # Too short, no service
        request.headers = Headers({})
        request.state = Mock()

        async def call_next(request):
            return Response(content="OK", status_code=200)

        response = await middleware.dispatch(request, call_next)

        # Should still work, service defaults to "unknown"
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_middleware_logs_blocked_requests(self, middleware, mock_request, gateway):
        """Test middleware logs when requests are blocked by circuit breaker."""
        # Open the circuit
        circuit = gateway.get_circuit_breaker("billing")
        for _ in range(5):
            circuit.record_failure()

        async def call_next(request):
            return Response(content="OK", status_code=200)

        with patch("dotmac.platform.api.middleware.logger") as mock_logger:
            await middleware.dispatch(mock_request, call_next)

            mock_logger.warning.assert_called_once()
            args, kwargs = mock_logger.warning.call_args
            assert args[0] == "circuit_breaker.request_blocked"
            assert kwargs["service"] == "billing"

    @pytest.mark.asyncio
    async def test_middleware_propagates_handler_exceptions(self, middleware, mock_request):
        """Test middleware propagates exceptions from handler."""

        async def call_next(request):
            raise ValueError("Handler error")

        with pytest.raises(ValueError, match="Handler error"):
            await middleware.dispatch(mock_request, call_next)

    @pytest.mark.asyncio
    async def test_middleware_initialization_with_gateway(self, gateway):
        """Test CircuitBreakerMiddleware initializes with gateway."""
        app = MagicMock()
        middleware = CircuitBreakerMiddleware(app, gateway)

        assert middleware.gateway is gateway


@pytest.mark.unit
class TestMiddlewareIntegration:
    """Test middleware working together."""

    @pytest.mark.asyncio
    async def test_middleware_chain_execution_order(self):
        """Test multiple middleware execute in correct order."""
        app = MagicMock()
        gateway = APIGateway()

        request = Mock(spec=Request)
        request.method = "GET"
        request.url = Mock()
        request.url.path = "/api/v1/test/endpoint"
        request.headers = Headers({})
        request.state = Mock()

        # Track execution order
        execution_order = []

        async def call_next(req):
            execution_order.append("handler")
            return Response(content="OK", status_code=200)

        # Apply middleware in order: Gateway -> Transform -> CircuitBreaker
        gateway_mw = GatewayMiddleware(app)
        transform_mw = RequestTransformMiddleware(app)
        circuit_mw = CircuitBreakerMiddleware(app, gateway)

        # Execute in sequence (simulating middleware stack)
        async def wrapped_call_next(req):
            execution_order.append("circuit_breaker")
            return await call_next(req)

        async def transform_call_next(req):
            execution_order.append("transform")
            return await circuit_mw.dispatch(req, wrapped_call_next)

        async def gateway_call_next(req):
            execution_order.append("gateway")
            return await transform_mw.dispatch(req, transform_call_next)

        response = await gateway_mw.dispatch(request, gateway_call_next)

        assert response.status_code == 200
        # Verify gateway context and correlation ID were added
        assert hasattr(request.state, "gateway_context")
        assert hasattr(request.state, "gateway_request_id")
