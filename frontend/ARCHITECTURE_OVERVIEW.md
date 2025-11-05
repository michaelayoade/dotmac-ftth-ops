# Frontend Architecture Overview

## Executive Summary

The frontend stack now consists of **two production Next.js applications plus shared packages**:

- **`apps/platform-admin-app`** (`@dotmac/platform-admin-app`) – the single-tenant control plane for DotMac operators.
- **`apps/isp-ops-app`** (`@dotmac/isp-ops-app`) – the tenant-specific ISP operations portal that is deployed per customer.
- **`shared/packages/*`** – re-usable UI primitives, headless logic, authentication helpers, and cross-app utilities.

The legacy `base-app` has been fully removed. Each live application owns its layouts, routes, authentication, and branding concerns. Shared code is restricted to truly generic packages to avoid cross-domain coupling.

Benefits delivered:

1. **Security isolation** – ISP bundles no longer ship platform-admin features or credentials.
2. **Clear ownership** – Each feature area now resides in exactly one app.
3. **Operational simplicity** – Container builds, Docker Compose, and the Kubernetes playbooks target only the two live apps.
4. **Smaller bundles** – ISP portal bundle size dropped by ~50% versus the monolith.

For deployment, observability, and CI/CD guidance, see:
- `frontend/PRODUCTION_DEPLOYMENT_K8S.md`
- `frontend/.eslintrc-warnings-guide.md`
- `docs/OBSERVABILITY/` (includes Phase 3.6 collectors template)

---

## Application Responsibilities

### Platform Admin (`apps/platform-admin-app`)

**Audience:** DotMac platform engineering, support, and finance teams.  
**Key domains:**
- Tenant lifecycle (create/suspend/delete ISPs)
- Licensing, feature flags, plugin catalogue
- Cross-tenant analytics, search, audit, and observability
- Billing ISPs (platform-level invoicing, banking, revenue)
- Tenant portal so ISPs can manage their platform subscription (`app/tenant-portal/*`)
- Global configuration: integrations, security-access, jobs, webhooks

**Not present:** Subscriber CRUD, network provisioning, ISP-specific RADIUS/Wi-Fi management.

### ISP Operations (`apps/isp-ops-app`)

**Audience:** Individual ISP staff and NOC operators.  
**Key domains:**
- Subscriber management, CRM, ticketing, communications
- Service orchestration, automation workflows, network monitoring
- RADIUS, Wi-Fi, PON, IPAM, DCIM, device management
- Tenant billing (customer invoicing, payments, banking flows)
- Customer self-service portal (`app/customer-portal/*`)

**Not present:** Platform-wide features such as licensing, plugin registry, global audit logs.

---

## Portal & Page Ownership

| Feature / Portal                      | Location                                              |
|--------------------------------------|-------------------------------------------------------|
| Platform admin dashboard              | `apps/platform-admin-app/app/dashboard/*`             |
| Tenant portal for ISP platform billing| `apps/platform-admin-app/app/tenant-portal/*`         |
| ISP operations dashboard              | `apps/isp-ops-app/app/dashboard/*`                    |
| Subscriber self-service (customer)    | `apps/isp-ops-app/app/customer-portal/*`              |
| Shared auth flows (login, MFA)        | Duplicated per app (no longer re-exported)            |
| Shared primitives & layout building blocks | `shared/packages/primitives`, `shared/packages/headless`, `shared/packages/ui`, etc. |

Both applications now own their own `layout.tsx`, `login/page.tsx`, and route trees; there are no re-exports from a third location. When a concern spans both apps (e.g., toast styling, auth hooks), the implementation lives in shared packages.

### Portal Detection & Guards

- `frontend/apps/isp-ops-app/lib/portal.ts` (and the matching admin file) exposes `getPortalType()` and `portalAllows()` for client-side checks driven by the current pathname.
- `frontend/apps/isp-ops-app/lib/design-system/tokens/colors.ts` defines the route prefixes used for detection alongside portal-specific theming tokens.
- Sensitive admin-only routes are excluded from the ISP build via rewrites in `frontend/apps/isp-ops-app/next.config.mjs`; the platform-admin config mirrors the approach for its own protected areas.
- Navigation layouts in `apps/*/app/dashboard/layout.tsx` filter sections with `portalAllows(...)`, ensuring links stay in scope for the current portal.

---

## Shared Packages

```
shared/packages/
├── @dotmac/primitives      # Shadcn-based UI primitives and theming helpers
├── @dotmac/headless        # Data fetching hooks, table utilities, accessibility helpers
├── @dotmac/ui              # Composite components (tables, cards, charts wrappers)
├── @dotmac/design-system   # Branding, typography, token pipeline
├── @dotmac/auth            # Authentication helpers and AuthProvider variants
├── @dotmac/providers       # Client-side context providers (RBAC, feature flags, etc.)
├── @dotmac/http-client     # Generated API clients & fetch wrappers
└── @dotmac/rbac            # Role/permission utilities (used by both apps)
```

Guidelines:
- Only add code here when it must be shared by both apps (or future portals).
- UI that depends on the business domain should remain inside the owning app.
- Version shared packages carefully; they ship with both apps and are tested via `pnpm -r --filter ./shared/packages/** run build`.

---

## Cross-App Guidelines

1. **Keep responsibilities separate.** When you add or move a feature, choose the app that owns the business workflow. If functionality is needed by both domains, consider duplication before introducing coupling.
2. **Entrypoints per app.** Each app maintains its own `next.config.mjs`, `tsconfig.json`, and environment template. Never rely on a sibling `app` directory.
3. **Navigation updates.** The sidebars are now curated for each context; make changes in `apps/*/app/dashboard/layout.tsx` and ensure the sections list stays domain-specific.
4. **Tenant portals.** The tenant portal (ISP account management) is part of the platform-admin app under `/tenant-portal/*`. The customer portal stays in the ISP app under `/customer-portal/*`.
5. **Testing & linting.** Run `pnpm lint`, `pnpm type-check`, and the Playwright suites (`frontend/playwright.config.ts` for ISP, `frontend/e2e/...` for cross-system tests) before shipping multi-app changes.

---

## Observability & Deployment Alignment

- **Phase 3.6 Observability Collectors** introduces per-tenant Prometheus/Loki/Fluent Bit templates alongside network policies. Refer to the new section in `frontend/PRODUCTION_DEPLOYMENT_K8S.md`.
- Docker Compose and Kubernetes manifests now build from `apps/platform-admin-app` and `apps/isp-ops-app` Dockerfiles only; there is no `base-app` target.
- GitHub Actions/CI should invoke `pnpm build:admin` and `pnpm build:isp` (or the per-app Docker workflows) to keep pipelines aligned with the live apps.

---

## Migration Recap (for posterity)

- Extracted ISP-specific dashboards, banking flows, and portals into `apps/isp-ops-app`.
- Copied and customised the shared layouts and login screens; removed all re-export stubs.
- Introduced `app/tenant-portal/*` within the platform-admin app and rewired navigation to `/tenant-portal/...`.
- Deleted `apps/base-app` after replacing every dependency and updating tools, scripts, and docs.
- Moved MSW mocks to `shared/mocks/` and reconfigured Playwright to target the ISP app.
- Cleaned up lint warnings and replaced legacy `<img>` tags with `next/image`.

This document should be kept up to date as new portals (e.g., partner/reseller dashboards) are introduced. If you extend the architecture, capture ownership decisions here so downstream teams remain aligned.
