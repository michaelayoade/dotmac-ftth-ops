/**
 * Unstyled, composable Chart primitives using Recharts
 */

import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import type React from "react";
import { forwardRef } from "react";
import * as Recharts from "recharts";

const ResponsiveContainer =
  Recharts.ResponsiveContainer ??
  (({ children }: { children?: React.ReactNode }) => <div>{children}</div>);
const RechartsLineChart =
  Recharts.LineChart ?? (({ children }: { children?: React.ReactNode }) => <div>{children}</div>);
const RechartsBarChart =
  Recharts.BarChart ?? (({ children }: { children?: React.ReactNode }) => <div>{children}</div>);
const RechartsAreaChart =
  Recharts.AreaChart ?? (({ children }: { children?: React.ReactNode }) => <div>{children}</div>);
const RechartsPieChart =
  Recharts.PieChart ?? (({ children }: { children?: React.ReactNode }) => <div>{children}</div>);
const CartesianGrid =
  Recharts.CartesianGrid ?? (() => <div data-testid="cartesian-grid-fallback" />);
const XAxis =
  Recharts.XAxis ??
  (({ dataKey }: { dataKey?: string }) => <div data-testid="x-axis-fallback" data-key={dataKey} />);
const YAxis =
  Recharts.YAxis ??
  (({ domain }: { domain?: unknown }) => (
    <div data-testid="y-axis-fallback" data-domain={domain} />
  ));
const Tooltip = Recharts.Tooltip ?? (() => <div data-testid="tooltip-fallback" />);
const Legend = Recharts.Legend ?? (() => <div data-testid="legend-fallback" />);
const Line =
  Recharts.Line ??
  (({ dataKey }: { dataKey?: string }) => <div data-testid={`line-fallback-${dataKey}`} />);
const Bar =
  Recharts.Bar ??
  (({ dataKey }: { dataKey?: string }) => <div data-testid={`bar-fallback-${dataKey}`} />);
const Area =
  Recharts.Area ??
  (({ dataKey }: { dataKey?: string }) => <div data-testid={`area-fallback-${dataKey}`} />);
const Pie =
  Recharts.Pie ??
  (({ dataKey }: { dataKey?: string }) => <div data-testid={`pie-fallback-${dataKey}`} />);
const Cell = Recharts.Cell ?? (() => <div data-testid="cell-fallback" />);

