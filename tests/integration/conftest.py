"""
Integration Tests Configuration

Shared fixtures and configuration for integration tests.

This module automatically starts Docker Compose services (PostgreSQL, Redis, MinIO)
when running integration tests with `-m integration` or from tests/integration/ directory.
"""

import asyncio
from contextlib import suppress

import pytest
import pytest_asyncio
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from tests.fixtures.environment import HAS_FAKEREDIS, fakeredis

# Import Docker fixtures to enable automatic service startup
from tests.integration.docker_fixtures import auto_docker_services, docker_services  # noqa: F401


@pytest.fixture(scope="session", autouse=True)
def integration_test_environment():
    """Ensure tenant headers are optional during integration tests."""
    import os

    from dotmac.platform.tenant.config import TenantConfiguration, set_tenant_config

    original_value = os.environ.get("REQUIRE_TENANT_HEADER")
    os.environ["REQUIRE_TENANT_HEADER"] = "false"

    set_tenant_config(TenantConfiguration())

    yield

    if original_value is None:
        os.environ.pop("REQUIRE_TENANT_HEADER", None)
    else:
        os.environ["REQUIRE_TENANT_HEADER"] = original_value

    set_tenant_config(TenantConfiguration())


@pytest.fixture
def postgres_only(async_db_session: AsyncSession):
    """
    Skip the requesting test when the database backend is not PostgreSQL.

    Useful for tests that rely on PostgreSQL-specific functionality such as
    information_schema queries or extensions unavailable on SQLite.
    """
    bind = getattr(async_db_session, "bind", None)
    if bind is None or bind.dialect.name != "postgresql":
        pytest.skip("Requires PostgreSQL backend for integration test")
    return async_db_session


# Mark all tests in this directory as integration tests
def pytest_collection_modifyitems(items):
    """Add integration marker to all tests in integration directory."""
    for item in items:
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)


