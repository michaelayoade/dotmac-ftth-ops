/**
 * React hooks for managing active jobs with WebSocket controls
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

export interface Job {
  id: string;
  tenant_id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "paused" | "assigned";
  title: string;
  description?: string | null;
  items_total: number;
  items_processed: number;
  items_failed: number;
  error_message?: string | null;
  parameters?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  // Field service specific fields
  assigned_technician_id?: string | null;
  assigned_to?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  service_address?: string | null;
}

export interface FieldInstallationJob extends Job {
  job_type: "field_installation";
  location_lat: number;
  location_lng: number;
  service_address: string;
  parameters: {
    ticket_id?: string;
    ticket_number?: string;
    customer_id?: string;
    order_id?: string;
    order_number?: string;
    priority?: string;
    required_skills?: string[];
    [key: string]: unknown;
  };
}

export interface JobsResponse {
  jobs: Job[];
  total_count: number;
  limit: number;
  offset: number;
}

interface UseJobsOptions {
  status?: string;
  jobType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch active jobs
 */
export function useJobs(options: UseJobsOptions = {}) {
  const { status, jobType, limit = 50, offset = 0 } = options;

  return useQuery({
    queryKey: ["jobs", status, jobType, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (jobType) params.append("job_type", jobType);
      params.append("limit", String(limit));
      params.append("offset", String(offset));

      const response = await apiClient.get<JobsResponse>(`/jobs?${params.toString()}`);
      return extractDataOrThrow(response);
    },
    staleTime: 5000, // 5 seconds
  });
}

/**
 * Fetch field installation jobs with location data for map display
 */
export function useFieldInstallationJobs(options: { status?: string } = {}) {
  const { status } = options;

  return useQuery({
    queryKey: ["field-installation-jobs", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("job_type", "field_installation");
      if (status) params.append("status", status);
      params.append("limit", "100");

      const response = await apiClient.get<JobsResponse>(`/jobs?${params.toString()}`);
      const data = extractDataOrThrow(response);

      // Filter to only jobs with location data
      const jobsWithLocation = data.jobs.filter(
        (job): job is FieldInstallationJob =>
          job.job_type === "field_installation" &&
          job.location_lat != null &&
          job.location_lng != null,
      );

      return {
        ...data,
        jobs: jobsWithLocation,
      };
    },
    staleTime: 5000, // 5 seconds - refresh frequently for real-time updates
    refetchInterval: 10000, // Auto-refetch every 10 seconds
  });
}

/**
 * Cancel a job via REST API
 */
export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.post<Job>(`/jobs/${jobId}/cancel`);
      return extractDataOrThrow(response);
    },
    onSuccess: () => {
      // Invalidate jobs queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

/**
 * WebSocket hook for real-time job control
 * Re-exports the shared implementation from useRealtime which has proper auth
 */
export { useJobWebSocket } from "./useRealtime";