// Chart container variants
const chartVariants = cva("", {
  variants: {
    size: {
      sm: "",
      md: "",
      lg: "",
      xl: "",
    },
    variant: {
      default: "",
      minimal: "",
      detailed: "",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
  },
});

// Base Chart Props
export interface BaseChartProps extends VariantProps<typeof chartVariants> {
  data: unknown[];
  width?: number | string;
  height?: number | string;
  className?: string;
  loading?: boolean;
  error?: string;
  emptyText?: string;
  title?: string;
  description?: string;
}

// Chart Container
export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  loading?: boolean;
  error?: string;
  emptyText?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

// Helper components to reduce ChartContainer complexity
function ChartHeader({
  title,
  description,
  actions,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  if (!title && !description && !actions) {
    return null;
  }

  return (
    <div className="chart-header">
      <div className="chart-header-content">
        {title ? <h3 className="chart-title">{title}</h3> : null}
        {description ? <p className="chart-description">{description}</p> : null}
      </div>
      {actions ? <div className="chart-actions">{actions}</div> : null}
    </div>
  );
}

function ChartContent({
  loading,
  error,
  emptyText,
  children,
}: {
  loading?: boolean;
  error?: string;
  emptyText: string;
  children?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="chart-loading">
        <div className="loading-spinner" />
        <span>Loading chart data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-error">
        <span className="error-icon">⚠</span>
        <span>Error loading chart: {error}</span>
      </div>
    );
  }

  if (!children) {
    return (
      <div className="chart-empty">
        <span className="empty-icon">📊</span>
        <span>{emptyText}</span>
      </div>
    );
  }

  return <>{children}</>;
}

const ChartContainer = forwardRef<HTMLDivElement, ChartContainerProps>(
  (
    {
      className,
      loading,
      error,
      emptyText = "No data available",
      title,
      description,
      actions,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={clsx("chart-container", className)} {...props}>
        <ChartHeader
          {...(title !== undefined ? { title } : {})}
          {...(description !== undefined ? { description } : {})}
          {...(actions !== undefined ? { actions } : {})}
        />
        <div className="chart-content">
          <ChartContent
            {...(loading !== undefined ? { loading } : {})}
            {...(error !== undefined ? { error } : {})}
            emptyText={emptyText}
          >
            {children}
          </ChartContent>
        </div>
      </div>
    );
  },
);

// Line Chart
export interface LineChartProps extends BaseChartProps {
  lines?: Array<{
    key: string;
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    dot?: boolean;
    activeDot?: boolean;
  }>;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  xAxisKey?: string;
  yAxisDomain?: [number, number] | ["auto", "auto"];
}

export function LineChart({
  data,
  lines = [],
  width = "100%",
  height = 300,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  xAxisKey = "name",
  yAxisDomain,
  size,
  variant,
  className,
  loading,
  error,
  emptyText,
  title,
  description,
}: LineChartProps) {
  const containerMetaProps: Partial<ChartContainerProps> = {
    ...(loading !== undefined ? { loading } : {}),
    ...(error !== undefined ? { error } : {}),
    ...(emptyText !== undefined ? { emptyText } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
  };

  if (loading || error || data.length === 0) {
    return (
      <ChartContainer
        className={clsx(chartVariants({ size, variant }), className)}
        {...containerMetaProps}
      />
    );
  }

  return (
    <ChartContainer
      className={clsx(chartVariants({ size, variant }), className)}
      {...containerMetaProps}
    >
      <ResponsiveContainer width={width} height={height}>
        <RechartsLineChart data={data}>
          {showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null}
          <XAxis dataKey={xAxisKey} />
          <YAxis {...(yAxisDomain ? { domain: yAxisDomain } : {})} />
          {showTooltip ? <Tooltip /> : null}
          {showLegend ? <Legend /> : null}

          {lines.map(
            ({ key, stroke, strokeWidth = 2, strokeDasharray, dot = true, activeDot = true }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                dot={dot}
                activeDot={activeDot}
              />
            ),
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// Bar Chart
export interface BarChartProps extends BaseChartProps {
  bars?: Array<{
    key: string;
    fill?: string;
    stackId?: string;
  }>;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  xAxisKey?: string;
  yAxisDomain?: [number, number] | ["auto", "auto"];
  layout?: "horizontal" | "vertical";
}

export function BarChart({
  data,
  bars = [],
  width = "100%",
  height = 300,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  xAxisKey = "name",
  yAxisDomain,
  layout = "vertical",
  size,
  variant,
  className,
  loading,
  error,
  emptyText,
  title,
  description,
}: BarChartProps) {
  const containerMetaProps: Partial<ChartContainerProps> = {
    ...(loading !== undefined ? { loading } : {}),
    ...(error !== undefined ? { error } : {}),
    ...(emptyText !== undefined ? { emptyText } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
  };

  if (loading || error || data.length === 0) {
    return (
      <ChartContainer
        className={clsx(chartVariants({ size, variant }), className)}
        {...containerMetaProps}
      />
    );
  }

  return (
    <ChartContainer
      className={clsx(chartVariants({ size, variant }), className)}
      {...containerMetaProps}
    >
      <ResponsiveContainer width={width} height={height}>
        <RechartsBarChart data={data} layout={layout}>
          {showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null}
          <XAxis dataKey={xAxisKey} />
          <YAxis {...(yAxisDomain ? { domain: yAxisDomain } : {})} />
          {showTooltip ? <Tooltip /> : null}
          {showLegend ? <Legend /> : null}

          {bars.map(({ key, fill, stackId }) => (
            <Bar key={key} dataKey={key} fill={fill} {...(stackId ? { stackId } : {})} />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// Area Chart
export interface AreaChartProps extends BaseChartProps {
  areas?: Array<{
    key: string;
    stroke?: string;
    fill?: string;
    stackId?: string;
  }>;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  xAxisKey?: string;
  yAxisDomain?: [number, number] | ["auto", "auto"];
}

export function AreaChart({
  data,
  areas = [],
  width = "100%",
  height = 300,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  xAxisKey = "name",
  yAxisDomain,
  size,
  variant,
  className,
  loading,
  error,
  emptyText,
  title,
  description,
}: AreaChartProps) {
  const containerMetaProps: Partial<ChartContainerProps> = {
    ...(loading !== undefined ? { loading } : {}),
    ...(error !== undefined ? { error } : {}),
    ...(emptyText !== undefined ? { emptyText } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
  };

  if (loading || error || data.length === 0) {
    return (
      <ChartContainer
        className={clsx(chartVariants({ size, variant }), className)}
        {...containerMetaProps}
      />
    );
  }

  return (
    <ChartContainer
      className={clsx(chartVariants({ size, variant }), className)}
      {...containerMetaProps}
    >
      <ResponsiveContainer width={width} height={height}>
        <RechartsAreaChart data={data}>
          {showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null}
          <XAxis dataKey={xAxisKey} />
          <YAxis {...(yAxisDomain ? { domain: yAxisDomain } : {})} />
          {showTooltip ? <Tooltip /> : null}
          {showLegend ? <Legend /> : null}

          {areas.map(({ key, stroke, fill, stackId }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={stroke}
              fill={fill}
              {...(stackId ? { stackId } : {})}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// Pie Chart
export interface PieChartProps extends BaseChartProps {
  dataKey: string;
  nameKey?: string;
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
  showTooltip?: boolean;
  showLegend?: boolean;
  showLabels?: boolean;
}

export function PieChart({
  data,
  dataKey,
  nameKey = "name",
  colors = [],
  innerRadius = 0,
  outerRadius = 80,
  width = "100%",
  height = 300,
  showTooltip = true,
  showLegend = true,
  showLabels = true,
  size,
  variant,
  className,
  loading,
  error,
  emptyText,
  title,
  description,
}: PieChartProps) {
  const containerMetaProps: Partial<ChartContainerProps> = {
    ...(loading !== undefined ? { loading } : {}),
    ...(error !== undefined ? { error } : {}),
    ...(emptyText !== undefined ? { emptyText } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
  };

  if (loading || error || data.length === 0) {
    return (
      <ChartContainer
        className={clsx(chartVariants({ size, variant }), className)}
        {...containerMetaProps}
      />
    );
  }

  const defaultColors = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7300",
    "#00ff00",
    "#0088fe",
    "#8dd1e1",
    "#d084d0",
    "#ffb347",
    "#87ceeb",
  ];

  const pieColors = colors.length > 0 ? colors : defaultColors;

  return (
    <ChartContainer
      className={clsx(chartVariants({ size, variant }), className)}
      {...containerMetaProps}
    >
      <ResponsiveContainer width={width} height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            fill="#8884d8"
            label={showLabels}
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
            ))}
          </Pie>
          {showTooltip ? <Tooltip /> : null}
          {showLegend ? <Legend /> : null}
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// Metric Card (for displaying single values)
export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
}

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, title, value, subtitle, trend, icon, loading, size = "md", ...props }, ref) => {
    return (
      <div ref={ref} className={clsx("metric-card", `size-${size}`, className)} {...props}>
        <div className="metric-header">
          <span className="metric-title">{title}</span>
          {icon ? <span className="metric-icon">{icon}</span> : null}
        </div>

        <div className="metric-content">
          {loading ? (
            <div className="metric-loading">
              <div className="loading-skeleton" />
            </div>
          ) : (
            <>
              <span className="metric-value">{value}</span>
              {trend ? (
                <div className={clsx("metric-trend", `trend-${trend.direction}`)}>
                  <span className="trend-indicator">
                    {trend.direction === "up" && "↗"}
                    {trend.direction === "down" && "↘"}
                    {trend.direction === "neutral" && "→"}
                  </span>
                  <span className="trend-value">{Math.abs(trend.value)}%</span>
                </div>
              ) : null}
            </>
          )}
        </div>

        {subtitle ? (
          <div className="metric-footer">
            <span className="metric-subtitle">{subtitle}</span>
          </div>
        ) : null}
      </div>
    );
  },
);

// Chart utilities
export const chartUtils = {
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
      ...options,
    }).format(value);
  },

  formatCurrency: (value: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  },

  formatPercentage: (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  },

  generateColors: (count: number, hue = 220, saturation = 70) => {
    return Array.from({ length: count }, (_, index) => {
      const lightness = 40 + ((index * 20) % 40);
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    });
  },
};

ChartContainer.displayName = "ChartContainer";
MetricCard.displayName = "MetricCard";

export { ChartContainer };
