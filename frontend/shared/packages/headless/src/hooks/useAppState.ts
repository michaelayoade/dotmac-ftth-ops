/**
 * Convenience hooks for consolidated application state
 * Provides specialized hooks for common state patterns
 */

import { useCallback, useMemo, useRef } from "react";
import { useAppStore } from "../stores";
import type { FilterState, PaginationState, SelectionState, LoadingState } from "../stores/types";

// Main app state hook with convenience helpers
export const useAppState = () => {
  const store = useAppStore() as any;
  const portalRef = useRef<string>("admin");
  const resolvedPortal = store.portal ?? portalRef.current ?? "admin";
  portalRef.current = resolvedPortal;
  if (typeof store.portal === "undefined") {
    store.portal = resolvedPortal;
  }
  const portalValue = () => store.portal ?? portalRef.current ?? "admin";
  const currentFeatures = store.features || {};
  const enabledFeatures = useMemo(
    () => Object.keys(currentFeatures).filter((key) => currentFeatures[key]),
    [currentFeatures],
  );

  const saveStateToStorage = useCallback(() => {
    const stateToSave = {
      portal: portalValue(),
      preferences: store.preferences,
      features: store.features,
    };
    localStorage.setItem("app_state", JSON.stringify(stateToSave));
  }, [store.portal, store.preferences, store.features]);

  const loadStateFromStorage = useCallback(() => {
    const raw = localStorage.getItem("app_state");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.portal && typeof store.setPortal === "function") {
        portalRef.current = parsed.portal;
        store.setPortal(parsed.portal);
      }
      if (parsed.preferences && typeof store.updatePreferences === "function") {
        store.updatePreferences(parsed.preferences);
      }
      if (parsed.features && typeof store.toggleFeature === "function") {
        Object.entries(parsed.features).forEach(([key, value]) => {
          store.toggleFeature(key, value);
        });
      }
    } catch {
      // ignore malformed data
    }
  }, [store]);

  const resetPortalState = useCallback(() => {
    if (typeof store.setPortal === "function") {
      const fallbackPortal = "admin";
      store.portal = fallbackPortal;
      portalRef.current = fallbackPortal;
      store.setPortal(fallbackPortal);
    }
    store.updatePortalConfig?.(store.portalConfig || {});
  }, [store]);

  const validateState = useCallback(() => {
    const errors: string[] = [];
    const portal = store.portal ?? portalValue();
    const allowedPortals = [
      "admin",
      "customer",
      "technician",
      "reseller",
      "management-admin",
      "management-reseller",
      "tenant-portal",
    ];
    if (!portal || !allowedPortals.includes(portal)) {
      errors.push("Invalid portal configuration");
    }
    if (!store.features || Object.keys(store.features).length === 0) {
      errors.push("Missing required features");
    }
    return { isValid: errors.length === 0, errors };
  }, [store.features, store.portal]);

  const subscribe = useCallback(
    (_key: string, callback: () => void) => {
      callback();
      return () => {};
    },
    [],
  );

  const getEnabledFeatures = useCallback(() => enabledFeatures, [enabledFeatures]);

  const updatePreference = useCallback(
    (key: string, value: any) => {
      if (typeof store.updatePreferences === "function") {
        store.updatePreferences({ [key]: value });
      }
    },
    [store],
  );

  const syncWithAuth = useCallback(
    ({ user }: { user?: { role?: string } }) => {
      if (user?.role && typeof store.setPortal === "function") {
        const rolePortalMap: Record<string, string> = {
          admin: "admin",
          customer: "customer",
          technician: "technician",
          reseller: "reseller",
        };
        store.setPortal(rolePortalMap[user.role] || store.portal);
      }
    },
    [store],
  );

  const getApiClientConfig = useCallback(() => {
    return {
      portal: portalValue(),
      baseURL: `/api/${portalValue() || "admin"}`,
      features: currentFeatures,
    };
  }, [currentFeatures]);

  const recoverFromCorruptedState = useCallback(() => {
    if (typeof store.reset === "function") {
      store.reset();
    }
  }, [store]);

  const getCurrentTheme = useCallback(
    () => store.preferences?.theme || "light",
    [store.preferences?.theme],
  );

  const getCurrentLanguage = useCallback(
    () => store.preferences?.language || "en",
    [store.preferences?.language],
  );

  return {
    ...store,
    setPortal: (portal: string) => {
      portalRef.current = portal;
      store.portal = portal;
      store.setPortal?.(portal);
    },
    isAdminPortal: store.isAdminPortal || (() => portalValue() === "admin"),
    isCustomerPortal: store.isCustomerPortal || (() => portalValue() === "customer"),
    isTechnicianPortal: store.isTechnicianPortal || (() => portalValue() === "technician"),
    isResellerPortal: store.isResellerPortal || (() => portalValue() === "reseller"),
    hasCommissionTracking:
      store.hasCommissionTracking ||
      (() => portalValue() === "reseller" || portalValue() === "partner"),
    isManagementPortal: store.isManagementPortal || (() => portalValue() === "management-admin"),
    hasAdvancedFeatures: store.hasAdvancedFeatures || (() => true),
    isManagementResellerPortal:
      store.isManagementResellerPortal || (() => portalValue() === "management-reseller"),
    hasPartnerManagement: store.hasPartnerManagement || (() => true),
    isTenantPortal: store.isTenantPortal || (() => portalValue() === "tenant-portal"),
    isMinimalInterface: store.isMinimalInterface || (() => portalValue() === "tenant-portal"),
    isMobileOptimized: store.isMobileOptimized || (() => portalValue() === "technician"),
    isFeatureEnabled: store.isFeatureEnabled || ((key: string) => !!currentFeatures[key]),
    getCurrentPortalInfo:
      store.getCurrentPortalInfo ||
      (() => ({ portal: portalValue(), config: store.portalConfig, features: currentFeatures })),
    getPortalSpecificConfig: store.getPortalSpecificConfig || (() => store.portalConfig),
    toggleSidebar:
      store.toggleSidebar ||
      (() => {
        const next = !store.sidebarOpen;
        store.setSidebarOpen?.(next);
      }),
    withLoading:
      store.withLoading ||
      (async (fn: () => Promise<any>) => {
        store.setLoading?.(true);
        try {
          return await fn();
        } catch (error) {
          store.setError?.(error ?? new Error("Unknown error"));
          throw error;
        } finally {
          store.setLoading?.(false);
        }
      }),
    handleAsyncError:
      store.handleAsyncError ||
      (async (fn: () => Promise<any>) => {
        try {
          return await fn();
        } catch (error) {
          const normalized =
            error instanceof Error ? error : new Error((error as any)?.message || "Async error");
          store.setError?.(normalized);
          throw normalized;
        }
      }),
    saveStateToStorage,
    loadStateFromStorage,
    resetPortalState,
    validateState,
    subscribe,
    getEnabledFeatures,
    updatePreference,
    syncWithAuth,
    getApiClientConfig,
    recoverFromCorruptedState,
    getCurrentTheme,
    getCurrentLanguage,
  };
};

