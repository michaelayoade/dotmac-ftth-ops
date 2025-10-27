# Advanced Testing Patterns for Test Suite

## Overview

Beyond our current patterns (base classes, cleanup registry, contract testing), here are additional patterns that can significantly improve test quality and maintainability.

---

## 1. Test Data Builders (Builder Pattern)

### Problem
Creating complex test objects is repetitive and error-prone:

```python
# ❌ Repetitive and fragile
def test_create_subscription():
    subscription = {
        "id": "sub_123",
        "tenant_id": "tenant_456",
        "customer_id": "cust_789",
        "plan_id": "plan_basic",
        "status": "active",
        "billing_cycle": "monthly",
        "start_date": "2025-01-01",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
        # ... 20 more fields
    }
```

### Solution: Builder Pattern

```python
# tests/helpers/builders.py
from datetime import datetime, timezone
from typing import Any

class SubscriptionBuilder:
    """Builder for creating test subscription data.

    Example:
        subscription = (
            SubscriptionBuilder()
            .with_plan("premium")
            .with_status("active")
            .build()
        )
    """

    def __init__(self):
        self._data = {
            "id": "sub_test123",
            "tenant_id": "tenant_test",
            "customer_id": "cust_test",
            "plan_id": "plan_basic",
            "status": "active",
            "billing_cycle": "monthly",
            "start_date": datetime.now(timezone.utc).date().isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    def with_id(self, subscription_id: str) -> "SubscriptionBuilder":
        self._data["id"] = subscription_id
        return self

    def with_plan(self, plan_id: str) -> "SubscriptionBuilder":
        self._data["plan_id"] = plan_id
        return self

    def with_status(self, status: str) -> "SubscriptionBuilder":
        self._data["status"] = status
        return self

    def with_tenant(self, tenant_id: str) -> "SubscriptionBuilder":
        self._data["tenant_id"] = tenant_id
        return self

    def cancelled(self) -> "SubscriptionBuilder":
        """Convenience method for cancelled subscriptions."""
        self._data["status"] = "cancelled"
        self._data["cancelled_at"] = datetime.now(timezone.utc).isoformat()
        return self

    def expired(self) -> "SubscriptionBuilder":
        """Convenience method for expired subscriptions."""
        self._data["status"] = "expired"
        self._data["end_date"] = "2024-12-31"
        return self

    def build(self) -> dict[str, Any]:
        """Build the subscription data."""
        return self._data.copy()
```

**Usage:**
```python
def test_cancel_subscription():
    # ✅ Readable and maintainable
    subscription = (
        SubscriptionBuilder()
        .with_plan("premium")
        .with_status("active")
        .build()
    )

def test_expired_subscription():
    # ✅ Expressive
    subscription = SubscriptionBuilder().expired().build()
```

---

## 2. Fixture Factories

### Problem
Need many variations of the same fixture:

```python
# ❌ Lots of similar fixtures
@pytest.fixture
def active_user():
    return User(status="active")

@pytest.fixture
def inactive_user():
    return User(status="inactive")

@pytest.fixture
def admin_user():
    return User(status="active", role="admin")
```

### Solution: Factory Fixture

```python
# conftest.py
@pytest.fixture
def user_factory(async_db_session):
    """Factory for creating test users.

    Usage:
        def test_users(user_factory):
            admin = user_factory(role="admin")
            regular = user_factory(role="user")
            inactive = user_factory(status="inactive")
    """
    created_users = []

    def _create_user(
        email: str | None = None,
        role: str = "user",
        status: str = "active",
        **kwargs
    ):
        user = User(
            id=str(uuid4()),
            email=email or f"test_{uuid4().hex[:8]}@example.com",
            role=role,
            status=status,
            **kwargs
        )
        async_db_session.add(user)
        created_users.append(user)
        return user

    yield _create_user

    # Cleanup
    for user in created_users:
        await async_db_session.delete(user)
    await async_db_session.commit()
```

**Usage:**
```python
def test_user_permissions(user_factory):
    admin = user_factory(role="admin")
    regular = user_factory(role="user")

    assert admin.can_delete_users()
    assert not regular.can_delete_users()
```

---

## 3. Shared Test Suites (Mixins)

### Problem
Multiple routers have similar CRUD operations but need to test them all:

```python
# ❌ Duplicate test code across files
class TestCustomerRouter:
    def test_list_customers(self):
        # ... same pattern

    def test_get_customer(self):
        # ... same pattern

class TestProductRouter:
    def test_list_products(self):
        # ... same pattern

    def test_get_product(self):
        # ... same pattern
```

### Solution: Test Mixins

