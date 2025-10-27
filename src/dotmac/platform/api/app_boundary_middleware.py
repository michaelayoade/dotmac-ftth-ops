"""
App Boundary Middleware

Enforces platform vs tenant route boundaries based on scopes and tenant context.
Provides clear separation between:
- Platform routes (/api/platform/v1/*) - Requires platform:* scopes
- Tenant routes (/api/tenant/v1/*) - Requires tenant_id context
- Shared routes (/api/v1/*) - Available to both with scope-based filtering
"""

from collections.abc import Awaitable, Callable
from typing import Any

import structlog
from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

CallNext = Callable[[Request], Awaitable[Response]]


class AppBoundaryMiddleware(BaseHTTPMiddleware):
    """
    Enforce route boundaries between platform and tenant operations.

    Rules:
    1. /api/platform/* routes require platform:* scopes
    2. /api/tenant/* routes require tenant_id context
    3. /api/v1/* (shared) available to both with scope-based filtering
    4. /api/public/* open to all
    5. /health, /ready, /metrics public

    The middleware runs early in the stack to reject unauthorized
    requests before they reach route handlers.
    """

    # Route prefixes that define boundaries
    PLATFORM_PREFIXES = ("/api/platform/",)
    TENANT_PREFIXES = ("/api/tenant/",)
    SHARED_PREFIXES = ("/api/v1/",)
    PUBLIC_PREFIXES = ("/api/public/", "/docs", "/redoc", "/openapi.json")
    # Fixed: Removed overly broad "/api" prefix that was bypassing ALL API route enforcement
    # Only include actual health endpoints: /health, /ready, /metrics, /api/health
    HEALTH_PREFIXES = ("/health", "/ready", "/metrics", "/api/health")

    async def dispatch(
        self,
        request: Request,
        call_next: CallNext,
    ) -> Response:
        """
        Enforce app boundaries before processing request.

        Args:
            request: FastAPI Request
            call_next: Next middleware in chain

        Returns:
            Response

        Raises:
            HTTPException: If boundary rules are violated
        """
        path = request.url.path

        # Skip middleware for public and health routes
        if self._is_public_route(path) or self._is_health_route(path):
            return await call_next(request)

        # Get user from request state (set by auth middleware)
        user = getattr(request.state, "user", None)
        tenant_id = getattr(request.state, "tenant_id", None)

        # Enforce platform route boundaries
        if self._is_platform_route(path):
            self._enforce_platform_boundary(path, user, tenant_id)

        # Enforce tenant route boundaries
        elif self._is_tenant_route(path):
            self._enforce_tenant_boundary(path, user, tenant_id)

        # Shared routes - no additional enforcement (handled by route dependencies)

        # Proceed with request
        return await call_next(request)

    def _enforce_platform_boundary(
        self,
        path: str,
        user: Any | None,
        tenant_id: str | None,
    ) -> None:
        """
        Enforce platform route boundary rules.

        Args:
            path: Request path
            user: Current user (if authenticated)
            tenant_id: Current tenant ID (if present)

        Raises:
            HTTPException: If access denied
        """
        # Check deployment mode - platform routes disabled in single-tenant mode
        if settings.DEPLOYMENT_MODE == "single_tenant":
            logger.warning(
                "platform_route_blocked_single_tenant_mode",
                path=path,
                deployment_mode=settings.DEPLOYMENT_MODE,
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Platform routes are disabled in single-tenant deployment mode",
                    "path": path,
                    "deployment_mode": settings.DEPLOYMENT_MODE,
                },
            )

        # Platform routes require authentication
        if not user:
            logger.warning(
                "platform_route_requires_auth",
                path=path,
            )
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "Authentication required for platform routes",
                    "path": path,
                },
            )

        # Check for platform scopes
        if not self._has_platform_scope(user):
            logger.warning(
                "platform_access_denied",
                path=path,
                user_id=getattr(user, "id", None),
                scopes=getattr(user, "scopes", []),
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Platform access requires platform-level permissions",
                    "path": path,
                    "required_scopes": [
                        "platform:*",
                        "platform_super_admin",
                        "platform_support",
                        "platform_finance",
                    ],
                    "help": "Contact your platform administrator for access",
                },
            )

        logger.debug(
            "platform_route_access_granted",
            path=path,
            user_id=getattr(user, "id", None),
        )

    def _enforce_tenant_boundary(
        self,
        path: str,
        user: Any | None,
        tenant_id: str | None,
    ) -> None:
        """
        Enforce tenant route boundary rules.

        Args:
            path: Request path
            user: Current user (if authenticated)
            tenant_id: Current tenant ID (if present)

        Raises:
            HTTPException: If access denied
        """
        # Tenant routes require authentication
        if not user:
            logger.warning(
                "tenant_route_requires_auth",
                path=path,
            )
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "Authentication required for tenant routes",
                    "path": path,
                },
            )

        # Tenant routes require tenant context
        if not tenant_id:
            logger.warning(
                "tenant_context_missing",
                path=path,
                user_id=getattr(user, "id", None),
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Tenant context required for this operation",
                    "path": path,
                    "help": "Include X-Tenant-ID header or select a tenant in the UI",
                },
            )

        # Check for tenant or platform scopes (platform users can access tenant routes)
        if not self._has_tenant_scope(user) and not self._has_platform_scope(user):
            logger.warning(
                "tenant_access_denied",
                path=path,
                user_id=getattr(user, "id", None),
                tenant_id=tenant_id,
                scopes=getattr(user, "scopes", []),
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Insufficient permissions for tenant operations",
                    "path": path,
                    "required_scopes": ["isp_admin:*", "network:*", "billing:*", "customer:*"],
                    "help": "Contact your tenant administrator for access",
                },
            )

        logger.debug(
            "tenant_route_access_granted",
            path=path,
            user_id=getattr(user, "id", None),
            tenant_id=tenant_id,
        )

    def _is_public_route(self, path: str) -> bool:
        """Check if route is public (no auth required)."""
        return any(path.startswith(prefix) for prefix in self.PUBLIC_PREFIXES)

    def _is_health_route(self, path: str) -> bool:
        """Check if route is health check (public)."""
        return any(path.startswith(prefix) for prefix in self.HEALTH_PREFIXES)

    def _is_platform_route(self, path: str) -> bool:
        """Check if route is platform-only."""
        return any(path.startswith(prefix) for prefix in self.PLATFORM_PREFIXES)

    def _is_tenant_route(self, path: str) -> bool:
        """Check if route is tenant-only."""
        return any(path.startswith(prefix) for prefix in self.TENANT_PREFIXES)

    def _has_platform_scope(self, user: Any) -> bool:
        """
        Check if user has any platform-level scopes.

        Platform scopes include:
        - platform:* (super admin)
        - platform:tenants:*
        - platform:licensing:*
        - platform:support:*
        - platform_super_admin
        - platform_support
        - platform_finance
        - platform_partner_admin
        - platform_observer

        Args:
            user: User object

        Returns:
            True if user has platform scopes
        """
        if not hasattr(user, "scopes"):
            return False

        scopes = user.scopes
        if not isinstance(scopes, list):
            return False

        # Check for platform scopes
        platform_scope_keywords = [
            "platform:",
            "platform_super_admin",
            "platform_support",
            "platform_finance",
            "platform_partner_admin",
            "platform_observer",
        ]

        for scope in scopes:
            if any(keyword in str(scope) for keyword in platform_scope_keywords):
                return True

        return False

    def _has_tenant_scope(self, user: Any) -> bool:
        """
        Check if user has any tenant-level scopes.

        Tenant scopes include:
        - isp_admin:*
        - network:*
        - billing:*
        - customer:*
        - services:*
        - reseller:*
        - support:*
        - ticket:*
        - workflows:*
        - jobs:*

        Args:
            user: User object

        Returns:
            True if user has tenant scopes
        """
        if not hasattr(user, "scopes"):
            return False

        scopes = user.scopes
        if not isinstance(scopes, list):
            return False

        # Allow platform users to access tenant routes (for support)
        if self._has_platform_scope(user):
            return True

        # Check for tenant scopes
        tenant_scope_keywords = [
            "isp_admin:",
            "network:",
            "billing:",
            "customer:",
            "services:",
            "reseller:",
            "support:",
            "ticket:",
            "workflows:",
            "jobs:",
            "integrations:",
            "plugins:",
            "analytics:",
            "audit:",
        ]

        for scope in scopes:
            if any(str(scope).startswith(keyword) for keyword in tenant_scope_keywords):
                return True

        return False


class SingleTenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware for single-tenant deployments.

    In single-tenant mode:
    - Automatically sets tenant_id from config
    - Disables tenant selection
    - Simplifies authentication

    This middleware should be disabled in multi-tenant mode.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: CallNext,
    ) -> Response:
        """
        Set fixed tenant context for single-tenant deployment.

        Args:
            request: FastAPI Request
            call_next: Next middleware

        Returns:
            Response
        """
        # Only apply in single-tenant mode
        if settings.DEPLOYMENT_MODE != "single_tenant":
            return await call_next(request)

        # Set fixed tenant ID from config
        if settings.TENANT_ID:
            request.state.tenant_id = settings.TENANT_ID
            logger.debug(
                "single_tenant_context_set",
                tenant_id=settings.TENANT_ID,
                path=request.url.path,
            )
        else:
            logger.warning(
                "single_tenant_mode_missing_tenant_id",
                path=request.url.path,
            )

        return await call_next(request)
