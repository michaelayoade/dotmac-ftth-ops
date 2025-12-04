/**
 * Platform Admin App - useFeatureFlags tests
 *
 * Validates TanStack query/mutation flows for feature flag management.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useFeatureFlags, featureFlagsKeys } from "../useFeatureFlags";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe("Platform Admin useFeatureFlags hook", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches flags and status", async () => {
    mockedApi.get
      .mockResolvedValueOnce({
        success: true,
        data: [{ name: "new-dashboard", enabled: true, context: {}, updated_at: Date.now() }],
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          total_flags: 1,
          enabled_flags: 1,
          disabled_flags: 0,
          cache_hits: 5,
          cache_misses: 0,
        },
      });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => expect(result.current.flags.length).toBe(1));
    expect(result.current.flags[0].name).toBe("new-dashboard");
    expect(result.current.status?.total_flags).toBe(1);
  });

  it("toggles flags and invalidates caches", async () => {
    mockedApi.get.mockResolvedValue({
      success: true,
      data: [{ name: "beta-flag", enabled: false, context: {}, updated_at: Date.now() }],
    });
    mockedApi.put.mockResolvedValue({ status: 200 });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.flags.length).toBe(1));

    await act(async () => {
      await result.current.toggleFlag("beta-flag", true);
    });

    expect(mockedApi.put).toHaveBeenCalledWith("/feature-flags/flags/beta-flag", {
      enabled: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: featureFlagsKeys.flags() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: featureFlagsKeys.status() });
  });

  it("creates and deletes flags with invalidations", async () => {
    mockedApi.get.mockResolvedValue({
      success: true,
      data: [],
    });
    mockedApi.post.mockResolvedValue({ success: true, data: { name: "new-flag" } });
    mockedApi.delete.mockResolvedValue({ status: 204 });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await act(async () => {
      await result.current.createFlag("new-flag", { enabled: true });
    });
    expect(mockedApi.post).toHaveBeenCalledWith("/feature-flags/flags/new-flag", {
      enabled: true,
    });

    await act(async () => {
      await result.current.deleteFlag("new-flag");
    });

    expect(mockedApi.delete).toHaveBeenCalledWith("/feature-flags/flags/new-flag");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: featureFlagsKeys.flags() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: featureFlagsKeys.status() });
  });

  it("logs errors when API calls fail", async () => {
    const error = new Error("oops");
    mockedApi.put.mockRejectedValue(error);

    mockedApi.get.mockResolvedValue({
      success: true,
      data: [{ name: "unstable-flag", enabled: false, context: {}, updated_at: Date.now() }],
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.flags.length).toBe(1));

    await expect(result.current.toggleFlag("unstable-flag", true)).rejects.toThrow();
    expect(mockedLogger.error).toHaveBeenCalledWith("Failed to toggle flag", error);
  });
});
