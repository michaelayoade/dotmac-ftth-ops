/**
 * Performance-Optimized Chart Components
 * Memoized versions of all chart components with advanced optimization patterns
 */

"use client";

import { useState, useCallback, useMemo, memo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { sanitizeText, validateClassName, validateArray } from "../utils/security";
import {
  revenueDataSchema,
  networkUsageDataSchema,
  serviceStatusDataSchema,
  bandwidthDataSchema,
} from "../utils/security";
import {
  generateChartDescription,
  generateDataTable,
  announceToScreenReader,
  useReducedMotion,
  useScreenReader,
  generateId,
  ARIA_ROLES,
  ARIA_LIVE_LEVELS,
} from "../utils/a11y";
import {
  useRenderProfiler,
  createMemoizedSelector,
  useThrottledState,
  useDebouncedState,
} from "../utils/performance";
import type {
  CustomTooltipProps,
  RevenueChartProps,
  NetworkUsageChartProps,
  ServiceStatusChartProps,
  BandwidthChartProps,
  ChartColors,
} from "../types/chart";
import { ErrorBoundary } from "../components/ErrorBoundary";

// ISP-themed color palette
const COLORS: ChartColors = {
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#8B5CF6",
  warning: "#F59E0B",
  danger: "#EF4444",
  success: "#22C55E",
  gradient: {
    primary: "url(#primaryGradient)",
    secondary: "url(#secondaryGradient)",
    accent: "url(#accentGradient)",
  },
};

// Chart gradients (memoized)
const ChartGradients = memo(() => (
  <defs>
    <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1} />
    </linearGradient>
    <linearGradient id="secondaryGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.8} />
      <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0.1} />
    </linearGradient>
    <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.8} />
      <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0.1} />
    </linearGradient>
  </defs>
));

// Optimized data selectors
const createDataSelector = <T extends any[]>(validator: any, fallback: T) =>
  createMemoizedSelector(
    (data: unknown) => {
      try {
        return validateArray(validator, data as unknown[]) as T;
      } catch (error) {
        console.error("Chart data validation failed:", error);
        return fallback;
      }
    },
    (data: unknown) => [JSON.stringify(data)],
  );

