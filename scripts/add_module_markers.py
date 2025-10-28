#!/usr/bin/env python3
"""
Add module-level pytest markers to function-based test files.

Usage:
    python scripts/add_module_markers.py --marker integration <file1> <file2> ...
"""

import argparse
import ast
from pathlib import Path
from typing import List


def has_pytest_import(lines: List[str]) -> bool:
    """Return True if the file already imports pytest."""
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("import pytest"):
            return True
    return False


def ensure_pytest_import(lines: List[str]) -> List[str]:
    """Ensure `import pytest` is present, inserting after the module docstring when needed."""
    if has_pytest_import(lines):
        return lines

    source = "\n".join(lines)
    insert_idx = 0

    try:
        module = ast.parse(source)
    except SyntaxError:
        module = None

    if module and module.body:
        first_stmt = module.body[0]
        if (
            isinstance(first_stmt, ast.Expr)
            and isinstance(getattr(first_stmt, "value", None), ast.Constant)
            and isinstance(first_stmt.value.value, str)
        ):
            insert_idx = first_stmt.end_lineno or first_stmt.lineno

    # Ensure we insert after any __future__ imports
    future_indices = [
        idx for idx, line in enumerate(lines) if line.strip().startswith("from __future__ import")
    ]
    if future_indices:
        insert_idx = max(insert_idx, future_indices[-1] + 1)

    lines.insert(insert_idx, "import pytest")

    # Insert a blank line after the new import if the next line is not already blank.
    if insert_idx + 1 < len(lines) and lines[insert_idx + 1].strip():
        lines.insert(insert_idx + 1, "")

    return lines


def add_pytestmark(file_path: Path, marker: str) -> bool:
    """Add pytestmark to the top of a test file after imports."""
    try:
        content = file_path.read_text()

        # Check if pytestmark already exists
        if f"pytestmark = pytest.mark.{marker}" in content or f"pytestmark = [pytest.mark.{marker}" in content:
            return False  # Already has marker

        lines = content.split("\n")
        lines = ensure_pytest_import(lines)

        last_import_line = -1
        for i, line in enumerate(lines):
            if line.strip().startswith(("import ", "from ")):
                last_import_line = i

        insert_position = last_import_line + 1 if last_import_line != -1 else 0

        marker_line = f"pytestmark = pytest.mark.{marker}"

        if insert_position > 0 and lines[insert_position - 1].strip():
            lines.insert(insert_position, "")
            insert_position += 1

        lines.insert(insert_position, marker_line)
        insert_position += 1

        if insert_position < len(lines) and lines[insert_position].strip():
            lines.insert(insert_position, "")

        file_path.write_text("\n".join(lines) + "\n")
        return True

    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Add module-level pytest markers")
    parser.add_argument(
        "--marker",
        required=True,
        choices=["unit", "integration", "e2e"],
        help="Marker to add",
    )
    parser.add_argument("files", nargs="+", help="Test files to process")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")

    args = parser.parse_args()

    print(f"📋 Processing {len(args.files)} files")
    print(f"🏷️  Marker: pytestmark = pytest.mark.{args.marker}\n")

    modified = 0
    skipped = 0

    for file_path_str in args.files:
        file_path = Path(file_path_str)

        if not file_path.exists():
            print(f"⚠️  {file_path.name}: File not found")
            skipped += 1
            continue

        if args.dry_run:
            print(f"[DRY RUN] Would add pytestmark to {file_path.name}")
            continue

        if add_pytestmark(file_path, args.marker):
            print(f"✅ {file_path.name}: Added pytestmark = pytest.mark.{args.marker}")
            modified += 1
        else:
            print(f"ℹ️  {file_path.name}: Marker already exists or could not be inserted")
            skipped += 1

    print()
    print("=" * 60)
    print(f"✨ Modified {modified} files")
    print(f"⏭️  Skipped {skipped} files")


if __name__ == "__main__":
    main()
