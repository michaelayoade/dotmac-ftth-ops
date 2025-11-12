# Test Parallel Safety Configuration

## Overview

This document describes the parallel test safety infrastructure implemented to prevent PostgreSQL connection pool exhaustion during integration tests.

## ✅ Completed Implementation

### 1. Pytest Markers (pytest.ini)

Added two new markers for managing parallel test execution:

```ini
serial_only: Database-heavy tests requiring serial execution (prevents connection pool exhaustion)
parallel_safe: Tests safe for parallel execution with -n auto
```

**Usage Examples:**
```bash
# Run only serial tests
pytest tests/ -m "integration and serial_only"

# Run only parallel-safe tests
pytest tests/ -m "integration and parallel_safe" -n auto

# Full integration suite (serial)
pytest tests/ -m integration
```

### 2. Connection Pool Environment Variables (settings.py)

Added environment variable overrides for connection pool tuning:

```python
# Environment Variables
PG_POOL_SIZE=20        # Default: 10
PG_MAX_OVERFLOW=40     # Default: 20
PG_POOL_TIMEOUT=60     # Default: 30 seconds
```

**Configuration Location:** `src/dotmac/platform/settings.py` lines 594-611

These variables allow dynamic pool sizing without code changes:

```bash
# CI with larger pool
PG_POOL_SIZE=20 PG_MAX_OVERFLOW=40 pytest tests/integration/

# Local development with smaller pool
PG_POOL_SIZE=5 pytest tests/integration/
```

## 📋 Next Steps: Mark Tests

### Critical Tests Needing `serial_only` Marker

These tests are database-heavy and should run serially:

1. **tests/integration/test_dual_stack_subscriber_provisioning.py**
   - All tests in `TestDualStackSubscriberProvisioning` class
   - Uses `async_db_session` (PostgreSQL)
   - Creates multiple subscriber records with RADIUS profiles

   ```python
   @pytest.mark.integration
   @pytest.mark.serial_only  # ← Add this
   class TestDualStackSubscriberProvisioning:
       ...
   ```

2. **tests/integration/test_complete_provisioning_workflow.py**
   - All tests in `TestCompleteProvisioningWorkflow` class
   - E2E provisioning across RADIUS + NetBox + WireGuard
   - Heavy connection usage

   ```python
   @pytest.mark.integration
   @pytest.mark.serial_only  # ← Add this
   class TestCompleteProvisioningWorkflow:
       ...
   ```

3. **tests/integration/test_phase1_smoke.py**
   - `TestDatabaseMigrations` class specifically
   - Queries `information_schema` (PostgreSQL-specific)

   ```python
   @pytest.mark.integration
   @pytest.mark.serial_only  # ← Add this
   class TestDatabaseMigrations:
       ...
   ```

4. **tests/integration/test_wireguard_dual_stack_integration.py**
   - All tests in `TestWireGuardDualStackIntegration`
   - External WireGuard service dependencies

   ```python
   @pytest.mark.integration
   @pytest.mark.serial_only
   class TestWireGuardDualStackIntegration:
       ...
   ```

### Tests Safe for `parallel_safe` Marker

These tests can run in parallel:

1. **tests/integration/test_module_interfaces.py** - Lightweight interface tests
2. **tests/integration/test_frontend_backend_smoke.py** - Basic smoke tests
3. **tests/integration/test_customer_contact_relationship.py** - Simple relationship tests

## 🚀 Helper Scripts

### Create `scripts/test-parallel-safety.sh`

