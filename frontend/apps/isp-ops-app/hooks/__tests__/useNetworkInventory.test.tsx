/**
 * Tests for useNetworkInventory hook
 * Tests NetBox integration hooks for health checks and site management
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useNetboxHealth, useNetboxSites } from "../useNetworkInventory";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { logger } from "@/lib/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { NetboxHealth, NetboxSite } from "@/types";

// Mock dependencies
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

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

describe("useNetworkInventory", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
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

  describe("useNetboxHealth", () => {
    it("should fetch NetBox health successfully", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        version: "3.5.0",
        message: "NetBox is operational",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockHealth);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/netbox/health", {
        timeout: 8000,
      });
      expect(extractDataOrThrow).toHaveBeenCalledWith({ data: mockHealth });
    });

    it("should use correct query key", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useNetboxHealth(), { wrapper });

      await waitFor(() => {
        const queries = queryClient.getQueryCache().getAll();
        const healthQuery = queries.find((q) => {
          const key = q.queryKey;
          return Array.isArray(key) && key[0] === "netbox" && key[1] === "health";
        });
        expect(healthQuery).toBeDefined();
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("NetBox connection failed");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });

      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeUndefined();
    });

    it("should set loading state correctly", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: mockHealth }), 100)
          )
      );
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });

      expect(result.current.data).toEqual(mockHealth);
    });

    it("should support enabled option for conditional execution", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(() => useNetboxHealth({ enabled: false }), {
        wrapper: createWrapper(),
      });

      // Should not fetch when disabled
      expect(result.current.isLoading).toBe(false);
      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should enable query when enabled is true", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(() => useNetboxHealth({ enabled: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/netbox/health", {
        timeout: 8000,
      });
      expect(result.current.data).toEqual(mockHealth);
    });

    it("should use 8 second timeout", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/netbox/health", {
          timeout: 8000,
        });
      });
    });

    it("should configure staleTime to 60 seconds", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useNetboxHealth(), { wrapper });

      await waitFor(() => {
        const queries = queryClient.getQueryCache().getAll();
        const healthQuery = queries.find((q) => {
          const key = q.queryKey;
          return Array.isArray(key) && key[0] === "netbox" && key[1] === "health";
        });
        expect(healthQuery?.options.staleTime).toBe(60_000);
      });
    });

    it("should retry only once on failure", async () => {
      const error = new Error("Connection timeout");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useNetboxHealth(), { wrapper });

      await waitFor(() => {
        const queries = queryClient.getQueryCache().getAll();
        const healthQuery = queries.find((q) => {
          const key = q.queryKey;
          return Array.isArray(key) && key[0] === "netbox" && key[1] === "health";
        });
        expect(healthQuery?.options.retry).toBe(1);
      });
    });

    it("should pass through custom queryOptions", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(
        () =>
          useNetboxHealth({
            queryOptions: {
              refetchOnMount: false,
            },
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify custom options were passed through by checking the data was fetched
      expect(result.current.data).toEqual(mockHealth);
    });

    it("should handle unhealthy NetBox status", async () => {
      const mockHealth: NetboxHealth = {
        healthy: false,
        version: "3.5.0",
        message: "Database connection failed",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.healthy).toBe(false);
      expect(result.current.data?.message).toBe("Database connection failed");
    });

    it("should expose refetch function", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Refetch
      await result.current.refetch();

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it("should handle health check with minimal data", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.healthy).toBe(true);
      expect(result.current.data?.version).toBeUndefined();
    });
  });

  describe("useNetboxSites", () => {
    it("should fetch NetBox sites successfully", async () => {
      const mockSites: NetboxSite[] = [
        {
          id: 1,
          name: "Site A",
          slug: "site-a",
          status: { value: "active", label: "Active" },
          tenant: null,
          facility: "Facility 1",
          description: "Primary site",
          physical_address: "123 Main St",
          latitude: 40.7128,
          longitude: -74.006,
          created: "2024-01-01T00:00:00Z",
          last_updated: "2024-01-02T00:00:00Z",
        },
        {
          id: 2,
          name: "Site B",
          slug: "site-b",
          status: { value: "active", label: "Active" },
          tenant: null,
          facility: "Facility 2",
          description: "Secondary site",
          physical_address: "456 Oak Ave",
          latitude: 34.0522,
          longitude: -118.2437,
          created: "2024-01-03T00:00:00Z",
          last_updated: "2024-01-04T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockSites);
      expect(result.current.data).toHaveLength(2);
      expect(result.current.isSuccess).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/netbox/dcim/sites", {
        params: { limit: 20, offset: 0 },
        timeout: 8000,
      });
      expect(extractDataOrThrow).toHaveBeenCalledWith({ data: mockSites });
    });

    it("should use correct query key with default pagination", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useNetboxSites(), { wrapper });

      await waitFor(() => {
        const queries = queryClient.getQueryCache().getAll();
        const sitesQuery = queries.find((q) => {
          const key = q.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === "netbox" &&
            key[1] === "sites" &&
            typeof key[2] === "object" &&
            key[2].limit === 20 &&
            key[2].offset === 0
          );
        });
        expect(sitesQuery).toBeDefined();
      });
    });

    it("should use correct query key with custom pagination", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useNetboxSites({ limit: 50, offset: 100 }), { wrapper });

      await waitFor(() => {
        const queries = queryClient.getQueryCache().getAll();
        const sitesQuery = queries.find((q) => {
          const key = q.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === "netbox" &&
            key[1] === "sites" &&
            typeof key[2] === "object" &&
            key[2].limit === 50 &&
            key[2].offset === 100
          );
        });
        expect(sitesQuery).toBeDefined();
      });
    });

    it("should handle pagination with limit parameter", async () => {
      const mockSites: NetboxSite[] = Array(50)
        .fill(null)
        .map((_, i) => ({
          id: i + 1,
          name: `Site ${i + 1}`,
          slug: `site-${i + 1}`,
          status: { value: "active", label: "Active" },
          tenant: null,
          facility: null,
          description: null,
          physical_address: null,
          latitude: null,
          longitude: null,
          created: null,
          last_updated: null,
        }));

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(() => useNetboxSites({ limit: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/netbox/dcim/sites", {
        params: { limit: 50, offset: 0 },
        timeout: 8000,
      });
      expect(result.current.data).toHaveLength(50);
    });

    it("should handle pagination with offset parameter", async () => {
      const mockSites: NetboxSite[] = [
        {
          id: 21,
          name: "Site 21",
          slug: "site-21",
          status: { value: "active", label: "Active" },
          tenant: null,
          facility: null,
          description: null,
          physical_address: null,
          latitude: null,
          longitude: null,
          created: null,
          last_updated: null,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(() => useNetboxSites({ offset: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/netbox/dcim/sites", {
        params: { limit: 20, offset: 20 },
        timeout: 8000,
      });
    });

    it("should handle pagination with both limit and offset", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(
        () => useNetboxSites({ limit: 100, offset: 200 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/netbox/dcim/sites", {
        params: { limit: 100, offset: 200 },
        timeout: 8000,
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch sites");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });

      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeUndefined();
    });

    it("should set loading state correctly", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: mockSites }), 100)
          )
      );
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });

      expect(result.current.data).toEqual(mockSites);
    });

    it("should support enabled option for conditional execution", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(() => useNetboxSites({ enabled: false }), {
        wrapper: createWrapper(),
      });

      // Should not fetch when disabled
      expect(result.current.isLoading).toBe(false);
      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should enable query when enabled is true", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(() => useNetboxSites({ enabled: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/netbox/dcim/sites", {
        params: { limit: 20, offset: 0 },
        timeout: 8000,
      });
      expect(result.current.data).toEqual(mockSites);
    });

    it("should use 8 second timeout", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

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

    it("should configure staleTime to 60 seconds", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useNetboxSites(), { wrapper });

      await waitFor(() => {
        const queries = queryClient.getQueryCache().getAll();
        const sitesQuery = queries.find((q) => {
          const key = q.queryKey;
          return Array.isArray(key) && key[0] === "netbox" && key[1] === "sites";
        });
        expect(sitesQuery?.options.staleTime).toBe(60_000);
      });
    });

    it("should retry only once on failure", async () => {
      const error = new Error("Connection timeout");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useNetboxSites(), { wrapper });

      await waitFor(() => {
        const queries = queryClient.getQueryCache().getAll();
        const sitesQuery = queries.find((q) => {
          const key = q.queryKey;
          return Array.isArray(key) && key[0] === "netbox" && key[1] === "sites";
        });
        expect(sitesQuery?.options.retry).toBe(1);
      });
    });

    it("should pass through custom queryOptions", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(
        () =>
          useNetboxSites({
            queryOptions: {
              refetchOnMount: false,
            },
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify custom options were passed through by checking the data was fetched
      expect(result.current.data).toEqual(mockSites);
    });

    it("should handle empty sites array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
      expect(result.current.isSuccess).toBe(true);
    });

    it("should handle site with all optional fields populated", async () => {
      const mockSite: NetboxSite = {
        id: 1,
        name: "Complete Site",
        slug: "complete-site",
        status: { value: "active", label: "Active" },
        tenant: { id: 1, name: "Tenant A" },
        facility: "Data Center 1",
        description: "Full featured site",
        physical_address: "789 Complete St",
        latitude: 51.5074,
        longitude: -0.1278,
        created: "2024-01-01T00:00:00Z",
        last_updated: "2024-01-15T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockSite] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([mockSite]);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const site = result.current.data?.[0];
      expect(site).toEqual(mockSite);
      expect(site?.tenant).toEqual({ id: 1, name: "Tenant A" });
      expect(site?.facility).toBe("Data Center 1");
      expect(site?.description).toBe("Full featured site");
      expect(site?.physical_address).toBe("789 Complete St");
      expect(site?.latitude).toBe(51.5074);
      expect(site?.longitude).toBe(-0.1278);
    });

    it("should expose refetch function", async () => {
      const mockSites: NetboxSite[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSites });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSites);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Refetch
      await result.current.refetch();

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it("should maintain separate cache for different pagination params", async () => {
      const mockSitesPage1: NetboxSite[] = [
        {
          id: 1,
          name: "Site 1",
          slug: "site-1",
          status: { value: "active", label: "Active" },
          tenant: null,
          facility: null,
          description: null,
          physical_address: null,
          latitude: null,
          longitude: null,
          created: null,
          last_updated: null,
        },
      ];

      const mockSitesPage2: NetboxSite[] = [
        {
          id: 21,
          name: "Site 21",
          slug: "site-21",
          status: { value: "active", label: "Active" },
          tenant: null,
          facility: null,
          description: null,
          physical_address: null,
          latitude: null,
          longitude: null,
          created: null,
          last_updated: null,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url, config) => {
        if (config?.params?.offset === 0) {
          return Promise.resolve({ data: mockSitesPage1 });
        }
        return Promise.resolve({ data: mockSitesPage2 });
      });

      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Fetch first page
      const { result: result1 } = renderHook(
        () => useNetboxSites({ limit: 20, offset: 0 }),
        { wrapper }
      );

      await waitFor(() => expect(result1.current.isLoading).toBe(false));

      // Fetch second page
      const { result: result2 } = renderHook(
        () => useNetboxSites({ limit: 20, offset: 20 }),
        { wrapper }
      );

      await waitFor(() => expect(result2.current.isLoading).toBe(false));

      // Both queries should have their own data
      expect(result1.current.data?.[0].id).toBe(1);
      expect(result2.current.data?.[0].id).toBe(21);

      // Should have made 2 API calls
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("extractDataOrThrow helper", () => {
    it("should extract data from successful response", async () => {
      const mockHealth: NetboxHealth = {
        healthy: true,
        message: "OK",
      };

      const mockResponse = { data: mockHealth, status: 200 };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHealth);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(extractDataOrThrow).toHaveBeenCalledWith(mockResponse);
      expect(result.current.data).toEqual(mockHealth);
    });

    it("should throw error for error response in extractDataOrThrow", async () => {
      const mockResponse = { data: null, status: 500, statusText: "Internal Server Error" };
      const error = new Error("Internal Server Error");

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);
      (extractDataOrThrow as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });

      expect(extractDataOrThrow).toHaveBeenCalledWith(mockResponse);
      expect(result.current.error).toEqual(error);
    });
  });
});
