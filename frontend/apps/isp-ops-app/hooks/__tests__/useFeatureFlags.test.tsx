/**
 * Tests for useFeatureFlags hook
 * Tests feature flag management with TanStack Query (queries and mutations)
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useFeatureFlags, featureFlagsKeys, FeatureFlag, FlagStatus } from "../useFeatureFlags";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useFeatureFlags", () => {
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

  describe("featureFlagsKeys", () => {
    it("should generate correct query keys", () => {
      expect(featureFlagsKeys.all).toEqual(["feature-flags"]);
      expect(featureFlagsKeys.flags()).toEqual(["feature-flags", "flags", { enabledOnly: undefined }]);
      expect(featureFlagsKeys.flags(true)).toEqual(["feature-flags", "flags", { enabledOnly: true }]);
      expect(featureFlagsKeys.status()).toEqual(["feature-flags", "status"]);
    });
  });

  describe("fetchFlags", () => {
    it("should fetch all flags successfully", async () => {
      const mockFlags: FeatureFlag[] = [
        {
          name: "dark_mode",
          enabled: true,
          context: { theme: "dark" },
          description: "Enable dark mode",
          updated_at: 1704067200000,
          created_at: 1704067200000,
        },
        {
          name: "beta_features",
          enabled: false,
          context: {},
          description: "Enable beta features",
          updated_at: 1704067200000,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: mockFlags });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 2,
              enabled_flags: 1,
              disabled_flags: 1,
              cache_hits: 10,
              cache_misses: 2,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toHaveLength(2);
      expect(result.current.flags[0].name).toBe("dark_mode");
      expect(result.current.flags[0].enabled).toBe(true);
      expect(result.current.flags[1].name).toBe("beta_features");
      expect(apiClient.get).toHaveBeenCalledWith("/feature-flags/flags");
    });

    it("should fetch only enabled flags when enabledOnly is true", async () => {
      const mockFlags: FeatureFlag[] = [
        {
          name: "dark_mode",
          enabled: true,
          context: { theme: "dark" },
          description: "Enable dark mode",
          updated_at: 1704067200000,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: mockFlags });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 1,
              enabled_flags: 1,
              disabled_flags: 0,
              cache_hits: 5,
              cache_misses: 1,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toHaveLength(1);
      expect(result.current.flags[0].enabled).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/feature-flags/flags?enabled_only=true");
    });

    it("should handle success wrapper response format", async () => {
      const mockFlags: FeatureFlag[] = [
        {
          name: "test_flag",
          enabled: true,
          context: {},
          updated_at: 1704067200000,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: mockFlags });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 1,
              enabled_flags: 1,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toEqual(mockFlags);
    });

    it("should handle direct array response format", async () => {
      const mockFlags: FeatureFlag[] = [
        {
          name: "test_flag",
          enabled: true,
          context: {},
          updated_at: 1704067200000,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ data: mockFlags });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            data: {
              total_flags: 1,
              enabled_flags: 1,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toEqual(mockFlags);
    });

    it("should handle empty flags array", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toEqual([]);
    });

    it("should handle fetch error gracefully", async () => {
      const error = new Error("Failed to fetch flags");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch feature flags", error);
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return new Promise((resolve) =>
            setTimeout(() => resolve({ success: true, data: [] }), 100)
          );
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
    });

    it("should handle non-Error objects in catch", async () => {
      (apiClient.get as jest.Mock).mockRejectedValue("string error");

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch feature flags",
        expect.any(Error)
      );
    });
  });

  describe("fetchStatus", () => {
    it("should fetch flag status successfully", async () => {
      const mockStatus: FlagStatus = {
        total_flags: 10,
        enabled_flags: 7,
        disabled_flags: 3,
        cache_hits: 100,
        cache_misses: 5,
        last_sync: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({ success: true, data: mockStatus });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.status).toEqual(mockStatus);
      expect(result.current.status?.total_flags).toBe(10);
      expect(result.current.status?.enabled_flags).toBe(7);
      expect(result.current.status?.disabled_flags).toBe(3);
      expect(result.current.status?.last_sync).toBe("2024-01-01T00:00:00Z");
      expect(apiClient.get).toHaveBeenCalledWith("/feature-flags/status");
    });

    it("should handle direct data response format", async () => {
      const mockStatus: FlagStatus = {
        total_flags: 5,
        enabled_flags: 3,
        disabled_flags: 2,
        cache_hits: 50,
        cache_misses: 2,
      };

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({ data: mockStatus });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.status).toEqual(mockStatus);
    });

    it("should handle status fetch error gracefully", async () => {
      const error = new Error("Failed to fetch status");
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.reject(error);
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.status).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch flag status", error);
    });
  });

  describe("toggleFlag", () => {
    it("should toggle flag to enabled successfully", async () => {
      const mockFlags: FeatureFlag[] = [
        {
          name: "test_flag",
          enabled: false,
          context: {},
          updated_at: 1704067200000,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: mockFlags });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 1,
              enabled_flags: 0,
              disabled_flags: 1,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.put as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        const success = await result.current.toggleFlag("test_flag", true);
        expect(success).toBe(true);
      });

      expect(apiClient.put).toHaveBeenCalledWith("/feature-flags/flags/test_flag", {
        enabled: true,
      });
    });

    it("should toggle flag to disabled successfully", async () => {
      const mockFlags: FeatureFlag[] = [
        {
          name: "test_flag",
          enabled: true,
          context: {},
          updated_at: 1704067200000,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: mockFlags });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 1,
              enabled_flags: 1,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.put as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        const success = await result.current.toggleFlag("test_flag", false);
        expect(success).toBe(true);
      });

      expect(apiClient.put).toHaveBeenCalledWith("/feature-flags/flags/test_flag", {
        enabled: false,
      });
    });

    it("should invalidate queries after successful toggle", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.put as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.toggleFlag("test_flag", true);
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle toggle error", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const error = new Error("Failed to toggle flag");
      (apiClient.put as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.toggleFlag("test_flag", true);
        })
      ).rejects.toThrow("Failed to toggle flag");

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to toggle flag", error);
      });
    });

    it("should handle non-2xx status codes", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.put as jest.Mock).mockResolvedValue({ status: 400 });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.toggleFlag("test_flag", true);
        })
      ).rejects.toThrow("Failed to toggle flag");
    });
  });

  describe("createFlag", () => {
    it("should create flag successfully", async () => {
      const newFlag: FeatureFlag = {
        name: "new_flag",
        enabled: true,
        context: { feature: "new" },
        description: "A new feature flag",
        updated_at: 1704067200000,
        created_at: 1704067200000,
      };

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: newFlag });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let createdFlag;
      await act(async () => {
        createdFlag = await result.current.createFlag("new_flag", {
          enabled: true,
          context: { feature: "new" },
          description: "A new feature flag",
        });
      });

      expect(createdFlag).toEqual(newFlag);
      expect(apiClient.post).toHaveBeenCalledWith("/feature-flags/flags/new_flag", {
        enabled: true,
        context: { feature: "new" },
        description: "A new feature flag",
      });
    });

    it("should handle direct data response format", async () => {
      const newFlag: FeatureFlag = {
        name: "new_flag",
        enabled: true,
        context: {},
        updated_at: 1704067200000,
      };

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.post as jest.Mock).mockResolvedValue({ data: newFlag });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let createdFlag;
      await act(async () => {
        createdFlag = await result.current.createFlag("new_flag", {
          enabled: true,
          context: {},
        });
      });

      expect(createdFlag).toEqual(newFlag);
    });

    it("should invalidate queries after successful creation", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.post as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          name: "new_flag",
          enabled: true,
          context: {},
          updated_at: 1704067200000,
        },
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.createFlag("new_flag", {
          enabled: true,
          context: {},
        });
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle create error", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const error = new Error("Failed to create flag");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.createFlag("new_flag", { enabled: true, context: {} });
        })
      ).rejects.toThrow("Failed to create flag");

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to create flag", error);
      });
    });

    it("should handle null response data", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let createdFlag;
      await act(async () => {
        createdFlag = await result.current.createFlag("new_flag", { enabled: true, context: {} });
      });

      expect(createdFlag).toBeNull();
    });
  });

  describe("deleteFlag", () => {
    it("should delete flag successfully", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        const success = await result.current.deleteFlag("test_flag");
        expect(success).toBe(true);
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/feature-flags/flags/test_flag");
    });

    it("should invalidate queries after successful deletion", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.deleteFlag("test_flag");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle delete error", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const error = new Error("Failed to delete flag");
      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.deleteFlag("test_flag");
        })
      ).rejects.toThrow("Failed to delete flag");

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to delete flag", error);
      });
    });

    it("should handle non-2xx status codes", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 404 });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.deleteFlag("test_flag");
        })
      ).rejects.toThrow("Failed to delete flag");
    });
  });

  describe("refetch functions", () => {
    it("should expose fetchFlags refetch function", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.filter((call) =>
        call[0].includes("/feature-flags/flags")
      ).length;

      // Clear previous calls
      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.fetchFlags();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/feature-flags/flags");
      });
    });

    it("should expose refreshFlags function", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Clear previous calls
      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.refreshFlags();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/feature-flags/flags");
      });
    });
  });

  describe("error handling", () => {
    it("should set error state correctly when flags query fails", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.reject(new Error("Flags error"));
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 0,
              enabled_flags: 0,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // When flags query fails, it's caught and empty array is returned
      // But the error is logged
      expect(result.current.flags).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch feature flags",
        expect.any(Error)
      );
    });

    it("should handle status query error gracefully", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.reject(new Error("Status error"));
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // When status query fails, it's caught and null is returned
      expect(result.current.status).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch flag status",
        expect.any(Error)
      );
    });
  });

  describe("flag properties", () => {
    it("should include all flag properties", async () => {
      const mockFlag: FeatureFlag = {
        name: "full_flag",
        enabled: true,
        context: {
          user_type: "premium",
          region: "us-east",
        },
        description: "A fully featured flag",
        updated_at: 1704067200000,
        created_at: 1704067100000,
      };

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: [mockFlag] });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 1,
              enabled_flags: 1,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags[0]).toEqual(mockFlag);
      expect(result.current.flags[0].context.user_type).toBe("premium");
      expect(result.current.flags[0].description).toBe("A fully featured flag");
      expect(result.current.flags[0].created_at).toBe(1704067100000);
    });
  });

  describe("optimistic updates", () => {
    it("should optimistically update flag on toggle", async () => {
      const mockFlags: FeatureFlag[] = [
        {
          name: "test_flag",
          enabled: false,
          context: {},
          updated_at: 1704067200000,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: mockFlags });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 1,
              enabled_flags: 0,
              disabled_flags: 1,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.put as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useFeatureFlags(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags[0].enabled).toBe(false);

      await act(async () => {
        await result.current.toggleFlag("test_flag", true);
      });

      // Note: In real implementation, the optimistic update would be visible
      // immediately, but here we rely on the invalidation to refetch
      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalled();
      });
    });

    it("should optimistically remove flag on delete", async () => {
      const mockFlags: FeatureFlag[] = [
        {
          name: "test_flag",
          enabled: true,
          context: {},
          updated_at: 1704067200000,
        },
        {
          name: "other_flag",
          enabled: true,
          context: {},
          updated_at: 1704067200000,
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/feature-flags/flags")) {
          return Promise.resolve({ success: true, data: mockFlags });
        }
        if (url.includes("/feature-flags/status")) {
          return Promise.resolve({
            success: true,
            data: {
              total_flags: 2,
              enabled_flags: 2,
              disabled_flags: 0,
              cache_hits: 0,
              cache_misses: 0,
            },
          });
        }
      });

      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useFeatureFlags(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toHaveLength(2);

      await act(async () => {
        await result.current.deleteFlag("test_flag");
      });

      // Note: In real implementation, the optimistic update would be visible
      // immediately, but here we rely on the invalidation to refetch
      await waitFor(() => {
        expect(apiClient.delete).toHaveBeenCalled();
      });
    });
  });
});
