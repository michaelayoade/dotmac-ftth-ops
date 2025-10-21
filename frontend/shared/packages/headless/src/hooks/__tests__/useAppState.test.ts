/**
 * App State Hooks Tests
 * Tests for convenience hooks that use the consolidated app store
 */

import { renderHook, act } from "@testing-library/react";
import {
  useUI,
  useNotifications,
  useFilters,
  usePagination,
  useSelection,
  useLoading,
  usePreferences,
  useDataTable,
  useFormState,
} from "../useAppState";
import { useAppStore } from "@dotmac/headless/stores";

describe("useAppState Hooks", () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.resetAllContexts();
      result.current.clearNotifications();
      result.current.updateUI({
        sidebarOpen: true,
        activeTab: "",
        activeView: "list",
        showFilters: false,
        showBulkActions: false,
        notifications: [],
      });
    });
  });

  afterEach(() => {
    // Clean up after each test
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.resetAllContexts();
      result.current.clearNotifications();
    });
  });

  describe("useUI", () => {
    it("should provide UI state and actions", () => {
      const { result } = renderHook(() => useUI());

      expect(result.current.sidebarOpen).toBe(true);
      expect(result.current.activeView).toBe("list");
      expect(result.current.showFilters).toBe(false);

      act(() => {
        result.current.toggleSidebar();
        result.current.setActiveView("grid");
        result.current.toggleFilters();
      });

      expect(result.current.sidebarOpen).toBe(false);
      expect(result.current.activeView).toBe("grid");
      expect(result.current.showFilters).toBe(true);
    });
  });

  describe("useNotifications", () => {
    it("should provide notification management", () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.notifications).toHaveLength(0);

      act(() => {
        result.current.addSuccess("Success message");
        result.current.addError("Error message");
        result.current.addWarning("Warning message");
        result.current.addInfo("Info message");
      });

      expect(result.current.notifications).toHaveLength(4);
      expect(result.current.notifications[0].type).toBe("success");
      expect(result.current.notifications[1].type).toBe("error");
      expect(result.current.notifications[2].type).toBe("warning");
      expect(result.current.notifications[3].type).toBe("info");

      act(() => {
        result.current.dismissNotification(result.current.notifications[0].id);
      });

      expect(result.current.notifications).toHaveLength(3);
    });

    it("should filter out dismissed notifications", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.addSuccess("Test notification");
      });

      const notificationId = result.current.notifications[0].id;

      act(() => {
        result.current.dismissNotification(notificationId);
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe("useFilters", () => {
    const context = "test-filters";

    it("should provide filter state and actions", () => {
      const { result } = renderHook(() => useFilters(context));

      expect(result.current.searchTerm).toBe("");
      expect(result.current.statusFilter).toBe("all");
      expect(result.current.sortBy).toBe("name");
      expect(result.current.sortOrder).toBe("asc");
      expect(result.current.hasActiveFilters).toBe(false);

      act(() => {
        result.current.setSearch("test search");
        result.current.setStatus("active");
        result.current.setSort("date", "desc");
      });

      expect(result.current.searchTerm).toBe("test search");
      expect(result.current.statusFilter).toBe("active");
      expect(result.current.sortBy).toBe("date");
      expect(result.current.sortOrder).toBe("desc");
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("should toggle sort order", () => {
      const { result } = renderHook(() => useFilters(context));

      act(() => {
        result.current.toggleSort("name");
      });

      expect(result.current.sortBy).toBe("name");
      expect(result.current.sortOrder).toBe("desc"); // Toggled from default 'asc'

      act(() => {
        result.current.toggleSort("name");
      });

      expect(result.current.sortOrder).toBe("asc"); // Toggled back
    });

    it("should manage date range", () => {
      const { result } = renderHook(() => useFilters(context));

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      act(() => {
        result.current.setRange(startDate, endDate);
      });

      expect(result.current.dateRange?.start).toEqual(startDate);
      expect(result.current.dateRange?.end).toEqual(endDate);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("should detect active filters correctly", () => {
      const { result } = renderHook(() => useFilters(context));

      expect(result.current.hasActiveFilters).toBe(false);

      act(() => {
        result.current.setSearch("test");
      });

      expect(result.current.hasActiveFilters).toBe(true);

      act(() => {
        result.current.resetFilter();
      });

      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe("usePagination", () => {
    const context = "test-pagination";

    it("should provide pagination state and actions", () => {
      const { result } = renderHook(() => usePagination(context));

      expect(result.current.currentPage).toBe(1);
      expect(result.current.itemsPerPage).toBe(25);
      expect(result.current.totalItems).toBe(0);
      expect(result.current.totalPages).toBe(0);
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoPrevious).toBe(false);

      act(() => {
        result.current.setTotal(100);
      });

      expect(result.current.totalItems).toBe(100);
      expect(result.current.totalPages).toBe(4);
      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(false);
    });

    it("should provide navigation methods", () => {
      const { result } = renderHook(() => usePagination(context));

      act(() => {
        result.current.setTotal(100);
        result.current.goToPage(3);
      });

      expect(result.current.currentPage).toBe(3);
      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(4);
      expect(result.current.canGoNext).toBe(false);

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.currentPage).toBe(3);

      act(() => {
        result.current.firstPage();
      });

      expect(result.current.currentPage).toBe(1);

      act(() => {
        result.current.lastPage();
      });

      expect(result.current.currentPage).toBe(4);
    });

    it("should calculate item ranges correctly", () => {
      const { result } = renderHook(() => usePagination(context));

      act(() => {
        result.current.setTotal(100);
        result.current.goToPage(2);
      });

      expect(result.current.startItem).toBe(26); // (2-1) * 25 + 1
      expect(result.current.endItem).toBe(50); // 2 * 25

      act(() => {
        result.current.goToPage(4); // Last page
      });

      expect(result.current.startItem).toBe(76); // (4-1) * 25 + 1
      expect(result.current.endItem).toBe(100); // Math.min(4 * 25, 100)
    });

    it("should reset to first page when changing items per page", () => {
      const { result } = renderHook(() => usePagination(context));

      act(() => {
        result.current.setTotal(100);
        result.current.goToPage(3);
      });

      expect(result.current.currentPage).toBe(3);

      act(() => {
        result.current.changeItemsPerPage(50);
      });

      expect(result.current.currentPage).toBe(1);
      expect(result.current.itemsPerPage).toBe(50);
      expect(result.current.totalPages).toBe(2);
    });
  });

  describe("useSelection", () => {
    const context = "test-selection";
    interface TestItem {
      id: string;
      name: string;
    }
    const items: TestItem[] = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
      { id: "3", name: "Item 3" },
    ];

    it("should provide selection state and actions", () => {
      const { result } = renderHook(() => useSelection<TestItem>(context));

      expect(result.current.selectedItems).toHaveLength(0);
      expect(result.current.hasSelection).toBe(false);
      expect(result.current.selectedCount).toBe(0);

      act(() => {
        result.current.select(items[0], true);
        result.current.select(items[1], true);
      });

      expect(result.current.selectedItems).toHaveLength(2);
      expect(result.current.hasSelection).toBe(true);
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.isSelected(items[0])).toBe(true);
      expect(result.current.isSelected(items[2])).toBe(false);
    });

    it("should handle item toggling", () => {
      const { result } = renderHook(() => useSelection<TestItem>(context));

      act(() => {
        result.current.toggleItem(items[0], true);
      });

      expect(result.current.isSelected(items[0])).toBe(true);

      act(() => {
        result.current.toggleItem(items[0], true);
      });

      expect(result.current.isSelected(items[0])).toBe(false);
    });

    it("should handle select all functionality", () => {
      const { result } = renderHook(() => useSelection<TestItem>(context));

      act(() => {
        result.current.toggleAll(items);
      });

      expect(result.current.selectedItems).toHaveLength(3);
      expect(result.current.selectAll).toBe(true);

      act(() => {
        result.current.toggleAll(items); // Toggle off
      });

      expect(result.current.selectedItems).toHaveLength(0);
      expect(result.current.selectAll).toBe(false);
    });
  });

  describe("useLoading", () => {
    const context = "test-loading";

    it("should provide loading state and actions", () => {
      const { result } = renderHook(() => useLoading(context));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastUpdated).toBeNull();

      act(() => {
        result.current.startLoading("operation-123");
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.operationId).toBe("operation-123");

      act(() => {
        result.current.stopLoading();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });

    it("should handle error state", () => {
      const { result } = renderHook(() => useLoading(context));

      act(() => {
        result.current.setError("Something went wrong");
      });

      expect(result.current.error).toBe("Something went wrong");
      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("usePreferences", () => {
    it("should provide preferences state and actions", () => {
      const { result } = renderHook(() => usePreferences());

      expect(result.current.theme).toBe("light");
      expect(result.current.compactMode).toBe(false);

      act(() => {
        result.current.setTheme("dark");
        result.current.toggleCompactMode();
      });

      expect(result.current.theme).toBe("dark");
      expect(result.current.compactMode).toBe(true);
    });
  });

  describe("useDataTable", () => {
    const context = "test-data-table";

    it("should provide combined data table functionality", () => {
      const { result } = renderHook(() => useDataTable(context));

      expect(result.current.filters).toBeDefined();
      expect(result.current.pagination).toBeDefined();
      expect(result.current.selection).toBeDefined();
      expect(result.current.loading).toBeDefined();
      expect(result.current.reset).toBeDefined();

      // Test that all sub-hooks are working
      act(() => {
        result.current.filters.setSearch("test");
        result.current.pagination.setTotal(100);
        result.current.selection.select("item1", true);
        result.current.loading.startLoading();
      });

      expect(result.current.filters.searchTerm).toBe("test");
      expect(result.current.pagination.totalItems).toBe(100);
      expect(result.current.selection.selectedItems).toContain("item1");
      expect(result.current.loading.isLoading).toBe(true);
    });

    it("should reset all context state", () => {
      const { result } = renderHook(() => useDataTable(context));

      // Set up some state
      act(() => {
        result.current.filters.setSearch("test");
        result.current.pagination.goToPage(3);
        result.current.selection.select("item1", true);
      });

      // Verify state is set
      expect(result.current.filters.searchTerm).toBe("test");
      expect(result.current.pagination.currentPage).toBe(3);
      expect(result.current.selection.selectedItems).toContain("item1");

      // Reset context
      act(() => {
        result.current.reset();
      });

      // Verify state is reset
      expect(result.current.filters.searchTerm).toBe("");
      expect(result.current.pagination.currentPage).toBe(1);
      expect(result.current.selection.selectedItems).toHaveLength(0);
    });
  });

  describe("useFormState", () => {
    const context = "test-form";

    it("should provide form state management", () => {
      const { result } = renderHook(() => useFormState(context));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.handleSubmit).toBeDefined();
    });

    it("should handle successful form submission", async () => {
      const { result } = renderHook(() => useFormState(context));
      const mockSubmit = jest.fn().mockResolvedValue(undefined);

      await act(async () => {
        await result.current.handleSubmit(mockSubmit, {
          successMessage: "Form submitted successfully",
        });
      });

      expect(mockSubmit).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle failed form submission", async () => {
      const { result } = renderHook(() => useFormState(context));
      const mockSubmit = jest.fn().mockRejectedValue(new Error("Submission failed"));

      await act(async () => {
        await result.current.handleSubmit(mockSubmit);
      });

      expect(mockSubmit).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Submission failed");
    });
  });

  describe("Hook State Isolation", () => {
    it("should maintain separate state for different contexts", () => {
      const { result: filters1 } = renderHook(() => useFilters("context1"));
      const { result: filters2 } = renderHook(() => useFilters("context2"));

      act(() => {
        filters1.current.setSearch("search1");
        filters2.current.setSearch("search2");
      });

      expect(filters1.current.searchTerm).toBe("search1");
      expect(filters2.current.searchTerm).toBe("search2");
    });
  });
});
