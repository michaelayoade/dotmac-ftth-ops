// @ts-nocheck
/**
 * Advanced data table with filtering, sorting, grouping, and virtual scrolling
 */

import { clsx } from "clsx";
import type React from "react";
import { forwardRef, useCallback, useMemo, useState } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { type Column, DataTable } from "./Table";

// Enhanced column definition
export interface AdvancedColumn<T = Record<string, unknown>> extends Column<T> {
  // Filtering
  filterable?: boolean;
  filterType?: "text" | "select" | "date" | "number" | "boolean" | "custom";
  filterOptions?: Array<{ label: string; value: T[keyof T] }>;
  filterComponent?: React.ComponentType<{
    value: T[keyof T];
    onChange: (value: T[keyof T]) => void;
    column: AdvancedColumn<T>;
  }>;

  // Grouping
  groupable?: boolean;

  // Advanced sorting
  sortCompare?: (a: T, b: T) => number;

  // Virtual scrolling
  sticky?: boolean;
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;

  // Cell editing
  editable?: boolean;
  editComponent?: React.ComponentType<{
    value: T[keyof T];
    onChange: (value: T[keyof T]) => void;
    record: T;
    column: AdvancedColumn<T>;
  }>;
}

// Filter state
export interface FilterState {
  [key: string]: unknown;
}

// Sort state
export interface SortState {
  field?: string;
  order?: "asc" | "desc";
  multiSort?: Array<{ field: string; order: "asc" | "desc" }>;
}

// Group state
export interface GroupState {
  groupBy?: string;
  expanded?: Set<string>;
}

// Table state
export interface TableState {
  filters: FilterState;
  sorting: SortState;
  grouping: GroupState;
  pagination: {
    page: number;
    pageSize: number;
  };
  selection: {
    selectedKeys: Set<string>;
  };
}

// Advanced data table props
export interface AdvancedDataTableProps<T = Record<string, unknown>> {
  // Data
  data: T[];
  columns: AdvancedColumn<T>[];
  keyExtractor: (record: T) => string;

  // Features
  filterable?: boolean;
  sortable?: boolean;
  groupable?: boolean;
  selectable?: boolean;
  editable?: boolean;
  resizable?: boolean;

  // Virtual scrolling
  virtualScrolling?: boolean;
  rowHeight?: number;
  containerHeight?: number;

  // Pagination
  pagination?: {
    enabled: boolean;
    pageSize?: number;
    showSizeChanger?: boolean;
    pageSizeOptions?: number[];
  };

  // State management
  controlled?: boolean;
  state?: Partial<TableState>;
  onStateChange?: (state: TableState) => void;

  // Event handlers
  onRowClick?: (record: T, index: number) => void;
  onRowDoubleClick?: (record: T, index: number) => void;
  onSelectionChange?: (selectedKeys: string[], selectedRecords: T[]) => void;
  onCellEdit?: (record: T, field: string, value: T[keyof T]) => void;

  // Customization
  loading?: boolean;
  error?: string;
  emptyText?: string;
  className?: string;
  rowClassName?: (record: T, index: number) => string;

  // Export functionality
  exportable?: boolean;
  onExport?: (format: "csv" | "excel" | "pdf") => void;
}

// Table variants
const advancedTableVariants = cva("advanced-data-table", {
  variants: {
    density: {
      compact: "density-compact",
      comfortable: "density-comfortable",
      spacious: "density-spacious",
    },
    variant: {
      default: "variant-default",
      bordered: "variant-bordered",
      striped: "variant-striped",
    },
  },
  defaultVariants: {
    density: "comfortable",
    variant: "default",
  },
});

// Filter components with proper typing
interface FilterComponentProps<T> {
  value?: T[keyof T];
  onChange: (value: T[keyof T]) => void;
  column?: AdvancedColumn<T>;
}

const TextFilter = <T,>({ value, onChange, column }: FilterComponentProps<T>) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value as T[keyof T]);
  };

  return (
    <input
      type="text"
      value={String(value || "")}
      onChange={handleChange}
      placeholder="Filter..."
      className="filter-input"
      aria-label={column?.label ? `Filter by ${String(column.label)}` : "Filter"}
    />
  );
};

