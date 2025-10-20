# Schema Fix: Foreign Key Type Corrections (CORRECTED)

**Severity**: HIGH (Data Integrity)
**Status**: FIXED ✅
**Date**: 2025-10-17
**Fixed By**: Platform Engineering
**Version**: 2.0 (Corrected UUID types)

## Problem Summary

Multiple SQLAlchemy models had incorrect foreign key references with **two critical issues**:

1. **Wrong table names**: Referenced non-existent tables `tenant` and `user` instead of `tenants` and `users`
2. **Wrong data types**:
   - Used `Integer` initially (completely wrong)
   - Initially "fixed" to `String(255)` (still wrong for users!)
   - **CORRECT**: `PGUUID(as_uuid=True)` for users.id, `String(255)` for tenants.id

## Database Schema Reference

### Tenants Table
```sql
Table "public.tenants"
Column | Type                    | Notes
-------|-------------------------|-------
id     | character varying(255)  | PRIMARY KEY, UUID stored as string
```
✅ **Correct FK type**: `String(255)`

### Users Table
```sql
Table "public.users"
Column | Type | Notes
-------|------|-------
id     | uuid | PRIMARY KEY, native PostgreSQL UUID
```
✅ **Correct FK type**: `PGUUID(as_uuid=True)` from `sqlalchemy.dialects.postgresql`

## Issues Fixed (Final Correct Versions)

### ✅ Issue 1: WorkflowExecution.tenant_id - ALREADY CORRECT

**File**: `src/dotmac/platform/workflows/models.py:80`

**Status**: No fix needed - was already correct

```python
# Correct definition (no changes needed)
tenant_id = Column(String(255), ForeignKey("tenants.id"), index=True)
```

### ✅ Issue 2: Order.tenant_id - FIXED

**File**: `src/dotmac/platform/sales/models.py:109`

```python
# BEFORE (BROKEN)
tenant_id = Column(Integer, ForeignKey("tenant.id"), index=True)

# AFTER (CORRECT)
tenant_id = Column(String(255), ForeignKey("tenants.id"), index=True)
```

**Why**: `tenants.id` is `varchar(255)`, not integer

### ✅ Issue 3: Order.approved_by - FIXED (UUID)

**File**: `src/dotmac/platform/sales/models.py:114`

```python
# BEFORE (BROKEN)
approved_by = Column(Integer, ForeignKey("user.id"))

# AFTER (CORRECT) ← Uses UUID type!
approved_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))
```

**Why**: `users.id` is native PostgreSQL `uuid` type

**Import added**:
```python
from sqlalchemy.dialects.postgresql import UUID as PGUUID
```

### ✅ Issue 4: ServiceActivation.tenant_id - FIXED

**File**: `src/dotmac/platform/sales/models.py:201`

```python
# BEFORE (BROKEN)
tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False, index=True)

# AFTER (CORRECT)
tenant_id = Column(String(255), ForeignKey("tenants.id"), nullable=False, index=True)
```

### ✅ Issue 5: ServiceActivation.activated_by - FIXED (UUID)

**File**: `src/dotmac/platform/sales/models.py:232`

```python
# BEFORE (BROKEN)
activated_by = Column(Integer, ForeignKey("user.id"))

# AFTER (CORRECT) ← Uses UUID type!
activated_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))
```

### ✅ Issue 6: DeploymentInstance.deployed_by - FIXED (UUID)

**File**: `src/dotmac/platform/deployment/models.py:168`

```python
# BEFORE (BROKEN)
deployed_by = Column(Integer, ForeignKey("user.id"))

# AFTER (CORRECT) ← Uses UUID type!
deployed_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))
```

**Import added**:
```python
from sqlalchemy.dialects.postgresql import UUID as PGUUID
```

### ✅ Issue 7: DeploymentInstance.approved_by - FIXED (UUID)

**File**: `src/dotmac/platform/deployment/models.py:169`

```python
# BEFORE (BROKEN)
approved_by = Column(Integer, ForeignKey("user.id"))

# AFTER (CORRECT) ← Uses UUID type!
approved_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))
```

### ✅ Issue 8: DeploymentExecution.triggered_by - FIXED (UUID)

**File**: `src/dotmac/platform/deployment/models.py:218`

```python
# BEFORE (BROKEN)
triggered_by = Column(Integer, ForeignKey("user.id"))

# AFTER (CORRECT) ← Uses UUID type!
triggered_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))
```

