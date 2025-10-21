# Portal Route Structure - Proper Naming Convention

**Date:** October 20, 2025
**Status:** 🚧 PROPOSAL
**Issue:** Routes don't clearly describe which portal you're in

---

## Executive Summary

**Problem:** Current route structure is confusing:
- `/dashboard/*` serves ISP Staff operations (should be `/isp/*`)
- `/dashboard/platform-admin/*` serves Platform Admins (should be `/platform/*`)
- `/tenant/*` is correct (Tenant Self-Service)
- `/customer-portal/*` is correct (Customer Portal)
- `/portal/*` and `/partner/*` have unclear distinction

**Solution:** Routes should clearly indicate the portal and user type.

---

## Current Route Structure (Confusing)

### ❌ PROBLEMS

```
/dashboard/*
├─ What portal is this? ISP? Platform? Unclear.
├─ Actually serves: ISP Staff operations
└─ Should be called: /isp/* or /isp-operations/*

/dashboard/platform-admin/*
├─ Why is Platform Admin nested under "dashboard"?
├─ Platform Admin is a SEPARATE portal
├─ Should be: /platform/* (top-level)

/admin/*
├─ What is this? Duplicate of platform-admin?
├─ Appears to be unused or redundant
└─ Should be: Removed or clarified

/portal/*
├─ "Portal" is too generic
├─ Actually serves: Partner Portal (Referral)
└─ Should be: /partner-referral/* or /referral-portal/*

/partner/*
├─ Which kind of partner? Referral or Reseller?
├─ Actually serves: Partner Portal (Reseller/MSP)
└─ Should be: /partner-reseller/* or /msp-portal/*
```

---

## ✅ PROPOSED Route Structure (Clear)

### Design Principles

1. **Route = Portal Identity**
   - Route should immediately tell you which portal you're in
   - No nesting of distinct portals under generic names

2. **User Type Clarity**
   - Route should indicate the user type (platform admin, ISP staff, customer, etc.)
   - No ambiguous names like "dashboard" or "admin"

3. **Hierarchy Clarity**
   - Route should indicate the operational level (platform vs. ISP)
   - Platform-level portals: `/platform/*`, `/platform-reseller/*`
   - ISP-level portals: `/isp/*`, `/isp-reseller/*`
   - Customer-level portals: `/customer/*`

4. **Consistency**
   - All portals at same level (no nested portals)
   - Similar naming convention across all portals

5. **Future-Proof**
   - Easy to add new portals
   - Clear namespace separation

---

## Proposed Route Map

### Option A: Hierarchy-Based (RECOMMENDED)

```
PLATFORM LEVEL (DotMac Platform Operations)
─────────────────────────────────────────────
/platform/*               Platform Admin Portal (DotMac Admins)
├─ /platform/tenants      Manage all ISP tenants
├─ /platform/audit        Platform-wide audit logs
├─ /platform/versioning   API versioning
├─ /platform/health       System health
├─ /platform/billing      Platform revenue
└─ /platform/settings     Platform settings

/platform-reseller/*      Platform Reseller Portal (MSPs selling ISP platform)
├─ /platform-reseller/tenants        ISP tenants they manage
├─ /platform-reseller/billing        Their revenue from ISPs
├─ /platform-reseller/resources      Sales enablement
├─ /platform-reseller/support        Support for their ISPs
└─ /platform-reseller/settings       Reseller settings

ISP LEVEL (Individual ISP Operations)
─────────────────────────────────────────────
/isp/*                    ISP Operations Portal (ISP Staff)
├─ /isp/subscribers       End customer management
├─ /isp/network           Network infrastructure
├─ /isp/billing           Customer billing
├─ /isp/crm               Sales & marketing
├─ /isp/ipam              IP management
├─ /isp/wireless          Wi-Fi management
├─ /isp/orchestration     Automation
└─ /isp/settings          ISP settings

/tenant/*                 Tenant Self-Service Portal (ISP Admins) ✅ Already correct
├─ /tenant/services       ISP's platform services
├─ /tenant/billing        ISP's platform subscription
├─ /tenant/addons         Platform add-ons
├─ /tenant/automation     Platform automation
└─ /tenant/settings       ISP tenant settings

/isp-reseller/*           ISP Reseller Portal (Agents selling ISP services)
├─ /isp-reseller/referrals           Customer referrals
├─ /isp-reseller/commissions         Their earnings
├─ /isp-reseller/customers           Customers they brought
├─ /isp-reseller/performance         Sales metrics
└─ /isp-reseller/settings            Reseller settings

CUSTOMER LEVEL (End Users)
─────────────────────────────────────────────
/customer/*               Customer Portal (End Subscribers)
├─ /customer/service      Service details
├─ /customer/billing      Invoices & payments
├─ /customer/usage        Usage statistics
├─ /customer/support      Support tickets
└─ /customer/settings     Account settings
```

