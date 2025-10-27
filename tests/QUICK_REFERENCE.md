# Testing Quick Reference

One-page reference for router testing patterns.

## Basic Router Test

```python
from tests.helpers.router_base import RouterTestBase

class TestMyRouter(RouterTestBase):
    router_module = "dotmac.platform.mymodule.router"
    router_prefix = "/mymodule"

    def test_endpoint(self, client):
        response = client.get("/api/v1/mymodule/health")
        self.assert_success(response)
```

## CRUD Router Test

```python
from tests.helpers.router_base import CRUDRouterTestBase

class TestMyRouter(CRUDRouterTestBase):
    router_module = "dotmac.platform.mymodule.router"
    router_prefix = "/resources"
    resource_name = "resource"

    def get_sample_data(self):
        return {"name": "Test"}
```

## Router with Service Mock

```python
from tests.helpers.router_base import RouterWithServiceTestBase

class TestMyRouter(RouterWithServiceTestBase):
    router_module = "dotmac.platform.mymodule.router"
    router_prefix = "/resources"
    service_module = "dotmac.platform.mymodule.router"
    service_dependency_name = "get_service"

    def test_list(self, client, mock_service):
        mock_service.list.return_value = [{"id": "1"}]
        response = client.get("/api/v1/resources")
        self.assert_success(response)
```

## Contract Testing

```python
from tests.helpers.contract_testing import MockDataFactory, SchemaValidator

# Generate valid mock data
mock = MockDataFactory.create(MySchema, field="value")

# Validate mock data
validator = SchemaValidator(MySchema)
validator.validate(mock)

# In tests
from tests.helpers.contract_testing import ContractTestCase

class TestMyRouter(RouterTestBase, ContractTestCase):
    def test_endpoint(self, client):
        response = client.get("/api/v1/resource")
        data = self.assert_response_schema(response, MySchema)
```

## Common Assertions

```python
# Success cases
data = self.assert_success(response)              # 200 OK
data = self.assert_success(response, 201)         # 201 Created

# Error cases
self.assert_not_found(response, "resource")       # 404
self.assert_unauthorized(response)                # 401
self.assert_forbidden(response)                   # 403
self.assert_validation_error(response)            # 422
self.assert_not_implemented(response)             # 501

# Field validation
self.assert_fields_present(data, "id", "name")
self.assert_schema_match(data, MySchema)
```

## Anti-Patterns to Avoid

```python
# ❌ DON'T: Create custom FastAPI app
app = FastAPI()

# ✅ DO: Use test_app fixture
def test_something(test_app):

# ❌ DON'T: Forget tenant header
response = client.get("/api/v1/resource")

# ✅ DO: Use base class (auto-adds header)
class TestMyRouter(RouterTestBase):

# ❌ DON'T: Hardcode mock data fields
mock = {"cpu_usage": 45, "wrong_field": True}

# ✅ DO: Read schema and use MockDataFactory
mock = MockDataFactory.create(MySchema)

# ❌ DON'T: Use wrong field names
OLTOverview(olt_id="1", active_onus=4)

# ✅ DO: Match exact schema fields
OLTOverview(device_id="1", online_onus=4)
```

## Debugging Checklist

**403 Forbidden?**
- [ ] Using test_app fixture?
- [ ] Tenant header added?
- [ ] Auth override configured?

**ValidationError?**
- [ ] Read actual schema definition?
- [ ] All required fields included?
- [ ] Field names match schema exactly?
- [ ] Field types correct?

**KeyError in response?**
- [ ] Response schema matches expectations?
- [ ] Field in metadata instead of top-level?
- [ ] Field name different than assumed?

## File Locations

- Base classes: `tests/helpers/router_base.py`
- Contract testing: `tests/helpers/contract_testing.py`
- Full guide: `tests/TESTING_GUIDE.md`
- Examples: `tests/examples/example_router_test.py`
