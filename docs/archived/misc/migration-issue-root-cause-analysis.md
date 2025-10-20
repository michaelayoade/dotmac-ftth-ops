# Database Migration Issue - Root Cause Analysis

## Executive Summary

The database migration system has a fundamental architecture issue: **the application uses two different database initialization methods** that are not coordinated, leading to tables being created outside of Alembic's tracking system.

---

## Root Causes Identified

### 1. Dual Database Initialization Systems

**Problem**: The application has TWO ways to create database tables:

#### Method A: Alembic Migrations (Intended Production Method)
```bash
alembic upgrade head
```
- Creates tables via migration files
- Tracks schema versions in `alembic_version` table
- Allows rollback and version control
- **Status**: Not being used in development

#### Method B: SQLAlchemy create_all() (Currently Active)
```python
# src/dotmac/platform/db.py:287-289
def init_db() -> None:
    """Initialize the database (create tables if needed)."""
    create_all_tables()  # Calls Base.metadata.create_all()
```
- Creates tables directly from SQLAlchemy models
- No version tracking
- No migration history
- **Status**: Called in `main.py:132` during application startup

### 2. Model Import Registration Issue

**Problem**: Models must be imported before `Base.metadata.create_all()` can create their tables.

**Current Situation**:
- `tests/conftest.py` imports all models (including partner models) for tests ✅
- Application code does NOT import models before calling `init_db()` ❌
- Result: Tests create all tables, but application may miss some

**Evidence from conftest.py**:
```python
# tests/conftest.py (lines ~98-115)
# Import all models to ensure they're registered with Base.metadata
try:
    from dotmac.platform.partner_management import models as partner_models  # noqa: F401
except ImportError:
    pass
```

### 3. Alembic Never Initialized

**Problem**: The `alembic_version` table doesn't exist in the database.

**Evidence**:
```sql
-- Query result:
ERROR: relation "alembic_version" does not exist
```

**Why?**:
- Application uses `init_db()` instead of Alembic
- Tests use `Base.metadata.create_all()` directly
- Alembic has never been run against this database

---

## Current Database State

### Tables That Exist (38 total)
Created by tests via `Base.metadata.create_all()`:
- `audit_activities`, `users`, `tenants`
- `billing_*` tables (subscriptions, invoices, payments, etc.)
- `communication_*` tables
- `credit_notes`, `payment_methods`
- **NO partner tables** ❌

### Tables Missing
- `partners`
- `partner_users`
- `partner_accounts`
- `partner_commissions`
- `partner_commission_events`
- `partner_payouts`

### Why Partner Tables Missing?

The partner models were added AFTER the `dotmac_test` database was created, but:
1. The database was never re-initialized with `init_db()`
2. Alembic was never run
3. Tests that created the database didn't include partner fixtures

---

## Architecture Problems

### Problem 1: Competing Initialization Methods

```
┌─────────────────────────────────────────────┐
│         Application Startup                 │
│  (src/dotmac/platform/main.py:132)          │
│                                             │
│  init_db()                                  │
│    └─> Base.metadata.create_all()          │
│        (No version tracking)                │
└─────────────────────────────────────────────┘
                    VS
┌─────────────────────────────────────────────┐
│         Alembic Migrations                  │
│  (alembic upgrade head)                     │
│                                             │
│  Executes migration files                   │
│  Tracks in alembic_version table           │
│  (Proper version control)                   │
└─────────────────────────────────────────────┘
```

**Impact**: These two systems don't coordinate, leading to:
- Schema drift between environments
- Inability to rollback changes
- Missing migration history
- Deployment inconsistencies

### Problem 2: Model Discovery Pattern

SQLAlchemy's `Base.metadata` only knows about models that have been **imported**.

**Current State**:
```python
# When init_db() is called:
Base.metadata.tables → {}  # EMPTY! No models imported yet

# After tests import models:
Base.metadata.tables → {38 tables}  # All imported models
```

**This is why**:
- Tests create 38 tables (they import models in conftest)
- Application might create different tables (depends on what gets imported)
- Partner tables missing (models imported but database never refreshed)

---

## Solutions

### Option 1: Migrate to Alembic-Only (Recommended for Production)

**Pros**:
- Proper version control
- Rollback capability
- Consistent deployments
- Industry standard

