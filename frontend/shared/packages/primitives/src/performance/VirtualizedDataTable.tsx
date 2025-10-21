/**
 * Virtualized Data Table
 * High-performance table for large datasets with lazy loading
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { FixedSizeList as List, VariableSizeList } from "react-window";
import { Card, Button, Input, Select, Checkbox, Skeleton } from "@dotmac/primitives";
import { Search, ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react";

export interface VirtualizedColumn {
  key: string;
  label: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  render?: (value: any, row: any, index: number) => React.ReactNode;
  formatter?: (value: any) => string;
  sticky?: boolean;
}

export interface VirtualizedDataTableProps {
  data: any[];
  columns: VirtualizedColumn[];
  height?: number;
  rowHeight?: number | ((index: number) => number);
  onSort?: (columnKey: string, direction: "asc" | "desc") => void;
  onRowClick?: (row: any, index: number) => void;
  onSelectionChange?: (selectedRows: any[]) => void;
  loading?: boolean;
  loadMore?: () => void;
  hasNextPage?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  selectable?: boolean;
  stickyHeader?: boolean;
  overscan?: number;
  className?: string;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    rows: any[];
    columns: VirtualizedColumn[];
    selectedRows: Set<string>;
    onRowClick?: (row: any, index: number) => void;
    onRowSelect?: (row: any, selected: boolean) => void;
    selectable?: boolean;
  };
}

// Virtualized row component
function VirtualizedRow({ index, style, data }: RowProps) {
  const { rows, columns, selectedRows, onRowClick, onRowSelect, selectable } = data;
  const row = rows[index];
  const isSelected = selectedRows.has(row.id);

  const handleRowClick = useCallback(() => {
    onRowClick?.(row, index);
  }, [row, index, onRowClick]);

  const handleSelectChange = useCallback(
    (checked: boolean) => {
      onRowSelect?.(row, checked);
    },
    [row, onRowSelect],
  );

  return (
    <div
      style={style}
      className={`flex items-center border-b hover:bg-gray-50 transition-colors ${
        isSelected ? "bg-blue-50" : ""
      }`}
      onClick={handleRowClick}
    >
      {selectable && (
        <div className="flex items-center justify-center w-12 px-2">
          <Checkbox
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              handleSelectChange(e.target.checked);
            }}
          />
        </div>
      )}

      {columns.map((column) => (
        <div
          key={column.key}
          className={`flex items-center px-3 py-2 text-sm ${
            column.sticky ? "sticky left-0 bg-white border-r" : ""
          }`}
          style={{
            width: column.width,
            minWidth: column.minWidth || column.width,
            maxWidth: column.maxWidth || column.width,
          }}
        >
          {column.render
            ? column.render(row[column.key], row, index)
            : column.formatter
              ? column.formatter(row[column.key])
              : row[column.key]}
        </div>
      ))}
    </div>
  );
}

// Header component
function TableHeader({
  columns,
  sortConfig,
  onSort,
  selectable,
  selectedCount,
  totalCount,
  onSelectAll,
}: {
  columns: VirtualizedColumn[];
  sortConfig?: { key: string; direction: "asc" | "desc" };
  onSort?: (key: string) => void;
  selectable?: boolean;
  selectedCount: number;
  totalCount: number;
  onSelectAll?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
      {selectable && (
        <div className="flex items-center justify-center w-12 px-2">
          <Checkbox
            checked={selectedCount > 0}
            indeterminate={selectedCount > 0 && selectedCount < totalCount}
            onChange={(e) => onSelectAll?.(e.target.checked)}
          />
        </div>
      )}

      {columns.map((column) => (
        <div
          key={column.key}
          className={`flex items-center px-3 py-3 text-sm font-medium text-gray-700 ${
            column.sticky ? "sticky left-0 bg-gray-50 border-r" : ""
          } ${column.sortable ? "cursor-pointer hover:bg-gray-100" : ""}`}
          style={{
            width: column.width,
            minWidth: column.minWidth || column.width,
            maxWidth: column.maxWidth || column.width,
          }}
          onClick={() => column.sortable && onSort?.(column.key)}
        >
          <span>{column.label}</span>
          {column.sortable && sortConfig?.key === column.key && (
            <span className="ml-1">
              {sortConfig.direction === "asc" ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function VirtualizedDataTable({
  data,
  columns,
  height = 600,
  rowHeight = 48,
  onSort,
  onRowClick,
  onSelectionChange,
  loading = false,
  loadMore,
  hasNextPage = false,
  searchValue = "",
  onSearchChange,
  selectable = false,
  stickyHeader = true,
  overscan = 5,
  className = "",
}: VirtualizedDataTableProps) {
  const [sortConfig, setSortConfig] = useState<
    { key: string; direction: "asc" | "desc" } | undefined
  >();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const listRef = useRef<List>(null);

  // Calculate total table width
  const totalWidth = useMemo(() => {
    const columnsWidth = columns.reduce((sum, col) => sum + col.width, 0);
    return columnsWidth + (selectable ? 48 : 0);
  }, [columns, selectable]);

  // Handle sorting
  const handleSort = useCallback(
    (columnKey: string) => {
      const newDirection =
        sortConfig?.key === columnKey && sortConfig.direction === "asc" ? "desc" : "asc";

      setSortConfig({ key: columnKey, direction: newDirection });
      onSort?.(columnKey, newDirection);
    },
    [sortConfig, onSort],
  );

  // Handle row selection
  const handleRowSelect = useCallback(
    (row: any, selected: boolean) => {
      const newSelected = new Set(selectedRows);

      if (selected) {
        newSelected.add(row.id);
      } else {
        newSelected.delete(row.id);
      }

      setSelectedRows(newSelected);

      const selectedRowsData = data.filter((r) => newSelected.has(r.id));
      onSelectionChange?.(selectedRowsData);
    },
    [selectedRows, data, onSelectionChange],
  );

  // Handle select all
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allIds = new Set(data.map((row) => row.id));
        setSelectedRows(allIds);
        onSelectionChange?.(data);
      } else {
        setSelectedRows(new Set());
        onSelectionChange?.([]);
      }
    },
    [data, onSelectionChange],
  );

  // Load more data when scrolling near end
  const handleScroll = useCallback(
    (scrollOffset: number, scrollDirection: string) => {
      if (hasNextPage && loadMore && scrollDirection === "forward") {
        const scrollPercentage =
          scrollOffset / (data.length * (typeof rowHeight === "number" ? rowHeight : 48));
        if (scrollPercentage > 0.8) {
          loadMore();
        }
      }
    },
    [hasNextPage, loadMore, data.length, rowHeight],
  );

  // Reset selection when data changes
  useEffect(() => {
    setSelectedRows(new Set());
  }, [data]);

  const itemData = useMemo(
    () => ({
      rows: data,
      columns,
      selectedRows,
      onRowClick,
      onRowSelect: handleRowSelect,
      selectable,
    }),
    [data, columns, selectedRows, onRowClick, handleRowSelect, selectable],
  );

  if (loading && data.length === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Search and Controls */}
      {onSearchChange && (
        <div className="p-4 border-b">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {selectable && selectedRows.size > 0 && (
              <div className="text-sm text-gray-600">
                {selectedRows.size} of {data.length} selected
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div style={{ width: totalWidth, height: height }}>
        {/* Header */}
        {stickyHeader && (
          <TableHeader
            columns={columns}
            sortConfig={sortConfig}
            onSort={handleSort}
            selectable={selectable}
            selectedCount={selectedRows.size}
            totalCount={data.length}
            onSelectAll={handleSelectAll}
          />
        )}

        {/* Virtualized Rows */}
        <List
          ref={listRef}
          width={totalWidth}
          height={stickyHeader ? height - 56 : height} // Account for header
          itemCount={data.length}
          itemSize={typeof rowHeight === "number" ? rowHeight : 48}
          itemData={itemData}
          overscanCount={overscan}
          onScroll={({ scrollOffset, scrollDirection }) => {
            handleScroll(scrollOffset, scrollDirection);
          }}
        >
          {VirtualizedRow}
        </List>

        {/* Loading indicator for additional data */}
        {loading && data.length > 0 && (
          <div className="p-4 text-center border-t">
            <div className="text-sm text-gray-500">Loading more...</div>
          </div>
        )}

        {/* Load more button */}
        {hasNextPage && loadMore && !loading && (
          <div className="p-4 text-center border-t">
            <Button onClick={loadMore} variant="outline">
              Load More
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default VirtualizedDataTable;
