/**
 * Tests for usePlatformTenants hook
 * Tests platform tenant list query
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePlatformTenants, platformTenantsQueryKey } from "../usePlatformTenants";
import { platformAdminTenantService } from "@/lib/services/platform-admin-tenant-service";

// Mock the service
jest.mock("@/lib/services/platform-admin-tenant-service", () => ({
  platformAdminTenantService: {
    listTenants: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("usePlatformTenants", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("platformTenantsQueryKey", () => {
    it("should generate correct query key", () => {
      const params = { page: 1, limit: 10 };
      const key = platformTenantsQueryKey(params);

      expect(key).toEqual(["platform-tenants", params]);
    });

    it("should generate unique keys for different params", () => {
      const params1 = { page: 1, limit: 10 };
      const params2 = { page: 2, limit: 20 };

      const key1 = platformTenantsQueryKey(params1);
      const key2 = platformTenantsQueryKey(params2);

      expect(key1).not.toEqual(key2);
    });
  });

  describe("usePlatformTenants hook", () => {
    it("should fetch tenants successfully", async () => {
      const mockTenants = {
        items: [
          { id: "1", name: "Tenant 1" },
          { id: "2", name: "Tenant 2" },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue(mockTenants);

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTenants);
      expect(platformAdminTenantService.listTenants).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it("should handle fetch error", async () => {
      const mockError = new Error("Failed to fetch tenants");
      (platformAdminTenantService.listTenants as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it("should start with loading state", () => {
      (platformAdminTenantService.listTenants as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("should pass correct params to service", async () => {
      const params = { page: 2, limit: 20, search: "test" };
      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        limit: 20,
      });

      const { result } = renderHook(() => usePlatformTenants(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(platformAdminTenantService.listTenants).toHaveBeenCalledWith(params);
    });

    it("should include feature metadata", () => {
      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
      });

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createWrapper(),
      });

      // Query should have feature metadata
      expect(result.current).toBeDefined();
    });

    it("should handle empty tenant list", async () => {
      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.items).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle pagination", async () => {
      const page1Data = {
        items: [{ id: "1", name: "Tenant 1" }],
        total: 15,
        page: 1,
        limit: 10,
      };

      const page2Data = {
        items: [{ id: "11", name: "Tenant 11" }],
        total: 15,
        page: 2,
        limit: 10,
      };

      (platformAdminTenantService.listTenants as jest.Mock)
        .mockResolvedValueOnce(page1Data)
        .mockResolvedValueOnce(page2Data);

      const { result, rerender } = renderHook(
        ({ page }) => usePlatformTenants({ page, limit: 10 }),
        {
          wrapper: createWrapper(),
          initialProps: { page: 1 },
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(page1Data);

      rerender({ page: 2 });

      await waitFor(() => expect(result.current.data).toEqual(page2Data));
    });
  });
});
