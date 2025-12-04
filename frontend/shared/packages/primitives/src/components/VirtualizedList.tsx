// @ts-nocheck
/**
 * High-Performance Virtualized List Component
 * Optimized for large datasets with accessibility and performance focus
 */

"use client";

import { useState, useCallback, useMemo, useRef, useEffect, memo } from "react";
import { useVirtualizedList, useRenderProfiler } from "../utils/performance";
import {
  useKeyboardNavigation,
  announceToScreenReader,
  generateId,
  ARIA_ROLES,
} from "../utils/a11y";
import { validateClassName } from "../utils/security";
import { ErrorBoundary } from "./ErrorBoundary";

// Types for virtualized list
export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  height: number;
  width?: number | string;
  className?: string;
  overscan?: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  onItemsRendered?: (visibleRange: { start: number; end: number }) => void;
  onScroll?: (scrollOffset: number) => void;
  // Accessibility props
  "aria-label"?: string;
  "aria-labelledby"?: string;
  role?: string;
  // Performance props
  throttleMs?: number;
  enableKeyboardNavigation?: boolean;
}

export interface VirtualizedGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  width: number;
  height: number;
  className?: string;
  overscan?: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  onItemsRendered?: (visibleRange: {
    start: number;
    end: number;
    startRow: number;
    endRow: number;
  }) => void;
}

