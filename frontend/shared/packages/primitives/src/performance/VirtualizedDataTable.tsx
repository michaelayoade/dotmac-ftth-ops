"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronUp } from "lucide-react";

// Define minimal components inline to avoid circular dependencies
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`border rounded-lg p-4 ${className}`}>{children}</div>;

const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export interface VirtualizedColumn<T = Record<string, unknown>> {
  key: keyof T | string;
  label: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  formatter?: (value: unknown) => string;
  align?: "left" | "center" | "right";
}

export interface VirtualizedDataTableProps<T = Record<string, unknown>> {
  data: T[];
  columns: VirtualizedColumn<T>[];
  height?: number;
  rowHeight?: number;
  onSort?: (columnKey: string, direction: "asc" | "desc") => void;
  onRowClick?: (row: T, index: number) => void;
  onSelectionChange?: (selectedRows: T[]) => void;
  loading?: boolean;
  loadMore?: () => void;
  hasNextPage?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  selectable?: boolean;
  className?: string;
  forwardedScrollRef?: React.RefObject<HTMLDivElement>;
}

export function VirtualizedDataTable<T = Record<string, unknown>>({
  data,
  columns,
  height = 480,
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
  className = "",
  forwardedScrollRef,
}: VirtualizedDataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = forwardedScrollRef ?? internalScrollRef;

  const totalWidth = useMemo(
    () => columns.reduce((sum, col) => sum + col.width, selectable ? 48 : 0),
    [columns, selectable],
  );

  const resolveRowKey = useCallback((row: T, index: number) => {
    if (row && typeof row === "object" && "id" in (row as Record<string, unknown>)) {
      const maybeId = (row as { id?: unknown }).id;
      if (typeof maybeId === "string" || typeof maybeId === "number") {
        return String(maybeId);
      }
    }
    return String(index);
  }, []);

  const handleSort = useCallback(
    (columnKey: string) => {
      const nextDirection =
        sortConfig?.key === columnKey && sortConfig.direction === "asc" ? "desc" : "asc";
      setSortConfig({ key: columnKey, direction: nextDirection });
      onSort?.(columnKey, nextDirection);
    },
    [sortConfig, onSort],
  );

  const handleRowSelection = useCallback(
    (row: T, index: number, selected: boolean) => {
      if (!onSelectionChange) return;
      const rowKey = resolveRowKey(row, index);
      const next = new Set(selectedKeys);
      if (selected) {
        next.add(rowKey);
      } else {
        next.delete(rowKey);
      }
      setSelectedKeys(next);
      const selectedData = data.filter((item, idx) => next.has(resolveRowKey(item, idx)));
      onSelectionChange(selectedData);
    },
    [data, onSelectionChange, resolveRowKey, selectedKeys],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!onSelectionChange) return;
      if (checked) {
        const allKeys = new Set(data.map(resolveRowKey));
        setSelectedKeys(allKeys);
        onSelectionChange(data);
      } else {
        setSelectedKeys(new Set());
        onSelectionChange([]);
      }
    },
    [data, onSelectionChange, resolveRowKey],
  );

  useEffect(() => {
    if (!loadMore || !hasNextPage) {
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => {
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - rowHeight) {
        loadMore();
      }
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, loadMore, rowHeight, scrollContainerRef]);

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
    <Card className={clsx("overflow-hidden", className)}>
      {onSearchChange && (
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search..."
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="overflow-auto"
        style={{ maxHeight: height }}
        role="grid"
        aria-rowcount={data.length}
      >
        <div style={{ minWidth: totalWidth }}>
          <div className="flex items-center border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
            {selectable ? (
              <div className="flex w-12 items-center justify-center">
                <input
                  type="checkbox"
                  checked={selectedKeys.size > 0 && selectedKeys.size === data.length}
                  onChange={(event) => handleSelectAll(event.target.checked)}
                  aria-label="Select all rows"
                />
              </div>
            ) : null}
            {columns.map((column) => {
              const isSorted = sortConfig?.key === column.key;
              return (
                <button
                  key={String(column.key)}
                  type="button"
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <span>{column.label}</span>
                  {column.sortable && (
                    <span className="text-xs text-gray-500">
                      {isSorted ? (
                        sortConfig?.direction === "asc" ? (
                          "↑"
                        ) : (
                          "↓"
                        )
                      ) : (
                        <ChevronUp className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {data.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">No data available</div>
          ) : (
            data.map((row, index) => {
              const rowKey = resolveRowKey(row, index);
              const isSelected = selectedKeys.has(rowKey);

              return (
                <div
                  key={rowKey}
                  className={clsx(
                    "flex items-center border-b border-gray-100 px-4 py-2 text-sm transition-colors",
                    isSelected ? "bg-blue-50" : "hover:bg-gray-50",
                  )}
                  role="row"
                  onClick={() => onRowClick?.(row, index)}
                >
                  {selectable ? (
                    <div className="flex w-12 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => handleRowSelection(row, index, event.target.checked)}
                        aria-label="Select row"
                      />
                    </div>
                  ) : null}
                  {columns.map((column) => {
                    const rawValue =
                      typeof column.key === "string"
                        ? (row as Record<string, unknown>)[column.key]
                        : (row as Record<string, unknown>)[String(column.key)];
                    const content = column.render
                      ? column.render(rawValue, row, index)
                      : column.formatter
                        ? column.formatter(rawValue)
                        : (rawValue as React.ReactNode);

                    return (
                      <div
                        key={`${rowKey}-${String(column.key)}`}
                        className="px-3 py-2"
                        style={{ width: column.width, textAlign: column.align ?? "left" }}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}

          {hasNextPage ? (
            <div className="flex justify-center border-t border-gray-100 px-4 py-3">
              {loading ? (
                <span className="text-sm text-gray-500">Loading more...</span>
              ) : loadMore ? (
                <button
                  type="button"
                  onClick={loadMore}
                  className="rounded border px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Load more
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default VirtualizedDataTable;
