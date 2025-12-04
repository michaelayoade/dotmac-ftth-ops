/**
 * Orchestration Workflow Hooks - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Optimistic updates
 * - Better error handling
 * - Reduced boilerplate (427 lines → 340 lines)
 */

import { QueryClient, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type WorkflowType =
  | "provision_subscriber"
  | "deprovision_subscriber"
  | "activate_service"
  | "suspend_service"
  | "terminate_service"
  | "change_service_plan"
  | "update_network_config"
  | "migrate_subscriber";

export type WorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "rolling_back"
  | "rolled_back"
  | "rollback_failed"
  | "timeout"
  | "compensated";

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "compensating"
  | "compensated"
  | "compensation_failed";

export interface WorkflowStep {
  id: number;
  step_id: string;
  step_name: string;
  step_type: string;
  target_system: string;
  status: WorkflowStepStatus;
  step_order: number;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
}

export interface Workflow {
  id: number;
  workflow_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  tenant_id: string;
  initiator_id?: string;
  initiator_type?: string;
  input_data: Record<string, any>;
  output_data?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  steps?: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowStatistics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  success_rate: number;
  avg_duration_seconds?: number;
  by_type: Record<WorkflowType, number>;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================================
// Query Key Factory
// ============================================================================

export const orchestrationKeys = {
  all: ["orchestration"] as const,
  stats: () => [...orchestrationKeys.all, "stats"] as const,
  workflows: (filters?: any) => [...orchestrationKeys.all, "workflows", filters] as const,
  workflow: (id: string) => [...orchestrationKeys.all, "workflow", id] as const,
};

function invalidateWorkflowLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey as unknown[];
      return key?.[0] === "orchestration" && key?.[1] === "workflows";
    },
  });
}

// ============================================================================
// useOrchestrationStats Hook
// ============================================================================

export function useOrchestrationStats() {
  return useQuery({
    queryKey: orchestrationKeys.stats(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<WorkflowStatistics>("orchestration/statistics");
        return response.data;
      } catch (err: any) {
        logger.error("Failed to fetch orchestration stats", err);
        throw new Error(err.response?.data?.detail || "Failed to fetch statistics");
      }
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// useWorkflows Hook
// ============================================================================

interface UseWorkflowsOptions {
  status?: WorkflowStatus | undefined;
  workflowType?: WorkflowType | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  autoRefresh?: boolean | undefined;
  refreshInterval?: number | undefined;
}

export function useWorkflows(options: UseWorkflowsOptions = {}) {
  const {
    status,
    workflowType,
    page = 1,
    pageSize = 20,
    autoRefresh = false,
    refreshInterval = 5000,
  } = options;

  return useQuery({
    queryKey: orchestrationKeys.workflows({ status, workflowType, page, pageSize }),
    queryFn: async () => {
      try {
        const params: Record<string, any> = {
          page,
          page_size: pageSize,
        };
        if (status) params["status"] = status;
        if (workflowType) params["workflow_type"] = workflowType;

        const response = await apiClient.get<WorkflowListResponse>("orchestration/workflows", {
          params,
        });

        return response.data;
      } catch (err: any) {
        logger.error("Failed to fetch workflows", err);
        throw new Error(err.response?.data?.detail || "Failed to fetch workflows");
      }
    },
    staleTime: 10000,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// useWorkflow Hook (Single workflow)
// ============================================================================

export function useWorkflow(workflowId: string | null, autoRefresh = false) {
  return useQuery({
    queryKey: orchestrationKeys.workflow(workflowId ?? ""),
    queryFn: async () => {
      if (!workflowId) return null;

      try {
        const response = await apiClient.get<Workflow>(`/orchestration/workflows/${workflowId}`);
        return response.data;
      } catch (err: any) {
        logger.error("Failed to fetch workflow", err);
        throw new Error(err.response?.data?.detail || "Failed to fetch workflow");
      }
    },
    enabled: !!workflowId,
    staleTime: 2000,
    refetchInterval: (query) => {
      // Only auto-refresh if enabled and workflow is still running
      if (!autoRefresh || !query.state.data) return false;

      // Stop polling for terminal states
      const terminalStates: WorkflowStatus[] = [
        "completed",
        "failed",
        "rolled_back",
        "rollback_failed",
        "timeout",
        "compensated",
      ];
      if (terminalStates.includes(query.state.data.status)) return false;

      return 2000; // Poll every 2 seconds for running workflows
    },
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// useRetryWorkflow Hook
// ============================================================================

export function useRetryWorkflow() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (workflowId: string) => {
      await apiClient.post(`/orchestration/workflows/${workflowId}/retry`);
      return workflowId;
    },
    onSuccess: (workflowId) => {
      // Invalidate the specific workflow and stats
      queryClient.invalidateQueries({ queryKey: orchestrationKeys.workflow(workflowId) });
      invalidateWorkflowLists(queryClient);
      queryClient.invalidateQueries({ queryKey: orchestrationKeys.stats() });
    },
    onError: (err: any) => {
      logger.error("Failed to retry workflow", err);
    },
  });

  return {
    retryWorkflow: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error ? String(mutation.error) : null,
  };
}

// ============================================================================
// useCancelWorkflow Hook
// ============================================================================

export function useCancelWorkflow() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (workflowId: string) => {
      await apiClient.post(`/orchestration/workflows/${workflowId}/cancel`);
      return workflowId;
    },
    onSuccess: (workflowId) => {
      // Invalidate the specific workflow and stats
      queryClient.invalidateQueries({ queryKey: orchestrationKeys.workflow(workflowId) });
      invalidateWorkflowLists(queryClient);
      queryClient.invalidateQueries({ queryKey: orchestrationKeys.stats() });
    },
    onError: (err: any) => {
      logger.error("Failed to cancel workflow", err);
    },
  });

  return {
    cancelWorkflow: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error ? String(mutation.error) : null,
  };
}

// ============================================================================
// useExportWorkflows Hook
// ============================================================================

export interface ExportOptions {
  workflowType?: WorkflowType;
  status?: WorkflowStatus;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  includeSteps?: boolean;
}

export function useExportWorkflows() {
  const exportMutation = useMutation({
    mutationFn: async ({ format, options }: { format: "csv" | "json"; options: ExportOptions }) => {
      const params = new URLSearchParams();
      if (options.workflowType) params.append("workflow_type", options.workflowType);
      if (options.status) params.append("status", options.status);
      if (options.dateFrom) params.append("date_from", options.dateFrom);
      if (options.dateTo) params.append("date_to", options.dateTo);
      if (options.limit) params.append("limit", options.limit.toString());
      if (format === "json" && options.includeSteps !== undefined) {
        params.append("include_steps", options.includeSteps.toString());
      }

      const response = await apiClient.get(`orchestration/export/${format}?${params.toString()}`, {
        responseType: "blob",
      });

      // Create blob and download
      const blob = new Blob([response.data], {
        type: format === "csv" ? "text/csv" : "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `workflows_export_${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return true;
    },
    onError: (err: any) => {
      logger.error("Failed to export workflows", err);
    },
  });

  return {
    exportCSV: (options: ExportOptions = {}) =>
      exportMutation.mutateAsync({ format: "csv", options }),
    exportJSON: (options: ExportOptions = {}) =>
      exportMutation.mutateAsync({ format: "json", options }),
    loading: exportMutation.isPending,
    error: exportMutation.error ? String(exportMutation.error) : null,
  };
}
