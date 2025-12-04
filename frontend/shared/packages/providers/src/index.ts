/**
 * Universal Provider System for DotMac Frontend Applications
 * Provides standardized provider patterns across all portals
 */

// Core provider aggregator
export { UniversalProviders } from "./UniversalProviders";

// Local components only - avoiding problematic external re-exports for now
export { ErrorBoundary } from "./components/ErrorBoundary";

// Re-export RBAC provider and hooks
export { RBACProvider, usePermissions, useRBAC, checkPermission } from "@dotmac/rbac";

// Re-export types from RBAC
export type { Role, Permission, User } from "@dotmac/rbac";

// Re-export auth-related types (AuthVariant was removed - Better Auth configured at app level)
export type { FeatureFlags, TenantVariant } from "./UniversalProviders";

// Default configurations for each portal
export const PORTAL_DEFAULTS = {
  customer: {
    features: {
      notifications: true,
      realtime: false,
      analytics: false,
      tenantManagement: true,
      errorHandling: true,
      performanceMonitoring: true,
    },
    theme: "customer",
    cacheStrategy: "aggressive",
  },
  admin: {
    features: {
      notifications: true,
      realtime: true,
      analytics: true,
      tenantManagement: true,
      errorHandling: true,
      performanceMonitoring: true,
    },
    theme: "admin",
    cacheStrategy: "balanced",
  },
  reseller: {
    features: {
      notifications: true,
      realtime: false,
      analytics: true,
      tenantManagement: false,
      errorHandling: true,
      performanceMonitoring: false,
    },
    theme: "reseller",
    cacheStrategy: "conservative",
  },
  technician: {
    features: {
      notifications: false,
      realtime: false,
      analytics: false,
      tenantManagement: false,
      errorHandling: true,
      performanceMonitoring: false,
    },
    theme: "technician",
    cacheStrategy: "minimal",
  },
  "management-admin": {
    features: {
      notifications: true,
      realtime: true,
      analytics: true,
      tenantManagement: true,
      errorHandling: true,
      performanceMonitoring: true,
    },
    theme: "management",
    cacheStrategy: "aggressive",
  },
  "management-reseller": {
    features: {
      notifications: true,
      realtime: false,
      analytics: true,
      tenantManagement: false,
      errorHandling: true,
      performanceMonitoring: false,
    },
    theme: "management-reseller",
    cacheStrategy: "balanced",
  },
  "tenant-portal": {
    features: {
      notifications: true,
      realtime: false,
      analytics: false,
      tenantManagement: true,
      errorHandling: true,
      performanceMonitoring: false,
    },
    theme: "tenant",
    cacheStrategy: "conservative",
  },
} as const;
