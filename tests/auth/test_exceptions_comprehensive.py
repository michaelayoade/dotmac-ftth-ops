"""Comprehensive tests for auth exceptions to boost coverage to 90%."""

import pytest

from dotmac.platform.auth.exceptions import (  # Base exceptions; Token exceptions; Other exceptions
    AuthenticationError,
    AuthError,
    AuthorizationError,
    ConfigurationError,
    ConnectionError,
    InsufficientRole,
    InsufficientScope,
    InvalidAlgorithm,
    InvalidAudience,
    InvalidIssuer,
    InvalidServiceToken,
    InvalidSignature,
    InvalidToken,
    RateLimitError,
    SecretsProviderError,
    ServiceTokenError,
    TenantMismatch,
    TimeoutError,
    TokenError,
    TokenExpired,
    TokenNotFound,
    UnauthorizedService,
)


@pytest.mark.integration
class TestAuthError:
    """Test base AuthError exception."""

    def test_auth_error_basic(self):
        """Test creating basic auth error."""
        error = AuthError("Test error")
        assert str(error) == "Test error"
        assert error.message == "Test error"
        assert error.error_code == "AUTH_ERROR"

    def test_auth_error_with_code(self):
        """Test auth error with custom code."""
        error = AuthError("Test", error_code="CUSTOM_CODE")
        assert error.error_code == "CUSTOM_CODE"

    def test_auth_error_with_details(self):
        """Test auth error with details."""
        error = AuthError("Test", details={"key": "value"})
        assert error.details["key"] == "value"

    def test_auth_error_to_dict(self):
        """Test converting error to dictionary."""
        error = AuthError("Test", error_code="CODE", details={"key": "value"})
        result = error.to_dict()
        assert result["error"] == "CODE"
        assert result["message"] == "Test"
        assert result["details"]["key"] == "value"

    def test_auth_error_default_message(self):
        """Test auth error with default message."""
        error = AuthError()
        assert error.message == "Authentication failed"

    def test_auth_error_inheritance(self):
        """Test AuthError inherits from Exception."""
        error = AuthError("Test")
        assert isinstance(error, Exception)


@pytest.mark.integration
class TestTokenError:
    """Test TokenError exception."""

    def test_token_error_basic(self):
        """Test creating token error."""
        error = TokenError("Token error")
        assert str(error) == "Token error"
        assert error.error_code == "TOKEN_ERROR"

    def test_token_error_inheritance(self):
        """Test inherits from AuthError."""
        error = TokenError("Test")
        assert isinstance(error, AuthError)

    def test_token_error_default_message(self):
        """Test token error with default message."""
        error = TokenError()
        assert error.message == "Token error"


@pytest.mark.integration
class TestTokenExpired:
    """Test TokenExpired exception."""

    def test_token_expired_basic(self):
        """Test creating token expired error."""
        error = TokenExpired("Token expired")
        assert "expired" in str(error).lower()
        assert error.error_code == "TOKEN_EXPIRED"

    def test_token_expired_with_timestamp(self):
        """Test token expired with timestamp."""
        error = TokenExpired("Token expired", expired_at="2024-01-01")
        assert error.details["expired_at"] == "2024-01-01"

    def test_token_expired_default_message(self):
        """Test token expired with default message."""
        error = TokenExpired()
        assert "expired" in str(error).lower()

    def test_token_expired_inheritance(self):
        """Test inherits from TokenError."""
        error = TokenExpired()
        assert isinstance(error, TokenError)
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestTokenNotFound:
    """Test TokenNotFound exception."""

    def test_token_not_found_basic(self):
        """Test creating token not found error."""
        error = TokenNotFound("Token missing")
        assert "Token missing" in str(error)
        assert error.error_code == "TOKEN_NOT_FOUND"

    def test_token_not_found_default_message(self):
        """Test token not found with default message."""
        error = TokenNotFound()
        assert "required" in str(error).lower()

    def test_token_not_found_inheritance(self):
        """Test inherits from TokenError."""
        error = TokenNotFound()
        assert isinstance(error, TokenError)


