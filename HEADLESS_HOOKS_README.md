# Headless Package Hooks - Exploration & Integration Guide

## Overview

This directory contains comprehensive documentation about the headless package hooks available in the dotmac-ftth-ops frontend application.

**Location**: `/frontend/shared/packages/headless/src/hooks`

## Documents in This Package

### 1. HEADLESS_HOOKS_CATALOG.md
**The Main Reference Document** (26 KB)

Complete catalog of all 50+ hooks organized by category:
- Billing & Payments (5 hooks)
- Communication & Messaging (1 hook)
- Notifications (5 hooks)
- Analytics (3 hooks)
- Audit & Logging (1 hook)
- Real-time & WebSocket (6 hooks)
- Commission & Partner (3 hooks)
- Tenant Management (5 hooks)
- Performance Monitoring (5 hooks)

For each hook includes:
- File path
- Purpose & description
- Parameters & configuration
- Returned methods & state
- WebSocket events handled
- Usage examples patterns

### 2. HEADLESS_HOOKS_INTEGRATION_MATRIX.md
**Integration & Implementation Status** (15 KB)

Maps which hooks are integrated vs. missing:
- Integration status overview (28 production-ready hooks)
- Feature matrix for each domain
- Integration dependencies diagram
- Migration path for gaps (Phases 1-3)
- Current API integration status
- Testing coverage matrix
- Performance benchmarks
- Known limitations
- Future roadmap (v2.0-v4.0)

### 3. HEADLESS_HOOKS_README.md
**This File** - Quick Navigation Guide

## Quick Start by Use Case

### Building a Billing Feature
1. Read: HEADLESS_HOOKS_CATALOG.md > Section 1 (Billing & Payments)
2. Use: `useBilling()` for main operations
3. Add: `usePaymentProcessor()` for multi-processor support
4. Validate: `usePaymentValidation()` for input validation
5. Secure: `usePaymentSecurity()` for tokenization
6. Check: HEADLESS_HOOKS_INTEGRATION_MATRIX.md > Payment Processing

### Building a Communication Feature
1. Read: HEADLESS_HOOKS_CATALOG.md > Section 2 (Communication)
2. Use: `useCommunication()` for all channels
3. Reference: Integration matrix for supported channels
4. Monitor: WebSocket events for delivery status

### Building Analytics Dashboard
1. Read: HEADLESS_HOOKS_CATALOG.md > Section 4 (Analytics)
2. Use: `useAnalytics()` for comprehensive data
3. Or: `useRevenueAnalytics()` / `useCustomerAnalytics()` for focused metrics
4. Enable: Real-time with `enableRealTime: true`
5. Export: CSV/Excel/PDF support

### Building Real-time Features
1. Read: HEADLESS_HOOKS_CATALOG.md > Section 6 (Real-time)
2. Choose:
   - `useWebSocket()` for simple subscriptions
   - `useRealTimeSync()` for complex bi-directional communication
3. Specialize: Use `useNetworkMonitoring()` / `useCustomerActivity()` / `useFieldOperations()` as needed

### Building Tenant-aware Features
1. Read: HEADLESS_HOOKS_CATALOG.md > Section 8 (Tenant Management)
2. Start: Wrap with `useISPTenant()` context
3. Check: Permissions with `hasPermission()`
4. Monitor: Limits with `isLimitReached()`
5. Apply: Branding with `applyBranding()`

### Audit & Compliance
1. Read: HEADLESS_HOOKS_CATALOG.md > Section 5 (Audit & Logging)
2. Use: `useAuditLogger()` for all sensitive operations
3. Configure: Batch size and timeout
4. Enable: Offline storage for resilience

## Hook Categories at a Glance

