/**
 * Shared test suite for useFeatureFlags hook
 * Tests the feature flag management functionality across both ISP and Platform Admin apps
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type PropsWithChildren } from "react";
import type { FeatureFlag, FlagStatus } from "../../apps/platform-admin-app/hooks/useFeatureFlags";

type UseFeatureFlagsHook = () => {
  flags: FeatureFlag[];
  status: FlagStatus | null;
  loading: boolean;
  error: string | null;
  fetchFlags: (enabledOnly?: boolean) => Promise<void>;
  toggleFlag: (flagName: string, enabled: boolean) => Promise<boolean>;
  createFlag: (flagName: string, data: Partial<FeatureFlag>) => Promise<any>;
  deleteFlag: (flagName: string) => Promise<boolean>;
  refreshFlags: (enabledOnly?: boolean) => Promise<void>;
};

type RenderOptions = {
  enabledOnly?: boolean;
};

export function runUseFeatureFlagsSuite(useFeatureFlags: UseFeatureFlagsHook, apiClient: any) {
  const cleanupFns: Array<() => void> = [];

  const waitForFlagsData = async (
    hookResult: { current: ReturnType<UseFeatureFlagsHook> },
    expectedFlags: FeatureFlag[],
  ) =>
    waitFor(() => {
      expect(hookResult.current.flags).toBe(expectedFlags);
    });

  const renderUseFeatureFlags = (options?: RenderOptions) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });

    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const hooked = renderHook(() => useFeatureFlags(options?.enabledOnly ?? false), { wrapper });

    cleanupFns.push(() => {
      hooked.unmount();
      queryClient.clear();
    });

    return hooked;
  };

  describe("useFeatureFlags", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      cleanupFns.forEach((cleanup) => cleanup());
      cleanupFns.length = 0;
      jest.restoreAllMocks();
    });

    describe("Happy Path", () => {
      it("should fetch flags on mount", async () => {
        const mockFlags: FeatureFlag[] = [
          {
            name: "dark_mode",
            enabled: true,
            context: {},
            description: "Enable dark mode",
            updated_at: Date.now(),
          },
        ];

        const mockStatus: FlagStatus = {
          total_flags: 1,
          enabled_flags: 1,
          disabled_flags: 0,
          cache_hits: 0,
          cache_misses: 0,
        };

        apiClient.get.mockImplementation((url: string) => {
          if (url.includes("/flags")) {
            return Promise.resolve({ data: mockFlags });
          }
          if (url.includes("/status")) {
            return Promise.resolve({ data: mockStatus });
          }
          return Promise.reject(new Error("Unknown URL"));
        });

        const { result } = renderUseFeatureFlags({ enabledOnly: true });

        await waitForFlagsData(result, mockFlags);
        await waitFor(() => {
          expect(result.current.status).toEqual(mockStatus);
        });

        expect(result.current.flags).toEqual(mockFlags);
        expect(result.current.status).toEqual(mockStatus);
        expect(result.current.error).toBeNull();
      });

      it("should handle wrapped success response for flags", async () => {
        const mockFlags: FeatureFlag[] = [
          {
            name: "new_feature",
            enabled: false,
            context: {},
            updated_at: Date.now(),
          },
        ];

        apiClient.get.mockImplementation((url: string) => {
          if (url.includes("/flags")) {
            return Promise.resolve({
              success: true,
              data: mockFlags,
            });
          }
          if (url.includes("/status")) {
            return Promise.resolve({ data: null });
          }
          return Promise.reject(new Error("Unknown URL"));
        });

        const { result } = renderUseFeatureFlags({ enabledOnly: true });

        await waitForFlagsData(result, mockFlags);
      });

      it("should toggle flag successfully", async () => {
        const mockFlags: FeatureFlag[] = [
          {
            name: "beta_features",
            enabled: false,
            context: {},
            updated_at: Date.now(),
          },
        ];

        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));
        apiClient.put.mockResolvedValueOnce({ status: 200 });

        const { result } = renderUseFeatureFlags({ enabledOnly: true });

        await waitForFlagsData(result, mockFlags);

        let toggleResult: boolean = false;
        await act(async () => {
          toggleResult = await result.current.toggleFlag("beta_features", true);
        });

        expect(toggleResult).toBe(true);
        expect(apiClient.put).toHaveBeenCalledWith("/feature-flags/flags/beta_features", {
          enabled: true,
        });
        await waitFor(() => {
          expect(result.current.flags[0].enabled).toBe(true);
        });
      });

      it("should create flag successfully", async () => {
        const mockFlags: FeatureFlag[] = [];
        const newFlag: FeatureFlag = {
          name: "experimental",
          enabled: false,
          context: { rollout: 10 },
          description: "Experimental feature",
          updated_at: Date.now(),
        };

        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));
        apiClient.post.mockResolvedValueOnce({
          success: true,
          data: newFlag,
        });

        const { result } = renderUseFeatureFlags({ enabledOnly: true });

        await waitForFlagsData(result, mockFlags);

        let createdFlag: any;
        await act(async () => {
          createdFlag = await result.current.createFlag("experimental", {
            enabled: false,
            context: { rollout: 10 },
            description: "Experimental feature",
          });
        });

        expect(createdFlag).toEqual(newFlag);
        expect(apiClient.post).toHaveBeenCalledWith(
          "/feature-flags/flags/experimental",
          expect.objectContaining({
            enabled: false,
            context: { rollout: 10 },
          }),
        );
      });

      it("should delete flag successfully", async () => {
        const mockFlags: FeatureFlag[] = [
          {
            name: "old_feature",
            enabled: false,
            context: {},
            updated_at: Date.now(),
          },
        ];

        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));
        apiClient.delete.mockResolvedValueOnce({ status: 204 });

        const { result } = renderUseFeatureFlags({ enabledOnly: true });

        await waitForFlagsData(result, mockFlags);

        let deleteResult: boolean = false;
        await act(async () => {
          deleteResult = await result.current.deleteFlag("old_feature");
        });

        expect(deleteResult).toBe(true);
        expect(apiClient.delete).toHaveBeenCalledWith("/feature-flags/flags/old_feature");
        await waitFor(() => expect(result.current.flags).toHaveLength(0));
      });

      it("should fetch enabled-only flags", async () => {
        const mockFlags: FeatureFlag[] = [
          {
            name: "enabled_feature",
            enabled: true,
            context: {},
            updated_at: Date.now(),
          },
        ];

        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));

        const { result } = renderUseFeatureFlags({ enabledOnly: true });

        await waitForFlagsData(result, mockFlags);

        apiClient.get.mockClear();

        await act(async () => {
          await result.current.fetchFlags();
        });

        // Debug log to inspect calls
        expect(apiClient.get).toHaveBeenCalledWith("/feature-flags/flags?enabled_only=true");
      });
    });

    describe("Error Handling", () => {
      it("should handle fetch errors gracefully", async () => {
        const mockError = new Error("Network error");
        apiClient.get.mockRejectedValue(mockError);

        const { result } = renderUseFeatureFlags();

        await waitFor(() => {
          expect(result.current.error).toBe(mockError.message);
        });
        expect(result.current.flags).toEqual([]);
      });

      it("should handle wrapped error response", async () => {
        apiClient.get.mockImplementation((url: string) => {
          if (url.includes("/flags")) {
            return Promise.resolve({
              error: {
                message: "Permission denied",
              },
            });
          }
          return Promise.resolve({ data: null });
        });

        const { result } = renderUseFeatureFlags();

        await waitFor(() => {
          expect(result.current.error).toBe("Permission denied");
        });
      });

      it("should handle toggle failure", async () => {
        const mockFlags: FeatureFlag[] = [
          {
            name: "test_flag",
            enabled: false,
            context: {},
            updated_at: Date.now(),
          },
        ];

        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));
        apiClient.put.mockRejectedValueOnce(new Error("Toggle failed"));

        const { result } = renderUseFeatureFlags();

        await waitForFlagsData(result, mockFlags);

        await expect(async () => {
          await act(async () => {
            await result.current.toggleFlag("test_flag", true);
          });
        }).rejects.toThrow("Toggle failed");
      });

      it("should handle create failure", async () => {
        const mockFlags: FeatureFlag[] = [];
        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));
        apiClient.post.mockRejectedValueOnce(new Error("Creation failed"));

        const { result } = renderUseFeatureFlags();

        await waitForFlagsData(result, mockFlags);

        await expect(async () => {
          await act(async () => {
            await result.current.createFlag("new_flag", { enabled: true });
          });
        }).rejects.toThrow("Creation failed");
      });

      it("should handle delete failure", async () => {
        const mockFlags: FeatureFlag[] = [
          {
            name: "protected_flag",
            enabled: true,
            context: {},
            updated_at: Date.now(),
          },
        ];

        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));
        apiClient.delete.mockRejectedValueOnce(new Error("Cannot delete"));

        const { result } = renderUseFeatureFlags();

        await waitForFlagsData(result, mockFlags);

        await expect(async () => {
          await act(async () => {
            await result.current.deleteFlag("protected_flag");
          });
        }).rejects.toThrow("Cannot delete");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty flags array", async () => {
        const mockFlags: FeatureFlag[] = [];
        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));

        const { result } = renderUseFeatureFlags();

        await waitForFlagsData(result, mockFlags);
      });

      it("should handle flags with complex context", async () => {
        const mockFlags: FeatureFlag[] = [
          {
            name: "complex_flag",
            enabled: true,
            context: {
              rollout_percentage: 50,
              target_users: ["user1", "user2"],
              regions: { us: true, eu: false },
            },
            updated_at: Date.now(),
          },
        ];

        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));

        const { result } = renderUseFeatureFlags();

        await waitForFlagsData(result, mockFlags);

        expect(result.current.flags[0].context).toEqual(mockFlags[0].context);
      });

      it("should handle status with all metadata", async () => {
        const mockStatus: FlagStatus = {
          total_flags: 10,
          enabled_flags: 7,
          disabled_flags: 3,
          cache_hits: 100,
          cache_misses: 5,
          last_sync: "2025-01-15T10:00:00Z",
        };

        apiClient.get.mockImplementation((url: string) => {
          if (url.includes("/status")) {
            return Promise.resolve({ data: mockStatus });
          }
          return Promise.resolve({ data: [] });
        });

        const { result } = renderUseFeatureFlags();

        await waitFor(() => {
          expect(result.current.status).toEqual(mockStatus);
        });
      });

      it("should handle multiple flags", async () => {
        const mockFlags: FeatureFlag[] = Array.from({ length: 20 }, (_, i) => ({
          name: `flag_${i}`,
          enabled: i % 2 === 0,
          context: {},
          updated_at: Date.now(),
        }));

        apiClient.get.mockImplementation(() => Promise.resolve({ data: mockFlags }));

        const { result } = renderUseFeatureFlags();

        await waitForFlagsData(result, mockFlags);

        expect(result.current.flags).toHaveLength(20);
        expect(result.current.flags.filter((f) => f.enabled)).toHaveLength(10);
      });
    });
  });
}
