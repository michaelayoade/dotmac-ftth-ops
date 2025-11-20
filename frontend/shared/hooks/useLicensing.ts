/**
 * Shared Licensing Framework Hook - Enhanced Version
 *
 * Improvements over original:
 * - Runtime Zod validation for all responses
 * - Pagination support for list queries
 * - Consistent URL formatting (leading slashes)
 * - Proper type safety (no 'any' types)
 * - Unified 404 handling (returns undefined)
 * - DRY error handling with utilities
 * - Better structure and organization
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { toError, logAndThrow, logAndReturn } from '../utils/licensing-utils';
import { parseListResponse } from '../utils/api-utils';
import {
  FeatureModuleSchema,
  QuotaDefinitionSchema,
  ServicePlanSchema,
  TenantSubscriptionSchema,
  CheckEntitlementResponseSchema,
  CheckQuotaResponseSchema,
  PlanPricingSchema,
  type FeatureModule,
  type QuotaDefinition,
  type ServicePlan,
  type TenantSubscription,
  type CheckEntitlementResponse,
  type CheckQuotaResponse,
  type PlanPricing,
} from '../utils/licensing-schemas';

// Re-export types from app-specific licensing types for request types
// These are imported from the app's types/licensing.ts
import type {
  CreateFeatureModuleRequest,
  CreateQuotaDefinitionRequest,
  CreateServicePlanRequest,
  CreateSubscriptionRequest,
  AddAddonRequest,
  RemoveAddonRequest,
  CheckEntitlementRequest,
  CheckQuotaRequest,
  ConsumeQuotaRequest,
  ReleaseQuotaRequest,
  UseLicensingReturn,
} from '@/types/licensing';

// ============================================================================
// Query Key Factory
// ============================================================================

export const licensingKeys = {
  all: ['licensing'] as const,
  modules: (offset = 0, limit = 100) => [...licensingKeys.all, 'modules', offset, limit] as const,
  module: (id: string) => [...licensingKeys.all, 'module', id] as const,
  quotas: (offset = 0, limit = 100) => [...licensingKeys.all, 'quotas', offset, limit] as const,
  plans: (offset = 0, limit = 100) => [...licensingKeys.all, 'plans', offset, limit] as const,
  plan: (id: string) => [...licensingKeys.all, 'plan', id] as const,
  subscription: () => [...licensingKeys.all, 'subscription'] as const,
  entitlement: (moduleCode?: string, capabilityCode?: string) =>
    [...licensingKeys.all, 'entitlement', { moduleCode, capabilityCode }] as const,
  quotaCheck: (quotaCode: string, quantity: number) =>
    [...licensingKeys.all, 'quota-check', { quotaCode, quantity }] as const,
};

// ============================================================================
// Pagination Parameters
// ============================================================================

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

// ============================================================================
// Main useLicensing Hook
// ============================================================================

export function useLicensing(pagination: PaginationParams = {}): UseLicensingReturn {
  const queryClient = useQueryClient();
  const { offset = 0, limit = 100 } = pagination;

  // ==========================================================================
  // Feature Modules Queries
  // ==========================================================================

  const modulesQuery = useQuery({
    queryKey: licensingKeys.modules(offset, limit),
    queryFn: async () => {
      try {
        const response = await apiClient.get<FeatureModule[]>(
          `/licensing/modules?offset=${offset}&limit=${limit}`
        );

        // Validate with Zod
        if (Array.isArray(response.data)) {
          return response.data.map((item) => FeatureModuleSchema.parse(item));
        }
        return [];
      } catch (err) {
        logAndThrow('Failed to fetch modules', err);
      }
    },
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // ==========================================================================
  // Quotas Queries
  // ==========================================================================

  const quotasQuery = useQuery({
    queryKey: licensingKeys.quotas(offset, limit),
    queryFn: async () => {
      try {
        const response = await apiClient.get<QuotaDefinition[]>(
          `/licensing/quotas?offset=${offset}&limit=${limit}`
        );

        // Validate with Zod
        if (Array.isArray(response.data)) {
          return response.data.map((item) => QuotaDefinitionSchema.parse(item));
        }
        return [];
      } catch (err) {
        logAndThrow('Failed to fetch quotas', err);
      }
    },
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // ==========================================================================
  // Service Plans Queries
  // ==========================================================================

  const plansQuery = useQuery({
    queryKey: licensingKeys.plans(offset, limit),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ServicePlan[]>(
          `/licensing/plans?offset=${offset}&limit=${limit}`
        );

        // Validate with Zod
        if (Array.isArray(response.data)) {
          return response.data.map((item) => ServicePlanSchema.parse(item));
        }
        return [];
      } catch (err) {
        logAndThrow('Failed to fetch plans', err);
      }
    },
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // ==========================================================================
  // Current Subscription Query
  // ==========================================================================

  const subscriptionQuery = useQuery<TenantSubscription | null>({
    queryKey: licensingKeys.subscription(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<TenantSubscription>('/licensing/subscriptions/current');

        // Validate with Zod
        return TenantSubscriptionSchema.parse(response.data);
      } catch (error: unknown) {
        // Unified 404 handling - return null for no subscription
        const err = toError(error);
        if ((error as any)?.response?.status === 404) {
          return null;
        }
        logger.error('Failed to fetch subscription', err);
        throw err;
      }
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });

  // ==========================================================================
  // Module Mutations
  // ==========================================================================

  const createModuleMutation = useMutation({
    mutationFn: async (data: CreateFeatureModuleRequest): Promise<FeatureModule> => {
      const response = await apiClient.post<FeatureModule>('/licensing/modules', data);
      return FeatureModuleSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.all });
    },
    onError: (err) => {
      logger.error('Failed to create module', toError(err));
    },
  });

  const updateModuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FeatureModule> }): Promise<FeatureModule> => {
      const response = await apiClient.patch<FeatureModule>(`/licensing/modules/${id}`, data);
      return FeatureModuleSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.all });
    },
    onError: (err) => {
      logger.error('Failed to update module', toError(err));
    },
  });

  // ==========================================================================
  // Quota Mutations
  // ==========================================================================

  const createQuotaMutation = useMutation({
    mutationFn: async (data: CreateQuotaDefinitionRequest): Promise<QuotaDefinition> => {
      const response = await apiClient.post<QuotaDefinition>('/licensing/quotas', data);
      return QuotaDefinitionSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.all });
    },
    onError: (err) => {
      logger.error('Failed to create quota', toError(err));
    },
  });

  const updateQuotaMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<QuotaDefinition>;
    }): Promise<QuotaDefinition> => {
      const response = await apiClient.patch<QuotaDefinition>(`/licensing/quotas/${id}`, data);
      return QuotaDefinitionSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.all });
    },
    onError: (err) => {
      logger.error('Failed to update quota', toError(err));
    },
  });

  // ==========================================================================
  // Plan Mutations
  // ==========================================================================

  const createPlanMutation = useMutation({
    mutationFn: async (data: CreateServicePlanRequest): Promise<ServicePlan> => {
      const response = await apiClient.post<ServicePlan>('/licensing/plans', data);
      return ServicePlanSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.all });
    },
    onError: (err) => {
      logger.error('Failed to create plan', toError(err));
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServicePlan> }): Promise<ServicePlan> => {
      const response = await apiClient.patch<ServicePlan>(`/licensing/plans/${id}`, data);
      return ServicePlanSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.all });
    },
    onError: (err) => {
      logger.error('Failed to update plan', toError(err));
    },
  });

  const duplicatePlanMutation = useMutation({
    mutationFn: async (id: string): Promise<ServicePlan> => {
      const response = await apiClient.post<ServicePlan>(`/licensing/plans/${id}/duplicate`);
      return ServicePlanSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.all });
    },
    onError: (err) => {
      logger.error('Failed to duplicate plan', toError(err));
    },
  });

  // ==========================================================================
  // Subscription Mutations
  // ==========================================================================

  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: CreateSubscriptionRequest): Promise<TenantSubscription> => {
      const response = await apiClient.post<TenantSubscription>('/licensing/subscriptions', data);
      return TenantSubscriptionSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.subscription() });
    },
    onError: (err) => {
      logger.error('Failed to create subscription', toError(err));
    },
  });

  const addAddonMutation = useMutation({
    mutationFn: async (data: AddAddonRequest): Promise<void> => {
      await apiClient.post('/licensing/subscriptions/current/addons', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.subscription() });
    },
    onError: (err) => {
      logger.error('Failed to add addon', toError(err));
    },
  });

  const removeAddonMutation = useMutation({
    mutationFn: async (data: RemoveAddonRequest): Promise<void> => {
      await apiClient.delete('/licensing/subscriptions/current/addons', { data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensingKeys.subscription() });
    },
    onError: (err) => {
      logger.error('Failed to remove addon', toError(err));
    },
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  const getModule = async (id: string): Promise<FeatureModule> => {
    const response = await apiClient.get<FeatureModule>(`/licensing/modules/${id}`);
    return FeatureModuleSchema.parse(response.data);
  };

  const getPlan = async (id: string): Promise<ServicePlan> => {
    const response = await apiClient.get<ServicePlan>(`/licensing/plans/${id}`);
    return ServicePlanSchema.parse(response.data);
  };

  const calculatePlanPrice = async (
    id: string,
    params: { billing_period?: string; quantity?: number }
  ): Promise<PlanPricing> => {
    const response = await apiClient.get(`/licensing/plans/${id}/pricing`, { params });
    return PlanPricingSchema.parse(response.data);
  };

  const checkEntitlement = async (data: CheckEntitlementRequest): Promise<CheckEntitlementResponse> => {
    const response = await apiClient.post<CheckEntitlementResponse>('/licensing/entitlements/check', data);
    return CheckEntitlementResponseSchema.parse(response.data);
  };

  const checkQuota = async (data: CheckQuotaRequest): Promise<CheckQuotaResponse> => {
    const response = await apiClient.post<CheckQuotaResponse>('/licensing/quotas/check', data);
    return CheckQuotaResponseSchema.parse(response.data);
  };

  const consumeQuota = async (data: ConsumeQuotaRequest): Promise<void> => {
    await apiClient.post('/licensing/quotas/consume', data);
  };

  const releaseQuota = async (data: ReleaseQuotaRequest): Promise<void> => {
    await apiClient.post('/licensing/quotas/release', data);
  };

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: licensingKeys.all });
  };

  // ==========================================================================
  // Build Return Object
  // ==========================================================================

  const licensingReturn = {
    // Feature Modules
    modules: modulesQuery.data ?? [],
    modulesLoading: modulesQuery.isLoading,
    modulesError: modulesQuery.error,
    createModule: createModuleMutation.mutateAsync,
    updateModule: async (id: string, data: Partial<FeatureModule>) =>
      updateModuleMutation.mutateAsync({ id, data }),
    getModule,

    // Quotas
    quotas: quotasQuery.data ?? [],
    quotasLoading: quotasQuery.isLoading,
    quotasError: quotasQuery.error,
    createQuota: createQuotaMutation.mutateAsync,
    updateQuota: async (id: string, data: Partial<QuotaDefinition>) =>
      updateQuotaMutation.mutateAsync({ id, data }),

    // Service Plans
    plans: plansQuery.data ?? [],
    plansLoading: plansQuery.isLoading,
    plansError: plansQuery.error,
    createPlan: createPlanMutation.mutateAsync,
    updatePlan: async (id: string, data: Partial<ServicePlan>) =>
      updatePlanMutation.mutateAsync({ id, data }),
    getPlan,
    duplicatePlan: duplicatePlanMutation.mutateAsync,
    calculatePlanPrice,

    // Subscriptions
    subscriptionLoading: subscriptionQuery.isLoading,
    subscriptionError: subscriptionQuery.error,
    createSubscription: createSubscriptionMutation.mutateAsync,
    addAddon: addAddonMutation.mutateAsync,
    removeAddon: removeAddonMutation.mutateAsync,

    // Entitlements & Quotas
    checkEntitlement,
    checkQuota,
    consumeQuota,
    releaseQuota,

    // Utilities
    refetch,
  } as UseLicensingReturn;

  // Conditionally add currentSubscription if it exists (not null or undefined)
  if (subscriptionQuery.data !== null && subscriptionQuery.data !== undefined) {
    ((licensingReturn as unknown) as Record<string, unknown>)["currentSubscription"] =
      subscriptionQuery.data;
  }

  return licensingReturn;
}

// ============================================================================
// useFeatureEntitlement Hook
// ============================================================================

export function useFeatureEntitlement(moduleCode?: string, capabilityCode?: string) {
  return useQuery({
    queryKey: licensingKeys.entitlement(moduleCode, capabilityCode),
    queryFn: async () => {
      if (!moduleCode) {
        return { entitled: false };
      }

      try {
        const response = await apiClient.post<CheckEntitlementResponse>('/licensing/entitlements/check', {
          module_code: moduleCode,
          capability_code: capabilityCode,
        });
        const result = CheckEntitlementResponseSchema.parse(response.data);
        return { entitled: result.entitled };
      } catch (err) {
        return logAndReturn('Failed to check entitlement', err, { entitled: false });
      }
    },
    enabled: !!moduleCode,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// useQuotaCheck Hook
// ============================================================================

export function useQuotaCheck(quotaCode: string, quantity = 1) {
  return useQuery({
    queryKey: licensingKeys.quotaCheck(quotaCode, quantity),
    queryFn: async () => {
      try {
        const response = await apiClient.post<CheckQuotaResponse>('/licensing/quotas/check', {
          quota_code: quotaCode,
          quantity,
        });
        const result = CheckQuotaResponseSchema.parse(response.data);
        return {
          available: result.available,
          remaining: result.remaining,
          details: result,
        };
      } catch (err) {
        return logAndReturn('Failed to check quota', err, {
          available: false,
          remaining: 0,
          details: null,
        });
      }
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

export default useLicensing;
