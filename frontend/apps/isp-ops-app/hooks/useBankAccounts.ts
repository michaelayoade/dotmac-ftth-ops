/**
 * React Query hooks for bank accounts and manual payments
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bankAccountsService,
  type CompanyBankAccountCreate,
  type CompanyBankAccountUpdate,
  type CompanyBankAccountResponse,
  type BankAccountSummary,
  type CashPaymentCreate,
  type CheckPaymentCreate,
  type BankTransferCreate,
  type MobileMoneyCreate,
  type ManualPaymentResponse,
  type PaymentSearchFilters,
  type ReconcilePaymentRequest,
} from "@/lib/services/bank-accounts-service";
import { useToast } from "@dotmac/ui";

// ============================================
// Bank Account Hooks
// ============================================

export function useBankAccounts(includeInactive: boolean = false) {
  return useQuery<CompanyBankAccountResponse[], Error, CompanyBankAccountResponse[], any>({
    queryKey: ["bank-accounts", includeInactive],
    queryFn: () => bankAccountsService.listBankAccounts(includeInactive),
    staleTime: 30000, // 30 seconds
  });
}

export function useBankAccount(accountId: number | null) {
  return useQuery<CompanyBankAccountResponse, Error, CompanyBankAccountResponse, any>({
    queryKey: ["bank-account", accountId],
    queryFn: () => bankAccountsService.getBankAccount(accountId!),
    enabled: !!accountId,
  });
}

export function useBankAccountSummary(accountId: number | null) {
  return useQuery<BankAccountSummary, Error, BankAccountSummary, any>({
    queryKey: ["bank-account-summary", accountId],
    queryFn: () => bankAccountsService.getBankAccountSummary(accountId!),
    enabled: !!accountId,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CompanyBankAccountCreate) => bankAccountsService.createBankAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({
        title: "Bank Account Created",
        description: "The bank account has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create bank account",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: number; data: CompanyBankAccountUpdate }) =>
      bankAccountsService.updateBankAccount(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({
        queryKey: ["bank-account", variables.accountId],
      });
      queryClient.invalidateQueries({
        queryKey: ["bank-account-summary", variables.accountId],
      });
      toast({
        title: "Bank Account Updated",
        description: "The bank account has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update bank account",
        variant: "destructive",
      });
    },
  });
}

export function useVerifyBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ accountId, notes }: { accountId: number; notes?: string }) =>
      bankAccountsService.verifyBankAccount(accountId, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({
        queryKey: ["bank-account", variables.accountId],
      });
      queryClient.invalidateQueries({
        queryKey: ["bank-account-summary", variables.accountId],
      });
      toast({
        title: "Bank Account Verified",
        description: "The bank account has been verified successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify bank account",
        variant: "destructive",
      });
    },
  });
}

export function useDeactivateBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (accountId: number) => bankAccountsService.deactivateBankAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({
        title: "Bank Account Deactivated",
        description: "The bank account has been deactivated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deactivation Failed",
        description: error.message || "Failed to deactivate bank account",
        variant: "destructive",
      });
    },
  });
}

// ============================================
// Manual Payment Hooks
// ============================================

export function useManualPayments(filters?: PaymentSearchFilters) {
  return useQuery<ManualPaymentResponse[], Error, ManualPaymentResponse[], any>({
    queryKey: ["manual-payments", filters],
    queryFn: () => bankAccountsService.searchPayments(filters || {}),
    staleTime: 30000,
  });
}

export function useRecordCashPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CashPaymentCreate) => bankAccountsService.recordCashPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      queryClient.invalidateQueries({ queryKey: ["bank-account-summary"] });
      toast({
        title: "Cash Payment Recorded",
        description: "The cash payment has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Recording Failed",
        description: error.message || "Failed to record cash payment",
        variant: "destructive",
      });
    },
  });
}

export function useRecordCheckPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CheckPaymentCreate) => bankAccountsService.recordCheckPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      queryClient.invalidateQueries({ queryKey: ["bank-account-summary"] });
      toast({
        title: "Check Payment Recorded",
        description: "The check payment has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Recording Failed",
        description: error.message || "Failed to record check payment",
        variant: "destructive",
      });
    },
  });
}

export function useRecordBankTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: BankTransferCreate) => bankAccountsService.recordBankTransfer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      queryClient.invalidateQueries({ queryKey: ["bank-account-summary"] });
      toast({
        title: "Bank Transfer Recorded",
        description: "The bank transfer has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Recording Failed",
        description: error.message || "Failed to record bank transfer",
        variant: "destructive",
      });
    },
  });
}

// Alias for consistency with PaymentRecordDialog
export const useRecordBankTransferPayment = useRecordBankTransfer;

export function useRecordMobileMoney() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: MobileMoneyCreate) => bankAccountsService.recordMobileMoney(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      queryClient.invalidateQueries({ queryKey: ["bank-account-summary"] });
      toast({
        title: "Mobile Money Recorded",
        description: "The mobile money payment has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Recording Failed",
        description: error.message || "Failed to record mobile money payment",
        variant: "destructive",
      });
    },
  });
}

// Alias for consistency with PaymentRecordDialog
export const useRecordMobileMoneyPayment = useRecordMobileMoney;

export function useVerifyPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      paymentId,
      verificationNotes,
    }: {
      paymentId: number;
      verificationNotes?: string;
    }) => bankAccountsService.verifyPayment(paymentId, verificationNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      toast({
        title: "Payment Verified",
        description: "The payment has been verified successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify payment",
        variant: "destructive",
      });
    },
  });
}

export function useReconcilePayments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (request: ReconcilePaymentRequest) =>
      bankAccountsService.reconcilePayments(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      queryClient.invalidateQueries({ queryKey: ["bank-account-summary"] });
      toast({
        title: "Payments Reconciled",
        description: `${data.length} payment(s) have been reconciled successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reconciliation Failed",
        description: error.message || "Failed to reconcile payments",
        variant: "destructive",
      });
    },
  });
}

export function useUploadPaymentAttachment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ paymentId, file }: { paymentId: number; file: File }) =>
      bankAccountsService.uploadPaymentAttachment(paymentId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-payments"] });
      toast({
        title: "Attachment Uploaded",
        description: "The payment attachment has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload attachment",
        variant: "destructive",
      });
    },
  });
}