## Critical Type Matching

PostgreSQL **requires** that foreign key column types **exactly match** the referenced column types:

### ✅ For users.id (native uuid)
```python
# CORRECT ✅
Column(PGUUID(as_uuid=True), ForeignKey("users.id"))

# WRONG ❌ - Type mismatch!
Column(String(255), ForeignKey("users.id"))
Column(Integer, ForeignKey("users.id"))
```

### ✅ For tenants.id (varchar(255))
```python
# CORRECT ✅
Column(String(255), ForeignKey("tenants.id"))

# WRONG ❌ - Type mismatch!
Column(PGUUID(as_uuid=True), ForeignKey("tenants.id"))
Column(Integer, ForeignKey("tenants.id"))
```

## Summary of All Changes

### Files Modified: 2

#### 1. src/dotmac/platform/sales/models.py

**Import added** (line 21):
```python
from sqlalchemy.dialects.postgresql import UUID as PGUUID
```

**Columns fixed**:
- Line 109: `tenant_id` → String(255) FK to tenants.id ✅
- Line 114: `approved_by` → PGUUID(as_uuid=True) FK to users.id ✅
- Line 201: `tenant_id` → String(255) FK to tenants.id ✅
- Line 232: `activated_by` → PGUUID(as_uuid=True) FK to users.id ✅

#### 2. src/dotmac/platform/deployment/models.py

**Import added** (line 22):
```python
from sqlalchemy.dialects.postgresql import UUID as PGUUID
```

**Columns fixed**:
- Line 168: `deployed_by` → PGUUID(as_uuid=True) FK to users.id ✅
- Line 169: `approved_by` → PGUUID(as_uuid=True) FK to users.id ✅
- Line 218: `triggered_by` → PGUUID(as_uuid=True) FK to users.id ✅

### Complete Type Mapping Table

| Model                | Column        | References   | Correct Type                    | Status |
|----------------------|---------------|--------------|---------------------------------|--------|
| Order                | tenant_id     | tenants.id   | String(255)                     | ✅     |
| Order                | approved_by   | users.id     | PGUUID(as_uuid=True)            | ✅     |
| ServiceActivation    | tenant_id     | tenants.id   | String(255)                     | ✅     |
| ServiceActivation    | activated_by  | users.id     | PGUUID(as_uuid=True)            | ✅     |
| DeploymentInstance   | deployed_by   | users.id     | PGUUID(as_uuid=True)            | ✅     |
| DeploymentInstance   | approved_by   | users.id     | PGUUID(as_uuid=True)            | ✅     |
| DeploymentExecution  | triggered_by  | users.id     | PGUUID(as_uuid=True)            | ✅     |
| WorkflowExecution    | tenant_id     | tenants.id   | String(255)                     | ✅     |

## Testing & Verification

### 1. Import Verification
```python
from dotmac.platform.sales.models import Order, ServiceActivation
from dotmac.platform.deployment.models import DeploymentInstance, DeploymentExecution

# All imports should succeed
```

### 2. Type Verification
```python
from sqlalchemy.dialects.postgresql import UUID as PGUUID

# Verify Order.approved_by uses UUID
assert isinstance(Order.approved_by.type, type(PGUUID()))
assert Order.approved_by.type.as_uuid is True

# Verify Order.tenant_id uses String
from sqlalchemy import String
assert isinstance(Order.tenant_id.type, String)
assert Order.tenant_id.type.length == 255
```

### 3. Foreign Key Target Verification
```python
# Check FK points to correct table and column
def verify_fk(model, column_name, expected_table, expected_column):
    column = getattr(model, column_name)
    fk = list(column.property.columns[0].foreign_keys)[0]
    assert fk.column.table.name == expected_table
    assert fk.column.name == expected_column
    return True

# Test all FKs
assert verify_fk(Order, "tenant_id", "tenants", "id")
assert verify_fk(Order, "approved_by", "users", "id")
assert verify_fk(ServiceActivation, "tenant_id", "tenants", "id")
assert verify_fk(ServiceActivation, "activated_by", "users", "id")
```