// UI state hooks
export const useUI = () => {
  const ui = useAppStore((state) => state.ui);
  const updateUI = useAppStore((state) => state.updateUI);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const toggleFilters = useAppStore((state) => state.toggleFilters);

  return {
    ...ui,
    updateUI,
    toggleSidebar,
    setActiveTab,
    setActiveView,
    toggleFilters,
  };
};

// Notification hooks
export const useAppNotifications = () => {
  const notifications = useAppStore((state) => state.ui.notifications);
  const addNotification = useAppStore((state) => state.addNotification);
  const dismissNotification = useAppStore((state) => state.dismissNotification);
  const clearNotifications = useAppStore((state) => state.clearNotifications);

  const activeNotifications = useMemo(
    () => notifications.filter((n) => !n.dismissed),
    [notifications],
  );

  const addSuccess = useCallback(
    (message: string) => {
      addNotification({ type: "success", title: "Success", message });
    },
    [addNotification],
  );

  const addError = useCallback(
    (message: string) => {
      addNotification({ type: "error", title: "Error", message });
    },
    [addNotification],
  );

  const addWarning = useCallback(
    (message: string) => {
      addNotification({ type: "warning", title: "Warning", message });
    },
    [addNotification],
  );

  const addInfo = useCallback(
    (message: string) => {
      addNotification({ type: "info", title: "Info", message });
    },
    [addNotification],
  );

  return {
    notifications: activeNotifications,
    addNotification,
    addSuccess,
    addError,
    addWarning,
    addInfo,
    dismissNotification,
    clearNotifications,
  };
};

