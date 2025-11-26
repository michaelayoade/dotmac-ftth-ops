/**
 * MSW Handlers for Operations/Monitoring API Endpoints
 */

import { http, HttpResponse } from "msw";
import type {
  MonitoringMetrics,
  LogStats,
  SystemHealth,
  ServiceHealth,
} from "../../../hooks/useOperations";

// In-memory storage for test data
let metrics: Record<string, MonitoringMetrics> = {};
let logStats: Record<string, LogStats> = {};
let systemHealth: SystemHealth | null = null;

// Reset storage between tests
export function resetOperationsStorage() {
  metrics = {};
  logStats = {};
  systemHealth = null;
}

// Helper to create mock metrics
export function createMockMetrics(
  period: "1h" | "24h" | "7d" = "24h",
  overrides?: Partial<MonitoringMetrics>,
): MonitoringMetrics {
  return {
    error_rate: 2.5,
    critical_errors: 3,
    warning_count: 15,
    avg_response_time_ms: 250,
    p95_response_time_ms: 800,
    p99_response_time_ms: 1500,
    total_requests: 10000,
    successful_requests: 9750,
    failed_requests: 250,
    api_requests: 7500,
    user_activities: 2000,
    system_activities: 500,
    high_latency_requests: 45,
    timeout_count: 5,
    top_errors: [
      {
        error_type: "DATABASE_TIMEOUT",
        count: 12,
        last_seen: new Date().toISOString(),
      },
      {
        error_type: "VALIDATION_ERROR",
        count: 8,
        last_seen: new Date().toISOString(),
      },
    ],
    period,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock log stats
export function createMockLogStats(
  period: "1h" | "24h" | "7d" = "24h",
  overrides?: Partial<LogStats>,
): LogStats {
  return {
    total_logs: 5000,
    critical_logs: 5,
    high_logs: 25,
    medium_logs: 150,
    low_logs: 4820,
    auth_logs: 1200,
    api_logs: 2500,
    system_logs: 800,
    secret_logs: 300,
    file_logs: 200,
    error_logs: 75,
    unique_error_types: 12,
    most_common_errors: [
      {
        error_type: "AUTH_FAILED",
        count: 25,
        severity: "medium",
      },
      {
        error_type: "RATE_LIMIT",
        count: 18,
        severity: "low",
      },
    ],
    unique_users: 45,
    unique_ips: 67,
    period,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock service health
export function createMockOperationsServiceHealth(
  overrides?: Partial<ServiceHealth>,
): ServiceHealth {
  return {
    name: "database",
    status: "healthy",
    message: "All systems operational",
    required: true,
    ...overrides,
  };
}

// Helper to create mock system health
export function createMockSystemHealth(overrides?: Partial<SystemHealth>): SystemHealth {
  return {
    status: "healthy",
    checks: {
      database: createMockOperationsServiceHealth({ name: "database" }),
      redis: createMockOperationsServiceHealth({ name: "redis" }),
      vault: createMockOperationsServiceHealth({ name: "vault", required: false }),
      storage: createMockOperationsServiceHealth({ name: "storage", required: false }),
    },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed test data
export function seedOperationsData(
  metricsData?: Record<string, MonitoringMetrics>,
  logStatsData?: Record<string, LogStats>,
  healthData?: SystemHealth,
) {
  if (metricsData) {
    metrics = { ...metricsData };
  }
  if (logStatsData) {
    logStats = { ...logStatsData };
  }
  if (healthData) {
    systemHealth = healthData;
  }
}

// Helper to get stored log stats (used by logs handler)
export function getStoredLogStats(period: string): LogStats | undefined {
  return logStats[period];
}

export const operationsHandlers = [
  // GET /api/v1/monitoring/metrics - Get monitoring metrics
  http.get("*/api/v1/monitoring/metrics", (req, res, ctx) => {
    const url = new URL(req.url);
    const period = (url.searchParams.get("period") || "24h") as "1h" | "24h" | "7d";

    // Return stored metrics or create default
    const metricsData = metrics[period] || createMockMetrics(period);

    return HttpResponse.json(metricsData);
  }),

  // GET /api/v1/monitoring/logs/stats - Get log statistics
  http.get("*/api/v1/monitoring/logs/stats", (req, res, ctx) => {
    const url = new URL(req.url);
    const period = (url.searchParams.get("period") || "24h") as "1h" | "24h" | "7d";

    // Return stored log stats or create default
    const statsData = logStats[period] || createMockLogStats(period);

    return HttpResponse.json(statsData);
  }),

  // GET /health - Get system health status
  http.get("*/health", (req, res, ctx) => {
    // Return stored health or create default
    const healthData = systemHealth || createMockSystemHealth();

    return HttpResponse.json(healthData);
  }),
];
