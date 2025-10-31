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
from fastapi import Depends, FastAPI
from fastapi.security import HTTPBearer

from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

# Security scheme
security = HTTPBearer(auto_error=True)


# Platform router configurations
PLATFORM_ROUTER_CONFIGS = [
    # Platform Administration
    {
        "module_path": "dotmac.platform.auth.platform_admin_router",
        "router_name": "router",
        "prefix": "/admin",  # Will become /api/platform/v1/admin
        "tags": ["Platform - Admin"],
        "description": "Cross-tenant platform administration",
    },
    # Tenant Management
    {
        "module_path": "dotmac.platform.tenant.router",
        "router_name": "router",
        "prefix": "",  # Module has /tenant prefix, will become /api/platform/v1/tenant
        "tags": ["Platform - Tenants"],
        "description": "Tenant provisioning and lifecycle management",
    },
    {
        "module_path": "dotmac.platform.tenant.onboarding_router",
        "router_name": "router",
        "prefix": "",  # Module has /tenants prefix
        "tags": ["Platform - Tenant Onboarding"],
        "description": "Automated tenant onboarding workflows",
    },
    {
        "module_path": "dotmac.platform.tenant.domain_verification_router",
        "router_name": "router",
        "prefix": "",  # Module has /tenants prefix
        "tags": ["Platform - Domain Verification"],
        "description": "Custom domain verification for tenants",
    },
    # Licensing
    {
        "module_path": "dotmac.platform.licensing.router",
        "router_name": "router",
        "prefix": "/licensing",  # Module has /api/licensing, we override to /licensing
        "tags": ["Platform - Licensing"],
        "description": "SaaS licensing and activation management",
    },
    {
        "module_path": "dotmac.platform.licensing.router_framework",
        "router_name": "router",
        "prefix": "/licensing/framework",  # Composable licensing
        "tags": ["Platform - Licensing Framework"],
        "description": "Composable licensing with dynamic plan builder",
    },
    # Platform Settings
    {
        "module_path": "dotmac.platform.admin.settings.router",
        "router_name": "router",
        "prefix": "/admin/settings",  # Module has empty prefix
        "tags": ["Platform - Settings"],
        "description": "Platform-wide settings and configuration",
    },
    # Platform Metrics & Observability
    {
        "module_path": "dotmac.platform.monitoring.traces_router",
        "router_name": "traces_router",
        "prefix": "",  # Module has /observability prefix
        "tags": ["Platform - Observability"],
        "description": "Platform-wide observability and traces",
    },
    {
        "module_path": "dotmac.platform.monitoring.logs_router",
        "router_name": "logs_router",
        "prefix": "",  # Module has /monitoring prefix
        "tags": ["Platform - Monitoring"],
        "description": "Platform-wide log aggregation",
    },
    # Platform Audit
    {
        "module_path": "dotmac.platform.audit.router",
        "router_name": "router",
        "prefix": "",  # Module has /audit prefix
        "tags": ["Platform - Audit"],
        "description": "Platform-wide audit trail",
    },
    # Platform Analytics
    {
        "module_path": "dotmac.platform.analytics.router",
        "router_name": "analytics_router",
        "prefix": "",  # Module has /analytics prefix
        "tags": ["Platform - Analytics"],
        "description": "Platform-wide analytics and insights",
    },
    # Deployment Orchestration
    {
        "module_path": "dotmac.platform.deployment.router",
        "router_name": "router",
        "prefix": "",  # Module has /deployments prefix
        "tags": ["Platform - Deployments"],
        "description": "Multi-tenant deployment orchestration",
    },
]


def _register_router(app: FastAPI, config: dict) -> bool:
    """Register a single router with the platform app."""
    try:
        import importlib

        module = importlib.import_module(config["module_path"])
        router = getattr(module, config["router_name"])

        # All platform routes require auth
        dependencies = [Depends(security)]

        app.include_router(
            router,
            prefix=config["prefix"],
            tags=config.get("tags"),
            dependencies=dependencies,
        )

        logger.info(
            f"✅ {config['description']} registered",
            prefix=config["prefix"],
            module=config["module_path"],
        )
        return True

    except ImportError as e:
        logger.warning(f"⚠️  {config['description']} not available: {e}")
        return False
    except AttributeError as e:
        logger.error(
            f"❌ Router '{config['router_name']}' not found in {config['module_path']}: {e}"
        )
        return False
    except Exception as e:
        logger.error(f"❌ Failed to register {config['description']}: {e}")
        return False


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

    # Register platform routers
    registered_count = 0
    failed_count = 0

    logger.info(
        f"Registering {len(PLATFORM_ROUTER_CONFIGS)} platform routers",
        deployment_mode=settings.DEPLOYMENT_MODE,
    )

    for config in PLATFORM_ROUTER_CONFIGS:
        if _register_router(app, config):
            registered_count += 1
        else:
            failed_count += 1

    logger.info(
        "\n" + "=" * 60 + "\n"
        f"🚀 Platform App Registration Complete\n"
        f"   ✅ Registered: {registered_count} routers\n"
        f"   ⚠️  Skipped: {failed_count} routers\n" + "=" * 60
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