| Category | Main Hook | Sub-hooks | Real-time | Caching | TanStack Query |
|----------|-----------|-----------|-----------|---------|-----------------|
| Billing | useBilling | 4 | Yes (WS) | Yes | No |
| Communication | useCommunication | 0 | Yes (WS) | No | No |
| Notifications | useNotifications | 4 | No | No | No (Zustand) |
| Analytics | useAnalytics | 2 | Yes (WS) | Yes | Yes |
| Audit | useAuditLogger | 0 | No | No | No |
| Real-time | useRealTimeSync | 3 | Yes (Socket.io) | No | No |
| Commission | useCommissions | 2 | No | No | Yes |
| Tenant | useISPTenant | 4 | No | No | No |
| Performance | usePerformanceMonitoring | 4 | No | No | No |

## Key Integration Patterns

### 1. State Management
- **Zustand**: Notifications (global state)
- **React Query**: Analytics, Commissions (server state)
- **Component State**: Local UI interactions
- **WebSocket**: Real-time updates

### 2. Real-time Communication
- **Native WebSocket**: Direct server connection
- **Socket.io**: Bi-directional communication with fallbacks
- **Polling**: Fallback for non-real-time operations

### 3. Data Caching
- **React Query**: 1-5 minute TTL
- **Payment Cache**: 5-minute TTL with custom duration
- **Manual Cache**: For specific use cases

### 4. Error Handling
- **Standardized notifications** via `useNotifications()`
- **API-specific errors** via `useApiErrorNotifications()`
- **Global error listener** via `useGlobalErrorListener()`
- **Audit logging** via `useAuditLogger()`

## Currently Integrated (28 Hooks)

**Billing (5)**: useBilling, usePaymentProcessor, usePaymentCache, usePaymentValidation, usePaymentSecurity

**Communication (1)**: useCommunication

**Notifications (4)**: useNotifications, useApiErrorNotifications, useErrorNotifications, useGlobalErrorListener

**Analytics (3)**: useAnalytics, useRevenueAnalytics, useCustomerAnalytics

**Audit (1)**: useAuditLogger

**Real-time (6)**: useWebSocket, useRealTimeSync, useRealTimeEvent, useRealTimeData, useNetworkMonitoring, useCustomerActivity, useFieldOperations

**Commission (3)**: useCommissions, useCommissionCalculator, usePayoutHistory

**Tenant (4)**: useISPTenant, useTenantSession, useTenantPermissions, useTenantLimits

**Performance (5)**: usePerformanceMonitoring, usePerformanceObservers, useMetricTracking, usePerformanceReporting, useApiPerformanceTracking

## Missing / Planned (High Priority)

1. **useCustomers()** - Customer list, detail, editing
2. **useSearch()** - Full-text search capabilities
3. **useScheduling()** - Task scheduling
4. **useWorkflow()** - Workflow automation
5. **useOfflineSync()** - Offline-first support
6. **useCacheManager()** - Centralized cache control

See HEADLESS_HOOKS_INTEGRATION_MATRIX.md for detailed migration plan.

## Performance Considerations

| Hook | Avg Load | Memory | Cache TTL |
|------|----------|--------|-----------|
| useBilling | 250ms | 2.5MB | 1 min |
| useAnalytics | 400ms | 4.2MB | 1 min |
| useWebSocket | Varies | 0.5-2MB | N/A |
| useNotifications | <50ms | 0.3MB | Real-time |
| useISPTenant | 100ms | 0.8MB | On demand |

See HEADLESS_HOOKS_INTEGRATION_MATRIX.md for complete benchmarks.

## Common Integration Checklist

When integrating a new feature:

- [ ] Start with `useISPTenant()` for context
- [ ] Use `useNotifications()` for feedback
- [ ] Check `useTenantPermissions()` for access control
- [ ] Monitor `useTenantLimits()` for quotas
- [ ] Add `useAuditLogger()` for audit trail
- [ ] Use `usePerformanceMonitoring()` for metrics
- [ ] Handle errors with `useApiErrorNotifications()`
- [ ] Choose real-time strategy: WebSocket vs Socket.io vs Polling
- [ ] Configure caching strategy: React Query vs Manual vs None
- [ ] Document in Storybook or example file