**Benefits:**
- ✅ Immediately clear which portal you're in
- ✅ Shows operational hierarchy (platform → ISP → customer)
- ✅ User type is obvious from route
- ✅ Reseller level is explicit (platform-reseller vs. isp-reseller)
- ✅ All portals at top level (no nesting)
- ✅ Easy to add new portals

---

### Option B: Abbreviated (If shorter routes preferred)

```
/platform/*          Platform Admin Portal
/platform-reseller/* Platform Reseller Portal
/isp/*               ISP Operations Portal
/tenant/*            Tenant Self-Service Portal ✅
/isp-reseller/*      ISP Reseller Portal
/customer/*          Customer Portal
```

**Trade-off:**
- ✅ Clear hierarchy (platform vs. isp level)
- ✅ Explicit reseller distinction
- ✅ Same benefits as Option A
- ❌ None (this is the recommended approach)

---

### Option C: Domain-Based (Most explicit)

```
/platform-admin/*         Platform Admin Portal
/platform-reseller/*      Platform Reseller Portal
/isp-operations/*         ISP Operations Portal
/tenant-management/*      Tenant Self-Service Portal
/isp-reseller/*           ISP Reseller Portal
/customer-portal/*        Customer Portal ✅ Already like this
```

**Trade-off:**
- ✅ Most explicit
- ✅ Clear hierarchy
- ❌ Longer routes

---

## Recommended: Option A

**Why:**
- Clear and concise
- User type is obvious
- Consistent naming pattern
- Industry standard (many SaaS platforms use `/platform/*`, `/customer/*`, etc.)

---

## Detailed Route Breakdown

### 1. Platform Admin Portal → `/platform/*`

**Current:** `/dashboard/platform-admin/*`
**Proposed:** `/platform/*`

**Why Change:**
- Platform Admin is a SEPARATE portal, not a sub-section of "dashboard"
- "Platform" clearly indicates DotMac platform-level operations
- Top-level route emphasizes its distinct role

**Routes:**
```
/platform                              Platform overview
/platform/tenants                      Tenant management (table view)
/platform/tenants/:id                  Tenant details
/platform/audit                        Platform-wide audit logs
/platform/audit/user/:userId           User audit trail
/platform/versioning                   API versioning management
/platform/health                       System health monitoring
/platform/billing                      Platform billing & revenue
/platform/settings                     Platform settings
/platform/feature-flags                Feature flag management
/platform/api-keys                     Platform API keys
```

**User Type:** DotMac Platform Administrators
**Access Control:** `platform:*:*` permissions

---

### 2. ISP Operations Portal → `/isp/*`

**Current:** `/dashboard/*`
**Proposed:** `/isp/*`

**Why Change:**
- "Dashboard" is too generic and ambiguous
- "ISP" clearly indicates this is for ISP operations
- Matches the domain (ISP operations platform)

