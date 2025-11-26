/**
 * TableSkeleton Component
 *
 * Provides skeleton loading states for table components.
 * Matches the structure of data tables used throughout the platform.
 */

import React from "react";
import { clsx } from "clsx";

export interface TableSkeletonProps {
  /**
   * Number of columns
   * @default 5
   */
  columns?: number;

  /**
   * Number of rows
   * @default 5
   */
  rows?: number;

  /**
   * Show table header
   * @default true
   */
  showHeader?: boolean;

  /**
   * Show action column
   * @default true
   */
  showActions?: boolean;

  /**
   * Show checkbox column
   * @default false
   */
  showCheckbox?: boolean;

  /**
   * Show pagination
   * @default true
   */
  showPagination?: boolean;

  /**
   * Show search bar
   * @default true
   */
  showSearch?: boolean;

  /**
   * Show filters
   * @default false
   */
  showFilters?: boolean;

  /**
   * Variant for different table styles
   * @default "default"
   */
  variant?: "default" | "compact" | "detailed";

  /**
   * Custom className for container
   */
  className?: string;
}

/**
 * Base skeleton box component
 */
function SkeletonBox({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("bg-gray-200 dark:bg-gray-700 rounded animate-pulse", className)}
      {...props}
    />
  );
}

/**
 * Table cell skeleton
 */
function TableCellSkeleton({
  width = "w-full",
  height = "h-4",
}: {
  width?: string;
  height?: string;
}) {
  return <SkeletonBox className={clsx(height, width)} />;
}

/**
 * Table row skeleton
 */
function TableRowSkeleton({
  columns,
  showActions,
  showCheckbox,
  variant,
}: {
  columns: number;
  showActions: boolean;
  showCheckbox: boolean;
  variant: string;
}) {
  const cellHeight = variant === "compact" ? "h-3" : "h-4";
  const padding = variant === "compact" ? "p-2" : "p-4";

  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {showCheckbox && (
        <td className={clsx(padding, "w-12")}>
          <SkeletonBox className="h-4 w-4 rounded" />
        </td>
      )}
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className={padding}>
          <TableCellSkeleton height={cellHeight} width={i === 0 ? "w-3/4" : "w-full"} />
        </td>
      ))}
      {showActions && (
        <td className={clsx(padding, "w-24")}>
          <div className="flex gap-2">
            <SkeletonBox className="h-8 w-8 rounded" />
            <SkeletonBox className="h-8 w-8 rounded" />
          </div>
        </td>
      )}
    </tr>
  );
}

/**
 * Table header skeleton
 */
function TableHeaderSkeleton({
  columns,
  showActions,
  showCheckbox,
}: {
  columns: number;
  showActions: boolean;
  showCheckbox: boolean;
}) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-800">
      <tr>
        {showCheckbox && (
          <th className="p-4 w-12">
            <SkeletonBox className="h-4 w-4 rounded" />
          </th>
        )}
        {Array.from({ length: columns }).map((_, i) => (
          <th key={i} className="p-4 text-left">
            <SkeletonBox className="h-4 w-20" />
          </th>
        ))}
        {showActions && (
          <th className="p-4 w-24">
            <SkeletonBox className="h-4 w-16" />
          </th>
        )}
      </tr>
    </thead>
  );
}

/**
 * Table controls skeleton (search + filters)
 */
function TableControlsSkeleton({
  showSearch,
  showFilters,
}: {
  showSearch: boolean;
  showFilters: boolean;
}) {
  if (!showSearch && !showFilters) return null;

  return (
    <div className="flex items-center justify-between mb-4 gap-4">
      {showSearch && (
        <div className="flex-1 max-w-md">
          <SkeletonBox className="h-10 w-full" />
        </div>
      )}
      {showFilters && (
        <div className="flex gap-2">
          <SkeletonBox className="h-10 w-24" />
          <SkeletonBox className="h-10 w-24" />
          <SkeletonBox className="h-10 w-24" />
        </div>
      )}
    </div>
  );
}

/**
 * Table pagination skeleton
 */
function TablePaginationSkeleton() {
  return (
    <div className="flex items-center justify-between mt-4 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-4 w-32" />
      </div>
      <div className="flex gap-2">
        <SkeletonBox className="h-10 w-20" />
        <SkeletonBox className="h-10 w-10" />
        <SkeletonBox className="h-10 w-10" />
        <SkeletonBox className="h-10 w-10" />
        <SkeletonBox className="h-10 w-20" />
      </div>
    </div>
  );
}

/**
 * TableSkeleton Component
 *
 * @example
 * ```tsx
 * <TableSkeleton columns={5} rows={10} />
 * ```
 *
 * @example With all features
 * ```tsx
 * <TableSkeleton
 *   columns={7}
 *   rows={20}
 *   showCheckbox
 *   showActions
 *   showSearch
 *   showFilters
 * />
 * ```
 *
 * @example Compact variant
 * ```tsx
 * <TableSkeleton variant="compact" columns={4} rows={15} />
 * ```
 */
export function TableSkeleton({
  columns = 5,
  rows = 5,
  showHeader = true,
  showActions = true,
  showCheckbox = false,
  showPagination = true,
  showSearch = true,
  showFilters = false,
  variant = "default",
  className,
}: TableSkeletonProps) {
  return (
    <div className={clsx("bg-white dark:bg-gray-800 rounded-lg shadow", className)}>
      {/* Controls */}
      <div className="p-4">
        <TableControlsSkeleton showSearch={showSearch} showFilters={showFilters} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          {/* Header */}
          {showHeader && (
            <TableHeaderSkeleton
              columns={columns}
              showActions={showActions}
              showCheckbox={showCheckbox}
            />
          )}

          {/* Body */}
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton
                key={i}
                columns={columns}
                showActions={showActions}
                showCheckbox={showCheckbox}
                variant={variant}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && <TablePaginationSkeleton />}
    </div>
  );
}

/**
 * Preset table skeletons for common use cases
 */
export const TableSkeletons = {
  /**
   * Customer/Subscriber list table
   */
  CustomerList: () => (
    <TableSkeleton columns={6} rows={10} showCheckbox showActions showSearch showFilters />
  ),

  /**
   * Device list table
   */
  DeviceList: () => <TableSkeleton columns={5} rows={15} showActions showSearch />,

  /**
   * Compact list
   */
  Compact: () => (
    <TableSkeleton
      variant="compact"
      columns={4}
      rows={8}
      showActions={false}
      showPagination={false}
    />
  ),

  /**
   * Detailed table with all features
   */
  Detailed: () => (
    <TableSkeleton
      variant="detailed"
      columns={8}
      rows={20}
      showCheckbox
      showActions
      showSearch
      showFilters
    />
  ),

  /**
   * Simple table without controls
   */
  Simple: () => (
    <TableSkeleton
      columns={4}
      rows={5}
      showActions={false}
      showSearch={false}
      showPagination={false}
    />
  ),
};
