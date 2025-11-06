/**
 * React Query hooks for API Versioning Management
 *
 * Provides hooks for:
 * - Fetching versions and breaking changes
 * - Managing versions (CRUD operations)
 * - Tracking version adoption and usage
 * - Managing breaking changes
 * - Configuration management
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import {
  versioningService,
  type APIVersionInfo,
  type BreakingChange,
  type BreakingChangeCreate,
  type BreakingChangeFilters,
  type BreakingChangeUpdate,
  type VersionAdoptionMetrics,
  type VersionConfiguration,
  type VersionCreate,
  type VersionDeprecation,
  type VersionHealthCheck,
  type VersionListFilters,
  type VersionUpdate,
  type VersionUsageStats,
} from "@/lib/services/versioning-service";

// Re-export types for convenience
export type {
  APIVersionInfo,
  BreakingChange,
  ChangeType,
  VersionAdoptionMetrics,
  VersionConfiguration,
  VersionCreate,
  VersionDeprecation,
  VersionHealthCheck,
  VersioningStrategy,
  VersionStatus,
  VersionUpdate,
  VersionUsageStats,
} from "@/lib/services/versioning-service";

// ============================================
// Query Keys
// ============================================

export const versioningKeys = {
  all: ["versioning"] as const,
  versions: () => [...versioningKeys.all, "versions"] as const,
  version: (filters: VersionListFilters) => [...versioningKeys.versions(), filters] as const,
  versionDetail: (version: string) => [...versioningKeys.versions(), version] as const,
  versionUsage: (version: string, days: number) =>
    [...versioningKeys.versionDetail(version), "usage", days] as const,
  versionHealth: (version: string) => [...versioningKeys.versionDetail(version), "health"] as const,
  breakingChanges: () => [...versioningKeys.all, "breaking-changes"] as const,
  breakingChange: (filters: BreakingChangeFilters) =>
    [...versioningKeys.breakingChanges(), filters] as const,
  breakingChangeDetail: (id: string) => [...versioningKeys.breakingChanges(), id] as const,
  adoption: (days: number) => [...versioningKeys.all, "adoption", days] as const,
  config: () => [...versioningKeys.all, "config"] as const,
};

// ============================================
// Version Query Hooks
// ============================================

/**
 * Hook to fetch API versions
 *
 * @param filters - Version filters
 * @returns API versions with loading and error states
 */
