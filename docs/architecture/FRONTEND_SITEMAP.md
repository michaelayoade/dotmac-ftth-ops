# DotMac Platform Frontend Sitemap

## 📱 Application Structure

Your Next.js app has **6 portals** serving different user types: Main Dashboard, Platform Admin, Tenant Self-Service, Customer Portal, Partner Referral Portal, and Partner Reseller Portal.

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

## 🏢 TENANT SELF-SERVICE PORTAL (`/tenant`)

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

## 🤝 PARTNER REFERRAL PORTAL (`/portal`)

### Authentication
- `/portal/login` - Partner login

### Portal Pages
- `/portal/dashboard` - Partner dashboard
- `/portal/referrals` - Referral management
- `/portal/commissions` - Commission tracking & earnings
- `/portal/customers` - Referred customer list
- `/portal/performance` - Performance metrics
- `/portal/settings` - Partner settings

**Target Users:** Sales partners, affiliates, referral partners
**Business Model:** Commission-based revenue share on referrals
**Permission Required:** Partner-specific auth (separate from main system)

---

## 🤝 PARTNER RESELLER PORTAL (`/partner`)

### MSP/Reseller Management
- `/partner` - Partner overview
- `/partner/tenants` - Managed ISP tenants
- `/partner/billing` - Partner billing & revenue
- `/partner/resources` - Partner enablement resources
- `/partner/support` - Partner support tickets

**Target Users:** MSPs, resellers managing multiple ISP tenants
**Business Model:** Wholesale/reseller pricing model
**Permission Required:** `partners.read`, `platform:partners:read`

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
├── /tenant (Protected - Tenant Self-Service Portal)
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
├── /portal (Protected - Partner Referral Portal)
│   ├── /login
│   ├── /dashboard
│   ├── /referrals
│   ├── /commissions
│   ├── /customers
│   ├── /performance
│   └── /settings
│
└── /partner (Protected - Partner Reseller Portal)
    ├── / (partner overview)
    ├── /tenants
    ├── /billing
    ├── /resources
    └── /support
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

### 🤝 Partner Referral Portal (`/portal/*`)
**For:** Sales partners and affiliates
**Features:** Referral tracking, commission management, referred customer list, performance analytics
**Model:** Commission-based revenue share

### 🤝 Partner Reseller Portal (`/partner/*`)
**For:** MSPs and resellers managing multiple ISP tenants
**Features:** Multi-tenant management, partner billing, enablement resources, partner support
**Model:** Wholesale/reseller pricing

---

## 📝 Notes

### Portal Architecture
- **Single Next.js App**: All 6 portals in one monolith with route-based separation
- **Main Dashboard**: `/dashboard/*` - Primary ISP operations interface
- **Platform Admin**: `/dashboard/platform-admin/*` - DotMac platform management (requires `platform:admin`)
- **Tenant Portal**: `/tenant/*` - ISP self-service for DotMac subscription management
- **Customer Portal**: `/customer-portal/*` - End-subscriber self-service (separate auth)
- **Partner Referral**: `/portal/*` - Sales partner commission tracking (separate auth)
- **Partner Reseller**: `/partner/*` - MSP multi-tenant management

### Authentication Flows
- **Main Dashboard & Platform Admin**: Standard JWT/session auth with RBAC permissions
- **Tenant Portal**: Tenant-scoped auth with tenant admin permissions
- **Customer Portal**: Account number + password (CustomerAuthContext - separate from main auth)
- **Partner Referral Portal**: Partner-specific authentication (separate login)
- **Partner Reseller Portal**: Partner permissions (`partners.read`, `platform:partners:read`)

### Technical Notes
- **Dynamic Routes**: `/dashboard/partners/[id]` uses Next.js dynamic routing
- **Nested Routes**: Deep nesting in billing-revenue, infrastructure, and settings sections
- **Settings**: Centralized settings hub with 7 sub-sections
- **Route Guards**: Permission-based access using RouteGuard components
- **Deployment Modes**: Portals can be selectively enabled based on deployment mode (single_tenant, multi_tenant, hybrid)

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

### Tenant Portal Layout (`/app/tenant/layout.tsx`)
- Separate layout for tenant self-service
- Tenant-specific navigation
- RouteGuard with `tenants:read` or `platform:tenants:read` permissions
- Subscription management focus

### Customer Portal Layout (`/app/customer-portal/layout.tsx`)
- Separate layout for end customers
- Customer-specific navigation
- Uses `CustomerAuthContext` (separate from main auth)
- CustomerProtectedRoute guards
- Account number-based authentication

### Partner Referral Layout (`/app/portal/layout.tsx`)
- Separate layout for referral partners
- Partner navigation (dashboard, referrals, commissions)
- Partner-specific authentication flow
- Commission tracking focus

### Partner Reseller Layout (`/app/partner/layout.tsx`)
- Separate layout for reseller partners
- Reseller navigation (tenants, billing, resources)
- RouteGuard with `partners.read` or `platform:partners:read` permissions
- Multi-tenant management focus

---

## 🔗 Related Documentation

- **[PORTAL_ARCHITECTURE.md](PORTAL_ARCHITECTURE.md)** - Comprehensive portal architecture documentation with user journeys, authentication flows, and deployment modes
- **[README.md](../README.md)** - Project overview and high-level architecture
- **[API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md)** - REST API surface area summary
- **[DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md)** - Entity model and relationships

---

**Last Updated:** October 20, 2025
**Portal Count:** 6 portals (Main Dashboard, Platform Admin, Tenant Self-Service, Customer Portal, Partner Referral, Partner Reseller)
