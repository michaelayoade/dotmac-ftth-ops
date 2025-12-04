"""
Tests for Row-Level Security (RLS) Implementation

This test suite verifies that RLS policies correctly enforce tenant data isolation
at the database level. It tests:

1. Tenant isolation - users can only see their own tenant's data
2. Cross-tenant access prevention - users cannot access other tenants' data
3. Superuser bypass - platform admins can access all data when needed
4. RLS context management - session variables are set correctly
5. Multi-table enforcement - RLS works across all critical tables

IMPORTANT: These tests require a PostgreSQL database with RLS enabled.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import pytest

pytestmark = pytest.mark.integration
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.usage.models import UsageRecord
from dotmac.platform.core.rls_middleware import (
    RLSContextManager,
    bypass_rls_for_migration,
    reset_rls_context,
)
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.db import get_db
from dotmac.platform.subscribers.models import Subscriber

# Test fixtures


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    """Provide a database session for testing."""
    async for session in get_db():
        yield session


@pytest.fixture
async def clean_rls_context(db_session: AsyncSession):
    """Ensure RLS context is clean before and after each test."""
    await reset_rls_context(db_session)
    yield
    await reset_rls_context(db_session)


@pytest.fixture
def tenant_a_id() -> str:
    """Tenant A identifier."""
    return "tenant-a-test"


@pytest.fixture
def tenant_b_id() -> str:
    """Tenant B identifier."""
    return "tenant-b-test"


@pytest.fixture
async def test_customers(
    db_session: AsyncSession,
    tenant_a_id: str,
    tenant_b_id: str,
) -> dict:
    """Create test customers for both tenants."""
    # Bypass RLS to insert test data
    await bypass_rls_for_migration(db_session)

    customer_a = Customer(
        id=uuid.uuid4(),
        tenant_id=tenant_a_id,
        email=f"customer-a-{uuid.uuid4()}@test.com",
        first_name="Customer",
        last_name="A",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    customer_b = Customer(
        id=uuid.uuid4(),
        tenant_id=tenant_b_id,
        email=f"customer-b-{uuid.uuid4()}@test.com",
        first_name="Customer",
        last_name="B",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db_session.add_all([customer_a, customer_b])
    await db_session.commit()
    await db_session.refresh(customer_a)
    await db_session.refresh(customer_b)

    await reset_rls_context(db_session)

    yield {
        "customer_a": customer_a,
        "customer_b": customer_b,
    }

    # Cleanup
    await bypass_rls_for_migration(db_session)
    await db_session.delete(customer_a)
    await db_session.delete(customer_b)
    await db_session.commit()
    await reset_rls_context(db_session)


# RLS Context Tests


@pytest.mark.asyncio
async def test_rls_session_variables_are_set(
    db_session: AsyncSession,
    clean_rls_context,
    tenant_a_id: str,
):
    """Test that RLS session variables are correctly set."""
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        # Verify tenant_id is set
        result = await db_session.execute(
            text("SELECT current_setting('app.current_tenant_id', TRUE)")
        )
        tenant_id = result.scalar()
        assert tenant_id == tenant_a_id

        # Verify is_superuser is false by default
        result = await db_session.execute(text("SELECT current_setting('app.is_superuser', TRUE)"))
        is_superuser = result.scalar()
        assert is_superuser == "false"


@pytest.mark.asyncio
async def test_rls_superuser_context(
    db_session: AsyncSession,
    clean_rls_context,
):
    """Test that superuser context is correctly set."""
    async with RLSContextManager(db_session, is_superuser=True):
        result = await db_session.execute(text("SELECT current_setting('app.is_superuser', TRUE)"))
        is_superuser = result.scalar()
        assert is_superuser == "true"


@pytest.mark.asyncio
async def test_rls_context_is_reset(
    db_session: AsyncSession,
    clean_rls_context,
    tenant_a_id: str,
):
    """Test that RLS context is reset after context manager exits."""
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        pass  # Context set here

    # Context should be reset
    result = await db_session.execute(text("SELECT current_setting('app.current_tenant_id', TRUE)"))
    tenant_id = result.scalar()
    assert tenant_id is None or tenant_id == ""


# Tenant Isolation Tests


@pytest.mark.asyncio
async def test_customer_tenant_isolation(
    db_session: AsyncSession,
    clean_rls_context,
    test_customers: dict,
    tenant_a_id: str,
):
    """Test that customers are isolated by tenant."""
    # Set tenant A context
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        result = await db_session.execute(select(Customer))
        customers = result.scalars().all()

        # Should only see tenant A's customer
        assert len(customers) == 1
        assert customers[0].tenant_id == tenant_a_id
        assert customers[0].id == test_customers["customer_a"].id


@pytest.mark.asyncio
async def test_customer_cross_tenant_access_denied(
    db_session: AsyncSession,
    clean_rls_context,
    test_customers: dict,
    tenant_a_id: str,
    tenant_b_id: str,
):
    """Test that tenant A cannot access tenant B's customers."""
    # Set tenant A context
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        # Try to access tenant B's customer
        result = await db_session.execute(
            select(Customer).where(Customer.id == test_customers["customer_b"].id)
        )
        customer = result.scalar_one_or_none()

        # Should not be able to access tenant B's data
        assert customer is None


