#!/usr/bin/env python3
"""
Import Rewrite Script for DotMac Project Split.

This script rewrites imports in the split repositories to use
the new package structure:
- dotmac.platform.auth -> dotmac.shared.auth (for shared modules)
- dotmac.platform.db -> dotmac.shared.db
- dotmac.platform.core -> dotmac.shared.core
- dotmac.platform.radius -> dotmac.isp.radius (for ISP modules)

Usage:
    python scripts/rewrite_imports.py --repo shared --dry-run
    python scripts/rewrite_imports.py --repo platform --dry-run
    python scripts/rewrite_imports.py --repo isp --dry-run
    python scripts/rewrite_imports.py --all --execute
"""

import argparse
import re
from pathlib import Path
from typing import NamedTuple


class ImportRewrite(NamedTuple):
    """Import rewrite rule."""
    pattern: str
    replacement: str
    description: str


# Root paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
STAGING_DIR = PROJECT_ROOT / "split-staging"


# Import rewrites for shared modules (used in all repos)
SHARED_REWRITES: list[ImportRewrite] = [
    # Auth module
    ImportRewrite(
        r"from dotmac\.platform\.auth\.core import",
        "from dotmac.shared.auth.core import",
        "Auth core imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.auth\.models import",
        "from dotmac.shared.auth.models import",
        "Auth models imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.auth\.rbac_service import",
        "from dotmac.shared.auth.rbac_service import",
        "RBAC service imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.auth import",
        "from dotmac.shared.auth import",
        "Auth module imports"
    ),

    # Database module
    ImportRewrite(
        r"from dotmac\.platform\.db import",
        "from dotmac.shared.db import",
        "Database imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform import db\b",
        "from dotmac.shared import db",
        "Database module alias"
    ),

    # Core module
    ImportRewrite(
        r"from dotmac\.platform\.core\.caching import",
        "from dotmac.shared.core.caching import",
        "Caching imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.core\.exceptions import",
        "from dotmac.shared.core.exceptions import",
        "Exceptions imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.core import",
        "from dotmac.shared.core import",
        "Core module imports"
    ),

    # Utils module
    ImportRewrite(
        r"from dotmac\.platform\.utils import",
        "from dotmac.shared.utils import",
        "Utils imports"
    ),

    # Router registry
    ImportRewrite(
        r"from dotmac\.shared\.routers\.registry import",
        "from dotmac.shared.routers.registry import",
        "Router registry imports"
    ),
]


# ISP-specific rewrites (for ISP repo only)
ISP_REWRITES: list[ImportRewrite] = [
    # RADIUS
    ImportRewrite(
        r"from dotmac\.platform\.radius import",
        "from dotmac.isp.radius import",
        "RADIUS imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.radius\.(\w+) import",
        r"from dotmac.isp.radius.\1 import",
        "RADIUS submodule imports"
    ),

    # Network
    ImportRewrite(
        r"from dotmac\.platform\.network import",
        "from dotmac.isp.network import",
        "Network imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.network\.(\w+) import",
        r"from dotmac.isp.network.\1 import",
        "Network submodule imports"
    ),

    # Fiber
    ImportRewrite(
        r"from dotmac\.platform\.fiber import",
        "from dotmac.isp.fiber import",
        "Fiber imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.fiber\.(\w+) import",
        r"from dotmac.isp.fiber.\1 import",
        "Fiber submodule imports"
    ),

    # Wireless
    ImportRewrite(
        r"from dotmac\.platform\.wireless import",
        "from dotmac.isp.wireless import",
        "Wireless imports"
    ),

    # VOLTHA
    ImportRewrite(
        r"from dotmac\.platform\.voltha import",
        "from dotmac.isp.voltha import",
        "VOLTHA imports"
    ),

    # GenieACS
    ImportRewrite(
        r"from dotmac\.platform\.genieacs import",
        "from dotmac.isp.genieacs import",
        "GenieACS imports"
    ),

    # Field Service
    ImportRewrite(
        r"from dotmac\.platform\.field_service import",
        "from dotmac.isp.field_service import",
        "Field service imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.field_service\.(\w+) import",
        r"from dotmac.isp.field_service.\1 import",
        "Field service submodule imports"
    ),

    # Customer Portal
    ImportRewrite(
        r"from dotmac\.platform\.customer_portal import",
        "from dotmac.isp.customer_portal import",
        "Customer portal imports"
    ),

    # Subscribers
    ImportRewrite(
        r"from dotmac\.platform\.subscribers import",
        "from dotmac.isp.subscribers import",
        "Subscribers imports"
    ),
    ImportRewrite(
        r"from dotmac\.platform\.subscribers\.(\w+) import",
        r"from dotmac.isp.subscribers.\1 import",
        "Subscribers submodule imports"
    ),
]


