/**
 * Shared Service Lifecycle Hook - Enhanced Version
 *
 * Improvements over original:
 * - Runtime Zod validation for all responses
 * - Consistent query key construction
 * - Error logging with logger
 * - Unified implementation across both apps
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { logger } from "@/lib/logger";
import {
  ServiceStatisticsSchema,
  ServiceInstanceSummarySchema,
  ServiceInstanceDetailSchema,
  ProvisionServiceResponseSchema,
  type ServiceStatistics,
  type ServiceInstanceSummary,
  type ServiceInstanceDetail,
  type ServiceStatusValue,
} from "../utils/service-lifecycle-schemas";

// ============================================================================
// Query Key Types
// ============================================================================

type StatisticsQueryKey = ["services", "statistics"];
type ServiceListKey = [
  "services",
  "instances",
  {
    status?: ServiceStatusValue | "provisioning" | "active";
    serviceType?: string | null;
    limit: number;
    offset: number;
  },
];
type ServiceDetailKey = ["services", "instance", string];

// ============================================================================
// Options Interfaces
// ============================================================================

interface UseServiceStatisticsOptions {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<ServiceStatistics, Error, ServiceStatistics, StatisticsQueryKey>,
    "queryKey" | "queryFn"
  >;
}

interface UseServiceInstancesOptions {
  status?: ServiceStatusValue | "provisioning" | "active";
  serviceType?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<ServiceInstanceSummary[], Error, ServiceInstanceSummary[], ServiceListKey>,
    "queryKey" | "queryFn"
  >;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Retrieve tenant-wide service lifecycle statistics.
 */
export function useServiceStatistics({
  enabled = true,
  queryOptions,
}: UseServiceStatisticsOptions = {}): UseQueryResult<ServiceStatistics, Error> {
  return useQuery<ServiceStatistics, Error, ServiceStatistics, StatisticsQueryKey>({
    queryKey: ["services", "statistics"],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ServiceStatistics>("/services/lifecycle/statistics");
        const data = extractDataOrThrow(response);
        // Validate with Zod
        return ServiceStatisticsSchema.parse(data);
      } catch (err) {
        logger.error("Failed to fetch service statistics", err as Error);
        throw err;
      }
    },
    enabled,
    staleTime: 60_000,
    ...queryOptions,
  });
}

/**
 * List service instances with optional status/type filters.
 */
export function useServiceInstances({
  status,
  serviceType,
  limit = 20,
  offset = 0,
  enabled = true,
  queryOptions,
}: UseServiceInstancesOptions = {}): UseQueryResult<ServiceInstanceSummary[], Error> {
  const params: Record<string, unknown> = {
    limit,
    offset,
  };

  if (status) {
    params["status"] = status;
  }
  if (serviceType) {
    params["service_type"] = serviceType;
  }

  return useQuery<ServiceInstanceSummary[], Error, ServiceInstanceSummary[], ServiceListKey>({
    queryKey: [
      "services",
      "instances",
      {
        ...(status !== undefined ? { status } : {}),
        serviceType: serviceType ?? null,
        limit,
        offset,
      },
    ],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ServiceInstanceSummary[]>(
          "/services/lifecycle/services",
          {
            params,
          },
        );
        const data = extractDataOrThrow(response);
        // Validate with Zod - parse array
        if (Array.isArray(data)) {
          return data.map((item) => ServiceInstanceSummarySchema.parse(item));
        }
        return [];
      } catch (err) {
        logger.error("Failed to fetch service instances", err as Error);
        throw err;
      }
    },
    enabled,
    staleTime: 30_000,
    ...queryOptions,
  });
}

/**
 * Fetch a single service instance by ID.
 */