const SelectFilter = <T,>({ value, onChange, column }: FilterComponentProps<T>) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as T[keyof T]);
  };

  return (
    <select
      value={String(value || "")}
      onChange={handleChange}
      className="filter-select"
      aria-label={column?.label ? `Filter by ${String(column.label)}` : "Filter"}
    >
      <option value="">All</option>
      {column?.filterOptions?.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

const NumberFilter = ({ value, onChange, column }: any) => (
  <input
    type="number"
    value={value || ""}
    onChange={(e) => onChange(Number(e.target.value) || undefined)}
    placeholder="Filter..."
    className="filter-input"
    aria-label={column?.label ? `Filter by ${String(column.label)}` : "Number filter"}
  />
);

const DateFilter = ({ value, onChange, column }: any) => (
  <input
    type="date"
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    className="filter-input"
    aria-label={column?.label ? `Filter by ${String(column.label)}` : "Date filter"}
  />
);

// Virtual scrolling hook
function useVirtualScrolling<T>(
  data: T[],
  rowHeight: number,
  containerHeight: number,
  enabled: boolean = true,
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    if (!enabled) {
      return { start: 0, end: data.length };
    }

    const start = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const end = Math.min(start + visibleCount + 5, data.length); // +5 for buffer

    return { start: Math.max(0, start - 5), end }; // -5 for buffer
  }, [scrollTop, rowHeight, containerHeight, data.length, enabled]);

  const visibleData = useMemo(() => {
    if (!enabled) {
      return data;
    }
    return data.slice(visibleRange.start, visibleRange.end);
  }, [data, visibleRange, enabled]);

  return {
    visibleData,
    visibleRange,
    scrollTop,
    setScrollTop,
    totalHeight: data.length * rowHeight,
  };
}

