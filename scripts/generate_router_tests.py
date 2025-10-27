#!/usr/bin/env python3
"""
Test Generator CLI Tool

Automatically generates router test files using the testing framework patterns.

Usage:
    # Generate tests for a single router
    python scripts/generate_router_tests.py --router dotmac.platform.access.router

    # Generate tests for all routers
    python scripts/generate_router_tests.py --all

    # Generate tests with custom options
    python scripts/generate_router_tests.py \\
        --router dotmac.platform.customers.router \\
        --output tests/customers/test_generated.py \\
        --type crud \\
        --with-contract-testing

Features:
- Auto-detects router endpoints
- Generates appropriate base class usage
- Creates mock service setup
- Adds contract testing if requested
- Follows established patterns from TESTING_GUIDE.md
"""

import argparse
import ast
import importlib
import inspect
import sys
from pathlib import Path
from typing import Any

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))


class RouterAnalyzer:
    """Analyzes a FastAPI router to extract metadata."""

    def __init__(self, router_module: str, router_name: str = "router"):
        self.router_module = router_module
        self.router_name = router_name
        self.router = None
        self.endpoints = []
        self.prefix = ""

    def load_router(self) -> bool:
        """Load the router module."""
        try:
            module = importlib.import_module(self.router_module)
            self.router = getattr(module, self.router_name)
            self.prefix = getattr(self.router, "prefix", "")
            return True
        except Exception as e:
            print(f"Error loading router: {e}")
            return False

    def analyze_endpoints(self) -> list[dict[str, Any]]:
        """Extract endpoint information from router."""
        if not self.router:
            return []

        endpoints = []
        for route in self.router.routes:
            endpoint_info = {
                "path": route.path,
                "methods": list(route.methods) if hasattr(route, "methods") else [],
                "name": route.name,
                "endpoint": route.endpoint if hasattr(route, "endpoint") else None,
            }

            # Try to extract response model
            if hasattr(route, "response_model"):
                endpoint_info["response_model"] = route.response_model

            # Check if it's a CRUD endpoint
            if any(method in ["GET", "POST", "PUT", "DELETE", "PATCH"] for method in endpoint_info["methods"]):
                endpoints.append(endpoint_info)

        self.endpoints = endpoints
        return endpoints

    def detect_pattern(self) -> str:
        """Detect router pattern (basic, crud, service-based)."""
        methods = set()
        for endpoint in self.endpoints:
            methods.update(endpoint["methods"])

        # Check if it's CRUD
        if {"GET", "POST", "PUT", "DELETE"}.issubset(methods):
            return "crud"

        # Check if it has service dependency
        # (Would need to inspect function signatures)
        return "basic"


