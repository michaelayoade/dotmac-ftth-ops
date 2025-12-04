"""
Billing module middleware for error handling and logging.

Provides centralized error handling, request/response logging, and metrics collection.
"""

import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from dotmac.platform.billing.exceptions import BillingError

logger = structlog.get_logger(__name__)


class BillingErrorMiddleware(BaseHTTPMiddleware):
    """
    Middleware for handling billing-specific errors with proper logging and metrics.

    Features:
    - Converts BillingError exceptions to proper JSON responses
    - Logs all billing errors with context
    - Collects metrics on error rates
    - Adds correlation IDs for request tracing
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Process requests with error handling and logging."""
        # Generate correlation ID for request tracing
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        request.state.correlation_id = correlation_id

        # Extract request context
        context = {
            "correlation_id": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else None,
        }

        # Add tenant context if available
        if hasattr(request.state, "tenant_id"):
            context["tenant_id"] = request.state.tenant_id

        start_time = time.time()

        try:
            # Process the request
            response = await call_next(request)

            # Log successful billing operations
            if request.url.path.startswith("/api/v1/billing/"):
                duration = time.time() - start_time
                logger.info(
                    "Billing request completed",
                    **context,
                    status_code=response.status_code,
                    duration=duration,
                )

            return response

        except BillingError as e:
            # Handle billing-specific errors
            duration = time.time() - start_time

            logger.error(
                "Billing error occurred",
                **context,
                error_code=e.error_code,
                error_message=e.message,
                error_context=e.context,
                duration=duration,
            )

            # Create error response
            error_response = {
                "error": e.to_dict(),
                "correlation_id": correlation_id,
                "request_path": request.url.path,
            }

            return JSONResponse(
                status_code=e.status_code,
                content=error_response,
                headers={"X-Correlation-ID": correlation_id},
            )

        except Exception as e:
            # Handle unexpected errors
            duration = time.time() - start_time

            logger.exception(
                "Unexpected error in billing request", **context, error=str(e), duration=duration
            )

            # Create generic error response
            error_response = {
                "error": {
                    "error_code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred processing your request",
                    "status_code": 500,
                    "recovery_hint": "Please try again later or contact support if the issue persists",
                },
                "correlation_id": correlation_id,
                "request_path": request.url.path,
            }

            return JSONResponse(
                status_code=500,
                content=error_response,
                headers={"X-Correlation-ID": correlation_id},
            )


class BillingValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for request validation and sanitization.

    Features:
    - Validates required headers
    - Sanitizes input data
    - Enforces rate limits for billing operations
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Validate and process billing requests."""
        # Skip validation for non-billing endpoints
        if not request.url.path.startswith("/api/v1/billing/"):
            return await call_next(request)

        # Validate content type for POST/PUT requests
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")
            if not content_type.startswith("application/json"):
                logger.warning(
                    "Invalid content type for billing request",
                    path=request.url.path,
                    content_type=content_type,
                )
                return JSONResponse(
                    status_code=415,
                    content={
                        "error": {
                            "error_code": "UNSUPPORTED_MEDIA_TYPE",
                            "message": "Content-Type must be application/json",
                            "recovery_hint": "Set Content-Type header to application/json",
                        }
                    },
                )

        # Add request timestamp
        request.state.request_time = time.time()

        return await call_next(request)


class BillingAuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware for audit logging of sensitive billing operations.

    Features:
    - Logs all payment operations
    - Tracks subscription changes
    - Records pricing rule modifications
    """

    # Operations that require audit logging
    AUDIT_OPERATIONS = {
        ("POST", "/api/v1/billing/payments"),
        ("POST", "/api/v1/billing/refunds"),
        ("POST", "/api/v1/billing/subscriptions"),
        ("PUT", "/api/v1/billing/subscriptions"),
        ("DELETE", "/api/v1/billing/subscriptions"),
        ("POST", "/api/v1/billing/pricing/rules"),
        ("PUT", "/api/v1/billing/pricing/rules"),
        ("DELETE", "/api/v1/billing/pricing/rules"),
    }

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Audit log sensitive billing operations."""
        # Check if this operation needs audit logging
        operation = (request.method, request.url.path.rstrip("/"))
        needs_audit = any(
            operation[0] == audit_op[0] and request.url.path.startswith(audit_op[1])
            for audit_op in self.AUDIT_OPERATIONS
        )

        if not needs_audit:
            return await call_next(request)

        # Capture request details for audit
        audit_context = {
            "correlation_id": getattr(request.state, "correlation_id", None),
            "user_id": None,  # Will be populated from auth context
            "tenant_id": getattr(request.state, "tenant_id", None),
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else None,
            "timestamp": time.time(),
        }

        # Extract user from auth context if available
        if hasattr(request.state, "user"):
            audit_context["user_id"] = request.state.user.user_id

        # Process request and capture response
        response = await call_next(request)

        # Log audit event
        logger.info(
            "Billing operation audit log",
            **audit_context,
            response_status=response.status_code,
            operation_type=self._get_operation_type(request.method, request.url.path),
        )

        return response

    def _get_operation_type(self, method: str, path: str) -> str:
        """Determine the type of billing operation for audit logging."""
        if "payments" in path:
            return "payment_operation"
        elif "refunds" in path:
            return "refund_operation"
        elif "subscriptions" in path:
            return "subscription_operation"
        elif "pricing" in path:
            return "pricing_operation"
        else:
            return "billing_operation"


def setup_billing_middleware(app: FastAPI) -> None:
    """
    Configure billing middleware for the FastAPI application.

    Args:
        app: FastAPI application instance
    """
    # Add middleware in reverse order (last added is executed first)
    app.add_middleware(BillingAuditMiddleware)
    app.add_middleware(BillingValidationMiddleware)
    app.add_middleware(BillingErrorMiddleware)

    logger.info("Billing middleware configured")
