"""
Error Tracking Middleware for FastAPI.

Automatically tracks HTTP errors, exceptions, and request metrics using Prometheus.
"""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from dotmac.platform.monitoring.error_tracking import (
    track_exception,
    track_http_error,
)

logger = structlog.get_logger(__name__)


class ErrorTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware to track HTTP errors and exceptions in Prometheus."""

    def __init__(self, app: ASGIApp):
        """Initialize middleware."""
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Process request and track errors."""
        start_time = time.time()
        response: Response | None = None

        try:
            # Process request
            response = await call_next(request)

            # Track HTTP errors (4xx, 5xx)
            if response.status_code >= 400:
                # Extract tenant_id from request if available
                tenant_id_raw = getattr(request.state, "tenant_id", None)
                tenant_id = tenant_id_raw if isinstance(tenant_id_raw, str) else "unknown"

                # Track the error
                track_http_error(
                    method=request.method,
                    endpoint=request.url.path,
                    status_code=response.status_code,
                    tenant_id=tenant_id,
                )

                # Log the error
                logger.warning(
                    "http.error",
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    tenant_id=tenant_id,
                    duration_ms=(time.time() - start_time) * 1000,
                )

            return response

        except Exception as e:
            # Track unhandled exception
            tenant_id_raw = getattr(request.state, "tenant_id", None)
            tenant_id = tenant_id_raw if isinstance(tenant_id_raw, str) else "unknown"

            track_exception(
                exception=e,
                module="api",
                endpoint=request.url.path,
                tenant_id=tenant_id,
            )

            logger.error(
                "http.exception",
                method=request.method,
                path=request.url.path,
                exception_type=type(e).__name__,
                exception=str(e),
                tenant_id=tenant_id,
                duration_ms=(time.time() - start_time) * 1000,
                exc_info=True,
            )

            # Re-raise to let FastAPI handle it
            raise


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to track request metrics (latency, throughput)."""

    def __init__(self, app: ASGIApp):
        """Initialize middleware."""
        super().__init__(app)
        # Import here to avoid circular imports
        from prometheus_client import Counter, Histogram

        self.requests_total = Counter(
            "dotmac_http_requests_total",
            "Total HTTP requests",
            ["method", "endpoint", "status_code", "tenant_id"],
        )

        self.request_duration = Histogram(
            "dotmac_http_request_duration_seconds",
            "HTTP request duration in seconds",
            ["method", "endpoint", "tenant_id"],
            buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
        )

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Track request metrics."""
        start_time = time.time()

        try:
            response = await call_next(request)
            duration = time.time() - start_time

            # Extract tenant_id
            tenant_id_raw = getattr(request.state, "tenant_id", None)
            tenant_id = tenant_id_raw if isinstance(tenant_id_raw, str) else "unknown"

            # Track metrics
            self.requests_total.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=response.status_code,
                tenant_id=tenant_id,
            ).inc()

            self.request_duration.labels(
                method=request.method,
                endpoint=request.url.path,
                tenant_id=tenant_id,
            ).observe(duration)

            return response

        except Exception:
            duration = time.time() - start_time
            tenant_id_raw = getattr(request.state, "tenant_id", None)
            tenant_id = tenant_id_raw if isinstance(tenant_id_raw, str) else "unknown"

            # Track as 500 error
            self.requests_total.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=500,
                tenant_id=tenant_id,
            ).inc()

            self.request_duration.labels(
                method=request.method,
                endpoint=request.url.path,
                tenant_id=tenant_id,
            ).observe(duration)

            raise
