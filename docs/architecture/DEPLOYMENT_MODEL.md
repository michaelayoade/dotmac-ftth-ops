# DotMac Platform - Deployment Model

**Last Updated:** November 9, 2025
**Status:** Production
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Control Plane vs Tenant Deployments](#control-plane-vs-tenant-deployments)
3. [Application Purposes](#application-purposes)
4. [Deployment Topology](#deployment-topology)
5. [Shared Packages Strategy](#shared-packages-strategy)
6. [Scaling Model](#scaling-model)
7. [Resource Isolation](#resource-isolation)
8. [Benefits of This Architecture](#benefits-of-this-architecture)
9. [Configuration Management](#configuration-management)
10. [Application Comparison](#application-comparison)
11. [Real-World Deployment Scenarios](#real-world-deployment-scenarios)
12. [Why Not a Single App?](#why-not-a-single-app)

---

## Overview

DotMac FTTH Operations Platform uses a **multi-app deployment architecture** with two distinct Next.js applications serving different audiences and deployment patterns:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DotMac Platform Ecosystem                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         CONTROL PLANE (Single Instance)                │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  platform-admin-app (Next.js)                │     │    │
│  │  │  - Platform administration                   │     │    │
│  │  │  - Tenant management                         │     │    │
│  │  │  - Licensing & feature flags                 │     │    │
│  │  │  - Tenant self-service portal                │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │                                                        │    │
│  │  Deployment: admin.dotmac.com                         │    │
│  │  Users: DotMac admins + ISP tenant admins             │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │      TENANT NAMESPACES (Per-Tenant Deployments)        │    │
│  │                                                        │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  Tenant: fast-fiber-isp                      │     │    │
│  │  │  ┌────────────────────────────────────────┐  │     │    │
│  │  │  │  isp-ops-app (Next.js)                 │  │     │    │
│  │  │  │  - Subscriber management               │  │     │    │
│  │  │  │  - Network operations                  │  │     │    │
│  │  │  │  - Billing & payments                  │  │     │    │
│  │  │  │  - Customer self-service portal        │  │     │    │
│  │  │  └────────────────────────────────────────┘  │     │    │
│  │  │  Deployment: fastfiber.isp.dotmac.com       │     │    │
│  │  │  Users: Fast Fiber ISP staff + customers    │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │                                                        │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  Tenant: citynet-broadband                   │     │    │
│  │  │  ┌────────────────────────────────────────┐  │     │    │
│  │  │  │  isp-ops-app (Next.js)                 │  │     │    │
│  │  │  └────────────────────────────────────────┘  │     │    │
│  │  │  Deployment: citynet.isp.dotmac.com          │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │                                                        │    │
│  │  ... (Additional tenant instances)                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         SHARED PACKAGES (@dotmac/*)                    │    │
│  │  - UI Components (@dotmac/primitives, @dotmac/ui)     │    │
│  │  - Business Logic (@dotmac/headless)                  │    │
│  │  - Feature Modules (@dotmac/features)                 │    │
│  │  - Authentication (@dotmac/auth)                      │    │
│  │  - GraphQL Client (@dotmac/graphql)                   │    │
│  │                                                        │    │
│  │  Built once, bundled into both apps                   │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architecture Principles

1. **Single Control Plane**: One `platform-admin-app` instance manages all tenants
2. **Isolated Tenant Instances**: Each ISP gets their own `isp-ops-app` deployment
3. **Golden Image**: Both apps share common packages for consistency
4. **Security by Design**: Complete code separation at build time
5. **Horizontal Scalability**: Scale tenants independently

---

## Control Plane vs Tenant Deployments

### Control Plane Architecture

**Purpose**: Centralized platform management and administration

**Deployment Model**:
- **Instances**: Single global deployment
- **Location**: `namespace: platform-admin` in Kubernetes
- **URL Pattern**: `admin.dotmac.com`
- **Database**: Shared platform database (tenant metadata, licensing, billing)
- **Scaling**: Vertical only (increase resources for single instance)

**Components**:
```
platform-admin namespace
├── platform-admin-app (Next.js)
│   ├── Platform administration dashboard
│   ├── Tenant management portal
│   ├── Licensing & feature flags
│   └── Tenant self-service portal
├── platform-backend (FastAPI)
│   ├── Multi-tenant APIs
│   ├── License management
│   └── Platform billing
├── PostgreSQL (Platform DB)
├── Redis (Shared cache)
└── Vault (Secrets management)
```

**Responsibilities**:
- Create/suspend/delete ISP tenants
- Manage platform-wide licenses
- Feature flag configuration
- Cross-tenant search and analytics
- Platform billing (charging ISPs for platform usage)
- Global audit logs and compliance
- System configuration and plugins

### Tenant Deployment Architecture

**Purpose**: Isolated ISP operations environment

**Deployment Model**:
- **Instances**: One per ISP tenant
- **Location**: `namespace: tenant-{tenant-slug}` in Kubernetes
- **URL Pattern**: `{tenant}.isp.dotmac.com` or custom domain
- **Database**: Isolated tenant database (subscribers, billing, network data)
- **Scaling**: Horizontal (add new tenant instances on demand)

**Components**:
```
tenant-{tenant-id} namespace
├── isp-ops-app (Next.js)
│   ├── ISP operations dashboard
│   ├── Subscriber management
│   ├── Network operations
│   ├── Billing & payments
│   └── Customer self-service portal
├── isp-backend (FastAPI)
│   ├── Tenant-scoped APIs
│   ├── Subscriber provisioning
│   └── Billing operations
├── PostgreSQL (Tenant DB - ISOLATED)
├── Redis (Tenant cache)
├── RADIUS Server
├── NetBox (IPAM/DCIM)
├── GenieACS (TR-069/CPE)
├── WireGuard VPN
├── Prometheus (Tenant metrics)
└── Grafana (Tenant dashboards)
```

**Responsibilities**:
- Manage internet subscribers (customers)
- Network device provisioning (ONUs, routers)
- RADIUS authentication and accounting
- IPAM and network inventory
- Subscriber billing and invoicing
- Support ticket management
- Service activation/suspension
- Customer portal for self-service

---

## Application Purposes

### Platform Admin App (`@dotmac/platform-admin-app`)

**File Location**: `/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/platform-admin-app`

**Target Audience**:
- DotMac platform administrators
- DotMac support engineers
- Platform engineering team
- ISP tenant administrators (tenant portal only)

**Core Features**:

1. **Platform Administration** (`/dashboard/platform-admin/*`)
   - Multi-tenant management
   - Tenant lifecycle operations
   - Platform-wide monitoring
   - Cross-tenant search

2. **Tenant Self-Service Portal** (`/tenant-portal/*`)
   - License seat management
   - Subscription plan management
   - Platform billing and payments
   - ISP staff user management
   - Support ticket submission to DotMac

3. **System Configuration** (`/dashboard/*`)
   - Feature flags management
   - Plugin catalog
   - Integration configuration
   - Webhook management
   - Audit logs and compliance

**Access Control**:
- Platform-level RBAC permissions
- Permissions like `platform:tenants:write`, `platform:audit:read`
- Tenant portal accessible via `tenants:read` permission

**Deployment**:
```dockerfile
# /frontend/apps/platform-admin-app/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
# Build platform-admin-app only
RUN pnpm --filter @dotmac/platform-admin-app build
```

**URL Patterns**:
- Production: `https://admin.dotmac.com`
- Staging: `https://admin-staging.dotmac.com`
- Development: `http://localhost:3002`

---

### ISP Operations App (`@dotmac/isp-ops-app`)

**File Location**: `/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/isp-ops-app`

**Target Audience**:
- ISP staff (customer service, NOC operators)
- ISP managers and administrators
- ISP billing department
- End subscribers (customer portal)

**Core Features**:

1. **Operations Dashboard** (`/dashboard/*`)
   - Subscriber management (CRUD operations)
   - Service provisioning workflows
   - Billing and invoicing
   - Support ticket handling
   - Network monitoring

2. **Customer Self-Service Portal** (`/customer-portal/*`)
   - View service status
   - Pay internet bills
   - Check data usage
   - Submit support tickets
   - Manage account details

3. **Network Operations** (`/dashboard/network/*`, `/dashboard/radius/*`, etc.)
   - RADIUS session management
   - Device provisioning (ONUs, CPEs)
   - IPAM and network inventory
   - Fault management
   - SLA monitoring

4. **Partner Management** (`/dashboard/partners/*`)
   - Partner relationship management
   - Commission tracking
   - Referral management
   - MSP tenant management (future)

**Access Control**:
- Tenant-level RBAC permissions
- Permissions like `customers:write`, `billing:read`, `network:manage`
- Customer portal uses separate CustomerAuthContext

**Deployment**:
```dockerfile
# /frontend/apps/isp-ops-app/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
# Build isp-ops-app only
RUN pnpm --filter @dotmac/isp-ops-app build
```

**URL Patterns**:
- Per-tenant: `https://{tenant}.isp.dotmac.com`
- Custom domains: `https://ops.fastfiber.com` (whitelabel)
- Development: `http://localhost:3001`

**Key Differences from Platform Admin**:
- ❌ No platform-wide tenant management
- ❌ No feature flag configuration
- ❌ No licensing management UI
- ❌ No cross-tenant operations
- ✅ Full subscriber management
- ✅ Network operations tools
- ✅ Customer billing and payments
- ✅ Embedded customer portal

---

## Deployment Topology

### Kubernetes Namespace Strategy

```yaml
# Platform Admin Namespace (Single Instance)
apiVersion: v1
kind: Namespace
metadata:
  name: platform-admin
  labels:
    app.kubernetes.io/name: dotmac-platform
    app.kubernetes.io/component: control-plane

---

# Tenant Namespace Template (Per-Tenant Instance)
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-{{ tenant_slug }}
  labels:
    app.kubernetes.io/name: dotmac-platform
    app.kubernetes.io/component: tenant
    dotmac.io/tenant-id: "{{ tenant_id }}"
    dotmac.io/tenant-slug: "{{ tenant_slug }}"
```

### Container Image Strategy

Both apps are built from the same monorepo but produce separate Docker images:

```bash
# Build platform-admin-app image
docker build \
  -f apps/platform-admin-app/Dockerfile \
  -t dotmac/platform-admin-app:v1.2.3 \
  .

# Build isp-ops-app image (golden image for all tenants)
docker build \
  -f apps/isp-ops-app/Dockerfile \
  -t dotmac/isp-ops-app:v1.2.3 \
  .
```

**Key Points**:
1. **Same base image**: Both use `node:20-alpine`
2. **Shared dependencies**: Both include `shared/packages/*`
3. **Different bundles**: Each app bundles only its routes and features
4. **Golden image**: All tenants use the same `isp-ops-app` image
5. **Configuration**: Differentiated via environment variables and ConfigMaps

### Network Policies

**Platform Admin Network Policy**:
```yaml
# Platform admin can access all tenant namespaces (for management)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: platform-admin-egress
  namespace: platform-admin
spec:
  podSelector:
    matchLabels:
      app: platform-admin-app
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              app.kubernetes.io/component: tenant
      ports:
        - protocol: TCP
          port: 8000  # Tenant backend API
```

**Tenant Network Policy**:
```yaml
# Tenants are isolated from each other
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: tenant-{{ tenant_slug }}
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: platform-admin  # Allow platform admin
        - namespaceSelector:
            matchLabels:
              name: tenant-{{ tenant_slug }}  # Allow same namespace
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: platform-admin  # Allow platform API calls
        - namespaceSelector:
            matchLabels:
              name: tenant-{{ tenant_slug }}  # Allow same namespace
    - to:  # Allow external internet (for RADIUS, APIs, etc.)
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 443
        - protocol: UDP
          port: 1812  # RADIUS auth
        - protocol: UDP
          port: 1813  # RADIUS accounting
```

### Resource Quotas

**Platform Admin Resources**:
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: platform-admin-quota
  namespace: platform-admin
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    persistentvolumeclaims: "5"
```

**Tenant Resources (Per-Tenant)**:
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-quota
  namespace: tenant-{{ tenant_slug }}
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    persistentvolumeclaims: "10"
    services.loadbalancers: "2"
```

---

## Shared Packages Strategy

### Why Share Code?

**Golden Image Strategy**: All tenants run identical application code, ensuring:
- Consistent UX across all ISP deployments
- Reduced maintenance burden (fix once, deploy everywhere)
- Faster feature development (build once, reuse everywhere)
- Easier bug fixes and security patches
- Simplified testing and QA

### What Gets Shared?

**Package Location**: `/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/shared/packages/`

**Shared Packages**:

```javascript
// package.json exports from @dotmac/features
{
  "name": "@dotmac/features",
  "exports": {
    ".": "./src/index.ts",
    "./analytics": "./src/analytics/index.ts",
    "./api-keys": "./src/api-keys/index.ts",
    "./billing": "./src/billing/index.ts",
    "./campaigns": "./src/campaigns/index.ts",
    "./cpe": "./src/cpe/index.ts",
    "./crm": "./src/crm/index.ts",
    "./customers": "./src/customers/index.ts",
    "./diagnostics": "./src/diagnostics/index.ts",
    "./error-handling": "./src/error-handling/index.ts",
    "./faults": "./src/faults/index.ts",
    "./forms": "./src/forms/index.ts",
    "./ipam": "./src/ipam/index.ts",
    "./monitoring": "./src/monitoring/index.ts",
    "./network": "./src/network/index.ts",
    "./notifications": "./src/notifications/index.ts",
    "./provisioning": "./src/provisioning/index.ts",
    "./radius": "./src/radius/index.ts",
    "./rbac": "./src/rbac/index.ts",
    "./remediation": "./src/remediation/index.ts",
    "./subscribers": "./src/subscribers/index.ts"
  }
}
```

**Shared Package Categories**:

1. **@dotmac/primitives** - UI Foundation
   - Shadcn-based components (Button, Card, Table, etc.)
   - Layout primitives
   - Form controls
   - Icons and assets

2. **@dotmac/ui** - Composite Components
   - DataTable with sorting/filtering
   - Charts and graphs (Recharts wrappers)
   - Modal dialogs and alerts
   - Navigation components

3. **@dotmac/features** - Business Logic
   - Subscriber management components
   - Billing and payment forms
   - Network device cards
   - RADIUS session monitors
   - Fault management UI
   - SLA compliance views

4. **@dotmac/headless** - Data & Logic
   - Authentication hooks
   - API client wrappers
   - WebSocket connections
   - Real-time data streams
   - Audit logging
   - Environment validation

5. **@dotmac/graphql** - API Client
   - GraphQL client configuration
   - Type-safe query hooks
   - Mutation helpers
   - Cache management

6. **@dotmac/design-system** - Theming
   - Color tokens
   - Typography system
   - Spacing and layout
   - Dark/light mode support

### What Stays Separate?

**App-Specific Code** (Not Shared):

1. **Routing** (`app/` directory)
   - Each app owns its routes
   - Platform admin routes never in ISP app
   - ISP routes replicated in platform admin (for visibility)

2. **App Configuration**
   - `next.config.mjs` - App-specific settings
   - `.env.local` - Environment variables
   - `package.json` - App-specific dependencies

3. **Deployment Artifacts**
   - Dockerfiles - Separate for each app
   - Kubernetes manifests - Different per app type
   - CI/CD pipelines - Build separately

4. **App-Specific Logic**
   - Platform admin: Tenant provisioning logic
   - ISP ops: Customer portal authentication
   - Platform admin: License validation UI
   - ISP ops: RADIUS server integration UI

### Benefits of Sharing

| Benefit | Impact | Example |
|---------|--------|---------|
| **Consistent UX** | Users get same experience across apps | Subscriber form looks identical in both apps |
| **Reduced Duplication** | ~60% code reuse | Billing components used by both apps |
| **Faster Features** | Build once, use twice | New chart component available everywhere |
| **Easier Maintenance** | Fix once, fix everywhere | Security patch to auth hook updates all apps |
| **Type Safety** | Shared TypeScript types | API contracts enforced across apps |
| **Testing** | Test shared code once | Button component tested once, used everywhere |

### Trade-offs

**Complexity vs Duplication**:

| Aspect | Shared Packages | Duplicated Code |
|--------|----------------|-----------------|
| Build time | Slower (must build shared packages first) | Faster (independent builds) |
| Dependencies | Coupled (breaking changes affect both) | Independent (can diverge) |
| Versioning | Requires coordination | Independent versioning |
| Bundle size | Smaller (shared chunks) | Larger (duplicated code) |
| Maintenance | Centralized (easier updates) | Distributed (multiple updates) |

**Our Choice**: Shared packages provide more value than cost:
- ✅ Benefits outweigh build complexity
- ✅ Monorepo makes dependency management easy
- ✅ pnpm workspaces handle versioning
- ✅ Bundle size reduction critical for tenant apps
- ✅ Consistent UX more important than independent versioning

---

## Scaling Model

### Platform Admin Scaling (Vertical)

**Characteristics**:
- Single instance globally
- Scales vertically (add more CPU/RAM)
- No horizontal scaling needed
- Stateful (relies on centralized DB)

**Scaling Strategy**:
```yaml
# Platform admin deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: platform-admin-app
  namespace: platform-admin
spec:
  replicas: 1  # Single instance only
  template:
    spec:
      containers:
        - name: frontend
          image: dotmac/platform-admin-app:v1.2.3
          resources:
            requests:
              cpu: "2"
              memory: 4Gi
            limits:
              cpu: "4"
              memory: 8Gi
          env:
            - name: DEPLOYMENT_MODE
              value: "platform_admin"
```

**When to Scale**:
- Platform admin load is relatively low
- Only DotMac staff and ISP admins use it
- Scale up when:
  - Tenant count exceeds 100
  - Heavy cross-tenant analytics queries
  - Platform admin response times degrade

### ISP Operations Scaling (Horizontal)

**Characteristics**:
- One instance per tenant
- Scales horizontally (add more tenants)
- Each tenant isolated
- Stateless (can run multiple replicas per tenant if needed)

**Scaling Strategy**:
```yaml
# Per-tenant deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: isp-ops-app
  namespace: tenant-{{ tenant_slug }}
spec:
  replicas: 1  # Can increase for high-traffic tenants
  template:
    spec:
      containers:
        - name: frontend
          image: dotmac/isp-ops-app:v1.2.3
          resources:
            requests:
              cpu: "1"
              memory: 2Gi
            limits:
              cpu: "2"
              memory: 4Gi
          env:
            - name: DEPLOYMENT_MODE
              value: "single_tenant"
            - name: TENANT_ID
              value: "{{ tenant_id }}"
            - name: TENANT_SLUG
              value: "{{ tenant_slug }}"
```

**Horizontal Pod Autoscaling** (for high-traffic tenants):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: isp-ops-app-hpa
  namespace: tenant-{{ tenant_slug }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: isp-ops-app
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

**Scaling Triggers**:
- New tenant onboarded: Deploy new namespace
- Tenant growth: Increase tenant pod replicas
- High traffic period: Auto-scale tenant pods
- Seasonal demand: Pre-scale before peak times

### Scaling Comparison

| Metric | Platform Admin | ISP Operations |
|--------|----------------|----------------|
| **Scaling Direction** | Vertical | Horizontal |
| **Instance Count** | 1 (global) | N (per tenant) |
| **Replica Scaling** | No (single replica) | Yes (HPA per tenant) |
| **Resource Allocation** | High (centralized) | Medium (distributed) |
| **Scaling Trigger** | Total platform load | Per-tenant load |
| **Scaling Complexity** | Low | Medium |
| **Cost Model** | Fixed (single instance) | Variable (per tenant) |

---

## Resource Isolation

### Namespace Isolation

**Purpose**: Complete separation of tenant resources and data

**Implementation**:
```yaml
# Each tenant gets isolated namespace
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-fast-fiber
  labels:
    dotmac.io/tenant-id: "123"
    dotmac.io/tenant-slug: "fast-fiber"
    dotmac.io/plan-tier: "professional"
  annotations:
    dotmac.io/created-at: "2025-01-15T10:30:00Z"
    dotmac.io/created-by: "platform-admin"
```

**What's Isolated**:
1. **Compute**: Pods, deployments, replica sets
2. **Storage**: Persistent volumes, databases
3. **Network**: Services, ingresses, network policies
4. **Configuration**: ConfigMaps, secrets
5. **Resources**: CPU/memory quotas, storage limits

### Database Isolation

**Platform Database** (Shared):
```
platform_db
├── tenants                 # Tenant metadata
├── licenses                # License allocations
├── feature_flags           # Platform-wide flags
├── subscriptions           # Platform billing
├── platform_users          # DotMac admins
└── audit_logs              # Platform audit trail
```

**Tenant Database** (Isolated):
```
tenant_fast_fiber_db
├── subscribers             # ISP customers (ISOLATED)
├── invoices                # Customer billing (ISOLATED)
├── radius_sessions         # Network sessions (ISOLATED)
├── devices                 # ONUs, routers (ISOLATED)
├── support_tickets         # Customer tickets (ISOLATED)
├── tenant_users            # ISP staff (ISOLATED)
└── audit_logs              # Tenant audit trail (ISOLATED)
```

**Database Security**:
```yaml
# Platform database credentials (shared)
apiVersion: v1
kind: Secret
metadata:
  name: platform-db-credentials
  namespace: platform-admin
type: Opaque
data:
  username: cGxhdGZvcm1fdXNlcg==
  password: <encrypted>

---

# Tenant database credentials (isolated)
apiVersion: v1
kind: Secret
metadata:
  name: tenant-db-credentials
  namespace: tenant-{{ tenant_slug }}
type: Opaque
data:
  username: dGVuYW50X3VzZXI=
  password: <encrypted-per-tenant>
```

### Network Isolation

**Ingress Routing**:
```yaml
# Platform admin ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: platform-admin-ingress
  namespace: platform-admin
spec:
  rules:
    - host: admin.dotmac.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: platform-admin-app
                port:
                  number: 3000
---

# Tenant ingress (per tenant)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: isp-ops-ingress
  namespace: tenant-{{ tenant_slug }}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - "{{ tenant_slug }}.isp.dotmac.com"
      secretName: "{{ tenant_slug }}-tls"
  rules:
    - host: "{{ tenant_slug }}.isp.dotmac.com"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: isp-ops-app
                port:
                  number: 3000
```

### Security Boundaries

**Service Accounts** (Least Privilege):
```yaml
# Platform admin service account (elevated)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: platform-admin-sa
  namespace: platform-admin
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: platform-admin-role
rules:
  - apiGroups: [""]
    resources: ["namespaces", "pods", "services"]
    verbs: ["get", "list", "watch", "create", "update", "delete"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets"]
    verbs: ["get", "list", "watch", "create", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: platform-admin-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: platform-admin-role
subjects:
  - kind: ServiceAccount
    name: platform-admin-sa
    namespace: platform-admin

---

# Tenant service account (restricted to namespace)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: isp-ops-sa
  namespace: tenant-{{ tenant_slug }}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tenant-role
  namespace: tenant-{{ tenant_slug }}
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: tenant-binding
  namespace: tenant-{{ tenant_slug }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: tenant-role
subjects:
  - kind: ServiceAccount
    name: isp-ops-sa
    namespace: tenant-{{ tenant_slug }}
```

### Benefits of Isolation

| Benefit | Impact | Security Level |
|---------|--------|----------------|
| **Data Privacy** | Tenant A cannot access Tenant B data | Critical |
| **Resource Fairness** | Tenant A cannot starve Tenant B resources | High |
| **Blast Radius** | Tenant A crash doesn't affect Tenant B | Critical |
| **Security** | Tenant A breach doesn't compromise Tenant B | Critical |
| **Compliance** | Each tenant can meet regulatory requirements | High |
| **Customization** | Each tenant can have custom configurations | Medium |

---

## Benefits of This Architecture

### 1. Security Isolation

**Problem Solved**:
- In a monolithic app, all code ships to all users
- ISP users could inspect platform admin JavaScript bundles
- Potential exposure of admin logic and API endpoints

**Solution**:
```javascript
// platform-admin-app bundle (ONLY for DotMac admins)
import { TenantManagement } from '@/components/admin/TenantManagement'
import { LicenseAllocator } from '@/components/admin/LicenseAllocator'
import { FeatureFlagManager } from '@/components/admin/FeatureFlagManager'

// isp-ops-app bundle (ONLY for ISP users)
import { SubscriberList } from '@/components/subscribers/SubscriberList'
import { BillingDashboard } from '@/components/billing/BillingDashboard'
import { NetworkMonitor } from '@/components/network/NetworkMonitor'
// ❌ NO ADMIN CODE INCLUDED
```

**Benefits**:
- ✅ ISP users never see admin code
- ✅ Admin API endpoints not exposed to ISP browsers
- ✅ Smaller attack surface per app
- ✅ Easier security audits (clear boundaries)

### 2. Bundle Size Optimization

**Before (Monolithic)**:
```
base-app.js: 3.2 MB (all features)
├── Platform admin features: 800 KB
├── ISP operations features: 1.8 MB
├── Customer portal: 400 KB
└── Shared code: 200 KB
```

**After (Split Apps)**:
```
platform-admin-app.js: 1.2 MB (admin + shared)
├── Platform admin features: 800 KB
├── ISP operations (view-only): 200 KB
└── Shared code: 200 KB

isp-ops-app.js: 2.2 MB (ISP + shared)
├── ISP operations features: 1.8 MB
├── Customer portal: 400 KB
└── Shared code: 200 KB
```

**Impact**:
- 🚀 ISP app 31% smaller (3.2 MB → 2.2 MB)
- 🚀 Platform app 63% smaller (3.2 MB → 1.2 MB)
- 🚀 Faster page loads for all users
- 🚀 Reduced bandwidth costs

### 3. Clear Ownership

**Before**: All features in one app
```
apps/base-app/
├── app/dashboard/
│   ├── feature-flags/      # Who owns this?
│   ├── subscribers/        # Who owns this?
│   ├── licensing/          # Who owns this?
│   └── billing/            # Platform or tenant billing?
```

**After**: Clear separation
```
apps/platform-admin-app/
├── app/dashboard/
│   ├── platform-admin/     # ✅ Platform team owns
│   ├── licensing/          # ✅ Platform team owns
│   └── tenant-portal/      # ✅ Platform team owns

apps/isp-ops-app/
├── app/dashboard/
│   ├── subscribers/        # ✅ ISP team owns
│   ├── billing/            # ✅ ISP team owns
│   └── customer-portal/    # ✅ ISP team owns
```

**Benefits**:
- ✅ Clear code ownership
- ✅ Easier to onboard developers
- ✅ Faster feature development (no conflicts)
- ✅ Independent deployment cycles

### 4. Independent Scaling

**Platform Admin**:
- Low traffic (only DotMac staff + ISP admins)
- Can run on smaller instances
- Vertical scaling sufficient

**ISP Operations**:
- High traffic (ISP staff + customers)
- Needs horizontal scaling per tenant
- Can scale tenant instances independently

**Example**:
```
Platform Admin: 1 instance @ 4 vCPU, 8 GB RAM
  Cost: $200/month

ISP Tenant (Small): 1 instance @ 1 vCPU, 2 GB RAM
  Cost: $50/month

ISP Tenant (Large): 3 instances @ 2 vCPU, 4 GB RAM
  Cost: $300/month
```

**Benefits**:
- 💰 Cost optimization (pay per tenant size)
- 🎯 Right-sized resources per workload
- 🚀 Scale tenants independently
- 🔧 Easier capacity planning

### 5. Fault Isolation

**Scenario**: Bug in customer portal crashes app

**Monolithic Impact**:
```
❌ Base app crashes
❌ Platform admin down (can't create tenants)
❌ All ISP dashboards down
❌ All customer portals down
❌ Total platform outage
```

**Multi-App Impact**:
```
✅ Platform admin unaffected
✅ Other tenants unaffected
❌ Only affected tenant's customer portal down
✅ Affected tenant's ISP dashboard still works
✅ Partial outage (1 tenant only)
```

**Benefits**:
- 🛡️ Blast radius contained to single tenant
- ✅ Platform operations continue
- ✅ Other tenants unaffected
- 🚨 Easier incident response (clear scope)

### 6. Flexible Deployment

**Platform Admin**:
- Deploy on premium infrastructure (SSD, high-memory)
- Single region deployment
- Can use managed services (RDS, ElastiCache)

**ISP Operations**:
- Deploy close to tenant's geographic location
- Can use different cloud providers per tenant
- Can run on edge locations for low latency

**Example Deployment Strategy**:
```
Platform Admin: AWS us-east-1 (centralized)
├── EC2 instances: t3.large
├── RDS: db.r5.xlarge (high availability)
└── ElastiCache: cache.r5.large

Tenant (US): AWS us-west-2 (close to customers)
├── EC2 instances: t3.medium
├── RDS: db.t3.large
└── ElastiCache: cache.t3.medium

Tenant (EU): AWS eu-west-1 (GDPR compliance)
├── EC2 instances: t3.medium
├── RDS: db.t3.large (encrypted, EU-only)
└── ElastiCache: cache.t3.medium

Tenant (Asia): GCP asia-southeast1 (different provider)
├── GKE cluster
├── Cloud SQL
└── Memorystore
```

**Benefits**:
- 🌍 Geographic distribution
- ⚖️ Regulatory compliance (data residency)
- 💰 Cost optimization (use cheapest regions)
- 🔧 Provider flexibility (not locked to one cloud)

### 7. Development Velocity

**Independent Development**:
```
Platform Team:
- Works on platform-admin-app
- Deploys admin features independently
- No impact on tenant operations

ISP Team:
- Works on isp-ops-app
- Deploys ISP features independently
- No impact on platform admin

Customer Portal Team:
- Works on customer-portal within isp-ops-app
- Deploys customer features independently
- No impact on ISP dashboard
```

**Benefits**:
- 🚀 Faster feature delivery
- 🔧 Independent CI/CD pipelines
- ✅ Reduced merge conflicts
- 🎯 Team autonomy

### 8. Testing & QA

**Monolithic Testing**:
```
Base app test suite:
- 500+ tests (all features)
- 15 minute test run
- All tests run for any change
- Hard to isolate failures
```

**Multi-App Testing**:
```
Platform admin tests:
- 200 tests (admin features)
- 5 minute test run
- Only run for admin changes

ISP ops tests:
- 300 tests (ISP features)
- 8 minute test run
- Only run for ISP changes

Shared package tests:
- 100 tests (shared code)
- 2 minute test run
- Run when shared code changes
```

**Benefits**:
- ⚡ Faster test feedback
- 🎯 Relevant tests only
- 🔍 Easier debugging (smaller scope)
- ✅ Better test isolation

---

## Configuration Management

### Environment Variables

**Shared Variables** (Both Apps):
```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.dotmac.com
NEXT_PUBLIC_GRAPHQL_URL=https://api.dotmac.com/graphql

# Authentication
NEXT_PUBLIC_SESSION_TIMEOUT=3600

# Feature Flags (Global)
NEXT_PUBLIC_ENABLE_DARK_MODE=true
NEXT_PUBLIC_ENABLE_REALTIME=true

# Observability
NEXT_PUBLIC_SENTRY_DSN=https://...
NEXT_PUBLIC_ANALYTICS_ID=UA-...
```

**Platform Admin Specific**:
```bash
# Deployment Mode
DEPLOYMENT_MODE=platform_admin
ENABLE_PLATFORM_ROUTES=true

# Platform Features
NEXT_PUBLIC_ENABLE_TENANT_MANAGEMENT=true
NEXT_PUBLIC_ENABLE_LICENSE_MANAGEMENT=true
NEXT_PUBLIC_ENABLE_FEATURE_FLAGS=true

# Multi-Tenant
NEXT_PUBLIC_TENANT_SELECTOR=true
NEXT_PUBLIC_CROSS_TENANT_SEARCH=true

# Admin URLs
NEXT_PUBLIC_ADMIN_URL=https://admin.dotmac.com
```

**ISP Operations Specific**:
```bash
# Deployment Mode
DEPLOYMENT_MODE=single_tenant
ENABLE_PLATFORM_ROUTES=false

# Tenant Context
TENANT_ID=fast-fiber-isp-123
TENANT_SLUG=fast-fiber

# Tenant Features
NEXT_PUBLIC_ENABLE_CUSTOMER_PORTAL=true
NEXT_PUBLIC_ENABLE_RADIUS=true
NEXT_PUBLIC_ENABLE_PARTNER_MANAGEMENT=true

# Tenant Customization
NEXT_PUBLIC_TENANT_NAME=Fast Fiber ISP
NEXT_PUBLIC_TENANT_LOGO_URL=https://cdn.dotmac.com/logos/fast-fiber.png
NEXT_PUBLIC_PRIMARY_COLOR=#0066CC

# Backend URLs (Tenant-Specific)
NEXT_PUBLIC_API_BASE_URL=https://api.fastfiber.isp.dotmac.com
NEXT_PUBLIC_GRAPHQL_URL=https://api.fastfiber.isp.dotmac.com/graphql
```

### Feature Flags

**Platform-Wide Flags** (Controlled by Platform Admin):
```typescript
// Platform admin can toggle features globally
interface PlatformFeatureFlags {
  enableIPv6Lifecycle: boolean;       // All tenants
  enableNetworkProfiles: boolean;     // All tenants
  enableSLAMonitoring: boolean;       // All tenants
  enablePartnerPortal: boolean;       // All tenants
  enableAdvancedAnalytics: boolean;   // Premium tier only
}
```

**Tenant-Specific Flags** (Controlled by ISP Admins):
```typescript
// Each tenant can toggle their own features
interface TenantFeatureFlags {
  enableCustomerPortal: boolean;      // Per tenant
  enableSMSNotifications: boolean;    // Per tenant
  enableAutoProvisioning: boolean;    // Per tenant
  enableCustomBranding: boolean;      // Per tenant
}
```

**Implementation**:
```typescript
// Platform admin app
import { usePlatformFeatureFlags } from '@dotmac/headless'

function FeatureFlagManager() {
  const { flags, updateFlag } = usePlatformFeatureFlags()

  return (
    <div>
      <Toggle
        checked={flags.enableIPv6Lifecycle}
        onChange={(val) => updateFlag('enableIPv6Lifecycle', val)}
      />
      <p>Affects all tenants globally</p>
    </div>
  )
}

// ISP ops app
import { useTenantFeatureFlags } from '@dotmac/headless'

function TenantSettings() {
  const { flags, updateFlag } = useTenantFeatureFlags()

  return (
    <div>
      <Toggle
        checked={flags.enableCustomerPortal}
        onChange={(val) => updateFlag('enableCustomerPortal', val)}
      />
      <p>Affects only this tenant</p>
    </div>
  )
}
```

### API Endpoints

**Platform Admin API Routes**:
```typescript
// Platform admin calls platform-scoped APIs
const PLATFORM_ENDPOINTS = {
  tenants: '/api/v1/platform/tenants',
  licenses: '/api/v1/platform/licenses',
  featureFlags: '/api/v1/platform/feature-flags',
  audit: '/api/v1/platform/audit',
  analytics: '/api/v1/platform/analytics',
  billing: '/api/v1/platform/billing',  // Platform billing (charging ISPs)
}
```

**ISP Operations API Routes**:
```typescript
// ISP ops calls tenant-scoped APIs (tenant context from X-Tenant-ID header)
const ISP_ENDPOINTS = {
  subscribers: '/api/isp/v1/subscribers',
  devices: '/api/isp/v1/devices',
  invoices: '/api/isp/v1/invoices',  // Customer billing
  radius: '/api/isp/v1/radius',
  support: '/api/isp/v1/support',
  analytics: '/api/isp/v1/analytics',  // Tenant analytics
}
```

**Backend Routing**:
```python
# FastAPI backend routes by context
from fastapi import APIRouter, Depends
from dotmac.platform.auth.rbac_dependencies import require_permission

platform_router = APIRouter(prefix="/api/platform/v1")
isp_router = APIRouter(prefix="/api/isp/v1")

# Platform routes (platform admin app only)
@platform_router.get("/tenants")
@require_permission("platform:tenants:read")
async def list_tenants():
    """Platform admins can list all tenants"""
    return await TenantService.list_all()

# ISP routes (ISP ops app only, tenant from X-Tenant-ID header)
@isp_router.get("/subscribers")
@require_permission("customers:read")
async def list_subscribers():
    """ISP staff can list their subscribers"""
    # Tenant context injected via middleware from X-Tenant-ID header
    return await SubscriberService.list_by_tenant()
```

### Tenant Context Injection

**How isp-ops-app Knows Its Tenant**:

1. **Environment Variable** (Kubernetes ConfigMap):
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: isp-ops-config
  namespace: tenant-fast-fiber
data:
  TENANT_ID: "fast-fiber-isp-123"
  TENANT_SLUG: "fast-fiber"
  TENANT_NAME: "Fast Fiber ISP"
```

2. **Application Startup** (Next.js):
```typescript
// apps/isp-ops-app/lib/tenant-context.ts
export const TENANT_CONFIG = {
  tenantId: process.env.TENANT_ID!,
  tenantSlug: process.env.TENANT_SLUG!,
  tenantName: process.env.NEXT_PUBLIC_TENANT_NAME!,
  apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL!,
} as const

// Validate at build time
if (!TENANT_CONFIG.tenantId) {
  throw new Error('TENANT_ID must be set')
}
```

3. **API Calls** (Automatic Tenant Injection):
```typescript
// apps/isp-ops-app/lib/api-client.ts
import { TENANT_CONFIG } from './tenant-context'

export const apiClient = axios.create({
  baseURL: TENANT_CONFIG.apiUrl,
  headers: {
    'X-Tenant-ID': TENANT_CONFIG.tenantId,
  },
})

// All API calls automatically include tenant context via X-Tenant-ID header
apiClient.get('/subscribers')  // → GET /api/isp/v1/subscribers (with X-Tenant-ID: fast-fiber-isp-123)
```

### Resource Limits

**Platform Admin Limits** (Generous):
```yaml
resources:
  requests:
    cpu: "2"
    memory: 4Gi
  limits:
    cpu: "4"
    memory: 8Gi
```

**ISP Operations Limits** (Tier-Based):
```yaml
# Starter Tier (Small ISPs)
resources:
  requests:
    cpu: "500m"
    memory: 1Gi
  limits:
    cpu: "1"
    memory: 2Gi

# Professional Tier (Medium ISPs)
resources:
  requests:
    cpu: "1"
    memory: 2Gi
  limits:
    cpu: "2"
    memory: 4Gi

# Enterprise Tier (Large ISPs)
resources:
  requests:
    cpu: "2"
    memory: 4Gi
  limits:
    cpu: "4"
    memory: 8Gi
```

---

## Application Comparison

### Comprehensive Feature Matrix

| Feature | Platform Admin | ISP Operations | Notes |
|---------|----------------|----------------|-------|
| **Deployment** | | | |
| Instance Count | 1 (global) | N (per tenant) | Horizontal scaling |
| Namespace | `platform-admin` | `tenant-{slug}` | K8s isolation |
| Scaling | Vertical | Horizontal | Different strategies |
| URL Pattern | `admin.dotmac.com` | `{tenant}.isp.dotmac.com` | DNS routing |
| Custom Domains | No | Yes (whitelabel) | Tenant branding |
| | | | |
| **Users** | | | |
| DotMac Admins | ✅ Primary | ❌ No access | Platform management |
| ISP Administrators | ✅ Tenant portal | ✅ Full access | Tenant management |
| ISP Staff | ❌ No access | ✅ Full access | Day-to-day ops |
| End Subscribers | ❌ No access | ✅ Customer portal | Self-service |
| | | | |
| **Platform Management** | | | |
| Tenant Provisioning | ✅ Create/suspend | ❌ View only | Platform feature |
| License Management | ✅ Allocate seats | ✅ View allocation | Platform controls |
| Feature Flags | ✅ Manage global | ❌ View only | Platform controls |
| Plugin Management | ✅ Full control | ❌ No access | Platform feature |
| Audit Logs | ✅ Platform-wide | ✅ Tenant-scoped | Different scopes |
| | | | |
| **ISP Operations** | | | |
| Subscriber Management | ❌ View only | ✅ Full CRUD | Tenant feature |
| Customer Billing | ❌ No access | ✅ Full access | Tenant feature |
| Network Provisioning | ❌ No access | ✅ Full access | Tenant feature |
| RADIUS Management | ❌ No access | ✅ Full access | Tenant feature |
| Support Tickets | ❌ No access | ✅ Full access | Tenant feature |
| Device Management | ❌ No access | ✅ Full access | Tenant feature |
| | | | |
| **Portals** | | | |
| Main Dashboard | ✅ Platform admin | ✅ ISP operations | Different content |
| Tenant Self-Service | ✅ Full access | ❌ No access | Platform billing |
| Customer Portal | ❌ No access | ✅ Embedded | Subscriber self-service |
| Partner Portal | ❌ No access | ✅ Embedded | Partner management |
| | | | |
| **Billing** | | | |
| Platform Billing | ✅ Charge ISPs | ✅ View subscription | B2B billing |
| Customer Billing | ❌ No access | ✅ Charge subscribers | B2C billing |
| Payment Processing | ✅ ISP payments | ✅ Customer payments | Different contexts |
| | | | |
| **Analytics** | | | |
| Platform Analytics | ✅ All tenants | ❌ No access | Cross-tenant |
| Tenant Analytics | ✅ Per-tenant view | ✅ Own tenant | Scoped data |
| Revenue Analytics | ✅ Platform revenue | ✅ Customer revenue | Different metrics |
| | | | |
| **Security** | | | |
| RBAC Permissions | `platform:*` | `customers:*`, `billing:*` | Different scopes |
| Data Access | All tenants | Single tenant | Isolation level |
| Network Policies | Global egress | Namespace-scoped | K8s policies |
| Resource Quotas | High limits | Tier-based limits | Different quotas |
| | | | |
| **Technical** | | | |
| Bundle Size | 1.2 MB | 2.2 MB | Optimized per app |
| Build Time | ~3 min | ~4 min | Complexity difference |
| Dependencies | 45 packages | 47 packages | Similar deps |
| Routes | ~30 routes | ~80 routes | More ISP features |
| Shared Packages | ✅ All packages | ✅ All packages | Same foundation |

### Bundle Composition

**Platform Admin App Bundle**:
```
Total: 1.2 MB
├── Platform features: 800 KB
│   ├── Tenant management UI
│   ├── License allocator
│   ├── Feature flag manager
│   ├── Audit log viewer
│   └── Platform analytics
├── Tenant portal: 200 KB
│   ├── Subscription management
│   ├── Billing and invoices
│   └── Support tickets
├── Shared packages: 200 KB
│   ├── UI primitives
│   ├── Auth helpers
│   └── GraphQL client
└── ISP views (read-only): 200 KB (for troubleshooting)
```

**ISP Operations App Bundle**:
```
Total: 2.2 MB
├── ISP operations: 1.8 MB
│   ├── Subscriber management
│   ├── Network provisioning
│   ├── RADIUS & device management
│   ├── Billing & invoicing
│   ├── Support tickets
│   ├── Analytics & reporting
│   └── Partner management
├── Customer portal: 400 KB
│   ├── Account dashboard
│   ├── Usage tracking
│   ├── Bill payment
│   └── Support forms
└── Shared packages: 200 KB
    ├── UI primitives
    ├── Auth helpers
    └── GraphQL client
```

---

## Real-World Deployment Scenarios

### Scenario 1: New Tenant Onboarding

**Situation**: Fast Fiber ISP signs up for DotMac platform

**Steps**:

1. **Platform Admin Creates Tenant** (via `platform-admin-app`):
```typescript
// Platform admin UI
POST /api/v1/platform/tenants
{
  "slug": "fast-fiber",
  "name": "Fast Fiber ISP",
  "plan": "professional",
  "seats": 50,
  "features": ["ipv6", "advanced_analytics", "radius"]
}
```

2. **Backend Provisions Infrastructure**:
```python
# Backend creates tenant namespace and resources
async def provision_tenant(tenant_data):
    # 1. Create database
    await create_tenant_database(f"tenant_{tenant_data.slug}_db")

    # 2. Create Kubernetes namespace
    await k8s.create_namespace(
        name=f"tenant-{tenant_data.slug}",
        labels={"tenant_id": tenant_data.id}
    )

    # 3. Deploy isp-ops-app
    await helm.install(
        chart="isp-ops-tenant",
        namespace=f"tenant-{tenant_data.slug}",
        values={
            "image": "dotmac/isp-ops-app:v1.2.3",
            "tenant_id": tenant_data.id,
            "tenant_slug": tenant_data.slug,
            "database_url": f"postgresql://tenant_{tenant_data.slug}_db",
        }
    )

    # 4. Create ingress
    await create_ingress(
        host=f"{tenant_data.slug}.isp.dotmac.com",
        service="isp-ops-app",
        namespace=f"tenant-{tenant_data.slug}"
    )
```

3. **Tenant Is Live**:
```
✅ Namespace: tenant-fast-fiber created
✅ Database: tenant_fast_fiber_db provisioned
✅ App deployed: isp-ops-app running
✅ URL available: https://fastfiber.isp.dotmac.com
✅ Credentials emailed to Fast Fiber admin
```

4. **Fast Fiber Admin Logs In**:
```
URL: https://fastfiber.isp.dotmac.com/login
Username: admin@fastfiber.com
Password: (initial password from email)

→ Redirected to ISP operations dashboard
→ Can now manage subscribers, configure network, etc.
```

**Time**: 5-10 minutes (automated)

### Scenario 2: Platform Feature Update

**Situation**: DotMac releases new IPv6 lifecycle management feature

**Steps**:

1. **Feature Development**:
```bash
# Developer works on shared package
cd frontend/shared/packages/features
# Add new IPv6 components
mkdir src/ipv6-lifecycle
# ... implement feature
```

2. **Testing**:
```bash
# Test in both apps
cd frontend
pnpm --filter @dotmac/platform-admin-app test
pnpm --filter @dotmac/isp-ops-app test
```

3. **Build New Images**:
```bash
# Build both apps (includes updated shared package)
docker build -f apps/platform-admin-app/Dockerfile -t dotmac/platform-admin-app:v1.3.0 .
docker build -f apps/isp-ops-app/Dockerfile -t dotmac/isp-ops-app:v1.3.0 .
```

4. **Deploy Platform Admin** (Single Instance):
```bash
# Update platform admin first
kubectl set image deployment/platform-admin-app \
  frontend=dotmac/platform-admin-app:v1.3.0 \
  -n platform-admin

# Wait for rollout
kubectl rollout status deployment/platform-admin-app -n platform-admin
```

5. **Deploy to Tenants** (Rolling Update):
```bash
# Get all tenant namespaces
TENANTS=$(kubectl get namespaces -l app.kubernetes.io/component=tenant -o jsonpath='{.items[*].metadata.name}')

# Rolling update to all tenants
for ns in $TENANTS; do
  echo "Updating $ns..."
  kubectl set image deployment/isp-ops-app \
    frontend=dotmac/isp-ops-app:v1.3.0 \
    -n $ns

  # Wait for successful rollout
  kubectl rollout status deployment/isp-ops-app -n $ns

  # Check health
  kubectl get pods -n $ns | grep isp-ops-app
done
```

6. **Feature Flag Activation**:
```typescript
// Platform admin enables feature globally
await updatePlatformFeatureFlag('enableIPv6Lifecycle', true)

// Feature now available in all tenant instances
```

**Time**: 30-60 minutes (for 50 tenants)

**Impact**: All tenants get new feature simultaneously

### Scenario 3: Tenant Customization

**Situation**: Fast Fiber wants custom branding and SMS notifications

**Steps**:

1. **Custom Branding** (ConfigMap Update):
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: isp-ops-config
  namespace: tenant-fast-fiber
data:
  TENANT_ID: "fast-fiber-isp-123"
  TENANT_SLUG: "fast-fiber"
  NEXT_PUBLIC_TENANT_NAME: "Fast Fiber ISP"
  NEXT_PUBLIC_TENANT_LOGO_URL: "https://cdn.dotmac.com/logos/fast-fiber.png"
  NEXT_PUBLIC_PRIMARY_COLOR: "#0066CC"
  NEXT_PUBLIC_ENABLE_SMS_NOTIFICATIONS: "true"
```

2. **Restart App** (to pick up new config):
```bash
kubectl rollout restart deployment/isp-ops-app -n tenant-fast-fiber
```

3. **Result**:
```
✅ Fast Fiber logo appears in app header
✅ Primary color changed to Fast Fiber blue (#0066CC)
✅ SMS notification toggle enabled in settings
✅ Customer portal branded as "Fast Fiber"
```

4. **Other Tenants Unaffected**:
```
✅ City Net still has their branding
✅ Metro Fiber still has their colors
✅ Each tenant isolated
```

**Time**: 5 minutes

### Scenario 4: Scaling for Growth

**Situation**: City Net ISP growing rapidly (100k → 500k subscribers)

**Steps**:

1. **Monitor Resource Usage**:
```bash
kubectl top pods -n tenant-citynet

NAME                           CPU    MEMORY
isp-ops-app-5d9f8c7b6-abc123   450m   1800Mi  # High usage
isp-backend-7c8d9e-def456       800m   3200Mi  # High usage
```

2. **Increase Resource Limits**:
```yaml
# Update deployment
resources:
  requests:
    cpu: "2"      # Was: 1
    memory: 4Gi   # Was: 2Gi
  limits:
    cpu: "4"      # Was: 2
    memory: 8Gi   # Was: 4Gi
```

3. **Enable Horizontal Pod Autoscaling**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: isp-ops-app-hpa
  namespace: tenant-citynet
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: isp-ops-app
  minReplicas: 2    # Was: 1
  maxReplicas: 10   # Was: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

4. **Upgrade Database**:
```bash
# Increase database tier
aws rds modify-db-instance \
  --db-instance-identifier tenant-citynet-db \
  --db-instance-class db.r5.2xlarge \  # Was: db.t3.large
  --apply-immediately
```

5. **Result**:
```
✅ App scales from 1 → 5 replicas during peak hours
✅ Database handles increased load
✅ Response times stay under 200ms
✅ Other tenants unaffected
```

**Time**: 15 minutes (automated scaling)

**Cost Impact**:
- Before: $150/month
- After: $600/month (4x increase for 5x subscribers)

### Scenario 5: Incident Response

**Situation**: Bug in customer portal causes crashes

**Impact Analysis**:

**Affected**:
```
❌ All tenant customer portals affected
❌ Subscribers can't pay bills online
❌ Subscribers can't check usage
```

**Not Affected**:
```
✅ Platform admin app (separate codebase)
✅ ISP operations dashboards (different routes)
✅ Network operations (RADIUS, provisioning)
✅ Platform can still onboard new tenants
```

**Response**:

1. **Identify Issue**:
```bash
# Check error logs across tenants
kubectl logs -l app=isp-ops-app --all-namespaces | grep ERROR

# Error pattern found in customer portal route
```

2. **Quick Fix** (Feature Flag):
```typescript
// Platform admin disables customer portal temporarily
await updatePlatformFeatureFlag('enableCustomerPortal', false)

// Customer portal routes return maintenance page
```

3. **Deploy Fix**:
```bash
# Fix bug, build new image
docker build -f apps/isp-ops-app/Dockerfile -t dotmac/isp-ops-app:v1.2.4 .

# Rolling deployment to all tenants
for ns in $TENANTS; do
  kubectl set image deployment/isp-ops-app \
    frontend=dotmac/isp-ops-app:v1.2.4 \
    -n $ns
done
```

4. **Re-enable Feature**:
```typescript
// Platform admin re-enables customer portal
await updatePlatformFeatureFlag('enableCustomerPortal', true)
```

**Time to Recovery**:
- Disable: 2 minutes
- Fix + Deploy: 45 minutes
- Total downtime: ~50 minutes (customer portal only)

**Blast Radius**:
- ✅ Contained to customer portal routes
- ✅ ISP operations unaffected
- ✅ Platform admin unaffected

---

## Why Not a Single App?

### The Monolith Problem

**If we used a single app for everything**:

```
apps/monolith-app/
├── app/dashboard/
│   ├── platform-admin/     # DotMac admin features
│   ├── tenants/            # Tenant management
│   ├── licensing/          # License management
│   ├── subscribers/        # ISP subscriber management
│   ├── billing/            # Both platform + customer billing
│   ├── network/            # Network operations
│   └── customer-portal/    # Customer self-service
```

### Critical Problems

#### 1. Security Nightmare

**Problem**: All code ships to all users

```javascript
// Single app bundle (everyone gets everything)
import { TenantProvisioner } from '@/platform-admin/TenantProvisioner'
import { LicenseManager } from '@/platform-admin/LicenseManager'
import { FeatureFlagEditor } from '@/platform-admin/FeatureFlagEditor'
import { SubscriberList } from '@/isp-ops/SubscriberList'
import { CustomerPortal } from '@/customer-portal/CustomerPortal'

// ❌ ISP users can inspect platform admin code in browser DevTools
// ❌ API endpoints exposed to unauthorized users
// ❌ Platform admin logic visible to tenants
```

**Impact**:
- 🚨 Security by obscurity fails (code visible to all)
- 🚨 Larger attack surface (all features exposed)
- 🚨 Potential data leaks (admin logic in tenant browsers)
- 🚨 Harder security audits (unclear boundaries)

#### 2. Bundle Size Bloat

**Problem**: Everyone downloads all features

```
monolith-app.js: 5.8 MB
├── Platform admin: 1.2 MB  (only 10 users need this)
├── ISP operations: 2.8 MB  (1000s of users need this)
├── Customer portal: 1.5 MB (100k+ users need this)
└── Shared code: 300 KB
```

**Impact**:
- 🐌 Slow page loads for all users
- 💰 Increased bandwidth costs
- 📱 Poor mobile experience
- 🌍 Terrible in low-bandwidth regions

**Comparison**:
| User Type | Monolith | Multi-App | Savings |
|-----------|----------|-----------|---------|
| ISP Staff | 5.8 MB | 2.2 MB | 62% smaller |
| Customer | 5.8 MB | 1.8 MB | 69% smaller |
| DotMac Admin | 5.8 MB | 1.2 MB | 79% smaller |

#### 3. Unclear Ownership

**Problem**: All code in one app

```
// Who owns this file?
apps/monolith-app/app/dashboard/settings/page.tsx

// Is this platform settings or tenant settings?
// Can anyone edit this?
// What's the deployment process?
```

**Impact**:
- 🤷 Unclear code ownership
- 🐛 More merge conflicts
- 🐌 Slower development (waiting on others)
- 😕 Confusing for new developers

#### 4. No Fault Isolation

**Problem**: One bug takes down everything

```
Scenario: Bug in customer portal

Monolith Impact:
❌ Platform admin crashes → Can't onboard tenants
❌ All ISP dashboards crash → Can't provision services
❌ All customer portals crash → Can't pay bills
❌ Complete platform outage
```

**Multi-App Impact**:
```
✅ Platform admin unaffected → Can onboard tenants
✅ ISP dashboards unaffected → Can provision services
❌ Customer portals crash → Can't pay bills (isolated)
✅ Partial outage (customer portal only)
```

#### 5. Cannot Scale Independently

**Problem**: Everything scales together

```
# Monolith: Must scale entire app for any workload
monolith-app:
  replicas: 10  # Need 10 for high customer traffic
  resources:
    cpu: 4      # But platform admin only needs 1
    memory: 8Gi # Wasting resources on low-traffic features
```

**Multi-App**:
```
# Scale each app independently
platform-admin-app:
  replicas: 1   # Low traffic
  resources:
    cpu: 2
    memory: 4Gi

isp-ops-app (per tenant):
  replicas: 3-10  # Auto-scale based on tenant load
  resources:
    cpu: 1-4      # Right-sized per tenant
    memory: 2-8Gi
```

**Cost Impact**:
- Monolith: $5,000/month (over-provisioned)
- Multi-App: $2,500/month (right-sized)
- **Savings**: $2,500/month (50%)

#### 6. Deployment Complexity

**Problem**: Deploy everything or nothing

```
# Monolith: Any change requires full deployment
git commit -m "Fix typo in customer portal"

→ Must redeploy entire monolith
→ Platform admin restarted (no changes)
→ ISP dashboards restarted (no changes)
→ Risk introduced to unrelated features
```

**Multi-App**:
```
# Only deploy affected app
git commit -m "Fix typo in customer portal"

→ Deploy isp-ops-app only
→ Platform admin untouched
→ Risk isolated to customer portal
```

#### 7. Testing Nightmares

**Problem**: Test everything for every change

```
# Monolith test suite
Total tests: 2,500
Time: 45 minutes
Coverage: 85%

Change: Fix button in customer portal
Required tests: ALL 2,500 tests (no isolation)
```

**Multi-App**:
```
# ISP ops test suite
Total tests: 800
Time: 12 minutes
Coverage: 90%

Change: Fix button in customer portal
Required tests: 800 tests (isolated)
```

**Developer Experience**:
- Monolith: 45-min feedback loop 😫
- Multi-App: 12-min feedback loop 😊

#### 8. Team Coordination Overhead

**Problem**: All teams block each other

```
Monolith Workflow:
Platform Team: "We need to deploy license feature"
ISP Team: "Wait, we're testing subscriber feature"
Customer Team: "Wait, we're fixing payment bug"
→ Nobody can deploy
→ Features pile up
→ Risk accumulates
```

**Multi-App Workflow**:
```
Platform Team: "Deploying license feature" (platform-admin-app)
ISP Team: "Testing subscriber feature" (isp-ops-app)
Customer Team: "Fixing payment bug" (isp-ops-app)
→ Platform team deploys independently ✅
→ ISP team blocks customer team (same app) ⚠️
→ But platform unaffected ✅
```

### Alternatives Considered

#### Alternative 1: Monolith with RBAC

**Idea**: Single app, hide features via permissions

```typescript
// Render components based on permissions
{hasPermission('platform:admin') && <TenantManager />}
{hasPermission('customers:read') && <SubscriberList />}
```

**Why Rejected**:
- ❌ All code still ships to all browsers
- ❌ No bundle size optimization
- ❌ Security by obscurity (client-side checks)
- ❌ No deployment isolation
- ❌ No scaling flexibility

**Verdict**: RBAC is necessary but not sufficient

#### Alternative 2: Micro-Frontends

**Idea**: Multiple independent frontend apps, dynamically loaded

```typescript
// Module federation
import('platformAdmin/TenantManager')
import('ispOps/SubscriberList')
import('customerPortal/Dashboard')
```

**Why Rejected**:
- ⚠️ Complex orchestration (module federation, shell app)
- ⚠️ Runtime overhead (dynamic loading)
- ⚠️ Version management nightmare
- ⚠️ Shared state complexity
- ✅ Good isolation
- ✅ Independent deployments

**Verdict**: Over-engineered for our use case. Multi-app gives us isolation without micro-frontend complexity.

#### Alternative 3: Separate Repos

**Idea**: Completely separate repositories per app

```
dotmac-platform-admin/
dotmac-isp-ops/
dotmac-customer-portal/
```

**Why Rejected**:
- ❌ Can't share code easily (must publish packages)
- ❌ Version drift between apps
- ❌ Harder to maintain consistency
- ❌ More CI/CD overhead
- ❌ Difficult cross-app refactoring

**Verdict**: Monorepo with multi-app is sweet spot

### Our Solution: Monorepo Multi-App

**Best of Both Worlds**:

```
frontend/
├── apps/
│   ├── platform-admin-app/   # Separate app
│   └── isp-ops-app/           # Separate app
└── shared/packages/           # Shared via monorepo
```

**Advantages**:
- ✅ Security isolation (separate bundles)
- ✅ Bundle optimization (only relevant code)
- ✅ Clear ownership (separate directories)
- ✅ Fault isolation (independent deployments)
- ✅ Independent scaling (different resource profiles)
- ✅ Shared code (monorepo packages)
- ✅ Consistent UX (shared design system)
- ✅ Simple orchestration (pnpm workspaces)
- ✅ Single CI/CD (unified pipeline)

**Trade-offs Accepted**:
- ⚠️ Two Docker images (vs one)
- ⚠️ Two deployment targets (vs one)
- ⚠️ Some code duplication (routing, config)

**Verdict**: Benefits far outweigh costs

---

## Summary

### Key Takeaways

1. **Two Apps, Two Purposes**:
   - Platform admin: Control plane (single instance)
   - ISP operations: Tenant apps (one per ISP)

2. **Shared Code Strategy**:
   - UI, business logic, types shared via packages
   - Apps own routing, deployment, configuration
   - Golden image ensures consistency

3. **Deployment Model**:
   - Kubernetes namespace per tenant
   - Horizontal scaling (add tenants)
   - Vertical scaling (platform admin only)
   - Resource isolation via network policies

4. **Benefits**:
   - ✅ Security isolation (no code leaks)
   - ✅ Bundle optimization (62-79% smaller)
   - ✅ Clear ownership (separate apps)
   - ✅ Fault isolation (blast radius contained)
   - ✅ Independent scaling (cost optimization)
   - ✅ Deployment flexibility (geographic, compliance)

5. **Why Not a Single App?**:
   - Security nightmare (all code to all users)
   - Bundle bloat (5.8 MB for everyone)
   - No fault isolation (one bug, full outage)
   - Cannot scale independently (over-provisioning)
   - Deployment risk (change one, deploy all)

### Architecture Justification

**This is not over-engineering. This is:**
- ✅ Security best practice (principle of least privilege)
- ✅ Performance optimization (smaller bundles)
- ✅ Operational excellence (fault isolation)
- ✅ Cost optimization (right-sized resources)
- ✅ Development velocity (team independence)

**This architecture mirrors successful B2B2C platforms**:
- Stripe (platform + Connect merchant dashboards)
- Shopify (platform + merchant stores)
- Twilio (platform + customer accounts)
- AWS (console + per-customer environments)

### For DevOps Teams

**What You Need to Know**:
1. Two Docker images to build: `platform-admin-app`, `isp-ops-app`
2. One platform namespace: `platform-admin`
3. Many tenant namespaces: `tenant-{slug}` (one per ISP)
4. Shared package build happens first: `pnpm build:packages`
5. Apps bundle shared packages: No separate deployment needed
6. Use Helm charts for templated tenant deployments
7. Resource quotas differ per app type
8. Network policies enforce tenant isolation

**Deployment Checklist**:
- [ ] Build shared packages: `pnpm --filter ./shared/packages/** build`
- [ ] Build platform admin: `docker build -f apps/platform-admin-app/Dockerfile`
- [ ] Build ISP ops: `docker build -f apps/isp-ops-app/Dockerfile`
- [ ] Deploy platform admin: `helm install platform-admin`
- [ ] Deploy tenants: `helm install tenant-{slug}` (per tenant)
- [ ] Configure ingress: `{tenant}.isp.dotmac.com`
- [ ] Set up monitoring: Per-tenant Prometheus
- [ ] Enable backups: Per-tenant database backups

---

## Related Documentation

- [PORTAL_ARCHITECTURE.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/docs/architecture/PORTAL_ARCHITECTURE.md) - Workspace and portal structure
- [FRONTEND_SITEMAP.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/docs/architecture/FRONTEND_SITEMAP.md) - Complete route listing
- [DEPLOYMENT_TOPOLOGY.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/docs/architecture/diagrams/DEPLOYMENT_TOPOLOGY.md) - Deployment diagrams
- [DEPLOYMENT_PROCESS.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/docs/deployment/DEPLOYMENT_PROCESS.md) - Step-by-step deployment guide
- [PRODUCTION_DEPLOYMENT_K8S.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/PRODUCTION_DEPLOYMENT_K8S.md) - Kubernetes deployment details
- [ARCHITECTURE_OVERVIEW.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/ARCHITECTURE_OVERVIEW.md) - Frontend architecture overview

---

**Maintained by**: DotMac Platform Engineering
**Last Review**: November 9, 2025
**Next Review**: Quarterly or when major architectural changes occur
