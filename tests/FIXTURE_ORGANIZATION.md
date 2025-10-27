# Fixture Organization Guide

## Overview

This guide provides best practices for organizing pytest fixtures in the DotMac Platform test suite.

---

## Table of Contents

1. [Current Structure](#current-structure)
2. [Fixture Hierarchy](#fixture-hierarchy)
3. [Fixture Scopes](#fixture-scopes)
4. [Fixture Patterns](#fixture-patterns)
5. [Organization Rules](#organization-rules)
6. [Anti-Patterns](#anti-patterns)
7. [Examples](#examples)

---

## Current Structure

Your test suite uses a **hierarchical conftest.py pattern** (already best practice!):

```
tests/
├── conftest.py                      # Global fixtures (2250 lines, ~33 fixtures)
│   ├── async_db_engine              # Database connections
│   ├── test_app                     # FastAPI app
│   ├── test_user                    # Auth fixtures
│   └── cleanup_registry             # Cleanup
│
├── billing/
│   ├── conftest.py                  # Billing-specific (37KB)
│   ├── invoicing/conftest.py        # Sub-feature specific
│   └── subscriptions/conftest.py
│
├── auth/
│   └── conftest.py                  # Auth-specific (3.2KB)
│
└── tenant/
    └── conftest.py                  # Tenant-specific (31KB)
```

**✅ This is the recommended structure! No reorganization needed.**

---

## Fixture Hierarchy

### Pytest Fixture Discovery (Bottom-Up Search)

```
Test file:     tests/billing/invoicing/test_invoice_service.py
Needs fixture: "sample_invoice"

Search order:
1. tests/billing/invoicing/conftest.py  ← Most specific (checks first)
2. tests/billing/conftest.py            ← Parent directory
3. tests/conftest.py                    ← Root (checks last)
4. Built-in pytest fixtures

First match wins!
```

### When to Use Each Level

**tests/conftest.py** (Global - Available Everywhere)
- ✅ Database connections (`async_db_engine`, `async_db_session`)
- ✅ FastAPI app (`test_app`, `client`)
- ✅ Authentication (`test_user`, `authenticated_client`)
- ✅ Cleanup fixtures (`cleanup_registry` - autouse)
- ✅ Event loops and async utilities
- ✅ Test environment configuration

**tests/&lt;feature&gt;/conftest.py** (Feature-Specific)
- ✅ Feature models (invoices, subscriptions, customers)
- ✅ Feature-specific mocks (payment gateways, billing services)
- ✅ Feature test data builders
- ✅ Feature fixture factories

**tests/&lt;feature&gt;/&lt;sub&gt;/conftest.py** (Sub-Feature)
- ✅ Very specialized fixtures used only in sub-feature
- ✅ Complex test scenarios specific to sub-feature

---

## Fixture Scopes

### Scope Decision Matrix

| Resource Type | Scope | Reason | Example |
|--------------|-------|--------|---------|
| Database connection | `session` | Expensive to create | `async_db_engine` |
| Database session | `function` | Isolation between tests | `async_db_session` |
| Mutable test data | `function` | Prevent test pollution | `sample_invoice` |
| Immutable test data | `module`/`class` | Performance optimization | `test_constants` |
| Docker containers | `session` | Very expensive startup | `docker_services` |
| Mock objects | `function` | Fresh state each test | `mock_service` |
| Event loops | `session` | One per test suite | `event_loop` |
| Temporary directories | `function` | Isolation | `tmp_path` |

### Scope Examples

```python
# SESSION - Created once for entire test suite
@pytest.fixture(scope="session")
def event_loop():
    """Shared event loop for all async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# MODULE - Created once per test module (file)
@pytest.fixture(scope="module")
def seed_data_cache():
    """Expensive seed data loaded once per module."""
    # Load 10,000 records once
    data = load_seed_data()
    return data


# CLASS - Created once per test class
@pytest.fixture(scope="class")
def billing_test_context(async_db_session):
    """Context shared across TestBillingService class."""
    context = BillingTestContext(async_db_session)
    yield context
    context.cleanup()


# FUNCTION - Created for each test (default)
@pytest.fixture  # scope="function" is default
def sample_invoice():
    """Fresh invoice for each test."""
    return {
        "id": "inv_test123",
        "amount": 100.0,
        "status": "pending",
    }
```

---

## Fixture Patterns

### Pattern 1: Simple Fixture

**Use for:** Single instances of test data

```python
@pytest.fixture
def sample_invoice():
    """Sample invoice for testing.

    Returns a fresh invoice dict for each test.
    """
    return {
        "id": "inv_test123",
        "amount": Decimal("100.00"),
        "status": "pending",
        "customer_id": "cust_test",
        "created_at": datetime.now(timezone.utc),
    }
```

### Pattern 2: Fixture Factory

**Use for:** Creating multiple instances with variations

```python
@pytest.fixture
def invoice_factory(async_db_session):
    """Factory for creating test invoices.

    Args via factory function:
        amount: Invoice amount (default: 100.0)
        status: Invoice status (default: "pending")
        customer_id: Customer ID (default: "cust_test")
        **kwargs: Additional invoice fields

    Returns:
        Callable that creates and returns invoice instances

    Example:
        def test_multiple_invoices(invoice_factory):
            inv1 = await invoice_factory(amount=100)
            inv2 = await invoice_factory(amount=200, status="paid")
            inv3 = await invoice_factory(customer_id="cust_other")

    Cleanup:
        All created invoices are automatically deleted after test.
    """
    created_invoices = []

    async def _create_invoice(
        amount: Decimal = Decimal("100.0"),
        status: str = "pending",
        customer_id: str = "cust_test",
        **kwargs
    ):
        invoice = Invoice(
            id=f"inv_test_{len(created_invoices)}",
            amount=amount,
            status=status,
            customer_id=customer_id,
            **kwargs
        )
        async_db_session.add(invoice)
        await async_db_session.commit()
        created_invoices.append(invoice)
        return invoice

    yield _create_invoice

    # Automatic cleanup
    for invoice in created_invoices:
        await async_db_session.delete(invoice)
    await async_db_session.commit()
```

### Pattern 3: Fixture with Cleanup Registry

**Use for:** Resources that need ordered cleanup

```python
@pytest.fixture
def payment_gateway(cleanup_registry):
    """Mock payment gateway with automatic cleanup.

    Automatically resets mock state after test using cleanup registry.
    """
    gateway = AsyncMock()

    # Configure default responses
    gateway.charge.return_value = {
        "status": "success",
        "transaction_id": "tx_123"
    }
    gateway.refund.return_value = {
        "status": "success"
    }

    # Register cleanup
    cleanup_registry.register(
        gateway.reset_mock,
        priority=CleanupPriority.HTTP_CLIENTS,
        name="payment_gateway"
    )

    return gateway
```

### Pattern 4: Parametrized Fixture

**Use for:** Testing with multiple scenarios

```python
@pytest.fixture(params=["monthly", "yearly", "quarterly"])
def billing_cycle(request):
    """Test with different billing cycles.

    Tests using this fixture will run 3 times:
    - Once with "monthly"
    - Once with "yearly"
    - Once with "quarterly"
    """
    return request.param


@pytest.fixture(params=[
    {"status": "active", "payment_method": "card"},
    {"status": "active", "payment_method": "bank"},
    {"status": "trial", "payment_method": None},
])
def subscription_scenario(request):
    """Test multiple subscription scenarios."""
    return request.param


# Usage
def test_subscription_billing(subscription_scenario):
    """This test runs 3 times with different scenarios."""
    assert subscription_scenario["status"] in ["active", "trial"]
    # Test logic...
```

### Pattern 5: Composed Fixture

**Use for:** Complex fixtures built from simpler ones

```python
@pytest.fixture
def billing_context(
    async_db_session,
    sample_customer,
    sample_plan,
    mock_payment_gateway
):
    """Complete billing test context.

    Combines multiple fixtures into a cohesive test environment.
    """
    context = BillingTestContext(
        db=async_db_session,
        customer=sample_customer,
        plan=sample_plan,
        payment_gateway=mock_payment_gateway,
    )

    yield context

    # Cleanup
    await context.cleanup()
```

### Pattern 6: Autouse Fixture

**Use for:** Universal setup/cleanup needed for ALL tests

```python
@pytest.fixture(autouse=True, scope="function")
def cleanup_registry():
    """Automatically clean up after each test.

    This runs for EVERY test without being explicitly requested.
    """
    reset_cleanup_registry()
    registry = get_cleanup_registry()
    yield registry
    registry.cleanup_all()


@pytest.fixture(autouse=True, scope="function")
def reset_cache():
    """Clear cache before each test.

    ⚠️ Only use autouse for truly universal concerns!
    """
    cache.clear()
    yield
```

**⚠️ Caution with autouse:**
- Only use for truly universal setup/cleanup
- Can slow down ALL tests if expensive
- Hides dependencies (not explicit in test signature)

---

## Organization Rules

### Rule 1: Place Fixtures at the Right Level

```python
# ❌ BAD - Global fixture in feature conftest
# tests/billing/conftest.py
@pytest.fixture
def async_db_session():  # Used by ALL features!
    # This should be in tests/conftest.py
    ...

# ✅ GOOD - Global fixture in global conftest
# tests/conftest.py
@pytest.fixture
def async_db_session():  # Available everywhere
    ...


# ❌ BAD - Feature fixture in global conftest
# tests/conftest.py
@pytest.fixture
def sample_invoice():  # Only used in billing tests!
    # This should be in tests/billing/conftest.py
    ...

# ✅ GOOD - Feature fixture in feature conftest
# tests/billing/conftest.py
@pytest.fixture
def sample_invoice():  # Only used here
    ...
```

### Rule 2: Use Appropriate Scopes

```python
# ❌ BAD - Session scope for mutable data
@pytest.fixture(scope="session")
def sample_invoice():
    return {"id": "inv_123", "items": []}  # Mutable!
    # All tests share the same dict - tests will pollute each other!

# ✅ GOOD - Function scope for mutable data
@pytest.fixture  # scope="function" (default)
def sample_invoice():
    return {"id": "inv_123", "items": []}  # Fresh dict each test


# ❌ BAD - Function scope for expensive operation
@pytest.fixture  # scope="function"
def seed_database(async_db_session):
    await load_10000_records()  # 5 seconds
    # 100 tests × 5 seconds = 500 seconds! 😱

# ✅ GOOD - Module scope for expensive operation
@pytest.fixture(scope="module")
def seed_database(async_db_session):
    await load_10000_records()  # 5 seconds
    # Once per module = 5 seconds total ✅
```

### Rule 3: Always Clean Up Resources

```python
# ❌ BAD - No cleanup
@pytest.fixture
def temp_file():
    with open("/tmp/test.txt", "w") as f:
        f.write("test")
    return "/tmp/test.txt"
    # File left on filesystem! 😱

# ✅ GOOD - Cleanup with yield
@pytest.fixture
def temp_file(tmp_path):
    file_path = tmp_path / "test.txt"
    file_path.write_text("test")
    yield file_path
    # tmp_path automatically cleaned up ✅


# ✅ ALSO GOOD - Cleanup with registry
@pytest.fixture
def temp_file(tmp_path, cleanup_registry):
    file_path = tmp_path / "test.txt"
    file_path.write_text("test")

    cleanup_registry.register(
        lambda: file_path.unlink(missing_ok=True),
        priority=CleanupPriority.FILE_HANDLES,
        name="temp_file"
    )

    return file_path
```

### Rule 4: Document Complex Fixtures

```python
# ❌ BAD - No documentation
@pytest.fixture
def billing_context(async_db_session, sample_customer, sample_plan):
    context = BillingTestContext(async_db_session, sample_customer, sample_plan)
    yield context
    await context.cleanup()


# ✅ GOOD - Clear documentation
@pytest.fixture
def billing_context(async_db_session, sample_customer, sample_plan):
    """Complete billing test environment.

    Provides a pre-configured billing context with:
    - Database session
    - Sample customer
    - Sample subscription plan

    The context is automatically cleaned up after the test.

    Example:
        def test_billing(billing_context):
            invoice = await billing_context.create_invoice(amount=100)
            assert invoice.amount == 100

    Cleanup:
        All database records created by the context are deleted.
    """
    context = BillingTestContext(async_db_session, sample_customer, sample_plan)
    yield context
    await context.cleanup()
```

### Rule 5: Prefer Factories Over Parametrization for Complex Cases

```python
# ❌ COMPLEX - Parametrization with many scenarios
@pytest.fixture(params=[
    {"amount": 100, "status": "pending", "customer": "cust_1"},
    {"amount": 200, "status": "paid", "customer": "cust_1"},
    {"amount": 300, "status": "pending", "customer": "cust_2"},
    {"amount": 400, "status": "paid", "customer": "cust_2"},
    # 10 more scenarios...
])
def invoice_scenario(request):
    # Tests run 14 times (once per param)
    # Hard to read, hard to maintain
    return request.param


# ✅ BETTER - Factory for complex scenarios
@pytest.fixture
def invoice_factory(async_db_session):
    """Create invoices with custom parameters."""
    async def _create(amount=100, status="pending", customer="cust_1"):
        # Create invoice with parameters
        ...

    yield _create

# Usage - explicit control
def test_invoice_statuses(invoice_factory):
    pending = await invoice_factory(status="pending")
    paid = await invoice_factory(status="paid")
    # Test specific to these two scenarios
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Fixtures That Modify Global State

```python
# BAD
@pytest.fixture
def enable_feature_flag():
    global_config["feature_x"] = True
    yield
    # ⚠️ If test fails before yield, flag stays enabled!

# GOOD
@pytest.fixture
def enable_feature_flag():
    original = global_config.get("feature_x")
    global_config["feature_x"] = True
    yield
    # Always restore original state
    if original is None:
        del global_config["feature_x"]
    else:
        global_config["feature_x"] = original
```

### ❌ Anti-Pattern 2: Fixture Duplication

```python
# BAD - Duplicated in multiple files
# tests/billing/conftest.py
@pytest.fixture
def test_user():
    return UserInfo(...)

# tests/auth/conftest.py
@pytest.fixture
def test_user():
    return UserInfo(...)  # Same fixture!

# GOOD - Define once globally
# tests/conftest.py
@pytest.fixture
def test_user():
    return UserInfo(...)
```

### ❌ Anti-Pattern 3: Mutable Fixture at Wrong Scope

```python
# BAD - Shared mutable state
@pytest.fixture(scope="module")
def shared_list():
    return []  # All tests in module share same list!

# Test 1 adds items, Test 2 sees them - pollution! 😱


# GOOD - Fresh state per test
@pytest.fixture  # scope="function"
def fresh_list():
    return []  # New list each test
```

### ❌ Anti-Pattern 4: Missing Cleanup

```python
# BAD
@pytest.fixture
async def db_records():
    records = await create_test_records()
    return records
    # Records left in database! 😱

# GOOD
@pytest.fixture
async def db_records(async_db_session):
    records = await create_test_records()
    yield records
    # Cleanup
    for record in records:
        await async_db_session.delete(record)
    await async_db_session.commit()
```

### ❌ Anti-Pattern 5: Unnecessary autouse

```python
# BAD - Autouse for feature-specific setup
@pytest.fixture(autouse=True)
def setup_billing():
    # Runs for ALL tests (auth, tenant, etc.)
    # Slows down everything! 😱
    ...

# GOOD - Explicit dependency
@pytest.fixture  # No autouse
def billing_setup():
    # Only runs when explicitly requested
    ...

def test_billing(billing_setup):  # Explicit
    ...
```

---

## Examples

### Example 1: Simple Test Data Fixture

```python
# tests/billing/conftest.py

@pytest.fixture
def sample_invoice():
    """Sample invoice for testing.

    Returns a fresh invoice dict for each test.
    """
    return {
        "id": "inv_test123",
        "amount": Decimal("100.00"),
        "status": "pending",
        "customer_id": "cust_test",
        "due_date": datetime.now(timezone.utc) + timedelta(days=30),
        "items": [
            {"description": "Service Fee", "amount": Decimal("100.00")}
        ],
    }


# Usage
def test_invoice_total(sample_invoice):
    """Test invoice total calculation."""
    assert sample_invoice["amount"] == Decimal("100.00")
```

### Example 2: Fixture Factory

```python
# tests/billing/conftest.py

@pytest.fixture
def subscription_factory(async_db_session):
    """Factory for creating test subscriptions.

    Example:
        sub1 = await subscription_factory(plan="basic")
        sub2 = await subscription_factory(plan="premium", status="active")
    """
    created_subscriptions = []

    async def _create_subscription(
        plan: str = "basic",
        status: str = "trial",
        customer_id: str = "cust_test",
        **kwargs
    ):
        subscription = Subscription(
            id=f"sub_test_{len(created_subscriptions)}",
            plan_id=plan,
            status=status,
            customer_id=customer_id,
            **kwargs
        )
        async_db_session.add(subscription)
        await async_db_session.commit()
        created_subscriptions.append(subscription)
        return subscription

    yield _create_subscription

    # Cleanup all created subscriptions
    for sub in created_subscriptions:
        await async_db_session.delete(sub)
    await async_db_session.commit()


# Usage
async def test_subscription_upgrade(subscription_factory):
    """Test subscription upgrade flow."""
    basic_sub = await subscription_factory(plan="basic", status="active")
    premium_sub = await subscription_factory(plan="premium", status="active")

    # Test upgrade logic...
```

### Example 3: Mock Service Fixture

```python
# tests/billing/conftest.py

@pytest.fixture
def mock_payment_gateway(cleanup_registry):
    """Mock payment gateway for testing.

    Provides pre-configured mock responses for common operations.
    Automatically resets mock state after test.
    """
    gateway = AsyncMock()

    # Default successful responses
    gateway.charge.return_value = {
        "status": "success",
        "transaction_id": "tx_123",
        "amount": 100.0,
    }

    gateway.refund.return_value = {
        "status": "success",
        "refund_id": "ref_456",
    }

    gateway.verify_payment.return_value = {
        "status": "verified",
        "card_last4": "4242",
    }

    # Register cleanup
    cleanup_registry.register(
        gateway.reset_mock,
        priority=CleanupPriority.HTTP_CLIENTS,
        name="payment_gateway"
    )

    return gateway


# Usage
async def test_payment_processing(mock_payment_gateway):
    """Test payment processing."""
    result = await mock_payment_gateway.charge(amount=100)
    assert result["status"] == "success"

    # Verify charge was called
    mock_payment_gateway.charge.assert_called_once_with(amount=100)
```

### Example 4: Composed Context Fixture

```python
# tests/billing/conftest.py

@pytest.fixture
async def billing_test_context(
    async_db_session,
    sample_customer,
    sample_plan,
    mock_payment_gateway,
    cleanup_registry
):
    """Complete billing test environment.

    Provides:
    - Database session
    - Sample customer
    - Sample subscription plan
    - Mock payment gateway

    All resources are automatically cleaned up after test.

    Example:
        async def test_billing_flow(billing_test_context):
            ctx = billing_test_context
            invoice = await ctx.create_invoice(amount=100)
            payment = await ctx.process_payment(invoice)
            assert payment.status == "success"
    """
    from tests.helpers.billing_context import BillingTestContext

    context = BillingTestContext(
        db=async_db_session,
        customer=sample_customer,
        plan=sample_plan,
        payment_gateway=mock_payment_gateway,
    )

    # Initialize context
    await context.setup()

    # Register cleanup
    cleanup_registry.register(
        context.cleanup,
        priority=CleanupPriority.DATABASE,
        name="billing_context"
    )

    return context
```

### Example 5: Parametrized Fixture

```python
# tests/billing/conftest.py

@pytest.fixture(params=[
    "monthly",
    "yearly",
    "quarterly",
])
def billing_cycle(request):
    """Parametrized billing cycle fixture.

    Tests using this fixture will run 3 times:
    - Once with "monthly"
    - Once with "yearly"
    - Once with "quarterly"
    """
    return request.param


@pytest.fixture
def subscription_for_cycle(billing_cycle):
    """Create subscription with specific billing cycle."""
    return {
        "id": f"sub_test_{billing_cycle}",
        "billing_cycle": billing_cycle,
        "status": "active",
    }


# Usage - test runs 3 times
def test_billing_calculation(subscription_for_cycle, billing_cycle):
    """Test billing calculation for different cycles."""
    sub = subscription_for_cycle
    assert sub["billing_cycle"] == billing_cycle

    # Billing logic specific to cycle...
```

---

## Migration Guide

### Splitting Large conftest.py Files

If a conftest.py file is >500 lines, consider splitting by sub-feature:

**Before:**
```
tests/billing/
├── conftest.py (37KB - too large!)
└── test_*.py files
```

**After:**
```
tests/billing/
├── conftest.py (common billing fixtures)
├── invoicing/
│   ├── conftest.py (invoice-specific fixtures)
│   └── test_invoice_*.py
├── subscriptions/
│   ├── conftest.py (subscription-specific fixtures)
│   └── test_subscription_*.py
└── payments/
    ├── conftest.py (payment-specific fixtures)
    └── test_payment_*.py
```

### Converting Simple Fixtures to Factories

**Before:**
```python
@pytest.fixture
def invoice_1():
    return {"id": "inv_1", "amount": 100}

@pytest.fixture
def invoice_2():
    return {"id": "inv_2", "amount": 200}

@pytest.fixture
def invoice_3():
    return {"id": "inv_3", "amount": 300}
```

**After:**
```python
@pytest.fixture
def invoice_factory():
    """Factory for creating test invoices."""
    def _create(id_suffix, amount):
        return {"id": f"inv_{id_suffix}", "amount": amount}
    return _create

# Usage
def test_invoices(invoice_factory):
    inv1 = invoice_factory(1, 100)
    inv2 = invoice_factory(2, 200)
    inv3 = invoice_factory(3, 300)
```

---

## Summary

### Key Principles

1. ✅ **Use hierarchical conftest.py** - Global → Feature → Sub-feature
2. ✅ **Choose appropriate scopes** - Function for mutable, higher for expensive
3. ✅ **Always clean up resources** - Use yield + cleanup or cleanup_registry
4. ✅ **Use factories for variations** - More flexible than parametrization
5. ✅ **Document complex fixtures** - Show usage examples
6. ✅ **Avoid autouse** - Unless truly universal
7. ✅ **Place fixtures at right level** - Global vs feature vs sub-feature

### Quick Reference

```python
# Scope selection
function  # Default - fresh state each test
module    # Once per test file
class     # Once per test class
session   # Once per test suite

# Fixture patterns
@pytest.fixture                          # Simple fixture
@pytest.fixture(scope="module")         # Scoped fixture
@pytest.fixture(autouse=True)           # Auto-applied fixture
@pytest.fixture(params=[...])           # Parametrized fixture

# Factory pattern
@pytest.fixture
def resource_factory():
    def _create(**kwargs):
        return Resource(**kwargs)
    return _create

# Cleanup pattern
@pytest.fixture
def resource(cleanup_registry):
    r = create_resource()
    cleanup_registry.register(r.close)
    return r
```

### Resources

- **Base Classes:** `tests/helpers/router_base.py`
- **Cleanup Registry:** `tests/helpers/cleanup_registry.py`
- **Registry Integration:** `tests/CLEANUP_REGISTRY_INTEGRATION.md`
- **Testing Patterns:** `tests/TESTING_PATTERNS.md`
- **Migration Examples:** `tests/MIGRATION_EXAMPLE.md`

---

**Generated:** 2025-10-27
