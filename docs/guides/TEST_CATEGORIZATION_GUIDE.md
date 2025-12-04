# Test Categorization Guide

**Version**: 1.0
**Date**: 2025-10-27
**Status**: Active

This guide provides clear criteria for categorizing tests in the test pyramid: **Unit**, **Integration**, or **E2E (End-to-End)**.

---

## Quick Decision Tree

```
START: You're writing a test
    |
    ├─ Does it make HTTP requests through TestClient/AsyncClient?
    │   ├─ YES → Does it test multi-step user journeys?
    │   │   ├─ YES → E2E test
    │   │   └─ NO → Integration test (single endpoint)
    │   │
    │   └─ NO → Does it use a real database (async_session)?
    │       ├─ YES → Integration test
    │       │
    │       └─ NO → Does it have ANY external dependencies?
    │           ├─ YES (mocked) → Integration test
    │           └─ NO (pure logic) → Unit test
```

---

## The Three Test Types

### 🟢 Unit Tests (60% target)

**What**: Test individual functions, classes, or modules in **complete isolation**

**Characteristics**:
- ✅ No database access (no `async_session` fixture)
- ✅ No HTTP calls (no `TestClient` or `httpx`)
- ✅ No file I/O (except reading test data)
- ✅ All external dependencies are mocked
- ✅ Tests pure business logic
- ✅ Fast execution (< 50ms per test)

**Marker**: `pytestmark = pytest.mark.unit`

**Examples**:
- Validation logic
- Calculations (pricing, tax, billing)
- Data transformations
- Utility functions
- Model methods (not database queries)
- Pydantic schema validation

**When to Use**:
- Testing algorithms and business rules
- Testing edge cases and error conditions
- Testing private methods or internal helpers
- When you can test the logic without external systems

---

### 🟡 Integration Tests (30% target)

**What**: Test how components work together with **real** external dependencies

**Characteristics**:
- ✅ Uses real database (`async_session` fixture)
- ✅ May use HTTP client for **single endpoint** testing
- ✅ Tests database queries and transactions
- ✅ Tests service layer orchestration
- ✅ May mock **some** external services (e.g., payment providers)
- ⚠️ Slower execution (100-500ms per test)

**Marker**: `pytestmark = pytest.mark.integration`

**Examples**:
- Database CRUD operations
- Repository layer tests
- Service layer tests with DB
- Single API endpoint validation
- Database transaction behavior
- Query performance tests

**When to Use**:
- Testing database interactions
- Testing that services correctly use repositories
- Testing API endpoint request/response (single call)
- When you need real database constraints and relationships

---

### 🔴 E2E Tests (10% target)

**What**: Test complete **user workflows** through the full application stack

**Characteristics**:
- ✅ Uses HTTP client (`TestClient`, `AsyncClient`)
- ✅ Tests **multiple steps** in a user journey
- ✅ Uses real database
- ✅ May use real external services (or realistic mocks)
- ✅ Tests authentication flows
- ⚠️ Slowest execution (500ms-2s per test)

**Marker**: `pytestmark = pytest.mark.e2e`

**Examples**:
- User registration → login → profile update
- Create subscription → add payment → process billing
- Submit ticket → support responds → customer replies → ticket closed
- OAuth flow → token refresh → API access

**When to Use**:
- Testing critical user journeys
- Testing cross-module interactions
- Testing authentication and authorization flows
- Testing that the full stack works together
- **NOT** for testing single endpoints or simple CRUD

---

## Common Misclassifications

### ❌ E2E tests that should be Integration

**Problem**: Single-endpoint tests marked as E2E

```python
# WRONG: This is NOT an E2E test
@pytest.mark.e2e
async def test_create_customer_api(test_client):
    response = await test_client.post("/customers", json={...})
    assert response.status_code == 201
```

