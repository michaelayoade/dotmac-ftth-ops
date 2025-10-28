#!/usr/bin/env python3
"""
Categorize invoicing tests for test pyramid markers.

Strategy:
- Integration: Service tests with real AsyncSession
- Unit: Service tests with mocked DB (build_mock_db_session, AsyncMock)
- E2E: Router tests with AsyncClient
"""

import ast
from pathlib import Path
from typing import Literal

INVOICING_DIR = Path("tests/billing/invoicing")

# File categorization based on naming patterns and imports
FILE_CATEGORIES = {
    # Integration - Service tests with real DB
    "test_invoice_service_core.py": ("integration", "Real AsyncSession service tests"),

    # Unit - Mocked service tests
    "test_invoice_creation.py": ("unit", "Mocked invoice creation tests"),
    "test_invoice_edge_cases.py": ("unit", "Edge case tests with mocked DB"),
    "test_invoice_helpers.py": ("unit", "Helper function tests with mocks"),
    "test_invoice_overdue.py": ("unit", "Overdue management with mocked DB"),
    "test_invoice_payments.py": ("unit", "Payment tracking with mocked DB"),
    "test_invoice_retrieval.py": ("unit", "Invoice retrieval with mocked DB"),
    "test_invoice_status.py": ("unit", "Status management with mocked DB"),
    "test_invoice_service_complete.py": ("unit", "Complete service tests with AsyncMock"),

    # E2E - Router tests
    "test_invoicing_router.py": ("e2e", "Router endpoints with AsyncClient"),
}


def has_real_async_session(file_path: Path) -> bool:
    """Check if file uses real AsyncSession (integration test pattern)."""
    content = file_path.read_text()

    # Check for AsyncSession in function parameters (not AsyncMock spec)
    if "async def" in content and "AsyncSession" in content:
        # Exclude if it's just AsyncMock(spec=AsyncSession)
        if "AsyncMock(spec=AsyncSession)" in content or "AsyncMock(spec = AsyncSession)" in content:
            return False

        tree = ast.parse(content)
        for node in ast.walk(tree):
            # Check for AsyncSession in function parameters
            if isinstance(node, ast.FunctionDef):
                for arg in node.args.args:
                    if arg.annotation and isinstance(arg.annotation, ast.Name):
                        if arg.annotation.id == "AsyncSession":
                            return True

    return False


def has_async_client(file_path: Path) -> bool:
    """Check if file uses AsyncClient (E2E test pattern)."""
    content = file_path.read_text()
    return "AsyncClient" in content and "from httpx import AsyncClient" in content


def categorize_file(file_path: Path) -> tuple[Literal["unit", "integration", "e2e"], str]:
    """Categorize a test file."""
    filename = file_path.name

    # Use predefined categories
    if filename in FILE_CATEGORIES:
        return FILE_CATEGORIES[filename]

    # Fallback: analyze file content
    if has_async_client(file_path):
        return ("e2e", "Uses AsyncClient for router tests")

    if has_real_async_session(file_path):
        return ("integration", "Uses real AsyncSession")

    # Default to unit for invoicing tests (most use mocked DB)
    return ("unit", "Default: mocked tests")


def main():
    """Categorize all invoicing test files."""
    test_files = sorted(INVOICING_DIR.glob("test_*.py"))

    categories = {"unit": [], "integration": [], "e2e": []}

    print("📋 Categorizing Invoicing Tests\n")
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
        unit_files = ' '.join(f"tests/billing/invoicing/{f}" for f in categories['unit'])
        print(f"python3 scripts/batch_add_markers.py --marker unit {unit_files}")

    print("\n# Integration tests (class-based):")
    if categories['integration']:
        int_files = ' '.join(f"tests/billing/invoicing/{f}" for f in categories['integration'])
        print(f"python3 scripts/batch_add_markers.py --marker integration {int_files}")

    print("\n# E2E tests (class-based):")
    if categories['e2e']:
        e2e_files = ' '.join(f"tests/billing/invoicing/{f}" for f in categories['e2e'])
        print(f"python3 scripts/batch_add_markers.py --marker e2e {e2e_files}")


if __name__ == "__main__":
    main()
