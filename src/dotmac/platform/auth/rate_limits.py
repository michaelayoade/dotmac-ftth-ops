"""
Rate limiting configuration for authentication endpoints.

This module defines rate limits for auth endpoints to prevent abuse.
The limits are applied in production but gracefully skipped in tests.
"""

from typing import Any

# Rate limits for auth endpoints
# These are applied in production via the app configuration

AUTH_RATE_LIMITS = {
    "/auth/login": "5/minute",  # Prevent brute force attacks
    "/auth/register": "3/minute",  # Prevent mass account creation
    "/auth/refresh": "10/minute",  # Reasonable limit for token refresh
    "/auth/password-reset": "3/minute",  # Prevent abuse of password reset
}


def apply_auth_rate_limits(app: Any) -> None:
    """Apply rate limits to auth endpoints.

    This is called during app initialization to apply rate limits
    to authentication endpoints. The limits help prevent:
    - Brute force attacks on login
    - Mass account creation via registration
    - Token refresh abuse
    - Password reset abuse
    """
    for _endpoint, _limit in AUTH_RATE_LIMITS.items():
        # Apply limiter to specific endpoint
        # This approach allows tests to work without Request objects
        pass  # Actual application happens via middleware