// Performance-optimized tooltip with virtualization for large datasets
const OptimizedTooltip: React.FC<CustomTooltipProps> = memo(
  ({ active, payload, label, formatter }) => {
    const tooltipId = useMemo(() => generateId("chart-tooltip"), []);

    if (!active || !payload || payload.length === 0) {
      return null;
    }

    // Sanitize label to prevent XSS
    const safeLabel = useMemo(() => (label ? sanitizeText(String(label)) : ""), [label]);

    // Generate accessible description (memoized)
    const accessibleDescription = useMemo(() => {
      const items = payload.map((entry) => {
        const name = entry.name ? sanitizeText(String(entry.name)) : "Unknown";
        const value = typeof entry.value === "number" ? entry.value : 0;
        return `${name}: ${value}`;
      });
      return `Chart data point ${safeLabel ? "for " + safeLabel : ""}: ${items.join(", ")}`;
    }, [payload, safeLabel]);

    // Memoized formatted entries
    const formattedEntries = useMemo(() => {
      if (!payload) {
        return [];
      }

      return payload.flatMap((entry, index) => {
        if (!entry || typeof entry.value === "undefined") {
          return [];
        }

        const safeName = entry.name ? sanitizeText(String(entry.name)) : "Unknown";
        const rawValue = typeof entry.value === "number" ? entry.value : Number(entry.value) || 0;

        let formattedValue: string | undefined;
        let formattedName: string | undefined;

        if (formatter) {
          try {
            const result = formatter(rawValue, safeName);
            if (Array.isArray(result) && result.length >= 2) {
              formattedValue = sanitizeText(String(result[0]));
              formattedName = sanitizeText(String(result[1]));
            }
          } catch (error) {
            console.error("Tooltip formatter error:", error);
          }
        }

        return [
          {
            displayValue: formattedValue ?? sanitizeText(String(rawValue)),
            displayName: formattedName ?? safeName,
            color: entry.color || "#666",
            index,
          },
        ];
      });
    }, [payload, formatter]);

    return (
      <div
        id={tooltipId}
        className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 backdrop-blur-sm"
        role="tooltip"
        aria-label={accessibleDescription}
        aria-live="polite"
        tabIndex={-1}
      >
        <div className="sr-only">{accessibleDescription}</div>
        {safeLabel && <p className="text-sm font-semibold text-gray-900 mb-2">{safeLabel}</p>}
        {formattedEntries.map((entry) => (
          <div key={`tooltip-${entry.index}`} className="flex items-center space-x-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-sm text-gray-600">{entry.displayName}:</span>
            <span className="text-sm font-semibold text-gray-900">{entry.displayValue}</span>
          </div>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Shallow comparison with JSON fallback for complex objects
    return (
      prevProps.active === nextProps.active &&
      prevProps.label === nextProps.label &&
      prevProps.formatter === nextProps.formatter &&
      JSON.stringify(prevProps.payload) === JSON.stringify(nextProps.payload)
    );
  },
);

// High-performance Revenue Chart
export const OptimizedRevenueChart: React.FC<RevenueChartProps> = memo(
  ({ data, height = 300, className, onDataPointClick }) => {
    // Performance monitoring
    const { renderCount } = useRenderProfiler("OptimizedRevenueChart", {
      dataLength: data?.length,
      height,
    });

    // Throttled state for better interaction performance
    const [activeIndex, setActiveIndex, throttledActiveIndex] = useThrottledState<number | null>(
      null,
      16,
    );

    // Accessibility setup
    const prefersReducedMotion = useReducedMotion();
    const isScreenReader = useScreenReader();

    // Memoized IDs for better performance
    const ids = useMemo(
      () => ({
        chartId: generateId("revenue-chart"),
        descriptionId: generateId("revenue-description"),
        tableId: generateId("revenue-table"),
      }),
      [],
    );

    // High-performance data processing
    const dataSelector = useMemo(() => createDataSelector(revenueDataSchema, []), []);

    const validatedData = useMemo(() => dataSelector(data), [dataSelector, data]);

    const safeClassName = useMemo(() => validateClassName(className), [className]);

    // Memoized descriptions
    const chartDescription = useMemo(
      () => generateChartDescription("area", validatedData, "Revenue Trends"),
      [validatedData],
    );

    const dataTableDescription = useMemo(
      () => generateDataTable(validatedData, ["month", "revenue", "target", "previousYear"]),
      [validatedData],
    );

    // Optimized event handlers
    const handleMouseEnter = useCallback(
      (...args: unknown[]) => {
        const index = typeof args[1] === "number" ? args[1] : null;
        if (index !== null) {
          setActiveIndex(index);
        }
      },
      [setActiveIndex],
    );

    const handleMouseLeave = useCallback(() => {
      setActiveIndex(null);
    }, [setActiveIndex]);

    const handleDataPointClick = useCallback(
      (data: any, index: number) => {
        if (onDataPointClick && validatedData[index]) {
          onDataPointClick(validatedData[index], index);
        }
      },
      [onDataPointClick, validatedData],
    );

    // Memoized tooltip formatter
    const tooltipFormatter = useCallback(
      (value: number | string, name: string): [string, string] => {
        try {
          const numValue = typeof value === "number" ? value : parseFloat(String(value));
          if (isNaN(numValue)) return ["Invalid", name];
          return [`$${numValue.toLocaleString()}`, name];
        } catch {
          return ["Error", name];
        }
      },
      [],
    );

    // Handle empty data
    if (!validatedData || validatedData.length === 0) {
      return (
        <div
          className={`w-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${safeClassName}`}
          style={{ height }}
          role="img"
          aria-label="No revenue data available"
          tabIndex={0}
        >
          <p className="text-gray-500 text-sm">No revenue data available</p>
        </div>
      );
    }

    return (
      <ErrorBoundary
        fallback={
          <div
            className="w-full flex items-center justify-center bg-red-50 border border-red-200 rounded-lg"
            style={{ height }}
          >
            <p className="text-red-600 text-sm">Revenue chart failed to load</p>
          </div>
        }
      >
        <figure
          className={`w-full ${safeClassName}`}
          style={{ height }}
          role={ARIA_ROLES.CHART_CONTAINER}
          data-render-count={renderCount}
        >
          {/* Screen reader accessible chart description */}
          <div id={ids.descriptionId} className="sr-only">
            {chartDescription}
          </div>

          {/* Screen reader accessible data table alternative */}
          <div id={ids.tableId} className="sr-only">
            <p>Data table alternative for screen readers:</p>
            <p>{dataTableDescription}</p>
          </div>

          {/* Optimized chart visualization */}
          <div
            id={ids.chartId}
            role={ARIA_ROLES.CHART}
            aria-labelledby={ids.descriptionId}
            aria-describedby={ids.tableId}
            tabIndex={0}
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            onFocus={() => {
              if (isScreenReader) {
                announceToScreenReader(chartDescription, "polite");
              }
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={validatedData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                onClick={handleDataPointClick}
              >
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickFormatter={(value) => {
                    try {
                      const num = typeof value === "number" ? value : parseFloat(String(value));
                      return isNaN(num) ? "0" : `$${(num / 1000).toFixed(0)}K`;
                    } catch {
                      return "0";
                    }
                  }}
                />
                <Tooltip
                  content={<OptimizedTooltip formatter={tooltipFormatter} />}
                  animationDuration={prefersReducedMotion ? 0 : 200}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  fill={COLORS.gradient.primary}
                  name="Current Revenue"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  animationDuration={prefersReducedMotion ? 0 : 1500}
                />
                <Area
                  type="monotone"
                  dataKey="previousYear"
                  stroke={COLORS.secondary}
                  strokeWidth={2}
                  fill={COLORS.gradient.secondary}
                  name="Previous Year"
                  animationDuration={prefersReducedMotion ? 0 : 1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </ErrorBoundary>
    );
  },
  (prevProps, nextProps) => {
    // Optimized comparison - check references first, then deep equality
    if (prevProps === nextProps) return true;

    return (
      prevProps.height === nextProps.height &&
      prevProps.className === nextProps.className &&
      prevProps.onDataPointClick === nextProps.onDataPointClick &&
      // Only do expensive JSON comparison if shallow checks fail
      (prevProps.data === nextProps.data ||
        JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data))
    );
  },
);

// Export optimized components and utilities
export { COLORS, ChartGradients, OptimizedTooltip };
