"use client";

import React, { useState, useCallback } from "react";
import { MagnifyingGlassIcon, PlusIcon, FunnelIcon } from "@heroicons/react/24/outline";

interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: React.ComponentType<any>;
  disabled?: boolean;
}

interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface ManagementPageTemplateProps<T = any> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: {
    key: keyof T;
    label: string;
    sortable?: boolean;
    render?: (value: any, item: T) => React.ReactNode;
  }[];
  onSearch?: (query: string) => void;
  onSort?: (key: keyof T, direction: "asc" | "desc") => void;
  onFilter?: (filters: Record<string, string>) => void;
  onItemClick?: (item: T) => void;
  onItemSelect?: (items: T[]) => void;
  actions?: ActionButton[];
  filters?: FilterOption[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  selectable?: boolean;
  className?: string;
}

export function ManagementPageTemplate<T = any>({
  title,
  subtitle,
  data,
  columns,
  onSearch,
  onSort,
  onFilter,
  onItemClick,
  onItemSelect,
  actions = [],
  filters = [],
  searchPlaceholder = "Search...",
  emptyMessage = "No items found",
  loading = false,
  selectable = false,
  className = "",
}: ManagementPageTemplateProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: "asc" | "desc";
  } | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [selectedItems, setSelectedItems] = useState<Set<T>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      onSearch?.(query);
    },
    [onSearch],
  );

  const handleSort = useCallback(
    (key: keyof T) => {
      const direction = sortConfig?.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
      setSortConfig({ key, direction });
      onSort?.(key, direction);
    },
    [sortConfig, onSort],
  );

  const handleFilterChange = useCallback(
    (filterKey: string, value: string) => {
      const newFilters = { ...activeFilters, [filterKey]: value };
      if (!value) {
        delete newFilters[filterKey];
      }
      setActiveFilters(newFilters);
      onFilter?.(newFilters);
    },
    [activeFilters, onFilter],
  );

  const handleItemSelect = useCallback(
    (item: T, selected: boolean) => {
      const newSelection = new Set(selectedItems);
      if (selected) {
        newSelection.add(item);
      } else {
        newSelection.delete(item);
      }
      setSelectedItems(newSelection);
      onItemSelect?.(Array.from(newSelection));
    },
    [selectedItems, onItemSelect],
  );

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedItems(new Set(data));
        onItemSelect?.(data);
      } else {
        setSelectedItems(new Set());
        onItemSelect?.([]);
      }
    },
    [data, onItemSelect],
  );

  const allSelected = data.length > 0 && selectedItems.size === data.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < data.length;

  return (
    <div className={`management-page-template ${className}`}>
      <div className="management-header bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
            </div>

            {actions.length > 0 && (
              <div className="flex items-center space-x-3">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`
                      flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-offset-2
                      ${
                        action.variant === "primary"
                          ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                          : action.variant === "danger"
                            ? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {action.icon && <action.icon className="w-4 h-4 mr-2" />}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center space-x-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="
                    w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  "
                />
              </div>
            </div>

            {filters.length > 0 && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`
                  flex items-center px-3 py-2 text-sm font-medium rounded-md border
                  ${
                    showFilters || Object.keys(activeFilters).length > 0
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                <FunnelIcon className="w-4 h-4 mr-2" />
                Filters
                {Object.keys(activeFilters).length > 0 && (
                  <span className="ml-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {Object.keys(activeFilters).length}
                  </span>
                )}
              </button>
            )}
          </div>

          {showFilters && filters.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filters.map((filter) => (
                  <div key={filter.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {filter.label}
                    </label>
                    <select
                      value={activeFilters[filter.key] || ""}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="
                        w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                      "
                    >
                      <option value="">All</option>
                      {filter.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="management-content flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-lg font-medium">{emptyMessage}</p>
            <p className="text-sm mt-2">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {selectable && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300"
                      />
                    </th>
                  )}
                  {columns.map((column) => (
                    <th
                      key={String(column.key)}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {column.sortable ? (
                        <button
                          onClick={() => handleSort(column.key)}
                          className="flex items-center space-x-1 hover:text-gray-700"
                        >
                          <span>{column.label}</span>
                          {sortConfig?.key === column.key && (
                            <span className="text-blue-600">
                              {sortConfig.direction === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((item, index) => (
                  <tr
                    key={index}
                    className={`
                      ${onItemClick ? "cursor-pointer hover:bg-gray-50" : ""}
                      ${selectedItems.has(item) ? "bg-blue-50" : ""}
                    `}
                    onClick={() => onItemClick?.(item)}
                  >
                    {selectable && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleItemSelect(item, e.target.checked);
                          }}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      >
                        {column.render
                          ? column.render(item[column.key], item)
                          : String(item[column.key] || "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
