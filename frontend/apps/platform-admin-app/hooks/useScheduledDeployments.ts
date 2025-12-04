/**
 * Scheduled Deployments Hook - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Better error handling
 * - Reduced boilerplate (238 lines → 225 lines)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type DeploymentOperation =
  | "provision"
  | "upgrade"
  | "scale"
  | "suspend"
  | "resume"
  | "destroy";

export interface ProvisionRequest {
  template_id: number;
  environment: string;
  region?: string;
  config?: Record<string, unknown>;
  allocated_cpu?: number;
  allocated_memory_gb?: number;
  allocated_storage_gb?: number;
  tags?: Record<string, string>;
  notes?: string;
}

export interface UpgradeRequest {
  to_version: string;
  config_updates?: Record<string, unknown>;
  rollback_on_failure?: boolean;
  maintenance_window_start?: string;
  maintenance_window_end?: string;
}

export interface ScaleRequest {
  cpu_cores?: number;
  memory_gb?: number;
  storage_gb?: number;
}

export interface ScheduledDeploymentRequest {
  operation: DeploymentOperation;
  scheduled_at: string; // ISO 8601 datetime
  instance_id?: number; // Required for upgrade/scale/suspend/resume/destroy
  provision_request?: ProvisionRequest;
  upgrade_request?: UpgradeRequest;
  scale_request?: ScaleRequest;
  cron_expression?: string; // For recurring schedules
  interval_seconds?: number; // For recurring schedules (60-2592000)
  metadata?: Record<string, unknown>;
}

export interface ScheduledDeploymentResponse {
  schedule_id: string;
  schedule_type: "one_time" | "recurring";
  operation: string;
  scheduled_at?: string;
  cron_expression?: string;
  interval_seconds?: number;
  next_run_at?: string;
  parameters: Record<string, unknown>;
}

export interface DeploymentTemplate {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  backend: string;
  deployment_type: string;
  version: string;
  cpu_cores?: number;
  memory_gb?: number;
  storage_gb?: number;
  is_active: boolean;
}

export interface DeploymentInstance {
  id: number;
  tenant_id: string;
  template_id: number;
  environment: string;
  region?: string;
  state: string;
  version: string;
  allocated_cpu?: number;
  allocated_memory_gb?: number;
  allocated_storage_gb?: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Query Key Factory
// ============================================================================

export const scheduledDeploymentsKeys = {
  all: ["scheduled-deployments"] as const,
  templates: () => [...scheduledDeploymentsKeys.all, "templates"] as const,
  instances: () => [...scheduledDeploymentsKeys.all, "instances"] as const,
};

// ============================================================================
// useDeploymentTemplates Hook
// ============================================================================

export function useDeploymentTemplates() {
  return useQuery({
    queryKey: scheduledDeploymentsKeys.templates(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<DeploymentTemplate[]>(
          "/deployments/templates?is_active=true",
        );
        logger.info("Fetched deployment templates", { count: response.data.length });
        return response.data;
      } catch (err) {
        logger.error(
          "Failed to fetch templates",
          err instanceof Error ? err : new Error(String(err)),
        );
        throw err;
      }
    },
    staleTime: 300000, // 5 minutes - templates don't change frequently
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// useDeploymentInstances Hook
// ============================================================================

export function useDeploymentInstances() {
  return useQuery({
    queryKey: scheduledDeploymentsKeys.instances(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ instances: DeploymentInstance[] }>(
          "/deployments/instances",
        );
        logger.info("Fetched deployment instances", { count: response.data.instances.length });
        return response.data.instances;
      } catch (err) {
        logger.error(
          "Failed to fetch instances",
          err instanceof Error ? err : new Error(String(err)),
        );
        throw err;
      }
    },
    staleTime: 60000, // 1 minute - instances may change
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// useScheduleDeploymentMutation Hook
// ============================================================================

export function useScheduleDeploymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      request: ScheduledDeploymentRequest,
    ): Promise<ScheduledDeploymentResponse> => {
      // Validate operation-specific requirements
      if (request.operation === "provision" && !request.provision_request) {
        throw new Error("provision_request is required for provision operation");
      }

      if (
        ["upgrade", "scale", "suspend", "resume", "destroy"].includes(request.operation) &&
        !request.instance_id
      ) {
        throw new Error(`instance_id is required for ${request.operation} operation`);
      }

      if (request.operation === "upgrade" && !request.upgrade_request) {
        throw new Error("upgrade_request is required for upgrade operation");
      }

      if (request.operation === "scale" && !request.scale_request) {
        throw new Error("scale_request is required for scale operation");
      }

      try {
        const response = await apiClient.post<ScheduledDeploymentResponse>(
          "/deployments/schedule",
          request,
        );
        logger.info("Scheduled deployment", {
          operation: request.operation,
          schedule_id: response.data.schedule_id,
        });
        return response.data;
      } catch (err) {
        logger.error(
          "Failed to schedule deployment",
          err instanceof Error ? err : new Error(String(err)),
        );
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate instances list after scheduling
      queryClient.invalidateQueries({ queryKey: scheduledDeploymentsKeys.instances() });
    },
  });
}

// ============================================================================
// Main useScheduledDeployments Hook - Backward Compatible API
// ============================================================================

export function useScheduledDeployments() {
  const templatesQuery = useDeploymentTemplates();
  const instancesQuery = useDeploymentInstances();
  const scheduleMutation = useScheduleDeploymentMutation();

  return {
    scheduleDeployment: scheduleMutation.mutateAsync,
    fetchTemplates: async () => {
      if (templatesQuery.data) return templatesQuery.data;
      const result = await templatesQuery.refetch();
      return result.data || [];
    },
    fetchInstances: async () => {
      if (instancesQuery.data) return instancesQuery.data;
      const result = await instancesQuery.refetch();
      return result.data || [];
    },
    isLoading: templatesQuery.isLoading || instancesQuery.isLoading || scheduleMutation.isPending,
    error: templatesQuery.error || instancesQuery.error || scheduleMutation.error,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get operation label
 */
export function getOperationLabel(operation: DeploymentOperation): string {
  const labels: Record<DeploymentOperation, string> = {
    provision: "Provision New Deployment",
    upgrade: "Upgrade Deployment",
    scale: "Scale Resources",
    suspend: "Suspend Deployment",
    resume: "Resume Deployment",
    destroy: "Destroy Deployment",
  };
  return labels[operation];
}

/**
 * Get operation description
 */
export function getOperationDescription(operation: DeploymentOperation): string {
  const descriptions: Record<DeploymentOperation, string> = {
    provision: "Create a new deployment instance from a template",
    upgrade: "Upgrade deployment to a new version",
    scale: "Scale CPU, memory, or storage resources",
    suspend: "Temporarily suspend the deployment",
    resume: "Resume a suspended deployment",
    destroy: "Permanently destroy the deployment",
  };
  return descriptions[operation];
}

/**
 * Validate cron expression (basic)
 */
export function isValidCronExpression(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  return parts.length === 5; // Basic validation: minute hour day month weekday
}

/**
 * Get cron expression examples
 */
export const CRON_EXAMPLES = [
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every day at 2 AM", value: "0 2 * * *" },
  { label: "Every Sunday at 2 AM", value: "0 2 * * 0" },
  { label: "Every Monday at 3 AM", value: "0 3 * * 1" },
  { label: "First day of month at midnight", value: "0 0 1 * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
] as const;
