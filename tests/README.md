# DotMac Platform Test Suite

## Overview

Comprehensive test suite for the DotMac Platform, covering unit, integration, and end-to-end testing across all features.

**Test Status:** 90%+ passing (9,000+ tests)

---

## Quick Start

```bash
# Run all tests
pytest

# Run fast tests only (unit tests)
pytest -m unit

# Run specific feature tests
pytest tests/billing/ -v

# Run with coverage
pytest --cov=src/dotmac/platform --cov-report=html
```

---

## Documentation

### Core Guides

1. **[Fixture Organization Guide](FIXTURE_ORGANIZATION.md)** - How to organize and create fixtures
2. **[Test Structure Guide](TEST_STRUCTURE_GUIDE.md)** - How to organize test files and directories
3. **[Testing Patterns](TESTING_PATTERNS.md)** - Advanced testing patterns and techniques
4. **[Migration Examples](MIGRATION_EXAMPLE.md)** - How to migrate tests to use base classes
5. **[Cleanup Registry Integration](CLEANUP_REGISTRY_INTEGRATION.md)** - Using the cleanup registry pattern
6. **[Quick Reference](QUICK_REFERENCE.md)** - One-page cheat sheet
7. **[Phase 2 Progress](PHASE2_PROGRESS.md)** - Current testing framework deployment progress

### Helper Modules

- `tests/helpers/router_base.py` - Router test base classes
- `tests/helpers/cleanup_registry.py` - Cleanup registry implementation
- `tests/helpers/contract_testing.py` - Schema validation utilities
- `tests/helpers/fixture_factories.py` - Fixture factory utilities
- `tests/fixtures/example_factories.py` - Example factory implementations

---

## Test Structure

```
tests/
├── README.md                        # This file
│
# CORE GUIDES
├── FIXTURE_ORGANIZATION.md          # Fixture best practices
├── TEST_STRUCTURE_GUIDE.md          # Test organization guide
├── TESTING_PATTERNS.md              # Advanced patterns
├── MIGRATION_EXAMPLE.md             # Migration guide
├── CLEANUP_REGISTRY_INTEGRATION.md  # Cleanup patterns
├── QUICK_REFERENCE.md               # Cheat sheet
│
# GLOBAL FIXTURES
├── conftest.py                      # Global fixtures (2250 lines)
│
# FEATURE TESTS (95% of tests)
├── billing/                         # Billing feature tests
│   ├── conftest.py                  # Billing fixtures
│   ├── test_invoice_service.py
│   └── ...
├── auth/                            # Authentication tests
├── tenant/                          # Tenant management tests
├── customer_management/             # Customer tests
└── ...                              # 60+ feature directories
│
# SPECIAL TEST TYPES (5% of tests)
├── integration/                     # Cross-module integration (10 files)
├── e2e/                             # End-to-end workflows (8 files)
├── journeys/                        # User journeys (5 files)
│
# UTILITIES
├── helpers/                         # Test utilities
│   ├── router_base.py               # Router test base classes
│   ├── cleanup_registry.py          # Cleanup registry
│   ├── contract_testing.py          # Schema validation
│   └── fixture_factories.py         # Factory utilities
│
└── fixtures/                        # Shared fixtures
    └── example_factories.py         # Example factory implementations
```

---

## Test Categories

### Unit Tests (Fast, No Dependencies)

**Location:** Within feature directories
**Marker:** `@pytest.mark.unit`
**Execution:** `pytest -m unit`

```python
@pytest.mark.unit
def test_calculate_total():
    """Fast unit test - no DB, no external services."""
    invoice = Invoice(items=[...])
    assert invoice.calculate_total() == 100
```

### Integration Tests (Require Dependencies)

**Location:** Within feature directories for single-feature, `tests/integration/` for cross-feature
**Marker:** `@pytest.mark.integration`
**Execution:** `pytest -m integration`

```python
@pytest.mark.integration
async def test_create_invoice(async_db_session):
    """Integration test - requires database."""
    invoice = await create_invoice(async_db_session)
    assert invoice.id is not None
```

### E2E Tests (Full Workflows)

**Location:** `tests/e2e/` or within feature for feature-specific workflows
**Marker:** `@pytest.mark.e2e`
**Execution:** `pytest -m e2e`

```python
@pytest.mark.e2e
async def test_complete_billing_flow(client):
    """E2E test - complete workflow across system."""
    # Customer → Subscription → Invoice → Payment
    ...
```

---

## Running Tests

### By Test Type

```bash
# Unit tests only (fast - <1 minute)
pytest -m unit

# Integration tests only
pytest -m integration

# E2E tests only
pytest -m e2e

# All except slow tests
pytest -m "not slow"

# Unit OR integration (exclude e2e)
pytest -m "unit or integration"
```

### By Feature

```bash
# All billing tests
pytest tests/billing/

# Specific test file
pytest tests/billing/test_invoice_service.py

# Specific test class
pytest tests/billing/test_invoice_service.py::TestInvoiceService

# Specific test
pytest tests/billing/test_invoice_service.py::TestInvoiceService::test_create_invoice
```

