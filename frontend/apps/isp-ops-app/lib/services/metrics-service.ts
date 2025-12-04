/**
 * Metrics Service
 *
 * Service for fetching and managing application metrics.
 */

import { apiClient } from "../api/client";

export interface MetricValue {
  timestamp: string;
  value: number;
}

export interface Metric {
  name: string;
  description: string;
  unit: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  data: MetricValue[];
}

export interface DashboardMetrics {
  revenue: Metric;
  customers: Metric;
  subscriptions: Metric;
  churnRate: Metric;
  averageRevenuePerUser: Metric;
  monthlyRecurringRevenue: Metric;
}

export interface CustomerOperationsMetrics {
  total: number;
  newThisMonth: number;
  growthRate: number;
  churnRisk: number;
}

export interface CommunicationOperationsMetrics {
  totalSent: number;
  sentToday: number;
  deliveryRate: number;
}

export interface FileOperationsMetrics {
  totalFiles: number;
  totalSize: number;
  uploadsToday: number;
  downloadsToday: number;
}

export interface ActivityOperationsMetrics {
  eventsPerHour: number;
  activeUsers: number;
}

export interface OperationsMetrics {
  customers: CustomerOperationsMetrics;
  communications: CommunicationOperationsMetrics;
  files: FileOperationsMetrics;
  activity: ActivityOperationsMetrics;
}

