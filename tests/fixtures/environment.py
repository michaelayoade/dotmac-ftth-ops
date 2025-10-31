"""
Shared environment setup and global fixtures for pytest.

This module centralises heavy-weight imports, environment configuration,
and compatibility shims that were previously embedded in ``tests/conftest``.
Splitting the logic keeps fixture modules focused while preserving behaviour.
"""

from __future__ import annotations

import builtins
import os
import sys
import types
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest

# ---------------------------------------------------------------------------
# Optional dependency guards
# ---------------------------------------------------------------------------

# Make unittest.mock.patch globally available for legacy tests that rely on it
if not hasattr(builtins, "patch"):
    builtins.patch = patch

# Determine whether the test run targets integration scenarios
_is_integration_test = any("integration" in arg for arg in sys.argv)
_original_db_url = os.environ.get("DATABASE_URL")
_async_db_url: str | None = None
_sync_db_url: str | None = None


def _configure_database_env() -> None:
    """
    Configure database URLs up-front so fixtures can rely on consistent values.

    Integration suites prefer psycopg while unit suites default to in-memory SQLite.
    """

    global _async_db_url, _sync_db_url  # noqa: PLW0603

    if _is_integration_test and _original_db_url:
        if _original_db_url.startswith("postgresql://"):
            _async_db_url = _original_db_url.replace("postgresql://", "postgresql+psycopg://", 1)
            _sync_db_url = _original_db_url
        elif _original_db_url.startswith("postgresql+asyncpg://"):
            _async_db_url = _original_db_url.replace(
                "postgresql+asyncpg://",
                "postgresql+psycopg://",
                1,
            )
            _sync_db_url = _original_db_url.replace(
                "postgresql+asyncpg://",
                "postgresql://",
                1,
            )
        else:
            _async_db_url = _original_db_url
            _sync_db_url = _original_db_url

        os.environ["DOTMAC_DATABASE_URL_ASYNC"] = _async_db_url
        os.environ["DOTMAC_DATABASE_URL"] = _sync_db_url
    else:
        os.environ.setdefault("DOTMAC_DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")
        os.environ.setdefault("DOTMAC_DATABASE_URL", "sqlite:///:memory:")
        os.environ.pop("DATABASE_URL", None)


_configure_database_env()

# ---------------------------------------------------------------------------
# MinIO stub to keep object storage imports optional
# ---------------------------------------------------------------------------

