# RLS Testing Guide

**How to Update Existing Tests to Work with Row-Level Security**

---

## Overview

After enabling RLS, existing tests may fail because they don't set tenant context. This guide shows how to update tests to work with RLS enabled.

---

## Quick Fix: Auto-Bypass RLS (Temporary)

**File:** `tests/conftest.py`

Add this to your root conftest:

```python
# Add this import at the top
from tests.conftest_rls_helpers import auto_bypass_rls_for_all_tests

# The auto_bypass_rls_for_all_tests fixture is automatically applied
# All existing tests will bypass RLS by default
```

This allows existing tests to continue working while you gradually update them.

---

## Updating Tests: 3 Patterns

### Pattern 1: Test Data Setup (Use Bypass)

For creating test data across tenants:

```python
@pytest.mark.asyncio
async def test_customer_creation(db_session, bypass_rls_for_tests):
    """Test customer creation - bypass RLS for setup."""

    # Create customers for different tenants (RLS bypassed)
    customer_a = Customer(tenant_id="tenant-a", email="a@example.com")
    customer_b = Customer(tenant_id="tenant-b", email="b@example.com")

    db_session.add_all([customer_a, customer_b])
    await db_session.commit()

    # Verify both were created
    result = await db_session.execute(select(Customer))
    assert len(result.scalars().all()) == 2
```

### Pattern 2: Test Business Logic (Use Tenant Context)

For testing actual business logic with RLS:

```python
@pytest.mark.asyncio
@pytest.mark.rls_enabled  # Explicitly enable RLS for this test
async def test_customer_isolation(db_session, rls_tenant_context, bypass_rls_for_tests):
    """Test that customers are isolated by tenant."""

    # Setup: Create test data (bypass RLS)
    customer_a = Customer(tenant_id="tenant-a", email="a@example.com")
    customer_b = Customer(tenant_id="tenant-b", email="b@example.com")

    db_session.add_all([customer_a, customer_b])
    await db_session.commit()

    # Test: Query as tenant-a (RLS enabled)
    async with rls_tenant_context("tenant-a"):
        result = await db_session.execute(select(Customer))
        customers = result.scalars().all()

        # Should only see tenant-a's customer
        assert len(customers) == 1
        assert customers[0].tenant_id == "tenant-a"

    # Test: Query as tenant-b (RLS enabled)
    async with rls_tenant_context("tenant-b"):
        result = await db_session.execute(select(Customer))
        customers = result.scalars().all()

        # Should only see tenant-b's customer
        assert len(customers) == 1
        assert customers[0].tenant_id == "tenant-b"
```

### Pattern 3: Test Admin Operations (Use Superuser Context)

For testing admin/platform operations:

```python
@pytest.mark.asyncio
async def test_admin_customer_report(db_session, rls_superuser_context, bypass_rls_for_tests):
    """Test admin can generate cross-tenant reports."""

    # Setup: Create customers for multiple tenants
    customer_a = Customer(tenant_id="tenant-a", email="a@example.com")
    customer_b = Customer(tenant_id="tenant-b", email="b@example.com")

    db_session.add_all([customer_a, customer_b])
    await db_session.commit()

    # Test: Admin can see all customers
    async with rls_superuser_context:
        result = await db_session.execute(select(Customer))
        all_customers = result.scalars().all()

        # Should see both tenants' customers
        assert len(all_customers) == 2
```

---

## Integration Tests: Update Fixtures

### Before (Without RLS)

```python
@pytest.fixture
async def test_customer(db_session):
    """Create a test customer."""
    customer = Customer(
        tenant_id="test-tenant",
        email="test@example.com",
        first_name="Test",
        last_name="User"
    )
    db_session.add(customer)
    await db_session.commit()
    return customer
```

### After (With RLS)

```python
@pytest.fixture
async def test_customer(db_session, bypass_rls_for_tests):
    """Create a test customer (RLS bypassed for setup)."""
    customer = Customer(
        tenant_id="test-tenant",
        email="test@example.com",
        first_name="Test",
        last_name="User"
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)

    yield customer

    # Cleanup (RLS still bypassed)
    await db_session.delete(customer)
    await db_session.commit()
```

---

## API Endpoint Tests

### Before (Without RLS)

```python
@pytest.mark.asyncio
async def test_get_customers(client, test_customer):
    """Test GET /customers endpoint."""
    response = await client.get("/api/v1/customers")
    assert response.status_code == 200

    customers = response.json()
    assert len(customers) > 0
```

### After (With RLS - Request Sets Context)

```python
@pytest.mark.asyncio
async def test_get_customers(client, test_customer, auth_headers):
    """Test GET /customers endpoint with RLS."""
    # Auth headers include tenant_id in JWT
    # RLS middleware automatically sets tenant context from token

    response = await client.get(
        "/api/v1/customers",
        headers=auth_headers  # Contains tenant-id in JWT
    )
    assert response.status_code == 200

    customers = response.json()
    # Should only see current tenant's customers
    assert all(c["tenant_id"] == "test-tenant" for c in customers)
```

### Auth Headers Fixture

```python
@pytest.fixture
def auth_headers(test_tenant):
    """Generate auth headers with tenant context."""
    from dotmac.platform.auth.core import create_access_token

    token = create_access_token(
        user_id="test-user-id",
        tenant_id=test_tenant.id,  # RLS middleware reads this
        email="test@example.com"
    )

    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": test_tenant.id
    }
```

---

## Common Issues & Solutions

### Issue 1: Tests Return Empty Results

**Problem:**
```python
# Test fails - no customers returned
result = await db_session.execute(select(Customer))
customers = result.scalars().all()
assert len(customers) > 0  # ❌ Fails: len = 0
```

