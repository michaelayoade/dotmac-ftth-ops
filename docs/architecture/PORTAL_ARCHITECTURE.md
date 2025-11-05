# DotMac Platform - Portal Architecture

**Last Updated:** October 20, 2025
**Status:** Production
**Version:** 1.0

---

## 📱 Overview

The DotMac ISP Operations Platform consists of **6 distinct portals** serving different user types across the ISP ecosystem. Each portal has its own authentication, authorization, and user interface tailored to specific workflows.

### Architecture Decision

We use a **single Next.js monolith** with route-based separation rather than separate applications. This provides:
- ✅ Code reuse across portals
- ✅ Simplified deployment
- ✅ Shared component library
- ✅ Single authentication provider
- ✅ Easier maintenance

---

## 🎯 Portal Matrix

| # | Portal Name | Route | Target Users | Auth Type | Purpose |
|---|-------------|-------|--------------|-----------|---------|
| 1 | **Main Dashboard** | `/dashboard/*` | ISP Staff | JWT/Session | Day-to-day ISP operations |
| 2 | **Platform Admin** | `/dashboard/platform-admin/*` | DotMac Admins | Platform permissions | Multi-tenant platform administration |
| 3 | **Tenant Self-Service** | `/tenant/*` | ISP Administrators | Tenant permissions | Manage DotMac subscription & billing |
| 4 | **Customer Portal** | `/customer-portal/*` | End Subscribers | Customer auth | Internet account self-service |
| 5 | **Partner Portal (Referral)** | `/portal/*` | Sales Partners | Partner auth | Customer referrals & commissions |
| 6 | **Partner Portal (Reseller)** | `/partner/*` | MSPs/Resellers | Partner permissions | Multi-tenant reseller management |

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

## 3️⃣ Tenant Self-Service Portal (`/tenant/*`)

### **Target Users**
- ISP Administrators
- ISP Billing Managers
- ISP IT Staff

### **Purpose**
ISP tenants manage their own DotMac platform subscription:
- View/upgrade subscription plans
- Manage billing & payment methods
- Track usage & quotas
- Manage ISP staff users
- Configure integrations

### **Key Features**
```
/tenant
├── /                       # Overview & stats
├── /billing
│   ├── /subscription      # Plan management & upgrades
│   ├── /addons            # Add-on services
│   ├── /payment-methods   # Payment cards
│   ├── /receipts          # Invoice history
│   ├── /credit-notes      # Credits & refunds
│   └── /usage             # Usage-based billing
├── /customers             # Customer accounts (ISP's customers)
├── /users                 # ISP staff user management
├── /usage                 # Platform usage & limits
├── /integrations          # Webhooks & APIs
└── /support               # Contact DotMac support
```

### **Authentication**
- Tenant-scoped authentication
- Permissions: `tenants:read`, `platform:tenants:read`
- Uses TenantSelector for MSPs managing multiple ISPs

### **Billing Features**
```typescript
// Subscription management
- View current plan (Starter/Professional/Enterprise)
- Preview plan changes with proration
- Upgrade/downgrade with immediate effect
- Manage add-ons (Advanced Analytics, Premium Support)
- Update payment methods
- Download invoices
```

### **User Journey Example - "Fast Fiber ISP"**
1. Fast Fiber admin logs in
2. Views subscription at `/tenant/billing/subscription`
   - Current: Professional Plan ($299/month)
   - Usage: 45,000 API calls of 100,000 limit
3. Clicks "Upgrade Plan"
4. Compares Enterprise Plan features
5. Previews prorated charge: $150 for remaining days
6. Confirms upgrade
7. Enables "Advanced Analytics" add-on (+$99/month)
8. Updates credit card at `/tenant/billing/payment-methods`

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

## 5️⃣ Partner Portal - Referral (`/portal/*`)

### **Target Users**
- Sales Affiliates
- Referral Partners
- Local Businesses referring customers
- Marketing Partners

### **Purpose**
Partners refer end customers to the ISP and earn commissions:
- Track customer referrals
- View commission earnings
- Monitor referral performance
- Manage partner profile

### **Key Features**
```
/portal
├── /login          # Partner authentication
├── /dashboard      # Overview & earnings
├── /referrals      # Referral tracking
├── /commissions    # Commission details
├── /customers      # Referred customers
├── /performance    # Performance metrics
└── /settings       # Partner profile
```

### **Authentication**
- Separate partner authentication
- Partner-specific login flow
- API endpoint: `/api/v1/partners/portal/profile`

### **Commission Model**
```typescript
// Backend: partner_management/models.py
enum CommissionModel {
  REVENUE_SHARE   // Percentage of customer revenue
  FLAT_FEE        // Fixed amount per referral
  TIERED          // Volume-based rates
  HYBRID          // Combination
}
```

