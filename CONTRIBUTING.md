# Contributing to DotMac Platform Services

Thanks for contributing! This guide explains expectations for code quality, testing, and security.

## Coverage Requirements

We enforce high coverage to maintain confidence. Pull requests must meet these thresholds:

- Line coverage: 90% (required)
- Branch coverage: 85% (required)

Reports
- Terminal summary: term-missing (what and where is missing)
- HTML report: `htmlcov/` artifact on CI
- XML report: `coverage.xml` (for CI checks)

Exclusions (already configured)
- Test files under `tests/`
- Generated, cache, example, and script directories
- `__init__.py` files

## Testing Guidelines

General
- Prefer small, focused unit tests with clear assertions.
- Use `pytest` fixtures in `tests/conftest.py` for DB/Redis/Vault/JWT and FastAPI client.
- Mark long-running or I/O heavy tests with `@pytest.mark.slow`.
- Use integration markers only for tests requiring real services.

Security-focused testing
- AuthN/Z: Validate token creation/verification, audience/issuer checks, and rejection of expired/invalid signatures.
- RBAC: Positive and negative permission checks; policy evaluation for mismatches.
- Secrets: Missing/invalid secret handling, provider health checks, and production guards.
- Observability: Ensure no sensitive data leaks to logs/metrics; route sensitivity patterns enforced.

Examples
- Auth (JWT)
  ```python
  def test_jwt_access_token_valid(jwt_service, test_user):
      token = jwt_service.create_access_token(
          subject=test_user["id"], claims={"roles": ["user"]}
      )
      decoded = jwt_service.decode_token(token)
      assert decoded["sub"] == test_user["id"]
  ```

- Secrets (Env provider)
  ```python
  @pytest.mark.asyncio
  async def test_env_database_url_provider(monkeypatch):
      from dotmac.platform.secrets.providers.env import EnvironmentProvider
      monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@h:5432/db")
      secret = await EnvironmentProvider().get_secret("databases/db")
      assert secret["database"] == "db"
  ```

- Observability
  ```python
  def test_observability_manager_smoke():
      from dotmac.platform.observability import ObservabilityManager
      mgr = ObservabilityManager("svc", environment="test")
      mgr.initialize()
      assert mgr.get_logger() is not None
      mgr.shutdown()
  ```

## Running Tests

- Fast unit tests: `make test-fast`
- Full suite with coverage: `make test`
- Integration (Docker required): `./scripts/run_integration_tests.sh`
- Customer workflow smoke tests: `./scripts/run_customer_tests.sh`
- Frontend Playwright E2E: `pnpm --filter @dotmac/base-app test:e2e`

## Mutation Testing

We use `mutmut` to spot weak tests for auth and secrets modules.

- Local run: `mutmut run`
- CI run: include `[mutation]` in your commit message or PR title/body.

Configuration lives in `pyproject.toml` under `[tool.mutmut]`.

## PR Checklist

- [ ] Tests added or updated; all tests pass locally
- [ ] Meets coverage thresholds (90% lines, 85% branches)
- [ ] No secrets in code, logs, or tests
- [ ] Security-sensitive paths validated (auth/roles/secrets)
- [ ] Docs updated (README/CONTRIBUTING if needed)
- [ ] Minimal surface-area change; backwards-compatible when applicable

## Architecture Guidelines

- Keep modules cohesive: auth, secrets, observability, tenant, database, tasks.
- Prefer pure functions and clear boundaries; inject external/service dependencies.
- Reuse fixtures and helpers; avoid duplicate setup logic in tests.
- Guard optional integrations with import-time fallbacks and `pragma: no cover` for true import guards.

## Reporting Vulnerabilities

Please disclose security issues responsibly by contacting the maintainers.
