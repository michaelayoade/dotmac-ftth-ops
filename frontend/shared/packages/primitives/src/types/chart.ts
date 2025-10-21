/**
 * Strongly typed interfaces for chart components
 */

// Base chart data types
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

// Tooltip payload interface
export interface TooltipPayload {
  value: number | string;
  name: string;
  dataKey: string;
  color: string;
  payload: Record<string, unknown>;
}

// Custom tooltip props with proper typing
export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  formatter?: (value: number | string, name: string) => [string, string];
}

// Revenue chart data
export interface RevenueData {
  month: string;
  revenue: number;
  target: number;
  previousYear: number;
}

export interface RevenueChartProps {
  data: RevenueData[];
  height?: number;
  className?: string;
  onDataPointClick?: (data: RevenueData, index: number) => void;
}

// Network usage chart data
export interface NetworkUsageData {
  hour: string;
  download: number;
  upload: number;
  peak: number;
}

export interface NetworkUsageChartProps {
  data: NetworkUsageData[];
  height?: number;
  className?: string;
  onDataPointClick?: (data: NetworkUsageData, index: number) => void;
}

// Service status chart data
export interface ServiceStatusData {
  name: string;
  value: number;
  status: "online" | "maintenance" | "offline";
}

export interface ServiceStatusChartProps {
  data: ServiceStatusData[];
  height?: number;
  className?: string;
  onDataPointClick?: (data: ServiceStatusData, index: number) => void;
}

// Bandwidth chart data
export interface BandwidthData {
  time: string;
  utilization: number;
  capacity: number;
}

export interface BandwidthChartProps {
  data: BandwidthData[];
  height?: number;
  className?: string;
  onDataPointClick?: (data: BandwidthData, index: number) => void;
}

// Chart color configuration
export interface ChartColors {
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  danger: string;
  success: string;
  gradient: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

// Chart configuration
export interface ChartConfig {
  colors: ChartColors;
  responsive: boolean;
  animations: boolean;
  showTooltips: boolean;
  showLegend: boolean;
}

// Error state for charts
export interface ChartError {
  message: string;
  code: string;
  recoverable: boolean;
}

// Chart loading state
export interface ChartLoadingState {
  isLoading: boolean;
  message?: string;
}
