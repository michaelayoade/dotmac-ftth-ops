#!/usr/bin/env python3
"""
Test Pyramid Progress Tracker

Scans test files and reports on pytest marker coverage (unit/integration/e2e).
This helps ensure all tests are properly categorized in the test pyramid.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import TypedDict


class ModuleStats(TypedDict):
    total_files: int
    marked_files: int
    unmarked_files: int
    unit: int
    integration: int
    e2e: int


class ModuleData(TypedDict):
    stats: ModuleStats
    unmarked: list[str]


# Regex patterns for detecting pyramid markers
# Matches both simple and list formats (including multiline):
#   pytestmark = pytest.mark.unit
#   pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]
#   pytestmark = [
#       pytest.mark.integration,
#       pytest.mark.asyncio,
#   ]
#   @pytest.mark.integration
PYRAMID_MARKERS = re.compile(
    r"pytestmark\s*=\s*(?:\[[\s\S]*?)?pytest\.mark\.(unit|integration|e2e)"
    r"|@pytest\.mark\.(unit|integration|e2e)",
    re.MULTILINE,
)


def scan_test_file(filepath: Path) -> str | None:
    """
    Scan a test file for pyramid markers.

    Returns:
        The marker type (unit/integration/e2e) if found, None otherwise
    """
    try:
        content = filepath.read_text(encoding="utf-8")
        match = PYRAMID_MARKERS.search(content)
        if match:
            # Return whichever group matched
            return match.group(1) or match.group(2)
        return None
    except Exception:
        return None


def scan_directory(test_dir: Path) -> dict[str, ModuleData]:
    """
    Scan a test directory for pyramid marker coverage.

    Returns:
        Dictionary mapping module names to their stats
    """
    results: dict[str, ModuleData] = {}

    if not test_dir.exists():
        return results

    # Group test files by their immediate parent directory
    for test_file in test_dir.rglob("test_*.py"):
        # Get the module name (first directory under tests/)
        relative = test_file.relative_to(test_dir)
        module = relative.parts[0] if len(relative.parts) > 1 else "root"

        if module not in results:
            results[module] = {
                "stats": {
                    "total_files": 0,
                    "marked_files": 0,
                    "unmarked_files": 0,
                    "unit": 0,
                    "integration": 0,
                    "e2e": 0,
                },
                "unmarked": [],
            }

        results[module]["stats"]["total_files"] += 1
        marker = scan_test_file(test_file)

        if marker:
            results[module]["stats"]["marked_files"] += 1
            results[module]["stats"][marker] += 1  # type: ignore[literal-required]
        else:
            results[module]["stats"]["unmarked_files"] += 1
            results[module]["unmarked"].append(str(test_file))

    return results


def print_summary(results: dict[str, ModuleData]) -> None:
    """Print a human-readable summary of the results."""
    total_files = sum(m["stats"]["total_files"] for m in results.values())
    total_marked = sum(m["stats"]["marked_files"] for m in results.values())
    total_unmarked = sum(m["stats"]["unmarked_files"] for m in results.values())
    total_unit = sum(m["stats"]["unit"] for m in results.values())
    total_integration = sum(m["stats"]["integration"] for m in results.values())
    total_e2e = sum(m["stats"]["e2e"] for m in results.values())

    print("=" * 60)
    print("📊 Test Pyramid Progress Report")
    print("=" * 60)
    print()
    print(f"Total test files:     {total_files}")
    print(f"Marked files:         {total_marked} ({100 * total_marked // max(total_files, 1)}%)")
    print(f"Unmarked files:       {total_unmarked}")
    print()
    print("By marker type:")
    print(f"  🔷 Unit:        {total_unit}")
    print(f"  🔶 Integration: {total_integration}")
    print(f"  🟢 E2E:         {total_e2e}")
    print()

    if total_unmarked > 0:
        print("⚠️  Unmarked test files by module:")
        for module, data in sorted(results.items()):
            if data["unmarked"]:
                print(f"\n  {module}/ ({len(data['unmarked'])} files):")
                for f in data["unmarked"][:5]:  # Show first 5
                    print(f"    - {f}")
                if len(data["unmarked"]) > 5:
                    print(f"    ... and {len(data['unmarked']) - 5} more")
    else:
        print("✅ All test files have pyramid markers!")

    print()
    print("=" * 60)


def main() -> int:
    parser = argparse.ArgumentParser(description="Track test pyramid marker coverage")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON (for CI)",
    )
    parser.add_argument(
        "--test-dir",
        type=Path,
        default=Path("tests"),
        help="Test directory to scan (default: tests)",
    )
    args = parser.parse_args()

    results = scan_directory(args.test_dir)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_summary(results)

    return 0


if __name__ == "__main__":
    sys.exit(main())
