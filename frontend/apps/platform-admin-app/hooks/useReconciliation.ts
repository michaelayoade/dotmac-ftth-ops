/**
 * React Query hooks for billing reconciliation
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  reconciliationService,
  type ReconciliationStart,
  type ReconcilePaymentRequest,
  type ReconciliationComplete,
  type ReconciliationApprove,
  type ReconciliationResponse,
  type ReconciliationListResponse,
  type ReconciliationSummary,
  type PaymentRetryRequest,
  type PaymentRetryResponse,
} from "@/lib/services/reconciliation-service";
import { useToast } from "@dotmac/ui";

// ============================================
// Reconciliation Session Hooks
// ============================================

export function useReconciliations(params?: {
  bank_account_id?: number;
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery<ReconciliationListResponse, Error, ReconciliationListResponse, any>({
    queryKey: ["reconciliations", params],
    queryFn: () => reconciliationService.listReconciliations(params),
    staleTime: 30000, // 30 seconds
  });
}

export function useReconciliation(reconciliationId: number | null) {
  return useQuery<ReconciliationResponse, Error, ReconciliationResponse, any>({
    queryKey: ["reconciliation", reconciliationId],
    queryFn: () => reconciliationService.getReconciliation(reconciliationId!),
    enabled: !!reconciliationId,
  });
}

export function useReconciliationSummary(params?: { bank_account_id?: number; days?: number }) {
  return useQuery<ReconciliationSummary, Error, ReconciliationSummary, any>({
    queryKey: ["reconciliation-summary", params],
    queryFn: () => reconciliationService.getReconciliationSummary(params),
    staleTime: 60000, // 1 minute
  });
}

export function useStartReconciliation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: ReconciliationStart) => reconciliationService.startReconciliation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] });
      toast({
        title: "Reconciliation Started",
        description: "The reconciliation session has been started successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Start Failed",
        description: error.message || "Failed to start reconciliation",
        variant: "destructive",
      });
    },
  });
}

// ============================================
// Reconciliation Operations Hooks
// ============================================

export function useAddReconciledPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      reconciliationId,
      paymentData,
    }: {
      reconciliationId: number;
      paymentData: ReconcilePaymentRequest;
    }) => reconciliationService.addReconciledPayment(reconciliationId, paymentData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["reconciliation", variables.reconciliationId],
      });
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      toast({
        title: "Payment Reconciled",
        description: "The payment has been added to the reconciliation session.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reconciliation Failed",
        description: error.message || "Failed to reconcile payment",
        variant: "destructive",
      });
    },
  });
}

export function useCompleteReconciliation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      reconciliationId,
      data,
    }: {
      reconciliationId: number;
      data: ReconciliationComplete;
    }) => reconciliationService.completeReconciliation(reconciliationId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["reconciliation", variables.reconciliationId],
      });
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] });
      toast({
        title: "Reconciliation Completed",
        description: "The reconciliation session has been completed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Completion Failed",
        description: error.message || "Failed to complete reconciliation",
        variant: "destructive",
      });
    },
  });
}

export function useApproveReconciliation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      reconciliationId,
      data,
    }: {
      reconciliationId: number;
      data: ReconciliationApprove;
    }) => reconciliationService.approveReconciliation(reconciliationId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["reconciliation", variables.reconciliationId],
      });
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] });
      toast({
        title: "Reconciliation Approved",
        description: "The reconciliation session has been approved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve reconciliation",
        variant: "destructive",
      });
    },
  });
}

// ============================================
// Recovery & Retry Hooks
// ============================================

export function useRetryFailedPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (request: PaymentRetryRequest) => reconciliationService.retryFailedPayment(request),
    onSuccess: (data: PaymentRetryResponse) => {
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      if (data.success) {
        toast({
          title: "Payment Retry Successful",
          description: `The payment has been retried successfully after ${data.attempts} attempt(s).`,
        });
      } else {
        toast({
          title: "Payment Retry Failed",
          description: data.last_error || "The payment retry was not successful.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to retry payment",
        variant: "destructive",
      });
    },
  });
}

export function useCircuitBreakerStatus() {
  return useQuery({
    queryKey: ["circuit-breaker-status"],
    queryFn: () => reconciliationService.getCircuitBreakerStatus(),
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
