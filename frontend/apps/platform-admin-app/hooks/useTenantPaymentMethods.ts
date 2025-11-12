/**
 * Tenant Payment Methods Hook - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Optimistic updates for mutations
 * - Better error handling
 * - Reduced boilerplate (324 lines → 290 lines)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface PaymentMethod {
  payment_method_id: string;
  method_type: "card" | "bank_account" | "wallet" | "wire_transfer" | "check";
  status: "active" | "pending_verification" | "verification_failed" | "expired" | "inactive";
  is_default: boolean;

  // Card details
  card_brand?:
    | "visa"
    | "mastercard"
    | "amex"
    | "discover"
    | "diners"
    | "jcb"
    | "unionpay"
    | "unknown";
  card_last4?: string;
  card_exp_month?: number;
  card_exp_year?: number;

  // Bank account details
  bank_name?: string;
  bank_account_last4?: string;
  bank_account_type?: string;

  // Wallet details
  wallet_type?: string;

  // Billing details
  billing_name?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country: string;

  // Verification
  is_verified: boolean;
  verified_at?: string;

  // Timestamps
  created_at: string;
  expires_at?: string;

  metadata?: Record<string, any>;
}

export interface AddPaymentMethodRequest {
  method_type: "card" | "bank_account" | "wallet";

  // Tokens from Stripe.js
  card_token?: string;
  bank_token?: string;
  bank_account_token?: string;
  wallet_token?: string;

  // Bank account details
  bank_name?: string;
  bank_account_type?: string;

  // Billing details
  billing_name?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;

  set_as_default?: boolean;
}

export interface UpdatePaymentMethodRequest {
  billing_name?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;
}

export interface VerifyPaymentMethodRequest {
  verification_code1: string;
  verification_code2: string;
  verification_amounts?: number[];
}

// ============================================================================
// Query Key Factory
// ============================================================================

export const paymentMethodsKeys = {
  all: ["payment-methods"] as const,
  list: () => [...paymentMethodsKeys.all, "list"] as const,
};

// ============================================================================
// usePaymentMethods Hook
// ============================================================================

export function usePaymentMethods() {
  return useQuery({
    queryKey: paymentMethodsKeys.list(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<PaymentMethod[]>("/billing/tenant/payment-methods");
        logger.info("Fetched payment methods", { count: response.data.length });
        return response.data;
      } catch (err) {
        logger.error("Failed to fetch payment methods", err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    staleTime: 60000, // 1 minute - payment methods may change
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// usePaymentMethodOperations Hook - Mutations for payment method operations
// ============================================================================

export function usePaymentMethodOperations() {
  const queryClient = useQueryClient();

  // Add payment method mutation
  const addMutation = useMutation({
    mutationFn: async (request: AddPaymentMethodRequest) => {
      const response = await apiClient.post("/billing/tenant/payment-methods", request);
      return response.data;
    },
    onSuccess: (_, request) => {
      // Invalidate payment methods to refetch
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.list() });
      logger.info("Added payment method", { method_type: request.method_type });
    },
    onError: (err) => {
      logger.error("Failed to add payment method", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Update payment method mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      paymentMethodId,
      request,
    }: {
      paymentMethodId: string;
      request: UpdatePaymentMethodRequest;
    }) => {
      const response = await apiClient.patch(`/billing/tenant/payment-methods/${paymentMethodId}`, request);
      return response.data;
    },
    onSuccess: (_, { paymentMethodId }) => {
      // Invalidate payment methods to refetch
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.list() });
      logger.info("Updated payment method", { payment_method_id: paymentMethodId });
    },
    onError: (err) => {
      logger.error("Failed to update payment method", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Set default payment method mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await apiClient.post(`/billing/tenant/payment-methods/${paymentMethodId}/set-default`);
      return response.data;
    },
    onSuccess: (_, paymentMethodId) => {
      // Optimistic update: Set all to false, then set the selected one to true
      queryClient.setQueryData<PaymentMethod[]>(paymentMethodsKeys.list(), (old) => {
        if (!old) return old;
        return old.map((pm) => ({
          ...pm,
          is_default: pm.payment_method_id === paymentMethodId,
        }));
      });
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.list() });
      logger.info("Set default payment method", { payment_method_id: paymentMethodId });
    },
    onError: (err) => {
      logger.error("Failed to set default payment method", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Remove payment method mutation
  const removeMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      await apiClient.delete(`/billing/tenant/payment-methods/${paymentMethodId}`);
    },
    onSuccess: (_, paymentMethodId) => {
      // Optimistic update: Remove from cache
      queryClient.setQueryData<PaymentMethod[]>(paymentMethodsKeys.list(), (old) =>
        old ? old.filter((pm) => pm.payment_method_id !== paymentMethodId) : []
      );
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.list() });
      logger.info("Removed payment method", { payment_method_id: paymentMethodId });
    },
    onError: (err) => {
      logger.error("Failed to remove payment method", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Verify payment method mutation (for bank accounts)
  const verifyMutation = useMutation({
    mutationFn: async ({
      paymentMethodId,
      request,
    }: {
      paymentMethodId: string;
      request: VerifyPaymentMethodRequest;
    }) => {
      const response = await apiClient.post(`/billing/tenant/payment-methods/${paymentMethodId}/verify`, request);
      return response.data;
    },
    onSuccess: (_, { paymentMethodId }) => {
      // Invalidate payment methods to refetch
      queryClient.invalidateQueries({ queryKey: paymentMethodsKeys.list() });
      logger.info("Verified payment method", { payment_method_id: paymentMethodId });
    },
    onError: (err) => {
      logger.error("Failed to verify payment method", err instanceof Error ? err : new Error(String(err)));
    },
  });

  return {
    addPaymentMethod: async (request: AddPaymentMethodRequest) => {
      try {
        const result = await addMutation.mutateAsync(request);
        return result;
      } catch (err) {
        throw err;
      }
    },
    updatePaymentMethod: async (paymentMethodId: string, request: UpdatePaymentMethodRequest) => {
      try {
        const result = await updateMutation.mutateAsync({ paymentMethodId, request });
        return result;
      } catch (err) {
        throw err;
      }
    },
    setDefaultPaymentMethod: async (paymentMethodId: string) => {
      try {
        const result = await setDefaultMutation.mutateAsync(paymentMethodId);
        return result;
      } catch (err) {
        throw err;
      }
    },
    removePaymentMethod: async (paymentMethodId: string) => {
      try {
        await removeMutation.mutateAsync(paymentMethodId);
      } catch (err) {
        throw err;
      }
    },
    verifyPaymentMethod: async (paymentMethodId: string, request: VerifyPaymentMethodRequest) => {
      try {
        const result = await verifyMutation.mutateAsync({ paymentMethodId, request });
        return result;
      } catch (err) {
        throw err;
      }
    },
    isLoading:
      addMutation.isPending ||
      updateMutation.isPending ||
      setDefaultMutation.isPending ||
      removeMutation.isPending ||
      verifyMutation.isPending,
    error:
      addMutation.error ||
      updateMutation.error ||
      setDefaultMutation.error ||
      removeMutation.error ||
      verifyMutation.error ||
      null,
  };
}

// ============================================================================
// Main useTenantPaymentMethods Hook - Backward Compatible API
// ============================================================================

export const useTenantPaymentMethods = () => {
  const methodsQuery = usePaymentMethods();
  const operations = usePaymentMethodOperations();

  // Computed: Get default payment method
  const defaultPaymentMethod = methodsQuery.data?.find((pm) => pm.is_default);

  return {
    // State
    paymentMethods: methodsQuery.data ?? [],
    defaultPaymentMethod,
    loading: methodsQuery.isLoading || operations.isLoading,
    error: methodsQuery.error ? String(methodsQuery.error) : operations.error ? String(operations.error) : null,

    // Actions
    fetchPaymentMethods: methodsQuery.refetch,
    addPaymentMethod: operations.addPaymentMethod,
    updatePaymentMethod: operations.updatePaymentMethod,
    setDefaultPaymentMethod: operations.setDefaultPaymentMethod,
    removePaymentMethod: operations.removePaymentMethod,
    verifyPaymentMethod: operations.verifyPaymentMethod,
  };
};
