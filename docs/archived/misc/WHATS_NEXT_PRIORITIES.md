# What's Next? - Platform Priorities After CRM Completion

**Date:** October 16, 2025
**Current Status:** CRM Module 100% Complete
**Next Focus:** Critical Frontend Gaps & Journey Completion

---

## 🎯 Executive Summary

With the **CRM module complete**, we've unlocked **Journey 1: Lead to Active Customer**. However, there are still **critical frontend gaps** that need attention to make the platform fully operational for ISPs.

### Current Platform Status
- ✅ **Backend:** ~95% Complete (all core APIs functional)
- ⏳ **Frontend:** ~40% Complete (many features lack UI)
- ✅ **Documentation:** Comprehensive guides available
- ✅ **Testing:** Integration tests for critical paths

---

## 📊 Priority Matrix

### 🔴 CRITICAL (Blocks Core Workflows) - Must Do Next

These are **essential** for day-to-day ISP operations:

#### 1. **Subscriber Management Frontend** (Journey 2)
**Status:** ❌ Backend Complete, Frontend Missing
**Impact:** **CRITICAL** - Cannot manage active subscribers without UI
**Effort:** 2-3 days

**What's Missing:**
- Subscriber list page with search/filter
- Subscriber detail view (service info, usage, sessions)
- Bulk actions (suspend, resume, terminate)
- RADIUS session management UI
- IP address assignment display

**Why Critical:**
- NOC needs to manage active subscribers
- Support needs to view subscriber details
- Cannot suspend/resume services without UI
- No visibility into active RADIUS sessions

**Backend APIs Available:**
- ✅ GET /subscribers (list with filters)
- ✅ GET /subscribers/{id} (detail view)
- ✅ PATCH /subscribers/{id} (update)
- ✅ POST /subscribers/{id}/suspend
- ✅ POST /subscribers/{id}/resume
- ✅ GET /radius/sessions (active sessions)
- ✅ POST /radius/sessions/disconnect

---

#### 2. **Billing & Invoicing Frontend** (Journey 3)
**Status:** ❌ Backend Complete, Frontend Partially Complete
**Impact:** **CRITICAL** - Cannot bill customers or track payments
**Effort:** 3-4 days

**What's Missing:**
- Invoice list page with filters
- Invoice detail view with line items
- Payment recording UI
- Payment method management
- Overdue invoice alerts
- Invoice generation workflow

**Why Critical:**
- Cannot generate monthly invoices
- No way to record payments
- No visibility into outstanding balances
- Billing staff cannot do their jobs

**Backend APIs Available:**
- ✅ GET /invoices (list with filters)
- ✅ GET /invoices/{id} (detail)
- ✅ POST /invoices/generate (manual generation)
- ✅ POST /payments (record payment)
- ✅ GET /payments (list payments)
- ✅ GET /customers/{id}/balance

---

#### 3. **Network Monitoring Dashboard** (Journey 7)
**Status:** ❌ Backend Complete, Frontend Missing
**Impact:** **HIGH** - Cannot monitor network health
**Effort:** 2-3 days

**What's Missing:**
- Real-time network status dashboard
- Active sessions count
- Bandwidth utilization charts
- OLT/ONU status displays
- Alert notifications UI
- Device health metrics

**Why Critical:**
- NOC needs real-time network visibility
- Cannot proactively identify issues
- No alerts for network problems
- Cannot troubleshoot outages effectively

**Backend APIs Available:**
- ✅ GET /radius/sessions/active (real-time sessions)
- ✅ GET /voltha/olts (OLT status)
- ✅ GET /voltha/onus (ONU status)
- ✅ GET /diagnostics/network-health
- ✅ WebSocket for real-time updates

---

### 🟡 HIGH PRIORITY (Improves Operations) - Do Soon

These significantly improve operational efficiency:

#### 4. **Customer Management Enhancements**
**Status:** ⏳ Basic UI exists, needs enhancements
**Impact:** HIGH - Current UI is minimal
**Effort:** 2 days

