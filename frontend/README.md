
# DotMac Frontend Workspace

This directory hosts the two production Next.js apps and shared packages that make up the DotMac frontend. Use this guide to get the apps running locally and find deeper documentation.

## Quick Start

```bash
cd frontend
pnpm install

# ISP Operations app
pnpm dev:isp            # http://localhost:3001

# Platform Admin app
pnpm dev:admin          # http://localhost:3002

# Build everything
pnpm build
```

## Key References

- [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md) – architecture, deployment, auth, and runtime checklist
- [QUICK_START.md](./QUICK_START.md) – day-to-day developer workflow
- [e2e/README.md](./e2e/README.md) – Playwright end-to-end testing guide

## Workspace Layout

```
frontend/
├── apps/
│   ├── isp-ops-app/         # tenant-facing Next.js app
│   └── platform-admin-app/  # platform administration app
├── shared/
│   └── packages/            # reusable UI, headless logic, primitives
├── e2e/                     # Playwright tests and reports
└── docs & helpers           # architecture and deployment guides
```

## Development Tips

- Start the FastAPI backend via `make dev` (Docker) before launching any frontend `pnpm dev:*` task.
- Configure `NEXT_PUBLIC_API_BASE_URL` for each app if the backend runs outside Docker (e.g. `make dev-host`).
- Use the per-app `package.json` scripts (e.g. `pnpm --filter @dotmac/isp-ops-app test`) for targeted testing.
- Shared implementation notes live in `docs/` and `shared/`.
- Keep `pnpm install` scoped to the workspace root; individual worktrees require their own `node_modules`.

## Testing

- **Unit tests:** `pnpm --filter @dotmac/isp-ops-app test` and `pnpm --filter @dotmac/platform-admin-app test` run the Next/Jest suites with the consolidated `jest.config.ts`.
- **Shared package tests:** run `pnpm --filter ./shared/packages/* test` to execute Jest suites inside the shared packages (http-client, graphql, providers, etc.).
- **E2E tests:** `pnpm e2e` executes the Playwright suite defined in `playwright.config.ts`. Use `pnpm e2e -- e2e/tests/workflows/complete-workflows.spec.ts` for a specific spec or `pnpm e2e:headed` to watch the browser.
- **Smoke/workflow shortcuts:** the `test:auto*` scripts now proxy to Playwright (no more Puppeteer harness); see `package.json` for the available targets.
