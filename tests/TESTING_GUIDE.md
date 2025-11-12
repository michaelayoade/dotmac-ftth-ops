# Testing Guide

This guide documents testing patterns and best practices derived from fixing 31 test failures and 2 production bugs in the dotmac-ftth-ops project.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Router Testing Patterns](#router-testing-patterns)
3. [Authentication & Tenant Headers](#authentication--tenant-headers)
4. [Schema Validation](#schema-validation)
5. [Common Pitfalls](#common-pitfalls)
6. [Testing Tools](#testing-tools)
7. [Examples](#examples)

---

## Quick Start

### Simple Router Test

```python
from tests.helpers.router_base import RouterTestBase

class TestMyRouter(RouterTestBase):
    router_module = "dotmac.platform.mymodule.router"
    router_name = "router"
    router_prefix = "/mymodule"

    def test_health_endpoint(self, client):
        response = client.get("/api/v1/mymodule/health")
        self.assert_success(response)
```

### Router Test with Service Mocking

```python
from tests.helpers.router_base import RouterWithServiceTestBase

class TestCustomerRouter(RouterWithServiceTestBase):
    router_module = "dotmac.platform.customer_management.router"
    router_name = "router"
    router_prefix = "/customers"
    service_module = "dotmac.platform.customer_management.router"
    service_dependency_name = "get_customer_service"

    def test_list_customers(self, client, mock_service):
        # Configure mock
        mock_service.list.return_value = [
            {"id": "1", "name": "Test Customer"}
        ]

        response = client.get("/api/v1/customers")
        data = self.assert_success(response)
        assert len(data) == 1
```

### CRUD Router Testing

```python
from tests.helpers.router_base import CRUDRouterTestBase

class TestProductRouter(CRUDRouterTestBase):
    router_module = "dotmac.platform.products.router"
    router_name = "router"
    router_prefix = "/products"
    resource_name = "product"

    def get_sample_data(self):
        return {"name": "Widget", "price": 99.99}

    # Inherits test_list_resources, test_get_resource_success,
    # test_get_resource_not_found, test_create_resource,
    # test_update_resource, test_delete_resource
```

---

## Router Testing Patterns

### Pattern 1: Always Use `test_app` Fixture

**DO THIS:**
```python
def test_my_endpoint(test_app: FastAPI):
    from mymodule import router
    test_app.include_router(router, prefix="/api/v1")
    client = TestClient(test_app)
    response = client.get("/api/v1/myroute", headers={"X-Tenant-ID": "test"})
```

**NOT THIS:**
```python
def test_my_endpoint():
    app = FastAPI()  # ❌ Missing middleware
    app.include_router(router)
    client = TestClient(app)
    response = client.get("/api/v1/myroute")  # ❌ No tenant header
```

**Why:** The `test_app` fixture from `conftest.py` includes:
- Tenant middleware
- Authentication overrides
- RBAC bypass for testing
- Database session management

### Pattern 2: Register Router with Correct Prefix

**DO THIS:**
```python
# Router already has /access prefix defined in router.py
test_app.include_router(access_router, prefix="/api/v1")
# Final path: /api/v1/access/...
```

**NOT THIS:**
```python
# ❌ Double prefix!
test_app.include_router(access_router, prefix="/api/v1/access")
# Final path: /api/v1/access/access/...
```

**Why:** Routers define their own prefixes. Don't duplicate them.

### Pattern 3: Auto-Add Tenant Headers

**DO THIS:**
```python
client = TestClient(test_app)

# Wrap request method
original_request = client.request

def request_with_tenant(method, url, **kwargs):
    headers = kwargs.get('headers', {})
    if 'X-Tenant-ID' not in headers:
        headers['X-Tenant-ID'] = 'test-tenant'
    kwargs['headers'] = headers
    return original_request(method, url, **kwargs)

client.request = request_with_tenant
```

**NOT THIS:**
```python
# ❌ Forgetting tenant header in every test
response = client.get("/api/v1/resource")  # 403 Forbidden!
```

**Why:** Multi-tenant architecture requires `X-Tenant-ID` header on all requests.

---

## Authentication & Tenant Headers

### The 403 Forbidden Problem

**Symptom:** All tests failing with 403 Forbidden errors

**Root Cause:** One of:
1. Missing `X-Tenant-ID` header
2. Not using `test_app` fixture (missing auth middleware)
3. Not overriding authentication dependency

**Solution:**
```python
@pytest.fixture
def client(test_app: FastAPI, test_user: UserInfo):
    # 1. Override authentication
    from dotmac.platform.auth.core import get_current_user
    test_app.dependency_overrides[get_current_user] = lambda: test_user

    # 2. Register router
    test_app.include_router(router, prefix="/api/v1")

    # 3. Add tenant header wrapper
    client = TestClient(test_app)
    original_request = client.request

    def request_with_tenant(method, url, **kwargs):
        headers = kwargs.get('headers', {})
        if 'X-Tenant-ID' not in headers:
            headers['X-Tenant-ID'] = 'test-tenant'
        kwargs['headers'] = headers
        return original_request(method, url, **kwargs)

    client.request = request_with_tenant

    yield client

    # 4. Cleanup
    test_app.dependency_overrides.clear()
```

### Test User Setup

```python
@pytest.fixture
def test_user() -> UserInfo:
    return UserInfo(
        user_id=str(uuid4()),
        tenant_id="test-tenant",
        email="test@example.com",
        is_platform_admin=True,  # Important for testing
        username="testuser",
        roles=["admin"],
        permissions=["read", "write", "admin"],
    )
```

---

## Schema Validation

### The Pydantic ValidationError Problem

**Symptom:** Tests fail with `ValidationError: X validation errors for YSchema`

**Root Cause:** Mock data doesn't match actual Pydantic schema

**Solution: Read the Schema First!**

```python
# 1. Read actual schema definition
from dotmac.platform.access.drivers import OltMetrics

# OltMetrics schema has:
# - olt_id: str
# - pon_ports_up: int
# - pon_ports_total: int
# - onu_online: int
# - onu_total: int
# - upstream_rate_mbps: float | None
# - downstream_rate_mbps: float | None
# - raw: dict

# 2. Create mock data that matches EXACTLY
mock_service.collect_metrics = AsyncMock(
    return_value=OltMetrics(
        olt_id="olt1",           # ✅ Required field
        pon_ports_up=8,          # ✅ Required field
        pon_ports_total=8,       # ✅ Required field
        onu_online=5,            # ✅ Required field
        onu_total=5,             # ✅ Required field
        upstream_rate_mbps=1000.0,  # ✅ Optional but correct type
        downstream_rate_mbps=2500.0, # ✅ Optional but correct type
        # ❌ DON'T add fields that don't exist:
        # cpu_usage=45.2,  # Not in schema!
        # memory_usage=60.5,  # Not in schema!
    )
)
```

### Using Contract Testing

```python
from tests.helpers.contract_testing import (
    SchemaValidator,
    MockDataFactory,
    validate_mock_against_schema
)

# Option 1: Validate manually created mock data
validator = SchemaValidator(OltMetrics)
mock_data = {
    "olt_id": "olt1",
    "pon_ports_up": 8,
    "pon_ports_total": 8,
    "onu_online": 5,
    "onu_total": 5,
}
validator.validate(mock_data)  # Raises SchemaValidationError if invalid

# Option 2: Generate valid mock data automatically
mock_data = MockDataFactory.create(OltMetrics, olt_id="olt1")
# Automatically includes all required fields with sensible defaults

# Option 3: Quick validation check
is_valid, error = validate_mock_against_schema(mock_data, OltMetrics)
if not is_valid:
    print(f"Mock data invalid: {error}")
```

### Common Schema Mistakes

#### Mistake 1: Wrong Field Names

```python
# ❌ WRONG
OLTOverview(
    olt_id="olt1",           # Schema has device_id, not olt_id
    active_onus=4,           # Schema has online_onus, not active_onus
    status="ACTIVE",         # Schema doesn't have status field
)

# ✅ CORRECT - Read schema first!
OLTOverview(
    device_id="olt1",        # Actual field name
    online_onus=4,           # Actual field name
    # Don't include fields that don't exist
)
```

#### Mistake 2: Wrong Field Types

```python
# ❌ WRONG
OLTOverview(
    pon_ports=8,             # Schema expects list, not int
)

# ✅ CORRECT
OLTOverview(
    pon_ports=[],            # Correct type
)
```

#### Mistake 3: Missing Required Fields

```python
# ❌ WRONG - Missing required fields
OLTOverview(
    device_id="olt1",
    # Missing: serial_number, model, firmware_version, admin_state,
    # oper_status, connect_status, total_pon_ports, active_pon_ports,
    # total_onus, online_onus
)

# ✅ CORRECT - Include all required fields
OLTOverview(
    device_id="olt1",
    serial_number="ABC123",
    model="OLT-4000",
    firmware_version="1.0.0",
    admin_state="ENABLED",
    oper_status="ACTIVE",
    connect_status="REACHABLE",
    total_pon_ports=8,
    active_pon_ports=8,
    total_onus=5,
    online_onus=4,
    pon_ports=[],
)
```

#### Mistake 4: Data in Wrong Location

```python
# ❌ WRONG - DeviceDiscovery puts vendor as direct field
DeviceDiscovery(
    onu_id="1",
    serial_number="ABC",
    state="ACTIVE",
    vendor="Huawei",  # ❌ Not a direct field!
)

# ✅ CORRECT - Vendor goes in metadata
DeviceDiscovery(
    onu_id="1",
    serial_number="ABC",
    state="ACTIVE",
    rssi=-25.5,
    metadata={"vendor": "Huawei", "model": "HG8310M"},  # ✅ Correct
)

# Assertions must also use metadata
assert data["metadata"]["vendor"] == "Huawei"  # Not data["vendor"]
```

---

## Common Pitfalls

### Pitfall 1: Creating Custom FastAPI Apps

**Problem:**
```python
@pytest.fixture
def app():
    app = FastAPI()  # ❌ Missing critical middleware
    return app
```

**Solution:** Always use `test_app` from `conftest.py`

### Pitfall 2: Forgetting to Clean Up Overrides

**Problem:**
```python
def test_something(test_app):
    test_app.dependency_overrides[get_service] = lambda: mock_service
    # ❌ Test ends without cleanup
    # Next test will use stale overrides!
```

**Solution:**
```python
def test_something(test_app):
    test_app.dependency_overrides[get_service] = lambda: mock_service

    # ... test code ...

    # ✅ Always cleanup
    test_app.dependency_overrides.clear()
```

Or use fixture with automatic cleanup:
```python
@pytest.fixture
def client(test_app):
    # Setup
    test_app.dependency_overrides[...] = ...

    yield client

    # ✅ Automatic cleanup
    test_app.dependency_overrides.clear()
```

### Pitfall 3: Hardcoding Assumptions About Schemas

**Problem:**
```python
# ❌ Assuming schema has these fields without checking
assert data["cpu_usage"] == 45.2
assert data["memory_usage"] == 60.5
```

**Solution:**
```python
# ✅ Read schema definition first
# Then assert only on fields that actually exist
assert data["olt_id"] == "olt1"
assert data["pon_ports_up"] == 8
```

### Pitfall 4: Not Testing Response Schemas

**Problem:**
```python
def test_endpoint(client):
    response = client.get("/api/v1/resource")
    assert response.status_code == 200
    # ❌ Not validating response structure
```

**Solution:**
```python
from tests.helpers.contract_testing import ContractTestCase

class TestMyRouter(ContractTestCase):
    def test_endpoint(self, client):
        response = client.get("/api/v1/resource")

        # ✅ Validates response matches schema
        validated_data = self.assert_response_schema(response, MySchema)

        # Can now safely access fields
        assert validated_data.field_name == expected_value
```

---

## Testing Tools

### RouterTestBase

Provides standard router testing patterns:

```python
from tests.helpers.router_base import RouterTestBase

class TestMyRouter(RouterTestBase):
    router_module = "dotmac.platform.mymodule.router"

    def test_success(self, client):
        response = client.get("/api/v1/path")
        self.assert_success(response)  # Asserts 200 and returns JSON

    def test_not_found(self, client):
        response = client.get("/api/v1/missing")
        self.assert_not_found(response, "resource")  # Asserts 404

    def test_validation(self, client):
        response = client.post("/api/v1/path", json={})
        self.assert_validation_error(response)  # Asserts 422
```

Available assertions:
- `assert_success(response, status_code=200)` - Assert 2xx success
- `assert_error(response, status_code, expected_detail=None)` - Assert error
- `assert_unauthorized(response)` - Assert 401
- `assert_forbidden(response)` - Assert 403
- `assert_not_found(response, entity=None)` - Assert 404
- `assert_validation_error(response)` - Assert 422
- `assert_not_implemented(response)` - Assert 501
- `assert_fields_present(data, *fields)` - Assert fields exist
- `assert_schema_match(data, schema)` - Assert data matches schema

### SchemaValidator

Validates mock data against Pydantic schemas:

```python
from tests.helpers.contract_testing import SchemaValidator

validator = SchemaValidator(MySchema)

# Check what fields are required
required = validator.get_required_fields()
optional = validator.get_optional_fields()
types = validator.get_field_types()

# Compare data against schema
diagnostics = validator.compare_data(mock_data)
print(f"Missing required: {diagnostics['missing_required']}")
print(f"Extra fields: {diagnostics['extra_fields']}")
print(f"Type mismatches: {diagnostics['type_mismatches']}")

# Validate data
try:
    validator.validate(mock_data)
except SchemaValidationError as e:
    print(f"Validation failed: {e}")
```

### MockDataFactory

Generates valid mock data from schemas:

```python
from tests.helpers.contract_testing import MockDataFactory

# Generate with defaults
mock_data = MockDataFactory.create(OltMetrics)

# Override specific fields
mock_data = MockDataFactory.create(
    OltMetrics,
    olt_id="custom-olt",
    pon_ports_up=10
)

# Create actual instance
instance = MockDataFactory.create_instance(OltMetrics, olt_id="test")
```

---

## Examples

### Example 1: Simple Router Test

```python
from tests.helpers.router_base import RouterTestBase

class TestHealthRouter(RouterTestBase):
    router_module = "dotmac.platform.health.router"
    router_name = "router"
    router_prefix = "/health"

    def test_health_check(self, client):
        response = client.get("/api/v1/health")
        data = self.assert_success(response)
        assert data["status"] == "healthy"
```

### Example 2: Router with Service Dependency

```python
from tests.helpers.router_base import RouterWithServiceTestBase
from unittest.mock import AsyncMock

class TestUserRouter(RouterWithServiceTestBase):
    router_module = "dotmac.platform.users.router"
    router_name = "router"
    router_prefix = "/users"
    service_module = "dotmac.platform.users.router"
    service_dependency_name = "get_user_service"

    def test_get_user(self, client, mock_service):
        # Mock service returns user
        mock_service.get.return_value = {
            "id": "123",
            "name": "Test User",
            "email": "test@example.com"
        }

        response = client.get("/api/v1/users/123")
        data = self.assert_success(response)

        assert data["name"] == "Test User"
        mock_service.get.assert_called_once_with("123")
```

### Example 3: Using Contract Testing

```python
from tests.helpers.router_base import RouterTestBase
from tests.helpers.contract_testing import (
    MockDataFactory,
    ContractTestCase
)
from myapp.schemas import CustomerSchema

class TestCustomerRouter(RouterTestBase, ContractTestCase):
    router_module = "dotmac.platform.customers.router"
    router_prefix = "/customers"

    def test_list_customers(self, client, mock_service):
        # Generate valid mock data
        customer1 = MockDataFactory.create(CustomerSchema, name="Alice")
        customer2 = MockDataFactory.create(CustomerSchema, name="Bob")

        mock_service.list.return_value = [customer1, customer2]

        response = client.get("/api/v1/customers")

        # Validate response matches schema
        customers = self.assert_response_schema(response, list[CustomerSchema])

        assert len(customers) == 2
        assert customers[0].name == "Alice"
```

### Example 4: Testing Error Cases

```python
from tests.helpers.router_base import RouterTestBase

class TestOrderRouter(RouterTestBase):
    router_module = "dotmac.platform.orders.router"
    router_prefix = "/orders"

    def test_get_order_not_found(self, client, mock_service):
        mock_service.get.return_value = None

        response = client.get("/api/v1/orders/nonexistent")
        self.assert_not_found(response, "order")

    def test_create_order_validation_error(self, client):
        # Missing required fields
        response = client.post("/api/v1/orders", json={})
        self.assert_validation_error(response)

    def test_unauthorized_access(self, client):
        # Remove auth override for this test
        client._transport.app.dependency_overrides.clear()

        response = client.get("/api/v1/orders/123")
        self.assert_unauthorized(response)
```

---

## Summary: The Test Pattern Checklist

When writing router tests, follow this checklist:

- [ ] Use `test_app` fixture (never create custom FastAPI app)
- [ ] Use `RouterTestBase` or similar helper class
- [ ] Add tenant header automatically (wrapper or base class)
- [ ] Override authentication with `test_user`
- [ ] Register router with correct prefix (no double prefix)
- [ ] Read actual schema definitions before creating mocks
- [ ] Use `MockDataFactory` to generate valid mock data
- [ ] Validate mock data with `SchemaValidator`
- [ ] Use assertion helpers (`assert_success`, `assert_not_found`, etc.)
- [ ] Clean up dependency overrides after test
- [ ] Test both success and error cases
- [ ] Validate response schemas with contract testing

Following these patterns will prevent 90%+ of common test failures and ensure consistent, maintainable tests.
