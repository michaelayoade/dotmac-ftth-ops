"""
Global pytest configuration and fixtures for DotMac Platform Services tests.
Minimal version with graceful handling of missing dependencies.
"""

import asyncio
import os
import sys

# ---------------------------------------------------------------------------
# MinIO stub (provides minimal interface for tests without real dependency)
# ---------------------------------------------------------------------------
import types
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio




os.environ.setdefault("TENANT_MODE", "single")

if "minio" not in sys.modules:
    minio_module = types.ModuleType("minio")

    class _DummyMinioClient:
        def __init__(self, *args, **kwargs):  # noqa: D401, ANN001
            pass

        def bucket_exists(self, bucket):  # noqa: D401, ANN001
            return True

        def make_bucket(self, bucket):  # noqa: D401, ANN001
            return None

        def put_object(self, *args, **kwargs):  # noqa: D401, ANN001
            return None

        def get_object(self, *args, **kwargs):  # noqa: D401, ANN001
            class _DummyResponse:
                def read(self):
                    return b""

                def close(self):
                    return None

                def release_conn(self):
                    return None

            return _DummyResponse()

        def remove_object(self, *args, **kwargs):  # noqa: D401, ANN001
            return None

        def copy_object(self, *args, **kwargs):  # noqa: D401, ANN001
            return None

    minio_module.Minio = _DummyMinioClient

    error_module = types.ModuleType("minio.error")

    class S3Error(Exception):
        """Minimal S3Error stub used in unit tests."""

    error_module.S3Error = S3Error

    commonconfig_module = types.ModuleType("minio.commonconfig")

    class CopySource:
        """Lightweight stand-in for MinIO CopySource."""

        def __init__(self, bucket: str, object_name: str):
            self.bucket = bucket
            self.object_name = object_name

    commonconfig_module.CopySource = CopySource

    sys.modules["minio"] = minio_module
    sys.modules["minio.error"] = error_module
    sys.modules["minio.commonconfig"] = commonconfig_module

    minio_module.error = error_module
    minio_module.commonconfig = commonconfig_module

# Configure SQLite for all tests by default (unless explicitly overridden)
# This prevents database authentication errors when PostgreSQL is not running
# Override with: DOTMAC_DATABASE_URL_ASYNC=postgresql://... pytest
#
# IMPORTANT: We unset DATABASE_URL to prevent the Settings class from using
# the PostgreSQL connection from .env file. The test fixtures will use
# DOTMAC_DATABASE_URL_ASYNC which defaults to SQLite in async_db_engine fixture.
if "DATABASE_URL" in os.environ and "DOTMAC_DATABASE_URL_ASYNC" not in os.environ:
    # User has DATABASE_URL set but not test override - remove it for tests
    del os.environ["DATABASE_URL"]
# Use in-memory SQLite databases to avoid file locking issues
# Each test gets a fresh database via function-scoped fixtures
if "DOTMAC_DATABASE_URL_ASYNC" not in os.environ:
    os.environ["DOTMAC_DATABASE_URL_ASYNC"] = "sqlite+aiosqlite:///:memory:"
if "DOTMAC_DATABASE_URL" not in os.environ:
    os.environ["DOTMAC_DATABASE_URL"] = "sqlite:///:memory:"
# Use in-memory rate limiting and disable Redis requirements during tests
os.environ.setdefault("RATE_LIMIT__STORAGE_URL", "memory://")
os.environ.setdefault("REQUIRE_REDIS_SESSIONS", "false")
os.environ.setdefault("RATE_LIMIT__ENABLED", "false")

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Import shared fixtures and telemetry fixtures
# IMPORTANT: shared_fixtures imports models which trigger event bus initialization
# This causes pytest collection to hang. Import them conditionally in individual test files instead.
# from tests.conftest_telemetry import *  # noqa: F401,F403
# from tests.shared_fixtures import *  # noqa: F401,F403
# from tests.test_utils import *  # noqa: F401,F403

# Optional dependency imports with fallbacks
# Optional fakeredis import with graceful fallback when unavailable
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
        def flushdb(self):
            self._data.clear()

        def set(self, key, value, ex=None):  # noqa: ARG002
            self._data[str(key)] = value
            return True

        def get(self, key):
            return self._data.get(str(key))

        def delete(self, key):
            return 1 if self._data.pop(str(key), None) is not None else 0

        def close(self):
            return None

    class _DummyAsyncRedis:
        def __init__(self, *_, **__):
            self._data: dict[str, str] = {}

        async def flushdb(self):
            self._data.clear()

        async def set(self, key, value, ex=None):  # noqa: ARG002
            self._data[str(key)] = value
            return True

        async def get(self, key):
            return self._data.get(str(key))

        async def delete(self, key):
            return 1 if self._data.pop(str(key), None) is not None else 0

        async def close(self):
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
    from fastapi.testclient import TestClient

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

try:
    from sqlalchemy import create_engine
    from sqlalchemy.engine import make_url
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.orm import Session, sessionmaker  # noqa: F401
    from sqlalchemy.pool import StaticPool

    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False

# Graceful imports from dotmac platform
try:
    from dotmac.platform.auth.core import JWTService  # noqa: F401

    HAS_JWT_SERVICE = True
except ImportError:
    HAS_JWT_SERVICE = False

# Check if Base is available, but DON'T import it at module level
# This prevents triggering event bus initialization and other side effects during pytest collection
try:
    import importlib.util

    spec = importlib.util.find_spec("dotmac.platform.db")
    HAS_DATABASE_BASE = spec is not None
except (ImportError, ValueError):
    HAS_DATABASE_BASE = False

# Pre-import all models to prevent SQLAlchemy relationship resolution errors
# This must happen BEFORE any test code runs that instantiates entities
# The _import_base_and_models() function is called from fixtures, but tests
# using mocks don't call those fixtures, so we need to import here too
if HAS_DATABASE_BASE:
    try:
        # Import essential models that have cross-dependencies
        from dotmac.platform.customer_management.models import Customer  # noqa: F401
        from dotmac.platform.radius.models import RadCheck  # noqa: F401
        from dotmac.platform.subscribers.models import Subscriber  # noqa: F401
        from dotmac.platform.tenant.models import Tenant  # noqa: F401
    except ImportError:
        pass  # Models not available, tests will handle gracefully


def _import_base_and_models():
    """Import Base and all models.

    IMPORTANT: This function should ONLY be called from inside fixtures,
    never at module level. Importing models at module level triggers
    event bus initialization and causes pytest collection to hang.
    """
    from dotmac.platform.db import Base

    # Import all models to ensure they're registered with Base.metadata
    # This is required for Base.metadata.create_all() to work properly
    try:
        from dotmac.platform.contacts import models as contact_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.customer_management import models as customer_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.partner_management import models as partner_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.billing import models as billing_models  # noqa: F401
        from dotmac.platform.billing.bank_accounts import entities as bank_entities  # noqa: F401
        from dotmac.platform.billing.core import entities as billing_entities  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.tenant import models as tenant_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.audit import models as audit_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.user_management import models as user_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.ticketing import models as ticketing_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.services.lifecycle import models as lifecycle_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.subscribers import models as subscriber_models  # noqa: F401
    except ImportError:
        pass

    try:
        # Import directly from .models since __init__.py doesn't export models
        from dotmac.platform.radius.models import (  # noqa: F401
            NAS,
            RadAcct,
            RadCheck,
            RadiusBandwidthProfile,
            RadPostAuth,
            RadReply,
        )
    except ImportError:
        pass

    try:
        from dotmac.platform.fault_management import models as fault_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.notifications import models as notification_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.deployment import models as deployment_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.sales import models as sales_models  # noqa: F401
    except ImportError:
        pass

    try:
        from dotmac.platform.wireless import models as wireless_models  # noqa: F401
    except ImportError:
        pass

    return Base


