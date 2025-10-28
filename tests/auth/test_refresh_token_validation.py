"""
Test refresh token type validation in the refresh endpoint.

This ensures access tokens cannot be used to refresh tokens.
"""

import pytest
from fastapi import HTTPException

from dotmac.platform.auth.core import TokenType, jwt_service


@pytest.mark.unit
class TestRefreshTokenValidation:
    """Test suite for refresh endpoint token type validation."""

    def test_refresh_endpoint_accepts_refresh_tokens(self):
        """Refresh endpoint should accept valid refresh tokens."""
        # Create a refresh token
        refresh_token = jwt_service.create_refresh_token("user-123", {"email": "test@example.com"})

        # Verify it as REFRESH type (simulating refresh endpoint)
        claims = jwt_service.verify_token(refresh_token, expected_type=TokenType.REFRESH)

        assert claims["type"] == TokenType.REFRESH.value
        assert claims["sub"] == "user-123"

    def test_refresh_endpoint_rejects_access_tokens(self):
        """SECURITY: Refresh endpoint should reject access tokens."""
        # Create an access token
        access_token = jwt_service.create_access_token("user-123", {"email": "test@example.com"})

        # Try to verify as REFRESH type - should fail
        with pytest.raises(HTTPException) as exc_info:
            jwt_service.verify_token(access_token, expected_type=TokenType.REFRESH)

        assert exc_info.value.status_code == 401
        assert "Invalid token type" in str(exc_info.value.detail)
        assert "Expected refresh" in str(exc_info.value.detail)

    def test_access_token_cannot_be_used_to_get_new_access_token(self):
        """
        SECURITY TEST: Verify that an access token cannot be used to refresh.

        This prevents an attacker from extending their session indefinitely
        using a stolen short-lived access token.
        """
        # Create an access token (short-lived: 15 minutes)
        access_token = jwt_service.create_access_token("user-123")

        # Attacker tries to use access token to get a new access token
        with pytest.raises(HTTPException) as exc_info:
            jwt_service.verify_token(access_token, expected_type=TokenType.REFRESH)

        # Should fail - access token cannot be used for refresh
        assert exc_info.value.status_code == 401
        assert "access" in str(exc_info.value.detail).lower()

    def test_refresh_token_has_longer_expiry(self):
        """
        Verify that refresh tokens have longer expiry than access tokens.

        This is important because the security risk of accepting wrong token types
        is higher for long-lived tokens.
        """
        access_token = jwt_service.create_access_token("user-123")
        refresh_token = jwt_service.create_refresh_token("user-123")

        access_claims = jwt_service.verify_token(access_token)
        refresh_claims = jwt_service.verify_token(refresh_token)

        # Refresh token should expire later than access token
        assert refresh_claims["exp"] > access_claims["exp"]

    @pytest.mark.asyncio
    async def test_async_refresh_validation(self):
        """Test async token verification with refresh type."""
        refresh_token = jwt_service.create_refresh_token("user-123")

        claims = await jwt_service.verify_token_async(
            refresh_token, expected_type=TokenType.REFRESH
        )

        assert claims["type"] == TokenType.REFRESH.value

    @pytest.mark.asyncio
    async def test_async_rejects_wrong_type(self):
        """Test async token verification rejects wrong token type."""
        access_token = jwt_service.create_access_token("user-123")

        with pytest.raises(HTTPException) as exc_info:
            await jwt_service.verify_token_async(access_token, expected_type=TokenType.REFRESH)

        assert exc_info.value.status_code == 401
