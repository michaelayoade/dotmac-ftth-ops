#!/usr/bin/env python3
"""
Categorize payment tests for test pyramid markers.

Strategy:
- Integration: Service tests with real AsyncSession
- Unit: Provider tests, mocked service tests, security tests, edge cases
- E2E: Router tests with real HTTP client (if any)
"""

import ast
from pathlib import Path
from typing import Literal

PAYMENTS_DIR = Path("tests/billing/payments")

# File categorization based on naming patterns and imports
FILE_CATEGORIES = {
    # Integration - Service tests with real DB
    "test_payment_service_core.py": ("integration", "Real AsyncSession service tests"),

    # Unit - Provider mocks and unit tests
    "test_payment_provider_mock.py": ("unit", "Mock provider unit tests"),
    "test_payment_providers_async.py": ("unit", "Async provider behavior tests"),
    "test_payment_creation_service.py": ("unit", "Mocked payment creation tests"),
    "test_payment_refunds_service.py": ("unit", "Mocked refund tests"),
    "test_payment_retry_service.py": ("unit", "Mocked retry logic tests"),
    "test_payment_methods_service.py": ("unit", "Mocked payment methods tests"),
    "test_payment_helpers_service.py": ("unit", "Helper function tests"),
    "test_payment_edge_cases.py": ("unit", "Edge case tests"),
    "test_payment_critical_fixes.py": ("unit", "Critical bug fix tests"),
    "test_payment_critical_fixes_batch3.py": ("unit", "Additional critical fixes"),
    "test_payment_security_fixes.py": ("unit", "Security fix tests"),
    "test_payment_router_security.py": ("unit", "Router security with mocks"),
    "test_webhook_methods.py": ("unit", "Webhook method tests"),
}


def has_real_async_session(file_path: Path) -> bool:
    """Check if file uses real AsyncSession (integration test pattern)."""
    content = file_path.read_text()
    tree = ast.parse(content)

    for node in ast.walk(tree):
        # Check for AsyncSession in function parameters
        if isinstance(node, ast.FunctionDef):
            for arg in node.args.args:
                if arg.annotation and isinstance(arg.annotation, ast.Name):
                    if arg.annotation.id == "AsyncSession":
                        return True

        # Check for async_session fixture usage
        if isinstance(node, ast.Name) and node.id == "async_session":
            return True

    return False


def categorize_file(file_path: Path) -> tuple[Literal["unit", "integration", "e2e"], str]:
    """Categorize a test file."""
    filename = file_path.name

    # Use predefined categories
    if filename in FILE_CATEGORIES:
        return FILE_CATEGORIES[filename]

    # Fallback: analyze file content
    if has_real_async_session(file_path):
        return ("integration", "Uses real AsyncSession")

    # Default to unit for payments tests
    return ("unit", "Default: mocked tests")


def main():
    """Categorize all payment test files."""
    test_files = sorted(PAYMENTS_DIR.glob("test_*.py"))

    categories = {"unit": [], "integration": [], "e2e": []}

    print("📋 Categorizing Payment Tests\n")
    print(f"Found {len(test_files)} test files\n")

    for file_path in test_files:
        category, reason = categorize_file(file_path)
        categories[category].append(file_path.name)

        emoji = {"unit": "📊", "integration": "🔗", "e2e": "🌐"}[category]
        print(f"{emoji} {category.upper():12} | {file_path.name:45} | {reason}")

    print("\n" + "="*80)
    print("\n📊 Summary:")
    print(f"   Unit:        {len(categories['unit'])} files")
    print(f"   Integration: {len(categories['integration'])} files")
    print(f"   E2E:         {len(categories['e2e'])} files")
    print(f"   Total:       {len(test_files)} files")

    print("\n🔧 Commands to apply markers:")
    print("\n# Unit tests (class-based):")
    if categories['unit']:
        unit_files = ' '.join(f"tests/billing/payments/{f}" for f in categories['unit'])
        print(f"python3 scripts/batch_add_markers.py --marker unit {unit_files}")

    print("\n# Integration tests (class-based):")
    if categories['integration']:
        int_files = ' '.join(f"tests/billing/payments/{f}" for f in categories['integration'])
        print(f"python3 scripts/batch_add_markers.py --marker integration {int_files}")

    print("\n# E2E tests (class-based):")
    if categories['e2e']:
        e2e_files = ' '.join(f"tests/billing/payments/{f}" for f in categories['e2e'])
        print(f"python3 scripts/batch_add_markers.py --marker e2e {e2e_files}")


if __name__ == "__main__":
    main()
