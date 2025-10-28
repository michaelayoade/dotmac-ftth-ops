#!/usr/bin/env python3
"""
Categorize authentication module tests for test pyramid markers.

Analyzes test files to determine if they should be marked as:
- unit: Pure logic tests, no DB/HTTP (validators, schemas, utils)
- integration: Service + DB tests (RBAC, tokens, sessions)
- e2e: Router/API tests (login flows, endpoints)
"""

import ast
import json
from pathlib import Path
from typing import Dict, List


class TestCategorizer(ast.NodeVisitor):
    """Analyze test file to categorize test type."""

    def __init__(self):
        self.uses_async_session = False
        self.uses_test_client = False
        self.uses_redis = False
        self.imports_models = False
        self.imports_schemas = False
        self.imports_routers = False
        self.imports_services = False
        self.has_mock = False
        self.test_class_count = 0
        self.function_names = []

    def visit_ImportFrom(self, node):
        if node.module:
            if "models" in node.module:
                self.imports_models = True
            if "schemas" in node.module or "pydantic" in node.module:
                self.imports_schemas = True
            if "router" in node.module or "fastapi" in node.module:
                self.imports_routers = True
            if "service" in node.module:
                self.imports_services = True
            if "mock" in node.module.lower() or "unittest.mock" in node.module:
                self.has_mock = True
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        if node.name.startswith("Test"):
            self.test_class_count += 1
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        self.function_names.append(node.name)

        # Check fixtures
        for arg in node.args.args:
            if arg.arg in ["async_session", "async_db_session", "db_session"]:
                self.uses_async_session = True
            elif arg.arg in ["test_client", "client"]:
                self.uses_test_client = True
            elif arg.arg in ["redis_client", "redis"]:
                self.uses_redis = True

        self.generic_visit(node)


def analyze_test_file(file_path: Path) -> Dict:
    """Analyze a test file and suggest categorization."""
    try:
        with open(file_path, "r") as f:
            content = f.read()
            tree = ast.parse(content)
    except (SyntaxError, FileNotFoundError) as e:
        return {"error": str(e)}

    categorizer = TestCategorizer()
    categorizer.visit(tree)

    # Categorization logic based on patterns
    confidence = "medium"
    suggested_marker = "integration"  # Default for auth tests
    reasoning = []

    # Strong indicators for unit tests
    if categorizer.imports_schemas and not categorizer.uses_async_session and not categorizer.uses_test_client:
        suggested_marker = "unit"
        reasoning.append("Has schema imports, no DB/HTTP dependencies")
        confidence = "high"

    # Check for exception/validator tests (usually unit)
    filename = file_path.name.lower()
    if "exception" in filename or "validation" in filename or "schema" in filename:
        if not categorizer.uses_async_session:
            suggested_marker = "unit"
            reasoning.append(f"Filename pattern '{filename}' suggests unit test")
            confidence = "high"

    # Strong indicators for integration tests
    if categorizer.uses_async_session and not categorizer.uses_test_client:
        suggested_marker = "integration"
        reasoning.append("Uses async_session, no HTTP client")
        confidence = "high"

    # Service tests are usually integration
    if "service" in filename and categorizer.uses_async_session:
        suggested_marker = "integration"
        reasoning.append("Service test with database")
        confidence = "high"

    # Strong indicators for E2E tests
    if categorizer.uses_test_client:
        suggested_marker = "e2e"
        reasoning.append("Uses test_client for HTTP requests")
        confidence = "high"

    # Router tests are usually E2E
    if "router" in filename or "endpoint" in filename:
        suggested_marker = "e2e"
        reasoning.append(f"Filename pattern '{filename}' suggests E2E test")
        confidence = "high" if categorizer.uses_test_client else "medium"

    # Special patterns
    if "_integration" in filename:
        suggested_marker = "integration"
        reasoning.append("Filename explicitly indicates integration test")
        confidence = "high"

    if "_flow" in filename or "_comprehensive" in filename:
        # Could be integration or E2E
        if categorizer.uses_test_client:
            suggested_marker = "e2e"
        else:
            suggested_marker = "integration"
        reasoning.append("Comprehensive/flow test")

    # Auth-specific patterns
    if "rbac" in filename and not categorizer.uses_test_client:
        suggested_marker = "integration"
        reasoning.append("RBAC tests are typically integration (service + DB)")
        confidence = "high"

    if "token" in filename and not categorizer.uses_test_client and not categorizer.uses_async_session:
        suggested_marker = "unit"
        reasoning.append("Token validation without DB is unit test")
        confidence = "high"

    return {
        "file": str(file_path),
        "suggested_marker": suggested_marker,
        "confidence": confidence,
        "reasoning": reasoning,
        "dependencies": {
            "async_session": categorizer.uses_async_session,
            "test_client": categorizer.uses_test_client,
            "redis": categorizer.uses_redis,
            "models": categorizer.imports_models,
            "schemas": categorizer.imports_schemas,
            "routers": categorizer.imports_routers,
            "services": categorizer.imports_services,
            "has_mock": categorizer.has_mock,
        },
        "test_classes": categorizer.test_class_count,
    }