```python
# tests/helpers/test_mixins.py
class ListTestMixin:
    """Mixin providing standard list endpoint tests."""

    resource_name: str  # Must be defined by subclass

    def test_list_returns_array(self, client, mock_service):
        """Test list endpoint returns array."""
        mock_service.list_all = AsyncMock(return_value=[
            {f"{self.resource_name}_id": "1"},
            {f"{self.resource_name}_id": "2"},
        ])

        response = client.get(f"/api/v1/{self.resource_name}s")
        data = self.assert_success(response)

        assert isinstance(data, list)
        assert len(data) == 2

    def test_list_supports_pagination(self, client, mock_service):
        """Test list endpoint supports pagination."""
        mock_service.list_paginated = AsyncMock(return_value={
            "items": [],
            "total": 100,
            "page": 1,
            "per_page": 10
        })

        response = client.get(f"/api/v1/{self.resource_name}s?page=1&per_page=10")
        data = self.assert_success(response)

        assert "items" in data
        assert "total" in data

class GetTestMixin:
    """Mixin providing standard get endpoint tests."""

    resource_name: str

    def test_get_by_id_success(self, client, mock_service):
        """Test get by ID returns resource."""
        mock_service.get_by_id = AsyncMock(return_value={
            f"{self.resource_name}_id": "test123"
        })

        response = client.get(f"/api/v1/{self.resource_name}s/test123")
        data = self.assert_success(response)

        assert data[f"{self.resource_name}_id"] == "test123"
```

**Usage:**
```python
class TestCustomerRouter(RouterTestBase, ListTestMixin, GetTestMixin):
    resource_name = "customer"
    router_module = "customers.router"

    # Get test_list_returns_array, test_list_supports_pagination,
    # test_get_by_id_success automatically!

    # Add custom tests
    def test_customer_specific_feature(self, client):
        pass
```

---

## 4. Custom Assertions

### Problem
Repetitive assertion patterns:

```python
# ❌ Repetitive
assert response.status_code == 200
data = response.json()
assert "id" in data
assert "created_at" in data
assert data["status"] == "active"
```

### Solution: Custom Assertion Library

```python
# tests/helpers/assertions.py
from typing import Any

class ResponseAssertions:
    """Custom assertions for API responses."""

    @staticmethod
    def assert_has_fields(data: dict, *fields: str) -> None:
        """Assert data has all required fields."""
        missing = [f for f in fields if f not in data]
        assert not missing, f"Missing fields: {missing}"

    @staticmethod
    def assert_matches_schema(data: dict, schema: type) -> None:
        """Assert data matches Pydantic schema."""
        try:
            schema(**data)
        except Exception as e:
            raise AssertionError(f"Data doesn't match schema: {e}")

    @staticmethod
    def assert_iso_timestamp(timestamp: str) -> None:
        """Assert string is valid ISO timestamp."""
        from datetime import datetime
        try:
            datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            raise AssertionError(f"Invalid ISO timestamp: {timestamp}")

    @staticmethod
    def assert_uuid(value: str) -> None:
        """Assert string is valid UUID."""
        from uuid import UUID
        try:
            UUID(value)
        except ValueError:
            raise AssertionError(f"Invalid UUID: {value}")

# Convenience functions
def assert_has_fields(data, *fields):
    return ResponseAssertions.assert_has_fields(data, *fields)

def assert_valid_subscription(data):
    """Assert data is a valid subscription response."""
    assert_has_fields(data, "id", "plan_id", "status", "created_at")
    ResponseAssertions.assert_uuid(data["id"])
    ResponseAssertions.assert_iso_timestamp(data["created_at"])
    assert data["status"] in ["active", "cancelled", "expired"]
```

**Usage:**
```python
from tests.helpers.assertions import assert_has_fields, assert_valid_subscription

def test_get_subscription(client):
    response = client.get("/api/v1/subscriptions/123")
    data = self.assert_success(response)

    # ✅ Expressive and reusable
    assert_valid_subscription(data)
```

---

## 5. Test Context Managers

### Problem
Complex test setup/teardown:

```python
# ❌ Messy setup/teardown
def test_with_redis():
    redis = setup_redis()
    cache = setup_cache(redis)
    app = setup_app(cache)

    try:
        # Test
        result = app.do_something()
        assert result
    finally:
        app.cleanup()
        cache.cleanup()
        redis.cleanup()
```

### Solution: Context Managers

