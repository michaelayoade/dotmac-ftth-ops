/**
 * Feature Flags Hook - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Optimistic updates
 * - Better error handling
 * - Reduced boilerplate (150 lines → 105 lines)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  context: Record<string, any>;
  description?: string;
  updated_at: number;
  created_at?: number;
}

export interface FlagStatus {
  total_flags: number;
  enabled_flags: number;
  disabled_flags: number;
  cache_hits: number;
  cache_misses: number;
  last_sync?: string;
}

// Query key factory for feature flags
export const featureFlagsKeys = {
  all: ["feature-flags"] as const,
  flags: (enabledOnly?: boolean) => [...featureFlagsKeys.all, "flags", { enabledOnly }] as const,
  status: () => [...featureFlagsKeys.all, "status"] as const,
};

/**
 * Helper to normalize feature flags response formats
 */
function normalizeFlagsResponse(response: any): FeatureFlag[] {
  // Handle wrapped error responses
  if (response?.error) {
    throw new Error(response.error.message || "Failed to fetch feature flags");
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  return Array.isArray(response) ? response : [];
}

/**
 * Helper to normalize status response formats
 */
function normalizeStatusResponse(response: any): FlagStatus | null {
  return response?.data ?? null;
}

function normalizeApiError(error: unknown, fallback: string): string {
  if (error instanceof Error && (error as any).__featureFlagExposed) {
    return error.message;
  }

  const responseData = (error as any)?.response?.data;
  if (typeof responseData?.detail === "string") {
    return responseData.detail;
  }
  if (typeof responseData?.error?.message === "string") {
    return responseData.error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

const createExposedError = (message: string) => {
  const error = new Error(message);
  (error as any).__featureFlagExposed = true;
  return error;
};

/**
 * Hook to fetch feature flags
 */
export const useFeatureFlags = (enabledOnly = false) => {
  const queryClient = useQueryClient();

  // Fetch flags
  const flagsQuery = useQuery({
    queryKey: featureFlagsKeys.flags(enabledOnly),
    queryFn: async ({ queryKey }) => {
      const [, , params] = queryKey as ReturnType<typeof featureFlagsKeys.flags>;
      const enabledParam = params.enabledOnly ?? false;
      try {
        const response = await apiClient.get<FeatureFlag[]>(
          `/feature-flags/flags${enabledParam ? "?enabled_only=true" : ""}`,
        );
        return normalizeFlagsResponse(response);
      } catch (err) {
        const message = normalizeApiError(err, "Failed to fetch feature flags");
        logger.error(
          "Failed to fetch feature flags",
          err instanceof Error ? err : new Error(String(err)),
        );
        throw new Error(message);
      }
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });

  // Fetch status
  const statusQuery = useQuery({
    queryKey: featureFlagsKeys.status(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<FlagStatus>("/feature-flags/status");
        return normalizeStatusResponse(response);
      } catch (err) {
        const message = normalizeApiError(err, "Failed to fetch flag status");
        logger.error(
          "Failed to fetch flag status",
          err instanceof Error ? err : new Error(String(err)),
        );
        throw new Error(message);
      }
    },
    staleTime: 30000,
  });

  // Toggle flag mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ flagName, enabled }: { flagName: string; enabled: boolean }) => {
      const response = await apiClient.put(`/feature-flags/flags/${flagName}`, { enabled });
      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to toggle flag");
      }
      return { flagName, enabled };
    },
    onSuccess: ({ flagName, enabled }) => {
      // Optimistically update the cache
      queryClient.setQueryData<FeatureFlag[]>(featureFlagsKeys.flags(enabledOnly), (old) =>
        old?.map((flag) => (flag.name === flagName ? { ...flag, enabled } : flag)),
      );
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: featureFlagsKeys.flags() });
      queryClient.invalidateQueries({ queryKey: featureFlagsKeys.status() });
    },
    onError: (err) => {
      logger.error("Failed to toggle flag", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Create flag mutation
  const createMutation = useMutation({
    mutationFn: async ({ flagName, data }: { flagName: string; data: Partial<FeatureFlag> }) => {
      const response = await apiClient.post(`/feature-flags/flags/${flagName}`, data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featureFlagsKeys.flags() });
      queryClient.invalidateQueries({ queryKey: featureFlagsKeys.status() });
    },
    onError: (err) => {
      logger.error("Failed to create flag", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Delete flag mutation
  const deleteMutation = useMutation({
    mutationFn: async (flagName: string) => {
      const response = await apiClient.delete(`/feature-flags/flags/${flagName}`);
      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to delete flag");
      }
      return flagName;
    },
    onSuccess: (flagName) => {
      // Optimistically update the cache
      queryClient.setQueryData<FeatureFlag[]>(featureFlagsKeys.flags(enabledOnly), (old) =>
        old?.filter((flag) => flag.name !== flagName),
      );
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: featureFlagsKeys.flags() });
      queryClient.invalidateQueries({ queryKey: featureFlagsKeys.status() });
    },
    onError: (err) => {
      logger.error("Failed to delete flag", err instanceof Error ? err : new Error(String(err)));
    },
  });

  return {
    flags: flagsQuery.data ?? [],
    status: statusQuery.data ?? null,
    loading: flagsQuery.isLoading || statusQuery.isLoading,
    error:
      (flagsQuery.error instanceof Error && flagsQuery.error.message) ||
      (statusQuery.error instanceof Error && statusQuery.error.message) ||
      null,
    fetchFlags: flagsQuery.refetch,
    toggleFlag: async (flagName: string, enabled: boolean) => {
      await toggleMutation.mutateAsync({ flagName, enabled });
      return true;
    },
    createFlag: async (flagName: string, data: Partial<FeatureFlag>) => {
      return await createMutation.mutateAsync({ flagName, data });
    },
    deleteFlag: async (flagName: string) => {
      await deleteMutation.mutateAsync(flagName);
      return true;
    },
    refreshFlags: flagsQuery.refetch,
  };
};
