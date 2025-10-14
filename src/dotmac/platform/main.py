"""
Main FastAPI application entry point for DotMac Platform Services.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import Response

from dotmac.platform.audit import AuditContextMiddleware
from dotmac.platform.auth.exceptions import AuthError, get_http_status
from dotmac.platform.core.rate_limiting import get_limiter
from dotmac.platform.db import AsyncSessionLocal, init_db
from dotmac.platform.auth.isp_permissions import ensure_isp_rbac
from dotmac.platform.monitoring.health_checks import HealthChecker, ensure_infrastructure_running
from dotmac.platform.routers import get_api_info, register_routers
from dotmac.platform.secrets import load_secrets_from_vault_sync
from dotmac.platform.settings import settings
from dotmac.platform.telemetry import setup_telemetry
from dotmac.platform.tenant import TenantMiddleware


def rate_limit_handler(request: Request, exc: Exception) -> Response:
    """Handle rate limit exceeded exceptions with proper typing."""
    # Cast to RateLimitExceeded since we know it will be that type when called
    return _rate_limit_exceeded_handler(request, exc)  # type: ignore


def auth_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle authentication/authorization errors with proper status codes."""
    if not isinstance(exc, AuthError):  # Defensive - FastAPI should only call for AuthError
        raise exc
    status_code = get_http_status(exc)
    return JSONResponse(
        status_code=status_code,
        content=exc.to_dict(),
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifecycle events."""
    # SECURITY: Validate production security settings before anything else
    try:
        settings.validate_production_security()
    except ValueError as e:
        # Setup basic logging to capture security validation failure
        import structlog
        logger = structlog.get_logger(__name__)
        logger.critical("security.validation.failed", error=str(e), environment=settings.environment)
        raise RuntimeError(str(e)) from e

    # Setup telemetry first to enable structured logging
    setup_telemetry(app)

    # Get structured logger after telemetry setup
    import structlog

    logger = structlog.get_logger(__name__)

    # Structured startup event
    logger.info(
        "service.startup.begin",
        service="dotmac-platform",
        version=settings.app_version,
        environment=settings.environment,
    )

    # Check service dependencies with structured logging
    checker = HealthChecker()
    all_healthy, checks = checker.run_all_checks()

    # Log each dependency check as structured events
    for check in checks:
        logger.info(
            "service.dependency.check",
            dependency=check.name,
            status=check.status.value,
            healthy=check.is_healthy,
            required=check.required,
            message=check.message,
        )

    # Summary with structured logging for deployment visibility
    logger.info(
        "service.startup.services_check",
        version=settings.app_version,
        all_healthy=all_healthy,
        emoji="🚀"
    )

    failed_services = [c.name for c in checks if c.required and not c.is_healthy]
    if failed_services:
        logger.error(
            "service.startup.required_services_unavailable",
            failed_services=failed_services,
            emoji="❌"
        )
    elif not all_healthy:
        optional_failed = [c.name for c in checks if not c.required and not c.is_healthy]
        logger.warning(
            "service.startup.optional_services_unavailable",
            optional_failed_services=optional_failed,
            emoji="⚠️"
        )
    else:
        logger.info("service.startup.all_services_healthy", emoji="✅")

    # Fail fast in production if required services are missing
    if not all_healthy:
        if failed_services and settings.environment == "production":
            logger.error(
                "service.startup.failed",
                failed_services=failed_services,
                environment=settings.environment,
            )
            raise RuntimeError(f"Required services unavailable: {failed_services}")
        else:
            logger.warning(
                "service.startup.degraded",
                optional_failed_services=[
                    c.name for c in checks if not c.required and not c.is_healthy
                ],
            )

    # Load secrets from Vault/OpenBao if configured
    try:
        load_secrets_from_vault_sync()
        logger.info("secrets.load.success", source="vault", emoji="✅")
    except Exception as e:
        logger.warning("secrets.load.failed", source="vault", error=str(e), emoji="⚠️")
        # Continue with default values in development, fail in production
        if settings.environment == "production":
            logger.error("secrets.load.production_failure", error=str(e))
            raise

    # Initialize database
    try:
        init_db()
        logger.info("database.init.success", emoji="✅")
    except Exception as e:
        logger.error("database.init.failed", error=str(e), emoji="❌")
        # Continue in development, fail in production
        if settings.environment == "production":
            raise

    # Seed ISP RBAC permissions/roles after database init
    try:
        async with AsyncSessionLocal() as session:
            await ensure_isp_rbac(session)
        logger.info("rbac.isp_permissions.seeded", emoji="✅")
    except Exception as e:
        logger.error("rbac.isp_permissions.failed", error=str(e), emoji="❌")
        if settings.environment == "production":
            raise

    logger.info("service.startup.complete", healthy=all_healthy, emoji="🎉")

    yield

    # Shutdown with structured logging
    logger.info("service.shutdown.begin", emoji="👋")

    # Cleanup resources here if needed

    logger.info("service.shutdown.complete", emoji="✅")


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    # Create FastAPI app
    app = FastAPI(
        title="DotMac Platform Services",
        description="Unified platform services providing auth, secrets, and observability",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
    )

    # Add GZip compression
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Add tenant middleware BEFORE audit middleware
    # This ensures tenant context is set before audit logs are created
    app.add_middleware(TenantMiddleware)

    # Add audit context middleware for user tracking
    app.add_middleware(AuditContextMiddleware)

    # Configure CORS last so it wraps responses generated by upstream middleware.
    if settings.cors.enabled:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors.origins,
            allow_credentials=settings.cors.credentials,
            allow_methods=settings.cors.methods,
            allow_headers=settings.cors.headers,
            max_age=settings.cors.max_age,
        )

    # Add rate limiting support
    app.state.limiter = get_limiter()
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

    # Add auth error handler for proper status codes (401 for auth, 403 for authz)
    app.add_exception_handler(AuthError, auth_error_handler)

    # Register all API routers
    register_routers(app)

    # Health check endpoint (public - no auth required)
    @app.get("/health")
    async def health_check() -> dict[str, Any]:
        """Health check endpoint for monitoring."""
        return {
            "status": "healthy",
            "version": settings.app_version,
            "environment": settings.environment,
        }

    # Liveness check endpoint (public - no auth required)
    @app.get("/health/live")
    async def liveness_check() -> dict[str, Any]:
        """Liveness check endpoint for Kubernetes."""
        return {
            "status": "alive",
            "version": settings.app_version,
            "environment": settings.environment,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    # Readiness check endpoint (public - no auth required)
    @app.get("/health/ready")
    async def readiness_check() -> dict[str, Any]:
        """Readiness check endpoint for Kubernetes."""
        checker = HealthChecker()
        summary = checker.get_summary()

        return {
            "status": "ready" if summary["healthy"] else "not ready",
            "healthy": summary["healthy"],
            "services": summary["services"],
            "failed_services": summary["failed_services"],
            "timestamp": datetime.now(UTC).isoformat(),
        }

    # Keep /ready for backwards compatibility
    @app.get("/ready")
    async def ready_check() -> dict[str, Any]:
        """Readiness check endpoint (deprecated, use /health/ready)."""
        return await readiness_check()

    # API info endpoint (public - shows available endpoints)
    @app.get("/api")
    async def api_info() -> dict[str, Any]:
        """API info endpoint (root)."""
        api_info_payload: dict[str, Any] = get_api_info()
        return api_info_payload

    @app.get("/api/v1/info")
    async def api_v1_info() -> dict[str, Any]:
        """API info endpoint with versioned prefix for compatibility."""
        api_info_payload: dict[str, Any] = get_api_info()
        return api_info_payload

    # Metrics endpoint (if metrics enabled)
    if settings.observability.enable_metrics:
        from prometheus_client import make_asgi_app

        metrics_app = make_asgi_app()
        app.mount("/metrics", metrics_app)

    return app


# Create application instance
app = create_application()


# For development server
if __name__ == "__main__":
    import uvicorn

    # Show infrastructure requirements
    ensure_infrastructure_running()

    uvicorn.run(
        "dotmac.platform.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
        log_level=settings.observability.log_level.value.lower(),
    )
