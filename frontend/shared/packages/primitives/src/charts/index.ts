/**
 * Universal Chart Components
 * Comprehensive charting system with ISP-specific templates
 */

// Base Chart Component
export { default as UniversalChart } from "./UniversalChart";
export type {
  UniversalChartProps,
  ChartType,
  ChartDataPoint,
  ChartSeries,
  ChartVariant,
} from "./UniversalChart";

// Pre-configured Chart Templates
export * from "./ChartLibrary";

// Legacy OptimizedCharts (for backward compatibility)
export * from "./OptimizedCharts";
