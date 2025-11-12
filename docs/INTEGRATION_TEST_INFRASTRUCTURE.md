# Integration Test Infrastructure Review

## Overview
The integration test marker infrastructure is **fully functional and working correctly**. This document provides a comprehensive review of the current setup and best practices.

## Test Marker Configuration

### Location of Marker Definitions
Integration test markers are defined in **two locations** (both are valid):
1. **pytest.ini** (lines 33-50)
2. **pyproject.toml** (lines 192-205)

### Marker Definition
```ini
markers =
    unit: Fast unit tests (<0.1s) - default execution
    integration: Integration tests requiring external services (medium, <1s)
    slow: Slow running tests (>1s) - excluded from default runs
    e2e: End-to-end workflow tests
    ...
```

## Current Test Distribution

### Statistics (as of last collection):
- **Total tests**: 10,014
- **Integration tests**: 4,970 (49.6%)
- **Unit tests**: 5,044 (50.4%)

### Collection Commands
```bash
# Collect all integration tests
poetry run pytest -m integration --collect-only

# Collect unit tests only
poetry run pytest -m "not integration" --collect-only

# Run integration tests
poetry run pytest -m integration

# Run specific integration test file
poetry run pytest -m integration tests/auth/test_auth_metrics_router.py -v
```

## Running Integration Tests

### Basic Execution
```bash
# Run all integration tests
poetry run pytest -m integration

# Run integration tests with verbose output
poetry run pytest -m integration -v

# Run integration tests in parallel (safe for most tests)
poetry run pytest -m integration -n auto

# Run integration tests with loadgroup distribution (better isolation)
poetry run pytest -m integration -n auto --dist loadgroup
```

### Parallel Execution Strategy
```bash
# Parallel-safe integration tests
pytest -m "integration and parallel_safe" -n auto

# Serial-only DB tests (prevents connection pool exhaustion)
pytest -m "integration and serial_only"

# All integration tests with automatic grouping
pytest -m integration -n auto --dist loadgroup
```

## Test Categorization Best Practices

### Marking Integration Tests

#### Module-level Marking (Recommended)
```python
# Apply to all tests in the module
pytestmark = pytest.mark.integration

# Multiple markers
pytestmark = [
    pytest.mark.integration,
    pytest.mark.slow,
]
```

#### Class-level Marking
```python
@pytest.mark.integration
class TestCustomerIntegration:
    def test_customer_creation(self):
        pass
```

#### Function-level Marking
```python
@pytest.mark.integration
async def test_database_connection():
    pass
```

## Conditional Skipping

### Environment-based Skipping
The infrastructure supports conditional test execution based on environment variables:

```python
# Load tests example (tests/billing/test_subscription_load.py)
RUN_SUBSCRIPTION_LOAD_TESTS = os.getenv("RUN_SUBSCRIPTION_LOAD_TESTS") == "1"

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not RUN_SUBSCRIPTION_LOAD_TESTS,
        reason="Set RUN_SUBSCRIPTION_LOAD_TESTS=1 to enable subscription load tests.",
    ),
]
```

### Database-specific Skipping
```python
# SQLite-specific behavior tests
if async_db_engine.url.get_backend_name().startswith("sqlite"):
    pytest.skip(
        "SQLite keeps flushed data visible with shared connections; behaviour not guaranteed"
    )
```

## Expected Skipped Tests

### 1. SQLite-specific Tests
**File**: `tests/billing/test_factory_commit_behavior.py:169`
**Reason**: Tests database transaction isolation behavior that differs between SQLite and PostgreSQL
**Status**: ✅ **Expected** - These tests should skip on SQLite

### 2. Load/Performance Tests
**Files**: `tests/billing/test_subscription_load.py`
**Reason**: Resource-intensive tests that should only run when explicitly enabled
**Status**: ✅ **Expected** - Enable with `RUN_SUBSCRIPTION_LOAD_TESTS=1`

#### To run load tests:
```bash
export RUN_SUBSCRIPTION_LOAD_TESTS=1
poetry run pytest tests/billing/test_subscription_load.py -v
```

## Test Infrastructure Components

### Fixture Plugins (tests/conftest.py)
```python
pytest_plugins = [
    "tests.fixtures.environment",
    "tests.fixtures.database",
    "tests.fixtures.mocks",
    "tests.fixtures.async_support",
    "tests.fixtures.cleanup",
    "tests.fixtures.app",
    "tests.fixtures.misc",
    "tests.fixtures.billing_support",
    "tests.fixtures.async_db",
    "tests.fixtures.cache_bypass",
]
```

