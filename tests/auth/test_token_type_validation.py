"""
Test token type validation security feature.

These tests ensure that refresh tokens cannot be used as access tokens
to prevent token reuse attacks.
"""

import pytest
from fastapi import HTTPException

from dotmac.platform.auth.core import TokenType, jwt_service


@pytest.mark.unit
class TestTokenTypeValidation:
    """Test suite for token type validation."""

    def test_access_token_has_correct_type(self):
        """Access tokens should have type=access in claims."""
        token = jwt_service.create_access_token("user-123", {"email": "test@example.com"})
        claims = jwt_service.verify_token(token)

        assert claims["type"] == TokenType.ACCESS.value
        assert claims["sub"] == "user-123"

    def test_refresh_token_has_correct_type(self):
        """Refresh tokens should have type=refresh in claims."""
        token = jwt_service.create_refresh_token("user-123", {"email": "test@example.com"})
        claims = jwt_service.verify_token(token)

        assert claims["type"] == TokenType.REFRESH.value
        assert claims["sub"] == "user-123"

    def test_verify_token_with_expected_type_access(self):
        """Verify token should succeed when type matches (access)."""
        token = jwt_service.create_access_token("user-123")
        claims = jwt_service.verify_token(token, expected_type=TokenType.ACCESS)

        assert claims["type"] == TokenType.ACCESS.value

    def test_verify_token_with_expected_type_refresh(self):
        """Verify token should succeed when type matches (refresh)."""
        token = jwt_service.create_refresh_token("user-123")
        claims = jwt_service.verify_token(token, expected_type=TokenType.REFRESH)

        assert claims["type"] == TokenType.REFRESH.value

    def test_verify_token_rejects_wrong_type(self):
        """Verify token should fail when type doesn't match."""
        # Create refresh token
        refresh_token = jwt_service.create_refresh_token("user-123")

        # Try to verify as access token - should fail
        with pytest.raises(HTTPException) as exc_info:
            jwt_service.verify_token(refresh_token, expected_type=TokenType.ACCESS)

        assert exc_info.value.status_code == 401
        assert "Invalid token type" in str(exc_info.value.detail)

    def test_refresh_token_cannot_be_used_as_access_token(self):
        """SECURITY: Refresh tokens must not be accepted as access tokens."""
        refresh_token = jwt_service.create_refresh_token("user-123")

        # Should fail when expecting ACCESS type
        with pytest.raises(HTTPException) as exc_info:
            jwt_service.verify_token(refresh_token, expected_type=TokenType.ACCESS)

        assert exc_info.value.status_code == 401
        assert "Expected access" in str(exc_info.value.detail)

    def test_access_token_cannot_be_used_as_refresh_token(self):
        """SECURITY: Access tokens must not be accepted as refresh tokens."""
        access_token = jwt_service.create_access_token("user-123")

        # Should fail when expecting REFRESH type
        with pytest.raises(HTTPException) as exc_info:
            jwt_service.verify_token(access_token, expected_type=TokenType.REFRESH)

        assert exc_info.value.status_code == 401
        assert "Expected refresh" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_verify_token_async_with_type_validation(self):
        """Async token verification should also validate types."""
        access_token = jwt_service.create_access_token("user-123")
        refresh_token = jwt_service.create_refresh_token("user-123")

        # Access token should work with ACCESS type
        claims = await jwt_service.verify_token_async(access_token, TokenType.ACCESS)
        assert claims["type"] == TokenType.ACCESS.value

        # Refresh token should work with REFRESH type
        claims = await jwt_service.verify_token_async(refresh_token, TokenType.REFRESH)
        assert claims["type"] == TokenType.REFRESH.value

        # Cross-type should fail
        with pytest.raises(HTTPException) as exc_info:
            await jwt_service.verify_token_async(refresh_token, TokenType.ACCESS)
        assert exc_info.value.status_code == 401

    def test_verify_without_type_check_accepts_any(self):
        """When no expected_type is provided, any valid token should work."""
        access_token = jwt_service.create_access_token("user-123")
        refresh_token = jwt_service.create_refresh_token("user-123")

        # Both should verify successfully without type check
        access_claims = jwt_service.verify_token(access_token)
        refresh_claims = jwt_service.verify_token(refresh_token)

        assert access_claims["type"] == TokenType.ACCESS.value
        assert refresh_claims["type"] == TokenType.REFRESH.value

    def test_type_validation_with_additional_claims(self):
        """Type validation should work with tokens containing additional claims."""
        token = jwt_service.create_access_token(
            "user-123",
            {
                "email": "test@example.com",
                "roles": ["admin"],
                "tenant_id": "tenant-456",
            },
        )

        claims = jwt_service.verify_token(token, expected_type=TokenType.ACCESS)

        assert claims["type"] == TokenType.ACCESS.value
        assert claims["email"] == "test@example.com"
        assert claims["roles"] == ["admin"]
        assert claims["tenant_id"] == "tenant-456"
