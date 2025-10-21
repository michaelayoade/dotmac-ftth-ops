// ========================================
// CONSOLIDATED BUSINESS LOGIC HOOKS
// ========================================

// Core unified systems (NEW - consolidated)
export * from "../auth/useAuth"; // Unified auth system
export * from "./usePermissions"; // Consolidated permissions
export * from "./useDataManagement"; // Unified data management
export * from "./useNotifications"; // Consolidated notifications

// Audit and monitoring systems
export * from "./useAuditLogger"; // Integrated audit logging
export * from "./useAuditInterceptor"; // Automatic audit interception

// Existing business logic hooks
export * from "./useBilling"; // Comprehensive billing operations
export * from "./useCommunication";

// ISP Business Operations (DRY-compliant centralized business logic)
export * from "./useISPBusiness"; // Portal-optimized business operations

// ========================================
// LEGACY COMPATIBILITY EXPORTS
// ========================================

// Authentication compatibility (redirects to unified system)
export { useAuth as useUniversalAuth } from "../auth/useAuth";
export { useAuth as usePortalAuth } from "../auth/useAuth";

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
export * from "./useMFA";
export * from "./usePortalIdAuth";
export * from "./useSecureForm";

// Performance and monitoring
export * from "./usePerformanceMonitoring";
export * from "./useOfflineSync";

// Multi-tenant functionality
export * from "./useProvisioning";
export * from "./useISPModules";
export * from "./useISPTenant";

// Real-time and connectivity
export * from "./useWebSocket";
export * from "./useRealTimeSync";

// API Client
export * from "./useApiClient";

// Utilities
export * from "./useFormatting";
export * from "./useFormValidation";
export * from "./useRouteProtection";
