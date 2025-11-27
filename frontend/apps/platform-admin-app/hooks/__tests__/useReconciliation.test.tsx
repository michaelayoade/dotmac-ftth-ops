/**
 * Tests for useReconciliation hooks
 * Tests billing reconciliation and payment matching functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
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
import { reconciliationService } from "@/lib/services/reconciliation-service";
import type {
  ReconciliationResponse,
  ReconciliationListResponse,
  ReconciliationSummary,
  ReconciliationStart,
  ReconcilePaymentRequest,
  ReconciliationComplete,
  ReconciliationApprove,
  PaymentRetryRequest,
  PaymentRetryResponse,
  ReconciledItem,
} from "@/lib/services/reconciliation-service";

// Mock dependencies
jest.mock("@/lib/services/reconciliation-service");
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useReconciliation", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Query Hooks ====================

  describe("useReconciliations", () => {
    it("should fetch reconciliations successfully", async () => {
      const mockReconciliations: ReconciliationListResponse = {
        reconciliations: [
          {
            id: 1,
            tenant_id: "tenant-1",
            reconciliation_date: "2024-01-01T00:00:00Z",
            period_start: "2024-01-01T00:00:00Z",
            period_end: "2024-01-31T23:59:59Z",
            bank_account_id: 1,
            opening_balance: 10000.0,
            closing_balance: 15000.0,
            statement_balance: 15000.0,
            total_deposits: 5000.0,
            total_withdrawals: 0.0,
            unreconciled_count: 0,
            discrepancy_amount: 0.0,
            status: "completed",
            completed_by: "user-1",
            completed_at: "2024-01-31T23:59:59Z",
            approved_by: "admin-1",
            approved_at: "2024-02-01T00:00:00Z",
            notes: "Monthly reconciliation",
            statement_file_url: "https://example.com/statement.pdf",
            reconciled_items: [],
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-02-01T00:00:00Z",
            metadata: {},
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        pages: 1,
      };

      (reconciliationService.listReconciliations as jest.Mock).mockResolvedValue(
        mockReconciliations,
      );

      const { result } = renderHook(() => useReconciliations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockReconciliations);
      expect(reconciliationService.listReconciliations).toHaveBeenCalledWith(undefined);
    });

    it("should handle filter parameters", async () => {
      const mockReconciliations: ReconciliationListResponse = {
        reconciliations: [],
        total: 0,
        page: 1,
        page_size: 20,
        pages: 0,
      };

      (reconciliationService.listReconciliations as jest.Mock).mockResolvedValue(
        mockReconciliations,
      );

      renderHook(
        () =>
          useReconciliations({
            bank_account_id: 1,
            status: "pending",
            start_date: "2024-01-01",
            end_date: "2024-01-31",
            page: 2,
            page_size: 50,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(reconciliationService.listReconciliations).toHaveBeenCalledWith({
          bank_account_id: 1,
          status: "pending",
          start_date: "2024-01-01",
          end_date: "2024-01-31",
          page: 2,
          page_size: 50,
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch reconciliations");
      (reconciliationService.listReconciliations as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useReconciliations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should handle different reconciliation statuses", async () => {
      const statuses = ["pending", "completed", "approved", "discrepancy"];

      for (const status of statuses) {
        const mockReconciliations: ReconciliationListResponse = {
          reconciliations: [
            {
              id: 1,
              tenant_id: "tenant-1",
              reconciliation_date: "2024-01-01T00:00:00Z",
              period_start: "2024-01-01T00:00:00Z",
              period_end: "2024-01-31T23:59:59Z",
              bank_account_id: 1,
              opening_balance: 10000.0,
              closing_balance: 15000.0,
              statement_balance: 15000.0,
              total_deposits: 5000.0,
              total_withdrawals: 0.0,
              unreconciled_count: 0,
              discrepancy_amount: 0.0,
              status: status,
              completed_by: null,
              completed_at: null,
              approved_by: null,
              approved_at: null,
              notes: null,
              statement_file_url: null,
              reconciled_items: [],
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              metadata: {},
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
          pages: 1,
        };

        (reconciliationService.listReconciliations as jest.Mock).mockResolvedValue(
          mockReconciliations,
        );

        const { result } = renderHook(() => useReconciliations({ status }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.reconciliations[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should have correct staleTime", async () => {
      (reconciliationService.listReconciliations as jest.Mock).mockResolvedValue({
        reconciliations: [],
        total: 0,
        page: 1,
        page_size: 20,
        pages: 0,
      });

      const { result } = renderHook(() => useReconciliations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // staleTime is 30000ms (30 seconds)
      expect(result.current.data).toBeDefined();
    });
  });

  describe("useReconciliation", () => {
    it("should fetch single reconciliation successfully", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 15000.0,
        statement_balance: 15000.0,
        total_deposits: 5000.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "completed",
        completed_by: "user-1",
        completed_at: "2024-01-31T23:59:59Z",
        approved_by: null,
        approved_at: null,
        notes: "January reconciliation",
        statement_file_url: "https://example.com/statement.pdf",
        reconciled_items: [
          {
            payment_id: 1,
            payment_reference: "PAY-001",
            amount: 100.0,
            reconciled_at: "2024-01-15T00:00:00Z",
            reconciled_by: "user-1",
            notes: "Payment reconciled",
          },
        ],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-31T23:59:59Z",
        metadata: {},
      };

      (reconciliationService.getReconciliation as jest.Mock).mockResolvedValue(mockReconciliation);

      const { result } = renderHook(() => useReconciliation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockReconciliation);
      expect(reconciliationService.getReconciliation).toHaveBeenCalledWith(1);
    });

    it("should not fetch when reconciliationId is null", async () => {
      const { result } = renderHook(() => useReconciliation(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(reconciliationService.getReconciliation).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Reconciliation not found");
      (reconciliationService.getReconciliation as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useReconciliation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should handle reconciliation with discrepancies", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 14900.0,
        statement_balance: 15000.0,
        total_deposits: 5000.0,
        total_withdrawals: 0.0,
        unreconciled_count: 5,
        discrepancy_amount: 100.0,
        status: "discrepancy",
        completed_by: null,
        completed_at: null,
        approved_by: null,
        approved_at: null,
        notes: "Discrepancy found",
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-31T23:59:59Z",
        metadata: {},
      };

      (reconciliationService.getReconciliation as jest.Mock).mockResolvedValue(mockReconciliation);

      const { result } = renderHook(() => useReconciliation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.discrepancy_amount).toBe(100.0);
      expect(result.current.data?.unreconciled_count).toBe(5);
      expect(result.current.data?.status).toBe("discrepancy");
    });
  });

  describe("useReconciliationSummary", () => {
    it("should fetch reconciliation summary successfully", async () => {
      const mockSummary: ReconciliationSummary = {
        total_reconciliations: 12,
        pending_reconciliations: 2,
        completed_reconciliations: 10,
        total_discrepancy: 500.0,
        avg_discrepancy: 50.0,
        last_reconciliation_date: "2024-01-31T00:00:00Z",
      };

      (reconciliationService.getReconciliationSummary as jest.Mock).mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useReconciliationSummary(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockSummary);
      expect(reconciliationService.getReconciliationSummary).toHaveBeenCalledWith(undefined);
    });

    it("should handle filter parameters", async () => {
      const mockSummary: ReconciliationSummary = {
        total_reconciliations: 5,
        pending_reconciliations: 1,
        completed_reconciliations: 4,
        total_discrepancy: 100.0,
        avg_discrepancy: 25.0,
        last_reconciliation_date: "2024-01-15T00:00:00Z",
      };

      (reconciliationService.getReconciliationSummary as jest.Mock).mockResolvedValue(mockSummary);

      renderHook(() => useReconciliationSummary({ bank_account_id: 1, days: 30 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(reconciliationService.getReconciliationSummary).toHaveBeenCalledWith({
          bank_account_id: 1,
          days: 30,
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch summary");
      (reconciliationService.getReconciliationSummary as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useReconciliationSummary(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should have correct staleTime", async () => {
      (reconciliationService.getReconciliationSummary as jest.Mock).mockResolvedValue({
        total_reconciliations: 0,
        pending_reconciliations: 0,
        completed_reconciliations: 0,
        total_discrepancy: 0.0,
        avg_discrepancy: 0.0,
        last_reconciliation_date: null,
      });

      const { result } = renderHook(() => useReconciliationSummary(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // staleTime is 60000ms (1 minute)
      expect(result.current.data).toBeDefined();
    });
  });

  // ==================== Mutation Hooks ====================

  describe("useStartReconciliation", () => {
    it("should start reconciliation successfully", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 10000.0,
        statement_balance: 10000.0,
        total_deposits: 0.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "pending",
        completed_by: null,
        completed_at: null,
        approved_by: null,
        approved_at: null,
        notes: "New reconciliation session",
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        metadata: {},
      };

      (reconciliationService.startReconciliation as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper: createWrapper(),
      });

      const startData: ReconciliationStart = {
        bank_account_id: 1,
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        opening_balance: 10000.0,
        statement_balance: 10000.0,
        notes: "New reconciliation session",
      };

      await act(async () => {
        const started = await result.current.mutateAsync(startData);
        expect(started).toEqual(mockReconciliation);
      });

      expect(reconciliationService.startReconciliation).toHaveBeenCalledWith(startData);
    });

    it("should handle start error", async () => {
      const error = new Error("Failed to start reconciliation");
      (reconciliationService.startReconciliation as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            bank_account_id: 1,
            period_start: "2024-01-01T00:00:00Z",
            period_end: "2024-01-31T23:59:59Z",
            opening_balance: 10000.0,
            statement_balance: 10000.0,
          });
        } catch (err) {
          expect(err).toEqual(error);
        }
      });
    });

    it("should invalidate queries on success", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 10000.0,
        statement_balance: 10000.0,
        total_deposits: 0.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "pending",
        completed_by: null,
        completed_at: null,
        approved_by: null,
        approved_at: null,
        notes: null,
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        metadata: {},
      };

      (reconciliationService.startReconciliation as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          bank_account_id: 1,
          period_start: "2024-01-01T00:00:00Z",
          period_end: "2024-01-31T23:59:59Z",
          opening_balance: 10000.0,
          statement_balance: 10000.0,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliations"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliation-summary"] });
    });

    it("should handle start with statement file", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 10000.0,
        statement_balance: 10000.0,
        total_deposits: 0.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "pending",
        completed_by: null,
        completed_at: null,
        approved_by: null,
        approved_at: null,
        notes: null,
        statement_file_url: "https://example.com/statement.pdf",
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        metadata: {},
      };

      (reconciliationService.startReconciliation as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          bank_account_id: 1,
          period_start: "2024-01-01T00:00:00Z",
          period_end: "2024-01-31T23:59:59Z",
          opening_balance: 10000.0,
          statement_balance: 10000.0,
          statement_file_url: "https://example.com/statement.pdf",
        });
      });

      expect(reconciliationService.startReconciliation).toHaveBeenCalledWith(
        expect.objectContaining({
          statement_file_url: "https://example.com/statement.pdf",
        }),
      );
    });
  });

  describe("useAddReconciledPayment", () => {
    it("should add reconciled payment successfully", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 10100.0,
        statement_balance: 10100.0,
        total_deposits: 100.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "pending",
        completed_by: null,
        completed_at: null,
        approved_by: null,
        approved_at: null,
        notes: null,
        statement_file_url: null,
        reconciled_items: [
          {
            payment_id: 1,
            payment_reference: "PAY-001",
            amount: 100.0,
            reconciled_at: "2024-01-15T00:00:00Z",
            reconciled_by: "user-1",
            notes: "Payment added",
          },
        ],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
        metadata: {},
      };

      (reconciliationService.addReconciledPayment as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const { result } = renderHook(() => useAddReconciledPayment(), {
        wrapper: createWrapper(),
      });

      const paymentData: ReconcilePaymentRequest = {
        payment_id: 1,
        notes: "Payment added",
      };

      await act(async () => {
        const updated = await result.current.mutateAsync({
          reconciliationId: 1,
          paymentData,
        });
        expect(updated).toEqual(mockReconciliation);
      });

      expect(reconciliationService.addReconciledPayment).toHaveBeenCalledWith(1, paymentData);
    });

    it("should handle add payment error", async () => {
      const error = new Error("Failed to add payment");
      (reconciliationService.addReconciledPayment as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAddReconciledPayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            reconciliationId: 1,
            paymentData: { payment_id: 1 },
          });
        } catch (err) {
          expect(err).toEqual(error);
        }
      });
    });

    it("should invalidate queries on success", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 10100.0,
        statement_balance: 10100.0,
        total_deposits: 100.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "pending",
        completed_by: null,
        completed_at: null,
        approved_by: null,
        approved_at: null,
        notes: null,
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
        metadata: {},
      };

      (reconciliationService.addReconciledPayment as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useAddReconciledPayment(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          reconciliationId: 1,
          paymentData: { payment_id: 1 },
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliation", 1] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliations"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["manual-payments"] });
    });
  });

  describe("useCompleteReconciliation", () => {
    it("should complete reconciliation successfully", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 15000.0,
        statement_balance: 15000.0,
        total_deposits: 5000.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "completed",
        completed_by: "user-1",
        completed_at: "2024-01-31T23:59:59Z",
        approved_by: null,
        approved_at: null,
        notes: "Reconciliation completed",
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-31T23:59:59Z",
        metadata: {},
      };

      (reconciliationService.completeReconciliation as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const { result } = renderHook(() => useCompleteReconciliation(), {
        wrapper: createWrapper(),
      });

      const completeData: ReconciliationComplete = {
        notes: "Reconciliation completed",
      };

      await act(async () => {
        const completed = await result.current.mutateAsync({
          reconciliationId: 1,
          data: completeData,
        });
        expect(completed).toEqual(mockReconciliation);
      });

      expect(reconciliationService.completeReconciliation).toHaveBeenCalledWith(1, completeData);
    });

    it("should handle complete error", async () => {
      const error = new Error("Failed to complete reconciliation");
      (reconciliationService.completeReconciliation as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCompleteReconciliation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            reconciliationId: 1,
            data: {},
          });
        } catch (err) {
          expect(err).toEqual(error);
        }
      });
    });

    it("should invalidate queries on success", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 15000.0,
        statement_balance: 15000.0,
        total_deposits: 5000.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "completed",
        completed_by: "user-1",
        completed_at: "2024-01-31T23:59:59Z",
        approved_by: null,
        approved_at: null,
        notes: null,
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-31T23:59:59Z",
        metadata: {},
      };

      (reconciliationService.completeReconciliation as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCompleteReconciliation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          reconciliationId: 1,
          data: {},
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliation", 1] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliations"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliation-summary"] });
    });
  });

  describe("useApproveReconciliation", () => {
    it("should approve reconciliation successfully", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 15000.0,
        statement_balance: 15000.0,
        total_deposits: 5000.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "approved",
        completed_by: "user-1",
        completed_at: "2024-01-31T23:59:59Z",
        approved_by: "admin-1",
        approved_at: "2024-02-01T00:00:00Z",
        notes: "Approved by admin",
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-02-01T00:00:00Z",
        metadata: {},
      };

      (reconciliationService.approveReconciliation as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const { result } = renderHook(() => useApproveReconciliation(), {
        wrapper: createWrapper(),
      });

      const approveData: ReconciliationApprove = {
        notes: "Approved by admin",
      };

      await act(async () => {
        const approved = await result.current.mutateAsync({
          reconciliationId: 1,
          data: approveData,
        });
        expect(approved).toEqual(mockReconciliation);
      });

      expect(reconciliationService.approveReconciliation).toHaveBeenCalledWith(1, approveData);
    });

    it("should handle approve error", async () => {
      const error = new Error("Failed to approve reconciliation");
      (reconciliationService.approveReconciliation as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useApproveReconciliation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            reconciliationId: 1,
            data: {},
          });
        } catch (err) {
          expect(err).toEqual(error);
        }
      });
    });

    it("should invalidate queries on success", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 15000.0,
        statement_balance: 15000.0,
        total_deposits: 5000.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "approved",
        completed_by: "user-1",
        completed_at: "2024-01-31T23:59:59Z",
        approved_by: "admin-1",
        approved_at: "2024-02-01T00:00:00Z",
        notes: null,
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-02-01T00:00:00Z",
        metadata: {},
      };

      (reconciliationService.approveReconciliation as jest.Mock).mockResolvedValue(
        mockReconciliation,
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useApproveReconciliation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          reconciliationId: 1,
          data: {},
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliation", 1] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliations"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["reconciliation-summary"] });
    });
  });

  // ==================== Recovery & Retry Hooks ====================

  describe("useRetryFailedPayment", () => {
    it("should retry failed payment successfully", async () => {
      const mockRetryResponse: PaymentRetryResponse = {
        payment_id: 1,
        success: true,
        attempts: 1,
        last_error: null,
        retry_at: null,
      };

      (reconciliationService.retryFailedPayment as jest.Mock).mockResolvedValue(mockRetryResponse);

      const { result } = renderHook(() => useRetryFailedPayment(), {
        wrapper: createWrapper(),
      });

      const retryRequest: PaymentRetryRequest = {
        payment_id: 1,
        max_attempts: 3,
      };

      await act(async () => {
        const retryResult = await result.current.mutateAsync(retryRequest);
        expect(retryResult).toEqual(mockRetryResponse);
      });

      expect(reconciliationService.retryFailedPayment).toHaveBeenCalledWith(retryRequest);
    });

    it("should handle retry failure", async () => {
      const mockRetryResponse: PaymentRetryResponse = {
        payment_id: 1,
        success: false,
        attempts: 3,
        last_error: "Payment gateway timeout",
        retry_at: "2024-01-02T00:00:00Z",
      };

      (reconciliationService.retryFailedPayment as jest.Mock).mockResolvedValue(mockRetryResponse);

      const { result } = renderHook(() => useRetryFailedPayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const retryResult = await result.current.mutateAsync({
          payment_id: 1,
        });
        expect(retryResult.success).toBe(false);
        expect(retryResult.last_error).toBe("Payment gateway timeout");
      });
    });

    it("should handle retry error", async () => {
      const error = new Error("Failed to retry payment");
      (reconciliationService.retryFailedPayment as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRetryFailedPayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ payment_id: 1 });
        } catch (err) {
          expect(err).toEqual(error);
        }
      });
    });

    it("should invalidate queries on success", async () => {
      const mockRetryResponse: PaymentRetryResponse = {
        payment_id: 1,
        success: true,
        attempts: 1,
        last_error: null,
        retry_at: null,
      };

      (reconciliationService.retryFailedPayment as jest.Mock).mockResolvedValue(mockRetryResponse);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useRetryFailedPayment(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({ payment_id: 1 });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["manual-payments"] });
    });

    it("should handle multiple retry attempts", async () => {
      const mockRetryResponse: PaymentRetryResponse = {
        payment_id: 1,
        success: true,
        attempts: 5,
        last_error: null,
        retry_at: null,
      };

      (reconciliationService.retryFailedPayment as jest.Mock).mockResolvedValue(mockRetryResponse);

      const { result } = renderHook(() => useRetryFailedPayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const retryResult = await result.current.mutateAsync({
          payment_id: 1,
          max_attempts: 10,
        });
        expect(retryResult.attempts).toBe(5);
      });
    });
  });

  describe("useCircuitBreakerStatus", () => {
    it("should fetch circuit breaker status successfully", async () => {
      const mockStatus = {
        state: "closed",
        failure_count: 0,
        success_count: 100,
        last_failure_time: null,
        next_attempt: null,
      };

      (reconciliationService.getCircuitBreakerStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCircuitBreakerStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStatus);
      expect(reconciliationService.getCircuitBreakerStatus).toHaveBeenCalled();
    });

    it("should handle open circuit breaker state", async () => {
      const mockStatus = {
        state: "open",
        failure_count: 5,
        success_count: 95,
        last_failure_time: "2024-01-01T00:00:00Z",
        next_attempt: "2024-01-01T00:05:00Z",
      };

      (reconciliationService.getCircuitBreakerStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCircuitBreakerStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.state).toBe("open");
      expect(result.current.data?.failure_count).toBe(5);
    });

    it("should handle half-open circuit breaker state", async () => {
      const mockStatus = {
        state: "half-open",
        failure_count: 3,
        success_count: 97,
        last_failure_time: "2024-01-01T00:00:00Z",
        next_attempt: null,
      };

      (reconciliationService.getCircuitBreakerStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCircuitBreakerStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.state).toBe("half-open");
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch circuit breaker status");
      (reconciliationService.getCircuitBreakerStatus as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCircuitBreakerStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should have correct staleTime and refetchInterval", async () => {
      (reconciliationService.getCircuitBreakerStatus as jest.Mock).mockResolvedValue({
        state: "closed",
        failure_count: 0,
        success_count: 100,
      });

      const { result } = renderHook(() => useCircuitBreakerStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // staleTime is 10000ms (10 seconds), refetchInterval is 30000ms (30 seconds)
      expect(result.current.data).toBeDefined();
    });
  });

  // ==================== Loading States ====================

  describe("Loading States", () => {
    it("should show loading during reconciliations query", async () => {
      (reconciliationService.listReconciliations as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ reconciliations: [] }), 100)),
      );

      const { result } = renderHook(() => useReconciliations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should show loading during start reconciliation mutation", async () => {
      (reconciliationService.startReconciliation as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
      );

      const { result } = renderHook(() => useStartReconciliation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          bank_account_id: 1,
          period_start: "2024-01-01T00:00:00Z",
          period_end: "2024-01-31T23:59:59Z",
          opening_balance: 10000.0,
          statement_balance: 10000.0,
        });
      });

      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 500 });
    });

    it("should show loading during add payment mutation", async () => {
      (reconciliationService.addReconciledPayment as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
      );

      const { result } = renderHook(() => useAddReconciledPayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          reconciliationId: 1,
          paymentData: { payment_id: 1 },
        });
      });

      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 500 });
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    it("should handle reconciliation with zero balances", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 0.0,
        closing_balance: 0.0,
        statement_balance: 0.0,
        total_deposits: 0.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "completed",
        completed_by: "user-1",
        completed_at: "2024-01-31T23:59:59Z",
        approved_by: null,
        approved_at: null,
        notes: null,
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-31T23:59:59Z",
        metadata: {},
      };

      (reconciliationService.getReconciliation as jest.Mock).mockResolvedValue(mockReconciliation);

      const { result } = renderHook(() => useReconciliation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.opening_balance).toBe(0.0);
      expect(result.current.data?.closing_balance).toBe(0.0);
    });

    it("should handle reconciliation with large discrepancies", async () => {
      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 10000.0,
        statement_balance: 20000.0,
        total_deposits: 0.0,
        total_withdrawals: 0.0,
        unreconciled_count: 100,
        discrepancy_amount: 10000.0,
        status: "discrepancy",
        completed_by: null,
        completed_at: null,
        approved_by: null,
        approved_at: null,
        notes: "Major discrepancy found",
        statement_file_url: null,
        reconciled_items: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-31T23:59:59Z",
        metadata: {},
      };

      (reconciliationService.getReconciliation as jest.Mock).mockResolvedValue(mockReconciliation);

      const { result } = renderHook(() => useReconciliation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.discrepancy_amount).toBe(10000.0);
      expect(result.current.data?.unreconciled_count).toBe(100);
    });

    it("should handle reconciliation with many reconciled items", async () => {
      const reconciledItems: ReconciledItem[] = Array.from({ length: 100 }, (_, i) => ({
        payment_id: i + 1,
        payment_reference: `PAY-${String(i + 1).padStart(3, "0")}`,
        amount: 100.0,
        reconciled_at: "2024-01-15T00:00:00Z",
        reconciled_by: "user-1",
        notes: null,
      }));

      const mockReconciliation: ReconciliationResponse = {
        id: 1,
        tenant_id: "tenant-1",
        reconciliation_date: "2024-01-01T00:00:00Z",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        bank_account_id: 1,
        opening_balance: 10000.0,
        closing_balance: 20000.0,
        statement_balance: 20000.0,
        total_deposits: 10000.0,
        total_withdrawals: 0.0,
        unreconciled_count: 0,
        discrepancy_amount: 0.0,
        status: "completed",
        completed_by: "user-1",
        completed_at: "2024-01-31T23:59:59Z",
        approved_by: null,
        approved_at: null,
        notes: null,
        statement_file_url: null,
        reconciled_items: reconciledItems,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-31T23:59:59Z",
        metadata: {},
      };

      (reconciliationService.getReconciliation as jest.Mock).mockResolvedValue(mockReconciliation);

      const { result } = renderHook(() => useReconciliation(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.reconciled_items).toHaveLength(100);
    });

    it("should handle empty reconciliation list", async () => {
      const mockReconciliations: ReconciliationListResponse = {
        reconciliations: [],
        total: 0,
        page: 1,
        page_size: 20,
        pages: 0,
      };

      (reconciliationService.listReconciliations as jest.Mock).mockResolvedValue(
        mockReconciliations,
      );

      const { result } = renderHook(() => useReconciliations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.reconciliations).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle null summary date", async () => {
      const mockSummary: ReconciliationSummary = {
        total_reconciliations: 0,
        pending_reconciliations: 0,
        completed_reconciliations: 0,
        total_discrepancy: 0.0,
        avg_discrepancy: 0.0,
        last_reconciliation_date: null,
      };

      (reconciliationService.getReconciliationSummary as jest.Mock).mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useReconciliationSummary(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.last_reconciliation_date).toBeNull();
    });
  });

  // ==================== Date Range Filtering ====================

  describe("Date Range Filtering", () => {
    it("should filter reconciliations by date range", async () => {
      const mockReconciliations: ReconciliationListResponse = {
        reconciliations: [],
        total: 0,
        page: 1,
        page_size: 20,
        pages: 0,
      };

      (reconciliationService.listReconciliations as jest.Mock).mockResolvedValue(
        mockReconciliations,
      );

      renderHook(
        () =>
          useReconciliations({
            start_date: "2024-01-01",
            end_date: "2024-01-31",
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(reconciliationService.listReconciliations).toHaveBeenCalledWith({
          start_date: "2024-01-01",
          end_date: "2024-01-31",
        });
      });
    });

    it("should filter summary by days parameter", async () => {
      const mockSummary: ReconciliationSummary = {
        total_reconciliations: 5,
        pending_reconciliations: 1,
        completed_reconciliations: 4,
        total_discrepancy: 50.0,
        avg_discrepancy: 12.5,
        last_reconciliation_date: "2024-01-15T00:00:00Z",
      };

      (reconciliationService.getReconciliationSummary as jest.Mock).mockResolvedValue(mockSummary);

      renderHook(() => useReconciliationSummary({ days: 7 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(reconciliationService.getReconciliationSummary).toHaveBeenCalledWith({
          days: 7,
        });
      });
    });
  });
});
