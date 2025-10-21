import { useState, useCallback, useEffect } from "react";
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
// Hook
// ============================================================================

export const useTenantPaymentMethods = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Get Payment Methods
  // ============================================================================

  const fetchPaymentMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/billing/tenant/payment-methods");
      setPaymentMethods(response.data);
      logger.info("Fetched payment methods", { count: response.data.length });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to fetch payment methods";
      setError(errorMsg);
      logger.error("Error fetching payment methods", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Add Payment Method
  // ============================================================================

  const addPaymentMethod = useCallback(
    async (request: AddPaymentMethodRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post("/billing/tenant/payment-methods", request);
        // Refresh payment methods
        await fetchPaymentMethods();
        logger.info("Added payment method", {
          method_type: request.method_type,
        });
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to add payment method";
        setError(errorMsg);
        logger.error("Error adding payment method", { error: errorMsg });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  // ============================================================================
  // Update Payment Method
  // ============================================================================

  const updatePaymentMethod = useCallback(
    async (paymentMethodId: string, request: UpdatePaymentMethodRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.patch(
          `/billing/tenant/payment-methods/${paymentMethodId}`,
          request,
        );
        // Refresh payment methods
        await fetchPaymentMethods();
        logger.info("Updated payment method", {
          payment_method_id: paymentMethodId,
        });
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to update payment method";
        setError(errorMsg);
        logger.error("Error updating payment method", {
          payment_method_id: paymentMethodId,
          error: errorMsg,
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  // ============================================================================
  // Set Default Payment Method
  // ============================================================================

  const setDefaultPaymentMethod = useCallback(
    async (paymentMethodId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post(
          `/billing/tenant/payment-methods/${paymentMethodId}/set-default`,
        );
        // Refresh payment methods
        await fetchPaymentMethods();
        logger.info("Set default payment method", {
          payment_method_id: paymentMethodId,
        });
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to set default payment method";
        setError(errorMsg);
        logger.error("Error setting default payment method", {
          payment_method_id: paymentMethodId,
          error: errorMsg,
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  // ============================================================================
  // Remove Payment Method
  // ============================================================================

  const removePaymentMethod = useCallback(
    async (paymentMethodId: string) => {
      setLoading(true);
      setError(null);
      try {
        await apiClient.delete(`/billing/tenant/payment-methods/${paymentMethodId}`);
        // Refresh payment methods
        await fetchPaymentMethods();
        logger.info("Removed payment method", {
          payment_method_id: paymentMethodId,
        });
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to remove payment method";
        setError(errorMsg);
        logger.error("Error removing payment method", {
          payment_method_id: paymentMethodId,
          error: errorMsg,
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  // ============================================================================
  // Verify Payment Method (Bank Accounts)
  // ============================================================================

  const verifyPaymentMethod = useCallback(
    async (paymentMethodId: string, request: VerifyPaymentMethodRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post(
          `/billing/tenant/payment-methods/${paymentMethodId}/verify`,
          request,
        );
        // Refresh payment methods
        await fetchPaymentMethods();
        logger.info("Verified payment method", {
          payment_method_id: paymentMethodId,
        });
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to verify payment method";
        setError(errorMsg);
        logger.error("Error verifying payment method", {
          payment_method_id: paymentMethodId,
          error: errorMsg,
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  // ============================================================================
  // Computed: Get Default Payment Method
  // ============================================================================

  const defaultPaymentMethod = paymentMethods.find((pm) => pm.is_default);

  // ============================================================================
  // Auto-fetch on mount
  // ============================================================================

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  return {
    // State
    paymentMethods,
    defaultPaymentMethod,
    loading,
    error,

    // Actions
    fetchPaymentMethods,
    addPaymentMethod,
    updatePaymentMethod,
    setDefaultPaymentMethod,
    removePaymentMethod,
    verifyPaymentMethod,
  };
};