```bash
#!/bin/bash
# Test execution profiles for parallel safety

set -e

echo "🧪 Parallel Test Safety Profiles"
echo "================================"

# Profile 1: Serial database-heavy tests
test_serial() {
    echo "📊 Running serial database-heavy tests..."
    pytest -m "integration and serial_only" -v --tb=short
}

# Profile 2: Parallel-safe tests
test_parallel() {
    echo "⚡ Running parallel-safe tests..."
    pytest -m "integration and parallel_safe" -n auto -v --tb=short
}

# Profile 3: CI with tuned pool
test_ci() {
    echo "🔧 Running CI with tuned connection pool..."
    PG_POOL_SIZE=20 PG_MAX_OVERFLOW=40 \
        pytest -m integration --dist loadgroup -n 4 -v --tb=short
}

# Profile 4: CI split execution (serial then parallel)
test_ci_split() {
    echo "🎯 Running CI split execution..."
    echo "  Step 1: Serial tests..."
    PG_POOL_SIZE=15 PG_MAX_OVERFLOW=30 \
        pytest -m "integration and serial_only" -v --tb=short

    echo "  Step 2: Parallel tests..."
    PG_POOL_SIZE=20 PG_MAX_OVERFLOW=40 \
        pytest -m "integration and parallel_safe" -n 4 -v --tb=short
}

# Parse command
case "${1:-help}" in
    serial)
        test_serial
        ;;
    parallel)
        test_parallel
        ;;
    ci)
        test_ci
        ;;
    ci-split)
        test_ci_split
        ;;
    help|*)
        echo "Usage: $0 {serial|parallel|ci|ci-split}"
        echo ""
        echo "Profiles:"
        echo "  serial     - Run serial_only tests sequentially"
        echo "  parallel   - Run parallel_safe tests with -n auto"
        echo "  ci         - Run all integration tests with tuned pool"
        echo "  ci-split   - Run serial then parallel (recommended for CI)"
        exit 1
        ;;
esac
```

### GitHub Actions Integration

Update `.github/workflows/unified-ci.yml`:

```yaml
- name: Run Integration Tests (Serial)
  env:
    PG_POOL_SIZE: 15
    PG_MAX_OVERFLOW: 30
  run: |
    poetry run pytest -m "integration and serial_only" --tb=short

- name: Run Integration Tests (Parallel)
  env:
    PG_POOL_SIZE: 20
    PG_MAX_OVERFLOW: 40
  run: |
    poetry run pytest -m "integration and parallel_safe" -n 4 --tb=short
```

## 📊 Expected Impact

### Before
- Connection pool exhaustion during parallel test runs
- Random PostgreSQL "Connection refused" errors
- Tests failing intermittently

### After
- Serial execution for database-heavy tests prevents contention
- Parallel execution for lightweight tests speeds up CI
- Environment variables allow pool tuning per environment
- Predictable test execution

## 🔍 Monitoring

Check connection pool usage:

```bash
# Monitor active connections during tests
docker exec dotmac-ftth-ops-postgres-1 \
    psql -U dotmac_user -d dotmac -c \
    "SELECT count(*), state FROM pg_stat_activity \
     WHERE datname = 'dotmac' GROUP BY state;"
```

Expected healthy output:
```
count | state
------+---------------------
  4   | active
  2   | idle
  3   | idle in transaction
```

## 📝 Maintenance

When adding new integration tests:

1. **Ask: Does this test use `async_db_session`?**
   - YES → Mark with `@pytest.mark.serial_only`
   - NO → Can mark with `@pytest.mark.parallel_safe`

2. **Ask: Does this test create many database connections?**
   - YES → Mark with `@pytest.mark.serial_only`
   - NO → Can mark with `@pytest.mark.parallel_safe`

3. **Ask: Does this test depend on external services (WireGuard, etc.)?**
   - YES → Mark with `@pytest.mark.serial_only`
   - NO → Can mark with `@pytest.mark.parallel_safe`

## 🎯 Quick Reference

```bash
# Local development (serial)
pytest tests/integration/

# Local development (parallel safe only)
pytest -m "integration and parallel_safe" -n auto

# CI recommended approach
./scripts/test-parallel-safety.sh ci-split

# Tune pool for specific test
PG_POOL_SIZE=25 pytest tests/integration/test_heavy.py
```

## 🔗 Related Files

- `pytest.ini` - Marker definitions and execution strategies
- `src/dotmac/platform/settings.py` - Connection pool configuration
- `src/dotmac/platform/db.py` - Engine creation with pool settings
- `.github/workflows/unified-ci.yml` - CI test execution

## ✨ Benefits

1. **Reliability**: No more intermittent connection failures
2. **Speed**: Parallel execution where safe
3. **Flexibility**: Environment-based pool tuning
4. **Clarity**: Explicit markers show test characteristics
5. **CI Optimization**: Split execution maximizes throughput

---

**Status**: ✅ Infrastructure complete, test marking in progress

**Next Action**: Mark the 4 critical test files listed above with `@pytest.mark.serial_only`
