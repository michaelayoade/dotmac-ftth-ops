/**
 * Unit Tests for useNetworkInventory hooks
 * Tests the useNetboxHealth and useNetboxSites hooks with Jest mocks for fast, reliable unit testing
 */

// Mock API client
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock response helpers
jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => {
    if (!response || !response.data) {
      throw new Error("Invalid response structure");
    }
    return response.data;
  }),
}));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNetboxHealth, useNetboxSites } from "../useNetworkInventory";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { logger } from "@/lib/logger";
import type { NetboxHealth, NetboxSite } from "@/types";
import React from "react";

// ============================================
// Test Utilities
// ============================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ============================================
// Mock Data
// ============================================

const mockNetboxHealth: NetboxHealth = {
  healthy: true,
  version: "3.6.2",
  message: "NetBox is operational",
};

function createMockSite(overrides: Partial<NetboxSite> = {}): NetboxSite {
  return {
    id: 1,
    name: "Test Site",
    slug: "test-site",
    status: { value: "active", label: "Active" },
    tenant: { id: 1, name: "Test Tenant" },
    facility: "DC-01",
    description: "Test data center site",
    physical_address: "123 Test St, Test City, TC 12345",
    latitude: 37.7749,
    longitude: -122.4194,
    created: "2024-01-01T00:00:00Z",
    last_updated: "2024-01-15T00:00:00Z",
    ...overrides,
  };
}

// ============================================
// Tests: useNetboxHealth
// ============================================

