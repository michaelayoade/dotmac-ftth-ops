# Frontend Architecture

## Overview

The DotMac frontend is split into 6 independent applications, organized by user type and API boundary:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM TIER                                      │
│                    (*.platform.dotmac.io)                                   │
│                                                                             │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │  platform-admin  │ │platform-reseller │ │ platform-tenant  │            │
│  │     (3002)       │ │     (3004)       │ │     (3003)       │            │
│  │                  │ │                  │ │                  │            │
│  │  DotMac Staff    │ │ Channel Partners │ │   ISP Owners     │            │
│  │  admin.platform  │ │partners.platform │ │  my.platform     │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
│                                                                             │
│                        /api/platform/v1/*                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             ISP TIER                                         │
│                    (*.{tenant}.dotmac.io)                                   │
│                                                                             │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │   isp-ops-app    │ │   isp-reseller   │ │   isp-customer   │            │
│  │     (3001)       │ │     (3005)       │ │     (3006)       │            │
│  │                  │ │                  │ │                  │            │
│  │  ISP Admins      │ │  Sales Agents    │ │  End Customers   │            │
│  │  app.{tenant}    │ │ agents.{tenant}  │ │   my.{tenant}    │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
│                                                                             │
│                          /api/isp/v1/*                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Applications

### Platform Tier

| App | Port | Subdomain | User Type | Description |
|-----|------|-----------|-----------|-------------|
| platform-admin-app | 3002 | admin.platform.dotmac.io | DotMac Staff | Platform administration, tenant management, billing |
| platform-reseller | 3004 | partners.platform.dotmac.io | Channel Partners | Partner portal for ISP referrals and commissions |
| platform-tenant | 3003 | my.platform.dotmac.io | ISP Owners | Tenant self-service for subscription management |

### ISP Tier

| App | Port | Subdomain | User Type | Description |
|-----|------|-----------|-----------|-------------|
| isp-ops-app | 3001 | app.{tenant}.dotmac.io | ISP Administrators | Full ISP operations dashboard |
| isp-reseller | 3005 | agents.{tenant}.dotmac.io | Sales Agents | Sales agent portal for commissions |
| isp-customer | 3006 | my.{tenant}.dotmac.io | End Customers | Customer self-service portal |

## Authentication

Each application has **completely isolated authentication**:

- Separate JWT issuers per app
- Unique cookie names per app
- Independent token storage
- No SSO between applications

### Token Storage Keys

| App | Access Token Key | Refresh Token Key |
|-----|------------------|-------------------|
| platform-admin | `platform_admin_access_token` | `platform_admin_refresh_token` |
| platform-reseller | `platform_partner_access_token` | `platform_partner_refresh_token` |
| platform-tenant | `tenant_access_token` | `tenant_refresh_token` |
| isp-ops-app | `isp_access_token` | `isp_refresh_token` |
| isp-reseller | `isp_reseller_access_token` | `isp_reseller_refresh_token` |
| isp-customer | `isp_customer_access_token` | `isp_customer_refresh_token` |

## Directory Structure

```
frontend/
├── apps/
│   ├── isp-customer/           # Port 3006
│   │   ├── app/
│   │   │   ├── login/
│   │   │   └── portal/
│   │   │       ├── billing/
│   │   │       ├── usage/
│   │   │       ├── service/
│   │   │       ├── settings/
│   │   │       └── support/
│   │   ├── hooks/
│   │   ├── lib/auth/
│   │   └── providers/
│   │
│   ├── isp-reseller/           # Port 3005
│   │   ├── app/
│   │   │   ├── login/
│   │   │   └── portal/
│   │   │       ├── customers/
│   │   │       ├── commissions/
│   │   │       ├── referrals/
│   │   │       └── settings/
│   │   ├── hooks/
│   │   ├── lib/auth/
│   │   └── providers/
│   │
│   ├── platform-tenant/        # Port 3003
│   │   ├── app/
│   │   │   ├── login/
│   │   │   └── portal/
│   │   │       ├── billing/
│   │   │       ├── usage/
│   │   │       ├── users/
│   │   │       ├── support/
│   │   │       └── settings/
│   │   ├── hooks/
│   │   ├── lib/auth/
│   │   └── providers/
│   │
│   ├── platform-reseller/      # Port 3004
│   │   ├── app/
│   │   │   ├── login/
│   │   │   └── portal/
│   │   │       ├── tenants/
│   │   │       ├── referrals/
│   │   │       ├── commissions/
│   │   │       ├── statements/
│   │   │       └── settings/
│   │   ├── hooks/
│   │   ├── lib/auth/
│   │   └── providers/
│   │
│   ├── isp-ops-app/            # Port 3001 (existing)
│   └── platform-admin-app/     # Port 3002 (existing)
│
└── shared/
    └── packages/
        ├── ui/                  # UI components
        ├── primitives/          # Base primitives
        ├── providers/           # Shared providers
        ├── rbac/               # RBAC utilities
        ├── http-client/        # API client
        ├── graphql/            # GraphQL client
        └── icons/              # Icon library
```

## Development

### Running Individual Apps

```bash
# Platform tier
pnpm dev:admin              # platform-admin-app on 3002
pnpm dev:platform-reseller  # platform-reseller on 3004
pnpm dev:tenant             # platform-tenant on 3003

# ISP tier
pnpm dev:isp                # isp-ops-app on 3001
pnpm dev:reseller           # isp-reseller on 3005
pnpm dev:customer           # isp-customer on 3006
```

### Building Apps

```bash
pnpm build:admin
pnpm build:platform-reseller
pnpm build:tenant
pnpm build:isp
pnpm build:reseller
pnpm build:customer
```

### Type Checking

```bash
pnpm type-check  # All apps
```

## Deployment

### Docker

Each app has its own Dockerfile for standalone deployment:

```bash
# Build all apps
docker-compose -f deploy/docker-compose.frontend.yml build

# Run all apps
docker-compose -f deploy/docker-compose.frontend.yml up -d
```

### URL Routing

Nginx routes requests based on subdomain:

```
Platform Tier:
  admin.platform.dotmac.io     → platform-admin-app:3002
  partners.platform.dotmac.io  → platform-reseller:3004
  my.platform.dotmac.io        → platform-tenant:3003

ISP Tier (per-tenant):
  app.acme-isp.dotmac.io       → isp-ops-app:3001 (X-Tenant-Slug: acme-isp)
  agents.acme-isp.dotmac.io    → isp-reseller:3005 (X-Tenant-Slug: acme-isp)
  my.acme-isp.dotmac.io        → isp-customer:3006 (X-Tenant-Slug: acme-isp)
```

## Repository Separation (Optional)

For larger teams, apps can be extracted to separate repositories with shared packages as Git submodules:

```bash
# Extract all repos
./scripts/extract-frontend-repos.sh /path/to/output

# Results in:
#   dotmac-shared-packages/  (shared UI, primitives, etc.)
#   dotmac-isp-customer/
#   dotmac-isp-reseller/
#   dotmac-platform-tenant/
#   dotmac-platform-reseller/
#   dotmac-isp-ops/
#   dotmac-platform-admin/
```

Each extracted app uses the shared packages as a Git submodule:

```bash
git clone --recurse-submodules git@github.com:dotmac/dotmac-isp-customer.git
```

## API Boundaries

### Platform API (`/api/platform/v1/`)

Used by platform-tier apps:
- `/auth/admin/*` - Platform admin auth
- `/auth/partner/*` - Channel partner auth
- `/auth/tenant/*` - Tenant owner auth
- `/tenants/*` - Tenant management
- `/partners/*` - Partner management
- `/billing/tenant/*` - Tenant billing

### ISP API (`/api/isp/v1/`)

Used by ISP-tier apps:
- `/auth/*` - ISP user auth
- `/auth/reseller/*` - Sales agent auth
- `/auth/customer/*` - Customer auth
- `/subscribers/*` - Subscriber management
- `/billing/*` - ISP billing
- `/commissions/*` - Reseller commissions

## Shared Packages

| Package | Description |
|---------|-------------|
| @dotmac/ui | High-level UI components (Card, Dialog, etc.) |
| @dotmac/primitives | Base primitives (Button, Input, etc.) |
| @dotmac/providers | Shared React providers |
| @dotmac/rbac | Role-based access control utilities |
| @dotmac/http-client | API client with auth interceptors |
| @dotmac/graphql | GraphQL client and generated types |
| @dotmac/icons | Icon library |