class TestGenerator:
    """Generates test files from router analysis."""

    def __init__(
        self,
        router_module: str,
        router_name: str = "router",
        output_path: str | None = None,
        test_type: str = "auto",
        with_contract_testing: bool = False,
    ):
        self.router_module = router_module
        self.router_name = router_name
        self.output_path = output_path
        self.test_type = test_type
        self.with_contract_testing = with_contract_testing

        self.analyzer = RouterAnalyzer(router_module, router_name)

    def generate(self) -> str:
        """Generate test file content."""
        if not self.analyzer.load_router():
            return ""

        self.analyzer.analyze_endpoints()

        # Detect pattern if auto
        if self.test_type == "auto":
            self.test_type = self.analyzer.detect_pattern()

        # Generate based on type
        if self.test_type == "crud":
            return self._generate_crud_tests()
        elif self.test_type == "service":
            return self._generate_service_tests()
        else:
            return self._generate_basic_tests()

    def _generate_imports(self) -> str:
        """Generate import statements."""
        imports = [
            '"""',
            f"Generated tests for {self.router_module}",
            "",
            "Auto-generated using generate_router_tests.py",
            "Edit as needed and add custom test cases.",
            '"""',
            "",
            "from unittest.mock import AsyncMock",
            "from uuid import uuid4",
            "",
            "import pytest",
        ]

        if self.test_type == "crud":
            imports.append("from tests.helpers.router_base import CRUDRouterTestBase")
        elif self.test_type == "service":
            imports.append("from tests.helpers.router_base import RouterWithServiceTestBase")
        else:
            imports.append("from tests.helpers.router_base import RouterTestBase")

        if self.with_contract_testing:
            imports.extend(
                [
                    "from tests.helpers.contract_testing import (",
                    "    ContractTestCase,",
                    "    MockDataFactory,",
                    "    SchemaValidator,",
                    ")",
                ]
            )

        imports.append("")
        return "\n".join(imports)

    def _generate_basic_tests(self) -> str:
        """Generate basic router tests."""
        module_name = self.router_module.split(".")[-1]
        class_name = f"Test{module_name.title().replace('_', '')}Router"
        prefix = self.analyzer.prefix or f"/{module_name}"

        content = [
            self._generate_imports(),
            "",
            f"class {class_name}(RouterTestBase):",
            f'    """Tests for {self.router_module}."""',
            "",
            f'    router_module = "{self.router_module}"',
            f'    router_name = "{self.router_name}"',
            f'    router_prefix = "{prefix}"',
            "",
        ]

        # Generate test methods for each endpoint
        for endpoint in self.analyzer.endpoints:
            content.extend(self._generate_endpoint_test(endpoint))
            content.append("")

        return "\n".join(content)

    def _generate_crud_tests(self) -> str:
        """Generate CRUD router tests."""
        module_name = self.router_module.split(".")[-1]
        class_name = f"Test{module_name.title().replace('_', '')}Router"
        prefix = self.analyzer.prefix or f"/{module_name}"
        resource_name = module_name.replace("_router", "").replace("router", "")

        content = [
            self._generate_imports(),
            "",
            f"class {class_name}(CRUDRouterTestBase):",
            f'    """CRUD tests for {self.router_module}."""',
            "",
            f'    router_module = "{self.router_module}"',
            f'    router_name = "{self.router_name}"',
            f'    router_prefix = "{prefix}"',
            f'    resource_name = "{resource_name}"',
            "",
            "    def get_sample_data(self):",
            '        """Override with actual sample data."""',
            '        return {"name": "Test Resource"}',
            "",
            "    def get_sample_response(self):",
            '        """Override with actual response data."""',
            "        return {",
            '            "id": str(uuid4()),',
            "            **self.get_sample_data(),",
            "        }",
            "",
            "    # Inherited tests:",
            "    # - test_list_resources",
            "    # - test_get_resource_success",
            "    # - test_get_resource_not_found",
            "    # - test_create_resource",
            "    # - test_update_resource",
            "    # - test_delete_resource",
            "",
            "    # Add custom tests below:",
            "",
        ]

        return "\n".join(content)

    def _generate_service_tests(self) -> str:
        """Generate service-based router tests."""
        module_name = self.router_module.split(".")[-1]
        class_name = f"Test{module_name.title().replace('_', '')}Router"
        prefix = self.analyzer.prefix or f"/{module_name}"

        content = [
            self._generate_imports(),
            "",
            f"class {class_name}(RouterWithServiceTestBase):",
            f'    """Service-based tests for {self.router_module}."""',
            "",
            f'    router_module = "{self.router_module}"',
            f'    router_name = "{self.router_name}"',
            f'    router_prefix = "{prefix}"',
            f'    service_module = "{self.router_module}"',
            '    service_dependency_name = "get_service"  # Update with actual name',
            "",
        ]

        # Generate test methods
        for endpoint in self.analyzer.endpoints:
            content.extend(self._generate_endpoint_test(endpoint, with_service=True))
            content.append("")

        return "\n".join(content)

    def _generate_endpoint_test(
        self, endpoint: dict[str, Any], with_service: bool = False
    ) -> list[str]:
        """Generate test method for an endpoint."""
        # Extract test name from endpoint
        method = endpoint["methods"][0] if endpoint["methods"] else "get"
        path = endpoint["path"]
        test_name = self._endpoint_to_test_name(method, path)

        content = [
            f"    def {test_name}(self, client{', mock_service' if with_service else ''}):",
            f'        """Test {method} {path}."""',
        ]

        if with_service:
            content.extend(
                [
                    "        # Configure mock service",
                    "        mock_service.some_method.return_value = {}  # Update",
                    "",
                ]
            )

        # Generate request
        if method.lower() == "get":
            content.append(f'        response = client.get("/api/v1{path}")')
        elif method.lower() == "post":
            content.extend(
                [
                    "        payload = {}  # Add request data",
                    f'        response = client.post("/api/v1{path}", json=payload)',
                ]
            )
        elif method.lower() == "put":
            content.extend(
                [
                    "        payload = {}  # Add request data",
                    f'        response = client.put("/api/v1{path}", json=payload)',
                ]
            )
        elif method.lower() == "delete":
            content.append(f'        response = client.delete("/api/v1{path}")')

        content.extend(
            [
                "",
                "        # Add assertions",
                "        data = self.assert_success(response)",
                "        # assert data['field'] == expected_value",
            ]
        )

        return content

    def _endpoint_to_test_name(self, method: str, path: str) -> str:
        """Convert endpoint to test method name."""
        # Remove parameters and clean path
        clean_path = path.replace("{", "").replace("}", "")
        parts = [p for p in clean_path.split("/") if p]

        # Build test name
        name_parts = [method.lower()]
        name_parts.extend(parts)

        return "test_" + "_".join(name_parts)

    def write_to_file(self, content: str) -> bool:
        """Write generated content to file."""
        if not self.output_path:
            # Auto-generate output path
            module_parts = self.router_module.split(".")
            test_name = f"test_{module_parts[-1]}_generated.py"
            self.output_path = project_root / "tests" / module_parts[-2] / test_name

        output_path = Path(self.output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            output_path.write_text(content)
            print(f"✅ Generated test file: {output_path}")
            return True
        except Exception as e:
            print(f"❌ Error writing file: {e}")
            return False


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Generate router tests using established patterns",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate basic tests
  python scripts/generate_router_tests.py --router dotmac.platform.access.router

  # Generate CRUD tests
  python scripts/generate_router_tests.py \\
      --router dotmac.platform.customers.router \\
      --type crud

  # Generate with contract testing
  python scripts/generate_router_tests.py \\
      --router dotmac.platform.products.router \\
      --with-contract-testing

  # Custom output path
  python scripts/generate_router_tests.py \\
      --router dotmac.platform.users.router \\
      --output tests/custom/test_users.py
        """,
    )

    parser.add_argument(
        "--router",
        required=True,
        help="Router module path (e.g., dotmac.platform.access.router)",
    )
    parser.add_argument(
        "--router-name", default="router", help="Router variable name (default: router)"
    )
    parser.add_argument("--output", help="Output file path (auto-generated if not specified)")
    parser.add_argument(
        "--type",
        choices=["auto", "basic", "crud", "service"],
        default="auto",
        help="Test type (auto-detect by default)",
    )
    parser.add_argument(
        "--with-contract-testing",
        action="store_true",
        help="Include contract testing setup",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print generated code without writing file"
    )

    args = parser.parse_args()

    print(f"🔍 Analyzing router: {args.router}")
    print()

    generator = TestGenerator(
        router_module=args.router,
        router_name=args.router_name,
        output_path=args.output,
        test_type=args.type,
        with_contract_testing=args.with_contract_testing,
    )

    content = generator.generate()

    if not content:
        print("❌ Failed to generate tests")
        return 1

    if args.dry_run:
        print("Generated code:")
        print("=" * 60)
        print(content)
        print("=" * 60)
    else:
        if generator.write_to_file(content):
            print()
            print("Next steps:")
            print("1. Review and customize the generated tests")
            print("2. Add actual sample data in get_sample_data()")
            print("3. Update assertions to match expected behavior")
            print("4. Run tests: pytest <generated_file> -v")
        else:
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
