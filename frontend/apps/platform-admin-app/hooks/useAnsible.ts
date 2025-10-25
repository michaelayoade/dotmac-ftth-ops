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
  AWXHealthResponse,
  Job,
  JobTemplate,
  JobLaunchRequest,
  JobLaunchResponse,
} from "@/types";

// Query keys
type HealthQueryKey = ["ansible", "health"];
type TemplatesQueryKey = ["ansible", "templates"];
type TemplateQueryKey = ["ansible", "template", number];
type JobsQueryKey = ["ansible", "jobs"];
type JobQueryKey = ["ansible", "job", number];

/**
 * Check AWX health status
 */
export function useAWXHealth(
  options?: Omit<
    UseQueryOptions<AWXHealthResponse, Error, AWXHealthResponse, HealthQueryKey>,
    "queryKey" | "queryFn"
  >,
): UseQueryResult<AWXHealthResponse, Error> {
  return useQuery<AWXHealthResponse, Error, AWXHealthResponse, HealthQueryKey>({
    queryKey: ["ansible", "health"],
    queryFn: async () => {
      const response = await apiClient.get<AWXHealthResponse>("/ansible/health");
      return extractDataOrThrow(response);
    },
    staleTime: 30_000,
    ...options,
  });
}

/**
 * List all job templates
 */
export function useJobTemplates(
  options?: Omit<
    UseQueryOptions<JobTemplate[], Error, JobTemplate[], TemplatesQueryKey>,
    "queryKey" | "queryFn"
  >,
): UseQueryResult<JobTemplate[], Error> {
  return useQuery<JobTemplate[], Error, JobTemplate[], TemplatesQueryKey>({
    queryKey: ["ansible", "templates"],
    queryFn: async () => {
      const response = await apiClient.get<JobTemplate[]>("/ansible/job-templates");
      return extractDataOrThrow(response);
    },
    staleTime: 60_000,
    ...options,
  });
}

/**
 * Get a single job template by ID
 */
export function useJobTemplate(
  templateId: number | null,
  options?: Omit<
    UseQueryOptions<JobTemplate, Error, JobTemplate, TemplateQueryKey>,
    "queryKey" | "queryFn"
  >,
): UseQueryResult<JobTemplate, Error> {
  return useQuery<JobTemplate, Error, JobTemplate, TemplateQueryKey>({
    queryKey: ["ansible", "template", templateId ?? 0],
    queryFn: async () => {
      if (!templateId) {
        throw new Error("Template ID is required");
      }
      const response = await apiClient.get<JobTemplate>(`/ansible/job-templates/${templateId}`);
      return extractDataOrThrow(response);
    },
    enabled: Boolean(templateId),
    staleTime: 60_000,
    ...options,
  });
}

/**
 * List all jobs
 */
export function useJobs(
  options?: Omit<UseQueryOptions<Job[], Error, Job[], JobsQueryKey>, "queryKey" | "queryFn">,
): UseQueryResult<Job[], Error> {
  return useQuery<Job[], Error, Job[], JobsQueryKey>({
    queryKey: ["ansible", "jobs"],
    queryFn: async () => {
      const response = await apiClient.get<Job[]>("/ansible/jobs");
      return extractDataOrThrow(response);
    },
    staleTime: 30_000,
    ...options,
  });
}

/**
 * Get a single job by ID
 */
export function useJob(
  jobId: number | null,
  options?: Omit<UseQueryOptions<Job, Error, Job, JobQueryKey>, "queryKey" | "queryFn">,
): UseQueryResult<Job, Error> {
  return useQuery<Job, Error, Job, JobQueryKey>({
    queryKey: ["ansible", "job", jobId ?? 0],
    queryFn: async () => {
      if (!jobId) {
        throw new Error("Job ID is required");
      }
      const response = await apiClient.get<Job>(`/ansible/jobs/${jobId}`);
      return extractDataOrThrow(response);
    },
    enabled: Boolean(jobId),
    staleTime: 10_000,
    ...options,
  });
}

/**
 * Launch a job from a template
 */
export function useLaunchJob(): UseMutationResult<JobLaunchResponse, Error, JobLaunchRequest> {
  const queryClient = useQueryClient();
  return useMutation<JobLaunchResponse, Error, JobLaunchRequest>({
    mutationFn: async (request: JobLaunchRequest) => {
      const response = await apiClient.post<JobLaunchResponse>("/ansible/jobs/launch", request);
      return extractDataOrThrow(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ansible", "jobs"] });
    },
  });
}

interface CancelJobVariables {
  jobId: number;
}

/**
 * Cancel a running job
 */
export function useCancelJob(): UseMutationResult<void, Error, CancelJobVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, CancelJobVariables>({
    mutationFn: async ({ jobId }: CancelJobVariables) => {
      await apiClient.post(`/ansible/jobs/${jobId}/cancel`);
    },
    onSuccess: async (_, { jobId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ansible", "jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["ansible", "job", jobId] }),
      ]);
    },
  });
}
