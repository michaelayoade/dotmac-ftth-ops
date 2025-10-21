/**
 * Convenience hooks for consolidated application state
 * Provides specialized hooks for common state patterns
 */

import { useCallback, useMemo } from "react";
import {
  useAppStore,
  FilterState,
  PaginationState,
  SelectionState,
  LoadingState,
} from "@dotmac/headless/stores";

// Main app state hook
export const useAppState = () => useAppStore();

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
      addNotification({ type: "success", message });
    },
    [addNotification],
  );

  const addError = useCallback(
    (message: string) => {
      addNotification({ type: "error", message });
    },
    [addNotification],
  );

  const addWarning = useCallback(
    (message: string) => {
      addNotification({ type: "warning", message });
    },
    [addNotification],
  );

  const addInfo = useCallback(
    (message: string) => {
      addNotification({ type: "info", message });
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
  const { addSuccess, addError } = useNotifications();

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
