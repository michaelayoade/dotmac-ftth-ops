# DotMac Platform Frontend Sitemap

## 📱 Application Structure

We deploy **two Next.js applications**:

- `isp-ops-app` – Hosts the ISP operator dashboard and embedded workspaces for partners and end customers.
- `platform-admin-app` – Hosts the DotMac platform administration console.

Within `isp-ops-app`, different audiences live under distinct route prefixes (dashboard, customer portal, etc.) rather than separate standalone apps. Planned future portals (tenant self-service, external partner) will either extend these workspaces or add thin wrappers around them.

**For detailed portal architecture, see:** [PORTAL_ARCHITECTURE.md](PORTAL_ARCHITECTURE.md)

---

## 🌐 PUBLIC PAGES

### Authentication
- `/` - Landing/Home page
- `/login` - User login
- `/register` - User registration
- `/forgot-password` - Password recovery

### Testing
- `/test-plugins` - Plugin testing interface

---

## 🏢 MAIN DASHBOARD (`/dashboard`)

### 🏠 Home
- `/dashboard` - Main dashboard home

### 💰 Billing & Revenue (`/dashboard/billing-revenue`)
- `/dashboard/billing-revenue` - Billing overview
- `/dashboard/billing-revenue/invoices` - Invoice management
- `/dashboard/billing-revenue/invoices/catalog` - Product catalog
- `/dashboard/billing-revenue/invoices/subscriptions` - Subscription invoices
- `/dashboard/billing-revenue/payments` - Payment processing
- `/dashboard/billing-revenue/plans` - Pricing plans
- `/dashboard/billing-revenue/subscriptions` - Subscription management

### 🏦 Banking
- `/dashboard/banking` - Banking operations
- `/dashboard/billing` - Legacy billing (may be deprecated)

### 🔐 Security & Access (`/dashboard/security-access`)
- `/dashboard/security-access` - Security overview
- `/dashboard/security-access/api-keys` - API key management
- `/dashboard/security-access/permissions` - Permission management
- `/dashboard/security-access/roles` - Role management
- `/dashboard/security-access/secrets` - Secrets/credentials management
- `/dashboard/security-access/users` - User management

### 👥 Admin (`/dashboard/admin`)
- `/dashboard/admin/roles` - Advanced role administration

### 🤝 Partners (`/dashboard/partners`)
- `/dashboard/partners` - Partner listing
- `/dashboard/partners/[id]` - Individual partner details (dynamic route)

### 🔧 Operations (`/dashboard/operations`)
- `/dashboard/operations` - Operations overview
- `/dashboard/operations/communications` - Communication management
- `/dashboard/operations/customers` - Customer operations
- `/dashboard/operations/files` - File management

### 🏗️ Infrastructure (`/dashboard/infrastructure`)
- `/dashboard/infrastructure` - Infrastructure overview
- `/dashboard/infrastructure/feature-flags` - Feature flag management
- `/dashboard/infrastructure/health` - System health monitoring
- `/dashboard/infrastructure/imports` - Data import tools
- `/dashboard/infrastructure/logs` - Log management
- `/dashboard/infrastructure/observability` - Observability/monitoring

### 📊 Analytics
- `/dashboard/analytics` - Analytics & reporting

### 🔗 Webhooks
- `/dashboard/webhooks` - Webhook management

### ⚙️ Settings (`/dashboard/settings`)
- `/dashboard/settings` - Settings home
- `/dashboard/settings/billing` - Billing settings
- `/dashboard/settings/integrations` - Integration settings
- `/dashboard/settings/notifications` - Notification preferences
- `/dashboard/settings/organization` - Organization settings
- `/dashboard/settings/plugins` - Plugin configuration
- `/dashboard/settings/profile` - User profile settings

---

## 🏢 PLATFORM ADMIN (`/dashboard/platform-admin`)

### Platform Management
- `/dashboard/platform-admin` - Platform administration home
- `/dashboard/platform-admin/tenants` - Tenant management
- `/dashboard/platform-admin/platform-billing` - Platform billing overview
- `/dashboard/platform-admin/system` - System configuration
- `/dashboard/platform-admin/analytics` - Platform-wide analytics

**Target Users:** DotMac platform administrators
**Permission Required:** `platform:admin`

---

## 🏢 TENANT SELF-SERVICE WORKSPACE (`/tenant`) – *Planned*

### Tenant Management
- `/tenant` - Tenant overview
- `/tenant/customers` - Customer list (read-only view)
- `/tenant/billing` - Tenant billing & subscription management
- `/tenant/billing/subscription` - Plan upgrades/downgrades with proration
- `/tenant/billing/invoices` - Platform subscription invoices
- `/tenant/billing/payment-methods` - Payment method management
- `/tenant/users` - Tenant user management
- `/tenant/usage` - Usage tracking & limits
- `/tenant/integrations` - Third-party integrations
- `/tenant/support` - Tenant support tickets

