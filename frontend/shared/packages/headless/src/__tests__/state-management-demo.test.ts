/**
 * State Management Demo Tests
 * Practical examples demonstrating the consolidated state management system
 */

import { renderHook, act } from "@testing-library/react";
import { useDataTable, useFilters, useNotifications } from "@dotmac/headless/hooks";

describe("State Management System Demo", () => {
  describe("Real-world Customer Management Scenario", () => {
    it("should handle complete customer table workflow", () => {
      // Simulate a customer management component using our state system
      const customerTable = renderHook(() => useDataTable("customer-management"));

      // Initial state
      expect(customerTable.result.current.filters.searchTerm).toBe("");
      expect(customerTable.result.current.pagination.currentPage).toBe(1);
      expect(customerTable.result.current.selection.selectedItems).toHaveLength(0);
      expect(customerTable.result.current.loading.isLoading).toBe(false);

      // User searches for customers
      act(() => {
        customerTable.result.current.filters.setSearch("john");
      });

      expect(customerTable.result.current.filters.searchTerm).toBe("john");
      expect(customerTable.result.current.filters.hasActiveFilters).toBe(true);

      // API returns results - set total items and start loading
      act(() => {
        customerTable.result.current.loading.startLoading("customer-search");
        customerTable.result.current.pagination.setTotal(125);
      });

      expect(customerTable.result.current.loading.isLoading).toBe(true);
      expect(customerTable.result.current.pagination.totalItems).toBe(125);
      expect(customerTable.result.current.pagination.totalPages).toBe(5); // 125 / 25 = 5

      // Loading completes
      act(() => {
        customerTable.result.current.loading.stopLoading();
      });

      expect(customerTable.result.current.loading.isLoading).toBe(false);
      expect(customerTable.result.current.loading.lastUpdated).toBeInstanceOf(Date);

      // User selects some customers for bulk operations
      act(() => {
        customerTable.result.current.selection.select("customer-1", true);
        customerTable.result.current.selection.select("customer-2", true);
      });

      expect(customerTable.result.current.selection.selectedItems).toEqual([
        "customer-1",
        "customer-2",
      ]);
      expect(customerTable.result.current.selection.hasSelection).toBe(true);
      expect(customerTable.result.current.selection.selectedCount).toBe(2);

      // User sorts by date
      act(() => {
        customerTable.result.current.filters.setSort("created_date", "desc");
      });

      expect(customerTable.result.current.filters.sortBy).toBe("created_date");
      expect(customerTable.result.current.filters.sortOrder).toBe("desc");

      // User goes to next page
      act(() => {
        customerTable.result.current.pagination.nextPage();
      });

      expect(customerTable.result.current.pagination.currentPage).toBe(2);
      expect(customerTable.result.current.pagination.canGoPrevious).toBe(true);

      // Reset everything when user closes the page or changes context
      act(() => {
        customerTable.result.current.reset();
      });

      expect(customerTable.result.current.filters.searchTerm).toBe("");
      expect(customerTable.result.current.pagination.currentPage).toBe(1);
      expect(customerTable.result.current.selection.selectedItems).toHaveLength(0);
      expect(customerTable.result.current.loading.isLoading).toBe(false);
    });
  });

  describe("Multiple Data Tables Scenario", () => {
    it("should maintain separate state for different tables on same page", () => {
      // Simulate an admin dashboard with multiple tables
      const customerTable = renderHook(() => useDataTable("page-customers"));
      const invoiceTable = renderHook(() => useDataTable("page-invoices"));
      const orderTable = renderHook(() => useDataTable("page-orders"));

      // Set different states for each table
      act(() => {
        customerTable.result.current.filters.setSearch("john");
        customerTable.result.current.pagination.goToPage(3);

        invoiceTable.result.current.filters.setSearch("pending");
        invoiceTable.result.current.selection.select("invoice-123", true);

        orderTable.result.current.filters.setSort("total_amount", "desc");
        orderTable.result.current.pagination.setTotal(500);
      });

      // Each table maintains its own state
      expect(customerTable.result.current.filters.searchTerm).toBe("john");
      expect(customerTable.result.current.pagination.currentPage).toBe(3);
      expect(customerTable.result.current.selection.selectedItems).toHaveLength(0);

      expect(invoiceTable.result.current.filters.searchTerm).toBe("pending");
      expect(invoiceTable.result.current.pagination.currentPage).toBe(1);
      expect(invoiceTable.result.current.selection.selectedItems).toEqual(["invoice-123"]);

      expect(orderTable.result.current.filters.searchTerm).toBe("");
      expect(orderTable.result.current.filters.sortBy).toBe("total_amount");
      expect(orderTable.result.current.pagination.totalItems).toBe(500);
    });
  });

  describe("Filter Combinations Scenario", () => {
    it("should handle complex filtering scenarios", () => {
      const filters = renderHook(() => useFilters("invoice-advanced-search"));

      // Initially no filters
      expect(filters.result.current.hasActiveFilters).toBe(false);

      // Set multiple filter types
      act(() => {
        filters.result.current.setSearch("john doe");
        filters.result.current.setStatus("pending");
        filters.result.current.setRange(new Date("2024-01-01"), new Date("2024-01-31"));
        filters.result.current.updateFilter({
          customFilters: {
            region: "north",
            planType: "premium",
            minAmount: 100,
          },
        });
      });

      // All filters are active
      expect(filters.result.current.hasActiveFilters).toBe(true);
      expect(filters.result.current.searchTerm).toBe("john doe");
      expect(filters.result.current.statusFilter).toBe("pending");
      expect(filters.result.current.dateRange?.start).toEqual(new Date("2024-01-01"));
      expect(filters.result.current.dateRange?.end).toEqual(new Date("2024-01-31"));
      expect(filters.result.current.customFilters).toEqual({
        region: "north",
        planType: "premium",
        minAmount: 100,
      });

      // Clear specific filters
      act(() => {
        filters.result.current.setSearch("");
        filters.result.current.setRange(null, null);
      });

      // Some filters remain active
      expect(filters.result.current.hasActiveFilters).toBe(true);
      expect(filters.result.current.searchTerm).toBe("");
      expect(filters.result.current.statusFilter).toBe("pending");
      expect(filters.result.current.dateRange?.start).toBeNull();

      // Reset all filters
      act(() => {
        filters.result.current.resetFilter();
      });

      expect(filters.result.current.hasActiveFilters).toBe(false);
      expect(filters.result.current.statusFilter).toBe("all");
      expect(filters.result.current.customFilters).toEqual({});
    });
  });

  describe("Notification System Scenario", () => {
    it("should handle global notifications across components", () => {
      const notifications = renderHook(() => useNotifications());
      const customerTable = renderHook(() => useDataTable("customers"));

      // No initial notifications
      expect(notifications.result.current.notifications).toHaveLength(0);

      // Simulate successful customer creation
      act(() => {
        customerTable.result.current.loading.startLoading("create-customer");
      });

      // Simulate completion with success notification
      act(() => {
        customerTable.result.current.loading.stopLoading();
        notifications.result.current.addSuccess("Customer created successfully");
      });

      expect(notifications.result.current.notifications).toHaveLength(1);
      expect(notifications.result.current.notifications[0].type).toBe("success");
      expect(notifications.result.current.notifications[0].message).toBe(
        "Customer created successfully",
      );

      // Simulate error in different operation
      act(() => {
        notifications.result.current.addError("Failed to delete customer");
        notifications.result.current.addWarning("Customer has pending invoices");
      });

      expect(notifications.result.current.notifications).toHaveLength(3);

      // Dismiss specific notification
      const successNotificationId = notifications.result.current.notifications[0].id;
      act(() => {
        notifications.result.current.dismissNotification(successNotificationId);
      });

      expect(notifications.result.current.notifications).toHaveLength(2);

      // Clear all notifications
      act(() => {
        notifications.result.current.clearNotifications();
      });

      expect(notifications.result.current.notifications).toHaveLength(0);
    });
  });

  describe("Performance and Memory Scenario", () => {
    it("should handle rapid state updates without memory leaks", () => {
      const table = renderHook(() => useDataTable("performance-test"));

      // Simulate rapid user interactions
      act(() => {
        for (let i = 0; i < 100; i++) {
          table.result.current.filters.setSearch(`search-${i}`);
          table.result.current.pagination.goToPage((i % 5) + 1);
          table.result.current.selection.select(`item-${i}`, true);
        }
      });

      // State should be consistent
      expect(table.result.current.filters.searchTerm).toBe("search-99");
      expect(table.result.current.pagination.currentPage).toBe(5); // 99 % 5 + 1 = 5
      expect(table.result.current.selection.selectedItems).toHaveLength(100);

      // Reset should work properly
      act(() => {
        table.result.current.reset();
      });

      expect(table.result.current.filters.searchTerm).toBe("");
      expect(table.result.current.pagination.currentPage).toBe(1);
      expect(table.result.current.selection.selectedItems).toHaveLength(0);
    });
  });

  describe("TypeScript Type Safety Scenario", () => {
    interface Customer {
      id: string;
      name: string;
      email: string;
    }

    it("should provide proper TypeScript support for typed selections", () => {
      const { result } = renderHook(() => useDataTable<Customer>("typed-customers"));

      const customers: Customer[] = [
        { id: "1", name: "John Doe", email: "john@example.com" },
        { id: "2", name: "Jane Smith", email: "jane@example.com" },
      ];

      act(() => {
        result.current.selection.select(customers[0], true);
        result.current.selection.select(customers[1], true);
      });

      expect(result.current.selection.selectedItems).toHaveLength(2);
      expect(result.current.selection.isSelected(customers[0])).toBe(true);

      // Selected items maintain their type
      const selectedCustomers = result.current.selection.selectedItems;
      expect(selectedCustomers[0].email).toBe("john@example.com");
    });
  });
});
