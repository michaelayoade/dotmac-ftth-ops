"""
Middleware for audit context tracking.

This middleware extracts authenticated user information and sets it on the request state
for audit logging throughout the request lifecycle.
"""

from typing import Any

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger(__name__)


class AuditContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds audit context to requests.

    Extracts authenticated user information and tenant context,
    making it available via request.state for audit logging.
    """

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        """Process request and set audit context."""

        # Try to extract user information from the request
        # This needs to be done carefully to avoid circular dependencies
        try:
            # Check if there's an Authorization header or cookie
            auth_header = request.headers.get("Authorization")
            api_key = request.headers.get("X-API-Key")

            # Try to get JWT token from Authorization header or cookie
            jwt_token = None
            if auth_header and auth_header.startswith("Bearer "):
                jwt_token = auth_header.split(" ")[1]
            else:
                # Fall back to cookie (for GraphQL, real-time, and browser requests)
                cookie_token = None
                cookies = getattr(request, "cookies", None)
                if cookies:
                    try:
                        cookie_token = cookies.get("access_token")
                    except Exception:
                        cookie_token = None
                if isinstance(cookie_token, str) and cookie_token:
                    jwt_token = cookie_token

            if jwt_token or api_key:
                # Import here to avoid circular dependency
                from ..auth.core import api_key_service, jwt_service

                # Extract user info from JWT token (header or cookie)
                if jwt_token:
                    try:
                        claims = jwt_service.verify_token(jwt_token)
                        request.state.user_id = claims.get("sub")
                        request.state.username = claims.get("username")
                        request.state.email = claims.get("email")
                        request.state.tenant_id = claims.get("tenant_id")
                        request.state.roles = claims.get("roles", [])

                        # Also set tenant in context var for database operations
                        if claims.get("tenant_id"):
                            from ..tenant import set_current_tenant_id

                            set_current_tenant_id(claims.get("tenant_id"))
                    except Exception as e:
                        logger.debug("Failed to extract user from JWT", error=str(e))

                # Extract user info from API key
                elif api_key:
                    try:
                        key_data = await api_key_service.verify_api_key(api_key)
                        if key_data:
                            request.state.user_id = key_data.get("user_id")
                            request.state.username = key_data.get("name")
                            request.state.tenant_id = key_data.get("tenant_id")
                            request.state.roles = ["api_user"]

                            # Also set tenant in context var for database operations
                            if key_data.get("tenant_id"):
                                from ..tenant import set_current_tenant_id

                                set_current_tenant_id(key_data.get("tenant_id"))
                    except Exception as e:
                        logger.debug("Failed to extract user from API key", error=str(e))

        except Exception as e:
            # Don't fail the request if we can't extract user context
            logger.debug("Failed to extract audit context", error=str(e))

        # Continue processing the request
        response = await call_next(request)
        return response


def create_audit_aware_dependency(user_info_dependency: Any) -> Any:
    """
    Creates a dependency that sets user context on the request state.

    This wrapper ensures that authenticated user information is available
    for audit logging throughout the request lifecycle.
    """

    async def audit_aware_wrapper(request: Request, user_info: Any = user_info_dependency) -> Any:
        """Extract user info and set on request state."""
        if user_info:
            request.state.user_id = user_info.user_id
            request.state.username = getattr(user_info, "username", None)
            request.state.email = getattr(user_info, "email", None)
            request.state.tenant_id = getattr(user_info, "tenant_id", None)
            request.state.roles = getattr(user_info, "roles", [])

            # Also set tenant in context var for database operations
            tenant_id = getattr(user_info, "tenant_id", None)
            if tenant_id:
                from ..tenant import set_current_tenant_id

                set_current_tenant_id(tenant_id)
        return user_info

    return audit_aware_wrapper
