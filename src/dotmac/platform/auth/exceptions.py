"""
Authentication Exceptions

Comprehensive exception classes for the DotMac authentication system.
"""

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from jwt import ExpiredSignatureError as JWTExpiredSignatureError
else:
    try:
        from jwt import ExpiredSignatureError as JWTExpiredSignatureError
    except ImportError:  # pragma: no cover - fallback when PyJWT is unavailable

        class JWTExpiredSignatureError(Exception):
            """Fallback ExpiredSignatureError used when PyJWT is missing."""


if TYPE_CHECKING:

    class _ExpiredSignatureError(Exception): ...

    ExpiredSignatureErrorBase = _ExpiredSignatureError
else:  # pragma: no cover - runtime path uses actual implementation
    ExpiredSignatureErrorBase = JWTExpiredSignatureError
from pydantic_core import ValidationError as PydanticValidationError


class AuthError(Exception):
    """Base authentication error"""

    def __init__(
        self,
        message: str = "Authentication failed",
        error_code: str | None = None,
        details: Mapping[str, Any] | None = None,
    ) -> None:
        self.message = message
        self.error_code = error_code or "AUTH_ERROR"
        self.details: dict[str, Any] = dict(details) if details is not None else {}
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for API responses"""
        return {"error": self.error_code, "message": self.message, "details": self.details}


class TokenError(AuthError):
    """Base token-related error"""

    def __init__(
        self,
        message: str = "Token error",
        error_code: str = "TOKEN_ERROR",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message, error_code, details)


class TokenExpired(TokenError, ExpiredSignatureErrorBase):
    """Token has expired"""

    def __init__(self, message: str = "Token has expired", expired_at: str | None = None) -> None:
        details = {"expired_at": expired_at} if expired_at else {}
        super().__init__(message, "TOKEN_EXPIRED", details)


class TokenNotFound(TokenError):
    """Token not provided or found"""

    def __init__(self, message: str = "Authentication token required") -> None:
        super().__init__(message, "TOKEN_NOT_FOUND")


class InvalidToken(TokenError):
    """Token is invalid or malformed"""

    def __init__(
        self, message: str = "Invalid authentication token", reason: str | None = None
    ) -> None:
        details = {"reason": reason} if reason else {}
        super().__init__(message, "INVALID_TOKEN", details)


class InvalidSignature(TokenError):
    """Token signature verification failed"""

    def __init__(self, message: str = "Token signature verification failed") -> None:
        super().__init__(message, "INVALID_SIGNATURE")


class InvalidAlgorithm(TokenError):
    """Unsupported or invalid JWT algorithm"""

    def __init__(
        self, message: str = "Invalid JWT algorithm", algorithm: str | None = None
    ) -> None:
        details = {"algorithm": algorithm} if algorithm else {}
        super().__init__(message, "INVALID_ALGORITHM", details)


class InvalidAudience(TokenError):
    """Token audience claim does not match expected value"""

    def __init__(
        self,
        message: str = "Token audience mismatch",
        expected: str | None = None,
        actual: str | None = None,
    ) -> None:
        details = {}
        if expected:
            details["expected_audience"] = expected
        if actual:
            details["actual_audience"] = actual
        super().__init__(message, "INVALID_AUDIENCE", details)


class InvalidIssuer(TokenError):
    """Token issuer claim does not match expected value"""

    def __init__(
        self,
        message: str = "Token issuer mismatch",
        expected: str | None = None,
        actual: str | None = None,
    ) -> None:
        details = {}
        if expected:
            details["expected_issuer"] = expected
        if actual:
            details["actual_issuer"] = actual
        super().__init__(message, "INVALID_ISSUER", details)


class InsufficientScope(AuthError):
    """User lacks required scope/permissions"""

    def __init__(
        self,
        message: str = "Insufficient permissions",
        required_scopes: list[str] | None = None,
        user_scopes: list[str] | None = None,
    ) -> None:
        details = {}
        if required_scopes:
            details["required_scopes"] = required_scopes
        if user_scopes:
            details["user_scopes"] = user_scopes
        super().__init__(message, "INSUFFICIENT_SCOPE", details)


class InsufficientRole(AuthError):
    """User lacks required role"""

    def __init__(
        self,
        message: str = "Insufficient role permissions",
        required_roles: list[str] | None = None,
        user_roles: list[str] | None = None,
    ) -> None:
        details = {}
        if required_roles:
            details["required_roles"] = required_roles
        if user_roles:
            details["user_roles"] = user_roles
        super().__init__(message, "INSUFFICIENT_ROLE", details)


class TenantMismatch(AuthError):
    """Token tenant does not match expected tenant"""

    def __init__(
        self,
        message: str = "Tenant context mismatch",
        expected_tenant: str | None = None,
        token_tenant: str | None = None,
    ) -> None:
        details = {}
        if expected_tenant:
            details["expected_tenant"] = expected_tenant
        if token_tenant:
            details["token_tenant"] = token_tenant
        super().__init__(message, "TENANT_MISMATCH", details)


class ServiceTokenError(AuthError):
    """Service-to-service token error"""

    def __init__(
        self,
        message: str = "Service token error",
        error_code: str = "SERVICE_TOKEN_ERROR",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message, error_code, details)


class UnauthorizedService(ServiceTokenError):
    """Service is not authorized for the requested operation"""

    def __init__(
        self,
        message: str = "Service not authorized",
        service_name: str | None = None,
        target_service: str | None = None,
        operation: str | None = None,
    ) -> None:
        details = {}
        if service_name:
            details["service_name"] = service_name
        if target_service:
            details["target_service"] = target_service
        if operation:
            details["operation"] = operation
        super().__init__(message, "UNAUTHORIZED_SERVICE", details)


class InvalidServiceToken(ServiceTokenError):
    """Service token is invalid"""

    def __init__(self, message: str = "Invalid service token", reason: str | None = None) -> None:
        details = {"reason": reason} if reason else {}
        super().__init__(message, "INVALID_SERVICE_TOKEN", details)


class SecretsProviderError(AuthError):
    """Secrets provider error"""

    def __init__(
        self,
        message: str = "Secrets provider error",
        provider: str | None = None,
        operation: str | None = None,
    ) -> None:
        details = {}
        if provider:
            details["provider"] = provider
        if operation:
            details["operation"] = operation
        super().__init__(message, "SECRETS_PROVIDER_ERROR", details)


class ConfigurationError(AuthError):
    """Authentication configuration error"""

    def __init__(
        self, message: str = "Authentication configuration error", component: str | None = None
    ) -> None:
        details = {"component": component} if component else {}
        super().__init__(message, "CONFIGURATION_ERROR", details)


class AuthenticationError(AuthError):
    """General authentication error"""

    def __init__(
        self,
        message: str = "Authentication failed",
        error_code: str = "AUTHENTICATION_ERROR",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message, error_code, details)


class AuthorizationError(AuthError):
    """Authorization error"""

    def __init__(
        self,
        message: str = "Authorization failed",
        error_code: str = "AUTHORIZATION_ERROR",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message, error_code, details)


# For backwards compatibility, alias it
ValidationError = PydanticValidationError


class RateLimitError(AuthError):
    """Rate limit exceeded error"""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        error_code: str = "RATE_LIMIT_ERROR",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message, error_code, details)


class ConnectionError(AuthError):
    """Connection error"""

    def __init__(
        self,
        message: str = "Connection failed",
        error_code: str = "CONNECTION_ERROR",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message, error_code, details)


class TimeoutError(AuthError):
    """Timeout error"""

    def __init__(
        self,
        message: str = "Operation timed out",
        error_code: str = "TIMEOUT_ERROR",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message, error_code, details)


# Exception mapping for HTTP status codes
EXCEPTION_STATUS_MAP = {
    TokenNotFound: 401,
    TokenExpired: 401,
    InvalidToken: 401,
    InvalidSignature: 401,
    InvalidAlgorithm: 401,
    InvalidAudience: 401,
    InvalidIssuer: 401,
    InsufficientScope: 403,
    InsufficientRole: 403,
    TenantMismatch: 403,
    UnauthorizedService: 403,
    InvalidServiceToken: 401,
    SecretsProviderError: 500,
    ConfigurationError: 500,
    AuthenticationError: 401,
    AuthorizationError: 403,
    ValidationError: 400,
    RateLimitError: 429,
    ConnectionError: 503,
    TimeoutError: 504,
    AuthError: 401,  # Default for base class
}


def get_http_status(exception: AuthError) -> int:
    """Get appropriate HTTP status code for authentication exception"""
    return EXCEPTION_STATUS_MAP.get(type(exception), 401)
