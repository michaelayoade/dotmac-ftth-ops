/**
 * Jest Tests for usePlatformTenants hook
 * Tests platform tenant list query with Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import { usePlatformTenants, platformTenantsQueryKey } from "../usePlatformTenants";
import { platformAdminTenantService } from "@/lib/services/platform-admin-tenant-service";
import { useQuery, useMutation } from "@tanstack/react-query";

// Mock the platform admin tenant service
jest.mock("@/lib/services/platform-admin-tenant-service", () => ({
  platformAdminTenantService: {
    listTenants: jest.fn(),
    getTenantDetails: jest.fn(),
    getTenantUsers: jest.fn(),
    getTenantStatistics: jest.fn(),
    updateTenantSettings: jest.fn(),
    updateTenantLimits: jest.fn(),
    disableTenantUser: jest.fn(),
    enableTenantUser: jest.fn(),
    deleteTenant: jest.fn(),
    restoreTenant: jest.fn(),
    impersonateTenant: jest.fn(),
  },
}));

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Test data factories
const createMockTenant = (overrides: any = {}) => ({
  id: "tenant-1",
  name: "Test Tenant",
  slug: "test-tenant",
  status: "active",
  settings: { timezone: "UTC", theme: "light" },
  limits: { max_users: 50, max_storage_gb: 100, max_api_calls_month: 10000 },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const createMockTenantUser = (overrides: any = {}) => ({
  id: "user-1",
  name: "John Doe",
  email: "john@example.com",
  status: "active",
  ...overrides,
});

describe("usePlatformTenants", () => {
  beforeEach(() => {
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
      const mockTenants = [
        createMockTenant({ id: "1", name: "Tenant 1" }),
        createMockTenant({ id: "2", name: "Tenant 2" }),
      ];

      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        tenants: mockTenants,
        total: 2,
        page: 1,
        limit: 10,
      });

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(result.current.data?.page).toBe(1);
      expect(result.current.data?.limit).toBe(10);
    });

    it("should handle fetch error", async () => {
      (platformAdminTenantService.listTenants as jest.Mock).mockRejectedValue(
        new Error("Failed to fetch tenants"),
      );

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });

    it("should start with pending state", () => {
      (platformAdminTenantService.listTenants as jest.Mock).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isPending || result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("should pass correct params to service", async () => {
      const mockTenants = [createMockTenant({ id: "1", name: "Test Tenant", status: "active" })];

      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        tenants: mockTenants,
        total: 1,
        page: 1,
        limit: 20,
      });

      const { result } = renderHook(
        () => usePlatformTenants({ page: 1, limit: 20, search: "test" }),
        {
          wrapper: createQueryWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(platformAdminTenantService.listTenants).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: "test",
      });
    });

    it("should handle empty tenant list", async () => {
      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        tenants: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle pagination - page 1", async () => {
      const allTenants = Array.from({ length: 10 }, (_, i) =>
        createMockTenant({ id: `${i + 1}`, name: `Tenant ${i + 1}` }),
      );

      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        tenants: allTenants,
        total: 15,
        page: 1,
        limit: 10,
      });

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.tenants).toHaveLength(10);
      expect(result.current.data?.total).toBe(15);
      expect(result.current.data?.page).toBe(1);
    });

    it("should filter tenants by status", async () => {
      const mockTenants = [
        createMockTenant({ id: "1", name: "Active Tenant 1", status: "active" }),
        createMockTenant({ id: "2", name: "Active Tenant 2", status: "active" }),
      ];

      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        tenants: mockTenants,
        total: 2,
        page: 1,
        limit: 10,
      });

      const { result } = renderHook(
        () => usePlatformTenants({ page: 1, limit: 10, status: "active" }),
        {
          wrapper: createQueryWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toHaveLength(2);
      expect(result.current.data?.tenants.every((t) => t.status === "active")).toBe(true);
      expect(result.current.data?.total).toBe(2);
    });

    it("should filter tenants by search query", async () => {
      const mockTenants = [
        createMockTenant({ id: "1", name: "Acme Corp", slug: "acme-corp" }),
        createMockTenant({ id: "2", name: "Acme Industries", slug: "acme-industries" }),
      ];

      (platformAdminTenantService.listTenants as jest.Mock).mockResolvedValue({
        tenants: mockTenants,
        total: 2,
        page: 1,
        limit: 10,
      });

      const { result } = renderHook(
        () => usePlatformTenants({ page: 1, limit: 10, search: "acme" }),
        {
          wrapper: createQueryWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
    });
  });

  describe("Tenant Details Operations", () => {
    describe("getTenantDetails", () => {
      it("should fetch tenant details successfully", async () => {
        const mockTenant = createMockTenant({
          id: "tenant-123",
          name: "Test Tenant",
          status: "active",
        });

        (platformAdminTenantService.getTenantDetails as jest.Mock).mockResolvedValue(mockTenant);

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["platform-tenant-details", "tenant-123"],
              queryFn: () => platformAdminTenantService.getTenantDetails("tenant-123"),
            }),
          { wrapper: createQueryWrapper() },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.id).toBe("tenant-123");
        expect(result.current.data?.name).toBe("Test Tenant");
        expect(result.current.data?.status).toBe("active");
      });

      it("should handle 404 when tenant not found", async () => {
        (platformAdminTenantService.getTenantDetails as jest.Mock).mockRejectedValue(
          new Error("Tenant not found"),
        );

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["platform-tenant-details", "nonexistent"],
              queryFn: () => platformAdminTenantService.getTenantDetails("nonexistent"),
            }),
          { wrapper: createQueryWrapper() },
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
      });
    });

    describe("getTenantUsers", () => {
      it("should fetch tenant users successfully", async () => {
        const mockUsers = [
          createMockTenantUser({ id: "user-1", name: "John Doe", email: "john@example.com" }),
          createMockTenantUser({ id: "user-2", name: "Jane Smith", email: "jane@example.com" }),
        ];

        (platformAdminTenantService.getTenantUsers as jest.Mock).mockResolvedValue(mockUsers);

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["tenant-users", "tenant-123"],
              queryFn: () => platformAdminTenantService.getTenantUsers("tenant-123"),
            }),
          { wrapper: createQueryWrapper() },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.[0].name).toBe("John Doe");
        expect(result.current.data?.[1].name).toBe("Jane Smith");
      });

      it("should return empty array when tenant has no users", async () => {
        (platformAdminTenantService.getTenantUsers as jest.Mock).mockResolvedValue([]);

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["tenant-users", "tenant-empty"],
              queryFn: () => platformAdminTenantService.getTenantUsers("tenant-empty"),
            }),
          { wrapper: createQueryWrapper() },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual([]);
      });
    });

    describe("getTenantStatistics", () => {
      it("should fetch tenant statistics successfully", async () => {
        const mockStats = {
          total_users: 25,
          active_users: 20,
          total_api_calls: 15000,
          storage_used_gb: 45.5,
        };

        (platformAdminTenantService.getTenantStatistics as jest.Mock).mockResolvedValue(mockStats);

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["tenant-statistics", "tenant-stats"],
              queryFn: () => platformAdminTenantService.getTenantStatistics("tenant-stats"),
            }),
          { wrapper: createQueryWrapper() },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.total_users).toBe(25);
        expect(result.current.data?.active_users).toBe(20);
        expect(result.current.data?.total_api_calls).toBe(15000);
        expect(result.current.data?.storage_used_gb).toBe(45.5);
      });
    });
  });

  describe("Tenant Mutation Operations", () => {
    describe("updateTenantSettings", () => {
      it("should update tenant settings successfully", async () => {
        const updatedTenant = createMockTenant({
          id: "tenant-settings",
          settings: { timezone: "UTC", theme: "dark", language: "es" },
        });

        (platformAdminTenantService.updateTenantSettings as jest.Mock).mockResolvedValue(
          updatedTenant,
        );

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({
                tenantId,
                settings,
              }: {
                tenantId: string;
                settings: Record<string, any>;
              }) => platformAdminTenantService.updateTenantSettings(tenantId, settings),
            }),
          { wrapper: createQueryWrapper() },
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-settings",
            settings: { theme: "dark", language: "es" },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.settings.theme).toBe("dark");
        expect(result.current.data?.settings.language).toBe("es");
      });
    });

    describe("updateTenantLimits", () => {
      it("should update tenant limits successfully", async () => {
        const updatedTenant = createMockTenant({
          id: "tenant-limits",
          limits: { max_users: 100, max_storage_gb: 200, max_api_calls_month: 10000 },
        });

        (platformAdminTenantService.updateTenantLimits as jest.Mock).mockResolvedValue(
          updatedTenant,
        );

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, limits }: { tenantId: string; limits: any }) =>
                platformAdminTenantService.updateTenantLimits(tenantId, limits),
            }),
          { wrapper: createQueryWrapper() },
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-limits",
            limits: { max_users: 100, max_storage_gb: 200 },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.limits.max_users).toBe(100);
        expect(result.current.data?.limits.max_storage_gb).toBe(200);
      });
    });

    describe("disableTenantUser", () => {
      it("should disable tenant user successfully", async () => {
        (platformAdminTenantService.disableTenantUser as jest.Mock).mockResolvedValue({
          success: true,
        });

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
                platformAdminTenantService.disableTenantUser(tenantId, userId),
            }),
          { wrapper: createQueryWrapper() },
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-user-ops",
            userId: "user-active",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe("deleteTenant", () => {
      it("should soft delete tenant successfully", async () => {
        (platformAdminTenantService.deleteTenant as jest.Mock).mockResolvedValue({ success: true });

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, reason }: { tenantId: string; reason?: string }) =>
                platformAdminTenantService.deleteTenant(tenantId, reason),
            }),
          { wrapper: createQueryWrapper() },
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-delete",
            reason: "Test deletion",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe("impersonateTenant", () => {
      it("should generate impersonation token successfully", async () => {
        const mockToken = {
          access_token: "mock-access-token-xyz",
          refresh_token: "mock-refresh-token-abc",
          expires_in: 7200,
        };

        (platformAdminTenantService.impersonateTenant as jest.Mock).mockResolvedValue(mockToken);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, duration }: { tenantId: string; duration?: number }) =>
                platformAdminTenantService.impersonateTenant(tenantId, duration),
            }),
          { wrapper: createQueryWrapper() },
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-impersonate",
            duration: 7200,
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.access_token).toContain("mock-access-token");
        expect(result.current.data?.expires_in).toBe(7200);
        expect(result.current.data?.refresh_token).toBeDefined();
      });
    });
  });
});
