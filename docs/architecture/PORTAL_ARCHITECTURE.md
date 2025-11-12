# DotMac Platform - Portal Architecture

**Last Updated:** November 8, 2025
**Status:** Production
**Version:** 1.1

---

## 📱 Overview

DotMac currently deploys **two Next.js applications** with **5 live workspaces**:

- `frontend/apps/isp-ops-app` – ISP Operations UI that contains the operator dashboard plus embedded workspaces for partners and end customers.
- `frontend/apps/platform-admin-app` – DotMac corporate administration UI with tenant self-service portal.

What earlier roadmaps called "portals" now live as discrete **workspaces** inside these apps. They share authentication plumbing and deployment pipelines but keep navigation, RBAC, and context isolated per audience.

**Live Workspaces (5):**
1. Main Dashboard - ISP operations (`isp-ops-app`)
2. Partner Workspace - Partner management (`isp-ops-app`)
3. Customer Portal - End subscriber self-service (`isp-ops-app`)
4. Platform Admin - DotMac platform oversight (`platform-admin-app`)
5. **Tenant Portal - ISP admin self-service** (`platform-admin-app`) ✅ **NEW**

**Planned Workspaces (2):**
6. External Partner Portal - Referral partner portal (future)
7. MSP Reseller Portal - Multi-tenant partner management (future)

### Architecture Decision

We use shared apps with route-based separation rather than standalone portals. This provides:
- ✅ Code reuse across workspaces
- ✅ Simplified deployment (two artifacts)
- ✅ Shared component library
- ✅ Single authentication provider per app
- ✅ Easier maintenance and onboarding

---

## 🎯 Workspace Matrix

| # | Workspace | Route Prefix | App | Target Users | Auth Context | Status |
|---|-----------|--------------|-----|--------------|--------------|--------|
| 1 | **Main Dashboard** | `/dashboard/*` | isp-ops-app | ISP staff | Tenant-scoped JWT/session | ✅ Live |
| 2 | **Partner Workspace** | `/dashboard/partners/*` | isp-ops-app | Partner managers inside ISP org | Tenant session + partner permissions | ✅ Live |
| 3 | **Customer Portal** | `/customer-portal/*` | isp-ops-app | End subscribers | Customer auth token (CustomerAuthContext) | ✅ Live |
| 4 | **Platform Admin** | `/dashboard/platform-admin/*` | platform-admin-app | DotMac admins | Platform permissions | ✅ Live |
| 5 | **Tenant Self-Service** | `/tenant-portal/*` | platform-admin-app | ISP admins & billing managers | Tenant-scoped session | ✅ Live |
| 6 | **External Partner Portal** | `/portal/*` / `/partner/*` (planned) | TBA | Referral partners / MSPs | Dedicated partner auth | 🕒 Planned |

---

## 1️⃣ Main Dashboard (`/dashboard/*`)

### **Target Users**
- ISP Staff (Customer service representatives)
- ISP Managers
- ISP Technical Support
- ISP Billing Department

### **Purpose**
Day-to-day operations for running the ISP business:
- Customer management (subscribers)
- Billing and invoicing
- Support ticket handling
- Network monitoring
- Service provisioning

### **Key Features**
```
/dashboard
├── /billing-revenue        # Invoice & payment management
├── /operations/customers   # Subscriber accounts
├── /security-access        # User & permission management
├── /infrastructure         # System health & monitoring
├── /analytics              # Business intelligence
├── /partners               # Partner relationship management
└── /settings               # Organization configuration
```

### **Authentication**
- Standard JWT/session authentication
- Role-based access control (RBAC)
- Permissions: `customers:read`, `billing:write`, etc.

### **User Journey Example**
1. ISP staff logs in at `/login`
2. Views subscriber list at `/dashboard/operations/customers`
3. Opens customer detail, checks service status
4. Creates support ticket for network issue
5. Generates invoice at `/dashboard/billing-revenue/invoices`

---

## 2️⃣ Platform Admin Portal (`/dashboard/platform-admin/*`)

### **Target Users**
- DotMac Platform Administrators
- DotMac Support Team
- Platform Engineers

