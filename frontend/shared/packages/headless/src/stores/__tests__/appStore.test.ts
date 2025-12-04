/**
 * App Store Tests
 * Comprehensive tests for the consolidated application state management
 */

import { renderHook, act } from "@testing-library/react";
import { useAppStore } from "../appStore";

describe("useAppStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.resetAllContexts();
      result.current.clearNotifications();
    });
  });

  describe("UI State Management", () => {
    it("should manage sidebar state", () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.ui.sidebarOpen).toBe(true); // Default

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.ui.sidebarOpen).toBe(false);
    });

    it("should manage active tab and view", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setActiveTab("customers");
        result.current.setActiveView("grid");
      });

      expect(result.current.ui.activeTab).toBe("customers");
      expect(result.current.ui.activeView).toBe("grid");
    });

    it("should toggle filter visibility", () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.ui.showFilters).toBe(false);

      act(() => {
        result.current.toggleFilters();
      });

      expect(result.current.ui.showFilters).toBe(true);
    });
  });

  describe("Notification Management", () => {
    it("should add and dismiss notifications", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({
          type: "success",
          message: "Operation successful",
        });
      });

      const notifications = result.current.ui.notifications.filter((n) => !n.dismissed);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("success");
      expect(notifications[0].message).toBe("Operation successful");
      expect(notifications[0].id).toBeDefined();
      expect(notifications[0].timestamp).toBeInstanceOf(Date);

      act(() => {
        result.current.dismissNotification(notifications[0].id);
      });

      const activeNotifications = result.current.ui.notifications.filter((n) => !n.dismissed);
      expect(activeNotifications).toHaveLength(0);
    });

    it("should clear all notifications", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ type: "success", message: "Test 1" });
        result.current.addNotification({ type: "error", message: "Test 2" });
      });

      expect(result.current.ui.notifications).toHaveLength(2);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.ui.notifications).toHaveLength(0);
    });
  });

  describe("Filter State Management", () => {
    const context = "test-filters";

    it("should manage filter state for context", () => {
      const { result } = renderHook(() => useAppStore());

      const initialFilters = result.current.getFilterState(context);
      expect(initialFilters.searchTerm).toBe("");
      expect(initialFilters.statusFilter).toBe("all");
      expect(initialFilters.sortBy).toBe("name");
      expect(initialFilters.sortOrder).toBe("asc");

      act(() => {
        result.current.updateFilters(context, {
          searchTerm: "test search",
          statusFilter: "active",
          sortBy: "date",
          sortOrder: "desc",
        });
      });

      const updatedFilters = result.current.getFilterState(context);
      expect(updatedFilters.searchTerm).toBe("test search");
      expect(updatedFilters.statusFilter).toBe("active");
      expect(updatedFilters.sortBy).toBe("date");
      expect(updatedFilters.sortOrder).toBe("desc");
    });

    it("should provide convenient filter methods", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setSearchTerm(context, "search term");
        result.current.setStatusFilter(context, "pending");
        result.current.setSorting(context, "name", "desc");
      });

      const filters = result.current.getFilterState(context);
      expect(filters.searchTerm).toBe("search term");
      expect(filters.statusFilter).toBe("pending");
      expect(filters.sortBy).toBe("name");
      expect(filters.sortOrder).toBe("desc");
    });

    it("should manage date range filters", () => {
      const { result } = renderHook(() => useAppStore());

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      act(() => {
        result.current.setDateRange(context, startDate, endDate);
      });

      const filters = result.current.getFilterState(context);
      expect(filters.dateRange?.start).toEqual(startDate);
      expect(filters.dateRange?.end).toEqual(endDate);
    });

    it("should reset filters to default state", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updateFilters(context, {
          searchTerm: "test",
          statusFilter: "active",
          customFilters: { region: "north" },
        });
      });

      let filters = result.current.getFilterState(context);
      expect(filters.searchTerm).toBe("test");
      expect(filters.statusFilter).toBe("active");

      act(() => {
        result.current.resetFilters(context);
      });

      filters = result.current.getFilterState(context);
      expect(filters.searchTerm).toBe("");
      expect(filters.statusFilter).toBe("all");
      expect(filters.customFilters).toEqual({});
    });
  });

  describe("Pagination State Management", () => {
    const context = "test-pagination";

    it("should manage pagination state", () => {
      const { result } = renderHook(() => useAppStore());

      const initialPagination = result.current.getPaginationState(context);
      expect(initialPagination.currentPage).toBe(1);
      expect(initialPagination.itemsPerPage).toBe(25);
      expect(initialPagination.totalItems).toBe(0);
      expect(initialPagination.totalPages).toBe(0);

      act(() => {
        result.current.setTotalItems(context, 100);
      });

      let pagination = result.current.getPaginationState(context);
      expect(pagination.totalItems).toBe(100);
      expect(pagination.totalPages).toBe(4); // 100 / 25 = 4

      act(() => {
        result.current.setCurrentPage(context, 2);
        result.current.setItemsPerPage(context, 50);
      });

      pagination = result.current.getPaginationState(context);
      expect(pagination.currentPage).toBe(1); // Reset to 1 when changing items per page
      expect(pagination.itemsPerPage).toBe(50);
      expect(pagination.totalPages).toBe(2); // 100 / 50 = 2
    });

    it("should calculate total pages correctly", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updatePagination(context, {
          totalItems: 105,
          itemsPerPage: 25,
        });
      });

      const pagination = result.current.getPaginationState(context);
      expect(pagination.totalPages).toBe(5); // Math.ceil(105 / 25) = 5
    });
  });

  describe("Selection State Management", () => {
    const context = "test-selection";
    const items = ["item1", "item2", "item3", "item4"];

    it("should manage single item selection", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectItem(context, "item1");
      });

      let selection = result.current.getSelectionState(context);
      expect(selection.selectedItems).toEqual(["item1"]);
      expect(selection.lastSelected).toBe("item1");

      // Select different item (replace previous)
      act(() => {
        result.current.selectItem(context, "item2", false);
      });

      selection = result.current.getSelectionState(context);
      expect(selection.selectedItems).toEqual(["item2"]);
      expect(selection.lastSelected).toBe("item2");
    });

    it("should manage multiple item selection", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectItem(context, "item1", true);
        result.current.selectItem(context, "item2", true);
      });

      const selection = result.current.getSelectionState(context);
      expect(selection.selectedItems).toEqual(["item1", "item2"]);
    });

    it("should toggle selection", () => {
      const { result } = renderHook(() => useAppStore());

      // Select item
      act(() => {
        result.current.selectItem(context, "item1");
      });

      expect(result.current.getSelectionState(context).selectedItems).toEqual(["item1"]);

      // Toggle (deselect)
      act(() => {
        result.current.selectItem(context, "item1");
      });

      expect(result.current.getSelectionState(context).selectedItems).toEqual([]);
    });

    it("should handle select all functionality", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.toggleSelectAll(context, items);
      });

      let selection = result.current.getSelectionState(context);
      expect(selection.selectedItems).toEqual(items);
      expect(selection.selectAll).toBe(true);

      // Toggle again to deselect all
      act(() => {
        result.current.toggleSelectAll(context, items);
      });

      selection = result.current.getSelectionState(context);
      expect(selection.selectedItems).toEqual([]);
      expect(selection.selectAll).toBe(false);
    });

    it("should deselect individual items", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectItem(context, "item1", true);
        result.current.selectItem(context, "item2", true);
        result.current.selectItem(context, "item3", true);
      });

      expect(result.current.getSelectionState(context).selectedItems).toHaveLength(3);

      act(() => {
        result.current.deselectItem(context, "item2");
      });

      const selection = result.current.getSelectionState(context);
      expect(selection.selectedItems).toEqual(["item1", "item3"]);
      expect(selection.selectAll).toBe(false);
    });

    it("should clear all selections", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectItem(context, "item1", true);
        result.current.selectItem(context, "item2", true);
      });

      expect(result.current.getSelectionState(context).selectedItems).toHaveLength(2);

      act(() => {
        result.current.clearSelection(context);
      });

      const selection = result.current.getSelectionState(context);
      expect(selection.selectedItems).toEqual([]);
      expect(selection.lastSelected).toBeNull();
      expect(selection.selectAll).toBe(false);
    });
  });

  describe("Loading State Management", () => {
    const context = "test-loading";

    it("should manage loading state", () => {
      const { result } = renderHook(() => useAppStore());

      const initialLoading = result.current.getLoadingState(context);
      expect(initialLoading.isLoading).toBe(false);
      expect(initialLoading.error).toBeNull();
      expect(initialLoading.lastUpdated).toBeNull();

      act(() => {
        result.current.setLoading(context, true, "operation-123");
      });

      let loading = result.current.getLoadingState(context);
      expect(loading.isLoading).toBe(true);
      expect(loading.operationId).toBe("operation-123");
      expect(loading.error).toBeNull(); // Should clear error when starting loading

      act(() => {
        result.current.setLoading(context, false);
        result.current.setLastUpdated(context);
      });

      loading = result.current.getLoadingState(context);
      expect(loading.isLoading).toBe(false);
      expect(loading.lastUpdated).toBeInstanceOf(Date);
    });

    it("should manage error state", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setError(context, "Something went wrong");
      });

      const loading = result.current.getLoadingState(context);
      expect(loading.error).toBe("Something went wrong");
      expect(loading.isLoading).toBe(false); // Should stop loading on error
    });
  });

  describe("Preferences Management", () => {
    it("should manage user preferences", () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.preferences.theme).toBe("light");
      expect(result.current.preferences.compactMode).toBe(false);
      expect(result.current.preferences.showAdvancedFeatures).toBe(false);

      act(() => {
        result.current.setTheme("dark");
        result.current.toggleCompactMode();
        result.current.toggleAdvancedFeatures();
      });

      expect(result.current.preferences.theme).toBe("dark");
      expect(result.current.preferences.compactMode).toBe(true);
      expect(result.current.preferences.showAdvancedFeatures).toBe(true);
    });

    it("should update multiple preferences at once", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updatePreferences({
          language: "es",
          timezone: "America/New_York",
          dataRefreshInterval: 60000,
        });
      });

      expect(result.current.preferences.language).toBe("es");
      expect(result.current.preferences.timezone).toBe("America/New_York");
      expect(result.current.preferences.dataRefreshInterval).toBe(60000);
    });
  });

  describe("Context Management", () => {
    it("should reset individual context", () => {
      const { result } = renderHook(() => useAppStore());
      const context = "test-context";

      // Set up state in the context
      act(() => {
        result.current.updateFilters(context, { searchTerm: "test" });
        result.current.setCurrentPage(context, 3);
        result.current.selectItem(context, "item1");
        result.current.setLoading(context, true);
      });

      // Verify state is set
      expect(result.current.getFilterState(context).searchTerm).toBe("test");
      expect(result.current.getPaginationState(context).currentPage).toBe(3);
      expect(result.current.getSelectionState(context).selectedItems).toHaveLength(1);
      expect(result.current.getLoadingState(context).isLoading).toBe(true);

      // Reset context
      act(() => {
        result.current.resetContext(context);
      });

      // Verify state is reset to defaults
      expect(result.current.getFilterState(context).searchTerm).toBe("");
      expect(result.current.getPaginationState(context).currentPage).toBe(1);
      expect(result.current.getSelectionState(context).selectedItems).toHaveLength(0);
      expect(result.current.getLoadingState(context).isLoading).toBe(false);
    });

    it("should reset all contexts", () => {
      const { result } = renderHook(() => useAppStore());
      const context1 = "test-context-1";
      const context2 = "test-context-2";

      // Set up state in multiple contexts
      act(() => {
        result.current.updateFilters(context1, { searchTerm: "test1" });
        result.current.updateFilters(context2, { searchTerm: "test2" });
      });

      expect(result.current.getFilterState(context1).searchTerm).toBe("test1");
      expect(result.current.getFilterState(context2).searchTerm).toBe("test2");

      // Reset all contexts
      act(() => {
        result.current.resetAllContexts();
      });

      expect(result.current.getFilterState(context1).searchTerm).toBe("");
      expect(result.current.getFilterState(context2).searchTerm).toBe("");
    });
  });

  describe("State Isolation", () => {
    it("should maintain separate state for different contexts", () => {
      const { result } = renderHook(() => useAppStore());
      const context1 = "customers";
      const context2 = "invoices";

      act(() => {
        result.current.setSearchTerm(context1, "customer search");
        result.current.setSearchTerm(context2, "invoice search");
        result.current.setCurrentPage(context1, 5);
        result.current.setCurrentPage(context2, 10);
      });

      expect(result.current.getFilterState(context1).searchTerm).toBe("customer search");
      expect(result.current.getFilterState(context2).searchTerm).toBe("invoice search");
      expect(result.current.getPaginationState(context1).currentPage).toBe(5);
      expect(result.current.getPaginationState(context2).currentPage).toBe(10);
    });
  });
});