**Routes:**
```
/isp                                   ISP operations overview
/isp/subscribers                       Subscriber management
/isp/subscribers/:id                   Subscriber details
/isp/network                           Network overview
/isp/network/fiber                     Fiber infrastructure
/isp/network/wireless                  Wireless access points
/isp/network/wireguard                 WireGuard VPN
/isp/network/faults                    Fault management
/isp/network/sessions                  Active sessions
/isp/ipam                              IP address management
/isp/ipam/prefixes                     IP prefixes
/isp/ipam/addresses                    IP addresses
/isp/dcim                              Data center infrastructure
/isp/billing                           Billing & invoicing
/isp/billing/invoices                  Invoice list
/isp/billing/payments                  Payment processing
/isp/billing/subscriptions             Subscription management
/isp/crm                               Customer relationship management
/isp/crm/leads                         Sales leads
/isp/crm/quotes                        Quote management
/isp/crm/site-surveys                  Site surveys
/isp/orchestration                     Workflow orchestration
/isp/orchestration/workflows           Workflow list
/isp/orchestration/schedule            Scheduled jobs
/isp/orchestration/analytics           Workflow analytics
/isp/communications                    Communications & notifications
/isp/communications/send               Send notification
/isp/communications/templates          Notification templates
/isp/communications/history            Message history
/isp/wireless                          Wireless management
/isp/wireless/access-points            Access point list
/isp/wireless/analytics                Wi-Fi analytics
/isp/network-monitoring                Network monitoring
/isp/settings                          ISP settings
/isp/settings/organization             Organization settings
/isp/settings/integrations             Integration configuration
/isp/settings/notifications            Notification preferences
```

**User Type:** ISP Staff (technicians, support, operations)
**Access Control:** Tenant-scoped permissions (automatically filtered to their ISP)

---

### 3. Tenant Self-Service Portal → `/tenant/*` ✅

**Current:** `/tenant/*`
**Proposed:** `/tenant/*` (NO CHANGE - already correct)

**Why Keep:**
- Already clear and descriptive
- "Tenant" accurately describes ISP Administrators managing their ISP
- Well-established in codebase

**Routes:**
```
/tenant                                Tenant overview
/tenant/services                       Tenant services
/tenant/billing                        Tenant billing overview
/tenant/billing/addons                 Add-ons management
/tenant/billing/payment-methods        Payment methods
/tenant/billing/dunning                Dunning configuration
/tenant/billing/usage                  Usage billing
/tenant/automation                     Automation rules
/tenant/scheduler                      Scheduled tasks
/tenant/fibermaps                      Fiber maps
/tenant/wireless                       Wireless configuration
```

**User Type:** ISP Administrators (managing their own ISP)
**Access Control:** `tenants:*` permissions

---

### 4. Customer Portal → `/customer/*`

**Current:** `/customer-portal/*`
**Proposed:** `/customer/*`

**Why Change:**
- Shorter, more consistent with other portals
- "-portal" suffix is redundant (everything is a portal)
- Matches pattern of `/platform/*`, `/isp/*`, `/tenant/*`

**Routes:**
```
/customer                              Customer dashboard
/customer/service                      Service details & status
/customer/billing                      Billing & invoices
/customer/billing/invoices             Invoice history
/customer/billing/payments             Payment history
/customer/usage                        Usage statistics
/customer/support                      Support tickets
/customer/support/:id                  Ticket details
/customer/settings                     Account settings
/customer/settings/profile             Profile settings
/customer/settings/password            Password change
/customer/help                         Help center
/customer/terms                        Terms of service
/customer/privacy                      Privacy policy
```

**User Type:** End Subscribers (residential/business customers)
**Access Control:** Customer-scoped (can only see their own data)

---

### 5. Platform Reseller Portal → `/platform-reseller/*`

**Current:** `/partner/*`
**Proposed:** `/platform-reseller/*`

**Why Change:**
- "Partner" is too generic and doesn't indicate what they resell
- These resellers sell the **DotMac Platform** (ISP-in-a-box) to ISPs
- Need to distinguish from ISP Reseller portal (who sell ISP services to customers)
- Shows hierarchy: Platform-level reseller

