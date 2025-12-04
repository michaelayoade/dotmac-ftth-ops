#!/usr/bin/env python3
"""
URL Structure Verification Script.

Verifies that the router registry + module prefixes + mount points
produce the expected URL paths without double-prefixing.

Usage:
    python scripts/verify_url_structure.py
    python scripts/verify_url_structure.py --verbose

Exit codes:
    0 - Verification passed
    1 - Verification failed
"""

from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path

# Add src to path for imports
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from dotmac.shared.routers.registry import (
    ROUTER_REGISTRY,
    ServiceScope,
    get_routers_for_scope,
)


class Colors:
    """ANSI color codes for terminal output."""
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def colorize(text: str, color: str) -> str:
    """Add color to text if terminal supports it."""
    if sys.stdout.isatty():
        return f"{color}{text}{Colors.RESET}"
    return text


# Mount points and default base prefixes for each service scope
MOUNT_POINTS = {
    ServiceScope.CONTROLPLANE: "/api/platform/v1",
    ServiceScope.ISP: "/api/isp/v1",
}

DEFAULT_BASE_PREFIX = {
    ServiceScope.CONTROLPLANE: "/admin",
    ServiceScope.ISP: "/admin",
}


def get_router_internal_prefix(module_path: str, router_name: str) -> str | None:
    """Get the prefix defined in the router's APIRouter constructor."""
    try:
        module = importlib.import_module(module_path)
        router = getattr(module, router_name)
        return router.prefix
    except Exception:
        return None


def verify_no_double_api_v1(verbose: bool = False) -> list[str]:
    """
    Check that no route ends up with double /api/v1 prefix.

    Returns list of error messages.
    """
    errors = []

    for entry in ROUTER_REGISTRY:
        # Get internal router prefix
        internal_prefix = get_router_internal_prefix(entry.module_path, entry.router_name)
        if internal_prefix is None:
            continue

        # Check for /api/v1 in either prefix
        registry_has_api_v1 = "/api/v1" in entry.prefix or "/api/v1" in entry.base_prefix
        internal_has_api_v1 = "/api/v1" in internal_prefix

        if registry_has_api_v1:
            errors.append(
                f"Registry prefix contains /api/v1: {entry.module_path}:{entry.router_name} "
                f"prefix='{entry.prefix}'"
            )

        if internal_has_api_v1:
            errors.append(
                f"Router internal prefix contains /api/v1: {entry.module_path}:{entry.router_name} "
                f"internal_prefix='{internal_prefix}'"
            )

    return errors


