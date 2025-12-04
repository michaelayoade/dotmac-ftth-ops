/**
 * Shared State Management Types
 * Common patterns used across all portal applications
 */

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
  showAdvanced: boolean;
}

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SelectionState<T = any> {
  selectedItems: T[];
  lastSelected: T | null;
  selectAll: boolean;
  isMultiSelect: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  operationId: string | null;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

export interface NotificationItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
  dismissed: boolean;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: "primary" | "secondary";
  }>;
}

export interface UIState {
  // Layout
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  activeTab: string;
  activeView: string;
  showFilters: boolean;
  showBulkActions: boolean;

  // Theme and display
  theme: "light" | "dark" | "auto";
  density: "compact" | "comfortable" | "spacious";
  language: string;

  // Notifications
  notifications: NotificationItem[];

  // Modal and dialog state
  modals: {
    confirmDialog: {
      open: boolean;
      title?: string;
      message?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
      variant?: "danger" | "warning" | "info";
    };
    [key: string]: any; // Allow custom modals
  };

  // Global loading overlay
  globalLoading: {
    visible: boolean;
    message?: string;
    progress?: number;
  };
}

export interface PreferencesState {
  dataRefreshInterval: number;
  autoSave: boolean;
  compactMode: boolean;
  showAdvancedFeatures: boolean;
  tablePageSize: number;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
  keyboardShortcuts: boolean;
}

// Context-based state management
export interface ContextState<T = any> {
  data: T[];
  filters: FilterState;
  pagination: PaginationState;
  selection: SelectionState<T>;
  loading: LoadingState;
  lastFetch?: Date;
  cacheKey?: string;
}

// App-wide state structure
export interface AppState {
  ui: UIState;
  preferences: PreferencesState;
  contexts: Record<string, ContextState<any>>;

  // Portal-specific state can extend this
  portalData?: Record<string, any>;
}

// Action types for state updates
export interface FilterActions {
  updateFilters: (context: string, updates: Partial<FilterState>) => void;
  resetFilters: (context: string) => void;
  setSearchTerm: (context: string, term: string) => void;
  setStatusFilter: (context: string, status: string) => void;
  setSorting: (context: string, sortBy: string, sortOrder?: "asc" | "desc") => void;
  setDateRange: (context: string, start: Date | null, end: Date | null) => void;
  setCustomFilter: (context: string, key: string, value: any) => void;
  toggleAdvancedFilters: (context: string) => void;
}

export interface PaginationActions {
  updatePagination: (context: string, updates: Partial<PaginationState>) => void;
  setCurrentPage: (context: string, page: number) => void;
  setItemsPerPage: (context: string, itemsPerPage: number) => void;
  setTotalItems: (context: string, totalItems: number) => void;
  goToFirstPage: (context: string) => void;
  goToLastPage: (context: string) => void;
  goToNextPage: (context: string) => void;
  goToPrevPage: (context: string) => void;
}

export interface SelectionActions {
  updateSelection: <T>(context: string, updates: Partial<SelectionState<T>>) => void;
  selectItem: <T>(context: string, item: T, multiple?: boolean) => void;
  deselectItem: <T>(context: string, item: T) => void;
  toggleSelectAll: <T>(context: string, allItems: T[]) => void;
  clearSelection: (context: string) => void;
  selectRange: <T>(context: string, startItem: T, endItem: T, allItems: T[]) => void;
}

export interface LoadingActions {
  updateLoading: (context: string, updates: Partial<LoadingState>) => void;
  setLoading: (context: string, isLoading: boolean, operationId?: string) => void;
  setError: (context: string, error: string | null) => void;
  setLastUpdated: (context: string, timestamp?: Date) => void;
  setProgress: (context: string, current: number, total: number, message?: string) => void;
  clearProgress: (context: string) => void;
}

export interface UIActions {
  // Layout actions
  updateUI: (updates: Partial<UIState>) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveTab: (tab: string) => void;
  setActiveView: (view: string) => void;
  toggleFilters: (context?: string) => void;
  toggleBulkActions: (context?: string) => void;

  // Theme and display
  setTheme: (theme: "light" | "dark" | "auto") => void;
  setDensity: (density: "compact" | "comfortable" | "spacious") => void;
  setLanguage: (language: string) => void;

  // Notifications
  addNotification: (notification: Omit<NotificationItem, "id" | "timestamp" | "dismissed">) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  clearNotificationsByType: (type: NotificationItem["type"]) => void;

  // Modal and dialog
  openConfirmDialog: (config: Omit<UIState["modals"]["confirmDialog"], "open">) => void;
  closeConfirmDialog: () => void;
  openModal: (modalId: string, props?: any) => void;
  closeModal: (modalId: string) => void;

  // Global loading
  setGlobalLoading: (visible: boolean, message?: string, progress?: number) => void;
}

export interface PreferencesActions {
  updatePreferences: (updates: Partial<PreferencesState>) => void;
  resetPreferences: () => void;
  exportPreferences: () => PreferencesState;
  importPreferences: (preferences: Partial<PreferencesState>) => void;
  setTimezone: (timezone: string) => void;
  toggleCompactMode: () => void;
  toggleAdvancedFeatures: () => void;
}

export interface ContextActions {
  // Context management
  createContext: <T>(contextId: string, initialData?: T[]) => void;
  updateContext: <T>(contextId: string, updates: Partial<ContextState<T>>) => void;
  setContextData: <T>(contextId: string, data: T[]) => void;
  clearContext: (contextId: string) => void;
  removeContext: (contextId: string) => void;
  resetContext: (contextId: string) => void;

  // Bulk context operations
  refreshContext: (contextId: string) => Promise<void>;
  exportContext: <T>(contextId: string) => ContextState<T> | null;
  importContext: <T>(contextId: string, state: ContextState<T>) => void;
}

// Complete app store interface
export interface AppStore
  extends AppState,
    FilterActions,
    PaginationActions,
    SelectionActions,
    LoadingActions,
    UIActions,
    PreferencesActions,
    ContextActions {
  // Utility methods
  getContext: <T>(contextId: string) => ContextState<T> | null;
  getFilterState: (contextId: string) => FilterState;
  getPaginationState: (contextId: string) => PaginationState;
  getSelectionState: <T>(contextId: string) => SelectionState<T>;
  getLoadingState: (contextId: string) => LoadingState;
  getFilteredData: <T>(contextId: string, customFilter?: (item: T) => boolean) => T[];
  getSelectedItems: <T>(contextId: string) => T[];
  isContextLoading: (contextId: string) => boolean;
  getContextError: (contextId: string) => string | null;

  // Bulk operations
  resetAllContexts: () => void;
  clearAllSelections: () => void;
  resetAllFilters: () => void;

  // State persistence
  exportState: () => Partial<AppState>;
  importState: (state: Partial<AppState>) => void;
  resetToDefaults: () => void;
}

// Portal-specific extensions
export interface AdminAppStore extends AppStore {
  adminData: {
    systemHealth: any;
    userStats: any;
    securityAlerts: any[];
  };
}

export interface CustomerAppStore extends AppStore {
  customerData: {
    profile: any;
    services: any[];
    billing: any;
    usage: any;
  };
}

export interface ResellerAppStore extends AppStore {
  resellerData: {
    commissions: any;
    territories: any[];
    customers: any[];
    analytics: any;
  };
}
