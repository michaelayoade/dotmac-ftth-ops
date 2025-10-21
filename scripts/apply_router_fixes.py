#!/usr/bin/env python3
"""
Apply router prefix fixes to routers.py.

This script reads routers.py, applies all the prefix fixes, and writes the corrected version.
"""

import re
from pathlib import Path


# Define all the prefix replacements
# Format: (module_path_pattern, old_prefix, new_prefix, comment)
FIXES = [
    # Auth routers
    ('auth.rbac_read_router', '/api/v1/auth/rbac', '/api/v1', 'Module has /auth/rbac prefix'),
    ('auth.rbac_router', '/api/v1/auth/rbac/admin', '/api/v1', 'Module has /auth/rbac/admin prefix'),
    ('auth.platform_admin_router', '/api/v1/admin/platform', '/api/v1', 'Module has /admin/platform prefix'),
    ('auth.api_keys_router', '/api/v1/auth/api-keys', '/api/v1', 'Module has /auth/api-keys prefix'),

    # Core operations
    ('billing.router', '/api/v1/billing', '/api/v1', 'Module has /billing prefix'),
    ('customer_management.router', '/api/v1/customers', '/api/v1', 'Module has /customers prefix'),
    ('radius.router', '/api/v1/radius', '/api/v1', 'Module has /radius prefix'),
    ('netbox.router', '/api/v1/netbox', '/api/v1', 'Module has /netbox prefix'),

    # Tenant management (need special handling for duplicate registrations)
    ('tenant.onboarding_router', '/api/v1/tenants', '/api/v1', 'Module has /tenants prefix'),
    ('tenant.domain_verification_router', '/api/v1/tenants', '/api/v1', 'Module has /tenants prefix'),
    ('tenant.usage_billing_router', '/api/v1/usage', '/api/v1', 'Module has /usage prefix'),
    ('tenant.oss_router', '/api/v1/tenant/oss', '/api/v1', 'Module has /tenant/oss prefix'),

    # OSS integrations
    ('genieacs.router', '/api/v1/genieacs', '/api/v1', 'Module has /genieacs prefix'),
    ('voltha.router', '/api/v1/voltha', '/api/v1', 'Module has /voltha prefix'),
    ('ansible.router', '/api/v1/ansible', '/api/v1', 'Module has /ansible prefix'),

    # Support & operations
    ('ticketing.router', '/api/v1/tickets', '/api/v1', 'Module has /tickets prefix'),
    ('webhooks.router', '/api/v1/webhooks', '/api/v1', 'Module has /webhooks prefix'),
    ('user_management.router', '/api/v1/users', '/api/v1', 'Module has /users prefix'),
    ('user_management.team_router', '/api/v1/teams', '/api/v1', 'Module has /teams prefix'),
    ('contacts.router', '/api/v1/contacts', '/api/v1', 'Module has /contacts prefix'),
    ('metrics.router', '/api/v1/metrics', '/api/v1', 'Module has /metrics prefix'),
    ('audit.router', '/api/v1/audit', '/api/v1', 'Module has /audit prefix'),

    # Additional features
    ('analytics.router', '/api/v1/analytics', '/api/v1', 'Module has /analytics prefix'),
    ('search.router', '/api/v1/search', '/api/v1', 'Module has /search prefix'),
    ('jobs.router', '/api/v1/jobs', '/api/v1', 'Module has /jobs prefix'),
    ('jobs.scheduler_router', '/api/v1/jobs/scheduler', '/api/v1', 'Module has /jobs/scheduler prefix'),
    ('realtime.router', '/api/v1/realtime', '/api/v1', 'Module has /realtime prefix'),
    ('wireless.router', '/api/v1/wireless', '/api/v1', 'Module has /wireless prefix'),
    ('feature_flags.router', '/api/v1/feature-flags', '/api/v1', 'Module has /feature-flags prefix'),
    ('crm.router', '/api/v1/crm', '/api/v1', 'Module has /crm prefix'),
    ('partner_management.router', '/api/v1/partners', '/api/v1', 'Module has /partners prefix'),
    ('partner_management.portal_router', '/api/v1/partners/portal', '/api/v1/partners', 'Module has /portal prefix'),
    ('partner_management.revenue_router', '/api/v1/partners/revenue', '/api/v1/partners', 'Module has /revenue prefix'),
    ('integrations.router', '/api/v1/integrations', '/api/v1', 'Module has /integrations prefix'),
    ('deployment.router', '/api/v1/deployments', '/api/v1', 'Module has /deployments prefix'),
    ('rate_limit.router', '/api/v1/rate-limits', '/api/v1', 'Module has /rate-limits prefix'),

    # Billing sub-routers
    ('billing.subscriptions.router', '/api/v1/billing/subscriptions', '/api/v1', 'Module has /billing/subscriptions prefix'),
    ('billing.pricing.router', '/api/v1/billing/pricing', '/api/v1', 'Module has /billing/pricing prefix'),
    ('billing.bank_accounts.router', '/api/v1/billing/bank-accounts', '/api/v1', 'Module has /billing/bank-accounts prefix'),
    ('billing.settings.router', '/api/v1/billing/settings', '/api/v1/billing', 'Module has /settings prefix'),
    ('billing.reconciliation_router', '/api/v1/billing/reconciliations', '/api/v1/billing', 'Module has /reconciliations prefix'),
    ('billing.dunning.router', '/api/v1/billing/dunning', '/api/v1', 'Module has /billing/dunning prefix'),
    ('billing.invoicing.router', '/api/v1/billing/invoices', '/api/v1/billing', 'Module has /invoices prefix'),
    ('billing.invoicing.money_router', '/api/v1/billing/invoices/money', '/api/v1/billing/invoices', 'Module has /money prefix'),

    # Monitoring
    ('monitoring.logs_router', '/api/v1/monitoring', '/api/v1', 'Module has /monitoring prefix'),
    ('monitoring.traces_router', '/api/v1/observability', '/api/v1', 'Module has /observability prefix'),

    # Utilities
    ('communications.router', '/api/v1/communications', '/api/v1', 'Module has /communications prefix'),
    ('data_transfer.router', '/api/v1/data-transfer', '/api/v1', 'Module has /data-transfer prefix'),
    ('data_import.router', '/api/v1/data-import', '/api/v1', 'Module has /data-import prefix'),
    ('file_storage.router', '/api/v1/files/storage', '/api/v1', 'Module has /files/storage prefix'),

    # Public routes - special case (module has full path, so no prefix needed)
    # We'll handle this manually as it needs empty string prefix
]


