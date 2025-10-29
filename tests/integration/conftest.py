"""
Integration Tests Configuration

Shared fixtures and configuration for integration tests.
"""

import asyncio
import os

import pytest
import pytest_asyncio

# Override production .env settings for integration tests
# The .env file has TENANT_MODE=multi, but integration tests should not require tenant headers
os.environ["REQUIRE_TENANT_HEADER"] = "false"

# Reinitialize tenant configuration to pick up the new environment variable
from dotmac.platform.tenant.config import TenantConfiguration, set_tenant_config
set_tenant_config(TenantConfiguration())


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


@pytest_asyncio.fixture
async def smoke_test_tenant(async_session):
    """Create smoke test tenant for Phase 1 smoke tests.

    Checks if tenant already exists to avoid duplicate key errors in PostgreSQL.
    """
    from dotmac.platform.tenant.models import Tenant, TenantStatus
    from sqlalchemy import select

    # Check if tenant already exists (PostgreSQL persists data across function-scoped fixtures)
    result = await async_session.execute(
        select(Tenant).where(Tenant.id == "smoke-test-tenant")
    )
    existing_tenant = result.scalar_one_or_none()

    if existing_tenant:
        return existing_tenant

    tenant = Tenant(
        id="smoke-test-tenant",
        name="Smoke Test Tenant",
        slug="smoke-test-tenant",
        status=TenantStatus.ACTIVE,
    )
    async_session.add(tenant)
    await async_session.flush()
    return tenant


@pytest_asyncio.fixture
async def smoke_test_technician(async_session, smoke_test_tenant):
    """Create smoke test technician user for Phase 1 smoke tests.

    Checks if technician already exists to avoid duplicate key errors in PostgreSQL.
    """
    from uuid import UUID
    from dotmac.platform.user_management.models import User
    from sqlalchemy import select

    # Use a fixed UUID for the technician so tests can reference it
    technician_id = UUID("4d423237-7c7a-4597-b9f6-edc828cc76af")

    # Check if technician already exists (PostgreSQL persists data across function-scoped fixtures)
    result = await async_session.execute(
        select(User).where(User.id == technician_id)
    )
    existing_technician = result.scalar_one_or_none()

    if existing_technician:
        return existing_technician

    technician = User(
        id=technician_id,
        tenant_id="smoke-test-tenant",
        email="technician@smoke-test.com",
        username="smoke_technician",
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

    Checks if customer already exists to avoid duplicate key errors in PostgreSQL.
    """
    from uuid import UUID
    from dotmac.platform.customer_management.models import Customer
    from sqlalchemy import select

    # Use a fixed UUID for the customer so tests can reference it
    customer_id = UUID("f1840091-ed2c-4eab-b6ed-45943a394ecd")

    # Check if customer already exists (PostgreSQL persists data across function-scoped fixtures)
    result = await async_session.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    existing_customer = result.scalar_one_or_none()

    if existing_customer:
        return existing_customer

    customer = Customer(
        id=customer_id,
        tenant_id="smoke-test-tenant",
        customer_number="CUST-SMOKE-TEST",
        email="customer@smoke-test.com",
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

    Uses fixed ID for existence check pattern - allows tests to run multiple times
    without creating duplicate records in PostgreSQL.
    """
    from dotmac.platform.subscribers.models import SubscriberStatus

    # Create subscriber with fixed ID for smoke tests
    subscriber = await subscriber_factory.create(
        id="sub_smoke_test_001",
        tenant_id="smoke-test-tenant",
        customer_id=smoke_test_customer.id,
        username="smoke_test_user",
        subscriber_number="SUB-SMOKE-001",
        status=SubscriberStatus.ACTIVE,
    )
    return subscriber


@pytest_asyncio.fixture
async def async_client(test_tenant_id):
    """
    Async HTTP client for integration tests.

    Includes default tenant ID header to pass tenant middleware validation.
    """
    from httpx import ASGITransport, AsyncClient
    from dotmac.platform.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"X-Tenant-ID": test_tenant_id}
    ) as client:
        yield client


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
