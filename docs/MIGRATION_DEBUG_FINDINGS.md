# Database Migration Debug Findings

**Date:** 2025-10-14
**Branch:** `feature/bss-phase1-isp-enhancements`
**Status:** ISSUE IDENTIFIED

---

## Problem Summary

Database migrations appear to run successfully (log output shows all upgrade steps), but **no changes persist** to the database. The database remains empty with no tables created.

---

## Investigation Results

### ✅ What Works:
1. **Database Connection**: PostgreSQL is accessible at `localhost:5432`
2. **Docker Services**: All containers running and healthy
3. **Poetry Environment**: Dependencies installed successfully
4. **Alembic Configuration**: `alembic.ini` and `env.py` are correctly configured
5. **Manual SQL**: Direct SQL execution via SQLAlchemy commits successfully
6. **Migration Files**: All migration files are syntactically correct

### ❌ What Doesn't Work:
1. **Alembic Migrations**: `alembic upgrade head` runs but doesn't commit
2. **Alembic Stamp**: `alembic stamp <revision>` runs but doesn't persist version
3. **No Tables Created**: Database remains empty after migration runs

### 🔍 Root Cause:

The issue is in `/alembic/env.py` lines 179-180:

```python
with context.begin_transaction():
    context.run_migrations()
```

The `context.begin_transaction()` context manager **does not automatically commit** when using SQLAlchemy 2.0+ with alembic. The transaction is being rolled back or abandoned.

---

## Evidence

### Test 1: Check Database State
```bash
$ docker exec dotmac-postgres psql -U dotmac_user -d dotmac -c "\dt"
Did not find any relations.
```
**Result**: Empty database

### Test 2: Manual Table Creation
```python
# Manual SQL via SQLAlchemy - SUCCESS
with engine.connect() as conn:
    trans = conn.begin()
    conn.execute(text("CREATE TABLE alembic_version (...)"))
    trans.commit()  # ← Explicit commit works!
```
**Result**: Table persists ✅

### Test 3: Alembic Migration
```bash
$ poetry run alembic upgrade head
INFO  [alembic.runtime.migration] Running upgrade  -> 51aa0da58b97, Initial schema
INFO  [alembic.runtime.migration] Running upgrade 51aa0da58b97 -> 7f4b9f1cee2c, Create tenant
...
INFO  [alembic.runtime.migration] Running upgrade a72ec3c5e945 -> d3f4e8a1b2c5, add_isp_specific
```
**Result**: Logs show success, but `\dt` shows no tables ❌

---

## Solution Options

### Option 1: Fix Alembic env.py (RECOMMENDED)
Modify `/alembic/env.py` to explicitly commit transactions:

```python
def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section)
    database_url = get_database_url()
    if database_url:
        configuration["sqlalchemy.url"] = database_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Set timeouts
        try:
            if connection.dialect.name == "postgresql":
                connection.exec_driver_sql("SET lock_timeout = '5s'")
                connection.exec_driver_sql("SET statement_timeout = '60s'")
        except Exception as e:
            print(f"[alembic] Could not set session timeouts: {e}")

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        # FIX: Use explicit transaction management
        with connection.begin():  # ← Changed from context.begin_transaction()
            context.run_migrations()

        # Transaction auto-commits when exiting the `with connection.begin()` block
```

### Option 2: Use Alembic's Built-in Transaction Handling
The issue might be that we're mixing `context.begin_transaction()` with a connection that already has transaction management. We should use one or the other, not both.

Change from:
```python
with context.begin_transaction():
    context.run_migrations()
```

To:
```python
context.run_migrations()  # Let context handle transactions internally
```

### Option 3: Debug with Explicit Commit (Temporary)
For debugging, add explicit commit:

```python
        with context.begin_transaction():
            context.run_migrations()

        # TEMP: Explicit commit for debugging
        connection.commit()
```

---

## Recommended Actions

1. **Implement Option 1** (fix env.py transaction handling)
2. **Test with fresh database** or drop existing alembic_version table
3. **Run migration**: `poetry run alembic upgrade head`
4. **Verify**: `poetry run python test_db_connection.py`

---

## Additional Notes

- This is likely related to SQLAlchemy 2.0 changes in transaction semantics
- The alembic env.py template may be outdated for SQLAlchemy 2.0+
- Similar issues reported: [alembic/#1226](https://github.com/sqlalchemy/alembic/issues/1226)

---

## Status Update

**Current State**:
- ✅ Migration files created and validated
- ✅ Database connection working
- ❌ Migrations not committing (identified root cause)
- ⏳ Fix pending implementation

**Next Steps**:
1. Apply fix to `alembic/env.py`
2. Re-run migrations
3. Proceed with customer CRUD testing

---

**Documented by**: Claude Code
**Last Updated**: 2025-10-14
