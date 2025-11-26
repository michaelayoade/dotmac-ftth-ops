/**
 * Universal Chart Component
 * Unified charting system supporting all chart types with consistent theming
 */

"use client";

import React, { useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Brush,
} from "recharts";
import { motion } from "framer-motion";
import { Download, Maximize2, RefreshCw } from "lucide-react";
import { cn } from "../utils/cn";

// Chart Type Definitions
export type ChartType = "line" | "area" | "bar" | "pie" | "donut" | "combo";

export interface ChartDataPoint {
  [key: string]: string | number | Date | null | undefined;
}

export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
  type?: "line" | "area" | "bar";
  yAxisId?: "left" | "right" | string;
  strokeWidth?: number;
  strokeDasharray?: string;
  fill?: string;
  stackId?: string;
}

// Variant-specific color palettes
export interface ChartVariant {
  admin: {
    primary: "#3B82F6";
    secondary: "#1E40AF";
    accent: "#60A5FA";
    success: "#10B981";
    warning: "#F59E0B";
    danger: "#EF4444";
    gradient: string[];
  };
  customer: {
    primary: "#10B981";
    secondary: "#047857";
    accent: "#34D399";
    success: "#22C55E";
    warning: "#F59E0B";
    danger: "#EF4444";
    gradient: string[];
  };
  reseller: {
    primary: "#8B5CF6";
    secondary: "#7C3AED";
    accent: "#A78BFA";
    success: "#10B981";
    warning: "#F59E0B";
    danger: "#EF4444";
    gradient: string[];
  };
  technician: {
    primary: "#EF4444";
    secondary: "#DC2626";
    accent: "#F87171";
    success: "#10B981";
    warning: "#F59E0B";
    danger: "#B91C1C";
    gradient: string[];
  };
  management: {
    primary: "#F97316";
    secondary: "#EA580C";
    accent: "#FB923C";
    success: "#10B981";
    warning: "#F59E0B";
    danger: "#EF4444";
    gradient: string[];
  };
}

export interface UniversalChartProps {
  // Data
  data: ChartDataPoint[];
  series: ChartSeries[];

  // Chart Configuration
  type: ChartType;
  variant?: keyof ChartVariant;

  // Dimensions
  width?: number | string;
  height?: number | string;
  aspectRatio?: number;

  // Axes Configuration
  xAxis?: {
    dataKey: string;
    label?: string;
    format?: (value: any) => string;
    hide?: boolean;
    angle?: number;
  };
  yAxis?: {
    left?: {
      label?: string;
      format?: (value: any) => string;
      hide?: boolean;
      domain?: [number | string, number | string];
    };
    right?: {
      label?: string;
      format?: (value: any) => string;
      hide?: boolean;
      domain?: [number | string, number | string];
    };
  };

  // Visual Options
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  showBrush?: boolean;
  smooth?: boolean;
  stacked?: boolean;

  // Interactivity
  onDataPointClick?: (data: any, series: string) => void;
  onLegendClick?: (series: string) => void;

  // Reference Lines
  referenceLines?: Array<{
    y?: number;
    x?: number | string;
    label?: string;
    color?: string;
    strokeDasharray?: string;
  }>;

  // Customization
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;

  // Actions
  actions?: Array<{
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  }>;

  // Layout
  className?: string;
  cardWrapper?: boolean;

  // Animation
  animationDuration?: number;
  animationEasing?: string;
}

