/**
 * Unified Management Operations - Main Export
 * Production-ready management system for cross-portal operations
 */

// Core components and providers
export { ManagementProvider } from "./components/ManagementProvider";
export { ManagementApiClient } from "./ManagementApiClient";

// Hooks for different use cases
export {
  useManagement,
  useManagementEntity,
  useManagementBilling,
  useManagementAnalytics,
  useManagementPerformance,
  useManagementConfig,
} from "./components/ManagementProvider";

export {
  useManagementOperations,
  type UseManagementOperationsConfig,
  type UseManagementOperationsReturn,
} from "./hooks/useManagementOperations";

// Type definitions
export * from "./types";

// Example components for reference
export { UnifiedBillingExample } from "./examples/UnifiedBillingExample";

// Re-export specific types that are commonly used
export type {
  BaseEntity,
  EntityType,
  EntityStatus,
  Invoice,
  Payment,
  BillingData,
  DashboardStats,
  ReportType,
  ReportFormat,
  Report,
} from "./types";