### With Options

```bash
# Verbose output
pytest -v

# Show print statements
pytest -s

# Stop on first failure
pytest -x

# Run last failed tests
pytest --lf

# Run tests in parallel (4 workers)
pytest -n 4

# With coverage
pytest --cov=src/dotmac/platform --cov-report=html

# Show slowest tests
pytest --durations=10
```

---

## CI/CD Strategy

### Pipeline Stages

```yaml
# Fast feedback (30s-1min)
fast-tests:
  run: pytest -m unit --maxfail=5

# Integration (2-5min)
integration-tests:
  run: pytest -m integration

# E2E (10-20min)
e2e-tests:
  run: pytest -m e2e

# Full suite (as needed)
comprehensive:
  run: pytest
```

---

## Writing Tests

### Using Router Base Classes

```python
from tests.helpers.router_base import RouterWithServiceTestBase

class TestMyRouter(RouterWithServiceTestBase):
    """Test my router endpoints."""

    router_module = "mymodule.router"
    router_name = "router"
    router_prefix = "/api/v1"
    service_dependency_name = "get_my_service"

    def test_list_resources(self, client, mock_service):
        """Test listing resources."""
        mock_service.list_all = AsyncMock(return_value=[...])
        response = client.get("/api/v1/resources")
        data = self.assert_success(response)
        assert len(data) == 2
```

### Using Fixture Factories

```python
# In conftest.py
from tests.helpers.fixture_factories import ModelFactory

class InvoiceFactory(ModelFactory):
    model_class = Invoice
    id_prefix = "inv"

    def get_defaults(self):
        return {
            "amount": Decimal("100.00"),
            "status": "pending",
        }

@pytest_asyncio.fixture
async def invoice_factory(async_db_session):
    factory = InvoiceFactory(async_db_session)
    yield factory
    await factory.cleanup_all()

# In tests
async def test_invoices(invoice_factory):
    inv1 = await invoice_factory.create(amount=100)
    inv2 = await invoice_factory.create(amount=200, status="paid")
    # Auto-cleanup after test
```

### Using Cleanup Registry

```python
def test_with_cleanup(cleanup_registry):
    """Test with automatic cleanup."""
    resource = create_resource()

    # Register cleanup
    cleanup_registry.register(
        resource.close,
        priority=CleanupPriority.FILE_HANDLES,
        name="my_resource"
    )

    # Test code...
    # resource.close() called automatically after test
```

---

## Test Markers

Available markers (configured in `pytest.ini`):

- `@pytest.mark.unit` - Fast unit tests (<0.1s)
- `@pytest.mark.integration` - Integration tests requiring external services
- `@pytest.mark.e2e` - End-to-end workflow tests
- `@pytest.mark.slow` - Slow tests (>1s) - excluded from default runs
- `@pytest.mark.comprehensive` - Comprehensive edge case tests
- `@pytest.mark.auth` - Authentication tests
- `@pytest.mark.billing` - Billing tests
- `@pytest.mark.performance` - Performance tests
- `@pytest.mark.serial` - Must run sequentially

---

## Best Practices

### ✅ DO

1. **Use base classes** - `RouterTestBase`, `CRUDRouterTestBase`
2. **Use markers** - Tag tests with `@pytest.mark.unit`, etc.
3. **Use fixture factories** - For creating multiple instances
4. **Clean up resources** - Use `yield` + cleanup or `cleanup_registry`
5. **Mock external services** - Don't call real APIs in tests
6. **Use descriptive names** - `test_create_invoice_with_invalid_amount`
7. **Document complex fixtures** - Show usage examples
8. **Keep tests isolated** - Each test should be independent
9. **Test one thing** - One assertion per test (guideline)
10. **Use test_app fixture** - Don't create custom FastAPI apps

### ❌ DON'T

1. **Don't create custom FastAPI apps** - Use `test_app` fixture
2. **Don't forget X-Tenant-ID headers** - Use base classes (auto-added)
3. **Don't leave resources uncleaned** - Always clean up
4. **Don't use mutable defaults** - Return fresh data each test
5. **Don't share state between tests** - Each test should be isolated
6. **Don't use `autouse` unnecessarily** - Only for universal concerns
7. **Don't duplicate fixtures** - Use hierarchical conftest.py
8. **Don't test implementation details** - Test behavior
9. **Don't write flaky tests** - Tests should be deterministic
10. **Don't skip cleanup** - Even if test fails

---

## Common Patterns

### Testing API Endpoints

```python
class TestResourceRouter(RouterWithServiceTestBase):
    router_module = "mymodule.router"
    service_dependency_name = "get_resource_service"

    def test_get_resource_success(self, client, mock_service):
        mock_service.get_by_id = AsyncMock(return_value={"id": "123"})
        response = client.get("/api/v1/resources/123")
        data = self.assert_success(response)
        assert data["id"] == "123"

    def test_get_resource_not_found(self, client, mock_service):
        mock_service.get_by_id = AsyncMock(return_value=None)
        response = client.get("/api/v1/resources/999")
        self.assert_not_found(response)
```

