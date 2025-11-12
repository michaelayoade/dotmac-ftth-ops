/**
 * Shared test suite for useHealth hook
 * Tests the health monitoring functionality across both ISP and Platform Admin apps
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type PropsWithChildren } from "react";
import type { ServiceHealth, HealthSummary } from "../../apps/platform-admin-app/hooks/useHealth";

type UseHealthHook = () => {
  health: HealthSummary | null;
  loading: boolean;
  error: string | null;
  refreshHealth: () => Promise<void>;
};

export function runUseHealthSuite(useHealth: UseHealthHook, apiClient: any) {
  const cleanupFns: Array<() => void> = [];

  const renderUseHealth = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
      },
    });

    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const hook = renderHook(() => useHealth(), { wrapper });

    cleanupFns.push(() => {
      hook.unmount();
      queryClient.clear();
    });

    return hook;
  };

  describe("useHealth", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      cleanupFns.forEach((cleanup) => cleanup());
      cleanupFns.length = 0;
      jest.restoreAllMocks();
    });

    describe("Happy Path", () => {
      it("should fetch health data on mount", async () => {
        const mockHealth: HealthSummary = {
          status: "healthy",
          healthy: true,
          services: [
            {
              name: "postgres",
              status: "healthy",
              message: "Database is operational",
              required: true,
              uptime: 99.99,
              responseTime: 5,
            },
          ],
          failed_services: [],
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        };

        apiClient.get.mockResolvedValueOnce({ data: mockHealth });

        const { result } = renderUseHealth();

        expect(result.current.loading).toBe(true);

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.health).toEqual(mockHealth);
        expect(result.current.error).toBeNull();
        expect(apiClient.get).toHaveBeenCalledWith("/ready");
      });

      it("should handle wrapped success response", async () => {
        const mockHealth: HealthSummary = {
          status: "healthy",
          healthy: true,
          services: [],
          failed_services: [],
        };

        apiClient.get.mockResolvedValueOnce({
          data: {
            success: true,
            data: mockHealth,
          },
        });

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.health).toEqual(mockHealth);
        expect(result.current.error).toBeNull();
      });

      it("should handle degraded services", async () => {
        const mockHealth: HealthSummary = {
          status: "degraded",
          healthy: false,
          services: [
            {
              name: "redis",
              status: "degraded",
              message: "High latency detected",
              required: false,
              responseTime: 500,
            },
          ],
          failed_services: ["redis"],
          timestamp: new Date().toISOString(),
        };

        apiClient.get.mockResolvedValueOnce({ data: mockHealth });

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.health).toEqual(mockHealth);
        expect(result.current.health?.healthy).toBe(false);
        expect(result.current.health?.failed_services).toContain("redis");
      });

      it("should allow manual refresh", async () => {
        const mockHealth: HealthSummary = {
          status: "healthy",
          healthy: true,
          services: [],
          failed_services: [],
        };

        apiClient.get.mockResolvedValue({ data: mockHealth });

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        // Clear previous calls
        apiClient.get.mockClear();

        // Trigger manual refresh
        await result.current.refreshHealth();

        await waitFor(() => {
          expect(apiClient.get).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe("Error Handling", () => {
      it("should handle fetch errors gracefully", async () => {
        const mockError = new Error("Network error");
        apiClient.get.mockRejectedValueOnce(mockError);

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("Service health is temporarily unavailable.");
        expect(result.current.health).toEqual({
          status: "degraded",
          healthy: false,
          services: [],
          failed_services: [],
          timestamp: expect.any(String),
        });
      });

      it("should handle 403 forbidden errors", async () => {
        const mockError = {
          isAxiosError: true,
          response: { status: 403 },
        };
        apiClient.get.mockRejectedValueOnce(mockError);

        // Mock axios.isAxiosError
        const axios = require("axios");
        jest.spyOn(axios, "isAxiosError").mockReturnValue(true);

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("You do not have permission to view service health.");
        expect(result.current.health?.status).toBe("forbidden");
      });

      it("should handle wrapped error response", async () => {
        apiClient.get.mockResolvedValueOnce({
          data: {
            error: {
              message: "Database connection failed",
            },
          },
        });

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("Database connection failed");
        expect(result.current.health).toMatchObject({
          status: "degraded",
          healthy: false,
          services: [],
          failed_services: [],
          timestamp: expect.any(String),
        });
        expect((result.current.health as any)?.apiErrorMessage).toBe("Database connection failed");
      });

      it("should handle malformed response", async () => {
        apiClient.get.mockResolvedValueOnce({
          data: { unexpected: "format" },
        });

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.health).toEqual({
          status: "unknown",
          healthy: false,
          services: [],
          failed_services: [],
          timestamp: expect.any(String),
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle multiple services", async () => {
        const mockHealth: HealthSummary = {
          status: "healthy",
          healthy: true,
          services: [
            {
              name: "postgres",
              status: "healthy",
              message: "OK",
              required: true,
            },
            {
              name: "redis",
              status: "healthy",
              message: "OK",
              required: false,
            },
            {
              name: "rabbitmq",
              status: "degraded",
              message: "Queue backlog",
              required: true,
            },
          ],
          failed_services: [],
        };

        apiClient.get.mockResolvedValueOnce({ data: mockHealth });

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.health?.services).toHaveLength(3);
        expect(result.current.health?.services[2].status).toBe("degraded");
      });

      it("should handle empty services array", async () => {
        const mockHealth: HealthSummary = {
          status: "healthy",
          healthy: true,
          services: [],
          failed_services: [],
        };

        apiClient.get.mockResolvedValueOnce({ data: mockHealth });

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.health?.services).toEqual([]);
        expect(result.current.health?.healthy).toBe(true);
      });

      it("should include optional metadata when available", async () => {
        const mockHealth: HealthSummary = {
          status: "healthy",
          healthy: true,
          services: [
            {
              name: "postgres",
              status: "healthy",
              message: "OK",
              required: true,
              uptime: 99.99,
              responseTime: 3,
              lastCheck: "2025-01-15T10:00:00Z",
            },
          ],
          failed_services: [],
          version: "1.2.3",
          timestamp: "2025-01-15T10:00:00Z",
        };

        apiClient.get.mockResolvedValueOnce({ data: mockHealth });

        const { result } = renderUseHealth();

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.health?.version).toBe("1.2.3");
        expect(result.current.health?.services[0].uptime).toBe(99.99);
        expect(result.current.health?.services[0].responseTime).toBe(3);
      });
    });
  });
}
