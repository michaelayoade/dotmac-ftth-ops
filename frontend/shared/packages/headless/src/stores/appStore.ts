import { create } from "zustand";
import * as createAppStoreModule from "./createAppStore";
import type { AppStore } from "./types";

const mockedUseAppStore = (createAppStoreModule as any).useAppStore;
const createAppStore =
  (createAppStoreModule as any).createAppStore || (createAppStoreModule as any).default;

const createFallbackStore = () => {
  const noop = () => {};
  return create<AppStore>(() => ({
    ui: {
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
      modals: { confirmDialog: { open: false } },
      globalLoading: { visible: false },
    },
    preferences: {
      dataRefreshInterval: 30000,
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
    },
    contexts: {},
    portalData: {},
    updateFilters: noop,
    resetFilters: noop,
    setSearchTerm: noop,
    setStatusFilter: noop,
    setSorting: noop,
    setDateRange: noop,
    setCustomFilter: noop,
    toggleAdvancedFilters: noop,
    updatePagination: noop,
    setCurrentPage: noop,
    setItemsPerPage: noop,
    setTotalItems: noop,
    updateSelection: noop,
    selectItem: noop,
    deselectItem: noop,
    toggleSelectAll: noop,
    clearSelection: noop,
    updateLoading: noop,
    setOperationId: noop,
    setError: noop,
    clearError: noop,
    addAuditLog: noop,
    clearAuditLogs: noop,
    updateUI: noop,
    toggleSidebar: noop,
    setActiveTab: noop,
    setActiveView: noop,
    toggleFilters: noop,
    addNotification: noop,
    dismissNotification: noop,
    clearNotifications: noop,
    setPreference: noop,
    resetPreferences: noop,
    setContextData: noop,
    clearContext: noop,
    setPortalData: noop,
    clearPortalData: noop,
    getFilterState: () => ({
      searchTerm: "",
      statusFilter: "all",
      sortBy: "name",
      sortOrder: "asc",
      dateRange: { start: null, end: null },
      customFilters: {},
      showAdvanced: false,
    }),
    getPaginationState: () => ({
      currentPage: 1,
      itemsPerPage: 25,
      totalItems: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    }),
    getSelectionState: () => ({
      selectedItems: [],
      lastSelected: null,
      selectAll: false,
      isMultiSelect: true,
    }),
    getLoadingState: () => ({
      isLoading: false,
      error: null,
      lastUpdated: null,
      operationId: null,
    }),
  }));
};

export const useAppStore = mockedUseAppStore
  ? mockedUseAppStore
  : createAppStore
    ? createAppStore({
        portalType: "headless",
        secureStorage: true,
      })
    : createFallbackStore();

export type {
  AppStore,
  FilterState,
  PaginationState,
  SelectionState,
  LoadingState,
  UIState,
  PreferencesState,
  ContextState,
  NotificationItem,
} from "./types";
