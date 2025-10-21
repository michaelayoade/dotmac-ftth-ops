#!/usr/bin/env python3
"""
Script to add explicit prefixes to all routers that are missing them.

This makes routers self-documenting and prevents routing collisions if RouterConfig changes.
"""

import re
from pathlib import Path
from typing import Dict

# Mapping of router files to their expected prefixes (from RouterConfig)
ROUTER_PREFIX_MAP: Dict[str, str] = {
    "src/dotmac/platform/analytics/metrics_router.py": "/api/v1",
    "src/dotmac/platform/analytics/router.py": "/api/v1/analytics",
    "src/dotmac/platform/audit/router.py": "/api/v1/audit",
    "src/dotmac/platform/auth/api_keys_metrics_router.py": "/api/v1",
    "src/dotmac/platform/auth/api_keys_router.py": "/api/v1/auth/api-keys",
    "src/dotmac/platform/auth/metrics_router.py": "/api/v1",
    "src/dotmac/platform/auth/platform_admin_router.py": "/api/v1/admin/platform",
    "src/dotmac/platform/auth/rbac_read_router.py": "/api/v1/auth/rbac",
    "src/dotmac/platform/auth/rbac_router.py": "/api/v1/auth/rbac/admin",
    "src/dotmac/platform/auth/router.py": "/api/v1/auth",
    "src/dotmac/platform/billing/bank_accounts/router.py": "/api/v1/billing/bank-accounts",
    "src/dotmac/platform/billing/dunning/router.py": "/api/v1/billing/dunning",
    "src/dotmac/platform/billing/metrics_router.py": "/api/v1",  # Both routers in this file
    "src/dotmac/platform/billing/pricing/router.py": "/api/v1/billing/pricing",
    "src/dotmac/platform/billing/router.py": "/api/v1/billing",
    "src/dotmac/platform/billing/subscriptions/router.py": "/api/v1/billing/subscriptions",
    "src/dotmac/platform/communications/metrics_router.py": "/api/v1",
    "src/dotmac/platform/communications/router.py": "/api/v1/communications",
    "src/dotmac/platform/config/router.py": "/api/v1",
    "src/dotmac/platform/contacts/router.py": "/api/v1/contacts",
    "src/dotmac/platform/customer_management/router.py": "/api/v1/customers",
    "src/dotmac/platform/data_import/router.py": "/api/v1/data-import",
    "src/dotmac/platform/data_transfer/router.py": "/api/v1/data-transfer",
    "src/dotmac/platform/deployment/router.py": "/api/v1/deployments",
    "src/dotmac/platform/diagnostics/router.py": "/api/v1",
    "src/dotmac/platform/feature_flags/router.py": "/api/v1/feature-flags",
    "src/dotmac/platform/file_storage/metrics_router.py": "/api/v1",
    "src/dotmac/platform/file_storage/router.py": "/api/v1/files/storage",
    "src/dotmac/platform/integrations/router.py": "/api/v1/integrations",
    "src/dotmac/platform/monitoring/logs_router.py": "/api/v1/monitoring",
    "src/dotmac/platform/monitoring/metrics_router.py": "/api/v1",
    "src/dotmac/platform/monitoring/traces_router.py": "/api/v1/observability",
    "src/dotmac/platform/monitoring_metrics_router.py": "/api/v1/logs",  # Both routers
    "src/dotmac/platform/partner_management/router.py": "/api/v1/partners",
    "src/dotmac/platform/rate_limit/router.py": "/api/v1/rate-limits",
    "src/dotmac/platform/sales/router.py": "/api/v1/orders",  # Main router, public_router has own prefix
    "src/dotmac/platform/search/router.py": "/api/v1/search",
    "src/dotmac/platform/secrets/metrics_router.py": "/api/v1",
    "src/dotmac/platform/tenant/domain_verification_router.py": "/api/v1/tenants",
    "src/dotmac/platform/tenant/onboarding_router.py": "/api/v1/tenants",
    "src/dotmac/platform/tenant/router.py": "/api/v1/tenant",
    "src/dotmac/platform/tenant/usage_billing_router.py": "/api/v1/usage",
    "src/dotmac/platform/ticketing/router.py": "/api/v1/tickets",
    "src/dotmac/platform/user_management/router.py": "/api/v1/users",
    "src/dotmac/platform/webhooks/router.py": "/api/v1/webhooks",
}

# Special cases with multiple routers in same file
MULTI_ROUTER_FILES = {
    "src/dotmac/platform/billing/metrics_router.py": [
        ("router", "/api/v1"),
        ("customer_metrics_router", "/api/v1"),
    ],
    "src/dotmac/platform/monitoring_metrics_router.py": [
        ("logs_router", "/api/v1/logs"),
        ("metrics_router", "/api/v1/metrics"),
    ],
    "src/dotmac/platform/sales/router.py": [
        ("public_router", "/api/public/orders"),
        ("router", "/api/v1/orders"),
    ],
}


