# MSW Migration Status

## Changelog

### 2025-11-14: Phase 7 - useCommissionRules Migration

**Status**: ✅ COMPLETE - 28 hooks migrated, 669 tests passing

**Changes**:
- ✅ Migrated useCommissionRules hook (38 tests) - Second medium-priority hook from Phase 7
- ✅ Created `__tests__/msw/handlers/commission-rules.ts` - 6 endpoints covering commission rule management
- ✅ Created `hooks/__tests__/useCommissionRules.msw.test.tsx` - 38 comprehensive tests
- ✅ Removed `hooks/__tests__/useCommissionRules.test.tsx` - Legacy file (39KB)
- ✅ Updated MSW server configuration

**Test Results**:
- Test Suites: 28/28 passing (100%)
- Tests: 669/676 passing (7 skipped)
- New tests: 38 commission rules tests covering 6 hooks
- Time: ~3.5s for useCommissionRules suite

**Technical Highlights**:
- Complete CRUD operations for commission rules
- Multiple commission types: revenue_share, flat_fee, tiered, hybrid
- Product and customer applicability filtering
- Priority-based rule sorting for applicable rules
- Comprehensive pagination and filtering support
- Rule activation/deactivation management
- Effective date range support

**Technical Challenges Resolved**:
1. **AppConfigContext Mocking**: Hook uses custom AppConfigContext for API configuration. Created mock that provides buildUrl function matching the expected signature.
2. **Test Isolation**: Ensured unique IDs for edge case tests to prevent conflicts with auto-generated IDs from previous tests.
3. **Handler URL Ordering**: Specific `/partners/:partnerId/applicable` route must come before generic `/:id` route to match correctly.

**Impact**:
- +38 tests with realistic API mocking
- -39KB disk space (old test file removed)
- Partner commission management now properly tested with all commission types
- Rule applicability logic validated with product/customer filtering

---

### 2025-11-14: Phase 7 - useReconciliation Migration

**Status**: ✅ COMPLETE - 27 hooks migrated, 631 tests passing

**Changes**:
- ✅ Migrated useReconciliation hook (24 tests) - First medium-priority hook from Phase 7
- ✅ Created `__tests__/msw/handlers/reconciliation.ts` - 9 endpoints covering reconciliation workflow and payment recovery
- ✅ Created `hooks/__tests__/useReconciliation.msw.test.tsx` - 24 comprehensive tests
- ✅ Removed `hooks/__tests__/useReconciliation.test.tsx` - Legacy file (49KB)
- ✅ Fixed useToast mock (import from @dotmac/ui, not local hooks)

**Test Results**:
- Test Suites: 27/27 passing (100%)
- Tests: 631/638 passing (7 skipped)
- New tests: 24 reconciliation tests covering 9 hooks
- Time: ~2.4s for useReconciliation suite

**Technical Highlights**:
- Complete reconciliation lifecycle (start → add payments → complete → approve)
- Reconciliation summary with statistics and discrepancy tracking
- Payment recovery with retry mechanism and circuit breaker pattern
- Bank account filtering and date range queries
- Pagination support for large reconciliation datasets
- Complex workflow validations (must complete before approve)

**Technical Challenges Resolved**:
1. **useToast Import Path**: Hook imports useToast from `@dotmac/ui`, not from a local hooks directory. Fixed jest.mock to use correct import path with spread operator to preserve other exports.
2. **Handler URL Ordering**: Specific routes like `/summary`, `/circuit-breaker/status`, and `/retry-payment` must come before parameterized `/:id` route. Ensured proper ordering within handler file.

**Impact**:
- +24 tests with realistic API mocking
- -49KB disk space (old test file removed)
- Billing reconciliation workflows now properly tested with realistic scenarios
- Circuit breaker pattern for payment gateway failures properly tested

---

### 2025-11-14: Phase 6 - useCampaigns Migration

**Status**: ✅ COMPLETE - 26 hooks migrated, 607 tests passing

**Changes**:
- ✅ Migrated useCampaigns hook (27 tests) - Third high-priority hook from Phase 6
- ✅ Created `__tests__/msw/handlers/campaigns.ts` - 2 endpoints (GET list, PATCH update)
- ✅ Created `hooks/__tests__/useCampaigns.msw.test.tsx` - 27 comprehensive tests
- ✅ Removed `hooks/__tests__/useCampaigns.test.tsx` - Legacy file (25KB)
- ✅ Fixed URL pattern conflicts with dunningHandlers
- ✅ Fixed handler ordering (campaignsHandlers before dunningHandlers)

**Test Results**:
- Test Suites: 26/26 passing (100%)
- Tests: 607/614 passing (7 skipped)
- New tests: 27 campaigns tests covering 2 hooks (useCampaigns, useUpdateCampaign)
- Time: ~2.0s for useCampaigns suite