**Status:** Not yet available. This section documents the intended structure so product and engineering stay aligned once implementation starts.
**Target Users:** ISP administrators managing their DotMac subscription
**Permission Required:** `tenants:read`, `platform:tenants:read`

---

## 👤 CUSTOMER PORTAL (`/customer-portal`)

### Customer Self-Service
- `/customer-portal` - Customer dashboard
- `/customer-portal/service` - Service status & connection details
- `/customer-portal/billing` - Billing & payment history
- `/customer-portal/billing/pay` - Payment processing
- `/customer-portal/usage` - Data usage tracking
- `/customer-portal/support` - Support tickets
- `/customer-portal/support/new` - Create new ticket
- `/customer-portal/settings` - Account settings
- `/customer-portal/settings/profile` - Profile management
- `/customer-portal/settings/password` - Password management

**Target Users:** End-user subscribers (ISP customers)
**Authentication:** Account number + password (separate from main auth)
**Layout:** `CustomerAuthContext` with separate navigation

---

## 🤝 PARTNER WORKSPACE (`/dashboard/partners`)

Partner management is embedded directly inside the ISP dashboard today. The workspace includes:

- `/dashboard/partners` – Partner listing & lifecycle management
- `/dashboard/partners/[id]` – Individual partner records
- `/dashboard/partners/onboarding` – Requirements checklist
- `/dashboard/partners/revenue/*` – Payouts, commissions, referral revenue
- `/dashboard/partners/managed-tenants` – MSP tenant rollup (read-only, Phase 1)

**Target Users:** Partner/Channel managers, revenue operations teams inside the ISP organization  
**Authentication:** Shares the main dashboard session; RBAC gates access via `partners.*` permissions  
**Roadmap:** Future standalone `/portal` or `/partner` domains will wrap these routes with partner-specific authentication when business needs require external access.

---

## 📂 Route Hierarchy

```
/
├── Public Routes
│   ├── / (home)
│   ├── /login
│   ├── /register
│   ├── /forgot-password
│   └── /test-plugins
│
├── /dashboard (Protected - Main Dashboard)
│   ├── / (dashboard home)
│   │
│   ├── /billing-revenue
│   │   ├── / (overview)
│   │   ├── /invoices
│   │   │   ├── / (list)
│   │   │   ├── /catalog
│   │   │   └── /subscriptions
│   │   ├── /payments
│   │   ├── /plans
│   │   └── /subscriptions
│   │
│   ├── /banking
│   ├── /billing (legacy?)
│   │
│   ├── /security-access
│   │   ├── / (overview)
│   │   ├── /api-keys
│   │   ├── /permissions
│   │   ├── /roles
│   │   ├── /secrets
│   │   └── /users
│   │
│   ├── /admin
│   │   └── /roles
│   │
│   ├── /partners
│   │   ├── / (list)
│   │   └── /[id] (detail)
│   │
│   ├── /operations
│   │   ├── / (overview)
│   │   ├── /communications
│   │   ├── /customers
│   │   └── /files
│   │
│   ├── /infrastructure
│   │   ├── / (overview)
│   │   ├── /feature-flags
│   │   ├── /health
│   │   ├── /imports
│   │   ├── /logs
│   │   └── /observability
│   │
│   ├── /analytics
│   ├── /webhooks
│   │
│   ├── /platform-admin (Platform Admin Portal)
│   │   ├── / (platform overview)
│   │   ├── /tenants
│   │   ├── /platform-billing
│   │   ├── /system
│   │   └── /analytics
│   │
│   └── /settings
│       ├── / (home)
│       ├── /billing
│       ├── /integrations
│       ├── /notifications
│       ├── /organization
│       ├── /plugins
│       └── /profile
│
├── /tenant (Planned - Tenant Self-Service Workspace)
│   ├── / (tenant overview)
│   ├── /customers
│   ├── /billing
│   │   ├── / (billing home)
│   │   ├── /subscription
│   │   ├── /invoices
│   │   └── /payment-methods
│   ├── /users
│   ├── /usage
│   ├── /integrations
│   └── /support
│
├── /customer-portal (Protected - Customer Portal)
│   ├── / (customer dashboard)
│   ├── /service
│   ├── /billing
│   │   ├── / (billing overview)
│   │   └── /pay
│   ├── /usage
│   ├── /support
│   │   ├── / (tickets list)
│   │   └── /new
│   └── /settings
│       ├── / (settings home)
│       ├── /profile
│       └── /password
│
└── /customer-portal (Protected - Customer Portal)
    ├── / (dashboard)
    ├── /service
    ├── /billing
    ├── /billing/pay
    ├── /usage
    ├── /support
    │   ├── / (ticket list)
    │   └── /new
    └── /settings
        ├── / (settings home)
        ├── /profile
        └── /password
```