### Timeout Configuration
- **Global timeout**: 300s (5 minutes) per test
- **E2E tests**: Longer timeouts supported
- **Function-only timeouts**: Enabled to prevent infinite hangs

## Verification Results

### ✅ Syntax Errors: RESOLVED
- Fixed cached `.pyc` files causing false syntax errors
- Solution: Clean cache with `rm -rf tests/**/__pycache__ .pytest_cache`

### ✅ Integration Marker: WORKING
```bash
# Test collection verified:
poetry run pytest -m integration --collect-only
# Result: 4970/10014 tests collected (5044 deselected)

# Sample test run verified:
poetry run pytest -m integration tests/auth/test_auth_metrics_router.py -v
# Result: 12 passed in 8.29s ✅
```

### ✅ Unit Marker: WORKING
```bash
poetry run pytest -m "not integration" --collect-only
# Result: 5044/10014 tests collected (4970 deselected)
```

## CI/CD Integration

### Recommended Test Strategies
```yaml
# Fast CI (default)
pytest tests/

# Integration tests only
pytest tests/ -m integration

# Comprehensive CI
pytest tests/ -m "comprehensive"

# Full suite
pytest tests/ -m ""

# Module-specific
pytest tests/billing/ -v

# Parallel execution
pytest tests/ -n auto

# Parallel integration
pytest tests/ -m "integration" -n auto --dist loadgroup
```

## Common Issues and Solutions

### Issue 1: Cached .pyc Files
**Symptom**: Syntax errors in valid Python files
**Solution**:
```bash
rm -rf tests/**/__pycache__ .pytest_cache
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
```

### Issue 2: Connection Pool Exhaustion
**Symptom**: Database connection errors during parallel execution
**Solution**: Use `serial_only` marker or reduce parallelism
```python
@pytest.mark.serial_only
class TestDatabaseHeavyOperations:
    pass
```

### Issue 3: Race Conditions
**Symptom**: Intermittent test failures in parallel mode
**Solution**: Use `loadgroup` distribution or `serial` marker
```bash
pytest -m integration -n auto --dist loadgroup
```

## Test Execution Matrix

| Command | Tests Run | Use Case |
|---------|-----------|----------|
| `pytest` | All tests | Local development |
| `pytest -m unit` | Unit tests only | Fast feedback loop |
| `pytest -m integration` | Integration tests | Pre-commit verification |
| `pytest -m "not integration"` | Unit tests | Quick validation |
| `pytest -m e2e` | E2E tests | Full workflow testing |
| `pytest -m slow` | Slow tests | Performance validation |
| `pytest -n auto` | Parallel execution | CI/CD pipelines |

## Summary

### ✅ Infrastructure Status: FULLY FUNCTIONAL

1. **Marker Configuration**: Properly defined in both `pytest.ini` and `pyproject.toml`
2. **Test Collection**: Working correctly (4,970 integration tests identified)
3. **Test Execution**: Successfully running integration tests
4. **Conditional Skipping**: Working as expected for load tests and SQLite tests
5. **Parallel Execution**: Supported with `pytest-xdist`

### No Action Required
The integration test infrastructure is working correctly. The skipped tests shown are:
- ✅ **Expected behavior** (SQLite-specific tests)
- ✅ **Intentional gating** (load tests requiring environment variable)

### Recommendations
1. Continue using module-level `pytestmark` for consistent marking
2. Use `loadgroup` distribution for integration tests in CI
3. Clean cache regularly if encountering syntax errors
4. Use environment variables for expensive/optional tests
5. Mark database-heavy tests with `serial_only` for parallel safety

## Examples in Codebase

### Well-marked Integration Tests
- `tests/radius/test_radius_service_comprehensive.py` - Module-level marking
- `tests/billing/test_subscription_load.py` - Conditional skipping
- `tests/auth/test_auth_metrics_router.py` - Class-level marking
- `tests/tenant/test_usage_billing_integration.py` - Function-level marking

### Sample Integration Test Structure
```python
"""Integration tests for customer management."""
import pytest

pytestmark = pytest.mark.integration

class TestCustomerIntegration:
    @pytest.mark.asyncio
    async def test_customer_creation_workflow(self, async_db_session):
        # Test implementation
        pass
```

---

**Last Updated**: 2025-11-03
**Status**: ✅ All systems operational
