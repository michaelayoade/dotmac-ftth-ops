/**
 * React hooks for managing active jobs with WebSocket controls
 */

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

export interface Job {
  id: string;
  tenant_id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "paused";
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
}

export interface JobsResponse {
  jobs: Job[];
  total_count: number;
  limit: number;
  offset: number;
}

interface UseJobsOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch active jobs
 */
export function useJobs(options: UseJobsOptions = {}) {
  const { status, limit = 50, offset = 0 } = options;

  return useQuery({
    queryKey: ["jobs", status, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      params.append("limit", String(limit));
      params.append("offset", String(offset));

      const response = await apiClient.get<JobsResponse>(`/jobs?${params.toString()}`);
      return extractDataOrThrow(response);
    },
    staleTime: 5000, // 5 seconds
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
 */
export function useJobWebSocket(jobId: string | null) {
  const [socket, setSocket] = React.useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    if (!jobId) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001"}/api/v1/realtime/ws/jobs/${jobId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected for job:", jobId);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected for job:", jobId);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [jobId]);

  const cancelJob = React.useCallback(() => {
    if (socket && isConnected) {
      socket.send(JSON.stringify({ type: "cancel_job" }));
    }
  }, [socket, isConnected]);

  const pauseJob = React.useCallback(() => {
    if (socket && isConnected) {
      socket.send(JSON.stringify({ type: "pause_job" }));
    }
  }, [socket, isConnected]);

  const resumeJob = React.useCallback(() => {
    if (socket && isConnected) {
      socket.send(JSON.stringify({ type: "resume_job" }));
    }
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    cancelJob,
    pauseJob,
    resumeJob,
  };
}
