"""
Middleware for audit context tracking.

This middleware extracts authenticated user information and sets it on the request state
for audit logging throughout the request lifecycle.
"""

from typing import Any

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from .. import tenant as tenant_module
from ..tenant import get_tenant_context

logger = structlog.get_logger(__name__)


class SimpleUser:
    """Simple user object for middleware context.

    Provides a minimal user representation that AppBoundaryMiddleware
    can use for authentication and authorization checks.
    """

    def __init__(
        self,
        user_id: str,
        username: str | None = None,
        email: str | None = None,
        tenant_id: str | None = None,
        roles: list[str] | None = None,
        scopes: list[str] | None = None,
    ):
        self.id = user_id
        self.user_id = user_id
        self.username = username
        self.email = email
        self.tenant_id = tenant_id
        self.roles = roles or []
        # Map roles to scopes for boundary middleware
        # Roles and scopes are treated as equivalent permissions
        self.scopes = scopes or roles or []


class AuditContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds audit context to requests.

    Extracts authenticated user information and tenant context,
    making it available via request.state for audit logging.
    """

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        """Process request and set audit context."""

        original_tenant = get_tenant_context()
        tenant_overridden = False

        try:
            # Try to extract user information from the request
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
                        user_id = claims.get("sub")
                        username = claims.get("username")
                        email = claims.get("email")
                        tenant_id_claim = claims.get("tenant_id")
                        roles = claims.get("roles", [])
                        scopes = claims.get("scopes", []) or claims.get("permissions", [])

                        # Partner multi-tenant context
                        partner_id = claims.get("partner_id")
                        managed_tenant_ids = claims.get("managed_tenant_ids", [])
                        active_managed_tenant_id = request.headers.get("X-Active-Tenant-Id")

                        # Set individual fields for backward compatibility
                        request.state.user_id = user_id
                        request.state.username = username
                        request.state.email = email
                        request.state.tenant_id = tenant_id_claim
                        request.state.roles = roles

                        # Set partner context fields for audit logging
                        request.state.partner_id = partner_id
                        request.state.managed_tenant_ids = managed_tenant_ids
                        request.state.active_managed_tenant_id = active_managed_tenant_id
                        request.state.is_cross_tenant_access = bool(
                            partner_id
                            and active_managed_tenant_id
                            and active_managed_tenant_id != tenant_id_claim
                        )

                        # Create user object for AppBoundaryMiddleware
                        if user_id:
                            request.state.user = SimpleUser(
                                user_id=user_id,
                                username=username,
                                email=email,
                                tenant_id=tenant_id_claim,
                                roles=roles,
                                scopes=scopes,
                            )

                        # Determine effective tenant ID (for partner cross-tenant access)
                        effective_tenant_id = active_managed_tenant_id or tenant_id_claim

                        if effective_tenant_id and effective_tenant_id != get_tenant_context():
                            from ..tenant import set_current_tenant_id as set_tenant_id

                            set_tenant_id(effective_tenant_id)
                            tenant_module._tenant_context.set(effective_tenant_id)
                            tenant_overridden = True

                        # Log cross-tenant access for audit trail
                        if request.state.is_cross_tenant_access:
                            logger.info(
                                "Cross-tenant access initiated",
                                user_id=user_id,
                                partner_id=partner_id,
                                home_tenant=tenant_id_claim,
                                active_managed_tenant=active_managed_tenant_id,
                                path=str(request.url.path),
                                method=request.method,
                            )
                    except Exception as e:
                        logger.debug("Failed to extract user from JWT", error=str(e))

                # Extract user info from API key
                elif api_key:
                    try:
                        key_data = await api_key_service.verify_api_key(api_key)
                        if key_data:
                            user_id = key_data.get("user_id")
                            username = key_data.get("name")
                            tenant_id_claim = key_data.get("tenant_id")
                            roles = ["api_user"]
                            scopes = key_data.get("scopes", []) or key_data.get("permissions", [])

                            # Set individual fields for backward compatibility
                            request.state.user_id = user_id
                            request.state.username = username
                            request.state.tenant_id = tenant_id_claim
                            request.state.roles = roles

                            # Create user object for AppBoundaryMiddleware
                            if user_id:
                                request.state.user = SimpleUser(
                                    user_id=user_id,
                                    username=username,
                                    email=None,
                                    tenant_id=tenant_id_claim,
                                    roles=roles,
                                    scopes=scopes,
                                )

                            if tenant_id_claim and tenant_id_claim != get_tenant_context():
                                from ..tenant import set_current_tenant_id as set_tenant_id

                                set_tenant_id(tenant_id_claim)
                                tenant_module._tenant_context.set(tenant_id_claim)
                                tenant_overridden = True
                    except Exception as e:
                        logger.debug("Failed to extract user from API key", error=str(e))

        except Exception as e:
            # Don't fail the request if we can't extract user context
            logger.debug("Failed to extract audit context", error=str(e))

        try:
            response = await call_next(request)
        finally:
            if tenant_overridden:
                tenant_module._tenant_context.set(original_tenant)

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

            # Populate user object for downstream middleware (e.g., AppBoundaryMiddleware)
            permissions = getattr(user_info, "permissions", None)
            request.state.user = SimpleUser(
                user_id=user_info.user_id,
                username=getattr(user_info, "username", None),
                email=getattr(user_info, "email", None),
                tenant_id=getattr(user_info, "tenant_id", None),
                roles=getattr(user_info, "roles", []) or [],
                scopes=(
                    list(permissions or [])
                    if permissions is not None
                    else getattr(user_info, "roles", []) or []
                ),
            )

            # Also set tenant in context var for database operations
            tenant_id = getattr(user_info, "tenant_id", None)
            if tenant_id:
                from ..tenant import set_current_tenant_id

                set_current_tenant_id(tenant_id)
        return user_info

    return audit_aware_wrapper