**Solution:**
```python
# Add bypass_rls_for_tests fixture
async def test_something(db_session, bypass_rls_for_tests):
    result = await db_session.execute(select(Customer))
    customers = result.scalars().all()
    assert len(customers) > 0  # ✅ Works
```

### Issue 2: INSERT Operations Fail

**Problem:**
```python
# Fails with RLS policy violation
customer = Customer(tenant_id="tenant-123", ...)
db_session.add(customer)
await db_session.commit()  # ❌ RLS policy violation
```

**Solution:**
```python
# Bypass RLS for test data creation
async def test_something(db_session, bypass_rls_for_tests):
    customer = Customer(tenant_id="tenant-123", ...)
    db_session.add(customer)
    await db_session.commit()  # ✅ Works
```

### Issue 3: Can't Delete Test Data in Teardown

**Problem:**
```python
@pytest.fixture
async def test_data(db_session):
    # Create data (works)
    customer = Customer(...)
    db_session.add(customer)
    await db_session.commit()

    yield customer

    # Cleanup fails - can't delete
    await db_session.delete(customer)  # ❌ RLS blocks delete
    await db_session.commit()
```

**Solution:**
```python
@pytest.fixture
async def test_data(db_session, bypass_rls_for_tests):
    # RLS bypassed for entire fixture lifecycle
    customer = Customer(...)
    db_session.add(customer)
    await db_session.commit()

    yield customer

    # Cleanup works
    await db_session.delete(customer)  # ✅ Works
    await db_session.commit()
```

---

## Migration Checklist

### Phase 1: Enable Auto-Bypass (Day 1)

- [ ] Add `conftest_rls_helpers.py` to tests directory
- [ ] Import `auto_bypass_rls_for_all_tests` in root `conftest.py`
- [ ] Run full test suite - all tests should pass
- [ ] Deploy RLS migration to database

### Phase 2: Update Critical Tests (Week 1)

- [ ] Update authentication/authorization tests to verify RLS
- [ ] Update customer management tests with tenant contexts
- [ ] Update billing tests to verify tenant isolation
- [ ] Mark updated tests with `@pytest.mark.rls_enabled`

### Phase 3: Update All Tests (Week 2-3)

- [ ] Update all fixture factories to use `bypass_rls_for_tests`
- [ ] Update integration tests to use proper tenant contexts
- [ ] Update API tests to include tenant headers
- [ ] Add RLS-specific security tests

### Phase 4: Remove Auto-Bypass (Week 4)

- [ ] Remove `auto_bypass_rls_for_all_tests` fixture
- [ ] Verify all tests still pass
- [ ] Make RLS opt-out instead of opt-in
- [ ] Document RLS testing patterns for new tests

---

## Example: Complete Test Module Update

### Before

```python
# tests/test_customers.py
import pytest
from sqlalchemy import select
from dotmac.platform.customer_management.models import Customer


@pytest.mark.asyncio
async def test_create_customer(db_session):
    customer = Customer(
        tenant_id="tenant-123",
        email="test@example.com",
        first_name="Test",
        last_name="User"
    )
    db_session.add(customer)
    await db_session.commit()

    result = await db_session.execute(select(Customer))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_query_customers(db_session):
    # Create test data
    customer1 = Customer(tenant_id="tenant-123", email="1@example.com")
    customer2 = Customer(tenant_id="tenant-123", email="2@example.com")
    db_session.add_all([customer1, customer2])
    await db_session.commit()

    # Query
    result = await db_session.execute(select(Customer))
    customers = result.scalars().all()
    assert len(customers) == 2
```

### After

```python
# tests/test_customers.py
import pytest
from sqlalchemy import select
from dotmac.platform.customer_management.models import Customer


@pytest.mark.asyncio
async def test_create_customer(db_session, bypass_rls_for_tests):
    """Test customer creation (RLS bypassed for setup)."""
    customer = Customer(
        tenant_id="tenant-123",
        email="test@example.com",
        first_name="Test",
        last_name="User"
    )
    db_session.add(customer)
    await db_session.commit()

    result = await db_session.execute(select(Customer))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
@pytest.mark.rls_enabled
async def test_query_customers_with_rls(
    db_session,
    bypass_rls_for_tests,
    rls_tenant_context
):
    """Test customer queries with RLS tenant isolation."""
    # Setup: Create test data for multiple tenants (bypass RLS)
    customer1 = Customer(tenant_id="tenant-a", email="1@example.com")
    customer2 = Customer(tenant_id="tenant-a", email="2@example.com")
    customer3 = Customer(tenant_id="tenant-b", email="3@example.com")

    db_session.add_all([customer1, customer2, customer3])
    await db_session.commit()

    # Test: Query as tenant-a (RLS enabled)
    async with rls_tenant_context("tenant-a"):
        result = await db_session.execute(select(Customer))
        customers = result.scalars().all()

        # Should only see tenant-a's customers
        assert len(customers) == 2
        assert all(c.tenant_id == "tenant-a" for c in customers)
```

---

## Best Practices

### ✅ DO

- Use `bypass_rls_for_tests` for test data setup and teardown
- Use `rls_tenant_context` for testing business logic
- Use `@pytest.mark.rls_enabled` to explicitly test RLS behavior
- Create separate tests for RLS security verification
- Document which tests verify RLS policies

### ❌ DON'T

- Don't mix RLS-enabled and RLS-bypassed queries in same test
- Don't forget to bypass RLS in fixtures that create/delete data
- Don't assume data exists without setting tenant context
- Don't test cross-tenant access without proper superuser context

---

## Summary

**3 Steps to Update Tests:**

1. **Add auto-bypass** to keep existing tests working
2. **Update fixtures** to explicitly bypass RLS for setup/teardown
3. **Add new tests** that explicitly verify RLS isolation

**Result:** Existing tests continue working while you gain RLS security benefits!