**Fix**: Single endpoint → Integration
```python
# CORRECT: Single endpoint = Integration test
@pytest.mark.integration
async def test_create_customer_api(test_client):
    response = await test_client.post("/customers", json={...})
    assert response.status_code == 201
```

---

### ❌ Integration tests that should be Unit

**Problem**: No database access, all dependencies mocked

```python
# WRONG: No real external dependencies = not integration
@pytest.mark.integration
def test_calculate_tax(monkeypatch):
    # All dependencies mocked, no DB
    mock_config = Mock(tax_rate=0.1)
    monkeypatch.setattr("module.get_config", lambda: mock_config)

    result = calculate_tax(100)
    assert result == 110
```

**Fix**: Pure logic → Unit test
```python
# CORRECT: Pure business logic = Unit test
@pytest.mark.unit
def test_calculate_tax():
    result = calculate_tax(price=100, tax_rate=0.1)
    assert result == 110
```

---

### ❌ Integration tests that should be E2E

**Problem**: Tests multiple steps in a user flow but marked as integration

```python
# WRONG: Multi-step user journey = E2E
@pytest.mark.integration
async def test_subscription_lifecycle(test_client, async_session):
    # Step 1: Create subscription
    sub_resp = await test_client.post("/subscriptions", ...)

    # Step 2: Add payment method
    pay_resp = await test_client.post("/payment-methods", ...)

    # Step 3: Process billing
    bill_resp = await test_client.post("/billing/process", ...)

    # Verifies complete user journey
    assert bill_resp.status_code == 200
```

**Fix**: Multi-step journey → E2E test
```python
# CORRECT: Multi-step user flow = E2E test
@pytest.mark.e2e
async def test_subscription_lifecycle(test_client, async_session):
    # Complete user journey from subscription → payment → billing
    ...
```

---

## Decision Criteria Table

| Characteristic | Unit | Integration | E2E |
|----------------|------|-------------|-----|
| **Database** | No | Yes | Yes |
| **HTTP Client** | No | Single call | Multiple calls |
| **External APIs** | All mocked | Some mocked | Real or realistic mocks |
| **Test Scope** | Single function | Single component + DB | Full user journey |
| **Dependencies** | All mocked | Real DB, mocked services | Real DB, real/mock services |
| **Execution Time** | <50ms | 100-500ms | 500ms-2s |
| **Failure Scope** | Logic error | Integration error | Workflow error |

---

## Fixtures and Markers

### Common Fixtures by Test Type

**Unit Tests**:
```python
@pytest.mark.unit
def test_calculate_total():
    # No fixtures, or only mock fixtures
    pass

@pytest.mark.unit
def test_validate_email(monkeypatch):
    # monkeypatch is OK for unit tests
    pass
```

**Integration Tests**:
```python
@pytest.mark.integration
async def test_create_invoice(async_session):
    # Uses real database session
    pass

@pytest.mark.integration
async def test_get_invoice_api(test_client, async_session):
    # Single endpoint with database
    pass
```

**E2E Tests**:
```python
@pytest.mark.e2e
async def test_customer_journey(test_client, async_session):
    # Multi-step workflow with HTTP client
    pass
```

---

## Module-Level vs Function-Level Markers

### Module-Level Markers (Preferred)

Use when **all tests** in the file are the same type:

```python
import pytest

pytestmark = pytest.mark.unit  # All tests in file are unit tests

def test_validate_email():
    pass

def test_calculate_tax():
    pass
```

### Mixed Markers (When Needed)

Use function-level markers when file contains **multiple types**:

```python
import pytest

@pytest.mark.unit
def test_calculate_total():
    # Pure logic
    pass

@pytest.mark.integration
async def test_save_to_db(async_session):
    # Database test
    pass
```

**Best Practice**: Prefer separate files for different test types. Use module-level markers.

---

## Real-World Examples

### Example 1: Billing Module

