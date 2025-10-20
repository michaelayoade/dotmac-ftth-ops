# Database Migration Issue - Executive Summary

## Problem Statement

Cannot apply database migrations to create partner management tables due to architectural issues in how the application initializes its database schema.

---

## Root Cause (TL;DR)

The application uses **SQLAlchemy's `Base.metadata.create_all()`** instead of Alembic migrations for database initialization. This was called during test setup, creating 38 tables without Alembic tracking. Partner tables were added later and were never created because the database was never re-initialized.

---

## Impact

### ❌ **Blocked**
- Partner portal revenue share feature cannot be deployed
- Partner management API endpoints will fail (no database tables)
- Commission tracking system non-functional

### ⚠️ **At Risk**
- Schema versioning broken (no migration history)
- Cannot rollback database changes
- Production deployments may have schema drift
- Different environments may have different schemas

---

## Technical Details

### Architecture Issue

```
Application Startup (main.py:132)
    ↓
init_db()
    ↓
Base.metadata.create_all()  ← Creates tables WITHOUT Alembic
    ↓
Result: Tables exist but no alembic_version tracking
```

**Should be:**
```
Deployment Process
    ↓
alembic upgrade head  ← Creates tables WITH version tracking
    ↓
Application Startup (no table creation)
    ↓
Result: Proper migration history and version control
```

### Missing Tables

**Partner Base Tables** (not in database):
- `partners`
- `partner_users`
- `partner_accounts`
- `partner_commissions`
- `partner_commission_events`
- `partner_payouts`

**Status**: Models defined in code, migration file exists, but tables never created.

### Database Schema Issues

**PartnerCommissionEvent Model** (`models.py:457-550`):

Missing Foreign Keys:
```python
# Line 479 - Missing ForeignKey
invoice_id: Mapped[UUID | None] = mapped_column(
    PostgresUUID(as_uuid=True),
    nullable=True,
    index=True,
    comment="Invoice that triggered this commission",
)
# Should be:
invoice_id: Mapped[UUID | None] = mapped_column(
    PostgresUUID(as_uuid=True),
    ForeignKey("invoices.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
    comment="Invoice that triggered this commission",
)

# Line 528 - Missing ForeignKey
payout_id: Mapped[UUID | None] = mapped_column(
    PostgresUUID(as_uuid=True),
    nullable=True,
    index=True,
    comment="Reference to payout batch",
)
# Should be:
payout_id: Mapped[UUID | None] = mapped_column(
    PostgresUUID(as_uuid=True),
    ForeignKey("partner_payouts.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
    comment="Reference to payout batch",
)
```

**customer_id** already has proper ForeignKey (line 487) ✅

---

## Immediate Solution

### Option 1: Quick Fix (For Development)

Manually create partner tables and initialize Alembic tracking:

```bash
# 1. Create SQL schema file from models
# See: scripts/create_partner_tables.sql (to be created)

# 2. Execute SQL
docker exec -i dotmac-postgres psql -U dotmac_user -d dotmac_test < scripts/create_partner_tables.sql

# 3. Initialize Alembic tracking
docker exec -i dotmac-postgres psql -U dotmac_user -d dotmac_test << 'EOF'
CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) PRIMARY KEY);
DELETE FROM alembic_version;
INSERT INTO alembic_version VALUES ('3dd35f0c1f3f');
EOF
```

### Option 2: Clean Rebuild (Recommended)

Start with clean database using Alembic:

```bash
# 1. Drop and recreate database
docker exec -i dotmac-postgres psql -U dotmac_user -d postgres << 'EOF'
DROP DATABASE IF EXISTS dotmac_test;
CREATE DATABASE dotmac_test;
EOF

# 2. Fix foreign keys in models (apply patch below)

# 3. Create missing base tables migration
DATABASE_URL="postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac_test" \
  .venv/bin/alembic revision --autogenerate \
  -m "Add partner management base tables"

# 4. Apply all migrations
DATABASE_URL="postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac_test" \
  .venv/bin/alembic upgrade head
```

---

## Foreign Key Fix

Apply this patch to `src/dotmac/platform/partner_management/models.py`:

```python
# Line 479-484: Add ForeignKey to invoice_id
invoice_id: Mapped[UUID | None] = mapped_column(
    PostgresUUID(as_uuid=True),
    ForeignKey("invoices.id", ondelete="SET NULL"),  # ← ADD THIS
    nullable=True,
    index=True,
    comment="Invoice that triggered this commission",
)

# Line 528-533: Add ForeignKey to payout_id
payout_id: Mapped[UUID | None] = mapped_column(
    PostgresUUID(as_uuid=True),
    ForeignKey("partner_payouts.id", ondelete="SET NULL"),  # ← ADD THIS
    nullable=True,
    index=True,
    comment="Reference to payout batch",
)
```

---

## Long-Term Solution

### Phase 1: Fix Application Startup ✅

Remove direct table creation from application code:

```python
# src/dotmac/platform/main.py (line 132)
# REMOVE:
init_db()

# REPLACE WITH:
# Verify database is at correct migration version
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext

alembic_cfg = Config("alembic.ini")
script = ScriptDirectory.from_config(alembic_cfg)
expected_head = script.get_current_head()

with get_sync_engine().connect() as conn:
    context = MigrationContext.configure(conn)
    current_rev = context.get_current_revision()

    if current_rev != expected_head:
        logger.error(
            "Database migration mismatch",
            current=current_rev,
            expected=expected_head,
        )
        raise RuntimeError(
            f"Database is at revision {current_rev}, expected {expected_head}. "
            f"Run 'alembic upgrade head' before starting the application."
        )
```

### Phase 2: Update Deployment Process ✅

Document that migrations must run before application startup:

```bash
# .github/workflows/deploy.yml or deployment docs
# BEFORE starting application:
alembic upgrade head

# THEN start application:
uvicorn dotmac.platform.main:app
```

### Phase 3: Add Safeguards ✅

1. CI check: Ensure no `create_all()` in application code (tests OK)
2. Startup validation: Verify migrations are up to date
3. Development docs: Explain Alembic-first workflow

---

## Files Requiring Changes

### Immediate
1. `src/dotmac/platform/partner_management/models.py` - Add missing foreign keys
2. Create `scripts/create_partner_tables.sql` - SQL schema for manual creation

### Short-term
3. `src/dotmac/platform/main.py` - Remove `init_db()`, add migration check
4. `src/dotmac/platform/db.py` - Mark `create_all()` as test-only
5. Create new migration for partner base tables

### Documentation
6. `docs/deployment.md` - Add Alembic requirement
7. `docs/development.md` - Explain migration workflow
8. `README.md` - Add migration setup to quick start

---

## Recommendation

**For immediate unblocking**: Use Option 2 (Clean Rebuild) - it's faster than debugging the current state and ensures proper setup.

**For long-term stability**: Implement all three phases of the long-term solution to prevent recurrence.

---

## Related Documentation

- **Root Cause Analysis**: `docs/migration-issue-root-cause-analysis.md` (detailed technical investigation)
- **Implementation Status**: `docs/partner-portal-implementation-status.md` (current work status)
- **Partner Portal Plan**: `docs/partner-portal-revenue-share-plan.md` (original feature plan)

---

**Status**: Investigated, root cause identified, solutions proposed
**Next Action**: User decision on Option 1 vs Option 2
**Estimated Time**: Option 1: 15min, Option 2: 5min + testing time
