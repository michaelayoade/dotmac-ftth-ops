#!/usr/bin/env python3
"""
Router Registry Validation Script.

Validates the declarative router registry for:
1. No duplicate router registrations
2. All router modules can be imported
3. All router objects exist in their modules
4. Proper service scope assignment

Usage:
    python scripts/validate_routers.py
    python scripts/validate_routers.py --verbose
    python scripts/validate_routers.py --scope isp

Exit codes:
    0 - Validation passed
    1 - Validation failed
"""

from __future__ import annotations

import argparse
import importlib
import sys
from collections import Counter
from pathlib import Path

# Add src to path for imports
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from dotmac.shared.routers.registry import (
    ROUTER_REGISTRY,
    RouterEntry,
    ServiceScope,
    get_routers_for_scope,
    validate_registry,
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


def validate_no_duplicates(verbose: bool = False) -> list[str]:
    """Check for duplicate router registrations."""
    errors: list[str] = []

    # Check by (module, router_name, prefix) - exact duplicates
    seen: dict[tuple[str, str, str], RouterEntry] = {}
    for entry in ROUTER_REGISTRY:
        key = (entry.module_path, entry.router_name, entry.prefix)
        if key in seen:
            errors.append(
                f"Duplicate registration: {entry.module_path}:{entry.router_name} "
                f"at prefix '{entry.prefix}' (first: {seen[key].description}, "
                f"second: {entry.description})"
            )
        else:
            seen[key] = entry

    # Check for potential prefix conflicts (same prefix, different routers)
    prefix_counter: Counter[str] = Counter()
    for entry in ROUTER_REGISTRY:
        if entry.prefix:
            prefix_counter[entry.prefix] += 1

    if verbose:
        for prefix, count in prefix_counter.most_common():
            if count > 1:
                print(f"  Info: Prefix '{prefix}' used by {count} routers")

    return errors


def validate_imports(verbose: bool = False) -> tuple[list[str], list[str]]:
    """Verify all router modules can be imported."""
    errors: list[str] = []
    warnings: list[str] = []

    checked_modules: set[str] = set()

    for entry in ROUTER_REGISTRY:
        if entry.module_path in checked_modules:
            continue

        checked_modules.add(entry.module_path)

        try:
            module = importlib.import_module(entry.module_path)

            # Check if router exists in module
            if not hasattr(module, entry.router_name):
                errors.append(
                    f"Router '{entry.router_name}' not found in {entry.module_path}"
                )
            elif verbose:
                print(f"  {colorize('✓', Colors.GREEN)} {entry.module_path}:{entry.router_name}")

        except ImportError as e:
            # Some modules may have optional dependencies
            if "user_management" in entry.module_path:
                warnings.append(f"Optional module not available: {entry.module_path} ({e})")
            else:
                errors.append(f"Cannot import {entry.module_path}: {e}")
        except Exception as e:
            errors.append(f"Error loading {entry.module_path}: {e}")

    return errors, warnings


def validate_scope_assignment(verbose: bool = False) -> list[str]:
    """Validate service scope assignments are reasonable."""
    warnings: list[str] = []

    # ISP-specific modules that shouldn't be in CONTROLPLANE
    isp_keywords = ["radius", "billing", "customer", "network", "fiber", "wireless"]

    # Platform-specific modules that shouldn't be in ISP
    platform_keywords = ["licensing", "deployment", "platform_admin"]

    for entry in ROUTER_REGISTRY:
        module_lower = entry.module_path.lower()

        if entry.scope == ServiceScope.CONTROLPLANE:
            for keyword in isp_keywords:
                if keyword in module_lower and "metrics" not in module_lower:
                    warnings.append(
                        f"ISP module in CONTROLPLANE scope: {entry.module_path} "
                        f"(contains '{keyword}')"
                    )
                    break

        elif entry.scope == ServiceScope.ISP:
            for keyword in platform_keywords:
                if keyword in module_lower:
                    warnings.append(
                        f"Platform module in ISP scope: {entry.module_path} "
                        f"(contains '{keyword}')"
                    )
                    break

    return warnings


def print_summary(scope: ServiceScope | None = None) -> None:
    """Print registry summary."""
    print(f"\n{colorize('Router Registry Summary', Colors.BOLD)}")
    print("=" * 50)

    if scope:
        routers = get_routers_for_scope(scope)
        print(f"Scope: {scope.value}")
        print(f"Total routers: {len(routers)}")
    else:
        scope_counts = Counter(entry.scope for entry in ROUTER_REGISTRY)
        print(f"Total routers: {len(ROUTER_REGISTRY)}")
        print()
        for s in ServiceScope:
            count = scope_counts.get(s, 0)
            print(f"  {s.value:15} {count:3} routers")

    # Count auth requirements
    auth_required = sum(1 for e in ROUTER_REGISTRY if e.requires_auth)
    auth_optional = len(ROUTER_REGISTRY) - auth_required
    print()
    print(f"Auth required:  {auth_required}")
    print(f"Public routes:  {auth_optional}")

    # Count deprecated
    deprecated = sum(1 for e in ROUTER_REGISTRY if e.deprecated)
    if deprecated:
        print(f"Deprecated:     {deprecated}")


def main() -> int:
    """Run all validations."""
    parser = argparse.ArgumentParser(description="Validate router registry")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--scope", choices=["controlplane", "isp", "shared", "legacy"],
                       help="Validate specific scope only")
    parser.add_argument("--summary", action="store_true", help="Print summary only")
    args = parser.parse_args()

    print(f"\n{colorize('DotMac Router Registry Validation', Colors.BOLD)}")
    print("=" * 50)

    if args.summary:
        scope = ServiceScope(args.scope) if args.scope else None
        print_summary(scope)
        return 0

    all_errors: list[str] = []
    all_warnings: list[str] = []

    # Run validations
    print(f"\n{colorize('Checking for duplicates...', Colors.BLUE)}")
    errors = validate_no_duplicates(args.verbose)
    all_errors.extend(errors)
    if not errors:
        print(f"  {colorize('✓', Colors.GREEN)} No duplicates found")

    print(f"\n{colorize('Validating imports...', Colors.BLUE)}")
    errors, warnings = validate_imports(args.verbose)
    all_errors.extend(errors)
    all_warnings.extend(warnings)
    if not errors:
        print(f"  {colorize('✓', Colors.GREEN)} All modules importable")

    print(f"\n{colorize('Validating scope assignments...', Colors.BLUE)}")
    warnings = validate_scope_assignment(args.verbose)
    all_warnings.extend(warnings)
    if not warnings:
        print(f"  {colorize('✓', Colors.GREEN)} Scope assignments look correct")

    # Built-in validation
    errors, warnings = validate_registry()
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # Print results
    print()

    if all_warnings:
        print(f"{colorize('Warnings:', Colors.YELLOW)}")
        for w in all_warnings:
            print(f"  ⚠ {w}")
        print()

    if all_errors:
        print(f"{colorize('Errors:', Colors.RED)}")
        for e in all_errors:
            print(f"  ✗ {e}")
        print()
        print(f"{colorize('VALIDATION FAILED', Colors.RED)}")
        return 1

    print_summary()
    print()
    print(f"{colorize('VALIDATION PASSED', Colors.GREEN)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
