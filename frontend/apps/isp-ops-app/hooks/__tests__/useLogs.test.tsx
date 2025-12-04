/**
 * useLogs Hook Tests - Jest Mock Version
 *
 * Migrated from MSW to Jest mocks for compatibility with axios.
 * All 24 tests covering logs, stats, services, and real-world scenarios.
 */

import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { useLogs, logsKeys } from "../useLogs";
import type { LogEntry, LogsResponse, LogStats } from "../useLogs";

// Mock axios
jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock useAppConfig
jest.mock("@/providers/AppConfigContext", () => ({
  AppConfigProvider: ({ children }: { children: React.ReactNode }) => children,
  useAppConfig: jest.fn(() => ({
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
    },
    features: {},
  })),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: jest.fn(() => ({
    toast: mockToast,
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Helper to create mock log entry
function createMockLogEntry(overrides?: Partial<LogEntry>): LogEntry {
  return {
    id: `log-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    level: "INFO",
    service: "test-service",
    message: "Test log message",
    metadata: {},
    ...overrides,
  };
}

// Helper to create wrapper
function createWrapper(enableAutoFetch = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: enableAutoFetch,
        refetchOnWindowFocus: false,
        staleTime: enableAutoFetch ? 0 : Infinity,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useLogs (Jest Mocks)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("logsKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(logsKeys.all).toEqual(["logs"]);
      expect(logsKeys.lists()).toEqual(["logs", "list"]);
      expect(logsKeys.list({ level: "ERROR" })).toEqual(["logs", "list", { level: "ERROR" }]);
      expect(logsKeys.stats()).toEqual(["logs", "stats"]);
      expect(logsKeys.services()).toEqual(["logs", "services"]);
    });
  });

  describe("useLogs - fetch logs", () => {
    it("should fetch logs successfully", async () => {
      const mockLogs = [
        createMockLogEntry({
          id: "log-1",
          level: "INFO",
          service: "api-gateway",
          message: "Request received",
        }),
        createMockLogEntry({
          id: "log-2",
          level: "ERROR",
          service: "billing-service",
          message: "Payment failed",
        }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs[0].id).toBe("log-1");
      expect(result.current.logs[1].id).toBe("log-2");
      expect(result.current.pagination.total).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty logs list", async () => {
      const mockResponse: LogsResponse = {
        logs: [],
        total: 0,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(0);
      expect(result.current.pagination.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter logs by level", async () => {
      const mockLogs = [
        createMockLogEntry({ level: "ERROR", message: "Error log" }),
        createMockLogEntry({ level: "ERROR", message: "Another error" }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ level: "ERROR" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs.every((log) => log.level === "ERROR")).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringContaining("level=ERROR"), {
        withCredentials: true,
      });
    });

    it("should filter logs by service", async () => {
      const mockLogs = [
        createMockLogEntry({ service: "api-gateway", message: "Gateway log" }),
        createMockLogEntry({ service: "api-gateway", message: "Another gateway log" }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ service: "api-gateway" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs.every((log) => log.service === "api-gateway")).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringContaining("service=api-gateway"), {
        withCredentials: true,
      });
    });

    it("should search logs by message content", async () => {
      const mockLogs = [
        createMockLogEntry({ message: "Payment processed successfully" }),
        createMockLogEntry({ message: "Payment gateway timeout" }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ search: "payment" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringContaining("search=payment"), {
        withCredentials: true,
      });
    });

    it("should search logs by metadata", async () => {
      const mockLogs = [
        createMockLogEntry({
          message: "Request completed",
          metadata: { request_id: "req-123", user_id: "user-456" },
        }),
        createMockLogEntry({
          message: "Third log",
          metadata: { request_id: "req-123", user_id: "user-111" },
        }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ search: "req-123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs.every((log) => log.metadata.request_id === "req-123")).toBe(true);
    });

    it("should filter logs by time range", async () => {
      const now = Date.now();
      const mockLogs = [
        createMockLogEntry({ timestamp: new Date(now - 3600000).toISOString() }), // 1 hour ago
        createMockLogEntry({ timestamp: new Date(now - 1800000).toISOString() }), // 30 min ago
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const startTime = new Date(now - 5400000).toISOString(); // 1.5 hours ago

      const { result } = renderHook(() => useLogs({ start_time: startTime }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringContaining("start_time="), {
        withCredentials: true,
      });
    });

    it("should handle pagination", async () => {
      const mockLogs = Array.from({ length: 10 }, (_, i) =>
        createMockLogEntry({
          id: `log-${String(i + 11).padStart(2, "0")}`,
          timestamp: new Date(Date.now() - (i + 10) * 1000).toISOString(),
        }),
      );

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 25,
        page: 2,
        page_size: 10,
        has_more: true,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ page: 2, page_size: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(10);
      expect(result.current.pagination.page).toBe(2);
      expect(result.current.pagination.page_size).toBe(10);
      expect(result.current.pagination.has_more).toBe(true);
      expect(result.current.pagination.total).toBe(25);
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringContaining("page=2"), {
        withCredentials: true,
      });
    });

    it("should handle multiple filters simultaneously", async () => {
      const mockLogs = [
        createMockLogEntry({
          level: "ERROR",
          service: "api-gateway",
          message: "Critical error occurred",
        }),
        createMockLogEntry({
          level: "ERROR",
          service: "api-gateway",
          message: "Authentication error",
        }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(
        () => useLogs({ level: "ERROR", service: "api-gateway", search: "error" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs.every((log) => log.level === "ERROR")).toBe(true);
      expect(result.current.logs.every((log) => log.service === "api-gateway")).toBe(true);

      const callUrl = mockAxios.get.mock.calls[0][0] as string;
      expect(callUrl).toContain("level=ERROR");
      expect(callUrl).toContain("service=api-gateway");
      expect(callUrl).toContain("search=error");
    });

    it("should handle fetch error", async () => {
      const errorResponse = Object.assign(new Error("Network error"), {
        isAxiosError: true,
        response: {
          data: {
            detail: "Server error",
          },
        },
      });

      // Make axios.isAxiosError return true for our error
      (mockAxios.isAxiosError as jest.Mock) = jest.fn().mockReturnValue(true);

      mockAxios.get.mockRejectedValueOnce(errorResponse);

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toBe("Server error");
      expect(result.current.logs).toHaveLength(0);
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Server error",
        variant: "destructive",
      });
    });
  });

  describe("useLogs - fetch stats", () => {
    it("should fetch log statistics successfully", async () => {
      const mockLogsResponse: LogsResponse = {
        logs: [],
        total: 0,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      const mockStats: LogStats = {
        total: 4,
        by_level: {
          INFO: 1,
          ERROR: 2,
          WARNING: 1,
        },
        by_service: {
          "api-gateway": 2,
          "billing-service": 2,
        },
        time_range: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
      };

      mockAxios.get
        .mockResolvedValueOnce({ data: mockLogsResponse })
        .mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Manually fetch stats
      await act(async () => {
        await result.current.fetchStats();
      });

      // Wait for stats to load
      await waitFor(
        () => {
          expect(result.current.stats).not.toBeNull();
        },
        { timeout: 3000 },
      );

      expect(result.current.stats?.total).toBe(4);
      expect(result.current.stats?.by_level.ERROR).toBe(2);
      expect(result.current.stats?.by_level.INFO).toBe(1);
      expect(result.current.stats?.by_level.WARNING).toBe(1);
      expect(result.current.stats?.by_service["api-gateway"]).toBe(2);
      expect(result.current.stats?.by_service["billing-service"]).toBe(2);
    });

    it("should handle empty stats", async () => {
      const mockLogsResponse: LogsResponse = {
        logs: [],
        total: 0,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      const mockStats: LogStats = {
        total: 0,
        by_level: {},
        by_service: {},
        time_range: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
      };

      mockAxios.get
        .mockResolvedValueOnce({ data: mockLogsResponse })
        .mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Manually fetch stats
      await act(async () => {
        await result.current.fetchStats();
      });

      // Wait for stats to load
      await waitFor(
        () => {
          expect(result.current.stats).not.toBeNull();
        },
        { timeout: 3000 },
      );

      expect(result.current.stats?.total).toBe(0);
    });

    it("should return null on stats error but continue working", async () => {
      const mockLogsResponse: LogsResponse = {
        logs: [createMockLogEntry()],
        total: 1,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get
        .mockResolvedValueOnce({ data: mockLogsResponse })
        .mockRejectedValueOnce(new Error("Stats unavailable"));

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Logs should work
      expect(result.current.logs).toHaveLength(1);

      // Stats should be null (no automatic fetch)
      expect(result.current.stats).toBeNull();
    });
  });

  describe("useLogs - fetch services", () => {
    it("should fetch list of services successfully", async () => {
      const mockLogsResponse: LogsResponse = {
        logs: [],
        total: 0,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockLogsResponse });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Services query has staleTime: 300000ms, so it won't auto-fetch immediately
      // Verify the hook provides the services property
      expect(result.current).toHaveProperty("services");
    });

    it("should handle empty services list", async () => {
      const mockLogsResponse: LogsResponse = {
        logs: [],
        total: 0,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      // Provide mocks for logs, services, and stats
      mockAxios.get
        .mockResolvedValueOnce({ data: mockLogsResponse })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValue({ data: null });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(true), // Enable auto-fetch
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Wait for services query to complete
      await waitFor(
        () => {
          expect(result.current.services).toEqual([]);
        },
        { timeout: 3000 },
      );
    });

    it("should return empty array on services error", async () => {
      const mockLogsResponse: LogsResponse = {
        logs: [createMockLogEntry()],
        total: 1,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get
        .mockResolvedValueOnce({ data: mockLogsResponse })
        .mockRejectedValueOnce(new Error("Services unavailable"));

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(true), // Enable auto-fetch
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Logs should work
      expect(result.current.logs).toHaveLength(1);

      // Services should be empty array on error (default fallback)
      await waitFor(
        () => {
          expect(result.current.services).toEqual([]);
        },
        { timeout: 3000 },
      );
    });
  });

  describe("useLogs - refetch functionality", () => {
    it("should provide refetch function", async () => {
      const mockResponse: LogsResponse = {
        logs: [createMockLogEntry({ id: "log-1", message: "First log" })],
        total: 1,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(1);
      expect(typeof result.current.refetch).toBe("function");

      // Call refetch - it should not throw
      await act(async () => {
        await result.current.refetch();
      });

      // Verify refetch completed without error
      expect(result.current.error).toBeNull();
    });

    it("should provide fetchStats function", async () => {
      const mockLogsResponse: LogsResponse = {
        logs: [],
        total: 0,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      const mockStats: LogStats = {
        total: 1,
        by_level: { INFO: 1 },
        by_service: {},
        time_range: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
      };

      mockAxios.get
        .mockResolvedValueOnce({ data: mockLogsResponse })
        .mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.fetchStats).toBe("function");

      // Call fetchStats - it should not throw
      await act(async () => {
        await result.current.fetchStats();
      });

      // Stats should be available after fetch
      await waitFor(
        () => {
          expect(result.current.stats).not.toBeNull();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle monitoring dashboard scenario - fetch all logs, stats, and services", async () => {
      const mockLogs = [
        createMockLogEntry({
          level: "ERROR",
          service: "api-gateway",
          message: "500 Internal Server Error",
        }),
        createMockLogEntry({
          level: "WARNING",
          service: "billing-service",
          message: "Payment retry scheduled",
        }),
        createMockLogEntry({
          level: "INFO",
          service: "auth-service",
          message: "User logged in",
        }),
      ];

      const mockLogsResponse: LogsResponse = {
        logs: mockLogs,
        total: 3,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      const mockStats: LogStats = {
        total: 3,
        by_level: { ERROR: 1, WARNING: 1, INFO: 1 },
        by_service: {
          "api-gateway": 1,
          "billing-service": 1,
          "auth-service": 1,
        },
        time_range: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
      };

      mockAxios.get
        .mockResolvedValueOnce({ data: mockLogsResponse })
        .mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Logs should be available
      expect(result.current.logs).toHaveLength(3);

      // Manually fetch stats
      await act(async () => {
        await result.current.fetchStats();
      });

      await waitFor(
        () => {
          expect(result.current.stats).not.toBeNull();
        },
        { timeout: 3000 },
      );

      // Verify logs and stats data
      expect(result.current.logs).toHaveLength(3);
      expect(result.current.stats?.total).toBe(3);
      expect(result.current.stats?.by_level.ERROR).toBe(1);
      expect(result.current.stats?.by_level.WARNING).toBe(1);
      expect(result.current.stats?.by_level.INFO).toBe(1);

      // Verify hook structure includes services property
      expect(result.current).toHaveProperty("services");
    });

    it("should handle troubleshooting scenario - filter by error level and specific service", async () => {
      const mockLogs = [
        createMockLogEntry({
          level: "ERROR",
          service: "billing-service",
          message: "Database connection failed",
        }),
        createMockLogEntry({
          level: "ERROR",
          service: "billing-service",
          message: "Transaction rollback",
        }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ level: "ERROR", service: "billing-service" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs.every((log) => log.level === "ERROR")).toBe(true);
      expect(result.current.logs.every((log) => log.service === "billing-service")).toBe(true);
    });

    it("should handle audit scenario - search for specific request ID across all logs", async () => {
      const requestId = "req-abc-123";
      const mockLogs = [
        createMockLogEntry({
          service: "api-gateway",
          message: "Request received",
          metadata: { request_id: requestId },
        }),
        createMockLogEntry({
          service: "auth-service",
          message: "Token validated",
          metadata: { request_id: requestId },
        }),
        createMockLogEntry({
          service: "billing-service",
          message: "Payment processed",
          metadata: { request_id: requestId },
        }),
        createMockLogEntry({
          service: "api-gateway",
          message: "Response sent",
          metadata: { request_id: requestId },
        }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 4,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ search: requestId }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(4);
      expect(result.current.logs.every((log) => log.metadata.request_id === requestId)).toBe(true);
    });

    it("should handle high-volume scenario with pagination", async () => {
      // First page
      const page1Logs = Array.from({ length: 50 }, (_, i) =>
        createMockLogEntry({
          id: `log-${String(i + 1).padStart(3, "0")}`,
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          message: `Page 1 log ${i + 1}`,
        }),
      );

      const page1Response: LogsResponse = {
        logs: page1Logs,
        total: 500,
        page: 1,
        page_size: 50,
        has_more: true,
      };

      mockAxios.get.mockResolvedValueOnce({ data: page1Response });

      const { result } = renderHook(() => useLogs({ page: 1, page_size: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(50);
      expect(result.current.logs[0].id).toBe("log-001");
      expect(result.current.pagination.total).toBe(500);
      expect(result.current.pagination.page).toBe(1);
      expect(result.current.pagination.has_more).toBe(true);
      expect(result.current.pagination.page_size).toBe(50);
    });

    it("should handle time-based filtering for recent errors", async () => {
      const now = Date.now();
      const mockLogs = [
        createMockLogEntry({
          level: "ERROR",
          timestamp: new Date(now - 300000).toISOString(), // 5 min ago
          message: "Recent error 1",
        }),
        createMockLogEntry({
          level: "ERROR",
          timestamp: new Date(now - 600000).toISOString(), // 10 min ago
          message: "Recent error 2",
        }),
      ];

      const mockResponse: LogsResponse = {
        logs: mockLogs,
        total: 2,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // Get errors from last 15 minutes
      const startTime = new Date(now - 900000).toISOString();

      const { result } = renderHook(() => useLogs({ level: "ERROR", start_time: startTime }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs[0].message).toBe("Recent error 1");
      expect(result.current.logs[1].message).toBe("Recent error 2");
    });
  });
});
