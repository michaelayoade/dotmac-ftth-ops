/**
 * Universal Chart Library
 * Pre-configured chart templates for common ISP use cases
 */

"use client";

import React from "react";
import { UniversalChart } from "./UniversalChart";
import type { UniversalChartProps, ChartDataPoint } from "./UniversalChart";

// Revenue Chart
export interface RevenueChartData extends ChartDataPoint {
  date: string;
  revenue: number;
  target?: number;
  previousYear?: number;
}

export interface RevenueChartProps extends Omit<UniversalChartProps, "data" | "series" | "type"> {
  data: RevenueChartData[];
  showTarget?: boolean;
  showComparison?: boolean;
  currency?: string;
}

export function RevenueChart({
  data,
  showTarget = false,
  showComparison = false,
  currency = "USD",
  ...props
}: RevenueChartProps) {
  const series = [
    { key: "revenue", name: "Revenue", type: "area" as const },
    ...(showTarget
      ? [
          {
            key: "target",
            name: "Target",
            type: "line" as const,
            strokeDasharray: "5 5",
          },
        ]
      : []),
    ...(showComparison
      ? [{ key: "previousYear", name: "Previous Year", type: "line" as const }]
      : []),
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <UniversalChart
      {...props}
      type="area"
      data={data}
      series={series}
      title={props.title || "Revenue Trends"}
      xAxis={{
        dataKey: "date",
        format: (value) => new Date(value).toLocaleDateString(),
      }}
      yAxis={{ left: { format: formatCurrency } }}
      smooth
    />
  );
}

// Network Usage Chart
export interface NetworkUsageData extends ChartDataPoint {
  time: string;
  upload: number;
  download: number;
  total?: number;
}

export interface NetworkUsageChartProps
  extends Omit<UniversalChartProps, "data" | "series" | "type"> {
  data: NetworkUsageData[];
  showTotal?: boolean;
  unit?: "MB" | "GB" | "TB";
}

export function NetworkUsageChart({
  data,
  showTotal = false,
  unit = "GB",
  ...props
}: NetworkUsageChartProps) {
  const series = [
    { key: "download", name: "Download", stackId: "usage" },
    { key: "upload", name: "Upload", stackId: "usage" },
    ...(showTotal
      ? [
          {
            key: "total",
            name: "Total",
            type: "line" as const,
            yAxisId: "right",
          },
        ]
      : []),
  ];

  const formatBytes = (value: number) => `${value} ${unit}`;

  return (
    <UniversalChart
      {...props}
      type="area"
      data={data}
      series={series}
      title={props.title || "Network Usage"}
      xAxis={{ dataKey: "time" }}
      yAxis={{
        left: { format: formatBytes },
        ...(showTotal && { right: { format: formatBytes } }),
      }}
      stacked
      smooth
    />
  );
}

// Customer Growth Chart
export interface CustomerGrowthData extends ChartDataPoint {
  period: string;
  newCustomers: number;
  churnedCustomers: number;
  totalCustomers: number;
}

export interface CustomerGrowthChartProps
  extends Omit<UniversalChartProps, "data" | "series" | "type"> {
  data: CustomerGrowthData[];
}

export function CustomerGrowthChart({ data, ...props }: CustomerGrowthChartProps) {
  const series = [
    { key: "newCustomers", name: "New Customers", type: "bar" as const },
    {
      key: "churnedCustomers",
      name: "Churned Customers",
      type: "bar" as const,
    },
    {
      key: "totalCustomers",
      name: "Total Customers",
      type: "line" as const,
      yAxisId: "right",
    },
  ];

  return (
    <UniversalChart
      {...props}
      type="combo"
      data={data}
      series={series}
      title={props.title || "Customer Growth"}
      xAxis={{ dataKey: "period" }}
      yAxis={{
        left: { label: "Monthly Change" },
        right: { label: "Total Customers" },
      }}
    />
  );
}

// Service Status Chart (Pie/Donut)
export interface ServiceStatusData extends ChartDataPoint {
  status: string;
  count: number;
  percentage: number;
}

export interface ServiceStatusChartProps
  extends Omit<UniversalChartProps, "data" | "series" | "type"> {
  data: ServiceStatusData[];
  chartType?: "pie" | "donut";
}

export function ServiceStatusChart({
  data,
  chartType = "donut",
  ...props
}: ServiceStatusChartProps) {
  const series = [{ key: "count", name: "Services" }];

  return (
    <UniversalChart
      {...props}
      type={chartType}
      data={data}
      series={series}
      title={props.title || "Service Status Distribution"}
    />
  );
}

// Performance Metrics Chart
export interface PerformanceData extends ChartDataPoint {
  timestamp: string;
  latency: number;
  throughput: number;
  errorRate: number;
  uptime: number;
}

