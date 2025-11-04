# Frontend Quick Start

This guide covers the day-to-day workflow for working on the two production frontends:

1. **ISP Operations App** – `apps/isp-ops-app` (`@dotmac/isp-ops-app`)
2. **Platform Admin App** – `apps/platform-admin-app` (`@dotmac/platform-admin-app`)

The legacy `base-app` has been removed; all development happens inside one of the two live apps or the shared packages.

---

## 1. Install Dependencies

```bash
cd frontend
pnpm install
```

> If you hit network issues in sandboxed environments, run `pnpm install --offline` after a successful install on a network-enabled machine.

---

## 2. Running the Stack

### Launch everything (backend + both frontends)

```bash
pnpm dev
```

Services exposed:
- Backend API: `http://localhost:8000`
- ISP Operations App: `http://localhost:3001`
- Platform Admin App: `http://localhost:3002`

### Run an app individually

```bash
# ISP Operations
pnpm dev:isp

# Platform Admin
pnpm dev:admin

# Backend API only
pnpm dev:backend
```

To stop the servers, press `Ctrl+C`. If a port is left in use:

```bash
lsof -ti:3001 | xargs kill -9   # ISP app
lsof -ti:3002 | xargs kill -9   # Admin app
```

---

## 3. Environment Files

Each app has its own `.env.local.example`. Copy and customise as needed:

```bash
cd apps/isp-ops-app
cp .env.local.example .env.local

cd ../platform-admin-app
cp .env.local.example .env.local
```

Common variables include `NEXT_PUBLIC_API_BASE_URL`, `NEXTAUTH_*`, and per-tenant branding values.

---

## 4. Building & Testing

```bash
# Build both apps
pnpm build            # runs shared package builds + build:isp + build:admin

# Build individually
pnpm build:isp
pnpm build:admin

# Type-check everything
pnpm type-check

# Lint everything
pnpm lint
```

Each app also exposes its own scripts (see `apps/*/package.json`) for bundle analysis, Jest, etc. Example:

```bash
cd apps/isp-ops-app
pnpm test
pnpm analyze
```

---

## 5. Playwright End-to-End Tests

- ISP portal & shared scenarios: `frontend/playwright.config.ts`
- Extended suites (mocked backends, contract validation): `frontend/e2e/playwright.config.ts`

Run them from the `frontend` directory after starting the services:

```bash
pnpm --filter @dotmac/e2e-tests test
pnpm playwright test          # ISP-focused config
```

If MSW handlers change, update `shared/mocks/handlers.ts`.

---

## 6. Workspace Layout Reference

```
frontend/
├── apps/
│   ├── isp-ops-app/          # Tenant-facing portal
│   └── platform-admin-app/   # Platform control plane
├── shared/
│   └── packages/             # Shared primitives, headless hooks, auth, etc.
├── e2e/                      # Playwright config & tests
├── ARCHITECTURE_OVERVIEW.md  # Current architecture summary
├── PRODUCTION_DEPLOYMENT_K8S.md
└── QUICK_START.md            # This document
```

---

## 7. Working Guidelines

- **Pick the right app.** ISP features go in `isp-ops-app`; platform-wide features live in `platform-admin-app`. Duplicate simple components before introducing cross-app dependencies.
- **Update navigation.** Sidebar items live in each app’s `app/dashboard/layout.tsx`.
- **Keep shared code generic.** Only move logic to `shared/packages` when both apps consume it.
- **Verify lint/tests.** Run `pnpm lint`, `pnpm type-check`, and relevant Playwright suites before submitting PRs.
- **Docs first.** Architecture changes should be reflected in `ARCHITECTURE_OVERVIEW.md` and this quick-start guide to keep downstream teams aligned.

With this split, each portal can evolve independently while sharing a common design system and tooling. Happy shipping!
