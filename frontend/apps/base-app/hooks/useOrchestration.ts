/**
 * Orchestration Workflow Hooks
 *
 * Custom hooks for interacting with the orchestration API
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";

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
// useOrchestrationStats Hook
// ============================================================================

export function useOrchestrationStats() {
  const [stats, setStats] = useState<WorkflowStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<WorkflowStatistics>("/orchestration/stats");
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch orchestration stats:", err);
      setError(err.response?.data?.detail || "Failed to fetch statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

// ============================================================================
// useWorkflows Hook
// ============================================================================

interface UseWorkflowsOptions {
  status?: WorkflowStatus;
  workflowType?: WorkflowType;
  page?: number;
  pageSize?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
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

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
      if (status) params.status = status;
      if (workflowType) params.workflow_type = workflowType;

      const response = await apiClient.get<WorkflowListResponse>("/orchestration/workflows", {
        params,
      });

      setWorkflows(response.data.workflows);
      setTotal(response.data.total);
      setTotalPages(response.data.total_pages);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch workflows:", err);
      setError(err.response?.data?.detail || "Failed to fetch workflows");
    } finally {
      setLoading(false);
    }
  }, [status, workflowType, page, pageSize]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchWorkflows();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchWorkflows]);

  return {
    workflows,
    total,
    totalPages,
    loading,
    error,
    refetch: fetchWorkflows,
  };
}

// ============================================================================
// useWorkflow Hook (Single workflow)
// ============================================================================

export function useWorkflow(workflowId: string | null, autoRefresh = false) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.get<Workflow>(`/orchestration/workflows/${workflowId}`);
      setWorkflow(response.data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch workflow:", err);
      setError(err.response?.data?.detail || "Failed to fetch workflow");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // Auto-refresh for running workflows
  useEffect(() => {
    if (!autoRefresh || !workflowId) return;
    if (workflow?.status === "completed" || workflow?.status === "failed") return;

    const interval = setInterval(() => {
      fetchWorkflow();
    }, 2000); // Poll every 2 seconds for running workflows

    return () => clearInterval(interval);
  }, [autoRefresh, workflowId, workflow?.status, fetchWorkflow]);

  return {
    workflow,
    loading,
    error,
    refetch: fetchWorkflow,
  };
}

// ============================================================================
// useRetryWorkflow Hook
// ============================================================================

export function useRetryWorkflow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retryWorkflow = useCallback(async (workflowId: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.post(`/orchestration/workflows/${workflowId}/retry`);
      return true;
    } catch (err: any) {
      console.error("Failed to retry workflow:", err);
      setError(err.response?.data?.detail || "Failed to retry workflow");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    retryWorkflow,
    loading,
    error,
  };
}

// ============================================================================
// useCancelWorkflow Hook
// ============================================================================

export function useCancelWorkflow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelWorkflow = useCallback(async (workflowId: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.post(`/orchestration/workflows/${workflowId}/cancel`);
      return true;
    } catch (err: any) {
      console.error("Failed to cancel workflow:", err);
      setError(err.response?.data?.detail || "Failed to cancel workflow");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    cancelWorkflow,
    loading,
    error,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportCSV = useCallback(async (options: ExportOptions = {}) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.workflowType) params.append("workflow_type", options.workflowType);
      if (options.status) params.append("status", options.status);
      if (options.dateFrom) params.append("date_from", options.dateFrom);
      if (options.dateTo) params.append("date_to", options.dateTo);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get(`/orchestration/export/csv?${params.toString()}`, {
        responseType: "blob",
      });

      // Create blob and download
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `workflows_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return true;
    } catch (err: any) {
      console.error("Failed to export workflows as CSV:", err);
      setError(err.response?.data?.detail || "Failed to export workflows");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportJSON = useCallback(async (options: ExportOptions = {}) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.workflowType) params.append("workflow_type", options.workflowType);
      if (options.status) params.append("status", options.status);
      if (options.dateFrom) params.append("date_from", options.dateFrom);
      if (options.dateTo) params.append("date_to", options.dateTo);
      if (options.limit) params.append("limit", options.limit.toString());
      if (options.includeSteps !== undefined) {
        params.append("include_steps", options.includeSteps.toString());
      }

      const response = await apiClient.get(`/orchestration/export/json?${params.toString()}`, {
        responseType: "blob",
      });

      // Create blob and download
      const blob = new Blob([response.data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `workflows_export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return true;
    } catch (err: any) {
      console.error("Failed to export workflows as JSON:", err);
      setError(err.response?.data?.detail || "Failed to export workflows");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    exportCSV,
    exportJSON,
    loading,
    error,
  };
}
