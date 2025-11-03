"""
Middleware and Error Handling Testing - Phase 2
Comprehensive testing of middleware components, error handling, and request/response processing.
"""

import json
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any
from unittest.mock import Mock

import pytest

pytestmark = [
    pytest.mark.unit,
    pytest.mark.asyncio,
]


class ErrorType(Enum):
    """Error type enumeration"""

    VALIDATION_ERROR = "validation_error"
    AUTHENTICATION_ERROR = "authentication_error"
    AUTHORIZATION_ERROR = "authorization_error"
    NOT_FOUND_ERROR = "not_found_error"
    RATE_LIMIT_ERROR = "rate_limit_error"
    INTERNAL_ERROR = "internal_error"
    EXTERNAL_SERVICE_ERROR = "external_service_error"


class MockRequest:
    """Mock request object for middleware testing"""

    def __init__(
        self,
        method: str = "GET",
        url: str = "/",
        headers: dict = None,
        body: bytes = b"",
        client_ip: str = "127.0.0.1",
    ):
        self.method = method
        self.url = url
        self.headers = headers or {}
        self.body = body
        self.client = Mock()
        self.client.host = client_ip
        self.start_time = time.time()
        self.state = {}

    async def json(self) -> dict:
        """Parse request body as JSON"""
        if self.body:
            return json.loads(self.body.decode())
        return {}


class MockResponse:
    """Mock response object for middleware testing"""

    def __init__(self, content: Any = None, status_code: int = 200, headers: dict = None):
        self.content = content
        self.status_code = status_code
        self.headers = headers or {}
        self.media_type = "application/json"


class CustomException(Exception):
    """Custom exception for testing"""

    def __init__(self, message: str, error_code: str = None, details: dict = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}


class AuthenticationMiddleware:
    """Authentication middleware for testing"""

    def __init__(self, request=None):
        self.jwt_service = Mock()
        self.api_key_service = Mock()
        self.session_store = {}

    async def __call__(
        self, request: MockRequest, call_next: Callable[[MockRequest], Awaitable[MockResponse]]
    ) -> MockResponse:
        """Process authentication middleware"""
        # Skip auth for health check endpoints
        if request.url.startswith("/health"):
            return await call_next(request)

        # Check for API key authentication
        api_key = request.headers.get("X-API-Key")
        if api_key:
            if await self._validate_api_key(api_key):
                request.state["auth_type"] = "api_key"
                request.state["authenticated"] = True
                return await call_next(request)
            else:
                return MockResponse(
                    {"error": "Invalid API key", "code": "INVALID_API_KEY"}, status_code=401
                )

        # Check for JWT authentication
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]  # Remove "Bearer "

            try:
                payload = await self._validate_jwt_token(token)
                request.state["auth_type"] = "jwt"
                request.state["authenticated"] = True
                request.state["user_id"] = payload["sub"]
                request.state["tenant_id"] = payload.get("tenant_id")
                return await call_next(request)
            except Exception:
                return MockResponse(
                    {"error": "Invalid or expired token", "code": "INVALID_TOKEN"}, status_code=401
                )

        # Check for session authentication
        session_id = request.headers.get("X-Session-ID")
        if session_id and session_id in self.session_store:
            session = self.session_store[session_id]
            if session["expires"] > datetime.now(UTC):
                request.state["auth_type"] = "session"
                request.state["authenticated"] = True
                request.state["user_id"] = session["user_id"]
                return await call_next(request)

        # No valid authentication found
        return MockResponse(
            {"error": "Authentication required", "code": "AUTHENTICATION_REQUIRED"}, status_code=401
        )

    async def _validate_api_key(self, api_key: str) -> bool:
        """Validate API key"""
        # Mock validation - keys starting with "valid_" are considered valid
        return api_key.startswith("valid_")

    async def _validate_jwt_token(self, token: str) -> dict:
        """Validate JWT token"""
        # Mock validation
        if token == "valid_jwt_token":
            return {
                "sub": "user_123",
                "tenant_id": "tenant_123",
                "exp": int(datetime.now(UTC).timestamp() + 3600),
            }
        elif token == "expired_token":
            raise CustomException("Token expired", "TOKEN_EXPIRED")
        else:
            raise CustomException("Invalid token", "INVALID_TOKEN")


