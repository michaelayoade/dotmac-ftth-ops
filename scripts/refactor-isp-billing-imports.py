#!/usr/bin/env python3
"""
ISP Billing Import Refactoring Script

This script helps migrate dotmac.platform.billing imports to:
- dotmac.shared.billing (for neutral types: enums, exceptions, DTOs)
- dotmac.isp.billing (for ISP-local models/services)

Usage:
    python scripts/refactor-isp-billing-imports.py --dry-run
    python scripts/refactor-isp-billing-imports.py --apply
"""

import argparse
import re
from pathlib import Path
from typing import NamedTuple


class ImportMapping(NamedTuple):
    """Defines how to remap an import."""
    old_module: str
    new_module: str
    symbols: list[str] | None  # None means all symbols


# Mappings from Platform to Shared (neutral types)
SHARED_MAPPINGS = [
    # Enums - already in shared
    ImportMapping(
        "dotmac.platform.billing.core.enums",
        "dotmac.shared.billing.core.enums",
        None  # All enums
    ),
    # Exceptions - already in shared
    ImportMapping(
        "dotmac.platform.billing.core.exceptions",
        "dotmac.shared.billing.core.exceptions",
        None
    ),
    ImportMapping(
        "dotmac.platform.billing.exceptions",
        "dotmac.shared.billing",
        [
            "BillingError", "BillingValidationError", "InvoiceError",
            "InvoiceNotFoundError", "PaymentError", "PaymentProcessingError",
            "DuplicatePaymentError", "InvalidPaymentError", "InsufficientFundsError",
            "RefundError", "SubscriptionError", "SubscriptionNotFoundError",
            "ProductNotFoundError", "AddonNotFoundError", "PricingError",
            "CreditNoteError", "TaxCalculationError", "PaymentMethodError",
            "CurrencyError", "DunningError",
        ]
    ),
]

# Mappings that need ISP-local implementations (copy models/services)
ISP_LOCAL_MAPPINGS = [
    # These need to be implemented in ISP billing
    ImportMapping(
        "dotmac.platform.billing.models",
        "dotmac.isp.billing.models",
        None
    ),
    ImportMapping(
        "dotmac.platform.billing.core.models",
        "dotmac.isp.billing.core.models",
        None
    ),
    ImportMapping(
        "dotmac.platform.billing.core.entities",
        "dotmac.isp.billing.core.entities",
        None
    ),
    # Services
    ImportMapping(
        "dotmac.platform.billing.subscriptions",
        "dotmac.isp.billing.subscriptions",
        None
    ),
    ImportMapping(
        "dotmac.platform.billing.invoicing",
        "dotmac.isp.billing.invoicing",
        None
    ),
    ImportMapping(
        "dotmac.platform.billing.payments",
        "dotmac.isp.billing.payments",
        None
    ),
    # Config/settings
    ImportMapping(
        "dotmac.platform.billing.config",
        "dotmac.isp.billing.config",
        None
    ),
    ImportMapping(
        "dotmac.platform.billing.settings",
        "dotmac.isp.billing.settings",
        None
    ),
]

# Other Platform modules that need ISP equivalents
OTHER_MAPPINGS = [
    ImportMapping(
        "dotmac.platform.tenant",
        "dotmac.shared.tenant",
        None
    ),
    ImportMapping(
        "dotmac.platform.events",
        "dotmac.shared.events",
        None
    ),
    ImportMapping(
        "dotmac.platform.core",
        "dotmac.shared.core",
        None
    ),
    ImportMapping(
        "dotmac.platform.customer_management.models",
        "dotmac.isp.customer_management.models",
        None
    ),
    ImportMapping(
        "dotmac.platform.webhooks",
        "dotmac.shared.webhooks",
        None
    ),
    ImportMapping(
        "dotmac.platform.communications",
        "dotmac.shared.communications",
        None
    ),
    ImportMapping(
        "dotmac.platform.audit",
        "dotmac.shared.audit",
        None
    ),
    ImportMapping(
        "dotmac.platform.telemetry",
        "dotmac.shared.telemetry",
        None
    ),
    ImportMapping(
        "dotmac.platform.customer_management.service",
        "dotmac.isp.customer_management.service",
        None
    ),
    ImportMapping(
        "dotmac.platform.integrations",
        "dotmac.isp.integrations",
        None
    ),
    ImportMapping(
        "dotmac.platform.plugins.registry",
        "dotmac.isp.plugins.registry",
        None
    ),
    ImportMapping(
        "dotmac.platform.services.lifecycle.service",
        "dotmac.isp.services.lifecycle.service",
        None
    ),
    ImportMapping(
        "dotmac.platform.fault_management.models",
        "dotmac.isp.fault_management.models",
        None
    ),
    ImportMapping(
        "dotmac.platform.timeseries.models",
        "dotmac.isp.timeseries.models",
        None
    ),
    ImportMapping(
        "dotmac.platform.file_storage.service",
        "dotmac.isp.file_storage.service",
        None
    ),
]


