/**
 * Service Lifecycle Service - API client for service lifecycle management
 *
 * Provides methods for:
 * - Managing service instances (provision, activate, suspend, resume, terminate)
 * - Monitoring service health and status
 * - Tracking service lifecycle statistics
 * - Service workflow orchestration
 */

import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

// ============================================
// Type Definitions
// ============================================

export type ServiceStatus =
  | "pending"
  | "provisioning"
  | "provisioning_failed"
  | "active"
  | "suspended"
  | "suspended_fraud"
  | "degraded"
  | "maintenance"
  | "terminating"
  | "terminated"
  | "failed";

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface ServiceInstanceSummary {
  service_instance_id: string;
  customer_id?: string;
  subscription_id?: string;
  service_type: string;
  status: ServiceStatus;
  health_status?: HealthStatus;
  created_at: string;
  updated_at: string;
  activated_at?: string;
  suspended_at?: string;
  terminated_at?: string;
  metadata?: Record<string, any>;
}

export interface ServiceInstanceDetail extends ServiceInstanceSummary {
  tenant_id: string;
  plan_id?: string;
  service_config?: Record<string, any>;
  equipment_assigned?: string[];
  ip_address?: string;
  vlan_id?: number;
  notes?: string;
  last_health_check?: string;
  uptime_percentage?: number;
  provisioning_status?: string;
  workflow_id?: string;
}

export interface ServiceStatistics {
  total_services: number;
  active_count: number;
  provisioning_count: number;
  suspended_count: number;
  terminated_count: number;
  failed_count: number;
  healthy_count: number;
  degraded_count: number;
  services_by_type: Record<string, number>;
  average_uptime: number;
  active_workflows: number;
  failed_workflows: number;
}

export interface ProvisionServiceRequest {
  customer_id: string;
  service_type: string;
  subscription_id?: string;
  plan_id?: string;
  service_config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ProvisionServiceResponse {
  service_instance_id: string;
  status: ServiceStatus;
  workflow_id?: string;
}

export interface ServiceActionRequest {
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ServiceModifyRequest {
  service_config?: Record<string, any>;
  plan_id?: string;
  metadata?: Record<string, any>;
  notes?: string;
}

export interface ServiceListFilters {
  customer_id?: string;
  subscription_id?: string;
  status?: ServiceStatus;
  service_type?: string;
  health_status?: HealthStatus;
  limit?: number;
  offset?: number;
}

export interface ServiceHealthCheckResult {
  service_instance_id: string;
  health_status: HealthStatus;
  last_check: string;
  checks: {
    connectivity: boolean;
    authentication: boolean;
    bandwidth: boolean;
    latency?: number;
  };
  issues: string[];
}

export interface ServiceWorkflow {
  workflow_id: string;
  service_instance_id: string;
  workflow_type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  steps: WorkflowStep[];
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface WorkflowStep {
  step_name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

// ============================================
// Service Class
// ============================================

class ServiceLifecycleService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE;
  }

