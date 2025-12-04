"""
RLS Test Helpers - Fixtures for Testing with Row-Level Security

This module provides pytest fixtures to help existing tests work with RLS enabled.
Import these fixtures in your test conftest.py files.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.core.rls_middleware import RLSContextManager


async def _supports_rls(db_session: AsyncSession | None) -> bool:
    """Return True if the current database dialect supports RLS control statements."""
    if db_session is None:
        return False
    bind = db_session.bind
    if bind is not None:
        return bind.dialect.name != "sqlite"

    async with db_session.connection() as connection:
        return connection.engine.dialect.name != "sqlite"


@pytest.fixture
async def bypass_rls_for_tests(db_session: AsyncSession):
    """
    Fixture to bypass RLS for test setup and teardown.

    Use this fixture when you need to create test data across multiple tenants
    or when you need to access data without tenant filtering.

    Usage:
        @pytest.mark.asyncio
        async def test_something(db_session, bypass_rls_for_tests):
            # RLS is bypassed - can create data for any tenant
            customer = Customer(tenant_id="tenant-123", ...)
            db_session.add(customer)
            await db_session.commit()
    """
    if not await _supports_rls(db_session):
        yield
        return

    await db_session.execute(text("SET LOCAL app.bypass_rls = true"))
    await db_session.commit()

    yield

    # Reset after test
    await db_session.execute(text("RESET app.bypass_rls"))
    await db_session.commit()


@pytest.fixture
async def rls_tenant_context(db_session: AsyncSession):
    """
    Fixture factory to set RLS context for a specific tenant.

    Returns a context manager that sets the tenant context for RLS.

    Usage:
        @pytest.mark.asyncio
        async def test_something(db_session, rls_tenant_context):
            async with rls_tenant_context("tenant-123"):
                # All queries are filtered by tenant-123
                customers = await db_session.execute(select(Customer))
    """

    async def _set_tenant_context(tenant_id: str):
        return RLSContextManager(db_session, tenant_id=tenant_id)

    return _set_tenant_context


@pytest.fixture
async def rls_superuser_context(db_session: AsyncSession):
    """
    Fixture to set superuser context for admin operations in tests.

    Usage:
        @pytest.mark.asyncio
        async def test_admin_operation(db_session, rls_superuser_context):
            async with rls_superuser_context:
                # Can access all tenants' data
                all_customers = await db_session.execute(select(Customer))
    """
    return RLSContextManager(db_session, is_superuser=True)


@pytest.fixture(autouse=True)
async def auto_bypass_rls_for_all_tests(request):
    """
    Auto-fixture that bypasses RLS for ALL tests by default.

    This is useful during migration period while updating tests.
    Once all tests are RLS-aware, this fixture can be removed.

    To opt-in to RLS for specific tests, use the marker:
        @pytest.mark.rls_enabled
        async def test_with_rls(db_session):
            # RLS is active in this test
            ...
    """
    # Skip for E2E tests to avoid interfering with their isolated DB fixtures
    if hasattr(request.node, "nodeid") and "tests/e2e/" in request.node.nodeid:
        yield
        return

    # Check if test wants RLS enabled
    if request.node.get_closest_marker("rls_enabled"):
        # Don't bypass RLS for this test
        yield
        return

    # Try to get db_session from the request's fixtures - it may not exist
    db_session = None
    if hasattr(request, "fixturenames") and "db_session" in request.fixturenames:
        try:
            db_session = request.getfixturevalue("db_session")
        except Exception:
            pass

    # If no db_session, skip RLS bypass
    if db_session is None:
        yield
        return

    # Check if db_session is actually an async session by checking for sync_session attribute
    # Sync sessions don't have async execute methods
    if not hasattr(db_session, "sync_session"):
        # This is a sync session, skip RLS bypass
        yield
        return

    if not await _supports_rls(db_session):
        yield
        return

    # Bypass RLS for all other tests
    try:
        await db_session.execute(text("SET LOCAL app.bypass_rls = true"))
        await db_session.commit()
        yield
    finally:
        try:
            await db_session.execute(text("RESET app.bypass_rls"))
            await db_session.commit()
        except Exception:
            # Ignore errors during cleanup - session might already be closed
            pass


# Custom pytest markers
def pytest_configure(config):
    """Register custom markers for RLS testing."""
    config.addinivalue_line(
        "markers", "rls_enabled: mark test to run with RLS enabled (default is bypassed)"
    )
    config.addinivalue_line(
        "markers", "rls_tenant(id): mark test to run with specific tenant context"
    )