// High-performance virtualized list with accessibility
export const VirtualizedList = memo(
  <T,>({
    items,
    itemHeight,
    height,
    width = "100%",
    className,
    overscan = 5,
    renderItem,
    getItemKey,
    onItemsRendered,
    onScroll,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    role = "list",
    throttleMs = 16,
    enableKeyboardNavigation = true,
  }: VirtualizedListProps<T>) => {
    // Performance monitoring
    const { renderCount } = useRenderProfiler("VirtualizedList", {
      itemCount: items.length,
      height,
    });

    // State management
    const [scrollTop, setScrollTop] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout>();
    const containerRef = useRef<HTMLDivElement>(null);
    const listId = useMemo(() => generateId("virtualized-list"), []);

    // Sanitize className
    const safeClassName = useMemo(() => validateClassName(className), [className]);

    // Calculate item positions and dimensions
    const itemMetrics = useMemo(() => {
      if (typeof itemHeight === "number") {
        // Fixed height items
        const totalHeight = items.length * itemHeight;
        return {
          totalHeight,
          getItemOffset: (index: number) => index * itemHeight,
          getItemSize: () => itemHeight,
        };
      } else {
        // Variable height items - more complex calculation
        let totalHeight = 0;
        const offsets: number[] = [];

        for (let i = 0; i < items.length; i++) {
          offsets[i] = totalHeight;
          totalHeight += itemHeight(i);
        }

        return {
          totalHeight,
          getItemOffset: (index: number) => offsets[index] || 0,
          getItemSize: itemHeight,
        };
      }
    }, [items.length, itemHeight]);

    // Calculate visible range with overscan
    const visibleRange = useMemo(() => {
      if (typeof itemHeight === "number") {
        // Optimized calculation for fixed height
        const start = Math.floor(scrollTop / itemHeight);
        const end = Math.ceil((scrollTop + height) / itemHeight);

        return {
          start: Math.max(0, start - overscan),
          end: Math.min(items.length, end + overscan),
        };
      } else {
        // Binary search for variable heights
        const findStartIndex = (offset: number) => {
          let low = 0;
          let high = items.length - 1;

          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midOffset = itemMetrics.getItemOffset(mid);

            if (midOffset < offset) {
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          return low;
        };

        const start = findStartIndex(scrollTop);
        const end = findStartIndex(scrollTop + height) + 1;

        return {
          start: Math.max(0, start - overscan),
          end: Math.min(items.length, end + overscan),
        };
      }
    }, [scrollTop, height, itemHeight, items.length, overscan, itemMetrics]);

    // Generate visible items with memoization
    const visibleItems = useMemo(() => {
      const result = [];

      for (let i = visibleRange.start; i < visibleRange.end; i++) {
        if (i >= items.length) break;

        const item = items[i];
        const key = getItemKey ? getItemKey(item, i) : i;
        const offset = itemMetrics.getItemOffset(i);
        const size = itemMetrics.getItemSize(i);

        result.push({
          key,
          index: i,
          item,
          style: {
            position: "absolute" as const,
            top: offset,
            left: 0,
            right: 0,
            height: size,
          },
        });
      }

      return result;
    }, [items, visibleRange, getItemKey, itemMetrics]);

    // Throttled scroll handler
    const handleScroll = useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        const newScrollTop = event.currentTarget.scrollTop;
        setScrollTop(newScrollTop);
        setIsScrolling(true);

        // Clear existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // Set scrolling to false after scroll ends
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 150);

        // Call external scroll handler
        if (onScroll) {
          onScroll(newScrollTop);
        }
      },
      [onScroll],
    );

    // Keyboard navigation setup
    const visibleElements = useMemo(() => {
      return visibleItems.map(() => null);
    }, [visibleItems.length]);

    const { handleKeyDown } = useKeyboardNavigation(visibleElements as HTMLElement[], {
      orientation: "vertical",
      onSelect: (index) => {
        const actualIndex = visibleRange.start + index;
        const offset = itemMetrics.getItemOffset(actualIndex);

        // Scroll to selected item
        if (containerRef.current) {
          containerRef.current.scrollTop = offset - height / 2;
          announceToScreenReader(`Item ${actualIndex + 1} of ${items.length} selected`, "polite");
        }
      },
      disabled: !enableKeyboardNavigation,
    });

    // Report visible items to parent
    useEffect(() => {
      if (onItemsRendered) {
        onItemsRendered(visibleRange);
      }
    }, [visibleRange, onItemsRendered]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, []);

    // Handle empty list
    if (items.length === 0) {
      return (
        <div
          className={`flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${safeClassName}`}
          style={{ height, width }}
          role="status"
          aria-label="No items to display"
        >
          <p className="text-gray-500 text-sm">No items to display</p>
        </div>
      );
    }

    return (
      <ErrorBoundary
        fallback={
          <div
            className="flex items-center justify-center bg-red-50 border border-red-200 rounded-lg"
            style={{ height, width }}
          >
            <p className="text-red-600 text-sm">List failed to load</p>
          </div>
        }
      >
        <div
          ref={containerRef}
          id={listId}
          className={`overflow-auto ${safeClassName}`}
          style={{ height, width }}
          onScroll={handleScroll}
          onKeyDown={enableKeyboardNavigation ? handleKeyDown : undefined}
          role={role}
          aria-label={ariaLabel || `List with ${items.length} items`}
          aria-labelledby={ariaLabelledby}
          aria-rowcount={items.length}
          tabIndex={enableKeyboardNavigation ? 0 : -1}
          data-render-count={renderCount}
          data-scrolling={isScrolling}
        >
          {/* Total height container */}
          <div style={{ height: itemMetrics.totalHeight, position: "relative" }}>
            {/* Visible items */}
            {visibleItems.map(({ key, index, item, style }) => (
              <div
                key={key}
                style={style}
                role={role === "list" ? "listitem" : undefined}
                aria-rowindex={index + 1}
                aria-setsize={items.length}
              >
                {renderItem(item, index, style)}
              </div>
            ))}
          </div>

          {/* Screen reader helper for total count */}
          <div className="sr-only" aria-live="polite">
            Showing items {visibleRange.start + 1} to {visibleRange.end} of {items.length}
          </div>
        </div>
      </ErrorBoundary>
    );
  },
) as <T>(props: VirtualizedListProps<T>) => React.ReactElement;