**What's Needed:**
- Enhanced customer detail view
- Service subscription management UI
- Usage history charts
- Payment history display
- Document upload (contracts, IDs)
- Communication history

---

#### 5. **Ticketing System UI** (Journey 6)
**Status:** ❌ Backend Complete, Frontend Missing
**Impact:** HIGH - Support operations manual without UI
**Effort:** 3 days

**What's Needed:**
- Ticket list with filters (status, priority, type)
- Ticket detail view with timeline
- Create ticket modal
- Assign technician workflow
- Status transitions (Open → In Progress → Resolved)
- SLA tracking display

**Backend APIs Available:**
- ✅ Complete ticketing API (25+ endpoints)
- ✅ SLA tracking
- ✅ Assignment workflows
- ✅ Status management

---

#### 6. **Usage Billing Frontend**
**Status:** ❌ Backend Complete, Frontend Missing
**Impact:** HIGH - For ISPs with metered billing
**Effort:** 2 days

**What's Needed:**
- Usage records display
- Monthly usage reports
- Overage charges calculation UI
- Pay-as-you-go billing setup
- Usage alerts configuration

**Backend APIs Available:**
- ✅ GET /usage-billing/records
- ✅ GET /usage-billing/aggregations/monthly
- ✅ POST /usage-billing/records/mark-billed
- ✅ GET /usage-billing/reports

---

### 🟢 MEDIUM PRIORITY (Nice to Have) - Do Later

These are valuable but not blocking:

#### 7. **Dunning & Collections Frontend**
**Status:** ❌ Backend Complete, Frontend Missing
**Impact:** MEDIUM - Manual dunning possible via backend
**Effort:** 2-3 days

**Pages Needed:**
- Dunning campaigns management
- Execution tracking
- Recovery statistics
- Payment recovery reports

---

#### 8. **Partner Management Enhancements**
**Status:** ⏳ Basic UI exists
**Impact:** MEDIUM - For ISPs with partners
**Effort:** 1-2 days

**Enhancements:**
- Partner portal improvements
- Commission tracking UI
- Revenue sharing reports
- Partner performance analytics

---

#### 9. **Advanced Analytics & Reporting**
**Status:** ⏳ Some charts exist
**Impact:** MEDIUM - Business intelligence
**Effort:** 3-4 days

**What's Needed:**
- MRR trends and forecasting
- Churn analysis
- Customer acquisition cost
- Lifetime value calculations
- Custom report builder
- Dashboard customization

---

#### 10. **Service Provisioning Automation UI**
**Status:** ❌ Backend Complete (Orchestration), Frontend Missing
**Impact:** MEDIUM - Can provision via backend
**Effort:** 2 days

**What's Needed:**
- Provisioning workflow visualization
- Manual service activation UI
- Bulk provisioning interface
- Provisioning status tracking

---

## 🚀 Recommended Implementation Order

Based on business impact and dependencies:

### **Week 1: Critical Operations** (Must Have)
**Days 1-2:** Subscriber Management Frontend
- List page with filters
- Detail view with sessions
- Suspend/resume actions
- RADIUS session management

**Days 3-4:** Billing & Invoicing Frontend
- Invoice list and detail views
- Payment recording UI
- Invoice generation workflow

**Day 5:** Network Monitoring Dashboard
- Real-time status display
- Active sessions widget
- Basic health metrics

**Deliverable:** ISP can manage subscribers, bill customers, monitor network

---

### **Week 2: Enhanced Operations** (Should Have)
**Days 1-2:** Ticketing System UI
- Ticket list and detail views
- Create/assign/resolve workflows
- SLA tracking display

**Days 3-4:** Usage Billing Frontend
- Usage records display
- Monthly reports
- Overage calculations

**Day 5:** Customer Management Enhancements
- Enhanced detail view
- Service management
- Document uploads

**Deliverable:** Support operations streamlined, usage billing automated

---

### **Week 3: Business Intelligence** (Nice to Have)
**Days 1-2:** Dunning & Collections Frontend
- Campaign management
- Execution tracking
- Recovery statistics

**Days 3-4:** Advanced Analytics
- MRR trends
- Churn analysis
- Custom reports

