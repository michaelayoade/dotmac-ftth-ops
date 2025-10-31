#!/usr/bin/env python3
"""
Test Migration Tool

Automatically refactors existing tests to use the new base classes.

Usage:
    # Analyze a test file
    python scripts/migrate_tests_to_base_classes.py --file tests/mymodule/test_router.py --analyze

    # Migrate a test file (dry run)
    python scripts/migrate_tests_to_base_classes.py --file tests/mymodule/test_router.py --dry-run

    # Migrate a test file (apply changes)
    python scripts/migrate_tests_to_base_classes.py --file tests/mymodule/test_router.py

    # Migrate all tests in a directory
    python scripts/migrate_tests_to_base_classes.py --directory tests/billing --apply

Features:
- Detects test patterns (basic, CRUD, service-based)
- Refactors to use appropriate base class
- Adds tenant header injection
- Updates assertions to use helpers
- Preserves custom test logic
"""

import argparse
import ast
import re
import sys
from pathlib import Path
from typing import Any


class TestFileMigrator:
    """Migrates test files to use new base classes."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.content = file_path.read_text()
        self.lines = self.content.splitlines()
        self.analysis = {}

    def analyze(self) -> dict[str, Any]:
        """Analyze test file and determine migration strategy."""
        analysis = {
            "file": str(self.file_path),
            "has_router_tests": False,
            "test_classes": [],
            "patterns_detected": [],
            "issues_found": [],
            "migration_recommendations": [],
        }

        # Check for router testing patterns
        if "TestClient" in self.content or "client" in self.content:
            analysis["has_router_tests"] = True

        # Check for common issues
        if "403" in self.content:
            analysis["issues_found"].append("Potential 403 authentication issues")

        if "ValidationError" in self.content:
            analysis["issues_found"].append("Potential Pydantic validation issues")

        if "create_tenant_app" in self.content or "FastAPI()" in self.content:
            analysis["issues_found"].append("Creates custom FastAPI app (should use test_app)")

        if "X-Tenant-ID" not in self.content and "x-tenant-id" not in self.content:
            analysis["issues_found"].append("Missing tenant header injection")

        # Detect test classes
        class_pattern = r"class\s+(Test\w+)"
        for match in re.finditer(class_pattern, self.content):
            class_name = match.group(1)
            analysis["test_classes"].append(class_name)

        # Detect patterns
        if "def test_list" in self.content and "def test_create" in self.content:
            analysis["patterns_detected"].append("CRUD")
            analysis["migration_recommendations"].append(
                "Consider using CRUDRouterTestBase"
            )

        if "mock_service" in self.content or "@patch" in self.content:
            analysis["patterns_detected"].append("Service mocking")
            analysis["migration_recommendations"].append(
                "Consider using RouterWithServiceTestBase"
            )

        if not analysis["patterns_detected"]:
            analysis["patterns_detected"].append("Basic")
            analysis["migration_recommendations"].append("Use RouterTestBase")

        # Check if already migrated
        if "RouterTestBase" in self.content or "RouterWithServiceTestBase" in self.content:
            analysis["migration_recommendations"].append(
                "Already uses base classes - may need minor updates"
            )

        self.analysis = analysis
        return analysis

    def migrate(self, dry_run: bool = True) -> str:
        """Migrate test file to use base classes."""
        new_content = self.content

        # Step 1: Add imports if not present
        if "from tests.helpers.router_base import" not in new_content:
            import_line = self._determine_import()
            # Find where to add import
            lines = new_content.splitlines()
            import_index = 0
            for i, line in enumerate(lines):
                if line.startswith("import ") or line.startswith("from "):
                    import_index = i + 1
            lines.insert(import_index, import_line)
            new_content = "\n".join(lines)

        # Step 2: Update test class inheritance
        new_content = self._update_class_inheritance(new_content)

        # Step 3: Add router configuration
        new_content = self._add_router_configuration(new_content)

        # Step 4: Update client fixture
        new_content = self._update_client_fixture(new_content)

        # Step 5: Update assertions
        new_content = self._update_assertions(new_content)

        if dry_run:
            return new_content
        else:
            self.file_path.write_text(new_content)
            return new_content

    def _determine_import(self) -> str:
        """Determine which base class import to add."""
        if "CRUD" in self.analysis.get("patterns_detected", []):
            return "from tests.helpers.router_base import CRUDRouterTestBase"
        elif "Service mocking" in self.analysis.get("patterns_detected", []):
            return "from tests.helpers.router_base import RouterWithServiceTestBase"
        else:
            return "from tests.helpers.router_base import RouterTestBase"

    def _update_class_inheritance(self, content: str) -> str:
        """Update test class to inherit from base class."""
        # Find test classes that don't inherit from base
        pattern = r"class (Test\w+):"

        def replace_class(match):
            class_name = match.group(1)
            if "CRUD" in self.analysis.get("patterns_detected", []):
                return f"class {class_name}(CRUDRouterTestBase):"
            elif "Service mocking" in self.analysis.get("patterns_detected", []):
                return f"class {class_name}(RouterWithServiceTestBase):"
            else:
                return f"class {class_name}(RouterTestBase):"

        return re.sub(pattern, replace_class, content)

    def _add_router_configuration(self, content: str) -> str:
        """Add router module configuration to class."""
        # Find test classes and add configuration
        lines = content.splitlines()
        new_lines = []
        in_test_class = False
        added_config = False

        for i, line in enumerate(lines):
            new_lines.append(line)

            # Detect test class start
            if line.strip().startswith("class Test") and ":" in line:
                in_test_class = True
                added_config = False
                continue

            # Add configuration after class definition
            if in_test_class and not added_config and line.strip() and not line.strip().startswith('"""'):
                # Check if configuration already exists
                if "router_module" not in content[content.find(line):content.find(line) + 500]:
                    indent = "    "
                    config_lines = [
                        f'{indent}# TODO: Configure router',
                        f'{indent}router_module = "dotmac.platform.FIXME.router"',
                        f'{indent}router_prefix = "/FIXME"',
                        "",
                    ]
                    # Insert before current line
                    new_lines = new_lines[:-1] + config_lines + [line]
                added_config = True
                in_test_class = False

        return "\n".join(new_lines)

    def _update_client_fixture(self, content: str) -> str:
        """Update or remove custom client fixture."""
        # Look for custom client fixtures and comment them out
        lines = content.splitlines()
        new_lines = []
        in_client_fixture = False
        fixture_indent = 0

        for line in lines:
            # Detect custom client fixture
            if "@pytest.fixture" in line or "def client(" in line:
                if "def client(" in line or (
                    "@pytest.fixture" in line
                    and any("def client(" in lines[i] for i in range(len(lines)) if i > lines.index(line))
                ):
                    in_client_fixture = True
                    fixture_indent = len(line) - len(line.lstrip())
                    new_lines.append(
                        f"{' ' * fixture_indent}# NOTE: Custom client fixture replaced by base class"
                    )
                    new_lines.append(f"{' ' * fixture_indent}# {line.strip()}")
                    continue

            if in_client_fixture:
                # Check if we're still in the fixture
                if line.strip() and not line.startswith(" " * (fixture_indent + 1)):
                    in_client_fixture = False
                else:
                    new_lines.append(f"{' ' * fixture_indent}# {line.strip()}")
                    continue

            new_lines.append(line)

        return "\n".join(new_lines)

    def _update_assertions(self, content: str) -> str:
        """Update assertions to use base class helpers."""
        replacements = [
            # Status code checks
            (r"assert response\.status_code == 200", "data = self.assert_success(response)"),
            (r"assert response\.status_code == 201", "data = self.assert_success(response, 201)"),
            (r"assert response\.status_code == 404", "self.assert_not_found(response)"),
            (r"assert response\.status_code == 401", "self.assert_unauthorized(response)"),
            (r"assert response\.status_code == 403", "self.assert_forbidden(response)"),
            (r"assert response\.status_code == 422", "self.assert_validation_error(response)"),
            (r"assert response\.status_code == 501", "self.assert_not_implemented(response)"),
        ]

        new_content = content
        for pattern, replacement in replacements:
            new_content = re.sub(pattern, replacement, new_content)

        return new_content


