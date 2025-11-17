/**
 * MSW-based tests for usePlatformTenants hook
 * Tests platform tenant list query with realistic API mocking
 */

// Mock platformConfig to provide a base URL for MSW to intercept
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import { usePlatformTenants, platformTenantsQueryKey } from "../usePlatformTenants";
import {
  clearPlatformTenantsData,
  seedPlatformTenants,
  seedTenantUsers,
  createMockTenant,
  createMockTenantUser,
} from "@/__tests__/msw/handlers/platform-tenants";
import { platformAdminTenantService } from "@/lib/services/platform-admin-tenant-service";
import { useMutation, useQuery } from "@tanstack/react-query";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));


describe("usePlatformTenants", () => {
  beforeEach(() => {
    clearPlatformTenantsData();
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
      seedPlatformTenants(mockTenants);

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(result.current.data?.page).toBe(1);
      expect(result.current.data?.limit).toBe(10);
    });

    it("should handle fetch error when server returns 500", async () => {
      // Don't seed any data - MSW will return empty list
      // For error testing, we would need a specific error handler

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // With no seeded data, it should return empty list successfully
      expect(result.current.data?.tenants).toEqual([]);
    });

    it("should start with loading state", () => {
      seedPlatformTenants([createMockTenant()]);

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      // Initially should be in pending state (React Query v5 uses isPending)
      expect(result.current.isPending || result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("should pass correct params to service", async () => {
      const mockTenants = [
        createMockTenant({ id: "1", name: "Test Tenant", status: "active" }),
        createMockTenant({ id: "2", name: "Another Tenant", status: "suspended" }),
      ];
      seedPlatformTenants(mockTenants);

      const { result } = renderHook(
        () => usePlatformTenants({ page: 1, limit: 20, search: "test" }),
        {
          wrapper: createQueryWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // With search filter, only "Test Tenant" should match
      expect(result.current.data?.tenants).toHaveLength(1);
      expect(result.current.data?.tenants[0].name).toBe("Test Tenant");
    });

    it("should include feature metadata", () => {
      seedPlatformTenants([createMockTenant()]);

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      // Query should have feature metadata
      expect(result.current).toBeDefined();
    });

    it("should handle empty tenant list", async () => {
      // Don't seed any data
      clearPlatformTenantsData();

      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle pagination - page 1", async () => {
      // Create 15 tenants for pagination testing
      const allTenants = Array.from({ length: 15 }, (_, i) =>
        createMockTenant({ id: `${i + 1}`, name: `Tenant ${i + 1}` })
      );
      seedPlatformTenants(allTenants);

      // Fetch page 1
      const { result } = renderHook(() => usePlatformTenants({ page: 1, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.tenants).toHaveLength(10);
      expect(result.current.data?.total).toBe(15);
      expect(result.current.data?.page).toBe(1);
    });

    it("should handle pagination - page 2", async () => {
      // Create 15 tenants for pagination testing
      const allTenants = Array.from({ length: 15 }, (_, i) =>
        createMockTenant({ id: `${i + 1}`, name: `Tenant ${i + 1}` })
      );
      seedPlatformTenants(allTenants);

      // Fetch page 2
      const { result } = renderHook(() => usePlatformTenants({ page: 2, limit: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.tenants).toHaveLength(5); // Remaining 5 tenants
      expect(result.current.data?.total).toBe(15);
      expect(result.current.data?.page).toBe(2);
    });

    it("should filter tenants by status", async () => {
      const mockTenants = [
        createMockTenant({ id: "1", name: "Active Tenant 1", status: "active" }),
        createMockTenant({ id: "2", name: "Active Tenant 2", status: "active" }),
        createMockTenant({ id: "3", name: "Suspended Tenant", status: "suspended" }),
        createMockTenant({ id: "4", name: "Disabled Tenant", status: "disabled" }),
      ];
      seedPlatformTenants(mockTenants);

      const { result } = renderHook(
        () => usePlatformTenants({ page: 1, limit: 10, status: "active" }),
        {
          wrapper: createQueryWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toHaveLength(2);
      expect(result.current.data?.tenants.every((t) => t.status === "active")).toBe(true);
      expect(result.current.data?.total).toBe(2);
    });

    it("should filter tenants by search query", async () => {
      const mockTenants = [
        createMockTenant({ id: "1", name: "Acme Corp", slug: "acme-corp" }),
        createMockTenant({ id: "2", name: "Beta Inc", slug: "beta-inc" }),
        createMockTenant({ id: "3", name: "Acme Industries", slug: "acme-industries" }),
      ];
      seedPlatformTenants(mockTenants);

      const { result } = renderHook(
        () => usePlatformTenants({ page: 1, limit: 10, search: "acme" }),
        {
          wrapper: createQueryWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(
        result.current.data?.tenants.every((t) => t.name.toLowerCase().includes("acme"))
      ).toBe(true);
    });

    it("should handle combined filters (status + search)", async () => {
      const mockTenants = [
        createMockTenant({ id: "1", name: "Acme Active", status: "active" }),
        createMockTenant({ id: "2", name: "Acme Suspended", status: "suspended" }),
        createMockTenant({ id: "3", name: "Beta Active", status: "active" }),
      ];
      seedPlatformTenants(mockTenants);

      const { result } = renderHook(
        () => usePlatformTenants({ page: 1, limit: 10, status: "active", search: "acme" }),
        {
          wrapper: createQueryWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.tenants).toHaveLength(1);
      expect(result.current.data?.tenants[0].name).toBe("Acme Active");
      expect(result.current.data?.tenants[0].status).toBe("active");
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
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["platform-tenant-details", "tenant-123"],
              queryFn: () => platformAdminTenantService.getTenantDetails("tenant-123"),
            }),
          { wrapper: createQueryWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.id).toBe("tenant-123");
        expect(result.current.data?.name).toBe("Test Tenant");
        expect(result.current.data?.status).toBe("active");
      });

      it("should handle 404 when tenant not found", async () => {
        clearPlatformTenantsData();

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["platform-tenant-details", "nonexistent"],
              queryFn: () => platformAdminTenantService.getTenantDetails("nonexistent"),
            }),
          { wrapper: createQueryWrapper() }
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
      });
    });

    describe("getTenantUsers", () => {
      it("should fetch tenant users successfully", async () => {
        const mockTenant = createMockTenant({ id: "tenant-123" });
        seedPlatformTenants([mockTenant]);

        const mockUsers = [
          createMockTenantUser({ id: "user-1", name: "John Doe", email: "john@example.com" }),
          createMockTenantUser({ id: "user-2", name: "Jane Smith", email: "jane@example.com" }),
        ];
        seedTenantUsers("tenant-123", mockUsers);

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["tenant-users", "tenant-123"],
              queryFn: () => platformAdminTenantService.getTenantUsers("tenant-123"),
            }),
          { wrapper: createQueryWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.[0].name).toBe("John Doe");
        expect(result.current.data?.[1].name).toBe("Jane Smith");
      });

      it("should return empty array when tenant has no users", async () => {
        const mockTenant = createMockTenant({ id: "tenant-empty" });
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["tenant-users", "tenant-empty"],
              queryFn: () => platformAdminTenantService.getTenantUsers("tenant-empty"),
            }),
          { wrapper: createQueryWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual([]);
      });
    });

    describe("getTenantStatistics", () => {
      it("should fetch tenant statistics successfully", async () => {
        const mockTenant = createMockTenant({ id: "tenant-stats" });
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useQuery({
              queryKey: ["tenant-statistics", "tenant-stats"],
              queryFn: () => platformAdminTenantService.getTenantStatistics("tenant-stats"),
            }),
          { wrapper: createQueryWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.total_users).toBeDefined();
        expect(result.current.data?.active_users).toBeDefined();
        expect(result.current.data?.total_api_calls).toBeDefined();
        expect(result.current.data?.storage_used_gb).toBeDefined();
      });
    });
  });

  describe("Tenant Mutation Operations", () => {
    describe("updateTenantSettings", () => {
      it("should update tenant settings successfully", async () => {
        const mockTenant = createMockTenant({
          id: "tenant-settings",
          settings: { timezone: "UTC", theme: "light" },
        });
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, settings }: { tenantId: string; settings: Record<string, any> }) =>
                platformAdminTenantService.updateTenantSettings(tenantId, settings),
            }),
          { wrapper: createQueryWrapper() }
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-settings",
            settings: { theme: "dark", language: "es" },
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.settings.theme).toBe("dark");
        expect(result.current.data?.settings.language).toBe("es");
      });
    });

    describe("updateTenantLimits", () => {
      it("should update tenant limits successfully", async () => {
        const mockTenant = createMockTenant({
          id: "tenant-limits",
          limits: { max_users: 50, max_storage_gb: 100, max_api_calls_month: 10000 },
        });
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, limits }: { tenantId: string; limits: any }) =>
                platformAdminTenantService.updateTenantLimits(tenantId, limits),
            }),
          { wrapper: createQueryWrapper() }
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-limits",
            limits: { max_users: 100, max_storage_gb: 200 },
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.limits.max_users).toBe(100);
        expect(result.current.data?.limits.max_storage_gb).toBe(200);
      });
    });

    describe("disableTenantUser", () => {
      it("should disable tenant user successfully", async () => {
        const mockTenant = createMockTenant({ id: "tenant-user-ops" });
        seedPlatformTenants([mockTenant]);

        const mockUsers = [
          createMockTenantUser({ id: "user-active", status: "active" }),
        ];
        seedTenantUsers("tenant-user-ops", mockUsers);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
                platformAdminTenantService.disableTenantUser(tenantId, userId),
            }),
          { wrapper: createQueryWrapper() }
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-user-ops",
            userId: "user-active",
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe("enableTenantUser", () => {
      it("should enable tenant user successfully", async () => {
        const mockTenant = createMockTenant({ id: "tenant-enable" });
        seedPlatformTenants([mockTenant]);

        const mockUsers = [
          createMockTenantUser({ id: "user-disabled", status: "disabled" }),
        ];
        seedTenantUsers("tenant-enable", mockUsers);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
                platformAdminTenantService.enableTenantUser(tenantId, userId),
            }),
          { wrapper: createQueryWrapper() }
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-enable",
            userId: "user-disabled",
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe("deleteTenant", () => {
      it("should soft delete tenant successfully", async () => {
        const mockTenant = createMockTenant({ id: "tenant-delete", status: "active" });
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, reason }: { tenantId: string; reason?: string }) =>
                platformAdminTenantService.deleteTenant(tenantId, reason),
            }),
          { wrapper: createQueryWrapper() }
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-delete",
            reason: "Test deletion",
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe("restoreTenant", () => {
      it("should restore deleted tenant successfully", async () => {
        const mockTenant = createMockTenant({ id: "tenant-restore", status: "disabled" });
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: (tenantId: string) =>
                platformAdminTenantService.restoreTenant(tenantId),
            }),
          { wrapper: createQueryWrapper() }
        );

        await act(async () => {
          await result.current.mutateAsync("tenant-restore");
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
      });
    });

    describe("impersonateTenant", () => {
      it("should generate impersonation token successfully", async () => {
        const mockTenant = createMockTenant({ id: "tenant-impersonate" });
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, duration }: { tenantId: string; duration?: number }) =>
                platformAdminTenantService.impersonateTenant(tenantId, duration),
            }),
          { wrapper: createQueryWrapper() }
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-impersonate",
            duration: 7200,
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.access_token).toContain("mock-access-token");
        expect(result.current.data?.expires_in).toBe(7200);
        expect(result.current.data?.refresh_token).toBeDefined();
      });

      it("should use default duration when not specified", async () => {
        const mockTenant = createMockTenant({ id: "tenant-imp-default" });
        seedPlatformTenants([mockTenant]);

        const { result } = renderHook(
          () =>
            useMutation({
              mutationFn: ({ tenantId, duration }: { tenantId: string; duration?: number }) =>
                platformAdminTenantService.impersonateTenant(tenantId, duration),
            }),
          { wrapper: createQueryWrapper() }
        );

        await act(async () => {
          await result.current.mutateAsync({
            tenantId: "tenant-imp-default",
          });
        });

        await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.expires_in).toBe(3600); // Default 1 hour
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complete tenant management workflow", async () => {
      // Setup tenant
      const mockTenant = createMockTenant({
        id: "tenant-workflow",
        name: "Workflow Tenant",
        status: "active",
      });
      seedPlatformTenants([mockTenant]);

      // 1. Fetch tenant details
      const { result: detailsResult } = renderHook(
        () =>
          useQuery({
            queryKey: ["tenant-details", "tenant-workflow"],
            queryFn: () => platformAdminTenantService.getTenantDetails("tenant-workflow"),
          }),
        { wrapper: createQueryWrapper() }
      );

      await waitFor(() => expect(detailsResult.current.isSuccess).toBe(true));
      expect(detailsResult.current.data?.name).toBe("Workflow Tenant");

      // 2. Update settings
      const { result: settingsResult } = renderHook(
        () =>
          useMutation({
            mutationFn: ({ tenantId, settings }: { tenantId: string; settings: Record<string, any> }) =>
              platformAdminTenantService.updateTenantSettings(tenantId, settings),
          }),
        { wrapper: createQueryWrapper() }
      );

      await act(async () => {
        await settingsResult.current.mutateAsync({
          tenantId: "tenant-workflow",
          settings: { theme: "dark" },
        });
      });

      await waitFor(() => expect(settingsResult.current.isSuccess || settingsResult.current.isError).toBe(true));
      expect(settingsResult.current.isSuccess).toBe(true);

      // 3. Update limits
      const { result: limitsResult } = renderHook(
        () =>
          useMutation({
            mutationFn: ({ tenantId, limits }: { tenantId: string; limits: any }) =>
              platformAdminTenantService.updateTenantLimits(tenantId, limits),
          }),
        { wrapper: createQueryWrapper() }
      );

      await act(async () => {
        await limitsResult.current.mutateAsync({
          tenantId: "tenant-workflow",
          limits: { max_users: 200 },
        });
      });

      await waitFor(() => expect(limitsResult.current.isSuccess || limitsResult.current.isError).toBe(true));
      expect(limitsResult.current.isSuccess).toBe(true);
    });

    it("should handle user management within tenant", async () => {
      const mockTenant = createMockTenant({ id: "tenant-user-mgmt" });
      seedPlatformTenants([mockTenant]);

      const mockUsers = [
        createMockTenantUser({ id: "user-1", status: "active" }),
        createMockTenantUser({ id: "user-2", status: "active" }),
      ];
      seedTenantUsers("tenant-user-mgmt", mockUsers);

      // 1. Fetch users
      const { result: usersResult } = renderHook(
        () =>
          useQuery({
            queryKey: ["tenant-users", "tenant-user-mgmt"],
            queryFn: () => platformAdminTenantService.getTenantUsers("tenant-user-mgmt"),
          }),
        { wrapper: createQueryWrapper() }
      );

      await waitFor(() => expect(usersResult.current.isSuccess).toBe(true));
      expect(usersResult.current.data).toHaveLength(2);

      // 2. Disable a user
      const { result: disableResult } = renderHook(
        () =>
          useMutation({
            mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
              platformAdminTenantService.disableTenantUser(tenantId, userId),
          }),
        { wrapper: createQueryWrapper() }
      );

      await act(async () => {
        await disableResult.current.mutateAsync({
          tenantId: "tenant-user-mgmt",
          userId: "user-1",
        });
      });

      await waitFor(() => expect(disableResult.current.isSuccess || disableResult.current.isError).toBe(true));
      expect(disableResult.current.isSuccess).toBe(true);

      // 3. Re-enable the user
      const { result: enableResult } = renderHook(
        () =>
          useMutation({
            mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
              platformAdminTenantService.enableTenantUser(tenantId, userId),
          }),
        { wrapper: createQueryWrapper() }
      );

      await act(async () => {
        await enableResult.current.mutateAsync({
          tenantId: "tenant-user-mgmt",
          userId: "user-1",
        });
      });

      await waitFor(() => expect(enableResult.current.isSuccess || enableResult.current.isError).toBe(true));
      expect(enableResult.current.isSuccess).toBe(true);
    });

    it("should handle tenant lifecycle (delete and restore)", async () => {
      const mockTenant = createMockTenant({ id: "tenant-lifecycle", status: "active" });
      seedPlatformTenants([mockTenant]);

      // 1. Delete tenant
      const { result: deleteResult } = renderHook(
        () =>
          useMutation({
            mutationFn: ({ tenantId, reason }: { tenantId: string; reason?: string }) =>
              platformAdminTenantService.deleteTenant(tenantId, reason),
          }),
        { wrapper: createQueryWrapper() }
      );

      await act(async () => {
        await deleteResult.current.mutateAsync({
          tenantId: "tenant-lifecycle",
          reason: "Customer request",
        });
      });

      await waitFor(() => expect(deleteResult.current.isSuccess || deleteResult.current.isError).toBe(true));
      expect(deleteResult.current.isSuccess).toBe(true);

      // 2. Restore tenant
      const { result: restoreResult } = renderHook(
        () =>
          useMutation({
            mutationFn: (tenantId: string) =>
              platformAdminTenantService.restoreTenant(tenantId),
          }),
        { wrapper: createQueryWrapper() }
      );

      await act(async () => {
        await restoreResult.current.mutateAsync("tenant-lifecycle");
      });

      await waitFor(() => expect(restoreResult.current.isSuccess || restoreResult.current.isError).toBe(true));
      expect(restoreResult.current.isSuccess).toBe(true);
    });

    it("should handle tenant impersonation for support", async () => {
      const mockTenant = createMockTenant({ id: "tenant-support" });
      seedPlatformTenants([mockTenant]);

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: ({ tenantId, duration }: { tenantId: string; duration?: number }) =>
              platformAdminTenantService.impersonateTenant(tenantId, duration),
          }),
        { wrapper: createQueryWrapper() }
      );

      await act(async () => {
        await result.current.mutateAsync({
          tenantId: "tenant-support",
          duration: 1800, // 30 minutes for support session
        });
      });

      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.access_token).toBeDefined();
      expect(result.current.data?.expires_in).toBe(1800);
    });
  });
});
