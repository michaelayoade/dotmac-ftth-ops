/**
 * Partner Revenue Service - API client for partner revenue management
 *
 * Provides methods for:
 * - Revenue metrics tracking
 * - Commission event management
 * - Payout tracking
 * - Revenue reports
 */

import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

// ============================================
// Type Definitions
// ============================================

export type CommissionStatus = "pending" | "approved" | "paid" | "rejected";
export type PayoutStatus =
  | "pending"
  | "ready"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface PartnerRevenueMetrics {
  partner_id: string;
  period_start: string;
  period_end: string;
  total_commissions: number;
  total_commission_count: number;
  total_payouts: number;
  pending_amount: number;
  currency: string;
}

export interface PartnerCommissionEvent {
  id: string;
  partner_id: string;
  invoice_id?: string;
  customer_id?: string;
  commission_amount: number;
  currency: string;
  base_amount?: number;
  commission_rate?: number;
  status: CommissionStatus;
  event_type: string;
  event_date: string;
  payout_id?: string;
  paid_at?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PartnerPayout {
  id: string;
  partner_id: string;
  total_amount: number;
  currency: string;
  commission_count: number;
  payment_reference?: string;
  payment_method: string;
  status: PayoutStatus;
  payout_date: string;
  completed_at?: string;
  period_start: string;
  period_end: string;
  notes?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface RevenueMetricsFilters {
  period_start?: string | undefined;
  period_end?: string | undefined;
}

export interface CommissionFilters {
  status?: CommissionStatus | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface PayoutFilters {
  status?: PayoutStatus | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================
// Service Class
// ============================================

class PartnerRevenueService {
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
  // Revenue Metrics
  // ============================================

  /**
   * Get revenue metrics for a partner over a time period
   *
   * @param filters - Optional period filters
   * @returns Partner revenue metrics
   */
  async getRevenueMetrics(filters: RevenueMetricsFilters = {}): Promise<PartnerRevenueMetrics> {
    const params = new URLSearchParams();

    if (filters.period_start) {
      params.append("period_start", filters.period_start);
    }
    if (filters.period_end) {
      params.append("period_end", filters.period_end);
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/isp/v1/admin/partners/revenue/metrics${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<PartnerRevenueMetrics>(response);
  }

  // ============================================
  // Commission Events
  // ============================================

  /**
   * List commission events for the current partner
   *
   * @param filters - Optional filters (status, pagination)
   * @returns List of commission events
   */
  async listCommissionEvents(filters: CommissionFilters = {}): Promise<PartnerCommissionEvent[]> {
    const params = new URLSearchParams();

    if (filters.status) {
      params.append("status_filter", filters.status);
    }
    if (filters.limit !== undefined) {
      params.append("limit", filters.limit.toString());
    }
    if (filters.offset !== undefined) {
      params.append("offset", filters.offset.toString());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/isp/v1/admin/partners/revenue/commissions${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<PartnerCommissionEvent[]>(response);
  }

  /**
   * Get details for a specific commission event
   *
   * @param commissionId - Commission event UUID
   * @returns Commission event details
   */
  async getCommissionEvent(commissionId: string): Promise<PartnerCommissionEvent> {
    const response = await fetch(
      `${this.baseUrl}/api/isp/v1/admin/partners/revenue/commissions/${commissionId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<PartnerCommissionEvent>(response);
  }

  // ============================================
  // Payouts
  // ============================================

  /**
   * List payouts for the current partner
   *
   * @param filters - Optional filters (status, pagination)
   * @returns List of payouts
   */
  async listPayouts(filters: PayoutFilters = {}): Promise<PartnerPayout[]> {
    const params = new URLSearchParams();

    if (filters.status) {
      params.append("status_filter", filters.status);
    }
    if (filters.limit !== undefined) {
      params.append("limit", filters.limit.toString());
    }
    if (filters.offset !== undefined) {
      params.append("offset", filters.offset.toString());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/isp/v1/admin/partners/revenue/payouts${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<PartnerPayout[]>(response);
  }

  /**
   * Get details for a specific payout
   *
   * @param payoutId - Payout UUID
   * @returns Payout details
   */
  async getPayout(payoutId: string): Promise<PartnerPayout> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/partners/revenue/payouts/${payoutId}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<PartnerPayout>(response);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Calculate commission amount based on base amount and rate
   *
   * @param baseAmount - Base amount (invoice total)
   * @param commissionRate - Commission rate (0-1)
   * @returns Calculated commission amount
   */
  calculateCommission(baseAmount: number, commissionRate: number): number {
    return baseAmount * commissionRate;
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

  /**
   * Calculate conversion rate
   *
   * @param earned - Amount earned
   * @param potential - Potential amount
   * @returns Conversion rate as percentage
   */
  calculateConversionRate(earned: number, potential: number): number {
    if (potential === 0) return 0;
    return (earned / potential) * 100;
  }
}

// Export singleton instance
export const partnerRevenueService = new PartnerRevenueService();