```python
# tests/billing/test_invoice_calculations.py
# Unit tests - pure business logic
import pytest

pytestmark = pytest.mark.unit

def test_calculate_invoice_total():
    """Calculate total with tax and discount"""
    result = calculate_total(
        subtotal=100,
        tax_rate=0.1,
        discount=10
    )
    assert result == 100  # (100 - 10) * 1.1 = 99, rounds to 100

def test_apply_discount_percentage():
    result = apply_discount(amount=100, discount_pct=10)
    assert result == 90
```

```python
# tests/billing/test_invoice_service.py
# Integration tests - service with database
import pytest

pytestmark = pytest.mark.integration

async def test_create_invoice_in_db(async_session):
    """Test invoice creation with real database"""
    service = InvoiceService(async_session)

    invoice = await service.create_invoice(
        customer_id="CUST-001",
        items=[{"description": "Service", "amount": 100}]
    )

    # Verify it's in the database
    saved = await async_session.get(Invoice, invoice.id)
    assert saved is not None
    assert saved.total == 100
```

```python
# tests/billing/test_billing_e2e.py
# E2E tests - complete billing workflow
import pytest

pytestmark = pytest.mark.e2e

async def test_subscription_to_payment_flow(test_client, async_session):
    """Test complete billing flow: subscribe → invoice → pay"""

    # Step 1: Customer subscribes to plan
    sub_response = await test_client.post("/subscriptions", json={
        "customer_id": "CUST-001",
        "plan_id": "PLAN-BASIC"
    })
    assert sub_response.status_code == 201
    subscription_id = sub_response.json()["id"]

    # Step 2: Generate invoice
    invoice_response = await test_client.post(f"/subscriptions/{subscription_id}/invoices")
    assert invoice_response.status_code == 201
    invoice_id = invoice_response.json()["id"]

    # Step 3: Process payment
    payment_response = await test_client.post(f"/invoices/{invoice_id}/pay", json={
        "payment_method": "card",
        "amount": 2500
    })
    assert payment_response.status_code == 200
    assert payment_response.json()["status"] == "paid"
```

### Example 2: Authentication Module

```python
# tests/auth/test_password_validation.py
# Unit test - pure validation logic
import pytest

pytestmark = pytest.mark.unit

def test_password_strength_weak():
    """Test weak password detection"""
    assert validate_password_strength("123") == "weak"

def test_password_strength_strong():
    assert validate_password_strength("MyP@ssw0rd123!") == "strong"
```

```python
# tests/auth/test_user_repository.py
# Integration test - database operations
import pytest

pytestmark = pytest.mark.integration

async def test_create_user_in_db(async_session):
    """Test user creation with real database"""
    repo = UserRepository(async_session)

    user = await repo.create(
        username="testuser",
        email="test@example.com",
        password_hash="hashed"
    )

    # Verify constraints work
    assert user.id is not None
    assert user.created_at is not None
```

```python
# tests/auth/test_login_flow_e2e.py
# E2E test - complete authentication flow
import pytest

pytestmark = pytest.mark.e2e

async def test_registration_login_access_flow(test_client):
    """Test complete user journey: register → login → access protected resource"""

    # Step 1: Register
    reg_response = await test_client.post("/auth/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "SecureP@ss123"
    })
    assert reg_response.status_code == 201

    # Step 2: Login
    login_response = await test_client.post("/auth/login", json={
        "username": "newuser",
        "password": "SecureP@ss123"
    })
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    # Step 3: Access protected resource
    profile_response = await test_client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["username"] == "newuser"
```

---

## Migration Checklist

When reclassifying tests, follow this checklist:

### Reclassifying E2E → Integration
- [ ] Test makes only **one** HTTP call
- [ ] Test doesn't verify multi-step workflows
- [ ] Test focuses on single endpoint behavior
- [ ] Change marker from `@pytest.mark.e2e` to `@pytest.mark.integration`
- [ ] Run test to ensure it still passes
- [ ] Update module-level marker if all tests changed

