"""
Tenant identity resolution and middleware for single/multi-tenant applications.

Provides configurable tenant resolution supporting both:
- Single-tenant: Always uses default tenant ID
- Multi-tenant: Resolves from headers, query parameters, or state
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from .config import TenantConfiguration, get_tenant_config


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

        Platform Admin Support:
            - Platform admins can set X-Target-Tenant-ID header to impersonate tenants
            - If no target tenant is specified, platform admins get tenant_id=None (cross-tenant mode)
        """
        # Single-tenant mode: always return default
        if self.config.is_single_tenant:
            return self.config.default_tenant_id

        # Multi-tenant mode: resolve from request

        # Check for platform admin tenant impersonation first
        target_tenant = request.headers.get("X-Target-Tenant-ID")
        if isinstance(target_tenant, str):
            target_tenant = target_tenant.strip()
        if isinstance(target_tenant, str) and target_tenant:
            # Platform admin is targeting a specific tenant
            # Authorization check happens in the dependency layer
            return target_tenant

        # Header
        try:
            tenant_id = request.headers.get(self.header_name)
            if isinstance(tenant_id, str):
                tenant_id = tenant_id.strip()
            if isinstance(tenant_id, str) and tenant_id:
                return tenant_id
        except Exception:
            pass

        # Query param
        try:
            tenant_id = request.query_params.get(self.query_param)
            if isinstance(tenant_id, str):
                tenant_id = tenant_id.strip()
            if isinstance(tenant_id, str) and tenant_id:
                return tenant_id
        except Exception:
            pass

        # Request state (set by upstream or router). Avoid Mock auto-creation.
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
        self.exempt_paths = exempt_paths or {
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/auth/login",  # Auth endpoints don't need tenant
            "/api/v1/auth/register",
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
            if (
                path == register_path
                and self.require_tenant
                and not self.config.is_single_tenant
            ):
                skip_tenant_validation = False
            else:
                skip_tenant_validation = True

        if skip_tenant_validation:
            # In single-tenant mode, still set default tenant for consistency
            if self.config.is_single_tenant:
                request.state.tenant_id = self.config.default_tenant_id
                from . import set_current_tenant_id

                set_current_tenant_id(self.config.default_tenant_id)
            return await call_next(request)

        # Resolve tenant ID
        resolved_id = await self.resolver.resolve(request)

        # Get final tenant ID based on configuration
        tenant_id = self.config.get_tenant_id_for_request(resolved_id)

        # Check if this is a platform admin request (they can operate without tenant)
        override_header = request.headers.get("X-Target-Tenant-ID")
        is_platform_admin_request = isinstance(override_header, str) and override_header.strip() != ""

        # Check if this path allows optional tenant
        is_optional_tenant_path = path in self.optional_tenant_paths

        if tenant_id:
            # Set tenant ID on request state and context var
            request.state.tenant_id = tenant_id
            from . import set_current_tenant_id

            set_current_tenant_id(tenant_id)
        elif self.require_tenant and not is_platform_admin_request and not is_optional_tenant_path:
            # SECURITY: Fail fast when tenant is required but not provided
            # This prevents silent fallback to default tenant which bypasses isolation
            import structlog
            from fastapi import status
            from starlette.responses import JSONResponse

            logger = structlog.get_logger(__name__)
            logger.warning(
                "Tenant ID required but not provided - rejecting request",
                path=request.url.path,
                method=request.method,
                headers={k: v for k, v in request.headers.items() if k.lower().startswith("x-")},
            )

            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "detail": f"Tenant ID is required. Provide via {self.config.tenant_header_name} header or {self.config.tenant_query_param} query param."
                },
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
