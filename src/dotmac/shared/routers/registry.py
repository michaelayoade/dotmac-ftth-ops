"""
Declarative Router Registry.

Single source of truth for all API route registrations across DotMac services.
Each router entry defines its service scope (CONTROLPLANE, ISP, or SHARED).

Architecture:
    - Root app mounts sub-apps at /api/{service}/v1
    - platform_app mounted at /api/platform/v1
    - isp_app mounted at /api/isp/v1
    - Prefixes in this registry are RELATIVE to the mount point

Usage:
    from dotmac.shared.routers import get_routers_for_scope, ServiceScope

    # Get all routers for ISP service
    isp_routers = get_routers_for_scope(ServiceScope.ISP)

    # Register routers with FastAPI app
    register_routers_for_scope(app, ServiceScope.ISP)
"""

from __future__ import annotations

import importlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any, cast

import structlog

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = structlog.get_logger(__name__)

ADMIN_PREFIX = "/admin"
PARTNER_PREFIX = "/partners"
PORTAL_PREFIX = "/portal"


class ServiceScope(Enum):
    """Service scope for router registration."""

    CONTROLPLANE = "controlplane"  # Platform admin service (/api/platform/v1/*)
    ISP = "isp"  # ISP operations service (/api/isp/v1/*)
    SHARED = "shared"  # Shared by both services


@dataclass(frozen=True)
class RouterEntry:
    """
    Immutable configuration for a router to be registered.

    Attributes:
        module_path: Fully qualified Python module path
        router_name: Name of the router object in the module
        prefix: URL prefix for the router (relative to mount point, NOT including /api/v1)
        tags: OpenAPI tags for documentation
        scope: Service scope (CONTROLPLANE, ISP, or SHARED)
        requires_auth: Whether the router requires authentication
        description: Human-readable description
        deprecated: Whether this router is deprecated
    """

    module_path: str
    router_name: str
    prefix: str
    tags: tuple[str, ...]
    scope: ServiceScope
    base_prefix: str = ""
    requires_auth: bool = True
    description: str = ""
    deprecated: bool = False


# =============================================================================
# ROUTER REGISTRY - Single Source of Truth
# =============================================================================
#
# IMPORTANT: Prefixes are RELATIVE to the service mount point:
# - CONTROLPLANE routes: mounted at /api/platform/v1, so prefix="/tenants" -> /api/platform/v1/tenants
# - ISP routes: mounted at /api/isp/v1, so prefix="/customers" -> /api/isp/v1/customers
# - SHARED routes: registered on BOTH apps with same relative prefix
#
# All routers are categorized by service scope:
# - SHARED: Health, auth, config endpoints used by both services
# - CONTROLPLANE: Platform admin, licensing, tenant provisioning, observability
# - ISP: Customer management, billing, RADIUS, network operations
#
# =============================================================================