---

## 🔑 Key Features by Portal

### 🏢 Main Dashboard (`/dashboard/*`)
**For:** ISP staff and administrators
**Features:** Complete billing suite, RBAC, customer operations, infrastructure management, analytics

### 🏢 Platform Admin (`/dashboard/platform-admin/*`)
**For:** DotMac platform administrators
**Features:** Multi-tenant management, platform billing, system configuration, platform-wide analytics

### 🏢 Tenant Self-Service (`/tenant/*`)
**For:** ISP administrators managing their DotMac subscription
**Features:** Subscription management with plan upgrades/downgrades, billing, usage tracking, user management, integrations

### 👤 Customer Portal (`/customer-portal/*`)
**For:** End-user subscribers (ISP customers)
**Features:** Service status, billing & payments, usage tracking, support tickets, account settings
**Auth:** Separate account number-based authentication

### 🤝 Partner Workspace (`/dashboard/partners/*`)
**For:** Partner/Channel managers inside the ISP dashboard
**Features:** Partner roster, onboarding workflows, referral revenue, commissions, managed-tenant summaries
**Auth:** Same session as main dashboard with `partners.*` permissions

### 🕒 Planned Workspaces
- **Tenant Self-Service (`/tenant/*`)** – ISP subscription & billing management
- **External Partner Portal (`/portal/*` / `/partner/*`)** – Dedicated partner-authenticated surface that will wrap the existing workspace when needed

---

## 📝 Notes

### Portal Architecture
- **Two Next.js Apps**: `isp-ops-app` (dashboard + embedded workspaces) and `platform-admin-app`
- **Main Dashboard**: `/dashboard/*` - Primary ISP operations interface
- **Platform Admin**: `/dashboard/platform-admin/*` - DotMac platform management (requires `platform:admin`)
- **Customer Portal**: `/customer-portal/*` - End-subscriber self-service (separate auth context)
- **Partner Workspace**: `/dashboard/partners/*` - Partner tooling inside the dashboard
- **Planned**: `/tenant/*` and standalone `/portal`/`/partner` routes will come online in later phases

### Authentication Flows
- **Main Dashboard & Partner Workspace**: Standard tenant-scoped JWT/session auth with RBAC permissions
- **Platform Admin**: Platform-admin app session with elevated permissions
- **Customer Portal**: Account number + password (CustomerAuthContext) separate from dashboard auth
- **Planned Tenant/External Partner Portals**: Will introduce tenant-scoped and partner-scoped auth flows respectively when implemented

### Technical Notes
- **Dynamic Routes**: `/dashboard/partners/[id]` uses Next.js dynamic routing
- **Nested Routes**: Deep nesting in billing-revenue, infrastructure, and settings sections
- **Settings**: Centralized settings hub with 7 sub-sections
- **Route Guards**: Permission-based access using RouteGuard components
- **Deployment Modes**: Workspaces can be selectively enabled based on deployment mode (single_tenant, multi_tenant, hybrid)

---

## 🎨 Layout Structure

### Root Layout (`/app/layout.tsx`)
- Base layout for entire app
- Global providers (Theme, Auth, etc.)

### Main Dashboard Layout (`/app/dashboard/layout.tsx`)
- Protected layout for main dashboard
- Sidebar navigation for ISP operations
- JWT/session authentication guards
- RBAC permission checks

### Platform Admin Layout (`/app/dashboard/platform-admin/layout.tsx`)
- Nested within dashboard layout
- Platform admin navigation
- Requires `platform:admin` permission

### Tenant Portal Layout (`/app/tenant/layout.tsx`) – *Planned*
- Will provide a dedicated layout once the workspace is implemented
- Tenant-specific navigation and guards scoped to tenant admin permissions
- Subscription management focus

### Customer Portal Layout (`/app/customer-portal/layout.tsx`)
- Separate layout for end customers
- Customer-specific navigation
- Uses `CustomerAuthContext` (separate from main auth)
- CustomerProtectedRoute guards
- Account number-based authentication

### Partner Workspace Layout
- Reuses the main dashboard layout (`/app/dashboard/layout.tsx`)
- Access controlled via partner-specific permissions
- Additional navigation sections surface when `partners.*` scopes are granted

---

## 🔗 Related Documentation

- **[PORTAL_ARCHITECTURE.md](PORTAL_ARCHITECTURE.md)** - Comprehensive portal architecture documentation with user journeys, authentication flows, and deployment modes
- **[README.md](../README.md)** - Project overview and high-level architecture
- **[API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md)** - REST API surface area summary
- **[DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md)** - Entity model and relationships

---

**Last Updated:** October 20, 2025 (updated to reflect two-app architecture)
**Workspaces Live:** Main Dashboard, Platform Admin, Customer Portal, Partner Workspace  
**Workspaces Planned:** Tenant Self-Service, External Partner Portal
