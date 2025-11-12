# Architectural Fixes & Gap Closeout Implementation Plan

**Created:** 2025-11-08
**Status:** Ready for Implementation
**Related Docs:**
- [BACKEND_FRONTEND_GAP_ANALYSIS.md](./BACKEND_FRONTEND_GAP_ANALYSIS.md) - Full gap analysis
- [PORTAL_ARCHITECTURE.md](./architecture/PORTAL_ARCHITECTURE.md) - Portal design
- [TODO_GAP_CLOSEOUT.md](./TODO_GAP_CLOSEOUT.md) - High-level roadmap

---

## Executive Summary

This document provides a **detailed,  actionable implementation plan** for fixing **3 critical architectural issues** and **6 operational gaps** identified in the backend-frontend gap analysis.

### Critical Issues (P0)
1. 🔴 **Security Breach**: Tenant portal exposes ISP customer PII
2. 🔴 **Missing Feature**: Customer 360° detail page despite complete backend
3. 🔴 **Wrong Component**: ISP page imports tenant portal component

### Impact
- **Security:** Multi-tenant isolation violated, PII exposed
- **Operations:** Core ISP workflow incomplete
- **Architecture:** Component boundaries unclear

### Timeline
- **P0 Tasks (Critical):** 1-1.5 weeks (~42-56 hours)
- **P1 Tasks (High):** Few hours (~1-2 hours)
- **P2 Tasks (Medium):** 1 week (~38-52 hours)
- **Total:** 2-3 weeks of focused development

---

## 🔴 P0 TASKS: Critical Security & Workflow Fixes

### Task 1: Remove ISP Customer Data from Tenant Portal
**Priority:** P0 - CRITICAL SECURITY ISSUE
**Effort:** 2-4 hours
**Files:**
- DELETE: `/frontend/apps/platform-admin-app/app/tenant-portal/customers/page.tsx`
- UPDATE: `/frontend/apps/platform-admin-app/app/tenant-portal/layout.tsx`

**Why Critical:**
Tenant portal currently shows ISP subscriber data (names, emails, addresses, billing) which violates multi-tenant isolation.

**Quick Fix (Option A):**
```bash
cd frontend/apps/platform-admin-app
rm app/tenant-portal/customers/page.tsx
# Then update layout.tsx to remove nav link
```

### Task 2: Create License Management Page
**Priority:** P0 (Replacement for Task 1)
**Effort:** 4-6 hours
**Files:**
- CREATE: `/frontend/apps/platform-admin-app/app/tenant-portal/licenses/page.tsx`

**Features:**
- Show seat allocation (Admin: 5, Operator: 30, Read-only: 10)
- Utilization chart (45 of 50 seats used)
- Purchase additional seats
- Monthly cost breakdown

### Task 3: Create Customer 360° Main Page
**Priority:** P0 - CORE WORKFLOW
**Effort:** 12-16 hours
**Files:**
- CREATE: `/frontend/apps/isp-ops-app/app/dashboard/operations/customers/[id]/page.tsx`
- CREATE: 8 summary card components

**Backend:** ✅ Complete (`useCustomer360ViewGraphQL` hook ready)

**Dashboard Cards:**
1. Customer Overview (name, status, health score)
2. Current Subscription (plan, bandwidth, price)
3. Network Status (IPv4/IPv6, session, speed)
4. Devices Summary (total, online, offline)
5. Support Tickets (open, critical, overdue)
6. Billing Summary (balance, last payment, invoices)

### Task 4: Build Customer 360° Tabs
**Priority:** P0
**Effort:** 16-20 hours
**Files:**
- CREATE: `/dashboard/operations/customers/[id]/layout.tsx` (tab navigation)
- CREATE: 8 tab pages (profile, subscriptions, network, devices, billing, tickets, documents, activity)

**Tabs:**
1. **Profile** - Contact info, account details, health score
2. **Subscriptions** - Plans, add-ons, usage limits
3. **Network** - Live connection, IPs, RADIUS sessions
4. **Devices** - ONTs, routers, firmware status
5. **Billing** - Invoice history, payments, balance
6. **Tickets** - Support timeline
7. **Documents** - Contracts, SLAs, install records
8. **Activity** - Full audit log

### Task 5: Create ISPCustomersView Component
**Priority:** P0
**Effort:** 4-6 hours
**Files:**
- CREATE: `/frontend/apps/isp-ops-app/components/customers/ISPCustomersView.tsx`

**Features:**
- Customer list with search/filter
- Metrics cards (total, active, churned, revenue)
- Create customer button
- Links to customer detail page (Task 3)

### Task 6: Update Customer Page Import
**Priority:** P0
**Effort:** 15 minutes
**Files:**
- UPDATE: `/frontend/apps/isp-ops-app/app/dashboard/operations/customers/page.tsx`

