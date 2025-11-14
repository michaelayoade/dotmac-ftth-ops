/**
 * MSW-powered tests for useOperations (monitoring hooks)
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * Tests the actual hook contracts: useMonitoringMetrics, useLogStats, useSystemHealth
 */

import { renderHook, waitFor } from "@testing-library/react";
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
import {
  createTestQueryClient,
  createMockMetrics,
  createMockLogStats,
  createMockSystemHealth,
  createMockOperationsServiceHealth,
  seedOperationsData,
  resetOperationsStorage,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

describe("useOperations (MSW)", () => {
  // Helper to create wrapper with QueryClient
  const createWrapper = (queryClient?: QueryClient) => {
    const client = queryClient || createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    resetOperationsStorage();
  });

  describe("useMonitoringMetrics", () => {
    it("should fetch metrics successfully with default period", async () => {
      const mockMetrics = createMockMetrics('24h', {
        error_rate: 3.5,
        critical_errors: 5,
        total_requests: 15000,
      });

      seedOperationsData({ '24h': mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.error_rate).toBe(3.5);
      expect(result.current.data?.critical_errors).toBe(5);
      expect(result.current.data?.total_requests).toBe(15000);
      expect(result.current.data?.period).toBe('24h');
      expect(result.current.error).toBeNull();
    });

    it("should fetch metrics for 1h period", async () => {
      const mockMetrics = createMockMetrics('1h', {
        total_requests: 500,
        period: '1h',
      });

      seedOperationsData({ '1h': mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics('1h'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_requests).toBe(500);
      expect(result.current.data?.period).toBe('1h');
    });

    it("should fetch metrics for 7d period", async () => {
      const mockMetrics = createMockMetrics('7d', {
        total_requests: 100000,
        period: '7d',
      });

      seedOperationsData({ '7d': mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics('7d'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_requests).toBe(100000);
      expect(result.current.data?.period).toBe('7d');
    });

    it("should include top errors in metrics", async () => {
      const mockMetrics = createMockMetrics('24h', {
        top_errors: [
          {
            error_type: 'DATABASE_TIMEOUT',
            count: 20,
            last_seen: new Date().toISOString(),
          },
          {
            error_type: 'VALIDATION_ERROR',
            count: 15,
            last_seen: new Date().toISOString(),
          },
        ],
      });

      seedOperationsData({ '24h': mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.top_errors).toHaveLength(2);
      expect(result.current.data?.top_errors[0].error_type).toBe('DATABASE_TIMEOUT');
      expect(result.current.data?.top_errors[0].count).toBe(20);
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/monitoring/metrics', 'Server error', 500);

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should include performance metrics", async () => {
      const mockMetrics = createMockMetrics('24h', {
        avg_response_time_ms: 300,
        p95_response_time_ms: 900,
        p99_response_time_ms: 1800,
      });

      seedOperationsData({ '24h': mockMetrics });

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
      const mockStats = createMockLogStats('24h', {
        total_logs: 6000,
        critical_logs: 10,
        error_logs: 100,
      });

      seedOperationsData(undefined, { '24h': mockStats });

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.total_logs).toBe(6000);
      expect(result.current.data?.critical_logs).toBe(10);
      expect(result.current.data?.error_logs).toBe(100);
      expect(result.current.data?.period).toBe('24h');
      expect(result.current.error).toBeNull();
    });

    it("should fetch log stats for 1h period", async () => {
      const mockStats = createMockLogStats('1h', {
        total_logs: 250,
        period: '1h',
      });

      seedOperationsData(undefined, { '1h': mockStats });

      const { result } = renderHook(() => useLogStats('1h'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_logs).toBe(250);
      expect(result.current.data?.period).toBe('1h');
    });

    it("should include activity type counts", async () => {
      const mockStats = createMockLogStats('24h', {
        auth_logs: 1500,
        api_logs: 3000,
        system_logs: 900,
        secret_logs: 400,
        file_logs: 200,
      });

      seedOperationsData(undefined, { '24h': mockStats });

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
      const mockStats = createMockLogStats('24h', {
        most_common_errors: [
          {
            error_type: 'AUTH_FAILED',
            count: 35,
            severity: 'high',
          },
          {
            error_type: 'RATE_LIMIT',
            count: 22,
            severity: 'medium',
          },
        ],
      });

      seedOperationsData(undefined, { '24h': mockStats });

      const { result } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.most_common_errors).toHaveLength(2);
      expect(result.current.data?.most_common_errors[0].error_type).toBe('AUTH_FAILED');
      expect(result.current.data?.most_common_errors[0].count).toBe(35);
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/monitoring/logs/stats', 'Server error', 500);

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
      const mockHealth = createMockSystemHealth({
        status: 'healthy',
      });

      seedOperationsData(undefined, undefined, mockHealth);

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.status).toBe('healthy');
      expect(result.current.data?.checks).toBeDefined();
      expect(result.current.error).toBeNull();
    });

    it("should show degraded status when services are degraded", async () => {
      const mockHealth = createMockSystemHealth({
        status: 'degraded',
        checks: {
          database: createMockOperationsServiceHealth({ name: 'database', status: 'healthy' }),
          redis: createMockOperationsServiceHealth({ name: 'redis', status: 'degraded', message: 'High latency' }),
          vault: createMockOperationsServiceHealth({ name: 'vault', status: 'healthy', required: false }),
        },
      });

      seedOperationsData(undefined, undefined, mockHealth);

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe('degraded');
      expect(result.current.data?.checks.redis?.status).toBe('degraded');
      expect(result.current.data?.checks.redis?.message).toBe('High latency');
    });

    it("should show unhealthy status when required services fail", async () => {
      const mockHealth = createMockSystemHealth({
        status: 'unhealthy',
        checks: {
          database: createMockOperationsServiceHealth({
            name: 'database',
            status: 'unhealthy',
            message: 'Connection failed',
            required: true
          }),
          redis: createMockOperationsServiceHealth({ name: 'redis', status: 'healthy' }),
        },
      });

      seedOperationsData(undefined, undefined, mockHealth);

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe('unhealthy');
      expect(result.current.data?.checks.database?.status).toBe('unhealthy');
      expect(result.current.data?.checks.database?.required).toBe(true);
    });

    it("should include all service checks", async () => {
      const mockHealth = createMockSystemHealth({
        checks: {
          database: createMockOperationsServiceHealth({ name: 'database' }),
          redis: createMockOperationsServiceHealth({ name: 'redis' }),
          vault: createMockOperationsServiceHealth({ name: 'vault', required: false }),
          storage: createMockOperationsServiceHealth({ name: 'storage', required: false }),
        },
      });

      seedOperationsData(undefined, undefined, mockHealth);

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
      makeApiEndpointFail('get', '/health', 'Health check failed', 503);

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
        expect(getHealthStatusText('healthy')).toBe("All systems operational");
        expect(getHealthStatusText('degraded')).toBe("Some systems degraded");
        expect(getHealthStatusText('unhealthy')).toBe("System issues detected");
      });
    });

    describe("getStatusColor", () => {
      it("should return correct color classes for each status", () => {
        expect(getStatusColor('healthy')).toContain("emerald");
        expect(getStatusColor('degraded')).toContain("yellow");
        expect(getStatusColor('unhealthy')).toContain("red");
      });
    });

    describe("getStatusIcon", () => {
      it("should return correct icon for each status", () => {
        expect(getStatusIcon('healthy')).toBe("✓");
        expect(getStatusIcon('degraded')).toBe("⚠");
        expect(getStatusIcon('unhealthy')).toBe("✗");
      });
    });

    describe("getSeverityColor", () => {
      it("should return correct color for each severity", () => {
        expect(getSeverityColor('critical')).toContain("red");
        expect(getSeverityColor('high')).toContain("orange");
        expect(getSeverityColor('medium')).toContain("yellow");
        expect(getSeverityColor('low')).toContain("gray");
      });

      it("should be case insensitive", () => {
        expect(getSeverityColor('CRITICAL')).toContain("red");
        expect(getSeverityColor('High')).toContain("orange");
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle high error rate scenario", async () => {
      const mockMetrics = createMockMetrics('24h', {
        error_rate: 15.5,
        critical_errors: 50,
        failed_requests: 1550,
        total_requests: 10000,
        top_errors: [
          { error_type: 'DATABASE_TIMEOUT', count: 800, last_seen: new Date().toISOString() },
          { error_type: 'CONNECTION_FAILED', count: 500, last_seen: new Date().toISOString() },
        ],
      });

      seedOperationsData({ '24h': mockMetrics });

      const { result } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.error_rate).toBeGreaterThan(10);
      expect(result.current.data?.critical_errors).toBeGreaterThan(20);
      expect(result.current.data?.top_errors[0].count).toBeGreaterThan(500);
    });

    it("should handle multiple period queries", async () => {
      const metrics1h = createMockMetrics('1h', { total_requests: 500 });
      const metrics24h = createMockMetrics('24h', { total_requests: 10000 });
      const metrics7d = createMockMetrics('7d', { total_requests: 70000 });

      seedOperationsData({ '1h': metrics1h, '24h': metrics24h, '7d': metrics7d });

      const { result: result1h } = renderHook(() => useMonitoringMetrics('1h'), {
        wrapper: createWrapper(),
      });

      const { result: result24h } = renderHook(() => useMonitoringMetrics('24h'), {
        wrapper: createWrapper(),
      });

      const { result: result7d } = renderHook(() => useMonitoringMetrics('7d'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1h.current.isLoading).toBe(false);
        expect(result24h.current.isLoading).toBe(false);
        expect(result7d.current.isLoading).toBe(false);
      });

      expect(result1h.current.data?.total_requests).toBe(500);
      expect(result24h.current.data?.total_requests).toBe(10000);
      expect(result7d.current.data?.total_requests).toBe(70000);
    });

    it("should correlate metrics with log stats", async () => {
      const mockMetrics = createMockMetrics('24h', {
        error_rate: 5,
        failed_requests: 500,
        total_requests: 10000,
      });

      const mockStats = createMockLogStats('24h', {
        error_logs: 500,
        total_logs: 10000,
        most_common_errors: [
          { error_type: 'DATABASE_TIMEOUT', count: 300, severity: 'high' },
        ],
      });

      seedOperationsData({ '24h': mockMetrics }, { '24h': mockStats });

      const { result: metricsResult } = renderHook(() => useMonitoringMetrics(), {
        wrapper: createWrapper(),
      });

      const { result: statsResult } = renderHook(() => useLogStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(metricsResult.current.isLoading).toBe(false);
        expect(statsResult.current.isLoading).toBe(false);
      });

      // Error counts should align
      expect(metricsResult.current.data?.failed_requests).toBe(500);
      expect(statsResult.current.data?.error_logs).toBe(500);
    });
  });
});
