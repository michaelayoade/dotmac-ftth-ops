# Portal UI Alignment Fix

**Date:** October 20, 2025
**Status:** ✅ COMPLETE
**Issue:** TenantSelector appearing in wrong portals

---

## Summary

Fixed portal UI alignment issue where the TenantSelector component was incorrectly displayed in the main ISP Admin dashboard (`/dashboard/*`). The TenantSelector should only appear in portals where users manage multiple tenants (Platform Admin, Tenant Self-Service), not in single-tenant operational contexts.

---

## Issue Description

**Problem:** TenantSelector was appearing in the topbar of the main ISP Admin dashboard where ISP Staff work within a single tenant context.

**User Report:**
> "the ui per portal, is it aligned? the topbar shouldnt have tenant selector, each portal should have all their operations ui"

**Root Cause:** The dashboard layout (`app/dashboard/layout.tsx`) included `<TenantSelector />` component on line 617, which was not appropriate for ISP Staff who operate within a single ISP tenant.

---

## Portal UI Specifications

### 6 Portals in the DotMac ISP Platform

#### 1. **Main Dashboard** (`/dashboard/*`)
- **User Type:** ISP Staff (technicians, support, operations)
- **Context:** Single ISP tenant
- **TenantSelector:** ❌ NO (removed)
- **Operations UI:**
  - Network management
  - Subscriber management
  - Billing & invoicing
  - IPAM & DCIM
  - Wireless management
  - Fault management
  - CRM & sales
  - Orchestration workflows
  - Communications & notifications

#### 2. **Platform Admin** (`/dashboard/platform-admin/*`)
- **User Type:** DotMac Platform Administrators
- **Context:** Multi-tenant (manages multiple ISP tenants)
- **TenantSelector:** ✅ YES (retained - managed separately in platform-admin routes)
- **Operations UI:**
  - Tenant management
  - Platform audit logs
  - API versioning
  - System health monitoring
  - Feature flags
  - Platform billing

#### 3. **Tenant Self-Service** (`/tenant/*`)
- **User Type:** ISP Administrators (managing their own ISP)
- **Context:** Single ISP tenant (their own)
- **TenantSelector:** ✅ YES (correct - ISP admins can manage tenant settings)
- **Operations UI:**
  - Tenant services & subscriptions
  - Tenant billing & payment methods
  - Add-ons management
  - Automation rules
  - Scheduler
  - Fiber maps
  - Usage monitoring

#### 4. **Customer Portal** (`/customer-portal/*`)
- **User Type:** End Subscribers (residential/business customers)
- **Context:** Single customer account
- **TenantSelector:** ❌ NO (verified correct)
- **Operations UI:**
  - My Service
  - Billing & payments
  - Usage statistics
  - Support tickets
  - Account settings

#### 5. **Partner Portal - Referral** (`/portal/*`)
- **User Type:** Sales Partners (referral agents)
- **Context:** Single partner account
- **TenantSelector:** ❌ NO (verified correct)
- **Operations UI:**
  - Referrals management
  - Commissions tracking
  - Customer list
  - Performance analytics
  - Partner settings

#### 6. **Partner Portal - Reseller** (`/partner/*`)
- **User Type:** MSPs/Resellers (white-label partners)
- **Context:** Multi-tenant (can manage multiple ISP tenants)
- **TenantSelector:** ❌ NO (verified correct - uses custom tenant management UI)
- **Operations UI:**
  - Managed tenants
  - Partner billing
  - Enablement resources
  - Support tickets

---

## Changes Made

### File Modified: `app/dashboard/layout.tsx`

#### Change 1: Removed TenantSelector from Topbar

**Before (Line 615-617):**
```typescript
{/* Right side - Tenant selector, Notifications, Theme toggle and User menu */}
<div className="flex items-center gap-4">
  <TenantSelector />
  <NotificationCenter
    maxNotifications={5}
    refreshInterval={30000}
    viewAllUrl="/dashboard/notifications"
  />
  <ThemeToggle />
```

**After:**
```typescript
{/* Right side - Notifications, Theme toggle and User menu */}
<div className="flex items-center gap-4">
  <NotificationCenter
    maxNotifications={5}
    refreshInterval={30000}
    viewAllUrl="/dashboard/notifications"
  />
  <ThemeToggle />
```

#### Change 2: Removed Unused Import

**Before (Line 46):**
```typescript
import { TenantSelector } from "@/components/tenant-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";
```

**After:**
```typescript
import { ThemeToggle } from "@/components/ui/theme-toggle";
```

---

## Verification

### ✅ TypeScript Check
```bash
pnpm type-check
# Result: 0 errors
```

### ✅ Portal Audit Results

