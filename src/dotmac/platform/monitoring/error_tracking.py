"""
Error Tracking with Prometheus Metrics.

Provides comprehensive error tracking, exception monitoring, and alerting
using Prometheus metrics instead of external services like Sentry.
"""

from __future__ import annotations

import functools
import logging
import traceback
from collections.abc import Callable
from typing import Any

from prometheus_client import Counter, Gauge, Histogram
from starlette.requests import Request

logger = logging.getLogger(__name__)

# ==========================================
# Error Tracking Metrics
# ==========================================

# HTTP Error Counters
http_errors_total = Counter(
    "dotmac_http_errors_total",
    "Total number of HTTP errors",
    ["method", "endpoint", "status_code", "tenant_id"],
)

http_4xx_errors = Counter(
    "dotmac_http_4xx_errors_total",
    "Total number of 4xx client errors",
    ["method", "endpoint", "status_code", "tenant_id"],
)

http_5xx_errors = Counter(
    "dotmac_http_5xx_errors_total",
    "Total number of 5xx server errors",
    ["method", "endpoint", "status_code", "tenant_id"],
)

# Exception Tracking
exceptions_total = Counter(
    "dotmac_exceptions_total",
    "Total number of exceptions raised",
    ["exception_type", "module", "tenant_id"],
)

exception_by_endpoint = Counter(
    "dotmac_exceptions_by_endpoint_total",
    "Exceptions grouped by endpoint",
    ["endpoint", "exception_type", "tenant_id"],
)

# Database Error Tracking
database_errors_total = Counter(
    "dotmac_database_errors_total",
    "Total number of database errors",
    ["error_type", "operation", "tenant_id"],
)

database_connection_failures = Counter(
    "dotmac_database_connection_failures_total",
    "Total number of database connection failures",
    ["tenant_id"],
)

database_query_timeouts = Counter(
    "dotmac_database_query_timeouts_total",
    "Total number of database query timeouts",
    ["table", "operation", "tenant_id"],
)

# Authentication Errors
auth_failures_total = Counter(
    "dotmac_auth_failures_total",
    "Total number of authentication failures",
    ["failure_reason", "tenant_id"],
)

invalid_token_attempts = Counter(
    "dotmac_invalid_token_attempts_total",
    "Total number of invalid token attempts",
    ["token_type", "tenant_id"],
)

rate_limit_exceeded = Counter(
    "dotmac_rate_limit_exceeded_total",
    "Total number of rate limit violations",
    ["endpoint", "tenant_id"],
)

# Integration Errors
external_api_errors = Counter(
    "dotmac_external_api_errors_total",
    "Total number of external API errors",
    ["service", "error_type", "tenant_id"],
)

redis_errors_total = Counter(
    "dotmac_redis_errors_total",
    "Total number of Redis errors",
    ["operation", "tenant_id"],
)

minio_errors_total = Counter(
    "dotmac_minio_errors_total",
    "Total number of MinIO/S3 errors",
    ["operation", "tenant_id"],
)

# Critical Error Gauges (for alerting)
critical_errors_last_hour = Gauge(
    "dotmac_critical_errors_last_hour",
    "Number of critical errors in the last hour",
    ["tenant_id"],
)

error_rate_per_minute = Gauge(
    "dotmac_error_rate_per_minute",
    "Current error rate per minute",
    ["tenant_id"],
)

# Error Response Times
error_response_time = Histogram(
    "dotmac_error_response_time_seconds",
    "Time taken to process and return errors",
    ["status_code", "tenant_id"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0),
)


# ==========================================
# Error Tracking Functions
# ==========================================


def track_http_error(
    method: str,
    endpoint: str,
    status_code: int,
    tenant_id: str = "unknown",
    response_time: float | None = None,
) -> None:
    """
    Track HTTP errors in Prometheus metrics.

    Args:
        method: HTTP method (GET, POST, etc.)
        endpoint: API endpoint path
        status_code: HTTP status code
        tenant_id: Tenant identifier
        response_time: Time taken to generate error response (seconds)
    """
    # Increment total errors
    http_errors_total.labels(
        method=method,
        endpoint=endpoint,
        status_code=str(status_code),
        tenant_id=tenant_id,
    ).inc()

    # Increment specific error category
    if 400 <= status_code < 500:
        http_4xx_errors.labels(
            method=method,
            endpoint=endpoint,
            status_code=str(status_code),
            tenant_id=tenant_id,
        ).inc()
    elif status_code >= 500:
        http_5xx_errors.labels(
            method=method,
            endpoint=endpoint,
            status_code=str(status_code),
            tenant_id=tenant_id,
        ).inc()

    # Track response time if provided
    if response_time is not None:
        error_response_time.labels(
            status_code=str(status_code),
            tenant_id=tenant_id,
        ).observe(response_time)


def track_exception(
    exception: Exception,
    module: str = "unknown",
    endpoint: str | None = None,
    tenant_id: str = "unknown",
) -> None:
    """
    Track exceptions in Prometheus metrics.

    Args:
        exception: The exception that was raised
        module: Module where exception occurred
        endpoint: API endpoint (if applicable)
        tenant_id: Tenant identifier
    """
    exception_type = type(exception).__name__

    # Increment exception counter by type
    exceptions_total.labels(
        exception_type=exception_type,
        module=module,
        tenant_id=tenant_id,
    ).inc()

    # Track by endpoint if available
    if endpoint:
        exception_by_endpoint.labels(
            endpoint=endpoint,
            exception_type=exception_type,
            tenant_id=tenant_id,
        ).inc()

    # Log exception with traceback
    logger.error(
        "Exception tracked",
        extra={
            "exception_type": exception_type,
            "module_name": module,
            "endpoint": endpoint,
            "tenant_id": tenant_id,
            "traceback": traceback.format_exc(),
        },
    )


