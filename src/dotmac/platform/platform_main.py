"""
Platform Service Entrypoint.

Standalone entrypoint for the Platform (control-plane) service.
Mounts only platform routes at /api/platform/v1.

Usage:
    uvicorn dotmac.platform.platform_main:app --host 0.0.0.0 --port 8000
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

from dotmac.platform.api.app_boundary_middleware import AppBoundaryMiddleware
from dotmac.platform.audit import AuditContextMiddleware
from dotmac.platform.core.exception_handlers import register_exception_handlers
from dotmac.platform.core.rate_limiting import get_limiter
from dotmac.platform.core.request_context import RequestContextMiddleware
from dotmac.platform.db import init_db
from dotmac.platform.monitoring.error_middleware import (
    ErrorTrackingMiddleware,
    RequestMetricsMiddleware,
)
from dotmac.platform.monitoring.health_checks import HealthChecker
from dotmac.platform.redis_client import init_redis, shutdown_redis
from dotmac.platform.settings import settings
from dotmac.platform.telemetry import setup_telemetry
from dotmac.shared.routers import ServiceScope, register_routers_for_scope

logger = structlog.get_logger(__name__)


def rate_limit_handler(request: Request, exc: Exception) -> Response:
    """Handle rate limit exceeded exceptions with proper typing."""
    # Cast to RateLimitExceeded since we know it will be that type when called
    return _rate_limit_exceeded_handler(request, exc)  # type: ignore[arg-type]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Platform service lifecycle management."""
    logger.info("platform_service.starting", version=settings.app_version)

    # Initialize infrastructure
    await init_redis()
    await init_db()

    # Setup telemetry
    setup_telemetry(app)

    logger.info("platform_service.started")
    yield

    # Cleanup
    logger.info("platform_service.stopping")
    await shutdown_redis()
    logger.info("platform_service.stopped")


def create_platform_service() -> FastAPI:
    """
    Create the Platform (control-plane) service.

    This is a standalone service that handles:
    - Tenant provisioning and management
    - Platform licensing and billing
    - Platform observability and monitoring
    - Cross-tenant analytics and reporting

    Returns:
        FastAPI application instance
    """
    app = FastAPI(
        title="DotMac Platform Service",
        description="Platform administration and control-plane operations",
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

    # Register CONTROLPLANE + SHARED routers at /api/platform/v1
    logger.info("platform_service.registering_routers")
    registered, failed = register_routers_for_scope(
        app,
        scope=ServiceScope.CONTROLPLANE,
        include_shared=True,
        prefix="/api/platform/v1",
    )
    logger.info(
        "platform_service.routers_registered",
        registered=registered,
        failed=failed,
    )

    # Health endpoints at root
    @app.get("/health")
    async def health_check() -> dict[str, Any]:
        """Health check endpoint."""
        return {
            "status": "healthy",
            "service": "platform",
            "version": settings.app_version,
        }

    @app.get("/health/live")
    async def liveness_check() -> dict[str, Any]:
        """Liveness check for Kubernetes."""
        return {
            "status": "alive",
            "service": "platform",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    @app.get("/health/ready")
    async def readiness_check() -> dict[str, Any]:
        """Readiness check for Kubernetes."""
        checker = HealthChecker()
        summary = checker.get_summary()
        return {
            "status": "ready" if summary["healthy"] else "not ready",
            "service": "platform",
            "healthy": summary["healthy"],
            "services": summary["services"],
        }

    return app


# Application instance for uvicorn
app = create_platform_service()
