/**
 * React Query hooks for ISP Internet Service Plans API
 *
 * Provides hooks for all 17 API endpoints with proper type safety.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type {
  InternetServicePlan,
  InternetServicePlanCreate,
  InternetServicePlanUpdate,
  ListPlansParams,
  ListSubscriptionsParams,
  PlanComparison,
  PlanStatistics,
  PlanSubscription,
  PlanSubscriptionCreate,
  PlanValidationRequest,
  PlanValidationResponse,
  UsageUpdateRequest,
} from "../types/internet-plans";

const API_BASE = "/services/internet-plans";

// ============================================================================
// Query Keys
// ============================================================================

export const internetPlanKeys = {
  all: ["internet-plans"] as const,
  lists: () => [...internetPlanKeys.all, "list"] as const,
  list: (params: ListPlansParams) => [...internetPlanKeys.lists(), params] as const,
  details: () => [...internetPlanKeys.all, "detail"] as const,
  detail: (id: string) => [...internetPlanKeys.details(), id] as const,
  byCode: (code: string) => [...internetPlanKeys.all, "code", code] as const,
  statistics: (id: string) => [...internetPlanKeys.all, "statistics", id] as const,
  subscriptions: {
    all: ["plan-subscriptions"] as const,
    lists: () => [...internetPlanKeys.subscriptions.all, "list"] as const,
    list: (params: ListSubscriptionsParams) =>
      [...internetPlanKeys.subscriptions.lists(), params] as const,
    detail: (id: string) => [...internetPlanKeys.subscriptions.all, "detail", id] as const,
    byPlan: (planId: string) => [...internetPlanKeys.subscriptions.all, "by-plan", planId] as const,
    byCustomer: (customerId: string) =>
      [...internetPlanKeys.subscriptions.all, "by-customer", customerId] as const,
  },
};

// ============================================================================
// Plan Management Hooks
// ============================================================================

/**
 * List internet service plans with optional filters
 */
