"""
Tenant identity resolution and middleware for single/multi-tenant applications.

Provides configurable tenant resolution supporting both:
- Single-tenant: Always uses default tenant ID
- Multi-tenant: Resolves from headers, query parameters, or state
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import structlog
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import TenantConfiguration, get_tenant_config

logger = structlog.get_logger(__name__)


class TenantIdentityResolver:
    """Resolve tenant identity from request based on configuration.

    In single-tenant mode: Always returns configured default tenant ID
    In multi-tenant mode: Resolves from header, query param, or state
    """

    def __init__(self, config: TenantConfiguration | None = None) -> None:
        """Initialize resolver with configuration."""
        self.config = config or get_tenant_config()
        self.header_name = self.config.tenant_header_name
        self.query_param = self.config.tenant_query_param

    async def resolve(self, request: Request) -> str | None:
        """Resolve tenant ID based on configuration mode.

        SECURITY: Only resolves from middleware-set request.state.tenant_id.
        Direct header/query parameter access is disabled to prevent tenant ID spoofing.

        Platform Admin Support:
            - Platform admins can set X-Target-Tenant-ID header during MIDDLEWARE processing
            - Authorization is checked in middleware before setting request.state.tenant_id
            - Direct header access in request handlers is blocked for security
        """
        # Single-tenant mode: always return default
        if self.config.is_single_tenant:
            return self.config.default_tenant_id

        # Multi-tenant mode: ONLY trust middleware-derived context
        # SECURITY: Do NOT read headers or query params here - middleware must set state

        # Request state (set by middleware ONLY). Avoid Mock auto-creation.
        try:
            state = request.state
            state_dict = getattr(state, "__dict__", {})
            if isinstance(state_dict, dict):
                state_tenant = state_dict.get("tenant_id")
                return state_tenant if isinstance(state_tenant, str) else None
            return None
        except Exception:
            return None


class TenantMiddleware(BaseHTTPMiddleware):
    """Populate request.state.tenant_id based on deployment configuration.

    Single-tenant mode: Always sets default tenant ID
    Multi-tenant mode: Resolves and validates tenant ID from request
    """

    def __init__(
        self,
        app: Any,
        config: TenantConfiguration | None = None,
        resolver: TenantIdentityResolver | None = None,
        exempt_paths: set[str] | None = None,
        require_tenant: bool | None = None,
    ) -> None:
        super().__init__(app)
        self.config = config or get_tenant_config()
        self.resolver = resolver or TenantIdentityResolver(self.config)
        self.header_name = self.config.tenant_header_name  # Set header name for middleware
        self.query_param = self.config.tenant_query_param  # Set query param for middleware
        self.exempt_paths = exempt_paths or {
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/auth/login",  # Auth endpoints don't need tenant
            "/api/v1/auth/register",
            "/api/v1/auth/password-reset",
            "/api/v1/auth/password-reset/confirm",
            "/api/v1/auth/me",  # Allow authenticated users to fetch their profile with tenant_id
            "/api/v1/auth/rbac/my-permissions",  # Allow authenticated users to fetch their permissions
            "/api/v1/secrets/health",  # Vault health check is public
            "/api/v1/health",  # Health check endpoint (also available at /health)
            "/api/v1/platform/config",
            "/api/v1/platform/health",
            "/api/v1/monitoring/alerts/webhook",  # Alertmanager webhook doesn't provide tenant context
        }
        # Paths where tenant is optional (middleware runs but doesn't require tenant)
        self.optional_tenant_paths = {
            "/api/v1/audit/frontend-logs",  # Frontend logs can be unauthenticated
        }
        # Override config's require_tenant if explicitly provided
        if require_tenant is not None:
            self.require_tenant = require_tenant
        else:
            self.require_tenant = self.config.require_tenant_header

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Any]]
    ) -> Any:
        """Process request and set tenant context."""
        path = request.url.path
        register_path = "/api/v1/auth/register"

        # Skip tenant validation for exempt paths
        skip_tenant_validation = False
        if path in self.exempt_paths:
            # Registration requires explicit tenant context when header enforcement is enabled
            if path == register_path and self.require_tenant and not self.config.is_single_tenant:
                skip_tenant_validation = False
            else:
                skip_tenant_validation = True

        if skip_tenant_validation:
            # Even when validation is skipped, honor explicit tenant headers if provided
            tenant_override = None
            try:
                tenant_header = request.headers.get(self.header_name)
                if isinstance(tenant_header, str):
                    tenant_override = tenant_header.strip() or None
            except Exception:
                tenant_override = None

            from . import set_current_tenant_id

            if tenant_override:
                request.state.tenant_id = tenant_override
                set_current_tenant_id(tenant_override)
            elif self.config.is_single_tenant:
                request.state.tenant_id = self.config.default_tenant_id
                set_current_tenant_id(self.config.default_tenant_id)

            return await call_next(request)

        # SECURITY: Middleware is the ONLY place that reads tenant from headers/query params
        # All subsequent resolution in request handlers must use request.state.tenant_id

        # Read tenant ID from headers/query params (middleware only!)
        resolved_id = None

        # Check for platform admin tenant impersonation FIRST (requires authorization)
        target_tenant_header = request.headers.get("X-Target-Tenant-ID")
        if isinstance(target_tenant_header, str):
            target_tenant_header = target_tenant_header.strip()

        if isinstance(target_tenant_header, str) and target_tenant_header:
            # SECURITY: Only allow platform administrators to impersonate another tenant
            resolved_id = self._resolve_platform_admin_impersonation(request, target_tenant_header)
            is_platform_admin_request = True
        else:
            is_platform_admin_request = False

            # Read from standard tenant header
            try:
                tenant_id_header = request.headers.get(self.header_name)
                if isinstance(tenant_id_header, str):
                    tenant_id_header = tenant_id_header.strip()
                if isinstance(tenant_id_header, str) and tenant_id_header:
                    resolved_id = tenant_id_header
            except Exception:
                pass

            # Fallback to query param if header not present
            if not resolved_id:
                try:
                    tenant_id_param = request.query_params.get(self.query_param)
                    if isinstance(tenant_id_param, str):
                        tenant_id_param = tenant_id_param.strip()
                    if isinstance(tenant_id_param, str) and tenant_id_param:
                        resolved_id = tenant_id_param
                except Exception:
                    pass

        # Get final tenant ID based on configuration
        tenant_id = self.config.get_tenant_id_for_request(resolved_id)

        # Check if this path allows optional tenant
        is_optional_tenant_path = any(
            path == optional_path or path.startswith(optional_path.rstrip("/") + "/")
            for optional_path in self.optional_tenant_paths
        )

        if tenant_id:
            # Set tenant ID on request state and context var
            request.state.tenant_id = tenant_id
            from . import set_current_tenant_id

            set_current_tenant_id(tenant_id)
        elif self.require_tenant and not is_platform_admin_request and not is_optional_tenant_path:
            import structlog

            logger = structlog.get_logger(__name__)
            logger.warning(
                "Tenant ID missing for request - proceeding without tenant context",
                path=request.url.path,
                method=request.method,
                headers={k: v for k, v in request.headers.items() if k.lower().startswith("x-")},
            )

            from . import set_current_tenant_id

            request.state.tenant_id = None
            set_current_tenant_id(None)
            return JSONResponse(
                status_code=400,
                content={"detail": "Tenant ID is required for this request."},
            )
        else:
            # SECURITY: Only fall back to default tenant in these specific cases:
            # 1. require_tenant=False (explicitly allowed by configuration)
            # 2. Platform admin with X-Target-Tenant-ID header (cross-tenant access)
            # 3. Optional tenant paths (like frontend logs)
            #
            # If require_tenant=True in production, requests WITHOUT tenant_id are rejected above
            fallback_tenant = (
                self.config.default_tenant_id
                if (not is_platform_admin_request or is_optional_tenant_path)
                else None
            )
            request.state.tenant_id = fallback_tenant
            from . import set_current_tenant_id

            set_current_tenant_id(fallback_tenant)

        return await call_next(request)

    def _resolve_platform_admin_impersonation(self, request: Request, header_value: str) -> str:
        """
        Validate platform admin impersonation attempts.

        Ensures the caller is authenticated as a platform admin before honoring X-Target-Tenant-ID.
        """
        candidate = header_value.strip()
        if not candidate:
            raise HTTPException(
                status_code=400,
                detail="Target tenant header cannot be empty.",
            )

        token = None
        auth_header = request.headers.get("Authorization")
        if isinstance(auth_header, str) and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()

        if not token:
            # Support HttpOnly cookie tokens for browser-based admin tooling
            cookies = getattr(request, "cookies", None)
            if cookies:
                try:
                    cookie_token = cookies.get("access_token")
                except Exception:
                    cookie_token = None
                if isinstance(cookie_token, str) and cookie_token:
                    token = cookie_token

        if not token:
            logger.warning(
                "tenant_impersonation_missing_token",
                path=request.url.path,
                target_tenant=candidate,
            )
            raise HTTPException(
                status_code=403,
                detail="Authentication is required to impersonate a tenant.",
            )

        try:
            from dotmac.platform.auth.core import TokenType, UserInfo, jwt_service
            from dotmac.platform.auth.platform_admin import is_platform_admin

            claims = jwt_service.verify_token(token, TokenType.ACCESS)
            user_info = UserInfo(
                user_id=claims.get("sub", ""),
                email=claims.get("email"),
                username=claims.get("username"),
                roles=claims.get("roles", []),
                permissions=claims.get("permissions", []),
                tenant_id=claims.get("tenant_id"),
                is_platform_admin=claims.get("is_platform_admin", False),
            )

            if not is_platform_admin(user_info):
                logger.warning(
                    "tenant_impersonation_not_platform_admin",
                    user_id=user_info.user_id,
                    target_tenant=candidate,
                )
                raise HTTPException(
                    status_code=403,
                    detail="Platform administrator access required to impersonate tenants.",
                )

            logger.info(
                "tenant_impersonation_authorized",
                user_id=user_info.user_id,
                target_tenant=candidate,
            )
            return candidate
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning(
                "tenant_impersonation_validation_failed",
                error=str(exc),
                target_tenant=candidate,
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication for tenant impersonation.",
            ) from exc
