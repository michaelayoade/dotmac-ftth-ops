"""
Platform Administration FastAPI Application.

This app handles cross-tenant platform operations including:
- Tenant provisioning and management
- Platform-level licensing and billing
- Support and observability
- Platform metrics and analytics

Routes: /api/platform/v1/*
Required Scopes: platform:*, platform_super_admin, platform_support, etc.
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
    """Platform app lifecycle management."""
    logger.info(
        "platform_app.startup",
        deployment_mode=settings.DEPLOYMENT_MODE,
    )

    yield

    logger.info("platform_app.shutdown")


def create_platform_app() -> FastAPI:
    """
    Create the Platform Administration FastAPI application.

    This app handles all platform-level operations:
    - Tenant provisioning and management
    - Platform licensing and billing
    - Platform observability and monitoring
    - Cross-tenant analytics and reporting

    Returns:
        FastAPI application instance
    """
    app = FastAPI(
        title="DotMac Platform Administration",
        description="Platform-level operations for multi-tenant ISP management",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # Register CONTROLPLANE routers from the declarative registry
    # This includes shared routers by default
    logger.info(
        "platform_app.registering_routers",
        scope=ServiceScope.CONTROLPLANE.value,
        deployment_mode=settings.DEPLOYMENT_MODE,
    )

    registered_count, failed_count = register_routers_for_scope(
        app,
        scope=ServiceScope.CONTROLPLANE,
        include_shared=True,
        default_base_prefix="/admin",
    )

    logger.info(
        "platform_app.registration_complete",
        registered=registered_count,
        failed=failed_count,
    )

    # Health check
    @app.get("/health")
    async def health_check() -> dict[str, Any]:
        """Platform app health check."""
        return {
            "status": "healthy",
            "app": "platform",
            "version": settings.app_version,
        }

    return app


# Create the platform app instance
platform_app = create_platform_app()
