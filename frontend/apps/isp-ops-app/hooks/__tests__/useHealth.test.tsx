/**
 * Unit Tests for useHealth hooks
 * Tests health monitoring hooks with Jest mocks for fast, reliable unit testing
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import axios from "axios";

// Mock dependencies BEFORE importing the hooks
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Don't mock axios itself, just use it
jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return {
    ...actual,
    isAxiosError: jest.fn(),
  };
});

import {
  useHealth,
  useHealthLegacy,
  healthKeys,
  type HealthSummary,
  type ServiceHealth,
} from "../useHealth";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Test Utilities
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function createMockService(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    name: "database",
    status: "healthy",
    message: "Service is running",
    required: true,
    uptime: 99.9,
    responseTime: 10,
    lastCheck: new Date().toISOString(),
    ...overrides,
  };
}

function createMockHealthSummary(overrides: Partial<HealthSummary> = {}): HealthSummary {
  return {
    status: "healthy",
    healthy: true,
    services: [createMockService()],
    failed_services: [],
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("useHealth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (axios.isAxiosError as jest.Mock).mockReturnValue(false);
  });

  describe("healthKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(healthKeys.all).toEqual(["health"]);
      expect(healthKeys.status()).toEqual(["health", "status"]);
    });
  });

  describe("Response Normalization", () => {
    it("should normalize wrapped success response", async () => {
      const wrappedResponse = {
        data: {
          success: true,
          data: {
            status: "healthy",
            healthy: true,
            services: [createMockService()],
            failed_services: [],
          },
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce(wrappedResponse);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("healthy");
      expect(result.current.health?.healthy).toBe(true);
      expect(result.current.health?.services).toHaveLength(1);
    });

    it("should normalize error response format", async () => {
      const errorResponse = {
        data: {
          error: {
            message: "Database connection failed",
          },
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce(errorResponse);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("degraded");
      expect(result.current.health?.healthy).toBe(false);
      expect((result.current.health as any)?.apiErrorMessage).toBe("Database connection failed");
      expect(result.current.error).toBe("Database connection failed");
    });

    it("should normalize direct health response", async () => {
      const directResponse = {
        data: {
          status: "healthy",
          healthy: true,
          services: [createMockService()],
          failed_services: [],
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce(directResponse);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("healthy");
      expect(result.current.health?.services).toHaveLength(1);
    });

    it("should handle unknown response format with fallback", async () => {
      const unknownResponse = {
        data: {
          someUnknownField: "value",
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce(unknownResponse);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("unknown");
      expect(result.current.health?.healthy).toBe(false);
      expect(result.current.health?.services).toHaveLength(0);
      expect(result.current.health?.failed_services).toHaveLength(0);
      expect(result.current.health?.timestamp).toBeDefined();
    });
  });

  describe("useHealth - basic functionality", () => {
    it("should fetch health status successfully", async () => {
      const mockHealth = createMockHealthSummary({
        status: "healthy",
        healthy: true,
        services: [
          createMockService({ name: "database", status: "healthy" }),
          createMockService({ name: "cache", status: "healthy" }),
        ],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      // Should start in loading state
      expect(result.current.loading).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health).toBeDefined();
      expect(result.current.health?.status).toBe("healthy");
      expect(result.current.health?.healthy).toBe(true);
      expect(result.current.health?.services).toHaveLength(2);
      expect(result.current.error).toBeNull();
      expect(result.current.isError).toBe(false);
      expect(apiClient.get).toHaveBeenCalledWith("/ready");
    });

    it("should handle degraded health status", async () => {
      const mockHealth = createMockHealthSummary({
        status: "degraded",
        healthy: false,
        services: [
          createMockService({ name: "database", status: "healthy" }),
          createMockService({ name: "cache", status: "degraded", message: "High latency" }),
        ],
        failed_services: ["cache"],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("degraded");
      expect(result.current.health?.healthy).toBe(false);
      expect(result.current.health?.failed_services).toContain("cache");
      expect(result.current.error).toBe("Service health is temporarily unavailable.");
    });

    it("should handle unhealthy status", async () => {
      const mockHealth = createMockHealthSummary({
        status: "unhealthy",
        healthy: false,
        services: [
          createMockService({
            name: "database",
            status: "unhealthy",
            message: "Connection failed",
          }),
        ],
        failed_services: ["database"],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("unhealthy");
      expect(result.current.health?.healthy).toBe(false);
    });

    it("should handle empty services array", async () => {
      const mockHealth = createMockHealthSummary({
        services: [],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.services).toHaveLength(0);
    });

    it("should have refresh functionality", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: createMockHealthSummary(),
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.refreshHealth).toBeDefined();
      expect(typeof result.current.refreshHealth).toBe("function");
      expect(result.current.refetch).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle 403 forbidden error", async () => {
      const error = {
        response: {
          status: 403,
          data: { message: "Forbidden" },
        },
      };

      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("forbidden");
      expect(result.current.health?.healthy).toBe(false);
      expect(result.current.error).toContain("permission");
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch health data", expect.any(Object));
    });

    it("should handle 500 server error", async () => {
      const error = {
        response: {
          status: 500,
          data: { message: "Internal Server Error" },
        },
      };

      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("degraded");
      expect(result.current.health?.healthy).toBe(false);
      expect(result.current.error).toBe("Service health is temporarily unavailable.");
      expect(logger.error).toHaveBeenCalled();
    });

    it("should handle 404 not found error", async () => {
      const error = {
        response: {
          status: 404,
          data: { message: "Not Found" },
        },
      };

      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("degraded");
      expect(result.current.health?.healthy).toBe(false);
    });

    it("should handle network timeout error", async () => {
      const error = new Error("timeout of 5000ms exceeded");
      (axios.isAxiosError as jest.Mock).mockReturnValue(false);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("degraded");
      expect(result.current.health?.healthy).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch health data", error);
    });

    it("should handle network failure error", async () => {
      const error = new Error("Network Error");
      (axios.isAxiosError as jest.Mock).mockReturnValue(false);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("degraded");
      expect(logger.error).toHaveBeenCalled();
    });

    it("should handle non-Error exceptions", async () => {
      const error = "String error";
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.status).toBe("degraded");
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch health data", expect.any(Error));
    });
  });

  describe("Error Message Priority", () => {
    it("should prioritize API error message over status-based message", async () => {
      const errorResponse = {
        data: {
          error: {
            message: "Custom API error",
          },
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce(errorResponse);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Custom API error");
    });

    it("should show forbidden message for forbidden status", async () => {
      const error = {
        response: { status: 403 },
      };

      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("You do not have permission to view service health.");
    });

    it("should show degraded message for degraded status", async () => {
      const error = new Error("Some error");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Service health is temporarily unavailable.");
    });

    it("should return null error for healthy status", async () => {
      const mockHealth = createMockHealthSummary({
        status: "healthy",
        healthy: true,
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeNull();
    });
  });

  describe("TanStack Query API", () => {
    it("should expose TanStack Query properties", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: createMockHealthSummary(),
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // TanStack Query properties
      expect(result.current.data).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.refetch).toBeDefined();

      // Legacy properties
      expect(result.current.loading).toBe(false);
      expect(result.current.health).toBeDefined();
      expect(result.current.refreshHealth).toBeDefined();
    });

    it("should have correct loading state during fetch", () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.loading).toBe(true);
    });
  });

  describe("useHealthLegacy wrapper", () => {
    it("should work with legacy API", async () => {
      const mockHealth = createMockHealthSummary();

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealthLegacy(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health).toBeDefined();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.refreshHealth).toBeDefined();
    });

    it("should handle errors with legacy API", async () => {
      const error = new Error("Health check failed");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useHealthLegacy(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.healthy).toBe(false);
      // useHealthLegacy returns the custom error message from useHealth
      expect(result.current.error).toBe("Service health is temporarily unavailable.");
    });

    it("should have refreshHealth function", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: createMockHealthSummary(),
      });

      const { result } = renderHook(() => useHealthLegacy(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.refreshHealth).toBeDefined();
      expect(typeof result.current.refreshHealth).toBe("function");
    });
  });

  describe("Edge Cases", () => {
    it("should handle services with missing optional fields", async () => {
      const mockHealth = createMockHealthSummary({
        services: [
          {
            name: "minimal-service",
            status: "healthy",
            message: "OK",
            required: true,
            // No uptime, responseTime, lastCheck
          },
        ],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const service = result.current.health?.services[0];
      expect(service?.name).toBe("minimal-service");
      expect(service?.uptime).toBeUndefined();
      expect(service?.responseTime).toBeUndefined();
      expect(service?.lastCheck).toBeUndefined();
    });

    it("should handle health summary with missing optional fields", async () => {
      const mockHealth: HealthSummary = {
        status: "healthy",
        healthy: true,
        services: [],
        failed_services: [],
        // No version, timestamp
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.version).toBeUndefined();
      expect(result.current.health?.timestamp).toBeUndefined();
    });

    it("should handle services with complete fields", async () => {
      const completeService = createMockService({
        name: "complete-service",
        status: "healthy",
        message: "All systems operational",
        required: true,
        uptime: 99.99,
        responseTime: 5,
        lastCheck: "2024-01-01T00:00:00Z",
      });

      const mockHealth = createMockHealthSummary({
        services: [completeService],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const service = result.current.health?.services[0];
      expect(service?.name).toBe("complete-service");
      expect(service?.uptime).toBe(99.99);
      expect(service?.responseTime).toBe(5);
      expect(service?.lastCheck).toBe("2024-01-01T00:00:00Z");
    });

    it("should handle null health data", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: null,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Should fallback to unknown format
      expect(result.current.health?.status).toBe("unknown");
      expect(result.current.health?.healthy).toBe(false);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle multiple services with mixed health", async () => {
      const mockHealth = createMockHealthSummary({
        status: "degraded",
        healthy: false,
        services: [
          createMockService({ name: "database", status: "healthy", responseTime: 10 }),
          createMockService({ name: "cache", status: "degraded", responseTime: 500 }),
          createMockService({ name: "search", status: "healthy", responseTime: 50 }),
          createMockService({ name: "queue", status: "unhealthy", message: "Timeout" }),
        ],
        failed_services: ["cache", "queue"],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.services).toHaveLength(4);

      const healthyServices = result.current.health?.services.filter((s) => s.status === "healthy");
      const degradedServices = result.current.health?.services.filter(
        (s) => s.status === "degraded",
      );
      const unhealthyServices = result.current.health?.services.filter(
        (s) => s.status === "unhealthy",
      );

      expect(healthyServices).toHaveLength(2);
      expect(degradedServices).toHaveLength(1);
      expect(unhealthyServices).toHaveLength(1);
    });

    it("should distinguish between required and optional services", async () => {
      const mockHealth = createMockHealthSummary({
        status: "degraded",
        healthy: false,
        services: [
          createMockService({ name: "database", status: "healthy", required: true }),
          createMockService({ name: "cache", status: "unhealthy", required: false }),
          createMockService({ name: "search", status: "degraded", required: false }),
        ],
        failed_services: ["cache", "search"],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const requiredServices = result.current.health?.services.filter((s) => s.required);
      const optionalServices = result.current.health?.services.filter((s) => !s.required);

      expect(requiredServices).toHaveLength(1);
      expect(requiredServices?.[0].status).toBe("healthy");
      expect(optionalServices).toHaveLength(2);
    });

    it("should handle version and timestamp information", async () => {
      const mockHealth = createMockHealthSummary({
        version: "2.5.1",
        timestamp: "2024-01-01T00:00:00Z",
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.health?.version).toBe("2.5.1");
      expect(result.current.health?.timestamp).toBe("2024-01-01T00:00:00Z");
    });

    it("should handle services with uptime metrics", async () => {
      const mockHealth = createMockHealthSummary({
        services: [
          createMockService({ name: "api", uptime: 99.99, responseTime: 10 }),
          createMockService({ name: "worker", uptime: 98.5, responseTime: 5 }),
        ],
      });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockHealth,
      });

      const { result } = renderHook(() => useHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const apiService = result.current.health?.services.find((s) => s.name === "api");
      const workerService = result.current.health?.services.find((s) => s.name === "worker");

      expect(apiService?.uptime).toBe(99.99);
      expect(apiService?.responseTime).toBe(10);
      expect(workerService?.uptime).toBe(98.5);
      expect(workerService?.responseTime).toBe(5);
    });
  });
});