**Day 5:** Service Provisioning UI
- Workflow visualization
- Bulk operations

**Deliverable:** Full business intelligence and automation

---

## 📋 Detailed Breakdown: Top 3 Critical Items

### 1. Subscriber Management Frontend (MOST CRITICAL)

**Pages to Create:**

#### A. Subscribers List Page
**File:** `app/dashboard/subscribers/page.tsx` (~600 lines)

**Features:**
- Statistics cards:
  - Total Active Subscribers
  - Online Now (active sessions)
  - Suspended
  - Pending Activation
- EnhancedDataTable with columns:
  - Username
  - Customer Name (link to customer)
  - Service Type
  - Status Badge
  - IP Address
  - Last Login
  - Data Usage (today/month)
  - Actions
- Filtering:
  - Status (active, suspended, pending, terminated)
  - Service Type (ftth, wireless, dsl)
  - Search by username/IP
- Bulk actions:
  - Suspend Services
  - Resume Services
  - Disconnect Sessions
- CSV export

#### B. Subscriber Detail Modal
**File:** `components/subscribers/SubscriberDetailModal.tsx` (~500 lines)

**Features:**
- 5 tabs:
  - **Overview:** Subscriber info, service details, device info
  - **Sessions:** Active and historical RADIUS sessions
  - **Usage:** Data usage charts (daily/weekly/monthly)
  - **Network:** ONU status, signal quality, IP assignments
  - **Activity:** Audit log of all actions
- Quick actions:
  - Disconnect Active Session
  - Suspend Service
  - Resume Service
  - Reset Password
  - View Customer Profile

#### C. Session Management Component
**File:** `components/subscribers/SessionManagement.tsx` (~300 lines)

**Features:**
- Active sessions table:
  - Session ID
  - NAS IP
  - Login Time
  - Duration
  - Download/Upload bytes
  - Disconnect button
- Session history with filters
- Bandwidth usage charts

**Total Effort:** 2-3 days (~1,400 lines)

---

### 2. Billing & Invoicing Frontend (SECOND PRIORITY)

**Pages to Create:**

#### A. Invoices List Page
**File:** `app/dashboard/billing/invoices/page.tsx` (~600 lines)

**Features:**
- Statistics cards:
  - Total Invoices This Month
  - Outstanding Amount
  - Overdue Invoices
  - Collection Rate
- EnhancedDataTable with columns:
  - Invoice Number
  - Customer Name
  - Issue Date
  - Due Date
  - Amount
  - Status Badge (paid, pending, overdue)
  - Actions
- Filtering:
  - Status
  - Date range
  - Customer
- Bulk actions:
  - Send Reminders
  - Mark as Paid
  - Export to CSV

#### B. Invoice Detail Modal
**File:** `components/billing/InvoiceDetailModal.tsx` (~500 lines)

**Features:**
- Invoice header with customer info
- Line items table
- Payment history
- Actions:
  - Send Invoice Email
  - Record Payment
  - Void Invoice
  - Download PDF
  - Print
- Payment recording form

#### C. Payment Recording Modal
**File:** `components/billing/RecordPaymentModal.tsx` (~350 lines)

**Features:**
- Payment method selector
- Amount input with auto-fill (full/partial)
- Payment date picker
- Reference number input
- Attach receipt (file upload)
- Apply to multiple invoices

**Total Effort:** 3-4 days (~1,450 lines)

---

### 3. Network Monitoring Dashboard (THIRD PRIORITY)

**Pages to Create:**

#### A. Network Dashboard Page
**File:** `app/dashboard/network/page.tsx` (~700 lines)

**Features:**
- Real-time metrics:
  - Active Subscribers Online
  - Total Bandwidth Usage
  - Average Session Duration
  - Network Uptime
- OLT Status Grid:
  - OLT name and status
  - Active ONUs count
  - Available ports
  - Signal quality average
- Active Sessions Widget:
  - Recent logins
  - Top bandwidth users
  - Session distribution chart
- Network Health Timeline:
  - Uptime percentage
  - Incident markers
  - Maintenance windows
