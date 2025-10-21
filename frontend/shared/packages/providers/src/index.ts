/**
 * Universal Provider System for DotMac Frontend Applications
 * Provides standardized provider patterns across all portals
 */

// Core provider aggregator
export { UniversalProviders } from "./UniversalProviders";

// Local components only - avoiding problematic external re-exports for now
export { ErrorBoundary } from "./components/ErrorBoundary";

// Re-export RBAC components for convenience
export {
  ProtectedComponent,
  AdminOnly,
  ManagerOnly,
  AuthenticatedOnly,
  ConditionalRender,
  ShowIfAny,
  ShowIfAll,
  HideIf,
} from "@dotmac/rbac";

// Re-export permission-aware UI components
export {
  PermissionAwareButton,
  CreateButton,
  EditButton,
  DeleteButton,
  AdminButton,
} from "@dotmac/rbac";

// Re-export routing components
export { ProtectedRoute, AdminRoute, ManagerRoute, AuthenticatedRoute } from "@dotmac/rbac";

// Re-export hooks
export { usePermissions, useAccessControl } from "@dotmac/rbac";

// Re-export decorators
export { withAccessControl, accessControlDecorators, createProtected } from "@dotmac/rbac";

// Re-export auth-related types
export type { FeatureFlags, AuthVariant, TenantVariant } from "./UniversalProviders";

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