# Basic fixtures that don't require external dependencies
@pytest.fixture
def mock_session():
    """Mock database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def mock_sync_session():
    """Mock synchronous database session."""
    session = Mock()
    session.commit = Mock()
    session.rollback = Mock()
    session.close = Mock()
    return session


@pytest.fixture
def mock_provider():
    """Mock provider for testing."""
    provider = AsyncMock()
    return provider


@pytest.fixture
def mock_config():
    """Mock configuration."""
    config = Mock()
    config.environment = "test"
    config.debug = True
    return config


@pytest.fixture
def mock_api_key_service():
    """Mock API key service."""
    service = AsyncMock()
    service.create_api_key = AsyncMock()
    service.validate_api_key = AsyncMock()
    service.revoke_api_key = AsyncMock()
    return service


@pytest.fixture
def mock_secrets_manager():
    """Mock secrets manager."""
    manager = AsyncMock()
    manager.get_jwt_keypair = AsyncMock()
    manager.get_symmetric_secret = AsyncMock()
    manager.get_database_credentials = AsyncMock()
    return manager


# Conditional fixtures that require external dependencies
if HAS_FAKEREDIS:

    @pytest.fixture
    def redis_client():
        """Redis client using fakeredis."""
        client = fakeredis.FakeRedis(decode_responses=True)
        client.flushall()
        yield client
        client.flushall()

else:

    @pytest.fixture
    def redis_client():
        """Mock Redis client when fakeredis not available."""
        return Mock()


if HAS_SQLALCHEMY:

    @pytest.fixture
    def db_engine():
        """Test database engine.

        IMPORTANT: Function-scoped to avoid hanging during pytest collection.
        Session-scoped fixtures cause Base.metadata.create_all() to block
        indefinitely when loading all ~20+ model modules at import time.
        """
        db_url = os.environ.get("DOTMAC_DATABASE_URL", "sqlite:///:memory:")
        connect_args: dict[str, object] = {}

        try:
            url = make_url(db_url)
        except Exception:
            url = None

        if url is not None and url.get_backend_name() == "sqlite":
            connect_args["check_same_thread"] = False
            database = url.database
            if database and database != ":memory":
                candidate = Path(database)
                if not candidate.is_absolute():
                    candidate = Path.cwd() / candidate
                candidate.parent.mkdir(parents=True, exist_ok=True)

        engine = create_engine(db_url, connect_args=connect_args)

        if HAS_DATABASE_BASE:
            # Import Base and models inside fixture to avoid hanging during collection
            Base = _import_base_and_models()
            try:
                Base.metadata.create_all(engine, checkfirst=True)
            except Exception as e:
                # Ignore "already exists" errors
                if "already exists" not in str(e):
                    raise

        yield engine
        if HAS_DATABASE_BASE:
            # Base is already imported from above
            from dotmac.platform.db import Base

            Base.metadata.drop_all(engine)
        engine.dispose()

    @pytest.fixture
    def db_session(db_engine):
        """Test database session."""
        SessionLocal = sessionmaker(bind=db_engine, autoflush=False, autocommit=False)
        session = SessionLocal()
        try:
            yield session
        finally:
            try:
                session.rollback()
            except Exception:
                pass
            session.close()

    try:
        import pytest_asyncio

        @pytest_asyncio.fixture
        async def async_db_engine(request):
            """Async database engine for tests.

            Each pytest-xdist worker gets its own isolated database to prevent conflicts.
            """
            db_url = os.environ.get("DOTMAC_DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")

            # For pytest-xdist: use worker ID to create separate databases per worker
            worker_id = getattr(request.config, "workerinput", {}).get("workerid", "master")
            if worker_id != "master" and db_url.startswith("sqlite"):
                # Use separate file-based SQLite DB for each worker
                db_url = f"sqlite+aiosqlite:///test_db_{worker_id}.db"

            connect_args: dict[str, object] = {}

            try:
                url = make_url(db_url)
            except Exception:
                url = None

            # SQLite-specific configuration
            is_sqlite = url is not None and url.get_backend_name().startswith("sqlite")
            if is_sqlite:
                connect_args["check_same_thread"] = False
                database = url.database
                if database and database != ":memory":
                    candidate = Path(database)
                    if not candidate.is_absolute():
                        candidate = Path.cwd() / candidate
                    candidate.parent.mkdir(parents=True, exist_ok=True)

            # Create engine with SQLite-specific pooling for in-memory databases
            if is_sqlite:
                engine = create_async_engine(
                    db_url,
                    connect_args=connect_args,
                    poolclass=StaticPool,  # Required for SQLite in-memory async
                    pool_pre_ping=True,
                )
            else:
                engine = create_async_engine(
                    db_url,
                    connect_args=connect_args,
                    pool_size=20,  # Increase pool size for tests
                    max_overflow=30,  # Allow overflow connections
                    pool_pre_ping=True,  # Verify connections before use
                    pool_recycle=3600,  # Recycle connections every hour
                )
            if HAS_DATABASE_BASE:
                # Import Base and models inside fixture to avoid hanging during collection
                Base = _import_base_and_models()
                async with engine.begin() as conn:
                    # For SQLite with StaticPool, indexes may persist across tests
                    # Use checkfirst for tables, wrap in try/except for index conflicts
                    try:
                        try:
                            await conn.run_sync(Base.metadata.drop_all)
                        except OperationalError as exc:
                            if "does not exist" not in str(exc).lower():
                                raise
                    except OperationalError:
                        pass
                    try:
                        await conn.run_sync(Base.metadata.create_all)
                    except OperationalError as exc:
                        if "already exists" not in str(exc).lower():
                            raise

            # Ensure application code uses the test engine/session maker
            try:
                from dotmac.platform import db as db_module

                db_module._async_engine = engine
                db_module.AsyncSessionLocal = async_sessionmaker(  # type: ignore[attr-defined]
                    autocommit=False,
                    autoflush=False,
                    bind=engine,
                    class_=AsyncSession,
                    expire_on_commit=False,
                )
                db_module._async_session_maker = db_module.AsyncSessionLocal
            except Exception:  # pragma: no cover - defensive guard if module layout changes
                pass

            try:
                yield engine
            finally:
                if HAS_DATABASE_BASE:
                    from dotmac.platform.db import Base

                    async with engine.begin() as conn:
                        try:
                            await conn.run_sync(Base.metadata.drop_all)
                        except OperationalError as exc:
                            if "does not exist" not in str(exc).lower():
                                raise
                # Force close all connections to prevent event loop issues across tests
                await engine.dispose(close=True)
                # Give asyncio a chance to clean up pending tasks
                await asyncio.sleep(0)

    except ImportError:
        # Fallback to regular pytest fixture
        @pytest_asyncio.fixture
        async def async_db_engine(request):
            """Async database engine for tests.

            Each pytest-xdist worker gets its own isolated database to prevent conflicts.
            """
            db_url = os.environ.get("DOTMAC_DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")

            # For pytest-xdist: use worker ID to create separate databases per worker
            worker_id = getattr(request.config, "workerinput", {}).get("workerid", "master")
            if worker_id != "master" and db_url.startswith("sqlite"):
                # Use separate file-based SQLite DB for each worker
                db_url = f"sqlite+aiosqlite:///test_db_{worker_id}.db"

            connect_args: dict[str, object] = {}

            try:
                url = make_url(db_url)
            except Exception:
                url = None

            # SQLite-specific configuration
            is_sqlite = url is not None and url.get_backend_name().startswith("sqlite")
            if is_sqlite:
                connect_args["check_same_thread"] = False
                database = url.database
                if database and database != ":memory":
                    candidate = Path(database)
                    if not candidate.is_absolute():
                        candidate = Path.cwd() / candidate
                    candidate.parent.mkdir(parents=True, exist_ok=True)

            # Create engine with SQLite-specific pooling for in-memory databases
            if is_sqlite:
                engine = create_async_engine(
                    db_url,
                    connect_args=connect_args,
                    poolclass=StaticPool,  # Required for SQLite in-memory async
                    pool_pre_ping=True,
                )
            else:
                engine = create_async_engine(
                    db_url,
                    connect_args=connect_args,
                    pool_size=20,  # Increase pool size for tests
                    max_overflow=30,  # Allow overflow connections
                    pool_pre_ping=True,  # Verify connections before use
                    pool_recycle=3600,  # Recycle connections every hour
                )
            if HAS_DATABASE_BASE:
                # Import Base and models inside fixture to avoid hanging during collection
                Base = _import_base_and_models()
                async with engine.begin() as conn:
                    try:
                        await conn.run_sync(Base.metadata.drop_all)
                    except OperationalError:
                        pass
                    try:
                        await conn.run_sync(Base.metadata.create_all)
                    except OperationalError as exc:
                        if "already exists" not in str(exc).lower():
                            raise

            try:
                yield engine
            finally:
                if HAS_DATABASE_BASE:
                    from dotmac.platform.db import Base

                    async with engine.begin() as conn:
                        await conn.run_sync(Base.metadata.drop_all)
                # Force close all connections to prevent event loop issues across tests
                await engine.dispose(close=True)
                # Give asyncio a chance to clean up pending tasks
                await asyncio.sleep(0)

    try:
        import pytest_asyncio

        @pytest_asyncio.fixture
        async def async_db_session(async_db_engine):
            """Async database session."""
            SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
            async with SessionMaker() as session:
                try:
                    yield session
                finally:
                    try:
                        await session.rollback()
                    except Exception:
                        pass
                    # Ensure session is properly closed
                    await session.close()
                    # Give asyncio a chance to clean up
                    await asyncio.sleep(0)

    except ImportError:
        # Fallback to regular pytest fixture
        @pytest_asyncio.fixture
        async def async_db_session(async_db_engine):
            """Async database session."""
            SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
            async with SessionMaker() as session:
                try:
                    yield session
                finally:
                    try:
                        await session.rollback()
                    except Exception:
                        pass
                    # Ensure session is properly closed
                    await session.close()
                    # Give asyncio a chance to clean up
                    await asyncio.sleep(0)

else:

    @pytest.fixture
    def db_engine():
        """Mock database engine."""
        return Mock()

    @pytest.fixture
    def db_session():
        """Mock database session."""
        return Mock()


if HAS_FASTAPI:

    @pytest.fixture
    def test_app(async_db_engine):
        """Test FastAPI application with routers and auth configured.

        This fixture provides a complete test app with:
        - All routers registered
        - Auth system configured with test user
        - Proper dependency overrides for testing
        - Tenant middleware for multi-tenant support
        - Database session override to prevent event loop issues

        Can be used by ALL router tests across all modules.
        """

        from fastapi import FastAPI

        app = FastAPI(title="Test App")

        # Add tenant middleware for multi-tenant support
        try:
            from dotmac.platform.tenant import TenantConfiguration, TenantMiddleware, TenantMode

            tenant_config = TenantConfiguration(
                mode=TenantMode.MULTI,
                require_tenant_header=True,
                tenant_header_name="X-Tenant-ID",
            )
            app.add_middleware(TenantMiddleware, config=tenant_config)
        except ImportError:
            pass

        # Setup auth override for testing
        # Override get_current_user to return test user
        try:
            from fastapi import Request

            from dotmac.platform.auth.core import JWTService, TokenType, UserInfo, jwt_service
            from dotmac.platform.auth.dependencies import (
                get_current_user,
                get_current_user_optional,
            )

            # Use the same JWT service as the production code to ensure tokens are compatible
            test_jwt_service = jwt_service

            async def _resolve_user_from_request(request: Request) -> UserInfo | None:
                token = None
                auth_header = request.headers.get("Authorization")
                if auth_header and auth_header.lower().startswith("bearer "):
                    token = auth_header.split(" ", 1)[1].strip()
                if not token:
                    token = request.cookies.get("access_token")
                if not token:
                    return None
                try:
                    claims = test_jwt_service.verify_token(token, expected_type=TokenType.ACCESS)
                    return UserInfo(
                        user_id=claims.get("sub", ""),
                        email=claims.get("email"),
                        username=claims.get("username"),
                        roles=claims.get("roles", []),
                        permissions=claims.get("permissions", []),
                        tenant_id=claims.get("tenant_id"),
                        is_platform_admin=claims.get("is_platform_admin", False),
                    )
                except Exception:
                    return None

            def _default_user() -> UserInfo:
                return UserInfo(
                    user_id="550e8400-e29b-41d4-a716-446655440000",  # Valid UUID format
                    email="test@example.com",
                    username="testuser",
                    roles=["admin"],
                    permissions=[
                        "read", "write", "admin",
                        "billing:subscriptions:write", "billing:subscriptions:read",
                        "billing:invoices:write", "billing:invoices:read",
                        "billing:payments:write", "billing:payments:read",
                    ],
                    tenant_id="test-tenant",
                    is_platform_admin=True,
                )

            async def override_get_current_user(request: Request) -> UserInfo:
                user = await _resolve_user_from_request(request)
                return user or _default_user()

            async def override_get_current_user_optional(request: Request) -> UserInfo | None:
                user = await _resolve_user_from_request(request)
                return user

            app.dependency_overrides[get_current_user] = override_get_current_user
            app.dependency_overrides[get_current_user_optional] = override_get_current_user_optional
        except ImportError:
            pass

        # Override tenant dependency for testing
        try:
            from dotmac.platform.tenant import get_current_tenant_id

            def override_get_current_tenant_id():
                """Test tenant ID."""
                return "test-tenant"

            app.dependency_overrides[get_current_tenant_id] = override_get_current_tenant_id
        except ImportError:
            pass

        # Override database session to use test engine
        # This prevents event loop issues across tests
        try:
            from sqlalchemy.ext.asyncio import async_sessionmaker

            from dotmac.platform.db import get_async_session, get_session_dependency

            test_session_maker = async_sessionmaker(async_db_engine, expire_on_commit=False)

            async def override_get_async_session():
                """Test database session using test engine."""
                async with test_session_maker() as session:
                    try:
                        yield session
                    except Exception:
                        await session.rollback()
                        raise
                    finally:
                        await session.close()

            app.dependency_overrides[get_async_session] = override_get_async_session
            app.dependency_overrides[get_session_dependency] = override_get_async_session
        except ImportError:
            pass

        # CRITICAL: Also override get_async_session from database.py
        # Many routers import from ..database instead of ..db
        try:
            from dotmac.platform.database import (
                get_async_session as get_async_session_from_database,
            )

            app.dependency_overrides[get_async_session_from_database] = override_get_async_session
        except ImportError:
            pass

        # Override RBAC service to bypass permission checks in tests
        # This allows tests to focus on API behavior without setting up the full RBAC database schema
        try:
            from unittest.mock import AsyncMock, patch

            # Create a patcher that makes user_has_all_permissions always return True
            rbac_patcher = patch(
                "dotmac.platform.auth.rbac_service.RBACService.user_has_all_permissions",
                new_callable=AsyncMock,
                return_value=True
            )
            rbac_patcher.start()
        except ImportError:
            pass

        # Override Redis client to provide a mock for testing
        # This prevents Redis connection errors in router tests
        try:
            from unittest.mock import MagicMock
            from dotmac.platform.redis_client import get_redis_client

            def override_get_redis_client():
                """Mock Redis client for testing."""
                mock_redis = MagicMock()
                mock_redis.get = AsyncMock(return_value=None)
                mock_redis.set = AsyncMock(return_value=True)
                mock_redis.delete = AsyncMock(return_value=True)
                mock_redis.exists = AsyncMock(return_value=False)
                mock_redis.expire = AsyncMock(return_value=True)
                mock_redis.ttl = AsyncMock(return_value=-1)
                mock_redis.keys = AsyncMock(return_value=[])
                mock_redis.scan = AsyncMock(return_value=(0, []))
                mock_redis.ping = AsyncMock(return_value=True)
                return mock_redis

            app.dependency_overrides[get_redis_client] = override_get_redis_client
        except ImportError:
            pass

        # ============================================================================
        # Register ALL module routers for testing
        # ============================================================================

        # Auth routers
        try:
            from dotmac.platform.auth.router import router as auth_router

            app.include_router(auth_router, prefix="/api/v1", tags=["Auth"])
        except ImportError:
            pass

        try:
            from dotmac.platform.auth.api_keys_router import router as api_keys_router

            app.include_router(api_keys_router, prefix="/api/v1/auth/api-keys", tags=["API Keys"])
        except ImportError:
            pass

        try:
            from dotmac.platform.auth.rbac_router import router as rbac_router

            app.include_router(rbac_router, prefix="/api/v1/auth/rbac", tags=["RBAC"])
        except ImportError:
            pass

        try:
            from dotmac.platform.auth.rbac_read_router import router as rbac_read_router

            app.include_router(
                rbac_read_router, prefix="/api/v1/auth/rbac/read", tags=["RBAC Read"]
            )
        except ImportError:
            pass

        # Tenant router
        try:
            from dotmac.platform.tenant.router import router as tenant_router

            app.include_router(tenant_router, prefix="/api/v1", tags=["Tenant Management"])
        except ImportError:
            pass

        # Tenant usage billing router
        try:
            from dotmac.platform.tenant.usage_billing_router import router as usage_billing_router

            app.include_router(
                usage_billing_router, prefix="/api/v1/tenants", tags=["Tenant Usage Billing"]
            )
        except ImportError:
            pass

        # Billing routers
        try:
            from dotmac.platform.billing.subscriptions.router import router as subscriptions_router

            app.include_router(
                subscriptions_router, prefix="/api/v1/billing", tags=["Subscriptions"]
            )
        except ImportError:
            pass

        try:
            from dotmac.platform.billing.catalog.router import router as catalog_router

            app.include_router(catalog_router, prefix="/api/v1/billing/catalog", tags=["Catalog"])
        except ImportError:
            pass

        try:
            from dotmac.platform.billing.pricing.router import router as pricing_router

            app.include_router(pricing_router, prefix="/api/v1/billing/pricing", tags=["Pricing"])
        except ImportError:
            pass

        try:
            from dotmac.platform.billing.receipts.router import router as receipts_router

            app.include_router(
                receipts_router, prefix="/api/v1/billing/receipts", tags=["Receipts"]
            )
        except ImportError:
            pass

        try:
            from dotmac.platform.billing.webhooks.router import router as webhooks_router

            app.include_router(
                webhooks_router, prefix="/api/v1/billing/webhooks", tags=["Webhooks"]
            )
        except ImportError:
            pass

        try:
            from dotmac.platform.billing.payments.router import router as payments_router

            app.include_router(payments_router, prefix="/api/v1/billing", tags=["Payments"])
        except ImportError:
            pass

        try:
            from dotmac.platform.billing.credit_notes.router import router as credit_notes_router

            app.include_router(
                credit_notes_router, prefix="/api/v1/billing/credit-notes", tags=["Credit Notes"]
            )
        except ImportError:
            pass

        try:
            from dotmac.platform.billing.bank_accounts.router import router as bank_accounts_router

            app.include_router(
                bank_accounts_router, prefix="/api/v1/billing/bank-accounts", tags=["Bank Accounts"]
            )
        except ImportError:
            pass

        # Communications
        try:
            from dotmac.platform.communications.router import router as communications_router

            app.include_router(
                communications_router, prefix="/api/v1/communications", tags=["Communications"]
            )
        except ImportError:
            pass

        # Analytics
        try:
            from dotmac.platform.analytics.router import router as analytics_router

            app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
        except ImportError:
            pass

        # Analytics Metrics
        try:
            from dotmac.platform.analytics.metrics_router import router as analytics_metrics_router

            app.include_router(
                analytics_metrics_router,
                prefix="/api/v1/metrics/analytics",
                tags=["Analytics Activity"],
            )
        except ImportError:
            pass

        # Audit
        try:
            from dotmac.platform.audit.router import router as audit_router

            app.include_router(audit_router, prefix="/api/v1/audit", tags=["Audit"])
        except ImportError:
            pass

        # Admin
        try:
            from dotmac.platform.admin.settings.router import router as admin_settings_router

            app.include_router(
                admin_settings_router, prefix="/api/v1/admin/settings", tags=["Admin Settings"]
            )
        except ImportError:
            pass

        # Contacts
        try:
            from dotmac.platform.contacts.router import router as contacts_router

            app.include_router(contacts_router, prefix="/api/v1/contacts", tags=["Contacts"])
        except ImportError:
            pass

        # Customer Management
        try:
            from dotmac.platform.customer_management.router import router as customer_router

            app.include_router(customer_router, prefix="/api/v1/customers", tags=["Customers"])
        except ImportError:
            pass

        # Customer Portal
        try:
            from dotmac.platform.customer_portal.router import router as customer_portal_router

            app.include_router(customer_portal_router, prefix="/api/v1", tags=["Customer Portal"])
        except ImportError:
            pass

        # Data Import
        try:
            from dotmac.platform.data_import.router import router as data_import_router

            app.include_router(
                data_import_router, prefix="/api/v1/data-import", tags=["Data Import"]
            )
        except ImportError:
            pass

        # Data Transfer
        try:
            from dotmac.platform.data_transfer.router import router as data_transfer_router

            app.include_router(
                data_transfer_router, prefix="/api/v1/data-transfer", tags=["Data Transfer"]
            )
        except ImportError:
            pass

        # Feature Flags
        try:
            from dotmac.platform.feature_flags.router import router as feature_flags_router

            app.include_router(
                feature_flags_router, prefix="/api/v1/feature-flags", tags=["Feature Flags"]
            )
        except ImportError:
            pass

        # File Storage
        try:
            from dotmac.platform.file_storage.router import router as file_storage_router

            app.include_router(file_storage_router, prefix="/api/v1/files", tags=["File Storage"])
        except ImportError:
            pass

        # Fiber Infrastructure
        try:
            from dotmac.platform.fiber.router import router as fiber_router

            app.include_router(fiber_router, prefix="/api/v1", tags=["Fiber Infrastructure"])
            app.state.include_fiber = True  # marker for coverage stats dependency
        except ImportError:
            pass

        # Partner Management
        try:
            from dotmac.platform.partner_management.router import router as partner_router

            app.include_router(partner_router, prefix="/api/v1/partners", tags=["Partners"])
        except ImportError:
            pass

        # Plugins
        try:
            from dotmac.platform.plugins.router import router as plugins_router

            app.include_router(plugins_router, prefix="/api/v1/plugins", tags=["Plugins"])
        except ImportError:
            pass

        # ============================================================================
        # Metrics Routers - All metrics endpoints
        # ============================================================================

        # Billing Metrics
        try:
            from dotmac.platform.billing.metrics_router import customer_metrics_router
            from dotmac.platform.billing.metrics_router import router as billing_metrics_router

            app.include_router(
                billing_metrics_router, prefix="/api/v1/metrics/billing", tags=["Billing Metrics"]
            )
            app.include_router(
                customer_metrics_router,
                prefix="/api/v1/metrics/customers",
                tags=["Customer Metrics"],
            )
        except ImportError:
            pass

        # Auth Metrics
        try:
            from dotmac.platform.auth.metrics_router import router as auth_metrics_router

            app.include_router(
                auth_metrics_router, prefix="/api/v1/metrics/auth", tags=["Auth Metrics"]
            )
        except ImportError:
            pass

        # API Keys Metrics
        try:
            from dotmac.platform.auth.api_keys_metrics_router import (
                router as api_keys_metrics_router,
            )

            app.include_router(
                api_keys_metrics_router,
                prefix="/api/v1/metrics/api-keys",
                tags=["API Keys Metrics"],
            )
        except ImportError:
            pass

        # Communications Metrics
        try:
            from dotmac.platform.communications.metrics_router import router as comms_metrics_router

            app.include_router(
                comms_metrics_router,
                prefix="/api/v1/metrics/communications",
                tags=["Communications Metrics"],
            )
        except ImportError:
            pass

        # File Storage Metrics
        try:
            from dotmac.platform.file_storage.metrics_router import router as files_metrics_router

            app.include_router(
                files_metrics_router, prefix="/api/v1/metrics/files", tags=["File Storage Metrics"]
            )
        except ImportError:
            pass

        # Secrets Metrics
        try:
            from dotmac.platform.secrets.metrics_router import router as secrets_metrics_router

            app.include_router(
                secrets_metrics_router, prefix="/api/v1/metrics/secrets", tags=["Secrets Metrics"]
            )
        except ImportError:
            pass

        # Monitoring Metrics
        try:
            from dotmac.platform.monitoring.metrics_router import (
                router as monitoring_metrics_router,
            )

            app.include_router(
                monitoring_metrics_router,
                prefix="/api/v1/metrics/monitoring",
                tags=["Monitoring Metrics"],
            )
        except ImportError:
            pass

        # Search
        try:
            from dotmac.platform.search.router import router as search_router

            app.include_router(search_router, prefix="/api/v1/search", tags=["Search"])
        except ImportError:
            pass

        # User Management
        try:
            from dotmac.platform.user_management.router import router as user_router

            app.include_router(user_router, prefix="/api/v1/users", tags=["Users"])
        except ImportError:
            pass

        # Webhooks (platform-level)
        try:
            from dotmac.platform.webhooks.router import router as platform_webhooks_router

            app.include_router(
                platform_webhooks_router, prefix="/api/v1/webhooks", tags=["Webhooks"]
            )
        except ImportError:
            pass

        # Integrations
        try:
            from dotmac.platform.integrations.router import integrations_router

            app.include_router(
                integrations_router, prefix="/api/v1/integrations", tags=["Integrations"]
            )
        except ImportError:
            pass

        # BSS Phase 1 - CRM
        try:
            from dotmac.platform.crm.router import router as crm_router

            app.include_router(crm_router, prefix="/api/v1/crm", tags=["CRM"])
        except ImportError:
            pass

        # BSS Phase 1 - Jobs
        try:
            from dotmac.platform.jobs.router import router as jobs_router

            app.include_router(jobs_router, prefix="/api/v1", tags=["Jobs"])
        except ImportError:
            pass

        # BSS Phase 1 - Dunning
        try:
            from dotmac.platform.billing.dunning.router import router as dunning_router

            # Dunning router already has prefix="/billing/dunning"
            app.include_router(
                dunning_router, prefix="/api/v1"
            )
        except ImportError:
            pass

        # Services - Orchestration
        try:
            from dotmac.platform.services.router import router as orchestration_router

            # Orchestration router already has prefix="/orchestration"
            app.include_router(
                orchestration_router, prefix="/api/v1"
            )
        except ImportError:
            pass

        # Yield app for test execution, then cleanup
        yield app

        # Cleanup after test completes
        app.dependency_overrides.clear()

    class _HybridResponse:
        """Wrapper that supports both sync and async access to HTTP responses."""

        def __init__(
            self,
            sync_client: TestClient,
            app: Any,
            method: str,
            args: tuple[Any, ...],
            kwargs: dict[str, Any],
        ):
            self._sync_client = sync_client
            self._app = app
            self._method = method
            self._args = args
            self._kwargs = kwargs
            self._sync_response: Any | None = None

        def _ensure_sync(self) -> Any:
            if self._sync_response is None:
                handler = getattr(self._sync_client, self._method)
                self._sync_response = handler(*self._args, **self._kwargs)
            return self._sync_response

        def __getattr__(self, name: str):  # pragma: no cover - thin wrapper
            return getattr(self._ensure_sync(), name)

        def __await__(self):
            async def _run() -> Any:
                from httpx import (  # Local import to avoid global dependency
                    ASGITransport,
                    AsyncClient,
                )

                transport = ASGITransport(app=self._app)
                async with AsyncClient(
                    transport=transport,
                    base_url="http://testserver",
                    cookies=self._sync_client.cookies,
                ) as client:
                    handler = getattr(client, self._method)
                    response = await handler(*self._args, **self._kwargs)
                    # Persist cookies across async requests
                    self._sync_client.cookies.update(response.cookies)
                    return response

            return _run().__await__()

    class HybridTestClient:
        """Client that works for both sync and async HTTP calls in tests."""

        def __init__(self, app: Any) -> None:
            self._app = app
            self._sync_client = TestClient(app)

        def _make_request(self, method: str, *args: Any, **kwargs: Any) -> _HybridResponse:
            return _HybridResponse(self._sync_client, self._app, method, args, kwargs)

        def get(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("get", *args, **kwargs)

        def post(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("post", *args, **kwargs)

        def put(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("put", *args, **kwargs)

        def patch(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("patch", *args, **kwargs)

        def delete(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("delete", *args, **kwargs)

        def options(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("options", *args, **kwargs)

        def head(self, *args: Any, **kwargs: Any) -> _HybridResponse:
            return self._make_request("head", *args, **kwargs)

        def __getattr__(self, name: str):  # pragma: no cover - simple delegation
            return getattr(self._sync_client, name)

    @pytest.fixture
    def test_client(test_app):
        """Test client for FastAPI app supporting sync & async usage."""
        return HybridTestClient(test_app)

    try:
        import pytest_asyncio

        @pytest_asyncio.fixture
        async def authenticated_client(test_app):
            """Async test client with authentication for testing protected endpoints."""
            from httpx import ASGITransport, AsyncClient

            from dotmac.platform.auth.core import JWTService

            # Create JWT service and generate a test token
            jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-testing-only")

            # Create test token with user claims
            test_token = jwt_service.create_access_token(
                subject="test-user-123",
                additional_claims={
                    "scopes": ["read", "write", "admin"],
                    "tenant_id": "test-tenant",
                    "email": "test@example.com",
                    "username": "testuser",
                },
            )

            # Create async client with authentication headers
            transport = ASGITransport(app=test_app)
            async with AsyncClient(
                transport=transport,
                base_url="http://testserver",
                headers={
                    "Authorization": f"Bearer {test_token}",
                    "X-Tenant-ID": "test-tenant",
                },
            ) as client:
                yield client

        @pytest_asyncio.fixture
        async def unauthenticated_client(async_session):
            """
            HTTP client for testing unauthorized access (401/403 scenarios).

            This fixture creates a fresh FastAPI app WITHOUT auth override,
            allowing tests to verify authentication failures properly.

            Still includes session and tenant overrides for database consistency.
            """
            from fastapi import FastAPI
            from httpx import ASGITransport, AsyncClient

            from dotmac.platform.db import get_async_session, get_session_dependency
            from dotmac.platform.tenant import get_current_tenant_id

            # Create minimal app without auth override
            app = FastAPI(title="Unauth Test App")

            # Override session dependencies (needed for DB access)
            async def override_get_session():
                yield async_session

            app.dependency_overrides[get_session_dependency] = override_get_session
            app.dependency_overrides[get_async_session] = override_get_session

            # Override tenant (needed for tenant filtering)
            def override_get_current_tenant_id():
                return "test-tenant"

            app.dependency_overrides[get_current_tenant_id] = override_get_current_tenant_id

            # ============================================================================
            # Register routers for modules that need auth testing
            # ============================================================================

            # Analytics Metrics
            try:
                from dotmac.platform.analytics.metrics_router import (
                    router as analytics_metrics_router,
                )

                app.include_router(
                    analytics_metrics_router,
                    prefix="/api/v1/metrics/analytics",
                    tags=["Analytics Activity"],
                )
            except ImportError:
                pass

            # Monitoring Metrics
            try:
                from dotmac.platform.monitoring.metrics_router import (
                    router as monitoring_metrics_router,
                )

                app.include_router(
                    monitoring_metrics_router,
                    prefix="/api/v1/metrics/monitoring",
                    tags=["Monitoring Metrics"],
                )
            except ImportError:
                pass

            # Tenant Usage Billing Router
            try:
                from dotmac.platform.tenant.usage_billing_router import (
                    router as usage_billing_router,
                )

                app.include_router(
                    usage_billing_router, prefix="/api/v1/tenants", tags=["Tenant Usage Billing"]
                )
            except ImportError:
                pass

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                yield client

    except ImportError:
        # Fallback if pytest_asyncio not available
        @pytest_asyncio.fixture
        async def authenticated_client(test_app):
            """Async test client with authentication for testing protected endpoints."""
            from httpx import ASGITransport, AsyncClient

            from dotmac.platform.auth.core import JWTService

            # Create JWT service and generate a test token
            jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-testing-only")

            # Create test token with user claims
            test_token = jwt_service.create_access_token(
                subject="test-user-123",
                additional_claims={
                    "scopes": ["read", "write", "admin"],
                    "tenant_id": "test-tenant",
                    "email": "test@example.com",
                    "username": "testuser",
                },
            )

            # Create async client with auth headers
            transport = ASGITransport(app=test_app)
            async with AsyncClient(
                transport=transport,
                base_url="http://testserver",
                headers={
                    "Authorization": f"Bearer {test_token}",
                    "X-Tenant-ID": "test-tenant",  # Required by tenant middleware
                },
            ) as client:
                yield client

else:

    @pytest.fixture
    def test_app():
        """Mock FastAPI application."""
        return Mock()

    @pytest.fixture
    def test_client():
        """Mock test client."""
        return Mock()


# Async cleanup fixture
@pytest_asyncio.fixture
async def async_cleanup():
    """Fixture to track and cleanup async tasks."""
    tasks = []

    def track_task(task):
        tasks.append(task)

    yield track_task

    # Cleanup all tracked tasks
    for task in tasks:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


# Test environment setup
@pytest.fixture(autouse=True)
def test_environment():
    """Set up test environment variables."""
    original_env = os.environ.copy()

    # Set test environment with in-memory SQLite database
    # Using :memory: eliminates file locking issues and improves test speed
    os.environ["ENVIRONMENT"] = "test"
    os.environ["DOTMAC_ENV"] = "test"
    os.environ["TESTING"] = "true"
    os.environ["DOTMAC_DATABASE_URL"] = "sqlite:///:memory:"
    os.environ["DOTMAC_DATABASE_URL_ASYNC"] = "sqlite+aiosqlite:///:memory:"

    try:
        yield
    finally:
        # Restore original environment
        os.environ.clear()
        os.environ.update(original_env)


@pytest.fixture(autouse=True, scope="function")
def cleanup_fastapi_state(request):
    """Automatically clean up FastAPI app state after each test.

    This prevents test isolation issues by:
    - Clearing dependency overrides
    - Resetting router state
    - Clearing event handlers (if accumulated)

    Runs for ALL tests automatically (autouse=True).
    """
    # Setup - nothing needed before test
    yield

    # Cleanup after test
    if HAS_FASTAPI:
        # Try to find any FastAPI app instances in the test and clean them up
        # This catches cases where tests create their own apps
        for item in dir(request):
            try:
                obj = getattr(request, item)
                if hasattr(obj, "__class__") and obj.__class__.__name__ == "FastAPI":
                    if hasattr(obj, "dependency_overrides"):
                        obj.dependency_overrides.clear()
            except (AttributeError, TypeError):
                pass


@pytest.fixture(autouse=True, scope="function")
def cleanup_registry():
    """Provide cleanup registry for automatic resource cleanup.

    This fixture:
    1. Resets the registry before each test
    2. Provides the registry to the test
    3. Runs all registered cleanup handlers after the test

    Usage in tests:
        def test_my_feature(cleanup_registry):
            resource = create_resource()
            cleanup_registry.register(
                resource.close,
                priority=CleanupPriority.FILE_HANDLES,
                name="my_resource"
            )
            # resource.close() called automatically after test

    See tests/CLEANUP_REGISTRY_INTEGRATION.md for more examples.
    """
    from tests.helpers.cleanup_registry import (
        get_cleanup_registry,
        reset_cleanup_registry,
    )

    reset_cleanup_registry()
    registry = get_cleanup_registry()

    yield registry

    # Automatic cleanup in priority order
    registry.cleanup_all()


@pytest.fixture(autouse=True, scope="function")
def disable_rate_limiting_globally(request):
    """Disable rate limiting for all tests to prevent 429 errors in test suite.

    Exception: Tests in test_rate_limits.py are excluded so they can verify rate limiting works.
    """
    from dotmac.platform.core.rate_limiting import get_limiter

    # Skip disabling for tests that explicitly test rate limiting
    test_module = request.node.fspath.basename if hasattr(request.node, "fspath") else ""
    test_name = request.node.name if hasattr(request.node, "name") else ""
    test_class = (
        request.node.cls.__name__ if hasattr(request.node, "cls") and request.node.cls else ""
    )
    # Get full node ID which includes class name even in parallel execution
    node_id = request.node.nodeid if hasattr(request.node, "nodeid") else ""

    # Don't disable rate limiting for tests that specifically test it
    # Check module name, test name, class name, and node ID
    if (
        "rate_limit" in test_module.lower()
        or "rate_limit" in test_name.lower()
        or "ratelimit" in test_class.lower()
        or "ratelimit" in node_id.lower()
    ):
        yield
        return

    try:
        limiter_instance = get_limiter()
        original_enabled = limiter_instance.enabled

        # Disable rate limiting for tests
        limiter_instance.enabled = False

        # Clear any accumulated rate limit counters
        try:
            if hasattr(limiter_instance, "_storage") and limiter_instance._storage:
                if hasattr(limiter_instance._storage, "reset"):
                    limiter_instance._storage.reset()
        except Exception:
            pass  # Ignore storage reset errors

        yield

        # Restore original state
        limiter_instance.enabled = original_enabled
    except Exception:
        # If rate limiting setup fails, just continue
        # Some tests might not have rate limiting configured
        yield


# Pytest configuration
def pytest_configure(config):
    """Configure pytest."""
    # Add custom markers
    config.addinivalue_line("markers", "unit: Unit test")
    config.addinivalue_line("markers", "integration: Integration test")
    config.addinivalue_line("markers", "asyncio: Async test")
    config.addinivalue_line("markers", "slow: Slow test")


# Communications config fixture for notification tests
@pytest.fixture
def communications_config():
    """Mock communications configuration for testing."""
    return {
        "notifications": {
            "email": {
                "enabled": True,
                "smtp_host": "localhost",
                "smtp_port": 1025,
                "from_address": "test@example.com",
            },
            "sms": {
                "enabled": False,
            },
            "push": {
                "enabled": False,
            },
        },
        "webhooks": {
            "enabled": True,
            "timeout": 30,
            "retry_attempts": 3,
        },
        "rate_limits": {
            "email": 100,  # per minute
            "sms": 10,
            "push": 1000,
        },
    }


# Event loop fixture for asyncio tests
@pytest.fixture(scope="function")
def event_loop():
    """Create a fresh event loop per test for isolation."""
    loop = asyncio.new_event_loop()
    previous_loop = None
    try:
        try:
            previous_loop = asyncio.get_running_loop()
        except RuntimeError:
            previous_loop = None

        asyncio.set_event_loop(loop)
        yield loop
    finally:
        try:
            # Allow pending callbacks a chance to finalize
            loop.run_until_complete(asyncio.sleep(0))

            # Cancel all pending tasks
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()

            # Wait for all tasks to complete cancellation
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

            # Shutdown async generators and default executor
            loop.run_until_complete(loop.shutdown_asyncgens())
            if hasattr(loop, "shutdown_default_executor"):
                loop.run_until_complete(loop.shutdown_default_executor())
        except Exception:
            pass
        finally:
            asyncio.set_event_loop(previous_loop)
            loop.close()


# Skip tests that require unavailable dependencies
def pytest_collection_modifyitems(config, items):
    """Modify test collection to skip tests with missing dependencies."""
    skip_no_redis = pytest.mark.skip(reason="fakeredis not available")
    skip_no_db = pytest.mark.skip(reason="sqlalchemy not available")
    skip_no_fastapi = pytest.mark.skip(reason="fastapi not available")

    for item in items:
        # Skip Redis tests if fakeredis not available
        if "redis" in item.keywords and not HAS_FAKEREDIS:
            item.add_marker(skip_no_redis)

        # Skip database tests if SQLAlchemy not available
        if "database" in item.keywords and not HAS_SQLALCHEMY:
            item.add_marker(skip_no_db)

        # Skip FastAPI tests if FastAPI not available
        if "fastapi" in item.keywords and not HAS_FASTAPI:
            item.add_marker(skip_no_fastapi)


# ============================================================================
# Billing Integration Test Fixtures
# ============================================================================

if HAS_SQLALCHEMY:
    try:
        import pytest_asyncio

        @pytest_asyncio.fixture
        async def async_session(async_db_engine):
            """Async database session for billing integration tests.

            This is an alias for async_db_session that matches the naming
            used in billing integration tests.
            """
            SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
            async with SessionMaker() as session:
                try:
                    yield session
                finally:
                    try:
                        await session.rollback()
                    except Exception:
                        pass
                    await session.close()
                    await asyncio.sleep(0)

        @pytest_asyncio.fixture
        async def test_payment_method(async_session):
            """Create test payment method in real database for integration tests."""
            from uuid import uuid4

            from dotmac.platform.billing.core.entities import PaymentMethodEntity
            from dotmac.platform.billing.core.enums import PaymentMethodStatus, PaymentMethodType

            payment_method = PaymentMethodEntity(
                payment_method_id=str(uuid4()),  # Generate valid UUID
                tenant_id="test-tenant",
                customer_id="cust_123",
                type=PaymentMethodType.CARD,
                status=PaymentMethodStatus.ACTIVE,
                provider="stripe",  # Required field
                provider_payment_method_id="stripe_pm_123",
                display_name="Visa ending in 4242",  # Required field
                last_four="4242",
                brand="visa",
                expiry_month=12,
                expiry_year=2030,
            )
            async_session.add(payment_method)
            await async_session.commit()
            await async_session.refresh(payment_method)
            return payment_method

        @pytest_asyncio.fixture
        def mock_stripe_provider():
            """Mock Stripe payment provider for integration tests."""
            from unittest.mock import AsyncMock

            provider = AsyncMock()
            provider.charge_payment_method = AsyncMock()
            return provider

        @pytest_asyncio.fixture
        async def test_subscription_plan(async_session):
            """Create test subscription plan in real database."""
            from decimal import Decimal

            from dotmac.platform.billing.models import BillingSubscriptionPlanTable
            from dotmac.platform.billing.subscriptions.models import BillingCycle

            plan = BillingSubscriptionPlanTable(
                plan_id="plan_test_123",
                tenant_id="test-tenant",
                product_id="prod_123",
                name="Test Plan",
                description="Test subscription plan",
                billing_cycle=BillingCycle.MONTHLY.value,
                price=Decimal("29.99"),
                currency="usd",
                trial_days=14,
                is_active=True,
            )
            async_session.add(plan)
            await async_session.commit()
            await async_session.refresh(plan)
            return plan

        @pytest_asyncio.fixture
        async def client(test_app):
            """Async HTTP client for integration tests.

            This provides an authenticated async client for testing
            billing API endpoints.
            """
            from httpx import ASGITransport, AsyncClient

            transport = ASGITransport(app=test_app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                yield client

        @pytest_asyncio.fixture
        def auth_headers():
            """Authentication headers for integration tests.

            Includes both Authorization and X-Tenant-ID headers for tenant isolation.
            """
            from dotmac.platform.auth.core import JWTService

            jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-testing-only")

            test_token = jwt_service.create_access_token(
                subject="550e8400-e29b-41d4-a716-446655440000",
                additional_claims={
                    "scopes": ["read", "write", "admin"],
                    "tenant_id": "test-tenant",
                    "email": "test@example.com",
                },
            )

            return {
                "Authorization": f"Bearer {test_token}",
                "X-Tenant-ID": "test-tenant",
            }

    except ImportError:
        # Fallback fixtures if pytest_asyncio not available
        @pytest_asyncio.fixture
        async def async_session(async_db_engine):
            """Async database session for billing integration tests."""
            SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
            async with SessionMaker() as session:
                try:
                    yield session
                finally:
                    try:
                        await session.rollback()
                    except Exception:
                        pass
                    await session.close()
                    await asyncio.sleep(0)

        @pytest_asyncio.fixture
        async def test_payment_method(async_session):
            """Create test payment method in real database."""
            from uuid import uuid4

            from dotmac.platform.billing.core.entities import PaymentMethodEntity
            from dotmac.platform.billing.core.enums import PaymentMethodStatus, PaymentMethodType

            payment_method = PaymentMethodEntity(
                payment_method_id=str(uuid4()),  # Generate valid UUID
                tenant_id="test-tenant",
                customer_id="cust_123",
                type=PaymentMethodType.CARD,
                status=PaymentMethodStatus.ACTIVE,
                provider="stripe",  # Required field
                provider_payment_method_id="stripe_pm_123",
                display_name="Visa ending in 4242",  # Required field
                last_four="4242",
                brand="visa",
                expiry_month=12,
                expiry_year=2030,
            )
            async_session.add(payment_method)
            await async_session.commit()
            await async_session.refresh(payment_method)
            return payment_method

        @pytest.fixture
        def mock_stripe_provider():
            """Mock Stripe payment provider."""
            from unittest.mock import AsyncMock

            provider = AsyncMock()
            provider.charge_payment_method = AsyncMock()
            return provider

        @pytest_asyncio.fixture
        async def test_subscription_plan(async_session):
            """Create test subscription plan."""
            from decimal import Decimal

            from dotmac.platform.billing.models import BillingSubscriptionPlanTable
            from dotmac.platform.billing.subscriptions.models import BillingCycle

            plan = BillingSubscriptionPlanTable(
                plan_id="plan_test_123",
                tenant_id="test-tenant",
                product_id="prod_123",
                name="Test Plan",
                description="Test subscription plan",
                billing_cycle=BillingCycle.MONTHLY.value,
                price=Decimal("29.99"),
                currency="usd",
                trial_days=14,
                is_active=True,
            )
            async_session.add(plan)
            await async_session.commit()
            await async_session.refresh(plan)
            return plan

        @pytest_asyncio.fixture
        async def client(test_app):
            """Async HTTP client for integration tests."""
            from httpx import ASGITransport, AsyncClient

            transport = ASGITransport(app=test_app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                yield client

        @pytest.fixture
        def auth_headers():
            """Authentication headers for integration tests.

            Includes both Authorization and X-Tenant-ID headers for tenant isolation.
            """
            from dotmac.platform.auth.core import JWTService

            jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-testing-only")

            test_token = jwt_service.create_access_token(
                subject="550e8400-e29b-41d4-a716-446655440000",
                additional_claims={
                    "scopes": ["read", "write", "admin"],
                    "tenant_id": "test-tenant",
                    "email": "test@example.com",
                },
            )

            return {
                "Authorization": f"Bearer {test_token}",
                "X-Tenant-ID": "test-tenant",
            }


@pytest_asyncio.fixture
async def unauthenticated_client(async_db_engine):
    """
    HTTP client WITHOUT auth override for testing authentication enforcement.

    This fixture creates a FastAPI app that does NOT override get_current_user,
    allowing tests to verify that endpoints properly enforce authentication.

    Use this for testing:
    - 401 responses when no auth provided
    - 403 responses when insufficient permissions
    - Authentication middleware behavior

    Database and tenant dependencies are still overridden for test isolation.
    """
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy.ext.asyncio import async_sessionmaker

    # Import safely in case modules aren't available
    try:
        from dotmac.platform.db import get_async_session, get_session_dependency
        from dotmac.platform.tenant import get_current_tenant_id
    except ImportError:
        pytest.skip("Required dependencies not available")

    # Create minimal app without auth override
    app = FastAPI(title="Unauthenticated Test App")

    # Override database session (needed for DB access)
    test_session_maker = async_sessionmaker(async_db_engine, expire_on_commit=False)

    async def override_get_session():
        async with test_session_maker() as session:
            yield session

    app.dependency_overrides[get_session_dependency] = override_get_session
    app.dependency_overrides[get_async_session] = override_get_session

    # Override tenant (needed for tenant filtering)
    def override_get_current_tenant_id():
        return "test-tenant"

    app.dependency_overrides[get_current_tenant_id] = override_get_current_tenant_id

    # Register all routers so tests can hit endpoints
    # Import and register routers using safe imports
    router_modules = [
        ("dotmac.platform.analytics.metrics_router", "router", "/api/v1/metrics/analytics"),
        ("dotmac.platform.monitoring.metrics_router", "router", "/api/v1/metrics/monitoring"),
        ("dotmac.platform.tenant.usage_billing_router", "router", "/api/v1/tenants"),
        ("dotmac.platform.billing.payments.router", "router", "/api/v1/billing/payments"),
        ("dotmac.platform.auth.router", "router", "/api/v1/auth"),
    ]

    for module_path, router_name, prefix in router_modules:
        try:
            module = __import__(module_path, fromlist=[router_name])
            router = getattr(module, router_name)
            app.include_router(router, prefix=prefix)
        except (ImportError, AttributeError):
            # Module or router not available, skip
            pass

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


# =============================================================================
# Celery Configuration Fixtures
# =============================================================================


@pytest.fixture(autouse=True, scope="session")
def configure_celery_for_tests():
    """
    Configure Celery to run tasks synchronously in tests.

    This fixture enables eager mode so Celery tasks execute immediately
    in the same process instead of being queued for worker processing.
    This is essential for testing async tasks that interact with the database.
    """
    try:
        from dotmac.platform.celery_app import celery_app

        # Store original settings
        original_always_eager = celery_app.conf.get("task_always_eager", False)
        original_eager_propagates = celery_app.conf.get("task_eager_propagates", True)

        # Configure for synchronous execution
        celery_app.conf.update(
            task_always_eager=True,  # Execute tasks synchronously
            task_eager_propagates=True,  # Propagate exceptions from tasks
        )

        yield

        # Restore original settings
        celery_app.conf.update(
            task_always_eager=original_always_eager,
            task_eager_propagates=original_eager_propagates,
        )
    except ImportError:
        # Celery not available, skip configuration
        yield

# ============================================================================
# Authenticated Client Fixtures
# ============================================================================

@pytest.fixture
def test_user() -> "UserInfo":
    """
    Create a test user with admin permissions for authentication.
    
    Returns:
        UserInfo with full admin access and common permissions
    """
    from uuid import uuid4
    from dotmac.platform.auth.core import UserInfo
    
    return UserInfo(
        user_id=str(uuid4()),
        tenant_id=f"test_tenant_{uuid4()}",
        email="test@example.com",
        is_platform_admin=True,
        username="testuser",
        roles=["admin"],
        permissions=[
            "read", "write", "admin",
            "access:read", "access:write",
            "billing:read", "billing:write",
            "billing:subscriptions:read", "billing:subscriptions:write",
            "billing:invoices:read", "billing:invoices:write",
            "billing:payments:read", "billing:payments:write",
            "customer:read", "customer:write",
        ],
    )


@pytest.fixture
def authenticated_client(test_app: "FastAPI", test_user: "UserInfo"):
    """
    Create a TestClient with authentication already configured.
    
    This fixture:
    - Overrides get_current_user dependency
    - Returns a TestClient ready for authenticated API calls
    - Automatically cleans up dependency overrides after test
    
    Args:
        fastapi_app: The FastAPI application instance
        test_user: The authenticated user info
        
    Returns:
        TestClient configured with authentication
        
    Example:
        def test_my_endpoint(authenticated_client):
            response = authenticated_client.get("/api/v1/my-endpoint")
            assert response.status_code == 200
    """
    from starlette.testclient import TestClient
    from dotmac.platform.auth.core import get_current_user
    
    # Override authentication
    test_app.dependency_overrides[get_current_user] = lambda: test_user

    # Create client
    client = TestClient(test_app)

    yield client

    # Cleanup
    test_app.dependency_overrides.clear()


@pytest.fixture
def authenticated_client_with_tenant(test_app: "FastAPI", test_user: "UserInfo"):
    """
    Create a TestClient that automatically adds X-Tenant-ID header.

    This fixture wraps the TestClient to automatically include the
    X-Tenant-ID header in all requests.

    Args:
        test_app: The FastAPI application instance
        test_user: The authenticated user info
        
    Returns:
        TestClient with automatic tenant header injection
        
    Example:
        def test_tenant_scoped_endpoint(authenticated_client_with_tenant):
            # X-Tenant-ID header automatically added
            response = authenticated_client_with_tenant.get("/api/v1/customers")
            assert response.status_code == 200
    """
    from starlette.testclient import TestClient
    from dotmac.platform.auth.core import get_current_user

    # Override authentication
    test_app.dependency_overrides[get_current_user] = lambda: test_user

    # Create base client
    base_client = TestClient(test_app)
    
    # Wrapper class that adds tenant header automatically
    class TenantAwareClient:
        def __init__(self, client: TestClient, tenant_id: str):
            self._client = client
            self._tenant_id = tenant_id
            
        def _add_tenant_header(self, kwargs: dict) -> dict:
            """Add X-Tenant-ID header to request kwargs."""
            headers = kwargs.get("headers", {})
            if isinstance(headers, dict):
                headers = headers.copy()
            else:
                # Convert headers list/tuple to dict
                headers = dict(headers) if headers else {}
            headers["X-Tenant-ID"] = self._tenant_id
            kwargs["headers"] = headers
            return kwargs
            
        def get(self, *args, **kwargs):
            return self._client.get(*args, **self._add_tenant_header(kwargs))
            
        def post(self, *args, **kwargs):
            return self._client.post(*args, **self._add_tenant_header(kwargs))
            
        def put(self, *args, **kwargs):
            return self._client.put(*args, **self._add_tenant_header(kwargs))
            
        def patch(self, *args, **kwargs):
            return self._client.patch(*args, **self._add_tenant_header(kwargs))
            
        def delete(self, *args, **kwargs):
            return self._client.delete(*args, **self._add_tenant_header(kwargs))
            
        def __getattr__(self, name):
            """Proxy other attributes to base client."""
            return getattr(self._client, name)
    
    wrapped_client = TenantAwareClient(base_client, test_user.tenant_id)

    yield wrapped_client

    # Cleanup
    test_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_platform_config():
    """Reset platform config after each test to prevent pollution."""
    import dotmac.platform as platform_module
    
    # Store original config
    original_config = platform_module.config
    
    yield
    
    # Restore original config after test
    platform_module.config = original_config
    
    # If config was replaced with a module or other non-PlatformConfig object, recreate it
    if not hasattr(platform_module.config, 'get'):
        from dotmac.platform import PlatformConfig
        platform_module.config = PlatformConfig()
