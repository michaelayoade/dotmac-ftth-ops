/**
 * MSW-powered tests for useFeatureFlags
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 *
 * Tests the actual hook contract: { flags, status, loading, error, toggleFlag, ... }
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useFeatureFlags, featureFlagsKeys } from "../useFeatureFlags";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetFeatureFlagsStorage,
  createMockFeatureFlag,
  createMockFlagStatus,
  seedFeatureFlagsData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useFeatureFlags (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetFeatureFlagsStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("featureFlagsKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(featureFlagsKeys.all).toEqual(["feature-flags"]);
      expect(featureFlagsKeys.flags()).toEqual(["feature-flags", "flags", { enabledOnly: undefined }]);
      expect(featureFlagsKeys.flags(true)).toEqual(["feature-flags", "flags", { enabledOnly: true }]);
      expect(featureFlagsKeys.status()).toEqual(["feature-flags", "status"]);
    });
  });

  describe("useFeatureFlags - fetch flags", () => {
    it("should fetch feature flags successfully", async () => {
      const mockFlags = [
        createMockFeatureFlag({
          name: "new-dashboard",
          enabled: true,
          description: "New dashboard UI",
          context: { rollout: 100 },
        }),
        createMockFeatureFlag({
          name: "dark-mode",
          enabled: false,
          description: "Dark mode support",
        }),
        createMockFeatureFlag({
          name: "advanced-search",
          enabled: true,
          description: "Advanced search features",
        }),
      ];

      seedFeatureFlagsData(mockFlags);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.loading).toBe(true);

      // Wait for data to load
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Verify data matches actual hook API
      expect(result.current.flags).toBeDefined();
      expect(result.current.flags).toHaveLength(3);
      expect(result.current.flags[0].name).toBe("new-dashboard");
      expect(result.current.flags[0].enabled).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty flags list", async () => {
      seedFeatureFlagsData([]);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter enabled flags only", async () => {
      const flags = [
        createMockFeatureFlag({ name: "flag-1", enabled: true }),
        createMockFeatureFlag({ name: "flag-2", enabled: false }),
        createMockFeatureFlag({ name: "flag-3", enabled: true }),
        createMockFeatureFlag({ name: "flag-4", enabled: false }),
      ];

      seedFeatureFlagsData(flags);

      const { result } = renderHook(() => useFeatureFlags(true), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toHaveLength(2);
      expect(result.current.flags.every((f) => f.enabled)).toBe(true);
    });

    it("should fetch flag status", async () => {
      const flags = [
        createMockFeatureFlag({ name: "flag-1", enabled: true }),
        createMockFeatureFlag({ name: "flag-2", enabled: true }),
        createMockFeatureFlag({ name: "flag-3", enabled: false }),
      ];

      const status = createMockFlagStatus({
        total_flags: 3,
        enabled_flags: 2,
        disabled_flags: 1,
        cache_hits: 150,
        cache_misses: 5,
      });

      seedFeatureFlagsData(flags, status);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.status).toBeDefined();
      expect(result.current.status?.total_flags).toBe(3);
      expect(result.current.status?.enabled_flags).toBe(2);
      expect(result.current.status?.disabled_flags).toBe(1);
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/api/v1/feature-flags/flags", "Server error", 500);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.flags).toHaveLength(0);
    });
  });

  describe("useFeatureFlags - toggle flag", () => {
    it("should toggle flag successfully", async () => {
      const flags = [
        createMockFeatureFlag({
          name: "test-feature",
          enabled: false,
        }),
      ];

      seedFeatureFlagsData(flags);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags[0].enabled).toBe(false);

      // Toggle flag on
      await act(async () => {
        await result.current.toggleFlag("test-feature", true);
      });

      await waitFor(() => {
        expect(result.current.flags[0].enabled).toBe(true);
      });

      // Toggle flag off
      await act(async () => {
        await result.current.toggleFlag("test-feature", false);
      });

      await waitFor(() => {
        expect(result.current.flags[0].enabled).toBe(false);
      });
    });

    it("should handle toggle error for non-existent flag", async () => {
      seedFeatureFlagsData([]);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.toggleFlag("non-existent", true)
      ).rejects.toThrow();
    });
  });

  describe("useFeatureFlags - create flag", () => {
    it("should create flag successfully", async () => {
      seedFeatureFlagsData([]);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let newFlag: any;
      await act(async () => {
        newFlag = await result.current.createFlag("new-feature", {
          enabled: true,
          description: "New test feature",
          context: { rollout: 50 },
        });
        await result.current.refreshFlags();
      });

      expect(newFlag).toBeDefined();
      expect(newFlag.name).toBe("new-feature");
      expect(newFlag.enabled).toBe(true);

      // Verify hook state updated
      await waitFor(() => {
        expect(result.current.flags).toHaveLength(1);
        expect(result.current.flags[0].name).toBe("new-feature");
      });
    });

    it("should handle create error for duplicate flag", async () => {
      const existingFlag = createMockFeatureFlag({ name: "existing-feature" });
      seedFeatureFlagsData([existingFlag]);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.createFlag("existing-feature", { enabled: true })
      ).rejects.toThrow();
    });
  });

  describe("useFeatureFlags - delete flag", () => {
    it("should delete flag successfully", async () => {
      const flags = [
        createMockFeatureFlag({ name: "flag-1" }),
        createMockFeatureFlag({ name: "flag-2" }),
      ];

      seedFeatureFlagsData(flags);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.flags).toHaveLength(2);

      await act(async () => {
        await result.current.deleteFlag("flag-1");
      });

      // Verify hook state updated
      await waitFor(() => {
        expect(result.current.flags).toHaveLength(1);
        expect(result.current.flags[0].name).toBe("flag-2");
      });
    });

    it("should handle delete error for non-existent flag", async () => {
      seedFeatureFlagsData([]);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(result.current.deleteFlag("non-existent")).rejects.toThrow();
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle flags with context data", async () => {
      const flags = [
        createMockFeatureFlag({
          name: "gradual-rollout",
          enabled: true,
          context: {
            rollout_percentage: 25,
            target_users: ["user-1", "user-2"],
            start_date: "2024-01-01",
          },
        }),
        createMockFeatureFlag({
          name: "beta-features",
          enabled: true,
          context: {
            beta_users: ["beta-1", "beta-2", "beta-3"],
            expiry_date: "2024-12-31",
          },
        }),
      ];

      seedFeatureFlagsData(flags);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const rolloutFlag = result.current.flags.find((f) => f.name === "gradual-rollout");
      const betaFlag = result.current.flags.find((f) => f.name === "beta-features");

      expect(rolloutFlag?.context.rollout_percentage).toBe(25);
      expect(rolloutFlag?.context.target_users).toHaveLength(2);
      expect(betaFlag?.context.beta_users).toHaveLength(3);
    });

    it("should handle creating and immediately toggling a flag", async () => {
      seedFeatureFlagsData([]);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Create flag (disabled by default)
      await act(async () => {
        await result.current.createFlag("test-feature", {
          enabled: false,
          description: "Test feature",
        });
        // Manual refetch needed since test config has refetchOnMount: false
        await result.current.refreshFlags();
      });

      await waitFor(() => {
        expect(result.current.flags).toHaveLength(1);
        expect(result.current.flags[0].enabled).toBe(false);
      });

      // Toggle it on
      await act(async () => {
        await result.current.toggleFlag("test-feature", true);
      });

      await waitFor(() => {
        expect(result.current.flags[0].enabled).toBe(true);
      });
    });

    it("should handle multiple flag operations", async () => {
      seedFeatureFlagsData([]);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Create multiple flags
      await act(async () => {
        await result.current.createFlag("feature-1", { enabled: true });
        await result.current.refreshFlags();
      });

      await act(async () => {
        await result.current.createFlag("feature-2", { enabled: false });
        await result.current.refreshFlags();
      });

      await act(async () => {
        await result.current.createFlag("feature-3", { enabled: true });
        await result.current.refreshFlags();
      });

      await waitFor(() => {
        expect(result.current.flags).toHaveLength(3);
      });

      // Toggle one
      await act(async () => {
        await result.current.toggleFlag("feature-2", true);
      });

      // Delete one
      await act(async () => {
        await result.current.deleteFlag("feature-1");
      });

      await waitFor(() => {
        expect(result.current.flags).toHaveLength(2);
        const feature2 = result.current.flags.find((f) => f.name === "feature-2");
        expect(feature2?.enabled).toBe(true);
      });
    });

    it("should track flag status changes", async () => {
      const flags = [
        createMockFeatureFlag({ name: "flag-1", enabled: true }),
        createMockFeatureFlag({ name: "flag-2", enabled: false }),
      ];

      seedFeatureFlagsData(flags);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialStatus = result.current.status;
      expect(initialStatus?.total_flags).toBe(2);
      expect(initialStatus?.enabled_flags).toBe(1);
      expect(initialStatus?.disabled_flags).toBe(1);

      // Add a new enabled flag
      await act(async () => {
        await result.current.createFlag("flag-3", { enabled: true });
        await result.current.refreshFlags();
      });

      await waitFor(() => {
        expect(result.current.flags).toHaveLength(3);
      });

      // Status should be recalculated
      await act(async () => {
        await result.current.refreshFlags();
      });

      await waitFor(() => {
        const updatedStatus = result.current.status;
        expect(updatedStatus?.total_flags).toBe(3);
        expect(updatedStatus?.enabled_flags).toBe(2);
      });
    });

    it("should handle flags with timestamps", async () => {
      const now = Date.now();
      const flags = [
        createMockFeatureFlag({
          name: "old-feature",
          enabled: true,
          created_at: now - 86400000, // 1 day ago
          updated_at: now - 86400000,
        }),
        createMockFeatureFlag({
          name: "new-feature",
          enabled: false,
          created_at: now,
          updated_at: now,
        }),
      ];

      seedFeatureFlagsData(flags);

      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const oldFeature = result.current.flags.find((f) => f.name === "old-feature");
      const newFeature = result.current.flags.find((f) => f.name === "new-feature");

      expect(oldFeature?.created_at).toBeLessThan(newFeature!.created_at!);
    });
  });
});
