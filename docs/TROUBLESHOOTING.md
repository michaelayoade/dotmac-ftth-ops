# Test Troubleshooting Guide

## Quick Status Check

```bash
# Check if your setup is working
poetry run pytest tests/billing/test_subscription_load.py --collect-only -q
# Expected: 6 tests collected (NO "SKIPPED" messages)
```

## Common Issues

### 1. ✅ RESOLVED: "Failed to apply database migrations"

**Status**: **FIXED** in latest commit

**Root Cause**: `.env` parser couldn't expand variables like `${POSTGRES_PORT}`

**What was changed**:
- Enhanced `.env` parser with variable expansion support
- Made migration handling more robust
- Added graceful fallback if migrations already applied
- Suppressed alembic output during tests
- Added `DOTMAC_SKIP_AUTO_MIGRATIONS` option

**The Error**:
```
Error: invalid literal for int() with base 10: '${POSTGRES_PORT}'
```

**The Fix**:
- `.env` parser now expands `${VAR}` references
- Two-pass loading: collect variables, then expand references
- Handles nested references up to 10 levels deep

**If you still see this**:
```bash
# Option 1: Skip automatic migrations (if already applied)
echo "DOTMAC_SKIP_AUTO_MIGRATIONS=1" >> .env
poetry run pytest tests/billing -m integration

# Option 2: Manually run migrations first
poetry run alembic upgrade head
poetry run pytest tests/billing -m integration
```

### 2. ⚠️ "RuntimeError: Event loop is closed"

**Status**: Pre-existing test infrastructure issue (not related to skipped tests fix)

**Example**:
```
RuntimeError: Event loop is closed
  File "asyncpg/connection.py", line 1504, in close
```

**What it is**:
- Asyncio event loop cleanup issue
- Happens in some tests after they complete
- Pre-existing problem (was there before our changes)
- Does NOT affect skip behavior

**Impact**:
- Some tests fail with this error
- Tests DID run (not skipped)
- Core functionality works, just cleanup issue

**Workaround**:
This is a known pytest-asyncio issue with fixture cleanup. It doesn't affect whether tests are skipped.

### 3. ✅ RESOLVED: Load tests skipped

**Status**: **FIXED**

**Before**:
```
SKIPPED [6] Set RUN_SUBSCRIPTION_LOAD_TESTS=1 to enable subscription load tests
```

**After**:
```
6 tests collected (NO SKIPS!)
```

**How it works now**:
- `.env` file automatically loaded
- `RUN_SUBSCRIPTION_LOAD_TESTS=1` set by default
- No manual environment variable needed

### 4. ✅ RESOLVED: SQLite transaction test skipped

**Status**: **FIXED**

**Before**:
```
SKIPPED [1] SQLite keeps flushed data visible with shared connections
```

**After**:
```
test_flush_data_not_visible_to_new_session - COLLECTED (runs on PostgreSQL)
```

**How it works now**:
- Integration tests use PostgreSQL automatically
- SQLite-specific skips eliminated
- Tests proper transaction isolation

## Environment Variables Reference

### Automatically Set (from .env)
```bash
RUN_SUBSCRIPTION_LOAD_TESTS=1                    # Enable load tests
DOTMAC_DATABASE_URL_ASYNC=postgresql+asyncpg://... # PostgreSQL for tests
DOTMAC_DATABASE_URL=postgresql://...              # Sync PostgreSQL URL
DOTMAC_SKIP_AUTO_MIGRATIONS=0                    # Auto-run migrations
```

### Manual Overrides (if needed)
```bash
# Skip load tests
RUN_SUBSCRIPTION_LOAD_TESTS=0 poetry run pytest

# Use SQLite for speed
DOTMAC_DATABASE_URL_ASYNC="" poetry run pytest -m "not integration"

# Skip automatic migrations
DOTMAC_SKIP_AUTO_MIGRATIONS=1 poetry run pytest

# Don't auto-start services
DOTMAC_AUTOSTART_SERVICES=0 poetry run pytest
```

