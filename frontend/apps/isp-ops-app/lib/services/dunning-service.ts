/**
 * Dunning & Collections Service - API client for dunning management
 *
 * Provides methods for:
 * - Managing dunning campaigns
 * - Tracking dunning executions
 * - Monitoring dunning statistics
 * - Recovery analytics
 */

import { platformConfig } from "@/lib/config";
import type {
  DunningActionConfig,
  DunningActionType,
  DunningCampaign,
  DunningExclusionRules,
  DunningExecutionStatus,
} from "@/types/oss";

export type {
  DunningActionConfig,
  DunningActionType,
  DunningCampaign,
  DunningExclusionRules,
  DunningExecutionStatus,
} from "@/types/oss";

const API_BASE = platformConfig.api.baseUrl;

// ============================================
// Type Definitions
// ============================================

export interface DunningCampaignCreate {
  name: string;
  description?: string;
  trigger_after_days: number;
  max_retries: number;
  retry_interval_days: number;
  actions: DunningActionConfig[];
  exclusion_rules?: DunningExclusionRules;
  priority?: number;
}

export interface DunningCampaignUpdate {
  name?: string;
  description?: string;
  trigger_after_days?: number;
  max_retries?: number;
  retry_interval_days?: number;
  actions?: DunningActionConfig[];
  exclusion_rules?: DunningExclusionRules;
  priority?: number;
}