### **User Journey Example - "Bob's Business Referrals"**
1. Bob logs in at `/portal/login`
2. Views dashboard:
   - Total referrals: 47 customers
   - This month: 8 new customers
   - Earnings: $1,240 (pending payout)
3. Checks `/portal/referrals` for recent conversions
4. Reviews `/portal/commissions` for payout history
5. Downloads referral link for social media

---

## 6️⃣ Partner Portal - Reseller (`/partner/*`)

### **Target Users**
- Managed Service Providers (MSPs)
- White-label Resellers
- System Integrators
- Platform Resellers

### **Purpose**
Partners manage multiple ISP tenants on the DotMac platform:
- Oversee multiple ISP clients
- Manage tenant subscriptions
- White-label platform for clients
- Access enablement resources

### **Key Features**
```
/partner
├── /                  # Partner overview
├── /tenants           # Managed ISP tenants
├── /billing           # Partner billing (reseller fees)
├── /resources         # Enablement materials
└── /support           # Partner support channel
```

### **Authentication**
- Permission-based access
- Permissions: `partners:read`, `platform:partners:read`

### **Use Cases**
1. **MSP Managing Multiple ISPs:**
   - "Cloud Solutions Inc" manages 15 ISP clients
   - Each ISP is a separate tenant
   - MSP pays wholesale rates, charges clients retail

2. **White-label Reseller:**
   - "BrandedISP Solutions" resells platform as their own
   - Custom branding per client
   - Handles client support

### **User Journey Example - "TechPartners MSP"**
1. TechPartners admin logs in
2. Views `/partner/tenants`:
   - Fast Fiber ISP (Active, 500 subscribers)
   - City Wireless (Active, 1,200 subscribers)
   - Rural Connect (Suspended, payment issue)
3. Clicks tenant to view details
4. Accesses enablement resources at `/partner/resources`
5. Downloads API documentation and integration guides

---

## 🔐 Authentication & Authorization

### Authentication Methods by Portal

| Portal | Auth Method | Login Route | Session Type |
|--------|-------------|-------------|--------------|
| Main Dashboard | JWT/Session | `/login` | Standard user session |
| Platform Admin | JWT + Platform permissions | `/login` | Admin session |
| Tenant Portal | JWT + Tenant permissions | `/login` (tenant-scoped) | Tenant session |
| Customer Portal | Customer auth | `/customer-portal/login` | Customer session |
| Partner (Referral) | Partner auth | `/portal/login` | Partner session |
| Partner (Reseller) | JWT + Partner permissions | `/login` (partner-scoped) | Partner session |

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

```
app/
├── layout.tsx                           # Root layout (theme, auth providers)
├── login/page.tsx                       # Main app login
│
├── dashboard/
│   ├── layout.tsx                       # Main dashboard layout (sidebar nav)
│   ├── page.tsx                         # Dashboard home
│   ├── platform-admin/
│   │   ├── layout.tsx                   # Platform admin layout
│   │   └── [pages]
│   └── [other sections]
│
├── tenant/
│   ├── layout.tsx                       # Tenant portal layout
│   └── [pages]
│
├── customer-portal/
│   ├── layout.tsx                       # Customer portal layout
│   ├── login/page.tsx                   # Customer login
│   └── [pages]
│
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
- Portal: `/tenant/*`
- Manages Fast Fiber's DotMac subscription
- Pays $299/month for Professional plan
- Monitors: 45,000 API calls used (limit: 100,000)
- Upgrades to Enterprise plan for more capacity

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
| **Manages Subscribers** | ✅ | ❌ | View only | Own account | View referred | ❌ |
| **Platform Billing** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Internet Billing** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Multi-tenant Admin** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Commission Tracking** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Usage Quotas** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Support Tickets** | ✅ Create/Manage | ❌ | Submit to DotMac | Submit to ISP | ❌ | Submit to DotMac |

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

The DotMac platform's 6-portal architecture provides:

✅ **Clear separation of concerns** - Each user type has dedicated workflows
✅ **Scalable architecture** - Easy to add new portals
✅ **Security by design** - Permission-based access control
✅ **User experience** - Tailored UIs for each persona
✅ **Code reuse** - Single codebase with shared components
✅ **Flexibility** - Supports multiple deployment modes

This architecture mirrors successful B2B2C SaaS platforms like Stripe, Shopify, and Twilio, providing a complete ecosystem for ISP operations.

---

**For Implementation Details:**
- See [FRONTEND_SITEMAP.md](./FRONTEND_SITEMAP.md) for complete route listing
- See [TENANT_ONBOARDING_IMPLEMENTATION.md](../TENANT_ONBOARDING_IMPLEMENTATION.md) for tenant setup
- See [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) for backend API reference
