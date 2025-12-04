# Quick Start: New Test Suites

**Date**: 2025-10-03
**Purpose**: Run and verify the newly created test suites for critical files

---

## Files Created

4 comprehensive test suites targeting the most critical coverage gaps:

1. ✅ `tests/auth/test_rbac_router_comprehensive.py` (30 tests)
2. ✅ `tests/auth/test_token_with_rbac_comprehensive.py` (~45 tests)
3. ✅ `tests/audit/test_audit_router_comprehensive.py` (~60 tests)
4. ✅ `tests/communications/test_metrics_service_comprehensive.py` (~35 tests)

**Total**: ~170 new test cases

---

## Quick Commands

### 1. Verify Test Discovery (Fast)
```bash
# Check all tests are discoverable
.venv/bin/pytest \
  tests/auth/test_rbac_router_comprehensive.py \
  tests/auth/test_token_with_rbac_comprehensive.py \
  tests/audit/test_audit_router_comprehensive.py \
  tests/communications/test_metrics_service_comprehensive.py \
  --co -q
```

### 2. Run All New Tests (Quick Check)
```bash
# Run without coverage for speed
.venv/bin/pytest \
  tests/auth/test_rbac_router_comprehensive.py \
  tests/auth/test_token_with_rbac_comprehensive.py \
  tests/audit/test_audit_router_comprehensive.py \
  tests/communications/test_metrics_service_comprehensive.py \
  -v --tb=short -q
```

### 3. Run with Coverage (Full Verification)
```bash
# Run each module with its coverage report
.venv/bin/pytest tests/auth/test_rbac_router_comprehensive.py \
  --cov=src/dotmac/platform/auth/rbac_router \
  --cov-report=term-missing -v

.venv/bin/pytest tests/auth/test_token_with_rbac_comprehensive.py \
  --cov=src/dotmac/platform/auth/token_with_rbac \
  --cov-report=term-missing -v

.venv/bin/pytest tests/audit/test_audit_router_comprehensive.py \
  --cov=src/dotmac/platform/audit/router \
  --cov-report=term-missing -v

.venv/bin/pytest tests/communications/test_metrics_service_comprehensive.py \
  --cov=src/dotmac/platform/communications/metrics_service \
  --cov-report=term-missing -v
```

---

## Individual Test File Commands

### RBAC Router (30 tests)
```bash
# Run tests
.venv/bin/pytest tests/auth/test_rbac_router_comprehensive.py -v

# With coverage
.venv/bin/pytest tests/auth/test_rbac_router_comprehensive.py \
  --cov=src/dotmac/platform/auth/rbac_router \
  --cov-report=term-missing
```

### Token with RBAC (~45 tests)
```bash
# Run tests
.venv/bin/pytest tests/auth/test_token_with_rbac_comprehensive.py -v

# With coverage
.venv/bin/pytest tests/auth/test_token_with_rbac_comprehensive.py \
  --cov=src/dotmac/platform/auth/token_with_rbac \
  --cov-report=term-missing
```

### Audit Router (~60 tests)
```bash
# Run tests
.venv/bin/pytest tests/audit/test_audit_router_comprehensive.py -v

# With coverage
.venv/bin/pytest tests/audit/test_audit_router_comprehensive.py \
  --cov=src/dotmac/platform/audit/router \
  --cov-report=term-missing
```

### Metrics Service (~35 tests)
```bash
# Run tests
.venv/bin/pytest tests/communications/test_metrics_service_comprehensive.py -v

# With coverage
.venv/bin/pytest tests/communications/test_metrics_service_comprehensive.py \
  --cov=src/dotmac/platform/communications/metrics_service \
  --cov-report=term-missing
```

---

## Expected Results

### Coverage Before vs After

| Module | Before | After (Expected) |
|--------|--------|------------------|
| auth/rbac_router.py | 0.00% | **90%+** |
| auth/token_with_rbac.py | 0.00% | **90%+** |
| audit/router.py | 24.44% | **90%+** |
| communications/metrics_service.py | 24.82% | **90%+** |

