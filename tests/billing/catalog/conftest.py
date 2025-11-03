"""
Fixtures for billing catalog tests.

Provides database session, authentication, and test data fixtures.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.billing import models as billing_models  # noqa: F401

# Import catalog-related ORM models so SQLAlchemy registers the tables on Base.metadata
from dotmac.platform.billing.catalog import models as catalog_models  # noqa: F401

# Import billing models to ensure they're registered with Base.metadata
from dotmac.platform.db import Base
from dotmac.platform.main import app


@pytest.fixture(autouse=True)
def billing_catalog_test_environment(monkeypatch):
    monkeypatch.setenv("TESTING", "1")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Create test database session."""
    async_session_maker = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    session = async_session_maker()
    try:
        yield session
    finally:
        await session.close()


@pytest.fixture
def tenant_id():
    """Standard tenant ID for catalog tests."""
    return "test-tenant-123"


@pytest.fixture
def customer_id():
    """Standard customer ID for catalog tests."""
    return "customer-456"


@pytest.fixture
def user_id():
    """Standard user ID for catalog tests."""
    return "user-789"


@pytest.fixture
def mock_current_user(user_id, tenant_id):
    """Mock current user for authentication."""
    return UserInfo(
        user_id=user_id,
        tenant_id=tenant_id,
        email="test@example.com",
        username="testuser",
        roles=["admin"],
        permissions=["catalog:write", "catalog:read"],
    )


@pytest.fixture
def auth_headers():
    """Mock authentication headers."""
    return {"Authorization": "Bearer test-token", "X-Tenant-ID": "test-tenant-123"}


@pytest_asyncio.fixture
async def async_client(db_session, mock_current_user, tenant_id):
    """Create async HTTP client for API tests."""
    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.db import get_async_session
    from dotmac.platform.tenant import get_current_tenant_id

    # Override dependencies
    app.dependency_overrides[get_async_session] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    # Clear overrides
    app.dependency_overrides.clear()
