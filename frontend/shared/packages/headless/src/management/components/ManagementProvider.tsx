/**
 * Management Provider Component
 * Production-ready context provider for unified management operations
 * Features: Configuration management, error boundaries, performance monitoring
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { ManagementApiClient, ManagementApiClientConfig } from "../ManagementApiClient";
import {
  useManagementOperations,
  UseManagementOperationsConfig,
  UseManagementOperationsReturn,
} from "../hooks/useManagementOperations";
import { EntityType } from "../types";

// ===== CONTEXT INTERFACES =====

interface ManagementContextType extends UseManagementOperationsReturn {
  // Configuration
  config: UseManagementOperationsConfig;
  isInitialized: boolean;

  // Portal-specific settings
  portalType: "management-admin" | "admin" | "reseller";
  availableEntityTypes: EntityType[];

  // Feature flags
  features: {
    enableBatchOperations: boolean;
    enableRealTimeSync: boolean;
    enableAdvancedAnalytics: boolean;
    enableAuditLogging: boolean;
  };

  // Performance monitoring
  performance: {
    apiResponseTimes: Record<string, number>;
    cacheHitRatio: number;
    errorRate: number;
  };

  // Configuration management
  updateConfig: (config: Partial<UseManagementOperationsConfig>) => void;
  resetConfiguration: () => void;
}

interface ManagementProviderProps {
  children: React.ReactNode;
  portalType: "management-admin" | "admin" | "reseller";
  apiBaseUrl: string;
  initialConfig?: Partial<UseManagementOperationsConfig>;
  features?: Partial<ManagementContextType["features"]>;
  enablePerformanceMonitoring?: boolean;
  enableErrorBoundary?: boolean;
}

// ===== CONTEXT CREATION =====

const ManagementContext = createContext<ManagementContextType | null>(null);

// ===== ERROR BOUNDARY =====

interface ManagementErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class ManagementErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    onError?: (error: Error, errorInfo: any) => void;
  },
  ManagementErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ManagementErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({ errorInfo });

    // Log error to monitoring service
    if (process.env["NODE_ENV"] === "development") {
      console.error("[ManagementProvider] Error caught:", error, errorInfo);
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="management-error-boundary p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Management System Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  An error occurred in the management system. Please refresh the page or contact
                  support if the problem persists.
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Refresh Page
                </button>
              </div>
              {process.env["NODE_ENV"] === "development" && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-red-800">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded overflow-auto">
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ===== CONFIGURATION UTILS =====

function getDefaultConfig(
  portalType: string,
  apiBaseUrl: string,
  initialConfig?: Partial<UseManagementOperationsConfig>,
): UseManagementOperationsConfig {
  const baseApiConfig: ManagementApiClientConfig = {
    baseURL: apiBaseUrl,
    apiConfig: {
      base_url: apiBaseUrl,
      timeout_ms: 30000,
      retry_attempts: 3,
      retry_delay_ms: 1000,
      rate_limit_requests: portalType === "management-admin" ? 200 : 100,
      rate_limit_window_ms: 60000,
      auth_header_name: "Authorization",
      tenant_header_name: "X-Tenant-ID",
      request_id_header_name: "X-Request-ID",
    },
    cacheConfig: {
      enabled: true,
      default_ttl_seconds: portalType === "management-admin" ? 300 : 600,
      max_entries: 1000,
      cache_key_prefix: `${portalType}_mgmt`,
      invalidation_patterns: ["create_*", "update_*", "delete_*"],
    },
    enableAuditLogging: true,
    enablePerformanceMonitoring: true,
  };

  return {
    apiConfig: baseApiConfig,
    enableOptimisticUpdates: portalType !== "management-admin", // More conservative for management
    enableRealTimeSync: true,
    autoRefreshInterval: portalType === "management-admin" ? 30000 : 60000, // More frequent for management
    retryFailedOperations: true,
    ...initialConfig,
  };
}

function getPortalEntityTypes(portalType: string): EntityType[] {
  switch (portalType) {
    case "management-admin":
      return [EntityType.TENANT, EntityType.RESELLER, EntityType.PARTNER, EntityType.USER];
    case "admin":
      return [EntityType.CUSTOMER, EntityType.USER, EntityType.SERVICE];
    case "reseller":
      return [EntityType.CUSTOMER, EntityType.SERVICE];
    default:
      return [];
  }
}

function getPortalFeatures(
  portalType: string,
  customFeatures?: Partial<ManagementContextType["features"]>,
): ManagementContextType["features"] {
  const defaultFeatures = {
    enableBatchOperations: portalType === "management-admin",
    enableRealTimeSync: true,
    enableAdvancedAnalytics: portalType !== "reseller",
    enableAuditLogging: true,
  };

  return { ...defaultFeatures, ...customFeatures };
}

// ===== MAIN PROVIDER COMPONENT =====

export function ManagementProvider({
  children,
  portalType,
  apiBaseUrl,
  initialConfig,
  features: customFeatures,
  enablePerformanceMonitoring = true,
  enableErrorBoundary = true,
}: ManagementProviderProps) {
  const [config, setConfig] = useState<UseManagementOperationsConfig>(() =>
    getDefaultConfig(portalType, apiBaseUrl, initialConfig),
  );

  const [isInitialized, setIsInitialized] = useState(false);
  const [performance, setPerformance] = useState<ManagementContextType["performance"]>({
    apiResponseTimes: {},
    cacheHitRatio: 0,
    errorRate: 0,
  });

  const operations = useManagementOperations(config);

  const availableEntityTypes = useMemo(() => getPortalEntityTypes(portalType), [portalType]);

  const features = useMemo(
    () => getPortalFeatures(portalType, customFeatures),
    [portalType, customFeatures],
  );

  // Initialize the management system
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        // Perform any necessary initialization
        if (features.enableAdvancedAnalytics) {
          // Pre-load dashboard stats
          await operations.getDashboardStats("24h");
        }

        setIsInitialized(true);
      } catch (error) {
        if (process.env["NODE_ENV"] === "development") {
          console.error("[ManagementProvider] Initialization failed:", error);
        }
      }
    };

    initializeSystem();
  }, [operations, features]);

  // Performance monitoring
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const performanceMonitoringInterval = setInterval(() => {
      const cacheStats = operations.getCacheStats();

      setPerformance((prev) => ({
        ...prev,
        cacheHitRatio: cacheStats?.hit_ratio || 0,
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(performanceMonitoringInterval);
  }, [operations, enablePerformanceMonitoring]);

  // Configuration management
  const updateConfig = useCallback((newConfig: Partial<UseManagementOperationsConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...newConfig,
      apiConfig: newConfig.apiConfig
        ? {
            ...prev.apiConfig,
            ...newConfig.apiConfig,
          }
        : prev.apiConfig,
    }));
  }, []);

  const resetConfiguration = useCallback(() => {
    setConfig(getDefaultConfig(portalType, apiBaseUrl, initialConfig));
  }, [portalType, apiBaseUrl, initialConfig]);

  // Error handling
  const handleError = useCallback(
    (error: Error, errorInfo: any) => {
      // Send to error tracking service
      if (enablePerformanceMonitoring) {
        setPerformance((prev) => ({
          ...prev,
          errorRate: prev.errorRate + 1,
        }));
      }
    },
    [enablePerformanceMonitoring],
  );

  // Context value
  const contextValue = useMemo<ManagementContextType>(
    () => ({
      ...operations,
      config,
      isInitialized,
      portalType,
      availableEntityTypes,
      features,
      performance,
      updateConfig,
      resetConfiguration,
    }),
    [
      operations,
      config,
      isInitialized,
      portalType,
      availableEntityTypes,
      features,
      performance,
      updateConfig,
      resetConfiguration,
    ],
  );

  const content = (
    <ManagementContext.Provider value={contextValue}>{children}</ManagementContext.Provider>
  );

  if (enableErrorBoundary) {
    return <ManagementErrorBoundary onError={handleError}>{content}</ManagementErrorBoundary>;
  }

  return content;
}

// ===== CONTEXT HOOK =====

export function useManagement(): ManagementContextType {
  const context = useContext(ManagementContext);
  if (!context) {
    throw new Error("useManagement must be used within a ManagementProvider");
  }
  return context;
}

// ===== CONVENIENCE HOOKS =====

export function useManagementEntity<T>(entityType: EntityType) {
  const {
    listEntities,
    getEntity,
    createEntity,
    updateEntity,
    deleteEntity,
    isLoading,
    hasError,
    getError,
  } = useManagement();

  return {
    list: (filters?: any) => listEntities<T>(entityType, filters),
    get: (id: string) => getEntity<T>(entityType, id),
    create: (data: any) => createEntity({ entity_type: entityType, data }),
    update: (id: string, data: any) => updateEntity<T>(entityType, id, { data }),
    delete: (id: string) => deleteEntity(entityType, id),
    isLoading: (operation = "entities") => isLoading(`entities.${entityType}.${operation}`),
    hasError: (operation = "entities") => hasError(`entities.${entityType}.${operation}`),
    getError: (operation = "entities") => getError(`entities.${entityType}.${operation}`),
  };
}

export function useManagementBilling(entityId: string) {
  const {
    getBillingData,
    processPayment,
    generateInvoice,
    getInvoices,
    isLoading,
    hasError,
    getError,
  } = useManagement();

  return {
    getBillingData: (period: { start_date: string; end_date: string }) =>
      getBillingData(entityId, period),
    processPayment: (amount: number, paymentData: any) =>
      processPayment(entityId, amount, paymentData),
    generateInvoice: (services: any[], options?: any) =>
      generateInvoice(entityId, services, options),
    getInvoices: (filters?: any) => getInvoices(entityId, filters),
    isLoading: (operation = "billingData") => isLoading(`billing.${entityId}.${operation}`),
    hasError: (operation = "billingData") => hasError(`billing.${entityId}.${operation}`),
    getError: (operation = "billingData") => getError(`billing.${entityId}.${operation}`),
  };
}

export function useManagementAnalytics() {
  const {
    getDashboardStats,
    getUsageMetrics,
    generateReport,
    getReport,
    downloadReport,
    isLoading,
    hasError,
    getError,
  } = useManagement();

  return {
    getDashboardStats,
    getUsageMetrics,
    generateReport,
    getReport,
    downloadReport,
    isLoading: (operation = "dashboardStats") => isLoading(`analytics.${operation}`),
    hasError: (operation = "dashboardStats") => hasError(`analytics.${operation}`),
    getError: (operation = "dashboardStats") => getError(`analytics.${operation}`),
  };
}

// ===== PERFORMANCE MONITORING HOOK =====

export function useManagementPerformance() {
  const { performance, getCacheStats } = useManagement();

  return {
    ...performance,
    getCacheStats,
    getHealthStatus: () => ({
      healthy: performance.errorRate < 0.1,
      cachePerformance: performance.cacheHitRatio > 0.8 ? "good" : "poor",
      errorRate: performance.errorRate,
    }),
  };
}

// ===== CONFIGURATION HOOK =====

export function useManagementConfig() {
  const { config, updateConfig, resetConfiguration, features } = useManagement();

  return {
    config,
    features,
    updateConfig,
    resetConfiguration,
    updateApiConfig: (apiConfig: Partial<ManagementApiClientConfig>) => {
      updateConfig({ apiConfig });
    },
    enableFeature: (feature: keyof ManagementContextType["features"]) => {
      // This would require additional logic to dynamically enable features
      if (process.env["NODE_ENV"] === "development") {
        console.warn("Dynamic feature toggling not implemented");
      }
    },
  };
}