def add_prefix_to_apirouter(content: str, router_name: str, prefix: str) -> tuple[str, bool]:
    """
    Add prefix parameter to APIRouter instantiation if missing.

    Returns:
        Tuple of (modified_content, was_modified)
    """
    # Pattern to match APIRouter instantiation for specific router variable
    # Handles various formats:
    # router = APIRouter(tags=[...])
    # router = APIRouter(
    #     tags=[...],
    # )
    pattern = rf'^({router_name}\s*=\s*APIRouter\()'

    modified = False
    lines = content.split('\n')
    new_lines = []

    for i, line in enumerate(lines):
        match = re.match(pattern, line.strip())
        if match:
            # Check if prefix already exists
            if 'prefix=' in line or (i + 1 < len(lines) and 'prefix=' in lines[i + 1]):
                # Prefix already exists, skip
                new_lines.append(line)
                continue

            # Check if it's single-line or multi-line APIRouter
            if line.strip().endswith(')'):
                # Single line: router = APIRouter(tags=[...])
                # Insert prefix before closing parenthesis
                new_line = line.replace('APIRouter(', f'APIRouter(prefix="{prefix}", ')
                new_lines.append(new_line)
                modified = True
            else:
                # Multi-line: add prefix as first parameter
                new_lines.append(line)
                # Add prefix on next line with proper indentation
                indent = len(line) - len(line.lstrip())
                prefix_line = ' ' * (indent + 4) + f'prefix="{prefix}",'
                new_lines.append(prefix_line)
                modified = True
        else:
            new_lines.append(line)

    return '\n'.join(new_lines), modified


def process_file(file_path: Path, prefix: str) -> bool:
    """
    Process a single router file to add prefix.

    Returns:
        True if file was modified, False otherwise
    """
    print(f"Processing: {file_path}")

    try:
        content = file_path.read_text()

        # Check if this is a special multi-router file
        relative_path = str(file_path).replace('/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/', '')

        if relative_path in MULTI_ROUTER_FILES:
            # Handle multiple routers in same file
            modified_overall = False
            for router_name, router_prefix in MULTI_ROUTER_FILES[relative_path]:
                content, was_modified = add_prefix_to_apirouter(content, router_name, router_prefix)
                if was_modified:
                    print(f"  ✓ Added prefix '{router_prefix}' to {router_name}")
                    modified_overall = True
                else:
                    print(f"  - Skipped {router_name} (already has prefix)")

            if modified_overall:
                file_path.write_text(content)
            return modified_overall
        else:
            # Single router file - infer router variable name from file
            router_name = infer_router_name(file_path, content)
            content, was_modified = add_prefix_to_apirouter(content, router_name, prefix)

            if was_modified:
                file_path.write_text(content)
                print(f"  ✓ Added prefix '{prefix}' to {router_name}")
            else:
                print(f"  - Skipped (already has prefix)")

            return was_modified

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def infer_router_name(file_path: Path, content: str) -> str:
    """Infer router variable name from file content."""
    # Common patterns
    patterns = [
        r'^(auth_router)\s*=\s*APIRouter',
        r'^(analytics_router)\s*=\s*APIRouter',
        r'^(health_router)\s*=\s*APIRouter',
        r'^(data_transfer_router)\s*=\s*APIRouter',
        r'^(feature_flags_router)\s*=\s*APIRouter',
        r'^(file_storage_router)\s*=\s*APIRouter',
        r'^(integrations_router)\s*=\s*APIRouter',
        r'^(logs_router)\s*=\s*APIRouter',
        r'^(traces_router)\s*=\s*APIRouter',
        r'^(search_router)\s*=\s*APIRouter',
        r'^(user_router)\s*=\s*APIRouter',
        r'^(router)\s*=\s*APIRouter',
    ]

    for pattern in patterns:
        match = re.search(pattern, content, re.MULTILINE)
        if match:
            return match.group(1)

    # Default fallback
    return "router"


def main():
    """Main execution function."""
    print("=" * 80)
    print("Router Prefix Addition Script")
    print("=" * 80)
    print()

    base_path = Path("/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops")
    modified_count = 0
    skipped_count = 0
    error_count = 0

    for relative_path, prefix in ROUTER_PREFIX_MAP.items():
        file_path = base_path / relative_path

        if not file_path.exists():
            print(f"✗ File not found: {file_path}")
            error_count += 1
            continue

        was_modified = process_file(file_path, prefix)
        if was_modified:
            modified_count += 1
        else:
            skipped_count += 1

    print()
    print("=" * 80)
    print("Summary:")
    print(f"  Modified: {modified_count} files")
    print(f"  Skipped:  {skipped_count} files (already had prefix)")
    print(f"  Errors:   {error_count} files")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Review the changes with: git diff")
    print("  2. Test the application to ensure routes still work")
    print("  3. Run tests: poetry run pytest")
    print("  4. Commit if everything works correctly")
    print()


if __name__ == "__main__":
    main()