class RateLimitMiddleware:
    """Rate limiting middleware for testing"""

    def __init__(self, requests_per_minute: int = 100):
        self.requests_per_minute = requests_per_minute
        self.request_counts = {}  # client_ip -> [(timestamp, count)]
        self.window_size = 60  # 1 minute window

    async def __call__(
        self, request: MockRequest, call_next: Callable[[MockRequest], Awaitable[MockResponse]]
    ) -> MockResponse:
        """Process rate limiting middleware"""
        client_ip = request.client.host
        now = time.time()

        # Clean old entries
        self._clean_old_entries(client_ip, now)

        # Check current rate
        if self._is_rate_limited(client_ip, now):
            return MockResponse(
                {"error": "Rate limit exceeded", "code": "RATE_LIMIT_EXCEEDED", "retry_after": 60},
                status_code=429,
                headers={"Retry-After": "60"},
            )

        # Record this request
        self._record_request(client_ip, now)

        return await call_next(request)

    def _clean_old_entries(self, client_ip: str, now: float):
        """Remove old entries outside the time window"""
        if client_ip in self.request_counts:
            cutoff_time = now - self.window_size
            self.request_counts[client_ip] = [
                timestamp for timestamp in self.request_counts[client_ip] if timestamp > cutoff_time
            ]

    def _is_rate_limited(self, client_ip: str, now: float) -> bool:
        """Check if client is rate limited"""
        if client_ip not in self.request_counts:
            return False

        current_count = len(self.request_counts[client_ip])
        return current_count >= self.requests_per_minute

    def _record_request(self, client_ip: str, now: float):
        """Record a new request"""
        if client_ip not in self.request_counts:
            self.request_counts[client_ip] = []

        self.request_counts[client_ip].append(now)


class ErrorHandlingMiddleware:
    """Error handling middleware for testing"""

    def __init__(self):
        self.error_counts = {}
        self.logger = Mock()

    async def __call__(
        self, request: MockRequest, call_next: Callable[[MockRequest], Awaitable[MockResponse]]
    ) -> MockResponse:
        """Process error handling middleware"""
        try:
            response = await call_next(request)
            return response

        except CustomException as e:
            # Handle custom application exceptions
            error_response = self._handle_custom_exception(e, request)
            await self._log_error(e, request, error_response.status_code)
            return error_response

        except ValueError as e:
            # Handle validation errors
            error_response = MockResponse(
                {"error": "Validation error", "code": "VALIDATION_ERROR", "message": str(e)},
                status_code=400,
            )
            await self._log_error(e, request, 400)
            return error_response

        except PermissionError as e:
            # Handle permission errors
            error_response = MockResponse(
                {"error": "Permission denied", "code": "PERMISSION_DENIED", "message": str(e)},
                status_code=403,
            )
            await self._log_error(e, request, 403)
            return error_response

        except Exception as e:
            # Handle unexpected errors
            error_id = f"error_{int(time.time())}_{hash(str(e)) % 1000000}"

            error_response = MockResponse(
                {"error": "Internal server error", "code": "INTERNAL_ERROR", "error_id": error_id},
                status_code=500,
            )

            await self._log_error(e, request, 500, error_id)
            return error_response

    def _handle_custom_exception(
        self, exception: CustomException, request: MockRequest
    ) -> MockResponse:
        """Handle custom exceptions with specific error codes"""
        status_code_map = {
            "VALIDATION_ERROR": 400,
            "AUTHENTICATION_ERROR": 401,
            "AUTHORIZATION_ERROR": 403,
            "NOT_FOUND_ERROR": 404,
            "RATE_LIMIT_ERROR": 429,
            "INTERNAL_ERROR": 500,
            "EXTERNAL_SERVICE_ERROR": 502,
        }

        status_code = status_code_map.get(exception.error_code, 500)

        return MockResponse(
            {
                "error": exception.message,
                "code": exception.error_code,
                "details": exception.details,
            },
            status_code=status_code,
        )

    async def _log_error(
        self, exception: Exception, request: MockRequest, status_code: int, error_id: str = None
    ):
        """Log error details"""
        error_key = f"{request.method}_{request.url}_{status_code}"
        self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1

        log_data = {
            "error_id": error_id,
            "exception_type": type(exception).__name__,
            "message": str(exception),
            "method": request.method,
            "url": request.url,
            "status_code": status_code,
            "timestamp": datetime.now(UTC).isoformat(),
        }

        self.logger.error(json.dumps(log_data))


