#!/usr/bin/env python3
"""
DotMac Monorepo Split Script

This script automates the process of splitting the monorepo into three separate
repositories: dotmac-shared, dotmac-platform, and dotmac-isp.

Usage:
    python scripts/split_monorepo.py --dry-run    # Preview changes
    python scripts/split_monorepo.py --execute    # Execute the split
"""

import argparse
import os
import shutil
from pathlib import Path
from typing import NamedTuple


class ModuleMapping(NamedTuple):
    """Mapping of source module to destination repository."""
    source: str
    destination: str
    repo: str  # 'shared', 'platform', or 'isp'


# Root paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
STAGING_DIR = PROJECT_ROOT / "split-staging"


# Module mappings for the split
BACKEND_MAPPINGS: list[ModuleMapping] = [
    # SHARED - Common modules used by both Platform and ISP
    ModuleMapping("src/dotmac/platform/auth/core.py", "src/dotmac/shared/auth/core.py", "shared"),
    ModuleMapping("src/dotmac/platform/auth/models.py", "src/dotmac/shared/auth/models.py", "shared"),
    ModuleMapping("src/dotmac/platform/auth/rbac_service.py", "src/dotmac/shared/auth/rbac_service.py", "shared"),
    ModuleMapping("src/dotmac/platform/db/__init__.py", "src/dotmac/shared/db/__init__.py", "shared"),
    ModuleMapping("src/dotmac/platform/db/types.py", "src/dotmac/shared/db/types.py", "shared"),
    ModuleMapping("src/dotmac/platform/db.py", "src/dotmac/shared/db/legacy.py", "shared"),
    ModuleMapping("src/dotmac/platform/core/caching.py", "src/dotmac/shared/core/caching.py", "shared"),
    ModuleMapping("src/dotmac/platform/core/logging.py", "src/dotmac/shared/core/logging.py", "shared"),
    ModuleMapping("src/dotmac/platform/core/exceptions.py", "src/dotmac/shared/core/exceptions.py", "shared"),
    ModuleMapping("src/dotmac/platform/utils/", "src/dotmac/shared/utils/", "shared"),
    ModuleMapping("src/dotmac/shared/routers/registry.py", "src/dotmac/shared/routers/registry.py", "shared"),

    # PLATFORM - Control plane modules
    ModuleMapping("src/dotmac/platform/tenant/", "src/dotmac/platform/tenant/", "platform"),
    ModuleMapping("src/dotmac/platform/licensing/", "src/dotmac/platform/licensing/", "platform"),
    ModuleMapping("src/dotmac/platform/partner_management/", "src/dotmac/platform/partner_management/", "platform"),
    ModuleMapping("src/dotmac/platform/platform_admin/", "src/dotmac/platform/platform_admin/", "platform"),
    ModuleMapping("src/dotmac/platform/communications/", "src/dotmac/platform/communications/", "platform"),
    ModuleMapping("src/dotmac/platform/user_management/", "src/dotmac/platform/user_management/", "platform"),
    ModuleMapping("src/dotmac/platform/settings.py", "src/dotmac/platform/settings.py", "platform"),
    ModuleMapping("src/dotmac/platform/main.py", "src/dotmac/platform/main.py", "platform"),

    # ISP - Per-customer deployment modules
    ModuleMapping("src/dotmac/platform/radius/", "src/dotmac/isp/radius/", "isp"),
    ModuleMapping("src/dotmac/platform/network/", "src/dotmac/isp/network/", "isp"),
    ModuleMapping("src/dotmac/platform/fiber/", "src/dotmac/isp/fiber/", "isp"),
    ModuleMapping("src/dotmac/platform/wireless/", "src/dotmac/isp/wireless/", "isp"),
    ModuleMapping("src/dotmac/platform/voltha/", "src/dotmac/isp/voltha/", "isp"),
    ModuleMapping("src/dotmac/platform/genieacs/", "src/dotmac/isp/genieacs/", "isp"),
    ModuleMapping("src/dotmac/platform/field_service/", "src/dotmac/isp/field_service/", "isp"),
    ModuleMapping("src/dotmac/platform/customer_portal/", "src/dotmac/isp/customer_portal/", "isp"),
    ModuleMapping("src/dotmac/platform/subscribers/", "src/dotmac/isp/subscribers/", "isp"),
]

