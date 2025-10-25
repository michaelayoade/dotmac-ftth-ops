# Frontend Portal Deployment Guide

The workspace now produces dedicated portal bundles while sharing a single
codebase:

- **Base app** (`frontend/apps/base-app`) remains the canonical source for all
  routes and components.
- **ISP Operations app** (`frontend/apps/isp-ops-app`) builds the operational
  console with `NEXT_PUBLIC_PORTAL_TYPE=isp`. Admin-only routes are excluded from
  navigation and hard-blocked by rewrites so they resolve to `/404`.
- **Platform Admin app** (`frontend/apps/platform-admin-app`) builds the
  super-admin console with `NEXT_PUBLIC_PORTAL_TYPE=admin`.

## Environment Variables

Each portal injects `NEXT_PUBLIC_PORTAL_TYPE` via `next.config.mjs`. The helper
at `frontend/apps/base-app/lib/portal.ts` centralises portal logic:

- `getPortalType()` inspects the environment and defaults to `base`.
- `portalAllows()` is used by the dashboard navigation to filter sections.
- `ensurePortalAccess()` is called from layout files to return `404` when a page
  is requested from the wrong portal.

## Routing Guards

Admin-only areas are wrapped with dedicated `layout.tsx` files that call
`ensurePortalAccess(["admin"])`. The ISP build rewrites any requests to those
routes to `/404`, providing a second line of defence even if users bypass the UI.

## Building Portals

```bash
# ISP operations portal
pnpm --filter @dotmac/isp-ops-app build

# Platform admin portal
pnpm --filter @dotmac/platform-admin-app build
```

Development commands (`pnpm dev:isp`, `pnpm dev:admin`) spin up the individual
portals with the correct portal type pre-configured.