class RequestLoggingMiddleware:
    """Request logging middleware for testing"""

    def __init__(self):
        self.request_logs = []
        self.metrics = {"total_requests": 0, "total_response_time": 0.0, "status_codes": {}}

    async def __call__(
        self, request: MockRequest, call_next: Callable[[MockRequest], Awaitable[MockResponse]]
    ) -> MockResponse:
        """Process request logging middleware"""
        start_time = time.time()

        # Log request start
        request_log = {
            "request_id": f"req_{int(start_time * 1000)}",
            "method": request.method,
            "url": request.url,
            "client_ip": request.client.host,
            "headers": dict(request.headers),
            "start_time": start_time,
        }

        try:
            response = await call_next(request)

            # Log successful response
            end_time = time.time()
            response_time = end_time - start_time

            request_log.update(
                {
                    "status_code": response.status_code,
                    "response_time": response_time,
                    "end_time": end_time,
                    "success": True,
                }
            )

            self._update_metrics(response.status_code, response_time)

        except Exception as e:
            # Log failed request
            end_time = time.time()
            response_time = end_time - start_time

            request_log.update(
                {
                    "status_code": 500,
                    "response_time": response_time,
                    "end_time": end_time,
                    "success": False,
                    "error": str(e),
                }
            )

            self._update_metrics(500, response_time)
            raise

        finally:
            self.request_logs.append(request_log)

        return response

    def _update_metrics(self, status_code: int, response_time: float):
        """Update request metrics"""
        self.metrics["total_requests"] += 1
        self.metrics["total_response_time"] += response_time

        status_category = f"{status_code // 100}xx"
        self.metrics["status_codes"][status_category] = (
            self.metrics["status_codes"].get(status_category, 0) + 1
        )

    def get_metrics(self) -> dict[str, Any]:
        """Get request metrics"""
        total_requests = self.metrics["total_requests"]

        return {
            "total_requests": total_requests,
            "average_response_time": (self.metrics["total_response_time"] / max(total_requests, 1)),
            "status_codes": self.metrics["status_codes"],
        }


