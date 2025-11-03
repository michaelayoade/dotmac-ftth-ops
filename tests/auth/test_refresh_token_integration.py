"""
Integration tests for the token refresh endpoint with real JWT tokens.
"""

import pytest

from dotmac.platform.auth.core import TokenType, jwt_service


@pytest.mark.unit
class TestRefreshTokenIntegration:
    """Integration tests using real JWT service."""

    def test_refresh_token_type_validation(self):
        """Test that refresh endpoint validates token type correctly."""

        # Create an access token
        access_token = jwt_service.create_access_token(
            subject="user-123", additional_claims={"username": "testuser"}
        )

        # Create a refresh token
        refresh_token = jwt_service.create_refresh_token(subject="user-123")

        # Verify access token has correct type
        access_payload = jwt_service.verify_token(access_token)
        assert access_payload.get("type") == TokenType.ACCESS.value
        assert access_payload.get("sub") == "user-123"

        # Verify refresh token has correct type
        refresh_payload = jwt_service.verify_token(refresh_token)
        assert refresh_payload.get("type") == TokenType.REFRESH.value
        assert refresh_payload.get("sub") == "user-123"

        # The tokens should be different
        assert access_token != refresh_token

    def test_token_expiration_times(self):
        """Test that refresh tokens have longer expiration than access tokens."""

        # Create both types of tokens
        access_token = jwt_service.create_access_token("user-123")
        refresh_token = jwt_service.create_refresh_token("user-123")

        # Decode and check expiration times
        access_payload = jwt_service.verify_token(access_token)
        refresh_payload = jwt_service.verify_token(refresh_token)

        access_exp = access_payload.get("exp")
        refresh_exp = refresh_payload.get("exp")

        # Refresh token should expire later than access token
        assert refresh_exp > access_exp

    def test_token_claims_consistency(self):
        """Test that tokens maintain consistent claims structure."""

        user_id = "test-user-456"
        additional_claims = {
            "username": "johndoe",
            "email": "john@example.com",
            "roles": ["admin", "user"],
            "tenant_id": "tenant-789",
        }

        # Create access token with additional claims
        access_token = jwt_service.create_access_token(
            subject=user_id, additional_claims=additional_claims
        )

        # Verify all claims are present
        payload = jwt_service.verify_token(access_token)
        assert payload.get("sub") == user_id
        assert payload.get("username") == "johndoe"
        assert payload.get("email") == "john@example.com"
        assert payload.get("roles") == ["admin", "user"]
        assert payload.get("tenant_id") == "tenant-789"
        assert payload.get("type") == TokenType.ACCESS.value

    def test_refresh_token_minimal_claims(self):
        """Test that refresh tokens have minimal claims for security."""

        user_id = "user-minimal"

        # Create refresh token - should only have essential claims
        refresh_token = jwt_service.create_refresh_token(
            subject=user_id,
            additional_claims={"extra": "data"},  # This might be included
        )

        # Verify refresh token has minimal but essential claims
        payload = jwt_service.verify_token(refresh_token)
        assert payload.get("sub") == user_id
        assert payload.get("type") == TokenType.REFRESH.value
        assert "exp" in payload  # Expiration must be present
        assert "iat" in payload  # Issued at must be present
        assert "jti" in payload  # JWT ID must be present for uniqueness

    def test_token_uniqueness(self):
        """Test that each token generation produces unique tokens."""

        user_id = "user-unique"

        # Generate multiple tokens for the same user
        tokens = []
        for _ in range(5):
            token = jwt_service.create_access_token(user_id)
            tokens.append(token)

        # All tokens should be unique
        assert len(tokens) == len(set(tokens))

        # Same for refresh tokens
        refresh_tokens = []
        for _ in range(5):
            token = jwt_service.create_refresh_token(user_id)
            refresh_tokens.append(token)

        assert len(refresh_tokens) == len(set(refresh_tokens))

    def test_token_type_prevents_misuse(self):
        """Test that token type field prevents using wrong token type."""

        # Create tokens
        access_token = jwt_service.create_access_token("user-123")
        refresh_token = jwt_service.create_refresh_token("user-123")

        # Decode tokens
        access_payload = jwt_service.verify_token(access_token)
        refresh_payload = jwt_service.verify_token(refresh_token)

        # Simulate what the refresh endpoint does
        # Access token should fail the type check
        access_type = access_payload.get("type")
        assert access_type != "refresh", "Access token should not pass refresh check"

        # Refresh token should pass the type check
        refresh_type = refresh_payload.get("type")
        assert refresh_type == "refresh", "Refresh token should pass refresh check"
