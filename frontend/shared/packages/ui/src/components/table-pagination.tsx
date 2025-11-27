/**
 * Reusable Table Pagination component
 * Extracted from DataTable to support both client-side and server-side pagination
 */

"use client";

import * as React from "react";

import { cn } from "../lib/utils";

import { Button } from "./button";

export interface TablePaginationProps {
  /**
   * Current page index (0-based)
   */
  pageIndex: number;

  /**
   * Total number of pages
   */
  pageCount: number;

  /**
   * Current page size
   */
  pageSize: number;

  /**
   * Available page size options
   */
  pageSizeOptions?: number[];

  /**
   * Total number of items (optional, for display)
   */
  totalItems?: number;

  /**
   * Whether there's a next page available (for server-side pagination)
   */
  canNextPage?: boolean;

  /**
   * Whether there's a previous page available (for server-side pagination)
   */
  canPreviousPage?: boolean;

  /**
   * Callback when page changes
   */
  onPageChange: (pageIndex: number) => void;

  /**
   * Callback when page size changes
   */
  onPageSizeChange: (pageSize: number) => void;

  /**
   * Number of selected rows (optional)
   */
  selectedCount?: number;

  /**
   * Total filtered items (optional)
   */
  filteredCount?: number;

  /**
   * Additional className
   */
  className?: string;
}

export function TablePagination({
  pageIndex,
  pageCount,
  pageSize,
  pageSizeOptions = [10, 20, 30, 50, 100],
  totalItems,
  canNextPage,
  canPreviousPage,
  onPageChange,
  onPageSizeChange,
  selectedCount,
  filteredCount,
  className,
}: TablePaginationProps) {
  // Calculate pagination state
  const hasNext = canNextPage !== undefined ? canNextPage : pageIndex < pageCount - 1;
  const hasPrevious = canPreviousPage !== undefined ? canPreviousPage : pageIndex > 0;

  // Calculate displayed range
  const startItem = pageIndex * pageSize + 1;
  const endItem =
    totalItems !== undefined
      ? Math.min((pageIndex + 1) * pageSize, totalItems)
      : (pageIndex + 1) * pageSize;

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {/* Selection count */}
      <div className="text-sm text-muted-foreground">
        {selectedCount !== undefined && selectedCount > 0 ? (
          <span>
            {selectedCount} of {filteredCount ?? totalItems ?? "many"} row(s) selected
          </span>
        ) : totalItems !== undefined ? (
          <span>
            Showing {startItem} to {endItem} of {totalItems} results
          </span>
        ) : (
          <span>
            Page {pageIndex + 1} of {pageCount}
          </span>
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center space-x-6 lg:space-x-8">
        {/* Page size selector */}
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-foreground">Rows per page</p>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
            }}
            className="h-8 w-[70px] rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            aria-label="Select page size"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Page indicator */}
        <div className="flex w-[100px] items-center justify-center text-sm font-medium text-foreground">
          Page {pageIndex + 1} of {pageCount}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={!hasPrevious}
            aria-label="Go to previous page"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!hasNext}
            aria-label="Go to next page"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing pagination state
 */
export function usePagination(defaultPageSize: number = 10) {
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  const offset = pageIndex * pageSize;

  const handlePageChange = React.useCallback((newPageIndex: number) => {
    setPageIndex(newPageIndex);
  }, []);

  const handlePageSizeChange = React.useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0); // Reset to first page when changing page size
  }, []);

  const resetPagination = React.useCallback(() => {
    setPageIndex(0);
  }, []);

  return {
    pageIndex,
    pageSize,
    offset,
    limit: pageSize,
    onPageChange: handlePageChange,
    onPageSizeChange: handlePageSizeChange,
    resetPagination,
  };
}
