#!/usr/bin/env python3
"""
Track test pyramid refactoring progress across all modules.

Usage:
    python scripts/test_pyramid_progress.py
    python scripts/test_pyramid_progress.py --detailed
    python scripts/test_pyramid_progress.py --json
"""

import argparse
import ast
import json
from pathlib import Path
from typing import Dict, List


def analyze_test_file(file_path: Path) -> Dict:
    """Analyze a test file for markers and dependencies."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            tree = ast.parse(content)
    except (SyntaxError, FileNotFoundError):
        return {"error": True}

    markers = set()
    has_async_session = False
    has_test_client = False
    test_class_count = 0

    for node in ast.walk(tree):
        # Check for module-level pytestmark
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == 'pytestmark':
                    # pytestmark = pytest.mark.unit or pytestmark = [pytest.mark.e2e, ...]
                    if isinstance(node.value, ast.Attribute):
                        # Single marker: pytestmark = pytest.mark.unit
                        if (isinstance(node.value.value, ast.Attribute) and
                            node.value.value.attr == 'mark'):
                            markers.add(node.value.attr)
                    elif isinstance(node.value, ast.List):
                        # List of markers: pytestmark = [pytest.mark.e2e, pytest.mark.asyncio]
                        for elt in node.value.elts:
                            if isinstance(elt, ast.Attribute):
                                if (isinstance(elt.value, ast.Attribute) and
                                    elt.value.attr == 'mark'):
                                    markers.add(elt.attr)

        # Check for class decorators
        if isinstance(node, ast.ClassDef):
            if node.name.startswith('Test'):
                test_class_count += 1
                for decorator in node.decorator_list:
                    if isinstance(decorator, ast.Attribute):
                        if (isinstance(decorator.value, ast.Attribute) and
                            decorator.value.attr == 'mark'):
                            markers.add(decorator.attr)

        # Check for fixtures
        if isinstance(node, ast.FunctionDef):
            for arg in node.args.args:
                if arg.arg in ['async_session', 'async_db_session']:
                    has_async_session = True
                elif arg.arg in ['test_client', 'client']:
                    has_test_client = True

    return {
        "markers": list(markers),
        "has_async_session": has_async_session,
        "has_test_client": has_test_client,
        "test_class_count": test_class_count,
        "error": False,
    }


def scan_module(module_path: Path, recursive: bool = True) -> Dict:
    """Scan a test module directory."""
    if recursive:
        test_files = list(module_path.rglob("test_*.py"))
    else:
        # Only scan direct children (for ROOT module)
        test_files = list(module_path.glob("test_*.py"))

    stats = {
        "total_files": len(test_files),
        "marked_files": 0,
        "unmarked_files": 0,
        "unit": 0,
        "integration": 0,
        "e2e": 0,
        "test_classes": 0,
    }

    files_detail = []

    for test_file in test_files:
        info = analyze_test_file(test_file)
        if info.get("error"):
            continue

        stats["test_classes"] += info["test_class_count"]

        if info["markers"]:
            stats["marked_files"] += 1
            for marker in info["markers"]:
                if marker in ["unit", "integration", "e2e"]:
                    stats[marker] += 1
        else:
            stats["unmarked_files"] += 1

        files_detail.append({
            "file": str(test_file.relative_to("tests")),
            "markers": info["markers"],
            "needs_db": info["has_async_session"],
            "needs_http": info["has_test_client"],
            "classes": info["test_class_count"],
        })

    return {
        "stats": stats,
        "files": files_detail,
    }


def print_module_summary(module_name: str, data: Dict, detailed: bool = False):
    """Print summary for a module."""
    stats = data["stats"]
    total = stats["total_files"]

    if total == 0:
        return

    marked_pct = (stats["marked_files"] / total * 100) if total > 0 else 0

    # Emoji for progress
    if marked_pct >= 80:
        emoji = "🎉"
    elif marked_pct >= 50:
        emoji = "🚀"
    elif marked_pct >= 20:
        emoji = "📈"
    else:
        emoji = "🎯"

    print(f"\n{emoji} {module_name.upper()}")
    print("=" * 60)
    print(f"Files: {total} total, {stats['marked_files']} marked ({marked_pct:.1f}%)")
    print(f"Distribution:")
    print(f"  🟢 Unit:        {stats['unit']:3d} files")
    print(f"  🟡 Integration: {stats['integration']:3d} files")
    print(f"  🔴 E2E:         {stats['e2e']:3d} files")
    print(f"  ⚪ Unmarked:    {stats['unmarked_files']:3d} files")

    if detailed:
        print(f"\nFiles:")
        for file_info in sorted(data["files"], key=lambda x: (not x["markers"], x["file"])):
            markers_str = ", ".join(f"@{m}" for m in file_info["markers"]) or "no markers"
            status = "✅" if file_info["markers"] else "⏳"
            print(f"  {status} {file_info['file']}: {markers_str}")


def main():
    parser = argparse.ArgumentParser(
        description="Track test pyramid progress"
    )
    parser.add_argument(
        "--detailed", "-d",
        action="store_true",
        help="Show detailed file listing"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output JSON format"
    )
    parser.add_argument(
        "--module", "-m",
        help="Analyze specific module only"
    )

    args = parser.parse_args()

    # Scan ALL test modules (not just a subset)
    tests_dir = Path("tests")
    modules_to_scan = {}

    # Discover all top-level test directories
    if tests_dir.exists():
        # First, add root-level test files as a special "ROOT" module
        root_test_files = list(tests_dir.glob("test_*.py"))
        if root_test_files:
            modules_to_scan["ROOT"] = tests_dir

        # Then add all subdirectories containing tests
        for item in sorted(tests_dir.iterdir()):
            if item.is_dir() and not item.name.startswith('.') and item.name != '__pycache__':
                # Check if it contains test files
                test_files = list(item.rglob("test_*.py"))
                if test_files:
                    modules_to_scan[item.name] = item

    if args.module:
        if args.module not in modules_to_scan:
            print(f"❌ Unknown module: {args.module}")
            print(f"Available: {', '.join(sorted(modules_to_scan.keys()))}")
            return
        modules_to_scan = {args.module: modules_to_scan[args.module]}

    results = {}
    for module_name, module_path in modules_to_scan.items():
        if module_path.exists():
            # For ROOT module, don't scan recursively (only direct children)
            recursive = (module_name != "ROOT")
            results[module_name] = scan_module(module_path, recursive=recursive)

    if args.json:
        print(json.dumps(results, indent=2))
        return

    # Print header
    print("\n" + "=" * 60)
    print("TEST PYRAMID PROGRESS TRACKER")
    print("=" * 60)

    # Print each module
    for module_name, data in results.items():
        print_module_summary(module_name, data, args.detailed)

    # Print overall summary
    total_files = sum(r["stats"]["total_files"] for r in results.values())
    total_marked = sum(r["stats"]["marked_files"] for r in results.values())
    total_unit = sum(r["stats"]["unit"] for r in results.values())
    total_integration = sum(r["stats"]["integration"] for r in results.values())
    total_e2e = sum(r["stats"]["e2e"] for r in results.values())
    total_unmarked = sum(r["stats"]["unmarked_files"] for r in results.values())

    # Calculate pyramid-specific markers
    total_pyramid_marked = total_unit + total_integration + total_e2e

    print("\n" + "=" * 60)
    print("OVERALL PROGRESS")
    print("=" * 60)
    print(f"Total files analyzed: {total_files}")
    print(f"Total with any markers: {total_marked} ({total_marked/total_files*100:.1f}%)")
    print(f"Total with pyramid markers: {total_pyramid_marked} ({total_pyramid_marked/total_files*100:.1f}%)")
    print(f"Total unmarked: {total_unmarked} ({total_unmarked/total_files*100:.1f}%)")
    print()
    print(f"Test Pyramid Distribution:")
    if total_pyramid_marked > 0:
        print(f"  🟢 Unit:        {total_unit:3d} files ({total_unit/total_pyramid_marked*100:.1f}% of pyramid)")
        print(f"  🟡 Integration: {total_integration:3d} files ({total_integration/total_pyramid_marked*100:.1f}% of pyramid)")
        print(f"  🔴 E2E:         {total_e2e:3d} files ({total_e2e/total_pyramid_marked*100:.1f}% of pyramid)")
    else:
        print(f"  🟢 Unit:        {total_unit:3d} files")
        print(f"  🟡 Integration: {total_integration:3d} files")
        print(f"  🔴 E2E:         {total_e2e:3d} files")
    print()
    print(f"Note: {total_marked - total_pyramid_marked} files have other markers (e.g., @pytest.mark.asyncio)")

    # Progress bar (for pyramid markers)
    progress = total_pyramid_marked / total_files if total_files > 0 else 0
    bar_length = 40
    filled = int(bar_length * progress)
    bar = "█" * filled + "░" * (bar_length - filled)
    print()
    print(f"Pyramid Progress: [{bar}] {progress*100:.1f}%")

    # Targets
    print()
    print("Target Distribution (of pyramid-marked tests):")
    if total_pyramid_marked > 0:
        print(f"  Unit:        60% (target: {int(total_pyramid_marked * 0.6):3d} files, current: {total_unit:3d})")
        print(f"  Integration: 30% (target: {int(total_pyramid_marked * 0.3):3d} files, current: {total_integration:3d})")
        print(f"  E2E:         10% (target: {int(total_pyramid_marked * 0.1):3d} files, current: {total_e2e:3d})")
    else:
        print(f"  Unit:        60%")
        print(f"  Integration: 30%")
        print(f"  E2E:         10%")

    # Next steps
    pyramid_unmarked = total_files - total_pyramid_marked
    print()
    print("Next Steps:")
    print(f"  1. Add pyramid markers to {pyramid_unmarked} files ({pyramid_unmarked} without unit/integration/e2e)")
    print(f"  2. {total_marked - total_pyramid_marked} files have other markers (e.g., asyncio) - categorize these")
    print(f"  3. Run: python scripts/batch_add_markers.py --marker <type> <files>")
    print()
    print(f"Goal: 95% of files with pyramid markers ({int(total_files * 0.95)} of {total_files} files)")


if __name__ == "__main__":
    main()