export function useInternetPlans(params: ListPlansParams = {}) {
  return useQuery({
    queryKey: internetPlanKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.plan_type) searchParams.append("plan_type", params.plan_type);
      if (params.status) searchParams.append("status", params.status);
      if (params.is_public !== undefined)
        searchParams.append("is_public", String(params.is_public));
      if (params.is_promotional !== undefined)
        searchParams.append("is_promotional", String(params.is_promotional));
      if (params.search) searchParams.append("search", params.search);
      if (params.limit) searchParams.append("limit", String(params.limit));
      if (params.offset) searchParams.append("offset", String(params.offset));

      const url = `${API_BASE}?${searchParams.toString()}`;
      const response = await apiClient.get<InternetServicePlan[]>(url);
      return response.data;
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get a single internet service plan by ID
 */
export function useInternetPlan(planId: string | undefined) {
  return useQuery({
    queryKey: internetPlanKeys.detail(planId!),
    queryFn: async () => {
      const response = await apiClient.get<InternetServicePlan>(`${API_BASE}/${planId}`);
      return response.data;
    },
    enabled: !!planId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get a plan by unique plan code
 */
export function useInternetPlanByCode(planCode: string | undefined) {
  return useQuery({
    queryKey: internetPlanKeys.byCode(planCode!),
    queryFn: async () => {
      const response = await apiClient.get<InternetServicePlan>(`${API_BASE}/code/${planCode}`);
      return response.data;
    },
    enabled: !!planCode,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Create a new internet service plan
 */
export function useCreateInternetPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InternetServicePlanCreate) => {
      const response = await apiClient.post<InternetServicePlan>(API_BASE, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all list queries
      queryClient.invalidateQueries({ queryKey: internetPlanKeys.lists() });
    },
  });
}

/**
 * Update an internet service plan
 */
export function useUpdateInternetPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, data }: { planId: string; data: InternetServicePlanUpdate }) => {
      const response = await apiClient.patch<InternetServicePlan>(`${API_BASE}/${planId}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate specific plan and lists
      queryClient.invalidateQueries({
        queryKey: internetPlanKeys.detail(variables.planId),
      });
      queryClient.invalidateQueries({ queryKey: internetPlanKeys.lists() });
    },
  });
}

/**
 * Archive (soft delete) an internet service plan
 */
export function useDeleteInternetPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      await apiClient.delete(`${API_BASE}/${planId}`);
      return planId;
    },
    onSuccess: () => {
      // Invalidate all list queries
      queryClient.invalidateQueries({ queryKey: internetPlanKeys.lists() });
    },
  });
}

/**
 * Get plan statistics (subscriptions, MRR)
 */
export function usePlanStatistics(planId: string | undefined) {
  return useQuery({
    queryKey: internetPlanKeys.statistics(planId!),
    queryFn: async () => {
      const response = await apiClient.get<PlanStatistics>(`${API_BASE}/${planId}/statistics`);
      return response.data;
    },
    enabled: !!planId,
    staleTime: 30000, // 30 seconds
  });
}

// ============================================================================
// Plan Validation Hooks
// ============================================================================

/**
 * Validate a plan configuration with usage simulation
 */
export function useValidatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, request }: { planId: string; request: PlanValidationRequest }) => {
      const response = await apiClient.post<PlanValidationResponse>(
        `${API_BASE}/${planId}/validate`,
        request,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate plan details to refresh validation status
      queryClient.invalidateQueries({
        queryKey: internetPlanKeys.detail(variables.planId),
      });
    },
  });
}

/**
 * Compare multiple plans side-by-side
 */
export function useComparePlans() {
  return useMutation({
    mutationFn: async (planIds: string[]) => {
      const response = await apiClient.post<PlanComparison>(`${API_BASE}/compare`, planIds);
      return response.data;
    },
  });
}

// ============================================================================
// Subscription Management Hooks
// ============================================================================

/**
 * Subscribe a customer to a plan
 */
export function useSubscribeToPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, data }: { planId: string; data: PlanSubscriptionCreate }) => {
      const response = await apiClient.post<PlanSubscription>(
        `${API_BASE}/${planId}/subscribe`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate subscriptions and plan statistics
      queryClient.invalidateQueries({
        queryKey: internetPlanKeys.subscriptions.byPlan(variables.planId),
      });
      queryClient.invalidateQueries({
        queryKey: internetPlanKeys.statistics(variables.planId),
      });
    },
  });
}

/**
 * List subscriptions for a specific plan
 */
export function usePlanSubscriptions(
  planId: string | undefined,
  params: Omit<ListSubscriptionsParams, "plan_id"> = {},
) {
  const fullParams: ListSubscriptionsParams = {
    ...params,
    plan_id: planId || undefined,
  } as ListSubscriptionsParams;

  return useQuery({
    queryKey: internetPlanKeys.subscriptions.list(fullParams),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.is_active !== undefined)
        searchParams.append("is_active", String(params.is_active));
      if (params.limit) searchParams.append("limit", String(params.limit));
      if (params.offset) searchParams.append("offset", String(params.offset));

      const url = `${API_BASE}/${planId}/subscriptions?${searchParams.toString()}`;
      const response = await apiClient.get<PlanSubscription[]>(url);
      return response.data;
    },
    enabled: !!planId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get a single subscription by ID
 */
export function usePlanSubscription(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: internetPlanKeys.subscriptions.detail(subscriptionId!),
    queryFn: async () => {
      const response = await apiClient.get<PlanSubscription>(
        `${API_BASE}/subscriptions/${subscriptionId}`,
      );
      return response.data;
    },
    enabled: !!subscriptionId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * List subscriptions for a specific customer
 */
export function useCustomerSubscriptions(
  customerId: string | undefined,
  params: Omit<ListSubscriptionsParams, "customer_id"> = {},
) {
  const fullParams: ListSubscriptionsParams = {
    ...params,
    customer_id: customerId || undefined,
  } as ListSubscriptionsParams;

  return useQuery({
    queryKey: internetPlanKeys.subscriptions.list(fullParams),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.is_active !== undefined)
        searchParams.append("is_active", String(params.is_active));
      if (params.limit) searchParams.append("limit", String(params.limit));
      if (params.offset) searchParams.append("offset", String(params.offset));

      const url = `${API_BASE}/customers/${customerId}/subscriptions?${searchParams.toString()}`;
      const response = await apiClient.get<PlanSubscription[]>(url);
      return response.data;
    },
    enabled: !!customerId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Update subscription usage
 */
export function useUpdateSubscriptionUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      usage,
    }: {
      subscriptionId: string;
      usage: UsageUpdateRequest;
    }) => {
      const response = await apiClient.post<PlanSubscription>(
        `${API_BASE}/subscriptions/${subscriptionId}/usage`,
        usage,
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate subscription details
      queryClient.invalidateQueries({
        queryKey: internetPlanKeys.subscriptions.detail(variables.subscriptionId),
      });
      // Also invalidate plan's subscription list if we have the plan_id
      if (data.plan_id) {
        queryClient.invalidateQueries({
          queryKey: internetPlanKeys.subscriptions.byPlan(data.plan_id),
        });
      }
    },
  });
}

/**
 * Reset subscription usage for new billing period
 */
export function useResetSubscriptionUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await apiClient.post<PlanSubscription>(
        `${API_BASE}/subscriptions/${subscriptionId}/reset-usage`,
      );
      return response.data;
    },
    onSuccess: (data, subscriptionId) => {
      // Invalidate subscription details
      queryClient.invalidateQueries({
        queryKey: internetPlanKeys.subscriptions.detail(subscriptionId),
      });
      // Also invalidate plan's subscription list if we have the plan_id
      if (data.plan_id) {
        queryClient.invalidateQueries({
          queryKey: internetPlanKeys.subscriptions.byPlan(data.plan_id),
        });
      }
    },
  });
}