class TestMiddlewareAndErrorHandling:
    """Middleware and error handling tests for Phase 2 coverage"""

    @pytest.fixture
    def auth_middleware(self):
        """Create authentication middleware"""
        return AuthenticationMiddleware()

    @pytest.fixture
    def rate_limit_middleware(self):
        """Create rate limiting middleware"""
        return RateLimitMiddleware(requests_per_minute=5)  # Low limit for testing

    @pytest.fixture
    def error_middleware(self):
        """Create error handling middleware"""
        return ErrorHandlingMiddleware()

    @pytest.fixture
    def logging_middleware(self):
        """Create request logging middleware"""
        return RequestLoggingMiddleware()

    async def mock_handler_success(self, request: MockRequest) -> MockResponse:
        """Mock successful request handler"""
        return MockResponse({"status": "success", "data": "test"})

    async def mock_handler_error(self, request: MockRequest) -> MockResponse:
        """Mock error-throwing request handler"""
        raise CustomException("Test error", "TEST_ERROR", {"test": True})

    async def mock_handler_validation_error(self, request: MockRequest) -> MockResponse:
        """Mock validation error handler"""
        raise ValueError("Invalid input data")

    async def mock_handler_permission_error(self, request: MockRequest) -> MockResponse:
        """Mock permission error handler"""
        raise PermissionError("Access denied to resource")

    async def mock_handler_unexpected_error(self, request: MockRequest) -> MockResponse:
        """Mock unexpected error handler"""
        raise RuntimeError("Unexpected system error")

    # Authentication Middleware Tests

    @pytest.mark.asyncio
    async def test_auth_middleware_valid_api_key(self, auth_middleware):
        """Test authentication middleware with valid API key"""
        request = MockRequest(headers={"X-API-Key": "valid_api_key_123"})

        response = await auth_middleware(request, self.mock_handler_success)

        assert response.status_code == 200
        assert request.state["authenticated"] is True
        assert request.state["auth_type"] == "api_key"

    @pytest.mark.asyncio
    async def test_auth_middleware_invalid_api_key(self, auth_middleware):
        """Test authentication middleware with invalid API key"""
        request = MockRequest(headers={"X-API-Key": "invalid_key"})

        response = await auth_middleware(request, self.mock_handler_success)

        assert response.status_code == 401
        assert response.content["code"] == "INVALID_API_KEY"

    @pytest.mark.asyncio
    async def test_auth_middleware_valid_jwt_token(self, auth_middleware):
        """Test authentication middleware with valid JWT token"""
        request = MockRequest(headers={"Authorization": "Bearer valid_jwt_token"})

        response = await auth_middleware(request, self.mock_handler_success)

        assert response.status_code == 200
        assert request.state["authenticated"] is True
        assert request.state["auth_type"] == "jwt"
        assert request.state["user_id"] == "user_123"
        assert request.state["tenant_id"] == "tenant_123"

    @pytest.mark.asyncio
    async def test_auth_middleware_expired_jwt_token(self, auth_middleware):
        """Test authentication middleware with expired JWT token"""
        request = MockRequest(headers={"Authorization": "Bearer expired_token"})

        response = await auth_middleware(request, self.mock_handler_success)

        assert response.status_code == 401
        assert response.content["code"] == "INVALID_TOKEN"

    @pytest.mark.asyncio
    async def test_auth_middleware_session_auth(self, auth_middleware):
        """Test authentication middleware with session authentication"""
        # Add session to store
        session_id = "session_123"
        auth_middleware.session_store[session_id] = {
            "user_id": "user_456",
            "expires": datetime.now(UTC) + timedelta(hours=1),
        }

        request = MockRequest(headers={"X-Session-ID": session_id})

        response = await auth_middleware(request, self.mock_handler_success)

        assert response.status_code == 200
        assert request.state["authenticated"] is True
        assert request.state["auth_type"] == "session"
        assert request.state["user_id"] == "user_456"

    @pytest.mark.asyncio
    async def test_auth_middleware_health_check_bypass(self, auth_middleware):
        """Test authentication middleware bypasses health check endpoints"""
        request = MockRequest(url="/health/status")

        response = await auth_middleware(request, self.mock_handler_success)

        assert response.status_code == 200
        assert "authenticated" not in request.state

    @pytest.mark.asyncio
    async def test_auth_middleware_no_authentication(self, auth_middleware):
        """Test authentication middleware with no authentication provided"""
        request = MockRequest()

        response = await auth_middleware(request, self.mock_handler_success)

        assert response.status_code == 401
        assert response.content["code"] == "AUTHENTICATION_REQUIRED"

    # Rate Limiting Middleware Tests

    @pytest.mark.asyncio
    async def test_rate_limit_middleware_normal_request(self, rate_limit_middleware):
        """Test rate limiting middleware with normal request volume"""
        request = MockRequest()

        response = await rate_limit_middleware(request, self.mock_handler_success)

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_rate_limit_middleware_exceeded_limit(self, rate_limit_middleware):
        """Test rate limiting middleware when limit is exceeded"""
        # Make requests up to the limit
        for _i in range(5):
            request = MockRequest()
            response = await rate_limit_middleware(request, self.mock_handler_success)
            assert response.status_code == 200

        # Next request should be rate limited
        request = MockRequest()
        response = await rate_limit_middleware(request, self.mock_handler_success)

        assert response.status_code == 429
        assert response.content["code"] == "RATE_LIMIT_EXCEEDED"
        assert "Retry-After" in response.headers

    @pytest.mark.asyncio
    async def test_rate_limit_middleware_different_ips(self, rate_limit_middleware):
        """Test rate limiting middleware with different client IPs"""
        # Make requests from different IPs
        for i in range(10):
            request = MockRequest(client_ip=f"192.168.1.{i}")
            response = await rate_limit_middleware(request, self.mock_handler_success)
            assert response.status_code == 200

        # All should succeed since they're from different IPs

    # Error Handling Middleware Tests

    @pytest.mark.asyncio
    async def test_error_middleware_custom_exception(self, error_middleware):
        """Test error handling middleware with custom exception"""
        request = MockRequest()

        response = await error_middleware(request, self.mock_handler_error)

        assert response.status_code == 500  # Default for TEST_ERROR
        assert response.content["code"] == "TEST_ERROR"
        assert response.content["error"] == "Test error"
        assert response.content["details"] == {"test": True}

    @pytest.mark.asyncio
    async def test_error_middleware_validation_error(self, error_middleware):
        """Test error handling middleware with validation error"""
        request = MockRequest()

        response = await error_middleware(request, self.mock_handler_validation_error)

        assert response.status_code == 400
        assert response.content["code"] == "VALIDATION_ERROR"
        assert "Invalid input data" in response.content["message"]

    @pytest.mark.asyncio
    async def test_error_middleware_permission_error(self, error_middleware):
        """Test error handling middleware with permission error"""
        request = MockRequest()

        response = await error_middleware(request, self.mock_handler_permission_error)

        assert response.status_code == 403
        assert response.content["code"] == "PERMISSION_DENIED"
        assert "Access denied" in response.content["message"]

    @pytest.mark.asyncio
    async def test_error_middleware_unexpected_error(self, error_middleware):
        """Test error handling middleware with unexpected error"""
        request = MockRequest()

        response = await error_middleware(request, self.mock_handler_unexpected_error)

        assert response.status_code == 500
        assert response.content["code"] == "INTERNAL_ERROR"
        assert "error_id" in response.content

        # Verify error was logged
        assert len(error_middleware.error_counts) > 0

    # Request Logging Middleware Tests

    @pytest.mark.asyncio
    async def test_logging_middleware_successful_request(self, logging_middleware):
        """Test request logging middleware with successful request"""
        request = MockRequest(method="POST", url="/api/test")

        response = await logging_middleware(request, self.mock_handler_success)

        assert response.status_code == 200
        assert len(logging_middleware.request_logs) == 1

        log_entry = logging_middleware.request_logs[0]
        assert log_entry["method"] == "POST"
        assert log_entry["url"] == "/api/test"
        assert log_entry["status_code"] == 200
        assert log_entry["success"] is True
        assert "response_time" in log_entry

    @pytest.mark.asyncio
    async def test_logging_middleware_failed_request(self, logging_middleware):
        """Test request logging middleware with failed request"""
        request = MockRequest()

        try:
            await logging_middleware(request, self.mock_handler_unexpected_error)
        except RuntimeError:
            pass  # Expected

        assert len(logging_middleware.request_logs) == 1

        log_entry = logging_middleware.request_logs[0]
        assert log_entry["status_code"] == 500
        assert log_entry["success"] is False
        assert "error" in log_entry

    @pytest.mark.asyncio
    async def test_logging_middleware_metrics(self, logging_middleware):
        """Test request logging middleware metrics collection"""
        # Make several requests
        for _i in range(3):
            request = MockRequest()
            await logging_middleware(request, self.mock_handler_success)

        # Make one failing request
        try:
            request = MockRequest()
            await logging_middleware(request, self.mock_handler_validation_error)
        except ValueError:
            pass

        metrics = logging_middleware.get_metrics()

        assert metrics["total_requests"] == 4
        assert metrics["average_response_time"] > 0
        assert "2xx" in metrics["status_codes"]
        assert "5xx" in metrics["status_codes"]

    # Integration Tests

    @pytest.mark.asyncio
    async def test_middleware_chain_integration(
        self, logging_middleware, auth_middleware, rate_limit_middleware, error_middleware
    ):
        """Test complete middleware chain integration"""

        async def middleware_chain(request: MockRequest) -> MockResponse:
            # Apply middleware chain: logging -> auth -> rate_limit -> error -> handler
            async def step4(req):
                return await error_middleware(req, self.mock_handler_success)

            async def step3(req):
                return await rate_limit_middleware(req, step4)

            async def step2(req):
                return await auth_middleware(req, step3)

            return await logging_middleware(request, step2)

        # Test with valid authentication
        request = MockRequest(headers={"X-API-Key": "valid_test_key"}, url="/api/test")

        response = await middleware_chain(request)

        assert response.status_code == 200
        assert len(logging_middleware.request_logs) == 1
        assert request.state["authenticated"] is True

    @pytest.mark.asyncio
    async def test_middleware_error_propagation(
        self, logging_middleware, auth_middleware, error_middleware
    ):
        """Test error propagation through middleware chain"""

        async def middleware_chain(request: MockRequest) -> MockResponse:
            async def step2(req):
                return await error_middleware(req, self.mock_handler_error)

            async def step1(req):
                return await auth_middleware(req, step2)

            return await logging_middleware(request, step1)

        request = MockRequest(headers={"X-API-Key": "valid_test_key"})

        response = await middleware_chain(request)

        # Error should be handled properly
        assert response.status_code == 500
        assert response.content["code"] == "TEST_ERROR"

        # Should still be logged
        assert len(logging_middleware.request_logs) == 1