def rewrite_file(file_path: Path, rewrites: list[ImportRewrite], dry_run: bool = True) -> list[str]:
    """Rewrite imports in a single file.

    Returns list of changes made.
    """
    if not file_path.suffix == ".py":
        return []

    content = file_path.read_text()
    original_content = content
    changes = []

    for rewrite in rewrites:
        new_content = re.sub(rewrite.pattern, rewrite.replacement, content)
        if new_content != content:
            changes.append(f"{rewrite.description}: {rewrite.pattern} -> {rewrite.replacement}")
            content = new_content

    if content != original_content:
        if dry_run:
            print(f"  Would rewrite: {file_path.name}")
            for change in changes:
                print(f"    - {change}")
        else:
            file_path.write_text(content)
            print(f"  Rewrote: {file_path.name}")
            for change in changes:
                print(f"    - {change}")

    return changes


def process_directory(
    directory: Path,
    rewrites: list[ImportRewrite],
    dry_run: bool = True,
) -> int:
    """Process all Python files in a directory.

    Returns count of files modified.
    """
    if not directory.exists():
        print(f"  ⚠️  Directory not found: {directory}")
        return 0

    modified = 0
    for py_file in directory.rglob("*.py"):
        changes = rewrite_file(py_file, rewrites, dry_run)
        if changes:
            modified += 1

    return modified


def process_repo(repo: str, dry_run: bool = True) -> int:
    """Process a single repository."""
    repo_dir = STAGING_DIR / f"dotmac-{repo}"

    if not repo_dir.exists():
        print(f"Repository not found: {repo_dir}")
        return 0

    print(f"\n📦 Processing {repo} repository")
    print("-" * 40)

    # Determine which rewrites to apply
    if repo == "shared":
        # Shared repo needs relative imports, not external rewrites
        rewrites = []
    elif repo == "platform":
        # Platform uses shared modules
        rewrites = SHARED_REWRITES
    elif repo == "isp":
        # ISP uses shared modules and has its own module structure
        rewrites = SHARED_REWRITES + ISP_REWRITES
    else:
        print(f"Unknown repo: {repo}")
        return 0

    if not rewrites:
        print("  No rewrites needed for this repository")
        return 0

    # Process src directory
    src_dir = repo_dir / "src"
    modified = process_directory(src_dir, rewrites, dry_run)

    # Process tests directory
    tests_dir = repo_dir / "tests"
    if tests_dir.exists():
        modified += process_directory(tests_dir, rewrites, dry_run)

    return modified


def main():
    parser = argparse.ArgumentParser(description="Rewrite imports for DotMac project split")
    parser.add_argument("--repo", choices=["shared", "platform", "isp"], help="Repository to process")
    parser.add_argument("--all", action="store_true", help="Process all repositories")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without executing")
    parser.add_argument("--execute", action="store_true", help="Execute the rewrites")
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        parser.print_help()
        print("\nPlease specify --dry-run or --execute")
        return

    if not args.repo and not args.all:
        parser.print_help()
        print("\nPlease specify --repo or --all")
        return

    dry_run = args.dry_run

    print("=" * 60)
    print("DotMac Import Rewriter")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'EXECUTE'}")
    print()

    total_modified = 0

    if args.all:
        for repo in ["shared", "platform", "isp"]:
            total_modified += process_repo(repo, dry_run)
    else:
        total_modified = process_repo(args.repo, dry_run)

    print("\n" + "=" * 60)
    if dry_run:
        print(f"DRY RUN COMPLETE - {total_modified} files would be modified")
        print("Run with --execute to apply changes")
    else:
        print(f"REWRITE COMPLETE - {total_modified} files modified")
    print("=" * 60)


if __name__ == "__main__":
    main()
