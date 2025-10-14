"""
Centralized router registration for all API endpoints.

All routes except /health, /ready, and /metrics require authentication.
"""

import importlib
from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Any, cast

import structlog
from fastapi import Depends, FastAPI
from fastapi.security import HTTPBearer

from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

# Security scheme for Swagger UI
security = HTTPBearer(auto_error=True)


@dataclass
class RouterConfig:
    """Configuration for a router to be registered."""

    module_path: str
    router_name: str
    prefix: str
    tags: Sequence[str | Enum] | None
    requires_auth: bool = True
    description: str = ""


# Define router configurations
ROUTER_CONFIGS = [
    RouterConfig(
        module_path="dotmac.platform.auth.router",
        router_name="auth_router",
        prefix="/api/v1/auth",
        tags=["Authentication"],
        requires_auth=False,  # Auth router doesn't require auth
        description="Authentication endpoints",
    ),
    RouterConfig(
        module_path="dotmac.platform.auth.rbac_read_router",
        router_name="router",
        prefix="/api/v1/auth/rbac",
        tags=["RBAC"],
        requires_auth=True,
        description="RBAC read-only endpoints for frontend",
    ),
    RouterConfig(
        module_path="dotmac.platform.auth.platform_admin_router",
        router_name="router",
        prefix="/api/v1/admin/platform",
        tags=["Platform Administration"],
        requires_auth=True,  # Uses require_platform_admin internally
        description="Cross-tenant platform administration (super admin only)",
    ),
    RouterConfig(
        module_path="dotmac.platform.secrets.api",
        router_name="router",
        prefix="/api/v1/secrets",
        tags=["Secrets Management"],
        description="Vault/OpenBao secrets management",
    ),
    RouterConfig(
        module_path="dotmac.platform.analytics.router",
        router_name="analytics_router",
        prefix="/api/v1/analytics",
        tags=["Analytics"],
        description="Analytics and metrics endpoints",
    ),
    RouterConfig(
        module_path="dotmac.platform.file_storage.router",
        router_name="file_storage_router",
        prefix="/api/v1/files/storage",
        tags=["File Storage"],
        description="File storage management",
    ),
    RouterConfig(
        module_path="dotmac.platform.communications.router",
        router_name="router",
        prefix="/api/v1/communications",
        tags=["Communications"],
        description="Communications API with email, templates, and background tasks",
    ),
    RouterConfig(
        module_path="dotmac.platform.search.router",
        router_name="search_router",
        prefix="/api/v1/search",
        tags=["Search"],
        description="Search functionality",
    ),
    RouterConfig(
        module_path="dotmac.platform.data_transfer.router",
        router_name="data_transfer_router",
        prefix="/api/v1/data-transfer",
        tags=["Data Transfer"],
        description="Data import/export operations",
    ),
    RouterConfig(
        module_path="dotmac.platform.data_import.router",
        router_name="router",
        prefix="/api/v1/data-import",
        tags=["Data Import"],
        description="File-based data import operations (CSV, JSON)",
    ),
    RouterConfig(
        module_path="dotmac.platform.user_management.router",
        router_name="user_router",
        prefix="/api/v1/users",
        tags=["User Management"],
        description="User management endpoints",
    ),
    RouterConfig(
        module_path="dotmac.platform.user_management.team_router",
        router_name="router",
        prefix="/api/v1/teams",
        tags=["Team Management"],
        description="Team and team member management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.router",
        router_name="router",
        prefix="/api/v1/tenants",
        tags=["Tenant Management"],
        description="Multi-tenant organization management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.onboarding_router",
        router_name="router",
        prefix="/api/v1/tenants",
        tags=["Tenant Onboarding"],
        description="Tenant onboarding automation",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.domain_verification_router",
        router_name="router",
        prefix="/api/v1/tenants",
        tags=["Tenant - Domain Verification"],
        description="Custom domain verification for tenants",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.usage_billing_router",
        router_name="router",
        prefix="/api/v1/usage",
        tags=["Tenant Usage Billing"],
        description="Usage tracking and billing integration",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.oss_router",
        router_name="router",
        prefix="/api/v1/tenant/oss",
        tags=["Tenant OSS"],
        description="Tenant-specific OSS integration configuration",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.feature_flags.router",
        router_name="feature_flags_router",
        prefix="/api/v1/feature-flags",
        tags=["Feature Flags"],
        description="Feature flags management",
    ),
    RouterConfig(
        module_path="dotmac.platform.customer_management.router",
        router_name="router",
        prefix="/api/v1/customers",
        tags=["Customer Management"],
        description="Customer relationship management",
    ),
    RouterConfig(
        module_path="dotmac.platform.contacts.router",
        router_name="router",
        prefix="/api/v1/contacts",
        tags=["Contacts"],
        description="Contact management system",
    ),
    RouterConfig(
        module_path="dotmac.platform.auth.api_keys_router",
        router_name="router",
        prefix="/api/v1/auth/api-keys",
        tags=["API Keys"],
        description="API key management",
    ),
    RouterConfig(
        module_path="dotmac.platform.webhooks.router",
        router_name="router",
        prefix="/api/v1/webhooks",
        tags=["Webhooks"],
        description="Generic webhook subscription and event management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.router",
        router_name="router",
        prefix="/api/v1/billing",
        tags=["Billing"],
        description="Billing and payment management",
    ),
    RouterConfig(
        module_path="dotmac.platform.plugins.router",
        router_name="router",
        prefix="/api/v1/plugins",
        tags=["Plugin Management"],
        description="Dynamic plugin system management",
    ),
    RouterConfig(
        module_path="dotmac.platform.audit.router",
        router_name="router",
        prefix="/api/v1/audit",
        tags=["Audit"],
        description="Audit trails and activity tracking",
    ),
    RouterConfig(
        module_path="dotmac.platform.metrics.router",
        router_name="router",
        prefix="/api/v1/metrics",
        tags=["Metrics"],
        description="ISP metrics and KPIs with caching",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.realtime.router",
        router_name="router",
        prefix="/api/v1/realtime",
        tags=["Real-Time"],
        description="Real-time updates via SSE and WebSocket",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.jobs.router",
        router_name="router",
        prefix="/api/v1/jobs",
        tags=["Jobs"],
        description="Async job tracking and management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.jobs.scheduler_router",
        router_name="router",
        prefix="/api/v1/jobs/scheduler",
        tags=["Job Scheduler"],
        description="Scheduled jobs and job chain management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.admin.settings.router",
        router_name="router",
        prefix="/api/v1/admin/settings",
        tags=["Admin - Settings"],
        description="Platform settings management (admin only)",
        requires_auth=True,  # Uses require_admin internally
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.catalog.router",
        router_name="router",
        prefix="/api/v1/billing/catalog",
        tags=["Billing - Catalog"],
        description="Product catalog management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.subscriptions.router",
        router_name="router",
        prefix="/api/v1/billing/subscriptions",
        tags=["Billing - Subscriptions"],
        description="Subscription management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.pricing.router",
        router_name="router",
        prefix="/api/v1/billing/pricing",
        tags=["Billing - Pricing"],
        description="Pricing engine and rules",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.bank_accounts.router",
        router_name="router",
        prefix="/api/v1/billing/bank-accounts",
        tags=["Billing - Bank Accounts"],
        description="Bank accounts and manual payments",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.settings.router",
        router_name="router",
        prefix="/api/v1/billing/settings",
        tags=["Billing - Settings"],
        description="Billing configuration and settings",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.reconciliation_router",
        router_name="router",
        prefix="/api/v1/billing/reconciliations",
        tags=["Billing - Reconciliation"],
        description="Payment reconciliation and recovery",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.dunning.router",
        router_name="router",
        prefix="/api/v1/billing/dunning",
        tags=["Billing - Dunning"],
        description="Dunning and collections management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring.logs_router",
        router_name="logs_router",
        prefix="/api/v1/monitoring",
        tags=["Monitoring - Logs"],
        description="Application logs with filtering and search",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring.traces_router",
        router_name="traces_router",
        prefix="/api/v1/observability",
        tags=["Observability - Traces"],
        description="Distributed traces, metrics, and performance data",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.partner_management.router",
        router_name="router",
        prefix="/api/v1/partners",
        tags=["Partner Management"],
        description="Partner relationship management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.ticketing.router",
        router_name="router",
        prefix="/api/v1/ticketing",
        tags=["Ticketing"],
        description="Cross-organization ticketing workflows",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring_metrics_router",
        router_name="logs_router",
        prefix="/api/v1/logs",
        tags=["Logs"],
        description="Application logs and error monitoring",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring_metrics_router",
        router_name="metrics_router",
        prefix="/api/v1/metrics",
        tags=["Metrics"],
        description="Performance and resource metrics",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["Billing Metrics"],
        description="Billing overview metrics (MRR, ARR, invoices, payments)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.metrics_router",
        router_name="customer_metrics_router",
        prefix="/api/v1",
        tags=["Customer Metrics"],
        description="Customer metrics with growth and churn analysis",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.auth.metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["Auth Metrics"],
        description="Authentication and security metrics (logins, MFA, users)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.communications.metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["Communications Metrics"],
        description="Communication stats (emails, SMS, delivery rates)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.file_storage.metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["File Storage Metrics"],
        description="File storage stats (uploads, storage usage, file types)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.analytics.metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["Analytics Activity"],
        description="Analytics activity stats (events, user activity, API usage)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.auth.api_keys_metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["API Keys Metrics"],
        description="API key metrics (creation, usage, security)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.secrets.metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["Secrets Metrics"],
        description="Secrets metrics (access patterns, security)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring.metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["Monitoring Metrics"],
        description="Monitoring metrics (system health, performance, logs)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.integrations.router",
        router_name="integrations_router",
        prefix="/api/v1/integrations",
        tags=["Integrations"],
        description="External service integrations (Email, SMS, Storage, etc.)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.radius.router",
        router_name="router",
        prefix="/api/v1/radius",
        tags=["RADIUS"],
        description="RADIUS subscriber management and session tracking",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.netbox.router",
        router_name="router",
        prefix="/api/v1/netbox",
        tags=["NetBox"],
        description="NetBox IPAM and DCIM integration",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.genieacs.router",
        router_name="router",
        prefix="/api/v1/genieacs",
        tags=["GenieACS"],
        description="GenieACS CPE management (TR-069/CWMP)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.voltha.router",
        router_name="router",
        prefix="/api/v1/voltha",
        tags=["VOLTHA"],
        description="VOLTHA PON network management (OLT/ONU)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.ansible.router",
        router_name="router",
        prefix="/api/v1/ansible",
        tags=["Ansible"],
        description="Ansible AWX automation workflows",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.crm.router",
        router_name="router",
        prefix="/api/v1/crm",
        tags=["CRM"],
        description="Lead management, quotes, and site surveys",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.services.router",
        router_name="router",
        prefix="/api/v1",
        tags=["Orchestration"],
        description="Service lifecycle orchestration and provisioning workflows",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.notifications.router",
        router_name="router",
        prefix="/api/v1",
        tags=["Notifications"],
        description="User notifications and preferences",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.diagnostics.router",
        router_name="router",
        prefix="/api/v1",
        tags=["Diagnostics"],
        description="Network diagnostics and troubleshooting tools",
        requires_auth=True,
    ),
]