FRONTEND_MAPPINGS: list[ModuleMapping] = [
    # SHARED - Frontend packages
    ModuleMapping("frontend/shared/packages/ui/", "frontend/packages/ui/", "shared"),
    ModuleMapping("frontend/shared/packages/rbac/", "frontend/packages/rbac/", "shared"),
    ModuleMapping("frontend/shared/packages/providers/", "frontend/packages/providers/", "shared"),
    ModuleMapping("frontend/shared/packages/graphql/", "frontend/packages/graphql/", "shared"),
    ModuleMapping("frontend/shared/packages/lib/", "frontend/packages/lib/", "shared"),
    ModuleMapping("frontend/shared/packages/headless/", "frontend/packages/headless/", "shared"),
    ModuleMapping("frontend/shared/packages/primitives/", "frontend/packages/primitives/", "shared"),

    # PLATFORM - Platform admin frontend
    ModuleMapping("frontend/apps/platform-admin-app/", "frontend/apps/platform-admin-app/", "platform"),

    # ISP - ISP operations frontend
    ModuleMapping("frontend/apps/isp-ops-app/", "frontend/apps/isp-ops-app/", "isp"),
]

CONFIG_MAPPINGS: list[ModuleMapping] = [
    # SHARED - Common configs
    ModuleMapping("pyproject.toml", "pyproject.toml", "shared"),  # Will be modified
    ModuleMapping("pytest.ini", "pytest.ini", "shared"),
    ModuleMapping(".ruff.toml", ".ruff.toml", "shared") if (PROJECT_ROOT / ".ruff.toml").exists() else None,

    # PLATFORM
    ModuleMapping("alembic/", "alembic/", "platform"),
    ModuleMapping("alembic.ini", "alembic.ini", "platform"),
    ModuleMapping("docker-compose.base.yml", "docker-compose.yml", "platform"),
    ModuleMapping("Dockerfile", "Dockerfile", "platform"),
    ModuleMapping("Makefile.platform", "Makefile", "platform"),

    # ISP
    ModuleMapping("Makefile.isp", "Makefile", "isp"),
    ModuleMapping("docker-compose.isp.yml", "docker-compose.yml", "isp"),
    ModuleMapping("Dockerfile.freeradius", "Dockerfile.freeradius", "isp"),
]

# Remove None entries
CONFIG_MAPPINGS = [m for m in CONFIG_MAPPINGS if m is not None]


def copy_file_or_dir(src: Path, dst: Path, dry_run: bool = True) -> None:
    """Copy a file or directory."""
    if not src.exists():
        print(f"  ⚠️  Source not found: {src}")
        return

    if dry_run:
        print(f"  📄 Would copy: {src.relative_to(PROJECT_ROOT)} -> {dst.relative_to(STAGING_DIR)}")
        return

    dst.parent.mkdir(parents=True, exist_ok=True)

    if src.is_dir():
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        print(f"  📁 Copied directory: {src.name}")
    else:
        shutil.copy2(src, dst)
        print(f"  📄 Copied file: {src.name}")


def process_mappings(mappings: list[ModuleMapping], dry_run: bool = True) -> None:
    """Process a list of module mappings."""
    for mapping in mappings:
        src = PROJECT_ROOT / mapping.source
        dst = STAGING_DIR / f"dotmac-{mapping.repo}" / mapping.destination
        copy_file_or_dir(src, dst, dry_run)


