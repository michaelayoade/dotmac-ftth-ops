import type { Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { Button } from "@dotmac/primitives";
import {
  useAppState,
  useUI,
  useAppNotifications,
  useFilters,
  usePagination,
  useSelection,
  useLoading,
  usePreferences,
  useDataTable,
  useFormState,
} from "./useAppState";

const meta: Meta = {
  title: "Headless/Hooks/useAppState",
  component: () => null,
  parameters: {
    docs: {
      description: {
        component: `
# useAppState Hook

Comprehensive application state management hook that provides specialized hooks for common state patterns.

## Features

- 🎛️ **UI State Management**: Sidebar, tabs, views, filters
- 📢 **Notifications**: Success, error, warning, info messages
- 🔍 **Contextual Filters**: Search, status, sorting, date ranges
- 📖 **Pagination**: Page navigation, items per page
- ✅ **Selection**: Single/multi-select with context isolation
- ⏳ **Loading States**: Per-context loading with error handling
- 🎨 **User Preferences**: Theme, language, timezone
- 📊 **Data Tables**: Combined filter/pagination/selection patterns
- 📝 **Form State**: Loading and error handling for forms

## Context Isolation

All state is isolated by context strings, allowing multiple instances of the same patterns without conflicts.

## Portal Variants

Each hook adapts to portal-specific requirements and styling preferences.
        `,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;
type Story = StoryObj;

// UI State Management Demo
export const UIStateDemo: Story = {
  name: "UI State Management",
  render: () => {
    const {
      sidebarOpen,
      activeTab,
      activeView,
      filtersOpen,
      toggleSidebar,
      setActiveTab,
      setActiveView,
      toggleFilters,
    } = useUI();

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold mb-4">UI State Controls</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Sidebar Control</h4>
            <div className="flex items-center space-x-2">
              <span
                className={`px-2 py-1 rounded text-sm ${sidebarOpen ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
              >
                {sidebarOpen ? "Open" : "Closed"}
              </span>
              <Button onClick={toggleSidebar} size="sm">
                Toggle Sidebar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Filters Control</h4>
            <div className="flex items-center space-x-2">
              <span
                className={`px-2 py-1 rounded text-sm ${filtersOpen ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
              >
                {filtersOpen ? "Open" : "Closed"}
              </span>
              <Button onClick={toggleFilters} size="sm">
                Toggle Filters
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Active Tab: {activeTab}</h4>
          <div className="flex space-x-2">
            {["dashboard", "billing", "settings", "support"].map((tab) => (
              <Button
                key={tab}
                onClick={() => setActiveTab(tab)}
                variant={activeTab === tab ? "primary" : "secondary"}
                size="sm"
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Active View: {activeView}</h4>
          <div className="flex space-x-2">
            {["grid", "list", "card"].map((view) => (
              <Button
                key={view}
                onClick={() => setActiveView(view)}
                variant={activeView === view ? "primary" : "secondary"}
                size="sm"
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  },
};

// Notifications Demo
export const NotificationsDemo: Story = {
  name: "Notifications Management",
  render: () => {
    const {
      notifications,
      addSuccess,
      addError,
      addWarning,
      addInfo,
      dismissNotification,
      clearNotifications,
    } = useAppNotifications();

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold mb-4">Notifications System</h3>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => addSuccess("Operation completed successfully!")}
            className="bg-green-600"
          >
            Add Success
          </Button>
          <Button onClick={() => addError("An error occurred")} className="bg-red-600">
            Add Error
          </Button>
          <Button onClick={() => addWarning("Warning: Please review")} className="bg-yellow-600">
            Add Warning
          </Button>
          <Button onClick={() => addInfo("Information update available")} className="bg-blue-600">
            Add Info
          </Button>
          <Button onClick={clearNotifications} variant="secondary">
            Clear All
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Active Notifications ({notifications.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border-l-4 ${
                  notification.type === "success"
                    ? "bg-green-50 border-green-400"
                    : notification.type === "error"
                      ? "bg-red-50 border-red-400"
                      : notification.type === "warning"
                        ? "bg-yellow-50 border-yellow-400"
                        : "bg-blue-50 border-blue-400"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        notification.type === "success"
                          ? "text-green-800"
                          : notification.type === "error"
                            ? "text-red-800"
                            : notification.type === "warning"
                              ? "text-yellow-800"
                              : "text-blue-800"
                      }`}
                    >
                      {notification.type.toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                  </div>
                  <Button
                    onClick={() => dismissNotification(notification.id)}
                    size="sm"
                    variant="secondary"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
};

// Filters Demo
export const FiltersDemo: Story = {
  name: "Contextual Filters",
  render: () => {
    const context = "demo-table";
    const {
      searchTerm,
      statusFilter,
      sortBy,
      sortOrder,
      dateRange,
      hasActiveFilters,
      setSearch,
      setStatus,
      setSort,
      toggleSort,
      setRange,
      resetFilter,
    } = useFilters(context);

    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Filters Demo</h3>
          {hasActiveFilters && (
            <Button onClick={resetFilter} variant="secondary" size="sm">
              Clear Filters
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Search Term</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Sorting</h4>
          <div className="flex flex-wrap gap-2">
            {["name", "date", "status", "amount"].map((field) => (
              <Button
                key={field}
                onClick={() => toggleSort(field)}
                variant={sortBy === field ? "primary" : "secondary"}
                size="sm"
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {sortBy === field && (
                  <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Current Filter State</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <strong>Search:</strong> "{searchTerm}"
            </div>
            <div>
              <strong>Status:</strong> {statusFilter}
            </div>
            <div>
              <strong>Sort By:</strong> {sortBy}
            </div>
            <div>
              <strong>Sort Order:</strong> {sortOrder}
            </div>
            <div>
              <strong>Has Filters:</strong> {hasActiveFilters ? "Yes" : "No"}
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// Pagination Demo
export const PaginationDemo: Story = {
  name: "Contextual Pagination",
  render: () => {
    const context = "demo-pagination";
    const {
      currentPage,
      itemsPerPage,
      totalItems,
      totalPages,
      canGoNext,
      canGoPrevious,
      startItem,
      endItem,
      goToPage,
      changeItemsPerPage,
      setTotal,
      nextPage,
      previousPage,
      firstPage,
      lastPage,
    } = usePagination(context);

    // Simulate total items change
    const [simulatedTotal, setSimulatedTotal] = useState(totalItems);
    useEffect(() => {
      setTotal(simulatedTotal);
    }, [simulatedTotal, setTotal]);

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Pagination Demo</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Total Items</label>
            <input
              type="number"
              value={simulatedTotal}
              onChange={(e) => setSimulatedTotal(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md"
              min="0"
              max="1000"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Items Per Page</label>
            <select
              value={itemsPerPage}
              onChange={(e) => changeItemsPerPage(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {startItem}-{endItem} of {totalItems} items
          </div>
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button onClick={firstPage} disabled={!canGoPrevious} size="sm" variant="secondary">
            First
          </Button>
          <Button onClick={previousPage} disabled={!canGoPrevious} size="sm" variant="secondary">
            Previous
          </Button>

          <div className="flex space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, currentPage - 2) + i;
              if (page <= totalPages) {
                return (
                  <Button
                    key={page}
                    onClick={() => goToPage(page)}
                    variant={currentPage === page ? "primary" : "secondary"}
                    size="sm"
                  >
                    {page}
                  </Button>
                );
              }
              return null;
            })}
          </div>

          <Button onClick={nextPage} disabled={!canGoNext} size="sm" variant="secondary">
            Next
          </Button>
          <Button onClick={lastPage} disabled={!canGoNext} size="sm" variant="secondary">
            Last
          </Button>
        </div>
      </div>
    );
  },
};

// Selection Demo
export const SelectionDemo: Story = {
  name: "Contextual Selection",
  render: () => {
    const context = "demo-selection";
    const {
      selectedItems,
      hasSelection,
      selectedCount,
      select,
      deselect,
      toggleItem,
      toggleAll,
      clear,
      isSelected,
    } = useSelection<string>(context);

    const items = ["Item A", "Item B", "Item C", "Item D", "Item E"];

    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Selection Demo</h3>
          <div className="flex space-x-2">
            <Button onClick={() => toggleAll(items)} size="sm" variant="secondary">
              Toggle All ({selectedCount}/{items.length})
            </Button>
            <Button onClick={clear} disabled={!hasSelection} size="sm" variant="secondary">
              Clear Selection
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                isSelected(item)
                  ? "bg-blue-50 border-blue-300"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => toggleItem(item, true)}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isSelected(item)}
                  onChange={() => toggleItem(item, true)}
                  className="rounded"
                />
                <span className={isSelected(item) ? "font-medium" : ""}>{item}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Selection State</h4>
          <div className="text-sm space-y-1">
            <div>
              <strong>Selected Count:</strong> {selectedCount}
            </div>
            <div>
              <strong>Has Selection:</strong> {hasSelection ? "Yes" : "No"}
            </div>
            <div>
              <strong>Selected Items:</strong> {selectedItems.join(", ") || "None"}
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// Loading States Demo
export const LoadingStatesDemo: Story = {
  name: "Loading States",
  render: () => {
    const context = "demo-loading";
    const { isLoading, error, lastUpdated, startLoading, stopLoading, setError, clearError } =
      useLoading(context);

    const simulateOperation = async (shouldFail = false) => {
      startLoading("demo-operation");
      clearError();

      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (shouldFail) {
        setError("Operation failed due to network error");
      } else {
        stopLoading();
      }
    };

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Loading States Demo</h3>

        <div className="flex space-x-2">
          <Button
            onClick={() => simulateOperation(false)}
            disabled={isLoading}
            className={isLoading ? "opacity-50 cursor-not-allowed" : ""}
          >
            {isLoading ? "Loading..." : "Simulate Success"}
          </Button>
          <Button
            onClick={() => simulateOperation(true)}
            disabled={isLoading}
            className={isLoading ? "opacity-50 cursor-not-allowed" : ""}
            variant="secondary"
          >
            Simulate Error
          </Button>
          <Button onClick={clearError} disabled={!error} variant="secondary" size="sm">
            Clear Error
          </Button>
        </div>

        {isLoading && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-blue-800">Operation in progress...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-red-800">Error Occurred</h4>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <Button onClick={clearError} size="sm" variant="secondary">
                ✕
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Loading State</h4>
          <div className="text-sm space-y-1">
            <div>
              <strong>Is Loading:</strong> {isLoading ? "Yes" : "No"}
            </div>
            <div>
              <strong>Has Error:</strong> {error ? "Yes" : "No"}
            </div>
            <div>
              <strong>Last Updated:</strong>{" "}
              {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// Data Table Combined Demo
export const DataTableDemo: Story = {
  name: "Combined Data Table Pattern",
  render: () => {
    const context = "demo-datatable";
    const { filters, pagination, selection, loading, reset } = useDataTable<string>(context);

    const mockData = [
      "Document A.pdf",
      "Report B.xlsx",
      "Image C.jpg",
      "Video D.mp4",
      "Archive E.zip",
      "Presentation F.pptx",
      "Spreadsheet G.csv",
      "Text H.txt",
      "Code I.js",
      "Data J.json",
    ];

    // Filter and paginate mock data
    const filteredData = mockData.filter(
      (item) =>
        item.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
        (filters.statusFilter === "all" || item.includes(filters.statusFilter)),
    );

    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, startIndex + pagination.itemsPerPage);

    // Update pagination total
    React.useEffect(() => {
      pagination.setTotal(filteredData.length);
    }, [filteredData.length, pagination]);

    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Data Table Pattern</h3>
          <Button onClick={reset} variant="secondary" size="sm">
            Reset All State
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder="Search files..."
            className="px-3 py-2 border rounded-md"
          />
          <select
            value={filters.statusFilter}
            onChange={(e) => filters.setStatus(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Files</option>
            <option value="pdf">PDF Files</option>
            <option value="xlsx">Excel Files</option>
            <option value="jpg">Images</option>
          </select>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => selection.toggleAll(paginatedData)}
              size="sm"
              variant="secondary"
            >
              Select All Page ({selection.selectedCount})
            </Button>
            {selection.hasSelection && (
              <Button onClick={selection.clear} size="sm" variant="secondary">
                Clear Selection
              </Button>
            )}
          </div>
          <div className="text-sm text-gray-600">
            {pagination.startItem}-{pagination.endItem} of {pagination.totalItems} items
          </div>
        </div>

        {/* Data Display */}
        <div className="space-y-2">
          {loading.isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading data...</p>
            </div>
          ) : (
            paginatedData.map((item) => (
              <div
                key={item}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selection.isSelected(item)
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => selection.toggleItem(item, true)}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selection.isSelected(item)}
                    onChange={() => selection.toggleItem(item, true)}
                    className="rounded"
                  />
                  <span className={selection.isSelected(item) ? "font-medium" : ""}>{item}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <Button
              onClick={pagination.previousPage}
              disabled={!pagination.canGoPrevious}
              size="sm"
              variant="secondary"
            >
              Previous
            </Button>
            <span className="px-3 py-2 text-sm">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <Button
              onClick={pagination.nextPage}
              disabled={!pagination.canGoNext}
              size="sm"
              variant="secondary"
            >
              Next
            </Button>
          </div>

          <select
            value={pagination.itemsPerPage}
            onChange={(e) => pagination.changeItemsPerPage(parseInt(e.target.value))}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
          </select>
        </div>
      </div>
    );
  },
};

// Portal Variants Demo
export const PortalVariantsDemo: Story = {
  name: "Portal-Specific Variants",
  render: () => {
    const [selectedPortal, setSelectedPortal] = useState<string>("admin");
    const { setTheme, theme } = usePreferences();

    const portalConfigs = {
      admin: { theme: "professional", color: "blue" },
      customer: { theme: "friendly", color: "green" },
      reseller: { theme: "business", color: "purple" },
      technician: { theme: "mobile", color: "orange" },
      management: { theme: "enterprise", color: "red" },
    };

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Portal-Specific State Management</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Select Portal</label>
            <select
              value={selectedPortal}
              onChange={(e) => {
                setSelectedPortal(e.target.value);
                setTheme(portalConfigs[e.target.value]?.theme || "professional");
              }}
              className="w-full px-3 py-2 border rounded-md"
            >
              {Object.entries(portalConfigs).map(([portal, config]) => (
                <option key={portal} value={portal}>
                  {portal.charAt(0).toUpperCase() + portal.slice(1)} Portal
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Current Theme</label>
            <div
              className={`px-3 py-2 rounded-md border bg-${portalConfigs[selectedPortal]?.color}-50 border-${portalConfigs[selectedPortal]?.color}-200`}
            >
              {theme}
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Portal Configuration</h4>
          <div className="text-sm space-y-1">
            <div>
              <strong>Portal:</strong> {selectedPortal}
            </div>
            <div>
              <strong>Theme:</strong> {portalConfigs[selectedPortal]?.theme}
            </div>
            <div>
              <strong>Color Scheme:</strong> {portalConfigs[selectedPortal]?.color}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Portal-Specific Features</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {selectedPortal === "admin" && (
              <>
                <div className="p-2 bg-blue-50 rounded">✅ Advanced Analytics</div>
                <div className="p-2 bg-blue-50 rounded">✅ User Management</div>
                <div className="p-2 bg-blue-50 rounded">✅ System Settings</div>
                <div className="p-2 bg-blue-50 rounded">✅ Audit Logs</div>
              </>
            )}
            {selectedPortal === "customer" && (
              <>
                <div className="p-2 bg-green-50 rounded">✅ Self-Service Portal</div>
                <div className="p-2 bg-green-50 rounded">✅ Billing Dashboard</div>
                <div className="p-2 bg-green-50 rounded">✅ Support Tickets</div>
                <div className="p-2 bg-green-50 rounded">✅ Usage Analytics</div>
              </>
            )}
            {selectedPortal === "technician" && (
              <>
                <div className="p-2 bg-orange-50 rounded">✅ Mobile Optimized</div>
                <div className="p-2 bg-orange-50 rounded">✅ Offline Support</div>
                <div className="p-2 bg-orange-50 rounded">✅ GPS Integration</div>
                <div className="p-2 bg-orange-50 rounded">✅ Photo Capture</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  },
};

// Performance Demo
export const PerformanceDemo: Story = {
  name: "Performance Optimization",
  render: () => {
    const [contexts, setContexts] = useState<string[]>(["table-1"]);
    const [operationCount, setOperationCount] = useState(0);

    const addContext = () => {
      const newContext = `table-${contexts.length + 1}`;
      setContexts([...contexts, newContext]);
    };

    const removeContext = (contextToRemove: string) => {
      setContexts(contexts.filter((c) => c !== contextToRemove));
    };

    const performBulkOperation = () => {
      setOperationCount((prev) => prev + 1);
      // Simulate bulk state updates across contexts
      contexts.forEach((context) => {
        const { setSearch, setStatus } = useFilters(context);
        setSearch(`bulk-${operationCount}`);
        setStatus("active");
      });
    };

    return (
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Performance & Context Isolation</h3>

        <div className="flex space-x-2">
          <Button onClick={addContext} size="sm">
            Add Context ({contexts.length})
          </Button>
          <Button onClick={performBulkOperation} size="sm" variant="secondary">
            Bulk Operation ({operationCount})
          </Button>
        </div>

        <div className="space-y-3">
          {contexts.map((context) => (
            <ContextDemo key={context} context={context} onRemove={removeContext} />
          ))}
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800">Performance Notes</h4>
          <ul className="mt-2 text-sm text-yellow-700 space-y-1">
            <li>• Each context maintains isolated state</li>
            <li>• State updates only trigger re-renders for affected contexts</li>
            <li>• Bulk operations remain performant due to context isolation</li>
            <li>• Memory usage scales linearly with active contexts</li>
          </ul>
        </div>
      </div>
    );
  },
};

// Helper component for performance demo
function ContextDemo({
  context,
  onRemove,
}: {
  context: string;
  onRemove: (context: string) => void;
}) {
  const { searchTerm, setSearch } = useFilters(context);
  const { selectedCount, select, clear } = useSelection<string>(context);
  const { currentPage } = usePagination(context);

  return (
    <div className="p-3 border rounded-lg bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium">{context}</h4>
        <Button onClick={() => onRemove(context)} size="sm" variant="secondary">
          Remove
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>Search: "{searchTerm}"</div>
        <div>Selected: {selectedCount}</div>
        <div>Page: {currentPage}</div>
      </div>
    </div>
  );
}
