# E2E Tests – Quick Start

Use this guide to run the Playwright suites that validate the ISP operations portal. Everything lives inside the `frontend` workspace and relies on the same backend services you use for local development.

## 1. Start the stack

From the repository root:

```bash
make dev            # starts infrastructure, backend API, and both portals
```

If you only need the backend running, use `pnpm dev:backend` from the `frontend` directory.

## 2. Install Playwright dependencies

```bash
cd frontend
pnpm install
npx playwright install --with-deps
```

## 3. Run the suites

```bash
# Entire ISP portal suite (frontend/playwright.config.ts)
pnpm playwright test

# Headed / debug helpers
pnpm playwright test --headed
pnpm playwright test --ui

# Target a spec or test title
pnpm playwright test e2e/tenant-portal.spec.ts
pnpm playwright test e2e/tenant-portal.spec.ts -g "shows main page structure"
```

## 4. Test data

Default seed credentials:

- Username: `superadmin`
- Password: `admin123`

If authentication fails, rerun `make db-seed` from the repo root.

## Troubleshooting

- Verify the API is reachable at `http://localhost:8000` before launching Playwright.
- When health checks hang, confirm the infrastructure containers are up (`make status-all`).
- To wipe state quickly, use `./scripts/infra.sh platform restart` and `./scripts/infra.sh isp restart`.
