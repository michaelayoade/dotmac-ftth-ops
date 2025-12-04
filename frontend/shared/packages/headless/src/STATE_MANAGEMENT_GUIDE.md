# State Management Consolidation Guide

## Overview

The DotMac platform now uses a consolidated state management approach that standardizes common UI patterns and reduces code duplication across components. This guide shows how to migrate from scattered `useState` patterns to the centralized `useAppState` system.

## Key Benefits

- **Consistent patterns**: All components use the same patterns for filtering, pagination, selection, and loading states
- **Reduced boilerplate**: Common state patterns are handled by specialized hooks
- **Better performance**: State is properly memoized and optimized
- **Persistence**: UI preferences and non-sensitive state persist across sessions
- **Type safety**: Full TypeScript support with proper typing
- **Centralized notifications**: Global notification system with proper state management

## Core Concepts

### Context-Based State

State is organized by "context" - typically the component or page name. This ensures state isolation while enabling reuse of patterns.

```typescript
// Each component gets its own state context
const tableState = useDataTable("customer-management");
const filtersState = useFilters("invoice-list");
```

### State Categories

1. **UI State**: Global UI preferences (sidebar, theme, etc.)
2. **Filter State**: Search, sorting, and filtering for data tables
3. **Pagination State**: Page navigation and item counts
4. **Selection State**: Multi-select and bulk operations
5. **Loading State**: Async operation states and error handling
6. **Preferences**: User preferences and settings

## Migration Examples

### Before: Scattered useState

```typescript
// Old approach - lots of boilerplate
const [searchTerm, setSearchTerm] = useState("");
const [statusFilter, setStatusFilter] = useState("all");
const [sortBy, setSortBy] = useState("name");
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(25);
const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### After: Consolidated State

```typescript
// New approach - single hook with all common patterns
const { filters, pagination, selection, loading } = useDataTable<Customer>("customer-management");

// All the previous functionality is now available through the returned objects:
// filters.searchTerm, filters.setSearch(), etc.
// pagination.currentPage, pagination.goToPage(), etc.
// selection.selectedItems, selection.toggleItem(), etc.
// loading.isLoading, loading.startLoading(), etc.
```

## Specialized Hooks

### useFilters(context)

Handles all filtering and sorting logic:

```typescript
const filters = useFilters("customer-list");

// Available properties and methods:
filters.searchTerm; // Current search term
filters.statusFilter; // Current status filter
filters.sortBy; // Current sort field
filters.sortOrder; // 'asc' | 'desc'
filters.dateRange; // { start: Date | null, end: Date | null }
filters.hasActiveFilters; // boolean

// Methods:
filters.setSearch("term");
filters.setStatus("active");
filters.setSort("name", "desc");
filters.toggleSort("name");
filters.setRange(startDate, endDate);
filters.resetFilter();
```

### usePagination(context)

Manages pagination state:

```typescript
const pagination = usePagination("invoice-list");

// Properties:
pagination.currentPage; // Current page number
pagination.itemsPerPage; // Items per page
pagination.totalItems; // Total item count
pagination.totalPages; // Total page count
pagination.canGoNext; // Can go to next page
pagination.canGoPrevious; // Can go to previous page
pagination.startItem; // First item number on current page
pagination.endItem; // Last item number on current page

// Methods:
pagination.goToPage(3);
pagination.nextPage();
pagination.previousPage();
pagination.changeItemsPerPage(50);
pagination.setTotal(1250);
```

### useSelection(context)

Handles multi-selection patterns:

```typescript
const selection = useSelection<Customer>("customer-table");

// Properties:
selection.selectedItems; // Array of selected items
selection.hasSelection; // boolean
selection.selectedCount; // Number of selected items
selection.selectAll; // Is "select all" active

// Methods:
selection.select(customer);
selection.toggleItem(customer, true); // true for multi-select
selection.selectAll(allCustomers);
selection.clear();
selection.isSelected(customer);
```

### useLoading(context)

Manages loading and error states:

```typescript
const loading = useLoading("customer-api");

