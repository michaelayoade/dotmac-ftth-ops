#!/usr/bin/env python3
"""Find async fixtures that are missing pytest_asyncio decorator."""

import os
import re
from pathlib import Path

def find_async_fixture_issues(test_dir):
    """Find all async fixtures using @pytest.fixture instead of @pytest_asyncio.fixture."""
    issues = []

    for filepath in Path(test_dir).rglob("*.py"):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            for i, line in enumerate(lines, 1):
                # Check if this is a @pytest.fixture decorator
                if re.match(r'\s*@pytest\.fixture', line):
                    # Check if the next line (or lines after whitespace) contains async def
                    for j in range(i, min(i + 5, len(lines))):
                        if 'async def ' in lines[j]:
                            issues.append({
                                'file': str(filepath),
                                'line': i,
                                'decorator': line.strip(),
                                'function': lines[j].strip()
                            })
                            break
        except Exception as e:
            print(f"Error reading {filepath}: {e}")

    return issues

if __name__ == '__main__':
    test_dir = '/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/tests'
    issues = find_async_fixture_issues(test_dir)

    print(f"Found {len(issues)} async fixtures with incorrect decorator:\n")

    # Group by file
    by_file = {}
    for issue in issues:
        file = issue['file']
        if file not in by_file:
            by_file[file] = []
        by_file[file].append(issue)

    for file, file_issues in sorted(by_file.items()):
        print(f"\n{file} ({len(file_issues)} issues):")
        for issue in file_issues:
            print(f"  Line {issue['line']}: {issue['decorator']} -> {issue['function']}")

    print(f"\n\nTotal files affected: {len(by_file)}")
    print(f"Total issues: {len(issues)}")
