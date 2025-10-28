#!/usr/bin/env python3
"""
Categorize customer_management test files into unit/integration/e2e.

Focus on UNMARKED files only.
"""

import ast
from pathlib import Path


class TestCategorizer(ast.NodeVisitor):
    def __init__(self):
        self.uses_async_session = False
        self.uses_test_client = False
        self.uses_httpx = False
        self.has_router_tests = False
        self.has_mock_db = False
        self.uses_customer_service = False
        self.uses_lifecycle_service = False

    def visit_Import(self, node):
        for alias in node.names:
            if "httpx" in alias.name or "TestClient" in alias.name:
                self.uses_httpx = True
            elif "fastapi" in alias.name:
                self.has_router_tests = True
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            # Check for DB usage
            if "db" in node.module or "database" in node.module:
                for alias in node.names:
                    if "async_session" in alias.name.lower() or "AsyncSession" in alias.name:
                        self.uses_async_session = True

            # Check for test client
            if "httpx" in node.module or "fastapi" in node.module:
                for alias in node.names:
                    if alias.name in ["AsyncClient", "TestClient"]:
                        self.uses_test_client = True
                        self.has_router_tests = True

            # Check for services
            if "customer_management" in node.module:
                for alias in node.names:
                    if "CustomerService" in alias.name:
                        self.uses_customer_service = True
                    elif "LifecycleService" in alias.name:
                        self.uses_lifecycle_service = True

        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        # Check function parameters for fixtures
        for arg in node.args.args:
            if arg.arg in ["async_session", "async_db_session", "db_session", "session"]:
                self.uses_async_session = True
            elif arg.arg in ["test_client", "client"]:
                self.uses_test_client = True

        # Check for mock usage
        for child in ast.walk(node):
            if isinstance(child, ast.Name):
                if "mock" in child.id.lower() or "Mock" in child.id:
                    self.has_mock_db = True

        self.generic_visit(node)


def categorize_file(file_path: Path) -> tuple[str, str]:
    """Categorize a test file into unit/integration/e2e with confidence."""
    with open(file_path, "r") as f:
        content = f.read()

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return "unknown", "low"

    categorizer = TestCategorizer()
    categorizer.visit(tree)

    filename = file_path.name.lower()

    # E2E: Router tests with TestClient
    if categorizer.uses_test_client or "_router" in filename:
        return "e2e", "high"

    # Unit: Models, schemas, or mocked services
    if "_unit" in filename or "models" in filename or "schemas" in filename or "mappers" in filename:
        return "unit", "high"

    if categorizer.has_mock_db and not categorizer.uses_async_session:
        return "unit", "high"

    # Integration: Service tests with real DB
    if categorizer.uses_async_session:
        if "_integration" in filename or "service" in filename or "lifecycle" in filename or "workflow" in filename:
            return "integration", "high"
        return "integration", "medium"

    # Default based on filename
    if "integration" in filename:
        return "integration", "medium"
    if "bug_fixes" in filename or "tenant" in filename:
        return "integration", "medium"

    return "integration", "low"


def main():
    test_dir = Path("tests/customer_management")

    if not test_dir.exists():
        print(f"Error: {test_dir} does not exist")
        return

    # Only check unmarked files
    unmarked_files = [
        "test_bug_fixes.py",
        "test_customer_integration.py",
        "test_customer_router.py",
        "test_router_comprehensive.py",
        "test_service_advanced.py",
        "test_tenant_resolution.py",
        "test_workflow_service.py",
    ]

    unit_files = []
    integration_files = []
    e2e_files = []

    for filename in unmarked_files:
        test_file = test_dir / filename
        if not test_file.exists():
            continue

        category, confidence = categorize_file(test_file)

        if category == "unit":
            unit_files.append((filename, confidence))
        elif category == "integration":
            integration_files.append((filename, confidence))
        elif category == "e2e":
            e2e_files.append((filename, confidence))

    print("=" * 70)
    print("CUSTOMER MANAGEMENT MODULE - UNMARKED FILES CATEGORIZATION")
    print("=" * 70)

    print(f"\n📊 UNIT TESTS ({len(unit_files)} files):")
    print("-" * 70)
    for filename, confidence in unit_files:
        print(f"  • {filename:<50} [{confidence} confidence]")

    print(f"\n🔗 INTEGRATION TESTS ({len(integration_files)} files):")
    print("-" * 70)
    for filename, confidence in integration_files:
        print(f"  • {filename:<50} [{confidence} confidence]")

    print(f"\n🌐 E2E TESTS ({len(e2e_files)} files):")
    print("-" * 70)
    for filename, confidence in e2e_files:
        print(f"  • {filename:<50} [{confidence} confidence]")

    print("\n" + "=" * 70)
    print(f"SUMMARY: {len(unit_files)} unit, {len(integration_files)} integration, {len(e2e_files)} e2e")
    print("=" * 70)

    # Generate commands
    print("\n📋 COMMANDS TO APPLY MARKERS:")
    print("-" * 70)

    if unit_files:
        print("\n# Unit tests:")
        for filename, _ in unit_files:
            print(f"python scripts/batch_add_markers.py --marker unit tests/customer_management/{filename}")

    if integration_files:
        print("\n# Integration tests:")
        for filename, _ in integration_files:
            print(f"python scripts/batch_add_markers.py --marker integration tests/customer_management/{filename}")

    if e2e_files:
        print("\n# E2E tests:")
        for filename, _ in e2e_files:
            print(f"python scripts/batch_add_markers.py --marker e2e tests/customer_management/{filename}")


if __name__ == "__main__":
    main()
