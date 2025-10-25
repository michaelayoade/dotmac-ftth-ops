"""Test fixtures for partner management tests."""

import os

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Set test environment
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

from dotmac.platform.db import Base
from dotmac.platform.auth.models import user_roles  # noqa: F401
from dotmac.platform.user_management.models import User  # noqa: F401
from dotmac.platform.billing.core.entities import InvoiceEntity  # noqa: F401
from dotmac.platform.tenant import set_current_tenant_id
from tests.test_utils import TenantContext

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
