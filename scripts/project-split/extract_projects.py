#!/usr/bin/env python3
"""
Project Extraction Script

Extracts dotmac-ftth-ops into two separate projects:
1. dotmac-control-plane - Platform management
2. dotmac-isp-app - ISP operations

Usage:
    python extract_projects.py --project control-plane
    python extract_projects.py --project isp-app
    python extract_projects.py --project both
    python extract_projects.py --dry-run --project both
    python extract_projects.py --project both --backend-only
    python extract_projects.py --project isp-app --source-dir /path/to/monolith --target-dir /tmp/out
"""

import argparse
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

# ============================================================================
# CONFIGURATION
# ============================================================================

SOURCE_DIR = Path.home() / "Downloads/Projects/dotmac-ftth-ops"
PLATFORM_SERVICES_DIR = Path.home() / "Downloads/Projects/dotmac-platform-services"
TARGET_DIR = Path.home() / "Downloads/Projects"

@dataclass
class ProjectConfig:
    name: str
    description: str
    backend_modules: list[str]
    frontend_apps: list[str]
    test_dirs: list[str]
    service_mode: str
    import_prefix: str
    env_vars: dict[str, str] = field(default_factory=dict)


@dataclass
class ExtractionOptions:
    """Toggles for which parts of the extraction to run."""

    copy_backend: bool = True
    copy_frontend: bool = True
    copy_tests: bool = True
    generate_configs: bool = True
    rewrite_imports: bool = True


CONTROL_PLANE_CONFIG = ProjectConfig(
    name="dotmac-control-plane",
    description="Platform management for ISP deployments, licensing, and billing",
    backend_modules=[
        "platform_admin",
        "partner_management",
        "deployment",
    ],
    frontend_apps=[
        "platform-admin-app",
        "platform-tenant",
        "platform-reseller",
    ],
    test_dirs=[
        "platform_admin",
        "partner_management",
        "deployment",
    ],
    service_mode="control_plane",
    import_prefix="control_plane",
    env_vars={
        "SERVICE_MODE": "control_plane",
        "TENANT_MANAGEMENT_ENABLED": "true",
        "PLATFORM_BILLING_ENABLED": "true",
        "LICENSE_ISSUER_ENABLED": "true",
        "LICENSE_ENFORCER_ENABLED": "false",
    },
)

ISP_APP_CONFIG = ProjectConfig(
    name="dotmac-isp-app",
    description="ISP operations - subscriber management, billing, network ops",
    backend_modules=[
        # Core ISP
        "subscribers",
        "billing",
        "radius",
        "services",
        "network",
        "ip_management",
        # Infrastructure
        "access",
        "fiber",
        "wireless",
        # OSS
        "genieacs",
        "voltha",
        "netbox",
        "ansible",
        "wireguard",
        # Operations
        "field_service",
        "fault_management",
        "project_management",
        "crm",
        "sales",
        "customer_portal",
        "customer_management",
        # Supporting
        "metrics",
        "realtime",
        "orchestration",
        "network_monitoring",
        "geo",
        "push",
        "ai",
        "timeseries",
    ],
    frontend_apps=[
        "isp-ops-app",
        "isp-customer",
        "isp-reseller",
    ],
    test_dirs=[
        "subscribers",
        "billing",
        "radius",
        "services",
        "network",
        "ip_management",
        "access",
        "fiber",
        "wireless",
        "genieacs",
        "voltha",
        "netbox",
        "ansible",
        "wireguard",
        "field_service",
        "fault_management",
        "project_management",
        "crm",
        "sales",
        "customer_portal",
        "customer_management",
        "metrics",
        "realtime",
        "orchestration",
        "network_monitoring",
        "geo",
    ],
    service_mode="isp_instance",
    import_prefix="isp_app",
    env_vars={
        "SERVICE_MODE": "isp_instance",
        "TENANT_MANAGEMENT_ENABLED": "false",
        "PLATFORM_BILLING_ENABLED": "false",
        "LICENSE_ISSUER_ENABLED": "false",
        "LICENSE_ENFORCER_ENABLED": "true",
    },
)