| Portal | Route | TenantSelector | Status |
|--------|-------|----------------|--------|
| Main Dashboard | `/dashboard/*` | ❌ NO | ✅ FIXED |
| Platform Admin | `/dashboard/platform-admin/*` | ✅ YES | ✅ CORRECT |
| Tenant Self-Service | `/tenant/*` | ✅ YES | ✅ CORRECT |
| Customer Portal | `/customer-portal/*` | ❌ NO | ✅ CORRECT |
| Partner Portal (Referral) | `/portal/*` | ❌ NO | ✅ CORRECT |
| Partner Portal (Reseller) | `/partner/*` | ❌ NO | ✅ CORRECT |

---

## TenantSelector Usage Rules

### When to Include TenantSelector

✅ **Include TenantSelector when:**
- Users manage **multiple ISP tenants** (Platform Admins)
- Users configure **their own tenant** settings (Tenant Self-Service)
- Users switch between different **organizational contexts**

### When NOT to Include TenantSelector

❌ **Do NOT include TenantSelector when:**
- Users work within a **single ISP tenant** context (ISP Staff)
- Users are **end customers** managing their account (Customer Portal)
- Users are **sales partners** with a single partner account (Partner Portal)
- The tenant context is **implicit** and doesn't need switching

---

## Portal-Specific Operations UI

### Main Dashboard (`/dashboard/*`)
**Intended for ISP Staff performing daily operations:**

```typescript
const navigation = [
  // Core Operations
  { name: "Overview", href: "/dashboard", icon: Home },

  // Subscriber Management
  { name: "Subscribers", href: "/dashboard/subscribers", icon: Users },
  { name: "CRM", href: "/dashboard/crm", icon: UserCheck },

  // Network Operations
  { name: "Network", href: "/dashboard/network", icon: NetworkIcon },
  { name: "IPAM", href: "/dashboard/ipam", icon: MapPin },
  { name: "DCIM", href: "/dashboard/dcim", icon: Server },
  { name: "Wireless", href: "/dashboard/wireless", icon: Wifi },
  { name: "Faults", href: "/dashboard/network/faults", icon: AlertTriangle },

  // Billing & Revenue
  { name: "Billing & Revenue", href: "/dashboard/billing-revenue", icon: DollarSign },
  { name: "Banking V2", href: "/dashboard/banking-v2", icon: CreditCard },

  // Orchestration & Automation
  { name: "Orchestration", href: "/dashboard/orchestration", icon: Repeat },
  { name: "Communications", href: "/dashboard/communications", icon: Mail },

  // Settings & Admin
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Platform Admin", href: "/dashboard/platform-admin", icon: Shield },
];
```

**Key Characteristics:**
- Operational focus (day-to-day ISP operations)
- Network-centric (IPAM, DCIM, Wireless, Faults)
- Customer-facing (CRM, Subscribers, Billing)
- Single ISP tenant context
- **NO** TenantSelector in topbar

---

### Tenant Self-Service Portal (`/tenant/*`)
**Intended for ISP Administrators managing their ISP:**

```typescript
const navigation = [
  { name: "Overview", href: "/tenant", icon: LayoutDashboard },
  { name: "Services", href: "/tenant/services", icon: Package },
  { name: "Billing", href: "/tenant/billing", icon: CreditCard },
  { name: "Add-ons", href: "/tenant/billing/addons", icon: Package },
  { name: "Payment Methods", href: "/tenant/billing/payment-methods", icon: CreditCard },
  { name: "Automation", href: "/tenant/automation", icon: Repeat },
  { name: "Scheduler", href: "/tenant/scheduler", icon: Calendar },
  { name: "Fiber Maps", href: "/tenant/fibermaps", icon: MapPin },
  { name: "Wireless", href: "/tenant/wireless", icon: Wifi },
];
```

**Key Characteristics:**
- Tenant management focus
- Subscription & billing for the ISP's services
- Configuration & automation
- **HAS** TenantSelector (ISP admins manage tenant settings)

---

### Customer Portal (`/customer-portal/*`)
**Intended for End Subscribers:**

```typescript
const navigation = [
  { name: "Dashboard", href: "/customer-portal", icon: Home },
  { name: "My Service", href: "/customer-portal/service", icon: Wifi },
  { name: "Billing", href: "/customer-portal/billing", icon: CreditCard },
  { name: "Usage", href: "/customer-portal/usage", icon: BarChart3 },
  { name: "Support", href: "/customer-portal/support", icon: Headphones },
  { name: "Settings", href: "/customer-portal/settings", icon: Settings },
];
```

**Key Characteristics:**
- Customer self-service focus
- Billing & usage transparency
- Support ticket management
- **NO** TenantSelector

---

### Partner Portal - Referral (`/portal/*`)
**Intended for Sales Partners:**

```typescript
const navigation = [
  { name: "Dashboard", href: "/portal/dashboard", icon: Home },
  { name: "Referrals", href: "/portal/referrals", icon: UserPlus },
  { name: "Commissions", href: "/portal/commissions", icon: DollarSign },
  { name: "Customers", href: "/portal/customers", icon: Users },
  { name: "Performance", href: "/portal/performance", icon: BarChart3 },
  { name: "Settings", href: "/portal/settings", icon: Settings },
];
```

