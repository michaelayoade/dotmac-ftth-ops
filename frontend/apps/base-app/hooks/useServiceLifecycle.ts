import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { extractDataOrThrow } from '@/lib/api/response-helpers';
import type {
  ServiceInstanceDetail,
  ServiceInstanceSummary,
  ServiceStatistics,
  ServiceStatusValue,
} from '@/types';

type StatisticsQueryKey = ['services', 'statistics'];
type ServiceListKey = [
  'services',
  'instances',
  { status?: ServiceStatusValue | 'provisioning' | 'active'; serviceType?: string | null; limit: number; offset: number }
];
type ServiceDetailKey = ['services', 'instance', string];

interface UseServiceStatisticsOptions {
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<ServiceStatistics, Error, ServiceStatistics, StatisticsQueryKey>, 'queryKey' | 'queryFn'>;
}

interface UseServiceInstancesOptions {
  status?: ServiceStatusValue | 'provisioning' | 'active';
  serviceType?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<ServiceInstanceSummary[], Error, ServiceInstanceSummary[], ServiceListKey>, 'queryKey' | 'queryFn'>;
}

/**
 * Retrieve tenant-wide service lifecycle statistics.
 */
export function useServiceStatistics({
  enabled = true,
  queryOptions,
}: UseServiceStatisticsOptions = {}): UseQueryResult<ServiceStatistics, Error> {
  return useQuery<ServiceStatistics, Error, ServiceStatistics, StatisticsQueryKey>({
    queryKey: ['services', 'statistics'],
    queryFn: async () => {
      const response = await apiClient.get<ServiceStatistics>('/api/v1/services/lifecycle/statistics');
      return extractDataOrThrow(response);
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
    params.status = status;
  }
  if (serviceType) {
    params.service_type = serviceType;
  }

  return useQuery<ServiceInstanceSummary[], Error, ServiceInstanceSummary[], ServiceListKey>({
    queryKey: ['services', 'instances', { status, serviceType: serviceType ?? null, limit, offset }],
    queryFn: async () => {
      const response = await apiClient.get<ServiceInstanceSummary[]>('/api/v1/services/lifecycle/services', {
        params,
      });
      return extractDataOrThrow(response);
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
  options?: Omit<UseQueryOptions<ServiceInstanceDetail, Error, ServiceInstanceDetail, ServiceDetailKey>, 'queryKey' | 'queryFn'>
): UseQueryResult<ServiceInstanceDetail, Error> {
  return useQuery<ServiceInstanceDetail, Error, ServiceInstanceDetail, ServiceDetailKey>({
    queryKey: ['services', 'instance', serviceId ?? ''],
    queryFn: async () => {
      if (!serviceId) {
        throw new Error('Service ID is required');
      }
      const response = await apiClient.get<ServiceInstanceDetail>(`/api/v1/services/lifecycle/services/${serviceId}`);
      return extractDataOrThrow(response);
    },
    enabled: Boolean(serviceId),
    staleTime: 30_000,
    ...options,
  });
}

interface LifecycleOperationVariables {
  serviceId: string;
  payload?: Record<string, unknown>;
}

export function useSuspendService(): UseMutationResult<void, Error, LifecycleOperationVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LifecycleOperationVariables>({
    mutationFn: async ({ serviceId, payload }) => {
      await apiClient.post(`/api/v1/services/lifecycle/services/${serviceId}/suspend`, payload ?? {});
    },
    onSuccess: async (_, { serviceId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services', 'instances'] }),
        queryClient.invalidateQueries({ queryKey: ['services', 'instance', serviceId] }),
        queryClient.invalidateQueries({ queryKey: ['services', 'statistics'] }),
      ]);
    },
  });
}

export function useResumeService(): UseMutationResult<void, Error, LifecycleOperationVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LifecycleOperationVariables>({
    mutationFn: async ({ serviceId, payload }) => {
      await apiClient.post(`/api/v1/services/lifecycle/services/${serviceId}/resume`, payload ?? {});
    },
    onSuccess: async (_, { serviceId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services', 'instances'] }),
        queryClient.invalidateQueries({ queryKey: ['services', 'instance', serviceId] }),
        queryClient.invalidateQueries({ queryKey: ['services', 'statistics'] }),
      ]);
    },
  });
}
