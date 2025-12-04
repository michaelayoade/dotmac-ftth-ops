/**
 * Interactive Chart Components for ISP Management Platform
 * Enhanced data visualizations with hover states, tooltips, and animations
 * Security-hardened with input validation and XSS protection
 */

"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { useRenderProfiler, createMemoizedSelector } from "../utils/performance";
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
const COLORS = {
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

// Chart gradients
const ChartGradients = () => (
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
);

// Security-hardened and accessible custom tooltip component (memoized)
const CustomTooltip: React.FC<CustomTooltipProps> = memo(
  ({ active, payload, label, formatter }) => {
    const tooltipId = useMemo(() => generateId("chart-tooltip"), []);

    if (!active || !payload || payload.length === 0) {
      return null;
    }

    // Sanitize label to prevent XSS
    const safeLabel = label ? sanitizeText(String(label)) : "";

    // Generate accessible description
    const accessibleDescription = useMemo(() => {
      const items = payload.map((entry) => {
        const name = entry.name ? sanitizeText(String(entry.name)) : "Unknown";
        const value = typeof entry.value === "number" ? entry.value : 0;
        return `${name}: ${value}`;
      });
      return `Chart data point ${safeLabel ? "for " + safeLabel : ""}: ${items.join(", ")}`;
    }, [payload, safeLabel]);

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
        {payload.map((entry, index) => {
          if (!entry || typeof entry.value === "undefined") {
            return null;
          }

          const safeName = entry.name ? sanitizeText(String(entry.name)) : "Unknown";
          const safeValue = typeof entry.value === "number" ? entry.value : 0;

          let displayValue: string;
          let displayName: string;

          if (formatter) {
            try {
              const [formattedValue, formattedName] = formatter(safeValue, safeName);
              displayValue = sanitizeText(String(formattedValue));
              displayName = sanitizeText(String(formattedName));
            } catch (error) {
              console.error("Tooltip formatter error:", error);
              displayValue = String(safeValue);
              displayName = safeName;
            }
          } else {
            displayValue = String(safeValue);
            displayName = safeName;
          }

          return (
            <div key={`tooltip-${index}`} className="flex items-center space-x-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color || "#666" }}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-600">{displayName}:</span>
              <span className="text-sm font-semibold text-gray-900">{displayValue}</span>
            </div>
          );
        })}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance optimization
    return (
      prevProps.active === nextProps.active &&
      prevProps.label === nextProps.label &&
      JSON.stringify(prevProps.payload) === JSON.stringify(nextProps.payload) &&
      prevProps.formatter === nextProps.formatter
    );
  },
);

// Revenue Trends Area Chart with security validation and accessibility (memoized)
export const RevenueChart: React.FC<RevenueChartProps> = memo(
  ({ data, height = 300, className, onDataPointClick }) => {
    // Performance profiling
    const { renderCount, getProfile } = useRenderProfiler("RevenueChart", {
      dataLength: data?.length,
      height,
      className,
    });

    // Accessibility hooks
    const prefersReducedMotion = useReducedMotion();
    const isScreenReader = useScreenReader();
    const chartId = useMemo(() => generateId("revenue-chart"), []);
    const descriptionId = useMemo(() => generateId("revenue-description"), []);
    const tableId = useMemo(() => generateId("revenue-table"), []);

    // Validate and sanitize input data
    const validatedData = useMemo(() => {
      try {
        return validateArray(revenueDataSchema, data);
      } catch (error) {
        console.error("RevenueChart data validation failed:", error);
        return [];
      }
    }, [data]);

    // Sanitize className
    const safeClassName = useMemo(() => {
      return validateClassName(className);
    }, [className]);

    // Generate accessible descriptions
    const chartDescription = useMemo(() => {
      return generateChartDescription("area", validatedData, "Revenue Trends");
    }, [validatedData]);

    const dataTableDescription = useMemo(() => {
      return generateDataTable(validatedData, ["month", "revenue", "target", "previousYear"]);
    }, [validatedData]);

    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    // Memoized event handlers for performance
    const handleMouseEnter = useCallback((...args: unknown[]) => {
      const index = typeof args[1] === "number" ? args[1] : null;
      if (index !== null) {
        setActiveIndex(index);
      }
    }, []);

    const handleMouseLeave = useCallback(() => {
      setActiveIndex(null);
    }, []);

    const handleDataPointClick = useCallback(
      (data: any, index: number) => {
        if (onDataPointClick && validatedData[index]) {
          onDataPointClick(validatedData[index], index);
        }
      },
      [onDataPointClick, validatedData],
    );

    // Custom formatter with error handling
    const tooltipFormatter = useCallback(
      (value: number | string, name: string): [string, string] => {
        try {
          const numValue = typeof value === "number" ? value : parseFloat(String(value));
          if (isNaN(numValue)) {
            return ["Invalid", name];
          }
          return [`$${numValue.toLocaleString()}`, name];
        } catch (error) {
          console.error("Revenue chart formatter error:", error);
          return ["Error", name];
        }
      },
      [],
    );

    // Handle empty or invalid data
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
        >
          {/* Screen reader accessible chart description */}
          <div id={descriptionId} className="sr-only">
            {chartDescription}
          </div>

          {/* Screen reader accessible data table alternative */}
          <div id={tableId} className="sr-only">
            <p>Data table alternative for screen readers:</p>
            <p>{dataTableDescription}</p>
          </div>

          {/* Visual chart for sighted users */}
          <div
            id={chartId}
            role={ARIA_ROLES.CHART}
            aria-labelledby={descriptionId}
            aria-describedby={tableId}
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
                <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
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
                />
                <Area
                  type="monotone"
                  dataKey="previousYear"
                  stroke={COLORS.secondary}
                  strokeWidth={2}
                  fill={COLORS.gradient.secondary}
                  name="Previous Year"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </ErrorBoundary>
    );
  },
  (prevProps, nextProps) => {
    // Deep comparison for chart data and props
    return (
      prevProps.height === nextProps.height &&
      prevProps.className === nextProps.className &&
      prevProps.onDataPointClick === nextProps.onDataPointClick &&
      JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
    );
  },
);

