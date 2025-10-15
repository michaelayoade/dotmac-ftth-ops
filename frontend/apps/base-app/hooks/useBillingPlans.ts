import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';

export interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  included: boolean;
  limit?: number | string;
}

export interface BillingPlan {
  plan_id: string;
  product_id?: string;
  name: string;
  display_name?: string;
  description: string;
  billing_interval: 'monthly' | 'quarterly' | 'annual';
  interval_count: number;
  price_amount: number;
  currency: string;
  trial_days: number;
  is_active: boolean;
  features?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProductCatalogItem {
  product_id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  product_type: 'standard' | 'usage_based' | 'hybrid';
  base_price: number;
  currency: string;
  tax_class?: string;
  usage_type?: string;
  usage_unit_name?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PlanCreateRequest {
  product_id: string;
  billing_interval: 'monthly' | 'quarterly' | 'annual';
  interval_count?: number;
  trial_days?: number;
  features?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface PlanUpdateRequest {
  display_name?: string;
  description?: string;
  trial_days?: number;
  features?: Record<string, any>;
  is_active?: boolean;
}

export const useBillingPlans = () => {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async (activeOnly = true, productId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (activeOnly) params.append('active_only', 'true');
      if (productId) params.append('product_id', productId);

      const response = await apiClient.get<BillingPlan[]>(
        `/api/v1/billing/subscriptions/plans?${params.toString()}`
      );

      if ((response as any).success && (response as any).data) {
        setPlans((response as any).data);
      } else if ((response as any).error) {
        setError((response as any).error.message);
      } else if (Array.isArray(response.data)) {
        setPlans(response.data);
      }
    } catch (err) {
      logger.error('Failed to fetch billing plans', err instanceof Error ? err : new Error(String(err)));
      setError('Failed to fetch billing plans');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async (activeOnly = true) => {
    try {
      const params = activeOnly ? '?is_active=true' : '';
      const response = await apiClient.get<ProductCatalogItem[]>(
        `/api/v1/billing/catalog/products${params}`
      );

      if ((response as any).success && (response as any).data) {
        setProducts((response as any).data);
      } else if (Array.isArray(response.data)) {
        setProducts(response.data);
      }
    } catch (err) {
      logger.error('Failed to fetch products', err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  const createPlan = useCallback(async (planData: PlanCreateRequest) => {
    try {
      const response = await apiClient.post('/api/v1/billing/subscriptions/plans', planData);

      if ((response as any).success && (response as any).data) {
        await fetchPlans(); // Refresh list
        return (response as any).data;
      } else if (response.data) {
        await fetchPlans();
        return response.data;
      }
      return null;
    } catch (err) {
      logger.error('Failed to create plan', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [fetchPlans]);

  const updatePlan = useCallback(async (planId: string, updates: PlanUpdateRequest) => {
    try {
      const response = await apiClient.patch(`/api/v1/billing/subscriptions/plans/${planId}`, updates);

      if ((response as any).success || response.data) {
        await fetchPlans(); // Refresh list
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Failed to update plan', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [fetchPlans]);

  const deletePlan = useCallback(async (planId: string) => {
    try {
      const response = await apiClient.delete(`/api/v1/billing/subscriptions/plans/${planId}`);

      if (response.status >= 200 && response.status < 300) {
        setPlans(prev => prev.filter(plan => plan.plan_id !== planId));
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Failed to delete plan', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchProducts();
  }, [fetchPlans, fetchProducts]);

  return {
    plans,
    products,
    loading,
    error,
    fetchPlans,
    fetchProducts,
    createPlan,
    updatePlan,
    deletePlan,
    refreshPlans: fetchPlans,
  };
};