/**
 * Advanced Analytics Charts Component
 *
 * High-performance, interactive charts for business intelligence
 * and customer analytics with real-time data visualization.
 *
 * Features:
 * - Revenue analytics with trend analysis
 * - Customer growth metrics
 * - Service usage patterns
 * - Geographic distribution
 * - Performance indicators
 * - Customizable time ranges
 */

import React, { useMemo, useCallback, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Brush,
} from "recharts";

// Analytics data types
export interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend?: "up" | "down" | "stable";
  target?: number;
  unit?: string;
}

export interface TimeSeriesData {
  timestamp: string;
  date: string;
  revenue: number;
  customers: number;
  services: number;
  churn: number;
  arpu: number; // Average Revenue Per User
  costs: number;
  profit: number;
}

export interface CustomerSegment {
  segment: string;
  count: number;
  revenue: number;
  percentage: number;
  color: string;
}

export interface GeographicData {
  region: string;
  state?: string;
  city?: string;
  latitude: number;
  longitude: number;
  customers: number;
  revenue: number;
  growth: number;
}

export interface ServiceMetrics {
  service: string;
  subscribers: number;
  revenue: number;
  churn: number;
  satisfaction: number;
  arpu: number;
}

// Component props
export interface AdvancedAnalyticsChartsProps {
  metrics: AnalyticsMetric[];
  timeSeriesData: TimeSeriesData[];
  customerSegments: CustomerSegment[];
  geographicData: GeographicData[];
  serviceMetrics: ServiceMetrics[];
  dateRange: {
    start: string;
    end: string;
  };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  refreshInterval?: number;
  className?: string;
}

// Color schemes for charts
const CHART_COLORS = {
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  danger: "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",
  gradient: ["#3B82F6", "#1D4ED8", "#1E40AF"],
};

