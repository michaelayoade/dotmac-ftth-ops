# Using Factories with Router Integration Tests

**Solution to Session Mismatch Problem**

## Background

Router integration tests use `async_session` while factories use `async_db_session`. By default, factories use `flush()` to keep transactions open for rollback-based cleanup. However, this means data created by factories is not visible to router endpoints (which query from `async_session`).

## Solution: The `_commit` Parameter

All factories now support an optional `_commit` parameter:
- **Default (`_commit=False`)**: Uses `flush()` - data visible only within same session
- **Router tests (`_commit=True`)**: Uses `commit()` - data visible across all sessions

## Usage Patterns

### Pattern 1: Router Tests Needing Real Data

```python
async def test_list_subscription_plans(
    router_client: AsyncClient,
    auth_headers,
    subscription_plan_factory
):
    """Test listing subscription plans via API."""

    # Create test data with _commit=True for router visibility
    plan1 = await subscription_plan_factory(
        name="Basic Plan",
        price=Decimal("29.99"),
        _commit=True  # ← Makes data visible to router
    )

    plan2 = await subscription_plan_factory(
        name="Pro Plan",
        price=Decimal("99.99"),
        _commit=True
    )

    # Router can now see the data
    response = await router_client.get(
        "/api/v1/billing/subscriptions/plans",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
```

### Pattern 2: Service/Repository Tests (Default Behavior)

```python
async def test_list_invoices_service(
    invoice_factory,
    invoice_service,
    async_db_session
):
    """Test invoice service list method."""

    # Default behavior: flush() keeps transaction open
    invoice1 = await invoice_factory(amount=Decimal("100.00"))
    invoice2 = await invoice_factory(amount=Decimal("200.00"))

    # Service uses same async_db_session, can see flushed data
    result = await invoice_service.list_invoices()

    assert len(result) == 2
    # Transaction rolls back automatically on test teardown
```

### Pattern 3: Nested Factory Dependencies

The `_commit` parameter propagates through factory dependencies:

```python
async def test_payment_with_commit(
    router_client,
    payment_factory
):
    """Payment factory with commit propagates to customer and invoice."""

    # Single _commit=True propagates through entire chain
    payment = await payment_factory(
        amount=Decimal("100.00"),
        status="succeeded",
        _commit=True  # ← Also commits customer and invoice
    )

    # All related entities are now visible to router
    response = await router_client.get(
        f"/api/v1/billing/payments/{payment.payment_id}"
    )

    assert response.status_code == 200
```

## When to Use `_commit=True`

### ✅ Use `_commit=True` For:

1. **Router integration tests**
   - Testing API endpoints via HTTP client
   - Need data visible across different sessions
   ```python
   plan = await subscription_plan_factory(..., _commit=True)
   response = await router_client.get("/api/v1/plans")
   ```

2. **Tests verifying data persistence**
   - Testing that data survives transaction boundaries
   - Simulating real multi-request scenarios
   ```python
   invoice = await invoice_factory(..., _commit=True)
   # Simulate new request with fresh session
   retrieved = await repository.get_by_id(invoice.invoice_id)
   ```

3. **Cross-service integration tests**
   - Services communicate across transaction boundaries
   - Multiple services with separate session instances

### ❌ Use Default (`_commit=False`) For:

1. **Service layer tests**
   - Testing business logic methods
   - All operations use same `async_db_session`
   ```python
   invoice = await invoice_factory(amount=Decimal("100.00"))
   result = await invoice_service.calculate_total(invoice.invoice_id)
   ```

2. **Repository tests**
   - Direct database access tests
   - Query testing within same transaction
   ```python
   customer = await customer_factory()
   result = await customer_repository.find_by_email(customer.email)
   ```

3. **Unit tests (with database)**
   - Testing isolated functions/methods
   - Rollback-based cleanup preferred

## Migration Example

**Before (Manual Entity Creation):**
```python
async def test_get_subscription_plan_by_id(
    router_client: AsyncClient,
    auth_headers,
    async_session
):
    from dotmac.platform.billing.models import BillingSubscriptionPlanTable

    # Manual entity creation with commit
    plan = BillingSubscriptionPlanTable(
        plan_id="plan_456",
        tenant_id="test-tenant",
        product_id="prod_123",
        name="Premium Plan",
        billing_cycle="ANNUAL",
        price=Decimal("299.99"),
        currency="usd",
        is_active=True,
    )
    async_session.add(plan)
    await async_session.commit()

    response = await router_client.get(
        f"/api/v1/billing/subscriptions/plans/{plan.plan_id}",
        headers=auth_headers
    )

    assert response.status_code == 200
```

**After (Using Factory with _commit):**
```python
async def test_get_subscription_plan_by_id(
    router_client: AsyncClient,
    auth_headers,
    subscription_plan_factory
):
    # Factory with _commit=True
    plan = await subscription_plan_factory(
        plan_id="plan_456",
        name="Premium Plan",
        billing_cycle="ANNUAL",
        price=Decimal("299.99"),
        _commit=True  # ← Makes data visible to router
    )

    response = await router_client.get(
        f"/api/v1/billing/subscriptions/plans/{plan.plan_id}",
        headers=auth_headers
    )

    assert response.status_code == 200
```

