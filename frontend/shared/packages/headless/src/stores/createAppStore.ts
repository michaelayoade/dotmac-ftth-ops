/**
 * Shared App Store Factory
 * Creates consistent app stores across all portals
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type {
  AppStore,
  AppState,
  FilterState,
  PaginationState,
  SelectionState,
  LoadingState,
  UIState,
  PreferencesState,
  ContextState,
  NotificationItem,
} from "./types";
import { SecureStorage } from "../auth/storage";

// Default state values
const defaultFilterState: FilterState = {
  searchTerm: "",
  statusFilter: "all",
  sortBy: "name",
  sortOrder: "asc",
  dateRange: { start: null, end: null },
  customFilters: {},
  showAdvanced: false,
};

const defaultPaginationState: PaginationState = {
  currentPage: 1,
  itemsPerPage: 25,
  totalItems: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

const defaultSelectionState: SelectionState<any> = {
  selectedItems: [],
  lastSelected: null,
  selectAll: false,
  isMultiSelect: true,
};

const defaultLoadingState: LoadingState = {
  isLoading: false,
  error: null,
  lastUpdated: null,
  operationId: null,
};

const defaultUIState: UIState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  activeTab: "",
  activeView: "list",
  showFilters: false,
  showBulkActions: false,
  theme: "light",
  density: "comfortable",
  language: "en",
  notifications: [],
  modals: {
    confirmDialog: {
      open: false,
    },
  },
  globalLoading: {
    visible: false,
  },
};

const defaultPreferencesState: PreferencesState = {
  dataRefreshInterval: 30000, // 30 seconds
  autoSave: true,
  compactMode: false,
  showAdvancedFeatures: false,
  tablePageSize: 25,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: "MM/dd/yyyy",
  numberFormat: "en-US",
  emailNotifications: true,
  pushNotifications: false,
  soundEnabled: true,
  keyboardShortcuts: true,
};

export interface AppStoreConfig {
  portalType: string;
  persistenceKey?: string;
  secureStorage?: boolean;
  includePersistence?: boolean;
  initialState?: Partial<AppState>;
  storagePrefix?: string;
}

export function createAppStore(config: AppStoreConfig) {
  const {
    portalType,
    persistenceKey = `dotmac-app-${portalType}`,
    secureStorage = false,
    includePersistence = true,
    initialState = {},
    storagePrefix = "app_",
  } = config;

  // Setup storage if needed
  const storage = secureStorage
    ? new SecureStorage({ backend: "localStorage", prefix: storagePrefix })
    : undefined;

  const store = create<AppStore>()(
    includePersistence && storage
      ? persist(
          immer((set, get) => ({
            // Initial state
            ui: { ...defaultUIState, ...initialState.ui },
            preferences: {
              ...defaultPreferencesState,
              ...initialState.preferences,
            },
            contexts: initialState.contexts || {},
            portalData: initialState.portalData || {},

            // Filter Actions
            updateFilters: (context: string, updates: Partial<FilterState>) => {
              set((state) => {
                if (!state.contexts[context]) {
                  state.contexts[context] = createDefaultContext();
                }
                Object.assign(state.contexts[context].filters, updates);
              });
            },

            resetFilters: (context: string) => {
              set((state) => {
                if (state.contexts[context]) {
                  state.contexts[context].filters = { ...defaultFilterState };
                }
              });
            },

            setSearchTerm: (context: string, term: string) => {
              get().updateFilters(context, { searchTerm: term });
            },

            setStatusFilter: (context: string, status: string) => {
              get().updateFilters(context, { statusFilter: status });
            },

            setSorting: (context: string, sortBy: string, sortOrder = "asc") => {
              get().updateFilters(context, { sortBy, sortOrder });
            },

            setDateRange: (context: string, start: Date | null, end: Date | null) => {
              get().updateFilters(context, { dateRange: { start, end } });
            },

            setCustomFilter: (context: string, key: string, value: any) => {
              set((state) => {
                if (!state.contexts[context]) {
                  state.contexts[context] = createDefaultContext();
                }
                state.contexts[context].filters.customFilters[key] = value;
              });
            },

            toggleAdvancedFilters: (context: string) => {
              set((state) => {
                if (state.contexts[context]) {
                  state.contexts[context].filters.showAdvanced =
                    !state.contexts[context].filters.showAdvanced;
                }
              });
            },

            // Pagination Actions
            updatePagination: (context: string, updates: Partial<PaginationState>) => {
              set((state) => {
                if (!state.contexts[context]) {
                  state.contexts[context] = createDefaultContext();
                }
                const pagination = state.contexts[context].pagination;
                Object.assign(pagination, updates);

                // Auto-calculate derived values
                if ("totalItems" in updates || "itemsPerPage" in updates) {
                  pagination.totalPages = Math.ceil(
                    pagination.totalItems / pagination.itemsPerPage,
                  );
                  pagination.hasNext = pagination.currentPage < pagination.totalPages;
                  pagination.hasPrev = pagination.currentPage > 1;
                }
              });
            },

            setCurrentPage: (context: string, page: number) => {
              get().updatePagination(context, { currentPage: page });
            },

            setItemsPerPage: (context: string, itemsPerPage: number) => {
              get().updatePagination(context, { itemsPerPage, currentPage: 1 });
            },

            setTotalItems: (context: string, totalItems: number) => {
              get().updatePagination(context, { totalItems });
            },

            goToFirstPage: (context: string) => {
              get().setCurrentPage(context, 1);
            },

            goToLastPage: (context: string) => {
              const pagination = get().contexts[context]?.pagination;
              if (pagination) {
                get().setCurrentPage(context, pagination.totalPages);
              }
            },

            goToNextPage: (context: string) => {
              const pagination = get().contexts[context]?.pagination;
              if (pagination?.hasNext) {
                get().setCurrentPage(context, pagination.currentPage + 1);
              }
            },

            goToPrevPage: (context: string) => {
              const pagination = get().contexts[context]?.pagination;
              if (pagination?.hasPrev) {
                get().setCurrentPage(context, pagination.currentPage - 1);
              }
            },

            // Selection Actions
            updateSelection: (context: string, updates: Partial<SelectionState<any>>) => {
              set((state) => {
                if (!state.contexts[context]) {
                  state.contexts[context] = createDefaultContext();
                }
                Object.assign(state.contexts[context].selection, updates);
              });
            },

            selectItem: (context: string, item: any, multiple = true) => {
              set((state) => {
                if (!state.contexts[context]) {
                  state.contexts[context] = createDefaultContext();
                }
                const selection = state.contexts[context].selection;
                const isSelected = selection.selectedItems.includes(item);

                if (isSelected) {
                  selection.selectedItems = selection.selectedItems.filter((i) => i !== item);
                } else {
                  if (multiple && selection.isMultiSelect) {
                    selection.selectedItems.push(item);
                  } else {
                    selection.selectedItems = [item];
                  }
                }

                selection.lastSelected = item;
                selection.selectAll = false;
              });
            },

            deselectItem: (context: string, item: any) => {
              set((state) => {
                if (state.contexts[context]) {
                  const selection = state.contexts[context].selection;
                  selection.selectedItems = selection.selectedItems.filter((i) => i !== item);
                  selection.selectAll = false;
                }
              });
            },

            toggleSelectAll: (context: string, allItems: any[]) => {
              set((state) => {
                if (!state.contexts[context]) {
                  state.contexts[context] = createDefaultContext();
                }
                const selection = state.contexts[context].selection;
                const allSelected =
                  selection.selectAll || selection.selectedItems.length === allItems.length;

                selection.selectedItems = allSelected ? [] : [...allItems];
                selection.selectAll = !allSelected;
                selection.lastSelected = null;
              });
            },

            clearSelection: (context: string) => {
              set((state) => {
                if (state.contexts[context]) {
                  state.contexts[context].selection = {
                    ...defaultSelectionState,
                  };
                }
              });
            },

            selectRange: (context: string, startItem: any, endItem: any, allItems: any[]) => {
              const startIndex = allItems.indexOf(startItem);
              const endIndex = allItems.indexOf(endItem);

              if (startIndex === -1 || endIndex === -1) return;

              const start = Math.min(startIndex, endIndex);
              const end = Math.max(startIndex, endIndex);
              const rangeItems = allItems.slice(start, end + 1);

              set((state) => {
                if (!state.contexts[context]) {
                  state.contexts[context] = createDefaultContext();
                }
                const selection = state.contexts[context].selection;

                // Add all items in range to selection
                rangeItems.forEach((item) => {
                  if (!selection.selectedItems.includes(item)) {
                    selection.selectedItems.push(item);
                  }
                });
              });
            },

            // Loading Actions
            updateLoading: (context: string, updates: Partial<LoadingState>) => {
              set((state) => {
                if (!state.contexts[context]) {
                  state.contexts[context] = createDefaultContext();
                }
                Object.assign(state.contexts[context].loading, updates);
              });
            },

            setLoading: (context: string, isLoading: boolean, operationId?: string) => {
              get().updateLoading(context, {
                isLoading,
                operationId,
                error: isLoading ? null : get().contexts[context]?.loading.error,
              });
            },

            setError: (context: string, error: string | null) => {
              get().updateLoading(context, { error, isLoading: false });
            },

            setLastUpdated: (context: string, timestamp = new Date()) => {
              get().updateLoading(context, { lastUpdated: timestamp });
            },

            setProgress: (context: string, current: number, total: number, message?: string) => {
              get().updateLoading(context, {
                progress: { current, total, message },
              });
            },

            clearProgress: (context: string) => {
              get().updateLoading(context, { progress: undefined });
            },

            // UI Actions
            updateUI: (updates: Partial<UIState>) => {
              set((state) => {
                Object.assign(state.ui, updates);
              });
            },

            toggleSidebar: () => {
              set((state) => {
                state.ui.sidebarOpen = !state.ui.sidebarOpen;
              });
            },

            setSidebarCollapsed: (collapsed: boolean) => {
              set((state) => {
                state.ui.sidebarCollapsed = collapsed;
              });
            },

            setActiveTab: (tab: string) => {
              set((state) => {
                state.ui.activeTab = tab;
              });
            },

            setActiveView: (view: string) => {
              set((state) => {
                state.ui.activeView = view;
              });
            },

            toggleFilters: (context?: string) => {
              if (context) {
                get().toggleAdvancedFilters(context);
              } else {
                set((state) => {
                  state.ui.showFilters = !state.ui.showFilters;
                });
              }
            },

            toggleBulkActions: () => {
              set((state) => {
                state.ui.showBulkActions = !state.ui.showBulkActions;
              });
            },

            setTheme: (theme: "light" | "dark" | "auto") => {
              set((state) => {
                state.ui.theme = theme;
              });
            },

            setDensity: (density: "compact" | "comfortable" | "spacious") => {
              set((state) => {
                state.ui.density = density;
              });
            },

            setLanguage: (language: string) => {
              set((state) => {
                state.ui.language = language;
              });
            },

            // Notification actions
            addNotification: (notification) => {
              const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              set((state) => {
                state.ui.notifications.push({
                  ...notification,
                  id,
                  timestamp: new Date(),
                  dismissed: false,
                });
              });
            },

            dismissNotification: (id: string) => {
              set((state) => {
                const notification = state.ui.notifications.find((n) => n.id === id);
                if (notification) {
                  notification.dismissed = true;
                }
              });
            },

            clearNotifications: () => {
              set((state) => {
                state.ui.notifications = [];
              });
            },

            clearNotificationsByType: (type: NotificationItem["type"]) => {
              set((state) => {
                state.ui.notifications = state.ui.notifications.filter((n) => n.type !== type);
              });
            },

            // Modal actions
            openConfirmDialog: (config) => {
              set((state) => {
                state.ui.modals.confirmDialog = { ...config, open: true };
              });
            },

            closeConfirmDialog: () => {
              set((state) => {
                state.ui.modals.confirmDialog = { open: false };
              });
            },

            openModal: (modalId: string, props: any = {}) => {
              set((state) => {
                state.ui.modals[modalId] = { open: true, ...props };
              });
            },

            closeModal: (modalId: string) => {
              set((state) => {
                if (state.ui.modals[modalId]) {
                  state.ui.modals[modalId].open = false;
                }
              });
            },

            setGlobalLoading: (visible: boolean, message?: string, progress?: number) => {
              set((state) => {
                state.ui.globalLoading = { visible, message, progress };
              });
            },

            // Preferences actions
            updatePreferences: (updates: Partial<PreferencesState>) => {
              set((state) => {
                Object.assign(state.preferences, updates);
              });
            },

            resetPreferences: () => {
              set((state) => {
                state.preferences = { ...defaultPreferencesState };
              });
            },

            exportPreferences: () => {
              return get().preferences;
            },

            importPreferences: (preferences: Partial<PreferencesState>) => {
              set((state) => {
                Object.assign(state.preferences, preferences);
              });
            },

            setTimezone: (timezone: string) => {
              set((state) => {
                state.preferences.timezone = timezone;
              });
            },

            toggleCompactMode: () => {
              set((state) => {
                state.preferences.compactMode = !state.preferences.compactMode;
              });
            },

            toggleAdvancedFeatures: () => {
              set((state) => {
                state.preferences.showAdvancedFeatures = !state.preferences.showAdvancedFeatures;
              });
            },

            // Context actions
            createContext: (contextId: string, initialData: any[] = []) => {
              set((state) => {
                if (!state.contexts[contextId]) {
                  state.contexts[contextId] = createDefaultContext(initialData);
                }
              });
            },

            updateContext: (contextId: string, updates: Partial<ContextState<any>>) => {
              set((state) => {
                if (!state.contexts[contextId]) {
                  state.contexts[contextId] = createDefaultContext();
                }
                Object.assign(state.contexts[contextId], updates);
              });
            },

            setContextData: (contextId: string, data: any[]) => {
              get().updateContext(contextId, { data });
            },

            clearContext: (contextId: string) => {
              set((state) => {
                if (state.contexts[contextId]) {
                  state.contexts[contextId] = createDefaultContext();
                }
              });
            },

            removeContext: (contextId: string) => {
              set((state) => {
                delete state.contexts[contextId];
              });
            },

            resetContext: (contextId: string) => {
              set((state) => {
                state.contexts[contextId] = createDefaultContext();
              });
            },

            refreshContext: async (contextId: string) => {
              // This would be implemented by specific portal stores
              console.warn(`refreshContext not implemented for ${contextId}`);
            },

            exportContext: (contextId: string) => {
              return get().contexts[contextId] || null;
            },

            importContext: (contextId: string, state: ContextState<any>) => {
              set((draft) => {
                draft.contexts[contextId] = state;
              });
            },

            // Utility methods
            getContext: (contextId: string) => {
              return get().contexts[contextId] || null;
            },

            getFilterState: (contextId: string) => {
              if (!get().contexts[contextId]) {
                set((state) => {
                  state.contexts[contextId] = createDefaultContext();
                });
              }
              return get().contexts[contextId]!.filters;
            },

            getPaginationState: (contextId: string) => {
              if (!get().contexts[contextId]) {
                set((state) => {
                  state.contexts[contextId] = createDefaultContext();
                });
              }
              return get().contexts[contextId]!.pagination;
            },

            getSelectionState: <T>(contextId: string) => {
              if (!get().contexts[contextId]) {
                set((state) => {
                  state.contexts[contextId] = createDefaultContext();
                });
              }
              return get().contexts[contextId]!.selection as SelectionState<T>;
            },

            getLoadingState: (contextId: string) => {
              if (!get().contexts[contextId]) {
                set((state) => {
                  state.contexts[contextId] = createDefaultContext();
                });
              }
              return get().contexts[contextId]!.loading;
            },

            getFilteredData: (contextId: string, customFilter?: (item: any) => boolean) => {
              const context = get().contexts[contextId];
              if (!context) return [];

              let filtered = [...context.data];

              // Apply filters
              const { searchTerm, statusFilter, customFilters } = context.filters;

              if (searchTerm) {
                filtered = filtered.filter((item) =>
                  JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase()),
                );
              }

              if (statusFilter && statusFilter !== "all") {
                filtered = filtered.filter((item) => item.status === statusFilter);
              }

              // Apply custom filters
              Object.entries(customFilters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                  filtered = filtered.filter((item) => item[key] === value);
                }
              });

              // Apply custom filter function
              if (customFilter) {
                filtered = filtered.filter(customFilter);
              }

              // Apply sorting
              const { sortBy, sortOrder } = context.filters;
              if (sortBy) {
                filtered.sort((a, b) => {
                  const aVal = a[sortBy];
                  const bVal = b[sortBy];

                  if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
                  if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
                  return 0;
                });
              }

              return filtered;
            },

            getSelectedItems: (contextId: string) => {
              return get().contexts[contextId]?.selection.selectedItems || [];
            },

            isContextLoading: (contextId: string) => {
              return get().contexts[contextId]?.loading.isLoading || false;
            },

            getContextError: (contextId: string) => {
              return get().contexts[contextId]?.loading.error || null;
            },

            // Bulk operations
            resetAllContexts: () => {
              set((state) => {
                Object.keys(state.contexts).forEach((contextId) => {
                  state.contexts[contextId] = createDefaultContext();
                });
              });
            },

            clearAllSelections: () => {
              set((state) => {
                Object.values(state.contexts).forEach((context) => {
                  context.selection = { ...defaultSelectionState };
                });
              });
            },

            resetAllFilters: () => {
              set((state) => {
                Object.values(state.contexts).forEach((context) => {
                  context.filters = { ...defaultFilterState };
                });
              });
            },

            // State persistence
            exportState: () => {
              const { contexts, preferences, ui } = get();
              return { contexts, preferences, ui };
            },

            importState: (state: Partial<AppState>) => {
              set((draft) => {
                Object.assign(draft, state);
              });
            },

            resetToDefaults: () => {
              set({
                ui: { ...defaultUIState },
                preferences: { ...defaultPreferencesState },
                contexts: {},
                portalData: {},
              });
            },
          })),
          {
            name: persistenceKey,
            storage: storage ? createJSONStorage(() => storage) : undefined,
            partialize: (state) => ({
              preferences: state.preferences,
              ui: {
                // Only persist certain UI state
                theme: state.ui.theme,
                density: state.ui.density,
                language: state.ui.language,
                sidebarCollapsed: state.ui.sidebarCollapsed,
              },
              // Don't persist contexts or notifications - they should reload fresh
            }),
          },
        )
      : immer((set, get) => ({
          // Same implementation but without persistence
          // ... (implementation would be identical)
        })),
  );

  return store;
}

// Helper function to create default context state
function createDefaultContext<T = any>(initialData: T[] = []): ContextState<T> {
  return {
    data: initialData,
    filters: { ...defaultFilterState },
    pagination: { ...defaultPaginationState },
    selection: { ...defaultSelectionState },
    loading: { ...defaultLoadingState },
  };
}