const variantColors: ChartVariant = {
  admin: {
    primary: "#3B82F6",
    secondary: "#1E40AF",
    accent: "#60A5FA",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    gradient: ["#3B82F6", "#1E40AF", "#60A5FA", "#93C5FD", "#DBEAFE"],
  },
  customer: {
    primary: "#10B981",
    secondary: "#047857",
    accent: "#34D399",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    gradient: ["#10B981", "#047857", "#34D399", "#6EE7B7", "#D1FAE5"],
  },
  reseller: {
    primary: "#8B5CF6",
    secondary: "#7C3AED",
    accent: "#A78BFA",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    gradient: ["#8B5CF6", "#7C3AED", "#A78BFA", "#C4B5FD", "#E9D5FF"],
  },
  technician: {
    primary: "#EF4444",
    secondary: "#DC2626",
    accent: "#F87171",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#B91C1C",
    gradient: ["#EF4444", "#DC2626", "#F87171", "#FCA5A5", "#FEE2E2"],
  },
  management: {
    primary: "#F97316",
    secondary: "#EA580C",
    accent: "#FB923C",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    gradient: ["#F97316", "#EA580C", "#FB923C", "#FDBA74", "#FED7AA"],
  },
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, labelFormatter, valueFormatter }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
      <p className="font-medium text-gray-900 mb-2">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-sm text-gray-600">{entry.name}:</span>
          <span className="text-sm font-medium text-gray-900">
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Custom Legend Component
const CustomLegend = ({ payload, onLegendClick }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry: any, index: number) => (
        <button
          key={index}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
          onClick={() => onLegendClick?.(entry.dataKey)}
        >
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.value}</span>
        </button>
      ))}
    </div>
  );
};