**Routes:**
```
/platform-reseller                     Platform reseller dashboard
/platform-reseller/tenants             ISP tenants they manage
/platform-reseller/tenants/:id         ISP tenant details
/platform-reseller/billing             Their revenue from ISPs
/platform-reseller/resources           Sales enablement materials
/platform-reseller/support             Support for their ISPs
/platform-reseller/settings            Reseller settings
```

**User Type:** MSPs/Resellers selling DotMac Platform to ISPs
**Access Control:** Platform-reseller-scoped
**What They Sell:** Complete ISP platform (multi-tenant SaaS)

---

### 6. ISP Reseller Portal → `/isp-reseller/*`

**Current:** `/portal/*`
**Proposed:** `/isp-reseller/*`

**Why Change:**
- "Portal" is too generic
- These resellers sell **ISP services** (internet, connectivity) to end customers
- Need to distinguish from Platform Reseller portal
- Shows hierarchy: ISP-level reseller

**Routes:**
```
/isp-reseller                          ISP reseller dashboard
/isp-reseller/referrals                Customer referrals
/isp-reseller/referrals/:id            Referral details
/isp-reseller/commissions              Commission tracking
/isp-reseller/customers                Customers they brought
/isp-reseller/performance              Sales performance metrics
/isp-reseller/settings                 Reseller settings
```

**User Type:** Sales agents/partners selling ISP services to customers
**Access Control:** ISP-reseller-scoped
**What They Sell:** Internet connectivity & ISP services

---

## Route Naming Conventions

### 1. Portal Prefix

**Pattern:** `/{portal-name}/*`

**Valid Portal Names:**
- `platform` - Platform Admin (DotMac platform admins)
- `platform-reseller` - Platform Reseller (selling DotMac to ISPs)
- `isp` - ISP Operations (ISP staff operations)
- `tenant` - Tenant Self-Service (ISP admins managing their tenant)
- `isp-reseller` - ISP Reseller (selling ISP services to customers)
- `customer` - Customer Portal (end subscribers)

**Invalid:**
- `dashboard` - Too generic (which dashboard?)
- `admin` - Ambiguous (platform admin? ISP admin?)
- `portal` - Too generic (which portal?)
- `partner` - Unclear (which kind of partner?)

---

### 2. Resource Routes

**Pattern:** `/{portal}/{resource-plural}`

**Examples:**
- `/platform/tenants` - List all tenants
- `/isp/subscribers` - List all subscribers
- `/customer/invoices` - List customer's invoices

**Conventions:**
- Always use **plural** for collections
- Use **kebab-case** for multi-word resources
- Keep URLs lowercase

---

### 3. Detail Routes

**Pattern:** `/{portal}/{resource-plural}/{id}`

**Examples:**
- `/platform/tenants/123` - Tenant detail
- `/isp/subscribers/456` - Subscriber detail
- `/customer/invoices/789` - Invoice detail

---

### 4. Nested Resources

**Pattern:** `/{portal}/{parent-resource}/{id}/{child-resource}`

**Examples:**
- `/isp/network/fiber/cables` - Fiber cables (nested under network)
- `/platform/audit/user/123` - User audit trail
- `/customer/support/tickets/456/messages` - Ticket messages

**When to nest:**
- Child resource only exists in context of parent
- Improves URL readability
- Max 3 levels deep

---

### 5. Actions

**Pattern:** `/{portal}/{resource}/{action}`

**Examples:**
- `/isp/communications/send` - Send notification
- `/platform/tenants/create` - Create tenant
- `/customer/support/new` - New support ticket

**Conventions:**
- Use verbs for actions: `send`, `create`, `edit`, `delete`
- Prefer nouns for resources: `tenants`, `subscribers`, `invoices`

---

## Migration Plan

### Phase 1: Create New Routes (Parallel Deployment)

**Week 1-2:**

1. Create new route structure alongside existing routes
2. Implement redirects from old to new routes
3. Update all internal links to use new routes
4. Test thoroughly

