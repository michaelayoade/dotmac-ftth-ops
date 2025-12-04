"""Test fixtures for partner management tests."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from dotmac.platform.auth.models import user_roles  # noqa: F401
from dotmac.platform.billing.core.entities import InvoiceEntity  # noqa: F401
from dotmac.platform.db import Base
from dotmac.platform.tenant import set_current_tenant_id
from dotmac.platform.user_management.models import User  # noqa: F401
from tests.test_utils import TenantContext

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def partner_management_test_environment(monkeypatch):
    monkeypatch.setenv("TESTING", "1")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")


# Import partner management models to ensure they're registered


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

    async with async_session_maker() as session:
        try:
            yield session
        finally:
            try:
                await session.rollback()
            except Exception:
                pass


@pytest.fixture
def test_tenant_id():
    """Generate a test tenant ID."""
    return "test-tenant-123"


@pytest.fixture
def tenant_context(test_tenant_id):
    """Provide tenant context fixture expected by partner tests."""
    previous = TenantContext().current
    set_current_tenant_id(test_tenant_id)
    context = TenantContext(test_tenant_id)
    try:
        yield context
    finally:
        set_current_tenant_id(previous)


@pytest_asyncio.fixture
async def async_client(db_session):
    """Create async test client."""
    from httpx import ASGITransport, AsyncClient

    # Override database dependency
    from dotmac.platform.db import get_async_session
    from dotmac.platform.main import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_async_session] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
