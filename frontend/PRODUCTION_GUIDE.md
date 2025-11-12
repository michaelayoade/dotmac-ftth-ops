# Frontend Production Guide

This document captures everything needed to run the DotMac frontend in production. It replaces the previous scattered architecture/deployment notes.

## 1. Architecture Snapshot

- **Apps**  
  - `apps/isp-ops-app` → Tenant-facing ISP portal (`pnpm dev:isp`, port 3001).  
  - `apps/platform-admin-app` → DotMac control plane (`pnpm dev:admin`, port 3002).
- **Shared packages**  
  - `shared/packages/primitives`, `ui`, `headless`, `graphql`, etc. provide reusable UI, hooks, and data utilities.
- **Key directories**

```
frontend/
├── apps/isp-ops-app
├── apps/platform-admin-app
├── shared/packages/*     # reusable code shipped with both apps
├── e2e/                  # Playwright tests
└── scripts/              # helper scripts (backend, smoke tests, etc.)
```

## 2. Runtime Configuration

Each app has its own `.env.local.example`. Required variables:

| App | File | Important Vars |
|-----|------|----------------|
| ISP Ops | `apps/isp-ops-app/.env.local` | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_TYPE=isp-ops`, `NEXT_PUBLIC_FEATURES=…` |
| Platform Admin | `apps/platform-admin-app/.env.local` | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_TYPE=platform-admin`, `NEXT_PUBLIC_REQUIRE_SUPER_ADMIN=true` |

Set `NEXT_PUBLIC_API_BASE_URL` to the backend ingress (`https://api.dotmac.com` in production). Both apps inherit auth cookies from the Better Auth backend.

## 3. Build, Health & Tests

```bash
cd frontend

# Install deps
pnpm install

# Build both apps (shared packages → ISP → Admin)
pnpm build

# Individual builds
pnpm build:isp
pnpm build:admin

# Type & lint
pnpm type-check
pnpm lint

# Tests
pnpm --filter @dotmac/isp-ops-app test
pnpm --filter @dotmac/platform-admin-app test
pnpm test                 # shared packages
pnpm e2e                  # Playwright suite
```

Treat any new lint/type errors as blockers—CI enforces zero warnings.

## 4. Deployment Overview

### Docker (single tenant/staging)

1. Build per-app images (multi-stage Dockerfiles live under each app).
2. Run each container behind Nginx or Traefik:
   - `ops.dotmac.com` → ISP app container (port 3001).
   - `admin.dotmac.com` → Platform admin app (port 3002, usually restricted to VPN/internal ranges).
3. `NEXT_PUBLIC_API_BASE_URL` should point to the backend ingress inside the same mesh or load balancer.

### Kubernetes (production/multi-tenant)

- Create namespaces: `platform-admin` (single instance) plus `tenant-<id>` namespaces for ISP deployments.
- Build/push images as part of CI and reference them in Helm values:
  ```yaml
  frontend:
    image:
      repository: registry.example.com/dotmac/isp-ops-app
      tag: <git-sha>
    env:
      NEXT_PUBLIC_APP_TYPE: isp-ops
      NEXT_PUBLIC_API_BASE_URL: https://api.dotmac.com
  ```
- Recommended addons per namespace: PostgreSQL, Redis, RADIUS/NetBox/GenieACS (for ISP tenants), Prometheus/Grafana/Loki.
- Network policies should only allow backend/API, observability collectors, and tenant-specific services.

## 5. Authentication

Better Auth powers the session across both apps. Use the exported hooks (`useSession` or the thin `useAuth` wrapper) for any authentication-aware UI.

```ts
import { useSession } from "@dotmac/better-auth";
import { apiClient } from "@dotmac/headless/api";

export function useAuthedApi() {
  const { data: session, isPending } = useSession();
  const token = session?.accessToken;

  return {
    user: session?.user ?? null,
    isLoading: isPending,
    client: apiClient.extend({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      withCredentials: true,
    }),
  };
}
```

## 6. GraphQL & Data Access

All GraphQL work goes through the shared codegen artifacts.

```bash
# Update schema snapshot after backend changes
poetry run python -m strawberry export-schema \
  dotmac.platform.graphql.schema:schema \
  --output frontend/graphql-schema.graphql

# Regenerate hooks/types
pnpm graphql:codegen
```

Usage pattern:

```tsx
import { useNetworkOverviewQuery } from "@dotmac/graphql/generated/react-query";
import { mapQueryResult, QueryBoundary } from "@dotmac/graphql";

export function NetworkDashboard() {
  const result = mapQueryResult(
    useNetworkOverviewQuery(undefined, { refetchInterval: 30_000 })
  );

  return (
    <QueryBoundary result={result}>
      {(data) => <NetworkOverviewTable data={data.networkOverview} />}
    </QueryBoundary>
  );
}
```

Use the mutation helpers from `@dotmac/graphql` (`useMutationWithToast`, `useFormMutation`) for consistent toasts and cache invalidation.

## 7. PWA & Offline Features

- Manifests and service workers already ship in each app’s `public/` folder.
- Offline fallback: `/offline` route in both apps.
- Background sync/geolocation are enabled only in the ISP app (field-service workflows).
- If branding changes, regenerate icons via `frontend/scripts/generate-pwa-icons.mjs` or `pwa-asset-generator`.
- Configure VAPID keys in `.env.local` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) before enabling push notifications.

## 8. Operational Checklist

1. **Build**: `pnpm build` passes.
2. **Tests**: `pnpm type-check`, `pnpm lint`, unit tests, and `pnpm e2e`.
3. **Images**: Push per-app Docker images tagged with the Git SHA.
4. **Helm/Compose**: Update values with the new image tag and ingress URLs.
5. **Smoke Tests**: Hit `/dashboard` for each portal, verify no console errors, and exercise critical workflows (authentication, billing, subscriber search).
6. **Monitoring**: Ensure the frontend metrics/logs feed into the existing Prometheus/Loki stack per tenant.

Keep this guide up to date whenever the production topology or tooling changes. All other frontend documents should reference this file instead of duplicating the information.