@pytest.fixture(scope="session")
def event_loop():
    """
    Create event loop for async tests.

    Session-scoped to avoid creating new event loops for each test.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_redis():
    """
    Initialize Redis client for integration tests.

    Session-scoped to initialize once for all tests.
    Auto-used to ensure Redis is available for all integration tests.
    """
    from dotmac.platform.redis_client import redis_manager

    fake_client = None
    try:
        # Initialize Redis with test configuration
        await redis_manager.initialize()
    except (RedisError, OSError, PermissionError) as exc:
        if not HAS_FAKEREDIS:
            pytest.skip(f"Requires Redis backend or fakeredis for fallback ({exc}).")

        print(  # noqa: T201 - provide explicit notice during test setup
            f"[integration] Redis unavailable ({exc}); using fakeredis fallback."
        )
        fake_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
        await fake_client.flushdb()
        redis_manager._client = fake_client  # type: ignore[attr-defined]  # noqa: SLF001
        redis_manager._pool = None  # type: ignore[attr-defined]  # noqa: SLF001

    try:
        yield
    finally:
        if fake_client is not None:
            with suppress(Exception):
                await fake_client.flushdb()
            with suppress(Exception):
                await fake_client.close()
            redis_manager._client = None  # type: ignore[attr-defined]  # noqa: SLF001
            redis_manager._pool = None  # type: ignore[attr-defined]  # noqa: SLF001
        else:
            # Clean up Redis connections after all tests
            with suppress(Exception):
                await redis_manager.close()


@pytest_asyncio.fixture(autouse=True)
async def cleanup_integration_test_data(async_db_session):
    """
    Comprehensive cleanup after each integration test.

    For PostgreSQL with nested transactions:
    - Transaction rollback handles all cleanup automatically
    - No manual deletion needed

    For SQLite or if rollback fails:
    - Explicit cleanup with DELETE queries

    Applied automatically to all integration tests.
    """
    yield

    # Check if we're using PostgreSQL (nested transaction mode)
    # If so, the transaction rollback will handle cleanup automatically
    try:
        db_url = str(async_db_session.bind.url)
        is_postgresql = "postgresql" in db_url
    except Exception:
        is_postgresql = False

    if is_postgresql:
        # PostgreSQL with nested transactions - rollback handles cleanup
        # No explicit deletion needed (and would conflict with transaction pattern)
        try:
            await async_db_session.rollback()
        except Exception:
            pass
        return

    # SQLite or fallback: explicit cleanup
    try:
        await async_db_session.rollback()
    except Exception:
        pass

    from sqlalchemy import text

    from dotmac.platform.db import Base

    # Dynamically purge all known tables in SQLite fallback scenarios. This avoids
    # per-module cleanup drift and ensures fresh state even when tests reuse
    # deterministic identifiers (tenant slugs, MAC addresses, etc.).
    try:
        existing = await async_db_session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table'")
        )
        existing_tables = {row[0] for row in existing}
    except Exception:
        existing_tables = set()

    if not existing_tables:
        # Fallback: rely on metadata listing when PRAGMA query is unavailable
        existing_tables = {table.name for table in Base.metadata.tables.values()}

    # Skip SQLite bookkeeping tables that should persist
    preserved_tables = {"sqlite_sequence", "alembic_version"}

    for table in reversed(Base.metadata.sorted_tables):
        if table.name in preserved_tables or table.name not in existing_tables:
            continue
        try:
            await async_db_session.execute(table.delete())
        except Exception:
            # Ignore tables that aren't present or have incompatible schemas
            continue

    try:
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()


@pytest_asyncio.fixture
async def cleanup_db(async_db_session):
    """
    Legacy cleanup fixture for backwards compatibility.

    New code should rely on cleanup_integration_test_data autouse fixture.
    """
    yield

    # Rollback any uncommitted changes
    await async_db_session.rollback()


@pytest.fixture
def test_tenant_id():
    """Test tenant ID for integration tests."""
    return "integration-test-tenant"


@pytest_asyncio.fixture
async def test_tenant(async_session, test_tenant_id):
    """Create test tenant in database for integration tests."""
    # Check if tenant already exists
    from sqlalchemy import select

    from dotmac.platform.tenant.models import Tenant, TenantStatus

    stmt = select(Tenant).where(Tenant.id == test_tenant_id)
    result = await async_session.execute(stmt)
    existing_tenant = result.scalar_one_or_none()

    if existing_tenant:
        return existing_tenant

    # Create new tenant
    tenant = Tenant(
        id=test_tenant_id,
        name="Integration Test Tenant",
        slug=test_tenant_id,
        status=TenantStatus.ACTIVE,
    )
    async_session.add(tenant)
    await async_session.flush()
    return tenant


@pytest.fixture
def mock_user_info():
    """Mock user info for integration tests."""
    from unittest.mock import MagicMock

    user_info = MagicMock()
    user_info.user_id = "integration-test-user"
    user_info.tenant_id = "integration-test-tenant"
    user_info.email = "integration@test.com"
    user_info.roles = ["admin"]
    user_info.permissions = ["*"]
    return user_info


@pytest.fixture
def integration_config():
    """Common configuration for integration tests."""
    return {
        "timeout": 30,
        "retry_count": 3,
        "enable_logging": True,
    }


@pytest.fixture
def cross_module_mocks():
    """Cross-module mock objects for integration testing."""
    from unittest.mock import MagicMock

    return {
        "auth_service": MagicMock(),
        "tenant_service": MagicMock(),
        "storage_service": MagicMock(),
        "data_transfer_service": MagicMock(),
    }


@pytest_asyncio.fixture
async def smoke_test_tenant(async_session):
    """Create smoke test tenant for Phase 1 smoke tests.

    Generates unique tenant for each test run to ensure proper isolation.
    """
    from uuid import uuid4

    from dotmac.platform.tenant.models import Tenant, TenantStatus

    # Generate unique ID for this test run
    unique_id = uuid4().hex[:8]
    tenant_id = f"smoke-test-{unique_id}"

    tenant = Tenant(
        id=tenant_id,
        name=f"Smoke Test Tenant {unique_id}",
        slug=tenant_id,
        status=TenantStatus.ACTIVE,
    )
    async_session.add(tenant)
    await async_session.flush()
    return tenant


@pytest_asyncio.fixture
async def smoke_test_tenant_a(async_session):
    """Create tenant A for multi-tenant isolation tests.

    Generates unique tenant for each test run to ensure proper isolation.
    """
    from uuid import uuid4

    from dotmac.platform.tenant.models import Tenant, TenantStatus

    # Generate unique ID for this test run
    unique_id = uuid4().hex[:8]
    tenant_id = f"tenant-a-{unique_id}"

    tenant = Tenant(
        id=tenant_id,
        name=f"Test Tenant A {unique_id}",
        slug=tenant_id,
        status=TenantStatus.ACTIVE,
    )
    async_session.add(tenant)
    await async_session.flush()
    return tenant


@pytest_asyncio.fixture
async def smoke_test_tenant_b(async_session):
    """Create tenant B for multi-tenant isolation tests.

    Generates unique tenant for each test run to ensure proper isolation.
    """
    from uuid import uuid4

    from dotmac.platform.tenant.models import Tenant, TenantStatus

    # Generate unique ID for this test run
    unique_id = uuid4().hex[:8]
    tenant_id = f"tenant-b-{unique_id}"

    tenant = Tenant(
        id=tenant_id,
        name=f"Test Tenant B {unique_id}",
        slug=tenant_id,
        status=TenantStatus.ACTIVE,
    )
    async_session.add(tenant)
    await async_session.flush()
    return tenant


@pytest_asyncio.fixture
async def smoke_test_technician(async_session, smoke_test_tenant):
    """Create smoke test technician user for Phase 1 smoke tests.

    Generates unique technician for each test run to ensure proper isolation.
    """
    from uuid import uuid4

    from dotmac.platform.user_management.models import User

    # Generate unique ID for this technician
    technician_id = uuid4()

    technician = User(
        id=technician_id,
        tenant_id=smoke_test_tenant.id,
        email=f"technician-{uuid4().hex[:8]}@smoke-test.com",
        username=f"smoke_tech_{uuid4().hex[:8]}",
        full_name="Test Technician",
        password_hash="$2b$12$dummy_hash_for_test_user_only",  # Dummy password hash for testing
        is_active=True,
    )
    async_session.add(technician)
    await async_session.flush()
    return technician


@pytest_asyncio.fixture
async def smoke_test_customer(async_session, smoke_test_tenant):
    """Create smoke test customer for Phase 1 smoke tests.

    Generates unique customer for each test run to ensure proper isolation.
    """
    from uuid import uuid4

    from dotmac.platform.customer_management.models import Customer

    # Generate unique ID for this customer
    customer_id = uuid4()
    unique_suffix = uuid4().hex[:8]

    customer = Customer(
        id=customer_id,
        tenant_id=smoke_test_tenant.id,
        customer_number=f"CUST-SMOKE-{unique_suffix.upper()}",
        email=f"customer-{unique_suffix}@smoke-test.com",
        first_name="Test",
        last_name="Customer",
        phone="+1234567890",
        created_by=str(customer_id),
    )
    async_session.add(customer)
    await async_session.flush()
    return customer


@pytest_asyncio.fixture
async def subscriber_factory(async_session):
    """
    Subscriber factory for integration tests.

    Uses the SubscriberFactory from tests/subscribers/conftest.py
    with automatic cleanup after each test.
    """
    from tests.subscribers.conftest import SubscriberFactory

    factory = SubscriberFactory(async_session)
    yield factory
    await factory.cleanup_all()


@pytest_asyncio.fixture
async def smoke_test_subscriber(subscriber_factory, smoke_test_tenant, smoke_test_customer):
    """
    Create smoke test subscriber for RADIUS integration tests.

    Generates unique subscriber for each test run to ensure proper isolation.
    """
    from uuid import uuid4

    from dotmac.platform.subscribers.models import SubscriberStatus

    # Generate unique ID for this subscriber
    unique_suffix = uuid4().hex[:8]

    subscriber = await subscriber_factory.create(
        id=f"sub_smoke_{unique_suffix}",
        tenant_id=smoke_test_tenant.id,
        customer_id=smoke_test_customer.id,
        username=f"smoke_user_{unique_suffix}",
        subscriber_number=f"SUB-SMOKE-{unique_suffix.upper()}",
        status=SubscriberStatus.ACTIVE,
    )
    return subscriber


@pytest_asyncio.fixture
async def async_client(test_tenant_id, test_tenant, mock_user_info, async_session):
    """
    Async HTTP client for integration tests.

    Includes default tenant ID header to pass tenant middleware validation.
    Adds authentication overrides to bypass real auth for testing.
    Adds database session override to use test PostgreSQL database.
    Ensures test tenant exists in database before making requests.
    """
    from fastapi import Request
    from httpx import ASGITransport, AsyncClient

    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.auth.dependencies import get_current_user, get_current_user_optional
    from dotmac.platform.database import get_async_session as get_async_session_database
    from dotmac.platform.db import get_async_session as get_async_session_db
    from dotmac.platform.db import get_session_dependency
    from dotmac.platform.main import app

    # Override authentication dependencies for testing
    async def override_get_current_user(request: Request) -> UserInfo:
        """Override to return mock user for all authenticated requests."""
        return mock_user_info

    async def override_get_current_user_optional(request: Request) -> UserInfo | None:
        """Override to return mock user for optional auth requests."""
        return mock_user_info

    # Override database session to use test PostgreSQL database
    async def override_get_session_dependency():
        """Override to return test database session."""
        yield async_session

    async def override_get_async_session():
        """Override to return test database session (used by billing/dunning modules)."""
        yield async_session

    # Preserve any existing overrides installed by the base test fixture
    original_overrides = dict(app.dependency_overrides)

    app.dependency_overrides.update(
        {
            get_current_user: override_get_current_user,
            get_current_user_optional: override_get_current_user_optional,
            get_session_dependency: override_get_session_dependency,
            get_async_session_db: override_get_async_session,
            get_async_session_database: override_get_async_session,
        }
    )

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://test", headers={"X-Tenant-ID": test_tenant_id}
        ) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)


@pytest.fixture
def auth_headers(test_tenant_id, mock_user_info):
    """
    Authentication headers for integration tests.

    Includes tenant ID and mock bearer token.
    """
    return {
        "X-Tenant-ID": test_tenant_id,
        "Authorization": f"Bearer mock-token-{mock_user_info.user_id}",
    }
