/**
 * Universal Data Table Component
 * Advanced data table with sorting, filtering, pagination, and export capabilities
 */

"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "../utils/cn";

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  width?: string | number;
  align?: "left" | "center" | "right";

  // Formatting
  render?: (value: any, row: T, index: number) => React.ReactNode;
  format?: "text" | "number" | "currency" | "percentage" | "date" | "status" | "badge";
  currency?: string;
  precision?: number;

  // Filtering
  filterType?: "text" | "select" | "date" | "number" | "boolean";
  filterOptions?: Array<{ label: string; value: any }>;

  // Styling
  headerClassName?: string;
  cellClassName?: string | ((value: any, row: T) => string);
}

export interface TableAction<T = any> {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: T, index: number) => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  condition?: (row: T) => boolean;
}

export interface UniversalDataTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];

  // Actions
  actions?: TableAction<T[]>[];
  rowActions?: TableAction<T>[];
  bulkActions?: TableAction<T[]>[];

  // Features
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  paginated?: boolean;
  selectable?: boolean;
  exportable?: boolean;

  // Pagination
  pageSize?: number;
  pageSizeOptions?: number[];

  // Selection
  onSelectionChange?: (selectedRows: T[]) => void;
  rowSelection?: "single" | "multiple";

  // Customization
  variant?: "default" | "striped" | "bordered" | "compact";
  size?: "sm" | "md" | "lg";
  stickyHeader?: boolean;

  // State
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;

  // Events
  onRowClick?: (row: T, index: number) => void;
  onSort?: (column: string, direction: "asc" | "desc") => void;
  onFilter?: (filters: Record<string, any>) => void;
  onSearch?: (query: string) => void;

  // Layout
  title?: string;
  subtitle?: string;
  className?: string;
  maxHeight?: number | string;
}

const formatValue = (value: any, column: TableColumn): React.ReactNode => {
  if (value === null || value === undefined) return "-";

  switch (column.format) {
    case "currency":
      const currency = column.currency || "USD";
      const precision = column.precision || 2;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(Number(value));

    case "percentage":
      return `${Number(value).toFixed(column.precision || 1)}%`;

    case "number":
      return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: column.precision || 0,
        maximumFractionDigits: column.precision || 2,
      });

    case "date":
      const date = new Date(value);
      return date.toLocaleDateString();

    case "status":
      return (
        <span
          className={cn(
            "px-2 py-1 text-xs font-medium rounded-full",
            value === "active" && "bg-green-100 text-green-800",
            value === "inactive" && "bg-gray-100 text-gray-800",
            value === "pending" && "bg-yellow-100 text-yellow-800",
            value === "error" && "bg-red-100 text-red-800",
          )}
        >
          {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
        </span>
      );

    case "badge":
      return (
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          {value}
        </span>
      );

    default:
      return String(value);
  }
};

const sizeClasses = {
  sm: {
    table: "text-sm",
    cell: "px-3 py-2",
    header: "px-3 py-3",
  },
  md: {
    table: "text-sm",
    cell: "px-4 py-3",
    header: "px-4 py-4",
  },
  lg: {
    table: "text-base",
    cell: "px-6 py-4",
    header: "px-6 py-5",
  },
};