### **Purpose**
Multi-tenant platform administration and oversight:
- Tenant management (create/suspend ISPs)
- Cross-tenant search
- System configuration
- Audit log review
- Platform-wide analytics

### **Key Features**
```
/dashboard/platform-admin
├── /tenants       # ISP tenant management
├── /search        # Cross-tenant search
├── /audit         # Audit logs & compliance
├── /system        # Platform configuration
└── /page          # Platform metrics dashboard
```

### **Authentication**
- Requires platform-level permissions
- Permissions: `platform:tenants:write`, `platform:audit:read`

### **Access Control**
```typescript
// Permission guard example
<RouteGuard permission={["platform:tenants:read"]}>
  <TenantManagement />
</RouteGuard>
```

### **User Journey Example**
1. DotMac admin logs in
2. Views tenant list at `/dashboard/platform-admin/tenants`
3. Checks tenant health metrics
4. Searches across all tenants for a specific customer
5. Reviews audit logs for compliance

---

## 3️⃣ Tenant Self-Service Portal (`/tenant-portal/*`)

> **Status:** ✅ **Live in Production** - Available in `platform-admin-app` for ISP admins to manage their DotMac subscription, licenses, and support.

### **Target Users**
- ISP Administrators
- ISP Billing Managers
- ISP IT Staff

### **Purpose**
ISP tenants manage their own DotMac platform subscription:
- Manage license seat allocation
- View/upgrade subscription plans
- Manage billing & payment methods
- Track usage & quotas
- Manage ISP staff users
- Configure integrations
- Submit support tickets to DotMac

### **Key Features**
```
/tenant-portal
├── /                       # Overview dashboard & stats
├── /licenses               # License seat management by role (Admin/Operator/Read-only)
├── /billing
│   ├── /subscription       # Plan management & upgrades
│   ├── /addons             # Add-on services
│   ├── /payment-methods    # Payment cards
│   ├── /receipts           # Invoice history
│   ├── /credit-notes       # Credits & refunds
│   └── /usage              # Usage-based billing
├── /users                  # ISP staff user management
├── /integrations           # Webhooks & API configuration
└── /support                # Support tickets to DotMac platform team
```

> **Security Note:** The tenant portal does NOT expose ISP customer data. For managing internet subscribers, ISP staff use the Main Dashboard (`/dashboard/operations/customers`).

### **Authentication**
- Tenant-scoped authentication
- Permissions: `tenants:read`, `platform:tenants:read`
- Uses TenantSelector for MSPs managing multiple ISPs

### **License Management Features**
```typescript
// Seat allocation by role
- Admin seats (10% - Platform configuration access)
- Operator seats (60% - Day-to-day operations)
- Read-only seats (30% - View-only access)
- Visual progress bars showing seat utilization
- Feature module breakdown by category
- Subscription plan details (cycle, cost, period)
```

### **Billing Features**
```typescript
// Subscription management
- View current plan (Starter/Professional/Enterprise)
- Preview plan changes with proration
- Upgrade/downgrade with immediate effect
- Manage add-ons (Advanced Analytics, Premium Support)
- Update payment methods
- Download invoices and receipts
- View credit notes and refunds
- Track usage-based billing
```

### **User Journey Example - "Fast Fiber ISP"**
1. Fast Fiber admin logs in at `/login` (platform-admin-app)
2. Navigates to `/tenant-portal` dashboard
   - Views subscription summary
   - Checks license seat allocation: 45 of 50 seats used
3. Clicks "Licenses" to review seat distribution
   - Admin: 5 seats (10%)
   - Operator: 30 seats (60%)
   - Read-only: 15 seats (30%)
4. Navigates to `/tenant-portal/billing/subscription`
   - Current: Professional Plan ($299/month)
   - Billing cycle: Monthly
   - Next payment: December 1, 2025
5. Reviews enabled feature modules
   - Advanced Analytics ✓
   - Multi-vendor RADIUS support ✓
   - IPv6 management ✓
6. Clicks "Support" to submit ticket to DotMac platform team
7. Views invoice history at `/tenant-portal/billing/receipts`

---

## 4️⃣ Customer Portal (`/customer-portal/*`)

### **Target Users**
- Residential Internet Subscribers
- Business Internet Customers
- End users of the ISP's services