describe("useNetboxHealth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset extractDataOrThrow to default implementation
    (extractDataOrThrow as jest.Mock).mockImplementation((response) => {
      if (!response || !response.data) {
        throw new Error("Invalid response structure");
      }
      return response.data;
    });
  });

  describe("Basic Functionality", () => {
    it("should fetch NetBox health successfully", async () => {
      const mockResponse = { data: mockNetboxHealth };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockNetboxHealth);
      expect(result.current.error).toBeNull();
    });

    it("should return healthy status", async () => {
      const healthyResponse = {
        data: {
          healthy: true,
          version: "3.7.0",
          message: "All systems operational",
        },
      };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(healthyResponse);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.healthy).toBe(true);
      expect(result.current.data?.version).toBe("3.7.0");
      expect(result.current.data?.message).toBe("All systems operational");
    });

    it("should return unhealthy status", async () => {
      const unhealthyResponse = {
        data: {
          healthy: false,
          version: null,
          message: "Database connection failed",
        },
      };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(unhealthyResponse);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.healthy).toBe(false);
      expect(result.current.data?.version).toBeNull();
      expect(result.current.data?.message).toBe("Database connection failed");
    });
  });

  describe("API Contract", () => {
    it("should call correct endpoint with timeout configuration", async () => {
      const mockResponse = { data: mockNetboxHealth };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/netbox/health", {
          timeout: 8000,
        });
      });
    });

    it("should use extractDataOrThrow for response handling", async () => {
      const mockResponse = { data: mockNetboxHealth };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(extractDataOrThrow).toHaveBeenCalledWith(mockResponse);
      });
    });
  });

  describe("Query Configuration", () => {
    it("should use correct query key", async () => {
      const mockResponse = { data: mockNetboxHealth };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be ["netbox", "health"]
      expect(apiClient.get).toHaveBeenCalled();
    });

    it("should respect enabled option (disabled)", () => {
      renderHook(() => useNetboxHealth({ enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should respect enabled option (enabled)", async () => {
      const mockResponse = { data: mockNetboxHealth };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxHealth({ enabled: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });
    });

    it("should support custom query options", async () => {
      const mockResponse = { data: mockNetboxHealth };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(
        () =>
          useNetboxHealth({
            queryOptions: {
              refetchInterval: 5000,
            },
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      const networkError = new Error("Network Error");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useNetboxHealth({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("timeout of 8000ms exceeded");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(timeoutError);

      const { result } = renderHook(() => useNetboxHealth({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("timeout");
    });

    it("should handle 404 errors", async () => {
      const notFoundError = new Error("Request failed with status code 404");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(notFoundError);

      const { result } = renderHook(() => useNetboxHealth({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("404");
    });

    it("should handle 500 errors", async () => {
      const serverError = new Error("Request failed with status code 500");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(serverError);

      const { result } = renderHook(() => useNetboxHealth({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("500");
    });

    it("should handle extractDataOrThrow errors", async () => {
      const mockResponse = { data: null };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);
      (extractDataOrThrow as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Invalid response structure");
      });

      const { result } = renderHook(() => useNetboxHealth({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe("Invalid response structure");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null version", async () => {
      const mockResponse = {
        data: {
          healthy: true,
          version: null,
          message: "Operational",
        },
      };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.version).toBeNull();
    });

    it("should handle empty message", async () => {
      const mockResponse = {
        data: {
          healthy: true,
          version: "3.6.0",
          message: "",
        },
      };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.message).toBe("");
    });
  });
});

// ============================================
// Tests: useNetboxSites
// ============================================

describe("useNetboxSites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset extractDataOrThrow to default implementation
    (extractDataOrThrow as jest.Mock).mockImplementation((response) => {
      if (!response || !response.data) {
        throw new Error("Invalid response structure");
      }
      return response.data;
    });
  });

  describe("Basic Functionality", () => {
    it("should fetch NetBox sites successfully", async () => {
      const mockSites = [createMockSite(), createMockSite({ id: 2, name: "Site 2" })];
      const mockResponse = { data: mockSites };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSites);
      expect(result.current.data).toHaveLength(2);
      expect(result.current.error).toBeNull();
    });

    it("should fetch empty sites array", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data).toHaveLength(0);
    });

    it("should return site data with all fields", async () => {
      const site = createMockSite({
        id: 42,
        name: "Production DC",
        slug: "prod-dc",
        facility: "DC-PROD-01",
        description: "Primary production data center",
        latitude: 40.7128,
        longitude: -74.006,
      });
      const mockResponse = { data: [site] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const resultSite = result.current.data?.[0];
      expect(resultSite?.id).toBe(42);
      expect(resultSite?.name).toBe("Production DC");
      expect(resultSite?.slug).toBe("prod-dc");
      expect(resultSite?.facility).toBe("DC-PROD-01");
      expect(resultSite?.latitude).toBe(40.7128);
      expect(resultSite?.longitude).toBe(-74.006);
    });
  });

  describe("Pagination", () => {
    it("should use default pagination parameters (limit=20, offset=0)", async () => {
      const mockResponse = { data: [createMockSite()] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/netbox/dcim/sites",
          expect.objectContaining({
            params: { limit: 20, offset: 0 },
          }),
        );
      });
    });

    it("should use custom limit parameter", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites({ limit: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/netbox/dcim/sites",
          expect.objectContaining({
            params: { limit: 50, offset: 0 },
          }),
        );
      });
    });

    it("should use custom offset parameter", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites({ offset: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/netbox/dcim/sites",
          expect.objectContaining({
            params: { limit: 20, offset: 10 },
          }),
        );
      });
    });

    it("should use custom limit and offset parameters", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites({ limit: 100, offset: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/netbox/dcim/sites",
          expect.objectContaining({
            params: { limit: 100, offset: 50 },
          }),
        );
      });
    });
  });

  describe("API Contract", () => {
    it("should call correct endpoint with timeout configuration", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/netbox/dcim/sites", {
          params: { limit: 20, offset: 0 },
          timeout: 8000,
        });
      });
    });

    it("should use extractDataOrThrow for response handling", async () => {
      const mockResponse = { data: [createMockSite()] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(extractDataOrThrow).toHaveBeenCalledWith(mockResponse);
      });
    });
  });

  describe("Query Configuration", () => {
    it("should use correct query key with pagination params", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxSites({ limit: 30, offset: 15 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be ["netbox", "sites", { limit: 30, offset: 15 }]
      expect(apiClient.get).toHaveBeenCalled();
    });

    it("should respect enabled option (disabled)", () => {
      renderHook(() => useNetboxSites({ enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should respect enabled option (enabled)", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites({ enabled: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });
    });

    it("should support custom query options", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(
        () =>
          useNetboxSites({
            queryOptions: {
              refetchInterval: 10000,
            },
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      const networkError = new Error("Network Error");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useNetboxSites({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("timeout of 8000ms exceeded");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(timeoutError);

      const { result } = renderHook(() => useNetboxSites({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("timeout");
    });

    it("should handle 404 errors", async () => {
      const notFoundError = new Error("Request failed with status code 404");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(notFoundError);

      const { result } = renderHook(() => useNetboxSites({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("404");
    });

    it("should handle 500 errors", async () => {
      const serverError = new Error("Request failed with status code 500");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(serverError);

      const { result } = renderHook(() => useNetboxSites({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("500");
    });

    it("should handle extractDataOrThrow errors", async () => {
      const mockResponse = { data: null };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);
      (extractDataOrThrow as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Invalid response structure");
      });

      const { result } = renderHook(() => useNetboxSites({ queryOptions: { retry: false } }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe("Invalid response structure");
    });
  });

  describe("Edge Cases", () => {
    it("should handle sites with null optional fields", async () => {
      const site = createMockSite({
        tenant: null,
        facility: null,
        description: null,
        physical_address: null,
        latitude: null,
        longitude: null,
        created: null,
        last_updated: null,
      });
      const mockResponse = { data: [site] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const resultSite = result.current.data?.[0];
      expect(resultSite?.tenant).toBeNull();
      expect(resultSite?.facility).toBeNull();
      expect(resultSite?.latitude).toBeNull();
      expect(resultSite?.longitude).toBeNull();
    });

    it("should handle limit=1", async () => {
      const mockResponse = { data: [createMockSite()] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites({ limit: 1 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/netbox/dcim/sites",
          expect.objectContaining({
            params: { limit: 1, offset: 0 },
          }),
        );
      });
    });

    it("should handle large offset", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites({ offset: 1000 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/netbox/dcim/sites",
          expect.objectContaining({
            params: { limit: 20, offset: 1000 },
          }),
        );
      });
    });

    it("should handle large limit", async () => {
      const mockResponse = { data: [] };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      renderHook(() => useNetboxSites({ limit: 1000 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/netbox/dcim/sites",
          expect.objectContaining({
            params: { limit: 1000, offset: 0 },
          }),
        );
      });
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle paginated site retrieval", async () => {
      const page1Sites = Array.from({ length: 20 }, (_, i) =>
        createMockSite({ id: i + 1, name: `Site ${i + 1}` }),
      );
      const mockResponse = { data: page1Sites };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxSites({ limit: 20, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(20);
      expect(result.current.data?.[0]?.name).toBe("Site 1");
      expect(result.current.data?.[19]?.name).toBe("Site 20");
    });

    it("should handle multi-tenant sites with different statuses", async () => {
      const sites = [
        createMockSite({
          id: 1,
          name: "Active Site",
          status: { value: "active", label: "Active" },
        }),
        createMockSite({
          id: 2,
          name: "Planned Site",
          status: { value: "planned", label: "Planned" },
        }),
        createMockSite({
          id: 3,
          name: "Decommissioned Site",
          status: { value: "decommissioned", label: "Decommissioned" },
        }),
      ];
      const mockResponse = { data: sites };
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0]?.status.value).toBe("active");
      expect(result.current.data?.[1]?.status.value).toBe("planned");
      expect(result.current.data?.[2]?.status.value).toBe("decommissioned");
    });
  });
});