```python
# tests/helpers/contexts.py
from contextlib import contextmanager

@contextmanager
def test_environment(
    with_redis: bool = False,
    with_cache: bool = False,
    with_db: bool = True
):
    """Context manager for test environment setup.

    Usage:
        with test_environment(with_redis=True) as env:
            result = env.app.do_something()
            assert result
    """
    resources = {}

    try:
        # Setup
        if with_db:
            resources['db'] = setup_database()

        if with_redis:
            resources['redis'] = setup_redis()

        if with_cache:
            resources['cache'] = setup_cache(resources.get('redis'))

        resources['app'] = setup_app(**resources)

        yield type('Env', (), resources)()

    finally:
        # Cleanup in reverse order
        for resource in reversed(list(resources.values())):
            if hasattr(resource, 'cleanup'):
                resource.cleanup()

@contextmanager
def mock_external_api(api_name: str, responses: dict):
    """Context manager for mocking external APIs.

    Usage:
        with mock_external_api('payment_gateway', {'charge': {'status': 'success'}}):
            result = process_payment()
            assert result.success
    """
    with patch(f'external_apis.{api_name}') as mock:
        mock.configure_mock(**responses)
        yield mock
```

**Usage:**
```python
def test_payment_processing():
    with test_environment(with_redis=True) as env:
        with mock_external_api('stripe', {'charge': {'id': 'ch_123'}}):
            result = env.app.process_payment(amount=100)
            assert result.charge_id == 'ch_123'
```

---

## 6. Parametrized Test Generators

### Problem
Testing many similar scenarios:

```python
# ❌ Repetitive test functions
def test_admin_can_delete():
    assert can_delete(role="admin")

def test_moderator_can_delete():
    assert can_delete(role="moderator")

def test_user_cannot_delete():
    assert not can_delete(role="user")
```

### Solution: Parametrized Tests

```python
import pytest

# Simple parametrization
@pytest.mark.parametrize("role,expected", [
    ("admin", True),
    ("moderator", True),
    ("user", False),
    ("guest", False),
])
def test_delete_permissions(role, expected):
    assert can_delete(role=role) == expected

# Complex parametrization with IDs
@pytest.mark.parametrize("scenario", [
    pytest.param(
        {"status": "active", "balance": 100},
        id="active_with_balance"
    ),
    pytest.param(
        {"status": "active", "balance": 0},
        id="active_no_balance"
    ),
    pytest.param(
        {"status": "suspended", "balance": 100},
        id="suspended_with_balance"
    ),
])
def test_account_scenarios(scenario):
    result = process_account(scenario)
    assert result.is_valid()
```

---

## 7. Snapshot Testing

### Problem
Testing complex JSON responses:

```python
# ❌ Brittle assertions
def test_api_response():
    response = client.get("/api/v1/complex-data")
    data = response.json()

    assert data["id"] == 123
    assert data["nested"]["field1"] == "value1"
    assert data["nested"]["field2"] == "value2"
    # ... 50 more assertions
```

### Solution: Snapshot Testing

```python
# tests/helpers/snapshots.py
import json
from pathlib import Path

class SnapshotTester:
    """Snapshot testing for complex data structures."""

    def __init__(self, snapshot_dir: Path):
        self.snapshot_dir = snapshot_dir
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    def assert_matches_snapshot(
        self,
        data: Any,
        snapshot_name: str,
        update: bool = False
    ):
        """Assert data matches saved snapshot.

        Args:
            data: Data to test
            snapshot_name: Name of snapshot file
            update: If True, update snapshot instead of comparing
        """
        snapshot_file = self.snapshot_dir / f"{snapshot_name}.json"

        if update or not snapshot_file.exists():
            # Save new snapshot
            with open(snapshot_file, 'w') as f:
                json.dump(data, f, indent=2, sort_keys=True)
            return

        # Load and compare
        with open(snapshot_file) as f:
            expected = json.load(f)

        assert data == expected, f"Snapshot mismatch: {snapshot_name}"

# Fixture
@pytest.fixture
def snapshot(request):
    """Provide snapshot tester."""
    test_file = Path(request.fspath)
    snapshot_dir = test_file.parent / "__snapshots__" / test_file.stem
    return SnapshotTester(snapshot_dir)
```

**Usage:**
```python
def test_complex_api_response(client, snapshot):
    response = client.get("/api/v1/complex-data")
    data = response.json()

    # ✅ Simple assertion, complex validation
    snapshot.assert_matches_snapshot(data, "complex_data_response")

    # To update snapshot: pytest --update-snapshots
```

---

## 8. Test Tags/Markers

### Problem
Can't selectively run tests:

```python
# Want to run only fast tests, or only integration tests
pytest tests/  # Runs everything (slow)
```

### Solution: Custom Markers

```python
# pytest.ini or pyproject.toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests as integration tests",
    "unit: marks tests as unit tests",
    "requires_redis: marks tests that need Redis",
    "requires_db: marks tests that need database",
    "smoke: marks tests as smoke tests",
]

# In tests
@pytest.mark.unit
@pytest.mark.fast
def test_validation():
    assert validate_email("test@example.com")

@pytest.mark.integration
@pytest.mark.slow
@pytest.mark.requires_db
def test_full_workflow(db_session):
    # Integration test
    pass

@pytest.mark.smoke
def test_app_starts():
    # Critical smoke test
    pass
```