def print_analysis(analysis: dict[str, Any]) -> None:
    """Print analysis results."""
    print("\n" + "=" * 60)
    print(f"Analysis: {analysis['file']}")
    print("=" * 60)

    print(f"\n✓ Router tests detected: {analysis['has_router_tests']}")

    if analysis["test_classes"]:
        print(f"\n✓ Test classes found: {len(analysis['test_classes'])}")
        for cls in analysis["test_classes"]:
            print(f"  - {cls}")

    if analysis["patterns_detected"]:
        print(f"\n✓ Patterns detected:")
        for pattern in analysis["patterns_detected"]:
            print(f"  - {pattern}")

    if analysis["issues_found"]:
        print(f"\n⚠️  Issues found:")
        for issue in analysis["issues_found"]:
            print(f"  - {issue}")

    if analysis["migration_recommendations"]:
        print(f"\n📝 Migration recommendations:")
        for rec in analysis["migration_recommendations"]:
            print(f"  - {rec}")

    print("\n" + "=" * 60)


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Migrate tests to use new base classes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--file", type=Path, help="Test file to migrate")
    parser.add_argument("--directory", type=Path, help="Directory of tests to migrate")
    parser.add_argument(
        "--analyze", action="store_true", help="Only analyze, don't migrate"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without applying",
    )
    parser.add_argument(
        "--apply", action="store_true", help="Apply changes (use with --directory)"
    )

    args = parser.parse_args()

    if not args.file and not args.directory:
        parser.error("Either --file or --directory must be specified")

    files_to_process = []
    if args.file:
        files_to_process = [args.file]
    elif args.directory:
        files_to_process = list(args.directory.glob("test_*.py"))

    for file_path in files_to_process:
        if not file_path.exists():
            print(f"❌ File not found: {file_path}")
            continue

        print(f"\n🔍 Processing: {file_path}")

        migrator = TestFileMigrator(file_path)
        analysis = migrator.analyze()

        if args.analyze:
            print_analysis(analysis)
            continue

        # Perform migration
        dry_run = args.dry_run or not args.apply
        new_content = migrator.migrate(dry_run=dry_run)

        if dry_run:
            print("\n" + "=" * 60)
            print("PREVIEW (dry run - no changes applied)")
            print("=" * 60)
            print(new_content[:1000])  # Show first 1000 chars
            print("...")
            print("\nRun with --apply to make changes")
        else:
            print(f"✅ Migrated: {file_path}")
            print("\n⚠️  Please review and test the migrated file:")
            print("  1. Update router_module and router_prefix")
            print("  2. Review commented-out client fixture")
            print("  3. Test that all tests still pass")

    return 0


if __name__ == "__main__":
    sys.exit(main())