export interface PerformanceChartProps
  extends Omit<UniversalChartProps, "data" | "series" | "type"> {
  data: PerformanceData[];
  metrics?: ("latency" | "throughput" | "errorRate" | "uptime")[];
}

export function PerformanceChart({
  data,
  metrics = ["latency", "throughput", "uptime"],
  ...props
}: PerformanceChartProps) {
  const series = metrics.map((metric) => ({
    key: metric,
    name: metric.charAt(0).toUpperCase() + metric.slice(1),
    yAxisId: metric === "uptime" ? "right" : "left",
  }));

  const formatLatency = (value: number) => `${value}ms`;
  const formatThroughput = (value: number) => `${value} Mbps`;
  const formatUptime = (value: number) => `${value}%`;

  return (
    <UniversalChart
      {...props}
      type="line"
      data={data}
      series={series}
      title={props.title || "Network Performance"}
      xAxis={{ dataKey: "timestamp" }}
      yAxis={{
        left: { format: formatLatency },
        right: { format: formatUptime, domain: [0, 100] },
      }}
      smooth
    />
  );
}

// Bandwidth Distribution Chart
export interface BandwidthData extends ChartDataPoint {
  timeSlot: string;
  residential: number;
  business: number;
  enterprise: number;
}

export interface BandwidthChartProps extends Omit<UniversalChartProps, "data" | "series" | "type"> {
  data: BandwidthData[];
  showStacked?: boolean;
}

export function BandwidthChart({ data, showStacked = true, ...props }: BandwidthChartProps) {
  const series: UniversalChartProps["series"] = [
    {
      key: "residential",
      name: "Residential",
      ...(showStacked ? { stackId: "bandwidth" } : {}),
    },
    {
      key: "business",
      name: "Business",
      ...(showStacked ? { stackId: "bandwidth" } : {}),
    },
    {
      key: "enterprise",
      name: "Enterprise",
      ...(showStacked ? { stackId: "bandwidth" } : {}),
    },
  ];

  const formatBandwidth = (value: number) => `${value} Gbps`;

  return (
    <UniversalChart
      {...props}
      type="area"
      data={data}
      series={series}
      title={props.title || "Bandwidth Distribution"}
      xAxis={{ dataKey: "timeSlot" }}
      yAxis={{ left: { format: formatBandwidth } }}
      stacked={showStacked}
      smooth
    />
  );
}

// Ticket Volume Chart
export interface TicketVolumeData extends ChartDataPoint {
  date: string;
  created: number;
  resolved: number;
  backlog: number;
}

export interface TicketVolumeChartProps
  extends Omit<UniversalChartProps, "data" | "series" | "type"> {
  data: TicketVolumeData[];
}

export function TicketVolumeChart({ data, ...props }: TicketVolumeChartProps) {
  const series = [
    { key: "created", name: "Created", type: "bar" as const },
    { key: "resolved", name: "Resolved", type: "bar" as const },
    {
      key: "backlog",
      name: "Backlog",
      type: "line" as const,
      yAxisId: "right",
    },
  ];

  return (
    <UniversalChart
      {...props}
      type="combo"
      data={data}
      series={series}
      title={props.title || "Support Ticket Volume"}
      xAxis={{
        dataKey: "date",
        format: (value) => new Date(value).toLocaleDateString(),
      }}
      yAxis={{
        left: { label: "Daily Volume" },
        right: { label: "Total Backlog" },
      }}
    />
  );
}

// Financial Overview Chart
export interface FinancialData extends ChartDataPoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

export interface FinancialChartProps extends Omit<UniversalChartProps, "data" | "series" | "type"> {
  data: FinancialData[];
  currency?: string;
}

export function FinancialChart({ data, currency = "USD", ...props }: FinancialChartProps) {
  const series = [
    { key: "revenue", name: "Revenue", type: "bar" as const },
    { key: "expenses", name: "Expenses", type: "bar" as const },
    { key: "profit", name: "Profit", type: "line" as const },
    {
      key: "margin",
      name: "Margin %",
      type: "line" as const,
      yAxisId: "right",
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => `${value}%`;

  return (
    <UniversalChart
      {...props}
      type="combo"
      data={data}
      series={series}
      title={props.title || "Financial Overview"}
      xAxis={{ dataKey: "month" }}
      yAxis={{
        left: { format: formatCurrency },
        right: { format: formatPercentage, domain: [0, 100] },
      }}
    />
  );
}

// All charts are already exported above with their individual export statements

// Default export with all charts
export default {
  RevenueChart,
  NetworkUsageChart,
  CustomerGrowthChart,
  ServiceStatusChart,
  PerformanceChart,
  BandwidthChart,
  TicketVolumeChart,
  FinancialChart,
};