export interface InfrastructureMetrics {
  health: {
    status: "healthy" | "degraded" | "critical";
    uptime: number;
    services: Array<{
      name: string;
      status: "healthy" | "degraded" | "critical";
      latency: number;
      uptime: number;
    }>;
  };
  performance: {
    avgLatency: number;
    p99Latency: number;
    throughput: number;
    errorRate: number;
    requestsPerSecond: number;
  };
  logs: {
    totalLogs: number;
    errors: number;
    warnings: number;
  };
  uptime: number;
  services: {
    total: number;
    healthy: number;
    degraded: number;
    critical: number;
  };
  resources: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

export interface BillingMetrics {
  revenue: {
    total: number;
    mrr: number;
    revenueGrowth: number;
  };
  subscriptions: {
    total: number;
    active: number;
    pending: number;
    cancelled: number;
    trial: number;
    churnRate: number;
  };
  invoices: {
    total: number;
    paid: number;
    overdue: number;
    outstanding: number;
    pending: number;
    overdueAmount: number;
  };
  payments: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  // Flat properties for backwards compatibility
  totalRevenue?: number;
  monthlyRecurringRevenue?: number;
  averageRevenuePerUser?: number;
  activeSubscriptions?: number;
  churnRate?: number;
  outstandingBalance?: number;
  totalInvoices?: number;
  paidInvoices?: number;
  overdueInvoices?: number;
}

export interface SecurityMetrics {
  auth: {
    activeSessions: number;
    failedAttempts: number;
    mfaEnabled: number;
    passwordResets: number;
  };
  apiKeys: {
    total: number;
    active: number;
    expiring: number;
  };
  secrets: {
    total: number;
    active: number;
    expired: number;
    rotated: number;
  };
  compliance: {
    score: number;
    issues: number;
  };
}

/**
 * Fetch dashboard metrics
 */
export async function getDashboardMetrics(timeRange: string = "30d"): Promise<DashboardMetrics> {
  const response = await apiClient.get<DashboardMetrics>(
    `/metrics/dashboard?timeRange=${timeRange}`,
  );
  return response["data"];
}

/**
 * Fetch billing metrics
 */
export async function getBillingMetrics(timeRange: string = "30d"): Promise<BillingMetrics> {
  const response = await apiClient.get<BillingMetrics>(
    `/analytics/billing/metrics?timeRange=${timeRange}`,
  );
  return response["data"];
}

/**
 * Fetch infrastructure metrics
 */
export async function getInfrastructureMetrics(): Promise<InfrastructureMetrics> {
  const response = await apiClient.get<InfrastructureMetrics>("/monitoring/infrastructure/metrics");
  return response["data"];
}

/**
 * Fetch security metrics
 */
export async function getSecurityMetrics(): Promise<SecurityMetrics> {
  const response = await apiClient.get<SecurityMetrics>("/analytics/security/metrics");
  return response["data"];
}

/**
 * Fetch operations metrics
 */
export async function getOperationsMetrics(): Promise<OperationsMetrics> {
  const response = await apiClient.get<Partial<OperationsMetrics> & Record<string, any>>(
    "/analytics/operations/metrics",
  );
  const raw = response["data"] ?? {};

  return {
    customers: {
      total: raw.customers?.total ?? raw["totalCustomers"] ?? 0,
      newThisMonth: raw.customers?.newThisMonth ?? raw["newCustomersThisMonth"] ?? 0,
      growthRate: raw.customers?.growthRate ?? raw["customerGrowthRate"] ?? 0,
      churnRisk: raw.customers?.churnRisk ?? raw["customersAtRisk"] ?? 0,
    },
    communications: {
      totalSent: raw.communications?.totalSent ?? raw["totalCommunications"] ?? 0,
      sentToday: raw.communications?.sentToday ?? raw["communicationsSentToday"] ?? 0,
      deliveryRate: raw.communications?.deliveryRate ?? raw["communicationDeliveryRate"] ?? 0,
    },
    files: {
      totalFiles: raw.files?.["totalFiles"] ?? raw["totalFiles"] ?? 0,
      totalSize: raw.files?.totalSize ?? raw["totalFileSize"] ?? 0,
      uploadsToday: raw.files?.uploadsToday ?? raw["filesUploadedToday"] ?? 0,
      downloadsToday: raw.files?.downloadsToday ?? raw["fileDownloadsToday"] ?? 0,
    },
    activity: {
      eventsPerHour: raw.activity?.["eventsPerHour"] ?? raw["eventsPerHour"] ?? 0,
      activeUsers: raw.activity?.["activeUsers"] ?? raw["activeUsers"] ?? 0,
    },
  };
}

/**
 * Fetch specific metric
 */
export async function getMetric(
  name: string,
  timeRange: string = "30d",
  interval: string = "1d",
): Promise<Metric> {
  const response = await apiClient.get<Metric>(
    `/metrics/${name}?timeRange=${timeRange}&interval=${interval}`,
  );
  return response["data"];
}

/**
 * Fetch multiple metrics
 */
export async function getMetrics(
  names: string[],
  timeRange: string = "30d",
): Promise<Record<string, Metric>> {
  const response = await apiClient.post<Record<string, Metric>>(`/metrics/batch`, {
    metrics: names,
    timeRange,
  });
  return response["data"];
}

/**
 * Fetch time series data for a metric
 */
export async function getTimeSeriesData(
  metric: string,
  timeRange: string = "7d",
  interval: string = "1h",
): Promise<MetricValue[]> {
  const response = await apiClient.get<MetricValue[]>(
    `/metrics/${metric}/timeseries?timeRange=${timeRange}&interval=${interval}`,
  );
  return response["data"];
}

/**
 * Calculate metric comparison
 */
export function calculateMetricChange(
  current: number,
  previous: number,
): {
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
} {
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

  let trend: "up" | "down" | "stable" = "stable";
  if (Math.abs(changePercent) > 1) {
    trend = changePercent > 0 ? "up" : "down";
  }

  return {
    change,
    changePercent,
    trend,
  };
}

/**
 * Format metric value
 */
export function formatMetricValue(value: number, unit: string): string {
  switch (unit) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);

    case "percent":
      return `${value.toFixed(2)}%`;

    case "number":
      return new Intl.NumberFormat("en-US").format(value);

    default:
      return value.toString();
  }
}

export const metricsService = {
  getDashboardMetrics,
  getBillingMetrics,
  getInfrastructureMetrics,
  getOperationsMetrics,
  getSecurityMetrics,
  getMetric,
  getMetrics,
  getTimeSeriesData,
  calculateMetricChange,
  formatMetricValue,
};

export default metricsService;
