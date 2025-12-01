"""
ISP Service Entrypoint.

Standalone entrypoint for the ISP operations service.
Mounts only ISP routes at /api/isp/v1.

Usage:
    uvicorn dotmac.platform.isp_main:app --host 0.0.0.0 --port 8000
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import Response

from dotmac.platform.api.app_boundary_middleware import (
    AppBoundaryMiddleware,
    SingleTenantMiddleware,
)
from dotmac.platform.audit import AuditContextMiddleware
from dotmac.platform.core.exception_handlers import register_exception_handlers
from dotmac.platform.core.rate_limiting import get_limiter
from dotmac.platform.core.request_context import RequestContextMiddleware
from dotmac.platform.core.rls_middleware import RLSMiddleware
from dotmac.platform.db import init_db
from dotmac.platform.monitoring.error_middleware import (
    ErrorTrackingMiddleware,
    RequestMetricsMiddleware,
)
from dotmac.platform.monitoring.health_checks import HealthChecker
from dotmac.platform.redis_client import init_redis, shutdown_redis
from dotmac.platform.settings import settings
from dotmac.platform.telemetry import setup_telemetry
from dotmac.platform.tenant import TenantMiddleware
from dotmac.shared.routers import ServiceScope, register_routers_for_scope

logger = structlog.get_logger(__name__)


def rate_limit_handler(request: Request, exc: Exception) -> Response:
    """Handle rate limit exceeded exceptions with proper typing."""
    # Cast to RateLimitExceeded since we know it will be that type when called
    return _rate_limit_exceeded_handler(request, exc)  # type: ignore[arg-type]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """ISP service lifecycle management."""
    logger.info("isp_service.starting", version=settings.app_version)

    # Initialize infrastructure
    await init_redis()
    await init_db()

    # Setup telemetry
    setup_telemetry(app)

    logger.info("isp_service.started")
    yield

    # Cleanup
    logger.info("isp_service.stopping")
    await shutdown_redis()
    logger.info("isp_service.stopped")


def create_isp_service() -> FastAPI:
    """
    Create the ISP operations service.

    This is a standalone service that handles:
    - Customer and subscriber management
    - Network operations (RADIUS, NetBox, GenieACS, VOLTHA)
    - Billing and revenue management
    - Service provisioning and lifecycle
    - Support and ticketing
    - Partner management

    Returns:
        FastAPI application instance
    """
    app = FastAPI(
        title="DotMac ISP Service",
        description="ISP operations and tenant management",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # Add middleware stack
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(ErrorTrackingMiddleware)
    app.add_middleware(RequestMetricsMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Tenant context middleware
    app.add_middleware(TenantMiddleware)

    # RLS enforcement
    app.add_middleware(RLSMiddleware)

    # Single-tenant mode support
    if settings.DEPLOYMENT_MODE == "single_tenant":
        app.add_middleware(SingleTenantMiddleware)

    app.add_middleware(AuditContextMiddleware)
    app.add_middleware(AppBoundaryMiddleware)

    # CORS
    if settings.cors.enabled:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors.origins,
            allow_credentials=settings.cors.credentials,
            allow_methods=settings.cors.methods,
            allow_headers=settings.cors.headers,
            max_age=settings.cors.max_age,
        )

    # Rate limiting
    app.state.limiter = get_limiter()
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

    # Exception handlers
    register_exception_handlers(app)

    # Register ISP + SHARED routers at /api/isp/v1
    # NOTE: Routes that need /admin prefix specify it via base_prefix in registry.py
    # Do NOT use default_base_prefix here - it breaks frontend API paths
    logger.info("isp_service.registering_routers")
    registered, failed = register_routers_for_scope(
        app,
        scope=ServiceScope.ISP,
        include_shared=True,
        prefix="/api/isp/v1",
    )
    logger.info(
        "isp_service.routers_registered",
        registered=registered,
        failed=failed,
    )

    # Health endpoints at root
    @app.get("/health")
    async def health_check() -> dict[str, Any]:
        """Health check endpoint."""
        return {
            "status": "healthy",
            "service": "isp",
            "version": settings.app_version,
        }

    @app.get("/health/live")
    async def liveness_check() -> dict[str, Any]:
        """Liveness check for Kubernetes."""
        return {
            "status": "alive",
            "service": "isp",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    @app.get("/health/ready")
    async def readiness_check() -> dict[str, Any]:
        """Readiness check for Kubernetes."""
        checker = HealthChecker()
        summary = checker.get_summary()
        return {
            "status": "ready" if summary["healthy"] else "not ready",
            "service": "isp",
            "healthy": summary["healthy"],
            "services": summary["services"],
        }

    return app


# Application instance for uvicorn
app = create_isp_service()