export function UniversalDataTable<T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  rowActions = [],
  bulkActions = [],
  sortable = true,
  filterable = true,
  searchable = true,
  paginated = true,
  selectable = false,
  exportable = true,
  pageSize = 10,
  pageSizeOptions = [5, 10, 25, 50, 100],
  onSelectionChange,
  rowSelection = "multiple",
  variant = "default",
  size = "md",
  stickyHeader = false,
  loading = false,
  error = null,
  emptyMessage = "No data available",
  onRowClick,
  onSort,
  onFilter,
  onSearch,
  title,
  subtitle,
  className = "",
  maxHeight,
}: UniversalDataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const sizes = sizeClasses[size];

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = data;

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter((row) => {
        return columns.some((column) => {
          if (!column.searchable) return false;
          const value = row[column.key];
          return String(value).toLowerCase().includes(searchQuery.toLowerCase());
        });
      });
    }

    // Apply column filters
    Object.entries(filters).forEach(([columnKey, filterValue]) => {
      if (filterValue !== "" && filterValue !== null && filterValue !== undefined) {
        filtered = filtered.filter((row) => {
          const value = row[columnKey];
          return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
        });
      }
    });

    return filtered;
  }, [data, searchQuery, filters, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData;

    const startIndex = (currentPage - 1) * currentPageSize;
    return sortedData.slice(startIndex, startIndex + currentPageSize);
  }, [sortedData, currentPage, currentPageSize, paginated]);

  const totalPages = Math.ceil(filteredData.length / currentPageSize);

  // Handle sorting
  const handleSort = useCallback(
    (column: TableColumn) => {
      if (!column.sortable) return;

      const newDirection = sortColumn === column.key && sortDirection === "asc" ? "desc" : "asc";
      setSortColumn(column.key);
      setSortDirection(newDirection);

      onSort?.(column.key, newDirection);
    },
    [sortColumn, sortDirection, onSort],
  );

  // Handle selection
  const handleRowSelection = useCallback(
    (row: T, checked: boolean) => {
      let newSelection: T[];

      if (rowSelection === "single") {
        newSelection = checked ? [row] : [];
      } else {
        newSelection = checked ? [...selectedRows, row] : selectedRows.filter((r) => r !== row);
      }

      setSelectedRows(newSelection);
      onSelectionChange?.(newSelection);
    },
    [selectedRows, rowSelection, onSelectionChange],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const newSelection = checked ? paginatedData : [];
      setSelectedRows(newSelection);
      onSelectionChange?.(newSelection);
    },
    [paginatedData, onSelectionChange],
  );

  const isRowSelected = useCallback(
    (row: T) => {
      return selectedRows.includes(row);
    },
    [selectedRows],
  );

  const areAllRowsSelected =
    paginatedData.length > 0 && paginatedData.every((row) => isRowSelected(row));
  const areSomeRowsSelected = selectedRows.length > 0 && !areAllRowsSelected;

  // Export functionality
  const handleExport = useCallback(() => {
    const csvContent = [
      columns.map((col) => col.label).join(","),
      ...filteredData.map((row) =>
        columns
          .map((col) => {
            const value = row[col.key];
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "data"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredData, columns, title]);

  // Loading State
  if (loading) {
    return (
      <div className={cn("bg-white rounded-lg border border-gray-200", className)}>
        <div className="p-6">
          {title && <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />}
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-4 bg-gray-200 rounded flex-1 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className={cn("bg-white rounded-lg border border-gray-200 p-6", className)}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Failed to load table data</p>
          <p className="text-xs text-gray-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={cn("bg-white rounded-lg border border-gray-200", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      {(title || subtitle || actions.length > 0 || searchable || exportable) && (
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    onSearch?.(e.target.value);
                  }}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Filters */}
            {filterable && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "p-2 rounded-lg border border-gray-300 hover:bg-gray-50",
                  showFilters && "bg-blue-50 border-blue-300",
                )}
              >
                <Filter className="w-4 h-4 text-gray-600" />
              </button>
            )}

            {/* Export */}
            {exportable && (
              <button
                onClick={handleExport}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                title="Export CSV"
              >
                <Download className="w-4 h-4 text-gray-600" />
              </button>
            )}

            {/* Bulk Actions */}
            {bulkActions.length > 0 && selectedRows.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{selectedRows.length} selected</span>
                {bulkActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => action.onClick(selectedRows, selectedRows.length)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium",
                        action.variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
                        (!action.variant || action.variant === "secondary") &&
                          "bg-gray-600 text-white hover:bg-gray-700",
                      )}
                    >
                      {Icon && <Icon className="w-4 h-4 mr-1 inline" />}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Table Actions */}
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => action.onClick(filteredData, -1)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium",
                    action.variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
                    (!action.variant || action.variant === "secondary") &&
                      "bg-gray-600 text-white hover:bg-gray-700",
                  )}
                >
                  {Icon && <Icon className="w-4 h-4 mr-1 inline" />}
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && filterable && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns
              .filter((col) => col.filterable)
              .map((column) => (
                <div key={column.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {column.label}
                  </label>
                  {column.filterType === "select" && column.filterOptions ? (
                    <select
                      value={filters[column.key] || ""}
                      onChange={(e) => {
                        const newFilters = {
                          ...filters,
                          [column.key]: e.target.value,
                        };
                        setFilters(newFilters);
                        onFilter?.(newFilters);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">All</option>
                      {column.filterOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={column.filterType || "text"}
                      value={filters[column.key] || ""}
                      onChange={(e) => {
                        const newFilters = {
                          ...filters,
                          [column.key]: e.target.value,
                        };
                        setFilters(newFilters);
                        onFilter?.(newFilters);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder={`Filter by ${column.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className={cn("min-w-full divide-y divide-gray-200", sizes.table)}>
          <thead
            className={cn(
              "bg-gray-50",
              variant === "striped" && "bg-gray-100",
              stickyHeader && "sticky top-0 z-10",
            )}
          >
            <tr>
              {selectable && (
                <th className={cn("w-12", sizes.header)}>
                  <input
                    type="checkbox"
                    checked={areAllRowsSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = areSomeRowsSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}

              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                    sizes.header,
                    column.headerClassName,
                    column.sortable && "cursor-pointer hover:bg-gray-100",
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                  )}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        <ChevronUp
                          className={cn(
                            "w-3 h-3",
                            sortColumn === column.key && sortDirection === "asc"
                              ? "text-blue-600"
                              : "text-gray-400",
                          )}
                        />
                        <ChevronDown
                          className={cn(
                            "w-3 h-3 -mt-1",
                            sortColumn === column.key && sortDirection === "desc"
                              ? "text-blue-600"
                              : "text-gray-400",
                          )}
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}

              {rowActions.length > 0 && (
                <th className={cn("w-12", sizes.header)}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody
            className={cn(
              "bg-white divide-y divide-gray-200",
              variant === "striped" && "divide-gray-100",
            )}
          >
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (rowActions.length > 0 ? 1 : 0)}
                  className={cn("text-center text-gray-500 py-12", sizes.cell)}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    variant === "striped" && index % 2 === 1 && "bg-gray-50",
                    variant === "bordered" && "border-b border-gray-200",
                    onRowClick && "cursor-pointer hover:bg-gray-50",
                    isRowSelected(row) && "bg-blue-50",
                  )}
                  onClick={() => onRowClick?.(row, index)}
                >
                  {selectable && (
                    <td className={sizes.cell}>
                      <input
                        type="checkbox"
                        checked={isRowSelected(row)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleRowSelection(row, e.target.checked);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}

                  {columns.map((column) => {
                    const value = row[column.key];
                    const cellClassName =
                      typeof column.cellClassName === "function"
                        ? column.cellClassName(value, row)
                        : column.cellClassName;

                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "text-gray-900",
                          sizes.cell,
                          cellClassName,
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                        )}
                      >
                        {column.render
                          ? column.render(value, row, index)
                          : formatValue(value, column)}
                      </td>
                    );
                  })}

                  {rowActions.length > 0 && (
                    <td className={sizes.cell}>
                      <div className="flex items-center space-x-1">
                        {rowActions.map((action) => {
                          if (action.condition && !action.condition(row)) return null;

                          const Icon = action.icon;
                          return (
                            <button
                              key={action.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row, index);
                              }}
                              className={cn(
                                "p-1 rounded hover:bg-gray-100",
                                action.variant === "danger" && "text-red-600 hover:bg-red-50",
                              )}
                              title={action.label}
                            >
                              {Icon && <Icon className="w-4 h-4" />}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">
              Showing {(currentPage - 1) * currentPageSize + 1} to{" "}
              {Math.min(currentPage * currentPageSize, filteredData.length)} of{" "}
              {filteredData.length} entries
            </span>

            <select
              value={currentPageSize}
              onChange={(e) => {
                setCurrentPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-2 text-sm">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default UniversalDataTable;