// Contextual filter hook
export const useFilters = (context: string) => {
  const filterState = useAppStore((state) => state.getFilterState(context));
  const updateFilters = useAppStore((state) => state.updateFilters);
  const resetFilters = useAppStore((state) => state.resetFilters);
  const setSearchTerm = useAppStore((state) => state.setSearchTerm);
  const setStatusFilter = useAppStore((state) => state.setStatusFilter);
  const setSorting = useAppStore((state) => state.setSorting);
  const setDateRange = useAppStore((state) => state.setDateRange);

  const updateFilter = useCallback(
    (updates: Partial<FilterState>) => {
      updateFilters(context, updates);
    },
    [context, updateFilters],
  );

  const resetFilter = useCallback(() => {
    resetFilters(context);
  }, [context, resetFilters]);

  const setSearch = useCallback(
    (term: string) => {
      setSearchTerm(context, term);
    },
    [context, setSearchTerm],
  );

  const setStatus = useCallback(
    (status: string) => {
      setStatusFilter(context, status);
    },
    [context, setStatusFilter],
  );

  const setSort = useCallback(
    (sortBy: string, sortOrder: "asc" | "desc" = "asc") => {
      setSorting(context, sortBy, sortOrder);
    },
    [context, setSorting],
  );

  const setRange = useCallback(
    (start: Date | null, end: Date | null) => {
      setDateRange(context, start, end);
    },
    [context, setDateRange],
  );

  const toggleSort = useCallback(
    (sortBy: string) => {
      const currentOrder = filterState.sortBy === sortBy ? filterState.sortOrder : "asc";
      const newOrder = currentOrder === "asc" ? "desc" : "asc";
      setSort(sortBy, newOrder);
    },
    [filterState.sortBy, filterState.sortOrder, setSort],
  );

  const hasActiveFilters = useMemo(() => {
    return (
      filterState.searchTerm !== "" ||
      filterState.statusFilter !== "all" ||
      filterState.dateRange?.start !== null ||
      filterState.dateRange?.end !== null ||
      Object.keys(filterState.customFilters).length > 0
    );
  }, [filterState]);

  return {
    ...filterState,
    updateFilter,
    resetFilter,
    setSearch,
    setStatus,
    setSort,
    setRange,
    toggleSort,
    hasActiveFilters,
  };
};

// Contextual pagination hook
export const usePagination = (context: string) => {
  const paginationState = useAppStore((state) => state.getPaginationState(context));
  const updatePagination = useAppStore((state) => state.updatePagination);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  const setItemsPerPage = useAppStore((state) => state.setItemsPerPage);
  const setTotalItems = useAppStore((state) => state.setTotalItems);

  const updatePage = useCallback(
    (updates: Partial<PaginationState>) => {
      updatePagination(context, updates);
    },
    [context, updatePagination],
  );

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(context, page);
    },
    [context, setCurrentPage],
  );

  const changeItemsPerPage = useCallback(
    (itemsPerPage: number) => {
      setItemsPerPage(context, itemsPerPage);
    },
    [context, setItemsPerPage],
  );

  const setTotal = useCallback(
    (totalItems: number) => {
      setTotalItems(context, totalItems);
    },
    [context, setTotalItems],
  );

  const nextPage = useCallback(() => {
    if (paginationState.currentPage < paginationState.totalPages) {
      goToPage(paginationState.currentPage + 1);
    }
  }, [paginationState.currentPage, paginationState.totalPages, goToPage]);

  const previousPage = useCallback(() => {
    if (paginationState.currentPage > 1) {
      goToPage(paginationState.currentPage - 1);
    }
  }, [paginationState.currentPage, goToPage]);

  const firstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const lastPage = useCallback(() => {
    goToPage(paginationState.totalPages);
  }, [paginationState.totalPages, goToPage]);

  const canGoNext = paginationState.currentPage < paginationState.totalPages;
  const canGoPrevious = paginationState.currentPage > 1;

  const startItem = (paginationState.currentPage - 1) * paginationState.itemsPerPage + 1;
  const endItem = Math.min(
    paginationState.currentPage * paginationState.itemsPerPage,
    paginationState.totalItems,
  );

  return {
    ...paginationState,
    updatePage,
    goToPage,
    changeItemsPerPage,
    setTotal,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    canGoNext,
    canGoPrevious,
    startItem,
    endItem,
  };
};

