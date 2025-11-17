/**
 * MSW Tests for useReconciliation hooks
 * Tests billing reconciliation with realistic API mocking
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import {
  useReconciliations,
  useReconciliation,
  useReconciliationSummary,
  useStartReconciliation,
  useAddReconciledPayment,
  useCompleteReconciliation,
  useApproveReconciliation,
  useRetryFailedPayment,
  useCircuitBreakerStatus,
} from "../useReconciliation";
import {
  seedReconciliationData,
  clearReconciliationData,
  createMockReconciliation,
  createMockReconciledItem,
  createMockSummary,
  setCircuitBreakerState,
} from "@/__tests__/msw/handlers/reconciliation";
import type { ReconciliationResponse } from "@/lib/services/reconciliation-service";

const waitForSuccess = async (getStatus: () => boolean) => {
  await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
};

// Mock useToast to avoid UI dependencies
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useReconciliation hooks (MSW)", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          staleTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    clearReconciliationData();
  });

  // ============================================================================
  // Query Hooks
  // ============================================================================

  describe("useReconciliations", () => {
    it("fetches reconciliations list successfully", async () => {
      const mockReconciliations = [
        createMockReconciliation({
          id: 1,
          bank_account_id: 100,
          status: "pending",
        }),
        createMockReconciliation({
          id: 2,
          bank_account_id: 100,
          status: "completed",
        }),
      ];

      seedReconciliationData(mockReconciliations);

      const { result } = renderHook(() => useReconciliations(), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.reconciliations).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
    });

    it("filters by bank account ID", async () => {
      const mockReconciliations = [
        createMockReconciliation({
          id: 1,
          bank_account_id: 100,
        }),
        createMockReconciliation({
          id: 2,
          bank_account_id: 200,
        }),
      ];

      seedReconciliationData(mockReconciliations);

      const { result } = renderHook(
        () => useReconciliations({ bank_account_id: 100 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.reconciliations).toHaveLength(1);
      expect(result.current.data?.reconciliations[0].bank_account_id).toBe(100);
    });

    it("filters by status", async () => {
      const mockReconciliations = [
        createMockReconciliation({
          id: 1,
          status: "pending",
        }),
        createMockReconciliation({
          id: 2,
          status: "completed",
        }),
        createMockReconciliation({
          id: 3,
          status: "approved",
        }),
      ];

      seedReconciliationData(mockReconciliations);

      const { result } = renderHook(
        () => useReconciliations({ status: "completed" }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.reconciliations).toHaveLength(1);
      expect(result.current.data?.reconciliations[0].status).toBe("completed");
    });

    it("supports pagination", async () => {
      const mockReconciliations = Array.from({ length: 25 }, (_, i) =>
        createMockReconciliation({ id: i + 1 })
      );

      seedReconciliationData(mockReconciliations);

      const { result } = renderHook(
        () => useReconciliations({ page: 2, page_size: 10 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.reconciliations).toHaveLength(10);
      expect(result.current.data?.page).toBe(2);
      expect(result.current.data?.total).toBe(25);
      expect(result.current.data?.pages).toBe(3);
    });
  });

  describe("useReconciliation", () => {
    it("fetches single reconciliation successfully", async () => {
      const mockReconciliation = createMockReconciliation({
        id: 1,
        status: "pending",
        discrepancy_amount: 100,
      });

      seedReconciliationData([mockReconciliation]);

      const { result } = renderHook(() => useReconciliation(1), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.id).toBe(1);
      expect(result.current.data?.status).toBe("pending");
      expect(result.current.data?.discrepancy_amount).toBe(100);
    });

    it("handles reconciliation not found", async () => {
      seedReconciliationData([]);

      const { result } = renderHook(() => useReconciliation(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useReconciliationSummary", () => {
    it("fetches summary statistics", async () => {
      const mockReconciliations = [
        createMockReconciliation({
          id: 1,
          status: "pending",
          discrepancy_amount: 50,
        }),
        createMockReconciliation({
          id: 2,
          status: "completed",
          discrepancy_amount: 100,
        }),
        createMockReconciliation({
          id: 3,
          status: "approved",
          discrepancy_amount: 75,
        }),
      ];

      seedReconciliationData(mockReconciliations);

      const { result } = renderHook(() => useReconciliationSummary(), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.total_reconciliations).toBe(3);
      expect(result.current.data?.pending_reconciliations).toBe(1);
      expect(result.current.data?.completed_reconciliations).toBe(2); // completed + approved
      expect(result.current.data?.total_discrepancy).toBe(225); // 50 + 100 + 75
    });

    it("filters summary by bank account", async () => {
      const mockReconciliations = [
        createMockReconciliation({
          id: 1,
          bank_account_id: 100,
        }),
        createMockReconciliation({
          id: 2,
          bank_account_id: 200,
        }),
      ];

      seedReconciliationData(mockReconciliations);

      const { result } = renderHook(
        () => useReconciliationSummary({ bank_account_id: 100 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.total_reconciliations).toBe(1);
    });
  });

  // ============================================================================
  // Mutation Hooks - Reconciliation Workflow
  // ============================================================================

  describe("useStartReconciliation", () => {
    it("starts new reconciliation successfully", async () => {
      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper: createWrapper(),
      });

      let reconciliation: ReconciliationResponse | undefined;

      await act(async () => {
        reconciliation = await result.current.mutateAsync({
          bank_account_id: 100,
          period_start: "2024-01-01T00:00:00Z",
          period_end: "2024-01-31T23:59:59Z",
          opening_balance: 10000,
          statement_balance: 10500,
          notes: "January reconciliation",
        });
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(reconciliation?.bank_account_id).toBe(100);
      expect(reconciliation?.status).toBe("pending");
      expect(reconciliation?.opening_balance).toBe(10000);
      expect(reconciliation?.statement_balance).toBe(10500);
    });

    it("creates reconciliation with file attachment", async () => {
      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper: createWrapper(),
      });

      let reconciliation: ReconciliationResponse | undefined;

      await act(async () => {
        reconciliation = await result.current.mutateAsync({
          bank_account_id: 100,
          period_start: "2024-01-01T00:00:00Z",
          period_end: "2024-01-31T23:59:59Z",
          opening_balance: 10000,
          statement_balance: 10500,
          statement_file_url: "https://example.com/statement.pdf",
        });
      });

      expect(reconciliation?.statement_file_url).toBe(
        "https://example.com/statement.pdf"
      );
    });
  });

  describe("useAddReconciledPayment", () => {
    it("adds payment to reconciliation", async () => {
      const mockReconciliation = createMockReconciliation({
        id: 1,
        status: "pending",
        reconciled_items: [],
      });

      seedReconciliationData([mockReconciliation]);

      const { result } = renderHook(() => useAddReconciledPayment(), {
        wrapper: createWrapper(),
      });

      let updated: ReconciliationResponse | undefined;

      await act(async () => {
        updated = await result.current.mutateAsync({
          reconciliationId: 1,
          paymentData: {
            payment_id: 5001,
            notes: "Matched bank deposit",
          },
        });
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(updated?.reconciled_items).toHaveLength(1);
      expect(updated?.reconciled_items[0].payment_id).toBe(5001);
    });

    it("handles adding payment to non-existent reconciliation", async () => {
      seedReconciliationData([]);

      const { result } = renderHook(() => useAddReconciledPayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            reconciliationId: 999,
            paymentData: {
              payment_id: 5001,
            },
          });
        } catch (error) {
          // Expected to fail
        }
      });

      expect(result.current.isError).toBe(true);
    });
  });

  describe("useCompleteReconciliation", () => {
    it("completes reconciliation successfully", async () => {
      const mockReconciliation = createMockReconciliation({
        id: 1,
        status: "pending",
        completed_by: null,
        completed_at: null,
      });

      seedReconciliationData([mockReconciliation]);

      const { result } = renderHook(() => useCompleteReconciliation(), {
        wrapper: createWrapper(),
      });

      let completed: ReconciliationResponse | undefined;

      await act(async () => {
        completed = await result.current.mutateAsync({
          reconciliationId: 1,
          data: {
            notes: "All payments reconciled",
          },
        });
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(completed?.status).toBe("completed");
      expect(completed?.completed_by).toBe("user-1");
      expect(completed?.completed_at).toBeTruthy();
      expect(completed?.notes).toBe("All payments reconciled");
    });

    it("updates existing notes when completing", async () => {
      const mockReconciliation = createMockReconciliation({
        id: 1,
        status: "pending",
        notes: "Initial notes",
      });

      seedReconciliationData([mockReconciliation]);

      const { result } = renderHook(() => useCompleteReconciliation(), {
        wrapper: createWrapper(),
      });

      let completed: ReconciliationResponse | undefined;

      await act(async () => {
        completed = await result.current.mutateAsync({
          reconciliationId: 1,
          data: {
            notes: "Updated completion notes",
          },
        });
      });

      expect(completed?.notes).toBe("Updated completion notes");
    });
  });

  describe("useApproveReconciliation", () => {
    it("approves completed reconciliation", async () => {
      const mockReconciliation = createMockReconciliation({
        id: 1,
        status: "completed",
        completed_by: "user-1",
        completed_at: new Date().toISOString(),
        approved_by: null,
        approved_at: null,
      });

      seedReconciliationData([mockReconciliation]);

      const { result } = renderHook(() => useApproveReconciliation(), {
        wrapper: createWrapper(),
      });

      let approved: ReconciliationResponse | undefined;

      await act(async () => {
        approved = await result.current.mutateAsync({
          reconciliationId: 1,
          data: {
            notes: "Approved by manager",
          },
        });
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(approved?.status).toBe("approved");
      expect(approved?.approved_by).toBe("approver-1");
      expect(approved?.approved_at).toBeTruthy();
      expect(approved?.notes).toBe("Approved by manager");
    });

    it("rejects approval of pending reconciliation", async () => {
      const mockReconciliation = createMockReconciliation({
        id: 1,
        status: "pending",
      });

      seedReconciliationData([mockReconciliation]);

      const { result } = renderHook(() => useApproveReconciliation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            reconciliationId: 1,
            data: {},
          });
        } catch (error) {
          // Expected to fail
        }
      });

      expect(result.current.isError).toBe(true);
    });
  });

  // ============================================================================
  // Payment Recovery Hooks
  // ============================================================================

  describe("useRetryFailedPayment", () => {
    it("retries failed payment successfully", async () => {
      setCircuitBreakerState(false, 0);

      const { result } = renderHook(() => useRetryFailedPayment(), {
        wrapper: createWrapper(),
      });

      let retryResult: any;

      await act(async () => {
        retryResult = await result.current.mutateAsync({
          payment_id: 5001,
          max_attempts: 3,
        });
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(retryResult.payment_id).toBe(5001);
      expect(typeof retryResult.success).toBe("boolean");
    });

    it("handles retry with circuit breaker open", async () => {
      setCircuitBreakerState(true, 5);

      const { result } = renderHook(() => useRetryFailedPayment(), {
        wrapper: createWrapper(),
      });

      let retryResult: any;

      await act(async () => {
        retryResult = await result.current.mutateAsync({
          payment_id: 5001,
        });
      });

      await waitForSuccess(() => result.current.isSuccess);

      // When circuit breaker is open, retries should fail
      expect(retryResult.success).toBe(false);
      expect(retryResult.last_error).toBeTruthy();
    });
  });

  describe("useCircuitBreakerStatus", () => {
    it("fetches circuit breaker status when closed", async () => {
      setCircuitBreakerState(false, 0);

      const { result } = renderHook(() => useCircuitBreakerStatus(), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.state).toBe("closed");
      expect(result.current.data?.failure_count).toBe(0);
    });

    it("fetches circuit breaker status when open", async () => {
      setCircuitBreakerState(true, 5);

      const { result } = renderHook(() => useCircuitBreakerStatus(), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.state).toBe("open");
      expect(result.current.data?.failure_count).toBe(5);
      expect(result.current.data?.last_failure_time).toBeTruthy();
      expect(result.current.data?.next_retry_time).toBeTruthy();
    });
  });

  // ============================================================================
  // Integration Tests - Complete Workflows
  // ============================================================================

  describe("Complete reconciliation workflow", () => {
    it("handles full reconciliation lifecycle", async () => {
      const wrapper = createWrapper();

      // Step 1: Start reconciliation
      const { result: startResult } = renderHook(() => useStartReconciliation(), {
        wrapper,
      });

      let reconciliation: ReconciliationResponse | undefined;

      await act(async () => {
        reconciliation = await startResult.current.mutateAsync({
          bank_account_id: 100,
          period_start: "2024-01-01T00:00:00Z",
          period_end: "2024-01-31T23:59:59Z",
          opening_balance: 10000,
          statement_balance: 10500,
        });
      });

      expect(reconciliation?.status).toBe("pending");
      const reconciliationId = reconciliation!.id;

      // Step 2: Add reconciled payments
      const { result: addPaymentResult } = renderHook(
        () => useAddReconciledPayment(),
        { wrapper }
      );

      await act(async () => {
        reconciliation = await addPaymentResult.current.mutateAsync({
          reconciliationId,
          paymentData: { payment_id: 5001 },
        });
      });

      expect(reconciliation?.reconciled_items).toHaveLength(1);

      // Step 3: Complete reconciliation
      const { result: completeResult } = renderHook(
        () => useCompleteReconciliation(),
        { wrapper }
      );

      await act(async () => {
        reconciliation = await completeResult.current.mutateAsync({
          reconciliationId,
          data: { notes: "Completed" },
        });
      });

      expect(reconciliation?.status).toBe("completed");
      expect(reconciliation?.completed_by).toBeTruthy();

      // Step 4: Approve reconciliation
      const { result: approveResult } = renderHook(
        () => useApproveReconciliation(),
        { wrapper }
      );

      await act(async () => {
        reconciliation = await approveResult.current.mutateAsync({
          reconciliationId,
          data: { notes: "Approved" },
        });
      });

      expect(reconciliation?.status).toBe("approved");
      expect(reconciliation?.approved_by).toBeTruthy();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("handles zero balance reconciliation", async () => {
      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper: createWrapper(),
      });

      let reconciliation: ReconciliationResponse | undefined;

      await act(async () => {
        reconciliation = await result.current.mutateAsync({
          bank_account_id: 100,
          period_start: "2024-01-01T00:00:00Z",
          period_end: "2024-01-31T23:59:59Z",
          opening_balance: 0,
          statement_balance: 0,
        });
      });

      expect(reconciliation?.opening_balance).toBe(0);
      expect(reconciliation?.statement_balance).toBe(0);
    });

    it("handles large discrepancy amounts", async () => {
      const mockReconciliation = createMockReconciliation({
        id: 1,
        opening_balance: 10000,
        statement_balance: 50000,
        discrepancy_amount: 40000,
      });

      seedReconciliationData([mockReconciliation]);

      const { result } = renderHook(() => useReconciliation(1), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.discrepancy_amount).toBe(40000);
    });

    it("handles empty reconciliation list", async () => {
      seedReconciliationData([]);

      const { result } = renderHook(() => useReconciliations(), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.reconciliations).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });
  });
});