const SEGMENT_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#84CC16",
  "#F97316",
];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, formatValue }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="analytics-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="tooltip-entry" style={{ color: entry.color }}>
            {`${entry.name}: ${formatValue ? formatValue(entry.value) : entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Format currency values
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Format percentage values
const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// Format large numbers
const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

export const AdvancedAnalyticsCharts: React.FC<AdvancedAnalyticsChartsProps> = ({
  metrics,
  timeSeriesData,
  customerSegments,
  geographicData,
  serviceMetrics,
  dateRange,
  onDateRangeChange,
  refreshInterval = 30000,
  className = "",
}) => {
  const [activeChart, setActiveChart] = useState<string>("revenue");
  const [isRealTime, setIsRealTime] = useState(false);

  // Auto-refresh data
  useEffect(() => {
    if (!isRealTime || !refreshInterval) return;

    const interval = setInterval(() => {
      // Trigger data refresh logic here
      console.log("Refreshing analytics data...");
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isRealTime, refreshInterval]);

  // Revenue trend analysis
  const revenueAnalysis = useMemo(() => {
    if (!timeSeriesData.length) return null;

    const totalRevenue = timeSeriesData.reduce((sum, data) => sum + data.revenue, 0);
    const avgRevenue = totalRevenue / timeSeriesData.length;
    const lastValue = timeSeriesData[timeSeriesData.length - 1]?.revenue || 0;
    const firstValue = timeSeriesData[0]?.revenue || 0;
    const growth = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    return {
      total: totalRevenue,
      average: avgRevenue,
      growth: growth,
      trend: growth > 0 ? "up" : growth < 0 ? "down" : "stable",
    };
  }, [timeSeriesData]);

  // Customer analytics
  const customerAnalysis = useMemo(() => {
    const totalCustomers = timeSeriesData[timeSeriesData.length - 1]?.customers || 0;
    const avgChurn =
      timeSeriesData.reduce((sum, data) => sum + data.churn, 0) / timeSeriesData.length;
    const avgARPU =
      timeSeriesData.reduce((sum, data) => sum + data.arpu, 0) / timeSeriesData.length;

    return {
      total: totalCustomers,
      churnRate: avgChurn,
      arpu: avgARPU,
      retention: 1 - avgChurn,
    };
  }, [timeSeriesData]);

  const handleChartSwitch = useCallback((chartType: string) => {
    setActiveChart(chartType);
  }, []);

  return (
    <div className={`advanced-analytics-charts ${className}`}>
      {/* Analytics Header */}
      <div className="analytics-header">
        <div className="header-controls">
          <div className="chart-tabs">
            {["revenue", "customers", "services", "geographic"].map((chart) => (
              <button
                key={chart}
                className={`tab-button ${activeChart === chart ? "active" : ""}`}
                onClick={() => handleChartSwitch(chart)}
              >
                {chart.charAt(0).toUpperCase() + chart.slice(1)}
              </button>
            ))}
          </div>

          <div className="header-actions">
            <label className="realtime-toggle">
              <input
                type="checkbox"
                checked={isRealTime}
                onChange={(e) => setIsRealTime(e.target.checked)}
              />
              Real-time
            </label>

            <select
              className="date-range-select"
              onChange={(e) => {
                const range = e.target.value;
                // Handle date range change
                console.log("Date range changed:", range);
              }}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 3 months</option>
              <option value="1y">Last year</option>
            </select>
          </div>
        </div>

        {/* Key Metrics Summary */}
        <div className="metrics-summary">
          {metrics.slice(0, 4).map((metric) => (
            <div key={metric.id} className="metric-card">
              <div className="metric-header">
                <h3>{metric.name}</h3>
                {metric.trend && (
                  <span className={`trend-indicator ${metric.trend}`}>
                    {metric.trend === "up" ? "↗" : metric.trend === "down" ? "↘" : "→"}
                  </span>
                )}
              </div>
              <div className="metric-value">
                {metric.unit === "currency"
                  ? formatCurrency(metric.value)
                  : metric.unit === "percent"
                    ? formatPercent(metric.value / 100)
                    : formatNumber(metric.value)}
              </div>
              {metric.changePercent && (
                <div
                  className={`metric-change ${metric.changePercent > 0 ? "positive" : "negative"}`}
                >
                  {metric.changePercent > 0 ? "+" : ""}
                  {metric.changePercent.toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chart Content */}
      <div className="chart-container">
        {activeChart === "revenue" && (
          <div className="revenue-analytics">
            <div className="chart-section">
              <h3>Revenue Trends</h3>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" tickFormatter={formatCurrency} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip formatValue={formatCurrency} />} />
                  <Legend />

                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    fill="url(#revenueGradient)"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    name="Revenue"
                  />

                  <Bar yAxisId="right" dataKey="profit" fill={CHART_COLORS.success} name="Profit" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="costs"
                    stroke={CHART_COLORS.danger}
                    name="Costs"
                  />

                  <Brush dataKey="date" height={30} />

                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="analysis-panel">
              <h4>Revenue Analysis</h4>
              {revenueAnalysis && (
                <div className="analysis-stats">
                  <div className="stat">
                    <label>Total Revenue</label>
                    <span className="value">{formatCurrency(revenueAnalysis.total)}</span>
                  </div>
                  <div className="stat">
                    <label>Average</label>
                    <span className="value">{formatCurrency(revenueAnalysis.average)}</span>
                  </div>
                  <div className="stat">
                    <label>Growth</label>
                    <span
                      className={`value ${revenueAnalysis.growth > 0 ? "positive" : "negative"}`}
                    >
                      {revenueAnalysis.growth.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeChart === "customers" && (
          <div className="customer-analytics">
            <div className="chart-row">
              <div className="chart-section">
                <h3>Customer Growth</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={formatNumber} />
                    <Tooltip content={<CustomTooltip formatValue={formatNumber} />} />
                    <Legend />

                    <Area
                      type="monotone"
                      dataKey="customers"
                      stroke={CHART_COLORS.secondary}
                      fill={CHART_COLORS.secondary}
                      fillOpacity={0.6}
                      name="Total Customers"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-section">
                <h3>Customer Segments</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={customerSegments}
                      dataKey="count"
                      nameKey="segment"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ segment, percentage }) => `${segment} (${percentage.toFixed(1)}%)`}
                    >
                      {customerSegments.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [formatNumber(value as number), name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="customer-metrics">
              <h4>Customer Metrics</h4>
              {customerAnalysis && (
                <div className="metrics-grid">
                  <div className="metric-item">
                    <label>Total Customers</label>
                    <span className="value">{formatNumber(customerAnalysis.total)}</span>
                  </div>
                  <div className="metric-item">
                    <label>Churn Rate</label>
                    <span className="value warning">
                      {formatPercent(customerAnalysis.churnRate)}
                    </span>
                  </div>
                  <div className="metric-item">
                    <label>ARPU</label>
                    <span className="value">{formatCurrency(customerAnalysis.arpu)}</span>
                  </div>
                  <div className="metric-item">
                    <label>Retention</label>
                    <span className="value success">
                      {formatPercent(customerAnalysis.retention)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeChart === "services" && (
          <div className="service-analytics">
            <div className="chart-section">
              <h3>Service Performance</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={serviceMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" />
                  <YAxis yAxisId="left" tickFormatter={formatNumber} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={formatPercent} />
                  <Tooltip />
                  <Legend />

                  <Bar
                    yAxisId="left"
                    dataKey="subscribers"
                    fill={CHART_COLORS.primary}
                    name="Subscribers"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    fill={CHART_COLORS.secondary}
                    name="Revenue"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="satisfaction"
                    stroke={CHART_COLORS.accent}
                    name="Satisfaction"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeChart === "geographic" && (
          <div className="geographic-analytics">
            <div className="chart-section">
              <h3>Geographic Distribution</h3>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart data={geographicData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="longitude" name="Longitude" />
                  <YAxis dataKey="latitude" name="Latitude" />
                  <Tooltip
                    formatter={(value, name, props) => [
                      name === "customers"
                        ? formatNumber(value as number)
                        : name === "revenue"
                          ? formatCurrency(value as number)
                          : value,
                      name,
                    ]}
                    labelFormatter={() => ""}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }

                      const dataPoint = payload[0]?.payload as GeographicData | undefined;
                      if (!dataPoint) {
                        return null;
                      }

                      return (
                        <div className="geo-tooltip">
                          <p>
                            <strong>{dataPoint.region}</strong>
                          </p>
                          <p>Customers: {formatNumber(dataPoint.customers)}</p>
                          <p>Revenue: {formatCurrency(dataPoint.revenue)}</p>
                          <p>Growth: {dataPoint.growth.toFixed(1)}%</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter dataKey="customers" fill={CHART_COLORS.primary} name="Customers" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="geographic-summary">
              <h4>Top Regions</h4>
              <div className="region-list">
                {geographicData
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 5)
                  .map((region, index) => (
                    <div key={region.region} className="region-item">
                      <span className="rank">#{index + 1}</span>
                      <span className="name">{region.region}</span>
                      <span className="customers">{formatNumber(region.customers)}</span>
                      <span className="revenue">{formatCurrency(region.revenue)}</span>
                      <span className={`growth ${region.growth > 0 ? "positive" : "negative"}`}>
                        {region.growth.toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedAnalyticsCharts;