def find_python_files(base_path: Path) -> list[Path]:
    """Find all Python files in the ISP package."""
    return list(base_path.rglob("*.py"))


def analyze_imports(file_path: Path) -> list[tuple[int, str, str]]:
    """Find all dotmac.platform imports in a file.

    Returns list of (line_number, original_line, suggested_replacement)
    """
    results = []
    content = file_path.read_text()

    for i, line in enumerate(content.split('\n'), 1):
        if 'dotmac.platform' in line and ('import' in line or 'from' in line):
            results.append((i, line.strip(), suggest_replacement(line)))

    return results


def suggest_replacement(line: str) -> str:
    """Suggest a replacement for a Platform import line."""
    # Try shared mappings first
    for mapping in SHARED_MAPPINGS:
        if mapping.old_module in line:
            return line.replace(mapping.old_module, mapping.new_module)

    # Try ISP local mappings
    for mapping in ISP_LOCAL_MAPPINGS:
        if mapping.old_module in line:
            return line.replace(mapping.old_module, mapping.new_module)

    # Try other mappings
    for mapping in OTHER_MAPPINGS:
        if mapping.old_module in line:
            return line.replace(mapping.old_module, mapping.new_module)

    # Generic fallback
    return line.replace("dotmac.platform", "dotmac.isp")


def generate_report(base_path: Path) -> dict:
    """Generate a report of all Platform imports that need refactoring."""
    report = {
        "total_files": 0,
        "total_imports": 0,
        "by_module": {},
        "files": {}
    }

    for py_file in find_python_files(base_path):
        imports = analyze_imports(py_file)
        if imports:
            report["total_files"] += 1
            report["total_imports"] += len(imports)

            rel_path = str(py_file.relative_to(base_path))
            report["files"][rel_path] = imports

            for _, orig, _ in imports:
                # Extract module being imported
                match = re.search(r'from (dotmac\.platform\.[a-z_.]+)', orig)
                if match:
                    module = match.group(1)
                    report["by_module"][module] = report["by_module"].get(module, 0) + 1

    return report


def apply_refactoring(base_path: Path, dry_run: bool = True) -> None:
    """Apply import refactoring to all files."""
    for py_file in find_python_files(base_path):
        content = py_file.read_text()
        original = content

        # Apply all replacements
        for mapping in SHARED_MAPPINGS + ISP_LOCAL_MAPPINGS + OTHER_MAPPINGS:
            content = content.replace(mapping.old_module, mapping.new_module)

        # Generic fallback for any remaining billing imports
        content = content.replace("dotmac.platform.billing.", "dotmac.isp.billing.")

        if content != original:
            rel_path = py_file.relative_to(base_path)
            if dry_run:
                print(f"Would modify: {rel_path}")
            else:
                py_file.write_text(content)
                print(f"Modified: {rel_path}")


def main():
    parser = argparse.ArgumentParser(description="Refactor ISP billing imports")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without modifying files"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually apply the changes"
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate a detailed report of imports"
    )
    parser.add_argument(
        "--base-path",
        type=Path,
        default=Path("split-staging/dotmac-isp/src/dotmac/isp"),
        help="Base path for ISP source"
    )

    args = parser.parse_args()

    if args.report or (not args.apply and not args.dry_run):
        report = generate_report(args.base_path)
        print(f"\n{'='*60}")
        print("ISP Platform Import Analysis Report")
        print(f"{'='*60}")
        print(f"\nTotal files with platform imports: {report['total_files']}")
        print(f"Total platform imports: {report['total_imports']}")
        print(f"\nImports by module:")
        for module, count in sorted(report["by_module"].items(), key=lambda x: -x[1]):
            print(f"  {module}: {count}")

        if args.report:
            print(f"\n{'='*60}")
            print("Detailed file listing:")
            print(f"{'='*60}")
            for file_path, imports in report["files"].items():
                print(f"\n{file_path}:")
                for line_num, orig, suggested in imports:
                    print(f"  L{line_num}: {orig}")
                    if orig != suggested:
                        print(f"       -> {suggested}")

    if args.dry_run:
        print(f"\n{'='*60}")
        print("DRY RUN - Files that would be modified:")
        print(f"{'='*60}\n")
        apply_refactoring(args.base_path, dry_run=True)

    if args.apply:
        print(f"\n{'='*60}")
        print("APPLYING CHANGES:")
        print(f"{'='*60}\n")
        apply_refactoring(args.base_path, dry_run=False)


if __name__ == "__main__":
    main()