export function useServiceInstance(
  serviceId: string | null,
  options?: Omit<
    UseQueryOptions<ServiceInstanceDetail, Error, ServiceInstanceDetail, ServiceDetailKey>,
    "queryKey" | "queryFn"
  >,
): UseQueryResult<ServiceInstanceDetail, Error> {
  return useQuery<ServiceInstanceDetail, Error, ServiceInstanceDetail, ServiceDetailKey>({
    queryKey: ["services", "instance", serviceId ?? ""],
    queryFn: async () => {
      if (!serviceId) {
        throw new Error("Service ID is required");
      }
      try {
        const response = await apiClient.get<ServiceInstanceDetail>(
          `/services/lifecycle/services/${serviceId}`,
        );
        const data = extractDataOrThrow(response);
        // Validate with Zod
        return ServiceInstanceDetailSchema.parse(data);
      } catch (err) {
        logger.error(`Failed to fetch service instance ${serviceId}`, err as Error);
        throw err;
      }
    },
    enabled: Boolean(serviceId),
    staleTime: 30_000,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface LifecycleOperationVariables {
  serviceId: string;
  payload?: Record<string, unknown>;
}

export function useSuspendService(): UseMutationResult<void, Error, LifecycleOperationVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LifecycleOperationVariables>({
    mutationFn: async ({ serviceId, payload }) => {
      try {
        await apiClient.post(`/services/lifecycle/services/${serviceId}/suspend`, payload ?? {});
      } catch (err) {
        logger.error(`Failed to suspend service ${serviceId}`, err as Error);
        throw err;
      }
    },
    onSuccess: async (_, { serviceId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services", "instances"] }),
        queryClient.invalidateQueries({
          queryKey: ["services", "instance", serviceId],
        }),
        queryClient.invalidateQueries({ queryKey: ["services", "statistics"] }),
      ]);
    },
  });
}

export function useResumeService(): UseMutationResult<void, Error, LifecycleOperationVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LifecycleOperationVariables>({
    mutationFn: async ({ serviceId, payload }) => {
      try {
        await apiClient.post(`/services/lifecycle/services/${serviceId}/resume`, payload ?? {});
      } catch (err) {
        logger.error(`Failed to resume service ${serviceId}`, err as Error);
        throw err;
      }
    },
    onSuccess: async (_, { serviceId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services", "instances"] }),
        queryClient.invalidateQueries({
          queryKey: ["services", "instance", serviceId],
        }),
        queryClient.invalidateQueries({ queryKey: ["services", "statistics"] }),
      ]);
    },
  });
}

interface ProvisionServiceVariables {
  payload: Record<string, unknown>;
}

export function useProvisionService(): UseMutationResult<
  { service_instance_id: string },
  Error,
  ProvisionServiceVariables
> {
  const queryClient = useQueryClient();
  return useMutation<{ service_instance_id: string }, Error, ProvisionServiceVariables>({
    mutationFn: async ({ payload }) => {
      try {
        const response = await apiClient.post<{ service_instance_id: string }>(
          "/services/lifecycle/services/provision",
          payload,
        );
        const data = extractDataOrThrow(response);
        // Validate with Zod
        return ProvisionServiceResponseSchema.parse(data);
      } catch (err) {
        logger.error("Failed to provision service", err as Error);
        throw err;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services", "instances"] }),
        queryClient.invalidateQueries({ queryKey: ["services", "statistics"] }),
      ]);
    },
  });
}

export function useActivateService(): UseMutationResult<void, Error, LifecycleOperationVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LifecycleOperationVariables>({
    mutationFn: async ({ serviceId, payload }) => {
      try {
        await apiClient.post(`/services/lifecycle/services/${serviceId}/activate`, payload ?? {});
      } catch (err) {
        logger.error(`Failed to activate service ${serviceId}`, err as Error);
        throw err;
      }
    },
    onSuccess: async (_, { serviceId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services", "instances"] }),
        queryClient.invalidateQueries({
          queryKey: ["services", "instance", serviceId],
        }),
        queryClient.invalidateQueries({ queryKey: ["services", "statistics"] }),
      ]);
    },
  });
}

export function useTerminateService(): UseMutationResult<void, Error, LifecycleOperationVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LifecycleOperationVariables>({
    mutationFn: async ({ serviceId, payload }) => {
      try {
        await apiClient.post(`/services/lifecycle/services/${serviceId}/terminate`, payload ?? {});
      } catch (err) {
        logger.error(`Failed to terminate service ${serviceId}`, err as Error);
        throw err;
      }
    },
    onSuccess: async (_, { serviceId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services", "instances"] }),
        queryClient.invalidateQueries({
          queryKey: ["services", "instance", serviceId],
        }),
        queryClient.invalidateQueries({ queryKey: ["services", "statistics"] }),
      ]);
    },
  });
}

export function useModifyService(): UseMutationResult<void, Error, LifecycleOperationVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LifecycleOperationVariables>({
    mutationFn: async ({ serviceId, payload }) => {
      try {
        await apiClient.patch(`/services/lifecycle/services/${serviceId}`, payload ?? {});
      } catch (err) {
        logger.error(`Failed to modify service ${serviceId}`, err as Error);
        throw err;
      }
    },
    onSuccess: async (_, { serviceId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services", "instances"] }),
        queryClient.invalidateQueries({
          queryKey: ["services", "instance", serviceId],
        }),
      ]);
    },
  });
}

export function useHealthCheckService(): UseMutationResult<
  void,
  Error,
  LifecycleOperationVariables
> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LifecycleOperationVariables>({
    mutationFn: async ({ serviceId, payload }) => {
      try {
        await apiClient.post(
          `/services/lifecycle/services/${serviceId}/health-check`,
          payload ?? {},
        );
      } catch (err) {
        logger.error(`Failed to health check service ${serviceId}`, err as Error);
        throw err;
      }
    },
    onSuccess: async (_, { serviceId }) => {
      await queryClient.invalidateQueries({
        queryKey: ["services", "instance", serviceId],
      });
    },
  });
}
