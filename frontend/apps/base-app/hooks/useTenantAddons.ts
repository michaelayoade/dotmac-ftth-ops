import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface Addon {
  addon_id: string;
  name: string;
  description?: string;
  addon_type: "feature" | "resource" | "service" | "user_seats" | "integration";
  billing_type: "one_time" | "recurring" | "metered";
  price: number;
  currency: string;
  setup_fee?: number;
  is_quantity_based: boolean;
  min_quantity: number;
  max_quantity?: number;
  metered_unit?: string;
  included_quantity?: number;
  is_featured: boolean;
  features: string[];
  icon?: string;
  metadata?: Record<string, any>;
}

export interface TenantAddon {
  tenant_addon_id: string;
  addon_id: string;
  addon_name: string;
  status: "active" | "canceled" | "ended" | "suspended";
  quantity: number;
  started_at: string;
  current_period_start?: string;
  current_period_end?: string;
  canceled_at?: string;
  current_usage: number;
  price: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface PurchaseAddonRequest {
  quantity?: number;
  metadata?: Record<string, any>;
}

export interface UpdateAddonQuantityRequest {
  quantity: number;
}

export interface CancelAddonRequest {
  cancel_at_period_end: boolean;
  cancel_immediately?: boolean;
  reason?: string;
}

// ============================================================================
// Hook
// ============================================================================

export const useTenantAddons = () => {
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [activeAddons, setActiveAddons] = useState<TenantAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Get Available Add-ons
  // ============================================================================

  const fetchAvailableAddons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/billing/tenant/addons/available");
      setAvailableAddons(response.data);
      logger.info("Fetched available add-ons", { count: response.data.length });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to fetch available add-ons";
      setError(errorMsg);
      logger.error("Error fetching available add-ons", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Get Active Add-ons
  // ============================================================================

  const fetchActiveAddons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/billing/tenant/addons/active");
      setActiveAddons(response.data);
      logger.info("Fetched active add-ons", { count: response.data.length });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to fetch active add-ons";
      setError(errorMsg);
      logger.error("Error fetching active add-ons", { error: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Purchase Add-on
  // ============================================================================

  const purchaseAddon = useCallback(
    async (addonId: string, request: PurchaseAddonRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post(
          `/billing/tenant/addons/${addonId}/purchase`,
          request,
        );
        // Refresh active add-ons
        await fetchActiveAddons();
        logger.info("Purchased add-on", { addon_id: addonId });
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to purchase add-on";
        setError(errorMsg);
        logger.error("Error purchasing add-on", {
          addon_id: addonId,
          error: errorMsg,
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchActiveAddons],
  );

  // ============================================================================
  // Update Add-on Quantity
  // ============================================================================

  const updateAddonQuantity = useCallback(
    async (tenantAddonId: string, request: UpdateAddonQuantityRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.patch(
          `/billing/tenant/addons/${tenantAddonId}/quantity`,
          request,
        );
        // Refresh active add-ons
        await fetchActiveAddons();
        logger.info("Updated add-on quantity", {
          tenant_addon_id: tenantAddonId,
        });
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to update add-on quantity";
        setError(errorMsg);
        logger.error("Error updating add-on quantity", {
          tenant_addon_id: tenantAddonId,
          error: errorMsg,
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchActiveAddons],
  );

  // ============================================================================
  // Cancel Add-on
  // ============================================================================

  const cancelAddon = useCallback(
    async (tenantAddonId: string, request: CancelAddonRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post(
          `/billing/tenant/addons/${tenantAddonId}/cancel`,
          request,
        );
        // Refresh active add-ons
        await fetchActiveAddons();
        logger.info("Canceled add-on", { tenant_addon_id: tenantAddonId });
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to cancel add-on";
        setError(errorMsg);
        logger.error("Error canceling add-on", {
          tenant_addon_id: tenantAddonId,
          error: errorMsg,
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchActiveAddons],
  );

  // ============================================================================
  // Reactivate Add-on
  // ============================================================================

  const reactivateAddon = useCallback(
    async (tenantAddonId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post(`/billing/tenant/addons/${tenantAddonId}/reactivate`);
        // Refresh active add-ons
        await fetchActiveAddons();
        logger.info("Reactivated add-on", { tenant_addon_id: tenantAddonId });
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || "Failed to reactivate add-on";
        setError(errorMsg);
        logger.error("Error reactivating add-on", {
          tenant_addon_id: tenantAddonId,
          error: errorMsg,
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchActiveAddons],
  );

  // ============================================================================
  // Auto-fetch on mount
  // ============================================================================

  useEffect(() => {
    fetchActiveAddons();
  }, [fetchActiveAddons]);

  return {
    // State
    availableAddons,
    activeAddons,
    loading,
    error,

    // Actions
    fetchAvailableAddons,
    fetchActiveAddons,
    purchaseAddon,
    updateAddonQuantity,
    cancelAddon,
    reactivateAddon,
  };
};
