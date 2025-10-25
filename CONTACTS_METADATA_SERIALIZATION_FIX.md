# Contacts Metadata Serialization Fix

## Issue Description

**Priority**: HIGH

**Location**: `src/dotmac/platform/contacts/schemas.py` (lines 34, 62, 117, 196, 263, 287, 327, 359, 389)

**Problem**: Response models were returning `null` for metadata even when the ORM column `metadata_` was populated with data.

### Root Cause

The schema fields were using only `validation_alias=AliasChoices("metadata_", "metadata")` which:
- ✅ Allows requests to send either "metadata" or "metadata_" as field names
- ❌ Does NOT tell Pydantic where to read the attribute from when using `from_attributes=True`

When `ContactResponse.model_validate(contact, from_attributes=True)` was called:
1. Pydantic looked for `contact.metadata` attribute (doesn't exist)
2. The ORM object has `contact.metadata_` attribute (exists, but Pydantic doesn't know to use it)
3. Result: `metadata` field serialized as `null`

### The SQLAlchemy-Pydantic Mismatch

**SQLAlchemy ORM**:
```python
# In models.py
metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)
```
- Python attribute: `metadata_`
- Database column: `metadata`

**Pydantic Response Model (BEFORE fix)**:
```python
metadata: dict[str, Any] | None = Field(
    None,
    validation_alias=AliasChoices("metadata_", "metadata")
)
```
- JSON field: `metadata`
- Reads from object attribute: `metadata` (doesn't exist!)

## Solution

Added `serialization_alias="metadata"` to properly configure Pydantic v2's dual-direction aliasing:

```python
metadata: dict[str, Any] | None = Field(
    None,
    validation_alias=AliasChoices("metadata_", "metadata"),  # Input: accept either name
    serialization_alias="metadata"                            # Output: serialize as "metadata"
)
```

### How This Works

**Pydantic v2 Alias System**:
1. **`validation_alias`**: Maps incoming request data to model fields
   - `AliasChoices("metadata_", "metadata")` = accept both field names in requests

2. **`serialization_alias`**: Maps model fields to outgoing response data
   - `"metadata"` = always serialize as "metadata" in JSON responses

3. **`from_attributes=True`**: Special mode for ORM integration
   - When enabled, Pydantic reads from object attributes
   - With proper aliases configured, it reads from `metadata_` attribute
   - Serializes it to JSON as `"metadata"`

## Files Changed

### src/dotmac/platform/contacts/schemas.py

Updated 9 schema classes with metadata field:

1. **ContactMethodBase** (line 34)
2. **ContactMethodUpdate** (line 62)
3. **ContactBase** (line 117)
4. **ContactUpdate** (line 196)
5. **ContactLabelDefinitionBase** (line 263)
6. **ContactLabelDefinitionUpdate** (line 287)
7. **ContactFieldDefinitionBase** (line 327)
8. **ContactFieldDefinitionUpdate** (line 359)
9. **ContactActivityBase** (line 389)

**Each change**:
```python
# BEFORE:
metadata: dict[str, Any] | None = Field(None, validation_alias=AliasChoices("metadata_", "metadata"))

# AFTER:
metadata: dict[str, Any] | None = Field(
    None,
    validation_alias=AliasChoices("metadata_", "metadata"),
    serialization_alias="metadata"
)
```

## Testing Recommendations

### 1. Response Serialization Test

```python
from src.dotmac.platform.contacts.schemas import ContactResponse
from src.dotmac.platform.contacts.models import Contact

# Create ORM object with metadata
contact = Contact(
    id=uuid4(),
    tenant_id=uuid4(),
    first_name="John",
    last_name="Doe",
    metadata_={"custom_field": "value", "tags": ["vip"]}  # Note: metadata_ attribute
)

# Serialize to response model
response = ContactResponse.model_validate(contact, from_attributes=True)

# Verify metadata is present (not null)
assert response.metadata is not None
assert response.metadata == {"custom_field": "value", "tags": ["vip"]}

# Verify JSON output
json_data = response.model_dump()
assert "metadata" in json_data
assert json_data["metadata"] == {"custom_field": "value", "tags": ["vip"]}
```

### 2. Request Validation Test (Both Aliases)

```python
from src.dotmac.platform.contacts.schemas import ContactCreate

# Test with "metadata" key
data1 = {
    "first_name": "John",
    "metadata": {"source": "api"}
}
contact1 = ContactCreate(**data1)
assert contact1.metadata == {"source": "api"}

# Test with "metadata_" key (should also work)
data2 = {
    "first_name": "Jane",
    "metadata_": {"source": "import"}
}
contact2 = ContactCreate(**data2)
assert contact2.metadata == {"source": "import"}
```

### 3. Integration Test (Full Round-Trip)

```python
async def test_metadata_roundtrip():
    """Test creating contact with metadata and retrieving it."""

    # Create contact with metadata via API
    create_data = {
        "first_name": "Test",
        "last_name": "User",
        "metadata": {"subscription_tier": "premium", "onboarding_completed": True}
    }

    response = await client.post("/api/contacts", json=create_data)
    assert response.status_code == 201
    contact_id = response.json()["id"]

    # Retrieve contact
    get_response = await client.get(f"/api/contacts/{contact_id}")
    assert get_response.status_code == 200

    contact_data = get_response.json()

    # Verify metadata is present and correct
    assert "metadata" in contact_data
    assert contact_data["metadata"]["subscription_tier"] == "premium"
    assert contact_data["metadata"]["onboarding_completed"] is True
```

### 4. Update Test (Field Mapping Integration)

```python
async def test_metadata_update():
    """Test updating contact metadata (works with service.py field mapping)."""

    # Create contact
    contact = await contact_service.create_contact(...)

    # Update metadata
    update_data = ContactUpdate(
        metadata={"updated": True, "version": 2}
    )

    updated_contact = await contact_service.update_contact(
        contact_id=contact.id,
        contact_data=update_data
    )

    # Verify update persisted to database
    assert updated_contact.metadata_ == {"updated": True, "version": 2}

    # Verify response serialization
    response = ContactResponse.model_validate(updated_contact, from_attributes=True)
    assert response.metadata == {"updated": True, "version": 2}
```

## Impact Analysis

### ✅ Fixed Behaviors

1. **Response Serialization**: `ContactResponse.model_validate(contact, from_attributes=True)` now correctly reads from `metadata_` attribute and serializes as `"metadata"` in JSON

2. **Null Prevention**: Metadata fields no longer return `null` when ORM objects have populated `metadata_` values

3. **API Consistency**: All contact-related responses now include metadata when present

4. **Backward Compatibility**: Requests can still send either `"metadata"` or `"metadata_"` field names

### 🔄 Unchanged Behaviors

1. **Input Validation**: Both field names still accepted in requests (no breaking changes)

2. **Database Storage**: Still stored in `metadata` column (no schema changes needed)

3. **Service Layer**: Works seamlessly with existing field_mapping logic

## Related Fixes

This fix complements the previous field mapping fix in `service.py` (lines 195-207, 411-423):

```python
# service.py - Maps incoming "metadata" to ORM "metadata_"
field_mapping = {"metadata": "metadata_"}
for field, value in update_fields.items():
    orm_field = field_mapping.get(field, field)
    if hasattr(contact, orm_field):
        setattr(contact, orm_field, value)
```

**Together, these fixes ensure**:
1. Input: Requests with `"metadata"` → mapped to `metadata_` attribute → persisted to database ✅
2. Output: Database `metadata` column → read as `metadata_` attribute → serialized as `"metadata"` in JSON ✅

## Deployment Notes

1. **No Database Migration Required**: Changes are purely at the Pydantic serialization layer

2. **No Breaking Changes**: Backward compatible with existing API clients

3. **Immediate Effect**: Fix applies as soon as updated code is deployed

4. **Monitoring**: Watch for any validation errors in logs after deployment (though none expected)

## Verification Commands

```bash
# Syntax check
python3 -m py_compile src/dotmac/platform/contacts/schemas.py

# Run contact-related tests
pytest tests/customer_management/ -v -k metadata

# Full test suite
pytest tests/ -v
```

## Additional Notes

### Why Not Use `alias` Instead?

In Pydantic v2:
- `alias`: Deprecated in favor of separate validation/serialization aliases
- `validation_alias`: For incoming data (requests)
- `serialization_alias`: For outgoing data (responses)

This separation provides more control over bidirectional data flow.

### Why AliasChoices?

`AliasChoices` allows multiple acceptable input names:
```python
validation_alias=AliasChoices("metadata_", "metadata")
```

This means requests can use:
- Modern format: `{"metadata": {...}}`
- Database format: `{"metadata_": {...}}`

Both map to the same model field.

## Summary

**What was broken**: Response models returned `null` for metadata even when database had data

**Why it was broken**: Pydantic didn't know to read from `metadata_` attribute when serializing

**How we fixed it**: Added `serialization_alias="metadata"` to all 9 metadata field definitions

**Result**: Metadata now correctly serializes from ORM objects to JSON responses