// Network Usage Bar Chart with security validation
export const NetworkUsageChart: React.FC<NetworkUsageChartProps> = ({
  data,
  height = 250,
  className,
  onDataPointClick,
}) => {
  // Validate and sanitize input data
  const validatedData = useMemo(() => {
    try {
      return validateArray(networkUsageDataSchema, data);
    } catch (error) {
      console.error("NetworkUsageChart data validation failed:", error);
      return [];
    }
  }, [data]);

  // Sanitize className
  const safeClassName = useMemo(() => {
    return validateClassName(className);
  }, [className]);

  const handleDataPointClick = useCallback(
    (data: any, index: number) => {
      if (onDataPointClick && validatedData[index]) {
        onDataPointClick(validatedData[index], index);
      }
    },
    [onDataPointClick, validatedData],
  );

  // Custom formatter with error handling
  const tooltipFormatter = useCallback((value: number | string, name: string): [string, string] => {
    try {
      const numValue = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(numValue)) {
        return ["Invalid", name];
      }
      return [`${numValue}GB`, name];
    } catch (error) {
      console.error("Network usage chart formatter error:", error);
      return ["Error", name];
    }
  }, []);

  // Handle empty or invalid data
  if (!validatedData || validatedData.length === 0) {
    return (
      <div
        className={`w-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${safeClassName}`}
        style={{ height }}
        role="img"
        aria-label="No network usage data available"
      >
        <p className="text-gray-500 text-sm">No network usage data available</p>
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
          <p className="text-red-600 text-sm">Network usage chart failed to load</p>
        </div>
      }
    >
      <div className={`w-full ${safeClassName}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={validatedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            onClick={handleDataPointClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="hour"
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
                  return isNaN(num) ? "0GB" : `${num}GB`;
                } catch {
                  return "0GB";
                }
              }}
            />
            <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
            <Legend />
            <Bar dataKey="download" fill={COLORS.primary} name="Download" radius={[2, 2, 0, 0]} />
            <Bar dataKey="upload" fill={COLORS.secondary} name="Upload" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ErrorBoundary>
  );
};

// Service Status Pie Chart with security validation
export const ServiceStatusChart: React.FC<ServiceStatusChartProps> = ({
  data,
  height = 250,
  className,
  onDataPointClick,
}) => {
  // Validate and sanitize input data
  const validatedData = useMemo(() => {
    try {
      return validateArray(serviceStatusDataSchema, data);
    } catch (error) {
      console.error("ServiceStatusChart data validation failed:", error);
      return [];
    }
  }, [data]);

  // Sanitize className
  const safeClassName = useMemo(() => {
    return validateClassName(className);
  }, [className]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "online":
        return COLORS.success;
      case "maintenance":
        return COLORS.warning;
      case "offline":
        return COLORS.danger;
      default:
        return COLORS.primary;
    }
  }, []);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Memoized event handlers
  const handleMouseEnter = useCallback((...args: unknown[]) => {
    const index = typeof args[1] === "number" ? args[1] : null;
    if (index !== null) {
      setActiveIndex(index);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const handleDataPointClick = useCallback(
    (data: any, index: number) => {
      if (onDataPointClick && validatedData[index]) {
        onDataPointClick(validatedData[index], index);
      }
    },
    [onDataPointClick, validatedData],
  );

  // Custom formatter with error handling
  const tooltipFormatter = useCallback((value: number | string, name: string): [string, string] => {
    try {
      const numValue = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(numValue)) {
        return ["Invalid", name];
      }
      return [`${numValue} services`, name];
    } catch (error) {
      console.error("Service status chart formatter error:", error);
      return ["Error", name];
    }
  }, []);

  // Handle empty or invalid data
  if (!validatedData || validatedData.length === 0) {
    return (
      <div
        className={`w-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${safeClassName}`}
        style={{ height }}
        role="img"
        aria-label="No service status data available"
      >
        <p className="text-gray-500 text-sm">No service status data available</p>
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
          <p className="text-red-600 text-sm">Service status chart failed to load</p>
        </div>
      }
    >
      <div className={`w-full ${safeClassName}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart onClick={handleDataPointClick}>
            <Pie
              data={validatedData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {validatedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getStatusColor(entry.status)}
                  stroke={index === activeIndex ? "#FFF" : "none"}
                  strokeWidth={index === activeIndex ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ErrorBoundary>
  );
};

// Bandwidth Utilization Line Chart with security validation
export const BandwidthChart: React.FC<BandwidthChartProps> = ({
  data,
  height = 200,
  className,
  onDataPointClick,
}) => {
  // Validate and sanitize input data
  const validatedData = useMemo(() => {
    try {
      return validateArray(bandwidthDataSchema, data);
    } catch (error) {
      console.error("BandwidthChart data validation failed:", error);
      return [];
    }
  }, [data]);

  // Sanitize className
  const safeClassName = useMemo(() => {
    return validateClassName(className);
  }, [className]);

  const handleDataPointClick = useCallback(
    (data: any, index: number) => {
      if (onDataPointClick && validatedData[index]) {
        onDataPointClick(validatedData[index], index);
      }
    },
    [onDataPointClick, validatedData],
  );

  // Custom formatter with error handling
  const tooltipFormatter = useCallback((value: number | string, name: string): [string, string] => {
    try {
      const numValue = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(numValue)) {
        return ["Invalid", name];
      }
      return [`${numValue}%`, name];
    } catch (error) {
      console.error("Bandwidth chart formatter error:", error);
      return ["Error", name];
    }
  }, []);

  // Handle empty or invalid data
  if (!validatedData || validatedData.length === 0) {
    return (
      <div
        className={`w-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${safeClassName}`}
        style={{ height }}
        role="img"
        aria-label="No bandwidth data available"
      >
        <p className="text-gray-500 text-sm">No bandwidth data available</p>
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
          <p className="text-red-600 text-sm">Bandwidth chart failed to load</p>
        </div>
      }
    >
      <div className={`w-full ${safeClassName}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={validatedData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            onClick={handleDataPointClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="time"
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
                  return isNaN(num) ? "0%" : `${num}%`;
                } catch {
                  return "0%";
                }
              }}
            />
            <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="utilization"
              stroke={COLORS.primary}
              strokeWidth={3}
              dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
              activeDot={{
                r: 6,
                stroke: COLORS.primary,
                strokeWidth: 2,
                fill: "#FFF",
              }}
              name="Bandwidth Utilization"
            />
            <Line
              type="monotone"
              dataKey="capacity"
              stroke={COLORS.danger}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Capacity Limit"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ErrorBoundary>
  );
};

// Components are already exported individually above
// Export utilities for external use
export { COLORS, ChartGradients };
