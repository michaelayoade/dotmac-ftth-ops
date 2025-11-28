"""
ISP Operations FastAPI Application (Tenant App).

This app handles all ISP-specific operations for a tenant including:
- Customer and subscriber management
- Network operations (RADIUS, NetBox, GenieACS, VOLTHA)
- Billing and revenue management
- Service lifecycle and provisioning
- Support ticketing
- Partner management

Routes: /api/isp/v1/* (previously /api/tenant/v1/*)
Required Scopes: isp_admin:*, network:*, billing:*, customer:*, etc.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI

from dotmac.platform.settings import settings
from dotmac.shared.routers import ServiceScope, register_routers_for_scope

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Tenant app lifecycle management."""
    logger.info(
        "tenant_app.startup",
        deployment_mode=settings.DEPLOYMENT_MODE,
    )

    yield

    logger.info("tenant_app.shutdown")


def create_tenant_app() -> FastAPI:
    """
    Create the ISP Operations FastAPI application (Tenant App).

    This app handles all ISP-specific operations:
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
        title="DotMac ISP Operations",
        description="ISP operations and management for multi-tenant platform",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # Register ISP routers from the declarative registry
    # This includes shared routers by default
    logger.info(
        "tenant_app.registering_routers",
        scope=ServiceScope.ISP.value,
        deployment_mode=settings.DEPLOYMENT_MODE,
    )

    registered_count, failed_count = register_routers_for_scope(
        app,
        scope=ServiceScope.ISP,
        include_shared=True,
        default_base_prefix="/admin",
    )

    logger.info(
        "tenant_app.registration_complete",
        registered=registered_count,
        failed=failed_count,
    )

    # Health check
    @app.get("/health")
    async def health_check() -> dict[str, Any]:
        """ISP app health check."""
        return {
            "status": "healthy",
            "app": "isp",
            "version": settings.app_version,
        }

    return app


# Create the tenant app instance
tenant_app = create_tenant_app()
