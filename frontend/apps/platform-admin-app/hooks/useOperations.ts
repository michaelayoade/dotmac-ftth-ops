/**
 * React Query hooks for operations monitoring
 *
 * Connects to backend monitoring APIs:
 * - GET /api/v1/monitoring/metrics - Get system metrics
 * - GET /api/v1/monitoring/logs/stats - Get log statistics
 * - GET /health - Get system health status
 */

import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

// ============================================
// Types matching backend monitoring models
// ============================================

export interface MonitoringMetrics {
  // System health
  error_rate: number;
  critical_errors: number;
  warning_count: number;

  // Performance metrics
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  p99_response_time_ms: number;

  // Request metrics
  total_requests: number;
  successful_requests: number;
  failed_requests: number;

  // Activity breakdown
  api_requests: number;
  user_activities: number;
  system_activities: number;

  // Resource indicators
  high_latency_requests: number;
  timeout_count: number;

  // Top errors
  top_errors: Array<{
    error_type: string;
    count: number;
    last_seen: string;
  }>;

  // Time period
  period: string;
  timestamp: string;
}

export interface LogStats {
  // Log counts by severity
  total_logs: number;
  critical_logs: number;
  high_logs: number;
  medium_logs: number;
  low_logs: number;

  // Activity types
  auth_logs: number;
  api_logs: number;
  system_logs: number;
  secret_logs: number;
  file_logs: number;

  // Error analysis
  error_logs: number;
  unique_error_types: number;
  most_common_errors: Array<{
    error_type: string;
    count: number;
    severity: string;
  }>;

  // User activity
  unique_users: number;
  unique_ips: number;

  // Time period
  period: string;
  timestamp: string;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    database: ServiceHealth;
    redis: ServiceHealth;
    vault?: ServiceHealth;
    storage?: ServiceHealth;
  };
  timestamp: string;
}

export interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  required: boolean;
}

// ============================================
// Query Hooks
// ============================================

type QueryOptions<TData, TKey extends QueryKey> = Omit<
  UseQueryOptions<TData, Error, TData, TKey>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch monitoring metrics
 */
export function useMonitoringMetrics(
  period: "1h" | "24h" | "7d" = "24h",
  options?: QueryOptions<MonitoringMetrics, ["monitoring", "metrics", "1h" | "24h" | "7d"]>,
) {
  return useQuery<
    MonitoringMetrics,
    Error,
    MonitoringMetrics,
    ["monitoring", "metrics", "1h" | "24h" | "7d"]
  >({
    queryKey: ["monitoring", "metrics", period],
    queryFn: async () => {
      const response = await apiClient.get<MonitoringMetrics>("/monitoring/metrics", {
        params: { period },
      });
      return extractDataOrThrow(response, "Failed to load monitoring metrics");
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    ...options,
  });
}

/**
 * Fetch log statistics
 */
export function useLogStats(
  period: "1h" | "24h" | "7d" = "24h",
  options?: QueryOptions<LogStats, ["monitoring", "logs", "stats", "1h" | "24h" | "7d"]>,
) {
  return useQuery<LogStats, Error, LogStats, ["monitoring", "logs", "stats", "1h" | "24h" | "7d"]>({
    queryKey: ["monitoring", "logs", "stats", period],
    queryFn: async () => {
      const response = await apiClient.get<LogStats>("/monitoring/logs/stats", {
        params: { period },
      });
      return extractDataOrThrow(response, "Failed to load log statistics");
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    ...options,
  });
}

/**
 * Fetch system health
 */
export function useSystemHealth(options?: QueryOptions<SystemHealth, ["system", "health"]>) {
  return useQuery<SystemHealth, Error, SystemHealth, ["system", "health"]>({
    queryKey: ["system", "health"],
    queryFn: async () => {
      const response = await apiClient.get<SystemHealth>("/health");
      return extractDataOrThrow(response, "Failed to load system health");
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    ...options,
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get status color class
 */
export function getStatusColor(status: "healthy" | "degraded" | "unhealthy"): string {
  const colors = {
    healthy: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    degraded: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
    unhealthy: "text-red-400 bg-red-500/15 border-red-500/30",
  };
  return colors[status] || colors.unhealthy;
}

/**
 * Get status icon
 */
export function getStatusIcon(status: "healthy" | "degraded" | "unhealthy"): string {
  const icons = {
    healthy: "✓",
    degraded: "⚠",
    unhealthy: "✗",
  };
  return icons[status] || icons.unhealthy;
}

/**
 * Calculate success rate
 */
export function calculateSuccessRate(successful: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((successful / total) * 100 * 100) / 100;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get health status text
 */
export function getHealthStatusText(status: "healthy" | "degraded" | "unhealthy"): string {
  const texts = {
    healthy: "All systems operational",
    degraded: "Some systems degraded",
    unhealthy: "System issues detected",
  };
  return texts[status] || texts.unhealthy;
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: string): string {
  const severityLower = severity.toLowerCase();
  if (severityLower === "critical") return "text-red-400";
  if (severityLower === "high") return "text-orange-400";
  if (severityLower === "medium") return "text-yellow-400";
  return "text-gray-400";
}
