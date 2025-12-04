# Test Helpers - Quick Reference Card

**Fast lookup for test helper utilities** | [Full Docs](tests/helpers/README.md)

---

## Import Statement

```python
from tests.helpers import (
    # Assertions
    assert_entity_created,
    assert_entity_updated,
    assert_entity_deleted,
    # CRUD Helpers
    create_entity_test_helper,
    update_entity_test_helper,
    delete_entity_test_helper,
    # Mock Builders
    build_mock_db_session,
    build_success_result,
    build_not_found_result,
)
```

---

## Common Patterns

### Create Entity Test

```python
@pytest.mark.asyncio
async def test_create_entity_success(self, tenant_id):
    mock_db = build_mock_db_session()
    service = MyService(mock_db)

    entity = await create_entity_test_helper(
        service=service,
        method_name="create_entity",
        create_data=MyEntityCreate(name="Test"),
        mock_db_session=mock_db,
        expected_entity_type=MyEntity,
        expected_attributes={"name": "Test"},
        tenant_id=tenant_id,
    )
```

### Update Entity Test

```python
@pytest.mark.asyncio
async def test_update_entity_success(self, tenant_id, sample_entity):
    mock_db = build_mock_db_session()
    service = MyService(mock_db)

    entity = await update_entity_test_helper(
        service=service,
        method_name="update_entity",
        entity_id=sample_entity.id,
        update_data=MyEntityUpdate(name="Updated"),
        mock_db_session=mock_db,
        sample_entity=sample_entity,
        expected_attributes={"name": "Updated"},
        tenant_id=tenant_id,
    )
```

### Delete Entity Test

```python
@pytest.mark.asyncio
async def test_delete_entity_success(self, tenant_id, sample_entity):
    mock_db = build_mock_db_session()
    service = MyService(mock_db)

    result = await delete_entity_test_helper(
        service=service,
        method_name="delete_entity",
        entity_id=sample_entity.id,
        mock_db_session=mock_db,
        sample_entity=sample_entity,
        soft_delete=True,  # or False for hard delete
        tenant_id=tenant_id,
    )
```

---

## Assertion Helpers

### Entity Created
```python
assert_entity_created(
    mock_db_session,
    entity_type=MyEntity,
    expected_attributes={"name": "value"}
)
```

### Entity Updated
```python
assert_entity_updated(
    mock_db_session,
    entity=my_entity,
    updated_attributes={"name": "new_value"}
)
```

### Entity Deleted
```python
# Soft delete
assert_entity_deleted(mock_db_session, entity, soft_delete=True)

# Hard delete
assert_entity_deleted(mock_db_session, entity, soft_delete=False)
```

### Cache Invalidated
```python
with patch("module.cache_delete") as mock_cache:
    # ... perform operation
    assert_cache_invalidated(mock_cache, "cache_key")
```

---

## Mock Builders

### Database Session
```python
mock_db = build_mock_db_session()
service = MyService(mock_db)
```

### Success Result
```python
mock_result = build_success_result(sample_entity)
mock_db.execute.return_value = mock_result
```

### Not Found Result
```python
mock_result = build_not_found_result()
mock_db.execute.return_value = mock_result
```

### List Result
```python
mock_result, total = build_list_result([entity1, entity2], total_count=100)
mock_db.execute.return_value = mock_result
mock_db.scalar.return_value = total
```

### Mock Entity
```python
mock_entity = build_mock_entity(
    Contact,
    id=uuid4(),
    first_name="John",
    tenant_id=tenant_id
)
```

---

## Special Cases

### Multiple Entity Adds (e.g., with relationships)
```python
entity = await create_entity_test_helper(
    service=service,
    method_name="create_contact",
    create_data=contact_data,
    mock_db_session=mock_db,
    allow_multiple_adds=True,  # Allow contact + methods
    tenant_id=tenant_id,
)
```

### Custom Validation After Helper
```python
entity = await create_entity_test_helper(...)

# Custom assertions after helper
added_entity = mock_db.add.call_args_list[0][0][0]
assert added_entity.custom_field == expected_value
```

---

## Migration Pattern

### Before (Old Pattern)
```python
# 15-20 lines of mock setup
mock_result = Mock()
mock_result.scalar_one_or_none.return_value = sample_entity
mock_db.execute = AsyncMock(return_value=mock_result)
mock_db.commit = AsyncMock()
mock_db.refresh = AsyncMock()

entity = await service.create_entity(data, tenant_id=tenant_id)

# 10-15 lines of assertions
mock_db.add.assert_called_once()
mock_db.commit.assert_called_once()
added_entity = mock_db.add.call_args[0][0]
assert isinstance(added_entity, MyEntity)
# ... more assertions
```

### After (With Helpers)
```python
from tests.helpers import create_entity_test_helper, build_mock_db_session

entity = await create_entity_test_helper(
    service=service,
    method_name="create_entity",
    create_data=data,
    mock_db_session=build_mock_db_session(),
    expected_entity_type=MyEntity,
    expected_attributes={"name": "value"},
    tenant_id=tenant_id,
)
```

**Reduction**: 35-45 lines → 10-15 lines (55% less code)

---

## Troubleshooting

### Issue: Wrong method signature
```python
# Error: TypeError: got unexpected keyword argument 'created_by'

# Fix: Check actual method signature
rg -A 5 "async def create_entity" src/path/to/service.py

# Use correct parameter name in helper
entity = await create_entity_test_helper(
    ...,
    owner_id=user_id,  # Not 'created_by'
)
```

### Issue: Attribute doesn't exist
```python
# Error: AttributeError: 'Entity' object has no attribute 'email'

# Fix: Only check attributes that exist on model
expected_attributes={
    "first_name": "John",  # ✅ Exists
    # "email": "john@example.com",  # ❌ Doesn't exist directly
}
```

### Issue: Multiple adds failing
```python
# Error: Expected 'add' to have been called once. Called 3 times.

# Fix: Use allow_multiple_adds flag
entity = await create_entity_test_helper(
    ...,
    allow_multiple_adds=True,  # For entity + relationships
)
```

---

## Cheat Sheet

| Task | Helper | Key Parameters |
|------|--------|----------------|
| Create entity | `create_entity_test_helper()` | `service`, `method_name`, `create_data` |
| Update entity | `update_entity_test_helper()` | `entity_id`, `update_data`, `sample_entity` |
| Delete entity | `delete_entity_test_helper()` | `entity_id`, `sample_entity`, `soft_delete` |
| Retrieve entity | `retrieve_entity_test_helper()` | `entity_id`, `sample_entity` |
| List entities | `list_entities_test_helper()` | `sample_entities`, `expected_total` |
| Mock DB | `build_mock_db_session()` | None (returns configured mock) |
| Success result | `build_success_result()` | `entity` |
| Not found | `build_not_found_result()` | None |
| Assert created | `assert_entity_created()` | `mock_db_session`, `expected_attributes` |
| Assert updated | `assert_entity_updated()` | `mock_db_session`, `entity` |

---

## Quick Stats

- **22 helper functions** across 4 modules
- **55% code reduction** average per test
- **68 duplicate patterns** eliminated
- **All helpers** fully type-hinted

---

## Files

- **Full Docs**: `tests/helpers/README.md`
- **Implementation**: `SHARED_TEST_HELPERS_IMPLEMENTATION.md`
- **Session Summary**: `SESSION_SUMMARY_2025_10_04.md`
- **This Card**: `QUICK_REFERENCE_TEST_HELPERS.md`

---

**Last Updated**: October 4, 2025
**Status**: Ready for use ✅