### Testing with Database

```python
@pytest.mark.integration
async def test_create_customer(async_db_session):
    """Test customer creation in database."""
    customer = Customer(
        id="cust_test",
        email="test@example.com",
        name="Test Customer"
    )

    async_db_session.add(customer)
    await async_db_session.commit()
    await async_db_session.refresh(customer)

    # Verify
    assert customer.id == "cust_test"

    # Cleanup
    await async_db_session.delete(customer)
    await async_db_session.commit()
```

### Testing Error Cases

```python
def test_invalid_amount(self, client, mock_service):
    """Test validation error for invalid amount."""
    response = client.post("/api/v1/invoices", json={
        "amount": -100,  # Invalid
    })
    self.assert_validation_error(response)
```

---

## Troubleshooting

### Tests Failing with 403 Forbidden

**Cause:** Missing X-Tenant-ID header or not using `test_app` fixture

**Solution:** Use `RouterTestBase` (headers auto-added) or add manually:
```python
response = client.get("/api/v1/resources", headers={"X-Tenant-ID": "test-tenant"})
```

### Tests Failing with ValidationError

**Cause:** Mock data doesn't match Pydantic schema

**Solution:** Read the schema and match all required fields:
```python
from mymodule.schemas import MyResourceResponse

mock_data = {
    "id": "test-id",
    "name": "Test",
    "created_at": "2025-01-01T00:00:00Z",  # Include ALL required fields
}
```

### Tests Pass Individually But Fail in Suite

**Cause:** Test isolation issues (state contamination)

**Solution:** Already fixed by cleanup fixtures! If still occurs:
1. Use base classes (automatic cleanup)
2. Check fixture scopes (use `function` scope for mutable data)
3. Always clean up resources in fixtures

### Slow Tests

**Cause:** Expensive operations in `function` scope fixtures

**Solution:** Use higher scope for expensive setup:
```python
@pytest.fixture(scope="module")  # Once per file
def expensive_seed_data():
    # Load data once, not per test
    ...
```

---

## Resources

### Internal Documentation

- **Fixture Organization:** `tests/FIXTURE_ORGANIZATION.md`
- **Test Structure:** `tests/TEST_STRUCTURE_GUIDE.md`
- **Testing Patterns:** `tests/TESTING_PATTERNS.md`
- **Migration Guide:** `tests/MIGRATION_EXAMPLE.md`
- **Cleanup Registry:** `tests/CLEANUP_REGISTRY_INTEGRATION.md`
- **Quick Reference:** `tests/QUICK_REFERENCE.md`

### Code

- **Base Classes:** `tests/helpers/router_base.py`
- **Cleanup Registry:** `tests/helpers/cleanup_registry.py`
- **Contract Testing:** `tests/helpers/contract_testing.py`
- **Fixture Factories:** `tests/helpers/fixture_factories.py`
- **Example Factories:** `tests/fixtures/example_factories.py`

### External Resources

- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)

---

## Metrics

### Current Status

- **Total Tests:** 9,670+
- **Pass Rate:** 90%+
- **Coverage:** ~80% (target)
- **Execution Time:** ~15-20 minutes (full suite)

### Performance Targets

- **Unit tests:** <0.1s per test
- **Integration tests:** <1s per test
- **E2E tests:** <5s per test
- **Full suite:** <20 minutes

---

## Contributing

### Adding New Tests

1. **Choose location:**
   - Feature test → `tests/<feature>/test_*.py`
   - Cross-module → `tests/integration/test_*.py`
   - E2E workflow → `tests/e2e/test_*.py`

2. **Use base classes:**
   - Router tests → `RouterTestBase` or `CRUDRouterTestBase`
   - Service tests → Standard pytest patterns

3. **Add markers:**
   ```python
   @pytest.mark.unit
   @pytest.mark.billing
   def test_my_feature():
       ...
   ```

4. **Create fixtures in conftest.py:**
   - Global fixtures → `tests/conftest.py`
   - Feature fixtures → `tests/<feature>/conftest.py`

5. **Clean up resources:**
   - Use `yield` + cleanup
   - Or use `cleanup_registry`

### Reviewing Tests

- Ensure proper markers
- Verify cleanup is present
- Check for test isolation
- Confirm descriptive test names
- Validate assertions

---

## Summary

**Your test suite is already well-organized!** 🎉

**Key Strengths:**
- ✅ Feature-based structure (easy to find tests)
- ✅ Hierarchical conftest.py pattern
- ✅ Markers configured for filtering
- ✅ Comprehensive test coverage
- ✅ Good documentation

**Quick Wins:**
- Use `RouterTestBase` for new router tests
- Use fixture factories for creating multiple instances
- Add markers to enable CI filtering
- Use cleanup registry for complex cleanup

**Resources:** All guides available in `tests/` directory

---

**Generated:** 2025-10-27
**Maintained by:** DotMac Platform Team
