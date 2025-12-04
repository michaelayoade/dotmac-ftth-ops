/**
 * MSW Handlers for Reconciliation API
 * Mocks billing reconciliation and payment recovery endpoints
 */

import { http, HttpResponse } from "msw";
import type {
  ReconciliationStart,
  ReconcilePaymentRequest,
  ReconciliationComplete,
  ReconciliationApprove,
  ReconciliationResponse,
  ReconciliationListResponse,
  ReconciliationSummary,
  PaymentRetryRequest,
  PaymentRetryResponse,
  ReconciledItem,
} from "@/lib/services/reconciliation-service";

// ============================================
// In-Memory Storage
// ============================================

let reconciliations: ReconciliationResponse[] = [];
let circuitBreakerOpen = false;
let circuitBreakerFailureCount = 0;

// ============================================
// Mock Data Generators
// ============================================

export function createMockReconciliation(
  overrides: Partial<ReconciliationResponse> = {},
): ReconciliationResponse {
  const id = overrides.id || Math.floor(Math.random() * 10000);
  const openingBalance = overrides.opening_balance || 10000;
  const statementBalance = overrides.statement_balance || 10500;
  const totalDeposits = overrides.total_deposits || 1500;
  const totalWithdrawals = overrides.total_withdrawals || 1000;
  const closingBalance = openingBalance + totalDeposits - totalWithdrawals;
  const discrepancyAmount = statementBalance - closingBalance;

  return {
    id,
    tenant_id: "tenant-1",
    reconciliation_date: new Date().toISOString(),
    period_start: "2024-01-01T00:00:00Z",
    period_end: "2024-01-31T23:59:59Z",
    bank_account_id: 1,
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    statement_balance: statementBalance,
    total_deposits: totalDeposits,
    total_withdrawals: totalWithdrawals,
    unreconciled_count: 0,
    discrepancy_amount: discrepancyAmount,
    status: "pending",
    completed_by: null,
    completed_at: null,
    approved_by: null,
    approved_at: null,
    notes: null,
    statement_file_url: null,
    reconciled_items: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

export function createMockReconciledItem(overrides: Partial<ReconciledItem> = {}): ReconciledItem {
  return {
    payment_id: Math.floor(Math.random() * 10000),
    payment_reference: `PAY-${Date.now()}`,
    amount: 100,
    reconciled_at: new Date().toISOString(),
    reconciled_by: "user-1",
    notes: null,
    ...overrides,
  };
}

export function createMockSummary(
  overrides: Partial<ReconciliationSummary> = {},
): ReconciliationSummary {
  return {
    total_reconciliations: 10,
    pending_reconciliations: 3,
    completed_reconciliations: 7,
    total_discrepancy: 500,
    avg_discrepancy: 50,
    last_reconciliation_date: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// Storage Helpers
// ============================================

export function seedReconciliationData(initialReconciliations: ReconciliationResponse[]): void {
  reconciliations = [...initialReconciliations];
}

export function clearReconciliationData(): void {
  reconciliations = [];
  circuitBreakerOpen = false;
  circuitBreakerFailureCount = 0;
}

export function getReconciliations(): ReconciliationResponse[] {
  return [...reconciliations];
}

export function setCircuitBreakerState(open: boolean, failureCount: number = 0): void {
  circuitBreakerOpen = open;
  circuitBreakerFailureCount = failureCount;
}

// ============================================
// MSW Handlers
// ============================================

export const reconciliationHandlers = [
  // GET /api/v1/billing/reconciliations/summary - MUST come before /:id route
  http.get("*/api/v1/billing/reconciliations/summary", ({ request, params }) => {
    const url = new URL(request.url);
    const bankAccountId = url.searchParams.get("bank_account_id");
    const days = url.searchParams.get("days");

    console.log("[MSW] GET /api/v1/billing/reconciliations/summary", {
      bankAccountId,
      days,
    });

    // Filter by bank account if provided
    let filtered = [...reconciliations];
    if (bankAccountId) {
      filtered = filtered.filter((r) => r.bank_account_id === parseInt(bankAccountId));
    }

    // Filter by days if provided
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
      filtered = filtered.filter((r) => new Date(r.reconciliation_date) >= cutoffDate);
    }

    // Build summary
    const summary: ReconciliationSummary = {
      total_reconciliations: filtered.length,
      pending_reconciliations: filtered.filter((r) => r.status === "pending").length,
      completed_reconciliations: filtered.filter(
        (r) => r.status === "completed" || r.status === "approved",
      ).length,
      total_discrepancy: filtered.reduce((sum, r) => sum + Math.abs(r.discrepancy_amount), 0),
      avg_discrepancy:
        filtered.length > 0
          ? filtered.reduce((sum, r) => sum + Math.abs(r.discrepancy_amount), 0) / filtered.length
          : 0,
      last_reconciliation_date:
        filtered.length > 0
          ? filtered.sort(
              (a, b) =>
                new Date(b.reconciliation_date).getTime() -
                new Date(a.reconciliation_date).getTime(),
            )[0].reconciliation_date
          : null,
    };

    console.log("[MSW] Returning summary:", summary);
    return HttpResponse.json(summary);
  }),

  // GET /api/v1/billing/reconciliations/circuit-breaker/status - MUST come before /:id route
  http.get("*/api/v1/billing/reconciliations/circuit-breaker/status", ({ request, params }) => {
    console.log("[MSW] GET /api/v1/billing/reconciliations/circuit-breaker/status");

    const status = {
      state: circuitBreakerOpen ? "open" : "closed",
      failure_count: circuitBreakerFailureCount,
      last_failure_time: circuitBreakerOpen ? new Date().toISOString() : null,
      next_retry_time: circuitBreakerOpen ? new Date(Date.now() + 60000).toISOString() : null,
    };

    console.log("[MSW] Circuit breaker status:", status);
    return HttpResponse.json(status);
  }),

  // POST /api/v1/billing/reconciliations/retry-payment - MUST come before /:id route
  http.post("*/api/v1/billing/reconciliations/retry-payment", async ({ request, params }) => {
    const retryRequest = await request.json<PaymentRetryRequest>();

    console.log("[MSW] POST /api/v1/billing/reconciliations/retry-payment", {
      retryRequest,
    });

    // Simulate retry logic
    const success = !circuitBreakerOpen && Math.random() > 0.3; // 70% success rate when circuit closed

    const response: PaymentRetryResponse = {
      payment_id: retryRequest.payment_id,
      success,
      attempts: success ? 1 : retryRequest.max_attempts || 3,
      last_error: success ? null : "Payment gateway timeout",
      retry_at: success ? null : new Date(Date.now() + 300000).toISOString(),
    };

    console.log("[MSW] Retry result:", response);
    return HttpResponse.json(response);
  }),

  // GET /api/v1/billing/reconciliations - List reconciliations
  http.get("*/api/v1/billing/reconciliations", ({ request, params }) => {
    const url = new URL(request.url);
    const bankAccountId = url.searchParams.get("bank_account_id");
    const status = url.searchParams.get("status");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "20");

    console.log("[MSW] GET /api/v1/billing/reconciliations", {
      bankAccountId,
      status,
      startDate,
      endDate,
      page,
      pageSize,
    });

    // Apply filters
    let filtered = [...reconciliations];

    if (bankAccountId) {
      filtered = filtered.filter((r) => r.bank_account_id === parseInt(bankAccountId));
    }

    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    if (startDate) {
      filtered = filtered.filter((r) => new Date(r.period_start) >= new Date(startDate));
    }

    if (endDate) {
      filtered = filtered.filter((r) => new Date(r.period_end) <= new Date(endDate));
    }

    // Pagination
    const total = filtered.length;
    const pages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    const response: ReconciliationListResponse = {
      reconciliations: paginated,
      total,
      page,
      page_size: pageSize,
      pages,
    };

    console.log(`[MSW] Returning ${paginated.length}/${total} reconciliations`);
    return HttpResponse.json(response);
  }),

  // POST /api/v1/billing/reconciliations - Start reconciliation
  http.post("*/api/v1/billing/reconciliations", async ({ request, params }) => {
    const startData = await request.json<ReconciliationStart>();

    console.log("[MSW] POST /api/v1/billing/reconciliations", { startData });

    const newReconciliation = createMockReconciliation({
      id: reconciliations.length + 1,
      bank_account_id: startData.bank_account_id,
      period_start: startData.period_start,
      period_end: startData.period_end,
      opening_balance: startData.opening_balance,
      statement_balance: startData.statement_balance,
      statement_file_url: startData.statement_file_url,
      notes: startData.notes,
      status: "pending",
    });

    reconciliations.push(newReconciliation);

    console.log("[MSW] Created reconciliation:", newReconciliation.id);
    return HttpResponse.json(newReconciliation);
  }),

  // GET /api/v1/billing/reconciliations/:id - Get single reconciliation
  http.get("*/api/v1/billing/reconciliations/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] GET /api/v1/billing/reconciliations/:id", { id });

    const reconciliation = reconciliations.find((r) => r.id === parseInt(id as string));

    if (!reconciliation) {
      return HttpResponse.json({ detail: "Reconciliation not found" }, { status: 404 });
    }

    return HttpResponse.json(reconciliation);
  }),

  // POST /api/v1/billing/reconciliations/:id/payments - Add reconciled payment
  http.post("*/api/v1/billing/reconciliations/:id/payments", async ({ request, params }) => {
    const { id } = params;
    const paymentData = await request.json<ReconcilePaymentRequest>();

    console.log("[MSW] POST /api/v1/billing/reconciliations/:id/payments", {
      id,
      paymentData,
    });

    const reconciliation = reconciliations.find((r) => r.id === parseInt(id as string));

    if (!reconciliation) {
      return HttpResponse.json({ detail: "Reconciliation not found" }, { status: 404 });
    }

    // Add reconciled item
    const reconciledItem = createMockReconciledItem({
      payment_id: paymentData.payment_id,
      notes: paymentData.notes,
    });

    reconciliation.reconciled_items.push(reconciledItem);
    reconciliation.updated_at = new Date().toISOString();

    console.log("[MSW] Added payment to reconciliation:", reconciledItem);
    return HttpResponse.json(reconciliation);
  }),

  // POST /api/v1/billing/reconciliations/:id/complete - Complete reconciliation
  http.post("*/api/v1/billing/reconciliations/:id/complete", async ({ request, params }) => {
    const { id } = params;
    const completeData = await request.json<ReconciliationComplete>();

    console.log("[MSW] POST /api/v1/billing/reconciliations/:id/complete", {
      id,
      completeData,
    });

    const reconciliation = reconciliations.find((r) => r.id === parseInt(id as string));

    if (!reconciliation) {
      return HttpResponse.json({ detail: "Reconciliation not found" }, { status: 404 });
    }

    // Update to completed status
    reconciliation.status = "completed";
    reconciliation.completed_by = "user-1";
    reconciliation.completed_at = new Date().toISOString();
    reconciliation.notes = completeData.notes || reconciliation.notes;
    reconciliation.updated_at = new Date().toISOString();

    console.log("[MSW] Completed reconciliation:", reconciliation.id);
    return HttpResponse.json(reconciliation);
  }),

  // POST /api/v1/billing/reconciliations/:id/approve - Approve reconciliation
  http.post("*/api/v1/billing/reconciliations/:id/approve", async ({ request, params }) => {
    const { id } = params;
    const approveData = await request.json<ReconciliationApprove>();

    console.log("[MSW] POST /api/v1/billing/reconciliations/:id/approve", {
      id,
      approveData,
    });

    const reconciliation = reconciliations.find((r) => r.id === parseInt(id as string));

    if (!reconciliation) {
      return HttpResponse.json({ detail: "Reconciliation not found" }, { status: 404 });
    }

    // Must be completed before approval
    if (reconciliation.status !== "completed") {
      return HttpResponse.json(
        { detail: "Reconciliation must be completed before approval" },
        { status: 400 },
      );
    }

    // Update to approved status
    reconciliation.status = "approved";
    reconciliation.approved_by = "approver-1";
    reconciliation.approved_at = new Date().toISOString();
    reconciliation.notes = approveData.notes || reconciliation.notes;
    reconciliation.updated_at = new Date().toISOString();

    console.log("[MSW] Approved reconciliation:", reconciliation.id);
    return HttpResponse.json(reconciliation);
  }),
];
