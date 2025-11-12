"""
Main FastAPI application entry point for DotMac Platform Services.
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import Response

from dotmac.platform.api.app_boundary_middleware import (
    AppBoundaryMiddleware,
    SingleTenantMiddleware,
)
from dotmac.platform.audit import AuditContextMiddleware
from dotmac.platform.auth.billing_permissions import ensure_billing_rbac
from dotmac.platform.auth.bootstrap import ensure_default_admin_user
from dotmac.platform.auth.exceptions import AuthError, get_http_status
from dotmac.platform.auth.field_service_permissions import ensure_field_service_rbac
from dotmac.platform.auth.isp_permissions import ensure_isp_rbac
from dotmac.platform.auth.partner_permissions import ensure_partner_rbac
from dotmac.platform.core.exception_handlers import register_exception_handlers
from dotmac.platform.core.rate_limiting import get_limiter
from dotmac.platform.core.request_context import RequestContextMiddleware, configure_context_logging
from dotmac.platform.core.rls_middleware import RLSMiddleware
from dotmac.platform.db import AsyncSessionLocal, init_db
from dotmac.platform.infrastructure_health import run_startup_health_checks
from dotmac.platform.monitoring.error_middleware import (
    ErrorTrackingMiddleware,
    RequestMetricsMiddleware,
)
from dotmac.platform.monitoring.health_checks import HealthChecker, ensure_infrastructure_running
from dotmac.platform.platform_app import platform_app
from dotmac.platform.redis_client import init_redis, redis_manager, shutdown_redis
from dotmac.platform.routers import get_api_info, register_routers
from dotmac.platform.secrets import load_secrets_from_vault_sync
from dotmac.platform.settings import settings
from dotmac.platform.telemetry import setup_telemetry
from dotmac.platform.tenant import TenantMiddleware
from dotmac.platform.tenant_app import tenant_app
from dotmac.platform.timeseries import init_timescaledb, shutdown_timescaledb


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
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Manage application lifecycle events."""
    import structlog

    logger = structlog.get_logger(__name__)
    print("DotMac Platform Services starting...")

    # Load secrets from Vault/OpenBao before security validation so production checks
    # evaluate the final configuration rather than placeholder defaults.
    try:
        load_secrets_from_vault_sync()
        logger.info("secrets.load.success", source="vault", emoji="✅")
    except Exception as e:
        logger.warning("secrets.load.failed", source="vault", error=str(e), emoji="⚠️")
        if settings.is_production:
            logger.error("secrets.load.production_failure", error=str(e))
            raise RuntimeError(f"Vault secrets initialization failed: {e}") from e
        print(f"Using default secrets (Vault unavailable: {e})")

    # SECURITY: Validate production security settings after secrets are loaded
    try:
        settings.validate_production_security()
    except ValueError as e:
        logger.critical(
            "security.validation.failed", error=str(e), environment=settings.environment
        )
        raise RuntimeError(str(e)) from e

    # Get structured logger (telemetry configured during app creation)
    logger = structlog.get_logger(__name__)

    # Configure request context logging (adds correlation IDs to all logs)
    configure_context_logging()
    logger.info("request_context.logging.configured", emoji="✅")

    # Ensure telemetry is configured (lifespan may be used outside create_application)
    try:
        telemetry_configured = bool(getattr(app.state, "telemetry_configured", False))
    except AttributeError:
        telemetry_configured = False

    if not telemetry_configured:
        setup_telemetry(app)
        if hasattr(app, "state"):
            app.state.telemetry_configured = True

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
        emoji="🚀",
    )

    failed_services = [c.name for c in checks if c.required and not c.is_healthy]
    if failed_services:
        logger.error(
            "service.startup.required_services_unavailable",
            failed_services=failed_services,
            emoji="❌",
        )
        print(f"Required services unavailable: {', '.join(failed_services)}")
    elif not all_healthy:
        optional_failed = [c.name for c in checks if not c.required and not c.is_healthy]
        logger.warning(
            "service.startup.optional_services_unavailable",
            optional_failed_services=optional_failed,
            emoji="⚠️",
        )
        print(f"Optional services unavailable: {', '.join(optional_failed)}")
    else:
        logger.info("service.startup.all_services_healthy", emoji="✅")
        print("All services healthy")

    # Fail fast in production if required services are missing
    if not all_healthy:
        if failed_services and settings.is_production:
            logger.error(
                "service.startup.failed",
                failed_services=failed_services,
                environment=settings.environment,
            )
            print("Startup failed due to required service outage")
            raise RuntimeError(f"Required services unavailable: {failed_services}")
        else:
            logger.warning(
                "service.startup.degraded",
                optional_failed_services=[
                    c.name for c in checks if not c.required and not c.is_healthy
                ],
            )
            print("Running in degraded mode")

    # Run comprehensive infrastructure health checks (Docker containers)
    try:
        # Check ISP services if ISP mode is enabled (optional)
        include_isp_services = os.getenv("CHECK_ISP_SERVICES", "false").lower() == "true"

        await run_startup_health_checks(
            fail_on_unhealthy=False,  # Don't fail startup, just report
            include_isp_services=include_isp_services,
        )
    except Exception as e:
        logger.warning(
            "infrastructure.health_check.failed",
            error=str(e),
            emoji="⚠️",
        )
        print(f"Infrastructure health check failed: {e}")

    # Initialize database
    try:
        init_db()
        logger.info("database.init.success", emoji="✅")
        print("Database initialized")
    except Exception as e:
        logger.error("database.init.failed", error=str(e), emoji="❌")
        # Continue in development, fail in production
        if settings.is_production:
            raise
        print(f"Database initialization failed: {e}")

    # Initialize Redis
    try:
        await init_redis()
        logger.info("redis.init.success", emoji="✅")
        print("Redis initialized")
    except Exception as e:
        logger.error("redis.init.failed", error=str(e), emoji="❌")
        print(f"Redis initialization failed: {e}")
        raise

    # Initialize TimescaleDB (optional time-series database)
    if settings.timescaledb.is_configured:
        try:
            init_timescaledb()
            logger.info("timescaledb.init.success", emoji="✅")
            print("TimescaleDB initialized")
        except Exception as e:
            logger.error("timescaledb.init.failed", error=str(e), emoji="❌")
            # Continue in development, fail in production
            if settings.is_production:
                raise
            print(f"TimescaleDB initialization failed: {e}")

    # Seed RBAC permissions/roles after database init
    try:
        async with AsyncSessionLocal() as session:
            await ensure_isp_rbac(session)
            logger.info("rbac.isp_permissions.seeded", emoji="✅")
            await ensure_billing_rbac(session)
            logger.info("rbac.billing_permissions.seeded", emoji="✅")
            await ensure_partner_rbac(session)
            logger.info("rbac.partner_permissions.seeded", emoji="✅")
            await ensure_field_service_rbac(session)
            logger.info("rbac.field_service_permissions.seeded", emoji="✅")
    except Exception as e:
        logger.error("rbac.permissions.failed", error=str(e), emoji="❌")
        if settings.is_production:
            raise

    # Provision development admin user
    try:
        await ensure_default_admin_user()
        logger.info("auth.default_admin.ready", emoji="🛠️")
    except Exception as e:
        logger.warning("auth.default_admin.failed", error=str(e), emoji="⚠️")

    logger.info("service.startup.complete", healthy=all_healthy, emoji="🎉")
    print("Startup complete")

    yield

    # Shutdown with structured logging
    logger.info("service.shutdown.begin", emoji="👋")
    print("Shutting down")

    # Cleanup Redis connections
    try:
        await shutdown_redis()
        logger.info("redis.shutdown.success", emoji="✅")
    except Exception as e:
        logger.error("redis.shutdown.failed", error=str(e), emoji="❌")

    # Cleanup TimescaleDB connections
    if settings.timescaledb.is_configured:
        try:
            await shutdown_timescaledb()
            logger.info("timescaledb.shutdown.success", emoji="✅")
        except Exception as e:
            logger.error("timescaledb.shutdown.failed", error=str(e), emoji="❌")

    logger.info("service.shutdown.complete", emoji="✅")


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    # Create FastAPI app
    app = FastAPI(
        title="DotMac Platform Services",
        description="Unified platform services providing auth, secrets, and observability",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # Configure telemetry early so middleware instrumentation happens before startup events.
    disable_telemetry = os.getenv("PYTEST_DOTMAC_PLATFORM") == "1"
    if (
        not disable_telemetry
        and settings.observability.enable_tracing
        and settings.observability.otel_enabled
    ):
        setup_telemetry(app)
        try:
            app.state.telemetry_configured = True
        except AttributeError:
            pass

    # Get logger after telemetry is configured
    logger = structlog.get_logger(__name__)

    # Add GZip compression
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Enforce trusted host validation (defaults to wildcard in development)
    allowed_hosts = settings.trusted_hosts if settings.trusted_hosts else ["*"]
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

    # Add request context middleware VERY early in the chain
    # This generates correlation IDs and manages request-scoped context
    app.add_middleware(RequestContextMiddleware, enable_logging=True)

    # Add error tracking middleware (should be early in the chain)
    # Tracks HTTP errors and exceptions in Prometheus
    if settings.observability.enable_metrics:
        app.add_middleware(ErrorTrackingMiddleware)
        app.add_middleware(RequestMetricsMiddleware)

    # Add tenant middleware BEFORE other middleware
    # This ensures tenant context is set before boundary checks
    app.add_middleware(TenantMiddleware)

    # Add Row-Level Security middleware RIGHT AFTER tenant context is set
    # This enforces tenant data isolation at the database level
    app.add_middleware(RLSMiddleware)

    # Add single-tenant middleware if in single-tenant mode
    # This automatically sets fixed tenant_id from config
    if settings.DEPLOYMENT_MODE == "single_tenant":
        app.add_middleware(SingleTenantMiddleware)

    # Add audit context middleware before boundary enforcement so user context is available
    app.add_middleware(AuditContextMiddleware)

    # Add app boundary middleware to enforce platform/tenant route separation
    app.add_middleware(AppBoundaryMiddleware)

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

    # Register comprehensive exception handlers
    # This includes generic catch-all handler, DotMacError handler, validation handler, etc.
    register_exception_handlers(app)
    logger.info("exception_handlers.registered", emoji="✅")

    # Register shared routers (auth, webhooks, etc.) before mounting tenant apps so
    # single-tenant deployments retain access to shared endpoints under /api/v1.
    # NOTE: For Phase 2, we're keeping the old router registration for shared routes.
    # This will be refactored in Phase 3.
    register_routers(app)

    # Mount sub-applications based on deployment mode
    logger.info(
        "mounting_applications",
        deployment_mode=settings.DEPLOYMENT_MODE,
        enable_platform_routes=settings.ENABLE_PLATFORM_ROUTES,
    )

    if settings.DEPLOYMENT_MODE == "single_tenant":
        # Single-tenant mode: Only mount tenant app (no platform routes)
        logger.info("single_tenant_mode.mounting_tenant_app_only")
        app.mount("/api/v1", tenant_app)  # Mount at /api/v1 for backward compatibility

    elif settings.DEPLOYMENT_MODE == "hybrid":
        # Hybrid mode: Could be control plane OR tenant instance
        # Control plane: platform app only
        # Tenant instance: tenant app only
        # Determined by ENABLE_PLATFORM_ROUTES setting
        if settings.ENABLE_PLATFORM_ROUTES:
            logger.info("hybrid_mode.control_plane.mounting_platform_app")
            app.mount("/api/platform/v1", platform_app)
        else:
            logger.info("hybrid_mode.tenant_instance.mounting_tenant_app")
            app.mount("/api/tenant/v1", tenant_app)

    else:  # multi_tenant (default)
        # Multi-tenant SaaS mode: Mount both apps
        logger.info("multi_tenant_mode.mounting_both_apps")
        app.mount("/api/platform/v1", platform_app)
        app.mount("/api/tenant/v1", tenant_app)

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

    @app.get("/health/redis")
    async def redis_health() -> dict[str, Any]:
        """Report Redis connection status."""
        try:
            status = await redis_manager.health_check()
        except RuntimeError as exc:
            status = {
                "status": "unhealthy",
                "message": str(exc),
            }
        status["timestamp"] = datetime.now(UTC).isoformat()
        return status

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
        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, make_asgi_app

        metrics_app = make_asgi_app()
        app.mount("/metrics/", metrics_app)

        @app.get("/metrics", include_in_schema=False)
        async def metrics_root() -> Response:
            """Serve Prometheus metrics without redirect."""
            return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

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
        reload=settings.is_development,
        log_level=settings.observability.log_level.lower(),
    )