**Key Characteristics:**
- Referral tracking
- Commission management
- Performance analytics
- **NO** TenantSelector

---

### Partner Portal - Reseller (`/partner/*`)
**Intended for MSPs/Resellers:**

```typescript
const navigation = [
  { name: "Overview", href: "/partner", icon: Handshake },
  { name: "Managed tenants", href: "/partner/tenants", icon: Users },
  { name: "Partner billing", href: "/partner/billing", icon: CreditCard },
  { name: "Enablement", href: "/partner/resources", icon: Layers },
  { name: "Support", href: "/partner/support", icon: LifeBuoy },
];
```

**Key Characteristics:**
- Multi-tenant management
- Partner billing & revenue share
- White-label enablement
- **NO** TenantSelector (uses custom tenant management)

---

## Testing Recommendations

### Manual Testing Checklist

- [ ] Navigate to `/dashboard/*` - Verify NO TenantSelector in topbar
- [ ] Navigate to `/tenant/*` - Verify TenantSelector IS present
- [ ] Navigate to `/customer-portal/*` - Verify NO TenantSelector
- [ ] Navigate to `/portal/*` - Verify NO TenantSelector
- [ ] Navigate to `/partner/*` - Verify NO TenantSelector
- [ ] Navigate to `/dashboard/platform-admin/*` - Verify TenantSelector in platform admin sections

### Automated Tests (Recommended)

```typescript
// tests/portals/tenant-selector-visibility.spec.ts
describe('TenantSelector Visibility', () => {
  it('should NOT show TenantSelector in main dashboard', async () => {
    await page.goto('/dashboard');
    const tenantSelector = await page.locator('[data-testid="tenant-selector"]');
    await expect(tenantSelector).not.toBeVisible();
  });

  it('should show TenantSelector in tenant portal', async () => {
    await page.goto('/tenant');
    const tenantSelector = await page.locator('[data-testid="tenant-selector"]');
    await expect(tenantSelector).toBeVisible();
  });

  it('should NOT show TenantSelector in customer portal', async () => {
    await page.goto('/customer-portal');
    const tenantSelector = await page.locator('[data-testid="tenant-selector"]');
    await expect(tenantSelector).not.toBeVisible();
  });
});
```

---

## Impact Assessment

### Benefits

✅ **Improved UX:** ISP Staff no longer see confusing tenant selector in single-tenant context
✅ **Cleaner UI:** Topbar is less cluttered in main dashboard
✅ **Correct Mental Model:** UI matches user expectations for each portal
✅ **Performance:** Removed unnecessary component render in main dashboard

### Breaking Changes

❌ **None:** This fix restores the intended UX design, no functionality removed

### Migration Notes

- Existing users will see cleaner topbar in main dashboard
- Platform Admins still have TenantSelector in platform-admin sections
- Tenant Self-Service portal retains TenantSelector as designed

---

## Related Documentation

1. [Portal Architecture Guide](./PORTAL_ARCHITECTURE.md)
2. [Frontend Comprehensive Review](./FRONTEND_COMPREHENSIVE_REVIEW.md)
3. [Phase 2 & 3 Completion Summary](./PHASE2_PHASE3_COMPLETION_SUMMARY.md)
4. [Bundle Optimization Complete](./BUNDLE_OPTIMIZATION_COMPLETE.md)

---

## Completion Checklist

- [x] Audit all 6 portal layouts for TenantSelector presence
- [x] Remove TenantSelector from main dashboard layout
- [x] Remove unused TenantSelector import
- [x] Verify TypeScript compilation (0 errors)
- [x] Document portal UI specifications
- [x] Create TenantSelector usage rules
- [x] Document portal-specific operations UI
- [x] Create testing recommendations

---

**Completed:** October 20, 2025
**Modified Files:** 1 (`app/dashboard/layout.tsx`)
**TypeScript Errors:** 0
**Next Steps:** Manual testing recommended, consider adding automated portal UI tests

---

## Quick Reference

### Command to Verify

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/base-app

# Type check
pnpm type-check

# Build
pnpm build

# Run dev server and manually verify
pnpm dev
```

### Files Modified

```
app/dashboard/layout.tsx - Removed TenantSelector from topbar (line 617) and import (line 46)
```

### Git Commit Message

```
fix(ui): remove TenantSelector from main dashboard topbar

- Removed TenantSelector component from ISP Staff dashboard
- ISP Staff work in single-tenant context, don't need tenant switching
- Retained TenantSelector in Tenant Self-Service portal (/tenant/*)
- Platform Admin portal maintains separate TenantSelector
- Cleaner topbar UI for main operations dashboard

Closes: Portal UI alignment issue
```