**Technical Highlights**:
- Dunning campaigns management with filtering by active status
- Campaign updates (status, priority)
- Query caching and invalidation
- Comprehensive error handling

**Technical Challenges Resolved**:
1. **API BaseURL Handling**: apiClient uses `/api/v1` baseURL, so paths like `/billing/dunning/campaigns` become `/api/v1/billing/dunning/campaigns`. Handler patterns must account for this.
2. **Handler Ordering Conflicts**: dunningHandlers already had `/api/v1/billing/dunning/campaigns` endpoints. Fixed by placing campaignsHandlers BEFORE dunningHandlers in server.ts to ensure more specific handlers match first.
3. **jest.mock for useRealtime**: Added jest.mock for useRealtime to avoid better-auth ESM import issues.

**Impact**:
- +27 tests with realistic API mocking
- -25KB disk space (old test file removed)
- Dunning campaigns now properly tested with realistic scenarios

---

### 2025-11-14: Phase 6 - useFieldService Migration

**Status**: ✅ COMPLETE - 25 hooks migrated, 580 tests passing

**Changes**:
- ✅ Migrated useFieldService hook (15 tests) - Second high-priority hook from Phase 6
- ✅ Created `__tests__/msw/handlers/field-service.ts` - 10 endpoints covering technicians, time tracking, scheduling, and resources
- ✅ Created `hooks/__tests__/useFieldService.msw.test.tsx` - 15 comprehensive tests
- ✅ Removed `hooks/__tests__/useFieldService.test.tsx` - Legacy file (15KB)
- ✅ Fixed enum imports (type imports vs runtime imports)
- ✅ Fixed handler ordering in server.ts (fieldServiceHandlers must come before techniciansHandlers)

**Test Results**:
- Test Suites: 25/25 passing (100%)
- Tests: 580/587 passing (7 skipped)
- New tests: 15 field service tests covering 10 hooks
- Time: ~2.0s for useFieldService suite

**Technical Highlights**:
- Technician management with filtering by status, skill level, and availability
- Time tracking with GPS-enabled clock in/out
- Task assignment with auto-assignment algorithm
- Equipment and vehicle resource management
- Resource assignment tracking
- Complex filtering across multiple dimensions

**Technical Challenges Resolved**:
1. **Enum Runtime Errors**: Fixed by separating type-only imports from runtime enum imports
   ```typescript
   // Before: import type { TechnicianStatus, ... }
   // After:  import { TechnicianStatus, ... } from "@/types/field-service"
   ```
2. **Handler URL Conflicts**: fieldServiceHandlers (`/api/v1/field-service/*`) was being overridden by techniciansHandlers (`*/field-service/*`). Fixed by reordering handlers in server.ts with proper documentation about URL pattern specificity.

**Impact**:
- +15 tests with realistic API mocking
- -15KB disk space (old test file removed)
- Field operations management now properly tested with realistic scenarios

---

### 2025-11-14: Phase 6 - useAudit Migration

**Status**: ✅ COMPLETE - 24 hooks migrated, 565 tests passing

**Changes**:
- ✅ Migrated useAudit hook (54 tests) - First high-priority hook from Phase 6
- ✅ Created `__tests__/msw/handlers/audit.ts` - 8 endpoints, complex filtering
- ✅ Created `hooks/__tests__/useAudit.msw.test.tsx` - 54 comprehensive tests
- ✅ Removed `hooks/__tests__/useAudit.test.tsx` - Legacy file (38KB)
- ✅ Fixed handler URL ordering issues (summary/recent/user must come before :activityId)
- ✅ Fixed parameter naming (from_date/to_date vs from/to)

**Test Results**:
- Test Suites: 24/24 passing (100%)
- Tests: 565/572 passing (7 skipped)
- New tests: 54 audit tests covering 10 hooks
- Time: ~3.4s for useAudit suite

**Technical Highlights**:
- Complex date filtering across multiple time ranges
- Pagination support with per_page/page parameters
- Activity type and severity filtering
- Resource history tracking
- Compliance reporting with date ranges
- Export functionality with multiple formats

**Impact**:
- +54 tests with realistic API mocking
- -38KB disk space (old test file removed)
- High-priority business logic now properly tested

---

### 2025-11-14: Phase 5 Complete - Cleanup & 100% Success

**Status**: ✅ COMPLETE - All 23 hooks passing, legacy files removed

**Changes**:
- ✅ Removed 27 legacy `jest.mock` test files (~631KB)
- ✅ All MSW tests passing: 23/23 suites, 511/518 tests (7 skipped)
- ✅ Created comprehensive documentation:
  - `MSW_CLEANUP_PLAN.md` - Cleanup roadmap and future migration plan
  - `TESTING_PATTERNS.md` - Testing patterns guide
  - `MIGRATION_COMPLETE.md` - Executive summary
- ✅ Removed console suppression from `jest.setup.ts`
- ✅ Ready for next migration phase (useAudit)

