/**
 * Consolidated Application State Store
 * Centralizes common UI and application state patterns
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "../utils/secureStorage";

// Common UI state interfaces
export interface FilterState {
  searchTerm: string;
  statusFilter: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  dateRange?: {
    start: Date | null;
    end: Date | null;
  };
  customFilters: Record<string, any>;
}

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

export interface SelectionState<T = any> {
  selectedItems: T[];
  lastSelected: T | null;
  selectAll: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  operationId: string | null;
}

export interface UIState {
  sidebarOpen: boolean;
  activeTab: string;
  activeView: string;
  showFilters: boolean;
  showBulkActions: boolean;
  notifications: {
    id: string;
    type: "success" | "error" | "warning" | "info";
    message: string;
    timestamp: Date;
    dismissed: boolean;
  }[];
}

// Consolidated application state
interface AppState {
  // UI State
  ui: UIState;

  // Common data management patterns
  filters: Record<string, FilterState>;
  pagination: Record<string, PaginationState>;
  selections: Record<string, SelectionState<any>>;
  loading: Record<string, LoadingState>;

  // App-level preferences
  preferences: {
    theme: "light" | "dark" | "auto";
    language: string;
    timezone: string;
    dataRefreshInterval: number;
    compactMode: boolean;
    showAdvancedFeatures: boolean;
  };
}

interface AppActions {
  // UI Actions
  updateUI: (updates: Partial<UIState>) => void;
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  setActiveView: (view: string) => void;
  toggleFilters: (context?: string) => void;

  // Notification Actions
  addNotification: (
    notification: Omit<UIState["notifications"][0], "id" | "timestamp" | "dismissed">,
  ) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;

  // Filter Actions
  updateFilters: (context: string, updates: Partial<FilterState>) => void;
  resetFilters: (context: string) => void;
  setSearchTerm: (context: string, term: string) => void;
  setStatusFilter: (context: string, status: string) => void;
  setSorting: (context: string, sortBy: string, sortOrder?: "asc" | "desc") => void;
  setDateRange: (context: string, start: Date | null, end: Date | null) => void;

  // Pagination Actions
  updatePagination: (context: string, updates: Partial<PaginationState>) => void;
  setCurrentPage: (context: string, page: number) => void;
  setItemsPerPage: (context: string, itemsPerPage: number) => void;
  setTotalItems: (context: string, totalItems: number) => void;

  // Selection Actions
  updateSelection: <T = any>(context: string, updates: Partial<SelectionState<T>>) => void;
  selectItem: <T = any>(context: string, item: T, multiple?: boolean) => void;
  deselectItem: <T = any>(context: string, item: T) => void;
  toggleSelectAll: <T = any>(context: string, allItems: T[]) => void;
  clearSelection: (context: string) => void;

  // Loading Actions
  updateLoading: (context: string, updates: Partial<LoadingState>) => void;
  setLoading: (context: string, isLoading: boolean, operationId?: string) => void;
  setError: (context: string, error: string | null) => void;
  setLastUpdated: (context: string, timestamp?: Date) => void;

  // Preference Actions
  updatePreferences: (updates: Partial<AppState["preferences"]>) => void;
  setTheme: (theme: "light" | "dark" | "auto") => void;
  setLanguage: (language: string) => void;
  setTimezone: (timezone: string) => void;
  toggleCompactMode: () => void;
  toggleAdvancedFeatures: () => void;

  // Utility Actions
  getFilterState: (context: string) => FilterState;
  getPaginationState: (context: string) => PaginationState;
  getSelectionState: <T = any>(context: string) => SelectionState<T>;
  getLoadingState: (context: string) => LoadingState;
  resetContext: (context: string) => void;
  resetAllContexts: () => void;
}

type AppStore = AppState & AppActions;

// Default state values
const defaultFilterState: FilterState = {
  searchTerm: "",
  statusFilter: "all",
  sortBy: "name",
  sortOrder: "asc",
  dateRange: { start: null, end: null },
  customFilters: {},
};

const defaultPaginationState: PaginationState = {
  currentPage: 1,
  itemsPerPage: 25,
  totalItems: 0,
  totalPages: 0,
};

const defaultSelectionState: SelectionState<any> = {
  selectedItems: [],
  lastSelected: null,
  selectAll: false,
};

const defaultLoadingState: LoadingState = {
  isLoading: false,
  error: null,
  lastUpdated: null,
  operationId: null,
};

const defaultUIState: UIState = {
  sidebarOpen: true,
  activeTab: "",
  activeView: "list",
  showFilters: false,
  showBulkActions: false,
  notifications: [],
};

const defaultPreferences: AppState["preferences"] = {
  theme: "light",
  language: "en",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dataRefreshInterval: 30000, // 30 seconds
  compactMode: false,
  showAdvancedFeatures: false,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ui: defaultUIState,
      filters: {},
      pagination: {},
      selections: {},
      loading: {},
      preferences: defaultPreferences,

      // UI Actions
      updateUI: (updates) => {
        set((state) => ({
          ui: { ...state.ui, ...updates },
        }));
      },

      toggleSidebar: () => {
        set((state) => ({
          ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
        }));
      },

      setActiveTab: (tab) => {
        set((state) => ({
          ui: { ...state.ui, activeTab: tab },
        }));
      },

      setActiveView: (view) => {
        set((state) => ({
          ui: { ...state.ui, activeView: view },
        }));
      },

      toggleFilters: (context) => {
        if (context) {
          // Context-specific filter toggle (for complex components)
          set((state) => ({
            filters: {
              ...state.filters,
              [context]: {
                ...get().getFilterState(context),
                // Could add context-specific filter visibility logic here
              },
            },
          }));
        } else {
          // Global filter toggle
          set((state) => ({
            ui: { ...state.ui, showFilters: !state.ui.showFilters },
          }));
        }
      },

      // Notification Actions
      addNotification: (notification) => {
        const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          ui: {
            ...state.ui,
            notifications: [
              ...state.ui.notifications,
              {
                ...notification,
                id,
                timestamp: new Date(),
                dismissed: false,
              },
            ],
          },
        }));
      },

      dismissNotification: (id) => {
        set((state) => ({
          ui: {
            ...state.ui,
            notifications: state.ui.notifications.map((n) =>
              n.id === id ? { ...n, dismissed: true } : n,
            ),
          },
        }));
      },

      clearNotifications: () => {
        set((state) => ({
          ui: { ...state.ui, notifications: [] },
        }));
      },

      // Filter Actions
      updateFilters: (context, updates) => {
        set((state) => ({
          filters: {
            ...state.filters,
            [context]: { ...get().getFilterState(context), ...updates },
          },
        }));
      },

      resetFilters: (context) => {
        set((state) => ({
          filters: {
            ...state.filters,
            [context]: defaultFilterState,
          },
        }));
      },

      setSearchTerm: (context, term) => {
        get().updateFilters(context, { searchTerm: term });
      },

      setStatusFilter: (context, status) => {
        get().updateFilters(context, { statusFilter: status });
      },

      setSorting: (context, sortBy, sortOrder = "asc") => {
        get().updateFilters(context, { sortBy, sortOrder });
      },

      setDateRange: (context, start, end) => {
        get().updateFilters(context, { dateRange: { start, end } });
      },

      // Pagination Actions
      updatePagination: (context, updates) => {
        set((state) => {
          const currentPagination = get().getPaginationState(context);
          const newPagination = { ...currentPagination, ...updates };

          // Auto-calculate totalPages when totalItems or itemsPerPage changes
          if ("totalItems" in updates || "itemsPerPage" in updates) {
            newPagination.totalPages = Math.ceil(
              newPagination.totalItems / newPagination.itemsPerPage,
            );
          }

          return {
            pagination: {
              ...state.pagination,
              [context]: newPagination,
            },
          };
        });
      },

      setCurrentPage: (context, page) => {
        get().updatePagination(context, { currentPage: page });
      },

      setItemsPerPage: (context, itemsPerPage) => {
        get().updatePagination(context, { itemsPerPage, currentPage: 1 }); // Reset to first page
      },

      setTotalItems: (context, totalItems) => {
        get().updatePagination(context, { totalItems });
      },

      // Selection Actions
      updateSelection: (context, updates) => {
        set((state) => ({
          selections: {
            ...state.selections,
            [context]: { ...get().getSelectionState(context), ...updates },
          },
        }));
      },

      selectItem: (context, item, multiple = false) => {
        const currentSelection = get().getSelectionState(context);
        const isSelected = currentSelection.selectedItems.includes(item as any);

        let newSelectedItems: any[];
        if (isSelected) {
          newSelectedItems = currentSelection.selectedItems.filter((i) => i !== item);
        } else {
          newSelectedItems = multiple ? [...currentSelection.selectedItems, item] : [item];
        }

        get().updateSelection(context, {
          selectedItems: newSelectedItems,
          lastSelected: item as any,
          selectAll: false,
        });
      },

      deselectItem: (context, item) => {
        const currentSelection = get().getSelectionState(context);
        get().updateSelection(context, {
          selectedItems: currentSelection.selectedItems.filter((i) => i !== item),
          selectAll: false,
        });
      },

      toggleSelectAll: (context, allItems) => {
        const currentSelection = get().getSelectionState(context);
        const allSelected =
          currentSelection.selectAll || currentSelection.selectedItems.length === allItems.length;

        get().updateSelection(context, {
          selectedItems: allSelected ? [] : [...allItems],
          selectAll: !allSelected,
          lastSelected: null,
        });
      },

      clearSelection: (context) => {
        set((state) => ({
          selections: {
            ...state.selections,
            [context]: defaultSelectionState,
          },
        }));
      },

      // Loading Actions
      updateLoading: (context, updates) => {
        set((state) => ({
          loading: {
            ...state.loading,
            [context]: { ...get().getLoadingState(context), ...updates },
          },
        }));
      },

      setLoading: (context, isLoading, operationId) => {
        get().updateLoading(context, {
          isLoading,
          operationId,
          error: isLoading ? null : get().getLoadingState(context).error,
        });
      },

      setError: (context, error) => {
        get().updateLoading(context, { error, isLoading: false });
      },

      setLastUpdated: (context, timestamp = new Date()) => {
        get().updateLoading(context, { lastUpdated: timestamp });
      },

      // Preference Actions
      updatePreferences: (updates) => {
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        }));
      },

      setTheme: (theme) => {
        get().updatePreferences({ theme });
      },

      setLanguage: (language) => {
        get().updatePreferences({ language });
      },

      setTimezone: (timezone) => {
        get().updatePreferences({ timezone });
      },

      toggleCompactMode: () => {
        const { preferences } = get();
        get().updatePreferences({ compactMode: !preferences.compactMode });
      },

      toggleAdvancedFeatures: () => {
        const { preferences } = get();
        get().updatePreferences({
          showAdvancedFeatures: !preferences.showAdvancedFeatures,
        });
      },

      // Utility Actions
      getFilterState: (context) => {
        const { filters } = get();
        return filters[context] || defaultFilterState;
      },

      getPaginationState: (context) => {
        const { pagination } = get();
        return pagination[context] || defaultPaginationState;
      },

      getSelectionState: (context) => {
        const { selections } = get();
        return selections[context] || defaultSelectionState;
      },

      getLoadingState: (context) => {
        const { loading } = get();
        return loading[context] || defaultLoadingState;
      },

      resetContext: (context) => {
        set((state) => ({
          filters: { ...state.filters, [context]: defaultFilterState },
          pagination: {
            ...state.pagination,
            [context]: defaultPaginationState,
          },
          selections: { ...state.selections, [context]: defaultSelectionState },
          loading: { ...state.loading, [context]: defaultLoadingState },
        }));
      },

      resetAllContexts: () => {
        set({
          filters: {},
          pagination: {},
          selections: {},
          loading: {},
        });
      },
    }),
    {
      name: "dotmac-app-state",
      storage: createJSONStorage(() => ({
        getItem: (name) => secureStorage.getItem(name),
        setItem: (name, value) => secureStorage.setItem(name, value),
        removeItem: (name) => secureStorage.removeItem(name),
      })),
      partialize: (state) => ({
        // Persist UI preferences and non-sensitive state
        ui: {
          sidebarOpen: state.ui.sidebarOpen,
          activeView: state.ui.activeView,
          showFilters: state.ui.showFilters,
          // Don't persist notifications and active tabs
        },
        preferences: state.preferences,
        // Don't persist filters, selections, or loading state - these should reset on page load
      }),
    },
  ),
);