  /**
   * Get authentication headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add tenant ID header if available from localStorage
    if (typeof window !== "undefined") {
      const tenantId = localStorage.getItem("tenant_id");
      if (tenantId) {
        headers["X-Tenant-ID"] = tenantId;
      }
    }

    return headers;
  }

  /**
   * Handle API errors consistently
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // ============================================
  // Service Instance Management
  // ============================================

  /**
   * List service instances
   *
   * @param filters - Optional filters
   * @returns List of service instances
   */
  async listServiceInstances(filters: ServiceListFilters = {}): Promise<ServiceInstanceSummary[]> {
    const params = new URLSearchParams();

    if (filters.customer_id) {
      params.append("customer_id", filters.customer_id);
    }
    if (filters.subscription_id) {
      params.append("subscription_id", filters.subscription_id);
    }
    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.service_type) {
      params.append("service_type", filters.service_type);
    }
    if (filters.health_status) {
      params.append("health_status", filters.health_status);
    }
    if (filters.limit !== undefined) {
      params.append("limit", filters.limit.toString());
    }
    if (filters.offset !== undefined) {
      params.append("offset", filters.offset.toString());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/services/lifecycle/services${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<ServiceInstanceSummary[]>(response);
  }

  /**
   * Get service instance by ID
   *
   * @param serviceId - Service instance UUID
   * @returns Service instance details
   */
  async getServiceInstance(serviceId: string): Promise<ServiceInstanceDetail> {
    const response = await fetch(`${this.baseUrl}/services/lifecycle/services/${serviceId}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<ServiceInstanceDetail>(response);
  }

  /**
   * Provision new service instance
   *
   * @param data - Provisioning request data
   * @returns Provisioning response with service ID
   */
  async provisionService(data: ProvisionServiceRequest): Promise<ProvisionServiceResponse> {
    const response = await fetch(`${this.baseUrl}/services/lifecycle/services/provision`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<ProvisionServiceResponse>(response);
  }

  /**
   * Activate service instance
   *
   * @param serviceId - Service instance UUID
   * @param data - Optional activation data
   */
  async activateService(serviceId: string, data?: ServiceActionRequest): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/services/lifecycle/services/${serviceId}/activate`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(data || {}),
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Suspend service instance
   *
   * @param serviceId - Service instance UUID
   * @param data - Suspension request with reason
   */
  async suspendService(serviceId: string, data?: ServiceActionRequest): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/services/lifecycle/services/${serviceId}/suspend`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(data || {}),
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Resume suspended service instance
   *
   * @param serviceId - Service instance UUID
   * @param data - Optional resume data
   */
  async resumeService(serviceId: string, data?: ServiceActionRequest): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/services/lifecycle/services/${serviceId}/resume`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(data || {}),
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Terminate service instance
   *
   * @param serviceId - Service instance UUID
   * @param data - Termination request with reason
   */
  async terminateService(serviceId: string, data?: ServiceActionRequest): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/services/lifecycle/services/${serviceId}/terminate`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(data || {}),
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Modify service instance
   *
   * @param serviceId - Service instance UUID
   * @param data - Modification data
   */
  async modifyService(
    serviceId: string,
    data: ServiceModifyRequest,
  ): Promise<ServiceInstanceDetail> {
    const response = await fetch(`${this.baseUrl}/services/lifecycle/services/${serviceId}`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<ServiceInstanceDetail>(response);
  }

  // ============================================
  // Health & Monitoring
  // ============================================

  /**
   * Perform health check on service instance
   *
   * @param serviceId - Service instance UUID
   * @returns Health check result
   */
  async healthCheckService(serviceId: string): Promise<ServiceHealthCheckResult> {
    const response = await fetch(
      `${this.baseUrl}/services/lifecycle/services/${serviceId}/health-check`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<ServiceHealthCheckResult>(response);
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  /**
   * Get service lifecycle statistics
   *
   * @returns Service statistics
   */
  async getStatistics(): Promise<ServiceStatistics> {
    const response = await fetch(`${this.baseUrl}/services/lifecycle/statistics`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<ServiceStatistics>(response);
  }

  // ============================================
  // Workflow Management
  // ============================================

  /**
   * Get service workflow status
   *
   * @param workflowId - Workflow UUID
   * @returns Workflow details
   */
  async getWorkflow(workflowId: string): Promise<ServiceWorkflow> {
    const response = await fetch(`${this.baseUrl}/services/lifecycle/workflows/${workflowId}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<ServiceWorkflow>(response);
  }

  /**
   * List workflows for a service instance
   *
   * @param serviceId - Service instance UUID
   * @returns List of workflows
   */
  async listServiceWorkflows(serviceId: string): Promise<ServiceWorkflow[]> {
    const response = await fetch(
      `${this.baseUrl}/services/lifecycle/services/${serviceId}/workflows`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<ServiceWorkflow[]>(response);
  }

  /**
   * Cancel workflow
   *
   * @param workflowId - Workflow UUID
   * @param reason - Cancellation reason
   */
  async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/services/lifecycle/workflows/${workflowId}/cancel`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ reason }),
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Calculate service uptime percentage
   *
   * @param activeTime - Active time in seconds
   * @param totalTime - Total time in seconds
   * @returns Uptime percentage
   */
  calculateUptime(activeTime: number, totalTime: number): number {
    if (totalTime === 0) return 0;
    return Math.min((activeTime / totalTime) * 100, 100);
  }

  /**
   * Get service status badge color
   *
   * @param status - Service status
   * @returns Badge color class
   */
  getStatusColor(status: ServiceStatus): string {
    const colorMap: Record<ServiceStatus, string> = {
      pending: "bg-gray-500",
      provisioning: "bg-blue-500",
      provisioning_failed: "bg-red-500",
      active: "bg-green-500",
      suspended: "bg-orange-500",
      suspended_fraud: "bg-red-600",
      degraded: "bg-yellow-500",
      maintenance: "bg-purple-500",
      terminating: "bg-gray-600",
      terminated: "bg-gray-700",
      failed: "bg-red-500",
    };
    return colorMap[status] || "bg-gray-500";
  }

  /**
   * Get health status badge color
   *
   * @param health - Health status
   * @returns Badge color class
   */
  getHealthColor(health: HealthStatus): string {
    const colorMap: Record<HealthStatus, string> = {
      healthy: "bg-green-500",
      degraded: "bg-yellow-500",
      unhealthy: "bg-red-500",
      unknown: "bg-gray-500",
    };
    return colorMap[health] || "bg-gray-500";
  }

  /**
   * Check if service can be activated
   *
   * @param status - Service status
   * @returns True if can be activated
   */
  canActivate(status: ServiceStatus): boolean {
    return status === "provisioning";
  }

  /**
   * Check if service can be suspended
   *
   * @param status - Service status
   * @returns True if can be suspended
   */
  canSuspend(status: ServiceStatus): boolean {
    return status === "active" || status === "degraded";
  }

  /**
   * Check if service can be resumed
   *
   * @param status - Service status
   * @returns True if can be resumed
   */
  canResume(status: ServiceStatus): boolean {
    return status === "suspended" || status === "suspended_fraud";
  }

  /**
   * Check if service can be terminated
   *
   * @param status - Service status
   * @returns True if can be terminated
   */
  canTerminate(status: ServiceStatus): boolean {
    return status !== "terminated" && status !== "terminating";
  }
}

// Export singleton instance
export const serviceLifecycleService = new ServiceLifecycleService();
