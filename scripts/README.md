# Test Scripts

This directory contains helper scripts for running tests locally.

## Running Tests Locally (No Skips)

### Quick Start

```bash
# Run all tests with no skips (uses PostgreSQL, enables load tests)
./scripts/run_all_tests_local.sh

# Run specific test file
./scripts/run_all_tests_local.sh tests/billing/test_subscription_load.py

# Run with marker filter
./scripts/run_all_tests_local.sh -m integration

# Run with verbose output
./scripts/run_all_tests_local.sh tests/billing/ -v

# Run single test
./scripts/run_all_tests_local.sh tests/billing/test_subscription_load.py::TestSubscriptionLoadPerformance::test_create_1000_subscriptions -v
```

## What This Script Does

The `run_all_tests_local.sh` script automatically:

1. **Enables subscription load tests** (RUN_SUBSCRIPTION_LOAD_TESTS=1)
   - Normally skipped to save time
   - Tests creating 1000+ subscriptions, bulk operations, etc.

2. **Uses PostgreSQL instead of SQLite**
   - Avoids SQLite-specific test skips
   - Tests database transaction isolation properly
   - Matches production behavior more closely

3. **Ensures migrations are current**
   - Runs `alembic upgrade head` before tests
   - Ensures PostgreSQL schema is up to date

4. **Checks database connectivity**
   - Verifies PostgreSQL is reachable
   - Warns if the configured host:port cannot be contacted

## Previously Skipped Tests Now Running

### 1. Load Tests
- **File**: `tests/billing/test_subscription_load.py`
- **Previously**: Skipped unless `RUN_SUBSCRIPTION_LOAD_TESTS=1`
- **Now**: Automatically enabled with script
- **Tests**:
  - Creating 1000 subscriptions (tests/billing/test_subscription_load.py:78)
  - Pagination performance (tests/billing/test_subscription_load.py:139)
  - Concurrent operations (tests/billing/test_subscription_load.py:190)
  - Bulk cancellation (tests/billing/test_subscription_load.py:242)
  - Plan change at scale (tests/billing/test_subscription_load.py:309)
  - Complete load scenario (tests/billing/test_subscription_load.py:377)

### 2. SQLite Transaction Isolation Tests
- **File**: `tests/billing/test_factory_commit_behavior.py:169`
- **Previously**: Skipped on SQLite (default test database)
- **Now**: Runs on PostgreSQL (proper transaction isolation)

## Environment Variables

The script sets these automatically:

```bash
# Enable load tests
export RUN_SUBSCRIPTION_LOAD_TESTS=1

# Use PostgreSQL for tests
export DOTMAC_DATABASE_URL_ASYNC="postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac"
export DOTMAC_DATABASE_URL="postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"
```

## Manual Testing (Without Script)

If you prefer to run tests manually without the script:

```bash
# Export environment variables
export RUN_SUBSCRIPTION_LOAD_TESTS=1
export DOTMAC_DATABASE_URL_ASYNC="postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac"
export DOTMAC_DATABASE_URL="postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"

# Apply migrations
poetry run alembic upgrade head

# Run tests
poetry run pytest tests/
```

## Regular Test Runs (Fast)

For regular development (fast feedback, skips load tests):

```bash
# Fast unit tests only (default pytest behavior)
poetry run pytest -m "not integration"

# Integration tests with SQLite (default, some tests skipped)
poetry run pytest -m integration

# All tests with default settings (some tests skipped)
poetry run pytest tests/
```

## Verification

Verify the previously skipped tests now run:

```bash
# Check load tests are collected (not skipped)
./scripts/run_all_tests_local.sh tests/billing/test_subscription_load.py --collect-only
# Expected: 6 tests collected (previously skipped)

# Check SQLite test runs on PostgreSQL
./scripts/run_all_tests_local.sh tests/billing/test_factory_commit_behavior.py --collect-only
# Expected: All tests collected including test_flush_data_not_visible_to_new_session
```

## Troubleshooting

### Migrations Not Applied
```bash
# Apply manually if needed
DOTMAC_DATABASE_URL_ASYNC="postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac" \
poetry run alembic upgrade head
```

### Test Database Conflicts
```bash
# Reset test database if needed (example)
psql postgresql://dotmac_user:change-me-in-production@localhost:5432/postgres \
  -c "DROP DATABASE IF EXISTS dotmac; CREATE DATABASE dotmac;"

# Re-run migrations
./scripts/run_all_tests_local.sh
```

## Performance Considerations

Load tests are resource-intensive:
- **test_create_1000_subscriptions**: ~1-2 minutes
- **test_concurrent_subscription_operations**: ~30-45 seconds
- **test_bulk_cancellation_performance**: ~30-45 seconds
- **Complete load scenario**: ~2-3 minutes

For CI/CD, consider running load tests separately:
```bash
# Fast tests for PR checks
poetry run pytest -m "not slow"

# Load tests in separate job
./scripts/run_all_tests_local.sh -m "slow and integration"
```

## Summary

✅ **Load tests**: Now enabled by default with script
✅ **SQLite skips**: Eliminated by using PostgreSQL
✅ **Migration handling**: Automatic with script
✅ **Service startup**: Automatic if needed

**Result**: All tests run locally with no skips!
