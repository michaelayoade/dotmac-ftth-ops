"""
Integration tests for authentication services.

Tests the core authentication functionality including JWT, RBAC, and session management.
"""

import pytest

from dotmac.platform.auth import (
    JWTService,
    create_access_token,
    hash_password,
    verify_password,
)

pytestmark = pytest.mark.unit


def test_jwt_service_creation() -> None:
    """Test JWT service can be created and issue tokens."""
    service = JWTService(algorithm="HS256", secret="test-secret-key")

    token = service.create_access_token("test-user", additional_claims={"scopes": ["read"]})
    assert token is not None
    assert isinstance(token, str)

    # Verify token
    claims = service.verify_token(token)
    assert claims["sub"] == "test-user"
    assert "read" in claims["scopes"]


def test_password_hashing() -> None:
    """Test password hashing functionality."""
    password = "test-password-123"

    # Hash password
    password_hash = hash_password(password)
    assert password_hash is not None
    assert isinstance(password_hash, str)
    assert password_hash != password

    # Verify password
    assert verify_password(password, password_hash) is True
    assert verify_password("wrong-password", password_hash) is False


def test_create_access_token_utility() -> None:
    """Test the utility function for creating access tokens."""
    # Test the convenience function
    token = create_access_token("user123", roles=["user"], permissions=["read"])
    assert token is not None
    assert isinstance(token, str)

    # The token should be decodeable by the JWT service
    service = JWTService()
    claims = service.verify_token(token)
    assert claims["sub"] == "user123"
    assert "roles" in claims
    assert "permissions" in claims


if __name__ == "__main__":
    pytest.main([__file__])