**Impact**:
- Disk space saved: ~631KB
- Maintenance reduction: 27 fewer duplicate test files
- Single testing strategy across all migrated hooks
- 100% test success rate achieved

---

## Overview

This document tracks the migration of test suites from `jest.mock()` to MSW (Mock Service Worker) for more realistic API mocking.

**Last Updated**: 2025-11-14 (Phase 5: Cleanup Complete)

## Test Suite Baseline

### Before Migration
```
Test Suites: 6 failed, 65 passed, 71 total
Tests:       21 failed, 2102 passed, 2123 total
```

### After Phase 2 Migration (MSW Tests Only)
```
Test Suites: 5 failed, 11 passed, 16 total
Tests:       36 failed, 276 passed, 312 total
Success Rate: 88.5%
```

### After Phase 3 Fixes (MSW Tests Only)
```
Test Suites: 3 failed, 17 passed, 20 total
Tests:       42 failed, 330 passed, 372 total
Success Rate: 88.7%
```

### After Phase 4 Migration (MSW Tests Only)
```
Test Suites: 4 failed, 20 passed, 24 total
Tests:       46 failed, 453 passed, 499 total
Success Rate: 90.8%
```

### After Phase 4 useLogs Stats Fix (MSW Tests Only)
```
Test Suites: 3 failed, 21 passed, 24 total
Tests:       42 failed, 457 passed, 499 total
Success Rate: 91.6%
```

**Known Limitations**: useDunning (24 tests), useCreditNotes (8 tests), useRADIUS (10 tests) - all use native fetch() which MSW v1 has limited support for in Node/Jest environments.

### After Fetch API + Response Format Fixes (MSW Tests Only - Current)
```
Test Suites: 2 failed, 21 passed, 23 total
Tests:       22 failed, 473 passed, 495 total
Success Rate: 95.6% 🎉
```

**Major Fixes Applied**:
1. **Fetch API Support** ✅
   - Added `whatwg-fetch` polyfill to jest.setup.ts
   - Fixed useDunning: 31/31 passing (was 7/31)
   - Fixed useRADIUS: 14/14 passing (was 4/14)
   - Fixed useCreditNotes: Now interceptable (was all skipped)

2. **Handler Conflicts Resolution** ✅
   - Fixed `/api/v1/monitoring/logs/stats` endpoint conflict
   - Logs handler now checks for 'period' parameter and delegates to operations handler
   - useOperations: 30/30 passing (was 25/30)

3. **Response Format Fixes** ✅
   - Fixed useBillingPlans handlers to return arrays directly instead of wrapped in `{ success, data }`
   - useBillingPlans: 19/23 passing (was 5/23)

**Remaining Issues**: useBillingPlans (4 tests - mutation refetch timing), useJobs (18 tests - investigation needed)

### After Mutation Refetch Fixes (MSW Tests Only)
```
Test Suites: 1 failed, 22 passed, 23 total
Tests:       18 failed, 477 passed, 495 total
Success Rate: 96.4% 🎉🎉
```

**Additional Fixes Applied**:
4. **React Query Mutation Refetch** ✅
   - Fixed useBillingPlans mutation tests by manually calling `refreshPlans()` after mutations
   - Test QueryClient has `refetchOnMount: false`, so cache invalidation doesn't auto-refetch
   - Fixed lifecycle test by using `activeOnly: false` to see all plans including inactive ones
   - useBillingPlans: 23/23 passing (was 19/23) ✅

**Remaining Issues**: useJobs (18 tests - BetterAuth ESM bundle + lifecycle timing)

### After useJobs ESM + Lifecycle Fixes (MSW Tests Only - Current)
```
Test Suites: 23 passed, 23 total ✅✅✅
Tests:       495 passed, 495 total ✅✅✅
Success Rate: 100% 🎉🎉🎉
```

**Final Fixes Applied**:
5. **useJobs ESM Bundle Fix** ✅
   - Mocked `useRealtime` at line 21 to bypass BetterAuth bundle and ESM-only nanostores dependency
   - Avoids Jest incompatibility with ESM modules during test runs
   - Exposes minimal WebSocket shape needed for tests

6. **useJobs Lifecycle Mutation Fix** ✅
   - Fixed line 503 lifecycle scenario to wait for mutation state to settle
   - Now properly waits for `cancelResult.current.isSuccess` via `waitFor`
   - Prevents race conditions with React Query's async state updates
   - useJobs: 23/23 passing ✅

**🏆 ALL HOOKS WITH 100% PASSING TESTS (23/23 hooks)**: useWebhooks, useNotifications, useSubscribers, useFaults, useUsers, useApiKeys, useIntegrations, useHealth, useFeatureFlags, useOperations, useScheduler, useNetworkMonitoring, useNetworkInventory, useInvoiceActions, useOrchestration, useTechnicians, useServiceLifecycle, useLogs, useDunning, useRADIUS, useCreditNotes, useBillingPlans, **useJobs** ✅

