"""
Domain-specific exceptions for DotMac Platform.

This module provides the base exception hierarchy for the entire platform.
All module-specific exceptions should inherit from DotMacError.

See docs/EXCEPTION_HANDLING_GUIDE.md for usage patterns and best practices.
"""

from typing import Any

from dotmac.platform.core.error_contract import (
    ErrorCategory,
    ErrorSeverity,
    StandardErrorResponse,
    is_retryable_status,
    status_to_category,
    status_to_severity,
)


class DotMacError(Exception):
    """Base exception for all DotMac Platform errors.

    All platform exceptions should inherit from this class to ensure
    consistent error handling and API responses.

    Attributes:
        message: Human-readable error message
        error_code: Machine-readable error code (default: class name)
        details: Additional contextual information about the error
        status_code: HTTP status code for API responses (default: 500)
        user_message: User-friendly error message (auto-generated if None)
        category: Error category for classification
        severity: Error severity level
        retryable: Whether the operation can be retried
        recovery_hint: Optional suggestion for error recovery
        trace_id: Optional distributed tracing ID
        request_id: Optional request identifier
    """

    def __init__(
        self,
        message: str,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
        status_code: int = 500,
        user_message: str | None = None,
        category: ErrorCategory | None = None,
        severity: ErrorSeverity | None = None,
        retryable: bool | None = None,
        recovery_hint: str | None = None,
        trace_id: str | None = None,
        request_id: str | None = None,
    ) -> None:
        """Initialize DotMacError.

        Args:
            message: Human-readable error message
            error_code: Machine-readable error code (defaults to class name)
            details: Additional error context
            status_code: HTTP status code for API responses
            user_message: User-friendly message (auto-generated if None)
            category: Error category (auto-detected from status if None)
            severity: Error severity (auto-detected from status if None)
            retryable: Whether retryable (auto-detected from status if None)
            recovery_hint: Optional recovery suggestion
            trace_id: Optional distributed tracing ID
            request_id: Optional request identifier
        """
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        self.status_code = status_code
        self.user_message = user_message
        self.category = category or status_to_category(status_code)
        self.severity = severity or status_to_severity(status_code)
        self.retryable = retryable if retryable is not None else is_retryable_status(status_code)
        self.recovery_hint = recovery_hint
        self.trace_id = trace_id
        self.request_id = request_id
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for API responses (legacy format).

        Returns:
            Dictionary with error, message, and details keys
        """
        return {
            "error": self.error_code,
            "message": self.message,
            "details": self.details,
        }

    def to_standard_response(self) -> StandardErrorResponse:
        """Convert exception to standard error response format.

        Returns:
            StandardErrorResponse instance conforming to the platform contract
        """
        return StandardErrorResponse.from_exception(
            error_code=self.error_code,
            message=self.message,
            status=self.status_code,
            severity=self.severity,
            category=self.category,
            retryable=self.retryable,
            user_message=self.user_message,
            details=self.details,
            recovery_hint=self.recovery_hint,
            trace_id=self.trace_id,
            request_id=self.request_id,
        )


class ValidationError(DotMacError):
    """Validation error for invalid data.

    Raised when input data fails validation rules.
    HTTP status code: 400
    """

    def __init__(
        self,
        message: str = "Validation failed",
        field_errors: dict[str, str] | None = None,
    ) -> None:
        """Initialize ValidationError.

        Args:
            message: Human-readable error message
            field_errors: Dictionary mapping field names to error messages
        """
        details = {"fields": field_errors} if field_errors else {}
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            details=details,
            status_code=400,
        )


class AuthorizationError(DotMacError):
    """Authorization error for insufficient permissions.

    Raised when user lacks required permissions.
    HTTP status code: 403
    """

    def __init__(
        self,
        message: str = "Authorization failed",
        required_permission: str | None = None,
    ) -> None:
        """Initialize AuthorizationError.

        Args:
            message: Human-readable error message
            required_permission: The permission that was required
        """
        details = {}
        if required_permission:
            details["required_permission"] = required_permission

        super().__init__(
            message=message,
            error_code="AUTHORIZATION_ERROR",
            details=details,
            status_code=403,
        )


class ConfigurationError(DotMacError):
    """Configuration error for invalid settings.

    Raised when application configuration is invalid or missing.
    HTTP status code: 500
    """

    def __init__(
        self,
        message: str = "Configuration error",
        config_key: str | None = None,
    ) -> None:
        """Initialize ConfigurationError.

        Args:
            message: Human-readable error message
            config_key: The configuration key that caused the error
        """
        details = {}
        if config_key:
            details["config_key"] = config_key

        super().__init__(
            message=message,
            error_code="CONFIGURATION_ERROR",
            details=details,
            status_code=500,
        )


class BusinessRuleError(DotMacError):
    """Business rule violation error.

    Raised when an operation violates business logic rules.
    HTTP status code: 422
    """

    def __init__(
        self,
        message: str = "Business rule violation",
        rule: str | None = None,
    ) -> None:
        """Initialize BusinessRuleError.

        Args:
            message: Human-readable error message
            rule: The business rule that was violated
        """
        details = {}
        if rule:
            details["rule"] = rule

        super().__init__(
            message=message,
            error_code="BUSINESS_RULE_ERROR",
            details=details,
            status_code=422,
        )


class RepositoryError(DotMacError):
    """Base repository error.

    Raised when database/repository operations fail.
    HTTP status code: 500
    """

    def __init__(
        self,
        message: str = "Repository operation failed",
        operation: str | None = None,
    ) -> None:
        """Initialize RepositoryError.

        Args:
            message: Human-readable error message
            operation: The repository operation that failed
        """
        details = {}
        if operation:
            details["operation"] = operation

        super().__init__(
            message=message,
            error_code="REPOSITORY_ERROR",
            details=details,
            status_code=500,
        )


class EntityNotFoundError(RepositoryError):
    """Entity not found in repository.

    Raised when a requested entity does not exist.
    HTTP status code: 404
    """

    def __init__(
        self,
        entity: str,
        entity_id: str | int | None = None,
    ) -> None:
        """Initialize EntityNotFoundError.

        Args:
            entity: Entity type or error message if ``entity_id`` is omitted.
            entity_id: ID of the entity that was not found.
        """
        if entity_id is None:
            message = entity
            super().__init__(message=message, operation="find")
            self.details.setdefault("entity_type", None)
        else:
            message = f"{entity} not found: {entity_id}"
            super().__init__(message=message, operation="find")
            self.details["entity_type"] = entity
            self.details["entity_id"] = str(entity_id)

        self.error_code = "ENTITY_NOT_FOUND"
        self.status_code = 404


class DuplicateEntityError(RepositoryError):
    """Duplicate entity in repository.

    Raised when attempting to create an entity that already exists.
    HTTP status code: 409
    """

    def __init__(
        self,
        entity: str,
        entity_id: str | int | None = None,
    ) -> None:
        """Initialize DuplicateEntityError.

        Args:
            entity: Entity type or error message if ``entity_id`` is omitted.
            entity_id: ID of the duplicate entity.
        """
        if entity_id is None:
            message = entity
            super().__init__(message=message, operation="create")
            self.details.setdefault("entity_type", None)
        else:
            message = f"{entity} already exists: {entity_id}"
            super().__init__(message=message, operation="create")
            self.details["entity_type"] = entity
            self.details["entity_id"] = str(entity_id)

        self.error_code = "DUPLICATE_ENTITY"
        self.status_code = 409


# Alias for backward compatibility
NotFoundError = EntityNotFoundError