def track_database_error(
    error: Exception,
    operation: str,
    table: str | None = None,
    tenant_id: str = "unknown",
) -> None:
    """
    Track database errors in Prometheus metrics.

    Args:
        error: The database error
        operation: Database operation (SELECT, INSERT, UPDATE, DELETE)
        table: Table name (if applicable)
        tenant_id: Tenant identifier
    """
    error_type = type(error).__name__

    database_errors_total.labels(
        error_type=error_type,
        operation=operation,
        tenant_id=tenant_id,
    ).inc()

    # Track connection failures specifically
    if "connection" in error_type.lower():
        database_connection_failures.labels(tenant_id=tenant_id).inc()

    # Track query timeouts
    if "timeout" in error_type.lower() and table:
        database_query_timeouts.labels(
            table=table,
            operation=operation,
            tenant_id=tenant_id,
        ).inc()

    logger.error(
        "Database error tracked",
        extra={
            "error_type": error_type,
            "operation": operation,
            "table": table,
            "tenant_id": tenant_id,
            "error_message": str(error),
        },
    )


def track_auth_failure(
    reason: str,
    tenant_id: str = "unknown",
    token_type: str | None = None,
) -> None:
    """
    Track authentication failures.

    Args:
        reason: Failure reason (invalid_credentials, expired_token, etc.)
        tenant_id: Tenant identifier
        token_type: Type of token (access, refresh) if applicable
    """
    auth_failures_total.labels(
        failure_reason=reason,
        tenant_id=tenant_id,
    ).inc()

    if token_type:
        invalid_token_attempts.labels(
            token_type=token_type,
            tenant_id=tenant_id,
        ).inc()


def track_rate_limit_violation(
    endpoint: str,
    tenant_id: str = "unknown",
) -> None:
    """
    Track rate limit violations.

    Args:
        endpoint: API endpoint that was rate limited
        tenant_id: Tenant identifier
    """
    rate_limit_exceeded.labels(
        endpoint=endpoint,
        tenant_id=tenant_id,
    ).inc()


def track_external_api_error(
    service: str,
    error: Exception,
    tenant_id: str = "unknown",
) -> None:
    """
    Track external API errors.

    Args:
        service: External service name (stripe, twilio, etc.)
        error: The error that occurred
        tenant_id: Tenant identifier
    """
    error_type = type(error).__name__

    external_api_errors.labels(
        service=service,
        error_type=error_type,
        tenant_id=tenant_id,
    ).inc()


def track_redis_error(
    operation: str,
    error: Exception,
    tenant_id: str = "unknown",
) -> None:
    """
    Track Redis errors.

    Args:
        operation: Redis operation (GET, SET, DEL, etc.)
        error: The error that occurred
        tenant_id: Tenant identifier
    """
    redis_errors_total.labels(
        operation=operation,
        tenant_id=tenant_id,
    ).inc()


def track_minio_error(
    operation: str,
    error: Exception,
    tenant_id: str = "unknown",
) -> None:
    """
    Track MinIO/S3 errors.

    Args:
        operation: MinIO operation (upload, download, delete, etc.)
        error: The error that occurred
        tenant_id: Tenant identifier
    """
    minio_errors_total.labels(
        operation=operation,
        tenant_id=tenant_id,
    ).inc()


# ==========================================
# Decorator for Automatic Error Tracking
# ==========================================


def track_errors(
    module: str | None = None,
    endpoint: str | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Decorator to automatically track exceptions in functions.

    Usage:
        @track_errors(module="customer_management", endpoint="/api/v1/customers")
        async def get_customer(customer_id: str):
            ...

    Args:
        module: Module name for tracking
        endpoint: API endpoint for tracking
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            tenant_id = "unknown"

            # Try to extract tenant_id from request if available
            for arg in args:
                if isinstance(arg, Request):
                    tenant_id = arg.headers.get("X-Tenant-ID", "unknown")
                    break

            try:
                return await func(*args, **kwargs)
            except Exception as e:
                # Track the exception
                track_exception(
                    exception=e,
                    module=module or func.__module__,
                    endpoint=endpoint,
                    tenant_id=tenant_id,
                )
                # Re-raise the exception
                raise

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            tenant_id = "unknown"

            # Try to extract tenant_id from request if available
            for arg in args:
                if isinstance(arg, Request):
                    tenant_id = arg.headers.get("X-Tenant-ID", "unknown")
                    break

            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Track the exception
                track_exception(
                    exception=e,
                    module=module or func.__module__,
                    endpoint=endpoint,
                    tenant_id=tenant_id,
                )
                # Re-raise the exception
                raise

        # Return appropriate wrapper based on function type
        import inspect

        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


# ==========================================
# Exports
# ==========================================

__all__ = [
    "track_http_error",
    "track_exception",
    "track_database_error",
    "track_auth_failure",
    "track_rate_limit_violation",
    "track_external_api_error",
    "track_redis_error",
    "track_minio_error",
    "track_errors",
]