// Properties:
loading.isLoading; // Current loading state
loading.error; // Error message or null
loading.lastUpdated; // Last successful update timestamp

// Methods:
loading.startLoading("operation-id");
loading.stopLoading();
loading.setError("Error message");
loading.clearError();
```

### useNotifications()

Global notification system:

```typescript
const { addSuccess, addError, addWarning, notifications } = useNotifications();

// Add notifications
addSuccess("Customer updated successfully");
addError("Failed to save customer");
addWarning("Customer email not verified");

// Access active notifications
notifications.forEach((notification) => {
  // notification.type, notification.message, notification.timestamp
});
```

## Complete Migration Example

### Before: CustomerManagement Component

```typescript
export function CustomerManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset pagination
  };

  const handleSort = (field: string) => {
    setSortBy(field);
    // ... sorting logic
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // ... rest of component
}
```

### After: CustomerManagement Component

```typescript
export function CustomerManagement() {
  const { filters, pagination, selection, loading } = useDataTable<Customer>("customer-management");
  const { addSuccess, addError } = useNotifications();

  // All state management is now handled by the consolidated hooks
  // No need to manually manage pagination resets, etc.

  const handleSearch = filters.setSearch;
  const handleSort = filters.toggleSort;
  const handlePageChange = pagination.goToPage;

  // Simplified API calls with integrated loading states
  const updateCustomer = async (customer: Customer) => {
    loading.startLoading();
    try {
      await customerApi.update(customer);
      loading.stopLoading();
      addSuccess("Customer updated successfully");
    } catch (error) {
      loading.setError(error.message);
      addError("Failed to update customer");
    }
  };

  // ... rest of component with much less boilerplate
}
```

## Advanced Patterns

### Form State with Error Handling

```typescript
const formState = useFormState("customer-form");

const handleSubmit = () => {
  formState.handleSubmit(() => api.saveCustomer(formData), {
    successMessage: "Customer saved successfully",
    errorMessage: "Failed to save customer",
  });
};
```

### Combined State Contexts

```typescript
// Different contexts for different data tables on the same page
const customerTable = useDataTable("page-customers");
const invoiceTable = useDataTable("page-invoices");
const activityTable = useDataTable("page-activity");
```

### Custom Filter Extensions

```typescript
const filters = useFilters("customer-advanced");

// Add custom filters using the customFilters object
filters.updateFilter({
  customFilters: {
    ...filters.customFilters,
    region: "north",
    planType: "premium",
  },
});
```

## Best Practices

1. **Use descriptive contexts**: `'customer-management'` instead of `'table'`
2. **One context per data table**: Don't share contexts between unrelated tables
3. **Reset context on unmount**: Use `useEffect` cleanup for temporary contexts
4. **Combine related state**: Use `useDataTable` for data tables, individual hooks for specific needs
5. **Handle errors globally**: Use the notification system for consistent error display
6. **Persist preferences**: UI preferences automatically persist; business data does not

## TypeScript Support

All hooks are fully typed. For selection hooks, specify the item type:

```typescript
const selection = useSelection<Customer>("customer-table");
const filters = useFilters("customer-list"); // FilterState is inferred
const pagination = usePagination("customer-list"); // PaginationState is inferred
```

## Performance Considerations

- State updates are batched and memoized
- Only relevant components re-render when state changes
- Context-based isolation prevents unnecessary updates
- Persistent state uses secure storage with automatic cleanup

## Migration Checklist

- [ ] Replace scattered `useState` with appropriate consolidated hooks
- [ ] Update event handlers to use hook methods instead of direct state setters
- [ ] Remove manual pagination reset logic (handled automatically)
- [ ] Update error handling to use notification system
- [ ] Add proper TypeScript types for selection hooks
- [ ] Test state persistence and reset behavior
- [ ] Update tests to work with consolidated state

This consolidated approach will make your components cleaner, more consistent, and easier to maintain while providing better user experience through proper state persistence and error handling.