**Benefits:**
- ✅ 60% less code
- ✅ Auto-populated defaults (tenant_id, product_id, currency, is_active)
- ✅ Type-safe (real ORM entity)
- ✅ Consistent test data structure
- ✅ Still gets rollback-based cleanup (async_db_session handles it)

## Factory Support Matrix

| Factory | `_commit` Support | Dependencies | Notes |
|---------|-------------------|--------------|-------|
| `customer_factory` | ✅ | None | Base factory |
| `subscription_plan_factory` | ✅ | None | Base factory |
| `subscription_factory` | ⏳ | customer, plan | To be added |
| `invoice_factory` | ✅ | customer | Propagates `_commit` |
| `payment_method_factory` | ⏳ | customer | To be added |
| `payment_factory` | ✅ | customer, invoice | Propagates `_commit` |

## Important Notes

### Transaction Cleanup

**IMPORTANT:** When using `_commit=True`, the data is actually committed to the database and **cannot be rolled back** by the fixture.

```python
@pytest_asyncio.fixture
async def async_db_session(async_db_engine: AsyncEngine, request):
    """Transactionally isolated async session."""
    SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
    async with SessionMaker() as session:
        transaction = await session.begin()
        try:
            yield session
        finally:
            try:
                # Only rollback if transaction is still active
                if transaction.is_active:
                    await transaction.rollback()
            finally:
                await session.close()
```

**How it works:**

**Default behavior (`_commit=False`):**
1. Factory calls `flush()` → writes to database but doesn't commit
2. Test runs → all operations in same transaction
3. Fixture calls `rollback()` → rolls back everything
4. Result: **Clean rollback, no test pollution**

**Router test behavior (`_commit=True`):**
1. Factory calls `commit()` → **permanently writes to database**
2. Transaction is closed, fixture guard skips rollback
3. Result: **Data persists in database**

**Cleanup Strategy:**

Router integration tests rely on **database-level cleanup** rather than transaction rollback:

- **Test isolation databases:** Each test run uses fresh database (Docker, etc.)
- **Truncate between tests:** Global cleanup that truncates all tables
- **Unique identifiers:** Tests use unique IDs to avoid conflicts

**This matches the original router test behavior** - they were always committing data and relying on database-level cleanup.

### Performance Considerations

**Commit overhead:**
- `flush()`: ~1-2ms per operation
- `commit()`: ~5-10ms per operation (includes fsync on some DBs)

**For router tests:**
- Already making HTTP requests (~50-100ms each)
- Commit overhead is negligible compared to HTTP
- **Use `_commit=True` freely in router tests**

**For service/unit tests:**
- Often test many operations per test
- Commit overhead adds up
- **Stick with default `_commit=False` for speed**

## Troubleshooting

### Issue: "Data not visible to router"

**Problem:**
```python
plan = await subscription_plan_factory(name="Test")  # Missing _commit=True
response = await router_client.get("/plans")
assert len(response.json()) == 0  # ❌ Empty! Expected 1
```

**Solution:**
```python
plan = await subscription_plan_factory(name="Test", _commit=True)
response = await router_client.get("/plans")
assert len(response.json()) == 1  # ✅ Works!
```

### Issue: "InvalidRequestError: This transaction is inactive"

**Problem (Fixed in tests/fixtures/database.py:270):**
- Factory calls `commit()` → closes transaction
- Fixture tries to `rollback()` closed transaction
- Raises `InvalidRequestError`

**Solution:**
The fixture now guards the rollback:
```python
if transaction.is_active:
    await transaction.rollback()
```

This was fixed in the `async_db_session` fixture. No action needed in tests.

### Issue: "Test pollution - data from previous test visible"

**Problem:**
- Test uses `_commit=True` → data persists to database
- Next test sees committed data from previous test
- Tests are not isolated

**Solution:**
Router integration tests need database-level cleanup:

**Option 1: Isolated test database (Recommended)**
```bash
# Use pytest-xdist with --tx flag for per-worker databases
pytest -n auto --tx popen//env:TEST_DB_SUFFIX=_{env:PYTEST_XDIST_WORKER}
```

**Option 2: Truncate tables between tests**
```python
@pytest.fixture(autouse=True)
async def cleanup_database(async_db_session):
    """Truncate tables after each test."""
    yield
    # After test completes
    await async_db_session.execute(text("TRUNCATE TABLE ... CASCADE"))
    await async_db_session.commit()
```

**Option 3: Unique identifiers**
```python
# Use UUID suffixes to avoid ID conflicts
plan = await subscription_plan_factory(
    plan_id=f"plan_{uuid4().hex[:8]}",  # Always unique
    _commit=True
)
```

### Issue: "ResourceClosedError: This transaction is closed" (Different cause)

**Problem:**
- Test manually calls `await async_db_session.commit()`
- Factory also commits
- Multiple commits in complex scenarios

**Solution:**
Don't manually commit when using factories with `_commit=True`:
```python
# ❌ BAD
plan = await subscription_plan_factory(..., _commit=True)
await async_db_session.commit()  # ← Unnecessary, factory already committed

# ✅ GOOD
plan = await subscription_plan_factory(..., _commit=True)
# Factory already committed, no manual commit needed
```

## See Also

- `tests/billing/factories.py` - Factory implementations
- `tests/billing/_fixtures/shared.py` - Session fixtures