def apply_fixes(content: str) -> tuple[str, int]:
    """
    Apply all prefix fixes to routers.py content.

    Returns:
        Tuple of (fixed_content, number_of_fixes_applied)
    """
    fixes_applied = 0

    for module_pattern, old_prefix, new_prefix, comment in FIXES:
        # Find RouterConfig blocks that match this module path
        # Pattern: module_path="dotmac.platform.{module_pattern}"
        #          ...
        #          prefix="{old_prefix}"

        pattern = (
            rf'(module_path="dotmac\.platform\.{re.escape(module_pattern)}".*?'
            rf'prefix=")({re.escape(old_prefix)})(")'
        )

        replacement = rf'\1{new_prefix}\3  # {comment}'

        new_content, count = re.subn(
            pattern,
            replacement,
            content,
            flags=re.DOTALL
        )

        if count > 0:
            content = new_content
            fixes_applied += count
            print(f"✅ Fixed {module_pattern}: {old_prefix} → {new_prefix} ({count} occurrence(s))")

    return content, fixes_applied


def main():
    """Main function to apply fixes."""
    routers_path = Path("src/dotmac/platform/routers.py")

    if not routers_path.exists():
        print(f"Error: {routers_path} not found")
        return 1

    print("=" * 80)
    print("Applying Router Prefix Fixes")
    print("=" * 80)
    print()

    # Read current content
    content = routers_path.read_text()

    # Apply fixes
    fixed_content, fixes_applied = apply_fixes(content)

    # Special handling for tenant.router (it appears twice)
    # First occurrence: prefix="/api/v1/tenants" → "/api/v1"  (routes to /api/v1/tenant)
    # Second occurrence: prefix="/api/v1/tenant" → "/api/v1" (legacy, routes to /api/v1/tenant)
    tenant_pattern = r'(module_path="dotmac\.platform\.tenant\.router".*?prefix=")(/api/v1/tenant(?:s)?)(")'

    matches = list(re.finditer(tenant_pattern, fixed_content, flags=re.DOTALL))
    if len(matches) >= 2:
        # Fix both occurrences
        fixed_content = re.sub(
            tenant_pattern,
            r'\1/api/v1\3  # Module has /tenant prefix',
            fixed_content,
            count=2,
            flags=re.DOTALL
        )
        fixes_applied += 2
        print(f"✅ Fixed tenant.router (2 occurrences): /api/v1/tenant* → /api/v1")

    # Fix monitoring_metrics_router entries (logs and metrics)
    monitoring_pattern1 = r'(module_path="dotmac\.platform\.monitoring_metrics_router".*?router_name="logs_router".*?prefix=")(/api/v1/logs)(")'
    fixed_content, count = re.subn(
        monitoring_pattern1,
        r'\1/api/v1\3  # Module has /logs prefix',
        fixed_content,
        flags=re.DOTALL
    )
    if count > 0:
        fixes_applied += count
        print(f"✅ Fixed monitoring_metrics_router (logs): /api/v1/logs → /api/v1")

    monitoring_pattern2 = r'(module_path="dotmac\.platform\.monitoring_metrics_router".*?router_name="metrics_router".*?prefix=")(/api/v1/metrics)(")'
    fixed_content, count = re.subn(
        monitoring_pattern2,
        r'\1/api/v1\3  # Module has /metrics prefix',
        fixed_content,
        flags=re.DOTALL
    )
    if count > 0:
        fixes_applied += count
        print(f"✅ Fixed monitoring_metrics_router (metrics): /api/v1/metrics → /api/v1")

    # Fix sales.router public_router (needs empty prefix)
    sales_pattern = r'(module_path="dotmac\.platform\.sales\.router".*?router_name="public_router".*?prefix=")(/api/public/orders)(")'
    fixed_content, count = re.subn(
        sales_pattern,
        r'\1\3  # Module has full /api/public/orders path',
        fixed_content,
        flags=re.DOTALL
    )
    if count > 0:
        fixes_applied += count
        print(f"✅ Fixed sales.router (public_router): /api/public/orders → empty (module has full path)")

    # Fix sales.router main router
    sales_pattern2 = r'(module_path="dotmac\.platform\.sales\.router".*?router_name="router".*?prefix=")(/api/v1/orders)(")'
    fixed_content, count = re.subn(
        sales_pattern2,
        r'\1/api/v1\3  # Module has /orders prefix',
        fixed_content,
        flags=re.DOTALL
    )
    if count > 0:
        fixes_applied += count
        print(f"✅ Fixed sales.router: /api/v1/orders → /api/v1")

    print()
    print("=" * 80)
    print(f"Total fixes applied: {fixes_applied}")
    print("=" * 80)

    # Write fixed content
    routers_path.write_text(fixed_content)
    print(f"\n✅ Fixed routers.py written to {routers_path}")

    return 0


if __name__ == "__main__":
    exit(main())