def _register_router(app: FastAPI, config: RouterConfig) -> bool:
    """Register a single router with the application.

    Args:
        app: FastAPI application instance
        config: Router configuration

    Returns:
        True if registration successful, False otherwise.
    """
    try:
        # Dynamically import the module
        module = importlib.import_module(config.module_path)
        router = getattr(module, config.router_name)

        # Add auth dependency if required
        dependencies = [Depends(security)] if config.requires_auth else None

        # Register the router with proper typing
        router_tags = list(config.tags) if config.tags is not None else None

        app.include_router(
            router,
            prefix=config.prefix,
            tags=router_tags,
            dependencies=dependencies,
        )

        tag_label = config.description or (config.tags[0] if config.tags else config.module_path)
        logger.info(f"✅ {tag_label} registered at {config.prefix}")
        return True

    except ImportError as e:
        # Use debug level for optional routers
        if "user_management" in config.module_path:
            logger.debug(f"{config.description} not available: {e}")
        else:
            logger.warning(f"⚠️  {config.description} not available: {e}")
        return False
    except AttributeError as e:
        logger.error(f"❌ Router '{config.router_name}' not found in {config.module_path}: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to register {config.description}: {e}")
        return False


def register_routers(app: FastAPI) -> None:
    """
    Register all API routers with the application.

    Structure:
    - /api/v1/* - REST API endpoints (auth required except /auth)
    - /api/v1/graphql - GraphQL endpoint for analytics and metrics
    - /health, /ready, /metrics - Public health endpoints
    """
    registered_count = 0
    failed_count = 0

    # Register all configured routers
    for config in ROUTER_CONFIGS:
        if _register_router(app, config):
            registered_count += 1
        else:
            failed_count += 1

    # Register GraphQL endpoint for analytics and dashboards
    try:
        from strawberry.fastapi import GraphQLRouter

        from dotmac.platform.graphql.context import Context
        from dotmac.platform.graphql.schema import schema

        # Type-safe context getter
        async def get_context(request: Any) -> Context:
            return await Context.get_context(request)

        graphql_app = GraphQLRouter(
            schema,
            context_getter=cast(Any, get_context),
        )

        app.include_router(
            graphql_app,
            prefix="/api/v1/graphql",
            tags=["GraphQL"],
        )

        logger.info("✅ GraphQL endpoint registered at /api/v1/graphql")
        registered_count += 1
    except ImportError as e:
        logger.warning(f"⚠️  GraphQL endpoint not available: {e}")
        failed_count += 1
    except Exception as e:
        logger.error(f"❌ Failed to register GraphQL endpoint: {e}")
        failed_count += 1

    # Log summary
    logger.info(
        f"\n{'=' * 60}\n"
        f"🚀 Router Registration Complete\n"
        f"   ✅ Registered: {registered_count} routers\n"
        f"   ⚠️  Skipped: {failed_count} routers\n"
        f"{'=' * 60}"
    )