@pytest.mark.integration
class TestInvalidToken:
    """Test InvalidToken exception."""

    def test_invalid_token_basic(self):
        """Test creating invalid token error."""
        error = InvalidToken("Bad token")
        assert "Bad token" in str(error)
        assert error.error_code == "INVALID_TOKEN"

    def test_invalid_token_with_reason(self):
        """Test invalid token with reason."""
        error = InvalidToken("Bad token", reason="malformed")
        assert error.details["reason"] == "malformed"

    def test_invalid_token_default_message(self):
        """Test invalid token with default message."""
        error = InvalidToken()
        assert "Invalid" in str(error)

    def test_invalid_token_inheritance(self):
        """Test inherits from TokenError."""
        error = InvalidToken()
        assert isinstance(error, TokenError)


@pytest.mark.integration
class TestInvalidSignature:
    """Test InvalidSignature exception."""

    def test_invalid_signature_basic(self):
        """Test creating invalid signature error."""
        error = InvalidSignature("Signature failed")
        assert "Signature" in str(error)
        assert error.error_code == "INVALID_SIGNATURE"

    def test_invalid_signature_default_message(self):
        """Test invalid signature with default message."""
        error = InvalidSignature()
        assert "signature" in str(error).lower()

    def test_invalid_signature_inheritance(self):
        """Test inherits from TokenError."""
        error = InvalidSignature()
        assert isinstance(error, TokenError)


@pytest.mark.integration
class TestInvalidAlgorithm:
    """Test InvalidAlgorithm exception."""

    def test_invalid_algorithm_basic(self):
        """Test creating invalid algorithm error."""
        error = InvalidAlgorithm("Bad algo")
        assert "Bad algo" in str(error)
        assert error.error_code == "INVALID_ALGORITHM"

    def test_invalid_algorithm_with_name(self):
        """Test invalid algorithm with algorithm name."""
        error = InvalidAlgorithm("Bad algo", algorithm="HS512")
        assert error.details["algorithm"] == "HS512"

    def test_invalid_algorithm_default_message(self):
        """Test invalid algorithm with default message."""
        error = InvalidAlgorithm()
        assert "algorithm" in str(error).lower()

    def test_invalid_algorithm_inheritance(self):
        """Test inherits from TokenError."""
        error = InvalidAlgorithm()
        assert isinstance(error, TokenError)


@pytest.mark.integration
class TestInvalidAudience:
    """Test InvalidAudience exception."""

    def test_invalid_audience_basic(self):
        """Test creating invalid audience error."""
        error = InvalidAudience("Audience mismatch")
        assert "Audience" in str(error) or "mismatch" in str(error)
        assert error.error_code == "INVALID_AUDIENCE"

    def test_invalid_audience_with_values(self):
        """Test invalid audience with expected/actual."""
        error = InvalidAudience("Mismatch", expected="api", actual="web")
        assert error.details["expected_audience"] == "api"
        assert error.details["actual_audience"] == "web"

    def test_invalid_audience_default_message(self):
        """Test invalid audience with default message."""
        error = InvalidAudience()
        assert "audience" in str(error).lower()

    def test_invalid_audience_inheritance(self):
        """Test inherits from TokenError."""
        error = InvalidAudience()
        assert isinstance(error, TokenError)


@pytest.mark.integration
class TestInvalidIssuer:
    """Test InvalidIssuer exception."""

    def test_invalid_issuer_basic(self):
        """Test creating invalid issuer error."""
        error = InvalidIssuer("Issuer mismatch")
        assert "Issuer" in str(error) or "mismatch" in str(error)
        assert error.error_code == "INVALID_ISSUER"

    def test_invalid_issuer_with_values(self):
        """Test invalid issuer with expected/actual."""
        error = InvalidIssuer("Mismatch", expected="auth.example.com", actual="other.com")
        assert error.details["expected_issuer"] == "auth.example.com"
        assert error.details["actual_issuer"] == "other.com"

    def test_invalid_issuer_default_message(self):
        """Test invalid issuer with default message."""
        error = InvalidIssuer()
        assert "issuer" in str(error).lower()

    def test_invalid_issuer_inheritance(self):
        """Test inherits from TokenError."""
        error = InvalidIssuer()
        assert isinstance(error, TokenError)