**Change:**
```typescript
// Before:
import TenantCustomersView from "@/components/tenant/TenantCustomersView";

// After:
import ISPCustomersView from "@/components/customers/ISPCustomersView";
```

---

## 🟡 P1 TASKS: Documentation Updates

### Task 7: Update Portal Architecture Docs
**Priority:** P1
**Effort:** 1-2 hours
**Files:**
- UPDATE: `/docs/architecture/PORTAL_ARCHITECTURE.md`

**Changes:**
- Mark tenant portal as "✅ LIVE" instead of "Planned"
- Update workspace matrix table
- Correct authentication flow descriptions
- Add actual routes used

---

## 🟢 P2 TASKS: Operational Enhancements

### Task 8: IP Pool Management UI
**Priority:** P2
**Effort:** 8-12 hours
**Backend:** ✅ Complete (`/api/v1/ip-management/pools`)
**Files:**
- CREATE: `/dashboard/ipam/pools/page.tsx`
- CREATE: `/dashboard/ipam/pools/[id]/page.tsx`
- CREATE: `/dashboard/ipam/pools/new/page.tsx`

### Task 9: Alert Channel Config UI
**Priority:** P2
**Effort:** 6-8 hours
**Backend:** ✅ Complete (`/api/v1/alerts/channels`)
**Files:**
- CREATE: `/dashboard/infrastructure/alert-channels/page.tsx`

### Task 10: On-Call Schedule UI
**Priority:** P2
**Effort:** 10-14 hours
**Backend:** ✅ Complete (`/api/v1/oncall/schedules`)
**Files:**
- CREATE: `/dashboard/operations/oncall/page.tsx`

### Task 11: Deployment Tracking UI
**Priority:** P2
**Effort:** 8-10 hours
**Backend:** ✅ Complete (`/api/v1/deployment/workflows`)
**Files:**
- CREATE: `/dashboard/infrastructure/deployments/page.tsx`

### Task 12: Expand Real-Time Updates
**Priority:** P2
**Effort:** 6-8 hours
**Backend:** ⚠️ Partial (SSE endpoints exist but underutilized)
**Files:**
- UPDATE: `/dashboard/network/page.tsx`
- UPDATE: `/dashboard/radius/page.tsx`

---

## Implementation Phases

### Phase 1: Security Fixes (2 days)
**Tasks:** 1, 2
**Goal:** Eliminate PII exposure in tenant portal
**Validation:** Tenant portal shows only license/billing data, no customer PII

### Phase 2: Customer 360° (1.5 weeks)
**Tasks:** 3, 4, 5, 6
**Goal:** Complete core ISP customer management workflow
**Validation:** 
- Click customer → See 360° overview
- All 8 tabs load with correct data
- Quick actions (Suspend/Resume) work

### Phase 3: Documentation (0.5 days)
**Tasks:** 7
**Goal:** Align docs with reality

### Phase 4: Enhancements (1 week)
**Tasks:** 8, 9, 10, 11, 12
**Goal:** Close remaining operational gaps

---

## Success Metrics

### Security (P0)
- ✅ Zero ISP customer PII in tenant portal
- ✅ Multi-tenant boundaries enforced
- ✅ RBAC permissions validated

### Functionality (P0)
- ✅ Customer 360° page loads <2s
- ✅ All 8 tabs functional with real data
- ✅ Quick actions execute correctly
- ✅ Search/filter works on customer list

### Performance (P0)
- ✅ Auto-refresh doesn't lag UI
- ✅ Large customer lists scroll smoothly
- ✅ Real-time network updates every 30s

### Code Quality (P1)
- ✅ No component duplication between apps
- ✅ Proper separation ISP vs tenant contexts
- ✅ TypeScript types from GraphQL codegen

---

## Risk Mitigation

**High Risk:** Customer 360° complexity
- **Plan:** Build MVP first, add tabs incrementally
- **Fallback:** Ship with 3 core tabs, add rest in phase 2

**Medium Risk:** Backend API adjustments needed
- **Plan:** Test all APIs before starting UI
- **Fallback:** Use mock data during development

**Low Risk:** Component reusability issues
- **Plan:** Extract shared components early
- **Fallback:** Accept some duplication short-term

---

## Detailed Task Breakdown

Full implementation examples with code snippets available in:
- [BACKEND_FRONTEND_GAP_ANALYSIS.md](./BACKEND_FRONTEND_GAP_ANALYSIS.md) - Section 0

---

## Quick Reference

**Todo List:** 12 tasks tracked in project management
**Total Effort:** 81-110 hours (2-3 weeks)
**Critical Path:** Tasks 1-6 (security + customer 360°)
**Optional:** Tasks 8-12 (can defer to later sprint)
