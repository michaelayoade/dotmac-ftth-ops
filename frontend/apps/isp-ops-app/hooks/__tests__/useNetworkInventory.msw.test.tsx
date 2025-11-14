/**
 * MSW-powered tests for useNetworkInventory (NetBox hooks)
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useNetboxHealth, useNetboxSites } from "../useNetworkInventory";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetNetworkInventoryStorage,
  createMockNetboxHealth,
  createMockNetboxSite,
  seedNetworkInventoryData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useNetworkInventory (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetNetworkInventoryStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useNetboxHealth", () => {
    it("should fetch NetBox health successfully", async () => {
      const mockHealth = createMockNetboxHealth({
        status: 'healthy',
        version: '3.5.0',
      });

      seedNetworkInventoryData(mockHealth, []);

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.status).toBe('healthy');
      expect(result.current.data?.version).toBe('3.5.0');
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/netbox/health', 'Server error');

      const { result } = renderHook(() => useNetboxHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should not fetch when enabled is false", () => {
      const { result } = renderHook(() => useNetboxHealth({ enabled: false }), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should respect custom query options", async () => {
      const mockHealth = createMockNetboxHealth();
      seedNetworkInventoryData(mockHealth, []);

      const { result } = renderHook(
        () =>
          useNetboxHealth({
            queryOptions: {
              staleTime: 120000,
            },
          }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });
  });

  describe("useNetboxSites", () => {
    it("should fetch NetBox sites successfully", async () => {
      const mockSites = [
        createMockNetboxSite({ id: 1, name: "Site 1", slug: "site-1" }),
        createMockNetboxSite({ id: 2, name: "Site 2", slug: "site-2" }),
        createMockNetboxSite({ id: 3, name: "Site 3", slug: "site-3" }),
      ];

      seedNetworkInventoryData(null, mockSites);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].name).toBe("Site 1");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty sites list", async () => {
      seedNetworkInventoryData(null, []);

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle pagination with limit", async () => {
      const mockSites = Array.from({ length: 25 }, (_, i) =>
        createMockNetboxSite({ id: i + 1, name: `Site ${i + 1}`, slug: `site-${i + 1}` })
      );

      seedNetworkInventoryData(null, mockSites);

      const { result } = renderHook(() => useNetboxSites({ limit: 10 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(10);
      expect(result.current.data?.[0].name).toBe("Site 1");
    });

    it("should handle pagination with offset", async () => {
      const mockSites = Array.from({ length: 25 }, (_, i) =>
        createMockNetboxSite({ id: i + 1, name: `Site ${i + 1}`, slug: `site-${i + 1}` })
      );

      seedNetworkInventoryData(null, mockSites);

      const { result } = renderHook(
        () => useNetboxSites({ limit: 10, offset: 10 }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(10);
      expect(result.current.data?.[0].name).toBe("Site 11");
    });

    it("should not fetch when enabled is false", () => {
      const { result } = renderHook(() => useNetboxSites({ enabled: false }), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/netbox/dcim/sites', 'Server error');

      const { result } = renderHook(() => useNetboxSites(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle concurrent health and sites fetches", async () => {
      const mockHealth = createMockNetboxHealth({ status: 'healthy' });
      const mockSites = [
        createMockNetboxSite({ name: "Site 1" }),
        createMockNetboxSite({ name: "Site 2" }),
      ];

      seedNetworkInventoryData(mockHealth, mockSites);

      const { result: healthResult } = renderHook(() => useNetboxHealth(), {
        wrapper: createQueryWrapper(queryClient),
      });

      const { result: sitesResult } = renderHook(() => useNetboxSites(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Both should load independently
      await waitFor(() => {
        expect(healthResult.current.isLoading).toBe(false);
        expect(sitesResult.current.isLoading).toBe(false);
      });

      expect(healthResult.current.data?.status).toBe('healthy');
      expect(sitesResult.current.data).toHaveLength(2);
    });

    it("should handle NetBox with many sites", async () => {
      const mockHealth = createMockNetboxHealth({ status: 'healthy' });
      const mockSites = Array.from({ length: 100 }, (_, i) =>
        createMockNetboxSite({ id: i + 1, name: `Site ${i + 1}` })
      );

      seedNetworkInventoryData(mockHealth, mockSites);

      // Fetch first page
      const { result: page1 } = renderHook(
        () => useNetboxSites({ limit: 20, offset: 0 }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      // Fetch second page
      const { result: page2 } = renderHook(
        () => useNetboxSites({ limit: 20, offset: 20 }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(page1.current.isLoading).toBe(false);
        expect(page2.current.isLoading).toBe(false);
      });

      expect(page1.current.data).toHaveLength(20);
      expect(page2.current.data).toHaveLength(20);
      expect(page1.current.data?.[0].name).toBe("Site 1");
      expect(page2.current.data?.[0].name).toBe("Site 21");
    });
  });
});