@pytest.mark.integration
class TestInsufficientScope:
    """Test InsufficientScope exception."""

    def test_insufficient_scope_basic(self):
        """Test creating insufficient scope error."""
        error = InsufficientScope("Missing scope")
        assert "Missing scope" in str(error)
        assert error.error_code == "INSUFFICIENT_SCOPE"

    def test_insufficient_scope_inheritance(self):
        """Test inherits from AuthError."""
        error = InsufficientScope()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestInsufficientRole:
    """Test InsufficientRole exception."""

    def test_insufficient_role_basic(self):
        """Test creating insufficient role error."""
        error = InsufficientRole("Missing role")
        assert "Missing role" in str(error)
        assert error.error_code == "INSUFFICIENT_ROLE"

    def test_insufficient_role_inheritance(self):
        """Test inherits from AuthError."""
        error = InsufficientRole()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestTenantMismatch:
    """Test TenantMismatch exception."""

    def test_tenant_mismatch_basic(self):
        """Test creating tenant mismatch error."""
        error = TenantMismatch("Wrong tenant")
        assert "Wrong tenant" in str(error)
        assert error.error_code == "TENANT_MISMATCH"

    def test_tenant_mismatch_inheritance(self):
        """Test inherits from AuthError."""
        error = TenantMismatch()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestServiceTokenError:
    """Test ServiceTokenError exception."""

    def test_service_token_error_basic(self):
        """Test creating service token error."""
        error = ServiceTokenError("Service error")
        assert "Service error" in str(error)
        assert error.error_code == "SERVICE_TOKEN_ERROR"

    def test_service_token_error_inheritance(self):
        """Test inherits from AuthError."""
        error = ServiceTokenError()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestUnauthorizedService:
    """Test UnauthorizedService exception."""

    def test_unauthorized_service_basic(self):
        """Test creating unauthorized service error."""
        error = UnauthorizedService("Service not authorized")
        assert "Service not authorized" in str(error)
        assert error.error_code == "UNAUTHORIZED_SERVICE"

    def test_unauthorized_service_inheritance(self):
        """Test inherits from ServiceTokenError."""
        error = UnauthorizedService()
        assert isinstance(error, ServiceTokenError)
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestInvalidServiceToken:
    """Test InvalidServiceToken exception."""

    def test_invalid_service_token_basic(self):
        """Test creating invalid service token error."""
        error = InvalidServiceToken("Bad service token")
        assert "Bad service token" in str(error)
        assert error.error_code == "INVALID_SERVICE_TOKEN"

    def test_invalid_service_token_inheritance(self):
        """Test inherits from ServiceTokenError."""
        error = InvalidServiceToken()
        assert isinstance(error, ServiceTokenError)


class TestSecretsProviderError:
    """Test SecretsProviderError exception."""

    def test_secrets_provider_error_basic(self):
        """Test creating secrets provider error."""
        error = SecretsProviderError("Secrets error")
        assert "Secrets error" in str(error)
        assert error.error_code == "SECRETS_PROVIDER_ERROR"

    def test_secrets_provider_error_inheritance(self):
        """Test inherits from AuthError."""
        error = SecretsProviderError()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestConfigurationError:
    """Test ConfigurationError exception."""

    def test_configuration_error_basic(self):
        """Test creating configuration error."""
        error = ConfigurationError("Config error")
        assert "Config error" in str(error)
        assert error.error_code == "CONFIGURATION_ERROR"

    def test_configuration_error_inheritance(self):
        """Test inherits from AuthError."""
        error = ConfigurationError()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestAuthenticationError:
    """Test AuthenticationError exception."""

    def test_authentication_error_basic(self):
        """Test creating authentication error."""
        error = AuthenticationError("Auth failed")
        assert "Auth failed" in str(error)
        assert error.error_code == "AUTHENTICATION_ERROR"

    def test_authentication_error_inheritance(self):
        """Test inherits from AuthError."""
        error = AuthenticationError()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestAuthorizationError:
    """Test AuthorizationError exception."""

    def test_authorization_error_basic(self):
        """Test creating authorization error."""
        error = AuthorizationError("Not authorized")
        assert "Not authorized" in str(error)
        assert error.error_code == "AUTHORIZATION_ERROR"

    def test_authorization_error_inheritance(self):
        """Test inherits from AuthError."""
        error = AuthorizationError()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestRateLimitError:
    """Test RateLimitError exception."""

    def test_rate_limit_error_basic(self):
        """Test creating rate limit error."""
        error = RateLimitError("Too many requests")
        assert "Too many requests" in str(error)
        assert error.error_code == "RATE_LIMIT_ERROR"

    def test_rate_limit_error_inheritance(self):
        """Test inherits from AuthError."""
        error = RateLimitError()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestConnectionError:
    """Test ConnectionError exception."""

    def test_connection_error_basic(self):
        """Test creating connection error."""
        error = ConnectionError("Connection failed")
        assert "Connection failed" in str(error)
        assert error.error_code == "CONNECTION_ERROR"

    def test_connection_error_inheritance(self):
        """Test inherits from AuthError."""
        error = ConnectionError()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestTimeoutError:
    """Test TimeoutError exception."""

    def test_timeout_error_basic(self):
        """Test creating timeout error."""
        error = TimeoutError("Request timeout")
        assert "Request timeout" in str(error)
        assert error.error_code == "TIMEOUT_ERROR"

    def test_timeout_error_inheritance(self):
        """Test inherits from AuthError."""
        error = TimeoutError()
        assert isinstance(error, AuthError)