def create_init_files(repo_dir: Path, dry_run: bool = True) -> None:
    """Create __init__.py files for Python packages."""
    src_dir = repo_dir / "src"
    if not src_dir.exists():
        return

    for dirpath, dirnames, filenames in os.walk(src_dir):
        path = Path(dirpath)
        init_file = path / "__init__.py"

        # Skip if __init__.py already exists
        if init_file.exists():
            continue

        # Only create in directories with Python files or subdirectories
        has_py_files = any(f.endswith('.py') for f in filenames)
        has_subdirs = bool(dirnames)

        if has_py_files or has_subdirs:
            if dry_run:
                print(f"  📝 Would create: {init_file.relative_to(STAGING_DIR)}")
            else:
                init_file.write_text('"""Package initialization."""\n')
                print(f"  📝 Created: __init__.py in {path.name}")


def create_pyproject_toml(repo: str, dry_run: bool = True) -> None:
    """Create a proper pyproject.toml for each repository."""
    repo_dir = STAGING_DIR / f"dotmac-{repo}"
    pyproject_path = repo_dir / "pyproject.toml"

    if repo == "shared":
        content = '''[build-system]
requires = ["poetry-core>=1.0.0"]
build-backend = "poetry.core.masonry.api"

[tool.poetry]
name = "dotmac-shared"
version = "1.0.0"
description = "Shared library for DotMac Platform and ISP applications"
authors = ["DotMac Team <dev@dotmac.io>"]
packages = [{ include = "dotmac", from = "src" }]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.115.0"
pydantic = "^2.9.0"
pydantic-settings = "^2.5.0"
sqlalchemy = { extras = ["asyncio"], version = "^2.0.0" }
asyncpg = "^0.29.0"
redis = "^5.0.0"
python-jose = { extras = ["cryptography"], version = "^3.3.0" }
passlib = { extras = ["bcrypt"], version = "^1.7.4" }
httpx = "^0.27.0"
structlog = "^24.0.0"
authlib = "^1.3.0"
cachetools = "^5.5.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0.0"
pytest-asyncio = "^0.24.0"
ruff = "^0.7.0"
mypy = "^1.11.0"
'''
    elif repo == "platform":
        content = '''[build-system]
requires = ["poetry-core>=1.0.0"]
build-backend = "poetry.core.masonry.api"

[tool.poetry]
name = "dotmac-platform"
version = "1.0.0"
description = "DotMac Platform - Multi-tenant ISP management control plane"
authors = ["DotMac Team <dev@dotmac.io>"]
packages = [{ include = "dotmac", from = "src" }]

[tool.poetry.dependencies]
python = "^3.11"
dotmac-shared = { path = "../dotmac-shared", develop = true }
# Or for production: dotmac-shared = { git = "https://github.com/org/dotmac-shared.git", tag = "v1.0.0" }

fastapi = "^0.115.0"
uvicorn = { extras = ["standard"], version = "^0.30.0" }
celery = { extras = ["redis"], version = "^5.4.0" }
alembic = "^1.13.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0.0"
pytest-asyncio = "^0.24.0"
ruff = "^0.7.0"
'''
    else:  # isp
        content = '''[build-system]
requires = ["poetry-core>=1.0.0"]
build-backend = "poetry.core.masonry.api"

[tool.poetry]
name = "dotmac-isp"
version = "1.0.0"
description = "DotMac ISP - Per-customer ISP operations application"
authors = ["DotMac Team <dev@dotmac.io>"]
packages = [{ include = "dotmac", from = "src" }]

[tool.poetry.dependencies]
python = "^3.11"
dotmac-shared = { path = "../dotmac-shared", develop = true }
# Or for production: dotmac-shared = { git = "https://github.com/org/dotmac-shared.git", tag = "v1.0.0" }

fastapi = "^0.115.0"
uvicorn = { extras = ["standard"], version = "^0.30.0" }
celery = { extras = ["redis"], version = "^5.4.0" }
alembic = "^1.13.0"

# ISP-specific dependencies
pyrad = "^2.4"  # RADIUS protocol

[tool.poetry.group.dev.dependencies]
pytest = "^8.0.0"
pytest-asyncio = "^0.24.0"
ruff = "^0.7.0"
'''

    if dry_run:
        print(f"  📝 Would create: pyproject.toml for {repo}")
    else:
        pyproject_path.write_text(content)
        print(f"  📝 Created: pyproject.toml for {repo}")