**Implementation:**
```typescript
// app/platform/page.tsx (NEW)
export default function PlatformDashboard() {
  return <PlatformAdminDashboard />;
}

// Redirect old to new
// middleware.ts
if (pathname.startsWith('/dashboard/platform-admin')) {
  return NextResponse.redirect(
    new URL(pathname.replace('/dashboard/platform-admin', '/platform'), request.url)
  );
}
```

---

### Phase 2: Update Documentation

**Week 2:**

1. Update all documentation to reference new routes
2. Create route migration guide for users
3. Update API documentation
4. Update Storybook examples

---

### Phase 3: Communicate Changes

**Week 2-3:**

1. Notify users of route changes
2. Provide migration timeline
3. Share route migration guide
4. Announce in release notes

---

### Phase 4: Deprecate Old Routes

**Week 4-6:**

1. Show deprecation warnings on old routes
2. Log usage of old routes
3. Monitor traffic to old routes
4. Prepare for removal

---

### Phase 5: Remove Old Routes

**Week 8:**

1. Remove old route files
2. Remove redirects (return 404)
3. Clean up middleware
4. Final verification

---

## Implementation Example

### Before: `/dashboard/platform-admin/tenants`

```
app/
├─ dashboard/
│  ├─ platform-admin/
│  │  ├─ tenants/
│  │  │  └─ page.tsx
```

### After: `/platform/tenants`

```
app/
├─ platform/
│  ├─ tenants/
│  │  └─ page.tsx
│  │  └─ [id]/
│  │     └─ page.tsx
```