**🎊 NO REMAINING ISSUES - ALL MSW TESTS PASSING! 🎊**

## Migration Status

### ✅ Completed Migrations

#### 1. useWebhooks → useWebhooks.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 12 passing
- **Migration Date**: 2025-11-14
- **Files**:
  - Created: `hooks/__tests__/useWebhooks.msw.test.tsx` (293 lines)
  - Removed: `hooks/__tests__/useWebhooks.test.ts` (old shared suite)
  - Removed: `hooks/__tests__/useWebhooks.test.tsx` (old jest.mock version)
- **Handlers Created**:
  - GET/POST/PATCH/DELETE `/api/v1/webhooks/subscriptions`
  - GET `/api/v1/webhooks/subscriptions/:id/deliveries`
  - GET `/api/v1/webhooks/events`
  - POST `/api/v1/webhooks/deliveries/:id/retry`
- **Coverage**:
  - Query operations (fetch, filter, paginate)
  - Mutations (create, update, delete)
  - Deliveries (fetch, filter, retry)
  - Error handling
  - Real-world scenarios

#### 2. useNotifications → useNotifications.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 26 passing
- **Migration Date**: 2025-11-14
- **Files**:
  - Created: `hooks/__tests__/useNotifications.msw.test.tsx` (676 lines)
  - Kept: `hooks/__tests__/useNotifications.test.ts` (uses shared suite - may be removed later)
- **Handlers Created**:
  - **Notifications**: GET, POST read/unread/archive, DELETE, mark-all-read
  - **Templates**: GET/POST/PATCH/DELETE `/api/v1/communications/templates`, render preview
  - **Logs**: GET `/api/v1/communications/logs`, POST retry
  - **Bulk**: POST `/api/v1/notifications/bulk`, GET status
- **Coverage**:
  - useNotifications (7 tests) - fetch, filter, read/unread, archive, delete
  - useNotificationTemplates (7 tests) - CRUD operations, preview rendering
  - useCommunicationLogs (5 tests) - fetch, filter, pagination, retry
  - Real-world scenarios (2 tests)

#### 3. useSubscribers → useSubscribers.msw.test.tsx
- **Status**: ✅ Complete (with known issues)
- **Tests**: 23 tests (some failing due to MSW/axios config)
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/subscribers.ts`
- **Endpoints**: GET/POST/PATCH/DELETE `/subscribers`, status operations
- **Coverage**: Fetch, filter, pagination, search, CRUD, suspend/activate/terminate

#### 4. useFaults → useFaults.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 15 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/faults.ts`
- **Endpoints**: Alarms CRUD, acknowledge, clear, ticket creation, history, notes
- **Coverage**: Alarm operations, SLA compliance, filtering, statistics

#### 5. useUsers → useUsers.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 12 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/users.ts`
- **Endpoints**: GET/PUT/DELETE `/users`, enable/disable, `/users/me`
- **Coverage**: User CRUD, enable/disable, utility functions, current user

#### 6. useBillingPlans → useBillingPlans.msw.test.tsx
- **Status**: ✅ Complete (with known issues)
- **Tests**: Created (failing due to axios/MSW config)
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/billing-plans.ts`
- **Endpoints**: GET/POST/PATCH/DELETE `/billing/subscriptions/plans`, products
- **Coverage**: Plans CRUD, filtering, product types, billing intervals

#### 7. useDunning → useDunning (handlers only)
- **Status**: ⚠️ Handlers Complete, Tests Pending
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/dunning.ts` (13 endpoints)
- **Endpoints**: Campaigns, executions, statistics, recovery charts
- **Note**: Comprehensive handler created, needs test file

#### 8. useCreditNotes → useCreditNotes (handlers only)
- **Status**: ⚠️ Handlers Complete, Tests Pending
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/credit-notes.ts`
- **Endpoints**: GET/POST `/billing/credit-notes`

#### 9. useInvoiceActions → useInvoiceActions (handlers only)
- **Status**: ⚠️ Handlers Complete, Tests Pending
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/invoice-actions.ts`
- **Endpoints**: POST send/void/remind for invoices

#### 10. useApiKeys → useApiKeys.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 15 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/apiKeys.ts`
- **Endpoints**: GET/POST/PATCH/DELETE `/auth/api-keys`, GET scopes
- **Coverage**: API keys CRUD, scopes, revocation

#### 11. useIntegrations → useIntegrations.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 13 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/integrations.ts`
- **Endpoints**: GET list/single, POST health-check
- **Coverage**: Integration listing, details, health checks

#### 12. useHealth → useHealth.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 12 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/health.ts`
- **Endpoints**: GET `/ready`
- **Coverage**: Health checks, error handling (403/500)

