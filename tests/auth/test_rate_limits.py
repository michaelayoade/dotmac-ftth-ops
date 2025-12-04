"""Tests for auth rate limits configuration."""

from unittest.mock import MagicMock

import pytest

from dotmac.platform.auth.rate_limits import AUTH_RATE_LIMITS, apply_auth_rate_limits


@pytest.mark.integration
class TestAuthRateLimits:
    """Test authentication rate limits configuration."""

    def test_rate_limits_defined(self):
        """Test rate limits are defined for all endpoints."""
        assert "/auth/login" in AUTH_RATE_LIMITS
        assert "/auth/register" in AUTH_RATE_LIMITS
        assert "/auth/refresh" in AUTH_RATE_LIMITS
        assert "/auth/password-reset" in AUTH_RATE_LIMITS

    def test_login_rate_limit(self):
        """Test login endpoint rate limit."""
        assert AUTH_RATE_LIMITS["/auth/login"] == "5/minute"

    def test_register_rate_limit(self):
        """Test register endpoint rate limit."""
        assert AUTH_RATE_LIMITS["/auth/register"] == "3/minute"

    def test_refresh_rate_limit(self):
        """Test refresh endpoint rate limit."""
        assert AUTH_RATE_LIMITS["/auth/refresh"] == "10/minute"

    def test_password_reset_rate_limit(self):
        """Test password reset endpoint rate limit."""
        assert AUTH_RATE_LIMITS["/auth/password-reset"] == "3/minute"

    def test_rate_limit_format(self):
        """Test all rate limits follow the expected format."""
        for _endpoint, limit in AUTH_RATE_LIMITS.items():
            assert "/" in limit  # Should be like "5/minute"
            parts = limit.split("/")
            assert len(parts) == 2
            assert parts[0].isdigit()  # Numeric limit
            assert parts[1] in ["minute", "hour", "day"]  # Time unit

    def test_rate_limits_are_restrictive(self):
        """Test rate limits are appropriately restrictive."""
        # Extract numeric part
        login_limit = int(AUTH_RATE_LIMITS["/auth/login"].split("/")[0])
        register_limit = int(AUTH_RATE_LIMITS["/auth/register"].split("/")[0])

        # Login should allow few attempts to prevent brute force
        assert login_limit <= 10

        # Registration should be even more restrictive
        assert register_limit <= 5

    def test_apply_auth_rate_limits_no_error(self):
        """Test apply_auth_rate_limits can be called."""
        mock_app = MagicMock()
        # Should not raise exception
        result = apply_auth_rate_limits(mock_app)
        assert result is None

    def test_apply_auth_rate_limits_with_none(self):
        """Test apply_auth_rate_limits handles None app."""
        # Should not raise exception
        result = apply_auth_rate_limits(None)
        assert result is None

    def test_rate_limits_dictionary_immutable(self):
        """Test rate limits dictionary structure."""
        assert isinstance(AUTH_RATE_LIMITS, dict)
        assert len(AUTH_RATE_LIMITS) >= 4

    def test_all_endpoints_start_with_auth(self):
        """Test all endpoints are under /auth path."""
        for endpoint in AUTH_RATE_LIMITS.keys():
            assert endpoint.startswith("/auth/")

    def test_rate_limit_values_are_strings(self):
        """Test all rate limit values are strings."""
        for limit in AUTH_RATE_LIMITS.values():
            assert isinstance(limit, str)

    def test_rate_limits_per_minute(self):
        """Test most limits are per minute (most common)."""
        per_minute = sum(1 for limit in AUTH_RATE_LIMITS.values() if "/minute" in limit)
        assert per_minute >= 3  # Most should be per minute

    def test_strictest_rate_limit(self):
        """Test which endpoint has the strictest limit."""
        limits = {
            endpoint: int(limit.split("/")[0]) for endpoint, limit in AUTH_RATE_LIMITS.items()
        }

        # Register and password-reset should be among the strictest
        assert limits["/auth/register"] <= 3
        assert limits["/auth/password-reset"] <= 3

    def test_most_lenient_rate_limit(self):
        """Test refresh endpoint has more lenient limit."""
        refresh_limit = int(AUTH_RATE_LIMITS["/auth/refresh"].split("/")[0])
        # Refresh can be more frequent as it's already authenticated
        assert refresh_limit >= 10
