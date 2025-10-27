"""
Integration Tests Configuration

Shared fixtures and configuration for integration tests.
"""

import asyncio

import pytest
import pytest_asyncio


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


@pytest_asyncio.fixture
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


@pytest.fixture
def test_tenant_id():
    """Test tenant ID for integration tests."""
    return "integration-test-tenant"


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
