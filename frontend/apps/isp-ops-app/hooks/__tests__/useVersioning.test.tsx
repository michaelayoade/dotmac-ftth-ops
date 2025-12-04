/**
 * Jest Mock Tests for useVersioning hooks
 * Tests API versioning management with Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  versioningKeys,
} from "../useVersioning";

// Mock versioning service
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

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

import { versioningService } from "@/lib/services/versioning-service";
import { server } from "@/__tests__/msw/server";

const mockService = versioningService as jest.Mocked<typeof versioningService>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useVersioning (Jest Mocks)", () => {
  beforeAll(() => {
    server.resetHandlers();
    server.close();
  });

  afterAll(() => {
    server.listen();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("versioningKeys", () => {
    it("should generate correct query keys", () => {
      expect(versioningKeys.all).toEqual(["versioning"]);
      expect(versioningKeys.versions()).toEqual(["versioning", "versions"]);
      expect(versioningKeys.versionDetail("v1")).toEqual(["versioning", "versions", "v1"]);
    });
  });

  describe("useVersions", () => {
    it("should fetch versions successfully", async () => {
      mockService.listVersions.mockResolvedValueOnce([
        { version: "v1", status: "active", is_default: true, is_supported: true },
        { version: "v2", status: "active", is_supported: true },
      ] as any);

      const { result } = renderHook(() => useVersions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].version).toBe("v1");
    });

    it("should filter versions by status", async () => {
      mockService.listVersions.mockResolvedValueOnce([{ version: "v1", status: "active" }] as any);

      const { result } = renderHook(() => useVersions({ status: "active" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].status).toBe("active");
    });
  });

  describe("useVersion", () => {
    it("should fetch single version successfully", async () => {
      mockService.getVersion.mockResolvedValueOnce({
        version: "v1",
        status: "active",
        description: "Version 1",
      } as any);

      const { result } = renderHook(() => useVersion("v1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.version).toBe("v1");
      expect(result.current.data?.description).toBe("Version 1");
    });

    it("should not fetch when version is null", async () => {
      const { result } = renderHook(() => useVersion(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useCreateVersion", () => {
    it("should create version successfully", async () => {
      mockService.createVersion.mockResolvedValueOnce({
        version: "v2",
        description: "Version 2",
        status: "active",
      } as any);

      const { result } = renderHook(() => useCreateVersion(), {
        wrapper: createWrapper(),
      });

      let createdVersion: any;
      await act(async () => {
        createdVersion = await result.current.mutateAsync({
          version: "v2",
          description: "Version 2",
        });
      });

      expect(createdVersion).toBeDefined();
      expect(createdVersion.version).toBe("v2");
    });
  });

  describe("useDeprecateVersion", () => {
    it("should deprecate version successfully", async () => {
      mockService.deprecateVersion.mockResolvedValueOnce({
        version: "v1",
        status: "deprecated",
        deprecation_date: "2025-01-01T00:00:00Z",
      } as any);

      const { result } = renderHook(() => useDeprecateVersion(), {
        wrapper: createWrapper(),
      });

      let deprecatedVersion: any;
      await act(async () => {
        deprecatedVersion = await result.current.mutateAsync({
          version: "v1",
          data: {
            deprecation_date: "2025-01-01T00:00:00Z",
            sunset_date: "2025-06-01T00:00:00Z",
            reason: "Replaced by v2",
          },
        });
      });

      expect(deprecatedVersion.status).toBe("deprecated");
    });
  });

  describe("useBreakingChanges", () => {
    it("should fetch breaking changes successfully", async () => {
      mockService.listBreakingChanges.mockResolvedValueOnce([
        { id: "change-1", version: "v2", title: "Breaking Change 1", severity: "high" },
        { id: "change-2", version: "v2", title: "Breaking Change 2", severity: "medium" },
      ] as any);

      const { result } = renderHook(() => useBreakingChanges(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(2);
    });
  });

  describe("useVersioningConfiguration", () => {
    it("should fetch configuration", async () => {
      mockService.getConfiguration.mockResolvedValueOnce({
        default_version: "v2",
        supported_versions: ["v1", "v2"],
        deprecated_versions: [],
        versioning_strategy: "url_path",
        strict_mode: true,
        auto_upgrade: false,
      } as any);

      const { result } = renderHook(() => useVersioningConfiguration(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.default_version).toBe("v2");
      expect(result.current.data?.supported_versions).toHaveLength(2);
    });
  });
});