**Usage:**
```bash
# Run only fast tests
pytest -m "not slow"

# Run only integration tests
pytest -m integration

# Run only tests that don't require external services
pytest -m "not requires_redis and not requires_db"

# Run smoke tests
pytest -m smoke

# Run unit tests only
pytest -m unit
```

---

## 9. Property-Based Testing

### Problem
Testing edge cases is hard:

```python
# ❌ Only tests specific cases
def test_string_reversal():
    assert reverse("abc") == "cba"
    assert reverse("") == ""
    # What about unicode? Long strings? Special chars?
```

### Solution: Hypothesis (Property-Based Testing)

```python
from hypothesis import given, strategies as st

@given(st.text())
def test_reverse_property(s):
    """Test that reversing twice returns original."""
    # ✅ Tests thousands of random strings
    assert reverse(reverse(s)) == s

@given(st.integers(min_value=0, max_value=1000))
def test_amount_validation(amount):
    """Test amount validation with many values."""
    if amount > 0:
        assert validate_amount(amount) is True
    else:
        assert validate_amount(amount) is False

@given(
    st.emails(),
    st.text(min_size=8, max_size=50)
)
def test_user_creation(email, password):
    """Test user creation with random valid inputs."""
    user = create_user(email=email, password=password)
    assert user.email == email
    assert user.password != password  # Should be hashed
```

---

## 10. Test Containers Pattern

### Problem
Need real databases/services for integration tests:

```python
# ❌ Requires manual setup
def test_with_postgres():
    # Assumes postgres is running on localhost:5432
    conn = psycopg2.connect("postgresql://localhost/test")
```

### Solution: Testcontainers

```python
# conftest.py
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

@pytest.fixture(scope="session")
def postgres_container():
    """Provide PostgreSQL container for tests."""
    with PostgresContainer("postgres:15") as postgres:
        yield postgres

@pytest.fixture(scope="session")
def redis_container():
    """Provide Redis container for tests."""
    with RedisContainer("redis:7") as redis:
        yield redis

@pytest.fixture
def db_connection(postgres_container):
    """Provide database connection."""
    conn = psycopg2.connect(postgres_container.get_connection_url())
    yield conn
    conn.close()
```

**Usage:**
```python
def test_real_database(db_connection):
    # ✅ Real PostgreSQL running in Docker
    cursor = db_connection.cursor()
    cursor.execute("SELECT 1")
    assert cursor.fetchone()[0] == 1
```

---

## Implementation Priority

### High Priority (Immediate Value)
1. ✅ **Test Data Builders** - Reduce boilerplate significantly
2. ✅ **Fixture Factories** - More flexible than individual fixtures
3. ✅ **Custom Assertions** - Improve test readability
4. ✅ **Test Markers** - Better test organization and CI performance

### Medium Priority (After Initial Adoption)
5. ✅ **Shared Test Suites (Mixins)** - DRY principle for tests
6. ✅ **Parametrized Tests** - Test more scenarios with less code
7. ✅ **Test Context Managers** - Cleaner setup/teardown

### Lower Priority (Nice to Have)
8. ⏸️ **Snapshot Testing** - Useful for complex API responses
9. ⏸️ **Property-Based Testing** - Great for algorithms, validation
10. ⏸️ **Test Containers** - For full integration tests

---

## Summary

| Pattern | Benefit | Complexity | ROI |
|---------|---------|------------|-----|
| Test Data Builders | High | Low | ⭐⭐⭐⭐⭐ |
| Fixture Factories | High | Low | ⭐⭐⭐⭐⭐ |
| Custom Assertions | Medium | Low | ⭐⭐⭐⭐ |
| Test Markers | High | Very Low | ⭐⭐⭐⭐⭐ |
| Shared Test Suites | High | Medium | ⭐⭐⭐⭐ |
| Parametrized Tests | Medium | Low | ⭐⭐⭐⭐ |
| Test Contexts | Medium | Medium | ⭐⭐⭐ |
| Snapshot Testing | Medium | Medium | ⭐⭐⭐ |
| Property-Based | High (for algorithms) | High | ⭐⭐⭐ |
| Test Containers | Very High | High | ⭐⭐⭐⭐ |

---

## Next Steps

1. Implement **Test Data Builders** for common models
2. Add **Fixture Factories** for users, tenants, subscriptions
3. Create **Custom Assertions** library
4. Define **Test Markers** in pytest.ini
5. Gradually adopt other patterns as needed

Want me to implement any of these patterns for your test suite?
