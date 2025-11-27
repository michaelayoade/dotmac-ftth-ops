"""
Global Exception Handlers for FastAPI

This module provides comprehensive exception handling for the entire platform,
ensuring all errors are properly logged, tracked, and returned in a consistent format.
"""

import logging
import traceback
from typing import Any

from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError

from dotmac.platform.core.error_contract import (
    ErrorCategory,
    ErrorSeverity,
    StandardErrorResponse,
)
from dotmac.platform.core.exceptions import DotMacError, ValidationError
from dotmac.platform.core.request_context import ensure_correlation_id, get_correlation_id

logger = logging.getLogger(__name__)


async def dotmac_error_handler(request: Request, exc: DotMacError) -> JSONResponse:
    """
    Handle DotMacError exceptions.

    Args:
        request: FastAPI request
        exc: DotMacError exception

    Returns:
        JSONResponse with standard error format
    """
    # Set correlation ID if not already set
    if exc.request_id is None:
        exc.request_id = get_correlation_id()

    # Log the error with context
    logger.error(
        f"DotMacError: {exc.error_code}",
        extra={
            "error_code": exc.error_code,
            "status_code": exc.status_code,
            "correlation_id": exc.request_id,
            "path": request.url.path,
            "method": request.method,
            "details": exc.details,
        },
    )

    # Convert to standard response
    error_response = exc.to_standard_response()
    content = error_response.to_dict()
    # Preserve FastAPI-style detail for compatibility with tests/clients
    content.setdefault("detail", error_response.message)

    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers={"X-Correlation-ID": error_response.correlation_id},
    )


async def validation_error_handler(request: Request, exc: PydanticValidationError) -> JSONResponse:
    """
    Handle Pydantic validation errors.

    Args:
        request: FastAPI request
        exc: Pydantic ValidationError

    Returns:
        JSONResponse with standard error format
    """
    correlation_id = ensure_correlation_id()

    # Extract field errors from Pydantic validation error
    field_errors = {}
    for error in exc.errors():
        field_name = ".".join(str(loc) for loc in error["loc"])
        field_errors[field_name] = error["msg"]

    # Create ValidationError with field details
    validation_error = ValidationError(
        message="Request validation failed",
        field_errors=field_errors,
    )
    validation_error.request_id = correlation_id

    # Log validation error
    logger.warning(
        "Validation error",
        extra={
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method,
            "field_errors": field_errors,
        },
    )

    error_response = validation_error.to_standard_response()
    content = error_response.to_dict()
    content.setdefault("detail", error_response.message)
    if validation_error.details:
        content.setdefault("errors", validation_error.details)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=content,
        headers={"X-Correlation-ID": correlation_id},
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle all unhandled exceptions.

    This is the catch-all handler for any exceptions not caught by
    more specific handlers. It ensures no exception goes unlogged.

    Args:
        request: FastAPI request
        exc: Any unhandled exception

    Returns:
        JSONResponse with standard error format
    """
    correlation_id = ensure_correlation_id()

    # Log the full exception with stack trace
    logger.exception(
        f"Unhandled exception: {type(exc).__name__}",
        extra={
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method,
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
        },
    )

    # Track the error in metrics if available
    try:
        from dotmac.platform.monitoring.error_tracking import track_exception

        track_exception(
            exception=exc,
            module="api",
            endpoint=request.url.path,
        )
    except ImportError:
        pass  # Monitoring module not available

    # Create standard error response
    error_response = StandardErrorResponse(
        error_code="INTERNAL_SERVER_ERROR",
        message=f"An unexpected error occurred: {type(exc).__name__}",
        user_message="An unexpected error occurred. Our team has been notified.",
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        severity=ErrorSeverity.CRITICAL,
        category=ErrorCategory.SYSTEM,
        retryable=False,
        correlation_id=correlation_id,
        details={
            "exception_type": type(exc).__name__,
            # Only include stack trace in development
            **(
                {"stack_trace": traceback.format_exc()}
                if logger.isEnabledFor(logging.DEBUG)
                else {}
            ),
        },
    )
    content = error_response.to_dict()
    content.setdefault("detail", error_response.message)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content,
        headers={"X-Correlation-ID": correlation_id},
    )


async def http_exception_handler(request: Request, exc: Any) -> JSONResponse:
    """
    Handle HTTPException from FastAPI.

    Args:
        request: FastAPI request
        exc: HTTPException

    Returns:
        JSONResponse with standard error format
    """
    correlation_id = ensure_correlation_id()

    # Determine error category and severity based on status code
    from dotmac.platform.core.error_contract import (
        is_retryable_status,
        status_to_category,
        status_to_severity,
    )

    status_code = getattr(exc, "status_code", 500)
    detail = getattr(exc, "detail", "HTTP error occurred")

    error_response = StandardErrorResponse(
        error_code=f"HTTP_{status_code}",
        message=detail,
        user_message=StandardErrorResponse._generate_user_message(
            status_to_category(status_code), detail
        ),
        status=status_code,
        severity=status_to_severity(status_code),
        category=status_to_category(status_code),
        retryable=is_retryable_status(status_code),
        correlation_id=correlation_id,
    )

    # Log based on severity
    if status_code >= 500:
        logger.error(
            f"HTTP {status_code} error",
            extra={
                "correlation_id": correlation_id,
                "path": request.url.path,
                "method": request.method,
                "status_code": status_code,
                "detail": detail,
            },
        )
    else:
        logger.warning(
            f"HTTP {status_code} error",
            extra={
                "correlation_id": correlation_id,
                "path": request.url.path,
                "method": request.method,
                "status_code": status_code,
                "detail": detail,
            },
        )

    content = error_response.to_dict()
    # Add FastAPI-style detail for compatibility
    content.setdefault("detail", detail)

    return JSONResponse(
        status_code=status_code,
        content=content,
        headers={"X-Correlation-ID": correlation_id},
    )


def register_exception_handlers(app: Any) -> None:
    """
    Register all exception handlers with FastAPI app.

    Args:
        app: FastAPI application instance
    """
    from fastapi.exceptions import HTTPException, RequestValidationError

    # Register specific handlers
    app.add_exception_handler(DotMacError, dotmac_error_handler)
    app.add_exception_handler(PydanticValidationError, validation_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)

    # Register generic catch-all handler
    app.add_exception_handler(Exception, generic_exception_handler)

    logger.info("Exception handlers registered successfully")
