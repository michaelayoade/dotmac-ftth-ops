"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast, type Toast } from "@dotmac/ui";
import { useAppConfig } from "@/providers/AppConfigContext";

// Types matching backend models
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
  | "partially_completed"
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
  workflow_id: number;
  step_id: string;
  sequence_number: number;
  step_name: string;
  step_type: string;
  target_system: string | null;
  status: WorkflowStepStatus;
  input_data: Record<string, any>;
  output_data: Record<string, any> | null;
  compensation_data: Record<string, any> | null;
  compensation_handler: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  compensation_started_at: string | null;
  compensation_completed_at: string | null;
  error_message: string | null;
  error_details: Record<string, any> | null;
  retry_count: number;
  max_retries: number;
  idempotency_key: string | null;
  step_order: number;
}

export interface Workflow {
  id: number;
  workflow_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  initiator_id: string | null;
  initiator_type: string | null;
  input_data: Record<string, any>;
  output_data: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  error_details: Record<string, any> | null;
  retry_count: number;
  max_retries: number;
  compensation_started_at: string | null;
  compensation_completed_at: string | null;
  compensation_error: string | null;
  context: Record<string, any> | null;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkflowStats {
  total_workflows: number;
  by_status: Record<WorkflowStatus, number>;
  by_type: Record<WorkflowType, number>;
  success_rate: number;
  average_duration_seconds: number | null;
  recent_failures: number;
  active_workflows: number;
}

/**
 * Hook for managing orchestration workflows
 */
type ToastParams = Omit<Toast, "id">;

export function useOrchestrationWorkflows(options?: { toast?: (params: ToastParams) => void }) {
  const { toast: defaultToast } = useToast();
  const notify = options?.toast ?? defaultToast;
  const queryClient = useQueryClient();
  const { api } = useAppConfig();
  const buildUrl = api.buildUrl;
  const apiBaseUrl = api.baseUrl;
  const apiPrefix = api.prefix;

  // List workflows
  const useWorkflows = (params?: {
    workflow_type?: WorkflowType;
    status?: WorkflowStatus;
    limit?: number;
    offset?: number;
  }) => {
    return useQuery({
      queryKey: ["orchestration-workflows", params, apiBaseUrl, apiPrefix],
      queryFn: async () => {
        const searchParams = new URLSearchParams();
        if (params?.workflow_type) searchParams.append("workflow_type", params.workflow_type);
        if (params?.status) searchParams.append("status", params.status);
        if (params?.limit) searchParams.append("limit", String(params.limit));
        if (params?.offset) searchParams.append("offset", String(params.offset));

        const url = buildUrl(`/orchestration/workflows?${searchParams.toString()}`);
        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch workflows");
        }

        return response.json() as Promise<WorkflowListResponse>;
      },
      refetchInterval: (query) => {
        // Poll more frequently if there are active workflows
        const workflows = query.state.data?.workflows ?? [];
        const hasActiveWorkflows = workflows.some(
          (w: Workflow) =>
            w.status === "running" || w.status === "pending" || w.status === "rolling_back"
        );
        return hasActiveWorkflows ? 2000 : 10000;
      },
    });
  };

  // Get single workflow
  const useWorkflow = (workflowId: string | null) => {
    return useQuery({
      queryKey: ["orchestration-workflow", workflowId, apiBaseUrl, apiPrefix],
      queryFn: async () => {
        if (!workflowId) return null;

        const url = buildUrl(`/orchestration/workflows/${workflowId}`);
        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch workflow");
        }

        return response.json() as Promise<Workflow>;
      },
      enabled: !!workflowId,
      refetchInterval: (query) => {
        // Poll while workflow is active
        if (
          query.state.data?.status === "running" ||
          query.state.data?.status === "pending" ||
          query.state.data?.status === "rolling_back"
        ) {
          return 1000; // Poll every second
        }
        return false;
      },
    });
  };

  // Get workflow statistics
  const useWorkflowStats = () => {
    return useQuery({
      queryKey: ["orchestration-stats", apiBaseUrl, apiPrefix],
      queryFn: async () => {
        const url = buildUrl("/orchestration/statistics");
        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch workflow statistics");
        }

        return response.json() as Promise<WorkflowStats>;
      },
      refetchInterval: 10000, // Refresh stats every 10 seconds
    });
  };

  // Retry workflow
  const retryWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      const url = buildUrl(`/orchestration/workflows/${workflowId}/retry`);
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to retry workflow");
      }

      return response.json() as Promise<Workflow>;
    },
    onSuccess: (_data, workflowId) => {
      notify({
        title: "Workflow retried",
        description: "The workflow has been queued for retry",
      });
      queryClient.invalidateQueries({ queryKey: ["orchestration-workflows"] });
      queryClient.invalidateQueries({ queryKey: ["orchestration-stats"] });
      if (workflowId) {
        queryClient.invalidateQueries({ queryKey: ["orchestration-workflow", workflowId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["orchestration-workflow"] });
      }
    },
    onError: (error: Error) => {
      notify({
        title: "Retry failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel workflow
  const cancelWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      const url = buildUrl(`/orchestration/workflows/${workflowId}/cancel`);
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to cancel workflow");
      }

      return response.json() as Promise<Workflow>;
    },
    onSuccess: (_data, workflowId) => {
      notify({
        title: "Workflow cancelled",
        description: "The workflow is being rolled back",
      });
      queryClient.invalidateQueries({ queryKey: ["orchestration-workflows"] });
      queryClient.invalidateQueries({ queryKey: ["orchestration-stats"] });
      if (workflowId) {
        queryClient.invalidateQueries({ queryKey: ["orchestration-workflow", workflowId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["orchestration-workflow"] });
      }
    },
    onError: (error: Error) => {
      notify({
        title: "Cancel failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export workflows
  const exportWorkflows = async (
    format: "csv" | "json" = "csv",
    params?: {
      workflow_type?: WorkflowType;
      status?: WorkflowStatus;
      limit?: number;
      date_from?: string;
      date_to?: string;
      include_steps?: boolean;
    }
  ) => {
    try {
      const searchParams = new URLSearchParams();
      if (params?.workflow_type) searchParams.append("workflow_type", params.workflow_type);
      if (params?.status) searchParams.append("status", params.status);
      if (params?.limit) searchParams.append("limit", String(params.limit));
      if (params?.date_from) searchParams.append("date_from", params.date_from);
      if (params?.date_to) searchParams.append("date_to", params.date_to);
      if (format === "json" && params?.include_steps !== undefined) {
        searchParams.append("include_steps", String(params.include_steps));
      }

      const url = buildUrl(`/orchestration/export/${format}?${searchParams.toString()}`);
      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to export workflows");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `workflows_export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      notify({
        title: "Export successful",
        description: `Workflows exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      notify({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return {
    useWorkflows,
    useWorkflow,
    useWorkflowStats,
    retryWorkflow: retryWorkflow.mutateAsync,
    cancelWorkflow: cancelWorkflow.mutateAsync,
    exportWorkflows,
    isRetrying: retryWorkflow.isPending,
    isCancelling: cancelWorkflow.isPending,
  };
}
