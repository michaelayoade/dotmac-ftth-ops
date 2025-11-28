/**
 * Billing Reconciliation Service
 * Handles API calls for payment reconciliation and recovery
 */

import { platformConfig } from "../config";

const ADMIN_PREFIX = "/api/isp/v1/admin";

// ============================================
// Types matching backend schemas
// ============================================

export interface ReconciliationStart {
  bank_account_id: number;
  period_start: string; // ISO datetime
  period_end: string; // ISO datetime
  opening_balance: number;
  statement_balance: number;
  statement_file_url?: string | null;
  notes?: string | null;
}

export interface ReconcilePaymentRequest {
  payment_id: number;
  notes?: string | null;
}

export interface ReconciliationComplete {
  notes?: string | null;
}

export interface ReconciliationApprove {
  notes?: string | null;
}

export interface ReconciledItem {
  payment_id: number;
  payment_reference: string;
  amount: number;
  reconciled_at: string;
  reconciled_by: string;
  notes: string | null;
}

export interface ReconciliationResponse {
  id: number;
  tenant_id: string;
  reconciliation_date: string;
  period_start: string;
  period_end: string;
  bank_account_id: number;

  // Balances
  opening_balance: number;
  closing_balance: number;
  statement_balance: number;

  // Totals
  total_deposits: number;
  total_withdrawals: number;
  unreconciled_count: number;
  discrepancy_amount: number;

  // Status
  status: string;

  // Approval tracking
  completed_by: string | null;
  completed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;

  // Additional info
  notes: string | null;
  statement_file_url: string | null;
  reconciled_items: ReconciledItem[];
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface ReconciliationListResponse {
  reconciliations: ReconciliationResponse[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ReconciliationSummary {
  total_reconciliations: number;
  pending_reconciliations: number;
  completed_reconciliations: number;
  total_discrepancy: number;
  avg_discrepancy: number;
  last_reconciliation_date: string | null;
}

export interface PaymentRetryRequest {
  payment_id: number;
  max_attempts?: number;
}

export interface PaymentRetryResponse {
  payment_id: number;
  success: boolean;
  attempts: number;
  last_error: string | null;
  retry_at: string | null;
}

// ============================================
// Service Class
// ============================================

class ReconciliationService {
  private baseUrl = platformConfig.api.baseUrl;

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  // ==================== Reconciliation Sessions ====================

  async startReconciliation(data: ReconciliationStart): Promise<ReconciliationResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to start reconciliation");
    }

    return response.json();
  }

  async listReconciliations(params?: {
    bank_account_id?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<ReconciliationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.bank_account_id)
      searchParams.append("bank_account_id", params.bank_account_id.toString());
    if (params?.status) searchParams.append("status", params.status);
    if (params?.start_date) searchParams.append("start_date", params.start_date);
    if (params?.end_date) searchParams.append("end_date", params.end_date);
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.page_size) searchParams.append("page_size", params.page_size.toString());

    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations?${searchParams.toString()}`,
      {
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to list reconciliations");
    }

    return response.json();
  }

  async getReconciliationSummary(params?: {
    bank_account_id?: number;
    days?: number;
  }): Promise<ReconciliationSummary> {
    const searchParams = new URLSearchParams();
    if (params?.bank_account_id)
      searchParams.append("bank_account_id", params.bank_account_id.toString());
    if (params?.days) searchParams.append("days", params.days.toString());

    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations/summary?${searchParams.toString()}`,
      {
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to get reconciliation summary");
    }

    return response.json();
  }

  async getReconciliation(reconciliationId: number): Promise<ReconciliationResponse> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations/${reconciliationId}`,
      {
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to get reconciliation");
    }

    return response.json();
  }

  // ==================== Reconciliation Operations ====================

  async addReconciledPayment(
    reconciliationId: number,
    paymentData: ReconcilePaymentRequest,
  ): Promise<ReconciliationResponse> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations/${reconciliationId}/payments`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(paymentData),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to add reconciled payment");
    }

    return response.json();
  }

  async completeReconciliation(
    reconciliationId: number,
    data: ReconciliationComplete,
  ): Promise<ReconciliationResponse> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations/${reconciliationId}/complete`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to complete reconciliation");
    }

    return response.json();
  }

  async approveReconciliation(
    reconciliationId: number,
    data: ReconciliationApprove,
  ): Promise<ReconciliationResponse> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations/${reconciliationId}/approve`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to approve reconciliation");
    }

    return response.json();
  }

  // ==================== Recovery & Retry ====================

  async retryFailedPayment(request: PaymentRetryRequest): Promise<PaymentRetryResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations/retry-payment`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to retry payment");
    }

    return response.json();
  }

  async getCircuitBreakerStatus(): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/billing/reconciliations/circuit-breaker/status`,
      {
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to get circuit breaker status");
    }

    return response.json();
  }
}

export const reconciliationService = new ReconciliationService();
