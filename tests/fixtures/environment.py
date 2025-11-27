"""
Shared environment setup and global fixtures for pytest.

This module centralises heavy-weight imports, environment configuration,
and compatibility shims that were previously embedded in ``tests/conftest``.
Splitting the logic keeps fixture modules focused while preserving behaviour.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import patch as _mock_patch

import pytest
from _pytest.mark.expression import Expression

from tests.fixtures.stubs import create_fakeredis_stub, ensure_minio_stub

patch = _mock_patch

# ---------------------------------------------------------------------------
# Optional dependency guards
# ---------------------------------------------------------------------------

# Determine whether the test run targets integration scenarios
_is_integration_test = False
_original_db_url = os.environ.get("DATABASE_URL")
_async_db_url: str | None = None
_sync_db_url: str | None = None
_integration_services_started = False
_migrations_applied = False

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _detect_compose_command() -> list[str] | None:
    legacy = shutil.which("docker-compose")
    if legacy:
        return [legacy]
    docker = shutil.which("docker")
    if docker:
        return [docker, "compose"]
    return None


def _wait_for_database(url: str, timeout: int = 90) -> None:
    if not url or "postgresql" not in url:
        return

    if "asyncpg" in url:
        try:
            from sqlalchemy.engine import make_url

            sync_url = (
                make_url(url).set(drivername="postgresql").render_as_string(hide_password=False)
            )
        except Exception:
            sync_url = url.replace("+asyncpg", "", 1)
    else:
        sync_url = url

    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.exc import OperationalError
    except Exception:
        logger.warning("SQLAlchemy not available; skipping database readiness check")
        return

    engine = create_engine(sync_url, future=True)

    try:
        timeout = int(os.getenv("DOTMAC_DB_READY_TIMEOUT", timeout))
    except Exception:
        timeout = 90

    # Give the container a brief moment to start accepting connections
    time.sleep(2)

    deadline = time.time() + timeout
    try:
        while time.time() < deadline:
            try:
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                    return
            except OperationalError:
                time.sleep(1.5)
            except Exception:
                time.sleep(1.5)
    finally:
        engine.dispose()
    raise pytest.UsageError(
        f"Timed out waiting for PostgreSQL at {sync_url}. Ensure the database is reachable and migrations are applied."
    )


def _ensure_integration_services() -> None:
    global _integration_services_started  # noqa: PLW0603
    if not _is_integration_test or _integration_services_started:
        return

    if not _env_flag("DOTMAC_AUTOSTART_SERVICES", True):
        logger.info(
            "Skipping automatic infrastructure startup (DOTMAC_AUTOSTART_SERVICES disabled)"
        )
        return

    compose_cmd = _detect_compose_command()
    if not compose_cmd:
        raise pytest.UsageError(
            "Integration tests require Docker Compose to provision dependencies. "
            "Install docker (with 'docker compose') or set DOTMAC_AUTOSTART_SERVICES=0 to manage services manually."
        )

    project_root = Path(__file__).resolve().parents[2]
    compose_file = project_root / "docker-compose.base.yml"
    if not compose_file.exists():
        raise pytest.UsageError(
            f"Expected {compose_file} to exist for integration infrastructure. "
            "Ensure the repository includes docker-compose definitions."
        )

    services_env = os.getenv("DOTMAC_INTEGRATION_SERVICES", "postgres redis")
    services = [service for service in services_env.split() if service]
    if not services:
        services = ["postgres", "redis"]

    logger.info(
        "Starting integration services via %s for: %s", " ".join(compose_cmd), ", ".join(services)
    )
    try:
        subprocess.run(
            [*compose_cmd, "-f", str(compose_file), "up", "-d", *services],
            check=True,
            cwd=str(project_root),
        )
    except subprocess.CalledProcessError as exc:
        raise pytest.UsageError(
            "Failed to start integration services with docker compose. "
            "Check Docker daemon status or disable auto-start via DOTMAC_AUTOSTART_SERVICES=0."
        ) from exc

    if _async_db_url:
        try:
            _wait_for_database(_async_db_url)
        except pytest.UsageError:
            raise
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Database readiness check failed: %s", exc)
        else:
            _apply_migrations_if_needed()

    _integration_services_started = True


def _stop_integration_services() -> None:
    global _integration_services_started  # noqa: PLW0603
    if not _integration_services_started:
        return

    if not _env_flag("DOTMAC_SHUTDOWN_SERVICES", False):
        return

    compose_cmd = _detect_compose_command()
    if not compose_cmd:
        logger.warning("Unable to locate docker compose; skipping integration service shutdown")
        return

    project_root = Path(__file__).resolve().parents[2]
    compose_file = project_root / "docker-compose.base.yml"
    if not compose_file.exists():
        return

    logger.info("Stopping integration services via %s", " ".join(compose_cmd))
    try:
        subprocess.run(
            [*compose_cmd, "-f", str(compose_file), "down", "--remove-orphans"],
            check=True,
            cwd=str(project_root),
        )
    except subprocess.CalledProcessError as exc:
        logger.warning("Failed to stop integration services cleanly: %s", exc)
        return

    _integration_services_started = False


def _default_postgres_urls() -> tuple[str, str]:
    host = os.getenv("POSTGRES_HOST", "127.0.0.1")
    port = os.getenv("POSTGRES_PORT", "5432")
    user = os.getenv("POSTGRES_USER", "dotmac_user")
    password = os.getenv("POSTGRES_PASSWORD", "change-me-in-production")
    database = os.getenv("POSTGRES_DB", "dotmac")

    auth_part = f"{user}:{password}@" if password else f"{user}@"
    async_url = f"postgresql+asyncpg://{auth_part}{host}:{port}/{database}"
    sync_url = f"postgresql://{auth_part}{host}:{port}/{database}"
    return async_url, sync_url


def _should_reset_database() -> bool:
    value = os.getenv("DOTMAC_RESET_TEST_DB")
    if value is None:
        return _is_integration_test
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _reset_postgres_schema(sync_url: str) -> None:
    """
    Drop and recreate the public schema to guarantee a clean database for tests.

    Runs only when DOTMAC_RESET_TEST_DB is truthy (default).
    """
    try:
        import sqlalchemy as sa
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Unable to import SQLAlchemy for schema reset: %s", exc)
        return

    engine = sa.create_engine(sync_url, future=True)
    try:
        with engine.begin() as conn:
            conn.execute(sa.text("DROP SCHEMA IF EXISTS public CASCADE"))
            conn.execute(sa.text("CREATE SCHEMA public"))
            conn.execute(sa.text("GRANT ALL ON SCHEMA public TO CURRENT_USER"))
            conn.execute(sa.text("GRANT ALL ON SCHEMA public TO public"))
            conn.execute(sa.text("SET search_path TO public"))
        logger.info("Reset PostgreSQL schema for integration tests")
    except Exception as exc:  # pragma: no cover - diagnostic
        raise pytest.UsageError(
            "Failed to reset PostgreSQL schema prior to integration tests. "
            "Ensure the configured database user has permission to drop/recreate the "
            "public schema, or set DOTMAC_RESET_TEST_DB=0 to skip automatic resets.\n"
            f"Error: {exc}"
        ) from exc
    finally:
        engine.dispose()


def _apply_migrations_if_needed() -> None:
    global _migrations_applied  # noqa: PLW0603
    if _migrations_applied:
        return

    # Allow skipping automatic migrations via environment variable
    if os.getenv("DOTMAC_SKIP_AUTO_MIGRATIONS", "").lower() in {"1", "true", "yes"}:
        logger.info("Skipping automatic migrations (DOTMAC_SKIP_AUTO_MIGRATIONS set)")
        _migrations_applied = True
        return

    sync_url = _sync_db_url
    if not sync_url or "postgresql" not in sync_url:
        return

    project_root = Path(__file__).resolve().parents[2]
    alembic_ini = project_root / "alembic.ini"
    if not alembic_ini.exists():
        logger.warning("Alembic configuration not found at %s; skipping migrations", alembic_ini)
        _migrations_applied = True
        return

    try:
        from alembic.config import Config

        from alembic import command
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Alembic not available; skipping migrations: %s", exc)
        _migrations_applied = True
        return

    cfg = Config(str(alembic_ini))
    cfg.set_main_option("sqlalchemy.url", sync_url)

    if _should_reset_database():
        _reset_postgres_schema(sync_url)

    try:
        # Suppress alembic output to avoid cluttering test output
        import io
        from contextlib import redirect_stderr, redirect_stdout

        stdout_buffer = io.StringIO()
        stderr_buffer = io.StringIO()

        with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
            command.upgrade(cfg, "head")

    except Exception as exc:
        # If migrations fail, it might be because they're already applied
        # Try to check current state
        try:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                command.current(cfg)
            # If current() succeeds, database is accessible and likely already migrated
            logger.info("Database migrations may already be applied, continuing with tests")
        except Exception:
            # Real failure - can't connect or invalid state
            raise pytest.UsageError(
                "Failed to apply database migrations for integration tests. "
                "Ensure alembic is installed and the database is reachable.\n"
                f"Error: {exc}"
            ) from exc

    _migrations_applied = True


def _configure_database_env(is_integration: bool) -> None:
    """
    Configure database URLs up-front so fixtures can rely on consistent values.

    Integration suites prefer psycopg while unit suites default to in-memory SQLite.
    """

    global _async_db_url, _sync_db_url, _is_integration_test  # noqa: PLW0603

    _is_integration_test = is_integration

    if is_integration:
        explicit_async = os.environ.get("DOTMAC_DATABASE_URL_ASYNC") or None
        if explicit_async and "postgresql" not in explicit_async.lower():
            explicit_async = None
        explicit_sync = os.environ.get("DOTMAC_DATABASE_URL") or None
        if explicit_sync and "postgresql" not in explicit_sync.lower():
            explicit_sync = None

        async_url = explicit_async
        sync_url = explicit_sync

        autostart_enabled = _env_flag("DOTMAC_AUTOSTART_SERVICES", True)

        if async_url and "postgresql" not in async_url:
            if autostart_enabled:
                async_url = None
                explicit_async = None
            else:
                raise pytest.UsageError(
                    "Integration tests require PostgreSQL. "
                    "Set DOTMAC_DATABASE_URL_ASYNC to a Postgres DSN (e.g. postgresql+asyncpg://...)."
                )

        if async_url is None and _original_db_url:
            async_url, derived_sync = _derive_database_urls(_original_db_url)
            sync_url = sync_url or derived_sync

        if async_url is None:
            if autostart_enabled:
                async_url, default_sync = _default_postgres_urls()
                sync_url = sync_url or default_sync
            else:
                raise pytest.UsageError(
                    "Integration tests require a PostgreSQL database. "
                    "Provide DOTMAC_DATABASE_URL_ASYNC with your Postgres DSN or enable auto-start by setting DOTMAC_AUTOSTART_SERVICES=1."
                )

        if "postgresql" not in async_url:
            raise pytest.UsageError(
                "Integration tests require PostgreSQL. "
                "Set DOTMAC_DATABASE_URL_ASYNC to a Postgres DSN (e.g. postgresql+asyncpg://...)."
            )

        if sync_url is None or "postgresql" not in sync_url:
            _, sync_url = _derive_database_urls(async_url)

        _async_db_url = async_url
        _sync_db_url = sync_url
        os.environ["DOTMAC_DATABASE_URL_ASYNC"] = async_url
        os.environ["DOTMAC_DATABASE_URL"] = sync_url

        try:
            _ensure_integration_services()
        except pytest.UsageError as exc:
            should_fallback = autostart_enabled and not explicit_async and not explicit_sync
            if not should_fallback:
                raise

            logger.warning(
                "Failed to auto-start integration services (%s); falling back to in-memory SQLite. "
                "Set DOTMAC_AUTOSTART_SERVICES=0 or provide explicit Postgres URLs to skip this fallback.",
                exc,
            )
            sqlite_async = "sqlite+aiosqlite:///:memory:"
            sqlite_sync = "sqlite:///:memory:"
            _async_db_url = sqlite_async
            _sync_db_url = sqlite_sync
            os.environ["DOTMAC_DATABASE_URL_ASYNC"] = sqlite_async
            os.environ["DOTMAC_DATABASE_URL"] = sqlite_sync
            os.environ["DOTMAC_AUTOSTART_SERVICES"] = "0"
            _is_integration_test = False
    else:
        sqlite_async = "sqlite+aiosqlite:///:memory:"
        sqlite_sync = "sqlite:///:memory:"
        os.environ.setdefault("DOTMAC_DATABASE_URL_ASYNC", sqlite_async)
        os.environ.setdefault("DOTMAC_DATABASE_URL", sqlite_sync)
        os.environ["DATABASE_URL"] = os.environ["DOTMAC_DATABASE_URL"]
        _async_db_url = os.environ["DOTMAC_DATABASE_URL_ASYNC"]
        _sync_db_url = os.environ["DOTMAC_DATABASE_URL"]


def _derive_database_urls(source_url: str) -> tuple[str, str]:
    """
    Derive async and sync SQLAlchemy URLs from the provided runtime DATABASE_URL.

    Uses SQLAlchemy's URL helper when available to avoid string slicing bugs
    and falls back to a minimal parser otherwise.
    """
    try:
        from sqlalchemy.engine import make_url

        url = make_url(source_url)
        driver = url.drivername

        if driver.startswith("postgresql+asyncpg"):
            async_url = url.set(drivername="postgresql+psycopg").render_as_string(
                hide_password=False
            )
            sync_url = url.set(drivername="postgresql").render_as_string(hide_password=False)
        elif driver.startswith("postgresql+psycopg"):
            async_url = url.render_as_string(hide_password=False)
            sync_url = url.set(drivername="postgresql").render_as_string(hide_password=False)
        elif driver.startswith("postgresql"):
            async_url = url.set(drivername="postgresql+psycopg").render_as_string(
                hide_password=False
            )
            sync_url = url.render_as_string(hide_password=False)
        else:
            async_url = url.render_as_string(hide_password=False)
            sync_url = async_url

        return async_url, sync_url
    except Exception:
        # Conservative fallback when SQLAlchemy is unavailable: best-effort replacements.
        if source_url.startswith("postgresql+asyncpg://"):
            async_url = source_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
            sync_url = source_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        elif source_url.startswith("postgresql://"):
            async_url = source_url.replace("postgresql://", "postgresql+psycopg://", 1)
            sync_url = source_url
        else:
            async_url = source_url
            sync_url = source_url
        return async_url, sync_url


# Only configure database if not already set (allows .env to take precedence)
# This runs at module import time, before pytest hooks
if not os.environ.get("DOTMAC_DATABASE_URL_ASYNC"):
    _configure_database_env(False)

try:
    import dotmac.platform.settings as _settings_module
except ImportError:
    _settings_module = None
else:
    _settings_module.reset_settings()
    _settings_module.settings = _settings_module.get_settings()

# ---------------------------------------------------------------------------
# Optional dependency imports with graceful fallbacks
# ---------------------------------------------------------------------------

ensure_minio_stub()

try:
    import fakeredis as _fakeredis

    fakeredis = _fakeredis
    HAS_FAKEREDIS = True
except Exception:  # pragma: no cover - fallback for environments without fakeredis
    fakeredis = create_fakeredis_stub()
    HAS_FAKEREDIS = False


class _MarkerNamespace(dict[str, bool]):
    """Mapping that defaults unknown markers to False when evaluating expressions."""

    def __missing__(self, key: str) -> bool:
        return False


def _should_run_integration(config: pytest.Config) -> bool:
    """
    Determine whether the current pytest invocation targets integration tests.

    Prefers the ``-m`` marker expression but allows overriding via the
    ``DOTMAC_TEST_PROFILE`` environment variable for CI pipelines.
    """
    env_flag = os.getenv("DOTMAC_TEST_PROFILE", "").strip().lower()
    if env_flag in {"integration", "integration_tests", "integration-test"}:
        print(f"[DEBUG] _should_run_integration: True (env_flag={env_flag})")  # noqa: T201
        return True

    mark_expr = getattr(config.option, "markexpr", "") or ""
    print(f"[DEBUG] _should_run_integration: mark_expr={mark_expr!r}")  # noqa: T201
    if mark_expr:
        try:
            expression = Expression(mark_expr)
            if expression.evaluate(_MarkerNamespace(integration=True)) and not expression.evaluate(
                _MarkerNamespace(integration=False)
            ):
                print("[DEBUG] _should_run_integration: True (expression match)")  # noqa: T201
                return True
        except Exception:
            pass

        normalized = mark_expr.lower()
        if "not integration" in normalized.replace("(", " ").replace(")", " "):
            print("[DEBUG] _should_run_integration: False ('not integration' in mark_expr)")  # noqa: T201
            return False
        if "integration" in normalized.replace("(", " ").replace(")", " ").split():
            print("[DEBUG] _should_run_integration: True ('integration' word in mark_expr)")  # noqa: T201
            return True
        if "integration" in normalized:
            print(f"[DEBUG] _should_run_integration: True ('integration' substring in mark_expr={mark_expr})")  # noqa: T201
            return True

    invocation_args = getattr(getattr(config, "invocation_params", None), "args", None) or []
    explicit_args = getattr(config, "args", []) or []
    print(f"[DEBUG] _should_run_integration: invocation_args={invocation_args}, explicit_args={explicit_args}")  # noqa: T201
    for arg in (*invocation_args, *explicit_args):
        arg_str = str(arg)
        if arg_str.startswith("-"):
            continue
        # Only match explicit integration test directories, not files with "integration" in name
        if "tests/integration/" in arg_str or arg_str.endswith("tests/integration"):
            print(f"[DEBUG] _should_run_integration: True (tests/integration/ in arg={arg_str})")  # noqa: T201
            return True
        if "tests/integrations/" in arg_str or arg_str.endswith("tests/integrations"):
            print(f"[DEBUG] _should_run_integration: True (tests/integrations/ in arg={arg_str})")  # noqa: T201
            return True

    env_async_url = os.getenv("DOTMAC_DATABASE_URL_ASYNC", "").strip()
    if env_async_url and "postgresql" in env_async_url.lower():
        print("[DEBUG] _should_run_integration: True (postgresql in DOTMAC_DATABASE_URL_ASYNC)")  # noqa: T201
        return True

    print("[DEBUG] _should_run_integration: False (no integration indicators found)")  # noqa: T201
    return False


try:
    import freezegun  # noqa: F401

    HAS_FREEZEGUN = True
except ImportError:
    HAS_FREEZEGUN = False

try:
    from fastapi import FastAPI  # noqa: F401
    from fastapi.testclient import TestClient  # noqa: F401

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

try:
    from sqlalchemy import create_engine, event, text  # noqa: F401
    from sqlalchemy.engine import make_url  # noqa: F401
    from sqlalchemy.exc import OperationalError  # noqa: F401
    from sqlalchemy.ext.asyncio import (  # noqa: F401
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )
    from sqlalchemy.orm import Session, sessionmaker  # noqa: F401
    from sqlalchemy.pool import StaticPool  # noqa: F401

    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False

try:
    import importlib.util

    spec = importlib.util.find_spec("dotmac.platform.db")
    HAS_DATABASE_BASE = spec is not None
except (ImportError, ValueError):
    HAS_DATABASE_BASE = False

# ---------------------------------------------------------------------------
# Model import helper
# ---------------------------------------------------------------------------


def _import_base_and_models():
    """Import SQLAlchemy ``Base`` and register all ORM models."""
    from dotmac.platform.db import Base

    def _safe_import(path: str) -> None:
        try:
            __import__(path)
        except ImportError:
            pass

    model_modules = [
        "dotmac.platform.contacts.models",
        "dotmac.platform.genieacs.models",
        "dotmac.platform.customer_management.models",
        "dotmac.platform.data_transfer.db_models",
        "dotmac.platform.communications.models",
        "dotmac.platform.partner_management.models",
        "dotmac.platform.billing.models",
        "dotmac.platform.billing.bank_accounts.entities",
        "dotmac.platform.billing.core.entities",
        "dotmac.platform.tenant.models",
        "dotmac.platform.audit.models",
        "dotmac.platform.user_management.models",
        "dotmac.platform.ticketing.models",
        "dotmac.platform.services.lifecycle.models",
        "dotmac.platform.subscribers.models",
        "dotmac.platform.network.models",
        "dotmac.platform.radius.models",
        "dotmac.platform.fault_management.models",
        "dotmac.platform.notifications.models",
        "dotmac.platform.deployment.models",
        "dotmac.platform.sales.models",
        "dotmac.platform.wireless.models",
        "dotmac.platform.webhooks.models",
    ]

    for module_path in model_modules:
        _safe_import(module_path)

    return Base


# ---------------------------------------------------------------------------
# Shared fixtures and environment hooks
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def configure_test_database():
    """Ensure DOTMAC database URLs are aligned with the selected test mode."""
    if _is_integration_test and _async_db_url:
        os.environ["DOTMAC_DATABASE_URL_ASYNC"] = _async_db_url
        os.environ["DOTMAC_DATABASE_URL"] = _sync_db_url or _async_db_url
        _ensure_integration_services()
    try:
        yield
    finally:
        if _is_integration_test:
            _stop_integration_services()


# Use in-memory rate limiting and disable Redis requirements during tests
os.environ.setdefault("RATE_LIMIT__STORAGE_URL", "memory://")
os.environ.setdefault("REQUIRE_REDIS_SESSIONS", "false")
os.environ.setdefault("RATE_LIMIT__ENABLED", "false")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")  # Disable OpenTelemetry exporters

# Add src to path for imports
_SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
if str(_SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(_SRC_ROOT))


@pytest.fixture(autouse=True)
def test_environment():
    """Set baseline environment variables for every test."""
    original_env = os.environ.copy()

    os.environ["ENVIRONMENT"] = "test"
    os.environ["DOTMAC_ENV"] = "test"
    os.environ["TESTING"] = "true"
    os.environ.setdefault("DOTMAC_DATABASE_URL", "sqlite:///:memory:")
    os.environ.setdefault("DOTMAC_DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")
    os.environ["DATABASE_URL"] = os.environ["DOTMAC_DATABASE_URL"]

    try:
        yield
    finally:
        os.environ.clear()
        os.environ.update(original_env)


def pytest_configure(config):
    """Register global markers and surface DB URLs for other fixtures."""
    config.addinivalue_line("markers", "unit: Unit test")
    config.addinivalue_line("markers", "integration: Integration test")
    config.addinivalue_line("markers", "asyncio: Async test")
    config.addinivalue_line("markers", "slow: Slow test")

    _configure_database_env(_should_run_integration(config))

    db_url_async = (
        _async_db_url
        or os.environ.get("DOTMAC_DATABASE_URL_ASYNC")
        or "sqlite+aiosqlite:///:memory:"
    )
    db_url_sync = _sync_db_url or os.environ.get("DOTMAC_DATABASE_URL") or "sqlite:///:memory:"

    config.db_url_async = db_url_async
    config.db_url_sync = db_url_sync


@pytest.fixture(scope="session", autouse=True)
def patch_main_app_startup() -> None:
    """
    Prevent the production FastAPI app from touching external services during tests.

    Many test modules import ``dotmac.platform.main.app`` directly, which would
    otherwise trigger costly startup routines (Redis, migrations, Vault, etc.)
    when the TestClient/AsyncClient enters the lifespan context. We replace those
    initialisers with a lightweight lifespan stub so tests can exercise routes
    without needing real infrastructure.
    """
    try:
        import dotmac.platform.main as main_module
    except ImportError:
        return

    mp = pytest.MonkeyPatch()

    @asynccontextmanager
    async def _noop_lifespan(app):
        yield

    try:
        mp.setattr(main_module, "lifespan", _noop_lifespan, raising=False)
        yield
    finally:
        mp.undo()


__all__ = [
    "HAS_DATABASE_BASE",
    "HAS_FASTAPI",
    "HAS_FAKEREDIS",
    "HAS_FREEZEGUN",
    "HAS_SQLALCHEMY",
    "_async_db_url",
    "_import_base_and_models",
    "_is_integration_test",
    "_original_db_url",
    "_sync_db_url",
    "patch",
    "patch_main_app_startup",
    "configure_test_database",
    "fakeredis",
    "test_environment",
]