def verify_mount_points(verbose: bool = False) -> list[str]:
    """
    Verify that routes are mounted at correct paths.

    Returns list of error messages.
    """
    errors = []

    # Check ISP routes
    isp_routers = get_routers_for_scope(ServiceScope.ISP, include_shared=False)
    if verbose:
        print(f"\n{colorize('ISP Routes (mounted at /api/isp/v1):', Colors.BLUE)}")

    for entry in isp_routers:
        internal_prefix = get_router_internal_prefix(entry.module_path, entry.router_name) or ""
        base_prefix = entry.base_prefix or DEFAULT_BASE_PREFIX[ServiceScope.ISP]
        full_path = f"/api/isp/v1{base_prefix}{entry.prefix}{internal_prefix}"

        if verbose:
            print(f"  {entry.router_name}: {full_path}")

        # Check for obvious issues
        if "/api/v1/api/v1" in full_path:
            errors.append(f"Double /api/v1 in path: {full_path}")
        if "///" in full_path:
            errors.append(f"Triple slash in path: {full_path}")

    # Check CONTROLPLANE routes
    cp_routers = get_routers_for_scope(ServiceScope.CONTROLPLANE, include_shared=False)
    if verbose:
        print(f"\n{colorize('CONTROLPLANE Routes (mounted at /api/platform/v1):', Colors.BLUE)}")

    for entry in cp_routers:
        internal_prefix = get_router_internal_prefix(entry.module_path, entry.router_name) or ""
        base_prefix = entry.base_prefix or DEFAULT_BASE_PREFIX[ServiceScope.CONTROLPLANE]
        full_path = f"/api/platform/v1{base_prefix}{entry.prefix}{internal_prefix}"

        if verbose:
            print(f"  {entry.router_name}: {full_path}")

        # Check for obvious issues
        if "/api/v1/api/v1" in full_path:
            errors.append(f"Double /api/v1 in path: {full_path}")
        if "///" in full_path:
            errors.append(f"Triple slash in path: {full_path}")

    # Check SHARED routes
    shared_routers = [r for r in ROUTER_REGISTRY if r.scope == ServiceScope.SHARED]
    if verbose:
        print(f"\n{colorize('SHARED Routes (registered on both apps):', Colors.BLUE)}")

    for entry in shared_routers:
        internal_prefix = get_router_internal_prefix(entry.module_path, entry.router_name) or ""
        # Show example with ISP mount
        base_prefix = entry.base_prefix or DEFAULT_BASE_PREFIX[ServiceScope.ISP]
        full_path = f"/api/isp/v1{base_prefix}{entry.prefix}{internal_prefix}"

        if verbose:
            print(f"  {entry.router_name}: {full_path} (also at /api/platform/v1...)")

        if "/api/v1/api/v1" in full_path:
            errors.append(f"Double /api/v1 in path: {full_path}")

    return errors


def print_expected_paths() -> None:
    """Print expected URL paths for key endpoints."""
    print(f"\n{colorize('Expected URL Paths:', Colors.BOLD)}")
    print("=" * 60)

    examples = [
        ("Customer list", "/api/isp/v1/admin/customers/"),
        ("Customer by ID", "/api/isp/v1/admin/customers/{id}"),
        ("Billing overview", "/api/isp/v1/admin/billing/"),
        ("RADIUS subscribers", "/api/isp/v1/admin/radius/subscribers/"),
        ("Auth login", "/api/isp/v1/admin/auth/login"),
        ("Tenant list (platform)", "/api/platform/v1/admin/tenants/"),
        ("Licensing", "/api/platform/v1/admin/licensing/"),
        ("Health check (root)", "/health"),
    ]

    for name, path in examples:
        print(f"  {name:30} {path}")


def main() -> int:
    """Run URL structure verification."""
    parser = argparse.ArgumentParser(description="Verify URL structure")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    print(f"\n{colorize('DotMac URL Structure Verification', Colors.BOLD)}")
    print("=" * 60)

    all_errors: list[str] = []

    # Check for /api/v1 in prefixes
    print(f"\n{colorize('Checking for /api/v1 in prefixes...', Colors.BLUE)}")
    errors = verify_no_double_api_v1(args.verbose)
    all_errors.extend(errors)
    if not errors:
        print(f"  {colorize('✓', Colors.GREEN)} No /api/v1 found in prefixes")
    else:
        for e in errors:
            print(f"  {colorize('✗', Colors.RED)} {e}")

    # Verify mount points
    print(f"\n{colorize('Verifying mount point composition...', Colors.BLUE)}")
    errors = verify_mount_points(args.verbose)
    all_errors.extend(errors)
    if not errors:
        print(f"  {colorize('✓', Colors.GREEN)} Mount points look correct")
    else:
        for e in errors:
            print(f"  {colorize('✗', Colors.RED)} {e}")

    # Print expected paths
    if args.verbose:
        print_expected_paths()

    # Summary
    print()
    if all_errors:
        print(f"{colorize('Errors:', Colors.RED)}")
        for e in all_errors:
            print(f"  ✗ {e}")
        print()
        print(f"{colorize('VERIFICATION FAILED', Colors.RED)}")
        return 1

    print(f"{colorize('VERIFICATION PASSED', Colors.GREEN)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
