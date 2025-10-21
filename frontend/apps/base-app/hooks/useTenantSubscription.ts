import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface TenantSubscription {
  subscription_id: string;
  tenant_id: string;
  plan_id: string;
  plan_name: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  billing_cycle: "monthly" | "quarterly" | "annual";
  price_amount: number;
  currency: string;
  usage?: {
    users: { current: number; limit?: number };
    storage: { current: number; limit?: number };
    api_calls: { current: number; limit?: number };
  };
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AvailablePlan {
  plan_id: string;
  name: string;
  display_name: string;
  description: string;
  billing_cycle: "monthly" | "quarterly" | "annual";
  price_amount: number;
  currency: string;
  trial_days: number;
  features: Record<string, any>;
  is_featured: boolean;
  metadata?: Record<string, any>;
}

export interface ProrationPreview {
  current_plan: {
    plan_id: string;
    name: string;
    price: number;
    billing_cycle: string;
  };
  new_plan: {
    plan_id: string;
    name: string;
    price: number;
    billing_cycle: string;
  };
  proration: {
    proration_amount: number;
    proration_description: string;
    old_plan_unused_amount: number;
    new_plan_prorated_amount: number;
    days_remaining: number;
  };
  estimated_invoice_amount: number;
  effective_date: string;
  next_billing_date: string;
}

export interface PlanChangeRequest {
  new_plan_id: string;
  billing_cycle?: string;
  proration_behavior?: "prorate" | "none" | "always_invoice";
  reason?: string;
}

export interface SubscriptionCancelRequest {
  cancel_at_period_end: boolean;
  reason?: string;
  feedback?: string;
}

// ============================================================================
// Hook
// ============================================================================

export const useTenantSubscription = () => {
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<AvailablePlan[]>([]);
  const [prorationPreview, setProrationPreview] = useState<ProrationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Get Current Subscription
  // ============================================================================

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/billing/tenant/subscription/current");
      setSubscription(response.data);
      logger.info("Fetched tenant subscription", {
        subscription_id: response.data?.subscription_id,
      });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to fetch subscription";
      setError(errorMsg);
      logger.error("Error fetching subscription", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Get Available Plans
  // ============================================================================

  const fetchAvailablePlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/billing/tenant/subscription/available-plans");
      setAvailablePlans(response.data);
      logger.info("Fetched available plans", { count: response.data.length });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to fetch available plans";
      setError(errorMsg);
      logger.error("Error fetching available plans", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Preview Plan Change
  // ============================================================================

  const previewPlanChange = useCallback(async (request: PlanChangeRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post("/billing/tenant/subscription/preview-change", request);
      setProrationPreview(response.data);
      logger.info("Previewed plan change", {
        new_plan_id: request.new_plan_id,
      });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to preview plan change";
      setError(errorMsg);
      logger.error("Error previewing plan change", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Change Plan
  // ============================================================================

  const changePlan = useCallback(async (request: PlanChangeRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post("/billing/tenant/subscription/change-plan", request);
      setSubscription(response.data);
      logger.info("Changed subscription plan", {
        new_plan_id: request.new_plan_id,
      });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to change plan";
      setError(errorMsg);
      logger.error("Error changing plan", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Cancel Subscription
  // ============================================================================

  const cancelSubscription = useCallback(async (request: SubscriptionCancelRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post("/billing/tenant/subscription/cancel", request);
      setSubscription(response.data);
      logger.info("Canceled subscription", {
        cancel_at_period_end: request.cancel_at_period_end,
      });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to cancel subscription";
      setError(errorMsg);
      logger.error("Error canceling subscription", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Reactivate Subscription
  // ============================================================================

  const reactivateSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post("/billing/tenant/subscription/reactivate");
      setSubscription(response.data);
      logger.info("Reactivated subscription");
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to reactivate subscription";
      setError(errorMsg);
      logger.error("Error reactivating subscription", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Auto-fetch on mount
  // ============================================================================

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return {
    // State
    subscription,
    availablePlans,
    prorationPreview,
    loading,
    error,

    // Actions
    fetchSubscription,
    fetchAvailablePlans,
    previewPlanChange,
    changePlan,
    cancelSubscription,
    reactivateSubscription,
  };
};
