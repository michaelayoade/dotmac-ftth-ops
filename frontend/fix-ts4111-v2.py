#!/usr/bin/env python3
"""
Fix all TS4111 'Property comes from an index signature' errors
by converting dot notation to bracket notation - Version 2 with better pattern matching.
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple

def get_ts4111_errors() -> List[Tuple[str, int, str]]:
    """Parse TS4111 errors from type-check output."""
    import subprocess

    result = subprocess.run(
        ["pnpm", "type-check"],
        cwd="/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/isp-ops-app",
        capture_output=True,
        text=True
    )

    errors = []
    for line in result.stderr.splitlines():
        if "TS4111" in line:
            # Parse: file.tsx(line,col): error TS4111: Property 'name' comes from...
            match = re.match(r'^(.+?)\((\d+),\d+\):.+Property \'(.+?)\' comes from', line)
            if match:
                file_path = match.group(1)
                line_num = int(match.group(2))
                property_name = match.group(3)
                errors.append((file_path, line_num, property_name))

    return errors

def fix_line(line: str, property_name: str) -> str:
    """Fix a specific property access in a line."""
    # Escape property name for regex
    prop_escaped = re.escape(property_name)

    # Pattern 1: .propertyName -> ['propertyName']
    # Must be preceded by a valid identifier, closing bracket, closing paren, or closing brace
    pattern1 = r'([\w\]\)\}])\.{}\b'.format(prop_escaped)
    replacement1 = r"\1['{}']".format(property_name)
    line = re.sub(pattern1, replacement1, line)

    # Pattern 2: ?.propertyName -> ?.['propertyName']
    pattern2 = r'\?\.{}\b'.format(prop_escaped)
    replacement2 = r"?.['{}']".format(property_name)
    line = re.sub(pattern2, replacement2, line)

    return line

def fix_ts4111_in_file(file_path: Path, errors_for_file: List[Tuple[int, str]]) -> bool:
    """
    Fix TS4111 errors in a single file.
    errors_for_file: List of (line_number, property_name) tuples
    """
    try:
        lines = file_path.read_text().splitlines(keepends=True)
        modified = False

        for line_num, property_name in errors_for_file:
            if line_num <= len(lines):
                original_line = lines[line_num - 1]
                fixed_line = fix_line(original_line, property_name)

                if fixed_line != original_line:
                    lines[line_num - 1] = fixed_line
                    modified = True

        if modified:
            file_path.write_text(''.join(lines))
            return True
        return False

    except Exception as e:
        print(f"Error processing {file_path}: {e}", file=sys.stderr)
        return False

def main():
    base_dir = Path("/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/isp-ops-app")

    print("Analyzing TS4111 errors...")
    errors = get_ts4111_errors()

    if not errors:
        print("No TS4111 errors found!")
        return 0

    print(f"Found {len(errors)} TS4111 errors")

    # Group errors by file
    errors_by_file = {}
    for file_path, line_num, property_name in errors:
        if file_path not in errors_by_file:
            errors_by_file[file_path] = []
        errors_by_file[file_path].append((line_num, property_name))

    print(f"Across {len(errors_by_file)} files\n")

    modified_count = 0
    total_files = len(errors_by_file)

    for idx, (file_rel_path, file_errors) in enumerate(errors_by_file.items(), 1):
        file_path = base_dir / file_rel_path

        if not file_path.exists():
            print(f"[{idx}/{total_files}] Warning: File not found: {file_path}", file=sys.stderr)
            continue

        print(f"[{idx}/{total_files}] Processing: {file_rel_path} ({len(file_errors)} errors)")

        if fix_ts4111_in_file(file_path, file_errors):
            modified_count += 1
            print(f"  ✓ Modified")
        else:
            print(f"  - No changes made")

    print(f"\n{'='*60}")
    print(f"Total files with errors: {total_files}")
    print(f"Total files modified: {modified_count}")
    print(f"{'='*60}")

    # Re-check for remaining errors
    print("\nRe-checking for remaining TS4111 errors...")
    remaining_errors = get_ts4111_errors()
    print(f"Remaining TS4111 errors: {len(remaining_errors)}")

    if remaining_errors and len(remaining_errors) < 20:
        print("\nRemaining errors:")
        for file_path, line_num, property_name in remaining_errors[:20]:
            print(f"  {file_path}:{line_num} - property '{property_name}'")

    return 0

if __name__ == "__main__":
    sys.exit(main())
