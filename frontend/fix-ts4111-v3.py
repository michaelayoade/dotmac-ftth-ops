#!/usr/bin/env python3
"""
Fix all TS4111 'Property comes from an index signature' errors
by converting dot notation to bracket notation - Version 3.
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple
from collections import defaultdict

def parse_error_file(error_file: Path) -> List[Tuple[str, int, str]]:
    """Parse TS4111 errors from file."""
    errors = []
    with open(error_file) as f:
        for line in f:
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

    original = line

    # Pattern 1: .propertyName -> ['propertyName']
    # Must be preceded by a valid identifier char, closing bracket, closing paren, or closing brace
    pattern1 = r'([\w\]\)\}])\.' + prop_escaped + r'\b'
    replacement1 = r"\1['" + property_name + r"']"
    line = re.sub(pattern1, replacement1, line)

    # Pattern 2: ?.propertyName -> ?.['propertyName']
    pattern2 = r'\?\.' + prop_escaped + r'\b'
    replacement2 = r"?.['" + property_name + r"']"
    line = re.sub(pattern2, replacement2, line)

    # If no change, try more aggressive patterns
    if line == original:
        # Try without word boundary for properties with underscores
        pattern3 = r'\.' + prop_escaped
        # Only replace if not already in bracket notation and not followed by (
        if not re.search(r"\['" + prop_escaped + r"'\]", line):
            line = re.sub(pattern3, r"['" + property_name + r"']", line)

    return line

def fix_ts4111_in_file(base_dir: Path, file_path: str, errors_for_file: List[Tuple[int, str]]) -> bool:
    """
    Fix TS4111 errors in a single file.
    errors_for_file: List of (line_number, property_name) tuples
    """
    full_path = base_dir / file_path
    try:
        lines = full_path.read_text().splitlines(keepends=True)
        modified = False

        # Process errors in reverse order to avoid line number shifts
        for line_num, property_name in sorted(errors_for_file, reverse=True):
            if line_num <= len(lines):
                original_line = lines[line_num - 1]
                fixed_line = fix_line(original_line, property_name)

                if fixed_line != original_line:
                    lines[line_num - 1] = fixed_line
                    modified = True
                    print(f"    Line {line_num}: {property_name}")

        if modified:
            full_path.write_text(''.join(lines))
            return True
        return False

    except Exception as e:
        print(f"Error processing {file_path}: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False

def main():
    base_dir = Path("/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/isp-ops-app")
    error_file = Path("/tmp/ts4111-errors.txt")

    if not error_file.exists():
        print("Error file not found. Run pnpm type-check first.")
        return 1

    print("Parsing TS4111 errors...")
    errors = parse_error_file(error_file)

    if not errors:
        print("No TS4111 errors found!")
        return 0

    print(f"Found {len(errors)} TS4111 errors")

    # Group errors by file
    errors_by_file = defaultdict(list)
    for file_path, line_num, property_name in errors:
        errors_by_file[file_path].append((line_num, property_name))

    print(f"Across {len(errors_by_file)} files\n")

    modified_count = 0
    total_files = len(errors_by_file)

    for idx, (file_rel_path, file_errors) in enumerate(sorted(errors_by_file.items()), 1):
        print(f"[{idx}/{total_files}] {file_rel_path} ({len(file_errors)} errors)")

        if fix_ts4111_in_file(base_dir, file_rel_path, file_errors):
            modified_count += 1
            print(f"  ✓ Modified")
        else:
            print(f"  - No changes made")

    print(f"\n{'='*60}")
    print(f"Total files with errors: {total_files}")
    print(f"Total files modified: {modified_count}")
    print(f"{'='*60}")

    return 0

if __name__ == "__main__":
    sys.exit(main())
