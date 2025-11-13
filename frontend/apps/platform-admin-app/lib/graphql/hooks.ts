/**
 * GraphQL Hooks for Analytics and Metrics
 *
 * This module provides React hooks for fetching analytics and metrics data
 * via GraphQL queries.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";

/**
 * Billing metrics data structure
 */
export interface BillingMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  activeSubscriptions: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  outstandingBalance: number;
  revenueTimeSeries?: Array<{ label: string; value: number }>;
  subscriptionsTimeSeries?: Array<{ label: string; value: number }>;
  // Legacy fields for backwards compatibility
  monthlyRecurringRevenue?: number;
  averageRevenuePerUser?: number;
  churnRate?: number;
  pendingInvoices?: number;
  totalCustomers?: number;
}

/**
 * Customer metrics data structure
 */
export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  customerGrowthRate: number;
  churnRate: number;
  churnedCustomers: number;
  averageLifetimeValue: number;
  retentionRate: number;
  customerTimeSeries?: Array<{ label: string; value: number }>;
  churnTimeSeries?: Array<{ label: string; value: number }>;
  // Legacy fields for backwards compatibility
  newCustomersThisMonth?: number;
  customerSatisfactionScore?: number;
  topCustomersByRevenue?: Array<{
    id: string;
    name: string;
    revenue: number;
  }>;
}

/**
 * Monitoring metrics data structure
 */
export interface MonitoringMetrics {
  totalRequests: number;
  errorRate: number;
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number;
  activeUsers: number;
  systemUptime: number;
  criticalErrors: number;
  warningCount: number;
  requestsTimeSeries?: Array<{ label: string; value: number }>;
  responseTimeTimeSeries?: Array<{ label: string; value: number }>;
  errorRateTimeSeries?: Array<{ label: string; value: number }>;
  // Legacy fields for backwards compatibility
  systemHealth?: "healthy" | "degraded" | "critical";
  uptime?: number;
  responseTime?: number;
  activeConnections?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  recentAlerts?: Array<{
    id: string;
    severity: "info" | "warning" | "error" | "critical";
    message: string;
    timestamp: string;
  }>;
}

/**
 * Hook to fetch billing metrics
 */
export function useBillingMetrics(timeRange: string = "30d") {
  return useQuery<BillingMetrics>({
    queryKey: ["billing-metrics", timeRange],
    queryFn: async () => {
      const response = await apiClient.get<BillingMetrics>(
        `/analytics/billing/metrics?timeRange=${timeRange}`,
      );
      return response.data;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch customer metrics
 */
export function useCustomerMetrics(timeRange: string = "30d") {
  return useQuery<CustomerMetrics>({
    queryKey: ["customer-metrics", timeRange],
    queryFn: async () => {
      const response = await apiClient.get<CustomerMetrics>(
        `/analytics/customers/metrics?timeRange=${timeRange}`,
      );
      return response.data;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch monitoring metrics
 */
export function useMonitoringMetrics() {
  return useQuery<MonitoringMetrics>({
    queryKey: ["monitoring-metrics"],
    queryFn: async () => {
      const response = await apiClient.get<MonitoringMetrics>("/monitoring/metrics");
      return response.data;
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to fetch time-series data for charts
 */
export function useTimeSeriesData(
  metric: string,
  timeRange: string = "7d",
  interval: string = "1h",
) {
  return useQuery({
    queryKey: ["time-series", metric, timeRange, interval],
    queryFn: async () => {
      const response = await apiClient.get(
        `/analytics/time-series/${metric}?timeRange=${timeRange}&interval=${interval}`,
      );
      return response.data;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch aggregated dashboard data
 */
export function useDashboardData(timeRange: string = "30d") {
  return useQuery({
    queryKey: ["dashboard-data", timeRange],
    queryFn: async () => {
      const [billing, customer, monitoring] = await Promise.all([
        apiClient.get(`/analytics/billing/metrics?timeRange=${timeRange}`),
        apiClient.get(`/analytics/customers/metrics?timeRange=${timeRange}`),
        apiClient.get("/monitoring/metrics"),
      ]);

      return {
        billing: billing.data,
        customer: customer.data,
        monitoring: monitoring.data,
      };
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch dashboard overview (alias for useDashboardData)
 */
export function useDashboardOverview(timeRange: string = "30d") {
  return useDashboardData(timeRange);
}