def get_api_info() -> dict[str, Any]:
    """Get information about registered API endpoints.

    Returns:
        Dictionary containing API version, endpoints, and configuration.
    """
    # Build endpoints dict from router configs
    endpoints: dict[str, str | dict[str, str]] = {}
    for config in ROUTER_CONFIGS:
        # Extract endpoint name from prefix
        prefix = config.prefix
        if not prefix.startswith("/api/v1"):
            continue

        trimmed = prefix.replace("/api/v1/", "", 1).lstrip("/")
        if not trimmed:
            continue

        parts = trimmed.split("/")

        if len(parts) == 1:
            endpoints[parts[0]] = prefix
        elif len(parts) >= 2:
            top_key = parts[0]
            nested = endpoints.get(top_key)

            nested_dict: dict[str, str]
            if isinstance(nested, dict):
                nested_dict = nested
            else:
                nested_dict = {}
                if isinstance(nested, str):
                    nested_dict["_self"] = nested

            nested_dict[parts[1]] = prefix
            endpoints[top_key] = nested_dict

    return {
        "version": "v1",
        "base_path": "/api/v1",
        "endpoints": endpoints,
        "graphql_endpoint": "/api/v1/graphql",
        "graphql_playground": "/api/v1/graphql" if settings.environment != "production" else None,
        "public_endpoints": [
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/auth/login",  # Login doesn't require auth
            "/api/v1/auth/register",  # Registration doesn't require auth
        ],
        "authenticated_endpoints": [
            config.prefix for config in ROUTER_CONFIGS if config.requires_auth
        ]
        + ["/api/v1/graphql"],
    }


def get_registered_routers() -> list[RouterConfig]:
    """Get list of all configured routers.

    Returns:
        List of RouterConfig objects.
    """
    return ROUTER_CONFIGS.copy()