SHARED_PACKAGES = [
    "analytics",
    "design-system",
    "eslint-config",
    "eslint-plugin",
    "features",
    "graphql",
    "headless",
    "hooks",
    "http-client",
    "notifications",
    "primitives",
    "providers",
    "rbac",
    "testing",
    "testing-utils",
    "types",
    "typescript-config",
    "ui",
    "utils",
]


# ============================================================================
# IMPORT REWRITING
# ============================================================================

def build_import_rewrites(config: ProjectConfig) -> list[tuple[str, str]]:
    """Build list of (old_import, new_import) tuples."""
    rewrites = []
    for module in config.backend_modules:
        old = f"dotmac.platform.{module}"
        new = f"{config.import_prefix}.{module}"
        rewrites.append((old, new))
    return rewrites


def rewrite_imports_in_file(file_path: Path, rewrites: list[tuple[str, str]], dry_run: bool = False) -> bool:
    """Rewrite imports in a Python file. Returns True if changes were made."""
    try:
        content = file_path.read_text()
    except Exception as e:
        print(f"  Warning: Could not read {file_path}: {e}")
        return False

    original = content
    for old_import, new_import in rewrites:
        # Handle various import patterns
        patterns = [
            (rf"\bfrom {re.escape(old_import)}\b", f"from {new_import}"),
            (rf"\bimport {re.escape(old_import)}\b", f"import {new_import}"),
            (rf'"{re.escape(old_import)}"', f'"{new_import}"'),
            (rf"'{re.escape(old_import)}'", f"'{new_import}'"),
        ]
        for pattern, replacement in patterns:
            content = re.sub(pattern, replacement, content)

    if content != original:
        if not dry_run:
            file_path.write_text(content)
        return True
    return False


def rewrite_imports_in_directory(directory: Path, rewrites: list[tuple[str, str]], dry_run: bool = False) -> int:
    """Rewrite imports in all Python files in directory. Returns count of modified files."""
    modified = 0
    if not directory.exists():
        return modified
    for py_file in directory.rglob("*.py"):
        if "__pycache__" in str(py_file):
            continue
        if "alembic/versions" in str(py_file):
            # Avoid mangling historical migrations; handle manually if needed
            continue
        if rewrite_imports_in_file(py_file, rewrites, dry_run):
            print(f"  {'Would modify' if dry_run else 'Modified'}: {py_file.relative_to(directory)}")
            modified += 1
    return modified


# ============================================================================
# PROJECT CREATION
# ============================================================================

def create_project_skeleton(target: Path, config: ProjectConfig, dry_run: bool = False):
    """Create the basic project structure."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Creating project skeleton: {target}")

    dirs = [
        "src" / Path(config.import_prefix),
        "tests",
        "alembic/versions",
        "frontend/apps",
        "frontend/shared/packages",
        "scripts",
        "docs",
    ]

    for d in dirs:
        full_path = target / d
        if not dry_run:
            full_path.mkdir(parents=True, exist_ok=True)
        print(f"  {'Would create' if dry_run else 'Created'}: {d}")


def copy_backend_modules(source: Path, target: Path, config: ProjectConfig, dry_run: bool = False):
    """Copy backend modules from source to target."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Copying backend modules...")

    src_platform = source / "src/dotmac/platform"
    dst_src = target / "src" / config.import_prefix

    for module in config.backend_modules:
        src_module = src_platform / module
        dst_module = dst_src / module

        if src_module.exists():
            if not dry_run:
                if dst_module.exists():
                    shutil.rmtree(dst_module)
                shutil.copytree(src_module, dst_module, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            print(f"  {'Would copy' if dry_run else 'Copied'}: {module}/")
        else:
            print(f"  Warning: Module not found: {module}")


def copy_frontend_apps(source: Path, target: Path, config: ProjectConfig, dry_run: bool = False):
    """Copy frontend apps from source to target."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Copying frontend apps...")

    src_apps = source / "frontend/apps"
    dst_apps = target / "frontend/apps"

    for app in config.frontend_apps:
        src_app = src_apps / app
        dst_app = dst_apps / app

        if src_app.exists():
            if not dry_run:
                if dst_app.exists():
                    shutil.rmtree(dst_app)
                shutil.copytree(
                    src_app,
                    dst_app,
                    ignore=shutil.ignore_patterns("node_modules", ".next", "dist", ".turbo")
                )
            print(f"  {'Would copy' if dry_run else 'Copied'}: {app}/")
        else:
            print(f"  Warning: App not found: {app}")


def copy_shared_packages(source: Path, target: Path, dry_run: bool = False):
    """Copy shared frontend packages."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Copying shared packages...")

    src_packages = source / "frontend/shared/packages"
    dst_packages = target / "frontend/shared/packages"

    for package in SHARED_PACKAGES:
        src_pkg = src_packages / package
        dst_pkg = dst_packages / package

        if src_pkg.exists():
            if not dry_run:
                if dst_pkg.exists():
                    shutil.rmtree(dst_pkg)
                shutil.copytree(
                    src_pkg,
                    dst_pkg,
                    ignore=shutil.ignore_patterns("node_modules", "dist", ".turbo")
                )
            print(f"  {'Would copy' if dry_run else 'Copied'}: {package}/")
        else:
            print(f"  Warning: Package not found: {package}")