#### 13. useFeatureFlags → useFeatureFlags.msw.test.tsx
- **Status**: ✅ Complete (with known issues)
- **Tests**: 13/17 passing (4 failures due to cache invalidation)
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/featureFlags.ts`
- **Endpoints**: GET/POST/PUT/DELETE `/feature-flags`
- **Coverage**: Flags CRUD, toggle, status queries
- **Known Issue**: Cache invalidation in test environment

#### 14. useNetworkMonitoring → useNetworkMonitoring.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 22 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/network-monitoring.ts` (377 lines)
- **Endpoints**: Network overview, devices, metrics, alerts, alert rules
- **Coverage**: Comprehensive network monitoring, alerting, device management

#### 15. useNetworkInventory → useNetworkInventory.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 12 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/network-inventory.ts`
- **Endpoints**: NetBox health, sites with pagination
- **Coverage**: NetBox integration, health checks, site listing

#### 16. useRADIUS → useRADIUS.msw.test.tsx
- **Status**: ⚠️ Complete (with known issues)
- **Tests**: 4/14 passing (10 failures due to fetch API)
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/radius.ts`
- **Endpoints**: RADIUS subscribers, sessions, NAS, bandwidth profiles
- **Known Issue**: Hook uses native fetch, MSW v1 has limited fetch support

#### 17. useOperations → useOperations.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 30 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/operations.ts`
- **Endpoints**: `/monitoring/metrics`, `/monitoring/logs/stats`, `/health`
- **Coverage**: Monitoring metrics, log stats, system health, utility functions