---

## Troubleshooting

### If Tests Fail

#### 1. Import Errors
```bash
# Ensure all dependencies are installed
poetry install --with dev

# Check if pytest-asyncio is available
.venv/bin/pytest --version
```

#### 2. Async Test Issues
The tests use `@pytest.mark.asyncio` decorator. Ensure `pytest-asyncio` is configured in `pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
```

#### 3. Mock/Fixture Errors
Tests use extensive mocking. If you see errors related to:
- `cache_manager` - Tests already mock this with `@patch` decorator
- Database sessions - Tests use `async_db_session` fixture from conftest.py
- User fixtures - Tests define their own user fixtures

#### 4. Model Import Errors
If model imports fail, verify:
```bash
# Check if models exist
ls -la src/dotmac/platform/auth/models.py
ls -la src/dotmac/platform/audit/models.py
ls -la src/dotmac/platform/communications/models.py
```

---

## Quick Fixes

### Fix 1: Skip Failing Tests Temporarily
```bash
# Run with -k to select specific tests
.venv/bin/pytest tests/auth/test_rbac_router_comprehensive.py \
  -k "not test_create_role" -v
```

### Fix 2: Run with More Debug Info
```bash
# Add -vv for very verbose output
.venv/bin/pytest tests/auth/test_rbac_router_comprehensive.py -vv --tb=long
```

### Fix 3: Run One Test at a Time
```bash
# Run a specific test
.venv/bin/pytest tests/auth/test_rbac_router_comprehensive.py::TestPermissionEndpoints::test_list_all_permissions -v
```

---

## Next Steps After Verification

1. **Review Coverage Reports**
   ```bash
   # Generate HTML coverage report
   .venv/bin/pytest tests/auth/test_rbac_router_comprehensive.py \
     --cov=src/dotmac/platform/auth/rbac_router \
     --cov-report=html

   # Open in browser
   open htmlcov/index.html
   ```

2. **Fix Any Failing Tests**
   - Check error messages
   - Adjust mocks/fixtures
   - Update test expectations

3. **Integrate into CI/CD**
   ```yaml
   # Add to .github/workflows/test.yml
   - name: Run Critical Coverage Tests
     run: |
       pytest tests/auth/test_rbac_router_comprehensive.py \
              tests/auth/test_token_with_rbac_comprehensive.py \
              tests/audit/test_audit_router_comprehensive.py \
              tests/communications/test_metrics_service_comprehensive.py \
              --cov --cov-report=xml
   ```

4. **Complete Remaining Coverage**
   - See `CRITICAL_COVERAGE_FIXES_SUMMARY.md` for details
   - Next priority: `file_storage/minio_storage.py`

---

## Success Checklist

- [ ] All 4 test files are discoverable
- [ ] Tests run without import errors
- [ ] RBAC Router coverage > 90%
- [ ] Token with RBAC coverage > 90%
- [ ] Audit Router coverage > 90%
- [ ] Metrics Service coverage > 90%
- [ ] No critical test failures
- [ ] Coverage reports generated

---

## Summary

Run this one command to verify everything works:

```bash
# One-liner to run all new tests with coverage
.venv/bin/pytest \
  tests/auth/test_rbac_router_comprehensive.py \
  tests/auth/test_token_with_rbac_comprehensive.py \
  tests/audit/test_audit_router_comprehensive.py \
  tests/communications/test_metrics_service_comprehensive.py \
  --cov=src/dotmac/platform/auth/rbac_router \
  --cov=src/dotmac/platform/auth/token_with_rbac \
  --cov=src/dotmac/platform/audit/router \
  --cov=src/dotmac/platform/communications/metrics_service \
  --cov-report=term-missing \
  -v --tb=short
```

This will show you exactly which lines are still missing coverage and which tests pass/fail.

Good luck! 🚀