def copy_tests(source: Path, target: Path, config: ProjectConfig, dry_run: bool = False):
    """Copy test directories."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Copying tests...")

    src_tests = source / "tests"
    dst_tests = target / "tests"

    # Copy common test infrastructure
    common_dirs = ["fixtures", "helpers", "conftest.py"]
    for item in common_dirs:
        src_item = src_tests / item
        dst_item = dst_tests / item
        if src_item.exists():
            if not dry_run:
                if src_item.is_dir():
                    if dst_item.exists():
                        shutil.rmtree(dst_item)
                    shutil.copytree(src_item, dst_item, ignore=shutil.ignore_patterns("__pycache__"))
                else:
                    shutil.copy2(src_item, dst_item)
            print(f"  {'Would copy' if dry_run else 'Copied'}: {item}")

    # Copy module-specific tests
    for test_dir in config.test_dirs:
        src_test = src_tests / test_dir
        dst_test = dst_tests / test_dir

        if src_test.exists():
            if not dry_run:
                if dst_test.exists():
                    shutil.rmtree(dst_test)
                shutil.copytree(src_test, dst_test, ignore=shutil.ignore_patterns("__pycache__"))
            print(f"  {'Would copy' if dry_run else 'Copied'}: {test_dir}/")
        else:
            print(f"  Warning: Test dir not found: {test_dir}")


# ============================================================================
# CONFIG FILES GENERATION
# ============================================================================

def generate_pyproject_toml(
    target: Path,
    config: ProjectConfig,
    platform_services_dir: Path,
    dry_run: bool = False,
):
    """Generate pyproject.toml for the new project."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating pyproject.toml...")

    rel_platform_services = Path(os.path.relpath(platform_services_dir, target)).as_posix()

    content = f'''[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "{config.name}"
version = "0.1.0"
description = "{config.description}"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    # Platform services foundation
    "dotmac-platform-services @ file://{rel_platform_services}",

    # Core
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",

    # Database
    "sqlalchemy>=2.0.0",
    "asyncpg>=0.29.0",
    "alembic>=1.13.0",

    # Redis
    "redis>=5.0.0",

    # Auth
    "pyjwt>=2.8.0",
    "passlib[bcrypt]>=1.7.4",

    # HTTP
    "httpx>=0.26.0",

    # Utils
    "structlog>=24.1.0",
    "python-multipart>=0.0.6",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "pytest-cov>=4.1.0",
    "ruff>=0.1.0",
    "mypy>=1.7.0",
]

[tool.hatch.build.targets.wheel]
packages = ["src/{config.import_prefix}"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
ignore = ["E501"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
python_files = "test_*.py"
python_functions = "test_*"

[tool.mypy]
python_version = "3.11"
strict = true
'''

    if not dry_run:
        (target / "pyproject.toml").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: pyproject.toml")


def generate_app_py(target: Path, config: ProjectConfig, dry_run: bool = False):
    """Generate main FastAPI application file."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating app.py...")

    if config.service_mode == "control_plane":
        content = '''"""
Control Plane Application

