/**
 * Communications Service - API client for email/SMS communications
 *
 * Provides methods for:
 * - Sending emails and SMS
 * - Managing communication templates
 * - Bulk operations and campaigns
 * - Tracking communication logs and statistics
 *
 * This service layer uses types from @/types/communications.ts
 * and is designed to work with the Communications hooks.
 */

import { platformConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import { CommunicationStatus } from "@/types/communications";
import type {
  // Requests
  SendEmailRequest,
  QueueEmailRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  RenderTemplateRequest,
  QuickRenderRequest,
  QueueBulkRequest,
  ListCommunicationsParams,
  ListTemplatesParams,
  StatsParams,
  ActivityParams,
  // Responses
  SendEmailResponse,
  QueueEmailResponse,
  CommunicationLog,
  CommunicationTemplate,
  TemplateListResponse,
  RenderTemplateResponse,
  BulkOperation,
  BulkOperationStatusResponse,
  TaskStatusResponse,
  CommunicationStats,
  ActivityResponse,
  HealthResponse,
  MetricsResponse,
  // Enums (only types)
  CommunicationChannel,
} from "@/types/communications";

const API_BASE = platformConfig.api.baseUrl;
const ADMIN_PREFIX = "/api/isp/v1/admin";

// ============================================
// Service Class
// ============================================

class CommunicationsService {
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
  // Email Operations
  // ============================================

  /**
   * Send email immediately
   *
   * @param data - Email data
   * @returns Send response with message ID
   */
  async sendEmail(data: SendEmailRequest): Promise<SendEmailResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/email/send`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<SendEmailResponse>(response);
  }

  /**
   * Queue email for background sending
   *
   * @param data - Email data with scheduling options
   * @returns Queue response with task ID
   */
  async queueEmail(data: QueueEmailRequest): Promise<QueueEmailResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/email/queue`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<QueueEmailResponse>(response);
  }

  /**
   * Queue bulk email job
   *
   * @param data - Bulk email request
   * @returns Bulk operation
   */
  async queueBulkEmail(data: QueueBulkRequest): Promise<BulkOperation> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/bulk/queue`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<BulkOperation>(response);
  }

  /**
   * Get bulk email job status
   *
   * @param jobId - Job ID
   * @returns Job status with recent logs
   */
  async getBulkEmailStatus(jobId: string): Promise<BulkOperationStatusResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/bulk/${jobId}/status`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<BulkOperationStatusResponse>(response);
  }

  /**
   * Cancel bulk email job
   *
   * @param jobId - Job ID
   * @returns Updated bulk operation
   */
  async cancelBulkEmail(jobId: string): Promise<BulkOperation> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/bulk/${jobId}/cancel`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<BulkOperation>(response);
  }

  // ============================================
  // Template Management
  // ============================================

  /**
   * List templates with pagination
   *
   * @param params - Filter parameters
   * @returns Template list with pagination
   */
  async listTemplates(params: ListTemplatesParams = {}): Promise<TemplateListResponse> {
    const searchParams = new URLSearchParams();
    if (params.channel) searchParams.append("channel", params.channel);
    if (params.is_active !== undefined) searchParams.append("is_active", String(params.is_active));
    if (params.search) searchParams.append("search", params.search);
    if (params.page) searchParams.append("page", String(params.page));
    if (params.page_size) searchParams.append("page_size", String(params.page_size));

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/communications/templates${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<TemplateListResponse>(response);
  }

  /**
   * Get single template
   *
   * @param id - Template ID
   * @returns Template details
   */
  async getTemplate(id: string): Promise<CommunicationTemplate> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/templates/${id}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<CommunicationTemplate>(response);
  }

  /**
   * Create template
   *
   * @param data - Template data
   * @returns Created template
   */
  async createTemplate(data: CreateTemplateRequest): Promise<CommunicationTemplate> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/templates`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<CommunicationTemplate>(response);
  }

  /**
   * Update template
   *
   * @param id - Template ID
   * @param data - Updated template data
   * @returns Updated template
   */
  async updateTemplate(id: string, data: UpdateTemplateRequest): Promise<CommunicationTemplate> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/templates/${id}`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<CommunicationTemplate>(response);
  }

  /**
   * Delete template
   *
   * @param id - Template ID
   */
  async deleteTemplate(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/templates/${id}`, {
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
   * Render template with variables
   *
   * @param id - Template ID
   * @param variables - Template variables
   * @returns Rendered content
   */
  async renderTemplate(
    id: string,
    variables: Record<string, any>,
  ): Promise<RenderTemplateResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/templates/${id}/render`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ variables }),
    });

    return this.handleResponse<RenderTemplateResponse>(response);
  }

  /**
   * Quick render without template ID
   *
   * @param data - Quick render request
   * @returns Rendered content
   */
  async quickRender(data: QuickRenderRequest): Promise<RenderTemplateResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/render`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<RenderTemplateResponse>(response);
  }

  // ============================================
  // Communication Logs
  // ============================================

  /**
   * List communication logs with filters
   *
   * @param params - Filter parameters
   * @returns Logs and total count
   */
  async listLogs(
    params: ListCommunicationsParams = {},
  ): Promise<{ logs: CommunicationLog[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params.channel) searchParams.append("channel", params.channel);
    if (params.status) searchParams.append("status", params.status);
    if (params.recipient_email) searchParams.append("recipient_email", params.recipient_email);
    if (params.template_id) searchParams.append("template_id", params.template_id);
    if (params.date_from) searchParams.append("date_from", params.date_from);
    if (params.date_to) searchParams.append("date_to", params.date_to);
    if (params.page) searchParams.append("page", String(params.page));
    if (params.page_size) searchParams.append("page_size", String(params.page_size));
    if (params.sort_by) searchParams.append("sort_by", params.sort_by);
    if (params.sort_order) searchParams.append("sort_order", params.sort_order);

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/communications/logs${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<{ logs: CommunicationLog[]; total: number }>(response);
  }

  /**
   * Get single communication log
   *
   * @param id - Log ID
   * @returns Log details
   */
  async getLog(id: string): Promise<CommunicationLog> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/logs/${id}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<CommunicationLog>(response);
  }

  // ============================================
  // Task Monitoring
  // ============================================

  /**
   * Get Celery task status
   *
   * @param taskId - Task ID
   * @returns Task status
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/tasks/${taskId}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<TaskStatusResponse>(response);
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  /**
   * Get communication statistics
   *
   * @param params - Date range and filters
   * @returns Statistics
   */
  async getStatistics(params: StatsParams = {}): Promise<CommunicationStats> {
    const searchParams = new URLSearchParams();
    if (params.date_from) searchParams.append("date_from", params.date_from);
    if (params.date_to) searchParams.append("date_to", params.date_to);
    if (params.channel) searchParams.append("channel", params.channel);

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/communications/stats${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<CommunicationStats>(response);
  }

  /**
   * Get activity timeline
   *
   * @param params - Activity parameters
   * @returns Activity data
   */
  async getRecentActivity(params: ActivityParams = {}): Promise<ActivityResponse> {
    const searchParams = new URLSearchParams();
    if (params.days) searchParams.append("days", String(params.days));
    if (params.channel) searchParams.append("channel", params.channel);

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/communications/activity${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<ActivityResponse>(response);
  }

  /**
   * Get metrics (cached)
   *
   * @returns Metrics
   */
  async getMetrics(): Promise<MetricsResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/metrics`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<MetricsResponse>(response);
  }

  // ============================================
  // Health & Monitoring
  // ============================================

  /**
   * Get health status
   *
   * @returns Health status
   */
  async healthCheck(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/communications/health`, {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      });

      return await this.handleResponse<HealthResponse>(response);
    } catch (error) {
      logger.warn("Communications health endpoint unavailable. Returning fallback response.", {
        message: error instanceof Error ? error.message : String(error),
      });

      return {
        smtp_available: false,
        redis_available: false,
        celery_available: false,
        active_workers: 0,
        pending_tasks: 0,
        failed_tasks: 0,
      };
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Calculate delivery rate
   *
   * @param delivered - Number of delivered emails
   * @param total - Total emails sent
   * @returns Delivery rate percentage
   */
  calculateDeliveryRate(delivered: number, total: number): number {
    if (total === 0) return 100;
    return (delivered / total) * 100;
  }

  /**
   * Calculate bounce rate
   *
   * @param bounced - Number of bounced emails
   * @param total - Total emails sent
   * @returns Bounce rate percentage
   */
  calculateBounceRate(bounced: number, total: number): number {
    if (total === 0) return 0;
    return (bounced / total) * 100;
  }

  /**
   * Get status color for UI
   *
   * @param status - Communication status
   * @returns Color class
   */
  getStatusColor(status: CommunicationStatus): string {
    const colorMap: Record<CommunicationStatus, string> = {
      [CommunicationStatus.PENDING]: "bg-gray-500",
      [CommunicationStatus.QUEUED]: "bg-blue-500",
      [CommunicationStatus.SENDING]: "bg-blue-600",
      [CommunicationStatus.SENT]: "bg-green-500",
      [CommunicationStatus.DELIVERED]: "bg-green-600",
      [CommunicationStatus.FAILED]: "bg-red-500",
      [CommunicationStatus.BOUNCED]: "bg-orange-500",
      [CommunicationStatus.OPENED]: "bg-purple-500",
      [CommunicationStatus.CLICKED]: "bg-purple-600",
    };
    return colorMap[status] || "bg-gray-500";
  }

  /**
   * Format recipients for display
   *
   * @param recipients - Array of email addresses
   * @param maxDisplay - Maximum to display
   * @returns Formatted string
   */
  formatRecipients(recipients: string[], maxDisplay: number = 3): string {
    if (recipients.length === 0) return "No recipients";
    if (recipients.length <= maxDisplay) return recipients.join(", ");
    return `${recipients.slice(0, maxDisplay).join(", ")} +${recipients.length - maxDisplay} more`;
  }
}

// Export singleton instance
export const communicationsService = new CommunicationsService();
