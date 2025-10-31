# Unit Test Review – Verified Analysis (2025-10-31)

## Snapshot
- Branch: `feature/bss-phase1-isp-enhancements`
- Commit: `1fb6e559d7565b0beed4d6ae3a32a59c4b546e63`
- Measurement window: `2025-10-31 10:06:13 UTC`
- Primary tooling:
  - `rg` for discovery counts
  - `python3 scripts/test_pyramid_progress.py --json` for marker coverage
  - `bash scripts/count_mocks.sh` for mock-usage accounting
  - Ad‑hoc metric helper (included below) for function/class totals and oversized files

```bash
# Test file count
rg --files -g 'test_*.py' tests | wc -l

# Function/class inventory
python3 - <<'PY'
import os
root='tests'
sync_funcs=0
async_funcs=0
classes=0
for dirpath, _, filenames in os.walk(root):
    for name in filenames:
        if not name.startswith('test_') or not name.endswith('.py'):
            continue
        with open(os.path.join(dirpath, name), encoding='utf-8', errors='ignore') as fh:
            for line in fh:
                stripped=line.strip()
                if stripped.startswith('async def test_'):
                    async_funcs += 1
                elif stripped.startswith('def test_'):
                    sync_funcs += 1
                elif stripped.startswith('class Test'):
                    classes += 1
print(f"Sync test functions: {sync_funcs}")
print(f"Async test functions: {async_funcs}")
print(f"Total test functions: {sync_funcs + async_funcs}")
print(f"Test classes: {classes}")
PY

# Oversized test files
python3 - <<'PY'
import os
records=[]
for dirpath, _, filenames in os.walk('tests'):
    for name in filenames:
        if name.startswith('test_') and name.endswith('.py'):
            path=os.path.join(dirpath, name)
            with open(path, encoding='utf-8', errors='ignore') as fh:
                lines=sum(1 for _ in fh)
            records.append((lines, path))
records.sort(reverse=True)
for lines, path in records[:15]:
    print(f"{lines:5d} {path}")
PY
```

## Strengths Observed
- **Modular fixtures:** The plugin registry in `tests/conftest.py:8` keeps fixtures isolated by concern (environment, DB, async helpers, billing, cache bypass).
- **Real database exercise:** `tests/fixtures/database.py:20` provisions session-scoped engines plus per-test `AsyncSession` rollbacks, ensuring migrations are exercised while keeping isolation intact.
- **Factory realism:** Billing factories (`tests/billing/factories.py:1`) create true domain entities, prefer `flush()` over `commit()`, and expose `_commit` overrides for edge cases.
- **HTTP client ergonomics:** The `HybridTestClient` and auth overrides in `tests/fixtures/app.py:231` provide a unified test client with automatic dependency resets from `tests/fixtures/cleanup.py:15`.
- **Documentation depth:** The testing guides (`tests/FIXTURE_ORGANIZATION.md`, `tests/TESTING_PATTERNS.md`, `tests/TEST_STRUCTURE_GUIDE.md`) document fixture ownership, async guidance, and cleanup registry usage.

## Key Metrics

| Metric | Value | How to reproduce |
| --- | --- | --- |
| Test files | 544 | `rg --files -g 'test_*.py' tests \| wc -l` |
| Test functions | 9 918 (5 692 async / 4 226 sync) | Python helper in Snapshot section |
| Test classes | 2 434 | Python helper in Snapshot section |
| Files with module-level `pytestmark` | 307 (56.4%) | `rg -g 'test_*.py' -l 'pytestmark\s*=' tests \| wc -l` |
| Files with decorator markers | 476 (87.5%) | `rg -g 'test_*.py' -l '@pytest\.mark' tests \| wc -l` |
| Files without any marker | 3 (0.6%) | `python3 scripts/test_pyramid_progress.py --json` |
| Mock usage lines | 3 947 | `bash scripts/count_mocks.sh` |
| `serial_only` markers | 12 occurrences | `rg -g 'test_*.py' -o 'pytest\.mark\.serial_only' tests \| wc -l` |
| `parallel_safe` markers | 3 occurrences | `rg -g 'test_*.py' -o 'pytest\.mark\.parallel_safe' tests \| wc -l` |
| Test files ≥1 000 LOC | 15 | Oversized-file helper in Snapshot section |

## Detailed Findings & Actions

### Mock Usage
- `scripts/count_mocks.sh` (run 2025-10-31) reports **3 947** mock-related lines (imports, `Mock`, `@patch`, etc.). Top modules:

| Module | Lines |
| --- | --- |
| billing | 1 907 |
| auth | 509 |
| secrets | 478 |
| webhooks | 285 |
| customer_management | 257 |
| workflows | 244 |
| tenant | 243 |
| communications | 232 |
| file_storage | 231 |
| contacts | 223 |

- **Owners (per module leads in docs/README_ISP_PLATFORM.md §2):**
  - Billing Platform → Billing squad
  - Auth & Identity → Identity squad
  - Secrets/Webhooks/Tenant → Security & Integrations squad

**Next steps**
1. Treat `billing`, `auth`, and `secrets` as sprint-level targets; adapt the factory patterns already piloted in `tests/billing/factories.py:1` to customer management and CRM.
2. Instrument the script in CI (`scripts/count_mocks.sh --json` extension recommended) so that reductions trend by module and owner.
3. Gate new mocks by adding a pre-commit hook that fails when module totals increase (option: leverage `scripts/count_mocks.sh --diff` once implemented).