- Auto-refresh every 30 seconds

#### B. OLT/ONU Status Component
**File:** `components/network/OLTStatusGrid.tsx` (~300 lines)

**Features:**
- Grid of OLT cards:
  - Status indicator (green/yellow/red)
  - Active/total ONUs
  - Bandwidth utilization bar
  - Click to expand ONU list
- ONU detail view:
  - Serial number
  - Customer link
  - Signal strength
  - Online/offline status

#### C. Bandwidth Usage Charts
**File:** `components/network/BandwidthCharts.tsx` (~250 lines)

**Features:**
- Real-time bandwidth chart (last hour)
- Daily bandwidth trend
- Per-OLT breakdown
- Top consumers list

**Total Effort:** 2-3 days (~1,250 lines)

---

## 🎯 Quick Wins (1-2 hours each)

These can be done quickly between major features:

1. **Fix Build Errors** (1 hour)
   - Fix missing `useRBAC` hook imports
   - Fix missing chart component exports
   - Ensure clean build

2. **Add Notifications Bell** (1 hour)
   - Already have NotificationCenter component
   - Just needs integration in header

3. **Dashboard Widgets Enhancement** (2 hours)
   - Add quick stats to main dashboard
   - Link widgets to detail pages

4. **Empty State Improvements** (1 hour)
   - Add helpful empty states to existing pages
   - Include "Get Started" guides

---

## 💡 Strategic Considerations

### Multi-Tenant Readiness
- ✅ Backend fully multi-tenant
- ⏳ Frontend needs tenant context in all components
- Ensure all API calls include tenant_id

### RBAC Integration
- ✅ Backend has permission decorators
- ⏳ Frontend needs role-based UI rendering
- Hide/disable features based on user permissions

### Real-time Updates
- ✅ WebSocket infrastructure exists
- ⏳ Frontend components need WebSocket integration
- Add real-time session updates
- Add live bandwidth charts

### Mobile Responsiveness
- ✅ shadcn/ui components are responsive
- ⏳ Test all new pages on mobile
- Optimize table views for small screens

---

## 📊 Success Metrics

After completing Week 1 (Critical Operations):
- ✅ ISP can manage 100% of subscriber operations via UI
- ✅ Billing can generate and track all invoices
- ✅ NOC has real-time network visibility
- ✅ All critical journeys have functional UIs

After completing Week 2 (Enhanced Operations):
- ✅ Support team fully productive with ticketing UI
- ✅ Usage billing automated for metered customers
- ✅ Customer management streamlined

After completing Week 3 (Business Intelligence):
- ✅ Management has full business analytics
- ✅ Automated collections reduce manual work
- ✅ Service provisioning fully automated

---

## 🚦 Recommended Next Steps

### Immediate Action (Right Now)
**Start with Subscriber Management Frontend** - This is the most critical gap.

**Steps:**
1. Create `app/dashboard/subscribers/page.tsx` (Subscribers List)
2. Create `components/subscribers/SubscriberDetailModal.tsx`
3. Create `components/subscribers/SessionManagement.tsx`
4. Create `hooks/useSubscribers.ts` (if not exists)
5. Test with real backend data

**Why Start Here:**
- Highest business impact (NOC operations blocked)
- Builds on patterns from CRM (reuse components/hooks)
- Unblocks Journey 2: Service Activation & Management
- Dependencies are already complete (backend fully functional)

### Question for You

**Which of these priorities align with your business needs?**

Option A: **Follow recommended order** (Subscribers → Billing → Network)
- Most logical for ISP operations
- Builds capabilities sequentially

Option B: **Focus on specific journey** (e.g., complete all Journey 2 components)
- May require jumping around feature areas
- Ensures end-to-end workflow completeness

Option C: **Quick wins first** (fix build errors, add notifications)
- Clean up existing issues
- Lower effort, immediate satisfaction

**Your call!** Let me know which direction you'd like to go, and I can start implementing immediately.

---

**Date:** October 16, 2025
**Status:** Ready to proceed with next priority
**Waiting for:** Direction from you on which feature to tackle first