export function UniversalChart({
  data,
  series,
  type,
  variant = "admin",
  width = "100%",
  height = 300,
  aspectRatio,
  xAxis,
  yAxis,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  showBrush = false,
  smooth = false,
  stacked = false,
  onDataPointClick,
  onLegendClick,
  referenceLines = [],
  title,
  subtitle,
  loading = false,
  error = null,
  actions = [],
  className = "",
  cardWrapper = true,
  animationDuration = 1500,
  animationEasing = "ease-in-out",
}: UniversalChartProps) {
  const colors = variantColors[variant];

  // Memoize chart colors for series
  const seriesWithColors = useMemo(() => {
    return series.map((s, index) => ({
      ...s,
      color: s.color || colors.gradient[index % colors.gradient.length],
    }));
  }, [series, colors]);

  // Format functions
  const formatXAxis = useCallback(
    (value: any) => {
      if (xAxis?.format) return xAxis.format(value);
      if (value instanceof Date) return value.toLocaleDateString();
      return value;
    },
    [xAxis],
  );

  const formatYAxis = useCallback(
    (value: any, axis: "left" | "right" = "left") => {
      const axisConfig = yAxis?.[axis];
      if (axisConfig?.format) return axisConfig.format(value);
      if (typeof value === "number") {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      }
      return value;
    },
    [yAxis],
  );

  // Render different chart types
  const renderChart = (): React.ReactElement | null => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    switch (type) {
      case "line": {
        const hasXAxisAngle = typeof xAxis?.angle === "number";
        const leftDomain = yAxis?.left?.domain;
        const rightDomain = yAxis?.right?.domain;

        return (
          <LineChart {...commonProps}>
            <defs>
              {seriesWithColors.map((s, index) => (
                <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            {!xAxis?.hide && (
              <XAxis
                dataKey={xAxis?.dataKey || "x"}
                tickFormatter={formatXAxis}
                textAnchor={hasXAxisAngle ? "end" : "middle"}
                height={hasXAxisAngle ? 60 : 30}
                {...(hasXAxisAngle ? { angle: xAxis?.angle as number } : {})}
              />
            )}
            {!yAxis?.left?.hide && (
              <YAxis
                yAxisId="left"
                tickFormatter={(value) => formatYAxis(value, "left")}
                {...(leftDomain ? { domain: leftDomain } : {})}
              />
            )}
            {yAxis?.right && !yAxis.right.hide && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => formatYAxis(value, "right")}
                {...(rightDomain ? { domain: rightDomain } : {})}
              />
            )}
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend content={<CustomLegend onLegendClick={onLegendClick} />} />}
            {seriesWithColors.map((s) => (
              <Line
                key={s.key}
                type={smooth ? "monotone" : "linear"}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={s.strokeWidth || 2}
                strokeDasharray={s.strokeDasharray}
                yAxisId={s.yAxisId || "left"}
                dot={{ fill: s.color, r: 4 }}
                activeDot={{
                  r: 6,
                  stroke: s.color,
                  strokeWidth: 2,
                  fill: "#fff",
                }}
                animationDuration={animationDuration}
                onClick={(data) => onDataPointClick?.(data, s.key)}
              />
            ))}
            {referenceLines.map((line, index) => (
              <ReferenceLine
                key={index}
                {...(line.y !== undefined ? { y: line.y } : {})}
                {...(line.x !== undefined ? { x: line.x } : {})}
                stroke={line.color || colors.accent}
                strokeDasharray={line.strokeDasharray || "5 5"}
                {...(line.label ? { label: line.label } : {})}
              />
            ))}
            {showBrush && <Brush dataKey={xAxis?.dataKey || "x"} height={30} />}
          </LineChart>
        );
      }

      case "area":
        return (
          <AreaChart {...commonProps}>
            <defs>
              {seriesWithColors.map((s) => (
                <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            {!xAxis?.hide && <XAxis dataKey={xAxis?.dataKey || "x"} tickFormatter={formatXAxis} />}
            {!yAxis?.left?.hide && <YAxis tickFormatter={(value) => formatYAxis(value, "left")} />}
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend content={<CustomLegend onLegendClick={onLegendClick} />} />}
            {seriesWithColors.map((s) => (
              <Area
                key={s.key}
                type={smooth ? "monotone" : "linear"}
                dataKey={s.key}
                stroke={s.color}
                fill={s.fill || `url(#gradient-${s.key})`}
                strokeWidth={s.strokeWidth || 2}
                animationDuration={animationDuration}
                {...(stacked ? { stackId: s.stackId ?? "default" } : {})}
              />
            ))}
          </AreaChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            {!xAxis?.hide && <XAxis dataKey={xAxis?.dataKey || "x"} tickFormatter={formatXAxis} />}
            {!yAxis?.left?.hide && <YAxis tickFormatter={(value) => formatYAxis(value, "left")} />}
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend content={<CustomLegend onLegendClick={onLegendClick} />} />}
            {seriesWithColors.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                animationDuration={animationDuration}
                onClick={(data) => onDataPointClick?.(data, s.key)}
                {...(stacked ? { stackId: s.stackId ?? "default" } : {})}
              />
            ))}
          </BarChart>
        );

      case "pie":
      case "donut":
        return (
          <PieChart {...commonProps}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={type === "donut" ? 100 : 120}
              innerRadius={type === "donut" ? 60 : 0}
              fill={colors.primary}
              dataKey={series[0]?.key || "value"}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              animationDuration={animationDuration}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors.gradient[index % colors.gradient.length]}
                />
              ))}
            </Pie>
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend />}
          </PieChart>
        );

      default:
        return null;
    }
  };

  // Loading State
  if (loading) {
    return (
      <div
        className={cn(
          "bg-white rounded-lg border border-gray-200",
          cardWrapper && "p-6",
          className,
        )}
      >
        {title && <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />}
        <div className="w-full bg-gray-200 rounded animate-pulse" style={{ height }} />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className={cn("bg-white rounded-lg border border-gray-200 p-6", className)}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Failed to load chart</p>
          <p className="text-xs text-gray-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const chartElement = renderChart();
  if (!chartElement) {
    return null;
  }

  const responsiveContainerProps: {
    width: string | number;
    height?: string | number;
    aspect?: number;
  } = { width };

  if (aspectRatio !== undefined) {
    responsiveContainerProps.aspect = aspectRatio;
  } else {
    responsiveContainerProps.height = height;
  }

  const chartContent = (
    <ResponsiveContainer {...responsiveContainerProps}>{chartElement}</ResponsiveContainer>
  );

  if (!cardWrapper) {
    return <div className={className}>{chartContent}</div>;
  }

  return (
    <motion.div
      className={cn("bg-white rounded-lg border border-gray-200 p-6", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      {(title || subtitle || actions.length > 0) && (
        <div className="flex items-start justify-between mb-6">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>

          {actions.length > 0 && (
            <div className="flex items-center space-x-2">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title={action.label}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {chartContent}
    </motion.div>
  );
}

export default UniversalChart;