export interface DunningExecution {
  id: string;
  tenant_id: string;
  campaign_id: string;
  subscription_id: string;
  customer_id: string;
  invoice_id?: string;
  status: DunningExecutionStatus;
  current_step: number;
  total_steps: number;
  retry_count: number;
  started_at: string;
  next_action_at?: string;
  completed_at?: string;
  outstanding_amount: number;
  recovered_amount: number;
  execution_log: Array<Record<string, any>>;
  canceled_reason?: string;
  canceled_by_user_id?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DunningExecutionStart {
  subscription_id: string;
  campaign_id?: string;
  override_rules?: boolean;
}

export interface DunningStatistics {
  total_campaigns: number;
  active_campaigns: number;
  total_executions: number;
  active_executions: number;
  completed_executions: number;
  failed_executions: number;
  canceled_executions: number;
  total_recovered_amount: number;
  average_recovery_rate: number;
  average_completion_time_hours: number;
}

export interface DunningCampaignStats {
  campaign_id: string;
  campaign_name: string;
  total_executions: number;
  active_executions: number;
  completed_executions: number;
  failed_executions: number;
  canceled_executions: number;
  total_recovered_amount: number;
  total_outstanding_amount: number;
  success_rate: number;
  recovery_rate: number;
  average_completion_time_hours: number;
}

export interface DunningRecoveryChartData {
  date: string;
  recovered: number;
  outstanding: number;
}

export interface CampaignListFilters {
  activeOnly?: boolean;
  skip?: number;
  limit?: number;
}

export interface ExecutionListFilters {
  campaignId?: string;
  status?: DunningExecutionStatus;
  subscriptionId?: string;
  customerId?: string;
  skip?: number;
  limit?: number;
}

// ============================================
// Service Class
// ============================================

class DunningService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE;
  }

  /**
   * Get authentication headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      credentials: "include",
    };
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
  // Campaign Management
  // ============================================

  /**
   * List dunning campaigns
   *
   * @param filters - Optional filters
   * @returns List of campaigns
   */
  async listCampaigns(filters: CampaignListFilters = {}): Promise<DunningCampaign[]> {
    const params = new URLSearchParams();

    if (filters.activeOnly !== undefined) {
      params.append("active_only", filters.activeOnly.toString());
    }
    if (filters.skip !== undefined) {
      params.append("skip", filters.skip.toString());
    }
    if (filters.limit !== undefined) {
      params.append("limit", filters.limit.toString());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/isp/v1/admin/billing/dunning/campaigns${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<DunningCampaign[]>(response);
  }

  /**
   * Get campaign by ID
   *
   * @param campaignId - Campaign UUID
   * @returns Campaign details
   */
  async getCampaign(campaignId: string): Promise<DunningCampaign> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/billing/dunning/campaigns/${campaignId}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<DunningCampaign>(response);
  }

  /**
   * Create dunning campaign
   *
   * @param data - Campaign creation data
   * @returns Created campaign
   */
  async createCampaign(data: DunningCampaignCreate): Promise<DunningCampaign> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/billing/dunning/campaigns`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<DunningCampaign>(response);
  }

  /**
   * Update dunning campaign
   *
   * @param campaignId - Campaign UUID
   * @param data - Update data
   * @returns Updated campaign
   */
  async updateCampaign(campaignId: string, data: DunningCampaignUpdate): Promise<DunningCampaign> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/billing/dunning/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<DunningCampaign>(response);
  }

  /**
   * Delete dunning campaign
   *
   * @param campaignId - Campaign UUID
   */
  async deleteCampaign(campaignId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/billing/dunning/campaigns/${campaignId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Pause dunning campaign
   *
   * @param campaignId - Campaign UUID
   */
  async pauseCampaign(campaignId: string): Promise<DunningCampaign> {
    const response = await fetch(
      `${this.baseUrl}/api/isp/v1/admin/billing/dunning/campaigns/${campaignId}/pause`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<DunningCampaign>(response);
  }

  /**
   * Resume dunning campaign
   *
   * @param campaignId - Campaign UUID
   */
  async resumeCampaign(campaignId: string): Promise<DunningCampaign> {
    const response = await fetch(
      `${this.baseUrl}/api/isp/v1/admin/billing/dunning/campaigns/${campaignId}/resume`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<DunningCampaign>(response);
  }

  // ============================================
  // Execution Management
  // ============================================

  /**
   * List dunning executions
   *
   * @param filters - Optional filters
   * @returns List of executions
   */
  async listExecutions(filters: ExecutionListFilters = {}): Promise<DunningExecution[]> {
    const params = new URLSearchParams();

    if (filters.campaignId) {
      params.append("campaign_id", filters.campaignId);
    }
    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.subscriptionId) {
      params.append("subscription_id", filters.subscriptionId);
    }
    if (filters.customerId) {
      params.append("customer_id", filters.customerId);
    }
    if (filters.skip !== undefined) {
      params.append("skip", filters.skip.toString());
    }
    if (filters.limit !== undefined) {
      params.append("limit", filters.limit.toString());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/isp/v1/admin/billing/dunning/executions${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<DunningExecution[]>(response);
  }

  /**
   * Get execution by ID
   *
   * @param executionId - Execution UUID
   * @returns Execution details
   */
  async getExecution(executionId: string): Promise<DunningExecution> {
    const response = await fetch(
      `${this.baseUrl}/api/isp/v1/admin/billing/dunning/executions/${executionId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<DunningExecution>(response);
  }

  /**
   * Start dunning execution
   *
   * @param data - Execution start data
   * @returns Started execution
   */
  async startExecution(data: DunningExecutionStart): Promise<DunningExecution> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/billing/dunning/executions`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<DunningExecution>(response);
  }

  /**
   * Cancel dunning execution
   *
   * @param executionId - Execution UUID
   * @param reason - Cancellation reason
   */
  async cancelExecution(executionId: string, reason: string): Promise<DunningExecution> {
    const response = await fetch(
      `${this.baseUrl}/api/isp/v1/admin/billing/dunning/executions/${executionId}/cancel`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ reason }),
      },
    );

    return this.handleResponse<DunningExecution>(response);
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  /**
   * Get overall dunning statistics
   *
   * @returns Dunning statistics
   */
  async getStatistics(): Promise<DunningStatistics> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/billing/dunning/stats`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<DunningStatistics>(response);
  }

  /**
   * Get campaign-specific statistics
   *
   * @param campaignId - Campaign UUID
   * @returns Campaign statistics
   */
  async getCampaignStatistics(campaignId: string): Promise<DunningCampaignStats> {
    const response = await fetch(
      `${this.baseUrl}/api/isp/v1/admin/billing/dunning/stats/campaigns/${campaignId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<DunningCampaignStats>(response);
  }

  /**
   * Get recovery chart data
   *
   * @param days - Number of days to include (default: 30)
   * @returns Chart data
   */
  async getRecoveryChartData(days: number = 30): Promise<DunningRecoveryChartData[]> {
    const response = await fetch(
      `${this.baseUrl}/api/isp/v1/admin/billing/dunning/analytics/recovery?days=${days}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<DunningRecoveryChartData[]>(response);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Calculate recovery rate
   *
   * @param recovered - Amount recovered
   * @param outstanding - Outstanding amount
   * @returns Recovery rate as percentage
   */
  calculateRecoveryRate(recovered: number, outstanding: number): number {
    if (outstanding === 0) return 100;
    return (recovered / outstanding) * 100;
  }

  /**
   * Calculate success rate
   *
   * @param successful - Number of successful executions
   * @param total - Total number of executions
   * @returns Success rate as percentage
   */
  calculateSuccessRate(successful: number, total: number): number {
    if (total === 0) return 0;
    return (successful / total) * 100;
  }

  /**
   * Format currency amount
   *
   * @param amount - Amount to format
   * @param currency - Currency code (default: USD)
   * @returns Formatted currency string
   */
  formatCurrency(amount: number, currency: string = "USD"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  }
}

// Export singleton instance
export const dunningService = new DunningService();
