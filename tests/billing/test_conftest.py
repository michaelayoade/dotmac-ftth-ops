"""
Test database configuration for billing tests.

Provides isolated database setup to prevent table conflicts.
"""

import os
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment to prevent accidental database operations


pytestmark = pytest.mark.unit

os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db_engine():
    """Create an in-memory SQLite database for testing."""

    # Create in-memory database with StaticPool to ensure single connection
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Enable foreign keys for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def test_db_metadata():
    """Create fresh metadata instance for each test."""

    # Create new metadata instance
    metadata = MetaData()

    # Clear any existing table definitions
    metadata.clear()

    return metadata


@pytest.fixture(scope="function")
def test_db_session(test_db_engine, test_db_metadata):
    """Create a test database session."""

    # Create all tables in the test database
    test_db_metadata.create_all(test_db_engine)

    # Create session factory
    SessionLocal = sessionmaker(bind=test_db_engine)

    # Create session
    session = SessionLocal()

    yield session

    # Cleanup
    session.close()
    test_db_metadata.drop_all(test_db_engine)


@pytest.fixture(scope="function")
def isolated_db_session():
    """Create completely isolated mock database session."""
    session = AsyncMock()
    session.add = MagicMock()
    session.delete = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    session.scalars = AsyncMock()
    session.close = AsyncMock()

    # Mock query results
    mock_result = MagicMock()
    mock_result.scalar.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalars.return_value.first.return_value = None
    mock_result.all.return_value = []
    mock_result.first.return_value = None
    mock_result.one.return_value = None
    mock_result.one_or_none.return_value = None

    session.execute.return_value = mock_result
    return session


@pytest.fixture(autouse=True)
def reset_sqlalchemy_state():
    """Reset SQLAlchemy state between tests to prevent conflicts."""
    # Import here to avoid circular dependencies
    from sqlalchemy.orm import clear_mappers

    yield

    # Clear all mappers after each test
    clear_mappers()


@pytest.fixture(autouse=True)
def mock_database_imports(monkeypatch):
    """Mock database imports to prevent real database connections."""

    # Mock the get_async_session function
    async def mock_get_async_session():
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        return session

    # Apply the mock globally
    monkeypatch.setattr("dotmac.platform.db.get_async_session", mock_get_async_session)

    # Mock BaseModel to prevent table registration
    class MockBaseModel:
        __abstract__ = True
        __tablename__ = None
        __table_args__ = {"extend_existing": True}

        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)

    monkeypatch.setattr("dotmac.platform.db.BaseModel", MockBaseModel)


@pytest.fixture
def clean_imports(monkeypatch):
    """Clean module imports to prevent conflicts."""
    import sys

    # List of modules to remove from cache
    modules_to_clean = [
        "dotmac.platform.billing.models",
        "dotmac.platform.billing.catalog.models",
        "dotmac.platform.billing.subscriptions.models",
        "dotmac.platform.billing.pricing.models",
        "dotmac.platform.billing.integration",
    ]

    # Store original modules
    original_modules = {}
    for module in modules_to_clean:
        if module in sys.modules:
            original_modules[module] = sys.modules[module]
            del sys.modules[module]

    yield

    # Restore original modules
    for module, original in original_modules.items():
        sys.modules[module] = original


def pytest_configure(config):
    """Configure pytest for billing tests."""
    # Add custom markers
    config.addinivalue_line("markers", "billing: mark test as billing-related")
    config.addinivalue_line("markers", "db_isolated: mark test as requiring database isolation")


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add automatic markers."""
    for item in items:
        # Add billing marker to all tests in billing directory
        if "billing" in str(item.fspath):
            item.add_marker(pytest.mark.billing)

        # Add db_isolated marker to tests that use database
        if "test_db" in item.fixturenames or "db_session" in item.fixturenames:
            item.add_marker(pytest.mark.db_isolated)
