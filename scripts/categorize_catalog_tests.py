#!/usr/bin/env python3
"""
Categorize catalog tests for test pyramid markers.

Strategy:
- Integration: Service tests with real AsyncSession
- Unit: Model/schema tests, cached service with mocks
- E2E: Router tests with TestClient/AsyncClient
"""

from pathlib import Path
from typing import Literal

CATALOG_DIR = Path("tests/billing/catalog")

# File categorization based on naming patterns and imports
FILE_CATEGORIES = {
    # Integration - Service with real DB
    "test_service_comprehensive.py": ("integration", "Service with real AsyncSession"),

    # Unit - Models and cached service
    "test_models_comprehensive.py": ("unit", "Model and schema validation tests"),
    "test_cached_service_comprehensive.py": ("unit", "Cached service with AsyncMock"),

    # E2E - Router tests
    "test_catalog_router_comprehensive.py": ("e2e", "Router endpoints with TestClient"),
}


def categorize_file(file_path: Path) -> tuple[Literal["unit", "integration", "e2e"], str]:
    """Categorize a test file."""
    filename = file_path.name

    # Use predefined categories
    if filename in FILE_CATEGORIES:
        return FILE_CATEGORIES[filename]

    # Default to unit
    return ("unit", "Default: unit tests")


def main():
    """Categorize all catalog test files."""
    test_files = sorted(CATALOG_DIR.glob("test_*.py"))

    categories = {"unit": [], "integration": [], "e2e": []}

    print("📋 Categorizing Catalog Tests\n")
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
    print("\n# Unit tests:")
    if categories['unit']:
        unit_files = ' '.join(f"tests/billing/catalog/{f}" for f in categories['unit'])
        print(f"python3 scripts/batch_add_markers.py --marker unit {unit_files}")

    print("\n# Integration tests:")
    if categories['integration']:
        int_files = ' '.join(f"tests/billing/catalog/{f}" for f in categories['integration'])
        print(f"python3 scripts/batch_add_markers.py --marker integration {int_files}")

    print("\n# E2E tests:")
    if categories['e2e']:
        e2e_files = ' '.join(f"tests/billing/catalog/{f}" for f in categories['e2e'])
        print(f"python3 scripts/batch_add_markers.py --marker e2e {e2e_files}")


if __name__ == "__main__":
    main()
