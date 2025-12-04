/**
 * Tests for useVersioning hook
 * Tests API versioning management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useVersions,
  useVersion,
  useVersionUsageStats,
  useVersionHealth,
  useCreateVersion,
  useUpdateVersion,
  useDeprecateVersion,
  useUndeprecateVersion,
  useSetDefaultVersion,
  useRemoveVersion,
  useBreakingChanges,
  useBreakingChange,
  useCreateBreakingChange,
  useUpdateBreakingChange,
  useDeleteBreakingChange,
  useVersionAdoption,
  useVersioningConfiguration,
  useUpdateVersioningConfiguration,
  useVersioningOperations,
  versioningKeys,
  type APIVersionInfo,
  type BreakingChange,
  type VersionUsageStats,
  type VersionHealthCheck,
  type VersionAdoptionMetrics,
  type VersionConfiguration,
} from "../useVersioning";
import { versioningService } from "@/lib/services/versioning-service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/services/versioning-service", () => ({
  versioningService: {
    listVersions: jest.fn(),
    getVersion: jest.fn(),
    getVersionUsageStats: jest.fn(),
    getVersionHealth: jest.fn(),
    createVersion: jest.fn(),
    updateVersion: jest.fn(),
    deprecateVersion: jest.fn(),
    undeprecateVersion: jest.fn(),
    setDefaultVersion: jest.fn(),
    removeVersion: jest.fn(),
    listBreakingChanges: jest.fn(),
    getBreakingChange: jest.fn(),
    createBreakingChange: jest.fn(),
    updateBreakingChange: jest.fn(),
    deleteBreakingChange: jest.fn(),
    getAdoptionMetrics: jest.fn(),
    getConfiguration: jest.fn(),
    updateConfiguration: jest.fn(),
  },
}));

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useVersioning", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
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

  describe("versioningKeys", () => {
    it("should generate correct query keys", () => {
      expect(versioningKeys.all).toEqual(["versioning"]);
      expect(versioningKeys.versions()).toEqual(["versioning", "versions"]);
      expect(versioningKeys.version({ status: "active" })).toEqual([
        "versioning",
        "versions",
        { status: "active" },
      ]);
      expect(versioningKeys.versionDetail("v1")).toEqual(["versioning", "versions", "v1"]);
      expect(versioningKeys.versionUsage("v1", 30)).toEqual([
        "versioning",
        "versions",
        "v1",
        "usage",
        30,
      ]);
      expect(versioningKeys.versionHealth("v1")).toEqual([
        "versioning",
        "versions",
        "v1",
        "health",
      ]);
      expect(versioningKeys.breakingChanges()).toEqual(["versioning", "breaking-changes"]);
      expect(versioningKeys.breakingChange({ version: "v1" })).toEqual([
        "versioning",
        "breaking-changes",
        { version: "v1" },
      ]);
      expect(versioningKeys.breakingChangeDetail("change-1")).toEqual([
        "versioning",
        "breaking-changes",
        "change-1",
      ]);
      expect(versioningKeys.adoption(30)).toEqual(["versioning", "adoption", 30]);
      expect(versioningKeys.config()).toEqual(["versioning", "config"]);
    });
  });

  describe("useVersions - list versions", () => {
    it("should fetch all versions successfully", async () => {
      const mockVersions: APIVersionInfo[] = [
        {
          version: "v1",
          major: 1,
          minor: 0,
          patch: 0,
          status: "active",
          release_date: "2024-01-01T00:00:00Z",
          is_default: true,
          is_supported: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          version: "v2",
          major: 2,
          minor: 0,
          patch: 0,
          status: "deprecated",
          release_date: "2024-06-01T00:00:00Z",
          deprecation_date: "2024-09-01T00:00:00Z",
          sunset_date: "2024-12-01T00:00:00Z",
          is_default: false,
          is_supported: true,
          created_at: "2024-06-01T00:00:00Z",
          updated_at: "2024-09-01T00:00:00Z",
        },
      ];

      (versioningService.listVersions as jest.Mock).mockResolvedValue(mockVersions);

      const { result } = renderHook(() => useVersions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockVersions);
      expect(result.current.isSuccess).toBe(true);
      expect(versioningService.listVersions).toHaveBeenCalledWith({});
    });

    it("should fetch versions with filters", async () => {
      const mockVersions: APIVersionInfo[] = [
        {
          version: "v1",
          major: 1,
          minor: 0,
          patch: 0,
          status: "active",
          release_date: "2024-01-01T00:00:00Z",
          is_default: true,
          is_supported: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (versioningService.listVersions as jest.Mock).mockResolvedValue(mockVersions);

      const { result } = renderHook(() => useVersions({ status: "active" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockVersions);
      expect(versioningService.listVersions).toHaveBeenCalledWith({ status: "active" });
    });

    it("should handle empty versions array", async () => {
      (versioningService.listVersions as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useVersions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch versions");
      (versioningService.listVersions as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useVersions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should set loading state correctly", async () => {
      (versioningService.listVersions as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );

      const { result } = renderHook(() => useVersions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("useVersion - single version", () => {
    it("should fetch single version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: true,
        is_supported: true,
        description: "Version 1.0.0",
        documentation_url: "https://docs.example.com/v1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (versioningService.getVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useVersion("v1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockVersion);
      expect(versioningService.getVersion).toHaveBeenCalledWith("v1");
    });

    it("should not fetch when version is null", async () => {
      const { result } = renderHook(() => useVersion(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(versioningService.getVersion).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Version not found");
      (versioningService.getVersion as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useVersion("v1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });
  });

  describe("useVersionUsageStats - version usage statistics", () => {
    it("should fetch usage stats successfully", async () => {
      const mockStats: VersionUsageStats = {
        version: "v1",
        request_count: 1000,
        unique_clients: 50,
        error_rate: 0.05,
        avg_response_time: 150,
        last_used: "2024-01-15T00:00:00Z",
        adoption_percentage: 75.5,
      };

      (versioningService.getVersionUsageStats as jest.Mock).mockResolvedValue(mockStats);

      const { result } = renderHook(() => useVersionUsageStats("v1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(versioningService.getVersionUsageStats).toHaveBeenCalledWith("v1", 30);
    });

    it("should fetch usage stats with custom days parameter", async () => {
      const mockStats: VersionUsageStats = {
        version: "v1",
        request_count: 500,
        unique_clients: 25,
        error_rate: 0.02,
        avg_response_time: 120,
        last_used: "2024-01-15T00:00:00Z",
        adoption_percentage: 80.0,
      };

      (versioningService.getVersionUsageStats as jest.Mock).mockResolvedValue(mockStats);

      const { result } = renderHook(() => useVersionUsageStats("v1", 7), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(versioningService.getVersionUsageStats).toHaveBeenCalledWith("v1", 7);
    });

    it("should not fetch when version is null", async () => {
      const { result } = renderHook(() => useVersionUsageStats(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(versioningService.getVersionUsageStats).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch stats");
      (versioningService.getVersionUsageStats as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useVersionUsageStats("v1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });
  });

  describe("useVersionHealth - version health check", () => {
    it("should fetch health check successfully", async () => {
      const mockHealth: VersionHealthCheck = {
        version: "v1",
        is_healthy: true,
        issues: [],
        endpoint_health: [
          {
            endpoint: "/api/platform/v1/admin/users",
            is_available: true,
            error_rate: 0.01,
            avg_response_time: 100,
          },
        ],
      };

      (versioningService.getVersionHealth as jest.Mock).mockResolvedValue(mockHealth);

      const { result } = renderHook(() => useVersionHealth("v1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockHealth);
      expect(versioningService.getVersionHealth).toHaveBeenCalledWith("v1");
    });

    it("should handle unhealthy version", async () => {
      const mockHealth: VersionHealthCheck = {
        version: "v1",
        is_healthy: false,
        issues: [
          {
            type: "error",
            message: "High error rate detected",
            affected_endpoints: ["/api/platform/v1/admin/orders"],
          },
        ],
        endpoint_health: [
          {
            endpoint: "/api/platform/v1/admin/orders",
            is_available: true,
            error_rate: 0.25,
            avg_response_time: 500,
          },
        ],
      };

      (versioningService.getVersionHealth as jest.Mock).mockResolvedValue(mockHealth);

      const { result } = renderHook(() => useVersionHealth("v1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.is_healthy).toBe(false);
      expect(result.current.data?.issues).toHaveLength(1);
    });

    it("should not fetch when version is null", async () => {
      const { result } = renderHook(() => useVersionHealth(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(versioningService.getVersionHealth).not.toHaveBeenCalled();
    });
  });

  describe("useCreateVersion - mutation", () => {
    it("should create version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v3",
        major: 3,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (versioningService.createVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useCreateVersion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const created = await result.current.mutateAsync({
          version: "v3",
          description: "Version 3.0.0",
        });
        expect(created).toEqual(mockVersion);
      });

      expect(versioningService.createVersion).toHaveBeenCalledWith({
        version: "v3",
        description: "Version 3.0.0",
      });
    });

    it("should invalidate queries after successful creation", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v3",
        major: 3,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (versioningService.listVersions as jest.Mock).mockResolvedValue([]);
      (versioningService.createVersion as jest.Mock).mockResolvedValue(mockVersion);

      const wrapper = createWrapper();
      const { result: versionsResult } = renderHook(() => useVersions(), { wrapper });
      const { result: createResult } = renderHook(() => useCreateVersion(), { wrapper });

      await waitFor(() => expect(versionsResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listVersions as jest.Mock).mock.calls.length;

      await act(async () => {
        await createResult.current.mutateAsync({
          version: "v3",
        });
      });

      await waitFor(() => {
        expect((versioningService.listVersions as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });

    it("should handle create error", async () => {
      const error = new Error("Failed to create version");
      (versioningService.createVersion as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateVersion(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            version: "v3",
          });
        }),
      ).rejects.toThrow("Failed to create version");
    });

    it("should call onSuccess callback", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v3",
        major: 3,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (versioningService.createVersion as jest.Mock).mockResolvedValue(mockVersion);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useCreateVersion({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          version: "v3",
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockVersion);
    });

    it("should call onError callback", async () => {
      const error = new Error("Creation failed");
      (versioningService.createVersion as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useCreateVersion({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            version: "v3",
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("useUpdateVersion - mutation", () => {
    it("should update version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: true,
        is_supported: true,
        description: "Updated description",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.updateVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useUpdateVersion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const updated = await result.current.mutateAsync({
          version: "v1",
          data: { description: "Updated description" },
        });
        expect(updated).toEqual(mockVersion);
      });

      expect(versioningService.updateVersion).toHaveBeenCalledWith("v1", {
        description: "Updated description",
      });
    });

    it("should invalidate queries after successful update", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: true,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.listVersions as jest.Mock).mockResolvedValue([]);
      (versioningService.updateVersion as jest.Mock).mockResolvedValue(mockVersion);

      const wrapper = createWrapper();
      const { result: versionsResult } = renderHook(() => useVersions(), { wrapper });
      const { result: updateResult } = renderHook(() => useUpdateVersion(), { wrapper });

      await waitFor(() => expect(versionsResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listVersions as jest.Mock).mock.calls.length;

      await act(async () => {
        await updateResult.current.mutateAsync({
          version: "v1",
          data: { description: "Updated" },
        });
      });

      await waitFor(() => {
        expect((versioningService.listVersions as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });

    it("should handle update error", async () => {
      const error = new Error("Failed to update version");
      (versioningService.updateVersion as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateVersion(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            version: "v1",
            data: { description: "Updated" },
          });
        }),
      ).rejects.toThrow("Failed to update version");
    });
  });

  describe("useDeprecateVersion - mutation", () => {
    it("should deprecate version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "deprecated",
        release_date: "2024-01-01T00:00:00Z",
        deprecation_date: "2024-06-01T00:00:00Z",
        sunset_date: "2024-12-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-06-01T00:00:00Z",
      };

      (versioningService.deprecateVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useDeprecateVersion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const deprecated = await result.current.mutateAsync({
          version: "v1",
          data: {
            deprecation_date: "2024-06-01T00:00:00Z",
            sunset_date: "2024-12-01T00:00:00Z",
            reason: "End of life",
          },
        });
        expect(deprecated).toEqual(mockVersion);
      });

      expect(versioningService.deprecateVersion).toHaveBeenCalledWith("v1", {
        deprecation_date: "2024-06-01T00:00:00Z",
        sunset_date: "2024-12-01T00:00:00Z",
        reason: "End of life",
      });
    });

    it("should invalidate queries after successful deprecation", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "deprecated",
        release_date: "2024-01-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-06-01T00:00:00Z",
      };

      (versioningService.listVersions as jest.Mock).mockResolvedValue([]);
      (versioningService.deprecateVersion as jest.Mock).mockResolvedValue(mockVersion);

      const wrapper = createWrapper();
      const { result: versionsResult } = renderHook(() => useVersions(), { wrapper });
      const { result: deprecateResult } = renderHook(() => useDeprecateVersion(), { wrapper });

      await waitFor(() => expect(versionsResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listVersions as jest.Mock).mock.calls.length;

      await act(async () => {
        await deprecateResult.current.mutateAsync({
          version: "v1",
          data: {
            deprecation_date: "2024-06-01T00:00:00Z",
            sunset_date: "2024-12-01T00:00:00Z",
            reason: "EOL",
          },
        });
      });

      await waitFor(() => {
        expect((versioningService.listVersions as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });

  describe("useUndeprecateVersion - mutation", () => {
    it("should undeprecate version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.undeprecateVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useUndeprecateVersion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const undeprecated = await result.current.mutateAsync("v1");
        expect(undeprecated).toEqual(mockVersion);
      });

      expect(versioningService.undeprecateVersion).toHaveBeenCalledWith("v1");
    });

    it("should invalidate queries after successful undeprecation", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.listVersions as jest.Mock).mockResolvedValue([]);
      (versioningService.undeprecateVersion as jest.Mock).mockResolvedValue(mockVersion);

      const wrapper = createWrapper();
      const { result: versionsResult } = renderHook(() => useVersions(), { wrapper });
      const { result: undeprecateResult } = renderHook(() => useUndeprecateVersion(), { wrapper });

      await waitFor(() => expect(versionsResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listVersions as jest.Mock).mock.calls.length;

      await act(async () => {
        await undeprecateResult.current.mutateAsync("v1");
      });

      await waitFor(() => {
        expect((versioningService.listVersions as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });

  describe("useSetDefaultVersion - mutation", () => {
    it("should set default version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v2",
        major: 2,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: true,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.setDefaultVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useSetDefaultVersion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const defaultVersion = await result.current.mutateAsync("v2");
        expect(defaultVersion).toEqual(mockVersion);
      });

      expect(versioningService.setDefaultVersion).toHaveBeenCalledWith("v2");
    });

    it("should invalidate queries after setting default", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v2",
        major: 2,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: true,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.listVersions as jest.Mock).mockResolvedValue([]);
      (versioningService.setDefaultVersion as jest.Mock).mockResolvedValue(mockVersion);

      const wrapper = createWrapper();
      const { result: versionsResult } = renderHook(() => useVersions(), { wrapper });
      const { result: setDefaultResult } = renderHook(() => useSetDefaultVersion(), { wrapper });

      await waitFor(() => expect(versionsResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listVersions as jest.Mock).mock.calls.length;

      await act(async () => {
        await setDefaultResult.current.mutateAsync("v2");
      });

      await waitFor(() => {
        expect((versioningService.listVersions as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });

  describe("useRemoveVersion - mutation", () => {
    it("should remove version successfully", async () => {
      (versioningService.removeVersion as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useRemoveVersion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("v1");
      });

      expect(versioningService.removeVersion).toHaveBeenCalledWith("v1");
    });

    it("should invalidate queries after successful removal", async () => {
      (versioningService.listVersions as jest.Mock).mockResolvedValue([]);
      (versioningService.removeVersion as jest.Mock).mockResolvedValue(undefined);

      const wrapper = createWrapper();
      const { result: versionsResult } = renderHook(() => useVersions(), { wrapper });
      const { result: removeResult } = renderHook(() => useRemoveVersion(), { wrapper });

      await waitFor(() => expect(versionsResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listVersions as jest.Mock).mock.calls.length;

      await act(async () => {
        await removeResult.current.mutateAsync("v1");
      });

      await waitFor(() => {
        expect((versioningService.listVersions as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });

    it("should handle remove error", async () => {
      const error = new Error("Failed to remove version");
      (versioningService.removeVersion as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRemoveVersion(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("v1");
        }),
      ).rejects.toThrow("Failed to remove version");
    });
  });

  describe("useBreakingChanges - list breaking changes", () => {
    it("should fetch all breaking changes successfully", async () => {
      const mockChanges: BreakingChange[] = [
        {
          id: "change-1",
          version: "v2",
          change_type: "breaking",
          title: "API endpoint removed",
          description: "Removed deprecated endpoint",
          affected_endpoints: ["/api/platform/v1/admin/old-endpoint"],
          migration_steps: ["Use /api/v2/new-endpoint instead"],
          severity: "high",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (versioningService.listBreakingChanges as jest.Mock).mockResolvedValue(mockChanges);

      const { result } = renderHook(() => useBreakingChanges(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockChanges);
      expect(versioningService.listBreakingChanges).toHaveBeenCalledWith({});
    });

    it("should fetch breaking changes with filters", async () => {
      const mockChanges: BreakingChange[] = [
        {
          id: "change-1",
          version: "v2",
          change_type: "breaking",
          title: "Breaking change",
          description: "Description",
          affected_endpoints: [],
          migration_steps: [],
          severity: "critical",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (versioningService.listBreakingChanges as jest.Mock).mockResolvedValue(mockChanges);

      const { result } = renderHook(
        () => useBreakingChanges({ version: "v2", severity: "critical" }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockChanges);
      expect(versioningService.listBreakingChanges).toHaveBeenCalledWith({
        version: "v2",
        severity: "critical",
      });
    });

    it("should handle empty changes array", async () => {
      (versioningService.listBreakingChanges as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useBreakingChanges(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });
  });

  describe("useBreakingChange - single breaking change", () => {
    it("should fetch single breaking change successfully", async () => {
      const mockChange: BreakingChange = {
        id: "change-1",
        version: "v2",
        change_type: "breaking",
        title: "API endpoint removed",
        description: "Removed deprecated endpoint",
        affected_endpoints: ["/api/platform/v1/admin/old-endpoint"],
        migration_steps: ["Use /api/v2/new-endpoint instead"],
        before_example: "GET /api/platform/v1/admin/old-endpoint",
        after_example: "GET /api/v2/new-endpoint",
        severity: "high",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (versioningService.getBreakingChange as jest.Mock).mockResolvedValue(mockChange);

      const { result } = renderHook(() => useBreakingChange("change-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockChange);
      expect(versioningService.getBreakingChange).toHaveBeenCalledWith("change-1");
    });

    it("should not fetch when changeId is null", async () => {
      const { result } = renderHook(() => useBreakingChange(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(versioningService.getBreakingChange).not.toHaveBeenCalled();
    });
  });

  describe("useCreateBreakingChange - mutation", () => {
    it("should create breaking change successfully", async () => {
      const mockChange: BreakingChange = {
        id: "change-1",
        version: "v2",
        change_type: "breaking",
        title: "New breaking change",
        description: "Description",
        affected_endpoints: ["/api/platform/v1/admin/endpoint"],
        migration_steps: ["Step 1"],
        severity: "medium",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (versioningService.createBreakingChange as jest.Mock).mockResolvedValue(mockChange);

      const { result } = renderHook(() => useCreateBreakingChange(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const created = await result.current.mutateAsync({
          version: "v2",
          change_type: "breaking",
          title: "New breaking change",
          description: "Description",
          affected_endpoints: ["/api/platform/v1/admin/endpoint"],
          migration_steps: ["Step 1"],
          severity: "medium",
        });
        expect(created).toEqual(mockChange);
      });

      expect(versioningService.createBreakingChange).toHaveBeenCalled();
    });

    it("should invalidate queries after successful creation", async () => {
      const mockChange: BreakingChange = {
        id: "change-1",
        version: "v2",
        change_type: "breaking",
        title: "New breaking change",
        description: "Description",
        affected_endpoints: [],
        migration_steps: [],
        severity: "low",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (versioningService.listBreakingChanges as jest.Mock).mockResolvedValue([]);
      (versioningService.createBreakingChange as jest.Mock).mockResolvedValue(mockChange);

      const wrapper = createWrapper();
      const { result: changesResult } = renderHook(() => useBreakingChanges(), { wrapper });
      const { result: createResult } = renderHook(() => useCreateBreakingChange(), { wrapper });

      await waitFor(() => expect(changesResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listBreakingChanges as jest.Mock).mock.calls
        .length;

      await act(async () => {
        await createResult.current.mutateAsync({
          version: "v2",
          change_type: "breaking",
          title: "New change",
          description: "Desc",
          affected_endpoints: [],
          migration_steps: [],
          severity: "low",
        });
      });

      await waitFor(() => {
        expect(
          (versioningService.listBreakingChanges as jest.Mock).mock.calls.length,
        ).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("useUpdateBreakingChange - mutation", () => {
    it("should update breaking change successfully", async () => {
      const mockChange: BreakingChange = {
        id: "change-1",
        version: "v2",
        change_type: "breaking",
        title: "Updated title",
        description: "Updated description",
        affected_endpoints: [],
        migration_steps: [],
        severity: "high",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.updateBreakingChange as jest.Mock).mockResolvedValue(mockChange);

      const { result } = renderHook(() => useUpdateBreakingChange(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const updated = await result.current.mutateAsync({
          changeId: "change-1",
          data: { title: "Updated title", severity: "high" },
        });
        expect(updated).toEqual(mockChange);
      });

      expect(versioningService.updateBreakingChange).toHaveBeenCalledWith("change-1", {
        title: "Updated title",
        severity: "high",
      });
    });

    it("should invalidate queries after successful update", async () => {
      const mockChange: BreakingChange = {
        id: "change-1",
        version: "v2",
        change_type: "breaking",
        title: "Updated",
        description: "Desc",
        affected_endpoints: [],
        migration_steps: [],
        severity: "low",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.listBreakingChanges as jest.Mock).mockResolvedValue([]);
      (versioningService.updateBreakingChange as jest.Mock).mockResolvedValue(mockChange);

      const wrapper = createWrapper();
      const { result: changesResult } = renderHook(() => useBreakingChanges(), { wrapper });
      const { result: updateResult } = renderHook(() => useUpdateBreakingChange(), { wrapper });

      await waitFor(() => expect(changesResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listBreakingChanges as jest.Mock).mock.calls
        .length;

      await act(async () => {
        await updateResult.current.mutateAsync({
          changeId: "change-1",
          data: { title: "Updated" },
        });
      });

      await waitFor(() => {
        expect(
          (versioningService.listBreakingChanges as jest.Mock).mock.calls.length,
        ).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("useDeleteBreakingChange - mutation", () => {
    it("should delete breaking change successfully", async () => {
      (versioningService.deleteBreakingChange as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteBreakingChange(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("change-1");
      });

      expect(versioningService.deleteBreakingChange).toHaveBeenCalledWith("change-1");
    });

    it("should invalidate queries after successful deletion", async () => {
      (versioningService.listBreakingChanges as jest.Mock).mockResolvedValue([]);
      (versioningService.deleteBreakingChange as jest.Mock).mockResolvedValue(undefined);

      const wrapper = createWrapper();
      const { result: changesResult } = renderHook(() => useBreakingChanges(), { wrapper });
      const { result: deleteResult } = renderHook(() => useDeleteBreakingChange(), { wrapper });

      await waitFor(() => expect(changesResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.listBreakingChanges as jest.Mock).mock.calls
        .length;

      await act(async () => {
        await deleteResult.current.mutateAsync("change-1");
      });

      await waitFor(() => {
        expect(
          (versioningService.listBreakingChanges as jest.Mock).mock.calls.length,
        ).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("useVersionAdoption - adoption metrics", () => {
    it("should fetch adoption metrics successfully", async () => {
      const mockMetrics: VersionAdoptionMetrics = {
        total_clients: 100,
        versions: [
          {
            version: "v1",
            request_count: 500,
            unique_clients: 50,
            error_rate: 0.02,
            avg_response_time: 120,
            last_used: "2024-01-15T00:00:00Z",
            adoption_percentage: 50.0,
          },
          {
            version: "v2",
            request_count: 500,
            unique_clients: 50,
            error_rate: 0.01,
            avg_response_time: 100,
            last_used: "2024-01-15T00:00:00Z",
            adoption_percentage: 50.0,
          },
        ],
        deprecated_usage: 10,
        sunset_warnings: 5,
        migration_progress: [
          {
            from_version: "v1",
            to_version: "v2",
            migrated_clients: 30,
            pending_clients: 20,
            progress_percentage: 60.0,
          },
        ],
      };

      (versioningService.getAdoptionMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const { result } = renderHook(() => useVersionAdoption(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockMetrics);
      expect(versioningService.getAdoptionMetrics).toHaveBeenCalledWith(30);
    });

    it("should fetch adoption metrics with custom days parameter", async () => {
      const mockMetrics: VersionAdoptionMetrics = {
        total_clients: 50,
        versions: [],
        deprecated_usage: 0,
        sunset_warnings: 0,
        migration_progress: [],
      };

      (versioningService.getAdoptionMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const { result } = renderHook(() => useVersionAdoption(7), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockMetrics);
      expect(versioningService.getAdoptionMetrics).toHaveBeenCalledWith(7);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch metrics");
      (versioningService.getAdoptionMetrics as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useVersionAdoption(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });
  });

  describe("useVersioningConfiguration - configuration", () => {
    it("should fetch configuration successfully", async () => {
      const mockConfig: VersionConfiguration = {
        default_version: "v2",
        supported_versions: ["v1", "v2"],
        deprecated_versions: ["v0"],
        versioning_strategy: "url_path",
        strict_mode: true,
        auto_upgrade: false,
      };

      (versioningService.getConfiguration as jest.Mock).mockResolvedValue(mockConfig);

      const { result } = renderHook(() => useVersioningConfiguration(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockConfig);
      expect(versioningService.getConfiguration).toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch configuration");
      (versioningService.getConfiguration as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useVersioningConfiguration(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });
  });

  describe("useUpdateVersioningConfiguration - mutation", () => {
    it("should update configuration successfully", async () => {
      const mockConfig: VersionConfiguration = {
        default_version: "v2",
        supported_versions: ["v1", "v2"],
        deprecated_versions: [],
        versioning_strategy: "header",
        strict_mode: false,
        auto_upgrade: true,
      };

      (versioningService.updateConfiguration as jest.Mock).mockResolvedValue(mockConfig);

      const { result } = renderHook(() => useUpdateVersioningConfiguration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const updated = await result.current.mutateAsync({
          strict_mode: false,
          auto_upgrade: true,
        });
        expect(updated).toEqual(mockConfig);
      });

      expect(versioningService.updateConfiguration).toHaveBeenCalledWith({
        strict_mode: false,
        auto_upgrade: true,
      });
    });

    it("should invalidate queries after successful update", async () => {
      const mockConfig: VersionConfiguration = {
        default_version: "v2",
        supported_versions: ["v2"],
        deprecated_versions: [],
        versioning_strategy: "url_path",
        strict_mode: true,
        auto_upgrade: false,
      };

      (versioningService.getConfiguration as jest.Mock).mockResolvedValue(mockConfig);
      (versioningService.updateConfiguration as jest.Mock).mockResolvedValue(mockConfig);

      const wrapper = createWrapper();
      const { result: configResult } = renderHook(() => useVersioningConfiguration(), { wrapper });
      const { result: updateResult } = renderHook(() => useUpdateVersioningConfiguration(), {
        wrapper,
      });

      await waitFor(() => expect(configResult.current.isLoading).toBe(false));

      const initialCallCount = (versioningService.getConfiguration as jest.Mock).mock.calls.length;

      await act(async () => {
        await updateResult.current.mutateAsync({ strict_mode: true });
      });

      await waitFor(() => {
        expect((versioningService.getConfiguration as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });

  describe("useVersioningOperations - combined operations", () => {
    it("should deprecate version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "deprecated",
        release_date: "2024-01-01T00:00:00Z",
        deprecation_date: "2024-06-01T00:00:00Z",
        sunset_date: "2024-12-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-06-01T00:00:00Z",
      };

      (versioningService.deprecateVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useVersioningOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.deprecate("v1", {
          deprecation_date: "2024-06-01T00:00:00Z",
          sunset_date: "2024-12-01T00:00:00Z",
          reason: "EOL",
        });
        expect(success).toBe(true);
      });

      expect(versioningService.deprecateVersion).toHaveBeenCalledWith("v1", {
        deprecation_date: "2024-06-01T00:00:00Z",
        sunset_date: "2024-12-01T00:00:00Z",
        reason: "EOL",
      });
    });

    it("should handle deprecate error", async () => {
      const error = new Error("Deprecation failed");
      (versioningService.deprecateVersion as jest.Mock).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useVersioningOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.deprecate("v1", {
          deprecation_date: "2024-06-01T00:00:00Z",
          sunset_date: "2024-12-01T00:00:00Z",
          reason: "EOL",
        });
        expect(success).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalledWith("Failed to deprecate version:", error);
      consoleSpy.mockRestore();
    });

    it("should undeprecate version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v1",
        major: 1,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: false,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.undeprecateVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useVersioningOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.undeprecate("v1");
        expect(success).toBe(true);
      });

      expect(versioningService.undeprecateVersion).toHaveBeenCalledWith("v1");
    });

    it("should set default version successfully", async () => {
      const mockVersion: APIVersionInfo = {
        version: "v2",
        major: 2,
        minor: 0,
        patch: 0,
        status: "active",
        release_date: "2024-01-01T00:00:00Z",
        is_default: true,
        is_supported: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (versioningService.setDefaultVersion as jest.Mock).mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useVersioningOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.setDefault("v2");
        expect(success).toBe(true);
      });

      expect(versioningService.setDefaultVersion).toHaveBeenCalledWith("v2");
    });

    it("should remove version successfully", async () => {
      (versioningService.removeVersion as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useVersioningOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.remove("v1");
        expect(success).toBe(true);
      });

      expect(versioningService.removeVersion).toHaveBeenCalledWith("v1");
    });

    it("should track loading state correctly", async () => {
      (versioningService.deprecateVersion as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
      );

      const { result } = renderHook(() => useVersioningOperations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      // Start the deprecation in the background
      const deprecatePromise = act(async () => {
        await result.current.deprecate("v1", {
          deprecation_date: "2024-06-01T00:00:00Z",
          sunset_date: "2024-12-01T00:00:00Z",
          reason: "EOL",
        });
      });

      // Wait for loading to finish
      await deprecatePromise;

      // After mutation completes, loading should be false
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("All version statuses", () => {
    it("should handle all version status types", async () => {
      const statuses: Array<"active" | "deprecated" | "sunset" | "removed"> = [
        "active",
        "deprecated",
        "sunset",
        "removed",
      ];

      for (const status of statuses) {
        const mockVersions: APIVersionInfo[] = [
          {
            version: "v1",
            major: 1,
            minor: 0,
            patch: 0,
            status,
            release_date: "2024-01-01T00:00:00Z",
            is_default: false,
            is_supported: status !== "removed",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ];

        (versioningService.listVersions as jest.Mock).mockResolvedValue(mockVersions);

        const { result } = renderHook(() => useVersions({ status }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].status).toBe(status);
        jest.clearAllMocks();
      }
    });
  });

  describe("All change types", () => {
    it("should handle all change types", async () => {
      const changeTypes: Array<"breaking" | "feature" | "bugfix" | "security" | "performance"> = [
        "breaking",
        "feature",
        "bugfix",
        "security",
        "performance",
      ];

      for (const changeType of changeTypes) {
        const mockChanges: BreakingChange[] = [
          {
            id: "change-1",
            version: "v2",
            change_type: changeType,
            title: `${changeType} change`,
            description: "Description",
            affected_endpoints: [],
            migration_steps: [],
            severity: "low",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ];

        (versioningService.listBreakingChanges as jest.Mock).mockResolvedValue(mockChanges);

        const { result } = renderHook(() => useBreakingChanges({ change_type: changeType }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].change_type).toBe(changeType);
        jest.clearAllMocks();
      }
    });
  });

  describe("All severity levels", () => {
    it("should handle all severity levels", async () => {
      const severities: Array<"critical" | "high" | "medium" | "low"> = [
        "critical",
        "high",
        "medium",
        "low",
      ];

      for (const severity of severities) {
        const mockChanges: BreakingChange[] = [
          {
            id: "change-1",
            version: "v2",
            change_type: "breaking",
            title: "Change",
            description: "Description",
            affected_endpoints: [],
            migration_steps: [],
            severity,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ];

        (versioningService.listBreakingChanges as jest.Mock).mockResolvedValue(mockChanges);

        const { result } = renderHook(() => useBreakingChanges({ severity }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].severity).toBe(severity);
        jest.clearAllMocks();
      }
    });
  });

  describe("All versioning strategies", () => {
    it("should handle all versioning strategies", async () => {
      const strategies: Array<"url_path" | "header" | "query_param" | "accept_header"> = [
        "url_path",
        "header",
        "query_param",
        "accept_header",
      ];

      for (const strategy of strategies) {
        const mockConfig: VersionConfiguration = {
          default_version: "v1",
          supported_versions: ["v1"],
          deprecated_versions: [],
          versioning_strategy: strategy,
          strict_mode: false,
          auto_upgrade: false,
        };

        (versioningService.getConfiguration as jest.Mock).mockResolvedValue(mockConfig);

        const { result } = renderHook(() => useVersioningConfiguration(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.versioning_strategy).toBe(strategy);
        jest.clearAllMocks();
      }
    });
  });
});
