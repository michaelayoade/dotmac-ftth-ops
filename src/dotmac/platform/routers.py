"""
Centralized router registration for all API endpoints.

All routes except /health, /ready, and /metrics require authentication.
"""

import importlib
from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Any

import structlog
from fastapi import Depends, FastAPI
from fastapi.security import HTTPBearer

from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.graphql.context import Context
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

# Security scheme for Swagger UI (documentation only - NOT for actual auth)
# IMPORTANT: This only validates Bearer token format, not JWT validity
# Real authentication uses get_current_user which validates the JWT
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
        module_path="dotmac.platform.config.router",
        router_name="health_router",
        prefix="/api/v1",
        tags=["Health"],
        requires_auth=False,  # Public health check
        description="Health check endpoint at /api/v1/health",
    ),
    RouterConfig(
        module_path="dotmac.platform.config.router",
        router_name="router",
        prefix="/api/v1",
        tags=["Platform"],
        requires_auth=False,  # Public platform config
        description="Platform configuration and health endpoints",
    ),
    RouterConfig(
        module_path="dotmac.platform.auth.router",
        router_name="auth_router",
        prefix="/api/v1",  # Module has /auth prefix
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
        module_path="dotmac.platform.auth.rbac_router",
        router_name="router",
        prefix="/api/v1/auth/rbac/admin",
        tags=["RBAC - Admin"],
        requires_auth=True,
        description="RBAC admin endpoints (create/update/delete roles and permissions)",
    ),
    RouterConfig(
        module_path="dotmac.platform.auth.platform_admin_router",
        router_name="router",
        prefix="/api/v1/platform-admin",
        tags=["Platform Administration"],
        requires_auth=True,  # Uses require_platform_admin internally
        description="Cross-tenant platform administration (super admin only)",
    ),
    RouterConfig(
        module_path="dotmac.platform.access.router",
        router_name="router",
        prefix="/api/v1",
        tags=["Access Network"],
        requires_auth=True,  # CRITICAL: Access network requires authentication
        description="OLT management via pluggable SNMP/CLI/TR-069 drivers",
    ),
    RouterConfig(
        module_path="dotmac.platform.secrets.api",
        router_name="router",
        prefix="/api/v1/secrets",
        tags=["Secrets Management"],
        requires_auth=True,  # CRITICAL: Secrets require authentication
        description="Vault/OpenBao secrets management",
    ),
    RouterConfig(
        module_path="dotmac.platform.analytics.router",
        router_name="analytics_router",
        prefix="/api/v1",  # Module has /analytics prefix
        tags=["Analytics"],
        requires_auth=True,  # Analytics requires authentication
        description="Analytics and metrics endpoints",
    ),
    RouterConfig(
        module_path="dotmac.platform.file_storage.router",
        router_name="file_storage_router",
        prefix="/api/v1",  # Module has /files/storage prefix
        tags=["File Storage"],
        requires_auth=True,  # CRITICAL: File storage requires authentication
        description="File storage management",
    ),
    RouterConfig(
        module_path="dotmac.platform.communications.router",
        router_name="router",
        prefix="/api/v1",  # Module has /communications prefix
        tags=["Communications"],
        requires_auth=True,  # Communications requires authentication
        description="Communications API with email, templates, and background tasks",
    ),
    RouterConfig(
        module_path="dotmac.platform.search.router",
        router_name="search_router",
        prefix="/api/v1/search",
        tags=["Search"],
        requires_auth=True,  # Search requires authentication
        description="Search functionality",
    ),
    RouterConfig(
        module_path="dotmac.platform.data_transfer.router",
        router_name="data_transfer_router",
        prefix="/api/v1",  # Module has /data-transfer prefix
        tags=["Data Transfer"],
        requires_auth=True,  # CRITICAL: Data transfer requires authentication
        description="Data import/export operations",
    ),
    RouterConfig(
        module_path="dotmac.platform.data_import.router",
        router_name="router",
        prefix="/api/v1",  # Module has /data-import prefix
        tags=["Data Import"],
        requires_auth=True,  # CRITICAL: Data import requires authentication
        description="File-based data import operations (CSV, JSON)",
    ),
    RouterConfig(
        module_path="dotmac.platform.user_management.router",
        router_name="user_router",
        prefix="/api/v1",  # Module has /users prefix
        tags=["User Management"],
        requires_auth=True,  # CRITICAL: User management requires authentication
        description="User management endpoints",
    ),
    RouterConfig(
        module_path="dotmac.platform.user_management.team_router",
        router_name="router",
        prefix="/api/v1",  # Module has /teams prefix
        tags=["Team Management"],
        description="Team and team member management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.router",
        router_name="router",
        prefix="/api/v1/tenants",  # Router mounts at root; prefix adds tenants path
        tags=["Tenant Management"],
        description="Multi-tenant organization management",
        requires_auth=True,
    ),
    # Legacy singular prefix for backwards compatibility
    RouterConfig(
        module_path="dotmac.platform.tenant.router",
        router_name="router",
        prefix="/api/v1/tenant",  # Legacy singular path support
        tags=["Tenant Management"],
        description="Legacy tenant endpoints (singular prefix)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.onboarding_router",
        router_name="router",
        prefix="/api/v1",  # Module has /tenants prefix
        tags=["Tenant Onboarding"],
        description="Tenant onboarding automation",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.domain_verification_router",
        router_name="router",
        prefix="/api/v1",  # Module has /tenants prefix
        tags=["Tenant - Domain Verification"],
        description="Custom domain verification for tenants",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.usage_billing_router",
        router_name="router",
        prefix="/api/v1",  # Module has /usage prefix
        tags=["Tenant Usage Billing"],
        description="Usage tracking and billing integration",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.tenant.oss_router",
        router_name="router",
        prefix="",  # Router already includes /api/v1/tenant/oss prefix
        tags=["Tenant OSS"],
        description="Tenant-specific OSS integration configuration",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.feature_flags.router",
        router_name="feature_flags_router",
        prefix="/api/v1",  # Module has /feature-flags prefix
        tags=["Feature Flags"],
        requires_auth=True,  # Feature flags require authentication
        description="Feature flags management",
    ),
    RouterConfig(
        module_path="dotmac.platform.customer_management.router",
        router_name="router",
        prefix="/api/v1/customers",
        tags=["Customer Management"],
        requires_auth=True,  # CRITICAL: Customer management requires authentication
        description="Customer relationship management",
    ),
    RouterConfig(
        module_path="dotmac.platform.customer_portal.router",
        router_name="router",
        prefix="/api/v1",  # Module has /customer prefix
        tags=["Customer Portal"],
        description="Customer self-service portal (usage, billing, invoices)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.contacts.router",
        router_name="router",
        prefix="/api/v1",  # Module has /contacts prefix
        tags=["Contacts"],
        requires_auth=True,  # Contacts require authentication
        description="Contact management system",
    ),
    RouterConfig(
        module_path="dotmac.platform.auth.api_keys_router",
        router_name="router",
        prefix="/api/v1",  # Module has /auth/api-keys prefix
        tags=["API Keys"],
        requires_auth=True,  # CRITICAL: API key management requires authentication
        description="API key management",
    ),
    RouterConfig(
        module_path="dotmac.platform.webhooks.router",
        router_name="router",
        prefix="/api/v1",  # Module has /webhooks prefix
        tags=["Webhooks"],
        description="Generic webhook subscription and event management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.router",
        router_name="router",
        prefix="/api/v1",  # Module has /billing prefix
        tags=["Billing"],
        requires_auth=True,  # CRITICAL: Billing requires authentication
        description="Billing and payment management",
    ),
    RouterConfig(
        module_path="dotmac.platform.licensing.router",
        router_name="router",
        prefix="",  # Router already has /api/licensing prefix
        tags=["Licensing"],
        description="Software licensing, activation, and compliance management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.plugins.router",
        router_name="router",
        prefix="/api/v1/plugins",
        tags=["Plugin Management"],
        requires_auth=True,  # Plugin management requires authentication
        description="Dynamic plugin system management",
    ),
    RouterConfig(
        module_path="dotmac.platform.audit.router",
        router_name="router",
        prefix="/api/v1",  # Module has /audit prefix
        tags=["Audit"],
        requires_auth=True,  # CRITICAL: Audit logs require authentication
        description="Audit trails and activity tracking",
    ),
    RouterConfig(
        module_path="dotmac.platform.metrics.router",
        router_name="router",
        prefix="/api/v1",  # Module has /metrics prefix
        tags=["Metrics"],
        description="ISP metrics and KPIs with caching",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.realtime.router",
        router_name="router",
        prefix="/api/v1",  # Module has /realtime prefix
        tags=["Real-Time"],
        description="Real-time updates via SSE and WebSocket",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.rate_limit.router",
        router_name="router",
        prefix="/api/v1",  # Module has /rate-limits prefix
        tags=["Rate Limiting"],
        description="Rate limit rule management and monitoring",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.jobs.router",
        router_name="router",
        prefix="/api/v1",  # Module has /jobs prefix
        tags=["Jobs"],
        description="Async job tracking and management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.jobs.scheduler_router",
        router_name="router",
        prefix="/api/v1",  # Module has /jobs/scheduler prefix
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
        prefix="/api/v1",  # Module has /billing/subscriptions prefix
        tags=["Billing - Subscriptions"],
        description="Subscription management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.pricing.router",
        router_name="router",
        prefix="/api/v1",  # Module has /billing/pricing prefix
        tags=["Billing - Pricing"],
        description="Pricing engine and rules",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.bank_accounts.router",
        router_name="router",
        prefix="/api/v1",  # Module has /billing/bank-accounts prefix
        tags=["Billing - Bank Accounts"],
        description="Bank accounts and manual payments",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.settings.router",
        router_name="router",
        prefix="/api/v1/billing",  # Module has /settings prefix
        tags=["Billing - Settings"],
        description="Billing configuration and settings",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.reconciliation_router",
        router_name="router",
        prefix="/api/v1/billing",  # Module has /reconciliations prefix
        tags=["Billing - Reconciliation"],
        description="Payment reconciliation and recovery",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.dunning.router",
        router_name="router",
        prefix="/api/v1",  # Module has /billing/dunning prefix
        tags=["Billing - Dunning"],
        description="Dunning and collections management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.licensing.router_framework",
        router_name="router",
        prefix="/api/v1",
        tags=["Licensing Framework"],
        description="Composable licensing with dynamic plan builder",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.invoicing.router",
        router_name="router",
        prefix="/api/v1/billing",  # Module has /invoices prefix
        tags=["Billing - Invoices"],
        description="Invoice creation and management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.invoicing.money_router",
        router_name="router",
        prefix="/api/v1/billing/invoices",  # Module has /money prefix
        tags=["Billing - Invoices (Money)"],
        description="Money-based invoice operations with PDF generation",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.payments.router",
        router_name="router",
        prefix="/api/v1/billing",
        tags=["Billing - Payments"],
        description="Payment processing and tracking",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.receipts.router",
        router_name="router",
        prefix="/api/v1/billing",
        tags=["Billing - Receipts"],
        description="Payment receipts and documentation",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.credit_notes.router",
        router_name="router",
        prefix="/api/v1/billing",
        tags=["Billing - Credit Notes"],
        description="Credit notes and refunds",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.billing.webhooks.router",
        router_name="router",
        prefix="/api/v1/billing",
        tags=["Billing - Webhooks"],
        description="Billing webhook handlers (Stripe, etc.)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring.logs_router",
        router_name="logs_router",
        prefix="/api/v1",  # Module has /monitoring prefix
        tags=["Monitoring - Logs"],
        description="Application logs with filtering and search",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring.traces_router",
        router_name="traces_router",
        prefix="/api/v1",  # Module has /observability prefix
        tags=["Observability - Traces"],
        description="Distributed traces, metrics, and performance data",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring.alert_router",
        router_name="router",
        prefix="/api/v1/monitoring",  # Module has /alerts prefix
        tags=["Monitoring - Alerts"],
        description="Alert webhook receiver and channel management",
        requires_auth=False,  # Webhook endpoint doesn't require auth, but management endpoints do (checked internally)
    ),
    RouterConfig(
        module_path="dotmac.platform.partner_management.router",
        router_name="router",
        prefix="/api/v1",  # Module has /partners prefix
        tags=["Partner Management"],
        description="Partner relationship management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.partner_management.portal_router",
        router_name="router",
        prefix="/api/v1/partners",  # Module has /portal prefix
        tags=["Partner Portal"],
        description="Partner self-service portal",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.partner_management.revenue_router",
        router_name="router",
        prefix="/api/v1/partners",  # Module has /revenue prefix
        tags=["Partner Revenue"],
        description="Partner revenue sharing and commissions",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.ticketing.router",
        router_name="router",
        prefix="/api/v1",  # Module has /tickets prefix
        tags=["Ticketing"],
        description="Cross-organization ticketing workflows",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.wireless.router",
        router_name="router",
        prefix="/api/v1",  # Module has /wireless prefix
        tags=["Wireless Infrastructure"],
        description="Wireless network infrastructure management (APs, radios, coverage zones)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.fiber.router",
        router_name="router",
        prefix="/api/v1",  # Module has /fiber prefix
        tags=["Fiber Infrastructure"],
        description="Fiber optic network infrastructure management (cables, splice points, distribution points)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring_metrics_router",
        router_name="logs_router",
        prefix="/api/v1",  # Module has /logs prefix
        tags=["Logs"],
        description="Application logs and error monitoring",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.monitoring_metrics_router",
        router_name="metrics_router",
        prefix="/api/v1",  # Module has /metrics prefix
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
        module_path="dotmac.platform.workflows.metrics_router",
        router_name="router",
        prefix="/api/v1",
        tags=["Workflow Metrics"],
        description="Workflow services metrics (operations, performance, errors)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.integrations.router",
        router_name="integrations_router",
        prefix="/api/v1",  # Module has /integrations prefix
        tags=["Integrations"],
        description="External service integrations (Email, SMS, Storage, etc.)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.radius.router",
        router_name="router",
        prefix="/api/v1",  # Module has /radius prefix
        tags=["RADIUS"],
        description="RADIUS subscriber management and session tracking",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.radius.analytics_router",
        router_name="router",
        prefix="/api/v1/radius",  # Mount under /radius - module has /analytics prefix
        tags=["RADIUS Analytics"],
        description="RADIUS analytics and bandwidth usage queries (TimescaleDB)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.netbox.router",
        router_name="router",
        prefix="/api/v1",  # Module has /netbox prefix
        tags=["NetBox"],
        description="NetBox IPAM and DCIM integration",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.genieacs.router",
        router_name="router",
        prefix="/api/v1",  # Module has /genieacs prefix
        tags=["GenieACS"],
        description="GenieACS CPE management (TR-069/CWMP)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.voltha.router",
        router_name="router",
        prefix="/api/v1",  # Module has /voltha prefix
        tags=["VOLTHA"],
        description="VOLTHA PON network management (OLT/ONU)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.ansible.router",
        router_name="router",
        prefix="/api/v1",  # Module has /ansible prefix
        tags=["Ansible"],
        description="Ansible AWX automation workflows",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.wireguard.router",
        router_name="router",
        prefix="/api/v1",
        tags=["WireGuard VPN"],
        description="WireGuard VPN server and peer management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.crm.router",
        router_name="router",
        prefix="/api/v1",  # Module has /crm prefix
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
        module_path="dotmac.platform.services.lifecycle.router",
        router_name="router",
        prefix="/api/v1/services",
        tags=["Services - Lifecycle"],
        description="Service provisioning, activation, suspension, and termination",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.services.internet_plans.router",
        router_name="router",
        prefix="",  # Router has its own prefix
        tags=["ISP - Internet Plans"],
        description="ISP internet service plan management with validation and testing",
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
    RouterConfig(
        module_path="dotmac.platform.fault_management.router",
        router_name="router",
        prefix="",  # Router defines its own prefix: /api/v1/faults
        tags=["Fault Management"],
        description="Alarm management, SLA monitoring, and maintenance windows",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.fault_management.oncall_router",
        router_name="router",
        prefix="/api/v1",  # Module has /oncall prefix
        tags=["On-Call Management"],
        description="On-call schedule and rotation management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.deployment.router",
        router_name="router",
        prefix="/api/v1",  # Module has /deployments prefix
        tags=["Deployment Orchestration"],
        description="Multi-tenant deployment provisioning and lifecycle management",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.workflows.router",
        router_name="router",
        prefix="/api/v1",
        tags=["Workflows"],
        description="Workflow orchestration and automation",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.sales.router",
        router_name="router",
        prefix="/api/v1",  # Module has /orders prefix
        tags=["Sales - Orders"],
        description="Order processing and service activation (authenticated)",
        requires_auth=True,
    ),
    RouterConfig(
        module_path="dotmac.platform.sales.router",
        router_name="public_router",
        prefix="",  # Module has full /api/public/orders path
        tags=["Sales - Public Orders"],
        description="Public order creation and status checking (no auth required)",
        requires_auth=False,
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
        # CRITICAL: Use get_current_user for real JWT validation, not bare HTTPBearer
        # HTTPBearer only checks for Authorization header presence, not JWT validity
        dependencies = [Depends(get_current_user)] if config.requires_auth else None

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

        from dotmac.platform.graphql.schema import schema

        # GraphQLRouter with explicit path
        # Using default context (will be available via info.context.request)
        graphql_app = GraphQLRouter(
            schema,
            path="/api/v1/graphql",
            context_getter=Context.get_context,
        )

        # Add router directly without prefix
        app.include_router(graphql_app)

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
        "graphql_playground": "/api/v1/graphql" if not settings.is_production else None,
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
