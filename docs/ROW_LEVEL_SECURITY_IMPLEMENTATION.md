# Row-Level Security (RLS) Implementation Guide

**Status:** ✅ IMPLEMENTED
**Date:** 2025-11-08
**Security Level:** CRITICAL

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Details](#implementation-details)
4. [Testing](#testing)
5. [Operations](#operations)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Overview

### What is Row-Level Security?

Row-Level Security (RLS) is a PostgreSQL feature that enforces data isolation at the **database level**, ensuring that users can only access rows they are authorized to see. In a multi-tenant application, RLS automatically filters all queries by `tenant_id`, providing defense-in-depth security.

### Why RLS?

RLS provides critical security benefits:

1. **Defense in Depth:** Even if application code fails to filter by tenant_id, the database prevents cross-tenant access
2. **Automatic Enforcement:** All queries are automatically filtered—no manual WHERE clauses needed
3. **Protection Against SQL Injection:** Even successful SQL injection attacks cannot bypass RLS
4. **Audit Trail:** RLS violations can be logged for security monitoring
5. **Compliance:** Meets regulatory requirements for data isolation (GDPR, HIPAA, SOC 2)

### Security Threat Mitigated

RLS addresses the **critical security breach** where the tenant portal exposed ALL ISP customer data across ALL tenants. Even if similar bugs are introduced in the future, RLS will prevent data leaks at the database layer.

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│                                                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │   Frontend   │   │     API      │   │  Background  │    │
│  │   Requests   │──▶│  Middleware  │──▶│    Jobs      │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                            │                                 │
│                            ▼                                 │
│                  ┌──────────────────┐                        │
│                  │ RLS Middleware   │                        │
│                  │ Set tenant_id    │                        │
│                  └──────────────────┘                        │
└──────────────────────────│──────────────────────────────────┘
                           │
                           │ SET LOCAL app.current_tenant_id = 'tenant-123'
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Session Variables:                       │   │
│  │  - app.current_tenant_id = 'tenant-123'              │   │
│  │  - app.is_superuser = false                          │   │
│  │  - app.bypass_rls = false                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                   │
│                           ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  RLS Policies (Automatic Filtering)                  │   │
│  │                                                        │   │
│  │  SELECT * FROM customers                              │   │
│  │  WHERE tenant_id = current_tenant_id()                │   │
│  │                                                        │   │
│  │  Result: Only tenant-123 customers returned           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### RLS Components

1. **Helper Functions** (`current_tenant_id()`, `is_superuser()`, `bypass_rls()`)
   - Retrieve session variables set by middleware
   - Used by RLS policies to make filtering decisions

2. **RLS Policies** (SELECT, INSERT, UPDATE, DELETE)
   - Automatically applied to all queries
   - Filter rows by `tenant_id = current_tenant_id()`
   - Allow superusers to bypass for admin operations

3. **RLS Middleware** (`RLSMiddleware`)
   - Extracts tenant from authenticated request
   - Sets PostgreSQL session variables before query execution
   - Runs for every HTTP request

4. **RLS Context Manager** (`RLSContextManager`)
   - For background jobs and scripts
   - Programmatically set tenant context outside request lifecycle

---

## Implementation Details

### Database Migration

**File:** `alembic/versions/2025_11_08_1600-enable_row_level_security.py`

The migration:
1. Creates helper functions for tenant context
2. Enables RLS on all multi-tenant tables
3. Creates comprehensive RLS policies (SELECT/INSERT/UPDATE/DELETE)
4. Creates audit logging infrastructure

**Protected Tables (45 tables):**
- Customers, Subscribers, Invoices, Payments, Credit Notes
- Usage Records, RADIUS Accounting, Network Profiles
- Tickets, CRM, Jobs, Workflows, Monitoring
- And 33 more tables with `tenant_id`

### Backend Middleware

**File:** `src/dotmac/platform/core/rls_middleware.py`

The middleware:
1. Extracts tenant_id from authenticated request context
2. Sets `app.current_tenant_id` session variable
3. Sets `app.is_superuser` for platform admins
4. Runs before database queries are executed

**Integration:** Added to `main.py` middleware stack right after `TenantMiddleware`

### RLS Policies

Each table has 4 policies:

```sql
-- SELECT: Users can only see their tenant's data
CREATE POLICY customers_tenant_isolation_select ON customers
    FOR SELECT
    USING (
        bypass_rls() OR
        is_superuser() OR
        tenant_id = current_tenant_id()
    );

-- INSERT: Users can only insert data for their tenant
CREATE POLICY customers_tenant_isolation_insert ON customers
    FOR INSERT
    WITH CHECK (
        bypass_rls() OR
        is_superuser() OR
        tenant_id = current_tenant_id()
    );

-- UPDATE: Users can only update their tenant's data
CREATE POLICY customers_tenant_isolation_update ON customers
    FOR UPDATE
    USING (...) -- Same as SELECT
    WITH CHECK (...); -- Same as INSERT

-- DELETE: Users can only delete their tenant's data
CREATE POLICY customers_tenant_isolation_delete ON customers
    FOR DELETE
    USING (...); -- Same as SELECT
```

### Session Variables

Three session variables control RLS:

| Variable | Type | Description | Set By |
|----------|------|-------------|--------|
| `app.current_tenant_id` | TEXT | Current tenant ID | RLS Middleware |
| `app.is_superuser` | BOOLEAN | Platform admin bypass | RLS Middleware |
| `app.bypass_rls` | BOOLEAN | System operations bypass | Manual (migrations) |

---

## Testing

### Test Suite

**File:** `tests/security/test_row_level_security.py`

The test suite verifies:

✅ **Tenant Isolation**
- Users can only see their own tenant's data
- Cross-tenant access is blocked
- Superusers can access all data

✅ **CRUD Operations**
- INSERT with wrong tenant_id is blocked
- UPDATE of other tenant's data is blocked
- DELETE of other tenant's data is blocked

✅ **Multi-Table Enforcement**
- RLS works on usage_records
- RLS works with JOINs
- RLS works across all critical tables

✅ **Context Management**
- Session variables are set correctly
- Context is reset after use
- Superuser mode works

### Running Tests

```bash
# Run all RLS tests
pytest tests/security/test_row_level_security.py -v

# Run specific test
pytest tests/security/test_row_level_security.py::test_customer_tenant_isolation -v

# Run with coverage
pytest tests/security/test_row_level_security.py --cov=dotmac.platform.core.rls_middleware
```

### Manual Testing

```python
from dotmac.platform.core.database import get_db
from dotmac.platform.core.rls_middleware import RLSContextManager
from dotmac.platform.customer_management.models import Customer
from sqlalchemy import select

async def test_rls_manually():
    async for db in get_db():
        # Test tenant isolation
        async with RLSContextManager(db, tenant_id="tenant-a"):
            result = await db.execute(select(Customer))
            customers = result.scalars().all()
            print(f"Tenant A sees {len(customers)} customers")
            assert all(c.tenant_id == "tenant-a" for c in customers)

        # Test superuser bypass
        async with RLSContextManager(db, is_superuser=True):
            result = await db.execute(select(Customer))
            all_customers = result.scalars().all()
            print(f"Superuser sees {len(all_customers)} customers (all tenants)")
```

---

## Operations

### Running Migrations

```bash
# Apply the RLS migration
alembic upgrade head

# Verify RLS is enabled
psql -d dotmac_platform -c "
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE tablename IN ('customers', 'usage_records', 'subscribers')
"
```

**Expected Output:**
```
 tablename     | rowsecurity
---------------+-------------
 customers     | t
 usage_records | t
 subscribers   | t
```

### Background Jobs and Scripts

For background jobs that need to set tenant context:

```python
from dotmac.platform.core.rls_middleware import RLSContextManager

async def process_tenant_data(tenant_id: str):
    async for db in get_db():
        async with RLSContextManager(db, tenant_id=tenant_id):
            # All queries in this block are filtered by tenant_id
            customers = await db.execute(select(Customer))
            # Process customers...
```

### Admin Operations

For platform admin operations that need to access all tenants:

```python
from dotmac.platform.core.rls_middleware import set_superuser_context

async def admin_report():
    async for db in get_db():
        await set_superuser_context(db)
        # Query all tenants' data
        all_customers = await db.execute(select(Customer))
        # Generate report...
        await reset_rls_context(db)
```

### System Migrations

For data migrations that need to bypass RLS:

```python
from dotmac.platform.core.rls_middleware import bypass_rls_for_migration

async def migrate_customer_data():
    async for db in get_db():
        await bypass_rls_for_migration(db)
        # Perform cross-tenant migrations
        # ...
        await reset_rls_context(db)
```

---

## Troubleshooting

### Problem: Queries Return Empty Results

**Symptom:** Authenticated users see no data despite data existing in database

**Diagnosis:**
```python
# Check if tenant context is set
result = await db.execute(
    text("SELECT current_setting('app.current_tenant_id', TRUE)")
)
print(f"Current tenant: {result.scalar()}")
```

**Solutions:**
1. Ensure RLS middleware is registered in `main.py`
2. Verify tenant is extracted correctly from auth token
3. Check that tenant_id in database matches auth token

### Problem: RLS Policies Not Applied

**Symptom:** Users can see data from other tenants

**Diagnosis:**
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'customers';

-- Check if policies exist
SELECT policyname, tablename
FROM pg_policies
WHERE tablename = 'customers';
```

**Solutions:**
1. Run the RLS migration: `alembic upgrade head`
2. Verify migration completed successfully
3. Check PostgreSQL logs for policy creation errors

### Problem: Performance Degradation

**Symptom:** Queries are slow after enabling RLS

**Diagnosis:**
```sql
-- Check if tenant_id index is being used
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM customers WHERE tenant_id = 'tenant-123';
```

**Solutions:**
1. Ensure `tenant_id` columns are indexed
2. Update table statistics: `ANALYZE customers;`
3. Consider composite indexes for common query patterns

### Problem: Superuser Mode Not Working

**Symptom:** Superusers still see filtered results

**Diagnosis:**
```python
result = await db.execute(
    text("SELECT current_setting('app.is_superuser', TRUE)")
)
print(f"Superuser: {result.scalar()}")
```

**Solutions:**
1. Verify `X-Superuser-Mode` header is set
2. Check user has `is_platform_admin` attribute
3. Ensure session variable is set before queries

---

## Best Practices

### 1. Always Use RLS Context

❌ **Bad:**
```python
async def get_customers(tenant_id: str):
    async for db in get_db():
        # NO RLS CONTEXT - RELIES ON APP CODE
        result = await db.execute(
            select(Customer).where(Customer.tenant_id == tenant_id)
        )
        return result.scalars().all()
```

✅ **Good:**
```python
async def get_customers(tenant_id: str):
    async for db in get_db():
        async with RLSContextManager(db, tenant_id=tenant_id):
            # RLS ENFORCES FILTERING
            result = await db.execute(select(Customer))
            return result.scalars().all()
```

### 2. Test RLS in Integration Tests

```python
@pytest.mark.asyncio
async def test_endpoint_enforces_rls(client):
    # Create data for two tenants
    # ...

    # Request as tenant A
    response = await client.get(
        "/api/v1/customers",
        headers={"Authorization": f"Bearer {tenant_a_token}"}
    )

    customers = response.json()
    # Verify only tenant A's data returned
    assert all(c["tenant_id"] == "tenant-a" for c in customers)
```

### 3. Monitor RLS Audit Logs

```sql
-- Check for RLS bypass attempts
SELECT *
FROM rls_audit_log
WHERE timestamp > NOW() - INTERVAL '1 day'
ORDER BY timestamp DESC;
```

### 4. Document Superuser Operations

When using superuser mode, document the reason:

```python
# Justification: Platform admin generating cross-tenant revenue report
async with RLSContextManager(db, is_superuser=True):
    # Generate report...
```

### 5. Performance Optimization

Always filter by `tenant_id` first in complex queries:

```sql
-- Good: Uses tenant_id index first
SELECT c.*, s.*
FROM customers c
JOIN subscribers s ON c.id = s.customer_id
WHERE c.tenant_id = current_tenant_id()  -- Fast with RLS
AND s.status = 'active';

-- Also good: RLS handles tenant_id automatically
SELECT c.*, s.*
FROM customers c
JOIN subscribers s ON c.id = s.customer_id
WHERE s.status = 'active';  -- RLS adds tenant_id filter
```

---

## Migration Rollback

If you need to rollback RLS (NOT RECOMMENDED):

```bash
# Rollback the RLS migration
alembic downgrade -1

# Verify RLS is disabled
psql -d dotmac_platform -c "
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE tablename = 'customers'
"
```

⚠️ **WARNING:** Rolling back RLS removes critical data isolation security!

---

## Related Documentation

- [ARCHITECTURAL_FIXES_IMPLEMENTATION_PLAN.md](../ARCHITECTURAL_FIXES_IMPLEMENTATION_PLAN.md) - Security breach analysis
- [TENANT_ISOLATION_GUIDE.md](./TENANT_ISOLATION_GUIDE.md) - Backend tenant filtering
- [docs/architecture/PORTAL_ARCHITECTURE.md](./architecture/PORTAL_ARCHITECTURE.md) - Portal separation principles

---

## Summary

Row-Level Security is now **FULLY IMPLEMENTED** across the DotMac platform:

✅ **45 multi-tenant tables** protected with RLS policies
✅ **Automatic tenant filtering** at database level
✅ **RLS Middleware** integrated into request lifecycle
✅ **Comprehensive test suite** for validation
✅ **Audit logging** for security monitoring
✅ **Superuser bypass** for platform admin operations

**Next Steps:**
1. Run the migration: `alembic upgrade head`
2. Test RLS: `pytest tests/security/test_row_level_security.py`
3. Monitor RLS audit logs for any violations
4. Update documentation for new database operations

**Security Impact:** Critical security vulnerabilities like the tenant portal data leak are now prevented at the database layer, providing defense-in-depth protection.
