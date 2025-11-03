"""Test database fixtures for billing service tests.

Provides in-memory SQLite database for fast, isolated testing.
"""

import pytest
import pytest_asyncio
from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from dotmac.platform.billing.bank_accounts.entities import (  # noqa: F401
    CompanyBankAccount,
    ManualPayment,
)

# Import billing entity classes to register them with SQLAlchemy Base.metadata
# This ensures all billing tables are created in the test database
from dotmac.platform.billing.core.entities import (  # noqa: F401
    CreditApplicationEntity,
    CreditNoteEntity,
    CreditNoteLineItemEntity,
    CustomerCreditEntity,
    InvoiceEntity,
    InvoiceLineItemEntity,
    PaymentEntity,
    PaymentInvoiceEntity,
    PaymentMethodEntity,
    TransactionEntity,
)
from dotmac.platform.db import Base

pytestmark = pytest.mark.integration


@pytest.fixture(scope="function")
def sync_test_engine():
    """Create synchronous in-memory SQLite engine for schema creation."""
    # Use a file-based SQLite DB for testing to share between sync and async
    import os
    import tempfile

    # Create a temporary file for the test database
    fd, db_path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )

    # Enable foreign keys for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    yield engine

    # Cleanup
    engine.dispose()
    try:
        os.unlink(db_path)
    except (OSError, PermissionError):
        pass


@pytest.fixture(scope="function")
def async_test_engine(sync_test_engine):
    """Create async engine sharing the same database file as sync engine."""
    # Extract the database path from sync engine URL
    db_path = str(sync_test_engine.url).replace("sqlite:///", "")

    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )
    return engine


@pytest_asyncio.fixture
async def test_db_session(sync_test_engine, async_test_engine):
    """
    Create test database session with schema.

    Uses sync engine to create schema, then provides async session for tests.
    """
    # Create all tables using sync engine
    print(f"\nTables to create: {list(Base.metadata.tables.keys())}")
    Base.metadata.create_all(sync_test_engine)
    print("Tables created successfully")

    # Create async session factory
    async_session_maker = async_sessionmaker(
        async_test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Provide session for test
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    # Cleanup
    await async_test_engine.dispose()


@pytest.fixture
def test_tenant_id():
    """Standard test tenant ID."""
    return "test_tenant_1"


@pytest.fixture
def test_customer_id():
    """Standard test customer ID."""
    return "test_customer_1"
