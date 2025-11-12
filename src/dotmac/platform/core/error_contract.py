"""
Standardized Error Response Contract v1.0

This module defines the standard error response format used across the entire platform.
Both frontend and backend must adhere to this contract for consistent error handling.

Version: 1.0
"""

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class ErrorSeverity(str, Enum):
    """Error severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(str, Enum):
    """Error categories for classification."""

    NETWORK = "network"
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    BUSINESS = "business"
    SYSTEM = "system"
    DATABASE = "database"
    EXTERNAL_SERVICE = "external_service"
    UNKNOWN = "unknown"


@dataclass
class StandardErrorResponse:
    """
    Standard error response format for all API errors.

    This format is used by both frontend and backend to ensure
    consistent error handling across the platform.

    Attributes:
        error_code: Machine-readable error code (e.g., "VALIDATION_ERROR")
        message: Technical error message for developers
        user_message: User-friendly error message for display
        correlation_id: Unique identifier for this error instance
        timestamp: ISO 8601 timestamp when error occurred
        status: HTTP status code
        severity: Error severity level
        category: Error category for classification
        retryable: Whether the operation can be retried
        details: Additional error context (field errors, etc.)
        recovery_hint: Optional suggestion for error recovery
        trace_id: Optional distributed tracing ID
        request_id: Optional request identifier
    """

    error_code: str
    message: str
    user_message: str
    correlation_id: str = field(default_factory=lambda: f"err_{uuid.uuid4().hex[:16]}")
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    status: int = 500
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
    category: ErrorCategory = ErrorCategory.UNKNOWN
    retryable: bool = False
    details: dict[str, Any] = field(default_factory=dict)
    recovery_hint: str | None = None
    trace_id: str | None = None
    request_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        # Convert enums to strings
        data["severity"] = self.severity.value
        data["category"] = self.category.value
        # Remove None values
        return {k: v for k, v in data.items() if v is not None}

    @classmethod
    def from_exception(
        cls,
        error_code: str,
        message: str,
        status: int = 500,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        retryable: bool = False,
        user_message: str | None = None,
        details: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
        trace_id: str | None = None,
        request_id: str | None = None,
    ) -> "StandardErrorResponse":
        """
        Create StandardErrorResponse from exception details.

        Args:
            error_code: Machine-readable error code
            message: Technical error message
            status: HTTP status code
            severity: Error severity level
            category: Error category
            retryable: Whether operation can be retried
            user_message: User-friendly message (auto-generated if None)
            details: Additional error context
            recovery_hint: Optional recovery suggestion
            trace_id: Optional distributed tracing ID
            request_id: Optional request identifier

        Returns:
            StandardErrorResponse instance
        """
        return cls(
            error_code=error_code,
            message=message,
            user_message=user_message or cls._generate_user_message(category, message),
            status=status,
            severity=severity,
            category=category,
            retryable=retryable,
            details=details or {},
            recovery_hint=recovery_hint,
            trace_id=trace_id,
            request_id=request_id,
        )

    @staticmethod
    def _generate_user_message(category: ErrorCategory, technical_message: str) -> str:
        """
        Generate user-friendly message based on error category.

        Args:
            category: Error category
            technical_message: Technical error message (fallback)

        Returns:
            User-friendly error message
        """
        messages = {
            ErrorCategory.NETWORK: "Connection problem. Please check your internet and try again.",
            ErrorCategory.AUTHENTICATION: "Please log in again to continue.",
            ErrorCategory.AUTHORIZATION: "You don't have permission to perform this action.",
            ErrorCategory.VALIDATION: "Please check your input and try again.",
            ErrorCategory.BUSINESS: "Unable to complete this action. Please try again later.",
            ErrorCategory.SYSTEM: "System temporarily unavailable. Please try again in a few minutes.",
            ErrorCategory.DATABASE: "Database operation failed. Please try again.",
            ErrorCategory.EXTERNAL_SERVICE: "External service unavailable. Please try again later.",
            ErrorCategory.UNKNOWN: "Something went wrong. Please try again.",
        }
        return messages.get(category, technical_message)


# HTTP Status Code to Error Category mapping
STATUS_TO_CATEGORY: dict[int, ErrorCategory] = {
    400: ErrorCategory.VALIDATION,
    401: ErrorCategory.AUTHENTICATION,
    403: ErrorCategory.AUTHORIZATION,
    404: ErrorCategory.BUSINESS,
    409: ErrorCategory.BUSINESS,
    422: ErrorCategory.VALIDATION,
    429: ErrorCategory.SYSTEM,
    500: ErrorCategory.SYSTEM,
    502: ErrorCategory.EXTERNAL_SERVICE,
    503: ErrorCategory.SYSTEM,
    504: ErrorCategory.NETWORK,
}

# HTTP Status Code to Error Severity mapping
STATUS_TO_SEVERITY: dict[int, ErrorSeverity] = {
    400: ErrorSeverity.LOW,
    401: ErrorSeverity.HIGH,
    403: ErrorSeverity.HIGH,
    404: ErrorSeverity.LOW,
    409: ErrorSeverity.MEDIUM,
    422: ErrorSeverity.LOW,
    429: ErrorSeverity.MEDIUM,
    500: ErrorSeverity.CRITICAL,
    502: ErrorSeverity.HIGH,
    503: ErrorSeverity.CRITICAL,
    504: ErrorSeverity.HIGH,
}

# HTTP Status Code to Retryable mapping
STATUS_TO_RETRYABLE: dict[int, bool] = {
    400: False,
    401: False,
    403: False,
    404: False,
    409: False,
    422: False,
    429: True,  # Rate limit - retry with backoff
    500: True,  # Server error - may be transient
    502: True,  # Bad gateway - retry
    503: True,  # Service unavailable - retry
    504: True,  # Gateway timeout - retry
}


def status_to_category(status: int) -> ErrorCategory:
    """Map HTTP status code to error category."""
    return STATUS_TO_CATEGORY.get(status, ErrorCategory.SYSTEM)


def status_to_severity(status: int) -> ErrorSeverity:
    """Map HTTP status code to error severity."""
    return STATUS_TO_SEVERITY.get(status, ErrorSeverity.MEDIUM)


def is_retryable_status(status: int) -> bool:
    """Determine if HTTP status code indicates retryable error."""
    return STATUS_TO_RETRYABLE.get(status, False)
