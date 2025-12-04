/**
 * React Query hooks for OSS Configuration Management
 *
 * Provides hooks for:
 * - Fetching OSS service configurations
 * - Updating tenant-specific overrides
 * - Resetting to defaults
 * - Testing connections
 * - Managing configuration state
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import {
  ossConfigService,
  type OSSService,
  type OSSServiceConfigResponse,
  type OSSServiceConfigUpdate,
} from "@/lib/services/oss-config-service";

// ============================================
// Query Keys
// ============================================

export const ossConfigKeys = {
  all: ["oss-config"] as const,
  lists: () => [...ossConfigKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...ossConfigKeys.lists(), filters] as const,
  details: () => [...ossConfigKeys.all, "detail"] as const,
  detail: (service: OSSService) => [...ossConfigKeys.details(), service] as const,
  allConfigurations: () => [...ossConfigKeys.all, "all-configurations"] as const,
};

// ============================================
// Configuration Query Hooks
// ============================================

/**
 * Fetch configuration for a specific OSS service
 *
 * @param service - OSS service name
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with service configuration
 *
 * @example
 * ```tsx
 * const { data: config, isLoading } = useOSSConfiguration('voltha');
 * ```
 */
export function useOSSConfiguration(service: OSSService | null, enabled = true) {
  return useQuery<OSSServiceConfigResponse, Error, OSSServiceConfigResponse, any>({
    queryKey: ossConfigKeys.detail(service!),
    queryFn: () => ossConfigService.getConfiguration(service!),
    enabled: enabled && !!service,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch configurations for all OSS services
 *
 * @returns Query result with all service configurations
 *
 * @example
 * ```tsx
 * const { data: configs, isLoading } = useAllOSSConfigurations();
 * ```
 */
export function useAllOSSConfigurations() {
  return useQuery<OSSServiceConfigResponse[], Error, OSSServiceConfigResponse[], any>({
    queryKey: ossConfigKeys.allConfigurations(),
    queryFn: () => ossConfigService.getAllConfigurations(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// Configuration Mutation Hooks
// ============================================

/**
 * Update OSS service configuration with tenant-specific overrides
 *
 * @param options - Mutation options
 * @returns Mutation result with update function
 *
 * @example
 * ```tsx
 * const updateConfig = useUpdateOSSConfiguration({
 *   onSuccess: (data) => {
 *     toast.success('Configuration updated successfully');
 *   },
 * });
 *
 * updateConfig.mutate({
 *   service: 'voltha',
 *   updates: { url: 'https://voltha.example.com', verify_ssl: true },
 * });
 * ```
 */
export function useUpdateOSSConfiguration(options?: {
  onSuccess?: (data: OSSServiceConfigResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<
    OSSServiceConfigResponse,
    Error,
    { service: OSSService; updates: OSSServiceConfigUpdate }
  >({
    mutationFn: ({ service, updates }) => ossConfigService.updateConfiguration(service, updates),
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: ossConfigKeys.detail(variables.service),
      });
      queryClient.invalidateQueries({
        queryKey: ossConfigKeys.allConfigurations(),
      });

      // toast.success(`${variables.service.toUpperCase()} configuration updated successfully`);

      options?.onSuccess?.(data);
    },
    onError: (error, variables) => {
      // toast.error(`Failed to update ${variables.service.toUpperCase()} configuration`, {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Reset OSS service configuration to defaults (remove tenant overrides)
 *
 * @param options - Mutation options
 * @returns Mutation result with reset function
 *
 * @example
 * ```tsx
 * const resetConfig = useResetOSSConfiguration({
 *   onSuccess: () => {
 *     toast.success('Configuration reset to defaults');
 *   },
 * });
 *
 * resetConfig.mutate('voltha');
 * ```
 */
export function useResetOSSConfiguration(options?: {
  onSuccess?: (service: OSSService) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, OSSService>({
    mutationFn: (service) => ossConfigService.resetConfiguration(service),
    onSuccess: (_, service) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: ossConfigKeys.detail(service),
      });
      queryClient.invalidateQueries({
        queryKey: ossConfigKeys.allConfigurations(),
      });

      // toast.success(`${service.toUpperCase()} configuration reset to defaults`);

      options?.onSuccess?.(service);
    },
    onError: (error, service) => {
      // toast.error(`Failed to reset ${service.toUpperCase()} configuration`, {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Test connection to OSS service
 *
 * @param options - Mutation options
 * @returns Mutation result with test function
 *
 * @example
 * ```tsx
 * const testConnection = useTestOSSConnection({
 *   onSuccess: (result) => {
 *     if (result.success) {
 *       toast.success('Connection successful');
 *     } else {
 *       toast.error('Connection failed');
 *     }
 *   },
 * });
 *
 * testConnection.mutate('voltha');
 * ```
 */
export function useTestOSSConnection(options?: {
  onSuccess?: (result: { success: boolean; message: string; latency?: number }) => void;
  onError?: (error: Error) => void;
}) {
  return useMutation<{ success: boolean; message: string; latency?: number }, Error, OSSService>({
    mutationFn: (service) => ossConfigService.testConnection(service),
    onSuccess: (result, service) => {
      // if (result.success) {
      //   toast.success(`${service.toUpperCase()} connection test passed`, {
      //     description: result.latency
      //       ? `Response time: ${result.latency}ms`
      //       : result.message,
      //   });
      // } else {
      //   toast.warning(`${service.toUpperCase()} connection test failed`, {
      //     description: result.message,
      //   });
      // }

      options?.onSuccess?.(result);
    },
    onError: (error, service) => {
      // toast.error(`${service.toUpperCase()} connection test error`, {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Get OSS configuration status and utilities
 *
 * @param service - OSS service name
 * @returns Configuration status and helper functions
 *
 * @example
 * ```tsx
 * const { hasOverrides, overriddenFields, isValid } = useOSSConfigStatus('voltha');
 * ```
 */
export function useOSSConfigStatus(service: OSSService | null) {
  const { data: config } = useOSSConfiguration(service);

  const hasOverrides = config ? ossConfigService.hasOverrides(config) : false;
  const overriddenFields = config ? ossConfigService.getOverriddenFields(config) : [];

  const validateUpdate = (updates: OSSServiceConfigUpdate) => {
    return ossConfigService.validateUpdate(updates);
  };

  return {
    config,
    hasOverrides,
    overriddenFields,
    validateUpdate,
    isConfigured: !!config?.config.url,
  };
}

/**
 * Get aggregated OSS configuration statistics
 *
 * @returns Statistics about all OSS configurations
 *
 * @example
 * ```tsx
 * const { configuredCount, overriddenCount, services } = useOSSConfigStatistics();
 * ```
 */
export function useOSSConfigStatistics() {
  const { data: configs, isLoading } = useAllOSSConfigurations();

  const statistics = {
    totalServices: configs?.length || 0,
    configuredCount: configs?.filter((c) => c.config.url && c.config.url !== "").length || 0,
    overriddenCount: configs?.filter((c) => ossConfigService.hasOverrides(c)).length || 0,
    services:
      configs?.map((c) => ({
        service: c.service,
        configured: !!c.config.url,
        hasOverrides: ossConfigService.hasOverrides(c),
        overrideCount: Object.keys(c.overrides).length,
      })) || [],
  };

  return {
    statistics,
    isLoading,
    hasAnyConfigured: statistics.configuredCount > 0,
    hasAnyOverridden: statistics.overriddenCount > 0,
  };
}

/**
 * Batch update multiple OSS configurations
 *
 * @param options - Mutation options
 * @returns Mutation result with batch update function
 *
 * @example
 * ```tsx
 * const batchUpdate = useBatchUpdateOSSConfiguration({
 *   onSuccess: () => {
 *     toast.success('All configurations updated');
 *   },
 * });
 *
 * batchUpdate.mutate([
 *   { service: 'voltha', updates: { verify_ssl: true } },
 *   { service: 'genieacs', updates: { timeout_seconds: 60 } },
 * ]);
 * ```
 */
export function useBatchUpdateOSSConfiguration(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<
    OSSServiceConfigResponse[],
    Error,
    Array<{ service: OSSService; updates: OSSServiceConfigUpdate }>
  >({
    mutationFn: async (updates) => {
      const results = await Promise.all(
        updates.map(({ service, updates }) =>
          ossConfigService.updateConfiguration(service, updates),
        ),
      );
      return results;
    },
    onSuccess: () => {
      // Invalidate all OSS configuration queries
      queryClient.invalidateQueries({ queryKey: ossConfigKeys.all });

      // toast.success('All configurations updated successfully');

      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to update configurations', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}
