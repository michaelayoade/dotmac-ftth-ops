"""
App Boundary Middleware

Enforces platform vs ISP route boundaries based on scopes and tenant context.
Provides clear separation between:
- Platform routes (/api/platform/v1/*) - Requires platform:* scopes
- ISP routes (/api/isp/v1/*) - Requires tenant_id context and ISP scopes

IMPORTANT: The /api/tenant/v1 prefix is NO LONGER SUPPORTED.
All ISP routes must use /api/isp/v1.
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
    Enforce route boundaries between platform and ISP operations.

    Rules:
    1. /api/platform/* routes require platform:* scopes
    2. /api/isp/* routes require tenant_id context and ISP scopes
    3. /api/public/* open to all
    4. /health, /ready, /metrics public
    5. /api/tenant/* REJECTED with 410 Gone (removed)

    Note: Shared routes (auth, users, etc.) are embedded in each sub-app
    and inherit that app's boundary rules automatically.
    """

    # Route prefixes that define boundaries
    PLATFORM_PREFIXES = ("/api/platform/",)
    ISP_PREFIXES = ("/api/isp/",)
    PUBLIC_PREFIXES = (
        "/api/public/",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/platform/v1/auth",
        "/api/isp/v1/auth",
    )
    HEALTH_PREFIXES = ("/health", "/ready", "/metrics", "/api/health")
    AUTH_PREFIXES = ("/api/platform/v1/auth/", "/api/isp/v1/auth/")

    # Rejected prefixes - fail fast with 410 Gone
    REJECTED_PREFIXES = ("/api/tenant/", "/api/v1/")

    async def dispatch(
        self,
        request: Request,
        call_next: CallNext,
    ) -> Response:
        """Enforce app boundaries before processing request."""
        path = request.url.path

        # Fail fast on rejected prefixes
        if self._is_rejected_route(path):
            logger.error(
                "rejected_route",
                path=path,
                message="Route prefix not supported",
            )
            raise HTTPException(
                status_code=410,
                detail={
                    "error": "This API endpoint does not exist",
                    "path": path,
                },
            )

        # Skip middleware for public and health routes
        if self._is_public_route(path) or self._is_health_route(path) or self._is_auth_route(path):
            return await call_next(request)

        # Get user from request state (set by auth middleware)
        user = getattr(request.state, "user", None)
        tenant_id = getattr(request.state, "tenant_id", None)

        # Enforce platform route boundaries
        if self._is_platform_route(path):
            self._enforce_platform_boundary(path, user, tenant_id)

        # Enforce ISP route boundaries
        elif self._is_isp_route(path):
            self._enforce_isp_boundary(path, user, tenant_id)

        return await call_next(request)

    def _enforce_platform_boundary(
        self,
        path: str,
        user: Any | None,
        tenant_id: str | None,
    ) -> None:
        """Enforce platform route boundary rules."""
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
            logger.warning("platform_route_requires_auth", path=path)
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
                },
            )

        logger.debug(
            "platform_route_access_granted",
            path=path,
            user_id=getattr(user, "id", None),
        )

    def _enforce_isp_boundary(
        self,
        path: str,
        user: Any | None,
        tenant_id: str | None,
    ) -> None:
        """Enforce ISP route boundary rules."""
        # ISP routes require authentication
        if not user:
            logger.warning("isp_route_requires_auth", path=path)
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "Authentication required for ISP routes",
                    "path": path,
                },
            )

        # ISP routes require tenant context
        if not tenant_id:
            logger.warning(
                "tenant_context_missing",
                path=path,
                user_id=getattr(user, "id", None),
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Tenant context required for ISP operations",
                    "path": path,
                    "help": "Include X-Tenant-ID header",
                },
            )

        # Check for ISP or platform scopes
        if not self._has_isp_scope(user) and not self._has_platform_scope(user):
            logger.warning(
                "isp_access_denied",
                path=path,
                user_id=getattr(user, "id", None),
                tenant_id=tenant_id,
                scopes=getattr(user, "scopes", []),
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Insufficient permissions for ISP operations",
                    "path": path,
                    "required_scopes": ["isp_admin:*", "network:*", "billing:*", "customer:*"],
                },
            )

        logger.debug(
            "isp_route_access_granted",
            path=path,
            user_id=getattr(user, "id", None),
            tenant_id=tenant_id,
        )

    def _is_rejected_route(self, path: str) -> bool:
        """Check if route uses rejected prefixes."""
        return any(path.startswith(prefix) for prefix in self.REJECTED_PREFIXES)

    def _is_auth_route(self, path: str) -> bool:
        """Allow unauthenticated access to auth routes for login/refresh/2fa/etc."""
        return any(path.startswith(prefix) for prefix in self.AUTH_PREFIXES)

    def _is_platform_route(self, path: str) -> bool:
        """Check if route is a platform route, excluding auth/public/health."""
        if self._is_auth_route(path) or self._is_public_route(path) or self._is_health_route(path):
            return False
        return any(path.startswith(prefix) for prefix in self.PLATFORM_PREFIXES)

    def _is_isp_route(self, path: str) -> bool:
        """Check if route is an ISP route, excluding auth/public/health."""
        if self._is_auth_route(path) or self._is_public_route(path) or self._is_health_route(path):
            return False
        return any(path.startswith(prefix) for prefix in self.ISP_PREFIXES)

    def _is_public_route(self, path: str) -> bool:
        """Check if route is public (no auth required)."""
        return any(path.startswith(prefix) for prefix in self.PUBLIC_PREFIXES)

    def _is_health_route(self, path: str) -> bool:
        """Check if route is health check (public)."""
        return any(path.startswith(prefix) for prefix in self.HEALTH_PREFIXES)

    def _is_platform_route(self, path: str) -> bool:
        """Check if route is platform-only."""
        return any(path.startswith(prefix) for prefix in self.PLATFORM_PREFIXES)

    def _is_isp_route(self, path: str) -> bool:
        """Check if route is ISP-only."""
        return any(path.startswith(prefix) for prefix in self.ISP_PREFIXES)

    def _has_platform_scope(self, user: Any) -> bool:
        """Check if user has any platform-level scopes."""
        if not hasattr(user, "scopes"):
            return False

        scopes = user.scopes
        if not isinstance(scopes, list):
            return False

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

    def _has_isp_scope(self, user: Any) -> bool:
        """Check if user has any ISP-level scopes."""
        if not hasattr(user, "scopes"):
            return False

        scopes = user.scopes
        if not isinstance(scopes, list):
            return False

        # Allow platform users to access ISP routes (for support)
        if self._has_platform_scope(user):
            return True

        isp_scope_keywords = [
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
            if any(str(scope).startswith(keyword) for keyword in isp_scope_keywords):
                return True

        return False


class SingleTenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware for single-tenant deployments.

    In single-tenant mode:
    - Automatically sets tenant_id from config
    - Disables tenant selection
    """

    async def dispatch(
        self,
        request: Request,
        call_next: CallNext,
    ) -> Response:
        """Set fixed tenant context for single-tenant deployment."""
        if settings.DEPLOYMENT_MODE != "single_tenant":
            return await call_next(request)

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
