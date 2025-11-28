/**
 * Usage Billing Service - API client for usage billing management
 *
 * Provides methods for:
 * - Managing usage records (metered services)
 * - Tracking usage statistics
 * - Managing usage aggregates
 * - Pay-as-you-go billing operations
 */

import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;
const ADMIN_PREFIX = "/api/isp/v1/admin";

// ============================================
// Type Definitions
// ============================================

export type UsageType =
  | "data_transfer"
  | "voice_minutes"
  | "sms_count"
  | "bandwidth_gb"
  | "overage_gb"
  | "static_ip"
  | "equipment_rental"
  | "installation_fee"
  | "custom";

export type BilledStatus = "pending" | "billed" | "error" | "excluded";

export type PeriodType = "hourly" | "daily" | "monthly";

export interface UsageRecord {
  id: string;
  tenant_id: string;
  subscription_id: string;
  customer_id: string;
  customer_name?: string;
  usage_type: UsageType;
  quantity: number;
  unit: string;
  unit_price: number; // in cents
  total_amount: number; // in cents
  currency: string;
  period_start: string;
  period_end: string;
  billed_status: BilledStatus;
  invoice_id?: string;
  billed_at?: string;
  source_system: string;
  source_record_id?: string;
  description?: string;
  device_id?: string;
  service_location?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UsageRecordCreate {
  subscription_id: string;
  customer_id?: string;
  usage_type: UsageType;
  quantity: number;
  unit: string;
  unit_price?: number;
  total_amount?: number;
  currency?: string;
  period_start: string;
  period_end: string;
  source_system: string;
  source_record_id?: string;
  description?: string;
  device_id?: string;
  service_location?: string;
  metadata?: Record<string, any>;
}

export interface UsageRecordUpdate {
  quantity?: number;
  unit?: string;
  unit_price?: number;
  total_amount?: number;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UsageAggregate {
  id: string;
  tenant_id: string;
  subscription_id?: string;
  customer_id?: string;
  usage_type: UsageType;
  period_start: string;
  period_end: string;
  period_type: PeriodType;
  total_quantity: number;
  total_amount: number; // in cents
  record_count: number;
  min_quantity?: number;
  max_quantity?: number;
  created_at: string;
}

export interface UsageSummary {
  usage_type: UsageType;
  total_quantity: number;
  total_amount: number; // in cents
  currency: string;
  record_count: number;
  period_start: string;
  period_end: string;
}

export interface UsageStatistics {
  total_records: number;
  total_amount: number; // in cents
  pending_amount: number; // in cents
  billed_amount: number; // in cents
  by_type: Record<string, UsageSummary>;
  period_start: string;
  period_end: string;
}

export interface UsageChartData {
  date: string;
  data_transfer: number;
  voice_minutes: number;
  bandwidth_gb: number;
  overage_gb: number;
}

export interface UsageRecordFilters {
  customer_id?: string;
  subscription_id?: string;
  usage_type?: UsageType;
  billed_status?: BilledStatus;
  period_start?: string;
  period_end?: string;
  limit?: number;
  offset?: number;
}

export interface UsageAggregateFilters {
  customer_id?: string;
  subscription_id?: string;
  usage_type?: UsageType;
  period_type?: PeriodType;
  period_start?: string;
  period_end?: string;
  limit?: number;
  offset?: number;
}

export interface UsageChartFilters {
  period_type: PeriodType;
  days?: number;
  period_start?: string;
  period_end?: string;
}

// ============================================
// Service Class
// ============================================

class UsageBillingService {
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
  // Usage Records Management
  // ============================================

