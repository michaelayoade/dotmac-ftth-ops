/**
 * Audit Service - API client for audit logging
 *
 * Provides methods for:
 * - Querying audit logs
 * - Filtering and searching audit events
 * - Getting audit statistics and summaries
 * - Compliance reporting
 *
 * This service layer uses types from @/types/audit.ts
 * and is designed to work with the Audit hooks.
 */

import { platformConfig } from "@/lib/config";
import { ActivitySeverity } from "@/types/audit";
import type {
  AuditActivity,
  AuditActivityList,
  AuditFilterParams,
  ActivitySummary,
  ActivityType,
} from "@/types/audit";

const API_BASE = platformConfig.api.baseUrl;
const ADMIN_PREFIX = "/api/isp/v1/admin";

// ============================================
// Additional Interfaces
// ============================================

export interface AuditExportRequest {
  filters: AuditFilterParams;
  format: "csv" | "json" | "pdf";
  include_metadata?: boolean;
}

export interface AuditExportResponse {
  export_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  download_url?: string;
  expires_at?: string;
}

export interface ComplianceReport {
  report_id: string;
  period_start: string;
  period_end: string;
  total_events: number;
  critical_events: number;
  failed_access_attempts: number;
  permission_changes: number;
  data_exports: number;
  compliance_score: number;
  issues: Array<{
    severity: ActivitySeverity;
    description: string;
    event_ids: string[];
  }>;
  generated_at: string;
}

// ============================================
// Service Class
// ============================================

class AuditService {
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
  // Audit Log Operations
  // ============================================

  /**
   * List audit activities with pagination and filters
   *
   * @param filters - Optional filters
   * @returns Paginated list of audit activities
   */
  async listActivities(filters: AuditFilterParams = {}): Promise<AuditActivityList> {
    const params = new URLSearchParams();

    if (filters.user_id) params.append("user_id", filters.user_id);
    if (filters.activity_type) params.append("activity_type", filters.activity_type);
    if (filters.severity) params.append("severity", filters.severity);
    if (filters.resource_type) params.append("resource_type", filters.resource_type);
    if (filters.resource_id) params.append("resource_id", filters.resource_id);
    if (filters.days) params.append("days", filters.days.toString());
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.per_page) params.append("per_page", filters.per_page.toString());

    const queryString = params.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/audit/activities${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<AuditActivityList>(response);
  }

  /**
   * Get recent audit activities
   *
   * @param limit - Number of activities to return
   * @param days - Number of days to look back
   * @returns List of recent activities
   */
  async getRecentActivities(limit: number = 20, days: number = 7): Promise<AuditActivity[]> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("days", days.toString());

    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/audit/activities/recent?${params.toString()}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<AuditActivity[]>(response);
  }

  /**
   * Get audit activities for a specific user
   *
   * @param userId - User ID
   * @param limit - Number of activities
   * @param days - Number of days to look back
   * @returns User's audit activities
   */
  async getUserActivities(
    userId: string,
    limit: number = 50,
    days: number = 30,
  ): Promise<AuditActivity[]> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("days", days.toString());

    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/audit/activities/user/${userId}?${params.toString()}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<AuditActivity[]>(response);
  }

  /**
   * Get single activity details
   *
   * @param activityId - Activity ID
   * @returns Activity details
   */
  async getActivity(activityId: string): Promise<AuditActivity> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/audit/activities/${activityId}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<AuditActivity>(response);
  }

  // ============================================
  // Statistics & Summaries
  // ============================================

  /**
   * Get activity summary statistics
   *
   * @param days - Number of days for summary
   * @returns Activity summary
   */
  async getActivitySummary(days: number = 7): Promise<ActivitySummary> {
    const params = new URLSearchParams();
    params.append("days", days.toString());

    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/audit/activities/summary?${params.toString()}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<ActivitySummary>(response);
  }

  /**
   * Get resource history
   *
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @returns Resource audit logs
   */
  async getResourceHistory(resourceType: string, resourceId: string): Promise<AuditActivity[]> {
    const filters: AuditFilterParams = {
      resource_type: resourceType,
      resource_id: resourceId,
      per_page: 100,
    };

    const result = await this.listActivities(filters);
    return result.activities;
  }

  // ============================================
  // Compliance & Export
  // ============================================

  /**
   * Export audit logs
   *
   * @param request - Export request
   * @returns Export response with download URL
   */
  async exportLogs(request: AuditExportRequest): Promise<AuditExportResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/audit/export`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(request),
    });

    return this.handleResponse<AuditExportResponse>(response);
  }

  /**
   * Get compliance report
   *
   * @param fromDate - Start date (ISO format)
   * @param toDate - End date (ISO format)
   * @returns Compliance report
   */
  async getComplianceReport(fromDate: string, toDate: string): Promise<ComplianceReport> {
    const params = new URLSearchParams();
    params.append("from_date", fromDate);
    params.append("to_date", toDate);

    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/audit/compliance?${params.toString()}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<ComplianceReport>(response);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get severity color for UI
   *
   * @param severity - Audit severity
   * @returns Color class
   */
  getSeverityColor(severity: ActivitySeverity): string {
    const colorMap: Record<ActivitySeverity, string> = {
      [ActivitySeverity.LOW]: "bg-blue-500",
      [ActivitySeverity.MEDIUM]: "bg-yellow-500",
      [ActivitySeverity.HIGH]: "bg-orange-500",
      [ActivitySeverity.CRITICAL]: "bg-red-500",
    };
    return colorMap[severity] || "bg-gray-500";
  }

  /**
   * Get event type icon name
   *
   * @param eventType - Event type
   * @returns Icon name
   */
  getEventTypeIcon(eventType: string): string {
    if (eventType.startsWith("user.")) return "user";
    if (eventType.startsWith("rbac.")) return "shield";
    if (eventType.startsWith("secret.")) return "key";
    if (eventType.startsWith("file.")) return "file";
    if (eventType.startsWith("customer.")) return "building";
    if (eventType.startsWith("api.")) return "zap";
    if (eventType.startsWith("system.")) return "settings";
    if (eventType.startsWith("frontend.")) return "monitor";
    return "activity";
  }

  /**
   * Format date range for display
   *
   * @param fromDate - Start date
   * @param toDate - End date
   * @returns Formatted date range
   */
  formatDateRange(fromDate: string, toDate: string): string {
    const from = new Date(fromDate).toLocaleDateString();
    const to = new Date(toDate).toLocaleDateString();
    return `${from} - ${to}`;
  }

  /**
   * Calculate success rate
   *
   * @param successful - Number of successful events
   * @param total - Total events
   * @returns Success rate percentage
   */
  calculateSuccessRate(successful: number, total: number): number {
    if (total === 0) return 100;
    return (successful / total) * 100;
  }

  /**
   * Format activity type for display
   *
   * @param type - Activity type
   * @returns Formatted string
   */
  formatActivityType(type: string): string {
    return type
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" > ");
  }
}

// Export singleton instance
export const auditService = new AuditService();