ROUTER_REGISTRY: tuple[RouterEntry, ...] = (
    # =========================================================================
    # SHARED ROUTERS - Registered on BOTH platform_app and isp_app
    # These provide common functionality like auth, health, config
    # =========================================================================
    RouterEntry(
        module_path="dotmac.platform.config.router",
        router_name="health_router",
        prefix="",  # /health endpoint at service root
        tags=("Health",),
        scope=ServiceScope.SHARED,
        requires_auth=False,
        description="Health check endpoint",
    ),
    RouterEntry(
        module_path="dotmac.platform.config.router",
        router_name="router",
        prefix="",  # /config at service root
        tags=("Platform",),
        scope=ServiceScope.SHARED,
        requires_auth=False,
        description="Platform configuration endpoints",
    ),
    RouterEntry(
        module_path="dotmac.platform.auth.router",
        router_name="auth_router",
        prefix="",  # /auth/* at service root
        base_prefix="/",  # flatten auth paths (no extra /admin)
        tags=("Authentication",),
        scope=ServiceScope.SHARED,
        requires_auth=False,
        description="Authentication endpoints (login, register, password reset)",
    ),
    RouterEntry(
        module_path="dotmac.platform.auth.rbac_read_router",
        router_name="router",
        prefix="/auth/rbac",
        tags=("RBAC",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="RBAC read-only endpoints for frontend",
    ),
    RouterEntry(
        module_path="dotmac.platform.auth.rbac_router",
        router_name="router",
        prefix="/auth/rbac/admin",
        tags=("RBAC - Admin",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="RBAC admin endpoints (create/update/delete roles and permissions)",
    ),
    RouterEntry(
        module_path="dotmac.platform.auth.api_keys_router",
        router_name="router",
        prefix="",  # /api-keys at service root
        tags=("API Keys",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="API key management",
    ),
    RouterEntry(
        module_path="dotmac.platform.audit.router",
        router_name="public_router",
        prefix="",  # /audit/errors at service root
        tags=("Audit - Public",),
        scope=ServiceScope.SHARED,
        requires_auth=False,
        description="Public audit endpoints (frontend error logging with rate limiting)",
    ),
    RouterEntry(
        module_path="dotmac.platform.realtime.router",
        router_name="router",
        prefix="",  # /realtime at service root
        tags=("Real-Time",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="Real-time updates via SSE and WebSocket",
    ),
    RouterEntry(
        module_path="dotmac.platform.user_management.router",
        router_name="user_router",
        prefix="",  # /users at service root
        base_prefix="/",  # flatten user paths (no extra /admin)
        tags=("User Management",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="User management endpoints",
    ),
    RouterEntry(
        module_path="dotmac.platform.user_management.team_router",
        router_name="router",
        prefix="",  # /teams at service root
        base_prefix="/",  # flatten team paths (no extra /admin)
        tags=("Team Management",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="Team and team member management",
    ),
    RouterEntry(
        module_path="dotmac.platform.file_storage.router",
        router_name="file_storage_router",
        prefix="",  # /files at service root
        tags=("File Storage",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="File storage management",
    ),
    RouterEntry(
        module_path="dotmac.platform.notifications.router",
        router_name="router",
        prefix="",  # /notifications at service root
        tags=("Notifications",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="User notifications and preferences",
    ),
    RouterEntry(
        module_path="dotmac.platform.push.router",
        router_name="router",
        prefix="",  # /push at service root
        tags=("Push Notifications",),
        scope=ServiceScope.SHARED,
        requires_auth=True,
        description="PWA push notification subscriptions and sending",
    ),
    # =========================================================================
    # CONTROL-PLANE ROUTERS - Platform Administration
    # Mounted at /api/platform/v1, prefixes are relative to that
    # =========================================================================
    RouterEntry(
        module_path="dotmac.platform.auth.platform_admin_router",
        router_name="router",
        prefix="/admin/platform",
        tags=("Platform Administration",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Cross-tenant platform administration (super admin only)",
    ),
    RouterEntry(
        module_path="dotmac.platform.platform_admin",
        router_name="router",
        prefix="",  # /platform-admin at mount root
        tags=("Platform Admin - Cross-Tenant",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Cross-tenant data access for platform administrators",
    ),
    RouterEntry(
        module_path="dotmac.platform.tenant.router",
        router_name="router",
        prefix="",  # /tenants at mount root
        tags=("Tenant Management",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Multi-tenant organization management",
    ),
    RouterEntry(
        module_path="dotmac.platform.tenant.onboarding_router",
        router_name="router",
        prefix="",  # /tenants/onboarding at mount root
        tags=("Tenant Onboarding",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Tenant onboarding automation",
    ),
    RouterEntry(
        module_path="dotmac.platform.tenant.domain_verification_router",
        router_name="router",
        prefix="",  # /tenants/domains at mount root
        tags=("Tenant - Domain Verification",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Custom domain verification for tenants",
    ),
    RouterEntry(
        module_path="dotmac.platform.licensing.router",
        router_name="router",
        prefix="",  # /licensing at mount root
        tags=("Licensing",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Software licensing, activation, and compliance management",
    ),
    RouterEntry(
        module_path="dotmac.platform.licensing.router_framework",
        router_name="router",
        prefix="",  # /licensing/framework at mount root
        tags=("Licensing Framework",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Composable licensing with dynamic plan builder",
    ),
    RouterEntry(
        module_path="dotmac.platform.admin.settings.router",
        router_name="router",
        prefix="/admin/settings",
        tags=("Admin - Settings",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Platform settings management (admin only)",
    ),
    RouterEntry(
        module_path="dotmac.platform.deployment.router",
        router_name="router",
        prefix="",  # /deployments at mount root
        tags=("Deployment Orchestration",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Multi-tenant deployment provisioning and lifecycle management",
    ),
    RouterEntry(
        module_path="dotmac.platform.monitoring.traces_router",
        router_name="traces_router",
        prefix="",  # /observability at mount root
        tags=("Observability - Traces",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Distributed traces, metrics, and performance data",
    ),
    RouterEntry(
        module_path="dotmac.platform.monitoring.logs_router",
        router_name="logs_router",
        prefix="",  # /monitoring at mount root
        tags=("Monitoring - Logs",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Application logs with filtering and search",
    ),
    RouterEntry(
        module_path="dotmac.platform.monitoring.infrastructure_router",
        router_name="router",
        prefix="",  # /infrastructure at mount root
        tags=("Monitoring - Compatibility",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Frontend-friendly monitoring aliases",
    ),
    RouterEntry(
        module_path="dotmac.platform.monitoring.alert_router",
        router_name="router",
        prefix="/monitoring",
        tags=("Monitoring - Alerts",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=False,
        description="Alert webhook receiver and channel management",
    ),
    RouterEntry(
        module_path="dotmac.platform.audit.router",
        router_name="router",
        prefix="",  # /audit at mount root
        tags=("Audit",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Audit trails and activity tracking",
    ),
    RouterEntry(
        module_path="dotmac.platform.analytics.router",
        router_name="analytics_router",
        prefix="",  # /analytics at mount root
        tags=("Analytics",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Analytics and metrics endpoints",
    ),
    RouterEntry(
        module_path="dotmac.platform.feature_flags.router",
        router_name="feature_flags_router",
        prefix="",  # /feature-flags at mount root
        tags=("Feature Flags",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Feature flags management",
    ),
    RouterEntry(
        module_path="dotmac.platform.plugins.router",
        router_name="router",
        prefix="/plugins",
        tags=("Plugin Management",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Dynamic plugin system management",
    ),
    RouterEntry(
        module_path="dotmac.platform.secrets.api",
        router_name="router",
        prefix="/secrets",
        tags=("Secrets Management",),
        scope=ServiceScope.CONTROLPLANE,
        requires_auth=True,
        description="Vault/OpenBao secrets management",
    ),
    # =========================================================================
    # ISP ROUTERS - ISP Operations
    # Mounted at /api/isp/v1, prefixes are relative to that
    # =========================================================================
    # --- Customer Management ---
    RouterEntry(
        module_path="dotmac.platform.customer_management.router",
        router_name="router",
        prefix="/customers",
        tags=("Customer Management",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Customer relationship management",
    ),
    RouterEntry(
        module_path="dotmac.platform.customer_portal.router",
        router_name="router",
        prefix="",  # /customer at mount root
        base_prefix=PORTAL_PREFIX,
        tags=("Customer Portal",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Customer self-service portal (usage, billing, invoices)",
    ),
    RouterEntry(
        module_path="dotmac.platform.contacts.router",
        router_name="router",
        prefix="",  # /contacts at mount root
        tags=("Contacts",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Contact management system",
    ),
    RouterEntry(
        module_path="dotmac.platform.crm.router",
        router_name="router",
        prefix="/crm",
        tags=("CRM",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Lead management, quotes, and site surveys",
    ),
    RouterEntry(
        module_path="dotmac.platform.sales.router",
        router_name="router",
        prefix="",  # /orders at mount root
        tags=("Sales - Orders",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Order processing and service activation (authenticated)",
    ),
    RouterEntry(
        module_path="dotmac.platform.sales.router",
        router_name="public_router",
        prefix="",  # /public/orders at mount root
        base_prefix=PORTAL_PREFIX,
        tags=("Sales - Public Orders",),
        scope=ServiceScope.ISP,
        requires_auth=False,
        description="Public order creation and status checking (no auth required)",
    ),
    # --- Billing ---
    RouterEntry(
        module_path="dotmac.platform.billing.router",
        router_name="router",
        prefix="",  # /billing at mount root
        tags=("Billing",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Billing and payment management",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.catalog.router",
        router_name="router",
        prefix="/billing/catalog",
        tags=("Billing - Catalog",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Product catalog management",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.subscriptions.router",
        router_name="router",
        prefix="",  # /billing/subscriptions at mount root
        tags=("Billing - Subscriptions",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Subscription management",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.pricing.router",
        router_name="router",
        prefix="",  # /billing/pricing at mount root
        tags=("Billing - Pricing",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Pricing engine and rules",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.invoicing.router",
        router_name="router",
        prefix="/billing",
        tags=("Billing - Invoices",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Invoice creation and management",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.invoicing.money_router",
        router_name="router",
        prefix="/billing/invoices",
        tags=("Billing - Invoices (Money)",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Money-based invoice operations with PDF generation",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.payments.router",
        router_name="router",
        prefix="/billing",
        tags=("Billing - Payments",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Payment processing and tracking",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.receipts.router",
        router_name="router",
        prefix="/billing",
        tags=("Billing - Receipts",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Payment receipts and documentation",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.credit_notes.router",
        router_name="router",
        prefix="/billing",
        tags=("Billing - Credit Notes",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Credit notes and refunds",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.bank_accounts.router",
        router_name="router",
        prefix="",  # /billing/bank-accounts at mount root
        tags=("Billing - Bank Accounts",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Bank accounts and manual payments",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.settings.router",
        router_name="router",
        prefix="/billing",
        tags=("Billing - Settings",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Billing configuration and settings",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.reconciliation_router",
        router_name="router",
        prefix="/billing",
        tags=("Billing - Reconciliation",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Payment reconciliation and recovery",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.dunning.router",
        router_name="router",
        prefix="",  # /billing/dunning at mount root
        tags=("Billing - Dunning",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Dunning and collections management",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.webhooks.router",
        router_name="router",
        prefix="/billing",
        tags=("Billing - Webhooks",),
        scope=ServiceScope.ISP,
        requires_auth=False,
        description="Billing webhook handlers (Stripe, Paystack, etc.)",
    ),
    # --- Network & AAA ---
    RouterEntry(
        module_path="dotmac.platform.radius.router",
        router_name="router",
        prefix="",  # /radius at mount root
        tags=("RADIUS",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="RADIUS subscriber management and session tracking",
    ),
    RouterEntry(
        module_path="dotmac.platform.radius.analytics_router",
        router_name="router",
        prefix="/radius",
        tags=("RADIUS Analytics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="RADIUS analytics and bandwidth usage queries (TimescaleDB)",
    ),
    RouterEntry(
        module_path="dotmac.platform.access.router",
        router_name="router",
        prefix="",  # /access at mount root
        tags=("Access Network",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="OLT management via pluggable SNMP/CLI/TR-069 drivers",
    ),
    RouterEntry(
        module_path="dotmac.platform.network.router",
        router_name="router",
        prefix="",  # /network at mount root
        tags=("Network",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Subscriber network profile management (VLAN, IPv6, static IP)",
    ),
    RouterEntry(
        module_path="dotmac.platform.ip_management.router",
        router_name="router",
        prefix="",  # /ip-management at mount root
        tags=("IP Management",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Static IP pool management, reservations, and conflict detection",
    ),
    RouterEntry(
        module_path="dotmac.platform.netbox.router",
        router_name="router",
        prefix="",  # /netbox at mount root
        tags=("NetBox",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="NetBox IPAM and DCIM integration",
    ),
    RouterEntry(
        module_path="dotmac.platform.genieacs.router",
        router_name="router",
        prefix="",  # /genieacs at mount root
        tags=("GenieACS",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="GenieACS CPE management (TR-069/CWMP)",
    ),
    RouterEntry(
        module_path="dotmac.platform.voltha.router",
        router_name="router",
        prefix="",  # /voltha at mount root
        tags=("VOLTHA",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="VOLTHA PON network management (OLT/ONU)",
    ),
    RouterEntry(
        module_path="dotmac.platform.wireless.router",
        router_name="router",
        prefix="",  # /wireless at mount root
        tags=("Wireless Infrastructure",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Wireless network infrastructure management",
    ),
    RouterEntry(
        module_path="dotmac.platform.fiber.router",
        router_name="router",
        prefix="",  # /fiber at mount root
        tags=("Fiber Infrastructure",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Fiber optic network infrastructure management",
    ),
    RouterEntry(
        module_path="dotmac.platform.ansible.router",
        router_name="router",
        prefix="",  # /ansible at mount root
        tags=("Ansible",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Ansible AWX automation workflows",
    ),
    RouterEntry(
        module_path="dotmac.platform.wireguard.router",
        router_name="router",
        prefix="",  # /wireguard at mount root
        tags=("WireGuard VPN",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="WireGuard VPN server and peer management",
    ),
    # --- Service Lifecycle ---
    RouterEntry(
        module_path="dotmac.platform.services.router",
        router_name="router",
        prefix="",  # /orchestration at mount root
        tags=("Orchestration",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Service lifecycle orchestration and provisioning workflows",
    ),
    RouterEntry(
        module_path="dotmac.platform.services.lifecycle.router",
        router_name="router",
        prefix="/services",
        tags=("Services - Lifecycle",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Service provisioning, activation, suspension, and termination",
    ),
    RouterEntry(
        module_path="dotmac.platform.services.internet_plans.router",
        router_name="router",
        prefix="",  # /services/internet-plans at mount root
        tags=("ISP - Internet Plans",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="ISP internet service plan management with validation and testing",
    ),
    RouterEntry(
        module_path="dotmac.platform.subscribers.router",
        router_name="router",
        prefix="/subscribers",
        tags=("Subscribers",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Subscriber management (CRUD + RADIUS/Billing integration)",
    ),
    # --- Support & Partners ---
    RouterEntry(
        module_path="dotmac.platform.ticketing.router",
        router_name="router",
        prefix="",  # /tickets at mount root
        tags=("Ticketing",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Cross-organization ticketing workflows",
    ),
    RouterEntry(
        module_path="dotmac.platform.ticketing.availability_router",
        router_name="router",
        prefix="",  # /agents/availability at mount root
        tags=("Agent Availability",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Agent availability status management",
    ),
    RouterEntry(
        module_path="dotmac.platform.partner_management.router",
        router_name="router",
        prefix="",  # /partners at mount root
        base_prefix=PARTNER_PREFIX,
        tags=("Partner Management",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Partner relationship management",
    ),
    RouterEntry(
        module_path="dotmac.platform.partner_management.portal_router",
        router_name="router",
        prefix="/partners",
        base_prefix=PARTNER_PREFIX,
        tags=("Partner Portal",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Partner self-service portal",
    ),
    RouterEntry(
        module_path="dotmac.platform.partner_management.revenue_router",
        router_name="router",
        prefix="/partners",
        base_prefix=PARTNER_PREFIX,
        tags=("Partner Revenue",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Partner revenue sharing and commissions",
    ),
    RouterEntry(
        module_path="dotmac.platform.partner_management.partner_multitenant_router",
        router_name="router",
        prefix="",  # /partner-accounts at mount root
        base_prefix=PARTNER_PREFIX,
        tags=("Partner Multi-Tenant",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Partner multi-tenant account management (MSP/Enterprise HQ)",
    ),
    # --- Infrastructure & Operations ---
    RouterEntry(
        module_path="dotmac.platform.fault_management.router",
        router_name="router",
        prefix="",  # /faults at mount root
        tags=("Fault Management",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Alarm management, SLA monitoring, and maintenance windows",
    ),
    RouterEntry(
        module_path="dotmac.platform.fault_management.oncall_router",
        router_name="router",
        prefix="",  # /oncall at mount root
        tags=("On-Call Management",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="On-call schedule and rotation management",
    ),
    RouterEntry(
        module_path="dotmac.platform.jobs.router",
        router_name="router",
        prefix="",  # /jobs at mount root
        tags=("Jobs",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Async job tracking and management",
    ),
    RouterEntry(
        module_path="dotmac.platform.jobs.scheduler_router",
        router_name="router",
        prefix="",  # /jobs/scheduler at mount root
        tags=("Job Scheduler",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Scheduled jobs and job chain management",
    ),
    RouterEntry(
        module_path="dotmac.platform.workflows.router",
        router_name="router",
        prefix="",  # /workflows at mount root
        tags=("Workflows",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Workflow orchestration and automation",
    ),
    RouterEntry(
        module_path="dotmac.platform.metrics.router",
        router_name="router",
        prefix="",  # /metrics at mount root
        tags=("Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="ISP metrics and KPIs with caching",
    ),
    # --- Field Service ---
    RouterEntry(
        module_path="dotmac.platform.field_service.router",
        router_name="router",
        prefix="",  # /field-service at mount root
        tags=("Field Service",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Technician management, location tracking, and job assignment",
    ),
    RouterEntry(
        module_path="dotmac.platform.project_management.router",
        router_name="router",
        prefix="",  # /projects at mount root
        tags=("Project Management",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Project, task, and team management for field service",
    ),
    RouterEntry(
        module_path="dotmac.platform.project_management.template_router",
        router_name="router",
        prefix="",  # /project-templates at mount root
        tags=("Project Templates",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Template builder for auto-generating projects from orders",
    ),
    RouterEntry(
        module_path="dotmac.platform.project_management.scheduling_router",
        router_name="router",
        prefix="",  # /scheduling at mount root
        tags=("Scheduling",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Technician scheduling, task assignment, and availability",
    ),
    RouterEntry(
        module_path="dotmac.platform.project_management.time_resource_router",
        router_name="router",
        prefix="",  # /time-tracking at mount root
        tags=("Time Tracking", "Resource Management"),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Clock in/out time tracking and equipment/vehicle management",
    ),
    RouterEntry(
        module_path="dotmac.platform.geo.router",
        router_name="router",
        prefix="",  # /geo at mount root
        tags=("Geographic Services",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Geocoding and routing services using OpenStreetMap",
    ),
    # --- Integrations & Utilities ---
    RouterEntry(
        module_path="dotmac.platform.webhooks.router",
        router_name="router",
        prefix="",  # /webhooks at mount root
        tags=("Webhooks",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Generic webhook subscription and event management",
    ),
    RouterEntry(
        module_path="dotmac.platform.integrations.router",
        router_name="integrations_router",
        prefix="",  # /integrations at mount root
        tags=("Integrations",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="External service integrations (Email, SMS, Storage, etc.)",
    ),
    RouterEntry(
        module_path="dotmac.platform.communications.router",
        router_name="router",
        prefix="",  # /communications at mount root
        tags=("Communications",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Communications API with email, templates, and background tasks",
    ),
    RouterEntry(
        module_path="dotmac.platform.search.router",
        router_name="search_router",
        prefix="/search",
        tags=("Search",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Search functionality",
    ),
    RouterEntry(
        module_path="dotmac.platform.data_transfer.router",
        router_name="data_transfer_router",
        prefix="",  # /data-transfer at mount root
        tags=("Data Transfer",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Data import/export operations",
    ),
    RouterEntry(
        module_path="dotmac.platform.data_import.router",
        router_name="router",
        prefix="",  # /data-import at mount root
        tags=("Data Import",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="File-based data import operations (CSV, JSON)",
    ),
    RouterEntry(
        module_path="dotmac.platform.rate_limit.router",
        router_name="router",
        prefix="",  # /rate-limits at mount root
        tags=("Rate Limiting",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Rate limit rule management and monitoring",
    ),
    RouterEntry(
        module_path="dotmac.platform.tenant.usage_billing_router",
        router_name="router",
        prefix="/tenants",
        tags=("Tenant Usage Billing",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Usage tracking and billing integration",
    ),
    RouterEntry(
        module_path="dotmac.platform.tenant.oss_router",
        router_name="router",
        prefix="",  # /tenant/oss at mount root
        tags=("Tenant OSS",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Tenant-specific OSS integration configuration",
    ),
    RouterEntry(
        module_path="dotmac.platform.tenant.branding_router",
        router_name="router",
        prefix="",  # /branding at mount root
        tags=("Branding",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Tenant branding and white-labeling configuration",
    ),
    RouterEntry(
        module_path="dotmac.platform.tenant.isp_settings_router",
        router_name="router",
        prefix="",  # /isp-settings at mount root
        tags=("ISP Settings",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="ISP-specific configuration settings",
    ),
    # --- Metrics Routers ---
    RouterEntry(
        module_path="dotmac.platform.monitoring_metrics_router",
        router_name="logs_router",
        prefix="",  # /monitoring/logs at mount root
        tags=("Logs",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Application logs and error monitoring",
    ),
    RouterEntry(
        module_path="dotmac.platform.monitoring_metrics_router",
        router_name="metrics_router",
        prefix="",  # /monitoring/metrics at mount root
        tags=("Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Performance and resource metrics",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.metrics_router",
        router_name="router",
        prefix="",  # /billing/metrics at mount root
        tags=("Billing Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Billing overview metrics (MRR, ARR, invoices, payments)",
    ),
    RouterEntry(
        module_path="dotmac.platform.billing.metrics_router",
        router_name="customer_metrics_router",
        prefix="",  # /customers/metrics at mount root
        tags=("Customer Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Customer metrics with growth and churn analysis",
    ),
    RouterEntry(
        module_path="dotmac.platform.auth.metrics_router",
        router_name="router",
        prefix="",  # /auth/metrics at mount root
        tags=("Auth Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Authentication and security metrics",
    ),
    RouterEntry(
        module_path="dotmac.platform.communications.metrics_router",
        router_name="router",
        prefix="",  # /communications/metrics at mount root
        tags=("Communications Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Communication stats (emails, SMS, delivery rates)",
    ),
    RouterEntry(
        module_path="dotmac.platform.file_storage.metrics_router",
        router_name="router",
        prefix="",  # /files/metrics at mount root
        tags=("File Storage Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="File storage stats (uploads, storage usage, file types)",
    ),
    RouterEntry(
        module_path="dotmac.platform.analytics.metrics_router",
        router_name="router",
        prefix="",  # /analytics/activity at mount root
        tags=("Analytics Activity",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Analytics activity stats (events, user activity, API usage)",
    ),
    RouterEntry(
        module_path="dotmac.platform.auth.api_keys_metrics_router",
        router_name="router",
        prefix="",  # /api-keys/metrics at mount root
        tags=("API Keys Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="API key metrics (creation, usage, security)",
    ),
    RouterEntry(
        module_path="dotmac.platform.secrets.metrics_router",
        router_name="router",
        prefix="",  # /secrets/metrics at mount root
        tags=("Secrets Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Secrets metrics (access patterns, security)",
    ),
    RouterEntry(
        module_path="dotmac.platform.monitoring.metrics_router",
        router_name="router",
        prefix="",  # /monitoring/stats at mount root
        tags=("Monitoring Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Monitoring metrics (system health, performance, logs)",
    ),
    RouterEntry(
        module_path="dotmac.platform.workflows.metrics_router",
        router_name="router",
        prefix="",  # /workflows/metrics at mount root
        tags=("Workflow Metrics",),
        scope=ServiceScope.ISP,
        requires_auth=True,
        description="Workflow services metrics (operations, performance, errors)",
    ),
)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def get_routers_for_scope(
    scope: ServiceScope,
    include_shared: bool = True,
) -> list[RouterEntry]:
    """
    Get all routers for a specific service scope.

    Args:
        scope: Service scope to filter by
        include_shared: Include SHARED scope routers (default True)

    Returns:
        List of RouterEntry objects for the specified scope.
    """
    routers = []
    for entry in ROUTER_REGISTRY:
        if entry.scope == scope:
            routers.append(entry)
        elif include_shared and entry.scope == ServiceScope.SHARED:
            routers.append(entry)
    return routers


def get_all_routers() -> list[RouterEntry]:
    """Get all routers in the registry."""
    return list(ROUTER_REGISTRY)


def validate_registry() -> tuple[list[str], list[str]]:
    """
    Validate the router registry for duplicates and import errors.

    Returns:
        Tuple of (errors, warnings) lists.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # Check for duplicate registrations
    seen: set[tuple[str, str, str]] = set()
    for entry in ROUTER_REGISTRY:
        key = (entry.module_path, entry.router_name, entry.prefix)
        if key in seen:
            errors.append(
                f"Duplicate router: {entry.module_path}:{entry.router_name} at {entry.prefix}"
            )
        seen.add(key)

    # Check for deprecated routers
    for entry in ROUTER_REGISTRY:
        if entry.deprecated:
            warnings.append(f"Deprecated router: {entry.description}")

    return errors, warnings


def register_routers_for_scope(
    app: FastAPI,
    scope: ServiceScope,
    include_shared: bool = True,
    auth_dependency: Any = None,
    default_base_prefix: str = "",
    prefix: str = "",
) -> tuple[int, int]:
    """
    Register all routers for a specific service scope with a FastAPI app.

    Args:
        app: FastAPI application instance
        scope: Service scope to register
        include_shared: Include SHARED scope routers
        default_base_prefix: Base prefix to prepend when an entry doesn't specify one (e.g., "/admin")
        auth_dependency: Authentication dependency to use (if None, uses default)
        prefix: Optional outer prefix applied to every router (e.g., mount path)

    Returns:
        Tuple of (registered_count, failed_count).
    """
    from fastapi import Depends

    # Import auth dependency if not provided
    if auth_dependency is None:
        try:
            from dotmac.platform.auth.dependencies import get_current_user

            auth_dependency = get_current_user
        except ImportError:
            logger.warning("Could not import get_current_user, auth will not be enforced")
            auth_dependency = None

    routers = get_routers_for_scope(scope, include_shared)
    registered = 0
    failed = 0

    def _combine_prefixes(*parts: str) -> str:
        combined = ""
        for part in parts:
            if not part:
                continue
            normalized = part if part.startswith("/") else f"/{part}"
            combined = f"{combined.rstrip('/')}{normalized}"
        return combined

    for entry in routers:
        try:
            # Dynamically import the module
            module = importlib.import_module(entry.module_path)
            router = getattr(module, entry.router_name)

            # Add auth dependency if required
            dependencies = None
            if entry.requires_auth and auth_dependency is not None:
                dependencies = [Depends(auth_dependency)]

            # Build full prefix: default base prefix + entry-specific base prefix + router prefix
            base_prefix = entry.base_prefix or default_base_prefix
            full_prefix = _combine_prefixes(prefix, base_prefix, entry.prefix)

            # Register the router
            app.include_router(
                router,
                prefix=full_prefix,
                tags=list(entry.tags),
                dependencies=dependencies,
            )

            logger.info(
                "router.registered",
                router=entry.router_name,
                prefix=full_prefix,
                scope=scope.value,
                description=entry.description,
            )
            registered += 1

        except ImportError as e:
            logger.warning(
                "router.import_failed",
                module=entry.module_path,
                router=entry.router_name,
                error=str(e),
            )
            failed += 1
        except AttributeError as e:
            logger.error(
                "router.not_found",
                module=entry.module_path,
                router=entry.router_name,
                error=str(e),
            )
            failed += 1
        except Exception as e:
            logger.error(
                "router.registration_failed",
                module=entry.module_path,
                router=entry.router_name,
                error=str(e),
            )
            failed += 1

    logger.info(
        "routers.registration_complete",
        scope=scope.value,
        registered=registered,
        failed=failed,
        total=len(routers),
    )

    return registered, failed


def register_graphql_endpoint(app: FastAPI, path: str = "/graphql") -> bool:
    """
    Register the GraphQL endpoint with the application.

    Args:
        app: FastAPI application instance
        path: Path for the GraphQL endpoint (relative to mount point)

    Returns:
        True if registration successful, False otherwise.
    """
    try:
        from strawberry.fastapi import GraphQLRouter

        from dotmac.platform.graphql.context import Context
        from dotmac.platform.graphql.schema import schema

        graphql_context_getter = cast(
            Callable[..., Awaitable[Context] | Context | None],
            Context.get_context,
        )
        graphql_app = GraphQLRouter(
            schema,
            path=path,
            context_getter=graphql_context_getter,
        )

        app.include_router(graphql_app)
        logger.info("graphql.registered", path=path)
        return True

    except ImportError as e:
        logger.warning("graphql.import_failed", error=str(e))
        return False
    except Exception as e:
        logger.error("graphql.registration_failed", error=str(e))
        return False
