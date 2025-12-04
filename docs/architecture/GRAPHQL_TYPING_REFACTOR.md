# GraphQL Strict Typing Initiative

**Status:** Phase 1 – scope and preparation  
**Last Updated:** 2025-10-19  
**Owner:** Platform backend working group (GraphQL / Backend Foundations)

---

## Why This Matters

The GraphQL layer sits on top of orchestration, billing, wireless, tenant, and customer management services. Today we run MyPy in `strict` mode, but the GraphQL package still imports large portions of the platform that are effectively untyped. That means:

- Schema → model drift is only caught at runtime.
- Loader regressions (e.g. returning the wrong shape) surface as production bugs.
- Refactors in downstream modules regularly break GraphQL without a fast feedback loop.

We are adopting a structured typing refactor so that MyPy becomes a reliable guardrail instead of being dismissed with `# type: ignore`.

---

## Current Environment Constraints

- **Python runtime:** `python3 --version` reports **3.9.6** in the shared tooling container.  
  - PEP 695 “square bracket” generic syntax (used in `communications.task_service._run_async`) is invalid under 3.9.  
  - Several platform modules still rely on Python 3.8/3.9 semantics (e.g., `BaseHTTPMiddleware` typing).
- **MyPy configuration:** `python_version = "3.13"` in `pyproject.toml`.  
  - We must either (a) align the runner with Python 3.12+, or (b) remove syntax that requires 3.12+ and lower the target version.  
  - For this iteration we will **prefers option (b)**: rewrite PEP 695 constructs to classic `TypeVar` syntax. Adjust the MyPy target in a follow-up once the runtime story is settled.

---

## Refactor Scope

The following modules must be brought under strict typing (no `Any` leaks) before we can enable MyPy for `src/dotmac/platform/graphql` without blanket ignores:

| Area | Files | Risks |
|------|-------|-------|
| GraphQL surface | `src/dotmac/platform/graphql/schema.py`, `types/*.py`, `queries/*.py`, `loaders.py`, `context.py` | Constructors returning `Any`, dataloaders returning untyped dicts/lists, decorators without annotations |
| Shared services pulled in by GraphQL | `communications/task_service.py`, `communications/template_service.py`, `events/models.py`, `notifications/service.py`, `tenant/tenant.py`, `settings.py` | Pydantic `BaseModel` subclasses seen as `Any`, generics using 3.12-only syntax, decorators lacking type hints |
| Downstream dependencies | `orchestration/service.py`, `deployment/service.py`, `customer`/`wireless` query helpers | Queries returning `dict[str, Any]` with unchecked keys, SQLAlchemy scalars treated as `Any` |

> **Note:** The refactor intentionally stops at the GraphQL boundary. Services that remain untyped can expose typed interfaces (protocols/Data Transfer Objects) for GraphQL to consume.

---

## Action Items (Phase 1)

1. **Language Target Alignment**
   - Replace PEP 695 syntax (`def _run_async[T](...)`) with classic `TypeVar` patterns.
   - Lower `python_version` in MyPy to match the runtime (3.9/3.10) *after* the above change, or upgrade the toolchain to 3.12 if/when infra allows.

2. **Documentation & Ownership**
   - Confirm module owners:  
     - GraphQL schema/types/loaders – **Platform GraphQL**  
     - Shared services (notifications, tenant, settings) – **Platform Foundations**  
     - Domain-specific queries (wireless, orchestration) – respective feature teams
   - Capture open questions (e.g., do we invest in upgrading the Python runtime?) in this document before Phase 2 begins.

3. **Tooling**
   - Add a helper script `scripts/run_mypy_graphql.sh` (see below) to standardise local invocations.
   - Ensure CI adopts the same command once the refactor lands.

4. **Backlog Tracking**
   - For every `# type: ignore` added during Phase 2+, create a corresponding ticket (e.g., `tech-debt: remove ignore in notifications/service.py`) so they are not forgotten.

---

## Helper Command

```bash
./scripts/run_mypy_graphql.sh
```

This script runs MyPy against `src/dotmac/platform/graphql` with `--follow-imports=skip` so contributors can see progress without scanning unrelated modules. Once the refactor completes, the option can be tightened.

---

## Next Steps

1. Land Phase 1 (this document + helper script + removal of 3.12-only typing syntax).  
2. Phase 2 will focus on eliminating the “import tsunami” of `Any` coming from shared services, starting with `settings`, `tenant`, and `notifications`.  
3. Continue to update this document as each phase completes.

---

For questions or updates, reach out in `#platform-backend` Slack with the tag `#graphql-typing`.