// Advanced data table component
export const AdvancedDataTable = forwardRef<HTMLDivElement, AdvancedDataTableProps>(
  (
    {
      data,
      columns,
      keyExtractor,
      filterable = true,
      sortable = true,
      groupable = false,
      selectable = false,
      editable: _editable = false,
      resizable: _resizable = false,
      virtualScrolling = false,
      rowHeight = 40,
      containerHeight = 400,
      pagination,
      controlled = false,
      state: controlledState,
      onStateChange,
      onRowClick: _onRowClick,
      onRowDoubleClick: _onRowDoubleClick,
      onSelectionChange,
      onCellEdit: _onCellEdit,
      loading = false,
      error,
      emptyText = "No data available",
      className,
      rowClassName: _rowClassName,
      exportable = false,
      onExport,
      ...props
    },
    ref,
  ) => {
    // Internal state
    const [internalState, setInternalState] = useState<TableState>({
      filters: {
        // Implementation pending
      },
      sorting: {
        // Implementation pending
      },
      grouping: {
        // Implementation pending
      },
      pagination: { page: 1, pageSize: pagination?.pageSize || 20 },
      selection: { selectedKeys: new Set() },
    });

    const state = useMemo(
      () => (controlled ? { ...internalState, ...controlledState } : internalState),
      [controlled, internalState, controlledState],
    );

    const updateState = useCallback(
      (updates: Partial<TableState>) => {
        const newState = { ...state, ...updates };
        if (!controlled) {
          setInternalState(newState);
        }
        onStateChange?.(newState);
      },
      [state, controlled, onStateChange],
    );

    // Data processing
    const processedData = useMemo(() => {
      let result = [...data];

      // Apply filters
      if (filterable && Object.keys(state.filters).length > 0) {
        result = result.filter((record) => {
          return Object.entries(state.filters).every(([field, filterValue]) => {
            if (!filterValue) {
              return true;
            }

            const column = columns.find((col) => col.key === field);
            if (!column) {
              return true;
            }

            const recordValue = column.dataIndex ? record[column.dataIndex] : record;

            switch (column.filterType) {
              case "text":
                return String(recordValue)
                  .toLowerCase()
                  .includes(String(filterValue).toLowerCase());
              case "select":
                return recordValue === filterValue;
              case "number":
                return Number(recordValue) === Number(filterValue);
              case "date":
                return (
                  new Date(recordValue).toDateString() === new Date(filterValue).toDateString()
                );
              case "boolean":
                return Boolean(recordValue) === Boolean(filterValue);
              default:
                return String(recordValue)
                  .toLowerCase()
                  .includes(String(filterValue).toLowerCase());
            }
          });
        });
      }

      // Apply sorting
      if (sortable && state.sorting.field) {
        const column = columns.find((col) => col.key === state.sorting.field);
        if (column) {
          result.sort((a, b) => {
            if (column.sortCompare) {
              return column.sortCompare(a, b);
            }

            const aValue = column.dataIndex ? a[column.dataIndex] : a;
            const bValue = column.dataIndex ? b[column.dataIndex] : b;

            if (aValue < bValue) {
              return state.sorting.order === "asc" ? -1 : 1;
            }
            if (aValue > bValue) {
              return state.sorting.order === "asc" ? 1 : -1;
            }
            return 0;
          });
        }
      }

      // Apply grouping
      if (groupable && state.grouping.groupBy) {
        // Group implementation would go here
        // For now, return as-is
      }

      return result;
    }, [
      data,
      columns,
      state.filters,
      state.sorting,
      state.grouping,
      filterable,
      sortable,
      groupable,
    ]);

    // Pagination
    const paginatedData = useMemo(() => {
      if (!pagination?.enabled) {
        return processedData;
      }

      const start = (state.pagination.page - 1) * state.pagination.pageSize;
      const end = start + state.pagination.pageSize;
      return processedData.slice(start, end);
    }, [processedData, pagination?.enabled, state.pagination]);

    // Virtual scrolling
    const { visibleData, visibleRange, setScrollTop, totalHeight } = useVirtualScrolling(
      paginatedData,
      rowHeight,
      containerHeight,
      virtualScrolling,
    );

    // Event handlers
    const handleFilter = useCallback(
      (field: string, value: unknown) => {
        updateState({
          filters: { ...state.filters, [field]: value },
          pagination: { ...state.pagination, page: 1 }, // Reset to first page
        });
      },
      [state, updateState],
    );

    const handleSort = useCallback(
      (field: string) => {
        const currentOrder = state.sorting.field === field ? state.sorting.order : undefined;
        const newOrder = currentOrder === "asc" ? "desc" : "asc";

        updateState({
          sorting: { field, order: newOrder },
        });
      },
      [state.sorting, updateState],
    );

    const handlePageChange = useCallback(
      (page: number, pageSize?: number) => {
        updateState({
          pagination: {
            page,
            pageSize: pageSize || state.pagination.pageSize,
          },
        });
      },
      [state.pagination, updateState],
    );

    const handleSelection = useCallback(
      (selectedKeys: Set<string>) => {
        updateState({
          selection: { selectedKeys },
        });

        const selectedRecords = data.filter((record) => selectedKeys.has(keyExtractor(record)));
        onSelectionChange?.(Array.from(selectedKeys), selectedRecords);
      },
      [data, keyExtractor, onSelectionChange, updateState],
    );

    // Render filter component
    const renderFilter = useCallback(
      (column: AdvancedColumn) => {
        if (!column.filterable) {
          return null;
        }

        const value = state.filters[column.key];
        const onChange = (newValue: unknown) => handleFilter(column.key, newValue);

        if (column.filterComponent) {
          return <column.filterComponent value={value} onChange={onChange} column={column} />;
        }

        switch (column.filterType) {
          case "select":
            return <SelectFilter value={value} onChange={onChange} column={column} />;
          case "number":
            return <NumberFilter value={value} onChange={onChange} />;
          case "date":
            return <DateFilter value={value} onChange={onChange} />;
          default:
            return <TextFilter value={value} onChange={onChange} />;
        }
      },
      [state.filters, handleFilter],
    );

    // Header components
    const TableFilters = useMemo(() => {
      if (!filterable) {
        return null;
      }
      return (
        <div className="table-filters">
          {columns
            .filter((col) => col.filterable)
            .map((column) => (
              <div key={column.key} className="filter-item">
                <label
                  htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}
                  className="filter-label"
                >
                  {column.title}
                </label>
                {renderFilter(column)}
              </div>
            ))}
        </div>
      );
    }, [filterable, columns, renderFilter]);

    const TableActions = useMemo(() => {
      if (!exportable) {
        return null;
      }
      return (
        <div className="table-actions">
          <button
            type="button"
            onClick={() => onExport?.("csv")}
            className="export-button"
            type="button"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => onExport?.("excel")}
            className="export-button"
            type="button"
          >
            Export Excel
          </button>
        </div>
      );
    }, [exportable, onExport]);

    // Convert to DataTable format
    const dataTableColumns: Column[] = columns.map((col) => ({
      ...col,
      sortable: sortable && col.sortable !== false,
    }));

    const dataTableProps = {
      columns: dataTableColumns,
      data: virtualScrolling ? visibleData : paginatedData,
      loading,
      sorting: {
        field: state.sorting.field,
        order: state.sorting.order,
        onChange: handleSort,
      },
      selection: selectable
        ? {
            selectedKeys: Array.from(state.selection.selectedKeys),
            onChange: (keys: string[]) => handleSelection(new Set(keys)),
            getRowKey: keyExtractor,
          }
        : undefined,
      pagination: pagination?.enabled
        ? {
            current: state.pagination.page,
            pageSize: state.pagination.pageSize,
            total: processedData.length,
            onChange: handlePageChange,
          }
        : undefined,
      emptyText,
    };

    if (loading) {
      return (
        <div className={clsx(advancedTableVariants({}), "loading", className)}>
          <div className="table-loading">Loading...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={clsx(advancedTableVariants({}), "error", className)}>
          <div className="table-error">Error: {error}</div>
        </div>
      );
    }

    return (
      <div ref={ref} className={clsx(advancedTableVariants({}), className)} {...props}>
        {/* Table header with filters and actions */}
        <div className="table-header">
          {TableFilters}
          {TableActions}
        </div>

        {/* Virtual scrolling container */}
        {virtualScrolling ? (
          <div
            className="virtual-scroll-container"
            style={{ height: containerHeight, overflow: "auto" }}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            <div style={{ height: totalHeight, position: "relative" }}>
              <div
                style={{
                  transform: `translateY(${visibleRange.start * rowHeight}px)`,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <DataTable {...dataTableProps} />
              </div>
            </div>
          </div>
        ) : (
          <DataTable {...dataTableProps} />
        )}

        {/* Table footer with summary */}
        <div className="table-footer">
          <div className="table-summary">
            Showing {paginatedData.length} of {processedData.length} items
            {data.length !== processedData.length && ` (filtered from ${data.length})`}
          </div>
        </div>
      </div>
    );
  },
);

AdvancedDataTable.displayName = "AdvancedDataTable";
// @ts-nocheck
