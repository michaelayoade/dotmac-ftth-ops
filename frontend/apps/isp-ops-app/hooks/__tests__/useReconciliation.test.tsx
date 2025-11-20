/**
 * Jest Mock Tests for useReconciliation hooks
 * Tests billing reconciliation with Jest mocks
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

// Mock reconciliation service
jest.mock("@/lib/services/reconciliation-service", () => ({
  reconciliationService: {
    listReconciliations: jest.fn(),
    getReconciliation: jest.fn(),
    getReconciliationSummary: jest.fn(),
    startReconciliation: jest.fn(),
    addReconciledPayment: jest.fn(),
    completeReconciliation: jest.fn(),
    approveReconciliation: jest.fn(),
    retryFailedPayment: jest.fn(),
    getCircuitBreakerStatus: jest.fn(),
  },
}));

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

import { reconciliationService } from "@/lib/services/reconciliation-service";
import { server } from "@/__tests__/msw/server";

const mockService = reconciliationService as jest.Mocked<typeof reconciliationService>;

const waitForSuccess = async (getStatus: () => boolean) => {
  await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
};

describe("useReconciliation hooks (Jest Mocks)", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeAll(() => {
    server.resetHandlers();
    server.close();
  });

  afterAll(() => {
    server.listen();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useReconciliations", () => {
    it("fetches reconciliations list successfully", async () => {
      mockService.listReconciliations.mockResolvedValueOnce({
        reconciliations: [
          { id: 1, bank_account_id: 100, status: "pending" },
          { id: 2, bank_account_id: 100, status: "completed" },
        ],
        total: 2,
        page: 1,
        page_size: 20,
        pages: 1,
      } as any);

      const { result } = renderHook(() => useReconciliations(), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.reconciliations).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
    });
  });

  describe("useStartReconciliation", () => {
    it("starts new reconciliation successfully", async () => {
      mockService.startReconciliation.mockResolvedValueOnce({
        id: 1,
        bank_account_id: 100,
        status: "pending",
        opening_balance: 10000,
        statement_balance: 10500,
      } as any);

      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper: createWrapper(),
      });

      let reconciliation: any;

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
    });
  });

  describe("useCompleteReconciliation", () => {
    it("completes reconciliation successfully", async () => {
      mockService.completeReconciliation.mockResolvedValueOnce({
        id: 1,
        status: "completed",
        completed_by: "user-1",
        completed_at: new Date().toISOString(),
      } as any);

      const { result } = renderHook(() => useCompleteReconciliation(), {
        wrapper: createWrapper(),
      });

      let completed: any;

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
    });
  });

  describe("useRetryFailedPayment", () => {
    it("retries failed payment successfully", async () => {
      mockService.retryFailedPayment.mockResolvedValueOnce({
        payment_id: 5001,
        success: true,
        attempts: 1,
      } as any);

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
      expect(retryResult.success).toBe(true);
    });
  });

  describe("useCircuitBreakerStatus", () => {
    it("fetches circuit breaker status when closed", async () => {
      mockService.getCircuitBreakerStatus.mockResolvedValueOnce({
        state: "closed",
        failure_count: 0,
      } as any);

      const { result } = renderHook(() => useCircuitBreakerStatus(), {
        wrapper: createWrapper(),
      });

      await waitForSuccess(() => result.current.isSuccess);

      expect(result.current.data?.state).toBe("closed");
      expect(result.current.data?.failure_count).toBe(0);
    });
  });
});