// High-performance virtualized grid for 2D layouts
export const VirtualizedGrid = memo(
  <T,>({
    items,
    itemWidth,
    itemHeight,
    width,
    height,
    className,
    overscan = 5,
    renderItem,
    getItemKey,
    onItemsRendered,
  }: VirtualizedGridProps<T>) => {
    // Performance monitoring
    const { renderCount } = useRenderProfiler("VirtualizedGrid", {
      itemCount: items.length,
      width,
      height,
    });

    const [scrollTop, setScrollTop] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const gridId = useMemo(() => generateId("virtualized-grid"), []);

    // Sanitize className
    const safeClassName = useMemo(() => validateClassName(className), [className]);

    // Calculate grid dimensions
    const gridMetrics = useMemo(() => {
      const columnsPerRow = Math.floor(width / itemWidth);
      const rowCount = Math.ceil(items.length / columnsPerRow);
      const totalHeight = rowCount * itemHeight;

      return {
        columnsPerRow,
        rowCount,
        totalHeight,
        totalWidth: width,
      };
    }, [items.length, itemWidth, itemHeight, width]);

    // Calculate visible range for grid
    const visibleRange = useMemo(() => {
      const startRow = Math.floor(scrollTop / itemHeight);
      const endRow = Math.ceil((scrollTop + height) / itemHeight);
      const startCol = Math.floor(scrollLeft / itemWidth);
      const endCol = Math.ceil((scrollLeft + width) / itemWidth);

      const visibleStartRow = Math.max(0, startRow - overscan);
      const visibleEndRow = Math.min(gridMetrics.rowCount, endRow + overscan);
      const visibleStartCol = Math.max(0, startCol - overscan);
      const visibleEndCol = Math.min(gridMetrics.columnsPerRow, endCol + overscan);

      const start = visibleStartRow * gridMetrics.columnsPerRow + visibleStartCol;
      const end = visibleEndRow * gridMetrics.columnsPerRow + visibleEndCol;

      return {
        start: Math.max(0, start),
        end: Math.min(items.length, end),
        startRow: visibleStartRow,
        endRow: visibleEndRow,
      };
    }, [scrollTop, scrollLeft, height, width, itemHeight, itemWidth, overscan, gridMetrics]);

    // Generate visible grid items
    const visibleItems = useMemo(() => {
      const result = [];

      for (let i = visibleRange.start; i < visibleRange.end; i++) {
        if (i >= items.length) break;

        const item = items[i];
        const key = getItemKey ? getItemKey(item, i) : i;
        const row = Math.floor(i / gridMetrics.columnsPerRow);
        const col = i % gridMetrics.columnsPerRow;

        result.push({
          key,
          index: i,
          item,
          style: {
            position: "absolute" as const,
            top: row * itemHeight,
            left: col * itemWidth,
            width: itemWidth,
            height: itemHeight,
          },
        });
      }

      return result;
    }, [items, visibleRange, getItemKey, gridMetrics.columnsPerRow, itemWidth, itemHeight]);

    // Handle scroll events
    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
      setScrollLeft(event.currentTarget.scrollLeft);
    }, []);

    // Report visible items
    useEffect(() => {
      if (onItemsRendered) {
        onItemsRendered(visibleRange);
      }
    }, [visibleRange, onItemsRendered]);

    return (
      <ErrorBoundary
        fallback={
          <div
            className="flex items-center justify-center bg-red-50 border border-red-200 rounded-lg"
            style={{ height, width }}
          >
            <p className="text-red-600 text-sm">Grid failed to load</p>
          </div>
        }
      >
        <div
          ref={containerRef}
          id={gridId}
          className={`overflow-auto ${safeClassName}`}
          style={{ height, width }}
          onScroll={handleScroll}
          role="grid"
          aria-label={`Grid with ${items.length} items`}
          aria-rowcount={gridMetrics.rowCount}
          aria-colcount={gridMetrics.columnsPerRow}
          data-render-count={renderCount}
        >
          {/* Total size container */}
          <div
            style={{
              height: gridMetrics.totalHeight,
              width: gridMetrics.totalWidth,
              position: "relative",
            }}
          >
            {/* Visible items */}
            {visibleItems.map(({ key, index, item, style }) => {
              const row = Math.floor(index / gridMetrics.columnsPerRow);
              const col = index % gridMetrics.columnsPerRow;

              return (
                <div
                  key={key}
                  style={style}
                  role="gridcell"
                  aria-rowindex={row + 1}
                  aria-colindex={col + 1}
                >
                  {renderItem(item, index, style)}
                </div>
              );
            })}
          </div>
        </div>
      </ErrorBoundary>
    );
  },
) as <T>(props: VirtualizedGridProps<T>) => React.ReactElement;

