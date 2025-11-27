// ========================================
// CONSOLIDATED BUSINESS LOGIC HOOKS
// ========================================

// Core unified systems (NEW - consolidated)
// Note: Auth is now handled by @shared/lib/auth
// Note: usePermissions removed - deprecated hook that depended on authStore
export * from "./useDataManagement"; // Unified data management
export * from "./useNotifications"; // Consolidated notifications

// Audit and monitoring systems
export * from "./useAuditLogger"; // Integrated audit logging
export * from "./useAuditInterceptor"; // Automatic audit interception

// Existing business logic hooks
export { useBilling } from "./useBilling"; // Comprehensive billing operations
export * from "./useCommunication";

// ISP Business Operations (DRY-compliant centralized business logic)
export * from "./useISPBusiness"; // Portal-optimized business operations

// Data fetching compatibility
export * from "./useApiData";
export { useApiData as useCachedData } from "./useApiData";

// State management compatibility
export * from "./useAppState";

// ========================================
// SPECIALIZED HOOKS
// ========================================

// Error handling
export * from "./useErrorHandler";
export * from "./useEnhancedErrorHandler";
export * from "./useStandardErrorHandler";

// Security and authentication
// Note: useMFA removed - deprecated hook that depended on authStore
export * from "./usePortalIdAuth";
export * from "./useSecureForm";

// Performance and monitoring
export * from "./usePerformanceMonitoring";
// Note: useOfflineSync removed - deprecated hook that depended on authStore

// Multi-tenant functionality
export * from "./useProvisioning";
export * from "./useISPModules";
export * from "./useISPTenant";

// Real-time and connectivity
export * from "./useWebSocket";
// Note: useRealTimeSync removed - deprecated hook that depended on authStore

// API Client
export * from "./useApiClient";

// Utilities
export * from "./useFormatting";
export * from "./useFormValidation";
export * from "./useRouteProtection";
