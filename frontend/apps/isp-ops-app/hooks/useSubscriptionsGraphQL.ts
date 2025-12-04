/**
 * GraphQL Wrapper Hooks for Subscription Management
 *
 * These hooks provide a convenient interface for components, wrapping the
 * auto-generated GraphQL hooks with consistent error handling and data transformation.
 *
 * Benefits:
 * - Consistent interface with existing REST hooks
 * - Drop-in usage for components
 * - Centralized error handling
 * - Type-safe with auto-generated types
 */

import {
  useSubscriptionListQuery,
  useSubscriptionDetailQuery,
  useSubscriptionMetricsQuery,
  usePlanListQuery,
  useProductListQuery,
  useSubscriptionDashboardQuery,
  SubscriptionStatusEnum,
  BillingCycleEnum,
} from "@/lib/graphql/generated";

// ============================================================================
// Subscription List Hook
// ============================================================================

export interface UseSubscriptionListOptions {
  page?: number;
  pageSize?: number;
  status?: SubscriptionStatusEnum;
  billingCycle?: BillingCycleEnum;
  search?: string;
  includeCustomer?: boolean;
  includePlan?: boolean;
  includeInvoices?: boolean;
  enabled?: boolean;
  pollInterval?: number;
}

export function useSubscriptionListGraphQL(options: UseSubscriptionListOptions = {}) {
  const {
    page = 1,
    pageSize = 10,
    status,
    billingCycle,
    search,
    includeCustomer = true,
    includePlan = true,
    includeInvoices = false,
    enabled = true,
    pollInterval = 30000, // 30 seconds default
  } = options;

  const { data, loading, error, refetch } = useSubscriptionListQuery({
    variables: {
      page,
      pageSize,
      status,
      billingCycle,
      search: search || undefined,
      includeCustomer,
      includePlan,
      includeInvoices,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  // Transform to match component expectations
  const subscriptions = data?.subscriptions?.subscriptions ?? [];
  const totalCount = data?.subscriptions?.totalCount ?? 0;
  const hasNextPage = data?.subscriptions?.hasNextPage ?? false;
  const hasPrevPage = data?.subscriptions?.hasPrevPage ?? false;

  return {
    subscriptions,
    total: totalCount,
    hasNextPage,
    hasPrevPage,
    page: data?.subscriptions?.page ?? page,
    pageSize: data?.subscriptions?.pageSize ?? pageSize,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Subscription Detail Hook
// ============================================================================

export interface UseSubscriptionDetailOptions {
  subscriptionId: string;
  enabled?: boolean;
}

export function useSubscriptionDetailGraphQL(options: UseSubscriptionDetailOptions) {
  const { subscriptionId, enabled = true } = options;

  const { data, loading, error, refetch } = useSubscriptionDetailQuery({
    variables: { id: subscriptionId },
    skip: !enabled || !subscriptionId,
    fetchPolicy: "cache-and-network",
  });

  const subscription = data?.subscription ?? null;

  return {
    subscription,
    customer: subscription?.customer ?? null,
    plan: subscription?.plan ?? null,
    recentInvoices: subscription?.recentInvoices ?? [],
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Subscription Metrics Hook
// ============================================================================

export interface UseSubscriptionMetricsOptions {
  enabled?: boolean;
  pollInterval?: number;
}

export function useSubscriptionMetricsGraphQL(options: UseSubscriptionMetricsOptions = {}) {
  const { enabled = true, pollInterval = 60000 } = options; // 60 seconds default

  const { data, loading, error, refetch } = useSubscriptionMetricsQuery({
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const metrics = data?.subscriptionMetrics;

  return {
    metrics: {
      totalSubscriptions: metrics?.totalSubscriptions ?? 0,
      activeSubscriptions: metrics?.activeSubscriptions ?? 0,
      trialingSubscriptions: metrics?.trialingSubscriptions ?? 0,
      pastDueSubscriptions: metrics?.pastDueSubscriptions ?? 0,
      canceledSubscriptions: metrics?.canceledSubscriptions ?? 0,
      pausedSubscriptions: metrics?.pausedSubscriptions ?? 0,
      monthlyRecurringRevenue: metrics?.monthlyRecurringRevenue ?? 0,
      annualRecurringRevenue: metrics?.annualRecurringRevenue ?? 0,
      averageRevenuePerUser: metrics?.averageRevenuePerUser ?? 0,
      newSubscriptionsThisMonth: metrics?.newSubscriptionsThisMonth ?? 0,
      newSubscriptionsLastMonth: metrics?.newSubscriptionsLastMonth ?? 0,
      churnRate: metrics?.churnRate ?? 0,
      growthRate: metrics?.growthRate ?? 0,
      monthlySubscriptions: metrics?.monthlySubscriptions ?? 0,
      quarterlySubscriptions: metrics?.quarterlySubscriptions ?? 0,
      annualSubscriptions: metrics?.annualSubscriptions ?? 0,
      trialConversionRate: metrics?.trialConversionRate ?? 0,
      activeTrials: metrics?.activeTrials ?? 0,
    },
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Subscription Plans Hook
// ============================================================================

export interface UsePlanListOptions {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  billingCycle?: BillingCycleEnum;
  enabled?: boolean;
}

export function usePlanListGraphQL(options: UsePlanListOptions = {}) {
  const { page = 1, pageSize = 20, isActive, billingCycle, enabled = true } = options;

  const { data, loading, error, refetch } = usePlanListQuery({
    variables: {
      page,
      pageSize,
      isActive,
      billingCycle,
    },
    skip: !enabled,
    fetchPolicy: "cache-and-network",
  });

  const plans = data?.plans?.plans ?? [];
  const totalCount = data?.plans?.totalCount ?? 0;
  const hasNextPage = data?.plans?.hasNextPage ?? false;

  return {
    plans,
    total: totalCount,
    hasNextPage,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Products Hook
// ============================================================================

export interface UseProductListOptions {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  category?: string;
  enabled?: boolean;
}

export function useProductListGraphQL(options: UseProductListOptions = {}) {
  const { page = 1, pageSize = 20, isActive, category, enabled = true } = options;

  const { data, loading, error, refetch } = useProductListQuery({
    variables: {
      page,
      pageSize,
      isActive,
      category,
    },
    skip: !enabled,
    fetchPolicy: "cache-and-network",
  });

  const products = data?.products?.products ?? [];
  const totalCount = data?.products?.totalCount ?? 0;
  const hasNextPage = data?.products?.hasNextPage ?? false;

  return {
    products,
    total: totalCount,
    hasNextPage,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Subscription Dashboard Hook (Combined)
// ============================================================================

export interface UseSubscriptionDashboardOptions {
  page?: number;
  pageSize?: number;
  status?: SubscriptionStatusEnum;
  search?: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useSubscriptionDashboardGraphQL(options: UseSubscriptionDashboardOptions = {}) {
  const { page = 1, pageSize = 10, status, search, enabled = true, pollInterval = 30000 } = options;

  const { data, loading, error, refetch } = useSubscriptionDashboardQuery({
    variables: {
      page,
      pageSize,
      status,
      search: search || undefined,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const subscriptions = data?.subscriptions?.subscriptions ?? [];
  const totalCount = data?.subscriptions?.totalCount ?? 0;
  const hasNextPage = data?.subscriptions?.hasNextPage ?? false;
  const metrics = data?.subscriptionMetrics;

  return {
    subscriptions,
    total: totalCount,
    hasNextPage,
    metrics: {
      totalSubscriptions: metrics?.totalSubscriptions ?? 0,
      activeSubscriptions: metrics?.activeSubscriptions ?? 0,
      trialingSubscriptions: metrics?.trialingSubscriptions ?? 0,
      pastDueSubscriptions: metrics?.pastDueSubscriptions ?? 0,
      monthlyRecurringRevenue: metrics?.monthlyRecurringRevenue ?? 0,
      annualRecurringRevenue: metrics?.annualRecurringRevenue ?? 0,
      averageRevenuePerUser: metrics?.averageRevenuePerUser ?? 0,
      newSubscriptionsThisMonth: metrics?.newSubscriptionsThisMonth ?? 0,
      churnRate: metrics?.churnRate ?? 0,
      growthRate: metrics?.growthRate ?? 0,
    },
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Export All Hooks
// ============================================================================

export const SubscriptionGraphQLHooks = {
  useSubscriptionListGraphQL,
  useSubscriptionDetailGraphQL,
  useSubscriptionMetricsGraphQL,
  usePlanListGraphQL,
  useProductListGraphQL,
  useSubscriptionDashboardGraphQL,
};
