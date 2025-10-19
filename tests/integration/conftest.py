"""
Integration Tests Configuration

Shared fixtures and configuration for integration tests.
"""

import pytest
import asyncio


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


@pytest.fixture
async def cleanup_db(async_db_session):
    """
    Cleanup database after each test.

    Ensures test isolation by clearing data between tests.
    """
    yield

    # Rollback any uncommitted changes
    await async_db_session.rollback()

    # Clear all test data
    # This is handled by the test fixtures in conftest.py
    # which use function-scoped sessions