export function useVersions(filters: VersionListFilters = {}) {
  return useQuery<APIVersionInfo[], Error, APIVersionInfo[], any>({
    queryKey: versioningKeys.version(filters),
    queryFn: () => versioningService.listVersions(filters),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch single API version
 *
 * @param version - Version string
 * @returns Version details with loading and error states
 */
export function useVersion(version: string | null) {
  return useQuery<APIVersionInfo, Error, APIVersionInfo, any>({
    queryKey: versioningKeys.versionDetail(version!),
    queryFn: () => versioningService.getVersion(version!),
    enabled: !!version,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch version usage statistics
 *
 * @param version - Version string
 * @param days - Number of days to analyze
 * @returns Usage statistics with loading and error states
 */
export function useVersionUsageStats(version: string | null, days: number = 30) {
  return useQuery<VersionUsageStats, Error, VersionUsageStats, any>({
    queryKey: versioningKeys.versionUsage(version!, days),
    queryFn: () => versioningService.getVersionUsageStats(version!, days),
    enabled: !!version,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch version health check
 *
 * @param version - Version string
 * @returns Health check results with loading and error states
 */
export function useVersionHealth(version: string | null) {
  return useQuery<VersionHealthCheck, Error, VersionHealthCheck, any>({
    queryKey: versioningKeys.versionHealth(version!),
    queryFn: () => versioningService.getVersionHealth(version!),
    enabled: !!version,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================
// Version Mutation Hooks
// ============================================

/**
 * Hook to create API version
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useCreateVersion(options?: {
  onSuccess?: (version: APIVersionInfo) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<APIVersionInfo, Error, VersionCreate>({
    mutationFn: (data) => versioningService.createVersion(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: versioningKeys.versions() });
      queryClient.invalidateQueries({ queryKey: versioningKeys.config() });

      // toast.success('Version created successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to create version', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to update API version
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useUpdateVersion(options?: {
  onSuccess?: (version: APIVersionInfo) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<APIVersionInfo, Error, { version: string; data: VersionUpdate }>({
    mutationFn: ({ version, data }) => versioningService.updateVersion(version, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: versioningKeys.versions() });
      queryClient.invalidateQueries({
        queryKey: versioningKeys.versionDetail(data.version),
      });

      // toast.success('Version updated successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to update version', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to deprecate API version
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useDeprecateVersion(options?: {
  onSuccess?: (version: APIVersionInfo) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<APIVersionInfo, Error, { version: string; data: VersionDeprecation }>({
    mutationFn: ({ version, data }) => versioningService.deprecateVersion(version, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: versioningKeys.versions() });
      queryClient.invalidateQueries({
        queryKey: versioningKeys.versionDetail(data.version),
      });
      queryClient.invalidateQueries({ queryKey: versioningKeys.config() });

      // toast.success('Version deprecated successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to deprecate version', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to un-deprecate API version
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useUndeprecateVersion(options?: {
  onSuccess?: (version: APIVersionInfo) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<APIVersionInfo, Error, string>({
    mutationFn: (version) => versioningService.undeprecateVersion(version),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: versioningKeys.versions() });
      queryClient.invalidateQueries({
        queryKey: versioningKeys.versionDetail(data.version),
      });
      queryClient.invalidateQueries({ queryKey: versioningKeys.config() });

      // toast.success('Version un-deprecated successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to un-deprecate version', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to set default API version
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useSetDefaultVersion(options?: {
  onSuccess?: (version: APIVersionInfo) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<APIVersionInfo, Error, string>({
    mutationFn: (version) => versioningService.setDefaultVersion(version),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: versioningKeys.versions() });
      queryClient.invalidateQueries({ queryKey: versioningKeys.config() });

      // toast.success('Default version updated successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to set default version', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to remove API version
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useRemoveVersion(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (version) => versioningService.removeVersion(version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versioningKeys.versions() });
      queryClient.invalidateQueries({ queryKey: versioningKeys.config() });

      // toast.success('Version removed successfully');

      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to remove version', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

// ============================================
// Breaking Changes Query Hooks
// ============================================

/**
 * Hook to fetch breaking changes
 *
 * @param filters - Breaking change filters
 * @returns Breaking changes with loading and error states
 */
export function useBreakingChanges(filters: BreakingChangeFilters = {}) {
  return useQuery<BreakingChange[], Error, BreakingChange[], any>({
    queryKey: versioningKeys.breakingChange(filters),
    queryFn: () => versioningService.listBreakingChanges(filters),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch single breaking change
 *
 * @param changeId - Change UUID
 * @returns Breaking change details with loading and error states
 */
export function useBreakingChange(changeId: string | null) {
  return useQuery<BreakingChange, Error, BreakingChange, any>({
    queryKey: versioningKeys.breakingChangeDetail(changeId!),
    queryFn: () => versioningService.getBreakingChange(changeId!),
    enabled: !!changeId,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  });
}

// ============================================
// Breaking Changes Mutation Hooks
// ============================================

/**
 * Hook to create breaking change
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useCreateBreakingChange(options?: {
  onSuccess?: (change: BreakingChange) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<BreakingChange, Error, BreakingChangeCreate>({
    mutationFn: (data) => versioningService.createBreakingChange(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: versioningKeys.breakingChanges(),
      });

      // toast.success('Breaking change created successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to create breaking change', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to update breaking change
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useUpdateBreakingChange(options?: {
  onSuccess?: (change: BreakingChange) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<BreakingChange, Error, { changeId: string; data: BreakingChangeUpdate }>({
    mutationFn: ({ changeId, data }) => versioningService.updateBreakingChange(changeId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: versioningKeys.breakingChanges(),
      });
      queryClient.invalidateQueries({
        queryKey: versioningKeys.breakingChangeDetail(data.id),
      });

      // toast.success('Breaking change updated successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to update breaking change', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to delete breaking change
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useDeleteBreakingChange(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (changeId) => versioningService.deleteBreakingChange(changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: versioningKeys.breakingChanges(),
      });

      // toast.success('Breaking change deleted successfully');

      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to delete breaking change', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

// ============================================
// Analytics & Configuration Hooks
// ============================================

/**
 * Hook to fetch version adoption metrics
 *
 * @param days - Number of days to analyze
 * @returns Adoption metrics with loading and error states
 */
export function useVersionAdoption(days: number = 30) {
  return useQuery<VersionAdoptionMetrics, Error, VersionAdoptionMetrics, any>({
    queryKey: versioningKeys.adoption(days),
    queryFn: () => versioningService.getAdoptionMetrics(days),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch versioning configuration
 *
 * @returns Configuration with loading and error states
 */
export function useVersioningConfiguration() {
  return useQuery<VersionConfiguration, Error, VersionConfiguration, any>({
    queryKey: versioningKeys.config(),
    queryFn: () => versioningService.getConfiguration(),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to update versioning configuration
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useUpdateVersioningConfiguration(options?: {
  onSuccess?: (config: VersionConfiguration) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<VersionConfiguration, Error, Partial<VersionConfiguration>>({
    mutationFn: (data) => versioningService.updateConfiguration(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: versioningKeys.config() });

      // toast.success('Configuration updated successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to update configuration', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

// ============================================
// Combined Operations Hook
// ============================================

/**
 * Hook that combines all version operations
 *
 * @returns All operation hooks
 */
export function useVersioningOperations() {
  const deprecate = useDeprecateVersion();
  const undeprecate = useUndeprecateVersion();
  const setDefault = useSetDefaultVersion();
  const remove = useRemoveVersion();

  return {
    deprecate: async (version: string, data: VersionDeprecation) => {
      try {
        await deprecate.mutateAsync({ version, data });
        return true;
      } catch (error) {
        console.error("Failed to deprecate version:", error);
        return false;
      }
    },
    undeprecate: async (version: string) => {
      try {
        await undeprecate.mutateAsync(version);
        return true;
      } catch (error) {
        console.error("Failed to un-deprecate version:", error);
        return false;
      }
    },
    setDefault: async (version: string) => {
      try {
        await setDefault.mutateAsync(version);
        return true;
      } catch (error) {
        console.error("Failed to set default version:", error);
        return false;
      }
    },
    remove: async (version: string) => {
      try {
        await remove.mutateAsync(version);
        return true;
      } catch (error) {
        console.error("Failed to remove version:", error);
        return false;
      }
    },
    isLoading:
      deprecate.isPending || undeprecate.isPending || setDefault.isPending || remove.isPending,
  };
}
