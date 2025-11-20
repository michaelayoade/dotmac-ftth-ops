/**
 * Unified Data Management Hook
 * Consolidates data fetching, caching, and state management patterns
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useApiClient } from "../api";
import { useAppStore } from "../stores";
import { useAuth } from "../auth/context";
import type { ApiResponse, PaginatedResponse, PaginationParams } from "../api/types";
import type { FilterState, PaginationState, SelectionState, LoadingState } from "../stores/types";

export interface DataManagerConfig<T = any> {
  contextId: string;
  endpoint: string;
  autoLoad?: boolean;
  pollInterval?: number;
  cacheTimeout?: number;
  dependencies?: any[];
  transform?: (data: any) => T[];
  onError?: (error: Error) => void;
  onSuccess?: (data: T[]) => void;
  enableRealtime?: boolean;
  websocketEndpoint?: string;
}

export interface DataOperations<T = any> {
  // CRUD operations
  create: (data: Omit<T, "id">) => Promise<ApiResponse<T>>;
  update: (id: string, data: Partial<T>) => Promise<ApiResponse<T>>;
  delete: (id: string) => Promise<ApiResponse<void>>;

  // Bulk operations
  bulkCreate: (items: Omit<T, "id">[]) => Promise<ApiResponse<T[]>>;
  bulkUpdate: (updates: Array<{ id: string; data: Partial<T> }>) => Promise<ApiResponse<T[]>>;
  bulkDelete: (ids: string[]) => Promise<ApiResponse<void>>;

  // Export operations
  exportData: (format: "csv" | "xlsx" | "json", filters?: any) => Promise<void>;
}

export interface DataManagerReturn<T = any> {
  // Data state
  data: T[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Pagination state
  pagination: PaginationState;

  // Selection state
  selection: SelectionState<T>;

  // Filter state
  filters: FilterState;

  // Data operations
  load: (params?: PaginationParams) => Promise<void>;
  reload: () => Promise<void>;
  create: (data: Omit<T, "id">) => Promise<T | null>;
  update: (id: string, data: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;

  // Bulk operations
  bulkCreate: (items: Omit<T, "id">[]) => Promise<T[]>;
  bulkUpdate: (updates: Array<{ id: string; data: Partial<T> }>) => Promise<T[]>;
  bulkDelete: (ids: string[]) => Promise<boolean>;

  // Selection management
  selectItem: (item: T, multiple?: boolean) => void;
  selectItems: (items: T[]) => void;
  deselectItem: (item: T) => void;
  clearSelection: () => void;
  toggleSelectAll: () => void;

  // Filter management
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setSearch: (term: string) => void;
  setSorting: (sortBy: string, order?: "asc" | "desc") => void;

  // Pagination management
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // Utility functions
  getSelectedIds: () => string[];
  getFilteredData: (customFilter?: (item: T) => boolean) => T[];
  exportData: (format: "csv" | "xlsx" | "json") => Promise<void>;

  // Real-time connection
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export function useDataManager<T = any>(config: DataManagerConfig<T>): DataManagerReturn<T> {
  const {
    contextId,
    endpoint,
    autoLoad = true,
    pollInterval = 0,
    cacheTimeout = 5 * 60 * 1000, // 5 minutes
    dependencies = [],
    transform,
    onError,
    onSuccess,
    enableRealtime = false,
    websocketEndpoint,
  } = config;

  const apiClient = useApiClient();
  const appStore = useAppStore();
  const { user } = useAuth();

  const websocketRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);

  // Initialize context
  useEffect(() => {
    if (!appStore.getContext(contextId)) {
      appStore.createContext(contextId);
    }
  }, [appStore, contextId]);

  // Get context state
  const contextState = appStore.getContext<T>(contextId);
  const loading = appStore.isContextLoading(contextId);
  const error = appStore.getContextError(contextId);

  // Data loading function
  const load = useCallback(
    async (params?: PaginationParams) => {
      appStore.setLoading(contextId, true);

      try {
        // Merge with current filters if no params provided
        const currentFilters = contextState?.filters;
        const currentPagination = contextState?.pagination;

        const requestParams: Record<string, unknown> = params
          ? { ...params }
          : {
              page: currentPagination?.currentPage || 1,
              limit: currentPagination?.itemsPerPage || 20,
              search: currentFilters?.searchTerm || "",
              sort: currentFilters?.sortBy || "",
              order: currentFilters?.sortOrder || "asc",
              ...currentFilters?.customFilters,
            };

        if (params?.filters) {
          Object.assign(requestParams, params.filters);
          delete requestParams["filters"];
        } else if (!params && currentFilters?.customFilters) {
          Object.assign(requestParams, currentFilters.customFilters);
        }

        const response = await apiClient.get<ApiResponse<PaginatedResponse<T>>>(endpoint, {
          params: requestParams,
          cache: true,
          cacheTTL: cacheTimeout,
        });

        if (response?.data) {
          let processedData = response.data.items;

          // Apply transformation if provided
          if (transform) {
            processedData = transform(response.data.items);
          }

          // Update context state
          appStore.setContextData(contextId, processedData);

          // Update pagination
          appStore.updatePagination(contextId, {
            currentPage: response.data.page,
            itemsPerPage: response.data.limit,
            totalItems: response.data.total,
            totalPages: response.data.totalPages,
            hasNext: response.data.hasNext,
            hasPrev: response.data.hasPrev,
          });

          appStore.setLastUpdated(contextId);
          onSuccess?.(processedData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load data";
        appStore.setError(contextId, errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        appStore.setLoading(contextId, false);
      }
    },
    [
      apiClient,
      appStore,
      contextId,
      endpoint,
      cacheTimeout,
      transform,
      onSuccess,
      onError,
      contextState?.filters,
      contextState?.pagination,
    ],
  );

  // Reload function
  const reload = useCallback(() => {
    // Clear cache for this endpoint
    apiClient.invalidateEndpointCache(endpoint);
    return load();
  }, [apiClient, endpoint, load]);

  // CRUD operations
  const create = useCallback(
    async (data: Omit<T, "id">): Promise<T | null> => {
      appStore.setGlobalLoading(true, "Creating...");

      try {
        const response = await apiClient.post<ApiResponse<T>>(endpoint, data);

        if (response?.data) {
          // Add to local state
          const currentData = contextState?.data || [];
          appStore.setContextData(contextId, [response.data, ...currentData]);

          // Invalidate cache and reload for consistency
          apiClient.invalidateEndpointCache(endpoint);
          await load();

          appStore.addNotification({
            type: "success",
            title: "Success",
            message: "Item created successfully",
          });

          return response.data;
        }

        return null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create item";
        appStore.addNotification({
          type: "error",
          title: "Error",
          message: errorMessage,
        });
        throw err;
      } finally {
        appStore.setGlobalLoading(false);
      }
    },
    [apiClient, appStore, contextId, endpoint, contextState?.data, load],
  );

  const update = useCallback(
    async (id: string, data: Partial<T>): Promise<T | null> => {
      appStore.setGlobalLoading(true, "Updating...");

      try {
        const response = await apiClient.put<ApiResponse<T>>(`${endpoint}/${id}`, data);

        if (response?.data) {
          // Update local state
          const currentData = contextState?.data || [];
          const updatedData = currentData.map((item) =>
            (item as any).id === id ? response.data! : item,
          );
          appStore.setContextData(contextId, updatedData);

          // Invalidate cache
          apiClient.invalidateCacheByPattern(new RegExp(`${endpoint}/${id}`));
          apiClient.invalidateEndpointCache(endpoint);

          appStore.addNotification({
            type: "success",
            title: "Success",
            message: "Item updated successfully",
          });

          return response.data;
        }

        return null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update item";
        appStore.addNotification({
          type: "error",
          title: "Error",
          message: errorMessage,
        });
        throw err;
      } finally {
        appStore.setGlobalLoading(false);
      }
    },
    [apiClient, appStore, contextId, endpoint, contextState?.data],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const confirmed = await new Promise<boolean>((resolve) => {
        appStore.openConfirmDialog({
          title: "Confirm Delete",
          message: "Are you sure you want to delete this item? This action cannot be undone.",
          variant: "danger",
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) return false;

      appStore.setGlobalLoading(true, "Deleting...");

      try {
        const response = await apiClient.delete<ApiResponse<void>>(`${endpoint}/${id}`);

        if (response?.success === false) {
          return false;
        }

        // Remove from local state
        const currentData = contextState?.data || [];
        const filteredData = currentData.filter((item) => (item as any).id !== id);
        appStore.setContextData(contextId, filteredData);

        // Invalidate cache
        apiClient.invalidateCacheByPattern(new RegExp(`${endpoint}/${id}`));
        apiClient.invalidateEndpointCache(endpoint);

        appStore.addNotification({
          type: "success",
          title: "Success",
          message: "Item deleted successfully",
        });

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete item";
        appStore.addNotification({
          type: "error",
          title: "Error",
          message: errorMessage,
        });
        throw err;
      } finally {
        appStore.setGlobalLoading(false);
      }
    },
    [apiClient, appStore, contextId, endpoint, contextState?.data],
  );

  // Bulk operations
  const bulkCreate = useCallback(
    async (items: Omit<T, "id">[]): Promise<T[]> => {
      appStore.setGlobalLoading(true, `Creating ${items.length} items...`);

      try {
        const response = await apiClient.post<ApiResponse<T[]>>(`${endpoint}/bulk`, {
          items,
        });

        if (response?.data) {
          // Reload data for consistency
          await load();

          appStore.addNotification({
            type: "success",
            title: "Success",
            message: `${items.length} items created successfully`,
          });

          return response.data;
        }

        return [];
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create items";
        appStore.addNotification({
          type: "error",
          title: "Error",
          message: errorMessage,
        });
        throw err;
      } finally {
        appStore.setGlobalLoading(false);
      }
    },
    [apiClient, appStore, endpoint, load],
  );

  const bulkUpdate = useCallback(
    async (updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]> => {
      appStore.setGlobalLoading(true, `Updating ${updates.length} items...`);

      try {
        const response = await apiClient.put<ApiResponse<T[]>>(`${endpoint}/bulk`, {
          updates,
        });

        if (response?.data) {
          // Reload data for consistency
          await load();

          appStore.addNotification({
            type: "success",
            title: "Success",
            message: `${updates.length} items updated successfully`,
          });

          return response.data;
        }

        return [];
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update items";
        appStore.addNotification({
          type: "error",
          title: "Error",
          message: errorMessage,
        });
        throw err;
      } finally {
        appStore.setGlobalLoading(false);
      }
    },
    [apiClient, appStore, endpoint, load],
  );

  const bulkDelete = useCallback(
    async (ids: string[]): Promise<boolean> => {
      const confirmed = await new Promise<boolean>((resolve) => {
        appStore.openConfirmDialog({
          title: "Confirm Bulk Delete",
          message: `Are you sure you want to delete ${ids.length} items? This action cannot be undone.`,
          variant: "danger",
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) return false;

      appStore.setGlobalLoading(true, `Deleting ${ids.length} items...`);

      try {
        const response = await apiClient.delete<ApiResponse<void>>(`${endpoint}/bulk`, {
          data: { ids },
        });

        if (response?.success === false) {
          return false;
        }

        // Reload data for consistency
        await load();

        appStore.addNotification({
          type: "success",
          title: "Success",
          message: `${ids.length} items deleted successfully`,
        });

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete items";
        appStore.addNotification({
          type: "error",
          title: "Error",
          message: errorMessage,
        });
        throw err;
      } finally {
        appStore.setGlobalLoading(false);
      }
    },
    [apiClient, appStore, endpoint, load],
  );

  // Export function
  const exportData = useCallback(
    async (format: "csv" | "xlsx" | "json") => {
      appStore.setGlobalLoading(true, "Generating export...");

      try {
        const currentFilters = contextState?.filters;
        const response = await apiClient.get<Blob>(`${endpoint}/export`, {
          params: {
            format,
            ...currentFilters?.customFilters,
            search: currentFilters?.searchTerm,
          },
          cache: false,
        });

        const blob = response;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${contextId}-export-${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        appStore.addNotification({
          type: "success",
          title: "Success",
          message: "Data exported successfully",
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to export data";
        appStore.addNotification({
          type: "error",
          title: "Error",
          message: errorMessage,
        });
      } finally {
        appStore.setGlobalLoading(false);
      }
    },
    [apiClient, appStore, contextId, endpoint, contextState?.filters],
  );

  // WebSocket connection for real-time updates
  const connect = useCallback(() => {
    if (!websocketEndpoint || !enableRealtime || isConnectedRef.current) return;

    try {
      const ws = new WebSocket(websocketEndpoint);
      websocketRef.current = ws;

      ws.onopen = () => {
        isConnectedRef.current = true;
        ws.send(JSON.stringify({ type: "subscribe", channel: contextId }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.channel === contextId) {
            switch (message.type) {
              case "created":
              case "updated":
              case "deleted":
                // Reload data when changes occur
                load();
                break;
            }
          }
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };

      ws.onclose = () => {
        isConnectedRef.current = false;
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnectedRef.current = false;
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  }, [websocketEndpoint, enableRealtime, contextId, load]);

  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
      isConnectedRef.current = false;
    }
  }, []);

  // Auto-load data on mount and dependency changes
  useEffect(() => {
    if (autoLoad) {
      load();
    }

    // Set up polling if configured
    if (pollInterval > 0) {
      pollIntervalRef.current = setInterval(load, pollInterval);
    }

    // Connect to WebSocket if enabled
    if (enableRealtime) {
      connect();
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      disconnect();
    };
  }, [autoLoad, pollInterval, enableRealtime, ...dependencies]);

  // Computed values
  const selectedIds = useMemo(() => {
    return contextState?.selection?.selectedItems?.map((item) => (item as any).id) || [];
  }, [contextState?.selection?.selectedItems]);

  const filteredData = useMemo<T[]>(() => {
    return (appStore.getFilteredData(contextId) as T[]) || [];
  }, [appStore, contextId, contextState?.data, contextState?.filters]);

  return {
    // Data state
    data: contextState?.data || [],
    loading,
    error,
    lastUpdated: contextState?.lastFetch || null,

    // Context state
    pagination: contextState?.pagination || {
      currentPage: 1,
      itemsPerPage: 20,
      totalItems: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
    selection: contextState?.selection || {
      selectedItems: [],
      lastSelected: null,
      selectAll: false,
      isMultiSelect: false,
    },
    filters: contextState?.filters || {
      searchTerm: "",
      statusFilter: "",
      sortBy: "",
      sortOrder: "asc",
      customFilters: {},
      showAdvanced: false,
    },

    // Data operations
    load,
    reload,
    create,
    update,
    remove,
    bulkCreate,
    bulkUpdate,
    bulkDelete,

    // Selection management
    selectItem: (item: T, multiple?: boolean) => appStore.selectItem(contextId, item, multiple),
    selectItems: (items: T[]) =>
      items.forEach((item) => appStore.selectItem(contextId, item, true)),
    deselectItem: (item: T) => appStore.deselectItem(contextId, item),
    clearSelection: () => appStore.clearSelection(contextId),
    toggleSelectAll: () => appStore.toggleSelectAll(contextId, contextState?.data || []),

    // Filter management
    setFilters: (filters: Partial<FilterState>) => {
      appStore.updateFilters(contextId, filters);
      load(); // Reload with new filters
    },
    resetFilters: () => {
      appStore.resetFilters(contextId);
      load();
    },
    setSearch: (term: string) => {
      appStore.setSearchTerm(contextId, term);
      load();
    },
    setSorting: (sortBy: string, order: "asc" | "desc" = "asc") => {
      appStore.setSorting(contextId, sortBy, order);
      load();
    },

    // Pagination management
    setPage: (page: number) => {
      appStore.setCurrentPage(contextId, page);
      load();
    },
    setPageSize: (size: number) => {
      appStore.setItemsPerPage(contextId, size);
      load();
    },
    nextPage: () => {
      if (contextState?.pagination?.hasNext) {
        appStore.goToNextPage(contextId);
        load();
      }
    },
    prevPage: () => {
      if (contextState?.pagination?.hasPrev) {
        appStore.goToPrevPage(contextId);
        load();
      }
    },

    // Utility functions
    getSelectedIds: () => selectedIds,
    getFilteredData: (customFilter?: (item: T) => boolean) =>
      customFilter ? filteredData.filter(customFilter) : filteredData,
    exportData,

    // Real-time connection
    isConnected: isConnectedRef.current,
    connect,
    disconnect,
  };
}

export default useDataManager;
