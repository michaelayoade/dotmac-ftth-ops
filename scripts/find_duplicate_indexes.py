#!/usr/bin/env python3
"""
Find Duplicate Index Definitions

Finds models where fields have both index=True and explicit Index() in __table_args__.
This causes "index already exists" errors during database creation.

Usage:
    python scripts/find_duplicate_indexes.py
    python scripts/find_duplicate_indexes.py --fix
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple


def find_indexed_fields(file_path: Path) -> List[Tuple[str, int]]:
    """Find all fields with index=True in a model file."""
    indexed_fields = []

    with open(file_path, 'r') as f:
        for line_num, line in enumerate(f, 1):
            # Match: field_name: Mapped[...] = mapped_column(..., index=True, ...)
            if 'index=True' in line and 'Mapped[' in line:
                # Extract field name
                match = re.search(r'(\w+):\s*Mapped\[', line)
                if match:
                    field_name = match.group(1)
                    indexed_fields.append((field_name, line_num))

    return indexed_fields


def find_explicit_indexes(file_path: Path) -> List[Tuple[str, int, str]]:
    """Find all explicit Index() definitions in __table_args__."""
    explicit_indexes = []

    with open(file_path, 'r') as f:
        content = f.read()

    # Find all Index() definitions
    for match in re.finditer(r'Index\(["\']([^"\']+)["\'],\s*["\']([^"\']+)["\']', content):
        index_name = match.group(1)
        field_name = match.group(2)

        # Find line number
        line_num = content[:match.start()].count('\n') + 1

        explicit_indexes.append((field_name, line_num, index_name))

    return explicit_indexes


def find_duplicates(file_path: Path) -> List[dict]:
    """Find duplicate index definitions in a model file."""
    indexed_fields = find_indexed_fields(file_path)
    explicit_indexes = find_explicit_indexes(file_path)

    duplicates = []

    for field_name, field_line in indexed_fields:
        for explicit_field, explicit_line, index_name in explicit_indexes:
            # Check if the explicit index includes this field
            if field_name == explicit_field or explicit_field.startswith(field_name):
                duplicates.append({
                    'file': file_path,
                    'field_name': field_name,
                    'field_line': field_line,
                    'explicit_line': explicit_line,
                    'index_name': index_name,
                    'explicit_field': explicit_field
                })

    return duplicates


def scan_all_models() -> List[dict]:
    """Scan all model files for duplicate indexes."""
    platform_dir = Path('src/dotmac/platform')
    all_duplicates = []

    for model_file in platform_dir.rglob('models.py'):
        duplicates = find_duplicates(model_file)
        all_duplicates.extend(duplicates)

    return all_duplicates


def fix_duplicate(duplicate: dict, dry_run: bool = True) -> bool:
    """Fix a duplicate index by removing index=True from field."""
    file_path = duplicate['file']
    field_line = duplicate['field_line']
    field_name = duplicate['field_name']

    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Check if line still has index=True
    if field_line - 1 >= len(lines):
        return False

    original_line = lines[field_line - 1]

    if 'index=True' not in original_line:
        return False  # Already fixed

    # Remove index=True from the line
    fixed_line = re.sub(r',?\s*index=True,?', '', original_line)

    # Clean up extra commas
    fixed_line = re.sub(r',\s*,', ',', fixed_line)
    fixed_line = re.sub(r'\(,', '(', fixed_line)
    fixed_line = re.sub(r',\s*\)', ')', fixed_line)

    if dry_run:
        print(f"\n  Would change line {field_line}:")
        print(f"    BEFORE: {original_line.rstrip()}")
        print(f"    AFTER:  {fixed_line.rstrip()}")
        return True
    else:
        lines[field_line - 1] = fixed_line

        with open(file_path, 'w') as f:
            f.writelines(lines)

        print(f"  ✅ Fixed: {file_path}:{field_line}")
        return True


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Find and fix duplicate index definitions')
    parser.add_argument('--fix', action='store_true', help='Actually fix the duplicates (default: dry run)')
    args = parser.parse_args()

    print("🔍 Scanning for duplicate index definitions...\n")

    duplicates = scan_all_models()

    if not duplicates:
        print("✅ No duplicate indexes found!")
        return 0

    print(f"❌ Found {len(duplicates)} duplicate index definitions:\n")

    # Group by file
    by_file = {}
    for dup in duplicates:
        file_key = str(dup['file'])
        if file_key not in by_file:
            by_file[file_key] = []
        by_file[file_key].append(dup)

    # Display and fix
    fixed_count = 0

    for file_path, file_duplicates in sorted(by_file.items()):
        print(f"\n📄 {file_path}")
        print(f"   {len(file_duplicates)} duplicate(s) found:")

        for dup in file_duplicates:
            print(f"\n   🔴 Field '{dup['field_name']}' has BOTH:")
            print(f"      - index=True at line {dup['field_line']}")
            print(f"      - Index('{dup['index_name']}', '{dup['explicit_field']}') at line {dup['explicit_line']}")

            if fix_duplicate(dup, dry_run=not args.fix):
                fixed_count += 1

    print(f"\n{'='*80}")
    if args.fix:
        print(f"✅ Fixed {fixed_count} duplicate index definitions")
    else:
        print(f"ℹ️  Found {len(duplicates)} duplicates (dry run)")
        print(f"   Run with --fix to apply changes")
    print(f"{'='*80}\n")

    return 1 if duplicates and not args.fix else 0


if __name__ == '__main__':
    sys.exit(main())