Platform management for ISP deployments, licensing, and billing.
"""

import os
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotmac.platform.config import ServiceMode
from control_plane.settings import settings

logger = structlog.get_logger(__name__)

# Validate service mode at startup
assert os.getenv("SERVICE_MODE") == "control_plane", \\
    "This application must run with SERVICE_MODE=control_plane"


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="DotMac Control Plane",
        description="Platform management for ISP deployments",
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers from platform-services
    from dotmac.platform.auth.router import auth_router
    from dotmac.platform.tenant.router import tenant_router
    from dotmac.platform.billing.router import billing_router
    from dotmac.platform.licensing.router import licensing_router
    from dotmac.platform.user_management.router import user_router
    from dotmac.platform.config.router import health_router

    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(tenant_router, prefix="/api/v1")
    app.include_router(billing_router, prefix="/api/v1")
    app.include_router(licensing_router, prefix="/api/v1")
    app.include_router(user_router, prefix="/api/v1")

    # Register control-plane specific routers
    from control_plane.platform_admin.router import router as platform_admin_router
    from control_plane.partner_management.router import router as partner_router
    from control_plane.deployment.router import router as deployment_router

    app.include_router(platform_admin_router, prefix="/api/v1")
    app.include_router(partner_router, prefix="/api/v1")
    app.include_router(deployment_router, prefix="/api/v1")

    logger.info("control_plane_app_created", service_mode="control_plane")

    return app


app = create_app()
'''
    else:  # isp_instance
        content = '''"""
ISP Operations Application

ISP operations - subscriber management, billing, network ops.
"""

import os
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from isp_app.settings import settings
from isp_app.licensing.enforcement import LicenseEnforcer

logger = structlog.get_logger(__name__)

# Validate service mode at startup
assert os.getenv("SERVICE_MODE") == "isp_instance", \\
    "This application must run with SERVICE_MODE=isp_instance"

assert os.getenv("TENANT_ID"), \\
    "TENANT_ID environment variable is required for ISP instances"


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="DotMac ISP Operations",
        description="ISP operations - subscriber management, billing, network ops",
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers from platform-services (subset)
    from dotmac.platform.auth.router import auth_router
    from dotmac.platform.user_management.router import user_router
    from dotmac.platform.config.router import health_router

    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(user_router, prefix="/api/v1")

    # Register ISP-specific routers
    from isp_app.subscribers.router import router as subscribers_router
    from isp_app.billing.router import router as billing_router
    from isp_app.radius.router import router as radius_router
    from isp_app.services.router import router as services_router
    from isp_app.network.router import router as network_router
    from isp_app.access.router import router as access_router

    app.include_router(subscribers_router, prefix="/api/v1")
    app.include_router(billing_router, prefix="/api/v1")
    app.include_router(radius_router, prefix="/api/v1")
    app.include_router(services_router, prefix="/api/v1")
    app.include_router(network_router, prefix="/api/v1")
    app.include_router(access_router, prefix="/api/v1")

    # Add more ISP routers as needed...

    logger.info(
        "isp_app_created",
        service_mode="isp_instance",
        tenant_id=settings.tenant_id,
    )

    return app


app = create_app()
'''

    src_dir = target / "src" / config.import_prefix
    if not dry_run:
        src_dir.mkdir(parents=True, exist_ok=True)
        (src_dir / "app.py").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: src/{config.import_prefix}/app.py")


def generate_settings_py(target: Path, config: ProjectConfig, dry_run: bool = False):
    """Generate settings file."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating settings.py...")

    extra_fields = ""
    if config.service_mode == "isp_instance":
        extra_fields = '''
    # ISP Instance specific
    tenant_id: str = ""
    control_plane_url: str = "http://localhost:8000"
    instance_api_key: str = ""
    license_signing_key: str = ""
'''

    content = f'''"""
Settings for {config.name}
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings."""

    # Environment
    environment: str = "development"
    debug: bool = False

    # Service mode
    service_mode: str = "{config.service_mode}"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/{config.name.replace('-', '_')}"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]
{extra_fields}
    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
'''

    src_dir = target / "src" / config.import_prefix
    if not dry_run:
        src_dir.mkdir(parents=True, exist_ok=True)
        (src_dir / "settings.py").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: src/{config.import_prefix}/settings.py")


