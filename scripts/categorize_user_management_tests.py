#!/usr/bin/env python3
"""
Categorize user_management test files into unit/integration/e2e.

Categorization Logic:
- UNIT: Models, schemas, utilities, service mocks
- INTEGRATION: Service with DB, team management, tenant isolation
- E2E: Router/API endpoints with full stack
"""

import ast
from pathlib import Path


class TestCategorizer(ast.NodeVisitor):
    def __init__(self):
        self.uses_async_session = False
        self.uses_test_client = False
        self.uses_httpx = False
        self.uses_team_service = False
        self.uses_user_service = False
        self.uses_rbac = False
        self.has_router_tests = False
        self.has_model_tests = False
        self.has_schema_tests = False
        self.has_mock_db = False

    def visit_Import(self, node):
        for alias in node.names:
            if "httpx" in alias.name:
                self.uses_httpx = True
            elif "fastapi" in alias.name:
                self.has_router_tests = True
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            # Check for DB usage
            if "db" in node.module or "database" in node.module:
                for alias in node.names:
                    if "async_session" in alias.name.lower():
                        self.uses_async_session = True

            # Check for test client
            if "httpx" in node.module:
                for alias in node.names:
                    if alias.name in ["AsyncClient", "TestClient"]:
                        self.uses_test_client = True

            # Check for FastAPI
            if "fastapi" in node.module:
                for alias in node.names:
                    if alias.name in ["TestClient"]:
                        self.uses_test_client = True

            # Check for user management services
            if "user_management" in node.module:
                for alias in node.names:
                    if "TeamService" in alias.name:
                        self.uses_team_service = True
                    elif "UserService" in alias.name:
                        self.uses_user_service = True

            # Check for RBAC
            if "rbac" in node.module or "auth" in node.module:
                self.uses_rbac = True

            # Check for models
            if "models" in node.module:
                for alias in node.names:
                    if any(x in alias.name for x in ["User", "Team", "Role"]):
                        self.has_model_tests = True

        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        # Check function parameters for fixtures
        for arg in node.args.args:
            if arg.arg in ["async_session", "async_db_session", "db_session"]:
                self.uses_async_session = True
            elif arg.arg in ["test_client", "client"]:
                self.uses_test_client = True
            elif arg.arg in ["user_service", "team_service"]:
                if not any("mock" in dec.id for dec in node.decorator_list if hasattr(dec, "id")):
                    self.uses_user_service = True

        # Check for mock usage in function body
        for child in ast.walk(node):
            if isinstance(child, ast.Name):
                if "mock" in child.id.lower():
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
    if categorizer.uses_test_client or "router" in filename:
        return "e2e", "high"

    # Unit: Models, schemas, or mocked services
    if "model" in filename:
        return "unit", "high"

    if categorizer.has_mock_db and not categorizer.uses_async_session:
        return "unit", "high"

    # Integration: Service tests with real DB
    if categorizer.uses_async_session:
        if "service" in filename or "tenant" in filename:
            return "integration", "high"
        return "integration", "medium"

    # Integration: Team service tests
    if categorizer.uses_team_service or categorizer.uses_user_service:
        if categorizer.uses_async_session:
            return "integration", "high"
        return "integration", "medium"

    # Default to integration for user management (typically service tests)
    if "service" in filename:
        return "integration", "medium"

    return "integration", "low"


def main():
    test_dir = Path("tests/user_management")

    if not test_dir.exists():
        print(f"Error: {test_dir} does not exist")
        return

    unit_files = []
    integration_files = []
    e2e_files = []

    for test_file in sorted(test_dir.glob("test_*.py")):
        category, confidence = categorize_file(test_file)

        if category == "unit":
            unit_files.append((test_file.name, confidence))
        elif category == "integration":
            integration_files.append((test_file.name, confidence))
        elif category == "e2e":
            e2e_files.append((test_file.name, confidence))

    print("=" * 70)
    print("USER MANAGEMENT MODULE TEST CATEGORIZATION")
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

    # Generate commands for batch application
    print("\n📋 COMMANDS TO APPLY MARKERS:")
    print("-" * 70)

    if unit_files:
        print("\n# Unit tests:")
        for filename, _ in unit_files:
            print(f"python scripts/batch_add_markers.py --marker unit tests/user_management/{filename}")

    if integration_files:
        print("\n# Integration tests:")
        for filename, _ in integration_files:
            print(f"python scripts/batch_add_markers.py --marker integration tests/user_management/{filename}")

    if e2e_files:
        print("\n# E2E tests:")
        for filename, _ in e2e_files:
            print(f"python scripts/batch_add_markers.py --marker e2e tests/user_management/{filename}")


if __name__ == "__main__":
    main()
