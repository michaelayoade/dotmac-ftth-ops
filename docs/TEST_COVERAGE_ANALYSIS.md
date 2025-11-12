# DotMac Platform – Verified Test Coverage Analysis

## Executive Summary
- 59/61 modules (96.7%) have dedicated test packages; only `db, timeseries` remain untested.
- Counted 633 Python source files inside `src/dotmac/platform` module directories.
- The test suite spans 684 Python files containing 10,027 tests (5,711 async; 57.0%).
- Average test-to-source file ratio is 1.08 (test files vs. module-scoped source files).
- Metrics were generated via an AST-based scanner (see Methodology) executed against the current workspace state.

## High-Level Metrics
| Metric | Value |
| --- | --- |
| Source modules | 61 |
| Module-scoped source files | 633 |
| Total test files | 684 |
| Test packages under `tests/` | 74 |
| Test functions (all) | 10,027 |
| Async test functions | 5,711 (57.0%) |
| Test lines of code | 263,908 |
| Conftest files | 37 |
| Shared fixtures (`tests/shared_fixtures.py`) | 20 |
| Fixture helper modules | 14 |
| Helper utility modules | 14 |

## Module Coverage Snapshot (Top Ratios)
| Module | Source Files | Test Files | Test Functions | Async Tests | Ratio |
| --- | --- | --- | --- | --- | --- |
| integrations | 3 | 11 | 113 | 78 | 3.67 |
| contacts | 5 | 16 | 140 | 101 | 3.20 |
| customer_management | 7 | 16 | 278 | 197 | 2.29 |
| webhooks | 6 | 11 | 207 | 156 | 1.83 |
| auth | 23 | 41 | 703 | 474 | 1.78 |
| secrets | 8 | 13 | 356 | 102 | 1.62 |
| netbox | 5 | 8 | 111 | 82 | 1.60 |
| observability | 2 | 3 | 105 | 0 | 1.50 |
| sales | 6 | 9 | 122 | 0 | 1.50 |
| user_management | 7 | 10 | 186 | 160 | 1.43 |

## Focus Modules
### Billing
- Source files: 129 | Test files: 146 | Ratio: 1.13
- Test functions: 2,110 (async: 1,225)
- Test LOC: 58,104

### Auth
- Source files: 23 | Test files: 41 | Ratio: 1.78
- Test functions: 703 (async: 474)
- Test LOC: 16,543

### Monitoring
- Source files: 18 | Test files: 21 | Ratio: 1.17
- Test functions: 300 (async: 162)
- Test LOC: 7,501

### Tenant
- Source files: 21 | Test files: 22 | Ratio: 1.05
- Test functions: 335 (async: 295)
- Test LOC: 8,904

### Customer Management
- Source files: 7 | Test files: 16 | Ratio: 2.29
- Test functions: 278 (async: 197)
- Test LOC: 8,876

## Coverage Gaps
- Untested modules: db, timeseries
- Sub-0.5 ratios: access (0.44), versioning (0.40), jobs (0.38), cache (0.25), deployment (0.23), ansible (0.22), ticketing (0.22), realtime (0.20), notifications (0.19), licensing (0.17)
- GraphQL coverage remains thin at 4 test files for 35 source files (ratio 0.11).

## Test Pattern Usage
- Files named `*router*.py`: 92
- Files named `*service*.py`: 97
- Files named `*integration*.py`: 56
- Files named `*comprehensive*.py`: 74
- Files named `*unit.py`: 17
- Files named `*e2e*.py`: 14

## Pytest Markers & Mock Usage
- Files using `pytest.mark.asyncio`: 391 (57.2%)
- Files using `pytest.mark.skip`: 6 (0.9%)
- Files using `pytest.mark.slow`: 8 (1.2%)
- Files using `pytest.mark.parametrize`: 7 (1.0%)
- Files importing or using mocks: 386 (56.4%)
- Files using `AsyncMock`: 268 (39.2%)

## Recommendations
1. Add targeted suites for `db` and `timeseries` utility modules to close the remaining module-level gap.
2. Expand GraphQL resolver tests beyond the current 4 files to raise the 0.11 ratio.
3. Prioritise modules under a 0.5 ratio (e.g., `deployment`, `ansible`, `ticketing`, `realtime`, `notifications`) for incremental coverage.
4. Broaden parametrised testing—only seven files currently use `pytest.mark.parametrize`.

## Methodology
All figures come from `scripts/test_metrics_snapshot.py`, which walks `src/dotmac/platform` and `tests`, counts AST nodes, and tallies file-level statistics. Re-run it any time after making changes:

```bash
python3 scripts/test_metrics_snapshot.py | jq '.summary'
```
