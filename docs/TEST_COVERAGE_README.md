# DotMac Platform Test Coverage Overview

## Snapshot
- Test packages exist for 59/61 backend modules (96.7%); missing: db, timeseries.
- Counted 633 Python source files within `src/dotmac/platform` and 684 Python test files under `tests/`.
- The suite defines 10,027 pytest tests, 5,711 of which are async (57.0%).
- Aggregate test code weighs in at 263,908 lines, yielding a 1.08 test-to-source file ratio.

## Key Strengths
- High coverage of critical domains such as billing (146 test files, 2,110 tests) and auth (41 test files, 703 tests).
- Async-first design: 5,711 async tests across 391 files using `pytest.mark.asyncio`.
- 37 `conftest.py` files, 20 shared fixtures, and dedicated fixture/helper packages keep setup consistent.
- Mocking is pervasive: 386 test files reference `unittest.mock`, `patch`, or `AsyncMock` (56.4% of the suite).

## Immediate Gaps
- No targeted tests yet for `db` and `timeseries` helper modules.
- GraphQL coverage remains light: 4 test files for 35 source files (ratio 0.11).
- Sub-0.5 ratios in modules such as `deployment`, `ansible`, `ticketing`, `realtime`, and `notifications` should be prioritised when extending coverage.

## Reproducing These Metrics
Run the repository-local scanner for an up-to-date snapshot:

```bash
python3 scripts/test_metrics_snapshot.py | jq '.summary'
```
