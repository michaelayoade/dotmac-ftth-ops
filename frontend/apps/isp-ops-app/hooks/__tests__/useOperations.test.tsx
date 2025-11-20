/**
 * Jest Mock Tests for useOperations (monitoring hooks)
 * Tests API contracts, query configuration, and utility functions
 */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useMonitoringMetrics,
  useLogStats,
  useSystemHealth,
  calculateSuccessRate,
  formatPercentage,
  formatDuration,
  getHealthStatusText,
  getStatusColor,
  getStatusIcon,
  getSeverityColor,
} from "../useOperations";
import { apiClient } from "@/lib/api/client";

// Mock apiClient
jest.mock("@/lib/api/client");
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Create a wrapper component with QueryClient
const createWrapper = () => {
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
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useOperations", () => {
  describe("useMonitoringMetrics", () => {
    it("should fetch metrics successfully with default period", async () => {
      const mockMetrics = {
        error_rate: 3.5,
        critical_errors: 5,
        total_requests: 15000,
        successful_requests: 14475,
        failed_requests: 525,
        avg_response_time_ms: 300,
        p95_response_time_ms: 900,
        p99_response_time_ms: 1800,
        warning_count: 10,
        api_requests: 12000,
        user_activities: 2500,
        system_activities: 500,
        high_latency_requests: 50,
        timeout_count: 10,
        top_errors: [],
        period: "24h",
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/monitoring/metrics", {
        params: { period: "24h" },
      });
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.error_rate).toBe(3.5);
      expect(result.current.data?.critical_errors).toBe(5);
      expect(result.current.data?.total_requests).toBe(15000);
      expect(result.current.data?.period).toBe("24h");
      expect(result.current.error).toBeNull();
    });

    it("should fetch metrics for 1h period", async () => {
      const mockMetrics = {
        total_requests: 500,
        period: "1h",
        error_rate: 2.0,
        critical_errors: 1,
        successful_requests: 490,
        failed_requests: 10,
        avg_response_time_ms: 200,
        p95_response_time_ms: 500,
        p99_response_time_ms: 800,
        warning_count: 5,
        api_requests: 400,
        user_activities: 80,
        system_activities: 20,
        high_latency_requests: 10,
        timeout_count: 2,
        top_errors: [],
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics("1h"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/monitoring/metrics", {
        params: { period: "1h" },
      });
      expect(result.current.data?.total_requests).toBe(500);
      expect(result.current.data?.period).toBe("1h");
    });

    it("should fetch metrics for 7d period", async () => {
      const mockMetrics = {
        total_requests: 100000,
        period: "7d",
        error_rate: 4.0,
        critical_errors: 50,
        successful_requests: 96000,
        failed_requests: 4000,
        avg_response_time_ms: 350,
        p95_response_time_ms: 1000,
        p99_response_time_ms: 2000,
        warning_count: 100,
        api_requests: 80000,
        user_activities: 15000,
        system_activities: 5000,
        high_latency_requests: 500,
        timeout_count: 100,
        top_errors: [],
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics("7d"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/monitoring/metrics", {
        params: { period: "7d" },
      });
      expect(result.current.data?.total_requests).toBe(100000);
      expect(result.current.data?.period).toBe("7d");
    });

    it("should include top errors in metrics", async () => {
      const mockMetrics = {
        error_rate: 5.0,
        critical_errors: 20,
        total_requests: 10000,
        successful_requests: 9500,
        failed_requests: 500,
        avg_response_time_ms: 300,
        p95_response_time_ms: 900,
        p99_response_time_ms: 1800,
        warning_count: 30,
        api_requests: 8000,
        user_activities: 1500,
        system_activities: 500,
        high_latency_requests: 100,
        timeout_count: 20,
        top_errors: [
          {
            error_type: "DATABASE_TIMEOUT",
            count: 20,
            last_seen: new Date().toISOString(),
          },
          {
            error_type: "VALIDATION_ERROR",
            count: 15,
            last_seen: new Date().toISOString(),
          },
        ],
        period: "24h",
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.top_errors).toHaveLength(2);
      expect(result.current.data?.top_errors[0].error_type).toBe("DATABASE_TIMEOUT");
      expect(result.current.data?.top_errors[0].count).toBe(20);
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error("Server error"));

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should include performance metrics", async () => {
      const mockMetrics = {
        error_rate: 2.0,
        critical_errors: 5,
        total_requests: 10000,
        successful_requests: 9800,
        failed_requests: 200,
        avg_response_time_ms: 300,
        p95_response_time_ms: 900,
        p99_response_time_ms: 1800,
        warning_count: 10,
        api_requests: 8000,
        user_activities: 1500,
        system_activities: 500,
        high_latency_requests: 50,
        timeout_count: 10,
        top_errors: [],
        period: "24h",
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.avg_response_time_ms).toBe(300);
      expect(result.current.data?.p95_response_time_ms).toBe(900);
      expect(result.current.data?.p99_response_time_ms).toBe(1800);
    });
  });

  describe("useLogStats", () => {
    it("should fetch log stats successfully with default period", async () => {
      const mockStats = {
        total_logs: 6000,
        critical_logs: 10,
        high_logs: 50,
        medium_logs: 200,
        low_logs: 500,
        error_logs: 100,
        auth_logs: 1500,
        api_logs: 3000,
        system_logs: 900,
        secret_logs: 400,
        file_logs: 200,
        unique_error_types: 15,
        most_common_errors: [],
        unique_users: 50,
        unique_ips: 30,
        period: "24h",
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockStats });

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/monitoring/logs/stats", {
        params: { period: "24h" },
      });
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.total_logs).toBe(6000);
      expect(result.current.data?.critical_logs).toBe(10);
      expect(result.current.data?.error_logs).toBe(100);
      expect(result.current.data?.period).toBe("24h");
      expect(result.current.error).toBeNull();
    });

    it("should fetch log stats for 1h period", async () => {
      const mockStats = {
        total_logs: 250,
        period: "1h",
        critical_logs: 2,
        high_logs: 10,
        medium_logs: 30,
        low_logs: 50,
        error_logs: 15,
        auth_logs: 60,
        api_logs: 120,
        system_logs: 40,
        secret_logs: 20,
        file_logs: 10,
        unique_error_types: 5,
        most_common_errors: [],
        unique_users: 10,
        unique_ips: 8,
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockStats });

      const { result } = renderHook(() => useLogStats("1h"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/monitoring/logs/stats", {
        params: { period: "1h" },
      });
      expect(result.current.data?.total_logs).toBe(250);
      expect(result.current.data?.period).toBe("1h");
    });

    it("should include activity type counts", async () => {
      const mockStats = {
        total_logs: 6000,
        critical_logs: 10,
        high_logs: 50,
        medium_logs: 200,
        low_logs: 500,
        error_logs: 100,
        auth_logs: 1500,
        api_logs: 3000,
        system_logs: 900,
        secret_logs: 400,
        file_logs: 200,
        unique_error_types: 15,
        most_common_errors: [],
        unique_users: 50,
        unique_ips: 30,
        period: "24h",
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockStats });

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.auth_logs).toBe(1500);
      expect(result.current.data?.api_logs).toBe(3000);
      expect(result.current.data?.system_logs).toBe(900);
      expect(result.current.data?.secret_logs).toBe(400);
      expect(result.current.data?.file_logs).toBe(200);
    });

    it("should include most common errors", async () => {
      const mockStats = {
        total_logs: 6000,
        critical_logs: 10,
        high_logs: 50,
        medium_logs: 200,
        low_logs: 500,
        error_logs: 100,
        auth_logs: 1500,
        api_logs: 3000,
        system_logs: 900,
        secret_logs: 400,
        file_logs: 200,
        unique_error_types: 15,
        most_common_errors: [
          {
            error_type: "AUTH_FAILED",
            count: 35,
            severity: "high",
          },
          {
            error_type: "RATE_LIMIT",
            count: 22,
            severity: "medium",
          },
        ],
        unique_users: 50,
        unique_ips: 30,
        period: "24h",
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockStats });

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.most_common_errors).toHaveLength(2);
      expect(result.current.data?.most_common_errors[0].error_type).toBe("AUTH_FAILED");
      expect(result.current.data?.most_common_errors[0].count).toBe(35);
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error("Server error"));

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useSystemHealth", () => {
    it("should fetch system health successfully", async () => {
      const mockHealth = {
        status: "healthy" as const,
        checks: {
          database: {
            name: "database",
            status: "healthy" as const,
            message: "Connected",
            required: true,
          },
          redis: {
            name: "redis",
            status: "healthy" as const,
            message: "Connected",
            required: true,
          },
        },
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/health");
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.status).toBe("healthy");
      expect(result.current.data?.checks).toBeDefined();
      expect(result.current.error).toBeNull();
    });

    it("should show degraded status when services are degraded", async () => {
      const mockHealth = {
        status: "degraded" as const,
        checks: {
          database: {
            name: "database",
            status: "healthy" as const,
            message: "Connected",
            required: true,
          },
          redis: {
            name: "redis",
            status: "degraded" as const,
            message: "High latency",
            required: true,
          },
          vault: {
            name: "vault",
            status: "healthy" as const,
            message: "Connected",
            required: false,
          },
        },
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("degraded");
      expect(result.current.data?.checks.redis?.status).toBe("degraded");
      expect(result.current.data?.checks.redis?.message).toBe("High latency");
    });

    it("should show unhealthy status when required services fail", async () => {
      const mockHealth = {
        status: "unhealthy" as const,
        checks: {
          database: {
            name: "database",
            status: "unhealthy" as const,
            message: "Connection failed",
            required: true,
          },
          redis: {
            name: "redis",
            status: "healthy" as const,
            message: "Connected",
            required: true,
          },
        },
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("unhealthy");
      expect(result.current.data?.checks.database?.status).toBe("unhealthy");
      expect(result.current.data?.checks.database?.required).toBe(true);
    });

    it("should include all service checks", async () => {
      const mockHealth = {
        status: "healthy" as const,
        checks: {
          database: {
            name: "database",
            status: "healthy" as const,
            message: "Connected",
            required: true,
          },
          redis: {
            name: "redis",
            status: "healthy" as const,
            message: "Connected",
            required: true,
          },
          vault: {
            name: "vault",
            status: "healthy" as const,
            message: "Connected",
            required: false,
          },
          storage: {
            name: "storage",
            status: "healthy" as const,
            message: "Connected",
            required: false,
          },
        },
        timestamp: "2025-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.checks.database).toBeDefined();
      expect(result.current.data?.checks.redis).toBeDefined();
      expect(result.current.data?.checks.vault).toBeDefined();
      expect(result.current.data?.checks.storage).toBeDefined();
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error("Health check failed"));

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("Utility Functions", () => {
    describe("calculateSuccessRate", () => {
      it("should calculate success rate correctly", () => {
        expect(calculateSuccessRate(950, 1000)).toBe(95);
        expect(calculateSuccessRate(500, 1000)).toBe(50);
        expect(calculateSuccessRate(999, 1000)).toBe(99.9);
      });

      it("should return 100% for zero total", () => {
        expect(calculateSuccessRate(0, 0)).toBe(100);
      });
    });

    describe("formatPercentage", () => {
      it("should format percentages correctly", () => {
        expect(formatPercentage(95.5)).toBe("95.50%");
        expect(formatPercentage(100)).toBe("100.00%");
        expect(formatPercentage(0.5)).toBe("0.50%");
      });
    });

    describe("formatDuration", () => {
      it("should format milliseconds", () => {
        expect(formatDuration(500)).toBe("500ms");
        expect(formatDuration(999)).toBe("999ms");
      });

      it("should format seconds", () => {
        expect(formatDuration(1000)).toBe("1.00s");
        expect(formatDuration(2500)).toBe("2.50s");
      });

      it("should format microseconds", () => {
        expect(formatDuration(0.5)).toBe("500μs");
        expect(formatDuration(0.001)).toBe("1μs");
      });
    });

    describe("getHealthStatusText", () => {
      it("should return correct text for each status", () => {
        expect(getHealthStatusText("healthy")).toBe("All systems operational");
        expect(getHealthStatusText("degraded")).toBe("Some systems degraded");
        expect(getHealthStatusText("unhealthy")).toBe("System issues detected");
      });
    });

    describe("getStatusColor", () => {
      it("should return correct color classes for each status", () => {
        expect(getStatusColor("healthy")).toContain("emerald");
        expect(getStatusColor("degraded")).toContain("yellow");
        expect(getStatusColor("unhealthy")).toContain("red");
      });
    });

    describe("getStatusIcon", () => {
      it("should return correct icon for each status", () => {
        expect(getStatusIcon("healthy")).toBe("✓");
        expect(getStatusIcon("degraded")).toBe("⚠");
        expect(getStatusIcon("unhealthy")).toBe("✗");
      });
    });

    describe("getSeverityColor", () => {
      it("should return correct color for each severity", () => {
        expect(getSeverityColor("critical")).toContain("red");
        expect(getSeverityColor("high")).toContain("orange");
        expect(getSeverityColor("medium")).toContain("yellow");
        expect(getSeverityColor("low")).toContain("gray");
      });

      it("should be case insensitive", () => {
        expect(getSeverityColor("CRITICAL")).toContain("red");
        expect(getSeverityColor("High")).toContain("orange");
      });
    });
  });
});
