#!/usr/bin/env python3
"""
Categorize dunning tests for test pyramid markers.

Strategy:
- Integration: Service tests with real AsyncSession, full lifecycle tests
- Unit: Model/schema tests, Celery task tests with mocks
- E2E: Router tests with AsyncClient
"""

import ast
from pathlib import Path
from typing import Literal

DUNNING_DIR = Path("tests/billing/dunning")

# File categorization based on naming patterns and imports
FILE_CATEGORIES = {
    # Integration - Service and workflow tests with real DB
    "test_dunning_integration.py": ("integration", "Complete lifecycle tests with real AsyncSession"),
    "test_service.py": ("integration", "Service layer with real AsyncSession"),

    # Unit - Models, schemas, and tasks with mocks
    "test_models.py": ("unit", "Model and schema validation tests"),
    "test_tasks.py": ("unit", "Celery task tests with mocked dependencies"),

    # E2E - Router tests
    "test_router.py": ("e2e", "Router endpoints with AsyncClient"),
}


def has_real_async_session(file_path: Path) -> bool:
    """Check if file uses real AsyncSession (integration test pattern)."""
    content = file_path.read_text()

    # Check for AsyncSession import from sqlalchemy
    if "from sqlalchemy.ext.asyncio import AsyncSession" in content:
        return True

    # Check for async_session fixture usage without mocking
    if "async_session" in content and "AsyncMock" not in content:
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

    # Default to unit for dunning tests
    return ("unit", "Default: unit tests")


def main():
    """Categorize all dunning test files."""
    test_files = sorted(DUNNING_DIR.glob("test_*.py"))

    categories = {"unit": [], "integration": [], "e2e": []}

    print("📋 Categorizing Dunning Tests\n")
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
        unit_files = ' '.join(f"tests/billing/dunning/{f}" for f in categories['unit'])
        print(f"python3 scripts/batch_add_markers.py --marker unit {unit_files}")

    print("\n# Integration tests (class-based):")
    if categories['integration']:
        int_files = ' '.join(f"tests/billing/dunning/{f}" for f in categories['integration'])
        print(f"python3 scripts/batch_add_markers.py --marker integration {int_files}")

    print("\n# E2E tests (class-based):")
    if categories['e2e']:
        e2e_files = ' '.join(f"tests/billing/dunning/{f}" for f in categories['e2e'])
        print(f"python3 scripts/batch_add_markers.py --marker e2e {e2e_files}")


if __name__ == "__main__":
    main()