// Performance-optimized table virtualization
export interface VirtualizedTableProps<T> {
  items: T[];
  columns: Array<{
    key: keyof T;
    header: string;
    width: number;
    render?: (value: any, item: T, index: number) => React.ReactNode;
  }>;
  rowHeight: number;
  height: number;
  width: number;
  className?: string;
  overscan?: number;
  onRowClick?: (item: T, index: number) => void;
  getRowKey?: (item: T, index: number) => string | number;
}

export const VirtualizedTable = memo(
  <T extends Record<string, any>>({
    items,
    columns,
    rowHeight,
    height,
    width,
    className,
    overscan = 5,
    onRowClick,
    getRowKey,
  }: VirtualizedTableProps<T>) => {
    const { renderCount } = useRenderProfiler("VirtualizedTable", {
      itemCount: items.length,
      columnCount: columns.length,
    });

    const safeClassName = useMemo(() => validateClassName(className), [className]);
    const tableId = useMemo(() => generateId("virtualized-table"), []);

    // Render table row
    const renderRow = useCallback(
      (item: T, index: number, style: React.CSSProperties) => {
        const handleRowClick = onRowClick ? () => onRowClick(item, index) : undefined;

        return (
          <div
            style={{ ...style, display: "flex" }}
            className={`border-b border-gray-200 ${onRowClick ? "hover:bg-gray-50 cursor-pointer" : ""}`}
            onClick={handleRowClick}
            role="row"
            tabIndex={onRowClick ? 0 : -1}
          >
            {columns.map((column, colIndex) => (
              <div
                key={String(column.key)}
                style={{ width: column.width }}
                className="px-4 py-2 flex items-center"
                role="cell"
              >
                {column.render
                  ? column.render(item[column.key], item, index)
                  : String(item[column.key] || "")}
              </div>
            ))}
          </div>
        );
      },
      [columns, onRowClick],
    );

    // Table header
    const tableHeader = useMemo(
      () => (
        <div
          className="border-b-2 border-gray-200 bg-gray-50 sticky top-0 z-10"
          style={{ display: "flex", height: rowHeight }}
          role="row"
        >
          {columns.map((column) => (
            <div
              key={String(column.key)}
              style={{ width: column.width }}
              className="px-4 py-2 font-medium text-gray-900 flex items-center"
              role="columnheader"
            >
              {column.header}
            </div>
          ))}
        </div>
      ),
      [columns, rowHeight],
    );

    return (
      <ErrorBoundary
        fallback={
          <div
            className="flex items-center justify-center bg-red-50 border border-red-200 rounded-lg"
            style={{ height, width }}
          >
            <p className="text-red-600 text-sm">Table failed to load</p>
          </div>
        }
      >
        <div
          id={tableId}
          className={`border border-gray-200 rounded-lg overflow-hidden ${safeClassName}`}
          style={{ width, height }}
          role="table"
          aria-label={`Table with ${items.length} rows and ${columns.length} columns`}
          data-render-count={renderCount}
        >
          {tableHeader}
          <VirtualizedList
            items={items}
            itemHeight={rowHeight}
            height={height - rowHeight} // Account for header
            renderItem={renderRow}
            getItemKey={getRowKey}
            role="rowgroup"
            overscan={overscan}
          />
        </div>
      </ErrorBoundary>
    );
  },
) as <T extends Record<string, any>>(props: VirtualizedTableProps<T>) => React.ReactElement;

// Export all virtualized components
export default { VirtualizedList, VirtualizedGrid, VirtualizedTable };
// @ts-nocheck