  /**
   * List usage records
   *
   * @param filters - Optional filters
   * @returns List of usage records
   */
  async listUsageRecords(filters: UsageRecordFilters = {}): Promise<UsageRecord[]> {
    const params = new URLSearchParams();

    if (filters.customer_id) {
      params.append("customer_id", filters.customer_id);
    }
    if (filters.subscription_id) {
      params.append("subscription_id", filters.subscription_id);
    }
    if (filters.usage_type) {
      params.append("usage_type", filters.usage_type);
    }
    if (filters.billed_status) {
      params.append("billed_status", filters.billed_status);
    }
    if (filters.period_start) {
      params.append("period_start", filters.period_start);
    }
    if (filters.period_end) {
      params.append("period_end", filters.period_end);
    }
    if (filters.limit !== undefined) {
      params.append("limit", filters.limit.toString());
    }
    if (filters.offset !== undefined) {
      params.append("offset", filters.offset.toString());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/billing/usage/records${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    const data = await this.handleResponse<{ usage_records: UsageRecord[] }>(response);
    return data.usage_records || [];
  }

  /**
   * Get usage record by ID
   *
   * @param recordId - Record UUID
   * @returns Usage record details
   */
  async getUsageRecord(recordId: string): Promise<UsageRecord> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/usage/records/${recordId}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<UsageRecord>(response);
  }

  /**
   * Create usage record
   *
   * @param data - Record creation data
   * @returns Created usage record
   */
  async createUsageRecord(data: UsageRecordCreate): Promise<UsageRecord> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/usage/records`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<UsageRecord>(response);
  }

  /**
   * Create multiple usage records
   *
   * @param records - Array of record creation data
   * @returns Created usage records
   */
  async createUsageRecordsBulk(records: UsageRecordCreate[]): Promise<UsageRecord[]> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/usage/records/bulk`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ records }),
    });

    const data = await this.handleResponse<{ usage_records: UsageRecord[] }>(response);
    return data.usage_records || [];
  }

  /**
   * Update usage record
   *
   * @param recordId - Record UUID
   * @param data - Update data
   * @returns Updated usage record
   */
  async updateUsageRecord(recordId: string, data: UsageRecordUpdate): Promise<UsageRecord> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/usage/records/${recordId}`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<UsageRecord>(response);
  }

  /**
   * Delete usage record
   *
   * @param recordId - Record UUID
   */
  async deleteUsageRecord(recordId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/usage/records/${recordId}`, {
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
   * Mark usage records as billed
   *
   * @param recordIds - Array of record UUIDs
   * @param invoiceId - Invoice ID
   */
  async markUsageRecordsAsBilled(recordIds: string[], invoiceId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/usage/records/mark-billed`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ usage_ids: recordIds, invoice_id: invoiceId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Exclude usage records from billing
   *
   * @param recordIds - Array of record UUIDs
   */
  async excludeUsageRecordsFromBilling(recordIds: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/usage/records/exclude`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ usage_ids: recordIds }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // ============================================
  // Usage Aggregates
  // ============================================

  /**
   * List usage aggregates
   *
   * @param filters - Optional filters
   * @returns List of usage aggregates
   */
  async listUsageAggregates(filters: UsageAggregateFilters = {}): Promise<UsageAggregate[]> {
    const params = new URLSearchParams();

    if (filters.customer_id) {
      params.append("customer_id", filters.customer_id);
    }
    if (filters.subscription_id) {
      params.append("subscription_id", filters.subscription_id);
    }
    if (filters.usage_type) {
      params.append("usage_type", filters.usage_type);
    }
    if (filters.period_type) {
      params.append("period_type", filters.period_type);
    }
    if (filters.period_start) {
      params.append("period_start", filters.period_start);
    }
    if (filters.period_end) {
      params.append("period_end", filters.period_end);
    }
    if (filters.limit !== undefined) {
      params.append("limit", filters.limit.toString());
    }
    if (filters.offset !== undefined) {
      params.append("offset", filters.offset.toString());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/billing/usage/aggregates${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    const data = await this.handleResponse<{ aggregates: UsageAggregate[] }>(response);
    return data.aggregates || [];
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  /**
   * Get usage statistics
   *
   * @param periodStart - Period start date
   * @param periodEnd - Period end date
   * @returns Usage statistics
   */
  async getUsageStatistics(periodStart?: string, periodEnd?: string): Promise<UsageStatistics> {
    const params = new URLSearchParams();

    if (periodStart) {
      params.append("period_start", periodStart);
    }
    if (periodEnd) {
      params.append("period_end", periodEnd);
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/billing/usage/stats${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<UsageStatistics>(response);
  }

  /**
   * Get usage chart data
   *
   * @param filters - Chart data filters
   * @returns Chart data
   */
  async getUsageChartData(filters: UsageChartFilters): Promise<UsageChartData[]> {
    const params = new URLSearchParams();

    params.append("period_type", filters.period_type);

    if (filters.days !== undefined) {
      params.append("days", filters.days.toString());
    }
    if (filters.period_start) {
      params.append("period_start", filters.period_start);
    }
    if (filters.period_end) {
      params.append("period_end", filters.period_end);
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/billing/usage/analytics/chart${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<UsageChartData[]>(response);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Calculate total amount from quantity and unit price
   *
   * @param quantity - Quantity used
   * @param unitPrice - Unit price in cents
   * @returns Total amount in cents
   */
  calculateTotalAmount(quantity: number, unitPrice: number): number {
    return Math.round(quantity * unitPrice);
  }

  /**
   * Format currency amount
   *
   * @param amount - Amount in cents
   * @param currency - Currency code (default: USD)
   * @returns Formatted currency string
   */
  formatCurrency(amount: number, currency: string = "USD"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  }

  /**
   * Calculate usage percentage
   *
   * @param used - Amount used
   * @param limit - Usage limit
   * @returns Usage percentage
   */
  calculateUsagePercentage(used: number, limit: number): number {
    if (limit === 0) return 100;
    return Math.min((used / limit) * 100, 100);
  }
}

// Export singleton instance
export const usageBillingService = new UsageBillingService();