def generate_init_py(target: Path, config: ProjectConfig, dry_run: bool = False):
    """Generate __init__.py files."""
    src_dir = target / "src" / config.import_prefix

    content = f'''"""
{config.description}
"""

__version__ = "0.1.0"
'''

    if not dry_run:
        src_dir.mkdir(parents=True, exist_ok=True)
        (src_dir / "__init__.py").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: src/{config.import_prefix}/__init__.py")


def generate_dockerfile(
    target: Path,
    config: ProjectConfig,
    platform_services_dir: Path,
    dry_run: bool = False,
):
    """Generate Dockerfile."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating Dockerfile...")

    rel_platform_services = Path(os.path.relpath(platform_services_dir, target)).as_posix()

    content = f'''# {config.name} Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy platform-services (expected as sibling folder or submodule)
ARG PLATFORM_SERVICES_PATH={rel_platform_services}
COPY ${{PLATFORM_SERVICES_PATH}} /platform-services

# Copy project files
COPY pyproject.toml .
COPY src/ src/

# Install dependencies
RUN pip install --no-cache-dir -e /platform-services
RUN pip install --no-cache-dir -e .

# Validate service mode at build time
ENV SERVICE_MODE={config.service_mode}
RUN python -c "import os; assert os.getenv('SERVICE_MODE') == '{config.service_mode}'"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Run
EXPOSE 8000
CMD ["uvicorn", "{config.import_prefix}.app:app", "--host", "0.0.0.0", "--port", "8000"]
'''

    if not dry_run:
        (target / "Dockerfile").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: Dockerfile")


def generate_docker_compose(target: Path, config: ProjectConfig, dry_run: bool = False):
    """Generate docker-compose.yml."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating docker-compose.yml...")

    env_vars = "\n      ".join(f"- {k}={v}" for k, v in config.env_vars.items())

    content = f'''version: "3.8"

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      {env_vars}
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/{config.name.replace('-', '_')}
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    volumes:
      - ./src:/app/src:ro

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB={config.name.replace('-', '_')}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
'''

    if not dry_run:
        (target / "docker-compose.yml").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: docker-compose.yml")


def generate_env_example(
    target: Path,
    config: ProjectConfig,
    platform_services_dir: Path,
    dry_run: bool = False,
):
    """Generate .env.example file."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating .env.example...")

    rel_platform_services = Path(os.path.relpath(platform_services_dir, target)).as_posix()

    extra_vars = ""
    if config.service_mode == "isp_instance":
        extra_vars = '''
# ISP Instance
TENANT_ID=
CONTROL_PLANE_URL=http://localhost:8000
INSTANCE_API_KEY=
LICENSE_SIGNING_KEY=
PLATFORM_API_KEY=
'''
    else:
        extra_vars = '''
# Control Plane
PLATFORM_API_KEY=
LICENSE_SIGNING_KEY=
VAULT_ADDR=http://localhost:8200
VAULT_ROLE=isp-instance
VAULT_PATH=tenant/{tenant_id}/db_creds
'''

    content = f'''# {config.name} Environment Configuration

# Environment
ENVIRONMENT=development
DEBUG=true

# Service Mode (DO NOT CHANGE)
SERVICE_MODE={config.service_mode}

# Platform Services path (relative)
PLATFORM_SERVICES_PATH={rel_platform_services}

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/{config.name.replace('-', '_')}

# Redis
REDIS_URL=redis://localhost:6379/0

# Auth
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
{extra_vars}
'''

    if not dry_run:
        (target / ".env.example").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: .env.example")


def generate_alembic_config(target: Path, config: ProjectConfig, dry_run: bool = False):
    """Generate alembic configuration."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating alembic config...")

    alembic_ini = f'''[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

sqlalchemy.url = driver://user:pass@localhost/dbname

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
'''

    env_py = f'''"""Alembic environment configuration."""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from {config.import_prefix}.settings import settings

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url.replace("+asyncpg", ""))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import models for autogenerate
# from {config.import_prefix}.models import Base
# target_metadata = Base.metadata
target_metadata = None


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={{"paramstyle": "named"}},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {{}}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
'''

    if not dry_run:
        (target / "alembic.ini").write_text(alembic_ini)
        alembic_dir = target / "alembic"
        alembic_dir.mkdir(exist_ok=True)
        (alembic_dir / "env.py").write_text(env_py)
        (alembic_dir / "versions").mkdir(exist_ok=True)
        (alembic_dir / "versions" / ".gitkeep").touch()

    print(f"  {'Would create' if dry_run else 'Created'}: alembic.ini")
    print(f"  {'Would create' if dry_run else 'Created'}: alembic/env.py")