def main():
    """Analyze all auth test files."""
    auth_tests_dir = Path("tests/auth")
    test_files = sorted(auth_tests_dir.glob("test_*.py"))

    results = []
    summary = {"unit": [], "integration": [], "e2e": [], "unknown": []}

    print("=" * 80)
    print("AUTH MODULE TEST CATEGORIZATION")
    print("=" * 80)
    print(f"\nAnalyzing {len(test_files)} test files...\n")

    for test_file in test_files:
        analysis = analyze_test_file(test_file)
        if "error" in analysis:
            print(f"❌ Error analyzing {test_file.name}: {analysis['error']}")
            continue

        results.append(analysis)
        marker = analysis["suggested_marker"]
        summary[marker].append(test_file.name)

        # Print analysis
        confidence_emoji = {"high": "🎯", "medium": "📊", "low": "❓"}
        emoji = confidence_emoji.get(analysis["confidence"], "❓")

        print(f"{emoji} {test_file.name}")
        print(f"   → Suggested: @pytest.mark.{marker} ({analysis['confidence']} confidence)")
        if analysis["reasoning"]:
            print(f"   → Reasoning: {'; '.join(analysis['reasoning'])}")

        deps = analysis["dependencies"]
        dep_flags = []
        if deps["async_session"]:
            dep_flags.append("DB")
        if deps["test_client"]:
            dep_flags.append("HTTP")
        if deps["redis"]:
            dep_flags.append("Redis")
        if dep_flags:
            print(f"   → Dependencies: {', '.join(dep_flags)}")
        print()

    # Print summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"\n📊 Unit Tests (fast, no DB): {len(summary['unit'])} files")
    for f in summary["unit"]:
        print(f"   - {f}")

    print(f"\n🔗 Integration Tests (service + DB): {len(summary['integration'])} files")
    for f in summary["integration"]:
        print(f"   - {f}")

    print(f"\n🌐 E2E Tests (HTTP + DB): {len(summary['e2e'])} files")
    for f in summary["e2e"]:
        print(f"   - {f}")

    if summary["unknown"]:
        print(f"\n❓ Unknown: {len(summary['unknown'])} files")
        for f in summary["unknown"]:
            print(f"   - {f}")

    # Quick action commands
    print("\n" + "=" * 80)
    print("QUICK ACTIONS")
    print("=" * 80)

    if summary["unit"]:
        unit_files = [f"tests/auth/{f}" for f in summary["unit"]]
        print(f"\n# Mark {len(summary['unit'])} unit tests:")
        print(f"python scripts/batch_add_markers.py --marker unit {' '.join(unit_files)}")

    if summary["integration"]:
        int_files = [f"tests/auth/{f}" for f in summary["integration"]]
        print(f"\n# Mark {len(summary['integration'])} integration tests:")
        print(f"python scripts/batch_add_markers.py --marker integration {' '.join(int_files)}")

    if summary["e2e"]:
        e2e_files = [f"tests/auth/{f}" for f in summary["e2e"]]
        print(f"\n# Mark {len(summary['e2e'])} E2E tests:")
        print(f"python scripts/batch_add_markers.py --marker e2e {' '.join(e2e_files)}")

    # Save detailed results to JSON
    output_file = "auth_test_categorization.json"
    with open(output_file, "w") as f:
        json.dump({"results": results, "summary": summary}, f, indent=2)

    print(f"\n💾 Detailed results saved to: {output_file}")
    print()


if __name__ == "__main__":
    main()
