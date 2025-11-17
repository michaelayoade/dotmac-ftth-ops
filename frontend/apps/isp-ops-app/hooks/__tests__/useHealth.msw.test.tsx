/**
 * MSW-powered tests for useHealth
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 *
 * Tests the actual hook contract: { health, loading, error, refreshHealth }
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useHealth, healthKeys } from "../useHealth";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetHealthStorage,
  createMockHealthSummary,
  createMockHealthService,
  seedHealthData,
  makeHealthCheckFail,
  makeHealthCheckSucceed,
} from "../../__tests__/test-utils";

const waitForHealthLoading = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

describe("useHealth (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetHealthStorage();
    makeHealthCheckSucceed();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("healthKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(healthKeys.all).toEqual(["health"]);
      expect(healthKeys.status()).toEqual(["health", "status"]);
    });
  });

  describe("useHealth - fetch health status", () => {
    it("should fetch health status successfully", async () => {
      const mockHealth = createMockHealthSummary({
        status: "healthy",
        healthy: true,
        services: [
          createMockHealthService({
            name: "database",
            status: "healthy",
            message: "Database is running",
          }),
          createMockHealthService({
            name: "cache",
            status: "healthy",
            message: "Cache is operational",
          }),
        ],
      });

      seedHealthData(mockHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.loading).toBe(true);

      // Wait for data to load
      await waitForHealthLoading(() => result.current.loading);

      // Verify data matches actual hook API
      expect(result.current.health).toBeDefined();
      expect(result.current.health?.status).toBe("healthy");
      expect(result.current.health?.healthy).toBe(true);
      expect(result.current.health?.services).toHaveLength(2);
      expect(result.current.error).toBeNull();
    });

    it("should handle degraded health status", async () => {
      const mockHealth = createMockHealthSummary({
        status: "degraded",
        healthy: false,
        services: [
          createMockHealthService({
            name: "database",
            status: "healthy",
          }),
          createMockHealthService({
            name: "cache",
            status: "degraded",
            message: "Cache connection slow",
          }),
        ],
        failed_services: ["cache"],
      });

      seedHealthData(mockHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      expect(result.current.health?.status).toBe("degraded");
      expect(result.current.health?.healthy).toBe(false);
      expect(result.current.health?.failed_services).toContain("cache");
    });

    it("should handle unhealthy status", async () => {
      const mockHealth = createMockHealthSummary({
        status: "unhealthy",
        healthy: false,
        services: [
          createMockHealthService({
            name: "database",
            status: "unhealthy",
            message: "Database connection failed",
            required: true,
          }),
        ],
        failed_services: ["database"],
      });

      seedHealthData(mockHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      expect(result.current.health?.status).toBe("unhealthy");
      expect(result.current.health?.healthy).toBe(false);
      expect(result.current.health?.failed_services).toContain("database");
    });

    it("should handle server error (500)", async () => {
      makeHealthCheckFail(500);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      expect(result.current.health?.status).toBe("degraded");
      expect(result.current.health?.healthy).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it("should handle forbidden error (403)", async () => {
      makeHealthCheckFail(403);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      expect(result.current.health?.status).toBe("forbidden");
      expect(result.current.health?.healthy).toBe(false);
      expect(result.current.error).toContain("permission");
    });
  });

  describe("useHealth - refresh functionality", () => {
    it("should refresh health data", async () => {
      const initialHealth = createMockHealthSummary({
        status: "healthy",
        timestamp: "2024-01-01T00:00:00Z",
      });

      seedHealthData(initialHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      expect(result.current.health?.timestamp).toBe("2024-01-01T00:00:00Z");

      // Update seeded data
      const updatedHealth = createMockHealthSummary({
        status: "degraded",
        timestamp: new Date().toISOString(),
      });
      seedHealthData(updatedHealth);

      // Trigger refresh
      await act(async () => {
        await result.current.refreshHealth();
      });

      await waitFor(() => {
        expect(result.current.health?.status).toBe("degraded");
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle multiple services with mixed health", async () => {
      const mockHealth = createMockHealthSummary({
        status: "degraded",
        healthy: false,
        services: [
          createMockHealthService({
            name: "database",
            status: "healthy",
            responseTime: 10,
            required: true,
          }),
          createMockHealthService({
            name: "cache",
            status: "degraded",
            responseTime: 500,
            message: "High latency",
            required: false,
          }),
          createMockHealthService({
            name: "search",
            status: "healthy",
            responseTime: 50,
            required: false,
          }),
          createMockHealthService({
            name: "queue",
            status: "unhealthy",
            message: "Connection timeout",
            required: true,
          }),
        ],
        failed_services: ["cache", "queue"],
      });

      seedHealthData(mockHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      expect(result.current.health?.services).toHaveLength(4);

      const healthyServices = result.current.health?.services.filter(
        (s) => s.status === "healthy"
      );
      const degradedServices = result.current.health?.services.filter(
        (s) => s.status === "degraded"
      );
      const unhealthyServices = result.current.health?.services.filter(
        (s) => s.status === "unhealthy"
      );

      expect(healthyServices).toHaveLength(2);
      expect(degradedServices).toHaveLength(1);
      expect(unhealthyServices).toHaveLength(1);
    });

    it("should handle services with uptime metrics", async () => {
      const mockHealth = createMockHealthSummary({
        services: [
          createMockHealthService({
            name: "api",
            status: "healthy",
            uptime: 99.99,
            responseTime: 10,
          }),
          createMockHealthService({
            name: "worker",
            status: "healthy",
            uptime: 98.5,
            responseTime: 5,
          }),
        ],
      });

      seedHealthData(mockHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      const apiService = result.current.health?.services.find((s) => s.name === "api");
      const workerService = result.current.health?.services.find(
        (s) => s.name === "worker"
      );

      expect(apiService?.uptime).toBe(99.99);
      expect(apiService?.responseTime).toBe(10);
      expect(workerService?.uptime).toBe(98.5);
      expect(workerService?.responseTime).toBe(5);
    });

    it("should handle health check with version information", async () => {
      const mockHealth = createMockHealthSummary({
        status: "healthy",
        healthy: true,
        version: "2.5.1",
        timestamp: new Date().toISOString(),
        services: [createMockHealthService()],
      });

      seedHealthData(mockHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      expect(result.current.health?.version).toBe("2.5.1");
      expect(result.current.health?.timestamp).toBeDefined();
    });

    it("should distinguish between required and optional services", async () => {
      const mockHealth = createMockHealthSummary({
        status: "degraded",
        healthy: false,
        services: [
          createMockHealthService({
            name: "database",
            status: "healthy",
            required: true,
          }),
          createMockHealthService({
            name: "cache",
            status: "unhealthy",
            required: false,
            message: "Optional service unavailable",
          }),
          createMockHealthService({
            name: "search",
            status: "degraded",
            required: false,
            message: "Optional service slow",
          }),
        ],
        failed_services: ["cache", "search"],
      });

      seedHealthData(mockHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);

      const requiredServices = result.current.health?.services.filter((s) => s.required);
      const optionalServices = result.current.health?.services.filter((s) => !s.required);

      expect(requiredServices).toHaveLength(1);
      expect(requiredServices?.[0].status).toBe("healthy");
      expect(optionalServices).toHaveLength(2);
    });

    it("should handle rapid health status changes", async () => {
      const initialHealth = createMockHealthSummary({
        status: "healthy",
        healthy: true,
      });

      seedHealthData(initialHealth);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHealthLoading(() => result.current.loading);
      expect(result.current.health?.status).toBe("healthy");

      // Simulate status change
      const degradedHealth = createMockHealthSummary({
        status: "degraded",
        healthy: false,
      });
      seedHealthData(degradedHealth);

      await act(async () => {
        await result.current.refreshHealth();
      });

      await waitFor(() => {
        expect(result.current.health?.status).toBe("degraded");
      });

      // Simulate recovery
      const recoveredHealth = createMockHealthSummary({
        status: "healthy",
        healthy: true,
      });
      seedHealthData(recoveredHealth);

      await act(async () => {
        await result.current.refreshHealth();
      });

      await waitFor(() => {
        expect(result.current.health?.status).toBe("healthy");
      });
    });
  });
});