if "minio" not in sys.modules:
    minio_module = types.ModuleType("minio")

    class _DummyMinioClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401, ANN001
            pass

        def bucket_exists(self, bucket: str) -> bool:  # noqa: D401, ANN001
            return True

        def make_bucket(self, bucket: str) -> None:  # noqa: D401, ANN001
            return None

        def put_object(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401, ANN001
            return None

        def get_object(self, *args: Any, **kwargs: Any):  # noqa: ANN001
            class _DummyResponse:
                def read(self) -> bytes:
                    return b""

                def close(self) -> None:
                    return None

                def release_conn(self) -> None:
                    return None

            return _DummyResponse()

        def remove_object(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401, ANN001
            return None

        def copy_object(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401, ANN001
            return None

    minio_module.Minio = _DummyMinioClient

    error_module = types.ModuleType("minio.error")

    class S3Error(Exception):
        """Minimal S3Error stub used in unit tests."""

    error_module.S3Error = S3Error

    commonconfig_module = types.ModuleType("minio.commonconfig")

    class CopySource:
        """Lightweight stand-in for MinIO CopySource."""

        def __init__(self, bucket: str, object_name: str) -> None:
            self.bucket = bucket
            self.object_name = object_name

    commonconfig_module.CopySource = CopySource

    sys.modules["minio"] = minio_module
    sys.modules["minio.error"] = error_module
    sys.modules["minio.commonconfig"] = commonconfig_module

    minio_module.error = error_module
    minio_module.commonconfig = commonconfig_module

# ---------------------------------------------------------------------------
# Optional dependency imports with graceful fallbacks
# ---------------------------------------------------------------------------

try:
    import fakeredis as _fakeredis

    fakeredis = _fakeredis
    HAS_FAKEREDIS = True
except Exception:  # pragma: no cover - fallback for environments without fakeredis
    from types import SimpleNamespace

    class _DummySyncRedis:
        def __init__(self, *_, **__):
            self._data: dict[str, str] = {}

        # minimal subset used in tests/fixtures
        def flushdb(self) -> None:
            self._data.clear()

        def set(self, key, value, ex=None):  # noqa: ANN001, ARG002
            self._data[str(key)] = value
            return True

        def get(self, key):  # noqa: ANN001
            return self._data.get(str(key))

        def delete(self, key):  # noqa: ANN001
            return 1 if self._data.pop(str(key), None) is not None else 0

        def close(self) -> None:
            return None

    class _DummyAsyncRedis:
        def __init__(self, *_, **__):
            self._data: dict[str, str] = {}

        async def flushdb(self) -> None:
            self._data.clear()

        async def set(self, key, value, ex=None):  # noqa: ANN001, ARG002
            self._data[str(key)] = value
            return True

        async def get(self, key):  # noqa: ANN001
            return self._data.get(str(key))

        async def delete(self, key):  # noqa: ANN001
            return 1 if self._data.pop(str(key), None) is not None else 0

        async def close(self) -> None:
            return None

    fakeredis = SimpleNamespace(
        FakeRedis=_DummySyncRedis,
        aioredis=SimpleNamespace(FakeRedis=_DummyAsyncRedis),
    )
    HAS_FAKEREDIS = False

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
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: F401
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
        "dotmac.platform.radius.models",
        "dotmac.platform.fault_management.models",
        "dotmac.platform.notifications.models",
        "dotmac.platform.deployment.models",
        "dotmac.platform.sales.models",
        "dotmac.platform.wireless.models",
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
    if _is_integration_test and _original_db_url:
        assert _async_db_url is not None  # narrow type for mypy
        os.environ["DOTMAC_DATABASE_URL_ASYNC"] = _async_db_url
        os.environ["DOTMAC_DATABASE_URL"] = _sync_db_url or _original_db_url
    yield


# Use in-memory rate limiting and disable Redis requirements during tests
os.environ.setdefault("RATE_LIMIT__STORAGE_URL", "memory://")
os.environ.setdefault("REQUIRE_REDIS_SESSIONS", "false")
os.environ.setdefault("RATE_LIMIT__ENABLED", "false")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")  # Disable OpenTelemetry exporters

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


@pytest.fixture(autouse=True)
def test_environment():
    """Set baseline environment variables for every test."""
    original_env = os.environ.copy()

    os.environ["ENVIRONMENT"] = "test"
    os.environ["DOTMAC_ENV"] = "test"
    os.environ["TESTING"] = "true"
    os.environ.setdefault("DOTMAC_DATABASE_URL", "sqlite:///:memory:")
    os.environ.setdefault("DOTMAC_DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")

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

    if _is_integration_test and _original_db_url:
        db_url_sync = _sync_db_url or _original_db_url
        db_url_async = _async_db_url or _original_db_url
    else:
        db_url_async = "sqlite+aiosqlite:///:memory:"
        db_url_sync = "sqlite:///:memory:"

    config.db_url_async = db_url_async
    config.db_url_sync = db_url_sync


@pytest.fixture(scope="session", autouse=True)
def patch_main_app_startup() -> None:
    """
    Prevent the production FastAPI app from touching external services during tests.

    Many test modules import ``dotmac.platform.main.app`` directly, which would
    otherwise trigger costly startup routines (Redis, migrations, Vault, etc.)
    when the TestClient/AsyncClient enters the lifespan context. We replace those
    initialisers with lightweight stubs so tests can exercise routes without
    needing real infrastructure.
    """
    try:
        import dotmac.platform.main as main_module
    except ImportError:
        return

    mp = pytest.MonkeyPatch()

    mp.setattr(main_module, "init_db", lambda: None, raising=False)
    mp.setattr(main_module, "init_timescaledb", lambda: None, raising=False)
    mp.setattr(main_module, "load_secrets_from_vault_sync", lambda: None, raising=False)

    mp.setattr(main_module, "init_redis", AsyncMock(return_value=None), raising=False)
    mp.setattr(main_module, "shutdown_redis", AsyncMock(return_value=None), raising=False)
    mp.setattr(main_module, "run_startup_health_checks", AsyncMock(return_value=None), raising=False)
    mp.setattr(main_module, "ensure_default_admin_user", AsyncMock(return_value=None), raising=False)
    mp.setattr(main_module, "ensure_isp_rbac", AsyncMock(return_value=None), raising=False)
    mp.setattr(main_module, "ensure_billing_rbac", AsyncMock(return_value=None), raising=False)

    class _DummyAsyncSessionCtx:
        async def __aenter__(self) -> AsyncMock:
            return AsyncMock()

        async def __aexit__(self, exc_type, exc, tb) -> bool:  # noqa: D401, ANN001
            return False

    mp.setattr(main_module, "AsyncSessionLocal", lambda: _DummyAsyncSessionCtx(), raising=False)

    try:
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
    "patch_main_app_startup",
    "configure_test_database",
    "fakeredis",
    "test_environment",
]