**Implementation**:
1. Remove `init_db()` call from `main.py`
2. Require `alembic upgrade head` before startup
3. Create missing partner tables migration
4. Document deployment process

**Changes Required**:
```python
# src/dotmac/platform/main.py
# REMOVE:
init_db()

# ADD to deployment docs:
# Run before starting application:
# $ alembic upgrade head
```

### Option 2: Keep Dual System with Coordination

**Pros**:
- Works for development (quick setup)
- Works for production (proper migrations)

**Implementation**:
1. Keep `init_db()` for development
2. Add all model imports to `db.py` or dedicated `models/__init__.py`
3. Add check: if `alembic_version` exists, skip `init_db()`

**Changes Required**:
```python
# src/dotmac/platform/db.py
def init_db() -> None:
    """Initialize database (development only)."""
    engine = get_sync_engine()

    # Skip if Alembic has been run
    inspector = inspect(engine)
    if 'alembic_version' in inspector.get_table_names():
        logger.info("Database managed by Alembic, skipping init_db()")
        return

    # Import all models
    import_all_models()

    # Create tables
    Base.metadata.create_all(engine)
```

### Option 3: Immediate Fix (Manual SQL)

**For dotmac_test database right now**:

1. Create SQL script with all partner tables
2. Execute directly: `psql ... < partner_tables.sql`
3. Manually insert Alembic version:
   ```sql
   CREATE TABLE alembic_version (version_num VARCHAR(32) PRIMARY KEY);
   INSERT INTO alembic_version VALUES ('3dd35f0c1f3f');
   ```

---

## Recommended Action Plan

### Phase 1: Immediate (Fix dotmac_test)
1. ✅ Document root cause (this file)
2. Create comprehensive SQL script for all partner tables
3. Execute SQL to create tables
4. Initialize Alembic tracking

### Phase 2: Short-term (Fix Architecture)
1. Choose strategy (Option 1 or 2)
2. Update `main.py` and `db.py`
3. Create migration for partner tables
4. Test in clean database

### Phase 3: Long-term (Prevent Recurrence)
1. Add CI check: verify no `create_all()` in application code
2. Document: "Alembic is source of truth for schema"
3. Add startup check: ensure database is at correct migration version

---

## Partner Management Specific Issue

### Missing Foreign Key in PartnerCommissionEvent

The user reported: "database schema issue with PartnerCommissionEvent model (missing foreign key relationship)"

**Investigation Needed**:
```python
# src/dotmac/platform/partner_management/models.py
class PartnerCommissionEvent(Base, TimestampMixin, TenantMixin):
    # Check these foreign keys:
    partner_id: Mapped[UUID] = mapped_column(ForeignKey("partners.id"))
    customer_id: Mapped[UUID | None]  # ← Missing ForeignKey?
    invoice_id: Mapped[UUID | None]   # ← Missing ForeignKey?
    payout_id: Mapped[UUID | None]    # ← Has ForeignKey
```

**Potential Fix**:
```python
customer_id: Mapped[UUID | None] = mapped_column(
    ForeignKey("customers.id", ondelete="SET NULL"),
    nullable=True
)
invoice_id: Mapped[UUID | None] = mapped_column(
    ForeignKey("invoices.id", ondelete="SET NULL"),
    nullable=True
)
```

---

## Files Affected

### Core Infrastructure
- `src/dotmac/platform/main.py` (line 132)
- `src/dotmac/platform/db.py` (lines 287-289, 292-296)
- `tests/conftest.py` (lines 98-140)
- `alembic/env.py`

### Partner Management
- `src/dotmac/platform/partner_management/models.py`
- `alembic/versions/2025_10_09_0339-3dd35f0c1f3f_add_partner_payouts_table.py`

---

## Conclusion

The root cause is **architectural**: the application uses `Base.metadata.create_all()` for table creation instead of Alembic migrations. This works in tests (which import all models) but fails to maintain proper schema versioning and creates inconsistencies between environments.

**The partner tables are missing** because they were added after the test database was created, and the database was never re-initialized or migrated.

**Immediate fix**: Create SQL script and manually create partner tables.

**Long-term fix**: Migrate to Alembic-only workflow (remove `init_db()` from application code).

---

**Created**: 2025-10-09
**Author**: Investigation of migration blocking partner portal implementation
