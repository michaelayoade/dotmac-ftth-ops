# E2E Tests - Quick Start

End-to-end coverage for the tenant billing and operations flows lives in the `@dotmac/isp-ops-app` workspace (with shared mocks in `frontend/shared`). Follow these steps to run the Playwright suites locally.

## Prerequisites

1. **Infrastructure**
   ```bash
   make start-platform          # platform backend + admin UI
   make start-isp               # ISP backend + operations UI
   ```
2. **Backend**
 ```bash
 poetry install --with dev
 poetry run alembic upgrade head
  make dev                               # or docker compose -f docker-compose.base.yml up platform-backend
 ```
3. **Seed data (optional but recommended)**
   ```bash
   make db-seed
   ```

## Run All E2E Tests

```bash
cd frontend
pnpm --filter @dotmac/isp-ops-app test:e2e
```

## Targeted Runs

```bash
# Specific spec
pnpm --filter @dotmac/isp-ops-app exec \
  playwright test e2e/tenant-portal.spec.ts

# Focus on a test title
pnpm --filter @dotmac/isp-ops-app exec \
  playwright test e2e/tenant-portal.spec.ts \
  -g "shows main page structure"

# Interactive UI mode
pnpm --filter @dotmac/isp-ops-app exec playwright test --ui

# Headed browser
pnpm --filter @dotmac/isp-ops-app exec playwright test --headed
```

## Manual Setup Workflow

```bash
# Backend (from repository root)
docker compose -f docker-compose.base.yml up platform-backend

# Frontend base app (separate terminal)
cd frontend/apps/base-app
pnpm install
pnpm dev &

# Execute focused tests
pnpm test:e2e tenant-portal.spec.ts
```

Stop background servers with `Ctrl+C` when finished.

> Prefer running the API directly on your machine? Use `make dev-host`, but update the observability
> URLs (or disable OTEL) so health checks do not fail while Playwright waits.

## Test Credentials

- **Username:** `superadmin`
- **Password:** `admin123`

These are created by the default seed data. If authentication fails, re-run `make db-seed` or update the user manually via psql.

## Troubleshooting

- **Playwright times out**  
  Increase timeout in `frontend/apps/base-app/playwright.config.ts` or disable mobile browsers before rerunning.

- **No data appears in UI**  
  Ensure the backend is running on `http://localhost:8000`, `make db-seed` has been executed, and the E2E app is pointing to the correct API via `NEXT_PUBLIC_API_BASE_URL`.

- **Infrastructure not running**  
  ```bash
  make status-platform
  make status-isp
  ```

- **Need to clean state quickly**  
  Use `./scripts/infra.sh platform restart` and `./scripts/infra.sh isp restart` to bounce containers.

## Additional Resources

- Frontend multi-app overview: `frontend/MULTI_APP_ARCHITECTURE.md`
- Infrastructure quick reference: `README-INFRASTRUCTURE.md`
- Platform documentation index: `docs/INDEX.md`