@pytest.mark.integration
class TestExceptionHierarchy:
    """Test exception inheritance hierarchy."""

    def test_all_exceptions_inherit_from_auth_error(self):
        """Test all exceptions inherit from AuthError."""
        exceptions = [
            TokenError("test"),
            TokenExpired(),
            TokenNotFound(),
            InvalidToken(),
            InvalidSignature(),
            InvalidAlgorithm(),
            InvalidAudience(),
            InvalidIssuer(),
            InsufficientScope(),
            InsufficientRole(),
            TenantMismatch(),
            ServiceTokenError(),
            UnauthorizedService(),
            InvalidServiceToken(),
            SecretsProviderError(),
            ConfigurationError(),
            AuthenticationError(),
            AuthorizationError(),
            RateLimitError(),
            ConnectionError(),
            TimeoutError(),
        ]

        for exc in exceptions:
            assert isinstance(exc, AuthError)
            assert isinstance(exc, Exception)

    def test_token_errors_inherit_from_token_error(self):
        """Test token-specific errors inherit from TokenError."""
        token_errors = [
            TokenExpired(),
            TokenNotFound(),
            InvalidToken(),
            InvalidSignature(),
            InvalidAlgorithm(),
            InvalidAudience(),
            InvalidIssuer(),
        ]

        for exc in token_errors:
            assert isinstance(exc, TokenError)

    def test_service_errors_inherit_from_service_token_error(self):
        """Test service errors inherit from ServiceTokenError."""
        service_errors = [
            UnauthorizedService(),
            InvalidServiceToken(),
        ]

        for exc in service_errors:
            assert isinstance(exc, ServiceTokenError)


@pytest.mark.integration
class TestExceptionUsage:
    """Test exception usage patterns."""

    def test_exceptions_can_be_caught_by_base_class(self):
        """Test specific exceptions can be caught by base AuthError."""
        with pytest.raises(AuthError):
            raise TokenExpired()

        with pytest.raises(AuthError):
            raise AuthorizationError()

    def test_exceptions_can_be_caught_specifically(self):
        """Test exceptions can be caught by specific type."""
        with pytest.raises(TokenExpired):
            raise TokenExpired()

        with pytest.raises(InsufficientScope):
            raise InsufficientScope()

    def test_exception_messages_preserved(self):
        """Test exception messages are preserved."""
        msg = "Custom error message"

        try:
            raise InvalidToken(msg)
        except InvalidToken as e:
            assert str(e) == msg

    def test_exception_to_dict_works(self):
        """Test to_dict method works for all exceptions."""
        exceptions = [
            AuthError("test", error_code="CODE", details={"key": "value"}),
            TokenError("test"),
            InvalidToken("test", reason="bad format"),
        ]

        for exc in exceptions:
            result = exc.to_dict()
            assert "error" in result
            assert "message" in result
            assert "details" in result