## File Organization

```
/frontend/shared/packages/headless/src/
├── hooks/
│   ├── payment/
│   │   ├── usePaymentCache.ts
│   │   ├── usePaymentValidation.ts
│   │   └── usePaymentSecurity.ts
│   ├── performance/
│   │   ├── usePerformanceMonitoring.ts
│   │   ├── usePerformanceObservers.ts
│   │   ├── useMetricTracking.ts
│   │   ├── usePerformanceReporting.ts
│   │   └── useApiPerformanceTracking.ts
│   ├── tenant/
│   │   ├── useTenantSession.ts
│   │   ├── useTenantPermissions.ts
│   │   ├── useTenantLimits.ts
│   │   ├── useTenantSettings.ts
│   │   └── useTenantNotifications.ts
│   ├── useBilling.ts
│   ├── usePaymentProcessor.ts
│   ├── useCommunication.ts
│   ├── useNotifications.ts
│   ├── useAnalytics.ts
│   ├── useAuditLogger.ts
│   ├── useRealTimeSync.ts
│   ├── useWebSocket.ts
│   ├── useCommissions.ts
│   └── useISPTenant.ts
```

## Related Documentation

- `/frontend/shared/packages/headless/src` - Main headless package
- `/frontend/apps/isp-ops-app` - Main ISP operations app using hooks
- `/frontend/apps/platform-admin-app` - Admin app using hooks

## Recommended Reading Order

1. **First**: HEADLESS_HOOKS_INTEGRATION_MATRIX.md (5 min overview)
2. **Then**: HEADLESS_HOOKS_CATALOG.md (detailed reference)
3. **Finally**: Implementation-specific sections based on your feature

## Quick Links to Sections

### In HEADLESS_HOOKS_CATALOG.md

- [Billing Hooks](#billing--payments-hooks) - Lines 1-150
- [Communication Hooks](#communication--messaging-hooks) - Lines 151-250
- [Notification Hooks](#notification-hooks) - Lines 251-350
- [Analytics Hooks](#analytics-hooks) - Lines 351-450
- [Audit Hooks](#audit--logging-hooks) - Lines 451-550
- [Real-time Hooks](#real-time--websocket-hooks) - Lines 551-700
- [Commission Hooks](#commission--partner-hooks) - Lines 701-800
- [Tenant Hooks](#tenant-management-hooks) - Lines 801-950
- [Performance Hooks](#performance-monitoring-hooks) - Lines 951-1050
- [Integration Patterns](#integration-patterns) - Lines 1051-1150
- [Usage Recommendations](#usage-recommendations) - Lines 1151-1250

### In HEADLESS_HOOKS_INTEGRATION_MATRIX.md

- [Integration Status](#integration-status-overview) - Lines 1-100
- [Feature Matrix](#feature-matrix) - Lines 101-250
- [Dependencies](#integration-dependencies) - Lines 251-350
- [Migration Path](#migration-path-gaps-to-production) - Lines 351-450
- [Testing Coverage](#testing-coverage) - Lines 451-500
- [Recommended Order](#recommended-integration-order) - Lines 501-550
- [Benchmarks](#performance-benchmarks) - Lines 551-600
- [Roadmap](#future-roadmap) - Lines 601-650

## Support & Questions

For questions about specific hooks:
1. Check the catalog for detailed parameters and examples
2. Review the integration matrix for feature availability
3. Look at existing implementations in app components
4. Check recent commits for usage patterns

## Status

- **Documentation Updated**: November 2024
- **Hooks Catalogued**: 50+
- **Production Ready**: 28 hooks
- **In Development**: 2 hooks
- **Planned/Missing**: 9+ hooks

---

**Remember**: Always start with `useISPTenant()` to ensure proper tenant context!

For the complete, detailed reference, see: **HEADLESS_HOOKS_CATALOG.md**
For integration status & roadmap, see: **HEADLESS_HOOKS_INTEGRATION_MATRIX.md**
