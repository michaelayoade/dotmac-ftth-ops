# Test Fixture Best Practices

This guide documents the patterns we expect all new pytest fixtures to follow. It focuses on reproducible database state, deterministic async cleanup, and reusable overrides that work for both sync and async unit tests.

## Database Isolation

- Prefer the new `DatabaseTestContext` utility (`dotmac.platform.db.testing`) over ad-hoc overrides. It wires in-memory SQLite engines for both sync and async sessions, rebuilds metadata on entry, and restores the production configuration automatically.
- Use it as a fixture with `yield` semantics. Example:

```python
@pytest.fixture
def override_db():
    with override_database_for_tests(metadata_bases=[Base]):
        yield
```

- When an async test needs direct access to a session, rely on the context helpers instead of constructing engines manually:

```python
@pytest_asyncio.fixture
async def async_session(override_db):
    with override_database_for_tests(metadata_bases=[Base]) as ctx:
        async with ctx.async_session() as session:
            yield session
```

- Call `await dispose_async_context(context)` in teardown only if the test exits the context without awaiting `aclose()` (for example, when the fixture is module scoped).

## Fixture Scope and Composition

- Keep fast unit fixtures function-scoped by default. Promote to `module` scope only when the fixture is read-only and cheap to build (e.g., static config data).
- Build composite fixtures by injecting dependencies explicitly instead of reading globals. This keeps override ordering straightforward and avoids accidental cross-test leakage.

## Async Cleanup

- Always close async resources. Prefer `async with` blocks where possible; otherwise assign the value to a variable and dispose it in a `try/finally`.
- When a fixture yields an async generator, run cleanup logic after the `yield` (pytest will await the `finally` block correctly).

## FastAPI Dependency Overrides

- For router tests, override dependencies using `app.dependency_overrides` inside a fixture and clear them in the fixture teardown. Pair this with `override_database_for_tests` so that all database access uses the shared in-memory sessions.
- Avoid mutating the global dependency mapping at import time; the override should live inside the fixture so parallel test runs stay isolated.

## Factory Fixtures

- Keep factories thin wrappers around `factory_boy` classes or helper builders. Factories should accept explicit keyword overrides (e.g., `tenant_id="tenant-a"`) and never reach into other fixtures internally.
- Co-locate domain-specific factories in the feature package under `tests/<module>/factories.py` so they are easy to discover.

## Type Checking Fixtures

- Run `make typecheck` locally when updating or creating fixtures. It validates both `mypy --strict` and `pyright` against the database helpers to catch issues with async context managers or signature mismatches early.
