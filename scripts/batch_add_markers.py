#!/usr/bin/env python3
"""
Batch add pytest markers to test files.

Usage:
    python scripts/batch_add_markers.py --marker integration tests/billing/test_*.py
    python scripts/batch_add_markers.py --marker unit tests/billing/test_money*.py --dry-run
"""

import argparse
import ast
import sys
from pathlib import Path
from typing import List, Tuple


def ensure_pytest_import(content: str) -> Tuple[str, bool]:
    """Ensure `import pytest` is present in the module."""
    lines = content.split('\n')
    for line in lines:
        if line.strip().startswith("import pytest"):
            return content, False

    insert_idx = 0
    try:
        module = ast.parse(content)
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

    lines.insert(insert_idx, "import pytest")
    if insert_idx + 1 < len(lines) and lines[insert_idx + 1].strip():
        lines.insert(insert_idx + 1, "")

    return '\n'.join(lines), True


def add_marker_to_class(content: str, marker: str) -> str:
    """Add pytest marker to all test classes in the content."""
    lines = content.split('\n')
    modified_lines: List[str] = []
    i = 0

    while i < len(lines):
        line = lines[i]

        if line.strip().startswith('class Test'):
            if modified_lines and f'@pytest.mark.{marker}' in modified_lines[-1]:
                modified_lines.append(line)
                i += 1
                continue

            if modified_lines and '@pytest.mark.' in modified_lines[-1]:
                modified_lines.append(line)
                i += 1
                continue

            indent = len(line) - len(line.lstrip())
            marker_line = ' ' * indent + f'@pytest.mark.{marker}'
            modified_lines.append(marker_line)
            modified_lines.append(line)
            i += 1
        else:
            modified_lines.append(line)
            i += 1

    return '\n'.join(modified_lines)


def process_file(file_path: Path, marker: str, dry_run: bool = False) -> bool:
    """Process a single file to add markers."""
    try:
        content = file_path.read_text()

        first_lines = '\n'.join(content.split('\n')[:50])
        if f'@pytest.mark.{marker}' in first_lines:
            print(f"⏭️  {file_path.name}: Already has @pytest.mark.{marker}")
            return False

        content, import_added = ensure_pytest_import(content)
        modified_content = add_marker_to_class(content, marker)

        if modified_content == content and not import_added:
            print(f"ℹ️  {file_path.name}: No test classes found")
            return False

        if dry_run:
            print(f"🔍 {file_path.name}: Would add @pytest.mark.{marker}")
            if import_added:
                print("   (Would also insert `import pytest`)")
            preview_lines = modified_content.split('\n')[:60]
            for line in preview_lines:
                if f'@pytest.mark.{marker}' in line or 'class Test' in line:
                    print(f"   {line}")
            return False

        if not modified_content.endswith('\n'):
            modified_content += '\n'

        file_path.write_text(modified_content)
        print(f"✅ {file_path.name}: Added @pytest.mark.{marker}")
        return True

    except Exception as e:
        print(f"❌ {file_path.name}: Error - {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Batch add pytest markers to test files"
    )
    parser.add_argument(
        '--marker', '-m',
        required=True,
        choices=['unit', 'integration', 'e2e', 'slow', 'comprehensive'],
        help="Marker to add"
    )
    parser.add_argument(
        'files',
        nargs='+',
        help="Test files to process (supports globs)"
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help="Show what would be done without making changes"
    )

    args = parser.parse_args()

    files_to_process = []
    for pattern in args.files:
        path = Path(pattern)
        if path.is_file():
            files_to_process.append(path)
        elif '*' in pattern:
            files_to_process.extend(Path('.').glob(pattern))

    if not files_to_process:
        print("❌ No files found to process")
        sys.exit(1)

    print(f"📋 Found {len(files_to_process)} files to process")
    print(f"🏷️  Marker: @pytest.mark.{args.marker}")
    if args.dry_run:
        print("🔍 DRY RUN MODE - no changes will be made")
    print()

    modified_count = 0
    for file_path in sorted(files_to_process):
        if process_file(file_path, args.marker, args.dry_run):
            modified_count += 1

    print()
    print("=" * 60)
    if args.dry_run:
        print(f"Would modify {modified_count} files")
        print("\nRun without --dry-run to apply changes")
    else:
        print(f"✨ Modified {modified_count} files")
        print(f"⏭️  Skipped {len(files_to_process) - modified_count} files")

        if modified_count > 0:
            print("\nNext steps:")
            print(f"  1. Verify changes: git diff")
            print(f"  2. Test: pytest -m {args.marker} tests/ --collect-only")
            print(f"  3. Run tests: pytest -m {args.marker} tests/")


if __name__ == "__main__":
    main()