def generate_readme(target: Path, config: ProjectConfig, dry_run: bool = False):
    """Generate README.md."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating README.md...")

    content = f'''# {config.name}

{config.description}

## Service Mode

This application runs in `{config.service_mode}` mode.

## Quick Start

```bash
# Install dependencies
pip install -e .

# Copy env file
cp .env.example .env

# Run migrations
alembic upgrade head

# Start the server
uvicorn {config.import_prefix}.app:app --reload
```

## Docker

```bash
docker-compose up -d
```

## Environment Variables

See `.env.example` for all available configuration options.

## Project Structure

```
{config.name}/
├── src/{config.import_prefix}/
│   ├── app.py           # FastAPI application
│   ├── settings.py      # Configuration
│   └── ...              # Domain modules
├── tests/
├── alembic/             # Database migrations
├── frontend/
│   ├── apps/            # Frontend applications
│   └── shared/          # Shared packages
└── docker-compose.yml
```

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
'''

    if not dry_run:
        (target / "README.md").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: README.md")


def generate_pnpm_workspace(target: Path, config: ProjectConfig, dry_run: bool = False):
    """Generate pnpm workspace configuration."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Generating pnpm workspace...")

    pnpm_workspace = '''packages:
  - "frontend/apps/*"
  - "frontend/shared/packages/*"
'''

    root_package = f'''{{
  "name": "{config.name}",
  "private": true,
  "scripts": {{
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test"
  }},
  "devDependencies": {{
    "turbo": "^2.0.0"
  }},
  "packageManager": "pnpm@9.0.0"
}}
'''

    if not dry_run:
        (target / "pnpm-workspace.yaml").write_text(pnpm_workspace)
        (target / "package.json").write_text(root_package)

    print(f"  {'Would create' if dry_run else 'Created'}: pnpm-workspace.yaml")
    print(f"  {'Would create' if dry_run else 'Created'}: package.json")


def generate_gitignore(target: Path, dry_run: bool = False):
    """Generate .gitignore."""
    content = '''# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
.venv/
venv/
ENV/
.eggs/
*.egg-info/
*.egg

# IDE
.idea/
.vscode/
*.swp
*.swo

# Testing
.coverage
htmlcov/
.pytest_cache/
.mypy_cache/

# Build
dist/
build/

# Environment
.env
.env.local
*.local

# Node
node_modules/
.next/
.turbo/
dist/

# OS
.DS_Store
Thumbs.db
'''

    if not dry_run:
        (target / ".gitignore").write_text(content)
    print(f"  {'Would create' if dry_run else 'Created'}: .gitignore")


# ============================================================================
# MAIN EXTRACTION FUNCTION
# ============================================================================