### Reclassifying Integration → Unit
- [ ] Test has **no** `async_session` fixture
- [ ] Test has **no** `test_client` fixture
- [ ] Test mocks **all** external dependencies
- [ ] Test focuses on pure business logic
- [ ] Change marker from `@pytest.mark.integration` to `@pytest.mark.unit`
- [ ] Remove database-related fixtures
- [ ] Run test to ensure it still passes

### Creating New Unit Tests from Integration Tests
- [ ] Identify business logic in integration test
- [ ] Extract business logic to separate function
- [ ] Create new unit test file for extracted logic
- [ ] Mark with `@pytest.mark.unit`
- [ ] Keep integration test for orchestration layer
- [ ] Verify both tests pass

---

## Code Review Checklist

When reviewing new tests, check:

### All Tests
- [ ] Test has appropriate pyramid marker (unit/integration/e2e)
- [ ] Test name clearly describes what is being tested
- [ ] Test follows AAA pattern (Arrange, Act, Assert)
- [ ] Test is focused on one thing
- [ ] No unnecessary fixtures used

### Unit Tests Specifically
- [ ] No `async_session` fixture
- [ ] No `test_client` or HTTP client
- [ ] No file I/O (except test data)
- [ ] Fast execution (< 50ms)
- [ ] Tests one function/method

### Integration Tests Specifically
- [ ] Uses `async_session` OR `test_client` (not both for simple cases)
- [ ] Single endpoint test OR service layer test
- [ ] Not testing multi-step workflows
- [ ] Execution time < 500ms

### E2E Tests Specifically
- [ ] Tests complete user journey (2+ steps)
- [ ] Uses `test_client` for HTTP calls
- [ ] Verifies end-to-end workflow
- [ ] Has clear business value
- [ ] Execution time < 2s

---

## Anti-Patterns to Avoid

### ❌ Testing Everything Through the API

**Problem**: All tests use `test_client`, even for pure logic

```python
# BAD: Using HTTP for simple validation
@pytest.mark.e2e
async def test_email_validation(test_client):
    response = await test_client.post("/validate-email", json={"email": "invalid"})
    assert response.status_code == 400
```

**Better**: Test validation directly
```python
# GOOD: Unit test for validation logic
@pytest.mark.unit
def test_email_validation():
    assert validate_email("invalid") is False
    assert validate_email("valid@example.com") is True
```

---

### ❌ E2E Tests for Every Endpoint

**Problem**: Creating E2E tests for CRUD operations

```python
# BAD: Simple CRUD is not E2E
@pytest.mark.e2e
async def test_get_customer(test_client):
    response = await test_client.get("/customers/123")
    assert response.status_code == 200
```

**Better**: Integration test
```python
# GOOD: Single endpoint = Integration
@pytest.mark.integration
async def test_get_customer(test_client):
    response = await test_client.get("/customers/123")
    assert response.status_code == 200
```

---

### ❌ Integration Tests Without Integration

**Problem**: Mocking everything, including database

```python
# BAD: No real integration happening
@pytest.mark.integration
async def test_create_invoice(monkeypatch):
    mock_db = Mock()
    monkeypatch.setattr("service.db", mock_db)

    result = create_invoice(...)  # All mocked!
```

**Better**: Unit test if everything is mocked
```python
# GOOD: Mocked dependencies = Unit test
@pytest.mark.unit
def test_create_invoice_logic():
    result = build_invoice_data(
        customer_id="CUST-001",
        items=[...]
    )
    assert result["total"] == 100
```

---

## Summary

**Remember the hierarchy**:
1. **Prefer unit tests** - fastest, most reliable, easiest to debug
2. **Use integration tests** - when you need real database or single API calls
3. **Reserve E2E tests** - only for critical user journeys

**Golden Rule**: If you can test it at a lower level, do so!

---

**Questions or Exceptions?**
Discuss with the team and update this guide with new patterns as they emerge.

**Last Updated**: 2025-10-27
