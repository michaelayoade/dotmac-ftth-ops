import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { extractDataOrThrow } from '@/lib/api/response-helpers';
import type { JobChain, ScheduledJob } from '@/types';

type ScheduledJobsKey = ['scheduler', 'scheduled-jobs'];
type JobChainsKey = ['scheduler', 'job-chains'];

/**
 * Fetch scheduled jobs configured through the job scheduler router.
 */
export function useScheduledJobs(
  options?: Omit<UseQueryOptions<ScheduledJob[], Error, ScheduledJob[], ScheduledJobsKey>, 'queryKey' | 'queryFn'>
): UseQueryResult<ScheduledJob[], Error> {
  return useQuery<ScheduledJob[], Error, ScheduledJob[], ScheduledJobsKey>({
    queryKey: ['scheduler', 'scheduled-jobs'],
    queryFn: async () => {
      const response = await apiClient.get<ScheduledJob[]>('/api/v1/jobs/scheduler/scheduled-jobs');
      return extractDataOrThrow(response);
    },
    staleTime: 60_000,
    ...options,
  });
}

/**
 * Fetch job chains for orchestrated workflows.
 */
export function useJobChains(
  options?: Omit<UseQueryOptions<JobChain[], Error, JobChain[], JobChainsKey>, 'queryKey' | 'queryFn'>
): UseQueryResult<JobChain[], Error> {
  return useQuery<JobChain[], Error, JobChain[], JobChainsKey>({
    queryKey: ['scheduler', 'job-chains'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<JobChain[]>('/api/v1/jobs/scheduler/chains');
        return extractDataOrThrow(response);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
    staleTime: 60_000,
    ...options,
  });
}

interface ExecuteJobChainVariables {
  chainId: string;
}

export function useExecuteJobChain(): UseMutationResult<JobChain, Error, ExecuteJobChainVariables> {
  const queryClient = useQueryClient();
  return useMutation<JobChain, Error, ExecuteJobChainVariables>({
    mutationFn: async ({ chainId }) => {
      const response = await apiClient.post<JobChain>(`/api/v1/jobs/scheduler/chains/${chainId}/execute`);
      return extractDataOrThrow(response);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['scheduler', 'job-chains'] }),
        queryClient.invalidateQueries({ queryKey: ['services', 'instances'] }),
      ]);
    },
  });
}
