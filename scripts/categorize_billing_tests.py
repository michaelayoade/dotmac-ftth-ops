#!/usr/bin/env python3
"""
Script to categorize billing tests into unit/integration/e2e based on their dependencies.

Usage:
    python scripts/categorize_billing_tests.py
"""

import ast
import os
from pathlib import Path
from typing import Dict, List, Set


class TestCategorizer(ast.NodeVisitor):
    """AST visitor to categorize tests based on dependencies."""

    def __init__(self):
        self.uses_async_session = False
        self.uses_test_client = False
        self.uses_database = False
        self.uses_real_services = False
        self.has_marker = False
        self.marker_type = None
        self.test_classes = []
        self.imports = set()

    def visit_Import(self, node):
        """Track imports."""
        for alias in node.names:
            self.imports.add(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        """Track from imports."""
        if node.module:
            self.imports.add(node.module)
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        """Check function parameters for fixtures."""
        for arg in node.args.args:
            arg_name = arg.arg
            if arg_name in ["async_session", "async_db_session", "db_session"]:
                self.uses_async_session = True
                self.uses_database = True
            elif arg_name in ["test_client", "client"]:
                self.uses_test_client = True

        self.generic_visit(node)

    def visit_ClassDef(self, node):
        """Check class decorators for markers."""
        test_class_info = {
            "name": node.name,
            "has_marker": False,
            "marker_type": None,
            "line_number": node.lineno,
        }

        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Attribute):
                if (
                    isinstance(decorator.value, ast.Attribute)
                    and decorator.value.attr == "mark"
                ):
                    self.has_marker = True
                    self.marker_type = decorator.attr
                    test_class_info["has_marker"] = True
                    test_class_info["marker_type"] = decorator.attr

        if node.name.startswith("Test"):
            self.test_classes.append(test_class_info)

        self.generic_visit(node)


def categorize_test_file(file_path: Path) -> Dict:
    """Categorize a test file based on its dependencies."""
    with open(file_path, "r") as f:
        try:
            tree = ast.parse(f.read())
        except SyntaxError:
            return {"error": "Syntax error in file"}

    categorizer = TestCategorizer()
    categorizer.visit(tree)

    # Determine category based on dependencies
    if categorizer.has_marker:
        category = categorizer.marker_type
        confidence = "high"
    elif categorizer.uses_test_client:
        category = "e2e"
        confidence = "high"
    elif categorizer.uses_async_session or categorizer.uses_database:
        category = "integration"
        confidence = "high"
    elif any(
        keyword in str(file_path).lower()
        for keyword in ["utils", "models", "schemas", "validators", "calculator"]
    ):
        category = "unit"
        confidence = "medium"
    else:
        category = "unknown"
        confidence = "low"

    return {
        "category": category,
        "confidence": confidence,
        "has_marker": categorizer.has_marker,
        "marker_type": categorizer.marker_type,
        "uses_async_session": categorizer.uses_async_session,
        "uses_test_client": categorizer.uses_test_client,
        "test_classes": categorizer.test_classes,
    }


def analyze_billing_tests():
    """Analyze all billing test files."""
    billing_test_dir = Path("tests/billing")

    if not billing_test_dir.exists():
        print(f"❌ Directory not found: {billing_test_dir}")
        return

    results = {
        "unit": [],
        "integration": [],
        "e2e": [],
        "unknown": [],
        "already_marked": [],
    }

    test_files = list(billing_test_dir.rglob("test_*.py"))

    print(f"📊 Analyzing {len(test_files)} billing test files...\n")

    for test_file in sorted(test_files):
        relative_path = test_file.relative_to("tests")
        info = categorize_test_file(test_file)

        if "error" in info:
            print(f"⚠️  {relative_path}: {info['error']}")
            continue

        category = info["category"]
        confidence = info["confidence"]

        if info["has_marker"]:
            results["already_marked"].append((relative_path, info["marker_type"]))
        else:
            results[category].append((relative_path, confidence, info))

    # Print summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)

    print(f"\n✅ Already marked: {len(results['already_marked'])} files")
    for path, marker in results["already_marked"][:5]:
        print(f"   - {path} (@pytest.mark.{marker})")
    if len(results["already_marked"]) > 5:
        print(f"   ... and {len(results['already_marked']) - 5} more")

    print(f"\n🚀 Unit test candidates: {len(results['unit'])} files")
    for path, confidence, _ in results["unit"][:10]:
        print(f"   - {path} (confidence: {confidence})")
    if len(results["unit"]) > 10:
        print(f"   ... and {len(results['unit']) - 10} more")

    print(f"\n🔗 Integration test candidates: {len(results['integration'])} files")
    for path, confidence, info in results["integration"][:10]:
        db_marker = "✓ uses DB" if info["uses_async_session"] else ""
        print(f"   - {path} (confidence: {confidence}) {db_marker}")
    if len(results["integration"]) > 10:
        print(f"   ... and {len(results['integration']) - 10} more")

    print(f"\n🌐 E2E test candidates: {len(results['e2e'])} files")
    for path, confidence, _ in results["e2e"]:
        print(f"   - {path} (confidence: {confidence})")

    print(f"\n❓ Unknown category: {len(results['unknown'])} files")
    for path, confidence, _ in results["unknown"][:5]:
        print(f"   - {path} (needs manual review)")
    if len(results["unknown"]) > 5:
        print(f"   ... and {len(results['unknown']) - 5} more")

    # Print statistics
    total_files = len(test_files)
    marked = len(results["already_marked"])
    unmarked = total_files - marked

    print("\n" + "=" * 80)
    print("STATISTICS")
    print("=" * 80)
    print(f"Total test files: {total_files}")
    print(f"Already marked: {marked} ({marked/total_files*100:.1f}%)")
    print(f"Need markers: {unmarked} ({unmarked/total_files*100:.1f}%)")

    print(f"\nRecommended distribution:")
    print(f"  Unit: {len(results['unit'])} files")
    print(f"  Integration: {len(results['integration'])} files")
    print(f"  E2E: {len(results['e2e'])} files")

    # Generate commands for easy marking
    print("\n" + "=" * 80)
    print("QUICK ACTIONS")
    print("=" * 80)

    print("\n# Mark clear unit test candidates:")
    for path, confidence, _ in results["unit"][:5]:
        if confidence == "high":
            print(f"# Add @pytest.mark.unit to: tests/{path}")

    print("\n# Mark clear integration test candidates:")
    for path, confidence, info in results["integration"][:5]:
        if info["uses_async_session"]:
            print(f"# Add @pytest.mark.integration to: tests/{path}")

    return results


if __name__ == "__main__":
    import sys

    # Change to project root if running from scripts dir
    if Path.cwd().name == "scripts":
        os.chdir("..")

    if not Path("tests/billing").exists():
        print("❌ Error: Must run from project root directory")
        sys.exit(1)

    analyze_billing_tests()