def create_readme(repo: str, dry_run: bool = True) -> None:
    """Create README.md for each repository."""
    repo_dir = STAGING_DIR / f"dotmac-{repo}"
    readme_path = repo_dir / "README.md"

    titles = {
        "shared": "DotMac Shared Library",
        "platform": "DotMac Platform (Control Plane)",
        "isp": "DotMac ISP (Operations App)"
    }

    descriptions = {
        "shared": "Common utilities, auth, database, and frontend packages shared between Platform and ISP applications.",
        "platform": "Central management system for multi-tenant ISP deployments. Manages licensing, tenant provisioning, and partner relationships.",
        "isp": "Per-customer deployment handling subscriber management, RADIUS authentication, network operations, and field service."
    }

    content = f"""# {titles[repo]}

{descriptions[repo]}

## Installation

```bash
poetry install
```

## Development

```bash
# Run tests
poetry run pytest

# Type checking
poetry run mypy src/

# Linting
poetry run ruff check src/
```

## License

Proprietary - DotMac
"""

    if dry_run:
        print(f"  📝 Would create: README.md for {repo}")
    else:
        readme_path.write_text(content)
        print(f"  📝 Created: README.md for {repo}")


def main():
    parser = argparse.ArgumentParser(description="Split DotMac monorepo into separate repositories")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without executing")
    parser.add_argument("--execute", action="store_true", help="Execute the split")
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        parser.print_help()
        print("\nPlease specify --dry-run or --execute")
        return

    dry_run = args.dry_run

    print("=" * 60)
    print("DotMac Monorepo Split")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'EXECUTE'}")
    print(f"Staging directory: {STAGING_DIR}")
    print()

    # Create staging directory structure
    if not dry_run:
        for repo in ["shared", "platform", "isp"]:
            repo_dir = STAGING_DIR / f"dotmac-{repo}"
            repo_dir.mkdir(parents=True, exist_ok=True)

    # Process backend modules
    print("\n📦 Backend Modules")
    print("-" * 40)
    process_mappings(BACKEND_MAPPINGS, dry_run)

    # Process frontend modules
    print("\n🎨 Frontend Packages")
    print("-" * 40)
    process_mappings(FRONTEND_MAPPINGS, dry_run)

    # Process config files
    print("\n⚙️  Configuration Files")
    print("-" * 40)
    process_mappings(CONFIG_MAPPINGS, dry_run)

    # Create __init__.py files
    print("\n📝 Package Initialization")
    print("-" * 40)
    for repo in ["shared", "platform", "isp"]:
        repo_dir = STAGING_DIR / f"dotmac-{repo}"
        create_init_files(repo_dir, dry_run)

    # Create pyproject.toml for each repo
    print("\n📋 Project Configuration")
    print("-" * 40)
    for repo in ["shared", "platform", "isp"]:
        create_pyproject_toml(repo, dry_run)
        create_readme(repo, dry_run)

    print("\n" + "=" * 60)
    if dry_run:
        print("DRY RUN COMPLETE - No files were modified")
        print("Run with --execute to perform the actual split")
    else:
        print("SPLIT COMPLETE")
        print(f"\nRepositories created in: {STAGING_DIR}")
        print("\nNext steps:")
        print("1. Review the split repositories")
        print("2. Update imports (dotmac.platform -> dotmac.shared for shared code)")
        print("3. Initialize git repos in each directory")
        print("4. Run tests to verify functionality")
    print("=" * 60)


if __name__ == "__main__":
    main()