### **Purpose**
Self-service portal for ISP's end customers:
- View/pay internet bills
- Check data usage
- Manage account details
- Submit support tickets
- View service status

### **Key Features**
```
/customer-portal
├── /              # Dashboard (service status, usage, bills)
├── /service       # Service plan & details
├── /billing       # Invoices & payments
├── /usage         # Data usage statistics
├── /support       # Submit tickets & help
└── /settings      # Account preferences
```

### **Authentication**
- Separate customer authentication (CustomerAuthContext)
- Account number + password
- Separate login: `/customer-portal/login`

### **Dashboard Components**
- ✅ Service status (Active/Suspended)
- ✅ Current balance
- ✅ Data usage with progress bar
- ✅ Next billing date countdown
- ✅ Recent support tickets
- ✅ Quick actions (Pay bill, report issue)

### **User Journey Example - "John Doe, Fast Fiber Customer"**
1. John visits `fastfiber.com` → redirects to customer portal
2. Logs in at `/customer-portal/login` (account #12345)
3. Views dashboard:
   - Service: Active (100 Mbps plan)
   - Usage: 450 GB of 1000 GB (45%)
   - Balance: $89.99 due in 5 days
4. Clicks "View Usage" → sees daily/hourly charts
5. Pays bill at `/customer-portal/billing`
6. Submits ticket: "Slow speeds in evening"

---

## 5️⃣ Partner Workspace (`/dashboard/partners/*`)

### **Target Users**
- Partner managers within the ISP tenant
- Revenue operations teams
- MSP coordinators preparing for multi-tenant access

### **Purpose**
Provide partner management, referral tracking, and revenue insights **inside** the ISP dashboard without requiring a separate app.

### **Key Features**
```
/dashboard/partners
├── /                    # Partner roster & lifecycle
├── /onboarding          # Checklists and requirements
├── /revenue             # Aggregate revenue, payouts, commissions
├── /revenue/commissions # Detailed ledger
├── /managed-tenants     # MSP tenant rollups (Phase 1 read-only)
└── /[id]                # Partner profile & activity
```

### **Authentication**
- Reuses ISP dashboard authentication (`isp-ops-app`)
- RBAC controls (e.g., `partners.read`, `partners.manage`, `partners.revenue.read`)
- No standalone `/portal` login yet; that remains on the roadmap

### **Use Cases**
1. **Revenue Ops:** Review commission payouts for the month via `/dashboard/partners/revenue`.
2. **Partner Success:** Track onboarding milestones using `/dashboard/partners/onboarding`.
3. **MSP Preview:** View managed tenants at `/dashboard/partners/managed-tenants` before releasing full cross-tenant switching.

> **Roadmap:** Dedicated external partner portals (`/portal/*`, `/partner/*`) will eventually wrap these routes with partner-specific auth and branding. Until then, stakeholders should rely on the in-app workspace documented here.

---

## 🔐 Authentication & Authorization

### Authentication Methods by Workspace

| Workspace | App | Auth Method | Entry Route | Session Context | Status |
|-----------|-----|-------------|-------------|-----------------|--------|
| Main Dashboard | isp-ops-app | Tenant-scoped JWT/session | `/login` | ISP operator session | Live |
| Partner Workspace | isp-ops-app | Same as dashboard + partner RBAC | `/login` then `/dashboard/partners` | ISP operator session | Live |
| Customer Portal | isp-ops-app | Customer auth token (CustomerAuthContext) | `/customer-portal/login` | Customer session | Live |
| Platform Admin | platform-admin-app | JWT + platform permissions | `/login` (platform-admin app) | Platform admin session | Live |
| Tenant Self-Service | platform-admin-app | Tenant-scoped JWT/session | `/login` → `/tenant-portal/*` | ISP tenant session | Live |
| External Partner Portal | TBA | Dedicated partner auth | `/portal/login` (future) | Partner session | Planned |

### Permission Hierarchy

```
platform:*                  # Platform admins only
├── platform:tenants:read
├── platform:tenants:write
├── platform:audit:read
└── platform:system:write

tenants:*                   # Tenant admins
├── tenants:read
├── tenants:billing:write
└── tenants:users:write

partners:*                  # Partner permissions
├── partners:read
├── partners:tenants:read
└── partners:commissions:read

customers:*                 # ISP operations
├── customers:read
├── customers:write
├── billing:write
└── support:write
```

---

## 🎨 Layout & Navigation Structure

### Layout Hierarchy

**isp-ops-app:**
```
app/
├── layout.tsx                           # Root layout (theme, auth providers)
├── login/page.tsx                       # Main app login
│
├── dashboard/
│   ├── layout.tsx                       # Main dashboard layout (sidebar nav)
│   ├── page.tsx                         # Dashboard home
│   ├── operations/customers/
│   │   ├── page.tsx                     # Customer list (ISP subscribers)
│   │   └── [id]/                        # Customer 360° detail pages
│   ├── partners/
│   │   ├── layout.tsx                   # Partner workspace layout
│   │   └── [pages]
│   └── [other sections]
│
└── customer-portal/
    ├── layout.tsx                       # Customer portal layout
    ├── login/page.tsx                   # Customer login
    └── [pages]
```

**platform-admin-app:**
```
app/
├── layout.tsx                           # Root layout (theme, auth providers)
├── login/page.tsx                       # Platform admin login
│
├── dashboard/platform-admin/
│   ├── layout.tsx                       # Platform admin layout
│   └── [pages]                          # Tenant management, audit logs, etc.
│
└── tenant-portal/                       # ✅ Live
    ├── layout.tsx                       # Tenant portal layout
    ├── page.tsx                         # Overview dashboard
    ├── licenses/page.tsx                # License seat management
    ├── billing/                         # Subscription & billing
    ├── users/page.tsx                   # Staff user management
    ├── integrations/page.tsx            # Webhooks & APIs
    └── support/page.tsx                 # DotMac support tickets
```

**Future portals (planned):**
```
├── portal/                              # Partner referral portal
│   ├── layout.tsx
│   ├── login/page.tsx
│   └── [pages]
│
└── partner/                             # Partner reseller portal
    ├── layout.tsx
    └── [pages]
```

### Shared Components

All portals share:
- `@dotmac/primitives` - UI components
- `@dotmac/headless` - Hooks & logic
- Theme system (light/dark mode)
- Notification system (Sonner toasts)

---

## 🚀 Real-World Scenario: Complete Ecosystem

### **Scenario:** Fast Fiber ISP using DotMac Platform

**Actors:**
1. **DotMac** - Platform provider
2. **Fast Fiber ISP** - Tenant (ISP company)
3. **John Doe** - End subscriber
4. **TechPartners MSP** - Reseller managing Fast Fiber
5. **Bob's Business** - Referral partner

**Portal Usage:**

#### 1. **TechPartners MSP** (Reseller)
- Portal: `/partner/*`
- Manages Fast Fiber as one of 15 ISP clients
- Monitors Fast Fiber's platform usage
- Pays wholesale rates to DotMac

#### 2. **Fast Fiber Admins** (Tenant)
- Portal: `/tenant-portal/*` (platform-admin-app)
- Manages Fast Fiber's DotMac subscription
- Manages license seat allocation (50 seats)
- Pays $299/month for Professional plan
- Monitors usage quotas and feature modules
- Upgrades plan or adds feature modules as needed

#### 3. **Fast Fiber Staff** (ISP Operations)
- Portal: `/dashboard/*`
- Manages 500 internet subscribers
- Processes billing, handles support tickets
- Provisions new fiber connections
- Monitors OLT/ONU devices

#### 4. **Bob's Business** (Referral Partner)
- Portal: `/portal/*`
- Refers customers to Fast Fiber
- Earns 15% commission on first 12 months
- Has referred 47 customers total

#### 5. **John Doe** (End Subscriber)
- Portal: `/customer-portal/*`
- Fast Fiber customer with 100 Mbps plan
- Pays $89.99/month
- Checks data usage, pays bills online
- Submits support tickets

#### 6. **DotMac Platform Admins**
- Portal: `/dashboard/platform-admin/*`
- Oversees all ISP tenants
- Manages Fast Fiber's account
- Reviews platform-wide metrics
- Provides support to TechPartners MSP

---

## 📊 Deployment Modes

The platform supports multiple deployment modes via `DEPLOYMENT_MODE` environment variable:

### **1. Single-Tenant Mode**
```bash
DEPLOYMENT_MODE=single_tenant
SINGLE_TENANT_ID=fast-fiber-isp
```
- One ISP, dedicated deployment
- No tenant portal needed
- Platform admin routes disabled

### **2. Multi-Tenant Mode**
```bash
DEPLOYMENT_MODE=multi_tenant
```
- Multiple ISPs on shared infrastructure
- All portals enabled
- Tenant isolation enforced

### **3. Hybrid Mode**
```bash
DEPLOYMENT_MODE=hybrid
ENABLE_PLATFORM_ROUTES=true
```
- Flexible deployment
- Can toggle platform admin routes
- Used for staging/testing

---

## 🔍 Portal Comparison

| Feature | Main Dashboard | Platform Admin | Tenant Portal | Customer Portal | Partner (Referral) | Partner (Reseller) |
|---------|----------------|----------------|---------------|-----------------|-------------------|-------------------|
| **Manages ISP Operations** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manages Subscribers** | ✅ | ❌ | ❌ (Security: No ISP customer data) | Own account | View referred | ❌ |
| **License Seat Management** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Platform Billing** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ (Planned) |
| **Internet Billing** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Multi-tenant Admin** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ (Planned) |
| **Commission Tracking** | ❌ | ❌ | ❌ | ❌ | ✅ (Planned) | ❌ |
| **Usage Quotas** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Support Tickets** | ✅ Create/Manage | ❌ | ✅ Submit to DotMac | ✅ Submit to ISP | ❌ | Submit to DotMac (Planned) |

---

## 📝 Developer Notes

### Adding a New Portal

If you need to add a 7th portal:

1. **Create a dedicated app workspace (copy one of the existing apps as a template) and scaffold the route structure:**
   ```bash
   mkdir -p frontend/apps/new-portal-app/app/new-portal
   ```

2. **Add layout:**
   ```typescript
   // app/new-portal/layout.tsx
   export default function NewPortalLayout({ children }) {
     return (
       <RouteGuard permission={["new:portal:read"]}>
         {/* Navigation & layout */}
         {children}
       </RouteGuard>
     );
   }
   ```

3. **Add to documentation:**
   - Update this file (PORTAL_ARCHITECTURE.md)
   - Update FRONTEND_SITEMAP.md
   - Add user journey examples

### Testing Portal Access

```typescript
// Test matrix
describe("Portal Access Control", () => {
  it("ISP staff cannot access platform admin", async () => {
    await login("isp-staff@fastfiber.com");
    await navigate("/dashboard/platform-admin");
    expect(page).toShowAccessDenied();
  });

  it("Customers cannot access ISP dashboard", async () => {
    await login("john@example.com", "customer");
    await navigate("/dashboard");
    expect(page).toRedirect("/customer-portal");
  });
});
```

---

## 🎯 Summary

The DotMac platform's multi-workspace architecture (5 live + 2 planned) provides:

✅ **Clear separation of concerns** - Each user type has dedicated workflows
✅ **Scalable architecture** - Easy to add new portals
✅ **Security by design** - Permission-based access control with tenant isolation
✅ **User experience** - Tailored UIs for each persona
✅ **Code reuse** - Single codebase with shared components
✅ **Flexibility** - Supports multiple deployment modes

**Recent Updates (v1.1):**
- ✅ Tenant Self-Service Portal now live in production
- ✅ License seat management by role (Admin/Operator/Read-only)
- ✅ Security enhancement: ISP customer data properly isolated from tenant portal
- ✅ Customer 360° detail page with comprehensive subscriber information

This architecture mirrors successful B2B2C SaaS platforms like Stripe, Shopify, and Twilio, providing a complete ecosystem for ISP operations.

---

**For Implementation Details:**
- See [FRONTEND_SITEMAP.md](./FRONTEND_SITEMAP.md) for complete route listing
- See [TENANT_ONBOARDING_IMPLEMENTATION.md](../TENANT_ONBOARDING_IMPLEMENTATION.md) for tenant setup
- See [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) for backend API reference
