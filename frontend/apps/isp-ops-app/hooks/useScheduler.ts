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
import type {
  JobChain,
  ScheduledJob,
  ScheduledJobCreate,
  ScheduledJobUpdate,
  ScheduledJobResponse,
  ScheduledJobListResponse,
  JobChainCreate,
  JobChainResponse,
  JobChainListResponse,
  JobChainExecuteResponse,
} from "@/types";

type ScheduledJobsKey = ["scheduler", "scheduled-jobs"];
type JobChainsKey = ["scheduler", "job-chains"];

/**
 * Fetch scheduled jobs configured through the job scheduler router.
 */
export function useScheduledJobs(
  options?: Omit<
    UseQueryOptions<ScheduledJob[], Error, ScheduledJob[], ScheduledJobsKey>,
    "queryKey" | "queryFn"
  >,
): UseQueryResult<ScheduledJob[], Error> {
  return useQuery<ScheduledJob[], Error, ScheduledJob[], ScheduledJobsKey>({
    queryKey: ["scheduler", "scheduled-jobs"],
    queryFn: async () => {
      const response = await apiClient.get<ScheduledJob[]>("/jobs/scheduler/scheduled-jobs");
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
  options?: Omit<
    UseQueryOptions<JobChain[], Error, JobChain[], JobChainsKey>,
    "queryKey" | "queryFn"
  >,
): UseQueryResult<JobChain[], Error> {
  return useQuery<JobChain[], Error, JobChain[], JobChainsKey>({
    queryKey: ["scheduler", "job-chains"],
    queryFn: async () => {
      try {
        const response = await apiClient.get<JobChain[]>("/jobs/scheduler/chains");
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
      const response = await apiClient.post<JobChain>(`/jobs/scheduler/chains/${chainId}/execute`);
      return extractDataOrThrow(response);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["scheduler", "job-chains"],
        }),
        queryClient.invalidateQueries({ queryKey: ["services", "instances"] }),
      ]);
    },
  });
}

// =============================================================================
// Additional CRUD Operations
// =============================================================================

/**
 * Get a single scheduled job by ID
 */
export function useScheduledJob(jobId: string | null): UseQueryResult<ScheduledJobResponse, Error> {
  return useQuery<ScheduledJobResponse, Error, ScheduledJobResponse, any>({
    queryKey: ["scheduler", "scheduled-job", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("Job ID is required");
      const response = await apiClient.get<ScheduledJobResponse>(
        `/jobs/scheduler/scheduled-jobs/${jobId}`,
      );
      return extractDataOrThrow(response);
    },
    enabled: !!jobId,
  });
}

/**
 * Create a new scheduled job
 */
export function useCreateScheduledJob(): UseMutationResult<
  ScheduledJobResponse,
  Error,
  ScheduledJobCreate
> {
  const queryClient = useQueryClient();

  return useMutation<ScheduledJobResponse, Error, ScheduledJobCreate>({
    mutationFn: async (payload) => {
      const response = await apiClient.post<ScheduledJobResponse>(
        "/jobs/scheduler/scheduled-jobs",
        payload,
      );
      return extractDataOrThrow(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["scheduler", "scheduled-jobs"],
      });
    },
  });
}

/**
 * Update a scheduled job
 */
export function useUpdateScheduledJob(): UseMutationResult<
  ScheduledJobResponse,
  Error,
  { jobId: string; payload: ScheduledJobUpdate }
> {
  const queryClient = useQueryClient();

  return useMutation<ScheduledJobResponse, Error, { jobId: string; payload: ScheduledJobUpdate }>({
    mutationFn: async ({ jobId, payload }) => {
      const response = await apiClient.patch<ScheduledJobResponse>(
        `/jobs/scheduler/scheduled-jobs/${jobId}`,
        payload,
      );
      return extractDataOrThrow(response);
    },
    onSuccess: async (_, { jobId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["scheduler", "scheduled-jobs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["scheduler", "scheduled-job", jobId],
        }),
      ]);
    },
  });
}

/**
 * Toggle scheduled job active status
 */
export function useToggleScheduledJob(): UseMutationResult<ScheduledJobResponse, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<ScheduledJobResponse, Error, string>({
    mutationFn: async (jobId) => {
      const response = await apiClient.post<ScheduledJobResponse>(
        `/jobs/scheduler/scheduled-jobs/${jobId}/toggle`,
      );
      return extractDataOrThrow(response);
    },
    onSuccess: async (_, jobId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["scheduler", "scheduled-jobs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["scheduler", "scheduled-job", jobId],
        }),
      ]);
    },
  });
}

/**
 * Delete a scheduled job
 */
export function useDeleteScheduledJob(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (jobId) => {
      await apiClient.delete(`/jobs/scheduler/scheduled-jobs/${jobId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["scheduler", "scheduled-jobs"],
      });
    },
  });
}

/**
 * Get a single job chain by ID
 */
export function useJobChain(chainId: string | null): UseQueryResult<JobChainResponse, Error> {
  return useQuery<JobChainResponse, Error, JobChainResponse, any>({
    queryKey: ["scheduler", "job-chain", chainId],
    queryFn: async () => {
      if (!chainId) throw new Error("Chain ID is required");
      const response = await apiClient.get<JobChainResponse>(`/jobs/scheduler/chains/${chainId}`);
      return extractDataOrThrow(response);
    },
    enabled: !!chainId,
  });
}

/**
 * Create a new job chain
 */
export function useCreateJobChain(): UseMutationResult<JobChainResponse, Error, JobChainCreate> {
  const queryClient = useQueryClient();

  return useMutation<JobChainResponse, Error, JobChainCreate>({
    mutationFn: async (payload) => {
      const response = await apiClient.post<JobChainResponse>("/jobs/scheduler/chains", payload);
      return extractDataOrThrow(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["scheduler", "job-chains"],
      });
    },
  });
}