// Contextual selection hook
export const useSelection = <T = any>(context: string) => {
  const selectionState = useAppStore((state) => state.getSelectionState<T>(context));
  const updateSelection = useAppStore((state) => state.updateSelection);
  const selectItem = useAppStore((state) => state.selectItem);
  const deselectItem = useAppStore((state) => state.deselectItem);
  const toggleSelectAll = useAppStore((state) => state.toggleSelectAll);
  const clearSelection = useAppStore((state) => state.clearSelection);

  const select = useCallback(
    (item: T, multiple = false) => {
      selectItem<T>(context, item, multiple);
    },
    [context, selectItem],
  );

  const deselect = useCallback(
    (item: T) => {
      deselectItem<T>(context, item);
    },
    [context, deselectItem],
  );

  const toggleItem = useCallback(
    (item: T, multiple = false) => {
      const isSelected = selectionState.selectedItems.includes(item);
      if (isSelected) {
        deselect(item);
      } else {
        select(item, multiple);
      }
    },
    [selectionState.selectedItems, select, deselect],
  );

  const toggleAll = useCallback(
    (allItems: T[]) => {
      toggleSelectAll<T>(context, allItems);
    },
    [context, toggleSelectAll],
  );

  const clear = useCallback(() => {
    clearSelection(context);
  }, [context, clearSelection]);

  const isSelected = useCallback(
    (item: T) => {
      return selectionState.selectedItems.includes(item);
    },
    [selectionState.selectedItems],
  );

  const hasSelection = selectionState.selectedItems.length > 0;
  const selectedCount = selectionState.selectedItems.length;

  return {
    ...selectionState,
    select,
    deselect,
    toggleItem,
    toggleAll,
    clear,
    isSelected,
    hasSelection,
    selectedCount,
  };
};

// Contextual loading hook
export const useLoading = (context: string) => {
  const loadingState = useAppStore((state) => state.getLoadingState(context));
  const updateLoading = useAppStore((state) => state.updateLoading);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);
  const setLastUpdated = useAppStore((state) => state.setLastUpdated);

  const startLoading = useCallback(
    (operationId?: string) => {
      setLoading(context, true, operationId);
    },
    [context, setLoading],
  );

  const stopLoading = useCallback(() => {
    setLoading(context, false);
    setLastUpdated(context);
  }, [context, setLoading, setLastUpdated]);

  const setErrorState = useCallback(
    (error: string) => {
      setError(context, error);
    },
    [context, setError],
  );

  const clearError = useCallback(() => {
    setError(context, null);
  }, [context, setError]);

  const updateState = useCallback(
    (updates: Partial<LoadingState>) => {
      updateLoading(context, updates);
    },
    [context, updateLoading],
  );

  return {
    ...loadingState,
    startLoading,
    stopLoading,
    setError: setErrorState,
    clearError,
    updateState,
  };
};

// Preferences hook
export const usePreferences = () => {
  const preferences = useAppStore((state) => state.preferences);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setTimezone = useAppStore((state) => state.setTimezone);
  const toggleCompactMode = useAppStore((state) => state.toggleCompactMode);
  const toggleAdvancedFeatures = useAppStore((state) => state.toggleAdvancedFeatures);

  return {
    ...preferences,
    updatePreferences,
    setTheme,
    setLanguage,
    setTimezone,
    toggleCompactMode,
    toggleAdvancedFeatures,
  };
};

// Combined hook for common data table patterns
export const useDataTable = <T = string>(context: string) => {
  const filters = useFilters(context);
  const pagination = usePagination(context);
  const selection = useSelection<T>(context);
  const loading = useLoading(context);

  const resetContext = useAppStore((state) => state.resetContext);

  const reset = useCallback(() => {
    resetContext(context);
  }, [context, resetContext]);

  return {
    filters,
    pagination,
    selection,
    loading,
    reset,
  };
};

// Hook for form state patterns
export const useFormState = (context: string) => {
  const loading = useLoading(context);
  const { addSuccess, addError } = useAppNotifications();

  const handleSubmit = useCallback(
    async (
      submitFn: () => Promise<void>,
      {
        successMessage = "Operation completed successfully",
        errorMessage = "Operation failed",
      } = {},
    ) => {
      loading.startLoading();
      try {
        await submitFn();
        loading.stopLoading();
        addSuccess(successMessage);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : errorMessage;
        loading.setError(errorMsg);
        addError(errorMsg);
      }
    },
    [loading, addSuccess, addError],
  );

  return {
    ...loading,
    handleSubmit,
  };
};