### 4. Schema Creation Test (When Migration Runs)
```sql
-- After creating tables, verify column types match
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name
WHERE t.table_name IN ('orders', 'service_activations', 'deployment_instances', 'deployment_executions')
  AND c.column_name IN ('tenant_id', 'approved_by', 'activated_by', 'deployed_by', 'triggered_by')
ORDER BY t.table_name, c.column_name;

-- Expected results:
-- orders               | approved_by   | uuid              | uuid
-- orders               | tenant_id     | character varying | varchar
-- service_activations  | activated_by  | uuid              | uuid
-- service_activations  | tenant_id     | character varying | varchar
-- deployment_instances | approved_by   | uuid              | uuid
-- deployment_instances | deployed_by   | uuid              | uuid
-- deployment_executions| triggered_by  | uuid              | uuid
```

## Migration Status

**NO MIGRATION NEEDED** ✅

All affected tables do not exist yet in the database:
- ✅ `orders` - doesn't exist
- ✅ `service_activations` - doesn't exist
- ✅ `deployment_instances` - doesn't exist
- ✅ `deployment_executions` - doesn't exist
- ✅ `workflow_executions` - exists with correct schema already

When Alembic migrations are generated for these models, they will now use the correct types.

## Why UUID Type Matters

### Problem with String(255)
```python
# WRONG - Type mismatch
approved_by = Column(String(255), ForeignKey("users.id"))

# This would fail at migration time:
# sqlalchemy.exc.ProgrammingError: (psycopg2.errors.DatatypeMismatch)
# foreign key constraint "fk_approved_by" cannot be implemented
# Detail: Key columns "approved_by" and "id" are of incompatible types:
# character varying and uuid.
```

### Correct UUID Type
```python
# CORRECT - Types match
approved_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id"))

# Migration succeeds:
# ALTER TABLE orders ADD CONSTRAINT fk_approved_by
# FOREIGN KEY (approved_by) REFERENCES users(id);
```

## Examples of Correct Usage

### Creating an Order
```python
from uuid import UUID

# User ID from auth system (UUID)
user_id: UUID = current_user.id

# Tenant ID from tenant system (string UUID)
tenant_id: str = current_user.tenant_id

order = Order(
    order_number="ORD-001",
    tenant_id=tenant_id,          # String(255) - matches tenants.id
    approved_by=user_id,           # UUID - matches users.id
    customer_email="test@example.com",
    customer_name="Test User",
    company_name="Test Corp",
    order_type=OrderType.NEW_TENANT,
    total_amount=100.00
)
db.add(order)
await db.commit()
```

### Creating a Service Activation
```python
from uuid import UUID

activation = ServiceActivation(
    order_id=order.id,
    tenant_id=tenant_id,           # String(255) - matches tenants.id
    activated_by=user_id,          # UUID - matches users.id
    service_code="BROADBAND_100",
    service_name="Broadband 100Mbps",
    activation_status=ActivationStatus.PENDING
)
db.add(activation)
await db.commit()
```

## Root Cause Analysis

### Why This Happened

1. **Initial error**: Used `Integer` for all FKs (completely wrong)
2. **Incomplete fix**: Changed to `String(255)` universally without checking target column types
3. **PostgreSQL strictness**: Unlike some databases, PostgreSQL enforces exact type matching for FKs
4. **Mixed UUID storage**: System uses both native UUID (users) and string UUID (tenants)

### Prevention Measures

1. **Always verify target column types** before defining FKs
2. **Use database inspection** to confirm actual schema
3. **Test FK creation** in development before production
4. **Document type conventions** for the codebase:
   - `users.id` → native UUID → use `PGUUID(as_uuid=True)`
   - `tenants.id` → varchar(255) → use `String(255)`

## Deployment Checklist

- ✅ Model definitions corrected
- ✅ Correct imports added (PGUUID)
- ✅ Type verification completed
- ✅ Documentation updated
- ✅ No migration needed (tables don't exist)
- ✅ Ready for code review
- ✅ Ready for deployment

## Conclusion

All foreign key issues are now **correctly fixed** with proper type matching:

- **users.id FKs**: Use `PGUUID(as_uuid=True)` ✅
- **tenants.id FKs**: Use `String(255)` ✅

When these tables are created via Alembic migrations, PostgreSQL will successfully create all foreign key constraints because the column types now match exactly.

**Critical takeaway**: Foreign key column types **must exactly match** the referenced column types in PostgreSQL. String approximations of UUIDs don't work with native UUID columns.

---

**Status**: ✅ **READY FOR DEPLOYMENT**

All issues fixed with correct type matching. Future migrations will succeed.
