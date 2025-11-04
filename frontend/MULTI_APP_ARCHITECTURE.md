# Multi-App Architecture – Current State

## Overview

The frontend platform now operates with **two production-grade Next.js applications** sharing a curated set of packages:

| App | Package name | Port (dev) | Purpose |
|-----|--------------|------------|---------|
| `apps/isp-ops-app` | `@dotmac/isp-ops-app` | 3001 | Tenant-facing operations portal |
| `apps/platform-admin-app` | `@dotmac/platform-admin-app` | 3002 | DotMac platform control plane |

The legacy `base-app` has been removed. All functionality previously hosted there now lives in one of the two apps or inside `shared/packages/*`.

---

## Security & Ownership Guarantees

- **Separation of concerns:** ISP bundles contain only tenant features; platform-admin bundles contain the control-plane tooling.
- **Smaller attack surface:** Platform-only routes (feature flags, licensing, plugins, jobs, orchestration) never ship to tenant browsers.
- **Per-tenant isolation:** Customer portal and ISP dashboards are deployed alongside per-tenant backend services.
- **Shared code discipline:** Cross-app code is limited to generic primitives, providers, and auth helpers located in shared packages.

---

## Directory Structure (abridged)

```
frontend/
├── apps/
│   ├── isp-ops-app/
│   │   ├── app/
│   │   │   ├── dashboard/            # ISP feature areas
│   │   │   ├── customer-portal/      # Subscriber self-service portal
│   │   │   ├── login/, layout.tsx    # ISP-specific shell
│   │   │   └── page.tsx
│   │   ├── components/, hooks/, lib/ # ISP domain logic
│   │   ├── next.config.mjs, tsconfig.json, package.json
│   │   └── .env.local.example
│   │
│   └── platform-admin-app/
│       ├── app/
│       │   ├── dashboard/            # Platform control plane features
│       │   ├── tenant-portal/        # ISP account management portal
│       │   ├── login/, layout.tsx    # Admin shell
│       │   └── page.tsx
│       ├── components/, hooks/, lib/
│       ├── next.config.mjs, tsconfig.json, package.json
│       └── .env.local.example
│
├── shared/
│   └── packages/
│       ├── primitives/               # UI primitives (Shadcn-based)
│       ├── headless/                 # Hooks and data utilities
│       ├── ui/                       # Composite UI components
│       ├── design-system/            # Theming + tokens
│       ├── auth/                     # Auth provider variants
│       ├── providers/                # React context providers
│       ├── http-client/              # Generated API clients
│       └── rbac/                     # Permission utilities
│
├── e2e/                              # Playwright tests (shared + ISP-specific)
├── ARCHITECTURE_OVERVIEW.md
├── PRODUCTION_DEPLOYMENT_K8S.md
└── QUICK_START.md
```

---

## App-by-App Highlights

### ISP Operations App

- Subscriber management, CRM, ticketing, communications
- Service orchestration, automation, workflows
- Network operations: RADIUS, Wi-Fi, PON, IPAM, DCIM, device inventory
- Tenant billing and banking flows
- Customer portal (`/customer-portal/*`) for subscriber self-service
- Domain-specific providers (e.g., real-time monitoring, OSS integrations)

### Platform Admin App

- Tenant lifecycle (create/suspend/delete ISPs)
- Licensing, feature flags, plugin management
- Cross-tenant observability, search, audit logging
- Platform billing/revenue, banking, data transfer
- Tenant portal (`/tenant-portal/*`) for ISPs to manage their DotMac subscription
- Integrations, jobs, webhooks, security/access controls

Both apps leverage the same shared design system and auth primitives but do **not** share route-level code.

---

## Key Workflows After the Split

1. **Navigation updates:** edit the relevant dashboard layout  
   - ISP: `apps/isp-ops-app/app/dashboard/layout.tsx`  
   - Admin: `apps/platform-admin-app/app/dashboard/layout.tsx`

2. **Portal updates:** change routes inside the owning app  
   - Tenant portal: `apps/platform-admin-app/app/tenant-portal/*`  
   - Customer portal: `apps/isp-ops-app/app/customer-portal/*`

3. **Shared logic:** create or extend modules inside `shared/packages`. Keep exports framework-agnostic when possible.

4. **MSW & tests:** MSW handlers live in `shared/mocks/handlers.ts`; Playwright configs target the ISP app (`frontend/playwright.config.ts`) and shared scenarios (`frontend/e2e/playwright.config.ts`).

5. **Deployment:** Dockerfiles live under each app (`apps/*/Dockerfile`). Kubernetes Helm templates (see Phase 3.5/3.6 in `PRODUCTION_DEPLOYMENT_K8S.md`) build individual images per app and deploy collectors per tenant.

---

## FAQ

**Q: Where did base-app go?**  
A: It was fully removed after all references were replaced. Scripts, docs, and tooling now point to the two live apps. The history remains in Git if you need to consult it.

**Q: How do we add a new portal (e.g., reseller dashboard)?**  
A: Create a new app under `apps/`, wire it into `package.json`, and follow the same separation principles. Update `ARCHITECTURE_OVERVIEW.md` once the portal ships.

**Q: Do both apps still need MSW mocks, auth providers, etc.?**  
A: Yes, but shared logic now lives in `shared/packages`. Each app imports what it needs without re-exporting.

**Q: Which doc explains observability collectors / network policies?**  
A: See “Phase 3.5” and “Phase 3.6” in `frontend/PRODUCTION_DEPLOYMENT_K8S.md` for the per-tenant Prometheus/Loki stack and allow-list network policies.

---

## Next Steps & Maintenance

- Keep this document and `ARCHITECTURE_OVERVIEW.md` in sync whenever new domains or portals are added.
- Review shared packages periodically; promote code only when both apps truly rely on it.
- Ensure the Playwright suites cover cross-app flows (tenant provisioning, customer billing) after major changes.
- Continue hardening lint rules (e.g., treat `react-hooks/exhaustive-deps` as errors) to prevent regressions.

The split architecture now reflects reality; the focus moves to iterating safely within the two dedicated portals while sharing the minimal primitives needed by both.
