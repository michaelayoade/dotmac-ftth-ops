
# DotMac Frontend Workspace

This directory hosts the three Next.js apps and shared packages that make up the DotMac frontend. Use this guide to get the apps running locally and find deeper documentation.

## Quick Start

```bash
cd frontend
pnpm install

# ISP Operations app
pnpm dev:isp            # http://localhost:3001

# Platform Admin app
pnpm dev:admin          # http://localhost:3002

# Legacy base app (optional)
pnpm dev:base-app       # http://localhost:3000

# Build everything
pnpm build
```

## Key References

- [MULTI-APP-ARCHITECTURE.md](./MULTI-APP-ARCHITECTURE.md) – app separation and shared packages
- [QUICK-START-MULTI-APP.md](./QUICK-START-MULTI-APP.md) – developer onboarding workflow
- [DEPLOYMENT-ARCHITECTURE.md](./DEPLOYMENT-ARCHITECTURE.md) – staging/production hosting patterns
- [apps/base-app/README.md](./apps/base-app/README.md) – base app specifics and scripts
- [e2e/README.md](./e2e/README.md) – Playwright end-to-end testing guide

## Workspace Layout

```
frontend/
├── apps/
│   ├── isp-ops-app/         # tenant-facing Next.js app
│   ├── platform-admin-app/  # platform administration app
│   └── base-app/            # legacy/compat app plus docs & examples
├── shared/
│   └── packages/            # reusable UI, headless logic, primitives
├── e2e/                     # Playwright tests and reports
└── docs & helpers           # architecture and deployment guides
```

## Development Tips

- Configure `NEXT_PUBLIC_API_BASE_URL` for each app if the backend runs on a non-default host.
- Use the per-app `package.json` scripts (e.g. `pnpm --filter @dotmac/isp-ops-app test`) for targeted testing.
- Refer to `apps/base-app/DEVELOPMENT_GUIDE.md` for logging/error-handling patterns shared across apps.
- Keep `pnpm install` scoped to the workspace root; individual worktrees require their own `node_modules`.