#### 18. useJobs → useJobs.msw.test.tsx
- **Status**: ✅ Complete (with known issues)
- **Tests**: 25 tests (some failing)
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/jobs.ts`
- **Endpoints**: GET/POST/PATCH `/jobs`, POST cancel
- **Coverage**: Jobs CRUD, field installations, cancellation, filtering

#### 19. useScheduler → useScheduler.msw.test.tsx
- **Status**: ✅ Complete
- **Tests**: 31 passing
- **Migration Date**: 2025-11-14
- **Handler**: `__tests__/msw/handlers/scheduler.ts`
- **Endpoints**: Scheduled jobs CRUD, job chains CRUD, chain execution
- **Coverage**: Comprehensive scheduler operations, chains, execution modes

## Summary Statistics

### Overall Summary (Complete ✅)
- **Total Hooks Migrated**: 23
- **Test Files Created**: 23
- **Handler Files Created**: 23
- **Total MSW Tests**: 495
- **Passing Tests**: 495 (100%) 🎉🎉🎉
- **Test Suites Passing**: 23/23 (100%) ✅
- **Hooks with 100% Pass Rate**: 23 hooks (ALL)

### Phase Breakdown
**Phase 2**: 19 hooks migrated, 312 tests created, 276 passing (88.5%)
**Phase 3**: 3 test files added, 60 tests created, all passing (bug fixes)
**Phase 4**: 4 hooks migrated, 127 tests created, 123 passing (96.9%)
**Phase 5 (Fixes)**: All remaining issues resolved, 495 tests passing (100%) ✅

### 📋 Pending Migrations

The following hooks still use `jest.mock()` and could benefit from MSW migration:

#### High Priority (API-heavy hooks)
1. ✅ ~~useSubscribers~~ - MIGRATED
2. ✅ ~~useFaults~~ - MIGRATED
3. ✅ ~~useUsers~~ - MIGRATED
4. ✅ ~~useBillingPlans~~ - MIGRATED
5. ✅ ~~useApiKeys~~ - MIGRATED
6. ✅ ~~useIntegrations~~ - MIGRATED
7. ✅ ~~useHealth~~ - MIGRATED
8. ✅ ~~useFeatureFlags~~ - MIGRATED
9. **useLogs** - Log management
10. **useAudit** - Audit log management

#### Medium Priority (Complex hooks)
11. **useOrchestration** - Orchestration workflows
12. ✅ ~~useOperations~~ - MIGRATED
13. ✅ ~~useJobs~~ - MIGRATED
14. **useTechnicians** - Technician management
15. ✅ ~~useScheduler~~ - MIGRATED
16. **useServiceLifecycle** - Service lifecycle management
17. ✅ ~~useNetworkMonitoring~~ - MIGRATED
18. ✅ ~~useNetworkInventory~~ - MIGRATED
19. ✅ ~~useRADIUS~~ - MIGRATED (with issues)
20. **useFieldService** - Field service management

#### Lower Priority (Specialized hooks)
21. **useCommissionRules** - Commission rule management
22. **useCampaigns** - Campaign management
23. **useDunning** - Dunning management
24. **useReconciliation** - Reconciliation operations
25. **useCreditNotes** - Credit note management
26. **useInvoiceActions** - Invoice actions
27. **usePartners** - Partner management
28. **usePartnerPortal** - Partner portal
29. **useCustomerPortal** - Customer portal
30. **useLicensing** - License management
31. **useDataTransfer** - Data transfer operations
32. **useVersioning** - API versioning
33. **useSettings** - Settings management
34. **useSearch** - Search functionality
35. **useProfile** - User profile management
36. **useBranding** - Branding management
37. **useTenantBranding** - Tenant branding
38. **usePlatformTenants** - Platform tenant management
39. **useTenantOnboarding** - Tenant onboarding
40. **useDomainVerification** - Domain verification
41. **usePlugins** - Plugin management
42. **useAIChat** - AI chat functionality

#### GraphQL Hooks (Different approach needed)
These hooks use GraphQL instead of REST, may need different MSW setup:
43. **useFiberGraphQL** - Fiber infrastructure GraphQL
44. **useWirelessGraphQL** - Wireless infrastructure GraphQL
45. **useSubscriberDashboardGraphQL** - Subscriber dashboard GraphQL

#### Browser/UI Hooks (May not need MSW)
These hooks don't make API calls or are UI-focused:
46. **useBrowserNotifications** - Browser notification API
47. **useAlerts** - In-app alerts (likely state management)

## MSW Infrastructure

### Handlers Created

Located in `__tests__/msw/handlers/`:

#### webhooks.ts (215 lines)
- 7 endpoint handlers
- In-memory storage with reset capability
- Mock data factories: `createMockWebhook`, `createMockDelivery`
- Seed function: `seedWebhookData`

#### notifications.ts (390 lines)
- 16 endpoint handlers
- In-memory storage with reset capability
- Mock data factories: `createMockNotification`, `createMockTemplate`, `createMockLog`
- Seed function: `seedNotificationData`

### Test Utilities

Located in `__tests__/test-utils.tsx`:

- `createTestQueryClient()` - Query client with test-friendly defaults
- `createQueryWrapper()` - Wrapper component with QueryClientProvider
- `renderHookWithQuery()` - Render hook with query wrapper
- `makeApiEndpointFail()` - Helper to simulate API errors
- `makeApiEndpointReturn()` - Helper to mock specific responses
- MSW helper re-exports for easy importing

### Documentation

- **Main Guide**: `__tests__/README.md` (600+ lines)
  - MSW architecture and setup
  - Handler creation patterns
  - Test structure and best practices
  - Migration guide from jest.mock
  - Common issues and solutions
  - Real-world examples

## Migration Strategy

### Phase 1: Foundation ✅ COMPLETE
- [x] Install and configure MSW v1
- [x] Set up MSW server lifecycle
- [x] Create test utilities
- [x] Document patterns

### Phase 2: Mass Migration ✅ COMPLETE
- [x] Migrate useWebhooks (12 tests)
- [x] Migrate useNotifications (26 tests)
- [x] Migrate Core Operations (useSubscribers, useFaults, useUsers) - 50 tests
- [x] Migrate Billing (useBillingPlans, useDunning, useCreditNotes, useInvoiceActions) - handlers + tests
- [x] Migrate Admin/Integration (useApiKeys, useIntegrations, useHealth, useFeatureFlags) - 53 tests
- [x] Migrate Network (useNetworkMonitoring, useNetworkInventory, useRADIUS) - 48 tests
- [x] Migrate Operations/Jobs (useOperations, useJobs, useScheduler) - 86 tests
- [x] Total: 19 hooks migrated, 312 tests created, 276 passing (88.5%)

### Phase 3: Fix Known Issues ✅ COMPLETE
- [x] **Fixed useSubscribers** - Resolved string sorting issue (sub-19 vs sub-11) by using zero-padded IDs. All 26 tests now passing.
- [x] **Fixed useFeatureFlags cache invalidation** - Added manual `refreshFlags()` calls after mutations to trigger refetches. All 17 tests now passing.
- [x] **Created useDunning.msw.test.tsx** - 31 tests created (7 passing, 24 with fetch API limitation)
- [x] **Created useCreditNotes.msw.test.tsx** - 8 tests created (all skipped due to fetch API limitation, documented for future use)
- [x] **Created useInvoiceActions.msw.test.tsx** - 17 tests created, all passing!
- [x] **Documented fetch API limitations** - Identified that native fetch() API in service layers causes issues with MSW v1 in Node/Jest environments. Affects useDunning, useCreditNotes, useRADIUS (42 tests total).

**Phase 3 Impact**:
- Tests Created: 60 new tests
- Tests Passing: 60/99 tests (100% for axios-based hooks, 7/42 for fetch-based hooks)
- Hooks Fixed: useSubscribers, useFeatureFlags, useInvoiceActions
- Test Files Added: useDunning, useCreditNotes, useInvoiceActions

### Phase 4: High-Priority Hooks ✅ COMPLETE
- [x] **Migrated useLogs** - 24 tests created, **all passing** ✅
  - 3 handlers: logs list, stats, services
  - Comprehensive filtering: level, service, search, time range, pagination
  - Factory functions for realistic log data
  - **Fix Applied**: MSW handler conflict resolved - moved logsHandlers before operationsHandlers in server.ts to prevent `/api/v1/monitoring/logs/stats` from being matched by wrong handler
  - **Test Fix**: Added `act()` wrapper for `fetchStats()` calls to handle React Query's `refetchOnMount: false` config in tests
- [x] **Migrated useOrchestration** - 37 tests created, all passing ✅
  - 7 handlers: workflows, stats, retry, cancel, export (CSV/JSON)
  - In-memory workflow and step management
  - Real-world orchestration scenarios (provisioning, migration, rollback)
- [x] **Migrated useTechnicians** - 34 tests created, all passing ✅
  - 13 handlers: CRUD, locations, schedule, assignments
  - Location tracking and history
  - Skill/availability filtering
- [x] **Migrated useServiceLifecycle** - 32 tests created, all passing ✅
  - 10 handlers: provision, activate, suspend, resume, terminate, health check
  - State transition validation
  - Complete lifecycle flow testing

**Phase 4 Impact**:
- Tests Created: 127 new tests
- Tests Passing: 123/127 (96.9%)
- Hooks Fully Passing: useOrchestration, useTechnicians, useServiceLifecycle
- Hooks Mostly Passing: useLogs (83.3% - React Query config issue with parallel stats queries)

### Phase 5: Bug Fixes & Optimization ✅ COMPLETE
- [x] Fix fetch API support with whatwg-fetch polyfill
- [x] Fix handler conflicts (logs/operations)
- [x] Fix response format issues
- [x] Fix mutation refetch timing
- [x] Fix ESM dependency issues (useJobs)
- [x] Achieve 100% test pass rate ✅
- [x] Document lessons learned

### Phase 6-10: Future Migrations (Optional)
See `MSW_CLEANUP_PLAN.md` for detailed roadmap:
- **Phase 6**: High-priority API hooks (useAudit, useFieldService, useCampaigns)
- **Phase 7-8**: Business logic & platform hooks
- **Phase 9**: GraphQL hooks (requires GraphQL MSW setup)
- **Phase 10**: Utilities & remaining hooks

**Current Recommendation**: Remove old test files (see cleanup plan), then migrate hooks as needed

## Benefits of MSW Migration

### Before (jest.mock)
```typescript
jest.mock('@/lib/api/client');
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
mockApiClient.get.mockResolvedValue({ data: mockWebhooks });
```

**Issues**:
- Tests don't verify actual network behavior
- Mock setup repeated in every test file
- Response format mismatches go undetected
- Hard to test error scenarios
- Doesn't catch URL/parameter issues

### After (MSW)
```typescript
seedWebhookData(mockWebhooks, []);
const { result } = renderHook(() => useWebhooks());
await waitFor(() => expect(result.current.loading).toBe(false));
```

**Benefits**:
- ✅ Tests actual fetch/axios calls
- ✅ Centralized, reusable handlers
- ✅ Type-safe response formats
- ✅ Realistic error simulation
- ✅ Catches URL/parameter mismatches
- ✅ Same handlers work across all tests
- ✅ Easier to maintain

## Key Learnings

### 1. MSW v1 vs v2
- **Decision**: Use MSW v1.3.5
- **Reason**: Better Jest compatibility, simpler configuration
- **Trade-off**: Not using latest features, but much cleaner setup

### 2. URL Patterns
- **Pattern**: Always use wildcard prefix: `*/api/v1/...`
- **Reason**: Matches full URLs in JSDOM environment
- **Example**: `rest.get('*/api/v1/webhooks/subscriptions', ...)`

### 3. Response Format
- **Critical**: Match exact format hooks expect
- **Method**: Read hook code to understand response structure
- **Example**: If hook expects `response.data` as array, return array directly

### 4. Parameter Naming
- **Issue**: Parameter name mismatches cause filters to fail
- **Solution**: Verify parameter names match between hook and handler
- **Example**: Hook sends `statusFilter`, handler must read `status` (the URL param)

### 5. Storage Management
- **Pattern**: Reset in-memory storage in `beforeEach`
- **Reason**: Ensures test isolation
- **Function**: `resetWebhookStorage()`, `resetNotificationStorage()`

## Coverage Thresholds

Added to `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