### Marker Coverage & Enforcement
- `python3 scripts/test_pyramid_progress.py --json` shows **541 / 544** files with pyramid markers; the three outliers:
  - `tests/deployment/deployment/test_workflow_service_async.py`
  - `tests/genieacs/genieacs/test_genieacs_persistence.py`
  - `tests/network_monitoring/network_monitoring/test_prometheus_integration.py`
- `pytest.ini:14` already enables `--strict-markers`, so CI will fail on unknown markers.
- Module-level `pytestmark` is present in 307 files; the rest rely on decorator markers.

**Next steps**
1. Mark the three stragglers (likely `@pytest.mark.integration` + `@pytest.mark.slow`), then update `scripts/test_pyramid_progress.py` to exit non-zero when `unmarked_files > 0` so the check can run in CI.
2. Prefer module-level `pytestmark` for integration/e2e suites so `pytest -m unit` filters cleanly; `python scripts/batch_add_markers.py --marker integration <path>` automates list insertion.
3. Replace the fragile `grep` command in older docs with `python3 scripts/test_pyramid_progress.py --json` for consistent detection (handles multiline `pytestmark = [...]` blocks).

### Parallel Execution Readiness
- Marker count imbalance: 12 `serial_only` vs 3 `parallel_safe`. The imbalance, not the absolute count of serial tests, is throttling xdist runs.
- `scripts/test-parallel-safety.sh` offers four curated profiles (`serial`, `parallel`, `ci`, `ci-split`). None of them currently produce timing reports.

**Next steps**
1. Capture timing data: run `poetry run pytest -m "integration and serial_only" --durations=20` and `poetry run pytest -m "integration and parallel_safe" -n auto --durations=20`; append results to `test-results/parallel-baseline.md`.
2. Audit integration files without DB/session fixtures and mark them `@pytest.mark.parallel_safe`; target at least 20 candidates in billing/auth within the next sprint.
3. Update `scripts/test-parallel-safety.sh` to add `--durations=10` and fail if serial profile exceeds agreed target (>15 minutes, for example).

### Large Test Files
- Oversized file snapshot (≥1 000 LOC):

| LOC | Path |
| --- | --- |
| 1 388 | `tests/billing/subscriptions/test_subscription_service_core.py` |
| 1 354 | `tests/resilience/test_service_mesh_coverage.py` |
| 1 219 | `tests/secrets/test_vault_client_real.py` |
| 1 191 | `tests/plugins/test_registry_real.py` |
| 1 177 | `tests/contacts/test_contacts_router_comprehensive.py` |
| 1 165 | `tests/data_transfer/test_transfer_models_comprehensive.py` |
| 1 132 | `tests/billing/test_invoice_integration.py` |
| 1 104 | `tests/customer_management/test_bug_fixes.py` |
| 1 096 | `tests/integrations/test_integrations_comprehensive.py` |
| 1 065 | `tests/file_storage/test_service_comprehensive.py` |

- Many of these files centralize fixtures or parametrized flows; splitting them without extracting shared setup will duplicate factories/fixtures and drift expectations.

**Next steps**
1. Start with `tests/billing/subscriptions/test_subscription_service_core.py`: extract shared fixture helpers into `tests/billing/subscriptions/_fixtures/` (pattern matches new directory already present in Git status) before splitting by feature (creation, lifecycle, cancellation).
2. For each split, create module-level `pytestmark` and reuse the new shared fixture module to avoid divergent setup logic.
3. Add a lint step (`python3 - <<'PY' ...` from Snapshot) to non-blocking CI to warn when files exceed 800 LOC.

### Test Isolation & Cleanup
- Autouse fixtures in `tests/fixtures/cleanup.py:15` clear dependency overrides, reset the cleanup registry, and disable rate limiting except for targeted tests.
- Ensure new module-level `conftest.py` files opt-in to the registry; when adding fixtures, document cleanup expectations in `tests/TEST_ISOLATION_FIXES.md`.

**Next steps**
1. Add a smoke test verifying registry cleanup: create `tests/unit/test_cleanup_registry_guard.py` asserting that dependency overrides are cleared between two back-to-back tests.
2. Extend `tests/helpers/cleanup_registry` with instrumentation (counter of registered callbacks) so CI can flag tests that leak cleanup tasks.

## Prioritized Action Plan
1. **Mock reduction sprint** – Billing/Auth/Secrets owners to cut 1 500 mock lines by adopting factories/fakes; track progress via `scripts/count_mocks.sh`.
2. **Marker enforcement** – Mark the three uncovered files and wire `scripts/test_pyramid_progress.py` into CI with a failure threshold.
3. **Parallel-readiness audit** – Graduate 20 additional files to `parallel_safe`, update the safety script to emit durations, and publish timings.
4. **Oversized file refactor** – Begin with subscription and resilience suites; extract shared setup before slicing into focused files.
5. **Cleanup verification** – Add automated guard rails to ensure autouse fixtures continue to prevent state leakage.

With these corrections the review now reflects current data (commit `1fb6e55`) and maps each recommendation to reproducible evidence and concrete owners.