def extract_project(
    config: ProjectConfig,
    source_dir: Path,
    target_root: Path,
    platform_services_dir: Path,
    opts: ExtractionOptions,
    dry_run: bool = False,
):
    """Extract a complete project."""
    target = target_root / config.name

    print(f"\n{'='*60}")
    print(f"{'[DRY RUN] ' if dry_run else ''}Extracting: {config.name}")
    print(f"{'='*60}")

    if target.exists() and not dry_run:
        response = input(f"\n{target} already exists. Delete and recreate? [y/N]: ")
        if response.lower() != 'y':
            print("Skipping...")
            return
        shutil.rmtree(target)

    # Create skeleton
    create_project_skeleton(target, config, dry_run)

    # Copy modules
    if opts.copy_backend:
        copy_backend_modules(source_dir, target, config, dry_run)
    if opts.copy_frontend:
        copy_frontend_apps(source_dir, target, config, dry_run)
        copy_shared_packages(source_dir, target, dry_run)
    if opts.copy_tests:
        copy_tests(source_dir, target, config, dry_run)

    # Generate config files
    if opts.generate_configs:
        generate_init_py(target, config, dry_run)
        generate_pyproject_toml(target, config, platform_services_dir, dry_run)
        generate_app_py(target, config, dry_run)
        generate_settings_py(target, config, dry_run)
        generate_dockerfile(target, config, platform_services_dir, dry_run)
        generate_docker_compose(target, config, dry_run)
        generate_env_example(target, config, platform_services_dir, dry_run)
        generate_alembic_config(target, config, dry_run)
        generate_readme(target, config, dry_run)
        if opts.copy_frontend:
            generate_pnpm_workspace(target, config, dry_run)
        generate_gitignore(target, dry_run)

    # Rewrite imports
    if not dry_run and opts.rewrite_imports:
        print(f"\n{'[DRY RUN] ' if dry_run else ''}Rewriting imports...")
        rewrites = build_import_rewrites(config)
        src_dir = target / "src"
        modified = rewrite_imports_in_directory(src_dir, rewrites, dry_run)
        print(f"  Modified {modified} files")

        tests_dir = target / "tests"
        modified = rewrite_imports_in_directory(tests_dir, rewrites, dry_run)
        print(f"  Modified {modified} test files")

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Done! Project created at: {target}")


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Extract projects from dotmac-ftth-ops")
    parser.add_argument(
        "--project",
        choices=["control-plane", "isp-app", "both"],
        required=True,
        help="Which project to extract",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=SOURCE_DIR,
        help=f"Path to source monolith (default: {SOURCE_DIR})",
    )
    parser.add_argument(
        "--platform-services-dir",
        type=Path,
        default=PLATFORM_SERVICES_DIR,
        help=f"Path to dotmac-platform-services repo (default: {PLATFORM_SERVICES_DIR})",
    )
    parser.add_argument(
        "--target-dir",
        type=Path,
        default=TARGET_DIR,
        help=f"Path to place extracted projects (default: {TARGET_DIR})",
    )
    parser.add_argument(
        "--backend-only",
        action="store_true",
        help="Only copy backend code/configs (skip frontend/shared packages)",
    )
    parser.add_argument(
        "--frontend-only",
        action="store_true",
        help="Only copy frontend/shared packages (skip backend)",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip copying tests",
    )
    parser.add_argument(
        "--skip-configs",
        action="store_true",
        help="Skip generating config files (pyproject, Dockerfile, etc.)",
    )
    parser.add_argument(
        "--skip-rewrite",
        action="store_true",
        help="Skip import rewriting step",
    )

    args = parser.parse_args()

    if args.backend_only and args.frontend_only:
        parser.error("Cannot combine --backend-only and --frontend-only.")

    opts = ExtractionOptions(
        copy_backend=not args.frontend_only,
        copy_frontend=not args.backend_only,
        copy_tests=not args.skip_tests,
        generate_configs=not args.skip_configs,
        rewrite_imports=not args.skip_rewrite,
    )

    if not args.source_dir.exists():
        parser.error(f"Source directory does not exist: {args.source_dir}")
    if not args.platform_services_dir.exists():
        print(f"Warning: platform-services path not found: {args.platform_services_dir}")

    if args.project in ["control-plane", "both"]:
        extract_project(
            CONTROL_PLANE_CONFIG,
            args.source_dir,
            args.target_dir,
            args.platform_services_dir,
            opts,
            args.dry_run,
        )

    if args.project in ["isp-app", "both"]:
        extract_project(
            ISP_APP_CONFIG,
            args.source_dir,
            args.target_dir,
            args.platform_services_dir,
            opts,
            args.dry_run,
        )

    print("\n" + "="*60)
    print("Extraction complete!")
    print("="*60)
    print("\nNext steps:")
    print("1. cd into each project directory")
    print("2. Review and fix any remaining import issues")
    print("3. Run: pip install -e .")
    print("4. Run: alembic upgrade head")
    print("5. Run: pytest to verify tests pass")
    print("6. Run: pnpm install && pnpm build for frontend")


if __name__ == "__main__":
    main()
