/**
 * Management Operations React Hook
 * Production-ready hook for unified management operations across portals
 * Features: State management, error handling, optimistic updates, caching
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ManagementApiClient, ManagementApiClientConfig } from "../ManagementApiClient";
import {
  BaseEntity,
  EntityFilters,
  EntityListResponse,
  CreateEntityRequest,
  UpdateEntityRequest,
  EntityOperationResult,
  BillingData,
  PaymentResult,
  Invoice,
  DashboardStats,
  UsageMetrics,
  Report,
  ReportType,
  ReportParams,
  EntityType,
  EntityStatus,
} from "../types";

// ===== HOOK CONFIGURATION =====

export interface UseManagementOperationsConfig {
  apiConfig: ManagementApiClientConfig;
  enableOptimisticUpdates?: boolean;
  enableRealTimeSync?: boolean;
  autoRefreshInterval?: number;
  retryFailedOperations?: boolean;
}

// ===== STATE INTERFACES =====

interface OperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  isStale: boolean;
}

interface EntityManagementState<T extends BaseEntity> {
  entities: OperationState<EntityListResponse<T>>;
  selectedEntity: OperationState<T>;
  createOperation: OperationState<T>;
  updateOperation: OperationState<T>;
  deleteOperation: OperationState<void>;
}

interface BillingState {
  billingData: OperationState<BillingData>;
  invoices: OperationState<Invoice[]>;
  paymentOperation: OperationState<PaymentResult>;
  invoiceGeneration: OperationState<Invoice>;
}

interface AnalyticsState {
  dashboardStats: OperationState<DashboardStats>;
  usageMetrics: OperationState<UsageMetrics>;
  reports: OperationState<Report[]>;
  reportGeneration: OperationState<Report>;
}

interface ManagementOperationsState {
  entities: Record<string, EntityManagementState<any>>;
  billing: Record<string, BillingState>;
  analytics: AnalyticsState;
  globalLoading: boolean;
  globalError: string | null;
}

// ===== HOOK RETURN TYPE =====

export interface UseManagementOperationsReturn {
  // State
  state: ManagementOperationsState;

  // Entity Operations
  listEntities: <T extends BaseEntity>(
    entityType: string,
    filters?: EntityFilters,
  ) => Promise<EntityListResponse<T>>;
  getEntity: <T extends BaseEntity>(entityType: string, entityId: string) => Promise<T>;
  createEntity: <T extends BaseEntity>(
    request: CreateEntityRequest,
  ) => Promise<EntityOperationResult<T>>;
  updateEntity: <T extends BaseEntity>(
    entityType: string,
    entityId: string,
    request: UpdateEntityRequest,
  ) => Promise<EntityOperationResult<T>>;
  deleteEntity: (entityType: string, entityId: string) => Promise<EntityOperationResult<void>>;

  // Billing Operations
  getBillingData: (
    entityId: string,
    period: { start_date: string; end_date: string },
  ) => Promise<BillingData>;
  processPayment: (entityId: string, amount: number, paymentData: any) => Promise<PaymentResult>;
  generateInvoice: (entityId: string, services: any[], options?: any) => Promise<Invoice>;
  getInvoices: (entityId: string, filters?: any) => Promise<Invoice[]>;

  // Analytics Operations
  getDashboardStats: (timeframe: string, entityType?: string) => Promise<DashboardStats>;
  getUsageMetrics: (entityId: string, period: any) => Promise<UsageMetrics>;
  generateReport: (type: ReportType, params: ReportParams) => Promise<Report>;
  getReport: (reportId: string) => Promise<Report>;
  downloadReport: (reportId: string) => Promise<Blob>;

  // Batch Operations
  batchOperation: <T>(
    operations: Array<{ method: string; endpoint: string; data?: any }>,
  ) => Promise<EntityOperationResult<T>[]>;

  // State Management
  refreshData: (entityType?: string, entityId?: string) => Promise<void>;
  clearCache: () => void;
  retryFailedOperation: (operationId: string) => Promise<void>;

  // Real-time Features
  subscribeToEntity: (entityType: string, entityId: string) => () => void;
  subscribeToEntityList: (entityType: string, filters?: EntityFilters) => () => void;

  // Utilities
  isLoading: (operation?: string) => boolean;
  hasError: (operation?: string) => boolean;
  getError: (operation?: string) => string | null;
  getCacheStats: () => any;
}

// ===== MAIN HOOK =====

export function useManagementOperations(
  config: UseManagementOperationsConfig,
): UseManagementOperationsReturn {
  const [state, setState] = useState<ManagementOperationsState>({
    entities: {},
    billing: {},
    analytics: {
      dashboardStats: createInitialOperationState(),
      usageMetrics: createInitialOperationState(),
      reports: createInitialOperationState(),
      reportGeneration: createInitialOperationState(),
    },
    globalLoading: false,
    globalError: null,
  });

  const apiClientRef = useRef<ManagementApiClient | null>(null);
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const operationQueueRef = useRef<Array<() => Promise<any>>>([]);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize API client
  useEffect(() => {
    apiClientRef.current = new ManagementApiClient(config.apiConfig);

    return () => {
      // Cleanup subscriptions
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
      subscriptionsRef.current.clear();

      // Clear auto-refresh timer
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [config.apiConfig]);

  // Auto-refresh setup
  useEffect(() => {
    if (config.autoRefreshInterval && config.autoRefreshInterval > 0) {
      autoRefreshTimerRef.current = setInterval(() => {
        refreshStaleData();
      }, config.autoRefreshInterval);
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [config.autoRefreshInterval]);

  // ===== UTILITY FUNCTIONS =====

  function createInitialOperationState<T>(): OperationState<T> {
    return {
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      isStale: false,
    };
  }

  function updateOperationState<T>(
    path: string,
    updater: (prev: OperationState<T>) => Partial<OperationState<T>>,
  ): void {
    setState((prev) => {
      const pathParts = path.split(".");
      const newState = { ...prev };

      let current = newState as any;
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {};
        }
        current[pathParts[i]] = { ...current[pathParts[i]] };
        current = current[pathParts[i]];
      }

      const finalKey = pathParts[pathParts.length - 1];
      const currentState = current[finalKey] || createInitialOperationState();
      current[finalKey] = { ...currentState, ...updater(currentState) };

      return newState;
    });
  }

  function setGlobalState(
    updates: Partial<Pick<ManagementOperationsState, "globalLoading" | "globalError">>,
  ): void {
    setState((prev) => ({ ...prev, ...updates }));
  }

  async function executeWithStateManagement<T>(
    operation: () => Promise<T>,
    statePath: string,
    enableOptimistic: boolean = false,
  ): Promise<T> {
    try {
      // Set loading state
      updateOperationState(statePath, () => ({
        loading: true,
        error: null,
      }));

      const result = await operation();

      // Set success state
      updateOperationState(statePath, () => ({
        data: result,
        loading: false,
        error: null,
        lastUpdated: Date.now(),
        isStale: false,
      }));

      return result;
    } catch (error) {
      // Set error state
      updateOperationState(statePath, () => ({
        loading: false,
        error: error.message || "Unknown error occurred",
      }));

      // Add to retry queue if enabled
      if (config.retryFailedOperations) {
        operationQueueRef.current.push(operation);
      }

      throw error;
    }
  }

  async function refreshStaleData(): Promise<void> {
    // Implementation for refreshing stale data
    console.debug("Refreshing stale data...");
  }

  // ===== ENTITY OPERATIONS =====

  const listEntities = useCallback(
    async <T extends BaseEntity>(
      entityType: string,
      filters: EntityFilters = {},
    ): Promise<EntityListResponse<T>> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `entities.${entityType}.entities`;

      return executeWithStateManagement(
        () => apiClientRef.current!.listEntities<T>(entityType, filters),
        statePath,
      );
    },
    [],
  );

  const getEntity = useCallback(
    async <T extends BaseEntity>(entityType: string, entityId: string): Promise<T> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `entities.${entityType}.selectedEntity`;

      return executeWithStateManagement(
        () => apiClientRef.current!.getEntity<T>(entityType, entityId),
        statePath,
      );
    },
    [],
  );

  const createEntity = useCallback(
    async <T extends BaseEntity>(
      request: CreateEntityRequest,
    ): Promise<EntityOperationResult<T>> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `entities.${request.entity_type}.createOperation`;

      // Optimistic update if enabled
      if (config.enableOptimisticUpdates) {
        const optimisticEntity = {
          id: `temp_${Date.now()}`,
          ...request.data,
          status: request.initial_status || EntityStatus.PENDING,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as T;

        updateOperationState(statePath, () => ({
          data: optimisticEntity,
          loading: true,
          error: null,
        }));
      }

      const result = await executeWithStateManagement(
        () => apiClientRef.current!.createEntity<T>(request),
        statePath,
        config.enableOptimisticUpdates,
      );

      // Refresh entity list after successful creation
      if (result.success) {
        listEntities(request.entity_type);
      }

      return result;
    },
    [config.enableOptimisticUpdates, listEntities],
  );

  const updateEntity = useCallback(
    async <T extends BaseEntity>(
      entityType: string,
      entityId: string,
      request: UpdateEntityRequest,
    ): Promise<EntityOperationResult<T>> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `entities.${entityType}.updateOperation`;

      // Optimistic update if enabled
      if (config.enableOptimisticUpdates) {
        const currentEntity = state.entities[entityType]?.selectedEntity?.data;
        if (currentEntity) {
          const optimisticEntity = {
            ...currentEntity,
            ...request.data,
            updated_at: new Date().toISOString(),
          } as T;

          updateOperationState(`entities.${entityType}.selectedEntity`, () => ({
            data: optimisticEntity,
          }));
        }
      }

      const result = await executeWithStateManagement(
        () => apiClientRef.current!.updateEntity<T>(entityType, entityId, request),
        statePath,
        config.enableOptimisticUpdates,
      );

      // Refresh data after successful update
      if (result.success) {
        listEntities(entityType);
        getEntity(entityType, entityId);
      }

      return result;
    },
    [config.enableOptimisticUpdates, state.entities, listEntities, getEntity],
  );

  const deleteEntity = useCallback(
    async (entityType: string, entityId: string): Promise<EntityOperationResult<void>> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `entities.${entityType}.deleteOperation`;

      const result = await executeWithStateManagement(
        () => apiClientRef.current!.deleteEntity(entityType, entityId),
        statePath,
      );

      // Refresh entity list after successful deletion
      if (result.success) {
        listEntities(entityType);
      }

      return result;
    },
    [listEntities],
  );

  // ===== BILLING OPERATIONS =====

  const getBillingData = useCallback(
    async (
      entityId: string,
      period: { start_date: string; end_date: string },
    ): Promise<BillingData> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `billing.${entityId}.billingData`;

      return executeWithStateManagement(
        () => apiClientRef.current!.getBillingData(entityId, period),
        statePath,
      );
    },
    [],
  );

  const processPayment = useCallback(
    async (entityId: string, amount: number, paymentData: any): Promise<PaymentResult> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `billing.${entityId}.paymentOperation`;

      return executeWithStateManagement(
        () => apiClientRef.current!.processPayment(entityId, amount, paymentData),
        statePath,
      );
    },
    [],
  );

  const generateInvoice = useCallback(
    async (entityId: string, services: any[], options: any = {}): Promise<Invoice> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `billing.${entityId}.invoiceGeneration`;

      return executeWithStateManagement(
        () => apiClientRef.current!.generateInvoice(entityId, services, options),
        statePath,
      );
    },
    [],
  );

  const getInvoices = useCallback(
    async (entityId: string, filters: any = {}): Promise<Invoice[]> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = `billing.${entityId}.invoices`;

      return executeWithStateManagement(
        () => apiClientRef.current!.getInvoices(entityId, filters),
        statePath,
      );
    },
    [],
  );

  // ===== ANALYTICS OPERATIONS =====

  const getDashboardStats = useCallback(
    async (timeframe: string, entityType?: string): Promise<DashboardStats> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = "analytics.dashboardStats";

      return executeWithStateManagement(
        () => apiClientRef.current!.getDashboardStats(timeframe, entityType),
        statePath,
      );
    },
    [],
  );

  const getUsageMetrics = useCallback(
    async (entityId: string, period: any): Promise<UsageMetrics> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = "analytics.usageMetrics";

      return executeWithStateManagement(
        () => apiClientRef.current!.getUsageMetrics(entityId, period),
        statePath,
      );
    },
    [],
  );

  const generateReport = useCallback(
    async (type: ReportType, params: ReportParams): Promise<Report> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      const statePath = "analytics.reportGeneration";

      return executeWithStateManagement(
        () => apiClientRef.current!.generateReport(type, params),
        statePath,
      );
    },
    [],
  );

  const getReport = useCallback(async (reportId: string): Promise<Report> => {
    if (!apiClientRef.current) throw new Error("API client not initialized");

    return apiClientRef.current.getReport(reportId);
  }, []);

  const downloadReport = useCallback(async (reportId: string): Promise<Blob> => {
    if (!apiClientRef.current) throw new Error("API client not initialized");

    return apiClientRef.current.downloadReport(reportId);
  }, []);

  // ===== BATCH OPERATIONS =====

  const batchOperation = useCallback(
    async <T>(
      operations: Array<{ method: string; endpoint: string; data?: any }>,
    ): Promise<EntityOperationResult<T>[]> => {
      if (!apiClientRef.current) throw new Error("API client not initialized");

      setGlobalState({ globalLoading: true });

      try {
        const result = await apiClientRef.current.batchOperation<T>(operations);
        setGlobalState({ globalLoading: false });
        return result;
      } catch (error) {
        setGlobalState({ globalLoading: false, globalError: error.message });
        throw error;
      }
    },
    [],
  );

  // ===== STATE MANAGEMENT =====

  const refreshData = useCallback(
    async (entityType?: string, entityId?: string): Promise<void> => {
      // Implementation for refreshing specific data
      if (entityType) {
        await listEntities(entityType);
        if (entityId) {
          await getEntity(entityType, entityId);
        }
      } else {
        // Refresh all data
        await refreshStaleData();
      }
    },
    [listEntities, getEntity],
  );

  const clearCache = useCallback((): void => {
    if (apiClientRef.current) {
      apiClientRef.current.clearCache();
    }

    setState({
      entities: {},
      billing: {},
      analytics: {
        dashboardStats: createInitialOperationState(),
        usageMetrics: createInitialOperationState(),
        reports: createInitialOperationState(),
        reportGeneration: createInitialOperationState(),
      },
      globalLoading: false,
      globalError: null,
    });
  }, []);

  const retryFailedOperation = useCallback(async (operationId: string): Promise<void> => {
    // Implementation for retrying failed operations
    if (operationQueueRef.current.length > 0) {
      const operation = operationQueueRef.current.shift();
      if (operation) {
        await operation();
      }
    }
  }, []);

  // ===== REAL-TIME FEATURES =====

  const subscribeToEntity = useCallback((entityType: string, entityId: string): (() => void) => {
    const subscriptionKey = `${entityType}:${entityId}`;

    // Implementation would depend on your WebSocket/SSE setup
    const unsubscribe = () => {
      subscriptionsRef.current.delete(subscriptionKey);
    };

    subscriptionsRef.current.set(subscriptionKey, unsubscribe);
    return unsubscribe;
  }, []);

  const subscribeToEntityList = useCallback(
    (entityType: string, filters?: EntityFilters): (() => void) => {
      const subscriptionKey = `${entityType}:list`;

      // Implementation would depend on your WebSocket/SSE setup
      const unsubscribe = () => {
        subscriptionsRef.current.delete(subscriptionKey);
      };

      subscriptionsRef.current.set(subscriptionKey, unsubscribe);
      return unsubscribe;
    },
    [],
  );

  // ===== UTILITIES =====

  const isLoading = useCallback(
    (operation?: string): boolean => {
      if (!operation) {
        return state.globalLoading;
      }

      // Check specific operation loading state
      const pathParts = operation.split(".");
      let current = state as any;
      for (const part of pathParts) {
        current = current[part];
        if (!current) return false;
      }

      return current.loading || false;
    },
    [state],
  );

  const hasError = useCallback(
    (operation?: string): boolean => {
      if (!operation) {
        return !!state.globalError;
      }

      // Check specific operation error state
      const pathParts = operation.split(".");
      let current = state as any;
      for (const part of pathParts) {
        current = current[part];
        if (!current) return false;
      }

      return !!current.error;
    },
    [state],
  );

  const getError = useCallback(
    (operation?: string): string | null => {
      if (!operation) {
        return state.globalError;
      }

      // Get specific operation error
      const pathParts = operation.split(".");
      let current = state as any;
      for (const part of pathParts) {
        current = current[part];
        if (!current) return null;
      }

      return current.error || null;
    },
    [state],
  );

  const getCacheStats = useCallback(() => {
    if (!apiClientRef.current) return null;
    return apiClientRef.current.getCacheStats();
  }, []);

  // ===== MEMOIZED RETURN VALUE =====

  return useMemo(
    () => ({
      state,
      listEntities,
      getEntity,
      createEntity,
      updateEntity,
      deleteEntity,
      getBillingData,
      processPayment,
      generateInvoice,
      getInvoices,
      getDashboardStats,
      getUsageMetrics,
      generateReport,
      getReport,
      downloadReport,
      batchOperation,
      refreshData,
      clearCache,
      retryFailedOperation,
      subscribeToEntity,
      subscribeToEntityList,
      isLoading,
      hasError,
      getError,
      getCacheStats,
    }),
    [
      state,
      listEntities,
      getEntity,
      createEntity,
      updateEntity,
      deleteEntity,
      getBillingData,
      processPayment,
      generateInvoice,
      getInvoices,
      getDashboardStats,
      getUsageMetrics,
      generateReport,
      getReport,
      downloadReport,
      batchOperation,
      refreshData,
      clearCache,
      retryFailedOperation,
      subscribeToEntity,
      subscribeToEntityList,
      isLoading,
      hasError,
      getError,
      getCacheStats,
    ],
  );
}

// ===== CONVENIENCE HOOKS =====

export function useEntityManagement<T extends BaseEntity>(
  entityType: string,
  config: UseManagementOperationsConfig,
) {
  const operations = useManagementOperations(config);

  return {
    entities: operations.state.entities[entityType],
    listEntities: (filters?: EntityFilters) => operations.listEntities<T>(entityType, filters),
    getEntity: (entityId: string) => operations.getEntity<T>(entityType, entityId),
    createEntity: (data: any) =>
      operations.createEntity({
        entity_type: entityType as EntityType,
        data,
      }),
    updateEntity: (entityId: string, data: any) =>
      operations.updateEntity<T>(entityType, entityId, { data }),
    deleteEntity: (entityId: string) => operations.deleteEntity(entityType, entityId),
    isLoading: (operation?: string) =>
      operations.isLoading(`entities.${entityType}.${operation || "entities"}`),
    hasError: (operation?: string) =>
      operations.hasError(`entities.${entityType}.${operation || "entities"}`),
    getError: (operation?: string) =>
      operations.getError(`entities.${entityType}.${operation || "entities"}`),
  };
}

export function useBillingOperations(config: UseManagementOperationsConfig) {
  const operations = useManagementOperations(config);

  return {
    billing: operations.state.billing,
    getBillingData: operations.getBillingData,
    processPayment: operations.processPayment,
    generateInvoice: operations.generateInvoice,
    getInvoices: operations.getInvoices,
    isLoading: (entityId: string, operation = "billingData") =>
      operations.isLoading(`billing.${entityId}.${operation}`),
    hasError: (entityId: string, operation = "billingData") =>
      operations.hasError(`billing.${entityId}.${operation}`),
    getError: (entityId: string, operation = "billingData") =>
      operations.getError(`billing.${entityId}.${operation}`),
  };
}

export function useAnalyticsOperations(config: UseManagementOperationsConfig) {
  const operations = useManagementOperations(config);

  return {
    analytics: operations.state.analytics,
    getDashboardStats: operations.getDashboardStats,
    getUsageMetrics: operations.getUsageMetrics,
    generateReport: operations.generateReport,
    getReport: operations.getReport,
    downloadReport: operations.downloadReport,
    isLoading: (operation = "dashboardStats") => operations.isLoading(`analytics.${operation}`),
    hasError: (operation = "dashboardStats") => operations.hasError(`analytics.${operation}`),
    getError: (operation = "dashboardStats") => operations.getError(`analytics.${operation}`),
  };
}