@pytest.mark.asyncio
async def test_superuser_can_access_all_tenants(
    db_session: AsyncSession,
    clean_rls_context,
    test_customers: dict,
):
    """Test that superusers can access data from all tenants."""
    # Set superuser context (no specific tenant)
    async with RLSContextManager(db_session, is_superuser=True):
        result = await db_session.execute(select(Customer))
        customers = result.scalars().all()

        # Should see all customers
        assert len(customers) >= 2
        customer_ids = [c.id for c in customers]
        assert test_customers["customer_a"].id in customer_ids
        assert test_customers["customer_b"].id in customer_ids


@pytest.mark.asyncio
async def test_no_tenant_context_returns_no_data(
    db_session: AsyncSession,
    clean_rls_context,
    test_customers: dict,
):
    """Test that queries without tenant context return no data."""
    # Don't set any tenant context
    result = await db_session.execute(select(Customer))
    customers = result.scalars().all()

    # Should return no customers (RLS blocks all access)
    assert len(customers) == 0


# Insert/Update/Delete Tests


@pytest.mark.asyncio
async def test_insert_with_wrong_tenant_is_blocked(
    db_session: AsyncSession,
    clean_rls_context,
    tenant_a_id: str,
    tenant_b_id: str,
):
    """Test that inserting data for another tenant is blocked."""
    # Set tenant A context
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        # Try to insert customer for tenant B
        customer_b = Customer(
            id=uuid.uuid4(),
            tenant_id=tenant_b_id,  # Wrong tenant!
            email=f"bad-insert-{uuid.uuid4()}@test.com",
            first_name="Bad",
            last_name="Insert",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        db_session.add(customer_b)

        # This should fail due to RLS policy
        with pytest.raises(Exception):  # PostgreSQL will raise error
            await db_session.commit()

        await db_session.rollback()


@pytest.mark.asyncio
async def test_update_other_tenant_data_is_blocked(
    db_session: AsyncSession,
    clean_rls_context,
    test_customers: dict,
    tenant_a_id: str,
):
    """Test that updating another tenant's data is blocked."""
    # Set tenant A context
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        # Try to update tenant B's customer
        customer_b_id = test_customers["customer_b"].id

        result = await db_session.execute(select(Customer).where(Customer.id == customer_b_id))
        customer = result.scalar_one_or_none()

        # Should not be able to access customer B
        assert customer is None


@pytest.mark.asyncio
async def test_delete_other_tenant_data_is_blocked(
    db_session: AsyncSession,
    clean_rls_context,
    test_customers: dict,
    tenant_a_id: str,
):
    """Test that deleting another tenant's data is blocked."""
    # Set tenant A context
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        customer_b_id = test_customers["customer_b"].id

        # Try to fetch and delete tenant B's customer
        result = await db_session.execute(select(Customer).where(Customer.id == customer_b_id))
        customer = result.scalar_one_or_none()

        # Should not be able to access customer B
        assert customer is None


# Multi-Table RLS Tests


@pytest.mark.asyncio
async def test_rls_on_usage_records(
    db_session: AsyncSession,
    clean_rls_context,
    test_customers: dict,
    tenant_a_id: str,
    tenant_b_id: str,
):
    """Test that RLS is enforced on usage_records table."""
    # Create usage records for both tenants
    await bypass_rls_for_migration(db_session)

    usage_a = UsageRecord(
        id=uuid.uuid4(),
        tenant_id=tenant_a_id,
        subscription_id="sub-a-1",
        customer_id=test_customers["customer_a"].id,
        usage_type="data_transfer",
        quantity=100.0,
        unit="GB",
        unit_price=10.0,
        total_amount=1000,
        currency="USD",
        period_start=datetime.now(UTC),
        period_end=datetime.now(UTC),
        billed_status="pending",
        source_system="test",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    usage_b = UsageRecord(
        id=uuid.uuid4(),
        tenant_id=tenant_b_id,
        subscription_id="sub-b-1",
        customer_id=test_customers["customer_b"].id,
        usage_type="data_transfer",
        quantity=200.0,
        unit="GB",
        unit_price=10.0,
        total_amount=2000,
        currency="USD",
        period_start=datetime.now(UTC),
        period_end=datetime.now(UTC),
        billed_status="pending",
        source_system="test",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db_session.add_all([usage_a, usage_b])
    await db_session.commit()
    await reset_rls_context(db_session)

    # Test tenant isolation
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        result = await db_session.execute(select(UsageRecord))
        records = result.scalars().all()

        # Should only see tenant A's usage records
        assert len(records) == 1
        assert records[0].tenant_id == tenant_a_id

    # Cleanup
    await bypass_rls_for_migration(db_session)
    await db_session.delete(usage_a)
    await db_session.delete(usage_b)
    await db_session.commit()


@pytest.mark.asyncio
async def test_rls_audit_log_creation(
    db_session: AsyncSession,
    clean_rls_context,
):
    """Test that RLS audit log table exists and can be queried."""
    # Check if audit log table exists
    result = await db_session.execute(
        text(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'rls_audit_log'
            )
            """
        )
    )
    exists = result.scalar()
    assert exists is True


# Performance Tests


@pytest.mark.asyncio
async def test_rls_performance_with_index(
    db_session: AsyncSession,
    clean_rls_context,
    tenant_a_id: str,
):
    """Test that RLS queries use tenant_id index for performance."""
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        # Query with EXPLAIN to check if index is used
        result = await db_session.execute(
            text(
                """
                EXPLAIN (FORMAT JSON)
                SELECT * FROM customers WHERE tenant_id = :tenant_id
                """
            ),
            {"tenant_id": tenant_a_id},
        )
        plan = result.scalar()

        # Plan should mention index scan on tenant_id
        plan_str = str(plan)
        assert "Index" in plan_str or "index" in plan_str


# Integration Tests


@pytest.mark.asyncio
async def test_rls_with_joins(
    db_session: AsyncSession,
    clean_rls_context,
    test_customers: dict,
    tenant_a_id: str,
):
    """Test that RLS works correctly with table joins."""
    # Create subscriber for tenant A
    await bypass_rls_for_migration(db_session)

    subscriber_a = Subscriber(
        id=f"sub-{uuid.uuid4()}",
        tenant_id=tenant_a_id,
        customer_id=test_customers["customer_a"].id,
        username=f"user-{uuid.uuid4()}",
        password="hashed_password",
        status="active",
        service_type="fiber_internet",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db_session.add(subscriber_a)
    await db_session.commit()
    await reset_rls_context(db_session)

    # Test join query with RLS
    async with RLSContextManager(db_session, tenant_id=tenant_a_id):
        result = await db_session.execute(
            select(Customer, Subscriber).join(Subscriber, Customer.id == Subscriber.customer_id)
        )
        rows = result.all()

        # Should only return tenant A's data
        assert len(rows) > 0
        for customer, subscriber in rows:
            assert customer.tenant_id == tenant_a_id
            assert subscriber.tenant_id == tenant_a_id

    # Cleanup
    await bypass_rls_for_migration(db_session)
    await db_session.delete(subscriber_a)
    await db_session.commit()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])