### Redirect Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Route migrations
  const migrations = [
    { from: '/dashboard/platform-admin', to: '/platform' },
    { from: '/dashboard', to: '/isp' },
    { from: '/customer-portal', to: '/customer' },
    { from: '/partner', to: '/platform-reseller' },  // Platform-level reseller
    { from: '/portal', to: '/isp-reseller' },        // ISP-level reseller
  ];

  for (const { from, to } of migrations) {
    if (pathname.startsWith(from)) {
      const newPath = pathname.replace(from, to);
      return NextResponse.redirect(new URL(newPath, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/customer-portal/:path*',
    '/portal/:path*',
    '/partner/:path*',
  ],
};
```

---

## Navigation Component Updates

### Before (Generic)

```typescript
const navigation = [
  { name: "Dashboard", href: "/dashboard" }, // Unclear
  { name: "Platform Admin", href: "/dashboard/platform-admin" }, // Nested
];
```

### After (Clear)

```typescript
const navigation = [
  { name: "ISP Operations", href: "/isp" }, // Clear
  { name: "Platform Admin", href: "/platform" }, // Top-level
];
```

---

## URL Examples

### Platform Admin

```
https://app.dotmac.com/platform
https://app.dotmac.com/platform/tenants
https://app.dotmac.com/platform/tenants/fiber-co-isp
https://app.dotmac.com/platform/audit
```

### ISP Operations

```
https://app.dotmac.com/isp
https://app.dotmac.com/isp/subscribers
https://app.dotmac.com/isp/network/fiber/cables
https://app.dotmac.com/isp/billing/invoices
```

### Tenant Self-Service

```
https://app.dotmac.com/tenant
https://app.dotmac.com/tenant/services
https://app.dotmac.com/tenant/billing/addons
```

### Customer Portal

```
https://app.dotmac.com/customer
https://app.dotmac.com/customer/service
https://app.dotmac.com/customer/billing/invoices
```

### Platform Reseller Portal

```
https://app.dotmac.com/platform-reseller
https://app.dotmac.com/platform-reseller/tenants
https://app.dotmac.com/platform-reseller/billing
```

### ISP Reseller Portal

```
https://app.dotmac.com/isp-reseller
https://app.dotmac.com/isp-reseller/referrals
https://app.dotmac.com/isp-reseller/commissions
```

---

## Benefits of This Structure

### ✅ Clarity

**Before:**
- "Am I in the ISP portal or Platform portal?" - Unclear
- "/dashboard/platform-admin" - Why is platform admin nested?

**After:**
- "/platform/tenants" - Clearly in Platform Admin portal
- "/isp/subscribers" - Clearly in ISP Operations portal

---

### ✅ Consistency

All portals follow same pattern:
```
/{portal-name}/{resource}/{optional-id}/{optional-child}
```

---

### ✅ Discoverability

Routes are self-documenting:
- `/platform/*` = Platform admin features
- `/isp/*` = ISP operations features
- `/customer/*` = Customer features

---

### ✅ Scalability

Easy to add new portals:
```
/vendor/*           Vendor portal (future)
/auditor/*          Auditor portal (future)
/billing/*          Billing-specific portal (future)
```

---

### ✅ SEO & Analytics

Better tracking:
- Clear portal segmentation in analytics
- Meaningful URLs for search engines
- Easier to track user journeys

---

## Decision Matrix

| Route Option | Clarity | Brevity | Consistency | Recommended |
|--------------|---------|---------|-------------|-------------|
| `/platform/*` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **YES** |
| `/platform-reseller/*` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **YES** |
| `/isp/*` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **YES** |
| `/tenant/*` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **YES** (keep) |
| `/isp-reseller/*` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **YES** |
| `/customer/*` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **YES** |
| `/dashboard/*` | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ❌ NO (unclear) |
| `/admin/*` | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ❌ NO (ambiguous) |
| `/portal/*` | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ❌ NO (too generic) |
| `/partner/*` | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ❌ NO (which partner type?) |

---

## Related Documentation

1. [Portal UI Alignment Fix](./PORTAL_UI_ALIGNMENT_FIX.md)
2. [Tenant Management Architecture](./TENANT_MANAGEMENT_ARCHITECTURE.md)
3. [Phase 2 & 3 Completion Summary](./PHASE2_PHASE3_COMPLETION_SUMMARY.md)

---

## Next Steps

### Immediate (This Week)

1. **Team Review:** Get approval on proposed route structure
2. **Spike:** Test migration approach with one portal
3. **Documentation:** Create user-facing route migration guide

### Short-term (Next 2 Weeks)

4. **Implement:** Create new route structure
5. **Redirects:** Implement middleware redirects
6. **Testing:** Comprehensive route testing

### Long-term (Next Month)

7. **Communicate:** Notify users of changes
8. **Monitor:** Track old route usage
9. **Cleanup:** Remove old routes after migration period

---

**Status:** 📋 PROPOSAL - Awaiting team approval
**Recommended:** Option A (Simple & Clear)
**Impact:** High (affects all portal URLs)
**Complexity:** Medium (requires careful migration)
**Timeline:** 8 weeks (full migration with 6-week deprecation period)

---

## Quick Reference

### Proposed Route Map (Summary)

```
PLATFORM LEVEL
──────────────
/platform/*              Platform Admin Portal (DotMac admins)
/platform-reseller/*     Platform Reseller Portal (MSPs selling DotMac to ISPs)

ISP LEVEL
──────────────
/isp/*                   ISP Operations Portal (ISP staff)
/tenant/*                Tenant Self-Service Portal (ISP admins) ✅
/isp-reseller/*          ISP Reseller Portal (agents selling ISP services)

CUSTOMER LEVEL
──────────────
/customer/*              Customer Portal (end subscribers)
```

### Migration Commands

```bash
# Create new route structure
mkdir -p app/{platform,platform-reseller,isp,isp-reseller,customer}

# Test migration
pnpm dev
# Navigate to new routes and verify

# Check redirects
curl -I http://localhost:3000/dashboard
# Should redirect to /isp

curl -I http://localhost:3000/partner
# Should redirect to /platform-reseller

curl -I http://localhost:3000/portal
# Should redirect to /isp-reseller
```

---

**Created:** October 20, 2025
**Type:** Architectural Proposal
**Priority:** High
**Next:** Team review and approval