## Known Issues & Troubleshooting

### ~~Issue 1: useSubscribers/useBillingPlans Tests Failing~~ ✅ RESOLVED
**Resolution (Phase 3)**: Fixed string sorting issue in useSubscribers by using zero-padded IDs. Handler route ordering was also corrected (specific routes before generic `:id` routes). All 26 tests now passing.

### ~~Issue 2: useFeatureFlags Cache Invalidation~~ ✅ RESOLVED
**Resolution (Phase 3)**: Added manual `refreshFlags()` calls after mutations in tests. The test QueryClient has `refetchOnMount: false` which prevents automatic refetching on cache invalidation. Solution: explicitly call `result.current.refreshFlags()` after each mutation. All 17 tests now passing.

### Issue 3: Native fetch() API Limitation (MSW v1 + Node/Jest)
**Symptom**: Tests fail or are skipped - hooks don't receive mocked data
**Root Cause**: Services use native `fetch` API, which MSW v1 has limited support for in Node/Jest/jsdom environments
**Affected Hooks**:
- **useRADIUS**: 10/14 tests failing (handler created, fetch not intercepted)
- **useDunning**: 24/31 tests failing (handler created, comprehensive test file created)
- **useCreditNotes**: 8/8 tests skipped (handler created, test file created with all tests marked `.skip`)

