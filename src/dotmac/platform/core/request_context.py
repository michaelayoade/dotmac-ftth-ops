"""
Request Context Middleware

Provides request-scoped context for correlation IDs, trace IDs, and user information.
This middleware ensures that all errors and logs within a request can be correlated.
"""

import logging
import time
import uuid
from collections.abc import Callable
from contextvars import ContextVar

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)

# Context variables for request-scoped data
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)
trace_id_var: ContextVar[str | None] = ContextVar("trace_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
tenant_id_var: ContextVar[str | None] = ContextVar("tenant_id", default=None)


def get_request_id() -> str | None:
    """Get the current request ID."""
    return request_id_var.get()


def get_correlation_id() -> str | None:
    """Get the current correlation ID."""
    return correlation_id_var.get()


def ensure_correlation_id() -> str:
    """Get a non-empty correlation ID, generating one if needed."""
    correlation_id = correlation_id_var.get()
    if correlation_id is None:
        correlation_id = f"corr_{uuid.uuid4().hex[:16]}"
        correlation_id_var.set(correlation_id)
    return correlation_id


def get_trace_id() -> str | None:
    """Get the current trace ID."""
    return trace_id_var.get()


def get_user_id() -> str | None:
    """Get the current user ID."""
    return user_id_var.get()


def get_tenant_id() -> str | None:
    """Get the current tenant ID."""
    return tenant_id_var.get()


def set_request_id(request_id: str) -> None:
    """Set the request ID for the current context."""
    request_id_var.set(request_id)


def set_correlation_id(correlation_id: str) -> None:
    """Set the correlation ID for the current context."""
    correlation_id_var.set(correlation_id)


def set_trace_id(trace_id: str) -> None:
    """Set the trace ID for the current context."""
    trace_id_var.set(trace_id)


def set_user_id(user_id: str) -> None:
    """Set the user ID for the current context."""
    user_id_var.set(user_id)


def set_tenant_id(tenant_id: str) -> None:
    """Set the tenant ID for the current context."""
    tenant_id_var.set(tenant_id)


def get_request_context() -> dict[str, str | None]:
    """
    Get all context variables for the current request.

    Returns:
        Dictionary with all context variables
    """
    return {
        "request_id": get_request_id(),
        "correlation_id": get_correlation_id(),
        "trace_id": get_trace_id(),
        "user_id": get_user_id(),
        "tenant_id": get_tenant_id(),
    }


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to manage request-scoped context.

    This middleware:
    1. Generates or extracts correlation/trace IDs from headers
    2. Stores them in context variables for the request lifecycle
    3. Adds them to response headers for traceability
    4. Logs request/response with context information
    """

    def __init__(self, app: ASGIApp, enable_logging: bool = True):
        """
        Initialize RequestContextMiddleware.

        Args:
            app: ASGI application
            enable_logging: Whether to log requests (default: True)
        """
        super().__init__(app)
        self.enable_logging = enable_logging

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and inject context.

        Args:
            request: FastAPI request
            call_next: Next middleware in chain

        Returns:
            Response with correlation headers
        """
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:16]}"
        set_request_id(request_id)

        # Generate or extract correlation ID (for distributed tracing)
        correlation_id = request.headers.get("X-Correlation-ID") or f"corr_{uuid.uuid4().hex[:16]}"
        set_correlation_id(correlation_id)

        # Extract trace ID if present (for OpenTelemetry integration)
        trace_id = request.headers.get("X-Trace-ID") or request.headers.get("traceparent")
        if trace_id:
            set_trace_id(trace_id)

        # Extract user context from request state (set by auth middleware)
        if hasattr(request.state, "user_id"):
            set_user_id(request.state.user_id)

        if hasattr(request.state, "tenant_id"):
            set_tenant_id(request.state.tenant_id)

        # Log request with context
        start_time = time.time()

        if self.enable_logging:
            logger.info(
                f"Request started: {request.method} {request.url.path}",
                extra={
                    "request_id": request_id,
                    "correlation_id": correlation_id,
                    "trace_id": trace_id,
                    "method": request.method,
                    "path": request.url.path,
                    "query_params": str(request.query_params),
                    "user_id": get_user_id(),
                    "tenant_id": get_tenant_id(),
                },
            )

        try:
            # Process request
            response = await call_next(request)

            # Calculate request duration
            duration = time.time() - start_time

            # Add context headers to response
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Correlation-ID"] = correlation_id
            if trace_id:
                response.headers["X-Trace-ID"] = trace_id

            # Log response with context
            if self.enable_logging:
                logger.info(
                    f"Request completed: {request.method} {request.url.path}",
                    extra={
                        "request_id": request_id,
                        "correlation_id": correlation_id,
                        "trace_id": trace_id,
                        "method": request.method,
                        "path": request.url.path,
                        "status_code": response.status_code,
                        "duration_ms": round(duration * 1000, 2),
                        "user_id": get_user_id(),
                        "tenant_id": get_tenant_id(),
                    },
                )

            return response

        except Exception as exc:
            # Log exception with full context
            duration = time.time() - start_time

            logger.exception(
                f"Request failed: {request.method} {request.url.path}",
                extra={
                    "request_id": request_id,
                    "correlation_id": correlation_id,
                    "trace_id": trace_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration * 1000, 2),
                    "user_id": get_user_id(),
                    "tenant_id": get_tenant_id(),
                    "exception_type": type(exc).__name__,
                },
            )

            # Re-raise to let exception handlers deal with it
            raise


class ContextLoggingFilter(logging.Filter):
    """
    Logging filter to inject request context into log records.

    This filter adds correlation_id, request_id, trace_id, user_id,
    and tenant_id to all log records if they are available.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """
        Add context variables to log record.

        Args:
            record: Log record to enhance

        Returns:
            True (always allow the record)
        """
        context = get_request_context()

        # Add context to log record
        for key, value in context.items():
            if value is not None:
                setattr(record, key, value)

        return True


def configure_context_logging() -> None:
    """
    Configure root logger to include request context in all logs.

    This should be called during application startup.
    """
    root_logger = logging.getLogger()
    root_logger.addFilter(ContextLoggingFilter())

    logger.info("Request context logging configured")