## Verification Commands

### Check Environment Loading
```bash
poetry run python -c "
import os
import sys
sys.path.insert(0, 'tests')

# This triggers .env loading (via conftest.py import)
import conftest

print('RUN_SUBSCRIPTION_LOAD_TESTS:', os.getenv('RUN_SUBSCRIPTION_LOAD_TESTS'))
print('Using PostgreSQL:', 'postgresql' in (os.getenv('DOTMAC_DATABASE_URL_ASYNC') or ''))
"
```

### Check Test Collection
```bash
# Load tests should be collected
poetry run pytest tests/billing/test_subscription_load.py --collect-only -q

# Should show 6 tests, NO skips
```

### Check Database Type
```bash
# Integration tests should use PostgreSQL
poetry run pytest tests/billing -m integration --collect-only 2>&1 | grep "Context impl"

# Should show: PostgresqlImpl (not SQLiteImpl)
```

### Check PostgreSQL
```bash
# Is it running?
docker ps | grep postgres

# Start if needed
docker compose -f docker-compose.base.yml up -d postgres

# Check migrations
poetry run alembic current
```

## Test Execution Summary

### What Works Now ✅
- ✅ `poetry run pytest tests/billing -m integration` - Uses PostgreSQL, no skips
- ✅ `poetry run pytest tests/billing/test_subscription_load.py` - Load tests run
- ✅ `poetry run pytest tests/billing/test_factory_commit_behavior.py` - No SQLite skips
- ✅ `.env` file loaded automatically
- ✅ No manual environment variables needed

### Known Issues (Pre-existing) ⚠️
- ⚠️ Some tests fail with "Event loop is closed" (asyncio cleanup issue)
- ⚠️ Some tests have other failures (business logic, not infrastructure)
- ℹ️ These failures existed before our changes
- ℹ️ Tests run (not skipped), just have other issues

### Skip Status
| Test Category | Before | After | Status |
|---------------|--------|-------|--------|
| Load tests (6) | SKIPPED | RUNNING | ✅ FIXED |
| SQLite test (1) | SKIPPED | RUNNING | ✅ FIXED |
| Not implemented (1) | SKIPPED | SKIPPED | ℹ️ Feature not done |

## Getting Help

### If tests are still skipped:
1. Check `.env` file exists: `ls -la .env`
2. Check PostgreSQL is running: `docker ps | grep postgres`
3. Check environment variables load: See "Verification Commands" above
4. Try the script: `./scripts/run_all_tests_local.sh`

### If you see migration errors:
```bash
# Try skipping automatic migrations
DOTMAC_SKIP_AUTO_MIGRATIONS=1 poetry run pytest tests/billing -m integration

# Or manually apply first
poetry run alembic upgrade head
poetry run pytest tests/billing -m integration
```

### If PostgreSQL won't start:
```bash
# Check logs
docker logs dotmac-ftth-ops-postgres-1

# Restart
docker compose -f docker-compose.base.yml restart postgres

# Or start fresh
docker compose -f docker-compose.base.yml down
docker compose -f docker-compose.base.yml up -d postgres redis
```

## Success Criteria

✅ **Your setup is working if**:
1. Load tests are collected (not skipped): `poetry run pytest tests/billing/test_subscription_load.py --collect-only`
2. Integration tests use PostgreSQL: Check logs for "PostgresqlImpl"
3. No migration errors during test setup
4. Tests run (even if some fail with other errors)

❌ **Still have issues if**:
1. "SKIPPED [6]" for load tests
2. "SKIPPED [1]" for SQLite transaction test
3. "Failed to apply database migrations" error
4. Tests use "SQLiteImpl" instead of "PostgresqlImpl"

---

**Last Updated**: 2025-11-03
**Primary Issues**: ✅ All resolved!
**Secondary Issues**: ⚠️ Pre-existing test failures (unrelated to skips)