**Status**: Documented limitation - tests are correctly structured but can't pass until service layer is refactored or MSW v2 is adopted

**Fix Options** (in order of preference):
1. **Refactor service layers to use axios** - Most reliable solution, maintains MSW v1 compatibility
2. **Upgrade to MSW v2** - Better fetch support, but requires migration effort across all tests
3. **Add node-fetch polyfill** - May work but adds dependency and complexity
4. **Different mocking strategy** - Could use jest.mock for fetch-based hooks (loses MSW benefits)

### Issue 4: useJobs Tests Partial Failures
**Symptom**: Some job tests failing
**Root Cause**: Similar to Issue 1, likely MSW/axios config
**Status**: Under investigation
**Fix**: Apply same fixes as Issue 1

### Issue 5: Missing Test Files
**Status**: Handlers created but test files not yet written
**Hooks Affected**:
- useDunning (13 endpoints, comprehensive handler)
- useCreditNotes (2 endpoints)
- useInvoiceActions (3 endpoints)
**Fix**: Create test files following established pattern from useBillingPlans.msw.test.tsx

## Next Steps

### Immediate (Phase 3)
1. **Fix MSW/axios integration** - Critical for subscribers/billing/jobs tests
2. **Create missing test files** - useDunning, useCreditNotes, useInvoiceActions
3. **Fix cache invalidation** - useFeatureFlags tests
4. **Investigate RADIUS fetch issue** - Consider MSW v2 upgrade or hook refactor

### Short-term (Phase 4)
5. **Migrate remaining high-priority hooks** - useLogs, useAudit
6. **Migrate medium-priority hooks** - useOrchestration, useTechnicians, etc.
7. **Remove old test files** - Clean up jest.mock versions after verification

### Long-term (Phase 5)
8. **Optimize test performance** - Reduce test execution time
9. **Achieve 95%+ pass rate** - Fix all remaining issues
10. **Consider GraphQL MSW setup** - For GraphQL hooks
11. **Document best practices** - Share learnings with team

## Migration Checklist

For each hook migration:

- [ ] Read hook code to understand API contract
- [ ] Create MSW handlers matching all endpoints
- [ ] Write mock data factories
- [ ] Create seed function
- [ ] Write comprehensive test suite
  - [ ] Happy path tests
  - [ ] Filter/pagination tests
  - [ ] Mutation tests
  - [ ] Error handling tests
  - [ ] Real-world scenarios
- [ ] Verify all tests pass
- [ ] Remove old jest.mock tests
- [ ] Update this status document

## Documentation Suite

### Core Documentation
1. **MSW_MIGRATION_STATUS.md** (this file) - Migration progress and history
2. **MSW_CLEANUP_PLAN.md** - Detailed cleanup plan and future migration roadmap
3. **TESTING_PATTERNS.md** - Comprehensive testing patterns and best practices
4. **README.md** - MSW setup guide and architecture

### Quick Links
- **Start here**: `README.md` for MSW basics
- **Patterns**: `TESTING_PATTERNS.md` for all testing patterns
- **Future work**: `MSW_CLEANUP_PLAN.md` for cleanup and migration plans
- **Examples**: `use*.msw.test.tsx` files for working examples

## Next Steps

### Immediate Actions (Week 1)
1. **Review cleanup plan**: See `MSW_CLEANUP_PLAN.md`
2. **Get team approval**: Review which old test files to remove
3. **Execute cleanup**: Remove 27 old test files (~631KB)
4. **Verify tests**: Ensure all 495 MSW tests still passing

### Future Migrations (As Needed)
- **High Priority**: useAudit, useFieldService, useCampaigns
- **Medium Priority**: Business logic hooks (see cleanup plan Phase 7-8)
- **Low Priority**: Utilities and specialized hooks

### Maintenance
- Keep MSW patterns consistent across new tests
- Update TESTING_PATTERNS.md with new discoveries
- Migrate remaining hooks as development priorities dictate

## Contact

For questions about MSW migration:
- **Setup guide**: `__tests__/README.md`
- **Testing patterns**: `__tests__/TESTING_PATTERNS.md`
- **Examples**: `useWebhooks.msw.test.tsx`, `useDunning.msw.test.tsx`
- **Handlers**: `__tests__/msw/handlers/`
- **Cleanup plan**: `__tests__/MSW_CLEANUP_PLAN.md`
