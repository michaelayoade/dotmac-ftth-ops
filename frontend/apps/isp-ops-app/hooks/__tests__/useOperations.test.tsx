/**
 * Tests for useOperations hook
 * Tests monitoring and operations functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useMonitoringMetrics,
  useLogStats,
  useSystemHealth,
  getStatusColor,
  getStatusIcon,
  calculateSuccessRate,
  formatPercentage,
  formatDuration,
  getHealthStatusText,
  getSeverityColor,
  MonitoringMetrics,
  LogStats,
  SystemHealth,
  ServiceHealth,
} from "../useOperations";
import { apiClient } from "@/lib/api/client";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useOperations", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Monitoring Metrics ====================

  describe("useMonitoringMetrics", () => {
    it("should fetch monitoring metrics successfully", async () => {
      const mockMetrics: MonitoringMetrics = {
        error_rate: 2.5,
        critical_errors: 5,
        warning_count: 10,
        avg_response_time_ms: 150,
        p95_response_time_ms: 300,
        p99_response_time_ms: 500,
        total_requests: 1000,
        successful_requests: 975,
        failed_requests: 25,
        api_requests: 800,
        user_activities: 150,
        system_activities: 50,
        high_latency_requests: 20,
        timeout_count: 3,
        top_errors: [
          {
            error_type: "ValidationError",
            count: 10,
            last_seen: "2024-01-01T00:00:00Z",
          },
          {
            error_type: "DatabaseError",
            count: 5,
            last_seen: "2024-01-01T00:10:00Z",
          },
        ],
        period: "24h",
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockMetrics);
      expect(result.current.isSuccess).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/monitoring/metrics", {
        params: { period: "24h" },
      });
    });

    it("should fetch metrics with 1h period", async () => {
      const mockMetrics: MonitoringMetrics = {
        error_rate: 1.0,
        critical_errors: 1,
        warning_count: 3,
        avg_response_time_ms: 100,
        p95_response_time_ms: 200,
        p99_response_time_ms: 350,
        total_requests: 100,
        successful_requests: 99,
        failed_requests: 1,
        api_requests: 80,
        user_activities: 15,
        system_activities: 5,
        high_latency_requests: 2,
        timeout_count: 0,
        top_errors: [],
        period: "1h",
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics("1h"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockMetrics);
      expect(apiClient.get).toHaveBeenCalledWith("/monitoring/metrics", {
        params: { period: "1h" },
      });
    });

    it("should fetch metrics with 7d period", async () => {
      const mockMetrics: MonitoringMetrics = {
        error_rate: 3.2,
        critical_errors: 15,
        warning_count: 50,
        avg_response_time_ms: 180,
        p95_response_time_ms: 400,
        p99_response_time_ms: 600,
        total_requests: 50000,
        successful_requests: 48400,
        failed_requests: 1600,
        api_requests: 40000,
        user_activities: 8000,
        system_activities: 2000,
        high_latency_requests: 500,
        timeout_count: 50,
        top_errors: [
          {
            error_type: "TimeoutError",
            count: 30,
            last_seen: "2024-01-07T23:00:00Z",
          },
        ],
        period: "7d",
        timestamp: "2024-01-07T23:59:59Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics("7d"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockMetrics);
      expect(apiClient.get).toHaveBeenCalledWith("/monitoring/metrics", {
        params: { period: "7d" },
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch monitoring metrics");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    error_rate: 0,
                    critical_errors: 0,
                    warning_count: 0,
                    avg_response_time_ms: 100,
                    p95_response_time_ms: 200,
                    p99_response_time_ms: 300,
                    total_requests: 0,
                    successful_requests: 0,
                    failed_requests: 0,
                    api_requests: 0,
                    user_activities: 0,
                    system_activities: 0,
                    high_latency_requests: 0,
                    timeout_count: 0,
                    top_errors: [],
                    period: "24h",
                    timestamp: "2024-01-01T00:00:00Z",
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should auto-refetch every 30 seconds", async () => {
      jest.useFakeTimers();

      const mockMetrics: MonitoringMetrics = {
        error_rate: 0,
        critical_errors: 0,
        warning_count: 0,
        avg_response_time_ms: 100,
        p95_response_time_ms: 200,
        p99_response_time_ms: 300,
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        api_requests: 0,
        user_activities: 0,
        system_activities: 0,
        high_latency_requests: 0,
        timeout_count: 0,
        top_errors: [],
        period: "24h",
        timestamp: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle metrics with zero values", async () => {
      const mockMetrics: MonitoringMetrics = {
        error_rate: 0,
        critical_errors: 0,
        warning_count: 0,
        avg_response_time_ms: 0,
        p95_response_time_ms: 0,
        p99_response_time_ms: 0,
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        api_requests: 0,
        user_activities: 0,
        system_activities: 0,
        high_latency_requests: 0,
        timeout_count: 0,
        top_errors: [],
        period: "24h",
        timestamp: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockMetrics);
      expect(result.current.data?.total_requests).toBe(0);
    });

    it("should accept custom query options", async () => {
      const mockMetrics: MonitoringMetrics = {
        error_rate: 0,
        critical_errors: 0,
        warning_count: 0,
        avg_response_time_ms: 100,
        p95_response_time_ms: 200,
        p99_response_time_ms: 300,
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        api_requests: 0,
        user_activities: 0,
        system_activities: 0,
        high_latency_requests: 0,
        timeout_count: 0,
        top_errors: [],
        period: "24h",
        timestamp: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics("24h", { enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle metrics with multiple top errors", async () => {
      const mockMetrics: MonitoringMetrics = {
        error_rate: 5.0,
        critical_errors: 20,
        warning_count: 30,
        avg_response_time_ms: 200,
        p95_response_time_ms: 500,
        p99_response_time_ms: 800,
        total_requests: 1000,
        successful_requests: 950,
        failed_requests: 50,
        api_requests: 800,
        user_activities: 150,
        system_activities: 50,
        high_latency_requests: 40,
        timeout_count: 10,
        top_errors: [
          {
            error_type: "ValidationError",
            count: 20,
            last_seen: "2024-01-01T00:00:00Z",
          },
          {
            error_type: "DatabaseError",
            count: 15,
            last_seen: "2024-01-01T00:10:00Z",
          },
          {
            error_type: "AuthenticationError",
            count: 10,
            last_seen: "2024-01-01T00:20:00Z",
          },
          {
            error_type: "TimeoutError",
            count: 5,
            last_seen: "2024-01-01T00:30:00Z",
          },
        ],
        period: "24h",
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.top_errors).toHaveLength(4);
      expect(result.current.data?.top_errors[0].error_type).toBe("ValidationError");
    });
  });

  // ==================== Log Statistics ====================

  describe("useLogStats", () => {
    it("should fetch log statistics successfully", async () => {
      const mockStats: LogStats = {
        total_logs: 5000,
        critical_logs: 10,
        high_logs: 50,
        medium_logs: 200,
        low_logs: 4740,
        auth_logs: 500,
        api_logs: 3000,
        system_logs: 1000,
        secret_logs: 300,
        file_logs: 200,
        error_logs: 100,
        unique_error_types: 15,
        most_common_errors: [
          {
            error_type: "ValidationError",
            count: 30,
            severity: "medium",
          },
          {
            error_type: "DatabaseError",
            count: 20,
            severity: "high",
          },
        ],
        unique_users: 50,
        unique_ips: 35,
        period: "24h",
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(result.current.isSuccess).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/monitoring/logs/stats", {
        params: { period: "24h" },
      });
    });

    it("should fetch log stats with 1h period", async () => {
      const mockStats: LogStats = {
        total_logs: 500,
        critical_logs: 1,
        high_logs: 5,
        medium_logs: 20,
        low_logs: 474,
        auth_logs: 50,
        api_logs: 300,
        system_logs: 100,
        secret_logs: 30,
        file_logs: 20,
        error_logs: 10,
        unique_error_types: 5,
        most_common_errors: [],
        unique_users: 10,
        unique_ips: 8,
        period: "1h",
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogStats("1h"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(apiClient.get).toHaveBeenCalledWith("/monitoring/logs/stats", {
        params: { period: "1h" },
      });
    });

    it("should fetch log stats with 7d period", async () => {
      const mockStats: LogStats = {
        total_logs: 100000,
        critical_logs: 50,
        high_logs: 300,
        medium_logs: 2000,
        low_logs: 97650,
        auth_logs: 10000,
        api_logs: 60000,
        system_logs: 20000,
        secret_logs: 6000,
        file_logs: 4000,
        error_logs: 2000,
        unique_error_types: 50,
        most_common_errors: [
          {
            error_type: "TimeoutError",
            count: 500,
            severity: "high",
          },
          {
            error_type: "ConnectionError",
            count: 300,
            severity: "critical",
          },
        ],
        unique_users: 200,
        unique_ips: 150,
        period: "7d",
        timestamp: "2024-01-07T23:59:59Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogStats("7d"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(apiClient.get).toHaveBeenCalledWith("/monitoring/logs/stats", {
        params: { period: "7d" },
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch log statistics");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    total_logs: 0,
                    critical_logs: 0,
                    high_logs: 0,
                    medium_logs: 0,
                    low_logs: 0,
                    auth_logs: 0,
                    api_logs: 0,
                    system_logs: 0,
                    secret_logs: 0,
                    file_logs: 0,
                    error_logs: 0,
                    unique_error_types: 0,
                    most_common_errors: [],
                    unique_users: 0,
                    unique_ips: 0,
                    period: "24h",
                    timestamp: "2024-01-01T00:00:00Z",
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should auto-refetch every 30 seconds", async () => {
      jest.useFakeTimers();

      const mockStats: LogStats = {
        total_logs: 0,
        critical_logs: 0,
        high_logs: 0,
        medium_logs: 0,
        low_logs: 0,
        auth_logs: 0,
        api_logs: 0,
        system_logs: 0,
        secret_logs: 0,
        file_logs: 0,
        error_logs: 0,
        unique_error_types: 0,
        most_common_errors: [],
        unique_users: 0,
        unique_ips: 0,
        period: "24h",
        timestamp: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle log stats with empty errors array", async () => {
      const mockStats: LogStats = {
        total_logs: 1000,
        critical_logs: 0,
        high_logs: 0,
        medium_logs: 0,
        low_logs: 1000,
        auth_logs: 500,
        api_logs: 400,
        system_logs: 100,
        secret_logs: 0,
        file_logs: 0,
        error_logs: 0,
        unique_error_types: 0,
        most_common_errors: [],
        unique_users: 25,
        unique_ips: 20,
        period: "24h",
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.most_common_errors).toEqual([]);
      expect(result.current.data?.error_logs).toBe(0);
    });

    it("should accept custom query options", async () => {
      const mockStats: LogStats = {
        total_logs: 0,
        critical_logs: 0,
        high_logs: 0,
        medium_logs: 0,
        low_logs: 0,
        auth_logs: 0,
        api_logs: 0,
        system_logs: 0,
        secret_logs: 0,
        file_logs: 0,
        error_logs: 0,
        unique_error_types: 0,
        most_common_errors: [],
        unique_users: 0,
        unique_ips: 0,
        period: "24h",
        timestamp: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogStats("24h", { enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  // ==================== System Health ====================

  describe("useSystemHealth", () => {
    it("should fetch system health successfully", async () => {
      const mockHealth: SystemHealth = {
        status: "healthy",
        checks: {
          database: {
            name: "Database",
            status: "healthy",
            message: "Connected to PostgreSQL",
            required: true,
          },
          redis: {
            name: "Redis",
            status: "healthy",
            message: "Connected to Redis",
            required: true,
          },
          vault: {
            name: "Vault",
            status: "healthy",
            message: "Connected to Vault",
            required: false,
          },
          storage: {
            name: "Storage",
            status: "healthy",
            message: "MinIO is operational",
            required: false,
          },
        },
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockHealth);
      expect(result.current.isSuccess).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/health");
    });

    it("should handle degraded system status", async () => {
      const mockHealth: SystemHealth = {
        status: "degraded",
        checks: {
          database: {
            name: "Database",
            status: "healthy",
            message: "Connected to PostgreSQL",
            required: true,
          },
          redis: {
            name: "Redis",
            status: "degraded",
            message: "High latency detected",
            required: true,
          },
        },
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("degraded");
      expect(result.current.data?.checks.redis.status).toBe("degraded");
    });

    it("should handle unhealthy system status", async () => {
      const mockHealth: SystemHealth = {
        status: "unhealthy",
        checks: {
          database: {
            name: "Database",
            status: "unhealthy",
            message: "Cannot connect to PostgreSQL",
            required: true,
          },
          redis: {
            name: "Redis",
            status: "healthy",
            message: "Connected to Redis",
            required: true,
          },
        },
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("unhealthy");
      expect(result.current.data?.checks.database.status).toBe("unhealthy");
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch system health");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    status: "healthy",
                    checks: {
                      database: {
                        name: "Database",
                        status: "healthy",
                        message: "OK",
                        required: true,
                      },
                      redis: {
                        name: "Redis",
                        status: "healthy",
                        message: "OK",
                        required: true,
                      },
                    },
                    timestamp: "2024-01-01T00:00:00Z",
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should auto-refetch every 15 seconds", async () => {
      jest.useFakeTimers();

      const mockHealth: SystemHealth = {
        status: "healthy",
        checks: {
          database: {
            name: "Database",
            status: "healthy",
            message: "OK",
            required: true,
          },
          redis: {
            name: "Redis",
            status: "healthy",
            message: "OK",
            required: true,
          },
        },
        timestamp: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 15 seconds
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle optional service checks", async () => {
      const mockHealth: SystemHealth = {
        status: "healthy",
        checks: {
          database: {
            name: "Database",
            status: "healthy",
            message: "Connected",
            required: true,
          },
          redis: {
            name: "Redis",
            status: "healthy",
            message: "Connected",
            required: true,
          },
        },
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.checks.vault).toBeUndefined();
      expect(result.current.data?.checks.storage).toBeUndefined();
    });

    it("should accept custom query options", async () => {
      const mockHealth: SystemHealth = {
        status: "healthy",
        checks: {
          database: {
            name: "Database",
            status: "healthy",
            message: "OK",
            required: true,
          },
          redis: {
            name: "Redis",
            status: "healthy",
            message: "OK",
            required: true,
          },
        },
        timestamp: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth({ enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle all service statuses", async () => {
      const statuses: Array<"healthy" | "degraded" | "unhealthy"> = [
        "healthy",
        "degraded",
        "unhealthy",
      ];

      for (const status of statuses) {
        const mockHealth: SystemHealth = {
          status,
          checks: {
            database: {
              name: "Database",
              status,
              message: `Database is ${status}`,
              required: true,
            },
            redis: {
              name: "Redis",
              status,
              message: `Redis is ${status}`,
              required: true,
            },
          },
          timestamp: "2024-01-01T12:00:00Z",
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

        const { result } = renderHook(() => useSystemHealth(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.status).toBe(status);

        jest.clearAllMocks();
      }
    });
  });

  // ==================== Utility Functions ====================

  describe("Utility Functions", () => {
    describe("getStatusColor", () => {
      it("should return correct color for healthy status", () => {
        expect(getStatusColor("healthy")).toBe(
          "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
        );
      });

      it("should return correct color for degraded status", () => {
        expect(getStatusColor("degraded")).toBe(
          "text-yellow-400 bg-yellow-500/15 border-yellow-500/30"
        );
      });

      it("should return correct color for unhealthy status", () => {
        expect(getStatusColor("unhealthy")).toBe(
          "text-red-400 bg-red-500/15 border-red-500/30"
        );
      });
    });

    describe("getStatusIcon", () => {
      it("should return checkmark for healthy status", () => {
        expect(getStatusIcon("healthy")).toBe("✓");
      });

      it("should return warning symbol for degraded status", () => {
        expect(getStatusIcon("degraded")).toBe("⚠");
      });

      it("should return x for unhealthy status", () => {
        expect(getStatusIcon("unhealthy")).toBe("✗");
      });
    });

    describe("calculateSuccessRate", () => {
      it("should calculate success rate correctly", () => {
        expect(calculateSuccessRate(950, 1000)).toBe(95);
        expect(calculateSuccessRate(500, 1000)).toBe(50);
        expect(calculateSuccessRate(999, 1000)).toBe(99.9);
      });

      it("should return 100 for zero total", () => {
        expect(calculateSuccessRate(0, 0)).toBe(100);
      });

      it("should return 100 for 100% success rate", () => {
        expect(calculateSuccessRate(1000, 1000)).toBe(100);
      });

      it("should return 0 for 0% success rate", () => {
        expect(calculateSuccessRate(0, 1000)).toBe(0);
      });

      it("should round to 2 decimal places", () => {
        expect(calculateSuccessRate(333, 1000)).toBe(33.3);
        expect(calculateSuccessRate(666, 1000)).toBe(66.6);
      });
    });

    describe("formatPercentage", () => {
      it("should format percentage with 2 decimal places", () => {
        expect(formatPercentage(95.5)).toBe("95.50%");
        expect(formatPercentage(100)).toBe("100.00%");
        expect(formatPercentage(0)).toBe("0.00%");
      });

      it("should handle decimal values", () => {
        expect(formatPercentage(95.555)).toBe("95.56%");
        expect(formatPercentage(33.333)).toBe("33.33%");
      });

      it("should handle whole numbers", () => {
        expect(formatPercentage(50)).toBe("50.00%");
        expect(formatPercentage(75)).toBe("75.00%");
      });
    });

    describe("formatDuration", () => {
      it("should format microseconds for values less than 1ms", () => {
        expect(formatDuration(0.5)).toBe("500μs");
        expect(formatDuration(0.1)).toBe("100μs");
        expect(formatDuration(0.001)).toBe("1μs");
      });

      it("should format milliseconds for values less than 1000ms", () => {
        expect(formatDuration(150)).toBe("150ms");
        expect(formatDuration(999)).toBe("999ms");
        expect(formatDuration(1)).toBe("1ms");
      });

      it("should format seconds for values 1000ms or more", () => {
        expect(formatDuration(1000)).toBe("1.00s");
        expect(formatDuration(1500)).toBe("1.50s");
        expect(formatDuration(5000)).toBe("5.00s");
      });

      it("should handle edge cases", () => {
        expect(formatDuration(0)).toBe("0μs");
        expect(formatDuration(999.9)).toBe("1000ms");
      });
    });

    describe("getHealthStatusText", () => {
      it("should return correct text for healthy status", () => {
        expect(getHealthStatusText("healthy")).toBe("All systems operational");
      });

      it("should return correct text for degraded status", () => {
        expect(getHealthStatusText("degraded")).toBe("Some systems degraded");
      });

      it("should return correct text for unhealthy status", () => {
        expect(getHealthStatusText("unhealthy")).toBe("System issues detected");
      });
    });

    describe("getSeverityColor", () => {
      it("should return red for critical severity", () => {
        expect(getSeverityColor("critical")).toBe("text-red-400");
        expect(getSeverityColor("Critical")).toBe("text-red-400");
        expect(getSeverityColor("CRITICAL")).toBe("text-red-400");
      });

      it("should return orange for high severity", () => {
        expect(getSeverityColor("high")).toBe("text-orange-400");
        expect(getSeverityColor("High")).toBe("text-orange-400");
        expect(getSeverityColor("HIGH")).toBe("text-orange-400");
      });

      it("should return yellow for medium severity", () => {
        expect(getSeverityColor("medium")).toBe("text-yellow-400");
        expect(getSeverityColor("Medium")).toBe("text-yellow-400");
        expect(getSeverityColor("MEDIUM")).toBe("text-yellow-400");
      });

      it("should return gray for low or unknown severity", () => {
        expect(getSeverityColor("low")).toBe("text-gray-400");
        expect(getSeverityColor("unknown")).toBe("text-gray-400");
        expect(getSeverityColor("")).toBe("text-gray-400");
      });
    });
  });

  // ==================== Type Coverage ====================

  describe("Type Coverage", () => {
    it("should handle MonitoringMetrics type correctly", async () => {
      const mockMetrics: MonitoringMetrics = {
        error_rate: 1.5,
        critical_errors: 3,
        warning_count: 10,
        avg_response_time_ms: 100,
        p95_response_time_ms: 200,
        p99_response_time_ms: 300,
        total_requests: 1000,
        successful_requests: 985,
        failed_requests: 15,
        api_requests: 800,
        user_activities: 150,
        system_activities: 50,
        high_latency_requests: 10,
        timeout_count: 2,
        top_errors: [],
        period: "24h",
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toMatchObject<MonitoringMetrics>(mockMetrics);
    });

    it("should handle LogStats type correctly", async () => {
      const mockStats: LogStats = {
        total_logs: 1000,
        critical_logs: 5,
        high_logs: 20,
        medium_logs: 100,
        low_logs: 875,
        auth_logs: 200,
        api_logs: 600,
        system_logs: 150,
        secret_logs: 30,
        file_logs: 20,
        error_logs: 50,
        unique_error_types: 10,
        most_common_errors: [],
        unique_users: 25,
        unique_ips: 20,
        period: "24h",
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toMatchObject<LogStats>(mockStats);
    });

    it("should handle SystemHealth type correctly", async () => {
      const mockHealth: SystemHealth = {
        status: "healthy",
        checks: {
          database: {
            name: "Database",
            status: "healthy",
            message: "OK",
            required: true,
          },
          redis: {
            name: "Redis",
            status: "healthy",
            message: "OK",
            required: true,
          },
        },
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toMatchObject<SystemHealth>(mockHealth);
    });

    it("should handle ServiceHealth type correctly", async () => {
      const serviceHealth: ServiceHealth = {
        name: "Test Service",
        status: "healthy",
        message: "Service is operational",
        required: true,
      };

      const mockHealth: SystemHealth = {
        status: "healthy",
        checks: {
          database: serviceHealth,
          redis: serviceHealth,
        },
        timestamp: "2024-01-01T12:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.checks.database).toMatchObject<ServiceHealth>(
        serviceHealth
      );
    });
  });
});
