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

    # Delete test data from integration tests
    # Use raw SQL for efficiency and to avoid ORM complications
    from sqlalchemy import text

    cleanup_queries = [
        # WireGuard cleanup (test tenants and smoke test tenant)
        "DELETE FROM wireguard_peers WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",
        "DELETE FROM wireguard_servers WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",

        # RADIUS cleanup
        "DELETE FROM subscribers WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%' OR subscriber_id LIKE '%test%'",
        "DELETE FROM radcheck WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",
        "DELETE FROM radreply WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",
        "DELETE FROM radacct WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",
        "DELETE FROM radpostauth WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",
        "DELETE FROM nas WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",
        "DELETE FROM bandwidth_profiles WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",

        # Customers cleanup
        "DELETE FROM customers WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%'",

        # NetBox/IP allocation cleanup (if exists)
        "DELETE FROM ip_allocations WHERE tenant_id LIKE 'test-%' OR tenant_id LIKE '%test%' OR subscriber_id LIKE '%test%'",
    ]

    for query in cleanup_queries:
        try:
            await async_db_session.execute(text(query))
        except Exception:
            # Table might not exist or query might fail - continue cleanup
            pass

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
