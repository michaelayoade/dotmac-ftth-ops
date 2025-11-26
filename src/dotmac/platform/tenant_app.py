"""
ISP Operations FastAPI Application (Tenant App).

This app handles all ISP-specific operations for a tenant including:
- Customer and subscriber management
- Network operations (RADIUS, NetBox, GenieACS, VOLTHA)
- Billing and revenue management
- Service lifecycle and provisioning
- Support ticketing
- Partner management

Routes: /api/tenant/v1/*
Required Scopes: isp_admin:*, network:*, billing:*, customer:*, etc.
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


# Tenant/ISP router configurations
TENANT_ROUTER_CONFIGS = [
    # Core ISP Operations
    # Customer Management
    {
        "module_path": "dotmac.platform.customer_management.router",
        "router_name": "router",
        "prefix": "",  # Module has /customers prefix
        "tags": ["ISP - Customers"],
        "description": "Customer relationship management",
    },
    {
        "module_path": "dotmac.platform.customer_portal.router",
        "router_name": "router",
        "prefix": "",  # Module has /customer prefix
        "tags": ["ISP - Customer Portal"],
        "description": "Customer self-service portal",
    },
    {
        "module_path": "dotmac.platform.contacts.router",
        "router_name": "router",
        "prefix": "",  # Module has /contacts prefix
        "tags": ["ISP - Contacts"],
        "description": "Contact management",
    },
    {
        "module_path": "dotmac.platform.crm.router",
        "router_name": "router",
        "prefix": "",  # Module has /crm prefix
        "tags": ["ISP - CRM"],
        "description": "Lead management and sales",
    },
    {
        "module_path": "dotmac.platform.sales.router",
        "router_name": "router",
        "prefix": "",  # Module has /orders prefix
        "tags": ["ISP - Sales"],
        "description": "Sales order management",
    },
    # Network & AAA
    {
        "module_path": "dotmac.platform.radius.router",
        "router_name": "router",
        "prefix": "",  # Module has /radius prefix
        "tags": ["ISP - RADIUS"],
        "description": "RADIUS AAA and session management",
    },
    {
        "module_path": "dotmac.platform.access.router",
        "router_name": "router",
        "prefix": "/api/v1",  # Router defines /access prefix
        "tags": ["ISP - Access Network"],
        "description": "OLT and PON access network management",
    },
    {
        "module_path": "dotmac.platform.netbox.router",
        "router_name": "router",
        "prefix": "",  # Module has /netbox prefix
        "tags": ["ISP - NetBox"],
        "description": "Network inventory and IPAM",
    },
    {
        "module_path": "dotmac.platform.tenant.branding_router",
        "router_name": "router",
        "prefix": "",  # Router defines /branding prefix
        "tags": ["ISP - Branding"],
        "description": "Tenant-managed branding configuration",
    },
    {
        "module_path": "dotmac.platform.tenant.isp_settings_router",
        "router_name": "router",
        "prefix": "",  # Router defines /isp-settings prefix
        "tags": ["ISP - Settings"],
        "description": "ISP-specific configuration settings",
    },
    {
        "module_path": "dotmac.platform.genieacs.router",
        "router_name": "router",
        "prefix": "",  # Module has /genieacs prefix
        "tags": ["ISP - GenieACS"],
        "description": "CPE management (TR-069)",
    },
    {
        "module_path": "dotmac.platform.voltha.router",
        "router_name": "router",
        "prefix": "",  # Module has /voltha prefix
        "tags": ["ISP - VOLTHA"],
        "description": "PON/Fiber network management",
    },
    {
        "module_path": "dotmac.platform.wireless.router",
        "router_name": "router",
        "prefix": "",  # Module has /wireless prefix
        "tags": ["ISP - Wireless"],
        "description": "Wireless infrastructure management",
    },
    {
        "module_path": "dotmac.platform.ansible.router",
        "router_name": "router",
        "prefix": "",  # Module has /ansible prefix
        "tags": ["ISP - Automation"],
        "description": "Network automation via Ansible",
    },
    {
        "module_path": "dotmac.platform.wireguard.router",
        "router_name": "router",
        "prefix": "/vpn",  # Module has /wireguard, override to /vpn
        "tags": ["ISP - VPN"],
        "description": "WireGuard VPN management",
    },
    # Billing & Revenue (ISP)
    {
        "module_path": "dotmac.platform.billing.router",
        "router_name": "router",
        "prefix": "",  # Module has /billing prefix
        "tags": ["ISP - Billing"],
        "description": "Billing and payment management",
    },
    {
        "module_path": "dotmac.platform.billing.catalog.router",
        "router_name": "router",
        "prefix": "/billing/catalog",  # Module has empty prefix
        "tags": ["ISP - Billing Catalog"],
        "description": "Product catalog management",
    },
    {
        "module_path": "dotmac.platform.billing.subscriptions.router",
        "router_name": "router",
        "prefix": "",  # Module has /billing/subscriptions prefix
        "tags": ["ISP - Subscriptions"],
        "description": "Subscription management",
    },
    {
        "module_path": "dotmac.platform.billing.pricing.router",
        "router_name": "router",
        "prefix": "",  # Module has /billing/pricing prefix
        "tags": ["ISP - Pricing"],
        "description": "Pricing engine and rules",
    },
    {
        "module_path": "dotmac.platform.billing.invoicing.router",
        "router_name": "router",
        "prefix": "/billing",  # Module has /invoices prefix
        "tags": ["ISP - Invoices"],
        "description": "Invoice management",
    },
    {
        "module_path": "dotmac.platform.billing.invoicing.money_router",
        "router_name": "router",
        "prefix": "/billing/invoices",  # Module has /money prefix
        "tags": ["ISP - Invoices (Money)"],
        "description": "Money-based invoice operations",
    },
    {
        "module_path": "dotmac.platform.billing.payments.router",
        "router_name": "router",
        "prefix": "/billing",  # Module has /payments prefix
        "tags": ["ISP - Payments"],
        "description": "Payment processing",
    },
    {
        "module_path": "dotmac.platform.billing.receipts.router",
        "router_name": "router",
        "prefix": "/billing",  # Module has /receipts prefix
        "tags": ["ISP - Receipts"],
        "description": "Payment receipts",
    },
    {
        "module_path": "dotmac.platform.billing.credit_notes.router",
        "router_name": "router",
        "prefix": "/billing",  # Module has /credit-notes prefix
        "tags": ["ISP - Credit Notes"],
        "description": "Credit notes and refunds",
    },
    {
        "module_path": "dotmac.platform.billing.bank_accounts.router",
        "router_name": "router",
        "prefix": "",  # Module has /billing/bank-accounts prefix
        "tags": ["ISP - Bank Accounts"],
        "description": "Bank accounts and cash registers",
    },
    {
        "module_path": "dotmac.platform.billing.settings.router",
        "router_name": "router",
        "prefix": "/billing",  # Module has /settings prefix
        "tags": ["ISP - Billing Settings"],
        "description": "Billing configuration",
    },
    {
        "module_path": "dotmac.platform.billing.reconciliation_router",
        "router_name": "router",
        "prefix": "/billing",  # Module has /reconciliations prefix
        "tags": ["ISP - Reconciliation"],
        "description": "Payment reconciliation",
    },
    {
        "module_path": "dotmac.platform.billing.dunning.router",
        "router_name": "router",
        "prefix": "",  # Module has /billing/dunning prefix
        "tags": ["ISP - Dunning"],
        "description": "Collections and dunning",
    },
    {
        "module_path": "dotmac.platform.billing.webhooks.router",
        "router_name": "router",
        "prefix": "/billing",  # Module has /webhooks prefix
        "tags": ["ISP - Billing Webhooks"],
        "description": "Billing webhook handlers",
    },
    # Service Lifecycle
    {
        "module_path": "dotmac.platform.services.lifecycle.router",
        "router_name": "router",
        "prefix": "/services",  # Module has /lifecycle prefix
        "tags": ["ISP - Services"],
        "description": "Service provisioning and lifecycle",
    },
    {
        "module_path": "dotmac.platform.services.router",
        "router_name": "router",
        "prefix": "",  # Module already has /orchestration prefix
        "tags": ["ISP - Service Orchestration"],
        "description": "Subscriber provisioning workflows",
    },
    {
        "module_path": "dotmac.platform.orchestration.router",
        "router_name": "router",
        "prefix": "",  # Module already has /orchestration prefix
        "tags": ["ISP - Workflow Orchestration"],
        "description": "Workflow orchestration and automation",
    },
    {
        "module_path": "dotmac.platform.services.internet_plans.router",
        "router_name": "router",
        "prefix": "",  # Module already has /services/internet-plans prefix
        "tags": ["ISP - Internet Plans"],
        "description": "Internet service plan management",
    },
    # Tenant Settings & Configuration
    {
        "module_path": "dotmac.platform.tenant.usage_billing_router",
        "router_name": "router",
        "prefix": "",  # Module has /usage prefix
        "tags": ["ISP - Usage Billing"],
        "description": "Usage tracking and billing",
    },
    {
        "module_path": "dotmac.platform.tenant.oss_router",
        "router_name": "router",
        "prefix": "",  # Module has /tenant/oss prefix
        "tags": ["ISP - OSS Config"],
        "description": "OSS integration configuration",
    },
    # User Management (Tenant-scoped)
    {
        "module_path": "dotmac.platform.user_management.router",
        "router_name": "user_router",
        "prefix": "",  # Module has /users prefix
        "tags": ["ISP - Users"],
        "description": "User management",
    },
    {
        "module_path": "dotmac.platform.user_management.team_router",
        "router_name": "router",
        "prefix": "",  # Module has /teams prefix
        "tags": ["ISP - Teams"],
        "description": "Team management",
    },
    # Support & Ticketing
    {
        "module_path": "dotmac.platform.ticketing.router",
        "router_name": "router",
        "prefix": "",  # Module has /tickets prefix
        "tags": ["ISP - Tickets"],
        "description": "Support ticketing",
    },
    # Partner Management
    {
        "module_path": "dotmac.platform.partner_management.router",
        "router_name": "router",
        "prefix": "",  # Module has /partners prefix
        "tags": ["ISP - Partners"],
        "description": "Partner relationship management",
    },
    {
        "module_path": "dotmac.platform.partner_management.portal_router",
        "router_name": "router",
        "prefix": "/partners",  # Module has /portal prefix
        "tags": ["ISP - Partner Portal"],
        "description": "Partner self-service portal",
    },
    {
        "module_path": "dotmac.platform.partner_management.revenue_router",
        "router_name": "router",
        "prefix": "/partners",  # Module has /revenue prefix
        "tags": ["ISP - Partner Revenue"],
        "description": "Partner revenue sharing",
    },
    # Workflows & Jobs
    {
        "module_path": "dotmac.platform.workflows.router",
        "router_name": "router",
        "prefix": "/workflows",  # Module has /workflows prefix
        "tags": ["ISP - Workflows"],
        "description": "Workflow orchestration",
    },
    {
        "module_path": "dotmac.platform.jobs.router",
        "router_name": "router",
        "prefix": "",  # Module has /jobs prefix
        "tags": ["ISP - Jobs"],
        "description": "Background job management",
    },
    {
        "module_path": "dotmac.platform.jobs.scheduler_router",
        "router_name": "router",
        "prefix": "",  # Module has /jobs/scheduler prefix
        "tags": ["ISP - Job Scheduler"],
        "description": "Job scheduling",
    },
    # Monitoring & Diagnostics
    {
        "module_path": "dotmac.platform.fault_management.router",
        "router_name": "router",
        "prefix": "/faults",  # Module defines /faults
        "tags": ["ISP - Fault Management"],
        "description": "Alarm and SLA monitoring",
    },
    {
        "module_path": "dotmac.platform.metrics.router",
        "router_name": "router",
        "prefix": "",  # Module has /metrics prefix
        "tags": ["ISP - Metrics"],
        "description": "ISP metrics and KPIs",
    },
    # Integrations
    {
        "module_path": "dotmac.platform.webhooks.router",
        "router_name": "router",
        "prefix": "",  # Module has /webhooks prefix
        "tags": ["ISP - Webhooks"],
        "description": "Webhook management",
    },
    {
        "module_path": "dotmac.platform.integrations.router",
        "router_name": "integrations_router",
        "prefix": "",  # Module has /integrations prefix
        "tags": ["ISP - Integrations"],
        "description": "External service integrations",
    },
    {
        "module_path": "dotmac.platform.plugins.router",
        "router_name": "router",
        "prefix": "/plugins",  # Module has empty prefix
        "tags": ["ISP - Plugins"],
        "description": "Plugin management",
    },
    # Realtime & Notifications
    {
        "module_path": "dotmac.platform.realtime.router",
        "router_name": "router",
        "prefix": "",  # Module has /realtime prefix
        "tags": ["ISP - Realtime"],
        "description": "Real-time updates (SSE/WebSocket)",
    },
    {
        "module_path": "dotmac.platform.notifications.router",
        "router_name": "router",
        "prefix": "/notifications",  # Module has empty prefix
        "tags": ["ISP - Notifications"],
        "description": "User notifications",
    },
    {
        "module_path": "dotmac.platform.communications.router",
        "router_name": "router",
        "prefix": "",  # Module has /communications prefix
        "tags": ["ISP - Communications"],
        "description": "Email and SMS communications",
    },
]


def _register_router(app: FastAPI, config: dict) -> bool:
    """Register a single router with the tenant app."""
    try:
        import importlib

        module = importlib.import_module(config["module_path"])
        router = getattr(module, config["router_name"])

        # All tenant routes require auth
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

    # Register tenant routers
    registered_count = 0
    failed_count = 0

    logger.info(
        f"Registering {len(TENANT_ROUTER_CONFIGS)} tenant routers",
        deployment_mode=settings.DEPLOYMENT_MODE,
    )

    for config in TENANT_ROUTER_CONFIGS:
        if _register_router(app, config):
            registered_count += 1
        else:
            failed_count += 1

    logger.info(
        "\n" + "=" * 60 + "\n"
        f"🚀 Tenant App Registration Complete\n"
        f"   ✅ Registered: {registered_count} routers\n"
        f"   ⚠️  Skipped: {failed_count} routers\n" + "=" * 60
    )

    # Health check
    @app.get("/health")
    async def health_check() -> dict[str, Any]:
        """Tenant app health check."""
        return {
            "status": "healthy",
            "app": "tenant",
            "version": settings.app_version,
        }

    return app


# Create the tenant app instance
tenant_app = create_tenant_app()
