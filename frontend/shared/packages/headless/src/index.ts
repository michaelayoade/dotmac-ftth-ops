/**
 * DotMac Headless UI Package
 *
 * Provides headless hooks and logic for building DotMac platform interfaces
 */

// Re-export query client utilities
export { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// API Client and Configuration
export * from "./api";
export { partnerApiClient } from "./api/partner-client";
// Components
export * from "./components";
export * from "./config/ConfigProvider";
// Configuration and Theming
export * from "./config/framework.config";
export * from "./config/ThemeProvider";
export * from "./config/theme.config";
// Hooks (excluding conflict-prone exports)
// Note: Auth hooks removed - use useSession() from @shared/lib/auth
export {
  useApiData,
  useCachedData,
  useBilling,
  useCommunication,
  useFormatting,
  // Note: useMFA removed - deprecated hook that depended on authStore
  // Note: useOfflineSync removed - deprecated hook that depended on authStore
  usePerformanceMonitoring,
  // Note: usePermissions removed - deprecated hook that depended on authStore
  usePortalIdAuth,
  useProvisioning,
  useISPModules,
  useISPTenant,
  useISPTenantProvider,
  useWebSocket,
  // Note: useRealTimeSync removed - deprecated hook that depended on authStore
  useRouteProtection,
  useCustomRouteProtection,
  useAppState,
  useUI,
  useAppNotifications,
  useFilters,
  usePagination,
  useSelection,
  useLoading,
  usePreferences,
  useDataTable,
  useFormState,
} from "./hooks";

// Partner Portal hooks
export {
  usePartnerDashboard,
  usePartnerCustomers,
  usePartnerCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  usePartnerCommissions,
  usePartnerAnalytics,
  useValidateTerritory,
  usePartnerDataWithErrorBoundary,
  partnerQueryKeys,
} from "./hooks/usePartnerData";

// Security hooks
export { useSecureForm } from "./hooks/useSecureForm";
// Note: useMFAGuard removed - useMFA.ts file deleted (depended on authStore)

// Additional WebSocket hooks
export {
  useNetworkMonitoring,
  useCustomerActivity,
  useFieldOperations,
} from "./hooks/useWebSocket";

// Real-time event hooks
// Note: useRealTimeEvent, useRealTimeData removed - useRealTimeSync.ts file deleted (depended on authStore)

// Business validation hooks
export { useBusinessValidation } from "./hooks/useBusinessValidation";

// Form handling hooks
export {
  useFormValidation,
  useFormSubmission,
  useAsyncValidation,
} from "./hooks/useFormValidation";

// Customer data hooks
export {
  useCustomerDashboard,
  useCustomerServices,
  useCustomerBilling,
  useCustomerUsage,
  useCustomerDocuments,
  useCustomerSupportTickets,
} from "@dotmac/headless/hooks";

// Business logic engines
export { commissionEngine, DEFAULT_COMMISSION_TIERS } from "./business/commission-engine";
export { territoryValidator } from "./business/territory-validator";

// ISP Business Operations (DRY-compliant centralized business logic)
export {
  createISPBusinessService,
  useISPBusiness,
  ISPBusinessService,
  type ISPBusinessOperations,
} from "./business/isp-operations";

// Portal-optimized business hooks
export {
  useCustomerBusiness,
  useResellerBusiness,
  useTechnicianBusiness,
  useAdminBusiness,
  useManagementBusiness,
} from "./hooks/useISPBusiness";

// Notification hooks
export {
  useNotifications,
  useApiErrorNotifications,
  useErrorNotifications,
  useGlobalErrorListener,
  useNotificationStore,
  type NotificationType,
  type Notification,
} from "@dotmac/headless/hooks";

// Standard error handling (preferred)
export {
  useStandardErrorHandler,
  useApiErrorHandler as useStandardApiErrorHandler,
  useFormErrorHandler,
  useDataLoadingErrorHandler,
  useRealtimeErrorHandler,
  useUploadErrorHandler,
  configureGlobalErrorHandling as configureStandardErrorHandling,
  getGlobalErrorConfig,
  type UseStandardErrorHandlerOptions,
  type UseStandardErrorHandlerReturn,
} from "./hooks/useStandardErrorHandler";

// Legacy error handling (for backward compatibility)
export {
  useErrorHandler as useLegacyErrorHandler,
  useErrorBoundary as useLegacyErrorBoundary,
  useApiErrorHandler as useLegacyApiErrorHandler,
  setGlobalErrorHandler,
  type ErrorInfo as LegacyErrorInfo,
  type ErrorHandlerOptions as LegacyErrorHandlerOptions,
  type UseErrorHandlerResult as LegacyUseErrorHandlerResult,
} from "./hooks/useErrorHandler";
// Stores
export * from "./stores";

// Explicitly export store hooks for clarity
// Note: useAuthStore removed - use useSession() from @shared/lib/auth
export { useTenantStore } from "@dotmac/headless/stores";
export { useAppStore } from "@dotmac/headless/stores";
// Types (exclude conflicting types that are exported from hooks)
export type {
  Address,
  ApiError,
  ApiResponse,
  AuthContext,
  BillingInfo,
  ChatAttachment,
  ChatMessage,
  ChatSession,
  Customer,
  CustomerService,
  DashboardMetrics,
  DeviceMetrics,
  Invoice,
  InvoiceItem,
  LoginFlow,
  NetworkAlert,
  NetworkDevice,
  PaginatedResponse,
  PortalConfig,
  PortalType,
  QueryParams,
  ServicePlan,
  Tenant,
  User,
  // Portal ID Authentication Types
  PortalAccount,
  PortalSession,
  PortalLoginCredentials,
  PortalAuthResponse,
  PortalAuthError,
  CustomerData,
  TechnicianData,
  ResellerData,
  // ISP Tenant Types
  ISPTenant,
  TenantUser,
  TenantSession,
  TenantPermissions,
  TenantBranding,
  // Route Protection Types
  RouteProtectionResult,
  RouteConfig,
  RouteGuardProps,
} from "./types";
// Security utilities
export * from "./utils";
// CSP utilities and nonce provider
export * from "./utils/csp";
export * from "./components/NonceProvider";
// Error handling utilities (specific exports to avoid conflicts)
export {
  ISPError,
  classifyError,
  shouldRetry,
  calculateRetryDelay,
  logError,
  deduplicateError,
  DEFAULT_ERROR_CONFIG,
  configureGlobalErrorHandling as configureISPErrorHandling,
  type ErrorHandlingConfig,
  type ErrorSeverity,
  type ErrorCategory,
  type ErrorMetadata,
} from "./utils/errorUtils";

// Error handling components - export specific components to avoid conflicts
export {
  StandardErrorBoundary,
  useErrorBoundary,
  withErrorBoundary as withStandardErrorBoundary,
} from "./components/StandardErrorBoundary";
export * from "./providers/ErrorHandlingProvider";

// Route Guard components and utilities
export {
  RouteGuard,
  AdminOnlyGuard,
  CustomerOnlyGuard,
  ResellerOnlyGuard,
  NetworkEngineerGuard,
  BillingManagerGuard,
  SupportAgentGuard,
  PermissionGuard,
  FeatureGuard,
} from "./components/RouteGuard";

// Production Data Guard utilities
export * from "./utils/production-data-guard";

// Unified Management Operations (High-Impact DRY Solution)
export * from "./management";

// Telemetry and OpenTelemetry utilities
export { initializeOTEL, createSpan, recordMetric, performance } from "./utils/telemetry";
