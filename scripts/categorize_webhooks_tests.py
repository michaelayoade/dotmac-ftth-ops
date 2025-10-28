#!/usr/bin/env python3
"""
Categorize webhooks module tests for test pyramid markers.

Analyzes test files to determine if they should be marked as:
- unit: Pure logic tests, no DB/HTTP (validators, models, schemas)
- integration: Service + DB tests (webhook delivery, retry logic)
- e2e: Router/API tests (webhook endpoints, subscriptions)
"""

import ast
import json
from pathlib import Path
from typing import Dict


class TestCategorizer(ast.NodeVisitor):
    """Analyze test file to categorize test type."""

    def __init__(self):
        self.uses_async_session = False
        self.uses_test_client = False
        self.uses_httpx = False
        self.imports_models = False
        self.imports_schemas = False
        self.imports_routers = False
        self.imports_services = False
        self.has_mock = False
        self.test_class_count = 0

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
            if "httpx" in node.module:
                self.uses_httpx = True
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        if node.name.startswith("Test"):
            self.test_class_count += 1
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        for arg in node.args.args:
            if arg.arg in ["async_session", "async_db_session", "db_session"]:
                self.uses_async_session = True
            elif arg.arg in ["test_client", "client"]:
                self.uses_test_client = True
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

    confidence = "medium"
    suggested_marker = "integration"  # Default for webhooks
    reasoning = []

    filename = file_path.name.lower()

    # Strong indicators for unit tests
    if "models" in filename and not categorizer.uses_async_session:
        suggested_marker = "unit"
        reasoning.append("Model/schema tests without DB are unit tests")
        confidence = "high"

    if "unit" in filename:
        suggested_marker = "unit"
        reasoning.append("Filename explicitly indicates unit test")
        confidence = "high"

    # Events tests are usually unit (validation logic)
    if "event" in filename and not categorizer.uses_async_session:
        suggested_marker = "unit"
        reasoning.append("Event validation without DB is unit test")
        confidence = "high"

    # Strong indicators for integration tests
    if categorizer.uses_async_session and not categorizer.uses_test_client:
        suggested_marker = "integration"
        reasoning.append("Uses async_session, no HTTP client")
        confidence = "high"

    # Service tests with DB are integration
    if "service" in filename and categorizer.uses_async_session:
        suggested_marker = "integration"
        reasoning.append("Service test with database")
        confidence = "high"

    # Delivery and retry tests are integration
    if "delivery" in filename or "retry" in filename:
        suggested_marker = "integration"
        reasoning.append("Webhook delivery/retry requires external HTTP calls")
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

    return {
        "file": str(file_path),
        "suggested_marker": suggested_marker,
        "confidence": confidence,
        "reasoning": reasoning,
        "dependencies": {
            "async_session": categorizer.uses_async_session,
            "test_client": categorizer.uses_test_client,
            "httpx": categorizer.uses_httpx,
            "models": categorizer.imports_models,
            "schemas": categorizer.imports_schemas,
            "routers": categorizer.imports_routers,
            "services": categorizer.imports_services,
            "has_mock": categorizer.has_mock,
        },
        "test_classes": categorizer.test_class_count,
    }


def main():
    """Analyze all webhooks test files."""
    webhooks_tests_dir = Path("tests/webhooks")
    test_files = sorted(webhooks_tests_dir.glob("test_*.py"))

    results = []
    summary = {"unit": [], "integration": [], "e2e": [], "unknown": []}

    print("=" * 80)
    print("WEBHOOKS MODULE TEST CATEGORIZATION")
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
        if deps["httpx"]:
            dep_flags.append("HTTPX")
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
        unit_files = [f"tests/webhooks/{f}" for f in summary["unit"]]
        print(f"\n# Mark {len(summary['unit'])} unit tests:")
        print(f"python scripts/batch_add_markers.py --marker unit {' '.join(unit_files)}")

    if summary["integration"]:
        int_files = [f"tests/webhooks/{f}" for f in summary["integration"]]
        print(f"\n# Mark {len(summary['integration'])} integration tests:")
        print(f"python scripts/batch_add_markers.py --marker integration {' '.join(int_files)}")

    if summary["e2e"]:
        e2e_files = [f"tests/webhooks/{f}" for f in summary["e2e"]]
        print(f"\n# Mark {len(summary['e2e'])} E2E tests:")
        print(f"python scripts/batch_add_markers.py --marker e2e {' '.join(e2e_files)}")

    # Save detailed results to JSON
    output_file = "webhooks_test_categorization.json"
    with open(output_file, "w") as f:
        json.dump({"results": results, "summary": summary}, f, indent=2)

    print(f"\n💾 Detailed results saved to: {output_file}")
    print()


if __name__ == "__main__":
    main()
