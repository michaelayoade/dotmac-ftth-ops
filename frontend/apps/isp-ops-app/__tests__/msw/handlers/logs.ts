/**
 * MSW Handlers for Logs API Endpoints
 *
 * These handlers intercept logs-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type { LogEntry, LogsResponse, LogStats, LogMetadata } from "../../../hooks/useLogs";
// Import operations helpers to handle operations-style log stats
import {
  createMockLogStats as createMockOperationsLogStats,
  getStoredLogStats as getStoredOperationsLogStats,
} from "./operations";

// In-memory storage for test data
let logs: LogEntry[] = [];
let nextLogId = 1;

// Reset storage between tests
export function resetLogsStorage() {
  logs = [];
  nextLogId = 1;
}

// Helper to create a log entry
export function createMockLogEntry(overrides?: Partial<LogEntry>): LogEntry {
  const id = String(nextLogId);
  // Use nextLogId to ensure older entries have older timestamps
  const timestamp = new Date(Date.now() - (1000 - nextLogId) * 1000).toISOString();
  nextLogId++;

  return {
    id,
    timestamp,
    level: "INFO",
    service: "api-gateway",
    message: `Log message ${id}`,
    metadata: {
      request_id: `req-${id}`,
      tenant_id: "tenant-1",
    },
    ...overrides,
  };
}

// Helper to seed initial data
export function seedLogsData(logsData: LogEntry[]) {
  logs = [...logsData];
}

// Helper to create log statistics
function createLogStats(): LogStats {
  const byLevel: Record<string, number> = {};
  const byService: Record<string, number> = {};

  logs.forEach((log) => {
    byLevel[log.level] = (byLevel[log.level] || 0) + 1;
    byService[log.service] = (byService[log.service] || 0) + 1;
  });

  // Find time range
  const timestamps = logs.map((log) => new Date(log.timestamp).getTime());
  const startTime = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const endTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

  return {
    total: logs.length,
    by_level: byLevel,
    by_service: byService,
    time_range: {
      start: new Date(startTime).toISOString(),
      end: new Date(endTime).toISOString(),
    },
  };
}

// Helper to get unique services
function getUniqueServices(): string[] {
  const services = new Set(logs.map((log) => log.service));
  return Array.from(services).sort();
}

export const logsHandlers = [
  // GET /api/v1/monitoring/logs/stats - Get log statistics
  // NOTE: This MUST come before /api/v1/monitoring/logs to avoid matching "/stats" as a query param
  // NOTE: This handler serves two different APIs:
  // 1. Without 'period' param: Returns log stats for useLogs (by_level, by_service, time_range)
  // 2. With 'period' param: Returns operations log stats for useLogStats (critical_logs, auth_logs, etc.)
  http.get("*/api/v1/monitoring/logs/stats", (req, res, ctx) => {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") as "1h" | "24h" | "7d" | null;

    // If period parameter is present, return operations-style log stats
    if (period) {
      // Check if there's seeded data from operations tests
      const storedStats = getStoredOperationsLogStats(period);
      const operationsStats = storedStats || createMockOperationsLogStats(period);
      return HttpResponse.json(operationsStats);
    }

    // Without period parameter, return logs-style stats
    const stats = createLogStats();
    return HttpResponse.json(stats);
  }),

  // GET /api/v1/monitoring/logs/services - Get list of services
  // NOTE: This MUST come before /api/v1/monitoring/logs to avoid matching "/services" as a query param
  http.get("*/api/v1/monitoring/logs/services", (req, res, ctx) => {
    const services = getUniqueServices();
    return HttpResponse.json(services);
  }),

  // GET /api/v1/monitoring/logs - List logs
  http.get("*/api/v1/monitoring/logs", (req, res, ctx) => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "100");
    const level = url.searchParams.get("level");
    const service = url.searchParams.get("service");
    const search = url.searchParams.get("search");
    const startTime = url.searchParams.get("start_time");
    const endTime = url.searchParams.get("end_time");

    console.log("[MSW] GET /api/v1/monitoring/logs", {
      page,
      pageSize,
      level,
      service,
      search,
      totalLogs: logs.length,
    });

    let filtered = logs;

    // Filter by level
    if (level) {
      filtered = filtered.filter((log) => log.level === level);
    }

    // Filter by service
    if (service) {
      filtered = filtered.filter((log) => log.service === service);
    }

    // Filter by search (search in message and metadata)
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((log) => {
        const messageMatch = log.message.toLowerCase().includes(searchLower);
        const metadataMatch = JSON.stringify(log.metadata).toLowerCase().includes(searchLower);
        return messageMatch || metadataMatch;
      });
    }

    // Filter by time range
    if (startTime) {
      const start = new Date(startTime).getTime();
      filtered = filtered.filter((log) => new Date(log.timestamp).getTime() >= start);
    }

    if (endTime) {
      const end = new Date(endTime).getTime();
      filtered = filtered.filter((log) => new Date(log.timestamp).getTime() <= end);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Paginate
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);
    const hasMore = offset + pageSize < filtered.length;

    console.log("[MSW] Returning", paginated.length, "logs");

    const response: LogsResponse = {
      logs: paginated,
      total: filtered.length,
      page,
      page_size: pageSize,
      has_more: hasMore,
    };

    return HttpResponse.json(response);
  }),
];
